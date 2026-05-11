import React, { useState, useEffect, useCallback } from "react";
import {
  WorkDocService,
  type PendingBoardItem,
} from "../../services/work-doc.service";
import { Loader2, Link as LinkIcon, Search, Wand2 } from "lucide-react";
import { toast } from "react-hot-toast";

interface Props {
  projectId: number;
}

const PendingVendorBoard: React.FC<Props> = ({ projectId }) => {
  const [items, setItems] = useState<PendingBoardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "ALL" | "QTY_PENDING" | "SCOPE_PENDING" | "CREEP_PENDING"
  >("ALL");

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await WorkDocService.getPendingVendorBoard(projectId);
      setItems(data);
    } catch {
      toast.error("Failed to load pending items");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((i) => String(i.id))));
    }
  };

  const handleAutoMap = async () => {
    const selected = items.filter((i) => selectedItems.has(String(i.id)));
    const workOrderIds = Array.from(
      new Set(selected.map((i) => i.workOrderId).filter(Boolean) as number[]),
    );
    if (workOrderIds.length === 0) {
      toast("No linked work orders available for auto-map in this selection.");
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        workOrderIds.map((id) => WorkDocService.autoMapWorkOrder(id)),
      );
      toast.success("Auto-mapping completed");
      loadItems();
      setSelectedItems(new Set());
    } catch {
      toast.error("Some items failed to map");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      (item.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.workOrderRef || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.vendorName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.pendingScopeSummary || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (item.creepScopeSummary || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesTab =
      activeTab === "ALL" ? true : item.pendingType === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="h-full flex flex-col rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Pending Vendor On Board
          </h2>
          <p className="text-sm text-text-muted">
            Track quantity gaps, split-scope balance scope, and creep scope still pending commercial coverage.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              placeholder="Search description, vendor, scope..."
              className="rounded-lg border px-4 py-2 pl-9 text-sm focus:outline-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={handleAutoMap}
            disabled={selectedItems.size === 0 || loading}
            className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-secondary-dark disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Auto-Map Selected ({selectedItems.size})
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: "ALL", label: "All Pending" },
          { id: "QTY_PENDING", label: "Qty Pending" },
          { id: "SCOPE_PENDING", label: "Scope Pending" },
          { id: "CREEP_PENDING", label: "Creep Pending" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() =>
              setActiveTab(
                tab.id as "ALL" | "QTY_PENDING" | "SCOPE_PENDING" | "CREEP_PENDING",
              )
            }
            className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${
              activeTab === tab.id
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto rounded-lg border">
        <table className="relative w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b bg-surface-base font-medium text-slate-600">
            <tr>
              <th className="w-8 px-4 py-3">
                <input
                  type="checkbox"
                  checked={
                    filteredItems.length > 0 &&
                    selectedItems.size === filteredItems.length
                  }
                  onChange={handleSelectAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3">Vendor / WO</th>
              <th className="px-4 py-3">Item Description</th>
              <th className="px-4 py-3">Pending Type</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Scope Coverage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                  Loading items...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                  No pending items found.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={String(item.id)}
                  className="transition-colors hover:bg-surface-base"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(String(item.id))}
                      onChange={() => handleSelect(String(item.id))}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">
                      {item.vendorName}
                    </div>
                    <div className="text-xs text-text-muted">
                      {item.workOrderRef}
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <div
                      className="truncate font-medium text-text-secondary"
                      title={item.description}
                    >
                      {item.description}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-text-disabled">
                      {item.materialCode}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {item.pendingType.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    Rs. {item.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    <div className="space-y-1 text-xs">
                      {item.issuedScopeSummary && (
                        <div className="text-slate-700">
                          <span className="font-bold">Issued:</span>{" "}
                          {item.issuedScopeSummary}
                        </div>
                      )}
                      {item.pendingScopeSummary && (
                        <div className="text-orange-700">
                          <span className="font-bold">Pending:</span>{" "}
                          {item.pendingScopeSummary}
                        </div>
                      )}
                      {item.creepScopeSummary && (
                        <div className="text-red-700">
                          <span className="font-bold">Creep:</span>{" "}
                          {item.creepScopeSummary}
                        </div>
                      )}
                      {item.scopeCreepReason && (
                        <div className="text-text-muted">
                          <span className="font-bold">Reason:</span>{" "}
                          {item.scopeCreepReason}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                        item.mappingStatus === "PENDING"
                          ? "border border-amber-200 bg-warning-muted text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.mappingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary-muted hover:text-blue-800">
                      <LinkIcon className="h-3 w-3" /> Review
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PendingVendorBoard;
