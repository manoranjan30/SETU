import React, { useState, useEffect } from "react";
import { AlertTriangle, Database } from "lucide-react";
import api from "../../api/axios";
import { useParams, useNavigate } from "react-router-dom";

// Interfaces
interface BoqActivityPlan {
  id: number;
  boqItem: { description: string; uom: string; qty: number };
  activity: { activityName: string; activityCode: string };
  plannedQuantity: number;
  planningBasis: string;
  mappingType: string;
}

interface Stats {
  boq: { total: number; mapped: number; unmapped: number; coverage: number };
  schedule: {
    total: number;
    linked: number;
    unlinked: number;
    coverage: number;
  };
}

interface Activity {
  id: number;
  activityCode: string;
  activityName: string;
  startDatePlanned: string;
}

interface MapperBoqItem {
  id: number;
  description: string;
  qty: number;
  uom: string;
  mappingStatus: string; // MAPPED | PARTIAL | UNMAPPED
}

import DistributedSchedulePanel from "./distributor/DistributedSchedulePanel";
import ScheduleDistributionMatrix from "./distributor/ScheduleDistributionMatrix"; // Import Added
import { GapAnalysisGrid } from "./GapAnalysisGrid"; // Added
import { LayoutDashboard, Grid3X3, SplitSquareHorizontal } from "lucide-react";

