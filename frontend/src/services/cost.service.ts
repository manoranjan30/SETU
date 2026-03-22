import api from "../api/axios";
import type { CostSummary, CashflowMonth, AopNode } from "../types/cost";

const base = (projectId: number) =>
  `/planning/projects/${projectId}/cost`;

export const costService = {
  getSummary(projectId: number): Promise<CostSummary> {
    return api.get(`${base(projectId)}/summary`).then((r) => r.data);
  },

  getCashflow(
    projectId: number,
    fromMonth?: string,
    toMonth?: string,
  ): Promise<CashflowMonth[]> {
    const params: Record<string, string> = {};
    if (fromMonth) params.fromMonth = fromMonth;
    if (toMonth) params.toMonth = toMonth;
    return api
      .get(`${base(projectId)}/cashflow`, { params })
      .then((r) => r.data);
  },

  getAop(projectId: number, fy?: number): Promise<AopNode[]> {
    const params = fy ? { fy: String(fy) } : {};
    return api.get(`${base(projectId)}/aop`, { params }).then((r) => r.data);
  },
};
