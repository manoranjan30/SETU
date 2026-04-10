import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import api from "../../api/axios";
import {
  Loader2,
  Plus,
  ChevronRight,
  ChevronDown,
  Layers,
  Box,
  Ruler,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | number;
  onSelectItems: (items: any[]) => void;
}

const BoqSelectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
  onSelectItems,
}) => {
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Map<string, any>>(
    new Map(),
  );

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api
        .get(`/workdoc/${projectId}/available-boq-qty`)
        .then((res) => {
          setBoqItems(res.data || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      setSelectedItems(new Map());
      setExpandedIds(new Set());
    }
  }, [isOpen, projectId]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const buildSelection = (
    item: any,
    level: number,
    parent?: any,
    grandParent?: any,
  ) => ({
    ...item,
    level,
    parentInfo: parent,
    grandParentInfo: grandParent,
    boqItemId:
      level === 0
        ? item.id
        : grandParent?.id || parent?.id || item.boqItemId,
    boqSubItemId: level === 1 ? item.id : level === 2 ? parent?.id : null,
    measurementElementId: level === 2 ? item.id : null,
    boqRate:
      level === 2
        ? Number(parent?.rate || grandParent?.rate || item.rate || 0)
        : Number(item.rate || item.totalRate || item.boqRate || 0),
  });

  const collectSelections = (
    item: any,
    level: number,
    parent?: any,
    grandParent?: any,
  ): Array<{ key: string; selection: any }> => {
    const key = `${level}-${item.id}`;
    const current = [{ key, selection: buildSelection(item, level, parent, grandParent) }];
    const children =
      level === 0 ? item.subItems || [] : level === 1 ? item.measurements || [] : [];

    if (level === 0) {
      children.forEach((child: any) => {
        current.push(...collectSelections(child, 1, item, undefined));
      });
    } else if (level === 1) {
      children.forEach((child: any) => {
        current.push(...collectSelections(child, 2, item, parent));
      });
    }

    return current;
  };

  const handleSelect = (
    item: any,
    level: number,
    parent?: any,
    grandParent?: any,
  ) => {
    const next = new Map(selectedItems);
    const subtreeSelections = collectSelections(item, level, parent, grandParent);
    const isAlreadySelected = next.has(`${level}-${item.id}`);

    if (isAlreadySelected) {
      subtreeSelections.forEach(({ key }) => next.delete(key));
    } else {
      subtreeSelections.forEach(({ key, selection }) => next.set(key, selection));
      if (level === 2) {
        if (parent) {
          next.set(`1-${parent.id}`, buildSelection(parent, 1, grandParent));
        }
        if (grandParent) {
          next.set(`0-${grandParent.id}`, buildSelection(grandParent, 0));
        }
      } else if (level === 1 && parent) {
        next.set(`0-${parent.id}`, buildSelection(parent, 0));
      }

      if (level < 2) {
        const expanded = new Set(expandedIds);
        expanded.add(`${level}-${item.id}`);
        setExpandedIds(expanded);
      }
    }
    setSelectedItems(next);
  };

  const handleConfirm = () => {
    const selections = Array.from(selectedItems.values());
    const selectedSubItemIdsWithMeasurements = new Set(
      selections
        .filter(
          (entry) => entry.level === 2 && entry.boqSubItemId,
        )
        .map((entry) => entry.boqSubItemId),
    );
    const selectedBoqItemIdsWithChildren = new Set(
      selections
        .filter((entry) => entry.level > 0 && entry.boqItemId)
        .map((entry) => entry.boqItemId),
    );

    const effectiveSelections = selections.filter((entry) => {
      if (entry.level === 2) return !!entry.measurementElementId;
      if (entry.level === 1) {
        return !selectedSubItemIdsWithMeasurements.has(entry.id);
      }
      if (entry.level === 0) {
        return !selectedBoqItemIdsWithChildren.has(entry.id);
      }
      return true;
    });

    onSelectItems(effectiveSelections);
    onClose();
  };

  const renderLevel = (
    items: any[],
    level: number,
    parent?: any,
    grandParent?: any,
  ) => {
    return items.map((item) => {
      const id = `${level}-${item.id}`;
      const isExpanded = expandedIds.has(id);
      const isSelected = selectedItems.has(id);
      const children =
        level === 0 ? item.subItems : level === 1 ? item.measurements : [];
      const hasChildren = children && children.length > 0;

      const qty = item.availableQty || 0;
      const rate = item.rate || item.totalRate || item.boqRate || 0;

      return (
        <div key={id} className="select-none">
          <div
            className={`group flex items-center p-2 hover:bg-surface-base border-b border-slate-100 transition-colors cursor-pointer ${
              isSelected ? "bg-primary-muted/50" : ""
            }`}
            style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
            onClick={() => handleSelect(item, level, parent, grandParent)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="checkbox"
                checked={isSelected}
                readOnly
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />

              {hasChildren ? (
                <button
                  onClick={(e) => toggleExpand(id, e)}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}

              {level === 0 && (
                <Layers size={14} className="text-primary shrink-0" />
              )}
              {level === 1 && (
                <Box size={14} className="text-orange-500 shrink-0" />
              )}
              {level === 2 && (
                <Ruler size={14} className="text-emerald-500 shrink-0" />
              )}

              <div className="flex flex-col min-w-0">
                <span className="font-bold text-text-secondary text-xs truncate">
                  {item.boqCode || item.elementName || item.description}
                </span>
                <span className="text-[10px] text-text-disabled truncate">
                  {item.description || item.elementName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right shrink-0">
              <div className="hidden sm:block">
                <p className="text-[10px] text-text-disabled font-bold uppercase tracking-tighter leading-none">
                  Rate
                </p>
                <p className="text-xs font-mono font-bold text-slate-600">
                  ₹{Number(rate).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="w-24">
                <p className="text-[10px] text-text-disabled font-bold uppercase tracking-tighter leading-none">
                  Available
                </p>
                <p
                  className={`text-xs font-bold ${qty > 0 ? "text-success" : "text-text-disabled"}`}
                >
                  {qty}{" "}
                  <span className="text-[10px] font-medium text-text-disabled">
                    {item.uom}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {isExpanded && hasChildren && (
            <div className="bg-surface-base/30">
              {renderLevel(children, level + 1, item, parent)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Items from BOQ">
      <div className="p-4 space-y-4 flex flex-col h-[75vh]">
        <div className="flex justify-between items-center text-xs">
          <p className="text-text-muted">
            Pick specific items or sub-activities covering the work scope.
          </p>
          <div className="flex gap-3 font-bold uppercase tracking-widest text-[9px]">
            <span className="flex items-center gap-1">
              <Layers size={10} className="text-primary" /> Main
            </span>
            <span className="flex items-center gap-1">
              <Box size={10} className="text-orange-500" /> Sub
            </span>
            <span className="flex items-center gap-1">
              <Ruler size={10} className="text-emerald-500" /> Measure
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center gap-2">
            <Loader2 className="animate-spin text-primary" />
            <span className="text-xs text-text-disabled font-bold animate-pulse">
              Fetching Hierarchy...
            </span>
          </div>
        ) : boqItems.length === 0 ? (
          <div className="flex-1 flex justify-center items-center text-text-disabled">
            No unallocated BOQ items found.
          </div>
        ) : (
          <div className="flex-1 overflow-auto border rounded-xl bg-surface-card shadow-inner">
            <div className="sticky top-0 bg-slate-100/80 backdrop-blur-sm z-10 flex px-4 py-2 border-b text-[10px] font-black text-text-muted uppercase tracking-widest">
              <span className="flex-1">Description / Hierarchy</span>
              <span className="w-48 text-right">Qty & Rate Balance</span>
            </div>
            {renderLevel(boqItems, 0)}
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t">
          <div>
            <p className="text-xs font-black text-primary uppercase tracking-widest">
              {selectedItems.size} Selected
            </p>
            <p className="text-[9px] text-text-disabled">
              Parents are auto-mapped when children are picked.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-text-muted hover:text-slate-800 font-bold text-xs uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedItems.size === 0}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
            >
              <Plus size={16} /> Import Selection
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default BoqSelectModal;
