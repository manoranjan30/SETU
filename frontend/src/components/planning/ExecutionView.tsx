import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { useParams } from "react-router-dom";
import { CheckCircle, AlertCircle, Save } from "lucide-react";

interface BoqItem {
  id: number;
  description: string;
  qty: number;
  uom: string;
}

const ExecutionView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [selectedBoqId, setSelectedBoqId] = useState<string>("");
  const [measuredQty, setMeasuredQty] = useState<string>("");
  const [status, setStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  useEffect(() => {
    if (projectId) fetchBoq();
  }, [projectId]);

  const fetchBoq = async () => {
    setLoading(true);
    try {
      // Updated to use 'api' client which handles base URL (/api) and Auth
      const res = await api.get(`/boq/project/${projectId}`);
      setBoqItems(res.data);
    } catch (err) {
      console.error("Error fetching BOQ:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBoqId || !measuredQty) return;

    setStatus(null);
    try {
      await api.post(`/planning/measurements`, {
        projectId: parseInt(projectId!),
        boqItemId: parseInt(selectedBoqId),
        measuredQty: parseFloat(measuredQty),
        status: "APPROVED", // For now, auto-approve
      });
      setStatus({
        type: "success",
        msg: "Progress Recorded & Schedule Updated!",
      });
      setMeasuredQty("");
    } catch (err) {
      console.error("Error submitting measurement:", err);
      setStatus({ type: "error", msg: "Failed to record progress" });
    }
  };

  const selectedBoq = boqItems.find((b) => b.id.toString() === selectedBoqId);

  if (loading) {
    return (
      <div className="p-8 text-center text-text-muted">
        Loading BOQ Items...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Site Execution Record
      </h2>

      <div className="bg-surface-card p-6 rounded-lg shadow border border-border-default space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Select BOQ Item
          </label>
          <select
            className="w-full border-border-strong rounded-md shadow-sm p-2 border"
            value={selectedBoqId}
            onChange={(e) => setSelectedBoqId(e.target.value)}
          >
            <option value="">Select Item...</option>
            {boqItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.description}
              </option>
            ))}
          </select>
        </div>

        {selectedBoq && (
          <div className="bg-primary-muted p-4 rounded-md text-sm text-blue-800">
            <p>
              Total Scope:{" "}
              <strong>
                {selectedBoq.qty} {selectedBoq.uom}
              </strong>
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Measured Quantity (This Period)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 border-border-strong rounded-md shadow-sm p-2 border"
              placeholder="0.00"
              value={measuredQty}
              onChange={(e) => setMeasuredQty(e.target.value)}
            />
            <span className="bg-surface-raised px-4 py-2 rounded border border-border-default text-text-muted">
              {selectedBoq?.uom || "Unit"}
            </span>
          </div>
        </div>

        {status && (
          <div
            className={`p-3 rounded flex items-center gap-2 ${status.type === "success" ? "bg-success-muted text-green-700" : "bg-error-muted text-red-700"}`}
          >
            {status.type === "success" ? (
              <CheckCircle size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            {status.msg}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedBoqId || !measuredQty}
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-md flex justify-center items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={20} />
          Submit Measurement
        </button>
      </div>
    </div>
  );
};

export default ExecutionView;
