import api from "../api/axios";
import type {
  CostSummary,
  CashflowMonth,
  AopNode,
  ScheduleVersionOption,
} from "../types/cost";

const base = (projectId: number) =>
  `/planning/projects/${projectId}/cost`;

export const costService = {
  getSummary(projectId: number): Promise<CostSummary> {
    return api.get(`${base(projectId)}/summary`).then((r) => r.data);
  },

  getScheduleVersions(projectId: number): Promise<ScheduleVersionOption[]> {
    return api
      .get(`${base(projectId)}/schedule-versions`)
      .then((r) => r.data);
  },

  getCashflow(
    projectId: number,
    fromMonth?: string,
    toMonth?: string,
    versionId?: number,
  ): Promise<CashflowMonth[]> {
    const params: Record<string, string> = {};
    if (fromMonth) params.fromMonth = fromMonth;
    if (toMonth) params.toMonth = toMonth;
    if (versionId) params.versionId = String(versionId);
    return api
      .get(`${base(projectId)}/cashflow`, { params })
      .then((r) => r.data);
  },

  getAop(
    projectId: number,
    fy?: number,
    versionId?: number,
  ): Promise<AopNode[]> {
    const params: Record<string, string> = {};
    if (fy) params.fy = String(fy);
    if (versionId) params.versionId = String(versionId);
    return api.get(`${base(projectId)}/aop`, { params }).then((r) => r.data);
  },
};
