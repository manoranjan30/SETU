
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactElement, CSSProperties } from 'react';
import Modal from '../common/Modal';
import { ChevronDown, ChevronRight, Settings, Search, X, ChevronUp, ChevronsUpDown, Filter, Link as LinkIcon, List as ListIcon } from 'lucide-react';
import { List } from 'react-window';
import clsx from 'clsx';
import type { WorkOrder, WorkOrderItem } from '../../types/workdoc';
import WorkOrderBoqLinkage from './WorkOrderBoqLinkage';

// --- COLUMN DEFINITIONS ---
interface ColumnDef {
    key: string;
    label: string;
    defaultWidth: number;
    align: 'left' | 'center' | 'right';
    alwaysVisible?: boolean;
    defaultVisible?: boolean;
    editable?: boolean;
    render: (item: WorkOrderItem, isParent: boolean, calculatedAmount: number, onEdit?: (field: string, value: number) => void) => React.ReactNode;
}

const ALL_COLUMNS: ColumnDef[] = [
    {
        key: 'toggle', label: '', defaultWidth: 40, align: 'center', alwaysVisible: true, defaultVisible: true,
        render: () => null // Handled specially
    },
    {
        key: 'serial', label: 'Serial No.', defaultWidth: 120, align: 'left', alwaysVisible: true, defaultVisible: true,
        render: (item) => <span className="font-mono text-xs text-slate-600">{item.serialNumber}</span>
    },
    {
        key: 'code', label: 'Material Code', defaultWidth: 140, align: 'left', defaultVisible: true,
        render: (item) => <span className="font-mono text-xs">{item.materialCode}</span>
    },
    {
        key: 'shortText', label: 'Short Description', defaultWidth: 350, align: 'left', alwaysVisible: true, defaultVisible: true,
        render: (item) => <span className="truncate text-slate-800" title={item.shortText}>{item.shortText}</span>
    },
    {
        key: 'longText', label: 'Long Description', defaultWidth: 300, align: 'left', defaultVisible: false,
        render: (item) => <span className="truncate text-xs text-slate-500" title={item.longText}>{item.longText || '-'}</span>
    },
    {
        key: 'quantity', label: 'Quantity', defaultWidth: 100, align: 'right', defaultVisible: true, editable: true,
        render: (item, isParent, _, onEdit) => isParent ? '-' : (
            <input
                type="number"
                className="w-full text-right bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded px-1 font-bold"
                defaultValue={item.quantity}
                onBlur={(e) => onEdit?.('quantity', parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
        )
    },
    {
        key: 'uom', label: 'UOM', defaultWidth: 80, align: 'center', defaultVisible: true,
        render: (item) => <span className="text-xs text-slate-500">{item.uom}</span>
    },
    {
        key: 'rate', label: 'Rate', defaultWidth: 120, align: 'right', defaultVisible: true, editable: true,
        render: (item, isParent, _, onEdit) => isParent ? '-' : (
            <input
                type="number"
                className="w-full text-right bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded px-1 text-xs"
                defaultValue={item.rate}
                onBlur={(e) => onEdit?.('rate', parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
        )
    },
    {
        key: 'calcAmount', label: 'Calc. Amount', defaultWidth: 140, align: 'right', defaultVisible: true,
        render: (_, isParent, calcAmt) => isParent ? '-' : (
            <span className="font-medium text-blue-700">₹{calcAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        )
    },
    {
        key: 'amount', label: 'Total Amount', defaultWidth: 140, align: 'right', alwaysVisible: true, defaultVisible: true,
        render: (item) => <span className="font-black text-slate-800">₹{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    },
    {
        key: 'executedQuantity', label: 'Work Done (Qty)', defaultWidth: 140, align: 'right', defaultVisible: true,
        render: (item) => (
            <div className="flex flex-col items-end">
                <span className="font-bold text-green-700">{Number(item.executedQuantity || 0).toFixed(3)}</span>
                <span className="text-[10px] text-slate-400">of {item.quantity} {item.uom}</span>
            </div>
        )
    },
    {
        key: 'progress', label: 'Progress %', defaultWidth: 100, align: 'center', defaultVisible: true,
        render: (item) => {
            const pct = Math.min(100, (Number(item.executedQuantity || 0) / (Number(item.quantity) || 1)) * 100);
            return (
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
            );
        }
    },
    {
        key: 'level', label: 'Level', defaultWidth: 60, align: 'center', defaultVisible: false,
        render: (item) => <span className="text-xs text-slate-400">{item.level ?? 0}</span>
    },
    {
        key: 'id', label: 'ID', defaultWidth: 80, align: 'center', defaultVisible: false,
        render: (item) => <span className="text-xs text-slate-400 font-mono">{item.id}</span>
    },
];

export type TabType = 'items' | 'linkage';

// --- ROW PROPS INTERFACE ---
interface RowData {
    items: WorkOrderItem[];
    sortedItems: WorkOrderItem[];
    collapsedParents: Set<string>;
    toggleCollapse: (serialNumber: string) => void;
    visibleColumns: Record<string, boolean>;
    colWidths: Record<string, number>;
    onEditItem: (itemId: number, field: string, value: number) => void;
    onContextMenu: (e: React.MouseEvent, item: WorkOrderItem) => void;
}

// --- TABLE ROW COMPONENT ---
const TableRow = (props: {
    ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
    index: number;
    style: CSSProperties;
} & RowData): ReactElement | null => {
    const { index, style, items, sortedItems, collapsedParents, toggleCollapse, visibleColumns, colWidths, onEditItem, onContextMenu } = props;

    const item = items?.[index];
    if (!item) return null;

    const hasChildren = sortedItems.some((i: WorkOrderItem) => i.parentSerialNumber === item.serialNumber);
    const isCollapsed = collapsedParents.has(item.serialNumber || '');
    const isParent = item.isParent || hasChildren;
    const indent = (item.level || 0) * 16;
    const calculatedAmount = Number(item.quantity) * Number(item.rate);

    const handleEdit = (field: string, value: number) => {
        onEditItem(item.id, field, value);
    };

    return (
        <div
            style={style}
            className={clsx(
                "flex items-center border-b border-slate-200 hover:bg-blue-50/50 transition-colors text-sm",
                isParent ? "bg-slate-100/80 font-medium text-slate-900" : "bg-white text-slate-700"
            )}
            onContextMenu={(e) => onContextMenu(e, item)}
        >
            {ALL_COLUMNS.filter(col => visibleColumns[col.key]).map((col) => {
                const width = colWidths[col.key] || col.defaultWidth;

                // Special handling for toggle column
                if (col.key === 'toggle') {
                    return (
                        <div key={col.key} style={{ width }} className="flex justify-center flex-shrink-0 border-r border-slate-200">
                            {hasChildren && (
                                <button
                                    onClick={() => toggleCollapse(item.serialNumber || '')}
                                    className="p-1 hover:bg-slate-300 rounded text-slate-600"
                                >
                                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                </button>
                            )}
                        </div>
                    );
                }

                // Special handling for serial with indent
                if (col.key === 'serial') {
                    return (
                        <div
                            key={col.key}
                            style={{ width, paddingLeft: indent + 8 }}
                            className="flex-shrink-0 truncate border-r border-slate-200 px-2 flex items-center h-full"
                        >
                            {col.render(item, isParent, calculatedAmount, handleEdit)}
                        </div>
                    );
                }

                return (
                    <div
                        key={col.key}
                        style={{ width }}
                        className={clsx(
                            "flex-shrink-0 px-2 border-r border-slate-200 flex items-center h-full",
                            col.align === 'right' && "justify-end",
                            col.align === 'center' && "justify-center",
                            col.align === 'left' && "justify-start",
                            col.key === 'calcAmount' && "bg-blue-50/30"
                        )}
                    >
                        {col.render(item, isParent, calculatedAmount, handleEdit)}
                    </div>
                );
            })}
        </div>
    );
};

// --- MAIN COMPONENT ---
interface Props {
    isOpen: boolean;
    onClose: () => void;
    workOrder: WorkOrder | null;
    onUpdateItem?: (workOrderId: number, itemId: number, field: string, value: number) => Promise<void>;
    onRefresh?: () => void;
}

const WorkOrderDetailModal: React.FC<Props> = ({ isOpen, onClose, workOrder, onUpdateItem, onRefresh }) => {
    const [activeTab, setActiveTab] = useState<TabType>('items');
    const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
    const [sortedItems, setSortedItems] = useState<WorkOrderItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showColMenu, setShowColMenu] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: WorkOrderItem } | null>(null);

    // Column visibility state
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        ALL_COLUMNS.forEach(col => {
            initial[col.key] = col.defaultVisible ?? false;
        });
        return initial;
    });

    // Column width state
    const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        ALL_COLUMNS.forEach(col => {
            initial[col.key] = col.defaultWidth;
        });
        return initial;
    });

    const headerRef = useRef<HTMLDivElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);

    // Sort items on load
    useEffect(() => {
        if (workOrder?.items) {
            const items = [...workOrder.items].sort((a, b) => {
                return (a.serialNumber || '').localeCompare(b.serialNumber || '', undefined, { numeric: true });
            });
            setSortedItems(items);
        }
    }, [workOrder]);

    // Get all unique levels
    const allLevels = useMemo(() => {
        const levels = new Set<number>();
        sortedItems.forEach(item => levels.add(item.level ?? 0));
        return Array.from(levels).sort((a, b) => a - b);
    }, [sortedItems]);

    // Filter and flatten items
    const flattenedItems = useMemo(() => {
        let filtered = sortedItems;

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = sortedItems.filter(item =>
                item.serialNumber?.toLowerCase().includes(term) ||
                item.materialCode?.toLowerCase().includes(term) ||
                item.shortText?.toLowerCase().includes(term) ||
                item.longText?.toLowerCase().includes(term)
            );
        } else {
            // Apply collapse filter only when not searching
            filtered = sortedItems.filter(item => {
                if (item.level === 0) return true;
                if (!item.parentSerialNumber) return true;

                // Check all ancestors
                let parentSerial: string | null | undefined = item.parentSerialNumber;
                while (parentSerial) {
                    if (collapsedParents.has(parentSerial)) return false;
                    const parent = sortedItems.find(i => i.serialNumber === parentSerial);
                    parentSerial = parent?.parentSerialNumber;
                }
                return true;
            });
        }

        return filtered;
    }, [sortedItems, collapsedParents, searchTerm]);

    // Toggle single item
    const toggleCollapse = useCallback((serialNumber: string) => {
        setCollapsedParents(prev => {
            const next = new Set(prev);
            if (next.has(serialNumber)) next.delete(serialNumber);
            else next.add(serialNumber);
            return next;
        });
    }, []);

    // Collapse/Expand all at a specific level
    const collapseLevel = useCallback((level: number) => {
        const parentsAtLevel = sortedItems
            .filter(item => (item.level ?? 0) === level && (item.isParent || sortedItems.some(i => i.parentSerialNumber === item.serialNumber)))
            .map(item => item.serialNumber || '');

        setCollapsedParents(prev => {
            const next = new Set(prev);
            parentsAtLevel.forEach(serial => next.add(serial));
            return next;
        });
    }, [sortedItems]);

    const expandLevel = useCallback((level: number) => {
        const parentsAtLevel = sortedItems
            .filter(item => (item.level ?? 0) === level)
            .map(item => item.serialNumber || '');

        setCollapsedParents(prev => {
            const next = new Set(prev);
            parentsAtLevel.forEach(serial => next.delete(serial));
            return next;
        });
    }, [sortedItems]);

    const expandAll = useCallback(() => {
        setCollapsedParents(new Set());
    }, []);

    const collapseAll = useCallback(() => {
        const allParents = sortedItems
            .filter(item => item.isParent || sortedItems.some(i => i.parentSerialNumber === item.serialNumber))
            .map(item => item.serialNumber || '');
        setCollapsedParents(new Set(allParents));
    }, [sortedItems]);

    // Handle edit
    const handleEditItem = useCallback(async (itemId: number, field: string, value: number) => {
        if (onUpdateItem && workOrder) {
            await onUpdateItem(workOrder.id, itemId, field, value);
        }
    }, [onUpdateItem, workOrder]);

    // Context menu handler
    const handleContextMenu = useCallback((e: React.MouseEvent, item: WorkOrderItem) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    }, []);

    // Close context menu on click elsewhere
    useEffect(() => {
        const handler = () => setContextMenu(null);
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);

    // Column resize
    const handleResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = colWidths[colKey];

        const handleMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX;
            setColWidths(prev => ({ ...prev, [colKey]: Math.max(40, startWidth + delta) }));
        };

        const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    }, [colWidths]);

    // Sync scroll
    const handleListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (headerRef.current) {
            headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    }, []);

    // Calculate total width
    const totalWidth = useMemo(() => {
        return ALL_COLUMNS
            .filter(col => visibleColumns[col.key])
            .reduce((acc, col) => acc + (colWidths[col.key] || col.defaultWidth), 0);
    }, [visibleColumns, colWidths]);

    // Row props
    const rowProps: RowData = useMemo(() => ({
        items: flattenedItems,
        sortedItems,
        collapsedParents,
        toggleCollapse,
        visibleColumns,
        colWidths,
        onEditItem: handleEditItem,
        onContextMenu: handleContextMenu
    }), [flattenedItems, sortedItems, collapsedParents, toggleCollapse, visibleColumns, colWidths, handleEditItem, handleContextMenu]);

    if (!workOrder) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Work Order: ${workOrder.woNumber}`} size="fullscreen">
            <div className="h-full flex flex-col p-0 bg-slate-50/50">
                {/* Header Summary */}
                <div className="bg-white border-b border-slate-200 px-6 py-3 grid grid-cols-5 gap-6 shadow-sm z-10">
                    <div>
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Vendor</p>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
                                {workOrder.vendor?.name?.charAt(0)}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm leading-tight">{workOrder.vendor?.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{workOrder.vendor?.vendorCode}</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Details</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">{workOrder.woNumber}</p>
                        <p className="text-[10px] text-slate-500">{new Date(workOrder.woDate).toLocaleDateString()}</p>
                    </div>
                    <div className="col-span-2">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by serial, code, description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded">
                                    <X className="w-4 h-4 text-slate-400" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Value</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                            <span className="text-sm text-slate-400 font-medium mr-1">₹</span>
                            {Number(workOrder.totalAmount).toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-8 shadow-sm">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={clsx(
                            "py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2",
                            activeTab === 'items' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <ListIcon size={14} /> Item Details
                    </button>
                    <button
                        onClick={() => setActiveTab('linkage')}
                        className={clsx(
                            "py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2",
                            activeTab === 'linkage' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <LinkIcon size={14} /> BOQ Linkage
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'items' && (
                    <>
                        {/* Toolbar */}
                        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 z-10">
                            {/* Level Controls */}
                            <div className="flex items-center gap-1 border-r border-slate-200 pr-3 mr-2">
                                <span className="text-xs text-slate-500 mr-1">Level:</span>
                                {allLevels.map(level => (
                                    <div key={level} className="flex items-center">
                                        <button
                                            onClick={() => expandLevel(level)}
                                            className="px-2 py-1 text-xs bg-slate-100 hover:bg-blue-100 rounded-l border border-slate-300 text-slate-600"
                                            title={`Expand all Level ${level}`}
                                        >
                                            <ChevronDown size={12} />
                                        </button>
                                        <span className="px-2 py-1 text-xs bg-slate-50 border-t border-b border-slate-300 text-slate-700 font-medium">{level}</span>
                                        <button
                                            onClick={() => collapseLevel(level)}
                                            className="px-2 py-1 text-xs bg-slate-100 hover:bg-orange-100 rounded-r border border-slate-300 text-slate-600"
                                            title={`Collapse all Level ${level}`}
                                        >
                                            <ChevronUp size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Expand/Collapse All */}
                            <button onClick={expandAll} className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700 flex items-center gap-1">
                                <ChevronsUpDown size={14} /> Expand All
                            </button>
                            <button onClick={collapseAll} className="px-3 py-1.5 text-xs bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 text-orange-700 flex items-center gap-1">
                                <Filter size={14} /> Collapse All
                            </button>

                            <div className="flex-1" />

                            {/* Column Visibility */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowColMenu(!showColMenu)}
                                    className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 text-slate-700 flex items-center gap-1"
                                >
                                    <Settings size={14} /> Columns
                                </button>
                                {showColMenu && (
                                    <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-50 max-h-80 overflow-auto">
                                        <div className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2 pb-2 border-b border-slate-200">Column Visibility</div>
                                        {ALL_COLUMNS.filter(col => col.key !== 'toggle').map(col => (
                                            <label key={col.key} className="flex items-center py-1 cursor-pointer hover:bg-slate-50 rounded px-1">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleColumns[col.key]}
                                                    disabled={col.alwaysVisible}
                                                    onChange={() => setVisibleColumns(p => ({ ...p, [col.key]: !p[col.key] }))}
                                                    className="mr-2 rounded"
                                                />
                                                <span className={clsx("text-sm", col.alwaysVisible && "text-slate-400")}>{col.label}</span>
                                                {col.alwaysVisible && <span className="ml-auto text-[10px] text-slate-400">Required</span>}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table Layout */}
                        <div className="flex-1 flex flex-col min-h-0 mx-4 mb-4 mt-2 bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
                            {/* Table Header */}
                            <div
                                ref={headerRef}
                                className="overflow-hidden bg-slate-100 border-b-2 border-slate-300 flex-shrink-0"
                            >
                                <div className="flex items-center h-9" style={{ width: totalWidth }}>
                                    {ALL_COLUMNS.filter(col => visibleColumns[col.key]).map((col) => {
                                        const width = colWidths[col.key] || col.defaultWidth;
                                        return (
                                            <div
                                                key={col.key}
                                                style={{ width }}
                                                className={clsx(
                                                    "px-2 text-[10px] uppercase font-black text-slate-600 tracking-wider flex-shrink-0 relative group flex items-center h-full border-r border-slate-300",
                                                    col.align === 'right' && "justify-end",
                                                    col.align === 'center' && "justify-center",
                                                    col.align === 'left' && "justify-start"
                                                )}
                                            >
                                                {col.label}
                                                {/* Resize Handle */}
                                                {col.key !== 'toggle' && (
                                                    <div
                                                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                        onMouseDown={(e) => handleResizeStart(e, col.key)}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Virtual List */}
                            <div ref={listContainerRef} className="flex-1 min-h-0 overflow-hidden" onScroll={handleListScroll}>
                                <List
                                    rowComponent={TableRow}
                                    rowCount={flattenedItems.length}
                                    rowHeight={40}
                                    rowProps={rowProps}
                                    style={{ height: '100%', width: totalWidth, minWidth: '100%', overflowX: 'auto' }}
                                />
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'linkage' && (
                    <div className="flex-1 min-h-0">
                        <WorkOrderBoqLinkage workOrder={workOrder} onRefresh={onRefresh} />
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 py-3 border-t border-slate-200 bg-white flex justify-between items-center z-10">
                    <div className="text-xs text-slate-500">
                        Showing <span className="font-bold text-slate-700">{flattenedItems.length}</span> of <span className="font-bold text-slate-700">{sortedItems.length}</span> items
                        {searchTerm && <span className="ml-2 text-blue-600">(filtered)</span>}
                    </div>
                    <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow active:scale-95">
                        Close
                    </button>
                </div>

                {/* Context Menu */}
                {contextMenu && (
                    <div
                        className="fixed bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-[100] min-w-[180px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-1 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                            Level {contextMenu.item.level ?? 0}
                        </div>
                        <button
                            onClick={() => { expandLevel(contextMenu.item.level ?? 0); setContextMenu(null); }}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 text-slate-700 flex items-center gap-2"
                        >
                            <ChevronDown size={14} /> Expand All at This Level
                        </button>
                        <button
                            onClick={() => { collapseLevel(contextMenu.item.level ?? 0); setContextMenu(null); }}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-orange-50 text-slate-700 flex items-center gap-2"
                        >
                            <ChevronUp size={14} /> Collapse All at This Level
                        </button>
                        <div className="border-t border-slate-100 mt-1 pt-1">
                            <button
                                onClick={() => { expandAll(); setContextMenu(null); }}
                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                            >
                                <ChevronsUpDown size={14} /> Expand All Levels
                            </button>
                            <button
                                onClick={() => { collapseAll(); setContextMenu(null); }}
                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                            >
                                <Filter size={14} /> Collapse All Levels
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default WorkOrderDetailModal;
