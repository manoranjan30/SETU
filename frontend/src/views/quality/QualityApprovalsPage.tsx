import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { PermissionCode } from "../../config/permissions";
import {
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  MessageSquareWarning,
  X,
  Camera,
  FileDown,
  RotateCcw,
  Trash2,
  AlertTriangle,
  LayoutDashboard,
  MapPin,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Home,
  Siren,
} from "lucide-react";
import api from "../../api/axios";
import { getPublicFileUrl } from "../../api/baseUrl";
import SignatureModal from "../../components/quality/SignatureModal";
import { qualityService } from "../../services/quality.service";

interface QualityInspection {
  id: number;
  activityId: number;
  epsNodeId: number;
  status:
    | "PENDING"
    | "APPROVED"
    | "PROVISIONALLY_APPROVED"
    | "REJECTED"
    | "CANCELED"
    | "REVERSED"
    | "PARTIALLY_APPROVED";
  requestDate: string;
  inspectionDate?: string;
  comments?: string;
  inspectedBy?: string;
  activity?: {
    id: number;
    activityName: string;
    requiresPourCard?: boolean;
    requiresPourClearanceCard?: boolean;
  };
  epsNode?: {
    label: string;
    name?: string;
  };
  blockName?: string;
  towerName?: string;
  floorName?: string;
  unitName?: string;
  roomName?: string;
  goNo?: number;
  goLabel?: string;
  drawingNo?: string;
  elementName?: string;
  partNo?: number;
  partLabel?: string;
  vendorName?: string;
  contractorName?: string;
  locationPath?: string;
  pendingObservationCount?: number;
  legacyActivityObservationCount?: number;
  workflowCurrentLevel?: number;
  workflowTotalLevels?: number;
  pendingApprovalLevel?: number;
  pendingApprovalLabel?: string;
  pendingApprovalDisplay?: string;
  pendingApproverNames?: string[];
  pendingApprovalBy?: number | string;
  workflowSummary?: {
    runStatus?: string;
    releaseStrategyId?: number;
    releaseStrategyVersion?: number;
    strategyName?: string;
    processCode?: string;
    documentType?: string;
    actorState?:
      | "CAN_ACT_NOW"
      | "ASSIGNED_LATER"
      | "NOT_ASSIGNED"
      | "ALREADY_ACTED_OR_NOT_ACTIVE"
      | "COMPLETED"
      | null;
    currentUserCanApprove?: boolean;
    currentUserAssignedLevels?: number[];
    currentUserFutureLevels?: number[];
    currentUserBlockedReason?: string | null;
    currentUserActionHint?: string | null;
    pendingStep?: {
      stepOrder?: number;
      stepName?: string;
      status?: string;
      assignedUserId?: number | null;
      assignedUserIds?: number[];
      assignedRoleId?: number | null;
      pendingApproverNames?: string[];
      pendingApprovalDisplay?: string | null;
      currentApprovalCount?: number;
      minApprovalsRequired?: number;
      approvedUserIds?: number[];
    } | null;
    completedSteps?: Array<{
      stepOrder?: number;
      stepName?: string;
      currentApprovalCount?: number;
      minApprovalsRequired?: number;
      signerDisplayName?: string;
      signerCompany?: string;
      signerRole?: string;
      completedAt?: string;
    }>;
  };
  stageApprovalSummary?: {
    approvedStages?: number;
    totalStages?: number;
    pendingFinalApproval?: boolean;
    currentUserCanApprove?: boolean;
    currentUserActionHint?: string | null;
    currentUserBlockedReason?: string | null;
    activeLevel?: number | null;
  };
  slaDueAt?: string;
  isLocked?: boolean;
  stages?: any[]; // Populated in detail view
}

interface ActivityObservation {
  id: string;
  inspectionId?: number | null;
  stageId?: number | null;
  observationText: string;
  type?: string;
  remarks?: string;
  photos?: string[];
  closureText?: string;
  closureEvidence?: string[];
  createdAt: string;
  status: "OPEN" | "PENDING" | "RECTIFIED" | "RESOLVED" | "CLOSED";
}

type ApprovalTab = "PENDING" | "ALL" | "APPROVED" | "REJECTED" | "DASHBOARD";
type SavedView =
  | "All Pending"
  | "Overdue Focus"
  | "High Risk"
  | "Ready For Closeout";
type ReportPreset =
  | "TOWER_SUMMARY"
  | "PARTIAL_TRACKER"
  | "LEVEL_PENDING"
  | "OBS_AGEING"
  | "BOTTLENECKS"
  | "VENDOR_PERFORMANCE";
type SlaBucket = "All" | "Overdue" | "Due <24h" | "Due 24-48h" | "Upcoming";
type ListSortOption =
  | "NEWEST"
  | "OLDEST"
  | "RISK_HIGH"
  | "RISK_LOW"
  | "TOWER"
  | "FLOOR"
  | "PENDING_LEVEL"
  | "STATUS";

