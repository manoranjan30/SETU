import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, FileText, LayoutDashboard, History } from 'lucide-react';
import api from '../../../api/axios';

interface QualityRatingDisplayTabProps {
    projectId: number;
}

const QualityRatingDisplayTab: React.FC<QualityRatingDisplayTabProps> = ({ projectId }) => {
    const [rating, setRating] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [projectStatus, setProjectStatus] = useState('Structure');

    useEffect(() => {
        fetchData();
    }, [projectId, projectStatus]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [calcResp, histResp] = await Promise.all([
                api.get(`/quality/ratings/${projectId}/calculate?status=${encodeURIComponent(projectStatus)}`),
                api.get(`/quality/ratings/${projectId}/history`)
            ]);
            setRating(calcResp.data);
            setHistory(histResp.data);
        } catch (error) {
            console.error('Failed to fetch rating data', error);
        } finally {
            setLoading(false);
        }
    };

    const takeSnapshot = async () => {
        try {
            await api.post(`/quality/ratings/${projectId}/snapshot`, { status: projectStatus });
            alert('Rating snapshot created successfully.');
            fetchData();
        } catch (error) {
            alert('Failed to take snapshot.');
        }
    };

    if (loading && !rating) return <div className="p-8 text-center text-gray-400">Calculating Rating...</div>;

    const getScoreColor = (score: number) => {
        if (score >= 9) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        if (score >= 7) return 'text-blue-600 bg-blue-50 border-blue-100';
        if (score >= 5) return 'text-amber-600 bg-amber-50 border-amber-100';
        return 'text-red-600 bg-red-50 border-red-100';
    };

    return (
        <div className="space-y-8 max-w-6xl">
            {/* Header / Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <select
                        className="bg-white border text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500"
                        value={projectStatus} onChange={(e) => setProjectStatus(e.target.value)}
                    >
                        <option value="Structure">Site Status: Structure</option>
                        <option value="Structure + Finishes">Site Status: Structure + Finishes</option>
                        <option value="Finishes">Site Status: Finishes</option>
                        <option value="Finishes + Customer Inspections">Site Status: Finishes + Cust. Insp.</option>
                    </select>
                    <button
                        onClick={fetchData}
                        className="p-2.5 bg-white border rounded-xl hover:bg-gray-50 transition-all text-gray-500"
                        title="Recalculate"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <button
                    onClick={takeSnapshot}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 font-bold"
                >
                    Save Monthly Rating
                </button>
            </div>

            {/* Main Score UI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`md:col-span-1 rounded-3xl border p-8 flex flex-col items-center justify-center text-center shadow-sm ${getScoreColor(rating?.overallScore)}`}>
                    <TrendingUp className="w-8 h-8 opacity-50 mb-2" />
                    <h3 className="text-sm font-bold uppercase tracking-widest opacity-70">Overall Quality Rating</h3>
                    <div className="text-7xl font-black mt-2">{rating?.overallScore}</div>
                    <div className="text-xs font-black uppercase tracking-tighter opacity-50">Out of 10</div>
                </div>

                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="text-[10px] font-black uppercase text-gray-400">Site Observations</h4>
                                <div className="text-2xl font-bold text-gray-900 mt-1">{rating?.observationScore} / 5</div>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-blue-500" /></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Avg weight adjusted score for all observations.</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="text-[10px] font-black uppercase text-gray-400">Pending Recovery</h4>
                                <div className="text-2xl font-bold text-red-600 mt-1">-{rating?.pendingDeduction}</div>
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg"><TrendingUp className="w-5 h-5 text-red-500 rotate-180" /></div>
                        </div>
                        <div className="text-xs font-medium text-gray-500 mt-2">
                            Deduction for <span className="text-red-600 font-bold">{rating?.pendingRatioPercentage}%</span> open observations ({rating?.openObservations}/{rating?.totalObservations}).
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="text-[10px] font-black uppercase text-gray-400">Documentation</h4>
                                <div className="text-2xl font-bold text-gray-900 mt-1">5 / 5</div>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg"><FileText className="w-5 h-5 text-emerald-500" /></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Score based on quality document submission status.</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="text-[10px] font-black uppercase text-gray-400">Cust/EHS Audits</h4>
                                <div className="text-2xl font-bold text-gray-900 mt-1">{rating?.customerInspectionScore} / 5</div>
                            </div>
                            <div className="p-2 bg-amber-50 rounded-lg"><CheckCircle2 className="w-5 h-5 text-amber-500" /></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Score based on external audit reviews.</p>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-bold text-gray-900">Rating History</h3>
                </div>
                {history.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                        <LayoutDashboard className="w-12 h-12 mb-4 opacity-10" />
                        <p className="text-sm font-medium">No recorded snapshots found for this project.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left px-8 py-4 text-[10px] font-black text-gray-400 uppercase">Period</th>
                                    <th className="text-left px-4 py-4 text-[10px] font-black text-gray-400 uppercase">Status Context</th>
                                    <th className="text-center px-4 py-4 text-[10px] font-black text-gray-400 uppercase font-mono">Open/Total</th>
                                    <th className="text-center px-4 py-4 text-[10px] font-black text-gray-400 uppercase">Deduction</th>
                                    <th className="text-right px-8 py-4 text-[10px] font-black text-gray-400 uppercase">Overall Rating</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {history.map((h: any) => (
                                    <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-8 py-4 font-bold text-gray-900">{h.period}</td>
                                        <td className="px-4 py-4 text-gray-500 font-medium">{h.details?.context || 'Structure'}</td>
                                        <td className="px-4 py-4 text-center font-mono">
                                            <span className="text-red-500 px-1.5 py-0.5 rounded-md bg-red-50">{h.openObservations}</span>
                                            <span className="mx-1 text-gray-300">/</span>
                                            <span className="text-gray-900">{h.totalObservations}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center text-red-600 font-bold">-{h.pendingDeduction}</td>
                                        <td className="px-8 py-4 text-right">
                                            <span className={`inline-block px-4 py-1 rounded-full font-black ${getScoreColor(h.overallScore)}`}>
                                                {h.overallScore}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QualityRatingDisplayTab;
