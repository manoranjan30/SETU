import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus,
  Upload,
  Edit2,
  Trash2,
  ChevronRight,
  Clipboard,
  Layers,
  Search,
  X,
  AlertCircle,
  Copy,
  Network,
} from "lucide-react";
import api from "../../api/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EpsNode {
  id: number;
  nodeName: string;
  nodeType: string;
  children?: EpsNode[];
}

interface ActivityList {
  id: number;
  name: string;
  description: string;
  epsNodeId: number;
  epsNode?: { nodeName: string };
  activityCount?: number;
  createdAt: string;
}

// ─── EPS Tree ─────────────────────────────────────────────────────────────────

const EpsTreeNode = ({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: EpsNode;
  selectedId: number | null;
  onSelect: (id: number, name: string) => void;
  depth?: number;
}) => {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
          selectedId === node.id
            ? "bg-indigo-100 text-indigo-700 font-semibold"
            : "hover:bg-surface-raised text-text-secondary"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          onSelect(node.id, node.nodeName);
          if (hasChildren) setOpen(!open);
        }}
      >
        {hasChildren ? (
          <ChevronRight
            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          />
        ) : (
          <span className="w-3.5" />
        )}
        <Layers className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" />
        <span className="truncate">{node.nodeName}</span>
      </div>
      {open && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <EpsTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Create / Edit Modal ───────────────────────────────────────────────────────

const ListModal = ({
  mode,
  initial,
  projectId,
  epsNodeId,
  epsNodeName,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: ActivityList;
  projectId: number;
  epsNodeId: number | null;
  epsNodeName: string;
  onClose: () => void;
  onSave: () => void;
}) => {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        await api.post("/quality/activity-lists", {
          name: name.trim(),
          description: description.trim(),
          projectId,
          epsNodeId,
        });
      } else {
        await api.patch(`/quality/activity-lists/${initial!.id}`, {
          name: name.trim(),
          description: description.trim(),
        });
      }
      onSave();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-800">
            {mode === "create" ? "Create Activity List" : "Edit Activity List"}
          </h3>
          {epsNodeName && (
            <p className="text-sm text-secondary mt-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> {epsNodeName}
            </p>
          )}
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-error text-sm bg-error-muted p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1">
              List Name *
            </label>
            <input
              className="w-full border border-border-default rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
              placeholder="e.g. Column Concreting Checklist"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1">
              Description
            </label>
            <textarea
              className="w-full border border-border-default rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none h-20"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:bg-secondary-dark disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : mode === "create"
                ? "Create List"
                : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── CSV Import Modal ──────────────────────────────────────────────────────────

const CsvImportModal = ({
  listId,
  listName,
  onClose,
  onImported,
}: {
  listId: number;
  listName: string;
  onClose: () => void;
  onImported: () => void;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/quality/activity-lists/${listId}/import-csv`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onImported();
    } catch {
      setError("Import failed. Please check your CSV format.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-800">
            Import Activities from CSV
          </h3>
          <p className="text-sm text-text-muted mt-1">
            Into:{" "}
            <span className="font-semibold text-secondary">{listName}</span>
          </p>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-error text-sm bg-error-muted p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {/* Expected format */}
          <div className="bg-surface-base rounded-xl p-4 text-xs font-mono text-text-secondary overflow-x-auto">
            <div className="text-text-disabled mb-1 font-sans font-semibold">
              Expected CSV format:
            </div>
            Sequence,ActivityName,Description,PreviousActivityCode,HoldPoint,WitnessPoint,ResponsibleParty,AllowBreak,ApplicabilityLevel
            <br />
            1,Excavation Check,Verify depth,,Y,N,Contractor,N,FLOOR
            <br />
            2,Reinforcement Inspection,Check bar dia,1,Y,Y,Consultant,N,UNIT
          </div>
          <div
            className="border-2 border-dashed border-border-default rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            {file ? (
              <p className="text-sm font-semibold text-secondary">
                {file.name}
              </p>
            ) : (
              <p className="text-sm text-text-muted">
                Click to select CSV file
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <p className="text-xs text-warning bg-warning-muted p-3 rounded-lg">
            ⚠️ Importing will replace all existing activities in this list.
          </p>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-5 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:bg-secondary-dark disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Copy List Modal ──────────────────────────────────────────────────────────

const CopyListModal = ({
  targetProjectId,
  onClose,
  onCopy,
}: {
  targetProjectId: number;
  onClose: () => void;
  onCopy: () => void;
}) => {
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [sourceLists, setSourceLists] = useState<ActivityList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get("/dashboard/summary");
      setProjects(res.data.projects || []);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchSourceLists();
    } else {
      setSourceLists([]);
    }
  }, [selectedProjectId]);

  const fetchSourceLists = async () => {
    try {
      const res = await api.get("/quality/activity-lists", {
        params: { projectId: selectedProjectId },
      });
      setSourceLists(res.data);
    } catch {
      setError("Failed to load lists for selected project");
    }
  };

  const handleCopy = async () => {
    if (!selectedListId) return;
    setCopying(true);
    try {
      await api.post(`/quality/activity-lists/${selectedListId}/clone`, {
        targetProjectId,
      });
      onCopy();
    } catch {
      setError("Failed to copy workflow");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Copy className="w-5 h-5 text-secondary" /> Copy Workflow
          </h3>
          <p className="text-xs text-text-muted mt-1">
            Select a workflow from another project to copy to this project.
          </p>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-error text-sm bg-error-muted p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1">
              Source Project
            </label>
            <select
              className="w-full border border-border-default rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
              value={selectedProjectId || ""}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            >
              <option value="">
                {loading ? "Loading projects..." : "Select a project..."}
              </option>
              {projects
                .filter((p) => p.id !== targetProjectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1">
              Select Workflow
            </label>
            <select
              disabled={!selectedProjectId}
              className="w-full border border-border-default rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none disabled:bg-surface-base disabled:text-text-disabled"
              value={selectedListId || ""}
              onChange={(e) => setSelectedListId(Number(e.target.value))}
            >
              <option value="">Select a workflow...</option>
              {sourceLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.activityCount || 0} activities)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={!selectedListId || copying}
            className="px-5 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:bg-secondary-dark disabled:opacity-50"
          >
            {copying ? "Copying..." : "Copy Workflow"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ActivityListsPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [epsTree, setEpsTree] = useState<EpsNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedNodeName, setSelectedNodeName] = useState("");
  const [lists, setLists] = useState<ActivityList[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [editTarget, setEditTarget] = useState<ActivityList | null>(null);
  const [importTarget, setImportTarget] = useState<ActivityList | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityList | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchEpsTree();
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchLists();
  }, [projectId, selectedNodeId]);

  const fetchEpsTree = async () => {
    try {
      const res = await api.get(`/eps/tree?projectId=${projectId}`);
      setEpsTree(Array.isArray(res.data) ? res.data : [res.data]);
    } catch {
      console.error("Failed to load EPS tree");
    }
  };

  const fetchLists = async () => {
    setLoading(true);
    try {
      const params: any = { projectId };
      if (selectedNodeId) params.epsNodeId = selectedNodeId;
      const res = await api.get("/quality/activity-lists", { params });
      setLists(res.data);
    } catch {
      console.error("Failed to load activity lists");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/quality/activity-lists/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchLists();
    } catch {
      alert("Failed to delete list");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = lists.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="h-full flex bg-surface-base">
      {/* EPS Sidebar */}
      <div className="w-64 flex-shrink-0 bg-surface-card border-r border-border-default flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Project Structure
          </h3>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <div
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm mb-1 transition-colors ${!selectedNodeId ? "bg-indigo-100 text-indigo-700 font-semibold" : "hover:bg-surface-raised text-text-secondary"}`}
            onClick={() => {
              setSelectedNodeId(null);
              setSelectedNodeName("");
            }}
          >
            <Clipboard className="w-3.5 h-3.5" />
            All Nodes
          </div>
          {epsTree.map((node) => (
            <EpsTreeNode
              key={node.id}
              node={node}
              selectedId={selectedNodeId}
              onSelect={(id, name) => {
                setSelectedNodeId(id);
                setSelectedNodeName(name);
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-surface-card border-b border-border-default px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-secondary" />
              Activity Lists
              {selectedNodeName && (
                <span className="text-sm font-normal text-secondary ml-1">
                  — {selectedNodeName}
                </span>
              )}
            </h2>
            <p className="text-text-muted text-xs mt-0.5">
              Manage quality activity checklists for inspection sequencing
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                navigate(`/dashboard/projects/${projectId}/quality/workflow`)
              }
              className="flex items-center gap-2 px-4 py-2 bg-surface-card border border-border-default text-secondary rounded-xl text-sm font-semibold hover:bg-secondary-muted transition-colors shadow-sm"
            >
              <Network className="w-4 h-4" /> Approval Workflow
            </button>
            <button
              onClick={() => setShowCopy(true)}
              className="flex items-center gap-2 px-4 py-2 bg-surface-card border border-border-default text-secondary rounded-xl text-sm font-semibold hover:bg-secondary-muted transition-colors shadow-sm"
            >
              <Copy className="w-4 h-4" /> Copy List
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary-dark shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> New List
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 bg-surface-card border-b border-border-subtle">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
              placeholder="Search lists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-text-disabled" />
              </button>
            )}
          </div>
        </div>

        {/* List Table */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-text-disabled">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full mr-3" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-center">
              <Clipboard className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-text-muted font-medium">
                No activity lists found
              </p>
              <p className="text-text-disabled text-sm mt-1">
                {selectedNodeName
                  ? `No lists for "${selectedNodeName}"`
                  : "Create your first list to get started"}
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary-dark"
              >
                <Plus className="w-4 h-4 inline mr-1" /> Create List
              </button>
            </div>
          ) : (
            <div className="bg-surface-card rounded-2xl border border-border-default shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-base text-text-muted text-xs font-semibold uppercase tracking-wider border-b">
                  <tr>
                    <th className="px-5 py-3 text-left">List Name</th>
                    <th className="px-5 py-3 text-left">EPS Node</th>
                    <th className="px-5 py-3 text-center">Activities</th>
                    <th className="px-5 py-3 text-left">Created</th>
                    <th className="px-5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((list) => (
                    <tr
                      key={list.id}
                      className="hover:bg-secondary-muted/40 transition-colors group cursor-pointer"
                      onClick={() =>
                        navigate(
                          `/dashboard/projects/${projectId}/quality/activity-lists/${list.id}/activities`,
                        )
                      }
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-800 group-hover:text-indigo-700 flex items-center gap-2">
                          {list.name}
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400" />
                        </div>
                        {list.description && (
                          <div className="text-xs text-text-disabled mt-0.5 truncate max-w-xs">
                            {list.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 text-xs bg-secondary-muted text-secondary px-2 py-1 rounded-full font-medium">
                          <Layers className="w-3 h-3" />
                          {list.epsNode?.nodeName || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-raised text-text-secondary font-bold text-sm">
                          {(list as any).activityCount ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-text-muted text-xs">
                        {new Date(list.createdAt).toLocaleDateString()}
                      </td>
                      <td
                        className="px-5 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setImportTarget(list)}
                            title="Import CSV"
                            className="p-1.5 rounded-lg text-text-disabled hover:text-secondary hover:bg-secondary-muted transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditTarget(list)}
                            title="Edit"
                            className="p-1.5 rounded-lg text-text-disabled hover:text-warning hover:bg-warning-muted transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(list)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-text-disabled hover:text-error hover:bg-error-muted transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <ListModal
          mode="create"
          projectId={Number(projectId)}
          epsNodeId={selectedNodeId}
          epsNodeName={selectedNodeName}
          onClose={() => setShowCreate(false)}
          onSave={() => {
            setShowCreate(false);
            fetchLists();
          }}
        />
      )}
      {showCopy && (
        <CopyListModal
          targetProjectId={Number(projectId)}
          onClose={() => setShowCopy(false)}
          onCopy={() => {
            setShowCopy(false);
            fetchLists();
          }}
        />
      )}
      {editTarget && (
        <ListModal
          mode="edit"
          initial={editTarget}
          projectId={Number(projectId)}
          epsNodeId={editTarget.epsNodeId}
          epsNodeName={editTarget.epsNode?.nodeName || ""}
          onClose={() => setEditTarget(null)}
          onSave={() => {
            setEditTarget(null);
            fetchLists();
          }}
        />
      )}
      {importTarget && (
        <CsvImportModal
          listId={importTarget.id}
          listName={importTarget.name}
          onClose={() => setImportTarget(null)}
          onImported={() => {
            setImportTarget(null);
            fetchLists();
          }}
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-error" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Delete List?</h3>
                <p className="text-sm text-text-muted">
                  This will delete all activities in "{deleteTarget.name}"
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
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

export default ActivityListsPage;
