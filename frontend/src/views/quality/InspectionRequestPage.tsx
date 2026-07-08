import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  AlertCircle,
  Clock,
  ChevronRight,
  FileText,
  ShieldAlert,
  AlertTriangle,
  MessageSquareWarning,
  QrCode,
  X,
} from "lucide-react";
import api from "../../api/axios";
import { getPublicFileUrl } from "../../api/baseUrl";
import { useAuth } from "../../context/AuthContext";
import { PermissionCode } from "../../config/permissions";
import { qualityService } from "../../services/quality.service";
import SignatureModal from "../../components/quality/SignatureModal";
import ClearanceDocumentAttachments from "../../components/quality/ClearanceDocumentAttachments";
import RelatedChecklistTree from "../../components/quality/RelatedChecklistTree";
import RfiAttachmentManager from "../../components/quality/RfiAttachmentManager";
import type {
  QualityInspectionAttachment,
  QualityUnitNode,
  RelatedChecklistOption,
} from "../../types/quality";
import {
  isActivityVisibleForFloorScope,
  resolveFloorScope,
  type FloorVisibilityConfig,
} from "./utils/floorVisibility";

// Reuse types or define local interfaces if shared types file not available
interface Vendor {
  id: number;
  name: string;
}

interface QualityActivity {
  id: number;
  sequence: number;
  activityName: string;
  description: string;
  holdPoint: boolean;
  witnessPoint: boolean;
  allowBreak: boolean;
  applicabilityLevel?: "FLOOR" | "UNIT" | "ROOM";
  requiresPourCard?: boolean;
  requiresPourClearanceCard?: boolean;
  floorVisibility?: FloorVisibilityConfig;
  status: string;
  previousActivityId?: number;
  incomingEdges?: { sourceId: number; source: Partial<QualityActivity> }[];
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
  raisedBy?: ObservationActor | null;
  rectifiedBy?: ObservationActor | null;
  closedByUser?: ObservationActor | null;
  inspectorId?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  closedBy?: string | null;
  closedAt?: string | null;
  rectificationHistory?: Array<{
    type: "RECTIFIED" | "REJECTED";
    text?: string | null;
    photos?: string[];
    rejectionRemarks?: string | null;
    actorId?: string | null;
    at: string;
  }>;
  status: "OPEN" | "PENDING" | "RECTIFIED" | "RESOLVED" | "CLOSED";
  createdAt: string;
}

interface ObservationActor {
  id: number;
  username: string;
  displayName: string;
  designation?: string | null;
}

interface QualityInspection {
  id: number;
  activityId: number;
  epsNodeId: number;
  status:
    | "PENDING"
    | "PARTIALLY_APPROVED"
    | "APPROVED"
    | "REJECTED"
    | "CANCELED";
  requestDate: string;
  inspectionDate?: string;
  comments?: string;
  inspectedBy?: string;
  qualityUnitId?: number;
  qualityRoomId?: number;
  partNo?: number;
  totalParts?: number;
  partLabel?: string;
  goNo?: number;
  goLabel?: string;
  goDetails?: string | null;
  relatedChecklistInspectionIds?: number[];
  relatedChecklistInspections?: Array<{
    id: number;
    activityName: string;
    status: string;
    goLabel?: string | null;
    elementName?: string | null;
    drawingNo?: string | null;
  }>;
  attachments?: QualityInspectionAttachment[];
  unitName?: string | null;
  roomName?: string | null;
  drawingNo?: string;
  elementName?: string | null;
  processCode?: string;
  documentType?: string;
  pendingObservationCount?: number | null;
  legacyActivityObservationCount?: number | null;
  stageApprovalSummary?: {
    approvedStages?: number;
    totalStages?: number;
    pourClearanceTriggerApproved?: boolean;
    pourClearanceTriggerStageName?: string | null;
  };
  cardSummary?: {
    pourCardStatus?: string | null;
    pourCardApproved?: boolean;
    prePourClearanceStatus?: string | null;
    prePourClearanceApproved?: boolean;
  };
}

interface ObservationGroup {
  key: string;
  label: string;
  inspection?: QualityInspection;
  observations: ActivityObservation[];
  isLegacy?: boolean;
}

type ClearanceAttachmentKey =
  | "checklistPccAttached"
  | "checklistWaterproofingAttached"
  | "checklistFormworkAttached"
  | "checklistReinforcementAttached"
  | "checklistMepAttached"
  | "checklistConcretingAttached"
  | "concretePourCardAttached";

const CLEARANCE_ATTACHMENT_OPTIONS: Array<{
  key: ClearanceAttachmentKey;
  label: string;
}> = [
  { key: "checklistPccAttached", label: "PCC Checklist" },
  { key: "checklistWaterproofingAttached", label: "Waterproofing Checklist" },
  { key: "checklistFormworkAttached", label: "Formwork Checklist" },
  { key: "checklistReinforcementAttached", label: "Reinforcement Checklist" },
  { key: "checklistMepAttached", label: "MEP Checklist" },
  { key: "checklistConcretingAttached", label: "Concreting Checklist" },
  { key: "concretePourCardAttached", label: "Concrete Pour Card" },
];

type GoApprovalState =
  | "NOT_STARTED"
  | "RAISED"
  | "PARTIALLY_APPROVED"
  | "FULLY_APPROVED"
  | "REJECTED";

const getGoNumber = (inspection?: QualityInspection | null) =>
  inspection?.goNo || inspection?.partNo || 1;

const getGoApprovalState = (
  inspection?: QualityInspection | null,
): GoApprovalState => {
  if (!inspection) return "NOT_STARTED";
  if (inspection.status === "APPROVED") return "FULLY_APPROVED";
  if (inspection.status === "REJECTED" || inspection.status === "CANCELED") {
    return "REJECTED";
  }
  if (
    inspection.status === "PARTIALLY_APPROVED" ||
    Number(inspection.stageApprovalSummary?.approvedStages || 0) > 0
  ) {
    return "PARTIALLY_APPROVED";
  }
  return "RAISED";
};

const GO_STATE_CONFIG: Record<
  GoApprovalState,
  { label: string; className: string; dotClassName: string }
> = {
  NOT_STARTED: {
    label: "Not started",
    className:
      "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
    dotClassName: "bg-slate-300",
  },
  RAISED: {
    label: "Raised",
    className:
      "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
    dotClassName: "bg-blue-500",
  },
  PARTIALLY_APPROVED: {
    label: "Partially approved",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    dotClassName: "bg-amber-500",
  },
  FULLY_APPROVED: {
    label: "Fully approved",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    dotClassName: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    className: "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
    dotClassName: "bg-red-500",
  },
};

interface ActivityList {
  id: number;
  name: string;
  epsNodeId: number;
}

interface UnitProgress {
  activityId: number;
  floorId: number;
  totalUnits: number;
  raisedUnitIds: number[];
  pendingUnitIds: number[];
  units: Array<{
    id: number;
    name: string;
    latestInspectionStatus: string | null;
    inspectionId: number | null;
  }>;
}

interface EpsNode {
  id: number;
  label: string;
  nodeType?: string;
  type?: string;
  children?: EpsNode[];
}

