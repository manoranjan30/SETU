import React, { useMemo, useState, useCallback } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import type { AopNode } from "../../../types/cost";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!n) return "—";
  if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(2)}L`;
  return n.toLocaleString("en-IN");
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
  });
}

const FY_MONTHS = (fy: number) => {
  const months: string[] = [];
  for (let m = 4; m <= 12; m++) months.push(`${fy}-${String(m).padStart(2, "0")}`);
  for (let m = 1; m <= 3; m++) months.push(`${fy + 1}-${String(m).padStart(2, "0")}`);
  return months;
};

type ViewMode = "both" | "planned" | "actual";

// ─── Export to CSV ────────────────────────────────────────────────────────────

function exportCsv(nodes: AopNode[], months: string[], fy: number) {
  const headers = [
    "Code",
    "Name",
    "Type",
    "Budget (₹)",
    "Contract (₹)",
    ...months.flatMap((mk) => [`${monthLabel(mk)} Planned`, `${monthLabel(mk)} Actual`]),
    "FY Planned",
    "FY Actual",
  ];

  const rows: string[][] = [];

  const flatten = (n: AopNode) => {
    const fyPlanned = months.reduce((s, mk) => s + (n.months[mk]?.planned || 0), 0);
    const fyActual = months.reduce((s, mk) => s + (n.months[mk]?.actual || 0), 0);
    rows.push([
      n.code,
      n.label,
      n.type,
      String(n.budget),
      String(n.contractValue),
      ...months.flatMap((mk) => [
        String(n.months[mk]?.planned || 0),
        String(n.months[mk]?.actual || 0),
      ]),
      String(fyPlanned),
      String(fyActual),
    ]);
    n.children?.forEach(flatten);
  };
  nodes.forEach(flatten);

  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${c}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AOP_FY${fy}-${fy + 1}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Table Row ────────────────────────────────────────────────────────────────

interface RowProps {
  node: AopNode;
  months: string[];
  depth: number;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  viewMode: ViewMode;
}

function AopRow({ node, months, depth, collapsed, toggleCollapse, viewMode }: RowProps) {
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = (node.children?.length ?? 0) > 0;

  const fyPlanned = months.reduce((s, mk) => s + (node.months[mk]?.planned || 0), 0);
  const fyActual = months.reduce((s, mk) => s + (node.months[mk]?.actual || 0), 0);

  const rowClass = clsx(
    "border-b border-border-default text-xs",
    node.type === "total" && "bg-slate-800 text-white font-black",
    node.type === "wbs" && depth === 0 && "bg-blue-50 font-bold text-slate-800",
    node.type === "wbs" && depth > 0 && "bg-slate-50 font-semibold text-slate-700",
    node.type === "wo" && "bg-surface-card text-text-secondary",
  );

  const cellClass = "px-2 py-2 text-right whitespace-nowrap";
  const stickyClass = "sticky left-0 bg-inherit z-10 px-3 py-2";

  return (
    <>
      <tr className={rowClass}>
        {/* Sticky label cell */}
        <td className={stickyClass} style={{ paddingLeft: depth * 16 + 12 }}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button
                onClick={() => toggleCollapse(node.id)}
                className={clsx(
                  "p-0.5 rounded flex-shrink-0",
                  node.type === "total"
                    ? "hover:bg-white/20 text-white"
                    : "hover:bg-slate-200 text-slate-600",
                )}
              >
                {isCollapsed ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
              </button>
            ) : (
              <span className="w-5 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <span className={clsx(
                "truncate block max-w-[200px]",
                node.type === "total" ? "text-white" : "",
              )}>
                {node.label}
              </span>
              {node.type !== "total" && (
                <span className="text-[9px] text-text-disabled font-mono">
                  {node.code}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Budget */}
        <td className={clsx(cellClass, node.type === "total" ? "text-white" : "text-slate-600")}>
          {fmt(node.budget)}
        </td>

        {/* Contract Value */}
        <td className={clsx(cellClass, node.type === "total" ? "text-amber-300" : "text-slate-800 font-semibold")}>
          {fmt(node.contractValue)}
        </td>

        {/* Month cells */}
        {months.map((mk) => {
          const planned = node.months[mk]?.planned || 0;
          const actual = node.months[mk]?.actual || 0;
          return (
            <td key={mk} className={clsx(cellClass, "min-w-[70px]")}>
              {viewMode === "both" ? (
                <div className="space-y-0.5">
                  {planned > 0 && (
                    <div className={clsx(node.type === "total" ? "text-blue-200" : "text-blue-600")}>
                      {fmt(planned)}
                    </div>
                  )}
                  {actual > 0 && (
                    <div className={clsx(node.type === "total" ? "text-emerald-300" : "text-emerald-600")}>
                      {fmt(actual)}
                    </div>
                  )}
                  {planned === 0 && actual === 0 && (
                    <span className="text-text-disabled">—</span>
                  )}
                </div>
              ) : viewMode === "planned" ? (
                <span className={clsx(node.type === "total" ? "text-blue-200" : "text-blue-600", planned === 0 && "text-text-disabled")}>
                  {planned > 0 ? fmt(planned) : "—"}
                </span>
              ) : (
                <span className={clsx(node.type === "total" ? "text-emerald-300" : "text-emerald-600", actual === 0 && "text-text-disabled")}>
                  {actual > 0 ? fmt(actual) : "—"}
                </span>
              )}
            </td>
          );
        })}

        {/* FY Totals */}
        <td className={clsx(cellClass, "font-bold border-l-2 border-slate-300", node.type === "total" ? "text-blue-200" : "text-blue-700")}>
          {fmt(fyPlanned)}
        </td>
        <td className={clsx(cellClass, "font-bold", node.type === "total" ? "text-emerald-300" : "text-emerald-700")}>
          {fmt(fyActual)}
        </td>
        <td className={clsx(cellClass, node.type === "total" ? "text-amber-300" : (fyPlanned - fyActual >= 0 ? "text-blue-600" : "text-red-500"))}>
          {(fyPlanned !== 0 || fyActual !== 0)
            ? (fyPlanned - fyActual >= 0 ? "+" : "") + fmt(fyPlanned - fyActual)
            : "—"}
        </td>
      </tr>

      {/* Children */}
      {!isCollapsed &&
        node.children?.map((child) => (
          <AopRow
            key={child.id}
            node={child}
            months={months}
            depth={depth + 1}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            viewMode={viewMode}
          />
        ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  data: AopNode[];
  defaultFy?: number;
}

export default function CostAopTableView({ data, defaultFy }: Props) {
  const currentFY = useMemo(() => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  }, []);

  const [selectedFY, setSelectedFY] = useState(defaultFy ?? currentFY);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("both");

  const months = useMemo(() => FY_MONTHS(selectedFY), [selectedFY]);

  // Build available FY list from data
  const availableFYs = useMemo(() => {
    const years = new Set<number>();
    const extractYears = (node: AopNode) => {
      for (const mk of Object.keys(node.months)) {
        const [y, m] = mk.split("-").map(Number);
        years.add(m >= 4 ? y : y - 1);
      }
      node.children?.forEach(extractYears);
    };
    data.forEach(extractYears);
    if (!years.size) years.add(currentFY);
    return Array.from(years).sort();
  }, [data, currentFY]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => {
    const ids = new Set<string>();
    const collect = (n: AopNode) => {
      if (n.children?.length) ids.add(n.id);
      n.children?.forEach(collect);
    };
    data.forEach(collect);
    setCollapsed(ids);
  };

  return (
    <div className="space-y-3 p-4">
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

        <div className="flex items-center gap-1 border border-border-default rounded-lg overflow-hidden">
          {(["both", "planned", "actual"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium capitalize",
                viewMode === m
                  ? "bg-primary text-white"
                  : "bg-surface-card text-text-secondary hover:bg-slate-100",
              )}
            >
              {m === "both" ? "P + A" : m === "planned" ? "Planned" : "Actual"}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-slate-100 text-text-secondary"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-slate-100 text-text-secondary"
          >
            Collapse All
          </button>
        </div>

        <div className="ml-auto">
          <button
            onClick={() => exportCsv(data, months, selectedFY)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Legend */}
      {viewMode === "both" && (
        <div className="flex items-center gap-4 text-[10px] text-text-muted px-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Planned (P)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Actual (A)
          </span>
          <span className="text-text-disabled">
            Values in Cr / L for readability
          </span>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-card border border-border-default rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-800 text-white text-[10px] uppercase tracking-wider">
                <th className="px-3 py-3 text-left sticky left-0 bg-slate-800 z-30 min-w-[220px]">
                  WBS / Work Order
                </th>
                <th className="px-2 py-3 text-right min-w-[80px]">Budget</th>
                <th className="px-2 py-3 text-right min-w-[80px]">Contract</th>
                {months.map((mk) => (
                  <th key={mk} className="px-2 py-3 text-center min-w-[70px]">
                    {monthLabel(mk)}
                    <div className="text-[8px] opacity-60">
                      {mk.split("-")[0].slice(2)}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-3 text-right min-w-[80px] border-l-2 border-slate-600 bg-slate-700">
                  FY Planned
                </th>
                <th className="px-2 py-3 text-right min-w-[80px] bg-slate-700">
                  FY Actual
                </th>
                <th className="px-2 py-3 text-right min-w-[80px] bg-slate-700">
                  Variance
                </th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + months.length + 3}
                    className="text-center py-12 text-text-muted"
                  >
                    No AOP data available. Map WO items to schedule activities
                    to generate projections.
                  </td>
                </tr>
              ) : (
                data.map((node) => (
                  <AopRow
                    key={node.id}
                    node={node}
                    months={months}
                    depth={0}
                    collapsed={collapsed}
                    toggleCollapse={toggleCollapse}
                    viewMode={viewMode}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
