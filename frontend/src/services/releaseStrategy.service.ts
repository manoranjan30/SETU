import api from "../api/axios";

export type ReleaseStrategyStatus =
  | "DRAFT"
  | "ACTIVE"
  | "INACTIVE"
  | "ARCHIVED";

export type RestartPolicy = "NO_RESTART" | "RESTART_FROM_LEVEL_1";
export type ApproverMode = "USER" | "PROJECT_ROLE";
export type ConditionOperator =
  | "EQ"
  | "NE"
  | "IN"
  | "NOT_IN"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "BETWEEN"
  | "EXISTS"
  | "NOT_EXISTS";

export interface ReleaseStrategyConditionDto {
  fieldKey: string;
  operator: ConditionOperator;
  valueFrom?: string | null;
  valueTo?: string | null;
  valueJson?: any;
  sequence?: number;
}

export interface ReleaseStrategyStepDto {
  levelNo: number;
  stepName: string;
  approverMode: ApproverMode;
  userId?: number | null;
  roleId?: number | null;
  minApprovalsRequired?: number;
  canDelegate?: boolean;
  escalationDays?: number | null;
  sequence?: number;
}

export interface ReleaseStrategyDto {
  id?: number;
  name: string;
  moduleCode: string;
  processCode: string;
  documentType?: string | null;
  priority?: number;
  status?: ReleaseStrategyStatus;
  version?: number;
  isDefault?: boolean;
  restartPolicy?: RestartPolicy;
  description?: string | null;
  conditions?: ReleaseStrategyConditionDto[];
  steps?: ReleaseStrategyStepDto[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EligibleApproverDto {
  userId: number;
  displayName: string;
  sourceType: "PERMANENT" | "TEMP_VENDOR";
  projectRoleIds: number[];
  vendorId?: number | null;
  workOrderId?: number | null;
  activeStatus: string;
  expiryDate?: string | null;
}

export interface ApprovalContextDto {
  projectId: number;
  moduleCode: string;
  processCode: string;
  documentType?: string | null;
  documentId?: number | string | null;
  initiatorUserId?: number | null;
  amount?: number | null;
  epsNodeId?: number | null;
  vendorId?: number | null;
  workOrderId?: number | null;
  initiatorRoleId?: number | null;
  extraAttributes?: Record<string, any> | null;
}

export const releaseStrategyService = {
  async list(projectId: number, params?: Record<string, string>) {
    const res = await api.get<ReleaseStrategyDto[]>(
      `/planning/${projectId}/release-strategies`,
      { params },
    );
    return res.data;
  },
  async get(projectId: number, id: number) {
    const res = await api.get<ReleaseStrategyDto>(
      `/planning/${projectId}/release-strategies/${id}`,
    );
    return res.data;
  },
  async create(projectId: number, data: ReleaseStrategyDto) {
    const res = await api.post<ReleaseStrategyDto>(
      `/planning/${projectId}/release-strategies`,
      data,
    );
    return res.data;
  },
  async update(projectId: number, id: number, data: ReleaseStrategyDto) {
    const res = await api.put<ReleaseStrategyDto>(
      `/planning/${projectId}/release-strategies/${id}`,
      data,
    );
    return res.data;
  },
  async remove(projectId: number, id: number) {
    const res = await api.delete(`/planning/${projectId}/release-strategies/${id}`);
    return res.data;
  },
  async clone(projectId: number, id: number) {
    const res = await api.post<ReleaseStrategyDto>(
      `/planning/${projectId}/release-strategies/${id}/clone`,
    );
    return res.data;
  },
  async activate(projectId: number, id: number) {
    const res = await api.post<ReleaseStrategyDto>(
      `/planning/${projectId}/release-strategies/${id}/activate`,
    );
    return res.data;
  },
  async deactivate(projectId: number, id: number) {
    const res = await api.post<ReleaseStrategyDto>(
      `/planning/${projectId}/release-strategies/${id}/deactivate`,
    );
    return res.data;
  },
  async getActors(projectId: number) {
    const res = await api.get<EligibleApproverDto[]>(
      `/planning/${projectId}/release-strategy-actors`,
    );
    return res.data;
  },
  async getConflicts(projectId: number) {
    const res = await api.get<any[]>(
      `/planning/${projectId}/release-strategy-conflicts`,
    );
    return res.data;
  },
  async simulate(projectId: number, id: number, context: ApprovalContextDto) {
    const res = await api.post(
      `/planning/${projectId}/release-strategies/${id}/simulate`,
      context,
    );
    return res.data;
  },
};
