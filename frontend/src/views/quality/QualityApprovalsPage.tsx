import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
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
  ChevronDown,
  ChevronUp,
  Layers,
  Home,
  Siren,
} from "lucide-react";
import api from "../../api/axios";
import SignatureModal from "../../components/quality/SignatureModal";

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
  partNo?: number;
  partLabel?: string;
  locationPath?: string;
  pendingObservationCount?: number;
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
  };
  slaDueAt?: string;
  isLocked?: boolean;
  stages?: any[]; // Populated in detail view
}

type ApprovalTab = "PENDING" | "ALL" | "APPROVED" | "REJECTED" | "DASHBOARD";
type SavedView =
  | "All Pending"
  | "Overdue Focus"
  | "High Risk"
  | "Ready For Closeout";
type SlaBucket = "All" | "Overdue" | "Due <24h" | "Due 24-48h" | "Upcoming";

const APPROVAL_TABS: Array<{ key: ApprovalTab; label: string }> = [
  { key: "PENDING", label: "Pending QC" },
  { key: "ALL", label: "All RFIs" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DASHBOARD", label: "Dashboard" },
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

function isPendingStatus(status: QualityInspection["status"]) {
  return status === "PENDING" || status === "PARTIALLY_APPROVED";
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

export default function QualityApprovalsPage() {
  const { projectId } = useParams();
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
  const [observations, setObservations] = useState<any[]>([]);
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

  useEffect(() => {
    if (selectedInspectionId) {
      setWorkflowStripCollapsed(true);
    }
  }, [selectedInspectionId]);

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

  // Helper for correct image URLs
  const getFileUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    return `${baseUrl}${path}`;
  };

  // Filter states
  const [filterStatus, setFilterStatus] = useState<ApprovalTab>("PENDING");
  const [selectedFloor, setSelectedFloor] = useState("All Floors");
  const [selectedSlaBucket, setSelectedSlaBucket] = useState<SlaBucket>("All");
  const [selectedView, setSelectedView] = useState<SavedView>("All Pending");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  useEffect(() => {
    if (projectId) {
      setLoadingList(true);
      api
        .get("/quality/inspections", {
          params: { projectId },
        })
        .then((res) => {
          setInspections(res.data);
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
        .then(([detailRes, flowRes]) => {
          setInspectionDetail(detailRes.data);
          setWorkflowState(flowRes.data);

          // Fetch observations for this activity
          if (detailRes.data.activityId) {
            api
              .get(
                `/quality/activities/${detailRes.data.activityId}/observations`,
              )
              .then((obsRes) => setObservations(obsRes.data))
              .catch((err) =>
                console.error("Failed to load observations", err),
              );
          }
        })
        .finally(() => setLoadingDetail(false));
    } else {
      setInspectionDetail(null);
      setWorkflowState(null);
      setObservations([]);
    }
  }, [selectedInspectionId, refreshKey]);

  const filteredInspections = useMemo(() => {
    if (filterStatus === "DASHBOARD") return inspections;
    return inspections.filter(
      (i) => filterStatus === "ALL" || i.status === filterStatus,
    );
  }, [inspections, filterStatus]);

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

  const stageScopedObservations = useMemo(() => {
    if (selectedObservationStageId == null) return observations;
    return observations.filter((o) => o.stageId === selectedObservationStageId);
  }, [observations, selectedObservationStageId]);

  const filteredObservations = useMemo(() => {
    if (obsTab === "PENDING")
      return stageScopedObservations.filter(
        (o) => o.status === "PENDING" || o.status === "OPEN",
      );
    if (obsTab === "RECTIFIED")
      return stageScopedObservations.filter((o) => o.status === "RECTIFIED");
    if (obsTab === "CLOSED")
      return stageScopedObservations.filter(
        (o) => o.status === "CLOSED" || o.status === "RESOLVED",
      );
    return stageScopedObservations;
  }, [stageScopedObservations, obsTab]);

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

  return (
    <>
      <div className="h-full flex flex-col bg-surface-base">
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
                  onClick={() => setFilterStatus(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Panel: List of RFIs */}
          <aside
            className={`${selectedInspectionId && filterStatus !== "DASHBOARD" ? "hidden" : "flex"} ${filterStatus === "DASHBOARD" ? "w-full border-r-0" : "w-[420px] border-r"} bg-surface-card flex-col shrink-0 flex-grow-0`}
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
                                setSelectedInspectionId(insp.id);
                                setFilterStatus("PENDING");
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
                  return (
                    <div
                      key={insp.id}
                      onClick={() => setSelectedInspectionId(insp.id)}
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
                        {(insp.pendingObservationCount || 0) > 0 && (
                          <span className="text-red-700 inline-flex items-center gap-1">
                            <Siren className="w-3 h-3" />{" "}
                            {insp.pendingObservationCount} obs
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-[11px]">
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
            className={`${filterStatus === "DASHBOARD" ? "hidden" : "flex-1"} min-w-0 bg-surface-base flex flex-col relative overflow-hidden`}
          >
            {!selectedInspectionId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-disabled">
                <ClipboardCheck className="w-16 h-16 mb-4 text-gray-200" />
                <h3 className="text-lg font-medium text-text-primary mb-1">
                  {filterStatus === "DASHBOARD"
                    ? "Dashboard Active"
                    : "Select an RFI"}
                </h3>
                <p className="max-w-sm text-center">
                  {filterStatus === "DASHBOARD"
                    ? "Use the left dashboard priority queue to open a specific RFI, or switch tabs to browse by status."
                    : "Select an RFI from the left panel to review and execute its checklist."}
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
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
                              const isCompleted = step.status === "COMPLETED";
                              const isRejected = step.status === "REJECTED";
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

                              let colorClass =
                                "bg-surface-raised text-text-muted border-border-default";
                              if (isCompleted)
                                colorClass =
                                  "bg-green-100 text-green-700 border-green-200";
                              if (isRejected)
                                colorClass =
                                  "bg-red-100 text-red-700 border-red-200";
                              if (isCurrent)
                                colorClass =
                                  "bg-indigo-100 text-indigo-700 border-indigo-300 ring-2 ring-indigo-200";

                              const stepLabel =
                                isLastStepNode && !isRaiserStep
                                  ? "Final Approval"
                                  : step.stepName ||
                                    step.workflowNode?.label ||
                                    `Step ${step.stepOrder}`;
                              const stepSubtitle = isCompleted
                                ? isRaiserStep
                                  ? "RFI Raised"
                                  : `Signed by ${step.signerDisplayName || step.signedBy}${step.signerCompany ? ` - ${step.signerCompany}` : ""}${step.signerRole ? ` - ${step.signerRole}` : ""}`
                                : isRejected
                                  ? "Rejected"
                                  : isCurrent
                                    ? `Pending Approval${step.stepName ? ` - ${step.stepName}` : ""}`
                                    : "Waiting";

                              return (
                                <div
                                  key={step.id}
                                  className="flex items-center gap-2 shrink-0"
                                >
                                  <div
                                    className={`flex flex-col border rounded-lg px-2.5 py-1 ${colorClass}`}
                                  >
                                    <span className="text-[10px] font-bold uppercase">
                                      {stepLabel}
                                    </span>
                                    <span className="text-[10px] truncate max-w-[100px]">
                                      {stepSubtitle}
                                    </span>
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

                    {!inspectionDetail.stages ||
                    inspectionDetail.stages.length === 0 ? (
                      <div className="bg-surface-card p-6 rounded-xl border text-center text-text-muted">
                        No checklist template assigned to this activity.
                      </div>
                    ) : (
                      inspectionDetail.stages.map((stage: any, sIdx: number) => {
                        const stageApproval = stage.stageApproval;
                        const stageLevels = stageApproval?.levels || [];
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
                                      disabled={
                                        !canApproveInspection ||
                                        isStageApproved(stage) ||
                                        inspectionDetail.isLocked ||
                                        !isStageChecklistComplete(stage) ||
                                        getStagePendingObservationCount(stage.id) > 0
                                      }
                                      className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark disabled:opacity-50 text-sm font-medium"
                                      title={
                                        !canApproveInspection
                                          ? "You do not have approval access for this stage."
                                          : getStagePendingObservationCount(stage.id) > 0
                                            ? "Close all observations for this stage before approval."
                                          : !isStageChecklistComplete(stage)
                                            ? "Complete all checklist items in this stage before approval."
                                            : ""
                                      }
                                    >
                                      <ShieldCheck className="w-4 h-4 inline mr-1" />
                                      Approve Stage
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
                                : observations.filter(
                                    (o) =>
                                      o.status === "CLOSED" ||
                                      o.status === "RECTIFIED" ||
                                      o.status === "RESOLVED",
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
                                    : obs.status === "RECTIFIED"
                                      ? "bg-info-muted text-blue-800"
                                      : "bg-surface-raised text-text-secondary"
                                }`}
                              >
                                {obs.status}
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

                          {obs.status === "RECTIFIED" && (
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
                                <button
                                  onClick={() => handleCloseObservation(obs.id)}
                                  className="px-4 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-dark shadow-sm transition-all"
                                >
                                  Verify & Close Observation
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
