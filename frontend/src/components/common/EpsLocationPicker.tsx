import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, MapPin, Building2, Layers } from 'lucide-react';
import api from '../../api/axios';

interface EpsNode {
    id: number;
    name: string;
    type: string;
    children?: EpsNode[];
}

interface EpsLocationPickerProps {
    projectId: number;
    value: number | null;
    onChange: (nodeId: number, nodeLabel: string) => void;
    placeholder?: string;
}

const EpsLocationPicker: React.FC<EpsLocationPickerProps> = ({ projectId, value, onChange, placeholder = 'Select Location...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [treeData, setTreeData] = useState<EpsNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
    const [selectedLabel, setSelectedLabel] = useState<string>('');

    useEffect(() => {
        if (isOpen && treeData.length === 0) {
            fetchTree();
        }
    }, [isOpen, projectId]);

    const fetchTree = async () => {
        setLoading(true);
        try {
            const resp = await api.get(`/eps/${projectId}`);
            if (resp.data.children) {
                setTreeData(resp.data.children);
                // Expand first level by default
                const newExpanded = new Set<number>();
                resp.data.children.forEach((n: EpsNode) => newExpanded.add(n.id));
                setExpandedNodes(newExpanded);
            }
        } catch (error) {
            console.error('Failed to fetch EPS tree:', error);
        } finally {
            setLoading(false);
        }
    };

    // Recursively find the path to set the initial label
    useEffect(() => {
        if (value && treeData.length > 0 && !selectedLabel) {
            const path = findPath(treeData, value);
            if (path.length > 0) {
                setSelectedLabel(path.map(n => n.name).join(' → '));
            }
        }
    }, [value, treeData]);

    const findPath = (nodes: EpsNode[], targetId: number, currentPath: EpsNode[] = []): EpsNode[] => {
        for (const node of nodes) {
            const newPath = [...currentPath, node];
            if (node.id === targetId) return newPath;
            if (node.children) {
                const found = findPath(node.children, targetId, newPath);
                if (found.length > 0) return found;
            }
        }
        return [];
    };

    const toggleNode = (e: React.MouseEvent, nodeId: number) => {
        e.stopPropagation();
        const next = new Set(expandedNodes);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        setExpandedNodes(next);
    };

    const handleSelect = (node: EpsNode, parents: EpsNode[]) => {
        const fullPath = [...parents, node].map(n => n.name).join(' → ');
        setSelectedLabel(fullPath);
        onChange(node.id, fullPath);
        setIsOpen(false);
    };

    const renderNode = (node: EpsNode, parents: EpsNode[] = []) => {
        const isLeaf = !node.children || node.children.length === 0;
        const isExpanded = expandedNodes.has(node.id);
        const isSelected = value === node.id;

        // Simple search filter
        if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase()) && isLeaf) {
            return null;
        }

        return (
            <div key={node.id} className="ml-4">
                <div
                    className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-orange-50 text-orange-700 font-bold' : 'hover:bg-gray-50'}`}
                    onClick={() => handleSelect(node, parents)}
                >
                    {!isLeaf ? (
                        <button
                            type="button"
                            className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
                            onClick={(e) => toggleNode(e, node.id)}
                        >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    ) : (
                        <div className="w-5" /> // Spacer
                    )}

                    {node.type === 'TOWER' || node.type === 'BLOCK' ? <Building2 className="w-4 h-4 text-blue-500" /> :
                        node.type === 'FLOOR' ? <Layers className="w-4 h-4 text-emerald-500" /> :
                            <MapPin className="w-4 h-4 text-gray-400" />}

                    <span className="text-sm">{node.name}</span>
                </div>
                {isExpanded && !isLeaf && node.children && (
                    <div className="border-l ml-2 pl-2 border-gray-100">
                        {node.children.map(child => renderNode(child, [...parents, node]))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="relative">
            <div
                className={`w-full bg-gray-50 border ${isOpen ? 'border-orange-500 ring-2 ring-orange-100' : 'border-gray-200'} rounded-xl px-4 py-3 text-sm font-medium cursor-pointer flex justify-between items-center transition-all`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 truncate">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className={`truncate ${selectedLabel ? 'text-gray-900' : 'text-gray-400'}`}>
                        {selectedLabel || placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-96 overflow-hidden flex flex-col">
                        <div className="p-3 border-b border-gray-100">
                            <input
                                type="text"
                                placeholder="Search locations..."
                                className="w-full bg-gray-50 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="p-2 overflow-y-auto flex-1">
                            {loading ? (
                                <div className="p-4 text-center text-sm text-gray-500 animate-pulse">Loading structure...</div>
                            ) : treeData.length > 0 ? (
                                <div className="-ml-4">
                                    {treeData.map(node => renderNode(node, []))}
                                </div>
                            ) : (
                                <div className="p-4 text-center text-sm text-gray-500">No structure defined.</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default EpsLocationPicker;
