import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Building2,
  Building,
  BriefcaseBusiness,
  CalendarRange,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
  executiveDashboardApi,
} from "../../services/executive-dashboard.service";
import type {
  ExecutiveListItem,
  ExecutiveMetric,
  ExecutiveOption,
  ExecutiveRankingGroup,
  ExecutiveSection,
  ExecutiveSummary,
  ExecutiveTab,
} from "../../services/executive-dashboard.service";

const getToday = () => new Date().toISOString().slice(0, 10);

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
};

const formatValue = (metric: { value: number | string; format?: string }) => {
  if (metric.format === "currency" && typeof metric.value === "number") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(metric.value);
  }

  if (metric.format === "percent" && typeof metric.value === "number") {
    return `${metric.value.toFixed(0)}%`;
  }

  if (typeof metric.value === "number") {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(metric.value);
  }

  return metric.value;
};

const toneClass = (tone?: string) => {
  switch (tone) {
    case "positive":
      return "text-emerald-600";
    case "warning":
      return "text-amber-600";
    case "danger":
      return "text-rose-600";
    default:
      return "text-slate-900";
  }
};

const severityClass = (severity?: string) => {
  switch (severity) {
    case "positive":
      return "border-emerald-200 bg-emerald-50/70";
    case "warning":
      return "border-amber-200 bg-amber-50/70";
    case "danger":
      return "border-rose-200 bg-rose-50/70";
    default:
      return "border-slate-200 bg-slate-50/80";
  }
};

const pillarTheme = {
  progressExecution: {
    title: "Progress & Execution",
    subtitle: "Planning, execution, commercials, and delivery pressure",
    icon: Activity,
    accent: "from-sky-500 to-blue-600",
    accentBg: "bg-sky-50 text-sky-700",
    stroke: "#0284c7",
    fill: "#0ea5e9",
  },
  quality: {
    title: "Quality",
    subtitle: "RFIs, observations, snag, audit, and readiness",
    icon: ShieldCheck,
    accent: "from-indigo-500 to-violet-600",
    accentBg: "bg-indigo-50 text-indigo-700",
    stroke: "#4f46e5",
    fill: "#6366f1",
  },
  ehs: {
    title: "EHS",
    subtitle: "Incidents, inspections, training, and compliance",
    icon: ShieldAlert,
    accent: "from-emerald-500 to-teal-600",
    accentBg: "bg-emerald-50 text-emerald-700",
    stroke: "#059669",
    fill: "#10b981",
  },
} as const;

function MetricCard({
  metric,
  onClick,
}: {
  metric: ExecutiveMetric;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick && metric.route);
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className={`rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition ${
        clickable ? "hover:-translate-y-0.5 hover:shadow-md" : ""
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {metric.label}
      </div>
      <div className={`mt-2 text-2xl font-black ${toneClass(metric.tone)}`}>
        {formatValue(metric)}
      </div>
      {metric.helper ? (
        <div className="mt-2 text-xs text-slate-500">{metric.helper}</div>
      ) : null}
    </button>
  );
}

function SectionColumn({
  sectionKey,
  section,
  onNavigate,
}: {
  sectionKey: keyof typeof pillarTheme;
  section: ExecutiveSection;
  onNavigate: (route?: string) => void;
}) {
  const theme = pillarTheme[sectionKey];
  const Icon = theme.icon;

  return (
    <section className="flex min-h-[620px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-2xl p-3 ${theme.accentBg}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{theme.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{theme.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {section.kpis.map((metric) => (
          <MetricCard
            key={metric.key}
            metric={metric}
            onClick={() => onNavigate(metric.route)}
          />
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {section.trend.label}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Selected period trend
            </div>
          </div>
          <TrendingUp className="h-4 w-4 text-slate-400" />
        </div>
        <div className="h-40 w-full">
          {section.trend.points.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={section.trend.points}>
                <defs>
                  <linearGradient id={`${sectionKey}-grad`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.fill} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={theme.fill} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis hide />
                <Tooltip
                  formatter={(value) => {
                    const rawValue = Array.isArray(value) ? value[0] : value;
                    if (typeof rawValue === "number") {
                      return formatValue({ value: rawValue, format: section.trend.format });
                    }

                    const numericValue = Number(rawValue);
                    if (Number.isFinite(numericValue)) {
                      return formatValue({ value: numericValue, format: section.trend.format });
                    }

                    return String(rawValue ?? "");
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={theme.stroke}
                  fill={`url(#${sectionKey}-grad)`}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
              No trend data in the selected period
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <ListPanel title="Alerts" items={section.alerts} onNavigate={onNavigate} />
        <ListPanel title="Action Queue" items={section.actions} onNavigate={onNavigate} />
      </div>
    </section>
  );
}

function ListPanel({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: ExecutiveListItem[];
  onNavigate: (route?: string) => void;
}) {
  return (
    <div className="flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 text-sm font-bold text-slate-900">{title}</div>
      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => onNavigate(item.route)}
              className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${severityClass(
                item.severity,
              )}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">
                    {item.description}
                  </div>
                </div>
                {item.value !== undefined ? (
                  <div className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">
                    {formatValue({ value: item.value })}
                  </div>
                ) : null}
              </div>
            </button>
          ))
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-400">
            Nothing urgent here right now.
          </div>
        )}
      </div>
    </div>
  );
}

