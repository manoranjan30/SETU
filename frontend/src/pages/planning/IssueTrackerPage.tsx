import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Flag,
  Kanban,
  LayoutList,
  Plus,
  RefreshCw,
  Settings,
  Tag,
  X,
} from "lucide-react";
import {
  issueTrackerService,
  type DeptProjectConfig,
  type GlobalDepartment,
  type IssuePriority,
  type IssueTrackerIssue,
  type IssueTrackerStep,
  type IssueTrackerTag,
  type KanbanColumn,
} from "../../services/issueTracker.service";

type UserOption = { id: number; username: string; fullName?: string | null };
type ViewMode = "kanban" | "list";

// ─── Priority helpers ─────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<IssuePriority, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: "Critical", color: "#DC2626", bg: "#FEE2E2" },
  HIGH:     { label: "High",     color: "#EA580C", bg: "#FED7AA" },
  MEDIUM:   { label: "Medium",   color: "#D97706", bg: "#FEF3C7" },
  LOW:      { label: "Low",      color: "#059669", bg: "#D1FAE5" },
};

function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <Flag size={10} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: "bg-blue-50 text-blue-600",
    IN_PROGRESS: "bg-amber-50 text-amber-600",
    COMPLETED: "bg-green-50 text-green-600",
    CLOSED: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || "bg-gray-100 text-gray-500"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ─── Issue Card (for list + kanban) ──────────────────────────────────────────
