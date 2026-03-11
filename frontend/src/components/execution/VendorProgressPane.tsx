import React, { useState, useEffect } from "react";
import {
  Save,
  User,
  Store,
  Box,
  List,
  AlertCircle,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { executionService } from "../../services/execution.service";
import type {
  VendorSummaryItem,
  VendorBreakdownItem,
} from "../../services/execution.service";
import api from "../../api/axios";
import { formatIndianNumber } from "../../utils/format";

interface VendorProgressPaneProps {
  activity: any;
  epsNodeId: number;
  projectId: number;
  onProgressSaved: () => void;
}

export const VendorProgressPane: React.FC<VendorProgressPaneProps> = ({
  activity,
  epsNodeId,
  projectId,
  onProgressSaved,
}) => {
  const [paneView, setPaneView] = useState<"vendors" | "breakdown">("vendors");
  const [vendors, setVendors] = useState<VendorSummaryItem[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedVendor, setSelectedVendor] =
    useState<VendorSummaryItem | null>(null);

  const [vendorBreakdown, setVendorBreakdown] =
    useState<VendorBreakdownItem | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  // Progress State
  const [progressInputs, setProgressInputs] = useState<Record<string, number>>(
    {},
  );
  const [progressDate, setProgressDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activity?.id) {
      fetchVendors();
      setPaneView("vendors");
      setSelectedVendor(null);
      setVendorBreakdown(null);
    }
  }, [activity?.id, epsNodeId]);

  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const res = await executionService.getVendorSummary(activity.id);
      setVendors(res.vendors || []);
    } catch (err) {
      console.error("Failed to fetch vendors:", err);
    } finally {
      setLoadingVendors(false);
    }
  };

  const handleVendorClick = async (vendor: VendorSummaryItem) => {
    setSelectedVendor(vendor);
    setPaneView("breakdown");
    setLoadingBreakdown(true);
    setProgressInputs({});
    setRemarks("");

    try {
      const res = await executionService.getBreakdown(activity.id, epsNodeId);
      const vendorData = res.vendorBreakdown?.find(
        (v) => v.vendorId === vendor.vendorId,
      );
      setVendorBreakdown(vendorData || null);
    } catch (err) {
      console.error("Failed to fetch breakdown:", err);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleInputChange = (key: string, value: string, maxQty: number) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      const newInputs = { ...progressInputs };
      delete newInputs[key];
      setProgressInputs(newInputs);
    } else {
      setProgressInputs((prev) => ({
        ...prev,
        [key]: Math.min(Math.max(0, num), maxQty), // Ensure >= 0 and <= maxQty
      }));
    }
  };

  const handleSave = async () => {
    if (Object.keys(progressInputs).length === 0) return;

    setSaving(true);
    try {
      const entries = Object.entries(progressInputs)
        .filter(([_, qty]) => qty > 0)
        .map(([key, qty]) => {
          const [bIdx, type, id] = key.split("-");
          const boqEntry = vendorBreakdown!.boqBreakdown[parseInt(bIdx)];
          return {
            vendorId: selectedVendor?.vendorId || null,
            boqItemId: boqEntry.boqItem.id,
            workOrderItemId: boqEntry.workOrderItemId,
            microActivityId: type === "MICRO" ? parseInt(id) : null,
            quantity: qty,
          };
        });

      if (entries.length > 0) {
        await api.post("/execution/progress/micro", {
          projectId,
          activityId: activity.id,
          epsNodeId,
          entries,
          date: progressDate,
          remarks,
        });
        onProgressSaved();
        // Go back to vendors list on success
        setPaneView("vendors");
      }
    } catch (err) {
      console.error("Failed to save progress:", err);
      alert("Failed to save progress. Please check server logs.");
    } finally {
      setSaving(false);
    }
  };

  if (!activity) {
    return (
      <div className="p-4 bg-primary-muted border border-blue-200 rounded-md text-blue-700">
        Please select an activity to record progress.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          {activity.activityName}
        </h2>
        <p className="text-sm text-text-muted">Code: {activity.activityCode}</p>
      </div>

      {paneView === "vendors" && (
        <div
          className={`${loadingVendors ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="flex items-center mb-4 text-text-secondary font-semibold">
            <Store className="w-5 h-5 mr-2" />
            <span>Vendors Assigned to this Activity</span>
            {loadingVendors && (
              <Loader2 className="w-4 h-4 ml-2 animate-spin text-primary" />
            )}
          </div>

          {vendors.length === 0 && !loadingVendors ? (
            <div className="flex items-start p-4 bg-warning-muted border border-amber-200 rounded-md text-amber-800">
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-bold">No Vendors Linked</p>
                <p className="text-sm mt-1">
                  There are no work orders linked to this activity in the
                  current location. Please ensure Work Order items are
                  distributed to this activity.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {vendors.map((vendor, idx) => (
                <div
                  key={idx}
                  onClick={() => handleVendorClick(vendor)}
                  className="bg-surface-card p-4 rounded-lg border border-border-default border-l-4 border-l-blue-600 shadow-sm hover:shadow-md cursor-pointer transition-shadow group"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-bold text-gray-800 flex items-center">
                        <User className="w-4 h-4 mr-2 text-text-disabled" />
                        {vendor.vendorName}
                      </h3>
                      <div className="flex gap-4 mt-2">
                        {vendor.workOrderNumber && (
                          <span className="text-xs text-text-muted flex items-center">
                            <List className="w-3 h-3 mr-1" /> WO:{" "}
                            <strong className="ml-1">
                              {vendor.workOrderNumber}
                            </strong>
                          </span>
                        )}
                        <span className="text-xs text-text-muted flex items-center">
                          <Box className="w-3 h-3 mr-1" /> BOQ Items:{" "}
                          {vendor.boqItemCount}
                        </span>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 text-xs font-semibold text-primary border border-primary rounded hover:bg-primary-muted transition-colors">
                      Record Progress
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {paneView === "breakdown" && vendorBreakdown && (
        <div
          className={`${loadingBreakdown ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="mb-4">
            <button
              onClick={() => setPaneView("vendors")}
              className="flex items-center text-primary hover:text-blue-800 text-sm font-medium transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Vendors
            </button>
          </div>

          <div className="bg-surface-card rounded-lg border border-border-default shadow-sm mb-4 overflow-hidden">
            <div className="bg-surface-base px-4 py-3 border-b border-border-default">
              <h3 className="text-base font-bold text-gray-800 flex items-center">
                <Store className="w-4 h-4 mr-2" />
                {selectedVendor?.vendorName}
              </h3>
              {selectedVendor?.workOrderNumber && (
                <p className="text-xs text-text-muted mt-1">
                  Work Order:{" "}
                  <span className="font-semibold text-text-secondary">
                    {selectedVendor.workOrderNumber}
                  </span>
                </p>
              )}
            </div>

            <div className="p-4">
              {vendorBreakdown.boqBreakdown.length === 0 ? (
                <p className="text-sm text-text-muted italic">
                  No measurements found for this vendor here.
                </p>
              ) : (
                vendorBreakdown.boqBreakdown.map((boqEntry, bIdx) => (
                  <div key={bIdx} className="mb-8 last:mb-0">
                    <div className="bg-surface-base p-3 rounded-md border border-border-subtle mb-2">
                      <p className="text-sm font-bold text-text-primary">
                        {boqEntry.boqItem.itemCode &&
                          `[${boqEntry.boqItem.itemCode}] `}
                        {boqEntry.boqItem.description}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-text-muted">
                        <span>
                          UOM:{" "}
                          <strong className="text-text-secondary">
                            {boqEntry.boqItem.uom}
                          </strong>
                        </span>
                        <span>
                          Scope:{" "}
                          <strong className="text-text-secondary">
                            {formatIndianNumber(boqEntry.scope.total)}
                          </strong>
                        </span>
                        <span>
                          Allocated:{" "}
                          <strong className="text-text-secondary">
                            {formatIndianNumber(boqEntry.scope.allocated)}
                          </strong>
                        </span>
                        <span>
                          Balance (Direct):{" "}
                          <strong className="text-text-secondary">
                            {formatIndianNumber(boqEntry.scope.balance)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-base text-text-muted uppercase tracking-tighter text-[10px]">
                          <tr>
                            <th className="px-3 py-2 font-bold">Task Name</th>
                            <th className="px-3 py-2 font-bold text-right">
                              Scope
                            </th>
                            <th className="px-3 py-2 font-bold text-right">
                              Done
                            </th>
                            <th className="px-3 py-2 font-bold text-right">
                              Balance
                            </th>
                            <th className="px-3 py-2 font-bold text-right w-24">
                              Today
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {boqEntry.items.map((record, rIdx) => (
                            <tr
                              key={
                                record.id
                                  ? `MICRO-${record.id}`
                                  : `BALANCE-${rIdx}`
                              }
                              className="hover:bg-surface-base"
                            >
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {record.type === "MICRO" ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-info-muted text-blue-700">
                                      MICRO
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">
                                      DIRECT
                                    </span>
                                  )}
                                  <span className="text-text-secondary">
                                    {record.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-text-secondary">
                                {formatIndianNumber(record.allocatedQty)}
                              </td>
                              <td className="px-3 py-2 text-right text-success font-medium">
                                {formatIndianNumber(record.executedQty)}
                              </td>
                              <td className="px-3 py-2 text-right text-text-primary font-semibold">
                                {formatIndianNumber(record.balanceQty)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={record.balanceQty}
                                  step="0.01"
                                  disabled={record.balanceQty <= 0}
                                  value={
                                    progressInputs[
                                      `${bIdx}-${record.type}-${record.id || 0}`
                                    ] || ""
                                  }
                                  onChange={(e) =>
                                    handleInputChange(
                                      `${bIdx}-${record.type}-${record.id || 0}`,
                                      e.target.value,
                                      record.balanceQty,
                                    )
                                  }
                                  placeholder={
                                    record.balanceQty <= 0 ? "Done" : "qty"
                                  }
                                  className="w-full px-2 py-1 text-right border border-border-default rounded focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-surface-base disabled:text-text-disabled"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-surface-card rounded-lg border border-border-default shadow-sm p-4">
            <h4 className="text-xs font-bold text-text-muted uppercase mb-3">
              Progress Remarks
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <input
                  type="date"
                  value={progressDate}
                  onChange={(e) => setProgressDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border-default rounded text-sm focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="md:col-span-3">
                <textarea
                  rows={2}
                  placeholder="Enter remarks (optional)..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-border-default rounded text-sm focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={Object.keys(progressInputs).length === 0 || saving}
                className="flex items-center px-6 py-2 bg-primary text-white rounded font-bold hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Progress
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
