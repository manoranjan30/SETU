import React, { useState, useMemo, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Building2,
  FileText,
  Layers,
  Ruler,
  Package,
  CheckSquare,
  Square,
  Search,
} from "lucide-react";

/**
 * Tree Structure from Backend:
 * Vendor[] → WorkOrder[] → BoqItem[] → SubItem[] → Measurement[]
 *
 * Each leaf (Measurement, SubItem.woItem, or directWoItem) has a workOrderItemId
 * which is the selectable/linkable unit.
 */

interface Props {
  vendorTree: any[];
  selectedWoItemIds: number[];
  onSelectionChange: (ids: number[]) => void;
}

// Flattened row for rendering
interface TreeRow {
  key: string;
  level: number; // 0=Vendor, 1=WO, 2=BOQ, 3=Sub, 4=Meas
  type: "VENDOR" | "WO" | "BOQ" | "SUB" | "MEAS" | "DIRECT";
  label: string;
  subtitle?: string;
  qty?: number;
  uom?: string;
  rate?: number;
  amount?: number;
  mappingStatus?: string;
  linkedActivities?: string;
  workOrderItemId?: number; // Only leaf items have this
  hasChildren: boolean;
  parentKey?: string;
  childCount?: number;
}

const isMeasurementRow = (row: TreeRow) => row.type === "MEAS";
const isMappedStatus = (status?: string) => status === "MAPPED";

