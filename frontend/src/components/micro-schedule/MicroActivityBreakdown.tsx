import React, { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Edit2,
    Calendar,
    MapPin,
    Save,
    X,
    History,
    ChevronRight,
} from 'lucide-react';
import microScheduleService, {
    type MicroSchedule,
    type MicroScheduleActivity,
    MicroActivityStatus,
    type MicroQuantityLedger,
    type CreateMicroActivityDto
} from '../../services/micro-schedule.service';
import { type BoqItem } from '../../services/boq.service';
import { planningService } from '../../services/planning.service';


import DailyLogEntry from './DailyLogEntry';

interface MicroActivityBreakdownProps {
    scheduleId: number;
    projectId: number;
}

const MicroActivityBreakdown: React.FC<MicroActivityBreakdownProps> = ({
    scheduleId
}) => {
    const [schedule, setSchedule] = useState<MicroSchedule | null>(null);
    const [activities, setActivities] = useState<MicroScheduleActivity[]>([]);
    const [boqItems, setBoqItems] = useState<BoqItem[]>([]);

    const [ledgers, setLedgers] = useState<MicroQuantityLedger[]>([]);
    const [loading, setLoading] = useState(true);
    const [mappingError, setMappingError] = useState<string | null>(null);
    const [linkedEpsNode, setLinkedEpsNode] = useState<any>(null);
    const [linkedEpsPath, setLinkedEpsPath] = useState<any[]>([]);

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<MicroScheduleActivity | null>(null);
    const [formData, setFormData] = useState<Partial<CreateMicroActivityDto>>({
        microScheduleId: scheduleId,
        parentActivityId: 0,
        name: '',
        description: '',
        epsNodeId: undefined,
        boqItemId: undefined,
        workOrderId: undefined,
        allocatedQty: 0,
        uom: '',
        plannedStart: '',
        plannedFinish: '',
        status: MicroActivityStatus.PLANNED,
    });

    // Modal state
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [selectedActivityForLog, setSelectedActivityForLog] = useState<MicroScheduleActivity | null>(null);

    useEffect(() => {
        loadData();
    }, [scheduleId]);

    // Helper to find node and build path
    const findNodePath = (nodes: any[], targetId: number, currentPath: any[] = []): { node: any, path: any[] } | null => {
        for (const node of nodes) {
            if (Number(node.id) === Number(targetId)) {
                return { node, path: currentPath };
            }
            if (node.children?.length) {
                const found = findNodePath(node.children, targetId, [...currentPath, node]);
                if (found) return found;
            }
        }
        return null;
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const sched = await microScheduleService.getMicroSchedule(scheduleId);

            // Fetch EPS Tree & Matrix to find matching location node
            let epsTree: any[] = [];
            let distributionMatrix: Record<string, number[]> = {};

            try {
                if (sched.projectId) {
                    const matrixProjectId = (sched.parentActivity as any)?.masterActivity?.projectId || sched.projectId;
                    console.log(`🔍 [MicroActivity] Loading mapping matrix for Project ID: ${matrixProjectId} (Current: ${sched.projectId})`);

                    const [tree, matrix] = await Promise.all([
                        planningService.getProjectEps(sched.projectId),
                        planningService.getDistributionMatrix(matrixProjectId)
                    ]);
                    epsTree = tree;
                    distributionMatrix = matrix;
                }
            } catch (err) {
                console.warn("Failed to load EPS tree or Matrix", err);
            }

            setSchedule(sched);
            setActivities(sched.activities || []);

            // Get ledger for the parent activity and filter BOQ items
            if (sched.parentActivityId) {
                const l = await microScheduleService.getLedgerByActivity(sched.parentActivityId);
                setLedgers(l);

                // Extract BOQ items from ledger (only show items assigned to parent activity)
                const availableBoqItems = l
                    .map(ledger => ledger.boqItem)
                    .filter(item => item != null);

                setBoqItems(availableBoqItems);
            } else {
                setBoqItems([]);
                setLedgers([]);
            }

            // Sync form dates with schedule if creating new
            if (!editingActivity) {
                // 1. Determine Target EPS ID
                // Priority 1: Check Distribution Matrix for explicit mapping
                const masterId = sched.parentActivity?.masterActivityId || sched.parentActivity?.id;
                const mappedLocations = distributionMatrix[masterId] || [];

                // If mapped, use the first mapped location (assuming 1:1 context for Micro Schedule)
                // Fallback to Project ID if no mapping found
                let targetEpsId = mappedLocations.length > 0 ? mappedLocations[0] : (sched.parentActivity?.projectId || sched.projectId);

                console.log(`🎯 [MicroActivity] Resolved Target EPS ID: ${targetEpsId} (Source: ${mappedLocations.length > 0 ? 'Matrix' : 'Project'})`);

                // 2. Resolve Node and Path from Tree
                const result = findNodePath(epsTree, Number(targetEpsId));

                if (result) {
                    setLinkedEpsNode(result.node);
                    // Store path for display (excluding the node itself which is in linkedEpsNode)
                    // We can store it in a new state variable or just use it here if we refactor state.
                    // For now, let's add a state for path: linkedEpsPath
                    setLinkedEpsPath(result.path);
                    setMappingError(null);
                } else {
                    console.warn(`⚠️ [MicroActivity] EPS Node ${targetEpsId} not found in tree.`);
                    setLinkedEpsNode(null);
                    setLinkedEpsPath([]);

                    if (mappedLocations.length > 0) {
                        // Mapped but not found in current tree context? Warning.
                        // Maybe the tree we fetched is for Parent Project, but mapping points elsewhere?
                    } else {
                        // Not mapped error
                        const errMsg = 'This activity is not mapped with any eps structure in the schedule mapper.';
                        setMappingError(errMsg);
                    }
                }

                setFormData(prev => ({
                    ...prev,
                    parentActivityId: sched.parentActivityId,
                    plannedStart: sched.plannedStart.split('T')[0],
                    plannedFinish: sched.plannedFinish.split('T')[0],
                    epsNodeId: Number(targetEpsId)
                }));
            }
        } catch (error) {
            console.error('Error loading breakdown data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (activity: MicroScheduleActivity) => {
        setEditingActivity(activity);
        setFormData({
            microScheduleId: scheduleId,
            parentActivityId: activity.parentActivityId,
            name: activity.name,
            description: activity.description,
            epsNodeId: activity.epsNodeId,
            boqItemId: activity.boqItemId,
            allocatedQty: activity.allocatedQty,
            uom: activity.uom,
            plannedStart: activity.plannedStart.split('T')[0],
            plannedFinish: activity.plannedFinish.split('T')[0],
            status: activity.status,
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this activity?')) return;
        try {
            await microScheduleService.deleteActivity(id);
            loadData();
        } catch (error) {
            console.error('Error deleting activity:', error);
            alert('Failed to delete activity');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Sanitize data before sending - ensure required fields have valid values
            const dataToSend = {
                ...formData,
                microScheduleId: scheduleId,
                parentActivityId: schedule?.parentActivityId || 0,
                epsNodeId: formData.epsNodeId || 0,
                boqItemId: formData.boqItemId,
                allocatedQty: formData.allocatedQty || 0,
            };

            console.log('📤 [MicroActivity] Submitting data:', dataToSend);

            if (editingActivity) {
                await microScheduleService.updateActivity(editingActivity.id, dataToSend);
            } else {
                await microScheduleService.createActivity(dataToSend as CreateMicroActivityDto);
            }
            setIsFormOpen(false);
            setEditingActivity(null);
            loadData();
        } catch (error: any) {
            console.error('Error saving activity:', error);
            console.error('Error details:', error.response?.data);
            const errorMsg = error.response?.data?.message || 'Failed to save activity. Check quantity allocation limits.';
            alert(errorMsg);
        }
    };

    const onBoqChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (!value) {
            setFormData(prev => ({
                ...prev,
                boqItemId: undefined,
                uom: '',
                allocatedQty: 0
            }));
            return;
        }

        const id = parseInt(value);
        const item = boqItems.find(b => b.id === id);
        const ledger = ledgers.find(l => l.boqItemId === id);

        setFormData(prev => ({
            ...prev,
            boqItemId: id,
            uom: item?.uom || '',
            // Maybe default quantity to remaining?
            allocatedQty: ledger ? ledger.balanceQty : (item?.qty || 0)
        }));
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading breakdown...</div>;

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Summary Header */}
            <div className="bg-gray-50 p-4 border-b flex justify-between items-start">
                <div className="flex gap-4">
                    <div className="bg-white p-3 border rounded shadow-sm text-center min-w-[100px]">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Allocated</div>
                        <div className="text-xl font-bold text-gray-900">{schedule?.totalAllocatedQty.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-3 border rounded shadow-sm text-center min-w-[100px]">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Actual Done</div>
                        <div className="text-xl font-bold text-blue-600">{schedule?.totalActualQty.toLocaleString()}</div>
                    </div>
                </div>

                <div className="w-1/3">
                    <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                        <span>Overall Progress</span>
                        <span>{schedule ? (schedule.totalAllocatedQty > 0 ? Math.round((schedule.totalActualQty / schedule.totalAllocatedQty) * 100) : 0) : 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${schedule ? (schedule.totalAllocatedQty > 0 ? Math.min(100, (schedule.totalActualQty / schedule.totalAllocatedQty) * 100) : 0) : 0}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="px-4 py-3 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-tight">Micro Activities</h3>
                {!isFormOpen && (
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                    >
                        <Plus size={16} /> Add Activity
                    </button>
                )}
            </div>

            {/* Add Activity Form */}
            {isFormOpen && (
                <div className="mx-4 mb-4 p-4 border rounded-lg bg-white shadow-md border-blue-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                            {editingActivity ? <Edit2 size={16} /> : <Plus size={16} />}
                            {editingActivity ? 'Edit Activity' : 'Create New Micro Activity'}
                        </h4>
                        <button onClick={() => { setIsFormOpen(false); setEditingActivity(null); }} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Activity Name</label>
                            <input
                                required
                                type="text"
                                className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                placeholder="e.g., Rebar Fixing - First Half"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location (EPS)</label>

                            {mappingError ? (
                                <div className="w-full px-3 py-2 border border-red-200 bg-red-50 rounded text-sm text-red-600 flex items-center gap-2">
                                    <X size={14} />
                                    {mappingError}
                                </div>
                            ) : linkedEpsNode ? (
                                <div className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded text-sm text-blue-900 flex items-center gap-3 font-medium shadow-sm">
                                    <div className="p-1.5 bg-blue-600 rounded-lg text-white">
                                        <MapPin size={14} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold leading-tight">{linkedEpsNode.name || linkedEpsNode.label}</span>
                                        {/* Show Detailed EPS Path (Project > Tower > Floor) */}
                                        {linkedEpsPath.length > 0 && (
                                            <span className="text-xs text-blue-800 mt-0.5 font-normal flex items-center gap-1 flex-wrap">
                                                <span className="opacity-70">Path:</span>
                                                {linkedEpsPath.map((pathNode, idx) => (
                                                    <React.Fragment key={pathNode.id}>
                                                        <span className={idx === 0 ? "font-bold" : "font-medium"}>
                                                            {pathNode.name || pathNode.label}
                                                        </span>
                                                        <ChevronRight size={10} className="text-blue-400" />
                                                    </React.Fragment>
                                                ))}
                                                <span className="font-bold border-b border-blue-300">
                                                    {linkedEpsNode.name || linkedEpsNode.label}
                                                </span>
                                            </span>
                                        )}
                                        <span className="text-[10px] text-blue-500 uppercase font-bold tracking-tight mt-0.5">Enterprise Project Structure (Mapped)</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {schedule?.parentActivity?.wbsNode ? (
                                        <div className="w-full px-3 py-2 border bg-gray-50 rounded text-sm text-gray-700 flex items-center gap-2">
                                            <MapPin size={14} className="text-gray-400" />
                                            {/* Show Hierarchy: Floor > Work Package */}
                                            {schedule.parentActivity.wbsNode.parent ? (
                                                <span>
                                                    <span className="font-semibold">{schedule.parentActivity.wbsNode.parent.name || schedule.parentActivity.wbsNode.parent.wbsName}</span>
                                                    <span className="text-gray-400 mx-1">›</span>
                                                    <span className="text-gray-500">{schedule.parentActivity.wbsNode.name || schedule.parentActivity.wbsNode.wbsName}</span>
                                                </span>
                                            ) : (
                                                schedule.parentActivity.wbsNode.name || schedule.parentActivity.wbsNode.wbsName || 'Unknown Location'
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-full px-3 py-2 border border-red-200 bg-red-50 rounded text-sm text-red-600 flex items-center gap-2">
                                            <X size={14} />
                                            Warning: The activity is not assigned with any eps structure
                                        </div>
                                    )}
                                </>
                            )}
                        </div>


                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                BOQ Item (Quantity Tracking) <span className="text-red-500">*</span>
                            </label>
                            {boqItems.length === 0 ? (
                                <div className="w-full px-3 py-2 border border-orange-300 bg-orange-50 rounded text-sm text-orange-700">
                                    ⚠️ Activity is not assigned with any BOQ or quantity.
                                </div>
                            ) : (
                                <>
                                    <select
                                        required
                                        className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                        value={formData.boqItemId || ''}
                                        onChange={onBoqChange}
                                    >
                                        <option value="">Select BOQ Item...</option>
                                        {boqItems.map(item => {
                                            // Find the ledger entry for this BOQ item to show available quantity
                                            const ledgerEntry = ledgers.find(l => l.boqItemId === item.id);
                                            const availableQty = ledgerEntry ? ledgerEntry.balanceQty : item.qty;
                                            const uom = ledgerEntry ? ledgerEntry.uom : (item.uom || '');

                                            return (
                                                <option key={item.id} value={item.id}>
                                                    [{item.boqCode}] {item.description} - {availableQty.toLocaleString()} {uom} available
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        ⚠️ BOQ item is mandatory for quantity allocation and progress tracking
                                    </p>
                                </>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity to Allocate</label>
                            <div className="flex gap-2">
                                <input
                                    name="allocatedQty"
                                    type="number"
                                    step="0.001"
                                    required
                                    className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                    value={formData.allocatedQty}
                                    onChange={e => setFormData({ ...formData, allocatedQty: parseFloat(e.target.value) })}
                                />
                                <span className="flex items-center px-3 bg-gray-100 border rounded text-xs text-gray-500 font-bold">{formData.uom || '-'}</span>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                    value={formData.plannedStart}
                                    onChange={e => setFormData({ ...formData, plannedStart: e.target.value })}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Finish Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                    value={formData.plannedFinish}
                                    onChange={e => setFormData({ ...formData, plannedFinish: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => { setIsFormOpen(false); setEditingActivity(null); }}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700"
                            >
                                <Save size={16} /> {editingActivity ? 'Update Activity' : 'Add Activity'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-auto px-4 pb-4">
                <div className="border rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="px-4 py-3 border-b">Activity / Location</th>
                                <th className="px-4 py-3 border-b">BOQ Item</th>
                                <th className="px-4 py-3 border-b text-center">Allocated Qty</th>
                                <th className="px-4 py-3 border-b">Dates</th>
                                <th className="px-4 py-3 border-b text-center">Progress</th>
                                <th className="px-4 py-3 border-b text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {activities.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                                <Plus size={32} className="text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="text-gray-600 font-medium">No activities created yet</p>
                                                <p className="text-sm text-gray-400 mt-1">
                                                    Click "Create New Micro Activity" above to break down this schedule into trackable activities
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                activities.map(activity => (
                                    <tr key={activity.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-gray-900">{activity.name}</div>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1 uppercase">
                                                <MapPin size={10} /> {activity.epsNode ? activity.epsNode.name : 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {activity.boqItem ? (
                                                <>
                                                    <div className="text-gray-700 font-medium">[{activity.boqItem.boqCode}]</div>
                                                    <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{activity.boqItem.description}</div>
                                                </>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="font-bold text-gray-900">{activity.allocatedQty.toLocaleString()}</div>
                                            <div className="text-[10px] text-gray-400 uppercase font-bold">{activity.uom}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <Calendar size={12} className="text-gray-300" />
                                                    <span className="text-gray-600">{new Date(activity.plannedStart).toLocaleDateString()} - {new Date(activity.plannedFinish).toLocaleDateString()}</span>
                                                </div>
                                                {activity.forecastFinish && (
                                                    <div className="flex items-center gap-2 text-[10px] text-orange-600 font-bold ml-5">
                                                        Forecast: {new Date(activity.forecastFinish).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 bg-gray-200 rounded-full h-1.5 mb-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${activity.progressPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${activity.progressPercent}%` }}
                                                    ></div>
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-700">{Math.round(activity.progressPercent)}%</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => handleEdit(activity)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Edit Activity"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                                    title="Daily Logs"
                                                    onClick={() => {
                                                        setSelectedActivityForLog(activity);
                                                        setIsLogModalOpen(true);
                                                    }}
                                                >
                                                    <History size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(activity.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete Activity"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Daily Log Modal */}
            {selectedActivityForLog && (
                <DailyLogEntry
                    isOpen={isLogModalOpen}
                    onClose={() => {
                        setIsLogModalOpen(false);
                        setSelectedActivityForLog(null);
                    }}
                    activity={selectedActivityForLog}
                    onSuccess={() => {
                        loadData();
                    }}
                />
            )}
        </div>
    );
};

export default MicroActivityBreakdown;
