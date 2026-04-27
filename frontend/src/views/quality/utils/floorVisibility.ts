export type FloorVisibilityConfig = {
  mode?: "ALL" | "RESTRICTED";
  selectedNodeIds?: number[];
  selectedBlockIds?: number[];
  selectedTowerIds?: number[];
  selectedFloorIds?: number[];
  version?: number;
} | null;

export type FloorVisibilityTreeNode = {
  id: number;
  name?: string;
  label?: string;
  type?: string;
  nodeType?: string;
  children?: FloorVisibilityTreeNode[];
};

export type FloorScope = {
  blockId?: number;
  towerId?: number;
  floorId?: number;
};

const ALLOWED_TYPES = new Set(["BLOCK", "TOWER", "FLOOR"]);

export function getTreeNodeType(node?: FloorVisibilityTreeNode | null) {
  return (node?.nodeType || node?.type || "").toUpperCase();
}

export function getTreeNodeLabel(node?: FloorVisibilityTreeNode | null) {
  return node?.label || node?.name || `#${node?.id ?? "?"}`;
}

export function filterFloorVisibilityTree(
  nodes: FloorVisibilityTreeNode[],
): FloorVisibilityTreeNode[] {
  const visit = (
    node: FloorVisibilityTreeNode,
  ): FloorVisibilityTreeNode | FloorVisibilityTreeNode[] | null => {
    const filteredChildren = (node.children || [])
      .map((child) => visit(child))
      .flat()
      .filter(Boolean) as FloorVisibilityTreeNode[];
    const type = getTreeNodeType(node);

    if (ALLOWED_TYPES.has(type)) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    return filteredChildren.length > 0 ? filteredChildren : null;
  };

  return nodes
    .map((node) => visit(node))
    .flat()
    .filter(Boolean) as FloorVisibilityTreeNode[];
}

export function collectNodeIds(nodes: FloorVisibilityTreeNode[]): number[] {
  const ids: number[] = [];
  const visit = (node: FloorVisibilityTreeNode) => {
    ids.push(node.id);
    (node.children || []).forEach(visit);
  };
  nodes.forEach(visit);
  return ids;
}

export function collectDescendantIds(node: FloorVisibilityTreeNode): number[] {
  return collectNodeIds([node]);
}

export function normalizeFloorVisibilitySelection(
  selectedIds: number[],
  roots: FloorVisibilityTreeNode[],
): FloorVisibilityConfig {
  const allIds = collectNodeIds(roots);
  const selectedUnique = Array.from(
    new Set(
      selectedIds.filter(
        (id) => Number.isInteger(id) && allIds.includes(id),
      ),
    ),
  );

  if (selectedUnique.length === 0 || selectedUnique.length === allIds.length) {
    return null;
  }

  const selectedSet = new Set(selectedUnique);
  const blockIds: number[] = [];
  const towerIds: number[] = [];
  const floorIds: number[] = [];

  const visit = (node: FloorVisibilityTreeNode) => {
    const type = getTreeNodeType(node);
    if (selectedSet.has(node.id)) {
      if (type === "BLOCK") blockIds.push(node.id);
      if (type === "TOWER") towerIds.push(node.id);
      if (type === "FLOOR") floorIds.push(node.id);
    }
    (node.children || []).forEach(visit);
  };
  roots.forEach(visit);

  return {
    mode: "RESTRICTED",
    selectedNodeIds: selectedUnique,
    selectedBlockIds: blockIds,
    selectedTowerIds: towerIds,
    selectedFloorIds: floorIds,
    version: 1,
  };
}

export function summarizeFloorVisibility(
  config: FloorVisibilityConfig,
  roots: FloorVisibilityTreeNode[],
) {
  if (!config || config.mode !== "RESTRICTED") {
    return "Visible On Floors: All";
  }

  const selectedSet = new Set(config.selectedNodeIds || []);
  let blocks = 0;
  let towers = 0;
  let floors = 0;

  const visit = (node: FloorVisibilityTreeNode) => {
    const type = getTreeNodeType(node);
    if (selectedSet.has(node.id)) {
      if (type === "BLOCK") blocks += 1;
      if (type === "TOWER") towers += 1;
      if (type === "FLOOR") floors += 1;
    }
    (node.children || []).forEach(visit);
  };
  roots.forEach(visit);

  const parts = [];
  if (blocks) parts.push(`${blocks} Block${blocks > 1 ? "s" : ""}`);
  if (towers) parts.push(`${towers} Tower${towers > 1 ? "s" : ""}`);
  if (floors) parts.push(`${floors} Floor${floors > 1 ? "s" : ""}`);

  return parts.length > 0
    ? `Visible On Floors: ${parts.join(", ")}`
    : "Visible On Floors: All";
}

export function resolveFloorScope(
  nodes: FloorVisibilityTreeNode[],
  selectedNodeId: number | null,
): FloorScope | null {
  if (!selectedNodeId) return null;

  const search = (
    node: FloorVisibilityTreeNode,
    path: FloorVisibilityTreeNode[],
  ): FloorScope | null => {
    const nextPath = [...path, node];
    if (node.id === selectedNodeId) {
      const scope: FloorScope = {};
      nextPath.forEach((entry) => {
        const type = getTreeNodeType(entry);
        if (type === "BLOCK") scope.blockId = entry.id;
        if (type === "TOWER") scope.towerId = entry.id;
        if (type === "FLOOR") scope.floorId = entry.id;
      });
      return scope;
    }
    for (const child of node.children || []) {
      const found = search(child, nextPath);
      if (found) return found;
    }
    return null;
  };

  for (const root of nodes) {
    const found = search(root, []);
    if (found) return found;
  }
  return null;
}

export function isActivityVisibleForFloorScope(
  config: FloorVisibilityConfig,
  scope: FloorScope | null,
) {
  if (!config || config.mode !== "RESTRICTED") return true;
  if (!scope) return true;
  const selectedIds = new Set(config.selectedNodeIds || []);
  return [scope.floorId, scope.towerId, scope.blockId].some(
    (id) => typeof id === "number" && selectedIds.has(id),
  );
}
