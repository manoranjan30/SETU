import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    BarChart3,
    Plus,
    PieChart,
    Activity,
    CheckCircle2
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// Components
import BurnRateCards from './BurnRateCards';
import BurnRateChart from './BurnRateChart';
import PlanVsAchieved from './PlanVsAchieved';
import ScheduleComparison from './ScheduleComparison';
import EfficiencyInsights from './EfficiencyInsights';
import ProgressEntry from '../../pages/execution/ProgressEntry';
import ApprovalsPage from '../../pages/execution/ApprovalsPage';

type ActiveTab = 'dashboard' | 'entry' | 'approvals';

const ProgressDashboard = () => {
    const { projectId } = useParams();
    const { hasPermission } = useAuth();
    const [loading, setLoading] = useState(true);

    // Permission checks
    const canViewDashboard = hasPermission('PROGRESS.DASHBOARD.READ');
    const canCreateEntry = hasPermission('EXECUTION.ENTRY.CREATE');
    const canApprove = hasPermission('EXECUTION.ENTRY.APPROVE');

    // Determine default tab based on permissions
    const getDefaultTab = (): ActiveTab => {
        if (canViewDashboard) return 'dashboard';
        if (canCreateEntry) return 'entry';
        if (canApprove) return 'approvals';
        return 'entry'; // Fallback — user at least has EXECUTION.ENTRY.READ
    };

    const [activeTab, setActiveTab] = useState<ActiveTab>(getDefaultTab());

    // Data States
    const [burnStats, setBurnStats] = useState<any>(null);
    const [planVsAchieved, setPlanVsAchieved] = useState<any>(null);
    const [scheduleDiff, setScheduleDiff] = useState<any>(null);
    const [insights, setInsights] = useState<any>(null);

    // Pending approval count for badge
    const [pendingCount, setPendingCount] = useState<number>(0);

    useEffect(() => {
        if (activeTab === 'dashboard' && canViewDashboard) {
            fetchDashboardData();
        }
    }, [projectId, activeTab]);

    // Poll pending count only if user has approve permission
    useEffect(() => {
        if (!projectId || !canApprove) return;
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 30_000);
        return () => clearInterval(interval);
    }, [projectId, canApprove]);

    const fetchPendingCount = async () => {
        try {
            const res = await api.get(`/execution/${projectId}/approvals/pending`);
            setPendingCount(Array.isArray(res.data) ? res.data.length : 0);
        } catch {
            // Silently fail — badge just won't show
        }
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [statsRes, planRes, insightsRes] = await Promise.all([
                api.get(`/progress/stats/${projectId}`),
                api.get(`/progress/plan-vs-achieved/${projectId}`),
                api.get(`/progress/insights/${projectId}`)
            ]);

            setBurnStats(statsRes.data);
            setPlanVsAchieved(planRes.data);
            setScheduleDiff({ revisions: { v1: 'Baseline', v2: 'Rev 1' }, changes: [] });
            setInsights(insightsRes.data);
        } catch (err) {
            console.error("Failed to fetch progress dashboard data", err);
        } finally {
            setLoading(false);
        }
    };

    // Refresh pending count after approvals are actioned
    const handleApprovalActioned = () => {
        fetchPendingCount();
    };

    // Count visible tabs
    const visibleTabs = [canViewDashboard, canCreateEntry, canApprove].filter(Boolean).length;

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 shadow-sm">
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

                    {/* Tab Switcher — only show tabs user has permission for */}
                    {visibleTabs > 1 && (
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                            {/* Dashboard Tab */}
                            {canViewDashboard && (
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
                            )}

                            {/* New Entry Tab */}
                            {canCreateEntry && (
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
                            )}

                            {/* Approvals Tab with Badge */}
                            {canApprove && (
                                <button
                                    onClick={() => setActiveTab('approvals')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 relative ${activeTab === 'approvals'
                                        ? 'bg-white text-amber-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Approvals
                                    {/* Notification Badge */}
                                    {pendingCount > 0 && (
                                        <span className={`
                                            absolute -top-1.5 -right-1.5
                                            min-w-[20px] h-5 px-1.5
                                            flex items-center justify-center
                                            rounded-full text-[11px] font-black text-white
                                            shadow-md
                                            ${activeTab === 'approvals'
                                                ? 'bg-amber-500'
                                                : 'bg-red-500 animate-pulse'
                                            }
                                        `}>
                                            {pendingCount > 99 ? '99+' : pendingCount}
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'dashboard' && canViewDashboard && (
                    <div className="h-full overflow-auto">
                        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6">
                            <BurnRateCards stats={burnStats} loading={loading} />

                            <div className="grid grid-cols-12 gap-6 min-h-[500px]">
                                <div className="col-span-12 xl:col-span-8">
                                    <BurnRateChart data={burnStats?.trends} loading={loading} />
                                </div>
                                <div className="col-span-12 xl:col-span-4">
                                    <PlanVsAchieved data={planVsAchieved} loading={loading} />
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-6 min-h-[500px]">
                                <div className="col-span-12 xl:col-span-8">
                                    <ScheduleComparison data={scheduleDiff} loading={loading} />
                                </div>
                                <div className="col-span-12 xl:col-span-4">
                                    <EfficiencyInsights data={insights} loading={loading} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'entry' && canCreateEntry && (
                    <div className="h-full w-full">
                        <ProgressEntry />
                    </div>
                )}

                {activeTab === 'approvals' && canApprove && (
                    <div className="h-full w-full overflow-auto">
                        <ApprovalsPage onActionComplete={handleApprovalActioned} />
                    </div>
                )}

                {/* Fallback: Show entry page if user only has READ access */}
                {activeTab === 'entry' && !canCreateEntry && (
                    <div className="h-full w-full">
                        <ProgressEntry />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressDashboard;
