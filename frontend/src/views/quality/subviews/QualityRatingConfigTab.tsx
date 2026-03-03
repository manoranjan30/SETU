import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, RefreshCw, ShieldCheck, TrendingDown } from 'lucide-react';
import api from '../../../api/axios';

interface QualityRatingConfigTabProps {
    projectId: number;
}

const QualityRatingConfigTab: React.FC<QualityRatingConfigTabProps> = ({ projectId }) => {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, [projectId]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const resp = await api.get(`/quality/ratings/${projectId}/config`);
            setConfig(resp.data);
        } catch (error) {
            console.error('Failed to fetch rating config', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post(`/quality/ratings/${projectId}/config`, config);
            alert('Rating configuration saved successfully.');
        } catch (error) {
            alert('Failed to save configuration.');
        } finally {
            setSaving(false);
        }
    };

    const updateSeverity = (severity: string, value: number) => {
        setConfig({
            ...config,
            severityRatings: {
                ...config.severityRatings,
                [severity]: value
            }
        });
    };

    if (loading || !config) return <div className="p-8 text-center text-gray-500">Loading Configuration...</div>;

    return (
        <div className="max-w-4xl space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Quality Rating Configuration</h2>
                    <p className="text-sm text-gray-500">Define weightages and deduction rules for quality scoring</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 font-bold"
                >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            {/* 1. Observation Severity Ratings */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider">Observation Severity Points (Out of 5)</h3>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-5 gap-4">
                        {Object.entries(config.severityRatings).map(([severity, points]: [string, any]) => (
                            <div key={severity} className="space-y-2">
                                <label className="block text-[10px] font-black uppercase text-gray-400">{severity}</label>
                                <input
                                    type="number" step="0.5" min="0" max="5"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-center font-bold text-blue-600"
                                    value={points}
                                    onChange={(e) => updateSeverity(severity, parseFloat(e.target.value))}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. Category Weights by Project Status */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider">Rating Category Weightage (Total 10)</h3>
                </div>
                <div className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left px-6 py-3 text-[10px] font-black text-gray-400 uppercase">Project Context / Status</th>
                                <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase">Observations</th>
                                <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase">Documentation</th>
                                <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase">Cust. Insp</th>
                                <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {config.categoryWeights.map((row: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-bold text-gray-900">{row.status}</td>
                                    <td className="px-4 py-4">
                                        <input
                                            type="number" step="1"
                                            className="w-16 mx-auto bg-gray-50 border-none text-center font-semibold rounded-lg"
                                            value={row.observations}
                                            onChange={(e) => {
                                                const newWeights = [...config.categoryWeights];
                                                newWeights[idx].observations = parseInt(e.target.value);
                                                setConfig({ ...config, categoryWeights: newWeights });
                                            }}
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <input
                                            type="number" step="1"
                                            className="w-16 mx-auto bg-gray-50 border-none text-center font-semibold rounded-lg"
                                            value={row.documentation}
                                            onChange={(e) => {
                                                const newWeights = [...config.categoryWeights];
                                                newWeights[idx].documentation = parseInt(e.target.value);
                                                setConfig({ ...config, categoryWeights: newWeights });
                                            }}
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <input
                                            type="number" step="1"
                                            className="w-16 mx-auto bg-gray-50 border-none text-center font-semibold rounded-lg"
                                            value={row.customerInspections}
                                            onChange={(e) => {
                                                const newWeights = [...config.categoryWeights];
                                                newWeights[idx].customerInspections = parseInt(e.target.value);
                                                setConfig({ ...config, categoryWeights: newWeights });
                                            }}
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-center font-black text-gray-900">
                                        {row.observations + row.documentation + row.customerInspections}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. Deduction Rules */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                    <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider">Pending Observation Deductions</h3>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {config.deductionRules.map((rule: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase block mb-2">{rule.min === rule.max ? '0%' : `${rule.min}% - ${rule.max}%`}</span>
                                <input
                                    type="number" step="0.25"
                                    className="w-full bg-white border border-gray-200 rounded-lg py-1.5 text-center font-bold text-red-600"
                                    value={rule.points}
                                    onChange={(e) => {
                                        const newRules = [...config.deductionRules];
                                        newRules[idx].points = parseFloat(e.target.value);
                                        setConfig({ ...config, deductionRules: newRules });
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QualityRatingConfigTab;
