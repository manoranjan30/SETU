import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { ArrowLeft, Save, Calendar, Search, Activity as ActivityIcon, CheckCircle, ChevronLeft, ChevronRight, Folder } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { themeQuartz } from 'ag-grid-community';
import { Tree, type TreeNodeData } from '../../components/common/Tree';
import ExecutionLogTable from './ExecutionLogTable';
import ActivityLaborAllocation from '../../components/labor/ActivityLaborAllocation';

// ---------------------------------------------------------------------------
// External Components (Stable References)
// ---------------------------------------------------------------------------

const InputCell = (params: any) => {
    // Access state via context
    const { measurements, setMeasurements } = params.context;
    // CRITICAL FIX: Use 'planId' (Row ID) instead of 'boqItemId' (Resource ID)
    // multiple rows can share the same BOQ Item, so we need the unique Plan ID.
    const id = params.data.planId;
    const planned = params.data.plannedQty || 0;
    // FIX: Use consumedQty from plan level (activity-specific), not boqItem (global)
    const prev = params.data.consumedQty || 0;
    const max = Math.max(0, planned - prev); // Remaining balance

    const val = measurements[id] !== undefined ? measurements[id] : '';

    // Check parent status (injected via map)
    const isCompleted = params.data.activityStatus === 'COMPLETED' || !!params.data.finishDateActual;

    return (
        <input
            type="number"
            disabled={isCompleted}
            className={`w-full border rounded px-1 py-0.5 text-right outline-none transition-colors 
                ${isCompleted
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                    : Number(val) > max
                        ? 'border-red-500 ring-red-200 focus:ring-2'
                        : 'focus:ring-blue-500 focus:ring-2'
                }`}
            value={val}
            placeholder={isCompleted ? "-" : "0.00"}
            max={max}
            onChange={(e) => {
                if (isCompleted) return; // double safety
                let numericVal = parseFloat(e.target.value);
                if (isNaN(numericVal)) numericVal = 0;

                // Allow user to type, but visual warning if exceeded (or strict clamp?)
                // User requested: "should not be exceeding" -> Strict Clamp
                if (numericVal > max) {
                    alert(`Cannot exceed value. Balance available: ${max.toFixed(2)}`);
                    numericVal = max;
                }
                if (numericVal < 0) numericVal = 0;

                setMeasurements((prev: any) => ({
                    ...prev,
                    [id]: numericVal
                }));

                // Force grid refresh for Balance column
                params.api.refreshCells({ columns: ['balance'] });
            }}
        />
    );
};

