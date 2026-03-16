import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
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
    };
  };
  executedQty: number;
  date: string;
  updatedBy: string;
  rejectionReason?: string;
}

interface ApprovalsPageProps {
  onActionComplete?: () => void;
}

const ApprovalsPage = ({ onActionComplete }: ApprovalsPageProps) => {
  const { projectId } = useParams<{ projectId: string }>();

  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
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
      setPendingLogs(res.data);
    } catch (error) {
      console.error("Failed to fetch approvals", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIds(e.target.checked ? pendingLogs.map((l) => l.id) : []);
  };

  const handleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleApprove = async () => {
    if (!selectedIds.length) return;
    setActionLoading(true);
    try {
      await api.post(`/execution/approve`, { logIds: selectedIds });
      setSelectedIds([]);
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
          Math.min(...pendingLogs.map((l) => new Date(l.date).getTime())),
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending Approvals
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            Review and approve site progress updates before they are committed
          </p>
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 bg-error-muted border border-red-200 text-error rounded-lg hover:bg-red-100 flex items-center gap-2 font-medium text-sm transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reject ({selectedIds.length})
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium text-sm shadow-sm transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {actionLoading
                ? "Processing..."
                : `Approve (${selectedIds.length})`}
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-sm">
          <div className="text-text-muted text-xs font-semibold uppercase tracking-wider">
            Pending Requests
          </div>
          <div
            className={`text-3xl font-black mt-1 ${pendingLogs.length > 0 ? "text-amber-500" : "text-gray-300"}`}
          >
            {pendingLogs.length}
          </div>
        </div>
        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-sm">
          <div className="text-text-muted text-xs font-semibold uppercase tracking-wider">
            Oldest Request
          </div>
          <div className="text-lg font-bold text-gray-800 mt-2">
            {oldestDate ?? <span className="text-gray-300">—</span>}
          </div>
        </div>
        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-sm">
          <div className="text-text-muted text-xs font-semibold uppercase tracking-wider">
            Selected
          </div>
          <div className="text-3xl font-black mt-1 text-secondary">
            {selectedIds.length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-card border border-border-default rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-disabled">
            <div className="animate-spin w-8 h-8 border-2 border-secondary border-t-transparent rounded-full mx-auto mb-3" />
            Loading pending approvals...
          </div>
        ) : pendingLogs.length === 0 ? (
          <div className="p-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-3" />
            <p className="text-text-muted font-medium">All caught up!</p>
            <p className="text-text-disabled text-sm mt-1">
              No pending approvals for this project.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-base text-text-muted text-xs font-semibold uppercase tracking-wider border-b">
                <tr>
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-border-strong text-secondary"
                      checked={
                        pendingLogs.length > 0 &&
                        selectedIds.length === pendingLogs.length
                      }
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-4">Ref #</th>
                  <th className="p-4">Activity</th>
                  <th className="p-4">Resource / Item</th>
                  <th className="p-4">Location</th>
                  <th className="p-4 text-right">Quantity</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Submitted By</th>
                  <th className="p-4 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={`hover:bg-warning-muted/40 transition-colors ${selectedIds.includes(log.id) ? "bg-warning-muted" : ""}`}
                  >
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-border-strong text-secondary"
                        checked={selectedIds.includes(log.id)}
                        onChange={() => handleSelect(log.id)}
                      />
                    </td>
                    <td className="p-4 text-text-disabled font-mono text-xs">
                      #{log.id}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-800 text-xs">
                        {log.measurementElement?.activity?.activityCode}
                      </div>
                      <div className="text-text-muted text-xs truncate max-w-[160px]">
                        {log.measurementElement?.activity?.activityName}
                      </div>
                    </td>
                    <td className="p-4 text-text-secondary max-w-[200px]">
                      <div className="truncate">
                        {log.measurementElement?.boqItem?.description || "—"}
                      </div>
                    </td>
                    <td className="p-4 text-text-muted text-xs">
                      {log.measurementElement?.epsNode?.nodeName || "—"}
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-bold text-primary">
                        {Number(log.executedQty).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-xs text-text-disabled ml-1">
                        {log.measurementElement?.boqItem?.uom}
                      </span>
                    </td>
                    <td className="p-4 text-text-secondary text-xs whitespace-nowrap">
                      {new Date(log.date).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className="bg-surface-raised text-text-secondary px-2 py-1 rounded-full text-xs font-medium">
                        User #{log.updatedBy}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedIds([log.id]);
                            handleApprove();
                          }}
                          title="Approve this entry"
                          className="p-1.5 rounded-full text-success hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedIds([log.id]);
                            setShowRejectModal(true);
                          }}
                          title="Reject this entry"
                          className="p-1.5 rounded-full text-error hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-error" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Reject Progress Entry
                </h3>
                <p className="text-text-muted text-sm">
                  Rejecting {selectedIds.length} item(s)
                </p>
              </div>
            </div>
            <textarea
              className="w-full border border-border-default rounded-xl p-3 text-sm mb-4 h-28 resize-none focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none"
              placeholder="Reason for rejection (required)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
