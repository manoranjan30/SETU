import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const EhsVehicle: React.FC<Props> = ({ projectId }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteStep, setDeleteStep] = useState(0);

    const [formData, setFormData] = useState({
        vehicleNumber: '',
        vehicleType: '',
        fitnessCertDate: '',
        insuranceDate: '',
        pollutionDate: '',
        remarks: ''
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
            const response = await api.get(`/ehs/${projectId}/vehicles`);
            setData(response.data);
            calculateStats(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getStatus = (date: string) => {
        if (!date) return 'Valid'; // Assume valid if no date
        const today = new Date();
        const next30Days = new Date();
        next30Days.setDate(today.getDate() + 30);
        const d = new Date(date);

        if (d < today) return 'Expired';
        if (d <= next30Days) return 'Expiring Soon';
        return 'Valid';
    };

    // Overall status is worst of individual statuses
    const getOverallStatus = (item: any) => {
        const s1 = getStatus(item.fitnessCertDate);
        const s2 = getStatus(item.insuranceDate);
        const s3 = getStatus(item.pollutionDate);

        if (s1 === 'Expired' || s2 === 'Expired' || s3 === 'Expired') return 'Expired';
        if (s1 === 'Expiring Soon' || s2 === 'Expiring Soon' || s3 === 'Expiring Soon') return 'Expiring Soon';
        return 'Valid';
    }

    const calculateStats = (items: any[]) => {
        let valid = 0;
        let expiringSoon = 0;
        let expired = 0;

        items.forEach(item => {
            const overall = getOverallStatus(item);
            if (overall === 'Expired') expired++;
            else if (overall === 'Expiring Soon') expiringSoon++;
            else valid++;
        });

        setStats({ total: items.length, valid, expiringSoon, expired });
    };

    const StatusBadge = ({ status }: { status: string }) => {
        let color = 'bg-green-100 text-green-700';
        if (status === 'Expired') color = 'bg-red-100 text-red-700';
        if (status === 'Expiring Soon') color = 'bg-orange-100 text-orange-700';

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${color}`}>
                {status}
            </span>
        );
    };

    const handleEdit = (item: any) => {
        setFormData({
            vehicleNumber: item.vehicleNumber,
            vehicleType: item.vehicleType,
            fitnessCertDate: item.fitnessCertDate || '',
            insuranceDate: item.insuranceDate || '',
            pollutionDate: item.pollutionDate || '',
            remarks: item.remarks || ''
        });
        setEditingId(item.id);
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await api.delete(`/ehs/vehicles/${deleteId}`);
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
                await api.put(`/ehs/vehicles/${editingId}`, payload);
            } else {
                await api.post(`/ehs/${projectId}/vehicles`, payload);
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
            vehicleNumber: '',
            vehicleType: '',
            fitnessCertDate: '',
            insuranceDate: '',
            pollutionDate: '',
            remarks: ''
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
                    <h3 className="font-bold text-gray-900">Vehicle Register</h3>
                    <button
                        onClick={() => { setEditingId(null); resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Vehicle
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                            <tr>
                                <th className="px-6 py-4">SI</th>
                                <th className="px-6 py-4">Vehicle Number</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Fitness Cert</th>
                                <th className="px-6 py-4">Fitness Status</th>
                                <th className="px-6 py-4">Insurance</th>
                                <th className="px-6 py-4">Insurance Status</th>
                                <th className="px-6 py-4">Pollution</th>
                                <th className="px-6 py-4">Pollution Status</th>
                                <th className="px-6 py-4">Overall Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map((item, index) => {
                                const fitnessStatus = getStatus(item.fitnessCertDate);
                                const insuranceStatus = getStatus(item.insuranceDate);
                                const pollutionStatus = getStatus(item.pollutionDate);
                                const overallStatus = getOverallStatus(item);

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-medium">{index + 1}</td>
                                        <td className="px-6 py-4 font-medium">{item.vehicleNumber}</td>
                                        <td className="px-6 py-4">{item.vehicleType}</td>

                                        <td className="px-6 py-4">{item.fitnessCertDate ? new Date(item.fitnessCertDate).toLocaleDateString('en-GB') : '-'}</td>
                                        <td className="px-6 py-4"><StatusBadge status={fitnessStatus} /></td>

                                        <td className="px-6 py-4">{item.insuranceDate ? new Date(item.insuranceDate).toLocaleDateString('en-GB') : '-'}</td>
                                        <td className="px-6 py-4"><StatusBadge status={insuranceStatus} /></td>

                                        <td className="px-6 py-4">{item.pollutionDate ? new Date(item.pollutionDate).toLocaleDateString('en-GB') : '-'}</td>
                                        <td className="px-6 py-4"><StatusBadge status={pollutionStatus} /></td>

                                        <td className="px-6 py-4 font-bold"><StatusBadge status={overallStatus} /></td>

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
                            <h3 className="font-bold text-lg">{editingId ? 'Update' : 'Add'} Vehicle</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Vehicle Number</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.vehicleNumber}
                                        onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Tractor, Crane"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.vehicleType}
                                        onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Fitness Cert Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-2 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none text-sm"
                                        value={formData.fitnessCertDate}
                                        onChange={(e) => setFormData({ ...formData, fitnessCertDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Insurance Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-2 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none text-sm"
                                        value={formData.insuranceDate}
                                        onChange={(e) => setFormData({ ...formData, insuranceDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Pollution Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-2 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none text-sm"
                                        value={formData.pollutionDate}
                                        onChange={(e) => setFormData({ ...formData, pollutionDate: e.target.value })}
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
                                {editingId ? 'Update Vehicle' : 'Add Vehicle'}
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
                            {deleteStep === 1 ? 'Delete Vehicle?' : 'Are you absolutely sure?'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">
                            {deleteStep === 1
                                ? 'This action will remove this vehicle record permanently.'
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

export default EhsVehicle;
