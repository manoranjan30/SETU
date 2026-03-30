import type { RegisteredExportDefinition } from "../types/data-transfer";

type DashboardReportExportContext = {
  reportName?: string;
  reportId?: number;
};

type DashboardViewerExportContext = {
  dashboardName?: string;
  dashboardId?: number;
};

type BoqExportContext = {
  projectId?: number | string;
};

type DrawingRegisterExportContext = {
  projectId?: number | string;
};

type WbsExportContext = {
  projectId?: number | string;
};

type LaborExportContext = {
  projectId?: number | string;
  tab?: string;
};

type EpsExportContext = {
  scope?: string;
};

type CostAopExportContext = {
  fy?: number;
};

type QualityActivityListExportContext = {
  projectId?: number | string;
};

const exportDefinitions: Record<string, RegisteredExportDefinition<any>> = {
  "dashboard.report": {
    key: "dashboard.report",
    label: "Dashboard Report",
    supportedFormats: ["EXCEL", "CSV", "PDF"],
    defaultSheetName: "Report",
    buildFileName: (context: DashboardReportExportContext) => {
      const base = context.reportName?.trim() || `Report_${context.reportId ?? "Export"}`;
      return `${base}_${new Date().toISOString().slice(0, 10)}`;
    },
  },
  "dashboard.viewer": {
    key: "dashboard.viewer",
    label: "Dashboard Viewer",
    supportedFormats: ["PDF"],
    defaultSheetName: "Dashboard",
    buildFileName: (context: DashboardViewerExportContext) => {
      const base =
        context.dashboardName?.trim() || `Dashboard_${context.dashboardId ?? "Export"}`;
      return `${base}_${new Date().toISOString().slice(0, 10)}`;
    },
  },
  "boq.items": {
    key: "boq.items",
    label: "BOQ Items",
    supportedFormats: ["EXCEL", "CSV"],
    defaultSheetName: "BOQ",
    buildFileName: (context: BoqExportContext) =>
      `BOQ_Export_${context.projectId ?? "Project"}_${new Date().toISOString().slice(0, 10)}`,
  },
  "design.drawing-register": {
    key: "design.drawing-register",
    label: "Drawing Register",
    supportedFormats: ["EXCEL", "CSV"],
    defaultSheetName: "Drawing Register",
    buildFileName: (context: DrawingRegisterExportContext) =>
      `Drawing_Register_${context.projectId ?? "Project"}_${new Date().toISOString().slice(0, 10)}`,
  },
  "wbs.structure": {
    key: "wbs.structure",
    label: "WBS Structure",
    supportedFormats: ["EXCEL", "CSV"],
    defaultSheetName: "WBS",
    buildFileName: (context: WbsExportContext) =>
      `WBS_Export_${context.projectId ?? "Project"}_${new Date().toISOString().slice(0, 10)}`,
  },
  "labor.counts": {
    key: "labor.counts",
    label: "Labor Counts",
    supportedFormats: ["EXCEL", "CSV"],
    defaultSheetName: "Labor",
    buildFileName: (context: LaborExportContext) =>
      `Labor_${context.tab ?? "Report"}_${context.projectId ?? "Project"}_${new Date().toISOString().slice(0, 10)}`,
  },
  "eps.structure": {
    key: "eps.structure",
    label: "EPS Structure",
    supportedFormats: ["EXCEL", "CSV"],
    defaultSheetName: "EPS",
    buildFileName: (context: EpsExportContext) =>
      `EPS_${context.scope ?? "Structure"}_${new Date().toISOString().slice(0, 10)}`,
  },
  "planning.cost-aop": {
    key: "planning.cost-aop",
    label: "Cost AOP",
    supportedFormats: ["EXCEL", "CSV"],
    defaultSheetName: "AOP",
    buildFileName: (context: CostAopExportContext) =>
      `AOP_FY${context.fy ?? "Export"}_${new Date().toISOString().slice(0, 10)}`,
  },
  "quality.activity-lists": {
    key: "quality.activity-lists",
    label: "Quality Activity Lists",
    supportedFormats: ["EXCEL", "CSV"],
    defaultSheetName: "Activity Lists",
    buildFileName: (context: QualityActivityListExportContext) =>
      `Quality_Activity_Lists_${context.projectId ?? "Project"}_${new Date().toISOString().slice(0, 10)}`,
  },
};

export const listExportDefinitions = () => Object.values(exportDefinitions);

export const getExportDefinition = <Context = Record<string, unknown>>(
  key: string,
): RegisteredExportDefinition<Context> | undefined =>
  exportDefinitions[key] as RegisteredExportDefinition<Context> | undefined;

export const resolveRegisteredExportFileName = <Context>(
  key: string,
  context: Context,
) => {
  const definition = getExportDefinition<Context>(key);
  return definition?.buildFileName(context) ?? "export";
};
