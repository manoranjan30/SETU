import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../api/axios';
import { Tree } from '../../common/Tree';
import type { TreeNodeData } from '../../common/Tree';
import { ShoppingCart } from 'lucide-react';

interface MapperBoqItem {
    id: number;
    description: string;
    qty: number;
    uom: string;
    mappedTotal: number;
    remaining: number;
    mappingStatus: 'UNMAPPED' | 'PARTIAL' | 'MAPPED';
    mappedActivities?: string; // New field from backend
    boqCode: string; // Ensure this exists
}

interface Props {
    projectId: number;
    selectedIds: (number | string)[];
    onMultiSelect: (ids: (number | string)[]) => void;
    refreshTrigger?: number;
}

const BoqTreePanel: React.FC<Props> = ({ projectId, selectedIds, onMultiSelect, refreshTrigger }) => {
    const [items, setItems] = useState<MapperBoqItem[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadBoqItems();
    }, [projectId, refreshTrigger]);

    const loadBoqItems = async () => {
        const res = await api.get(`/planning/mapper/boq/${projectId}`);
        setItems(res.data);
    };

    // Virtual Tree Construction
    const treeData = useMemo(() => {
        if (items.length === 0) return [];

        // 1. Sort by boqCode
        const sorted = [...items].sort((a, b) =>
            (a.boqCode || '').localeCompare(b.boqCode || '', undefined, { numeric: true })
        );

        const roots: TreeNodeData[] = [];
        const levelMap = new Map<string, TreeNodeData>();

        sorted.forEach(item => {
            // Create BoqItem Node
            // Show mapped activities in label
            const linkedInfo = item.mappedActivities ? ` 🔗 ${item.mappedActivities}` : '';

            const boqNode: TreeNodeData = {
                id: item.id,
                label: `${item.boqCode || ''} ${item.description}${linkedInfo}`,
                children: [],
                data: item,
                icon: <ShoppingCart size={14} className={item.mappingStatus === 'MAPPED' ? 'text-green-500' : 'text-gray-400'} />
            };

            // Process SubItems -> Measurements
            if ((item as any).subItems) {
                (item as any).subItems.forEach((sub: any) => {
                    // Use Backend Status directly
                    const effectiveStatus = sub.mappingStatus;

                    const subNode: TreeNodeData = {
                        id: `SUB:${item.id}:${sub.id}`, // Encode Parent ID
                        label: sub.description,
                        children: [],
                        data: sub,
                        // Green dot if mapped, otherwise default Orange
                        icon: <div className={`w-2 h-2 rounded-full ${effectiveStatus === 'MAPPED' ? 'bg-green-500' : 'bg-orange-300'}`} />
                    };

                    if (sub.measurements) {
                        sub.measurements.forEach((meas: any) => {
                            // Use Backend Status
                            const measStatus = meas.mappingStatus;

                            const measNode: TreeNodeData = {
                                id: `MEAS:${item.id}:${sub.id}:${meas.id}`, // Encode Hierarchy
                                label: `${meas.elementName} (${meas.length}x${meas.breadth}x${meas.depth})`,
                                children: [],
                                data: meas,
                                // Green Dot if Mapped
                                icon: <div className={`text-[10px] ${measStatus === 'MAPPED' ? 'text-green-600 font-bold' : 'text-gray-400'}`}>#</div>
                            };
                            subNode.children?.push(measNode);
                        });
                    }
                    boqNode.children?.push(subNode);
                });
            }

            // Logic: Find Parent based on Code
            const codeParts = (item.boqCode || '').split('.');
            if (codeParts.length > 1) {
                const parentCode = codeParts.slice(0, -1).join('.');
                const parentNode = levelMap.get(parentCode);
                if (parentNode) {
                    parentNode.children?.push(boqNode);
                } else {
                    roots.push(boqNode);
                }
            } else {
                roots.push(boqNode);
            }
            levelMap.set(item.boqCode, boqNode);
        });

        return roots;
    }, [items]);

    return (
        <div className="flex flex-col h-full bg-gray-50">
            <div className="p-2 border-b bg-white">
                <input
                    type="text"
                    placeholder="Search BOQ Tree..."
                    className="w-full border text-sm rounded px-2 py-1"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            <div className="flex-1 overflow-auto p-2">
                <Tree
                    data={treeData}
                    selectedIds={selectedIds}
                    onSelect={(ids) => onMultiSelect(ids)}
                    getItemClassName={(node) => {
                        const item = node.data;
                        if (!item) return '';

                        // Check status (only for BOQ Items, not subs for now, unless subs have status)
                        // Backend calculates status on the BOQ Item level.
                        if (item.mappingStatus === 'MAPPED') return 'bg-green-50 border-green-100 hover:bg-green-100';
                        if (item.mappingStatus === 'PARTIAL') return 'bg-orange-50 border-orange-100 hover:bg-orange-100';

                        return '';
                    }}
                />
            </div>
        </div>
    );
};

export default BoqTreePanel;
