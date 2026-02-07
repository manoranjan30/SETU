import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import {
    ModuleRegistry,
    ClientSideRowModelModule,
    ValidationModule,
    TextFilterModule,
    NumberFilterModule,
    TooltipModule,
    RowSelectionModule,
    themeQuartz
} from 'ag-grid-community';
import { ChevronRight, ChevronDown } from 'lucide-react';

// Register Modules
ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    ValidationModule,
    TextFilterModule,
    NumberFilterModule,
    TooltipModule,
    RowSelectionModule
]);

interface MapperBoqItem {
    id: number;
    description: string;
    qty: number;
    uom: string;
    subItems?: any[];
    [key: string]: any;
}

interface GridRow {
    uniqueId: string;
    displayId: string;
    description: string;
    type: 'MAIN' | 'SUB' | 'MEAS';
    qty: number;
    uom: string;
    status: string;
    linkedActivity?: string;
    level: number;
    parentUniqueId?: string; // To check expansion status of parent
    hasChildren: boolean;
    location?: string;
    data: any;
}

interface Props {
    projectId: number;
    items: MapperBoqItem[];
    selectedIds: (number | string)[];
    onSelectionChange: (ids: (number | string)[]) => void;
    epsNodes: any[]; // New Prop
}

const BoqGridPanel: React.FC<Props> = ({ projectId: _projectId, items, selectedIds, onSelectionChange, epsNodes }) => {
    const gridRef = useRef<AgGridReact>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // --- EPS Lookup Map & Resolver ---
    const epsNodeMap = useMemo(() => {
        const map = new Map();
        if (epsNodes) {
            epsNodes.forEach((n: any) => map.set(n.id, n));
        }
        return map;
    }, [epsNodes]);

    const resolveEpsPath = useCallback((nodeId: number | string | undefined | null) => {
        if (!nodeId) return '';
        let current = epsNodeMap.get(Number(nodeId));
        if (!current) return '';

        const path = [current.name];
        let parentId = current.parentId;
        let visited = new Set([current.id]);

        while (parentId && !visited.has(parentId)) {
            const parent = epsNodeMap.get(parentId);
            if (parent) {
                path.unshift(parent.name);
                visited.add(parent.id);
                parentId = parent.parentId;
            } else {
                break;
            }
        }
        return path.join(' > ');
    }, [epsNodeMap]);

    // --- Data Flattening Logic (Memoized) ---
    const allRows = useMemo(() => {
        const rows: GridRow[] = [];

        const processItem = (item: any, level: number, parentIds: string[], inheritedLocation: string = '') => {
            // Unique ID construction
            let uniqueIdStr = String(item.id);
            if (level === 1) uniqueIdStr = `SUB:${parentIds[parentIds.length - 1]}:${item.id}`;
            if (level === 2) uniqueIdStr = `MEAS:${parentIds[parentIds.length - 2]}:${parentIds[parentIds.length - 1]}:${item.id}`;

            let type: any = 'MAIN';
            if (level === 1) type = 'SUB';
            if (level === 2) type = 'MEAS';

            // Resolve Location ID (prioritize self, else inherit)
            // We use the full EPS tree map to generate the path
            const selfEpsId = item.epsNode?.id;
            const location = selfEpsId ? resolveEpsPath(selfEpsId) : inheritedLocation;

            const hasSub = item.subItems && item.subItems.length > 0;
            const hasMeas = item.measurements && item.measurements.length > 0;
            const hasChildren = hasSub || hasMeas;

            // Determine parent uniqueID for filtering
            let parentUniqueId: string | undefined;
            // Level 1: Parent is Main Item (ID: "1")
            if (level === 1) parentUniqueId = parentIds[0];
            // Level 2: Parent is Sub Item (ID: "SUB:MainID:SubID")
            if (level === 2) parentUniqueId = `SUB:${parentIds[0]}:${parentIds[1]}`;

            rows.push({
                uniqueId: uniqueIdStr,
                displayId: item.boqCode || '',
                description: item.description || item.elementName || 'Item',
                type,
                qty: item.qty || 0,
                uom: item.uom || '',
                status: item.mappingStatus || 'UNMAPPED',
                linkedActivity: item.mappedActivities || '',
                level,
                parentUniqueId,
                hasChildren,
                location,
                data: item
            });

            const newParentIds = [...parentIds, String(item.id)];

            if (item.subItems) {
                item.subItems.forEach((sub: any) => processItem(sub, level + 1, newParentIds, location));
            }
            if (item.measurements) {
                item.measurements.forEach((meas: any) => processItem(meas, level + 1, newParentIds, location));
            }
        };

        const sortedItems = [...items].sort((a, b) => (a.boqCode || '').localeCompare(b.boqCode || '', undefined, { numeric: true }));
        sortedItems.forEach(item => processItem(item, 0, [], ''));

        return rows;
    }, [items, resolveEpsPath]);

    // --- Search & Filter Logic ---
    const [searchText, setSearchText] = useState('');

    // Derived Maps for Graph Traversal
    const { idToRowMap, parentToChildrenMap, childToParentMap } = useMemo(() => {
        const idToRow = new Map<string, GridRow>();
        const parentToChildren = new Map<string, string[]>();
        const childToParent = new Map<string, string>();

        allRows.forEach(row => {
            idToRow.set(row.uniqueId, row);
            if (row.parentUniqueId) {
                if (!parentToChildren.has(row.parentUniqueId)) {
                    parentToChildren.set(row.parentUniqueId, []);
                }
                parentToChildren.get(row.parentUniqueId)?.push(row.uniqueId);
                childToParent.set(row.uniqueId, row.parentUniqueId);
            }
        });
        return { idToRowMap: idToRow, parentToChildrenMap: parentToChildren, childToParentMap: childToParent };
    }, [allRows]);

    const filteredAndVisibleRows = useMemo(() => {
        // 1. Search Logic
        if (!searchText.trim()) {
            // Apply Standard Expansion Logic if no search
            return allRows.filter(row => {
                if (row.level === 0) return true;
                // Check if ALL ancestors are expanded
                let current = row;
                while (current.parentUniqueId) {
                    if (!expandedIds.has(current.parentUniqueId)) return false;
                    const parent = idToRowMap.get(current.parentUniqueId);
                    if (!parent) break;
                    current = parent;
                }
                return true;
            });
        }

        // 2. Smart Tree Search
        const lowerText = searchText.toLowerCase();
        const keptIds = new Set<string>();

        // Pass 1: Find Direct Matches
        const directMatches = allRows.filter(r =>
            r.description?.toLowerCase().includes(lowerText) ||
            r.uniqueId.includes(lowerText) // Optional: Search by ID too
        );

        // Queue for processing (to handle propagation)


        // Helper to add node and all descendants
        const addNodeAndDescendants = (id: string) => {
            if (keptIds.has(id)) return; // Optimization
            keptIds.add(id);

            const children = parentToChildrenMap.get(id) || [];
            children.forEach(childId => addNodeAndDescendants(childId));
        };

        // Helper to add node and all ancestors
        const addNodeAndAncestors = (id: string) => {
            let currentId: string | undefined = id;
            while (currentId) {
                keptIds.add(currentId);
                currentId = childToParentMap.get(currentId);
            }
        };

        // Process Direct Matches
        directMatches.forEach(row => {
            // Requirement A: "if parent matches child also shold be shown"
            // -> Add Self + Descendants
            addNodeAndDescendants(row.uniqueId);

            // Requirement B: Show Path (Ancestors)
            // -> Add Self + Ancestors
            addNodeAndAncestors(row.uniqueId);
        });

        // Return sorted rows that are in the Keep Set
        return allRows.filter(r => keptIds.has(r.uniqueId));

    }, [allRows, searchText, expandedIds, idToRowMap, parentToChildrenMap, childToParentMap]);

    // Sync external selection props to grid
    useEffect(() => {
        if (gridRef.current && gridRef.current.api) {
            // Slight optimization: select only if needed
            const api = gridRef.current.api;
            api.forEachNode((node) => {
                // Check if node data exists (filtering might remove it)
                if (node.data) {
                    const isSelected = selectedIds.some(id => String(id) === node.data.uniqueId);
                    if (node.isSelected() !== isSelected) {
                        node.setSelected(isSelected);
                    }
                }
            });
        }
    }, [selectedIds, filteredAndVisibleRows]); // Dep on filtered rows

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // --- Custom Cell Renderer for Description with Tree Controls ---
    const DescriptionRenderer = (params: any) => {
        const { level, hasChildren, uniqueId, description, type } = params.data;
        const paddingLeft = level * 24; // 24px indent
        const isExpanded = expandedIds.has(uniqueId);

        return (
            <div style={{ paddingLeft: `${paddingLeft}px` }} className="flex items-center gap-2 h-full">
                {/* Expander Icon - Only for items with children */}
                <div
                    className="w-4 h-4 flex items-center justify-center cursor-pointer text-gray-500 hover:text-gray-800"
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent row selection
                        if (hasChildren) toggleExpand(uniqueId);
                    }}
                >
                    {hasChildren ? (
                        isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    ) : <span className="w-4" />}
                </div>

                {/* Type Icon */}
                <span className="text-gray-400 text-xs font-mono select-none">
                    {type === 'MAIN' && '📁'}
                    {type === 'SUB' && '↳'}
                    {type === 'MEAS' && '📏'}
                </span>

                <span className="truncate font-medium text-gray-700" title={description}>
                    {description}
                </span>
            </div>
        );
    };

    const StatusRenderer = (params: any) => {
        const status = params.value;
        let colorClass = 'bg-gray-100 text-gray-500';
        if (status === 'MAPPED') colorClass = 'bg-green-100 text-green-700';
        if (status === 'PARTIAL') colorClass = 'bg-orange-100 text-orange-700';

        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colorClass}`}>
                {status}
            </span>
        );
    };

    const onSelectionChanged = useCallback((event: any) => {
        const selectedRows = event.api.getSelectedRows();
        const ids = selectedRows.map((r: any) => {
            if (r.type === 'MAIN') return parseInt(r.uniqueId);
            return r.uniqueId;
        });
        onSelectionChange(ids);
    }, [onSelectionChange]);

    // Update Columns to sync with Search changes if needed (optional)
    const columnDefs: ColDef[] = useMemo(() => [
        { field: 'uniqueId', hide: true },
        {
            headerName: 'Description',
            field: 'description',
            cellRenderer: DescriptionRenderer,
            minWidth: 350,
            // Removed flex to allow manual resizing to persist better
            filter: false,
            resizable: true,
            checkboxSelection: true,
            headerCheckboxSelection: true,
            tooltipField: 'description'
        },
        {
            field: 'location',
            headerName: 'Location (EPS)',
            width: 250,
            filter: true,
            tooltipField: 'location',
            resizable: true
        },
        { field: 'qty', headerName: 'Qty', width: 90, filter: 'agNumberColumnFilter', resizable: true },
        { field: 'uom', headerName: 'Unit', width: 70, resizable: true },
        {
            field: 'status',
            headerName: 'Status',
            cellRenderer: StatusRenderer,
            width: 100,
            filter: true,
            resizable: true
        },
        {
            field: 'linkedActivity',
            headerName: 'Linked Activity',
            width: 200,
            tooltipField: 'linkedActivity',
            resizable: true
        }
    ], [expandedIds]); // DescriptionRenderer depends on expandedIds

    return (
        <div className="flex flex-col h-full w-full">
            {/* Search Bar */}
            <div className="p-2 border-b bg-gray-50 flex gap-2">
                <input
                    type="text"
                    placeholder="Search BOQ Items... (Matches Parent & Children)"
                    className="flex-1 p-2 border rounded shadow-sm text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                />
            </div>

            <div className="flex-1 w-full overflow-hidden">
                <AgGridReact
                    ref={gridRef}
                    rowData={filteredAndVisibleRows} // Use Filtered Data
                    columnDefs={columnDefs}
                    rowSelection={{
                        mode: 'multiRow',
                        headerCheckbox: false,
                        checkboxes: false,
                        enableClickSelection: false
                    }}
                    theme={themeQuartz}
                    onSelectionChanged={onSelectionChanged}
                    animateRows={true}
                    enableBrowserTooltips={true}
                    autoSizeStrategy={{
                        type: 'fitGridWidth',
                        defaultMinWidth: 100
                    }}
                    defaultColDef={{
                        sortable: true,
                        filter: true,
                        resizable: true,
                        floatingFilter: true,
                        flex: 1,
                        minWidth: 80
                    }}
                    className="ag-theme-quartz w-full h-full font-sans text-sm"
                />
            </div>
        </div>
    );
};

export default BoqGridPanel;
