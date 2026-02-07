import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Plus, Trash2, CheckCircle, Circle, PlayCircle } from 'lucide-react';
// clsx removed as unused

interface Activity {
    id: number;
    activityCode: string;
    activityName: string;
    activityType: 'TASK' | 'MILESTONE';
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    responsibleRoleId?: number;
    responsibleUserId?: number;
    createdOn: string;
}

interface ActivityListProps {
    projectId: number;
    wbsNodeId: number;
}

const ActivityList: React.FC<ActivityListProps> = ({ projectId, wbsNodeId }) => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // New Activity Form State
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<'TASK' | 'MILESTONE'>('TASK');

    useEffect(() => {
        if (wbsNodeId) fetchActivities();
    }, [wbsNodeId]);

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/projects/${projectId}/wbs/${wbsNodeId}/activities`);
            setActivities(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newCode || !newName) return;
        try {
            await api.post(`/projects/${projectId}/wbs/${wbsNodeId}/activities`, {
                activityCode: newCode,
                activityName: newName,
                activityType: newType
            });
            setIsAdding(false);
            setNewCode('');
            setNewName('');
            fetchActivities();
        } catch (err) {
            alert('Failed to create activity');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete activity?')) return;
        try {
            await api.delete(`/projects/${projectId}/wbs/activities/${id}`);
            fetchActivities();
        } catch (err) {
            alert('Failed to delete');
        }
    };

    // Status Icon Helper
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'IN_PROGRESS': return <PlayCircle className="w-4 h-4 text-blue-500" />;
            default: return <Circle className="w-4 h-4 text-gray-300" />;
        }
    };

    if (loading) return <div className="text-gray-500 text-sm">Loading activities...</div>;

    return (
        <div className="mt-4 border-t pt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700">Activities</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
                >
                    <Plus className="w-3 h-3 mr-1" /> Add Activity
                </button>
            </div>

            {isAdding && (
                <div className="bg-gray-50 p-3 rounded mb-4 border border-blue-100">
                    <div className="grid grid-cols-12 gap-2 text-sm">
                        <div className="col-span-2">
                            <input
                                placeholder="Code (A100)"
                                className="w-full border rounded px-2 py-1"
                                value={newCode}
                                onChange={e => setNewCode(e.target.value)}
                            />
                        </div>
                        <div className="col-span-6">
                            <input
                                placeholder="Activity Name"
                                className="w-full border rounded px-2 py-1"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                            />
                        </div>
                        <div className="col-span-3">
                            <select
                                className="w-full border rounded px-2 py-1"
                                value={newType}
                                onChange={e => setNewType(e.target.value as any)}
                            >
                                <option value="TASK">Task</option>
                                <option value="MILESTONE">Milestone</option>
                            </select>
                        </div>
                        <div className="col-span-1 flex items-center">
                            <button
                                onClick={handleCreate}
                                className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 w-full flex justify-center"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {activities.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No activities added yet.</p>
                ) : (
                    activities.map(act => (
                        <div key={act.id} className="flex items-center justify-between border border-gray-100 p-2 rounded hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                {getStatusIcon(act.status)}
                                <span className="font-mono text-xs bg-gray-100 px-1 rounded text-gray-600">
                                    {act.activityCode}
                                </span>
                                <span className="text-sm text-gray-700 font-medium">
                                    {act.activityName}
                                </span>
                                {act.activityType === 'MILESTONE' && (
                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded uppercase font-bold">
                                        Milestone
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleDelete(act.id)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ActivityList;
