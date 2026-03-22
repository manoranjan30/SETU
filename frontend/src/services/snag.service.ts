import api from "../api/axios";

export type SnagOverallStatus =
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

export const snagService = {
  listUnits: async (projectId: number): Promise<SnagUnitSummary[]> =>
    (await api.get(`/snag/${projectId}/units`)).data,

  createOrGetList: async (
    projectId: number,
    body: { qualityUnitId: number; epsNodeId?: number | null },
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/lists`, body)).data,

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
      beforePhotoUrls: string[];
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
      afterPhotoUrls: string[];
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
    body: { afterPhotoUrls: string[]; rectificationNotes?: string },
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/items/${itemId}/rectify`, body)).data,

  closeItem: async (
    projectId: number,
    itemId: number,
    body: { remarks?: string; closurePhotoUrls: string[] },
  ): Promise<SnagListDetail> =>
    (await api.post(`/snag/${projectId}/items/${itemId}/close`, body)).data,

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
