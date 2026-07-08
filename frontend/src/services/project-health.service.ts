import api from "../api/axios";

export type HealthStatus = "DRAFT" | "SUBMITTED" | "LOCKED" | "REOPENED";
export type RiskProbability = "LOW" | "MEDIUM" | "HIGH";
export type RiskSeverity = "NO_IMPACT" | "LOW" | "MEDIUM" | "HIGH";

export interface ProjectHealthBurnRow {
  id?: number;
  month: string;
  metricType: "AOP" | "CBE" | "ACTUAL";
  valueCrores: number;
  sourceType?: string;
  overrideReason?: string | null;
}

export interface ProjectHealthResourceRow {
  id?: number;
  resourceType: "LABOUR" | "STAFF";
  month: string;
  aop: number;
  planned: number;
  actual: number;
  sourceType?: string;
  overrideReason?: string | null;
}

export interface ProjectHealthRiskRow {
  id?: number;
  tower?: string | null;
  package?: string | null;
  taskGroup?: string | null;
  taskDescription: string;
  raisedDate?: string | null;
  plannedDate?: string | null;
  cbeDate?: string | null;
  delayDays?: number;
  accountabilityFunction?: string | null;
  accountabilityPerson?: string | null;
  remarks?: string | null;
  status?: string;
  riskProbability?: RiskProbability;
  severity?: RiskSeverity;
  riskScore?: number;
  sourceType?: string;
  overrideReason?: string | null;
}

export interface ProjectHealthCatchupRow {
  id?: number;
  package?: string | null;
  contractor?: string | null;
  plannedCatchupCocCrores: number;
  strategy?: string | null;
  details?: string | null;
  ownerUserId?: number | null;
  targetDate?: string | null;
  status?: string;
}

export interface ProjectHealthMilestoneRow {
  id?: number;
  towerName?: string | null;
  milestoneName: string;
  aopDate?: string | null;
  cbeDate?: string | null;
  actualDate?: string | null;
  delayDays?: number;
  milestoneGroup?: string | null;
  sourceActivityId?: number | null;
}

export interface ProjectHealthReport {
  id: number;
  projectId: number;
  reportingMonth: string;
  cbeSubmissionMonth?: string | null;
  fiscalYear?: string | null;
  status: HealthStatus;
  projectNameSnapshot?: string | null;
  zoneSnapshot?: string | null;
  regionSnapshot?: string | null;
  plannerSnapshot?: string | null;
  picSnapshot?: string | null;
  overallHealthScore: number;
  leadHealthScore: number;
  lagHealthScore: number;
  calculationBreakdown?: Record<string, any> | null;
  burnRows?: ProjectHealthBurnRow[];
  resourceRows?: ProjectHealthResourceRow[];
  risks?: ProjectHealthRiskRow[];
  catchupPlans?: ProjectHealthCatchupRow[];
  milestones?: ProjectHealthMilestoneRow[];
  createdAt?: string;
  updatedAt?: string;
}

const base = (projectId: number) =>
  `/planning/projects/${projectId}/health-reports`;

export const projectHealthService = {
  list(projectId: number): Promise<ProjectHealthReport[]> {
    return api.get(base(projectId)).then((r) => r.data);
  },

  create(projectId: number, payload: any): Promise<ProjectHealthReport> {
    return api.post(base(projectId), payload).then((r) => r.data);
  },

  get(projectId: number, reportId: number): Promise<ProjectHealthReport> {
    return api.get(`${base(projectId)}/${reportId}`).then((r) => r.data);
  },

  update(
    projectId: number,
    reportId: number,
    payload: any,
  ): Promise<ProjectHealthReport> {
    return api.patch(`${base(projectId)}/${reportId}`, payload).then((r) => r.data);
  },

  recalculate(projectId: number, reportId: number): Promise<ProjectHealthReport> {
    return api
      .post(`${base(projectId)}/${reportId}/recalculate`)
      .then((r) => r.data);
  },

  submit(projectId: number, reportId: number): Promise<ProjectHealthReport> {
    return api.post(`${base(projectId)}/${reportId}/submit`).then((r) => r.data);
  },

  lock(projectId: number, reportId: number): Promise<ProjectHealthReport> {
    return api.post(`${base(projectId)}/${reportId}/lock`).then((r) => r.data);
  },

  reopen(projectId: number, reportId: number): Promise<ProjectHealthReport> {
    return api.post(`${base(projectId)}/${reportId}/reopen`).then((r) => r.data);
  },

  saveBurn(projectId: number, reportId: number, rows: ProjectHealthBurnRow[]) {
    return api
      .patch(`${base(projectId)}/${reportId}/burn`, { rows })
      .then((r) => r.data);
  },

  saveResources(
    projectId: number,
    reportId: number,
    rows: ProjectHealthResourceRow[],
  ) {
    return api
      .patch(`${base(projectId)}/${reportId}/resources`, { rows })
      .then((r) => r.data);
  },

  saveRisks(projectId: number, reportId: number, rows: ProjectHealthRiskRow[]) {
    return api
      .patch(`${base(projectId)}/${reportId}/risks`, { rows })
      .then((r) => r.data);
  },

  saveCatchup(
    projectId: number,
    reportId: number,
    rows: ProjectHealthCatchupRow[],
  ) {
    return api
      .patch(`${base(projectId)}/${reportId}/catchup`, { rows })
      .then((r) => r.data);
  },

  saveMilestones(
    projectId: number,
    reportId: number,
    rows: ProjectHealthMilestoneRow[],
  ) {
    return api
      .patch(`${base(projectId)}/${reportId}/milestones`, { rows })
      .then((r) => r.data);
  },

  importXlsx(projectId: number, file: File): Promise<ProjectHealthReport> {
    const data = new FormData();
    data.append("file", file);
    return api
      .post(`${base(projectId)}/import-xlsx`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  downloadTemplate(projectId: number): Promise<Blob> {
    return api
      .get(`${base(projectId)}/template-xlsx`, { responseType: "blob" })
      .then((r) => r.data);
  },

  exportXlsx(projectId: number, reportId: number): Promise<Blob> {
    return api
      .get(`${base(projectId)}/${reportId}/export-xlsx`, {
        responseType: "blob",
      })
      .then((r) => r.data);
  },

  exportPdf(projectId: number, reportId: number): Promise<Blob> {
    return api
      .get(`${base(projectId)}/${reportId}/export-pdf`, { responseType: "blob" })
      .then((r) => r.data);
  },
};
