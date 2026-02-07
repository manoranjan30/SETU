import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Search, CheckSquare, List, Calendar } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const QualityChecklist: React.FC<Props> = ({ projectId }) => {
    const [checklists, setChecklists] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [formData, setFormData] = useState({
        projectId,
        checklistName: '',
        category: 'Structural',
        items: [
            { id: 1, text: 'Reinforcement as per drawing', checked: false },
            { id: 2, text: 'Cover blocks provided', checked: false },
            { id: 3, text: 'Formwork stability checked', checked: false },
            { id: 4, text: 'Cleaning done', checked: false },
        ],
        status: 'Draft',
        checkedBy: '',
        approvedBy: '',
        date: new Date().toISOString().split('T')[0],
    });

    const fetchChecklists = async () => {
        try {
            const response = await api.get(`/quality/${projectId}/checklists`);
            setChecklists(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchChecklists();
    }, [projectId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await api.put(`/quality/checklists/${editingItem.id}`, formData);
            } else {
                await api.post('/quality/checklists', formData);
            }
            setIsModalOpen(false);
            setEditingItem(null);
            resetForm();
            fetchChecklists();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this checklist?')) return;
        try {
            await api.delete(`/quality/checklists/${id}`);
            fetchChecklists();
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setFormData({
            projectId,
            checklistName: '',
            category: 'Structural',
            items: [
                { id: 1, text: 'Reinforcement as per drawing', checked: false },
                { id: 2, text: 'Cover blocks provided', checked: false },
                { id: 3, text: 'Formwork stability checked', checked: false },
                { id: 4, text: 'Cleaning done', checked: false },
            ],
            status: 'Draft',
            checkedBy: '',
            approvedBy: '',
            date: new Date().toISOString().split('T')[0],
        });
    };

    const toggleItem = (id: number) => {
        const newItems = formData.items.map(item =>
            item.id === id ? { ...item, checked: !item.checked } : item
        );
        setFormData({ ...formData, items: newItems });
    };

    const openEditModal = (item: any) => {
        setEditingItem(item);
        setFormData({
            projectId: item.projectId,
            checklistName: item.checklistName,
            category: item.category,
            items: item.items,
            status: item.status,
            checkedBy: item.checkedBy || '',
            approvedBy: item.approvedBy || '',
            date: item.date || '',
        });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm w-96">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search checklists..." className="bg-transparent border-none focus:ring-0 text-sm w-full" />
                </div>
                <button
                    onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                >
                    <Plus className="w-4 h-4" />
                    <span className="font-bold">New Checklist</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {checklists.map((item) => (
                    <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                <CheckSquare className="w-6 h-6" />
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditModal(item)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                        <h4 className="font-bold text-gray-900 text-lg">{item.checklistName}</h4>
                        <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-4">{item.category}</p>

                        <div className="space-y-3 mb-6">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 flex items-center gap-2"><List className="w-4 h-4" /> Progress</span>
                                <span className="font-bold text-gray-700">
                                    {item.items.filter((i: any) => i.checked).length} / {item.items.length}
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-orange-500 h-full transition-all duration-500"
                                    style={{ width: `${(item.items.filter((i: any) => i.checked).length / item.items.length) * 100}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${item.status === 'Signed Off' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                                {item.status}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                                <Calendar className="w-3 h-3" /> {item.date}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CheckSquare className="w-5 h-5 text-orange-600" />
                                {editingItem ? 'Edit Checklist' : 'New Quality Checklist'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Checklist Name</label>
                                    <input
                                        type="text" required
                                        placeholder="e.g. Columns Pre-Concrete Inspection"
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                        value={formData.checklistName}
                                        onChange={(e) => setFormData({ ...formData, checklistName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Category</label>
                                    <select
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option value="Foundations">Foundations</option>
                                        <option value="Structural">Structural</option>
                                        <option value="MEP">MEP</option>
                                        <option value="Finishes">Finishes</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
                                    <input
                                        type="date" required
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Inspection Items</label>
                                {formData.items.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${item.checked ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100 hover:border-orange-200'}`}
                                    >
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${item.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 bg-white'}`}>
                                            {item.checked && <CheckSquare className="w-4 h-4" />}
                                        </div>
                                        <span className={`text-sm font-medium ${item.checked ? 'text-emerald-700' : 'text-gray-700'}`}>{item.text}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Checked By</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                        value={formData.checkedBy}
                                        onChange={(e) => setFormData({ ...formData, checkedBy: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Approved By</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                        value={formData.approvedBy}
                                        onChange={(e) => setFormData({ ...formData, approvedBy: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all">
                                    {editingItem ? 'Update Checklist' : 'Save Checklist'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QualityChecklist;
