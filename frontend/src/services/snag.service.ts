import api from "../api/axios";

export type SnagOverallStatus =
  | "unready"
  | "ready_for_snag"
  | "snagging"
  | "desnagging"
  | "released"
  | "handover_ready";

export type SnagItemStatus = "open" | "rectified" | "closed" | "on_hold";
export type SnagChecklistStatus = "IDENTIFIED" | "RECTIFIED" | "NA";

export interface SnagUnitSummary {
  qualityUnitId: number;
  unitLabel: string;
  floorId: number;
  floorLabel: string;
  towerId: number;
  towerLabel: string;
  blockId: number | null;
  blockLabel: string | null;
  roomCount: number;
  snagListId: number | null;
  currentRound: number;
  overallStatus: SnagOverallStatus;
  commonChecklistCount: number;
}

export interface SnagPhoto {
  id: number;
  snagItemId: number;
  type: "before" | "after" | "closure";
  fileUrl: string;
  createdAt: string;
}

export interface SnagChecklistItem {
  id: string;
  title: string;
  qualityRoomId: number | null;
  roomLabel: string | null;
  trade: string | null;
  sequence: number;
  status: SnagChecklistStatus;
  remarks: string | null;
  linkedSnagItemId: number | null;
  updatedAt: string | null;
  updatedById: number | null;
}

export interface SnagListDetail {
  id: number;
  projectId: number;
  qualityUnitId: number;
  unitLabel: string;
  currentRound: number;
  overallStatus: SnagOverallStatus;
  commonChecklist: SnagChecklistItem[];
  unit?: {
    id: number;
    name: string;
    rooms: Array<{ id: number; name: string; roomType?: string | null }>;
  };
  processSteps?: SnagProcessStepConfig[];
  rounds: SnagRoundDetail[];
}

export interface SnagRoundDetail {
  id: number;
  roundNumber: number;
  isSkipped: boolean;
  skippedAt: string | null;
  skippedById: number | null;
  skipReason: string | null;
  snagPhaseStatus: "open" | "submitted";
  desnagPhaseStatus:
    | "locked"
    | "open"
    | "approval_pending"
    | "approved"
    | "rejected";
  finalClosureSignedAt?: string | null;
  finalClosureSignedById?: number | null;
  finalClosureRemarks?: string | null;
  items: SnagItemDetail[];
  approvals?: SnagApproval[];
}

export interface SnagItemDetail {
  id: number;
  qualityRoomId: number | null;
  roomLabel: string | null;
  defectTitle: string;
  defectDescription: string | null;
  trade: string | null;
  priority: string;
  status: SnagItemStatus;
  holdReason: string | null;
  rectificationNotes?: string | null;
  closureRemarks?: string | null;
  notSatisfactoryCount?: number;
  lastNotSatisfactoryRemarks?: string | null;
  lastNotSatisfactoryAt?: string | null;
  lastNotSatisfactoryById?: number | null;
  beforePhotos: SnagPhoto[];
  afterPhotos: SnagPhoto[];
  closurePhotos: SnagPhoto[];
  photos: SnagPhoto[];
  raisedAt: string | null;
  rectifiedAt: string | null;
  closedAt: string | null;
  raisedById?: number | null;
}

export interface SnagApproval {
  id: number;
  status: "pending" | "approved" | "rejected";
  currentStepOrder: number;
  steps: Array<{
    id: number;
    stepName: string;
    status: "waiting" | "pending" | "approved" | "rejected";
  }>;
}

