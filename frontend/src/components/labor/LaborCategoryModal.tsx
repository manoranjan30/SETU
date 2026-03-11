import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, Layers } from "lucide-react";
import api from "../../api/axios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSave: () => void;
}

const LaborCategoryModal = ({ isOpen, onClose, projectId, onSave }: Props) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) fetchCategories();
  }, [isOpen, projectId]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/labor/categories?projectId=${projectId}`);
      setCategories(res.data);
    } catch (err) {
      console.error("Failed to fetch categories", err);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = () => {
    setCategories([
      ...categories,
      { name: "", categoryGroup: "Skilled", projectId: parseInt(projectId) },
    ]);
  };

  const removeCategory = (index: number) => {
    const next = [...categories];
    next.splice(index, 1);
    setCategories(next);
  };

  const updateCategory = (index: number, field: string, value: string) => {
    const next = [...categories];
    next[index][field] = value;
    setCategories(next);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.post("/labor/categories", categories);
      onSave();
      onClose();
    } catch (err) {
      console.error("Failed to save categories", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-card rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-surface-base/50 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-secondary rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">
                Labor Categories Master
              </h3>
              <p className="text-xs text-text-disabled font-bold uppercase tracking-widest">
                Define trades for this project
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-card rounded-xl text-text-disabled transition-all border border-transparent hover:border-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {categories.map((cat, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 group animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <input
                type="text"
                value={cat.name}
                onChange={(e) => updateCategory(idx, "name", e.target.value)}
                placeholder="Category Name (e.g. Painter)"
                className="flex-1 bg-surface-base border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold text-text-secondary focus:ring-2 ring-indigo-100 transition-all"
              />
              <select
                value={cat.categoryGroup || "Skilled"}
                onChange={(e) =>
                  updateCategory(idx, "categoryGroup", e.target.value)
                }
                className="bg-surface-base border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold text-text-muted focus:ring-2 ring-indigo-100 min-w-[140px]"
              >
                <option value="Skilled">Skilled</option>
                <option value="Semi-Skilled">Semi-Skilled</option>
                <option value="Unskilled">Unskilled</option>
                <option value="Supervisory">Supervisory</option>
              </select>
              <button
                onClick={() => removeCategory(idx)}
                className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            onClick={addCategory}
            className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center gap-2 text-text-disabled hover:text-secondary hover:border-indigo-200 hover:bg-secondary-muted/30 transition-all font-bold text-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Category
          </button>
        </div>

        <div className="p-6 border-t border-slate-100 bg-surface-base/50 rounded-b-3xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-text-muted hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-8 py-2.5 bg-secondary text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-secondary-dark transition-all flex items-center gap-2"
          >
            {loading ? (
              "Saving..."
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Master
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LaborCategoryModal;
