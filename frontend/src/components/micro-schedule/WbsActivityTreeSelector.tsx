import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Search,
  Check,
  Calendar,
} from "lucide-react";
import { type PlanningActivity } from "../../services/planning.service";

interface WbsNode {
  id: number;
  wbsCode: string;
  wbsName: string;
  parentId: number | null;
}

interface TreeNode {
  key: string;
  type: "WBS" | "ACTIVITY";
  id: number;
  code: string;
  name: string;
  data?: any;
  children: TreeNode[];
  parentId: number | null;
  expanded?: boolean;
  date?: string; // For activity
}

interface WbsActivityTreeSelectorProps {
  wbsNodes: WbsNode[];
  activities: PlanningActivity[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  multiSelect?: boolean;
}

const WbsActivityTreeSelector: React.FC<WbsActivityTreeSelectorProps> = ({
  wbsNodes,
  activities,
  selectedIds,
  onSelectionChange,
  multiSelect = true,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // --- 1. Build Full Tree ---
  const fullTree = useMemo(() => {
    const nodeMap = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    // 1. Map WBS Nodes
    wbsNodes.forEach((wbs) => {
      nodeMap.set(wbs.id, {
        key: `wbs-${wbs.id}`,
        type: "WBS",
        id: wbs.id,
        code: wbs.wbsCode,
        name: wbs.wbsName,
        children: [],
        parentId: wbs.parentId,
      });
    });

    // 2. Map Activities to WBS Parents
    activities.forEach((act) => {
      const actNode: TreeNode = {
        key: `act-${act.id}`,
        type: "ACTIVITY",
        id: act.id,
        code: act.activityCode,
        name: act.activityName,
        data: act,
        children: [],
        parentId: act.wbsNodeId,
        date: act.startDatePlanned || "",
      };

      const parent = nodeMap.get(act.wbsNodeId);
      if (parent) {
        parent.children.push(actNode);
      } else {
        // Orphan activity (shouldn't happen ideally)
        roots.push(actNode);
      }
    });

    // 3. Assemble WBS Hierarchy
    wbsNodes.forEach((wbs) => {
      const node = nodeMap.get(wbs.id)!;
      if (wbs.parentId) {
        const parent = nodeMap.get(wbs.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    // Sort children by code
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true }),
      );
      nodes.forEach((n) => {
        if (n.children.length > 0) sortNodes(n.children);
      });
    };
    sortNodes(roots);

    return { roots, nodeMap };
  }, [wbsNodes, activities]);

  // --- 2. Filter Logic ---
  const filteredTree = useMemo(() => {
    if (!searchTerm && !filterStart && !filterEnd) return fullTree.roots;

    const matchesSearch = (node: TreeNode): boolean => {
      const term = searchTerm.toLowerCase();
      return (
        node.name.toLowerCase().includes(term) ||
        node.code.toLowerCase().includes(term)
      );
    };

    const matchesDate = (node: TreeNode): boolean => {
      if (node.type === "WBS") return false; // Only filter activities by date
      if (!node.date) return false;
      // Simple string comparison for YYYY-MM-DD works
      const d = node.date.split("T")[0];
      const start = filterStart ? filterStart : "0000-00-00";
      const end = filterEnd ? filterEnd : "9999-99-99";
      return d >= start && d <= end;
    };

    // Recursive Filter
    // Returns null if node should be hidden
    // Returns node with filtered children if kept
    const filterNode = (node: TreeNode): TreeNode | null => {
      // Check children first
      const filteredChildren: TreeNode[] = [];
      for (const child of node.children) {
        const filteredChild = filterNode(child);
        if (filteredChild) {
          filteredChildren.push(filteredChild);
        }
      }

      // Keep if children kept OR node matches criteria
      let keep = false;
      if (filteredChildren.length > 0) keep = true;

      // If leaf (Activity), check criteria
      if (node.type === "ACTIVITY") {
        const s = !searchTerm || matchesSearch(node);
        const d = (!filterStart && !filterEnd) || matchesDate(node);
        if (s && d) keep = true;
      } else {
        // WBS Node: keep if matches search (even if no children?)
        // User said "root activity its parent... should be visible".
        // If WBS matches search, maybe show it and its children?
        // Let's stick to showing if children match OR if WBS itself matches.
        if (!searchTerm || matchesSearch(node)) keep = true;
      }

      if (keep) {
        return { ...node, children: filteredChildren, expanded: true }; // Auto-expand on filter
      }
      return null;
    };

    const result: TreeNode[] = [];
    for (const root of fullTree.roots) {
      const filtered = filterNode(root);
      if (filtered) result.push(filtered);
    }
    return result;
  }, [fullTree, searchTerm, filterStart, filterEnd]);

  // Apply auto-expansion from filter
  useEffect(() => {
    if (searchTerm || filterStart || filterEnd) {
      // Logic filterNode sets 'expanded' prop, but we use state.
      // We can collect IDs in the filter pass or just let user expand manually?
      // User wants "visible". Auto-expand is best.
      // The filter logic above constructs a NEW tree.
      // But my rendering uses `expandedIds` state.
      // I should update expandedIds based on filtered results?
      // Or rely on the 'expanded' property in the registered object?
      // I'll update the state.
      const ids = new Set<string>();
      const collect = (nodes: TreeNode[]) => {
        nodes.forEach((n) => {
          if (n.children.length > 0) ids.add(n.key);
          collect(n.children);
        });
      };
      collect(filteredTree);
      setExpandedIds(ids);
    }
  }, [filteredTree, searchTerm, filterStart, filterEnd]);

  const toggleExpand = (key: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedIds(newSet);
  };

  const toggleSelection = (id: number) => {
    let newIds: number[];
    if (selectedIds.includes(id)) {
      newIds = selectedIds.filter((i) => i !== id);
    } else {
      if (multiSelect) {
        newIds = [...selectedIds, id];
      } else {
        newIds = [id];
      }
    }
    onSelectionChange(newIds);
  };

  // --- Render ---
  const renderNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedIds.has(node.key);
    const isSelected =
      node.type === "ACTIVITY" && selectedIds.includes(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.key} style={{ marginLeft: level * 0 }}>
        <div className="flex items-center py-1 hover:bg-surface-base rounded text-sm">
          {/* Indent / Expand Icon */}
          <div
            className="w-6 h-6 flex items-center justify-center cursor-pointer text-text-disabled mr-1"
            style={{ marginLeft: level * 16 }}
            onClick={() => hasChildren && toggleExpand(node.key)}
          >
            {hasChildren &&
              (isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              ))}
          </div>

          {/* Checkbox (for Activities) */}
          {node.type === "ACTIVITY" ? (
            <div
              className={`w-4 h-4 mr-2 border rounded flex items-center justify-center cursor-pointer ${isSelected ? "bg-primary border-primary" : "border-border-strong"}`}
              onClick={() => toggleSelection(node.id)}
            >
              {isSelected && <Check size={10} className="text-white" />}
            </div>
          ) : (
            // WBS Icon or Placeholder
            <div className="w-4 h-4 mr-2" />
          )}

          {/* Content */}
          <div
            className={`flex-1 cursor-pointer ${node.type === "WBS" ? "font-semibold text-text-secondary" : "text-text-secondary"}`}
            onClick={() => {
              if (node.type === "ACTIVITY") toggleSelection(node.id);
              else hasChildren && toggleExpand(node.key);
            }}
          >
            <span className="text-text-disabled text-xs mr-2">
              [{node.code}]
            </span>
            {node.name}
            {node.date && (
              <span className="ml-2 text-xs text-text-disabled bg-surface-raised px-1 rounded">
                {node.date.split("T")[0]}
              </span>
            )}
          </div>
        </div>

        {/* Children */}
        {isExpanded &&
          node.children.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="border rounded-md shadow-sm bg-surface-card">
      {/* Toolbar */}
      <div className="p-2 border-b bg-surface-base flex flex-col gap-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-2.5 text-text-disabled"
          />
          <input
            type="text"
            placeholder="Search WBS or Activities..."
            className="w-full pl-8 pr-2 py-1.5 text-sm border rounded bg-surface-card focus:outline-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Calendar size={12} className="text-text-disabled" />
          <span>Filter:</span>
          <input
            type="date"
            className="border rounded px-1 py-0.5 bg-surface-card"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
          />
          <span>to</span>
          <input
            type="date"
            className="border rounded px-1 py-0.5 bg-surface-card"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
          />
          {(filterStart || filterEnd) && (
            <button
              className="text-primary hover:text-blue-800 ml-auto"
              onClick={() => {
                setFilterStart("");
                setFilterEnd("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tree Area */}
      <div className="max-h-[300px] overflow-y-auto p-2">
        {filteredTree.length === 0 ? (
          <div className="text-center py-4 text-text-disabled text-sm">
            No items found matching your filter.
          </div>
        ) : (
          filteredTree.map((root) => renderNode(root))
        )}
      </div>

      {/* Footer Summary */}
      <div className="px-2 py-1 bg-surface-base border-t text-xs text-text-muted text-right">
        {selectedIds.length} activities selected
      </div>
    </div>
  );
};

export default WbsActivityTreeSelector;