export default function InspectionRequestPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canUpdateInspection = hasPermission(
    PermissionCode.QUALITY_INSPECTION_UPDATE,
  );
  const canReadPourCard = hasPermission(PermissionCode.QUALITY_POUR_CARD_READ);
  const canUpdatePourCard = hasPermission(
    PermissionCode.QUALITY_POUR_CARD_UPDATE,
  );
  const canSubmitPourCard = hasPermission(
    PermissionCode.QUALITY_POUR_CARD_SUBMIT,
  );
  const canReadPourClearance = hasPermission(
    PermissionCode.QUALITY_POUR_CLEARANCE_READ,
  );
  const canUpdatePourClearance = hasPermission(
    PermissionCode.QUALITY_POUR_CLEARANCE_UPDATE,
  );
  const canSubmitPourClearance = hasPermission(
    PermissionCode.QUALITY_POUR_CLEARANCE_SUBMIT,
  );
  const canSignPourClearance = hasPermission(
    PermissionCode.QUALITY_POUR_CLEARANCE_SIGN,
  );
  const [epsNodes, setEpsNodes] = useState<EpsNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [lists, setLists] = useState<ActivityList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [activities, setActivities] = useState<QualityActivity[]>([]);
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [observationsMap, setObservationsMap] = useState<
    Record<number, ActivityObservation[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Trigger refresh
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>(
    {},
  );

  // Vendor selection for RFI
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [rfiModalActivity, setRfiModalActivity] =
    useState<QualityActivity | null>(null);
  const [drawingNo, setDrawingNo] = useState("");
  const [elementName, setElementName] = useState("");
  const [goDetails, setGoDetails] = useState("");
  const [rfiRequestDate, setRfiRequestDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [rfiDateSettings, setRfiDateSettings] = useState<{
    globalEnabled: boolean;
    projectEnabled: boolean;
    enabled: boolean;
  } | null>(null);
  const [relatedChecklistInspectionIds, setRelatedChecklistInspectionIds] =
    useState<number[]>([]);
  const [relatedChecklistGroups, setRelatedChecklistGroups] = useState<
    RelatedChecklistOption[]
  >([]);
  const [loadingRelatedChecklists, setLoadingRelatedChecklists] =
    useState(false);
  const [rfiAttachments, setRfiAttachments] = useState<
    QualityInspectionAttachment[]
  >([]);
  const [qualityUnits, setQualityUnits] = useState<QualityUnitNode[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [raisingBatch, setRaisingBatch] = useState(false);
  const [expandingGoActivityId, setExpandingGoActivityId] = useState<number | null>(null);
  const [selectedGoByActivity, setSelectedGoByActivity] = useState<
    Record<number, number>
  >({});
  const [quickRaiseConfig, setQuickRaiseConfig] = useState<{
    mode: "NONE" | "GO_SINGLE" | "UNIT_SINGLE" | "UNIT_BATCH";
    partNo?: number;
    totalParts?: number;
    unitId?: number;
  }>({ mode: "NONE" });
  const [unitProgressByActivity, setUnitProgressByActivity] = useState<
    Record<number, UnitProgress>
  >({});
  const [activeCardInspection, setActiveCardInspection] =
    useState<QualityInspection | null>(null);
  const [activeCardKind, setActiveCardKind] = useState<
    "CLEARANCE" | "POUR_CARD" | null
  >(null);
  const [pourCard, setPourCard] = useState<any>(null);
  const [concreteGrades, setConcreteGrades] = useState<any[]>([]);
  const [prePourClearanceCard, setPrePourClearanceCard] = useState<any>(null);
  const [loadingCardModal, setLoadingCardModal] = useState(false);
  const [savingCardModal, setSavingCardModal] = useState(false);
  const [activeClearanceSignoffIndex, setActiveClearanceSignoffIndex] =
    useState<number | null>(null);
  const [showClearanceSignatureModal, setShowClearanceSignatureModal] =
    useState(false);
  const [signatureQrSession, setSignatureQrSession] = useState<any>(null);
  const [generatingSignatureQrIndex, setGeneratingSignatureQrIndex] =
    useState<number | null>(null);

  const updateProjectRfiDateSetting = async (enabled: boolean) => {
    if (!projectId) return;
    try {
      const saved = await qualityService.updateRfiDateSettings(
        Number(projectId),
        enabled,
      );
      setRfiDateSettings(saved);
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          "Failed to update project RFI date setting.",
      );
    }
  };

  // Load active vendors for internal users
  useEffect(() => {
    if (projectId && !user?.isTempUser) {
      api
        .get("/quality/inspections/active-vendors", { params: { projectId } })
        .then((res) => setVendors(res.data));
    }
  }, [projectId, user]);

  useEffect(() => {
    if (!projectId) return;
    qualityService
      .getConcreteGrades(Number(projectId))
      .then((grades) => setConcreteGrades(grades.filter((grade: any) => grade.isActive)))
      .catch(() => setConcreteGrades([]));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    qualityService
      .getRfiDateSettings(Number(projectId))
      .then(setRfiDateSettings)
      .catch(() => setRfiDateSettings(null));
  }, [projectId]);

  // Helper for correct image URLs.
  // Strips the /api suffix from VITE_API_URL so uploads (served at the server
  // root) are resolved correctly even if the API URL includes /api.
  const getFileUrl = (path: string) => {
    return getPublicFileUrl(path);
  };

  const openCardModal = async (
    inspection: QualityInspection,
    kind: "CLEARANCE" | "POUR_CARD",
    requiresPourClearance = false,
  ) => {
    if (
      (kind === "CLEARANCE" && !canReadPourClearance) ||
      (kind === "POUR_CARD" && !canReadPourCard)
    ) {
      alert("You do not have permission to view this document.");
      return;
    }
    if (
      kind === "CLEARANCE" &&
      !inspection.stageApprovalSummary?.pourClearanceTriggerApproved
    ) {
      alert(
        `Pour clearance will open only after ${
          inspection.stageApprovalSummary?.pourClearanceTriggerStageName ||
          "the configured trigger stage"
        } is approved.`,
      );
      return;
    }
    if (
      kind === "POUR_CARD" &&
      requiresPourClearance &&
      !inspection.cardSummary?.prePourClearanceApproved
    ) {
      alert("Concrete pour card will open only after pour clearance approval.");
      return;
    }
    setActiveCardInspection(inspection);
    setActiveCardKind(kind);
    setLoadingCardModal(true);
    try {
      if (kind === "CLEARANCE") {
        const card = await qualityService.getPrePourClearanceCard(inspection.id);
        setPrePourClearanceCard(card);
      } else {
        const card = await qualityService.getPourCard(inspection.id);
        setPourCard(card);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to load card.");
      setActiveCardInspection(null);
      setActiveCardKind(null);
    } finally {
      setLoadingCardModal(false);
    }
  };

  const updatePrePourClearanceCard = (updater: (prev: any) => any) => {
    setPrePourClearanceCard((prev: any) => (prev ? updater(prev) : prev));
  };

  const applyClearanceSignoffSignature = (
    signatureData: string,
    reuseExisting?: boolean,
    evidence?: Record<string, unknown>,
  ) => {
    if (activeClearanceSignoffIndex == null) return;
    const signedAt = new Date().toISOString();
    updatePrePourClearanceCard((prev) => ({
      ...prev,
      signoffs: (prev.signoffs || []).map((row: any, rowIndex: number) =>
        rowIndex === activeClearanceSignoffIndex
          ? {
              ...row,
              status: "SIGNED",
              signedDate: signedAt.slice(0, 10),
              signatureData,
              signatureMode: reuseExisting ? "SAVED_PROFILE" : "DRAWN_NOW",
              signedAt,
              signedByUserId: user?.id ?? null,
              signerUsername: user?.username ?? null,
              signerDisplayName: user?.displayName || user?.username || null,
              signerDesignation: user?.designation || null,
              signerRoles: user?.roles || [],
              personName:
                row.personName || user?.displayName || user?.username || null,
              signatureEvidence: {
                ...(evidence || {}),
                signedAt,
                signerDesignation: user?.designation || null,
                meaning:
                  "I have reviewed and signed this pre-pour clearance responsibility.",
              },
            }
          : row,
      ),
    }));
    setShowClearanceSignatureModal(false);
    setActiveClearanceSignoffIndex(null);
  };

  const generateClearanceSignoffQr = async (idx: number) => {
    if (!activeCardInspection?.id || !prePourClearanceCard) return;
    const signoff = prePourClearanceCard.signoffs?.[idx];
    if (!signoff?.id) {
      alert("Save the pour clearance card before generating QR.");
      return;
    }
    setGeneratingSignatureQrIndex(idx);
    try {
      const session = await qualityService.createPrePourClearanceSignatureQr(
        activeCardInspection.id,
        signoff.id,
      );
      setSignatureQrSession({ ...session, signoffIndex: idx });
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to generate signature QR.");
    } finally {
      setGeneratingSignatureQrIndex(null);
    }
  };

  useEffect(() => {
    if (!signatureQrSession || !activeCardInspection?.id) return;
    const interval = window.setInterval(async () => {
      try {
        const latest = await qualityService.getPrePourClearanceCard(
          activeCardInspection.id,
        );
        const row = latest.signoffs?.[signatureQrSession.signoffIndex];
        setPrePourClearanceCard(latest);
        if (row?.status === "SIGNED" && row?.signatureData) {
          setSignatureQrSession(null);
          alert("Mobile signature captured.");
        }
      } catch {
        // Keep the QR visible until the user closes it or the session expires.
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [signatureQrSession, activeCardInspection?.id]);

  const floorChecklistAttachmentOptions = useMemo(() => {
    const active = activeCardInspection;
    if (!active) return [];

    const sameFloorInspections = inspections.filter((inspection) => {
      if (inspection.id === active.id) return false;
      if (active.qualityUnitId || inspection.qualityUnitId) {
        return active.qualityUnitId === inspection.qualityUnitId;
      }
      if (active.qualityRoomId || inspection.qualityRoomId) {
        return active.qualityRoomId === inspection.qualityRoomId;
      }
      return true;
    });

    return sameFloorInspections
      .filter(
        (inspection) =>
          ["APPROVED", "PARTIALLY_APPROVED"].includes(inspection.status) ||
          Boolean(inspection.stageApprovalSummary?.approvedStages),
      )
      .map((inspection) => {
        const activityName =
          activities.find((activity) => activity.id === inspection.activityId)
            ?.activityName || `Checklist RFI #${inspection.id}`;
        const goName =
          inspection.goLabel ||
          inspection.partLabel?.replace(/^Part/i, "GO") ||
          (inspection.goNo ? `GO ${inspection.goNo}` : "");
        const elementLabel = inspection.elementName
          ? `Element ${inspection.elementName}`
          : "";
        const scopeBits = [
          goName,
          inspection.unitName,
          inspection.roomName,
          inspection.drawingNo ? `Dwg ${inspection.drawingNo}` : "",
          elementLabel,
        ].filter(Boolean);
        const descriptionBits = [
          activityName,
          inspection.goDetails,
          inspection.drawingNo ? `Drawing ${inspection.drawingNo}` : "",
          `RFI #${inspection.id}`,
        ].filter(Boolean);
        return {
          id: inspection.id,
          label: [goName, elementLabel, `RFI #${inspection.id}`]
            .filter(Boolean)
            .join(" · "),
          status:
            inspection.status === "APPROVED"
              ? "Approved"
              : `Partially Approved${
                  inspection.stageApprovalSummary?.approvedStages &&
                  inspection.stageApprovalSummary?.totalStages
                    ? ` (${inspection.stageApprovalSummary.approvedStages}/${inspection.stageApprovalSummary.totalStages})`
                    : ""
                }`,
          scope: scopeBits.join(" · "),
          tooltip: descriptionBits.join(" · "),
        };
      });
  }, [activeCardInspection, activities, inspections]);

  const saveActiveCard = async () => {
    if (!activeCardInspection) return;
    setSavingCardModal(true);
    try {
      if (activeCardKind === "CLEARANCE") {
        const saved = await qualityService.savePrePourClearanceCard(
          activeCardInspection.id,
          prePourClearanceCard,
        );
        setPrePourClearanceCard(saved);
        alert("Pour clearance saved.");
      } else {
        const saved = await qualityService.savePourCard(
          activeCardInspection.id,
          pourCard,
        );
        setPourCard(saved);
        alert("Pour card saved.");
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to save card.");
    } finally {
      setSavingCardModal(false);
    }
  };

  const submitActiveCard = async () => {
    if (!activeCardInspection) return;
    setSavingCardModal(true);
    try {
      if (activeCardKind === "CLEARANCE") {
        const draft = await qualityService.savePrePourClearanceCard(
          activeCardInspection.id,
          prePourClearanceCard,
        );
        setPrePourClearanceCard(draft);
        const saved = await qualityService.submitPrePourClearanceCard(
          activeCardInspection.id,
        );
        setPrePourClearanceCard(saved);
        alert("Pour clearance sent for QA/QC approval.");
      } else {
        const saved = await qualityService.submitPourCard(activeCardInspection.id);
        setPourCard(saved);
        alert("Pour card sent for QA/QC approval.");
      }
      setRefreshKey((key) => key + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to submit card.");
    } finally {
      setSavingCardModal(false);
    }
  };

  const downloadActiveCardPdf = async () => {
    if (!activeCardInspection) return;
    const blob =
      activeCardKind === "CLEARANCE"
        ? await qualityService.downloadPrePourClearancePdf(activeCardInspection.id)
        : await qualityService.downloadPourCardPdf(activeCardInspection.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      activeCardKind === "CLEARANCE"
        ? `Pour_Clearance_${activeCardInspection.id}.pdf`
        : `Pour_Card_${activeCardInspection.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Load EPS Structure
  useEffect(() => {
    if (projectId) {
      // Corrected endpoint from /eps/project/:id/tree to /eps/:id/tree
      api.get(`/eps/${projectId}/tree`).then((res) => setEpsNodes(res.data));
    }
  }, [projectId]);

  // Load Lists when Node selected
  useEffect(() => {
    if (projectId && selectedNodeId) {
      api
        .get("/quality/activity-lists", {
          params: { projectId, epsNodeId: selectedNodeId },
        })
        .then((res) => {
          setLists(res.data);
          if (res.data.length > 0) setSelectedListId(res.data[0].id);
          else setSelectedListId(null);
        });
    }
  }, [projectId, selectedNodeId]);

  // Load Activities & Inspections
  useEffect(() => {
    if (selectedListId && selectedNodeId) {
      setLoading(true);
      Promise.allSettled([
        api.get(`/quality/activity-lists/${selectedListId}`),
        api.get(`/quality/activity-lists/${selectedListId}/activities`),
        api.get("/quality/inspections", {
          params: {
            projectId,
            epsNodeId: selectedNodeId,
            listId: selectedListId,
          },
        }),
      ])
        .then(async ([listRes, actRes, inspRes]) => {
          const listData =
            listRes.status === "fulfilled" ? listRes.value.data : null;
          const actsData =
            actRes.status === "fulfilled" ? actRes.value.data : [];
          const inspectionsData =
            inspRes.status === "fulfilled" ? inspRes.value.data : [];

          const acts =
            Array.isArray(actsData) && actsData.length > 0
              ? (actsData as QualityActivity[])
              : Array.isArray(listData?.activities)
                ? (listData.activities as QualityActivity[])
                : [];
          const inspectionRows = Array.isArray(inspectionsData)
            ? (inspectionsData as QualityInspection[])
            : [];
          setActivities(acts);
          setInspections(inspectionRows);

          if (
            listRes.status === "rejected" ||
            actRes.status === "rejected" ||
            inspRes.status === "rejected"
          ) {
            console.error("Partial inspection request load failure", {
              list: listRes.status === "rejected" ? listRes.reason : null,
              activities: actRes.status === "rejected" ? actRes.reason : null,
              inspections: inspRes.status === "rejected" ? inspRes.reason : null,
            });
          }

          // Fetch only the observations that belong to RFIs raised for the
          // currently selected scope. Shared activity templates must not leak
          // observations across floor / unit / GO boundaries.
          const obsPromises = inspectionRows
            .filter((inspection) => (inspection.pendingObservationCount || 0) > 0)
            .map((inspection) =>
              api
                .get(`/quality/activities/${inspection.activityId}/observations`, {
                  params: { inspectionId: inspection.id },
                })
                .then((res) => ({
                  activityId: inspection.activityId,
                  inspectionId: inspection.id,
                  obs: res.data as ActivityObservation[],
                })),
            );

          Promise.all(obsPromises)
            .then((results) => {
              const oMap: Record<number, ActivityObservation[]> = {};
              results.forEach((r) => {
                oMap[r.activityId] = [...(oMap[r.activityId] || []), ...r.obs];
              });
              setObservationsMap(oMap);
            })
            .catch((err) => console.error("Failed to load observations", err));

          const unitActs = acts.filter((a) => a.applicabilityLevel === "UNIT");
          if (unitActs.length > 0) {
            const progressRows = await Promise.all(
              unitActs.map(async (a) => {
                try {
                  const res = await api.get(
                    "/quality/inspections/unit-progress",
                    {
                      params: {
                        projectId,
                        epsNodeId: selectedNodeId,
                        activityId: a.id,
                      },
                    },
                  );
                  return { activityId: a.id, data: res.data as UnitProgress };
                } catch {
                  return null;
                }
              }),
            );
            const map: Record<number, UnitProgress> = {};
            for (const row of progressRows) {
              if (!row) continue;
              map[row.activityId] = row.data;
            }
            setUnitProgressByActivity(map);
          } else {
            setUnitProgressByActivity({});
          }
        })
        .finally(() => setLoading(false));
    } else {
      setActivities([]);
      setInspections([]);
      setObservationsMap({});
      setUnitProgressByActivity({});
    }
  }, [selectedListId, selectedNodeId, projectId, refreshKey]);

  const selectedFloorScope = useMemo(
    () => resolveFloorScope(epsNodes as any, selectedNodeId),
    [epsNodes, selectedNodeId],
  );

  const visibleActivities = useMemo(
    () =>
      activities.filter((activity) =>
        isActivityVisibleForFloorScope(
          activity.floorVisibility || null,
          selectedFloorScope,
        ),
      ),
    [activities, selectedFloorScope],
  );

  const hiddenActivityCount = Math.max(
    0,
    activities.length - visibleActivities.length,
  );

  // Logic to determine status of each activity
  const activityRows = useMemo(() => {
    // Map inspections by activityId and selected GO. Inspections are ordered
    // latest-first by backend, so the first row remains the fallback.
    const inspMap = new Map<number, QualityInspection[]>();
    const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
    const visibleActivityIds = new Set(visibleActivities.map((activity) => activity.id));
    // Inspections are ordered by date desc from backend, so first one is latest
    inspections.forEach((i) => {
      inspMap.set(i.activityId, [...(inspMap.get(i.activityId) || []), i]);
    });

    // Compute status
    return visibleActivities.map((act) => {
      const activityInspections = inspMap.get(act.id) || [];
      const selectedGoNo = selectedGoByActivity[act.id];
      const insp = selectedGoNo
        ? activityInspections.find(
            (inspection) => getGoNumber(inspection) === selectedGoNo,
          ) || activityInspections[0]
        : activityInspections[0];
      const hasUnresolvedObservations =
        (observationsMap[act.id] || []).some((obs) => obs.status !== "CLOSED") ||
        inspections.some(
          (inspection) =>
            inspection.activityId === act.id && (inspection.pendingObservationCount || 0) > 0,
        );
      let state:
        | "LOCKED"
        | "READY"
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "PENDING_OBSERVATION" = "LOCKED";

      // Check predecessors (Multi-dependency support)
      let predecessorDone = true;

      // Check edges if available
      if (act.incomingEdges && act.incomingEdges.length > 0) {
        for (const edge of act.incomingEdges) {
          if (!visibleActivityIds.has(edge.sourceId)) {
            continue;
          }
          const prevInsp = inspMap.get(edge.sourceId)?.[0];
          if (!prevInsp || prevInsp.status !== "APPROVED") {
            predecessorDone = false;
            break;
          }
        }
      }
      // Fallback for legacy data/cache
      else if (act.previousActivityId) {
        const previousActivity = activityMap.get(act.previousActivityId);
        const previousVisible =
          previousActivity &&
          isActivityVisibleForFloorScope(
            previousActivity.floorVisibility || null,
            selectedFloorScope,
          );
        if (previousVisible) {
          const prevInsp = inspMap.get(act.previousActivityId)?.[0];
          if (!prevInsp || prevInsp.status !== "APPROVED") {
            predecessorDone = false;
          }
        }
      }

      if (hasUnresolvedObservations) {
        state = "PENDING_OBSERVATION" as any;
      } else if (insp) {
        state = insp.status as any;
      } else {
        if (predecessorDone || act.allowBreak) state = "READY";
        else state = "LOCKED";
      }

      return { ...act, inspection: insp, statusState: state, predecessorDone };
    });
  }, [
    activities,
    visibleActivities,
    inspections,
    observationsMap,
    selectedFloorScope,
    selectedGoByActivity,
  ]);

  const inspectionsById = useMemo(
    () => new Map(inspections.map((inspection) => [inspection.id, inspection])),
    [inspections],
  );

  const hasActiveFloorGo = (activityId: number, applicabilityLevel?: string) =>
    applicabilityLevel === "FLOOR" &&
    (partProgressByActivity[activityId]?.existingPartNos.length || 0) > 0;

  const getObservationScopeLabel = (inspection?: QualityInspection) => {
    if (!inspection) {
      return "RFI observation";
    }

    const bits = [
      inspection.goLabel || inspection.partLabel,
      inspection.unitName,
      inspection.roomName,
    ].filter(Boolean);

    if (bits.length > 0) {
      return bits.join(" â€¢ ");
    }

    return `RFI #${inspection.id}`;
  };

  const observationGroupsByActivity = useMemo(() => {
    const groups: Record<number, ObservationGroup[]> = {};

    Object.entries(observationsMap).forEach(([activityIdKey, list]) => {
      const activityId = Number(activityIdKey);
      const grouped = new Map<string, ObservationGroup>();

      list.forEach((observation) => {
        if (typeof observation.inspectionId !== "number") {
          return;
        }
        const inspection = inspectionsById.get(observation.inspectionId);
        const groupKey = `inspection-${observation.inspectionId}`;
        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, {
            key: groupKey,
            label: getObservationScopeLabel(inspection),
            inspection,
            observations: [],
          });
        }
        grouped.get(groupKey)!.observations.push(observation);
      });

      groups[activityId] = Array.from(grouped.values()).sort((a, b) => {
        if (a.isLegacy) return 1;
        if (b.isLegacy) return -1;
        const aTime = a.observations[0]?.createdAt
          ? new Date(a.observations[0].createdAt).getTime()
          : 0;
        const bTime = b.observations[0]?.createdAt
          ? new Date(b.observations[0].createdAt).getTime()
          : 0;
        return bTime - aTime;
      });
    });

    return groups;
  }, [observationsMap, inspectionsById]);

  const partProgressByActivity = useMemo(() => {
    const map: Record<
      number,
      { totalParts: number; existingPartNos: number[] }
    > = {};
    const latestByActivityAndGo = new Map<string, QualityInspection>();
    for (const insp of inspections) {
      const aid = insp.activityId;
      const partNo = insp.partNo || 1;
      const totalParts = Math.max(1, insp.totalParts || 1);
      if (!map[aid]) {
        map[aid] = { totalParts, existingPartNos: [] };
      }
      map[aid].totalParts = Math.max(map[aid].totalParts, totalParts);
      const scopeKey = `${aid}:${partNo}`;
      if (!latestByActivityAndGo.has(scopeKey)) {
        latestByActivityAndGo.set(scopeKey, insp);
      }
    }
    for (const insp of latestByActivityAndGo.values()) {
      if (insp.status === "REJECTED" || insp.status === "CANCELED") {
        continue;
      }
      const aid = insp.activityId;
      const partNo = insp.partNo || 1;
      if (!map[aid].existingPartNos.includes(partNo)) {
        map[aid].existingPartNos.push(partNo);
      }
    }
    Object.values(map).forEach((v) => v.existingPartNos.sort((a, b) => a - b));
    return map;
  }, [inspections]);

  const buildInspectionRequestPayload = (
    activity: QualityActivity,
    extra: Record<string, unknown> = {},
  ) => ({
    projectId: Number(projectId),
    epsNodeId: selectedNodeId,
    listId: selectedListId,
    activityId: activity.id,
    processCode: "QA_QC_APPROVAL",
    drawingNo: drawingNo.trim(),
    elementName: elementName.trim() || undefined,
    documentType:
      activity.applicabilityLevel === "ROOM"
        ? "ROOM_RFI"
        : activity.applicabilityLevel === "UNIT"
          ? "UNIT_RFI"
          : "FLOOR_RFI",
    goDetails: goDetails.trim() || undefined,
    relatedChecklistInspectionIds,
    attachmentDraftIds: rfiAttachments.map((attachment) => attachment.id),
    ...(rfiDateSettings?.enabled ? { requestDate: rfiRequestDate } : {}),
    ...extra,
  });

  const findNodeById = (nodes: EpsNode[], id: number): EpsNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const getNodeType = (node: EpsNode | null | undefined): string | undefined =>
    node?.nodeType || node?.type;

  const handleRaiseRFI = async (activity: QualityActivity) => {
    if (!selectedNodeId) return;

    if (!user?.isTempUser && !selectedVendorId) {
      alert("Please select a vendor before raising an RFI.");
      return;
    }

    const node = findNodeById(epsNodes, selectedNodeId);
    const nodeType = getNodeType(node);
    if (nodeType && !["FLOOR", "UNIT", "ROOM"].includes(nodeType)) {
      alert(
        "RFIs can only be raised at the FLOOR, UNIT, or ROOM level. Please drill down to a more specific location.",
      );
      return;
    }

    if (
      nodeType &&
      activity.applicabilityLevel &&
      nodeType !== activity.applicabilityLevel
    ) {
      alert(
        `This activity is ${activity.applicabilityLevel} level. Please select a ${activity.applicabilityLevel} node.`,
      );
      return;
    }

    if (
      !confirm(`Raise Request for Inspection for "${activity.activityName}"?`)
    )
      return;
    try {
      await api.post(
        "/quality/inspections",
        buildInspectionRequestPayload(activity, {
          qualityUnitId: undefined,
          comments: "Requested via Web",
          vendorId: selectedVendorId,
        }),
      );
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to raise RFI");
    }
  };

  const raiseRfiPart = async (
    activity: QualityActivity,
    partNo: number,
    totalParts: number,
  ) => {
    if (!selectedNodeId) return;
    if (!user?.isTempUser && !selectedVendorId) {
      alert("Please select a vendor before raising an RFI.");
      return;
    }
    try {
      await api.post(
        "/quality/inspections",
        buildInspectionRequestPayload(activity, {
          partNo,
          totalParts,
          partLabel: totalParts > 1 ? `GO ${partNo}` : "GO 1",
          goNo: partNo,
          goLabel: `GO ${partNo}`,
          comments:
            totalParts > 1
              ? `Requested via Web (GO ${partNo}/${totalParts})`
              : "Requested via Web",
          vendorId: selectedVendorId,
        }),
      );
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to raise RFI");
    }
  };

  const raiseUnitRfiFromProgress = async (
    activity: QualityActivity,
    unitId: number,
  ) => {
    if (!selectedNodeId) return;
    if (!user?.isTempUser && !selectedVendorId) {
      alert("Please select a vendor before raising an RFI.");
      return;
    }
    try {
      await api.post(
        "/quality/inspections",
        buildInspectionRequestPayload(activity, {
          qualityUnitId: unitId,
          comments: "Requested via Web",
          vendorId: selectedVendorId,
        }),
      );
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to raise unit RFI");
    }
  };

  const raiseAllPendingUnitRfis = async (activity: QualityActivity) => {
    const progress = unitProgressByActivity[activity.id];
    if (!progress || progress.pendingUnitIds.length === 0) return;
    if (!selectedNodeId) return;
    if (!user?.isTempUser && !selectedVendorId) {
      alert("Please select a vendor before raising an RFI.");
      return;
    }

    setRaisingBatch(true);
    try {
      for (const unitId of progress.pendingUnitIds) {
        await api.post(
          "/quality/inspections",
          buildInspectionRequestPayload(activity, {
            qualityUnitId: unitId,
            comments: "Requested via Web",
            vendorId: selectedVendorId,
          }),
        );
      }
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to raise pending unit RFIs");
    } finally {
      setRaisingBatch(false);
    }
  };

  const openRaiseRfiFlow = async (
    activity: QualityActivity,
    quickConfig?: {
      mode: "GO_SINGLE" | "UNIT_SINGLE" | "UNIT_BATCH";
      partNo?: number;
      totalParts?: number;
      unitId?: number;
    },
  ) => {
    if (!selectedNodeId) return;
    const node = findNodeById(epsNodes, selectedNodeId);
    const nodeType = getNodeType(node);
    if (!nodeType) return;

    if (activity.applicabilityLevel === "UNIT") {
      if (nodeType !== "FLOOR") {
        alert("For unit-level activities, select a FLOOR node first.");
        return;
      }
      try {
        const floorStructure = await qualityService.getFloorStructure(
          Number(projectId),
          selectedNodeId,
        );
        setQualityUnits(floorStructure.units || []);
        if (quickConfig?.mode === "UNIT_SINGLE" && quickConfig.unitId) {
          setSelectedUnitIds([quickConfig.unitId]);
        } else if (quickConfig?.mode === "UNIT_BATCH") {
          setSelectedUnitIds(
            unitProgressByActivity[activity.id]?.pendingUnitIds || [],
          );
        } else {
          setSelectedUnitIds([]);
        }
      } catch {
        setQualityUnits([]);
        setSelectedUnitIds([]);
      }
    } else {
      setQualityUnits([]);
      setSelectedUnitIds([]);
    }

    setDrawingNo("");
    setElementName("");
    setGoDetails("");
    setRfiRequestDate(new Date().toISOString().slice(0, 10));
    setRelatedChecklistInspectionIds([]);
    setRfiAttachments([]);
    setLoadingRelatedChecklists(true);
    try {
      setRelatedChecklistGroups(
        await qualityService.getRelatedChecklistOptions(
          Number(projectId),
          selectedNodeId,
        ),
      );
    } catch {
      setRelatedChecklistGroups([]);
    } finally {
      setLoadingRelatedChecklists(false);
    }
    setQuickRaiseConfig(quickConfig || { mode: "NONE" });
    setRfiModalActivity(activity);
  };

  const handleExpandGoCount = async (activity: QualityActivity) => {
    if (!selectedNodeId || !projectId) return;
    const progress = partProgressByActivity[activity.id];
    if (!progress) {
      alert("Raise the first GO before expanding the GO count.");
      return;
    }

    setExpandingGoActivityId(activity.id);
    try {
      const result = await qualityService.addInspectionGo({
        projectId: Number(projectId),
        epsNodeId: selectedNodeId,
        activityId: activity.id,
      });
      alert(`${result.nextGoLabel} is ready to raise.`);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to expand GO count");
    } finally {
      setExpandingGoActivityId(null);
    }
  };

  const submitRfiFlow = async () => {
    if (!rfiModalActivity || !selectedNodeId) return;
    if (!drawingNo.trim()) {
      alert("Please enter the drawing number before raising the RFI.");
      return;
    }
    if (
      (rfiModalActivity.requiresPourCard ||
        rfiModalActivity.requiresPourClearanceCard) &&
      !elementName.trim()
    ) {
      alert("Please enter the element name before raising the RFI.");
      return;
    }

    if (!user?.isTempUser && !selectedVendorId) {
      alert("Please select a vendor before raising an RFI.");
      return;
    }

    const node = findNodeById(epsNodes, selectedNodeId);
    const nodeType = getNodeType(node);
    if (!nodeType) return;
    if (
      rfiAttachments.length > 0 &&
      (quickRaiseConfig.mode === "UNIT_BATCH" ||
        (rfiModalActivity.applicabilityLevel === "UNIT" &&
          selectedUnitIds.length > 1))
    ) {
      alert(
        "Attachments must be submitted against one RFI at a time. Select a single unit for this evidence.",
      );
      return;
    }

    setRaisingBatch(true);
    try {
      if (quickRaiseConfig.mode === "GO_SINGLE" && quickRaiseConfig.partNo) {
        await raiseRfiPart(
          rfiModalActivity,
          quickRaiseConfig.partNo,
          quickRaiseConfig.totalParts || quickRaiseConfig.partNo,
        );
      } else if (
        quickRaiseConfig.mode === "UNIT_SINGLE" &&
        quickRaiseConfig.unitId
      ) {
        await raiseUnitRfiFromProgress(rfiModalActivity, quickRaiseConfig.unitId);
      } else if (quickRaiseConfig.mode === "UNIT_BATCH") {
        await raiseAllPendingUnitRfis(rfiModalActivity);
      } else if (rfiModalActivity.applicabilityLevel === "FLOOR") {
        const firstPartNo = 1;
        await api.post(
          "/quality/inspections",
          buildInspectionRequestPayload(rfiModalActivity, {
            partNo: firstPartNo,
            totalParts: 1,
            partLabel: "GO 1",
            goNo: firstPartNo,
            goLabel: `GO ${firstPartNo}`,
            comments: "Requested via Web (GO 1)",
            vendorId: selectedVendorId,
          }),
        );
      } else if (rfiModalActivity.applicabilityLevel === "UNIT") {
        if (selectedUnitIds.length === 0) {
          alert("Select at least one unit.");
          return;
        }
        for (const unitId of selectedUnitIds) {
          await api.post(
            "/quality/inspections",
            buildInspectionRequestPayload(rfiModalActivity, {
              qualityUnitId: unitId,
              comments: "Requested via Web",
              vendorId: selectedVendorId,
            }),
          );
        }
      } else {
        await handleRaiseRFI(rfiModalActivity);
      }

      setRfiModalActivity(null);
      setQuickRaiseConfig({ mode: "NONE" });
      setGoDetails("");
      setRelatedChecklistInspectionIds([]);
      setRelatedChecklistGroups([]);
      setRfiAttachments([]);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to raise RFI");
    } finally {
      setRaisingBatch(false);
    }
  };

  // Helper for Status Badge
  const StatusBadge = ({ state }: { state: string }) => {
    switch (state) {
      case "APPROVED":
        return (
          <span className="flex items-center gap-1 text-success bg-success-muted px-2 py-1 rounded-full text-xs font-medium">
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="flex items-center gap-1 text-error bg-error-muted px-2 py-1 rounded-full text-xs font-medium">
            Rejected
          </span>
        );
      case "PENDING":
        return (
          <span className="flex items-center gap-1 text-warning bg-warning-muted px-2 py-1 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" /> QC Pending
          </span>
        );
      case "PENDING_OBSERVATION":
        return (
          <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-rose-200">
            <MessageSquareWarning className="w-3 h-3" /> Fix Observation
          </span>
        );
      case "READY":
        return (
          <span className="flex items-center gap-1 text-primary bg-primary-muted px-2 py-1 rounded-full text-xs font-medium">
            Ready to Request
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-text-disabled bg-surface-raised px-2 py-1 rounded-full text-xs font-medium">
            Locked
          </span>
        );
    }
  };

  // Recursive EPS Renderer
  const renderTree = (nodes: EpsNode[], depth = 0) => (
    <ul className="space-y-1">
      {nodes.map((node) => {
        const isExpanded = !!expandedNodes[node.id];
        return (
          <li key={node.id}>
            <div
              onClick={() => setSelectedNodeId(node.id)}
              className={`flex items-center px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${selectedNodeId === node.id ? "bg-secondary-muted text-indigo-700 font-medium" : "text-text-secondary hover:bg-surface-base"}`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {node.children?.length ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedNodes((prev) => ({
                      ...prev,
                      [node.id]: !prev[node.id],
                    }));
                  }}
                  className="p-1 hover:bg-gray-200 rounded mr-1"
                >
                  <ChevronRight
                    className={`w-3 h-3 text-text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <span className="w-5 mr-1" />
              )}
              {node.label}
            </div>
            {node.children &&
              isExpanded &&
              renderTree(node.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="h-full flex flex-col bg-surface-base">
      {/* Header */}
      <header className="bg-surface-card border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-secondary" />
            Quality Requests
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Raise and track Requests for Inspection (RFI) before they move into
            QA/QC Approvals.
          </p>
        </div>
        {rfiDateSettings && (
          <div className="flex max-w-sm items-center gap-3 rounded-lg border border-border-default bg-surface-base px-3 py-2">
            <div className="text-right">
              <div className="text-xs font-semibold text-text-secondary">
                Manual RFI Dates
              </div>
              <div className="text-[11px] text-text-muted">
                {rfiDateSettings.globalEnabled
                  ? rfiDateSettings.enabled
                    ? "Enabled for this project"
                    : "Disabled for this project"
                  : "Disabled globally in Admin Settings"}
              </div>
            </div>
            {canUpdateInspection ? (
              <button
                type="button"
                onClick={() =>
                  updateProjectRfiDateSetting(!rfiDateSettings.projectEnabled)
                }
                disabled={!rfiDateSettings.globalEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  rfiDateSettings.projectEnabled
                    ? "bg-secondary"
                    : "bg-gray-300"
                }`}
                title={
                  rfiDateSettings.globalEnabled
                    ? "Enable or disable manual request/approval dates for this project"
                    : "Enable QUALITY_RFI_BACKDATING_ENABLED in Admin Settings first"
                }
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rfiDateSettings.projectEnabled
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            ) : null}
          </div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Location & List Selector */}
        <aside className="w-80 bg-surface-card border-r flex flex-col">
          <div className="p-4 border-b bg-surface-base">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
              1. Select Location
            </h3>
            <div className="h-[40vh] overflow-y-auto border rounded-lg bg-surface-card p-2">
              {/* Simple Tree View */}
              {epsNodes.length ? (
                renderTree(epsNodes)
              ) : (
                <div className="p-4 text-sm text-text-disabled text-center">
                  Loading Data...
                </div>
              )}
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
              2. Select Checklist
            </h3>
            {selectedNodeId ? (
              <div className="space-y-2">
                {lists.length === 0 && (
                  <p className="text-sm text-text-disabled italic">
                    No checklists found for this location.
                  </p>
                )}
                {lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setSelectedListId(list.id)}
                    className={`w-full text-left px-3 py-3 rounded-lg border transition-all ${selectedListId === list.id ? "border-secondary bg-secondary-muted ring-1 ring-secondary/20" : "border-border-default hover:border-indigo-300 hover:shadow-sm"}`}
                  >
                    <div className="font-medium text-text-primary text-sm">
                      {list.name}
                    </div>
                    <div className="text-xs text-text-muted mt-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Select to View
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 border-2 border-dashed border-border-default rounded-lg">
                <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-text-muted">
                  Please select a location above
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content: Checklist Items */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {!selectedListId ? (
            <div className="flex flex-col items-center justify-center h-full text-text-disabled">
              <ClipboardCheck className="w-16 h-16 mb-4 text-gray-200" />
              <h3 className="text-lg font-medium text-text-primary mb-1">
                No Checklist Selected
              </h3>
              <p className="max-w-sm text-center">
                Select a location and a checklist from the sidebar to view
                sequence and raise RFIs.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">
                    {lists.find((l) => l.id === selectedListId)?.name}
                  </h2>
                  <p className="text-text-muted mt-1 flex items-center gap-2">
                    <span className="bg-surface-raised px-2 py-0.5 rounded text-xs font-mono text-text-secondary">
                      SEQ-101
                    </span>
                    Execution Sequence
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-text-muted">
                    Overall Progress
                  </div>
                  <div className="text-2xl font-bold text-secondary">
                    {Math.round(
                      (visibleActivities.filter(
                        (a) =>
                          activityRows.find((r) => r.id === a.id)
                            ?.statusState === "APPROVED",
                      ).length /
                        (visibleActivities.length || 1)) *
                        100,
                    )}
                    %
                  </div>
                </div>
              </div>

              {/* Vendor Selector */}
              <div className="mb-8 p-4 bg-secondary-muted border border-indigo-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <FileText className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                      Contractor / Vendor
                    </div>
                    <div className="text-sm text-indigo-700/70">
                      Select the party responsible for this execution
                    </div>
                  </div>
                </div>

                <div className="w-64">
                  {user?.isTempUser ? (
                    <div className="bg-surface-card border border-indigo-200 px-3 py-2 rounded-lg text-sm font-semibold text-text-primary shadow-sm">
                      {user?.vendor?.name || "Assigned Vendor"}
                    </div>
                  ) : (
                    <select
                      className="w-full bg-surface-card border border-indigo-200 px-3 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-secondary outline-none shadow-sm cursor-pointer"
                      value={selectedVendorId || ""}
                      onChange={(e) =>
                        setSelectedVendorId(Number(e.target.value) || null)
                      }
                    >
                      <option value="">Select Vendor...</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="bg-surface-card shadow-sm border rounded-xl overflow-hidden divide-y divide-gray-100">
                {hiddenActivityCount > 0 && (
                  <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
                    {hiddenActivityCount} activit{hiddenActivityCount === 1 ? "y is" : "ies are"} hidden by floor visibility configuration for the selected location.
                  </div>
                )}
                {activityRows.length === 0 && !loading && (
                  <div className="p-8 text-center text-text-muted">
                    No activities found in this list.
                  </div>
                )}

                {activityRows.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-4 transition-colors ${item.statusState === "LOCKED" ? "bg-surface-base text-text-muted" : "bg-surface-card hover:bg-surface-base"}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Sequence Number */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${item.statusState === "APPROVED" ? "bg-green-100 text-green-700" : "bg-surface-raised text-text-muted"}`}
                      >
                        {idx + 1}
                      </div>

                      {/* Matches */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-text-primary truncate">
                            {item.activityName}
                          </h3>
                          <StatusBadge state={item.statusState} />
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded border border-sky-200 uppercase tracking-wide">
                            {item.applicabilityLevel || "FLOOR"}
                          </span>
                          {item.holdPoint && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200 uppercase tracking-wide">
                              HP
                            </span>
                          )}
                          {item.witnessPoint && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded border border-yellow-200 uppercase tracking-wide">
                              WP
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-sm text-text-muted mb-2">
                            {item.description}
                          </p>
                        )}

                        {/* Predecessor Info if Locked */}
                        {item.statusState === "LOCKED" &&
                          !item.predecessorDone && (
                            <div className="flex items-center gap-1.5 text-xs text-warning bg-warning-muted px-2 py-1 rounded w-fit mt-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Waiting for predecessor completion</span>
                            </div>
                          )}

                        {/* Inspection Details */}
                        {item.inspection && (
                          <div className="mt-3 text-sm bg-surface-base rounded-lg p-3 border border-border-subtle">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                              <div className="text-text-muted">
                                Request Date:{" "}
                                <span className="text-text-primary font-medium">
                                  {item.inspection.requestDate}
                                </span>
                              </div>
                              {item.inspection.inspectionDate && (
                                <div className="text-text-muted">
                                  Inspection Date:{" "}
                                  <span className="text-text-primary font-medium">
                                    {item.inspection.inspectionDate}
                                  </span>
                                </div>
                              )}
                              {(item.inspection.goLabel ||
                                item.inspection.partLabel) && (
                                <div className="text-text-muted">
                                  GO:{" "}
                                  <span className="text-text-primary font-medium">
                                    {item.inspection.goLabel ||
                                      item.inspection.partLabel?.replace(
                                        /^Part/i,
                                        "GO",
                                      )}
                                  </span>
                                </div>
                              )}
                              {item.inspection.comments && (
                                <div className="col-span-2 text-text-muted border-t pt-2 mt-1">
                                  Comments:{" "}
                                  <span className="text-text-secondary italic">
                                    "{item.inspection.comments}"
                                  </span>
                                </div>
                              )}
                              {item.inspection.goDetails && (
                                <div className="col-span-2 text-text-muted border-t pt-2 mt-1">
                                  GO Details:{" "}
                                  <span className="text-text-secondary">
                                    {item.inspection.goDetails}
                                  </span>
                                </div>
                              )}
                              {item.inspection.relatedChecklistInspections
                                ?.length ? (
                                <div className="col-span-2 text-text-muted">
                                  <span className="mb-1 block text-xs font-semibold uppercase">
                                    Linked Checklists
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.inspection.relatedChecklistInspections.map(
                                      (related) => (
                                        <span
                                          key={related.id}
                                          className="rounded-md border border-border-default bg-surface-card px-2 py-1 text-xs font-medium text-text-primary"
                                        >
                                          {[
                                            related.activityName,
                                            related.goLabel,
                                            related.elementName,
                                            `RFI #${related.id}`,
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            {(item.requiresPourClearanceCard ||
                              item.requiresPourCard) && (
                              <div className="mt-3 flex flex-wrap gap-2 border-t border-border-subtle pt-3">
                                {item.requiresPourClearanceCard &&
                                item.inspection.stageApprovalSummary
                                  ?.pourClearanceTriggerApproved ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openCardModal(
                                        item.inspection!,
                                        "CLEARANCE",
                                      )
                                    }
                                    className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
                                  >
                                    GO Pour Clearance
                                  </button>
                                ) : item.requiresPourClearanceCard ? (
                                  <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                                    Pour clearance unlocks after{" "}
                                    {item.inspection.stageApprovalSummary
                                      ?.pourClearanceTriggerStageName ||
                                      "configured stage"}{" "}
                                    approval
                                  </span>
                                ) : null}
                                {item.requiresPourCard &&
                                (!item.requiresPourClearanceCard ||
                                  item.inspection.cardSummary
                                    ?.prePourClearanceApproved) ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openCardModal(
                                        item.inspection!,
                                        "POUR_CARD",
                                        Boolean(item.requiresPourClearanceCard),
                                      )
                                    }
                                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                                  >
                                    Concrete Pour Card
                                  </button>
                                ) : item.requiresPourCard ? (
                                  <span className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800">
                                    Pour card unlocks after clearance approval
                                  </span>
                                ) : null}
                                <span className="text-xs text-text-muted">
                                  GO:{" "}
                                  {item.inspection.goLabel ||
                                    item.inspection.partLabel ||
                                    "RFI scope"}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {item.applicabilityLevel === "FLOOR" &&
                          partProgressByActivity[item.id] && (
                            <div className="mt-3 text-xs bg-secondary-muted border border-indigo-100 rounded-lg p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="font-semibold text-indigo-800">
                                  GO Progress (
                                  {
                                    partProgressByActivity[item.id]
                                      .existingPartNos.length
                                  }
                                  /{partProgressByActivity[item.id].totalParts})
                                </div>
                                <button
                                  onClick={() => handleExpandGoCount(item)}
                                  disabled={expandingGoActivityId === item.id}
                                  className="rounded border border-indigo-200 bg-surface-card px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                >
                                  {expandingGoActivityId === item.id
                                    ? "Updating..."
                                    : "Add GO"}
                                </button>
                              </div>
                              <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-text-muted">
                                {(
                                  [
                                    "NOT_STARTED",
                                    "RAISED",
                                    "PARTIALLY_APPROVED",
                                    "FULLY_APPROVED",
                                  ] as GoApprovalState[]
                                ).map((state) => (
                                  <span
                                    key={state}
                                    className="inline-flex items-center gap-1"
                                  >
                                    <span
                                      className={`h-2 w-2 rounded-full ${GO_STATE_CONFIG[state].dotClassName}`}
                                    />
                                    {GO_STATE_CONFIG[state].label}
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {Array.from(
                                  {
                                    length:
                                      partProgressByActivity[item.id]
                                        .totalParts,
                                  },
                                  (_, idx) => idx + 1,
                                ).map((p) => {
                                  const goInspection = inspections.find(
                                    (inspection) =>
                                      inspection.activityId === item.id &&
                                      getGoNumber(inspection) === p,
                                  );
                                  const exists =
                                    partProgressByActivity[
                                      item.id
                                    ].existingPartNos.includes(p);
                                  const goState =
                                    getGoApprovalState(goInspection);
                                  const stateConfig =
                                    GO_STATE_CONFIG[goState];
                                  const selectedGoNo =
                                    selectedGoByActivity[item.id] ||
                                    getGoNumber(item.inspection);
                                  const isSelected = selectedGoNo === p;
                                  return exists ? (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() =>
                                        setSelectedGoByActivity((prev) => ({
                                          ...prev,
                                          [item.id]: p,
                                        }))
                                      }
                                      title={[
                                        goInspection?.goDetails || null,
                                        goInspection
                                          ? `RFI #${goInspection.id}`
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" | ")}
                                      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-medium transition ${stateConfig.className} ${
                                        isSelected
                                          ? "ring-2 ring-secondary ring-offset-1"
                                          : ""
                                      }`}
                                    >
                                      <span
                                        className={`h-2 w-2 rounded-full ${stateConfig.dotClassName}`}
                                      />
                                      GO {p}
                                      <span className="text-[10px] opacity-80">
                                        {stateConfig.label}
                                      </span>
                                    </button>
                                  ) : (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() =>
                                        openRaiseRfiFlow(item, {
                                          mode: "GO_SINGLE",
                                          partNo: p,
                                          totalParts:
                                            partProgressByActivity[item.id]
                                            .totalParts,
                                        })
                                      }
                                      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-medium transition ${GO_STATE_CONFIG.NOT_STARTED.className}`}
                                    >
                                      <span
                                        className={`h-2 w-2 rounded-full ${GO_STATE_CONFIG.NOT_STARTED.dotClassName}`}
                                      />
                                      GO {p}
                                      <span className="text-[10px] opacity-80">
                                        {goInspection?.status === "REJECTED"
                                          ? "Re-raise"
                                          : "Raise"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        {item.applicabilityLevel === "UNIT" &&
                          unitProgressByActivity[item.id] && (
                            <div className="mt-3 text-xs bg-secondary-muted border border-indigo-100 rounded-lg p-3">
                              <div className="font-semibold text-indigo-800 mb-2">
                                Unit Progress (
                                {
                                  unitProgressByActivity[item.id].raisedUnitIds
                                    .length
                                }
                                /{unitProgressByActivity[item.id].totalUnits})
                              </div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {unitProgressByActivity[item.id].units.map(
                                  (u) => {
                                    const raised = unitProgressByActivity[
                                      item.id
                                    ].raisedUnitIds.includes(u.id);
                                    return raised ? (
                                      <span
                                        key={u.id}
                                        className="px-2 py-1 rounded border bg-success-muted border-green-200 text-green-700 font-medium"
                                      >
                                        {u.name} Raised
                                      </span>
                                    ) : (
                                      <button
                                        key={u.id}
                                        onClick={() =>
                                          openRaiseRfiFlow(item, {
                                            mode: "UNIT_SINGLE",
                                            unitId: u.id,
                                          })
                                        }
                                        className="px-2 py-1 rounded border bg-surface-card border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-medium"
                                      >
                                        Raise {u.name}
                                      </button>
                                    );
                                  },
                                )}
                              </div>
                              {unitProgressByActivity[item.id].pendingUnitIds
                                .length > 0 && (
                                <button
                                  onClick={() =>
                                    openRaiseRfiFlow(item, {
                                      mode: "UNIT_BATCH",
                                    })
                                  }
                                  disabled={raisingBatch}
                                  className="px-2 py-1 rounded border bg-secondary border-indigo-700 text-white hover:bg-secondary-dark font-medium disabled:opacity-50"
                                >
                                  {raisingBatch
                                    ? "Raising..."
                                    : "Raise All Pending Units"}
                                </button>
                              )}
                            </div>
                          )}
                        {/* Observations Area */}
                        {item.statusState === "PENDING_OBSERVATION" &&
                          observationGroupsByActivity[item.id]?.length > 0 && (
                            <div className="mt-3 space-y-4">
                              {observationGroupsByActivity[item.id].map(
                                (group) => {
                                  const unresolvedObservations =
                                    group.observations.filter(
                                      (obs) => obs.status !== "CLOSED",
                                    );
                                  if (unresolvedObservations.length === 0) {
                                    return null;
                                  }

                                  return (
                                    <div
                                      key={group.key}
                                      className={`space-y-3 rounded-xl border p-4 ${
                                        group.isLegacy
                                          ? "border-amber-200 bg-amber-50"
                                          : "border-rose-200 bg-rose-50"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div
                                            className={`text-xs font-bold uppercase tracking-[0.2em] ${
                                              group.isLegacy
                                                ? "text-amber-800"
                                                : "text-rose-800"
                                            }`}
                                          >
                                            {group.isLegacy
                                              ? "Legacy Activity Scope"
                                              : "Inspection Scope"}
                                          </div>
                                          <h4
                                            className={`mt-1 text-sm font-semibold ${
                                              group.isLegacy
                                                ? "text-amber-950"
                                                : "text-rose-950"
                                            }`}
                                          >
                                            {group.label}
                                          </h4>
                                          {group.inspection && (
                                            <div className="mt-1 text-xs text-text-muted">
                                              RFI #{group.inspection.id}
                                              {group.inspection.requestDate
                                                ? ` â€¢ Raised ${new Date(
                                                    group.inspection.requestDate,
                                                  ).toLocaleDateString()}`
                                                : ""}
                                            </div>
                                          )}
                                          {group.isLegacy && (
                                            <div className="mt-1 text-xs text-amber-800">
                                              This older observation was not
                                              linked to a specific unit or GO.
                                            </div>
                                          )}
                                        </div>
                                        <span
                                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                            group.isLegacy
                                              ? "bg-amber-100 text-amber-800"
                                              : "bg-rose-100 text-rose-800"
                                          }`}
                                        >
                                          {unresolvedObservations.length} open
                                        </span>
                                      </div>

                                      {unresolvedObservations.map((obs) => (
                                        <div
                                          key={obs.id}
                                          className="rounded-lg border border-white/70 bg-white/90 p-4 shadow-sm"
                                        >
                                          <div className="flex items-start gap-3">
                                            <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                                            <div className="flex-1">
                                              <div className="mb-1 flex items-start justify-between gap-3">
                                                <div>
                                                  <h5 className="text-sm font-bold text-rose-900">
                                                    QC Observation Logged{" "}
                                                    {obs.type
                                                      ? `[${obs.type}]`
                                                      : ""}
                                                  </h5>
                                                  <div className="mt-1 text-[11px] uppercase tracking-wide text-rose-600">
                                                    {obs.status}
                                                  </div>
                                                </div>
                                                <span className="text-xs font-medium text-rose-500">
                                                  {new Date(
                                                    obs.createdAt,
                                                  ).toLocaleString()}
                                                </span>
                                              </div>
                                              <p className="rounded border border-rose-100 bg-surface-card p-2 text-sm italic text-rose-800">
                                                "{obs.observationText}"
                                              </p>
                                              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                                {[
                                                  {
                                                    label: "Raised by",
                                                    actor: obs.raisedBy,
                                                    actorId: obs.inspectorId,
                                                    at: obs.createdAt,
                                                  },
                                                  {
                                                    label: "Rectified by",
                                                    actor: obs.rectifiedBy,
                                                    actorId: obs.resolvedBy,
                                                    at: obs.resolvedAt,
                                                  },
                                                  {
                                                    label: "Closed by",
                                                    actor: obs.closedByUser,
                                                    actorId: obs.closedBy,
                                                    at: obs.closedAt,
                                                  },
                                                ].map((audit) => (
                                                  <div
                                                    key={audit.label}
                                                    className="rounded border border-rose-100 bg-white px-2 py-1.5"
                                                  >
                                                    <div className="text-[10px] font-semibold uppercase text-rose-500">
                                                      {audit.label}
                                                    </div>
                                                    <div className="text-xs font-semibold text-text-primary">
                                                      {audit.actor?.displayName ||
                                                        (audit.actorId
                                                          ? `User #${audit.actorId}`
                                                          : "Pending")}
                                                    </div>
                                                    {audit.actor?.designation && (
                                                      <div className="text-[11px] text-text-muted">
                                                        {audit.actor.designation}
                                                      </div>
                                                    )}
                                                    {audit.at && (
                                                      <div className="text-[11px] text-text-muted">
                                                        {new Date(audit.at).toLocaleString()}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>

                                              {obs.photos &&
                                                obs.photos.length > 0 && (
                                                  <div className="mt-3 flex flex-wrap gap-2">
                                                    {obs.photos.map(
                                                      (url, pIdx) => (
                                                        <a
                                                          key={pIdx}
                                                          href={getFileUrl(url)}
                                                          target="_blank"
                                                          rel="noreferrer"
                                                          className="h-16 w-16 overflow-hidden rounded-md border border-rose-200 transition-opacity hover:opacity-80"
                                                        >
                                                          <img
                                                            src={getFileUrl(
                                                              url,
                                                            )}
                                                            alt="Observation"
                                                            className="h-full w-full object-cover"
                                                          />
                                                        </a>
                                                      ),
                                                    )}
                                                  </div>
                                                )}
                                              {obs.rectificationHistory &&
                                                obs.rectificationHistory.length >
                                                  0 && (
                                                  <div className="mt-3 rounded border border-rose-100 bg-white p-3">
                                                    <div className="text-[10px] font-semibold uppercase text-rose-600">
                                                      Rectification History
                                                    </div>
                                                    <div className="mt-2 space-y-2">
                                                      {obs.rectificationHistory.map(
                                                        (entry, historyIndex) => (
                                                          <div
                                                            key={`${entry.at}-${historyIndex}`}
                                                            className="rounded border border-border-subtle bg-surface-base p-2"
                                                          >
                                                            <div className="flex items-center justify-between gap-2">
                                                              <span className="text-[11px] font-bold text-text-secondary">
                                                                {entry.type}
                                                              </span>
                                                              <span className="text-[10px] text-text-muted">
                                                                {entry.at
                                                                  ? new Date(
                                                                      entry.at,
                                                                    ).toLocaleString()
                                                                  : ""}
                                                              </span>
                                                            </div>
                                                            {entry.text && (
                                                              <p className="mt-1 text-xs text-text-secondary">
                                                                {entry.text}
                                                              </p>
                                                            )}
                                                            {entry.rejectionRemarks && (
                                                              <p className="mt-1 text-xs text-rose-700">
                                                                Reason:{" "}
                                                                {
                                                                  entry.rejectionRemarks
                                                                }
                                                              </p>
                                                            )}
                                                          </div>
                                                        ),
                                                      )}
                                                    </div>
                                                  </div>
                                                )}

                                              {obs.status === "PENDING" ||
                                              obs.status === "OPEN" ? (
                                                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3">
                                                  <div>
                                                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                                                      Pending Rectification
                                                    </div>
                                                    <p className="mt-1 text-sm text-amber-800">
                                                      Rectify and close this observation from the QA/QC Approvals screen.
                                                    </p>
                                                  </div>
                                                  {group.inspection && (
                                                    <button
                                                      onClick={() =>
                                                        navigate(
                                                          `/projects/${projectId}/quality/approvals?inspectionId=${group.inspection!.id}`,
                                                        )
                                                      }
                                                      className="shrink-0 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                                                    >
                                                      Open in Approvals â†’
                                                    </button>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="mt-4 rounded-lg border border-blue-100 bg-primary-muted p-3">
                                                  <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                      <div className="text-xs font-semibold uppercase tracking-wide text-blue-900">
                                                        Awaiting QC Closure
                                                      </div>
                                                      <p className="mt-1 text-sm text-blue-800">
                                                        {obs.closureText ||
                                                          "Rectification submitted â€” QC needs to verify and close."}
                                                      </p>
                                                      {obs.closureEvidence &&
                                                        obs.closureEvidence.length >
                                                          0 && (
                                                          <div className="mt-2 flex flex-wrap gap-2">
                                                            {obs.closureEvidence.map(
                                                              (url, pIdx) => (
                                                                <a
                                                                  key={pIdx}
                                                                  href={getFileUrl(url)}
                                                                  target="_blank"
                                                                  rel="noreferrer"
                                                                  className="h-12 w-12 overflow-hidden rounded border border-blue-200"
                                                                >
                                                                  <img
                                                                    src={getFileUrl(url)}
                                                                    alt="Rectification"
                                                                    className="h-full w-full object-cover"
                                                                  />
                                                                </a>
                                                              ),
                                                            )}
                                                          </div>
                                                        )}
                                                    </div>
                                                    {group.inspection && (
                                                      <button
                                                        onClick={() =>
                                                          navigate(
                                                            `/projects/${projectId}/quality/approvals?inspectionId=${group.inspection!.id}`,
                                                          )
                                                        }
                                                        className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                                                      >
                                                        Close in Approvals â†’
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )}
                      </div>

                      {/* Action Buttons */}
                      <div className="shrink-0 pt-1 flex items-center gap-2">
                        {(item.statusState === "READY" ||
                          item.statusState === "REJECTED") &&
                          !hasActiveFloorGo(
                            item.id,
                            item.applicabilityLevel,
                          ) && (
                          <button
                            onClick={() => openRaiseRfiFlow(item)}
                            className="flex items-center gap-1.5 bg-secondary hover:bg-secondary-dark text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
                          >
                            <ShieldAlert className="w-4 h-4" />
                            {item.statusState === "REJECTED"
                              ? "Re-raise RFI"
                              : "Raise RFI"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {activeCardInspection && activeCardKind && (
        <div className="fixed inset-0 z-[9999] bg-white text-text-primary">
          <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-border-default bg-white px-6 py-4 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-text-primary">
                  {activeCardKind === "CLEARANCE"
                    ? "GO Pour Clearance"
                    : "Concrete Pour Card"}
                </h3>
                <p className="text-sm text-text-muted">
                  RFI #{activeCardInspection.id} Â· GO{" "}
                  {activeCardInspection.goLabel ||
                    activeCardInspection.partLabel ||
                    activeCardInspection.goNo ||
                    "-"}{" "}
                  Â· Element {activeCardInspection.elementName || "-"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {((activeCardKind === "CLEARANCE" &&
                  canReadPourClearance) ||
                  (activeCardKind === "POUR_CARD" && canReadPourCard)) && (
                  <button
                    type="button"
                    onClick={downloadActiveCardPdf}
                    className="rounded-lg border border-border-default px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-raised"
                  >
                    Download PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveCardInspection(null);
                    setActiveCardKind(null);
                  }}
                  className="rounded-lg border border-border-default px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-raised"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-5">
              {loadingCardModal ? (
                <div className="rounded-xl border border-border-default bg-surface-card p-6 text-center text-text-muted">
                  Loading card details...
                </div>
              ) : activeCardKind === "CLEARANCE" && prePourClearanceCard ? (
                <div className="mx-auto max-w-6xl space-y-4">
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                    <div className="font-semibold">
                      Status: {prePourClearanceCard.status || "DRAFT"}
                    </div>
                    <div className="mt-1">
                      Fill the clearance, capture all relevant signatories, then
                      send it for QA/QC approval. The concrete pour card opens
                      after this clearance is approved.
                    </div>
                    {!prePourClearanceCard.isActivated ? (
                      <div className="mt-2 font-semibold text-amber-800">
                        Waiting for trigger stage approval:{" "}
                        {prePourClearanceCard.activationStageName || "Configured stage"}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border bg-surface-card p-4">
                    <div className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">
                      Concrete Information
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        ["projectNameSnapshot", "Project name"],
                        ["contractorName", "Contractor"],
                        ["cardDate", "Date"],
                        ["elementName", "Element"],
                        ["pourLocation", "Pour location"],
                        ["pourNo", "Pour no"],
                        ["gradeOfConcrete", "Grade of concrete"],
                        ["placementMethod", "Placement method"],
                        ["concreteSupplier", "Concrete supplier"],
                        ["targetSlump", "Target slump"],
                        ["pourStartTime", "Pour start time"],
                        ["pourEndTime", "Pour end time"],
                      ].map(([key, label]) => (
                        <input
                          key={key}
                          value={prePourClearanceCard[key] || ""}
                          onChange={(event) =>
                            updatePrePourClearanceCard((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                          placeholder={label}
                          className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                        />
                      ))}
                      {[
                        ["estimatedConcreteQty", "Estimated concrete qty"],
                        ["actualConcreteQty", "Actual concrete qty"],
                        ["cubeMouldCount", "Cube mould count"],
                        ["vibratorCount", "Vibrator count"],
                      ].map(([key, label]) => (
                        <input
                          key={key}
                          type="number"
                          value={prePourClearanceCard[key] ?? ""}
                          onChange={(event) =>
                            updatePrePourClearanceCard((prev) => ({
                              ...prev,
                              [key]: event.target.value
                                ? Number(event.target.value)
                                : null,
                            }))
                          }
                          placeholder={label}
                          className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-surface-card p-4">
                    <div className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">
                      Attachment Checklist
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {CLEARANCE_ATTACHMENT_OPTIONS.map(({ key, label }) => (
                        <div
                          key={key}
                          className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>{label}</span>
                            <select
                              value={prePourClearanceCard.attachments?.[key] || "NO"}
                              onChange={(event) =>
                                updatePrePourClearanceCard((prev) => ({
                                  ...prev,
                                  attachments: {
                                    ...(prev.attachments || {}),
                                    [key]: event.target.value,
                                  },
                                  attachmentChecklistSelections:
                                    event.target.value === "YES"
                                      ? prev.attachmentChecklistSelections || {}
                                      : {
                                          ...(prev.attachmentChecklistSelections ||
                                            {}),
                                          [key]: [],
                                        },
                                }))
                              }
                              className="rounded border border-border-default bg-surface-card px-2 py-1 text-sm"
                            >
                              <option value="NO">No</option>
                              <option value="YES">Yes</option>
                              <option value="NA">NA</option>
                            </select>
                          </div>
                          {prePourClearanceCard.attachments?.[key] === "YES" ? (
                            <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
                                Select related checklist RFIs from this floor
                              </div>
                              <div className="mt-2 grid gap-2">
                                {floorChecklistAttachmentOptions.length === 0 ? (
                                  <div className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs text-cyan-900">
                                    No approved or partially approved checklist
                                    RFIs are available for this floor yet.
                                  </div>
                                ) : (
                                  floorChecklistAttachmentOptions.map(
                                    (option) => {
                                      const selectedIds =
                                        prePourClearanceCard
                                          .attachmentChecklistSelections?.[
                                          key
                                        ] || [];
                                      return (
                                        <label
                                          key={`${key}-${option.id}`}
                                          title={option.tooltip || option.scope}
                                          className="flex items-start gap-2 rounded-lg border border-cyan-200 bg-white px-3 py-2"
                                        >
                                          <input
                                            type="checkbox"
                                            className="mt-1"
                                            checked={selectedIds.includes(
                                              option.id,
                                            )}
                                            onChange={(event) =>
                                              updatePrePourClearanceCard(
                                                (prev) => {
                                                  const existing =
                                                    prev
                                                      .attachmentChecklistSelections?.[
                                                      key
                                                    ] || [];
                                                  const next = event.target
                                                    .checked
                                                    ? [...existing, option.id]
                                                    : existing.filter(
                                                        (id: number) =>
                                                          id !== option.id,
                                                      );
                                                  return {
                                                    ...prev,
                                                    attachmentChecklistSelections:
                                                      {
                                                        ...(prev.attachmentChecklistSelections ||
                                                          {}),
                                                        [key]: Array.from(
                                                          new Set(next),
                                                        ),
                                                      },
                                                  };
                                                },
                                              )
                                            }
                                          />
                                          <span>
                                            <span className="font-semibold text-cyan-950">
                                              {option.label}
                                            </span>
                                            <span className="ml-2 rounded-full bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                                              {option.status}
                                            </span>
                                            {option.scope ? (
                                              <span className="mt-1 block text-xs text-cyan-900">
                                                {option.scope}
                                              </span>
                                            ) : null}
                                          </span>
                                        </label>
                                      );
                                    },
                                  )
                                )}
                              </div>
                              <ClearanceDocumentAttachments
                                inspectionId={activeCardInspection.id}
                                lineKey={key}
                                documents={
                                  prePourClearanceCard.attachmentDocuments?.[
                                    key
                                  ] || []
                                }
                                disabled={["APPROVED", "LOCKED"].includes(
                                  prePourClearanceCard.status,
                                )}
                                onChange={(documents) =>
                                  updatePrePourClearanceCard((prev) => ({
                                    ...prev,
                                    attachmentDocuments: {
                                      ...(prev.attachmentDocuments || {}),
                                      [key]: documents,
                                    },
                                  }))
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-surface-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-bold uppercase tracking-wide text-text-muted">
                        Signatories
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updatePrePourClearanceCard((prev) => ({
                            ...prev,
                            signoffs: [
                              ...(prev.signoffs || []),
                              {
                                department: "",
                                designation: "",
                                personName: "",
                                status: "PENDING",
                                isActive: true,
                              },
                            ],
                          }))
                        }
                        className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-raised"
                      >
                        Add Signatory
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(prePourClearanceCard.signoffs || []).map(
                        (signoff: any, index: number) => (
                          <div
                            key={`rfi-clearance-signoff-${index}`}
                            className="rounded-lg border border-border-subtle bg-surface-base p-3"
                          >
                            <div className="grid gap-2 md:grid-cols-4">
                              {["department", "designation", "personName"].map(
                                (key) => (
                                  <input
                                    key={key}
                                    value={signoff[key] || ""}
                                    onChange={(event) =>
                                      updatePrePourClearanceCard((prev) => ({
                                        ...prev,
                                        signoffs: (prev.signoffs || []).map(
                                          (row: any, rowIndex: number) =>
                                            rowIndex === index
                                              ? {
                                                  ...row,
                                                  [key]: event.target.value,
                                                }
                                              : row,
                                        ),
                                      }))
                                    }
                                    placeholder={key}
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  />
                                ),
                              )}
                              <select
                                value={
                                  signoff.status === "SIGNED"
                                    ? "SIGNED"
                                    : signoff.status || "PENDING"
                                }
                                onChange={(event) =>
                                  updatePrePourClearanceCard((prev) => ({
                                    ...prev,
                                    signoffs: (prev.signoffs || []).map(
                                      (row: any, rowIndex: number) =>
                                        rowIndex === index
                                          ? {
                                              ...row,
                                              status: event.target.value,
                                              ...(event.target.value !== "SIGNED"
                                                ? {
                                                    signatureData: null,
                                                    signedDate: "",
                                                    signedAt: null,
                                                    signedByUserId: null,
                                                    signerUsername: null,
                                                    signerDisplayName: null,
                                                    signerDesignation: null,
                                                    signerRoles: [],
                                                    signatureMode: null,
                                                    signatureEvidence: null,
                                                  }
                                                : {}),
                                            }
                                          : row,
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                              >
                                <option value="PENDING">Pending</option>
                                {signoff.status === "SIGNED" ? (
                                  <option value="SIGNED">Signed</option>
                                ) : null}
                                <option value="WAIVED">Waived</option>
                              </select>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {canSignPourClearance && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveClearanceSignoffIndex(index);
                                  setShowClearanceSignatureModal(true);
                                }}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                {signoff.signatureData
                                  ? "Update identity signature"
                                  : "Sign with identity"}
                              </button>
                              )}
                              {!signoff.signatureData &&
                              canSignPourClearance ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void generateClearanceSignoffQr(index)
                                  }
                                  disabled={
                                    generatingSignatureQrIndex === index
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                  {generatingSignatureQrIndex === index
                                    ? "Generating..."
                                    : "Generate mobile QR"}
                                </button>
                              ) : null}
                              {signoff.signatureData ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                  Signed by{" "}
                                  {signoff.signerDisplayName ||
                                    signoff.personName ||
                                    "logged-in user"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              ) : activeCardKind === "POUR_CARD" && pourCard ? (
                <div className="mx-auto max-w-6xl space-y-4">
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
                    <div className="font-semibold">
                      Status: {pourCard.status || "DRAFT"}
                    </div>
                    <div className="mt-1">
                      Enter pour details as a table and submit for QA/QC
                      approval. Final RFI approval opens after the pour card is
                      approved.
                    </div>
                  </div>
                  <div className="rounded-xl border bg-surface-card p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        ["projectNameSnapshot", "Project name"],
                        ["contractorName", "Contractor"],
                        ["approvedByName", "Approved by"],
                        ["elementName", "Element"],
                        ["locationText", "Location"],
                      ].map(([key, label]) => (
                        <input
                          key={key}
                          value={pourCard[key] || ""}
                          onChange={(event) =>
                            setPourCard((prev: any) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                          placeholder={label}
                          className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-surface-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-bold uppercase tracking-wide text-text-muted">
                        Pour Details
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPourCard((prev: any) => ({
                            ...prev,
                            entries: [
                              ...(prev.entries || []),
                              {
                                pourDate: "",
                                truckNo: "",
                                deliveryChallanNo: "",
                                mixIdOrGrade: "",
                                quantityM3: null,
                                slumpMm: null,
                                noOfCubesTaken: null,
                                remarks: "",
                              },
                            ],
                          }))
                        }
                        className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-raised"
                      >
                        Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-left text-sm">
                        <thead>
                          <tr className="border-b text-xs uppercase tracking-wide text-text-muted">
                            <th className="px-2 py-2">Date</th>
                            <th className="px-2 py-2">Truck</th>
                            <th className="px-2 py-2">Challan</th>
                            <th className="px-2 py-2">Mix/Grade</th>
                            <th className="px-2 py-2">Qty m3</th>
                            <th className="px-2 py-2">Slump</th>
                            <th className="px-2 py-2">Cubes</th>
                            <th className="px-2 py-2">Remarks</th>
                            <th className="px-2 py-2">Cube IDs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pourCard.entries || []).map(
                            (entry: any, index: number) => (
                              <tr key={`rfi-pour-entry-${index}`} className="border-b">
                                {[
                                  "pourDate",
                                  "truckNo",
                                  "deliveryChallanNo",
                                  "mixIdOrGrade",
                                  "quantityM3",
                                  "slumpMm",
                                  "noOfCubesTaken",
                                  "remarks",
                                ].map((key) => (
                                  <td key={key} className="px-2 py-2">
                                    {key === "mixIdOrGrade" ? (
                                      <select
                                        value={entry.mixIdOrGrade || ""}
                                        onChange={(event) =>
                                          setPourCard((prev: any) => ({
                                            ...prev,
                                            entries: (prev.entries || []).map(
                                              (row: any, rowIndex: number) =>
                                                rowIndex === index
                                                  ? { ...row, mixIdOrGrade: event.target.value }
                                                  : row,
                                            ),
                                          }))
                                        }
                                        className="w-full rounded border border-border-default bg-surface-base px-2 py-1.5 text-sm"
                                      >
                                        <option value="">Select grade</option>
                                        {entry.mixIdOrGrade &&
                                          !concreteGrades.some((grade) => grade.grade === entry.mixIdOrGrade) && (
                                            <option value={entry.mixIdOrGrade}>{entry.mixIdOrGrade}</option>
                                          )}
                                        {concreteGrades.map((grade) => (
                                          <option key={grade.id} value={grade.grade}>
                                            {grade.grade}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type={
                                          key === "pourDate"
                                            ? "date"
                                            : ["quantityM3", "slumpMm", "noOfCubesTaken"].includes(key)
                                            ? "number"
                                            : "text"
                                        }
                                        value={entry[key] ?? ""}
                                        onChange={(event) =>
                                          setPourCard((prev: any) => ({
                                            ...prev,
                                            entries: (prev.entries || []).map(
                                              (row: any, rowIndex: number) =>
                                                rowIndex === index
                                                  ? {
                                                      ...row,
                                                      [key]: [
                                                        "quantityM3",
                                                        "slumpMm",
                                                        "noOfCubesTaken",
                                                      ].includes(key)
                                                        ? event.target.value
                                                          ? Number(event.target.value)
                                                          : null
                                                        : event.target.value,
                                                    }
                                                  : row,
                                            ),
                                          }))
                                        }
                                        className="w-full rounded border border-border-default bg-surface-base px-2 py-1.5 text-sm"
                                      />
                                    )}
                                  </td>
                                ))}
                                <td className="px-2 py-2">
                                  <div className="flex min-w-[120px] flex-wrap gap-1">
                                    {(entry.cubeIds || []).map((cubeId: string) => (
                                      <span
                                        key={cubeId}
                                        className="rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-bold text-orange-700"
                                      >
                                        {cubeId}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-border-default bg-white px-6 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
              <div className="text-sm text-text-muted">
                The submitted document will appear in QA/QC Approvals for review.
              </div>
              <div className="flex gap-2">
                {((activeCardKind === "CLEARANCE" &&
                  canUpdatePourClearance) ||
                  (activeCardKind === "POUR_CARD" && canUpdatePourCard)) && (
                  <button
                    type="button"
                    onClick={saveActiveCard}
                    disabled={savingCardModal || loadingCardModal}
                    className="rounded-lg border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-raised disabled:opacity-50"
                  >
                    {savingCardModal ? "Saving..." : "Save Draft"}
                  </button>
                )}
                {((activeCardKind === "CLEARANCE" &&
                  canSubmitPourClearance) ||
                  (activeCardKind === "POUR_CARD" && canSubmitPourCard)) && (
                  <button
                    type="button"
                    onClick={submitActiveCard}
                    disabled={savingCardModal || loadingCardModal}
                    className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary-dark disabled:opacity-50"
                  >
                    Send For Approval
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {rfiModalActivity && (
        <div className="fixed inset-0 bg-surface-overlay z-50 flex items-center justify-center p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-surface-card shadow-xl">
            <div className="p-5 border-b">
              <h3 className="text-lg font-bold text-text-primary">Raise RFI</h3>
              <p className="text-sm text-text-muted mt-1">
                {rfiModalActivity.activityName}
              </p>
            </div>
            <div className="space-y-4 overflow-y-auto p-5">
              {rfiModalActivity.applicabilityLevel === "FLOOR" && (
                <div className="rounded-md border border-indigo-200 bg-secondary-muted px-3 py-2 text-sm text-indigo-800">
                  <span className="font-semibold">
                    {quickRaiseConfig.mode === "GO_SINGLE" &&
                    quickRaiseConfig.partNo
                      ? `GO ${quickRaiseConfig.partNo}`
                      : "GO 1"}
                  </span>
                  <span className="ml-1">
                    {quickRaiseConfig.mode === "GO_SINGLE"
                      ? "is being raised for this activity."
                      : "starts this activity. Add later GOs individually from the activity card."}
                  </span>
                  {quickRaiseConfig.mode === "GO_SINGLE" &&
                    quickRaiseConfig.partNo ? null : null}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-text-secondary">
                  RFI Request Date
                </label>
                <input
                  type="date"
                  value={rfiRequestDate}
                  max={new Date().toISOString().slice(0, 10)}
                  disabled={!rfiDateSettings?.enabled}
                  onChange={(event) => setRfiRequestDate(event.target.value)}
                  className="w-full mt-1 border border-border-default rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p className="mt-1 text-xs text-text-muted">
                  {rfiDateSettings?.enabled
                    ? "This date will be saved as the RFI raised/requested date."
                    : rfiDateSettings
                      ? rfiDateSettings.globalEnabled
                        ? "Enable Manual RFI Dates for this project to change the request date."
                        : "Enable QUALITY_RFI_BACKDATING_ENABLED in Admin Settings, then enable it for this project."
                      : "Manual date setting is loading. The current date will be used until it is enabled."}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary">
                  Drawing Number
                </label>
                <input
                  type="text"
                  value={drawingNo}
                  onChange={(e) => setDrawingNo(e.target.value)}
                  placeholder="Enter drawing number"
                  className="w-full mt-1 border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary">
                  Elements
                  {(rfiModalActivity.requiresPourCard ||
                    rfiModalActivity.requiresPourClearanceCard) && (
                    <span className="ml-1 text-error">*</span>
                  )}
                </label>
                <input
                  type="text"
                  value={elementName}
                  onChange={(e) => setElementName(e.target.value)}
                  placeholder="Enter element name"
                  className="w-full mt-1 border border-border-default rounded-lg px-3 py-2 text-sm"
                />
                {(rfiModalActivity.requiresPourCard ||
                  rfiModalActivity.requiresPourClearanceCard) && (
                  <p className="mt-1 text-xs text-text-muted">
                    This activity requires pour card details, so the element
                    name will be used in the checklist header and card records.
                  </p>
                )}
              </div>

              {rfiModalActivity.applicabilityLevel === "FLOOR" && (
                <div>
                  <label className="text-xs font-semibold text-text-secondary">
                    GO Details
                  </label>
                  <textarea
                    value={goDetails}
                    onChange={(e) => setGoDetails(e.target.value)}
                    placeholder="Describe the inspection scope for this GO"
                    rows={3}
                    className="w-full mt-1 border border-border-default rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-text-secondary">
                  Link Previous Checklist RFIs
                </label>
                <div className="mt-1">
                  <RelatedChecklistTree
                    groups={relatedChecklistGroups}
                    selectedIds={relatedChecklistInspectionIds}
                    onChange={setRelatedChecklistInspectionIds}
                    loading={loadingRelatedChecklists}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary">
                  Additional Documents
                </label>
                <p className="mb-2 mt-1 text-xs text-text-muted">
                  Attach supporting PDFs or images. Images can be marked up
                  before they are attached.
                </p>
                <RfiAttachmentManager
                  projectId={Number(projectId)}
                  attachments={rfiAttachments}
                  onChange={setRfiAttachments}
                />
              </div>

              {rfiModalActivity.applicabilityLevel === "UNIT" && (
                <div>
                  <label className="text-sm font-medium text-text-secondary">
                    Select Unit(s)
                  </label>
                  {quickRaiseConfig.mode === "UNIT_SINGLE" &&
                    quickRaiseConfig.unitId && (
                      <div className="mt-2 rounded-lg border border-indigo-200 bg-secondary-muted px-3 py-2 text-sm text-indigo-800">
                        Raising checklist for the selected unit only.
                      </div>
                    )}
                  <div className="mt-2 max-h-56 overflow-auto border border-border-default rounded-lg p-2 space-y-1">
                    {qualityUnits.length === 0 && (
                      <div className="text-xs text-text-disabled p-2">
                        No quality units found on selected floor.
                      </div>
                    )}
                    {qualityUnits.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 text-sm p-1.5 hover:bg-surface-base rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUnitIds.includes(u.id)}
                          disabled={quickRaiseConfig.mode !== "NONE"}
                          onChange={(e) => {
                            setSelectedUnitIds((prev) =>
                              e.target.checked
                                ? [...prev, u.id]
                                : prev.filter((id) => id !== u.id),
                            );
                          }}
                        />
                        <span>{u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setRfiModalActivity(null);
                  setQuickRaiseConfig({ mode: "NONE" });
                  setGoDetails("");
                  setRelatedChecklistInspectionIds([]);
                  setRelatedChecklistGroups([]);
                  setRfiAttachments([]);
                }}
                className="px-4 py-2 text-sm rounded-lg hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                onClick={submitRfiFlow}
                disabled={raisingBatch}
                className="px-4 py-2 text-sm rounded-lg bg-secondary text-white hover:bg-secondary-dark disabled:opacity-50"
              >
                {raisingBatch ? "Raising..." : "Raise RFI"}
              </button>
            </div>
          </div>
        </div>
      )}
      {signatureQrSession ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface-card p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary">
                  Mobile Signature QR
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  Scan from SETU mobile app and confirm signing within 5
                  minutes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSignatureQrSession(null)}
                className="rounded-full p-2 text-text-muted hover:bg-surface-raised"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col items-center rounded-xl border border-border-subtle bg-white p-4">
              <img
                src={signatureQrSession.qrCodeDataUrl}
                alt="Mobile signature QR"
                className="h-64 w-64"
              />
              <div className="mt-3 text-center text-sm font-semibold text-text-primary">
                {signatureQrSession.signoff?.department ||
                  signatureQrSession.signoff?.personName ||
                  "Pour clearance signatory"}
              </div>
              <div className="mt-1 text-center text-xs text-text-muted">
                Expires at{" "}
                {new Date(signatureQrSession.expiresAt).toLocaleTimeString()}
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              This QR is one-time use. Once the mobile signature is confirmed,
              this dialog will close and the row will show as signed.
            </div>
          </div>
        </div>
      ) : null}
      <SignatureModal
        isOpen={showClearanceSignatureModal}
        onClose={() => {
          setShowClearanceSignatureModal(false);
          setActiveClearanceSignoffIndex(null);
        }}
        onSign={applyClearanceSignoffSignature}
        title="Pre-Pour Clearance Signatory"
        description="Draw or reuse your saved signature. SETU will attach your logged-in identity for audit."
        actionLabel="Sign Responsibility"
      />
    </div>
  );
}


