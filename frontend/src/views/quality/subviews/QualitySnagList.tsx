import { useState, useEffect } from "react";
import { qualityService } from "../../../services/quality.service";
import type { QualitySnag } from "../../../types/quality";
import { SnagStatus, SnagPriority } from "../../../types/quality";
import {
  Plus,
  AlertCircle,
  MapPin,
  Tag,
  Camera,
  LayoutList,
  Grid,
  Trash2,
  CheckCircle2,
  Eye,
  XCircle,
} from "lucide-react";
import api from "../../../api/axios";

interface Props {
  projectId: number;
}

export default function QualitySnagList({ projectId }: Props) {
  const [snags, setSnags] = useState<QualitySnag[]>([]);
  const [filteredSnags, setFilteredSnags] = useState<QualitySnag[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedSnag, setSelectedSnag] = useState<QualitySnag | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // New Snag Form
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<SnagPriority>(SnagPriority.MEDIUM);
  const [file, setFile] = useState<File | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);

  // Update Snag State
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [updateFile, setUpdateFile] = useState<File | null>(null);

  // EPS for Selector
  const [epsNodes, setEpsNodes] = useState<any[]>([]);

  useEffect(() => {
    if (projectId) {
      loadSnags();
      loadLocations();
    }
  }, [projectId]);

  useEffect(() => {
    if (statusFilter === "ALL") setFilteredSnags(snags);
    else setFilteredSnags(snags.filter((s) => s.status === statusFilter));
  }, [snags, statusFilter]);

  const loadSnags = async () => {
    setLoading(true);
    try {
      const data = await qualityService.getSnags(projectId);
      setSnags(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const res = await api.get("/eps");
      const flat: any[] = [];
      const traverse = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.type === "UNIT" || n.type === "ROOM") {
            flat.push({ id: n.id, name: n.name, type: n.type });
          }
          if (n.children) traverse(n.children);
        }
      };
      traverse(res.data);
      setEpsNodes(flat);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    if (!desc || !locationId) {
      alert("Description and Location are required");
      return;
    }

    const fd = new FormData();
    fd.append("projectId", String(projectId));
    fd.append("epsNodeId", String(locationId));
    fd.append("defectDescription", desc);
    fd.append("priority", priority);
    const due = new Date();
    due.setDate(due.getDate() + 7);
    fd.append("dueDate", due.toISOString().split("T")[0]);
    fd.append("status", SnagStatus.OPEN);

    if (file) fd.append("file", file);

    try {
      await qualityService.createSnag(fd);
      setShowModal(false);
      setDesc("");
      setFile(null);
      loadSnags();
    } catch (err) {
      alert("Failed to create snag");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this snag?")) return;
    try {
      await qualityService.deleteSnag(id);
      loadSnags();
    } catch (err) {
      alert("Failed to delete snag");
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedSnag) return;
    const fd = new FormData();
    fd.append("status", updateStatus);
    if (updateFile) fd.append("file", updateFile);

    try {
      await qualityService.updateSnag(selectedSnag.id, fd);
      setShowUpdateModal(false);
      setUpdateFile(null);
      loadSnags();
    } catch (err) {
      alert("Failed to update snag");
    }
  };

  const getStatusColor = (status: SnagStatus) => {
    switch (status) {
      case SnagStatus.OPEN:
        return "bg-red-100 text-red-800 border-red-200";
      case SnagStatus.RECTIFIED:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case SnagStatus.VERIFIED:
        return "bg-info-muted text-blue-800 border-blue-200";
      case SnagStatus.CLOSED:
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-surface-raised";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface-card p-4 rounded-xl border border-border-subtle shadow-sm">
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 bg-surface-base p-1 rounded-lg">
            {["ALL", "OPEN", "RECTIFIED", "CLOSED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? "bg-surface-card text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-surface-base rounded-lg p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded ${viewMode === "table" ? "bg-surface-card shadow" : "text-text-disabled"}`}
            >
              <LayoutList size={16} />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded ${viewMode === "cards" ? "bg-surface-card shadow" : "text-text-disabled"}`}
            >
              <Grid size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-orange-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all"
          >
            <Plus size={16} /> New Snag
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-10 text-text-disabled">
          Loading snags...
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && !loading && (
        <div className="bg-surface-card rounded-xl shadow-sm border border-border-subtle overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-base text-text-muted text-xs uppercase tracking-wider font-semibold border-b border-border-subtle">
                <th className="p-4">ID</th>
                <th className="p-4">Location</th>
                <th className="p-4">Description</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Status</th>
                <th className="p-4">Photos</th>
                <th className="p-4">Due Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSnags.map((snag) => (
                <tr
                  key={snag.id}
                  className="hover:bg-surface-base/50 transition-colors text-sm group"
                >
                  <td className="p-4 font-mono text-xs text-text-disabled">
                    #{snag.id}
                  </td>
                  <td className="p-4 font-medium text-text-secondary">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-text-disabled" />
                      {snag.locationName || `Node ${snag.epsNodeId}`}
                    </div>
                  </td>
                  <td
                    className="p-4 max-w-xs truncate text-text-secondary"
                    title={snag.defectDescription}
                  >
                    {snag.defectDescription}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${snag.priority === "CRITICAL" ? "bg-error-muted text-error" : "bg-surface-base text-text-muted"}`}
                    >
                      {snag.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(snag.status)}`}
                    >
                      {snag.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {snag.photos?.length > 0 ? (
                      <div className="flex -space-x-2">
                        {snag.photos.map((p) => (
                          <div
                            key={p.id}
                            className="w-8 h-8 rounded-full border-2 border-white bg-surface-raised flex items-center justify-center overflow-hidden z-0 hover:z-10 transition-all relative group-hover:scale-110 shadow-sm"
                            title={p.type}
                          >
                            <span className="text-[8px] font-bold text-text-disabled">
                              {p.type[0]}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="p-4 text-xs text-text-muted font-mono">
                    {snag.dueDate?.split("T")[0] || "-"}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setSelectedSnag(snag);
                          setUpdateStatus(snag.status);
                          setShowUpdateModal(true);
                        }}
                        className="p-1.5 hover:bg-primary-muted text-primary rounded-lg transition-colors border border-transparent hover:border-blue-100"
                        title="View / Update"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(snag.id)}
                        className="p-1.5 hover:bg-error-muted text-error rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Card View */}
      {viewMode === "cards" && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSnags.map((snag) => (
            <div
              key={snag.id}
              className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-md"
            >
              <div className="h-40 bg-surface-raised flex items-center justify-center relative">
                <Camera className="w-12 h-12 text-gray-200" />
                <div className="absolute bottom-4 left-4">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(snag.status)}`}
                  >
                    {snag.status}
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-[10px] font-bold text-text-disabled uppercase tracking-widest mb-2">
                  <MapPin className="w-3 h-3" />{" "}
                  {snag.locationName || `Node ${snag.epsNodeId}`}
                </div>
                <h4 className="font-bold text-text-primary mb-2 line-clamp-2">
                  {snag.defectDescription}
                </h4>
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-50">
                  <div className="flex items-center gap-2 text-xs text-text-muted font-medium">
                    <Tag className="w-3.5 h-3.5" /> {snag.trade || "General"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedSnag(snag);
                        setUpdateStatus(snag.status);
                        setShowUpdateModal(true);
                      }}
                      className="p-1.5 text-primary hover:bg-primary-muted rounded-lg transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(snag.id)}
                      className="p-1.5 text-error hover:bg-error-muted rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card p-6 rounded-3xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-text-primary">
              <AlertCircle className="text-orange-600" /> Report New Defect
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1.5">
                  Location (Unit / Room)
                </label>
                <select
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  value={locationId || ""}
                  onChange={(e) => setLocationId(Number(e.target.value))}
                >
                  <option value="">Select Location...</option>
                  {epsNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1.5">
                  Description
                </label>
                <textarea
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500 transition-all outline-none resize-none h-24"
                  placeholder="Describe the defect clearly..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-disabled uppercase mb-1.5">
                    Priority
                  </label>
                  <select
                    className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as SnagPriority)
                    }
                  >
                    {Object.values(SnagPriority).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-disabled uppercase mb-1.5">
                    Photo Evidence
                  </label>
                  <label className="w-full bg-surface-base border-dashed border-2 border-border-default rounded-xl px-4 py-2.5 text-sm font-medium cursor-pointer flex items-center justify-center text-text-muted hover:bg-surface-raised transition-all">
                    {file ? (
                      <span className="text-success truncate">{file.name}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Camera size={14} /> Upload
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 rounded-xl text-text-muted font-bold hover:bg-surface-raised transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-200 hover:shadow-xl hover:scale-105 transition-all text-sm"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View / Update Modal (De-snagging) */}
      {showUpdateModal && selectedSnag && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card p-0 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">
                Snag Details #P-00{selectedSnag.id}
              </h3>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="p-2 hover:bg-surface-raised rounded-full transition-colors"
              >
                <XCircle size={20} className="text-text-disabled" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-disabled uppercase tracking-widest mb-1">
                    Status
                  </label>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(selectedSnag.status)}`}
                  >
                    {selectedSnag.status}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-disabled uppercase tracking-widest mb-1">
                    Description
                  </label>
                  <p className="text-sm text-text-secondary font-medium leading-relaxed">
                    {selectedSnag.defectDescription}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-text-disabled uppercase mb-1">
                      Priority
                    </label>
                    <div className="text-xs font-bold text-text-secondary">
                      {selectedSnag.priority}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-disabled uppercase mb-1">
                      Due Date
                    </label>
                    <div className="text-xs font-mono text-text-muted">
                      {selectedSnag.dueDate?.split("T")[0] || "-"}
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <label className="block text-[10px] font-bold text-text-disabled uppercase mb-2">
                    History & Photos ({selectedSnag.photos?.length || 0})
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedSnag.photos?.map((p) => (
                      <div
                        key={p.id}
                        className="relative aspect-square bg-surface-raised rounded-lg overflow-hidden border border-border-subtle group"
                      >
                        <Camera
                          size={20}
                          className="absolute inset-0 m-auto text-gray-300 z-0"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/40 p-1 text-[8px] text-white text-center font-bold z-10">
                          {p.type}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-surface-base/50 p-5 rounded-2xl border border-border-subtle">
                <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <CheckCircle2 className="text-success w-4 h-4" /> Update
                  Progress
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-text-disabled uppercase mb-1.5">
                      Transition to
                    </label>
                    <select
                      className="w-full bg-surface-card border border-border-default rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value)}
                    >
                      <option value={SnagStatus.OPEN}>OPEN</option>
                      <option value={SnagStatus.RECTIFIED}>
                        RECTIFIED (Fixed)
                      </option>
                      <option value={SnagStatus.VERIFIED}>
                        VERIFIED (Checked)
                      </option>
                      <option value={SnagStatus.CLOSED}>CLOSED (Final)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-disabled uppercase mb-1.5">
                      Attach Proof / Evidence
                    </label>
                    <label className="w-full bg-surface-card border-dashed border-2 border-border-default rounded-xl px-4 py-4 text-sm font-medium cursor-pointer flex flex-col items-center justify-center text-text-disabled hover:bg-surface-base transition-all">
                      {updateFile ? (
                        <span className="text-success font-bold">
                          {updateFile.name}
                        </span>
                      ) : (
                        <>
                          <Camera size={20} className="mb-1" />{" "}
                          <span>Click to Upload Photo</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setUpdateFile(e.target.files?.[0] || null)
                        }
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-text-disabled mt-2 italic text-center">
                      Required for de-snagging (Rectified stage)
                    </p>
                  </div>

                  <button
                    onClick={handleUpdateStatus}
                    className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-primary-dark transition-all active:scale-[0.98] mt-4"
                  >
                    Update Snag status
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