const PlanningMatrix: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // View State
  const [activeTab, setActiveTab] = useState<
    "DASHBOARD" | "MATRIX" | "DISTRIBUTION" | "DISTRIBUTED_VIEW"
  >("DASHBOARD");
  const [dashboardSubTab, setDashboardSubTab] = useState<
    "MATRIX" | "UNLINKED_ACT" | "UNMAPPED_BOQ" | "GAP_ANALYSIS"
  >("GAP_ANALYSIS");

  // Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [matrix, setMatrix] = useState<BoqActivityPlan[]>([]);
  const [unlinkedActivities, setUnlinkedActivities] = useState<Activity[]>([]);
  const [unmappedBoq, setUnmappedBoq] = useState<MapperBoqItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (projectId && activeTab === "DASHBOARD") {
      fetchAll();
    }
  }, [projectId, activeTab]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, matrixRes, actRes, boqRes] = await Promise.all([
        api.get(`/planning/${projectId}/stats`),
        api.get(`/planning/${projectId}/matrix`),
        api.get(`/planning/${projectId}/unlinked-activities`),
        api.get(`/planning/mapper/boq/${projectId}`),
      ]);
      setStats(statsRes.data);
      setMatrix(matrixRes.data);
      setUnlinkedActivities(actRes.data);
      const allBoq = boqRes.data as MapperBoqItem[];
      setUnmappedBoq(allBoq.filter((b) => b.mappingStatus !== "MAPPED"));
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  const StatusCard = ({ title, value, subtext, color }: any) => (
    <div
      className={`bg-surface-card p-4 rounded-lg shadow-sm border border-l-4 border-${color}-500`}
    >
      <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">
        {title}
      </p>
      <p className="text-2xl font-bold text-gray-800 my-1">{value}</p>
      <p className={`text-xs text-${color}-600 font-medium`}>{subtext}</p>
    </div>
  );

  return (
    <div className="space-y-6 p-1 h-full flex flex-col">
      {/* Top Toolbar */}
      <div className="flex justify-between items-center bg-surface-card p-2 rounded shadow-sm border border-border-default">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("DASHBOARD")}
            className={`px-4 py-2 text-sm font-medium rounded flex items-center gap-2 transition-colors ${
              activeTab === "DASHBOARD"
                ? "bg-info-muted text-blue-700"
                : "text-text-secondary hover:bg-surface-base"
            }`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab("MATRIX")}
            className={`px-4 py-2 text-sm font-medium rounded flex items-center gap-2 transition-colors ${
              activeTab === "MATRIX"
                ? "bg-info-muted text-blue-700"
                : "text-text-secondary hover:bg-surface-base"
            }`}
          >
            <Grid3X3 size={16} /> Distribution Matrix
          </button>
          <button
            onClick={() => setActiveTab("DISTRIBUTED_VIEW")}
            className={`px-4 py-2 text-sm font-medium rounded flex items-center gap-2 transition-colors ${
              activeTab === "DISTRIBUTED_VIEW"
                ? "bg-info-muted text-blue-700"
                : "text-text-secondary hover:bg-surface-base"
            }`}
          >
            <SplitSquareHorizontal size={16} /> Distributed View
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
        {activeTab === "DISTRIBUTION" && (
          <div className="flex-1 p-4 h-full min-h-0 w-full">
            <ScheduleDistributionMatrix />
          </div>
        )}

        {activeTab === "DISTRIBUTED_VIEW" && (
          <div className="flex-1 p-4 h-full min-h-0 w-full">
            <DistributedSchedulePanel />
          </div>
        )}

        {activeTab === "MATRIX" && (
          <div className="flex-1 p-4 flex flex-col h-full min-h-0 w-full">
            <div className="flex-1 relative min-h-0 w-full bg-surface-card rounded-lg shadow-sm border border-border-default">
              {/* Wrapper to ensure internal component gets height */}
              <div className="absolute inset-0">
                <ScheduleDistributionMatrix />
              </div>
            </div>
          </div>
        )}

        {activeTab === "DASHBOARD" && (
          <div className="space-y-6 overflow-y-auto pr-2 pb-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatusCard
                title="Schedule Coverage"
                value={`${stats?.schedule?.coverage || 0}%`}
                subtext={`${stats?.schedule?.linked || 0} / ${stats?.schedule?.total || 0} Activities`}
                color={stats?.schedule?.coverage === 100 ? "green" : "blue"}
              />
              <StatusCard
                title="Scope Coverage"
                value={`${stats?.boq?.coverage || 0}%`}
                subtext={`${stats?.boq?.mapped || 0} / ${stats?.boq?.total || 0} Items`}
                color={stats?.boq?.coverage === 100 ? "green" : "orange"}
              />
              <StatusCard
                title="Unlinked Activities"
                value={stats?.schedule?.unlinked || 0}
                subtext="Gap in Budget/Scope"
                color={stats?.schedule?.unlinked === 0 ? "gray" : "red"}
              />
              <StatusCard
                title="Unmapped Scope"
                value={stats?.boq?.unmapped || 0}
                subtext="Gap in Execution"
                color={stats?.boq?.unmapped === 0 ? "gray" : "red"}
              />
            </div>

            {/* Tabs */}
            <div className="bg-surface-card rounded-lg shadow-sm border border-border-default overflow-hidden min-h-[500px] flex flex-col">
              <div className="flex border-b">
                <button
                  onClick={() => setDashboardSubTab("GAP_ANALYSIS")}
                  className={`px-6 py-3 text-sm font-medium border-r ${dashboardSubTab === "GAP_ANALYSIS" ? "border-b-2 border-purple-600 text-purple-600 bg-purple-50" : "text-text-muted hover:text-text-secondary"}`}
                >
                  Gap Analysis
                </button>
                <button
                  onClick={() => setDashboardSubTab("MATRIX")}
                  className={`px-6 py-3 text-sm font-medium ${dashboardSubTab === "MATRIX" ? "border-b-2 border-primary text-primary bg-primary-muted" : "text-text-muted hover:text-text-secondary"}`}
                >
                  Map Status ({matrix.length})
                </button>
                <button
                  onClick={() => setDashboardSubTab("UNLINKED_ACT")}
                  className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${dashboardSubTab === "UNLINKED_ACT" ? "border-b-2 border-red-600 text-error bg-error-muted" : "text-text-muted hover:text-text-secondary"}`}
                >
                  Unlinked Activities ({unlinkedActivities.length})
                  {unlinkedActivities.length > 0 && <AlertTriangle size={14} />}
                </button>
                <button
                  onClick={() => setDashboardSubTab("UNMAPPED_BOQ")}
                  className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${dashboardSubTab === "UNMAPPED_BOQ" ? "border-b-2 border-orange-600 text-orange-600 bg-orange-50" : "text-text-muted hover:text-text-secondary"}`}
                >
                  Unmapped BOQ ({unmappedBoq.length})
                  {unmappedBoq.length > 0 && <Database size={14} />}
                </button>
              </div>

              <div className="p-0 flex-1 overflow-auto">
                {loading ? (
                  <div className="p-8 text-center text-text-muted">
                    Loading analysis...
                  </div>
                ) : (
                  <>
                    {dashboardSubTab === "GAP_ANALYSIS" && projectId && (
                      <div className="h-full">
                        <GapAnalysisGrid projectId={parseInt(projectId)} />
                      </div>
                    )}

                    {/* VIEW: FULL MATRIX */}
                    {dashboardSubTab === "MATRIX" && (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-surface-base">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                              BOQ Item
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                              Linked Activity
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                              Mapped Qty
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                              Type
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-surface-card divide-y divide-gray-200">
                          {matrix.map((row) => (
                            <tr key={row.id}>
                              <td className="px-6 py-4 text-sm text-text-primary">
                                {row.boqItem?.description}
                              </td>
                              <td className="px-6 py-4 text-sm text-text-primary">
                                {row.activity?.activityName}{" "}
                                <span className="text-xs text-text-disabled">
                                  ({row.activity?.activityCode})
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-mono">
                                {row.plannedQuantity} {row.boqItem?.uom}
                              </td>
                              <td className="px-6 py-4 text-xs text-text-muted">
                                {row.mappingType}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* VIEW: UNLINKED ACTIVITIES */}
                    {dashboardSubTab === "UNLINKED_ACT" && (
                      <div className="flex flex-col h-full">
                        <div className="p-4 bg-error-muted text-red-700 text-sm flex justify-between items-center">
                          <span>
                            Found <b>{unlinkedActivities.length}</b> activities
                            with no budget/scope assigned. This is a risk.
                          </span>
                          <button
                            onClick={() => navigate({ search: "?view=mapper" })}
                            className="bg-surface-card border border-red-200 text-red-700 px-3 py-1 rounded shadow-sm hover:bg-red-100 text-xs font-bold"
                          >
                            Go to Mapper to Fix
                          </button>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-surface-base">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                                Activity Code
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                                Activity Name
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                                Planned Start
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-surface-card divide-y divide-gray-200">
                            {unlinkedActivities.map((act) => (
                              <tr key={act.id}>
                                <td className="px-6 py-4 text-sm font-mono text-text-secondary">
                                  {act.activityCode}
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-text-primary">
                                  {act.activityName}
                                </td>
                                <td className="px-6 py-4 text-sm text-text-muted">
                                  {new Date(
                                    act.startDatePlanned,
                                  ).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                    No Scope
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* VIEW: UNMAPPED BOQ */}
                    {dashboardSubTab === "UNMAPPED_BOQ" && (
                      <div className="flex flex-col h-full">
                        <div className="p-4 bg-orange-50 text-orange-700 text-sm flex justify-between items-center">
                          <span>
                            Found <b>{unmappedBoq.length}</b> BOQ items not
                            fully distributed to schedule. Execution is missing
                            scope.
                          </span>
                          <button
                            onClick={() => navigate({ search: "?view=mapper" })}
                            className="bg-surface-card border border-orange-200 text-orange-700 px-3 py-1 rounded shadow-sm hover:bg-orange-100 text-xs font-bold"
                          >
                            Go to Mapper to Fix
                          </button>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-surface-base">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                                Description
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                                Total Qty
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-surface-card divide-y divide-gray-200">
                            {unmappedBoq.map((item) => (
                              <tr key={item.id}>
                                <td className="px-6 py-4 text-sm text-text-primary">
                                  {item.description}
                                </td>
                                <td className="px-6 py-4 text-sm font-mono">
                                  {item.qty} {item.uom}
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`px-2 py-1 text-xs rounded-full ${item.mappingStatus === "PARTIAL" ? "bg-orange-100 text-orange-800" : "bg-red-100 text-red-800"}`}
                                  >
                                    {item.mappingStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanningMatrix;
