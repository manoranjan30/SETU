import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  type CSSProperties,
  useCallback,
} from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Settings,
} from "lucide-react";
// @ts-ignore
import * as ReactWindowPkg from "react-window";

// --- 1. ROBUST LIBRARY LOADER ---
const findComponent = (pkg: any, nameHints: string[]) => {
  if (!pkg) return null;
  if (typeof pkg === "function") return pkg;
  if (pkg.$$typeof) return pkg;
  if (pkg.default) {
    if (typeof pkg.default === "function") return pkg.default;
    if (pkg.default.$$typeof) return pkg.default;
    for (const name of nameHints) {
      if (pkg.default[name]) return pkg.default[name];
    }
  }
  for (const name of nameHints) {
    if (pkg[name]) return pkg[name];
  }
  return null;
};

const FixedSizeList = findComponent(ReactWindowPkg, ["FixedSizeList", "List"]);

const InnerElement = React.forwardRef(({ style, ...rest }: any, ref: any) => (
  <div
    ref={ref}
    style={{
      ...style,
      width: "100%", // Allow columns to stretch or use min-width from parent
      minWidth: "100%",
      display: "relative",
    }}
    {...rest}
  />
));

const tokenizeNaturalSort = (value: string) =>
  (value || "")
    .split(/(\d+)/)
    .filter(Boolean)
    .map((part) => {
      const numeric = Number(part);
      return Number.isNaN(numeric) ? part.toLowerCase() : numeric;
    });

const compareNaturalCode = (left?: string, right?: string) => {
  const leftTokens = tokenizeNaturalSort(left || "");
  const rightTokens = tokenizeNaturalSort(right || "");
  const maxLength = Math.max(leftTokens.length, rightTokens.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftToken = leftTokens[index];
    const rightToken = rightTokens[index];

    if (leftToken === undefined) return -1;
    if (rightToken === undefined) return 1;

    if (typeof leftToken === "number" && typeof rightToken === "number") {
      if (leftToken !== rightToken) return leftToken - rightToken;
      continue;
    }

    const leftText = String(leftToken);
    const rightText = String(rightToken);
    const comparison = leftText.localeCompare(rightText);
    if (comparison !== 0) return comparison;
  }

  return 0;
};

// --- 2. TYPES ---
interface ScheduleTableProps {
  activities: any[];
  relationships: any[];
  wbsNodes: any[];
  zoom: number;
  projectCode?: string;
  onUpdateActivity?: (id: number, field: string, value: any) => Promise<void>;
  forceExpandAll?: boolean;
}

interface TreeRow {
  type: "WBS" | "ACTIVITY";
  id: string; // Composite ID: WBS-1 or ACT-101
  data: any;
  level: number;
  children: TreeRow[];
}

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  sticky?: "left";
  className?: string; // Tailwind classes
  render: (props: CellProps) => React.ReactNode;
}

interface CellProps {
  row: TreeRow;
  rowData: any;
  isWbs: boolean;
  isExpanded: boolean;
  isCritical: boolean;
  projectCode?: string;
  predecessorMap: Map<number, any[]>;
  successorMap: Map<number, any[]>;
  onUpdateActivity: (id: number, field: string, value: any) => Promise<void>;
  formatDate: (d: string | null) => string;
  scrollToActivity: (id: number) => void;
  toggleExpand: (id: string) => void;
}

interface RowProps {
  index: number;
  style: CSSProperties;
  // Data passed via itemData / rowProps
  flattenedRows: TreeRow[];
  expandedNodeIds: Set<string>;
  toggleExpand: (id: string) => void;
  projectCode?: string;
  columnDefinitions: ColumnDef[];
  visibleColumns: Record<string, boolean>;
  colWidths: Record<string, number>;
  totalWidth: number;
  predecessorMap: Map<number, any[]>;
  successorMap: Map<number, any[]>;
  onUpdateActivity: (id: number, field: string, value: any) => Promise<void>;
  formatDate: (d: string | null) => string;
  scrollToActivity: (id: number) => void;
  fontSize: string;
}

// --- 3. HELPER COMPONENTS ---

