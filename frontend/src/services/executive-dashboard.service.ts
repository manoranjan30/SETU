import api from "../api/axios";

export type ExecutiveTab = "enterprise" | "company" | "project";
export type MetricFormat = "number" | "currency" | "percent" | "text";
export type MetricTone = "default" | "positive" | "warning" | "danger";
export type ListItemSeverity = "info" | "warning" | "danger" | "positive";

export interface ExecutiveOption {
  id: number;
  name: string;
  projectCount?: number;
  companyId?: number | null;
  companyName?: string | null;
  status?: string | null;
  estimatedCost?: number;
  approvedBudget?: number;
}

export interface ExecutiveMetric {
  key: string;
  label: string;
  value: number | string;
  format?: MetricFormat;
  tone?: MetricTone;
  helper?: string;
  route?: string;
  visualPercent?: number;
  visualLabel?: string;
}

export interface ExecutiveTrendPoint {
  label: string;
  value: number;
}

export interface ExecutiveTrend {
  key: string;
  label: string;
  format?: MetricFormat;
  points: ExecutiveTrendPoint[];
}

export interface ExecutiveListItem {
  key: string;
  title: string;
  description: string;
  severity: ListItemSeverity;
  value?: number | string;
  projectId?: number;
  projectName?: string;
  route?: string;
}

export interface ExecutiveSection {
  kpis: ExecutiveMetric[];
  trend: ExecutiveTrend;
  alerts: ExecutiveListItem[];
  actions: ExecutiveListItem[];
}

export interface ExecutiveRankingMetric {
  label: string;
  value: number | string;
  format?: MetricFormat;
  tone?: MetricTone;
}

export interface ExecutiveRankingRow {
  key: string;
  label: string;
  secondaryLabel?: string;
  route?: string;
  metrics: ExecutiveRankingMetric[];
}

export interface ExecutiveRankingGroup {
  key: string;
  label: string;
  rows: ExecutiveRankingRow[];
}

export interface ExecutiveSummary {
  scope: {
    mode: ExecutiveTab;
    dateFrom: string;
    dateTo: string;
    companyId: number | null;
    companyName: string | null;
    projectId: number | null;
    projectName: string | null;
    visibleCompanyCount: number;
    visibleProjectCount: number;
  };
  headline: ExecutiveMetric[];
  progressExecution: ExecutiveSection;
  quality: ExecutiveSection;
  ehs: ExecutiveSection;
  rankings: ExecutiveRankingGroup[];
}

interface RangeParams {
  dateFrom?: string;
  dateTo?: string;
}

const BASE = "/dashboard/executive";

export const executiveDashboardApi = {
  getCompanies: () => api.get<ExecutiveOption[]>(`${BASE}/options/companies`),
  getProjects: (companyId?: number | null) =>
    api.get<ExecutiveOption[]>(`${BASE}/options/projects`, {
      params: companyId ? { companyId } : undefined,
    }),
  getEnterprise: (params?: RangeParams) =>
    api.get<ExecutiveSummary>(`${BASE}/enterprise`, { params }),
  getCompany: (companyId: number, params?: RangeParams) =>
    api.get<ExecutiveSummary>(`${BASE}/company/${companyId}`, { params }),
  getProject: (projectId: number, params?: RangeParams) =>
    api.get<ExecutiveSummary>(`${BASE}/project/${projectId}`, { params }),
};
