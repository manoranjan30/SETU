import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  XCircle,
} from "lucide-react";
import api from "../../api/axios";

interface PendingLog {
  id: number;
  measurementElement: {
    id: number;
    elementName: string;
    activity: {
      activityCode: string;
      activityName: string;
    };
    boqItem: {
      description: string;
      uom: string;
    };
    epsNode: {
      nodeName: string;
      path?: string;
    } | null;
  };
  executedQty: number;
  date: string;
  updatedBy: string;
  rejectionReason?: string;
  locationPath?: string | null;
  towerName?: string | null;
  floorName?: string | null;
  progressSummary?: {
    totalQuantity: number;
    approvedTillLast: number;
    presentSubmitted: number;
    totalApprovalIncludingPresent: number;
    pendingQuantity?: number;
  } | null;
}

interface ApprovalsPageProps {
  onActionComplete?: () => void;
}

interface FloorGroup {
  key: string;
  floorName: string;
  logs: PendingLog[];
}

interface TowerGroup {
  key: string;
  towerName: string;
  logs: PendingLog[];
  floors: FloorGroup[];
}

const formatQty = (value: number | undefined | null) =>
  Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

const ApprovalsPage = ({ onActionComplete }: ApprovalsPageProps) => {
  const { projectId } = useParams<{ projectId: string }>();

  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedTowerKeys, setExpandedTowerKeys] = useState<Set<string>>(
    new Set(),
  );
  const [expandedFloorKeys, setExpandedFloorKeys] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (projectId) fetchPending();
  }, [projectId]);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/execution/${projectId}/approvals/pending`);
      setPendingLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch approvals", error);
    } finally {
      setLoading(false);
    }
  };

  const groupedLogs = useMemo<TowerGroup[]>(() => {
    const towerMap = new Map<string, TowerGroup>();

    for (const log of pendingLogs) {
      const towerName = log.towerName || "Unassigned Tower";
      const floorName = log.floorName || "Unassigned Floor";
      const towerKey = towerName;
      const floorKey = `${towerName}::${floorName}`;

      if (!towerMap.has(towerKey)) {
        towerMap.set(towerKey, {
          key: towerKey,
          towerName,
          logs: [],
          floors: [],
        });
      }

      const tower = towerMap.get(towerKey)!;
      tower.logs.push(log);

      let floor = tower.floors.find((item) => item.key === floorKey);
      if (!floor) {
        floor = { key: floorKey, floorName, logs: [] };
        tower.floors.push(floor);
      }
      floor.logs.push(log);
    }

    return Array.from(towerMap.values());
  }, [pendingLogs]);

  useEffect(() => {
    setExpandedTowerKeys(new Set(groupedLogs.map((group) => group.key)));
    setExpandedFloorKeys(
      new Set(
        groupedLogs.flatMap((tower) => tower.floors.map((floor) => floor.key)),
      ),
    );
  }, [groupedLogs]);

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedIds(e.target.checked ? pendingLogs.map((log) => log.id) : []);
  };

  const handleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const setIdsSelected = (ids: number[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return Array.from(next);
    });
  };

  const toggleTower = (key: string) => {
    setExpandedTowerKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFloor = (key: string) => {
    setExpandedFloorKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApprove = async (ids = selectedIds) => {
    if (!ids.length) return;
    setActionLoading(true);
    try {
      await api.post(`/execution/approve`, { logIds: ids });
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      await fetchPending();
      onActionComplete?.();
    } catch (error) {
      console.error("Approval failed", error);
      alert("Failed to approve items");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedIds.length) return;
    setActionLoading(true);
    try {
      await api.post(`/execution/reject`, {
        logIds: selectedIds,
        reason: rejectReason,
      });
      setSelectedIds([]);
      setShowRejectModal(false);
      setRejectReason("");
      await fetchPending();
      onActionComplete?.();
    } catch (error) {
      console.error("Rejection failed", error);
      alert("Failed to reject items");
    } finally {
      setActionLoading(false);
    }
  };

  const oldestDate =
    pendingLogs.length > 0
      ? new Date(
          Math.min(...pendingLogs.map((log) => new Date(log.date).getTime())),
        ).toLocaleDateString()
      : null;

  if (!projectId) {
    return (
      <div className="p-8 text-center text-text-muted">
        Please select a project to view approvals.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-800">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Approvals
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Review progress tower-wise and floor-wise before it is committed.
          </p>
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-error-muted px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Reject ({selectedIds.length})
            </button>
            <button
              onClick={() => handleApprove()}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {actionLoading
                ? "Processing..."
                : `Approve (${selectedIds.length})`}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border-default bg-surface-card p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Pending Requests
          </div>
          <div
            className={`mt-1 text-3xl font-black ${
              pendingLogs.length > 0 ? "text-amber-500" : "text-gray-300"
            }`}
          >
            {pendingLogs.length}
          </div>
        </div>
        <div className="rounded-xl border border-border-default bg-surface-card p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Oldest Request
          </div>
          <div className="mt-2 text-lg font-bold text-gray-800">
            {oldestDate ?? <span className="text-gray-300">-</span>}
          </div>
        </div>
        <div className="rounded-xl border border-border-default bg-surface-card p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Selected
          </div>
          <div className="mt-1 text-3xl font-black text-secondary">
            {selectedIds.length}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-text-disabled">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
            Loading pending approvals...
          </div>
        ) : pendingLogs.length === 0 ? (
          <div className="p-16 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-300" />
            <p className="font-medium text-text-muted">All caught up!</p>
            <p className="mt-1 text-sm text-text-disabled">
              No pending approvals for this project.
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <label className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm font-semibold text-text-secondary">
              <input
                type="checkbox"
                className="rounded border-border-strong text-secondary"
                checked={
                  pendingLogs.length > 0 &&
                  selectedIds.length === pendingLogs.length
                }
                onChange={handleSelectAll}
              />
              Select all pending approvals
            </label>

            {groupedLogs.map((tower) => {
              const towerSelected = tower.logs.every((log) =>
                selectedIds.includes(log.id),
              );
              const towerOpen = expandedTowerKeys.has(tower.key);

              return (
                <section
                  key={tower.key}
                  className="overflow-hidden rounded-xl border border-border-default"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-green-50 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleTower(tower.key)}
                      className="flex items-center gap-2 text-left"
                    >
                      {towerOpen ? (
                        <ChevronDown className="h-4 w-4 text-secondary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-secondary" />
                      )}
                      <span className="text-sm font-bold text-primary">
                        {tower.towerName}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-text-muted">
                        {tower.logs.length} approvals
                      </span>
                    </button>
                    <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                      <input
                        type="checkbox"
                        className="rounded border-border-strong text-secondary"
                        checked={towerSelected}
                        onChange={(event) =>
                          setIdsSelected(
                            tower.logs.map((log) => log.id),
                            event.target.checked,
                          )
                        }
                      />
                      Select tower
                    </label>
                  </div>

                  {towerOpen && (
                    <div className="divide-y divide-border-default">
                      {tower.floors.map((floor) => {
                        const floorSelected = floor.logs.every((log) =>
                          selectedIds.includes(log.id),
                        );
                        const floorOpen = expandedFloorKeys.has(floor.key);

                        return (
                          <div key={floor.key}>
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-base px-4 py-2">
                              <button
                                type="button"
                                onClick={() => toggleFloor(floor.key)}
                                className="flex items-center gap-2 text-left"
                              >
                                {floorOpen ? (
                                  <ChevronDown className="h-4 w-4 text-text-muted" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-text-muted" />
                                )}
                                <MapPin className="h-4 w-4 text-text-muted" />
                                <span className="text-sm font-semibold text-text-secondary">
                                  {floor.floorName}
                                </span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-text-disabled">
                                  {floor.logs.length} rows
                                </span>
                              </button>
                              <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                                <input
                                  type="checkbox"
                                  className="rounded border-border-strong text-secondary"
                                  checked={floorSelected}
                                  onChange={(event) =>
                                    setIdsSelected(
                                      floor.logs.map((log) => log.id),
                                      event.target.checked,
                                    )
                                  }
                                />
                                Select floor
                              </label>
                            </div>

                            {floorOpen && (
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[1200px] text-left text-sm">
                                  <thead className="border-y bg-white text-xs font-semibold uppercase tracking-wider text-text-muted">
                                    <tr>
                                      <th className="w-12 p-3 text-center"></th>
                                      <th className="p-3">Ref #</th>
                                      <th className="p-3">
                                        Full Location / Activity
                                      </th>
                                      <th className="p-3">Resource / Item</th>
                                      <th className="p-3 text-right">Total</th>
                                      <th className="p-3 text-right">
                                        Till Last Approval
                                      </th>
                                      <th className="p-3 text-right">
                                        Present Submitted
                                      </th>
                                      <th className="p-3 text-right">
                                        Total Approval
                                      </th>
                                      <th className="p-3">Date</th>
                                      <th className="p-3">Submitted By</th>
                                      <th className="p-3 text-center">
                                        Action
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {floor.logs.map((log) => {
                                      const summary = log.progressSummary;
                                      const totalQuantity =
                                        summary?.totalQuantity ?? 0;
                                      const approvedTillLast =
                                        summary?.approvedTillLast ?? 0;
                                      const presentSubmitted =
                                        summary?.presentSubmitted ??
                                        log.executedQty;
                                      const totalIncludingPresent =
                                        summary?.totalApprovalIncludingPresent ??
                                        approvedTillLast + presentSubmitted;
                                      const isOver =
                                        totalQuantity > 0 &&
                                        totalIncludingPresent > totalQuantity;
                                      const location =
                                        log.locationPath ||
                                        log.measurementElement?.epsNode?.path ||
                                        log.measurementElement?.epsNode
                                          ?.nodeName ||
                                        "-";

                                      return (
                                        <tr
                                          key={log.id}
                                          className={`transition-colors hover:bg-warning-muted/40 ${
                                            selectedIds.includes(log.id)
                                              ? "bg-warning-muted"
                                              : ""
                                          }`}
                                        >
                                          <td className="p-3 text-center">
                                            <input
                                              type="checkbox"
                                              className="rounded border-border-strong text-secondary"
                                              checked={selectedIds.includes(
                                                log.id,
                                              )}
                                              onChange={() =>
                                                handleSelect(log.id)
                                              }
                                            />
                                          </td>
                                          <td className="p-3 font-mono text-xs text-text-disabled">
                                            #{log.id}
                                          </td>
                                          <td className="max-w-[360px] p-3">
                                            <div className="text-xs font-semibold text-primary">
                                              {location}
                                            </div>
                                            <div className="mt-1 font-bold text-gray-800">
                                              {
                                                log.measurementElement?.activity
                                                  ?.activityCode
                                              }{" "}
                                              -{" "}
                                              {
                                                log.measurementElement?.activity
                                                  ?.activityName
                                              }
                                            </div>
                                            {log.measurementElement
                                              ?.elementName && (
                                              <div className="mt-0.5 text-xs text-text-muted">
                                                {
                                                  log.measurementElement
                                                    .elementName
                                                }
                                              </div>
                                            )}
                                          </td>
                                          <td className="max-w-[260px] p-3 text-text-secondary">
                                            <div className="line-clamp-2">
                                              {log.measurementElement?.boqItem
                                                ?.description || "-"}
                                            </div>
                                          </td>
                                          <td className="p-3 text-right font-semibold text-text-secondary">
                                            {formatQty(totalQuantity)}
                                          </td>
                                          <td className="p-3 text-right font-semibold text-text-secondary">
                                            {formatQty(approvedTillLast)}
                                          </td>
                                          <td className="p-3 text-right font-bold text-secondary">
                                            {formatQty(presentSubmitted)}
                                          </td>
                                          <td
                                            className={`p-3 text-right font-black ${
                                              isOver
                                                ? "text-error"
                                                : "text-success"
                                            }`}
                                          >
                                            {formatQty(totalIncludingPresent)}
                                            <span className="ml-1 text-xs font-medium text-text-disabled">
                                              {
                                                log.measurementElement?.boqItem
                                                  ?.uom
                                              }
                                            </span>
                                          </td>
                                          <td className="whitespace-nowrap p-3 text-xs text-text-secondary">
                                            {new Date(
                                              log.date,
                                            ).toLocaleDateString()}
                                          </td>
                                          <td className="p-3">
                                            <span className="rounded-full bg-surface-raised px-2 py-1 text-xs font-medium text-text-secondary">
                                              User #{log.updatedBy}
                                            </span>
                                          </td>
                                          <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                              <button
                                                onClick={() =>
                                                  handleApprove([log.id])
                                                }
                                                disabled={actionLoading}
                                                title="Approve this entry"
                                                className="rounded-full p-1.5 text-success transition-colors hover:bg-green-100 disabled:opacity-50"
                                              >
                                                <CheckCircle2 className="h-4 w-4" />
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setSelectedIds([log.id]);
                                                  setShowRejectModal(true);
                                                }}
                                                title="Reject this entry"
                                                className="rounded-full p-1.5 text-error transition-colors hover:bg-red-100"
                                              >
                                                <XCircle className="h-4 w-4" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <AlertCircle className="h-5 w-5 text-error" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Reject Progress Entry
                </h3>
                <p className="text-sm text-text-muted">
                  Rejecting {selectedIds.length} item(s)
                </p>
              </div>
            </div>
            <textarea
              className="mb-4 h-28 w-full resize-none rounded-xl border border-border-default p-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-300"
              placeholder="Reason for rejection (required)..."
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsPage;
