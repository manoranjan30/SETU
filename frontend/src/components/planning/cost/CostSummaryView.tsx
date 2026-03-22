import React from "react";
import clsx from "clsx";
import type { CostSummary } from "../../../types/cost";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// ─── Mini Donut ───────────────────────────────────────────────────────────────

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16",
];

function DonutChart({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const r = 56;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * r;
  let cumulativePct = 0;

  const arcs = slices.map((s, i) => {
    const pct = total > 0 ? s.value / total : 0;
    const dash = circumference * pct;
    const offset = circumference * (1 - cumulativePct);
    cumulativePct += pct;
    return { ...s, dash, offset, i };
  });

  return (
    <svg viewBox="0 0 140 140" className="w-32 h-32">
      {/* Background ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={20}
      />
      {arcs.map((arc) => (
        <circle
          key={arc.i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={20}
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={arc.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
    </svg>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-surface-card border border-border-default rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
      <p className="text-[10px] uppercase font-black text-text-disabled tracking-wider">
        {label}
      </p>
      <p className={clsx("text-2xl font-black tracking-tight", accent ?? "text-text-primary")}>
        {value}
      </p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props {
  data: CostSummary;
}

export default function CostSummaryView({ data }: Props) {
  const overrun = data.totalContractValue - data.totalBudget;

  // WBS slices for donut
  const wbsSlices: DonutSlice[] = data.byWbs
    .filter((w) => w.level === 1 && w.contractValue > 0)
    .map((w, i) => ({
      label: w.name,
      value: w.contractValue,
      color: COLORS[i % COLORS.length],
    }));

  // WO status slices
  const statusColors: Record<string, string> = {
    ACTIVE: "#10b981",
    DRAFT: "#f59e0b",
    CLOSED: "#6b7280",
    CANCELLED: "#ef4444",
  };
  const statusSlices: DonutSlice[] = data.woStatusBreakdown.map((s) => ({
    label: s.status,
    value: s.totalAmount,
    color: statusColors[s.status] ?? "#94a3b8",
  }));
  const totalStatusAmt = data.woStatusBreakdown.reduce(
    (s, r) => s + r.totalAmount,
    0,
  );

  return (
    <div className="space-y-6 p-4">
      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="BOQ Budget"
          value={fmt(data.totalBudget)}
          sub="Total sanctioned"
          accent="text-slate-800"
        />
        <KpiCard
          label="Contract Value"
          value={fmt(data.totalContractValue)}
          sub="Active WOs only"
          accent="text-blue-700"
        />
        <KpiCard
          label="Spent to Date"
          value={fmt(data.spentToDate)}
          sub="Executed × rate"
          accent="text-green-700"
        />
        <KpiCard
          label="Remaining"
          value={fmt(data.remaining)}
          sub="Contract − Spent"
          accent={data.remaining < 0 ? "text-red-600" : "text-slate-700"}
        />
        <KpiCard
          label="% Complete"
          value={`${data.percentComplete.toFixed(1)}%`}
          sub="Spend basis"
          accent={
            data.percentComplete >= 75
              ? "text-green-700"
              : data.percentComplete >= 40
              ? "text-amber-600"
              : "text-slate-700"
          }
        />
        <KpiCard
          label={overrun >= 0 ? "Contract vs Budget" : "Saving vs Budget"}
          value={fmt(Math.abs(overrun))}
          sub={overrun >= 0 ? "Above BOQ budget" : "Below BOQ budget"}
          accent={overrun > 0 ? "text-red-600" : "text-green-700"}
        />
      </div>

      {/* ── Progress Bar ── */}
      <div className="bg-surface-card border border-border-default rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span>Overall Cost Progress</span>
          <span className="font-bold text-text-secondary">
            {data.percentComplete.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, data.percentComplete)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-text-disabled mt-1">
          <span>₹0</span>
          <span>{fmt(data.totalContractValue)}</span>
        </div>
      </div>

      {/* ── Two Donuts + Tables ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* WBS Category Breakdown */}
        <div className="bg-surface-card border border-border-default rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-text-disabled mb-4">
            Spend by WBS Category
          </h3>
          <div className="flex items-center gap-6">
            <DonutChart
              slices={wbsSlices}
              total={data.totalContractValue}
            />
            <div className="flex-1 space-y-2">
              {wbsSlices.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: s.color }}
                  />
                  <span className="text-xs text-text-secondary flex-1 truncate">
                    {s.label}
                  </span>
                  <span className="text-xs font-bold text-text-primary">
                    {fmt(s.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* WO Status Breakdown */}
        <div className="bg-surface-card border border-border-default rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-text-disabled mb-4">
            Work Order Status
          </h3>
          <div className="flex items-center gap-6">
            <DonutChart slices={statusSlices} total={totalStatusAmt} />
            <div className="flex-1 space-y-2">
              {data.woStatusBreakdown.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: statusColors[s.status] ?? "#94a3b8" }}
                  />
                  <span className="text-xs text-text-secondary flex-1">
                    {s.status}
                    <span className="ml-1 text-text-disabled">
                      ({s.count} WO{s.count !== 1 ? "s" : ""})
                    </span>
                  </span>
                  <span className="text-xs font-bold text-text-primary">
                    {fmt(s.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Vendor Table ── */}
      <div className="bg-surface-card border border-border-default rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border-default">
          <h3 className="text-xs font-black uppercase tracking-wider text-text-disabled">
            Vendor Cost Summary
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-text-disabled">
                <th className="px-4 py-2 text-left">Vendor</th>
                <th className="px-4 py-2 text-right">Contract Value</th>
                <th className="px-4 py-2 text-right">Spent</th>
                <th className="px-4 py-2 text-right">Remaining</th>
                <th className="px-4 py-2 text-right">WOs</th>
                <th className="px-4 py-2 text-center">Progress</th>
              </tr>
            </thead>
            <tbody>
              {data.byVendor
                .sort((a, b) => b.contractValue - a.contractValue)
                .map((v, i) => {
                  const pct =
                    v.contractValue > 0
                      ? (v.spent / v.contractValue) * 100
                      : 0;
                  return (
                    <tr
                      key={v.vendorId}
                      className={clsx(
                        "border-t border-border-default",
                        i % 2 === 0 ? "bg-surface-card" : "bg-slate-50/50",
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text-primary text-sm">
                          {v.vendorName}
                        </p>
                        <p className="text-[10px] text-text-muted font-mono">
                          {v.vendorCode}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {fmt(v.contractValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">
                        {fmt(v.spent)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {fmt(v.contractValue - v.spent)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-muted">
                        {v.woCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-text-muted w-8 text-right">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {data.byVendor.length === 0 && (
            <div className="text-center py-8 text-text-muted text-sm">
              No vendor data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
