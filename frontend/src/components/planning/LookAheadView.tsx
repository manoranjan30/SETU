import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Layout,
} from "lucide-react";
import api from "../../api/axios";
import ScheduleTable from "../schedule/ScheduleTable";

type TabMode = "SCHEDULE" | "RESOURCES";

const LookAheadView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<TabMode>("SCHEDULE");

  // --- Shared State & Logic (Date Range) ---
  const [filterType, setFilterType] = useState<
    "1MONTH" | "3MONTHS" | "6MONTHS" | "CUSTOM"
  >("3MONTHS");
  const [customRange, setCustomRange] = useState<{
    start: string;
    end: string;
  }>({
    start: new Date().toISOString().split("T")[0],
    end: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      return d.toISOString().split("T")[0];
    })(),
  });

  const currentRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    if (filterType === "1MONTH") {
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (filterType === "6MONTHS") {
      end = new Date(now.getFullYear(), now.getMonth() + 6, 0);
    } else if (filterType === "CUSTOM") {
      return {
        start: customRange.start,
        end: customRange.end,
      };
    }
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  }, [filterType, customRange]);
  // ...
  // (JSX part below - I need to modify the buttons)

  // --- Tab 1: Schedule Logic (Client-side Filter) ---
  const [schedLoading, setSchedLoading] = useState(false);
  const [allActivities, setAllActivities] = useState<any[]>([]);
  const [allWbsNodes, setAllWbsNodes] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [projectCode, setProjectCode] = useState("");

  const [sourceInfo, setSourceInfo] = useState("Loading...");

  const fetchSchedule = async () => {
    if (!projectId) return;
    setSchedLoading(true);
    try {
      // 1. Fetch Versions and find the best candidate (matches backend logic)
      const versionsRes = await api.get(`/planning/${projectId}/versions`);
      const versions = versionsRes.data || [];

      // Sort: isActive DESC, createdOn DESC
      const sortedVersions = [...versions].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return (
          new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
        );
      });

      const latestWorking = sortedVersions.find(
        (v) => v.versionType === "WORKING",
      );

      let activities: any[] = [];
      let rels: any[] = [];
      let sourceLabel = "Master Schedule";

      if (latestWorking) {
        sourceLabel = `Revision ${latestWorking.versionCode}${latestWorking.isActive ? " (Active)" : ""}`;
        const [actRes, relRes] = await Promise.all([
          api.get(
            `/planning/versions/${latestWorking.id}/activities?projectId=${projectId}`,
          ),
          api.get(`/planning/${projectId}/relationships`),
        ]);

        activities = actRes.data.map((av: any) => ({
          ...av.activity,
          ...av,
          id: av.activity.id,
          startDatePlanned: av.startDate,
          finishDatePlanned: av.finishDate,
        }));
        rels = relRes.data;
      } else {
        const schedRes = await api.get(`/projects/${projectId}/schedule`);
        activities = schedRes.data.activities || [];
        rels = schedRes.data.relationships || [];
      }

      // 2. Fetch WBS & Project Profile
      const [wbsRes, profileRes] = await Promise.all([
        api.get(`/projects/${projectId}/wbs`),
        api.get(`/eps/${projectId}/profile`),
      ]);

      setAllActivities(activities);
      setRelationships(rels);
      setAllWbsNodes(wbsRes.data);
      setProjectCode(profileRes.data?.projectCode || "");
      setSourceInfo(sourceLabel);
    } catch (err) {
      console.error("Failed to fetch schedule", err);
      setSourceInfo("Error Loading");
    } finally {
      setSchedLoading(false);
    }
  };

  const filteredSchedule = useMemo(() => {
    if (allActivities.length === 0 || allWbsNodes.length === 0) {
      return { activities: [], wbsNodes: [] };
    }

    const start = new Date(currentRange.start);
    const end = new Date(currentRange.end);

    // Filter activities by date window OR Pending status (Backlog)
    const relevantActivities = allActivities.filter((a) => {
      if (!a.startDatePlanned || !a.finishDatePlanned) return false;

      const aStart = new Date(a.startDatePlanned);
      const aFinish = new Date(a.finishDatePlanned);
      const isCompleted = (a.percentComplete || 0) >= 100;

      // Include if:
      // 1. Overlay with window
      // 2. OR It's uncompleted and was supposed to start/finish before the window (Backlog)
      // BUT limit by planned start <= window end (no future look-ahead beyond window)

      const overlapsWindow = aStart <= end && aFinish >= start;
      const isBacklog = !isCompleted && aFinish < start; // Uncompleted and past due

      // Only show if it's not finished and started/starts before window end
      return (overlapsWindow || isBacklog) && aStart <= end;
    });

    // Collect all WBS nodes in the hierarchy for these activities
    const relevantWbsIds = new Set<number>();
    relevantActivities.forEach((a) => {
      const wbsId =
        a.wbsNode?.id || (a as any).wbsNodeId || (a as any).wbs_node_id;
      if (wbsId) {
        let currentId = wbsId;
        while (currentId) {
          if (relevantWbsIds.has(currentId)) break;
          relevantWbsIds.add(currentId);
          const node = allWbsNodes.find((n) => n.id === currentId);
          currentId = node ? node.parentId : null;
        }
      }
    });

    return {
      activities: relevantActivities,
      wbsNodes: allWbsNodes.filter((n) => relevantWbsIds.has(n.id)),
    };
  }, [allActivities, allWbsNodes, currentRange]);

  // --- Tab 2: Resource Plan Logic (Server-side Calc) ---
  const [resLoading, setResLoading] = useState(false);
  const [resData, setResData] = useState<any>(null);
  const [expandedBoqs, setExpandedBoqs] = useState<Set<number>>(new Set());

  const fetchResourcePlan = async () => {
    if (!projectId) return;
    setResLoading(true);
    try {
      const res = await api.post("/planning/look-ahead", {
        projectId: parseInt(projectId),
        startDate: currentRange.start,
        endDate: currentRange.end,
      });
      setResData(res.data);
    } catch (err) {
      console.error("Failed to fetch resource plan", err);
    } finally {
      setResLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "SCHEDULE") fetchSchedule();
    else fetchResourcePlan();
  }, [projectId, activeTab, currentRange]);

  const handlePreset = (months: number) => {
    if (months === 1) setFilterType("1MONTH");
    else if (months === 3) setFilterType("3MONTHS");
    else if (months === 6) setFilterType("6MONTHS");
  };

  return (
    <div className="h-full flex flex-col bg-surface-card">
      {/* Header / Tabs */}
      <div className="px-6 py-4 bg-surface-card border-b border-border-default shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Layout className="w-6 h-6 text-secondary" />
                Look Ahead Plan
              </h2>
              <p className="text-xs text-text-muted flex items-center gap-2 mt-1">
                <span className="bg-secondary-muted text-indigo-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
                  Source: {sourceInfo}
                </span>
                <span>
                  Window:{" "}
                  <span className="font-semibold text-text-primary">
                    {currentRange.start}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-text-primary">
                    {currentRange.end}
                  </span>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Period Selectors */}
            <div className="flex bg-surface-raised p-1 rounded-lg">
              <button
                onClick={() => handlePreset(1)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === "1MONTH" ? "bg-surface-card text-secondary shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
              >
                1 Month
              </button>
              <button
                onClick={() => handlePreset(3)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === "3MONTHS" ? "bg-surface-card text-secondary shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
              >
                3 Months
              </button>
              <button
                onClick={() => handlePreset(6)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === "6MONTHS" ? "bg-surface-card text-secondary shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
              >
                6 Months
              </button>
              <button
                onClick={() => setFilterType("CUSTOM")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === "CUSTOM" ? "bg-surface-card text-secondary shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
              >
                Custom
              </button>
            </div>

            {filterType === "CUSTOM" && (
              <div className="flex items-center gap-2 bg-surface-base px-3 py-1.5 rounded-lg border border-border-default">
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(e) =>
                    setCustomRange((p) => ({ ...p, start: e.target.value }))
                  }
                  className="bg-transparent text-sm font-medium outline-none"
                />
                <span className="text-text-disabled">→</span>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(e) =>
                    setCustomRange((p) => ({ ...p, end: e.target.value }))
                  }
                  className="bg-transparent text-sm font-medium outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex border-b border-border-subtle">
          <button
            onClick={() => setActiveTab("SCHEDULE")}
            className={`px-6 py-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === "SCHEDULE" ? "border-secondary text-secondary" : "border-transparent text-text-muted hover:text-text-secondary"}`}
          >
            Look Ahead Schedule
          </button>
          <button
            onClick={() => setActiveTab("RESOURCES")}
            className={`px-6 py-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === "RESOURCES" ? "border-secondary text-secondary" : "border-transparent text-text-muted hover:text-text-secondary"}`}
          >
            Look Ahead Resource Plan
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "SCHEDULE" ? (
          schedLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-card z-10">
              <div className="flex flex-col items-center gap-2">
                <TrendingUp className="w-8 h-8 text-secondary animate-pulse" />
                <span className="text-text-muted font-medium">
                  Filtering Schedule...
                </span>
              </div>
            </div>
          ) : (
            <ScheduleTable
              activities={filteredSchedule.activities}
              wbsNodes={filteredSchedule.wbsNodes}
              relationships={relationships}
              zoom={1}
              projectCode={projectCode}
              forceExpandAll={true}
            />
          )
        ) : resLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-card z-10">
            <div className="flex flex-col items-center gap-2">
              <DollarSign className="w-8 h-8 text-emerald-500 animate-pulse" />
              <span className="text-text-muted font-medium">
                Calculating Resources...
              </span>
            </div>
          </div>
        ) : !resData ? (
          <div className="h-full flex items-center justify-center text-text-disabled">
            No data loaded
          </div>
        ) : (
          <div className="h-full flex flex-col overflow-auto">
            {/* Resource Plan Content (Cards + Table) */}
            <div className="grid grid-cols-3 gap-6 p-6">
              <div className="bg-gradient-to-br from-secondary to-indigo-600 p-6 rounded-2xl shadow-lg text-white">
                <h3 className="text-indigo-100 text-xs font-bold uppercase mb-1">
                  Projected Total Cost
                </h3>
                <p className="text-3xl font-black">
                  ₹
                  {resData.aggregated
                    .reduce(
                      (sum: number, r: any) => sum + (r.totalAmount || 0),
                      0,
                    )
                    .toLocaleString()}
                </p>
                <p className="text-indigo-200 text-xs mt-2">
                  Active: {resData.activitiesCount} activities
                </p>
              </div>
              <div className="bg-surface-card border border-border-default p-6 rounded-2xl shadow-sm">
                <h3 className="text-emerald-500 text-xs font-bold uppercase mb-1">
                  Material Budget
                </h3>
                <p className="text-3xl font-black text-gray-800">
                  ₹
                  {resData.aggregated
                    .filter((r: any) => r.type === "MATERIAL")
                    .reduce(
                      (sum: number, r: any) => sum + (r.totalAmount || 0),
                      0,
                    )
                    .toLocaleString()}
                </p>
                <p className="text-text-disabled text-xs mt-2 font-medium">
                  Infrastructure & Procurement
                </p>
              </div>
              <div className="bg-surface-card border border-border-default p-6 rounded-2xl shadow-sm">
                <h3 className="text-amber-500 text-xs font-bold uppercase mb-1">
                  Labor Budget
                </h3>
                <p className="text-3xl font-black text-gray-800">
                  ₹
                  {resData.aggregated
                    .filter((r: any) => r.type === "LABOR")
                    .reduce(
                      (sum: number, r: any) => sum + (r.totalAmount || 0),
                      0,
                    )
                    .toLocaleString()}
                </p>
                <p className="text-text-disabled text-xs mt-2 font-medium">
                  Direct Execution Cost
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-6">
              {/* BOQ Breakdown Table */}
              <div className="bg-surface-card border border-border-default rounded-xl shadow-sm overflow-hidden">
                <div className="bg-surface-base px-6 py-3 border-b border-border-default">
                  <h4 className="text-sm font-bold text-text-secondary">
                    BOQ Item Breakdown
                  </h4>
                </div>
                <table className="w-full">
                  <thead className="bg-surface-raised border-b border-border-default">
                    <tr>
                      <th className="w-12"></th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-text-muted uppercase">
                        Item Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-text-muted uppercase">
                        Projected Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resData.boqBreakdown.map((item: any) => (
                      <React.Fragment key={item.id}>
                        <tr
                          className="hover:bg-surface-base cursor-pointer"
                          onClick={() => {
                            const next = new Set(expandedBoqs);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            setExpandedBoqs(next);
                          }}
                        >
                          <td className="text-center">
                            {expandedBoqs.has(item.id) ? (
                              <ChevronDown className="w-4 h-4 mx-auto" />
                            ) : (
                              <ChevronRight className="w-4 h-4 mx-auto" />
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-800 text-sm">
                              {item.boqCode}
                            </div>
                            <div className="text-xs text-text-muted line-clamp-1">
                              {item.description}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-gray-800">
                            ₹{item.totalAmount.toLocaleString()}
                          </td>
                        </tr>
                        {expandedBoqs.has(item.id) &&
                          item.resources
                            .sort(
                              (a: any, b: any) =>
                                (b.totalAmount || 0) - (a.totalAmount || 0),
                            )
                            .map((res: any, idx: number) => (
                              <tr key={idx} className="bg-secondary-muted/30">
                                <td></td>
                                <td className="px-6 py-2 pl-12 text-sm text-text-secondary flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                  {res.resourceName}
                                </td>
                                <td className="px-6 py-2 text-right text-xs font-mono text-text-muted">
                                  <span className="font-bold text-text-secondary">
                                    {res.totalQty.toFixed(2)} {res.uom}
                                  </span>{" "}
                                  @ ₹{(res.rate || 0).toLocaleString()}{" "}
                                  <span className="text-secondary font-bold ml-2">
                                    ₹{(res.totalAmount || 0).toLocaleString()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Activity Reference Table */}
              <div className="bg-surface-card border border-border-default rounded-xl shadow-sm overflow-hidden">
                <div className="bg-surface-base px-6 py-3 border-b border-border-default flex justify-between items-center">
                  <h4 className="text-sm font-bold text-text-secondary">
                    Activities considered in Calculation
                  </h4>
                  <span className="text-xs font-medium text-secondary bg-secondary-muted px-2 py-1 rounded-full">
                    {resData.cpmActivities?.length || 0} Total
                  </span>
                </div>
                <table className="w-full">
                  <thead className="bg-surface-raised border-b border-border-default">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-text-muted uppercase">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-text-muted uppercase">
                        Activity Name
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-text-muted uppercase">
                        Window Overlap
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resData.cpmActivities?.map((act: any) => (
                      <tr key={act.id} className="hover:bg-surface-base">
                        <td className="px-6 py-3 text-xs font-mono font-bold text-secondary">
                          {act.code}
                        </td>
                        <td className="px-6 py-3 text-xs text-text-secondary font-medium">
                          {act.name}
                        </td>
                        <td className="px-6 py-3 text-right text-xs font-bold text-text-primary">
                          {act.overlapDays} Days
                        </td>
                      </tr>
                    ))}
                    {(!resData.cpmActivities ||
                      resData.cpmActivities.length === 0) && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-8 text-center text-sm text-text-disabled"
                        >
                          No activities overlapping this period. Check schedule
                          dates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LookAheadView;