const ProgressEntry = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    // Layout State
    const [showTree, setShowTree] = useState(true);
    const [showList, setShowList] = useState(true);

    // Resizable Panes
    const [leftWidth, setLeftWidth] = useState(300);
    const [middleWidth, setMiddleWidth] = useState(350);
    const treeRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const isResizingTree = useRef(false);
    const isResizingList = useRef(false);

    // Data State
    const [epsTree, setEpsTree] = useState<TreeNodeData[]>([]);

    // Changing to Multi-Select Array
    const [selectedEpsIds, setSelectedEpsIds] = useState<number[]>([]);

    const [restrictToFloor, setRestrictToFloor] = useState(false);

    const [activities, setActivities] = useState<any[]>([]);
    const [filteredActivities, setFilteredActivities] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
    const [loadingActivities, setLoadingActivities] = useState(false);

    const [measurements, setMeasurements] = useState<Record<number, number>>({});
    const [comment, setComment] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Tab State
    const [activeTab, setActiveTab] = useState<'entry' | 'log' | 'labor'>('entry');
    const [laborCategories, setLaborCategories] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'labor' && projectId) {
            fetchLaborCategories();
        }
    }, [activeTab, projectId]);

    const fetchLaborCategories = async () => {
        try {
            const res = await api.get(`/labor/categories?projectId=${projectId}`);
            setLaborCategories(res.data);
        } catch (err) {
            console.error("Failed to fetch labor categories", err);
        }
    };

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingTree.current) {
                const newWidth = Math.max(200, Math.min(600, e.clientX));
                setLeftWidth(newWidth);
            } else if (isResizingList.current) {
                const startX = showTree ? leftWidth : 40;
                const newWidth = Math.max(250, Math.min(800, e.clientX - startX));
                setMiddleWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            isResizingTree.current = false;
            isResizingList.current = false;
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [showTree, leftWidth]);

    const startResizingTree = () => {
        isResizingTree.current = true;
        document.body.style.cursor = 'col-resize';
    };

    const startResizingList = () => {
        isResizingList.current = true;
        document.body.style.cursor = 'col-resize';
    };

    // Data Fetching
    useEffect(() => {
        if (projectId) fetchEpsTree();
    }, [projectId]);

    useEffect(() => {
        // When selection changes
        if (selectedEpsIds.length > 0) {
            // Selected Node acts as the "Project" context for execution
            fetchActivities(selectedEpsIds);
            setSelectedActivityId(null);
        } else {
            setActivities([]);
        }
    }, [selectedEpsIds]);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredActivities(activities);
        } else {
            const lower = searchTerm.toLowerCase();
            setFilteredActivities(activities.filter(a =>
                a.activityName.toLowerCase().includes(lower) ||
                a.activityCode.toLowerCase().includes(lower) ||
                a.wbsName?.toLowerCase().includes(lower)
            ));
        }
    }, [searchTerm, activities]);

    const fetchEpsTree = async () => {
        try {
            const res = await api.get(`/eps/${projectId}/tree`);
            const rawTree = res.data;

            // 2. Set Tree for UI (Apply restriction if active)
            const formatted = mapEpsToTree(rawTree, restrictToFloor);
            setEpsTree(formatted);

            // Store raw for toggling
            (window as any).__rawEpsTree = rawTree;

        } catch (err) {
            console.error("Failed to fetch EPS Tree", err);
        }
    };

    // Toggle Effect
    useEffect(() => {
        const raw = (window as any).__rawEpsTree;
        if (raw) {
            setEpsTree(mapEpsToTree(raw, restrictToFloor));
        }
    }, [restrictToFloor]);

    const mapEpsToTree = (nodes: any[], restrict: boolean): TreeNodeData[] => {
        if (!nodes) return [];

        return nodes
            .filter(node => {
                // First pass filter: Remove Units and Rooms immediately at this level
                if (!restrict) return true;
                const type = (node.type || '').toUpperCase();
                return type !== 'UNIT' && type !== 'ROOM';
            })
            .map(node => {
                const type = (node.type || '').toUpperCase();

                // Pruning Logic:
                // If we are restricting, and we hit a FLOOR, we must stop recursion.
                // We also stop if we somehow hit a UNIT or ROOM (though filtered above, safety check).
                const isFloor = type === 'FLOOR';

                const returnNoChildren = restrict && isFloor;

                return {
                    id: node.id,
                    label: node.label || node.name || `Node ${node.id}`,
                    type: node.type,
                    // If we prune, send empty array. 
                    // CRITICAL: We also recurse with the restrict flag.
                    children: returnNoChildren ? [] : mapEpsToTree(node.children, restrict)
                };
            });
    };

    const fetchActivities = async (targetIds: number[]) => {
        try {
            setLoadingActivities(true);
            setActivities([]);

            if (targetIds.length === 0) {
                setLoadingActivities(false);
                return;
            }

            // FILTERING: We used to filter by type, but since activities can exist at Unit/Room level
            // and we rely on cascade selection to pick them up, we should NOT filter them out.
            // If the node has activities, we want them.
            const relevantIds = targetIds;

            const idsToFetch = relevantIds;

            if (idsToFetch.length === 0) {
                setLoadingActivities(false);
                return;
            }

            // Limit concurrency
            const uniqueIds = Array.from(new Set(idsToFetch));
            // Limit to 20 parallel requests to avoid blasting the server
            const limitedIds = uniqueIds.slice(0, 20);

            // FIX: Revert to using the Node ID as the 'projectId' parameter
            const promises = limitedIds.map(id => api.get(`/planning/${id}/execution-ready`).catch(() => ({ data: [] })));

            const responses = await Promise.all(promises);

            const allRows = responses.flatMap(r => r.data);
            console.log(`[ProgressEntry] Fetched ${allRows.length} total rows. Deduplicating...`);

            // Deduplicate (in case multiple selected nodes return the same activity via recursion)
            const uniqueActivities = new Map();
            allRows.forEach((row: any) => {
                // Use Activity CODE as key to ensure uniqueness (Handling database duplicates)
                const key = row.activityCode;
                if (key && !uniqueActivities.has(key)) {
                    uniqueActivities.set(key, row);
                }
            });
            console.log(`[ProgressEntry] Unique activities (by Code): ${uniqueActivities.size}`);

            // Map Raw Data
            const rawData = Array.from(uniqueActivities.values());
            const formattedActivities = rawData.map((a: any) => ({
                id: a.id,
                activityName: a.activityName,
                activityCode: a.activityCode,
                wbsPath: a.wbsPath,
                parentWbs: a.parentWbs,
                status: a.status,
                startDatePlanned: a.startDatePlanned,
                finishDatePlanned: a.finishDatePlanned,
                startDateActual: a.startDateActual,
                finishDateActual: a.finishDateActual,
                plans: a.plans ? a.plans.map((p: any) => ({
                    planId: p.planId,
                    plannedQty: p.plannedQuantity,
                    // FIX: Include consumedQty at plan level (activity-specific executed qty)
                    consumedQty: p.consumedQty || 0,
                    // PASS PARENT STATUS for UI locking
                    activityStatus: a.status,
                    finishDateActual: a.finishDateActual,
                    boqItem: p.boqItem || {
                        id: p.boqItemId,
                        description: p.description,
                        uom: p.uom,
                        qty: p.totalQty,
                        consumedQty: p.consumedQty // Also keep here for legacy
                    }
                })) : []
            }));

            setActivities(formattedActivities);
            // End of Grouping Replacement
        } catch (err) {
            console.error(err);
            setActivities([]);
        } finally {
            setLoadingActivities(false);
        }
    };

    const handleMarkComplete = async (e: React.MouseEvent, activityId: number, currentStatus: string) => {
        e.stopPropagation(); // Prevent card selection

        if (currentStatus === 'COMPLETED') return; // Already done

        if (!confirm("Are you sure you want to mark this activity as fully COMPLETED? This will set actual finish date to today.")) return;

        try {
            await api.post(`/planning/activities/${activityId}/complete`);
            // Refresh
            if (selectedEpsIds.length > 0) fetchActivities(selectedEpsIds);
        } catch (err) {
            console.error(err);
            alert("Failed to update status.");
        }
    };

    const handleSave = async () => {
        try {
            if (Object.keys(measurements).length === 0) return;

            if (!processConfirm()) return;

            // Prepare Payload
            // Iterate over Plan IDs (Keys of measurements)
            const entries = Object.entries(measurements).map(([planIdStr, qty]) => {
                const planId = Number(planIdStr);

                // Find the plan object to get BOQ Item ID
                let plan: any;
                // Since we are likely viewing 'selectedActivityId', we can search there first
                const currentActivity = activities.find(a => a.id === selectedActivityId);
                plan = currentActivity?.plans?.find((p: any) => p.planId === planId);

                // Fallback search if somehow cross-activity (unlikely with current UI)
                if (!plan) {
                    for (const act of activities) {
                        const found = act.plans?.find((p: any) => p.planId === planId);
                        if (found) {
                            plan = found;
                            break;
                        }
                    }
                }

                if (!plan) {
                    console.error(`[handleSave] Plan not found for ID: ${planId}`);
                    return null;
                }

                console.log(`[handleSave] Found Plan for ${planId}:`, JSON.stringify(plan));
                const resolvedBoqItemId = plan.boqItem?.id || plan.boqItemId;

                if (!resolvedBoqItemId) {
                    console.error(`[handleSave] Plan missing boqItemId!`, plan);
                    alert(`Error: Cannot save row. Data missing.`);
                    return null;
                }

                return {
                    planId: planId, // FIX: Include planId for per-plan tracking
                    boqItemId: resolvedBoqItemId,
                    projectId: projectId,
                    wbsNodeId: selectedEpsIds[0], // Approximation
                    activityId: selectedActivityId, // Link to current activity
                    executedQty: Number(qty),
                    date,
                    notes: comment
                };
            }).filter(e => e !== null);

            if (entries.length === 0) return;

            await api.post(`/execution/${projectId}/measurements`, { entries });
            alert("Progress Saved Successfully!");

            setMeasurements({});
            setComment("");
            if (selectedEpsIds.length > 0) fetchActivities(selectedEpsIds);

        } catch (err) {
            console.error(err);
            alert("Failed to save progress.");
        }
    };

    const processConfirm = () => {
        const count = Object.keys(measurements).length;
        if (count === 0) return false;
        return confirm(`Save progress for ${count} items? This will update the Master Schedule.`);
    };

    const gridData = useMemo(() => {
        if (!selectedActivityId) return [];
        const activity = activities.find(a => a.id === selectedActivityId);
        return activity ? activity.plans : [];
    }, [selectedActivityId, activities]);

    // Stable ColDefs
    const colDefs = useMemo<ColDef[]>(() => [
        {
            field: 'boqItem.description',
            headerName: 'Resource / Item',
            flex: 1,
            minWidth: 200
        },
        { field: 'boqItem.uom', headerName: 'Unit', width: 80 },
        {
            field: 'plannedQty',
            headerName: 'Planned',
            width: 100,
            valueFormatter: (p: any) => Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2 }),
            cellClass: 'font-medium bg-blue-50'
        },
        {
            // FIX: Use consumedQty from plan object (per-activity) instead of boqItem (global)
            field: 'consumedQty',
            headerName: 'Prev Executed',
            width: 120,
            valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
            cellClass: 'text-gray-500'
        },
        {
            headerName: 'Today',
            width: 120,
            pinned: 'right',
            cellRenderer: InputCell
        },
        {
            colId: 'balance', // ID needed for refresh
            headerName: 'Balance',
            width: 100,
            valueGetter: (params: any) => {
                const planned = params.data.plannedQty || 0;
                // FIX: Use consumedQty from plan (per-activity) instead of boqItem (global)
                const prev = params.data.consumedQty || 0;
                // CRITICAL FIX: Use 'planId' to match InputCell logic
                const id = params.data.planId;
                // Access current 'Today' input from context
                const today = params.context.measurements[id] || 0;
                return (planned - prev - today);
            },
            valueFormatter: (p: any) => Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2 }),
            cellStyle: (params: any) => {
                return { color: params.value < 0 ? 'red' : 'green', fontWeight: 'bold' };
            }
        }
    ], []);

    // Stable Context
    const gridContext = useMemo(() => ({
        measurements,
        setMeasurements
    }), [measurements]);

    return (
        <div className="flex h-full flex-col bg-gray-50 text-sm">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            Site Execution
                        </h1>
                        <div className="flex items-center gap-1 mt-0.5">
                            <button
                                onClick={() => setActiveTab('entry')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'entry' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                Record Progress
                            </button>
                            <button
                                onClick={() => setActiveTab('labor')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'labor' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                Labor Allocation
                            </button>
                            <button
                                onClick={() => setActiveTab('log')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'log' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                Execution History
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-100 rounded-md px-3 py-1.5 border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all">
                        <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="bg-transparent border-none text-sm focus:ring-0 p-0 text-gray-700 font-medium w-32"
                        />
                    </div>
                </div>
                {activeTab === 'entry' && (
                    <button
                        onClick={handleSave}
                        disabled={Object.keys(measurements).length === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-white shadow-sm transition-all text-sm
                                ${Object.keys(measurements).length === 0
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 hover:shadow-md active:scale-95'}`}
                    >
                        <Save className="w-4 h-4" />
                        Save
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'log' ? (
                    <ExecutionLogTable projectId={Number(projectId)} />
                ) : (
                    /* 3-Pane Layout */
                    <div className="flex h-full overflow-hidden relative">

                        {/* Pane 1: Tree */}
                        <div
                            ref={treeRef}
                            style={{ width: showTree ? leftWidth : 0, minWidth: showTree ? 200 : 0 }}
                            className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden relative`}
                        >
                            <div className="p-2 border-b border-gray-100 flex flex-col bg-gray-50 flex-shrink-0 gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-2 overflow-hidden whitespace-nowrap">
                                        Location / WBS
                                    </span>
                                    <button onClick={() => setShowTree(false)} className="p-1 hover:bg-gray-200 rounded text-gray-500">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                </div>
                                <label className="flex items-center gap-2 px-2 pb-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={restrictToFloor}
                                        onChange={e => setRestrictToFloor(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span className="text-xs text-gray-600 font-medium">Restrict to Floor Level</span>
                                </label>
                            </div>
                            <div className="flex-1 overflow-auto p-2 scrollbar-thin">
                                <Tree
                                    data={epsTree}
                                    selectedIds={selectedEpsIds}
                                    cascadeSelection={true}
                                    onSelect={(ids) => {
                                        const numIds = ids.map(i => Number(i));
                                        setSelectedEpsIds(numIds);
                                    }}
                                />
                            </div>
                            {showTree && (
                                <div
                                    onMouseDown={startResizingTree}
                                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-10 opacity-0 hover:opacity-100 active:bg-blue-600 active:opacity-100 transition-opacity"
                                />
                            )}
                        </div>

                        {!showTree && (
                            <div className="border-r border-gray-200 bg-gray-50 flex flex-col items-center py-2 w-8 cursor-pointer hover:bg-gray-100 flex-shrink-0" onClick={() => setShowTree(true)}>
                                <Folder className="w-4 h-4 text-gray-400 mb-2" />
                                <div className="writing-vertical-lr text-xs text-gray-400 font-medium tracking-wide uppercase py-4">Locations</div>
                                <ChevronRight className="w-4 h-4 text-gray-400 mt-auto" />
                            </div>
                        )}

                        {/* Pane 2: List */}
                        <div
                            ref={listRef}
                            style={{ width: showList ? middleWidth : 0, minWidth: showList ? 250 : 0 }}
                            className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden relative`}
                        >
                            <div className="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50 h-10 flex-shrink-0">
                                <div className="flex items-center overflow-hidden flex-1">
                                    <Search className="w-3 h-3 text-gray-400 ml-1 mr-2 flex-shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="Search Activities..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="bg-transparent border-none text-xs focus:ring-0 p-0 text-gray-700 w-full"
                                    />
                                </div>
                                <button onClick={() => setShowList(false)} className="p-1 hover:bg-gray-200 rounded text-gray-500 flex-shrink-0">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto scrollbar-thin">
                                {loadingActivities ? (
                                    <div className="p-4 text-center text-gray-400 text-xs">Loading...</div>
                                ) : filteredActivities.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-xs">
                                        {selectedEpsIds.length > 0
                                            ? "No activities found for selected location(s)."
                                            : "Select a Block/Floor to view Activities."}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {filteredActivities.map(activity => (
                                            <div
                                                key={activity.id}
                                                onClick={() => setSelectedActivityId(activity.id)}
                                                className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 
                                            ${selectedActivityId === activity.id ? 'bg-blue-50 border-blue-600' : 'border-transparent hover:border-gray-300'}`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex flex-col gap-1 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-bold text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded font-mono shadow-sm">
                                                                {activity.activityCode}
                                                            </span>
                                                            <span className="text-[11px] font-extrabold text-blue-900 uppercase tracking-wide">
                                                                {activity.parentWbs || activity.wbsPath.split(' > ').pop()}
                                                            </span>
                                                        </div>
                                                        <span className="font-bold text-gray-900 text-sm leading-snug">
                                                            {activity.activityName}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleMarkComplete(e, activity.id, activity.status)}
                                                        className={`p-1.5 rounded-full transition-all ${activity.status === 'COMPLETED' || activity.finishDateActual ? 'text-green-600 bg-green-50 shadow-sm' : 'text-gray-300 hover:text-green-600 hover:bg-white'}`}
                                                        title={activity.status === 'COMPLETED' ? "Completed" : "Mark as Complete"}
                                                    >
                                                        {activity.status === 'COMPLETED' || activity.finishDateActual ? <CheckCircle className="w-5 h-5 fill-green-50" /> : <div className="w-5 h-5 rounded-full border-2 border-current hover:bg-green-50" />}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-end mt-2">
                                                    <div className="text-[9px] text-gray-400 truncate uppercase tracking-tighter max-w-[140px]" title={activity.wbsPath}>
                                                        {activity.wbsPath}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 italic">
                                                        {activity.plans.length} Resources
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="p-2 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-500 text-center truncate px-4 flex-shrink-0">
                                {selectedEpsIds.length > 0
                                    ? `Filtered by: ${selectedEpsIds.length} Location(s)`
                                    : 'Select a Block/Floor to view Activities'}
                            </div>

                            {showList && (
                                <div
                                    onMouseDown={startResizingList}
                                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-10 opacity-0 hover:opacity-100 active:bg-blue-600 active:opacity-100 transition-opacity"
                                />
                            )}
                        </div>

                        {!showList && (
                            <div className="border-r border-gray-200 bg-gray-50 flex flex-col items-center py-2 w-8 cursor-pointer hover:bg-gray-100 flex-shrink-0" onClick={() => setShowList(true)}>
                                <ActivityIcon className="w-4 h-4 text-gray-400 mb-2" />
                                <div className="writing-vertical-lr text-xs text-gray-400 font-medium tracking-wide uppercase py-4">Activities</div>
                                <ChevronRight className="w-4 h-4 text-gray-400 mt-auto" />
                            </div>
                        )}

                        {/* Pane 3: Grid */}
                        <div className="flex-1 overflow-hidden flex flex-col bg-white min-w-0">
                            {!selectedActivityId ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 m-4 border border-dashed border-gray-200 rounded-lg">
                                    <CheckCircle className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="text-sm">Select an Activity to view BOQ Items</p>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col h-full">
                                    <div className="px-4 py-2 border-b border-gray-200 bg-blue-50 flex justify-between items-center shadow-inner flex-shrink-0">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-sm">
                                                {activities.find(a => a.id === selectedActivityId)?.activityName}
                                            </h3>
                                            <div className="text-xs text-blue-600 flex gap-2">
                                                <span>Code: {activities.find(a => a.id === selectedActivityId)?.activityCode}</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500 text-right">
                                            Planned: {activities.find(a => a.id === selectedActivityId)?.startDatePlanned} <br />
                                            Finish: {activities.find(a => a.id === selectedActivityId)?.finishDatePlanned}
                                        </div>
                                    </div>

                                    {activeTab === 'entry' ? (
                                        <>
                                            <div className="flex-1 ag-theme-quartz w-full min-h-0">
                                                <AgGridReact
                                                    theme={themeQuartz}
                                                    context={gridContext}
                                                    rowData={gridData}
                                                    columnDefs={colDefs}
                                                    defaultColDef={{ resizable: true }}
                                                    rowHeight={40}
                                                    headerHeight={36}
                                                />
                                            </div>

                                            <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2 flex-shrink-0">
                                                <input
                                                    type="text"
                                                    placeholder="Remarks..."
                                                    className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                                    value={comment}
                                                    onChange={e => setComment(e.target.value)}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <ActivityLaborAllocation
                                            activityId={selectedActivityId}
                                            date={date}
                                            categories={laborCategories}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressEntry;
