import api from "../api/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IssuePriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IssueStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";
export type StepStatus = "PENDING" | "ACTIVE" | "COMPLETED";

export type GlobalDepartment = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sequenceOrder: number;
  defaultSlaDays?: number | null;
  isActive: boolean;
};

export type DeptProjectConfig = {
  id: number;
  projectId: number;
  departmentId: number;
  departmentName: string;
  memberUserIds?: number[] | null;
  coordinatorUserId?: number | null;
  coordinatorName?: string | null;
  isIncludedInDefaultFlow: boolean;
  allowMemberSelfClose?: boolean;
};

export type IssueTrackerTag = {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  departmentId: number;
  departmentName?: string | null;
  isActive: boolean;
};

export type CommittedDateRecord = {
  previousDate: string | null;
  newDate: string;
  changedAt: string;
  changedByName: string;
  reason: string;
};

export type IssueTrackerStep = {
  id: number;
  issueId: number;
  sequenceNo: number;
  departmentId: number;
  departmentName: string;
  status: StepStatus;
  slaDays?: number | null;
  responseText?: string | null;
  committedCompletionDate?: string | null;
  committedDateHistory?: CommittedDateRecord[] | null;
  respondedDate?: string | null;
  respondedByName?: string | null;
  memberRespondedAt?: string | null;
  coordinatorRemarks?: string | null;
  coordinatorClosedAt?: string | null;
};

export type IssueTrackerIssue = {
  id: number;
  projectId: number;
  issueNumber?: string | null;
  title: string;
  description: string;
  tagIds: number[];
  tagNames?: string[] | null;
  raisedByName?: string | null;
  raisedDate: string;
  requiredDate?: string | null;
  respondedDate?: string | null;
  committedCompletionDate?: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  currentDepartmentId?: number | null;
  currentDepartmentName?: string | null;
  customFlowDepartmentIds?: number[] | null;
  attachmentCount: number;
  commentCount: number;
  closedDate?: string | null;
  closedRemarks?: string | null;
  steps: IssueTrackerStep[];
  isRelevantToCurrentUser?: boolean;
  canRespond?: boolean;
  canCoordinatorClose?: boolean;
  canClose?: boolean;
};

export type ActivityLogEntry = {
  id: number;
  issueId: number;
  action: string;
  detail?: string | null;
  actorName: string;
  createdAt: string;
};

export type IssueAttachment = {
  id: number;
  issueId: number;
  fileUrl: string;
  originalName: string;
  mimeType?: string | null;
  uploadedByName: string;
  uploadedAt: string;
};

