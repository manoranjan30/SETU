import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Edit2,
  Trash2,
  Check,
  ArrowLeft,
  AlertCircle,
  ShieldAlert,
  Eye,
  Scissors,
  Save,
  ChevronRight,
  List,
  Network,
  ClipboardList,
  X,
} from "lucide-react";
import api from "../../api/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  id: number;
  sequence: number;
  activityName: string;
  description: string;
  previousActivityId: number | null;
  incomingEdges?: { sourceId: number; source: Partial<Activity> }[];
  predecessorIds?: number[];
  holdPoint: boolean;
  witnessPoint: boolean;
  responsibleParty: string;
  allowBreak: boolean;
  applicabilityLevel: "FLOOR" | "UNIT" | "ROOM";
  status: string;
  assignedChecklistIds?: number[];
}

interface ChecklistTemplate {
  id: number;
  name: string;
  stages?: any[];
}

interface ActivityList {
  id: number;
  name: string;
  description: string;
  epsNode?: { nodeName: string };
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

const SortableRow = ({
  activity,
  index,
  allActivities,
  checklists,
  onEdit,
  onDelete,
  onToggle,
}: {
  activity: Activity;
  index: number;
  allActivities: Activity[];
  checklists: ChecklistTemplate[];
  onEdit: (a: Activity) => void;
  onDelete: (id: number) => void;
  onToggle: (
    id: number,
    field: "holdPoint" | "witnessPoint" | "allowBreak",
    val: boolean,
  ) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const predecessors = activity.incomingEdges?.length
    ? activity.incomingEdges
        .map((e) => allActivities.find((a) => a.id === e.sourceId))
        .filter(Boolean)
    : activity.previousActivityId
      ? [
          allActivities.find((a) => a.id === activity.previousActivityId),
        ].filter(Boolean)
      : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-4 bg-surface-card rounded-xl border transition-all ${isDragging ? "shadow-2xl border-indigo-300" : "border-border-default hover:border-indigo-200 hover:shadow-sm"}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-text-muted flex-shrink-0"
      >
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Sequence Badge */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-white text-sm font-black flex items-center justify-center mt-0.5">
        {index + 1}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-800 truncate">
              {activity.activityName}
            </h4>
            {activity.description && (
              <p className="text-xs text-text-muted mt-0.5 truncate">
                {activity.description}
              </p>
            )}
            {/* Predecessors */}
            {predecessors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                <span className="text-text-disabled font-medium">After:</span>
                {predecessors.map((p) => (
                  <span
                    key={p!.id}
                    className="inline-flex items-center gap-1 bg-secondary-muted text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-semibold"
                  >
                    <ChevronRight className="w-3 h-3 text-indigo-400" />
                    {p!.activityName}
                  </span>
                ))}
              </div>
            )}
            {/* Assigned Checklists */}
            {activity.assignedChecklistIds &&
              activity.assignedChecklistIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                  {activity.assignedChecklistIds.map((cid) => {
                    const tmpl = checklists.find((c) => c.id === cid);
                    return (
                      <span
                        key={cid}
                        className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100 font-medium"
                      >
                        {tmpl?.name || `#${cid}`}
                      </span>
                    );
                  })}
                </div>
              )}
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-100 font-medium">
                Applicability: {activity.applicabilityLevel || "FLOOR"}
              </span>
            </div>
          </div>

          {/* Responsible Party */}
          <span
            className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
              activity.responsibleParty === "Consultant"
                ? "bg-info-muted text-blue-700"
                : activity.responsibleParty === "Client"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-surface-raised text-text-secondary"
            }`}
          >
            {activity.responsibleParty}
          </span>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {/* Hold Point */}
          <button
            onClick={() =>
              onToggle(activity.id, "holdPoint", !activity.holdPoint)
            }
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
              activity.holdPoint
                ? "bg-red-100 text-red-700 border border-red-200"
                : "bg-surface-raised text-text-disabled border border-border-default hover:border-red-200 hover:text-error"
            }`}
            title="Hold Point — mandatory inspection gate"
          >
            <ShieldAlert className="w-3 h-3" />
            Hold Point
            {activity.holdPoint ? <Check className="w-3 h-3" /> : null}
          </button>

          {/* Witness Point */}
          <button
            onClick={() =>
              onToggle(activity.id, "witnessPoint", !activity.witnessPoint)
            }
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
              activity.witnessPoint
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-surface-raised text-text-disabled border border-border-default hover:border-amber-200 hover:text-amber-500"
            }`}
            title="Witness Point — optional witness required"
          >
            <Eye className="w-3 h-3" />
            Witness Point
            {activity.witnessPoint ? <Check className="w-3 h-3" /> : null}
          </button>

          {/* Allow Break */}
          <button
            onClick={() =>
              onToggle(activity.id, "allowBreak", !activity.allowBreak)
            }
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
              activity.allowBreak
                ? "bg-orange-100 text-orange-700 border border-orange-200"
                : "bg-surface-raised text-text-disabled border border-border-default hover:border-orange-200 hover:text-orange-500"
            }`}
            title="Allow Break — RFI can be raised even if predecessor is not approved"
          >
            <Scissors className="w-3 h-3" />
            Allow Break
            {activity.allowBreak ? <Check className="w-3 h-3" /> : null}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        <button
          onClick={() => onEdit(activity)}
          className="p-1.5 rounded-lg text-text-disabled hover:text-warning hover:bg-warning-muted transition-colors"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(activity.id)}
          className="p-1.5 rounded-lg text-text-disabled hover:text-error hover:bg-error-muted transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Activity Form (inline modal) ─────────────────────────────────────────────

