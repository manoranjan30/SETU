import { useState, useEffect } from "react";
import { X, Users, Calendar, Plus } from "lucide-react";
import api from "../../api/axios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSave: () => void;
  categories: any[];
}

const LaborEntryModal = ({
  isOpen,
  onClose,
  projectId,
  onSave,
  categories,
}: Props) => {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [contractor, setContractor] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && categories.length > 0) {
      // Pre-fill with all categories with 0 count
      setEntries(
        categories.map((c) => ({
          categoryId: c.id,
          categoryName: c.name,
          count: "",
        })),
      );
    }
  }, [isOpen, categories]);

  const updateCount = (idx: number, value: string) => {
    const next = [...entries];
    next[idx].count = value;
    setEntries(next);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user?.id;

      if (!userId) {
        alert("User session not found. Please log in again.");
        return;
      }

      const validEntries = entries
        .filter((e) => parseFloat(e.count) > 0)
        .map((e) => ({
          date,
          contractorName: contractor,
          categoryId: e.categoryId,
          count: parseFloat(e.count),
        }));

      if (validEntries.length === 0) {
        alert("Please enter at least one labor count.");
        return;
      }

      await api.post(`/labor/presence/${projectId}`, {
        entries: validEntries,
        userId,
      });
      onSave();
      onClose();
    } catch (err) {
      console.error("Failed to save labor entries", err);
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
            <div className="p-2 bg-secondary text-white rounded-lg shadow-lg shadow-indigo-100">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">
                Daily Labor Entry
              </h3>
              <p className="text-xs text-text-disabled font-bold uppercase tracking-widest">
                Manual Register Update
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-card rounded-xl text-text-disabled transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 bg-surface-base border-b border-slate-100 grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">
              Presence Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface-card border-border-default rounded-xl pl-10 pr-4 py-2 text-sm font-bold text-text-secondary"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">
              Contractor / Agency
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
              <input
                type="text"
                placeholder="e.g. Acme Civil Works"
                value={contractor}
                onChange={(e) => setContractor(e.target.value)}
                className="w-full bg-surface-card border-border-default rounded-xl pl-10 pr-4 py-2 text-sm font-bold text-text-secondary focus:ring-2 ring-indigo-50"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {entries.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-surface-base border border-slate-100 rounded-2xl group hover:border-indigo-100 hover:bg-secondary-muted/20 transition-all"
              >
                <span className="text-sm font-bold text-slate-600 group-hover:text-secondary">
                  {entry.categoryName}
                </span>
                <input
                  type="number"
                  placeholder="0"
                  value={entry.count}
                  onChange={(e) => updateCount(idx, e.target.value)}
                  className="w-20 bg-surface-card border-border-default rounded-xl px-3 py-1.5 text-right font-black text-slate-800 focus:ring-2 ring-indigo-100 outline-none"
                />
              </div>
            ))}
          </div>
          {entries.length === 0 && (
            <div className="text-center py-10">
              <p className="text-text-disabled text-sm font-bold">
                No categories defined. Please setup Categories Master first.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-surface-base/50 rounded-b-3xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-text-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-8 py-2.5 bg-secondary text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-secondary-dark transition-all"
          >
            {loading ? "Submitting..." : "Submit Entry"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LaborEntryModal;
