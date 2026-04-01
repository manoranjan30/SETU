import { useEffect, useMemo, useRef, useState } from "react";
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
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Building,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { executiveDashboardApi } from "../../services/executive-dashboard.service";
import { aiInsightsService } from "../../services/aiInsights.service";
import { useTheme } from "../../context/ThemeContext";
import ProjectProgress3DPanel from "../../components/planning/ProjectProgress3DPanel";
import { filterOperationalProjects } from "../../utils/project-lifecycle.utils";
import type {
  ExecutiveListItem,
  ExecutiveMetric,
  ExecutiveOption,
  ExecutiveRankingGroup,
  ExecutiveSection,
  ExecutiveSummary,
  ExecutiveTab,
} from "../../services/executive-dashboard.service";
import type { InsightRun } from "../../services/aiInsights.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getToday = () => new Date().toISOString().slice(0, 10);
const getMonthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const formatCurrencyInCrores = (value: number) => {
  const crores = value / 10_000_000;
  return `₹${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: crores >= 100 ? 0 : 2,
    maximumFractionDigits: crores >= 100 ? 0 : 2,
  }).format(crores)} Cr`;
};

const formatValue = (m: { value: number | string; format?: string }) => {
  if (m.format === "currency" && typeof m.value === "number")
    return formatCurrencyInCrores(m.value);
  if (m.format === "percent" && typeof m.value === "number")
    return `${m.value.toFixed(1)}%`;
  if (typeof m.value === "number")
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(m.value);
  return m.value;
};

// Returns CSS variable color string for a metric tone
const toneColor = (tone?: string) => {
  if (tone === "positive") return "var(--color-success)";
  if (tone === "warning")  return "var(--color-warning)";
  if (tone === "danger")   return "var(--color-error)";
  return "var(--color-primary)";
};

const toneMutedBg = (tone?: string) => {
  if (tone === "positive") return "var(--color-success-muted)";
  if (tone === "warning")  return "var(--color-warning-muted)";
  if (tone === "danger")   return "var(--color-error-muted)";
  return "var(--color-primary-muted)";
};

const toneLabel = (tone?: string) =>
  tone === "positive" ? "Good" : tone === "warning" ? "Watch" : tone === "danger" ? "Risk" : "Live";

type AiInsightBulletin = {
  runId: number;
  title: string;
  subtitle: string;
  bullets: string[];
};

const buildAiInsightBulletin = (run: InsightRun | null): AiInsightBulletin | null => {
  if (!run || run.status !== "COMPLETED" || !run.result) return null;
  const result = run.result as Record<string, unknown>;
  const sections = Array.isArray(result.sections)
    ? (result.sections as { title?: string; content?: string }[])
    : [];
  const recommendations = Array.isArray(result.recommendations)
    ? (result.recommendations as string[])
    : [];
  const keyMetrics = Array.isArray(result.keyMetrics)
    ? (result.keyMetrics as { label?: string; value?: string }[])
    : [];

  const bullets = [
    ...(typeof result.headline === "string" ? [result.headline] : []),
    ...sections.flatMap((section) =>
      typeof section?.content === "string"
        ? [`${section.title ? `${section.title}: ` : ""}${section.content}`]
        : [],
    ),
    ...recommendations.filter((item): item is string => typeof item === "string"),
    ...keyMetrics.flatMap((metric) =>
      metric?.label && metric?.value ? [`${metric.label}: ${metric.value}`] : [],
    ),
  ]
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!bullets.length) return null;

  return {
    runId: run.id,
    title: run.template?.name || "Recent AI Insight",
    subtitle: run.completedAt
      ? new Date(run.completedAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        })
      : "Latest completed run",
    bullets,
  };
};

// ─── Pillar definitions ───────────────────────────────────────────────────────

const PILLAR = {
  progressExecution: {
    title:    "Progress & Execution",
    subtitle: "Planning · Commercial · Delivery",
    icon:     Activity,
    gradStart: "var(--color-primary)",
    gradEnd:   "var(--color-primary-dark)",
    accentVar: "--color-primary",
  },
  quality: {
    title:    "Quality",
    subtitle: "RFIs · Observations · Closeout",
    icon:     ShieldCheck,
    gradStart: "var(--color-secondary)",
    gradEnd:   "var(--color-secondary-dark)",
    accentVar: "--color-secondary",
  },
  ehs: {
    title:    "EHS",
    subtitle: "Incidents · Compliance · Training",
    icon:     ShieldAlert,
    gradStart: "var(--color-success)",
    gradEnd:   "#047857",
    accentVar: "--color-success",
  },
} as const;

// ─── ProgressRing ─────────────────────────────────────────────────────────────

