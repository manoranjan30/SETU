import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileText,
  Hammer,
  Home,
  ImagePlus,
  ListChecks,
  Loader2,
  PenLine,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import { getPublicFileUrl } from "../../api/baseUrl";
import { PermissionCode } from "../../config/permissions";
import { useAuth } from "../../context/AuthContext";
import {
  snagService,
  type SnagAnalytics,
  type SnagAnalyticsRow,
  type SnagApproval,
  type SnagChecklistItem,
  type SnagChecklistStatus,
  type SnagItemDetail,
  type SnagListDetail,
  type SnagProcessStepConfig,
  type SnagRoundDetail,
  type SnagUnitSummary,
} from "../../services/snag.service";

type ExplorerFloor = {
  key: string;
  label: string;
  units: SnagUnitSummary[];
};

type ExplorerTower = {
  key: string;
  label: string;
  floors: ExplorerFloor[];
};

type ExplorerBlock = {
  key: string;
  label: string;
  towers: ExplorerTower[];
};

type EvidenceMode = "RECTIFY" | "CLOSE";

type EvidenceDialogState = {
  mode: EvidenceMode;
  itemIds: number[];
  title: string;
};

type SkipDialogState = {
  roundId: number;
  currentLabel: string;
  currentDesnagLabel: string;
  nextLabel: string;
};

type ResetRoundDialogState = {
  roundId: number;
  currentLabel: string;
  currentDesnagLabel: string;
  laterCycleCount: number;
  rollsBackHandover: boolean;
};

type DeleteItemDialogState = {
  itemId: number;
  defectTitle: string;
};

type FinalClosureDialogState = {
  roundId: number;
  roundNumber: number;
  label: string;
  levelOrder: number;
  levelName: string;
  isFinalStageLevel: boolean;
};

type SnagView = "dashboard" | "workflow" | "final";

type StepUnitStatus =
  | "unready"
  | "locked"
  | "ready_for_snag"
  | "snagging"
  | "desnagging"
  | "released"
  | "completed"
  | "handover_ready";

type SnagFormState = {
  qualityRoomId: number | "";
  processActivityId: number | "OTHER" | "";
  commonPointId: number | "OTHER" | "";
  defectTitle: string;
  defectDescription: string;
  trade: string;
  priority: string;
  beforeFiles: FileList | null;
  linkedChecklistItemId: string | null;
};

const STATUS_ORDER: Record<string, number> = {
  open: 0,
  on_hold: 1,
  rectified: 2,
  closed: 3,
};

const DEFAULT_SNAG_FORM: SnagFormState = {
  qualityRoomId: "",
  processActivityId: "",
  commonPointId: "",
  defectTitle: "",
  defectDescription: "",
  trade: "",
  priority: "medium",
  beforeFiles: null,
  linkedChecklistItemId: null,
};

const CHECKLIST_STATUSES: SnagChecklistStatus[] = [
  "IDENTIFIED",
  "RECTIFIED",
  "NA",
];

const DEFAULT_SNAG_CYCLES = 3;
const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-error)",
  "var(--color-secondary)",
  "var(--color-info)",
  "var(--color-primary-dark)",
  "var(--color-text-muted)",
];

const STATUS_COLORS: Record<string, string> = {
  unready: "var(--color-text-muted)",
  ready_for_snag: "var(--color-primary)",
  snagging: "var(--color-error)",
  desnagging: "var(--color-info)",
  released: "var(--color-secondary)",
  handover_ready: "var(--color-success)",
};

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function getFileUrl(path: string) {
  return getPublicFileUrl(path);
}

function getSnagCycleLabel(roundNumber: number) {
  return `Snag ${roundNumber}`;
}

function getDesnagCycleLabel(roundNumber: number) {
  return `De-snag ${roundNumber}`;
}

function getNextSnagCycleLabel(roundNumber: number, maxCycles: number) {
  return roundNumber >= maxCycles
    ? "Customer Inspection"
    : getSnagCycleLabel(roundNumber + 1);
}

function getWorkflowStatusLabel(status: string, currentRound: number) {
  switch (status) {
    case "unready":
      return "Not ready for snagging";
    case "ready_for_snag":
      return `Ready for ${getSnagCycleLabel(currentRound)}`;
    case "snagging":
      return `${getSnagCycleLabel(currentRound)} open`;
    case "desnagging":
      return `${getDesnagCycleLabel(currentRound)} active`;
    case "released":
      return `${getSnagCycleLabel(currentRound)} closed - next snag pending`;
    case "handover_ready":
      return "Ready for Customer Inspection";
    default:
      return status.replace(/_/g, " ");
  }
}

function getStepUnitStatus(
  unit: SnagUnitSummary,
  selectedRound: number,
): StepUnitStatus {
  if (!unit.snagListId) {
    return selectedRound === 1 ? "unready" : "locked";
  }
  if (unit.overallStatus === "handover_ready") {
    return "handover_ready";
  }
  if (unit.currentRound > selectedRound) {
    return "completed";
  }
  if (unit.currentRound < selectedRound) {
    return unit.overallStatus === "released" &&
      unit.currentRound + 1 === selectedRound
      ? "released"
      : "locked";
  }
  return unit.overallStatus;
}

function getStepUnitStatusLabel(
  status: StepUnitStatus,
  selectedRound: number,
) {
  switch (status) {
    case "unready":
      return selectedRound === 1 ? "Not ready" : "Not started";
    case "locked":
      return "Locked";
    case "ready_for_snag":
      return `Ready for ${getSnagCycleLabel(selectedRound)}`;
    case "snagging":
      return `${getSnagCycleLabel(selectedRound)} open`;
    case "desnagging":
      return `${getDesnagCycleLabel(selectedRound)} active`;
    case "released":
      return `Ready request pending for ${getSnagCycleLabel(selectedRound)}`;
    case "completed":
      return `${getSnagCycleLabel(selectedRound)} completed`;
    case "handover_ready":
      return "Ready for Customer Inspection";
    default:
      return "Unknown";
  }
}

function getCompactStepUnitStatusLabel(
  status: StepUnitStatus,
  selectedRound: number,
) {
  switch (status) {
    case "ready_for_snag":
      return `Ready S${selectedRound}`;
    case "snagging":
      return `Snag ${selectedRound}`;
    case "desnagging":
      return `De-snag ${selectedRound}`;
    case "released":
      return "Ready request";
    case "completed":
      return "Complete";
    case "handover_ready":
      return "Customer ready";
    case "locked":
      return "Locked";
    case "unready":
    default:
      return "Not ready";
  }
}

function getStepUnitCardClass(status: StepUnitStatus) {
  switch (status) {
    case "ready_for_snag":
      return "border-primary/25 bg-primary-muted/20 hover:border-primary";
    case "snagging":
      return "border-error/25 bg-error-muted/20 hover:border-error";
    case "desnagging":
      return "border-info/25 bg-info-muted/20 hover:border-info";
    case "released":
      return "border-warning/30 bg-warning-muted/25 hover:border-warning";
    case "completed":
    case "handover_ready":
      return "border-success/25 bg-success-muted/25 hover:border-success";
    case "locked":
      return "border-border-subtle bg-surface-sunken text-text-muted";
    case "unready":
    default:
      return "border-border-default bg-surface-card hover:border-primary";
  }
}

function getSubmitSnagActionLabel(roundNumber: number) {
  return `Submit ${getSnagCycleLabel(roundNumber)} to start ${getDesnagCycleLabel(
    roundNumber,
  )}`;
}

function getReleaseActionLabel(roundNumber: number, maxCycles: number) {
  return roundNumber >= maxCycles
    ? `Send ${getDesnagCycleLabel(roundNumber)} for Final Release to Customer Inspection`
    : `Send ${getDesnagCycleLabel(roundNumber)} for Release to ${getSnagCycleLabel(
        roundNumber + 1,
      )}`;
}

function getReleaseWorkflowTitle(roundNumber: number, maxCycles: number) {
  return roundNumber >= maxCycles
    ? "Final Release to Customer Inspection"
    : `${getDesnagCycleLabel(roundNumber)} Release Workflow`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: string;
      response?: { data?: { message?: string | string[] } };
    };
    const responseMessage = candidate.response?.data?.message;
    if (Array.isArray(responseMessage) && responseMessage.length > 0) {
      return responseMessage.join(", ");
    }
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
  }
  return fallback;
}

function formatPhaseStatus(status: string, isSkipped = false) {
  if (isSkipped) return "skipped";
  return status.replace(/_/g, " ");
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "open":
    case "IDENTIFIED":
      return "border-error/20 bg-error-muted text-error";
    case "rectified":
    case "RECTIFIED":
      return "border-success/20 bg-success-muted text-success";
    case "closed":
      return "border-info/20 bg-info-muted text-info";
    case "on_hold":
      return "border-warning/20 bg-warning-muted text-warning";
    case "handover_ready":
    case "completed":
      return "border-success/20 bg-success-muted text-success";
    case "desnagging":
      return "border-info/20 bg-info-muted text-info";
    case "ready_for_snag":
      return "border-primary/20 bg-primary-muted text-primary";
    case "unready":
    case "locked":
      return "border-border-default bg-surface-base text-text-muted";
    case "released":
      return "border-secondary/20 bg-secondary-muted text-secondary";
    case "submitted":
      return "border-info/20 bg-info-muted text-info";
    case "approval_pending":
      return "border-warning/20 bg-warning-muted text-warning";
    case "approved":
      return "border-success/20 bg-success-muted text-success";
    case "rejected":
      return "border-error/20 bg-error-muted text-error";
    case "skipped":
      return "border-secondary/20 bg-secondary-muted text-secondary";
    default:
      return "border-border-default bg-surface-base text-text-secondary";
  }
}

function checklistStatusClass(status: SnagChecklistStatus) {
  switch (status) {
    case "IDENTIFIED":
      return "border-error/20 bg-error-muted text-error";
    case "RECTIFIED":
      return "border-success/20 bg-success-muted text-success";
    case "NA":
    default:
      return "border-border-default bg-surface-base text-text-muted";
  }
}

function getConfigActivityLabel(activity?: {
  activityName?: string | null;
  name?: string | null;
  activityCode?: string | null;
} | null) {
  return activity?.activityName || activity?.name || "Activity";
}

function buildExplorer(units: SnagUnitSummary[]) {
  const blocks = new Map<string, ExplorerBlock>();

  for (const unit of [...units].sort((a, b) => {
    const blockCompare = naturalSort(a.blockLabel || "General", b.blockLabel || "General");
    if (blockCompare !== 0) return blockCompare;
    const towerCompare = naturalSort(a.towerLabel, b.towerLabel);
    if (towerCompare !== 0) return towerCompare;
    const floorCompare = naturalSort(a.floorLabel, b.floorLabel);
    if (floorCompare !== 0) return floorCompare;
    return naturalSort(a.unitLabel, b.unitLabel);
  })) {
    const blockLabel = unit.blockLabel || "General Block";
    const blockKey = `block:${unit.blockId ?? blockLabel}`;
    if (!blocks.has(blockKey)) {
      blocks.set(blockKey, { key: blockKey, label: blockLabel, towers: [] });
    }
    const block = blocks.get(blockKey)!;

    const towerKey = `tower:${unit.towerId}`;
    let tower = block.towers.find((entry) => entry.key === towerKey);
    if (!tower) {
      tower = { key: towerKey, label: unit.towerLabel, floors: [] };
      block.towers.push(tower);
    }

    const floorKey = `floor:${unit.floorId}`;
    let floor = tower.floors.find((entry) => entry.key === floorKey);
    if (!floor) {
      floor = { key: floorKey, label: unit.floorLabel, units: [] };
      tower.floors.push(floor);
    }

    floor.units.push(unit);
  }

  return [...blocks.values()];
}