function RankingPanel({
  group,
  onNavigate,
}: {
  group: ExecutiveRankingGroup;
  onNavigate: (route?: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 text-lg font-bold text-slate-900">{group.label}</div>
      <div className="space-y-3">
        {group.rows.length > 0 ? (
          group.rows.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={() => onNavigate(row.route)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                  {row.secondaryLabel ? (
                    <div className="mt-1 text-xs text-slate-500">{row.secondaryLabel}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {row.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      <span className="text-slate-400">{metric.label}: </span>
                      <span className={toneClass(metric.tone)}>{formatValue(metric)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
            No rows available for this scope yet.
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ExecutiveTab>("enterprise");
  const [companyOptions, setCompanyOptions] = useState<ExecutiveOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ExecutiveOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState(getMonthStart());
  const [dateTo, setDateTo] = useState(getToday());
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const loadCompanies = async () => {
    const response = await executiveDashboardApi.getCompanies();
    setCompanyOptions(response.data);
  };

  const loadProjects = async (companyId?: number | null) => {
    const response = await executiveDashboardApi.getProjects(companyId);
    setProjectOptions(response.data);
    setSelectedProjectId((current) =>
      response.data.some((project) => project.id === current) ? current : null,
    );
  };

  useEffect(() => {
    loadCompanies().catch(() => undefined);
  }, []);

  useEffect(() => {
    loadProjects(selectedCompanyId).catch(() => undefined);
  }, [selectedCompanyId]);

  useEffect(() => {
    if (tab === "company" && !selectedCompanyId && companyOptions.length > 0) {
      setSelectedCompanyId(companyOptions[0].id);
    }
  }, [tab, companyOptions, selectedCompanyId]);

  useEffect(() => {
    if (tab === "project" && !selectedProjectId && projectOptions.length > 0) {
      setSelectedProjectId(projectOptions[0].id);
    }
  }, [tab, projectOptions, selectedProjectId]);

  useEffect(() => {
    const loadSummary = async () => {
      if (tab === "company" && !selectedCompanyId) {
        setSummary(null);
        setLoading(false);
        return;
      }

      if (tab === "project" && !selectedProjectId) {
        setSummary(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = { dateFrom, dateTo };
        const response =
          tab === "enterprise"
            ? await executiveDashboardApi.getEnterprise(params)
            : tab === "company"
              ? await executiveDashboardApi.getCompany(selectedCompanyId!, params)
              : await executiveDashboardApi.getProject(selectedProjectId!, params);
        setSummary(response.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load executive dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadSummary().catch(() => undefined);
  }, [tab, selectedCompanyId, selectedProjectId, dateFrom, dateTo, refreshTick]);

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCompanies(), loadProjects(selectedCompanyId)]);
      setRefreshTick((value) => value + 1);
    } finally {
      setLoading(false);
    }
  };

  const onNavigate = (route?: string) => {
    if (route) navigate(route);
  };

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto bg-slate-50 p-4 text-slate-800">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Executive Control Center
              </div>
              <h1 className="mt-2 text-3xl font-black text-slate-900">
                Portfolio Dashboard
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Three pillars, one decision surface: progress & execution, quality,
                and EHS across enterprise, company, or project scope.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: "enterprise" as const, label: "Enterprise", icon: Building2 },
                { key: "company" as const, label: "Company", icon: Building },
                { key: "project" as const, label: "Project", icon: BriefcaseBusiness },
              ].map((item) => {
                const Icon = item.icon;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Date From
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Date To
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Company
              </span>
              <select
                value={selectedCompanyId ?? ""}
                onChange={(e) =>
                  setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)
                }
                disabled={tab === "enterprise"}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white disabled:opacity-60"
              >
                <option value="">All accessible companies</option>
                {companyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Project
              </span>
              <select
                value={selectedProjectId ?? ""}
                onChange={(e) =>
                  setSelectedProjectId(e.target.value ? Number(e.target.value) : null)
                }
                disabled={tab !== "project"}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white disabled:opacity-60"
              >
                <option value="">Select project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={refreshAll}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="font-medium">Building executive view...</span>
            </div>
          </div>
        ) : summary ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
              {summary.headline.map((metric) => (
                <MetricCard
                  key={metric.key}
                  metric={metric}
                  onClick={() => onNavigate(metric.route)}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <SectionColumn
                sectionKey="progressExecution"
                section={summary.progressExecution}
                onNavigate={onNavigate}
              />
              <SectionColumn
                sectionKey="quality"
                section={summary.quality}
                onNavigate={onNavigate}
              />
              <SectionColumn sectionKey="ehs" section={summary.ehs} onNavigate={onNavigate} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {summary.rankings.map((group) => (
                <RankingPanel key={group.key} group={group} onNavigate={onNavigate} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="max-w-md text-center">
              <CalendarRange className="mx-auto h-8 w-8 text-slate-400" />
              <div className="mt-3 text-lg font-semibold text-slate-900">
                Select a scope to continue
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Company and project tabs need a selected scope before the executive
                summary can be loaded.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
