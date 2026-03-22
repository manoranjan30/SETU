import React, { useMemo, useState } from "react";
import clsx from "clsx";
import type { CashflowMonth } from "../../../types/cost";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, compact = false): string {
  if (compact) {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
    return `₹${n.toLocaleString("en-IN")}`;
  }
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtFull(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

// Generate financial year options from data
function fyOptions(months: CashflowMonth[]): number[] {
  const years = new Set<number>();
  for (const m of months) {
    const [y, mo] = m.month.split("-").map(Number);
    // FY starts April
    years.add(mo >= 4 ? y : y - 1);
  }
  return Array.from(years).sort();
}

function fyRange(fy: number): { from: string; to: string } {
  return { from: `${fy}-04`, to: `${fy + 1}-03` };
}

// ─── Bar + S-Curve Chart ──────────────────────────────────────────────────────

interface ChartProps {
  months: CashflowMonth[];
  showBudget: boolean;
  showActual: boolean;
}

function CashflowChart({ months, showBudget, showActual }: ChartProps) {
  const maxBar = useMemo(
    () =>
      Math.max(
        1,
        ...months.map((m) =>
          Math.max(m.planned, showActual ? m.actual : 0, showBudget ? m.budget : 0),
        ),
      ),
    [months, showBudget, showActual],
  );

  const maxCum = useMemo(
    () => Math.max(1, ...months.map((m) => m.cumulativePlanned)),
    [months],
  );

  const chartH = 220;
  const barW = Math.max(16, Math.min(40, Math.floor(760 / (months.length || 1)) - 6));
  const gap = 6;
  const leftPad = 64;
  const rightPad = 48;
  const topPad = 16;
  const bottomPad = 36;
  const totalW = leftPad + months.length * (barW + gap) + rightPad;

  if (months.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        No data in selected period
      </div>
    );
  }

  // Y-axis ticks
  const yTicks = 4;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxBar / yTicks) * i),
  );

  // Cumulative line points
  const cumPoints = months.map((m, i) => {
    const x = leftPad + i * (barW + gap) + barW / 2;
    const y = topPad + chartH - ((m.cumulativePlanned / maxCum) * chartH);
    return `${x},${y}`;
  });

  return (
    <div className="overflow-x-auto">
      <svg
        width={Math.max(600, totalW)}
        height={chartH + topPad + bottomPad}
        className="min-w-full"
      >
        {/* Y-axis gridlines + labels (left = bar scale) */}
        {yTickVals.map((v, i) => {
          const y = topPad + chartH - (v / maxBar) * chartH;
          return (
            <g key={i}>
              <line
                x1={leftPad}
                y1={y}
                x2={totalW - rightPad}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray={i === 0 ? "none" : "4 3"}
              />
              <text
                x={leftPad - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="#94a3b8"
              >
                {fmt(v, true)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {months.map((m, i) => {
          const x = leftPad + i * (barW + gap);
          const barGroupW = barW;
          const slotW = showActual ? Math.floor(barGroupW / 2) - 1 : barGroupW;

          const plannedH = Math.max(1, (m.planned / maxBar) * chartH);
          const actualH = Math.max(1, (m.actual / maxBar) * chartH);
          const budgetH = Math.max(1, (m.budget / maxBar) * chartH);

          return (
            <g key={m.month}>
              {/* Budget outline bar (behind) */}
              {showBudget && (
                <rect
                  x={x}
                  y={topPad + chartH - budgetH}
                  width={barGroupW}
                  height={budgetH}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  rx={2}
                />
              )}

              {/* Planned bar */}
              <rect
                x={x}
                y={topPad + chartH - plannedH}
                width={showActual ? slotW : barGroupW}
                height={plannedH}
                fill="#3b82f6"
                opacity={0.85}
                rx={2}
              />

              {/* Actual bar */}
              {showActual && (
                <rect
                  x={x + slotW + 2}
                  y={topPad + chartH - actualH}
                  width={slotW}
                  height={actualH}
                  fill="#10b981"
                  opacity={0.85}
                  rx={2}
                />
              )}

              {/* X-axis label */}
              <text
                x={x + barGroupW / 2}
                y={topPad + chartH + 14}
                textAnchor="middle"
                fontSize={8.5}
                fill="#64748b"
              >
                {m.label.split(" ")[0]}
              </text>
              <text
                x={x + barGroupW / 2}
                y={topPad + chartH + 24}
                textAnchor="middle"
                fontSize={7.5}
                fill="#94a3b8"
              >
                {m.label.split(" ")[1]}
              </text>
            </g>
          );
        })}

        {/* S-Curve (cumulative planned line) */}
        {months.length > 1 && (
          <>
            <polyline
              points={cumPoints.join(" ")}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {months.map((m, i) => {
              const [px, py] = cumPoints[i].split(",").map(Number);
              return (
                <circle key={i} cx={px} cy={py} r={3} fill="#f59e0b" />
              );
            })}
          </>
        )}

        {/* Right Y-axis label for cumulative */}
        <text
          x={totalW - rightPad + 4}
          y={topPad + chartH / 2}
          fontSize={8}
          fill="#f59e0b"
          transform={`rotate(90 ${totalW - rightPad + 12} ${topPad + chartH / 2})`}
          textAnchor="middle"
        >
          Cumulative →
        </text>
      </svg>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  data: CashflowMonth[];
  projectStartYear?: number;
}

export default function CostCashflowView({ data, projectStartYear }: Props) {
  const availableFYs = useMemo(() => fyOptions(data), [data]);
  const defaultFY =
    projectStartYear ??
    (availableFYs[0] ?? new Date().getFullYear());

  const [selectedFY, setSelectedFY] = useState(defaultFY);
  const [showBudget, setShowBudget] = useState(true);
  const [showActual, setShowActual] = useState(true);

  const { from, to } = fyRange(selectedFY);
  const filtered = useMemo(
    () => data.filter((m) => m.month >= from && m.month <= to),
    [data, from, to],
  );

  // FY totals
  const fyPlanned = filtered.reduce((s, m) => s + m.planned, 0);
  const fyActual = filtered.reduce((s, m) => s + m.actual, 0);
  const fyBudget = filtered.reduce((s, m) => s + m.budget, 0);

  return (
    <div className="space-y-4 p-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">Financial Year:</span>
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(Number(e.target.value))}
            className="text-sm border border-border-default rounded-lg px-3 py-1.5 bg-surface-card focus:ring-2 focus:ring-primary"
          >
            {availableFYs.map((fy) => (
              <option key={fy} value={fy}>
                FY {fy}-{String(fy + 1).slice(2)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 border-l border-border-default pl-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
            <input
              type="checkbox"
              checked
              disabled
              className="hidden"
            />
            Planned
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <input
              type="checkbox"
              checked={showActual}
              onChange={(e) => setShowActual(e.target.checked)}
              className="rounded"
            />
            Actual
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <span className="w-3 h-3 rounded border-2 border-slate-400 inline-block" />
            <input
              type="checkbox"
              checked={showBudget}
              onChange={(e) => setShowBudget(e.target.checked)}
              className="rounded"
            />
            BOQ Budget
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            S-Curve (Cum. Planned)
          </label>
        </div>
      </div>

      {/* FY KPI Strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: `FY ${selectedFY}-${String(selectedFY + 1).slice(2)} Planned`, value: fyPlanned, color: "text-blue-700" },
          { label: "FY Actual Spend", value: fyActual, color: "text-emerald-700" },
          { label: "FY BOQ Budget", value: fyBudget, color: "text-slate-700" },
        ].map((k, i) => (
          <div
            key={i}
            className="bg-surface-card border border-border-default rounded-xl px-4 py-3 shadow-sm"
          >
            <p className="text-[10px] uppercase font-black text-text-disabled tracking-wider">
              {k.label}
            </p>
            <p className={clsx("text-xl font-black mt-0.5", k.color)}>
              {fmt(k.value, true)}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-surface-card border border-border-default rounded-2xl p-4 shadow-sm overflow-hidden">
        <CashflowChart
          months={filtered}
          showBudget={showBudget}
          showActual={showActual}
        />
      </div>

      {/* Monthly Table */}
      <div className="bg-surface-card border border-border-default rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border-default">
          <h3 className="text-xs font-black uppercase tracking-wider text-text-disabled">
            Month-Wise Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-text-disabled border-b border-border-default">
                <th className="px-4 py-2.5 text-left sticky left-0 bg-slate-50">Month</th>
                <th className="px-4 py-2.5 text-right">BOQ Budget</th>
                <th className="px-4 py-2.5 text-right">WO Planned</th>
                <th className="px-4 py-2.5 text-right">Actual Spend</th>
                <th className="px-4 py-2.5 text-right">Variance</th>
                <th className="px-4 py-2.5 text-right">Cum. Planned</th>
                <th className="px-4 py-2.5 text-right">Cum. Actual</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const variance = m.planned - m.actual;
                return (
                  <tr
                    key={m.month}
                    className={clsx(
                      "border-t border-border-default text-sm",
                      i % 2 === 0 ? "bg-surface-card" : "bg-slate-50/40",
                    )}
                  >
                    <td className="px-4 py-2.5 font-semibold text-text-primary sticky left-0 bg-inherit">
                      {m.label}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-muted">
                      {fmtFull(m.budget)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-blue-700">
                      {fmtFull(m.planned)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-700">
                      {fmtFull(m.actual)}
                    </td>
                    <td
                      className={clsx(
                        "px-4 py-2.5 text-right font-semibold",
                        variance >= 0 ? "text-blue-600" : "text-red-500",
                      )}
                    >
                      {variance >= 0 ? "+" : ""}
                      {fmtFull(variance)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {fmtFull(m.cumulativePlanned)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {fmtFull(m.cumulativeActual)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-black text-slate-800">
                  <td className="px-4 py-2.5 sticky left-0 bg-slate-100">FY Total</td>
                  <td className="px-4 py-2.5 text-right">{fmtFull(fyBudget)}</td>
                  <td className="px-4 py-2.5 text-right text-blue-700">{fmtFull(fyPlanned)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-700">{fmtFull(fyActual)}</td>
                  <td className={clsx("px-4 py-2.5 text-right", fyPlanned - fyActual >= 0 ? "text-blue-600" : "text-red-500")}>
                    {fyPlanned - fyActual >= 0 ? "+" : ""}
                    {fmtFull(fyPlanned - fyActual)}
                  </td>
                  <td className="px-4 py-2.5 text-right">—</td>
                  <td className="px-4 py-2.5 text-right">—</td>
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-text-muted text-sm">
              No cashflow data for FY {selectedFY}-{String(selectedFY + 1).slice(2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
