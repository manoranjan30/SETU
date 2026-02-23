import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
    Users,
    AlertTriangle,
    Calendar,
    TrendingUp,
    Folder,
    ChevronRight,
    Activity,
    Clock,
    ArrowUpRight
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell
} from 'recharts';

interface SummaryData {
    totalProjects: number;
    activeProjects: number;
    delayedActivities: number;
    thisWeekBurn: number;
    todayManpower: number;
    projects: { id: number; name: string; status: string }[];
}

interface BurnRateData {
    trends: { date: string; value: number }[];
    total: number;
}

interface ManpowerData {
    total: number;
    byCategory: { name: string; count: number }[];
}

interface Milestone {
    id: number;
    name: string;
    dueDate: string;
    projectName: string;
    progress: number;
}

interface Alert {
    type: string;
    message: string;
    severity: string;
    count?: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)} K`;
    return `₹${value.toFixed(0)}`;
};

const ManagementDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [burnRate, setBurnRate] = useState<BurnRateData | null>(null);
    const [manpower, setManpower] = useState<ManpowerData | null>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [summaryRes, burnRes, manpowerRes, milestonesRes, alertsRes] = await Promise.all([
                api.get('/dashboard/summary'),
                api.get('/dashboard/burn-rate'),
                api.get('/dashboard/manpower'),
                api.get('/dashboard/milestones'),
                api.get('/dashboard/alerts')
            ]);

            // Filter projects based on user assignments if not Admin
            let filteredProjects = summaryRes.data.projects || [];
            if (user && !user.roles.includes('Admin')) {
                const allowedIds = user.project_ids || [];
                filteredProjects = filteredProjects.filter((p: any) => allowedIds.includes(p.id));
            }
            summaryRes.data.projects = filteredProjects;

            setSummary(summaryRes.data);
            setBurnRate(burnRes.data);
            setManpower(manpowerRes.data);
            setMilestones(milestonesRes.data);
            setAlerts(alertsRes.data);
        } catch (err) {
            console.error('Failed to load dashboard data', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-[1800px] mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Management Dashboard</h1>
                        <p className="text-slate-500 mt-1">Portfolio overview and key metrics</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                            Export PDF
                        </button>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                            Customize
                        </button>
                    </div>
                </div>

                {/* Quick Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        icon={<Folder className="w-5 h-5" />}
                        label="Total Projects"
                        value={summary?.totalProjects || 0}
                        color="blue"
                    />
                    <StatCard
                        icon={<TrendingUp className="w-5 h-5" />}
                        label="This Week Burn"
                        value={formatCurrency(summary?.thisWeekBurn || 0)}
                        color="green"
                    />
                    <StatCard
                        icon={<Users className="w-5 h-5" />}
                        label="Today's Manpower"
                        value={summary?.todayManpower || 0}
                        color="purple"
                    />
                    <StatCard
                        icon={<AlertTriangle className="w-5 h-5" />}
                        label="Delayed Activities"
                        value={summary?.delayedActivities || 0}
                        color="red"
                    />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Burn Rate Chart */}
                    <div className="col-span-12 xl:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Portfolio Burn Rate</h2>
                                <p className="text-sm text-slate-500">Last 30 days trend across all projects</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-green-600">{formatCurrency(burnRate?.total || 0)}</p>
                                <p className="text-xs text-slate-500">30-day total</p>
                            </div>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={burnRate?.trends || []}>
                                    <defs>
                                        <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                                        tickFormatter={(val) => formatCurrency(val)}
                                    />
                                    <Tooltip
                                        contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Spend']}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#3B82F6"
                                        strokeWidth={2}
                                        fill="url(#burnGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Today's Manpower */}
                    <div className="col-span-12 xl:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Today's Manpower</h2>
                                <p className="text-sm text-slate-500">By category breakdown</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-purple-600">{manpower?.total || 0}</p>
                                <p className="text-xs text-slate-500">workers</p>
                            </div>
                        </div>
                        <div className="h-[200px]">
                            {manpower && manpower.byCategory.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={manpower.byCategory}
                                            dataKey="count"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={2}
                                        >
                                            {manpower.byCategory.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400">
                                    No data recorded today
                                </div>
                            )}
                        </div>
                        <div className="mt-4 space-y-2">
                            {manpower?.byCategory.map((cat, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                        <span className="text-slate-600">{cat.name}</span>
                                    </div>
                                    <span className="font-semibold text-slate-800">{cat.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Second Row */}
                <div className="grid grid-cols-12 gap-6">
                    {/* My Projects */}
                    <div className="col-span-12 lg:col-span-6 xl:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">My Projects</h2>
                            <button
                                onClick={() => navigate('/dashboard/eps')}
                                className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1"
                            >
                                View All <ArrowUpRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {summary?.projects.map(project => (
                                <div
                                    key={project.id}
                                    onClick={() => navigate(`/dashboard/projects/${project.id}/progress`)}
                                    className="p-3 bg-slate-50 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                <Folder className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800">{project.name}</p>
                                                <p className="text-xs text-slate-500">{project.status}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                                    </div>
                                </div>
                            ))}
                            {(!summary?.projects || summary.projects.length === 0) && (
                                <div className="text-center py-8 text-slate-400">
                                    No projects assigned
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Alerts */}
                    <div className="col-span-12 lg:col-span-6 xl:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Alerts & Notifications</h2>
                            <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                                {alerts.length}
                            </span>
                        </div>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {alerts.map((alert, idx) => (
                                <div key={idx} className={`p-3 rounded-lg flex items-start gap-3 ${alert.severity === 'HIGH' ? 'bg-red-50' :
                                    alert.severity === 'MEDIUM' ? 'bg-orange-50' : 'bg-slate-50'
                                    }`}>
                                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${alert.severity === 'HIGH' ? 'text-red-500' :
                                        alert.severity === 'MEDIUM' ? 'text-orange-500' : 'text-slate-400'
                                        }`} />
                                    <div>
                                        <p className={`text-sm font-medium ${alert.severity === 'HIGH' ? 'text-red-700' :
                                            alert.severity === 'MEDIUM' ? 'text-orange-700' : 'text-slate-600'
                                            }`}>
                                            {alert.message}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">{alert.type.replace(/_/g, ' ')}</p>
                                    </div>
                                </div>
                            ))}
                            {alerts.length === 0 && (
                                <div className="text-center py-8 text-slate-400">
                                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No alerts at this time
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Upcoming Milestones */}
                    <div className="col-span-12 xl:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Upcoming Milestones</h2>
                            <Calendar className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {milestones.map((milestone) => (
                                <div key={milestone.id} className="p-3 bg-slate-50 rounded-lg">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="font-medium text-slate-800 text-sm truncate flex-1">{milestone.name}</p>
                                        <div className="flex items-center gap-1 text-xs text-slate-500 ml-2">
                                            <Clock className="w-3 h-3" />
                                            {new Date(milestone.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500">{milestone.projectName}</p>
                                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${milestone.progress || 0}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                            {milestones.length === 0 && (
                                <div className="text-center py-8 text-slate-400">
                                    No milestones in next 7 days
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) => {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        green: 'bg-green-50 text-green-600 border-green-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        red: 'bg-red-50 text-red-600 border-red-100'
    };

    return (
        <div className={`p-4 rounded-xl border ${colorClasses[color]} flex items-center gap-4`}>
            <div className={`p-3 rounded-lg ${color === 'blue' ? 'bg-blue-100' : color === 'green' ? 'bg-green-100' : color === 'purple' ? 'bg-purple-100' : 'bg-red-100'}`}>
                {icon}
            </div>
            <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs opacity-80">{label}</p>
            </div>
        </div>
    );
};

export default ManagementDashboard;
