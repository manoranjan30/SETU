import React, { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Edit2,
    Calendar,
    MapPin,
    Save,
    X,
    History
} from 'lucide-react';
import microScheduleService, {
    type MicroSchedule,
    type MicroScheduleActivity,
    MicroActivityStatus,
    type MicroQuantityLedger,
    type CreateMicroActivityDto
} from '../../services/micro-schedule.service';
import { type BoqItem, boqService } from '../../services/boq.service';
import { planningService } from '../../services/planning.service';
import DailyLogEntry from './DailyLogEntry';

interface MicroActivityBreakdownProps {
    scheduleId: number;
    projectId: number;
}

const MicroActivityBreakdown: React.FC<MicroActivityBreakdownProps> = ({
    scheduleId,
    projectId
}) => {
    const [schedule, setSchedule] = useState<MicroSchedule | null>(null);
    const [activities, setActivities] = useState<MicroScheduleActivity[]>([]);
    const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
    const [epsNodes, setEpsNodes] = useState<any[]>([]);
    const [ledgers, setLedgers] = useState<MicroQuantityLedger[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<MicroScheduleActivity | null>(null);
    const [formData, setFormData] = useState<Partial<CreateMicroActivityDto>>({
        microScheduleId: scheduleId,
        parentActivityId: 0,
        name: '',
        description: '',
        epsNodeId: 0,
        boqItemId: 0,
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

    const loadData = async () => {
        try {
            setLoading(true);
            const [sched, items, eps] = await Promise.all([
                microScheduleService.getMicroSchedule(scheduleId),
                boqService.getBoqItems(projectId),
                planningService.getWbsNodes(projectId),
            ]);

            setSchedule(sched);
            setActivities(sched.activities || []);
            setBoqItems(items);
            setEpsNodes(eps);

            // Get ledger for the parent activity
            if (sched.parentActivityId) {
                const l = await microScheduleService.getLedgerByActivity(sched.parentActivityId);
                setLedgers(l);
            }

            // Sync form dates with schedule if creating new
            if (!editingActivity) {
                setFormData(prev => ({
                    ...prev,
                    parentActivityId: sched.parentActivityId,
                    plannedStart: sched.plannedStart.split('T')[0],
                    plannedFinish: sched.plannedFinish.split('T')[0],
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
            if (editingActivity) {
                await microScheduleService.updateActivity(editingActivity.id, formData);
            } else {
                await microScheduleService.createActivity(formData as CreateMicroActivityDto);
            }
            setIsFormOpen(false);
            setEditingActivity(null);
            loadData();
        } catch (error) {
            console.error('Error saving activity:', error);
            alert('Failed to save activity. Check quantity allocation limits.');
        }
    };

    const onBoqChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = parseInt(e.target.value);
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
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location (WBS/EPS)</label>
                            <select
                                required
                                className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                value={formData.epsNodeId}
                                onChange={e => setFormData({ ...formData, epsNodeId: parseInt(e.target.value) })}
                            >
                                <option value="">Select Location...</option>
                                {epsNodes.map(node => (
                                    <option key={node.id} value={node.id}>{node.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">BOQ Item (Allocation)</label>
                            <select
                                required
                                className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                value={formData.boqItemId}
                                onChange={onBoqChange}
                            >
                                <option value="">Select BOQ Item...</option>
                                {boqItems.map(item => (
                                    <option key={item.id} value={item.id}>[{item.boqCode}] {item.description}</option>
                                ))}
                            </select>
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
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic">
                                        No micro activities defined. Start by adding one above.
                                    </td>
                                </tr>
                            ) : (
                                activities.map(activity => (
                                    <tr key={activity.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-gray-900">{activity.name}</div>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1 uppercase">
                                                <MapPin size={10} /> {activity.epsNode?.name || 'N/A'}
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
