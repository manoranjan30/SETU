import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  CheckCircle,
  Circle,
} from "lucide-react";

export interface TreeNodeData {
  id: string | number;
  label: string;
  children?: TreeNodeData[];
  data?: any; // Original data
  icon?: React.ReactNode;
}

interface TreeProps {
  data: TreeNodeData[];
  selectedIds: (string | number)[];
  onSelect: (ids: (string | number)[]) => void;
  multiSelect?: boolean;
  cascadeSelection?: boolean;
  renderLabel?: (node: TreeNodeData) => React.ReactNode;
  getItemClassName?: (node: TreeNodeData) => string;
}

const TreeNode: React.FC<{
  node: TreeNodeData;
  level: number;
  selectedIds: (string | number)[];
  onToggle: (id: string | number, allChildren: (string | number)[]) => void;
  renderLabel?: (node: TreeNodeData) => React.ReactNode;
  getItemClassName?: (node: TreeNodeData) => string;
}> = ({
  node,
  level,
  selectedIds,
  onToggle,
  renderLabel,
  getItemClassName,
}) => {
  const [isOpen, setIsOpen] = useState(true); // Default open
  const hasChildren = node.children && node.children.length > 0;

  const getAllChildIds = (n: TreeNodeData): (string | number)[] => {
    let ids: (string | number)[] = [n.id];
    if (n.children) {
      n.children.forEach((child) => {
        ids = [...ids, ...getAllChildIds(child)];
      });
    }
    return ids;
  };

  const isSelected = selectedIds.includes(node.id);

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allIds = getAllChildIds(node);
    onToggle(node.id, allIds);
  };

  const customClass = getItemClassName ? getItemClassName(node) : "";

  return (
    <div style={{ paddingLeft: `${level * 12}px` }}>
      <div
        className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? "bg-primary-muted border-primary/30 shadow-sm text-text-primary" : "border-transparent hover:bg-surface-raised hover:border-border-default text-text-secondary"} ${customClass}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Expand Toggle */}
        <div className="w-4 h-4 flex items-center justify-center text-text-disabled">
          {hasChildren &&
            (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </div>

        {/* Checkbox / Selection */}
        <div
          onClick={handleCheck}
          className={`cursor-pointer ${isSelected ? "text-primary" : "text-text-disabled"}`}
        >
          {isSelected ? <CheckCircle size={16} /> : <Circle size={16} />}
        </div>

        {/* Icon */}
        <div className="text-text-muted">
          {node.icon ||
            (hasChildren ? (
              <Folder
                size={16}
                className="fill-warning-muted text-warning"
              />
            ) : (
              <File size={16} />
            ))}
        </div>

        {/* Label */}
        <div className="flex-1 text-sm font-medium select-none truncate">
          {renderLabel ? renderLabel(node) : node.label}
        </div>
      </div>

      {hasChildren && isOpen && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
              renderLabel={renderLabel}
              getItemClassName={getItemClassName}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Tree: React.FC<TreeProps> = ({
  data,
  selectedIds,
  onSelect,
  renderLabel,
  getItemClassName,
  cascadeSelection = true,
}) => {
  const handleToggle = (
    id: string | number,
    allChildren: (string | number)[],
  ) => {
    const isSelected = selectedIds.includes(id);

    if (cascadeSelection) {
      // Standard Cascade Behavior
      if (isSelected) {
        const toRemove = new Set(allChildren);
        onSelect(selectedIds.filter((i) => !toRemove.has(i)));
      } else {
        const toAdd = allChildren.filter(
          (childId) => !selectedIds.includes(childId),
        );
        onSelect([...selectedIds, ...toAdd]);
      }
    } else {
      // Single Node Toggle (No Cascade)
      // If multiSelect is false (implied by usage, though not explicitly enforced here for single-node mode usually),
      // usually we just replace selection. But to keep it generic:
      if (isSelected) {
        onSelect(selectedIds.filter((i) => i !== id));
      } else {
        // If we want single select behavior strictly, we might clear others.
        // But let's just toggle this one for now, ProgressEntry handles the "last one wins".
        // actually ProgressEntry expects [id], so let's make it add/remove.
        onSelect([...selectedIds, id]);
      }
    }
  };

  return (
    <div className="select-none space-y-1">
      {data.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          renderLabel={renderLabel}
          getItemClassName={getItemClassName}
        />
      ))}
    </div>
  );
};
