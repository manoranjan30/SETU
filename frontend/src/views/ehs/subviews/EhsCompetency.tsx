import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const EhsCompetency: React.FC<Props> = ({ projectId }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteStep, setDeleteStep] = useState(0);

    const [formData, setFormData] = useState({
        name: '',
        role: '',
        vehicleMachine: '',
        licenseExpiry: '',
        fitnessExpiry: ''
    });

    const [stats, setStats] = useState({
        total: 0,
        valid: 0,
        expiringSoon: 0,
        expired: 0
    });

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const fetchData = async () => {
        try {
            const response = await api.get(`/ehs/${projectId}/competencies`);
            setData(response.data);
            calculateStats(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (items: any[]) => {
        const today = new Date();
        const next30Days = new Date();
        next30Days.setDate(today.getDate() + 30);

        let valid = 0;
        let expiringSoon = 0;
        let expired = 0;

        items.forEach(item => {
            // Check both license and fitness expiry
            const ex1 = item.licenseExpiry ? new Date(item.licenseExpiry) : null;
            const ex2 = item.fitnessExpiry ? new Date(item.fitnessExpiry) : null;

            let isExpired = false;
            let isExpiringSoon = false;

            if (ex1 && ex1 < today) isExpired = true;
            if (ex2 && ex2 < today) isExpired = true;

            if (!isExpired) {
                if ((ex1 && ex1 <= next30Days) || (ex2 && ex2 <= next30Days)) {
                    isExpiringSoon = true;
                }
            }

            if (isExpired) expired++;
            else if (isExpiringSoon) expiringSoon++;
            else valid++;
        });

        setStats({ total: items.length, valid, expiringSoon, expired });
    };


    const getStatusLabel = (expiryDate: string) => {
        if (!expiryDate) return { label: 'Valid', color: 'bg-green-100 text-green-700' };

        const today = new Date();
        const next30Days = new Date();
        next30Days.setDate(today.getDate() + 30);
        const expiry = new Date(expiryDate);

        if (expiry < today) return { label: 'Expired', color: 'bg-red-100 text-red-700' };
        if (expiry <= next30Days) return { label: 'Expiring Soon', color: 'bg-orange-100 text-orange-700' };
        return { label: 'Valid', color: 'bg-green-100 text-green-700' };
    };

    const handleEdit = (item: any) => {
        setFormData({
            name: item.name,
            role: item.role,
            vehicleMachine: item.vehicleMachine,
            licenseExpiry: item.licenseExpiry || '',
            fitnessExpiry: item.fitnessExpiry || ''
        });
        setEditingId(item.id);
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await api.delete(`/ehs/competencies/${deleteId}`);
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
            const payload = { ...formData, projectId };

            if (editingId) {
                await api.put(`/ehs/competencies/${editingId}`, payload);
            } else {
                await api.post(`/ehs/${projectId}/competencies`, payload);
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
            name: '',
            role: '',
            vehicleMachine: '',
            licenseExpiry: '',
            fitnessExpiry: ''
        });
    }

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Total</p>
                        <p className="text-3xl font-black text-gray-900">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Valid</p>
                        <p className="text-3xl font-black text-gray-900">{stats.valid}</p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-xl">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Expiring Soon</p>
                        <p className="text-3xl font-black text-gray-900">{stats.expiringSoon}</p>
                    </div>
                    <div className="bg-orange-100 p-3 rounded-xl">
                        <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Expired</p>
                        <p className="text-3xl font-black text-red-600">{stats.expired}</p>
                    </div>
                    <div className="bg-red-100 p-3 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Competency Register</h3>
                    <button
                        onClick={() => { setEditingId(null); resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Data
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                            <tr>
                                <th className="px-6 py-4">SI</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Vehicle/Machine</th>
                                <th className="px-6 py-4">License Status</th>
                                <th className="px-6 py-4">License Expiry</th>
                                <th className="px-6 py-4">Fitness Expiry</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map((item, index) => {
                                const licenseStatus = getStatusLabel(item.licenseExpiry);
                                // Logic for checking row class (if either is expired, highlight row)
                                const today = new Date();
                                const ex1 = new Date(item.licenseExpiry);
                                const ex2 = new Date(item.fitnessExpiry);
                                const isExpired = (item.licenseExpiry && ex1 < today) || (item.fitnessExpiry && ex2 < today);
                                const rowClass = isExpired ? 'bg-red-50 text-red-700 font-bold' : '';

                                return (
                                    <tr key={item.id} className={`hover:bg-gray-50/50 ${rowClass}`}>
                                        <td className="px-6 py-4 font-medium">{index + 1}</td>
                                        <td className="px-6 py-4 font-medium">{item.name}</td>
                                        <td className="px-6 py-4">{item.role}</td>
                                        <td className="px-6 py-4">{item.vehicleMachine}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${licenseStatus.color}`}>
                                                {licenseStatus.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.licenseExpiry ? new Date(item.licenseExpiry).toLocaleDateString('en-GB') : '-'}
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            {item.fitnessExpiry ? new Date(item.fitnessExpiry).toLocaleDateString('en-GB') : '-'}
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
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg">{editingId ? 'Update' : 'Add'} Data</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Vehicle / Machine</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                    value={formData.vehicleMachine}
                                    onChange={(e) => setFormData({ ...formData, vehicleMachine: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">License Expiry</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.licenseExpiry}
                                        onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Fitness Cert Expiry</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.fitnessExpiry}
                                        onChange={(e) => setFormData({ ...formData, fitnessExpiry: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                {editingId ? 'Update Data' : 'Add Data'}
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
                            {deleteStep === 1 ? 'Delete Record?' : 'Are you absolutely sure?'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">
                            {deleteStep === 1
                                ? 'This action will remove this record permanently.'
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

export default EhsCompetency;
