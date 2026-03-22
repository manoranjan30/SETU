import { useEffect, useMemo, useState } from "react";
import { Calendar, Folder } from "lucide-react";
import Modal from "../common/Modal";
import { Tree, type TreeNodeData } from "../common/Tree";
import api from "../../api/axios";
import type { ScheduleActivityOption } from "../../services/customerMilestone.service";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (activityIds: number[]) => void;
  activities: ScheduleActivityOption[];
  selectedActivityIds: number[];
  projectId: number;
}

export default function MilestoneActivityPickerModal({
  isOpen,
  onClose,
  onConfirm,
  activities,
  selectedActivityIds,
  projectId,
}: Props) {
  const [wbsNodes, setWbsNodes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [draftSelectedIds, setDraftSelectedIds] = useState<number[]>(selectedActivityIds);

  useEffect(() => {
    setDraftSelectedIds(selectedActivityIds);
  }, [selectedActivityIds, isOpen]);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    void (async () => {
      try {
        const res = await api.get(`/projects/${projectId}/wbs`);
        setWbsNodes(res.data || []);
      } catch (error) {
        console.error("Failed to fetch WBS tree for milestone linking", error);
      }
    })();
  }, [isOpen, projectId]);

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((activity) => {
      const haystack = [
        activity.activityCode,
        activity.activityName,
        activity.wbsNode?.wbsCode,
        activity.wbsNode?.wbsName,
        ...(activity.locations || []).map((location) => location.pathLabel),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activities, search]);

  const treeData = useMemo<TreeNodeData[]>(() => {
    const roots: TreeNodeData[] = [];
    const wbsMap = new Map<number, TreeNodeData>();

    for (const node of wbsNodes) {
      wbsMap.set(node.id, {
        id: `WBS-${node.id}`,
        label: `${node.wbsCode} ${node.wbsName}`,
        children: [],
        data: node,
        icon: <Folder size={14} className="fill-warning-muted text-warning" />,
      });
    }

    for (const node of wbsNodes) {
      const treeNode = wbsMap.get(node.id)!;
      if (node.parentId && wbsMap.has(node.parentId)) {
        wbsMap.get(node.parentId)!.children?.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    }

    const generalRoot: TreeNodeData = {
      id: "GENERAL",
      label: "General / Unmapped Activities",
      children: [],
      icon: <Folder size={14} className="fill-warning-muted text-warning" />,
    };

    for (const activity of filteredActivities) {
      const activityNode: TreeNodeData = {
        id: activity.id,
        label: `${activity.activityCode} ${activity.activityName}`,
        data: activity,
        icon: <Calendar size={14} className="text-primary" />,
      };

      const wbsId = activity.wbsNode?.id ?? activity.wbsNodeId;
      if (wbsId && wbsMap.has(wbsId)) {
        wbsMap.get(wbsId)!.children?.push(activityNode);
      } else {
        generalRoot.children?.push(activityNode);
      }
    }

    if ((generalRoot.children || []).length > 0) {
      roots.push(generalRoot);
    }

    return roots;
  }, [filteredActivities, wbsNodes]);

  const selectedCount = draftSelectedIds.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link Working Schedule Activities"
      size="fullscreen"
      contentClassName="p-0"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-border-default px-6 py-4">
          <p className="text-sm text-text-muted">
            Browse the full working schedule in tree view and select the activities that should trigger this milestone.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search WBS, activity code, activity name, block, tower, or floor"
              className="w-full rounded-lg border border-border-default px-3 py-2 text-sm"
            />
            <div className="min-w-[160px] rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-muted">
              {selectedCount} selected
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto px-6 py-4">
            <Tree
              data={treeData}
              selectedIds={draftSelectedIds}
              cascadeSelection={false}
              onSelect={(ids) =>
                setDraftSelectedIds(
                  ids.filter((id): id is number => typeof id === "number"),
                )
              }
              renderLabel={(node) => {
                if (typeof node.id !== "number") return node.label;
                const activity = node.data as ScheduleActivityOption;
                return (
                  <div className="min-w-0">
                    <div className="truncate font-medium text-text-primary">{node.label}</div>
                    <div className="truncate text-xs text-text-muted">
                      Planned: {activity.plannedFinish || "Not in working schedule"} • Actual: {activity.actualFinish || "Not completed"}
                    </div>
                    {activity.locations?.length ? (
                      <div className="truncate text-xs text-text-muted">
                        {activity.locations.map((location) => location.pathLabel).join(", ")}
                      </div>
                    ) : null}
                  </div>
                );
              }}
              getItemClassName={(node) =>
                typeof node.id === "number" ? "" : "bg-surface-base/80 font-semibold"
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(draftSelectedIds)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Link Selected Activities
          </button>
        </div>
      </div>
    </Modal>
  );
}
