import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import clsx from "clsx";
import {
  TrendingUp,
  BarChart2,
  TableProperties,
  RefreshCw,
  AlertCircle,
  GitBranch,
} from "lucide-react";
import { costService } from "../../services/cost.service";
import type {
  CostSummary,
  CashflowMonth,
  AopNode,
  ScheduleVersionOption,
} from "../../types/cost";
import CostSummaryView from "../../components/planning/cost/CostSummaryView";
import CostCashflowView from "../../components/planning/cost/CostCashflowView";
import CostAopTableView from "../../components/planning/cost/CostAopTableView";

type CostTab = "summary" | "cashflow" | "aop";

const TABS: { key: CostTab; label: string; icon: React.ReactNode }[] = [
  { key: "summary", label: "Summary", icon: <TrendingUp size={15} /> },
  { key: "cashflow", label: "Cashflow", icon: <BarChart2 size={15} /> },
  { key: "aop", label: "AOP Table", icon: <TableProperties size={15} /> },
];

const VERSION_TYPE_LABEL: Record<string, string> = {
  WORKING: "Working",
  BASELINE: "Baseline",
  REVISED: "Revised",
};

export default function CostPage() {
  const { projectId } = useParams();
  const pId = Number(projectId || 0);

  const [activeTab, setActiveTab] = useState<CostTab>("summary");

  // Schedule version selector (affects Cashflow + AOP planned values)
  const [versions, setVersions] = useState<ScheduleVersionOption[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<
    number | undefined
  >(undefined); // undefined = latest working schedule (default)

  // Data states
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [cashflow, setCashflow] = useState<CashflowMonth[]>([]);
  const [aop, setAop] = useState<AopNode[]>([]);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCashflow, setLoadingCashflow] = useState(true);
  const [loadingAop, setLoadingAop] = useState(true);

  const [errorSummary, setErrorSummary] = useState<string | null>(null);
  const [errorCashflow, setErrorCashflow] = useState<string | null>(null);
  const [errorAop, setErrorAop] = useState<string | null>(null);

  // Current FY
  const now = new Date();
  const currentFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const [aopFY, setAopFY] = useState(currentFY);

  // Load schedule versions on mount
  useEffect(() => {
    if (!pId) return;
    costService.getScheduleVersions(pId).then(setVersions).catch(() => {});
  }, [pId]);

  const fetchSummary = async () => {
    if (!pId) return;
    setLoadingSummary(true);
    setErrorSummary(null);
    try {
      const data = await costService.getSummary(pId);
      setSummary(data);
    } catch {
      setErrorSummary("Failed to load cost summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchCashflow = async (vId = selectedVersionId) => {
    if (!pId) return;
    setLoadingCashflow(true);
    setErrorCashflow(null);
    try {
      const data = await costService.getCashflow(pId, undefined, undefined, vId);
      setCashflow(data);
    } catch {
      setErrorCashflow("Failed to load cashflow data.");
    } finally {
      setLoadingCashflow(false);
    }
  };

  const fetchAop = async (fy = aopFY, vId = selectedVersionId) => {
    if (!pId) return;
    setLoadingAop(true);
    setErrorAop(null);
    try {
      const data = await costService.getAop(pId, fy, vId);
      setAop(data);
    } catch {
      setErrorAop("Failed to load AOP data.");
    } finally {
      setLoadingAop(false);
    }
  };

  const handleAopFyChange = (fy: number) => {
    setAopFY(fy);
    fetchAop(fy, selectedVersionId);
  };

  const handleVersionChange = (vId: number | undefined) => {
    setSelectedVersionId(vId);
    // Re-fetch both cashflow and AOP with new version
    fetchCashflow(vId);
    fetchAop(aopFY, vId);
  };

  // Load all on mount
  useEffect(() => {
    fetchSummary();
    fetchCashflow(undefined);
    fetchAop(currentFY, undefined);
  }, [pId]);

  const handleRefresh = () => {
    if (activeTab === "summary") fetchSummary();
    else if (activeTab === "cashflow") fetchCashflow(selectedVersionId);
    else fetchAop(aopFY, selectedVersionId);
  };

  const isLoading =
    (activeTab === "summary" && loadingSummary) ||
    (activeTab === "cashflow" && loadingCashflow) ||
    (activeTab === "aop" && loadingAop);

  const activeError =
    activeTab === "summary"
      ? errorSummary
      : activeTab === "cashflow"
      ? errorCashflow
      : errorAop;

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-base">
      {/* Page Header */}
      <div className="bg-surface-card border-b border-border-default px-5 py-3 flex items-center gap-4 shadow-sm flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          <h1 className="font-black text-lg text-text-primary tracking-tight">
            Cost & Cashflow
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border border-border-default rounded-xl overflow-hidden ml-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all",
                activeTab === tab.key
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:bg-slate-100",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Schedule Version Selector — visible for Cashflow and AOP */}
        {activeTab !== "summary" && versions.length > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <GitBranch size={13} className="text-text-muted flex-shrink-0" />
            <span className="text-xs text-text-muted whitespace-nowrap">
              Schedule:
            </span>
            <select
              value={selectedVersionId ?? ""}
              onChange={(e) =>
                handleVersionChange(
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              className="text-xs border border-border-default rounded-lg px-2.5 py-1.5 bg-surface-card focus:ring-2 focus:ring-primary text-text-primary max-w-[220px]"
            >
              <option value="">Latest Working Schedule</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {VERSION_TYPE_LABEL[v.type] ?? v.type}
                  {v.isActive ? " ★" : ""}
                  {v.isLocked ? " 🔒" : ""}
                </option>
              ))}
            </select>
            {selectedVersion && (
              <span
                className={clsx(
                  "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                  selectedVersion.type === "BASELINE"
                    ? "bg-slate-100 text-slate-600"
                    : selectedVersion.type === "REVISED"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-blue-50 text-blue-700",
                )}
              >
                {VERSION_TYPE_LABEL[selectedVersion.type]}
              </span>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isLoading && (
            <span className="text-xs text-text-muted animate-pulse">
              Loading…
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-slate-100 disabled:opacity-50 text-text-secondary"
          >
            <RefreshCw size={13} className={clsx(isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Error state */}
        {activeError && (
          <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">{activeError}</p>
              <p className="text-xs text-red-500 mt-0.5">
                Check that WO items are linked to activities via the WO Qty Mapper.
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !activeError && (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-20 bg-slate-100 rounded-2xl animate-pulse"
                style={{ opacity: 1 - i * 0.15 }}
              />
            ))}
          </div>
        )}

        {/* Summary Tab */}
        {!isLoading && activeTab === "summary" && summary && (
          <CostSummaryView data={summary} />
        )}
        {!isLoading && activeTab === "summary" && !summary && !errorSummary && (
          <EmptyState message="No cost data available for this project." />
        )}

        {/* Cashflow Tab */}
        {!isLoading && activeTab === "cashflow" && (
          <CostCashflowView data={cashflow} projectStartYear={currentFY} />
        )}

        {/* AOP Tab */}
        {!isLoading && activeTab === "aop" && (
          <CostAopTableView
            data={aop}
            defaultFy={aopFY}
            onFyChange={handleAopFyChange}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-text-muted gap-3">
      <TrendingUp size={40} className="text-slate-300" />
      <p className="text-sm">{message}</p>
      <p className="text-xs text-text-disabled">
        Start by creating Work Orders and mapping them to schedule activities.
      </p>
    </div>
  );
}
