import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/quality/QualityApprovalsPage.tsx");import.meta.env = {"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false, "VITE_API_URL": "http://localhost:3000", "VITE_PDF_TOOL_URL": "http://localhost:8002"};import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=9bf30538"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
var _s = $RefreshSig$();
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=9bf30538"; const useState = __vite__cjsImport1_react["useState"]; const useEffect = __vite__cjsImport1_react["useEffect"]; const useMemo = __vite__cjsImport1_react["useMemo"];
import { useParams } from "/node_modules/.vite/deps/react-router-dom.js?v=9bf30538";
import { useAuth } from "/src/context/AuthContext.tsx";
import { PermissionCode } from "/src/config/permissions.ts";
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
  Layers,
  Home,
  Siren
} from "/node_modules/.vite/deps/lucide-react.js?v=9bf30538";
import api from "/src/api/axios.ts";
import SignatureModal from "/src/components/quality/SignatureModal.tsx";
const APPROVAL_TABS = [
  { key: "PENDING", label: "Pending QC" },
  { key: "ALL", label: "All RFIs" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DASHBOARD", label: "Dashboard" }
];
const SAVED_VIEWS = [
  "All Pending",
  "Overdue Focus",
  "High Risk",
  "Ready For Closeout"
];
const SLA_BUCKETS = [
  "All",
  "Overdue",
  "Due <24h",
  "Due 24-48h",
  "Upcoming"
];
function isPendingStatus(status) {
  return status === "PENDING" || status === "PARTIALLY_APPROVED";
}
function parseLocationHierarchy(insp) {
  const explicit = [
    insp.blockName,
    insp.towerName,
    insp.floorName,
    insp.unitName,
    insp.roomName
  ].filter((x) => !!x && x.trim().length > 0).map((x) => x.trim());
  if (explicit.length > 0) {
    return explicit;
  }
  const raw = insp.locationPath || insp.epsNode?.label || insp.epsNode?.name || "";
  return raw.split(/[>|/,]/g).map((s) => s.trim()).filter(Boolean);
}
function getFloorLabel(insp) {
  if (insp.floorName) return insp.floorName;
  const hierarchy = parseLocationHierarchy(insp);
  return hierarchy.find((h) => h.toLowerCase().includes("floor")) || "Unmapped";
}
function isStageApproved(stage) {
  if (stage?.status === "APPROVED" || stage?.isLocked) return true;
  return (stage?.signatures || []).some(
    (signature) => signature?.actionType === "STAGE_APPROVE" && !signature?.isReversed
  );
}
function getCheckedStageItems(stage) {
  return (stage?.items || []).filter(
    (item) => item?.value === "YES" || item?.value === "NA" || item?.isOk
  ).length;
}
function isStageChecklistComplete(stage) {
  const totalItems = stage?.items?.length || 0;
  return totalItems > 0 && getCheckedStageItems(stage) === totalItems;
}
function getSlaBucket(insp) {
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
function getPriorityScore(insp) {
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
  _s();
  const { projectId } = useParams();
  const [inspections, setInspections] = useState([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState(
    null
  );
  const [inspectionDetail, setInspectionDetail] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [workflowState, setWorkflowState] = useState(null);
  const [observations, setObservations] = useState([]);
  const [obsTab, setObsTab] = useState(
    "PENDING"
  );
  const [showObsModal, setShowObsModal] = useState(false);
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState([]);
  const [selectedDelegateId, setSelectedDelegateId] = useState(
    null
  );
  const [obsText, setObsText] = useState("");
  const [obsType, setObsType] = useState("Minor");
  const [currentPhotos, setCurrentPhotos] = useState([]);
  const [savingObs, setSavingObs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalLoading, setReversalLoading] = useState(false);
  const [showFinalApproveSig, setShowFinalApproveSig] = useState(false);
  const [activeStageId, setActiveStageId] = useState(null);
  const { user, hasPermission } = useAuth();
  const isAdmin = hasPermission(PermissionCode.QUALITY_INSPECTION_DELETE);
  const canApproveInspection = hasPermission(
    PermissionCode.QUALITY_INSPECTION_APPROVE
  );
  const getFileUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    return `${baseUrl}${path}`;
  };
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [selectedFloor, setSelectedFloor] = useState("All Floors");
  const [selectedSlaBucket, setSelectedSlaBucket] = useState("All");
  const [selectedView, setSelectedView] = useState("All Pending");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  useEffect(() => {
    if (projectId) {
      setLoadingList(true);
      api.get("/quality/inspections", {
        params: { projectId }
      }).then((res) => {
        setInspections(res.data);
      }).finally(() => setLoadingList(false));
    }
  }, [projectId, refreshKey]);
  useEffect(() => {
    if (selectedInspectionId) {
      setLoadingDetail(true);
      Promise.all(
        [
          api.get(`/quality/inspections/${selectedInspectionId}`),
          api.get(`/quality/inspections/${selectedInspectionId}/workflow`).catch(() => ({ data: null }))
        ]
      ).then(([detailRes, flowRes]) => {
        setInspectionDetail(detailRes.data);
        setWorkflowState(flowRes.data);
        if (detailRes.data.activityId) {
          api.get(
            `/quality/activities/${detailRes.data.activityId}/observations`
          ).then((obsRes) => setObservations(obsRes.data)).catch(
            (err) => console.error("Failed to load observations", err)
          );
        }
      }).finally(() => setLoadingDetail(false));
    } else {
      setInspectionDetail(null);
      setWorkflowState(null);
      setObservations([]);
    }
  }, [selectedInspectionId, refreshKey]);
  const filteredInspections = useMemo(() => {
    if (filterStatus === "DASHBOARD") return inspections;
    return inspections.filter(
      (i) => filterStatus === "ALL" || i.status === filterStatus
    );
  }, [inspections, filterStatus]);
  const approvalMetrics = useMemo(() => {
    const pending = inspections.filter((i) => isPendingStatus(i.status));
    const approved = inspections.filter(
      (i) => i.status === "APPROVED" || i.status === "PROVISIONALLY_APPROVED"
    );
    const rejected = inspections.filter((i) => i.status === "REJECTED");
    const floorMap = /* @__PURE__ */ new Map();
    inspections.forEach((i) => {
      const floor = getFloorLabel(i);
      const arr = floorMap.get(floor) || [];
      arr.push(i);
      floorMap.set(floor, arr);
    });
    const floorsPending = Array.from(floorMap.values()).filter(
      (rows) => rows.some((x) => isPendingStatus(x.status))
    ).length;
    const floorsCompleted = Array.from(floorMap.values()).filter(
      (rows) => rows.length > 0 && rows.every(
        (x) => x.status === "APPROVED" || x.status === "PROVISIONALLY_APPROVED"
      )
    ).length;
    return {
      pending,
      approved,
      rejected,
      floorMap,
      floorsPending,
      floorsCompleted
    };
  }, [inspections]);
  const dashboardQueue = useMemo(
    () => {
      let queue = approvalMetrics.pending;
      if (selectedView === "Overdue Focus")
        queue = queue.filter((i) => getSlaBucket(i) === "Overdue");
      if (selectedView === "High Risk")
        queue = queue.filter((i) => getPriorityScore(i) >= 140);
      if (selectedView === "Ready For Closeout")
        queue = queue.filter(
          (i) => (i.stages?.length || 0) > 0 && (i.stages || []).every(
            (s) => s.items?.every(
              (it) => it.value === "YES" || it.value === "NA" || it.isOk
            )
          ) && (i.pendingObservationCount || 0) === 0
        );
      if (selectedFloor !== "All Floors")
        queue = queue.filter((i) => getFloorLabel(i) === selectedFloor);
      if (selectedSlaBucket !== "All")
        queue = queue.filter((i) => getSlaBucket(i) === selectedSlaBucket);
      if (showOverdueOnly)
        queue = queue.filter((i) => getSlaBucket(i) === "Overdue");
      return [...queue].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
    },
    [
      approvalMetrics.pending,
      selectedView,
      selectedFloor,
      selectedSlaBucket,
      showOverdueOnly
    ]
  );
  const dashboardStats = useMemo(() => {
    const overdueCount = approvalMetrics.pending.filter(
      (i) => getSlaBucket(i) === "Overdue"
    ).length;
    const due24 = approvalMetrics.pending.filter(
      (i) => getSlaBucket(i) === "Due <24h"
    ).length;
    const due48 = approvalMetrics.pending.filter(
      (i) => getSlaBucket(i) === "Due 24-48h"
    ).length;
    const upcoming = approvalMetrics.pending.filter(
      (i) => getSlaBucket(i) === "Upcoming"
    ).length;
    const missingLocation = inspections.filter(
      (i) => parseLocationHierarchy(i).length === 0
    ).length;
    const missingWorkflow = inspections.filter(
      (i) => !i.workflowTotalLevels && isPendingStatus(i.status)
    ).length;
    return {
      overdueCount,
      due24,
      due48,
      upcoming,
      missingLocation,
      missingWorkflow
    };
  }, [approvalMetrics.pending, inspections]);
  const filteredObservations = useMemo(() => {
    if (obsTab === "PENDING")
      return observations.filter(
        (o) => o.status === "PENDING" || o.status === "OPEN"
      );
    if (obsTab === "RECTIFIED")
      return observations.filter((o) => o.status === "RECTIFIED");
    if (obsTab === "CLOSED")
      return observations.filter(
        (o) => o.status === "CLOSED" || o.status === "RESOLVED"
      );
    return observations;
  }, [observations, obsTab]);
  const getDaysOpen = (createdAt) => {
    const days = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 864e5
    );
    if (days === 0) return { text: "Today", color: "text-success" };
    if (days === 1) return { text: "1 day ago", color: "text-success" };
    if (days <= 3) return { text: `${days} days ago`, color: "text-success" };
    if (days <= 7) return { text: `${days} days ago`, color: "text-warning" };
    return { text: `${days} days ago`, color: "text-error font-bold" };
  };
  const handleItemValueChange = (itemId, val) => {
    setInspectionDetail((prev) => {
      if (!prev) return prev;
      const newStages = prev.stages.map((stage) => ({
        ...stage,
        items: stage.items.map(
          (item) => item.id === itemId ? { ...item, value: val, isOk: val === "YES" || val === "NA" } : item
        )
      }));
      return { ...prev, stages: newStages };
    });
  };
  const handleItemRemarksChange = (itemId, val) => {
    setInspectionDetail((prev) => {
      if (!prev) return prev;
      const newStages = prev.stages.map((stage) => ({
        ...stage,
        items: stage.items.map(
          (item) => item.id === itemId ? { ...item, remarks: val } : item
        )
      }));
      return { ...prev, stages: newStages };
    });
  };
  const itemIsChecked = (item) => item?.value === "YES" || item?.value === "NA" || item?.isOk;
  const stageHasCheckedItems = (stage) => (stage.items || []).some((it) => itemIsChecked(it));
  const saveChecklistProgress = async (stageId, silent = false) => {
    if (!inspectionDetail) return false;
    try {
      const stagesToSave = inspectionDetail.stages.filter((stage) => {
        if (typeof stageId === "number" && stage.id !== stageId) return false;
        return stageHasCheckedItems(stage);
      });
      if (stagesToSave.length === 0) {
        if (!silent) {
          alert("No checklist progress entered yet.");
        }
        return false;
      }
      for (const stage of stagesToSave) {
        const checkedCount = stage.items.filter(
          (it) => itemIsChecked(it)
        ).length;
        const totalCount = stage.items.length;
        let stageStatus = stage.status;
        if (checkedCount > 0 && checkedCount < totalCount) {
          stageStatus = "IN_PROGRESS";
        } else if (checkedCount === totalCount && totalCount > 0) {
          stageStatus = "COMPLETED";
        }
        await updateStage(stage.id, {
          status: stageStatus,
          // Keep existing status or update to IN_PROGRESS
          items: stage.items.map((it) => ({
            id: it.id,
            value: it.value,
            isOk: itemIsChecked(it),
            remarks: it.remarks
          }))
        });
      }
      if (!silent) {
        alert(
          stagesToSave.length === 1 ? "Stage checklist saved successfully." : "RFI checklist saved successfully."
        );
      }
      setRefreshKey((k) => k + 1);
      return true;
    } catch (err) {
      if (!silent) {
        alert(err.response?.data?.message || "Failed to save checklist.");
      }
      return false;
    }
  };
  const updateStage = async (stageId, payload) => {
    const stageInspectionId = inspectionDetail?.id || inspections.find(
      (entry) => (entry.stages || []).some((stage) => stage.id === stageId)
    )?.id;
    const attempts = [
      { method: "patch", url: `/quality/inspections/stage/${stageId}` },
      { method: "post", url: `/quality/inspections/stage/${stageId}` }
    ];
    if (stageInspectionId) {
      attempts.push(
        {
          method: "patch",
          url: `/quality/inspections/${stageInspectionId}/stages/${stageId}`
        },
        {
          method: "post",
          url: `/quality/inspections/${stageInspectionId}/stages/${stageId}`
        }
      );
      if (payload.status === "APPROVED" && payload.signature?.data) {
        attempts.push({
          method: "post",
          url: `/quality/inspections/${stageInspectionId}/stages/${stageId}/approve`
        });
      }
    }
    let lastError = null;
    for (const attempt of attempts) {
      try {
        if (attempt.method === "patch") {
          return await api.patch(attempt.url, payload);
        }
        return await api.post(attempt.url, payload);
      } catch (err) {
        lastError = err;
        if (err?.response?.status !== 404) {
          throw err;
        }
      }
    }
    throw lastError;
  };
  const approveStageWithSignature = async (inspectionId, stageId, signatureData) => {
    return api.post(`/quality/inspections/${inspectionId}/stages/${stageId}/approve`, {
      signatureData,
      comments: "Stage approved from checklist stage action"
    });
  };
  const fetchEligibleUsers = async () => {
    try {
      const res = await api.get("/quality/inspections/eligible-approvers/list", {
        params: { projectId }
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
          comments: "Delegated via UI"
        }
      );
      setShowDelegationModal(false);
      const [inspRes, wfRes] = await Promise.all(
        [
          api.get(`/quality/inspections/${selectedInspectionId}`),
          api.get(`/quality/inspections/${selectedInspectionId}/workflow`)
        ]
      );
      setInspectionDetail(inspRes.data);
      setWorkflowState(wfRes.data);
      alert("Step successfully delegated.");
    } catch (err) {
      alert(err.response?.data?.message || "Delegation failed.");
    } finally {
      setDelegating(false);
    }
  };
  const handleInitiateApprove = async () => {
    if (!canApproveInspection) {
      alert("You do not have permission to approve this RFI.");
      return;
    }
    await saveChecklistProgress(void 0, true);
    setShowFinalApproveSig(true);
  };
  const handleApproveStage = async (stage) => {
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
  const executeFinalApprove = async (signatureData) => {
    try {
      if (activeStageId != null && inspectionDetail) {
        await approveStageWithSignature(
          inspectionDetail.id,
          activeStageId,
          signatureData
        );
        alert("Stage approved successfully.");
        setShowFinalApproveSig(false);
        setActiveStageId(null);
        setRefreshKey((k) => k + 1);
        return;
      }
      const readyStages = (inspectionDetail?.stages || []).filter(
        (stage) => !isStageApproved(stage) && stage.items?.length > 0 && stage.items.every((item) => itemIsChecked(item))
      );
      for (const stage of readyStages) {
        await approveStageWithSignature(
          inspectionDetail.id,
          stage.id,
          signatureData
        );
      }
      let latestInspectionDetail = inspectionDetail;
      if (readyStages.length > 0) {
        const refreshedDetail = await api.get(
          `/quality/inspections/${inspectionDetail.id}`
        );
        latestInspectionDetail = refreshedDetail.data;
        setInspectionDetail(refreshedDetail.data);
      }
      const pendingStages = (latestInspectionDetail?.stages || []).filter(
        (stage) => !isStageApproved(stage) && !(stage.items?.length > 0 && stage.items.every((item) => itemIsChecked(item)))
      );
      if (pendingStages.length > 0) {
        throw new Error(
          `Cannot give final approval. The following stages are not yet approved: ${pendingStages.map((stage) => stage.stageTemplate?.name || `Stage #${stage.id}`).join(", ")}`
        );
      }
      if (workflowState) {
        const currentStep = workflowState.steps.find(
          (s) => s.stepOrder === workflowState.currentStepOrder
        );
        const wfRes = await api.post(
          `/quality/inspections/${inspectionDetail.id}/workflow/advance`,
          {
            signatureData,
            signedBy: user?.displayName || user?.username || currentStep?.workflowNode?.label || "Approver",
            comments: "Approved digitally"
          }
        );
        if (wfRes.data?.isFinal) {
          alert(
            "All workflow steps completed. RFI is now fully approved!"
          );
        } else {
          alert("Workflow step approved.");
        }
      } else {
        await api.post(
          `/quality/inspections/${inspectionDetail.id}/final-approve`,
          {
            signatureData,
            comments: "Final Approval given digitally"
          }
        );
        alert("RFI final approval completed.");
      }
      setShowFinalApproveSig(false);
      setActiveStageId(null);
      setSelectedInspectionId(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to approve RFI.");
      setActiveStageId(null);
    }
  };
  const handleReject = async () => {
    const reason = prompt("Please enter rejection reason:");
    if (reason === null) return;
    try {
      for (const stage of inspectionDetail.stages) {
        await updateStage(stage.id, {
          status: "REJECTED",
          items: stage.items.map((it) => ({
            id: it.id,
            value: it.value,
            isOk: it.isOk,
            remarks: it.remarks
          }))
        });
      }
      if (workflowState && workflowState.status === "IN_PROGRESS") {
        await api.post(
          `/quality/inspections/${inspectionDetail.id}/workflow/reject`,
          {
            comments: reason || "Rejected during checklist execution"
          }
        );
      } else {
        await api.patch(`/quality/inspections/${inspectionDetail.id}/status`, {
          status: "REJECTED",
          comments: reason || "Rejected during checklist execution",
          inspectionDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
        });
      }
      alert("RFI rejected.");
      setSelectedInspectionId(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject RFI.");
    }
  };
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setCurrentPhotos((prev) => [...prev, res.data.url]);
    } catch (err) {
      alert(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const handleProvisionallyApprove = async () => {
    const reason = prompt(
      "Please enter justification for Provisional Approval:"
    );
    if (!reason) return;
    try {
      for (const stage of inspectionDetail.stages) {
        await updateStage(stage.id, {
          status: "COMPLETED",
          items: stage.items.map((it) => ({
            id: it.id,
            value: it.value,
            isOk: it.isOk,
            remarks: it.remarks
          }))
        });
      }
      await api.patch(`/quality/inspections/${inspectionDetail.id}/status`, {
        status: "PROVISIONALLY_APPROVED",
        comments: reason,
        inspectionDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      });
      alert("RFI provisionally approved.");
      setSelectedInspectionId(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(
        err.response?.data?.message || "Failed to provisionally approve RFI."
      );
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
          photos: currentPhotos
        }
      );
      alert("Observation Raised.");
      setObsText("");
      setCurrentPhotos([]);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to raise observation.");
    } finally {
      setSavingObs(false);
    }
  };
  const handleCloseObservation = async (obsId) => {
    if (!confirm("Verify and close this observation?")) return;
    try {
      await api.patch(
        `/quality/activities/${inspectionDetail.activityId}/observation/${obsId}/close`
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to close observation.");
    }
  };
  const handleDeleteObservation = async (obsId) => {
    if (!confirm("Permanently delete this observation?")) return;
    try {
      await api.delete(
        `/quality/activities/${inspectionDetail.activityId}/observation/${obsId}`
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete observation.");
    }
  };
  const allChecked = useMemo(() => {
    if (!inspectionDetail?.stages) return false;
    if (inspectionDetail.stages.length === 0) return true;
    return inspectionDetail.stages.every(
      (s) => s.items?.every(
        (i) => i.value === "YES" || i.value === "NA" || i.isOk
      )
    );
  }, [inspectionDetail]);
  const pendingObservationsCount = useMemo(() => {
    return observations.filter((o) => o.status !== "CLOSED").length;
  }, [observations]);
  const formatSignatureMeta = (signature) => {
    const bits = [
      signature?.signerDisplayName || signature?.signedBy,
      signature?.signerCompany,
      signature?.signerRoleLabel || signature?.signerRole
    ].filter(Boolean);
    return bits.join(" - ");
  };
  const formatSignatureAction = (signature) => {
    if (!signature?.actionType) return "Signed";
    if (signature.actionType === "SAVE_PROGRESS") return "Progress Signed";
    if (signature.actionType === "STAGE_APPROVE") return "Stage Approved";
    if (signature.actionType === "FINAL_APPROVE") return "Final Approved";
    return signature.actionType.replaceAll("_", " ");
  };
  const approvalHistory = useMemo(() => {
    if (!inspectionDetail) return [];
    const workflowEntries = (inspectionDetail.workflowSummary?.completedSteps || []).map((step) => ({
      key: `workflow-${step.stepOrder}`,
      scope: "Workflow Level",
      title: `Level ${step.stepOrder}: ${step.stepName || "Approval Step"}`,
      action: (step.minApprovalsRequired || 1) > 1 ? `Workflow Approved (${step.currentApprovalCount || 0}/${step.minApprovalsRequired})` : "Workflow Approved",
      meta: [step.signerDisplayName, step.signerCompany, step.signerRole].filter(Boolean).join(" - "),
      at: step.completedAt || null,
      status: "COMPLETED"
    }));
    const stageEntries = (inspectionDetail.stages || []).flatMap(
      (stage) => (stage.signatures || []).map((signature, index) => ({
        key: `stage-${stage.id}-${index}`,
        scope: "Stage",
        title: stage.stageTemplate?.name || `Stage ${stage.id}`,
        action: formatSignatureAction(signature),
        meta: formatSignatureMeta(signature),
        at: signature.signedAt || signature.createdAt || null,
        status: signature.isReversed ? "REVERSED" : "SIGNED"
      }))
    );
    return [...workflowEntries, ...stageEntries].sort((a, b) => {
      const aTime = a.at ? new Date(a.at).getTime() : 0;
      const bTime = b.at ? new Date(b.at).getTime() : 0;
      return bTime - aTime;
    });
  }, [inspectionDetail]);
  return /* @__PURE__ */ jsxDEV(Fragment, { children: [
    /* @__PURE__ */ jsxDEV("div", { className: "h-full flex flex-col bg-surface-base", children: [
      /* @__PURE__ */ jsxDEV("header", { className: "bg-surface-card border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10 shrink-0", children: /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("h1", { className: "text-xl font-bold text-text-primary flex items-center gap-2", children: [
          /* @__PURE__ */ jsxDEV(ShieldCheck, { className: "w-5 h-5 text-secondary" }, void 0, false, {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 991,
            columnNumber: 15
          }, this),
          "QA/QC Approvals"
        ] }, void 0, true, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 990,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-text-muted mt-1", children: "Review Requests for Inspection (RFI) and execute checklists." }, void 0, false, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 994,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 989,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 988,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "bg-surface-card border-b px-6 py-2 shrink-0", children: /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center gap-2", children: APPROVAL_TABS.map(
        (tab) => /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterStatus === tab.key ? "bg-secondary text-white shadow-sm" : "bg-surface-raised text-text-secondary hover:bg-gray-200"}`,
            onClick: () => setFilterStatus(tab.key),
            children: tab.label
          },
          tab.key,
          false,
          {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 1003,
            columnNumber: 13
          },
          this
        )
      ) }, void 0, false, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 1001,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 1e3,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex-1 flex min-h-0 overflow-hidden", children: [
        /* @__PURE__ */ jsxDEV(
          "aside",
          {
            className: `${filterStatus === "DASHBOARD" ? "w-full border-r-0" : "w-[420px] border-r"} bg-surface-card flex flex-col shrink-0 flex-grow-0`,
            children: [
              /* @__PURE__ */ jsxDEV("div", { className: "p-4 border-b space-y-3", children: /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-3 gap-2 text-xs", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "bg-warning-muted border border-amber-100 rounded-lg px-2 py-1.5", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "text-amber-700 font-bold", children: approvalMetrics.pending.length }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1026,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "text-amber-800/80", children: "Pending" }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1029,
                    columnNumber: 19
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1025,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "bg-success-muted border border-emerald-100 rounded-lg px-2 py-1.5", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "text-emerald-700 font-bold", children: approvalMetrics.approved.length }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1032,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "text-emerald-800/80", children: "Approved" }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1035,
                    columnNumber: 19
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1031,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "bg-error-muted border border-red-100 rounded-lg px-2 py-1.5", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "text-red-700 font-bold", children: approvalMetrics.rejected.length }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1038,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "text-red-800/80", children: "Rejected" }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1041,
                    columnNumber: 19
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1037,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1024,
                columnNumber: 15
              }, this) }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1023,
                columnNumber: 13
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto p-4 space-y-3", children: filterStatus === "DASHBOARD" ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                /* @__PURE__ */ jsxDEV("div", { className: "rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 p-5 text-white shadow-lg", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between gap-4", children: [
                  /* @__PURE__ */ jsxDEV("div", { children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "text-xs uppercase tracking-[0.2em] text-indigo-200", children: "Vision QA Dashboard" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1052,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV("h3", { className: "text-xl font-semibold mt-1", children: "QA/QC Approval Command Center" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1055,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-indigo-100/90 mt-1", children: "Full-screen insights for pending floors, SLA pressure, and risk-prioritized RFIs." }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1058,
                      columnNumber: 25
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1051,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(LayoutDashboard, { className: "w-10 h-10 text-indigo-200" }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1063,
                    columnNumber: 23
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1050,
                  columnNumber: 21
                }, this) }, void 0, false, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1049,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-2 xl:grid-cols-6 gap-3 text-xs", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl bg-surface-card border p-3", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "text-text-muted", children: "Total RFIs" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1069,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "text-2xl font-bold text-text-primary", children: inspections.length }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1070,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1068,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl bg-warning-muted border border-amber-100 p-3", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "text-amber-800/80", children: "Pending" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1075,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "text-2xl font-bold text-amber-700", children: approvalMetrics.pending.length }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1076,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1074,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl bg-success-muted border border-emerald-100 p-3", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "text-emerald-800/80", children: "Approved" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1081,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "text-2xl font-bold text-emerald-700", children: approvalMetrics.approved.length }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1082,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1080,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl bg-error-muted border border-red-100 p-3", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "text-red-800/80", children: "Overdue" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1087,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "text-2xl font-bold text-red-700", children: dashboardStats.overdueCount }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1088,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1086,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl bg-orange-50 border border-orange-100 p-3", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "text-orange-800/80", children: "Floors Pending" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1093,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "text-2xl font-bold text-orange-700", children: approvalMetrics.floorsPending }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1094,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1092,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl bg-teal-50 border border-teal-100 p-3", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "text-teal-800/80", children: "Floors Complete" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1099,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "text-2xl font-bold text-teal-700", children: approvalMetrics.floorsCompleted }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1100,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1098,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1067,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl border bg-surface-card p-4 space-y-3", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap gap-2", children: SAVED_VIEWS.map(
                    (view) => /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        onClick: () => setSelectedView(view),
                        className: `px-3 py-1.5 rounded-full text-xs border ${selectedView === view ? "bg-secondary border-secondary text-white" : "bg-surface-card border-border-default text-text-secondary hover:border-indigo-300"}`,
                        children: view
                      },
                      view,
                      false,
                      {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1109,
                        columnNumber: 21
                      },
                      this
                    )
                  ) }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1107,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-2", children: [
                    /* @__PURE__ */ jsxDEV(
                      "select",
                      {
                        value: selectedFloor,
                        onChange: (e) => setSelectedFloor(e.target.value),
                        className: "border rounded px-2 py-1.5 text-xs bg-surface-card",
                        children: [
                          /* @__PURE__ */ jsxDEV("option", { children: "All Floors" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1124,
                            columnNumber: 25
                          }, this),
                          Array.from(approvalMetrics.floorMap.keys()).sort().map(
                            (f) => /* @__PURE__ */ jsxDEV("option", { value: f, children: f }, f, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1128,
                              columnNumber: 23
                            }, this)
                          )
                        ]
                      },
                      void 0,
                      true,
                      {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1119,
                        columnNumber: 23
                      },
                      this
                    ),
                    /* @__PURE__ */ jsxDEV(
                      "select",
                      {
                        value: selectedSlaBucket,
                        onChange: (e) => setSelectedSlaBucket(e.target.value),
                        className: "border rounded px-2 py-1.5 text-xs bg-surface-card",
                        children: SLA_BUCKETS.map(
                          (b) => /* @__PURE__ */ jsxDEV("option", { value: b, children: b }, b, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1141,
                            columnNumber: 23
                          }, this)
                        )
                      },
                      void 0,
                      false,
                      {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1133,
                        columnNumber: 23
                      },
                      this
                    ),
                    /* @__PURE__ */ jsxDEV("label", { className: "flex items-center gap-2 text-xs text-text-secondary border rounded px-2 py-1.5 bg-surface-base", children: [
                      /* @__PURE__ */ jsxDEV(
                        "input",
                        {
                          type: "checkbox",
                          checked: showOverdueOnly,
                          onChange: (e) => setShowOverdueOnly(e.target.checked)
                        },
                        void 0,
                        false,
                        {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1147,
                          columnNumber: 25
                        },
                        this
                      ),
                      "Overdue only"
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1146,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1118,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1106,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 xl:grid-cols-3 gap-4", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "xl:col-span-2 rounded-xl border bg-surface-card p-4", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "text-sm font-semibold text-gray-800 mb-3", children: "Floor Status Board" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1159,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1", children: Array.from(approvalMetrics.floorMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([floor, rows]) => {
                      const p = rows.filter(
                        (r2) => isPendingStatus(r2.status)
                      ).length;
                      const a = rows.filter(
                        (r2) => r2.status === "APPROVED" || r2.status === "PROVISIONALLY_APPROVED"
                      ).length;
                      const r = rows.filter(
                        (rw) => rw.status === "REJECTED"
                      ).length;
                      return /* @__PURE__ */ jsxDEV(
                        "div",
                        {
                          className: "rounded-lg border p-3 bg-surface-base text-xs",
                          children: [
                            /* @__PURE__ */ jsxDEV("div", { className: "font-semibold text-gray-800 truncate", children: floor }, void 0, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1182,
                              columnNumber: 33
                            }, this),
                            /* @__PURE__ */ jsxDEV("div", { className: "mt-2 flex items-center gap-2 text-[11px]", children: [
                              /* @__PURE__ */ jsxDEV("span", { className: "text-amber-700", children: [
                                "P:",
                                p
                              ] }, void 0, true, {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 1186,
                                columnNumber: 35
                              }, this),
                              /* @__PURE__ */ jsxDEV("span", { className: "text-emerald-700", children: [
                                "A:",
                                a
                              ] }, void 0, true, {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 1187,
                                columnNumber: 35
                              }, this),
                              /* @__PURE__ */ jsxDEV("span", { className: "text-red-700", children: [
                                "R:",
                                r
                              ] }, void 0, true, {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 1190,
                                columnNumber: 35
                              }, this)
                            ] }, void 0, true, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1185,
                              columnNumber: 33
                            }, this)
                          ]
                        },
                        floor,
                        true,
                        {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1178,
                          columnNumber: 27
                        },
                        this
                      );
                    }) }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1162,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1158,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl border bg-surface-card p-4", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "text-sm font-semibold text-gray-800 mb-2", children: "SLA Distribution" }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1200,
                        columnNumber: 25
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "space-y-2 text-xs", children: [
                        /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                          /* @__PURE__ */ jsxDEV("span", { children: "Overdue" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1205,
                            columnNumber: 29
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-red-700", children: dashboardStats.overdueCount }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1206,
                            columnNumber: 29
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1204,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                          /* @__PURE__ */ jsxDEV("span", { children: "Due <24h" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1211,
                            columnNumber: 29
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-amber-700", children: dashboardStats.due24 }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1212,
                            columnNumber: 29
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1210,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                          /* @__PURE__ */ jsxDEV("span", { children: "Due 24-48h" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1217,
                            columnNumber: 29
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-blue-700", children: dashboardStats.due48 }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1218,
                            columnNumber: 29
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1216,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                          /* @__PURE__ */ jsxDEV("span", { children: "Upcoming" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1223,
                            columnNumber: 29
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-emerald-700", children: dashboardStats.upcoming }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1224,
                            columnNumber: 29
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1222,
                          columnNumber: 27
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1203,
                        columnNumber: 25
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1199,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl border bg-surface-card p-4", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "text-sm font-semibold text-gray-800 mb-2", children: "Data Health" }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1231,
                        columnNumber: 25
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "space-y-2 text-xs", children: [
                        /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                          /* @__PURE__ */ jsxDEV("span", { children: "Missing Location" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1236,
                            columnNumber: 29
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-red-700", children: dashboardStats.missingLocation }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1237,
                            columnNumber: 29
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1235,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                          /* @__PURE__ */ jsxDEV("span", { children: "Missing Workflow" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1242,
                            columnNumber: 29
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-amber-700", children: dashboardStats.missingWorkflow }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1243,
                            columnNumber: 29
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1241,
                          columnNumber: 27
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1234,
                        columnNumber: 25
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1230,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1198,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1157,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl border bg-surface-card p-4", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "text-sm font-semibold text-gray-800 mb-3", children: "Priority Pending Queue" }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1253,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "space-y-2 max-h-[340px] overflow-y-auto pr-1", children: dashboardQueue.length === 0 ? /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-text-muted italic", children: "No pending items for current filters." }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1258,
                    columnNumber: 21
                  }, this) : dashboardQueue.slice(0, 24).map((insp) => {
                    const location = parseLocationHierarchy(insp);
                    const bucket = getSlaBucket(insp);
                    return /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        onClick: () => {
                          setSelectedInspectionId(insp.id);
                          setFilterStatus("PENDING");
                        },
                        className: "w-full text-left border rounded-lg p-2.5 bg-surface-card hover:border-indigo-300 hover:bg-secondary-muted transition",
                        children: [
                          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between gap-2", children: [
                            /* @__PURE__ */ jsxDEV("div", { className: "text-sm font-semibold text-text-primary truncate", children: insp.activity?.activityName || `Activity #${insp.activityId}` }, void 0, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1275,
                              columnNumber: 33
                            }, this),
                            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
                              /* @__PURE__ */ jsxDEV(
                                "span",
                                {
                                  className: `text-[10px] px-1.5 py-0.5 rounded ${bucket === "Overdue" ? "bg-red-100 text-red-700" : bucket === "Due <24h" ? "bg-amber-100 text-amber-700" : "bg-info-muted text-blue-700"}`,
                                  children: bucket
                                },
                                void 0,
                                false,
                                {
                                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                  lineNumber: 1280,
                                  columnNumber: 35
                                },
                                this
                              ),
                              /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-text-muted", children: [
                                "Score ",
                                getPriorityScore(insp)
                              ] }, void 0, true, {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 1285,
                                columnNumber: 35
                              }, this)
                            ] }, void 0, true, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1279,
                              columnNumber: 33
                            }, this)
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1274,
                            columnNumber: 31
                          }, this),
                          /* @__PURE__ */ jsxDEV("div", { className: "mt-1 flex items-center gap-2 text-xs text-text-secondary", children: [
                            /* @__PURE__ */ jsxDEV(MapPin, { className: "w-3 h-3" }, void 0, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1291,
                              columnNumber: 33
                            }, this),
                            /* @__PURE__ */ jsxDEV("span", { className: "truncate", children: location.join(" > ") || `Node ${insp.epsNodeId}` }, void 0, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1292,
                              columnNumber: 33
                            }, this)
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1290,
                            columnNumber: 31
                          }, this),
                          insp.pendingApprovalLevel ? /* @__PURE__ */ jsxDEV("div", { className: "mt-2 text-[11px] text-amber-800", children: [
                            "Pending Level ",
                            insp.pendingApprovalLevel,
                            insp.pendingApprovalLabel ? ` - ${insp.pendingApprovalLabel}` : ""
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1298,
                            columnNumber: 27
                          }, this) : null
                        ]
                      },
                      insp.id,
                      true,
                      {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1266,
                        columnNumber: 25
                      },
                      this
                    );
                  }) }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1256,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1252,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1048,
                columnNumber: 15
              }, this) : loadingList ? /* @__PURE__ */ jsxDEV("div", { className: "text-center text-sm text-text-disabled p-4", children: "Loading RFIs..." }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1313,
                columnNumber: 15
              }, this) : filteredInspections.length === 0 ? /* @__PURE__ */ jsxDEV("div", { className: "text-center text-sm text-text-disabled p-8 border-2 border-dashed rounded-lg", children: "No RFIs found." }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1317,
                columnNumber: 15
              }, this) : filteredInspections.map((insp) => {
                const location = parseLocationHierarchy(insp);
                const bucket = getSlaBucket(insp);
                const priority = getPriorityScore(insp);
                return /* @__PURE__ */ jsxDEV(
                  "div",
                  {
                    onClick: () => setSelectedInspectionId(insp.id),
                    className: `p-3 rounded-lg border cursor-pointer transition-all ${selectedInspectionId === insp.id ? "border-secondary bg-secondary-muted ring-1 ring-indigo-200" : "border-border-default hover:border-indigo-300 hover:shadow-sm bg-surface-card"}`,
                    children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-start mb-2 gap-2", children: [
                        /* @__PURE__ */ jsxDEV(
                          "span",
                          {
                            className: `px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${insp.status === "APPROVED" ? "bg-green-100 text-green-700" : insp.status === "PARTIALLY_APPROVED" ? "bg-info-muted text-blue-700" : insp.status === "REJECTED" ? "bg-red-100 text-red-700" : insp.status === "REVERSED" ? "bg-amber-100 text-amber-800" : "bg-amber-100 text-amber-700"}`,
                            children: insp.status === "PARTIALLY_APPROVED" ? "PARTIAL" : insp.status
                          },
                          void 0,
                          false,
                          {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1332,
                            columnNumber: 25
                          },
                          this
                        ),
                        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-end gap-1", children: [
                          /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-text-muted", children: insp.requestDate }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1350,
                            columnNumber: 27
                          }, this),
                          /* @__PURE__ */ jsxDEV(
                            "span",
                            {
                              className: `text-[10px] px-1.5 py-0.5 rounded ${bucket === "Overdue" ? "bg-red-100 text-red-700" : bucket === "Due <24h" ? "bg-amber-100 text-amber-700" : "bg-info-muted text-blue-700"}`,
                              children: bucket
                            },
                            void 0,
                            false,
                            {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1353,
                              columnNumber: 27
                            },
                            this
                          )
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1349,
                          columnNumber: 25
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1331,
                        columnNumber: 23
                      }, this),
                      /* @__PURE__ */ jsxDEV("h4", { className: "text-sm font-semibold text-text-primary mb-1", children: insp.activity?.activityName || `Activity #${insp.activityId}` }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1360,
                        columnNumber: 23
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary", children: [
                        /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1 rounded bg-surface-raised px-2 py-0.5", children: [
                          /* @__PURE__ */ jsxDEV(Building2, { className: "w-3 h-3" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1366,
                            columnNumber: 27
                          }, this),
                          " ",
                          location[0] || "Block N/A"
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1365,
                          columnNumber: 25
                        }, this),
                        /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1 rounded bg-surface-raised px-2 py-0.5", children: [
                          /* @__PURE__ */ jsxDEV(Layers, { className: "w-3 h-3" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1370,
                            columnNumber: 27
                          }, this),
                          " ",
                          location[1] || getFloorLabel(insp)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1369,
                          columnNumber: 25
                        }, this),
                        /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1 rounded bg-surface-raised px-2 py-0.5", children: [
                          /* @__PURE__ */ jsxDEV(Home, { className: "w-3 h-3" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1374,
                            columnNumber: 27
                          }, this),
                          " ",
                          location[2] || `Node ${insp.epsNodeId}`
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1373,
                          columnNumber: 25
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1364,
                        columnNumber: 23
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "mt-1.5 flex items-center justify-between text-[11px]", children: [
                        /* @__PURE__ */ jsxDEV("span", { className: "text-text-muted", children: [
                          "Risk Score: ",
                          priority
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1379,
                          columnNumber: 25
                        }, this),
                        (insp.pendingObservationCount || 0) > 0 && /* @__PURE__ */ jsxDEV("span", { className: "text-red-700 inline-flex items-center gap-1", children: [
                          /* @__PURE__ */ jsxDEV(Siren, { className: "w-3 h-3" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1384,
                            columnNumber: 29
                          }, this),
                          " ",
                          insp.pendingObservationCount,
                          " obs"
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1383,
                          columnNumber: 23
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1378,
                        columnNumber: 23
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "mt-2 space-y-1 text-[11px]", children: [
                        insp.pendingApprovalLevel ? /* @__PURE__ */ jsxDEV("div", { className: "rounded-md bg-warning-muted px-2 py-1 text-amber-800", children: [
                          insp.pendingApprovalDisplay || `Level ${insp.pendingApprovalLevel} Pending${insp.pendingApprovalLabel ? `: ${insp.pendingApprovalLabel}` : ""}`,
                          insp.workflowSummary?.pendingStep?.minApprovalsRequired && (insp.workflowSummary?.pendingStep?.minApprovalsRequired || 1) > 1 ? ` (${insp.workflowSummary?.pendingStep?.currentApprovalCount || 0}/${insp.workflowSummary?.pendingStep?.minApprovalsRequired} approvals)` : ""
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1391,
                          columnNumber: 23
                        }, this) : insp.workflowSummary?.runStatus === "COMPLETED" ? /* @__PURE__ */ jsxDEV("div", { className: "rounded-md bg-success-muted px-2 py-1 text-emerald-800", children: "All approval levels completed" }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1406,
                          columnNumber: 23
                        }, this) : null,
                        insp.stageApprovalSummary?.totalStages ? /* @__PURE__ */ jsxDEV("div", { className: "text-text-muted", children: [
                          "Stage approvals:",
                          " ",
                          /* @__PURE__ */ jsxDEV("span", { className: "font-semibold text-text-primary", children: [
                            insp.stageApprovalSummary.approvedStages || 0,
                            "/",
                            insp.stageApprovalSummary.totalStages
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1413,
                            columnNumber: 29
                          }, this),
                          insp.stageApprovalSummary.pendingFinalApproval ? " - awaiting final approval" : ""
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1411,
                          columnNumber: 23
                        }, this) : null
                      ] }, void 0, true, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1389,
                        columnNumber: 23
                      }, this)
                    ]
                  },
                  insp.id,
                  true,
                  {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1326,
                    columnNumber: 19
                  },
                  this
                );
              }) }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1046,
                columnNumber: 13
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 1020,
            columnNumber: 11
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "main",
          {
            className: `${filterStatus === "DASHBOARD" ? "hidden" : "flex-1"} min-w-0 bg-surface-base flex flex-col relative overflow-hidden`,
            children: !selectedInspectionId ? /* @__PURE__ */ jsxDEV("div", { className: "flex-1 flex flex-col items-center justify-center text-text-disabled", children: [
              /* @__PURE__ */ jsxDEV(ClipboardCheck, { className: "w-16 h-16 mb-4 text-gray-200" }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1436,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-medium text-text-primary mb-1", children: filterStatus === "DASHBOARD" ? "Dashboard Active" : "Select an RFI" }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1437,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "max-w-sm text-center", children: filterStatus === "DASHBOARD" ? "Use the left dashboard priority queue to open a specific RFI, or switch tabs to browse by status." : "Select an RFI from the left panel to review and execute its checklist." }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1442,
                columnNumber: 17
              }, this)
            ] }, void 0, true, {
              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
              lineNumber: 1435,
              columnNumber: 13
            }, this) : loadingDetail ? /* @__PURE__ */ jsxDEV("div", { className: "flex-1 flex items-center justify-center text-text-muted", children: "Loading RFI checklist details..." }, void 0, false, {
              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
              lineNumber: 1449,
              columnNumber: 13
            }, this) : inspectionDetail ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("div", { className: "bg-surface-card px-8 py-6 border-b shrink-0 flex items-start justify-between", children: [
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("h2", { className: "text-2xl font-bold text-text-primary mb-2", children: inspectionDetail.activity?.activityName }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1457,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center gap-4 text-sm text-text-secondary", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "flex items-center gap-1.5", children: [
                      /* @__PURE__ */ jsxDEV(Clock, { className: "w-4 h-4 text-text-disabled" }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1462,
                        columnNumber: 25
                      }, this),
                      " ",
                      "Requested: ",
                      inspectionDetail.requestDate
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1461,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "flex items-center gap-1.5", children: [
                      /* @__PURE__ */ jsxDEV(UserCheck, { className: "w-4 h-4 text-text-disabled" }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1466,
                        columnNumber: 25
                      }, this),
                      " ",
                      "Requester: ",
                      inspectionDetail.inspectedBy || "System"
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1465,
                      columnNumber: 23
                    }, this),
                    inspectionDetail.comments && /* @__PURE__ */ jsxDEV("span", { className: "flex items-center gap-1.5 px-2 py-1 bg-surface-raised rounded text-xs italic", children: [
                      '"',
                      inspectionDetail.comments,
                      '"'
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1470,
                      columnNumber: 21
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1460,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "mt-3 flex flex-wrap gap-2 text-xs", children: [
                    inspectionDetail.workflowSummary?.strategyName ? /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 font-semibold text-text-secondary", children: [
                      inspectionDetail.workflowSummary.strategyName,
                      inspectionDetail.workflowSummary.releaseStrategyVersion ? ` v${inspectionDetail.workflowSummary.releaseStrategyVersion}` : ""
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1477,
                      columnNumber: 21
                    }, this) : null,
                    inspectionDetail.workflowSummary?.processCode ? /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 font-semibold text-text-secondary", children: inspectionDetail.workflowSummary.processCode }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1485,
                      columnNumber: 21
                    }, this) : null,
                    inspectionDetail.workflowSummary?.documentType ? /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 font-semibold text-text-secondary", children: inspectionDetail.workflowSummary.documentType }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1490,
                      columnNumber: 21
                    }, this) : null,
                    inspectionDetail.pendingApprovalLevel ? /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1 rounded-full bg-warning-muted px-3 py-1 font-semibold text-amber-800", children: [
                      "Pending Level ",
                      inspectionDetail.pendingApprovalLevel,
                      inspectionDetail.pendingApprovalLabel ? ` - ${inspectionDetail.pendingApprovalLabel}` : "",
                      inspectionDetail.workflowSummary?.pendingStep?.minApprovalsRequired && (inspectionDetail.workflowSummary?.pendingStep?.minApprovalsRequired || 1) > 1 ? ` (${inspectionDetail.workflowSummary?.pendingStep?.currentApprovalCount || 0}/${inspectionDetail.workflowSummary?.pendingStep?.minApprovalsRequired})` : ""
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1495,
                      columnNumber: 21
                    }, this) : null,
                    inspectionDetail.stageApprovalSummary?.totalStages ? /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 font-semibold text-text-secondary", children: [
                      "Stage Signoff",
                      " ",
                      inspectionDetail.stageApprovalSummary.approvedStages || 0,
                      "/",
                      inspectionDetail.stageApprovalSummary.totalStages
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1509,
                      columnNumber: 21
                    }, this) : null,
                    inspectionDetail.stageApprovalSummary?.pendingFinalApproval ? /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1 rounded-full bg-info-muted px-3 py-1 font-semibold text-blue-800", children: "Waiting for final approval" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1519,
                      columnNumber: 21
                    }, this) : null
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1475,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1456,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: [
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: async () => {
                        try {
                          const res = await api.get(
                            `/quality/inspections/${inspectionDetail.id}/report`,
                            { responseType: "blob" }
                          );
                          const url = URL.createObjectURL(res.data);
                          const a = document.createElement("a");
                          a.href = url;
                          const isApproved = inspectionDetail.status === "APPROVED";
                          a.download = `RFI_${isApproved ? "Final" : "WIP"}_Report_${inspectionDetail.id}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch {
                          alert("Failed to download report.");
                        }
                      },
                      className: `flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium shadow-sm ${inspectionDetail.status === "APPROVED" ? "bg-success-muted border-emerald-200 text-emerald-700 hover:bg-emerald-100" : "bg-surface-base border-border-default text-text-secondary hover:bg-surface-raised"}`,
                      children: [
                        /* @__PURE__ */ jsxDEV(FileDown, { className: "w-4 h-4" }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1550,
                          columnNumber: 23
                        }, this),
                        " ",
                        inspectionDetail.status === "APPROVED" ? "Final Report" : "WIP Report"
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1527,
                      columnNumber: 21
                    },
                    this
                  ),
                  inspectionDetail.status === "APPROVED" && /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: () => setShowReversalModal(true),
                      className: "flex items-center gap-2 px-4 py-2 bg-warning-muted border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 shadow-sm",
                      children: [
                        /* @__PURE__ */ jsxDEV(RotateCcw, { className: "w-4 h-4" }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1561,
                          columnNumber: 25
                        }, this),
                        " Reverse"
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1557,
                      columnNumber: 19
                    },
                    this
                  ),
                  isAdmin && /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: async () => {
                        if (!confirm("Permanently delete this RFI?")) return;
                        try {
                          await api.delete(
                            `/quality/inspections/${inspectionDetail.id}`
                          );
                          alert("RFI deleted.");
                          setSelectedInspectionId(null);
                          setRefreshKey((k) => k + 1);
                        } catch (err) {
                          alert(
                            err.response?.data?.message || "Delete failed."
                          );
                        }
                      },
                      className: "flex items-center gap-2 px-4 py-2 bg-error-muted border border-red-200 text-error rounded-lg text-sm font-medium hover:bg-red-100 shadow-sm",
                      children: [
                        /* @__PURE__ */ jsxDEV(Trash2, { className: "w-4 h-4" }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1584,
                          columnNumber: 25
                        }, this),
                        " Delete"
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1566,
                      columnNumber: 19
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1525,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1455,
                columnNumber: 17
              }, this),
              workflowState && /* @__PURE__ */ jsxDEV("div", { className: "shrink-0 border-y border-border-subtle bg-surface-card px-5 py-3", children: /* @__PURE__ */ jsxDEV("div", { className: "flex flex-1 items-center gap-3", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "text-xs font-bold text-text-muted uppercase tracking-widest whitespace-nowrap", children: "Workflow" }, void 0, false, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1596,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex flex-1 items-center gap-2 overflow-x-auto pb-1", children: workflowState.steps.sort((a, b) => a.stepOrder - b.stepOrder).map((step, sIdx) => {
                  const isCurrent = workflowState.currentStepOrder === step.stepOrder;
                  const isCompleted = step.status === "COMPLETED";
                  const isRejected = step.status === "REJECTED";
                  const isRaiserStep = step.workflowNode?.stepType === "RAISE_RFI" || step.stepOrder === 1 && step.workflowNode?.label?.toLowerCase?.()?.includes?.("raise");
                  const isLastStepNode = step.stepOrder === Math.max(
                    ...workflowState.steps.map(
                      (s) => s.stepOrder
                    )
                  );
                  let colorClass = "bg-surface-raised text-text-muted border-border-default";
                  if (isCompleted)
                    colorClass = "bg-green-100 text-green-700 border-green-200";
                  if (isRejected)
                    colorClass = "bg-red-100 text-red-700 border-red-200";
                  if (isCurrent)
                    colorClass = "bg-indigo-100 text-indigo-700 border-indigo-300 ring-2 ring-indigo-200";
                  const stepLabel = isLastStepNode && !isRaiserStep ? "Final Approval" : step.stepName || step.workflowNode?.label || `Step ${step.stepOrder}`;
                  const stepSubtitle = isCompleted ? isRaiserStep ? "RFI Raised" : `Signed by ${step.signerDisplayName || step.signedBy}${step.signerCompany ? ` - ${step.signerCompany}` : ""}${step.signerRole ? ` - ${step.signerRole}` : ""}` : isRejected ? "Rejected" : isCurrent ? `Pending Approval${step.stepName ? ` - ${step.stepName}` : ""}` : "Waiting";
                  return /* @__PURE__ */ jsxDEV(
                    "div",
                    {
                      className: "flex items-center gap-2 shrink-0",
                      children: [
                        /* @__PURE__ */ jsxDEV(
                          "div",
                          {
                            className: `flex flex-col border rounded-lg px-3 py-1.5 ${colorClass}`,
                            children: [
                              /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold uppercase", children: stepLabel }, void 0, false, {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 1658,
                                columnNumber: 35
                              }, this),
                              /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] truncate max-w-[120px]", children: stepSubtitle }, void 0, false, {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 1661,
                                columnNumber: 35
                              }, this)
                            ]
                          },
                          void 0,
                          true,
                          {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1655,
                            columnNumber: 33
                          },
                          this
                        ),
                        sIdx < workflowState.steps.length - 1 && /* @__PURE__ */ jsxDEV(
                          "div",
                          {
                            className: `h-0.5 w-4 ${isCompleted ? "bg-success" : "bg-gray-200"}`
                          },
                          void 0,
                          false,
                          {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1666,
                            columnNumber: 27
                          },
                          this
                        )
                      ]
                    },
                    step.id,
                    true,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1651,
                      columnNumber: 25
                    },
                    this
                  );
                }) }, void 0, false, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1599,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1595,
                columnNumber: 21
              }, this) }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1594,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto px-5 py-4", children: /* @__PURE__ */ jsxDEV("div", { className: "max-w-5xl mx-auto space-y-4", children: [
                workflowState?.status === "COMPLETED" && /* @__PURE__ */ jsxDEV("div", { className: "bg-success-muted border border-emerald-300 rounded-xl px-5 py-3 flex items-center gap-3 text-emerald-800", children: [
                  /* @__PURE__ */ jsxDEV(CheckCircle2, { className: "w-6 h-6 shrink-0" }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1684,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { children: [
                    /* @__PURE__ */ jsxDEV("h4", { className: "font-bold text-sm", children: "Workflow Fully Approved" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1686,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDEV("p", { className: "text-xs mt-1", children: [
                      "All ",
                      workflowState.steps.length,
                      " approval levels have been completed and signed."
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1689,
                      columnNumber: 27
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1685,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1683,
                  columnNumber: 19
                }, this),
                inspectionDetail.workflowSummary?.completedSteps?.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl border bg-surface-card p-4", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "text-sm font-semibold text-text-primary", children: "Completed Approval Levels" }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1700,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "mt-3 space-y-2", children: inspectionDetail.workflowSummary.completedSteps.map(
                    (step) => /* @__PURE__ */ jsxDEV(
                      "div",
                      {
                        className: "rounded-lg border border-emerald-200 bg-success-muted px-3 py-2 text-xs text-emerald-900",
                        children: [
                          /* @__PURE__ */ jsxDEV("div", { className: "font-semibold", children: [
                            "Level ",
                            step.stepOrder,
                            ":",
                            " ",
                            step.stepName || "Approval Step"
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1710,
                            columnNumber: 33
                          }, this),
                          (step.minApprovalsRequired || 1) > 1 && /* @__PURE__ */ jsxDEV("div", { className: "mt-1", children: [
                            "Quorum met: ",
                            step.currentApprovalCount || 0,
                            "/",
                            step.minApprovalsRequired
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1715,
                            columnNumber: 27
                          }, this),
                          /* @__PURE__ */ jsxDEV("div", { className: "mt-1", children: [
                            step.signerDisplayName,
                            step.signerCompany,
                            step.signerRole
                          ].filter(Boolean).join(" - ") || "Signed" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1720,
                            columnNumber: 33
                          }, this),
                          step.completedAt && /* @__PURE__ */ jsxDEV("div", { className: "mt-1 text-emerald-700", children: new Date(step.completedAt).toLocaleString() }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1730,
                            columnNumber: 27
                          }, this)
                        ]
                      },
                      `wf-complete-${step.stepOrder}`,
                      true,
                      {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1706,
                        columnNumber: 25
                      },
                      this
                    )
                  ) }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1703,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1699,
                  columnNumber: 19
                }, this),
                approvalHistory.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "rounded-xl border bg-surface-card p-4", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "text-sm font-semibold text-text-primary", children: "Approval History" }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1743,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "mt-3 space-y-2", children: approvalHistory.map(
                    (entry) => /* @__PURE__ */ jsxDEV(
                      "div",
                      {
                        className: "rounded-lg border border-border-subtle bg-surface-base px-3 py-3 text-xs",
                        children: /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [
                          /* @__PURE__ */ jsxDEV("div", { children: [
                            /* @__PURE__ */ jsxDEV("div", { className: "font-semibold text-text-primary", children: entry.title }, void 0, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1754,
                              columnNumber: 35
                            }, this),
                            /* @__PURE__ */ jsxDEV("div", { className: "mt-1 text-text-secondary", children: [
                              entry.scope,
                              " - ",
                              entry.action
                            ] }, void 0, true, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1757,
                              columnNumber: 35
                            }, this),
                            entry.meta && /* @__PURE__ */ jsxDEV("div", { className: "mt-1 text-text-muted", children: entry.meta }, void 0, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1761,
                              columnNumber: 29
                            }, this)
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1753,
                            columnNumber: 33
                          }, this),
                          /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-end gap-1", children: [
                            /* @__PURE__ */ jsxDEV(
                              "span",
                              {
                                className: `rounded-full px-2 py-1 font-semibold ${entry.status === "REVERSED" ? "bg-warning-muted text-amber-800" : "bg-surface-raised text-text-secondary"}`,
                                children: entry.status
                              },
                              void 0,
                              false,
                              {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 1767,
                                columnNumber: 35
                              },
                              this
                            ),
                            entry.at && /* @__PURE__ */ jsxDEV("span", { className: "text-text-muted", children: new Date(entry.at).toLocaleString() }, void 0, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1777,
                              columnNumber: 29
                            }, this)
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1766,
                            columnNumber: 33
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1752,
                          columnNumber: 31
                        }, this)
                      },
                      entry.key,
                      false,
                      {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 1748,
                        columnNumber: 23
                      },
                      this
                    )
                  ) }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1746,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1742,
                  columnNumber: 19
                }, this),
                pendingObservationsCount > 0 && /* @__PURE__ */ jsxDEV("div", { className: "bg-warning-muted border border-amber-200 rounded-xl px-4 py-3 flex gap-3 text-amber-800", children: [
                  /* @__PURE__ */ jsxDEV(AlertCircle, { className: "w-5 h-5 shrink-0" }, void 0, false, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1792,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { children: [
                    /* @__PURE__ */ jsxDEV("h4", { className: "font-bold text-sm", children: "Cannot Approve RFI" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1794,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDEV("p", { className: "text-xs mt-1", children: [
                      "There are ",
                      pendingObservationsCount,
                      " pending observation(s). The field team must resolve these before you can approve."
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1797,
                      columnNumber: 27
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 1793,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1791,
                  columnNumber: 19
                }, this),
                !inspectionDetail.stages || inspectionDetail.stages.length === 0 ? /* @__PURE__ */ jsxDEV("div", { className: "bg-surface-card p-6 rounded-xl border text-center text-text-muted", children: "No checklist template assigned to this activity." }, void 0, false, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 1808,
                  columnNumber: 19
                }, this) : inspectionDetail.stages.map((stage, sIdx) => {
                  const latestStageApproval = [...stage.signatures || []].reverse().find(
                    (signature) => signature?.actionType === "STAGE_APPROVE" && !signature?.isReversed
                  );
                  return /* @__PURE__ */ jsxDEV(
                    "div",
                    {
                      className: "bg-surface-card rounded-xl shadow-sm border overflow-hidden",
                      children: [
                        /* @__PURE__ */ jsxDEV("div", { className: "bg-surface-base px-4 py-2.5 border-b flex flex-wrap justify-between items-center gap-2", children: [
                          /* @__PURE__ */ jsxDEV("div", { children: [
                            /* @__PURE__ */ jsxDEV("h3", { className: "font-semibold text-text-primary", children: [
                              "Stage ",
                              sIdx + 1,
                              ":",
                              " ",
                              stage.stageTemplate?.name || "General Checks"
                            ] }, void 0, true, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1828,
                              columnNumber: 33
                            }, this),
                            /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-text-muted mt-1", children: stage.isLocked ? "Stage approved and locked" : "Stage approval pending" }, void 0, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1832,
                              columnNumber: 33
                            }, this),
                            latestStageApproval && /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-text-muted mt-1", children: [
                              "Approved by",
                              " ",
                              latestStageApproval.signerDisplayName || latestStageApproval.signedBy,
                              latestStageApproval.signerCompany && ` - ${latestStageApproval.signerCompany}`,
                              latestStageApproval.signerRoleLabel && ` - ${latestStageApproval.signerRoleLabel}`
                            ] }, void 0, true, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1838,
                              columnNumber: 29
                            }, this)
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1827,
                            columnNumber: 31
                          }, this),
                          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
                            /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-text-muted", children: [
                              stage.items?.filter(
                                (i) => i.value === "YES" || i.value === "NA" || i.isOk
                              ).length,
                              " ",
                              "/ ",
                              stage.items?.length,
                              " Completed"
                            ] }, void 0, true, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1850,
                              columnNumber: 33
                            }, this),
                            /* @__PURE__ */ jsxDEV(
                              "span",
                              {
                                className: `text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${stage.isLocked ? "bg-emerald-100 text-emerald-700" : "bg-surface-raised text-text-muted"}`,
                                children: stage.isLocked ? "Approved & Locked" : stage.status
                              },
                              void 0,
                              false,
                              {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 1861,
                                columnNumber: 33
                              },
                              this
                            ),
                            isAdmin && stage.isLocked && inspectionDetail.status !== "APPROVED" && /* @__PURE__ */ jsxDEV(
                              "button",
                              {
                                onClick: async () => {
                                  const reason = prompt("Enter reason to reverse this stage approval:");
                                  if (!reason) return;
                                  await api.post(
                                    `/quality/inspections/${inspectionDetail.id}/stages/${stage.id}/reverse`,
                                    { reason }
                                  );
                                  setRefreshKey((k) => k + 1);
                                },
                                className: "px-2 py-1 text-[10px] font-bold uppercase rounded border border-amber-300 text-amber-700 hover:bg-amber-50",
                                children: "Reverse Stage"
                              },
                              void 0,
                              false,
                              {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 1871,
                                columnNumber: 29
                              },
                              this
                            )
                          ] }, void 0, true, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 1849,
                            columnNumber: 31
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1826,
                          columnNumber: 29
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "border-b bg-surface-base/60 px-4 py-3", children: stage.signatures?.length > 0 ? /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: stage.signatures.map(
                          (signature, sigIdx) => /* @__PURE__ */ jsxDEV(
                            "div",
                            {
                              className: "flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 text-xs",
                              children: [
                                /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
                                  /* @__PURE__ */ jsxDEV("span", { className: "font-semibold text-text-primary", children: formatSignatureAction(signature) }, void 0, false, {
                                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                    lineNumber: 1898,
                                    columnNumber: 43
                                  }, this),
                                  signature.signedAt && /* @__PURE__ */ jsxDEV("span", { className: "text-text-muted", children: new Date(
                                    signature.signedAt
                                  ).toLocaleString() }, void 0, false, {
                                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                    lineNumber: 1902,
                                    columnNumber: 35
                                  }, this)
                                ] }, void 0, true, {
                                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                  lineNumber: 1897,
                                  columnNumber: 41
                                }, this),
                                /* @__PURE__ */ jsxDEV("div", { className: "text-text-secondary", children: formatSignatureMeta(signature) }, void 0, false, {
                                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                  lineNumber: 1909,
                                  columnNumber: 41
                                }, this)
                              ]
                            },
                            `stage-signature-${stage.id}-${sigIdx}`,
                            true,
                            {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1893,
                              columnNumber: 31
                            },
                            this
                          )
                        ) }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1890,
                          columnNumber: 27
                        }, this) : /* @__PURE__ */ jsxDEV("div", { className: "rounded-lg border border-dashed border-border-default px-3 py-2 text-xs text-text-muted", children: "No stage approval recorded yet." }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1917,
                          columnNumber: 27
                        }, this) }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1888,
                          columnNumber: 29
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "divide-y", children: [...stage.items || []].sort(
                          (a, b) => (a.itemTemplate?.sequence || 0) - (b.itemTemplate?.sequence || 0)
                        ).map(
                          (item) => /* @__PURE__ */ jsxDEV(
                            "div",
                            {
                              className: "p-3 flex gap-3 hover:bg-surface-base transition-colors",
                              children: [
                                /* @__PURE__ */ jsxDEV("div", { className: "mt-0.5 shrink-0 flex gap-2", children: [
                                  /* @__PURE__ */ jsxDEV(
                                    "button",
                                    {
                                      onClick: () => handleItemValueChange(
                                        item.id,
                                        item.value === "YES" ? "" : "YES"
                                      ),
                                      disabled: stage.isLocked && !isAdmin || inspectionDetail.isLocked && !isAdmin || ![
                                        "PENDING",
                                        "PARTIALLY_APPROVED"
                                      ].includes(inspectionDetail.status),
                                      className: `px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors disabled:opacity-50 border ${item.value === "YES" || item.isOk && item.value !== "NA" ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-surface-card border-border-strong text-text-secondary hover:bg-surface-base"}`,
                                      children: "YES"
                                    },
                                    void 0,
                                    false,
                                    {
                                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                      lineNumber: 1935,
                                      columnNumber: 39
                                    },
                                    this
                                  ),
                                  /* @__PURE__ */ jsxDEV(
                                    "button",
                                    {
                                      onClick: () => handleItemValueChange(
                                        item.id,
                                        item.value === "NA" ? "" : "NA"
                                      ),
                                      disabled: stage.isLocked && !isAdmin || inspectionDetail.isLocked && !isAdmin || ![
                                        "PENDING",
                                        "PARTIALLY_APPROVED"
                                      ].includes(inspectionDetail.status),
                                      className: `px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors disabled:opacity-50 border ${item.value === "NA" ? "bg-amber-100 border-amber-300 text-amber-700" : "bg-surface-card border-border-strong text-text-secondary hover:bg-surface-base"}`,
                                      children: "NA"
                                    },
                                    void 0,
                                    false,
                                    {
                                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                      lineNumber: 1954,
                                      columnNumber: 39
                                    },
                                    this
                                  )
                                ] }, void 0, true, {
                                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                  lineNumber: 1934,
                                  columnNumber: 37
                                }, this),
                                /* @__PURE__ */ jsxDEV("div", { className: "flex-1", children: [
                                  /* @__PURE__ */ jsxDEV(
                                    "p",
                                    {
                                      className: `text-sm ${item.value === "YES" || item.value === "NA" || item.isOk ? "text-text-secondary font-medium" : "text-text-primary"}`,
                                      children: item.itemTemplate?.itemText || "Checklist Item"
                                    },
                                    void 0,
                                    false,
                                    {
                                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                      lineNumber: 1975,
                                      columnNumber: 39
                                    },
                                    this
                                  ),
                                  [
                                    "PENDING",
                                    "PARTIALLY_APPROVED"
                                  ].includes(inspectionDetail.status) ? /* @__PURE__ */ jsxDEV(
                                    "input",
                                    {
                                      type: "text",
                                      placeholder: "Add remarks...",
                                      value: item.remarks || "",
                                      onChange: (e) => handleItemRemarksChange(
                                        item.id,
                                        e.target.value
                                      ),
                                      disabled: stage.isLocked && !isAdmin || inspectionDetail.isLocked && !isAdmin,
                                      className: "mt-2 w-full text-sm border-border-strong rounded-md shadow-sm focus:ring-secondary focus:border-secondary"
                                    },
                                    void 0,
                                    false,
                                    {
                                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                      lineNumber: 1985,
                                      columnNumber: 31
                                    },
                                    this
                                  ) : item.remarks && /* @__PURE__ */ jsxDEV("p", { className: "mt-1 text-xs text-text-muted italic", children: [
                                    "Remark: ",
                                    item.remarks
                                  ] }, void 0, true, {
                                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                    lineNumber: 2003,
                                    columnNumber: 31
                                  }, this)
                                ] }, void 0, true, {
                                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                  lineNumber: 1974,
                                  columnNumber: 37
                                }, this)
                              ]
                            },
                            item.id,
                            true,
                            {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 1930,
                              columnNumber: 27
                            },
                            this
                          )
                        ) }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 1922,
                          columnNumber: 29
                        }, this),
                        ["PENDING", "PARTIALLY_APPROVED"].includes(
                          inspectionDetail.status
                        ) && (!inspectionDetail.isLocked || isAdmin) && /* @__PURE__ */ jsxDEV("div", { className: "border-t bg-surface-base px-4 py-3", children: /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", children: [
                          /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-text-muted", children: isStageApproved(stage) ? "This stage is already approved and locked." : isStageChecklistComplete(stage) ? "All checklist items are complete. This stage is ready for approval." : "Complete all checklist items in this stage, then approve it." }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 2018,
                            columnNumber: 35
                          }, this),
                          /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center gap-2", children: /* @__PURE__ */ jsxDEV(
                            "button",
                            {
                              onClick: () => handleApproveStage(stage),
                              disabled: !canApproveInspection || stage.isLocked || inspectionDetail.isLocked || !isStageChecklistComplete(stage),
                              className: "px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark disabled:opacity-50 text-sm font-medium",
                              title: !canApproveInspection ? "You do not have approval access for this stage." : !isStageChecklistComplete(stage) ? "Complete all checklist items in this stage before approval." : "",
                              children: [
                                /* @__PURE__ */ jsxDEV(ShieldCheck, { className: "w-4 h-4 inline mr-1" }, void 0, false, {
                                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                  lineNumber: 2043,
                                  columnNumber: 39
                                }, this),
                                "Approve Stage"
                              ]
                            },
                            void 0,
                            true,
                            {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 2026,
                              columnNumber: 37
                            },
                            this
                          ) }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 2025,
                            columnNumber: 35
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2017,
                          columnNumber: 33
                        }, this) }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2016,
                          columnNumber: 25
                        }, this)
                      ]
                    },
                    stage.id,
                    true,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 1822,
                      columnNumber: 23
                    },
                    this
                  );
                })
              ] }, void 0, true, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1680,
                columnNumber: 19
              }, this) }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 1679,
                columnNumber: 17
              }, this),
              ["PENDING", "PARTIALLY_APPROVED"].includes(
                inspectionDetail.status
              ) && (!inspectionDetail.isLocked || isAdmin) && /* @__PURE__ */ jsxDEV("div", { className: "border-t border-border-default bg-surface-card px-5 py-4", children: /* @__PURE__ */ jsxDEV("div", { className: "max-w-5xl mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "text-sm min-h-5", children: [
                  !allChecked && pendingObservationsCount === 0 && /* @__PURE__ */ jsxDEV("span", { className: "text-error font-medium flex items-center gap-1.5", children: [
                    /* @__PURE__ */ jsxDEV(AlertCircle, { className: "w-4 h-4" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2067,
                      columnNumber: 29
                    }, this),
                    " Please complete all checklist items before approving."
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 2066,
                    columnNumber: 21
                  }, this),
                  allChecked && pendingObservationsCount === 0 && /* @__PURE__ */ jsxDEV("span", { className: "text-success font-medium flex items-center gap-1.5", children: [
                    /* @__PURE__ */ jsxDEV(CheckCircle2, { className: "w-4 h-4" }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2073,
                      columnNumber: 29
                    }, this),
                    " Checklist complete. Ready for approval."
                  ] }, void 0, true, {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 2072,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2064,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center gap-2 lg:justify-end", children: [
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: () => setShowObsModal(true),
                      className: "px-4 py-2 bg-surface-card border border-amber-200 text-amber-700 rounded-lg hover:bg-warning-muted focus:ring-2 focus:ring-amber-200 font-medium flex items-center gap-2 text-sm",
                      children: [
                        /* @__PURE__ */ jsxDEV(MessageSquareWarning, { className: "w-4 h-4" }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2083,
                          columnNumber: 27
                        }, this),
                        " ",
                        "Observations (",
                        observations.length,
                        ")"
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2079,
                      columnNumber: 25
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: handleReject,
                      className: "px-4 py-2 bg-surface-card border border-red-200 text-error rounded-lg hover:bg-error-muted focus:ring-2 focus:ring-red-200 font-medium text-sm border-l",
                      children: "Reject"
                    },
                    void 0,
                    false,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2086,
                      columnNumber: 25
                    },
                    this
                  ),
                  workflowState && /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: () => {
                        fetchEligibleUsers();
                        setShowDelegationModal(true);
                      },
                      className: "px-4 py-2 bg-surface-card border border-indigo-200 text-secondary rounded-lg hover:bg-secondary-muted focus:ring-2 focus:ring-indigo-200 font-medium text-sm flex items-center gap-2",
                      children: [
                        /* @__PURE__ */ jsxDEV(UserCheck, { className: "w-4 h-4" }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2100,
                          columnNumber: 29
                        }, this),
                        " Delegate"
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2093,
                      columnNumber: 21
                    },
                    this
                  ),
                  !workflowState && /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: handleProvisionallyApprove,
                      className: "px-4 py-2 bg-surface-card border border-blue-200 text-primary rounded-lg hover:bg-primary-muted focus:ring-2 focus:ring-blue-200 font-medium text-sm",
                      children: "Provisional Approval"
                    },
                    void 0,
                    false,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2104,
                      columnNumber: 21
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: handleInitiateApprove,
                      disabled: !canApproveInspection || !allChecked || pendingObservationsCount > 0,
                      className: "px-6 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm shadow-indigo-200 transition-all text-sm flex items-center gap-2",
                      children: [
                        /* @__PURE__ */ jsxDEV(ShieldCheck, { className: "w-4 h-4" }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2120,
                          columnNumber: 27
                        }, this),
                        workflowState ? "Approve Workflow Step" : "Final Approve"
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2111,
                      columnNumber: 25
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2078,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2063,
                columnNumber: 21
              }, this) }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2062,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
              lineNumber: 1453,
              columnNumber: 13
            }, this) : null
          },
          void 0,
          false,
          {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 1431,
            columnNumber: 11
          },
          this
        )
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 1018,
        columnNumber: 9
      }, this),
      showObsModal && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-surface-overlay flex items-center justify-center z-50 p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-surface-card rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center p-6 border-b shrink-0", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-xl font-bold text-text-primary flex items-center gap-2", children: [
            /* @__PURE__ */ jsxDEV(MessageSquareWarning, { className: "w-6 h-6 text-warning" }, void 0, false, {
              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
              lineNumber: 2140,
              columnNumber: 19
            }, this),
            "Observation Log"
          ] }, void 0, true, {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2139,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => setShowObsModal(false),
              className: "text-text-disabled hover:text-text-secondary",
              children: /* @__PURE__ */ jsxDEV(X, { className: "w-6 h-6" }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2147,
                columnNumber: 19
              }, this)
            },
            void 0,
            false,
            {
              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
              lineNumber: 2143,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 2138,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto p-6 space-y-6 bg-surface-base", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex gap-2 border-b border-border-default pb-2", children: ["PENDING", "RECTIFIED", "CLOSED", "ALL"].map(
              (tab) => /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => setObsTab(tab),
                  className: `px-4 py-2 text-sm font-bold border-b-2 transition-colors ${obsTab === tab ? "border-amber-600 text-amber-700" : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-raised rounded-t"}`,
                  children: [
                    tab === "PENDING" ? "Pending" : tab === "RECTIFIED" ? "Rectified" : tab === "CLOSED" ? "Closed" : "All",
                    /* @__PURE__ */ jsxDEV("span", { className: "ml-2 px-2 py-0.5 rounded-full text-xs bg-surface-raised text-text-secondary", children: tab === "ALL" ? observations.length : tab === "PENDING" ? observations.filter(
                      (o) => o.status === "PENDING" || o.status === "OPEN"
                    ).length : observations.filter(
                      (o) => o.status === "CLOSED" || o.status === "RECTIFIED" || o.status === "RESOLVED"
                    ).length }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2173,
                      columnNumber: 27
                    }, this)
                  ]
                },
                tab,
                true,
                {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2157,
                  columnNumber: 21
                },
                this
              )
            ) }, void 0, false, {
              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
              lineNumber: 2154,
              columnNumber: 19
            }, this),
            filteredObservations.length === 0 ? /* @__PURE__ */ jsxDEV("div", { className: "text-text-muted text-sm italic py-4", children: "No observations match the selected tab." }, void 0, false, {
              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
              lineNumber: 2195,
              columnNumber: 17
            }, this) : filteredObservations.map((obs, idx) => {
              const ageInfo = getDaysOpen(obs.createdAt);
              return /* @__PURE__ */ jsxDEV(
                "div",
                {
                  className: "bg-surface-card rounded-xl p-4 shadow-sm border",
                  children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-start mb-2", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col gap-1", children: [
                        /* @__PURE__ */ jsxDEV(
                          "span",
                          {
                            className: `text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${obs.status === "PENDING" ? "bg-amber-100 text-amber-800" : obs.status === "RECTIFIED" ? "bg-info-muted text-blue-800" : "bg-surface-raised text-text-secondary"}`,
                            children: obs.status
                          },
                          void 0,
                          false,
                          {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 2208,
                            columnNumber: 31
                          },
                          this
                        ),
                        /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-semibold text-text-muted", children: [
                          "[",
                          obs.type || "Minor",
                          "] #",
                          idx + 1
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2219,
                          columnNumber: 31
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 2207,
                        columnNumber: 29
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: [
                        hasPermission(
                          PermissionCode.QUALITY_OBSERVATION_DELETE
                        ) && /* @__PURE__ */ jsxDEV(
                          "button",
                          {
                            onClick: () => handleDeleteObservation(obs.id),
                            className: "text-text-disabled hover:text-error transition-colors p-1",
                            children: /* @__PURE__ */ jsxDEV(Trash2, { className: "w-4 h-4" }, void 0, false, {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 2233,
                              columnNumber: 35
                            }, this)
                          },
                          void 0,
                          false,
                          {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 2227,
                            columnNumber: 27
                          },
                          this
                        ),
                        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-end", children: [
                          /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-text-disabled", children: new Date(obs.createdAt).toLocaleString() }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 2237,
                            columnNumber: 33
                          }, this),
                          /* @__PURE__ */ jsxDEV(
                            "span",
                            {
                              className: `text-[10px] ${ageInfo.color}`,
                              children: ageInfo.text
                            },
                            void 0,
                            false,
                            {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 2240,
                              columnNumber: 33
                            },
                            this
                          )
                        ] }, void 0, true, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2236,
                          columnNumber: 31
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 2223,
                        columnNumber: 29
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2206,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDEV("p", { className: "text-sm font-medium text-text-primary mt-2", children: obs.observationText }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2248,
                      columnNumber: 27
                    }, this),
                    obs.photos && obs.photos.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "mt-3 flex flex-wrap gap-2", children: obs.photos.map(
                      (url, pIdx) => /* @__PURE__ */ jsxDEV(
                        "a",
                        {
                          href: getFileUrl(url),
                          target: "_blank",
                          rel: "noreferrer",
                          className: "w-16 h-16 rounded-md border overflow-hidden hover:opacity-80 transition-opacity",
                          children: /* @__PURE__ */ jsxDEV(
                            "img",
                            {
                              src: getFileUrl(url),
                              alt: "Observation",
                              className: "w-full h-full object-cover"
                            },
                            void 0,
                            false,
                            {
                              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                              lineNumber: 2262,
                              columnNumber: 35
                            },
                            this
                          )
                        },
                        pIdx,
                        false,
                        {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2255,
                          columnNumber: 25
                        },
                        this
                      )
                    ) }, void 0, false, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2253,
                      columnNumber: 23
                    }, this),
                    obs.status === "RECTIFIED" && /* @__PURE__ */ jsxDEV("div", { className: "mt-4 p-3 bg-primary-muted border border-blue-100 rounded-lg", children: [
                      /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-bold text-blue-900 mb-1", children: "Rectification Details (From Site Team):" }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 2274,
                        columnNumber: 31
                      }, this),
                      /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-blue-800", children: obs.closureText || "No remarks provided." }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 2277,
                        columnNumber: 31
                      }, this),
                      obs.closureEvidence && obs.closureEvidence.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "mt-2 flex flex-wrap gap-2", children: obs.closureEvidence.map(
                        (url, pIdx) => /* @__PURE__ */ jsxDEV(
                          "a",
                          {
                            href: getFileUrl(url),
                            target: "_blank",
                            rel: "noreferrer",
                            className: "w-12 h-12 rounded border border-blue-200 overflow-hidden",
                            children: /* @__PURE__ */ jsxDEV(
                              "img",
                              {
                                src: getFileUrl(url),
                                alt: "Rectification",
                                className: "w-full h-full object-cover"
                              },
                              void 0,
                              false,
                              {
                                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                                lineNumber: 2293,
                                columnNumber: 43
                              },
                              this
                            )
                          },
                          pIdx,
                          false,
                          {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 2286,
                            columnNumber: 29
                          },
                          this
                        )
                      ) }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 2283,
                        columnNumber: 25
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "mt-3", children: /* @__PURE__ */ jsxDEV(
                        "button",
                        {
                          onClick: () => handleCloseObservation(obs.id),
                          className: "px-4 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-dark shadow-sm transition-all",
                          children: "Verify & Close Observation"
                        },
                        void 0,
                        false,
                        {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2305,
                          columnNumber: 33
                        },
                        this
                      ) }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 2304,
                        columnNumber: 31
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2273,
                      columnNumber: 23
                    }, this)
                  ]
                },
                obs.id,
                true,
                {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2202,
                  columnNumber: 21
                },
                this
              );
            })
          ] }, void 0, true, {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2153,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "bg-surface-card rounded-xl p-5 shadow-sm border border-border-default", children: [
            /* @__PURE__ */ jsxDEV("h4", { className: "font-bold text-gray-800 mb-4 flex items-center gap-2", children: [
              /* @__PURE__ */ jsxDEV(AlertCircle, { className: "w-4 h-4 text-warning" }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2323,
                columnNumber: 21
              }, this),
              " Add New Observation"
            ] }, void 0, true, {
              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
              lineNumber: 2322,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("label", { className: "block text-xs font-medium text-text-secondary mb-1", children: "Severity Type" }, void 0, false, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2329,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "select",
                  {
                    value: obsType,
                    onChange: (e) => setObsType(e.target.value),
                    className: "w-full sm:w-1/3 border-border-strong rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500",
                    children: [
                      /* @__PURE__ */ jsxDEV("option", { value: "Minor", children: "Minor" }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 2337,
                        columnNumber: 25
                      }, this),
                      /* @__PURE__ */ jsxDEV("option", { value: "Major", children: "Major" }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 2338,
                        columnNumber: 25
                      }, this),
                      /* @__PURE__ */ jsxDEV("option", { value: "Critical", children: "Critical" }, void 0, false, {
                        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                        lineNumber: 2339,
                        columnNumber: 25
                      }, this)
                    ]
                  },
                  void 0,
                  true,
                  {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 2332,
                    columnNumber: 23
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2328,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("label", { className: "block text-xs font-medium text-text-secondary mb-1", children: "Description" }, void 0, false, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2343,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "textarea",
                  {
                    className: "w-full border-border-strong rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[100px]",
                    placeholder: "Describe the issue specifically so the site team can fix it...",
                    value: obsText,
                    onChange: (e) => setObsText(e.target.value)
                  },
                  void 0,
                  false,
                  {
                    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                    lineNumber: 2346,
                    columnNumber: 23
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2342,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("label", { className: "block text-xs font-medium text-text-secondary mb-1.5", children: "Evidence Photos" }, void 0, false, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2354,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap gap-3 items-center", children: [
                  currentPhotos.map(
                    (url, idx) => /* @__PURE__ */ jsxDEV("div", { className: "relative w-20 h-20 group", children: [
                      /* @__PURE__ */ jsxDEV(
                        "img",
                        {
                          src: getFileUrl(url),
                          alt: "Preview",
                          className: "w-full h-full object-cover rounded-lg border shadow-sm"
                        },
                        void 0,
                        false,
                        {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2360,
                          columnNumber: 29
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDEV(
                        "button",
                        {
                          onClick: () => setCurrentPhotos(
                            (prev) => prev.filter((_, i) => i !== idx)
                          ),
                          className: "absolute -top-2 -right-2 bg-error text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg",
                          children: /* @__PURE__ */ jsxDEV(X, { className: "w-3 h-3" }, void 0, false, {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 2373,
                            columnNumber: 31
                          }, this)
                        },
                        void 0,
                        false,
                        {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2365,
                          columnNumber: 29
                        },
                        this
                      )
                    ] }, idx, true, {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2359,
                      columnNumber: 23
                    }, this)
                  ),
                  /* @__PURE__ */ jsxDEV(
                    "label",
                    {
                      className: `w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-border-default rounded-lg hover:border-amber-400 hover:bg-warning-muted transition-all cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`,
                      children: [
                        /* @__PURE__ */ jsxDEV(Camera, { className: "w-6 h-6 text-text-disabled" }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2380,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-text-muted mt-1 font-medium", children: uploading ? "Uploading..." : "Add Photo" }, void 0, false, {
                          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                          lineNumber: 2381,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV(
                          "input",
                          {
                            type: "file",
                            className: "hidden",
                            accept: "image/*",
                            onChange: handleFileUpload
                          },
                          void 0,
                          false,
                          {
                            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                            lineNumber: 2384,
                            columnNumber: 27
                          },
                          this
                        )
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                      lineNumber: 2377,
                      columnNumber: 25
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2357,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2353,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "flex justify-end pt-2", children: /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: handleRaiseObservation,
                  disabled: savingObs || !obsText.trim() || uploading,
                  className: "px-6 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 shadow-md transform active:scale-95 transition-all",
                  children: savingObs ? "Submitting..." : "Submit Observation"
                },
                void 0,
                false,
                {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2394,
                  columnNumber: 23
                },
                this
              ) }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2393,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
              lineNumber: 2327,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2321,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 2151,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2137,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2136,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
      lineNumber: 986,
      columnNumber: 7
    }, this),
    showReversalModal && inspectionDetail && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-surface-overlay flex items-center justify-center p-4 z-50", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-surface-card rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 mb-4", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center", children: /* @__PURE__ */ jsxDEV(AlertTriangle, { className: "w-6 h-6 text-warning" }, void 0, false, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 2416,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 2415,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-xl font-bold text-text-primary", children: [
            "Reverse RFI #",
            inspectionDetail.id
          ] }, void 0, true, {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2419,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-text-muted", children: inspectionDetail.activity?.activityName }, void 0, false, {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2422,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 2418,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2414,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "bg-warning-muted border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800", children: [
        /* @__PURE__ */ jsxDEV("strong", { children: "Warning:" }, void 0, false, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 2428,
          columnNumber: 15
        }, this),
        " Reversing will change the status to REVERSED. The raiser will be notified. All signatures are preserved for audit."
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2427,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("label", { className: "block text-sm font-bold text-text-secondary mb-1", children: "Reason for Reversal *" }, void 0, false, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 2433,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV(
          "textarea",
          {
            rows: 4,
            className: "w-full bg-surface-base border border-border-default rounded-xl p-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none",
            placeholder: "Explain why this approval is being reversed...",
            value: reversalReason,
            onChange: (e) => setReversalReason(e.target.value)
          },
          void 0,
          false,
          {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2436,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2432,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex gap-4 mt-6", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => {
              setShowReversalModal(false);
              setReversalReason("");
            },
            className: "px-6 py-3 rounded-xl font-bold text-text-secondary bg-surface-raised hover:bg-gray-200 transition-colors flex-1",
            children: "Cancel"
          },
          void 0,
          false,
          {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2445,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: async () => {
              if (!reversalReason.trim()) return alert("Reason required");
              setReversalLoading(true);
              try {
                await api.post(
                  `/quality/inspections/${inspectionDetail.id}/workflow/reverse`,
                  { reason: reversalReason }
                );
                alert("RFI reversed. Raiser notified.");
                setShowReversalModal(false);
                setReversalReason("");
                setSelectedInspectionId(null);
                setRefreshKey((k) => k + 1);
              } catch (err) {
                alert(err.response?.data?.message || "Reversal failed.");
              } finally {
                setReversalLoading(false);
              }
            },
            disabled: reversalLoading || !reversalReason.trim(),
            className: "px-6 py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all flex-1 disabled:opacity-50 flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsxDEV(RotateCcw, { className: "w-4 h-4" }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2477,
                columnNumber: 17
              }, this),
              reversalLoading ? "Reversing..." : "Confirm Reversal"
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2454,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2444,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
      lineNumber: 2413,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
      lineNumber: 2412,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      SignatureModal,
      {
        isOpen: showFinalApproveSig,
        onClose: () => {
          setShowFinalApproveSig(false);
          setActiveStageId(null);
        },
        onSign: executeFinalApprove,
        title: activeStageId != null ? "Stage Approval Signature" : "Final Approval Signature",
        description: activeStageId != null ? "Sign to approve this checklist stage." : "Sign to grant final approval for this RFI."
      },
      void 0,
      false,
      {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2485,
        columnNumber: 7
      },
      this
    ),
    showDelegationModal && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-surface-overlay flex items-center justify-center z-[60] p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-surface-card rounded-2xl shadow-2xl w-full max-w-md flex flex-col p-6", children: [
      /* @__PURE__ */ jsxDEV("h3", { className: "text-xl font-bold text-text-primary mb-4 flex items-center gap-2", children: [
        /* @__PURE__ */ jsxDEV(UserCheck, { className: "w-6 h-6 text-secondary" }, void 0, false, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 2504,
          columnNumber: 15
        }, this),
        "Delegate Approval Step"
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2503,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-text-muted mb-6", children: "Select a user to delegate this approval step to. They will be notified and can approve on your behalf." }, void 0, false, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2507,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "space-y-4 mb-8", children: [
        /* @__PURE__ */ jsxDEV("label", { className: "block text-xs font-bold text-text-muted uppercase", children: "Select Approver" }, void 0, false, {
          fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
          lineNumber: 2513,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV(
          "select",
          {
            className: "w-full p-2.5 bg-surface-base border border-border-default rounded-lg text-sm focus:ring-2 focus:ring-secondary",
            onChange: (e) => setSelectedDelegateId(Number(e.target.value)),
            value: selectedDelegateId || "",
            children: [
              /* @__PURE__ */ jsxDEV("option", { value: "", children: "-- Choose User --" }, void 0, false, {
                fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                lineNumber: 2521,
                columnNumber: 17
              }, this),
              eligibleUsers.map(
                (u) => /* @__PURE__ */ jsxDEV("option", { value: u.id, children: [
                  u.name,
                  " (",
                  u.role,
                  u.company ? ` â?¢ ${u.company}` : "",
                  ")"
                ] }, u.id, true, {
                  fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
                  lineNumber: 2523,
                  columnNumber: 15
                }, this)
              )
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2516,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2512,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setShowDelegationModal(false),
            className: "flex-1 px-4 py-2 border border-border-default rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-base",
            children: "Cancel"
          },
          void 0,
          false,
          {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2531,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: handleDelegate,
            disabled: !selectedDelegateId || delegating,
            className: "flex-1 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark disabled:opacity-50",
            children: delegating ? "Delegating..." : "Confirm Delegation"
          },
          void 0,
          false,
          {
            fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
            lineNumber: 2537,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
        lineNumber: 2530,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
      lineNumber: 2502,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
      lineNumber: 2501,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "/app/frontend/src/views/quality/QualityApprovalsPage.tsx",
    lineNumber: 985,
    columnNumber: 5
  }, this);
}
_s(QualityApprovalsPage, "Q6mMiBcnT/mMR1/rsplD3UuTELc=", false, function() {
  return [useParams, useAuth];
});
_c = QualityApprovalsPage;
var _c;
$RefreshReg$(_c, "QualityApprovalsPage");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/app/frontend/src/views/quality/QualityApprovalsPage.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/app/frontend/src/views/quality/QualityApprovalsPage.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) {
  return RefreshRuntime.register(type, "/app/frontend/src/views/quality/QualityApprovalsPage.tsx " + id);
}
function $RefreshSig$() {
  return RefreshRuntime.createSignatureFunctionForTransform();
}

//# sourceMappingURL=data:application/json;base64,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SUFBQThUO0FBQUFDLGFBQUFELElBQUEiLCJuYW1lcyI6WyJ1c2VTdGF0ZSIsInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VQYXJhbXMiLCJ1c2VBdXRoIiwiUGVybWlzc2lvbkNvZGUiLCJDbGlwYm9hcmRDaGVjayIsIkFsZXJ0Q2lyY2xlIiwiQ2hlY2tDaXJjbGUyIiwiQ2xvY2siLCJTaGllbGRDaGVjayIsIlVzZXJDaGVjayIsIk1lc3NhZ2VTcXVhcmVXYXJuaW5nIiwiWCIsIkNhbWVyYSIsIkZpbGVEb3duIiwiUm90YXRlQ2N3IiwiVHJhc2gyIiwiQWxlcnRUcmlhbmdsZSIsIkxheW91dERhc2hib2FyZCIsIk1hcFBpbiIsIkJ1aWxkaW5nMiIsIkxheWVycyIsIkhvbWUiLCJTaXJlbiIsImFwaSIsIlNpZ25hdHVyZU1vZGFsIiwiQVBQUk9WQUxfVEFCUyIsImtleSIsImxhYmVsIiwiU0FWRURfVklFV1MiLCJTTEFfQlVDS0VUUyIsImlzUGVuZGluZ1N0YXR1cyIsInN0YXR1cyIsInBhcnNlTG9jYXRpb25IaWVyYXJjaHkiLCJpbnNwIiwiZXhwbGljaXQiLCJibG9ja05hbWUiLCJ0b3dlck5hbWUiLCJmbG9vck5hbWUiLCJ1bml0TmFtZSIsInJvb21OYW1lIiwiZmlsdGVyIiwieCIsInRyaW0iLCJsZW5ndGgiLCJtYXAiLCJyYXciLCJsb2NhdGlvblBhdGgiLCJlcHNOb2RlIiwibmFtZSIsInNwbGl0IiwicyIsIkJvb2xlYW4iLCJnZXRGbG9vckxhYmVsIiwiaGllcmFyY2h5IiwiZmluZCIsImgiLCJ0b0xvd2VyQ2FzZSIsImluY2x1ZGVzIiwiaXNTdGFnZUFwcHJvdmVkIiwic3RhZ2UiLCJpc0xvY2tlZCIsInNpZ25hdHVyZXMiLCJzb21lIiwic2lnbmF0dXJlIiwiYWN0aW9uVHlwZSIsImlzUmV2ZXJzZWQiLCJnZXRDaGVja2VkU3RhZ2VJdGVtcyIsIml0ZW1zIiwiaXRlbSIsInZhbHVlIiwiaXNPayIsImlzU3RhZ2VDaGVja2xpc3RDb21wbGV0ZSIsInRvdGFsSXRlbXMiLCJnZXRTbGFCdWNrZXQiLCJub3ciLCJEYXRlIiwic2xhRHVlQXQiLCJocnMiLCJnZXRUaW1lIiwiYWdlSG91cnMiLCJyZXF1ZXN0RGF0ZSIsImdldFByaW9yaXR5U2NvcmUiLCJzY29yZSIsImJ1Y2tldCIsInBlbmRpbmdPYnNlcnZhdGlvbkNvdW50IiwidG90YWwiLCJ3b3JrZmxvd1RvdGFsTGV2ZWxzIiwiY3VycmVudCIsIndvcmtmbG93Q3VycmVudExldmVsIiwiTWF0aCIsImZsb29yIiwiUXVhbGl0eUFwcHJvdmFsc1BhZ2UiLCJfcyIsInByb2plY3RJZCIsImluc3BlY3Rpb25zIiwic2V0SW5zcGVjdGlvbnMiLCJzZWxlY3RlZEluc3BlY3Rpb25JZCIsInNldFNlbGVjdGVkSW5zcGVjdGlvbklkIiwiaW5zcGVjdGlvbkRldGFpbCIsInNldEluc3BlY3Rpb25EZXRhaWwiLCJsb2FkaW5nTGlzdCIsInNldExvYWRpbmdMaXN0IiwibG9hZGluZ0RldGFpbCIsInNldExvYWRpbmdEZXRhaWwiLCJyZWZyZXNoS2V5Iiwic2V0UmVmcmVzaEtleSIsIndvcmtmbG93U3RhdGUiLCJzZXRXb3JrZmxvd1N0YXRlIiwib2JzZXJ2YXRpb25zIiwic2V0T2JzZXJ2YXRpb25zIiwib2JzVGFiIiwic2V0T2JzVGFiIiwic2hvd09ic01vZGFsIiwic2V0U2hvd09ic01vZGFsIiwic2hvd0RlbGVnYXRpb25Nb2RhbCIsInNldFNob3dEZWxlZ2F0aW9uTW9kYWwiLCJkZWxlZ2F0aW5nIiwic2V0RGVsZWdhdGluZyIsImVsaWdpYmxlVXNlcnMiLCJzZXRFbGlnaWJsZVVzZXJzIiwic2VsZWN0ZWREZWxlZ2F0ZUlkIiwic2V0U2VsZWN0ZWREZWxlZ2F0ZUlkIiwib2JzVGV4dCIsInNldE9ic1RleHQiLCJvYnNUeXBlIiwic2V0T2JzVHlwZSIsImN1cnJlbnRQaG90b3MiLCJzZXRDdXJyZW50UGhvdG9zIiwic2F2aW5nT2JzIiwic2V0U2F2aW5nT2JzIiwidXBsb2FkaW5nIiwic2V0VXBsb2FkaW5nIiwic2hvd1JldmVyc2FsTW9kYWwiLCJzZXRTaG93UmV2ZXJzYWxNb2RhbCIsInJldmVyc2FsUmVhc29uIiwic2V0UmV2ZXJzYWxSZWFzb24iLCJyZXZlcnNhbExvYWRpbmciLCJzZXRSZXZlcnNhbExvYWRpbmciLCJzaG93RmluYWxBcHByb3ZlU2lnIiwic2V0U2hvd0ZpbmFsQXBwcm92ZVNpZyIsImFjdGl2ZVN0YWdlSWQiLCJzZXRBY3RpdmVTdGFnZUlkIiwidXNlciIsImhhc1Blcm1pc3Npb24iLCJpc0FkbWluIiwiUVVBTElUWV9JTlNQRUNUSU9OX0RFTEVURSIsImNhbkFwcHJvdmVJbnNwZWN0aW9uIiwiUVVBTElUWV9JTlNQRUNUSU9OX0FQUFJPVkUiLCJnZXRGaWxlVXJsIiwicGF0aCIsInN0YXJ0c1dpdGgiLCJiYXNlVXJsIiwiaW1wb3J0IiwiZW52IiwiVklURV9BUElfVVJMIiwiZmlsdGVyU3RhdHVzIiwic2V0RmlsdGVyU3RhdHVzIiwic2VsZWN0ZWRGbG9vciIsInNldFNlbGVjdGVkRmxvb3IiLCJzZWxlY3RlZFNsYUJ1Y2tldCIsInNldFNlbGVjdGVkU2xhQnVja2V0Iiwic2VsZWN0ZWRWaWV3Iiwic2V0U2VsZWN0ZWRWaWV3Iiwic2hvd092ZXJkdWVPbmx5Iiwic2V0U2hvd092ZXJkdWVPbmx5IiwiZ2V0IiwicGFyYW1zIiwidGhlbiIsInJlcyIsImRhdGEiLCJmaW5hbGx5IiwiUHJvbWlzZSIsImFsbCIsImNhdGNoIiwiZGV0YWlsUmVzIiwiZmxvd1JlcyIsImFjdGl2aXR5SWQiLCJvYnNSZXMiLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiLCJmaWx0ZXJlZEluc3BlY3Rpb25zIiwiaSIsImFwcHJvdmFsTWV0cmljcyIsInBlbmRpbmciLCJhcHByb3ZlZCIsInJlamVjdGVkIiwiZmxvb3JNYXAiLCJNYXAiLCJmb3JFYWNoIiwiYXJyIiwicHVzaCIsInNldCIsImZsb29yc1BlbmRpbmciLCJBcnJheSIsImZyb20iLCJ2YWx1ZXMiLCJyb3dzIiwiZmxvb3JzQ29tcGxldGVkIiwiZXZlcnkiLCJkYXNoYm9hcmRRdWV1ZSIsInF1ZXVlIiwic3RhZ2VzIiwiaXQiLCJzb3J0IiwiYSIsImIiLCJkYXNoYm9hcmRTdGF0cyIsIm92ZXJkdWVDb3VudCIsImR1ZTI0IiwiZHVlNDgiLCJ1cGNvbWluZyIsIm1pc3NpbmdMb2NhdGlvbiIsIm1pc3NpbmdXb3JrZmxvdyIsImZpbHRlcmVkT2JzZXJ2YXRpb25zIiwibyIsImdldERheXNPcGVuIiwiY3JlYXRlZEF0IiwiZGF5cyIsInRleHQiLCJjb2xvciIsImhhbmRsZUl0ZW1WYWx1ZUNoYW5nZSIsIml0ZW1JZCIsInZhbCIsInByZXYiLCJuZXdTdGFnZXMiLCJpZCIsImhhbmRsZUl0ZW1SZW1hcmtzQ2hhbmdlIiwicmVtYXJrcyIsIml0ZW1Jc0NoZWNrZWQiLCJzdGFnZUhhc0NoZWNrZWRJdGVtcyIsInNhdmVDaGVja2xpc3RQcm9ncmVzcyIsInN0YWdlSWQiLCJzaWxlbnQiLCJzdGFnZXNUb1NhdmUiLCJhbGVydCIsImNoZWNrZWRDb3VudCIsInRvdGFsQ291bnQiLCJzdGFnZVN0YXR1cyIsInVwZGF0ZVN0YWdlIiwiayIsInJlc3BvbnNlIiwibWVzc2FnZSIsInBheWxvYWQiLCJzdGFnZUluc3BlY3Rpb25JZCIsImVudHJ5IiwiYXR0ZW1wdHMiLCJtZXRob2QiLCJ1cmwiLCJsYXN0RXJyb3IiLCJhdHRlbXB0IiwicGF0Y2giLCJwb3N0IiwiYXBwcm92ZVN0YWdlV2l0aFNpZ25hdHVyZSIsImluc3BlY3Rpb25JZCIsInNpZ25hdHVyZURhdGEiLCJjb21tZW50cyIsImZldGNoRWxpZ2libGVVc2VycyIsImhhbmRsZURlbGVnYXRlIiwidGFyZ2V0VXNlcklkIiwiaW5zcFJlcyIsIndmUmVzIiwiaGFuZGxlSW5pdGlhdGVBcHByb3ZlIiwidW5kZWZpbmVkIiwiaGFuZGxlQXBwcm92ZVN0YWdlIiwiZXhlY3V0ZUZpbmFsQXBwcm92ZSIsInJlYWR5U3RhZ2VzIiwibGF0ZXN0SW5zcGVjdGlvbkRldGFpbCIsInJlZnJlc2hlZERldGFpbCIsInBlbmRpbmdTdGFnZXMiLCJFcnJvciIsInN0YWdlVGVtcGxhdGUiLCJqb2luIiwiY3VycmVudFN0ZXAiLCJzdGVwcyIsInN0ZXBPcmRlciIsImN1cnJlbnRTdGVwT3JkZXIiLCJzaWduZWRCeSIsImRpc3BsYXlOYW1lIiwidXNlcm5hbWUiLCJ3b3JrZmxvd05vZGUiLCJpc0ZpbmFsIiwiaGFuZGxlUmVqZWN0IiwicmVhc29uIiwicHJvbXB0IiwiaW5zcGVjdGlvbkRhdGUiLCJ0b0lTT1N0cmluZyIsImhhbmRsZUZpbGVVcGxvYWQiLCJlIiwiZmlsZSIsInRhcmdldCIsImZpbGVzIiwiZm9ybURhdGEiLCJGb3JtRGF0YSIsImFwcGVuZCIsImhlYWRlcnMiLCJoYW5kbGVQcm92aXNpb25hbGx5QXBwcm92ZSIsImhhbmRsZVJhaXNlT2JzZXJ2YXRpb24iLCJvYnNlcnZhdGlvblRleHQiLCJ0eXBlIiwicGhvdG9zIiwiaGFuZGxlQ2xvc2VPYnNlcnZhdGlvbiIsIm9ic0lkIiwiY29uZmlybSIsImhhbmRsZURlbGV0ZU9ic2VydmF0aW9uIiwiZGVsZXRlIiwiYWxsQ2hlY2tlZCIsInBlbmRpbmdPYnNlcnZhdGlvbnNDb3VudCIsImZvcm1hdFNpZ25hdHVyZU1ldGEiLCJiaXRzIiwic2lnbmVyRGlzcGxheU5hbWUiLCJzaWduZXJDb21wYW55Iiwic2lnbmVyUm9sZUxhYmVsIiwic2lnbmVyUm9sZSIsImZvcm1hdFNpZ25hdHVyZUFjdGlvbiIsInJlcGxhY2VBbGwiLCJhcHByb3ZhbEhpc3RvcnkiLCJ3b3JrZmxvd0VudHJpZXMiLCJ3b3JrZmxvd1N1bW1hcnkiLCJjb21wbGV0ZWRTdGVwcyIsInN0ZXAiLCJzY29wZSIsInRpdGxlIiwic3RlcE5hbWUiLCJhY3Rpb24iLCJtaW5BcHByb3ZhbHNSZXF1aXJlZCIsImN1cnJlbnRBcHByb3ZhbENvdW50IiwibWV0YSIsImF0IiwiY29tcGxldGVkQXQiLCJzdGFnZUVudHJpZXMiLCJmbGF0TWFwIiwiaW5kZXgiLCJzaWduZWRBdCIsImFUaW1lIiwiYlRpbWUiLCJ0YWIiLCJ2aWV3Iiwia2V5cyIsImYiLCJjaGVja2VkIiwiZW50cmllcyIsImxvY2FsZUNvbXBhcmUiLCJwIiwiciIsInJ3Iiwic2xpY2UiLCJsb2NhdGlvbiIsImFjdGl2aXR5IiwiYWN0aXZpdHlOYW1lIiwiZXBzTm9kZUlkIiwicGVuZGluZ0FwcHJvdmFsTGV2ZWwiLCJwZW5kaW5nQXBwcm92YWxMYWJlbCIsInByaW9yaXR5IiwicGVuZGluZ0FwcHJvdmFsRGlzcGxheSIsInBlbmRpbmdTdGVwIiwicnVuU3RhdHVzIiwic3RhZ2VBcHByb3ZhbFN1bW1hcnkiLCJ0b3RhbFN0YWdlcyIsImFwcHJvdmVkU3RhZ2VzIiwicGVuZGluZ0ZpbmFsQXBwcm92YWwiLCJpbnNwZWN0ZWRCeSIsInN0cmF0ZWd5TmFtZSIsInJlbGVhc2VTdHJhdGVneVZlcnNpb24iLCJwcm9jZXNzQ29kZSIsImRvY3VtZW50VHlwZSIsInJlc3BvbnNlVHlwZSIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsImhyZWYiLCJpc0FwcHJvdmVkIiwiZG93bmxvYWQiLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJjbGljayIsInJlbW92ZUNoaWxkIiwicmV2b2tlT2JqZWN0VVJMIiwic0lkeCIsImlzQ3VycmVudCIsImlzQ29tcGxldGVkIiwiaXNSZWplY3RlZCIsImlzUmFpc2VyU3RlcCIsInN0ZXBUeXBlIiwiaXNMYXN0U3RlcE5vZGUiLCJtYXgiLCJjb2xvckNsYXNzIiwic3RlcExhYmVsIiwic3RlcFN1YnRpdGxlIiwidG9Mb2NhbGVTdHJpbmciLCJsYXRlc3RTdGFnZUFwcHJvdmFsIiwicmV2ZXJzZSIsInNpZ0lkeCIsIml0ZW1UZW1wbGF0ZSIsInNlcXVlbmNlIiwiaXRlbVRleHQiLCJvYnMiLCJpZHgiLCJhZ2VJbmZvIiwiUVVBTElUWV9PQlNFUlZBVElPTl9ERUxFVEUiLCJwSWR4IiwiY2xvc3VyZVRleHQiLCJjbG9zdXJlRXZpZGVuY2UiLCJfIiwiTnVtYmVyIiwidSIsInJvbGUiLCJjb21wYW55IiwiX2MiLCIkUmVmcmVzaFJlZyQiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiUXVhbGl0eUFwcHJvdmFsc1BhZ2UudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZU1lbW8gfSBmcm9tIFwicmVhY3RcIjtcbmltcG9ydCB7IHVzZVBhcmFtcyB9IGZyb20gXCJyZWFjdC1yb3V0ZXItZG9tXCI7XG5pbXBvcnQgeyB1c2VBdXRoIH0gZnJvbSBcIi4uLy4uL2NvbnRleHQvQXV0aENvbnRleHRcIjtcbmltcG9ydCB7IFBlcm1pc3Npb25Db2RlIH0gZnJvbSBcIi4uLy4uL2NvbmZpZy9wZXJtaXNzaW9uc1wiO1xuaW1wb3J0IHtcbiAgQ2xpcGJvYXJkQ2hlY2ssXG4gIEFsZXJ0Q2lyY2xlLFxuICBDaGVja0NpcmNsZTIsXG4gIENsb2NrLFxuICBTaGllbGRDaGVjayxcbiAgVXNlckNoZWNrLFxuICBNZXNzYWdlU3F1YXJlV2FybmluZyxcbiAgWCxcbiAgQ2FtZXJhLFxuICBGaWxlRG93bixcbiAgUm90YXRlQ2N3LFxuICBUcmFzaDIsXG4gIEFsZXJ0VHJpYW5nbGUsXG4gIExheW91dERhc2hib2FyZCxcbiAgTWFwUGluLFxuICBCdWlsZGluZzIsXG4gIExheWVycyxcbiAgSG9tZSxcbiAgU2lyZW4sXG59IGZyb20gXCJsdWNpZGUtcmVhY3RcIjtcbmltcG9ydCBhcGkgZnJvbSBcIi4uLy4uL2FwaS9heGlvc1wiO1xuaW1wb3J0IFNpZ25hdHVyZU1vZGFsIGZyb20gXCIuLi8uLi9jb21wb25lbnRzL3F1YWxpdHkvU2lnbmF0dXJlTW9kYWxcIjtcblxuaW50ZXJmYWNlIFF1YWxpdHlJbnNwZWN0aW9uIHtcbiAgaWQ6IG51bWJlcjtcbiAgYWN0aXZpdHlJZDogbnVtYmVyO1xuICBlcHNOb2RlSWQ6IG51bWJlcjtcbiAgc3RhdHVzOlxuICAgIHwgXCJQRU5ESU5HXCJcbiAgICB8IFwiQVBQUk9WRURcIlxuICAgIHwgXCJQUk9WSVNJT05BTExZX0FQUFJPVkVEXCJcbiAgICB8IFwiUkVKRUNURURcIlxuICAgIHwgXCJDQU5DRUxFRFwiXG4gICAgfCBcIlJFVkVSU0VEXCJcbiAgICB8IFwiUEFSVElBTExZX0FQUFJPVkVEXCI7XG4gIHJlcXVlc3REYXRlOiBzdHJpbmc7XG4gIGluc3BlY3Rpb25EYXRlPzogc3RyaW5nO1xuICBjb21tZW50cz86IHN0cmluZztcbiAgaW5zcGVjdGVkQnk/OiBzdHJpbmc7XG4gIGFjdGl2aXR5Pzoge1xuICAgIGlkOiBudW1iZXI7XG4gICAgYWN0aXZpdHlOYW1lOiBzdHJpbmc7XG4gIH07XG4gIGVwc05vZGU/OiB7XG4gICAgbGFiZWw6IHN0cmluZztcbiAgICBuYW1lPzogc3RyaW5nO1xuICB9O1xuICBibG9ja05hbWU/OiBzdHJpbmc7XG4gIHRvd2VyTmFtZT86IHN0cmluZztcbiAgZmxvb3JOYW1lPzogc3RyaW5nO1xuICB1bml0TmFtZT86IHN0cmluZztcbiAgcm9vbU5hbWU/OiBzdHJpbmc7XG4gIGxvY2F0aW9uUGF0aD86IHN0cmluZztcbiAgcGVuZGluZ09ic2VydmF0aW9uQ291bnQ/OiBudW1iZXI7XG4gIHdvcmtmbG93Q3VycmVudExldmVsPzogbnVtYmVyO1xuICB3b3JrZmxvd1RvdGFsTGV2ZWxzPzogbnVtYmVyO1xuICBwZW5kaW5nQXBwcm92YWxMZXZlbD86IG51bWJlcjtcbiAgcGVuZGluZ0FwcHJvdmFsTGFiZWw/OiBzdHJpbmc7XG4gIHBlbmRpbmdBcHByb3ZhbERpc3BsYXk/OiBzdHJpbmc7XG4gIHBlbmRpbmdBcHByb3Zlck5hbWVzPzogc3RyaW5nW107XG4gIHBlbmRpbmdBcHByb3ZhbEJ5PzogbnVtYmVyIHwgc3RyaW5nO1xuICB3b3JrZmxvd1N1bW1hcnk/OiB7XG4gICAgcnVuU3RhdHVzPzogc3RyaW5nO1xuICAgIHJlbGVhc2VTdHJhdGVneUlkPzogbnVtYmVyO1xuICAgIHJlbGVhc2VTdHJhdGVneVZlcnNpb24/OiBudW1iZXI7XG4gICAgc3RyYXRlZ3lOYW1lPzogc3RyaW5nO1xuICAgIHByb2Nlc3NDb2RlPzogc3RyaW5nO1xuICAgIGRvY3VtZW50VHlwZT86IHN0cmluZztcbiAgICBwZW5kaW5nU3RlcD86IHtcbiAgICAgIHN0ZXBPcmRlcj86IG51bWJlcjtcbiAgICAgIHN0ZXBOYW1lPzogc3RyaW5nO1xuICAgICAgc3RhdHVzPzogc3RyaW5nO1xuICAgICAgYXNzaWduZWRVc2VySWQ/OiBudW1iZXIgfCBudWxsO1xuICAgICAgYXNzaWduZWRVc2VySWRzPzogbnVtYmVyW107XG4gICAgICBhc3NpZ25lZFJvbGVJZD86IG51bWJlciB8IG51bGw7XG4gICAgICBwZW5kaW5nQXBwcm92ZXJOYW1lcz86IHN0cmluZ1tdO1xuICAgICAgcGVuZGluZ0FwcHJvdmFsRGlzcGxheT86IHN0cmluZyB8IG51bGw7XG4gICAgICBjdXJyZW50QXBwcm92YWxDb3VudD86IG51bWJlcjtcbiAgICAgIG1pbkFwcHJvdmFsc1JlcXVpcmVkPzogbnVtYmVyO1xuICAgICAgYXBwcm92ZWRVc2VySWRzPzogbnVtYmVyW107XG4gICAgfSB8IG51bGw7XG4gICAgY29tcGxldGVkU3RlcHM/OiBBcnJheTx7XG4gICAgICBzdGVwT3JkZXI/OiBudW1iZXI7XG4gICAgICBzdGVwTmFtZT86IHN0cmluZztcbiAgICAgIGN1cnJlbnRBcHByb3ZhbENvdW50PzogbnVtYmVyO1xuICAgICAgbWluQXBwcm92YWxzUmVxdWlyZWQ/OiBudW1iZXI7XG4gICAgICBzaWduZXJEaXNwbGF5TmFtZT86IHN0cmluZztcbiAgICAgIHNpZ25lckNvbXBhbnk/OiBzdHJpbmc7XG4gICAgICBzaWduZXJSb2xlPzogc3RyaW5nO1xuICAgICAgY29tcGxldGVkQXQ/OiBzdHJpbmc7XG4gICAgfT47XG4gIH07XG4gIHN0YWdlQXBwcm92YWxTdW1tYXJ5Pzoge1xuICAgIGFwcHJvdmVkU3RhZ2VzPzogbnVtYmVyO1xuICAgIHRvdGFsU3RhZ2VzPzogbnVtYmVyO1xuICAgIHBlbmRpbmdGaW5hbEFwcHJvdmFsPzogYm9vbGVhbjtcbiAgfTtcbiAgc2xhRHVlQXQ/OiBzdHJpbmc7XG4gIGlzTG9ja2VkPzogYm9vbGVhbjtcbiAgc3RhZ2VzPzogYW55W107IC8vIFBvcHVsYXRlZCBpbiBkZXRhaWwgdmlld1xufVxuXG50eXBlIEFwcHJvdmFsVGFiID0gXCJQRU5ESU5HXCIgfCBcIkFMTFwiIHwgXCJBUFBST1ZFRFwiIHwgXCJSRUpFQ1RFRFwiIHwgXCJEQVNIQk9BUkRcIjtcbnR5cGUgU2F2ZWRWaWV3ID1cbiAgfCBcIkFsbCBQZW5kaW5nXCJcbiAgfCBcIk92ZXJkdWUgRm9jdXNcIlxuICB8IFwiSGlnaCBSaXNrXCJcbiAgfCBcIlJlYWR5IEZvciBDbG9zZW91dFwiO1xudHlwZSBTbGFCdWNrZXQgPSBcIkFsbFwiIHwgXCJPdmVyZHVlXCIgfCBcIkR1ZSA8MjRoXCIgfCBcIkR1ZSAyNC00OGhcIiB8IFwiVXBjb21pbmdcIjtcblxuY29uc3QgQVBQUk9WQUxfVEFCUzogQXJyYXk8eyBrZXk6IEFwcHJvdmFsVGFiOyBsYWJlbDogc3RyaW5nIH0+ID0gW1xuICB7IGtleTogXCJQRU5ESU5HXCIsIGxhYmVsOiBcIlBlbmRpbmcgUUNcIiB9LFxuICB7IGtleTogXCJBTExcIiwgbGFiZWw6IFwiQWxsIFJGSXNcIiB9LFxuICB7IGtleTogXCJBUFBST1ZFRFwiLCBsYWJlbDogXCJBcHByb3ZlZFwiIH0sXG4gIHsga2V5OiBcIlJFSkVDVEVEXCIsIGxhYmVsOiBcIlJlamVjdGVkXCIgfSxcbiAgeyBrZXk6IFwiREFTSEJPQVJEXCIsIGxhYmVsOiBcIkRhc2hib2FyZFwiIH0sXG5dO1xuXG5jb25zdCBTQVZFRF9WSUVXUzogU2F2ZWRWaWV3W10gPSBbXG4gIFwiQWxsIFBlbmRpbmdcIixcbiAgXCJPdmVyZHVlIEZvY3VzXCIsXG4gIFwiSGlnaCBSaXNrXCIsXG4gIFwiUmVhZHkgRm9yIENsb3Nlb3V0XCIsXG5dO1xuXG5jb25zdCBTTEFfQlVDS0VUUzogU2xhQnVja2V0W10gPSBbXG4gIFwiQWxsXCIsXG4gIFwiT3ZlcmR1ZVwiLFxuICBcIkR1ZSA8MjRoXCIsXG4gIFwiRHVlIDI0LTQ4aFwiLFxuICBcIlVwY29taW5nXCIsXG5dO1xuXG5mdW5jdGlvbiBpc1BlbmRpbmdTdGF0dXMoc3RhdHVzOiBRdWFsaXR5SW5zcGVjdGlvbltcInN0YXR1c1wiXSkge1xuICByZXR1cm4gc3RhdHVzID09PSBcIlBFTkRJTkdcIiB8fCBzdGF0dXMgPT09IFwiUEFSVElBTExZX0FQUFJPVkVEXCI7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTG9jYXRpb25IaWVyYXJjaHkoaW5zcDogUXVhbGl0eUluc3BlY3Rpb24pIHtcbiAgY29uc3QgZXhwbGljaXQgPSBbXG4gICAgaW5zcC5ibG9ja05hbWUsXG4gICAgaW5zcC50b3dlck5hbWUsXG4gICAgaW5zcC5mbG9vck5hbWUsXG4gICAgaW5zcC51bml0TmFtZSxcbiAgICBpbnNwLnJvb21OYW1lLFxuICBdXG4gICAgLmZpbHRlcigoeCk6IHggaXMgc3RyaW5nID0+ICEheCAmJiB4LnRyaW0oKS5sZW5ndGggPiAwKVxuICAgIC5tYXAoKHgpID0+IHgudHJpbSgpKTtcbiAgaWYgKGV4cGxpY2l0Lmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gZXhwbGljaXQ7XG4gIH1cbiAgY29uc3QgcmF3ID1cbiAgICBpbnNwLmxvY2F0aW9uUGF0aCB8fCBpbnNwLmVwc05vZGU/LmxhYmVsIHx8IGluc3AuZXBzTm9kZT8ubmFtZSB8fCBcIlwiO1xuICByZXR1cm4gcmF3XG4gICAgLnNwbGl0KC9bPnwvLF0vZylcbiAgICAubWFwKChzKSA9PiBzLnRyaW0oKSlcbiAgICAuZmlsdGVyKEJvb2xlYW4pO1xufVxuXG5mdW5jdGlvbiBnZXRGbG9vckxhYmVsKGluc3A6IFF1YWxpdHlJbnNwZWN0aW9uKSB7XG4gIGlmIChpbnNwLmZsb29yTmFtZSkgcmV0dXJuIGluc3AuZmxvb3JOYW1lO1xuICBjb25zdCBoaWVyYXJjaHkgPSBwYXJzZUxvY2F0aW9uSGllcmFyY2h5KGluc3ApO1xuICByZXR1cm4gaGllcmFyY2h5LmZpbmQoKGgpID0+IGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhcImZsb29yXCIpKSB8fCBcIlVubWFwcGVkXCI7XG59XG5cbmZ1bmN0aW9uIGlzU3RhZ2VBcHByb3ZlZChzdGFnZTogYW55KSB7XG4gIGlmIChzdGFnZT8uc3RhdHVzID09PSBcIkFQUFJPVkVEXCIgfHwgc3RhZ2U/LmlzTG9ja2VkKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIChzdGFnZT8uc2lnbmF0dXJlcyB8fCBbXSkuc29tZShcbiAgICAoc2lnbmF0dXJlOiBhbnkpID0+XG4gICAgICBzaWduYXR1cmU/LmFjdGlvblR5cGUgPT09IFwiU1RBR0VfQVBQUk9WRVwiICYmICFzaWduYXR1cmU/LmlzUmV2ZXJzZWQsXG4gICk7XG59XG5cbmZ1bmN0aW9uIGdldENoZWNrZWRTdGFnZUl0ZW1zKHN0YWdlOiBhbnkpIHtcbiAgcmV0dXJuIChzdGFnZT8uaXRlbXMgfHwgW10pLmZpbHRlcihcbiAgICAoaXRlbTogYW55KSA9PlxuICAgICAgaXRlbT8udmFsdWUgPT09IFwiWUVTXCIgfHwgaXRlbT8udmFsdWUgPT09IFwiTkFcIiB8fCBpdGVtPy5pc09rLFxuICApLmxlbmd0aDtcbn1cblxuZnVuY3Rpb24gaXNTdGFnZUNoZWNrbGlzdENvbXBsZXRlKHN0YWdlOiBhbnkpIHtcbiAgY29uc3QgdG90YWxJdGVtcyA9IHN0YWdlPy5pdGVtcz8ubGVuZ3RoIHx8IDA7XG4gIHJldHVybiB0b3RhbEl0ZW1zID4gMCAmJiBnZXRDaGVja2VkU3RhZ2VJdGVtcyhzdGFnZSkgPT09IHRvdGFsSXRlbXM7XG59XG5cbmZ1bmN0aW9uIGdldFNsYUJ1Y2tldChpbnNwOiBRdWFsaXR5SW5zcGVjdGlvbik6IFNsYUJ1Y2tldCB7XG4gIGlmICghaXNQZW5kaW5nU3RhdHVzKGluc3Auc3RhdHVzKSkgcmV0dXJuIFwiVXBjb21pbmdcIjtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgaWYgKGluc3Auc2xhRHVlQXQpIHtcbiAgICBjb25zdCBocnMgPSAobmV3IERhdGUoaW5zcC5zbGFEdWVBdCkuZ2V0VGltZSgpIC0gbm93KSAvIDM2ZTU7XG4gICAgaWYgKGhycyA8IDApIHJldHVybiBcIk92ZXJkdWVcIjtcbiAgICBpZiAoaHJzIDwgMjQpIHJldHVybiBcIkR1ZSA8MjRoXCI7XG4gICAgaWYgKGhycyA8IDQ4KSByZXR1cm4gXCJEdWUgMjQtNDhoXCI7XG4gICAgcmV0dXJuIFwiVXBjb21pbmdcIjtcbiAgfVxuICBjb25zdCBhZ2VIb3VycyA9IChub3cgLSBuZXcgRGF0ZShpbnNwLnJlcXVlc3REYXRlKS5nZXRUaW1lKCkpIC8gMzZlNTtcbiAgaWYgKGFnZUhvdXJzID4gNDgpIHJldHVybiBcIk92ZXJkdWVcIjtcbiAgaWYgKGFnZUhvdXJzID4gMjQpIHJldHVybiBcIkR1ZSA8MjRoXCI7XG4gIGlmIChhZ2VIb3VycyA+IDEyKSByZXR1cm4gXCJEdWUgMjQtNDhoXCI7XG4gIHJldHVybiBcIlVwY29taW5nXCI7XG59XG5cbmZ1bmN0aW9uIGdldFByaW9yaXR5U2NvcmUoaW5zcDogUXVhbGl0eUluc3BlY3Rpb24pIHtcbiAgbGV0IHNjb3JlID0gMDtcbiAgY29uc3QgYnVja2V0ID0gZ2V0U2xhQnVja2V0KGluc3ApO1xuICBpZiAoYnVja2V0ID09PSBcIk92ZXJkdWVcIikgc2NvcmUgKz0gMTAwO1xuICBpZiAoYnVja2V0ID09PSBcIkR1ZSA8MjRoXCIpIHNjb3JlICs9IDYwO1xuICBpZiAoYnVja2V0ID09PSBcIkR1ZSAyNC00OGhcIikgc2NvcmUgKz0gMzU7XG4gIHNjb3JlICs9IChpbnNwLnBlbmRpbmdPYnNlcnZhdGlvbkNvdW50IHx8IDApICogMjA7XG4gIGNvbnN0IHRvdGFsID0gaW5zcC53b3JrZmxvd1RvdGFsTGV2ZWxzIHx8IDA7XG4gIGNvbnN0IGN1cnJlbnQgPSBpbnNwLndvcmtmbG93Q3VycmVudExldmVsIHx8IDA7XG4gIGlmICh0b3RhbCA+IDAgJiYgY3VycmVudCA+IDApIHNjb3JlICs9ICh0b3RhbCAtIGN1cnJlbnQgKyAxKSAqIDI7XG4gIGNvbnN0IGFnZUhvdXJzID0gKERhdGUubm93KCkgLSBuZXcgRGF0ZShpbnNwLnJlcXVlc3REYXRlKS5nZXRUaW1lKCkpIC8gMzZlNTtcbiAgc2NvcmUgKz0gTWF0aC5mbG9vcihhZ2VIb3VycyAvIDEyKTtcbiAgcmV0dXJuIHNjb3JlO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBRdWFsaXR5QXBwcm92YWxzUGFnZSgpIHtcbiAgY29uc3QgeyBwcm9qZWN0SWQgfSA9IHVzZVBhcmFtcygpO1xuICBjb25zdCBbaW5zcGVjdGlvbnMsIHNldEluc3BlY3Rpb25zXSA9IHVzZVN0YXRlPFF1YWxpdHlJbnNwZWN0aW9uW10+KFtdKTtcbiAgY29uc3QgW3NlbGVjdGVkSW5zcGVjdGlvbklkLCBzZXRTZWxlY3RlZEluc3BlY3Rpb25JZF0gPSB1c2VTdGF0ZTxcbiAgICBudW1iZXIgfCBudWxsXG4gID4obnVsbCk7XG4gIGNvbnN0IFtpbnNwZWN0aW9uRGV0YWlsLCBzZXRJbnNwZWN0aW9uRGV0YWlsXSA9IHVzZVN0YXRlPGFueT4obnVsbCk7XG4gIGNvbnN0IFtsb2FkaW5nTGlzdCwgc2V0TG9hZGluZ0xpc3RdID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbbG9hZGluZ0RldGFpbCwgc2V0TG9hZGluZ0RldGFpbF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtyZWZyZXNoS2V5LCBzZXRSZWZyZXNoS2V5XSA9IHVzZVN0YXRlKDApO1xuXG4gIC8vIFdvcmtmbG93IFN0YXRlXG4gIGNvbnN0IFt3b3JrZmxvd1N0YXRlLCBzZXRXb3JrZmxvd1N0YXRlXSA9IHVzZVN0YXRlPGFueT4obnVsbCk7XG5cbiAgLy8gT2JzZXJ2YXRpb25zIFN0YXRlXG4gIGNvbnN0IFtvYnNlcnZhdGlvbnMsIHNldE9ic2VydmF0aW9uc10gPSB1c2VTdGF0ZTxhbnlbXT4oW10pO1xuICBjb25zdCBbb2JzVGFiLCBzZXRPYnNUYWJdID0gdXNlU3RhdGU8XG4gICAgXCJQRU5ESU5HXCIgfCBcIlJFQ1RJRklFRFwiIHwgXCJDTE9TRURcIiB8IFwiQUxMXCJcbiAgPihcIlBFTkRJTkdcIik7XG4gIGNvbnN0IFtzaG93T2JzTW9kYWwsIHNldFNob3dPYnNNb2RhbF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtzaG93RGVsZWdhdGlvbk1vZGFsLCBzZXRTaG93RGVsZWdhdGlvbk1vZGFsXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW2RlbGVnYXRpbmcsIHNldERlbGVnYXRpbmddID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbZWxpZ2libGVVc2Vycywgc2V0RWxpZ2libGVVc2Vyc10gPSB1c2VTdGF0ZTxhbnlbXT4oW10pO1xuICBjb25zdCBbc2VsZWN0ZWREZWxlZ2F0ZUlkLCBzZXRTZWxlY3RlZERlbGVnYXRlSWRdID0gdXNlU3RhdGU8bnVtYmVyIHwgbnVsbD4oXG4gICAgbnVsbCxcbiAgKTtcbiAgY29uc3QgW29ic1RleHQsIHNldE9ic1RleHRdID0gdXNlU3RhdGUoXCJcIik7XG4gIGNvbnN0IFtvYnNUeXBlLCBzZXRPYnNUeXBlXSA9IHVzZVN0YXRlKFwiTWlub3JcIik7XG4gIGNvbnN0IFtjdXJyZW50UGhvdG9zLCBzZXRDdXJyZW50UGhvdG9zXSA9IHVzZVN0YXRlPHN0cmluZ1tdPihbXSk7XG4gIGNvbnN0IFtzYXZpbmdPYnMsIHNldFNhdmluZ09ic10gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFt1cGxvYWRpbmcsIHNldFVwbG9hZGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG5cbiAgLy8gUmV2ZXJzYWwgTW9kYWxcbiAgY29uc3QgW3Nob3dSZXZlcnNhbE1vZGFsLCBzZXRTaG93UmV2ZXJzYWxNb2RhbF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtyZXZlcnNhbFJlYXNvbiwgc2V0UmV2ZXJzYWxSZWFzb25dID0gdXNlU3RhdGUoXCJcIik7XG4gIGNvbnN0IFtyZXZlcnNhbExvYWRpbmcsIHNldFJldmVyc2FsTG9hZGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG5cbiAgLy8gU2lnbmF0dXJlIE1vZGFsc1xuICBjb25zdCBbc2hvd0ZpbmFsQXBwcm92ZVNpZywgc2V0U2hvd0ZpbmFsQXBwcm92ZVNpZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFthY3RpdmVTdGFnZUlkLCBzZXRBY3RpdmVTdGFnZUlkXSA9IHVzZVN0YXRlPG51bWJlciB8IG51bGw+KG51bGwpO1xuICAvLyBzaG93UmV2ZXJzYWxTaWcgY291bGQgYWxzbyBiZSBhZGRlZCBpZiByZXZlcnNhbCBuZWVkcyBkaWdpdGFsIHNpZ25hdHVyZSwgYnV0IHJlYXNvbiBpcyBhbHJlYWR5IGNhcHR1cmVkIGluIG1vZGFsLlxuXG4gIC8vIFVzZXIgaW5mb1xuICBjb25zdCB7IHVzZXIsIGhhc1Blcm1pc3Npb24gfSA9IHVzZUF1dGgoKTtcbiAgY29uc3QgaXNBZG1pbiA9IGhhc1Blcm1pc3Npb24oUGVybWlzc2lvbkNvZGUuUVVBTElUWV9JTlNQRUNUSU9OX0RFTEVURSk7XG4gIGNvbnN0IGNhbkFwcHJvdmVJbnNwZWN0aW9uID0gaGFzUGVybWlzc2lvbihcbiAgICBQZXJtaXNzaW9uQ29kZS5RVUFMSVRZX0lOU1BFQ1RJT05fQVBQUk9WRSxcbiAgKTtcblxuICAvLyBIZWxwZXIgZm9yIGNvcnJlY3QgaW1hZ2UgVVJMc1xuICBjb25zdCBnZXRGaWxlVXJsID0gKHBhdGg6IHN0cmluZykgPT4ge1xuICAgIGlmICghcGF0aCkgcmV0dXJuIFwiXCI7XG4gICAgaWYgKHBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHJldHVybiBwYXRoO1xuICAgIGNvbnN0IGJhc2VVcmwgPSBpbXBvcnQubWV0YS5lbnYuVklURV9BUElfVVJMIHx8IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCI7XG4gICAgcmV0dXJuIGAke2Jhc2VVcmx9JHtwYXRofWA7XG4gIH07XG5cbiAgLy8gRmlsdGVyIHN0YXRlc1xuICBjb25zdCBbZmlsdGVyU3RhdHVzLCBzZXRGaWx0ZXJTdGF0dXNdID0gdXNlU3RhdGU8QXBwcm92YWxUYWI+KFwiUEVORElOR1wiKTtcbiAgY29uc3QgW3NlbGVjdGVkRmxvb3IsIHNldFNlbGVjdGVkRmxvb3JdID0gdXNlU3RhdGUoXCJBbGwgRmxvb3JzXCIpO1xuICBjb25zdCBbc2VsZWN0ZWRTbGFCdWNrZXQsIHNldFNlbGVjdGVkU2xhQnVja2V0XSA9IHVzZVN0YXRlPFNsYUJ1Y2tldD4oXCJBbGxcIik7XG4gIGNvbnN0IFtzZWxlY3RlZFZpZXcsIHNldFNlbGVjdGVkVmlld10gPSB1c2VTdGF0ZTxTYXZlZFZpZXc+KFwiQWxsIFBlbmRpbmdcIik7XG4gIGNvbnN0IFtzaG93T3ZlcmR1ZU9ubHksIHNldFNob3dPdmVyZHVlT25seV0gPSB1c2VTdGF0ZShmYWxzZSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAocHJvamVjdElkKSB7XG4gICAgICBzZXRMb2FkaW5nTGlzdCh0cnVlKTtcbiAgICAgIGFwaVxuICAgICAgICAuZ2V0KFwiL3F1YWxpdHkvaW5zcGVjdGlvbnNcIiwge1xuICAgICAgICAgIHBhcmFtczogeyBwcm9qZWN0SWQgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oKHJlcykgPT4ge1xuICAgICAgICAgIHNldEluc3BlY3Rpb25zKHJlcy5kYXRhKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmZpbmFsbHkoKCkgPT4gc2V0TG9hZGluZ0xpc3QoZmFsc2UpKTtcbiAgICB9XG4gIH0sIFtwcm9qZWN0SWQsIHJlZnJlc2hLZXldKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChzZWxlY3RlZEluc3BlY3Rpb25JZCkge1xuICAgICAgc2V0TG9hZGluZ0RldGFpbCh0cnVlKTtcblxuICAgICAgLy8gQnJpbmcgZG93biBkZXRhaWwsIHdvcmtmbG93LCBhbmQgb2JzZXJ2YXRpb25zXG4gICAgICBQcm9taXNlLmFsbChbXG4gICAgICAgIGFwaS5nZXQoYC9xdWFsaXR5L2luc3BlY3Rpb25zLyR7c2VsZWN0ZWRJbnNwZWN0aW9uSWR9YCksXG4gICAgICAgIGFwaVxuICAgICAgICAgIC5nZXQoYC9xdWFsaXR5L2luc3BlY3Rpb25zLyR7c2VsZWN0ZWRJbnNwZWN0aW9uSWR9L3dvcmtmbG93YClcbiAgICAgICAgICAuY2F0Y2goKCkgPT4gKHsgZGF0YTogbnVsbCB9KSksXG4gICAgICBdKVxuICAgICAgICAudGhlbigoW2RldGFpbFJlcywgZmxvd1Jlc10pID0+IHtcbiAgICAgICAgICBzZXRJbnNwZWN0aW9uRGV0YWlsKGRldGFpbFJlcy5kYXRhKTtcbiAgICAgICAgICBzZXRXb3JrZmxvd1N0YXRlKGZsb3dSZXMuZGF0YSk7XG5cbiAgICAgICAgICAvLyBGZXRjaCBvYnNlcnZhdGlvbnMgZm9yIHRoaXMgYWN0aXZpdHlcbiAgICAgICAgICBpZiAoZGV0YWlsUmVzLmRhdGEuYWN0aXZpdHlJZCkge1xuICAgICAgICAgICAgYXBpXG4gICAgICAgICAgICAgIC5nZXQoXG4gICAgICAgICAgICAgICAgYC9xdWFsaXR5L2FjdGl2aXRpZXMvJHtkZXRhaWxSZXMuZGF0YS5hY3Rpdml0eUlkfS9vYnNlcnZhdGlvbnNgLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIC50aGVuKChvYnNSZXMpID0+IHNldE9ic2VydmF0aW9ucyhvYnNSZXMuZGF0YSkpXG4gICAgICAgICAgICAgIC5jYXRjaCgoZXJyKSA9PlxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gbG9hZCBvYnNlcnZhdGlvbnNcIiwgZXJyKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5maW5hbGx5KCgpID0+IHNldExvYWRpbmdEZXRhaWwoZmFsc2UpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2V0SW5zcGVjdGlvbkRldGFpbChudWxsKTtcbiAgICAgIHNldFdvcmtmbG93U3RhdGUobnVsbCk7XG4gICAgICBzZXRPYnNlcnZhdGlvbnMoW10pO1xuICAgIH1cbiAgfSwgW3NlbGVjdGVkSW5zcGVjdGlvbklkLCByZWZyZXNoS2V5XSk7XG5cbiAgY29uc3QgZmlsdGVyZWRJbnNwZWN0aW9ucyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGlmIChmaWx0ZXJTdGF0dXMgPT09IFwiREFTSEJPQVJEXCIpIHJldHVybiBpbnNwZWN0aW9ucztcbiAgICByZXR1cm4gaW5zcGVjdGlvbnMuZmlsdGVyKFxuICAgICAgKGkpID0+IGZpbHRlclN0YXR1cyA9PT0gXCJBTExcIiB8fCBpLnN0YXR1cyA9PT0gZmlsdGVyU3RhdHVzLFxuICAgICk7XG4gIH0sIFtpbnNwZWN0aW9ucywgZmlsdGVyU3RhdHVzXSk7XG5cbiAgY29uc3QgYXBwcm92YWxNZXRyaWNzID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgcGVuZGluZyA9IGluc3BlY3Rpb25zLmZpbHRlcigoaSkgPT4gaXNQZW5kaW5nU3RhdHVzKGkuc3RhdHVzKSk7XG4gICAgY29uc3QgYXBwcm92ZWQgPSBpbnNwZWN0aW9ucy5maWx0ZXIoXG4gICAgICAoaSkgPT4gaS5zdGF0dXMgPT09IFwiQVBQUk9WRURcIiB8fCBpLnN0YXR1cyA9PT0gXCJQUk9WSVNJT05BTExZX0FQUFJPVkVEXCIsXG4gICAgKTtcbiAgICBjb25zdCByZWplY3RlZCA9IGluc3BlY3Rpb25zLmZpbHRlcigoaSkgPT4gaS5zdGF0dXMgPT09IFwiUkVKRUNURURcIik7XG4gICAgY29uc3QgZmxvb3JNYXAgPSBuZXcgTWFwPHN0cmluZywgUXVhbGl0eUluc3BlY3Rpb25bXT4oKTtcbiAgICBpbnNwZWN0aW9ucy5mb3JFYWNoKChpKSA9PiB7XG4gICAgICBjb25zdCBmbG9vciA9IGdldEZsb29yTGFiZWwoaSk7XG4gICAgICBjb25zdCBhcnIgPSBmbG9vck1hcC5nZXQoZmxvb3IpIHx8IFtdO1xuICAgICAgYXJyLnB1c2goaSk7XG4gICAgICBmbG9vck1hcC5zZXQoZmxvb3IsIGFycik7XG4gICAgfSk7XG4gICAgY29uc3QgZmxvb3JzUGVuZGluZyA9IEFycmF5LmZyb20oZmxvb3JNYXAudmFsdWVzKCkpLmZpbHRlcigocm93cykgPT5cbiAgICAgIHJvd3Muc29tZSgoeCkgPT4gaXNQZW5kaW5nU3RhdHVzKHguc3RhdHVzKSksXG4gICAgKS5sZW5ndGg7XG4gICAgY29uc3QgZmxvb3JzQ29tcGxldGVkID0gQXJyYXkuZnJvbShmbG9vck1hcC52YWx1ZXMoKSkuZmlsdGVyKFxuICAgICAgKHJvd3MpID0+XG4gICAgICAgIHJvd3MubGVuZ3RoID4gMCAmJlxuICAgICAgICByb3dzLmV2ZXJ5KFxuICAgICAgICAgICh4KSA9PlxuICAgICAgICAgICAgeC5zdGF0dXMgPT09IFwiQVBQUk9WRURcIiB8fCB4LnN0YXR1cyA9PT0gXCJQUk9WSVNJT05BTExZX0FQUFJPVkVEXCIsXG4gICAgICAgICksXG4gICAgKS5sZW5ndGg7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBlbmRpbmcsXG4gICAgICBhcHByb3ZlZCxcbiAgICAgIHJlamVjdGVkLFxuICAgICAgZmxvb3JNYXAsXG4gICAgICBmbG9vcnNQZW5kaW5nLFxuICAgICAgZmxvb3JzQ29tcGxldGVkLFxuICAgIH07XG4gIH0sIFtpbnNwZWN0aW9uc10pO1xuXG4gIGNvbnN0IGRhc2hib2FyZFF1ZXVlID0gdXNlTWVtbygoKSA9PiB7XG4gICAgbGV0IHF1ZXVlID0gYXBwcm92YWxNZXRyaWNzLnBlbmRpbmc7XG4gICAgaWYgKHNlbGVjdGVkVmlldyA9PT0gXCJPdmVyZHVlIEZvY3VzXCIpXG4gICAgICBxdWV1ZSA9IHF1ZXVlLmZpbHRlcigoaSkgPT4gZ2V0U2xhQnVja2V0KGkpID09PSBcIk92ZXJkdWVcIik7XG4gICAgaWYgKHNlbGVjdGVkVmlldyA9PT0gXCJIaWdoIFJpc2tcIilcbiAgICAgIHF1ZXVlID0gcXVldWUuZmlsdGVyKChpKSA9PiBnZXRQcmlvcml0eVNjb3JlKGkpID49IDE0MCk7XG4gICAgaWYgKHNlbGVjdGVkVmlldyA9PT0gXCJSZWFkeSBGb3IgQ2xvc2VvdXRcIilcbiAgICAgIHF1ZXVlID0gcXVldWUuZmlsdGVyKFxuICAgICAgICAoaSkgPT5cbiAgICAgICAgICAoaS5zdGFnZXM/Lmxlbmd0aCB8fCAwKSA+IDAgJiZcbiAgICAgICAgICAoaS5zdGFnZXMgfHwgW10pLmV2ZXJ5KChzOiBhbnkpID0+XG4gICAgICAgICAgICBzLml0ZW1zPy5ldmVyeShcbiAgICAgICAgICAgICAgKGl0OiBhbnkpID0+IGl0LnZhbHVlID09PSBcIllFU1wiIHx8IGl0LnZhbHVlID09PSBcIk5BXCIgfHwgaXQuaXNPayxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKSAmJlxuICAgICAgICAgIChpLnBlbmRpbmdPYnNlcnZhdGlvbkNvdW50IHx8IDApID09PSAwLFxuICAgICAgKTtcbiAgICBpZiAoc2VsZWN0ZWRGbG9vciAhPT0gXCJBbGwgRmxvb3JzXCIpXG4gICAgICBxdWV1ZSA9IHF1ZXVlLmZpbHRlcigoaSkgPT4gZ2V0Rmxvb3JMYWJlbChpKSA9PT0gc2VsZWN0ZWRGbG9vcik7XG4gICAgaWYgKHNlbGVjdGVkU2xhQnVja2V0ICE9PSBcIkFsbFwiKVxuICAgICAgcXVldWUgPSBxdWV1ZS5maWx0ZXIoKGkpID0+IGdldFNsYUJ1Y2tldChpKSA9PT0gc2VsZWN0ZWRTbGFCdWNrZXQpO1xuICAgIGlmIChzaG93T3ZlcmR1ZU9ubHkpXG4gICAgICBxdWV1ZSA9IHF1ZXVlLmZpbHRlcigoaSkgPT4gZ2V0U2xhQnVja2V0KGkpID09PSBcIk92ZXJkdWVcIik7XG4gICAgcmV0dXJuIFsuLi5xdWV1ZV0uc29ydCgoYSwgYikgPT4gZ2V0UHJpb3JpdHlTY29yZShiKSAtIGdldFByaW9yaXR5U2NvcmUoYSkpO1xuICB9LCBbXG4gICAgYXBwcm92YWxNZXRyaWNzLnBlbmRpbmcsXG4gICAgc2VsZWN0ZWRWaWV3LFxuICAgIHNlbGVjdGVkRmxvb3IsXG4gICAgc2VsZWN0ZWRTbGFCdWNrZXQsXG4gICAgc2hvd092ZXJkdWVPbmx5LFxuICBdKTtcblxuICBjb25zdCBkYXNoYm9hcmRTdGF0cyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IG92ZXJkdWVDb3VudCA9IGFwcHJvdmFsTWV0cmljcy5wZW5kaW5nLmZpbHRlcihcbiAgICAgIChpKSA9PiBnZXRTbGFCdWNrZXQoaSkgPT09IFwiT3ZlcmR1ZVwiLFxuICAgICkubGVuZ3RoO1xuICAgIGNvbnN0IGR1ZTI0ID0gYXBwcm92YWxNZXRyaWNzLnBlbmRpbmcuZmlsdGVyKFxuICAgICAgKGkpID0+IGdldFNsYUJ1Y2tldChpKSA9PT0gXCJEdWUgPDI0aFwiLFxuICAgICkubGVuZ3RoO1xuICAgIGNvbnN0IGR1ZTQ4ID0gYXBwcm92YWxNZXRyaWNzLnBlbmRpbmcuZmlsdGVyKFxuICAgICAgKGkpID0+IGdldFNsYUJ1Y2tldChpKSA9PT0gXCJEdWUgMjQtNDhoXCIsXG4gICAgKS5sZW5ndGg7XG4gICAgY29uc3QgdXBjb21pbmcgPSBhcHByb3ZhbE1ldHJpY3MucGVuZGluZy5maWx0ZXIoXG4gICAgICAoaSkgPT4gZ2V0U2xhQnVja2V0KGkpID09PSBcIlVwY29taW5nXCIsXG4gICAgKS5sZW5ndGg7XG4gICAgY29uc3QgbWlzc2luZ0xvY2F0aW9uID0gaW5zcGVjdGlvbnMuZmlsdGVyKFxuICAgICAgKGkpID0+IHBhcnNlTG9jYXRpb25IaWVyYXJjaHkoaSkubGVuZ3RoID09PSAwLFxuICAgICkubGVuZ3RoO1xuICAgIGNvbnN0IG1pc3NpbmdXb3JrZmxvdyA9IGluc3BlY3Rpb25zLmZpbHRlcihcbiAgICAgIChpKSA9PiAhaS53b3JrZmxvd1RvdGFsTGV2ZWxzICYmIGlzUGVuZGluZ1N0YXR1cyhpLnN0YXR1cyksXG4gICAgKS5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgb3ZlcmR1ZUNvdW50LFxuICAgICAgZHVlMjQsXG4gICAgICBkdWU0OCxcbiAgICAgIHVwY29taW5nLFxuICAgICAgbWlzc2luZ0xvY2F0aW9uLFxuICAgICAgbWlzc2luZ1dvcmtmbG93LFxuICAgIH07XG4gIH0sIFthcHByb3ZhbE1ldHJpY3MucGVuZGluZywgaW5zcGVjdGlvbnNdKTtcblxuICBjb25zdCBmaWx0ZXJlZE9ic2VydmF0aW9ucyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGlmIChvYnNUYWIgPT09IFwiUEVORElOR1wiKVxuICAgICAgcmV0dXJuIG9ic2VydmF0aW9ucy5maWx0ZXIoXG4gICAgICAgIChvKSA9PiBvLnN0YXR1cyA9PT0gXCJQRU5ESU5HXCIgfHwgby5zdGF0dXMgPT09IFwiT1BFTlwiLFxuICAgICAgKTtcbiAgICBpZiAob2JzVGFiID09PSBcIlJFQ1RJRklFRFwiKVxuICAgICAgcmV0dXJuIG9ic2VydmF0aW9ucy5maWx0ZXIoKG8pID0+IG8uc3RhdHVzID09PSBcIlJFQ1RJRklFRFwiKTtcbiAgICBpZiAob2JzVGFiID09PSBcIkNMT1NFRFwiKVxuICAgICAgcmV0dXJuIG9ic2VydmF0aW9ucy5maWx0ZXIoXG4gICAgICAgIChvKSA9PiBvLnN0YXR1cyA9PT0gXCJDTE9TRURcIiB8fCBvLnN0YXR1cyA9PT0gXCJSRVNPTFZFRFwiLFxuICAgICAgKTtcbiAgICByZXR1cm4gb2JzZXJ2YXRpb25zO1xuICB9LCBbb2JzZXJ2YXRpb25zLCBvYnNUYWJdKTtcblxuICBjb25zdCBnZXREYXlzT3BlbiA9IChjcmVhdGVkQXQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGRheXMgPSBNYXRoLmZsb29yKFxuICAgICAgKERhdGUubm93KCkgLSBuZXcgRGF0ZShjcmVhdGVkQXQpLmdldFRpbWUoKSkgLyA4NjQwMDAwMCxcbiAgICApO1xuICAgIGlmIChkYXlzID09PSAwKSByZXR1cm4geyB0ZXh0OiBcIlRvZGF5XCIsIGNvbG9yOiBcInRleHQtc3VjY2Vzc1wiIH07XG4gICAgaWYgKGRheXMgPT09IDEpIHJldHVybiB7IHRleHQ6IFwiMSBkYXkgYWdvXCIsIGNvbG9yOiBcInRleHQtc3VjY2Vzc1wiIH07XG4gICAgaWYgKGRheXMgPD0gMykgcmV0dXJuIHsgdGV4dDogYCR7ZGF5c30gZGF5cyBhZ29gLCBjb2xvcjogXCJ0ZXh0LXN1Y2Nlc3NcIiB9O1xuICAgIGlmIChkYXlzIDw9IDcpIHJldHVybiB7IHRleHQ6IGAke2RheXN9IGRheXMgYWdvYCwgY29sb3I6IFwidGV4dC13YXJuaW5nXCIgfTtcbiAgICByZXR1cm4geyB0ZXh0OiBgJHtkYXlzfSBkYXlzIGFnb2AsIGNvbG9yOiBcInRleHQtZXJyb3IgZm9udC1ib2xkXCIgfTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVJdGVtVmFsdWVDaGFuZ2UgPSAoaXRlbUlkOiBudW1iZXIsIHZhbDogc3RyaW5nKSA9PiB7XG4gICAgc2V0SW5zcGVjdGlvbkRldGFpbCgocHJldjogYW55KSA9PiB7XG4gICAgICBpZiAoIXByZXYpIHJldHVybiBwcmV2O1xuICAgICAgY29uc3QgbmV3U3RhZ2VzID0gcHJldi5zdGFnZXMubWFwKChzdGFnZTogYW55KSA9PiAoe1xuICAgICAgICAuLi5zdGFnZSxcbiAgICAgICAgaXRlbXM6IHN0YWdlLml0ZW1zLm1hcCgoaXRlbTogYW55KSA9PlxuICAgICAgICAgIGl0ZW0uaWQgPT09IGl0ZW1JZFxuICAgICAgICAgICAgPyB7IC4uLml0ZW0sIHZhbHVlOiB2YWwsIGlzT2s6IHZhbCA9PT0gXCJZRVNcIiB8fCB2YWwgPT09IFwiTkFcIiB9XG4gICAgICAgICAgICA6IGl0ZW0sXG4gICAgICAgICksXG4gICAgICB9KSk7XG4gICAgICByZXR1cm4geyAuLi5wcmV2LCBzdGFnZXM6IG5ld1N0YWdlcyB9O1xuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUl0ZW1SZW1hcmtzQ2hhbmdlID0gKGl0ZW1JZDogbnVtYmVyLCB2YWw6IHN0cmluZykgPT4ge1xuICAgIHNldEluc3BlY3Rpb25EZXRhaWwoKHByZXY6IGFueSkgPT4ge1xuICAgICAgaWYgKCFwcmV2KSByZXR1cm4gcHJldjtcbiAgICAgIGNvbnN0IG5ld1N0YWdlcyA9IHByZXYuc3RhZ2VzLm1hcCgoc3RhZ2U6IGFueSkgPT4gKHtcbiAgICAgICAgLi4uc3RhZ2UsXG4gICAgICAgIGl0ZW1zOiBzdGFnZS5pdGVtcy5tYXAoKGl0ZW06IGFueSkgPT5cbiAgICAgICAgICBpdGVtLmlkID09PSBpdGVtSWQgPyB7IC4uLml0ZW0sIHJlbWFya3M6IHZhbCB9IDogaXRlbSxcbiAgICAgICAgKSxcbiAgICAgIH0pKTtcbiAgICAgIHJldHVybiB7IC4uLnByZXYsIHN0YWdlczogbmV3U3RhZ2VzIH07XG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgaXRlbUlzQ2hlY2tlZCA9IChpdGVtOiBhbnkpID0+XG4gICAgaXRlbT8udmFsdWUgPT09IFwiWUVTXCIgfHwgaXRlbT8udmFsdWUgPT09IFwiTkFcIiB8fCBpdGVtPy5pc09rO1xuXG4gIGNvbnN0IHN0YWdlSGFzQ2hlY2tlZEl0ZW1zID0gKHN0YWdlOiBhbnkpID0+XG4gICAgKHN0YWdlLml0ZW1zIHx8IFtdKS5zb21lKChpdDogYW55KSA9PiBpdGVtSXNDaGVja2VkKGl0KSk7XG5cbiAgY29uc3Qgc2F2ZUNoZWNrbGlzdFByb2dyZXNzID0gYXN5bmMgKHN0YWdlSWQ/OiBudW1iZXIsIHNpbGVudCA9IGZhbHNlKSA9PiB7XG4gICAgaWYgKCFpbnNwZWN0aW9uRGV0YWlsKSByZXR1cm4gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0YWdlc1RvU2F2ZSA9IGluc3BlY3Rpb25EZXRhaWwuc3RhZ2VzLmZpbHRlcigoc3RhZ2U6IGFueSkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHN0YWdlSWQgPT09IFwibnVtYmVyXCIgJiYgc3RhZ2UuaWQgIT09IHN0YWdlSWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHN0YWdlSGFzQ2hlY2tlZEl0ZW1zKHN0YWdlKTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoc3RhZ2VzVG9TYXZlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAoIXNpbGVudCkge1xuICAgICAgICAgIGFsZXJ0KFwiTm8gY2hlY2tsaXN0IHByb2dyZXNzIGVudGVyZWQgeWV0LlwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2Ygc3RhZ2VzVG9TYXZlKSB7XG4gICAgICAgIGNvbnN0IGNoZWNrZWRDb3VudCA9IHN0YWdlLml0ZW1zLmZpbHRlcihcbiAgICAgICAgICAoaXQ6IGFueSkgPT4gaXRlbUlzQ2hlY2tlZChpdCksXG4gICAgICAgICkubGVuZ3RoO1xuICAgICAgICBjb25zdCB0b3RhbENvdW50ID0gc3RhZ2UuaXRlbXMubGVuZ3RoO1xuXG4gICAgICAgIGxldCBzdGFnZVN0YXR1cyA9IHN0YWdlLnN0YXR1cztcbiAgICAgICAgaWYgKGNoZWNrZWRDb3VudCA+IDAgJiYgY2hlY2tlZENvdW50IDwgdG90YWxDb3VudCkge1xuICAgICAgICAgIHN0YWdlU3RhdHVzID0gXCJJTl9QUk9HUkVTU1wiO1xuICAgICAgICB9IGVsc2UgaWYgKGNoZWNrZWRDb3VudCA9PT0gdG90YWxDb3VudCAmJiB0b3RhbENvdW50ID4gMCkge1xuICAgICAgICAgIHN0YWdlU3RhdHVzID0gXCJDT01QTEVURURcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHVwZGF0ZVN0YWdlKHN0YWdlLmlkLCB7XG4gICAgICAgICAgc3RhdHVzOiBzdGFnZVN0YXR1cywgLy8gS2VlcCBleGlzdGluZyBzdGF0dXMgb3IgdXBkYXRlIHRvIElOX1BST0dSRVNTXG4gICAgICAgICAgaXRlbXM6IHN0YWdlLml0ZW1zLm1hcCgoaXQ6IGFueSkgPT4gKHtcbiAgICAgICAgICAgIGlkOiBpdC5pZCxcbiAgICAgICAgICAgIHZhbHVlOiBpdC52YWx1ZSxcbiAgICAgICAgICAgIGlzT2s6IGl0ZW1Jc0NoZWNrZWQoaXQpLFxuICAgICAgICAgICAgcmVtYXJrczogaXQucmVtYXJrcyxcbiAgICAgICAgICB9KSksXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKCFzaWxlbnQpIHtcbiAgICAgICAgYWxlcnQoXG4gICAgICAgICAgc3RhZ2VzVG9TYXZlLmxlbmd0aCA9PT0gMVxuICAgICAgICAgICAgPyBcIlN0YWdlIGNoZWNrbGlzdCBzYXZlZCBzdWNjZXNzZnVsbHkuXCJcbiAgICAgICAgICAgIDogXCJSRkkgY2hlY2tsaXN0IHNhdmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHNldFJlZnJlc2hLZXkoKGspID0+IGsgKyAxKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICBpZiAoIXNpbGVudCkge1xuICAgICAgICBhbGVydChlcnIucmVzcG9uc2U/LmRhdGE/Lm1lc3NhZ2UgfHwgXCJGYWlsZWQgdG8gc2F2ZSBjaGVja2xpc3QuXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCB1cGRhdGVTdGFnZSA9IGFzeW5jIChzdGFnZUlkOiBudW1iZXIsIHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IHtcbiAgICBjb25zdCBzdGFnZUluc3BlY3Rpb25JZCA9XG4gICAgICBpbnNwZWN0aW9uRGV0YWlsPy5pZCB8fFxuICAgICAgaW5zcGVjdGlvbnMuZmluZCgoZW50cnkpID0+XG4gICAgICAgIChlbnRyeS5zdGFnZXMgfHwgW10pLnNvbWUoKHN0YWdlOiBhbnkpID0+IHN0YWdlLmlkID09PSBzdGFnZUlkKSxcbiAgICAgICk/LmlkO1xuXG4gICAgY29uc3QgYXR0ZW1wdHM6IEFycmF5PHsgbWV0aG9kOiBcInBhdGNoXCIgfCBcInBvc3RcIjsgdXJsOiBzdHJpbmcgfT4gPSBbXG4gICAgICB7IG1ldGhvZDogXCJwYXRjaFwiLCB1cmw6IGAvcXVhbGl0eS9pbnNwZWN0aW9ucy9zdGFnZS8ke3N0YWdlSWR9YCB9LFxuICAgICAgeyBtZXRob2Q6IFwicG9zdFwiLCB1cmw6IGAvcXVhbGl0eS9pbnNwZWN0aW9ucy9zdGFnZS8ke3N0YWdlSWR9YCB9LFxuICAgIF07XG5cbiAgICBpZiAoc3RhZ2VJbnNwZWN0aW9uSWQpIHtcbiAgICAgIGF0dGVtcHRzLnB1c2goXG4gICAgICAgIHtcbiAgICAgICAgICBtZXRob2Q6IFwicGF0Y2hcIixcbiAgICAgICAgICB1cmw6IGAvcXVhbGl0eS9pbnNwZWN0aW9ucy8ke3N0YWdlSW5zcGVjdGlvbklkfS9zdGFnZXMvJHtzdGFnZUlkfWAsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBtZXRob2Q6IFwicG9zdFwiLFxuICAgICAgICAgIHVybDogYC9xdWFsaXR5L2luc3BlY3Rpb25zLyR7c3RhZ2VJbnNwZWN0aW9uSWR9L3N0YWdlcy8ke3N0YWdlSWR9YCxcbiAgICAgICAgfSxcbiAgICAgICk7XG5cbiAgICAgIGlmIChwYXlsb2FkLnN0YXR1cyA9PT0gXCJBUFBST1ZFRFwiICYmIHBheWxvYWQuc2lnbmF0dXJlPy5kYXRhKSB7XG4gICAgICAgIGF0dGVtcHRzLnB1c2goe1xuICAgICAgICAgIG1ldGhvZDogXCJwb3N0XCIsXG4gICAgICAgICAgdXJsOiBgL3F1YWxpdHkvaW5zcGVjdGlvbnMvJHtzdGFnZUluc3BlY3Rpb25JZH0vc3RhZ2VzLyR7c3RhZ2VJZH0vYXBwcm92ZWAsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBsYXN0RXJyb3I6IGFueSA9IG51bGw7XG4gICAgZm9yIChjb25zdCBhdHRlbXB0IG9mIGF0dGVtcHRzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoYXR0ZW1wdC5tZXRob2QgPT09IFwicGF0Y2hcIikge1xuICAgICAgICAgIHJldHVybiBhd2FpdCBhcGkucGF0Y2goYXR0ZW1wdC51cmwsIHBheWxvYWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhd2FpdCBhcGkucG9zdChhdHRlbXB0LnVybCwgcGF5bG9hZCk7XG4gICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICBsYXN0RXJyb3IgPSBlcnI7XG4gICAgICAgIGlmIChlcnI/LnJlc3BvbnNlPy5zdGF0dXMgIT09IDQwNCkge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IGxhc3RFcnJvcjtcbiAgfTtcblxuICBjb25zdCBhcHByb3ZlU3RhZ2VXaXRoU2lnbmF0dXJlID0gYXN5bmMgKFxuICAgIGluc3BlY3Rpb25JZDogbnVtYmVyLFxuICAgIHN0YWdlSWQ6IG51bWJlcixcbiAgICBzaWduYXR1cmVEYXRhOiBzdHJpbmcsXG4gICkgPT4ge1xuICAgIHJldHVybiBhcGkucG9zdChgL3F1YWxpdHkvaW5zcGVjdGlvbnMvJHtpbnNwZWN0aW9uSWR9L3N0YWdlcy8ke3N0YWdlSWR9L2FwcHJvdmVgLCB7XG4gICAgICBzaWduYXR1cmVEYXRhLFxuICAgICAgY29tbWVudHM6IFwiU3RhZ2UgYXBwcm92ZWQgZnJvbSBjaGVja2xpc3Qgc3RhZ2UgYWN0aW9uXCIsXG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgZmV0Y2hFbGlnaWJsZVVzZXJzID0gYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBhcGkuZ2V0KFwiL3F1YWxpdHkvaW5zcGVjdGlvbnMvZWxpZ2libGUtYXBwcm92ZXJzL2xpc3RcIiwge1xuICAgICAgICBwYXJhbXM6IHsgcHJvamVjdElkIH0sXG4gICAgICB9KTtcbiAgICAgIHNldEVsaWdpYmxlVXNlcnMocmVzLmRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBmZXRjaCB1c2Vyc1wiLCBlcnIpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVEZWxlZ2F0ZSA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIXNlbGVjdGVkRGVsZWdhdGVJZCB8fCAhc2VsZWN0ZWRJbnNwZWN0aW9uSWQgfHwgIXdvcmtmbG93U3RhdGUpIHJldHVybjtcbiAgICBzZXREZWxlZ2F0aW5nKHRydWUpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhcGkucG9zdChcbiAgICAgICAgYC9xdWFsaXR5L2luc3BlY3Rpb25zLyR7c2VsZWN0ZWRJbnNwZWN0aW9uSWR9L3dvcmtmbG93L2RlbGVnYXRlYCxcbiAgICAgICAge1xuICAgICAgICAgIHRhcmdldFVzZXJJZDogc2VsZWN0ZWREZWxlZ2F0ZUlkLFxuICAgICAgICAgIGNvbW1lbnRzOiBcIkRlbGVnYXRlZCB2aWEgVUlcIixcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgICBzZXRTaG93RGVsZWdhdGlvbk1vZGFsKGZhbHNlKTtcbiAgICAgIC8vIFJlZnJlc2hcbiAgICAgIGNvbnN0IFtpbnNwUmVzLCB3ZlJlc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIGFwaS5nZXQoYC9xdWFsaXR5L2luc3BlY3Rpb25zLyR7c2VsZWN0ZWRJbnNwZWN0aW9uSWR9YCksXG4gICAgICAgIGFwaS5nZXQoYC9xdWFsaXR5L2luc3BlY3Rpb25zLyR7c2VsZWN0ZWRJbnNwZWN0aW9uSWR9L3dvcmtmbG93YCksXG4gICAgICBdKTtcbiAgICAgIHNldEluc3BlY3Rpb25EZXRhaWwoaW5zcFJlcy5kYXRhKTtcbiAgICAgIHNldFdvcmtmbG93U3RhdGUod2ZSZXMuZGF0YSk7XG4gICAgICBhbGVydChcIlN0ZXAgc3VjY2Vzc2Z1bGx5IGRlbGVnYXRlZC5cIik7XG4gICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgIGFsZXJ0KGVyci5yZXNwb25zZT8uZGF0YT8ubWVzc2FnZSB8fCBcIkRlbGVnYXRpb24gZmFpbGVkLlwiKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0RGVsZWdhdGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuICBjb25zdCBoYW5kbGVJbml0aWF0ZUFwcHJvdmUgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKCFjYW5BcHByb3ZlSW5zcGVjdGlvbikge1xuICAgICAgYWxlcnQoXCJZb3UgZG8gbm90IGhhdmUgcGVybWlzc2lvbiB0byBhcHByb3ZlIHRoaXMgUkZJLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYXdhaXQgc2F2ZUNoZWNrbGlzdFByb2dyZXNzKHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgc2V0U2hvd0ZpbmFsQXBwcm92ZVNpZyh0cnVlKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVBcHByb3ZlU3RhZ2UgPSBhc3luYyAoc3RhZ2U6IGFueSkgPT4ge1xuICAgIGlmICghY2FuQXBwcm92ZUluc3BlY3Rpb24pIHtcbiAgICAgIGFsZXJ0KFwiWW91IGRvIG5vdCBoYXZlIHBlcm1pc3Npb24gdG8gYXBwcm92ZSB0aGlzIHN0YWdlLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKCFpc1N0YWdlQ2hlY2tsaXN0Q29tcGxldGUoc3RhZ2UpKSB7XG4gICAgICBhbGVydChcIkNvbXBsZXRlIGFsbCBjaGVja2xpc3QgaXRlbXMgaW4gdGhpcyBzdGFnZSBiZWZvcmUgYXBwcm92aW5nIGl0LlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2V0QWN0aXZlU3RhZ2VJZChzdGFnZS5pZCk7XG4gICAgc2V0U2hvd0ZpbmFsQXBwcm92ZVNpZyh0cnVlKTtcbiAgfTtcblxuICBjb25zdCBleGVjdXRlRmluYWxBcHByb3ZlID0gYXN5bmMgKHNpZ25hdHVyZURhdGE6IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpZiAoYWN0aXZlU3RhZ2VJZCAhPSBudWxsICYmIGluc3BlY3Rpb25EZXRhaWwpIHtcbiAgICAgICAgYXdhaXQgYXBwcm92ZVN0YWdlV2l0aFNpZ25hdHVyZShcbiAgICAgICAgICBpbnNwZWN0aW9uRGV0YWlsLmlkLFxuICAgICAgICAgIGFjdGl2ZVN0YWdlSWQsXG4gICAgICAgICAgc2lnbmF0dXJlRGF0YSxcbiAgICAgICAgKTtcbiAgICAgICAgYWxlcnQoXCJTdGFnZSBhcHByb3ZlZCBzdWNjZXNzZnVsbHkuXCIpO1xuICAgICAgICBzZXRTaG93RmluYWxBcHByb3ZlU2lnKGZhbHNlKTtcbiAgICAgICAgc2V0QWN0aXZlU3RhZ2VJZChudWxsKTtcbiAgICAgICAgc2V0UmVmcmVzaEtleSgoaykgPT4gayArIDEpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlYWR5U3RhZ2VzID0gKGluc3BlY3Rpb25EZXRhaWw/LnN0YWdlcyB8fCBbXSkuZmlsdGVyKFxuICAgICAgICAoc3RhZ2U6IGFueSkgPT5cbiAgICAgICAgICAhaXNTdGFnZUFwcHJvdmVkKHN0YWdlKSAmJlxuICAgICAgICAgIHN0YWdlLml0ZW1zPy5sZW5ndGggPiAwICYmXG4gICAgICAgICAgc3RhZ2UuaXRlbXMuZXZlcnkoKGl0ZW06IGFueSkgPT4gaXRlbUlzQ2hlY2tlZChpdGVtKSksXG4gICAgICApO1xuXG4gICAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIHJlYWR5U3RhZ2VzKSB7XG4gICAgICAgIGF3YWl0IGFwcHJvdmVTdGFnZVdpdGhTaWduYXR1cmUoXG4gICAgICAgICAgaW5zcGVjdGlvbkRldGFpbC5pZCxcbiAgICAgICAgICBzdGFnZS5pZCxcbiAgICAgICAgICBzaWduYXR1cmVEYXRhLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBsZXQgbGF0ZXN0SW5zcGVjdGlvbkRldGFpbCA9IGluc3BlY3Rpb25EZXRhaWw7XG4gICAgICBpZiAocmVhZHlTdGFnZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCByZWZyZXNoZWREZXRhaWwgPSBhd2FpdCBhcGkuZ2V0KFxuICAgICAgICAgIGAvcXVhbGl0eS9pbnNwZWN0aW9ucy8ke2luc3BlY3Rpb25EZXRhaWwuaWR9YCxcbiAgICAgICAgKTtcbiAgICAgICAgbGF0ZXN0SW5zcGVjdGlvbkRldGFpbCA9IHJlZnJlc2hlZERldGFpbC5kYXRhO1xuICAgICAgICBzZXRJbnNwZWN0aW9uRGV0YWlsKHJlZnJlc2hlZERldGFpbC5kYXRhKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGVuZGluZ1N0YWdlcyA9IChsYXRlc3RJbnNwZWN0aW9uRGV0YWlsPy5zdGFnZXMgfHwgW10pLmZpbHRlcihcbiAgICAgICAgKHN0YWdlOiBhbnkpID0+XG4gICAgICAgICAgIWlzU3RhZ2VBcHByb3ZlZChzdGFnZSkgJiZcbiAgICAgICAgICAhKHN0YWdlLml0ZW1zPy5sZW5ndGggPiAwICYmXG4gICAgICAgICAgICBzdGFnZS5pdGVtcy5ldmVyeSgoaXRlbTogYW55KSA9PiBpdGVtSXNDaGVja2VkKGl0ZW0pKSksXG4gICAgICApO1xuICAgICAgaWYgKHBlbmRpbmdTdGFnZXMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYENhbm5vdCBnaXZlIGZpbmFsIGFwcHJvdmFsLiBUaGUgZm9sbG93aW5nIHN0YWdlcyBhcmUgbm90IHlldCBhcHByb3ZlZDogJHtwZW5kaW5nU3RhZ2VzXG4gICAgICAgICAgICAubWFwKChzdGFnZTogYW55KSA9PiBzdGFnZS5zdGFnZVRlbXBsYXRlPy5uYW1lIHx8IGBTdGFnZSAjJHtzdGFnZS5pZH1gKVxuICAgICAgICAgICAgLmpvaW4oXCIsIFwiKX1gLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAod29ya2Zsb3dTdGF0ZSkge1xuICAgICAgICBjb25zdCBjdXJyZW50U3RlcCA9IHdvcmtmbG93U3RhdGUuc3RlcHMuZmluZChcbiAgICAgICAgICAoczogYW55KSA9PiBzLnN0ZXBPcmRlciA9PT0gd29ya2Zsb3dTdGF0ZS5jdXJyZW50U3RlcE9yZGVyLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCB3ZlJlcyA9IGF3YWl0IGFwaS5wb3N0KFxuICAgICAgICAgIGAvcXVhbGl0eS9pbnNwZWN0aW9ucy8ke2luc3BlY3Rpb25EZXRhaWwuaWR9L3dvcmtmbG93L2FkdmFuY2VgLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNpZ25hdHVyZURhdGEsXG4gICAgICAgICAgICBzaWduZWRCeTpcbiAgICAgICAgICAgICAgdXNlcj8uZGlzcGxheU5hbWUgfHxcbiAgICAgICAgICAgICAgdXNlcj8udXNlcm5hbWUgfHxcbiAgICAgICAgICAgICAgY3VycmVudFN0ZXA/LndvcmtmbG93Tm9kZT8ubGFiZWwgfHxcbiAgICAgICAgICAgICAgXCJBcHByb3ZlclwiLFxuICAgICAgICAgICAgY29tbWVudHM6IFwiQXBwcm92ZWQgZGlnaXRhbGx5XCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAod2ZSZXMuZGF0YT8uaXNGaW5hbCkge1xuICAgICAgICAgIGFsZXJ0KFxuICAgICAgICAgICAgXCJBbGwgd29ya2Zsb3cgc3RlcHMgY29tcGxldGVkLiBSRkkgaXMgbm93IGZ1bGx5IGFwcHJvdmVkIVwiLFxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWxlcnQoXCJXb3JrZmxvdyBzdGVwIGFwcHJvdmVkLlwiKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTGVnYWN5IC8gRGlyZWN0IGZpbmFsIGFwcHJvdmVcbiAgICAgICAgYXdhaXQgYXBpLnBvc3QoXG4gICAgICAgICAgYC9xdWFsaXR5L2luc3BlY3Rpb25zLyR7aW5zcGVjdGlvbkRldGFpbC5pZH0vZmluYWwtYXBwcm92ZWAsXG4gICAgICAgICAge1xuICAgICAgICAgICAgc2lnbmF0dXJlRGF0YSxcbiAgICAgICAgICAgIGNvbW1lbnRzOiBcIkZpbmFsIEFwcHJvdmFsIGdpdmVuIGRpZ2l0YWxseVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG4gICAgICAgIGFsZXJ0KFwiUkZJIGZpbmFsIGFwcHJvdmFsIGNvbXBsZXRlZC5cIik7XG4gICAgICB9XG5cbiAgICAgIHNldFNob3dGaW5hbEFwcHJvdmVTaWcoZmFsc2UpO1xuICAgICAgc2V0QWN0aXZlU3RhZ2VJZChudWxsKTtcbiAgICAgIHNldFNlbGVjdGVkSW5zcGVjdGlvbklkKG51bGwpO1xuICAgICAgc2V0UmVmcmVzaEtleSgoaykgPT4gayArIDEpO1xuICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICBhbGVydChlcnIucmVzcG9uc2U/LmRhdGE/Lm1lc3NhZ2UgfHwgZXJyLm1lc3NhZ2UgfHwgXCJGYWlsZWQgdG8gYXBwcm92ZSBSRkkuXCIpO1xuICAgICAgc2V0QWN0aXZlU3RhZ2VJZChudWxsKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlUmVqZWN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJlYXNvbiA9IHByb21wdChcIlBsZWFzZSBlbnRlciByZWplY3Rpb24gcmVhc29uOlwiKTtcbiAgICBpZiAocmVhc29uID09PSBudWxsKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgLy8gU2F2ZSBjaGVja2xpc3QgcHJvZ3Jlc3MgZmlyc3RcbiAgICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2YgaW5zcGVjdGlvbkRldGFpbC5zdGFnZXMpIHtcbiAgICAgICAgYXdhaXQgdXBkYXRlU3RhZ2Uoc3RhZ2UuaWQsIHtcbiAgICAgICAgICBzdGF0dXM6IFwiUkVKRUNURURcIixcbiAgICAgICAgICBpdGVtczogc3RhZ2UuaXRlbXMubWFwKChpdDogYW55KSA9PiAoe1xuICAgICAgICAgICAgaWQ6IGl0LmlkLFxuICAgICAgICAgICAgdmFsdWU6IGl0LnZhbHVlLFxuICAgICAgICAgICAgaXNPazogaXQuaXNPayxcbiAgICAgICAgICAgIHJlbWFya3M6IGl0LnJlbWFya3MsXG4gICAgICAgICAgfSkpLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHdvcmtmbG93U3RhdGUgJiYgd29ya2Zsb3dTdGF0ZS5zdGF0dXMgPT09IFwiSU5fUFJPR1JFU1NcIikge1xuICAgICAgICBhd2FpdCBhcGkucG9zdChcbiAgICAgICAgICBgL3F1YWxpdHkvaW5zcGVjdGlvbnMvJHtpbnNwZWN0aW9uRGV0YWlsLmlkfS93b3JrZmxvdy9yZWplY3RgLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNvbW1lbnRzOiByZWFzb24gfHwgXCJSZWplY3RlZCBkdXJpbmcgY2hlY2tsaXN0IGV4ZWN1dGlvblwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBhcGkucGF0Y2goYC9xdWFsaXR5L2luc3BlY3Rpb25zLyR7aW5zcGVjdGlvbkRldGFpbC5pZH0vc3RhdHVzYCwge1xuICAgICAgICAgIHN0YXR1czogXCJSRUpFQ1RFRFwiLFxuICAgICAgICAgIGNvbW1lbnRzOiByZWFzb24gfHwgXCJSZWplY3RlZCBkdXJpbmcgY2hlY2tsaXN0IGV4ZWN1dGlvblwiLFxuICAgICAgICAgIGluc3BlY3Rpb25EYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoXCJUXCIpWzBdLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGFsZXJ0KFwiUkZJIHJlamVjdGVkLlwiKTtcbiAgICAgIHNldFNlbGVjdGVkSW5zcGVjdGlvbklkKG51bGwpO1xuICAgICAgc2V0UmVmcmVzaEtleSgoaykgPT4gayArIDEpO1xuICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICBhbGVydChlcnIucmVzcG9uc2U/LmRhdGE/Lm1lc3NhZ2UgfHwgXCJGYWlsZWQgdG8gcmVqZWN0IFJGSS5cIik7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUZpbGVVcGxvYWQgPSBhc3luYyAoZTogUmVhY3QuQ2hhbmdlRXZlbnQ8SFRNTElucHV0RWxlbWVudD4pID0+IHtcbiAgICBjb25zdCBmaWxlID0gZS50YXJnZXQuZmlsZXM/LlswXTtcbiAgICBpZiAoIWZpbGUpIHJldHVybjtcblxuICAgIHNldFVwbG9hZGluZyh0cnVlKTtcbiAgICBjb25zdCBmb3JtRGF0YSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgIGZvcm1EYXRhLmFwcGVuZChcImZpbGVcIiwgZmlsZSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgYXBpLnBvc3QoXCIvZmlsZXMvdXBsb2FkXCIsIGZvcm1EYXRhLCB7XG4gICAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJtdWx0aXBhcnQvZm9ybS1kYXRhXCIgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0Q3VycmVudFBob3RvcygocHJldikgPT4gWy4uLnByZXYsIHJlcy5kYXRhLnVybF0pO1xuICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICBhbGVydChlcnIucmVzcG9uc2U/LmRhdGE/Lm1lc3NhZ2UgfHwgXCJVcGxvYWQgZmFpbGVkXCIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRVcGxvYWRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVQcm92aXNpb25hbGx5QXBwcm92ZSA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByZWFzb24gPSBwcm9tcHQoXG4gICAgICBcIlBsZWFzZSBlbnRlciBqdXN0aWZpY2F0aW9uIGZvciBQcm92aXNpb25hbCBBcHByb3ZhbDpcIixcbiAgICApO1xuICAgIGlmICghcmVhc29uKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgLy8gU2F2ZSBjaGVja2xpc3QgcHJvZ3Jlc3MgZmlyc3RcbiAgICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2YgaW5zcGVjdGlvbkRldGFpbC5zdGFnZXMpIHtcbiAgICAgICAgYXdhaXQgdXBkYXRlU3RhZ2Uoc3RhZ2UuaWQsIHtcbiAgICAgICAgICBzdGF0dXM6IFwiQ09NUExFVEVEXCIsXG4gICAgICAgICAgaXRlbXM6IHN0YWdlLml0ZW1zLm1hcCgoaXQ6IGFueSkgPT4gKHtcbiAgICAgICAgICAgIGlkOiBpdC5pZCxcbiAgICAgICAgICAgIHZhbHVlOiBpdC52YWx1ZSxcbiAgICAgICAgICAgIGlzT2s6IGl0LmlzT2ssXG4gICAgICAgICAgICByZW1hcmtzOiBpdC5yZW1hcmtzLFxuICAgICAgICAgIH0pKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IGFwaS5wYXRjaChgL3F1YWxpdHkvaW5zcGVjdGlvbnMvJHtpbnNwZWN0aW9uRGV0YWlsLmlkfS9zdGF0dXNgLCB7XG4gICAgICAgIHN0YXR1czogXCJQUk9WSVNJT05BTExZX0FQUFJPVkVEXCIsXG4gICAgICAgIGNvbW1lbnRzOiByZWFzb24sXG4gICAgICAgIGluc3BlY3Rpb25EYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoXCJUXCIpWzBdLFxuICAgICAgfSk7XG4gICAgICBhbGVydChcIlJGSSBwcm92aXNpb25hbGx5IGFwcHJvdmVkLlwiKTtcbiAgICAgIHNldFNlbGVjdGVkSW5zcGVjdGlvbklkKG51bGwpO1xuICAgICAgc2V0UmVmcmVzaEtleSgoaykgPT4gayArIDEpO1xuICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICBhbGVydChcbiAgICAgICAgZXJyLnJlc3BvbnNlPy5kYXRhPy5tZXNzYWdlIHx8IFwiRmFpbGVkIHRvIHByb3Zpc2lvbmFsbHkgYXBwcm92ZSBSRkkuXCIsXG4gICAgICApO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVSYWlzZU9ic2VydmF0aW9uID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmICghb2JzVGV4dC50cmltKCkpIHJldHVybjtcbiAgICBzZXRTYXZpbmdPYnModHJ1ZSk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGFwaS5wb3N0KFxuICAgICAgICBgL3F1YWxpdHkvYWN0aXZpdGllcy8ke2luc3BlY3Rpb25EZXRhaWwuYWN0aXZpdHlJZH0vb2JzZXJ2YXRpb25gLFxuICAgICAgICB7XG4gICAgICAgICAgb2JzZXJ2YXRpb25UZXh0OiBvYnNUZXh0LFxuICAgICAgICAgIHR5cGU6IG9ic1R5cGUsXG4gICAgICAgICAgcGhvdG9zOiBjdXJyZW50UGhvdG9zLFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICAgIGFsZXJ0KFwiT2JzZXJ2YXRpb24gUmFpc2VkLlwiKTtcbiAgICAgIHNldE9ic1RleHQoXCJcIik7XG4gICAgICBzZXRDdXJyZW50UGhvdG9zKFtdKTtcbiAgICAgIC8vIFJlZnJlc2ggdG8gc2hvdyBpbiB0aGUgbGlzdCBpbnNpZGUgdGhlIG1vZGFsXG4gICAgICBzZXRSZWZyZXNoS2V5KChrKSA9PiBrICsgMSk7XG4gICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgIGFsZXJ0KGVyci5yZXNwb25zZT8uZGF0YT8ubWVzc2FnZSB8fCBcIkZhaWxlZCB0byByYWlzZSBvYnNlcnZhdGlvbi5cIik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldFNhdmluZ09icyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUNsb3NlT2JzZXJ2YXRpb24gPSBhc3luYyAob2JzSWQ6IHN0cmluZykgPT4ge1xuICAgIGlmICghY29uZmlybShcIlZlcmlmeSBhbmQgY2xvc2UgdGhpcyBvYnNlcnZhdGlvbj9cIikpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXBpLnBhdGNoKFxuICAgICAgICBgL3F1YWxpdHkvYWN0aXZpdGllcy8ke2luc3BlY3Rpb25EZXRhaWwuYWN0aXZpdHlJZH0vb2JzZXJ2YXRpb24vJHtvYnNJZH0vY2xvc2VgLFxuICAgICAgKTtcbiAgICAgIHNldFJlZnJlc2hLZXkoKGspID0+IGsgKyAxKTtcbiAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgYWxlcnQoZXJyLnJlc3BvbnNlPy5kYXRhPy5tZXNzYWdlIHx8IFwiRmFpbGVkIHRvIGNsb3NlIG9ic2VydmF0aW9uLlwiKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlRGVsZXRlT2JzZXJ2YXRpb24gPSBhc3luYyAob2JzSWQ6IHN0cmluZykgPT4ge1xuICAgIGlmICghY29uZmlybShcIlBlcm1hbmVudGx5IGRlbGV0ZSB0aGlzIG9ic2VydmF0aW9uP1wiKSkgcmV0dXJuO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhcGkuZGVsZXRlKFxuICAgICAgICBgL3F1YWxpdHkvYWN0aXZpdGllcy8ke2luc3BlY3Rpb25EZXRhaWwuYWN0aXZpdHlJZH0vb2JzZXJ2YXRpb24vJHtvYnNJZH1gLFxuICAgICAgKTtcbiAgICAgIHNldFJlZnJlc2hLZXkoKGspID0+IGsgKyAxKTtcbiAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgYWxlcnQoZXJyLnJlc3BvbnNlPy5kYXRhPy5tZXNzYWdlIHx8IFwiRmFpbGVkIHRvIGRlbGV0ZSBvYnNlcnZhdGlvbi5cIik7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGFsbENoZWNrZWQgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoIWluc3BlY3Rpb25EZXRhaWw/LnN0YWdlcykgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChpbnNwZWN0aW9uRGV0YWlsLnN0YWdlcy5sZW5ndGggPT09IDApIHJldHVybiB0cnVlOyAvLyBFbXB0eSBjaGVja2xpc3QgY2FuIGJlIGFwcHJvdmVkXG4gICAgcmV0dXJuIGluc3BlY3Rpb25EZXRhaWwuc3RhZ2VzLmV2ZXJ5KChzOiBhbnkpID0+XG4gICAgICBzLml0ZW1zPy5ldmVyeShcbiAgICAgICAgKGk6IGFueSkgPT4gaS52YWx1ZSA9PT0gXCJZRVNcIiB8fCBpLnZhbHVlID09PSBcIk5BXCIgfHwgaS5pc09rLFxuICAgICAgKSxcbiAgICApO1xuICB9LCBbaW5zcGVjdGlvbkRldGFpbF0pO1xuXG4gIGNvbnN0IHBlbmRpbmdPYnNlcnZhdGlvbnNDb3VudCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIHJldHVybiBvYnNlcnZhdGlvbnMuZmlsdGVyKChvKSA9PiBvLnN0YXR1cyAhPT0gXCJDTE9TRURcIikubGVuZ3RoO1xuICB9LCBbb2JzZXJ2YXRpb25zXSk7XG5cbiAgY29uc3QgZm9ybWF0U2lnbmF0dXJlTWV0YSA9IChzaWduYXR1cmU6IGFueSkgPT4ge1xuICAgIGNvbnN0IGJpdHMgPSBbXG4gICAgICBzaWduYXR1cmU/LnNpZ25lckRpc3BsYXlOYW1lIHx8IHNpZ25hdHVyZT8uc2lnbmVkQnksXG4gICAgICBzaWduYXR1cmU/LnNpZ25lckNvbXBhbnksXG4gICAgICBzaWduYXR1cmU/LnNpZ25lclJvbGVMYWJlbCB8fCBzaWduYXR1cmU/LnNpZ25lclJvbGUsXG4gICAgXS5maWx0ZXIoQm9vbGVhbik7XG4gICAgcmV0dXJuIGJpdHMuam9pbihcIiAtIFwiKTtcbiAgfTtcblxuICBjb25zdCBmb3JtYXRTaWduYXR1cmVBY3Rpb24gPSAoc2lnbmF0dXJlOiBhbnkpID0+IHtcbiAgICBpZiAoIXNpZ25hdHVyZT8uYWN0aW9uVHlwZSkgcmV0dXJuIFwiU2lnbmVkXCI7XG4gICAgaWYgKHNpZ25hdHVyZS5hY3Rpb25UeXBlID09PSBcIlNBVkVfUFJPR1JFU1NcIikgcmV0dXJuIFwiUHJvZ3Jlc3MgU2lnbmVkXCI7XG4gICAgaWYgKHNpZ25hdHVyZS5hY3Rpb25UeXBlID09PSBcIlNUQUdFX0FQUFJPVkVcIikgcmV0dXJuIFwiU3RhZ2UgQXBwcm92ZWRcIjtcbiAgICBpZiAoc2lnbmF0dXJlLmFjdGlvblR5cGUgPT09IFwiRklOQUxfQVBQUk9WRVwiKSByZXR1cm4gXCJGaW5hbCBBcHByb3ZlZFwiO1xuICAgIHJldHVybiBzaWduYXR1cmUuYWN0aW9uVHlwZS5yZXBsYWNlQWxsKFwiX1wiLCBcIiBcIik7XG4gIH07XG5cbiAgY29uc3QgYXBwcm92YWxIaXN0b3J5ID0gdXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCFpbnNwZWN0aW9uRGV0YWlsKSByZXR1cm4gW107XG5cbiAgICBjb25zdCB3b3JrZmxvd0VudHJpZXMgPSAoXG4gICAgICBpbnNwZWN0aW9uRGV0YWlsLndvcmtmbG93U3VtbWFyeT8uY29tcGxldGVkU3RlcHMgfHwgW11cbiAgICApLm1hcCgoc3RlcDogYW55KSA9PiAoe1xuICAgICAga2V5OiBgd29ya2Zsb3ctJHtzdGVwLnN0ZXBPcmRlcn1gLFxuICAgICAgc2NvcGU6IFwiV29ya2Zsb3cgTGV2ZWxcIixcbiAgICAgIHRpdGxlOiBgTGV2ZWwgJHtzdGVwLnN0ZXBPcmRlcn06ICR7c3RlcC5zdGVwTmFtZSB8fCBcIkFwcHJvdmFsIFN0ZXBcIn1gLFxuICAgICAgYWN0aW9uOlxuICAgICAgICAoc3RlcC5taW5BcHByb3ZhbHNSZXF1aXJlZCB8fCAxKSA+IDFcbiAgICAgICAgICA/IGBXb3JrZmxvdyBBcHByb3ZlZCAoJHtzdGVwLmN1cnJlbnRBcHByb3ZhbENvdW50IHx8IDB9LyR7c3RlcC5taW5BcHByb3ZhbHNSZXF1aXJlZH0pYFxuICAgICAgICAgIDogXCJXb3JrZmxvdyBBcHByb3ZlZFwiLFxuICAgICAgbWV0YTogW3N0ZXAuc2lnbmVyRGlzcGxheU5hbWUsIHN0ZXAuc2lnbmVyQ29tcGFueSwgc3RlcC5zaWduZXJSb2xlXVxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgICAgIC5qb2luKFwiIC0gXCIpLFxuICAgICAgYXQ6IHN0ZXAuY29tcGxldGVkQXQgfHwgbnVsbCxcbiAgICAgIHN0YXR1czogXCJDT01QTEVURURcIixcbiAgICB9KSk7XG5cbiAgICBjb25zdCBzdGFnZUVudHJpZXMgPSAoaW5zcGVjdGlvbkRldGFpbC5zdGFnZXMgfHwgW10pLmZsYXRNYXAoKHN0YWdlOiBhbnkpID0+XG4gICAgICAoc3RhZ2Uuc2lnbmF0dXJlcyB8fCBbXSkubWFwKChzaWduYXR1cmU6IGFueSwgaW5kZXg6IG51bWJlcikgPT4gKHtcbiAgICAgICAga2V5OiBgc3RhZ2UtJHtzdGFnZS5pZH0tJHtpbmRleH1gLFxuICAgICAgICBzY29wZTogXCJTdGFnZVwiLFxuICAgICAgICB0aXRsZTogc3RhZ2Uuc3RhZ2VUZW1wbGF0ZT8ubmFtZSB8fCBgU3RhZ2UgJHtzdGFnZS5pZH1gLFxuICAgICAgICBhY3Rpb246IGZvcm1hdFNpZ25hdHVyZUFjdGlvbihzaWduYXR1cmUpLFxuICAgICAgICBtZXRhOiBmb3JtYXRTaWduYXR1cmVNZXRhKHNpZ25hdHVyZSksXG4gICAgICAgIGF0OiBzaWduYXR1cmUuc2lnbmVkQXQgfHwgc2lnbmF0dXJlLmNyZWF0ZWRBdCB8fCBudWxsLFxuICAgICAgICBzdGF0dXM6IHNpZ25hdHVyZS5pc1JldmVyc2VkID8gXCJSRVZFUlNFRFwiIDogXCJTSUdORURcIixcbiAgICAgIH0pKSxcbiAgICApO1xuXG4gICAgcmV0dXJuIFsuLi53b3JrZmxvd0VudHJpZXMsIC4uLnN0YWdlRW50cmllc10uc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgYVRpbWUgPSBhLmF0ID8gbmV3IERhdGUoYS5hdCkuZ2V0VGltZSgpIDogMDtcbiAgICAgIGNvbnN0IGJUaW1lID0gYi5hdCA/IG5ldyBEYXRlKGIuYXQpLmdldFRpbWUoKSA6IDA7XG4gICAgICByZXR1cm4gYlRpbWUgLSBhVGltZTtcbiAgICB9KTtcbiAgfSwgW2luc3BlY3Rpb25EZXRhaWxdKTtcblxuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImgtZnVsbCBmbGV4IGZsZXgtY29sIGJnLXN1cmZhY2UtYmFzZVwiPlxuICAgICAgICB7LyogSGVhZGVyICovfVxuICAgICAgICA8aGVhZGVyIGNsYXNzTmFtZT1cImJnLXN1cmZhY2UtY2FyZCBib3JkZXItYiBweC02IHB5LTQgZmxleCBqdXN0aWZ5LWJldHdlZW4gaXRlbXMtY2VudGVyIHN0aWNreSB0b3AtMCB6LTEwIHNocmluay0wXCI+XG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxoMSBjbGFzc05hbWU9XCJ0ZXh0LXhsIGZvbnQtYm9sZCB0ZXh0LXRleHQtcHJpbWFyeSBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICA8U2hpZWxkQ2hlY2sgY2xhc3NOYW1lPVwidy01IGgtNSB0ZXh0LXNlY29uZGFyeVwiIC8+XG4gICAgICAgICAgICAgIFFBL1FDIEFwcHJvdmFsc1xuICAgICAgICAgICAgPC9oMT5cbiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC10ZXh0LW11dGVkIG10LTFcIj5cbiAgICAgICAgICAgICAgUmV2aWV3IFJlcXVlc3RzIGZvciBJbnNwZWN0aW9uIChSRkkpIGFuZCBleGVjdXRlIGNoZWNrbGlzdHMuXG4gICAgICAgICAgICA8L3A+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvaGVhZGVyPlxuXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctc3VyZmFjZS1jYXJkIGJvcmRlci1iIHB4LTYgcHktMiBzaHJpbmstMFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXdyYXAgaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICB7QVBQUk9WQUxfVEFCUy5tYXAoKHRhYikgPT4gKFxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAga2V5PXt0YWIua2V5fVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YHB4LTMgcHktMS41IHJvdW5kZWQtbWQgdGV4dC1zbSBmb250LW1lZGl1bSB0cmFuc2l0aW9uLWNvbG9ycyAke1xuICAgICAgICAgICAgICAgICAgZmlsdGVyU3RhdHVzID09PSB0YWIua2V5XG4gICAgICAgICAgICAgICAgICAgID8gXCJiZy1zZWNvbmRhcnkgdGV4dC13aGl0ZSBzaGFkb3ctc21cIlxuICAgICAgICAgICAgICAgICAgICA6IFwiYmctc3VyZmFjZS1yYWlzZWQgdGV4dC10ZXh0LXNlY29uZGFyeSBob3ZlcjpiZy1ncmF5LTIwMFwiXG4gICAgICAgICAgICAgICAgfWB9XG4gICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0RmlsdGVyU3RhdHVzKHRhYi5rZXkpfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge3RhYi5sYWJlbH1cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICApKX1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgZmxleCBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgIHsvKiBMZWZ0IFBhbmVsOiBMaXN0IG9mIFJGSXMgKi99XG4gICAgICAgICAgPGFzaWRlXG4gICAgICAgICAgICBjbGFzc05hbWU9e2Ake2ZpbHRlclN0YXR1cyA9PT0gXCJEQVNIQk9BUkRcIiA/IFwidy1mdWxsIGJvcmRlci1yLTBcIiA6IFwidy1bNDIwcHhdIGJvcmRlci1yXCJ9IGJnLXN1cmZhY2UtY2FyZCBmbGV4IGZsZXgtY29sIHNocmluay0wIGZsZXgtZ3Jvdy0wYH1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtNCBib3JkZXItYiBzcGFjZS15LTNcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0zIGdhcC0yIHRleHQteHNcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdhcm5pbmctbXV0ZWQgYm9yZGVyIGJvcmRlci1hbWJlci0xMDAgcm91bmRlZC1sZyBweC0yIHB5LTEuNVwiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LWFtYmVyLTcwMCBmb250LWJvbGRcIj5cbiAgICAgICAgICAgICAgICAgICAge2FwcHJvdmFsTWV0cmljcy5wZW5kaW5nLmxlbmd0aH1cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LWFtYmVyLTgwMC84MFwiPlBlbmRpbmc8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXN1Y2Nlc3MtbXV0ZWQgYm9yZGVyIGJvcmRlci1lbWVyYWxkLTEwMCByb3VuZGVkLWxnIHB4LTIgcHktMS41XCI+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtZW1lcmFsZC03MDAgZm9udC1ib2xkXCI+XG4gICAgICAgICAgICAgICAgICAgIHthcHByb3ZhbE1ldHJpY3MuYXBwcm92ZWQubGVuZ3RofVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtZW1lcmFsZC04MDAvODBcIj5BcHByb3ZlZDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZXJyb3ItbXV0ZWQgYm9yZGVyIGJvcmRlci1yZWQtMTAwIHJvdW5kZWQtbGcgcHgtMiBweS0xLjVcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1yZWQtNzAwIGZvbnQtYm9sZFwiPlxuICAgICAgICAgICAgICAgICAgICB7YXBwcm92YWxNZXRyaWNzLnJlamVjdGVkLmxlbmd0aH1cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXJlZC04MDAvODBcIj5SZWplY3RlZDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBvdmVyZmxvdy15LWF1dG8gcC00IHNwYWNlLXktM1wiPlxuICAgICAgICAgICAgICB7ZmlsdGVyU3RhdHVzID09PSBcIkRBU0hCT0FSRFwiID8gKFxuICAgICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvdW5kZWQtMnhsIGJnLWdyYWRpZW50LXRvLXIgZnJvbS1zbGF0ZS05MDAgdmlhLWluZGlnby05MDAgdG8tYmx1ZS05MDAgcC01IHRleHQtd2hpdGUgc2hhZG93LWxnXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC14cyB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMmVtXSB0ZXh0LWluZGlnby0yMDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgVmlzaW9uIFFBIERhc2hib2FyZFxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC14bCBmb250LXNlbWlib2xkIG10LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgUUEvUUMgQXBwcm92YWwgQ29tbWFuZCBDZW50ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvaDM+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtaW5kaWdvLTEwMC85MCBtdC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIEZ1bGwtc2NyZWVuIGluc2lnaHRzIGZvciBwZW5kaW5nIGZsb29ycywgU0xBIHByZXNzdXJlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBhbmQgcmlzay1wcmlvcml0aXplZCBSRklzLlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDxMYXlvdXREYXNoYm9hcmQgY2xhc3NOYW1lPVwidy0xMCBoLTEwIHRleHQtaW5kaWdvLTIwMFwiIC8+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMiB4bDpncmlkLWNvbHMtNiBnYXAtMyB0ZXh0LXhzXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm91bmRlZC14bCBiZy1zdXJmYWNlLWNhcmQgYm9yZGVyIHAtM1wiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC10ZXh0LW11dGVkXCI+VG90YWwgUkZJczwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC0yeGwgZm9udC1ib2xkIHRleHQtdGV4dC1wcmltYXJ5XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbnMubGVuZ3RofVxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLXhsIGJnLXdhcm5pbmctbXV0ZWQgYm9yZGVyIGJvcmRlci1hbWJlci0xMDAgcC0zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LWFtYmVyLTgwMC84MFwiPlBlbmRpbmc8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtMnhsIGZvbnQtYm9sZCB0ZXh0LWFtYmVyLTcwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAge2FwcHJvdmFsTWV0cmljcy5wZW5kaW5nLmxlbmd0aH1cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm91bmRlZC14bCBiZy1zdWNjZXNzLW11dGVkIGJvcmRlciBib3JkZXItZW1lcmFsZC0xMDAgcC0zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LWVtZXJhbGQtODAwLzgwXCI+QXBwcm92ZWQ8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtMnhsIGZvbnQtYm9sZCB0ZXh0LWVtZXJhbGQtNzAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7YXBwcm92YWxNZXRyaWNzLmFwcHJvdmVkLmxlbmd0aH1cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm91bmRlZC14bCBiZy1lcnJvci1tdXRlZCBib3JkZXIgYm9yZGVyLXJlZC0xMDAgcC0zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXJlZC04MDAvODBcIj5PdmVyZHVlPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LTJ4bCBmb250LWJvbGQgdGV4dC1yZWQtNzAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7ZGFzaGJvYXJkU3RhdHMub3ZlcmR1ZUNvdW50fVxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLXhsIGJnLW9yYW5nZS01MCBib3JkZXIgYm9yZGVyLW9yYW5nZS0xMDAgcC0zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LW9yYW5nZS04MDAvODBcIj5GbG9vcnMgUGVuZGluZzwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC0yeGwgZm9udC1ib2xkIHRleHQtb3JhbmdlLTcwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAge2FwcHJvdmFsTWV0cmljcy5mbG9vcnNQZW5kaW5nfVxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLXhsIGJnLXRlYWwtNTAgYm9yZGVyIGJvcmRlci10ZWFsLTEwMCBwLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtdGVhbC04MDAvODBcIj5GbG9vcnMgQ29tcGxldGU8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtMnhsIGZvbnQtYm9sZCB0ZXh0LXRlYWwtNzAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7YXBwcm92YWxNZXRyaWNzLmZsb29yc0NvbXBsZXRlZH1cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLXhsIGJvcmRlciBiZy1zdXJmYWNlLWNhcmQgcC00IHNwYWNlLXktM1wiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC13cmFwIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAge1NBVkVEX1ZJRVdTLm1hcCgodmlldykgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e3ZpZXd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNlbGVjdGVkVmlldyh2aWV3KX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgcHgtMyBweS0xLjUgcm91bmRlZC1mdWxsIHRleHQteHMgYm9yZGVyICR7c2VsZWN0ZWRWaWV3ID09PSB2aWV3ID8gXCJiZy1zZWNvbmRhcnkgYm9yZGVyLXNlY29uZGFyeSB0ZXh0LXdoaXRlXCIgOiBcImJnLXN1cmZhY2UtY2FyZCBib3JkZXItYm9yZGVyLWRlZmF1bHQgdGV4dC10ZXh0LXNlY29uZGFyeSBob3Zlcjpib3JkZXItaW5kaWdvLTMwMFwifWB9XG4gICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHt2aWV3fVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgc206Z3JpZC1jb2xzLTMgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c2VsZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17c2VsZWN0ZWRGbG9vcn1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0U2VsZWN0ZWRGbG9vcihlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJib3JkZXIgcm91bmRlZCBweC0yIHB5LTEuNSB0ZXh0LXhzIGJnLXN1cmZhY2UtY2FyZFwiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbj5BbGwgRmxvb3JzPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICB7QXJyYXkuZnJvbShhcHByb3ZhbE1ldHJpY3MuZmxvb3JNYXAua2V5cygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuc29ydCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKGYpID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIGtleT17Zn0gdmFsdWU9e2Z9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2Z9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICAgICAgICAgICAgICAgIDxzZWxlY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtzZWxlY3RlZFNsYUJ1Y2tldH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRTbGFCdWNrZXQoZS50YXJnZXQudmFsdWUgYXMgU2xhQnVja2V0KVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYm9yZGVyIHJvdW5kZWQgcHgtMiBweS0xLjUgdGV4dC14cyBiZy1zdXJmYWNlLWNhcmRcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtTTEFfQlVDS0VUUy5tYXAoKGIpID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e2J9IHZhbHVlPXtifT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Yn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgdGV4dC14cyB0ZXh0LXRleHQtc2Vjb25kYXJ5IGJvcmRlciByb3VuZGVkIHB4LTIgcHktMS41IGJnLXN1cmZhY2UtYmFzZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJjaGVja2JveFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e3Nob3dPdmVyZHVlT25seX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRTaG93T3ZlcmR1ZU9ubHkoZS50YXJnZXQuY2hlY2tlZCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgT3ZlcmR1ZSBvbmx5XG4gICAgICAgICAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIHhsOmdyaWQtY29scy0zIGdhcC00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwieGw6Y29sLXNwYW4tMiByb3VuZGVkLXhsIGJvcmRlciBiZy1zdXJmYWNlLWNhcmQgcC00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTgwMCBtYi0zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBGbG9vciBTdGF0dXMgQm9hcmRcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgeGw6Z3JpZC1jb2xzLTMgZ2FwLTIgbWF4LWgtWzM2MHB4XSBvdmVyZmxvdy15LWF1dG8gcHItMVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAge0FycmF5LmZyb20oYXBwcm92YWxNZXRyaWNzLmZsb29yTWFwLmVudHJpZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnNvcnQoKFthXSwgW2JdKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKFtmbG9vciwgcm93c10pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwID0gcm93cy5maWx0ZXIoKHIpID0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc1BlbmRpbmdTdGF0dXMoci5zdGF0dXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGEgPSByb3dzLmZpbHRlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChyKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByLnN0YXR1cyA9PT0gXCJBUFBST1ZFRFwiIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHIuc3RhdHVzID09PSBcIlBST1ZJU0lPTkFMTFlfQVBQUk9WRURcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByID0gcm93cy5maWx0ZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAocncpID0+IHJ3LnN0YXR1cyA9PT0gXCJSRUpFQ1RFRFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17Zmxvb3J9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInJvdW5kZWQtbGcgYm9yZGVyIHAtMyBiZy1zdXJmYWNlLWJhc2UgdGV4dC14c1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktODAwIHRydW5jYXRlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2Zsb29yfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0yIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQtWzExcHhdXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1hbWJlci03MDBcIj5QOntwfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWVtZXJhbGQtNzAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBOnthfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXJlZC03MDBcIj5SOntyfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9KX1cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvdW5kZWQteGwgYm9yZGVyIGJnLXN1cmZhY2UtY2FyZCBwLTRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtZ3JheS04MDAgbWItMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICBTTEEgRGlzdHJpYnV0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yIHRleHQteHNcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPk92ZXJkdWU8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ib2xkIHRleHQtcmVkLTcwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2Rhc2hib2FyZFN0YXRzLm92ZXJkdWVDb3VudH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+RHVlICZsdDsyNGg8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ib2xkIHRleHQtYW1iZXItNzAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZGFzaGJvYXJkU3RhdHMuZHVlMjR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPkR1ZSAyNC00OGg8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ib2xkIHRleHQtYmx1ZS03MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtkYXNoYm9hcmRTdGF0cy5kdWU0OH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+VXBjb21pbmc8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ib2xkIHRleHQtZW1lcmFsZC03MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtkYXNoYm9hcmRTdGF0cy51cGNvbWluZ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLXhsIGJvcmRlciBiZy1zdXJmYWNlLWNhcmQgcC00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktODAwIG1iLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgRGF0YSBIZWFsdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTIgdGV4dC14c1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+TWlzc2luZyBMb2NhdGlvbjwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1yZWQtNzAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZGFzaGJvYXJkU3RhdHMubWlzc2luZ0xvY2F0aW9ufVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj5NaXNzaW5nIFdvcmtmbG93PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYm9sZCB0ZXh0LWFtYmVyLTcwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2Rhc2hib2FyZFN0YXRzLm1pc3NpbmdXb3JrZmxvd31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm91bmRlZC14bCBib3JkZXIgYmctc3VyZmFjZS1jYXJkIHAtNFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktODAwIG1iLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICBQcmlvcml0eSBQZW5kaW5nIFF1ZXVlXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMiBtYXgtaC1bMzQwcHhdIG92ZXJmbG93LXktYXV0byBwci0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAge2Rhc2hib2FyZFF1ZXVlLmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXRleHQtbXV0ZWQgaXRhbGljXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIE5vIHBlbmRpbmcgaXRlbXMgZm9yIGN1cnJlbnQgZmlsdGVycy5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXNoYm9hcmRRdWV1ZS5zbGljZSgwLCAyNCkubWFwKChpbnNwKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gcGFyc2VMb2NhdGlvbkhpZXJhcmNoeShpbnNwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVja2V0ID0gZ2V0U2xhQnVja2V0KGluc3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17aW5zcC5pZH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRJbnNwZWN0aW9uSWQoaW5zcC5pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldEZpbHRlclN0YXR1cyhcIlBFTkRJTkdcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIHRleHQtbGVmdCBib3JkZXIgcm91bmRlZC1sZyBwLTIuNSBiZy1zdXJmYWNlLWNhcmQgaG92ZXI6Ym9yZGVyLWluZGlnby0zMDAgaG92ZXI6Ymctc2Vjb25kYXJ5LW11dGVkIHRyYW5zaXRpb25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtdGV4dC1wcmltYXJ5IHRydW5jYXRlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2luc3AuYWN0aXZpdHk/LmFjdGl2aXR5TmFtZSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYEFjdGl2aXR5ICMke2luc3AuYWN0aXZpdHlJZH1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2B0ZXh0LVsxMHB4XSBweC0xLjUgcHktMC41IHJvdW5kZWQgJHtidWNrZXQgPT09IFwiT3ZlcmR1ZVwiID8gXCJiZy1yZWQtMTAwIHRleHQtcmVkLTcwMFwiIDogYnVja2V0ID09PSBcIkR1ZSA8MjRoXCIgPyBcImJnLWFtYmVyLTEwMCB0ZXh0LWFtYmVyLTcwMFwiIDogXCJiZy1pbmZvLW11dGVkIHRleHQtYmx1ZS03MDBcIn1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtidWNrZXR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIHRleHQtdGV4dC1tdXRlZFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2NvcmUge2dldFByaW9yaXR5U2NvcmUoaW5zcCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0xIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQteHMgdGV4dC10ZXh0LXNlY29uZGFyeVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8TWFwUGluIGNsYXNzTmFtZT1cInctMyBoLTNcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtsb2NhdGlvbi5qb2luKFwiID4gXCIpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgTm9kZSAke2luc3AuZXBzTm9kZUlkfWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2luc3AucGVuZGluZ0FwcHJvdmFsTGV2ZWwgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtMiB0ZXh0LVsxMXB4XSB0ZXh0LWFtYmVyLTgwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFBlbmRpbmcgTGV2ZWwge2luc3AucGVuZGluZ0FwcHJvdmFsTGV2ZWx9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2luc3AucGVuZGluZ0FwcHJvdmFsTGFiZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gYCAtICR7aW5zcC5wZW5kaW5nQXBwcm92YWxMYWJlbH1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IFwiXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICkgOiBsb2FkaW5nTGlzdCA/IChcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtY2VudGVyIHRleHQtc20gdGV4dC10ZXh0LWRpc2FibGVkIHAtNFwiPlxuICAgICAgICAgICAgICAgICAgTG9hZGluZyBSRklzLi4uXG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICkgOiBmaWx0ZXJlZEluc3BlY3Rpb25zLmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtY2VudGVyIHRleHQtc20gdGV4dC10ZXh0LWRpc2FibGVkIHAtOCBib3JkZXItMiBib3JkZXItZGFzaGVkIHJvdW5kZWQtbGdcIj5cbiAgICAgICAgICAgICAgICAgIE5vIFJGSXMgZm91bmQuXG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgZmlsdGVyZWRJbnNwZWN0aW9ucy5tYXAoKGluc3ApID0+IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gcGFyc2VMb2NhdGlvbkhpZXJhcmNoeShpbnNwKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1Y2tldCA9IGdldFNsYUJ1Y2tldChpbnNwKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHByaW9yaXR5ID0gZ2V0UHJpb3JpdHlTY29yZShpbnNwKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICBrZXk9e2luc3AuaWR9XG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2VsZWN0ZWRJbnNwZWN0aW9uSWQoaW5zcC5pZCl9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgcC0zIHJvdW5kZWQtbGcgYm9yZGVyIGN1cnNvci1wb2ludGVyIHRyYW5zaXRpb24tYWxsICR7c2VsZWN0ZWRJbnNwZWN0aW9uSWQgPT09IGluc3AuaWQgPyBcImJvcmRlci1zZWNvbmRhcnkgYmctc2Vjb25kYXJ5LW11dGVkIHJpbmctMSByaW5nLWluZGlnby0yMDBcIiA6IFwiYm9yZGVyLWJvcmRlci1kZWZhdWx0IGhvdmVyOmJvcmRlci1pbmRpZ28tMzAwIGhvdmVyOnNoYWRvdy1zbSBiZy1zdXJmYWNlLWNhcmRcIn1gfVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1zdGFydCBtYi0yIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BweC0yIHB5LTAuNSByb3VuZGVkLWZ1bGwgdGV4dC1bMTBweF0gZm9udC1ib2xkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciAke1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3Auc3RhdHVzID09PSBcIkFQUFJPVkVEXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJiZy1ncmVlbi0xMDAgdGV4dC1ncmVlbi03MDBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBpbnNwLnN0YXR1cyA9PT0gXCJQQVJUSUFMTFlfQVBQUk9WRURcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiYmctaW5mby1tdXRlZCB0ZXh0LWJsdWUtNzAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBpbnNwLnN0YXR1cyA9PT0gXCJSRUpFQ1RFRFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcImJnLXJlZC0xMDAgdGV4dC1yZWQtNzAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IGluc3Auc3RhdHVzID09PSBcIlJFVkVSU0VEXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJiZy1hbWJlci0xMDAgdGV4dC1hbWJlci04MDBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcImJnLWFtYmVyLTEwMCB0ZXh0LWFtYmVyLTcwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcC5zdGF0dXMgPT09IFwiUEFSVElBTExZX0FQUFJPVkVEXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiUEFSVElBTFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBpbnNwLnN0YXR1c31cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBpdGVtcy1lbmQgZ2FwLTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXRleHQtbXV0ZWRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcC5yZXF1ZXN0RGF0ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YHRleHQtWzEwcHhdIHB4LTEuNSBweS0wLjUgcm91bmRlZCAke2J1Y2tldCA9PT0gXCJPdmVyZHVlXCIgPyBcImJnLXJlZC0xMDAgdGV4dC1yZWQtNzAwXCIgOiBidWNrZXQgPT09IFwiRHVlIDwyNGhcIiA/IFwiYmctYW1iZXItMTAwIHRleHQtYW1iZXItNzAwXCIgOiBcImJnLWluZm8tbXV0ZWQgdGV4dC1ibHVlLTcwMFwifWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7YnVja2V0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8aDQgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtdGV4dC1wcmltYXJ5IG1iLTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtpbnNwLmFjdGl2aXR5Py5hY3Rpdml0eU5hbWUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYEFjdGl2aXR5ICMke2luc3AuYWN0aXZpdHlJZH1gfVxuICAgICAgICAgICAgICAgICAgICAgIDwvaDQ+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtd3JhcCBpdGVtcy1jZW50ZXIgZ2FwLTEuNSB0ZXh0LVsxMXB4XSB0ZXh0LXRleHQtc2Vjb25kYXJ5XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgcm91bmRlZCBiZy1zdXJmYWNlLXJhaXNlZCBweC0yIHB5LTAuNVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8QnVpbGRpbmcyIGNsYXNzTmFtZT1cInctMyBoLTNcIiAvPntcIiBcIn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAge2xvY2F0aW9uWzBdIHx8IFwiQmxvY2sgTi9BXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgcm91bmRlZCBiZy1zdXJmYWNlLXJhaXNlZCBweC0yIHB5LTAuNVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8TGF5ZXJzIGNsYXNzTmFtZT1cInctMyBoLTNcIiAvPntcIiBcIn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAge2xvY2F0aW9uWzFdIHx8IGdldEZsb29yTGFiZWwoaW5zcCl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgcm91bmRlZCBiZy1zdXJmYWNlLXJhaXNlZCBweC0yIHB5LTAuNVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8SG9tZSBjbGFzc05hbWU9XCJ3LTMgaC0zXCIgLz57XCIgXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtsb2NhdGlvblsyXSB8fCBgTm9kZSAke2luc3AuZXBzTm9kZUlkfWB9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0xLjUgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIHRleHQtWzExcHhdXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXRleHQtbXV0ZWRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgUmlzayBTY29yZToge3ByaW9yaXR5fVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgeyhpbnNwLnBlbmRpbmdPYnNlcnZhdGlvbkNvdW50IHx8IDApID4gMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtcmVkLTcwMCBpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8U2lyZW4gY2xhc3NOYW1lPVwidy0zIGgtM1wiIC8+e1wiIFwifVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtpbnNwLnBlbmRpbmdPYnNlcnZhdGlvbkNvdW50fSBvYnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTIgc3BhY2UteS0xIHRleHQtWzExcHhdXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7aW5zcC5wZW5kaW5nQXBwcm92YWxMZXZlbCA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLW1kIGJnLXdhcm5pbmctbXV0ZWQgcHgtMiBweS0xIHRleHQtYW1iZXItODAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2luc3AucGVuZGluZ0FwcHJvdmFsRGlzcGxheSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYExldmVsICR7aW5zcC5wZW5kaW5nQXBwcm92YWxMZXZlbH0gUGVuZGluZyR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3AucGVuZGluZ0FwcHJvdmFsTGFiZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGA6ICR7aW5zcC5wZW5kaW5nQXBwcm92YWxMYWJlbH1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcIlwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcC53b3JrZmxvd1N1bW1hcnk/LnBlbmRpbmdTdGVwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/Lm1pbkFwcHJvdmFsc1JlcXVpcmVkICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKGluc3Aud29ya2Zsb3dTdW1tYXJ5Py5wZW5kaW5nU3RlcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPy5taW5BcHByb3ZhbHNSZXF1aXJlZCB8fCAxKSA+IDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gYCAoJHtpbnNwLndvcmtmbG93U3VtbWFyeT8ucGVuZGluZ1N0ZXA/LmN1cnJlbnRBcHByb3ZhbENvdW50IHx8IDB9LyR7aW5zcC53b3JrZmxvd1N1bW1hcnk/LnBlbmRpbmdTdGVwPy5taW5BcHByb3ZhbHNSZXF1aXJlZH0gYXBwcm92YWxzKWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogXCJcIn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICApIDogaW5zcC53b3JrZmxvd1N1bW1hcnk/LnJ1blN0YXR1cyA9PT0gXCJDT01QTEVURURcIiA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLW1kIGJnLXN1Y2Nlc3MtbXV0ZWQgcHgtMiBweS0xIHRleHQtZW1lcmFsZC04MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBBbGwgYXBwcm92YWwgbGV2ZWxzIGNvbXBsZXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICkgOiBudWxsfVxuICAgICAgICAgICAgICAgICAgICAgICAge2luc3Auc3RhZ2VBcHByb3ZhbFN1bW1hcnk/LnRvdGFsU3RhZ2VzID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtdGV4dC1tdXRlZFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFN0YWdlIGFwcHJvdmFsczp7XCIgXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1zZW1pYm9sZCB0ZXh0LXRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2luc3Auc3RhZ2VBcHByb3ZhbFN1bW1hcnkuYXBwcm92ZWRTdGFnZXMgfHwgMH0vXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcC5zdGFnZUFwcHJvdmFsU3VtbWFyeS50b3RhbFN0YWdlc31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2luc3Auc3RhZ2VBcHByb3ZhbFN1bW1hcnkucGVuZGluZ0ZpbmFsQXBwcm92YWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCIgLSBhd2FpdGluZyBmaW5hbCBhcHByb3ZhbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IFwiXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9hc2lkZT5cblxuICAgICAgICAgIHsvKiBSaWdodCBQYW5lbDogQ2hlY2tsaXN0IEV4ZWN1dGlvbiAqL31cbiAgICAgICAgICA8bWFpblxuICAgICAgICAgICAgY2xhc3NOYW1lPXtgJHtmaWx0ZXJTdGF0dXMgPT09IFwiREFTSEJPQVJEXCIgPyBcImhpZGRlblwiIDogXCJmbGV4LTFcIn0gbWluLXctMCBiZy1zdXJmYWNlLWJhc2UgZmxleCBmbGV4LWNvbCByZWxhdGl2ZSBvdmVyZmxvdy1oaWRkZW5gfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIHshc2VsZWN0ZWRJbnNwZWN0aW9uSWQgPyAoXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtdGV4dC1kaXNhYmxlZFwiPlxuICAgICAgICAgICAgICAgIDxDbGlwYm9hcmRDaGVjayBjbGFzc05hbWU9XCJ3LTE2IGgtMTYgbWItNCB0ZXh0LWdyYXktMjAwXCIgLz5cbiAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LW1lZGl1bSB0ZXh0LXRleHQtcHJpbWFyeSBtYi0xXCI+XG4gICAgICAgICAgICAgICAgICB7ZmlsdGVyU3RhdHVzID09PSBcIkRBU0hCT0FSRFwiXG4gICAgICAgICAgICAgICAgICAgID8gXCJEYXNoYm9hcmQgQWN0aXZlXCJcbiAgICAgICAgICAgICAgICAgICAgOiBcIlNlbGVjdCBhbiBSRklcIn1cbiAgICAgICAgICAgICAgICA8L2gzPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cIm1heC13LXNtIHRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICB7ZmlsdGVyU3RhdHVzID09PSBcIkRBU0hCT0FSRFwiXG4gICAgICAgICAgICAgICAgICAgID8gXCJVc2UgdGhlIGxlZnQgZGFzaGJvYXJkIHByaW9yaXR5IHF1ZXVlIHRvIG9wZW4gYSBzcGVjaWZpYyBSRkksIG9yIHN3aXRjaCB0YWJzIHRvIGJyb3dzZSBieSBzdGF0dXMuXCJcbiAgICAgICAgICAgICAgICAgICAgOiBcIlNlbGVjdCBhbiBSRkkgZnJvbSB0aGUgbGVmdCBwYW5lbCB0byByZXZpZXcgYW5kIGV4ZWN1dGUgaXRzIGNoZWNrbGlzdC5cIn1cbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKSA6IGxvYWRpbmdEZXRhaWwgPyAoXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtdGV4dC1tdXRlZFwiPlxuICAgICAgICAgICAgICAgIExvYWRpbmcgUkZJIGNoZWNrbGlzdCBkZXRhaWxzLi4uXG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKSA6IGluc3BlY3Rpb25EZXRhaWwgPyAoXG4gICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgey8qIFJGSSBJbmZvIEhlYWRlciAqL31cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXN1cmZhY2UtY2FyZCBweC04IHB5LTYgYm9yZGVyLWIgc2hyaW5rLTAgZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgIDxoMiBjbGFzc05hbWU9XCJ0ZXh0LTJ4bCBmb250LWJvbGQgdGV4dC10ZXh0LXByaW1hcnkgbWItMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIHtpbnNwZWN0aW9uRGV0YWlsLmFjdGl2aXR5Py5hY3Rpdml0eU5hbWV9XG4gICAgICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXdyYXAgaXRlbXMtY2VudGVyIGdhcC00IHRleHQtc20gdGV4dC10ZXh0LXNlY29uZGFyeVwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxDbG9jayBjbGFzc05hbWU9XCJ3LTQgaC00IHRleHQtdGV4dC1kaXNhYmxlZFwiIC8+e1wiIFwifVxuICAgICAgICAgICAgICAgICAgICAgICAgUmVxdWVzdGVkOiB7aW5zcGVjdGlvbkRldGFpbC5yZXF1ZXN0RGF0ZX1cbiAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEuNVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPFVzZXJDaGVjayBjbGFzc05hbWU9XCJ3LTQgaC00IHRleHQtdGV4dC1kaXNhYmxlZFwiIC8+e1wiIFwifVxuICAgICAgICAgICAgICAgICAgICAgICAgUmVxdWVzdGVyOiB7aW5zcGVjdGlvbkRldGFpbC5pbnNwZWN0ZWRCeSB8fCBcIlN5c3RlbVwifVxuICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC5jb21tZW50cyAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMS41IHB4LTIgcHktMSBiZy1zdXJmYWNlLXJhaXNlZCByb3VuZGVkIHRleHQteHMgaXRhbGljXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwie2luc3BlY3Rpb25EZXRhaWwuY29tbWVudHN9XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0zIGZsZXggZmxleC13cmFwIGdhcC0yIHRleHQteHNcIj5cbiAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC53b3JrZmxvd1N1bW1hcnk/LnN0cmF0ZWd5TmFtZSA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSByb3VuZGVkLWZ1bGwgYmctc3VyZmFjZS1yYWlzZWQgcHgtMyBweS0xIGZvbnQtc2VtaWJvbGQgdGV4dC10ZXh0LXNlY29uZGFyeVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC53b3JrZmxvd1N1bW1hcnkuc3RyYXRlZ3lOYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC53b3JrZmxvd1N1bW1hcnkucmVsZWFzZVN0cmF0ZWd5VmVyc2lvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gYCB2JHtpbnNwZWN0aW9uRGV0YWlsLndvcmtmbG93U3VtbWFyeS5yZWxlYXNlU3RyYXRlZ3lWZXJzaW9ufWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IFwiXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XG4gICAgICAgICAgICAgICAgICAgICAge2luc3BlY3Rpb25EZXRhaWwud29ya2Zsb3dTdW1tYXJ5Py5wcm9jZXNzQ29kZSA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSByb3VuZGVkLWZ1bGwgYmctc3VyZmFjZS1yYWlzZWQgcHgtMyBweS0xIGZvbnQtc2VtaWJvbGQgdGV4dC10ZXh0LXNlY29uZGFyeVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC53b3JrZmxvd1N1bW1hcnkucHJvY2Vzc0NvZGV9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XG4gICAgICAgICAgICAgICAgICAgICAge2luc3BlY3Rpb25EZXRhaWwud29ya2Zsb3dTdW1tYXJ5Py5kb2N1bWVudFR5cGUgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgcm91bmRlZC1mdWxsIGJnLXN1cmZhY2UtcmFpc2VkIHB4LTMgcHktMSBmb250LXNlbWlib2xkIHRleHQtdGV4dC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge2luc3BlY3Rpb25EZXRhaWwud29ya2Zsb3dTdW1tYXJ5LmRvY3VtZW50VHlwZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cbiAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC5wZW5kaW5nQXBwcm92YWxMZXZlbCA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSByb3VuZGVkLWZ1bGwgYmctd2FybmluZy1tdXRlZCBweC0zIHB5LTEgZm9udC1zZW1pYm9sZCB0ZXh0LWFtYmVyLTgwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICBQZW5kaW5nIExldmVsIHtpbnNwZWN0aW9uRGV0YWlsLnBlbmRpbmdBcHByb3ZhbExldmVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC5wZW5kaW5nQXBwcm92YWxMYWJlbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gYCAtICR7aW5zcGVjdGlvbkRldGFpbC5wZW5kaW5nQXBwcm92YWxMYWJlbH1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcIlwifVxuICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC53b3JrZmxvd1N1bW1hcnk/LnBlbmRpbmdTdGVwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPy5taW5BcHByb3ZhbHNSZXF1aXJlZCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAoaW5zcGVjdGlvbkRldGFpbC53b3JrZmxvd1N1bW1hcnk/LnBlbmRpbmdTdGVwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPy5taW5BcHByb3ZhbHNSZXF1aXJlZCB8fCAxKSA+IDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGAgKCR7aW5zcGVjdGlvbkRldGFpbC53b3JrZmxvd1N1bW1hcnk/LnBlbmRpbmdTdGVwPy5jdXJyZW50QXBwcm92YWxDb3VudCB8fCAwfS8ke2luc3BlY3Rpb25EZXRhaWwud29ya2Zsb3dTdW1tYXJ5Py5wZW5kaW5nU3RlcD8ubWluQXBwcm92YWxzUmVxdWlyZWR9KWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IFwiXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XG4gICAgICAgICAgICAgICAgICAgICAge2luc3BlY3Rpb25EZXRhaWwuc3RhZ2VBcHByb3ZhbFN1bW1hcnk/LnRvdGFsU3RhZ2VzID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGdhcC0xIHJvdW5kZWQtZnVsbCBiZy1zdXJmYWNlLXJhaXNlZCBweC0zIHB5LTEgZm9udC1zZW1pYm9sZCB0ZXh0LXRleHQtc2Vjb25kYXJ5XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFN0YWdlIFNpZ25vZmZ7XCIgXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtpbnNwZWN0aW9uRGV0YWlsLnN0YWdlQXBwcm92YWxTdW1tYXJ5LmFwcHJvdmVkU3RhZ2VzIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgMH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgL1xuICAgICAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC5zdGFnZUFwcHJvdmFsU3VtbWFyeS50b3RhbFN0YWdlc31cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cbiAgICAgICAgICAgICAgICAgICAgICB7aW5zcGVjdGlvbkRldGFpbC5zdGFnZUFwcHJvdmFsU3VtbWFyeVxuICAgICAgICAgICAgICAgICAgICAgICAgPy5wZW5kaW5nRmluYWxBcHByb3ZhbCA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSByb3VuZGVkLWZ1bGwgYmctaW5mby1tdXRlZCBweC0zIHB5LTEgZm9udC1zZW1pYm9sZCB0ZXh0LWJsdWUtODAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFdhaXRpbmcgZm9yIGZpbmFsIGFwcHJvdmFsXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgKSA6IG51bGx9XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgICAgICAgICAgICAgIHsvKiBQREYgRG93bmxvYWQgKi99XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXthc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBhcGkuZ2V0KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGAvcXVhbGl0eS9pbnNwZWN0aW9ucy8ke2luc3BlY3Rpb25EZXRhaWwuaWR9L3JlcG9ydGAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyByZXNwb25zZVR5cGU6IFwiYmxvYlwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwocmVzLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGEuaHJlZiA9IHVybDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNBcHByb3ZlZCA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zcGVjdGlvbkRldGFpbC5zdGF0dXMgPT09IFwiQVBQUk9WRURcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYS5kb3dubG9hZCA9IGBSRklfJHtpc0FwcHJvdmVkID8gXCJGaW5hbFwiIDogXCJXSVBcIn1fUmVwb3J0XyR7aW5zcGVjdGlvbkRldGFpbC5pZH0ucGRmYDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYS5jbGljaygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWxlcnQoXCJGYWlsZWQgdG8gZG93bmxvYWQgcmVwb3J0LlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHB4LTQgcHktMiBib3JkZXIgcm91bmRlZC1sZyB0ZXh0LXNtIGZvbnQtbWVkaXVtIHNoYWRvdy1zbSAke2luc3BlY3Rpb25EZXRhaWwuc3RhdHVzID09PSBcIkFQUFJPVkVEXCIgPyBcImJnLXN1Y2Nlc3MtbXV0ZWQgYm9yZGVyLWVtZXJhbGQtMjAwIHRleHQtZW1lcmFsZC03MDAgaG92ZXI6YmctZW1lcmFsZC0xMDBcIiA6IFwiYmctc3VyZmFjZS1iYXNlIGJvcmRlci1ib3JkZXItZGVmYXVsdCB0ZXh0LXRleHQtc2Vjb25kYXJ5IGhvdmVyOmJnLXN1cmZhY2UtcmFpc2VkXCJ9YH1cbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIDxGaWxlRG93biBjbGFzc05hbWU9XCJ3LTQgaC00XCIgLz57XCIgXCJ9XG4gICAgICAgICAgICAgICAgICAgICAge2luc3BlY3Rpb25EZXRhaWwuc3RhdHVzID09PSBcIkFQUFJPVkVEXCJcbiAgICAgICAgICAgICAgICAgICAgICAgID8gXCJGaW5hbCBSZXBvcnRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgOiBcIldJUCBSZXBvcnRcIn1cbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIHsvKiBSZXZlcnNlIGZvciBBcHByb3ZlZCAqL31cbiAgICAgICAgICAgICAgICAgICAge2luc3BlY3Rpb25EZXRhaWwuc3RhdHVzID09PSBcIkFQUFJPVkVEXCIgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dSZXZlcnNhbE1vZGFsKHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHgtNCBweS0yIGJnLXdhcm5pbmctbXV0ZWQgYm9yZGVyIGJvcmRlci1hbWJlci0yMDAgdGV4dC1hbWJlci03MDAgcm91bmRlZC1sZyB0ZXh0LXNtIGZvbnQtbWVkaXVtIGhvdmVyOmJnLWFtYmVyLTEwMCBzaGFkb3ctc21cIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxSb3RhdGVDY3cgY2xhc3NOYW1lPVwidy00IGgtNFwiIC8+IFJldmVyc2VcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgey8qIEFkbWluIERlbGV0ZSAqL31cbiAgICAgICAgICAgICAgICAgICAge2lzQWRtaW4gJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2FzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjb25maXJtKFwiUGVybWFuZW50bHkgZGVsZXRlIHRoaXMgUkZJP1wiKSkgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGFwaS5kZWxldGUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgL3F1YWxpdHkvaW5zcGVjdGlvbnMvJHtpbnNwZWN0aW9uRGV0YWlsLmlkfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGVydChcIlJGSSBkZWxldGVkLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTZWxlY3RlZEluc3BlY3Rpb25JZChudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRSZWZyZXNoS2V5KChrKSA9PiBrICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxlcnQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnIucmVzcG9uc2U/LmRhdGE/Lm1lc3NhZ2UgfHwgXCJEZWxldGUgZmFpbGVkLlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC00IHB5LTIgYmctZXJyb3ItbXV0ZWQgYm9yZGVyIGJvcmRlci1yZWQtMjAwIHRleHQtZXJyb3Igcm91bmRlZC1sZyB0ZXh0LXNtIGZvbnQtbWVkaXVtIGhvdmVyOmJnLXJlZC0xMDAgc2hhZG93LXNtXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICA8VHJhc2gyIGNsYXNzTmFtZT1cInctNCBoLTRcIiAvPiBEZWxldGVcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgey8qIEZpbmFsIEFjdGlvbiBCYXIgKERlc2t0b3Agb25seSwgb3Iga2VlcCBzdGlja3kgYm90dG9tIGFzIGlzKSAqL31cblxuICAgICAgICAgICAgICAgIHsvKiBXb3JrZmxvdyBTdGF0dXMgSW5kaWNhdG9yICovfVxuICAgICAgICAgICAgICAgIHt3b3JrZmxvd1N0YXRlICYmIChcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2hyaW5rLTAgYm9yZGVyLXkgYm9yZGVyLWJvcmRlci1zdWJ0bGUgYmctc3VyZmFjZS1jYXJkIHB4LTUgcHktM1wiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC0xIGl0ZW1zLWNlbnRlciBnYXAtM1wiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LWJvbGQgdGV4dC10ZXh0LW11dGVkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlc3Qgd2hpdGVzcGFjZS1ub3dyYXBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIFdvcmtmbG93XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtMSBpdGVtcy1jZW50ZXIgZ2FwLTIgb3ZlcmZsb3cteC1hdXRvIHBiLTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHt3b3JrZmxvd1N0YXRlLnN0ZXBzXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5zb3J0KChhOiBhbnksIGI6IGFueSkgPT4gYS5zdGVwT3JkZXIgLSBiLnN0ZXBPcmRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoc3RlcDogYW55LCBzSWR4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0N1cnJlbnQgPVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd29ya2Zsb3dTdGF0ZS5jdXJyZW50U3RlcE9yZGVyID09PSBzdGVwLnN0ZXBPcmRlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0NvbXBsZXRlZCA9IHN0ZXAuc3RhdHVzID09PSBcIkNPTVBMRVRFRFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVqZWN0ZWQgPSBzdGVwLnN0YXR1cyA9PT0gXCJSRUpFQ1RFRFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmFpc2VyU3RlcCA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGVwLndvcmtmbG93Tm9kZT8uc3RlcFR5cGUgPT09IFwiUkFJU0VfUkZJXCIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzdGVwLnN0ZXBPcmRlciA9PT0gMSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGVwLndvcmtmbG93Tm9kZT8ubGFiZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/LnRvTG93ZXJDYXNlPy4oKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8uaW5jbHVkZXM/LihcInJhaXNlXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0xhc3RTdGVwTm9kZSA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGVwLnN0ZXBPcmRlciA9PT1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi53b3JrZmxvd1N0YXRlLnN0ZXBzLm1hcChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoczogYW55KSA9PiBzLnN0ZXBPcmRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgY29sb3JDbGFzcyA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImJnLXN1cmZhY2UtcmFpc2VkIHRleHQtdGV4dC1tdXRlZCBib3JkZXItYm9yZGVyLWRlZmF1bHRcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNDb21wbGV0ZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvckNsYXNzID1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJiZy1ncmVlbi0xMDAgdGV4dC1ncmVlbi03MDAgYm9yZGVyLWdyZWVuLTIwMFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1JlamVjdGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JDbGFzcyA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiYmctcmVkLTEwMCB0ZXh0LXJlZC03MDAgYm9yZGVyLXJlZC0yMDBcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNDdXJyZW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JDbGFzcyA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiYmctaW5kaWdvLTEwMCB0ZXh0LWluZGlnby03MDAgYm9yZGVyLWluZGlnby0zMDAgcmluZy0yIHJpbmctaW5kaWdvLTIwMFwiO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGxhYmVsIGFuZCBzdWJ0aXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0ZXBMYWJlbCA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0xhc3RTdGVwTm9kZSAmJiAhaXNSYWlzZXJTdGVwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJGaW5hbCBBcHByb3ZhbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogc3RlcC5zdGVwTmFtZSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXAud29ya2Zsb3dOb2RlPy5sYWJlbCB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBTdGVwICR7c3RlcC5zdGVwT3JkZXJ9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGVwU3VidGl0bGUgPSBpc0NvbXBsZXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBpc1JhaXNlclN0ZXBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcIlJGSSBSYWlzZWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IGBTaWduZWQgYnkgJHtzdGVwLnNpZ25lckRpc3BsYXlOYW1lIHx8IHN0ZXAuc2lnbmVkQnl9JHtzdGVwLnNpZ25lckNvbXBhbnkgPyBgIC0gJHtzdGVwLnNpZ25lckNvbXBhbnl9YCA6IFwiXCJ9JHtzdGVwLnNpZ25lclJvbGUgPyBgIC0gJHtzdGVwLnNpZ25lclJvbGV9YCA6IFwiXCJ9YFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBpc1JlamVjdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJSZWplY3RlZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogaXNDdXJyZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBgUGVuZGluZyBBcHByb3ZhbCR7c3RlcC5zdGVwTmFtZSA/IGAgLSAke3N0ZXAuc3RlcE5hbWV9YCA6IFwiXCJ9YFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogXCJXYWl0aW5nXCI7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e3N0ZXAuaWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHNocmluay0wXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YGZsZXggZmxleC1jb2wgYm9yZGVyIHJvdW5kZWQtbGcgcHgtMyBweS0xLjUgJHtjb2xvckNsYXNzfWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdXBwZXJjYXNlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c3RlcExhYmVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSB0cnVuY2F0ZSBtYXgtdy1bMTIwcHhdXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c3RlcFN1YnRpdGxlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzSWR4IDwgd29ya2Zsb3dTdGF0ZS5zdGVwcy5sZW5ndGggLSAxICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BoLTAuNSB3LTQgJHtpc0NvbXBsZXRlZCA/IFwiYmctc3VjY2Vzc1wiIDogXCJiZy1ncmF5LTIwMFwifWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICl9XG5cbiAgICAgICAgICAgICAgICB7LyogQ2hlY2tsaXN0IEFyZWEgKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgb3ZlcmZsb3cteS1hdXRvIHB4LTUgcHktNFwiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYXgtdy01eGwgbXgtYXV0byBzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgICAgey8qIFdvcmtmbG93IENvbXBsZXRlZCBCYW5uZXIgKi99XG4gICAgICAgICAgICAgICAgICAgIHt3b3JrZmxvd1N0YXRlPy5zdGF0dXMgPT09IFwiQ09NUExFVEVEXCIgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctc3VjY2Vzcy1tdXRlZCBib3JkZXIgYm9yZGVyLWVtZXJhbGQtMzAwIHJvdW5kZWQteGwgcHgtNSBweS0zIGZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHRleHQtZW1lcmFsZC04MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxDaGVja0NpcmNsZTIgY2xhc3NOYW1lPVwidy02IGgtNiBzaHJpbmstMFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8aDQgY2xhc3NOYW1lPVwiZm9udC1ib2xkIHRleHQtc21cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXb3JrZmxvdyBGdWxseSBBcHByb3ZlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2g0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIG10LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBBbGwge3dvcmtmbG93U3RhdGUuc3RlcHMubGVuZ3RofSBhcHByb3ZhbCBsZXZlbHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXZlIGJlZW4gY29tcGxldGVkIGFuZCBzaWduZWQuXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAgICAgIHtpbnNwZWN0aW9uRGV0YWlsLndvcmtmbG93U3VtbWFyeT8uY29tcGxldGVkU3RlcHM/Lmxlbmd0aCA+XG4gICAgICAgICAgICAgICAgICAgICAgMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLXhsIGJvcmRlciBiZy1zdXJmYWNlLWNhcmQgcC00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LXRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICBDb21wbGV0ZWQgQXBwcm92YWwgTGV2ZWxzXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtMyBzcGFjZS15LTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge2luc3BlY3Rpb25EZXRhaWwud29ya2Zsb3dTdW1tYXJ5LmNvbXBsZXRlZFN0ZXBzLm1hcChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoc3RlcDogYW55KSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17YHdmLWNvbXBsZXRlLSR7c3RlcC5zdGVwT3JkZXJ9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLWVtZXJhbGQtMjAwIGJnLXN1Y2Nlc3MtbXV0ZWQgcHgtMyBweS0yIHRleHQteHMgdGV4dC1lbWVyYWxkLTkwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZm9udC1zZW1pYm9sZFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExldmVsIHtzdGVwLnN0ZXBPcmRlcn06e1wiIFwifVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzdGVwLnN0ZXBOYW1lIHx8IFwiQXBwcm92YWwgU3RlcFwifVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyhzdGVwLm1pbkFwcHJvdmFsc1JlcXVpcmVkIHx8IDEpID4gMSAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBRdW9ydW0gbWV0OiB7c3RlcC5jdXJyZW50QXBwcm92YWxDb3VudCB8fCAwfS9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzdGVwLm1pbkFwcHJvdmFsc1JlcXVpcmVkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7W1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RlcC5zaWduZXJEaXNwbGF5TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXAuc2lnbmVyQ29tcGFueSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXAuc2lnbmVyUm9sZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuam9pbihcIiAtIFwiKSB8fCBcIlNpZ25lZFwifVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3N0ZXAuY29tcGxldGVkQXQgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtMSB0ZXh0LWVtZXJhbGQtNzAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7bmV3IERhdGUoc3RlcC5jb21wbGV0ZWRBdCkudG9Mb2NhbGVTdHJpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgICAgICB7YXBwcm92YWxIaXN0b3J5Lmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm91bmRlZC14bCBib3JkZXIgYmctc3VyZmFjZS1jYXJkIHAtNFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC10ZXh0LXByaW1hcnlcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgQXBwcm92YWwgSGlzdG9yeVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTMgc3BhY2UteS0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHthcHByb3ZhbEhpc3RvcnkubWFwKChlbnRyeTogYW55KSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtlbnRyeS5rZXl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJyb3VuZGVkLWxnIGJvcmRlciBib3JkZXItYm9yZGVyLXN1YnRsZSBiZy1zdXJmYWNlLWJhc2UgcHgtMyBweS0zIHRleHQteHNcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXdyYXAgaXRlbXMtc3RhcnQganVzdGlmeS1iZXR3ZWVuIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmb250LXNlbWlib2xkIHRleHQtdGV4dC1wcmltYXJ5XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZW50cnkudGl0bGV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0xIHRleHQtdGV4dC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtlbnRyeS5zY29wZX0gLSB7ZW50cnkuYWN0aW9ufVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtlbnRyeS5tZXRhICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtMSB0ZXh0LXRleHQtbXV0ZWRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2VudHJ5Lm1ldGF9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtY29sIGl0ZW1zLWVuZCBnYXAtMVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2Byb3VuZGVkLWZ1bGwgcHgtMiBweS0xIGZvbnQtc2VtaWJvbGQgJHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50cnkuc3RhdHVzID09PSBcIlJFVkVSU0VEXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiYmctd2FybmluZy1tdXRlZCB0ZXh0LWFtYmVyLTgwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcImJnLXN1cmZhY2UtcmFpc2VkIHRleHQtdGV4dC1zZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2VudHJ5LnN0YXR1c31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2VudHJ5LmF0ICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtdGV4dC1tdXRlZFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7bmV3IERhdGUoZW50cnkuYXQpLnRvTG9jYWxlU3RyaW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgICAgICB7LyogT2JzZXJ2YXRpb24gQmFubmVyICovfVxuICAgICAgICAgICAgICAgICAgICB7cGVuZGluZ09ic2VydmF0aW9uc0NvdW50ID4gMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy13YXJuaW5nLW11dGVkIGJvcmRlciBib3JkZXItYW1iZXItMjAwIHJvdW5kZWQteGwgcHgtNCBweS0zIGZsZXggZ2FwLTMgdGV4dC1hbWJlci04MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxBbGVydENpcmNsZSBjbGFzc05hbWU9XCJ3LTUgaC01IHNocmluay0wXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1zbVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIENhbm5vdCBBcHByb3ZlIFJGSVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2g0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIG10LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBUaGVyZSBhcmUge3BlbmRpbmdPYnNlcnZhdGlvbnNDb3VudH0gcGVuZGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ic2VydmF0aW9uKHMpLiBUaGUgZmllbGQgdGVhbSBtdXN0IHJlc29sdmUgdGhlc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiZWZvcmUgeW91IGNhbiBhcHByb3ZlLlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgICAgICB7IWluc3BlY3Rpb25EZXRhaWwuc3RhZ2VzIHx8XG4gICAgICAgICAgICAgICAgICAgIGluc3BlY3Rpb25EZXRhaWwuc3RhZ2VzLmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXN1cmZhY2UtY2FyZCBwLTYgcm91bmRlZC14bCBib3JkZXIgdGV4dC1jZW50ZXIgdGV4dC10ZXh0LW11dGVkXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBObyBjaGVja2xpc3QgdGVtcGxhdGUgYXNzaWduZWQgdG8gdGhpcyBhY3Rpdml0eS5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgICBpbnNwZWN0aW9uRGV0YWlsLnN0YWdlcy5tYXAoKHN0YWdlOiBhbnksIHNJZHg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF0ZXN0U3RhZ2VBcHByb3ZhbCA9IFsuLi4oc3RhZ2Uuc2lnbmF0dXJlcyB8fCBbXSldXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXZlcnNlKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKHNpZ25hdHVyZTogYW55KSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmF0dXJlPy5hY3Rpb25UeXBlID09PSBcIlNUQUdFX0FQUFJPVkVcIiAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIXNpZ25hdHVyZT8uaXNSZXZlcnNlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17c3RhZ2UuaWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctc3VyZmFjZS1jYXJkIHJvdW5kZWQteGwgc2hhZG93LXNtIGJvcmRlciBvdmVyZmxvdy1oaWRkZW5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1zdXJmYWNlLWJhc2UgcHgtNCBweS0yLjUgYm9yZGVyLWIgZmxleCBmbGV4LXdyYXAganVzdGlmeS1iZXR3ZWVuIGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGQgdGV4dC10ZXh0LXByaW1hcnlcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdGFnZSB7c0lkeCArIDF9OntcIiBcIn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c3RhZ2Uuc3RhZ2VUZW1wbGF0ZT8ubmFtZSB8fCBcIkdlbmVyYWwgQ2hlY2tzXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvaDM+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC10ZXh0LW11dGVkIG10LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c3RhZ2UuaXNMb2NrZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJTdGFnZSBhcHByb3ZlZCBhbmQgbG9ja2VkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogXCJTdGFnZSBhcHByb3ZhbCBwZW5kaW5nXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2xhdGVzdFN0YWdlQXBwcm92YWwgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC10ZXh0LW11dGVkIG10LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFwcHJvdmVkIGJ5e1wiIFwifVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2xhdGVzdFN0YWdlQXBwcm92YWwuc2lnbmVyRGlzcGxheU5hbWUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF0ZXN0U3RhZ2VBcHByb3ZhbC5zaWduZWRCeX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtsYXRlc3RTdGFnZUFwcHJvdmFsLnNpZ25lckNvbXBhbnkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCAtICR7bGF0ZXN0U3RhZ2VBcHByb3ZhbC5zaWduZXJDb21wYW55fWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7bGF0ZXN0U3RhZ2VBcHByb3ZhbC5zaWduZXJSb2xlTGFiZWwgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCAtICR7bGF0ZXN0U3RhZ2VBcHByb3ZhbC5zaWduZXJSb2xlTGFiZWx9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXRleHQtbXV0ZWRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFnZS5pdGVtcz8uZmlsdGVyKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoaTogYW55KSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGkudmFsdWUgPT09IFwiWUVTXCIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpLnZhbHVlID09PSBcIk5BXCIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpLmlzT2ssXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApLmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH17XCIgXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyB7c3RhZ2UuaXRlbXM/Lmxlbmd0aH0gQ29tcGxldGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2B0ZXh0LVsxMHB4XSBmb250LWJvbGQgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIHB4LTIgcHktMSByb3VuZGVkLWZ1bGwgJHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YWdlLmlzTG9ja2VkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJiZy1lbWVyYWxkLTEwMCB0ZXh0LWVtZXJhbGQtNzAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcImJnLXN1cmZhY2UtcmFpc2VkIHRleHQtdGV4dC1tdXRlZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c3RhZ2UuaXNMb2NrZWQgPyBcIkFwcHJvdmVkICYgTG9ja2VkXCIgOiBzdGFnZS5zdGF0dXN9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2lzQWRtaW4gJiYgc3RhZ2UuaXNMb2NrZWQgJiYgaW5zcGVjdGlvbkRldGFpbC5zdGF0dXMgIT09IFwiQVBQUk9WRURcIiAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17YXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZWFzb24gPSBwcm9tcHQoXCJFbnRlciByZWFzb24gdG8gcmV2ZXJzZSB0aGlzIHN0YWdlIGFwcHJvdmFsOlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZWFzb24pIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgYXBpLnBvc3QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYC9xdWFsaXR5L2luc3BlY3Rpb25zLyR7aW5zcGVjdGlvbkRldGFpbC5pZH0vc3RhZ2VzLyR7c3RhZ2UuaWR9L3JldmVyc2VgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgcmVhc29uIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFJlZnJlc2hLZXkoKGspID0+IGsgKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC0yIHB5LTEgdGV4dC1bMTBweF0gZm9udC1ib2xkIHVwcGVyY2FzZSByb3VuZGVkIGJvcmRlciBib3JkZXItYW1iZXItMzAwIHRleHQtYW1iZXItNzAwIGhvdmVyOmJnLWFtYmVyLTUwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZXZlcnNlIFN0YWdlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci1iIGJnLXN1cmZhY2UtYmFzZS82MCBweC00IHB5LTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzdGFnZS5zaWduYXR1cmVzPy5sZW5ndGggPiAwID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzdGFnZS5zaWduYXR1cmVzLm1hcChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzaWduYXR1cmU6IGFueSwgc2lnSWR4OiBudW1iZXIpID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17YHN0YWdlLXNpZ25hdHVyZS0ke3N0YWdlLmlkfS0ke3NpZ0lkeH1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgZ2FwLTEgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLWJvcmRlci1zdWJ0bGUgYmctc3VyZmFjZS1jYXJkIHB4LTMgcHktMiB0ZXh0LXhzXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXdyYXAgaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1zZW1pYm9sZCB0ZXh0LXRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0U2lnbmF0dXJlQWN0aW9uKHNpZ25hdHVyZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c2lnbmF0dXJlLnNpZ25lZEF0ICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC10ZXh0LW11dGVkXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge25ldyBEYXRlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmF0dXJlLnNpZ25lZEF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkudG9Mb2NhbGVTdHJpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtdGV4dC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtmb3JtYXRTaWduYXR1cmVNZXRhKHNpZ25hdHVyZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLWRhc2hlZCBib3JkZXItYm9yZGVyLWRlZmF1bHQgcHgtMyBweS0yIHRleHQteHMgdGV4dC10ZXh0LW11dGVkXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTm8gc3RhZ2UgYXBwcm92YWwgcmVjb3JkZWQgeWV0LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJkaXZpZGUteVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1suLi4oc3RhZ2UuaXRlbXMgfHwgW10pXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc29ydChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoYTogYW55LCBiOiBhbnkpID0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoYS5pdGVtVGVtcGxhdGU/LnNlcXVlbmNlIHx8IDApIC1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChiLml0ZW1UZW1wbGF0ZT8uc2VxdWVuY2UgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoaXRlbTogYW55KSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtpdGVtLmlkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicC0zIGZsZXggZ2FwLTMgaG92ZXI6Ymctc3VyZmFjZS1iYXNlIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTAuNSBzaHJpbmstMCBmbGV4IGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlSXRlbVZhbHVlQ2hhbmdlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnZhbHVlID09PSBcIllFU1wiID8gXCJcIiA6IFwiWUVTXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzdGFnZS5pc0xvY2tlZCAmJiAhaXNBZG1pbikgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChpbnNwZWN0aW9uRGV0YWlsLmlzTG9ja2VkICYmICFpc0FkbWluKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIVtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJQRU5ESU5HXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiUEFSVElBTExZX0FQUFJPVkVEXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdLmluY2x1ZGVzKGluc3BlY3Rpb25EZXRhaWwuc3RhdHVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BweC0zIHB5LTEgcm91bmRlZCB0ZXh0LVsxMHB4XSBmb250LWJvbGQgdHJhY2tpbmctd2lkZXIgdHJhbnNpdGlvbi1jb2xvcnMgZGlzYWJsZWQ6b3BhY2l0eS01MCBib3JkZXIgJHtpdGVtLnZhbHVlID09PSBcIllFU1wiIHx8IChpdGVtLmlzT2sgJiYgaXRlbS52YWx1ZSAhPT0gXCJOQVwiKSA/IFwiYmctaW5kaWdvLTEwMCBib3JkZXItaW5kaWdvLTMwMCB0ZXh0LWluZGlnby03MDBcIiA6IFwiYmctc3VyZmFjZS1jYXJkIGJvcmRlci1ib3JkZXItc3Ryb25nIHRleHQtdGV4dC1zZWNvbmRhcnkgaG92ZXI6Ymctc3VyZmFjZS1iYXNlXCJ9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFlFU1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVJdGVtVmFsdWVDaGFuZ2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0uaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0udmFsdWUgPT09IFwiTkFcIiA/IFwiXCIgOiBcIk5BXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzdGFnZS5pc0xvY2tlZCAmJiAhaXNBZG1pbikgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChpbnNwZWN0aW9uRGV0YWlsLmlzTG9ja2VkICYmICFpc0FkbWluKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIVtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJQRU5ESU5HXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiUEFSVElBTExZX0FQUFJPVkVEXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdLmluY2x1ZGVzKGluc3BlY3Rpb25EZXRhaWwuc3RhdHVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BweC0zIHB5LTEgcm91bmRlZCB0ZXh0LVsxMHB4XSBmb250LWJvbGQgdHJhY2tpbmctd2lkZXIgdHJhbnNpdGlvbi1jb2xvcnMgZGlzYWJsZWQ6b3BhY2l0eS01MCBib3JkZXIgJHtpdGVtLnZhbHVlID09PSBcIk5BXCIgPyBcImJnLWFtYmVyLTEwMCBib3JkZXItYW1iZXItMzAwIHRleHQtYW1iZXItNzAwXCIgOiBcImJnLXN1cmZhY2UtY2FyZCBib3JkZXItYm9yZGVyLXN0cm9uZyB0ZXh0LXRleHQtc2Vjb25kYXJ5IGhvdmVyOmJnLXN1cmZhY2UtYmFzZVwifWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBOQVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2B0ZXh0LXNtICR7aXRlbS52YWx1ZSA9PT0gXCJZRVNcIiB8fCBpdGVtLnZhbHVlID09PSBcIk5BXCIgfHwgaXRlbS5pc09rID8gXCJ0ZXh0LXRleHQtc2Vjb25kYXJ5IGZvbnQtbWVkaXVtXCIgOiBcInRleHQtdGV4dC1wcmltYXJ5XCJ9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtpdGVtLml0ZW1UZW1wbGF0ZT8uaXRlbVRleHQgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiQ2hlY2tsaXN0IEl0ZW1cIn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7W1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiUEVORElOR1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiUEFSVElBTExZX0FQUFJPVkVEXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0uaW5jbHVkZXMoaW5zcGVjdGlvbkRldGFpbC5zdGF0dXMpID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cInRleHRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJBZGQgcmVtYXJrcy4uLlwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17aXRlbS5yZW1hcmtzIHx8IFwiXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZUl0ZW1SZW1hcmtzQ2hhbmdlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0uaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS50YXJnZXQudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHN0YWdlLmlzTG9ja2VkICYmICFpc0FkbWluKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoaW5zcGVjdGlvbkRldGFpbC5pc0xvY2tlZCAmJiAhaXNBZG1pbilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cIm10LTIgdy1mdWxsIHRleHQtc20gYm9yZGVyLWJvcmRlci1zdHJvbmcgcm91bmRlZC1tZCBzaGFkb3ctc20gZm9jdXM6cmluZy1zZWNvbmRhcnkgZm9jdXM6Ym9yZGVyLXNlY29uZGFyeVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnJlbWFya3MgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwibXQtMSB0ZXh0LXhzIHRleHQtdGV4dC1tdXRlZCBpdGFsaWNcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUmVtYXJrOiB7aXRlbS5yZW1hcmtzfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7W1wiUEVORElOR1wiLCBcIlBBUlRJQUxMWV9BUFBST1ZFRFwiXS5pbmNsdWRlcyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3BlY3Rpb25EZXRhaWwuc3RhdHVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICghaW5zcGVjdGlvbkRldGFpbC5pc0xvY2tlZCB8fCBpc0FkbWluKSAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci10IGJnLXN1cmZhY2UtYmFzZSBweC00IHB5LTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtY29sIGdhcC0zIGxnOmZsZXgtcm93IGxnOml0ZW1zLWNlbnRlciBsZzpqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC10ZXh0LW11dGVkXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aXNTdGFnZUFwcHJvdmVkKHN0YWdlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiVGhpcyBzdGFnZSBpcyBhbHJlYWR5IGFwcHJvdmVkIGFuZCBsb2NrZWQuXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBpc1N0YWdlQ2hlY2tsaXN0Q29tcGxldGUoc3RhZ2UpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcIkFsbCBjaGVja2xpc3QgaXRlbXMgYXJlIGNvbXBsZXRlLiBUaGlzIHN0YWdlIGlzIHJlYWR5IGZvciBhcHByb3ZhbC5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogXCJDb21wbGV0ZSBhbGwgY2hlY2tsaXN0IGl0ZW1zIGluIHRoaXMgc3RhZ2UsIHRoZW4gYXBwcm92ZSBpdC5cIn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC13cmFwIGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVBcHByb3ZlU3RhZ2Uoc3RhZ2UpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIWNhbkFwcHJvdmVJbnNwZWN0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhZ2UuaXNMb2NrZWQgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnNwZWN0aW9uRGV0YWlsLmlzTG9ja2VkIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIWlzU3RhZ2VDaGVja2xpc3RDb21wbGV0ZShzdGFnZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTIgYmctc2Vjb25kYXJ5IHRleHQtd2hpdGUgcm91bmRlZC1sZyBob3ZlcjpiZy1zZWNvbmRhcnktZGFyayBkaXNhYmxlZDpvcGFjaXR5LTUwIHRleHQtc20gZm9udC1tZWRpdW1cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT17XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIWNhbkFwcHJvdmVJbnNwZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiWW91IGRvIG5vdCBoYXZlIGFwcHJvdmFsIGFjY2VzcyBmb3IgdGhpcyBzdGFnZS5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAhaXNTdGFnZUNoZWNrbGlzdENvbXBsZXRlKHN0YWdlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiQ29tcGxldGUgYWxsIGNoZWNrbGlzdCBpdGVtcyBpbiB0aGlzIHN0YWdlIGJlZm9yZSBhcHByb3ZhbC5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IFwiXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8U2hpZWxkQ2hlY2sgY2xhc3NOYW1lPVwidy00IGgtNCBpbmxpbmUgbXItMVwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFwcHJvdmUgU3RhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICB7LyogRmluYWwgQWN0aW9uIEJhciAqL31cbiAgICAgICAgICAgICAgICB7W1wiUEVORElOR1wiLCBcIlBBUlRJQUxMWV9BUFBST1ZFRFwiXS5pbmNsdWRlcyhcbiAgICAgICAgICAgICAgICAgIGluc3BlY3Rpb25EZXRhaWwuc3RhdHVzLFxuICAgICAgICAgICAgICAgICkgJiZcbiAgICAgICAgICAgICAgICAgICghaW5zcGVjdGlvbkRldGFpbC5pc0xvY2tlZCB8fCBpc0FkbWluKSAmJiAoXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci10IGJvcmRlci1ib3JkZXItZGVmYXVsdCBiZy1zdXJmYWNlLWNhcmQgcHgtNSBweS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWF4LXctNXhsIG14LWF1dG8gZmxleCBmbGV4LWNvbCBnYXAtMyBsZzpmbGV4LXJvdyBsZzppdGVtcy1jZW50ZXIgbGc6anVzdGlmeS1iZXR3ZWVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXNtIG1pbi1oLTVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHshYWxsQ2hlY2tlZCAmJiBwZW5kaW5nT2JzZXJ2YXRpb25zQ291bnQgPT09IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWVycm9yIGZvbnQtbWVkaXVtIGZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8QWxlcnRDaXJjbGUgY2xhc3NOYW1lPVwidy00IGgtNFwiIC8+IFBsZWFzZSBjb21wbGV0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbCBjaGVja2xpc3QgaXRlbXMgYmVmb3JlIGFwcHJvdmluZy5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHthbGxDaGVja2VkICYmIHBlbmRpbmdPYnNlcnZhdGlvbnNDb3VudCA9PT0gMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc3VjY2VzcyBmb250LW1lZGl1bSBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMS41XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPENoZWNrQ2lyY2xlMiBjbGFzc05hbWU9XCJ3LTQgaC00XCIgLz4gQ2hlY2tsaXN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGUuIFJlYWR5IGZvciBhcHByb3ZhbC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC13cmFwIGl0ZW1zLWNlbnRlciBnYXAtMiBsZzpqdXN0aWZ5LWVuZFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93T2JzTW9kYWwodHJ1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTQgcHktMiBiZy1zdXJmYWNlLWNhcmQgYm9yZGVyIGJvcmRlci1hbWJlci0yMDAgdGV4dC1hbWJlci03MDAgcm91bmRlZC1sZyBob3ZlcjpiZy13YXJuaW5nLW11dGVkIGZvY3VzOnJpbmctMiBmb2N1czpyaW5nLWFtYmVyLTIwMCBmb250LW1lZGl1bSBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB0ZXh0LXNtXCJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPE1lc3NhZ2VTcXVhcmVXYXJuaW5nIGNsYXNzTmFtZT1cInctNCBoLTRcIiAvPntcIiBcIn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgT2JzZXJ2YXRpb25zICh7b2JzZXJ2YXRpb25zLmxlbmd0aH0pXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlUmVqZWN0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTIgYmctc3VyZmFjZS1jYXJkIGJvcmRlciBib3JkZXItcmVkLTIwMCB0ZXh0LWVycm9yIHJvdW5kZWQtbGcgaG92ZXI6YmctZXJyb3ItbXV0ZWQgZm9jdXM6cmluZy0yIGZvY3VzOnJpbmctcmVkLTIwMCBmb250LW1lZGl1bSB0ZXh0LXNtIGJvcmRlci1sXCJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgUmVqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHt3b3JrZmxvd1N0YXRlICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZldGNoRWxpZ2libGVVc2VycygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd0RlbGVnYXRpb25Nb2RhbCh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTQgcHktMiBiZy1zdXJmYWNlLWNhcmQgYm9yZGVyIGJvcmRlci1pbmRpZ28tMjAwIHRleHQtc2Vjb25kYXJ5IHJvdW5kZWQtbGcgaG92ZXI6Ymctc2Vjb25kYXJ5LW11dGVkIGZvY3VzOnJpbmctMiBmb2N1czpyaW5nLWluZGlnby0yMDAgZm9udC1tZWRpdW0gdGV4dC1zbSBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VXNlckNoZWNrIGNsYXNzTmFtZT1cInctNCBoLTRcIiAvPiBEZWxlZ2F0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICB7IXdvcmtmbG93U3RhdGUgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlUHJvdmlzaW9uYWxseUFwcHJvdmV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIGJnLXN1cmZhY2UtY2FyZCBib3JkZXIgYm9yZGVyLWJsdWUtMjAwIHRleHQtcHJpbWFyeSByb3VuZGVkLWxnIGhvdmVyOmJnLXByaW1hcnktbXV0ZWQgZm9jdXM6cmluZy0yIGZvY3VzOnJpbmctYmx1ZS0yMDAgZm9udC1tZWRpdW0gdGV4dC1zbVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBQcm92aXNpb25hbCBBcHByb3ZhbFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZUluaXRpYXRlQXBwcm92ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICFjYW5BcHByb3ZlSW5zcGVjdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICFhbGxDaGVja2VkIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVuZGluZ09ic2VydmF0aW9uc0NvdW50ID4gMFxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTYgcHktMiBiZy1zZWNvbmRhcnkgdGV4dC13aGl0ZSByb3VuZGVkLWxnIGhvdmVyOmJnLXNlY29uZGFyeS1kYXJrIGRpc2FibGVkOm9wYWNpdHktNTAgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGZvbnQtbWVkaXVtIHNoYWRvdy1zbSBzaGFkb3ctaW5kaWdvLTIwMCB0cmFuc2l0aW9uLWFsbCB0ZXh0LXNtIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFNoaWVsZENoZWNrIGNsYXNzTmFtZT1cInctNCBoLTRcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7d29ya2Zsb3dTdGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJBcHByb3ZlIFdvcmtmbG93IFN0ZXBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogXCJGaW5hbCBBcHByb3ZlXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICkgOiBudWxsfVxuICAgICAgICAgIDwvbWFpbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIFJhaXNlIE9ic2VydmF0aW9uIE1vZGFsICovfVxuICAgICAgICB7c2hvd09ic01vZGFsICYmIChcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZpeGVkIGluc2V0LTAgYmctc3VyZmFjZS1vdmVybGF5IGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHotNTAgcC00XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXN1cmZhY2UtY2FyZCByb3VuZGVkLTJ4bCBzaGFkb3ctMnhsIHctZnVsbCBtYXgtdy0zeGwgZmxleCBmbGV4LWNvbCBtYXgtaC1bOTB2aF1cIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1jZW50ZXIgcC02IGJvcmRlci1iIHNocmluay0wXCI+XG4gICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQteGwgZm9udC1ib2xkIHRleHQtdGV4dC1wcmltYXJ5IGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICA8TWVzc2FnZVNxdWFyZVdhcm5pbmcgY2xhc3NOYW1lPVwidy02IGgtNiB0ZXh0LXdhcm5pbmdcIiAvPlxuICAgICAgICAgICAgICAgICAgT2JzZXJ2YXRpb24gTG9nXG4gICAgICAgICAgICAgICAgPC9oMz5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93T2JzTW9kYWwoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC10ZXh0LWRpc2FibGVkIGhvdmVyOnRleHQtdGV4dC1zZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxYIGNsYXNzTmFtZT1cInctNiBoLTZcIiAvPlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBvdmVyZmxvdy15LWF1dG8gcC02IHNwYWNlLXktNiBiZy1zdXJmYWNlLWJhc2VcIj5cbiAgICAgICAgICAgICAgICB7LyogT2JzZXJ2YXRpb25zIEhlYWRlciAvIFRhYnMgKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBnYXAtMiBib3JkZXItYiBib3JkZXItYm9yZGVyLWRlZmF1bHQgcGItMlwiPlxuICAgICAgICAgICAgICAgICAgICB7KFtcIlBFTkRJTkdcIiwgXCJSRUNUSUZJRURcIiwgXCJDTE9TRURcIiwgXCJBTExcIl0gYXMgY29uc3QpLm1hcChcbiAgICAgICAgICAgICAgICAgICAgICAodGFiKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17dGFifVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRPYnNUYWIodGFiKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgcHgtNCBweS0yIHRleHQtc20gZm9udC1ib2xkIGJvcmRlci1iLTIgdHJhbnNpdGlvbi1jb2xvcnMgJHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYnNUYWIgPT09IHRhYlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcImJvcmRlci1hbWJlci02MDAgdGV4dC1hbWJlci03MDBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcImJvcmRlci10cmFuc3BhcmVudCB0ZXh0LXRleHQtbXV0ZWQgaG92ZXI6dGV4dC10ZXh0LXNlY29uZGFyeSBob3ZlcjpiZy1zdXJmYWNlLXJhaXNlZCByb3VuZGVkLXRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICB9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge3RhYiA9PT0gXCJQRU5ESU5HXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiUGVuZGluZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiB0YWIgPT09IFwiUkVDVElGSUVEXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJSZWN0aWZpZWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiB0YWIgPT09IFwiQ0xPU0VEXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcIkNsb3NlZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogXCJBbGxcIn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwibWwtMiBweC0yIHB5LTAuNSByb3VuZGVkLWZ1bGwgdGV4dC14cyBiZy1zdXJmYWNlLXJhaXNlZCB0ZXh0LXRleHQtc2Vjb25kYXJ5XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3RhYiA9PT0gXCJBTExcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBvYnNlcnZhdGlvbnMubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHRhYiA9PT0gXCJQRU5ESU5HXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBvYnNlcnZhdGlvbnMuZmlsdGVyKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG8pID0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uc3RhdHVzID09PSBcIlBFTkRJTkdcIiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLnN0YXR1cyA9PT0gXCJPUEVOXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKS5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBvYnNlcnZhdGlvbnMuZmlsdGVyKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG8pID0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uc3RhdHVzID09PSBcIkNMT1NFRFwiIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uc3RhdHVzID09PSBcIlJFQ1RJRklFRFwiIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uc3RhdHVzID09PSBcIlJFU09MVkVEXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKS5sZW5ndGh9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAge2ZpbHRlcmVkT2JzZXJ2YXRpb25zLmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXRleHQtbXV0ZWQgdGV4dC1zbSBpdGFsaWMgcHktNFwiPlxuICAgICAgICAgICAgICAgICAgICAgIE5vIG9ic2VydmF0aW9ucyBtYXRjaCB0aGUgc2VsZWN0ZWQgdGFiLlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlcmVkT2JzZXJ2YXRpb25zLm1hcCgob2JzLCBpZHgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhZ2VJbmZvID0gZ2V0RGF5c09wZW4ob2JzLmNyZWF0ZWRBdCk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtvYnMuaWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLXN1cmZhY2UtY2FyZCByb3VuZGVkLXhsIHAtNCBzaGFkb3ctc20gYm9yZGVyXCJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1zdGFydCBtYi0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtY29sIGdhcC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2B0ZXh0LXhzIGZvbnQtYm9sZCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXIgcHgtMiBweS0wLjUgcm91bmRlZCB3LWZpdCAke1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9icy5zdGF0dXMgPT09IFwiUEVORElOR1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiYmctYW1iZXItMTAwIHRleHQtYW1iZXItODAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogb2JzLnN0YXR1cyA9PT0gXCJSRUNUSUZJRURcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiYmctaW5mby1tdXRlZCB0ZXh0LWJsdWUtODAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcImJnLXN1cmZhY2UtcmFpc2VkIHRleHQtdGV4dC1zZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge29icy5zdGF0dXN9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtc2VtaWJvbGQgdGV4dC10ZXh0LW11dGVkXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFt7b2JzLnR5cGUgfHwgXCJNaW5vclwifV0gI3tpZHggKyAxfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtoYXNQZXJtaXNzaW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBQZXJtaXNzaW9uQ29kZS5RVUFMSVRZX09CU0VSVkFUSU9OX0RFTEVURSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZURlbGV0ZU9ic2VydmF0aW9uKG9icy5pZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC10ZXh0LWRpc2FibGVkIGhvdmVyOnRleHQtZXJyb3IgdHJhbnNpdGlvbi1jb2xvcnMgcC0xXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxUcmFzaDIgY2xhc3NOYW1lPVwidy00IGgtNFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBpdGVtcy1lbmRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXRleHQtZGlzYWJsZWRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7bmV3IERhdGUob2JzLmNyZWF0ZWRBdCkudG9Mb2NhbGVTdHJpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YHRleHQtWzEwcHhdICR7YWdlSW5mby5jb2xvcn1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2FnZUluZm8udGV4dH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtdGV4dC1wcmltYXJ5IG10LTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7b2JzLm9ic2VydmF0aW9uVGV4dH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtvYnMucGhvdG9zICYmIG9icy5waG90b3MubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0zIGZsZXggZmxleC13cmFwIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7b2JzLnBob3Rvcy5tYXAoKHVybDogc3RyaW5nLCBwSWR4OiBudW1iZXIpID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e3BJZHh9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaHJlZj17Z2V0RmlsZVVybCh1cmwpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsPVwibm9yZWZlcnJlclwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy0xNiBoLTE2IHJvdW5kZWQtbWQgYm9yZGVyIG92ZXJmbG93LWhpZGRlbiBob3ZlcjpvcGFjaXR5LTgwIHRyYW5zaXRpb24tb3BhY2l0eVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmM9e2dldEZpbGVVcmwodXJsKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsdD1cIk9ic2VydmF0aW9uXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBoLWZ1bGwgb2JqZWN0LWNvdmVyXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICB7b2JzLnN0YXR1cyA9PT0gXCJSRUNUSUZJRURcIiAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC00IHAtMyBiZy1wcmltYXJ5LW11dGVkIGJvcmRlciBib3JkZXItYmx1ZS0xMDAgcm91bmRlZC1sZ1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LWJvbGQgdGV4dC1ibHVlLTkwMCBtYi0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJlY3RpZmljYXRpb24gRGV0YWlscyAoRnJvbSBTaXRlIFRlYW0pOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWJsdWUtODAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtvYnMuY2xvc3VyZVRleHQgfHwgXCJObyByZW1hcmtzIHByb3ZpZGVkLlwifVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7b2JzLmNsb3N1cmVFdmlkZW5jZSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYnMuY2xvc3VyZUV2aWRlbmNlLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtMiBmbGV4IGZsZXgtd3JhcCBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge29icy5jbG9zdXJlRXZpZGVuY2UubWFwKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAodXJsOiBzdHJpbmcsIHBJZHg6IG51bWJlcikgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e3BJZHh9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBocmVmPXtnZXRGaWxlVXJsKHVybCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsPVwibm9yZWZlcnJlclwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LTEyIGgtMTIgcm91bmRlZCBib3JkZXIgYm9yZGVyLWJsdWUtMjAwIG92ZXJmbG93LWhpZGRlblwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGltZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmM9e2dldEZpbGVVcmwodXJsKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWx0PVwiUmVjdGlmaWNhdGlvblwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBoLWZ1bGwgb2JqZWN0LWNvdmVyXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVDbG9zZU9ic2VydmF0aW9uKG9icy5pZCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0xLjUgYmctcHJpbWFyeSB0ZXh0LXdoaXRlIHJvdW5kZWQgdGV4dC14cyBmb250LW1lZGl1bSBob3ZlcjpiZy1wcmltYXJ5LWRhcmsgc2hhZG93LXNtIHRyYW5zaXRpb24tYWxsXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFZlcmlmeSAmIENsb3NlIE9ic2VydmF0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIHsvKiBBZGQgTmV3IE9ic2VydmF0aW9uIEZvcm0gKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1zdXJmYWNlLWNhcmQgcm91bmRlZC14bCBwLTUgc2hhZG93LXNtIGJvcmRlciBib3JkZXItYm9yZGVyLWRlZmF1bHRcIj5cbiAgICAgICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1ncmF5LTgwMCBtYi00IGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgIDxBbGVydENpcmNsZSBjbGFzc05hbWU9XCJ3LTQgaC00IHRleHQtd2FybmluZ1wiIC8+IEFkZCBOZXdcbiAgICAgICAgICAgICAgICAgICAgT2JzZXJ2YXRpb25cbiAgICAgICAgICAgICAgICAgIDwvaDQ+XG5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgZm9udC1tZWRpdW0gdGV4dC10ZXh0LXNlY29uZGFyeSBtYi0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBTZXZlcml0eSBUeXBlXG4gICAgICAgICAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgICA8c2VsZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17b2JzVHlwZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0T2JzVHlwZShlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgc206dy0xLzMgYm9yZGVyLWJvcmRlci1zdHJvbmcgcm91bmRlZC1sZyB0ZXh0LXNtIGZvY3VzOnJpbmctYW1iZXItNTAwIGZvY3VzOmJvcmRlci1hbWJlci01MDBcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJNaW5vclwiPk1pbm9yPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiTWFqb3JcIj5NYWpvcjwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIkNyaXRpY2FsXCI+Q3JpdGljYWw8L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQteHMgZm9udC1tZWRpdW0gdGV4dC10ZXh0LXNlY29uZGFyeSBtYi0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBEZXNjcmlwdGlvblxuICAgICAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgYm9yZGVyLWJvcmRlci1zdHJvbmcgcm91bmRlZC1sZyBwLTMgdGV4dC1zbSBmb2N1czpyaW5nLTIgZm9jdXM6cmluZy1hbWJlci01MDAgZm9jdXM6Ym9yZGVyLWFtYmVyLTUwMCBtaW4taC1bMTAwcHhdXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRGVzY3JpYmUgdGhlIGlzc3VlIHNwZWNpZmljYWxseSBzbyB0aGUgc2l0ZSB0ZWFtIGNhbiBmaXggaXQuLi5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e29ic1RleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldE9ic1RleHQoZS50YXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtdGV4dC1zZWNvbmRhcnkgbWItMS41XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBFdmlkZW5jZSBQaG90b3NcbiAgICAgICAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXdyYXAgZ2FwLTMgaXRlbXMtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7Y3VycmVudFBob3Rvcy5tYXAoKHVybCwgaWR4KSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYga2V5PXtpZHh9IGNsYXNzTmFtZT1cInJlbGF0aXZlIHctMjAgaC0yMCBncm91cFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYz17Z2V0RmlsZVVybCh1cmwpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWx0PVwiUHJldmlld1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgaC1mdWxsIG9iamVjdC1jb3ZlciByb3VuZGVkLWxnIGJvcmRlciBzaGFkb3ctc21cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0Q3VycmVudFBob3RvcygocHJldikgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2LmZpbHRlcigoXywgaSkgPT4gaSAhPT0gaWR4KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYWJzb2x1dGUgLXRvcC0yIC1yaWdodC0yIGJnLWVycm9yIHRleHQtd2hpdGUgcC0xIHJvdW5kZWQtZnVsbCBvcGFjaXR5LTAgZ3JvdXAtaG92ZXI6b3BhY2l0eS0xMDAgdHJhbnNpdGlvbi1vcGFjaXR5IHNoYWRvdy1sZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPFggY2xhc3NOYW1lPVwidy0zIGgtM1wiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgdy0yMCBoLTIwIGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJvcmRlci0yIGJvcmRlci1kYXNoZWQgYm9yZGVyLWJvcmRlci1kZWZhdWx0IHJvdW5kZWQtbGcgaG92ZXI6Ym9yZGVyLWFtYmVyLTQwMCBob3ZlcjpiZy13YXJuaW5nLW11dGVkIHRyYW5zaXRpb24tYWxsIGN1cnNvci1wb2ludGVyICR7dXBsb2FkaW5nID8gXCJvcGFjaXR5LTUwIHBvaW50ZXItZXZlbnRzLW5vbmVcIiA6IFwiXCJ9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPENhbWVyYSBjbGFzc05hbWU9XCJ3LTYgaC02IHRleHQtdGV4dC1kaXNhYmxlZFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIHRleHQtdGV4dC1tdXRlZCBtdC0xIGZvbnQtbWVkaXVtXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3VwbG9hZGluZyA/IFwiVXBsb2FkaW5nLi4uXCIgOiBcIkFkZCBQaG90b1wifVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJmaWxlXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJoaWRkZW5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjY2VwdD1cImltYWdlLypcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtoYW5kbGVGaWxlVXBsb2FkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWVuZCBwdC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlUmFpc2VPYnNlcnZhdGlvbn1cbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtzYXZpbmdPYnMgfHwgIW9ic1RleHQudHJpbSgpIHx8IHVwbG9hZGluZ31cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTYgcHktMiBiZy1hbWJlci02MDAgdGV4dC13aGl0ZSByb3VuZGVkLWxnIHRleHQtc20gZm9udC1zZW1pYm9sZCBob3ZlcjpiZy1hbWJlci03MDAgZGlzYWJsZWQ6b3BhY2l0eS01MCBzaGFkb3ctbWQgdHJhbnNmb3JtIGFjdGl2ZTpzY2FsZS05NSB0cmFuc2l0aW9uLWFsbFwiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAge3NhdmluZ09icyA/IFwiU3VibWl0dGluZy4uLlwiIDogXCJTdWJtaXQgT2JzZXJ2YXRpb25cIn1cbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKX1cbiAgICAgIDwvZGl2PlxuXG4gICAgICB7LyogUmV2ZXJzYWwgTW9kYWwgKi99XG4gICAgICB7c2hvd1JldmVyc2FsTW9kYWwgJiYgaW5zcGVjdGlvbkRldGFpbCAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCBiZy1zdXJmYWNlLW92ZXJsYXkgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcC00IHotNTBcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXN1cmZhY2UtY2FyZCByb3VuZGVkLTN4bCBwLTggbWF4LXctbGcgdy1mdWxsIHNoYWRvdy0yeGwgYW5pbWF0ZS1pbiB6b29tLWluLTk1IGR1cmF0aW9uLTIwMFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBtYi00XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy0xMiBoLTEyIGJnLWFtYmVyLTEwMCByb3VuZGVkLTJ4bCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgIDxBbGVydFRyaWFuZ2xlIGNsYXNzTmFtZT1cInctNiBoLTYgdGV4dC13YXJuaW5nXCIgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQteGwgZm9udC1ib2xkIHRleHQtdGV4dC1wcmltYXJ5XCI+XG4gICAgICAgICAgICAgICAgICBSZXZlcnNlIFJGSSAje2luc3BlY3Rpb25EZXRhaWwuaWR9XG4gICAgICAgICAgICAgICAgPC9oMz5cbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtdGV4dC1tdXRlZFwiPlxuICAgICAgICAgICAgICAgICAge2luc3BlY3Rpb25EZXRhaWwuYWN0aXZpdHk/LmFjdGl2aXR5TmFtZX1cbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdhcm5pbmctbXV0ZWQgYm9yZGVyIGJvcmRlci1hbWJlci0yMDAgcm91bmRlZC14bCBwLTQgbWItNiB0ZXh0LXNtIHRleHQtYW1iZXItODAwXCI+XG4gICAgICAgICAgICAgIDxzdHJvbmc+V2FybmluZzo8L3N0cm9uZz4gUmV2ZXJzaW5nIHdpbGwgY2hhbmdlIHRoZSBzdGF0dXMgdG9cbiAgICAgICAgICAgICAgUkVWRVJTRUQuIFRoZSByYWlzZXIgd2lsbCBiZSBub3RpZmllZC4gQWxsIHNpZ25hdHVyZXMgYXJlXG4gICAgICAgICAgICAgIHByZXNlcnZlZCBmb3IgYXVkaXQuXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LXNtIGZvbnQtYm9sZCB0ZXh0LXRleHQtc2Vjb25kYXJ5IG1iLTFcIj5cbiAgICAgICAgICAgICAgICBSZWFzb24gZm9yIFJldmVyc2FsICpcbiAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgICAgPHRleHRhcmVhXG4gICAgICAgICAgICAgICAgcm93cz17NH1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgYmctc3VyZmFjZS1iYXNlIGJvcmRlciBib3JkZXItYm9yZGVyLWRlZmF1bHQgcm91bmRlZC14bCBwLTQgdGV4dC1zbSBmb2N1czpyaW5nLTIgZm9jdXM6cmluZy1hbWJlci01MDAgb3V0bGluZS1ub25lXCJcbiAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkV4cGxhaW4gd2h5IHRoaXMgYXBwcm92YWwgaXMgYmVpbmcgcmV2ZXJzZWQuLi5cIlxuICAgICAgICAgICAgICAgIHZhbHVlPXtyZXZlcnNhbFJlYXNvbn1cbiAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldFJldmVyc2FsUmVhc29uKGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGdhcC00IG10LTZcIj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgIHNldFNob3dSZXZlcnNhbE1vZGFsKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgIHNldFJldmVyc2FsUmVhc29uKFwiXCIpO1xuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNiBweS0zIHJvdW5kZWQteGwgZm9udC1ib2xkIHRleHQtdGV4dC1zZWNvbmRhcnkgYmctc3VyZmFjZS1yYWlzZWQgaG92ZXI6YmctZ3JheS0yMDAgdHJhbnNpdGlvbi1jb2xvcnMgZmxleC0xXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIENhbmNlbFxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2FzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmICghcmV2ZXJzYWxSZWFzb24udHJpbSgpKSByZXR1cm4gYWxlcnQoXCJSZWFzb24gcmVxdWlyZWRcIik7XG4gICAgICAgICAgICAgICAgICBzZXRSZXZlcnNhbExvYWRpbmcodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBhcGkucG9zdChcbiAgICAgICAgICAgICAgICAgICAgICBgL3F1YWxpdHkvaW5zcGVjdGlvbnMvJHtpbnNwZWN0aW9uRGV0YWlsLmlkfS93b3JrZmxvdy9yZXZlcnNlYCxcbiAgICAgICAgICAgICAgICAgICAgICB7IHJlYXNvbjogcmV2ZXJzYWxSZWFzb24gfSxcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgYWxlcnQoXCJSRkkgcmV2ZXJzZWQuIFJhaXNlciBub3RpZmllZC5cIik7XG4gICAgICAgICAgICAgICAgICAgIHNldFNob3dSZXZlcnNhbE1vZGFsKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgc2V0UmV2ZXJzYWxSZWFzb24oXCJcIik7XG4gICAgICAgICAgICAgICAgICAgIHNldFNlbGVjdGVkSW5zcGVjdGlvbklkKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICBzZXRSZWZyZXNoS2V5KChrKSA9PiBrICsgMSk7XG4gICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICBhbGVydChlcnIucmVzcG9uc2U/LmRhdGE/Lm1lc3NhZ2UgfHwgXCJSZXZlcnNhbCBmYWlsZWQuXCIpO1xuICAgICAgICAgICAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgICAgICAgICAgc2V0UmV2ZXJzYWxMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgIGRpc2FibGVkPXtyZXZlcnNhbExvYWRpbmcgfHwgIXJldmVyc2FsUmVhc29uLnRyaW0oKX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC02IHB5LTMgcm91bmRlZC14bCBmb250LWJvbGQgdGV4dC13aGl0ZSBiZy1hbWJlci02MDAgaG92ZXI6YmctYW1iZXItNzAwIHNoYWRvdy1sZyBzaGFkb3ctYW1iZXItMjAwIHRyYW5zaXRpb24tYWxsIGZsZXgtMSBkaXNhYmxlZDpvcGFjaXR5LTUwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxSb3RhdGVDY3cgY2xhc3NOYW1lPVwidy00IGgtNFwiIC8+XG4gICAgICAgICAgICAgICAge3JldmVyc2FsTG9hZGluZyA/IFwiUmV2ZXJzaW5nLi4uXCIgOiBcIkNvbmZpcm0gUmV2ZXJzYWxcIn1cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuICAgICAgey8qIFNpZ25hdHVyZSBNb2RhbHMgKi99XG4gICAgICA8U2lnbmF0dXJlTW9kYWxcbiAgICAgICAgaXNPcGVuPXtzaG93RmluYWxBcHByb3ZlU2lnfVxuICAgICAgICBvbkNsb3NlPXsoKSA9PiB7XG4gICAgICAgICAgc2V0U2hvd0ZpbmFsQXBwcm92ZVNpZyhmYWxzZSk7XG4gICAgICAgICAgc2V0QWN0aXZlU3RhZ2VJZChudWxsKTtcbiAgICAgICAgfX1cbiAgICAgICAgb25TaWduPXtleGVjdXRlRmluYWxBcHByb3ZlfVxuICAgICAgICB0aXRsZT17YWN0aXZlU3RhZ2VJZCAhPSBudWxsID8gXCJTdGFnZSBBcHByb3ZhbCBTaWduYXR1cmVcIiA6IFwiRmluYWwgQXBwcm92YWwgU2lnbmF0dXJlXCJ9XG4gICAgICAgIGRlc2NyaXB0aW9uPXtcbiAgICAgICAgICBhY3RpdmVTdGFnZUlkICE9IG51bGxcbiAgICAgICAgICAgID8gXCJTaWduIHRvIGFwcHJvdmUgdGhpcyBjaGVja2xpc3Qgc3RhZ2UuXCJcbiAgICAgICAgICAgIDogXCJTaWduIHRvIGdyYW50IGZpbmFsIGFwcHJvdmFsIGZvciB0aGlzIFJGSS5cIlxuICAgICAgICB9XG4gICAgICAvPlxuICAgICAgey8qIERlbGVnYXRpb24gTW9kYWwgKi99XG4gICAgICB7c2hvd0RlbGVnYXRpb25Nb2RhbCAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCBiZy1zdXJmYWNlLW92ZXJsYXkgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgei1bNjBdIHAtNFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctc3VyZmFjZS1jYXJkIHJvdW5kZWQtMnhsIHNoYWRvdy0yeGwgdy1mdWxsIG1heC13LW1kIGZsZXggZmxleC1jb2wgcC02XCI+XG4gICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC14bCBmb250LWJvbGQgdGV4dC10ZXh0LXByaW1hcnkgbWItNCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICA8VXNlckNoZWNrIGNsYXNzTmFtZT1cInctNiBoLTYgdGV4dC1zZWNvbmRhcnlcIiAvPlxuICAgICAgICAgICAgICBEZWxlZ2F0ZSBBcHByb3ZhbCBTdGVwXG4gICAgICAgICAgICA8L2gzPlxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXRleHQtbXV0ZWQgbWItNlwiPlxuICAgICAgICAgICAgICBTZWxlY3QgYSB1c2VyIHRvIGRlbGVnYXRlIHRoaXMgYXBwcm92YWwgc3RlcCB0by4gVGhleSB3aWxsIGJlXG4gICAgICAgICAgICAgIG5vdGlmaWVkIGFuZCBjYW4gYXBwcm92ZSBvbiB5b3VyIGJlaGFsZi5cbiAgICAgICAgICAgIDwvcD5cblxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTQgbWItOFwiPlxuICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiYmxvY2sgdGV4dC14cyBmb250LWJvbGQgdGV4dC10ZXh0LW11dGVkIHVwcGVyY2FzZVwiPlxuICAgICAgICAgICAgICAgIFNlbGVjdCBBcHByb3ZlclxuICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgICA8c2VsZWN0XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIHAtMi41IGJnLXN1cmZhY2UtYmFzZSBib3JkZXIgYm9yZGVyLWJvcmRlci1kZWZhdWx0IHJvdW5kZWQtbGcgdGV4dC1zbSBmb2N1czpyaW5nLTIgZm9jdXM6cmluZy1zZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0U2VsZWN0ZWREZWxlZ2F0ZUlkKE51bWJlcihlLnRhcmdldC52YWx1ZSkpfVxuICAgICAgICAgICAgICAgIHZhbHVlPXtzZWxlY3RlZERlbGVnYXRlSWQgfHwgXCJcIn1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJcIj4tLSBDaG9vc2UgVXNlciAtLTwvb3B0aW9uPlxuICAgICAgICAgICAgICAgIHtlbGlnaWJsZVVzZXJzLm1hcCgodSkgPT4gKFxuICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e3UuaWR9IHZhbHVlPXt1LmlkfT5cbiAgICAgICAgICAgICAgICAgICAge3UubmFtZX0gKHt1LnJvbGV9e3UuY29tcGFueSA/IGAg4oCiICR7dS5jb21wYW55fWAgOiBcIlwifSlcbiAgICAgICAgICAgICAgICAgIDwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZ2FwLTNcIj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dEZWxlZ2F0aW9uTW9kYWwoZmFsc2UpfVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXgtMSBweC00IHB5LTIgYm9yZGVyIGJvcmRlci1ib3JkZXItZGVmYXVsdCByb3VuZGVkLWxnIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC10ZXh0LXNlY29uZGFyeSBob3ZlcjpiZy1zdXJmYWNlLWJhc2VcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgQ2FuY2VsXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlRGVsZWdhdGV9XG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFzZWxlY3RlZERlbGVnYXRlSWQgfHwgZGVsZWdhdGluZ31cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4LTEgcHgtNCBweS0yIGJnLXNlY29uZGFyeSB0ZXh0LXdoaXRlIHJvdW5kZWQtbGcgdGV4dC1zbSBmb250LW1lZGl1bSBob3ZlcjpiZy1zZWNvbmRhcnktZGFyayBkaXNhYmxlZDpvcGFjaXR5LTUwXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHtkZWxlZ2F0aW5nID8gXCJEZWxlZ2F0aW5nLi4uXCIgOiBcIkNvbmZpcm0gRGVsZWdhdGlvblwifVxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG4gICAgPC8+XG4gICk7XG59XG4iXSwiZmlsZSI6Ii9hcHAvZnJvbnRlbmQvc3JjL3ZpZXdzL3F1YWxpdHkvUXVhbGl0eUFwcHJvdmFsc1BhZ2UudHN4In0=
