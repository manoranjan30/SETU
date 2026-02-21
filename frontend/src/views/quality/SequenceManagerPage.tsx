import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical, Plus, Edit2, Trash2, Check,
    ArrowLeft, AlertCircle, ShieldAlert, Eye, Scissors,
    Save, ChevronRight, List, Network
} from 'lucide-react';
import api from '../../api/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
    id: number;
    sequence: number;
    activityName: string;
    description: string;
    previousActivityId: number | null;
    incomingEdges?: { sourceId: number; source: Partial<Activity> }[];
    predecessorIds?: number[];
    holdPoint: boolean;
    witnessPoint: boolean;
    responsibleParty: string;
    allowBreak: boolean;
    status: string;
}

interface ActivityList {
    id: number;
    name: string;
    description: string;
    epsNode?: { nodeName: string };
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

const SortableRow = ({
    activity,
    index,
    allActivities,
    onEdit,
    onDelete,
    onToggle,
}: {
    activity: Activity;
    index: number;
    allActivities: Activity[];
    onEdit: (a: Activity) => void;
    onDelete: (id: number) => void;
    onToggle: (id: number, field: 'holdPoint' | 'witnessPoint' | 'allowBreak', val: boolean) => void;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    const predecessors = activity.incomingEdges?.length
        ? activity.incomingEdges.map(e => allActivities.find(a => a.id === e.sourceId)).filter(Boolean)
        : activity.previousActivityId
            ? [allActivities.find(a => a.id === activity.previousActivityId)].filter(Boolean)
            : [];

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-start gap-3 p-4 bg-white rounded-xl border transition-all ${isDragging ? 'shadow-2xl border-indigo-300' : 'border-gray-200 hover:border-indigo-200 hover:shadow-sm'}`}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="mt-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
            >
                <GripVertical className="w-5 h-5" />
            </div>

            {/* Sequence Badge */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center mt-0.5">
                {index + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h4 className="font-semibold text-gray-800 truncate">{activity.activityName}</h4>
                        {activity.description && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.description}</p>
                        )}
                        {/* Predecessors */}
                        {predecessors.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                                <span className="text-gray-400 font-medium">After:</span>
                                {predecessors.map(p => (
                                    <span key={p!.id} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-semibold">
                                        <ChevronRight className="w-3 h-3 text-indigo-400" />
                                        {p!.activityName}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Responsible Party */}
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${activity.responsibleParty === 'Consultant' ? 'bg-blue-100 text-blue-700' :
                        activity.responsibleParty === 'Client' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-600'
                        }`}>
                        {activity.responsibleParty}
                    </span>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    {/* Hold Point */}
                    <button
                        onClick={() => onToggle(activity.id, 'holdPoint', !activity.holdPoint)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${activity.holdPoint
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-gray-100 text-gray-400 border border-gray-200 hover:border-red-200 hover:text-red-500'
                            }`}
                        title="Hold Point — mandatory inspection gate"
                    >
                        <ShieldAlert className="w-3 h-3" />
                        Hold Point
                        {activity.holdPoint ? <Check className="w-3 h-3" /> : null}
                    </button>

                    {/* Witness Point */}
                    <button
                        onClick={() => onToggle(activity.id, 'witnessPoint', !activity.witnessPoint)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${activity.witnessPoint
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-gray-100 text-gray-400 border border-gray-200 hover:border-amber-200 hover:text-amber-500'
                            }`}
                        title="Witness Point — optional witness required"
                    >
                        <Eye className="w-3 h-3" />
                        Witness Point
                        {activity.witnessPoint ? <Check className="w-3 h-3" /> : null}
                    </button>

                    {/* Allow Break */}
                    <button
                        onClick={() => onToggle(activity.id, 'allowBreak', !activity.allowBreak)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${activity.allowBreak
                            ? 'bg-orange-100 text-orange-700 border border-orange-200'
                            : 'bg-gray-100 text-gray-400 border border-gray-200 hover:border-orange-200 hover:text-orange-500'
                            }`}
                        title="Allow Break — RFI can be raised even if predecessor is not approved"
                    >
                        <Scissors className="w-3 h-3" />
                        Allow Break
                        {activity.allowBreak ? <Check className="w-3 h-3" /> : null}
                    </button>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                <button
                    onClick={() => onEdit(activity)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    title="Edit"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(activity.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// ─── Activity Form (inline modal) ─────────────────────────────────────────────

const ActivityForm = ({
    initial,
    allActivities,
    onSave,
    onCancel,
}: {
    initial?: Activity;
    allActivities: Activity[];
    onSave: (data: Partial<Activity>) => Promise<void>;
    onCancel: () => void;
}) => {
    const [form, setForm] = useState({
        activityName: initial?.activityName || '',
        description: initial?.description || '',
        previousActivityId: initial?.previousActivityId || null as number | null,
        predecessorIds: initial?.incomingEdges?.map(e => e.sourceId) || (initial?.previousActivityId ? [initial.previousActivityId] : []),
        holdPoint: initial?.holdPoint || false,
        witnessPoint: initial?.witnessPoint || false,
        responsibleParty: initial?.responsibleParty || 'Contractor',
        allowBreak: initial?.allowBreak || false,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

    const handleSave = async () => {
        if (!form.activityName.trim()) { setError('Activity name is required'); return; }
        setSaving(true);
        try {
            await onSave(form);
        } catch {
            setError('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-indigo-800 text-sm">{initial ? 'Edit Activity' : 'Add New Activity'}</h4>
            {error && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 p-2 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                </div>
            )}
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Activity Name *</label>
                    <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                        placeholder="e.g. Reinforcement Inspection"
                        value={form.activityName}
                        onChange={e => set('activityName', e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                    <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                        placeholder="Optional description..."
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Responsible Party</label>
                    <select
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                        value={form.responsibleParty}
                        onChange={e => set('responsibleParty', e.target.value)}
                    >
                        <option>Contractor</option>
                        <option>Consultant</option>
                        <option>Client</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block uppercase tracking-wider">Predecessor Activities (Select Multiple)</label>
                    <div className="border border-gray-200 rounded-lg p-3 bg-white max-h-40 overflow-y-auto space-y-2">
                        {allActivities
                            .filter(a => a.id !== initial?.id)
                            .map(a => (
                                <label key={a.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors group">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 w-4 h-4 focus:ring-indigo-500"
                                        checked={form.predecessorIds!.includes(a.id)}
                                        onChange={e => {
                                            const ids = e.target.checked
                                                ? [...form.predecessorIds!, a.id]
                                                : form.predecessorIds!.filter(id => id !== a.id);
                                            set('predecessorIds', ids);
                                        }}
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-indigo-700">
                                        <span className="font-bold text-gray-400 mr-2">{a.sequence}.</span>
                                        {a.activityName}
                                    </span>
                                </label>
                            ))}
                        {allActivities.length <= 1 && (
                            <div className="text-xs text-gray-400 py-2 text-center">No other activities available for linking.</div>
                        )}
                    </div>
                </div>
            </div>
            {/* Toggles */}
            <div className="flex items-center gap-4 flex-wrap">
                {(['holdPoint', 'witnessPoint', 'allowBreak'] as const).map(field => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="rounded border-gray-300 text-indigo-600 w-4 h-4"
                            checked={form[field]}
                            onChange={e => set(field, e.target.checked)}
                        />
                        <span className="text-xs font-semibold text-gray-700">
                            {field === 'holdPoint' ? '🔴 Hold Point' : field === 'witnessPoint' ? '🟡 Witness Point' : '✂️ Allow Break'}
                        </span>
                    </label>
                ))}
            </div>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving...' : 'Save Activity'}
                </button>
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const SequenceManagerPage = () => {
    const { projectId, listId } = useParams<{ projectId: string; listId: string }>();
    const navigate = useNavigate();

    const [list, setList] = useState<ActivityList | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showAddForm, setShowAddForm] = useState(false);
    const [editTarget, setEditTarget] = useState<Activity | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchData();
    }, [listId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [listRes, activitiesRes] = await Promise.all([
                api.get(`/quality/activity-lists/${listId}`),
                api.get(`/quality/activity-lists/${listId}/activities`),
            ]);
            setList(listRes.data);
            setActivities(activitiesRes.data);
        } catch {
            console.error('Failed to load sequence data');
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = activities.findIndex(a => a.id === active.id);
        const newIndex = activities.findIndex(a => a.id === over.id);
        const reordered = arrayMove(activities, oldIndex, newIndex);

        // Optimistic update
        setActivities(reordered);

        // Persist to backend
        setSaving(true);
        try {
            const res = await api.patch(`/quality/activity-lists/${listId}/reorder`, {
                orderedIds: reordered.map(a => a.id),
            });
            setActivities(res.data);
        } catch {
            // Revert on failure
            fetchData();
        } finally {
            setSaving(false);
        }
    };

    const handleAddActivity = async (data: Partial<Activity>) => {
        await api.post(`/quality/activity-lists/${listId}/activities`, data);
        setShowAddForm(false);
        fetchData();
    };

    const handleEditActivity = async (data: Partial<Activity>) => {
        await api.patch(`/quality/activities/${editTarget!.id}`, data);
        setEditTarget(null);
        fetchData();
    };

    const handleDeleteActivity = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await api.delete(`/quality/activities/${deleteId}`);
            setDeleteId(null);
            fetchData();
        } catch {
            alert('Failed to delete activity');
        } finally {
            setDeleting(false);
        }
    };

    const handleToggle = async (id: number, field: 'holdPoint' | 'witnessPoint' | 'allowBreak', val: boolean) => {
        // Optimistic
        setActivities(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a));
        try {
            await api.patch(`/quality/activities/${id}`, { [field]: val });
        } catch {
            fetchData(); // revert
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full mr-3" />
                Loading sequence...
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/dashboard/projects/${projectId}/quality/activity-lists`)}
                            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-gray-800">{list?.name}</h2>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                Sequence Manager
                                {list?.epsNode && (
                                    <> · <span className="text-indigo-500 font-medium">{list.epsNode.nodeName}</span></>
                                )}
                                {saving && <span className="text-amber-500 ml-2 animate-pulse">Saving...</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md shadow bg-white text-indigo-700">
                                <List className="w-4 h-4" /> Activity Editor
                            </button>
                            <button
                                onClick={() => navigate(`/dashboard/projects/${projectId}/quality/activity-lists/${listId}/sequence`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                            >
                                <Network className="w-4 h-4" /> Workflow Editor
                            </button>
                        </div>
                        <button
                            onClick={() => { setShowAddForm(true); setEditTarget(null); }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Add Activity
                        </button>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-6 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-red-500" /> Hold Point = mandatory inspection gate</span>
                <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-amber-500" /> Witness Point = optional witness</span>
                <span className="flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5 text-orange-500" /> Allow Break = RFI allowed even if predecessor incomplete</span>
                <span className="flex items-center gap-1.5"><GripVertical className="w-3.5 h-3.5 text-gray-400" /> Drag to reorder</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-3xl mx-auto space-y-3">
                    {/* Add Form */}
                    {showAddForm && !editTarget && (
                        <ActivityForm
                            allActivities={activities}
                            onSave={handleAddActivity}
                            onCancel={() => setShowAddForm(false)}
                        />
                    )}

                    {/* Empty State */}
                    {activities.length === 0 && !showAddForm && (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Plus className="w-8 h-8 text-indigo-300" />
                            </div>
                            <p className="text-gray-500 font-medium">No activities yet</p>
                            <p className="text-gray-400 text-sm mt-1">Add activities manually or import from CSV</p>
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
                            >
                                <Plus className="w-4 h-4 inline mr-1" /> Add First Activity
                            </button>
                        </div>
                    )}

                    {/* Drag and Drop List */}
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={activities.map(a => a.id)} strategy={verticalListSortingStrategy}>
                            {activities.map((activity, index) => (
                                <div key={activity.id}>
                                    {/* Edit Form inline */}
                                    {editTarget?.id === activity.id ? (
                                        <ActivityForm
                                            initial={activity}
                                            allActivities={activities}
                                            onSave={handleEditActivity}
                                            onCancel={() => setEditTarget(null)}
                                        />
                                    ) : (
                                        <SortableRow
                                            activity={activity}
                                            index={index}
                                            allActivities={activities}
                                            onEdit={setEditTarget}
                                            onDelete={setDeleteId}
                                            onToggle={handleToggle}
                                        />
                                    )}
                                </div>
                            ))}
                        </SortableContext>
                    </DndContext>

                    {/* Add button at bottom */}
                    {activities.length > 0 && !showAddForm && (
                        <button
                            onClick={() => { setShowAddForm(true); setEditTarget(null); }}
                            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-indigo-300 hover:text-indigo-500 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Another Activity
                        </button>
                    )}
                </div>
            </div>

            {/* Delete Confirm */}
            {deleteId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 rounded-full"><Trash2 className="w-5 h-5 text-red-600" /></div>
                            <div>
                                <h3 className="font-bold text-gray-800">Delete Activity?</h3>
                                <p className="text-sm text-gray-500">The sequence will auto-relink to the previous valid activity.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
                            <button onClick={handleDeleteActivity} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SequenceManagerPage;
