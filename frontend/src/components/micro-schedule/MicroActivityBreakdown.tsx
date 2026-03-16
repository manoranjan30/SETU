import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Calendar,
  MapPin,
  Save,
  X,
  History,
  ChevronRight,
} from "lucide-react";
import microScheduleService, {
  type MicroSchedule,
  type MicroScheduleActivity,
  MicroActivityStatus,
  type MicroQuantityLedger,
  type CreateMicroActivityDto,
} from "../../services/micro-schedule.service";
import { planningService } from "../../services/planning.service";

import DailyLogEntry from "./DailyLogEntry";

interface MicroActivityBreakdownProps {
  scheduleId: number;
  projectId: number;
}

const MicroActivityBreakdown: React.FC<MicroActivityBreakdownProps> = ({
  scheduleId,
}) => {
  const [schedule, setSchedule] = useState<MicroSchedule | null>(null);
  const [activities, setActivities] = useState<MicroScheduleActivity[]>([]);

  const [ledgers, setLedgers] = useState<MicroQuantityLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [linkedEpsNode, setLinkedEpsNode] = useState<any>(null);
  const [linkedEpsPath, setLinkedEpsPath] = useState<any[]>([]);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] =
    useState<MicroScheduleActivity | null>(null);
  const [formData, setFormData] = useState<Partial<CreateMicroActivityDto>>({
    microScheduleId: scheduleId,
    parentActivityId: 0,
    name: "",
    description: "",
    epsNodeId: undefined,
    boqItemId: undefined,
    workOrderItemId: undefined,
    workOrderId: undefined,
    vendorId: undefined,
    allocatedQty: 0,
    uom: "",
    plannedStart: "",
    plannedFinish: "",
    status: MicroActivityStatus.PLANNED,
  });

  // Modal state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedActivityForLog, setSelectedActivityForLog] =
    useState<MicroScheduleActivity | null>(null);

  useEffect(() => {
    loadData();
  }, [scheduleId]);

  // Helper to find node and build path
  const findNodePath = (
    nodes: any[],
    targetId: number,
    currentPath: any[] = [],
  ): { node: any; path: any[] } | null => {
    for (const node of nodes) {
      if (Number(node.id) === Number(targetId)) {
        return { node, path: currentPath };
      }
      if (node.children?.length) {
        const found = findNodePath(node.children, targetId, [
          ...currentPath,
          node,
        ]);
        if (found) return found;
      }
    }
    return null;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const sched = await microScheduleService.getMicroSchedule(scheduleId);

      // Fetch EPS Tree & Matrix to find matching location node
      let epsTree: any[] = [];
      let distributionMatrix: Record<string, number[]> = {};

      try {
        if (sched.projectId) {
          const matrixProjectId =
            (sched.parentActivity as any)?.masterActivity?.projectId ||
            sched.projectId;
          console.log(
            `🔍 [MicroActivity] Loading mapping matrix for Project ID: ${matrixProjectId} (Current: ${sched.projectId})`,
          );

          const [tree, matrix] = await Promise.all([
            planningService.getProjectEps(sched.projectId),
            planningService.getDistributionMatrix(matrixProjectId),
          ]);
          epsTree = tree;
          distributionMatrix = matrix;
        }
      } catch (err) {
        console.warn("Failed to load EPS tree or Matrix", err);
      }

      setSchedule(sched);
      setActivities(sched.activities || []);

      // Get ledger for the parent activity and filter BOQ items
      if (sched.parentActivityId) {
        const l = await microScheduleService.getLedgerByActivity(
          sched.parentActivityId,
        );
        setLedgers(l);
      } else {
        setLedgers([]);
      }

      // Sync form dates with schedule if creating new
      if (!editingActivity) {
        // 1. Determine Target EPS ID
        // Priority 1: Check Distribution Matrix for explicit mapping
        const masterId =
          sched.parentActivity?.masterActivityId || sched.parentActivity?.id;
        const mappedLocations = distributionMatrix[masterId] || [];

        // If mapped, use the first mapped location (assuming 1:1 context for Micro Schedule)
        // Fallback to Project ID if no mapping found
        let targetEpsId =
          mappedLocations.length > 0
            ? mappedLocations[0]
            : sched.parentActivity?.projectId || sched.projectId;

        console.log(
          `🎯 [MicroActivity] Resolved Target EPS ID: ${targetEpsId} (Source: ${mappedLocations.length > 0 ? "Matrix" : "Project"})`,
        );

        // 2. Resolve Node and Path from Tree
        const result = findNodePath(epsTree, Number(targetEpsId));

        if (result) {
          setLinkedEpsNode(result.node);
          // Store path for display (excluding the node itself which is in linkedEpsNode)
          // We can store it in a new state variable or just use it here if we refactor state.
          // For now, let's add a state for path: linkedEpsPath
          setLinkedEpsPath(result.path);
          setMappingError(null);
        } else {
          console.warn(
            `⚠️ [MicroActivity] EPS Node ${targetEpsId} not found in tree.`,
          );
          setLinkedEpsNode(null);
          setLinkedEpsPath([]);

          if (mappedLocations.length > 0) {
            // Mapped but not found in current tree context? Warning.
            // Maybe the tree we fetched is for Parent Project, but mapping points elsewhere?
          } else {
            // Not mapped error
            const errMsg =
              "This activity is not mapped with any eps structure in the schedule mapper.";
            setMappingError(errMsg);
          }
        }

        setFormData((prev) => ({
          ...prev,
          parentActivityId: sched.parentActivityId,
          plannedStart: sched.plannedStart.split("T")[0],
          plannedFinish: sched.plannedFinish.split("T")[0],
          epsNodeId: Number(targetEpsId),
        }));
      }
    } catch (error) {
      console.error("Error loading breakdown data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (activity: MicroScheduleActivity) => {
    setEditingActivity(activity);
    setFormData({
      microScheduleId: scheduleId,
      parentActivityId: activity.parentActivityId,
      name: activity.name,
      description: activity.description,
      epsNodeId: activity.epsNodeId,
      boqItemId: activity.boqItemId,
      workOrderItemId: activity.workOrderItemId,
      workOrderId: activity.workOrderId,
      vendorId: activity.vendorId,
      allocatedQty: activity.allocatedQty,
      uom: activity.uom,
      plannedStart: activity.plannedStart.split("T")[0],
      plannedFinish: activity.plannedFinish.split("T")[0],
      status: activity.status,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this activity?")) return;
    try {
      await microScheduleService.deleteActivity(id);
      loadData();
    } catch (error) {
      console.error("Error deleting activity:", error);
      alert("Failed to delete activity");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Sanitize data before sending - ensure required fields have valid values
      const dataToSend = {
        ...formData,
        microScheduleId: scheduleId,
        parentActivityId: schedule?.parentActivityId || 0,
        epsNodeId: formData.epsNodeId || 0,
        boqItemId: formData.boqItemId,
        workOrderItemId: formData.workOrderItemId,
        workOrderId: formData.workOrderId,
        vendorId: formData.vendorId,
        allocatedQty: formData.allocatedQty || 0,
      };

      console.log("📤 [MicroActivity] Submitting data:", dataToSend);

      if (editingActivity) {
        await microScheduleService.updateActivity(
          editingActivity.id,
          dataToSend,
        );
      } else {
        await microScheduleService.createActivity(
          dataToSend as CreateMicroActivityDto,
        );
      }
      setIsFormOpen(false);
      setEditingActivity(null);
      loadData();
    } catch (error: any) {
      console.error("Error saving activity:", error);
      console.error("Error details:", error.response?.data);
      const errorMsg =
        error.response?.data?.message ||
        "Failed to save activity. Check quantity allocation limits.";
      alert(errorMsg);
    }
  };

  const onLedgerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      setFormData((prev) => ({
        ...prev,
        boqItemId: undefined,
        workOrderItemId: undefined,
        workOrderId: undefined,
        vendorId: undefined,
        uom: "",
        allocatedQty: 0,
      }));
      return;
    }

    const ledgerId = parseInt(value);
    const ledger = ledgers.find((l) => l.id === ledgerId);

    if (ledger) {
      setFormData((prev) => ({
        ...prev,
        boqItemId: ledger.boqItemId,
        workOrderItemId: ledger.workOrderItemId,
        workOrderId: ledger.workOrderId,
        vendorId: ledger.vendorId,
        uom: ledger.uom || "",
        allocatedQty: ledger.balanceQty,
      }));
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-text-muted">
        Loading breakdown...
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-surface-card overflow-hidden">
      {/* Summary Header */}
      <div className="bg-surface-base p-4 border-b flex justify-between items-start">
        <div className="flex gap-4">
          <div className="bg-surface-card p-3 border rounded shadow-sm text-center min-w-[100px]">
            <div className="text-[10px] text-text-disabled font-bold uppercase tracking-wider mb-1">
              Total Allocated
            </div>
            <div className="text-xl font-bold text-text-primary">
              {schedule?.totalAllocatedQty.toLocaleString()}
            </div>
          </div>
          <div className="bg-surface-card p-3 border rounded shadow-sm text-center min-w-[100px]">
            <div className="text-[10px] text-text-disabled font-bold uppercase tracking-wider mb-1">
              Actual Done
            </div>
            <div className="text-xl font-bold text-primary">
              {schedule?.totalActualQty.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="w-1/3">
          <div className="flex justify-between text-xs font-medium text-text-muted mb-1">
            <span>Overall Progress</span>
            <span>
              {schedule
                ? schedule.totalAllocatedQty > 0
                  ? Math.round(
                      (schedule.totalActualQty / schedule.totalAllocatedQty) *
                        100,
                    )
                  : 0
                : 0}
              %
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{
                width: `${schedule ? (schedule.totalAllocatedQty > 0 ? Math.min(100, (schedule.totalActualQty / schedule.totalAllocatedQty) * 100) : 0) : 0}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 flex justify-between items-center">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-tight">
          Micro Activities
        </h3>
        {!isFormOpen && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-sm font-medium hover:bg-primary-dark"
          >
            <Plus size={16} /> Add Activity
          </button>
        )}
      </div>

      {/* Add Activity Form */}
      {isFormOpen && (
        <div className="mx-4 mb-4 p-4 border rounded-lg bg-surface-card shadow-md border-blue-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h4 className="font-bold text-gray-800 flex items-center gap-2">
              {editingActivity ? <Edit2 size={16} /> : <Plus size={16} />}
              {editingActivity ? "Edit Activity" : "Create New Micro Activity"}
            </h4>
            <button
              onClick={() => {
                setIsFormOpen(false);
                setEditingActivity(null);
              }}
              className="text-text-disabled hover:text-text-secondary"
            >
              <X size={20} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                Activity Name
              </label>
              <input
                required
                type="text"
                className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-primary text-sm"
                placeholder="e.g., Rebar Fixing - First Half"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                Location (EPS)
              </label>

              {mappingError ? (
                <div className="w-full px-3 py-2 border border-red-200 bg-error-muted rounded text-sm text-error flex items-center gap-2">
                  <X size={14} />
                  {mappingError}
                </div>
              ) : linkedEpsNode ? (
                <div className="w-full px-3 py-2 border border-blue-200 bg-primary-muted rounded text-sm text-blue-900 flex items-center gap-3 font-medium shadow-sm">
                  <div className="p-1.5 bg-primary rounded-lg text-white">
                    <MapPin size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold leading-tight">
                      {linkedEpsNode.name || linkedEpsNode.label}
                    </span>
                    {/* Show Detailed EPS Path (Project > Tower > Floor) */}
                    {linkedEpsPath.length > 0 && (
                      <span className="text-xs text-blue-800 mt-0.5 font-normal flex items-center gap-1 flex-wrap">
                        <span className="opacity-70">Path:</span>
                        {linkedEpsPath.map((pathNode, idx) => (
                          <React.Fragment key={pathNode.id}>
                            <span
                              className={
                                idx === 0 ? "font-bold" : "font-medium"
                              }
                            >
                              {pathNode.name || pathNode.label}
                            </span>
                            <ChevronRight size={10} className="text-blue-400" />
                          </React.Fragment>
                        ))}
                        <span className="font-bold border-b border-blue-300">
                          {linkedEpsNode.name || linkedEpsNode.label}
                        </span>
                      </span>
                    )}
                    <span className="text-[10px] text-primary uppercase font-bold tracking-tight mt-0.5">
                      Enterprise Project Structure (Mapped)
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {schedule?.parentActivity?.wbsNode ? (
                    <div className="w-full px-3 py-2 border bg-surface-base rounded text-sm text-text-secondary flex items-center gap-2">
                      <MapPin size={14} className="text-text-disabled" />
                      {/* Show Hierarchy: Floor > Work Package */}
                      {schedule.parentActivity.wbsNode.parent ? (
                        <span>
                          <span className="font-semibold">
                            {schedule.parentActivity.wbsNode.parent.name ||
                              schedule.parentActivity.wbsNode.parent.wbsName}
                          </span>
                          <span className="text-text-disabled mx-1">›</span>
                          <span className="text-text-muted">
                            {schedule.parentActivity.wbsNode.name ||
                              schedule.parentActivity.wbsNode.wbsName}
                          </span>
                        </span>
                      ) : (
                        schedule.parentActivity.wbsNode.name ||
                        schedule.parentActivity.wbsNode.wbsName ||
                        "Unknown Location"
                      )}
                    </div>
                  ) : (
                    <div className="w-full px-3 py-2 border border-red-200 bg-error-muted rounded text-sm text-error flex items-center gap-2">
                      <X size={14} />
                      Warning: The activity is not assigned with any eps
                      structure
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                BOQ Item (Quantity Tracking){" "}
                <span className="text-error">*</span>
              </label>
              {ledgers.length === 0 ? (
                <div className="w-full px-3 py-2 border border-orange-300 bg-orange-50 rounded text-sm text-orange-700">
                  ⚠️ Activity is not assigned with any Work Order or Quantity
                  Ledger.
                </div>
              ) : (
                <>
                  <select
                    required
                    className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-primary text-sm"
                    value={
                      ledgers.find(
                        (l) => l.workOrderItemId === formData.workOrderItemId,
                      )?.id || ""
                    }
                    onChange={onLedgerChange}
                  >
                    <option value="">Select Assignment (Vendor/WO)...</option>
                    {ledgers.map((ledger) => (
                      <option key={ledger.id} value={ledger.id}>
                        {ledger.vendor?.name || "DIRECT"} | [
                        {ledger.boqItem?.boqCode}] {ledger.boqItem?.description}{" "}
                        - {ledger.balanceQty.toLocaleString()} {ledger.uom} left
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-muted mt-1">
                    ⚠️ You must select a specific Vendor/Work Order assignment
                    for tracking
                  </p>
                </>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                Quantity to Allocate
              </label>
              <div className="flex gap-2">
                <input
                  name="allocatedQty"
                  type="number"
                  step="0.001"
                  required
                  className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-primary text-sm"
                  value={formData.allocatedQty}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      allocatedQty: parseFloat(e.target.value),
                    })
                  }
                />
                <span className="flex items-center px-3 bg-surface-raised border rounded text-xs text-text-muted font-bold">
                  {formData.uom || "-"}
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-primary text-sm"
                  value={formData.plannedStart}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedStart: e.target.value })
                  }
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Finish Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border rounded focus:ring-1 focus:ring-primary text-sm"
                  value={formData.plannedFinish}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedFinish: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingActivity(null);
                }}
                className="px-4 py-2 text-sm text-text-secondary hover:bg-surface-raised rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-dark"
              >
                <Save size={16} />{" "}
                {editingActivity ? "Update Activity" : "Add Activity"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-base font-bold text-text-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3 border-b">Activity / Location</th>
                <th className="px-4 py-3 border-b">BOQ Item</th>
                <th className="px-4 py-3 border-b text-center">
                  Allocated Qty
                </th>
                <th className="px-4 py-3 border-b">Dates</th>
                <th className="px-4 py-3 border-b text-center">Progress</th>
                <th className="px-4 py-3 border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center">
                        <Plus size={32} className="text-text-disabled" />
                      </div>
                      <div>
                        <p className="text-text-secondary font-medium">
                          No activities created yet
                        </p>
                        <p className="text-sm text-text-disabled mt-1">
                          Click "Create New Micro Activity" above to break down
                          this schedule into trackable activities
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                activities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-surface-base">
                    <td className="px-4 py-4">
                      <div className="font-bold text-text-primary">
                        {activity.name}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-text-disabled mt-1 uppercase">
                        <MapPin size={10} />{" "}
                        {activity.epsNode ? activity.epsNode.name : "N/A"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {activity.boqItem ? (
                        <>
                          <div className="text-text-secondary font-medium">
                            [{activity.boqItem.boqCode}]
                          </div>
                          <div className="text-[10px] text-text-disabled truncate max-w-[200px]">
                            {activity.boqItem.description}
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="font-bold text-text-primary">
                        {activity.allocatedQty.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-text-disabled uppercase font-bold">
                        {activity.uom}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar size={12} className="text-gray-300" />
                          <span className="text-text-secondary">
                            {new Date(
                              activity.plannedStart,
                            ).toLocaleDateString()}{" "}
                            -{" "}
                            {new Date(
                              activity.plannedFinish,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        {activity.forecastFinish && (
                          <div className="flex items-center gap-2 text-[10px] text-orange-600 font-bold ml-5">
                            Forecast:{" "}
                            {new Date(
                              activity.forecastFinish,
                            ).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mb-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${activity.progressPercent >= 100 ? "bg-success" : "bg-primary"}`}
                            style={{ width: `${activity.progressPercent}%` }}
                          ></div>
                        </div>
                        <div className="text-[10px] font-bold text-text-secondary">
                          {Math.round(activity.progressPercent)}%
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(activity)}
                          className="p-1.5 text-text-disabled hover:text-primary hover:bg-primary-muted rounded transition-colors"
                          title="Edit Activity"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="p-1.5 text-text-disabled hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                          title="Daily Logs"
                          onClick={() => {
                            setSelectedActivityForLog(activity);
                            setIsLogModalOpen(true);
                          }}
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(activity.id)}
                          className="p-1.5 text-text-disabled hover:text-error hover:bg-error-muted rounded transition-colors"
                          title="Delete Activity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Daily Log Modal */}
      {selectedActivityForLog && (
        <DailyLogEntry
          isOpen={isLogModalOpen}
          onClose={() => {
            setIsLogModalOpen(false);
            setSelectedActivityForLog(null);
          }}
          activity={selectedActivityForLog}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default MicroActivityBreakdown;
