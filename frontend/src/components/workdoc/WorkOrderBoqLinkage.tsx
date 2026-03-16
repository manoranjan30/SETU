import React, { useState, useEffect, useMemo } from "react";
import api from "../../api/axios";
import { Tree } from "../common/Tree";
import type { TreeNodeData } from "../common/Tree";
import { ShoppingCart, Unlink, Info, Loader2, Save } from "lucide-react";
import { toast } from "react-hot-toast";
import type { WorkOrder, WorkOrderItem } from "../../types/workdoc";

interface Props {
  workOrder: WorkOrder;
  onRefresh?: () => void;
}

const WorkOrderBoqLinkage: React.FC<Props> = ({ workOrder, onRefresh }) => {
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWoItem, setSelectedWoItem] = useState<WorkOrderItem | null>(
    null,
  );
  const [tempMappings, setTempMappings] = useState<
    Record<
      number,
      { boqItemId?: number; boqSubItemId?: number; factor: number }[]
    >
  >({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [workOrder.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/workdoc/${workOrder.id ? workOrder.projectId : 0}/linkage-data?woId=${workOrder.id}`,
      );
      setBoqItems(res.data.boqTree);

      // Initialize temp mappings
      const initial: Record<number, any[]> = {};
      res.data.mappings.forEach((m: any) => {
        if (!initial[m.workOrderItem.id]) initial[m.workOrderItem.id] = [];
        initial[m.workOrderItem.id].push({
          boqItemId: m.boqItem?.id,
          boqSubItemId: m.boqSubItem?.id,
          factor: Number(m.conversionFactor),
        });
      });
      setTempMappings(initial);
    } catch (e) {
      toast.error("Failed to load linkage data");
    } finally {
      setLoading(false);
    }
  };

  const treeData = useMemo(() => {
    const buildNode = (item: any): TreeNodeData => {
      return {
        id: `ITEM:${item.id}`,
        label: `${item.boqCode} - ${item.description}`,
        icon: <ShoppingCart size={14} className="text-primary" />,
        data: { type: "ITEM", id: item.id },
        children: item.subItems?.map((sub: any) => ({
          id: `SUB:${sub.id}`,
          label: sub.description,
          icon: <div className="w-2 h-2 rounded-full bg-orange-400" />,
          data: { type: "SUB", id: sub.id, parentId: item.id },
        })),
      };
    };
    return boqItems.map(buildNode);
  }, [boqItems]);

  const handleLink = (nodeIds: (string | number)[]) => {
    if (!selectedWoItem) {
      toast.error("Select a Work Order line item first");
      return;
    }

    const newMappings = [...(tempMappings[selectedWoItem.id] || [])];

    nodeIds.forEach((nodeId) => {
      const idStr = String(nodeId);
      const [type, id] = idStr.split(":");
      const numericId = parseInt(id);

      const exists =
        type === "ITEM"
          ? newMappings.some((m) => m.boqItemId === numericId)
          : newMappings.some((m) => m.boqSubItemId === numericId);

      if (!exists) {
        newMappings.push({
          boqItemId: type === "ITEM" ? numericId : undefined,
          boqSubItemId: type === "SUB" ? numericId : undefined,
          factor: 1,
        });
      }
    });

    setTempMappings((prev) => ({ ...prev, [selectedWoItem.id]: newMappings }));
  };

  const handleUnlink = (woItemId: number, index: number) => {
    const current = [...(tempMappings[woItemId] || [])];
    current.splice(index, 1);
    setTempMappings((prev) => ({ ...prev, [woItemId]: current }));
  };

  const handleFactorChange = (
    woItemId: number,
    index: number,
    factor: number,
  ) => {
    const current = [...(tempMappings[woItemId] || [])];
    current[index].factor = factor;
    setTempMappings((prev) => ({ ...prev, [woItemId]: current }));
  };

  const saveMapping = async (woItemId: number) => {
    setSaving(true);
    try {
      await api.post(
        `/workdoc/items/${woItemId}/map`,
        tempMappings[woItemId] || [],
      );
      toast.success("Mapping saved");
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error("Failed to save mapping");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  const woItems = workOrder.items.filter((i) => !i.isParent);

  return (
    <div className="flex h-full min-h-0 bg-surface-card shadow-inner rounded-xl overflow-hidden m-4 border border-border-default">
      {/* Left: WO Items */}
      <div className="w-1/2 border-r border-border-default flex flex-col bg-surface-base/30">
        <div className="p-4 border-b bg-surface-card flex justify-between items-center">
          <div>
            <h3 className="font-black text-slate-800 tracking-tight">
              Work Order Items
            </h3>
            <p className="text-[10px] text-text-disabled font-bold uppercase">
              Select a line to link with BOQ
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {woItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedWoItem(item)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedWoItem?.id === item.id
                  ? "border-primary bg-primary-muted shadow-lg shadow-blue-100"
                  : "border-slate-100 bg-surface-card hover:border-blue-200"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-text-disabled">
                  #{item.serialNumber}
                </span>
                <div className="flex gap-1">
                  {(tempMappings[item.id]?.length || 0) > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-success text-white text-[10px] font-black italic">
                      {tempMappings[item.id].length} Linked
                    </span>
                  )}
                </div>
              </div>
              <h4 className="text-sm font-bold text-slate-800 line-clamp-1">
                {item.description}
              </h4>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {item.allocatedQty} {item.uom} @ ₹{item.rate}
                </span>
                {selectedWoItem?.id === item.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      saveMapping(item.id);
                    }}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1 bg-primary text-white text-[10px] font-black rounded-lg hover:bg-primary-dark transition-colors shadow-lg shadow-blue-200"
                  >
                    {saving ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Save size={12} />
                    )}
                    SAVE LINK
                  </button>
                )}
              </div>

              {/* Linked Items List (if selected) */}
              {selectedWoItem?.id === item.id &&
                (tempMappings[item.id]?.length || 0) > 0 && (
                  <div className="mt-4 pt-3 border-t border-blue-100 space-y-2">
                    <p className="text-xs font-black text-blue-800 uppercase tracking-widest">
                      Mappings
                    </p>
                    {tempMappings[item.id].map((m, idx) => {
                      const boqItem = boqItems.find(
                        (bi) => bi.id === m.boqItemId,
                      );
                      const subItem = boqItem?.subItems?.find(
                        (si: any) => si.id === m.boqSubItemId,
                      );
                      return (
                        <div
                          key={idx}
                          className="bg-surface-card/50 p-2 rounded-xl border border-blue-100 flex items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-text-disabled italic truncate">
                              {boqItem?.boqCode}{" "}
                              {subItem
                                ? `> ${subItem.description}`
                                : boqItem?.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-slate-600 uppercase">
                                Factor:
                              </span>
                              <input
                                type="number"
                                className="w-16 text-[10px] border border-blue-200 rounded px-1 focus:ring-1 focus:ring-primary"
                                value={m.factor}
                                onChange={(e) =>
                                  handleFactorChange(
                                    item.id,
                                    idx,
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlink(item.id, idx);
                            }}
                            className="p-1.5 text-red-400 hover:text-error hover:bg-error-muted rounded-lg transition-colors"
                          >
                            <Unlink size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: BOQ Tree */}
      <div className="w-1/2 flex flex-col bg-surface-card">
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h3 className="font-black text-slate-800 tracking-tight">
              Available BOQ Items
            </h3>
            <p className="text-[10px] text-text-disabled font-bold uppercase">
              Check a node to link with selection
            </p>
          </div>
          <div className="flex gap-2">
            <div className="p-2 rounded-xl bg-surface-base text-text-disabled">
              <Info size={16} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <Tree
            data={treeData}
            selectedIds={[]} // Not used for link logic, we handle click
            onSelect={(ids) => handleLink(ids)}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkOrderBoqLinkage;