function ProgressRing({ percent, color, size = 42 }: { percent: number; color: string; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, percent)) / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4}
          stroke="var(--color-border-default)" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4}
          stroke={color} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold"
        style={{ fontSize: 9, color: "var(--color-text-secondary)" }}>
        {percent.toFixed(0)}%
      </div>
    </div>
  );
}

const metricNumber = (metric?: ExecutiveMetric | null) => {
  if (!metric) return 0;
  if (typeof metric.value === "number") return metric.value;
  const parsed = Number(metric.value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// ─── KPI Headline Chip ────────────────────────────────────────────────────────

function KpiChip({ metric, onClick }: { metric: ExecutiveMetric; onClick?: () => void }) {
  const clickable = Boolean(onClick && metric.route);
  const color = toneColor(metric.tone);
  const visualPct =
    typeof metric.visualPercent === "number" ? metric.visualPercent :
    metric.format === "percent" && typeof metric.value === "number" ? metric.value : null;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className="group relative flex min-w-[175px] flex-col gap-2 overflow-hidden rounded-2xl p-4 text-left transition"
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        boxShadow: "var(--card-shadow)",
        cursor: clickable ? "pointer" : "default",
      }}
      onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.boxShadow = "var(--card-shadow-hover)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--card-shadow)"; }}
    >
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />

      {/* Live dot */}
      <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />

      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] pr-4"
        style={{ color: "var(--color-text-muted)" }}>
        {metric.label}
      </div>

      <div className="text-2xl font-black tracking-tight"
        style={{ color }}>
        {formatValue(metric)}
      </div>

      {visualPct !== null && (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--color-border-default)" }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, visualPct)}%`, backgroundColor: color }} />
          </div>
          <span className="text-[10px] font-medium shrink-0"
            style={{ color: "var(--color-text-muted)" }}>
            {visualPct.toFixed(0)}%
          </span>
        </div>
      )}

      {metric.helper && (
        <div className="text-[10px] leading-4"
          style={{ color: "var(--color-text-muted)" }}>
          {metric.helper}
        </div>
      )}

      {clickable && (
        <ArrowUpRight className="absolute right-3 bottom-3 h-3.5 w-3.5 transition group-hover:scale-110"
          style={{ color: "var(--color-text-muted)" }} />
      )}
    </button>
  );
}

function AiInsightBulletinChip({
  bulletin,
  onClick,
}: {
  bulletin: AiInsightBulletin | null;
  onClick?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [marqueeSeconds, setMarqueeSeconds] = useState(0);
  const [shouldMarquee, setShouldMarquee] = useState(false);
  const textViewportRef = useRef<HTMLDivElement | null>(null);
  const textTrackRef = useRef<HTMLParagraphElement | null>(null);
  const clickable = Boolean(onClick);

  useEffect(() => {
    setActiveIndex(0);
  }, [bulletin?.runId]);

  useEffect(() => {
    if (!bulletin || bulletin.bullets.length <= 1) return;
    const currentBullet = bulletin.bullets[activeIndex] || "";
    const displayMs = Math.max(3600, currentBullet.length * 85);
    const intervalId = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % bulletin.bullets.length);
    }, displayMs);
    return () => window.clearTimeout(intervalId);
  }, [activeIndex, bulletin]);

  const currentBullet =
    bulletin?.bullets[activeIndex] ||
    "Run an AI insight to see recent executive bulletins here.";

  useEffect(() => {
    const viewport = textViewportRef.current;
    const track = textTrackRef.current;
    if (!viewport || !track) {
      setShouldMarquee(false);
      return;
    }
    const overflow = track.scrollWidth - viewport.clientWidth;
    if (overflow > 18) {
      setShouldMarquee(true);
      setMarqueeSeconds(Math.max(7, currentBullet.length * 0.12));
    } else {
      setShouldMarquee(false);
      setMarqueeSeconds(0);
    }
  }, [currentBullet]);

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className="group relative flex h-[118px] w-full flex-col overflow-hidden rounded-2xl px-4 py-3 text-left transition"
      style={{
        background: "linear-gradient(135deg, rgba(15,118,110,0.08), rgba(59,130,246,0.08))",
        border: "1px solid var(--color-border-default)",
        boxShadow: "var(--card-shadow)",
        cursor: clickable ? "pointer" : "default",
      }}
      onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.boxShadow = "var(--card-shadow-hover)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--card-shadow)"; }}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl"
        style={{ background: "linear-gradient(90deg, var(--color-secondary), var(--color-primary))" }} />
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--color-text-muted)" }}>
          AI Insight
        </div>
        <div className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold"
          style={{ background: "var(--color-surface-card)", color: "var(--color-secondary)" }}>
          {bulletin ? `${activeIndex + 1}/${bulletin.bullets.length}` : "AI"}
        </div>
      </div>

      <div className="mt-2 flex min-h-[74px] items-start gap-2 rounded-xl px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.7)", border: "1px solid var(--color-border-subtle)" }}>
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "var(--color-secondary)" }} />
        <div ref={textViewportRef} className="min-w-0 flex-1 overflow-hidden">
          <p
            ref={textTrackRef}
            className="text-[12px] leading-5 whitespace-nowrap"
            style={{
              color: "var(--color-text-secondary)",
              animation: shouldMarquee
                ? `dashboard-ai-marquee ${marqueeSeconds}s linear infinite alternate`
                : "none",
            }}
          >
            {currentBullet}
          </p>
        </div>
      </div>

      {clickable && (
        <ArrowUpRight className="absolute right-3 bottom-3 h-3.5 w-3.5 transition group-hover:scale-110"
          style={{ color: "var(--color-text-muted)" }} />
      )}
      <style>{`
        @keyframes dashboard-ai-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-100% + 420px)); }
        }
      `}</style>
    </button>
  );
}

