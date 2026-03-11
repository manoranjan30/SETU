import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  ArrowLeft,
  Calendar,
  Search,
  Activity as ActivityIcon,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Folder,
} from "lucide-react";
import { VendorProgressPane } from "../../components/execution/VendorProgressPane";
import { Tree, type TreeNodeData } from "../../components/common/Tree";
import ExecutionLogTable from "./ExecutionLogTable";
import ActivityLaborAllocation from "../../components/labor/ActivityLaborAllocation";

// ---------------------------------------------------------------------------
// External Components (Stable References)
// ---------------------------------------------------------------------------

// Removed InputCell

const ProgressEntry = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Layout State
  const [showTree, setShowTree] = useState(true);
  const [showList, setShowList] = useState(true);

  // Resizable Panes
  const [leftWidth, setLeftWidth] = useState(300);
  const [middleWidth, setMiddleWidth] = useState(350);
  const treeRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isResizingTree = useRef(false);
  const isResizingList = useRef(false);

  // Data State
  const [epsTree, setEpsTree] = useState<TreeNodeData[]>([]);

  // Changing to Multi-Select Array
  const [selectedEpsIds, setSelectedEpsIds] = useState<number[]>([]);

  const [restrictToFloor, setRestrictToFloor] = useState(false);

  const [activities, setActivities] = useState<any[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(
    null,
  );
  const [loadingActivities, setLoadingActivities] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Tab State
  const [activeTab, setActiveTab] = useState<"entry" | "log" | "labor">(
    "entry",
  );
  const [laborCategories, setLaborCategories] = useState<any[]>([]);

  // Removed Micro Schedule Modal State & Effect
  useEffect(() => {
    if (activeTab === "labor" && projectId) {
      fetchLaborCategories();
    }
  }, [activeTab, projectId]);

  const fetchLaborCategories = async () => {
    try {
      const res = await api.get(`/labor/categories?projectId=${projectId}`);
      setLaborCategories(res.data);
    } catch (err) {
      console.error("Failed to fetch labor categories", err);
    }
  };

  // Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingTree.current) {
        const newWidth = Math.max(200, Math.min(600, e.clientX));
        setLeftWidth(newWidth);
      } else if (isResizingList.current) {
        const startX = showTree ? leftWidth : 40;
        const newWidth = Math.max(250, Math.min(800, e.clientX - startX));
        setMiddleWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizingTree.current = false;
      isResizingList.current = false;
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [showTree, leftWidth]);

  const startResizingTree = () => {
    isResizingTree.current = true;
    document.body.style.cursor = "col-resize";
  };

  const startResizingList = () => {
    isResizingList.current = true;
    document.body.style.cursor = "col-resize";
  };

  // Data Fetching
  useEffect(() => {
    if (projectId) fetchEpsTree();
  }, [projectId]);

  useEffect(() => {
    // When selection changes
    if (selectedEpsIds.length > 0) {
      // Selected Node acts as the "Project" context for execution
      fetchActivities(selectedEpsIds);
      setSelectedActivityId(null);
    } else {
      setActivities([]);
    }
  }, [selectedEpsIds]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredActivities(activities);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredActivities(
        activities.filter(
          (a) =>
            a.activityName.toLowerCase().includes(lower) ||
            a.activityCode.toLowerCase().includes(lower) ||
            a.wbsName?.toLowerCase().includes(lower),
        ),
      );
    }
  }, [searchTerm, activities]);

  const fetchEpsTree = async () => {
    try {
      const res = await api.get(`/eps/${projectId}/tree`);
      const rawTree = res.data;

      // 2. Set Tree for UI (Apply restriction if active)
      const formatted = mapEpsToTree(rawTree, restrictToFloor);
      setEpsTree(formatted);

      // Store raw for toggling
      (window as any).__rawEpsTree = rawTree;
    } catch (err) {
      console.error("Failed to fetch EPS Tree", err);
    }
  };

  // Toggle Effect
  useEffect(() => {
    const raw = (window as any).__rawEpsTree;
    if (raw) {
      setEpsTree(mapEpsToTree(raw, restrictToFloor));
    }
  }, [restrictToFloor]);

  const mapEpsToTree = (nodes: any[], restrict: boolean): TreeNodeData[] => {
    if (!nodes) return [];

    return nodes
      .filter((node) => {
        // First pass filter: Remove Units and Rooms immediately at this level
        if (!restrict) return true;
        const type = (node.type || "").toUpperCase();
        return type !== "UNIT" && type !== "ROOM";
      })
      .map((node) => {
        const type = (node.type || "").toUpperCase();

        // Pruning Logic:
        // If we are restricting, and we hit a FLOOR, we must stop recursion.
        // We also stop if we somehow hit a UNIT or ROOM (though filtered above, safety check).
        const isFloor = type === "FLOOR";

        const returnNoChildren = restrict && isFloor;

        return {
          id: node.id,
          label: node.label || node.name || `Node ${node.id}`,
          type: node.type,
          // If we prune, send empty array.
          // CRITICAL: We also recurse with the restrict flag.
          children: returnNoChildren
            ? []
            : mapEpsToTree(node.children, restrict),
        };
      });
  };

  const fetchActivities = async (targetIds: number[]) => {
    try {
      setLoadingActivities(true);
      setActivities([]);

      if (targetIds.length === 0) {
        setLoadingActivities(false);
        return;
      }

      // FILTERING: We used to filter by type, but since activities can exist at Unit/Room level
      // and we rely on cascade selection to pick them up, we should NOT filter them out.
      // If the node has activities, we want them.
      const relevantIds = targetIds;

      const idsToFetch = relevantIds;

      if (idsToFetch.length === 0) {
        setLoadingActivities(false);
        return;
      }

      // Limit concurrency
      const uniqueIds = Array.from(new Set(idsToFetch));
      // Limit to 20 parallel requests to avoid blasting the server
      const limitedIds = uniqueIds.slice(0, 20);

      // FIX: DO NOT pass EPS Node ID as Project ID. Pass the context Project ID (from URL)
      // and use 'wbsNodeId' query param instead. This satisfies ProjectAssignmentGuard.
      const promises = limitedIds.map((id) =>
        api
          .get(`/planning/${projectId}/execution-ready`, {
            params: { wbsNodeId: id },
          })
          .catch(() => ({ data: [] })),
      );

      const responses = await Promise.all(promises);

      const allRows = responses.flatMap((r) => r.data);
      console.log(
        `[ProgressEntry] Fetched ${allRows.length} total rows. Deduplicating...`,
      );

      // Deduplicate (in case multiple selected nodes return the same activity via recursion)
      const uniqueActivities = new Map();
      allRows.forEach((row: any) => {
        // Use Activity CODE as key to ensure uniqueness (Handling database duplicates)
        const key = row.activityCode;
        if (key && !uniqueActivities.has(key)) {
          uniqueActivities.set(key, row);
        }
      });
      console.log(
        `[ProgressEntry] Unique activities (by Code): ${uniqueActivities.size}`,
      );

      // Map Raw Data
      const rawData = Array.from(uniqueActivities.values());
      const formattedActivities = rawData.map((a: any) => ({
        id: a.id,
        activityName: a.activityName,
        activityCode: a.activityCode,
        wbsPath: a.wbsPath,
        parentWbs: a.parentWbs,
        status: a.status,
        startDatePlanned: a.startDatePlanned,
        finishDatePlanned: a.finishDatePlanned,
        startDateActual: a.startDateActual,
        finishDateActual: a.finishDateActual,
        plans: a.plans
          ? a.plans.map((p: any) => ({
              planId: p.planId,
              plannedQty: p.plannedQuantity,
              // FIX: Include consumedQty at plan level (activity-specific executed qty)
              consumedQty: p.consumedQty || 0,
              // PASS PARENT STATUS for UI locking
              activityStatus: a.status,
              finishDateActual: a.finishDateActual,
              boqItem: p.boqItem || {
                id: p.boqItemId,
                description: p.description,
                uom: p.uom,
                qty: p.totalQty,
                consumedQty: p.consumedQty, // Also keep here for legacy
              },
            }))
          : [],
      }));

      setActivities(formattedActivities);
      // End of Grouping Replacement
    } catch (err) {
      console.error(err);
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleMarkComplete = async (
    e: React.MouseEvent,
    activityId: number,
    currentStatus: string,
  ) => {
    e.stopPropagation(); // Prevent card selection

    if (currentStatus === "COMPLETED") return; // Already done

    if (
      !confirm(
        "Are you sure you want to mark this activity as fully COMPLETED? This will set actual finish date to today.",
      )
    )
      return;

    try {
      await api.post(`/planning/activities/${activityId}/complete`);
      // Refresh
      if (selectedEpsIds.length > 0) fetchActivities(selectedEpsIds);
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
    }
  };

  // Removed handleSave, processConfirm, gridData, colDefs, gridContext

  return (
    <div className="flex h-full flex-col bg-surface-base text-sm">
      {/* Header */}
      <div className="bg-surface-card border-b border-border-default px-4 py-3 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface-raised rounded-full text-text-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Site Execution
            </h1>
            <div className="flex items-center gap-1 mt-0.5">
              <button
                onClick={() => setActiveTab("entry")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === "entry" ? "bg-primary text-white" : "bg-surface-raised text-text-muted hover:bg-gray-200"}`}
              >
                Record Progress
              </button>
              <button
                onClick={() => setActiveTab("labor")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === "labor" ? "bg-primary text-white" : "bg-surface-raised text-text-muted hover:bg-gray-200"}`}
              >
                Labor Allocation
              </button>
              <button
                onClick={() => setActiveTab("log")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === "log" ? "bg-primary text-white" : "bg-surface-raised text-text-muted hover:bg-gray-200"}`}
              >
                Execution History
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-surface-raised rounded-md px-3 py-1.5 border border-transparent focus-within:border-primary focus-within:bg-surface-card transition-all">
            <Calendar className="w-4 h-4 text-text-muted mr-2" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent border-none text-sm focus:ring-0 p-0 text-text-secondary font-medium w-32"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "log" ? (
          <ExecutionLogTable projectId={Number(projectId)} />
        ) : (
          /* 3-Pane Layout */
          <div className="flex h-full overflow-hidden relative">
            {/* Pane 1: Tree */}
            <div
              ref={treeRef}
              style={{
                width: showTree ? leftWidth : 0,
                minWidth: showTree ? 200 : 0,
              }}
              className={`bg-surface-card border-r border-border-default flex flex-col transition-all duration-300 overflow-hidden relative`}
            >
              <div className="p-2 border-b border-border-subtle flex flex-col bg-surface-base flex-shrink-0 gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider pl-2 overflow-hidden whitespace-nowrap">
                    Location / WBS
                  </span>
                  <button
                    onClick={() => setShowTree(false)}
                    className="p-1 hover:bg-gray-200 rounded text-text-muted"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
                <label className="flex items-center gap-2 px-2 pb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restrictToFloor}
                    onChange={(e) => setRestrictToFloor(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                  />
                  <span className="text-xs text-text-secondary font-medium">
                    Restrict to Floor Level
                  </span>
                </label>
              </div>
              <div className="flex-1 overflow-auto p-2 scrollbar-thin">
                <Tree
                  data={epsTree}
                  selectedIds={selectedEpsIds}
                  cascadeSelection={true}
                  onSelect={(ids) => {
                    const numIds = ids.map((i) => Number(i));
                    setSelectedEpsIds(numIds);
                  }}
                />
              </div>
              {showTree && (
                <div
                  onMouseDown={startResizingTree}
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-10 opacity-0 hover:opacity-100 active:bg-primary active:opacity-100 transition-opacity"
                />
              )}
            </div>

            {!showTree && (
              <div
                className="border-r border-border-default bg-surface-base flex flex-col items-center py-2 w-8 cursor-pointer hover:bg-surface-raised flex-shrink-0"
                onClick={() => setShowTree(true)}
              >
                <Folder className="w-4 h-4 text-text-disabled mb-2" />
                <div className="writing-vertical-lr text-xs text-text-disabled font-medium tracking-wide uppercase py-4">
                  Locations
                </div>
                <ChevronRight className="w-4 h-4 text-text-disabled mt-auto" />
              </div>
            )}

            {/* Pane 2: List */}
            <div
              ref={listRef}
              style={{
                width: showList ? middleWidth : 0,
                minWidth: showList ? 250 : 0,
              }}
              className={`bg-surface-card border-r border-border-default flex flex-col transition-all duration-300 overflow-hidden relative`}
            >
              <div className="p-2 border-b border-border-subtle flex justify-between items-center bg-surface-base h-10 flex-shrink-0">
                <div className="flex items-center overflow-hidden flex-1">
                  <Search className="w-3 h-3 text-text-disabled ml-1 mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none text-xs focus:ring-0 p-0 text-text-secondary w-full"
                  />
                </div>
                <button
                  onClick={() => setShowList(false)}
                  className="p-1 hover:bg-gray-200 rounded text-text-muted flex-shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto scrollbar-thin">
                {loadingActivities ? (
                  <div className="p-4 text-center text-text-disabled text-xs">
                    Loading...
                  </div>
                ) : filteredActivities.length === 0 ? (
                  <div className="p-8 text-center text-text-disabled text-xs">
                    {selectedEpsIds.length > 0
                      ? "No activities found for selected location(s)."
                      : "Select a Block/Floor to view Activities."}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredActivities.map((activity) => (
                      <div
                        key={activity.id}
                        onClick={() => setSelectedActivityId(activity.id)}
                        className={`p-3 cursor-pointer hover:bg-surface-base transition-colors border-l-4 
                                            ${selectedActivityId === activity.id ? "bg-primary-muted border-primary" : "border-transparent hover:border-border-strong"}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-blue-700 bg-info-muted/50 px-2 py-0.5 rounded font-mono shadow-sm">
                                {activity.activityCode}
                              </span>
                              <span className="text-[11px] font-extrabold text-blue-900 uppercase tracking-wide">
                                {activity.parentWbs ||
                                  activity.wbsPath.split(" > ").pop()}
                              </span>
                            </div>
                            <span className="font-bold text-text-primary text-sm leading-snug">
                              {activity.activityName}
                            </span>
                          </div>
                          <button
                            onClick={(e) =>
                              handleMarkComplete(
                                e,
                                activity.id,
                                activity.status,
                              )
                            }
                            className={`p-1.5 rounded-full transition-all ${activity.status === "COMPLETED" || activity.finishDateActual ? "text-success bg-success-muted shadow-sm" : "text-gray-300 hover:text-success hover:bg-surface-card"}`}
                            title={
                              activity.status === "COMPLETED"
                                ? "Completed"
                                : "Mark as Complete"
                            }
                          >
                            {activity.status === "COMPLETED" ||
                            activity.finishDateActual ? (
                              <CheckCircle className="w-5 h-5 fill-green-50" />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-current hover:bg-success-muted" />
                            )}
                          </button>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                          <div
                            className="text-[9px] text-text-disabled truncate uppercase tracking-tighter max-w-[140px]"
                            title={activity.wbsPath}
                          >
                            {activity.wbsPath}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-disabled bg-surface-base px-1.5 py-0.5 rounded border border-border-subtle italic">
                            {activity.plans.length} Resources
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-2 bg-surface-base border-t border-border-default text-[10px] text-text-muted text-center truncate px-4 flex-shrink-0">
                {selectedEpsIds.length > 0
                  ? `Filtered by: ${selectedEpsIds.length} Location(s)`
                  : "Select a Block/Floor to view Activities"}
              </div>

              {showList && (
                <div
                  onMouseDown={startResizingList}
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-10 opacity-0 hover:opacity-100 active:bg-primary active:opacity-100 transition-opacity"
                />
              )}
            </div>

            {!showList && (
              <div
                className="border-r border-border-default bg-surface-base flex flex-col items-center py-2 w-8 cursor-pointer hover:bg-surface-raised flex-shrink-0"
                onClick={() => setShowList(true)}
              >
                <ActivityIcon className="w-4 h-4 text-text-disabled mb-2" />
                <div className="writing-vertical-lr text-xs text-text-disabled font-medium tracking-wide uppercase py-4">
                  Activities
                </div>
                <ChevronRight className="w-4 h-4 text-text-disabled mt-auto" />
              </div>
            )}

            {/* Pane 3: Grid */}
            <div className="flex-1 overflow-hidden flex flex-col bg-surface-card min-w-0">
              {!selectedActivityId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-text-disabled m-4 border border-dashed border-border-default rounded-lg">
                  <CheckCircle className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">
                    Select an Activity to view BOQ Items
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col h-full">
                  <div className="px-4 py-2 border-b border-border-default bg-primary-muted flex justify-between items-center shadow-inner flex-shrink-0">
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">
                        {
                          activities.find((a) => a.id === selectedActivityId)
                            ?.activityName
                        }
                      </h3>
                      <div className="text-xs text-primary flex gap-2">
                        <span>
                          Code:{" "}
                          {
                            activities.find((a) => a.id === selectedActivityId)
                              ?.activityCode
                          }
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-text-muted text-right">
                      Planned:{" "}
                      {
                        activities.find((a) => a.id === selectedActivityId)
                          ?.startDatePlanned
                      }{" "}
                      <br />
                      Finish:{" "}
                      {
                        activities.find((a) => a.id === selectedActivityId)
                          ?.finishDatePlanned
                      }
                    </div>
                  </div>

                  {activeTab === "entry" ? (
                    <div className="flex-1 overflow-auto bg-surface-base h-[calc(100vh-something)]">
                      <VendorProgressPane
                        activity={activities.find(
                          (a) => a.id === selectedActivityId,
                        )}
                        epsNodeId={selectedEpsIds[0]}
                        projectId={Number(projectId)}
                        onProgressSaved={() => {
                          if (selectedEpsIds.length > 0)
                            fetchActivities(selectedEpsIds);
                        }}
                      />
                    </div>
                  ) : (
                    <ActivityLaborAllocation
                      activityId={selectedActivityId}
                      date={date}
                      categories={laborCategories}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressEntry;
