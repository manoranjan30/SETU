import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  ShieldCheck,
  User,
  Calendar,
} from "lucide-react";
import api from "../../../api/axios";

interface Props {
  projectId: number;
}

const QualityAudit: React.FC<Props> = ({ projectId }) => {
  const [audits, setAudits] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    projectId,
    auditType: "Internal",
    auditorName: "",
    auditDate: new Date().toISOString().split("T")[0],
    scope: "",
    findings: "",
    nonConformancesCount: 0,
    observationsCount: 0,
    status: "Completed",
  });

  const fetchAudits = async () => {
    try {
      const response = await api.get(`/quality/${projectId}/audits`);
      setAudits(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/quality/audits/${editingItem.id}`, formData);
      } else {
        await api.post("/quality/audits", formData);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      resetForm();
      fetchAudits();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this audit record?")) return;
    try {
      await api.delete(`/quality/audits/${id}`);
      fetchAudits();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      projectId,
      auditType: "Internal",
      auditorName: "",
      auditDate: new Date().toISOString().split("T")[0],
      scope: "",
      findings: "",
      nonConformancesCount: 0,
      observationsCount: 0,
      status: "Completed",
    });
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      projectId: item.projectId,
      auditType: item.auditType,
      auditorName: item.auditorName,
      auditDate: item.auditDate,
      scope: item.scope,
      findings: item.findings || "",
      nonConformancesCount: item.nonConformancesCount,
      observationsCount: item.observationsCount,
      status: item.status,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4 bg-surface-card px-4 py-2 rounded-xl border border-border-subtle shadow-sm w-96">
          <Search className="w-4 h-4 text-text-disabled" />
          <input
            type="text"
            placeholder="Search quality audits..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full"
          />
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 uppercase tracking-wider text-xs font-black"
        >
          <Plus className="w-4 h-4" /> Log Audit Record
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {audits.map((audit) => (
          <div
            key={audit.id}
            className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm p-6 hover:shadow-md transition-all flex items-center gap-6 group"
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${audit.nonConformancesCount > 0 ? "bg-error-muted text-error" : "bg-success-muted text-success"}`}
            >
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="flex-1 grid grid-cols-4 gap-4 items-center">
              <div className="col-span-1">
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${audit.auditType === "External" ? "bg-purple-50 text-purple-600" : "bg-primary-muted text-primary"}`}
                >
                  {audit.auditType} Audit
                </span>
                <h4 className="font-bold text-text-primary mt-1">
                  {audit.scope}
                </h4>
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-disabled uppercase mb-1">
                  Auditor
                </p>
                <div className="flex items-center gap-2 text-sm text-text-secondary font-bold">
                  <User className="w-4 h-4 text-text-disabled" />{" "}
                  {audit.auditorName}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-disabled uppercase mb-1">
                  Date
                </p>
                <div className="flex items-center gap-2 text-sm text-text-secondary font-bold">
                  <Calendar className="w-4 h-4 text-text-disabled" />{" "}
                  {audit.auditDate}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-text-disabled uppercase">
                    NCRs
                  </p>
                  <p
                    className={`text-lg font-black ${audit.nonConformancesCount > 0 ? "text-error" : "text-success"}`}
                  >
                    {audit.nonConformancesCount}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-text-disabled uppercase">
                    Obs
                  </p>
                  <p className="text-lg font-black text-primary">
                    {audit.observationsCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={() => openEditModal(audit)}
                className="p-2 hover:bg-surface-raised rounded-lg text-text-disabled hover:text-primary"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(audit.id)}
                className="p-2 hover:bg-surface-raised rounded-lg text-text-disabled hover:text-error"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen &&
        createPortal(
        <div className="fixed inset-0 bg-surface-overlay backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-surface-base">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-600" />
                {editingItem ? "Edit Audit Record" : "Log New Quality Audit"}
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
                  Audit Type
                </label>
                <select
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.auditType}
                  onChange={(e) =>
                    setFormData({ ...formData, auditType: e.target.value })
                  }
                >
                  <option value="Internal">Internal Quality Audit</option>
                  <option value="External">External ISO Audit</option>
                  <option value="Client">Client / Consultant Audit</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Auditor Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.auditorName}
                  onChange={(e) =>
                    setFormData({ ...formData, auditorName: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Scope of Audit
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Structural Works - Block A"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.scope}
                  onChange={(e) =>
                    setFormData({ ...formData, scope: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Major Findings
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.findings}
                  onChange={(e) =>
                    setFormData({ ...formData, findings: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Total NCRs Found
                </label>
                <input
                  type="number"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.nonConformancesCount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nonConformancesCount: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Total Observations
                </label>
                <input
                  type="number"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.observationsCount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      observationsCount: parseInt(e.target.value),
                    })
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
                  className="px-8 py-2.5 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all"
                >
                  {editingItem ? "Update Audit" : "Save Audit Record"}
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
};

export default QualityAudit;
