import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import {
  AlertTriangle,
  Calendar,
  Folder,
  Activity,
  Shield,
  CheckCircle,
  HeartPulse,
  AlertOctagon,
  Users
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from "recharts";

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

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)} K`;
  return `₹${value.toFixed(0)}`;
};

const MOCK_QUALITY = {
  openObservations: 42,
  closedThisWeek: 18,
  criticalNCRs: 3,
  pendingApprovals: 8,
  ncrAging: [
    { name: "< 7 Days", count: 15 },
    { name: "7-14 Days", count: 8 },
    { name: "> 14 Days", count: 5 }
  ]
};

const MOCK_EHS = {
  safeManHours: "124,500",
  lti: 0,
  nearMisses: 4,
  medicalTreated: 1,
  complianceRate: 94
};

const ManagementDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [burnRate, setBurnRate] = useState<BurnRateData | null>(null);
  const [, setManpower] = useState<ManpowerData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<any>(null);
  const [ehsMetrics, setEhsMetrics] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        summaryRes,
        burnRes,
        manpowerRes,
        milestonesRes,
        alertsRes,
        qualityRes,
        ehsRes,
      ] = await Promise.all([
        api.get("/dashboard/summary").catch(() => ({ data: { totalProjects: 8, activeProjects: 5, thisWeekBurn: 15400000, todayManpower: 450, projects: [] }})),
        api.get("/dashboard/burn-rate").catch(() => ({ data: { trends: [], total: 0 }})),
        api.get("/dashboard/manpower").catch(() => ({ data: { total: 450, byCategory: [{name: 'Skilled', count: 200}, {name: 'Unskilled', count: 250}] }})),
        api.get("/dashboard/milestones").catch(() => ({ data: [] })),
        api.get("/dashboard/alerts").catch(() => ({ data: [] })),
        api.get("/dashboard/quality-metrics").catch(() => ({ data: MOCK_QUALITY })),
        api.get("/dashboard/ehs-metrics").catch(() => ({ data: MOCK_EHS })),
      ]);

      let filteredProjects = summaryRes.data.projects || [];
      if (user && !user.roles.includes("Admin")) {
        const allowedIds = user.project_ids || [];
        filteredProjects = filteredProjects.filter((p: any) =>
          allowedIds.includes(p.id)
        );
      }
      summaryRes.data.projects = filteredProjects;

      setSummary(summaryRes.data);
      setBurnRate(burnRes.data);
      setManpower(manpowerRes.data);
      setMilestones(milestonesRes.data);
      setAlerts(alertsRes.data);
      setQualityMetrics(qualityRes.data);
      setEhsMetrics(ehsRes.data);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <Activity className="h-8 w-8 text-primary" />
          <span className="text-sm font-medium text-slate-500">Initializing Control Center...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-slate-50 overflow-hidden font-sans text-slate-800 p-4">
      
      {/* Dynamic 3-Pillar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        
        {/* ======================================================== */}
        {/* PILLAR 1: PROGRESS & EXECUTION (Blues/Slates)            */}
        {/* ======================================================== */}
        <div className="flex flex-col gap-4 h-full w-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Pillar Header Ribbon */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Activity className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <h2 className="text-sm font-bold text-slate-900">Progress & Execution</h2>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{summary?.activeProjects || 0} Active Projects</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-slate-800">{formatCurrency(summary?.thisWeekBurn || 0)}</div>
              <div className="text-[10px] font-semibold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5 inline-block">Weekly Burn</div>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col gap-5 overflow-hidden">
            
            {/* Burn Rate Mini-Chart */}
            <div className="shrink-0">
               <div className="flex justify-between items-end mb-2">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">30-Day Trajectory</h3>
                 <span className="text-xs font-bold text-slate-800">{formatCurrency(burnRate?.total || 0)}</span>
               </div>
               <div className="h-24 w-full bg-slate-50/50 rounded-xl">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={burnRate?.trends || []} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} fill="url(#blueGrad)" isAnimationActive={false} />
                    </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>

            {/* Manpower Widget */}
            <div className="bg-slate-50 rounded-xl p-4 shrink-0 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="h-12 w-12 rounded-full border-4 border-slate-200 flex items-center justify-center shrink-0 relative overflow-hidden">
                   <Users className="h-5 w-5 text-slate-500" />
                   {/* Decorative border based on data, simplified for visual */}
                 </div>
                 <div>
                   <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Today's Workforce</h3>
                   <div className="text-2xl font-black text-slate-800 leading-none mt-1">{summary?.todayManpower || 0}</div>
                 </div>
               </div>
            </div>

            {/* Milestones / Alerts (Scrollable if needed, but flex-1 constraint) */}
            <div className="flex-1 flex flex-col min-h-0">
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Critical Timelines</h3>
               <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
                 {milestones.length > 0 ? milestones.slice(0, 4).map((m, i) => (
                   <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100/60">
                     <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-800 truncate pr-2">{m.name}</span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 rounded whitespace-nowrap">{m.progress}%</span>
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
                       <Folder className="h-3 w-3" /> <span className="truncate">{m.projectName}</span>
                     </div>
                   </div>
                 )) : (
                   <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                     <Calendar className="h-6 w-6" />
                     <span className="text-xs font-semibold">No critical deadlines</span>
                   </div>
                 )}
               </div>
            </div>

          </div>
        </div>


        {/* ======================================================== */}
        {/* PILLAR 2: QUALITY CONTROL (Indigos/Ambers)               */}
        {/* ======================================================== */}
        <div className="flex flex-col gap-4 h-full w-full overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          
          {/* Pillar Header Ribbon */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <h2 className="text-sm font-bold text-slate-900">Quality Control</h2>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Inspection Metrics</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-amber-600">{qualityMetrics?.criticalNCRs || 0}</div>
              <div className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-0.5 inline-block border border-amber-100/50">Critical NCRs</div>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col gap-5 overflow-hidden">
            
            {/* 3-Block Status Grid */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
               <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100/60 flex flex-col justify-center">
                 <div className="text-2xl font-black text-indigo-600">{qualityMetrics?.openObservations || 0}</div>
                 <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Open</div>
               </div>
               <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100/60 flex flex-col justify-center">
                 <div className="text-2xl font-black text-emerald-600">{qualityMetrics?.closedThisWeek || 0}</div>
                 <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Closed (Wk)</div>
               </div>
               <div className="bg-indigo-50/50 rounded-xl p-3 text-center border border-indigo-100/50 flex flex-col justify-center">
                 <div className="text-2xl font-black text-indigo-800">{qualityMetrics?.pendingApprovals || 0}</div>
                 <div className="text-[9px] font-bold text-indigo-600/80 uppercase tracking-wider mt-1">Pending QA</div>
               </div>
            </div>

            {/* Dense NCR Aging Profile Chart */}
            <div className="bg-slate-50 rounded-xl p-4 shrink-0 flex items-center justify-between border border-slate-100/60">
              <div className="w-1/2 relative h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={qualityMetrics?.ncrAging || []} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2} stroke="none">
                      <Cell fill="#6366f1" /> {/* < 7 Days Indigo-500 */}
                      <Cell fill="#4f46e5" /> {/* 7-14 Days Indigo-600 */}
                      <Cell fill="#312e81" /> {/* > 14 Days Indigo-900 */}
                    </Pie>
                    <Tooltip cursor={false} contentStyle={{ borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 flex flex-col gap-2 pl-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NCR Aging</h3>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-[#6366f1]"></div> &lt; 7 Days
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-[#4f46e5]"></div> 7-14 Days
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-[#312e81]"></div> &gt; 14 Days
                </div>
              </div>
            </div>

            {/* Quality Specific Alerts */}
            <div className="flex-1 flex flex-col min-h-0">
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Priority Observations</h3>
               <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
                 {alerts.filter(a => a.type.includes('QUALITY') || a.severity === 'HIGH').slice(0, 3).map((a, i) => (
                   <div key={i} className="flex gap-3 p-3 rounded-xl bg-amber-50/40 border border-amber-100/60">
                     <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                     <div>
                       <p className="text-xs font-bold text-slate-800 leading-snug">{a.message}</p>
                       <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mt-1 block">{a.type.replace(/_/g, ' ')}</span>
                     </div>
                   </div>
                 ))}
                 {alerts.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                     <CheckCircle className="h-6 w-6" />
                     <span className="text-xs font-semibold">No critical quality alerts</span>
                   </div>
                 )}
               </div>
            </div>

          </div>
        </div>


        {/* ======================================================== */}
        {/* PILLAR 3: EHS SAFETY (Emeralds/Roses)                    */}
        {/* ======================================================== */}
        <div className="flex flex-col gap-4 h-full w-full overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          
          {/* Pillar Header Ribbon */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                 <h2 className="text-sm font-bold text-slate-900">Health & Safety</h2>
                 <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Incident Tracking</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-emerald-600">{ehsMetrics?.safeManHours || 0}</div>
              <div className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5 inline-block border border-emerald-100/50">Safe Man-Hrs</div>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col justify-between overflow-hidden">
            
            <div className="space-y-5 shrink-0">
              {/* Incident Tracker Horizontal */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quarterly Incidents</h3>
                <div className="flex gap-3">
                  <div className="flex-1 bg-emerald-50/50 rounded-xl p-3 text-center border border-emerald-100/50 hover:bg-emerald-50 transition-colors">
                    <div className="text-2xl font-black text-emerald-600 mb-0.5">{ehsMetrics?.lti || 0}</div>
                    <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">LTI</div>
                  </div>
                  <div className="flex-1 bg-amber-50/50 rounded-xl p-3 text-center border border-amber-100/50 hover:bg-amber-50 transition-colors">
                    <div className="text-2xl font-black text-amber-600 mb-0.5">{ehsMetrics?.medicalTreated || 0}</div>
                    <div className="text-[9px] font-bold text-amber-700 uppercase tracking-widest">Medical</div>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center border border-slate-100/60 hover:bg-slate-100/50 transition-colors">
                    <div className="text-2xl font-black text-slate-600 mb-0.5">{ehsMetrics?.nearMisses || 0}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Near Miss</div>
                  </div>
                </div>
              </div>

              {/* Compliance Gauge (Simulated with progress bar for density) */}
              <div className="bg-slate-900 rounded-xl p-5 text-white relative overflow-hidden shrink-0">
                 {/* Decorative background element */}
                 <div className="absolute -right-6 -top-6 h-24 w-24 bg-emerald-500/20 rounded-full blur-2xl"></div>
                 
                 <div className="flex justify-between items-end mb-4 relative z-10">
                   <div>
                     <h3 className="text-xl font-black">{ehsMetrics?.complianceRate || 0}%</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Audit Compliance</p>
                   </div>
                   <Shield className="h-8 w-8 text-emerald-400 opacity-80" />
                 </div>
                 
                 <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative z-10">
                   <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${ehsMetrics?.complianceRate || 0}%` }}></div>
                 </div>
              </div>
            </div>

            {/* Quick Action anchored at bottom */}
            <div className="mt-auto pt-6">
              <button className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white font-bold text-sm py-4 shadow-sm shadow-rose-200 hover:shadow-md transition-all active:scale-[0.98]">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <AlertOctagon className="h-4 w-4" />
                  Log Urgent Hazard
                </span>
              </button>
            </div>

          </div>
        </div>

      </div>

      <style>{`
        /* Hide scrollbars globally for this specific dense view to maintain the application-like feel */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default ManagementDashboard;
