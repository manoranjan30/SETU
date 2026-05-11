import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";

const SCOPE_COMPONENTS = [
  "Material",
  "Labour",
  "Machinery",
  "Tools & Tackles",
  "Consumables",
  "Transport",
  "Installation",
  "Testing",
];

export interface BoqSelectionReviewItem {
  boqItemId: number;
  boqSubItemId?: number | null;
  measurementElementId?: number | null;
  boqCode?: string;
  description: string;
  fullDescription?: string;
  uom: string;
  availableQty: number;
  boqRate: number;
  woRefText?: string;
  issueScopeMode?: "FULL_SCOPE" | "SPLIT_SCOPE" | "CREEP_SCOPE";
  issuedScopeSummary?: string;
  pendingScopeSummary?: string;
  creepScopeSummary?: string;
  scopeCreepReason?: string;
  issuedScopeComponents?: string[];
  pendingScopeComponents?: string[];
  creepScopeComponents?: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selections: BoqSelectionReviewItem[];
  onConfirm: (items: BoqSelectionReviewItem[]) => void;
}

const BoqAllocationReviewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selections,
  onConfirm,
}) => {
  const [items, setItems] = useState<BoqSelectionReviewItem[]>([]);

  useEffect(() => {
    setItems(
      selections.map((item) => ({
        ...item,
        availableQty: Number(item.availableQty || 0),
        boqRate: Number(item.boqRate || 0),
        issueScopeMode: item.issueScopeMode || "FULL_SCOPE",
        issuedScopeSummary: item.issuedScopeSummary || "Full BOQ scope",
        pendingScopeSummary: item.pendingScopeSummary || "",
        creepScopeSummary: item.creepScopeSummary || "",
        scopeCreepReason: item.scopeCreepReason || "",
        issuedScopeComponents: item.issuedScopeComponents || [],
        pendingScopeComponents: item.pendingScopeComponents || [],
        creepScopeComponents: item.creepScopeComponents || [],
      })),
    );
  }, [selections]);

  const updateItem = (
    index: number,
    patch: Partial<BoqSelectionReviewItem>,
  ) => {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const toggleComponent = (
    index: number,
    key:
      | "issuedScopeComponents"
      | "pendingScopeComponents"
      | "creepScopeComponents",
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const current = new Set(item[key] || []);
        if (current.has(value)) current.delete(value);
        else current.add(value);
        return { ...item, [key]: Array.from(current) };
      }),
    );
  };

  const totalAmount = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.availableQty || 0) * Number(item.boqRate || 0),
        0,
      ),
    [items],
  );

  const handleConfirm = () => {
    for (const item of items) {
      if (Number(item.availableQty || 0) <= 0) {
        toast.error(`WO qty must be greater than zero for "${item.description}"`);
        return;
      }
      if (item.issueScopeMode === "SPLIT_SCOPE") {
        if (
          !item.pendingScopeSummary?.trim() &&
          !(item.pendingScopeComponents || []).length
        ) {
          toast.error(`Add the balance scope pending for "${item.description}"`);
          return;
        }
      }
      if (item.issueScopeMode === "CREEP_SCOPE") {
        if (
          !item.scopeCreepReason?.trim() &&
          !item.creepScopeSummary?.trim() &&
          !(item.creepScopeComponents || []).length
        ) {
          toast.error(`Add creep reason or creep scope for "${item.description}"`);
          return;
        }
      }
    }
    onConfirm(items);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review BOQ Allocation Before Adding to WO"
      size="fullscreen"
      contentClassName="p-0 overflow-hidden"
    >
      <div className="flex h-full min-h-0 flex-col bg-surface-base">
        <div className="border-b border-border-default bg-surface-card px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-slate-900">
                Default behavior is `Full Scope`
              </p>
              <p className="text-xs text-text-muted">
                Only mark `Split Scope` or `Scope Creep` when the BOQ scope is not being issued exactly as-is in this work order.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-primary-muted px-4 py-2 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                Review Total
              </p>
              <p className="text-lg font-black text-slate-900">
                Rs. {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={`${item.boqItemId}-${item.boqSubItemId || "sub"}-${item.measurementElementId || "meas"}-${index}`}
                className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                        {item.boqCode || "BOQ"}
                      </span>
                      {item.issueScopeMode === "FULL_SCOPE" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-1 text-[10px] font-black uppercase tracking-wider text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Full Scope
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-orange-700">
                          <AlertTriangle className="h-3 w-3" />
                          {item.issueScopeMode === "SPLIT_SCOPE"
                            ? "Split Scope"
                            : "Scope Creep"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-black text-slate-900">
                      {item.fullDescription || item.description}
                    </p>
                    <p className="text-xs text-text-muted">
                      Available BOQ Qty: {Number(item.availableQty).toFixed(3)} {item.uom} | Default Rate: Rs. {Number(item.boqRate).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-text-muted">
                      WO Qty
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={item.availableQty}
                      onChange={(e) =>
                        updateItem(index, {
                          availableQty: Number(e.target.value || 0),
                        })
                      }
                      className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm font-bold"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-text-muted">
                      WO Rate
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.boqRate}
                      onChange={(e) =>
                        updateItem(index, {
                          boqRate: Number(e.target.value || 0),
                        })
                      }
                      className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm font-bold"
                    />
                  </label>
                  <label className="block lg:col-span-2">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-text-muted">
                      Scope Handling
                    </span>
                    <select
                      value={item.issueScopeMode}
                      onChange={(e) =>
                        updateItem(index, {
                          issueScopeMode: e.target.value as BoqSelectionReviewItem["issueScopeMode"],
                          issuedScopeSummary:
                            e.target.value === "FULL_SCOPE"
                              ? "Full BOQ scope"
                              : item.issuedScopeSummary,
                        })
                      }
                      className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm font-bold"
                    >
                      <option value="FULL_SCOPE">Full Scope</option>
                      <option value="SPLIT_SCOPE">Split Scope</option>
                      <option value="CREEP_SCOPE">Scope Creep</option>
                    </select>
                  </label>
                </div>

                {item.issueScopeMode !== "FULL_SCOPE" && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border-default bg-surface-base p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                        Issued In This WO
                      </p>
                      <textarea
                        rows={3}
                        value={item.issuedScopeSummary || ""}
                        onChange={(e) =>
                          updateItem(index, {
                            issuedScopeSummary: e.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-border-default bg-white px-3 py-2 text-sm"
                        placeholder="Example: Labour only"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SCOPE_COMPONENTS.map((component) => (
                          <button
                            key={component}
                            type="button"
                            onClick={() =>
                              toggleComponent(index, "issuedScopeComponents", component)
                            }
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                              item.issuedScopeComponents?.includes(component)
                                ? "bg-primary text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {component}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border-default bg-surface-base p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                        {item.issueScopeMode === "SPLIT_SCOPE"
                          ? "Balance Scope Pending"
                          : "Creep Scope"}
                      </p>
                      <textarea
                        rows={3}
                        value={
                          item.issueScopeMode === "SPLIT_SCOPE"
                            ? item.pendingScopeSummary || ""
                            : item.creepScopeSummary || ""
                        }
                        onChange={(e) =>
                          updateItem(
                            index,
                            item.issueScopeMode === "SPLIT_SCOPE"
                              ? { pendingScopeSummary: e.target.value }
                              : { creepScopeSummary: e.target.value },
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-border-default bg-white px-3 py-2 text-sm"
                        placeholder={
                          item.issueScopeMode === "SPLIT_SCOPE"
                            ? "Example: Material and consumables pending for another vendor"
                            : "Describe the additional scope beyond BOQ"
                        }
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SCOPE_COMPONENTS.map((component) => (
                          <button
                            key={component}
                            type="button"
                            onClick={() =>
                              toggleComponent(
                                index,
                                item.issueScopeMode === "SPLIT_SCOPE"
                                  ? "pendingScopeComponents"
                                  : "creepScopeComponents",
                                component,
                              )
                            }
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                              (
                                item.issueScopeMode === "SPLIT_SCOPE"
                                  ? item.pendingScopeComponents
                                  : item.creepScopeComponents
                              )?.includes(component)
                                ? "bg-orange-500 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {component}
                          </button>
                        ))}
                      </div>
                      {item.issueScopeMode === "CREEP_SCOPE" && (
                        <input
                          type="text"
                          value={item.scopeCreepReason || ""}
                          onChange={(e) =>
                            updateItem(index, {
                              scopeCreepReason: e.target.value,
                            })
                          }
                          className="mt-3 w-full rounded-xl border border-border-default bg-white px-3 py-2 text-sm"
                          placeholder="Reason for creep scope"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border-default bg-surface-card px-5 py-4">
          <p className="text-xs text-text-muted">
            Full scope is assumed by default. Only exceptions need extra details.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-bold text-text-muted hover:text-slate-800"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-black text-white shadow-lg"
            >
              Add Reviewed Items
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default BoqAllocationReviewModal;
