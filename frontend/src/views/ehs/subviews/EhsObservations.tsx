import React, { useState, useEffect } from "react";
import {
  Plus,
  Filter,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Camera,
  MapPin,
  Calendar,
  X,
  UserCircle2,
} from "lucide-react";
import api from "../../../api/axios";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/api\/?$/, "");
const getFileUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
};

interface Props {
  projectId: number;
}

const CATEGORIES = [
  "Scaffolding & Platform",
  "Working at Heights",
  "Electrical Safety",
  "Excavation & Trenching",
  "Crane & Lifting",
  "Fire Safety",
  "PPE Compliance",
  "Housekeeping",
  "Chemical Handling",
];

const SEVERITIES = ["CRITICAL", "SERIOUS", "MINOR", "NEGLIGIBLE"];
const TYPES = ["UNSAFE_ACT", "UNSAFE_CONDITION", "GOOD_PRACTICE"];

const EhsObservations: React.FC<Props> = ({ projectId }) => {
  const [observations, setObservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: CATEGORIES[0],
    observationType: TYPES[1],
    severity: SEVERITIES[2],
    location: "",
    description: "",
    targetDate: "",
  });

  useEffect(() => {
    fetchObservations();
  }, [projectId]);

  const fetchObservations = async () => {
    try {
      const response = await api.get(`/ehs/${projectId}/observations`);
      setObservations(response.data);
    } catch (error) {
      console.error("Error fetching observations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/ehs/${projectId}/observations`, formData);
      setShowModal(false);
      fetchObservations();
      setFormData({
        date: new Date().toISOString().split("T")[0],
        category: CATEGORIES[0],
        observationType: TYPES[1],
        severity: SEVERITIES[2],
        location: "",
        description: "",
        targetDate: "",
      });
    } catch (error) {
      console.error("Error creating observation:", error);
    }
  };

  const getSeverityColor = (s: string) => {
    switch (s) {
      case "CRITICAL":
        return "bg-red-100 text-red-700 border-red-200";
      case "SERIOUS":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "MINOR":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-green-100 text-green-700 border-green-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "CLOSED":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "IN_PROGRESS":
        return <Clock className="w-4 h-4 text-primary" />;
      default:
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-card p-4 rounded-xl border border-border-subtle shadow-sm">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled w-4 h-4" />
            <input
              type="text"
              placeholder="Search observations..."
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <button className="p-2 border rounded-lg hover:bg-surface-base text-text-secondary transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5" />
          Report Observation
        </button>
      </div>

      {/* Observations List */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {observations.map((obs) => (
          <div
            key={obs.id}
            className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2 items-center">
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${getSeverityColor(obs.severity)}`}
                  >
                    {obs.severity}
                  </span>
                  <span className="px-2 py-1 bg-surface-raised text-text-secondary border border-border-default rounded text-[10px] font-black uppercase tracking-wider">
                    {obs.observationType.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-text-disabled">
                  {getStatusIcon(obs.status)}
                  {obs.status.replace("_", " ")}
                </div>
              </div>

              <h4 className="text-lg font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">
                {obs.category}
              </h4>
              <p className="text-text-secondary text-sm mb-6 line-clamp-2">
                {obs.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-xs font-medium text-text-muted bg-surface-base/50 p-4 rounded-xl">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-text-disabled" />
                  {obs.location}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-text-disabled" />
                  {new Date(obs.date).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <UserCircle2 className="w-3.5 h-3.5 text-text-disabled" />
                  By: {obs.reportedBy?.firstName || "User"}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-text-disabled" />
                  Target:{" "}
                  {obs.targetDate
                    ? new Date(obs.targetDate).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-surface-base border-t flex justify-between items-center">
              <div className="flex items-center gap-2">
                {obs.photos && obs.photos.length > 0 ? (
                  <div className="flex gap-1">
                    {obs.photos.slice(0, 3).map((p: string, i: number) => (
                      <a key={i} href={getFileUrl(p)} target="_blank" rel="noopener noreferrer">
                        <img
                          src={getFileUrl(p)}
                          alt="observation"
                          className="w-8 h-8 rounded object-cover border border-border-default"
                        />
                      </a>
                    ))}
                    {obs.photos.length > 3 && (
                      <div className="w-8 h-8 rounded bg-surface-raised border border-border-default flex items-center justify-center text-[10px] text-text-muted font-bold">
                        +{obs.photos.length - 3}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-text-disabled italic flex items-center gap-1">
                    <Camera className="w-3 h-3" /> No image
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button className="text-xs font-bold text-primary hover:underline uppercase tracking-tight">
                  Post Action
                </button>
                <div className="w-px h-4 bg-gray-200" />
                <button className="text-xs font-bold text-text-disabled hover:text-text-secondary uppercase tracking-tight">
                  Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {observations.length === 0 && !loading && (
        <div className="py-32 text-center bg-surface-card rounded-3xl border-2 border-dashed border-border-subtle">
          <div className="w-20 h-20 bg-primary-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Eye className="w-10 h-10 text-primary opacity-50" />
          </div>
          <h3 className="text-xl font-bold text-text-primary">
            All clear! No observations recorded
          </h3>
          <p className="text-text-muted mt-2 max-w-sm mx-auto">
            Safety is our priority. Click "Report Observation" to log any unsafe
            act or condition you see on site.
          </p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-card w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b flex justify-between items-center bg-surface-base/50">
              <div>
                <h3 className="text-xl font-black text-text-primary">
                  Report Observation
                </h3>
                <p className="text-sm text-text-muted">
                  Capture safety details from the field
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-text-disabled" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="p-8 space-y-6 max-h-[70vh] overflow-auto"
            >
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-text-secondary"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Category
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-text-secondary appearance-none"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Type
                  </label>
                  <div className="flex gap-2">
                    {TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, observationType: t })
                        }
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-tight rounded-xl transition-all border ${formData.observationType === t ? "bg-primary text-white border-primary shadow-md shadow-primary/20" : "bg-surface-base text-text-muted border-transparent hover:bg-surface-raised"}`}
                      >
                        {t.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Severity
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-text-secondary appearance-none"
                    value={formData.severity}
                    onChange={(e) =>
                      setFormData({ ...formData, severity: e.target.value })
                    }
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                  Location / Specific Area
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Block B, 4th Floor Shaft"
                  className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-text-secondary placeholder:text-gray-300"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                  Description of Observation
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide details about what you observed..."
                  className="w-full px-4 py-4 bg-surface-base border-none rounded-3xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-text-secondary placeholder:text-gray-300 resize-none"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-6 pb-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Target Closure Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-text-secondary"
                    value={formData.targetDate}
                    onChange={(e) =>
                      setFormData({ ...formData, targetDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Photo (Upload)
                  </label>
                  <div className="h-[52px] w-full px-4 flex items-center gap-3 bg-surface-base border-2 border-dashed border-border-default rounded-2xl cursor-pointer hover:bg-surface-raised transition-colors group">
                    <Camera className="w-5 h-5 text-text-disabled group-hover:text-primary" />
                    <span className="text-sm font-bold text-text-disabled group-hover:text-text-secondary">
                      Click to upload photo
                    </span>
                  </div>
                </div>
              </div>
            </form>
            <div className="px-8 py-6 bg-surface-base border-t flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-3 text-sm font-black uppercase text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 bg-primary text-white px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-primary-dark transition-all shadow-xl shadow-primary/30"
              >
                Submit Observation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EhsObservations;
