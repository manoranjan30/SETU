import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Search, ClipboardCheck, Calendar, MapPin } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const QualityInspection: React.FC<Props> = ({ projectId }) => {
    const [inspections, setInspections] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [formData, setFormData] = useState({
        projectId,
        inspectionType: 'ITP',
        description: '',
        location: '',
        trade: 'Civil',
        status: 'Pending',
        scheduledDate: new Date().toISOString().split('T')[0],
        inspectedDate: '',
        inspectedBy: '',
        remarks: ''
    });

    const fetchInspections = async () => {
        try {
            const response = await api.get(`/quality/${projectId}/inspections`);
            setInspections(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchInspections();
    }, [projectId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await api.put(`/quality/inspections/${editingItem.id}`, formData);
            } else {
                await api.post('/quality/inspections', formData);
            }
            setIsModalOpen(false);
            setEditingItem(null);
            resetForm();
            fetchInspections();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this inspection?')) return;
        try {
            await api.delete(`/quality/inspections/${id}`);
            fetchInspections();
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setFormData({
            projectId,
            inspectionType: 'ITP',
            description: '',
            location: '',
            trade: 'Civil',
            status: 'Pending',
            scheduledDate: new Date().toISOString().split('T')[0],
            inspectedDate: '',
            inspectedBy: '',
            remarks: ''
        });
    };

    const openEditModal = (item: any) => {
        setEditingItem(item);
        setFormData({
            projectId: item.projectId,
            inspectionType: item.inspectionType,
            description: item.description,
            location: item.location || '',
            trade: item.trade || 'Civil',
            status: item.status,
            scheduledDate: item.scheduledDate,
            inspectedDate: item.inspectedDate || '',
            inspectedBy: item.inspectedBy || '',
            remarks: item.remarks || ''
        });
        setIsModalOpen(true);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Pass': return 'bg-emerald-100 text-emerald-700';
            case 'Fail': return 'bg-red-100 text-red-700';
            case 'In Progress': return 'bg-blue-100 text-blue-700';
            case 'Conditional': return 'bg-orange-100 text-orange-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm w-96">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search inspections..." className="bg-transparent border-none focus:ring-0 text-sm w-full" />
                </div>
                <button
                    onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                >
                    <Plus className="w-4 h-4" />
                    <span className="font-bold">New Inspection</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Type</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Description</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Location</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Scheduled Date</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {inspections.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${item.inspectionType === 'ITP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {item.inspectionType}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-900">{item.description}</p>
                                    <p className="text-xs text-gray-500">{item.trade}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                        {item.location || 'N/A'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getStatusStyle(item.status)}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                        {item.scheduledDate}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => openEditModal(item)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <ClipboardCheck className="w-5 h-5 text-orange-600" />
                                {editingItem ? 'Edit Inspection' : 'Schedule New Inspection'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Type</label>
                                <select
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.inspectionType}
                                    onChange={(e) => setFormData({ ...formData, inspectionType: e.target.value })}
                                >
                                    <option value="ITP">Inspection Test Plan (ITP)</option>
                                    <option value="WIR">Work Inspection Request (WIR)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Trade</label>
                                <select
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.trade}
                                    onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                                >
                                    <option value="Civil">Civil</option>
                                    <option value="Structural">Structural</option>
                                    <option value="Plumbing">Plumbing</option>
                                    <option value="Electrical">Electrical</option>
                                    <option value="Finishes">Finishes</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Description</label>
                                <input
                                    type="text" required
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Location</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Status</label>
                                <select
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Pass">Pass</option>
                                    <option value="Fail">Fail</option>
                                    <option value="Conditional">Conditional</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scheduled Date</label>
                                <input
                                    type="date" required
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    value={formData.scheduledDate}
                                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 mt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all">
                                    {editingItem ? 'Update' : 'Schedule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QualityInspection;
