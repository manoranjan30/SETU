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
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { qualityService } from "../../services/quality.service";
import type { QualityUnitNode } from "../../types/quality";

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
  status: "OPEN" | "PENDING" | "RECTIFIED" | "RESOLVED" | "CLOSED";
  createdAt: string;
}

interface QualityInspection {
  id: number;
  activityId: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
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
  unitName?: string | null;
  roomName?: string | null;
  drawingNo?: string;
  processCode?: string;
  documentType?: string;
  pendingObservationCount?: number | null;
  legacyActivityObservationCount?: number | null;
}

interface ObservationGroup {
  key: string;
  label: string;
  inspection?: QualityInspection;
  observations: ActivityObservation[];
  isLegacy?: boolean;
}

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
  const { user } = useAuth();
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
  const [rfiMode, setRfiMode] = useState<"SINGLE" | "MULTIPLE">("SINGLE");
  const [rfiParts, setRfiParts] = useState(2);
  const [drawingNo, setDrawingNo] = useState("");
  const [qualityUnits, setQualityUnits] = useState<QualityUnitNode[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [raisingBatch, setRaisingBatch] = useState(false);
  const [quickRaiseConfig, setQuickRaiseConfig] = useState<{
    mode: "NONE" | "GO_SINGLE" | "UNIT_SINGLE" | "UNIT_BATCH";
    partNo?: number;
    totalParts?: number;
    unitId?: number;
  }>({ mode: "NONE" });
  const [unitProgressByActivity, setUnitProgressByActivity] = useState<
    Record<number, UnitProgress>
  >({});

  // Load active vendors for internal users
  useEffect(() => {
    if (projectId && !user?.isTempUser) {
      api
        .get("/quality/inspections/active-vendors", { params: { projectId } })
        .then((res) => setVendors(res.data));
    }
  }, [projectId, user]);

  // Helper for correct image URLs.
  // Strips the /api suffix from VITE_API_URL so uploads (served at the server
  // root) are resolved correctly even if the API URL includes /api.
  const getFileUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const origin = apiUrl.replace(/\/api\/?$/, "");
    return `${origin}${path}`;
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
      Promise.all([
        api.get(`/quality/activity-lists/${selectedListId}/activities`),
        api.get("/quality/inspections", {
          params: {
            projectId,
            epsNodeId: selectedNodeId,
            listId: selectedListId,
          },
        }),
      ])
        .then(async ([actRes, inspRes]) => {
          const acts = actRes.data as QualityActivity[];
          const inspectionRows = inspRes.data as QualityInspection[];
          setActivities(acts);
          setInspections(inspectionRows);

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

  // Logic to determine status of each activity
  const activityRows = useMemo(() => {
    // Map inspections by activityId (get latest)
    const inspMap = new Map<number, QualityInspection>();
    // Inspections are ordered by date desc from backend, so first one is latest
    inspections.forEach((i) => {
      if (!inspMap.has(i.activityId)) inspMap.set(i.activityId, i);
    });

    // Compute status
    return activities.map((act) => {
      const insp = inspMap.get(act.id);
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
          const prevInsp = inspMap.get(edge.sourceId);
          if (!prevInsp || prevInsp.status !== "APPROVED") {
            predecessorDone = false;
            break;
          }
        }
      }
      // Fallback for legacy data/cache
      else if (act.previousActivityId) {
        const prevInsp = inspMap.get(act.previousActivityId);
        if (!prevInsp || prevInsp.status !== "APPROVED") {
          predecessorDone = false;
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
  }, [activities, inspections, observationsMap]);

  const inspectionsById = useMemo(
    () => new Map(inspections.map((inspection) => [inspection.id, inspection])),
    [inspections],
  );

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
      return bits.join(" • ");
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
    for (const insp of inspections) {
      const aid = insp.activityId;
      const partNo = insp.partNo || 1;
      const totalParts = Math.max(1, insp.totalParts || 1);
      if (!map[aid]) {
        map[aid] = { totalParts, existingPartNos: [] };
      }
      map[aid].totalParts = Math.max(map[aid].totalParts, totalParts);
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
    documentType:
      activity.applicabilityLevel === "ROOM"
        ? "ROOM_RFI"
        : activity.applicabilityLevel === "UNIT"
          ? "UNIT_RFI"
          : "FLOOR_RFI",
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

    if (quickConfig?.mode === "GO_SINGLE") {
      setRfiMode("MULTIPLE");
      setRfiParts(Math.max(quickConfig.totalParts || 2, 2));
    } else {
      setRfiMode("SINGLE");
      setRfiParts(2);
    }
    setDrawingNo("");
    setQuickRaiseConfig(quickConfig || { mode: "NONE" });
    setRfiModalActivity(activity);
  };

  const submitRfiFlow = async () => {
    if (!rfiModalActivity || !selectedNodeId) return;
    if (!drawingNo.trim()) {
      alert("Please enter the drawing number before raising the RFI.");
      return;
    }

    if (!user?.isTempUser && !selectedVendorId) {
      alert("Please select a vendor before raising an RFI.");
      return;
    }

    const node = findNodeById(epsNodes, selectedNodeId);
    const nodeType = getNodeType(node);
    if (!nodeType) return;

    setRaisingBatch(true);
    try {
      if (quickRaiseConfig.mode === "GO_SINGLE" && quickRaiseConfig.partNo) {
        await raiseRfiPart(
          rfiModalActivity,
          quickRaiseConfig.partNo,
          quickRaiseConfig.totalParts || Math.max(2, Number(rfiParts) || 2),
        );
      } else if (
        quickRaiseConfig.mode === "UNIT_SINGLE" &&
        quickRaiseConfig.unitId
      ) {
        await raiseUnitRfiFromProgress(rfiModalActivity, quickRaiseConfig.unitId);
      } else if (quickRaiseConfig.mode === "UNIT_BATCH") {
        await raiseAllPendingUnitRfis(rfiModalActivity);
      } else if (rfiModalActivity.applicabilityLevel === "FLOOR") {
        const totalParts =
          rfiMode === "MULTIPLE" ? Math.max(2, Number(rfiParts) || 2) : 1;
        const firstPartNo = 1;
        await api.post(
          "/quality/inspections",
          buildInspectionRequestPayload(rfiModalActivity, {
            partNo: firstPartNo,
            totalParts,
            partLabel: totalParts > 1 ? `GO ${firstPartNo}` : "GO 1",
            goNo: firstPartNo,
            goLabel: `GO ${firstPartNo}`,
            comments:
              totalParts > 1
                ? `Requested via Web (GO ${firstPartNo}/${totalParts})`
                : "Requested via Web",
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
                      (activities.filter(
                        (a) =>
                          activityRows.find((r) => r.id === a.id)
                            ?.statusState === "APPROVED",
                      ).length /
                        (activities.length || 1)) *
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
                            </div>
                          </div>
                        )}
                        {item.applicabilityLevel === "FLOOR" &&
                          partProgressByActivity[item.id]?.totalParts > 1 && (
                            <div className="mt-3 text-xs bg-secondary-muted border border-indigo-100 rounded-lg p-3">
                              <div className="font-semibold text-indigo-800 mb-2">
                                Multi-Go Progress (
                                {
                                  partProgressByActivity[item.id]
                                    .existingPartNos.length
                                }
                                /{partProgressByActivity[item.id].totalParts})
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
                                  const exists =
                                    partProgressByActivity[
                                      item.id
                                    ].existingPartNos.includes(p);
                                  return exists ? (
                                    <span
                                      key={p}
                                      className="px-2 py-1 rounded border bg-success-muted border-green-200 text-green-700 font-medium"
                                    >
                                      GO {p} Raised
                                    </span>
                                  ) : (
                                    <button
                                      key={p}
                                      onClick={() =>
                                        openRaiseRfiFlow(item, {
                                          mode: "GO_SINGLE",
                                          partNo: p,
                                          totalParts:
                                            partProgressByActivity[item.id]
                                              .totalParts,
                                        })
                                      }
                                      className="px-2 py-1 rounded border bg-surface-card border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-medium"
                                    >
                                      Raise GO {p}
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
                                                ? ` • Raised ${new Date(
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
                                                  ).toLocaleDateString()}
                                                </span>
                                              </div>
                                              <p className="rounded border border-rose-100 bg-surface-card p-2 text-sm italic text-rose-800">
                                                "{obs.observationText}"
                                              </p>

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
                                                      Open in Approvals →
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
                                                          "Rectification submitted — QC needs to verify and close."}
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
                                                        Close in Approvals →
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
                          item.statusState === "REJECTED") && (
                          <button
                            onClick={() => openRaiseRfiFlow(item)}
                            className="flex items-center gap-1.5 bg-secondary hover:bg-secondary-dark text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
                          >
                            <ShieldAlert className="w-4 h-4" />
                            Raise RFI
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

      {rfiModalActivity && (
        <div className="fixed inset-0 bg-surface-overlay z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b">
              <h3 className="text-lg font-bold text-text-primary">Raise RFI</h3>
              <p className="text-sm text-text-muted mt-1">
                {rfiModalActivity.activityName}
              </p>
            </div>
            <div className="p-5 space-y-4">
              {rfiModalActivity.applicabilityLevel === "FLOOR" && (
                <>
                  <div className="text-sm font-medium text-text-secondary">
                    Floor-level execution mode
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={quickRaiseConfig.mode === "GO_SINGLE"}
                      onClick={() => setRfiMode("SINGLE")}
                      className={`px-3 py-2 rounded-lg text-sm border ${rfiMode === "SINGLE" ? "bg-secondary-muted border-indigo-300 text-indigo-700" : "border-border-default text-text-secondary"}`}
                    >
                      One Go
                    </button>
                    <button
                      disabled={quickRaiseConfig.mode === "GO_SINGLE"}
                      onClick={() => setRfiMode("MULTIPLE")}
                      className={`px-3 py-2 rounded-lg text-sm border ${rfiMode === "MULTIPLE" ? "bg-secondary-muted border-indigo-300 text-indigo-700" : "border-border-default text-text-secondary"}`}
                    >
                      Multiple Go
                    </button>
                  </div>
                  {rfiMode === "MULTIPLE" && (
                    <div>
                      <label className="text-xs font-semibold text-text-secondary">
                        How many GOs?
                      </label>
                      <input
                        type="number"
                        min={2}
                        value={rfiParts}
                        disabled={quickRaiseConfig.mode === "GO_SINGLE"}
                        onChange={(e) => setRfiParts(Number(e.target.value))}
                        className="w-full mt-1 border border-border-default rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  {quickRaiseConfig.mode === "GO_SINGLE" &&
                    quickRaiseConfig.partNo && (
                      <div className="rounded-lg border border-indigo-200 bg-secondary-muted px-3 py-2 text-sm text-indigo-800">
                        Raising checklist for{" "}
                        <span className="font-semibold">
                          GO {quickRaiseConfig.partNo}
                        </span>
                      </div>
                    )}
                </>
              )}

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
    </div>
  );
}
