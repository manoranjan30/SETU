import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../../../api/axios";
import {
  Calendar,
  Folder,
  ChevronDown,
  ChevronRight,
  Search,
  EyeOff,
  RotateCcw,
} from "lucide-react";

interface Props {
  activities: any[];
  onSelectActivity: (id: number | null) => void;
  selectedActivityId: number | null;
  projectId: number;
}

interface TreeNode {
  id: string;
  rawId: string | number;
  label: string;
  type: "WBS" | "ACTIVITY";
  activityId?: number;
  children: TreeNode[];
}

const storageKey = (projectId: number) => `wo-mapper-tree:${projectId}`;

const ScheduleTreePanel: React.FC<Props> = ({
  activities,
  onSelectActivity,
  selectedActivityId,
  projectId,
}) => {
  const [wbsNodes, setWbsNodes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showOnlyLeaves, setShowOnlyLeaves] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (projectId) {
      api
        .get(`/projects/${projectId}/wbs`)
        .then((res) => setWbsNodes(res.data))
        .catch((e) => console.error("Failed to fetch WBS Nodes", e));
    }
  }, [projectId]);

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey(projectId));
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        search?: string;
        expanded?: string[];
        hidden?: string[];
        showOnlyLeaves?: boolean;
      };
      setSearch(parsed.search || "");
      setExpanded(new Set(parsed.expanded || []));
      setHidden(new Set(parsed.hidden || []));
      setShowOnlyLeaves(Boolean(parsed.showOnlyLeaves));
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    sessionStorage.setItem(
      storageKey(projectId),
      JSON.stringify({
        search,
        expanded: Array.from(expanded),
        hidden: Array.from(hidden),
        showOnlyLeaves,
      }),
    );
  }, [expanded, hidden, projectId, search, showOnlyLeaves]);

  const treeData = useMemo<TreeNode[]>(() => {
    const wbsMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const node of wbsNodes) {
      wbsMap.set(`WBS-${node.id}`, {
        id: `WBS-${node.id}`,
        rawId: node.id,
        label: `${node.wbsCode} ${node.wbsName}`,
        type: "WBS",
        children: [],
      });
    }

    for (const node of wbsNodes) {
      const treeNode = wbsMap.get(`WBS-${node.id}`);
      if (!treeNode) continue;
      if (node.parentId) {
        const parent = wbsMap.get(`WBS-${node.parentId}`);
        if (parent) parent.children.push(treeNode);
        else roots.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    }

    for (const act of activities) {
      const activityNode: TreeNode = {
        id: `ACT-${act.id}`,
        rawId: act.id,
        label: `${act.activityCode} ${act.activityName}`,
        type: "ACTIVITY",
        activityId: act.id,
        children: [],
      };
      const wbsId = act.wbsNode?.id || act.wbsNodeId;
      if (wbsId && wbsMap.has(`WBS-${wbsId}`)) {
        wbsMap.get(`WBS-${wbsId}`)?.children.push(activityNode);
      } else {
        roots.push(activityNode);
      }
    }

    return roots;
  }, [activities, wbsNodes]);

  const normalizedSearch = search.trim().toLowerCase();

  const filterTree = useCallback(
    (nodes: TreeNode[]): TreeNode[] => {
      const visit = (node: TreeNode): TreeNode | null => {
        if (hidden.has(node.id)) return null;

        const filteredChildren = node.children
          .map(visit)
          .filter(Boolean) as TreeNode[];
        const labelMatch = node.label.toLowerCase().includes(normalizedSearch);
        const leafPass =
          !showOnlyLeaves || node.type === "ACTIVITY" || filteredChildren.length > 0;

        if (!leafPass) return null;

        if (!normalizedSearch) {
          return { ...node, children: filteredChildren };
        }
        if (labelMatch || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      };
      return nodes.map(visit).filter(Boolean) as TreeNode[];
    },
    [hidden, normalizedSearch, showOnlyLeaves],
  );

  const visibleTree = useMemo(() => filterTree(treeData), [filterTree, treeData]);

  useEffect(() => {
    if (!normalizedSearch) return;
    const next = new Set(expanded);
    const expandMatches = (node: TreeNode) => {
      if (
        node.children.some(
          (child) =>
            child.label.toLowerCase().includes(normalizedSearch) ||
            child.children.length > 0,
        )
      ) {
        next.add(node.id);
      }
      node.children.forEach(expandMatches);
    };
    visibleTree.forEach(expandMatches);
    setExpanded(next);
  }, [normalizedSearch, visibleTree]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hideBranch = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const clearHidden = () => setHidden(new Set());
  const collapseAll = () => setExpanded(new Set());

  const renderNode = (node: TreeNode, level = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id) || normalizedSearch.length > 0;
    const isSelected =
      node.type === "ACTIVITY" && selectedActivityId === node.activityId;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-2 rounded-xl border px-2 py-2 text-sm transition-all ${
            isSelected
              ? "border-primary/30 bg-primary-muted text-text-primary"
              : "border-transparent text-text-secondary hover:border-border-default hover:bg-surface-raised"
          }`}
          style={{ paddingLeft: `${level * 14 + 8}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggleExpanded(node.id)}
            className="flex h-4 w-4 items-center justify-center text-text-disabled"
          >
            {hasChildren ? (
              isOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              if (node.type === "ACTIVITY") onSelectActivity(node.activityId || null);
              else toggleExpanded(node.id);
            }}
            className="flex flex-1 items-center gap-2 truncate text-left"
          >
            {node.type === "WBS" ? (
              <Folder size={14} className="text-yellow-600" />
            ) : (
              <Calendar size={14} className="text-primary" />
            )}
            <span className="truncate font-medium">{node.label}</span>
          </button>

          <button
            type="button"
            onClick={() => hideBranch(node.id)}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            title="Hide this branch"
          >
            <EyeOff size={14} className="text-text-disabled hover:text-red-600" />
          </button>
        </div>

        {hasChildren && isOpen && (
          <div className="mt-1 space-y-1">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-surface-card">
      <div className="border-b p-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              placeholder="Search activity or tower without losing parent context..."
              className="w-full rounded-xl border border-border-default bg-surface-base py-2 pl-9 pr-3 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={clearHidden}
            className="rounded-xl border border-border-default px-3 py-2 text-xs font-bold text-text-secondary"
          >
            Clear Hidden
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-xl border border-border-default px-3 py-2 text-xs font-bold text-text-secondary"
          >
            Collapse All
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-2 font-bold text-text-muted">
            <input
              type="checkbox"
              checked={showOnlyLeaves}
              onChange={(e) => setShowOnlyLeaves(e.target.checked)}
            />
            Only leaf activities
          </label>
          <span className="inline-flex items-center gap-1 text-text-disabled">
            <RotateCcw size={12} /> Hidden branches and focus state are remembered for this session.
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-1">
          {visibleTree.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-default p-6 text-center text-sm text-text-muted">
              No schedule nodes match the current search or hide filters.
            </div>
          ) : (
            visibleTree.map((node) => renderNode(node))
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleTreePanel;