export interface SnagCommonPointConfig {
  id: number;
  projectId: number;
  processActivityId: number;
  activityId: number;
  title: string;
  description: string | null;
  severity: string;
  requiresEvidence: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface SnagProcessActivityConfig {
  id: number;
  projectId: number;
  processStepId: number;
  activityId: number;
  sortOrder: number;
  isActive: boolean;
  activity?: {
    id: number;
    activityName?: string | null;
    name?: string | null;
    activityCode?: string | null;
  };
  commonPoints?: SnagCommonPointConfig[];
}

export interface SnagProcessStepConfig {
  id?: number;
  projectId: number;
  name: string;
  description: string | null;
  workflowSerialNo: number;
  isActive: boolean;
  raisePhotoRequired?: boolean;
  rectificationPhotoRequired?: boolean;
  desnagCompletionPhotoRequired?: boolean;
  activities?: SnagProcessActivityConfig[];
}

export interface SnagAnalyticsRow {
  label: string;
  count: number;
}

export interface SnagAnalytics {
  summary: {
    totalUnits: number;
    notReadyUnits: number;
    readyUnits: number;
    snaggingUnits: number;
    desnaggingUnits: number;
    customerInspectionReadyUnits: number;
    totalSnagPoints: number;
    openSnagPoints: number;
    rectifiedPendingDesnag: number;
    closedSnagPoints: number;
    notSatisfactoryPoints: number;
    averageOpenAgeDays: number;
  };
  byStatus: SnagAnalyticsRow[];
  byProcessStep: SnagAnalyticsRow[];
  byTower: SnagAnalyticsRow[];
  byFloor: SnagAnalyticsRow[];
  byRoom: SnagAnalyticsRow[];
  byActivity: SnagAnalyticsRow[];
  byPriority: SnagAnalyticsRow[];
  agingBuckets: SnagAnalyticsRow[];
  recurringSnags: SnagAnalyticsRow[];
  blockedUnits: Array<{
    listId: number;
    unitLabel: string;
    currentRound: number;
    status: SnagOverallStatus;
  }>;
}

export const snagService = {
  listProcessSteps: async (projectId: number): Promise<SnagProcessStepConfig[]> =>
    (await api.get(`/snag/${projectId}/config/process-steps`)).data,

  saveProcessStep: async (
    projectId: number,
    body: {
      name: string;
      description?: string | null;
      workflowSerialNo: number;
      isActive?: boolean;
      raisePhotoRequired?: boolean;
      rectificationPhotoRequired?: boolean;
      desnagCompletionPhotoRequired?: boolean;
    },
    stepId?: number,
  ): Promise<SnagProcessStepConfig[]> =>
    stepId
      ? (await api.post(`/snag/${projectId}/config/process-steps/${stepId}`, body))
          .data
      : (await api.post(`/snag/${projectId}/config/process-steps`, body)).data,

  deleteProcessStep: async (
    projectId: number,
    stepId: number,
  ): Promise<SnagProcessStepConfig[]> =>
    (await api.delete(`/snag/${projectId}/config/process-steps/${stepId}`)).data,

  addProcessActivity: async (
    projectId: number,
    body: { processStepId: number; activityId: number; sortOrder?: number },
  ): Promise<SnagProcessStepConfig[]> =>
    (await api.post(`/snag/${projectId}/config/activity-map`, body)).data,

  moveProcessActivity: async (
    projectId: number,
    mappingId: number,
    body: { processStepId: number; sortOrder?: number },
  ): Promise<SnagProcessStepConfig[]> =>
    (
      await api.post(
        `/snag/${projectId}/config/activity-map/${mappingId}/move`,
        body,
      )
    ).data,

  deleteProcessActivity: async (
    projectId: number,
    mappingId: number,
  ): Promise<SnagProcessStepConfig[]> =>
    (await api.delete(`/snag/${projectId}/config/activity-map/${mappingId}`)).data,

  saveCommonPoint: async (
    projectId: number,
    mappingId: number,
    body: {
      title: string;
      description?: string | null;
      severity?: string;
      requiresEvidence?: boolean;
      sortOrder?: number;
      isActive?: boolean;
    },
    pointId?: number,
  ): Promise<SnagProcessStepConfig[]> =>
    pointId
      ? (
          await api.post(
            `/snag/${projectId}/config/activity-map/${mappingId}/common-points/${pointId}`,
            body,
          )
        ).data
      : (
          await api.post(
            `/snag/${projectId}/config/activity-map/${mappingId}/common-points`,
            body,
          )
        ).data,

  deleteCommonPoint: async (
    projectId: number,
    pointId: number,
  ): Promise<SnagProcessStepConfig[]> =>
    (await api.delete(`/snag/${projectId}/config/common-points/${pointId}`))
      .data,

  listUnits: async (projectId: number): Promise<SnagUnitSummary[]> =>
    (await api.get(`/snag/${projectId}/units`)).data,

  getAnalytics: async (projectId: number): Promise<SnagAnalytics> =>
    (await api.get(`/snag/${projectId}/analytics`)).data,

  createOrGetList: async (
    projectId: number,
    body: { qualityUnitId: number; epsNodeId?: number | null },
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/lists`, body)).data,

  resetReady: async (
    projectId: number,
    listId: number,
  ): Promise<{ reset: boolean }> =>
    (await api.post(`/snag/${projectId}/lists/${listId}/reset-ready`, {})).data,

  markCurrentRoundReady: async (
    projectId: number,
    listId: number,
  ): Promise<SnagListDetail> =>
    (
      await api.post(
        `/snag/${projectId}/lists/${listId}/mark-current-round-ready`,
        {},
      )
    ).data,

  getList: async (
    projectId: number,
    listId: number,
  ): Promise<SnagListDetail> =>
    (await api.get(`/snag/${projectId}/lists/${listId}`)).data,

  updateCommonChecklist: async (
    projectId: number,
    listId: number,
    body: {
      items: Array<{
        id?: string;
        title: string;
        qualityRoomId?: number | null;
        roomLabel?: string | null;
        trade?: string | null;
        sequence?: number;
        status?: SnagChecklistStatus;
        remarks?: string | null;
        linkedSnagItemId?: number | null;
      }>;
    },
  ): Promise<{ commonChecklist: SnagChecklistItem[] }> =>
    (await api.post(`/snag/${projectId}/lists/${listId}/common-checklist`, body))
      .data,

  addItem: async (
    projectId: number,
    listId: number,
    roundNumber: number,
    body: {
      qualityRoomId?: number | null;
      roomLabel?: string;
      defectTitle: string;
      defectDescription?: string;
      trade?: string;
      priority?: string;
      beforePhotoUrls?: string[];
      linkedChecklistItemId?: string;
    },
  ): Promise<SnagListDetail> =>
    (
      await api.post(
        `/snag/${projectId}/lists/${listId}/rounds/${roundNumber}/items`,
        body,
      )
    ).data,

  bulkRectifyItems: async (
    projectId: number,
    listId: number,
    roundNumber: number,
    body: {
      itemIds: number[];
      afterPhotoUrls?: string[];
      rectificationNotes?: string;
    },
  ): Promise<SnagListDetail> =>
    (
      await api.post(
        `/snag/${projectId}/lists/${listId}/rounds/${roundNumber}/items/bulk-rectify`,
        body,
      )
    ).data,

  bulkCloseItems: async (
    projectId: number,
    listId: number,
    roundNumber: number,
    body: {
      itemIds: number[];
      closurePhotoUrls: string[];
      remarks?: string;
    },
  ): Promise<SnagListDetail> =>
    (
      await api.post(
        `/snag/${projectId}/lists/${listId}/rounds/${roundNumber}/items/bulk-close`,
        body,
      )
    ).data,

  rectifyItem: async (
    projectId: number,
    itemId: number,
    body: { afterPhotoUrls?: string[]; rectificationNotes?: string },
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/items/${itemId}/rectify`, body)).data,

