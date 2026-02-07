import React from 'react';
import { ChevronRight, ChevronDown, CheckSquare } from 'lucide-react';

interface MatrixHeaderProps {
    node: any; // EpsNode structure
    depth: number;
    onToggle: (type: 'expand' | 'collapse', nodeId: number) => void;
    onSelect: (nodeId: number) => void;
    expandedNodes: number[];
    isLocked?: boolean;
}

export const MatrixHeader: React.FC<MatrixHeaderProps> = ({ node, onToggle, onSelect, expandedNodes, isLocked }) => {
    // If Locked (Max Depth Reached), force collapsed behavior
    const isExpanded = !isLocked && expandedNodes.includes(node.id);
    const hasChildren = node.children && node.children.length > 0;

    // Calculate colSpan recursively based on VISIBLE leaves
    const getVisibleLeafCount = (n: any): number => {
        // Critical: If the current node is "Locked" (at max depth) effectively, we shouldn't recurse?
        // But this function is recursive on children.
        // We rely on the fact that if THIS node is locked, we treat it as leaf (colSpan 1).
        // If THIS node is NOT locked, but expanded, we sum children.

        // However, this helper function is used recursively. 
        // We need to know if the CHILD is locked? 
        // NO, simpler: The locking is controlled by the PARENT view logic.
        // If we are passing `expandedNodes`, and we want to respect restrictions,
        // we should conceptually treat the passed `expandedNodes` as sanitized OR
        // handle it here.

        // Since we force `isExpanded` false above if `isLocked`, let's just use that.
        // The issue is `n.children` recursion doesn't know about `isLocked` of children.

        // FIX: rely on the `isExpanded` derived state for the ROOT node of this component.
        // For children, we assume standard behavior unless we pass depth down.
        // BUT: Since `flattenHeaderTree` stops generating rows, this component is only rendered for valid visible headers.
        // The only tricky part is `colSpan`.

        // If we are at the limit, `colSpan` MUST be 1.
        if (isLocked) return 1;

        if (!expandedNodes.includes(n.id) || !n.children || n.children.length === 0) {
            return 1;
        }
        return n.children.reduce((sum: number, child: any) => sum + getVisibleLeafCount(child), 0);
    };

    const colSpan = getVisibleLeafCount(node);

    return (
        <th
            colSpan={colSpan}
            className="border-r border-b border-gray-200 bg-gray-50 text-center p-2 align-top transition-colors hover:bg-gray-100 group relative"
            style={{
                minWidth: '100px',
                height: '40px'
            }}
        >
            <div className="flex flex-col items-center justify-center h-full w-full">
                <div className="flex items-center gap-1">
                    {hasChildren && !isLocked && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(isExpanded ? 'collapse' : 'expand', node.id);
                            }}
                            className="p-0.5 rounded hover:bg-gray-300 text-gray-500 hover:text-gray-800"
                        >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                    )}
                    <span
                        className="text-xs font-semibold text-gray-700 truncate max-w-[120px] cursor-pointer hover:text-blue-600"
                        title={`Distribute to all in ${node.name}`}
                        onClick={() => onSelect(node.id)}
                    >
                        {node.name}
                    </span>
                </div>
                {node.type && <div className="text-[10px] text-gray-400 capitalize -mt-0.5">{node.type.toLowerCase()}</div>}
            </div>

            {/* Quick Link Action Indicator (On Hover) */}
            <button
                onClick={() => onSelect(node.id)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-600 transition-opacity"
                title="Select Column"
            >
                <CheckSquare size={12} />
            </button>
        </th>
    );
};

// Helper to flatten tree into rows for header rendering
// Helper to flatten tree into rows for header rendering
export const flattenHeaderTree = (nodes: any[], expandedNodes: number[], stopType?: string) => {
    const rows: any[][] = [];
    let currentLevel = nodes;

    while (currentLevel.length > 0) {
        rows.push(currentLevel);
        const nextLevel: any[] = [];

        currentLevel.forEach(node => {
            // Check if we should stop expansion at this node based on Type
            const isStopNode = stopType && node.type && node.type.toUpperCase() === stopType.toUpperCase();

            if (!isStopNode && expandedNodes.includes(node.id) && node.children && node.children.length > 0) {
                nextLevel.push(...node.children);
            }
        });

        currentLevel = nextLevel;
    }

    return rows;
};
