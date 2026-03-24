import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  BedDouble,
  Building2,
  ChevronDown,
  ChevronRight,
  CopyPlus,
  DoorOpen,
  Layers,
  MapPin,
  Plus,
  Save,
  Trash2,
  Cuboid,
} from "lucide-react";
import {
  buildingLineCoordinatesService,
  type BuildingLineNode,
  type TowerProgressResponse,
} from "../../services/buildingLineCoordinates.service";
import { useAuth } from "../../context/AuthContext";
import { PermissionCode } from "../../config/permissions";
import BuildingProgress3DTab from "../../components/planning/BuildingProgress3DTab";

type EditableFeature = {
  id: string;
  type: "FLOOR" | "ELEVATION" | "CUSTOM";
  name: string;
  coordinatesText: string;
  heightMeters: string;
  inheritFromBelow?: boolean;
};

type EditableRoom = {
  roomId: number;
  roomName: string;
  roomType?: string | null;
  code?: string | null;
  coordinatesText: string;
};

type EditableUnit = {
  unitId: number;
  unitName: string;
  code?: string | null;
  coordinatesText: string;
  rooms: EditableRoom[];
};

type EditableStructureSnapshot = {
  floorId?: number;
  floorName?: string;
  towerId?: number;
  towerName?: string;
  floorCount?: number;
  unitCount?: number;
  roomCount?: number;
  units?: EditableUnit[];
  floors?: Array<{
    floorId: number;
    floorName: string;
    coordinatesText?: string | null;
    heightMeters?: number | null;
    unitCount?: number;
    roomCount?: number;
    units: EditableUnit[];
  }>;
};

type EditableNode = Omit<BuildingLineNode, "children" | "customFeatures" | "structureSnapshot"> & {
  draftCoordinatesText: string;
  draftCoordinateUom: "mm" | "cm" | "m";
  draftHeightMeters: string;
  draftCustomFeatures: EditableFeature[];
  draftStructureSnapshot: EditableStructureSnapshot | null;
  children: EditableNode[];
};

const EDITABLE_NODE_TYPES = new Set(["BLOCK", "TOWER", "FLOOR", "UNIT", "ROOM"]);

function toEditableStructure(
  snapshot?: BuildingLineNode["structureSnapshot"] | null,
): EditableStructureSnapshot | null {
  if (!snapshot) return null;

  return {
    floorId: snapshot.floorId,
    floorName: snapshot.floorName,
    towerId: snapshot.towerId,
    towerName: snapshot.towerName,
    floorCount: snapshot.floorCount,
    unitCount: snapshot.unitCount,
    roomCount: snapshot.roomCount,
    units: (snapshot.units || []).map((unit) => ({
      unitId: unit.unitId,
      unitName: unit.unitName,
      code: unit.code,
      coordinatesText: unit.coordinatesText || "",
      rooms: (unit.rooms || []).map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        roomType: room.roomType,
        code: room.code,
        coordinatesText: room.coordinatesText || "",
      })),
    })),
    floors: (snapshot.floors || []).map((floor) => ({
      floorId: floor.floorId,
      floorName: floor.floorName,
      coordinatesText: floor.coordinatesText || "",
      heightMeters: floor.heightMeters,
      unitCount: floor.unitCount,
      roomCount: floor.roomCount,
      units: (floor.units || []).map((unit) => ({
        unitId: unit.unitId,
        unitName: unit.unitName,
        code: unit.code,
        coordinatesText: unit.coordinatesText || "",
        rooms: (unit.rooms || []).map((room) => ({
          roomId: room.roomId,
          roomName: room.roomName,
          roomType: room.roomType,
          code: room.code,
          coordinatesText: room.coordinatesText || "",
        })),
      })),
    })),
  };
}

