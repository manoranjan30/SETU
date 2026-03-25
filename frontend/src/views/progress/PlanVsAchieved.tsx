import React from "react";
import { Target, AlertCircle, CheckCircle2 } from "lucide-react";

interface PlanVsAchievedProps {
  data?: {
    planned: number;
    achieved: number;
    variance: number;
    status: string;
  } | null;
  loading?: boolean;
}

const PlanVsAchieved: React.FC<PlanVsAchievedProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-surface-card rounded-2xl p-6 shadow-sm border border-border-default h-[200px] animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-4 bg-surface-base rounded w-full"></div>
          <div className="h-4 bg-surface-base rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface-card rounded-2xl p-6 shadow-sm border border-border-default">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="font-bold text-text-secondary flex items-center gap-2">
              <Target className="w-5 h-5 text-secondary" />
              Plan vs. Achieved
            </h3>
            <p className="text-xs text-text-disabled mt-1">
              Cumulative financial progress vs. Baseline
            </p>
          </div>
        </div>
        <div className="text-sm text-text-muted">
          Progress summary is not available right now.
        </div>
      </div>
    );
  }

  const percentage =
    data.planned > 0 ? (data.achieved / data.planned) * 100 : 0;
  const isBehind = data.achieved < data.planned;

  return (
    <div className="bg-surface-card rounded-2xl p-6 shadow-sm border border-border-default">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-text-secondary flex items-center gap-2">
            <Target className="w-5 h-5 text-secondary" />
            Plan vs. Achieved
          </h3>
          <p className="text-xs text-text-disabled mt-1">
            Cumulative financial progress vs. Baseline
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
            isBehind
              ? "bg-warning-muted text-warning"
              : "bg-success-muted text-success"
          }`}
        >
          {isBehind ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}
          {data.status}
        </span>
      </div>

      <div className="space-y-6">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-bold text-text-muted">Progress</span>
            <span className="font-black text-slate-800">
              {percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-secondary h-full rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            ></div>
            {percentage > 100 && (
              <div
                className="bg-emerald-500 h-full w-4 animate-pulse"
                title="Overachieved"
              ></div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="p-3 bg-surface-base rounded-xl border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-text-disabled mb-1">
              Planned Value
            </p>
            <p className="text-lg font-black text-text-secondary">
              {new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }).format(data.planned)}
            </p>
          </div>
          <div className="p-3 bg-surface-base rounded-xl border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-text-disabled mb-1">
              Achieved Value
            </p>
            <p
              className={`text-lg font-black ${isBehind ? "text-warning" : "text-success"}`}
            >
              {new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }).format(data.achieved)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanVsAchieved;