const BoqGridPanel: React.FC<Props> = ({
  vendorTree,
  selectedWoItemIds,
  onSelectionChange,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState("");

  // Toggle expand/collapse
  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Build flat rows from tree
  const allRows = useMemo<TreeRow[]>(() => {
    const rows: TreeRow[] = [];
    if (!vendorTree || vendorTree.length === 0) return rows;

    for (const vendor of vendorTree) {
      const vendorKey = `V:${vendor.vendorId}`;
      let vendorChildCount = 0;

      // Count total WO items under this vendor
      for (const wo of vendor.workOrders || []) {
        for (const boq of wo.boqItems || []) {
          vendorChildCount += (boq.directWoItems || []).length;
          for (const sub of boq.subItems || []) {
            if (sub.woItem) vendorChildCount++;
            vendorChildCount += (sub.measurements || []).length;
          }
        }
      }

      rows.push({
        key: vendorKey,
        level: 0,
        type: "VENDOR",
        label: vendor.vendorName,
        hasChildren: (vendor.workOrders || []).length > 0,
        childCount: vendorChildCount,
      });

      for (const wo of vendor.workOrders || []) {
        const woKey = `${vendorKey}|WO:${wo.workOrderId}`;
        let woChildCount = 0;
        for (const boq of wo.boqItems || []) {
          woChildCount += (boq.directWoItems || []).length;
          for (const sub of boq.subItems || []) {
            if (sub.woItem) woChildCount++;
            woChildCount += (sub.measurements || []).length;
          }
        }

        rows.push({
          key: woKey,
          level: 1,
          type: "WO",
          label: wo.woNumber,
          hasChildren: (wo.boqItems || []).length > 0,
          parentKey: vendorKey,
          childCount: woChildCount,
        });

        for (const boq of wo.boqItems || []) {
          const boqKey = `${woKey}|BOQ:${boq.boqItemId}`;
          const boqDirectCount = (boq.directWoItems || []).length;
          const boqSubCount = (boq.subItems || []).reduce(
            (acc: number, s: any) =>
              acc + (s.woItem ? 1 : 0) + (s.measurements || []).length,
            0,
          );

          rows.push({
            key: boqKey,
            level: 2,
            type: "BOQ",
            label: boq.description,
            subtitle: boq.boqCode,
            uom: boq.uom,
            hasChildren:
              boqDirectCount + boqSubCount > 0 ||
              (boq.subItems || []).length > 0,
            parentKey: woKey,
            childCount: boqDirectCount + boqSubCount,
          });

          // Direct WO items at BOQ Main level
          for (let i = 0; i < (boq.directWoItems || []).length; i++) {
            const d = boq.directWoItems[i];
            rows.push({
              key: `${boqKey}|D:${d.workOrderItemId}`,
              level: 3,
              type: "DIRECT",
              label: d.description,
              qty: d.qty,
              uom: d.uom,
              rate: d.rate,
              amount: d.amount,
              mappingStatus: d.mappingStatus,
              linkedActivities: d.linkedActivities,
              workOrderItemId: d.workOrderItemId,
              hasChildren: false,
              parentKey: boqKey,
            });
          }

          // Sub items
          for (const sub of boq.subItems || []) {
            const subKey = `${boqKey}|SUB:${sub.boqSubItemId}`;
            const measCount = (sub.measurements || []).length;
            const hasMeas = measCount > 0;

            rows.push({
              key: subKey,
              level: 3,
              type: "SUB",
              label: sub.description,
              qty: sub.woItem?.qty,
              uom: sub.woItem?.uom,
              rate: sub.woItem?.rate,
              amount: sub.woItem?.amount,
              mappingStatus: sub.woItem?.mappingStatus,
              linkedActivities: sub.woItem?.linkedActivities,
              workOrderItemId: sub.woItem?.workOrderItemId,
              hasChildren: hasMeas,
              parentKey: boqKey,
              childCount: measCount,
            });

            // Measurements
            for (const meas of sub.measurements || []) {
              rows.push({
                key: `${subKey}|M:${meas.workOrderItemId}`,
                level: 4,
                type: "MEAS",
                label: meas.description,
                qty: meas.qty,
                uom: meas.uom,
                rate: meas.rate,
                amount: meas.amount,
                mappingStatus: meas.mappingStatus,
                linkedActivities: meas.linkedActivities,
                workOrderItemId: meas.workOrderItemId,
                hasChildren: false,
                parentKey: subKey,
              });
            }
          }
        }
      }
    }
    return rows;
  }, [vendorTree]);

  // Expand all
  const expandAll = useCallback(() => {
    setExpandedKeys(() => {
      const next = new Set<string>();
      allRows.forEach((r) => {
        if (r.hasChildren) next.add(r.key);
      });
      return next;
    });
  }, [allRows]);

  // Collapse all
  const collapseAll = useCallback(() => {
    setExpandedKeys(new Set());
  }, []);

  const displayRows = useMemo<TreeRow[]>(() => {
    const childrenByParentKey = new Map<string, TreeRow[]>();
    allRows.forEach((row) => {
      if (!row.parentKey) return;
      const bucket = childrenByParentKey.get(row.parentKey) || [];
      bucket.push(row);
      childrenByParentKey.set(row.parentKey, bucket);
    });

    const collectMeasurementLeaves = (row: TreeRow): TreeRow[] => {
      const children = childrenByParentKey.get(row.key) || [];
      if (children.length === 0) {
        return isMeasurementRow(row) ? [row] : [];
      }
      return children.flatMap(collectMeasurementLeaves);
    };

    return allRows.map((row) => {
      if (!row.hasChildren) return row;

      const descendantMeasurements = collectMeasurementLeaves(row);
      if (descendantMeasurements.length === 0) {
        return row;
      }

      const mappedCount = descendantMeasurements.filter((child) =>
        isMappedStatus(child.mappingStatus),
      ).length;

      let mappingStatus = "UNMAPPED";
      if (mappedCount === descendantMeasurements.length) {
        mappingStatus = "MAPPED";
      } else if (mappedCount > 0) {
        mappingStatus = "PARTIALLY_MAPPED";
      }

      const linkedActivities = Array.from(
        new Set(
          descendantMeasurements.flatMap((child) =>
            (child.linkedActivities || "")
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ),
      ).join(", ");

      return {
        ...row,
        mappingStatus,
        linkedActivities,
      };
    });
  }, [allRows]);

  // Filter rows based on search + expansion state
  const visibleRows = useMemo(() => {
    if (searchText.trim()) {
      // When searching, show all matching rows + their ancestors
      const lowerSearch = searchText.toLowerCase();
      const matchKeys = new Set<string>();

      displayRows.forEach((row) => {
        if (
          row.label?.toLowerCase().includes(lowerSearch) ||
          row.subtitle?.toLowerCase().includes(lowerSearch)
        ) {
          // Add this row and all ancestors
          matchKeys.add(row.key);
          let parentKey = row.parentKey;
          while (parentKey) {
            matchKeys.add(parentKey);
            const parent = displayRows.find((r) => r.key === parentKey);
            parentKey = parent?.parentKey;
          }
        }
      });
      return displayRows.filter((r) => matchKeys.has(r.key));
    }

    // Normal expansion filtering
    return displayRows.filter((row) => {
      if (row.level === 0) return true;
      let currentKey = row.parentKey;
      while (currentKey) {
        if (!expandedKeys.has(currentKey)) return false;
        const parent = displayRows.find((r) => r.key === currentKey);
        if (!parent) break;
        currentKey = parent.parentKey;
      }
      return true;
    });
  }, [displayRows, searchText, expandedKeys]);

  // Selection helpers
  const toggleSelect = useCallback(
    (woItemId: number) => {
      onSelectionChange(
        selectedWoItemIds.includes(woItemId)
          ? selectedWoItemIds.filter((id) => id !== woItemId)
          : [...selectedWoItemIds, woItemId],
      );
    },
    [selectedWoItemIds, onSelectionChange],
  );

  // Collect all selectable WO Item IDs under a branch
  const getDescendantWoItemIds = useCallback(
    (key: string): number[] => {
      const ids: number[] = [];
      for (const row of allRows) {
        if (
          row.key.startsWith(key + "|") &&
          row.workOrderItemId &&
          isMeasurementRow(row)
        ) {
          ids.push(row.workOrderItemId);
        }
        if (row.key === key && row.workOrderItemId && isMeasurementRow(row)) {
          ids.push(row.workOrderItemId);
        }
      }
      return ids;
    },
    [allRows],
  );

  const toggleSelectBranch = useCallback(
    (key: string) => {
      const branchIds = getDescendantWoItemIds(key);
      const allSelected = branchIds.every((id) =>
        selectedWoItemIds.includes(id),
      );

      if (allSelected) {
        // Deselect all
        onSelectionChange(
          selectedWoItemIds.filter((id) => !branchIds.includes(id)),
        );
      } else {
        // Select all
        const merged = [...new Set([...selectedWoItemIds, ...branchIds])];
        onSelectionChange(merged);
      }
    },
    [selectedWoItemIds, onSelectionChange, getDescendantWoItemIds],
  );

  const getBranchSelectionState = useCallback(
    (key: string): "none" | "some" | "all" => {
      const branchIds = getDescendantWoItemIds(key);
      if (branchIds.length === 0) return "none";
      const selectedCount = branchIds.filter((id) =>
        selectedWoItemIds.includes(id),
      ).length;
      if (selectedCount === 0) return "none";
      if (selectedCount === branchIds.length) return "all";
      return "some";
    },
    [selectedWoItemIds, getDescendantWoItemIds],
  );

  // Icon helpers
  const getIcon = (type: string) => {
    switch (type) {
      case "VENDOR":
        return <Building2 size={16} className="text-secondary" />;
      case "WO":
        return <FileText size={16} className="text-primary" />;
      case "BOQ":
        return <Layers size={16} className="text-warning" />;
      case "SUB":
        return <Package size={14} className="text-teal-500" />;
      case "MEAS":
        return <Ruler size={14} className="text-text-muted" />;
      case "DIRECT":
        return <Package size={14} className="text-teal-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const colors =
      status === "MAPPED"
        ? "bg-green-100 text-green-700 border-green-200"
        : status === "PARTIALLY_MAPPED"
          ? "bg-blue-100 text-blue-700 border-blue-200"
          : "bg-surface-raised text-text-muted border-border-default";
    return (
      <span
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors}`}
      >
        {status === "PARTIALLY_MAPPED" ? "PARTIAL" : status}
      </span>
    );
  };

  // Checkbox renderer
  const renderCheckbox = (row: TreeRow) => {
    if (row.workOrderItemId && isMeasurementRow(row)) {
      const isSelected = selectedWoItemIds.includes(row.workOrderItemId);
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSelect(row.workOrderItemId!);
          }}
          className="mr-2 flex-shrink-0"
        >
          {isSelected ? (
            <CheckSquare size={16} className="text-primary" />
          ) : (
            <Square size={16} className="text-text-disabled" />
          )}
        </button>
      );
    }
    // Branch checkbox
    if (row.hasChildren) {
      const state = getBranchSelectionState(row.key);
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSelectBranch(row.key);
          }}
          className="mr-2 flex-shrink-0"
        >
          {state === "all" ? (
            <CheckSquare size={16} className="text-primary" />
          ) : state === "some" ? (
            <CheckSquare size={16} className="text-blue-300" />
          ) : (
            <Square size={16} className="text-text-disabled" />
          )}
        </button>
      );
    }
    return <span className="w-4 mr-2" />;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Search + Controls */}
      <div className="p-2 border-b bg-surface-base flex gap-2 items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-disabled"
          />
          <input
            type="text"
            placeholder="Search vendors, WO numbers, BOQ items..."
            className="w-full pl-8 pr-3 py-2 border rounded shadow-sm text-sm focus:ring-2 focus:ring-primary outline-none"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <button
          onClick={expandAll}
          className="px-2 py-1.5 text-xs text-text-secondary hover:bg-gray-200 rounded border"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="px-2 py-1.5 text-xs text-text-secondary hover:bg-gray-200 rounded border"
        >
          Collapse All
        </button>
      </div>

      {/* Column Headers */}
      <div className="flex items-center px-4 py-2 bg-surface-raised border-b text-[11px] font-semibold text-text-muted uppercase tracking-wider">
        <div className="flex-1 min-w-0">Description</div>
        <div className="w-20 text-right">Qty</div>
        <div className="w-14 text-center">UoM</div>
        <div className="w-20 text-right">Rate</div>
        <div className="w-24 text-right">Amount</div>
        <div className="w-20 text-center">Status</div>
        <div className="w-40 truncate">Linked Activity</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {visibleRows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-disabled">
            <Layers size={40} className="mb-2" />
            <p className="text-sm">No WO items found for this project</p>
            <p className="text-xs mt-1">
              Create Work Orders and assign BOQ items first
            </p>
          </div>
        )}

        {visibleRows.map((row) => {
          const indent = row.level * 24;
          const isExpanded = expandedKeys.has(row.key);
          const isLeaf = !!row.workOrderItemId && isMeasurementRow(row);
          const isSelected =
            isLeaf && selectedWoItemIds.includes(row.workOrderItemId!);

          // Row background color based on level
          let bgClass = "hover:bg-primary-muted";
          if (row.type === "VENDOR")
            bgClass =
              "bg-secondary-muted/50 hover:bg-indigo-100/60 border-b border-indigo-100";
          else if (row.type === "WO")
            bgClass = "bg-primary-muted/30 hover:bg-primary-muted/60";
          if (isSelected) bgClass = "bg-info-muted/50 hover:bg-info-muted/70";

          return (
            <div
              key={row.key}
              className={`flex items-center px-4 py-1.5 border-b border-border-subtle cursor-pointer transition-colors text-sm ${bgClass}`}
              onClick={() => {
                if (row.hasChildren) toggleExpand(row.key);
                else if (row.workOrderItemId && isMeasurementRow(row)) {
                  toggleSelect(row.workOrderItemId);
                }
              }}
            >
              {/* Description column */}
              <div
                className="flex-1 min-w-0 flex items-center"
                style={{ paddingLeft: indent }}
              >
                {/* Expand Toggle */}
                <div className="w-5 flex-shrink-0 flex items-center justify-center mr-1">
                  {row.hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(row.key);
                      }}
                      className="text-text-disabled hover:text-text-secondary"
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </button>
                  ) : (
                    <span className="w-3" />
                  )}
                </div>

                {/* Checkbox */}
                {renderCheckbox(row)}

                {/* Icon */}
                <span className="mr-1.5 flex-shrink-0">
                  {getIcon(row.type)}
                </span>

                {/* Label */}
                <span
                  className={`truncate ${
                    row.type === "VENDOR"
                      ? "font-bold text-indigo-800"
                      : row.type === "WO"
                        ? "font-semibold text-blue-700"
                        : row.type === "BOQ"
                          ? "font-medium text-gray-800"
                          : "text-text-secondary"
                  }`}
                  title={row.label}
                >
                  {row.label}
                </span>

                {/* Subtitle / Badge */}
                {row.subtitle && (
                  <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono">
                    {row.subtitle}
                  </span>
                )}
                {row.childCount !== undefined && row.childCount > 0 && (
                  <span className="ml-2 text-[10px] bg-gray-200 text-text-secondary px-1.5 py-0.5 rounded">
                    {row.childCount} items
                  </span>
                )}
              </div>

              {/* Qty */}
              <div className="w-20 text-right text-xs tabular-nums text-text-secondary">
                {row.qty !== undefined
                  ? row.qty.toLocaleString(undefined, {
                      maximumFractionDigits: 3,
                    })
                  : ""}
              </div>

              {/* UoM */}
              <div className="w-14 text-center text-xs text-text-muted">
                {row.uom || ""}
              </div>

              {/* Rate */}
              <div className="w-20 text-right text-xs tabular-nums text-text-secondary">
                {row.rate !== undefined
                  ? row.rate.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })
                  : ""}
              </div>

              {/* Amount */}
              <div className="w-24 text-right text-xs tabular-nums font-medium text-gray-800">
                {row.amount !== undefined
                  ? row.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })
                  : ""}
              </div>

              {/* Status */}
              <div className="w-20 text-center">
                {getStatusBadge(row.mappingStatus)}
              </div>

              {/* Linked Activity */}
              <div
                className="w-40 text-xs text-text-muted truncate"
                title={row.linkedActivities || ""}
              >
                {row.linkedActivities || ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BoqGridPanel;
