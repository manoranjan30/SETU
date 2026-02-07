import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Search, Hammer, MapPin, Tag, User, Camera } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const QualitySnagList: React.FC<Props> = ({ projectId }) => {
    const [snags, setSnags] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [formData, setFormData] = useState({
        projectId,
        zone: '',
        floor: '',
        unit: '',
        room: '',
        defectDescription: '',
        trade: 'Finishes',
        status: 'Open',
        assignedTo: '',
        completionDate: '',
    });

    const fetchSnags = async () => {
        try {
            const response = await api.get(`/quality/${projectId}/snags`);
            setSnags(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchSnags();
    }, [projectId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await api.put(`/quality/snags/${editingItem.id}`, formData);
            } else {
                await api.post('/quality/snags', formData);
            }
            setIsModalOpen(false);
            setEditingItem(null);
            resetForm();
            fetchSnags();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this snag?')) return;
        try {
            await api.delete(`/quality/snags/${id}`);
            fetchSnags();
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setFormData({
            projectId,
            zone: '',
            floor: '',
            unit: '',
            room: '',
            defectDescription: '',
            trade: 'Finishes',
            status: 'Open',
            assignedTo: '',
            completionDate: '',
        });
    };

    const openEditModal = (item: any) => {
        setEditingItem(item);
        setFormData({
            projectId: item.projectId,
            zone: item.zone,
            floor: item.floor,
            unit: item.unit,
            room: item.room,
            defectDescription: item.defectDescription,
            trade: item.trade,
            status: item.status,
            assignedTo: item.assignedTo || '',
            completionDate: item.completionDate || '',
        });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm w-96">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search snag list..." className="bg-transparent border-none focus:ring-0 text-sm w-full" />
                </div>
                <button
                    onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                >
                    <Plus className="w-4 h-4" />
                    <span className="font-bold">Add Snag Item</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {snags.map((snag) => (
                    <div key={snag.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-md">
                        <div className="h-40 bg-gray-100 flex items-center justify-center relative">
                            <Camera className="w-12 h-12 text-gray-200" />
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditModal(snag)} className="p-2 bg-white/90 backdrop-blur-sm rounded-lg text-blue-600 shadow-lg"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(snag.id)} className="p-2 bg-white/90 backdrop-blur-sm rounded-lg text-red-600 shadow-lg"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="absolute bottom-4 left-4">
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full shadow-lg ${snag.status === 'Open' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                    {snag.status}
                                </span>
                            </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2">
                                <MapPin className="w-3 h-3" /> {snag.zone} • Floor {snag.floor} • {snag.unit}
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2">{snag.defectDescription}</h4>
                            <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-50">
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                    <Tag className="w-3.5 h-3.5" /> {snag.trade}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                    <User className="w-3.5 h-3.5" /> {snag.assignedTo || 'Unassigned'}
                                </div>
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
                                <Hammer className="w-5 h-5 text-orange-600" />
                                {editingItem ? 'Edit Snag Item' : 'Add New Snag'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Zone / Block</label>
                                <input
                                    type="text" required
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.zone}
                                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Floor</label>
                                    <input
                                        type="text" required
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                        value={formData.floor}
                                        onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Unit</label>
                                    <input
                                        type="text" required
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Defect Description</label>
                                <textarea
                                    required rows={3}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.defectDescription}
                                    onChange={(e) => setFormData({ ...formData, defectDescription: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Trade</label>
                                <select
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.trade}
                                    onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                                >
                                    <option value="Carpentry">Carpentry</option>
                                    <option value="Flooring">Flooring</option>
                                    <option value="Painting">Painting</option>
                                    <option value="Plumbing">Plumbing</option>
                                    <option value="Electrical">Electrical</option>
                                    <option value="False Ceiling">False Ceiling</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Status</label>
                                <select
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="Open">Open</option>
                                    <option value="Resolved">Resolved</option>
                                    <option value="Verified">Verified</option>
                                    <option value="Closed">Closed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Assigned To</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.assignedTo}
                                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Completion Target</label>
                                <input
                                    type="date"
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.completionDate}
                                    onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 mt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all">
                                    {editingItem ? 'Update Snag' : 'Add Snag'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QualitySnagList;
