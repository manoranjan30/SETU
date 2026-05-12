import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import api from "../../../api/axios";
import {
  Split,
  Link as LinkIcon,
  Download,
  FileUp,
  Loader,
  Sparkles,
  MapPin,
  GripVertical,
  Rows3,
  Target,
} from "lucide-react";
import BoqGridPanel from "./BoqGridPanel";
import ActivityPickerModal from "./ActivityPickerModal";
import WoBulkMappingImportWizard from "./WoBulkMappingImportWizard";
import {
  downloadBlob,
  withFileExtension,
} from "../../../utils/file-download.utils";

const normalizeMapperText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

const ExecutionMapper: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedWoItemIds, setSelectedWoItemIds] = useState<number[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [wbsNodes, setWbsNodes] = useState<any[]>([]);
  const [vendorTree, setVendorTree] = useState<any[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [downloadingSheet, setDownloadingSheet] = useState(false);
  const [assistantMode, setAssistantMode] = useState<
    "suggestions" | "workbench"
  >("suggestions");
  const [activeWorkbenchItemId, setActiveWorkbenchItemId] = useState<
    number | null
  >(null);

  const selectedWoItems = useMemo(() => {
    const rows: Array<{
      workOrderItemId: number;
      description: string;
      materialCode?: string;
      linkedActivities?: string;
      treeContext?: string;
    }> = [];

    for (const vendor of vendorTree || []) {
      for (const wo of vendor.workOrders || []) {
        for (const boq of wo.boqItems || []) {
          for (const direct of boq.directWoItems || []) {
            if (selectedWoItemIds.includes(direct.workOrderItemId)) {
              rows.push({
                workOrderItemId: direct.workOrderItemId,
                description: direct.description,
                materialCode: boq.boqCode,
                linkedActivities: direct.linkedActivities,
                treeContext: [vendor.vendorName, wo.woNumber, boq.description]
                  .filter(Boolean)
                  .join(" > "),
              });
            }
          }
          for (const sub of boq.subItems || []) {
            if (
              sub.woItem?.workOrderItemId &&
              selectedWoItemIds.includes(sub.woItem.workOrderItemId)
            ) {
              rows.push({
                workOrderItemId: sub.woItem.workOrderItemId,
                description: sub.woItem.description || sub.description,
                materialCode: boq.boqCode,
                linkedActivities: sub.woItem.linkedActivities,
                treeContext: [
                  vendor.vendorName,
                  wo.woNumber,
                  boq.description,
                  sub.description,
                ]
                  .filter(Boolean)
                  .join(" > "),
              });
            }
            for (const measurement of sub.measurements || []) {
              if (selectedWoItemIds.includes(measurement.workOrderItemId)) {
                rows.push({
                  workOrderItemId: measurement.workOrderItemId,
                  description: measurement.description,
                  materialCode: boq.boqCode,
                  linkedActivities: measurement.linkedActivities,
                  treeContext: [
                    vendor.vendorName,
                    wo.woNumber,
                    boq.description,
                    sub.description,
                    measurement.description,
                  ]
                    .filter(Boolean)
                    .join(" > "),
                });
              }
            }
          }
        }
      }
    }

    return rows;
  }, [vendorTree, selectedWoItemIds]);

  const wbsPathById = useMemo(() => {
    const nodeMap = new Map<number, any>();
    wbsNodes.forEach((node) => nodeMap.set(node.id, node));
    const cache = new Map<number, string>();

    const buildPath = (id?: number) => {
      if (!id) return "";
      if (cache.has(id)) return cache.get(id)!;

      const parts: string[] = [];
      let current = nodeMap.get(id);
      while (current) {
        parts.unshift(
          [current.wbsCode, current.wbsName].filter(Boolean).join(" ").trim(),
        );
        current = current.parentId ? nodeMap.get(current.parentId) : null;
      }
      const path = parts.join(" > ");
      cache.set(id, path);
      return path;
    };

    return { get: buildPath };
  }, [wbsNodes]);

  const quickSuggestions = useMemo(() => {
    const sourceTokens = Array.from(
      new Set(
        selectedWoItems.flatMap((item) =>
          normalizeMapperText(
            `${item.materialCode || ""} ${item.description || ""} ${item.linkedActivities || ""} ${item.treeContext || ""}`,
          ),
        ),
      ),
    );

    if (sourceTokens.length === 0) return [];

    return activities
      .map((activity) => {
        const treePath = wbsPathById.get(activity.wbsNode?.id || activity.wbsNodeId);
        const searchable = normalizeMapperText(
          `${activity.activityCode || ""} ${activity.activityName || ""} ${treePath}`,
        );
        const score = sourceTokens.reduce(
          (sum, token) => sum + (searchable.includes(token) ? 1 : 0),
          0,
        );
        return { activity, score, treePath };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);
  }, [activities, selectedWoItems, wbsPathById]);

  const suggestionsByItem = useMemo(() => {
    const result = new Map<
      number,
      Array<{ activity: any; score: number; treePath: string }>
    >();

    selectedWoItems.forEach((item) => {
      const sourceTokens = Array.from(
        new Set(
          normalizeMapperText(
            `${item.materialCode || ""} ${item.description || ""} ${item.linkedActivities || ""} ${item.treeContext || ""}`,
          ),
        ),
      );

      const suggestions = activities
        .map((activity) => {
          const treePath = wbsPathById.get(
            activity.wbsNode?.id || activity.wbsNodeId,
          );
          const searchable = normalizeMapperText(
            `${activity.activityCode || ""} ${activity.activityName || ""} ${treePath}`,
          );
          const score = sourceTokens.reduce(
            (sum, token) => sum + (searchable.includes(token) ? 1 : 0),
            0,
          );
          return { activity, score, treePath };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);

      result.set(item.workOrderItemId, suggestions);
    });

    return result;
  }, [activities, selectedWoItems, wbsPathById]);

  const activeWorkbenchItem = useMemo(() => {
    if (selectedWoItems.length === 0) return null;
    return (
      selectedWoItems.find((item) => item.workOrderItemId === activeWorkbenchItemId) ||
      selectedWoItems[0]
    );
  }, [activeWorkbenchItemId, selectedWoItems]);

  const activeWorkbenchSuggestions = useMemo(() => {
    if (!activeWorkbenchItem) return [];
    return suggestionsByItem.get(activeWorkbenchItem.workOrderItemId) || [];
  }, [activeWorkbenchItem, suggestionsByItem]);

  useEffect(() => {
    if (!selectedWoItems.length) {
      setActiveWorkbenchItemId(null);
      return;
    }
    setActiveWorkbenchItemId((current) =>
      current &&
      selectedWoItems.some((item) => item.workOrderItemId === current)
        ? current
        : selectedWoItems[0].workOrderItemId,
    );
  }, [selectedWoItems]);

  useEffect(() => {
    if (projectId) {
      fetchActivities();
      fetchVendorTree();
      fetchWbsNodes();
    }
  }, [projectId, refreshTrigger]);

  const fetchVendorTree = async () => {
    try {
      const res = await api.get(`/workdoc/mapper/wo-items/${projectId}`);
      setVendorTree(res.data);
    } catch (error) {
      console.error("Failed to fetch WO items tree", error);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/wbs/activities`);
      setActivities(res.data);
    } catch (error) {
      console.error("Failed to fetch activities", error);
    }
  };

  const fetchWbsNodes = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/wbs`);
      setWbsNodes(res.data || []);
    } catch (error) {
      console.error("Failed to fetch WBS nodes", error);
    }
  };

  const handleLinkItems = async (
    workOrderItemIds: number[],
    targetActivityId: number,
  ) => {
    if (workOrderItemIds.length === 0 || !targetActivityId) return;

    try {
      for (const woItemId of workOrderItemIds) {
        await api.post(`/planning/distribute-wo`, {
          projectId: parseInt(projectId as string, 10),
          activityId: targetActivityId,
          workOrderItemId: woItemId,
          quantity: -1,
        });
      }

      setIsLinkModalOpen(false);
      setSelectedWoItemIds((current) =>
        current.filter((id) => !workOrderItemIds.includes(id)),
      );
      setRefreshTrigger((prev) => prev + 1);
      alert("Successfully linked to schedule!");
    } catch (error) {
      console.error("Linking failed", error);
      alert("Linking failed. See console for details.");
    }
  };

  const handleLink = async (targetActivityId: number) => {
    await handleLinkItems(selectedWoItemIds, targetActivityId);
  };

  const handleUnlink = async () => {
    if (selectedWoItemIds.length === 0) return;
    if (!confirm("Are you sure you want to unlink the selected items?")) return;

    try {
      for (const woItemId of selectedWoItemIds) {
        await api.post(`/planning/unlink-wo`, {
          projectId: parseInt(projectId as string, 10),
          workOrderItemId: woItemId,
        });
      }
      setSelectedWoItemIds([]);
      setRefreshTrigger((prev) => prev + 1);
      alert("Successfully unlinked!");
    } catch (error) {
      console.error("Unlink failed", error);
      alert("Unlink failed.");
    }
  };

  const handleDownloadMatrixSheet = async () => {
    if (!projectId) return;
    setDownloadingSheet(true);
    try {
      const response = await api.get(`/planning/${projectId}/wo-mapper/export`, {
        responseType: "blob",
      });
      downloadBlob(
        new Blob([response.data]),
        withFileExtension(`wo_qty_mapper_${projectId}_matrix`, ".xlsx"),
      );
    } catch (error) {
      console.error("Failed to download WO link sheet", error);
      alert("Failed to download WO link sheet.");
    } finally {
      setDownloadingSheet(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Header / Toolbar */}
      <div className="h-14 bg-surface-card border-b flex items-center justify-between px-4 shadow-sm z-10">
        <div className="flex items-center gap-2 text-text-secondary">
          <Split className="text-primary" size={20} />
          <h1 className="font-bold text-lg">WO Qty Mapper</h1>
          <span className="bg-info-muted text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
            Project #{projectId}
          </span>
          <span className="text-xs text-text-muted">
            Manual linking stays available. Bulk CSV/XLSX mapping is additive.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadMatrixSheet}
            disabled={downloadingSheet}
            className="flex items-center gap-2 px-3 py-2 rounded shadow-sm text-sm font-medium transition-colors border bg-surface-card text-text-secondary border-border-strong hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloadingSheet ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Matrix Link Sheet
          </button>

          <button
            type="button"
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded shadow-sm text-sm font-medium transition-colors border bg-info-muted text-blue-700 border-blue-200 hover:bg-blue-100"
          >
            <FileUp size={16} />
            Import Filled Link Sheet
          </button>

          <span className="text-sm text-text-muted mr-2">
            {selectedWoItemIds.length} items selected
          </span>

          <button
            onClick={handleUnlink}
            disabled={selectedWoItemIds.length === 0}
            className={`px-3 py-2 rounded shadow-sm text-sm font-medium transition-colors border
                            ${
                              selectedWoItemIds.length > 0
                                ? "bg-surface-card text-error border-red-200 hover:bg-error-muted"
                                : "bg-surface-raised text-text-disabled border-border-default cursor-not-allowed"
                            }`}
          >
            Unlink
          </button>

          <button
            onClick={() => setIsLinkModalOpen(true)}
            disabled={selectedWoItemIds.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded shadow-sm transition-colors text-sm font-medium
                            ${
                              selectedWoItemIds.length > 0
                                ? "bg-green-600 text-white hover:bg-green-700"
                                : "bg-gray-200 text-text-disabled cursor-not-allowed"
                            }`}
          >
            <LinkIcon size={16} />
            Link to Schedule
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.8fr)_360px] gap-4">
          <div className="bg-surface-card rounded-lg shadow h-full border overflow-hidden">
            <BoqGridPanel
              vendorTree={vendorTree}
              selectedWoItemIds={selectedWoItemIds}
              onSelectionChange={setSelectedWoItemIds}
            />
          </div>
          <div className="flex min-h-0 flex-col rounded-lg border bg-surface-card shadow">
            <div className="border-b bg-surface-base px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
                  Smart Map Assistant
                </h2>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                One-screen helper using WO tree context plus block, tower, floor, and schedule activity hierarchy.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {selectedWoItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-default p-6 text-center text-sm text-text-muted">
                  Select WO measurement rows on the left to get live suggestions here.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border-default bg-surface-base p-3">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                      Current Selection
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1 text-xs">
                      {selectedWoItems.map((item) => (
                        <div key={item.workOrderItemId} className="rounded-lg bg-surface-card px-2 py-2">
                          <div className="font-semibold text-slate-800">
                            {item.description}
                          </div>
                          {item.treeContext && (
                            <div className="mt-1 text-text-muted">
                              {item.treeContext}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border-default bg-surface-base p-3">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                      <Rows3 className="h-3.5 w-3.5" />
                      Mapping Mode
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAssistantMode("suggestions")}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
                          assistantMode === "suggestions"
                            ? "bg-primary-muted text-primary"
                            : "bg-surface-card text-text-secondary hover:bg-surface-raised"
                        }`}
                      >
                        Smart Suggestions
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssistantMode("workbench")}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
                          assistantMode === "workbench"
                            ? "bg-primary-muted text-primary"
                            : "bg-surface-card text-text-secondary hover:bg-surface-raised"
                        }`}
                      >
                        Mapping Workbench
                      </button>
                    </div>
                  </div>

                  {assistantMode === "suggestions" ? (
                    <div className="rounded-xl border border-border-default bg-surface-base p-3">
                      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                        Suggested Activities
                      </div>
                      {quickSuggestions.length === 0 ? (
                        <div className="text-xs text-text-muted">
                          No strong match found yet. Use the full tree validation to map manually.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {quickSuggestions.map(({ activity, score, treePath }) => (
                            <div
                              key={activity.id}
                              className="rounded-xl border border-border-default bg-surface-card p-3"
                            >
                              <div className="font-semibold text-slate-800">
                                {activity.activityCode} {activity.activityName}
                              </div>
                              <div className="mt-1 flex items-start gap-2 text-xs text-text-muted">
                                <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                <span>{treePath}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                  Match score {score}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleLink(activity.id)}
                                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
                                >
                                  Quick Link
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid min-h-[420px] grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 rounded-xl border border-border-default bg-surface-base p-3">
                      <div className="flex min-h-0 flex-col rounded-xl border border-border-default bg-surface-card">
                        <div className="border-b px-3 py-2">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                            <GripVertical className="h-3.5 w-3.5" />
                            Selected WO Items Queue
                          </div>
                          <p className="mt-1 text-xs text-text-muted">
                            Scroll the queue, select an item, or drag it onto a candidate activity card.
                          </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-2">
                          <div className="space-y-2">
                            {selectedWoItems.map((item) => (
                              <button
                                key={item.workOrderItemId}
                                type="button"
                                draggable
                                onDragStart={(event) =>
                                  event.dataTransfer.setData(
                                    "text/plain",
                                    String(item.workOrderItemId),
                                  )
                                }
                                onClick={() =>
                                  setActiveWorkbenchItemId(item.workOrderItemId)
                                }
                                className={`w-full rounded-lg border px-3 py-2 text-left ${
                                  activeWorkbenchItem?.workOrderItemId ===
                                  item.workOrderItemId
                                    ? "border-primary/30 bg-primary-muted"
                                    : "border-border-default bg-surface-base hover:bg-surface-raised"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-disabled" />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-slate-800">
                                      {item.description}
                                    </div>
                                    {item.treeContext && (
                                      <div className="mt-1 text-xs text-text-muted">
                                        {item.treeContext}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex min-h-0 flex-col rounded-xl border border-border-default bg-surface-card">
                        <div className="border-b px-3 py-2">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                            <Target className="h-3.5 w-3.5" />
                            Candidate Activities
                          </div>
                          <p className="mt-1 text-xs text-text-muted">
                            Drop one item onto a card or use one-click map for the active queue item.
                          </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-2">
                          {!activeWorkbenchItem ? (
                            <div className="rounded-lg border border-dashed border-border-default p-4 text-xs text-text-muted">
                              Select a WO item from the queue to inspect its best activity matches.
                            </div>
                          ) : activeWorkbenchSuggestions.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border-default p-4 text-xs text-text-muted">
                              No strong candidates found for this item yet. Use the full tree validation if needed.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {activeWorkbenchSuggestions.map(
                                ({ activity, score, treePath }) => (
                                  <div
                                    key={activity.id}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      const workOrderItemId = Number(
                                        event.dataTransfer.getData("text/plain"),
                                      );
                                      if (workOrderItemId) {
                                        handleLinkItems(
                                          [workOrderItemId],
                                          activity.id,
                                        );
                                      }
                                    }}
                                    className="rounded-xl border border-border-default bg-surface-base p-3"
                                  >
                                    <div className="font-semibold text-slate-800">
                                      {activity.activityCode} {activity.activityName}
                                    </div>
                                    <div className="mt-1 flex items-start gap-2 text-xs text-text-muted">
                                      <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                      <span>{treePath}</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                        Match score {score}
                                      </span>
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                        Drag item here
                                      </span>
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleLinkItems(
                                            [activeWorkbenchItem.workOrderItemId],
                                            activity.id,
                                          )
                                        }
                                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
                                      >
                                        Map This Item
                                      </button>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsLinkModalOpen(true)}
                    disabled={selectedWoItemIds.length === 0}
                    className="w-full rounded-xl border border-border-default px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Open Full Tree Validation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <ActivityPickerModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          onConfirm={handleLink}
          activities={activities}
          projectId={parseInt(projectId!)}
          selectedWoItems={selectedWoItems}
        />
        <WoBulkMappingImportWizard
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          projectId={parseInt(projectId!)}
          onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
        />
      </div>
    </div>
  );
};

export default ExecutionMapper;
