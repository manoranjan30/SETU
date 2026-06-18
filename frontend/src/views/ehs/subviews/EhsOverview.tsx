import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Hammer,
  Scale,
  ShieldCheck,
  Truck,
  UserCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../../../api/axios";

interface Props {
  projectId: number;
}

interface ComplianceStats {
  total: number;
  valid: number;
  expired: number;
  expiringSoon: number;
}

interface EhsSummary {
  cumulativeSafeManhours: number;
  cumulativeManpower: number;
  incidents: {
    total: number;
    fatal: number;
    major: number;
    minor: number;
    firstAid: number;
    nearMiss: number;
    dangerous: number;
  };
  inspections: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
  training: {
    total: number;
    participants: number;
  };
  legal: ComplianceStats;
  machinery: ComplianceStats;
  vehicle: ComplianceStats;
  competency: ComplianceStats;
}

const chartColors = {
  valid: "#16a34a",
  expired: "#dc2626",
  expiring: "#d97706",
};

const number = (value: number | undefined) =>
  Number(value || 0).toLocaleString("en-IN");

const EhsOverview: React.FC<Props> = ({ projectId }) => {
  const [summary, setSummary] = useState<EhsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const response = await api.get<EhsSummary>(
          `/ehs/${projectId}/summary`,
        );
        if (active) setSummary(response.data);
      } catch (error) {
        console.error("Error fetching EHS summary:", error);
        if (active) setSummary(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchSummary();
    return () => {
      active = false;
    };
  }, [projectId]);

  const dashboard = useMemo(() => {
    if (!summary) return null;

    const criticalAlerts = [
      {
        module: "Legal register",
        count: summary.legal?.expired || 0,
        type: "Expired compliance items",
      },
      {
        module: "Machinery",
        count: summary.machinery?.expired || 0,
        type: "Expired certifications",
      },
      {
        module: "Vehicles",
        count: summary.vehicle?.expired || 0,
        type: "Expired documents",
      },
      {
        module: "Competency",
        count: summary.competency?.expired || 0,
        type: "Expired licenses or fitness",
      },
      {
        module: "Incidents",
        count: summary.incidents?.fatal || 0,
        type: "Fatal incidents recorded",
      },
    ].filter((alert) => alert.count > 0);

    const incidentData = [
      {
        name: "Fatal",
        value: summary.incidents?.fatal || 0,
        color: "#991b1b",
      },
      {
        name: "Major",
        value: summary.incidents?.major || 0,
        color: "#dc2626",
      },
      {
        name: "Dangerous",
        value: summary.incidents?.dangerous || 0,
        color: "#ea580c",
      },
      {
        name: "Minor",
        value: summary.incidents?.minor || 0,
        color: "#d97706",
      },
      {
        name: "Near miss",
        value: summary.incidents?.nearMiss || 0,
        color: "#0f766e",
      },
      {
        name: "First aid",
        value: summary.incidents?.firstAid || 0,
        color: "#2563eb",
      },
    ];

    const complianceRows = [
      { label: "Legal", icon: Scale, stats: summary.legal },
      { label: "Machinery", icon: Hammer, stats: summary.machinery },
      { label: "Vehicles", icon: Truck, stats: summary.vehicle },
      { label: "Competency", icon: UserCheck, stats: summary.competency },
    ];

    const totals = complianceRows.reduce(
      (result, row) => ({
        valid: result.valid + Number(row.stats?.valid || 0),
        expired: result.expired + Number(row.stats?.expired || 0),
        expiring: result.expiring + Number(row.stats?.expiringSoon || 0),
      }),
      { valid: 0, expired: 0, expiring: 0 },
    );
    const complianceTotal = totals.valid + totals.expired + totals.expiring;
    const compliancePercent =
      complianceTotal > 0
        ? Math.round((totals.valid / complianceTotal) * 100)
        : 100;

    return {
      criticalAlerts,
      incidentData,
      complianceRows,
      compliancePercent,
      complianceData: [
        { name: "Valid", value: totals.valid, color: chartColors.valid },
        {
          name: "Expiring soon",
          value: totals.expiring,
          color: chartColors.expiring,
        },
        { name: "Expired", value: totals.expired, color: chartColors.expired },
      ].filter((item) => item.value > 0),
    };
  }, [summary]);

  if (loading) {
    return (
      <div className="space-y-4" aria-label="Loading EHS overview">
        <div className="h-20 animate-pulse rounded-lg bg-surface-raised" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-lg bg-surface-raised"
            />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-lg bg-surface-raised" />
      </div>
    );
  }

  if (!summary || !dashboard) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-card p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-warning" />
        <p className="font-semibold text-text-primary">
          EHS overview is unavailable
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Refresh the page after checking the project connection.
        </p>
      </div>
    );
  }

  const kpis = [
    {
      label: "Safe man-hours",
      value: number(summary.cumulativeSafeManhours),
      detail: `${number(summary.cumulativeManpower)} cumulative manpower`,
      icon: Clock,
      accent: "text-emerald-700",
      iconBg: "bg-emerald-50",
    },
    {
      label: "Total incidents",
      value: number(summary.incidents?.total),
      detail:
        summary.incidents?.fatal > 0
          ? `${summary.incidents.fatal} fatal`
          : "No fatalities recorded",
      icon: AlertOctagon,
      accent:
        summary.incidents?.fatal > 0 ? "text-red-700" : "text-orange-700",
      iconBg:
        summary.incidents?.fatal > 0 ? "bg-red-50" : "bg-orange-50",
    },
    {
      label: "Inspections closed",
      value: `${number(summary.inspections?.completed)} / ${number(
        summary.inspections?.total,
      )}`,
      detail: `${number(summary.inspections?.pending)} pending, ${number(
        summary.inspections?.overdue,
      )} overdue`,
      icon: ClipboardCheck,
      accent: "text-blue-700",
      iconBg: "bg-blue-50",
    },
    {
      label: "Training reach",
      value: number(summary.training?.participants),
      detail: `${number(summary.training?.total)} training sessions`,
      icon: BookOpen,
      accent: "text-violet-700",
      iconBg: "bg-violet-50",
    },
  ];

  return (
    <div
      className="min-w-0 space-y-4 animate-in fade-in duration-300"
      data-testid="ehs-overview"
    >
      <section
        className={`rounded-lg border px-4 py-3 ${
          dashboard.criticalAlerts.length > 0
            ? "border-red-200 bg-red-50"
            : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                dashboard.criticalAlerts.length > 0
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {dashboard.criticalAlerts.length > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                className={`text-base font-bold ${
                  dashboard.criticalAlerts.length > 0
                    ? "text-red-950"
                    : "text-emerald-950"
                }`}
              >
                {dashboard.criticalAlerts.length > 0
                  ? "Compliance attention required"
                  : "EHS controls are healthy"}
              </h2>
              <p
                className={`mt-0.5 text-sm ${
                  dashboard.criticalAlerts.length > 0
                    ? "text-red-800"
                    : "text-emerald-800"
                }`}
              >
                {dashboard.criticalAlerts.length > 0
                  ? `${dashboard.criticalAlerts.length} areas have expired or critical records.`
                  : "No expired active compliance records or fatal incidents were found."}
              </p>
            </div>
          </div>

          {dashboard.criticalAlerts.length > 0 && (
            <div className="grid min-w-0 flex-[1.4] grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {dashboard.criticalAlerts.map((alert) => (
                <div
                  key={alert.module}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-red-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-red-950">
                      {alert.module}
                    </p>
                    <p className="truncate text-xs text-red-700">
                      {alert.type}
                    </p>
                  </div>
                  <span className="shrink-0 text-xl font-black text-red-700">
                    {alert.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="min-w-0 rounded-lg border border-border-subtle bg-surface-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-text-muted">
                  {kpi.label}
                </p>
                <p className="mt-2 truncate text-2xl font-black text-text-primary">
                  {kpi.value}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${kpi.iconBg}`}
              >
                <kpi.icon className={`h-5 w-5 ${kpi.accent}`} />
              </div>
            </div>
            <p className="mt-3 truncate text-xs font-medium text-text-muted">
              {kpi.detail}
            </p>
          </article>
        ))}
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-5">
        <article className="min-w-0 rounded-lg border border-border-subtle bg-surface-card p-4 shadow-sm xl:col-span-3">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-text-primary">
                Incident severity
              </h2>
              <p className="text-xs text-text-muted">
                Recorded incidents grouped by consequence
              </p>
            </div>
            <span className="text-sm font-bold text-text-primary">
              {number(summary.incidents?.total)} total
            </span>
          </div>

          <div className="h-[300px] min-w-0 sm:h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboard.incidentData}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 4 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="#e5e7eb"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={76}
                  tick={{ fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#f3f4f6" }}
                  contentStyle={{
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 8px 20px rgb(0 0 0 / 0.08)",
                  }}
                />
                <Bar dataKey="value" barSize={22} radius={[0, 4, 4, 0]}>
                  {dashboard.incidentData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-card p-4 shadow-sm xl:col-span-2">
          <div className="mb-2">
            <h2 className="text-base font-bold text-text-primary">
              Active compliance health
            </h2>
            <p className="text-xs text-text-muted">
              Inactive site records are excluded
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[180px_minmax(0,1fr)]">
            <div className="relative mx-auto h-[160px] w-[160px] sm:h-[172px] sm:w-[172px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={dashboard.complianceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={66}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {dashboard.complianceData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-text-primary">
                  {dashboard.compliancePercent}%
                </span>
                <span className="text-xs font-bold text-text-muted">
                  compliant
                </span>
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              {dashboard.complianceData.map((item) => (
                <div
                  key={item.name}
                  className="flex min-w-0 items-center justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <strong className="shrink-0 text-text-primary">
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 divide-y divide-border-subtle border-t border-border-subtle">
            {dashboard.complianceRows.map((row) => {
              const valid = Number(row.stats?.valid || 0);
              const total = Number(row.stats?.total || 0);
              const issues =
                Number(row.stats?.expired || 0) +
                Number(row.stats?.expiringSoon || 0);
              return (
                <div
                  key={row.label}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-secondary">
                    <row.icon className="h-4 w-4 shrink-0 text-text-muted" />
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-bold text-text-primary">
                    {valid}/{total}
                  </span>
                  {issues > 0 ? (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-orange-50 px-1.5 text-xs font-bold text-orange-700">
                      {issues}
                    </span>
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
};

export default EhsOverview;