export type IssueNotification = {
  id: number;
  issueId: number;
  type: string;
  message: string;
  issueTitle?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type KanbanColumn = {
  key: string;
  label: string;
  color?: string | null;
  issues: IssueTrackerIssue[];
};

export type IssueTrackerProjectOption = {
  id: number;
  name: string;
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const issueTrackerService = {
  // Users
  async listUsers(projectId: number) {
    const res = await api.get(`/planning/${projectId}/issue-tracker/users`);
    return res.data as { id: number; username: string; fullName?: string | null }[];
  },
  async listProjectOptions() {
    const res = await api.get(`/eps`);
    const nodes = Array.isArray(res.data) ? res.data : [];
    const flattened: IssueTrackerProjectOption[] = [];
    const walk = (items: any[]) => {
      items.forEach((item) => {
        const type = String(item.type || item.nodeType || "").toUpperCase();
        const isProject = type === "PROJECT" || type === "PROJECTS";
        if (isProject) {
          flattened.push({ id: Number(item.id), name: item.name || item.nodeName || item.label || `Project ${item.id}` });
        }
        if (Array.isArray(item.children)) walk(item.children);
      });
    };
    walk(nodes);
    return flattened.filter((item) => Number.isFinite(item.id));
  },

  // Global Departments (Admin)
  async listGlobalDepartments() {
    const res = await api.get(`/admin/issue-tracker/departments`);
    return res.data as GlobalDepartment[];
  },
  async createGlobalDepartment(body: Partial<GlobalDepartment>) {
    const res = await api.post(`/admin/issue-tracker/departments`, body);
    return res.data as GlobalDepartment;
  },
  async updateGlobalDepartment(id: number, body: Partial<GlobalDepartment>) {
    const res = await api.patch(`/admin/issue-tracker/departments/${id}`, body);
    return res.data as GlobalDepartment;
  },
  async deleteGlobalDepartment(id: number) {
    const res = await api.delete(`/admin/issue-tracker/departments/${id}`);
    return res.data;
  },
  async reorderGlobalDepartments(orderedIds: number[]) {
    const res = await api.patch(`/admin/issue-tracker/departments/reorder`, { orderedIds });
    return res.data as GlobalDepartment[];
  },

  // Project Dept Config
  async listDeptConfig(projectId: number) {
    const res = await api.get(`/planning/${projectId}/issue-tracker/dept-config`);
    return res.data as { configs: DeptProjectConfig[]; globalDepts: GlobalDepartment[] };
  },
  async setDeptConfig(projectId: number, body: {
    departmentId: number;
    memberUserIds?: number[];
    coordinatorUserId?: number;
    coordinatorName?: string;
    isIncludedInDefaultFlow?: boolean;
    allowMemberSelfClose?: boolean;
  }) {
    const res = await api.post(`/planning/${projectId}/issue-tracker/dept-config`, body);
    return res.data as DeptProjectConfig;
  },
  async removeDeptConfig(projectId: number, configId: number) {
    const res = await api.delete(`/planning/${projectId}/issue-tracker/dept-config/${configId}`);
    return res.data;
  },

  // Tags
  async listTags(projectId: number) {
    const res = await api.get(`/planning/${projectId}/issue-tracker/tags`);
    return res.data as IssueTrackerTag[];
  },
  async createTag(projectId: number, body: { name: string; description?: string; departmentId: number }) {
    const res = await api.post(`/planning/${projectId}/issue-tracker/tags`, body);
    return res.data as IssueTrackerTag;
  },
  async updateTag(projectId: number, id: number, body: { name: string; description?: string; departmentId: number; isActive?: boolean }) {
    const res = await api.put(`/planning/${projectId}/issue-tracker/tags/${id}`, body);
    return res.data as IssueTrackerTag;
  },
  async copyTagsFromProject(projectId: number, sourceProjectId: number) {
    const res = await api.post(`/planning/${projectId}/issue-tracker/tags/copy-from-project`, { sourceProjectId });
    return res.data as { copied: number; skipped: number };
  },

  // Issues
  async listIssues(projectId: number, params?: {
    scope?: string; status?: string; priority?: string; departmentId?: number;
  }) {
    const res = await api.get(`/planning/${projectId}/issue-tracker/issues`, {
      params: {
        scope: params?.scope || undefined,
        status: params?.status || undefined,
        priority: params?.priority || undefined,
        departmentId: params?.departmentId || undefined,
      },
    });
    return res.data as IssueTrackerIssue[];
  },
  async getIssue(projectId: number, issueId: number) {
    const res = await api.get(`/planning/${projectId}/issue-tracker/issues/${issueId}`);
    return res.data as IssueTrackerIssue;
  },
  async createIssue(projectId: number, body: {
    title: string;
    description: string;
    tagIds: number[];
    requiredDate?: string;
    priority?: IssuePriority;
    customFlowDepartmentIds?: number[];
  }) {
    const res = await api.post(`/planning/${projectId}/issue-tracker/issues`, body);
    return res.data as IssueTrackerIssue;
  },
  async updateIssue(projectId: number, id: number, body: {
    title?: string; description?: string; requiredDate?: string; priority?: string;
  }) {
    const res = await api.patch(`/planning/${projectId}/issue-tracker/issues/${id}`, body);
    return res.data as IssueTrackerIssue;
  },
  async updatePriority(projectId: number, id: number, priority: IssuePriority) {
    const res = await api.patch(`/planning/${projectId}/issue-tracker/issues/${id}/priority`, { priority });
    return res.data as IssueTrackerIssue;
  },
  async respondToIssue(projectId: number, issueId: number, body: {
    responseText: string; committedCompletionDate?: string; reason?: string;
  }) {
    const res = await api.post(`/planning/${projectId}/issue-tracker/issues/${issueId}/respond`, body);
    return res.data as IssueTrackerIssue;
  },
  async coordinatorCloseStep(projectId: number, issueId: number, remarks?: string) {
    const res = await api.post(`/planning/${projectId}/issue-tracker/issues/${issueId}/coordinator-close`, { remarks });
    return res.data as IssueTrackerIssue;
  },
  async updateCommitmentDate(projectId: number, issueId: number, body: { newDate: string; reason?: string }) {
    const res = await api.post(`/planning/${projectId}/issue-tracker/issues/${issueId}/update-commitment`, body);
    return res.data as IssueTrackerIssue;
  },
  async closeIssue(projectId: number, issueId: number, body: { closedRemarks?: string }) {
    const res = await api.post(`/planning/${projectId}/issue-tracker/issues/${issueId}/close`, body);
    return res.data as IssueTrackerIssue;
  },

  // Flow editing
  async addDeptToFlow(projectId: number, issueId: number, body: { departmentId: number; insertAfterStepId?: number }) {
    const res = await api.post(`/planning/${projectId}/issue-tracker/issues/${issueId}/flow/add-dept`, body);
    return res.data as IssueTrackerIssue;
  },
  async removeDeptFromFlow(projectId: number, issueId: number, stepId: number) {
    const res = await api.delete(`/planning/${projectId}/issue-tracker/issues/${issueId}/flow/step/${stepId}`);
    return res.data as IssueTrackerIssue;
  },
  async reorderFlow(projectId: number, issueId: number, stepIds: number[]) {
    const res = await api.patch(`/planning/${projectId}/issue-tracker/issues/${issueId}/flow/reorder`, { stepIds });
    return res.data as IssueTrackerIssue;
  },

  // Kanban
  async getKanban(projectId: number) {
    const res = await api.get(`/planning/${projectId}/issue-tracker/kanban`);
    return res.data as { columns: KanbanColumn[] };
  },

  // Activity log
  async getActivityLog(projectId: number, issueId: number) {
    const res = await api.get(`/planning/${projectId}/issue-tracker/issues/${issueId}/activity`);
    return res.data as ActivityLogEntry[];
  },

  // Attachments
  async listAttachments(projectId: number, issueId: number) {
    const res = await api.get(`/planning/${projectId}/issue-tracker/issues/${issueId}/attachments`);
    return res.data as IssueAttachment[];
  },
  async deleteAttachment(projectId: number, issueId: number, attachmentId: number) {
    const res = await api.delete(`/planning/${projectId}/issue-tracker/issues/${issueId}/attachments/${attachmentId}`);
    return res.data;
  },

  // Notifications
  async getMyNotifications(projectId: number) {
    const res = await api.get(`/planning/${projectId}/issue-tracker/notifications`);
    return res.data as IssueNotification[];
  },
  async markNotificationRead(projectId: number, notifId: number) {
    const res = await api.patch(`/planning/${projectId}/issue-tracker/notifications/${notifId}/read`);
    return res.data;
  },
  async markAllNotificationsRead(projectId: number) {
    const res = await api.patch(`/planning/${projectId}/issue-tracker/notifications/read-all`);
    return res.data;
  },
};
