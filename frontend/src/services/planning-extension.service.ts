import api from "../api/axios";

export type PlanningTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
export type PlanningPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ProjectTask {
  id: number;
  projectId: number;
  title: string;
  description?: string | null;
  status: PlanningTaskStatus;
  priority: PlanningPriority;
  taskType?: string;
  assignedToType?: "INTERNAL_USER" | "VENDOR_USER";
  assignedToUserId?: number | null;
  assignedToTempUserId?: number | null;
  createdByUserId: number;
  completedByUserId?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  reminderAt?: string | null;
  completedAt?: string | null;
  linkedActivityId?: number | null;
  linkedIssueId?: number | null;
  epsNodeId?: number | null;
  linkedModule?: string | null;
  linkedRecordId?: number | null;
  recurrenceRule?: string | null;
  progressPercent?: number;
  watcherUserIds?: number[];
  watcherTempUserIds?: number[];
  checklistItems?: Array<{ text: string; done?: boolean }>;
  tags?: string[];
  attachments?: string[];
  commentsCount?: number;
  lastActivityAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectTaskComment {
  id: number;
  taskId: number;
  projectId: number;
  authorUserId: number;
  comment: string;
  createdAt: string;
}

export interface FollowUpAction {
  id: number;
  projectId: number;
  actionItem: string;
  raisedByUserId: number;
  assignedToUserId: number;
  assignedToType?: "INTERNAL_USER" | "VENDOR_USER";
  assignedToTempUserId?: number | null;
  raisedDate: string;
  dueDate: string;
  closedDate?: string | null;
  closedByUserId?: number | null;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED" | "OVERDUE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  remarks?: string | null;
  linkedIssueId?: number | null;
  linkedTaskId?: number | null;
  meetingReference?: string | null;
  meetingDate?: string | null;
  followupType?: string;
  sourceModule?: string | null;
  sourceRecordId?: number | null;
  epsNodeId?: number | null;
  locationText?: string | null;
  reminderAt?: string | null;
  nextReminderAt?: string | null;
  repeatRule?: string | null;
  closureRemarks?: string | null;
  attachments?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteJournalEntry {
  id: number;
  projectId: number;
  date: string;
  authorUserId: number;
  weather?: "SUNNY" | "CLOUDY" | "RAINY" | "FOGGY" | null;
  status?: "DRAFT" | "SUBMITTED" | "LOCKED";
  journalType?: string;
  summary: string;
  workDoneToday?: string | null;
  issuesRaised?: string | null;
  safetyObservations?: string | null;
  qualityObservations?: string | null;
  progressNotes?: string | null;
  decisionsTaken?: string | null;
  instructionsGiven?: string | null;
  materialReceived?: string | null;
  delaysOrConstraints?: string | null;
  tomorrowPlan?: string | null;
  laborCount?: number | null;
  equipmentOnSite?: string | null;
  visitorsOnSite?: string | null;
  epsNodeId?: number | null;
  locationText?: string | null;
  linkedActivityIds?: number[];
  linkedTaskIds?: number[];
  linkedFollowupIds?: number[];
  linkedRfiIds?: number[];
  photoUrls?: string[];
  attachments?: string[];
  tags?: string[];
  remarks?: string | null;
  submittedAt?: string | null;
  lockedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanningAssigneeOption {
  type: "INTERNAL_USER" | "VENDOR_USER";
  id: number;
  userId: number;
  tempUserId?: number | null;
  label: string;
  displayName?: string | null;
  username?: string | null;
  designation?: string | null;
  company?: string | null;
  roleNames?: string[];
}

export interface PlanningActionSummary {
  activeTasks: number;
  completedTasks: number;
  overdueFollowups: number;
  dueTodayFollowups: number;
  todayJournalStatus: "NOT_STARTED" | "DRAFT" | "SUBMITTED" | "LOCKED";
  todayJournalId?: number | null;
}

const base = (projectId: number) => `/planning/projects/${projectId}`;

export const planningExtensionService = {
  actionSummary(projectId: number): Promise<PlanningActionSummary> {
    return api.get(`${base(projectId)}/actions/summary`).then((r) => r.data);
  },
  listTasks(projectId: number, params?: Record<string, any>): Promise<ProjectTask[]> {
    return api.get(`${base(projectId)}/tasks`, { params }).then((r) => r.data);
  },
  assigneeOptions(projectId: number): Promise<PlanningAssigneeOption[]> {
    return api.get(`${base(projectId)}/tasks/assignee-options`).then((r) => r.data);
  },
  myTasks(projectId: number): Promise<ProjectTask[]> {
    return api.get(`${base(projectId)}/tasks/my`).then((r) => r.data);
  },
  activeTasks(projectId: number): Promise<ProjectTask[]> {
    return api.get(`${base(projectId)}/tasks/active`).then((r) => r.data);
  },
  completedTasks(projectId: number): Promise<ProjectTask[]> {
    return api.get(`${base(projectId)}/tasks/completed`).then((r) => r.data);
  },
  taskHistory(projectId: number): Promise<ProjectTask[]> {
    return api.get(`${base(projectId)}/tasks/history`).then((r) => r.data);
  },
  createTask(projectId: number, payload: Partial<ProjectTask>): Promise<ProjectTask> {
    return api.post(`${base(projectId)}/tasks`, payload).then((r) => r.data);
  },
  updateTask(
    projectId: number,
    id: number,
    payload: Partial<ProjectTask>,
  ): Promise<ProjectTask> {
    return api.patch(`${base(projectId)}/tasks/${id}`, payload).then((r) => r.data);
  },
  updateTaskStatus(
    projectId: number,
    id: number,
    status: PlanningTaskStatus,
  ): Promise<ProjectTask> {
    return api
      .patch(`${base(projectId)}/tasks/${id}/status`, { status })
      .then((r) => r.data);
  },
  deleteTask(projectId: number, id: number): Promise<{ deleted: boolean }> {
    return api.delete(`${base(projectId)}/tasks/${id}`).then((r) => r.data);
  },
  completeTask(projectId: number, id: number): Promise<ProjectTask> {
    return api.post(`${base(projectId)}/tasks/${id}/complete`).then((r) => r.data);
  },
  reopenTask(projectId: number, id: number): Promise<ProjectTask> {
    return api.post(`${base(projectId)}/tasks/${id}/reopen`).then((r) => r.data);
  },
  listTaskComments(projectId: number, id: number): Promise<ProjectTaskComment[]> {
    return api.get(`${base(projectId)}/tasks/${id}/comments`).then((r) => r.data);
  },
  addTaskComment(
    projectId: number,
    id: number,
    comment: string,
  ): Promise<ProjectTaskComment> {
    return api
      .post(`${base(projectId)}/tasks/${id}/comments`, { comment })
      .then((r) => r.data);
  },

  listFollowups(
    projectId: number,
    params?: Record<string, any>,
  ): Promise<FollowUpAction[]> {
    return api.get(`${base(projectId)}/followups`, { params }).then((r) => r.data);
  },
  myFollowups(projectId: number): Promise<FollowUpAction[]> {
    return api.get(`${base(projectId)}/followups/my`).then((r) => r.data);
  },
  overdueFollowups(projectId: number): Promise<FollowUpAction[]> {
    return api.get(`${base(projectId)}/followups/overdue`).then((r) => r.data);
  },
  dueTodayFollowups(projectId: number): Promise<FollowUpAction[]> {
    return api.get(`${base(projectId)}/followups/due-today`).then((r) => r.data);
  },
  followupHistory(projectId: number): Promise<FollowUpAction[]> {
    return api.get(`${base(projectId)}/followups/history`).then((r) => r.data);
  },
  createFollowup(
    projectId: number,
    payload: Partial<FollowUpAction>,
  ): Promise<FollowUpAction> {
    return api.post(`${base(projectId)}/followups`, payload).then((r) => r.data);
  },
  updateFollowup(
    projectId: number,
    id: number,
    payload: Partial<FollowUpAction>,
  ): Promise<FollowUpAction> {
    return api
      .patch(`${base(projectId)}/followups/${id}`, payload)
      .then((r) => r.data);
  },
  closeFollowup(
    projectId: number,
    id: number,
    remarks?: string,
  ): Promise<FollowUpAction> {
    return api
      .post(`${base(projectId)}/followups/${id}/close`, { remarks })
      .then((r) => r.data);
  },
  deleteFollowup(projectId: number, id: number): Promise<{ deleted: boolean }> {
    return api.delete(`${base(projectId)}/followups/${id}`).then((r) => r.data);
  },
  reopenFollowup(projectId: number, id: number): Promise<FollowUpAction> {
    return api.post(`${base(projectId)}/followups/${id}/reopen`).then((r) => r.data);
  },
  snoozeFollowup(
    projectId: number,
    id: number,
    payload: { reminderAt?: string; dueDate?: string },
  ): Promise<FollowUpAction> {
    return api.post(`${base(projectId)}/followups/${id}/snooze`, payload).then((r) => r.data);
  },
  convertFollowupToTask(projectId: number, id: number): Promise<ProjectTask> {
    return api.post(`${base(projectId)}/followups/${id}/convert-to-task`).then((r) => r.data);
  },

  listJournal(projectId: number, params?: Record<string, any>): Promise<SiteJournalEntry[]> {
    return api.get(`${base(projectId)}/journal`, { params }).then((r) => r.data);
  },
  todayJournal(projectId: number): Promise<SiteJournalEntry | null> {
    return api.get(`${base(projectId)}/journal/today`).then((r) => r.data);
  },
  journalCalendar(projectId: number, params?: Record<string, any>): Promise<any[]> {
    return api.get(`${base(projectId)}/journal/calendar`, { params }).then((r) => r.data);
  },
  searchJournal(projectId: number, params?: Record<string, any>): Promise<SiteJournalEntry[]> {
    return api.get(`${base(projectId)}/journal/search`, { params }).then((r) => r.data);
  },
  upsertJournal(
    projectId: number,
    payload: Partial<SiteJournalEntry>,
  ): Promise<SiteJournalEntry> {
    return api.post(`${base(projectId)}/journal`, payload).then((r) => r.data);
  },
  updateJournal(
    projectId: number,
    id: number,
    payload: Partial<SiteJournalEntry>,
  ): Promise<SiteJournalEntry> {
    return api.patch(`${base(projectId)}/journal/${id}`, payload).then((r) => r.data);
  },
  deleteJournal(projectId: number, id: number): Promise<{ deleted: boolean }> {
    return api.delete(`${base(projectId)}/journal/${id}`).then((r) => r.data);
  },
  submitJournal(projectId: number, id: number): Promise<SiteJournalEntry> {
    return api.post(`${base(projectId)}/journal/${id}/submit`).then((r) => r.data);
  },
  lockJournal(projectId: number, id: number): Promise<SiteJournalEntry> {
    return api.post(`${base(projectId)}/journal/${id}/lock`).then((r) => r.data);
  },
  reopenJournal(projectId: number, id: number): Promise<SiteJournalEntry> {
    return api.post(`${base(projectId)}/journal/${id}/reopen`).then((r) => r.data);
  },
  uploadJournalPhotos(
    projectId: number,
    id: number,
    files: FileList | File[],
  ): Promise<SiteJournalEntry> {
    const data = new FormData();
    Array.from(files).forEach((file) => data.append("files", file));
    return api
      .post(`${base(projectId)}/journal/${id}/photos`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
