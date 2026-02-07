import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Save, X } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const EhsPerformance: React.FC<Props> = ({ projectId }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
        ehsRating: 0,
        housekeepingRating: 0
    });

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const fetchData = async () => {
        try {
            const response = await api.get(`/ehs/${projectId}/performance`);
            // Format data for chart (reverse to show Jan -> Dec)
            // But we might want Descending for table? 
            // Recharts usually likes array in order of X-Axis. 
            // If we want [Jan, Feb, Mar], we need Ascending date.
            // Backend returns DESC order.
            setData([...response.data].reverse());
        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Append -01 to make it a full date for backend
            const payload = {
                ...formData,
                month: `${formData.month}-01`,
                projectId
            };
            await api.post(`/ehs/${projectId}/performance`, payload);
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error('Error saving performance:', error);
        }
    };

    const latest = data.length > 0 ? data[data.length - 1] : null;

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Top Cards */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Performance Metrics</h3>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Monthly Rating
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">EHS Rating</p>
                        <p className="text-3xl font-black text-gray-900">{latest?.ehsRating || '0.00'}<span className="text-lg text-gray-400 font-medium">/10</span></p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Housekeeping Rating</p>
                        <p className="text-3xl font-black text-gray-900">{latest?.housekeepingRating || '0.00'}<span className="text-lg text-gray-400 font-medium">/10</span></p>
                    </div>
                </div>

                {/* Additional Stats can be added here if needed */}
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6">1 Year Performance Analysis</h3>
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="month"
                                tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                domain={[0, 10]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#f3f4f6' }}
                                labelFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="ehsRating" name="EHS Rating" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="housekeepingRating" name="Housekeeping Rating" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg">Add Performance Rating</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                                <input
                                    type="month"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                    value={formData.month}
                                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">EHS Rating (0-10)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="10"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                    value={formData.ehsRating}
                                    onChange={(e) => setFormData({ ...formData, ehsRating: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Housekeeping Rating (0-10)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="10"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                                    value={formData.housekeepingRating}
                                    onChange={(e) => setFormData({ ...formData, housekeepingRating: Number(e.target.value) })}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Save Rating
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EhsPerformance;