const EditableDateCell = ({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (val: string) => void;
}) => {
  const [localValue, setLocalValue] = useState(
    value ? new Date(value).toISOString().split("T")[0] : "",
  );

  useEffect(() => {
    setLocalValue(value ? new Date(value).toISOString().split("T")[0] : "");
  }, [value]);

  const handleBlur = () => {
    const currentFormatted = value
      ? new Date(value).toISOString().split("T")[0]
      : "";
    if (localValue !== currentFormatted) {
      onSave(localValue);
    }
  };

  return (
    <input
      type="date"
      className="w-full h-full bg-transparent border-0 focus:ring-1 focus:ring-success text-center text-xs text-text-secondary p-0"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
};

// Custom Hook for Resize Observer
const EditableNumberCell = ({
  value,
  onSave,
}: {
  value: number | undefined;
  onSave: (val: number) => void;
}) => {
  const [localValue, setLocalValue] = useState<string | number>(
    value !== undefined ? value : "",
  );

  useEffect(() => {
    setLocalValue(value !== undefined ? value : "");
  }, [value]);

  const handleBlur = () => {
    const numVal = Number(localValue);
    // Basic validation
    if (isNaN(numVal)) {
      setLocalValue(value !== undefined ? value : "");
      return;
    }
    // Clamp between 0-100 if needed, or leave to backend/business logic.
    // For now, let's clamp for UI sanity.
    const clampedVal = Math.min(100, Math.max(0, numVal));

    if (clampedVal !== value) {
      onSave(clampedVal);
      // Update local if we clamped
      if (clampedVal !== numVal) setLocalValue(clampedVal);
    }
  };

  return (
    <input
      type="number"
      min="0"
      max="100"
      className="w-full h-full text-center bg-transparent border-0 focus:ring-1 focus:ring-primary rounded px-1 text-xs"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
};

const useContainerSize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // Use contentRect for precise content box size
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
};

// --- 4. DATA HOOKS ---

// Flatten the WBS/Activity Tree
const useScheduleData = (
  activities: any[],
  wbsNodes: any[],
  relationships: any[],
  forceExpandAll: boolean = false,
) => {
  // 1. Build Predecessor & Successor Maps
  const { predecessorMap, successorMap } = useMemo(() => {
    const pMap = new Map<number, { text: string; linkId?: number }[]>();
    const sMap = new Map<number, { text: string; linkId?: number }[]>();

    const predsBySuccessor = new Map<number, any[]>();
    const succsByPredecessor = new Map<number, any[]>();

    relationships.forEach((r) => {
      // Predecessor Logic
      const sid = r.successor.id;
      if (!predsBySuccessor.has(sid)) predsBySuccessor.set(sid, []);
      predsBySuccessor.get(sid)?.push(r);

      // Successor Logic (New)
      const pid = r.predecessor.id;
      if (!succsByPredecessor.has(pid)) succsByPredecessor.set(pid, []);
      succsByPredecessor.get(pid)?.push(r);
    });

    activities.forEach((a) => {
      // Preds
      const preds = predsBySuccessor.get(a.id);
      if (!preds || preds.length === 0) pMap.set(a.id, []);
      else {
        const items = preds.map((p) => {
          const lagStr = p.lagDays
            ? p.lagDays > 0
              ? `+${p.lagDays}d`
              : `${p.lagDays}d`
            : "";
          const text = `${p.predecessor?.activityCode || p.predecessor?.id}${p.relationshipType}${lagStr}`;
          return { text, linkId: p.predecessor?.id };
        });
        pMap.set(a.id, items);
      }

      // Succs
      const succs = succsByPredecessor.get(a.id);
      if (!succs || succs.length === 0) sMap.set(a.id, []);
      else {
        const items = succs.map((s) => {
          const lagStr = s.lagDays
            ? s.lagDays > 0
              ? `+${s.lagDays}d`
              : `${s.lagDays}d`
            : "";
          const text = `${s.successor?.activityCode || s.successor?.id}${s.relationshipType}${lagStr}`;

          // Tooltip Content: Name (Parent WBS Code/Name)
          // We need to find the successor activity in the activities list to get its details?
          // Fortunately, typeorm relation 'successor' usually brings basic fields.
          // But 'wbsNode' might not be populated in the relationship object itself unless eager loaded.
          // However, we have the full 'activities' list available in scope!
          const actDetails = activities.find((a) => a.id === s.successor?.id);
          const tooltip = actDetails
            ? `${actDetails.activityName} (WBS: ${actDetails.wbsNode?.wbsName || "Root"})`
            : "Unknown Activity";

          return { text, linkId: s.successor?.id, tooltip };
        });
        sMap.set(a.id, items);
      }
    });
    return { predecessorMap: pMap, successorMap: sMap };
  }, [activities, relationships]);

  // 2. Build Tree Structure
  const treeData = useMemo(() => {
    const sortWbsNodes = (nodes: any[]) =>
      [...nodes].sort((a, b) =>
        compareNaturalCode(a.wbsCode || a.code || "", b.wbsCode || b.code || ""),
      );

    const rootNodes = sortWbsNodes(wbsNodes.filter((n) => !n.parentId));
    const buildNode = (node: any, level: number): TreeRow => {
      const childWbs = sortWbsNodes(
        wbsNodes.filter((n) => n.parentId === node.id),
      )
        .map((n) => buildNode(n, level + 1));
      const childActs = activities
        .filter((a) => a.wbsNode?.id === node.id)
        .sort((a, b) => {
          const dateA = a.startDatePlanned
            ? new Date(a.startDatePlanned).getTime()
            : 0;
          const dateB = b.startDatePlanned
            ? new Date(b.startDatePlanned).getTime()
            : 0;
          if (dateA !== dateB) return dateA - dateB;
          const codeComparison = compareNaturalCode(
            a.activityCode || "",
            b.activityCode || "",
          );
          if (codeComparison !== 0) return codeComparison;
          return (a.activityName || "").localeCompare(b.activityName || "");
        })
        .map(
          (a) =>
            ({
              type: "ACTIVITY",
              id: `ACT-${a.id}`,
              data: a,
              level: level + 1,
              children: [],
            }) as TreeRow,
        );
      return {
        type: "WBS",
        id: `WBS-${node.id}`,
        data: node,
        level: level,
        children: [...childWbs, ...childActs],
      };
    };
    return rootNodes.map((n) => buildNode(n, 0));
  }, [wbsNodes, activities]);

  // 3. Manage Expansion & Flattening
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (wbsNodes.length > 0 && (expandedNodeIds.size === 0 || forceExpandAll)) {
      const allIds = new Set<string>();
      wbsNodes.forEach((n) => allIds.add(`WBS-${n.id}`));
      setExpandedNodeIds(allIds);
    }
  }, [wbsNodes, forceExpandAll]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandNodes = useCallback((ids: string[]) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      ids.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const flattenedRows = useMemo(() => {
    const rows: TreeRow[] = [];
    const traverse = (nodes: TreeRow[]) => {
      for (const node of nodes) {
        rows.push(node);
        if (expandedNodeIds.has(node.id) && node.children.length > 0)
          traverse(node.children);
      }
    };
    traverse(treeData);
    return rows;
  }, [treeData, expandedNodeIds]);

  // 4. Row Map for Scroll To
  const rowMap = useMemo(() => {
    const actIdMap = new Map<number, number>();
    flattenedRows.forEach((row, index) => {
      if (row.type === "ACTIVITY") actIdMap.set(row.data.id, index);
    });
    return { actIdMap };
  }, [flattenedRows]);

  return {
    flattenedRows,
    predecessorMap,
    successorMap,
    expandedNodeIds,
    toggleExpand,
    expandNodes,
    rowMap,
  };
};

// --- 5. RENDERER COMPONENTS ---

// The Row Component (Passed to FixedSizeList)
const TableRow = (props: RowProps) => {
  const {
    index,
    style,
    flattenedRows,
    expandedNodeIds,
    toggleExpand,
    projectCode,
    columnDefinitions,
    colWidths,
    totalWidth,
    predecessorMap,
    successorMap, // Added
    onUpdateActivity,
    formatDate,
    scrollToActivity,
    fontSize,
  } = props;

  const row = flattenedRows[index];
  if (!row) return null;

  const isWbs = row.type === "WBS";
  const rowData = row.data;
  const isExpanded = expandedNodeIds.has(row.id);
  const sched = rowData.schedule || {};
  // Support both nested 'schedule' object (Master) and root-level properties (Version)
  const isCritical = !isWbs && (sched.isCritical || rowData.isCritical);
  const indent = row.level * 20 + 10;

  const bgClass = isWbs
    ? "bg-surface-raised font-bold text-text-primary"
    : isCritical
      ? "bg-error-muted hover:bg-error-muted"
      : "bg-surface-card hover:bg-primary-muted";
  const rowStyle = {
    ...style,
    width: Math.max(parseFloat(style.width as string) || 0, totalWidth),
    minWidth: "100%", // Ensure it stretches
  };

  return (
    <div
      style={rowStyle}
      className={clsx(
        "relative flex border-b border-border-default text-sm group isolate",
        bgClass,
      )}
    >
      {columnDefinitions.map((col) => {
        const isSticky = col.sticky === "left";
        const leftPos = isSticky
          ? col.key === "name"
            ? colWidths.id
            : 0
          : undefined;

        // Sticky Column Logic
        const stickyClass = isSticky ? "sticky z-20" : "";
        const stickyBgColor = isSticky
          ? isWbs
            ? "var(--color-surface-raised)"
            : isCritical
              ? "var(--color-error-muted)"
              : "var(--color-surface-card)"
          : undefined;
        const shadowClass =
          col.key === "name" && isSticky
            ? "shadow-[8px_0_12px_-8px_rgba(0,0,0,0.35)] border-r-2 border-r-border-strong"
            : "border-r border-border-default";

        const paddingStyle: CSSProperties =
          col.key === "id" ? { paddingLeft: indent } : {};

        return (
          <div
            key={col.key}
            className={clsx(
              "flex items-center h-full truncate px-2 py-1 flex-shrink-0 overflow-hidden", // cell base
              stickyClass,
              shadowClass,
              col.className,
            )}
            style={{
              width: col.width,
              left: leftPos,
              fontSize,
              zIndex: isSticky ? 25 : undefined,
              backgroundColor: stickyBgColor,
              backgroundImage: isSticky ? "none" : undefined,
              opacity: 1,
              ...paddingStyle,
            }}
            onClick={
              col.key === "id" && isWbs ? () => toggleExpand(row.id) : undefined
            }
          >
            {col.render({
              row,
              rowData,
              isWbs,
              isExpanded,
              isCritical,
              projectCode,
              predecessorMap,
              successorMap, // Added
              onUpdateActivity,
              formatDate,
              scrollToActivity,
              toggleExpand,
            })}
          </div>
        );
      })}
    </div>
  );
};
// --- 6. MAIN COMPONENT ---

const ScheduleTable: React.FC<ScheduleTableProps> = ({
  activities = [],
  relationships = [],
  wbsNodes = [],
  zoom = 1,
  projectCode,
  onUpdateActivity,
  ...props
}) => {
  // DEBUG STATE

  // --- STATE & DATA ---
  const {
    flattenedRows,
    predecessorMap,
    successorMap,
    expandedNodeIds,
    toggleExpand,
    expandNodes,
    rowMap,
  } = useScheduleData(
    activities,
    wbsNodes,
    relationships,
    props.forceExpandAll,
  );
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    {
      status: true,
      dur: true,
      pred: true,
      succ: true,
      planned: true,
      actual: true,
      financial: true,
      baseline: false,
      cpm: false,
      float: false,
      variance: true,
    },
  );
  const [showColMenu, setShowColMenu] = useState(false);

  // Column Width State
  const [colWidthsState, setColWidthsState] = useState({
    id: 250,
    name: 350,
    status: 60,
    dur: 80,
    pred: 150,
    succ: 150,
    date: 130,
    float: 80,
    variance: 80,
    money: 120,
    pct: 80,
  });

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "-";

  // --- REFS & SIZING ---
  const headerRef = useRef<HTMLDivElement>(null);
  const { ref: containerRef, width, height } = useContainerSize();

  // Reliable Scroll Sync via React Event System
  // We use onScrollCapture to ensure we get the event even if FixedSizeList uses onScroll internally
  const handleListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const left = target.scrollLeft;

    // Sync Header
    if (headerRef.current) {
      headerRef.current.scrollLeft = left;
    }
  }, []);

  // --- LOGIC: AUTO-POPULATION ---
  const handleUpdateWrapped = async (id: number, field: string, value: any) => {
    if (!onUpdateActivity) return;
    const act = activities.find((a) => a.id === id);
    if (!act) return;

    if (field === "percentComplete") {
      const newVal = Number(value);
      const oldVal = Number(act.percentComplete || 0);
      if (newVal !== oldVal) {
        await onUpdateActivity(id, "percentComplete", newVal);
        const today = new Date().toISOString().split("T")[0];
        if (newVal > 0 && !act.startDateActual)
          await onUpdateActivity(id, "startDateActual", today);
        if (newVal === 100 && !act.finishDateActual)
          await onUpdateActivity(id, "finishDateActual", today);
        else if (newVal < 100 && act.finishDateActual)
          await onUpdateActivity(id, "finishDateActual", null);
      }
    } else {
      await onUpdateActivity(id, field, value);
    }
  };

  // --- LOGIC: SCROLL TO ---
  const listRef = useRef<any>(null);
  const [pendingScrollId, setPendingScrollId] = useState<number | null>(null);

  const scrollToActivity = (actId: number) => {
    const index = rowMap.actIdMap.get(actId);

    // Helper to scroll
    const performScroll = (idx: number) => {
      // 1. Try standard ref
      if (listRef.current) {
        if (listRef.current.scrollToRow)
          listRef.current.scrollToRow({ index: idx, align: "center" });
        else if (listRef.current.scrollToItem)
          listRef.current.scrollToItem(idx, "center");
        return;
      }

      // 2. Try DOM Traversal
      let container = containerRef.current?.firstElementChild as HTMLDivElement;

      if (container) {
        const rowHeight = 38 * zoom;
        const targetTop = idx * rowHeight;
        const centeredTop = targetTop - height / 2 + rowHeight / 2;
        container.scrollTop = Math.max(0, centeredTop);
      }
    };

    if (index !== undefined) {
      performScroll(index);
    } else {
      // Not visible - need to expand parents
      const act = activities.find((a) => a.id === actId);

      if (act && act.wbsNode) {
        const idsToExpand: string[] = [];
        let currentWbsId = act.wbsNode.id;

        // Traverse up WBS tree
        while (currentWbsId) {
          idsToExpand.push(`WBS-${currentWbsId}`);
          const node = wbsNodes.find((n) => n.id === currentWbsId);
          currentWbsId = node ? node.parentId : null;
        }

        if (idsToExpand.length > 0) {
          expandNodes(idsToExpand);
          setPendingScrollId(actId); // Queue scroll for next render
        }
      }
    }
  };

  // Handle Pending Scroll after Render/Expansion
  useEffect(() => {
    if (pendingScrollId !== null) {
      const index = rowMap.actIdMap.get(pendingScrollId);
      if (index !== undefined) {
        // 1. Try standard ref
        if (listRef.current) {
          if (listRef.current.scrollToRow)
            listRef.current.scrollToRow({ index: index, align: "center" });
          else if (listRef.current.scrollToItem)
            listRef.current.scrollToItem(index, "center");
        }
        // 2. Try DOM Traversal
        else {
          let container = containerRef.current
            ?.firstElementChild as HTMLDivElement;

          if (container) {
            const rowHeight = 38 * zoom;
            const targetTop = index * rowHeight;
            const centeredTop = targetTop - height / 2 + rowHeight / 2;
            container.scrollTop = Math.max(0, centeredTop);
          }
        }
        setPendingScrollId(null); // Clear pending
      }
    }
  }, [pendingScrollId, rowMap, flattenedRows, height, zoom]);

  // container size hook

  // --- COLUMN CONFIG ---
  const colWidths = useMemo(
    () => ({
      ...colWidthsState,
      status: visibleColumns.status ? colWidthsState.status : 0,
      dur: visibleColumns.dur ? colWidthsState.dur : 0,
      pred: visibleColumns.pred ? colWidthsState.pred : 0,
      succ: visibleColumns.succ ? colWidthsState.succ : 0, // Added
      float: visibleColumns.float ? colWidthsState.float : 0,
      variance: visibleColumns.variance ? colWidthsState.variance : 0,
      money: visibleColumns.financial ? colWidthsState.money : 0,
      pct: visibleColumns.financial ? colWidthsState.pct : 0,
    }),
    [colWidthsState, visibleColumns],
  );

  const columnDefinitions = useMemo<ColumnDef[]>(
    () =>
      [
        {
          key: "id",
          label: "Activity ID",
          width: colWidths.id,
          sticky: "left" as const,
          render: ({ isWbs, isExpanded, rowData, projectCode }: CellProps) => (
            <div className="flex items-center flex-1 truncate cursor-pointer hover:text-primary">
              {isWbs &&
                (isExpanded ? (
                  <ChevronDown className="w-4 h-4 mr-1 text-text-muted" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-1 text-text-muted" />
                ))}
              {isWbs ? (
                <span className="mr-2 text-text-secondary">
                  {projectCode
                    ? `${projectCode}-${rowData.wbsCode}`
                    : rowData.wbsCode}
                </span>
              ) : (
                <span className="font-mono text-text-primary">
                  <span className="text-text-disabled mr-1">
                    {projectCode ? `${projectCode}-` : ""}
                    {rowData.wbsNode?.wbsCode}-
                  </span>
                  {rowData.activityCode}
                </span>
              )}
            </div>
          ),
        },
        {
          key: "name",
          label: "Activity Name",
          width: colWidths.name,
          sticky: "left" as const,
          render: ({ isWbs, rowData, isCritical }: CellProps) => (
            <div className="flex items-center w-full truncate">
              {!isWbs && isCritical && (
                <AlertTriangle className="w-3 h-3 text-error mr-2 flex-shrink-0" />
              )}
              <span
                className={clsx(
                  "truncate",
                  isWbs
                    ? "text-text-primary font-bold pl-2"
                    : "text-text-secondary",
                )}
                title={isWbs ? rowData.wbsName : rowData.activityName}
              >
                {isWbs ? rowData.wbsName : rowData.activityName}
              </span>
            </div>
          ),
        },
        {
          key: "status",
          label: "%",
          width: colWidths.status,
          className: "justify-center",
          render: ({ isWbs, rowData }: CellProps) =>
            isWbs ? (
              <span>
                {rowData.percentComplete !== undefined
                  ? `${Number(rowData.percentComplete).toFixed(0)}%`
                  : ""}
              </span>
            ) : (
              <EditableNumberCell
                value={rowData.percentComplete}
                onSave={(val) =>
                  handleUpdateWrapped(rowData.id, "percentComplete", val)
                }
              />
            ),
        },
        {
          key: "dur",
          label: "Dur",
          width: colWidths.dur,
          className: "justify-center text-text-muted",
          render: ({ isWbs, rowData }: CellProps) =>
            isWbs ? null : `${rowData.durationPlanned}d`,
        },
        {
          key: "pred",
          label: "Predecessors",
          width: colWidths.pred,
          className: "text-xs text-primary",
          render: ({
            isWbs,
            rowData,
            predecessorMap,
            scrollToActivity,
          }: CellProps) => {
            if (isWbs) return null;
            const predItems = predecessorMap.get(rowData.id) || [];
            return (
              <div className="flex gap-1 overflow-x-auto scroller-hidden">
                {predItems.map((p: any, i: number) => (
                  <span
                    key={i}
                    onClick={() => p.linkId && scrollToActivity(p.linkId)}
                    className="cursor-pointer hover:underline hover:text-blue-800 whitespace-nowrap bg-primary-muted px-1 rounded"
                  >
                    {p.text}
                  </span>
                ))}
              </div>
            );
          },
        },
        {
          key: "succ",
          label: "Successors",
          width: colWidths.succ,
          className: "text-xs text-secondary",
          render: ({
            isWbs,
            rowData,
            successorMap,
            scrollToActivity,
          }: CellProps) => {
            if (isWbs) return null;
            const succItems = successorMap.get(rowData.id) || [];
            return (
              <div className="flex gap-1 overflow-x-auto scroller-hidden">
                {succItems.map((s: any, i: number) => (
                  <span
                    key={i}
                    onClick={() => s.linkId && scrollToActivity(s.linkId)}
                    title={s.tooltip}
                    className="cursor-pointer hover:underline hover:text-indigo-800 whitespace-nowrap bg-secondary-muted px-1 rounded"
                  >
                    {s.text}
                  </span>
                ))}
              </div>
            );
          },
        },
        {
          key: "plannedStart",
          label: "Start (Plan)",
          width: colWidths.date,
          className: "justify-center text-text-secondary bg-primary-muted/5",
          render: ({ rowData, formatDate }: CellProps) =>
            formatDate(rowData.startDatePlanned),
        },
        {
          key: "plannedFinish",
          label: "Finish (Plan)",
          width: colWidths.date,
          className: "justify-center text-text-secondary bg-primary-muted/5",
          render: ({ rowData, formatDate }: CellProps) =>
            formatDate(rowData.finishDatePlanned),
        },
        {
          key: "actualStart",
          label: "Actual Start",
          width: colWidths.date,
          className: "justify-center bg-success-muted/5",
          render: ({ isWbs, rowData, formatDate }: CellProps) =>
            isWbs ? (
              formatDate(rowData.startDateActual)
            ) : (
              <EditableDateCell
                value={rowData.startDateActual}
                onSave={(val) =>
                  handleUpdateWrapped(
                    rowData.id,
                    "startDateActual",
                    val || null,
                  )
                }
              />
            ),
        },
        {
          key: "actualFinish",
          label: "Actual Finish",
          width: colWidths.date,
          className: "justify-center bg-success-muted/5",
          render: ({ isWbs, rowData, formatDate }: CellProps) =>
            isWbs ? (
              formatDate(rowData.finishDateActual)
            ) : (
              <EditableDateCell
                value={rowData.finishDateActual}
                onSave={(val) =>
                  handleUpdateWrapped(
                    rowData.id,
                    "finishDateActual",
                    val || null,
                  )
                }
              />
            ),
        },
        {
          key: "blStart",
          label: "Start (Base)",
          width: colWidths.date,
          className: "justify-center text-text-muted bg-warning-muted/5",
          render: ({ rowData, formatDate }: CellProps) =>
            formatDate(rowData.startDateBaseline),
        },
        {
          key: "blFinish",
          label: "Finish (Base)",
          width: colWidths.date,
          className: "justify-center text-text-muted bg-warning-muted/5",
          render: ({ rowData, formatDate }: CellProps) =>
            formatDate(rowData.finishDateBaseline),
        },
        {
          key: "cpmStart",
          label: "Early Start",
          width: colWidths.date,
          className: "justify-center text-purple-600 bg-purple-50/5",
          render: ({ isWbs, rowData, formatDate }: CellProps) =>
            isWbs ? null : formatDate(rowData.schedule?.earlyStart),
        },
        {
          key: "cpmFinish",
          label: "Early Finish",
          width: colWidths.date,
          className: "justify-center text-purple-600 bg-purple-50/5",
          render: ({ isWbs, rowData, formatDate }: CellProps) =>
            isWbs ? null : formatDate(rowData.schedule?.earlyFinish),
        },
        {
          key: "float",
          label: "Float",
          width: colWidths.float,
          className: "justify-center text-xs",
          render: ({ isWbs, rowData }: CellProps) => {
            if (isWbs) return null;
            const float = rowData.schedule?.totalFloat;
            if (float === undefined || float === null) return "-";
            return (
              <span
                className={
                  float <= 0 ? "text-error font-bold" : "text-text-secondary"
                }
              >
                {float}d
              </span>
            );
          },
        },
        {
          key: "budgetedValue",
          label: "Assigned Value",
          width: colWidths.money,
          className:
            "justify-end pr-4 text-[11px] tabular-nums text-text-muted",
          render: ({ rowData }: CellProps) => {
            const val = Number(rowData.budgetedValue || 0);
            return val > 0 ? `₹${val.toLocaleString()}` : "-";
          },
        },
        {
          key: "actualValue",
          label: "Achieved Value",
          width: colWidths.money,
          className:
            "justify-end pr-4 text-[11px] tabular-nums text-green-700 font-medium",
          render: ({ rowData }: CellProps) => {
            const val = Number(rowData.actualValue || 0);
            return val > 0 ? `₹${val.toLocaleString()}` : "-";
          },
        },
        {
          key: "valueProgress",
          label: "Value %",
          width: colWidths.pct,
          className:
            "justify-center text-[11px] font-semibold text-blue-700 bg-primary-muted/20",
          render: ({ rowData }: CellProps) => {
            const budget = Number(rowData.budgetedValue || 0);
            const actual = Number(rowData.actualValue || 0);
            if (budget <= 0) return "-";
            const pct = (actual / budget) * 100;
            return `${pct.toFixed(1)}%`;
          },
        },
        {
          key: "variance",
          label: "Variance",
          width: colWidths.variance,
          className: "justify-center text-xs",
          render: ({ rowData }: CellProps) => {
            if (
              !rowData.finishDatePlanned ||
              (!rowData.finishDateActual && !rowData.schedule?.earlyFinish)
            )
              return "-";
            const plan = new Date(rowData.finishDatePlanned).getTime();
            const current = new Date(
              rowData.finishDateActual || rowData.schedule?.earlyFinish,
            ).getTime();
            const diff = Math.round((current - plan) / (1000 * 60 * 60 * 24));
            if (diff === 0)
              return <span className="text-text-disabled">0</span>;
            return (
              <span
                className={diff > 0 ? "text-error font-bold" : "text-success"}
              >
                {diff > 0 ? `+${diff}` : diff}d
              </span>
            );
          },
        },
      ].filter((c) => {
        const visKey =
          c.key === "plannedStart"
            ? "planned"
            : c.key === "plannedFinish"
              ? "planned"
              : c.key === "actualStart"
                ? "actual"
                : c.key === "actualFinish"
                  ? "actual"
                  : c.key === "blStart"
                    ? "baseline"
                    : c.key === "blFinish"
                      ? "baseline"
                      : c.key === "cpmStart"
                        ? "cpm"
                        : c.key === "cpmFinish"
                          ? "cpm"
                          : c.key === "status"
                            ? "status"
                            : c.key === "dur"
                              ? "dur"
                              : c.key === "pred"
                                ? "pred"
                                : c.key === "succ"
                                  ? "succ"
                                  : c.key === "budgetedValue"
                                    ? "financial"
                                    : c.key === "actualValue"
                                      ? "financial"
                                      : c.key === "valueProgress"
                                        ? "financial"
                                        : c.key === "float"
                                          ? "float"
                                          : c.key === "variance"
                                            ? "variance"
                                            : null;

        return visKey ? visibleColumns[visKey] : true;
      }),
    [colWidths, visibleColumns, onUpdateActivity, activities],
  );

  const totalWidth = columnDefinitions.reduce((acc, col) => acc + col.width, 0);

  // Force inner width sync logic removed (handled by sticky/minWidth)

  // --- RESIZE LOGIC ---
  const handleResizeStart = (
    e: React.MouseEvent,
    colKey: keyof typeof colWidthsState,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidthsState[colKey];
    const handleMouseMove = (moveEvent: MouseEvent) => {
      setColWidthsState((prev) => ({
        ...prev,
        [colKey]: Math.max(50, startWidth + (moveEvent.clientX - startX)),
      }));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // --- RENDER ---
  // --- RENDER ---

  // Data packet for rows
  const itemData = useMemo(
    () => ({
      flattenedRows,
      expandedNodeIds,
      toggleExpand,
      projectCode,
      visibleColumns,
      columnDefinitions,
      colWidths,
      totalWidth,
      predecessorMap,
      successorMap,
      onUpdateActivity,
      formatDate,
      scrollToActivity,
      fontSize: `${0.875 * zoom}rem`,
    }),
    [
      flattenedRows,
      expandedNodeIds,
      toggleExpand,
      projectCode,
      visibleColumns,
      columnDefinitions,
      colWidths,
      totalWidth,
      predecessorMap,
      onUpdateActivity,
      formatDate,
      scrollToActivity,
      zoom,
    ],
  );

  return (
    <div className="flex-1 h-full w-full overflow-hidden bg-surface-card flex flex-col min-h-0 relative">
      {/* Column Config */}
      <div className="absolute top-2 right-2 z-50">
        <button
          onClick={() => setShowColMenu(!showColMenu)}
          className="p-1 bg-surface-card border border-border-strong rounded shadow hover:bg-surface-base"
        >
          <Settings className="w-4 h-4 text-text-secondary" />
        </button>
        {showColMenu && (
          <div className="absolute right-0 mt-1 w-48 bg-surface-card border border-border-default rounded shadow-lg p-2 text-sm z-50">
            <div className="font-bold mb-2 text-text-secondary">Columns</div>

            {Object.keys(visibleColumns).map((key) => (
              <label
                key={key}
                className="flex items-center mb-1 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns[key]}
                  onChange={() =>
                    setVisibleColumns((p) => ({ ...p, [key]: !p[key] }))
                  }
                  className="mr-2"
                />
                <span className="capitalize">{key}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div
        ref={headerRef}
        className="overflow-hidden bg-surface-raised shadow-sm border-b border-border-default flex-shrink-0 isolate"
      >
        <div
          className="flex font-semibold text-text-secondary uppercase text-xs tracking-wider h-full items-center"
          style={{ width: totalWidth + 20, minWidth: "100%" }}
        >
          {columnDefinitions.map((col) => (
            <div
              key={col.key}
              className={clsx(
                "flex-shrink-0 border-r border-border-strong px-2 py-3 relative truncate flex items-center select-none group",
                col.sticky === "left" &&
                  "sticky z-30 bg-surface-raised !bg-opacity-100 font-bold text-text-primary",
                col.sticky === "left" &&
                  col.key === "name" &&
                  "shadow-[8px_0_12px_-8px_rgba(0,0,0,0.35)] border-r-2 border-r-border-strong",
                col.className,
              )}
              style={{
                width: col.width,
                left:
                  col.sticky === "left"
                    ? col.key === "name"
                      ? colWidths.id
                      : 0
                    : undefined,
                backgroundColor:
                  col.sticky === "left"
                    ? "var(--color-surface-raised)"
                    : undefined,
              }}
            >
              {col.label}
              {/* Resizer Handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary z-50 transition-colors opacity-0 group-hover:opacity-100"
                onMouseDown={(e) => handleResizeStart(e, col.key as any)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ))}
        </div>
      </div>

      {/* List Body with Logic-Controlled Resizing */}
      <div className="w-full relative bg-surface-card flex-1 min-h-0 isolate">
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          {height > 0 && width > 0 && FixedSizeList ? (
            <FixedSizeList
              height={height}
              width={width}
              rowCount={flattenedRows.length}
              rowHeight={38 * zoom}
              rowComponent={TableRow}
              rowProps={itemData}
              ref={listRef}
              innerElementType={InnerElement}
              onScrollCapture={handleListScroll}
              style={{ overflow: "auto", scrollbarGutter: "stable both-edges" }}
              className="virtual-list-container"
            />
          ) : (
            <div className="p-10 text-center text-text-muted">
              {flattenedRows.length === 0 ? "No Data" : "Calculating Layout..."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleTable;
