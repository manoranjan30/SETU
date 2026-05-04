import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Zap,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Square,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Radio,
  Search,
  X,
  MapPin,
  GitBranch,
} from "lucide-react";
import api from "../../../api/axios";

// ── Types ──────────────────────────────────────────────────────────────────

interface FloorActivity {
  activityId: number;
  activityCode: string;
  activityName: string;
  wbsPath: string;
  confidence: number;
  tier: "STRUCTURAL" | "TOKEN" | "BROADCAST";
}

interface BasicActivity {
  activityId: number;
  activityCode: string;
  activityName: string;
  wbsPath: string;
}

interface EpsTreeNode {
  id: number;
  name: string;
  type: string;
  children: EpsTreeNode[];
  matchedActivities: FloorActivity[];
}

interface PreviewData {
  epsTree: EpsTreeNode[];
  broadcastActivities: BasicActivity[];
  unmatchedActivities: BasicActivity[];
  allLeafIds: number[];
  stats: {
    total: number;
    matched: number;
    broadcast: number;
    unmatched: number;
  };
}

// ── Confidence bar ─────────────────────────────────────────────────────────

const ConfidenceBar: React.FC<{ value: number; tier: string }> = ({
  value,
  tier,
}) => {
  const pct = Math.round(value * 100);
  const isStructural = tier === "STRUCTURAL";
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isStructural ? "bg-green-500" : "bg-yellow-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-text-disabled w-7">{pct}%</span>
      <span
        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isStructural ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
      >
        {isStructural ? "Exact" : "Token"}
      </span>
    </div>
  );
};

// ── Activity label (shared across matched / broadcast / unmatched) ─────────

const ActivityLabel: React.FC<{
  wbsPath: string;
  activityName: string;
  activityCode: string;
  muted?: boolean;
}> = ({ wbsPath, activityName, activityCode, muted }) => (
  <div className="flex-1 min-w-0 py-0.5">
    <div className="text-xs leading-snug">
      {wbsPath && (
        <span className="text-text-disabled">{wbsPath} › </span>
      )}
      <span className={`font-semibold ${muted ? "text-text-muted" : "text-text-primary"}`}>
        {activityName}
      </span>
    </div>
    <div className="text-xs font-mono text-text-disabled leading-tight mt-0.5">
      {activityCode}
    </div>
  </div>
);

// ── Collect all pair keys recursively ─────────────────────────────────────

function collectAllPairs(
  node: EpsTreeNode,
  filterFn?: (a: FloorActivity) => boolean,
): string[] {
  const own = node.matchedActivities
    .filter((a) => !filterFn || filterFn(a))
    .map((a) => `${a.activityId}:${node.id}`);
  return [...own, ...node.children.flatMap((c) => collectAllPairs(c, filterFn))];
}

// ── EPS tree node (main view) ──────────────────────────────────────────────