function renderPhotoStrip(items: Array<{ id: number; fileUrl: string }>, emptyLabel: string) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border-default px-3 py-4 text-xs text-text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((photo) => {
        const resolvedUrl = getFileUrl(photo.fileUrl);
        return (
          <a
            key={photo.id}
            href={resolvedUrl}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-xl border border-border-subtle bg-surface-card"
          >
            <img
              src={resolvedUrl}
              alt="Snag evidence"
              className="h-24 w-full object-cover transition-transform group-hover:scale-105"
            />
          </a>
        );
      })}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-default bg-surface-card">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-surface-base p-2 text-primary">{icon}</div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "danger" | "warning" | "info" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-error"
      : tone === "warning"
        ? "text-warning"
        : tone === "info"
          ? "text-info"
          : tone === "success"
            ? "text-success"
            : "text-text-primary";
  return (
    <div className="rounded-2xl border border-border-default bg-surface-card px-4 py-3">
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
    </div>
  );
}

function UnitCardMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border-subtle bg-surface-base/80 px-3 py-2">
      <div className="truncate text-sm font-semibold text-text-primary">
        {value}
      </div>
      <div className="mt-0.5 truncate text-[11px] font-medium text-text-muted">
        {label}
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-default bg-surface-card p-4">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <div className="mt-3 h-72 min-h-72">{children}</div>
    </section>
  );
}

function EmptyChart({ label = "No data" }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border-default text-sm text-text-muted">
      {label}
    </div>
  );
}

