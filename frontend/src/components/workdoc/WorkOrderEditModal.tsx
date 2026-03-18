import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import api from "../../api/axios";
import { toast } from "react-hot-toast";
import { Loader2, Save } from "lucide-react";
import type { WorkOrder } from "../../types/workdoc";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder | null;
  onSuccess: () => void;
}

const WorkOrderEditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  workOrder,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [header, setHeader] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  const [boqTree, setBoqTree] = useState<any[]>([]);
  const [showBoqSelector, setShowBoqSelector] = useState(false);

  useEffect(() => {
    if (workOrder) {
      setHeader({
        woNumber: workOrder.woNumber || "",
        woDate: workOrder.woDate ? workOrder.woDate.split("T")[0] : "",
        orderType: workOrder.orderType || "",
        orderAmendNo: workOrder.orderAmendNo || "",
        projectCode: workOrder.projectCode || "",
        scopeOfWork: workOrder.scopeOfWork || "",
      });
      setItems(workOrder.items || []);
      loadBoqTree();
    }
  }, [workOrder]);

  const loadBoqTree = async () => {
    if (!workOrder) return;
    try {
      const res = await api.get(
        `/workdoc/${workOrder.projectId}/boq-tree-for-wo`,
      );
      setBoqTree(res.data);
    } catch (e) {
      console.error("Failed to load BOQ tree", e);
    }
  };

  const handleItemChange = (itemId: number, field: string, value: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
              amount:
                field === "rate"
                  ? value * item.allocatedQty
                  : field === "allocatedQty"
                    ? value * item.rate
                    : item.amount,
            }
          : item,
      ),
    );
  };

  const handleAddBoqItem = (boqItem: any, subItem?: any) => {
    const newItem = {
      id: 0,
      description: subItem ? subItem.description : boqItem.description,
      materialCode: boqItem.boqCode,
      uom: subItem ? subItem.uom : boqItem.uom,
      allocatedQty: 0,
      rate: boqItem.rate || 0,
      boqItemId: boqItem.id,
      boqSubItemId: subItem?.id || null,
      isNew: true,
    };
    setItems([...items, newItem]);
    setShowBoqSelector(false);
  };

  const handleSave = async () => {
    if (!workOrder) return;
    setLoading(true);
    try {
      // 1. If we have new items, add them first
      const newItems = items.filter((i) => i.isNew);
      if (newItems.length > 0) {
        await api.post(`/workdoc/work-orders/${workOrder.id}/add-boq-items`, {
          items: newItems,
        });
      }

      // 2. Update existing items and header
      const payload = {
        ...header,
        items: items
          .filter((i) => !i.isNew)
          .map((i) => ({
            id: i.id,
            allocatedQty: i.allocatedQty,
            rate: i.rate,
            description: i.description,
            uom: i.uom,
          })),
      };

      await api.post(`/workdoc/work-orders/${workOrder.id}/update`, payload);

      toast.success("Work Order amended successfully!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to update Work Order",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!workOrder) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Amend Work Order"
      size="fullscreen"
      headerClassName="px-4 py-3 md:px-5 md:py-3"
      titleClassName="text-lg md:text-xl"
      contentClassName="p-0 overflow-hidden"
    >
      <div className="flex flex-col h-full min-h-0 bg-surface-base">
        <div className="flex-1 overflow-auto p-3 md:p-4 space-y-4">
          {/* Header Section */}
          <div className="bg-surface-card p-4 rounded-2xl border border-border-default shadow-sm space-y-3">
            <h3 className="text-sm font-black text-text-disabled uppercase tracking-widest">
              Order Header
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-5">
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase mb-1">
                  WO Number
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-sm font-bold"
                  value={header.woNumber}
                  onChange={(e) =>
                    setHeader({ ...header, woNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase mb-1">
                  WO Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-sm font-bold"
                  value={header.woDate}
                  onChange={(e) =>
                    setHeader({ ...header, woDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase mb-1">
                  Amend No
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-sm font-bold"
                  placeholder="e.g. AM01"
                  value={header.orderAmendNo}
                  onChange={(e) =>
                    setHeader({ ...header, orderAmendNo: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase mb-1">
                  Project Code
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-sm font-bold"
                  value={header.projectCode}
                  onChange={(e) =>
                    setHeader({ ...header, projectCode: e.target.value })
                  }
                />
              </div>
              <div className="col-span-4">
                <label className="block text-[10px] font-black text-text-muted uppercase mb-1">
                  Scope of Work
                </label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-sm resize-none"
                  value={header.scopeOfWork}
                  onChange={(e) =>
                    setHeader({ ...header, scopeOfWork: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-surface-card rounded-2xl border border-border-default shadow-sm overflow-hidden flex flex-col min-h-[52vh]">
            <div className="p-3 md:p-4 bg-surface-base border-b flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Line Item Details
              </h3>
              <button
                onClick={() => setShowBoqSelector(!showBoqSelector)}
                className="px-4 py-2 bg-primary text-white text-[10px] font-black rounded-lg hover:bg-primary-dark shadow-lg shadow-blue-100"
              >
                ADD FROM BOQ
              </button>
            </div>

            {showBoqSelector && (
              <div className="p-3 md:p-4 bg-primary-muted border-b border-blue-100 max-h-60 overflow-auto">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-black text-blue-800 uppercase">
                    Select BOQ Item to Add
                  </p>
                  <button
                    onClick={() => setShowBoqSelector(false)}
                    className="text-[10px] text-text-disabled hover:text-error"
                  >
                    CLOSE
                  </button>
                </div>
                <div className="space-y-2">
                  {boqTree.map((bi) => (
                    <div key={bi.id} className="space-y-1">
                      <div
                        onClick={() => handleAddBoqItem(bi)}
                        className="p-2 bg-surface-card rounded-lg border border-blue-200 hover:bg-info-muted cursor-pointer text-xs font-bold flex justify-between"
                      >
                        <span>
                          {bi.boqCode} - {bi.description}
                        </span>
                        <span className="text-[10px] text-primary">
                          Add Main Item
                        </span>
                      </div>
                      {(bi.subItems || []).map((si: any) => (
                        <div
                          key={si.id}
                          onClick={() => handleAddBoqItem(bi, si)}
                          className="ml-6 p-2 bg-surface-card/50 rounded-lg border border-border-default hover:bg-info-muted cursor-pointer text-xs flex justify-between"
                        >
                          <span>{si.description}</span>
                          <span className="text-[10px] text-text-disabled">
                            Add Sub-Item
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                <tr className="bg-surface-base text-[10px] font-black uppercase text-text-disabled tracking-wider">
                  <th className="px-4 py-3 border-b">Code</th>
                  <th className="px-4 py-3 border-b">Description</th>
                  <th className="px-4 py-3 border-b text-right">Qty</th>
                  <th className="px-4 py-3 border-b">UOM</th>
                  <th className="px-4 py-3 border-b text-right">Rate</th>
                  <th className="px-4 py-3 border-b text-right">Amount</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr
                    key={item.id || `new-${idx}`}
                    className={item.isNew ? "bg-primary-muted/50" : ""}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-text-muted truncate max-w-[100px]">
                      {item.materialCode}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-800">
                      {item.description}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        className="w-24 px-2 py-1 text-right text-xs border border-border-default rounded focus:ring-1 focus:ring-primary font-black"
                        value={item.allocatedQty}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "allocatedQty",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-[10px] font-bold text-text-disabled uppercase">
                      {item.uom}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        className="w-24 px-2 py-1 text-right text-xs border border-border-default rounded focus:ring-1 focus:ring-primary font-medium"
                        value={item.rate}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "rate",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-black text-slate-900">
                      ₹
                      {Number(
                        item.amount || item.allocatedQty * item.rate,
                      ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="p-3 md:p-4 bg-surface-card border-t flex justify-between items-center shadow-2xl">
          <div>
            <p className="text-[10px] font-black text-text-disabled uppercase leading-none">
              Total Work Order Value
            </p>
            <p className="text-xl font-black text-slate-900">
              ₹
              {items
                .reduce((acc, i) => acc + i.allocatedQty * i.rate, 0)
                .toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-bold text-text-muted hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-3 md:px-8 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xl active:scale-95 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              CONFIRM AMENDMENT
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default WorkOrderEditModal;
