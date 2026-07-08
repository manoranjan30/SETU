import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FileDown,
  FileSpreadsheet,
  Lock,
  Plus,
  RefreshCw,
  Send,
  Unlock,
  Upload,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { PermissionCode } from "../../config/permissions";
import {
  projectHealthService,
  type ProjectHealthBurnRow,
  type ProjectHealthCatchupRow,
  type ProjectHealthMilestoneRow,
  type ProjectHealthReport,
  type ProjectHealthResourceRow,
  type ProjectHealthRiskRow,
} from "../../services/project-health.service";
import { downloadBlob, withFileExtension } from "../../utils/file-download.utils";

type TabKey =
  | "overview"
  | "burn"
  | "resources"
  | "risks"
  | "catchup"
  | "milestones";

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "burn", label: "Burn Projection" },
  { key: "resources", label: "Resources" },
  { key: "risks", label: "Progress Risk" },
  { key: "catchup", label: "Catch-up Planning" },
  { key: "milestones", label: "Critical Milestones" },
];

const monthValue = (date = new Date()) => date.toISOString().slice(0, 7);
const firstOfMonth = (month: string) => `${month || monthValue()}-01`;

export default function ProjectHealthPage() {
  const { projectId } = useParams();
  const pId = Number(projectId || 0);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PermissionCode.PLANNING_HEALTH_CREATE);
  const canUpdate = hasPermission(PermissionCode.PLANNING_HEALTH_UPDATE);
  const canSubmit = hasPermission(PermissionCode.PLANNING_HEALTH_SUBMIT);
  const canLock = hasPermission(PermissionCode.PLANNING_HEALTH_LOCK);
  const canReopen = hasPermission(PermissionCode.PLANNING_HEALTH_REOPEN);
  const canExport = hasPermission(PermissionCode.PLANNING_HEALTH_EXPORT);
  const canImport = hasPermission(PermissionCode.PLANNING_HEALTH_IMPORT);

  const [reports, setReports] = useState<ProjectHealthReport[]>([]);
  const [report, setReport] = useState<ProjectHealthReport | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newMonth, setNewMonth] = useState(monthValue());

  const [burnRows, setBurnRows] = useState<ProjectHealthBurnRow[]>([]);
  const [resourceRows, setResourceRows] = useState<ProjectHealthResourceRow[]>(
    [],
  );
  const [riskRows, setRiskRows] = useState<ProjectHealthRiskRow[]>([]);
  const [catchupRows, setCatchupRows] = useState<ProjectHealthCatchupRow[]>([]);
  const [milestoneRows, setMilestoneRows] = useState<
    ProjectHealthMilestoneRow[]
  >([]);

  const isLocked = report?.status === "LOCKED";
  const canEdit = canUpdate && !isLocked;

  const loadReports = async (selectId?: number) => {
    if (!pId) return;
    setLoading(true);
    setError("");
    try {
      const list = await projectHealthService.list(pId);
      setReports(list);
      const selected = selectId
        ? list.find((r) => r.id === selectId)
        : list[0] || null;
      if (selected) {
        await loadReport(selected.id);
      } else {
        setReport(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load health reports");
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (reportId: number) => {
    const data = await projectHealthService.get(pId, reportId);
    setReport(data);
    setBurnRows(data.burnRows || []);
    setResourceRows(data.resourceRows || []);
    setRiskRows(data.risks || []);
    setCatchupRows(data.catchupPlans || []);
    setMilestoneRows(data.milestones || []);
  };

  useEffect(() => {
    loadReports();
  }, [pId]);

  const createReport = async () => {
    if (!pId || !canCreate) return;
    setSaving(true);
    setError("");
    try {
      const created = await projectHealthService.create(pId, {
        reportingMonth: firstOfMonth(newMonth),
        cbeSubmissionMonth: firstOfMonth(newMonth),
      });
      await loadReports(created.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create report");
    } finally {
      setSaving(false);
    }
  };

  const saveSection = async (section: TabKey) => {
    if (!report || !canEdit) return;
    setSaving(true);
    setError("");
    try {
      let updated: ProjectHealthReport;
      if (section === "burn") {
        updated = await projectHealthService.saveBurn(pId, report.id, burnRows);
      } else if (section === "resources") {
        updated = await projectHealthService.saveResources(
          pId,
          report.id,
          resourceRows,
        );
      } else if (section === "risks") {
        updated = await projectHealthService.saveRisks(pId, report.id, riskRows);
      } else if (section === "catchup") {
        updated = await projectHealthService.saveCatchup(
          pId,
          report.id,
          catchupRows,
        );
      } else {
        updated = await projectHealthService.saveMilestones(
          pId,
          report.id,
          milestoneRows,
        );
      }
      await loadReport(updated.id);
      await loadReports(updated.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save section");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: "recalculate" | "submit" | "lock" | "reopen") => {
    if (!report) return;
    setSaving(true);
    try {
      const updated =
        action === "recalculate"
          ? await projectHealthService.recalculate(pId, report.id)
          : action === "submit"
            ? await projectHealthService.submit(pId, report.id)
            : action === "lock"
              ? await projectHealthService.lock(pId, report.id)
              : await projectHealthService.reopen(pId, report.id);
      await loadReport(updated.id);
      await loadReports(updated.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const importFile = async (file?: File | null) => {
    if (!file || !canImport) return;
    setSaving(true);
    setError("");
    try {
      const imported = await projectHealthService.importXlsx(pId, file);
      await loadReports(imported.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to import workbook");
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = async () => {
    if (!canImport) return;
    setSaving(true);
    try {
      const blob = await projectHealthService.downloadTemplate(pId);
      downloadBlob(blob, "project-health-template.xlsx");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Template download failed");
    } finally {
      setSaving(false);
    }
  };

  const downloadExport = async (format: "xlsx" | "pdf") => {
    if (!report) return;
    setSaving(true);
    try {
      const blob =
        format === "xlsx"
          ? await projectHealthService.exportXlsx(pId, report.id)
          : await projectHealthService.exportPdf(pId, report.id);
      downloadBlob(
        blob,
        withFileExtension(
          `Project Health ${report.reportingMonth?.slice(0, 7) || report.id}`,
          format,
        ),
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || "Export failed");
    } finally {
      setSaving(false);
    }
  };

  const riskSummary = useMemo(() => {
    const open = riskRows.filter((risk) => risk.status !== "CLOSED");
    return {
      open: open.length,
      high: open.filter((risk) => Number(risk.riskScore || 0) >= 4).length,
    };
  }, [riskRows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-surface-ground p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-text-primary">
            <Activity size={22} /> Project Health
          </h2>
          <p className="text-sm text-text-muted">
            Monthly project health pack with burn, resources, risks, catch-up and milestones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reports.length > 0 && (
            <select
              className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
              value={report?.id || ""}
              onChange={(event) => loadReport(Number(event.target.value))}
            >
              {reports.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.reportingMonth?.slice(0, 7)} - {item.status}
                </option>
              ))}
            </select>
          )}
          {canCreate && (
            <>
              <input
                type="month"
                className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                value={newMonth}
                onChange={(event) => setNewMonth(event.target.value)}
              />
              <button
                type="button"
                onClick={createReport}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow"
              >
                <Plus size={16} /> New Report
              </button>
            </>
          )}
          {canImport && (
            <>
              <button
                type="button"
                onClick={downloadTemplate}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm font-semibold text-text-primary shadow-sm"
              >
                <FileSpreadsheet size={16} /> Download Template
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm font-semibold text-text-primary shadow-sm">
                <Upload size={16} /> Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => importFile(event.target.files?.[0])}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="ui-card p-6 text-sm text-text-muted">Loading health reports...</div>
      ) : !report ? (
        <div className="ui-card p-8 text-center">
          <BarChart3 className="mx-auto mb-3 text-primary" size={36} />
          <h3 className="text-lg font-semibold">No monthly health report yet</h3>
          <p className="text-sm text-text-muted">
            Create or import the first report to start tracking project health.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <ScoreCard label="Overall" value={report.overallHealthScore} />
            <ScoreCard label="Lead Health" value={report.leadHealthScore} />
            <ScoreCard label="Lag Health" value={report.lagHealthScore} />
            <div className="ui-card p-4">
              <p className="text-xs font-semibold uppercase text-text-muted">
                Report Status
              </p>
              <p className="mt-1 text-xl font-bold text-text-primary">
                {report.status}
              </p>
              <p className="text-xs text-text-muted">
                Month {report.reportingMonth?.slice(0, 7)}
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border-default bg-surface-card p-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === tab.key
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:bg-surface-raised"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runAction("recalculate")}
                disabled={saving || !canUpdate}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
              >
                <RefreshCw size={16} /> Recalculate
              </button>
              {canSubmit && report.status !== "LOCKED" && (
                <button
                  type="button"
                  onClick={() => runAction("submit")}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
                >
                  <Send size={16} /> Submit
                </button>
              )}
              {canLock && report.status !== "LOCKED" && (
                <button
                  type="button"
                  onClick={() => runAction("lock")}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
                >
                  <Lock size={16} /> Lock
                </button>
              )}
              {canReopen && report.status === "LOCKED" && (
                <button
                  type="button"
                  onClick={() => runAction("reopen")}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
                >
                  <Unlock size={16} /> Reopen
                </button>
              )}
              {canExport && (
                <>
                  <button
                    type="button"
                    onClick={() => downloadExport("xlsx")}
                    className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
                  >
                    <FileSpreadsheet size={16} /> Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExport("pdf")}
                    className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
                  >
                    <FileDown size={16} /> PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {activeTab === "overview" && (
            <OverviewTab report={report} riskSummary={riskSummary} />
          )}
          {activeTab === "burn" && (
            <BurnTab
              rows={burnRows}
              setRows={setBurnRows}
              canEdit={canEdit}
              onSave={() => saveSection("burn")}
            />
          )}
          {activeTab === "resources" && (
            <ResourceTab
              rows={resourceRows}
              setRows={setResourceRows}
              canEdit={canEdit}
              onSave={() => saveSection("resources")}
            />
          )}
          {activeTab === "risks" && (
            <RiskTab
              rows={riskRows}
              setRows={setRiskRows}
              canEdit={canEdit}
              onSave={() => saveSection("risks")}
            />
          )}
          {activeTab === "catchup" && (
            <CatchupTab
              rows={catchupRows}
              setRows={setCatchupRows}
              canEdit={canEdit}
              onSave={() => saveSection("catchup")}
            />
          )}
          {activeTab === "milestones" && (
            <MilestoneTab
              rows={milestoneRows}
              setRows={setMilestoneRows}
              canEdit={canEdit}
              onSave={() => saveSection("milestones")}
            />
          )}
        </>
      )}
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color =
    value > 80 ? "text-emerald-700" : value >= 60 ? "text-amber-700" : "text-red-700";
  return (
    <div className="ui-card p-4">
      <p className="text-xs font-semibold uppercase text-text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{Math.round(value || 0)}</p>
      <div className="mt-2 h-2 rounded-full bg-surface-raised">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }}
        />
      </div>
    </div>
  );
}

function OverviewTab({
  report,
  riskSummary,
}: {
  report: ProjectHealthReport;
  riskSummary: { open: number; high: number };
}) {
  const breakdown = report.calculationBreakdown || {};
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="ui-card p-4 lg:col-span-2">
        <h3 className="mb-3 text-base font-bold">Executive Summary</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Open Risks" value={riskSummary.open} />
          <Metric label="High Risks" value={riskSummary.high} />
          <Metric label="Burn Shortfall" value={`${breakdown.burnShortfallPercent || 0}%`} />
          <Metric label="Delayed Milestones" value={breakdown.delayedMilestoneCount || 0} />
        </div>
      </div>
      <div className="ui-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
          <AlertTriangle size={18} /> Escalation Signal
        </h3>
        <p className="text-sm text-text-secondary">
          {report.overallHealthScore > 80
            ? "Green. Project health is within control."
            : report.overallHealthScore >= 60
              ? "Amber. Function heads should review open risks and catch-up actions."
              : "Red. Escalate to leadership with recovery plan and ownership."}
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-ground p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-bold text-text-primary">{value}</p>
    </div>
  );
}

function SectionShell({
  title,
  canEdit,
  onSave,
  children,
}: {
  title: string;
  canEdit: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="ui-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-default p-4">
        <h3 className="text-base font-bold">{title}</h3>
        {canEdit && (
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
          >
            Save Section
          </button>
        )}
      </div>
      <div className="overflow-auto p-4">{children}</div>
    </div>
  );
}

function BurnTab({
  rows,
  setRows,
  canEdit,
  onSave,
}: {
  rows: ProjectHealthBurnRow[];
  setRows: (rows: ProjectHealthBurnRow[]) => void;
  canEdit: boolean;
  onSave: () => void;
}) {
  const addRow = () =>
    setRows([
      ...rows,
      { month: firstOfMonth(monthValue()), metricType: "AOP", valueCrores: 0 },
    ]);
  return (
    <SectionShell title="Burn Projection" canEdit={canEdit} onSave={onSave}>
      <GridActions canEdit={canEdit} onAdd={addRow} />
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-text-muted">
            <th className="p-2">Month</th>
            <th className="p-2">Metric</th>
            <th className="p-2">Value Crores</th>
            <th className="p-2">Override Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border-subtle">
              <td className="p-2">
                <CellInput
                  type="month"
                  value={row.month?.slice(0, 7)}
                  disabled={!canEdit}
                  onChange={(value) =>
                    patchRow(rows, setRows, index, { month: firstOfMonth(value) })
                  }
                />
              </td>
              <td className="p-2">
                <Select
                  value={row.metricType}
                  disabled={!canEdit}
                  options={["AOP", "CBE", "ACTUAL"]}
                  onChange={(value) =>
                    patchRow(rows, setRows, index, { metricType: value as any })
                  }
                />
              </td>
              <td className="p-2">
                <CellInput
                  type="number"
                  value={row.valueCrores}
                  disabled={!canEdit}
                  onChange={(value) =>
                    patchRow(rows, setRows, index, { valueCrores: Number(value) })
                  }
                />
              </td>
              <td className="p-2">
                <CellInput
                  value={row.overrideReason || ""}
                  disabled={!canEdit}
                  onChange={(value) =>
                    patchRow(rows, setRows, index, { overrideReason: value })
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}

function ResourceTab(props: {
  rows: ProjectHealthResourceRow[];
  setRows: (rows: ProjectHealthResourceRow[]) => void;
  canEdit: boolean;
  onSave: () => void;
}) {
  const { rows, setRows, canEdit, onSave } = props;
  const addRow = () =>
    setRows([
      ...rows,
      {
        resourceType: "LABOUR",
        month: firstOfMonth(monthValue()),
        aop: 0,
        planned: 0,
        actual: 0,
      },
    ]);
  return (
    <SectionShell title="Labour and Staff Availability" canEdit={canEdit} onSave={onSave}>
      <GridActions canEdit={canEdit} onAdd={addRow} />
      <EditableTable
        rows={rows}
        setRows={setRows}
        canEdit={canEdit}
        columns={[
          { key: "resourceType", label: "Type", options: ["LABOUR", "STAFF"] },
          { key: "month", label: "Month", type: "month" },
          { key: "aop", label: "AOP", type: "number" },
          { key: "planned", label: "Planned", type: "number" },
          { key: "actual", label: "Actual", type: "number" },
          { key: "overrideReason", label: "Reason" },
        ]}
      />
    </SectionShell>
  );
}

function RiskTab(props: {
  rows: ProjectHealthRiskRow[];
  setRows: (rows: ProjectHealthRiskRow[]) => void;
  canEdit: boolean;
  onSave: () => void;
}) {
  const { rows, setRows, canEdit, onSave } = props;
  const addRow = () =>
    setRows([
      ...rows,
      { taskDescription: "", status: "OPEN", severity: "LOW", delayDays: 0 },
    ]);
  return (
    <SectionShell title="Progress Risk Register" canEdit={canEdit} onSave={onSave}>
      <GridActions canEdit={canEdit} onAdd={addRow} />
      <EditableTable
        rows={rows}
        setRows={setRows}
        canEdit={canEdit}
        columns={[
          { key: "tower", label: "Tower" },
          { key: "package", label: "Package" },
          { key: "taskGroup", label: "Task Group" },
          { key: "taskDescription", label: "Task Description" },
          { key: "plannedDate", label: "Plan", type: "date" },
          { key: "cbeDate", label: "CBE", type: "date" },
          { key: "delayDays", label: "Delay", type: "number" },
          { key: "accountabilityFunction", label: "Function" },
          { key: "accountabilityPerson", label: "Person" },
          { key: "severity", label: "Severity", options: ["NO_IMPACT", "LOW", "MEDIUM", "HIGH"] },
          { key: "status", label: "Status", options: ["OPEN", "CLOSED"] },
          { key: "riskScore", label: "Score", type: "number", readOnly: true },
        ]}
      />
    </SectionShell>
  );
}

function CatchupTab(props: {
  rows: ProjectHealthCatchupRow[];
  setRows: (rows: ProjectHealthCatchupRow[]) => void;
  canEdit: boolean;
  onSave: () => void;
}) {
  const { rows, setRows, canEdit, onSave } = props;
  const addRow = () =>
    setRows([
      ...rows,
      { package: "", contractor: "", plannedCatchupCocCrores: 0, status: "OPEN" },
    ]);
  return (
    <SectionShell title="Catch-up Planning" canEdit={canEdit} onSave={onSave}>
      <GridActions canEdit={canEdit} onAdd={addRow} />
      <EditableTable
        rows={rows}
        setRows={setRows}
        canEdit={canEdit}
        columns={[
          { key: "package", label: "Package" },
          { key: "contractor", label: "Contractor" },
          { key: "plannedCatchupCocCrores", label: "COC Crores", type: "number" },
          { key: "strategy", label: "Strategy" },
          { key: "details", label: "Action Details" },
          { key: "targetDate", label: "Target", type: "date" },
          { key: "status", label: "Status", options: ["OPEN", "IN_PROGRESS", "CLOSED"] },
        ]}
      />
    </SectionShell>
  );
}

function MilestoneTab(props: {
  rows: ProjectHealthMilestoneRow[];
  setRows: (rows: ProjectHealthMilestoneRow[]) => void;
  canEdit: boolean;
  onSave: () => void;
}) {
  const { rows, setRows, canEdit, onSave } = props;
  const addRow = () =>
    setRows([...rows, { towerName: "Overall Project", milestoneName: "" }]);
  return (
    <SectionShell title="Critical Milestones" canEdit={canEdit} onSave={onSave}>
      <GridActions canEdit={canEdit} onAdd={addRow} />
      <EditableTable
        rows={rows}
        setRows={setRows}
        canEdit={canEdit}
        columns={[
          { key: "towerName", label: "Tower" },
          { key: "milestoneName", label: "Milestone" },
          { key: "aopDate", label: "AOP", type: "date" },
          { key: "cbeDate", label: "CBE", type: "date" },
          { key: "actualDate", label: "Actual", type: "date" },
          { key: "delayDays", label: "Delay", type: "number" },
          { key: "milestoneGroup", label: "Group" },
        ]}
      />
    </SectionShell>
  );
}

function GridActions({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      onClick={onAdd}
      className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
    >
      <Plus size={15} /> Add Row
    </button>
  );
}

function EditableTable<T extends Record<string, any>>({
  rows,
  setRows,
  canEdit,
  columns,
}: {
  rows: T[];
  setRows: (rows: T[]) => void;
  canEdit: boolean;
  columns: {
    key: string;
    label: string;
    type?: string;
    options?: string[];
    readOnly?: boolean;
  }[];
}) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase text-text-muted">
          {columns.map((column) => (
            <th key={column.key} className="min-w-[130px] p-2">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-t border-border-subtle">
            {columns.map((column) => (
              <td key={column.key} className="p-2">
                {column.options ? (
                  <Select
                    value={row[column.key] || column.options[0]}
                    disabled={!canEdit || column.readOnly}
                    options={column.options}
                    onChange={(value) =>
                      patchRow(rows, setRows, rowIndex, {
                        [column.key]: value,
                      } as Partial<T>)
                    }
                  />
                ) : (
                  <CellInput
                    type={column.type}
                    value={
                      column.type === "month"
                        ? String(row[column.key] || "").slice(0, 7)
                        : row[column.key] || ""
                    }
                    disabled={!canEdit || column.readOnly}
                    onChange={(value) =>
                      patchRow(rows, setRows, rowIndex, {
                        [column.key]:
                          column.type === "number"
                            ? Number(value)
                            : column.type === "month"
                              ? firstOfMonth(value)
                              : value,
                      } as Partial<T>)
                    }
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CellInput({
  value,
  onChange,
  disabled,
  type = "text",
}: {
  value: any;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-sm disabled:bg-surface-ground"
    />
  );
}

function Select({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-sm disabled:bg-surface-ground"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function patchRow<T>(
  rows: T[],
  setRows: (rows: T[]) => void,
  index: number,
  patch: Partial<T>,
) {
  setRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
}
