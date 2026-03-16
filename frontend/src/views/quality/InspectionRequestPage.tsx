import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ClipboardCheck,
  AlertCircle,
  Clock,
  ChevronRight,
  FileText,
  ShieldAlert,
  AlertTriangle,
  MessageSquareWarning,
  CheckCircle2,
  Camera,
  X,
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
  observationText: string;
  type?: string;
  remarks?: string;
  photos?: string[];
  closureText?: string;
  closureEvidence?: string[];
  status: "PENDING" | "RECTIFIED" | "CLOSED";
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
  processCode?: string;
  documentType?: string;
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
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [closureTexts, setClosureTexts] = useState<Record<string, string>>({});
  const [closurePhotos, setClosurePhotos] = useState<Record<string, string[]>>(
    {},
  );
  const [uploading, setUploading] = useState<string | null>(null); // obsId being uploaded for
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
  const [qualityUnits, setQualityUnits] = useState<QualityUnitNode[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [raisingBatch, setRaisingBatch] = useState(false);
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

  // Helper for correct image URLs
  const getFileUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    return `${baseUrl}${path}`;
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
          setActivities(acts);
          setInspections(inspRes.data);

          // Fetch observations for activities in PENDING_OBSERVATION
          const obsPromises = acts
            .filter((a) => a.status === "PENDING_OBSERVATION")
            .map((a) =>
              api
                .get(`/quality/activities/${a.id}/observations`)
                .then((res) => ({ id: a.id, obs: res.data })),
            );

          Promise.all(obsPromises)
            .then((results) => {
              const oMap: Record<number, ActivityObservation[]> = {};
              results.forEach((r) => {
                oMap[r.id] = r.obs;
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

      if (act.status === "PENDING_OBSERVATION") {
        state = "PENDING_OBSERVATION" as any;
      } else if (insp) {
        state = insp.status as any;
      } else {
        if (predecessorDone || act.allowBreak) state = "READY";
        else state = "LOCKED";
      }

      return { ...act, inspection: insp, statusState: state, predecessorDone };
    });
  }, [activities, inspections]);

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
          partLabel: totalParts > 1 ? `Part ${partNo}` : "Single",
          comments:
            totalParts > 1
              ? `Requested via Web (Part ${partNo}/${totalParts})`
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

  const openRaiseRfiFlow = async (activity: QualityActivity) => {
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
        setSelectedUnitIds([]);
      } catch {
        setQualityUnits([]);
      }
    } else {
      setQualityUnits([]);
      setSelectedUnitIds([]);
    }

    setRfiMode("SINGLE");
    setRfiParts(2);
    setRfiModalActivity(activity);
  };

  const submitRfiFlow = async () => {
    if (!rfiModalActivity || !selectedNodeId) return;

    if (!user?.isTempUser && !selectedVendorId) {
      alert("Please select a vendor before raising an RFI.");
      return;
    }

    const node = findNodeById(epsNodes, selectedNodeId);
    const nodeType = getNodeType(node);
    if (!nodeType) return;

    setRaisingBatch(true);
    try {
      if (rfiModalActivity.applicabilityLevel === "FLOOR") {
        const totalParts =
          rfiMode === "MULTIPLE" ? Math.max(2, Number(rfiParts) || 2) : 1;
        const firstPartNo = 1;
        await api.post(
          "/quality/inspections",
          buildInspectionRequestPayload(rfiModalActivity, {
            partNo: firstPartNo,
            totalParts,
            partLabel: totalParts > 1 ? `Part ${firstPartNo}` : "Single",
            comments:
              totalParts > 1
                ? `Requested via Web (Part ${firstPartNo}/${totalParts})`
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
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to raise RFI");
    } finally {
      setRaisingBatch(false);
    }
  };

  const handleFileUpload = async (
    obsId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(obsId);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setClosurePhotos((prev) => ({
        ...prev,
        [obsId]: [...(prev[obsId] || []), res.data.url],
      }));
    } catch (err: any) {
      alert(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleResolveObservation = async (
    activityId: number,
    obsId: string,
  ) => {
    const text = closureTexts[obsId];
    if (!text || !text.trim()) {
      alert(
        "Please enter your rectification details and evidence note before submitting.",
      );
      return;
    }
    setResolvingId(obsId);
    try {
      await api.patch(
        `/quality/activities/${activityId}/observation/${obsId}/resolve`,
        {
          closureText: text,
          closureEvidence: closurePhotos[obsId] || [],
        },
      );
      alert("Observation marked as rectified and sent back to QC.");
      setRefreshKey((k) => k + 1);
      // Clear inputs for this observation
      setClosureTexts((prev) => {
        const n = { ...prev };
        delete n[obsId];
        return n;
      });
      setClosurePhotos((prev) => {
        const n = { ...prev };
        delete n[obsId];
        return n;
      });
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to resolve observation.");
    } finally {
      setResolvingId(null);
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
                              {item.inspection.partLabel && (
                                <div className="text-text-muted">
                                  Part:{" "}
                                  <span className="text-text-primary font-medium">
                                    {item.inspection.partLabel}
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
                                      Part {p} Raised
                                    </span>
                                  ) : (
                                    <button
                                      key={p}
                                      onClick={() =>
                                        raiseRfiPart(
                                          item,
                                          p,
                                          partProgressByActivity[item.id]
                                            .totalParts,
                                        )
                                      }
                                      className="px-2 py-1 rounded border bg-surface-card border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-medium"
                                    >
                                      Raise Part {p}
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
                                          raiseUnitRfiFromProgress(item, u.id)
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
                                  onClick={() => raiseAllPendingUnitRfis(item)}
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
                          observationsMap[item.id] && (
                            <div className="mt-3 space-y-4">
                              {observationsMap[item.id]
                                .filter((o) => o.status === "PENDING")
                                .map((obs) => (
                                  <div
                                    key={obs.id}
                                    className="bg-rose-50 border border-rose-200 rounded-lg p-4 shadow-sm"
                                  >
                                    <div className="flex items-start gap-3">
                                      <MessageSquareWarning className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                          <h4 className="text-sm font-bold text-rose-900">
                                            QC Observation Logged:{" "}
                                            {obs.type ? `[${obs.type}]` : ""}
                                          </h4>
                                          <span className="text-xs text-rose-500 font-medium">
                                            {new Date(
                                              obs.createdAt,
                                            ).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <p className="text-sm text-rose-800 bg-surface-card p-2 rounded border border-rose-100 italic">
                                          "{obs.observationText}"
                                        </p>

                                        {obs.photos &&
                                          obs.photos.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                              {obs.photos.map((url, pIdx) => (
                                                <a
                                                  key={pIdx}
                                                  href={getFileUrl(url)}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="w-16 h-16 rounded-md border border-rose-200 overflow-hidden hover:opacity-80 transition-opacity"
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

                                        <div className="mt-4 pt-3 border-t border-rose-200/60">
                                          <label className="block text-xs font-bold text-rose-900 mb-1.5 uppercase tracking-wider">
                                            Rectification Evidence
                                          </label>

                                          <div className="flex flex-wrap gap-2 mb-3">
                                            {(closurePhotos[obs.id] || []).map(
                                              (url, pIdx) => (
                                                <div
                                                  key={pIdx}
                                                  className="relative w-16 h-16 group"
                                                >
                                                  <img
                                                    src={getFileUrl(url)}
                                                    alt="Rectification"
                                                    className="w-full h-full object-cover rounded border border-rose-200"
                                                  />
                                                  <button
                                                    onClick={() =>
                                                      setClosurePhotos(
                                                        (prev) => ({
                                                          ...prev,
                                                          [obs.id]: prev[
                                                            obs.id
                                                          ].filter(
                                                            (_, i) =>
                                                              i !== pIdx,
                                                          ),
                                                        }),
                                                      )
                                                    }
                                                    className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                  >
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              ),
                                            )}
                                            <label
                                              className={`w-16 h-16 flex flex-col items-center justify-center border border-dashed border-rose-300 rounded bg-surface-card hover:bg-rose-100 transition-all cursor-pointer ${uploading === obs.id ? "opacity-50 pointer-events-none" : ""}`}
                                            >
                                              <Camera className="w-5 h-5 text-rose-400" />
                                              <span className="text-[8px] text-rose-500 mt-0.5 font-bold uppercase">
                                                {uploading === obs.id
                                                  ? "..."
                                                  : "Photo"}
                                              </span>
                                              <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) =>
                                                  handleFileUpload(obs.id, e)
                                                }
                                              />
                                            </label>
                                          </div>

                                          <textarea
                                            className="w-full border-rose-200 rounded-md p-2.5 text-sm bg-surface-card focus:ring-2 focus:ring-rose-500 focus:border-rose-500 min-h-[80px]"
                                            placeholder="Describe how this issue was fixed..."
                                            value={closureTexts[obs.id] || ""}
                                            onChange={(e) =>
                                              setClosureTexts((prev) => ({
                                                ...prev,
                                                [obs.id]: e.target.value,
                                              }))
                                            }
                                          />
                                          <div className="mt-3 flex justify-end gap-2">
                                            <button
                                              onClick={() =>
                                                handleResolveObservation(
                                                  item.id,
                                                  obs.id,
                                                )
                                              }
                                              disabled={
                                                resolvingId === obs.id ||
                                                !closureTexts[obs.id]?.trim() ||
                                                uploading === obs.id
                                              }
                                              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
                                            >
                                              <CheckCircle2 className="w-4 h-4" />
                                              {resolvingId === obs.id
                                                ? "Submitting..."
                                                : "Submit Rectification"}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
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
                      onClick={() => setRfiMode("SINGLE")}
                      className={`px-3 py-2 rounded-lg text-sm border ${rfiMode === "SINGLE" ? "bg-secondary-muted border-indigo-300 text-indigo-700" : "border-border-default text-text-secondary"}`}
                    >
                      One Go
                    </button>
                    <button
                      onClick={() => setRfiMode("MULTIPLE")}
                      className={`px-3 py-2 rounded-lg text-sm border ${rfiMode === "MULTIPLE" ? "bg-secondary-muted border-indigo-300 text-indigo-700" : "border-border-default text-text-secondary"}`}
                    >
                      Multiple Go
                    </button>
                  </div>
                  {rfiMode === "MULTIPLE" && (
                    <div>
                      <label className="text-xs font-semibold text-text-secondary">
                        How many parts?
                      </label>
                      <input
                        type="number"
                        min={2}
                        value={rfiParts}
                        onChange={(e) => setRfiParts(Number(e.target.value))}
                        className="w-full mt-1 border border-border-default rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </>
              )}

              {rfiModalActivity.applicabilityLevel === "UNIT" && (
                <div>
                  <label className="text-sm font-medium text-text-secondary">
                    Select Unit(s)
                  </label>
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
                onClick={() => setRfiModalActivity(null)}
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