function serializeStructure(snapshot: EditableStructureSnapshot | null) {
  if (!snapshot) return null;

  return {
    ...snapshot,
    units: snapshot.units?.map((unit) => ({
      unitId: unit.unitId,
      unitName: unit.unitName,
      code: unit.code || null,
      coordinatesText: unit.coordinatesText.trim() || null,
      rooms: unit.rooms.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        roomType: room.roomType || null,
        code: room.code || null,
        coordinatesText: room.coordinatesText.trim() || null,
      })),
    })),
    floors: snapshot.floors?.map((floor) => ({
      ...floor,
      coordinatesText: floor.coordinatesText?.trim() || null,
      units: floor.units.map((unit) => ({
        unitId: unit.unitId,
        unitName: unit.unitName,
        code: unit.code || null,
        coordinatesText: unit.coordinatesText.trim() || null,
        rooms: unit.rooms.map((room) => ({
          roomId: room.roomId,
          roomName: room.roomName,
          roomType: room.roomType || null,
          code: room.code || null,
          coordinatesText: room.coordinatesText.trim() || null,
        })),
      })),
    })),
  };
}

function toEditable(node: BuildingLineNode): EditableNode {
  return {
    ...node,
    draftCoordinatesText: node.coordinatesText || "",
    draftCoordinateUom: node.coordinateUom || "mm",
    draftHeightMeters: node.heightMeters != null ? String(node.heightMeters) : "",
    draftCustomFeatures: (node.customFeatures || []).map((feature) => ({
      id: feature.id,
      type: feature.type,
      name: feature.name,
      coordinatesText: feature.coordinatesText || "",
      heightMeters: feature.heightMeters != null ? String(feature.heightMeters) : "",
      inheritFromBelow: !!feature.inheritFromBelow,
    })),
    draftStructureSnapshot: toEditableStructure(node.structureSnapshot),
    children: (node.children || []).map(toEditable),
  };
}

function updateNodeTree(
  node: EditableNode,
  targetId: number,
  updater: (current: EditableNode) => EditableNode,
): EditableNode {
  if (node.id === targetId) return updater(node);
  return {
    ...node,
    children: node.children.map((child) => updateNodeTree(child, targetId, updater)),
  };
}

function copyFloorStructure(
  target: EditableStructureSnapshot | null,
  source: EditableStructureSnapshot | null,
): EditableStructureSnapshot | null {
  if (!target || !source) return target;
  const sourceUnits = source.units || [];
  return {
    ...target,
    units: (target.units || []).map((targetUnit, unitIndex) => {
      const sourceUnit =
        sourceUnits.find((candidate) => candidate.unitName === targetUnit.unitName) ||
        sourceUnits[unitIndex];
      const sourceRooms = sourceUnit?.rooms || [];
      return {
        ...targetUnit,
        coordinatesText: sourceUnit?.coordinatesText || "",
        rooms: targetUnit.rooms.map((targetRoom, roomIndex) => {
          const sourceRoom =
            sourceRooms.find((candidate) => candidate.roomName === targetRoom.roomName) ||
            sourceRooms[roomIndex];
          return { ...targetRoom, coordinatesText: sourceRoom?.coordinatesText || "" };
        }),
      };
    }),
  };
}

function cloneCoordinatesFromSource(target: EditableNode, source?: EditableNode | null): EditableNode {
  if (!source) return target;
  return {
    ...target,
    draftCoordinatesText: source.draftCoordinatesText || source.coordinatesText || "",
    draftCustomFeatures: source.draftCustomFeatures.map((feature) => ({ ...feature })),
    draftStructureSnapshot: copyFloorStructure(
      target.draftStructureSnapshot,
      source.draftStructureSnapshot,
    ),
    children: target.children.map((child, index) =>
      cloneCoordinatesFromSource(child, source.children[index]),
    ),
  };
}

function cloneFloorFromBelow(node: EditableNode, targetFloorId: number): EditableNode {
  const childIndex = node.children.findIndex((child) => child.id === targetFloorId);
  if (childIndex > 0) {
    const targetFloor = node.children[childIndex];
    const sourceFloor = node.children[childIndex - 1];
    const nextChildren = [...node.children];
    nextChildren[childIndex] = {
      ...cloneCoordinatesFromSource(targetFloor, sourceFloor),
      draftHeightMeters: targetFloor.draftHeightMeters,
    };
    return { ...node, children: nextChildren };
  }

  return {
    ...node,
    children: node.children.map((child) => cloneFloorFromBelow(child, targetFloorId)),
  };
}

