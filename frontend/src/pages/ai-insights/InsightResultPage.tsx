import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Brain, ArrowLeft, CheckCircle2, XCircle, Loader2,
  Clock, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Info, CheckCircle, Trash2,
} from "lucide-react";
import { aiInsightsService } from "../../services/aiInsights.service";
import type { InsightRun } from "../../services/aiInsights.service";

// ─── Simple markdown renderer ──────────────────────────────────────────────

const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split("\n");
  return (
    <div className="prose prose-sm max-w-none text-gray-700">
      {lines.map((line, i) => {
        if (line.startsWith("### "))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("## "))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-1">{line.slice(3)}</h2>;
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return (
            <p key={i} className="flex gap-1.5 text-sm">
              <span className="text-gray-400 mt-0.5">•</span>
              {line.slice(2)}
            </p>
          );
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm leading-relaxed">{line}</p>;
      })}
    </div>
  );
};

// ─── Status Chip ──────────────────────────────────────────────────────────────

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    ON_TRACK:       "bg-emerald-100 text-emerald-700 border-emerald-200",
    AT_RISK:        "bg-amber-100 text-amber-700 border-amber-200",
    DELAYED:        "bg-red-100 text-red-700 border-red-200",
    ACCEPTABLE:     "bg-emerald-100 text-emerald-700 border-emerald-200",
    NEEDS_ATTENTION:"bg-amber-100 text-amber-700 border-amber-200",
    CRITICAL:       "bg-red-100 text-red-700 border-red-200",
    SAFE:           "bg-emerald-100 text-emerald-700 border-emerald-200",
    ELEVATED_RISK:  "bg-amber-100 text-amber-700 border-amber-200",
    UNDER_BUDGET:   "bg-emerald-100 text-emerald-700 border-emerald-200",
    ON_BUDGET:      "bg-blue-100 text-blue-700 border-blue-200",
    OVER_BUDGET:    "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`px-3 py-1 rounded-full border text-sm font-semibold ${styles[status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
};

// ─── Section Card ─────────────────────────────────────────────────────────────

const SectionCard: React.FC<{
  title: string;
  content: string;
  status: "good" | "warning" | "critical";
}> = ({ title, content, status }) => {
  const border: Record<string, string> = {
    good:     "border-l-4 border-emerald-400",
    warning:  "border-l-4 border-amber-400",
    critical: "border-l-4 border-red-400",
  };
  const icon: Record<string, React.ReactNode> = {
    good:     <CheckCircle size={16} className="text-emerald-500" />,
    warning:  <AlertTriangle size={16} className="text-amber-500" />,
    critical: <XCircle size={16} className="text-red-500" />,
  };
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm ${border[status] ?? ""}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon[status]}
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <SimpleMarkdown text={content} />
    </div>
  );
};

// ─── Metric Tile ──────────────────────────────────────────────────────────────

