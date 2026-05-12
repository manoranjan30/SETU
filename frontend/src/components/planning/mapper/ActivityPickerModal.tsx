import React from "react";
import { X, Check } from "lucide-react";
import api from "../../../api/axios";
import ScheduleTreePanel from "./ScheduleTreePanel";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (activityId: number) => void;

  // Pass-through props for ScheduleTreePanel
  activities: any[];
  projectId: number;
  selectedWoItems?: Array<{
    workOrderItemId: number;
    description: string;
    materialCode?: string;
    linkedActivities?: string;
    treeContext?: string;
  }>;
}

const ActivityPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  activities,
  projectId,
  selectedWoItems = [],
}) => {
  const [selectedActivityId, setSelectedActivityId] = React.useState<
    number | null
  >(null);
  const [wbsNodes, setWbsNodes] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!isOpen || !projectId) return;
    api
      .get(`/projects/${projectId}/wbs`)
      .then((res) => setWbsNodes(res.data || []))
      .catch((error) => {
        console.error("Failed to fetch WBS nodes for mapper suggestions", error);
        setWbsNodes([]);
      });
  }, [isOpen, projectId]);

  const wbsPathById = React.useMemo(() => {
    const nodeMap = new Map<number, any>();
    wbsNodes.forEach((node) => nodeMap.set(node.id, node));

    const cache = new Map<number, string>();
    const buildPath = (nodeId?: number): string => {
      if (!nodeId) return "";
      if (cache.has(nodeId)) return cache.get(nodeId)!;

      const parts: string[] = [];
      let current = nodeMap.get(nodeId);
      while (current) {
        parts.unshift(
          [current.wbsCode, current.wbsName].filter(Boolean).join(" ").trim(),
        );
        current = current.parentId ? nodeMap.get(current.parentId) : null;
      }
      const path = parts.join(" > ");
      cache.set(nodeId, path);
      return path;
    };

    return {
      get: buildPath,
    };
  }, [wbsNodes]);

  const suggestions = React.useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 2);

    const sourceTokens = Array.from(
      new Set(
        selectedWoItems.flatMap((item) =>
          normalize(
            `${item.materialCode || ""} ${item.description || ""} ${item.linkedActivities || ""} ${item.treeContext || ""}`,
          ),
        ),
      ),
    );

    if (sourceTokens.length === 0) return [];

    return activities
      .map((activity) => {
        const treePath = wbsPathById.get(activity.wbsNode?.id || activity.wbsNodeId);
        const haystack = normalize(
          `${activity.activityCode || ""} ${activity.activityName || ""} ${activity.wbsNode?.wbsCode || ""} ${activity.wbsNode?.wbsName || ""} ${treePath}`,
        );
        const score = sourceTokens.reduce(
          (sum, token) => sum + (haystack.includes(token) ? 1 : 0),
          0,
        );
        return {
          activity,
          score,
          treePath,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
  }, [activities, selectedWoItems, wbsPathById]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-card rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-surface-base rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Select Target Activity
            </h2>
            <p className="text-sm text-text-muted">
              Pick an activity to link the selected BOQ items to.
            </p>
            {selectedWoItems.length > 0 && (
              <p className="mt-1 text-xs text-text-disabled">
                Matching {selectedWoItems.length} selected WO leaf item(s).
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full text-text-muted"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body: Schedule Tree */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-80 min-h-0 border-r bg-surface-base p-4 flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">
              Smart Suggestions
            </h3>
            <p className="mt-1 text-xs text-text-disabled">
              Likely activity matches based on selected WO descriptions, item codes, and already linked terms.
            </p>

            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {selectedWoItems.length > 0 && (
                <div className="rounded-xl border border-border-default bg-surface-card p-3">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                    Selected WO Items
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1 text-xs">
                    {selectedWoItems.map((item) => (
                      <div key={item.workOrderItemId} className="rounded-lg bg-surface-base px-2 py-2">
                        <div className="font-semibold text-slate-800">
                          {item.description}
                        </div>
                        {item.materialCode && (
                          <div className="font-mono text-text-muted">
                            {item.materialCode}
                          </div>
                        )}
                        {item.treeContext && (
                          <div className="mt-1 text-[10px] text-text-disabled">
                            {item.treeContext}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border-default bg-surface-card p-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                  Suggested Activities
                </div>
                {suggestions.length === 0 ? (
                  <div className="text-xs text-text-muted">
                    No strong matches found yet. Use the tree search on the right.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {suggestions.map(({ activity, score, treePath }) => (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => setSelectedActivityId(activity.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          selectedActivityId === activity.id
                            ? "border-primary/30 bg-primary-muted"
                            : "border-border-default hover:bg-surface-base"
                        }`}
                      >
                        <div className="font-semibold text-slate-800">
                          {activity.activityCode} {activity.activityName}
                        </div>
                        <div className="mt-1 text-text-muted">
                          {treePath || `${activity.wbsNode?.wbsCode || ""} ${activity.wbsNode?.wbsName || ""}`}
                        </div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                          Match score {score}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-4">
            <ScheduleTreePanel
              activities={activities}
              projectId={projectId}
              selectedActivityId={selectedActivityId}
              onSelectActivity={setSelectedActivityId}
              suggestedActivityIds={suggestions.map((entry) => entry.activity.id)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-surface-base flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedActivityId && onConfirm(selectedActivityId)}
            disabled={!selectedActivityId}
            className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2
                            ${
                              selectedActivityId
                                ? "bg-primary text-white hover:bg-primary-dark shadow-sm"
                                : "bg-gray-300 text-text-muted cursor-not-allowed"
                            }`}
          >
            <Check size={16} />
            Link Selected Items
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityPickerModal;
