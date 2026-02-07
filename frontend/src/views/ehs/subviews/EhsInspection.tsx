import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const EhsInspection: React.FC<Props> = ({ projectId }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteStep, setDeleteStep] = useState(0); // 0: None, 1: First Confirm, 2: Final Confirm

    const [formData, setFormData] = useState({
        inspectionName: '',
        status: 'Pending',
        month: new Date().toISOString().slice(0, 7),
        dueDate: '',
        completedDate: '',
        remarks: ''
    });

    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0
    });

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const fetchData = async () => {
        try {
            const response = await api.get(`/ehs/${projectId}/inspections`);
            setData(response.data);
            calculateStats(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (items: any[]) => {
        const completed = items.filter(i => i.status === 'Completed').length;
        const pending = items.filter(i => i.status === 'Pending').length;
        const overdue = items.filter(i => {
            if (i.status === 'Completed') return false;
            return new Date(i.dueDate) < new Date();
        }).length;

        setStats({
            total: items.length,
            completed,
            pending,
            overdue
        });
    };

    const handleEdit = (item: any) => {
        setFormData({
            inspectionName: item.inspectionName,
            status: item.status,
            month: item.month ? item.month.slice(0, 7) : '',
            dueDate: item.dueDate,
            completedDate: item.completedDate || '',
            remarks: item.remarks || ''
        });
        setEditingId(item.id);
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await api.delete(`/ehs/inspections/${deleteId}`);
            setDeleteId(null);
            setDeleteStep(0);
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...formData, month: `${formData.month}-01`, projectId }; // Ensure month is YYYY-MM-DD

            if (editingId) {
                await api.put(`/ehs/inspections/${editingId}`, payload);
            } else {
                await api.post(`/ehs/${projectId}/inspections`, payload);
            }
            setShowModal(false);
            setEditingId(null);
            resetForm();
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setFormData({
            inspectionName: '',
            status: 'Pending',
            month: new Date().toISOString().slice(0, 7),
            dueDate: '',
            completedDate: '',
            remarks: ''
        });
    }

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Completed</p>
                        <p className="text-3xl font-black text-gray-900">{stats.completed}</p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-xl">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Pending</p>
                        <p className="text-3xl font-black text-gray-900">{stats.pending}</p>
                    </div>
                    <div className="bg-orange-100 p-3 rounded-xl">
                        <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Overdue</p>
                        <p className="text-3xl font-black text-gray-900">{stats.overdue}</p>
                    </div>
                    <div className="bg-red-100 p-3 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Inspection Schedule</h3>
                    <button
                        onClick={() => { setEditingId(null); resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Inspection
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                            <tr>
                                <th className="px-6 py-4">SI</th>
                                <th className="px-6 py-4">Inspection</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Month</th>
                                <th className="px-6 py-4">Due Date</th>
                                <th className="px-6 py-4">Completed Date</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{index + 1}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{item.inspectionName}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                            item.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {item.completedDate ? new Date(item.completedDate).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { setDeleteId(item.id); setDeleteStep(1); }}
                                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg">{editingId ? 'Update' : 'Add'} Inspection</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Inspection Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                    value={formData.inspectionName}
                                    onChange={(e) => setFormData({ ...formData, inspectionName: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Overdue">Overdue</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Target Month</label>
                                    <input
                                        type="month"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.month}
                                        onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Completed Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.completedDate}
                                        onChange={(e) => setFormData({ ...formData, completedDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Remarks</label>
                                <textarea
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none h-20"
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                {editingId ? 'Update Inspection' : 'Add Inspection'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteStep > 0 && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-6 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                            {deleteStep === 1 ? 'Delete Inspection?' : 'Are you absolutely sure?'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">
                            {deleteStep === 1
                                ? 'This action will remove this inspection record. Do you want to proceed?'
                                : 'This action cannot be undone. Confirm deletion?'}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => { setDeleteStep(0); setDeleteId(null); }}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteStep === 1 ? setDeleteStep(2) : handleDelete()}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                            >
                                {deleteStep === 1 ? 'Yes, Delete' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EhsInspection;
