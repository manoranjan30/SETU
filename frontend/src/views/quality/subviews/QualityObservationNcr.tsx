import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  AlertCircle,
  Eye,
  Calendar,
  User,
  Tag,
  MapPin,
} from "lucide-react";
import api from "../../../api/axios";

interface Props {
  projectId: number;
}

const QualityObservationNcr: React.FC<Props> = ({ projectId }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    projectId,
    type: "Observation",
    severity: "Minor",
    category: "Structural",
    issueDescription: "",
    location: "",
    reportedDate: new Date().toISOString().split("T")[0],
    reportedBy: "",
    assignedTo: "",
    status: "Open",
    rootCause: "",
    correctiveAction: "",
    targetDate: "",
  });

  const fetchRecords = async () => {
    try {
      const response = await api.get(`/quality/${projectId}/observation-ncr`);
      setRecords(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/quality/observation-ncr/${editingItem.id}`, formData);
      } else {
        await api.post("/quality/observation-ncr", formData);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      resetForm();
      fetchRecords();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await api.delete(`/quality/observation-ncr/${id}`);
      fetchRecords();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      projectId,
      type: "Observation",
      severity: "Minor",
      category: "Structural",
      issueDescription: "",
      location: "",
      reportedDate: new Date().toISOString().split("T")[0],
      reportedBy: "",
      assignedTo: "",
      status: "Open",
      rootCause: "",
      correctiveAction: "",
      targetDate: "",
    });
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      projectId: item.projectId,
      type: item.type,
      severity: item.severity,
      category: item.category,
      issueDescription: item.issueDescription,
      location: item.location || "",
      reportedDate: item.reportedDate,
      reportedBy: item.reportedBy,
      assignedTo: item.assignedTo || "",
      status: item.status,
      rootCause: item.rootCause || "",
      correctiveAction: item.correctiveAction || "",
      targetDate: item.targetDate || "",
    });
    setIsModalOpen(true);
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-red-100 text-red-700";
      case "Major":
        return "bg-orange-100 text-orange-700";
      case "Minor":
        return "bg-info-muted text-blue-700";
      default:
        return "bg-surface-raised text-text-secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4 bg-surface-card px-4 py-2 rounded-xl border border-border-subtle shadow-sm w-96">
          <Search className="w-4 h-4 text-text-disabled" />
          <input
            type="text"
            placeholder="Search Observation/NCR..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              resetForm();
              setFormData({ ...formData, type: "Observation" });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-blue-200 font-bold"
          >
            <Plus className="w-4 h-4" /> New Observation
          </button>
          <button
            onClick={() => {
              resetForm();
              setFormData({ ...formData, type: "NCR" });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 font-bold"
          >
            <AlertCircle className="w-4 h-4" /> Raise NCR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {records.map((item) => (
          <div
            key={item.id}
            className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm p-6 hover:shadow-md transition-all flex flex-col md:flex-row gap-6 relative"
          >
            <div
              className={`w-1.5 absolute left-0 top-0 bottom-0 rounded-l-2xl ${item.type === "NCR" ? "bg-error" : "bg-primary"}`}
            />

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${item.type === "NCR" ? "bg-error-muted text-error" : "bg-primary-muted text-primary"}`}
                >
                  {item.type}
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${getSeverityStyle(item.severity)}`}
                >
                  {item.severity}
                </span>
                <span className="text-xs font-bold text-text-disabled">
                  • {item.category}
                </span>
              </div>

              <h3 className="text-lg font-bold text-text-primary">
                {item.issueDescription}
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <MapPin className="w-4 h-4" />{" "}
                  {item.location || "No Location"}
                </div>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Calendar className="w-4 h-4" /> {item.reportedDate}
                </div>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <User className="w-4 h-4" /> {item.reportedBy}
                </div>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Tag className="w-4 h-4" /> {item.status}
                </div>
              </div>

              {item.correctiveAction && (
                <div className="bg-surface-base p-4 rounded-xl border border-border-subtle mt-2">
                  <p className="text-xs font-bold text-text-disabled uppercase mb-1">
                    Corrective Action
                  </p>
                  <p className="text-sm text-text-secondary">
                    {item.correctiveAction}
                  </p>
                </div>
              )}
            </div>

            <div className="flex md:flex-col justify-end gap-2 border-t md:border-t-0 md:border-l border-gray-50 pt-4 md:pt-0 md:pl-6 md:w-32">
              <button
                onClick={() => openEditModal(item)}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-primary hover:bg-primary-muted rounded-lg transition-all"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-error hover:bg-error-muted rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-surface-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-surface-base">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {formData.type === "NCR" ? (
                  <AlertCircle className="w-5 h-5 text-error" />
                ) : (
                  <Eye className="w-5 h-5 text-primary" />
                )}
                {editingItem ? `Edit ${formData.type}` : `New ${formData.type}`}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="p-6 grid grid-cols-2 gap-4"
            >
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Type
                </label>
                <select
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                >
                  <option value="Observation">Quality Observation</option>
                  <option value="NCR">Non-Conformance Report (NCR)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Severity
                </label>
                <select
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.severity}
                  onChange={(e) =>
                    setFormData({ ...formData, severity: e.target.value })
                  }
                >
                  <option value="Minor">Minor</option>
                  <option value="Major">Major</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Issue Description
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.issueDescription}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      issueDescription: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Category
                </label>
                <select
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                >
                  <option value="Structural">Structural</option>
                  <option value="Architectural">Architectural</option>
                  <option value="MEP">MEP</option>
                  <option value="Finishes">Finishes</option>
                  <option value="External Works">External Works</option>
                  <option value="Materials">Materials</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Location
                </label>
                <input
                  type="text"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Status
                </label>
                <select
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Verified">Verified</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.targetDate}
                  onChange={(e) =>
                    setFormData({ ...formData, targetDate: e.target.value })
                  }
                />
              </div>
              {formData.type === "NCR" && (
                <>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                      Root Cause
                    </label>
                    <textarea
                      rows={2}
                      className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                      value={formData.rootCause}
                      onChange={(e) =>
                        setFormData({ ...formData, rootCause: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                      Corrective Action
                    </label>
                    <textarea
                      rows={2}
                      className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                      value={formData.correctiveAction}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          correctiveAction: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Reported By
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.reportedBy}
                  onChange={(e) =>
                    setFormData({ ...formData, reportedBy: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Assigned To
                </label>
                <input
                  type="text"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.assignedTo}
                  onChange={(e) =>
                    setFormData({ ...formData, assignedTo: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2 mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-raised transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-8 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all ${formData.type === "NCR" ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-primary hover:bg-primary-dark shadow-blue-200"}`}
                >
                  {editingItem ? "Update" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityObservationNcr;