export default function BuildingLineCoordinatesPage() {
  const { projectId } = useParams();
  const location = useLocation();
  const pathMatch = location.pathname.match(/\/dashboard\/projects\/(\d+)/);
  const pId = Number(projectId || pathMatch?.[1] || 0);
  const { hasPermission } = useAuth();
  const canWrite = hasPermission(PermissionCode.PLANNING_MATRIX_UPDATE);
  const [root, setRoot] = useState<EditableNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [expandedUnitKeys, setExpandedUnitKeys] = useState<Set<string>>(new Set());
  const [expandedRoomKeys, setExpandedRoomKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"EDITOR" | "PROGRESS_3D">("EDITOR");
  const [towerProgress, setTowerProgress] = useState<TowerProgressResponse | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const loadTowerProgress = async (projectNumber: number) => {
    if (!projectNumber) return;
    setLoadingProgress(true);
    try {
      const progress = await buildingLineCoordinatesService.getTowerProgress(projectNumber);
      setTowerProgress(progress);
    } catch {
      setTowerProgress({ towers: [] });
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    if (!pId) {
      setRoot(null);
      setLoadError("No active project was found in the current route.");
      return;
    }
    setLoading(true);
    setLoadError("");
    buildingLineCoordinatesService
      .getStructure(pId)
      .then((data) => {
        const editable = toEditable(data);
        setRoot(editable);
        setExpandedIds(new Set([editable.id, ...(editable.children || []).map((child) => child.id)]));
        void loadTowerProgress(pId);
      })
      .catch((error: any) => {
        setRoot(null);
        setLoadError(
          error?.response?.data?.message ||
            "Failed to load EPS structure for this project.",
        );
      })
      .finally(() => setLoading(false));
  }, [pId]);

  const stats = useMemo(() => {
    const counters = { blocks: 0, towers: 0, floors: 0, configured: 0 };
    const walk = (node?: EditableNode | null) => {
      if (!node) return;
      if (node.type === "BLOCK") counters.blocks += 1;
      if (node.type === "TOWER") counters.towers += 1;
      if (node.type === "FLOOR") counters.floors += 1;
      if (node.draftCoordinatesText.trim()) counters.configured += 1;
      node.draftStructureSnapshot?.units?.forEach((unit) => {
        if (unit.coordinatesText.trim()) counters.configured += 1;
        unit.rooms.forEach((room) => {
          if (room.coordinatesText.trim()) counters.configured += 1;
        });
      });
      node.children.forEach(walk);
    };
    walk(root);
    return counters;
  }, [root]);

  const setNodeDraft = (
    nodeId: number,
    field: "draftCoordinatesText" | "draftHeightMeters" | "draftCoordinateUom",
    value: string | "mm" | "cm" | "m",
  ) => {
    setRoot((prev) =>
      prev ? updateNodeTree(prev, nodeId, (node) => ({ ...node, [field]: value })) : prev,
    );
  };

  const updateNodeStructure = (
    nodeId: number,
    updater: (snapshot: EditableStructureSnapshot | null) => EditableStructureSnapshot | null,
  ) => {
    setRoot((prev) =>
      prev
        ? updateNodeTree(prev, nodeId, (node) => ({
            ...node,
            draftStructureSnapshot: updater(node.draftStructureSnapshot),
          }))
        : prev,
    );
  };

  const updateUnitCoordinates = (nodeId: number, unitId: number, value: string) => {
    updateNodeStructure(nodeId, (snapshot) => {
      if (!snapshot?.units) return snapshot;
      return {
        ...snapshot,
        units: snapshot.units.map((unit) =>
          unit.unitId === unitId ? { ...unit, coordinatesText: value } : unit,
        ),
      };
    });
  };

  const updateRoomCoordinates = (
    nodeId: number,
    unitId: number,
    roomId: number,
    value: string,
  ) => {
    updateNodeStructure(nodeId, (snapshot) => {
      if (!snapshot?.units) return snapshot;
      return {
        ...snapshot,
        units: snapshot.units.map((unit) =>
          unit.unitId === unitId
            ? {
                ...unit,
                rooms: unit.rooms.map((room) =>
                  room.roomId === roomId ? { ...room, coordinatesText: value } : room,
                ),
              }
            : unit,
        ),
      };
    });
  };

  const updateCustomFeature = (
    nodeId: number,
    featureId: string,
    field: "name" | "type" | "coordinatesText" | "heightMeters" | "inheritFromBelow",
    value: string | boolean,
  ) => {
    setRoot((prev) =>
      prev
        ? updateNodeTree(prev, nodeId, (node) => ({
            ...node,
            draftCustomFeatures: node.draftCustomFeatures.map((feature) =>
              feature.id === featureId ? { ...feature, [field]: value } : feature,
            ),
          }))
        : prev,
    );
  };

  const addCustomFeature = (nodeId: number, type: "FLOOR" | "ELEVATION" | "CUSTOM") => {
    setRoot((prev) =>
      prev
        ? updateNodeTree(prev, nodeId, (node) => ({
            ...node,
            draftCustomFeatures: [
              ...node.draftCustomFeatures,
              {
                id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type,
                name:
                  type === "FLOOR"
                    ? "Custom Floor"
                    : type === "ELEVATION"
                      ? "Elevation Marker"
                      : "Custom Feature",
                coordinatesText: "",
                heightMeters: "",
                inheritFromBelow: false,
              },
            ],
          }))
        : prev,
    );
  };

  const removeCustomFeature = (nodeId: number, featureId: string) => {
    setRoot((prev) =>
      prev
        ? updateNodeTree(prev, nodeId, (node) => ({
            ...node,
            draftCustomFeatures: node.draftCustomFeatures.filter(
              (feature) => feature.id !== featureId,
            ),
          }))
        : prev,
    );
  };

  const toggleExpand = (nodeId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleSetItem = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async (node: EditableNode) => {
    setSavingId(node.id);
    try {
      await buildingLineCoordinatesService.saveNode(pId, node.id, {
        coordinatesText: node.draftCoordinatesText.trim() || null,
        coordinateUom: node.draftCoordinateUom,
        heightMeters: node.draftHeightMeters.trim()
          ? Number(node.draftHeightMeters)
          : null,
        customFeatures: node.draftCustomFeatures.map((feature) => ({
          id: feature.id,
          type: feature.type,
          name: feature.name,
          coordinatesText: feature.coordinatesText.trim() || null,
          heightMeters: feature.heightMeters.trim()
            ? Number(feature.heightMeters)
            : null,
          inheritFromBelow: !!feature.inheritFromBelow,
        })),
        structureSnapshot: serializeStructure(node.draftStructureSnapshot),
      });
      alert(`${node.name} coordinates saved.`);
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to save coordinates.");
    } finally {
      setSavingId(null);
    }
  };

  const handleSameAsBelowFloor = (floorId: number) => {
    setRoot((prev) => (prev ? cloneFloorFromBelow(prev, floorId) : prev));
  };

  const renderFloorStructureEditor = (node: EditableNode) => {
    const units = node.draftStructureSnapshot?.units || [];
    if (units.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border-default px-4 py-3 text-sm text-text-muted">
          No units and rooms are mapped to this floor yet. Create the QA/QC floor structure first,
          then the coordinate editor will appear here.
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-border-default bg-surface-card px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Floor Unit and Room Coordinates
            </div>
            <div className="text-xs text-text-muted">
              Click a unit to enter its outline. Under each unit, click a room to save room-level
              geometry for 3D progress.
            </div>
          </div>
          <div className="text-xs text-text-secondary">
            {units.length} units • {units.reduce((sum, unit) => sum + unit.rooms.length, 0)} rooms
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {units.map((unit) => {
            const unitKey = `${node.id}-${unit.unitId}`;
            const unitExpanded = expandedUnitKeys.has(unitKey);
            return (
              <div
                key={unit.unitId}
                className="rounded-xl border border-border-default bg-surface-base"
              >
                <button
                  type="button"
                  onClick={() => toggleSetItem(setExpandedUnitKeys, unitKey)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-surface-card p-2 text-text-secondary">
                      <BedDouble className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{unit.unitName}</div>
                      <div className="text-xs text-text-muted">
                        {unit.rooms.length} rooms{unit.code ? ` • ${unit.code}` : ""}
                      </div>
                    </div>
                  </div>
                  {unitExpanded ? (
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-text-muted" />
                  )}
                </button>

                {unitExpanded ? (
                  <div className="border-t border-border-subtle px-4 py-4 space-y-4">
                    <label className="space-y-2">
                      <div className="text-sm font-medium text-text-primary">
                        Unit Coordinates
                      </div>
                      <textarea
                        rows={3}
                        value={unit.coordinatesText}
                        onChange={(e) =>
                          updateUnitCoordinates(node.id, unit.unitId, e.target.value)
                        }
                        disabled={!canWrite}
                        placeholder="Paste unit coordinates"
                        className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
                      />
                    </label>

                    <div className="space-y-2">
                      {unit.rooms.map((room) => {
                        const roomKey = `${node.id}-${unit.unitId}-${room.roomId}`;
                        const roomExpanded = expandedRoomKeys.has(roomKey);
                        return (
                          <div
                            key={room.roomId}
                            className="rounded-xl border border-border-default bg-white"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSetItem(setExpandedRoomKeys, roomKey)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-surface-base p-2 text-text-secondary">
                                  <DoorOpen className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-text-primary">
                                    {room.roomName}
                                  </div>
                                  <div className="text-xs text-text-muted">
                                    {room.roomType || "Room"}
                                    {room.code ? ` • ${room.code}` : ""}
                                  </div>
                                </div>
                              </div>
                              {roomExpanded ? (
                                <ChevronDown className="h-4 w-4 text-text-muted" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-text-muted" />
                              )}
                            </button>

                            {roomExpanded ? (
                              <div className="border-t border-border-subtle px-4 py-4">
                                <textarea
                                  rows={3}
                                  value={room.coordinatesText}
                                  onChange={(e) =>
                                    updateRoomCoordinates(
                                      node.id,
                                      unit.unitId,
                                      room.roomId,
                                      e.target.value,
                                    )
                                  }
                                  disabled={!canWrite}
                                  placeholder="Paste room coordinates"
                                  className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSnapshotPreview = (node: EditableNode) => {
    const floors = node.draftStructureSnapshot?.floors || [];
    if ((node.type !== "BLOCK" && node.type !== "TOWER") || floors.length === 0) {
      return null;
    }

    return (
      <div className="rounded-2xl border border-border-default bg-surface-card px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <CopyPlus className="h-4 w-4 text-secondary" />
          Floor Snapshot
        </div>
        <div className="mt-3 space-y-3">
          {floors.map((floor) => (
            <div
              key={floor.floorId}
              className="rounded-xl border border-border-subtle bg-surface-base px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-text-primary">{floor.floorName}</div>
                <div className="text-xs text-text-secondary">
                  {floor.unitCount || 0} units • {floor.roomCount || 0} rooms
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {floor.units.map((unit) => (
                  <div
                    key={unit.unitId}
                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs text-text-secondary"
                  >
                    <div className="font-semibold text-text-primary">{unit.unitName}</div>
                    <div className="mt-1">
                      {(unit.rooms || []).map((room) => room.roomName).join(", ") || "No rooms defined"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNode = (node: EditableNode, depth = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const structure = node.draftStructureSnapshot;
    const showEditor = EDITABLE_NODE_TYPES.has(node.type);
    const showFloorCloneAction = node.type === "FLOOR";
    const saveLabel = node.type === "FLOOR" ? "Save Floor Layout" : "Save Coordinates";

    return (
      <div key={node.id} className="space-y-3">
        <div
          className="rounded-2xl border border-border-default bg-surface-card"
          style={{ marginLeft: depth * 16 }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(node.id)}
                  className="rounded-lg border border-border-default p-1 text-text-muted hover:bg-surface-raised"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="w-8" />
              )}
              <div className="rounded-xl bg-surface-raised p-2 text-text-secondary">
                {node.type === "BLOCK" ? (
                  <Layers className="h-4 w-4" />
                ) : node.type === "TOWER" ? (
                  <Building2 className="h-4 w-4" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">{node.name}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  {node.type}
                </div>
              </div>
            </div>
            {structure ? (
              <div className="text-xs text-text-secondary">
                {structure.floorCount || (structure.floorId ? 1 : 0)} floors •{" "}
                {structure.unitCount || 0} units • {structure.roomCount || 0} rooms
              </div>
            ) : null}
          </div>

          {showEditor ? (
            <div className="space-y-4 border-t border-border-subtle bg-surface-base px-4 py-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_180px_220px]">
                <label className="space-y-2">
                  <div className="text-sm font-medium text-text-primary">
                    {node.type === "FLOOR" ? "Floor Coordinates" : "Building Line Coordinates"}
                  </div>
                  <textarea
                    rows={5}
                    value={node.draftCoordinatesText}
                    onChange={(e) => setNodeDraft(node.id, "draftCoordinatesText", e.target.value)}
                    disabled={!canWrite}
                    placeholder="Paste coordinates here. Example: [[x1,y1],[x2,y2],[x3,y3]]"
                    className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-medium text-text-primary">Coordinates UOM</div>
                  <select
                    value={node.draftCoordinateUom}
                    onChange={(e) =>
                      setNodeDraft(
                        node.id,
                        "draftCoordinateUom",
                        e.target.value as "mm" | "cm" | "m",
                      )
                    }
                    disabled={!canWrite}
                    className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
                  >
                    <option value="mm">Millimetre (mm)</option>
                    <option value="cm">Centimetre (cm)</option>
                    <option value="m">Metre (m)</option>
                  </select>
                  <div className="text-xs text-text-muted">
                    Coordinates will be converted to metres for the 3D renderer.
                  </div>
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-medium text-text-primary">Height (m)</div>
                  <input
                    type="number"
                    step="0.001"
                    value={node.draftHeightMeters}
                    onChange={(e) => setNodeDraft(node.id, "draftHeightMeters", e.target.value)}
                    disabled={!canWrite}
                    placeholder="Enter height"
                    className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleSave(node)}
                    disabled={!canWrite || savingId === node.id}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {savingId === node.id ? "Saving..." : saveLabel}
                  </button>
                  {showFloorCloneAction ? (
                    <button
                      type="button"
                      onClick={() => handleSameAsBelowFloor(node.id)}
                      disabled={!canWrite}
                      className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-card px-4 py-2 text-sm font-semibold text-text-primary disabled:opacity-50"
                    >
                      <CopyPlus className="h-4 w-4" />
                      Copy Below Floor Geometry
                    </button>
                  ) : null}
                </label>
              </div>

              {node.type === "FLOOR" ? renderFloorStructureEditor(node) : null}

              <div className="rounded-2xl border border-border-default bg-surface-card px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">
                      Custom Coordinate Features
                    </div>
                    <div className="text-xs text-text-muted">
                      Use this only for extra geometry beyond the standard block-floor-unit-room
                      structure.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addCustomFeature(node.id, "FLOOR")}
                      disabled={!canWrite}
                      className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add Custom Floor
                    </button>
                    <button
                      type="button"
                      onClick={() => addCustomFeature(node.id, "ELEVATION")}
                      disabled={!canWrite}
                      className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add Elevation
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {node.draftCustomFeatures.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border-default px-4 py-3 text-sm text-text-muted">
                      No custom features added for this element yet.
                    </div>
                  ) : (
                    node.draftCustomFeatures.map((feature) => (
                      <div
                        key={feature.id}
                        className="rounded-xl border border-border-default bg-surface-base p-4"
                      >
                        <div className="grid gap-3 lg:grid-cols-[160px_1fr_160px_auto]">
                          <select
                            value={feature.type}
                            disabled={!canWrite}
                            onChange={(e) =>
                              updateCustomFeature(node.id, feature.id, "type", e.target.value)
                            }
                            className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
                          >
                            <option value="FLOOR">Custom Floor</option>
                            <option value="ELEVATION">Elevation</option>
                            <option value="CUSTOM">Custom</option>
                          </select>
                          <input
                            type="text"
                            value={feature.name}
                            disabled={!canWrite}
                            onChange={(e) =>
                              updateCustomFeature(node.id, feature.id, "name", e.target.value)
                            }
                            placeholder="Feature name"
                            className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
                          />
                          <input
                            type="number"
                            step="0.001"
                            value={feature.heightMeters}
                            disabled={!canWrite}
                            onChange={(e) =>
                              updateCustomFeature(
                                node.id,
                                feature.id,
                                "heightMeters",
                                e.target.value,
                              )
                            }
                            placeholder="Height (m)"
                            className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeCustomFeature(node.id, feature.id)}
                            disabled={!canWrite}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-3 py-2 text-rose-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={feature.coordinatesText}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateCustomFeature(
                              node.id,
                              feature.id,
                              "coordinatesText",
                              e.target.value,
                            )
                          }
                          placeholder="Enter custom coordinates"
                          className="mt-3 w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {renderSnapshotPreview(node)}
            </div>
          ) : null}
        </div>

        {hasChildren && isExpanded ? (
          <div className="space-y-3">{node.children.map((child) => renderNode(child, depth + 1))}</div>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return <div className="text-sm text-text-muted">Loading building line coordinates...</div>;
  }

  if (!root) {
    return (
      <div className="rounded-xl border border-dashed border-border-default bg-surface-card px-4 py-6 text-sm text-text-muted">
        {loadError || "No EPS structure available for this project."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border-default bg-surface-card p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          3D Preparation
        </div>
        <div className="mt-2 text-2xl font-bold text-text-primary">
          Building Line Coordinates
        </div>
        <div className="mt-2 max-w-4xl text-sm text-text-secondary">
          Configure geometry at block, tower, floor, unit, and room level so the 3D progress
          viewer can stop exactly at the depth the user wants to present. Repeated floors can be
          copied from the floor below and then adjusted only for height.
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-surface-base px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Blocks</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">{stats.blocks}</div>
          </div>
          <div className="rounded-2xl bg-surface-base px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Towers</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">{stats.towers}</div>
          </div>
          <div className="rounded-2xl bg-surface-base px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Floors</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">{stats.floors}</div>
          </div>
          <div className="rounded-2xl bg-surface-base px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-text-muted">
              Configured Elements
            </div>
            <div className="mt-2 text-3xl font-bold text-text-primary">{stats.configured}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("EDITOR")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold ${
              activeTab === "EDITOR"
                ? "bg-primary text-white"
                : "border border-border-default bg-surface-base text-text-primary"
            }`}
          >
            <Layers className="h-4 w-4" />
            Coordinate Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PROGRESS_3D")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold ${
              activeTab === "PROGRESS_3D"
                ? "bg-primary text-white"
                : "border border-border-default bg-surface-base text-text-primary"
            }`}
          >
            <Cuboid className="h-4 w-4" />
            3D Progress Model
          </button>
        </div>
      </div>

      {activeTab === "EDITOR" ? (
        <div className="space-y-4">{renderNode(root)}</div>
      ) : (
        <BuildingProgress3DTab
          root={root}
          towerProgress={towerProgress}
          loadingProgress={loadingProgress}
          onRefresh={() => {
            void loadTowerProgress(pId);
          }}
        />
      )}
    </div>
  );
}