  closeItem: async (
    projectId: number,
    itemId: number,
    body: { remarks?: string; closurePhotoUrls: string[] },
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/items/${itemId}/close`, body)).data,

  rejectRectification: async (
    projectId: number,
    itemId: number,
    body: { remarks?: string },
  ): Promise<SnagListDetail> =>
    (
      await api.post(
        `/snag/${projectId}/items/${itemId}/reject-rectification`,
        body,
      )
    ).data,

  holdItem: async (
    projectId: number,
    itemId: number,
    holdReason: string,
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/items/${itemId}/hold`, { holdReason }))
      .data,

  deleteItem: async (
    projectId: number,
    itemId: number,
  ): Promise<SnagListDetail> =>
    (await api.delete(`/snag/${projectId}/items/${itemId}`)).data,

  submitSnagPhase: async (
    projectId: number,
    roundId: number,
    comments?: string,
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/rounds/${roundId}/submit-snag`, { comments }))
      .data,

  submitRelease: async (
    projectId: number,
    roundId: number,
    comments?: string,
  ): Promise<SnagListDetail> =>
    (
      await api.post(`/snag/${projectId}/rounds/${roundId}/submit-release`, {
        comments,
      })
    ).data,

  finalClosure: async (
    projectId: number,
    roundId: number,
    body: { remarks?: string; signatureData?: string },
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/rounds/${roundId}/final-closure`, body))
      .data,

  downloadStatusReport: async (
    projectId: number,
    listId: number,
    roundNumber: number,
  ): Promise<Blob> =>
    (
      await api.get(
        `/snag/${projectId}/lists/${listId}/rounds/${roundNumber}/status-report.pdf`,
        { responseType: "blob" },
      )
    ).data,

  skipRound: async (
    projectId: number,
    roundId: number,
    body: { reason?: string },
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/rounds/${roundId}/skip`, body)).data,

  resetRound: async (
    projectId: number,
    roundId: number,
    body: { reason: string },
  ): Promise<SnagListDetail> =>
    (
      await api.post(`/snag/${projectId}/rounds/${roundId}/reset`, body, {
        timeout: 120000,
      })
    ).data,

  advanceApproval: async (
    projectId: number,
    approvalId: number,
    body: { action: "APPROVE" | "REJECT"; comments?: string },
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/approvals/${approvalId}/advance`, body))
      .data,
};
