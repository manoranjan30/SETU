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
        { label: 'Quality Score', value: (summary?.qualityScore || 0) + '%', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Verified by Inspections' },
        { label: 'Open NCRs', value: summary?.openNcr || 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', sub: 'Critical Action Req.' },
        { label: 'Active Inspections', value: summary?.pendingInspections || 0, icon: ClipboardCheck, color: 'text-orange-600', bg: 'bg-orange-50', sub: 'Execution Phase' },
        { label: 'Failed Tests', value: summary?.failedTests || 0, icon: FlaskConical, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'Material Deviations' },
    ];

    const floors: string[] = summary?.floors || [];
    const zones: string[] = summary?.zones || [];

    const getZoneColor = (status?: number) => {
        if (status === 1) return 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-600';
        if (status === 2) return 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600';
        if (status === 3) return 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-600';
        return 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-400';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpiCards.map((card, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 group">
                        <div className={`absolute right-0 top-0 w-32 h-32 ${card.bg} -mr-12 -mt-12 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500`} />
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

            {/* Floor-wise Status Heat Map & Visualizations */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                {/* Heat Map Component */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm col-span-1 border-t-4 border-t-orange-500">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 tracking-tight">Floor-wise Quality Status</h3>
                            <p className="text-sm text-gray-500 font-medium mt-1">Real-time inspection completion heat map</p>
                        </div>
                        <div className="flex gap-4 text-xs font-bold text-gray-500">
                            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200"></div> Pending</span>
                            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-50 border border-blue-200"></div> Active</span>
                            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-50 border border-red-200"></div> Issue</span>
                            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-200"></div> Cleared</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar pb-4">
                        {floors.length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-400 font-medium">No floor data available</div>
                        ) : (
                            <table className="w-full text-left border-separate border-spacing-2">
                                <thead>
                                    <tr>
                                        <th className="p-2 w-24"></th>
                                        {zones.map(z => <th key={z} className="p-2 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">{z}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {floors.map((floor) => (
                                        <tr key={floor}>
                                            <td className="p-2 text-sm font-bold text-gray-600 whitespace-nowrap">{floor}</td>
                                            {zones.map((zone) => {
                                                const status = summary?.heatMapData?.[floor]?.[zone]?.status || 0;
                                                return (
                                                    <td key={zone} className="p-1">
                                                        <div
                                                            className={`h-12 min-w-[3rem] w-full rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-sm ${getZoneColor(status)}`}
                                                            title={`${floor} - ${zone}`}
                                                        >
                                                            {status === 3 ? <CheckCircle2 className="w-4 h-4 opacity-50" /> : null}
                                                            {status === 2 ? <AlertCircle className="w-4 h-4 opacity-50" /> : null}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm border-t-4 border-t-indigo-500">
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight mb-2">Quality Score Trend</h3>
                    <p className="text-sm text-gray-500 font-medium mb-8">Pass rate percentage over the last 6 months</p>
                    <div className="h-80 flex flex-col items-center justify-center text-gray-300 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <TrendingUp className="w-16 h-16 mb-4 text-indigo-200" />
                        <p className="text-sm font-bold">Chart Integration Pending...</p>
                        <p className="text-xs mt-2 w-64 text-center">Data points are actively collecting from passed/failed inspection stages.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QualityOverview;
