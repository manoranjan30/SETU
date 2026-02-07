import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const EhsIncident: React.FC<Props> = ({ projectId }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        month: '',
        category: 'Safety',
        incidentType: 'First Aid',
        description: '',
        date: ''
    });

    const [stats, setStats] = useState({
        total: 0,
        firstAid: 0,
        nearMiss: 0,
        dangerous: 0,
        minor: 0,
        major: 0,
        fatal: 0
    });

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const fetchData = async () => {
        try {
            const response = await api.get(`/ehs/${projectId}/incidents-register`);
            setData(response.data);
            calculateStats(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (items: any[]) => {
        const s = {
            total: items.length,
            firstAid: items.filter(i => i.incidentType === 'First Aid').length,
            nearMiss: items.filter(i => i.incidentType === 'Near Miss').length,
            dangerous: items.filter(i => i.incidentType === 'Dangerous Occurrence').length,
            minor: items.filter(i => i.incidentType === 'Minor').length,
            major: items.filter(i => i.incidentType === 'Major').length,
            fatal: items.filter(i => i.incidentType === 'Fatal').length,
        };
        setStats(s);
    };

    const handleEdit = (item: any) => {
        setFormData({
            month: item.month,
            category: item.category,
            incidentType: item.incidentType,
            description: item.description || '',
            date: item.date || ''
        });
        setEditingId(item.id);
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await api.delete(`/ehs/incidents-register/${deleteId}`);
            setDeleteId(null);
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
                await api.put(`/ehs/incidents-register/${editingId}`, payload);
            } else {
                await api.post(`/ehs/${projectId}/incidents-register`, payload);
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
            month: '',
            category: 'Safety',
            incidentType: 'First Aid',
            description: '',
            date: ''
        });
    }

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Total Incidents</p>
                    <p className="text-2xl font-black text-gray-900">{stats.total}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">First Aid</p>
                    <p className="text-2xl font-black text-gray-900">{stats.firstAid}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Near Miss</p>
                    <p className="text-2xl font-black text-gray-900">{stats.nearMiss}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Dangerous</p>
                    <p className="text-2xl font-black text-gray-900">{stats.dangerous}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Minor</p>
                    <p className="text-2xl font-black text-gray-900">{stats.minor}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Major</p>
                    <p className="text-2xl font-black text-gray-900">{stats.major}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Fatal</p>
                    <p className="text-2xl font-black text-red-600">{stats.fatal}</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Incident Register</h3>
                    <button
                        onClick={() => { setEditingId(null); resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Log Incident
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                            <tr>
                                <th className="px-6 py-4">SI</th>
                                <th className="px-6 py-4">Month</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Incident Type</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 font-medium">{index + 1}</td>
                                    <td className="px-6 py-4">{item.month}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-bold">
                                            {item.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-700">{item.incidentType}</td>
                                    <td className="px-6 py-4">{item.date ? new Date(item.date).toLocaleDateString('en-GB') : '-'}</td>
                                    <td className="px-6 py-4 max-w-xs truncate">{item.description}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteId(item.id)}
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
                            <h3 className="font-bold text-lg">{editingId ? 'Update' : 'Log'} Incident</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Month</label>
                                    <input
                                        type="text"
                                        placeholder="MMM-YY"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.month}
                                        onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option value="Safety">Safety</option>
                                        <option value="Health">Health</option>
                                        <option value="Environment">Environment</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Incident Type</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                        value={formData.incidentType}
                                        onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
                                    >
                                        <option value="First Aid">First Aid</option>
                                        <option value="Near Miss">Near Miss</option>
                                        <option value="Dangerous Occurrence">Dangerous Occurrence</option>
                                        <option value="Minor">Minor</option>
                                        <option value="Major">Major</option>
                                        <option value="Fatal">Fatal</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none h-24"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                {editingId ? 'Update Incident' : 'Log Incident'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-6 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Incident?</h3>
                        <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EhsIncident;