const APPROVAL_TABS: Array<{ key: ApprovalTab; label: string }> = [
  { key: "DASHBOARD", label: "Dashboard" },
  { key: "PENDING", label: "Pending QC" },
  { key: "ALL", label: "All RFIs" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

const SAVED_VIEWS: SavedView[] = [
  "All Pending",
  "Overdue Focus",
  "High Risk",
  "Ready For Closeout",
];

const SLA_BUCKETS: SlaBucket[] = [
  "All",
  "Overdue",
  "Due <24h",
  "Due 24-48h",
  "Upcoming",
];

const REPORT_PRESETS: Array<{ key: ReportPreset; label: string }> = [
  { key: "TOWER_SUMMARY", label: "Tower / Floor Summary" },
  { key: "PARTIAL_TRACKER", label: "Partial Approval Tracker" },
  { key: "LEVEL_PENDING", label: "Approval Level Pending" },
  { key: "OBS_AGEING", label: "Open Observation Ageing" },
  { key: "BOTTLENECKS", label: "Approver Bottlenecks" },
  { key: "VENDOR_PERFORMANCE", label: "Contractor / Vendor Performance" },
];

function isPendingStatus(status: QualityInspection["status"]) {
  return status === "PENDING" || status === "PARTIALLY_APPROVED";
}

function isApprovedStatus(status: QualityInspection["status"]) {
  return status === "APPROVED" || status === "PROVISIONALLY_APPROVED";
}

function parseLocationHierarchy(insp: QualityInspection) {
  const explicit = [
    insp.blockName,
    insp.towerName,
    insp.floorName,
    insp.unitName,
    insp.roomName,
  ]
    .filter((x): x is string => !!x && x.trim().length > 0)
    .map((x) => x.trim());
  if (explicit.length > 0) {
    return explicit;
  }
  const raw =
    insp.locationPath || insp.epsNode?.label || insp.epsNode?.name || "";
  return raw
    .split(/[>|/,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getFloorLabel(insp: QualityInspection) {
  if (insp.floorName) return insp.floorName;
  const hierarchy = parseLocationHierarchy(insp);
  return hierarchy.find((h) => h.toLowerCase().includes("floor")) || "Unmapped";
}

function getBlockLabel(insp: Partial<QualityInspection>) {
  if (insp.blockName?.trim()) return insp.blockName.trim();
  const hierarchy = parseLocationHierarchy(insp as QualityInspection);
  return hierarchy[0] || "Unmapped";
}

function getTowerLabel(insp: Partial<QualityInspection>) {
  if (insp.towerName?.trim()) return insp.towerName.trim();
  const hierarchy = parseLocationHierarchy(insp as QualityInspection);
  return hierarchy[1] || "Unmapped";
}

function getUnitLabel(insp: Partial<QualityInspection>) {
  if (insp.unitName?.trim()) return insp.unitName.trim();
  const hierarchy = parseLocationHierarchy(insp as QualityInspection);
  return hierarchy[3] || "Unmapped";
}

function getRoomLabel(insp: Partial<QualityInspection>) {
  if (insp.roomName?.trim()) return insp.roomName.trim();
  const hierarchy = parseLocationHierarchy(insp as QualityInspection);
  return hierarchy[4] || "Unmapped";
}

function getGoLabel(insp: Partial<QualityInspection>) {
  if (insp.goLabel?.trim()) return insp.goLabel.trim();
  if (typeof insp.goNo === "number") return `GO ${insp.goNo}`;
  if (insp.partLabel?.trim()) return insp.partLabel.replace(/^Part/i, "GO").trim();
  if (typeof insp.partNo === "number") return `GO ${insp.partNo}`;
  return null;
}

function getInspectionScopeTokens(insp: Partial<QualityInspection>) {
  const hierarchy = parseLocationHierarchy(insp as QualityInspection);
  return [
    insp.blockName || hierarchy[0],
    insp.towerName || hierarchy[1],
    insp.floorName || hierarchy[2] || getFloorLabel(insp as QualityInspection),
    getGoLabel(insp),
    insp.unitName,
    insp.roomName,
  ].filter((value): value is string => !!value && value.trim().length > 0);
}

function isStageApproved(stage: any) {
  if (stage?.stageApproval?.fullyApproved) return true;
  if (stage?.status === "APPROVED") return true;
  if (
    stage?.isLocked &&
    (stage?.stageApproval?.fullyApproved || stage?.status === "APPROVED")
  ) {
    return true;
  }
  return false;
}

function getCheckedStageItems(stage: any) {
  return (stage?.items || []).filter(
    (item: any) =>
      item?.value === "YES" || item?.value === "NA" || item?.isOk,
  ).length;
}

function isStageChecklistComplete(stage: any) {
  const totalItems = stage?.items?.length || 0;
  return totalItems > 0 && getCheckedStageItems(stage) === totalItems;
}

function getSlaBucket(insp: QualityInspection): SlaBucket {
  if (!isPendingStatus(insp.status)) return "Upcoming";
  const now = Date.now();
  if (insp.slaDueAt) {
    const hrs = (new Date(insp.slaDueAt).getTime() - now) / 36e5;
    if (hrs < 0) return "Overdue";
    if (hrs < 24) return "Due <24h";
    if (hrs < 48) return "Due 24-48h";
    return "Upcoming";
  }
  const ageHours = (now - new Date(insp.requestDate).getTime()) / 36e5;
  if (ageHours > 48) return "Overdue";
  if (ageHours > 24) return "Due <24h";
  if (ageHours > 12) return "Due 24-48h";
  return "Upcoming";
}

function getPriorityScore(insp: QualityInspection) {
  let score = 0;
  const bucket = getSlaBucket(insp);
  if (bucket === "Overdue") score += 100;
  if (bucket === "Due <24h") score += 60;
  if (bucket === "Due 24-48h") score += 35;
  score += (insp.pendingObservationCount || 0) * 20;
  const total = insp.workflowTotalLevels || 0;
  const current = insp.workflowCurrentLevel || 0;
  if (total > 0 && current > 0) score += (total - current + 1) * 2;
  const ageHours = (Date.now() - new Date(insp.requestDate).getTime()) / 36e5;
  score += Math.floor(ageHours / 12);
  return score;
}

function getCounterpartyLabel(insp: Partial<QualityInspection>) {
  return (
    insp.contractorName?.trim() ||
    insp.vendorName?.trim() ||
    "Internal Team / Unmapped"
  );
}

function getWorkflowStateBadge(insp: QualityInspection) {
  const actorState = insp.workflowSummary?.actorState;
  if (actorState === "CAN_ACT_NOW") {
    return {
      label: "Actionable Now",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (actorState === "ASSIGNED_LATER") {
    return {
      label: "Assigned Later",
      className: "bg-blue-100 text-blue-700",
    };
  }
  if (actorState === "NOT_ASSIGNED") {
    return {
      label: "Assigned To Others",
      className: "bg-surface-raised text-text-secondary",
    };
  }
  if (actorState === "ALREADY_ACTED_OR_NOT_ACTIVE") {
    return {
      label: "Not Active For You",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (actorState === "COMPLETED") {
    return {
      label: "Workflow Complete",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return null;
}

function getPendingApproverDisplay(insp: Partial<QualityInspection>) {
  const pendingNames =
    insp.workflowSummary?.pendingStep?.pendingApproverNames ||
    insp.pendingApproverNames ||
    [];
  if (pendingNames.length > 0) {
    return pendingNames.join(", ");
  }
  if (insp.pendingApprovalDisplay?.trim()) {
    return insp.pendingApprovalDisplay.trim();
  }
  if (insp.pendingApprovalLabel?.trim()) {
    return insp.pendingApprovalLabel.trim();
  }
  return "No live approver resolved";
}

function getWorkflowActorTone(
  actorState?:
    | "CAN_ACT_NOW"
    | "ASSIGNED_LATER"
    | "NOT_ASSIGNED"
    | "ALREADY_ACTED_OR_NOT_ACTIVE"
    | "COMPLETED"
    | null,
) {
  switch (actorState) {
    case "CAN_ACT_NOW":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "ASSIGNED_LATER":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "NOT_ASSIGNED":
      return "border-slate-200 bg-surface-raised text-text-secondary";
    case "ALREADY_ACTED_OR_NOT_ACTIVE":
      return "border-amber-200 bg-warning-muted text-amber-800";
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-border-subtle bg-surface-base text-text-secondary";
  }
}

function getWorkflowStepMeta(step: any, isCurrent: boolean, isLastStepNode: boolean, isRaiserStep: boolean) {
  const isCompleted = step.status === "COMPLETED";
  const isRejected = step.status === "REJECTED";
  const delegated =
    typeof step.comments === "string" &&
    step.comments.toLowerCase().includes("delegat");

  let colorClass = "bg-surface-raised text-text-muted border-border-default";
  let stateLabel = "Waiting";

  if (isCompleted) {
    colorClass = "bg-green-100 text-green-700 border-green-200";
    stateLabel = isRaiserStep ? "Raised" : "Approved";
  } else if (isRejected) {
    colorClass = "bg-red-100 text-red-700 border-red-200";
    stateLabel = "Rejected";
  } else if (isCurrent) {
    colorClass =
      "bg-indigo-100 text-indigo-700 border-indigo-300 ring-2 ring-indigo-200";
    stateLabel = "Active Now";
  } else if (delegated) {
    colorClass = "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200";
    stateLabel = "Delegated";
  }

  const stepLabel =
    isLastStepNode && !isRaiserStep
      ? "Final Approval"
      : step.stepName || step.workflowNode?.label || `Step ${step.stepOrder}`;

  const subtitle = isCompleted
    ? isRaiserStep
      ? "RFI Raised"
      : `Signed by ${step.signerDisplayName || step.signedBy}${step.signerCompany ? ` - ${step.signerCompany}` : ""}${step.signerRole ? ` - ${step.signerRole}` : ""}`
    : isRejected
      ? "Rejected"
      : isCurrent
        ? `Pending approval${step.stepName ? ` - ${step.stepName}` : ""}`
        : delegated
          ? step.comments || "Delegated to another approver"
          : "Waiting for previous level";

  return {
    colorClass,
    stateLabel,
    stepLabel,
    subtitle,
    isCompleted,
    delegated,
  };
}

function safeCsvCell(value: unknown) {
  const stringValue =
    value === null || value === undefined ? "" : String(value).trim();
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<unknown[]>) {
  const csv = [
    headers.map(safeCsvCell).join(","),
    ...rows.map((row) => row.map(safeCsvCell).join(",")),
  ].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function QualityApprovalsPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<
    number | null
  >(null);
  const [inspectionDetail, setInspectionDetail] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Workflow State
  const [workflowState, setWorkflowState] = useState<any>(null);
  const [workflowStripCollapsed, setWorkflowStripCollapsed] = useState(true);

  // Observations State
  const [observations, setObservations] = useState<ActivityObservation[]>([]);
  const [legacyObservations, setLegacyObservations] = useState<
    ActivityObservation[]
  >([]);
  const [obsTab, setObsTab] = useState<
    "PENDING" | "RECTIFIED" | "CLOSED" | "ALL"
  >("PENDING");
  const [showObsModal, setShowObsModal] = useState(false);
  const [selectedObservationStageId, setSelectedObservationStageId] = useState<
    number | null
  >(null);
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
  const [selectedDelegateId, setSelectedDelegateId] = useState<number | null>(
    null,
  );
  const [obsText, setObsText] = useState("");
  const [obsType, setObsType] = useState("Minor");
  const [currentPhotos, setCurrentPhotos] = useState<string[]>([]);
  const [savingObs, setSavingObs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveUploadingId, setResolveUploadingId] = useState<string | null>(
    null,
  );
  const [resolutionTexts, setResolutionTexts] = useState<Record<string, string>>(
    {},
  );
  const [resolutionPhotos, setResolutionPhotos] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (selectedInspectionId) {
      setWorkflowStripCollapsed(true);
    }
  }, [selectedInspectionId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setDashboardFullscreen(document.fullscreenElement === workspaceRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Reversal Modal
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalLoading, setReversalLoading] = useState(false);

  // Signature Modals
  const [showFinalApproveSig, setShowFinalApproveSig] = useState(false);
  const [activeStageId, setActiveStageId] = useState<number | null>(null);
  // showReversalSig could also be added if reversal needs digital signature, but reason is already captured in modal.

  // User info
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission(PermissionCode.QUALITY_INSPECTION_DELETE);
  const canApproveInspection = hasPermission(
    PermissionCode.QUALITY_INSPECTION_APPROVE,
  );
  const canCloseChecklistObservation = hasPermission(
    PermissionCode.QUALITY_OBSERVATION_CLOSE,
  );

  // Helper for correct image URLs.
  // Strips the /api suffix from VITE_API_URL so uploads (served at the server
  // root) are resolved correctly even if the API URL includes /api.
  const getFileUrl = (path: string) => {
    return getPublicFileUrl(path);
  };

  // Filter states
  const [filterStatus, setFilterStatus] = useState<ApprovalTab>("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("All Blocks");
  const [selectedTower, setSelectedTower] = useState("All Towers");
  const [selectedFloor, setSelectedFloor] = useState("All Floors");
  const [selectedGo, setSelectedGo] = useState("All GOs");
  const [selectedSlaBucket, setSelectedSlaBucket] = useState<SlaBucket>("All");
  const [selectedSort, setSelectedSort] = useState<ListSortOption>("NEWEST");
  const [selectedView, setSelectedView] = useState<SavedView>("All Pending");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [selectedReportPreset, setSelectedReportPreset] =
    useState<ReportPreset>("TOWER_SUMMARY");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [dashboardFullscreen, setDashboardFullscreen] = useState(false);
  const [pourCard, setPourCard] = useState<any>(null);
  const [prePourClearanceCard, setPrePourClearanceCard] = useState<any>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [savingPourCard, setSavingPourCard] = useState(false);
  const [savingPrePourClearance, setSavingPrePourClearance] = useState(false);
  const [submittingPourCard, setSubmittingPourCard] = useState(false);
  const [submittingPrePourClearance, setSubmittingPrePourClearance] =
    useState(false);

  const applyFullscreenThemeVars = () => {
    const host = workspaceRef.current;
    if (!host) return;
    const root = document.documentElement;
    const source = getComputedStyle(root);
    Array.from(host.classList)
      .filter((className) => className.startsWith("theme-"))
      .forEach((className) => host.classList.remove(className));
    host.classList.add("theme-shadcn-admin");
    host.classList.add("fullscreen-themed");
    const isDarkTheme = false;
    [
      "--color-surface-base",
      "--color-surface-card",
      "--color-surface-raised",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-muted",
      "--color-text-disabled",
      "--color-border-default",
      "--color-border-subtle",
      "--color-secondary",
      "--color-success",
      "--color-warning",
      "--color-error",
      "--color-info",
    ].forEach((token) => {
      const value = source.getPropertyValue(token);
      if (value) {
        host.style.setProperty(token, value.trim());
      }
    });
    host.style.backgroundColor =
      source.getPropertyValue("--color-surface-base").trim() ||
      source.backgroundColor ||
      "#f8fafc";
    host.style.color =
      source.getPropertyValue("--color-text-primary").trim() ||
      source.color ||
      "#0f172a";
    host.style.colorScheme = isDarkTheme ? "dark" : "light";
    host.dataset.fullscreenScheme = isDarkTheme ? "dark" : "light";
  };

  const exitDashboardFullscreen = async () => {
    if (document.fullscreenElement === workspaceRef.current) {
      await document.exitFullscreen();
    }
  };

  const handleApprovalTabClick = async (tabKey: ApprovalTab) => {
    if (tabKey === "DASHBOARD" && filterStatus === "DASHBOARD" && !selectedInspectionId) {
      if (document.fullscreenElement === workspaceRef.current) {
        await document.exitFullscreen();
      } else {
        applyFullscreenThemeVars();
        await workspaceRef.current?.requestFullscreen();
      }
      return;
    }

    if (tabKey !== "DASHBOARD") {
      await exitDashboardFullscreen();
    }

    setFilterStatus(tabKey);
  };

  useEffect(() => {
    if (projectId) {
      setLoadingList(true);
      api
        .get("/quality/inspections", {
          params: { projectId },
        })
        .then((res) => {
          setInspections(res.data);
          // Auto-select when navigated from raise-RFI page via ?inspectionId=X
          const focusId = searchParams.get("inspectionId");
          if (focusId) {
            const id = Number(focusId);
            if (!isNaN(id)) {
              setSelectedInspectionId(id);
              setFilterStatus("ALL");
            }
            setSearchParams((prev: URLSearchParams) => {
              const next = new URLSearchParams(prev);
              next.delete("inspectionId");
              return next;
            }, { replace: true });
          }
        })
        .finally(() => setLoadingList(false));
    }
  }, [projectId, refreshKey]);

  useEffect(() => {
    if (selectedInspectionId) {
      setLoadingDetail(true);

      // Bring down detail, workflow, and observations
      Promise.all([
        api.get(`/quality/inspections/${selectedInspectionId}`),
        api
          .get(`/quality/inspections/${selectedInspectionId}/workflow`)
          .catch(() => ({ data: null })),
      ])
        .then(async ([detailRes, flowRes]) => {
          setInspectionDetail(detailRes.data);
          setWorkflowState(flowRes.data);

          // Fetch only the observations scoped to this inspection. Checklist
          // templates may be shared, but each RFI flow must stay unique to its
          // own floor / unit / GO context.
          if (detailRes.data.activityId) {
            try {
              const inspectionObsRes = await api.get(
                `/quality/activities/${detailRes.data.activityId}/observations`,
                {
                  params: { inspectionId: detailRes.data.id },
                },
              );
              setObservations(inspectionObsRes.data || []);
              setLegacyObservations([]);
            } catch (err) {
              console.error("Failed to load observations", err);
              setObservations([]);
              setLegacyObservations([]);
            }
          } else {
            setObservations([]);
            setLegacyObservations([]);
          }
        })
        .finally(() => setLoadingDetail(false));
    } else {
      setInspectionDetail(null);
      setWorkflowState(null);
      setObservations([]);
      setLegacyObservations([]);
    }
  }, [selectedInspectionId, refreshKey]);

  useEffect(() => {
    const inspectionId = inspectionDetail?.id;
    const requiresPourCard = inspectionDetail?.activity?.requiresPourCard;
    const requiresPrePourClearance =
      inspectionDetail?.activity?.requiresPourClearanceCard;

    if (!inspectionId || (!requiresPourCard && !requiresPrePourClearance)) {
      setPourCard(null);
      setPrePourClearanceCard(null);
      return;
    }

    setLoadingCards(true);
    Promise.all([
      requiresPourCard
        ? qualityService.getPourCard(inspectionId)
        : Promise.resolve(null),
      requiresPrePourClearance
        ? qualityService.getPrePourClearanceCard(inspectionId)
        : Promise.resolve(null),
    ])
      .then(([pourCardRes, clearanceRes]) => {
        setPourCard(pourCardRes);
        setPrePourClearanceCard(clearanceRes);
      })
      .catch(() => {
        setPourCard(null);
        setPrePourClearanceCard(null);
      })
      .finally(() => setLoadingCards(false));
  }, [
    inspectionDetail?.id,
    inspectionDetail?.activity?.requiresPourCard,
    inspectionDetail?.activity?.requiresPourClearanceCard,
  ]);

  const filterOptions = useMemo(() => {
    const unique = (values: string[]) =>
      Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      );

    return {
      blocks: unique(inspections.map((insp) => getBlockLabel(insp))),
      towers: unique(inspections.map((insp) => getTowerLabel(insp))),
      floors: unique(inspections.map((insp) => getFloorLabel(insp))),
      gos: unique(
        inspections
          .map((insp) => getGoLabel(insp))
          .filter((value): value is string => !!value),
      ),
    };
  }, [inspections]);

  const savePourCardDetails = async () => {
    if (!inspectionDetail?.id || !pourCard) return;
    setSavingPourCard(true);
    try {
      const saved = await qualityService.savePourCard(inspectionDetail.id, pourCard);
      setPourCard(saved);
      alert("Pour card saved.");
    } catch {
      alert("Failed to save pour card.");
    } finally {
      setSavingPourCard(false);
    }
  };

  const savePrePourClearanceDetails = async () => {
    if (!inspectionDetail?.id || !prePourClearanceCard) return;
    setSavingPrePourClearance(true);
    try {
      const saved = await qualityService.savePrePourClearanceCard(
        inspectionDetail.id,
        prePourClearanceCard,
      );
      setPrePourClearanceCard(saved);
      alert("Pre-pour clearance card saved.");
    } catch {
      alert("Failed to save pre-pour clearance card.");
    } finally {
      setSavingPrePourClearance(false);
    }
  };

  const submitPourCardDetails = async () => {
    if (!inspectionDetail?.id) return;
    setSubmittingPourCard(true);
    try {
      const saved = await qualityService.submitPourCard(inspectionDetail.id);
      setPourCard(saved);
      alert("Pour card submitted.");
    } catch (err: any) {
      alert(getApiErrorMessage(err, "Failed to submit pour card."));
    } finally {
      setSubmittingPourCard(false);
    }
  };

  const submitPrePourClearanceDetails = async () => {
    if (!inspectionDetail?.id) return;
    setSubmittingPrePourClearance(true);
    try {
      const saved = await qualityService.submitPrePourClearanceCard(
        inspectionDetail.id,
      );
      setPrePourClearanceCard(saved);
      alert("Pre-pour clearance card submitted.");
    } catch (err: any) {
      alert(getApiErrorMessage(err, "Failed to submit pre-pour clearance card."));
    } finally {
      setSubmittingPrePourClearance(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPourCardPdf = async () => {
    if (!inspectionDetail?.id) return;
    try {
      const blob = await qualityService.downloadPourCardPdf(inspectionDetail.id);
      downloadBlob(blob, `Pour_Card_${inspectionDetail.id}.pdf`);
    } catch (err: any) {
      alert(getApiErrorMessage(err, "Failed to download pour card PDF."));
    }
  };

  const downloadPrePourClearancePdf = async () => {
    if (!inspectionDetail?.id) return;
    try {
      const blob = await qualityService.downloadPrePourClearancePdf(
        inspectionDetail.id,
      );
      downloadBlob(blob, `Pre_Pour_Clearance_${inspectionDetail.id}.pdf`);
    } catch (err: any) {
      alert(
        getApiErrorMessage(
          err,
          "Failed to download pre-pour clearance PDF.",
        ),
      );
    }
  };

  const filteredInspections = useMemo(() => {
    if (filterStatus === "DASHBOARD") return inspections;

    const query = searchQuery.trim().toLowerCase();
    const matchesTab = (inspection: QualityInspection) => {
      if (filterStatus === "ALL") return true;
      if (filterStatus === "PENDING") return isPendingStatus(inspection.status);
      if (filterStatus === "APPROVED") return isApprovedStatus(inspection.status);
      if (filterStatus === "REJECTED") return inspection.status === "REJECTED";
      return true;
    };

    const matchesSearch = (inspection: QualityInspection) => {
      if (!query) return true;
      const haystack = [
        inspection.id,
        inspection.status,
        inspection.activity?.activityName,
        inspection.drawingNo,
        inspection.locationPath,
        inspection.pendingApprovalLabel,
        inspection.pendingApprovalDisplay,
        inspection.workflowSummary?.strategyName,
        inspection.workflowSummary?.processCode,
        inspection.workflowSummary?.documentType,
        ...(inspection.pendingApproverNames || []),
        ...getInspectionScopeTokens(inspection),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    };

    const rows = inspections.filter((inspection) => {
      if (!matchesTab(inspection)) return false;
      if (!matchesSearch(inspection)) return false;
      if (
        selectedBlock !== "All Blocks" &&
        getBlockLabel(inspection) !== selectedBlock
      ) {
        return false;
      }
      if (
        selectedTower !== "All Towers" &&
        getTowerLabel(inspection) !== selectedTower
      ) {
        return false;
      }
      if (
        selectedFloor !== "All Floors" &&
        getFloorLabel(inspection) !== selectedFloor
      ) {
        return false;
      }
      if (
        selectedGo !== "All GOs" &&
        (getGoLabel(inspection) || "Unmapped") !== selectedGo
      ) {
        return false;
      }
      if (
        selectedSlaBucket !== "All" &&
        getSlaBucket(inspection) !== selectedSlaBucket
      ) {
        return false;
      }
      if (showOverdueOnly && getSlaBucket(inspection) !== "Overdue") {
        return false;
      }
      return true;
    });

    const statusWeight = (inspection: QualityInspection) => {
      if (isPendingStatus(inspection.status)) return 0;
      if (isApprovedStatus(inspection.status)) return 1;
      if (inspection.status === "REJECTED") return 2;
      return 3;
    };

    return [...rows].sort((a, b) => {
      switch (selectedSort) {
        case "OLDEST":
          return (
            new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime()
          );
        case "RISK_HIGH":
          return getPriorityScore(b) - getPriorityScore(a);
        case "RISK_LOW":
          return getPriorityScore(a) - getPriorityScore(b);
        case "TOWER":
          return getTowerLabel(a).localeCompare(getTowerLabel(b), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        case "FLOOR":
          return getFloorLabel(a).localeCompare(getFloorLabel(b), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        case "PENDING_LEVEL":
          return (a.pendingApprovalLevel || 999) - (b.pendingApprovalLevel || 999);
        case "STATUS":
          return (
            statusWeight(a) - statusWeight(b) ||
            new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
          );
        case "NEWEST":
        default:
          return (
            new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
          );
      }
    });
  }, [
    filterStatus,
    inspections,
    searchQuery,
    selectedBlock,
    selectedTower,
    selectedFloor,
    selectedGo,
    selectedSlaBucket,
    showOverdueOnly,
    selectedSort,
  ]);

  const approvalMetrics = useMemo(() => {
    const pending = inspections.filter((i) => isPendingStatus(i.status));
    const approved = inspections.filter(
      (i) => i.status === "APPROVED" || i.status === "PROVISIONALLY_APPROVED",
    );
    const rejected = inspections.filter((i) => i.status === "REJECTED");
    const floorMap = new Map<string, QualityInspection[]>();
    inspections.forEach((i) => {
      const floor = getFloorLabel(i);
      const arr = floorMap.get(floor) || [];
      arr.push(i);
      floorMap.set(floor, arr);
    });
    const floorsPending = Array.from(floorMap.values()).filter((rows) =>
      rows.some((x) => isPendingStatus(x.status)),
    ).length;
    const floorsCompleted = Array.from(floorMap.values()).filter(
      (rows) =>
        rows.length > 0 &&
        rows.every(
          (x) =>
            x.status === "APPROVED" || x.status === "PROVISIONALLY_APPROVED",
        ),
    ).length;
    return {
      pending,
      approved,
      rejected,
      floorMap,
      floorsPending,
      floorsCompleted,
    };
  }, [inspections]);

  const dashboardQueue = useMemo(() => {
    let queue = approvalMetrics.pending;
    if (selectedView === "Overdue Focus")
      queue = queue.filter((i) => getSlaBucket(i) === "Overdue");
    if (selectedView === "High Risk")
      queue = queue.filter((i) => getPriorityScore(i) >= 140);
    if (selectedView === "Ready For Closeout")
      queue = queue.filter(
        (i) =>
          (i.stages?.length || 0) > 0 &&
          (i.stages || []).every((s: any) =>
            s.items?.every(
              (it: any) => it.value === "YES" || it.value === "NA" || it.isOk,
            ),
          ) &&
          (i.pendingObservationCount || 0) === 0,
      );
    if (selectedFloor !== "All Floors")
      queue = queue.filter((i) => getFloorLabel(i) === selectedFloor);
    if (selectedSlaBucket !== "All")
      queue = queue.filter((i) => getSlaBucket(i) === selectedSlaBucket);
    if (showOverdueOnly)
      queue = queue.filter((i) => getSlaBucket(i) === "Overdue");
    return [...queue].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
  }, [
    approvalMetrics.pending,
    selectedView,
    selectedFloor,
    selectedSlaBucket,
    showOverdueOnly,
  ]);

  const dashboardStats = useMemo(() => {
    const overdueCount = approvalMetrics.pending.filter(
      (i) => getSlaBucket(i) === "Overdue",
    ).length;
    const due24 = approvalMetrics.pending.filter(
      (i) => getSlaBucket(i) === "Due <24h",
    ).length;
    const due48 = approvalMetrics.pending.filter(
      (i) => getSlaBucket(i) === "Due 24-48h",
    ).length;
    const upcoming = approvalMetrics.pending.filter(
      (i) => getSlaBucket(i) === "Upcoming",
    ).length;
    const missingLocation = inspections.filter(
      (i) => parseLocationHierarchy(i).length === 0,
    ).length;
    const missingWorkflow = inspections.filter(
      (i) => !i.workflowTotalLevels && isPendingStatus(i.status),
    ).length;

    return {
      overdueCount,
      due24,
      due48,
      upcoming,
      missingLocation,
      missingWorkflow,
    };
  }, [approvalMetrics.pending, inspections]);

  const exportRows = useMemo(
    () => (filterStatus === "DASHBOARD" ? dashboardQueue : filteredInspections),
    [dashboardQueue, filterStatus, filteredInspections],
  );

  const dashboardBottlenecks = useMemo(() => {
    const rows = approvalMetrics.pending.map((insp) => {
      const pendingOwner = getPendingApproverDisplay(insp);
      const actorState = insp.workflowSummary?.actorState || "UNSPECIFIED";
      const observationBlocked = (insp.pendingObservationCount || 0) > 0;
      return {
        pendingOwner,
        actorState,
        observationBlocked,
        overdue: getSlaBucket(insp) === "Overdue",
      };
    });

    const byOwner = new Map<
      string,
      { owner: string; total: number; overdue: number; blockedByObservations: number }
    >();

    rows.forEach((row) => {
      const current = byOwner.get(row.pendingOwner) || {
        owner: row.pendingOwner,
        total: 0,
        overdue: 0,
        blockedByObservations: 0,
      };
      current.total += 1;
      if (row.overdue) current.overdue += 1;
      if (row.observationBlocked) current.blockedByObservations += 1;
      byOwner.set(row.pendingOwner, current);
    });

    const stateCounts = {
      actionableNow: rows.filter((row) => row.actorState === "CAN_ACT_NOW").length,
      assignedLater: rows.filter((row) => row.actorState === "ASSIGNED_LATER").length,
      assignedToOthers: rows.filter((row) => row.actorState === "NOT_ASSIGNED").length,
      notActive: rows.filter((row) => row.actorState === "ALREADY_ACTED_OR_NOT_ACTIVE").length,
      blockedByObservations: rows.filter((row) => row.observationBlocked).length,
    };

    return {
      stateCounts,
      ownerRows: Array.from(byOwner.values()).sort((a, b) => {
        if (b.overdue !== a.overdue) return b.overdue - a.overdue;
        return b.total - a.total;
      }),
    };
  }, [approvalMetrics.pending]);

  const detailNavigationRows = useMemo(
    () => (filterStatus === "DASHBOARD" ? dashboardQueue : filteredInspections),
    [dashboardQueue, filterStatus, filteredInspections],
  );

  const selectedInspectionIndex = useMemo(
    () =>
      selectedInspectionId
        ? detailNavigationRows.findIndex((row) => row.id === selectedInspectionId)
        : -1,
    [detailNavigationRows, selectedInspectionId],
  );

  const previousInspection =
    selectedInspectionIndex > 0
      ? detailNavigationRows[selectedInspectionIndex - 1]
      : null;
  const nextInspection =
    selectedInspectionIndex >= 0 &&
    selectedInspectionIndex < detailNavigationRows.length - 1
      ? detailNavigationRows[selectedInspectionIndex + 1]
      : null;

  const openInspectionDetail = (inspectionId: number | null) => {
    if (!inspectionId) return;
    setSelectedInspectionId(inspectionId);
  };

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (document.fullscreenElement !== workspaceRef.current || !selectedInspectionId) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingSurface =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable;
      if (isTypingSurface) {
        return;
      }

      if (event.key === "ArrowLeft" && previousInspection) {
        event.preventDefault();
        setSelectedInspectionId(previousInspection.id);
      }
      if (event.key === "ArrowRight" && nextInspection) {
        event.preventDefault();
        setSelectedInspectionId(nextInspection.id);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [nextInspection, previousInspection, selectedInspectionId]);

  const handleDownloadListReport = () => {
    const suffix =
      filterStatus === "DASHBOARD"
        ? "dashboard_queue"
        : filterStatus.toLowerCase();
    downloadCsv(
      `qc_rfi_report_${suffix}_${projectId || "project"}.csv`,
      [
        "RFI ID",
        "Status",
        "Activity",
        "Block",
        "Tower",
        "Floor",
        "GO",
        "Unit",
        "Room",
        "Drawing",
        "Requested Date",
        "SLA Bucket",
        "Risk Score",
        "Pending Level",
        "Pending Label",
        "Approvals Progress",
        "Stage Approved",
        "Stage Total",
        "Pending Observations",
        "Location Path",
      ],
      exportRows.map((insp) => [
        insp.id,
        insp.status,
        insp.activity?.activityName || `Activity #${insp.activityId}`,
        getBlockLabel(insp),
        getTowerLabel(insp),
        getFloorLabel(insp),
        getGoLabel(insp) || "",
        getUnitLabel(insp),
        getRoomLabel(insp),
        insp.drawingNo || "",
        insp.requestDate,
        getSlaBucket(insp),
        getPriorityScore(insp),
        insp.pendingApprovalLevel || "",
        insp.pendingApprovalDisplay || insp.pendingApprovalLabel || "",
        insp.workflowSummary?.pendingStep?.minApprovalsRequired
          ? `${insp.workflowSummary?.pendingStep?.currentApprovalCount || 0}/${insp.workflowSummary?.pendingStep?.minApprovalsRequired}`
          : "",
        insp.stageApprovalSummary?.approvedStages || 0,
        insp.stageApprovalSummary?.totalStages || 0,
        insp.pendingObservationCount || 0,
        insp.locationPath || parseLocationHierarchy(insp).join(" > "),
      ]),
    );
  };

  const handleDownloadTowerSummary = () => {
    const grouped = new Map<
      string,
      {
        block: string;
        tower: string;
        floor: string;
        total: number;
        pending: number;
        partial: number;
        approved: number;
        rejected: number;
      }
    >();

    exportRows.forEach((insp) => {
      const block = getBlockLabel(insp);
      const tower = getTowerLabel(insp);
      const floor = getFloorLabel(insp);
      const key = `${block}__${tower}__${floor}`;
      const current = grouped.get(key) || {
        block,
        tower,
        floor,
        total: 0,
        pending: 0,
        partial: 0,
        approved: 0,
        rejected: 0,
      };
      current.total += 1;
      if (insp.status === "PARTIALLY_APPROVED") current.partial += 1;
      if (isPendingStatus(insp.status)) current.pending += 1;
      if (isApprovedStatus(insp.status)) current.approved += 1;
      if (insp.status === "REJECTED") current.rejected += 1;
      grouped.set(key, current);
    });

    downloadCsv(
      `qc_tower_summary_${projectId || "project"}.csv`,
      [
        "Block",
        "Tower",
        "Floor",
        "Total RFIs",
        "Pending RFIs",
        "Partial Approvals",
        "Approved RFIs",
        "Rejected RFIs",
        "Completion %",
      ],
      Array.from(grouped.values())
        .sort((a, b) =>
          `${a.block} ${a.tower} ${a.floor}`.localeCompare(
            `${b.block} ${b.tower} ${b.floor}`,
            undefined,
            { numeric: true, sensitivity: "base" },
          ),
        )
        .map((row) => [
          row.block,
          row.tower,
          row.floor,
          row.total,
          row.pending,
          row.partial,
          row.approved,
          row.rejected,
          row.total > 0 ? `${Math.round((row.approved / row.total) * 100)}%` : "0%",
        ]),
    );
  };

  const handleDownloadBottleneckReport = () => {
    downloadCsv(
      `qc_bottlenecks_${projectId || "project"}.csv`,
      ["Pending Owner", "Pending RFIs", "Overdue", "Blocked By Observations"],
      dashboardBottlenecks.ownerRows.map((row) => [
        row.owner,
        row.total,
        row.overdue,
        row.blockedByObservations,
      ]),
    );
  };

  const focusQueue = (
    tab: ApprovalTab,
    options?: {
      selectedView?: SavedView;
      overdueOnly?: boolean;
      slaBucket?: SlaBucket;
      tower?: string;
      floor?: string;
      go?: string;
    },
  ) => {
    setSelectedInspectionId(null);
    setFilterStatus(tab);
    if (options?.selectedView) setSelectedView(options.selectedView);
    if (typeof options?.overdueOnly === "boolean") {
      setShowOverdueOnly(options.overdueOnly);
    }
    if (options?.slaBucket) setSelectedSlaBucket(options.slaBucket);
    if (options?.tower) setSelectedTower(options.tower);
    if (options?.floor) setSelectedFloor(options.floor);
    if (options?.go) setSelectedGo(options.go);
  };

  const locationSummaryRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        block: string;
        tower: string;
        floor: string;
        total: number;
        pending: number;
        partial: number;
        approved: number;
        rejected: number;
      }
    >();

    exportRows.forEach((insp) => {
      const block = getBlockLabel(insp);
      const tower = getTowerLabel(insp);
      const floor = getFloorLabel(insp);
      const key = `${block}__${tower}__${floor}`;
      const current = grouped.get(key) || {
        block,
        tower,
        floor,
        total: 0,
        pending: 0,
        partial: 0,
        approved: 0,
        rejected: 0,
      };
      current.total += 1;
      if (isPendingStatus(insp.status)) current.pending += 1;
      if (insp.status === "PARTIALLY_APPROVED") current.partial += 1;
      if (isApprovedStatus(insp.status)) current.approved += 1;
      if (insp.status === "REJECTED") current.rejected += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        completion:
          row.total > 0 ? Math.round((row.approved / row.total) * 100) : 0,
      }))
      .sort((a, b) => {
        if (b.pending !== a.pending) return b.pending - a.pending;
        if (b.partial !== a.partial) return b.partial - a.partial;
        return `${a.block} ${a.tower} ${a.floor}`.localeCompare(
          `${b.block} ${b.tower} ${b.floor}`,
          undefined,
          { numeric: true, sensitivity: "base" },
        );
      });
  }, [exportRows]);

  const reportSourceRows = useMemo(() => {
    const fromTime = reportDateFrom
      ? new Date(`${reportDateFrom}T00:00:00`).getTime()
      : null;
    const toTime = reportDateTo
      ? new Date(`${reportDateTo}T23:59:59`).getTime()
      : null;

    return exportRows.filter((insp) => {
      const requestTime = new Date(insp.requestDate).getTime();
      if (fromTime != null && requestTime < fromTime) return false;
      if (toTime != null && requestTime > toTime) return false;
      return true;
    });
  }, [exportRows, reportDateFrom, reportDateTo]);

  const reportPreview = useMemo(() => {
    const makeDate = (value?: string) =>
      value ? new Date(value).toLocaleDateString() : "-";
    const makeDaysOpen = (value?: string) =>
      value
        ? Math.max(
            0,
            Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
          )
        : 0;

    if (selectedReportPreset === "PARTIAL_TRACKER") {
      const rows = reportSourceRows
        .filter((insp) => insp.status === "PARTIALLY_APPROVED")
        .sort(
          (a, b) =>
            new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime(),
        )
        .map((insp) => [
          insp.id,
          insp.activity?.activityName || `Activity #${insp.activityId}`,
          getBlockLabel(insp),
          getTowerLabel(insp),
          getFloorLabel(insp),
          getGoLabel(insp) || "-",
          insp.pendingApprovalDisplay ||
            (insp.pendingApprovalLevel
              ? `Level ${insp.pendingApprovalLevel}`
              : "Pending"),
          getPendingApproverDisplay(insp),
          insp.pendingObservationCount || 0,
          makeDate(insp.requestDate),
          makeDaysOpen(insp.requestDate),
        ]);
      return {
        title: "Partial Approval Tracker",
        subtitle: "RFIs that are still active after partial progress.",
        headers: [
          "RFI",
          "Activity",
          "Block",
          "Tower",
          "Floor",
          "GO",
          "Pending Level",
          "Current Approver",
          "Open Obs",
          "Request Date",
          "Days Open",
        ],
        rows,
      };
    }

    if (selectedReportPreset === "LEVEL_PENDING") {
      const grouped = new Map<
        string,
        {
          level: string;
          label: string;
          total: number;
          actionable: number;
          assignedLater: number;
          blockedByObs: number;
          overdue: number;
        }
      >();
      reportSourceRows
        .filter((insp) => isPendingStatus(insp.status))
        .forEach((insp) => {
          const level = insp.pendingApprovalLevel
            ? `Level ${insp.pendingApprovalLevel}`
            : "No Active Level";
          const label = insp.pendingApprovalLabel?.trim() || "-";
          const key = `${level}__${label}`;
          const bucket = grouped.get(key) || {
            level,
            label,
            total: 0,
            actionable: 0,
            assignedLater: 0,
            blockedByObs: 0,
            overdue: 0,
          };
          bucket.total += 1;
          if (insp.workflowSummary?.currentUserCanApprove) bucket.actionable += 1;
          if (insp.workflowSummary?.actorState === "ASSIGNED_LATER") {
            bucket.assignedLater += 1;
          }
          if ((insp.pendingObservationCount || 0) > 0) bucket.blockedByObs += 1;
          if (getSlaBucket(insp) === "Overdue") bucket.overdue += 1;
          grouped.set(key, bucket);
        });
      return {
        title: "Approval Level Pending Summary",
        subtitle: "Pending RFIs grouped by live approval level.",
        headers: [
          "Level",
          "Label",
          "Pending RFIs",
          "Actionable Now",
          "Assigned Later",
          "Obs Blocked",
          "Overdue",
        ],
        rows: Array.from(grouped.values())
          .sort((a, b) => a.level.localeCompare(b.level, undefined, { numeric: true }))
          .map((row) => [
            row.level,
            row.label,
            row.total,
            row.actionable,
            row.assignedLater,
            row.blockedByObs,
            row.overdue,
          ]),
      };
    }

    if (selectedReportPreset === "OBS_AGEING") {
      const rows = reportSourceRows
        .filter((insp) => (insp.pendingObservationCount || 0) > 0)
        .sort((a, b) => (b.pendingObservationCount || 0) - (a.pendingObservationCount || 0))
        .map((insp) => [
          insp.id,
          insp.activity?.activityName || `Activity #${insp.activityId}`,
          getTowerLabel(insp),
          getFloorLabel(insp),
          getGoLabel(insp) || "-",
          insp.pendingObservationCount || 0,
          getSlaBucket(insp),
          makeDaysOpen(insp.requestDate),
          insp.workflowSummary?.currentUserCanApprove
            ? insp.workflowSummary.currentUserActionHint || "Your approval is active now."
            : insp.workflowSummary?.currentUserBlockedReason ||
              insp.workflowSummary?.currentUserActionHint ||
              "-",
        ]);
      return {
        title: "Open Observation Ageing",
        subtitle: "RFIs with unresolved observations and their current ageing pressure.",
        headers: [
          "RFI",
          "Activity",
          "Tower",
          "Floor",
          "GO",
          "Open Obs",
          "SLA Bucket",
          "Days Open",
          "Action Summary",
        ],
        rows,
      };
    }

    if (selectedReportPreset === "BOTTLENECKS") {
      return {
        title: "Approver Bottleneck Summary",
        subtitle: "Pending load by current owner, with overdue and observation blockers.",
        headers: [
          "Pending Owner",
          "Pending RFIs",
          "Overdue",
          "Blocked By Observations",
        ],
        rows: dashboardBottlenecks.ownerRows.map((row) => [
          row.owner,
          row.total,
          row.overdue,
          row.blockedByObservations,
        ]),
      };
    }

    if (selectedReportPreset === "VENDOR_PERFORMANCE") {
      const grouped = new Map<
        string,
        {
          name: string;
          total: number;
          pending: number;
          partial: number;
          approved: number;
          rejected: number;
        }
      >();
      reportSourceRows.forEach((insp) => {
        const name = getCounterpartyLabel(insp);
        const bucket = grouped.get(name) || {
          name,
          total: 0,
          pending: 0,
          partial: 0,
          approved: 0,
          rejected: 0,
        };
        bucket.total += 1;
        if (isPendingStatus(insp.status)) bucket.pending += 1;
        if (insp.status === "PARTIALLY_APPROVED") bucket.partial += 1;
        if (isApprovedStatus(insp.status)) bucket.approved += 1;
        if (insp.status === "REJECTED") bucket.rejected += 1;
        grouped.set(name, bucket);
      });
      return {
        title: "Contractor / Vendor QA Performance",
        subtitle: "Operational completion view grouped by responsible external team.",
        headers: [
          "Contractor / Vendor",
          "Total RFIs",
          "Pending",
          "Partial",
          "Approved",
          "Rejected",
          "Completion %",
        ],
        rows: Array.from(grouped.values())
          .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
          .map((row) => [
            row.name,
            row.total,
            row.pending,
            row.partial,
            row.approved,
            row.rejected,
            row.total > 0 ? `${Math.round((row.approved / row.total) * 100)}%` : "0%",
          ]),
      };
    }

    const grouped = new Map<
      string,
      {
        block: string;
        tower: string;
        floor: string;
        total: number;
        pending: number;
        partial: number;
        approved: number;
        rejected: number;
      }
    >();
    reportSourceRows.forEach((insp) => {
      const block = getBlockLabel(insp);
      const tower = getTowerLabel(insp);
      const floor = getFloorLabel(insp);
      const key = `${block}__${tower}__${floor}`;
      const bucket = grouped.get(key) || {
        block,
        tower,
        floor,
        total: 0,
        pending: 0,
        partial: 0,
        approved: 0,
        rejected: 0,
      };
      bucket.total += 1;
      if (isPendingStatus(insp.status)) bucket.pending += 1;
      if (insp.status === "PARTIALLY_APPROVED") bucket.partial += 1;
      if (isApprovedStatus(insp.status)) bucket.approved += 1;
      if (insp.status === "REJECTED") bucket.rejected += 1;
      grouped.set(key, bucket);
    });
    return {
      title: "Pending vs Completed by Block / Tower / Floor",
      subtitle: "Meeting-ready location summary for the current QA/QC filter scope.",
      headers: [
        "Block",
        "Tower",
        "Floor",
        "Total RFIs",
        "Pending RFIs",
        "Partial Approvals",
        "Approved RFIs",
        "Rejected RFIs",
        "Completion %",
      ],
      rows: Array.from(grouped.values())
        .sort((a, b) =>
          `${a.block} ${a.tower} ${a.floor}`.localeCompare(
            `${b.block} ${b.tower} ${b.floor}`,
            undefined,
            { numeric: true, sensitivity: "base" },
          ),
        )
        .map((row) => [
          row.block,
          row.tower,
          row.floor,
          row.total,
          row.pending,
          row.partial,
          row.approved,
          row.rejected,
          row.total > 0 ? `${Math.round((row.approved / row.total) * 100)}%` : "0%",
        ]),
    };
  }, [
    dashboardBottlenecks.ownerRows,
    reportDateFrom,
    reportDateTo,
    reportSourceRows,
    selectedReportPreset,
  ]);

  const handleDownloadReportPreview = () => {
    downloadCsv(
      `qc_${selectedReportPreset.toLowerCase()}_${projectId || "project"}.csv`,
      reportPreview.headers,
      reportPreview.rows,
    );
  };

  const isDashboardMode = filterStatus === "DASHBOARD" && !selectedInspectionId;

  useEffect(() => {
    if (filterStatus !== "DASHBOARD" && document.fullscreenElement === workspaceRef.current) {
      void document.exitFullscreen();
    }
  }, [filterStatus]);

  const filteredObservations = useMemo(() => {
    if (obsTab === "PENDING")
      return observations.filter(
        (o) => o.status === "PENDING" || o.status === "OPEN",
      );
    if (obsTab === "RECTIFIED")
      return observations.filter(
        (o) => o.status === "RECTIFIED" || o.status === "RESOLVED",
      );
    if (obsTab === "CLOSED")
      return observations.filter((o) => o.status === "CLOSED");
    return observations;
  }, [observations, obsTab]);

  const filteredLegacyObservations = useMemo(() => {
    if (obsTab === "PENDING")
      return legacyObservations.filter(
        (o) => o.status === "PENDING" || o.status === "OPEN",
      );
    if (obsTab === "RECTIFIED")
      return legacyObservations.filter(
        (o) => o.status === "RECTIFIED" || o.status === "RESOLVED",
      );
    if (obsTab === "CLOSED")
      return legacyObservations.filter((o) => o.status === "CLOSED");
    return legacyObservations;
  }, [legacyObservations, obsTab]);

  const getDaysOpen = (createdAt: string) => {
    const days = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 86400000,
    );
    if (days === 0) return { text: "Today", color: "text-success" };
    if (days === 1) return { text: "1 day ago", color: "text-success" };
    if (days <= 3) return { text: `${days} days ago`, color: "text-success" };
    if (days <= 7) return { text: `${days} days ago`, color: "text-warning" };
    return { text: `${days} days ago`, color: "text-error font-bold" };
  };

  const handleItemValueChange = (itemId: number, val: string) => {
    setInspectionDetail((prev: any) => {
      if (!prev) return prev;
      const newStages = prev.stages.map((stage: any) => ({
        ...stage,
        items: stage.items.map((item: any) =>
          item.id === itemId
            ? { ...item, value: val, isOk: val === "YES" || val === "NA" }
            : item,
        ),
      }));
      return { ...prev, stages: newStages };
    });
  };

  const handleItemRemarksChange = (itemId: number, val: string) => {
    setInspectionDetail((prev: any) => {
      if (!prev) return prev;
      const newStages = prev.stages.map((stage: any) => ({
        ...stage,
        items: stage.items.map((item: any) =>
          item.id === itemId ? { ...item, remarks: val } : item,
        ),
      }));
      return { ...prev, stages: newStages };
    });
  };

  const itemIsChecked = (item: any) =>
    item?.value === "YES" || item?.value === "NA" || item?.isOk;

  const getApiErrorMessage = (err: any, fallback: string) => {
    const message = err?.response?.data?.message;
    if (Array.isArray(message)) {
      return message.filter(Boolean).join(", ") || fallback;
    }
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
    if (typeof err?.message === "string" && err.message.trim()) {
      return err.message.trim();
    }
    return fallback;
  };

  const getStageApprovalActionReason = (stage: any) => {
    if (!canApproveInspection) {
      return "You do not have approval permission for this checklist stage.";
    }
    if (isStageApproved(stage)) {
      return "This stage is already approved and locked.";
    }
    if (inspectionDetail?.isLocked) {
      return "This RFI is locked after approval.";
    }
    if (!isStageChecklistComplete(stage)) {
      return "Complete all checklist items in this stage before approval.";
    }
    if (getStagePendingObservationCount(stage.id) > 0) {
      return "Close all observations for this stage before approval.";
    }
    if (inspectionDetail?.workflowSummary?.currentUserCanApprove === false) {
      return (
        inspectionDetail?.workflowSummary?.currentUserBlockedReason ||
        "Your approval is not active at the current level."
      );
    }
    return null;
  };

  const getStageActionLabel = (stage: any) => {
    const pendingDisplay = stage?.stageApproval?.pendingDisplay;
    if (pendingDisplay?.trim()) {
      return `Approve ${pendingDisplay.trim()}`;
    }
    return "Approve Stage";
  };

  const getStageStatusChips = (stage: any) => {
    const chips: Array<{ label: string; className: string }> = [];
    const stageApproval = stage?.stageApproval;
    const blockerReason = getStageApprovalActionReason(stage);
    const pendingObservations = getStagePendingObservationCount(stage.id);
    const checklistComplete = isStageChecklistComplete(stage);

    if (stageApproval?.fullyApproved || isStageApproved(stage)) {
      chips.push({
        label: "Stage Approved",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      });
    } else if (stageApproval?.pendingDisplay) {
      chips.push({
        label: `Waiting: ${stageApproval.pendingDisplay}`,
        className: "border-amber-200 bg-warning-muted text-amber-800",
      });
    } else {
      chips.push({
        label: "Approval Pending",
        className: "border-blue-200 bg-blue-50 text-blue-800",
      });
    }

    chips.push({
      label: checklistComplete ? "Checklist Complete" : "Checklist Incomplete",
      className: checklistComplete
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-surface-raised text-text-secondary",
    });

    if (pendingObservations > 0) {
      chips.push({
        label: `${pendingObservations} Observation${pendingObservations > 1 ? "s" : ""} Open`,
        className: "border-red-200 bg-red-50 text-red-800",
      });
    }

    if (stageApproval?.activeLevel) {
      chips.push({
        label: `Active Level ${stageApproval.activeLevel}`,
        className: "border-indigo-200 bg-indigo-50 text-indigo-800",
      });
    }

    if (currentWorkflowStep?.canDelegate) {
      chips.push({
        label: "Delegation Enabled",
        className: "border-violet-200 bg-violet-50 text-violet-800",
      });
    }

    if (
      blockerReason &&
      inspectionDetail?.workflowSummary?.currentUserCanApprove === false
    ) {
      chips.push({
        label: "Blocked For You",
        className: "border-blue-200 bg-blue-50 text-blue-800",
      });
    }

    return chips;
  };

  const getInspectionActionSummary = (inspection: QualityInspection) => {
    if (inspection.workflowSummary?.currentUserCanApprove) {
      return inspection.workflowSummary.currentUserActionHint || "Your approval is active now.";
    }
    return (
      inspection.workflowSummary?.currentUserBlockedReason ||
      inspection.workflowSummary?.currentUserActionHint ||
      null
    );
  };

  const updateStage = async (stageId: number, payload: Record<string, any>) => {
    const stageInspectionId =
      inspectionDetail?.id ||
      inspections.find((entry) =>
        (entry.stages || []).some((stage: any) => stage.id === stageId),
      )?.id;

    const attempts: Array<{ method: "patch" | "post"; url: string }> = [];

    if (stageInspectionId) {
      attempts.push(
        {
          method: "patch",
          url: `/quality/inspections/${stageInspectionId}/stages/${stageId}`,
        },
        {
          method: "post",
          url: `/quality/inspections/${stageInspectionId}/stages/${stageId}`,
        },
      );

      if (payload.status === "APPROVED" && payload.signature?.data) {
        attempts.push({
          method: "post",
          url: `/quality/inspections/${stageInspectionId}/stages/${stageId}/approve`,
        });
      }
    }

    attempts.push(
      { method: "patch", url: `/quality/inspections/stage/${stageId}` },
      { method: "post", url: `/quality/inspections/stage/${stageId}` },
    );

    let lastError: any = null;
    for (const attempt of attempts) {
      try {
        if (attempt.method === "patch") {
          return await api.patch(attempt.url, payload);
        }
        return await api.post(attempt.url, payload);
      } catch (err: any) {
        lastError = err;
        if (err?.response?.status !== 404) {
          throw err;
        }
      }
    }

    throw lastError;
  };

  const approveStageWithSignature = async (
    inspectionId: number,
    stageId: number,
    signatureData: string,
  ) => {
    return api.post(`/quality/inspections/${inspectionId}/stages/${stageId}/approve`, {
      signatureData,
      comments: "Stage approved from checklist stage action",
    });
  };

  const persistStageBeforeApproval = async (stage: any) => {
    const checkedCount = (stage.items || []).filter((it: any) =>
      itemIsChecked(it),
    ).length;
    const totalCount = stage.items?.length || 0;

    let stageStatus = stage.status;
    if (checkedCount > 0 && checkedCount < totalCount) {
      stageStatus = "IN_PROGRESS";
    } else if (checkedCount === totalCount && totalCount > 0) {
      stageStatus = "COMPLETED";
    }

    await updateStage(stage.id, {
      status: stageStatus,
      items: (stage.items || []).map((it: any) => ({
        id: it.id,
        value: it.value,
        isOk: itemIsChecked(it),
        remarks: it.remarks,
      })),
    });
  };

  const fetchEligibleUsers = async () => {
    try {
      const res = await api.get("/quality/inspections/eligible-approvers/list", {
        params: { projectId },
      });
      setEligibleUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const handleDelegate = async () => {
    if (!selectedDelegateId || !selectedInspectionId || !workflowState) return;
    setDelegating(true);
    try {
      await api.post(
        `/quality/inspections/${selectedInspectionId}/workflow/delegate`,
        {
          targetUserId: selectedDelegateId,
          comments: "Delegated via UI",
        },
      );
      setShowDelegationModal(false);
      // Refresh
      const [inspRes, wfRes] = await Promise.all([
        api.get(`/quality/inspections/${selectedInspectionId}`),
        api.get(`/quality/inspections/${selectedInspectionId}/workflow`),
      ]);
      setInspectionDetail(inspRes.data);
      setWorkflowState(wfRes.data);
      alert("Step successfully delegated.");
    } catch (err: any) {
      alert(getApiErrorMessage(err, "Delegation failed."));
    } finally {
      setDelegating(false);
    }
  };
  const handleApproveStage = async (stage: any) => {
    if (!canApproveInspection) {
      alert("You do not have permission to approve this stage.");
      return;
    }
    if (!isStageChecklistComplete(stage)) {
      alert("Complete all checklist items in this stage before approving it.");
      return;
    }
    setActiveStageId(stage.id);
    setShowFinalApproveSig(true);
  };

  const executeFinalApprove = async (signatureData: string) => {
    try {
      if (activeStageId != null && inspectionDetail) {
        const targetStage = (inspectionDetail.stages || []).find(
          (stage: any) => stage.id === activeStageId,
        );
        if (targetStage) {
          await persistStageBeforeApproval(targetStage);
        }
        await approveStageWithSignature(
          inspectionDetail.id,
          activeStageId,
          signatureData,
        );
        alert("Stage approved successfully.");
        setShowFinalApproveSig(false);
        setActiveStageId(null);
        setRefreshKey((k) => k + 1);
        return;
      }

      throw new Error(
        "Checklist approval is automatic once all stages complete all required approval levels.",
      );
    } catch (err: any) {
      alert(getApiErrorMessage(err, "Failed to approve RFI."));
      setActiveStageId(null);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Please enter rejection reason:");
    if (reason === null) return;

    try {
      // Save checklist progress first
      for (const stage of inspectionDetail.stages) {
        await updateStage(stage.id, {
          status: "REJECTED",
          items: stage.items.map((it: any) => ({
            id: it.id,
            value: it.value,
            isOk: it.isOk,
            remarks: it.remarks,
          })),
        });
      }

      if (workflowState && workflowState.status === "IN_PROGRESS") {
        await api.post(
          `/quality/inspections/${inspectionDetail.id}/workflow/reject`,
          {
            comments: reason || "Rejected during checklist execution",
          },
        );
      } else {
        await api.patch(`/quality/inspections/${inspectionDetail.id}/status`, {
          status: "REJECTED",
          comments: reason || "Rejected during checklist execution",
          inspectionDate: new Date().toISOString().split("T")[0],
        });
      }
      alert("RFI rejected.");
      setSelectedInspectionId(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(getApiErrorMessage(err, "Failed to reject RFI."));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCurrentPhotos((prev) => [...prev, res.data.url]);
    } catch (err: any) {
      alert(getApiErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };


  const handleRaiseObservation = async () => {
    if (!obsText.trim()) return;
    setSavingObs(true);
    try {
      await api.post(
        `/quality/activities/${inspectionDetail.activityId}/observation`,
        {
          observationText: obsText,
          type: obsType,
          photos: currentPhotos,
          inspectionId: inspectionDetail.id,
          stageId: selectedObservationStageId,
        },
      );
      alert("Observation Raised.");
      setObsText("");
      setCurrentPhotos([]);
      setSelectedObservationStageId(null);
      // Refresh to show in the list inside the modal
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to raise observation.");
    } finally {
      setSavingObs(false);
    }
  };

  const handleCloseObservation = async (obsId: string) => {
    if (!confirm("Verify and close this observation?")) return;
    try {
      await api.patch(
        `/quality/activities/${inspectionDetail.activityId}/observation/${obsId}/close`,
      );
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to close observation.");
    }
  };

  const handleResolveObservationUpload = async (
    obsId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResolveUploadingId(obsId);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResolutionPhotos((prev) => ({
        ...prev,
        [obsId]: [...(prev[obsId] || []), res.data.url],
      }));
    } catch (err: any) {
      alert(getApiErrorMessage(err, "Upload failed"));
    } finally {
      setResolveUploadingId(null);
      e.target.value = "";
    }
  };

  const handleResolveObservation = async (obsId: string) => {
    const closureText = resolutionTexts[obsId]?.trim();
    if (!closureText) {
      alert("Please enter rectification details before submitting.");
      return;
    }

    setResolvingId(obsId);
    try {
      await api.patch(
        `/quality/activities/${inspectionDetail.activityId}/observation/${obsId}/resolve`,
        {
          closureText,
          closureEvidence: resolutionPhotos[obsId] || [],
        },
      );
      setResolutionTexts((prev) => {
        const next = { ...prev };
        delete next[obsId];
        return next;
      });
      setResolutionPhotos((prev) => {
        const next = { ...prev };
        delete next[obsId];
        return next;
      });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to submit rectification.");
    } finally {
      setResolvingId(null);
    }
  };

  const handleDeleteObservation = async (obsId: string) => {
    if (!confirm("Permanently delete this observation?")) return;
    try {
      await api.delete(
        `/quality/activities/${inspectionDetail.activityId}/observation/${obsId}`,
      );
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete observation.");
    }
  };

  const pendingObservationsCount = useMemo(() => {
    return observations.filter((o) => o.status !== "CLOSED").length;
  }, [observations]);

  const cardReadiness = useMemo(() => {
    const requiresPourCard = Boolean(inspectionDetail?.activity?.requiresPourCard);
    const requiresPrePourClearance = Boolean(
      inspectionDetail?.activity?.requiresPourClearanceCard,
    );
    const pourCardReady = !requiresPourCard
      ? true
      : ["SUBMITTED", "LOCKED"].includes(pourCard?.status || "");
    const prePourClearanceReady = !requiresPrePourClearance
      ? true
      : ["SUBMITTED", "LOCKED"].includes(prePourClearanceCard?.status || "");

    return {
      requiresPourCard,
      requiresPrePourClearance,
      pourCardReady,
      prePourClearanceReady,
      allReady: pourCardReady && prePourClearanceReady,
    };
  }, [
    inspectionDetail?.activity?.requiresPourCard,
    inspectionDetail?.activity?.requiresPourClearanceCard,
    pourCard?.status,
    prePourClearanceCard?.status,
  ]);

  const getStagePendingObservationCount = (stageId: number) =>
    observations.filter(
      (o) => o.stageId === stageId && o.status !== "CLOSED",
    ).length;

  const formatSignatureMeta = (signature: any) => {
    const bits = [
      signature?.signerDisplayName || signature?.signedBy,
      signature?.signerCompany,
      signature?.signerRoleLabel || signature?.signerRole,
    ].filter(Boolean);
    return bits.join(" - ");
  };

  const formatSignatureAction = (signature: any) => {
    if (!signature?.actionType) return "Signed";
    if (signature.actionType === "SAVE_PROGRESS") return "Progress Signed";
    if (signature.actionType === "STAGE_APPROVE") return "Stage Approved";
    if (signature.actionType === "FINAL_APPROVE") return "Final Approved";
    return signature.actionType.replaceAll("_", " ");
  };

  const approvalHistory = useMemo(() => {
    if (!inspectionDetail) return [];

    const workflowEntries = (
      inspectionDetail.workflowSummary?.completedSteps || []
    ).map((step: any) => ({
      key: `workflow-${step.stepOrder}`,
      scope: "Workflow Level",
      title: `Level ${step.stepOrder}: ${step.stepName || "Approval Step"}`,
      action:
        (step.minApprovalsRequired || 1) > 1
          ? `Workflow Approved (${step.currentApprovalCount || 0}/${step.minApprovalsRequired})`
          : "Workflow Approved",
      meta: [step.signerDisplayName, step.signerCompany, step.signerRole]
        .filter(Boolean)
        .join(" - "),
      at: step.completedAt || null,
      status: "COMPLETED",
    }));

    const stageEntries = (inspectionDetail.stages || []).flatMap((stage: any) =>
      (stage.signatures || []).map((signature: any, index: number) => ({
        key: `stage-${stage.id}-${index}`,
        scope: "Stage",
        title: stage.stageTemplate?.name || `Stage ${stage.id}`,
        action: formatSignatureAction(signature),
        meta: formatSignatureMeta(signature),
        at: signature.signedAt || signature.createdAt || null,
        status: signature.isReversed ? "REVERSED" : "SIGNED",
      })),
    );

    return [...workflowEntries, ...stageEntries].sort((a, b) => {
      const aTime = a.at ? new Date(a.at).getTime() : 0;
      const bTime = b.at ? new Date(b.at).getTime() : 0;
      return bTime - aTime;
    });
  }, [inspectionDetail]);

  const currentWorkflowStep = useMemo(() => {
    if (!workflowState?.steps?.length || !workflowState?.currentStepOrder) return null;
    return workflowState.steps.find(
      (step: any) => step.stepOrder === workflowState.currentStepOrder,
    );
  }, [workflowState]);

  const activeApproverSummary = useMemo(() => {
    if (!inspectionDetail) return null;
    const pendingStep = inspectionDetail.workflowSummary?.pendingStep;
    const activeLevel = pendingStep?.stepOrder || inspectionDetail.pendingApprovalLevel || null;
    const currentCount = pendingStep?.currentApprovalCount || 0;
    const requiredCount = pendingStep?.minApprovalsRequired || 1;
    const pendingApproverText = getPendingApproverDisplay(inspectionDetail);

    return {
      title:
        activeLevel != null
          ? `Level ${activeLevel}${inspectionDetail.pendingApprovalLabel ? ` - ${inspectionDetail.pendingApprovalLabel}` : ""}`
          : "Approval workflow complete",
      subtitle:
        activeLevel != null
          ? pendingApproverText
          : "No pending approver remains on this RFI.",
      quorumText:
        activeLevel != null && requiredCount > 1
          ? `${currentCount}/${requiredCount} approvals received`
          : activeLevel != null
            ? currentCount > 0
              ? `${currentCount} approval recorded at this level`
              : "Waiting for the first approval at this level"
            : "All configured levels are already complete",
    };
  }, [inspectionDetail]);

  const workflowReasonChips = useMemo(() => {
    if (!inspectionDetail) return [];
    const summary = inspectionDetail.workflowSummary;
    const chips: Array<{ label: string; className: string }> = [];
    const badge = getWorkflowStateBadge(inspectionDetail);
    if (badge) {
      chips.push({
        label: badge.label,
        className: `${badge.className} border-transparent`,
      });
    }
    if (inspectionDetail.pendingApprovalLevel) {
      chips.push({
        label: `Active Level ${inspectionDetail.pendingApprovalLevel}`,
        className: "border-amber-200 bg-warning-muted text-amber-800",
      });
    }
    if ((summary?.currentUserFutureLevels || []).length > 0) {
      chips.push({
        label: `Your Next Level ${summary?.currentUserFutureLevels?.[0]}`,
        className: "border-blue-200 bg-blue-50 text-blue-800",
      });
    }
    if ((summary?.pendingStep?.minApprovalsRequired || 1) > 1) {
      chips.push({
        label: `Quorum ${summary?.pendingStep?.currentApprovalCount || 0}/${summary?.pendingStep?.minApprovalsRequired}`,
        className: "border-indigo-200 bg-indigo-50 text-indigo-800",
      });
    }
    if (currentWorkflowStep?.canDelegate) {
      chips.push({
        label: "Delegation Enabled",
        className: "border-violet-200 bg-violet-50 text-violet-800",
      });
    }
    if (
      typeof currentWorkflowStep?.comments === "string" &&
      currentWorkflowStep.comments.toLowerCase().includes("delegat")
    ) {
      chips.push({
        label: "Delegated",
        className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
      });
    }
    return chips;
  }, [currentWorkflowStep, inspectionDetail]);

  return (
    <>
      <div
        ref={workspaceRef}
        className="h-full flex flex-col bg-surface-base"
        style={{
          backgroundColor: "var(--color-surface-base)",
          color: "var(--color-text-primary)",
          colorScheme: "inherit",
        }}
      >
        {/* Header */}
        <header
          className={`bg-surface-card border-b flex justify-between items-center sticky top-0 z-10 shrink-0 gap-4 ${
            selectedInspectionId ? "px-5 py-2.5" : "px-6 py-4"
          }`}
        >
          <div>
            <h1
              className={`font-bold text-text-primary flex items-center gap-2 ${
                selectedInspectionId ? "text-lg" : "text-xl"
              }`}
            >
              <ShieldCheck className="w-5 h-5 text-secondary" />
              QA/QC Approvals
            </h1>
            {!selectedInspectionId ? (
              <p className="text-sm text-text-muted mt-1">
                Review Requests for Inspection (RFI) and execute checklists.
              </p>
            ) : (
              <p className="text-xs text-text-muted mt-0.5">
                Focus mode for checklist execution
              </p>
            )}
          </div>
          {selectedInspectionId ? (
            <button
              onClick={() => setSelectedInspectionId(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-base px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
            >
              <ChevronLeft className="w-4 h-4" />
              Back To List
            </button>
          ) : null}
        </header>

        {!selectedInspectionId ? (
          <div className="bg-surface-card border-b px-6 py-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              {APPROVAL_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filterStatus === tab.key
                      ? "bg-secondary text-white shadow-sm"
                      : "bg-surface-raised text-text-secondary hover:bg-gray-200"
                  }`}
                  onClick={() => void handleApprovalTabClick(tab.key)}
                  title={
                    tab.key === "DASHBOARD" && filterStatus === "DASHBOARD" && !selectedInspectionId
                      ? dashboardFullscreen
                        ? "Click to exit fullscreen dashboard"
                        : "Click again to open the dashboard in fullscreen"
                      : undefined
                  }
                >
                  {tab.label}
                  {tab.key === "DASHBOARD" && filterStatus === "DASHBOARD" && !selectedInspectionId
                    ? dashboardFullscreen
                      ? " · Fullscreen"
                      : ""
                    : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Panel: List of RFIs */}
          <aside
            className={`${isDashboardMode ? "hidden" : selectedInspectionId ? "hidden" : "flex"} w-[440px] border-r bg-surface-card flex-col shrink-0 flex-grow-0`}
          >
            <div className="p-4 border-b space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-warning-muted border border-amber-100 rounded-lg px-2 py-1.5">
                  <div className="text-amber-700 font-bold">
                    {approvalMetrics.pending.length}
                  </div>
                  <div className="text-amber-800/80">Pending</div>
                </div>
                <div className="bg-success-muted border border-emerald-100 rounded-lg px-2 py-1.5">
                  <div className="text-emerald-700 font-bold">
                    {approvalMetrics.approved.length}
                  </div>
                  <div className="text-emerald-800/80">Approved</div>
                </div>
                <div className="bg-error-muted border border-red-100 rounded-lg px-2 py-1.5">
                  <div className="text-red-700 font-bold">
                    {approvalMetrics.rejected.length}
                  </div>
                  <div className="text-red-800/80">Rejected</div>
                </div>
              </div>
              <div className="space-y-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by activity, drawing, tower, floor, GO..."
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedBlock}
                    onChange={(e) => setSelectedBlock(e.target.value)}
                    className="rounded-lg border border-border-default bg-surface-base px-2 py-2 text-xs"
                  >
                    <option>All Blocks</option>
                    {filterOptions.blocks.map((block) => (
                      <option key={block} value={block}>
                        {block}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedTower}
                    onChange={(e) => setSelectedTower(e.target.value)}
                    className="rounded-lg border border-border-default bg-surface-base px-2 py-2 text-xs"
                  >
                    <option>All Towers</option>
                    {filterOptions.towers.map((tower) => (
                      <option key={tower} value={tower}>
                        {tower}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedFloor}
                    onChange={(e) => setSelectedFloor(e.target.value)}
                    className="rounded-lg border border-border-default bg-surface-base px-2 py-2 text-xs"
                  >
                    <option>All Floors</option>
                    {filterOptions.floors.map((floor) => (
                      <option key={floor} value={floor}>
                        {floor}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedGo}
                    onChange={(e) => setSelectedGo(e.target.value)}
                    className="rounded-lg border border-border-default bg-surface-base px-2 py-2 text-xs"
                  >
                    <option>All GOs</option>
                    <option value="Unmapped">Unmapped</option>
                    {filterOptions.gos.map((go) => (
                      <option key={go} value={go}>
                        {go}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedSlaBucket}
                    onChange={(e) =>
                      setSelectedSlaBucket(e.target.value as SlaBucket)
                    }
                    className="rounded-lg border border-border-default bg-surface-base px-2 py-2 text-xs"
                  >
                    {SLA_BUCKETS.map((bucket) => (
                      <option key={bucket} value={bucket}>
                        SLA: {bucket}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedSort}
                    onChange={(e) =>
                      setSelectedSort(e.target.value as ListSortOption)
                    }
                    className="rounded-lg border border-border-default bg-surface-base px-2 py-2 text-xs"
                  >
                    <option value="NEWEST">Sort: Newest first</option>
                    <option value="OLDEST">Sort: Oldest first</option>
                    <option value="RISK_HIGH">Sort: Highest risk</option>
                    <option value="RISK_LOW">Sort: Lowest risk</option>
                    <option value="TOWER">Sort: Tower</option>
                    <option value="FLOOR">Sort: Floor</option>
                    <option value="PENDING_LEVEL">Sort: Pending level</option>
                    <option value="STATUS">Sort: Status</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={showOverdueOnly}
                      onChange={(e) => setShowOverdueOnly(e.target.checked)}
                    />
                    Overdue only
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadListReport}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      RFI Report
                    </button>
                    <button
                      onClick={handleDownloadTowerSummary}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Tower Summary
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filterStatus === "DASHBOARD" ? (
                <>
                  <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-indigo-200">
                          Vision QA Dashboard
                        </div>
                        <h3 className="text-xl font-semibold mt-1">
                          QA/QC Approval Command Center
                        </h3>
                        <p className="text-sm text-indigo-100/90 mt-1">
                          Full-screen insights for pending floors, SLA pressure,
                          and risk-prioritized RFIs.
                        </p>
                      </div>
                      <LayoutDashboard className="w-10 h-10 text-indigo-200" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 text-xs">
                    <div className="rounded-xl bg-surface-card border p-3">
                      <div className="text-text-muted">Total RFIs</div>
                      <div className="text-2xl font-bold text-text-primary">
                        {inspections.length}
                      </div>
                    </div>
                    <div className="rounded-xl bg-warning-muted border border-amber-100 p-3">
                      <div className="text-amber-800/80">Pending</div>
                      <div className="text-2xl font-bold text-amber-700">
                        {approvalMetrics.pending.length}
                      </div>
                    </div>
                    <div className="rounded-xl bg-success-muted border border-emerald-100 p-3">
                      <div className="text-emerald-800/80">Approved</div>
                      <div className="text-2xl font-bold text-emerald-700">
                        {approvalMetrics.approved.length}
                      </div>
                    </div>
                    <div className="rounded-xl bg-error-muted border border-red-100 p-3">
                      <div className="text-red-800/80">Overdue</div>
                      <div className="text-2xl font-bold text-red-700">
                        {dashboardStats.overdueCount}
                      </div>
                    </div>
                    <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
                      <div className="text-orange-800/80">Floors Pending</div>
                      <div className="text-2xl font-bold text-orange-700">
                        {approvalMetrics.floorsPending}
                      </div>
                    </div>
                    <div className="rounded-xl bg-teal-50 border border-teal-100 p-3">
                      <div className="text-teal-800/80">Floors Complete</div>
                      <div className="text-2xl font-bold text-teal-700">
                        {approvalMetrics.floorsCompleted}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-surface-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-text-primary">
                          Tower / Floor Completion Matrix
                        </div>
                        <div className="text-xs text-text-muted">
                          Operational view of pending, partial, approved, and rejected RFIs.
                        </div>
                      </div>
                      <button
                        onClick={handleDownloadTowerSummary}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        Download Matrix
                      </button>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border-subtle text-text-muted">
                            <th className="px-3 py-2 font-medium">Block</th>
                            <th className="px-3 py-2 font-medium">Tower</th>
                            <th className="px-3 py-2 font-medium">Floor</th>
                            <th className="px-3 py-2 font-medium">Pending</th>
                            <th className="px-3 py-2 font-medium">Partial</th>
                            <th className="px-3 py-2 font-medium">Approved</th>
                            <th className="px-3 py-2 font-medium">Rejected</th>
                            <th className="px-3 py-2 font-medium">Completion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {locationSummaryRows.slice(0, 12).map((row) => (
                            <tr
                              key={`${row.block}-${row.tower}-${row.floor}`}
                              className="border-b border-border-subtle/70"
                            >
                              <td className="px-3 py-2 text-text-secondary">{row.block}</td>
                              <td className="px-3 py-2 text-text-primary">{row.tower}</td>
                              <td className="px-3 py-2 text-text-secondary">{row.floor}</td>
                              <td className="px-3 py-2">
                                <span className="rounded-full bg-warning-muted px-2 py-0.5 font-semibold text-amber-800">
                                  {row.pending}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-800">
                                  {row.partial}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                  {row.approved}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                                  {row.rejected}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-raised">
                                    <div
                                      className="h-full rounded-full bg-secondary"
                                      style={{ width: `${row.completion}%` }}
                                    />
                                  </div>
                                  <span className="font-semibold text-text-primary">
                                    {row.completion}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-surface-card p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {SAVED_VIEWS.map((view) => (
                        <button
                          key={view}
                          onClick={() => setSelectedView(view)}
                          className={`px-3 py-1.5 rounded-full text-xs border ${selectedView === view ? "bg-secondary border-secondary text-white" : "bg-surface-card border-border-default text-text-secondary hover:border-indigo-300"}`}
                        >
                          {view}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={selectedFloor}
                        onChange={(e) => setSelectedFloor(e.target.value)}
                        className="border rounded px-2 py-1.5 text-xs bg-surface-card"
                      >
                        <option>All Floors</option>
                        {Array.from(approvalMetrics.floorMap.keys())
                          .sort()
                          .map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                      </select>
                      <select
                        value={selectedSlaBucket}
                        onChange={(e) =>
                          setSelectedSlaBucket(e.target.value as SlaBucket)
                        }
                        className="border rounded px-2 py-1.5 text-xs bg-surface-card"
                      >
                        {SLA_BUCKETS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-xs text-text-secondary border rounded px-2 py-1.5 bg-surface-base">
                        <input
                          type="checkbox"
                          checked={showOverdueOnly}
                          onChange={(e) => setShowOverdueOnly(e.target.checked)}
                        />
                        Overdue only
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-2 rounded-xl border bg-surface-card p-4">
                      <div className="text-sm font-semibold text-gray-800 mb-3">
                        Floor Status Board
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
                        {Array.from(approvalMetrics.floorMap.entries())
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([floor, rows]) => {
                            const p = rows.filter((r) =>
                              isPendingStatus(r.status),
                            ).length;
                            const a = rows.filter(
                              (r) =>
                                r.status === "APPROVED" ||
                                r.status === "PROVISIONALLY_APPROVED",
                            ).length;
                            const r = rows.filter(
                              (rw) => rw.status === "REJECTED",
                            ).length;
                            return (
                              <div
                                key={floor}
                                className="rounded-lg border p-3 bg-surface-base text-xs"
                              >
                                <div className="font-semibold text-gray-800 truncate">
                                  {floor}
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-[11px]">
                                  <span className="text-amber-700">P:{p}</span>
                                  <span className="text-emerald-700">
                                    A:{a}
                                  </span>
                                  <span className="text-red-700">R:{r}</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border bg-surface-card p-4">
                        <div className="text-sm font-semibold text-gray-800 mb-2">
                          SLA Distribution
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span>Overdue</span>
                            <span className="font-bold text-red-700">
                              {dashboardStats.overdueCount}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Due &lt;24h</span>
                            <span className="font-bold text-amber-700">
                              {dashboardStats.due24}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Due 24-48h</span>
                            <span className="font-bold text-blue-700">
                              {dashboardStats.due48}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Upcoming</span>
                            <span className="font-bold text-emerald-700">
                              {dashboardStats.upcoming}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border bg-surface-card p-4">
                        <div className="text-sm font-semibold text-gray-800 mb-2">
                          Data Health
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span>Missing Location</span>
                            <span className="font-bold text-red-700">
                              {dashboardStats.missingLocation}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Missing Workflow</span>
                            <span className="font-bold text-amber-700">
                              {dashboardStats.missingWorkflow}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-surface-card p-4">
                    <div className="text-sm font-semibold text-gray-800 mb-3">
                      Priority Pending Queue
                    </div>
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {dashboardQueue.length === 0 ? (
                        <div className="text-xs text-text-muted italic">
                          No pending items for current filters.
                        </div>
                      ) : (
                        dashboardQueue.slice(0, 24).map((insp) => {
                          const location = parseLocationHierarchy(insp);
                          const bucket = getSlaBucket(insp);
                          return (
                            <button
                              key={insp.id}
                              onClick={() => {
                                openInspectionDetail(insp.id);
                              }}
                              className="w-full text-left border rounded-lg p-2.5 bg-surface-card hover:border-indigo-300 hover:bg-secondary-muted transition"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-text-primary truncate">
                                  {insp.activity?.activityName ||
                                    `Activity #${insp.activityId}`}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded ${bucket === "Overdue" ? "bg-red-100 text-red-700" : bucket === "Due <24h" ? "bg-amber-100 text-amber-700" : "bg-info-muted text-blue-700"}`}
                                  >
                                    {bucket}
                                  </span>
                                  <span className="text-[10px] text-text-muted">
                                    Score {getPriorityScore(insp)}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">
                                  {location.join(" > ") ||
                                    `Node ${insp.epsNodeId}`}
                                </span>
                              </div>
                              {insp.pendingApprovalLevel ? (
                                <div className="mt-2 text-[11px] text-amber-800">
                                  Pending Level {insp.pendingApprovalLevel}
                                  {insp.pendingApprovalLabel
                                    ? ` - ${insp.pendingApprovalLabel}`
                                    : ""}
                                </div>
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              ) : loadingList ? (
                <div className="text-center text-sm text-text-disabled p-4">
                  Loading RFIs...
                </div>
              ) : filteredInspections.length === 0 ? (
                <div className="text-center text-sm text-text-disabled p-8 border-2 border-dashed rounded-lg">
                  No RFIs found.
                </div>
              ) : (
                filteredInspections.map((insp) => {
                  const scopeTokens = getInspectionScopeTokens(insp);
                  const bucket = getSlaBucket(insp);
                  const priority = getPriorityScore(insp);
                  const workflowStateBadge = getWorkflowStateBadge(insp);
                  const inspectionActionSummary = getInspectionActionSummary(insp);
                  return (
                    <div
                      key={insp.id}
                      onClick={() => openInspectionDetail(insp.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedInspectionId === insp.id ? "border-secondary bg-secondary-muted ring-1 ring-indigo-200" : "border-border-default hover:border-indigo-300 hover:shadow-sm bg-surface-card"}`}
                    >
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            insp.status === "APPROVED"
                              ? "bg-green-100 text-green-700"
                              : insp.status === "PARTIALLY_APPROVED"
                                ? "bg-info-muted text-blue-700"
                                : insp.status === "REJECTED"
                                  ? "bg-red-100 text-red-700"
                                  : insp.status === "REVERSED"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {insp.status === "PARTIALLY_APPROVED"
                            ? "PARTIAL"
                            : insp.status}
                        </span>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-text-muted">
                            {insp.requestDate}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${bucket === "Overdue" ? "bg-red-100 text-red-700" : bucket === "Due <24h" ? "bg-amber-100 text-amber-700" : "bg-info-muted text-blue-700"}`}
                          >
                            {bucket}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-sm font-semibold text-text-primary mb-1">
                        {insp.activity?.activityName ||
                          `Activity #${insp.activityId}`}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
                        {scopeTokens.map((token, tokenIdx) => (
                          <span
                            key={`${insp.id}-scope-${tokenIdx}`}
                            className="inline-flex items-center gap-1 rounded bg-surface-raised px-2 py-0.5"
                          >
                            {tokenIdx === 0 ? (
                              <Building2 className="w-3 h-3" />
                            ) : tokenIdx <= 2 ? (
                              <Layers className="w-3 h-3" />
                            ) : (
                              <Home className="w-3 h-3" />
                            )}{" "}
                            {token}
                          </span>
                        ))}
                        {insp.drawingNo ? (
                          <span className="inline-flex items-center gap-1 rounded bg-info-muted px-2 py-0.5 text-blue-800">
                            <MapPin className="w-3 h-3" /> Dwg {insp.drawingNo}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span className="text-text-muted">
                          Risk Score: {priority}
                        </span>
                        <div className="flex items-center gap-2">
                          {workflowStateBadge ? (
                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${workflowStateBadge.className}`}
                            >
                              {workflowStateBadge.label}
                            </span>
                          ) : null}
                          {(insp.pendingObservationCount || 0) > 0 && (
                            <span className="text-red-700 inline-flex items-center gap-1">
                              <Siren className="w-3 h-3" />{" "}
                              {insp.pendingObservationCount} obs
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-[11px]">
                        {inspectionActionSummary ? (
                          <div className="rounded-md bg-surface-raised px-2 py-1 text-text-secondary">
                            {inspectionActionSummary}
                          </div>
                        ) : null}
                        {insp.pendingApprovalLevel ? (
                          <div className="rounded-md bg-warning-muted px-2 py-1 text-amber-800">
                            {insp.pendingApprovalDisplay ||
                              `Level ${insp.pendingApprovalLevel} Pending${
                                insp.pendingApprovalLabel
                                  ? `: ${insp.pendingApprovalLabel}`
                                  : ""
                              }`}
                            {insp.workflowSummary?.pendingStep
                              ?.minApprovalsRequired &&
                            (insp.workflowSummary?.pendingStep
                              ?.minApprovalsRequired || 1) > 1
                              ? ` (${insp.workflowSummary?.pendingStep?.currentApprovalCount || 0}/${insp.workflowSummary?.pendingStep?.minApprovalsRequired} approvals)`
                              : ""}
                          </div>
                        ) : insp.workflowSummary?.runStatus === "COMPLETED" ? (
                          <div className="rounded-md bg-success-muted px-2 py-1 text-emerald-800">
                            All approval levels completed
                          </div>
                        ) : null}
                        {insp.stageApprovalSummary?.totalStages ? (
                          <div className="text-text-muted">
                            Stage approvals:{" "}
                            <span className="font-semibold text-text-primary">
                              {insp.stageApprovalSummary.approvedStages || 0}/
                              {insp.stageApprovalSummary.totalStages}
                            </span>
                            {insp.stageApprovalSummary.pendingFinalApproval
                              ? " - awaiting final approval"
                              : ""}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Panel: Checklist Execution */}
          <main
            className="flex-1 min-w-0 bg-surface-base flex flex-col relative overflow-hidden"
          >
            {isDashboardMode ? (
              <div
                className={`flex-1 overflow-y-auto bg-surface-base ${
                  dashboardFullscreen ? "p-2" : ""
                }`}
                style={{
                  backgroundColor: "var(--color-surface-base)",
                  color: "var(--color-text-primary)",
                  colorScheme: "light",
                }}
              >
                <div
                  className={`grid min-h-full grid-cols-12 gap-4 ${
                    dashboardFullscreen ? "p-3 lg:p-4" : "p-4 lg:p-5"
                  }`}
                >
                  <section className="col-span-12 rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-secondary">
                          Vision QA Dashboard
                        </div>
                        <h3 className="mt-1 text-2xl font-semibold text-text-primary">
                          QA/QC Approval Command Center
                        </h3>
                        <p className="mt-1 text-sm text-text-muted">
                          Full-screen operational view for pending floors, SLA pressure, and priority RFIs.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleDownloadListReport}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          RFI Report
                        </button>
                        <button
                          onClick={handleDownloadTowerSummary}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Tower Matrix
                        </button>
                        <button
                          onClick={handleDownloadReportPreview}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Active Report
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(260px,2fr)_repeat(5,minmax(120px,1fr))]">
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by activity, drawing, tower, floor, GO..."
                        className="rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm"
                      />
                      <select
                        value={selectedBlock}
                        onChange={(e) => setSelectedBlock(e.target.value)}
                        className="rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm"
                      >
                        <option>All Blocks</option>
                        {filterOptions.blocks.map((block) => (
                          <option key={block} value={block}>
                            {block}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedTower}
                        onChange={(e) => setSelectedTower(e.target.value)}
                        className="rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm"
                      >
                        <option>All Towers</option>
                        {filterOptions.towers.map((tower) => (
                          <option key={tower} value={tower}>
                            {tower}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedFloor}
                        onChange={(e) => setSelectedFloor(e.target.value)}
                        className="rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm"
                      >
                        <option>All Floors</option>
                        {filterOptions.floors.map((floor) => (
                          <option key={floor} value={floor}>
                            {floor}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedGo}
                        onChange={(e) => setSelectedGo(e.target.value)}
                        className="rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm"
                      >
                        <option>All GOs</option>
                        <option value="Unmapped">Unmapped</option>
                        {filterOptions.gos.map((go) => (
                          <option key={go} value={go}>
                            {go}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedSlaBucket}
                        onChange={(e) =>
                          setSelectedSlaBucket(e.target.value as SlaBucket)
                        }
                        className="rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm"
                      >
                        {SLA_BUCKETS.map((bucket) => (
                          <option key={bucket} value={bucket}>
                            SLA: {bucket}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-wrap gap-2">
                        {SAVED_VIEWS.map((view) => (
                          <button
                            key={view}
                            onClick={() => setSelectedView(view)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                              selectedView === view
                                ? "bg-secondary border-secondary text-white"
                                : "bg-surface-base border-border-default text-text-secondary hover:border-secondary/30"
                            }`}
                          >
                            {view}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-text-secondary">
                          <input
                            type="checkbox"
                            checked={showOverdueOnly}
                            onChange={(e) => setShowOverdueOnly(e.target.checked)}
                          />
                          Overdue only
                        </label>
                        <select
                          value={selectedSort}
                          onChange={(e) =>
                            setSelectedSort(e.target.value as ListSortOption)
                          }
                          className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-xs"
                        >
                          <option value="NEWEST">Sort: Newest first</option>
                          <option value="OLDEST">Sort: Oldest first</option>
                          <option value="RISK_HIGH">Sort: Highest risk</option>
                          <option value="RISK_LOW">Sort: Lowest risk</option>
                          <option value="TOWER">Sort: Tower</option>
                          <option value="FLOOR">Sort: Floor</option>
                          <option value="PENDING_LEVEL">Sort: Pending level</option>
                          <option value="STATUS">Sort: Status</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(240px,1.4fr)_repeat(2,minmax(150px,1fr))]">
                      <select
                        value={selectedReportPreset}
                        onChange={(e) =>
                          setSelectedReportPreset(e.target.value as ReportPreset)
                        }
                        className="rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm"
                      >
                        {REPORT_PRESETS.map((preset) => (
                          <option key={preset.key} value={preset.key}>
                            Report: {preset.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={reportDateFrom}
                        onChange={(e) => setReportDateFrom(e.target.value)}
                        className="rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm"
                      />
                      <input
                        type="date"
                        value={reportDateTo}
                        onChange={(e) => setReportDateTo(e.target.value)}
                        className="rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm"
                      />
                    </div>
                  </section>

                  <section className="col-span-12 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <button
                      type="button"
                      onClick={() => focusQueue("ALL", { overdueOnly: false, slaBucket: "All" })}
                      className="rounded-xl border bg-surface-card p-4 text-left shadow-sm transition hover:border-secondary/30 hover:bg-surface-base"
                    >
                      <div className="text-xs uppercase tracking-wide text-text-muted">Total RFIs</div>
                      <div className="mt-2 text-3xl font-bold text-text-primary">{inspections.length}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        focusQueue("PENDING", {
                          selectedView: "All Pending",
                          overdueOnly: false,
                          slaBucket: "All",
                        })
                      }
                      className="rounded-xl border border-amber-100 bg-warning-muted p-4 text-left shadow-sm"
                    >
                      <div className="text-xs uppercase tracking-wide text-amber-800/80">Pending</div>
                      <div className="mt-2 text-3xl font-bold text-amber-700">{approvalMetrics.pending.length}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => focusQueue("APPROVED", { overdueOnly: false, slaBucket: "All" })}
                      className="rounded-xl border border-emerald-100 bg-success-muted p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      <div className="text-xs uppercase tracking-wide text-emerald-800/80">Approved</div>
                      <div className="mt-2 text-3xl font-bold text-emerald-700">{approvalMetrics.approved.length}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        focusQueue("PENDING", {
                          selectedView: "Overdue Focus",
                          overdueOnly: true,
                          slaBucket: "Overdue",
                        });
                      }}
                      className="rounded-xl border border-red-100 bg-error-muted p-4 text-left shadow-sm"
                    >
                      <div className="text-xs uppercase tracking-wide text-red-800/80">Overdue</div>
                      <div className="mt-2 text-3xl font-bold text-red-700">{dashboardStats.overdueCount}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        focusQueue("PENDING", {
                          selectedView: "All Pending",
                          overdueOnly: false,
                          slaBucket: "All",
                        })
                      }
                      className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-left shadow-sm transition hover:border-orange-300 hover:bg-orange-100"
                    >
                      <div className="text-xs uppercase tracking-wide text-orange-800/80">Floors Pending</div>
                      <div className="mt-2 text-3xl font-bold text-orange-700">{approvalMetrics.floorsPending}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => focusQueue("APPROVED", { overdueOnly: false, slaBucket: "All" })}
                      className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-left shadow-sm transition hover:border-teal-300 hover:bg-teal-100"
                    >
                      <div className="text-xs uppercase tracking-wide text-teal-800/80">Floors Complete</div>
                      <div className="mt-2 text-3xl font-bold text-teal-700">{approvalMetrics.floorsCompleted}</div>
                    </button>
                  </section>

                  <section className="col-span-12 xl:col-span-7 rounded-2xl border bg-surface-card p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-text-primary">Priority Pending Queue</div>
                        <div className="text-xs text-text-muted">Risk-prioritized RFIs that still need action.</div>
                      </div>
                      <div className="text-xs text-text-muted">{dashboardQueue.length} items</div>
                    </div>
                    <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                      {dashboardQueue.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border-default p-6 text-sm text-text-muted">
                          No pending items for the current dashboard filters.
                        </div>
                      ) : (
                        dashboardQueue.slice(0, 32).map((insp) => {
                          const location = parseLocationHierarchy(insp);
                          const bucket = getSlaBucket(insp);
                          const workflowStateBadge = getWorkflowStateBadge(insp);
                          return (
                            <button
                              key={insp.id}
                              onClick={() => {
                                openInspectionDetail(insp.id);
                              }}
                              className="w-full rounded-xl border border-border-default bg-surface-base p-3 text-left transition hover:border-secondary/40 hover:bg-secondary-muted"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-text-primary">
                                    {insp.activity?.activityName || `Activity #${insp.activityId}`}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {location.join(" > ") || `Node ${insp.epsNodeId}`}
                                    </span>
                                    {insp.drawingNo ? <span>Drawing {insp.drawingNo}</span> : null}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      bucket === "Overdue"
                                        ? "bg-red-100 text-red-700"
                                        : bucket === "Due <24h"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-info-muted text-blue-700"
                                    }`}
                                  >
                                    {bucket}
                                  </span>
                                  <span className="text-[10px] text-text-muted">
                                    Score {getPriorityScore(insp)}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                {insp.pendingApprovalLevel ? (
                                  <span className="rounded-full bg-warning-muted px-2 py-0.5 font-semibold text-amber-800">
                                    Level {insp.pendingApprovalLevel}
                                    {insp.pendingApprovalLabel
                                      ? ` - ${insp.pendingApprovalLabel}`
                                      : ""}
                                  </span>
                                ) : null}
                                {workflowStateBadge ? (
                                  <span
                                    className={`rounded-full px-2 py-0.5 font-semibold ${workflowStateBadge.className}`}
                                  >
                                    {workflowStateBadge.label}
                                  </span>
                                ) : null}
                                {(insp.pendingObservationCount || 0) > 0 ? (
                                  <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                                    {insp.pendingObservationCount} observations
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>

                  <section className="col-span-12 xl:col-span-5 grid gap-4">
                    <div className="rounded-2xl border bg-surface-card p-4 shadow-sm">
                      <div className="mb-3 text-base font-semibold text-text-primary">Tower / Floor Completion Matrix</div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="sticky top-0 bg-surface-card">
                            <tr className="border-b border-border-subtle text-text-muted">
                              <th className="px-3 py-2 font-medium">Tower</th>
                              <th className="px-3 py-2 font-medium">Floor</th>
                              <th className="px-3 py-2 font-medium">Pending</th>
                              <th className="px-3 py-2 font-medium">Approved</th>
                              <th className="px-3 py-2 font-medium">Completion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {locationSummaryRows.slice(0, 14).map((row) => (
                              <tr
                                key={`${row.block}-${row.tower}-${row.floor}`}
                                className="cursor-pointer border-b border-border-subtle/70 hover:bg-surface-base"
                                onClick={() =>
                                  focusQueue("PENDING", {
                                    selectedView: "All Pending",
                                    tower: row.tower,
                                    floor: row.floor,
                                    overdueOnly: false,
                                    slaBucket: "All",
                                  })
                                }
                              >
                                <td className="px-3 py-2 font-medium text-text-primary">{row.tower}</td>
                                <td className="px-3 py-2 text-text-secondary">{row.floor}</td>
                                <td className="px-3 py-2 text-amber-700">{row.pending + row.partial}</td>
                                <td className="px-3 py-2 text-emerald-700">{row.approved}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-raised">
                                      <div className="h-full rounded-full bg-secondary" style={{ width: `${row.completion}%` }} />
                                    </div>
                                    <span className="font-semibold text-text-primary">{row.completion}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-2xl border bg-surface-card p-4 shadow-sm">
                        <div className="mb-3 text-base font-semibold text-text-primary">SLA Distribution</div>
                        <div className="space-y-2 text-sm">
                          <button type="button" onClick={() => focusQueue("PENDING", { selectedView: "Overdue Focus", overdueOnly: true, slaBucket: "Overdue" })} className="flex w-full justify-between rounded-lg px-2 py-1 hover:bg-surface-base"><span>Overdue</span><span className="font-bold text-red-700">{dashboardStats.overdueCount}</span></button>
                          <button type="button" onClick={() => focusQueue("PENDING", { selectedView: "All Pending", overdueOnly: false, slaBucket: "Due <24h" })} className="flex w-full justify-between rounded-lg px-2 py-1 hover:bg-surface-base"><span>Due &lt;24h</span><span className="font-bold text-amber-700">{dashboardStats.due24}</span></button>
                          <button type="button" onClick={() => focusQueue("PENDING", { selectedView: "All Pending", overdueOnly: false, slaBucket: "Due 24-48h" })} className="flex w-full justify-between rounded-lg px-2 py-1 hover:bg-surface-base"><span>Due 24-48h</span><span className="font-bold text-blue-700">{dashboardStats.due48}</span></button>
                          <button type="button" onClick={() => focusQueue("PENDING", { selectedView: "All Pending", overdueOnly: false, slaBucket: "Upcoming" })} className="flex w-full justify-between rounded-lg px-2 py-1 hover:bg-surface-base"><span>Upcoming</span><span className="font-bold text-emerald-700">{dashboardStats.upcoming}</span></button>
                        </div>
                      </div>
                      <div className="rounded-2xl border bg-surface-card p-4 shadow-sm">
                        <div className="mb-3 text-base font-semibold text-text-primary">Data Health</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span>Missing Location</span><span className="font-bold text-red-700">{dashboardStats.missingLocation}</span></div>
                          <div className="flex justify-between"><span>Missing Workflow</span><span className="font-bold text-amber-700">{dashboardStats.missingWorkflow}</span></div>
                        </div>
                      </div>
                      <div className="rounded-2xl border bg-surface-card p-4 shadow-sm md:col-span-2 xl:col-span-1">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="text-base font-semibold text-text-primary">Approver Bottlenecks</div>
                          <button
                            type="button"
                            onClick={handleDownloadBottleneckReport}
                            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-[11px] font-medium text-text-secondary hover:bg-surface-raised"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            Export
                          </button>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                            Actionable {dashboardBottlenecks.stateCounts.actionableNow}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-800">
                            Later {dashboardBottlenecks.stateCounts.assignedLater}
                          </span>
                          <span className="rounded-full bg-surface-raised px-2 py-1 font-semibold text-text-secondary">
                            Others {dashboardBottlenecks.stateCounts.assignedToOthers}
                          </span>
                          <span className="rounded-full bg-red-50 px-2 py-1 font-semibold text-red-800">
                            Obs Blocked {dashboardBottlenecks.stateCounts.blockedByObservations}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          {dashboardBottlenecks.ownerRows.slice(0, 4).map((row) => (
                            <div key={row.owner} className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="font-medium text-text-primary">{row.owner}</div>
                                <div className="text-xs text-text-muted">{row.total} pending</div>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                                <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-800">
                                  {row.overdue} overdue
                                </span>
                                <span className="rounded-full bg-warning-muted px-2 py-0.5 font-semibold text-amber-800">
                                  {row.blockedByObservations} obs blocked
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="col-span-12 rounded-2xl border bg-surface-card p-4 shadow-sm">
                    <div className="mb-3 text-base font-semibold text-text-primary">Floor Status Board</div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
                      {Array.from(approvalMetrics.floorMap.entries())
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([floor, rows]) => {
                          const pendingCount = rows.filter((r) => isPendingStatus(r.status)).length;
                          const approvedCount = rows.filter((r) => isApprovedStatus(r.status)).length;
                          const rejectedCount = rows.filter((r) => r.status === "REJECTED").length;
                          return (
                            <button
                              type="button"
                              key={floor}
                              onClick={() =>
                                focusQueue("PENDING", {
                                  selectedView: "All Pending",
                                  floor,
                                  overdueOnly: false,
                                  slaBucket: "All",
                                })
                              }
                              className="rounded-xl border border-border-default bg-surface-base p-3 text-left transition hover:border-secondary/30 hover:bg-secondary-muted"
                            >
                              <div className="truncate text-sm font-semibold text-text-primary">{floor}</div>
                              <div className="mt-2 flex items-center gap-2 text-xs">
                                <span className="rounded-full bg-warning-muted px-2 py-0.5 font-semibold text-amber-800">P:{pendingCount}</span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">A:{approvedCount}</span>
                                <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">R:{rejectedCount}</span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </section>

                  <section className="col-span-12 rounded-2xl border bg-surface-card p-4 shadow-sm">
                    <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-base font-semibold text-text-primary">
                          {reportPreview.title}
                        </div>
                        <div className="text-sm text-text-muted">
                          {reportPreview.subtitle}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <span className="rounded-full bg-surface-base px-3 py-1 font-medium">
                          {reportPreview.rows.length} rows
                        </span>
                        {(reportDateFrom || reportDateTo) && (
                          <span className="rounded-full bg-surface-base px-3 py-1 font-medium">
                            {reportDateFrom || "Start"} to {reportDateTo || "Today"}
                          </span>
                        )}
                        <button
                          onClick={handleDownloadReportPreview}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Download Preview
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border-subtle">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-surface-raised">
                          <tr className="border-b border-border-subtle text-text-muted">
                            {reportPreview.headers.map((header) => (
                              <th key={header} className="px-3 py-2 font-medium whitespace-nowrap">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportPreview.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={reportPreview.headers.length}
                                className="px-3 py-6 text-center text-sm text-text-muted"
                              >
                                No rows match the current report and date filters.
                              </td>
                            </tr>
                          ) : (
                            reportPreview.rows.slice(0, 18).map((row, rowIndex) => (
                              <tr
                                key={`${selectedReportPreset}-${rowIndex}`}
                                className="border-b border-border-subtle/70 hover:bg-surface-base"
                              >
                                {row.map((cell, cellIndex) => (
                                  <td
                                    key={`${selectedReportPreset}-${rowIndex}-${cellIndex}`}
                                    className="px-3 py-2 whitespace-nowrap text-text-secondary"
                                  >
                                    {String(cell)}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </div>
            ) : !selectedInspectionId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-disabled">
                <ClipboardCheck className="w-16 h-16 mb-4 text-gray-200" />
                <h3 className="text-lg font-medium text-text-primary mb-1">
                  Select an RFI
                </h3>
                <p className="max-w-sm text-center">
                  Select an RFI from the left panel to review and execute its checklist.
                </p>
              </div>
            ) : loadingDetail ? (
              <div className="flex-1 flex items-center justify-center text-text-muted">
                Loading RFI checklist details...
              </div>
            ) : inspectionDetail ? (
              <>
                {/* RFI Info Header */}
                <div className="bg-surface-card px-6 py-4 border-b shrink-0 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary mb-1.5">
                      {inspectionDetail.activity?.activityName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-text-disabled" />{" "}
                        Requested: {inspectionDetail.requestDate}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-text-disabled" />{" "}
                        Requester: {inspectionDetail.inspectedBy || "System"}
                      </span>
                      {inspectionDetail.comments && (
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-surface-raised rounded text-xs italic">
                          "{inspectionDetail.comments}"
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      {getInspectionScopeTokens(inspectionDetail).map(
                        (token: string, tokenIdx: number) => (
                          <span
                            key={`detail-scope-${tokenIdx}`}
                            className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 font-semibold text-text-secondary"
                          >
                            {token}
                          </span>
                        ),
                      )}
                      {inspectionDetail.drawingNo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-info-muted px-3 py-1 font-semibold text-blue-800">
                          Drawing {inspectionDetail.drawingNo}
                        </span>
                      ) : null}
                      {inspectionDetail.elementName ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-800">
                          Element {inspectionDetail.elementName}
                        </span>
                      ) : null}
                      {inspectionDetail.workflowSummary?.strategyName ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 font-semibold text-text-secondary">
                          {inspectionDetail.workflowSummary.strategyName}
                          {inspectionDetail.workflowSummary.releaseStrategyVersion
                            ? ` v${inspectionDetail.workflowSummary.releaseStrategyVersion}`
                            : ""}
                        </span>
                      ) : null}
                      {inspectionDetail.workflowSummary?.processCode ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 font-semibold text-text-secondary">
                          {inspectionDetail.workflowSummary.processCode}
                        </span>
                      ) : null}
                      {inspectionDetail.workflowSummary?.documentType ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 font-semibold text-text-secondary">
                          {inspectionDetail.workflowSummary.documentType}
                        </span>
                      ) : null}
                      {inspectionDetail.pendingApprovalLevel ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-3 py-1 font-semibold text-amber-800">
                          Pending Level {inspectionDetail.pendingApprovalLevel}
                          {inspectionDetail.pendingApprovalLabel
                            ? ` - ${inspectionDetail.pendingApprovalLabel}`
                            : ""}
                          {inspectionDetail.workflowSummary?.pendingStep
                            ?.minApprovalsRequired &&
                          (inspectionDetail.workflowSummary?.pendingStep
                            ?.minApprovalsRequired || 1) > 1
                            ? ` (${inspectionDetail.workflowSummary?.pendingStep?.currentApprovalCount || 0}/${inspectionDetail.workflowSummary?.pendingStep?.minApprovalsRequired})`
                            : ""}
                        </span>
                      ) : null}
                      {inspectionDetail.stageApprovalSummary?.totalStages ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 font-semibold text-text-secondary">
                          Stage Signoff{" "}
                          {inspectionDetail.stageApprovalSummary.approvedStages ||
                            0}
                          /
                          {inspectionDetail.stageApprovalSummary.totalStages}
                        </span>
                      ) : null}
                      {inspectionDetail.stageApprovalSummary
                        ?.pendingFinalApproval ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-info-muted px-3 py-1 font-semibold text-blue-800">
                          Waiting for final approval
                        </span>
                      ) : null}
                      {getWorkflowStateBadge(inspectionDetail) ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${getWorkflowStateBadge(inspectionDetail)?.className}`}
                        >
                          {getWorkflowStateBadge(inspectionDetail)?.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {dashboardFullscreen ? (
                      <span className="hidden rounded-full bg-surface-raised px-3 py-1 text-[11px] font-medium text-text-muted xl:inline-flex">
                        Use Left / Right arrows to move through RFIs
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openInspectionDetail(previousInspection?.id || null)}
                      disabled={!previousInspection}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-base border border-border-default text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-raised shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => openInspectionDetail(nextInspection?.id || null)}
                      disabled={!nextInspection}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-base border border-border-default text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-raised shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedInspectionId(null)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-surface-base border border-border-default text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-raised shadow-sm"
                    >
                      <ChevronLeft className="w-4 h-4" /> All RFIs
                    </button>
                    {/* PDF Download */}
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.get(
                            `/quality/inspections/${inspectionDetail.id}/report`,
                            { responseType: "blob" },
                          );
                          const url = URL.createObjectURL(res.data);
                          const a = document.createElement("a");
                          a.href = url;
                          const isApproved =
                            inspectionDetail.status === "APPROVED";
                          a.download = `RFI_${isApproved ? "Final" : "WIP"}_Report_${inspectionDetail.id}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch {
                          alert("Failed to download report.");
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-medium shadow-sm ${inspectionDetail.status === "APPROVED" ? "bg-success-muted border-emerald-200 text-emerald-700 hover:bg-emerald-100" : "bg-surface-base border-border-default text-text-secondary hover:bg-surface-raised"}`}
                    >
                      <FileDown className="w-4 h-4" />{" "}
                      {inspectionDetail.status === "APPROVED"
                        ? "Final Report"
                        : "WIP Report"}
                    </button>
                    {/* Reverse for Approved */}
                    {inspectionDetail.status === "APPROVED" && (
                      <button
                        onClick={() => setShowReversalModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-warning-muted border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 shadow-sm"
                      >
                        <RotateCcw className="w-4 h-4" /> Reverse
                      </button>
                    )}
                    {/* Admin Delete */}
                    {isAdmin && (
                      <button
                        onClick={async () => {
                          if (!confirm("Permanently delete this RFI?")) return;
                          try {
                            await api.delete(
                              `/quality/inspections/${inspectionDetail.id}`,
                            );
                            alert("RFI deleted.");
                            setSelectedInspectionId(null);
                            setRefreshKey((k) => k + 1);
                          } catch (err: any) {
                            alert(
                              err.response?.data?.message || "Delete failed.",
                            );
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-error-muted border border-red-200 text-error rounded-lg text-sm font-medium hover:bg-red-100 shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Final Action Bar (Desktop only, or keep sticky bottom as is) */}

                {/* Workflow Status Indicator */}
                {workflowState && (
                  <div className="shrink-0 border-y border-border-subtle bg-surface-card px-4 py-2">
                    <div className="flex flex-1 items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setWorkflowStripCollapsed((collapsed) => !collapsed)
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-xs font-bold text-text-muted uppercase tracking-widest whitespace-nowrap hover:bg-surface-raised"
                      >
                        Workflow
                        {workflowStripCollapsed ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronUp className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <div className="text-xs text-text-muted whitespace-nowrap">
                        {workflowState.currentStepOrder
                          ? `Pending at level ${workflowState.currentStepOrder}`
                          : "Workflow ready"}
                      </div>
                      {workflowStripCollapsed ? (
                        <div className="flex flex-1 items-center justify-end">
                          <span className="rounded-full bg-surface-raised px-2 py-1 text-[11px] font-medium text-text-muted">
                            Workflow hidden while working on stage
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1">
                          {workflowState.steps
                            .sort((a: any, b: any) => a.stepOrder - b.stepOrder)
                            .map((step: any, sIdx: number) => {
                              const isCurrent =
                                workflowState.currentStepOrder === step.stepOrder;
                              const isRaiserStep =
                                step.workflowNode?.stepType === "RAISE_RFI" ||
                                (step.stepOrder === 1 &&
                                  step.workflowNode?.label
                                    ?.toLowerCase?.()
                                    ?.includes?.("raise"));
                              const isLastStepNode =
                                step.stepOrder ===
                                Math.max(
                                  ...workflowState.steps.map(
                                    (s: any) => s.stepOrder,
                                  ),
                                );
                              const {
                                colorClass,
                                stateLabel,
                                stepLabel,
                                subtitle: stepSubtitle,
                                isCompleted,
                                delegated,
                              } = getWorkflowStepMeta(
                                step,
                                isCurrent,
                                isLastStepNode,
                                isRaiserStep,
                              );

                              return (
                                <div
                                  key={step.id}
                                  className="flex items-center gap-2 shrink-0"
                                >
                                  <div
                                    className={`flex min-w-[176px] flex-col border rounded-lg px-2.5 py-2 ${colorClass}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-bold uppercase">
                                        {stepLabel}
                                      </span>
                                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                                        {stateLabel}
                                      </span>
                                    </div>
                                    <span className="mt-1 text-[10px] truncate max-w-[150px]">
                                      {stepSubtitle}
                                    </span>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {isCurrent ? (
                                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                                          Current approver
                                        </span>
                                      ) : null}
                                      {delegated ? (
                                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                                          Delegated
                                        </span>
                                      ) : null}
                                      {(step.minApprovalsRequired || 1) > 1 ? (
                                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                                          {(step.currentApprovalCount || 0)}/{step.minApprovalsRequired} quorum
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  {sIdx < workflowState.steps.length - 1 && (
                                    <div
                                      className={`h-0.5 w-4 ${isCompleted ? "bg-success" : "bg-gray-200"}`}
                                    />
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Checklist Area */}
                <div className="flex-1 overflow-y-auto px-4 py-3 lg:px-6">
                  <div className="mx-auto w-full max-w-[1500px] space-y-4">
                    {inspectionDetail.workflowSummary?.currentUserActionHint && (
                      <div
                        className={`rounded-xl border px-4 py-3 text-sm ${
                          inspectionDetail.workflowSummary?.currentUserCanApprove
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-blue-200 bg-blue-50 text-blue-800"
                        }`}
                      >
                        {inspectionDetail.workflowSummary.currentUserActionHint}
                      </div>
                    )}

                    {(inspectionDetail.activity?.requiresPourCard ||
                      inspectionDetail.activity?.requiresPourClearanceCard) && (
                      <div className="rounded-xl border bg-surface-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-text-primary">
                              Concrete Cards
                            </div>
                            <div className="text-xs text-text-muted">
                              Inspection-linked pour card and pre-pour clearance details.
                            </div>
                          </div>
                          {loadingCards ? (
                            <span className="text-xs text-text-muted">
                              Loading card details...
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          {inspectionDetail.activity?.requiresPourCard && pourCard ? (
                            <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-text-primary">
                                  Pour Card
                                </div>
                                <span className="rounded-full bg-surface-card px-2 py-1 text-[11px] font-semibold text-text-secondary">
                                  {pourCard.status || "DRAFT"}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input
                                    value={pourCard.projectNameSnapshot || ""}
                                    onChange={(e) =>
                                      setPourCard((prev: any) => ({
                                        ...prev,
                                        projectNameSnapshot: e.target.value,
                                      }))
                                    }
                                    placeholder="Project name"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={pourCard.approvedByName || ""}
                                    onChange={(e) =>
                                      setPourCard((prev: any) => ({
                                        ...prev,
                                        approvedByName: e.target.value,
                                      }))
                                    }
                                    placeholder="Approved by"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input
                                    value={pourCard.clientName || ""}
                                    onChange={(e) =>
                                      setPourCard((prev: any) => ({
                                        ...prev,
                                        clientName: e.target.value,
                                      }))
                                    }
                                    placeholder="Client"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={pourCard.consultantName || ""}
                                    onChange={(e) =>
                                      setPourCard((prev: any) => ({
                                        ...prev,
                                        consultantName: e.target.value,
                                      }))
                                    }
                                    placeholder="Consultant"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                </div>
                                <input
                                  value={pourCard.contractorName || ""}
                                  onChange={(e) =>
                                    setPourCard((prev: any) => ({
                                      ...prev,
                                      contractorName: e.target.value,
                                    }))
                                  }
                                  placeholder="Contractor"
                                  className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                />
                                <input
                                  value={pourCard.locationText || ""}
                                  onChange={(e) =>
                                    setPourCard((prev: any) => ({
                                      ...prev,
                                      locationText: e.target.value,
                                    }))
                                  }
                                  placeholder="Pour location"
                                  className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                />
                                <textarea
                                  value={pourCard.remarks || ""}
                                  onChange={(e) =>
                                    setPourCard((prev: any) => ({
                                      ...prev,
                                      remarks: e.target.value,
                                    }))
                                  }
                                  placeholder="General remarks"
                                  className="min-h-[84px] rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                />
                                <div className="rounded-lg border border-dashed border-border-default bg-surface-card px-3 py-3">
                                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                    Pour Entries
                                  </div>
                                  <div className="space-y-2">
                                    {(pourCard.entries || []).map((entry: any, idx: number) => (
                                      <div key={`pour-entry-${idx}`} className="rounded-lg border border-border-subtle bg-surface-base p-3">
                                        <div className="mb-2 text-xs font-semibold text-text-muted">
                                          Entry {idx + 1}
                                        </div>
                                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                                        <input
                                          value={entry.pourDate || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, pourDate: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Pour date"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.truckNo || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, truckNo: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Truck no"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.deliveryChallanNo || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, deliveryChallanNo: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Delivery challan no"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.mixIdOrGrade || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, mixIdOrGrade: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Mix / Grade"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.quantityM3 ?? ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? {
                                                      ...row,
                                                      quantityM3: e.target.value ? Number(e.target.value) : null,
                                                    }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Qty m3"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.cumulativeQtyM3 ?? ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? {
                                                      ...row,
                                                      cumulativeQtyM3: e.target.value ? Number(e.target.value) : null,
                                                    }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Cumulative qty m3"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.arrivalTimeAtSite || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, arrivalTimeAtSite: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Arrival time"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.batchStartTime || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, batchStartTime: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Batch start time"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.finishingTime || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, finishingTime: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Finishing time"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.timeTakenMinutes ?? ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? {
                                                      ...row,
                                                      timeTakenMinutes: e.target.value
                                                        ? Number(e.target.value)
                                                        : null,
                                                    }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Time taken mins"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.slumpMm ?? ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? {
                                                      ...row,
                                                      slumpMm: e.target.value ? Number(e.target.value) : null,
                                                    }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Slump mm"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.concreteTemperature ?? ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? {
                                                      ...row,
                                                      concreteTemperature: e.target.value
                                                        ? Number(e.target.value)
                                                        : null,
                                                    }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Concrete temp"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.noOfCubesTaken ?? ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? {
                                                      ...row,
                                                      noOfCubesTaken: e.target.value
                                                        ? Number(e.target.value)
                                                        : null,
                                                    }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="No. of cubes"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.supplierRepresentative || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, supplierRepresentative: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Supplier"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.contractorRepresentative || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, contractorRepresentative: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Contractor rep"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        <input
                                          value={entry.clientRepresentative || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, clientRepresentative: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Client rep"
                                          className="rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                        </div>
                                        <textarea
                                          value={entry.remarks || ""}
                                          onChange={(e) =>
                                            setPourCard((prev: any) => ({
                                              ...prev,
                                              entries: (prev.entries || []).map((row: any, rowIdx: number) =>
                                                rowIdx === idx
                                                  ? { ...row, remarks: e.target.value }
                                                  : row,
                                              ),
                                            }))
                                          }
                                          placeholder="Entry remarks"
                                          className="mt-2 min-h-[70px] w-full rounded-lg border border-border-default bg-surface-card px-2.5 py-2 text-sm"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPourCard((prev: any) => ({
                                        ...prev,
                                        entries: [
                                          ...(prev.entries || []),
                                          {
                                            slNo: (prev.entries || []).length + 1,
                                            pourDate: "",
                                            truckNo: "",
                                            deliveryChallanNo: "",
                                            mixIdOrGrade: "",
                                            quantityM3: null,
                                            cumulativeQtyM3: null,
                                            arrivalTimeAtSite: "",
                                            batchStartTime: "",
                                            finishingTime: "",
                                            timeTakenMinutes: null,
                                            slumpMm: null,
                                            concreteTemperature: null,
                                            noOfCubesTaken: null,
                                            supplierRepresentative: "",
                                            contractorRepresentative: "",
                                            clientRepresentative: "",
                                            remarks: "",
                                          },
                                        ],
                                      }))
                                    }
                                    className="mt-3 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised"
                                  >
                                    Add Entry
                                  </button>
                                </div>
                                <div className="flex justify-end">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={downloadPourCardPdf}
                                      className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
                                    >
                                      Download PDF
                                    </button>
                                    <button
                                      type="button"
                                      onClick={savePourCardDetails}
                                      disabled={savingPourCard || pourCard.status === "LOCKED"}
                                      className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white hover:bg-secondary-dark disabled:opacity-50"
                                    >
                                      {savingPourCard ? "Saving..." : "Save Pour Card"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={submitPourCardDetails}
                                      disabled={
                                        submittingPourCard || pourCard.status === "LOCKED"
                                      }
                                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                    >
                                      {submittingPourCard
                                        ? "Submitting..."
                                        : pourCard.status === "SUBMITTED"
                                          ? "Submitted"
                                          : pourCard.status === "LOCKED"
                                            ? "Locked"
                                            : "Submit"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {inspectionDetail.activity?.requiresPourClearanceCard &&
                          prePourClearanceCard ? (
                            <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-text-primary">
                                  Pre-Pour Clearance
                                </div>
                                <span className="rounded-full bg-surface-card px-2 py-1 text-[11px] font-semibold text-text-secondary">
                                  {prePourClearanceCard.status || "DRAFT"}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input
                                    value={prePourClearanceCard.projectNameSnapshot || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        projectNameSnapshot: e.target.value,
                                      }))
                                    }
                                    placeholder="Project name"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.contractorName || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        contractorName: e.target.value,
                                      }))
                                    }
                                    placeholder="Contractor"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                </div>
                                <div className="grid gap-3 md:grid-cols-3">
                                  <input
                                    value={prePourClearanceCard.cardDate || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        cardDate: e.target.value,
                                      }))
                                    }
                                    placeholder="Date"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.pourStartTime || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        pourStartTime: e.target.value,
                                      }))
                                    }
                                    placeholder="Pour start time"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.pourEndTime || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        pourEndTime: e.target.value,
                                      }))
                                    }
                                    placeholder="Pour end time"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input
                                    value={prePourClearanceCard.locationText || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        locationText: e.target.value,
                                      }))
                                    }
                                    placeholder="Checklist location"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.elementName || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        elementName: e.target.value,
                                      }))
                                    }
                                    placeholder="Element"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                </div>
                                <input
                                  value={prePourClearanceCard.pourLocation || ""}
                                  onChange={(e) =>
                                    setPrePourClearanceCard((prev: any) => ({
                                      ...prev,
                                      pourLocation: e.target.value,
                                    }))
                                  }
                                  placeholder="Pour location"
                                  className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                />
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input
                                    value={prePourClearanceCard.pourNo || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        pourNo: e.target.value,
                                      }))
                                    }
                                    placeholder="Pour no"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.gradeOfConcrete || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        gradeOfConcrete: e.target.value,
                                      }))
                                    }
                                    placeholder="Grade of concrete"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.placementMethod || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        placementMethod: e.target.value,
                                      }))
                                    }
                                    placeholder="Placement method"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                  <input
                                    value={prePourClearanceCard.estimatedConcreteQty ?? ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        estimatedConcreteQty: e.target.value
                                          ? Number(e.target.value)
                                          : null,
                                      }))
                                    }
                                    placeholder="Estimated qty"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.actualConcreteQty ?? ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        actualConcreteQty: e.target.value
                                          ? Number(e.target.value)
                                          : null,
                                      }))
                                    }
                                    placeholder="Actual qty"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.concreteSupplier || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        concreteSupplier: e.target.value,
                                      }))
                                    }
                                    placeholder="Concrete supplier"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.cubeMouldCount ?? ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        cubeMouldCount: e.target.value
                                          ? Number(e.target.value)
                                          : null,
                                      }))
                                    }
                                    placeholder="Cube mould count"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.targetSlump || ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        targetSlump: e.target.value,
                                      }))
                                    }
                                    placeholder="Target slump"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={prePourClearanceCard.vibratorCount ?? ""}
                                    onChange={(e) =>
                                      setPrePourClearanceCard((prev: any) => ({
                                        ...prev,
                                        vibratorCount: e.target.value
                                          ? Number(e.target.value)
                                          : null,
                                      }))
                                    }
                                    placeholder="No. of vibrators"
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                </div>
                                <div className="rounded-lg border border-dashed border-border-default bg-surface-card px-3 py-3">
                                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                    Attachments
                                  </div>
                                  <div className="grid gap-2 md:grid-cols-2">
                                    {[
                                      ["checklistPccAttached", "PCC Checklist"],
                                      ["checklistWaterproofingAttached", "Waterproofing Checklist"],
                                      ["checklistFormworkAttached", "Formwork Checklist"],
                                      ["checklistReinforcementAttached", "Reinforcement Checklist"],
                                      ["checklistMepAttached", "MEP Checklist"],
                                      ["checklistConcretingAttached", "Concreting Checklist"],
                                      ["concretePourCardAttached", "Concrete Pour Card"],
                                    ].map(([key, label]) => (
                                      <div
                                        key={key}
                                        className="grid grid-cols-[1fr_140px] items-center gap-3 text-sm text-text-secondary"
                                      >
                                        <span>{label}</span>
                                        <select
                                          value={
                                            prePourClearanceCard.attachments?.[key] === true
                                              ? "YES"
                                              : prePourClearanceCard.attachments?.[key] === false
                                                ? "NO"
                                                : prePourClearanceCard.attachments?.[key] || "NO"
                                          }
                                          onChange={(e) =>
                                            setPrePourClearanceCard((prev: any) => ({
                                              ...prev,
                                              attachments: {
                                                ...(prev.attachments || {}),
                                                [key]: e.target.value,
                                              },
                                            }))
                                          }
                                          className="rounded-lg border border-border-default bg-surface-base px-2.5 py-2 text-sm"
                                        >
                                          <option value="NO">No</option>
                                          <option value="YES">Yes</option>
                                          <option value="NA">N/A</option>
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="rounded-lg border border-dashed border-border-default bg-surface-card px-3 py-3">
                                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                    Signoff Parties
                                  </div>
                                  <div className="space-y-2">
                                    {(prePourClearanceCard.signoffs || []).map(
                                      (signoff: any, idx: number) => (
                                        <div
                                          key={`signoff-${idx}`}
                                          className="grid gap-2 md:grid-cols-[1.1fr_1fr]"
                                        >
                                          <input
                                            value={signoff.department || ""}
                                            onChange={(e) =>
                                              setPrePourClearanceCard((prev: any) => ({
                                                ...prev,
                                                signoffs: (prev.signoffs || []).map(
                                                  (row: any, rowIdx: number) =>
                                                    rowIdx === idx
                                                      ? { ...row, department: e.target.value }
                                                      : row,
                                                ),
                                              }))
                                            }
                                            placeholder="Department"
                                            className="rounded-lg border border-border-default bg-surface-base px-2.5 py-2 text-sm"
                                          />
                                          <input
                                            value={signoff.personName || ""}
                                            onChange={(e) =>
                                              setPrePourClearanceCard((prev: any) => ({
                                                ...prev,
                                                signoffs: (prev.signoffs || []).map(
                                                  (row: any, rowIdx: number) =>
                                                    rowIdx === idx
                                                      ? { ...row, personName: e.target.value }
                                                      : row,
                                                ),
                                              }))
                                            }
                                            placeholder="Name"
                                            className="rounded-lg border border-border-default bg-surface-base px-2.5 py-2 text-sm"
                                          />
                                          <input
                                            value={signoff.signedDate || ""}
                                            onChange={(e) =>
                                              setPrePourClearanceCard((prev: any) => ({
                                                ...prev,
                                                signoffs: (prev.signoffs || []).map(
                                                  (row: any, rowIdx: number) =>
                                                    rowIdx === idx
                                                      ? { ...row, signedDate: e.target.value }
                                                      : row,
                                                ),
                                              }))
                                            }
                                            placeholder="Signed date"
                                            className="rounded-lg border border-border-default bg-surface-base px-2.5 py-2 text-sm"
                                          />
                                          <select
                                            value={signoff.status || "PENDING"}
                                            onChange={(e) =>
                                              setPrePourClearanceCard((prev: any) => ({
                                                ...prev,
                                                signoffs: (prev.signoffs || []).map(
                                                  (row: any, rowIdx: number) =>
                                                    rowIdx === idx
                                                      ? { ...row, status: e.target.value }
                                                      : row,
                                                ),
                                              }))
                                            }
                                            className="rounded-lg border border-border-default bg-surface-base px-2.5 py-2 text-sm"
                                          >
                                            <option value="PENDING">Pending</option>
                                            <option value="SIGNED">Signed</option>
                                            <option value="WAIVED">Waived</option>
                                          </select>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                                <div className="flex justify-end">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={downloadPrePourClearancePdf}
                                      className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
                                    >
                                      Download PDF
                                    </button>
                                    <button
                                      type="button"
                                      onClick={savePrePourClearanceDetails}
                                      disabled={
                                        savingPrePourClearance ||
                                        prePourClearanceCard.status === "LOCKED"
                                      }
                                      className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white hover:bg-secondary-dark disabled:opacity-50"
                                    >
                                      {savingPrePourClearance
                                        ? "Saving..."
                                        : "Save Pre-Pour Clearance"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={submitPrePourClearanceDetails}
                                      disabled={
                                        submittingPrePourClearance ||
                                        prePourClearanceCard.status === "LOCKED"
                                      }
                                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                    >
                                      {submittingPrePourClearance
                                        ? "Submitting..."
                                        : prePourClearanceCard.status === "SUBMITTED"
                                          ? "Submitted"
                                          : prePourClearanceCard.status === "LOCKED"
                                            ? "Locked"
                                            : "Submit"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {activeApproverSummary && (
                      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                        <div className="rounded-xl border bg-surface-card p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                                Live Active Approver
                              </div>
                              <div className="mt-2 text-lg font-semibold text-text-primary">
                                {activeApproverSummary.title}
                              </div>
                              <div className="mt-1 text-sm text-text-secondary">
                                {activeApproverSummary.subtitle}
                              </div>
                            </div>
                            <div className="rounded-xl border border-border-subtle bg-surface-base px-3 py-2 text-right">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                Progress
                              </div>
                              <div className="mt-1 text-sm font-semibold text-text-primary">
                                {activeApproverSummary.quorumText}
                              </div>
                            </div>
                          </div>
                          {inspectionDetail.workflowSummary?.pendingStep?.pendingApproverNames?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {inspectionDetail.workflowSummary.pendingStep.pendingApproverNames.map(
                                (name: string, index: number) => (
                                  <span
                                    key={`active-approver-${index}`}
                                    className="inline-flex items-center rounded-full border border-border-subtle bg-surface-base px-3 py-1 text-xs font-medium text-text-secondary"
                                  >
                                    {name}
                                  </span>
                                ),
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-xl border bg-surface-card p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                            Your Standing
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {workflowReasonChips.map((chip, index) => (
                              <span
                                key={`wf-reason-chip-${index}`}
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${chip.className}`}
                              >
                                {chip.label}
                              </span>
                            ))}
                          </div>
                          <div
                            className={`mt-3 rounded-xl border px-3 py-3 text-sm ${getWorkflowActorTone(
                              inspectionDetail.workflowSummary?.actorState,
                            )}`}
                          >
                            {inspectionDetail.workflowSummary?.currentUserBlockedReason ||
                              inspectionDetail.workflowSummary?.currentUserActionHint ||
                              "No user-specific approval restriction is active right now."}
                          </div>
                          {(inspectionDetail.workflowSummary?.currentUserAssignedLevels || []).length >
                          0 ? (
                            <div className="mt-3 text-xs text-text-secondary">
                              Assigned levels:{" "}
                              <span className="font-semibold text-text-primary">
                                {inspectionDetail.workflowSummary.currentUserAssignedLevels.join(", ")}
                              </span>
                            </div>
                          ) : null}
                          {(inspectionDetail.workflowSummary?.currentUserFutureLevels || []).length >
                          0 ? (
                            <div className="mt-2 text-xs text-text-secondary">
                              Waiting levels:{" "}
                              <span className="font-semibold text-text-primary">
                                {inspectionDetail.workflowSummary.currentUserFutureLevels.join(", ")}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                    {/* Workflow Completed Banner */}
                    {workflowState?.status === "COMPLETED" && (
                      <div className="bg-success-muted border border-emerald-300 rounded-xl px-5 py-3 flex items-center gap-3 text-emerald-800">
                        <CheckCircle2 className="w-6 h-6 shrink-0" />
                        <div>
                          <h4 className="font-bold text-sm">
                            Workflow Fully Approved
                          </h4>
                          <p className="text-xs mt-1">
                            All {workflowState.steps.length} approval levels
                            have been completed and signed.
                          </p>
                        </div>
                      </div>
                    )}

                    {inspectionDetail.workflowSummary?.completedSteps?.length >
                      0 && (
                      <div className="rounded-xl border bg-surface-card p-4">
                        <div className="text-sm font-semibold text-text-primary">
                          Completed Approval Levels
                        </div>
                        <div className="mt-3 space-y-2">
                          {inspectionDetail.workflowSummary.completedSteps.map(
                            (step: any) => (
                              <div
                                key={`wf-complete-${step.stepOrder}`}
                                className="rounded-lg border border-emerald-200 bg-success-muted px-3 py-2 text-xs text-emerald-900"
                              >
                                <div className="font-semibold">
                                  Level {step.stepOrder}:{" "}
                                  {step.stepName || "Approval Step"}
                                </div>
                                {(step.minApprovalsRequired || 1) > 1 && (
                                  <div className="mt-1">
                                    Quorum met: {step.currentApprovalCount || 0}/
                                    {step.minApprovalsRequired}
                                  </div>
                                )}
                                <div className="mt-1">
                                  {[
                                    step.signerDisplayName,
                                    step.signerCompany,
                                    step.signerRole,
                                  ]
                                    .filter(Boolean)
                                    .join(" - ") || "Signed"}
                                </div>
                                {step.completedAt && (
                                  <div className="mt-1 text-emerald-700">
                                    {new Date(step.completedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    {approvalHistory.length > 0 && (
                      <div className="rounded-xl border bg-surface-card p-4">
                        <div className="text-sm font-semibold text-text-primary">
                          Approval History
                        </div>
                        <div className="mt-3 space-y-2">
                          {approvalHistory.map((entry: any) => (
                            <div
                              key={entry.key}
                              className="rounded-lg border border-border-subtle bg-surface-base px-3 py-3 text-xs"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="font-semibold text-text-primary">
                                    {entry.title}
                                  </div>
                                  <div className="mt-1 text-text-secondary">
                                    {entry.scope} - {entry.action}
                                  </div>
                                  {entry.meta && (
                                    <div className="mt-1 text-text-muted">
                                      {entry.meta}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span
                                    className={`rounded-full px-2 py-1 font-semibold ${
                                      entry.status === "REVERSED"
                                        ? "bg-warning-muted text-amber-800"
                                        : "bg-surface-raised text-text-secondary"
                                    }`}
                                  >
                                    {entry.status}
                                  </span>
                                  {entry.at && (
                                    <span className="text-text-muted">
                                      {new Date(entry.at).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Observation Banner */}
                    {pendingObservationsCount > 0 && (
                      <div className="bg-warning-muted border border-amber-200 rounded-xl px-4 py-3 flex gap-3 text-amber-800">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                          <h4 className="font-bold text-sm">
                            Cannot Approve RFI
                          </h4>
                          <p className="text-xs mt-1">
                            There are {pendingObservationsCount} pending
                            observation(s). The field team must resolve these
                            before you can approve.
                          </p>
                        </div>
                      </div>
                    )}

                    {(cardReadiness.requiresPourCard ||
                      cardReadiness.requiresPrePourClearance) &&
                    !cardReadiness.allReady ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 text-blue-800">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                          <h4 className="font-bold text-sm">
                            Final Approval Waiting On Card Submission
                          </h4>
                          <p className="text-xs mt-1">
                            {cardReadiness.requiresPourCard &&
                            !cardReadiness.pourCardReady
                              ? "Required pour card is still draft or missing. "
                              : ""}
                            {cardReadiness.requiresPrePourClearance &&
                            !cardReadiness.prePourClearanceReady
                              ? "Required pre-pour clearance card is still draft or missing."
                              : ""}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {!inspectionDetail.stages ||
                    inspectionDetail.stages.length === 0 ? (
                      <div className="bg-surface-card p-6 rounded-xl border text-center text-text-muted">
                        No checklist template assigned to this activity.
                      </div>
                    ) : (
                      inspectionDetail.stages.map((stage: any, sIdx: number) => {
                        const stageApproval = stage.stageApproval;
                        const stageLevels = stageApproval?.levels || [];
                        const stageStatusChips = getStageStatusChips(stage);
                        const stageActionReason = getStageApprovalActionReason(stage);
                        const latestStageApproval = [...(stage.signatures || [])]
                          .reverse()
                          .find(
                            (signature: any) =>
                              signature?.actionType === "STAGE_APPROVE" &&
                              !signature?.isReversed,
                          );

                        return (
                          <div
                            key={stage.id}
                            className="bg-surface-card rounded-xl shadow-sm border overflow-hidden"
                          >
                            <div className="bg-surface-base px-3 py-2 border-b flex flex-wrap justify-between items-start gap-2">
                              <div>
                                <h3 className="font-semibold text-base text-text-primary">
                                  Stage {sIdx + 1}:{" "}
                                  {stage.stageTemplate?.name || "General Checks"}
                                </h3>
                                <p className="text-xs text-text-muted mt-1">
                                  {stageApproval?.fullyApproved
                                    ? "Stage approved at all release-strategy levels and locked"
                                    : stageApproval?.pendingDisplay
                                      ? `Pending approvals: ${stageApproval.pendingDisplay}`
                                      : stage.isLocked
                                        ? "Stage approved and locked"
                                        : "Stage approval pending"}
                                </p>
                                {stageLevels.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {stageLevels.map((level: any) => (
                                      <span
                                        key={`stage-level-summary-${stage.id}-${level.stepOrder}`}
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                          level.approved
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-amber-100 text-amber-700"
                                        }`}
                                      >
                                        L{level.stepOrder}:{" "}
                                        {level.approved
                                          ? level.signerDisplayName || "Approved"
                                          : "Pending"}
                                      </span>
                                    ))}
                                  </div>
                                ) : latestStageApproval ? (
                                  <p className="text-xs text-text-muted mt-1">
                                    Approved by{" "}
                                    {latestStageApproval.signerDisplayName ||
                                      latestStageApproval.signedBy}
                                    {latestStageApproval.signerCompany &&
                                      ` - ${latestStageApproval.signerCompany}`}
                                    {latestStageApproval.signerRoleLabel &&
                                      ` - ${latestStageApproval.signerRoleLabel}`}
                                  </p>
                                ) : null}
                                {stageStatusChips.length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {stageStatusChips.map((chip, chipIdx) => (
                                      <span
                                        key={`stage-status-chip-${stage.id}-${chipIdx}`}
                                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${chip.className}`}
                                      >
                                        {chip.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-text-muted">
                                  {
                                    stage.items?.filter(
                                      (i: any) =>
                                        i.value === "YES" ||
                                        i.value === "NA" ||
                                        i.isOk,
                                    ).length
                                  }{" "}
                                  / {stage.items?.length} Completed
                                </span>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                                    isStageApproved(stage)
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-surface-raised text-text-muted"
                                  }`}
                                >
                                  {isStageApproved(stage)
                                    ? "Approved & Locked"
                                    : stageApproval?.approvedLevelCount
                                      ? `${stageApproval.approvedLevelCount}/${stageApproval.requiredLevelCount} Levels Approved`
                                      : stage.status}
                                </span>
                                {isAdmin && isStageApproved(stage) && inspectionDetail.status !== "APPROVED" && (
                                  <button
                                    onClick={async () => {
                                      const reason = prompt("Enter reason to reverse this stage approval:");
                                      if (!reason) return;
                                      await api.post(
                                        `/quality/inspections/${inspectionDetail.id}/stages/${stage.id}/reverse`,
                                        { reason },
                                      );
                                      setRefreshKey((k) => k + 1);
                                    }}
                                    className="px-2 py-1 text-[10px] font-bold uppercase rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                                  >
                                    Reverse Stage
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="border-b bg-surface-base/60 px-3 py-2">
                              <div className="mb-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                                <div className="rounded-lg border border-border-subtle bg-surface-card px-3 py-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                                    Stage Approval Readiness
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-text-primary">
                                    {stageApproval?.fullyApproved
                                      ? "This stage is fully approved and locked."
                                      : stageActionReason
                                        ? stageActionReason
                                        : "This stage is ready for your approval action."}
                                  </div>
                                  <div className="mt-2 text-xs text-text-secondary">
                                    {stageApproval?.pendingDisplay
                                      ? `Current approval path: ${stageApproval.pendingDisplay}`
                                      : stage.isLocked
                                        ? "No further action is required on this stage."
                                        : "Complete the checklist, close observations, and then approve the active level."}
                                  </div>
                                </div>
                                <div className="rounded-lg border border-border-subtle bg-surface-card px-3 py-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                                    Action Snapshot
                                  </div>
                                  <div className="mt-2 space-y-1.5 text-xs text-text-secondary">
                                    <div className="flex items-center justify-between gap-2">
                                      <span>Checklist</span>
                                      <span className="font-semibold text-text-primary">
                                        {isStageChecklistComplete(stage) ? "Complete" : "Pending Items"}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span>Observations</span>
                                      <span className="font-semibold text-text-primary">
                                        {getStagePendingObservationCount(stage.id)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span>Approval Progress</span>
                                      <span className="font-semibold text-text-primary">
                                        {stageApproval?.pendingDisplay || (stageApproval?.fullyApproved ? "Complete" : "Pending")}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {stageLevels.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {stageLevels.map((level: any) => (
                                    <div
                                      key={`stage-matrix-${stage.id}-${level.stepOrder}`}
                                      className="min-w-[180px] flex-1 rounded-lg border border-border-subtle bg-surface-card px-2.5 py-2 text-[11px]"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-1">
                                        <span className="font-semibold text-text-primary leading-tight">
                                          L{level.stepOrder}: {level.stepName}
                                        </span>
                                        <span
                                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                            level.approved
                                              ? "bg-emerald-100 text-emerald-700"
                                              : "bg-amber-100 text-amber-700"
                                          }`}
                                        >
                                          {level.approved ? "Approved" : "Pending"}
                                        </span>
                                      </div>
                                      <div className="mt-1 text-text-secondary leading-snug">
                                        {level.approved
                                          ? [
                                              level.signerDisplayName,
                                              level.signerCompany,
                                              level.signerRoleLabel,
                                            ]
                                              .filter(Boolean)
                                              .join(" - ")
                                          : inspectionDetail.workflowSummary
                                                  ?.currentUserCanApprove &&
                                                inspectionDetail.workflowSummary
                                                  ?.pendingStep?.stepOrder ===
                                                  level.stepOrder
                                            ? "Your approval is active at this level."
                                            : inspectionDetail.workflowSummary
                                                    ?.currentUserFutureLevels?.includes?.(level.stepOrder)
                                              ? `Waiting for earlier level before level ${level.stepOrder} activates.`
                                              : "Awaiting approval"}
                                        {level.autoInherited
                                          ? " (auto-filled by higher level approval)"
                                          : ""}
                                      </div>
                                      {level.approvedAt && (
                                        <div className="mt-1 text-text-muted">
                                          {new Date(level.approvedAt).toLocaleString()}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : stage.signatures?.length > 0 ? (
                                <div className="space-y-2">
                                  {stage.signatures.map(
                                    (signature: any, sigIdx: number) => (
                                      <div
                                        key={`stage-signature-${stage.id}-${sigIdx}`}
                                        className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 text-xs"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <span className="font-semibold text-text-primary">
                                            {formatSignatureAction(signature)}
                                          </span>
                                          {signature.signedAt && (
                                            <span className="text-text-muted">
                                              {new Date(
                                                signature.signedAt,
                                              ).toLocaleString()}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-text-secondary">
                                          {formatSignatureMeta(signature)}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : (
                                <div className="rounded-lg border border-dashed border-border-default px-3 py-2 text-xs text-text-muted">
                                  No stage approval recorded yet.
                                </div>
                              )}
                            </div>
                            <div className="divide-y">
                              {[...(stage.items || [])]
                                .sort(
                                  (a: any, b: any) =>
                                    (a.itemTemplate?.sequence || 0) -
                                    (b.itemTemplate?.sequence || 0),
                                )
                                .map((item: any) => (
                                  <div
                                    key={item.id}
                                    className="p-3 flex gap-3 hover:bg-surface-base transition-colors"
                                  >
                                    <div className="mt-0.5 shrink-0 flex gap-2">
                                      <button
                                        onClick={() =>
                                          handleItemValueChange(
                                            item.id,
                                            item.value === "YES" ? "" : "YES",
                                          )
                                        }
                                        disabled={
                                          (stage.isLocked && !isAdmin) ||
                                          (inspectionDetail.isLocked && !isAdmin) ||
                                          ![
                                            "PENDING",
                                            "PARTIALLY_APPROVED",
                                          ].includes(inspectionDetail.status)
                                        }
                                        className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors disabled:opacity-50 border ${item.value === "YES" || (item.isOk && item.value !== "NA") ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-surface-card border-border-strong text-text-secondary hover:bg-surface-base"}`}
                                      >
                                        YES
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleItemValueChange(
                                            item.id,
                                            item.value === "NA" ? "" : "NA",
                                          )
                                        }
                                        disabled={
                                          (stage.isLocked && !isAdmin) ||
                                          (inspectionDetail.isLocked && !isAdmin) ||
                                          ![
                                            "PENDING",
                                            "PARTIALLY_APPROVED",
                                          ].includes(inspectionDetail.status)
                                        }
                                        className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors disabled:opacity-50 border ${item.value === "NA" ? "bg-amber-100 border-amber-300 text-amber-700" : "bg-surface-card border-border-strong text-text-secondary hover:bg-surface-base"}`}
                                      >
                                        NA
                                      </button>
                                    </div>
                                    <div className="flex-1">
                                      <p
                                        className={`text-sm ${item.value === "YES" || item.value === "NA" || item.isOk ? "text-text-secondary font-medium" : "text-text-primary"}`}
                                      >
                                        {item.itemTemplate?.itemText ||
                                          "Checklist Item"}
                                      </p>
                                      {[
                                        "PENDING",
                                        "PARTIALLY_APPROVED",
                                      ].includes(inspectionDetail.status) ? (
                                        <input
                                          type="text"
                                          placeholder="Add remarks..."
                                          value={item.remarks || ""}
                                          onChange={(e) =>
                                            handleItemRemarksChange(
                                              item.id,
                                              e.target.value,
                                            )
                                          }
                                          disabled={
                                            (stage.isLocked && !isAdmin) ||
                                            (inspectionDetail.isLocked && !isAdmin)
                                          }
                                          className="mt-2 w-full text-sm border-border-strong rounded-md shadow-sm focus:ring-secondary focus:border-secondary"
                                        />
                                      ) : (
                                        item.remarks && (
                                          <p className="mt-1 text-xs text-text-muted italic">
                                            Remark: {item.remarks}
                                          </p>
                                        )
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                            {["PENDING", "PARTIALLY_APPROVED"].includes(
                              inspectionDetail.status,
                            ) &&
                              (!inspectionDetail.isLocked || isAdmin) && (
                              <div className="border-t bg-surface-base px-4 py-3">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="text-xs text-text-muted">
                                      {isStageApproved(stage)
                                        ? "This stage is already approved and locked."
                                        : isStageChecklistComplete(stage)
                                        ? stageApproval?.pendingDisplay
                                          ? `Checklist complete. Approving now will record up to your allowed level. Remaining: ${stageApproval.pendingDisplay}.`
                                          : "All checklist items are complete. This stage is ready for approval."
                                        : "Complete all checklist items in this stage, then approve it."}
                                      {!isStageApproved(stage) &&
                                      stageActionReason ? (
                                        <div className="mt-1 text-blue-700">
                                          {stageActionReason}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setSelectedObservationStageId(stage.id);
                                        setShowObsModal(true);
                                      }}
                                      className="px-4 py-2 bg-surface-card border border-amber-200 text-amber-700 rounded-lg hover:bg-warning-muted text-sm font-medium"
                                    >
                                      Observations ({getStagePendingObservationCount(stage.id)})
                                    </button>
                                      <button
                                        onClick={() => handleApproveStage(stage)}
                                      disabled={Boolean(stageActionReason)}
                                      className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark disabled:opacity-50 text-sm font-medium"
                                      title={stageActionReason || ""}
                                    >
                                      <ShieldCheck className="w-4 h-4 inline mr-1" />
                                      {getStageActionLabel(stage)}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Final Action Bar */}
                {["PENDING", "PARTIALLY_APPROVED"].includes(
                  inspectionDetail.status,
                ) &&
                  (!inspectionDetail.isLocked || isAdmin) && (
                  <div className="border-t border-border-default bg-surface-card px-4 py-2.5">
                    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="text-xs min-h-5">
                        <span className="text-text-secondary font-medium flex items-center gap-1.5">
                          <Clock className="w-4 h-4" /> Checklist approval is stage-driven. Each stage must complete all release-strategy levels, and the checklist will auto-approve once every stage is complete.
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <button
                          onClick={handleReject}
                          className="px-4 py-2 bg-surface-card border border-red-200 text-error rounded-lg hover:bg-error-muted focus:ring-2 focus:ring-red-200 font-medium text-sm border-l"
                        >
                          Reject
                        </button>
                        {workflowState && (
                          <button
                            onClick={() => {
                              fetchEligibleUsers();
                              setShowDelegationModal(true);
                            }}
                            className="px-4 py-2 bg-surface-card border border-indigo-200 text-secondary rounded-lg hover:bg-secondary-muted focus:ring-2 focus:ring-indigo-200 font-medium text-sm flex items-center gap-2"
                          >
                            <UserCheck className="w-4 h-4" /> Delegate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </main>
        </div>

        {/* Raise Observation Modal */}
        {showObsModal && (
          <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center z-50 p-4">
            <div className="bg-surface-card rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-6 border-b shrink-0">
                <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <MessageSquareWarning className="w-6 h-6 text-warning" />
                  Observation Log
                </h3>
                <button
                  onClick={() => setShowObsModal(false)}
                  className="text-text-disabled hover:text-text-secondary"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-base">
                {/* Observations Header / Tabs */}
                <div className="space-y-4">
                  {legacyObservations.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-semibold text-amber-900">
                              Legacy Activity Observations
                            </h4>
                            <p className="mt-1 text-xs text-amber-800">
                              These observations were created without linking to
                              a specific RFI, GO, or unit. They are shown
                              separately so they do not appear as if they belong
                              to this inspection.
                            </p>
                          </div>

                          {filteredLegacyObservations.length > 0 ? (
                            <div className="space-y-2">
                              {filteredLegacyObservations.map((obs, idx) => (
                                <div
                                  key={obs.id}
                                  className="rounded-lg border border-amber-200 bg-white/80 p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                                        Legacy Observation #{idx + 1}
                                      </div>
                                      <p className="mt-1 text-sm text-amber-950">
                                        {obs.observationText}
                                      </p>
                                      <div className="mt-1 text-[11px] text-amber-800">
                                        Status: {obs.status}
                                      </div>
                                    </div>
                                    {hasPermission(
                                      PermissionCode.QUALITY_OBSERVATION_DELETE,
                                    ) && (
                                      <button
                                        onClick={() =>
                                          handleDeleteObservation(obs.id)
                                        }
                                        className="rounded p-1 text-amber-700 transition-colors hover:bg-amber-100 hover:text-error"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs italic text-amber-700">
                              No legacy observations match the current tab.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 border-b border-border-default pb-2">
                    {(["PENDING", "RECTIFIED", "CLOSED", "ALL"] as const).map(
                      (tab) => (
                        <button
                          key={tab}
                          onClick={() => setObsTab(tab)}
                          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                            obsTab === tab
                              ? "border-amber-600 text-amber-700"
                              : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-raised rounded-t"
                          }`}
                        >
                          {tab === "PENDING"
                            ? "Pending"
                            : tab === "RECTIFIED"
                              ? "Rectified"
                              : tab === "CLOSED"
                                ? "Closed"
                                : "All"}
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-surface-raised text-text-secondary">
                            {tab === "ALL"
                              ? observations.length
                              : tab === "PENDING"
                                ? observations.filter(
                                    (o) =>
                                      o.status === "PENDING" ||
                                      o.status === "OPEN",
                                  ).length
                                : tab === "RECTIFIED"
                                  ? observations.filter(
                                      (o) =>
                                        o.status === "RECTIFIED" ||
                                        o.status === "RESOLVED",
                                    ).length
                                  : observations.filter(
                                      (o) => o.status === "CLOSED",
                                    ).length}
                          </span>
                        </button>
                      ),
                    )}
                  </div>

                  {filteredObservations.length === 0 ? (
                    <div className="text-text-muted text-sm italic py-4">
                      No observations match the selected tab.
                    </div>
                  ) : (
                    filteredObservations.map((obs, idx) => {
                      const ageInfo = getDaysOpen(obs.createdAt);
                      return (
                        <div
                          key={obs.id}
                          className="bg-surface-card rounded-xl p-4 shadow-sm border"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${
                                  obs.status === "PENDING"
                                    ? "bg-amber-100 text-amber-800"
                                    : obs.status === "RECTIFIED" ||
                                        obs.status === "RESOLVED"
                                      ? "bg-info-muted text-blue-800"
                                      : "bg-surface-raised text-text-secondary"
                                }`}
                              >
                                {obs.status === "RESOLVED"
                                  ? "RECTIFIED"
                                  : obs.status}
                              </span>
                              <span className="text-xs font-semibold text-text-muted">
                                [{obs.type || "Minor"}] #{idx + 1}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {hasPermission(
                                PermissionCode.QUALITY_OBSERVATION_DELETE,
                              ) && (
                                <button
                                  onClick={() =>
                                    handleDeleteObservation(obs.id)
                                  }
                                  className="text-text-disabled hover:text-error transition-colors p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <div className="flex flex-col items-end">
                                <span className="text-xs text-text-disabled">
                                  {new Date(obs.createdAt).toLocaleString()}
                                </span>
                                <span
                                  className={`text-[10px] ${ageInfo.color}`}
                                >
                                  {ageInfo.text}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-text-primary mt-2">
                            {obs.observationText}
                          </p>

                          {obs.photos && obs.photos.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {obs.photos.map((url: string, pIdx: number) => (
                                <a
                                  key={pIdx}
                                  href={getFileUrl(url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-16 h-16 rounded-md border overflow-hidden hover:opacity-80 transition-opacity"
                                >
                                  <img
                                    src={getFileUrl(url)}
                                    alt="Observation"
                                    className="w-full h-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          )}

                          {(obs.status === "RECTIFIED" ||
                            obs.status === "RESOLVED") && (
                            <div className="mt-4 p-3 bg-primary-muted border border-blue-100 rounded-lg">
                              <p className="text-xs font-bold text-blue-900 mb-1">
                                Rectification Details (From Site Team):
                              </p>
                              <p className="text-sm text-blue-800">
                                {obs.closureText || "No remarks provided."}
                              </p>

                              {obs.closureEvidence &&
                                obs.closureEvidence.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {obs.closureEvidence.map(
                                      (url: string, pIdx: number) => (
                                        <a
                                          key={pIdx}
                                          href={getFileUrl(url)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="w-12 h-12 rounded border border-blue-200 overflow-hidden"
                                        >
                                          <img
                                            src={getFileUrl(url)}
                                            alt="Rectification"
                                            className="w-full h-full object-cover"
                                          />
                                        </a>
                                      ),
                                    )}
                                  </div>
                                )}

                              <div className="mt-3">
                                {canCloseChecklistObservation ? (
                                  <button
                                    onClick={() => handleCloseObservation(obs.id)}
                                    className="px-4 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-dark shadow-sm transition-all"
                                  >
                                    Verify & Close Observation
                                  </button>
                                ) : (
                                  <div className="text-xs font-medium text-blue-900">
                                    Awaiting QC closure authority.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(obs.status === "PENDING" || obs.status === "OPEN") && (
                            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-rose-900">
                                Rectification Update
                              </div>
                              <p className="mt-1 text-sm text-rose-800">
                                Submit contractor/site-team rectification here. QC will verify and close it from this same approval workflow.
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {(resolutionPhotos[obs.id] || []).map(
                                  (url, pIdx) => (
                                    <div
                                      key={pIdx}
                                      className="group relative h-14 w-14"
                                    >
                                      <img
                                        src={getFileUrl(url)}
                                        alt="Rectification"
                                        className="h-full w-full rounded border border-rose-200 object-cover"
                                      />
                                      <button
                                        onClick={() =>
                                          setResolutionPhotos((prev) => ({
                                            ...prev,
                                            [obs.id]: (prev[obs.id] || []).filter(
                                              (_, index) => index !== pIdx,
                                            ),
                                          }))
                                        }
                                        className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ),
                                )}

                                <label
                                  className={`flex h-14 w-14 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-rose-300 bg-white transition-all hover:bg-rose-100 ${
                                    resolveUploadingId === obs.id
                                      ? "pointer-events-none opacity-50"
                                      : ""
                                  }`}
                                >
                                  <Camera className="h-4 w-4 text-rose-500" />
                                  <span className="mt-0.5 text-[8px] font-bold uppercase text-rose-500">
                                    {resolveUploadingId === obs.id ? "..." : "Photo"}
                                  </span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleResolveObservationUpload(obs.id, e)
                                    }
                                  />
                                </label>
                              </div>

                              <textarea
                                className="mt-3 min-h-[88px] w-full rounded-md border border-rose-200 bg-white p-3 text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500"
                                placeholder="Describe how this checklist observation was rectified..."
                                value={resolutionTexts[obs.id] || ""}
                                onChange={(e) =>
                                  setResolutionTexts((prev) => ({
                                    ...prev,
                                    [obs.id]: e.target.value,
                                  }))
                                }
                              />

                              <div className="mt-3 flex justify-end">
                                <button
                                  onClick={() => handleResolveObservation(obs.id)}
                                  disabled={
                                    resolvingId === obs.id ||
                                    resolveUploadingId === obs.id ||
                                    !resolutionTexts[obs.id]?.trim()
                                  }
                                  className="px-4 py-2 rounded-md bg-rose-600 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {resolvingId === obs.id
                                    ? "Submitting..."
                                    : "Submit Rectification"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add New Observation Form */}
                <div className="bg-surface-card rounded-xl p-5 shadow-sm border border-border-default">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-warning" /> Add New
                    Observation
                  </h4>

                  {selectedObservationStageId != null && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      New observations added here will be linked to the selected checklist stage, but the log above now shows all observations for this RFI so QC can rectify and close them from one place.
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">
                        Severity Type
                      </label>
                      <select
                        value={obsType}
                        onChange={(e) => setObsType(e.target.value)}
                        className="w-full sm:w-1/3 border-border-strong rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                      >
                        <option value="Minor">Minor</option>
                        <option value="Major">Major</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">
                        Description
                      </label>
                      <textarea
                        className="w-full border-border-strong rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[100px]"
                        placeholder="Describe the issue specifically so the site team can fix it..."
                        value={obsText}
                        onChange={(e) => setObsText(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        Evidence Photos
                      </label>
                      <div className="flex flex-wrap gap-3 items-center">
                        {currentPhotos.map((url, idx) => (
                          <div key={idx} className="relative w-20 h-20 group">
                            <img
                              src={getFileUrl(url)}
                              alt="Preview"
                              className="w-full h-full object-cover rounded-lg border shadow-sm"
                            />
                            <button
                              onClick={() =>
                                setCurrentPhotos((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
                              }
                              className="absolute -top-2 -right-2 bg-error text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <label
                          className={`w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-border-default rounded-lg hover:border-amber-400 hover:bg-warning-muted transition-all cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          <Camera className="w-6 h-6 text-text-disabled" />
                          <span className="text-[10px] text-text-muted mt-1 font-medium">
                            {uploading ? "Uploading..." : "Add Photo"}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleRaiseObservation}
                        disabled={savingObs || !obsText.trim() || uploading}
                        className="px-6 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 shadow-md transform active:scale-95 transition-all"
                      >
                        {savingObs ? "Submitting..." : "Submit Observation"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reversal Modal */}
      {showReversalModal && inspectionDetail && (
        <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text-primary">
                  Reverse RFI #{inspectionDetail.id}
                </h3>
                <p className="text-sm text-text-muted">
                  {inspectionDetail.activity?.activityName}
                </p>
              </div>
            </div>
            <div className="bg-warning-muted border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
              <strong>Warning:</strong> Reversing will change the status to
              REVERSED. The raiser will be notified. All signatures are
              preserved for audit.
            </div>
            <div>
              <label className="block text-sm font-bold text-text-secondary mb-1">
                Reason for Reversal *
              </label>
              <textarea
                rows={4}
                className="w-full bg-surface-base border border-border-default rounded-xl p-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Explain why this approval is being reversed..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
              />
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowReversalModal(false);
                  setReversalReason("");
                }}
                className="px-6 py-3 rounded-xl font-bold text-text-secondary bg-surface-raised hover:bg-gray-200 transition-colors flex-1"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!reversalReason.trim()) return alert("Reason required");
                  setReversalLoading(true);
                  try {
                    await api.post(
                      `/quality/inspections/${inspectionDetail.id}/workflow/reverse`,
                      { reason: reversalReason },
                    );
                    alert("RFI reversed. Raiser notified.");
                    setShowReversalModal(false);
                    setReversalReason("");
                    setSelectedInspectionId(null);
                    setRefreshKey((k) => k + 1);
                  } catch (err: any) {
                    alert(err.response?.data?.message || "Reversal failed.");
                  } finally {
                    setReversalLoading(false);
                  }
                }}
                disabled={reversalLoading || !reversalReason.trim()}
                className="px-6 py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {reversalLoading ? "Reversing..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Signature Modals */}
      <SignatureModal
        isOpen={showFinalApproveSig}
        onClose={() => {
          setShowFinalApproveSig(false);
          setActiveStageId(null);
        }}
        onSign={executeFinalApprove}
        title={activeStageId != null ? "Stage Approval Signature" : "Final Approval Signature"}
        description={
          activeStageId != null
            ? "Sign to approve this checklist stage."
            : "Sign to grant final approval for this RFI."
        }
      />
      {/* Delegation Modal */}
      {showDelegationModal && (
        <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center z-[60] p-4">
          <div className="bg-surface-card rounded-2xl shadow-2xl w-full max-w-md flex flex-col p-6">
            <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-secondary" />
              Delegate Approval Step
            </h3>
            <p className="text-sm text-text-muted mb-6">
              Select a user to delegate this approval step to. They will be
              notified and can approve on your behalf.
            </p>

            <div className="space-y-4 mb-8">
              <label className="block text-xs font-bold text-text-muted uppercase">
                Select Approver
              </label>
              <select
                className="w-full p-2.5 bg-surface-base border border-border-default rounded-lg text-sm focus:ring-2 focus:ring-secondary"
                onChange={(e) => setSelectedDelegateId(Number(e.target.value))}
                value={selectedDelegateId || ""}
              >
                <option value="">-- Choose User --</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}{u.company ? ` • ${u.company}` : ""})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDelegationModal(false)}
                className="flex-1 px-4 py-2 border border-border-default rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-base"
              >
                Cancel
              </button>
              <button
                onClick={handleDelegate}
                disabled={!selectedDelegateId || delegating}
                className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark disabled:opacity-50"
              >
                {delegating ? "Delegating..." : "Confirm Delegation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
