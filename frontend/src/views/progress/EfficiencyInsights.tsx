import React from "react";
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Target,
  Briefcase,
} from "lucide-react";

interface EfficiencyInsightsProps {
  data: {
    topBurners: Array<{ name: string; value: number }>;
    alerts: Array<{ type: "warning" | "info"; message: string }>;
  };
  loading?: boolean;
}

const EfficiencyInsights: React.FC<EfficiencyInsightsProps> = ({
  data,
  loading,
}) => {
  if (loading) {
    return (
      <div className="bg-surface-card rounded-2xl p-6 shadow-sm border border-border-default h-[300px] animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-20 bg-surface-base rounded-xl w-full"></div>
          <div className="h-20 bg-surface-base rounded-xl w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-2xl p-6 shadow-sm border border-border-default h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-text-secondary flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Efficiency Insights
          </h3>
          <p className="text-xs text-text-disabled mt-1">
            AI-driven suggestions for better planning
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
        {/* Top Burners Card */}
        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl border border-indigo-100">
          <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Top Cost Consumers
          </h4>
          <div className="space-y-3">
            {data.topBurners.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center text-sm"
              >
                <span
                  className="text-slate-600 truncate flex-1 pr-4"
                  title={item.name}
                >
                  {item.name}
                </span>
                <span className="font-bold text-slate-800">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts / Tips */}
        {data.alerts.length > 0 ? (
          data.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border ${alert.type === "warning" ? "bg-warning-muted border-amber-100 text-amber-800" : "bg-sky-50 border-sky-100 text-sky-800"}`}
            >
              <div className="flex gap-3">
                {alert.type === "warning" ? (
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <Briefcase className="w-5 h-5 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-bold mb-1">
                    {alert.type === "warning"
                      ? "Attention Required"
                      : "Planning Tip"}
                  </p>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 rounded-xl bg-success-muted border border-emerald-100 text-emerald-800 flex gap-3">
            <Target className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold">On Track</p>
              <p className="text-xs opacity-90">
                Progress aligns perfectly with the plan. No critical alerts.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 text-center">
        <button className="text-xs font-bold text-secondary hover:text-indigo-700 hover:underline">
          View Comprehensive Analysis
        </button>
      </div>
    </div>
  );
};

export default EfficiencyInsights;
