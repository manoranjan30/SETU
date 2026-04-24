import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  FileText,
  Download,
  Calendar,
  HardDrive,
} from "lucide-react";
import api from "../../../api/axios";

interface Props {
  projectId: number;
}

const QualityDocuments: React.FC<Props> = ({ projectId }) => {
  const [docs, setDocs] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    projectId,
    documentType: "Shop Drawing",
    documentName: "",
    referenceNumber: "",
    revision: "0",
    submissionDate: new Date().toISOString().split("T")[0],
    approvalDate: "",
    status: "Approved",
  });

  const fetchDocs = async () => {
    try {
      const response = await api.get(`/quality/${projectId}/documents`);
      setDocs(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/quality/documents/${editingItem.id}`, formData);
      } else {
        await api.post("/quality/documents", formData);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      resetForm();
      fetchDocs();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.delete(`/quality/documents/${id}`);
      fetchDocs();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      projectId,
      documentType: "Shop Drawing",
      documentName: "",
      referenceNumber: "",
      revision: "0",
      submissionDate: new Date().toISOString().split("T")[0],
      approvalDate: "",
      status: "Approved",
    });
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      projectId: item.projectId,
      documentType: item.documentType,
      documentName: item.documentName,
      referenceNumber: item.referenceNumber,
      revision: item.revision || "0",
      submissionDate: item.submissionDate || "",
      approvalDate: item.approvalDate || "",
      status: item.status,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 text-text-primary">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4 bg-surface-card px-4 py-2 rounded-xl border border-border-subtle shadow-sm w-96">
          <Search className="w-4 h-4 text-text-disabled" />
          <input
            type="text"
            placeholder="Search quality documents..."
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
          <Plus className="w-4 h-4" /> Add Document
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm p-5 hover:shadow-md transition-all flex items-start gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-50 px-2 py-0.5 rounded italic">
                  Rev {doc.revision}
                </span>
                <span className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">
                  • {doc.documentType}
                </span>
              </div>
              <h4 className="font-bold text-text-primary truncate">
                {doc.documentName}
              </h4>
              <p className="text-xs text-text-disabled font-medium mb-3">
                {doc.referenceNumber}
              </p>

              <div className="flex items-center gap-4 border-t border-gray-50 pt-3">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-text-disabled uppercase">
                  <Calendar className="w-3 h-3" /> Sub: {doc.submissionDate}
                </div>
                <div
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${doc.status === "Approved" ? "bg-success-muted text-success" : "bg-orange-50 text-orange-600"}`}
                >
                  {doc.status}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button className="p-2 hover:bg-orange-50 text-orange-600 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
              </button>
              <div className="opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-1">
                <button
                  onClick={() => openEditModal(doc)}
                  className="p-2 hover:bg-surface-raised rounded-lg text-text-disabled hover:text-primary"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 hover:bg-surface-raised rounded-lg text-text-disabled hover:text-error"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
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
                <HardDrive className="w-5 h-5 text-orange-600" />
                {editingItem ? "Edit Document" : "Register Quality Document"}
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
              className="p-6 grid grid-cols-2 gap-4 text-text-primary"
            >
              <div className="col-span-2">
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Document Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.documentName}
                  onChange={(e) =>
                    setFormData({ ...formData, documentName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.referenceNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      referenceNumber: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Type
                </label>
                <select
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.documentType}
                  onChange={(e) =>
                    setFormData({ ...formData, documentType: e.target.value })
                  }
                >
                  <option value="Shop Drawing">Shop Drawing</option>
                  <option value="RFI">Request for Information (RFI)</option>
                  <option value="Method Statement">Method Statement</option>
                  <option value="Material Approval">Material Approval</option>
                  <option value="Test Report">Test Report</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Revision
                </label>
                <input
                  type="text"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.revision}
                  onChange={(e) =>
                    setFormData({ ...formData, revision: e.target.value })
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
                  <option value="Under Review">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Approved with Comments">
                    Approved with Comments
                  </option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Submission Date
                </label>
                <input
                  type="date"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.submissionDate}
                  onChange={(e) =>
                    setFormData({ ...formData, submissionDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Approval Date
                </label>
                <input
                  type="date"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.approvalDate}
                  onChange={(e) =>
                    setFormData({ ...formData, approvalDate: e.target.value })
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
                  {editingItem ? "Update Document" : "Save Document"}
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

export default QualityDocuments;
