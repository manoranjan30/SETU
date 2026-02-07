import React, { useState } from 'react';
import { ChevronRight, ChevronDown, CheckSquare, Square, X } from 'lucide-react';

interface FilterSidebarProps {
    nodes: any[];
    hiddenNodeIds: number[];
    onToggleNode: (nodeId: number, visible: boolean) => void;
    onClose: () => void;
}

export const MatrixFilterSidebar: React.FC<FilterSidebarProps> = ({ nodes, hiddenNodeIds, onToggleNode, onClose }) => {

    // Recursive Tree Item
    const FilterItem = ({ node, level = 0 }: { node: any, level?: number }) => {
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
                    className="flex items-center py-1 hover:bg-gray-100 rounded px-1 cursor-pointer"
                    style={{ paddingLeft: `${level * 12}px` }}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        className={`mr-1 p-0.5 rounded hover:bg-gray-200 text-gray-500 ${!hasChildren ? 'opacity-0 disabled' : ''}`}
                    >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    <button onClick={handleCheck} className="flex items-center gap-2 text-sm text-gray-700 flex-1">
                        {isVisible ? (
                            <CheckSquare size={16} className="text-blue-600" />
                        ) : (
                            <Square size={16} className="text-gray-400" />
                        )}
                        <span className={isVisible ? '' : 'text-gray-400'}>{node.name}</span>
                    </button>
                </div>
                {expanded && hasChildren && (
                    <div className="border-l border-gray-100 ml-3">
                        {node.children.map((child: any) => (
                            <FilterItem key={child.id} node={child} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-64 bg-white border-l border-gray-200 h-full flex flex-col shadow-lg z-30 absolute right-0 top-0 bottom-0">
            <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-semibold text-gray-700 text-sm">Filter Columns</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
                    <X size={16} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                <p className="text-xs text-gray-400 mb-2 px-1">Uncheck items to hide them from the matrix.</p>
                {nodes.map(node => (
                    <FilterItem key={node.id} node={node} />
                ))}
            </div>
        </div>
    );
};
