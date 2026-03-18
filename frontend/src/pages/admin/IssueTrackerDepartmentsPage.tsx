import { useEffect, useState } from "react";
import {
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
  Check,
} from "lucide-react";
import {
  issueTrackerService,
  type GlobalDepartment,
} from "../../services/issueTracker.service";

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#d97706", "#059669", "#0891b2",
];

export default function IssueTrackerDepartmentsPage() {
  const [departments, setDepartments] = useState<GlobalDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    color: "#2563eb",
    icon: "",
    defaultSlaDays: "",
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await issueTrackerService.listGlobalDepartments();
      setDepartments(data);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", description: "", color: "#2563eb", icon: "", defaultSlaDays: "" });
    setShowForm(true);
  };

  const openEdit = (d: GlobalDepartment) => {
    setEditingId(d.id);
    setForm({
      name: d.name,
      description: d.description || "",
      color: d.color || "#2563eb",
      icon: d.icon || "",
      defaultSlaDays: d.defaultSlaDays ? String(d.defaultSlaDays) : "",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: form.color || undefined,
      icon: form.icon.trim() || undefined,
      defaultSlaDays: form.defaultSlaDays ? parseInt(form.defaultSlaDays) : undefined,
    };
    if (editingId) {
      await issueTrackerService.updateGlobalDepartment(editingId, payload);
    } else {
      await issueTrackerService.createGlobalDepartment(payload);
    }
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("Deactivate this department?")) return;
    await issueTrackerService.deleteGlobalDepartment(id);
    load();
  };

  // Drag-and-drop reorder
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newDepts = [...departments];
    const [moved] = newDepts.splice(dragIndex, 1);
    newDepts.splice(index, 0, moved);
    setDepartments(newDepts);
    setDragIndex(index);
  };
  const handleDrop = async () => {
    if (dragIndex === null) return;
    setDragIndex(null);
    await issueTrackerService.reorderGlobalDepartments(departments.map((d) => d.id));
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Issue Tracker Departments</h1>
          <p className="text-sm text-text-muted mt-1">
            Global departments — define once, assign to any project. Drag to reorder the default flow.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> Add Department
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-text-muted">Loading…</div>
      ) : (
        <div className="space-y-2">
          {departments.map((dept, index) => (
            <div
              key={dept.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              className={`flex items-center gap-3 p-4 bg-surface-card border border-border rounded-xl cursor-grab
                ${!dept.isActive ? "opacity-50" : ""}`}
            >
              <GripVertical size={16} className="text-text-muted shrink-0" />
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: dept.color || "#94a3b8" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{dept.name}</span>
                  {!dept.isActive && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inactive</span>
                  )}
                  {dept.defaultSlaDays && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                      SLA: {dept.defaultSlaDays}d
                    </span>
                  )}
                </div>
                {dept.description && (
                  <p className="text-xs text-text-muted mt-0.5 truncate">{dept.description}</p>
                )}
              </div>
              <span className="text-xs text-text-muted">#{index + 1}</span>
              <button
                onClick={() => openEdit(dept)}
                className="p-1.5 text-text-muted hover:text-blue-600 rounded"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => remove(dept.id)}
                className="p-1.5 text-text-muted hover:text-red-500 rounded"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {departments.length === 0 && (
            <div className="text-center py-12 text-text-muted">
              No departments yet. Create the first one.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text-primary">
                {editingId ? "Edit Department" : "New Department"}
              </h2>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Name *</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Civil Works"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 ${form.color === c ? "border-gray-800" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Default SLA (days)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none"
                  value={form.defaultSlaDays}
                  onChange={(e) => setForm({ ...form, defaultSlaDays: e.target.value })}
                  placeholder="e.g. 7"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={save}
                disabled={!form.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Check size={16} /> {editingId ? "Save Changes" : "Create Department"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-page"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
