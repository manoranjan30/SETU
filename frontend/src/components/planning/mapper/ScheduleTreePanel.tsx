import React, { useState, useEffect, useMemo } from "react";
import api from "../../../api/axios";
import { Tree } from "../../common/Tree";
import type { TreeNodeData } from "../../common/Tree";
import { Calendar, Folder } from "lucide-react";

interface Props {
  activities: any[];
  onSelectActivity: (id: number | null) => void;
  selectedActivityId: number | null;
  projectId: number; // Add projectId needed for fetching WBS
}

const ScheduleTreePanel: React.FC<Props> = ({
  activities,
  onSelectActivity,
  selectedActivityId,
  projectId,
}) => {
  const [wbsNodes, setWbsNodes] = useState<any[]>([]);

  useEffect(() => {
    if (projectId) {
      fetchWbsNodes();
    }
  }, [projectId]);

  const fetchWbsNodes = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/wbs`);
      setWbsNodes(res.data);
    } catch (e) {
      console.error("Failed to fetch WBS Nodes", e);
    }
  };

  const treeData = useMemo(() => {
    if (wbsNodes.length === 0 && activities.length === 0) return [];

    // 1. Build WBS Tree first
    const wbsMap = new Map<number, TreeNodeData>();
    const roots: TreeNodeData[] = [];

    // Create WBS Nodes
    wbsNodes.forEach((node) => {
      const treeNode: TreeNodeData = {
        id: `WBS-${node.id}`,
        label: `${node.wbsCode} ${node.wbsName}`,
        children: [],
        data: node,
        icon: <Folder size={14} className="text-yellow-500 fill-yellow-100" />,
      };
      wbsMap.set(node.id, treeNode);
    });

    // Link WBS Nodes (WBS Hierarchy)
    wbsNodes.forEach((node) => {
      const treeNode = wbsMap.get(node.id)!;
      if (node.parentId) {
        const parent = wbsMap.get(node.parentId);
        if (parent) {
          parent.children?.push(treeNode);
        } else {
          roots.push(treeNode); // Parent missing/orphan
        }
      } else {
        roots.push(treeNode);
      }
    });

    // 2. Attach Activities to WBS Nodes
    activities.forEach((act) => {
      const activityNode: TreeNodeData = {
        id: act.id, // Keep numeric ID for selection
        label: `${act.activityCode} ${act.activityName}`,
        icon: <Calendar size={14} className="text-primary" />,
        data: act,
      };

      // Assuming Activity has `wbsNodeId` or `wbsNode: { id }`
      // Based on entity, it has wbsNode object.
      // But API response might be flat?
      // Let's check wbsNode property.
      const wbsId = act.wbsNode?.id || act.wbsNodeId;

      if (wbsId) {
        const wbsNode = wbsMap.get(wbsId);
        if (wbsNode) {
          wbsNode.children?.push(activityNode);
        } else {
          // WBS Parent not found? Push to root or ignore?
          // Let's push to a "Uncategorized" root or just root list
          roots.push(activityNode);
        }
      } else {
        roots.push(activityNode);
      }
    });

    return roots;
  }, [wbsNodes, activities]);

  return (
    <div className="flex flex-col h-full bg-surface-card">
      <div className="p-2 border-b text-xs font-bold text-text-muted uppercase">
        Schedule Activity Tree
      </div>
      <div className="flex-1 overflow-auto p-2">
        <Tree
          data={treeData}
          selectedIds={selectedActivityId ? [selectedActivityId] : []}
          onSelect={(ids) => {
            // Filter out WBS IDs (strings starting with WBS-)
            const actIds = ids.filter((id) => typeof id === "number");
            if (actIds.length > 0) {
              onSelectActivity(Number(actIds[actIds.length - 1]));
            } else {
              onSelectActivity(null);
            }
          }}
        />
      </div>
    </div>
  );
};

export default ScheduleTreePanel;
