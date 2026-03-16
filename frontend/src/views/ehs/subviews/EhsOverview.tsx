import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Hammer,
  Truck,
  UserCheck,
  Scale,
  ClipboardCheck,
  BookOpen,
} from "lucide-react";
import api from "../../../api/axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Props {
  projectId: number;
}

const COLORS = {
  valid: "#10b981", // Green
  expired: "#ef4444", // Red
  expiring: "#f59e0b", // Amber
  blue: "#3b82f6",
  purple: "#8b5cf6",
};

const EhsOverview: React.FC<Props> = ({ projectId }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await api.get(`/ehs/${projectId}/summary`);
        setSummary(response.data);
      } catch (error) {
        console.error("Error fetching EHS summary:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [projectId]);

  if (loading)
    return (
      <div className="animate-pulse space-y-8 p-6">Loading Dashboard...</div>
    );
  if (!summary) return <div className="p-6">No data available.</div>;

  // --- Derived Data & Alerts ---

  // 1. Critical Alerts List
  const criticalAlerts = [];
  if (summary.legal?.expired > 0)
    criticalAlerts.push({
      module: "Legal Register",
      count: summary.legal.expired,
      type: "Expired Compliance",
    });
  if (summary.machinery?.expired > 0)
    criticalAlerts.push({
      module: "Machinery",
      count: summary.machinery.expired,
      type: "Expired Certifications",
    });
  if (summary.vehicle?.expired > 0)
    criticalAlerts.push({
      module: "Vehicles",
      count: summary.vehicle.expired,
      type: "Expired Documents",
    });
  if (summary.competency?.expired > 0)
    criticalAlerts.push({
      module: "Competency",
      count: summary.competency.expired,
      type: "Expired Licenses",
    });
  if (summary.incidents?.fatal > 0)
    criticalAlerts.push({
      module: "Incidents",
      count: summary.incidents.fatal,
      type: "Fatal Incident Logged",
    });

  // 2. Incident Chart Data
  const incidentData = [
    { name: "Fatal", value: summary.incidents?.fatal || 0, color: "#ef4444" },
    { name: "Major", value: summary.incidents?.major || 0, color: "#f87171" },
    {
      name: "Dangerous",
      value: summary.incidents?.dangerous || 0,
      color: "#fca5a5",
    },
    { name: "Minor", value: summary.incidents?.minor || 0, color: "#fbbf24" },
    {
      name: "Near Miss",
      value: summary.incidents?.nearMiss || 0,
      color: "#34d399",
    },
    {
      name: "First Aid",
      value: summary.incidents?.firstAid || 0,
      color: "#60a5fa",
    },
  ].filter((i) => i.value > 0);

  // 3. Compliance Pie Data (Aggregated)
  const totalValid =
    (summary.legal?.valid || 0) +
    (summary.machinery?.valid || 0) +
    (summary.vehicle?.valid || 0) +
    (summary.competency?.valid || 0);
  const totalExpired =
    (summary.legal?.expired || 0) +
    (summary.machinery?.expired || 0) +
    (summary.vehicle?.expired || 0) +
    (summary.competency?.expired || 0);
  const totalExpiring =
    (summary.legal?.expiringSoon || 0) +
    (summary.machinery?.expiringSoon || 0) +
    (summary.vehicle?.expiringSoon || 0) +
    (summary.competency?.expiringSoon || 0);

  const complianceData = [
    { name: "Valid", value: totalValid },
    { name: "Expired", value: totalExpired },
    { name: "Expiring Soon", value: totalExpiring },
  ].filter((d) => d.value > 0);

  // KPI Cards Configuration
  const kpiCards = [
    {
      label: "Safe Man-Hours",
      value: summary.cumulativeSafeManhours?.toLocaleString() || "0",
      icon: Clock,
      color: "text-success",
      bg: "bg-success-muted",
      sub: "Cumulative",
    },
    {
      label: "Total Incidents",
      value: summary.incidents?.total || "0",
      icon: AlertOctagon,
      color: "text-error",
      bg: "bg-error-muted",
      sub:
        summary.incidents?.fatal > 0
          ? `${summary.incidents.fatal} Fatal`
          : "No Fatalities",
    },
    {
      label: "Inspections",
      value: `${summary.inspections?.completed || 0} / ${summary.inspections?.total || 0}`,
      icon: ClipboardCheck,
      color: "text-primary",
      bg: "bg-primary-muted",
      sub: `${summary.inspections?.pending || 0} Pending`,
    },
    {
      label: "Training Participants",
      value: summary.training?.participants || "0",
      icon: BookOpen,
      color: "text-purple-600",
      bg: "bg-purple-50",
      sub: `${summary.training?.total || 0} Sessions`,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. Critical Alerts Section */}
      {criticalAlerts.length > 0 ? (
        <div className="bg-error-muted border border-red-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-error" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900">
                Critical Attention Required
              </h3>
              <p className="text-sm text-red-700">
                The following items require immediate action to maintain
                compliance.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {criticalAlerts.map((alert, index) => (
              <div
                key={index}
                className="bg-surface-card p-4 rounded-xl border border-red-100 shadow-sm flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-text-disabled uppercase">
                    {alert.module}
                  </p>
                  <p className="font-medium text-text-primary">{alert.type}</p>
                </div>
                <div className="text-2xl font-black text-error">
                  {alert.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-success-muted border border-emerald-100 rounded-2xl p-6 flex items-center gap-4">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-success" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-900">
              System Status: Healthy
            </h3>
            <p className="text-sm text-emerald-700">
              No critical compliance issues or expired certifications found.
            </p>
          </div>
        </div>
      )}

      {/* 2. KPI Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm relative overflow-hidden transition-transform hover:-translate-y-1"
          >
            <div
              className={`absolute right-0 top-0 w-24 h-24 ${card.bg} -mr-8 -mt-8 rounded-full opacity-50`}
            />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <card.icon className={`w-8 h-8 ${card.color} mb-4`} />
                <h3 className="text-sm font-medium text-text-disabled uppercase tracking-wider">
                  {card.label}
                </h3>
                <p className="text-3xl font-black text-text-primary mt-1">
                  {card.value}
                </p>
              </div>
              <p className="text-xs text-text-muted mt-4 font-bold bg-surface-base px-2 py-1 rounded w-fit">
                {card.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Detailed Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Incident Breakdown */}
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-text-primary mb-6">
            Incident Severity Breakdown
          </h3>
          {incidentData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={incidentData}
                  layout="vertical"
                  margin={{ left: 40 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 13, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                    {incidentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-text-disabled">
              <ShieldCheck className="w-12 h-12 mb-2 opacity-20" />
              <p>No incidents recorded</p>
            </div>
          )}
        </div>

        {/* Overall Compliance Health */}
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm">
          <h3 className="text-lg font-bold text-text-primary mb-6">
            Overall Compliance Health
          </h3>
          <div className="h-56 relative">
            {complianceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={complianceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {complianceData.map((entry, index) => {
                      let fill = COLORS.valid;
                      if (entry.name === "Expired") fill = COLORS.expired;
                      if (entry.name === "Expiring Soon")
                        fill = COLORS.expiring;
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-text-disabled text-sm">
                No data
              </div>
            )}
            {/* Center Text */}
            {complianceData.length > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-8">
                <div className="text-center">
                  <span className="text-3xl font-black text-text-primary">
                    {Math.round(
                      (totalValid /
                        (totalValid + totalExpired + totalExpiring || 1)) *
                        100,
                    )}
                    %
                  </span>
                  <p className="text-xs text-text-muted uppercase font-bold">
                    Compliant
                  </p>
                </div>
              </div>
            )}
          </div>
          {/* Compliance Mini-Grid breakdown */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-3 bg-surface-base rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="w-4 h-4 text-text-muted" />
                <span className="text-xs font-bold text-text-muted">Legal</span>
              </div>
              <span
                className={`text-lg font-bold ${summary.legal?.expired > 0 ? "text-error" : "text-text-primary"}`}
              >
                {summary.legal?.valid}/{summary.legal?.total}
              </span>
            </div>
            <div className="p-3 bg-surface-base rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Hammer className="w-4 h-4 text-text-muted" />
                <span className="text-xs font-bold text-text-muted">
                  Machine
                </span>
              </div>
              <span
                className={`text-lg font-bold ${summary.machinery?.expired > 0 ? "text-error" : "text-text-primary"}`}
              >
                {summary.machinery?.valid}/{summary.machinery?.total}
              </span>
            </div>
            <div className="p-3 bg-surface-base rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4 text-text-muted" />
                <span className="text-xs font-bold text-text-muted">
                  Vehicle
                </span>
              </div>
              <span
                className={`text-lg font-bold ${summary.vehicle?.expired > 0 ? "text-error" : "text-text-primary"}`}
              >
                {summary.vehicle?.valid}/{summary.vehicle?.total}
              </span>
            </div>
            <div className="p-3 bg-surface-base rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-4 h-4 text-text-muted" />
                <span className="text-xs font-bold text-text-muted">Staff</span>
              </div>
              <span
                className={`text-lg font-bold ${summary.competency?.expired > 0 ? "text-error" : "text-text-primary"}`}
              >
                {summary.competency?.valid}/{summary.competency?.total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EhsOverview;
