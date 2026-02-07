import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    BarChart3,
    Plus,
    PieChart,
    Activity
} from 'lucide-react';
import api from '../../api/axios';

// Components
import BurnRateCards from './BurnRateCards';
import BurnRateChart from './BurnRateChart';
import PlanVsAchieved from './PlanVsAchieved';
import ScheduleComparison from './ScheduleComparison';
import EfficiencyInsights from './EfficiencyInsights';
import ProgressEntry from '../../pages/execution/ProgressEntry'; // Re-using existing entry component

const ProgressDashboard = () => {
    const { projectId } = useParams();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'entry'>('dashboard');

    // Data States
    const [burnStats, setBurnStats] = useState<any>(null);
    const [planVsAchieved, setPlanVsAchieved] = useState<any>(null);
    const [scheduleDiff, setScheduleDiff] = useState<any>(null);
    const [insights, setInsights] = useState<any>(null);

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchDashboardData();
        }
    }, [projectId, activeTab]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [statsRes, planRes, diffRes, insightsRes] = await Promise.all([
                api.get(`/progress/stats/${projectId}`),
                api.get(`/progress/plan-vs-achieved/${projectId}`),
                // api.get(`/progress/schedule-compare/${projectId}`), // Mocking for now as endpoint needs complex logic
                Promise.resolve({ data: { revisions: { v1: 'Baseline', v2: 'Rev 1' }, changes: [] } }),
                api.get(`/progress/insights/${projectId}`)
            ]);

            setBurnStats(statsRes.data);
            setPlanVsAchieved(planRes.data);
            setScheduleDiff(diffRes.data);
            setInsights(insightsRes.data);
        } catch (err) {
            console.error("Failed to fetch progress dashboard data", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            Project Progress
                        </h2>
                        <p className="text-slate-500 text-sm mt-1 font-medium flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-500" />
                            Burn rate, schedule tracking & execution insights
                        </p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'dashboard'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <PieChart className="w-4 h-4" />
                            Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('entry')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'entry'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Plus className="w-4 h-4" />
                            New Entry
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'dashboard' ? (
                    <div className="h-full overflow-auto">
                        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6">

                            {/* 1. Burn Rate Cards */}
                            <BurnRateCards stats={burnStats} loading={loading} />

                            <div className="grid grid-cols-12 gap-6 min-h-[500px]">
                                {/* 2. Main Chart */}
                                <div className="col-span-12 xl:col-span-8">
                                    <BurnRateChart data={burnStats?.trends} loading={loading} />
                                </div>

                                {/* 3. Plan vs Achieved */}
                                <div className="col-span-12 xl:col-span-4">
                                    <PlanVsAchieved data={planVsAchieved} loading={loading} />
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-6 min-h-[500px]">
                                {/* 4. Schedule Comparison */}
                                <div className="col-span-12 xl:col-span-8">
                                    <ScheduleComparison data={scheduleDiff} loading={loading} />
                                </div>

                                {/* 5. Efficiency Insights */}
                                <div className="col-span-12 xl:col-span-4">
                                    <EfficiencyInsights data={insights} loading={loading} />
                                </div>
                            </div>

                        </div>
                    </div>
                ) : (
                    // Re-use existing Progress Entry View - Full Screen
                    <div className="h-full w-full">
                        <ProgressEntry />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressDashboard;
