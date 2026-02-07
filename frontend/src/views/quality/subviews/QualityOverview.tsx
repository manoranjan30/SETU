import { useState, useEffect } from 'react';
import {
    CheckCircle2,
    AlertCircle,
    ClipboardCheck,
    FlaskConical,
    TrendingUp,
    Shield
} from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const QualityOverview: React.FC<Props> = ({ projectId }) => {
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const response = await api.get(`/quality/${projectId}/summary`);
                setSummary(response.data);
            } catch (error) {
                console.error('Error fetching Quality summary:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, [projectId]);

    if (loading) return <div className="animate-pulse flex items-center justify-center h-64 text-gray-400">Loading Quality Dashboard...</div>;

    const kpiCards = [
        { label: 'Quality Score', value: (summary?.qualityScore || 0) + '%', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Based on Inspections' },
        { label: 'Open NCRs', value: summary?.openNcr || 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', sub: 'Requires Action' },
        { label: 'Pending Inspections', value: summary?.pendingInspections || 0, icon: ClipboardCheck, color: 'text-orange-600', bg: 'bg-orange-50', sub: 'In Progress' },
        { label: 'Material Tests', value: summary?.failedTests || 0, icon: FlaskConical, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'Failed Results' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpiCards.map((card, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                        <div className={`absolute right-0 top-0 w-20 h-20 ${card.bg} -mr-8 -mt-8 rounded-full opacity-30`} />
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <card.icon className={`w-8 h-8 ${card.color} mb-4`} />
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.label}</h3>
                                <p className="text-3xl font-black text-gray-900 mt-1">{card.value}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-4 font-bold bg-gray-50 px-2 py-1 rounded w-fit">{card.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Visualizations Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Inspection Pass Rate</h3>
                    <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                        <TrendingUp className="w-12 h-12 mb-2 opacity-10" />
                        <p className="text-xs">Data trend visualization will appear here as more records are added.</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Quality Observations by Category</h3>
                    <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                        <CheckCircle2 className="w-12 h-12 mb-2 opacity-10" />
                        <p className="text-xs">Observation distribution will appear here.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QualityOverview;
