import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  CopyPlus,
  Layers,
  MapPin,
  Save,
} from "lucide-react";
import { buildingLineCoordinatesService, type BuildingLineNode } from "../../services/buildingLineCoordinates.service";
import { useAuth } from "../../context/AuthContext";
import { PermissionCode } from "../../config/permissions";

type EditableNode = Omit<BuildingLineNode, "children"> & {
  draftCoordinatesText: string;
  draftHeightMeters: string;
  children: EditableNode[];
};

function toEditable(node: BuildingLineNode): EditableNode {
  return {
    ...node,
    draftCoordinatesText: node.coordinatesText || "",
    draftHeightMeters:
      node.heightMeters != null ? String(node.heightMeters) : "",
    children: (node.children || []).map(toEditable),
  };
}

function updateNodeTree(
  node: EditableNode,
  targetId: number,
  updater: (current: EditableNode) => EditableNode,
): EditableNode {
  if (node.id === targetId) {
    return updater(node);
  }
  return {
    ...node,
    children: node.children.map((child) => updateNodeTree(child, targetId, updater)),
  };
}

export default function BuildingLineCoordinatesPage() {
  const { projectId } = useParams();
  const pId = Number(projectId);
  const { hasPermission } = useAuth();
  const canWrite = hasPermission(PermissionCode.PLANNING_MATRIX_UPDATE);
  const [root, setRoot] = useState<EditableNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!pId) return;
    setLoading(true);
    buildingLineCoordinatesService
      .getStructure(pId)
      .then((data) => {
        const editable = toEditable(data);
        setRoot(editable);
        setExpandedIds(new Set([editable.id, ...(editable.children || []).map((child) => child.id)]));
      })
      .finally(() => setLoading(false));
  }, [pId]);

  const stats = useMemo(() => {
    const counters = {
      blocks: 0,
      towers: 0,
      configured: 0,
    };
    const walk = (node?: EditableNode | null) => {
      if (!node) return;
      if (node.type === "BLOCK") counters.blocks += 1;
      if (node.type === "TOWER") counters.towers += 1;
      if ((node.coordinatesText || "").trim()) counters.configured += 1;
      node.children.forEach(walk);
    };
    walk(root);
    return counters;
  }, [root]);

  const setNodeDraft = (
    nodeId: number,
    field: "draftCoordinatesText" | "draftHeightMeters",
    value: string,
  ) => {
    setRoot((prev) => (prev ? updateNodeTree(prev, nodeId, (node) => ({ ...node, [field]: value })) : prev));
  };

  const toggleExpand = (nodeId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleSave = async (node: EditableNode) => {
    setSavingId(node.id);
    try {
      await buildingLineCoordinatesService.saveNode(pId, node.id, {
        coordinatesText: node.draftCoordinatesText.trim() || null,
        heightMeters: node.draftHeightMeters.trim()
          ? Number(node.draftHeightMeters)
          : null,
        structureSnapshot: node.structureSnapshot || null,
      });
      setRoot((prev) =>
        prev
          ? updateNodeTree(prev, node.id, (current) => ({
              ...current,
              coordinatesText: current.draftCoordinatesText,
              heightMeters: current.draftHeightMeters.trim()
                ? Number(current.draftHeightMeters)
                : null,
            }))
          : prev,
      );
      alert(`${node.name} coordinates saved.`);
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to save coordinates.");
    } finally {
      setSavingId(null);
    }
  };

  const renderNode = (node: EditableNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const structure = node.structureSnapshot;
    const showEditor = node.type === "BLOCK" || node.type === "TOWER";

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
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
                <div className="text-sm font-semibold text-text-primary">
                  {node.name}
                </div>
                <div className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  {node.type}
                </div>
              </div>
            </div>
            {structure ? (
              <div className="text-xs text-text-secondary">
                {structure.floorCount || 0} floors • {structure.unitCount || 0} units • {structure.roomCount || 0} rooms
              </div>
            ) : null}
          </div>

          {showEditor ? (
            <div className="border-t border-border-subtle px-4 py-4 space-y-4 bg-surface-base">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <label className="space-y-2">
                  <div className="text-sm font-medium text-text-primary">
                    Building Line Coordinates
                  </div>
                  <textarea
                    rows={5}
                    value={node.draftCoordinatesText}
                    onChange={(e) =>
                      setNodeDraft(node.id, "draftCoordinatesText", e.target.value)
                    }
                    disabled={!canWrite}
                    placeholder="Paste coordinates here. Example: [[x1,y1],[x2,y2],[x3,y3]]"
                    className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-medium text-text-primary">
                    Height (m)
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    value={node.draftHeightMeters}
                    onChange={(e) =>
                      setNodeDraft(node.id, "draftHeightMeters", e.target.value)
                    }
                    disabled={!canWrite}
                    placeholder="Enter height"
                    className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSave(node)}
                    disabled={!canWrite || savingId === node.id}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {savingId === node.id ? "Saving..." : "Save Coordinates"}
                  </button>
                </label>
              </div>

              {structure?.floors?.length ? (
                <div className="rounded-2xl border border-border-default bg-surface-card px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <CopyPlus className="h-4 w-4 text-secondary" />
                    QA/QC Structure Snapshot
                  </div>
                  <div className="mt-3 space-y-3">
                    {structure.floors.map((floor) => (
                      <div key={floor.floorId} className="rounded-xl border border-border-subtle bg-surface-base px-3 py-3">
                        <div className="text-sm font-medium text-text-primary">
                          {floor.floorName}
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {floor.units.map((unit) => (
                            <div key={unit.unitId} className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs text-text-secondary">
                              <div className="font-semibold text-text-primary">{unit.unitName}</div>
                              <div className="mt-1">
                                {(unit.rooms || []).length > 0
                                  ? unit.rooms
                                      .map((room) =>
                                        room.roomType
                                          ? `${room.roomName} (${room.roomType})`
                                          : room.roomName,
                                      )
                                      .join(", ")
                                  : "No rooms defined"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border-default px-4 py-3 text-sm text-text-muted">
                  No QA/QC unit-room structure found for this element yet.
                </div>
              )}
            </div>
          ) : null}
        </div>

        {hasChildren && isExpanded ? (
          <div className="space-y-3">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return <div className="text-sm text-text-muted">Loading building line coordinates...</div>;
  }

  if (!root) {
    return <div className="text-sm text-text-muted">No EPS structure available for this project.</div>;
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
        <div className="mt-2 max-w-3xl text-sm text-text-secondary">
          Capture block and tower line coordinates, element heights, and the
          QA/QC unit-room structure snapshot that will later drive 3D progress
          visualization.
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-surface-base px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Blocks</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">{stats.blocks}</div>
          </div>
          <div className="rounded-2xl bg-surface-base px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Towers</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">{stats.towers}</div>
          </div>
          <div className="rounded-2xl bg-surface-base px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Configured Elements</div>
            <div className="mt-2 text-3xl font-bold text-text-primary">{stats.configured}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">{renderNode(root)}</div>
    </div>
  );
}
