import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, Sparkles, Clock, CheckCircle2, XCircle, Loader2,
  Play, ChevronRight, TrendingUp, ShieldCheck, ShieldAlert,
  IndianRupee, RefreshCw,
} from "lucide-react";
import { aiInsightsService } from "../../services/aiInsights.service";
import type { InsightTemplate, InsightRun } from "../../services/aiInsights.service";
import { useAuth } from "../../context/AuthContext";
import { PermissionCode } from "../../config/permissions";

// ── Icon map from template icon strings ──────────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  Brain: <Brain size={22} />,
  Sparkles: <Sparkles size={22} />,
  TrendingUp: <TrendingUp size={22} />,
  ShieldCheck: <ShieldCheck size={22} />,
  ShieldAlert: <ShieldAlert size={22} />,
  IndianRupee: <IndianRupee size={22} />,
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    COMPLETED: {
      color: "bg-emerald-100 text-emerald-700",
      icon: <CheckCircle2 size={12} />,
      label: "Completed",
    },
    FAILED: {
      color: "bg-red-100 text-red-700",
      icon: <XCircle size={12} />,
      label: "Failed",
    },
    RUNNING: {
      color: "bg-blue-100 text-blue-700",
      icon: <Loader2 size={12} className="animate-spin" />,
      label: "Running",
    },
    PENDING: {
      color: "bg-gray-100 text-gray-600",
      icon: <Clock size={12} />,
      label: "Pending",
    },
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const AiInsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canRun = hasPermission(PermissionCode.AI_INSIGHTS_RUN);

  // Project ID for scoped analyses — user picks from URL param or manual entry
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectInput, setProjectInput] = useState("");

  const [templates, setTemplates] = useState<InsightTemplate[]>([]);
  const [runs, setRuns] = useState<InsightRun[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tmpl, runsResp] = await Promise.all([
        aiInsightsService.listTemplates(),
        aiInsightsService.listRuns({
          projectId: projectId ?? undefined,
          limit: 10,
        }),
      ]);
      setTemplates(tmpl);
      setRuns(runsResp.runs);
      setRunsTotal(runsResp.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRun = async (template: InsightTemplate) => {
    if (!canRun) return;
    setRunningId(template.id);
    try {
      const run = await aiInsightsService.runInsight({
        templateId: template.id,
        projectId: projectId,
      });
      navigate(`/dashboard/ai-insights/runs/${run.id}`);
    } catch (err) {
      console.error("Run failed:", err);
      alert("Analysis failed. Check console for details.");
    } finally {
      setRunningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain size={26} className="text-indigo-600" />
            AI Insights
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            AI-powered analysis of your project data. Select a project below to scope the analysis.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Project Scope Picker */}
      <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
        <span className="text-sm font-medium text-indigo-700 whitespace-nowrap">Project ID:</span>
        <input
          type="number"
          className="flex-1 max-w-[140px] border border-indigo-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="e.g. 2"
          value={projectInput}
          onChange={(e) => setProjectInput(e.target.value)}
          onBlur={() => {
            const v = parseInt(projectInput, 10);
            setProjectId(isNaN(v) ? null : v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = parseInt(projectInput, 10);
              setProjectId(isNaN(v) ? null : v);
            }
          }}
        />
        {projectId && (
          <span className="text-xs text-indigo-600 font-medium">Project #{projectId} selected</span>
        )}
        {!projectId && (
          <span className="text-xs text-indigo-400">No project selected — enter project ID to scope data</span>
        )}
      </div>

      {/* Template Cards */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">
          Available Analyses
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              canRun={canRun}
              isRunning={runningId === t.id}
              onRun={() => handleRun(t)}
            />
          ))}
        </div>
        {templates.length === 0 && (
          <p className="text-sm text-gray-400 italic">
            No templates available. Contact an administrator.
          </p>
        )}
      </section>

      {/* Recent Runs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">
            Recent Analyses
            {runsTotal > 0 && (
              <span className="ml-2 text-xs text-gray-400 font-normal">
                ({runsTotal} total)
              </span>
            )}
          </h2>
          {runsTotal > 10 && (
            <button
              onClick={() => navigate("/dashboard/ai-insights/history")}
              className="text-xs text-indigo-600 hover:underline"
            >
              View all
            </button>
          )}
        </div>

        {runs.length === 0 ? (
          <div className="text-sm text-gray-400 italic bg-gray-50 rounded-xl p-6 text-center">
            No analyses run yet. Pick a template above to get started.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} onClick={() => navigate(`/dashboard/ai-insights/runs/${run.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ── TemplateCard ──────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: InsightTemplate;
  canRun: boolean;
  isRunning: boolean;
  onRun: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  canRun,
  isRunning,
  onRun,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">
          {ICON_MAP[template.icon ?? "Brain"] ?? <Brain size={22} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">
            {template.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {template.description}
          </p>
        </div>
      </div>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={!canRun || isRunning}
        className={`mt-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
          ${canRun && !isRunning
            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
      >
        {isRunning ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Analysing...
          </>
        ) : (
          <>
            <Play size={14} />
            Run Analysis
          </>
        )}
      </button>
    </div>
  );
};

// ── RunRow ────────────────────────────────────────────────────────────────────

const RunRow: React.FC<{ run: InsightRun; onClick: () => void }> = ({
  run,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition"
    >
      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 flex-shrink-0">
        <Brain size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {run.template?.name ?? `Run #${run.id}`}
        </p>
        <p className="text-xs text-gray-400">
          {new Date(run.createdAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          {run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ""}
          {run.tokensUsed ? ` · ${run.tokensUsed} tokens` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge status={run.status} />
        <ChevronRight size={14} className="text-gray-300" />
      </div>
    </button>
  );
};

export default AiInsightsPage;
