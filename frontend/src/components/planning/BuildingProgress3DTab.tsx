import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Layers3,
  ListTree,
  Move3d,
  RefreshCw,
  ScanSearch,
} from "lucide-react";
import type {
  BuildingLineNode,
  TowerProgressResponse,
} from "../../services/buildingLineCoordinates.service";

type RenderDepth = "FLOOR" | "UNIT" | "ROOM";
type RenderMode = "AUTO" | RenderDepth;
type GeometryLevel = "PROJECT" | "BLOCK" | "TOWER" | "FLOOR" | "UNIT" | "ROOM";
type CoordinateUom = "mm" | "cm" | "m";

type ModelEntry = {
  id: string;
  towerId: number | null;
  towerName: string;
  floorId: number | null;
  floorName: string;
  level: GeometryLevel;
  geometrySource: GeometryLevel;
  label: string;
  progressPct: number;
  z: number;
  height: number;
  polygon: Array<[number, number]>;
  activityIds: number[];
  metrics: {
    totalActivities: number;
    completedActivities: number;
    inProgressActivities: number;
    pendingActivities: number;
    pendingRfis: number;
  };
};

type OverlayEntry = ModelEntry & {
  overlayColor: string;
  scheduleLabel: string;
};

type FloorProgressMap = Map<
  number,
  {
    progressPct: number;
    totalActivities: number;
    completedActivities: number;
    inProgressActivities: number;
    pendingActivities: number;
    pendingRfis: number;
  }
>;

type TreeNode = BuildingLineNode & { children: TreeNode[] };

type BuildingProgress3DTabProps = {
  root: TreeNode;
  towerProgress: TowerProgressResponse | null;
  loadingProgress: boolean;
  onRefresh: () => void;
  displayMode?: "full" | "viewerOnly";
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  viewerClassName?: string;
  panelTitle?: string;
  panelSubtitle?: string;
};

type ActivityTreeTower = {
  towerId: number;
  towerName: string;
  floors: Array<{
    floorId: number;
    floorName: string;
    activities: Array<{
      id: number;
      activityCode: string;
      activityName: string;
      progressPct: number;
      budgetedValue?: number;
      actualValue?: number;
      status: string;
      finishDatePlanned: string | null;
      schedulePath?: string[];
    }>;
  }>;
};

type ScheduleLegendItem = {
  key: string;
  label: string;
  color: string;
  activityCount: number;
  floorCount: number;
  averageProgress: number;
};

const SCHEDULE_LEVEL_STORAGE_KEY = "setu.building-progress.schedule-level";
const SCHEDULE_COLORS = [
  "#2563eb",
  "#0f766e",
  "#d97706",
  "#be123c",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#c2410c",
  "#4338ca",
  "#0f766e",
];

function parseCoordinatePairs(
  coordinatesText?: string | null,
  coordinateUom: CoordinateUom = "m",
): Array<[number, number]> | null {
  if (!coordinatesText?.trim()) return null;

  const raw = coordinatesText.trim();
  const tryParseArray = (value: unknown): Array<[number, number]> | null => {
    if (!Array.isArray(value)) return null;
    const pairs = value
      .map((point) => {
        if (Array.isArray(point) && point.length >= 2) {
          const x = Number(point[0]);
          const y = Number(point[1]);
          if (Number.isFinite(x) && Number.isFinite(y)) return [x, y] as [number, number];
        }
        if (point && typeof point === "object") {
          const maybePoint = point as Record<string, unknown>;
          const x = Number(maybePoint.x);
          const y = Number(maybePoint.y);
          if (Number.isFinite(x) && Number.isFinite(y)) return [x, y] as [number, number];
        }
        return null;
      })
      .filter(Boolean) as Array<[number, number]>;

    return pairs.length >= 3 ? pairs : null;
  };

  const scale =
    coordinateUom === "mm" ? 0.001 : coordinateUom === "cm" ? 0.01 : 1;

  try {
    const parsed = JSON.parse(raw);
    const direct = tryParseArray(parsed);
    if (direct) return direct.map(([x, y]) => [x * scale, y * scale]);
    if (parsed && typeof parsed === "object") {
      const objectPoints = tryParseArray((parsed as Record<string, unknown>).points);
      if (objectPoints) return objectPoints.map(([x, y]) => [x * scale, y * scale]);
      const objectCoords = tryParseArray((parsed as Record<string, unknown>).coordinates);
      if (objectCoords) return objectCoords.map(([x, y]) => [x * scale, y * scale]);
    }
  } catch {
    // Fall through to tolerant parsing below.
  }

  const matches = raw.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 6) return null;
  const values = matches.map(Number).filter((value) => Number.isFinite(value));
  if (values.length < 6) return null;

  const points: Array<[number, number]> = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    points.push([values[index], values[index + 1]]);
  }
  return points.length >= 3 ? points.map(([x, y]) => [x * scale, y * scale]) : null;
}

