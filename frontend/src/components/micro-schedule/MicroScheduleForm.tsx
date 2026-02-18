import React, { useState, useEffect } from 'react';
import planningService, { type PlanningActivity } from '../../services/planning.service';
import microScheduleService, { type CreateMicroScheduleDto, type MicroSchedule } from '../../services/micro-schedule.service';
import { Save, RefreshCw } from 'lucide-react';
import WbsActivityTreeSelector from './WbsActivityTreeSelector';

interface MicroScheduleFormProps {
    projectId: number;
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: MicroSchedule | null;
}

const MicroScheduleForm: React.FC<MicroScheduleFormProps> = ({
    projectId,
    onSuccess,
    onCancel,
    initialData
}) => {
    const [activities, setActivities] = useState<PlanningActivity[]>([]);
    const [wbsNodes, setWbsNodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<CreateMicroScheduleDto>>({
        projectId,
        name: '',
        description: '',
        parentActivityId: undefined, // Optional/Nullable
        linkedActivityIds: [],
        baselineStart: '',
        baselineFinish: '',
        plannedStart: '',
        plannedFinish: '',
    });

    useEffect(() => {
        if (projectId) {
            fetchActivities();
        }
    }, [projectId]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                projectId: initialData.projectId,
                name: initialData.name,
                description: initialData.description,
                parentActivityId: initialData.parentActivityId,
                linkedActivityIds: initialData.activities?.map(a => a.parentActivityId) || [],
                baselineStart: initialData.baselineStart ? initialData.baselineStart.split('T')[0] : '',
                baselineFinish: initialData.baselineFinish ? initialData.baselineFinish.split('T')[0] : '',
                plannedStart: initialData.plannedStart ? initialData.plannedStart.split('T')[0] : '',
                plannedFinish: initialData.plannedFinish ? initialData.plannedFinish.split('T')[0] : '',
            });
        }
    }, [initialData]);

    const fetchActivities = async () => {
        try {
            setLoadingActivities(true);
            setError(null);

            // Parallel Fetch
            const [acts, nodes] = await Promise.all([
                planningService.getProjectActivities(projectId),
                planningService.getWbsNodes(projectId)
            ]);

            setActivities(acts || []);
            setWbsNodes(nodes || []);
        } catch (error) {
            console.error('Error fetching planning data:', error);
            setError('Failed to load schedule data.');
        } finally {
            setLoadingActivities(false);
        }
    };

    const handleSelectionChange = (ids: number[]) => {
        // Filter activities to get selected objects
        const selected = activities.filter(a => ids.includes(a.id));

        // Auto-calculate logic
        let name = formData.name;
        let pStart = formData.plannedStart;
        let pFinish = formData.plannedFinish;
        let bStart = formData.baselineStart;
        let bFinish = formData.baselineFinish;

        if (selected.length > 0) {
            // Calculate Min Start and Max Finish
            const starts = selected
                .map(a => a.startDatePlanned ? String(a.startDatePlanned).split('T')[0] : '')
                .filter(d => d)
                .sort();

            const finishes = selected
                .map(a => a.finishDatePlanned ? String(a.finishDatePlanned).split('T')[0] : '')
                .filter(d => d)
                .sort();

            const minStart = starts[0] || '';
            const maxFinish = finishes[finishes.length - 1] || '';

            // Only auto-fill if empty or logic dictates (e.g. override on new selection?)
            // Let's override if it's a new create (no initialData)
            if (!initialData) {
                pStart = minStart;
                pFinish = maxFinish;
                bStart = minStart;
                bFinish = maxFinish;

                if (selected.length === 1 && !name) {
                    name = selected[0].activityName;
                } else if (selected.length > 1 && (!name || name === selected[0].activityName)) {
                    // If name was default single, update to multi? 
                    // Or just leave it. User can type.
                }
            }
        }

        setFormData(prev => ({
            ...prev,
            parentActivityId: ids.length === 1 ? ids[0] : undefined,
            linkedActivityIds: ids,
            name,
            plannedStart: pStart,
            plannedFinish: pFinish,
            baselineStart: bStart,
            baselineFinish: bFinish,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            const dto = formData as CreateMicroScheduleDto;

            if (initialData) {
                await microScheduleService.updateMicroSchedule(initialData.id, formData);
            } else {
                await microScheduleService.createMicroSchedule(dto);
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving micro schedule:', error);
            alert('Failed to save micro schedule. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Name</label>
                    <input
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., First Floor Slab Lookahead"
                    />
                </div>

                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        rows={2}
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe the scope..."
                    />
                </div>

                {/* Tree Selector */}
                <div className="col-span-2">
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">Select Master Activities (Scope)</label>
                        <button
                            type="button"
                            onClick={fetchActivities}
                            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                            disabled={loadingActivities}
                        >
                            <RefreshCw size={12} className={loadingActivities ? 'animate-spin' : ''} />
                            Refresh Schedule
                        </button>
                    </div>

                    {loadingActivities ? (
                        <div className="h-32 flex items-center justify-center border rounded bg-gray-50 text-gray-400 text-sm">
                            Loading Schedule Structure...
                        </div>
                    ) : error ? (
                        <div className="h-24 flex items-center justify-center border rounded bg-red-50 text-red-500 text-sm">
                            {error}
                        </div>
                    ) : (
                        <WbsActivityTreeSelector
                            wbsNodes={wbsNodes}
                            activities={activities}
                            selectedIds={formData.linkedActivityIds || (formData.parentActivityId ? [formData.parentActivityId] : [])}
                            onSelectionChange={handleSelectionChange}
                        />
                    )}
                    {activities.length === 0 && !loadingActivities && !error && (
                        <p className="text-xs text-orange-500 mt-1">No activities found in Master Project.</p>
                    )}
                </div>

                {/* Dates Section */}
                <div className="border p-4 rounded-md bg-gray-50">
                    <h3 className="text-xs font-bold text-gray-500 mb-3 border-b pb-1 uppercase tracking-wider">Baseline Reference (From Master)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-500 cursor-not-allowed"
                                value={formData.baselineStart}
                                readOnly
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Finish Date</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-500 cursor-not-allowed"
                                value={formData.baselineFinish}
                                readOnly
                            />
                        </div>
                    </div>
                </div>

                <div className="border p-4 rounded-md bg-blue-50 border-blue-100">
                    <h3 className="text-xs font-bold text-blue-800 mb-3 border-b border-blue-200 pb-1 uppercase tracking-wider">Planned Working Window</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-blue-600 mb-1">Start Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                value={formData.plannedStart}
                                onChange={e => setFormData({ ...formData, plannedStart: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-blue-600 mb-1">Finish Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                value={formData.plannedFinish}
                                onChange={e => setFormData({ ...formData, plannedFinish: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={18} />}
                    {initialData ? 'Update Schedule' : 'Create Schedule'}
                </button>
            </div>
        </form>
    );
};

export default MicroScheduleForm;
