import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import api from "../../api/axios";
import { toast } from "react-hot-toast";
import { Loader2, Save } from "lucide-react";
import type { WorkOrder } from "../../types/workdoc";
import BoqSelectModal from "./BoqSelectModal";
import BoqAllocationReviewModal, {
  type BoqSelectionReviewItem,
} from "./BoqAllocationReviewModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder | null;
  onSuccess: () => void;
}

const isEditableWoLine = (item: any) => !item.isParent;

const WorkOrderEditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  workOrder,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [header, setHeader] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  const [showBoqSelector, setShowBoqSelector] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingSelections, setPendingSelections] = useState<
    BoqSelectionReviewItem[]
  >([]);

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
      setItems((workOrder.items || []).filter(isEditableWoLine));
    }
  }, [workOrder]);

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

  const handleSelectBoqItems = (selectedItems: any[]) => {
    const reviewedSelections: BoqSelectionReviewItem[] = selectedItems.map(
      (item) => ({
        boqItemId: item.boqItemId,
        boqSubItemId: item.boqSubItemId,
        measurementElementId: item.measurementElementId,
        boqCode: item.boqCode,
        description: item.description || item.elementName,
        fullDescription:
          item.level === 2 && item.parentInfo && item.grandParentInfo
            ? `${item.grandParentInfo.boqCode} > ${item.parentInfo.description} > ${item.elementName}`
            : item.level === 1 && item.parentInfo
              ? `${item.parentInfo.boqCode} > ${item.description}`
              : item.description,
        uom: item.uom || "NOS",
        availableQty: Number(item.availableQty || 0),
        boqRate: Number(item.boqRate || 0),
      }),
    );
    setPendingSelections(reviewedSelections);
    setShowReviewModal(true);
  };

  const handleAddReviewedItems = (reviewedItems: BoqSelectionReviewItem[]) => {
    const newItems = reviewedItems.map((item, index) => ({
      id: 0,
      description: item.fullDescription || item.description,
      materialCode: item.boqCode || "",
      uom: item.uom,
      allocatedQty: Number(item.availableQty || 0),
      rate: Number(item.boqRate || 0),
      amount: Number(item.availableQty || 0) * Number(item.boqRate || 0),
      boqItemId: item.boqItemId,
      boqSubItemId: item.boqSubItemId || null,
      measurementElementId: item.measurementElementId || null,
      issueScopeMode: item.issueScopeMode || "FULL_SCOPE",
      issuedScopeSummary: item.issuedScopeSummary || "Full BOQ scope",
      pendingScopeSummary: item.pendingScopeSummary || null,
      creepScopeSummary: item.creepScopeSummary || null,
      scopeCreepReason: item.scopeCreepReason || null,
      issuedScopeComponents: item.issuedScopeComponents || [],
      pendingScopeComponents: item.pendingScopeComponents || [],
      creepScopeComponents: item.creepScopeComponents || [],
      hasPendingScope: item.issueScopeMode !== "FULL_SCOPE",
      isNew: true,
      clientTempId: `${item.boqItemId}-${item.boqSubItemId || "sub"}-${item.measurementElementId || "meas"}-${index}`,
    }));

    setItems((prev) => [...prev, ...newItems]);
    setShowReviewModal(false);
    setShowBoqSelector(false);
  };

  const totalLeafAmount = items.reduce(
    (acc, item) => acc + Number(item.allocatedQty || 0) * Number(item.rate || 0),
    0,
  );

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
            issueScopeMode: i.issueScopeMode || "FULL_SCOPE",
            issuedScopeSummary: i.issuedScopeSummary || "Full BOQ scope",
            pendingScopeSummary: i.pendingScopeSummary || null,
            creepScopeSummary: i.creepScopeSummary || null,
            scopeCreepReason: i.scopeCreepReason || null,
            issuedScopeComponents: i.issuedScopeComponents || [],
            pendingScopeComponents: i.pendingScopeComponents || [],
            creepScopeComponents: i.creepScopeComponents || [],
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
                onClick={() => setShowBoqSelector(true)}
                className="px-4 py-2 bg-primary text-white text-[10px] font-black rounded-lg hover:bg-primary-dark shadow-lg shadow-blue-100"
              >
                ADD FROM BOQ
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                <tr className="bg-surface-base text-[10px] font-black uppercase text-text-disabled tracking-wider">
                  <th className="px-4 py-3 border-b">Code</th>
                  <th className="px-4 py-3 border-b">Description</th>
                  <th className="px-4 py-3 border-b text-right">Qty</th>
                  <th className="px-4 py-3 border-b">UOM</th>
                  <th className="px-4 py-3 border-b">Scope</th>
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
                      <div className="space-y-1">
                        <select
                          className="w-full rounded border border-border-default bg-surface-base px-2 py-1 text-[11px] font-bold"
                          value={item.issueScopeMode || "FULL_SCOPE"}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === idx
                                  ? {
                                      ...row,
                                      issueScopeMode: e.target.value,
                                      hasPendingScope:
                                        e.target.value !== "FULL_SCOPE",
                                      issuedScopeSummary:
                                        e.target.value === "FULL_SCOPE"
                                          ? "Full BOQ scope"
                                          : row.issuedScopeSummary,
                                    }
                                  : row,
                              ),
                            )
                          }
                        >
                          <option value="FULL_SCOPE">Full Scope</option>
                          <option value="SPLIT_SCOPE">Split Scope</option>
                          <option value="CREEP_SCOPE">Scope Creep</option>
                        </select>
                        {item.issueScopeMode && item.issueScopeMode !== "FULL_SCOPE" && (
                          <>
                            <input
                              type="text"
                              value={
                                item.issueScopeMode === "SPLIT_SCOPE"
                                  ? item.pendingScopeSummary || ""
                                  : item.creepScopeSummary || ""
                              }
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((row, rowIndex) =>
                                    rowIndex === idx
                                      ? item.issueScopeMode === "SPLIT_SCOPE"
                                        ? {
                                            ...row,
                                            pendingScopeSummary: e.target.value,
                                          }
                                        : {
                                            ...row,
                                            creepScopeSummary: e.target.value,
                                          }
                                      : row,
                                  ),
                                )
                              }
                              placeholder={
                                item.issueScopeMode === "SPLIT_SCOPE"
                                  ? "Pending scope summary"
                                  : "Creep scope summary"
                              }
                              className="w-full rounded border border-border-default bg-surface-base px-2 py-1 text-[11px]"
                            />
                            {item.issueScopeMode === "CREEP_SCOPE" && (
                              <input
                                type="text"
                                value={item.scopeCreepReason || ""}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev.map((row, rowIndex) =>
                                      rowIndex === idx
                                        ? {
                                            ...row,
                                            scopeCreepReason: e.target.value,
                                          }
                                        : row,
                                    ),
                                  )
                                }
                                placeholder="Reason for creep"
                                className="w-full rounded border border-border-default bg-surface-base px-2 py-1 text-[11px]"
                              />
                            )}
                          </>
                        )}
                      </div>
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
                      ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
              {totalLeafAmount.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
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

      {workOrder && (
        <>
          <BoqSelectModal
            isOpen={showBoqSelector}
            onClose={() => setShowBoqSelector(false)}
            projectId={workOrder.projectId}
            onSelectItems={handleSelectBoqItems}
          />
          <BoqAllocationReviewModal
            isOpen={showReviewModal}
            onClose={() => setShowReviewModal(false)}
            selections={pendingSelections}
            onConfirm={handleAddReviewedItems}
          />
        </>
      )}
    </Modal>
  );
};

export default WorkOrderEditModal;
