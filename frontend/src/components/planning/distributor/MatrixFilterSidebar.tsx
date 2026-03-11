import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Square,
  X,
} from "lucide-react";

interface FilterSidebarProps {
  nodes: any[];
  hiddenNodeIds: number[];
  onToggleNode: (nodeId: number, visible: boolean) => void;
  onClose: () => void;
}

export const MatrixFilterSidebar: React.FC<FilterSidebarProps> = ({
  nodes,
  hiddenNodeIds,
  onToggleNode,
  onClose,
}) => {
  // Recursive Tree Item
  const FilterItem = ({ node, level = 0 }: { node: any; level?: number }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isHidden = hiddenNodeIds.includes(node.id);
    const isVisible = !isHidden;

    const handleCheck = () => {
      // If currently visible, we hide it (so visible becomes false)
      onToggleNode(node.id, !isVisible);
    };

    return (
      <div className="select-none">
        <div
          className="flex items-center py-1 hover:bg-surface-raised rounded px-1 cursor-pointer"
          style={{ paddingLeft: `${level * 12}px` }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className={`mr-1 p-0.5 rounded hover:bg-gray-200 text-text-muted ${!hasChildren ? "opacity-0 disabled" : ""}`}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <button
            onClick={handleCheck}
            className="flex items-center gap-2 text-sm text-text-secondary flex-1"
          >
            {isVisible ? (
              <CheckSquare size={16} className="text-primary" />
            ) : (
              <Square size={16} className="text-text-disabled" />
            )}
            <span className={isVisible ? "" : "text-text-disabled"}>
              {node.name}
            </span>
          </button>
        </div>
        {expanded && hasChildren && (
          <div className="border-l border-border-subtle ml-3">
            {node.children.map((child: any) => (
              <FilterItem key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 bg-surface-card border-l border-border-default h-full flex flex-col shadow-lg z-30 absolute right-0 top-0 bottom-0">
      <div className="p-3 border-b border-border-subtle flex justify-between items-center bg-surface-base">
        <h3 className="font-semibold text-text-secondary text-sm">
          Filter Columns
        </h3>
        <button
          onClick={onClose}
          className="text-text-disabled hover:text-text-secondary"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-xs text-text-disabled mb-2 px-1">
          Uncheck items to hide them from the matrix.
        </p>
        {nodes.map((node) => (
          <FilterItem key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
};
