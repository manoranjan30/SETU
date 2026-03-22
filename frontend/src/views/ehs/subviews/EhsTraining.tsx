import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Users,
  BookOpen,
  UserCheck,
  Clock,
} from "lucide-react";
import api from "../../../api/axios";

interface Props {
  projectId: number;
}

const TRAINING_TYPE_OPTIONS = [
  { value: "INDUCTION", label: "Induction" },
  { value: "TBT", label: "Tool Box Talk" },
  { value: "SPECIALIZED", label: "Specialized" },
  { value: "FIRE_DRILL", label: "Fire Drill" },
  { value: "FIRST_AID", label: "First Aid" },
] as const;

const TRAINING_TYPE_LABELS = Object.fromEntries(
  TRAINING_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;

const normalizeTrainingType = (value?: string | null) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const legacyMap: Record<string, string> = {
    SAFETY: "INDUCTION",
    HEALTH: "FIRST_AID",
    ENVIRONMENT: "SPECIALIZED",
    QUALITY: "SPECIALIZED",
    OTHER: "SPECIALIZED",
    TOOL_BOX_TALK: "TBT",
    TOOLBOX_TALK: "TBT",
    FIREDRILL: "FIRE_DRILL",
    FIRSTAID: "FIRST_AID",
  };

  if (TRAINING_TYPE_LABELS[normalized]) {
    return normalized;
  }

  return legacyMap[normalized] || "INDUCTION";
};

const getTrainingTypeLabel = (value?: string | null) =>
  TRAINING_TYPE_LABELS[normalizeTrainingType(value)] || "Induction";

const EhsTraining: React.FC<Props> = ({ projectId }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);

  const [formData, setFormData] = useState({
    topic: "",
    trainingType: "INDUCTION",
    status: "Completed",
    date: new Date().toISOString().slice(0, 10),
    attendeeCount: 0,
    trainer: "",
    duration: 60,
    remarks: "",
  });

  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    participants: 0,
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const response = await api.get(`/ehs/${projectId}/trainings`);
      setData(response.data);
      calculateStats(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (items: any[]) => {
    const completed = items.filter((i) => i.status === "Completed").length;
    const pending = items.filter((i) => i.status === "Pending").length;
    const participants = items.reduce(
      (sum, i) => sum + (Number(i.attendeeCount) || 0),
      0,
    );

    setStats({
      total: items.length,
      completed,
      pending,
      participants,
    });
  };

  const handleEdit = (item: any) => {
    setFormData({
      topic: item.topic,
      trainingType: normalizeTrainingType(item.trainingType),
      status: item.status || "Completed",
      date: item.date,
      attendeeCount: item.attendeeCount,
      trainer: item.trainer,
      duration: item.duration,
      remarks: item.remarks || "",
    });
    setEditingId(item.id);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/ehs/trainings/${deleteId}`);
      setDeleteId(null);
      setDeleteStep(0);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, projectId };

      if (editingId) {
        await api.put(`/ehs/trainings/${editingId}`, payload);
      } else {
        await api.post(`/ehs/${projectId}/trainings`, payload);
      }
      setShowModal(false);
      setEditingId(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      topic: "",
      trainingType: "INDUCTION",
      status: "Completed",
      date: new Date().toISOString().slice(0, 10),
      attendeeCount: 0,
      trainer: "",
      duration: 60,
      remarks: "",
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted mb-1">Total Trainings</p>
            <p className="text-3xl font-black text-text-primary">
              {stats.total}
            </p>
          </div>
          <div className="bg-info-muted p-3 rounded-xl">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
        </div>
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted mb-1">Completed</p>
            <p className="text-3xl font-black text-text-primary">
              {stats.completed}
            </p>
          </div>
          <div className="bg-green-100 p-3 rounded-xl">
            <UserCheck className="w-6 h-6 text-success" />
          </div>
        </div>
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted mb-1">Pending</p>
            <p className="text-3xl font-black text-text-primary">
              {stats.pending}
            </p>
          </div>
          <div className="bg-orange-100 p-3 rounded-xl">
            <Clock className="w-6 h-6 text-orange-600" />{" "}
            {/* Reusing Clock icon from lucide-react, import if missing in this file scope if strict, but assuming standard generic usage */}
          </div>
        </div>
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted mb-1">Total Participants</p>
            <p className="text-3xl font-black text-text-primary">
              {stats.participants}
            </p>
          </div>
          <div className="bg-purple-100 p-3 rounded-xl">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="font-bold text-text-primary">Training Register</h3>
          <button
            onClick={() => {
              setEditingId(null);
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Enter Training Data
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-base text-xs font-bold uppercase text-text-muted">
              <tr>
                <th className="px-6 py-4">SI</th>
                <th className="px-6 py-4">Training Topic</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Month</th>
                <th className="px-6 py-4">Participants</th>
                <th className="px-6 py-4">Completed Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((item, index) => (
                <tr key={item.id} className="hover:bg-surface-base/50">
                  <td className="px-6 py-4 font-medium text-text-primary">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 font-medium text-text-primary">
                    {item.topic}
                  </td>
                      <td className="px-6 py-4">
                    <span className="bg-surface-raised text-text-secondary px-2 py-1 rounded text-xs font-medium">
                      {getTrainingTypeLabel(item.trainingType)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        item.status === "Completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-muted">
                    {new Date(item.date).toLocaleDateString("en-US", {
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-4 font-bold text-text-primary">
                    {item.attendeeCount}
                  </td>
                  <td className="px-6 py-4 text-text-muted">
                    {new Date(item.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 hover:bg-primary-muted text-primary rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteId(item.id);
                          setDeleteStep(1);
                        }}
                        className="p-1.5 hover:bg-error-muted text-error rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-card w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-surface-base">
              <h3 className="font-bold text-lg">
                {editingId ? "Update" : "Enter"} Training Data
              </h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1">
                  Training Topic
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                  value={formData.topic}
                  onChange={(e) =>
                    setFormData({ ...formData, topic: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    Type
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.trainingType}
                    onChange={(e) =>
                      setFormData({ ...formData, trainingType: e.target.value })
                    }
                  >
                    {TRAINING_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    Status
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    Participants
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.attendeeCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        attendeeCount: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    Trainer Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.trainer}
                    onChange={(e) =>
                      setFormData({ ...formData, trainer: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    Duration (Min)
                  </label>
                  <input
                    type="number"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duration: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1">
                  Remarks
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none h-20"
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white py-2 rounded-lg font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {editingId ? "Update Training" : "Save Training Data"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteStep > 0 && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-error" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">
              {deleteStep === 1
                ? "Delete Training Record?"
                : "Are you absolutely sure?"}
            </h3>
            <p className="text-sm text-text-muted mb-6">
              {deleteStep === 1
                ? "This action will remove this training record permanently."
                : "This action cannot be undone. Confirm deletion?"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setDeleteStep(0);
                  setDeleteId(null);
                }}
                className="px-4 py-2 bg-surface-raised text-text-secondary rounded-lg font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deleteStep === 1 ? setDeleteStep(2) : handleDelete()
                }
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                {deleteStep === 1 ? "Yes, Delete" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EhsTraining;
