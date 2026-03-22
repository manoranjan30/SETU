import api from "../api/axios";

export interface CustomerMilestoneTemplateDto {
  id?: number;
  name: string;
  description?: string;
  sequence: number;
  collectionPct: string;
  triggerType: "MANUAL" | "PROGRESS_PCT";
  applicableTo?: "all_units" | "tower" | "floor" | "unit";
  applicableEpsIds?: number[];
  linkedActivityIds?: number[];
  allowManualCompletion?: boolean;
  isActive?: boolean;
}

export interface FlatSaleInfoDto {
  id?: number;
  epsNodeId?: number | null;
  qualityUnitId?: number | null;
  unitLabel: string;
  totalSaleValue: string;
  customerName?: string;
  agreementDate?: string;
  loanBank?: string;
  remarks?: string;
}

export interface MilestoneScopeUnit {
  unitId: number;
  unitName: string;
}

export interface MilestoneScopeFloor {
  floorId: number;
  floorName: string;
  units: MilestoneScopeUnit[];
}

export interface MilestoneScopeTower {
  towerId: number;
  towerName: string;
  floors: MilestoneScopeFloor[];
}

export interface MilestoneScopeBlock {
  blockId: number;
  blockName: string;
  towers: MilestoneScopeTower[];
}

export interface ScheduleActivityOption {
  id: number;
  activityCode: string;
  activityName: string;
  plannedFinish?: string | null;
  actualFinish?: string | null;
  status?: string | null;
  wbsNodeId?: number | null;
  wbsNode?: {
    id: number;
    wbsCode: string;
    wbsName: string;
    parentId?: number | null;
  } | null;
  locations?: Array<{
    epsNodeId: number;
    blockId?: number | null;
    blockName?: string | null;
    towerId?: number | null;
    towerName?: string | null;
    floorId?: number | null;
    floorName?: string | null;
    pathLabel: string;
  }>;
}

export const customerMilestoneService = {
  listTemplates: async (projectId: number) =>
    (await api.get(`/milestones/${projectId}/templates`)).data,
  createTemplate: async (projectId: number, body: CustomerMilestoneTemplateDto) =>
    (await api.post(`/milestones/${projectId}/templates`, body)).data,
  updateTemplate: async (projectId: number, id: number, body: CustomerMilestoneTemplateDto) =>
    (await api.put(`/milestones/${projectId}/templates/${id}`, body)).data,
  deleteTemplate: async (projectId: number, id: number) =>
    (await api.delete(`/milestones/${projectId}/templates/${id}`)).data,
  listScopeOptions: async (projectId: number): Promise<MilestoneScopeBlock[]> =>
    (await api.get(`/milestones/${projectId}/scope-options`)).data,
  listScheduleActivities: async (projectId: number): Promise<ScheduleActivityOption[]> =>
    (await api.get(`/milestones/${projectId}/schedule-activities`)).data,
  cloneTowerTemplates: async (
    projectId: number,
    body: { sourceTowerId: number; targetTowerIds: number[] },
  ) => (await api.post(`/milestones/${projectId}/templates/clone-tower`, body)).data,

  listFlatSales: async (projectId: number) =>
    (await api.get(`/milestones/${projectId}/flat-sales`)).data,
  createFlatSale: async (projectId: number, body: FlatSaleInfoDto) =>
    (await api.post(`/milestones/${projectId}/flat-sales`, body)).data,
  updateFlatSale: async (projectId: number, id: number, body: FlatSaleInfoDto) =>
    (await api.put(`/milestones/${projectId}/flat-sales/${id}`, body)).data,

  listUnitMilestones: async (projectId: number) =>
    (await api.get(`/milestones/${projectId}/units`)).data,
  recompute: async (projectId: number) =>
    (await api.post(`/milestones/${projectId}/recompute`)).data,
  manualTrigger: async (
    projectId: number,
    achievementId: number,
    body?: { completionDate?: string; remarks?: string },
  ) =>
    (await api.post(`/milestones/${projectId}/achievements/${achievementId}/manual-trigger`, body || {})).data,
  raiseInvoice: async (
    projectId: number,
    achievementId: number,
    body: { invoiceNumber: string; invoiceDate: string; remarks?: string },
  ) => (await api.post(`/milestones/${projectId}/achievements/${achievementId}/invoice`, body)).data,
  addTranche: async (
    projectId: number,
    achievementId: number,
    body: {
      amount: string;
      receivedDate: string;
      paymentMode: string;
      referenceNumber: string;
      bankName?: string;
      remarks?: string;
    },
  ) => (await api.post(`/milestones/${projectId}/achievements/${achievementId}/tranches`, body)).data,
  updateStatus: async (
    projectId: number,
    achievementId: number,
    body: { status: string; remarks?: string },
  ) => (await api.patch(`/milestones/${projectId}/achievements/${achievementId}/status`, body)).data,
};
