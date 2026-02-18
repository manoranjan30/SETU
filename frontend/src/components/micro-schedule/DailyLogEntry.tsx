import React, { useState, useEffect } from 'react';
import {
    Calendar,
    HardHat,
    Clock,
    AlertTriangle,
    MessageSquare,
    Save
} from 'lucide-react';
import microScheduleService, {
    type MicroScheduleActivity,
    type DelayReason,
    type CreateDailyLogDto
} from '../../services/micro-schedule.service';
import Modal from '../common/Modal';

interface DailyLogEntryProps {
    isOpen: boolean;
    onClose: () => void;
    activity: MicroScheduleActivity;
    onSuccess: () => void;
}

const DailyLogEntry: React.FC<DailyLogEntryProps> = ({
    isOpen,
    onClose,
    activity,
    onSuccess
}) => {
    const [delayReasons, setDelayReasons] = useState<DelayReason[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CreateDailyLogDto>({
        microActivityId: activity.id,
        logDate: new Date().toISOString().split('T')[0],
        qtyDone: 0,
        manpowerCount: 0,
        equipmentHours: 0,
        delayReasonId: undefined,
        remarks: '',
    });

    useEffect(() => {
        if (isOpen) {
            fetchDelayReasons();
            setFormData(prev => ({
                ...prev,
                microActivityId: activity.id,
                logDate: new Date().toISOString().split('T')[0],
            }));
        }
    }, [isOpen, activity]);

    const fetchDelayReasons = async () => {
        try {
            const data = await microScheduleService.getDelayReasons();
            setDelayReasons(data);
        } catch (error) {
            console.error('Error fetching delay reasons:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await microScheduleService.createDailyLog(formData);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving daily log:', error);
            alert('Failed to save log. Ensure quantity does not exceed allocated balance.');
        } finally {
            setLoading(false);
        }
    };

    const remainingQty = activity.allocatedQty - (activity.progressPercent * activity.allocatedQty / 100);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Log Daily Progress: ${activity.name}`}
            size="medium"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Reference Info */}
                <div className="bg-blue-50 p-3 rounded-md flex justify-between items-center border border-blue-100 mb-4">
                    <div>
                        <div className="text-[10px] text-blue-400 font-bold uppercase">Allocated Quantity</div>
                        <div className="text-lg font-bold text-blue-900">{activity.allocatedQty.toLocaleString()} {activity.uom}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-blue-400 font-bold uppercase">Est. Remaining</div>
                        <div className="text-lg font-bold text-gray-700">{Math.max(0, remainingQty).toLocaleString()} {activity.uom}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <Calendar size={12} /> Log Date
                        </label>
                        <input
                            type="date"
                            required
                            className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500 shadow-sm"
                            value={formData.logDate}
                            onChange={e => setFormData({ ...formData, logDate: e.target.value })}
                        />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1 text-blue-600">
                            Quantity Done
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="0.001"
                                required
                                className="w-full px-3 py-2 border-2 border-blue-200 rounded focus:ring-1 focus:ring-blue-500 font-bold text-blue-700"
                                value={formData.qtyDone}
                                onChange={e => setFormData({ ...formData, qtyDone: parseFloat(e.target.value) })}
                                autoFocus
                            />
                            <span className="flex items-center px-3 bg-gray-100 border rounded text-xs text-gray-500 font-bold">{activity.uom}</span>
                        </div>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <HardHat size={12} /> Manpower Count
                        </label>
                        <input
                            type="number"
                            className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500"
                            value={formData.manpowerCount}
                            onChange={e => setFormData({ ...formData, manpowerCount: parseInt(e.target.value) || 0 })}
                        />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <Clock size={12} /> Equipment Hours
                        </label>
                        <input
                            type="number"
                            step="0.5"
                            className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500"
                            value={formData.equipmentHours}
                            onChange={e => setFormData({ ...formData, equipmentHours: parseFloat(e.target.value) || 0 })}
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <AlertTriangle size={12} /> Delay Reason (If any)
                        </label>
                        <select
                            className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500 bg-white"
                            value={formData.delayReasonId || ''}
                            onChange={e => setFormData({ ...formData, delayReasonId: e.target.value ? parseInt(e.target.value) : undefined })}
                        >
                            <option value="">No Delay</option>
                            {delayReasons.map(reason => (
                                <option key={reason.id} value={reason.id}>{reason.name} ({reason.category})</option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <MessageSquare size={12} /> Remarks
                        </label>
                        <textarea
                            className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-blue-500"
                            rows={2}
                            placeholder="Add any site notes..."
                            value={formData.remarks}
                            onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={16} />}
                        Save Log Entry
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default DailyLogEntry;