const EpsNode: React.FC<{
  node: EpsTreeNode;
  level: number;
  checkedPairs: Set<string>;
  onTogglePair: (key: string) => void;
  onToggleSubtree: (keys: string[]) => void;
  filterFn?: (a: FloorActivity) => boolean;
  searchActive: boolean;
}> = ({ node, level, checkedPairs, onTogglePair, onToggleSubtree, filterFn, searchActive }) => {
  const [expanded, setExpanded] = useState(level < 2);

  // Auto-expand when search is active
  useEffect(() => {
    if (searchActive) setExpanded(true);
  }, [searchActive]);

  const filteredActivities = filterFn
    ? node.matchedActivities.filter(filterFn)
    : node.matchedActivities;

  const allPairs = collectAllPairs(node, filterFn);
  const allChecked = allPairs.length > 0 && allPairs.every((k) => checkedPairs.has(k));
  const someChecked = allPairs.some((k) => checkedPairs.has(k));
  const hasContent = allPairs.length > 0;

  // When filtering, hide nodes with no content
  if (searchActive && !hasContent) return null;

  const indent = level * 20;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 pr-3 rounded select-none hover:bg-surface-base cursor-pointer ${!hasContent ? "opacity-40" : ""}`}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-text-disabled w-5 flex-shrink-0"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <button
          onClick={() => hasContent && onToggleSubtree(allPairs)}
          disabled={!hasContent}
          className={`flex-shrink-0 transition-colors ${
            allChecked
              ? "text-primary"
              : someChecked
                ? "text-primary opacity-50"
                : "text-gray-300"
          }`}
        >
          {allChecked || someChecked ? (
            <CheckSquare size={15} />
          ) : (
            <Square size={15} />
          )}
        </button>

        <span className={`text-sm font-semibold ml-1 ${!hasContent ? "text-text-disabled" : "text-text-primary"}`}>
          {node.name}
        </span>
        <span className="text-xs text-text-disabled uppercase ml-1">{node.type}</span>

        {hasContent && (
          <span className="ml-auto text-xs font-semibold bg-primary-muted text-primary rounded-full px-2 py-0.5">
            {allPairs.length}
          </span>
        )}
      </div>

      {expanded && (
        <div>
          {filteredActivities.map((activity) => {
            const key = `${activity.activityId}:${node.id}`;
            const checked = checkedPairs.has(key);
            return (
              <div
                key={key}
                onClick={() => onTogglePair(key)}
                className="flex items-start gap-2 py-1.5 pr-3 rounded hover:bg-surface-base cursor-pointer group"
                style={{ paddingLeft: `${8 + indent + 40}px` }}
              >
                <span
                  className={`flex-shrink-0 mt-0.5 transition-colors ${checked ? "text-primary" : "text-gray-300 group-hover:text-gray-400"}`}
                >
                  {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                </span>
                <ActivityLabel
                  wbsPath={activity.wbsPath}
                  activityName={activity.activityName}
                  activityCode={activity.activityCode}
                />
                <ConfidenceBar value={activity.confidence} tier={activity.tier} />
              </div>
            );
          })}

          {node.children.map((child) => (
            <EpsNode
              key={child.id}
              node={child}
              level={level + 1}
              checkedPairs={checkedPairs}
              onTogglePair={onTogglePair}
              onToggleSubtree={onToggleSubtree}
              filterFn={filterFn}
              searchActive={searchActive}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── EPS floor picker (for manual mapping drawer) ──────────────────────────

function collectLeafIds(node: EpsTreeNode): number[] {
  if (node.children.length === 0) return [node.id];
  return node.children.flatMap(collectLeafIds);
}

const EpsPickerNode: React.FC<{
  node: EpsTreeNode;
  level: number;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleSubtree: (ids: number[]) => void;
}> = ({ node, level, selected, onToggle, onToggleSubtree }) => {
  const [expanded, setExpanded] = useState(level < 2);
  const isLeaf = node.children.length === 0;
  const leafIds = useMemo(() => collectLeafIds(node), [node]);
  const allSelected = leafIds.every((id) => selected.has(id));
  const someSelected = leafIds.some((id) => selected.has(id));
  const indent = level * 16;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 pr-3 rounded hover:bg-surface-base cursor-pointer select-none"
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {!isLeaf && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-text-disabled w-4 flex-shrink-0"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        )}
        {isLeaf && <span className="w-4 flex-shrink-0" />}

        <button
          onClick={() =>
            isLeaf ? onToggle(node.id) : onToggleSubtree(leafIds)
          }
          className={`flex-shrink-0 transition-colors ${
            allSelected
              ? "text-primary"
              : someSelected
                ? "text-primary opacity-50"
                : "text-gray-300"
          }`}
        >
          {allSelected || someSelected ? (
            <CheckSquare size={14} />
          ) : (
            <Square size={14} />
          )}
        </button>

        <span className={`text-sm ${isLeaf ? "font-medium text-text-primary" : "font-semibold text-text-secondary"}`}>
          {node.name}
        </span>
        <span className="text-xs text-text-disabled uppercase ml-0.5">{node.type}</span>
      </div>

      {expanded && !isLeaf &&
        node.children.map((child) => (
          <EpsPickerNode
            key={child.id}
            node={child}
            level={level + 1}
            selected={selected}
            onToggle={onToggle}
            onToggleSubtree={onToggleSubtree}
          />
        ))}
    </div>
  );
};

// ── Manual mapping drawer ──────────────────────────────────────────────────

const ManualMapDrawer: React.FC<{
  activity: BasicActivity;
  epsTree: EpsTreeNode[];
  onConfirm: (activityId: number, epsNodeIds: number[]) => void;
  onClose: () => void;
}> = ({ activity, epsTree, onConfirm, onClose }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleOne = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSubtree = useCallback((ids: number[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full border-l border-border-default bg-surface-card">
      {/* Drawer header */}
      <div className="flex items-start gap-2 px-4 py-3 border-b border-border-subtle bg-surface-base flex-shrink-0">
        <MapPin size={15} className="text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-text-primary leading-snug">
            Assign to floors
          </p>
          <p className="text-xs text-text-disabled mt-0.5 leading-snug">
            {activity.wbsPath && <span>{activity.wbsPath} › </span>}
            <span className="font-semibold text-text-secondary">{activity.activityName}</span>
          </p>
        </div>
        <button onClick={onClose} className="text-text-disabled hover:text-text-primary flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* EPS picker tree */}
      <div className="flex-1 overflow-auto p-2">
        {epsTree.map((node) => (
          <EpsPickerNode
            key={node.id}
            node={node}
            level={0}
            selected={selected}
            onToggle={toggleOne}
            onToggleSubtree={toggleSubtree}
          />
        ))}
      </div>

      {/* Confirm */}
      <div className="px-4 py-3 border-t border-border-subtle bg-surface-base flex-shrink-0">
        <button
          onClick={() => onConfirm(activity.activityId, [...selected])}
          disabled={selected.size === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GitBranch size={14} />
          Assign to {selected.size} floor{selected.size !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────

const SmartMapTab: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PreviewData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [checkedPairs, setCheckedPairs] = useState<Set<string>>(new Set());
  const [checkedBroadcast, setCheckedBroadcast] = useState<Set<number>>(new Set());

  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Search
  const [search, setSearch] = useState("");

  // Manual mapping drawer
  const [mapTarget, setMapTarget] = useState<BasicActivity | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError(null);
    setResult(null);
    setCommitError(null);
    setMapTarget(null);

    try {
      const res = await api.get(`/planning/${projectId}/smart-distribute/preview`);
      const d: PreviewData = res.data;
      setData(d);

      const pairs = new Set<string>();
      const walkTree = (nodes: EpsTreeNode[]) => {
        for (const node of nodes) {
          node.matchedActivities.forEach((a) =>
            pairs.add(`${a.activityId}:${node.id}`),
          );
          walkTree(node.children);
        }
      };
      walkTree(d.epsTree);
      setCheckedPairs(pairs);
      setCheckedBroadcast(new Set(d.broadcastActivities.map((a) => a.activityId)));
    } catch (e: any) {
      setLoadError(
        e.response?.data?.message || "Failed to load smart mapping. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // ── Toggle handlers ───────────────────────────────────────────────────────

  const togglePair = useCallback((key: string) => {
    setCheckedPairs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const toggleSubtree = useCallback((keys: string[]) => {
    setCheckedPairs((prev) => {
      const next = new Set(prev);
      const allOn = keys.every((k) => next.has(k));
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  }, []);

  const toggleBroadcast = useCallback((id: number) => {
    setCheckedBroadcast((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Manual mapping confirm ────────────────────────────────────────────────

  const handleManualConfirm = useCallback(
    (activityId: number, epsNodeIds: number[]) => {
      setCheckedPairs((prev) => {
        const next = new Set(prev);
        epsNodeIds.forEach((eid) => next.add(`${activityId}:${eid}`));
        return next;
      });
      setMapTarget(null);
    },
    [],
  );

  // ── Search filter ─────────────────────────────────────────────────────────

  const matchesSearch = useCallback(
    (a: { activityName: string; activityCode: string; wbsPath: string }) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        a.activityName.toLowerCase().includes(q) ||
        a.activityCode.toLowerCase().includes(q) ||
        a.wbsPath.toLowerCase().includes(q)
      );
    },
    [search],
  );

  const floorFilterFn = useCallback(
    (a: FloorActivity) => matchesSearch(a),
    [matchesSearch],
  );

  // ── Count selected ────────────────────────────────────────────────────────

  const selectedActivityCount = useMemo(() => {
    const ids = new Set<number>();
    checkedPairs.forEach((k) => ids.add(parseInt(k.split(":")[0])));
    checkedBroadcast.forEach((id) => ids.add(id));
    return ids.size;
  }, [checkedPairs, checkedBroadcast]);

  // ── Commit ────────────────────────────────────────────────────────────────

  const handleCommit = async () => {
    if (!projectId || !data) return;
    setCommitting(true);
    setCommitError(null);

    try {
      const map = new Map<number, Set<number>>();

      checkedPairs.forEach((key) => {
        const [aStr, eStr] = key.split(":");
        const aId = parseInt(aStr);
        const eId = parseInt(eStr);
        if (!map.has(aId)) map.set(aId, new Set());
        map.get(aId)!.add(eId);
      });

      checkedBroadcast.forEach((aId) => {
        if (!map.has(aId)) map.set(aId, new Set());
        data.allLeafIds.forEach((leafId) => map.get(aId)!.add(leafId));
      });

      const mappings = [...map.entries()].map(([activityId, nodeSet]) => ({
        activityId,
        epsNodeIds: [...nodeSet],
      }));

      const res = await api.post(
        `/planning/${projectId}/smart-distribute/commit`,
        { mappings },
      );
      setResult(res.data);
    } catch (e: any) {
      setCommitError(
        e.response?.data?.message || "Distribution failed. Please try again.",
      );
    } finally {
      setCommitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted h-full py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
        <p className="text-sm">Analysing schedule activities against project floors…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-muted h-full py-20">
        <AlertTriangle size={40} className="text-gray-300" />
        <p className="text-sm text-center max-w-sm">{loadError}</p>
        <button onClick={load} className="flex items-center gap-2 text-primary text-sm hover:underline">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const noEps = data.epsTree.length === 0;
  const searchActive = search.trim().length > 0;

  const filteredBroadcast = data.broadcastActivities.filter(matchesSearch);
  const filteredUnmatched = data.unmatchedActivities.filter(matchesSearch);

  return (
    <div className="flex h-full bg-surface-card overflow-hidden">

      {/* ── Left panel: tree + controls ─────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Success banner */}
        {result && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border-b border-green-200 text-sm text-green-800 flex-shrink-0">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">{result.created} activities distributed</span>
              {result.skipped > 0 && (
                <span className="text-green-600 ml-2">· {result.skipped} skipped (already distributed)</span>
              )}
            </span>
            <button onClick={load} className="ml-auto flex items-center gap-1 text-xs text-green-700 hover:underline">
              <RefreshCw size={12} /> Re-analyse
            </button>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-3 px-4 py-2 bg-surface-base border-b border-border-subtle text-xs flex-shrink-0">
          <span className="text-text-muted font-medium">{data.stats.total} master activities</span>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
            {data.stats.matched} matched to floors
          </span>
          {data.stats.broadcast > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
              {data.stats.broadcast} broadcast
            </span>
          )}
          {data.stats.unmatched > 0 && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
              {data.stats.unmatched} unmatched
            </span>
          )}
          <button onClick={load} title="Re-analyse" className="ml-auto text-text-disabled hover:text-text-secondary transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-3 py-2 bg-surface-base border-b border-border-subtle flex-shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-disabled pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by activity name, code or WBS path…"
              className="w-full pl-7 pr-7 py-1.5 text-xs bg-surface-card border border-border-default rounded-md placeholder-text-disabled text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Instruction strip */}
        <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex-shrink-0">
          Activities are auto-matched to floors below. Verify connections, uncheck any
          incorrect ones, then click <strong>Distribute</strong>. For unmatched activities use
          the <strong>Map</strong> button to assign manually.
        </div>

        {/* Scrollable tree content */}
        <div className="flex-1 overflow-auto p-3">

          {noEps ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted gap-3">
              <AlertTriangle size={36} className="text-gray-300" />
              <p className="text-sm text-center">
                No EPS floor structure found for this project.
                <br />
                Create Blocks, Towers and Floors in the EPS first.
              </p>
            </div>
          ) : (
            <>
              {/* ── Floor Tree ──────────────────────────────────────────────── */}
              <div className="mb-1">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider px-2 mb-1">
                  Floor Structure → Matched Activities
                </p>
                {data.epsTree.map((node) => (
                  <EpsNode
                    key={node.id}
                    node={node}
                    level={0}
                    checkedPairs={checkedPairs}
                    onTogglePair={togglePair}
                    onToggleSubtree={toggleSubtree}
                    filterFn={searchActive ? floorFilterFn : undefined}
                    searchActive={searchActive}
                  />
                ))}
              </div>

              {/* ── Broadcast ───────────────────────────────────────────────── */}
              {data.broadcastActivities.length > 0 && (!searchActive || filteredBroadcast.length > 0) && (
                <div className="mt-5 border border-blue-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-blue-50 text-blue-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Radio size={13} className="text-blue-500" />
                    Broadcast — sent to every floor
                    <span className="font-normal text-blue-600 ml-1">
                      ({searchActive ? filteredBroadcast.length : data.broadcastActivities.length})
                    </span>
                  </div>
                  <div className="divide-y divide-blue-100 bg-white">
                    {(searchActive ? filteredBroadcast : data.broadcastActivities).map((a) => {
                      const checked = checkedBroadcast.has(a.activityId);
                      return (
                        <div
                          key={a.activityId}
                          onClick={() => toggleBroadcast(a.activityId)}
                          className="flex items-start gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer"
                        >
                          <span className={`flex-shrink-0 mt-0.5 ${checked ? "text-blue-600" : "text-gray-300"}`}>
                            {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                          </span>
                          <ActivityLabel
                            wbsPath={a.wbsPath}
                            activityName={a.activityName}
                            activityCode={a.activityCode}
                          />
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full ml-1 flex-shrink-0 self-start mt-0.5">
                            Broadcast
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Unmatched ───────────────────────────────────────────────── */}
              {data.unmatchedActivities.length > 0 && (!searchActive || filteredUnmatched.length > 0) && (
                <div className="mt-4 border border-orange-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-orange-50 text-orange-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={13} className="text-orange-500" />
                    Unmatched — map manually
                    <span className="font-normal text-orange-600 ml-1">
                      ({searchActive ? filteredUnmatched.length : data.unmatchedActivities.length})
                    </span>
                  </div>
                  <div className="divide-y divide-orange-100 bg-white">
                    {(searchActive ? filteredUnmatched : data.unmatchedActivities).map((a) => {
                      const hasManual = [...checkedPairs].some((k) =>
                        k.startsWith(`${a.activityId}:`),
                      );
                      return (
                        <div
                          key={a.activityId}
                          className={`flex items-start gap-2 px-3 py-2 ${hasManual ? "bg-green-50" : ""}`}
                        >
                          <span className={`flex-shrink-0 mt-0.5 ${hasManual ? "text-green-600" : "text-gray-300"}`}>
                            {hasManual ? <CheckCircle size={14} /> : <Square size={14} />}
                          </span>
                          <ActivityLabel
                            wbsPath={a.wbsPath}
                            activityName={a.activityName}
                            activityCode={a.activityCode}
                            muted={!hasManual}
                          />
                          <button
                            onClick={() => {
                              setMapTarget(a);
                            }}
                            className={`flex-shrink-0 self-start mt-0.5 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                              mapTarget?.activityId === a.activityId
                                ? "bg-primary text-white border-primary"
                                : hasManual
                                  ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                                  : "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                            }`}
                          >
                            <MapPin size={10} />
                            {hasManual ? "Re-map" : "Map"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action bar */}
        <div className="px-4 py-3 border-t border-border-subtle bg-surface-base flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text-primary">{selectedActivityCount}</span>{" "}
            of {data.stats.total} activities selected
          </p>

          <div className="flex items-center gap-3">
            {commitError && (
              <span className="text-sm text-error flex items-center gap-1">
                <AlertTriangle size={14} /> {commitError}
              </span>
            )}
            <button
              onClick={handleCommit}
              disabled={selectedActivityCount === 0 || committing || !!result || noEps}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Distributing…
                </>
              ) : (
                <>
                  <Zap size={15} />
                  Distribute {selectedActivityCount} Activities
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panel: manual mapping drawer ──────────────────────────── */}
      {mapTarget && (
        <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden">
          <ManualMapDrawer
            activity={mapTarget}
            epsTree={data.epsTree}
            onConfirm={handleManualConfirm}
            onClose={() => setMapTarget(null)}
          />
        </div>
      )}
    </div>
  );
};

export default SmartMapTab;
