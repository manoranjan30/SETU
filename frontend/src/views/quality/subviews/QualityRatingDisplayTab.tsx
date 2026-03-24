import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  History,
  Eye,
  Trash2,
  X,
} from "lucide-react";
import api from "../../../api/axios";

interface QualityRatingDisplayTabProps {
  projectId: number;
}

const QualityRatingDisplayTab: React.FC<QualityRatingDisplayTabProps> = ({
  projectId,
}) => {
  const [rating, setRating] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectStatus, setProjectStatus] = useState("Structure");
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    fetchData();
  }, [projectId, projectStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [calcResp, histResp] = await Promise.all([
        api.get(
          `/quality/ratings/${projectId}/calculate?status=${encodeURIComponent(projectStatus)}`,
        ),
        api.get(`/quality/ratings/${projectId}/history`),
      ]);
      setRating(calcResp.data);
      setHistory(histResp.data);
    } catch (error) {
      console.error("Failed to fetch rating data", error);
    } finally {
      setLoading(false);
    }
  };

  const takeSnapshot = async () => {
    try {
      await api.post(`/quality/ratings/${projectId}/snapshot`, {
        status: projectStatus,
      });
      alert("Rating snapshot created successfully.");
      fetchData();
    } catch (error) {
      alert("Failed to take snapshot.");
    }
  };

  const deleteSnapshot = async (snapshotId: number) => {
    if (!confirm("Delete this rating snapshot permanently?")) return;
    setDeletingSnapshotId(snapshotId);
    try {
      await api.delete(`/quality/ratings/${projectId}/snapshot/${snapshotId}`);
      if (selectedSnapshot?.id === snapshotId) {
        setSelectedSnapshot(null);
      }
      await fetchData();
    } catch (error) {
      alert("Failed to delete rating snapshot.");
    } finally {
      setDeletingSnapshotId(null);
    }
  };

  if (loading && !rating)
    return (
      <div className="p-8 text-center text-text-disabled">
        Calculating Rating...
      </div>
    );

  const getScoreColor = (score: number) => {
    if (score >= 9) return "text-success bg-success-muted border-emerald-100";
    if (score >= 7) return "text-primary bg-primary-muted border-blue-100";
    if (score >= 5) return "text-warning bg-warning-muted border-amber-100";
    return "text-error bg-error-muted border-red-100";
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header / Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <select
            className="bg-surface-card border text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm focus:ring-2 focus:ring-primary"
            value={projectStatus}
            onChange={(e) => setProjectStatus(e.target.value)}
          >
            <option value="Structure">Site Status: Structure</option>
            <option value="Structure + Finishes">
              Site Status: Structure + Finishes
            </option>
            <option value="Finishes">Site Status: Finishes</option>
            <option value="Finishes + Customer Inspections">
              Site Status: Finishes + Cust. Insp.
            </option>
          </select>
          <button
            onClick={fetchData}
            className="p-2.5 bg-surface-card border rounded-xl hover:bg-surface-base transition-all text-text-muted"
            title="Recalculate"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <button
          onClick={takeSnapshot}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 font-bold"
        >
          Save Monthly Rating
        </button>
      </div>

      {/* Main Score UI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className={`md:col-span-1 rounded-3xl border p-8 flex flex-col items-center justify-center text-center shadow-sm ${getScoreColor(rating?.overallScore)}`}
        >
          <TrendingUp className="w-8 h-8 opacity-50 mb-2" />
          <h3 className="text-sm font-bold uppercase tracking-widest opacity-70">
            Overall Quality Rating
          </h3>
          <div className="text-7xl font-black mt-2">{rating?.overallScore}</div>
          <div className="text-xs font-black uppercase tracking-tighter opacity-50">
            Out of 10
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase text-text-disabled">
                  Site Observations
                </h4>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {rating?.observationScore} / 5
                </div>
              </div>
              <div className="p-2 bg-primary-muted rounded-lg">
                <AlertTriangle className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Avg weight adjusted score for all observations.
            </p>
          </div>

          <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase text-text-disabled">
                  Pending Recovery
                </h4>
                <div className="text-2xl font-bold text-error mt-1">
                  -{rating?.pendingDeduction}
                </div>
              </div>
              <div className="p-2 bg-error-muted rounded-lg">
                <TrendingUp className="w-5 h-5 text-error rotate-180" />
              </div>
            </div>
            <div className="text-xs font-medium text-text-muted mt-2">
              Deduction for{" "}
              <span className="text-error font-bold">
                {rating?.pendingRatioPercentage}%
              </span>{" "}
              open observations ({rating?.openObservations}/
              {rating?.totalObservations}).
            </div>
          </div>

          <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase text-text-disabled">
                  Documentation
                </h4>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  5 / 5
                </div>
              </div>
              <div className="p-2 bg-success-muted rounded-lg">
                <FileText className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Score based on quality document submission status.
            </p>
          </div>

          <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase text-text-disabled">
                  Cust/EHS Audits
                </h4>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {rating?.customerInspectionScore} / 5
                </div>
              </div>
              <div className="p-2 bg-warning-muted rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Score based on external audit reviews.
            </p>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-surface-card rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
        <div className="p-6 border-b flex items-center gap-2">
          <History className="w-5 h-5 text-text-disabled" />
          <h3 className="text-lg font-bold text-text-primary">
            Rating History
          </h3>
        </div>
        {history.length === 0 ? (
          <div className="p-12 text-center text-text-disabled flex flex-col items-center">
            <LayoutDashboard className="w-12 h-12 mb-4 opacity-10" />
            <p className="text-sm font-medium">
              No recorded snapshots found for this project.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-base border-b">
                <tr>
                  <th className="text-left px-8 py-4 text-[10px] font-black text-text-disabled uppercase">
                    Period
                  </th>
                  <th className="text-left px-4 py-4 text-[10px] font-black text-text-disabled uppercase">
                    Status Context
                  </th>
                  <th className="text-center px-4 py-4 text-[10px] font-black text-text-disabled uppercase font-mono">
                    Open/Total
                  </th>
                  <th className="text-center px-4 py-4 text-[10px] font-black text-text-disabled uppercase">
                    Deduction
                  </th>
                  <th className="text-right px-8 py-4 text-[10px] font-black text-text-disabled uppercase">
                    Overall Rating
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((h: any) => (
                  <tr
                    key={h.id}
                    className="hover:bg-surface-base transition-colors"
                  >
                    <td className="px-8 py-4 font-bold text-text-primary">
                      {h.period}
                    </td>
                    <td className="px-4 py-4 text-text-muted font-medium">
                      {h.details?.context || "Structure"}
                    </td>
                    <td className="px-4 py-4 text-center font-mono">
                      <span className="text-error px-1.5 py-0.5 rounded-md bg-error-muted">
                        {h.openObservations}
                      </span>
                      <span className="mx-1 text-gray-300">/</span>
                      <span className="text-text-primary">
                        {h.totalObservations}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-error font-bold">
                      -{h.pendingDeduction}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSnapshot(h)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-base"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Snapshot
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSnapshot(h.id)}
                          disabled={deletingSnapshotId === h.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-error-muted px-3 py-1.5 text-xs font-bold text-error hover:bg-red-100 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deletingSnapshotId === h.id ? "Deleting..." : "Delete"}
                        </button>
                        <span
                          className={`inline-block px-4 py-1 rounded-full font-black ${getScoreColor(h.overallScore)}`}
                        >
                          {h.overallScore}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border-subtle bg-surface-card shadow-2xl">
            <div className="flex items-center justify-between border-b bg-surface-base px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-text-primary">
                  Rating Snapshot Calculation
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  Period {selectedSnapshot.period} •{" "}
                  {selectedSnapshot.details?.context || selectedSnapshot.details?.breakdown?.projectStatus || "Structure"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSnapshot(null)}
                className="rounded-full p-2 text-text-secondary hover:bg-surface-raised"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
                  <div className="text-[10px] font-black uppercase text-text-disabled">
                    Overall
                  </div>
                  <div className="mt-2 text-3xl font-black text-text-primary">
                    {selectedSnapshot.overallScore}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
                  <div className="text-[10px] font-black uppercase text-text-disabled">
                    Observation Score
                  </div>
                  <div className="mt-2 text-3xl font-black text-primary">
                    {selectedSnapshot.observationScore}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
                  <div className="text-[10px] font-black uppercase text-text-disabled">
                    Documentation
                  </div>
                  <div className="mt-2 text-3xl font-black text-emerald-600">
                    {selectedSnapshot.documentationScore}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
                  <div className="text-[10px] font-black uppercase text-text-disabled">
                    Pending Deduction
                  </div>
                  <div className="mt-2 text-3xl font-black text-error">
                    -{selectedSnapshot.pendingDeduction}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-3xl border border-border-subtle bg-surface-base p-5">
                  <h4 className="text-sm font-bold text-text-primary">
                    Calculation Breakdown
                  </h4>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Average observation score</span>
                      <span className="font-bold text-text-primary">
                        {selectedSnapshot.details?.breakdown?.averageObservationScore ??
                          selectedSnapshot.observationScore}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Weighted observation contribution</span>
                      <span className="font-bold text-text-primary">
                        {selectedSnapshot.details?.breakdown?.weightedObservationScore ??
                          selectedSnapshot.observationScore}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Weighted documentation contribution</span>
                      <span className="font-bold text-text-primary">
                        {selectedSnapshot.details?.breakdown?.weightedDocumentationScore ??
                          selectedSnapshot.documentationScore}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Weighted audit contribution</span>
                      <span className="font-bold text-text-primary">
                        {selectedSnapshot.details?.breakdown?.weightedCustomerInspectionScore ??
                          selectedSnapshot.customerInspectionScore}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Open observations</span>
                      <span className="font-bold text-text-primary">
                        {selectedSnapshot.openObservations} / {selectedSnapshot.totalObservations}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Pending ratio</span>
                      <span className="font-bold text-text-primary">
                        {selectedSnapshot.pendingRatioPercentage}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border-subtle bg-surface-base p-5">
                  <h4 className="text-sm font-bold text-text-primary">
                    Rating Weights
                  </h4>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl border border-border-subtle bg-surface-card p-4">
                      <div className="text-[10px] uppercase font-black text-text-disabled">Observations</div>
                      <div className="mt-2 text-2xl font-black text-primary">
                        {selectedSnapshot.details?.breakdown?.categoryWeights?.observations ??
                          "-"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-surface-card p-4">
                      <div className="text-[10px] uppercase font-black text-text-disabled">Documentation</div>
                      <div className="mt-2 text-2xl font-black text-emerald-600">
                        {selectedSnapshot.details?.breakdown?.categoryWeights?.documentation ??
                          "-"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-surface-card p-4">
                      <div className="text-[10px] uppercase font-black text-text-disabled">Cust/EHS</div>
                      <div className="mt-2 text-2xl font-black text-amber-600">
                        {selectedSnapshot.details?.breakdown?.categoryWeights?.customerInspections ??
                          "-"}
                      </div>
                    </div>
                  </div>

                  <h4 className="mt-6 text-sm font-bold text-text-primary">
                    Severity Mix
                  </h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(
                      selectedSnapshot.details?.breakdown?.severityCounts || {},
                    ).length > 0 ? (
                      Object.entries(
                        selectedSnapshot.details?.breakdown?.severityCounts || {},
                      ).map(([severity, count]) => (
                        <div
                          key={severity}
                          className="rounded-full border border-border-subtle bg-surface-card px-3 py-1.5 text-xs font-bold text-text-secondary"
                        >
                          {severity}: {String(count)}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-text-muted">
                        Severity-wise counts were not stored in this older snapshot.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityRatingDisplayTab;
