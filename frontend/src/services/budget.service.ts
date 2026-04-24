import api from "../api/axios";

export type BudgetStatus = "DRAFT" | "ACTIVE" | "LOCKED";

export interface Budget {
  id: number;
  projectId: number;
  name: string;
  status: BudgetStatus;
  version: number;
  createdBy?: string;
  createdOn?: string;
  updatedOn?: string;
}

export interface BudgetLineItem {
  id: number;
  budgetId: number;
  code: string;
  name: string;
  category?: string | null;
  uom?: string | null;
  qty: number;
  rate: number;
  amount: number;
  notes?: string | null;
  status?: string;
  wbsNodeId?: number | null;
  epsNodeId?: number | null;
}

export interface BudgetLineSummary {
  id: number;
  code: string;
  name: string;
  category?: string | null;
  uom?: string | null;
  qty?: number;
  rate?: number;
  notes?: string | null;
  status?: string;
  budgetAmount: number;
  boqAmount: number;
  consumedBudget?: number;
  availableBudget?: number;
  actualAmount: number;
  varianceBoq: number;
  varianceActual: number;
  wbsNodeId?: number | null;
  epsNodeId?: number | null;
  activityIds?: number[];
  timelineStart?: string | null;
  timelineEnd?: string | null;
}

export interface BudgetSummary {
  budget: Budget;
  totals: {
    budget: number;
    boq: number;
    actual: number;
    varianceBoq: number;
    varianceActual: number;
  };
  lines: BudgetLineSummary[];
}

const base = (projectId: number) => `/planning/projects/${projectId}/budget`;

export const budgetService = {
  listBudgets(projectId: number): Promise<Budget[]> {
    return api.get(`${base(projectId)}`).then((r) => r.data);
  },

  getBudget(projectId: number, budgetId: number): Promise<Budget> {
    return api.get(`${base(projectId)}/${budgetId}`).then((r) => r.data);
  },

  getBudgetLines(
    projectId: number,
    budgetId: number,
  ): Promise<BudgetLineItem[]> {
    return api.get(`${base(projectId)}/${budgetId}/lines`).then((r) => r.data);
  },

  getBudgetSummary(
    projectId: number,
    budgetId: number,
  ): Promise<BudgetSummary> {
    return api.get(`${base(projectId)}/${budgetId}/summary`).then((r) => r.data);
  },

  createBudget(
    projectId: number,
    payload: Partial<Budget>,
  ): Promise<Budget> {
    return api.post(`${base(projectId)}`, payload).then((r) => r.data);
  },

  createBudgetLine(
    projectId: number,
    budgetId: number,
    payload: Partial<BudgetLineItem>,
  ): Promise<BudgetLineItem> {
    return api
      .post(`${base(projectId)}/${budgetId}/lines`, payload)
      .then((r) => r.data);
  },

  updateBudgetLine(
    projectId: number,
    budgetId: number,
    lineId: number,
    payload: Partial<BudgetLineItem>,
  ): Promise<BudgetLineItem> {
    return api
      .put(`${base(projectId)}/${budgetId}/lines/${lineId}`, payload)
      .then((r) => r.data);
  },

  deleteBudgetLine(
    projectId: number,
    budgetId: number,
    lineId: number,
  ): Promise<{ deleted: boolean }> {
    return api
      .delete(`${base(projectId)}/${budgetId}/lines/${lineId}`)
      .then((r) => r.data);
  },

  updateBudget(
    projectId: number,
    budgetId: number,
    payload: Partial<Budget>,
  ): Promise<Budget> {
    return api.put(`${base(projectId)}/${budgetId}`, payload).then((r) => r.data);
  },

  deleteBudget(
    projectId: number,
    budgetId: number,
  ): Promise<{ deleted: boolean }> {
    return api.delete(`${base(projectId)}/${budgetId}`).then((r) => r.data);
  },

  importBudgetLines(
    projectId: number,
    budgetId: number,
    file: File,
  ): Promise<{ created: number; errors: string[] }> {
    const form = new FormData();
    form.append("file", file);
    return api
      .post(`${base(projectId)}/${budgetId}/import`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  getBudgetLineActivities(
    projectId: number,
    budgetId: number,
    lineId: number,
  ): Promise<{ activityId: number }[]> {
    return api
      .get(`${base(projectId)}/${budgetId}/lines/${lineId}/activities`)
      .then((r) => r.data);
  },

  addBudgetLineActivities(
    projectId: number,
    budgetId: number,
    lineId: number,
    activityIds: number[],
  ): Promise<{ added: number }> {
    return api
      .post(`${base(projectId)}/${budgetId}/lines/${lineId}/activities`, {
        activityIds,
      })
      .then((r) => r.data);
  },

  removeBudgetLineActivity(
    projectId: number,
    budgetId: number,
    lineId: number,
    activityId: number,
  ): Promise<{ deleted: boolean }> {
    return api
      .delete(
        `${base(projectId)}/${budgetId}/lines/${lineId}/activities/${activityId}`,
      )
      .then((r) => r.data);
  },
};