function SnagPieChart({ rows }: { rows: SnagAnalyticsRow[] }) {
  if (!rows.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={rows}
          dataKey="count"
          nameKey="label"
          innerRadius="48%"
          outerRadius="76%"
          paddingAngle={2}
        >
          {rows.map((row, index) => (
            <Cell
              key={row.label}
              fill={STATUS_COLORS[row.label] || CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function SnagBarChart({
  rows,
  color = "var(--color-primary)",
}: {
  rows: SnagAnalyticsRow[];
  color?: string;
}) {
  if (!rows.length) return <EmptyChart />;
  const data = rows.slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={104}
          tick={{ fontSize: 11 }}
        />
        <Tooltip />
        <Bar dataKey="count" fill={color} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ClosureGauge({ closed, total }: { closed: number; total: number }) {
  const percent = total > 0 ? Math.round((closed / total) * 100) : 0;
  const data = [{ name: "Closure", value: percent, fill: "var(--color-success)" }];
  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="68%"
          outerRadius="92%"
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <RadialBar dataKey="value" cornerRadius={14} background />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 bottom-12 text-center">
        <div className="text-4xl font-semibold text-text-primary">{percent}%</div>
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
          Point Closure
        </div>
      </div>
    </div>
  );
}

function SnagAnalysisDashboard({
  analytics,
  loading,
  error,
  onRefresh,
}: {
  analytics: SnagAnalytics | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-default px-6 py-16 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading snag analysis...
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="rounded-2xl border border-error/25 bg-error-muted/50 px-6 py-8 text-sm text-error">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          Snag analysis could not load.
        </div>
        <p className="mt-3">{error}</p>
        <button
          onClick={onRefresh}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-error/30 bg-surface-card px-3 py-2 font-medium text-error hover:bg-error-muted/40"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const summary = analytics?.summary;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            Snag Analysis Dashboard
          </h2>
          <p className="text-sm text-text-muted">
            Project-wide snag health across units, cycles, rooms, activities,
            rejection history, and aging.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-base disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricTile label="Units" value={summary?.totalUnits ?? 0} />
        <MetricTile
          label="Open"
          value={summary?.openSnagPoints ?? 0}
          tone="danger"
        />
        <MetricTile
          label="Pending De-snag"
          value={summary?.rectifiedPendingDesnag ?? 0}
          tone="warning"
        />
        <MetricTile
          label="Rejected"
          value={summary?.notSatisfactoryPoints ?? 0}
          tone="danger"
        />
        <MetricTile
          label="Closed"
          value={summary?.closedSnagPoints ?? 0}
          tone="success"
        />
        <MetricTile
          label="Avg Open Age"
          value={`${summary?.averageOpenAgeDays ?? 0}d`}
          tone="info"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <ChartPanel title="Unit Status Mix">
          <SnagPieChart rows={analytics?.byStatus || []} />
        </ChartPanel>
        <ChartPanel title="Closure Health">
          <ClosureGauge
            closed={summary?.closedSnagPoints || 0}
            total={summary?.totalSnagPoints || 0}
          />
        </ChartPanel>
        <ChartPanel title="Open Aging">
          <SnagBarChart rows={analytics?.agingBuckets || []} color="#dc2626" />
        </ChartPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartPanel title="Snags by Process Step">
          <SnagBarChart rows={analytics?.byProcessStep || []} color="#7c3aed" />
        </ChartPanel>
        <ChartPanel title="Tower Hotspots">
          <SnagBarChart rows={analytics?.byTower || []} color="#0891b2" />
        </ChartPanel>
        <ChartPanel title="Activity Hotspots">
          <SnagBarChart rows={analytics?.byActivity || []} color="#f59e0b" />
        </ChartPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartPanel title="Room Hotspots">
          <SnagBarChart rows={analytics?.byRoom || []} color="#2563eb" />
        </ChartPanel>
        <ChartPanel title="Recurring Snag Points">
          <SnagBarChart rows={analytics?.recurringSnags || []} color="#db2777" />
        </ChartPanel>
        <section className="rounded-2xl border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Blocked by Rejection
          </h3>
          <div className="mt-4 space-y-2">
            {!analytics?.blockedUnits?.length ? (
              <div className="rounded-xl border border-dashed border-border-default px-3 py-5 text-center text-sm text-text-muted">
                No rejected rectification loops.
              </div>
            ) : (
              analytics.blockedUnits.map((unit) => (
                <div
                  key={unit.listId}
                  className="rounded-xl border border-warning/20 bg-warning-muted/30 px-3 py-3"
                >
                  <div className="font-medium text-text-primary">
                    {unit.unitLabel}
                  </div>
                  <div className="mt-1 text-xs text-warning">
                    Snag {unit.currentRound} / {unit.status.replace(/_/g, " ")}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SnagManagementPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const pId = Number(projectId);
  const canReadSnag = Boolean(
    user &&
      (user.roles.includes("Admin") ||
        user.permissions.includes(PermissionCode.QUALITY_SNAG_READ)),
  );
  const canApproveSnagRelease = Boolean(
    user &&
      (user.roles.includes("Admin") ||
        user.permissions.includes(PermissionCode.QUALITY_SNAG_APPROVE)),
  );
  const canDeleteSnag = Boolean(
    user &&
      (user.roles.includes("Admin") ||
        user.permissions.includes(PermissionCode.QUALITY_SNAG_DELETE)),
  );

  const [units, setUnits] = useState<SnagUnitSummary[]>([]);
  const [analytics, setAnalytics] = useState<SnagAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [activeView, setActiveView] = useState<SnagView>("dashboard");
  const [selectedBlockKey, setSelectedBlockKey] = useState<string | null>(null);
  const [selectedTowerKey, setSelectedTowerKey] = useState<string | null>(null);
  const [selectedFloorKey, setSelectedFloorKey] = useState<string | null>(null);
  const [processSteps, setProcessSteps] = useState<SnagProcessStepConfig[]>([]);
  const [selectedWorkflowRound, setSelectedWorkflowRound] = useState(1);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [selectedUnit, setSelectedUnit] = useState<SnagUnitSummary | null>(null);
  const [detail, setDetail] = useState<SnagListDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [raiseSnagDialogOpen, setRaiseSnagDialogOpen] = useState(false);

  const [snagForm, setSnagForm] = useState<SnagFormState>(DEFAULT_SNAG_FORM);
  const [checklistDraft, setChecklistDraft] = useState<SnagChecklistItem[]>([]);
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [evidenceDialog, setEvidenceDialog] = useState<EvidenceDialogState | null>(
    null,
  );
  const [evidenceFiles, setEvidenceFiles] = useState<FileList | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [skipDialog, setSkipDialog] = useState<SkipDialogState | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [resetRoundDialog, setResetRoundDialog] =
    useState<ResetRoundDialogState | null>(null);
  const [resetRoundReason, setResetRoundReason] = useState("");
  const [deleteItemDialog, setDeleteItemDialog] =
    useState<DeleteItemDialogState | null>(null);
  const [finalClosureDialog, setFinalClosureDialog] =
    useState<FinalClosureDialogState | null>(null);
  const [finalClosureRemarks, setFinalClosureRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const loadUnits = useCallback(async () => {
    if (!pId || !canReadSnag) return;
    setLoadingUnits(true);
    try {
      const [data, configuredSteps] = await Promise.all([
        snagService.listUnits(pId),
        snagService.listProcessSteps(pId).catch(() => []),
      ]);
      setUnitsError(null);
      setUnits(data);
      setProcessSteps(configuredSteps);
    } catch (error) {
      console.error(error);
      setUnitsError(
        getErrorMessage(
          error,
          "Unable to load snag explorer units right now. Please refresh after backend startup completes.",
        ),
      );
    } finally {
      setLoadingUnits(false);
    }
  }, [canReadSnag, pId]);

  const loadAnalytics = useCallback(async () => {
    if (!pId || !canReadSnag) return;
    setLoadingAnalytics(true);
    try {
      const data = await snagService.getAnalytics(pId);
      setAnalytics(data);
      setAnalyticsError(null);
    } catch (error) {
      console.error(error);
      setAnalyticsError(
        getErrorMessage(error, "Unable to load snag analysis right now."),
      );
    } finally {
      setLoadingAnalytics(false);
    }
  }, [canReadSnag, pId]);

  const activeProcessSteps = useMemo(
    () =>
      [...processSteps]
        .filter((step) => step.isActive !== false)
        .sort((a, b) => a.workflowSerialNo - b.workflowSerialNo),
    [processSteps],
  );
  const configuredCycleCount = activeProcessSteps.length;
  const maxSnagCycles = configuredCycleCount || DEFAULT_SNAG_CYCLES;
  const workflowStepNumbers = useMemo(
    () =>
      activeProcessSteps.length
        ? activeProcessSteps.map((step) => step.workflowSerialNo)
        : Array.from({ length: DEFAULT_SNAG_CYCLES }, (_, index) => index + 1),
    [activeProcessSteps],
  );

  useEffect(() => {
    if (workflowStepNumbers.includes(selectedWorkflowRound)) return;
    setSelectedWorkflowRound(workflowStepNumbers[0] || 1);
  }, [selectedWorkflowRound, workflowStepNumbers]);

  const loadDetail = useCallback(async (listId: number, preferredRound?: number) => {
    if (!pId) return;
    const data = await snagService.getList(pId, listId);
    setDetail(data);
    const hasPreferredRound = data.rounds?.some(
      (round) => round.roundNumber === preferredRound,
    );
    setRoundNumber(
      hasPreferredRound ? preferredRound! : data.currentRound || 1,
    );
  }, [pId]);

  useEffect(() => {
    if (!canReadSnag) return;
    void loadUnits();
    void loadAnalytics();
  }, [canReadSnag, loadAnalytics, loadUnits]);

  useEffect(() => {
    setChecklistDraft(detail?.commonChecklist || []);
    setChecklistDirty(false);
    setSelectedItemIds([]);
    setSnagForm(DEFAULT_SNAG_FORM);
  }, [detail?.id, detail?.commonChecklist]);

  useEffect(() => {
    if (!checklistDirty || !detail?.id || !pId) return;

    const timeout = window.setTimeout(async () => {
      try {
        setSavingChecklist(true);
        const saved = await snagService.updateCommonChecklist(pId, detail.id, {
          items: checklistDraft.map((item, index) => ({
            ...item,
            sequence: index,
          })),
        });
        setDetail((current) =>
          current ? { ...current, commonChecklist: saved.commonChecklist } : current,
        );
        setChecklistDirty(false);
      } catch (error) {
        console.error(error);
      } finally {
        setSavingChecklist(false);
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [checklistDraft, checklistDirty, detail?.id, pId]);

  useEffect(() => {
    setSelectedItemIds([]);
  }, [roundNumber, detail?.id]);

  const currentRound = useMemo<SnagRoundDetail | undefined>(
    () => detail?.rounds?.find((round) => round.roundNumber === roundNumber),
    [detail, roundNumber],
  );
  const verifierLevels = currentRound?.verifierLevels || [];
  const activeVerifierLevel = currentRound?.activeVerifierLevel || null;
  const activeVerifierLevelOrder =
    activeVerifierLevel?.levelOrder || currentRound?.currentVerifierLevel || 1;
  const activeVerifierLevelName =
    activeVerifierLevel?.levelName ||
    currentRound?.currentVerifierLevelName ||
    "Checker";
  const isFinalVerifierLevel =
    Boolean(activeVerifierLevel) &&
    activeVerifierLevelOrder ===
      Math.max(...verifierLevels.map((level) => level.levelOrder), activeVerifierLevelOrder);
  const canRaiseSnagPoints = Boolean(
    canApproveSnagRelease && (currentRound?.canRaiseSnag ?? true),
  );

  const currentProcessStep = useMemo(() => {
    return activeProcessSteps
      .find((step) => step.workflowSerialNo === roundNumber);
  }, [activeProcessSteps, roundNumber]);

  const currentConfiguredActivities = currentProcessStep?.activities || [];
  const selectedConfiguredActivity = currentConfiguredActivities.find(
    (activity) => activity.id === snagForm.processActivityId,
  );
  const selectedCommonPoint = selectedConfiguredActivity?.commonPoints?.find(
    (point) => point.id === snagForm.commonPointId,
  );
  const raisePhotoRequired = currentProcessStep?.raisePhotoRequired ?? false;
  const rectificationPhotoRequired =
    currentProcessStep?.rectificationPhotoRequired ?? false;
  const desnagCompletionPhotoRequired =
    currentProcessStep?.desnagCompletionPhotoRequired ?? false;

  const currentCycleLabel = currentRound
    ? getSnagCycleLabel(currentRound.roundNumber)
    : "Snag";
  const currentDesnagLabel = currentRound
    ? getDesnagCycleLabel(currentRound.roundNumber)
    : "De-snag";
  const nextCycleReadyLabel = currentRound
    ? getSnagCycleLabel(Math.min(currentRound.roundNumber + 1, maxSnagCycles))
    : "next Snag";

  const activeApproval = useMemo<SnagApproval | undefined>(
    () =>
      currentRound?.approvals?.find((approval) => approval.status === "pending"),
    [currentRound],
  );

  const filteredUnits = useMemo(() => {
    const term = deferredSearchQuery.trim().toLowerCase();
    if (!term) return units;
    return units.filter((unit) =>
      [
        unit.blockLabel,
        unit.towerLabel,
        unit.floorLabel,
        unit.unitLabel,
        unit.overallStatus,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [deferredSearchQuery, units]);

  const explorer = useMemo(() => buildExplorer(filteredUnits), [filteredUnits]);
  const selectedBlock = useMemo(
    () =>
      explorer.find((block) => block.key === selectedBlockKey) ||
      explorer[0] ||
      null,
    [explorer, selectedBlockKey],
  );
  const selectedTower = useMemo(
    () =>
      selectedBlock?.towers.find((tower) => tower.key === selectedTowerKey) ||
      selectedBlock?.towers[0] ||
      null,
    [selectedBlock, selectedTowerKey],
  );
  const selectedFloor = useMemo(
    () =>
      selectedTower?.floors.find((floor) => floor.key === selectedFloorKey) ||
      selectedTower?.floors[0] ||
      null,
    [selectedFloorKey, selectedTower],
  );
  const workflowUnits = selectedFloor?.units || [];
  const workflowStepSummaries = useMemo(
    () =>
      workflowStepNumbers.map((roundNo) => {
        const statuses = units.map((unit) => getStepUnitStatus(unit, roundNo));
        return {
          roundNo,
          title:
            activeProcessSteps.find(
              (step) => step.workflowSerialNo === roundNo,
            )?.name || `${getSnagCycleLabel(roundNo)} / ${getDesnagCycleLabel(roundNo)}`,
          completed: statuses.filter(
            (status) => status === "completed" || status === "handover_ready",
          ).length,
          active: statuses.filter(
            (status) =>
              status === "ready_for_snag" ||
              status === "snagging" ||
              status === "desnagging",
          ).length,
          waiting: statuses.filter((status) => status === "released").length,
          locked: statuses.filter(
            (status) => status === "locked" || status === "unready",
          ).length,
        };
      }),
    [activeProcessSteps, units, workflowStepNumbers],
  );

  const selectedItems = useMemo(() => {
    const items = [...(currentRound?.items || [])].sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
    );
    const selected = items.filter((item) => selectedItemIds.includes(item.id));
    return { items, selected };
  }, [currentRound?.items, selectedItemIds]);

  const currentRoundSummary = useMemo(() => {
    const items = currentRound?.items || [];
    return {
      total: items.length,
      open: items.filter((item) => item.status === "open").length,
      rectified: items.filter((item) => item.status === "rectified").length,
      closed: items.filter((item) => item.status === "closed").length,
      onHold: items.filter((item) => item.status === "on_hold").length,
    };
  }, [currentRound?.items]);

  const activeLevelSummary = useMemo(() => {
    const items = (currentRound?.items || []).filter(
      (item) => (item.verifierLevelOrder || 1) === activeVerifierLevelOrder,
    );
    return {
      total: items.length,
      open: items.filter((item) => item.status === "open").length,
      rectified: items.filter((item) => item.status === "rectified").length,
      closed: items.filter((item) => item.status === "closed").length,
      onHold: items.filter((item) => item.status === "on_hold").length,
    };
  }, [activeVerifierLevelOrder, currentRound?.items]);

  const unresolvedForRelease =
    currentRoundSummary.open + currentRoundSummary.rectified;
  const canReopenBeforeFinalClosure = Boolean(
    currentRound &&
      !currentRound.isSkipped &&
      !currentRound.finalClosureSignedAt &&
      detail?.overallStatus !== "released" &&
      detail?.overallStatus !== "handover_ready" &&
      ["open", "approval_pending", "approved", "rejected"].includes(
        currentRound.desnagPhaseStatus,
      ),
  );
  const canCreateInSelectedCycle = Boolean(
    currentRound &&
      !currentRound.isSkipped &&
      !currentRound.finalClosureSignedAt &&
      detail?.currentRound === currentRound.roundNumber &&
      detail?.overallStatus !== "released" &&
      detail?.overallStatus !== "handover_ready" &&
      (currentRound.snagPhaseStatus === "open" || canReopenBeforeFinalClosure),
  );
  const canCheckerRaiseInSelectedCycle =
    canCreateInSelectedCycle && canRaiseSnagPoints;
  const canSkipSelectedCycle = Boolean(
    currentRound &&
      canApproveSnagRelease &&
      !currentRound.isSkipped &&
      currentRound.snagPhaseStatus === "open" &&
      currentRound.desnagPhaseStatus === "locked" &&
      currentRoundSummary.total === 0,
  );
  const canResetSelectedCycle = Boolean(currentRound && canDeleteSnag);
  const canFinalCloseSelectedCycle = Boolean(
    currentRound &&
    canApproveSnagRelease &&
    !currentRound.isSkipped &&
    !currentRound.finalClosureSignedAt &&
      currentRound.canCloseLevel &&
      activeLevelSummary.total > 0 &&
      activeLevelSummary.open === 0 &&
      activeLevelSummary.rectified === 0 &&
      activeLevelSummary.onHold === 0,
  );

  const workflowSteps = useMemo(() => {
    const roundsByNumber = new Map(
      (detail?.rounds || []).map((round) => [round.roundNumber, round]),
    );

    const roundSteps = Array.from({ length: maxSnagCycles }, (_, index) => {
      const roundNo = index + 1;
      const round = roundsByNumber.get(roundNo);
      let state: "pending" | "current" | "complete" | "skipped" = "pending";

      if (round?.isSkipped) {
        state = "skipped";
      } else if (
        round?.desnagPhaseStatus === "approved" ||
        (detail?.overallStatus === "handover_ready" &&
          roundNo <= (detail?.currentRound ?? 0)) ||
        (detail?.currentRound ?? 0) > roundNo
      ) {
        state = "complete";
      } else if (detail?.currentRound === roundNo) {
        state = "current";
      }

      return {
        key: `round-${roundNo}`,
        title: `${getSnagCycleLabel(roundNo)} / ${getDesnagCycleLabel(roundNo)}`,
        subtitle:
          state === "skipped"
            ? "Skipped"
            : state === "complete"
              ? "Completed"
              : state === "current"
                ? "Current cycle"
                : "Pending",
        state,
      };
    });

    roundSteps.push({
      key: "handover",
      title: "Ready for Customer Inspection",
      subtitle:
        detail?.overallStatus === "handover_ready"
          ? "Ready"
          : "Pending final release",
      state:
        detail?.overallStatus === "handover_ready"
          ? ("complete" as const)
          : ("pending" as const),
    });

    return roundSteps;
  }, [detail, maxSnagCycles]);

  const pendingQueue = useMemo(
    () =>
      [...units]
        .filter(
          (unit) =>
            unit.snagListId &&
            unit.overallStatus !== "handover_ready" &&
            unit.overallStatus !== "unready",
        )
        .sort((a, b) => naturalSort(a.unitLabel, b.unitLabel))
        .slice(0, 12),
    [units],
  );

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return [];
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/files/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      urls.push(res.data?.url || res.data?.fileUrl || res.data?.path);
    }
    return urls;
  };

  const openUnit = async (
    unit: SnagUnitSummary,
    preferredRound = selectedWorkflowRound,
  ) => {
    if (!pId) return;
    setLoadingDetail(true);
    setDetail(null);
    setSkipDialog(null);
    setSkipReason("");
    setResetRoundDialog(null);
    setResetRoundReason("");
    setDeleteItemDialog(null);
    setFinalClosureDialog(null);
    setFinalClosureRemarks("");
    setSelectedUnit(unit);
    setUnitModalOpen(true);
    try {
      if (unit.snagListId) {
        await loadDetail(unit.snagListId, preferredRound);
      } else {
        setDetail(null);
        setRoundNumber(preferredRound);
      }
    } catch (error) {
      console.error(error);
      setUnitModalOpen(false);
      setSkipDialog(null);
      setResetRoundDialog(null);
      setDeleteItemDialog(null);
      setFinalClosureDialog(null);
      alert(
        getErrorMessage(
          error,
          "Unable to open the snag workspace for this unit right now.",
        ),
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshCurrentDetail = async () => {
    if (!detail?.id) return;
    setLoadingDetail(true);
    try {
      await loadDetail(detail.id);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(
        getErrorMessage(
          error,
          "Unable to refresh the snag workspace right now.",
        ),
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const updateSnagForm = (patch: Partial<SnagFormState>) => {
    setSnagForm((current) => ({ ...current, ...patch }));
  };

  const markUnitReady = async () => {
    if (!selectedUnit || !pId) return;
    setLoadingDetail(true);
    try {
      const data =
        detail?.id && detail.overallStatus === "released"
          ? await snagService.markCurrentRoundReady(pId, detail.id)
          : await snagService.createOrGetList(pId, {
              qualityUnitId: selectedUnit.qualityUnitId,
            });
      setDetail(data);
      setRoundNumber(data.currentRound || 1);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(
        getErrorMessage(
          error,
          "Unable to mark this unit ready for snagging right now.",
        ),
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const resetReady = async () => {
    if (!detail?.id || !selectedUnit) return;
    setBusy(true);
    try {
      await snagService.resetReady(pId, detail.id);
      setDetail(null);
      setUnitModalOpen(false);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Unable to reset this unit to unready."));
    } finally {
      setBusy(false);
    }
  };

  const openRaiseSnagDialog = (prefill?: Partial<SnagFormState>) => {
    setSnagForm({ ...DEFAULT_SNAG_FORM, ...prefill });
    setRaiseSnagDialogOpen(true);
  };

  const createItem = async () => {
    if (!detail?.id || !currentRound) return;
    if (!snagForm.defectTitle.trim()) {
      alert("Defect title is required");
      return;
    }

    setBusy(true);
    try {
      const beforePhotoUrls = await uploadFiles(snagForm.beforeFiles);
      if (raisePhotoRequired && !beforePhotoUrls.length) {
        alert("Before photos are required for this snag process step");
        return;
      }

      const data = await snagService.addItem(pId, detail.id, currentRound.roundNumber, {
        qualityRoomId:
          snagForm.qualityRoomId === "" ? undefined : Number(snagForm.qualityRoomId),
        defectTitle: snagForm.defectTitle.trim(),
        defectDescription: snagForm.defectDescription.trim() || undefined,
        trade: snagForm.trade.trim() || undefined,
        priority: snagForm.priority,
        beforePhotoUrls,
        linkedChecklistItemId: snagForm.linkedChecklistItemId || undefined,
      });
      setDetail(data);
      setSnagForm(DEFAULT_SNAG_FORM);
      setRaiseSnagDialogOpen(false);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to add snag item");
    } finally {
      setBusy(false);
    }
  };

  const setChecklistField = (
    checklistItemId: string,
    patch: Partial<SnagChecklistItem>,
  ) => {
    setChecklistDraft((current) =>
      current.map((item) =>
        item.id === checklistItemId ? { ...item, ...patch } : item,
      ),
    );
    setChecklistDirty(true);
  };

  const addChecklistRow = () => {
    setChecklistDraft((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "",
        qualityRoomId: null,
        roomLabel: null,
        trade: null,
        sequence: current.length,
        status: "NA",
        remarks: null,
        linkedSnagItemId: null,
        updatedAt: null,
        updatedById: null,
      },
    ]);
    setChecklistDirty(true);
  };

  const removeChecklistRow = (checklistItemId: string) => {
    setChecklistDraft((current) =>
      current.filter((item) => item.id !== checklistItemId),
    );
    setChecklistDirty(true);
  };

  const prefillSnagFromChecklist = (item: SnagChecklistItem) => {
    openRaiseSnagDialog({
      qualityRoomId: item.qualityRoomId ?? "",
      defectTitle: item.title,
      trade: item.trade || "",
      linkedChecklistItemId: item.id,
    });
  };

  const toggleItemSelection = (itemId: number) => {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  };

  const openEvidenceDialog = (
    mode: EvidenceMode,
    itemIds: number[],
    title: string,
  ) => {
    setEvidenceDialog({ mode, itemIds, title });
    setEvidenceFiles(null);
    setEvidenceNotes("");
  };

  const submitEvidence = async () => {
    if (!detail?.id || !currentRound || !evidenceDialog) return;
    if (
      evidenceDialog.mode === "RECTIFY" &&
      rectificationPhotoRequired &&
      !evidenceFiles?.length
    ) {
      alert("Rectification photos are required for this snag process step");
      return;
    }
    if (
      evidenceDialog.mode === "CLOSE" &&
      desnagCompletionPhotoRequired &&
      !evidenceFiles?.length
    ) {
      alert("De-snag completion photos are required for this snag process step");
      return;
    }

    setBusy(true);
    try {
      const photoUrls = evidenceFiles?.length
        ? await uploadFiles(evidenceFiles)
        : [];
      const data =
        evidenceDialog.mode === "RECTIFY"
          ? await snagService.bulkRectifyItems(
              pId,
              detail.id,
              currentRound.roundNumber,
              {
                itemIds: evidenceDialog.itemIds,
                afterPhotoUrls: photoUrls,
                rectificationNotes: evidenceNotes.trim() || undefined,
              },
            )
          : await snagService.bulkCloseItems(
              pId,
              detail.id,
              currentRound.roundNumber,
              {
                itemIds: evidenceDialog.itemIds,
                closurePhotoUrls: photoUrls,
                remarks: evidenceNotes.trim() || undefined,
              },
            );

      setDetail(data);
      setEvidenceDialog(null);
      setSelectedItemIds([]);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to update selected snags");
    } finally {
      setBusy(false);
    }
  };

  const holdItem = async (item: SnagItemDetail) => {
    const reason = prompt("Enter hold reason");
    if (!reason) return;
    setBusy(true);
    try {
      const data = await snagService.holdItem(pId, item.id, reason);
      setDetail(data);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to put snag on hold");
    } finally {
      setBusy(false);
    }
  };

  const rejectRectification = async (item: SnagItemDetail) => {
    const remarks = prompt("Enter not satisfactory remarks");
    if (!remarks) return;
    setBusy(true);
    try {
      const data = await snagService.rejectRectification(pId, item.id, {
        remarks,
      });
      setDetail(data);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to mark rectification as not satisfactory"));
    } finally {
      setBusy(false);
    }
  };

  const submitSnagPhase = async () => {
    if (!currentRound) return;
    setBusy(true);
    try {
      const data = await snagService.submitSnagPhase(pId, currentRound.id);
      setDetail(data);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to submit snag phase");
    } finally {
      setBusy(false);
    }
  };

  const submitRelease = async () => {
    if (!currentRound) return;
    setBusy(true);
    try {
      const data = await snagService.submitRelease(pId, currentRound.id);
      setDetail(data);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to submit release approval");
    } finally {
      setBusy(false);
    }
  };

  const openSkipDialog = () => {
    if (!currentRound) return;
    setSkipReason("");
    setSkipDialog({
      roundId: currentRound.id,
      currentLabel: getSnagCycleLabel(currentRound.roundNumber),
      currentDesnagLabel: getDesnagCycleLabel(currentRound.roundNumber),
      nextLabel: getNextSnagCycleLabel(currentRound.roundNumber, maxSnagCycles),
    });
  };

  const openResetRoundDialog = () => {
    if (!currentRound || !detail) return;
    setResetRoundReason("");
    setResetRoundDialog({
      roundId: currentRound.id,
      currentLabel: getSnagCycleLabel(currentRound.roundNumber),
      currentDesnagLabel: getDesnagCycleLabel(currentRound.roundNumber),
      laterCycleCount: detail.rounds.filter(
        (round) => round.roundNumber > currentRound.roundNumber,
      ).length,
      rollsBackHandover: detail.overallStatus === "handover_ready",
    });
  };

  const submitSkipRound = async () => {
    if (!skipDialog) return;
    setBusy(true);
    try {
      const data = await snagService.skipRound(pId, skipDialog.roundId, {
        reason: skipReason.trim() || undefined,
      });
      setDetail(data);
      setRoundNumber(data.currentRound || 1);
      setSkipDialog(null);
      setSkipReason("");
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to skip the selected snag cycle"));
    } finally {
      setBusy(false);
    }
  };

  const submitResetRound = async () => {
    if (!resetRoundDialog) return;
    if (!resetRoundReason.trim()) {
      alert("Reset reason is required");
      return;
    }

    setBusy(true);
    try {
      const data = await snagService.resetRound(pId, resetRoundDialog.roundId, {
        reason: resetRoundReason.trim(),
      });
      setDetail(data);
      setRoundNumber(data.currentRound || 1);
      setResetRoundDialog(null);
      setResetRoundReason("");
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to reset the selected snag cycle"));
    } finally {
      setBusy(false);
    }
  };

  const canDeleteItem = (_item: SnagItemDetail) => {
    return canDeleteSnag;
  };

  const confirmDeleteItem = (item: SnagItemDetail) => {
    setDeleteItemDialog({
      itemId: item.id,
      defectTitle: item.defectTitle,
    });
  };

  const submitDeleteItem = async () => {
    if (!deleteItemDialog) return;

    setBusy(true);
    try {
      const data = await snagService.deleteItem(pId, deleteItemDialog.itemId);
      setDetail(data);
      setSelectedItemIds((current) =>
        current.filter((id) => id !== deleteItemDialog.itemId),
      );
      setDeleteItemDialog(null);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to delete the selected snag item"));
    } finally {
      setBusy(false);
    }
  };

  const downloadStatusReport = async () => {
    if (!detail?.id || !currentRound) return;
    setBusy(true);
    try {
      const blob = await snagService.downloadStatusReport(
        pId,
        detail.id,
        currentRound.roundNumber,
      );
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${detail.unitLabel || "unit"}-snag-${currentRound.roundNumber}-status.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to download snag status PDF"));
    } finally {
      setBusy(false);
    }
  };

  const openFinalClosureDialog = () => {
    if (!currentRound) return;
    setFinalClosureRemarks("");
    setFinalClosureDialog({
      roundId: currentRound.id,
      roundNumber: currentRound.roundNumber,
      label: getSnagCycleLabel(currentRound.roundNumber),
      levelOrder: activeVerifierLevelOrder,
      levelName: activeVerifierLevelName,
      isFinalStageLevel: Boolean(currentRound.canFinalCloseStage && isFinalVerifierLevel),
    });
  };

  const submitFinalClosure = async () => {
    if (!finalClosureDialog) return;
    setBusy(true);
    try {
      const body = { remarks: finalClosureRemarks.trim() || undefined };
      const data = await snagService.closeVerifierLevel(
        pId,
        finalClosureDialog.roundId,
        finalClosureDialog.levelOrder,
        body,
      );
      setDetail(data);
      setRoundNumber(data.currentRound || finalClosureDialog.roundNumber);
      setFinalClosureDialog(null);
      setFinalClosureRemarks("");
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to sign final closure"));
    } finally {
      setBusy(false);
    }
  };

  const canBulkRectify =
    Boolean(currentRound?.canRectify) &&
    selectedItems.selected.length > 0 &&
    selectedItems.selected.every((item) => item.status === "open");
  const canBulkClose =
    canApproveSnagRelease &&
    Boolean(currentRound?.canConfirmDesnag) &&
    selectedItems.selected.length > 0 &&
    selectedItems.selected.every(
      (item) =>
        item.status === "rectified" &&
        (item.verifierLevelOrder || 1) === activeVerifierLevelOrder,
    );
  const hasSearchTerm = deferredSearchQuery.trim().length > 0;

  if (!canReadSnag) {
    return (
      <div className="rounded-2xl border border-warning/25 bg-warning-muted/40 px-6 py-8">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 text-warning" />
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Snag access is restricted
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              You need `QUALITY.SNAG.READ` permission to view snag dashboards,
              unit workflows, reports, and analysis for this project.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-card px-5 py-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            Snag / De-snag
          </h2>
          <p className="text-sm text-text-muted">
            Analyse project snag health separately from unit-level execution.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border-default bg-surface-base p-1">
          {[
            ["dashboard", "Analysis"],
            ["workflow", "Unit Workflow"],
            ["final", "Customer Inspection Ready"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveView(key as SnagView)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                activeView === key
                  ? "bg-primary text-on-primary"
                  : "text-text-secondary hover:bg-surface-card"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeView === "dashboard" && (
        <SnagAnalysisDashboard
          analytics={analytics}
          loading={loadingAnalytics}
          error={analyticsError}
          onRefresh={() => void loadAnalytics()}
        />
      )}

      {activeView === "workflow" && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-border-default bg-surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text-primary">
                  Snag / De-snag Process Steps
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  Select the configured workflow step first, then manage unit
                  status, snag points, de-snag review, and final closure for
                  that step.
                </p>
              </div>
              <span className="rounded-full border border-border-default bg-surface-base px-3 py-1.5 text-xs font-semibold text-text-muted">
                {workflowStepSummaries.length} configured steps
              </span>
            </div>
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {workflowStepSummaries.map((step) => {
                const selected = step.roundNo === selectedWorkflowRound;
                return (
                  <button
                    key={step.roundNo}
                    onClick={() => setSelectedWorkflowRound(step.roundNo)}
                    className={`min-h-[128px] rounded-2xl border p-4 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary-muted/40"
                        : "border-border-default bg-surface-base hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text-primary">
                          {step.title}
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          Workflow serial {step.roundNo}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                          selected
                            ? "border-primary/20 bg-primary text-on-primary"
                            : "border-border-default bg-surface-card text-text-muted"
                        }`}
                      >
                        {selected ? "Selected" : "Open"}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <UnitCardMetric label="Active" value={step.active} />
                      <UnitCardMetric label="Waiting" value={step.waiting} />
                      <UnitCardMetric label="Done" value={step.completed} />
                      <UnitCardMetric label="Locked" value={step.locked} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-border-default bg-surface-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-text-primary">Location Filter</h3>
                  <p className="mt-0.5 text-xs text-text-muted">Block, tower, floor</p>
                </div>
                <button
                  onClick={() => void loadUnits()}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <label className="relative mt-4 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search flat or location"
                  className="h-11 w-full rounded-xl border border-border-default bg-surface-base pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-disabled focus:border-primary"
                />
              </label>

              <div className="mt-5 space-y-5">
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Blocks</div>
                  <div className="space-y-2">
                    {explorer.map((block) => (
                      <button
                        key={block.key}
                        onClick={() => {
                          setSelectedBlockKey(block.key);
                          setSelectedTowerKey(null);
                          setSelectedFloorKey(null);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                          selectedBlock?.key === block.key
                            ? "border-primary bg-primary-muted/40 text-primary"
                            : "border-border-default bg-surface-base text-text-secondary hover:border-primary/50"
                        }`}
                      >
                        <span className="truncate font-medium">{block.label}</span>
                        <span className="text-xs">{block.towers.length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Towers</div>
                  <div className="space-y-2">
                    {(selectedBlock?.towers || []).map((tower) => (
                      <button
                        key={tower.key}
                        onClick={() => {
                          setSelectedTowerKey(tower.key);
                          setSelectedFloorKey(null);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                          selectedTower?.key === tower.key
                            ? "border-info bg-info-muted/40 text-info"
                            : "border-border-default bg-surface-base text-text-secondary hover:border-info/50"
                        }`}
                      >
                        <span className="truncate font-medium">{tower.label}</span>
                        <span className="text-xs">{tower.floors.length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Floors</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(selectedTower?.floors || []).map((floor) => (
                      <button
                        key={floor.key}
                        onClick={() => setSelectedFloorKey(floor.key)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                          selectedFloor?.key === floor.key
                            ? "border-success bg-success-muted/40 text-success"
                            : "border-border-default bg-surface-base text-text-secondary hover:border-success/50"
                        }`}
                      >
                        {floor.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </aside>

          <section className="min-w-0 rounded-2xl border border-border-default bg-surface-card">
            <div className="grid gap-3 border-b border-border-subtle px-5 py-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text-primary">
                  {getSnagCycleLabel(selectedWorkflowRound)} /{" "}
                  {getDesnagCycleLabel(selectedWorkflowRound)} Board
                </h2>
                <p className="mt-0.5 truncate text-sm text-text-muted">
                  {selectedBlock?.label || "Block"} / {selectedTower?.label || "Tower"} / {selectedFloor?.label || "Floor"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3 2xl:grid-cols-5">
                {[
                  ["Locked", "border-border-default bg-surface-base text-text-muted"],
                  ["Ready", "border-primary/20 bg-primary-muted text-primary"],
                  ["Snagging", "border-error/20 bg-error-muted text-error"],
                  ["De-snag", "border-info/20 bg-info-muted text-info"],
                  ["Completed", "border-success/20 bg-success-muted text-success"],
                ].map(([label, className]) => (
                  <span key={label} className={`inline-flex min-h-8 items-center justify-center rounded-full border px-2.5 text-center font-semibold leading-tight ${className}`}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-5">
              {loadingUnits ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-default px-6 py-16 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading units...
                </div>
              ) : unitsError && units.length === 0 ? (
                <div className="rounded-2xl border border-error/25 bg-error-muted/50 px-6 py-8 text-sm text-error">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Unit workflow could not load.
                  </div>
                  <p className="mt-3 leading-6">{unitsError}</p>
                </div>
              ) : workflowUnits.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-default px-6 py-16 text-center text-sm text-text-muted">
                  {hasSearchTerm ? "No units match the current search." : "No units are configured for this floor."}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
                  {workflowUnits.map((unit) => {
                    const stepStatus = getStepUnitStatus(
                      unit,
                      selectedWorkflowRound,
                    );
                    const canOpenStep =
                      unit.snagListId ||
                      (selectedWorkflowRound === 1 && stepStatus === "unready");
                    return (
                      <button
                        key={unit.qualityUnitId}
                        onClick={() => void openUnit(unit, selectedWorkflowRound)}
                        disabled={!canOpenStep}
                        className={`group min-h-[178px] rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${getStepUnitCardClass(stepStatus)}`}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-lg font-semibold text-text-primary">{unit.unitLabel}</div>
                            <div className="mt-1 truncate text-xs text-text-muted">
                              {getSnagCycleLabel(selectedWorkflowRound)} | {unit.roomCount} rooms
                            </div>
                          </div>
                          <span className={`max-w-[8.5rem] rounded-full border px-2.5 py-1 text-center text-[10px] font-semibold leading-tight ${statusBadgeClass(stepStatus)}`}>
                            {getCompactStepUnitStatusLabel(
                              stepStatus,
                              selectedWorkflowRound,
                            )}
                          </span>
                        </div>
                        <div className="mt-3 min-h-[2.5rem] text-sm font-medium leading-5 text-text-primary">
                          {getStepUnitStatusLabel(
                            stepStatus,
                            selectedWorkflowRound,
                          )}
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                          <UnitCardMetric label="Points" value={unit.commonChecklistCount} />
                          <UnitCardMetric label="Step" value={selectedWorkflowRound} />
                          <UnitCardMetric
                            label="Action"
                            value={
                              stepStatus === "released"
                                ? "Ready"
                                : canOpenStep
                                  ? "Open"
                                  : "Locked"
                            }
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <SectionCard title="Live Queue" icon={<AlertTriangle className="h-4 w-4" />}>
              <div className="space-y-2">
                {pendingQueue.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-default px-3 py-6 text-center text-sm text-text-muted">
                    No active snag units.
                  </div>
                ) : (
                  pendingQueue.map((unit) => (
                    <button
                      key={unit.qualityUnitId}
                      onClick={() => void openUnit(unit)}
                      className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-3 text-left hover:border-primary"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-text-primary">{unit.unitLabel}</div>
                          <div className="truncate text-xs text-text-muted">{unit.towerLabel} / {unit.floorLabel}</div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-tight ${statusBadgeClass(unit.overallStatus)}`}>
                          {getSnagCycleLabel(unit.currentRound)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </SectionCard>
          </aside>
        </div>
        </div>
      )}

      {activeView === "final" && (
        <section className="rounded-2xl border border-border-default bg-surface-card">
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Customer Inspection Ready Units
              </h2>
              <p className="text-sm text-text-muted">
                Units where all configured snag and de-snag cycles are finally
                closed by checker signoff.
              </p>
            </div>
            <button
              onClick={() => void loadUnits()}
              className="inline-flex items-center gap-2 rounded-xl border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-base"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {units.filter((unit) => unit.overallStatus === "handover_ready")
              .length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-border-default px-6 py-12 text-center text-sm text-text-muted">
                No units have reached customer inspection readiness yet.
              </div>
            ) : (
              units
                .filter((unit) => unit.overallStatus === "handover_ready")
                .map((unit) => (
                  <button
                    key={unit.qualityUnitId}
                    onClick={() => void openUnit(unit)}
                    className="rounded-2xl border border-success/20 bg-success-muted/30 p-4 text-left hover:border-success"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-text-primary">
                          {unit.unitLabel}
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          {unit.towerLabel} / {unit.floorLabel}
                        </div>
                      </div>
                      <ShieldCheck className="h-5 w-5 text-success" />
                    </div>
                    <div className="mt-4 text-xs font-semibold leading-5 text-success">
                      Ready for Customer Inspection
                    </div>
                  </button>
                ))
            )}
          </div>
        </section>
      )}

      {unitModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="flex h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[28px] border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-primary-muted p-3 text-primary">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-text-primary">
                        {selectedUnit?.unitLabel || detail?.unitLabel || "Unit"}
                      </h2>
                      <p className="text-sm text-text-muted">
                        {selectedUnit?.blockLabel || "Project"} /{" "}
                        {selectedUnit?.towerLabel} / {selectedUnit?.floorLabel}
                      </p>
                    </div>
                  </div>
                  {detail && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(detail.overallStatus)}`}
                      >
                        {getWorkflowStatusLabel(
                          detail.overallStatus,
                          detail.currentRound,
                        )}
                      </span>
                      <span className="rounded-full border border-border-default bg-surface-base px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                        Current {getSnagCycleLabel(detail.currentRound)} /{" "}
                        {getDesnagCycleLabel(detail.currentRound)}
                      </span>
                      {detail.overallStatus === "handover_ready" && (
                        <span className="rounded-full border border-success/20 bg-success-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-success">
                          After Release to Customer Inspection
                        </span>
                      )}
                      {savingChecklist && (
                        <span className="rounded-full border border-border-default bg-surface-base px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                          Saving checklist...
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void refreshCurrentDetail()}
                    className="inline-flex items-center gap-2 rounded-xl border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-base"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                  <button
                    onClick={() => {
                      setUnitModalOpen(false);
                      setSkipDialog(null);
                      setResetRoundDialog(null);
                      setResetRoundReason("");
                      setDeleteItemDialog(null);
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {loadingDetail ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading snag workspace...
                </div>
              ) : !detail ? (
                <div className="flex flex-1 items-center justify-center p-6">
                  <div className="w-full max-w-xl rounded-3xl border border-border-default bg-surface-base px-6 py-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-muted text-primary">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-text-primary">
                      Mark Unit Ready for Snagging
                    </h3>
                    <p className="mt-2 text-sm text-text-muted">
                      {selectedUnit?.unitLabel} is not yet started for snagging.
                    </p>
                    <button
                      onClick={() => void markUnitReady()}
                      disabled={busy}
                      className="mt-5 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary disabled:opacity-60"
                    >
                      Mark Ready and Start Snag 1
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-b border-border-subtle px-6 py-3">
                    <div className="flex flex-wrap gap-2">
                      {detail.rounds.map((round) => (
                        <button
                          key={round.id}
                          onClick={() => setRoundNumber(round.roundNumber)}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                            round.roundNumber === roundNumber
                              ? "bg-primary text-on-primary"
                              : "border border-border-default bg-surface-base text-text-secondary"
                          }`}
                        >
                          {getSnagCycleLabel(round.roundNumber)}
                          {round.isSkipped ? " (Skipped)" : ""}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-4">
                      {workflowSteps.map((step) => (
                        <div
                          key={step.key}
                          className={`rounded-2xl border px-4 py-3 ${
                            step.state === "complete"
                              ? "border-success/20 bg-success-muted/60"
                              : step.state === "current"
                                ? "border-primary/30 bg-primary-muted/40"
                                : step.state === "skipped"
                                  ? "border-secondary/20 bg-secondary-muted/40"
                                  : "border-border-default bg-surface-base"
                          }`}
                        >
                          <div className="text-sm font-semibold text-text-primary">
                            {step.title}
                          </div>
                          <div className="mt-1 text-xs text-text-muted">
                            {step.subtitle}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid flex-1 gap-5 overflow-hidden p-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="space-y-4 overflow-y-auto pr-1">
                      <SectionCard
                        title={`${currentCycleLabel} Status`}
                        icon={<ShieldCheck className="h-4 w-4" />}
                      >
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-text-muted">
                              {currentCycleLabel}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(
                                formatPhaseStatus(
                                  currentRound?.snagPhaseStatus || "open",
                                  currentRound?.isSkipped,
                                ),
                              )}`}
                            >
                              {formatPhaseStatus(
                                currentRound?.snagPhaseStatus || "open",
                                currentRound?.isSkipped,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-text-muted">
                              {currentDesnagLabel}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(
                                formatPhaseStatus(
                                  currentRound?.desnagPhaseStatus || "locked",
                                  currentRound?.isSkipped,
                                ),
                              )}`}
                            >
                              {formatPhaseStatus(
                                currentRound?.desnagPhaseStatus || "locked",
                                currentRound?.isSkipped,
                              )}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border-default bg-surface-base/70 p-3 text-xs text-text-muted">
                            <div>
                              <div className="font-semibold text-text-primary">
                                {currentRoundSummary.open}
                              </div>
                              <div>Open</div>
                            </div>
                            <div>
                              <div className="font-semibold text-text-primary">
                                {currentRoundSummary.rectified}
                              </div>
                              <div>Rectified</div>
                            </div>
                            <div>
                              <div className="font-semibold text-text-primary">
                                {currentRoundSummary.closed}
                              </div>
                              <div>Closed</div>
                            </div>
                            <div>
                              <div className="font-semibold text-text-primary">
                                {currentRoundSummary.onHold}
                              </div>
                              <div>On Hold</div>
                            </div>
                          </div>
                          {verifierLevels.length > 0 && (
                            <div className="space-y-2 rounded-2xl border border-border-default bg-surface-base/70 p-3">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold uppercase tracking-[0.16em] text-text-muted">
                                  Active verifier level
                                </span>
                                <span className="rounded-full border border-primary/25 bg-primary-muted px-2 py-1 font-semibold text-primary">
                                  L{activeVerifierLevelOrder} {activeVerifierLevelName}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {verifierLevels.map((level) => (
                                  <div
                                    key={level.levelOrder}
                                    className={`rounded-xl border px-3 py-2 ${
                                      level.isActive
                                        ? "border-primary/30 bg-primary-muted/40"
                                        : level.closure
                                          ? "border-success/20 bg-success-muted/40"
                                          : "border-border-default bg-surface-card"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="min-w-0 text-sm font-semibold text-text-primary">
                                        Level {level.levelOrder}: {level.levelName}
                                      </div>
                                      <span className="rounded-full border border-border-default bg-surface-base px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                        {level.closure ? "Closed" : level.isActive ? "Active" : "Waiting"}
                                      </span>
                                    </div>
                                    <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[10px] text-text-muted">
                                      <span>{level.counts.raised} raised</span>
                                      <span>{level.counts.open} open</span>
                                      <span>{level.counts.rectifiedPendingDesnag} rectified</span>
                                      <span>{level.counts.desnagConfirmed} closed</span>
                                      <span>{level.counts.notSatisfactory} reject</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="rounded-2xl border border-border-default bg-surface-base/70 p-3 text-xs leading-6 text-text-muted">
                            {detail.overallStatus === "handover_ready" ? (
                              <>
                                All {maxSnagCycles} snag and de-snag cycles are complete.
                                This unit is now after final release to handover.
                              </>
                            ) : currentRound?.isSkipped ? (
                              <>
                                {currentCycleLabel} was skipped by an authorized
                                user and released directly to{" "}
                                {getNextSnagCycleLabel(
                                  currentRound.roundNumber,
                                  maxSnagCycles,
                                )}.
                                {currentRound.skipReason
                                  ? ` Reason: ${currentRound.skipReason}`
                                  : ""}
                              </>
                            ) : (
                              <>
                                Maker rectifies each point, then Checker marks
                                de-snag completed or not satisfactory. New snag
                                points can still be added until final closure is
                                signed.
                              </>
                            )}
                          </div>
                          <div className="grid gap-2 pt-2">
                            {detail.overallStatus === "released" && (
                              <button
                                onClick={() => void markUnitReady()}
                                disabled={busy}
                                className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Mark Ready and Start {nextCycleReadyLabel}
                              </button>
                            )}
                            {detail.overallStatus === "released" && (
                              <div className="rounded-xl border border-primary/20 bg-primary-muted/40 px-3 py-2 text-xs leading-6 text-primary">
                                {currentCycleLabel} final closure is complete.
                                The next snag level will open only after Maker
                                marks this unit ready.
                              </div>
                            )}
                            {detail.overallStatus === "ready_for_snag" &&
                              canRaiseSnagPoints && (
                                <button
                                  onClick={() => void resetReady()}
                                  disabled={busy}
                                  className="rounded-xl border border-warning/20 px-3 py-2 text-sm text-warning hover:bg-warning-muted disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Reset Unit as Unready
                                </button>
                              )}
                            <button
                              onClick={() => void submitSnagPhase()}
                              disabled={
                                busy ||
                                currentRound?.snagPhaseStatus !== "open" ||
                                currentRound?.isSkipped
                              }
                              className="rounded-xl border border-border-default px-3 py-2 text-sm text-text-primary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {getSubmitSnagActionLabel(
                                currentRound?.roundNumber || 1,
                              )}
                            </button>
                            <button
                              onClick={() => void submitRelease()}
                              disabled={
                                busy ||
                                currentRound?.desnagPhaseStatus !== "open" ||
                                currentRound?.isSkipped ||
                                unresolvedForRelease > 0
                              }
                              className="rounded-xl border border-border-default px-3 py-2 text-sm text-text-primary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {getReleaseActionLabel(
                                currentRound?.roundNumber || 1,
                                maxSnagCycles,
                              )}
                            </button>
                            <button
                              onClick={openFinalClosureDialog}
                              disabled={!canFinalCloseSelectedCycle || busy}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-success/20 px-3 py-2 text-sm font-semibold text-success hover:bg-success-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <PenLine className="h-4 w-4" />
                              {isFinalVerifierLevel
                                ? `Final Closure of ${currentCycleLabel}`
                                : `Close Level ${activeVerifierLevelOrder}`}
                            </button>
                            <button
                              onClick={() => void downloadStatusReport()}
                              disabled={busy || !detail?.id || !currentRound}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-default px-3 py-2 text-sm text-text-primary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <FileText className="h-4 w-4" />
                              Download Snag Status PDF
                            </button>
                            {currentRound?.finalClosureSignedAt && (
                              <div className="rounded-xl border border-success/20 bg-success-muted/40 px-3 py-2 text-xs text-success">
                                {currentCycleLabel} final closure signed on{" "}
                                {currentRound.finalClosureSignedAt.slice(0, 10)}.
                              </div>
                            )}
                            {canApproveSnagRelease && (
                              <button
                                onClick={openSkipDialog}
                                disabled={!canSkipSelectedCycle || busy}
                                className="rounded-xl border border-border-default px-3 py-2 text-sm text-text-primary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Skip {currentCycleLabel} and {currentDesnagLabel}
                              </button>
                            )}
                            <button
                              onClick={openResetRoundDialog}
                              disabled={!canResetSelectedCycle || busy}
                              className="rounded-xl border border-error/20 px-3 py-2 text-sm text-error hover:bg-error-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {canDeleteSnag
                                ? `Delete ${currentCycleLabel} and ${currentDesnagLabel}`
                                : `Delete ${currentCycleLabel} and ${currentDesnagLabel} (Admin only)`}
                            </button>
                            {!canDeleteSnag && (
                              <div className="rounded-xl border border-border-default bg-surface-base/70 px-3 py-2 text-xs text-text-muted">
                                Cycle reset is available only to users with
                                snag delete permission.
                              </div>
                            )}
                            {canApproveSnagRelease &&
                              !canSkipSelectedCycle &&
                              currentRound &&
                              !currentRound.isSkipped &&
                              currentRound.snagPhaseStatus === "open" &&
                              currentRound.desnagPhaseStatus === "locked" &&
                              currentRoundSummary.total > 0 && (
                                <div className="rounded-xl border border-warning/20 bg-warning-muted/40 px-3 py-2 text-xs text-warning">
                                  Skip is available only before any snag is raised
                                  in this cycle.
                                </div>
                              )}
                          </div>
                        </div>
                      </SectionCard>

                      <SectionCard
                        title={`Raise ${currentCycleLabel}`}
                        icon={<Hammer className="h-4 w-4" />}
                      >
                        <div className="space-y-3 text-sm">
                          {!canCreateInSelectedCycle && (
                            <div className="rounded-xl border border-border-default bg-surface-base/70 px-3 py-3 text-xs leading-6 text-text-muted">
                              {detail.overallStatus === "released"
                                ? `${currentCycleLabel} is finally closed. Maker must start ${nextCycleReadyLabel} before fresh points can be raised.`
                                : `${currentCycleLabel} is not open for new defects. Switch to the current snag cycle if you want to raise fresh snag items.`}
                            </div>
                          )}
                          {canCreateInSelectedCycle && !canRaiseSnagPoints && (
                            <div className="rounded-xl border border-warning/20 bg-warning-muted/40 px-3 py-3 text-xs leading-6 text-warning">
                              Snag points can be raised only by the active
                              checker for Level {activeVerifierLevelOrder}.
                            </div>
                          )}
                          <button
                            onClick={() => openRaiseSnagDialog()}
                            disabled={busy || !canCheckerRaiseInSelectedCycle}
                            className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Raise Snag Point
                          </button>
                          <div className="rounded-xl border border-border-default bg-surface-base/70 px-3 py-3 text-xs leading-6 text-text-muted">
                            Select room, then the configured activity and common
                            snag point in the popup. Use Others when the defect
                            is not part of the configured point list.
                          </div>
                        </div>
                      </SectionCard>

                      {activeApproval && (
                        <SectionCard
                          title={getReleaseWorkflowTitle(
                            currentRound?.roundNumber || 1,
                            maxSnagCycles,
                          )}
                          icon={<ShieldCheck className="h-4 w-4" />}
                        >
                          <div className="space-y-2">
                            {activeApproval.steps.map((step) => (
                              <div
                                key={step.id}
                                className="rounded-xl border border-border-default bg-surface-base px-3 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-medium text-text-primary">
                                      {step.stepName}
                                    </div>
                                    <div className="text-xs text-text-muted">
                                      {step.status}
                                    </div>
                                  </div>
                                  {step.status === "pending" && (
                                    <span className="rounded-full border border-primary/25 bg-primary-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                                      Active
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}
                    </div>

                    <div className="space-y-4 overflow-y-auto pr-1">
                      <SectionCard
                        title="Configured Snag Points"
                        icon={<ListChecks className="h-4 w-4" />}
                        actions={
                          <button
                            onClick={addChecklistRow}
                            className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-base"
                          >
                            Add Point
                          </button>
                        }
                      >
                        <div className="space-y-3">
                          {checklistDraft.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-text-muted">
                              No configured snag points are available for this
                              unit. Add activities and common points in Snag /
                              Desnag Process configuration.
                            </div>
                          ) : (
                            checklistDraft.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-border-default bg-surface-base/60 p-4"
                              >
                                <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_140px_auto]">
                                  <select
                                    value={item.qualityRoomId ?? ""}
                                    onChange={(event) => {
                                      const roomId = event.target.value
                                        ? Number(event.target.value)
                                        : null;
                                      const room = detail.unit?.rooms?.find(
                                        (entry) => entry.id === roomId,
                                      );
                                      setChecklistField(item.id, {
                                        qualityRoomId: roomId,
                                        roomLabel: room?.name || null,
                                      });
                                    }}
                                    className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm outline-none focus:border-primary"
                                  >
                                    <option value="">Room / area</option>
                                    {(detail.unit?.rooms || []).map((room) => (
                                      <option key={room.id} value={room.id}>
                                        {room.name}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={item.title}
                                    onChange={(event) =>
                                      setChecklistField(item.id, {
                                        title: event.target.value,
                                      })
                                    }
                                    placeholder="Common snag point"
                                    className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm outline-none focus:border-primary"
                                  />
                                  <input
                                    value={item.trade || ""}
                                    onChange={(event) =>
                                      setChecklistField(item.id, {
                                        trade: event.target.value || null,
                                      })
                                    }
                                    placeholder="Trade"
                                    className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm outline-none focus:border-primary"
                                  />
                                  <button
                                    onClick={() => removeChecklistRow(item.id)}
                                    className="rounded-xl border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-card"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  {CHECKLIST_STATUSES.map((status) => (
                                    <button
                                      key={status}
                                      onClick={() =>
                                        setChecklistField(item.id, { status })
                                      }
                                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${
                                        item.status === status
                                          ? checklistStatusClass(status)
                                          : "border-border-default bg-surface-card text-text-muted"
                                      }`}
                                    >
                                      {status}
                                    </button>
                                  ))}
                                  <input
                                    value={item.remarks || ""}
                                    onChange={(event) =>
                                      setChecklistField(item.id, {
                                        remarks: event.target.value || null,
                                      })
                                    }
                                    placeholder="Remarks"
                                    className="min-w-[220px] flex-1 rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm outline-none focus:border-primary"
                                  />
                                  <button
                                    onClick={() => prefillSnagFromChecklist(item)}
                                    className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-card"
                                  >
                                    Raise Snag
                                  </button>
                                  {item.linkedSnagItemId && (
                                    <span className="rounded-full border border-border-default bg-surface-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                                      Linked snag #{item.linkedSnagItemId}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </SectionCard>

                      <SectionCard
                        title={`Live ${currentCycleLabel} List`}
                        icon={<Hammer className="h-4 w-4" />}
                        actions={
                          selectedItemIds.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-border-default bg-surface-base px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                                {selectedItemIds.length} selected
                              </span>
                              <button
                                onClick={() =>
                                  openEvidenceDialog(
                                    "RECTIFY",
                                    selectedItemIds,
                                    "Bulk Rectify Selected Snags",
                                  )
                                }
                                disabled={!canBulkRectify}
                                className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Bulk Rectify
                              </button>
                              <button
                                onClick={() =>
                                  openEvidenceDialog(
                                    "CLOSE",
                                    selectedItemIds,
                                    "Bulk Mark De-snag Completed",
                                  )
                                }
                                disabled={!canBulkClose}
                                className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Bulk De-snag Complete
                              </button>
                            </div>
                          ) : null
                        }
                      >
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-border-default bg-surface-base/70 px-4 py-3 text-xs leading-6 text-text-muted">
                            Checker can mark rectified points as de-snag
                            completed, or mark not satisfactory to send the
                            point back to Maker. Once every item is completed,
                            keep adding any newly found points until final
                            closure is signed.
                          </div>
                          <div className="rounded-2xl border border-border-default bg-surface-base/70 px-4 py-3 text-xs leading-6 text-text-muted">
                            Snag items can be permanently deleted only by users
                            with snag delete permission, including after final
                            release to handover.
                          </div>
                          {selectedItems.items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-text-muted">
                              No snag items added in this snag cycle yet.
                            </div>
                          ) : (
                            selectedItems.items.map((item) => (
                              <article
                                key={item.id}
                                className="rounded-2xl border border-border-default bg-surface-base/60"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-4">
                                  <div className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedItemIds.includes(item.id)}
                                      onChange={() => toggleItemSelection(item.id)}
                                      className="mt-1 h-4 w-4 rounded border-border-default text-primary focus:ring-primary"
                                    />
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-semibold text-text-primary">
                                          {item.defectTitle}
                                        </h4>
                                        <span
                                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(item.status)}`}
                                        >
                                          {item.status.replace("_", " ")}
                                        </span>
                                        {item.priority && (
                                          <span className="rounded-full border border-border-default bg-surface-card px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                                            {item.priority}
                                          </span>
                                        )}
                                        <span
                                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                            (item.verifierLevelOrder || 1) === activeVerifierLevelOrder
                                              ? "border-primary/25 bg-primary-muted text-primary"
                                              : "border-border-default bg-surface-card text-text-muted"
                                          }`}
                                        >
                                          L{item.verifierLevelOrder || 1}{" "}
                                          {item.verifierLevelName || "Checker"}
                                        </span>
                                      </div>
                                      <div className="mt-1 text-xs text-text-muted">
                                        {item.roomLabel || "Common area"} |{" "}
                                        {item.trade || "General"}
                                      </div>
                                      {item.defectDescription && (
                                        <p className="mt-2 text-sm text-text-secondary">
                                          {item.defectDescription}
                                        </p>
                                      )}
                                      {item.rectificationNotes && (
                                        <p className="mt-2 text-xs text-text-muted">
                                          Rectification note: {item.rectificationNotes}
                                        </p>
                                      )}
                                      {item.closureRemarks && (
                                        <p className="mt-1 text-xs text-text-muted">
                                          Closure note: {item.closureRemarks}
                                        </p>
                                      )}
                                      {item.holdReason && (
                                        <p className="mt-1 text-xs text-warning">
                                          Hold: {item.holdReason}
                                        </p>
                                      )}
                                      {Boolean(item.notSatisfactoryCount) && (
                                        <p className="mt-1 text-xs text-warning">
                                          Not satisfactory{" "}
                                          {item.notSatisfactoryCount} time
                                          {item.notSatisfactoryCount === 1
                                            ? ""
                                            : "s"}
                                          {item.lastNotSatisfactoryRemarks
                                            ? `: ${item.lastNotSatisfactoryRemarks}`
                                            : ""}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {item.status === "open" && (
                                      <>
                                        <button
                                          onClick={() =>
                                            openEvidenceDialog(
                                              "RECTIFY",
                                              [item.id],
                                              `Rectify ${item.defectTitle}`,
                                            )
                                          }
                                          disabled={!currentRound?.canRectify}
                                          className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-card"
                                        >
                                          Rectify
                                        </button>
                                        <button
                                          onClick={() => void holdItem(item)}
                                          className="rounded-xl border border-warning/20 px-3 py-2 text-xs font-semibold text-warning hover:bg-warning-muted"
                                        >
                                          Hold
                                        </button>
                                      </>
                                    )}
                                    {item.status === "rectified" &&
                                      canApproveSnagRelease &&
                                      currentRound?.canConfirmDesnag &&
                                      (item.verifierLevelOrder || 1) === activeVerifierLevelOrder && (
                                      <>
                                        <button
                                          onClick={() =>
                                            openEvidenceDialog(
                                              "CLOSE",
                                              [item.id],
                                              `Mark De-snag Completed: ${item.defectTitle}`,
                                            )
                                          }
                                          className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-card"
                                        >
                                          De-snag Completed
                                        </button>
                                        <button
                                          onClick={() => void rejectRectification(item)}
                                          className="rounded-xl border border-warning/20 px-3 py-2 text-xs font-semibold text-warning hover:bg-warning-muted"
                                        >
                                          Not Satisfactory
                                        </button>
                                      </>
                                    )}
                                    {canDeleteItem(item) && (
                                      <button
                                        onClick={() => confirmDeleteItem(item)}
                                        className="rounded-xl border border-error/20 px-3 py-2 text-xs font-semibold text-error hover:bg-error-muted"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="grid gap-4 p-4 xl:grid-cols-3">
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                      <Camera className="h-3.5 w-3.5" />
                                      Before
                                    </div>
                                    {renderPhotoStrip(
                                      item.beforePhotos,
                                      "No before photos uploaded.",
                                    )}
                                  </div>
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                      <ImagePlus className="h-3.5 w-3.5" />
                                      Rectification
                                    </div>
                                    {renderPhotoStrip(
                                      item.afterPhotos,
                                      "No rectification photos yet.",
                                    )}
                                  </div>
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Closure
                                    </div>
                                    {renderPhotoStrip(
                                      item.closurePhotos,
                                      "No closure photos yet.",
                                    )}
                                  </div>
                                </div>
                              </article>
                            ))
                          )}
                        </div>
                      </SectionCard>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {raiseSnagDialogOpen && detail && currentRound && (
        <div className="fixed inset-0 z-[1200] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Raise {currentCycleLabel} Point
                  </h3>
                  <p className="text-sm text-text-muted">
                    {selectedUnit?.unitLabel || detail.unitLabel} /{" "}
                    {currentProcessStep?.name || currentCycleLabel}
                  </p>
                </div>
                <button
                  onClick={() => setRaiseSnagDialogOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto px-5 py-5">
                {!canCheckerRaiseInSelectedCycle && (
                  <div className="rounded-2xl border border-warning/20 bg-warning-muted/40 px-4 py-3 text-sm text-warning">
                    This snag cycle is not open for Checker snag entry.
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-text-muted">
                    Room
                    <select
                      value={snagForm.qualityRoomId}
                      disabled={!canCheckerRaiseInSelectedCycle}
                      onChange={(event) =>
                        updateSnagForm({
                          qualityRoomId: event.target.value
                            ? Number(event.target.value)
                            : "",
                        })
                      }
                      className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Common area / no room</option>
                      {(detail.unit?.rooms || []).map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs font-medium text-text-muted">
                    Activity
                    <select
                      value={snagForm.processActivityId}
                      disabled={!canCheckerRaiseInSelectedCycle}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "OTHER") {
                          updateSnagForm({
                            processActivityId: "OTHER",
                            commonPointId: "OTHER",
                            defectTitle: "",
                            defectDescription: "",
                            trade: "Others",
                          });
                          return;
                        }
                        const activity = currentConfiguredActivities.find(
                          (item) => String(item.id) === value,
                        );
                        updateSnagForm({
                          processActivityId: value ? Number(value) : "",
                          commonPointId: "",
                          defectTitle: "",
                          defectDescription: "",
                          trade: activity
                            ? getConfigActivityLabel(activity.activity)
                            : "",
                        });
                      }}
                      className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Select configured activity</option>
                      {currentConfiguredActivities.map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {getConfigActivityLabel(activity.activity)}
                        </option>
                      ))}
                      <option value="OTHER">Others</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-1 text-xs font-medium text-text-muted">
                  Snag Point
                  <select
                    value={snagForm.commonPointId}
                    disabled={
                      !canCheckerRaiseInSelectedCycle ||
                      !snagForm.processActivityId ||
                      snagForm.processActivityId === "OTHER"
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "OTHER") {
                        updateSnagForm({
                          commonPointId: "OTHER",
                          defectTitle: "",
                          defectDescription: "",
                        });
                        return;
                      }
                      const point = selectedConfiguredActivity?.commonPoints?.find(
                        (item) => String(item.id) === value,
                      );
                      updateSnagForm({
                        commonPointId: value ? Number(value) : "",
                        defectTitle: point?.title || "",
                        defectDescription: point?.description || "",
                      });
                    }}
                    className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Select predefined point</option>
                    {(selectedConfiguredActivity?.commonPoints || []).map((point) => (
                      <option key={point.id} value={point.id}>
                        {point.title}
                      </option>
                    ))}
                    <option value="OTHER">Others</option>
                  </select>
                </label>

                {selectedCommonPoint?.requiresEvidence && (
                  <div className="rounded-2xl border border-warning/20 bg-warning-muted/40 px-4 py-3 text-sm text-warning">
                    This configured point requires photo evidence.
                  </div>
                )}

                <input
                  value={snagForm.defectTitle}
                  disabled={!canCheckerRaiseInSelectedCycle}
                  onChange={(event) =>
                    updateSnagForm({ defectTitle: event.target.value })
                  }
                  placeholder="Snag point / defect title"
                  className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <textarea
                  value={snagForm.defectDescription}
                  disabled={!canCheckerRaiseInSelectedCycle}
                  onChange={(event) =>
                    updateSnagForm({ defectDescription: event.target.value })
                  }
                  rows={4}
                  placeholder="Description"
                  className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={snagForm.trade}
                    disabled={!canCheckerRaiseInSelectedCycle}
                    onChange={(event) => updateSnagForm({ trade: event.target.value })}
                    placeholder="Activity / trade"
                    className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <select
                    value={snagForm.priority}
                    disabled={!canCheckerRaiseInSelectedCycle}
                    onChange={(event) =>
                      updateSnagForm({ priority: event.target.value })
                    }
                    className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <label
                  className={`flex items-center gap-2 rounded-xl border border-dashed border-border-default bg-surface-base px-3 py-3 text-sm ${
                    canCheckerRaiseInSelectedCycle
                      ? "cursor-pointer text-text-secondary"
                      : "cursor-not-allowed text-text-disabled"
                  }`}
                >
                            <Upload className="h-4 w-4" />
                            Upload before photos
                            {raisePhotoRequired ? " (required)" : " (optional)"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={!canCheckerRaiseInSelectedCycle}
                    onChange={(event) =>
                      updateSnagForm({ beforeFiles: event.target.files })
                    }
                  />
                </label>
                <button
                  onClick={() => void createItem()}
                  disabled={busy || !canCheckerRaiseInSelectedCycle}
                  className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add Snag Point
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {finalClosureDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    {finalClosureDialog.isFinalStageLevel
                      ? `Final Closure of ${finalClosureDialog.label}`
                      : `Close Level ${finalClosureDialog.levelOrder}`}
                  </h3>
                  <p className="text-sm text-text-muted">
                    {finalClosureDialog.levelName} signoff will be printed in
                    the matching level section of the snag status PDF.
                  </p>
                </div>
                <button
                  onClick={() => setFinalClosureDialog(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-success/20 bg-success-muted/40 px-4 py-3 text-sm text-success">
                  {finalClosureDialog.isFinalStageLevel
                    ? "All active-level snag points are closed. Signing final closure will complete this snag stage and make the next configured stage available only after Maker marks the unit ready."
                    : "All active-level snag points are closed. Signing this level closure will hand the same snag stage to the next release-strategy checker level."}
                </div>
                <textarea
                  value={finalClosureRemarks}
                  onChange={(event) => setFinalClosureRemarks(event.target.value)}
                  rows={4}
                  placeholder="Final closure remarks"
                  className="w-full rounded-2xl border border-border-default bg-surface-base px-3 py-3 text-sm outline-none focus:border-primary"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setFinalClosureDialog(null)}
                    className="rounded-xl border border-border-default px-4 py-2 text-sm text-text-secondary hover:bg-surface-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void submitFinalClosure()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PenLine className="h-4 w-4" />
                    )}
                    {finalClosureDialog.isFinalStageLevel
                      ? "Sign Final Closure"
                      : "Close Level"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {evidenceDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    {evidenceDialog.title}
                  </h3>
                  <p className="text-sm text-text-muted">
                    {evidenceDialog.mode === "RECTIFY"
                      ? "Upload evidence once and apply it to the selected snag items."
                      : "Upload closure evidence if available, or close the selected snag items without photos."}
                  </p>
                </div>
                <button
                  onClick={() => setEvidenceDialog(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-border-default bg-surface-base px-4 py-4 text-sm text-text-secondary">
                  <Upload className="h-4 w-4" />
                  Upload{" "}
                  {evidenceDialog.mode === "RECTIFY"
                    ? "rectification"
                    : "closure"}{" "}
                  photos
                  {evidenceDialog.mode === "RECTIFY"
                    ? rectificationPhotoRequired
                      ? " (required)"
                      : " (optional)"
                    : desnagCompletionPhotoRequired
                      ? " (required)"
                      : " (optional)"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => setEvidenceFiles(event.target.files)}
                  />
                </label>
                <textarea
                  value={evidenceNotes}
                  onChange={(event) => setEvidenceNotes(event.target.value)}
                  rows={4}
                  placeholder={
                    evidenceDialog.mode === "RECTIFY"
                      ? "Rectification notes"
                      : "Closure remarks (optional)"
                  }
                  className="w-full rounded-2xl border border-border-default bg-surface-base px-4 py-3 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => void submitEvidence()}
                  disabled={busy}
                  className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {evidenceDialog.mode === "RECTIFY"
                    ? "Submit Rectification"
                    : "Submit Closure"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {skipDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Skip {skipDialog.currentLabel} /{" "}
                    {skipDialog.currentDesnagLabel}
                  </h3>
                  <p className="text-sm text-text-muted">
                    This will bypass this full snag and de-snag cycle and
                    release the unit directly to {skipDialog.nextLabel}.
                  </p>
                </div>
                <button
                  onClick={() => setSkipDialog(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-warning/20 bg-warning-muted/40 px-4 py-3 text-sm text-warning">
                  Only authorized users should skip a snag cycle, and only
                  before any snag item is raised in that cycle.
                </div>
                <textarea
                  value={skipReason}
                  onChange={(event) => setSkipReason(event.target.value)}
                  rows={4}
                  placeholder="Reason for skipping this snag cycle"
                  className="w-full rounded-2xl border border-border-default bg-surface-base px-4 py-3 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => void submitSkipRound()}
                  disabled={busy}
                  className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Skip This Cycle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetRoundDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Delete {resetRoundDialog.currentLabel} /{" "}
                    {resetRoundDialog.currentDesnagLabel}
                  </h3>
                  <p className="text-sm text-text-muted">
                    This permanently deletes the selected snag cycle and reopens
                    it from scratch.
                  </p>
                </div>
                <button
                  onClick={() => setResetRoundDialog(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-error/20 bg-error-muted/40 px-4 py-3 text-sm text-error">
                  This is a permanent hard delete.{" "}
                  {resetRoundDialog.laterCycleCount > 0
                    ? `${resetRoundDialog.currentLabel} and ${resetRoundDialog.laterCycleCount} later cycle(s) will be removed.`
                    : "Only this selected cycle will be removed."}{" "}
                  The unit will reopen at {resetRoundDialog.currentLabel}.
                  {resetRoundDialog.rollsBackHandover
                    ? " Final handover release will also be rolled back."
                    : ""}
                </div>
                <textarea
                  value={resetRoundReason}
                  onChange={(event) => setResetRoundReason(event.target.value)}
                  rows={4}
                  placeholder="Reason for deleting and reopening this snag cycle"
                  className="w-full rounded-2xl border border-border-default bg-surface-base px-4 py-3 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => void submitResetRound()}
                  disabled={busy || !resetRoundReason.trim()}
                  className="w-full rounded-2xl bg-error px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Permanently Delete This Cycle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteItemDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Delete Snag Item
                  </h3>
                  <p className="text-sm text-text-muted">
                    This will permanently remove the selected snag item and its
                    photo evidence.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteItemDialog(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-error/20 bg-error-muted/40 px-4 py-3 text-sm text-error">
                  <div className="flex items-start gap-3">
                    <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-semibold">
                        {deleteItemDialog.defectTitle}
                      </div>
                      <div className="mt-1 text-sm">
                        This action cannot be undone.
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void submitDeleteItem()}
                  disabled={busy}
                  className="w-full rounded-2xl bg-error px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Permanently Delete This Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