const MetricTile: React.FC<{
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
}> = ({ label, value, trend }) => {
  const trendIcon = {
    up:      <TrendingUp size={14} className="text-emerald-500" />,
    down:    <TrendingDown size={14} className="text-red-500" />,
    neutral: <Minus size={14} className="text-gray-400" />,
  };
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className="text-lg font-bold text-gray-900">{value}</p>
        {trend && trendIcon[trend]}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const InsightResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [run, setRun] = useState<InsightRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let interval: ReturnType<typeof setInterval>;

    const fetch = async () => {
      try {
        const r = await aiInsightsService.getRun(Number(id));
        setRun(r);

        if (r.status === "RUNNING" || r.status === "PENDING") {
          setPolling(true);
          interval = setInterval(async () => {
            const updated = await aiInsightsService.getRun(Number(id));
            setRun(updated);
            if (updated.status !== "RUNNING" && updated.status !== "PENDING") {
              clearInterval(interval);
              setPolling(false);
            }
          }, 3000);
        }
      } finally {
        setLoading(false);
      }
    };

    fetch();
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!run) return <div className="p-6 text-red-500">Run not found.</div>;

  const result = run.result as Record<string, unknown> | null;
  const isRunning = run.status === "RUNNING" || run.status === "PENDING";

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this AI analysis run result?");
    if (!confirmed || !run) return;
    setDeleting(true);
    try {
      await aiInsightsService.deleteRun(run.id);
      navigate("/dashboard/ai-insights");
    } catch (error) {
      console.error("Failed to delete AI analysis run:", error);
      alert("Failed to delete AI analysis run.");
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate("/dashboard/ai-insights")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
      >
        <ArrowLeft size={14} />
        AI Insights
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={18} className="text-indigo-500" />
              <h1 className="text-lg font-bold text-gray-900">
                {run.template?.name ?? `Analysis #${run.id}`}
              </h1>
            </div>
            <p className="text-sm text-gray-500">
              Run at{" "}
              {new Date(run.createdAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {run.modelUsed && ` · ${run.modelUsed}`}
              {run.tokensUsed && ` · ${run.tokensUsed} tokens`}
              {run.durationMs && ` · ${(run.durationMs / 1000).toFixed(1)}s`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {deleting ? "Deleting..." : "Delete Run"}
            </button>
            {isRunning ? (
              <span className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full font-medium">
                <Loader2 size={14} className="animate-spin" />
                {polling ? "Analysing…" : "Starting…"}
              </span>
            ) : run.status === "COMPLETED" ? (
              <CheckCircle2 size={22} className="text-emerald-500" />
            ) : (
              <XCircle size={22} className="text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* Running State */}
      {isRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-blue-700 font-medium">AI is analysing your project data…</p>
          <p className="text-blue-500 text-sm mt-1">
            This usually takes 10–30 seconds. Page will update automatically.
          </p>
        </div>
      )}

      {/* Failed State */}
      {run.status === "FAILED" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={18} className="text-red-500" />
            <h3 className="font-semibold text-red-700">Analysis Failed</h3>
          </div>
          <p className="text-sm text-red-600">{run.errorMessage ?? "Unknown error."}</p>
        </div>
      )}

      {/* Result */}
      {run.status === "COMPLETED" && result && (
        <InsightResultView result={result} rawResponse={run.rawResponse} />
      )}

      {run.status === "COMPLETED" && !result && run.rawResponse && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Analysis Result</h2>
          <SimpleMarkdown text={run.rawResponse} />
        </div>
      )}

      {run.status === "COMPLETED" && !result && !run.rawResponse && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">Analysis Result</h2>
          <p className="text-sm text-amber-700">
            This AI run completed, but no readable analysis content was returned. Please rerun the analysis.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Insight Result View — renders structured result fields ──────────────────

const InsightResultView: React.FC<{
  result: Record<string, unknown>;
  rawResponse?: string | null;
}> = ({ result, rawResponse }) => {
  const headline = result.headline as string | undefined;
  const overallStatus = result.overallStatus as string | undefined;
  const sections = result.sections as { title: string; content: string; status: "good" | "warning" | "critical" }[] | undefined;
  const recommendations = result.recommendations as string[] | undefined;
  const keyMetrics = result.keyMetrics as { label: string; value: string; trend: "up" | "down" | "neutral" }[] | undefined;

  // Template-specific fields
  const progressPercentage = result.progressPercentage as number | undefined;
  const topDefectCategories = result.topDefectCategories as { category: string; count: number; severity: string }[] | undefined;
  const topHazards = result.topHazards as { hazard: string; frequency: number; severity: string }[] | undefined;
  const riskScore = result.riskScore as number | undefined;
  const varianceItems = result.varianceItems as { boqCode: string; description: string; variancePct: number; severity: string }[] | undefined;
  const normalizedRawResult =
    typeof result.raw === "string" && result.raw.trim().length > 0
      ? result.raw.trim()
      : null;
  const normalizedRawSummary =
    typeof result.summary === "string" && result.summary.trim().length > 0
      ? result.summary.trim()
      : null;
  const normalizedRawResponse =
    typeof rawResponse === "string" && rawResponse.trim().length > 0
      ? rawResponse.trim()
      : null;
  const rawText = normalizedRawResult || normalizedRawSummary || normalizedRawResponse;
  const hasStructuredContent = Boolean(
    headline ||
    overallStatus ||
    progressPercentage !== undefined ||
    riskScore !== undefined ||
    (keyMetrics && keyMetrics.length > 0) ||
    (sections && sections.length > 0) ||
    (topDefectCategories && topDefectCategories.length > 0) ||
    (topHazards && topHazards.length > 0) ||
    (varianceItems && varianceItems.length > 0) ||
    (recommendations && recommendations.length > 0),
  );

  return (
    <div className="space-y-5">
      {/* Headline + Status */}
      {(headline || overallStatus) && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
          {headline && (
            <p className="text-indigo-900 font-semibold text-base leading-relaxed mb-2">
              {headline}
            </p>
          )}
          {overallStatus && <StatusChip status={overallStatus} />}
          {progressPercentage !== undefined && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-indigo-700 mb-1">
                <span>Overall Progress</span>
                <span>{progressPercentage}%</span>
              </div>
              <div className="h-2 bg-indigo-200 rounded-full">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, progressPercentage)}%` }}
                />
              </div>
            </div>
          )}
          {riskScore !== undefined && (
            <p className="mt-2 text-sm text-indigo-700">
              Risk Score: <strong>{riskScore}/10</strong>
            </p>
          )}
        </div>
      )}

      {/* Key Metrics */}
      {keyMetrics && keyMetrics.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Key Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {keyMetrics.map((m, i) => (
              <MetricTile key={i} label={m.label} value={m.value} trend={m.trend} />
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      {sections && sections.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Analysis</h2>
          <div className="space-y-3">
            {sections.map((s, i) => (
              <SectionCard key={i} title={s.title} content={s.content} status={s.status} />
            ))}
          </div>
        </div>
      )}

      {/* Top Defect Categories */}
      {topDefectCategories && topDefectCategories.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Top Defect Categories</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {topDefectCategories.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-gray-50"
              >
                <span className="text-sm text-gray-800">{d.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{d.count}</span>
                  <SeverityBadge severity={d.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Hazards */}
      {topHazards && topHazards.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Top Hazards</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {topHazards.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-gray-50"
              >
                <span className="text-sm text-gray-800">{h.hazard}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">×{h.frequency}</span>
                  <SeverityBadge severity={h.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variance Items */}
      {varianceItems && varianceItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Cost Variance Items</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {varianceItems.slice(0, 10).map((v, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-gray-50"
              >
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">{v.boqCode}</p>
                  <p className="text-sm text-gray-800 truncate">{v.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-semibold ${v.variancePct > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {v.variancePct > 0 ? "+" : ""}{v.variancePct.toFixed(1)}%
                  </span>
                  <SeverityBadge severity={v.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Recommendations</h2>
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
            {recommendations.map((r, i) => (
              <div key={i} className="flex gap-2.5">
                <Info size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasStructuredContent && rawText && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Analysis Result</h2>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <SimpleMarkdown text={rawText} />
          </div>
        </div>
      )}

      {!hasStructuredContent && !rawText && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Analysis Result</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-700">
              This AI run completed, but the model did not return readable analysis content for display.
            </p>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-amber-900">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const map: Record<string, string> = {
    low:      "bg-gray-100 text-gray-600",
    minor:    "bg-gray-100 text-gray-600",
    medium:   "bg-amber-100 text-amber-700",
    major:    "bg-amber-100 text-amber-700",
    high:     "bg-red-100 text-red-700",
    critical: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[severity.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>
      {severity}
    </span>
  );
};

export default InsightResultPage;
