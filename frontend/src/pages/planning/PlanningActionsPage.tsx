import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlarmClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { PermissionCode } from "../../config/permissions";
import { useAuth } from "../../context/AuthContext";
import {
  planningExtensionService,
  type FollowUpAction,
  type PlanningAssigneeOption,
  type PlanningActionSummary,
  type ProjectTask,
  type SiteJournalEntry,
} from "../../services/planning-extension.service";

type Tab = "tasks" | "followups" | "journal";
type TaskView = "active" | "completed" | "history";
type FollowupView = "all" | "today" | "overdue" | "history";

const today = () => new Date().toISOString().slice(0, 10);

export default function PlanningActionsPage() {
  const { projectId } = useParams();
  const pId = Number(projectId || 0);
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>("tasks");
  const [error, setError] = useState("");
  const [assignees, setAssignees] = useState<PlanningAssigneeOption[]>([]);
  const [summary, setSummary] = useState<PlanningActionSummary | null>(null);

  const refreshSummary = () => {
    if (!pId) return;
    planningExtensionService
      .actionSummary(pId)
      .then(setSummary)
      .catch(() => setSummary(null));
  };

  useEffect(() => {
    if (!pId) return;
    refreshSummary();
    planningExtensionService
      .assigneeOptions(pId)
      .then(setAssignees)
      .catch(() => setAssignees([]));
  }, [pId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-surface-ground p-4">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-text-primary">
          <ClipboardList size={22} /> Planning Actions
        </h2>
        <p className="text-sm text-text-muted">
          Task manager, follow-up register and daily site journal for project execution.
        </p>
      </div>
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={<ClipboardList size={18} />}
          label="Active Tasks"
          value={summary?.activeTasks ?? 0}
          onClick={() => setTab("tasks")}
        />
        <SummaryCard
          icon={<AlertTriangle size={18} />}
          label="Overdue Follow-ups"
          value={summary?.overdueFollowups ?? 0}
          tone="red"
          onClick={() => setTab("followups")}
        />
        <SummaryCard
          icon={<AlarmClock size={18} />}
          label="Due Today"
          value={summary?.dueTodayFollowups ?? 0}
          tone="blue"
          onClick={() => setTab("followups")}
        />
        <SummaryCard
          icon={<CalendarDays size={18} />}
          label="Today's Journal"
          value={summary?.todayJournalStatus || "NOT_STARTED"}
          tone="slate"
          onClick={() => setTab("journal")}
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border-default bg-surface-card p-2">
        {[
          ["tasks", "Task Manager", ClipboardList],
          ["followups", "Follow-up Register", AlarmClock],
          ["journal", "Site Journal", CalendarDays],
        ].map(([key, label, Icon]: any) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === key
                ? "bg-primary text-white"
                : "text-text-secondary hover:bg-surface-raised"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <TasksPanel
          projectId={pId}
          assignees={assignees}
          setError={setError}
          onChanged={refreshSummary}
          canCreate={hasPermission(PermissionCode.PLANNING_TASK_CREATE)}
          canUpdate={hasPermission(PermissionCode.PLANNING_TASK_UPDATE)}
          canDelete={hasPermission(PermissionCode.PLANNING_TASK_DELETE)}
        />
      )}
      {tab === "followups" && (
        <FollowupsPanel
          projectId={pId}
          assignees={assignees}
          setError={setError}
          onChanged={refreshSummary}
          canCreate={hasPermission(PermissionCode.PLANNING_FOLLOWUP_CREATE)}
          canUpdate={hasPermission(PermissionCode.PLANNING_FOLLOWUP_UPDATE)}
          canDelete={hasPermission(PermissionCode.PLANNING_FOLLOWUP_DELETE)}
        />
      )}
      {tab === "journal" && (
        <JournalPanel
          projectId={pId}
          setError={setError}
          onChanged={refreshSummary}
          canCreate={hasPermission(PermissionCode.PLANNING_JOURNAL_CREATE)}
          canUpdate={hasPermission(PermissionCode.PLANNING_JOURNAL_UPDATE)}
          canDelete={hasPermission(PermissionCode.PLANNING_JOURNAL_DELETE)}
        />
      )}
    </div>
  );
}

function TasksPanel({
  projectId,
  assignees,
  setError,
  onChanged,
  canCreate,
  canUpdate,
  canDelete,
}: {
  projectId: number;
  assignees: PlanningAssigneeOption[];
  setError: (value: string) => void;
  onChanged: () => void;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [items, setItems] = useState<ProjectTask[]>([]);
  const [view, setView] = useState<TaskView>("active");
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    taskType: "GENERAL",
    priority: "MEDIUM",
    assignedKey: "",
    dueDate: "",
    reminderAt: "",
    tags: "",
  });

  const assigneeMap = useMemo(() => buildAssigneeMap(assignees), [assignees]);
  const assigneeLabel = (item?: number | null, tempId?: number | null) =>
    lookupAssigneeLabel(assignees, item, tempId);

  const load = async () => {
    try {
      const next =
        view === "completed"
          ? await planningExtensionService.completedTasks(projectId)
          : view === "history"
            ? await planningExtensionService.taskHistory(projectId)
            : await planningExtensionService.activeTasks(projectId);
      setItems(next);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load tasks");
    }
  };

  useEffect(() => {
    load();
  }, [projectId, view]);

  const create = async () => {
    try {
      const assignee = assigneeMap.get(form.assignedKey);
      await planningExtensionService.createTask(projectId, {
        title: form.title,
        description: form.description,
        taskType: form.taskType,
        priority: form.priority,
        assignedToType: assignee?.type,
        assignedToUserId: assignee?.userId || null,
        assignedToTempUserId: assignee?.tempUserId || null,
        dueDate: form.dueDate || null,
        reminderAt: form.reminderAt || null,
        tags: form.tags,
      });
      setForm({
        title: "",
        description: "",
        taskType: "GENERAL",
        priority: "MEDIUM",
        assignedKey: "",
        dueDate: "",
        reminderAt: "",
        tags: "",
      });
      load();
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create task");
    }
  };

  return (
    <Panel
      title="Task Manager"
      right={
        <Segmented
          value={view}
          options={[
            ["active", "Active"],
            ["completed", "Completed"],
            ["history", "History"],
          ]}
          onChange={(value) => setView(value as TaskView)}
        />
      }
    >
      {canCreate && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-border-default p-3 md:grid-cols-6">
          <Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Task title" />
          <AssigneeSelect
            value={form.assignedKey}
            options={assignees}
            onChange={(v) => setForm({ ...form, assignedKey: v })}
          />
          <Input type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
          <Select value={form.taskType} onChange={(v) => setForm({ ...form, taskType: v })} options={["GENERAL", "CHECKLIST", "SCHEDULE", "FOLLOWUP", "ISSUE"]} />
          <Select value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]} />
          <button type="button" onClick={create} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
            <Plus size={15} className="inline" /> Add Task
          </button>
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Description, acceptance points or instructions"
            className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm md:col-span-3"
          />
          <Input value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} placeholder="Tags, comma separated" />
          <Input type="datetime-local" value={form.reminderAt} onChange={(v) => setForm({ ...form, reminderAt: v })} />
        </div>
      )}
      <CardGrid>
        {items.map((item) => (
          <ActionCard key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold text-text-primary">{item.title}</div>
                <div className="text-xs text-text-muted">
                  {assigneeLabel(item.assignedToUserId, item.assignedToTempUserId)} - Due {item.dueDate || "not set"}
                </div>
              </div>
              <Chip value={item.priority} tone={item.priority === "CRITICAL" ? "red" : "green"} />
            </div>
            {item.description && <p className="mt-2 text-sm text-text-secondary">{item.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip value={item.status} />
              <Chip value={item.taskType || "GENERAL"} tone="blue" />
              <Chip value={`${item.progressPercent || 0}%`} tone="slate" />
              {(item.tags || []).map((tag) => <Chip key={tag} value={tag} tone="slate" />)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {canUpdate && item.status !== "DONE" && (
                <SmallButton onClick={async () => { await planningExtensionService.completeTask(projectId, item.id); load(); onChanged(); }}>
                  <CheckCircle2 size={14} /> Complete
                </SmallButton>
              )}
              {canUpdate && item.status === "DONE" && (
                <SmallButton onClick={async () => { await planningExtensionService.reopenTask(projectId, item.id); load(); onChanged(); }}>
                  <RotateCcw size={14} /> Reopen
                </SmallButton>
              )}
              {canDelete && (
                <SmallButton danger onClick={async () => { await planningExtensionService.deleteTask(projectId, item.id); load(); onChanged(); }}>
                  <Trash2 size={14} /> Delete
                </SmallButton>
              )}
            </div>
          </ActionCard>
        ))}
      </CardGrid>
    </Panel>
  );
}

function FollowupsPanel({
  projectId,
  assignees,
  setError,
  onChanged,
  canCreate,
  canUpdate,
  canDelete,
}: {
  projectId: number;
  assignees: PlanningAssigneeOption[];
  setError: (value: string) => void;
  onChanged: () => void;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [items, setItems] = useState<FollowUpAction[]>([]);
  const [view, setView] = useState<FollowupView>("all");
  const [form, setForm] = useState<any>({
    actionItem: "",
    assignedKey: "",
    dueDate: today(),
    reminderAt: "",
    priority: "MEDIUM",
    followupType: "GENERAL",
    meetingReference: "",
  });
  const assigneeMap = useMemo(() => buildAssigneeMap(assignees), [assignees]);
  const assigneeLabel = (item?: number | null, tempId?: number | null) =>
    lookupAssigneeLabel(assignees, item, tempId);

  const load = async () => {
    try {
      const next =
        view === "today"
          ? await planningExtensionService.dueTodayFollowups(projectId)
          : view === "overdue"
            ? await planningExtensionService.overdueFollowups(projectId)
            : view === "history"
              ? await planningExtensionService.followupHistory(projectId)
              : await planningExtensionService.listFollowups(projectId);
      setItems(next);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load follow-ups");
    }
  };
  useEffect(() => {
    load();
  }, [projectId, view]);

  const create = async () => {
    try {
      const assignee = assigneeMap.get(form.assignedKey);
      await planningExtensionService.createFollowup(projectId, {
        actionItem: form.actionItem,
        assignedToType: assignee?.type,
        assignedToUserId: assignee?.userId,
        assignedToTempUserId: assignee?.tempUserId || null,
        dueDate: form.dueDate,
        reminderAt: form.reminderAt || null,
        nextReminderAt: form.reminderAt || null,
        priority: form.priority,
        followupType: form.followupType,
        meetingReference: form.meetingReference,
      });
      setForm({
        actionItem: "",
        assignedKey: "",
        dueDate: today(),
        reminderAt: "",
        priority: "MEDIUM",
        followupType: "GENERAL",
        meetingReference: "",
      });
      load();
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create follow-up");
    }
  };

  return (
    <Panel
      title="Follow-up Register"
      right={
        <Segmented
          value={view}
          options={[
            ["all", "All"],
            ["today", "Today"],
            ["overdue", "Overdue"],
            ["history", "History"],
          ]}
          onChange={(value) => setView(value as FollowupView)}
        />
      }
    >
      {canCreate && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-border-default p-3 md:grid-cols-6">
          <Input value={form.actionItem} onChange={(v) => setForm({ ...form, actionItem: v })} placeholder="Action item" />
          <AssigneeSelect value={form.assignedKey} options={assignees} onChange={(v) => setForm({ ...form, assignedKey: v })} />
          <Input type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
          <Input type="datetime-local" value={form.reminderAt} onChange={(v) => setForm({ ...form, reminderAt: v })} />
          <Select value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={["LOW", "MEDIUM", "HIGH"]} />
          <button type="button" onClick={create} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
            <Plus size={15} className="inline" /> Add Follow-up
          </button>
          <Select value={form.followupType} onChange={(v) => setForm({ ...form, followupType: v })} options={["GENERAL", "MEETING", "TASK", "RISK", "PROCUREMENT", "QUALITY"]} />
          <Input value={form.meetingReference} onChange={(v) => setForm({ ...form, meetingReference: v })} placeholder="Meeting / reference" />
        </div>
      )}
      <CardGrid>
        {items.map((item) => (
          <ActionCard key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold text-text-primary">{item.actionItem}</div>
                <div className="text-xs text-text-muted">
                  {assigneeLabel(item.assignedToUserId, item.assignedToTempUserId)} - Due {item.dueDate}
                </div>
              </div>
              <Chip value={item.status} tone={item.status === "CLOSED" ? "green" : "blue"} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip value={item.priority} tone={item.priority === "HIGH" ? "red" : "green"} />
              <Chip value={item.followupType || "GENERAL"} tone="slate" />
              {item.meetingReference && <Chip value={item.meetingReference} tone="blue" />}
            </div>
            {item.remarks && <p className="mt-2 text-sm text-text-secondary">{item.remarks}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {canUpdate && item.status !== "CLOSED" && (
                <SmallButton onClick={async () => { await planningExtensionService.closeFollowup(projectId, item.id, "Closed from web"); load(); onChanged(); }}>
                  <CheckCircle2 size={14} /> Close
                </SmallButton>
              )}
              {canUpdate && item.status === "CLOSED" && (
                <SmallButton onClick={async () => { await planningExtensionService.reopenFollowup(projectId, item.id); load(); onChanged(); }}>
                  <RotateCcw size={14} /> Reopen
                </SmallButton>
              )}
              {canUpdate && (
                <SmallButton onClick={async () => { await planningExtensionService.snoozeFollowup(projectId, item.id, { dueDate: today() }); load(); onChanged(); }}>
                  <AlarmClock size={14} /> Snooze Today
                </SmallButton>
              )}
              {canCreate && !item.linkedTaskId && (
                <SmallButton onClick={async () => { await planningExtensionService.convertFollowupToTask(projectId, item.id); load(); onChanged(); }}>
                  <ClipboardList size={14} /> Make Task
                </SmallButton>
              )}
              {canDelete && (
                <SmallButton danger onClick={async () => { await planningExtensionService.deleteFollowup(projectId, item.id); load(); onChanged(); }}>
                  <Trash2 size={14} /> Delete
                </SmallButton>
              )}
            </div>
          </ActionCard>
        ))}
      </CardGrid>
    </Panel>
  );
}

function JournalPanel({
  projectId,
  setError,
  onChanged,
  canCreate,
  canUpdate,
  canDelete,
}: {
  projectId: number;
  setError: (value: string) => void;
  onChanged: () => void;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [items, setItems] = useState<SiteJournalEntry[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<any>({
    date: today(),
    weather: "SUNNY",
    summary: "",
    workDoneToday: "",
    progressNotes: "",
    issuesRaised: "",
    safetyObservations: "",
    qualityObservations: "",
    decisionsTaken: "",
    tomorrowPlan: "",
    laborCount: "",
    locationText: "",
    tags: "",
  });
  const load = async () => {
    try {
      setItems(
        search
          ? await planningExtensionService.searchJournal(projectId, { q: search })
          : await planningExtensionService.listJournal(projectId),
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load journal");
    }
  };
  useEffect(() => {
    load();
  }, [projectId]);

  const save = async () => {
    try {
      await planningExtensionService.upsertJournal(projectId, {
        ...form,
        laborCount: form.laborCount ? Number(form.laborCount) : null,
      });
      setForm({
        date: today(),
        weather: "SUNNY",
        summary: "",
        workDoneToday: "",
        progressNotes: "",
        issuesRaised: "",
        safetyObservations: "",
        qualityObservations: "",
        decisionsTaken: "",
        tomorrowPlan: "",
        laborCount: "",
        locationText: "",
        tags: "",
      });
      load();
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save journal");
    }
  };

  return (
    <Panel
      title="Daily Site Journal"
      right={
        <div className="flex gap-2">
          <Input value={search} onChange={setSearch} placeholder="Search journal" />
          <SmallButton onClick={load}><RefreshCw size={14} /> Search</SmallButton>
        </div>
      }
    >
      {(canCreate || canUpdate) && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-border-default p-3 md:grid-cols-6">
          <Input type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          <Select value={form.weather} onChange={(v) => setForm({ ...form, weather: v })} options={["SUNNY", "CLOUDY", "RAINY", "FOGGY"]} />
          <Input value={form.locationText} onChange={(v) => setForm({ ...form, locationText: v })} placeholder="Location / work front" />
          <Input value={form.laborCount} onChange={(v) => setForm({ ...form, laborCount: v })} placeholder="Labour count" />
          <Input value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} placeholder="Tags, comma separated" />
          <button type="button" onClick={save} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
            Save Journal
          </button>
          <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="Executive day summary" className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm md:col-span-3" />
          <textarea value={form.workDoneToday} onChange={(event) => setForm({ ...form, workDoneToday: event.target.value })} placeholder="Work done today" className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm md:col-span-3" />
          <textarea value={form.progressNotes} onChange={(event) => setForm({ ...form, progressNotes: event.target.value })} placeholder="Progress notes" className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm md:col-span-2" />
          <textarea value={form.issuesRaised} onChange={(event) => setForm({ ...form, issuesRaised: event.target.value })} placeholder="Issues and constraints" className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm md:col-span-2" />
          <textarea value={form.tomorrowPlan} onChange={(event) => setForm({ ...form, tomorrowPlan: event.target.value })} placeholder="Tomorrow plan" className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm md:col-span-2" />
        </div>
      )}
      <CardGrid>
        {items.map((item) => (
          <ActionCard key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold text-text-primary">{item.date} - {item.weather || "Weather not set"}</div>
                <div className="text-xs text-text-muted">{item.locationText || "Project-wide"} - Labour {item.laborCount || "-"}</div>
              </div>
              <Chip value={item.status || "DRAFT"} tone={item.status === "LOCKED" ? "green" : "blue"} />
            </div>
            <p className="mt-2 text-sm text-text-secondary">{item.summary}</p>
            {item.workDoneToday && <p className="mt-2 text-sm text-text-primary"><b>Work:</b> {item.workDoneToday}</p>}
            {item.issuesRaised && <p className="mt-1 text-sm text-red-700"><b>Issues:</b> {item.issuesRaised}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip value={`${(item.photoUrls || []).length} photos`} tone="slate" />
              {(item.tags || []).map((tag) => <Chip key={tag} value={tag} tone="slate" />)}
            </div>
            {!!(item.photoUrls || []).length && (
              <div className="mt-3 flex gap-2 overflow-auto">
                {(item.photoUrls || []).slice(0, 6).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border-default">
                    <img src={url} alt="Journal attachment" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {canUpdate && item.status === "DRAFT" && (
                <SmallButton onClick={async () => { await planningExtensionService.submitJournal(projectId, item.id); load(); onChanged(); }}>
                  <CheckCircle2 size={14} /> Submit
                </SmallButton>
              )}
              {canUpdate && item.status === "SUBMITTED" && (
                <SmallButton onClick={async () => { await planningExtensionService.lockJournal(projectId, item.id); load(); onChanged(); }}>
                  <CheckCircle2 size={14} /> Lock
                </SmallButton>
              )}
              {canUpdate && item.status === "LOCKED" && (
                <SmallButton onClick={async () => { await planningExtensionService.reopenJournal(projectId, item.id); load(); onChanged(); }}>
                  <RotateCcw size={14} /> Reopen
                </SmallButton>
              )}
              {canUpdate && (
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-default px-2 py-1 text-xs font-semibold">
                  <Upload size={14} /> Photos
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (event) => {
                      if (event.target.files) {
                        await planningExtensionService.uploadJournalPhotos(projectId, item.id, event.target.files);
                        load();
                        onChanged();
                      }
                    }}
                  />
                </label>
              )}
              {canDelete && (
                <SmallButton danger onClick={async () => { await planningExtensionService.deleteJournal(projectId, item.id); load(); onChanged(); }}>
                  <Trash2 size={14} /> Delete
                </SmallButton>
              )}
            </div>
          </ActionCard>
        ))}
      </CardGrid>
    </Panel>
  );
}

function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="ui-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default p-4">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <MessageSquare size={18} /> {title}
        </h3>
        {right}
      </div>
      <div className="overflow-auto p-4">{children}</div>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{children}</div>;
}

function ActionCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border-default bg-surface-card p-4 shadow-sm">{children}</div>;
}

function SummaryCard({
  icon,
  label,
  value,
  tone = "green",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "green" | "blue" | "red" | "slate";
  onClick: () => void;
}) {
  const accent =
    tone === "red"
      ? "text-red-700 bg-red-50"
      : tone === "blue"
        ? "text-blue-700 bg-blue-50"
        : tone === "slate"
          ? "text-text-secondary bg-surface-card"
          : "text-primary bg-primary-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border-default bg-surface-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`mb-3 inline-flex rounded-lg p-2 ${accent}`}>{icon}</div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      <div className="text-xs font-semibold uppercase text-text-muted">{label}</div>
    </button>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border-default bg-surface-ground p-1">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-md px-2 py-1 text-xs font-semibold ${
            value === key ? "bg-primary text-white" : "text-text-secondary hover:bg-surface-card"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Input(props: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={props.type || "text"}
      value={props.value || ""}
      placeholder={props.placeholder}
      onChange={(event) => props.onChange(event.target.value)}
      className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
    />
  );
}

function Select(props: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={props.value}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.target.value)}
      className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm disabled:bg-surface-ground"
    >
      {props.options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function AssigneeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: PlanningAssigneeOption[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
    >
      <option value="">Select assignee</option>
      {options.map((option) => (
        <option key={assigneeKey(option)} value={assigneeKey(option)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SmallButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
        danger
          ? "border-red-200 text-red-700 hover:bg-red-50"
          : "border-border-default text-text-secondary hover:bg-surface-raised"
      }`}
    >
      {children}
    </button>
  );
}

function Chip({ value, tone = "green" }: { value: string; tone?: "green" | "blue" | "red" | "slate" }) {
  const classes =
    tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700"
        : tone === "slate"
          ? "bg-surface-raised text-text-secondary"
          : "bg-primary-muted text-primary";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes}`}>{value}</span>;
}

function assigneeKey(option: PlanningAssigneeOption) {
  return `${option.type}:${option.tempUserId || option.userId}`;
}

function buildAssigneeMap(options: PlanningAssigneeOption[]) {
  return new Map(options.map((option) => [assigneeKey(option), option]));
}

function lookupAssigneeLabel(
  options: PlanningAssigneeOption[],
  userId?: number | null,
  tempUserId?: number | null,
) {
  const found = options.find((option) =>
    tempUserId ? option.tempUserId === tempUserId : option.userId === userId,
  );
  return found?.label || (userId ? `User #${userId}` : "Unassigned");
}
