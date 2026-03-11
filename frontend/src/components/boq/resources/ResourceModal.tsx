import React, { useState, useEffect } from "react";
import { X, Save, Package } from "lucide-react";
import api from "../../../api/axios";

interface ResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "create" | "edit";
  resourceToEdit?: any;
}

const ResourceModal: React.FC<ResourceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
  resourceToEdit,
}) => {
  const [formData, setFormData] = useState({
    resourceName: "",
    uom: "Unit",
    resourceType: "MATERIAL",
    standardRate: 0,
    category: "",
    specification: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "edit" && resourceToEdit) {
      setFormData({
        resourceName: resourceToEdit.resourceName || "",
        uom: resourceToEdit.uom || "Unit",
        resourceType: resourceToEdit.resourceType || "MATERIAL",
        standardRate: resourceToEdit.standardRate || 0,
        category: resourceToEdit.category || "",
        specification: resourceToEdit.specification || "",
      });
    } else {
      setFormData({
        resourceName: "",
        uom: "Unit",
        resourceType: "MATERIAL",
        standardRate: 0,
        category: "",
        specification: "",
      });
    }
    setError("");
  }, [mode, resourceToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "create") {
        await api.post("/resources/master", formData);
      } else {
        await api.put(`/resources/master/${resourceToEdit.id}`, formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save resource");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-overlay flex justify-center items-center z-50 p-4">
      <div className="bg-surface-card rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-surface-base border-b px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 text-secondary rounded-lg flex items-center justify-center">
              <Package size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              {mode === "create" ? "Add New Resource" : "Edit Resource"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 transition-colors hover:bg-slate-200 rounded-full text-text-disabled hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-error-muted border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-text-secondary mb-1">
                Resource Name *
              </label>
              <input
                type="text"
                value={formData.resourceName}
                onChange={(e) =>
                  setFormData({ ...formData, resourceName: e.target.value })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all"
                placeholder="e.g. Portland Cement 53 Grade"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-1">
                UOM *
              </label>
              <input
                type="text"
                value={formData.uom}
                onChange={(e) =>
                  setFormData({ ...formData, uom: e.target.value })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all"
                placeholder="e.g. Cum, Kg, Bag"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-1">
                Resource Type *
              </label>
              <select
                value={formData.resourceType}
                onChange={(e) =>
                  setFormData({ ...formData, resourceType: e.target.value })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all"
                required
              >
                <option value="MATERIAL">MATERIAL</option>
                <option value="LABOR">LABOR</option>
                <option value="PLANT">PLANT</option>
                <option value="SUBCONTRACT">SUBCONTRACT</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-1">
                Standard Rate
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-text-disabled">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.standardRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      standardRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2.5 focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all"
                placeholder="e.g. Civil, Finishing"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-text-secondary mb-1">
                Specification
              </label>
              <textarea
                value={formData.specification}
                onChange={(e) =>
                  setFormData({ ...formData, specification: e.target.value })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all h-24 resize-none"
                placeholder="Enter technical details, grade, or manufacturer specs..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-slate-600 font-medium hover:bg-surface-base border border-transparent hover:border-border-default rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-white bg-secondary font-bold rounded-lg hover:bg-secondary-dark disabled:opacity-50 shadow-lg shadow-indigo-600/20 flex items-center gap-2 transform active:scale-95 transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {mode === "create" ? "Create Resource" : "Save Changes"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResourceModal;