const ActivityForm = ({
  initial,
  allActivities,
  checklists,
  onSave,
  onCancel,
}: {
  initial?: Activity;
  allActivities: Activity[];
  checklists: ChecklistTemplate[];
  onSave: (data: Partial<Activity>) => Promise<void>;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState({
    activityName: initial?.activityName || "",
    description: initial?.description || "",
    previousActivityId: initial?.previousActivityId || (null as number | null),
    predecessorIds:
      initial?.incomingEdges?.map((e) => e.sourceId) ||
      (initial?.previousActivityId ? [initial.previousActivityId] : []),
    holdPoint: initial?.holdPoint || false,
    witnessPoint: initial?.witnessPoint || false,
    responsibleParty: initial?.responsibleParty || "Contractor",
    allowBreak: initial?.allowBreak || false,
    applicabilityLevel: initial?.applicabilityLevel || "FLOOR",
    assignedChecklistIds: initial?.assignedChecklistIds || ([] as number[]),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [clSearch, setClSearch] = useState("");

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const toggleChecklist = (id: number) => {
    setForm((f) => ({
      ...f,
      assignedChecklistIds: f.assignedChecklistIds.includes(id)
        ? f.assignedChecklistIds.filter((c) => c !== id)
        : [...f.assignedChecklistIds, id],
    }));
  };

  const filteredChecklists = checklists.filter((c) =>
    c.name.toLowerCase().includes(clSearch.toLowerCase()),
  );

  const handleSave = async () => {
    if (!form.activityName.trim()) {
      setError("Activity name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-secondary-muted border border-indigo-200 rounded-xl p-5 space-y-4">
      <h4 className="font-bold text-indigo-800 text-sm">
        {initial ? "Edit Activity" : "Add New Activity"}
      </h4>
      {error && (
        <div className="flex items-center gap-2 text-error text-xs bg-error-muted p-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-text-secondary mb-1 block">
            Activity Name *
          </label>
          <input
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
            placeholder="e.g. Reinforcement Inspection"
            value={form.activityName}
            onChange={(e) => set("activityName", e.target.value)}
            autoFocus
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-text-secondary mb-1 block">
            Description
          </label>
          <input
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
            placeholder="Optional description..."
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1 block">
            Responsible Party
          </label>
          <select
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
            value={form.responsibleParty}
            onChange={(e) => set("responsibleParty", e.target.value)}
          >
            <option>Contractor</option>
            <option>Consultant</option>
            <option>Client</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1 block">
            Applicability
          </label>
          <select
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
            value={form.applicabilityLevel}
            onChange={(e) => set("applicabilityLevel", e.target.value)}
          >
            <option value="FLOOR">Floor Level</option>
            <option value="UNIT">Unit Level</option>
            <option value="ROOM">Room Level</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-text-secondary mb-1 block uppercase tracking-wider">
            Predecessor Activities (Select Multiple)
          </label>
          <div className="border border-border-default rounded-lg p-3 bg-surface-card max-h-40 overflow-y-auto space-y-2">
            {allActivities
              .filter((a) => a.id !== initial?.id)
              .map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-surface-base p-1 rounded transition-colors group"
                >
                  <input
                    type="checkbox"
                    className="rounded border-border-strong text-secondary w-4 h-4 focus:ring-secondary"
                    checked={form.predecessorIds!.includes(a.id)}
                    onChange={(e) => {
                      const ids = e.target.checked
                        ? [...form.predecessorIds!, a.id]
                        : form.predecessorIds!.filter((id) => id !== a.id);
                      set("predecessorIds", ids);
                    }}
                  />
                  <span className="text-sm text-text-secondary group-hover:text-indigo-700">
                    <span className="font-bold text-text-disabled mr-2">
                      {a.sequence}.
                    </span>
                    {a.activityName}
                  </span>
                </label>
              ))}
            {allActivities.length <= 1 && (
              <div className="text-xs text-text-disabled py-2 text-center">
                No other activities available for linking.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assign Checklists */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1 block uppercase tracking-wider flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
          Assign Checklists (Multi-Select)
        </label>
        {/* Selected Checklist Pills */}
        {form.assignedChecklistIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.assignedChecklistIds.map((cid) => {
              const tmpl = checklists.find((c) => c.id === cid);
              return (
                <span
                  key={cid}
                  className="inline-flex items-center gap-1 text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-semibold border border-teal-200"
                >
                  {tmpl?.name || `#${cid}`}
                  <button
                    type="button"
                    onClick={() => toggleChecklist(cid)}
                    className="hover:text-error transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {/* Searchable List */}
        <div className="border border-border-default rounded-lg bg-surface-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle">
            <input
              className="w-full text-sm outline-none placeholder-gray-400"
              placeholder="Search checklists..."
              value={clSearch}
              onChange={(e) => setClSearch(e.target.value)}
            />
          </div>
          <div className="max-h-36 overflow-y-auto p-2 space-y-1">
            {filteredChecklists.length === 0 ? (
              <div className="text-xs text-text-disabled py-3 text-center">
                {checklists.length === 0
                  ? "No checklist templates available. Create one first."
                  : "No matching checklists."}
              </div>
            ) : (
              filteredChecklists.map((cl) => (
                <label
                  key={cl.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-teal-50 p-1.5 rounded transition-colors group"
                >
                  <input
                    type="checkbox"
                    className="rounded border-border-strong text-teal-600 w-4 h-4 focus:ring-teal-500"
                    checked={form.assignedChecklistIds.includes(cl.id)}
                    onChange={() => toggleChecklist(cl.id)}
                  />
                  <span className="text-sm text-text-secondary group-hover:text-teal-700 flex-1">
                    {cl.name}
                  </span>
                  {cl.stages && (
                    <span className="text-xs text-text-disabled">
                      {cl.stages.length} stages
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-4 flex-wrap">
        {(["holdPoint", "witnessPoint", "allowBreak"] as const).map((field) => (
          <label key={field} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-border-strong text-secondary w-4 h-4"
              checked={form[field]}
              onChange={(e) => set(field, e.target.checked)}
            />
            <span className="text-xs font-semibold text-text-secondary">
              {field === "holdPoint"
                ? "🔴 Hold Point"
                : field === "witnessPoint"
                  ? "🟡 Witness Point"
                  : "✂️ Allow Break"}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-text-secondary hover:bg-surface-raised rounded-lg text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:bg-secondary-dark disabled:opacity-50 flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving..." : "Save Activity"}
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const SequenceManagerPage = () => {
  const { projectId, listId } = useParams<{
    projectId: string;
    listId: string;
  }>();
  const navigate = useNavigate();

  const [list, setList] = useState<ActivityList | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Activity | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    fetchData();
  }, [listId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listRes, activitiesRes, clRes] = await Promise.all([
        api.get(`/quality/activity-lists/${listId}`),
        api.get(`/quality/activity-lists/${listId}/activities`),
        api.get(`/quality/checklist-templates/project/${projectId}`),
      ]);
      setList(listRes.data);
      setActivities(activitiesRes.data);
      setChecklists(Array.isArray(clRes.data) ? clRes.data : []);
    } catch {
      console.error("Failed to load sequence data");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activities.findIndex((a) => a.id === active.id);
    const newIndex = activities.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(activities, oldIndex, newIndex);

    // Optimistic update
    setActivities(reordered);

    // Persist to backend
    setSaving(true);
    try {
      const res = await api.patch(`/quality/activity-lists/${listId}/reorder`, {
        orderedIds: reordered.map((a) => a.id),
      });
      setActivities(res.data);
    } catch {
      // Revert on failure
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleAddActivity = async (data: Partial<Activity>) => {
    const { assignedChecklistIds, ...activityData } = data;
    const res = await api.post(
      `/quality/activity-lists/${listId}/activities`,
      activityData,
    );
    // Assign checklists if selected
    if (
      assignedChecklistIds &&
      assignedChecklistIds.length > 0 &&
      res.data?.id
    ) {
      await api.post(`/quality/activities/${res.data.id}/assign-checklists`, {
        checklistIds: assignedChecklistIds,
      });
    }
    setShowAddForm(false);
    fetchData();
  };

  const handleEditActivity = async (data: Partial<Activity>) => {
    const { assignedChecklistIds, ...activityData } = data;
    await api.patch(`/quality/activities/${editTarget!.id}`, activityData);
    // Update checklist assignment
    if (assignedChecklistIds) {
      await api.post(
        `/quality/activities/${editTarget!.id}/assign-checklists`,
        { checklistIds: assignedChecklistIds },
      );
    }
    setEditTarget(null);
    fetchData();
  };

  const handleDeleteActivity = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/quality/activities/${deleteId}`);
      setDeleteId(null);
      fetchData();
    } catch {
      alert("Failed to delete activity");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (
    id: number,
    field: "holdPoint" | "witnessPoint" | "allowBreak",
    val: boolean,
  ) => {
    // Optimistic
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: val } : a)),
    );
    try {
      await api.patch(`/quality/activities/${id}`, { [field]: val });
    } catch {
      fetchData(); // revert
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-disabled">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full mr-3" />
        Loading sequence...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface-base">
      {/* Header */}
      <div className="bg-surface-card border-b border-border-default px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                navigate(
                  `/dashboard/projects/${projectId}/quality/activity-lists`,
                )
              }
              className="p-2 rounded-xl hover:bg-surface-raised text-text-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-black text-gray-800">{list?.name}</h2>
              <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                Sequence Manager
                {list?.epsNode && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="text-secondary font-medium">
                      {list.epsNode.nodeName}
                    </span>
                  </>
                )}
                {saving && (
                  <span className="text-amber-500 ml-2 animate-pulse">
                    Saving...
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-surface-raised p-1 rounded-lg">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md shadow bg-surface-card text-indigo-700">
                <List className="w-4 h-4" /> Activity Editor
              </button>
              <button
                onClick={() =>
                  navigate(
                    `/dashboard/projects/${projectId}/quality/activity-lists/${listId}/sequence`,
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-text-muted hover:text-text-secondary hover:bg-gray-200 transition-colors"
              >
                <Network className="w-4 h-4" /> Workflow Editor
              </button>
            </div>
            <button
              onClick={() => {
                setShowAddForm(true);
                setEditTarget(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary-dark shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Activity
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-surface-card border-b border-border-subtle px-6 py-2 flex items-center gap-6 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-error" /> Hold Point =
          mandatory inspection gate
        </span>
        <span className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-amber-500" /> Witness Point =
          optional witness
        </span>
        <span className="flex items-center gap-1.5">
          <Scissors className="w-3.5 h-3.5 text-orange-500" /> Allow Break = RFI
          allowed even if predecessor incomplete
        </span>
        <span className="flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-text-disabled" /> Drag to
          reorder
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Add Form */}
          {showAddForm && !editTarget && (
            <ActivityForm
              allActivities={activities}
              checklists={checklists}
              onSave={handleAddActivity}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {/* Empty State */}
          {activities.length === 0 && !showAddForm && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-secondary-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-indigo-300" />
              </div>
              <p className="text-text-muted font-medium">No activities yet</p>
              <p className="text-text-disabled text-sm mt-1">
                Add activities manually or import from CSV
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 px-5 py-2 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary-dark"
              >
                <Plus className="w-4 h-4 inline mr-1" /> Add First Activity
              </button>
            </div>
          )}

          {/* Drag and Drop List */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activities.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {activities.map((activity, index) => (
                <div key={activity.id}>
                  {/* Edit Form inline */}
                  {editTarget?.id === activity.id ? (
                    <ActivityForm
                      initial={activity}
                      allActivities={activities}
                      checklists={checklists}
                      onSave={handleEditActivity}
                      onCancel={() => setEditTarget(null)}
                    />
                  ) : (
                    <SortableRow
                      activity={activity}
                      index={index}
                      allActivities={activities}
                      checklists={checklists}
                      onEdit={setEditTarget}
                      onDelete={setDeleteId}
                      onToggle={handleToggle}
                    />
                  )}
                </div>
              ))}
            </SortableContext>
          </DndContext>

          {/* Add button at bottom */}
          {activities.length > 0 && !showAddForm && (
            <button
              onClick={() => {
                setShowAddForm(true);
                setEditTarget(null);
              }}
              className="w-full py-3 border-2 border-dashed border-border-default rounded-xl text-text-disabled hover:border-indigo-300 hover:text-secondary text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Another Activity
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-error" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Delete Activity?</h3>
                <p className="text-sm text-text-muted">
                  The sequence will auto-relink to the previous valid activity.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteActivity}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SequenceManagerPage;
