import React from "react";
import { X, Check, Maximize2, Minimize2 } from "lucide-react";
import api from "../../../api/axios";
import ScheduleTreePanel from "./ScheduleTreePanel";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (activityId: number) => void;
  activities: any[];
  projectId: number;
  selectedWoItems?: Array<{
    workOrderItemId: number;
    description: string;
    materialCode?: string;
    linkedActivities?: string;
    treeContext?: string;
    boqPath?: string;
    fullContext?: string;
  }>;
}

const normalizeMapperText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

const splitHierarchySegments = (value: string) =>
  value
    .split(">")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

const extractLocationPhrases = (value: string) => {
  const text = value.toLowerCase();
  const matches = new Set<string>();
  const patterns = [
    /\bblock[\s-]*[a-z0-9]+\b/g,
    /\btower[\s-]*[a-z0-9]+\b/g,
    /\bwing[\s-]*[a-z0-9]+\b/g,
    /\bfloor[\s-]*[a-z0-9]+\b/g,
    /\b\d+(st|nd|rd|th)\s+floor\b/g,
    /\bground floor\b/g,
    /\bgf\b/g,
    /\bff\b/g,
    /\bsf\b/g,
    /\btf\b/g,
    /\bbasement[\s-]*\d*\b/g,
    /\bstilt\b/g,
    /\bpodium\b/g,
  ];

  patterns.forEach((pattern) => {
    const found = text.match(pattern) || [];
    found.forEach((match) => matches.add(match.trim()));
  });

  return Array.from(matches);
};

const buildMapperContext = (parts: Array<string | undefined>) => {
  const fullText = parts.filter(Boolean).join(" > ");
  return {
    tokens: Array.from(new Set(normalizeMapperText(fullText))),
    segments: Array.from(new Set(splitHierarchySegments(fullText))),
    locationPhrases: Array.from(new Set(extractLocationPhrases(fullText))),
  };
};

const scoreMapperContexts = (
  source: ReturnType<typeof buildMapperContext>,
  target: ReturnType<typeof buildMapperContext>,
) => {
  const tokenMatches = source.tokens.filter((token) =>
    target.tokens.includes(token),
  );
  const segmentMatches = source.segments.filter((segment) =>
    target.segments.some(
      (targetSegment) =>
        targetSegment.includes(segment) || segment.includes(targetSegment),
    ),
  );
  const locationMatches = source.locationPhrases.filter((phrase) =>
    target.locationPhrases.some(
      (targetPhrase) =>
        targetPhrase.includes(phrase) || phrase.includes(targetPhrase),
    ),
  );

  let score =
    tokenMatches.length +
    segmentMatches.length * 4 +
    locationMatches.length * 8;

  if (source.locationPhrases.length > 0 && locationMatches.length === 0) {
    score -= 6;
  }

  return {
    score,
    locationMatches,
  };
};

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
  const [isFullscreen, setIsFullscreen] = React.useState(false);

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

    return { get: buildPath };
  }, [wbsNodes]);

  const suggestions = React.useMemo(() => {
    const sourceContext = buildMapperContext(
      selectedWoItems.flatMap((item) => [
        item.materialCode,
        item.description,
        item.linkedActivities,
        item.treeContext,
        item.boqPath,
        item.fullContext,
      ]),
    );

    if (sourceContext.tokens.length === 0) return [];

    return activities
      .map((activity) => {
        const treePath = wbsPathById.get(
          activity.wbsNode?.id || activity.wbsNodeId,
        );
        const targetContext = buildMapperContext([
          activity.activityCode,
          activity.activityName,
          activity.wbsNode?.wbsCode,
          activity.wbsNode?.wbsName,
          treePath,
        ]);
        const scored = scoreMapperContexts(sourceContext, targetContext);
        return {
          activity,
          score: scored.score,
          treePath,
          locationMatches: scored.locationMatches,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
  }, [activities, selectedWoItems, wbsPathById]);

  React.useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      setSelectedActivityId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        className={`bg-surface-card rounded-lg shadow-xl flex flex-col ${
          isFullscreen
            ? "w-[96vw] h-[94vh] max-w-none"
            : "w-full max-w-4xl h-[80vh]"
        }`}
      >
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
                Matching {selectedWoItems.length} selected WO leaf item(s) using
                the full BOQ hierarchy and full schedule tree.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-2 hover:bg-gray-200 rounded-full text-text-muted"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full text-text-muted"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-80 min-h-0 border-r bg-surface-base p-4 flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">
              Smart Suggestions
            </h3>
            <p className="mt-1 text-xs text-text-disabled">
              Suggestions are scored from BOQ path plus activity tree path, with
              extra weight for block, tower, and floor matches.
            </p>

            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {selectedWoItems.length > 0 && (
                <div className="rounded-xl border border-border-default bg-surface-card p-3">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                    Selected WO Items
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1 text-xs">
                    {selectedWoItems.map((item) => (
                      <div
                        key={item.workOrderItemId}
                        className="rounded-lg bg-surface-base px-2 py-2"
                      >
                        <div className="font-semibold text-slate-800">
                          {item.description}
                        </div>
                        {item.boqPath && (
                          <div className="mt-1 text-text-muted">
                            BOQ: {item.boqPath}
                          </div>
                        )}
                        {item.treeContext && (
                          <div className="mt-1 text-[10px] text-text-disabled">
                            WO: {item.treeContext}
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
                    {suggestions.map(
                      ({ activity, score, treePath, locationMatches }) => (
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
                          <div className="mt-1 text-text-muted">{treePath}</div>
                          {locationMatches.length > 0 && (
                            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-green-700">
                              {locationMatches.join(", ")}
                            </div>
                          )}
                          <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                            Match score {score}
                          </div>
                        </button>
                      ),
                    )}
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
            className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${
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