function IssueCard({
  issue,
  onSelect,
}: {
  issue: IssueTrackerIssue;
  onSelect: (issue: IssueTrackerIssue) => void;
}) {
  const isOverdue =
    issue.requiredDate &&
    issue.requiredDate < new Date().toISOString().slice(0, 10) &&
    issue.status !== "CLOSED" &&
    issue.status !== "COMPLETED";

  return (
    <div
      onClick={() => onSelect(issue)}
      className="p-3 bg-surface-card border border-border rounded-xl cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-text-muted">{issue.issueNumber || `#${issue.id}`}</span>
        <PriorityBadge priority={issue.priority} />
      </div>
      <p className="text-sm font-medium text-text-primary leading-snug mb-2 line-clamp-2">{issue.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={issue.status} />
        {isOverdue && (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle size={11} /> Overdue
          </span>
        )}
        {issue.attachmentCount > 0 && (
          <span className="text-xs text-text-muted">{issue.attachmentCount} file(s)</span>
        )}
      </div>
      {issue.requiredDate && (
        <p className="text-xs text-text-muted mt-2 flex items-center gap-1">
          <Clock size={10} /> Due {issue.requiredDate}
        </p>
      )}
      {issue.tagNames?.length ? (
        <div className="flex gap-1 flex-wrap mt-2">
          {issue.tagNames.slice(0, 3).map((t, i) => (
            <span key={i} className="text-xs bg-surface-page text-text-muted px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Issue Detail Modal ───────────────────────────────────────────────────────
function IssueDetailModal({
  issue,
  projectId,
  onClose,
  onRefresh,
}: {
  issue: IssueTrackerIssue;
  projectId: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"flow" | "log" | "attachments">("flow");
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  const [responseForm, setResponseForm] = useState({ responseText: "", committedCompletionDate: "", reason: "" });
  const [coordRemarks, setCoordRemarks] = useState("");
  const [closeRemarks, setCloseRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === "log") {
      setLoadingLog(true);
      issueTrackerService.getActivityLog(projectId, issue.id)
        .then(setActivityLog)
        .finally(() => setLoadingLog(false));
    }
  }, [activeTab]);

  const activeStep = issue.steps.find((s) => s.status === "ACTIVE");
  const pendingSteps = issue.steps.filter((s) => s.status === "PENDING");
  const completedSteps = issue.steps.filter((s) => s.status === "COMPLETED");

  const handleRespond = async () => {
    if (!responseForm.responseText.trim()) return;
    setSubmitting(true);
    try {
      await issueTrackerService.respondToIssue(projectId, issue.id, {
        responseText: responseForm.responseText,
        committedCompletionDate: responseForm.committedCompletionDate || undefined,
        reason: responseForm.reason || undefined,
      });
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCoordClose = async () => {
    setSubmitting(true);
    try {
      await issueTrackerService.coordinatorCloseStep(projectId, issue.id, coordRemarks);
      setCoordRemarks("");
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalClose = async () => {
    if (!confirm("Officially close this issue?")) return;
    setSubmitting(true);
    try {
      await issueTrackerService.closeIssue(projectId, issue.id, { closedRemarks: closeRemarks });
      onClose();
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePriorityChange = async (p: IssuePriority) => {
    await issueTrackerService.updatePriority(projectId, issue.id, p);
    onRefresh();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full flex-col bg-surface-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border shrink-0 px-5 py-4 md:px-7 md:py-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-text-muted">{issue.issueNumber || `#${issue.id}`}</span>
              <StatusBadge status={issue.status} />
              <PriorityBadge priority={issue.priority} />
            </div>
            <h2 className="text-base font-semibold text-text-primary">{issue.title}</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Raised by {issue.raisedByName || "Unknown"} •{" "}
              {new Date(issue.raisedDate).toLocaleDateString()}
              {issue.requiredDate && ` • Due ${issue.requiredDate}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Priority selector */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0 bg-surface-page">
          <span className="text-xs text-text-muted font-medium">Priority:</span>
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as IssuePriority[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePriorityChange(p)}
              className={`text-xs px-2 py-1 rounded-full transition-all ${issue.priority === p ? "ring-2 ring-offset-1 ring-gray-400" : "opacity-60 hover:opacity-100"}`}
              style={{
                color: PRIORITY_CONFIG[p].color,
                backgroundColor: PRIORITY_CONFIG[p].bg,
              }}
            >
              {PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 shrink-0">
          {(["flow", "log", "attachments"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              {tab === "flow" ? "Department Flow" : tab === "log" ? "Activity Log" : "Attachments"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-4 bg-surface-base">
          {activeTab === "flow" && (
            <>
              {/* Description */}
              <div className="text-sm text-text-secondary bg-surface-page rounded-xl p-3 whitespace-pre-wrap">
                {issue.description}
              </div>

              {/* Flow stepper */}
              <div className="space-y-2">
                {[...completedSteps, ...(activeStep ? [activeStep] : []), ...pendingSteps].map((step) => (
                  <StepRow key={step.id} step={step} />
                ))}
              </div>

              {/* Member respond */}
              {issue.canRespond && activeStep && (
                <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-blue-700">
                    Respond — {activeStep.departmentName}
                  </h4>
                  <textarea
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                    rows={3}
                    placeholder="Describe your response / action taken…"
                    value={responseForm.responseText}
                    onChange={(e) => setResponseForm({ ...responseForm, responseText: e.target.value })}
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-text-muted mb-1">Commitment Date</label>
                      <input
                        type="date"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                        value={responseForm.committedCompletionDate}
                        onChange={(e) => setResponseForm({ ...responseForm, committedCompletionDate: e.target.value })}
                      />
                    </div>
                  </div>
                  {activeStep.committedCompletionDate && (
                    <input
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                      placeholder="Reason for changing commitment date (required if changing)"
                      value={responseForm.reason}
                      onChange={(e) => setResponseForm({ ...responseForm, reason: e.target.value })}
                    />
                  )}
                  <button
                    onClick={handleRespond}
                    disabled={submitting || !responseForm.responseText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit Response"}
                  </button>
                </div>
              )}

              {/* Coordinator close */}
              {issue.canCoordinatorClose && activeStep && (
                <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-green-700">
                    Coordinator Close — {activeStep.departmentName}
                  </h4>
                  <p className="text-xs text-green-600">
                    Member has responded. As coordinator, close this department's step to advance the issue.
                  </p>
                  <textarea
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                    rows={2}
                    placeholder="Coordinator remarks (optional)"
                    value={coordRemarks}
                    onChange={(e) => setCoordRemarks(e.target.value)}
                  />
                  <button
                    onClick={handleCoordClose}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? "Closing…" : "Close Department Step →"}
                  </button>
                </div>
              )}

              {/* Final close */}
              {issue.canClose && (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-text-primary">Final Close</h4>
                  <p className="text-xs text-text-muted">All departments completed. Officially close this issue.</p>
                  <textarea
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-page resize-none focus:outline-none"
                    rows={2}
                    placeholder="Closing remarks (optional)"
                    value={closeRemarks}
                    onChange={(e) => setCloseRemarks(e.target.value)}
                  />
                  <button
                    onClick={handleFinalClose}
                    disabled={submitting}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    Close Issue
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === "log" && (
            <div className="space-y-3">
              {loadingLog ? (
                <div className="text-center py-6 text-text-muted">Loading…</div>
              ) : activityLog.length === 0 ? (
                <div className="text-center py-6 text-text-muted">No activity yet.</div>
              ) : (
                activityLog.map((entry) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-text-primary">{entry.detail || entry.action}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {entry.actorName} • {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "attachments" && (
            <div className="text-center py-10 text-text-muted text-sm">
              Attachment upload is available via API. UI upload coming soon.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function StepRow({ step }: { step: IssueTrackerStep }) {
  const [expanded, setExpanded] = useState(step.status === "ACTIVE");

  const statusColors = {
    PENDING: "bg-gray-100 text-gray-500",
    ACTIVE: "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
    COMPLETED: "bg-green-100 text-green-700",
  };

  return (
    <div className={`rounded-xl border ${step.status === "ACTIVE" ? "border-amber-200" : "border-border"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColors[step.status]}`}>
          {step.status}
        </div>
        <span className="text-sm font-medium text-text-primary flex-1">{step.departmentName}</span>
        {step.status === "ACTIVE" && !step.memberRespondedAt && (
          <span className="text-xs text-amber-600">Awaiting member response</span>
        )}
        {step.memberRespondedAt && !step.coordinatorClosedAt && (
          <span className="text-xs text-green-600">Awaiting coordinator close</span>
        )}
        {step.coordinatorClosedAt && (
          <span className="text-xs text-text-muted">
            Closed {new Date(step.coordinatorClosedAt).toLocaleDateString()}
          </span>
        )}
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {expanded && (step.responseText || step.committedCompletionDate || (step.committedDateHistory?.length ?? 0) > 0 || step.coordinatorRemarks) && (
        <div className="px-4 pb-4 space-y-2 border-t border-border">
          {step.responseText && (
            <p className="text-sm text-text-secondary mt-3">{step.responseText}</p>
          )}
          {step.committedCompletionDate && (
            <p className="text-xs text-text-muted">
              Commitment: <strong>{step.committedCompletionDate}</strong>
            </p>
          )}
          {(step.committedDateHistory?.length ?? 0) > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-text-muted mb-1">Commitment Date History:</p>
              {step.committedDateHistory!.map((h, i) => (
                <p key={i} className="text-xs text-text-muted">
                  {h.previousDate} → {h.newDate} by {h.changedByName} — "{h.reason}"
                </p>
              ))}
            </div>
          )}
          {step.coordinatorRemarks && (
            <p className="text-xs text-green-700 mt-1">
              Coordinator: "{step.coordinatorRemarks}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create Issue Modal ───────────────────────────────────────────────────────
function CreateIssueModal({
  projectId,
  tags,
  onClose,
  onCreated,
}: {
  projectId: number;
  tags: IssueTrackerTag[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    requiredDate: "",
    priority: "MEDIUM" as IssuePriority,
    tagIds: [] as number[],
  });
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (id: number) => {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter((x) => x !== id) : [...f.tagIds, id],
    }));
  };

  const submit = async () => {
    if (!form.title.trim() || !form.tagIds.length) return;
    setSubmitting(true);
    try {
      await issueTrackerService.createIssue(projectId, {
        title: form.title.trim(),
        description: form.description.trim(),
        tagIds: form.tagIds,
        requiredDate: form.requiredDate || undefined,
        priority: form.priority,
      });
      onCreated();
      onClose();
    } catch (error: any) {
      const message = Array.isArray(error?.response?.data?.message)
        ? error.response.data.message.join(", ")
        : error?.response?.data?.message || "Failed to create issue.";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  const tagsByDept = useMemo(() => {
    const map = new Map<number, { deptName: string; tags: IssueTrackerTag[] }>();
    for (const tag of tags) {
      if (!tag.isActive) continue;
      const entry = map.get(tag.departmentId) || { deptName: tag.departmentName || "Unknown", tags: [] };
      entry.tags.push(tag);
      map.set(tag.departmentId, entry);
    }
    return map;
  }, [tags]);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full flex-col bg-surface-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 md:px-7 md:py-5 shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Create Issue</h2>
            <p className="mt-1 text-sm text-text-muted">
              Fill the full issue details without losing visibility of tags,
              dates, and departments.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-border-default p-2 text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 bg-surface-base p-5 md:p-7">
          <div className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
            <div className="space-y-5">
              <div className="rounded-2xl border border-border-default bg-surface-card p-5 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Title *</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief issue title"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none resize-none"
              rows={10}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed description of the issue"
            />
          </div>
          <div className="flex gap-3 lg:col-span-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1">Priority</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as IssuePriority })}
              >
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1">Required By</label>
              <input
                type="date"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none"
                value={form.requiredDate}
                onChange={(e) => setForm({ ...form, requiredDate: e.target.value })}
              />
            </div>
          </div>
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border border-border-default bg-surface-card p-5 shadow-sm">
              <label className="block text-xs font-medium text-text-secondary mb-2">Tags * (select which departments are involved)</label>
              <div className="max-h-[52vh] overflow-y-auto pr-1">
                {[...tagsByDept.entries()].map(([deptId, { deptName, tags: deptTags }]) => (
                  <div key={deptId} className="mb-4 last:mb-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{deptName}</p>
                    <div className="flex gap-2 flex-wrap">
                      {deptTags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            form.tagIds.includes(tag.id)
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-surface-page text-text-secondary border-border hover:border-blue-400"
                          }`}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {tagsByDept.size === 0 && (
                  <p className="text-xs text-text-muted">No tags defined for this project. Set up tags in the Tags tab first.</p>
                )}
              </div>
              <div className="mt-4 rounded-xl bg-surface-base p-3 text-xs text-text-muted">
                Selected departments: <span className="font-semibold text-text-primary">{form.tagIds.length}</span>
              </div>
            </aside>
          </div>
        </div>

        <div className="flex gap-3 border-t border-border bg-surface-card px-5 py-4 md:px-7 shrink-0">
          <button
            onClick={submit}
            disabled={submitting || !form.title.trim() || !form.tagIds.length}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Issue"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Dept Config Modal ────────────────────────────────────────────────────────
function DeptConfigModal({
  projectId,
  users,
  onClose,
  onSaved,
}: {
  projectId: number;
  users: UserOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [globalDepts, setGlobalDepts] = useState<GlobalDepartment[]>([]);
  const [configs, setConfigs] = useState<DeptProjectConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [configForm, setConfigForm] = useState({
    memberUserIds: [] as number[],
    coordinatorUserId: "",
    coordinatorName: "",
    isIncludedInDefaultFlow: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    issueTrackerService.listDeptConfig(projectId).then((data) => {
      setGlobalDepts(data.globalDepts);
      setConfigs(data.configs);
    }).finally(() => setLoading(false));
  }, []);

  const openEdit = (deptId: number) => {
    const existing = configs.find((c) => c.departmentId === deptId);
    setEditingDeptId(deptId);
    setConfigForm({
      memberUserIds: existing?.memberUserIds || [],
      coordinatorUserId: existing?.coordinatorUserId ? String(existing.coordinatorUserId) : "",
      coordinatorName: existing?.coordinatorName || "",
      isIncludedInDefaultFlow: existing?.isIncludedInDefaultFlow ?? true,
    });
  };

  const saveConfig = async () => {
    if (!editingDeptId) return;
    setSaving(true);
    try {
      const coordinator = users.find((u) => u.id === Number(configForm.coordinatorUserId));
      await issueTrackerService.setDeptConfig(projectId, {
        departmentId: editingDeptId,
        memberUserIds: configForm.memberUserIds,
        coordinatorUserId: configForm.coordinatorUserId ? Number(configForm.coordinatorUserId) : undefined,
        coordinatorName: coordinator?.fullName || coordinator?.username || configForm.coordinatorName,
        isIncludedInDefaultFlow: configForm.isIncludedInDefaultFlow,
      });
      const data = await issueTrackerService.listDeptConfig(projectId);
      setConfigs(data.configs);
      setEditingDeptId(null);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (userId: number) => {
    setConfigForm((f) => ({
      ...f,
      memberUserIds: f.memberUserIds.includes(userId)
        ? f.memberUserIds.filter((x) => x !== userId)
        : [...f.memberUserIds, userId],
    }));
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="font-semibold text-text-primary">Project Department Configuration</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-text-muted">Loading…</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {globalDepts.map((dept) => {
              const config = configs.find((c) => c.departmentId === dept.id);
              const isEditing = editingDeptId === dept.id;
              return (
                <div key={dept.id} className="border border-border rounded-xl">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: dept.color || "#94a3b8" }} />
                    <span className="flex-1 text-sm font-medium text-text-primary">{dept.name}</span>
                    {config ? (
                      <span className="text-xs text-green-600">Configured</span>
                    ) : (
                      <span className="text-xs text-text-muted">Not assigned</span>
                    )}
                    <button
                      onClick={() => isEditing ? setEditingDeptId(null) : openEdit(dept.id)}
                      className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      {isEditing ? "Cancel" : "Configure"}
                    </button>
                  </div>

                  {isEditing && (
                    <div className="border-t border-border p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Include in default flow</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={configForm.isIncludedInDefaultFlow}
                            onChange={(e) => setConfigForm({ ...configForm, isIncludedInDefaultFlow: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm text-text-secondary">Auto-include in new issues</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Coordinator</label>
                        <select
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none"
                          value={configForm.coordinatorUserId}
                          onChange={(e) => setConfigForm({ ...configForm, coordinatorUserId: e.target.value })}
                        >
                          <option value="">None</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Members</label>
                        <div className="flex flex-wrap gap-2">
                          {users.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => toggleMember(u.id)}
                              className={`text-xs px-2 py-1 rounded-full border ${
                                configForm.memberUserIds.includes(u.id)
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "border-border text-text-secondary hover:border-blue-400"
                              }`}
                            >
                              {u.fullName || u.username}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save Configuration"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IssueTrackerPage() {
  const { projectId } = useParams();
  const pId = Number(projectId || 0);

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [activeTab, setActiveTab] = useState<"issues" | "tags" | "deptConfig">("issues");
  const [kanbanData, setKanbanData] = useState<KanbanColumn[]>([]);
  const [issues, setIssues] = useState<IssueTrackerIssue[]>([]);
  const [tags, setTags] = useState<IssueTrackerTag[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [globalDepts, setGlobalDepts] = useState<GlobalDepartment[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedIssue, setSelectedIssue] = useState<IssueTrackerIssue | null>(null);
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [showDeptConfig, setShowDeptConfig] = useState(false);

  const [filterScope, setFilterScope] = useState("all");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const [tagForm, setTagForm] = useState({ name: "", description: "", departmentId: "" });
  const [tagLoading, setTagLoading] = useState(false);

  const visibleKanbanColumns = useMemo(() => {
    const activeDepartmentColumns = kanbanData.filter(
      (column) => column.issues.length > 0,
    );
    const emptyDepartmentColumns = kanbanData.filter(
      (column) => column.issues.length === 0,
    );

    return [
      ...activeDepartmentColumns,
      ...emptyDepartmentColumns,
    ];
  }, [kanbanData]);

  useEffect(() => { if (pId) loadAll(); }, [pId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [u, t, kanban, issueList, deptConfig] = await Promise.all([
        issueTrackerService.listUsers(pId),
        issueTrackerService.listTags(pId),
        issueTrackerService.getKanban(pId),
        issueTrackerService.listIssues(pId, { scope: filterScope, status: filterStatus || undefined, priority: filterPriority || undefined }),
        issueTrackerService.listDeptConfig(pId),
      ]);
      setUsers(u);
      setTags(t);
      setKanbanData(kanban.columns);
      setIssues(issueList);
      setGlobalDepts(deptConfig.globalDepts);
    } finally {
      setLoading(false);
    }
  };

  const refreshIssue = async (issue: IssueTrackerIssue) => {
    try {
      const updated = await issueTrackerService.getIssue(pId, issue.id);
      setSelectedIssue(updated);
      loadAll();
    } catch {
      loadAll();
    }
  };

  const createTag = async () => {
    if (!tagForm.name.trim() || !tagForm.departmentId) return;
    setTagLoading(true);
    try {
      await issueTrackerService.createTag(pId, {
        name: tagForm.name.trim(),
        description: tagForm.description.trim() || undefined,
        departmentId: Number(tagForm.departmentId),
      });
      setTagForm({ name: "", description: "", departmentId: "" });
      const updated = await issueTrackerService.listTags(pId);
      setTags(updated);
    } finally {
      setTagLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-card shrink-0">
        <div className="flex items-center gap-3">
          <ClipboardList size={20} className="text-blue-600" />
          <h1 className="text-lg font-semibold text-text-primary">Issue Tracker</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "issues" && (
            <>
              <div className="flex bg-surface-page border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("kanban")}
                  className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${viewMode === "kanban" ? "bg-blue-600 text-white" : "text-text-muted"}`}
                >
                  <Kanban size={14} /> Kanban
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${viewMode === "list" ? "bg-blue-600 text-white" : "text-text-muted"}`}
                >
                  <LayoutList size={14} /> List
                </button>
              </div>
              <button
                onClick={() => setShowCreateIssue(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus size={14} /> New Issue
              </button>
            </>
          )}
          <button
            onClick={() => setShowDeptConfig(true)}
            className="p-2 text-text-muted hover:text-text-primary border border-border rounded-lg"
            title="Configure departments"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={loadAll}
            className="p-2 text-text-muted hover:text-text-primary border border-border rounded-lg"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex border-b border-border px-6 bg-surface-card shrink-0">
        {[
          { key: "issues", label: "Issues", icon: ClipboardList },
          { key: "tags", label: "Tags", icon: Tag },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "issues" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface-page shrink-0">
              <select
                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-surface-card focus:outline-none"
                value={filterScope}
                onChange={(e) => { setFilterScope(e.target.value); }}
              >
                <option value="all">All Issues</option>
                <option value="department">My Department</option>
                <option value="my">Raised by Me</option>
                <option value="overdue">Overdue</option>
              </select>
              <select
                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-surface-card focus:outline-none"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CLOSED">Closed</option>
              </select>
              <select
                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-surface-card focus:outline-none"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="">All Priority</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
              <button
                onClick={loadAll}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm"
              >
                Apply
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64 text-text-muted">Loading…</div>
            ) : viewMode === "kanban" ? (
              // Kanban view
              <div className="flex gap-4 p-6 overflow-x-auto h-full items-start">
                {visibleKanbanColumns.map((col) => (
                  <div key={col.key} className="shrink-0 w-72">
                    <div
                      className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: col.color ? `${col.color}20` : "#f1f5f9" }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: col.color || "#94a3b8" }}
                      />
                      <span className="text-sm font-semibold text-text-primary">{col.label}</span>
                      <span className="ml-auto text-xs font-medium text-text-muted bg-white rounded-full px-2 py-0.5">
                        {col.issues.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {col.issues.map((issue) => (
                        <IssueCard key={issue.id} issue={issue} onSelect={setSelectedIssue} />
                      ))}
                      {col.issues.length === 0 && (
                        <p className="text-xs text-text-muted text-center py-4">No issues</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // List view
              <div className="p-6 space-y-2">
                {issues.length === 0 && (
                  <div className="text-center py-12 text-text-muted">No issues found.</div>
                )}
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} onSelect={setSelectedIssue} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "tags" && (
          <div className="p-6 max-w-xl space-y-6">
            <div className="border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">New Tag</h3>
              <div className="flex gap-3">
                <input
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none"
                  placeholder="Tag name"
                  value={tagForm.name}
                  onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                />
                <select
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-page focus:outline-none"
                  value={tagForm.departmentId}
                  onChange={(e) => setTagForm({ ...tagForm, departmentId: e.target.value })}
                >
                  <option value="">Select Department</option>
                  {globalDepts.filter((d) => d.isActive).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <button
                  onClick={createTag}
                  disabled={tagLoading || !tagForm.name.trim() || !tagForm.departmentId}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                  <Tag size={14} className="text-text-muted shrink-0" />
                  <span className="text-sm text-text-primary">{tag.name}</span>
                  <span className="text-xs text-text-muted">→ {tag.departmentName}</span>
                  {!tag.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded ml-auto">Inactive</span>}
                </div>
              ))}
              {tags.length === 0 && (
                <p className="text-center py-8 text-text-muted text-sm">No tags yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          projectId={pId}
          onClose={() => setSelectedIssue(null)}
          onRefresh={() => refreshIssue(selectedIssue)}
        />
      )}

      {/* Create Issue Modal */}
      {showCreateIssue && (
        <CreateIssueModal
          projectId={pId}
          tags={tags}
          onClose={() => setShowCreateIssue(false)}
          onCreated={loadAll}
        />
      )}

      {/* Dept Config Modal */}
      {showDeptConfig && (
        <DeptConfigModal
          projectId={pId}
          users={users}
          onClose={() => setShowDeptConfig(false)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
