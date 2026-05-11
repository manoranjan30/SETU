import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
} from "lucide-react";
import api from "../../api/axios";
import { WorkDocService } from "../../services/work-doc.service";
import { exportUtils } from "../../utils/export.utils";
import { downloadBlob, withFileExtension } from "../../utils/file-download.utils";
import { formatIndianNumber } from "../../utils/format";

type ReportRow = Record<string, string | number | null>;

interface ReportPreview {
  title: string;
  subtitle: string;
  columns: string[];
  rows: ReportRow[];
}

interface ReportTemplateDefinition {
  id: string;
  title: string;
  category: string;
  description: string;
  build: (dataset: Dataset, monthKey: string) => ReportPreview;
}

interface Dataset {
  activities: any[];
  workOrders: any[];
  pendingBoard: any[];
  versions: any[];
}

const DEFAULT_PREVIEW: ReportPreview = {
  title: "No report selected",
  subtitle: "Pick one of the planning report templates to preview it here.",
  columns: [],
  rows: [],
};

const dateKey = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

const monthOf = (value?: string | null) => (value ? dateKey(value).slice(0, 7) : "");

const safeNumber = (value: unknown) => Number(value || 0);

const buildWordDocument = (preview: ReportPreview) => {
  const tableHead = preview.columns
    .map((column) => `<th style="border:1px solid #cbd5e1;padding:8px;background:#f8fafc;text-align:left;">${column}</th>`)
    .join("");
  const tableRows = preview.rows
    .map(
      (row) =>
        `<tr>${preview.columns
          .map(
            (column) =>
              `<td style="border:1px solid #e2e8f0;padding:8px;">${row[column] ?? ""}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `
    <html>
      <head><meta charset="utf-8" /><title>${preview.title}</title></head>
      <body style="font-family:Segoe UI,Arial,sans-serif;padding:24px;">
        <h1 style="margin-bottom:4px;">${preview.title}</h1>
        <p style="margin-top:0;color:#475569;">${preview.subtitle}</p>
        <table style="border-collapse:collapse;width:100%;font-size:12px;">
          <thead><tr>${tableHead}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;
};

const toDisplayRows = (preview: ReportPreview) =>
  preview.rows.map((row) =>
    preview.columns.reduce<Record<string, string | number | null>>((acc, column) => {
      acc[column] = row[column] ?? "";
      return acc;
    }, {}),
  );

const PlanningReportsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<Dataset>({
    activities: [],
    workOrders: [],
    pendingBoard: [],
    versions: [],
  });
  const [activeTemplateId, setActiveTemplateId] = useState<string>("activity-calendar");
  const [search, setSearch] = useState("");
  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const load = async () => {
      if (!projectId) return;
      setLoading(true);
      try {
        const [scheduleRes, workOrders, pendingBoard, versionsRes] = await Promise.all([
          api.get(`/projects/${projectId}/schedule`),
          WorkDocService.getProjectWorkOrders(Number(projectId)),
          WorkDocService.getPendingVendorBoard(Number(projectId)),
          api.get(`/planning/${projectId}/versions`),
        ]);

        setDataset({
          activities: scheduleRes.data?.activities || [],
          workOrders,
          pendingBoard,
          versions: versionsRes.data || [],
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectId]);

  const templates = useMemo<ReportTemplateDefinition[]>(() => {
    const activityRow = (activity: any) => ({
      Tower: activity.wbsNode?.wbsName || "Unassigned",
      Code: activity.activityCode || "",
      Activity: activity.activityName || "",
      Start: dateKey(activity.startDatePlanned),
      Finish: dateKey(activity.finishDatePlanned),
      Status: activity.status || "NOT_STARTED",
      Progress: `${safeNumber(activity.percentComplete).toFixed(0)}%`,
      "Assigned Value": formatIndianNumber(activity.budgetedValue || 0),
      "Achieved Value": formatIndianNumber(activity.actualValue || 0),
    });

    const byMonth = (activity: any) =>
      monthOf(activity.startDatePlanned) === monthKey ||
      monthOf(activity.finishDatePlanned) === monthKey;

    const sortByStart = (rows: any[]) =>
      [...rows].sort(
        (a, b) =>
          new Date(a.startDatePlanned || a.finishDatePlanned || 0).getTime() -
          new Date(b.startDatePlanned || b.finishDatePlanned || 0).getTime(),
      );

    return [
      {
        id: "activity-calendar",
        title: "Monthly Activity Calendar",
        category: "Schedule",
        description: "Activities starting or closing in the selected month.",
        build: (data, selectedMonth) => {
          const rows = sortByStart(data.activities)
            .filter(
              (activity) =>
                monthOf(activity.startDatePlanned) === selectedMonth ||
                monthOf(activity.finishDatePlanned) === selectedMonth,
            )
            .map((activity) => ({
              Day: dateKey(activity.startDatePlanned),
              ...activityRow(activity),
            }));
          return {
            title: "Monthly Activity Calendar",
            subtitle: `Selected month: ${selectedMonth}`,
            columns: ["Day", "Tower", "Code", "Activity", "Start", "Finish", "Status", "Progress"],
            rows,
          };
        },
      },
      {
        id: "activity-starts",
        title: "Daily Activity Starts",
        category: "Schedule",
        description: "Activities that begin in the selected month.",
        build: (data, selectedMonth) => ({
          title: "Daily Activity Starts",
          subtitle: `Activities with planned start in ${selectedMonth}`,
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status"],
          rows: sortByStart(data.activities)
            .filter((activity) => monthOf(activity.startDatePlanned) === selectedMonth)
            .map(activityRow),
        }),
      },
      {
        id: "activity-finishes",
        title: "Daily Activity Closures",
        category: "Schedule",
        description: "Activities finishing in the selected month.",
        build: (data, selectedMonth) => ({
          title: "Daily Activity Closures",
          subtitle: `Activities with planned finish in ${selectedMonth}`,
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status"],
          rows: sortByStart(data.activities)
            .filter((activity) => monthOf(activity.finishDatePlanned) === selectedMonth)
            .map(activityRow),
        }),
      },
      {
        id: "tower-plan",
        title: "Tower-wise Planned Activities",
        category: "Schedule",
        description: "All scheduled activities grouped by tower/WBS.",
        build: (data) => ({
          title: "Tower-wise Planned Activities",
          subtitle: "Full activity register grouped by tower",
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status", "Progress"],
          rows: sortByStart(data.activities).map(activityRow),
        }),
      },
      {
        id: "upcoming-14",
        title: "Upcoming 14-Day Window",
        category: "Lookahead",
        description: "Activities planned to start in the next two weeks.",
        build: (data) => {
          const today = new Date();
          const horizon = new Date();
          horizon.setDate(today.getDate() + 14);
          const rows = sortByStart(data.activities)
            .filter((activity) => {
              const start = activity.startDatePlanned ? new Date(activity.startDatePlanned) : null;
              return start && start >= today && start <= horizon;
            })
            .map(activityRow);
          return {
            title: "Upcoming 14-Day Window",
            subtitle: "Short-term lookahead from the live schedule",
            columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status", "Progress"],
            rows,
          };
        },
      },
      {
        id: "critical-watchlist",
        title: "Critical Path Watchlist",
        category: "CPM",
        description: "Tasks currently marked critical or near-zero float.",
        build: (data) => ({
          title: "Critical Path Watchlist",
          subtitle: "Activities requiring close planning attention",
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status", "Progress"],
          rows: sortByStart(data.activities)
            .filter((activity) => activity.schedule?.isCritical || activity.isCritical)
            .map(activityRow),
        }),
      },
      {
        id: "delayed-activities",
        title: "Delayed Activities",
        category: "Progress",
        description: "Activities whose actual finish is beyond planned finish.",
        build: (data) => ({
          title: "Delayed Activities",
          subtitle: "Variance-driven delay watchlist",
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status", "Progress"],
          rows: sortByStart(data.activities)
            .filter((activity) => {
              if (!activity.finishDatePlanned || !activity.finishDateActual) return false;
              return (
                new Date(activity.finishDateActual).getTime() >
                new Date(activity.finishDatePlanned).getTime()
              );
            })
            .map(activityRow),
        }),
      },
      {
        id: "completed-activities",
        title: "Completed Activities",
        category: "Progress",
        description: "All activities marked completed.",
        build: (data) => ({
          title: "Completed Activities",
          subtitle: "Executed activities with 100% completion",
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status", "Progress"],
          rows: sortByStart(data.activities)
            .filter((activity) => safeNumber(activity.percentComplete) >= 100)
            .map(activityRow),
        }),
      },
      {
        id: "in-progress-activities",
        title: "In Progress Activities",
        category: "Progress",
        description: "Activities currently underway.",
        build: (data) => ({
          title: "In Progress Activities",
          subtitle: "Activities with partial progress",
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status", "Progress"],
          rows: sortByStart(data.activities)
            .filter((activity) => {
              const pct = safeNumber(activity.percentComplete);
              return pct > 0 && pct < 100;
            })
            .map(activityRow),
        }),
      },
      {
        id: "not-started-activities",
        title: "Not Started Activities",
        category: "Progress",
        description: "Activities yet to begin.",
        build: (data) => ({
          title: "Not Started Activities",
          subtitle: "Tasks still at 0% progress",
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status"],
          rows: sortByStart(data.activities)
            .filter((activity) => safeNumber(activity.percentComplete) === 0)
            .map(activityRow),
        }),
      },
      {
        id: "value-ledger",
        title: "Budget vs Achieved Value",
        category: "Commercial",
        description: "Assigned versus achieved value activity by activity.",
        build: (data) => ({
          title: "Budget vs Achieved Value",
          subtitle: "Commercial performance at activity level",
          columns: ["Tower", "Code", "Activity", "Assigned Value", "Achieved Value", "Progress"],
          rows: sortByStart(data.activities)
            .filter((activity) => safeNumber(activity.budgetedValue) > 0 || safeNumber(activity.actualValue) > 0)
            .map(activityRow),
        }),
      },
      {
        id: "wo-register",
        title: "Work Order Register",
        category: "WO",
        description: "Master list of issued work orders.",
        build: (data) => ({
          title: "Work Order Register",
          subtitle: "Commercial WO summary",
          columns: ["WO Number", "Vendor", "Date", "Status", "Total Amount"],
          rows: data.workOrders.map((wo) => ({
            "WO Number": wo.woNumber,
            Vendor: wo.vendor?.name || "-",
            Date: dateKey(wo.date || wo.woDate),
            Status: wo.status,
            "Total Amount": formatIndianNumber(wo.totalAmount || 0),
          })),
        }),
      },
      {
        id: "wo-by-vendor",
        title: "Vendor Allocation Ledger",
        category: "WO",
        description: "Work orders grouped by vendor with total values.",
        build: (data) => {
          const grouped = new Map<string, number>();
          data.workOrders.forEach((wo) => {
            const key = wo.vendor?.name || "Unassigned";
            grouped.set(key, (grouped.get(key) || 0) + safeNumber(wo.totalAmount));
          });
          return {
            title: "Vendor Allocation Ledger",
            subtitle: "Awarded value by vendor",
            columns: ["Vendor", "Awarded Value"],
            rows: Array.from(grouped.entries()).map(([vendor, amount]) => ({
              Vendor: vendor,
              "Awarded Value": formatIndianNumber(amount),
            })),
          };
        },
      },
      {
        id: "pending-onboard",
        title: "Pending Vendor On Board",
        category: "WO",
        description: "All pending qty/scope/creep items awaiting coverage.",
        build: (data) => ({
          title: "Pending Vendor On Board",
          subtitle: "Balance scope and quantity gaps",
          columns: ["WO Ref", "Vendor", "Description", "Pending Type", "Qty", "Amount"],
          rows: data.pendingBoard.map((item) => ({
            "WO Ref": item.workOrderRef || "BOQ Balance",
            Vendor: item.vendorName || "Unassigned",
            Description: item.description,
            "Pending Type": String(item.pendingType || "").replace(/_/g, " "),
            Qty: formatIndianNumber(item.quantity || 0, 3),
            Amount: formatIndianNumber(item.amount || 0),
          })),
        }),
      },
      {
        id: "scope-pending",
        title: "Split Scope Pending Register",
        category: "WO",
        description: "Scope-pending rows that still need separate vendors.",
        build: (data) => ({
          title: "Split Scope Pending Register",
          subtitle: "Original BOQ scope still awaiting issue",
          columns: ["WO Ref", "Vendor", "Description", "Issued Scope", "Pending Scope"],
          rows: data.pendingBoard
            .filter((item) => item.pendingType === "SCOPE_PENDING")
            .map((item) => ({
              "WO Ref": item.workOrderRef || "WO",
              Vendor: item.vendorName || "Assigned Vendor",
              Description: item.description,
              "Issued Scope": item.issuedScopeSummary || "-",
              "Pending Scope": item.pendingScopeSummary || "-",
            })),
        }),
      },
      {
        id: "creep-pending",
        title: "Scope Creep Pending Register",
        category: "WO",
        description: "Explicit creep scope still awaiting onboarding.",
        build: (data) => ({
          title: "Scope Creep Pending Register",
          subtitle: "Creep items requiring commercial closure",
          columns: ["WO Ref", "Description", "Creep Scope", "Reason", "Amount"],
          rows: data.pendingBoard
            .filter((item) => item.pendingType === "CREEP_PENDING")
            .map((item) => ({
              "WO Ref": item.workOrderRef || "WO",
              Description: item.description,
              "Creep Scope": item.creepScopeSummary || "-",
              Reason: item.scopeCreepReason || "-",
              Amount: formatIndianNumber(item.amount || 0),
            })),
        }),
      },
      {
        id: "revision-register",
        title: "Working Schedule Revision Register",
        category: "Revisions",
        description: "All working schedule revisions with metadata.",
        build: (data) => ({
          title: "Working Schedule Revision Register",
          subtitle: "Revision chain and ownership",
          columns: ["Revision", "Type", "Sequence", "Created By", "Created On", "Active"],
          rows: data.versions.map((version) => ({
            Revision: version.versionCode,
            Type: version.versionType,
            Sequence: version.sequenceNumber,
            "Created By": version.createdBy,
            "Created On": dateKey(version.createdOn),
            Active: version.isActive ? "Yes" : "No",
          })),
        }),
      },
      {
        id: "baseline-vs-current",
        title: "Baseline vs Current Finish Snapshot",
        category: "Revisions",
        description: "Planned finish comparison using schedule dates.",
        build: (data) => ({
          title: "Baseline vs Current Finish Snapshot",
          subtitle: "Activity-level finish comparison",
          columns: ["Tower", "Code", "Activity", "Baseline Finish", "Current Finish"],
          rows: sortByStart(data.activities)
            .filter((activity) => activity.finishDateBaseline || activity.finishDatePlanned)
            .map((activity) => ({
              Tower: activity.wbsNode?.wbsName || "Unassigned",
              Code: activity.activityCode,
              Activity: activity.activityName,
              "Baseline Finish": dateKey(activity.finishDateBaseline),
              "Current Finish": dateKey(activity.finishDatePlanned),
            })),
        }),
      },
      {
        id: "float-consumption",
        title: "Float Consumption Report",
        category: "CPM",
        description: "Near-zero float activities for recovery focus.",
        build: (data) => ({
          title: "Float Consumption Report",
          subtitle: "Activities with low available float",
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status"],
          rows: sortByStart(data.activities)
            .filter((activity) => safeNumber(activity.schedule?.totalFloat) <= 3)
            .map(activityRow),
        }),
      },
      {
        id: "tower-density",
        title: "Tower Activity Density",
        category: "Schedule",
        description: "Activity count by tower/WBS.",
        build: (data) => {
          const grouped = new Map<string, number>();
          data.activities.forEach((activity) => {
            const key = activity.wbsNode?.wbsName || "Unassigned";
            grouped.set(key, (grouped.get(key) || 0) + 1);
          });
          return {
            title: "Tower Activity Density",
            subtitle: "Activity count grouped by tower",
            columns: ["Tower", "Activity Count"],
            rows: Array.from(grouped.entries()).map(([tower, count]) => ({
              Tower: tower,
              "Activity Count": count,
            })),
          };
        },
      },
      {
        id: "month-end-snapshot",
        title: "Month-end Progress Snapshot",
        category: "Progress",
        description: "All activities touching the selected month with status.",
        build: (data, selectedMonth) => ({
          title: "Month-end Progress Snapshot",
          subtitle: `Schedule progress snapshot for ${selectedMonth}`,
          columns: ["Tower", "Code", "Activity", "Start", "Finish", "Status", "Progress"],
          rows: sortByStart(data.activities)
            .filter((activity) => byMonth(activity))
            .map(activityRow),
        }),
      },
    ];
  }, [monthKey]);

  const filteredTemplates = templates.filter(
    (template) =>
      template.title.toLowerCase().includes(search.toLowerCase()) ||
      template.category.toLowerCase().includes(search.toLowerCase()) ||
      template.description.toLowerCase().includes(search.toLowerCase()),
  );

  const activeTemplate =
    templates.find((template) => template.id === activeTemplateId) || templates[0];
  const preview = activeTemplate ? activeTemplate.build(dataset, monthKey) : DEFAULT_PREVIEW;

  const exportWord = () => {
    const html = buildWordDocument(preview);
    const blob = new Blob([html], { type: "application/msword" });
    downloadBlob(blob, withFileExtension(preview.title.replace(/\s+/g, "_"), ".doc"));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-card">
      <div className="border-b border-border-default bg-surface-base px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Planning Reports</h1>
            <p className="mt-1 text-sm text-text-muted">
              Ready-to-use construction planning templates from your live schedule and work order data.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-card px-3 py-2">
              <CalendarDays className="h-4 w-4 text-text-muted" />
              <input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="bg-transparent text-sm outline-none"
              />
            </div>
            <button
              onClick={() => exportUtils.toPdf(preview.title)}
              className="inline-flex items-center gap-2 rounded-xl border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-base"
            >
              <Printer className="h-4 w-4" /> PDF
            </button>
            <button
              onClick={exportWord}
              className="inline-flex items-center gap-2 rounded-xl border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-base"
            >
              <FileText className="h-4 w-4" /> Word
            </button>
            <button
              onClick={() =>
                exportUtils.toExcel(
                  toDisplayRows(preview),
                  preview.title.replace(/\s+/g, "_"),
                  preview.title,
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-0">
        <aside className="border-r border-border-default bg-surface-base p-5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search report templates..."
              className="w-full rounded-xl border border-border-default bg-surface-card px-4 py-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="mb-3 text-xs font-black uppercase tracking-widest text-text-disabled">
            {filteredTemplates.length} templates
          </div>
          <div className="space-y-3 overflow-auto pr-1">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => setActiveTemplateId(template.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                  activeTemplateId === template.id
                    ? "border-primary/30 bg-primary-muted shadow-sm"
                    : "border-border-default bg-surface-card hover:border-border-strong"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-slate-900">
                    {template.title}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    {template.category}
                  </span>
                </div>
                <p className="text-xs leading-5 text-text-muted">
                  {template.description}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden p-5">
          <div className="mb-4 rounded-2xl border border-border-default bg-surface-base p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {preview.title}
                </h2>
                <p className="mt-1 text-sm text-text-muted">{preview.subtitle}</p>
              </div>
              <div className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-text-disabled">
                  Rows
                </div>
                <div className="text-lg font-black text-slate-900">
                  {preview.rows.length}
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border-default bg-surface-card">
            {loading ? (
              <div className="p-10 text-center text-text-muted">
                Loading planning datasets...
              </div>
            ) : preview.columns.length === 0 ? (
              <div className="p-10 text-center text-text-muted">
                Select a report template to preview it.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface-base">
                  <tr className="border-b border-border-default">
                    {preview.columns.map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-text-muted"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr
                      key={`${preview.title}-${index}`}
                      className="border-b border-border-subtle last:border-b-0"
                    >
                      {preview.columns.map((column) => (
                        <td key={column} className="px-4 py-3 text-text-secondary">
                          {row[column] ?? "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-border-default bg-surface-base px-4 py-3 text-sm text-text-muted">
            <span>
              Designed for construction planning reviews, lookahead meetings, and commercial coordination.
            </span>
            <span className="inline-flex items-center gap-2 font-semibold text-text-secondary">
              <Download className="h-4 w-4" /> PDF / Word / Excel ready
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PlanningReportsPage;
