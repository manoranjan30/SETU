import { useState, useEffect } from 'react';
import { Users, Save, Plus, Trash2, Clock } from 'lucide-react';
import api from '../../api/axios';

interface Props {
    activityId: number;
    date: string;
    categories: any[];
}

const ActivityLaborAllocation = ({ activityId, date, categories }: Props) => {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activityId) fetchAllocation();
    }, [activityId]);

    const fetchAllocation = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/labor/activity/${activityId}`);
            // Filter by selected date if needed, or just show all for now
            // The user wants to update for that day.
            setEntries(res.data.filter((e: any) => e.date === date));
        } catch (err) {
            console.error("Failed to fetch allocation", err);
        } finally {
            setLoading(false);
        }
    };

    const addEntry = () => {
        if (categories.length === 0) return;
        setEntries([...entries, {
            categoryId: categories[0].id,
            count: 0,
            date: date,
            activityId: activityId
        }]);
    };

    const removeEntry = (idx: number) => {
        const next = [...entries];
        next.splice(idx, 1);
        setEntries(next);
    };

    const updateEntry = (idx: number, field: string, value: any) => {
        const next = [...entries];
        next[idx][field] = value;
        setEntries(next);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userId = user?.id;

            if (!userId) {
                alert("User session not found. Please log in again.");
                return;
            }

            const toSave = entries.map(e => ({ ...e, date, activityId, userId }));
            await api.post('/labor/activity', { entries: toSave, userId });
            alert("Labor allocation saved.");
        } catch (err) {
            console.error("Failed to save allocation", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Users className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">Labor Allocation for {date}</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={addEntry}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Category
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={entries.length === 0 || loading}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700 disabled:bg-slate-300 transition-all"
                    >
                        <Save className="w-3.5 h-3.5" />
                        {loading ? 'Saving...' : 'Save Allocation'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {entries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 border-2 border-dashed border-slate-50 rounded-2xl">
                        <Users className="w-8 h-8 opacity-20" />
                        <p className="text-xs font-bold">No labor allocated to this activity yet.</p>
                        <button onClick={addEntry} className="text-indigo-600 text-xs font-black hover:underline">Add manually</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {entries.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl group animate-in fade-in slide-in-from-top-1">
                                <select
                                    value={entry.categoryId}
                                    onChange={(e) => updateEntry(idx, 'categoryId', parseInt(e.target.value))}
                                    className="flex-1 bg-white border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-2 ring-indigo-50"
                                >
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.categoryGroup})</option>
                                    ))}
                                </select>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Count:</span>
                                    <input
                                        type="number"
                                        value={entry.count}
                                        onChange={(e) => updateEntry(idx, 'count', parseFloat(e.target.value))}
                                        className="w-16 bg-white border-slate-200 rounded-lg px-2 py-1.5 text-right font-black text-slate-800 text-xs focus:ring-2 ring-indigo-50"
                                    />
                                </div>
                                <button
                                    onClick={() => removeEntry(idx)}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg active:scale-90 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Autosave: Off
                </div>
                <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                <div>Total Allocation: {entries.reduce((sum, e) => sum + (parseFloat(e.count) || 0), 0)} Men</div>
            </div>
        </div>
    );
};

export default ActivityLaborAllocation;
