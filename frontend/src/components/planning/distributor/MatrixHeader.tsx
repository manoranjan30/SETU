import React from "react";
import { ChevronRight, ChevronDown, CheckSquare } from "lucide-react";

interface MatrixHeaderProps {
  node: any; // EpsNode structure
  depth: number;
  onToggle: (type: "expand" | "collapse", nodeId: number) => void;
  onSelect: (nodeId: number) => void;
  expandedNodes: number[];
  isLocked?: boolean;
  stopType?: string;
}

export const MatrixHeader: React.FC<MatrixHeaderProps> = ({
  node,
  onToggle,
  onSelect,
  expandedNodes,
  isLocked,
  stopType,
}) => {
  // If Locked (Max Depth Reached), force collapsed behavior
  const isExpanded = !isLocked && expandedNodes.includes(node.id);
  const hasChildren = node.children && node.children.length > 0;

  // Calculate colSpan recursively based on VISIBLE leaves
  const getVisibleLeafCount = (n: any): number => {
    // Check if the current node in recursion should be stopped by restrictToFloor
    const isStopNode =
      stopType && n.type && n.type.toUpperCase() === stopType.toUpperCase();
    if (isStopNode) return 1;

    // Check parent override just in case
    if (n.id === node.id && isLocked) return 1;

    if (
      !expandedNodes.includes(n.id) ||
      !n.children ||
      n.children.length === 0
    ) {
      return 1;
    }
    return n.children.reduce(
      (sum: number, child: any) => sum + getVisibleLeafCount(child),
      0,
    );
  };

  const colSpan = getVisibleLeafCount(node);

  return (
    <th
      colSpan={colSpan}
      className="border-r border-b border-border-default bg-surface-base text-center p-2 align-top transition-colors hover:bg-surface-raised group relative"
      style={{
        minWidth: "100px",
        height: "40px",
      }}
    >
      <div className="flex flex-col items-center justify-center h-full w-full">
        <div className="flex items-center gap-1">
          {hasChildren && !isLocked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(isExpanded ? "collapse" : "expand", node.id);
              }}
              className="p-0.5 rounded hover:bg-gray-300 text-text-muted hover:text-gray-800"
            >
              {isExpanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
            </button>
          )}
          <span
            className="text-xs font-semibold text-text-secondary truncate max-w-[120px] cursor-pointer hover:text-primary"
            title={`Distribute to all in ${node.name}`}
            onClick={() => onSelect(node.id)}
          >
            {node.name}
          </span>
        </div>
        {node.type && (
          <div className="text-[10px] text-text-disabled capitalize -mt-0.5">
            {node.type.toLowerCase()}
          </div>
        )}
      </div>

      {/* Quick Link Action Indicator (On Hover) */}
      <button
        onClick={() => onSelect(node.id)}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-primary transition-opacity"
        title="Select Column"
      >
        <CheckSquare size={12} />
      </button>
    </th>
  );
};

// Helper to flatten tree into rows for header rendering
// Helper to flatten tree into rows for header rendering
export const flattenHeaderTree = (
  nodes: any[],
  expandedNodes: number[],
  stopType?: string,
) => {
  const rows: any[][] = [];
  let currentLevel = nodes;

  while (currentLevel.length > 0) {
    rows.push(currentLevel);
    const nextLevel: any[] = [];

    currentLevel.forEach((node) => {
      // Check if we should stop expansion at this node based on Type
      const isStopNode =
        stopType &&
        node.type &&
        node.type.toUpperCase() === stopType.toUpperCase();

      if (
        !isStopNode &&
        expandedNodes.includes(node.id) &&
        node.children &&
        node.children.length > 0
      ) {
        nextLevel.push(...node.children);
      }
    });

    currentLevel = nextLevel;
  }

  return rows;
};