function polygonArea(points: Array<[number, number]>) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function toShape(points: Array<[number, number]>) {
  const normalized = polygonArea(points) < 0 ? [...points].reverse() : points;
  const shape = new THREE.Shape();
  normalized.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function getPlanCenter(entries: ModelEntry[]) {
  if (entries.length === 0) {
    return { x: 0, y: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  entries.forEach((entry) => {
    entry.polygon.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY)
  ) {
    return { x: 0, y: 0 };
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

function fitIsometricCamera(
  camera: THREE.OrthographicCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
  aspect: number,
) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const paddedHalfWidth = Math.max(size.x, size.y) * 0.7 + maxDimension * 0.15;
  const paddedHalfHeight = Math.max(size.z * 0.8, maxDimension * 0.45);
  const halfHeight = Math.max(paddedHalfHeight, paddedHalfWidth / Math.max(aspect, 0.1));
  const halfWidth = halfHeight * aspect;

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.near = 0.1;
  camera.far = Math.max(5000, maxDimension * 20);

  const isoDirection = new THREE.Vector3(1.05, -1.15, 1.35).normalize();
  const distance = Math.max(maxDimension * 2.8, 220);
  camera.position.copy(center.clone().addScaledVector(isoDirection, distance));
  camera.up.set(0, 0, 1);
  camera.lookAt(center);
  camera.zoom = 1;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

function getProgressColor(progressPct: number) {
  if (progressPct >= 95) return "#16a34a";
  if (progressPct >= 65) return "#0ea5e9";
  if (progressPct >= 35) return "#f59e0b";
  if (progressPct > 0) return "#f97316";
  return "#94a3b8";
}

function getFloorSortKey(name: string) {
  const lower = (name || "").trim().toLowerCase();
  if (!lower) return 5000;
  if (lower === "gf" || lower.startsWith("ground")) return 0;
  if (lower.includes("terrace") || lower.includes("roof")) return 9999;
  const match = lower.match(/-?\d+/);
  return match ? Number(match[0]) : 5000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLabel(value?: string | null) {
  return (value || "").trim();
}

function getSchedulePath(
  activity: {
    activityName: string;
    activityCode: string;
    schedulePath?: string[];
  },
) {
  const normalized = (activity.schedulePath || []).map(normalizeLabel).filter(Boolean);
  if (normalized.length > 0) return normalized;
  if (activity.activityName) return [activity.activityName];
  if (activity.activityCode) return [activity.activityCode];
  return ["Unmapped activity"];
}

function getAchievedValueProgressPct(activity: {
  progressPct: number;
  budgetedValue?: number;
  actualValue?: number;
  status?: string;
}) {
  const budgetedValue = Number(activity.budgetedValue ?? 0);
  const actualValue = Number(activity.actualValue ?? 0);
  if (budgetedValue > 0) {
    return clamp((actualValue / budgetedValue) * 100, 0, 100);
  }
  const rawProgress = clamp(Number(activity.progressPct ?? 0), 0, 100);
  if (rawProgress > 0) return rawProgress;

  const status = (activity.status || "").trim().toLowerCase();
  if (status === "completed" || status === "approved" || status === "closed") {
    return 100;
  }
  if (status === "in_progress" || status === "in progress") {
    return 5;
  }
  return 0;
}

function getScheduleLabelAtLevel(
  activity: {
    activityName: string;
    activityCode: string;
    schedulePath?: string[];
  },
  level: number,
) {
  const path = getSchedulePath(activity);
  const index = clamp(level - 1, 0, path.length - 1);
  return path[index] || path[path.length - 1] || "Unmapped activity";
}

function getStoredScheduleLevel() {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(SCHEDULE_LEVEL_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function ensureMinimumScheduleDepth(depth: number) {
  return Math.max(3, depth);
}

function shadeColor(color: string, multiplier: number) {
  return `#${new THREE.Color(color).multiplyScalar(multiplier).getHexString()}`;
}

function mixColor(colorA: string, colorB: string, ratio: number) {
  const mixed = new THREE.Color(colorA);
  mixed.lerp(new THREE.Color(colorB), clamp(ratio, 0, 1));
  return `#${mixed.getHexString()}`;
}

function collectTowerNodes(root: TreeNode) {
  const towers: Array<{
    tower: TreeNode;
    towerId: number;
    towerName: string;
    blockName: string;
    blockPolygon: Array<[number, number]> | null;
    projectPolygon: Array<[number, number]> | null;
    floors: TreeNode[];
  }> = [];

  const walk = (
    node: TreeNode,
    blockName = "",
    blockPolygon: Array<[number, number]> | null = null,
    projectPolygon: Array<[number, number]> | null = null,
  ) => {
    const nextBlockName = node.type === "BLOCK" ? node.name : blockName;
    const nextBlockPolygon =
      node.type === "BLOCK"
        ? parseCoordinatePairs(node.coordinatesText, node.coordinateUom)
        : blockPolygon;
    const nextProjectPolygon =
      node.type === "PROJECT"
        ? parseCoordinatePairs(node.coordinatesText, node.coordinateUom)
        : projectPolygon;
    if (node.type === "TOWER") {
      const floorChildren = [...node.children]
        .filter((child) => child.type === "FLOOR" || child.type === "LEVEL")
        .sort((left, right) => {
          const leftKey = getFloorSortKey(left.name);
          const rightKey = getFloorSortKey(right.name);
          if (leftKey !== rightKey) return leftKey - rightKey;
          return left.name.localeCompare(right.name);
        });
      towers.push({
        tower: node,
        towerId: node.id,
        towerName: node.name,
        blockName: nextBlockName,
        blockPolygon: nextBlockPolygon,
        projectPolygon: nextProjectPolygon,
        floors: floorChildren.length > 0 ? floorChildren : node.children,
      });
    }
    node.children.forEach((child) =>
      walk(child, nextBlockName, nextBlockPolygon, nextProjectPolygon),
    );
  };

  walk(root);
  return towers;
}

function buildFloorProgressMap(towerProgress: TowerProgressResponse | null): FloorProgressMap {
  const map: FloorProgressMap = new Map();
  towerProgress?.towers.forEach((tower) => {
    tower.floors.forEach((floor) => {
      const activityProgress =
        (floor.activities || []).length > 0
          ? (floor.activities || []).reduce(
              (sum, activity) => sum + getAchievedValueProgressPct(activity),
              0,
            ) /
            Math.max(1, (floor.activities || []).length)
          : floor.progressPct;
      map.set(floor.epsNodeId, {
        progressPct: activityProgress,
        totalActivities: floor.totalActivities,
        completedActivities: floor.completedActivities,
        inProgressActivities: floor.inProgressActivities,
        pendingActivities: floor.pendingActivities,
        pendingRfis: floor.pendingRfis,
      });
    });
  });
  return map;
}

function buildTowerProgressMap(towerProgress: TowerProgressResponse | null) {
  const map = new Map<
    number,
    {
      progressPct: number;
      totalActivities: number;
      completedActivities: number;
      inProgressActivities: number;
      pendingActivities: number;
      pendingRfis: number;
    }
  >();

  towerProgress?.towers.forEach((tower) => {
    const totalActivities = tower.floors.reduce((sum, floor) => sum + floor.totalActivities, 0);
    const completedActivities = tower.floors.reduce(
      (sum, floor) => sum + floor.completedActivities,
      0,
    );
    const inProgressActivities = tower.floors.reduce(
      (sum, floor) => sum + floor.inProgressActivities,
      0,
    );
    const pendingActivities = tower.floors.reduce((sum, floor) => sum + floor.pendingActivities, 0);
    const pendingRfis = tower.floors.reduce((sum, floor) => sum + floor.pendingRfis, 0);
    const progressPct =
      totalActivities > 0
        ? (tower.floors.reduce(
            (sum, floor) =>
              sum +
              (((floor.activities || []).length > 0
                ? (floor.activities || []).reduce(
                    (activitySum, activity) =>
                      activitySum + getAchievedValueProgressPct(activity),
                    0,
                  ) / Math.max(1, (floor.activities || []).length)
                : floor.progressPct) *
                floor.totalActivities),
            0,
          ) / totalActivities)
        : 0;

    map.set(tower.epsNodeId, {
      progressPct,
      totalActivities,
      completedActivities,
      inProgressActivities,
      pendingActivities,
      pendingRfis,
    });
  });

  return map;
}

function getVerticalRenderScale(entries: ModelEntry[]) {
  if (entries.length === 0) return 1;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxHeight = 0;

  entries.forEach((entry) => {
    entry.polygon.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    maxHeight = Math.max(maxHeight, entry.z + entry.height);
  });

  const planarSpan = Math.max(maxX - minX, maxY - minY, 1);
  const ratio = planarSpan / Math.max(maxHeight, 1);
  if (!Number.isFinite(ratio) || ratio <= 10) return 1;
  return Math.min(18, Math.max(1, ratio / 8));
}

function buildActivityTree(
  towerProgress: TowerProgressResponse | null,
  selectedTowerId: number | "ALL",
): ActivityTreeTower[] {
  return (towerProgress?.towers || [])
    .filter((tower) => selectedTowerId === "ALL" || tower.epsNodeId === selectedTowerId)
    .map((tower) => ({
      towerId: tower.epsNodeId,
      towerName: tower.towerName,
      floors: tower.floors
        .filter((floor) => (floor.activities || []).length > 0)
        .map((floor) => ({
          floorId: floor.epsNodeId,
          floorName: floor.floorName,
          activities: (floor.activities || []).map((activity) => ({
            id: activity.id,
            activityCode: activity.activityCode,
            activityName: activity.activityName,
            progressPct: getAchievedValueProgressPct(activity),
            budgetedValue: activity.budgetedValue,
            actualValue: activity.actualValue,
            status: activity.status,
            finishDatePlanned: activity.finishDatePlanned,
            schedulePath: activity.schedulePath,
          })),
        })),
    }))
    .filter((tower) => tower.floors.length > 0);
}

function buildSelectedActivityProgressMap(
  towerProgress: TowerProgressResponse | null,
  selectedActivityId: number | "ALL",
) {
  const map = new Map<
    number,
    {
      progressPct: number;
      totalActivities: number;
      completedActivities: number;
      inProgressActivities: number;
      pendingActivities: number;
      pendingRfis: number;
    }
  >();

  if (selectedActivityId === "ALL") return map;

  towerProgress?.towers.forEach((tower) => {
    tower.floors.forEach((floor) => {
      const matchingActivities = (floor.activities || []).filter(
        (activity) => activity.id === selectedActivityId,
      );
      if (matchingActivities.length === 0) return;

      const progressPct =
        matchingActivities.reduce(
          (sum, activity) => sum + getAchievedValueProgressPct(activity),
          0,
        ) /
        matchingActivities.length;
      const completedActivities = matchingActivities.filter(
        (activity) => getAchievedValueProgressPct(activity) >= 100,
      ).length;
      const inProgressActivities = matchingActivities.filter(
        (activity) => {
          const pct = getAchievedValueProgressPct(activity);
          return pct > 0 && pct < 100;
        },
      ).length;

      map.set(floor.epsNodeId, {
        progressPct,
        totalActivities: matchingActivities.length,
        completedActivities,
        inProgressActivities,
        pendingActivities: Math.max(
          0,
          matchingActivities.length - completedActivities - inProgressActivities,
        ),
        pendingRfis: 0,
      });
    });
  });

  return map;
}

function buildScheduleLegendAndFloorMap(
  towerProgress: TowerProgressResponse | null,
  selectedTowerId: number | "ALL",
  selectedActivityId: number | "ALL",
  scheduleLevel: number,
) {
  const relevantTowers = (towerProgress?.towers || []).filter(
    (tower) => selectedTowerId === "ALL" || tower.epsNodeId === selectedTowerId,
  );
  const groupStats = new Map<
    string,
    {
      label: string;
      activityCount: number;
      floorIds: Set<number>;
      totalProgress: number;
    }
  >();
  const floorMap = new Map<
    number,
    {
      label: string;
      activityCount: number;
      progressPct: number;
    }
  >();

  relevantTowers.forEach((tower) => {
    tower.floors.forEach((floor) => {
      const matchingActivities = (floor.activities || []).filter(
        (activity) => selectedActivityId === "ALL" || activity.id === selectedActivityId,
      );
      if (matchingActivities.length === 0) return;

      const floorGroups = new Map<
        string,
        {
          label: string;
          activityCount: number;
          totalProgress: number;
        }
      >();

      matchingActivities.forEach((activity) => {
        const label =
          selectedActivityId === "ALL"
            ? getScheduleLabelAtLevel(activity, scheduleLevel)
            : `${activity.activityCode} - ${activity.activityName}`;
        const current = floorGroups.get(label) || {
          label,
          activityCount: 0,
          totalProgress: 0,
        };
        current.activityCount += 1;
        current.totalProgress += getAchievedValueProgressPct(activity);
        floorGroups.set(label, current);

        const summary = groupStats.get(label) || {
          label,
          activityCount: 0,
          floorIds: new Set<number>(),
          totalProgress: 0,
        };
        summary.activityCount += 1;
        summary.floorIds.add(floor.epsNodeId);
        summary.totalProgress += getAchievedValueProgressPct(activity);
        groupStats.set(label, summary);
      });

      const dominantGroup = Array.from(floorGroups.values()).sort((left, right) => {
        if (right.totalProgress !== left.totalProgress) {
          return right.totalProgress - left.totalProgress;
        }
        if (right.activityCount !== left.activityCount) {
          return right.activityCount - left.activityCount;
        }
        return left.label.localeCompare(right.label);
      })[0];

      if (!dominantGroup) return;

      floorMap.set(floor.epsNodeId, {
        label: dominantGroup.label,
        activityCount: dominantGroup.activityCount,
        progressPct: dominantGroup.totalProgress / dominantGroup.activityCount,
      });
    });
  });

  const legendBase = Array.from(groupStats.values()).sort((left, right) => {
    if (right.activityCount !== left.activityCount) {
      return right.activityCount - left.activityCount;
    }
    return left.label.localeCompare(right.label);
  });

  const legend: ScheduleLegendItem[] = legendBase.map((item, index) => ({
    key: item.label,
    label: item.label,
    color: SCHEDULE_COLORS[index % SCHEDULE_COLORS.length],
    activityCount: item.activityCount,
    floorCount: item.floorIds.size,
    averageProgress: item.activityCount > 0 ? item.totalProgress / item.activityCount : 0,
  }));
  const colorByLabel = new Map(legend.map((item) => [item.label, item.color]));

  return {
    legend,
    floorMap: new Map(
      Array.from(floorMap.entries()).map(([floorId, item]) => [
        floorId,
        {
          ...item,
          color: colorByLabel.get(item.label) || SCHEDULE_COLORS[0],
        },
      ]),
    ),
  };
}

function estimateTowerHeight(
  tower: ReturnType<typeof collectTowerNodes>[number],
  floorEntriesGenerated: number,
) {
  if (floorEntriesGenerated > 0) {
    const summedFloorHeight = tower.floors.reduce(
      (sum, floor) => sum + Math.max(Number(floor.heightMeters || 3.2), 0.5),
      0,
    );
    if (summedFloorHeight > 0) return summedFloorHeight;
  }

  if (tower.tower.heightMeters != null && Number(tower.tower.heightMeters) > 0) {
    return Number(tower.tower.heightMeters);
  }

  const inferredFloorCount =
    tower.tower.structureSnapshot?.floorCount || tower.floors.length || 1;
  return Math.max(inferredFloorCount * 3.2, 3.2);
}

function buildModelEntries(
  root: TreeNode,
  towerProgress: TowerProgressResponse | null,
  selectedTowerId: number | "ALL",
  mode: RenderMode,
) {
  const towers = collectTowerNodes(root);
  const progressByFloor = buildFloorProgressMap(towerProgress);
  const progressByTower = buildTowerProgressMap(towerProgress);
  const entries: ModelEntry[] = [];
  const scopedTowers = towers.filter(
    (tower) => selectedTowerId === "ALL" || tower.towerId === selectedTowerId,
  );

  scopedTowers.forEach((tower) => {
      let currentZ = 0;
      const towerPolygon = parseCoordinatePairs(
        tower.tower.coordinatesText,
        tower.tower.coordinateUom,
      );
      const explicitFloorHeights = tower.floors
        .map((floor) =>
          floor.heightMeters != null && Number(floor.heightMeters) > 0
            ? Number(floor.heightMeters)
            : null,
        )
        .filter((height): height is number => height != null);
      const missingFloorCount = tower.floors.length - explicitFloorHeights.length;
      const towerHeightBudget =
        tower.tower.heightMeters != null && Number(tower.tower.heightMeters) > 0
          ? Number(tower.tower.heightMeters)
          : null;
      const derivedMissingFloorHeight =
        towerHeightBudget && missingFloorCount > 0
          ? Math.max(
              0.5,
              (towerHeightBudget -
                explicitFloorHeights.reduce((sum, height) => sum + height, 0)) /
                missingFloorCount,
            )
          : 3.2;
      const towerProgressSummary = progressByTower.get(tower.towerId) || {
        progressPct: 0,
        totalActivities: 0,
        completedActivities: 0,
        inProgressActivities: 0,
        pendingActivities: 0,
        pendingRfis: 0,
      };
      const towerEntriesStart = entries.length;
      tower.floors.forEach((floorNode, floorIndex) => {
        const floorPolygon = parseCoordinatePairs(
          floorNode.coordinatesText,
          floorNode.coordinateUom,
        );
        const floorHeight =
          floorNode.heightMeters != null && Number(floorNode.heightMeters) > 0
            ? Math.max(Number(floorNode.heightMeters), 0.5)
            : derivedMissingFloorHeight;
        const floorActivityIds =
          towerProgress?.towers
            .find((item) => item.epsNodeId === tower.towerId)
            ?.floors.find((item) => item.epsNodeId === floorNode.id)
            ?.activities?.map((activity) => activity.id) || [];
        const progress = progressByFloor.get(floorNode.id) || {
          progressPct: 0,
          totalActivities: 0,
          completedActivities: 0,
          inProgressActivities: 0,
          pendingActivities: 0,
          pendingRfis: 0,
        };

        const fallbackPolygon =
          floorPolygon || towerPolygon || tower.blockPolygon || tower.projectPolygon;
        const fallbackSource: GeometryLevel = floorPolygon
          ? "FLOOR"
          : towerPolygon
            ? "TOWER"
            : tower.blockPolygon
              ? "BLOCK"
              : "PROJECT";

        if (mode === "FLOOR" && fallbackPolygon) {
          entries.push({
            id: `floor-${floorNode.id}`,
            towerId: tower.towerId,
            towerName: tower.towerName,
            floorId: floorNode.id,
            floorName: floorNode.name,
            level: "FLOOR",
            geometrySource: fallbackSource,
            label: `${tower.towerName} • ${floorNode.name}`,
            progressPct: progress.progressPct,
            z: currentZ,
            height: floorHeight,
            polygon: fallbackPolygon,
            activityIds: floorActivityIds,
            metrics: { ...progress },
          });
        }

        const snapshotUnits = floorNode.structureSnapshot?.units || [];
        const roomEntries: ModelEntry[] = [];
        const unitEntries: ModelEntry[] = [];

        snapshotUnits.forEach((unit) => {
          const unitPolygon = parseCoordinatePairs(
            unit.coordinatesText,
            floorNode.coordinateUom,
          );
          const unitFallbackPolygon = unitPolygon || fallbackPolygon;
          const unitSource: GeometryLevel = unitPolygon ? "UNIT" : fallbackSource;

          if (unitFallbackPolygon) {
            unitEntries.push({
              id: `unit-${unit.unitId}-${floorNode.id}`,
              towerId: tower.towerId,
              towerName: tower.towerName,
              floorId: floorNode.id,
              floorName: floorNode.name,
              level: "UNIT",
              geometrySource: unitSource,
              label: `${floorNode.name} • ${unit.unitName}`,
              progressPct: progress.progressPct,
              z: currentZ + 0.04 * floorHeight,
              height: floorHeight * 0.8,
              polygon: unitFallbackPolygon,
              activityIds: floorActivityIds,
              metrics: { ...progress },
            });
          }

          unit.rooms.forEach((room, roomIndex) => {
            const roomPolygon = parseCoordinatePairs(
              room.coordinatesText,
              floorNode.coordinateUom,
            );
            const roomFallbackPolygon = roomPolygon || unitPolygon || fallbackPolygon;
            if (!roomFallbackPolygon) return;
            const roomSource: GeometryLevel = roomPolygon
              ? "ROOM"
              : unitPolygon
                ? "UNIT"
                : fallbackSource;
            roomEntries.push({
              id: `room-${room.roomId}-${floorNode.id}`,
              towerId: tower.towerId,
              towerName: tower.towerName,
              floorId: floorNode.id,
              floorName: floorNode.name,
              level: "ROOM",
              geometrySource: roomSource,
              label: `${floorNode.name} • ${unit.unitName} • ${room.roomName}`,
              progressPct: progress.progressPct,
              z: currentZ + 0.05 * floorHeight + roomIndex * 0.002,
              height: floorHeight * 0.72,
              polygon: roomFallbackPolygon,
              activityIds: floorActivityIds,
              metrics: { ...progress },
            });
          });

        });

        if (mode === "UNIT") {
          entries.push(...unitEntries);
        } else if (mode === "ROOM") {
          if (roomEntries.length > 0) entries.push(...roomEntries);
          else if (unitEntries.length > 0) entries.push(...unitEntries);
          else if (fallbackPolygon) {
            entries.push({
              id: `room-fallback-${floorNode.id}-${floorIndex}`,
              towerId: tower.towerId,
              towerName: tower.towerName,
              floorId: floorNode.id,
              floorName: floorNode.name,
              level: "ROOM",
              geometrySource: fallbackSource,
              label: `${floorNode.name} • Hierarchy fallback`,
              progressPct: progress.progressPct,
              z: currentZ + 0.04 * floorHeight,
              height: floorHeight * 0.7,
              polygon: fallbackPolygon,
              activityIds: floorActivityIds,
              metrics: { ...progress },
            });
          }
        } else if (mode === "AUTO") {
          if (roomEntries.length > 0) {
            entries.push(...roomEntries);
          } else if (unitEntries.length > 0) {
            entries.push(...unitEntries);
          } else if (fallbackPolygon) {
            entries.push({
              id: `auto-floor-${floorNode.id}`,
              towerId: tower.towerId,
              towerName: tower.towerName,
              floorId: floorNode.id,
              floorName: floorNode.name,
              level: "FLOOR",
              geometrySource: fallbackSource,
              label: `${tower.towerName} • ${floorNode.name}`,
              progressPct: progress.progressPct,
              z: currentZ,
              height: floorHeight,
              polygon: fallbackPolygon,
              activityIds: floorActivityIds,
              metrics: { ...progress },
            });
          }
        }

        if (mode === "UNIT" && unitEntries.length === 0 && fallbackPolygon) {
          entries.push({
            id: `unit-fallback-${floorNode.id}`,
            towerId: tower.towerId,
            towerName: tower.towerName,
            floorId: floorNode.id,
            floorName: floorNode.name,
            level: "UNIT",
            geometrySource: fallbackSource,
            label: `${floorNode.name} • Hierarchy fallback`,
            progressPct: progress.progressPct,
            z: currentZ + 0.03 * floorHeight,
            height: floorHeight * 0.75,
            polygon: fallbackPolygon,
            activityIds: floorActivityIds,
            metrics: { ...progress },
          });
        }

        currentZ += floorHeight;
      });

      if (entries.length === towerEntriesStart) {
        const towerHeight = estimateTowerHeight(tower, tower.floors.length);
        const towerActivityIds =
          towerProgress?.towers
            .find((item) => item.epsNodeId === tower.towerId)
            ?.floors.flatMap((floor) => (floor.activities || []).map((activity) => activity.id)) ||
          [];
        const towerFallbackPolygon =
          towerPolygon ||
          (scopedTowers.length === 1 ? tower.blockPolygon || tower.projectPolygon : null);
        const towerGeometrySource: GeometryLevel = towerPolygon
          ? "TOWER"
          : tower.blockPolygon
            ? "BLOCK"
            : "PROJECT";

        if (towerFallbackPolygon) {
          entries.push({
            id: `tower-fallback-${tower.towerId}`,
            towerId: tower.towerId,
            towerName: tower.towerName,
            floorId: null,
            floorName: "Tower Massing",
            level: "TOWER",
            geometrySource: towerGeometrySource,
            label: `${tower.towerName} - Tower Progress`,
            progressPct: towerProgressSummary.progressPct,
            z: 0,
            height: towerHeight,
            polygon: towerFallbackPolygon,
            activityIds: towerActivityIds,
            metrics: { ...towerProgressSummary },
          });
        }
      }
    });

  if (entries.length === 0) {
    const projectPolygon = parseCoordinatePairs(root.coordinatesText, root.coordinateUom);
    const scopedTowerSummaries = scopedTowers
      .map((tower) => ({
        height: estimateTowerHeight(tower, tower.floors.length),
        metrics: progressByTower.get(tower.towerId) || null,
      }))
      .filter((tower) => tower.metrics);

    const totalActivities = scopedTowerSummaries.reduce(
      (sum, tower) => sum + (tower.metrics?.totalActivities || 0),
      0,
    );
    const plotProgress =
      totalActivities > 0
        ? scopedTowerSummaries.reduce(
            (sum, tower) =>
              sum +
              ((tower.metrics?.progressPct || 0) * (tower.metrics?.totalActivities || 0)),
            0,
          ) / totalActivities
        : 0;
    const plotHeight = Math.max(
      root.heightMeters != null && Number(root.heightMeters) > 0
        ? Number(root.heightMeters)
        : 0,
      scopedTowerSummaries.reduce((max, tower) => Math.max(max, tower.height), 0),
      3.2,
    );

    if (projectPolygon) {
      entries.push({
        id: `project-fallback-${root.id}`,
        towerId: null,
        towerName: root.name,
        floorId: null,
        floorName: "Plot Massing",
        level: "PROJECT",
        geometrySource: "PROJECT",
        label: `${root.name} - Plot Progress`,
        progressPct: plotProgress,
        z: 0,
        height: plotHeight,
        polygon: projectPolygon,
        activityIds: scopedTowers.flatMap(
          (tower) =>
            towerProgress?.towers
              .find((item) => item.epsNodeId === tower.towerId)
              ?.floors.flatMap((floor) => (floor.activities || []).map((activity) => activity.id)) ||
            [],
        ),
        metrics: {
          totalActivities,
          completedActivities: scopedTowerSummaries.reduce(
            (sum, tower) => sum + (tower.metrics?.completedActivities || 0),
            0,
          ),
          inProgressActivities: scopedTowerSummaries.reduce(
            (sum, tower) => sum + (tower.metrics?.inProgressActivities || 0),
            0,
          ),
          pendingActivities: scopedTowerSummaries.reduce(
            (sum, tower) => sum + (tower.metrics?.pendingActivities || 0),
            0,
          ),
          pendingRfis: scopedTowerSummaries.reduce(
            (sum, tower) => sum + (tower.metrics?.pendingRfis || 0),
            0,
          ),
        },
      });
    }
  }

  return entries;
}

export default function BuildingProgress3DTab({
  root,
  towerProgress,
  loadingProgress,
  onRefresh,
  displayMode = "full",
  autoRotate = false,
  autoRotateSpeed = 0.8,
  viewerClassName = "h-[620px]",
  panelTitle,
  panelSubtitle,
}: BuildingProgress3DTabProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number | null>(null);

  const availableTowers = useMemo(() => collectTowerNodes(root), [root]);
  const [selectedTowerId, setSelectedTowerId] = useState<number | "ALL">("ALL");
  const [depth, setDepth] = useState<RenderMode>("AUTO");
  const [selectedActivityId, setSelectedActivityId] = useState<number | "ALL">("ALL");
  const [selectedScheduleLevel, setSelectedScheduleLevel] = useState<number>(getStoredScheduleLevel);
  const [expandedActivityGroups, setExpandedActivityGroups] = useState<Set<string>>(new Set());

  const modelEntries = useMemo(
    () => buildModelEntries(root, towerProgress, selectedTowerId, depth),
    [depth, root, selectedTowerId, towerProgress],
  );
  const activityTree = useMemo(
    () => buildActivityTree(towerProgress, selectedTowerId),
    [selectedTowerId, towerProgress],
  );
  const selectedActivityProgressByFloor = useMemo(
    () => buildSelectedActivityProgressMap(towerProgress, selectedActivityId),
    [selectedActivityId, towerProgress],
  );
  const maxScheduleDepth = useMemo(() => {
    const depths = activityTree.flatMap((tower) =>
      tower.floors.flatMap((floor) => floor.activities.map((activity) => getSchedulePath(activity).length)),
    );
    return ensureMinimumScheduleDepth(Math.max(1, ...depths));
  }, [activityTree]);
  const scheduleVisualization = useMemo(
    () =>
      buildScheduleLegendAndFloorMap(
        towerProgress,
        selectedTowerId,
        selectedActivityId,
        Math.min(selectedScheduleLevel, maxScheduleDepth),
      ),
    [maxScheduleDepth, selectedActivityId, selectedScheduleLevel, selectedTowerId, towerProgress],
  );
  const overlayEntries = useMemo(() => {
    return modelEntries
      .map((entry) => {
        if (selectedActivityId !== "ALL") {
          if (!entry.activityIds.includes(selectedActivityId)) return null;
          const selectedMetrics =
            (entry.floorId ? selectedActivityProgressByFloor.get(entry.floorId) : null) ||
            entry.metrics;
          const floorColor =
            (entry.floorId ? scheduleVisualization.floorMap.get(entry.floorId)?.color : null) ||
            "#334155";
          const scheduleLabel =
            (entry.floorId ? scheduleVisualization.floorMap.get(entry.floorId)?.label : null) ||
            "Selected activity";
          const selectedMetricsWithProgress = selectedMetrics as unknown as {
            progressPct?: number;
          };
          const selectedProgressPct =
            typeof selectedMetricsWithProgress.progressPct === "number"
              ? selectedMetricsWithProgress.progressPct
              : entry.progressPct;
          return {
            ...entry,
            progressPct: selectedProgressPct,
            metrics: selectedMetrics,
            overlayColor: floorColor,
            scheduleLabel,
          } satisfies OverlayEntry;
        }
        const floorOverlay = entry.floorId ? scheduleVisualization.floorMap.get(entry.floorId) : null;
        if (!floorOverlay && entry.metrics.totalActivities === 0) return null;
        return entry;
      })
      .map((entry) => {
        if (!entry) return null;
        if ("overlayColor" in entry) return entry;
        const floorOverlay = entry.floorId ? scheduleVisualization.floorMap.get(entry.floorId) : null;
        return {
          ...entry,
          overlayColor: floorOverlay?.color || "#64748b",
          scheduleLabel: floorOverlay?.label || "Mapped schedule",
        } satisfies OverlayEntry;
      })
      .filter((entry): entry is OverlayEntry => Boolean(entry))
      .filter((entry) => entry.metrics.totalActivities > 0);
  }, [modelEntries, scheduleVisualization.floorMap, selectedActivityId, selectedActivityProgressByFloor]);

  const towerSummaries = useMemo(() => {
    return availableTowers
      .filter((tower) => selectedTowerId === "ALL" || tower.towerId === selectedTowerId)
      .map((tower) => {
        const floors = towerProgress?.towers.find((item) => item.epsNodeId === tower.towerId)?.floors || [];
        const averageProgress =
          floors.length > 0
            ? floors.reduce((sum, floor) => sum + floor.progressPct, 0) / floors.length
            : 0;
        return {
          towerId: tower.towerId,
          towerName: tower.towerName,
          blockName: tower.blockName,
          floors: floors.length,
          averageProgress,
        };
      });
  }, [availableTowers, selectedTowerId, towerProgress]);

  const summary = useMemo(() => {
    const floors = new Set(overlayEntries.map((entry) => entry.floorId).filter(Boolean));
    const averageProgress =
      overlayEntries.length > 0
        ? overlayEntries.reduce((sum, entry) => sum + entry.progressPct, 0) / overlayEntries.length
        : 0;
    const maxHeight = modelEntries.reduce((sum, entry) => Math.max(sum, entry.z + entry.height), 0);
    return {
      rendered: overlayEntries.length,
      shells: modelEntries.length,
      floors: floors.size,
      averageProgress,
      maxHeight,
    };
  }, [modelEntries, overlayEntries]);

  useEffect(() => {
    setSelectedActivityId("ALL");
  }, [selectedTowerId]);

  useEffect(() => {
    setSelectedScheduleLevel((current) => Math.min(current, maxScheduleDepth));
  }, [maxScheduleDepth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SCHEDULE_LEVEL_STORAGE_KEY,
      String(Math.min(selectedScheduleLevel, maxScheduleDepth)),
    );
  }, [maxScheduleDepth, selectedScheduleLevel]);

  useEffect(() => {
    const nextExpanded = new Set<string>();
    activityTree.forEach((tower) => {
      nextExpanded.add(`tower-${tower.towerId}`);
      tower.floors.forEach((floor) => nextExpanded.add(`floor-${floor.floorId}`));
    });
    setExpandedActivityGroups(nextExpanded);
  }, [activityTree]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef6fb");
    sceneRef.current = scene;

    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(-160 * aspect, 160 * aspect, 160, -160, 0.1, 5000);
    camera.position.set(180, -180, 180);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight("#ffffff", 1.4);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight("#ffffff", 1.2);
    directional.position.set(180, -120, 300);
    directional.castShadow = true;
    scene.add(directional);

    const grid = new THREE.GridHelper(800, 24, "#cbd5e1", "#dbe4ee");
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 36);
    controls.minPolarAngle = Math.PI / 8;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.enablePan = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = autoRotateSpeed;
    controlsRef.current = controls;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const nextWidth = containerRef.current.clientWidth || 800;
      const nextHeight = containerRef.current.clientHeight || 600;
      rendererRef.current.setSize(nextWidth, nextHeight);
      if (modelGroupRef.current && controlsRef.current) {
        fitIsometricCamera(
          cameraRef.current,
          controlsRef.current,
          modelGroupRef.current,
          nextWidth / nextHeight,
        );
      } else {
        const aspect = nextWidth / nextHeight;
        cameraRef.current.left = -160 * aspect;
        cameraRef.current.right = 160 * aspect;
        cameraRef.current.top = 160;
        cameraRef.current.bottom = -160;
        cameraRef.current.updateProjectionMatrix();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    if (modelGroupRef.current) {
      sceneRef.current.remove(modelGroupRef.current);
      modelGroupRef.current.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
    }

    const nextGroup = new THREE.Group();
    const planCenter = getPlanCenter(modelEntries);
    const verticalScale = getVerticalRenderScale(modelEntries);

    modelEntries.forEach((entry) => {
      const scaledZ = entry.z * verticalScale;
      const scaledHeight = entry.height * verticalScale;
      const centeredPolygon = entry.polygon.map(
        ([x, y]) => [x - planCenter.x, y - planCenter.y] as [number, number],
      );
      const shape = toShape(centeredPolygon);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: scaledHeight,
        bevelEnabled: false,
      });
      const material = new THREE.MeshStandardMaterial({
        color: "#cbd5e1",
        transparent: true,
        opacity: 0.22,
        roughness: 0.52,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = scaledZ;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      nextGroup.add(mesh);

      const edgeGeometry = new THREE.EdgesGeometry(geometry);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: "#475569",
        transparent: true,
        opacity: 0.62,
      });
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edges.position.z = scaledZ;
      nextGroup.add(edges);

      const topOutlineGeometry = new THREE.BufferGeometry().setFromPoints(
        centeredPolygon.map(([x, y]) => new THREE.Vector3(x, y, scaledHeight)),
      );
      const topOutlineMaterial = new THREE.LineBasicMaterial({
        color: "#334155",
        transparent: true,
        opacity: 0.55,
      });
      const topOutline = new THREE.LineLoop(topOutlineGeometry, topOutlineMaterial);
      topOutline.position.z = scaledZ;
      nextGroup.add(topOutline);
    });

    overlayEntries.forEach((entry) => {
      const scaledZ = entry.z * verticalScale;
      const scaledHeight = entry.height * verticalScale;
      const centeredPolygon = entry.polygon.map(
        ([x, y]) => [x - planCenter.x, y - planCenter.y] as [number, number],
      );
      const shape = toShape(centeredPolygon);
      const plannedGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: scaledHeight,
        bevelEnabled: false,
      });
      const plannedMaterial = new THREE.MeshStandardMaterial({
        color: mixColor(entry.overlayColor, "#ffffff", 0.28),
        transparent: true,
        opacity: 0.16 + (entry.progressPct > 0 ? 0.08 : 0),
        roughness: 0.4,
        metalness: 0.04,
      });
      const plannedMesh = new THREE.Mesh(plannedGeometry, plannedMaterial);
      plannedMesh.position.z = scaledZ;
      plannedMesh.castShadow = true;
      plannedMesh.receiveShadow = true;
      nextGroup.add(plannedMesh);

      if (entry.progressPct <= 0) return;

      const overlayHeight = Math.max(
        (scaledHeight * entry.progressPct) / 100,
        scaledHeight * 0.05,
      );
      const progressGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: Math.min(scaledHeight, overlayHeight),
        bevelEnabled: false,
      });
      const progressMaterial = new THREE.MeshStandardMaterial({
        color: shadeColor(entry.overlayColor, 0.68),
        transparent: true,
        opacity: 0.55 + Math.min(0.28, entry.progressPct / 240),
        roughness: 0.28,
        metalness: 0.14,
      });
      const progressMesh = new THREE.Mesh(progressGeometry, progressMaterial);
      progressMesh.position.z = scaledZ;
      progressMesh.castShadow = true;
      progressMesh.receiveShadow = true;
      nextGroup.add(progressMesh);
    });

    sceneRef.current.add(nextGroup);
    modelGroupRef.current = nextGroup;

    const box = new THREE.Box3().setFromObject(nextGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    if (Number.isFinite(center.x) && cameraRef.current && controlsRef.current) {
      const maxDimension = Math.max(size.x, size.y, size.z, 1);
      fitIsometricCamera(
        cameraRef.current,
        controlsRef.current,
        nextGroup,
        (containerRef.current?.clientWidth || 800) / (containerRef.current?.clientHeight || 600),
      );
      sceneRef.current.fog = new THREE.Fog(
        "#eef6fb",
        Math.max(maxDimension * 1.5, 180),
        Math.max(maxDimension * 10, 2400),
      );
    }
  }, [modelEntries, overlayEntries]);

  const legend = [
    { label: "Completed", color: "#16a34a", range: "95%+" },
    { label: "Advanced", color: "#0ea5e9", range: "65-94%" },
    { label: "In Progress", color: "#f59e0b", range: "35-64%" },
    { label: "Started", color: "#f97316", range: "1-34%" },
    { label: "Not Started", color: "#94a3b8", range: "0%" },
  ];

  if (displayMode === "viewerOnly") {
    return (
      <div className="overflow-hidden rounded-3xl border border-border-default bg-surface-card">
        <div className="border-b border-border-subtle px-4 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              <Move3d className="h-4 w-4 text-secondary" />
              Project 3D Progress
            </div>
            <div className="mt-0.5 text-base font-bold leading-tight text-text-primary">
              {panelTitle || "Transparent Building Mass with Activity Progress Overlay"}
            </div>
            <div className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
              {panelSubtitle ||
                "Planned work stays visible as a coloured transparent shell, and achieved progress darkens upward from the base to the executed height."}
            </div>
          </div>
        </div>
        <div
          ref={containerRef}
          className={`${viewerClassName} w-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),_rgba(228,238,246,0.94))]`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[320px_360px_1fr]">
        <div className="space-y-4 rounded-3xl border border-border-default bg-surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-600">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Progress Model
              </div>
              <div className="text-xl font-bold text-text-primary">
                3D Building Lens
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl bg-surface-base px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Progress Layers</div>
              <div className="mt-2 text-3xl font-bold text-text-primary">{summary.rendered}</div>
              <div className="mt-1 text-xs text-text-muted">{summary.shells} transparent shells</div>
            </div>
            <div className="rounded-2xl bg-surface-base px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Visible Floors</div>
              <div className="mt-2 text-3xl font-bold text-text-primary">{summary.floors}</div>
            </div>
            <div className="rounded-2xl bg-surface-base px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Avg Progress</div>
              <div className="mt-2 text-3xl font-bold text-text-primary">
                {Math.round(summary.averageProgress)}%
              </div>
            </div>
            <div className="rounded-2xl bg-surface-base px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Model Height</div>
              <div className="mt-2 text-3xl font-bold text-text-primary">
                {summary.maxHeight.toFixed(1)}m
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border-default bg-surface-base p-4">
            <div className="text-sm font-semibold text-text-primary">Viewer Controls</div>
            <label className="space-y-2">
              <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Tower</div>
              <select
                value={selectedTowerId}
                onChange={(event) =>
                  setSelectedTowerId(
                    event.target.value === "ALL" ? "ALL" : Number(event.target.value),
                  )
                }
                className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm"
              >
                <option value="ALL">All Towers</option>
                {availableTowers.map((tower) => (
                  <option key={tower.towerId} value={tower.towerId}>
                    {tower.blockName ? `${tower.blockName} • ` : ""}
                    {tower.towerName}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Render Logic</div>
              <div className="grid grid-cols-2 gap-2">
                {(["AUTO", "FLOOR", "UNIT", "ROOM"] as RenderMode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDepth(option)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      depth === option
                        ? "bg-primary text-white"
                        : "border border-border-default bg-surface-card text-text-primary"
                    }`}
                  >
                    {option === "AUTO" ? "Auto" : option}
                  </button>
                ))}
              </div>
              <div className="text-xs text-text-muted">
                Auto uses the deepest available geometry first: room {"->"} unit {"->"} floor {"->"} tower {"->"} block {"->"} project.
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.16em] text-text-muted">
                  Schedule Colour Depth
                </div>
                <div className="text-[11px] text-text-muted">Remembered on this device</div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: maxScheduleDepth }, (_, index) => index + 1).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSelectedScheduleLevel(level)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      selectedScheduleLevel === level
                        ? "bg-secondary text-white"
                        : "border border-border-default bg-surface-card text-text-primary"
                    }`}
                  >
                    {`L${level}`}
                  </button>
                ))}
              </div>
              <div className="text-xs text-text-muted">
                Pick how deep the schedule grouping should be when colouring planned shells and
                progress overlays.
              </div>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-card px-4 py-2 text-sm font-semibold text-text-primary"
            >
              <RefreshCw className={`h-4 w-4 ${loadingProgress ? "animate-spin" : ""}`} />
              Refresh Progress
            </button>
          </div>

          <div className="rounded-2xl border border-border-default bg-surface-base p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <ScanSearch className="h-4 w-4 text-secondary" />
              Progress Legend
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-slate-300" />
                  <span className="text-text-primary">Full Building Mass</span>
                </div>
                <span className="text-text-muted">Transparent shell</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-slate-500" />
                  <span className="text-text-primary">Planned Activity Shell</span>
                </div>
                <span className="text-text-muted">Transparent schedule tint</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-slate-900" />
                  <span className="text-text-primary">Achieved Progress</span>
                </div>
                <span className="text-text-muted">Darkens with execution</span>
              </div>
              {legend.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-text-primary">{item.label}</span>
                  </div>
                  <span className="text-text-muted">{item.range}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-text-primary">
                <span>{`Schedule Index - L${Math.min(selectedScheduleLevel, maxScheduleDepth)}`}</span>
                <span className="text-xs font-medium text-text-muted">
                  {selectedActivityId === "ALL" ? "All mapped activities" : "Selected activity"}
                </span>
              </div>
              <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
                {scheduleVisualization.legend.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-default px-3 py-3 text-xs text-text-muted">
                    No schedule colour groups are available for the current scope.
                  </div>
                ) : (
                  scheduleVisualization.legend.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-3 w-3 flex-none rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate text-text-primary">{item.label}</span>
                      </div>
                      <span className="whitespace-nowrap text-xs text-text-muted">
                        {item.floorCount} floors
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border-default bg-surface-card">
          <div className="border-b border-border-subtle px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
              <ListTree className="h-4 w-4 text-secondary" />
              Schedule Activity Filter
            </div>
            <div className="mt-1 text-sm text-text-secondary">
              Select one scheduled activity to highlight its progress on the building mass.
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto px-4 py-4">
            <button
              type="button"
              onClick={() => setSelectedActivityId("ALL")}
              className={`mb-3 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                selectedActivityId === "ALL"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-border-default bg-surface-base text-text-primary"
              }`}
            >
              <span className="text-sm font-semibold">All Scheduled Activities</span>
              <span className="text-xs uppercase tracking-[0.16em]">
                {selectedActivityId === "ALL" ? "Active" : "Show all"}
              </span>
            </button>

            {activityTree.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-default bg-surface-base px-4 py-5 text-sm text-text-muted">
                No floor-level schedule activities are mapped for this scope yet.
              </div>
            ) : (
              <div className="space-y-3">
                {activityTree.map((tower) => {
                  const towerKey = `tower-${tower.towerId}`;
                  const towerExpanded = expandedActivityGroups.has(towerKey);
                  return (
                    <div
                      key={tower.towerId}
                      className="rounded-2xl border border-border-default bg-surface-base"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedActivityGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(towerKey)) next.delete(towerKey);
                            else next.add(towerKey);
                            return next;
                          })
                        }
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{tower.towerName}</div>
                          <div className="text-xs text-text-muted">{tower.floors.length} floors with activity data</div>
                        </div>
                        {towerExpanded ? (
                          <ChevronDown className="h-4 w-4 text-text-muted" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-text-muted" />
                        )}
                      </button>

                      {towerExpanded ? (
                        <div className="border-t border-border-subtle px-3 py-3 space-y-2">
                          {tower.floors.map((floor) => {
                            const floorKey = `floor-${floor.floorId}`;
                            const floorExpanded = expandedActivityGroups.has(floorKey);
                            return (
                              <div key={floor.floorId} className="rounded-xl border border-border-default bg-surface-card">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedActivityGroups((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(floorKey)) next.delete(floorKey);
                                      else next.add(floorKey);
                                      return next;
                                    })
                                  }
                                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                                >
                                  <div>
                                    <div className="text-sm font-medium text-text-primary">{floor.floorName}</div>
                                    <div className="text-xs text-text-muted">{floor.activities.length} activities</div>
                                  </div>
                                  {floorExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-text-muted" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-text-muted" />
                                  )}
                                </button>

                                {floorExpanded ? (
                                  <div className="border-t border-border-subtle px-2 py-2 space-y-1">
                                    {floor.activities.map((activity) => (
                                      <button
                                        key={activity.id}
                                        type="button"
                                        onClick={() => setSelectedActivityId(activity.id)}
                                        className={`flex w-full items-start justify-between rounded-xl px-3 py-2 text-left ${
                                          selectedActivityId === activity.id
                                            ? "bg-slate-900 text-white"
                                            : "bg-transparent text-text-primary hover:bg-surface-base"
                                        }`}
                                      >
                                        <div className="min-w-0">
                                          <div className="truncate text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
                                            {activity.activityCode}
                                          </div>
                                          <div className="truncate text-sm font-medium">
                                            {activity.activityName}
                                          </div>
                                          <div className="truncate text-[11px] opacity-60">
                                            {getSchedulePath(activity).join(" > ")}
                                          </div>
                                          <div className="text-xs opacity-70">
                                            {activity.status}
                                            {activity.finishDatePlanned
                                              ? ` - Plan finish ${activity.finishDatePlanned}`
                                              : ""}
                                          </div>
                                        </div>
                                        <div className="ml-3 text-sm font-semibold">
                                          {Math.round(activity.progressPct)}%
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border-default bg-surface-card">
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                <Move3d className="h-4 w-4 text-secondary" />
                Interactive Viewer
              </div>
              <div className="mt-1 text-lg font-bold text-text-primary">
                Transparent Building Mass with Activity Progress Overlay
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                Planned work stays visible as a coloured transparent shell, and achieved progress
                darkens upward from the base to the executed height.
              </div>
            </div>
            <div className="rounded-2xl bg-surface-base px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Active Scope</div>
              <div className="mt-1 text-sm font-semibold text-text-primary">
                {selectedTowerId === "ALL"
                  ? "All towers"
                  : availableTowers.find((tower) => tower.towerId === selectedTowerId)?.towerName ||
                    "Selected tower"}
              </div>
              <div className="mt-1 text-xs text-text-muted">
                {selectedActivityId === "ALL" ? "All activities" : `Activity #${selectedActivityId}`}
              </div>
              <div className="mt-1 text-xs text-text-muted">
                {`Colour depth L${Math.min(selectedScheduleLevel, maxScheduleDepth)}`}
              </div>
            </div>
          </div>

          <div ref={containerRef} className="h-[620px] w-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),_rgba(228,238,246,0.94))]" />
        </div>
      </div>

      <div className="rounded-3xl border border-border-default bg-surface-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
          <Building2 className="h-4 w-4 text-secondary" />
          Tower Progress
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {towerSummaries.map((tower) => (
            <div
              key={tower.towerId}
              className="rounded-2xl border border-border-default bg-surface-base px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{tower.towerName}</div>
                  <div className="text-xs text-text-muted">
                    {tower.blockName ? `${tower.blockName} • ` : ""}
                    {tower.floors} floors
                  </div>
                </div>
                <div
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: getProgressColor(tower.averageProgress) }}
                >
                  {Math.round(tower.averageProgress)}%
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, Math.min(100, tower.averageProgress))}%`,
                    backgroundColor: getProgressColor(tower.averageProgress),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border-default bg-surface-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
          <Building2 className="h-4 w-4 text-secondary" />
          Render Queue
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overlayEntries.slice(0, 12).map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-border-default bg-surface-base px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-text-primary">{entry.label}</div>
                <div
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: shadeColor(entry.overlayColor, 0.72) }}
                >
                  {Math.round(entry.progressPct)}%
                </div>
              </div>
              <div className="mt-2 text-xs text-text-muted">
                {entry.metrics.completedActivities}/{entry.metrics.totalActivities} activities
                complete • {entry.metrics.pendingRfis} pending RFIs • geometry from{" "}
                {entry.geometrySource.toLowerCase()}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, Math.min(100, entry.progressPct))}%`,
                    backgroundColor: shadeColor(entry.overlayColor, 0.72),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {overlayEntries.length > 12 ? (
          <div className="mt-3 text-xs text-text-muted">
            Showing 12 of {overlayEntries.length} rendered progress overlays in the queue. The full set is
            loaded in the 3D viewer.
          </div>
        ) : null}
        {overlayEntries.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border-default bg-surface-base px-4 py-5 text-sm text-text-muted">
            No progress overlay is available for the selected activity yet. Keep the selection on
            all activities or choose another mapped activity.
          </div>
        ) : null}
      </div>
    </div>
  );
}
