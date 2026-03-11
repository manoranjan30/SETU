import React, { useState, useEffect } from "react";
import {
  Plus,
  AlertCircle,
  MapPin,
  Search,
  ShieldAlert,
  CheckCircle2,
  X,
} from "lucide-react";
import api from "../../../api/axios";

interface Props {
  projectId: number;
}

const INCIDENT_TYPES = [
  "NEAR_MISS",
  "FAC",
  "MTC",
  "LTI",
  "PROPERTY_DAMAGE",
  "ENVIRONMENTAL",
];

const EhsIncidents: React.FC<Props> = ({ projectId }) => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    incidentDate: new Date().toISOString().split("T")[0],
    incidentType: INCIDENT_TYPES[0],
    location: "",
    description: "",
    immediateCause: "",
    firstAidGiven: false,
    hospitalVisit: false,
  });

  useEffect(() => {
    fetchIncidents();
  }, [projectId]);

  const fetchIncidents = async () => {
    try {
      const response = await api.get(`/ehs/${projectId}/incidents`);
      setIncidents(response.data);
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/ehs/${projectId}/incidents`, formData);
      setShowModal(false);
      fetchIncidents();
    } catch (error) {
      console.error("Error creating incident:", error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "LTI":
        return "bg-black text-white";
      case "MTC":
        return "bg-red-600 text-white";
      case "FAC":
        return "bg-orange-500 text-white";
      case "NEAR_MISS":
        return "bg-yellow-400 text-text-primary";
      case "ENVIRONMENTAL":
        return "bg-green-600 text-white";
      default:
        return "bg-gray-600 text-white";
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
              placeholder="Search incidents..."
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
        >
          <Plus className="w-5 h-5" />
          Report Incident
        </button>
      </div>

      {/* List */}
      <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-base/50 border-b">
              <th className="px-6 py-4 text-[10px] font-black uppercase text-text-disabled tracking-widest">
                Type / Date
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-text-disabled tracking-widest">
                Description & Location
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-text-disabled tracking-widest text-center">
                Severity
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-text-disabled tracking-widest">
                Investigation
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-text-disabled tracking-widest text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {incidents.map((inc) => (
              <tr
                key={inc.id}
                className="hover:bg-surface-base/80 transition-colors group"
              >
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span
                      className={`w-fit px-2 py-0.5 rounded text-[10px] font-black mb-1 ${getTypeColor(inc.incidentType)}`}
                    >
                      {inc.incidentType}
                    </span>
                    <span className="text-sm font-bold text-text-primary">
                      {new Date(inc.incidentDate).toLocaleDateString()}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <p className="text-sm font-bold text-text-primary line-clamp-1">
                    {inc.description}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-text-muted">
                    <MapPin className="w-3 h-3" />
                    {inc.location}
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="flex justify-center flex-col items-center gap-1">
                    <ShieldAlert
                      className={`w-5 h-5 ${inc.incidentType === "LTI" ? "text-black" : inc.incidentType === "MTC" ? "text-error" : "text-orange-500"}`}
                    />
                    <span className="text-[10px] font-black uppercase text-text-disabled tracking-tight">
                      Level {inc.incidentType === "LTI" ? 4 : 3}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5 ${inc.investigationStatus === "COMPLETE" ? "bg-success-muted text-success" : "bg-primary-muted text-primary"}`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${inc.investigationStatus === "COMPLETE" ? "bg-success" : "bg-primary"}`}
                      />
                      {inc.investigationStatus}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                  <button className="text-xs font-black uppercase text-primary hover:underline">
                    View Case
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidents.length === 0 && !loading && (
          <div className="py-24 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-100 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text-primary">
              No incidents reported
            </h3>
            <p className="text-text-muted max-w-xs mx-auto mt-1">
              Excellent safety record! No active incidents logged for this
              project.
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-card w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b flex justify-between items-center bg-error-muted/30">
              <div>
                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-error" />
                  Incident Report
                </h3>
                <p className="text-sm text-text-muted mt-0.5">
                  Report an accident, near miss or hazard
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-surface-raised rounded-full transition-colors"
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
                    Date of Incident
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-red-600/10 outline-none"
                    value={formData.incidentDate}
                    onChange={(e) =>
                      setFormData({ ...formData, incidentDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Incident Type
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-red-600/10 outline-none appearance-none font-bold text-text-secondary"
                    value={formData.incidentType}
                    onChange={(e) =>
                      setFormData({ ...formData, incidentType: e.target.value })
                    }
                  >
                    {INCIDENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                  Location of Incident
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tower 1, Lobby Area"
                  className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-red-600/10 outline-none"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                  Brief Description
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="What happened? Describe the event..."
                  className="w-full px-4 py-4 bg-surface-base border-none rounded-3xl focus:ring-2 focus:ring-red-600/10 outline-none resize-none"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                  Immediate Cause
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Equipment failure, Slippery floor"
                  className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-red-600/10 outline-none"
                  value={formData.immediateCause}
                  onChange={(e) =>
                    setFormData({ ...formData, immediateCause: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-8 p-4 bg-surface-base rounded-2xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-border-strong text-error focus:ring-red-600"
                    checked={formData.firstAidGiven}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firstAidGiven: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm font-bold text-text-secondary">
                    First Aid Given?
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-border-strong text-error focus:ring-red-600"
                    checked={formData.hospitalVisit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hospitalVisit: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm font-bold text-text-secondary">
                    Hospital Visit Required?
                  </span>
                </label>
              </div>
            </form>
            <div className="px-8 py-6 bg-surface-base border-t flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 text-sm font-black uppercase text-text-muted hover:text-text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 bg-red-600 text-white px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-200"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EhsIncidents;
