import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  X,
  Search,
  AlertCircle,
  Eye,
  CheckCircle2,
  Clock,
  Upload,
  Loader2,
  Layers,
} from "lucide-react";
import api from "../../../api/axios";
import { getPublicFileUrl } from "../../../api/baseUrl";
import { useAuth } from "../../../context/AuthContext";
import { PermissionCode } from "../../../config/permissions";
import EpsLocationPicker from "../../../components/common/EpsLocationPicker";

interface SiteObservationPanelProps {
  projectId: number;
}

const SiteObservationPanel: React.FC<SiteObservationPanelProps> = ({
  projectId,
}) => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PermissionCode.QUALITY_SITE_OBS_CREATE);
  const canRectify = hasPermission(PermissionCode.QUALITY_SITE_OBS_RECTIFY);
  const canClose = hasPermission(PermissionCode.QUALITY_SITE_OBS_CLOSE);
  const canDelete = hasPermission(PermissionCode.QUALITY_SITE_OBS_DELETE);

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "OPEN" | "RECTIFIED" | "CLOSED" | "ALL"
  >("OPEN");
  const [page, setPage] = useState(1);

  // Modals state
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [showRectifyModal, setShowRectifyModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [savingCategories, setSavingCategories] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    projectId: projectId,
    epsNodeId: null as number | null,
    locationLabel: "",
    severity: "MINOR",
    category: "Structural",
    description: "",
    remarks: "",
    targetDate: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [rectificationText, setRectificationText] = useState("");
  const [closureRemarks, setClosureRemarks] = useState("");
  const [rejectionRemarks, setRejectionRemarks] = useState("");

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const resp = await api.get(
        `/quality/site-observations?projectId=${projectId}`,
      );
      setRecords(resp.data);
    } catch (error) {
      console.error("Failed to fetch observations", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const resp = await api.get(`/quality/site-observations/categories/${projectId}`);
      setCategories(Array.isArray(resp.data) ? resp.data : []);
    } catch (error) {
      console.error("Failed to fetch quality observation categories", error);
    }
  };

  const saveCategories = async (nextCategories: string[]) => {
    setSavingCategories(true);
    try {
      const resp = await api.put(
        `/quality/site-observations/categories/${projectId}`,
        { categories: nextCategories },
      );
      setCategories(Array.isArray(resp.data) ? resp.data : nextCategories);
      return true;
    } catch (error) {
      console.error("Failed to update quality observation categories", error);
      alert("Failed to update categories");
      return false;
    } finally {
      setSavingCategories(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchCategories();
  }, [projectId]);

  useEffect(() => {
    if (categories.length === 0) return;
    if (!categories.includes(formData.category)) {
      setFormData((prev) => ({ ...prev, category: categories[0] }));
    }
  }, [categories, formData.category]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, records.length]);

  const filteredRecords = useMemo(() => {
    let filtered = records;
    if (activeTab === "OPEN") {
      filtered = records.filter((r) => r.status === "OPEN" || r.status === "HELD");
    } else if (activeTab !== "ALL") {
      filtered = records.filter((r) => r.status === activeTab);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.epsNode?.name && r.epsNode.name.toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [records, activeTab, searchQuery]);

  const tabCounts = {
    OPEN: records.filter((r) => r.status === "OPEN" || r.status === "HELD").length,
    RECTIFIED: records.filter((r) => r.status === "RECTIFIED").length,
    CLOSED: records.filter((r) => r.status === "CLOSED").length,
    ALL: records.length,
  };
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pagedRecords = filteredRecords.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  // Helpers
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return { border: "bg-error", badge: "bg-error-muted text-red-700" };
      case "MAJOR":
        return {
          border: "bg-orange-500",
          badge: "bg-orange-50 text-orange-700",
        };
      case "MINOR":
        return {
          border: "bg-primary",
          badge: "bg-primary-muted text-blue-700",
        };
      case "INFO":
        return {
          border: "bg-gray-400",
          badge: "bg-surface-raised text-text-secondary",
        };
      default:
        return {
          border: "bg-gray-200",
          badge: "bg-surface-base text-text-muted",
        };
    }
  };

  const getDaysOpen = (createdAt: string) => {
    const days = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 86400000,
    );
    if (days === 0) return { text: "Today", color: "text-success" };
    if (days === 1) return { text: "1 day ago", color: "text-success" };
    if (days <= 3) return { text: `${days} days ago`, color: "text-success" };
    if (days <= 7) return { text: `${days} days ago`, color: "text-warning" };
    return { text: `${days} days ago`, color: "text-error font-bold" };
  };

  const getFileUrl = (path: string) => {
    return getPublicFileUrl(path);
  };

  // Handlers
  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await api.post("/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      urls.push(resp.data.url);
    }
    return urls;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.epsNodeId && formData.severity !== "INFO") {
      alert("Location is required.");
      return;
    }

    setUploading(true);
    try {
      const photoUrls = await uploadFiles(photos);
      const payload = { ...formData, photos: photoUrls };
      await api.post("/quality/site-observations", payload);

      setShowRaiseModal(false);
      setFormData({
        projectId,
        epsNodeId: null,
        locationLabel: "",
        severity: "MINOR",
        category: categories[0] || "Structural",
        description: "",
        remarks: "",
        targetDate: "",
      });
      setPhotos([]);
      fetchRecords();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to create observation");
    } finally {
      setUploading(false);
    }
  };

  const handleRectifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const photoUrls = await uploadFiles(photos);
      await api.patch(
        `/quality/site-observations/${selectedRecord.id}/rectify`,
        {
          rectificationText,
          rectificationPhotos: photoUrls,
        },
      );
      setShowRectifyModal(false);
      setRectificationText("");
      setPhotos([]);
      fetchRecords();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to submit rectification");
    } finally {
      setUploading(false);
    }
  };

  const handleCloseSubmit = async () => {
    if (!confirm("Proceed to formally close this observation?")) return;
    setUploading(true);
    try {
      await api.patch(`/quality/site-observations/${selectedRecord.id}/close`, {
        closureRemarks,
      });
      setShowCloseModal(false);
      setClosureRemarks("");
      fetchRecords();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to close observation");
    } finally {
      setUploading(false);
    }
  };

  const handleRejectRectification = async () => {
    if (!confirm("Reject this rectification and reopen the observation?")) return;
    setUploading(true);
    try {
      await api.patch(
        `/quality/site-observations/${selectedRecord.id}/reject-rectification`,
        { rejectionRemarks },
      );
      setShowCloseModal(false);
      setClosureRemarks("");
      setRejectionRemarks("");
      fetchRecords();
    } catch (error: any) {
      alert(
        error.response?.data?.message || "Failed to reject rectification",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleHoldObservation = async () => {
    if (!selectedRecord) return;
    const holdReason = prompt(
      "Enter the reason for holding/freezing this observation:",
      selectedRecord.holdReason || "",
    );
    if (holdReason === null) return;
    setUploading(true);
    try {
      await api.patch(`/quality/site-observations/${selectedRecord.id}/hold`, {
        holdReason,
      });
      fetchRecords();
      setShowCloseModal(false);
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to hold observation");
    } finally {
      setUploading(false);
    }
  };

  const handleUnholdObservation = async () => {
    if (!selectedRecord) return;
    setUploading(true);
    try {
      await api.patch(`/quality/site-observations/${selectedRecord.id}/unhold`);
      fetchRecords();
      setShowCloseModal(false);
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to unfreeze observation");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to PERMANENTLY delete this observation? This action cannot be undone.",
      )
    )
      return;
    try {
      await api.delete(`/quality/site-observations/${id}`);
      fetchRecords();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to delete");
    }
  };

  const renderPhotos = (paths: string[]) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {paths.map((p, i) => (
        <a
          key={i}
          href={getFileUrl(p)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={getFileUrl(p)}
            alt="evidence"
            className="w-16 h-16 object-cover rounded-lg border border-border-default hover:opacity-80 transition-opacity"
          />
        </a>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 bg-surface-card px-4 py-2.5 rounded-xl border border-border-subtle shadow-sm w-full md:w-96">
          <Search className="w-4 h-4 text-text-disabled" />
          <input
            type="text"
            placeholder="Search observations..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {canCreate && (
          <button
            onClick={() => {
              setFormData({
                ...formData,
                severity: "MINOR",
                category: categories.includes(formData.category)
                  ? formData.category
                  : (categories[0] || "Structural"),
              });
              setShowRaiseModal(true);
            }}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-blue-200 font-bold shrink-0"
          >
            <Plus className="w-4 h-4" /> Raise Observation
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-default">
        {(["OPEN", "RECTIFIED", "CLOSED", "ALL"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-sm transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-base"
            }`}
          >
            {tab === "OPEN" && <AlertCircle className="w-4 h-4" />}
            {tab === "RECTIFIED" && <Clock className="w-4 h-4" />}
            {tab === "CLOSED" && <CheckCircle2 className="w-4 h-4" />}
            {tab === "ALL" && <Layers className="w-4 h-4" />}
            {tab === "OPEN"
              ? "Pending"
              : tab === "ALL"
                ? "All Records"
                : tab === "RECTIFIED"
                  ? "Rectified"
                  : "Closed"}
            <span
              className={`ml-1 px-2 py-0.5 rounded-full text-xs ${activeTab === tab ? "bg-info-muted text-blue-700" : "bg-surface-raised text-text-muted"}`}
            >
              {tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center p-12 text-text-disabled">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-surface-card rounded-2xl p-12 text-center border border-border-subtle">
          <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text-primary">
            No Observations Found
          </h3>
          <p className="text-text-muted mt-1">
            There are no records matching your criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-card shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-base text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Aging</th>
                  <th className="px-4 py-3 text-left">Target</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map((item) => {
                  const style = getSeverityStyle(item.severity);
                  const age = getDaysOpen(item.createdAt);
                  const isHeld = item.status === "HELD";
                  return (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-t border-border-subtle hover:bg-surface-base"
                      onClick={() => {
                        setSelectedRecord(item);
                        setShowCloseModal(true);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-surface-raised px-2 py-1 text-[10px] font-bold uppercase text-text-secondary">
                            {item.status}
                          </span>
                          {item.rectificationRejectedAt && item.status === "OPEN" && (
                            <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold uppercase text-rose-700">
                              Reopened
                            </span>
                          )}
                          {isHeld && (
                            <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-700">
                              Frozen
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${style.badge}`}>
                          {item.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-text-secondary">
                        {item.category}
                      </td>
                      <td
                        className="max-w-[220px] truncate px-4 py-3 text-text-secondary"
                        title={item.locationLabel || item.epsNode?.name || "General Site"}
                      >
                        {item.locationLabel || item.epsNode?.name || "General Site"}
                      </td>
                      <td className="max-w-[320px] truncate px-4 py-3 font-medium text-text-primary">
                        {item.description}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-xs ${age.color}`}>{age.text}</div>
                        {typeof item.ageingDays === "number" && (
                          <div className="text-[11px] text-text-muted">
                            {item.ageingDays.toFixed(1)} days
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {item.targetDate
                          ? new Date(item.targetDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex justify-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setSelectedRecord(item);
                              setShowCloseModal(true);
                            }}
                            className="rounded-lg bg-surface-base px-3 py-2 text-xs font-bold text-text-secondary hover:bg-surface-raised"
                          >
                            View
                          </button>
                          {item.status === "OPEN" &&
                            canRectify &&
                            item.severity !== "INFO" && (
                              <button
                                onClick={() => {
                                  setSelectedRecord(item);
                                  setShowRectifyModal(true);
                                }}
                                className="rounded-lg bg-warning-muted px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
                              >
                                Rectify
                              </button>
                            )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="rounded-lg px-3 py-2 text-xs font-bold text-error hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRecords.length)} of {filteredRecords.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="rounded-lg border border-border-default px-3 py-1.5 disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-border-default px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---> MODAL: RAISE OBSERVATION <--- */}
      {showRaiseModal &&
        createPortal(
        <div className="fixed inset-0 bg-surface-overlay backdrop-blur-sm z-[100] p-4 md:p-6">
          <div className="bg-surface-card rounded-3xl shadow-2xl w-full h-full overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="p-5 md:p-6 border-b flex justify-between items-center bg-surface-base shrink-0">
              <div>
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" /> Raise Site Observation
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  Record the observation with full location, severity, rectification target, and evidence in a dedicated full-screen form.
                </p>
              </div>
              <button
                onClick={() => setShowRaiseModal(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto flex-1">
              <form
                id="raise-form"
                onSubmit={handleCreateSubmit}
                className="space-y-6 max-w-6xl mx-auto"
              >
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                      Severity
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["INFO", "MINOR", "MAJOR", "CRITICAL"].map((sev) => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, severity: sev })
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            formData.severity === sev
                              ? sev === "CRITICAL"
                                ? "bg-error text-white border-error"
                                : sev === "MAJOR"
                                  ? "bg-orange-500 text-white border-orange-500"
                                  : sev === "MINOR"
                                    ? "bg-primary text-white border-primary"
                                    : "bg-gray-600 text-white border-gray-600"
                              : "bg-surface-card text-text-secondary border-border-default hover:bg-surface-base"
                          }`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                    {formData.severity === "INFO" && (
                      <p className="text-[10px] text-text-muted mt-1 italic">
                        * INFO items can be closed directly without a formal
                        rectification step.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                      Category
                    </label>
                    <select
                      className="w-full bg-surface-base border border-border-default rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Add category"
                        className="flex-1 bg-surface-card border border-border-default rounded-xl px-3 py-2 text-sm"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={savingCategories || !newCategory.trim()}
                        onClick={async () => {
                          const candidate = newCategory.trim();
                          if (!candidate) return;
                          if (
                            categories.some(
                              (item) => item.toLowerCase() === candidate.toLowerCase(),
                            )
                          ) {
                            setFormData({ ...formData, category: candidate });
                            setNewCategory("");
                            return;
                          }
                          const nextCategories = [...categories, candidate];
                          const saved = await saveCategories(nextCategories);
                          if (saved) {
                            setFormData({ ...formData, category: candidate });
                            setNewCategory("");
                          }
                        }}
                        className="rounded-xl border border-border-default px-4 py-2 text-sm font-bold text-text-secondary disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                        Location *
                      </label>
                      <EpsLocationPicker
                        projectId={projectId}
                        value={formData.epsNodeId}
                        onChange={(id, label) =>
                          setFormData({ ...formData, epsNodeId: id, locationLabel: label })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                        Description *
                      </label>
                      <textarea
                        required
                        rows={10}
                        placeholder="Describe the defect or observation found..."
                        className="w-full bg-surface-base border border-border-default rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl border border-border-subtle bg-surface-base p-5">
                      <h3 className="text-sm font-bold text-text-primary mb-4">
                        Execution Details
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                            Target Rectification Date
                          </label>
                          <input
                            type="date"
                            className="w-full bg-surface-card border border-border-default rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary"
                            value={formData.targetDate}
                            onChange={(e) =>
                              setFormData({ ...formData, targetDate: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                            Remarks (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Internal notes"
                            className="w-full bg-surface-card border border-border-default rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary"
                            value={formData.remarks}
                            onChange={(e) =>
                              setFormData({ ...formData, remarks: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border-subtle bg-surface-base p-5">
                      <h3 className="text-sm font-bold text-text-primary mb-4">
                        Evidence Photos
                      </h3>
                      <div className="flex gap-2 flex-wrap">
                        {photos.map((p, i) => (
                          <div key={i} className="relative w-24 h-24 group">
                            <img
                              src={URL.createObjectURL(p)}
                              alt="preview"
                              className="w-full h-full object-cover rounded-lg border border-border-default"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPhotos(photos.filter((_, idx) => idx !== i))
                              }
                              className="absolute top-1 right-1 bg-error text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <label className="w-24 h-24 border-2 border-dashed border-border-strong rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-surface-base hover:border-blue-400 transition-colors">
                          <Upload className="w-5 h-5 text-text-disabled" />
                          <span className="text-[9px] text-text-muted mt-1 font-medium">
                            Add Photo
                          </span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files)
                                setPhotos([
                                  ...photos,
                                  ...Array.from(e.target.files),
                                ]);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-5 border-t bg-surface-base flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowRaiseModal(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-text-secondary bg-surface-card border border-border-default hover:bg-surface-base"
              >
                Cancel
              </button>
              <button
                form="raise-form"
                type="submit"
                disabled={uploading}
                className="px-8 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? "Processing..." : "Submit Observation"}
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}

      {/* ---> MODAL: RECTIFY OBSERVATION <--- */}
      {showRectifyModal &&
        selectedRecord &&
        createPortal(
        <div className="fixed inset-0 bg-surface-overlay backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 border-b bg-warning-muted flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 text-amber-800">
                <Clock className="w-5 h-5" /> Submit Rectification
              </h2>
              <button
                onClick={() => {
                  setShowRectifyModal(false);
                  setPhotos([]);
                }}
                className="p-2 hover:bg-amber-100 rounded-full text-amber-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-surface-base border border-border-default rounded-xl p-4 mb-6">
                <p className="text-xs font-bold text-text-disabled uppercase mb-1">
                  Issue Raised
                </p>
                <p className="text-sm font-semibold text-text-primary">
                  {selectedRecord.description}
                </p>
              </div>

              <form
                id="rectify-form"
                onSubmit={handleRectifySubmit}
                className="space-y-5"
              >
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                    Action Taken *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe how the issue was fixed..."
                    className="w-full bg-surface-base border border-border-default rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    value={rectificationText}
                    onChange={(e) => setRectificationText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-2">
                    Rectification Evidence (Photos)
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {photos.map((p, i) => (
                      <div key={i} className="relative w-20 h-20 group">
                        <img
                          src={URL.createObjectURL(p)}
                          alt="preview"
                          className="w-full h-full object-cover rounded-lg border border-border-default"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPhotos(photos.filter((_, idx) => idx !== i))
                          }
                          className="absolute top-1 right-1 bg-error text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-20 h-20 border-2 border-dashed border-border-strong rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-surface-base hover:border-amber-400 transition-colors">
                      <Upload className="w-5 h-5 text-text-disabled" />
                      <span className="text-[9px] text-text-muted mt-1 font-medium">
                        Add Photo
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files)
                            setPhotos([
                              ...photos,
                              ...Array.from(e.target.files),
                            ]);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-5 border-t bg-surface-base flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRectifyModal(false);
                  setPhotos([]);
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-text-secondary border border-border-default hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                form="rectify-form"
                type="submit"
                disabled={uploading || !rectificationText}
                className="px-8 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {uploading ? "Processing..." : "Submit Fix"}
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}

      {/* ---> MODAL: VIEW / CLOSE RECORD <--- */}
      {showCloseModal &&
        selectedRecord &&
        createPortal(
        <div className="fixed inset-0 bg-surface-overlay backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-surface-base shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Eye className="w-5 h-5 text-success" /> Observation Details
              </h2>
              <button
                onClick={() => setShowCloseModal(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Original Details */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-surface-base rounded-xl p-4 border border-border-subtle">
                <div>
                  <p className="text-[10px] font-bold text-text-disabled uppercase">
                    Status
                  </p>
                  <p className="text-sm font-bold text-text-primary">
                    {selectedRecord.status}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-disabled uppercase">
                    Severity
                  </p>
                  <p className="text-sm font-bold text-text-primary">
                    {selectedRecord.severity}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-disabled uppercase">
                    Location
                  </p>
                  <p className="text-sm font-bold text-text-primary">
                    {selectedRecord.locationLabel || selectedRecord.epsNode?.name || "General"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-disabled uppercase">
                    Raised On
                  </p>
                  <p className="text-sm font-bold text-text-primary">
                    {new Date(selectedRecord.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-disabled uppercase">
                    Aging
                  </p>
                  <p className="text-sm font-bold text-text-primary">
                    {typeof selectedRecord.ageingDays === "number"
                      ? `${selectedRecord.ageingDays.toFixed(1)} days`
                      : "-"}
                  </p>
                </div>
              </div>

              {canClose && (
                <div className="flex flex-wrap gap-3">
                  {selectedRecord.status === "HELD" ? (
                    <button
                      onClick={handleUnholdObservation}
                      disabled={uploading}
                      className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Unfreeze For Rectification
                    </button>
                  ) : selectedRecord.status !== "CLOSED" ? (
                    <button
                      onClick={handleHoldObservation}
                      disabled={uploading}
                      className="rounded-xl bg-slate-600 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      Hold / Freeze Aging
                    </button>
                  ) : null}
                  {selectedRecord.holdReason && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                      Hold Reason: {selectedRecord.holdReason}
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-text-primary mb-2 border-b border-border-subtle pb-2">
                  Observation
                </h3>
                <p className="text-text-secondary text-sm">
                  {selectedRecord.description}
                </p>
                {selectedRecord.photos?.length > 0 && (
                  <div className="mt-3">
                    {renderPhotos(selectedRecord.photos)}
                  </div>
                )}
              </div>

              {/* Rectification Details */}
              {(selectedRecord.status !== "OPEN" ||
                selectedRecord.rectificationText ||
                selectedRecord.rectificationRejectedAt) &&
                selectedRecord.severity !== "INFO" && (
                  <div className="bg-primary-muted/50 rounded-xl p-5 border border-blue-100">
                    <h3 className="text-sm font-bold text-blue-900 mb-2 border-b border-blue-100 pb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />{" "}
                      Contractor Rectification
                    </h3>
                    <p className="text-blue-800 text-sm">
                      {selectedRecord.rectificationText}
                    </p>
                    <p className="text-[10px] font-bold text-blue-400 mt-2 uppercase">
                      Fixed on:{" "}
                      {new Date(
                        selectedRecord.rectifiedAt,
                      ).toLocaleDateString()}
                    </p>
                    {selectedRecord.rectificationPhotos?.length > 0 && (
                      <div className="mt-3">
                        {renderPhotos(selectedRecord.rectificationPhotos)}
                      </div>
                    )}
                    {selectedRecord.rectificationRejectedAt && (
                      <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
                        <p className="text-xs font-bold uppercase text-rose-800">
                          Rectification Rejected
                        </p>
                        <p className="mt-1 text-sm text-rose-700">
                          {selectedRecord.rectificationRejectedRemarks ||
                            "Rectification did not meet the required standard."}
                        </p>
                      </div>
                    )}
                  </div>
                )}

              {selectedRecord.status === "CLOSED" && (
                <div className="bg-success-muted rounded-xl p-5 border border-emerald-100">
                  <h3 className="text-sm font-bold text-emerald-900 mb-1">
                    Closure Remarks
                  </h3>
                  <p className="text-emerald-800 text-sm">
                    {selectedRecord.closureRemarks || "Closed successfully."}
                  </p>
                </div>
              )}

              {Array.isArray(selectedRecord.rectificationHistory) &&
                selectedRecord.rectificationHistory.length > 0 && (
                  <div className="rounded-xl border border-border-subtle bg-surface-card p-5">
                    <h3 className="text-sm font-bold text-text-primary mb-3">
                      Rectification History
                    </h3>
                    <div className="space-y-3">
                      {selectedRecord.rectificationHistory.map(
                        (entry: any, index: number) => (
                          <div
                            key={`${entry.at}-${index}`}
                            className="rounded-lg border border-border-subtle bg-surface-base p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold uppercase text-text-secondary">
                                {entry.type}
                              </span>
                              <span className="text-xs text-text-muted">
                                {entry.at
                                  ? new Date(entry.at).toLocaleString()
                                  : ""}
                              </span>
                            </div>
                            {entry.text && (
                              <p className="mt-2 text-sm text-text-secondary">
                                {entry.text}
                              </p>
                            )}
                            {entry.rejectionRemarks && (
                              <p className="mt-2 text-sm text-rose-700">
                                Reason: {entry.rejectionRemarks}
                              </p>
                            )}
                            {entry.photos?.length > 0 && (
                              <div className="mt-2">{renderPhotos(entry.photos)}</div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* Close Action Area */}
              {((selectedRecord.status === "RECTIFIED" && canClose) ||
                (selectedRecord.status === "OPEN" &&
                  selectedRecord.severity === "INFO" &&
                  canClose)) && (
                <div className="bg-surface-card rounded-xl border border-border-default p-5 mt-6 shadow-sm">
                  <h3 className="text-sm font-bold text-text-primary mb-3">
                    QC Verification & Closure
                  </h3>
                  <textarea
                    rows={2}
                    placeholder="Optional clearance remarks..."
                    className="w-full bg-surface-base border border-border-default rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none mb-3"
                    value={closureRemarks}
                    onChange={(e) => setClosureRemarks(e.target.value)}
                  />
                  {selectedRecord.status === "RECTIFIED" && (
                    <textarea
                      rows={2}
                      placeholder="Reason for rejecting this rectification..."
                      className="w-full bg-surface-base border border-rose-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none mb-3"
                      value={rejectionRemarks}
                      onChange={(e) => setRejectionRemarks(e.target.value)}
                    />
                  )}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={handleCloseSubmit}
                      disabled={uploading}
                      className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Formally Close
                      Observation
                    </button>
                    {selectedRecord.status === "RECTIFIED" && (
                      <button
                        onClick={handleRejectRectification}
                        disabled={uploading}
                        className="flex-1 py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <X className="w-5 h-5" /> Reject Rectification
                      </button>
                    )}
                  </div>
                  {selectedRecord.severity === "INFO" && (
                    <p className="text-[10px] text-text-disabled mt-2 text-center text-balance">
                      Note: INFO items skip rectification and can be closed
                      immediately.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
};

export default SiteObservationPanel;