// ─── Pillar Top KPI Bar ───────────────────────────────────────────────────────

function PillarKpiBar({ section, pillarKey }: {
  section: ExecutiveSection;
  pillarKey: keyof typeof PILLAR;
}) {
  const kpis =
    section.kpis.some((metric) => metric.key === "woIssuedValue") &&
    section.kpis.some((metric) => /delay/i.test(metric.key) || /delay/i.test(metric.label))
      ? section.kpis.filter((metric) => !(/delay/i.test(metric.key) || /delay/i.test(metric.label)))
      : section.kpis;

  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {kpis.slice(0, 3).map((m) => (
        <div key={m.key} className="rounded-xl px-3 py-2.5"
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.25)",
            minHeight: pillarKey === "progressExecution" && m.key === "actualProgress" ? 74 : undefined,
          }}>
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1"
            style={{ color: "rgba(255,255,255,0.65)" }}>
            {m.label}
          </div>
          <div
            className="font-black text-white"
            style={{
              fontSize:
                pillarKey === "progressExecution" && m.key === "actualProgress" ? "1.5rem" : "1.125rem",
              lineHeight: 1.1,
            }}
          >
            {formatValue(m)}
          </div>
          {m.tone && m.tone !== "default" && (
            <div className="mt-1 text-[9px] font-semibold uppercase"
              style={{ color: m.tone === "positive" ? "#86efac" : m.tone === "warning" ? "#fde68a" : "#fca5a5" }}>
              {toneLabel(m.tone)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MetricMiniCard({ metric, pillarKey, onClick }: {
  metric: ExecutiveMetric;
  pillarKey: keyof typeof PILLAR;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick && metric.route);
  const color = toneColor(metric.tone);
  const pct =
    typeof metric.visualPercent === "number"
      ? Math.min(100, Math.max(0, metric.visualPercent))
      : metric.format === "percent" && typeof metric.value === "number"
        ? Math.min(100, Math.max(0, metric.value))
        : null;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className="group relative overflow-hidden rounded-2xl p-4 text-left transition"
      style={{
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-subtle)",
        minHeight: 96,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: "var(--color-text-muted)" }}>
        {metric.label}
      </div>
      <div className="text-[1.7rem] font-black leading-none" style={{ color }}>
        {formatValue(metric)}
      </div>
      {pct !== null ? (
        <div className="mt-2.5">
          <div className="h-1.5 overflow-hidden rounded-full"
            style={{ background: "var(--color-border-default)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: `var(${PILLAR[pillarKey].accentVar})` }}
            />
          </div>
          {metric.visualLabel && (
            <div className="mt-1 text-[9px] leading-4"
              style={{ color: "var(--color-text-muted)" }}>
              {metric.visualLabel}
            </div>
          )}
        </div>
      ) : (
        metric.helper && (
          <div className="mt-2 text-[9px] leading-4" style={{ color: "var(--color-text-muted)" }}>
            {metric.helper}
          </div>
        )
      )}
    </button>
  );
}

function ExecutionComparisonCard({
  burnMetric,
  budgetMetric,
  woIssuedMetric,
  onClick,
}: {
  burnMetric?: ExecutiveMetric | null;
  budgetMetric?: ExecutiveMetric | null;
  woIssuedMetric?: ExecutiveMetric | null;
  onClick?: (route?: string) => void;
}) {
  if (!burnMetric) return null;

  const burn = metricNumber(burnMetric);
  const budget = metricNumber(budgetMetric);
  const woIssued = metricNumber(woIssuedMetric);
  const budgetRatio = budget > 0 ? Math.min(100, (burn / budget) * 100) : 0;
  const woRatio = woIssued > 0 ? Math.min(100, (burn / woIssued) * 100) : 0;
  const clickable = Boolean(onClick && burnMetric.route);

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onClick?.(burnMetric.route) : undefined}
      className="group rounded-2xl p-4 text-left transition"
      style={{
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-subtle)",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--color-text-muted)" }}>
            {burnMetric.label}
          </div>
          <div className="mt-2 text-[1.8rem] font-black leading-none" style={{ color: toneColor(burnMetric.tone) }}>
            {formatValue(burnMetric)}
          </div>
        </div>
        <div className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase"
          style={{ background: toneMutedBg(burnMetric.tone), color: toneColor(burnMetric.tone) }}>
          Live
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl p-3" style={{ background: "var(--color-surface-card)" }}>
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--color-text-muted)" }}>
            Burn vs Budget Value
          </div>
          <div className="mt-1 text-[13px] font-bold leading-5" style={{ color: "var(--color-text-primary)" }}>
            {budget > 0 ? `${budgetRatio.toFixed(1)}% of budget consumed` : "Budget baseline unavailable"}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--color-border-default)" }}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${budgetRatio}%` }} />
          </div>
          {budgetMetric && (
            <div className="mt-2 text-[9px]" style={{ color: "var(--color-text-muted)" }}>
              Budget: {formatValue(budgetMetric)}
            </div>
          )}
        </div>

        <div className="rounded-xl p-3" style={{ background: "var(--color-surface-card)" }}>
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--color-text-muted)" }}>
            WO Issued vs Burn Value
          </div>
          <div className="mt-1 text-[13px] font-bold leading-5" style={{ color: "var(--color-text-primary)" }}>
            {woIssued > 0 ? `${woRatio.toFixed(1)}% of issued value consumed` : "WO issued value unavailable"}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--color-border-default)" }}>
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${woRatio}%` }} />
          </div>
          {woIssuedMetric && (
            <div className="mt-2 text-[9px]" style={{ color: "var(--color-text-muted)" }}>
              WO Issued: {formatValue(woIssuedMetric)}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Metric Detail Card ───────────────────────────────────────────────────────

function MetricDetailCard({ metric, pillarKey, onClick }: {
  metric: ExecutiveMetric;
  pillarKey: keyof typeof PILLAR;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick && metric.route);
  const color = toneColor(metric.tone);
  const accentColor = `var(${PILLAR[pillarKey].accentVar})`;
  const visualPct =
    typeof metric.visualPercent === "number" ? metric.visualPercent :
    metric.format === "percent" && typeof metric.value === "number" ? metric.value : null;
  const pct = visualPct === null ? 0 : Math.min(100, Math.max(0, visualPct));

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className="group relative overflow-hidden rounded-2xl p-4 text-left transition"
      style={{
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-subtle)",
        cursor: clickable ? "pointer" : "default",
      }}
      onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-strong)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-subtle)"; }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] leading-4"
          style={{ color: "var(--color-text-muted)" }}>
          {metric.label}
        </div>
        <div className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide shrink-0"
          style={{ background: toneMutedBg(metric.tone), color }}>
          {toneLabel(metric.tone)}
        </div>
      </div>

      <div className="text-2xl font-black tracking-tight" style={{ color }}>
        {formatValue(metric)}
      </div>

      {visualPct !== null && (
        <div className="mt-3 flex items-center gap-2.5">
          <ProgressRing percent={pct} color={accentColor} />
          <div className="flex-1 min-w-0">
            <div className="h-1.5 overflow-hidden rounded-full"
              style={{ background: "var(--color-border-default)" }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: accentColor }} />
            </div>
            {metric.visualLabel && (
              <div className="mt-1.5 text-[10px] leading-4 truncate"
                style={{ color: "var(--color-text-muted)" }}>
                {metric.visualLabel}
              </div>
            )}
          </div>
        </div>
      )}

      {metric.helper && !visualPct && (
        <div className="mt-2 text-[10px] leading-4"
          style={{ color: "var(--color-text-muted)" }}>
          {metric.helper}
        </div>
      )}
    </button>
  );
}

// ─── Trend Panel ──────────────────────────────────────────────────────────────

function TrendPanel({ section, pillarKey, isDark }: {
  section: ExecutiveSection;
  pillarKey: keyof typeof PILLAR;
  isDark: boolean;
}) {
  const gradId = `exec-grad-${pillarKey}`;
  // Use a slightly lighter shade for the stroke in light mode for visibility
  const chartColors: Record<keyof typeof PILLAR, { stroke: string; fill: string }> = {
    progressExecution: { stroke: "#0284c7", fill: "#0ea5e9" },
    quality:           { stroke: "#7c3aed", fill: "#8b5cf6" },
    ehs:               { stroke: "#059669", fill: "#10b981" },
  };
  const { stroke, fill } = chartColors[pillarKey];

  return (
    <div className="rounded-2xl p-4"
      style={{ background: "var(--color-surface-base)", border: "1px solid var(--color-border-subtle)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>
            {section.trend.label}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Period trend
          </div>
        </div>
        <TrendingUp className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
      </div>

      <div className="h-36">
        {section.trend.points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={section.trend.points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={fill} stopOpacity={isDark ? 0.5 : 0.3} />
                  <stop offset="95%" stopColor={fill} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3"
                stroke={isDark ? "rgba(255,255,255,0.06)" : "var(--color-border-subtle)"}
                vertical={false} />
              <XAxis dataKey="label"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" as string }}
                stroke="transparent" />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface-card)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 12,
                  fontSize: 11,
                  color: "var(--color-text-primary)",
                  boxShadow: "var(--card-shadow)",
                }}
                formatter={(v) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return [formatValue({ value: Number.isFinite(n) ? n : String(v), format: section.trend.format }), ""];
                }}
              />
              <Area type="monotone" dataKey="value"
                stroke={stroke} fill={`url(#${gradId})`} strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl text-xs"
            style={{ border: "1px dashed var(--color-border-default)", color: "var(--color-text-muted)" }}>
            No trend data for selected period
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alert / Action Item List ─────────────────────────────────────────────────

function ItemList({ title, icon: Icon, items, onNavigate }: {
  title: string;
  icon: React.ElementType;
  items: ExecutiveListItem[];
  onNavigate: (route?: string) => void;
}) {
  const severityColor = (s?: string) => {
    if (s === "positive") return { bar: "var(--color-success)", bg: "var(--color-success-muted)" };
    if (s === "warning")  return { bar: "var(--color-warning)", bg: "var(--color-warning-muted)" };
    if (s === "danger")   return { bar: "var(--color-error)",   bg: "var(--color-error-muted)" };
    return { bar: "var(--color-border-strong)", bg: "var(--color-surface-raised)" };
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--color-border-default)", background: "var(--color-surface-card)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          <span className="text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--color-text-secondary)" }}>
            {title}
          </span>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}>
          {items.length}
        </span>
      </div>

      {/* Items */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-52">
        {items.length > 0 ? items.map((item) => {
          const sc = severityColor(item.severity);
          return (
            <button key={item.key} type="button"
              onClick={() => onNavigate(item.route)}
              className="w-full rounded-xl p-3 text-left transition border-l-2 hover:opacity-80"
              style={{ background: sc.bg, borderLeftColor: sc.bar,
                       border: `1px solid ${sc.bar}22`, borderLeftWidth: 3 }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate"
                    style={{ color: "var(--color-text-primary)" }}>
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-4 line-clamp-2"
                    style={{ color: "var(--color-text-muted)" }}>
                    {item.description}
                  </div>
                </div>
                {item.value !== undefined && (
                  <div className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold"
                    style={{ background: "var(--color-surface-card)", color: "var(--color-text-secondary)",
                             border: "1px solid var(--color-border-default)" }}>
                    {formatValue({ value: item.value })}
                  </div>
                )}
              </div>
            </button>
          );
        }) : (
          <div className="flex items-center gap-2 rounded-xl px-3 py-4 text-xs"
            style={{ border: "1px dashed var(--color-border-default)", color: "var(--color-text-muted)" }}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-success)" }} />
            All clear — nothing here right now
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pillar Section Column ────────────────────────────────────────────────────

function PillarColumn({ pillarKey, section, onNavigate, isDark, progressPreview }: {
  pillarKey: keyof typeof PILLAR;
  section: ExecutiveSection;
  onNavigate: (route?: string) => void;
  isDark: boolean;
  progressPreview?: {
    projectId: number;
    projectName: string;
    subtitle?: string;
  } | null;
}) {
  const theme = PILLAR[pillarKey];
  const Icon = theme.icon;
  const delayedMetric = section.kpis.find(
    (metric) => /delay/i.test(metric.key) || /delay/i.test(metric.label),
  );
  const displayMetrics =
    pillarKey === "progressExecution"
      ? ["budgetValue", "woIssuedValue", "burnValue"]
          .map((key) => section.kpis.find((metric) => metric.key === key))
          .filter((metric): metric is ExecutiveMetric => Boolean(metric))
      : delayedMetric
        ? [...section.kpis.filter((metric) => metric.key !== delayedMetric.key), delayedMetric]
        : section.kpis;
  const actualProgressMetric = section.kpis.find((metric) => metric.key === "actualProgress");
  const budgetMetric = section.kpis.find((metric) => metric.key === "budgetValue");
  const woIssuedMetric = section.kpis.find((metric) => metric.key === "woIssuedValue");
  const burnMetric = section.kpis.find((metric) => metric.key === "burnValue");

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl"
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        boxShadow: "var(--card-shadow)",
      }}>

      {/* Gradient Header */}
      <div className="px-5 pt-5 pb-5"
        style={{ background: `linear-gradient(135deg, ${theme.gradStart}, ${theme.gradEnd})` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}>
              <Icon className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">{theme.title}</h2>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>{theme.subtitle}</p>
            </div>
          </div>
          <div className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)" }}>
            Live
          </div>
        </div>
        <PillarKpiBar section={section} pillarKey={pillarKey} />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-4">
        {pillarKey === "progressExecution" && progressPreview ? (
          <div className="grid gap-3 lg:grid-cols-[1.14fr_0.86fr]">
            <div className="overflow-hidden rounded-2xl"
              style={{ background: "var(--color-surface-base)", border: "1px solid var(--color-border-subtle)" }}>
              <ProjectProgress3DPanel
                projectId={progressPreview.projectId}
                projectName={progressPreview.projectName}
                subtitle={progressPreview.subtitle}
                autoRotate
                autoRotateSpeed={2.2}
                viewerClassName="h-[388px]"
              />
            </div>

            <div className="grid content-start gap-3">
              {actualProgressMetric && (
                <div className="grid grid-cols-1">
                  <MetricMiniCard
                    metric={actualProgressMetric}
                    pillarKey={pillarKey}
                    onClick={() => onNavigate(actualProgressMetric.route)}
                  />
                </div>
              )}

              <ExecutionComparisonCard
                burnMetric={burnMetric}
                budgetMetric={budgetMetric}
                woIssuedMetric={woIssuedMetric}
                onClick={onNavigate}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {displayMetrics.map((m) => (
              <MetricDetailCard key={m.key} metric={m} pillarKey={pillarKey}
                onClick={() => onNavigate(m.route)} />
            ))}
          </div>
        )}

        {pillarKey !== "progressExecution" && (
          <TrendPanel section={section} pillarKey={pillarKey} isDark={isDark} />
        )}

        {/* Alerts + Actions side by side */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ItemList title="Alerts" icon={AlertTriangle} items={section.alerts} onNavigate={onNavigate} />
          <ItemList title="Actions" icon={Zap} items={section.actions} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

// ─── Rankings Panel ───────────────────────────────────────────────────────────

function RankingPanel({ group, onNavigate }: {
  group: ExecutiveRankingGroup;
  onNavigate: (route?: string) => void;
}) {
  const rankBadge = (idx: number) => {
    if (idx === 0) return { bg: "var(--color-warning-muted)", color: "#92400e", border: "#fcd34d" };
    if (idx === 1) return { bg: "var(--color-surface-raised)", color: "var(--color-text-secondary)", border: "var(--color-border-strong)" };
    if (idx === 2) return { bg: "var(--color-surface-raised)", color: "#92400e", border: "#d97706" };
    return { bg: "var(--color-surface-raised)", color: "var(--color-text-muted)", border: "var(--color-border-default)" };
  };

  return (
    <div className="overflow-hidden rounded-3xl"
      style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)", boxShadow: "var(--card-shadow)" }}>

      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          <span className="text-sm font-black" style={{ color: "var(--color-text-primary)" }}>
            {group.label}
          </span>
        </div>
        <span className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}>
          Rankings
        </span>
      </div>

      <div className="p-3 space-y-2">
        {group.rows.length > 0 ? group.rows.map((row, idx) => {
          const rb = rankBadge(idx);
          return (
            <button key={row.key} type="button" onClick={() => onNavigate(row.route)}
              className="group w-full rounded-2xl p-4 text-left transition"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-strong)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-subtle)"; }}>
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black"
                  style={{ background: rb.bg, color: rb.color, border: `1px solid ${rb.border}` }}>
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: "var(--color-text-primary)" }}>{row.label}</div>
                  {row.secondaryLabel && (
                    <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--color-text-muted)" }}>{row.secondaryLabel}</div>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {row.metrics.map((m) => (
                    <div key={m.label} className="rounded-xl px-2.5 py-1 text-[10px] font-semibold"
                      style={{ background: "var(--color-surface-card)", color: toneColor(m.tone),
                               border: "1px solid var(--color-border-default)" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>{m.label} </span>
                      {formatValue(m)}
                    </div>
                  ))}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5"
                  style={{ color: "var(--color-text-muted)" }} />
              </div>
            </button>
          );
        }) : (
          <div className="rounded-xl py-8 text-center text-sm"
            style={{ border: "1px dashed var(--color-border-default)", color: "var(--color-text-muted)" }}>
            No ranking data available for this scope yet.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const { isDarkTheme } = useTheme();

  const [tab, setTab] = useState<ExecutiveTab>("enterprise");
  const [companyOptions, setCompanyOptions] = useState<ExecutiveOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ExecutiveOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState(getMonthStart());
  const [dateTo, setDateTo] = useState(getToday());
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [recentInsightRun, setRecentInsightRun] = useState<InsightRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  const loadCompanies = async () => { const r = await executiveDashboardApi.getCompanies(); setCompanyOptions(r.data); };
  const loadProjects = async (cid?: number | null) => {
    const r = await executiveDashboardApi.getProjects(cid);
    const activeProjects = filterOperationalProjects(r.data);
    setProjectOptions(activeProjects);
    setSelectedProjectId((cur) => (activeProjects.some((p) => p.id === cur) ? cur : null));
  };

  useEffect(() => { loadCompanies().catch(() => undefined); }, []);
  useEffect(() => {
    loadProjects(tab === "enterprise" ? null : selectedCompanyId).catch(() => undefined);
  }, [tab, selectedCompanyId]);
  useEffect(() => {
    if (tab === "company" && !selectedCompanyId && companyOptions.length > 0)
      setSelectedCompanyId(companyOptions[0].id);
  }, [tab, companyOptions, selectedCompanyId]);
  useEffect(() => {
    if (tab === "project" && !selectedProjectId && projectOptions.length > 0)
      setSelectedProjectId(projectOptions[0].id);
  }, [tab, projectOptions, selectedProjectId]);
  useEffect(() => {
    const load = async () => {
      if (tab === "company"  && !selectedCompanyId)  { setSummary(null); setLoading(false); return; }
      if (tab === "project"  && !selectedProjectId)  { setSummary(null); setLoading(false); return; }
      setLoading(true); setError(null);
      try {
        const p = { dateFrom, dateTo };
        const r = tab === "enterprise" ? await executiveDashboardApi.getEnterprise(p)
          : tab === "company" ? await executiveDashboardApi.getCompany(selectedCompanyId!, p)
          : await executiveDashboardApi.getProject(selectedProjectId!, p);
        setSummary(r.data);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load executive dashboard.");
      } finally { setLoading(false); }
    };
    load().catch(() => undefined);
  }, [tab, selectedCompanyId, selectedProjectId, dateFrom, dateTo, refreshTick]);

  const refreshAll = async () => {
    setLoading(true); setError(null);
    try {
      await Promise.all([
        loadCompanies(),
        loadProjects(tab === "enterprise" ? null : selectedCompanyId),
      ]);
      setRefreshTick((v) => v + 1);
    }
    finally { setLoading(false); }
  };

  const onNavigate = (route?: string) => { if (route) navigate(route); };
  const previewProjects = useMemo(() => {
    if (tab === "project") {
      if (selectedProjectId) {
        const selectedProject = projectOptions.find((project) => project.id === selectedProjectId);
        if (selectedProject) return [selectedProject];
      }
      if (summary?.scope.projectId && summary.scope.projectName) {
        return [{
          id: summary.scope.projectId,
          name: summary.scope.projectName,
          companyName: summary.scope.companyName,
        }];
      }
      return [];
    }
    return projectOptions;
  }, [projectOptions, selectedProjectId, summary, tab]);
  const activePreviewProject = previewProjects[activePreviewIndex] ?? null;
  const activePreviewSubtitle = useMemo(() => {
    if (!activePreviewProject) return "";
    if (tab === "enterprise") return activePreviewProject.companyName || "Enterprise 3D progress preview";
    if (tab === "company") return summary?.scope.companyName || activePreviewProject.companyName || "Company 3D progress preview";
    return "Project 3D progress preview";
  }, [activePreviewProject, summary, tab]);
  useEffect(() => {
    const loadRecentInsight = async () => {
      try {
        const params =
          tab === "project" && selectedProjectId
            ? { projectId: selectedProjectId, page: 1, limit: 8 }
            : { page: 1, limit: 8 };
        const response = await aiInsightsService.listRuns(params);
        const latestCompleted = response.runs.find((run) => run.status === "COMPLETED" && run.result);
        setRecentInsightRun(latestCompleted || null);
      } catch {
        setRecentInsightRun(null);
      }
    };
    void loadRecentInsight();
  }, [tab, selectedProjectId, refreshTick]);
  const executiveHeadlineMetrics = useMemo(() => {
    const headline = summary?.headline ?? [];
    return headline.filter(
      (metric) =>
        !/companies/i.test(metric.key) &&
        !/companies/i.test(metric.label) &&
        !/projects/i.test(metric.key) &&
        !/projects/i.test(metric.label) &&
        !/delayedprojects/i.test(metric.key) &&
        !/delayed projects/i.test(metric.label),
    );
  }, [summary]);
  const recentInsightBulletin = useMemo(
    () => buildAiInsightBulletin(recentInsightRun),
    [recentInsightRun],
  );

  useEffect(() => {
    setActivePreviewIndex(0);
  }, [previewProjects.map((project) => project.id).join("|")]);

  useEffect(() => {
    if (tab === "project" || previewProjects.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setActivePreviewIndex((current) => (current + 1) % previewProjects.length);
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [previewProjects, tab]);

  const TAB_ITEMS = useMemo(() => [
    { key: "enterprise" as const, label: "Enterprise", icon: Building2 },
    { key: "company"    as const, label: "Company",    icon: Building },
    { key: "project"    as const, label: "Project",    icon: BriefcaseBusiness },
  ], []);

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto p-4"
      style={{ background: "var(--page-gradient, var(--color-surface-base))" }}>
      <div className="mx-auto max-w-[1860px] space-y-4">

        {/* ── Control Bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)", boxShadow: "var(--card-shadow)" }}>

          {/* Brand */}
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl shadow-lg"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))" }}>
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-black leading-none" style={{ color: "var(--color-text-primary)" }}>
                Executive Dashboard
              </div>
              <div className="text-[10px] mt-0.5 leading-none" style={{ color: "var(--color-text-muted)" }}>
                {summary ? `${summary.scope.visibleCompanyCount} companies · ${summary.scope.visibleProjectCount} projects` : "Loading scope…"}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl p-1 gap-1"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
            {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
                style={tab === key
                  ? { background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`, color: "#fff" }
                  : { color: "var(--color-text-muted)", background: "transparent" }}>
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)" }}>
            <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs outline-none w-28"
              style={{ color: "var(--color-text-secondary)" }} />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs outline-none w-28"
              style={{ color: "var(--color-text-secondary)" }} />
          </div>

          {/* Company */}
          <select value={selectedCompanyId ?? ""} disabled={tab === "enterprise"}
            onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-xl px-3 py-2 text-xs outline-none disabled:opacity-50"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }}>
            <option value="">All companies</option>
            {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Project */}
          <select value={selectedProjectId ?? ""} disabled={tab !== "project"}
            onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-xl px-3 py-2 text-xs outline-none disabled:opacity-50"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }}>
            <option value="">Select project</option>
            {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Refresh */}
          <button type="button" onClick={refreshAll}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-80"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
            style={{ background: "var(--color-error-muted)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex min-h-[500px] items-center justify-center rounded-3xl"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)" }}>
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--color-primary)" }} />
              <span className="font-semibold text-sm" style={{ color: "var(--color-text-muted)" }}>
                Building executive view…
              </span>
            </div>
          </div>
        )}

        {/* ── Dashboard ────────────────────────────────────────────────────── */}
        {!loading && summary && (
          <>
            {/* Scope bar + headline KPI chips */}
            <div className="space-y-3">
              {/* Scope context */}
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 w-fit"
                style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)" }}>
                <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
                  {summary.scope.dateFrom} → {summary.scope.dateTo}
                </span>
                <span style={{ color: "var(--color-border-strong)" }}>·</span>
                <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
                  {tab === "enterprise"
                    ? `${summary.scope.visibleCompanyCount} companies · ${summary.scope.visibleProjectCount} projects`
                    : tab === "company" ? summary.scope.companyName || "Company scope"
                    : summary.scope.projectName || "Project scope"}
                </span>
              </div>

              {/* KPI chips strip */}
              <div className="flex items-stretch gap-3 pb-1">
                <div className="flex shrink-0 gap-3">
                  {executiveHeadlineMetrics.map((m) => (
                    <KpiChip key={m.key} metric={m} onClick={() => onNavigate(m.route)} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <AiInsightBulletinChip
                    bulletin={recentInsightBulletin}
                    onClick={() =>
                      navigate(
                        recentInsightBulletin
                          ? `/dashboard/ai-insights/runs/${recentInsightBulletin.runId}`
                          : "/dashboard/ai-insights",
                      )
                    }
                  />
                </div>
              </div>
            </div>

            {/* 3 Pillar Columns */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <PillarColumn
                pillarKey="progressExecution"
                section={summary.progressExecution}
                onNavigate={onNavigate}
                isDark={isDarkTheme}
                progressPreview={activePreviewProject ? {
                  projectId: activePreviewProject.id,
                  projectName: activePreviewProject.name,
                  subtitle: activePreviewSubtitle,
                } : null}
              />
              <PillarColumn pillarKey="quality"           section={summary.quality}           onNavigate={onNavigate} isDark={isDarkTheme} />
              <PillarColumn pillarKey="ehs"               section={summary.ehs}               onNavigate={onNavigate} isDark={isDarkTheme} />
            </div>

            {/* Rankings */}
            {summary.rankings.length > 0 && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {summary.rankings.map((g) => (
                  <RankingPanel key={g.key} group={g} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Empty scope ───────────────────────────────────────────────────── */}
        {!loading && !summary && !error && (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-3xl"
            style={{ border: "1px dashed var(--color-border-default)", background: "var(--color-surface-card)" }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "var(--color-primary-muted)" }}>
              <Building2 className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
            </div>
            <div className="text-center">
              <div className="text-base font-black" style={{ color: "var(--color-text-primary)" }}>
                Select a scope to continue
              </div>
              <div className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                Choose Company or Project, then select from the dropdowns above.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
