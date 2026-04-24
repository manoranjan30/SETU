import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { PluginRuntimeProvider } from "./context/PluginRuntimeContext";

const UserManagement = lazy(() => import("./pages/UserManagement"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));
const PermissionsTab = lazy(() => import("./pages/user-management/PermissionsTab"));
const EpsPage = lazy(() => import("./pages/EpsPage"));
const WbsPage = lazy(() => import("./pages/WbsPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const TemplateDetailPage = lazy(() => import("./pages/TemplateDetailPage"));
const CalendarListPage = lazy(() => import("./pages/admin/CalendarListPage"));
const CalendarEditor = lazy(() => import("./pages/admin/CalendarEditor"));
const BoqPage = lazy(() => import("./pages/scope/BoqPage"));
const ExecutionMapper = lazy(() => import("./pages/execution/ExecutionMapper"));
const ExecutionDashboard = lazy(() => import("./pages/execution/ExecutionDashboard"));
const ProgressDashboard = lazy(() => import("./views/progress/ProgressDashboard"));
const PlanningPage = lazy(() => import("./pages/PlanningPage"));
const ScheduleComparisonGrid = lazy(
  () => import("./components/planning/versions/ScheduleComparisonGrid"),
);
const LaborCountView = lazy(() => import("./views/labor/LaborCountView"));
const EhsProjectDashboard = lazy(() => import("./views/ehs/EhsProjectDashboard"));
const QualityProjectDashboard = lazy(
  () => import("./views/quality/QualityProjectDashboard"),
);
const ActivityListsPage = lazy(() => import("./views/quality/ActivityListsPage"));
const SequenceManagerPage = lazy(() => import("./views/quality/SequenceManagerPage"));
const QualitySequencer = lazy(() => import("./views/quality/sequencer/QualitySequencer"));
const InspectionRequestPage = lazy(() => import("./views/quality/InspectionRequestPage"));
const QualityApprovalsPage = lazy(() => import("./views/quality/QualityApprovalsPage"));
const DesignDashboard = lazy(() => import("./views/design/DesignDashboard"));
const SystemSettings = lazy(() => import("./views/admin/SystemSettings"));
const TemplateBuilder = lazy(() => import("./views/admin/TemplateBuilder"));
const SystemLogs = lazy(() => import("./views/admin/SystemLogs"));
const VendorMappingPage = lazy(() => import("./pages/VendorMappingPage"));
const ApprovalsPage = lazy(() => import("./pages/execution/ApprovalsPage"));
const WorkflowDesignerPage = lazy(
  () => import("./views/quality/workflow/WorkflowDesignerPage"),
);
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const VendorAccessTemplatesPage = lazy(() =>
  import("./pages/admin/VendorAccessTemplatesPage").then((module) => ({
    default: module.VendorAccessTemplatesPage,
  })),
);
const VendorUserManagementPage = lazy(() =>
  import("./pages/planning/VendorUserManagementPage").then((module) => ({
    default: module.VendorUserManagementPage,
  })),
);
const DashboardBuilderHome = lazy(
  () => import("./views/dashboard-builder/DashboardBuilderHome"),
);
const DashboardDesigner = lazy(() => import("./views/dashboard-builder/DashboardDesigner"));
const DashboardViewer = lazy(() => import("./views/dashboard-builder/DashboardViewer"));
const ReportBuilderHome = lazy(() => import("./views/dashboard-builder/ReportBuilderHome"));
const ReportDesigner = lazy(() => import("./views/dashboard-builder/ReportDesigner"));
const ReportViewer = lazy(() => import("./views/dashboard-builder/ReportViewer"));
const DashboardRouter = lazy(() => import("./DashboardRouter"));
const PluginRegistryPage = lazy(() => import("./pages/admin/PluginRegistryPage"));
const PluginHostPage = lazy(() => import("./pages/plugins/PluginHostPage"));
const IssueTrackerDepartmentsPage = lazy(
  () => import("./pages/admin/IssueTrackerDepartmentsPage"),
);
const IssueTrackerPage = lazy(() => import("./pages/planning/IssueTrackerPage"));
const AiInsightsPage = lazy(() => import("./pages/ai-insights/AiInsightsPage"));
const InsightResultPage = lazy(() => import("./pages/ai-insights/InsightResultPage"));
const AiInsightsAdminPage = lazy(() => import("./pages/ai-insights/AiInsightsAdminPage"));

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

const ProtectedRoute = ({ children, permission }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;

  if (permission && !hasPermission(permission)) {
    return (
      <div className="p-8 text-error">
        You do not have permission to view this page.
      </div>
    );
  }

  return <>{children}</>;
};

const RouteFallback = () => (
  <div className="flex h-screen items-center justify-center bg-surface-base text-sm font-semibold text-text-muted">
    Loading module...
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardRouter />} />
        <Route
          path="execution"
          element={
            <ProtectedRoute permission="EXECUTION.ENTRY.READ">
              <ExecutionDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute permission="MANAGE_USERS">
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="roles"
          element={
            <ProtectedRoute permission="MANAGE_ROLES">
              <RoleManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="permissions"
          element={
            <ProtectedRoute permission="MANAGE_ROLES">
              <PermissionsTab />
            </ProtectedRoute>
          }
        />
        <Route
          path="calendars"
          element={
            <ProtectedRoute permission="SCHEDULE.CALENDAR.READ">
              <CalendarListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <ProtectedRoute permission="MANAGE_USERS">
              <SystemSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/template-builder"
          element={
            <ProtectedRoute permission="MANAGE_USERS">
              <TemplateBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/vendor-access-templates"
          element={
            <ProtectedRoute permission="TEMP_ROLE.VIEW">
              <VendorAccessTemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/logs"
          element={
            <ProtectedRoute permission="AUDIT.READ">
              <SystemLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/dashboard-builder"
          element={
            <ProtectedRoute permission="ADMIN.DASHBOARD.READ">
              <DashboardBuilderHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/dashboard-builder/:id/edit"
          element={
            <ProtectedRoute permission="ADMIN.DASHBOARD.UPDATE">
              <DashboardDesigner />
            </ProtectedRoute>
          }
        />
        <Route
          path="viewer"
          element={
            <ProtectedRoute>
              <DashboardViewer />
            </ProtectedRoute>
          }
        />
        <Route
          path="viewer/:id"
          element={
            <ProtectedRoute>
              <DashboardViewer />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports"
          element={
            <ProtectedRoute permission="ADMIN.REPORT.READ">
              <ReportBuilderHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports/new"
          element={
            <ProtectedRoute permission="ADMIN.REPORT.CREATE">
              <ReportDesigner />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports/:id/edit"
          element={
            <ProtectedRoute permission="ADMIN.REPORT.UPDATE">
              <ReportDesigner />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports/:id"
          element={
            <ProtectedRoute permission="ADMIN.REPORT.READ">
              <ReportViewer />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/plugins"
          element={
            <ProtectedRoute permission="PLUGIN.REGISTRY.READ">
              <PluginRegistryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/issue-tracker"
          element={
            <ProtectedRoute permission="MANAGE_USERS">
              <IssueTrackerDepartmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/issue-tracker"
          element={
            <ProtectedRoute>
              <IssueTrackerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="calendars/new"
          element={
            <ProtectedRoute permission="SCHEDULE.CALENDAR.CREATE">
              <CalendarEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="calendars/:id"
          element={
            <ProtectedRoute permission="SCHEDULE.CALENDAR.UPDATE">
              <CalendarEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="eps"
          element={
            <ProtectedRoute permission="EPS.NODE.READ">
              <EpsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/wbs"
          element={
            <ProtectedRoute permission="WBS.NODE.READ">
              <WbsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/boq"
          element={
            <ProtectedRoute permission="BOQ.ITEM.READ">
              <BoqPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/execution-mapper"
          element={
            <ProtectedRoute permission="PLANNING.MATRIX.READ">
              <ExecutionMapper />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/progress"
          element={
            <ProtectedRoute permission="EXECUTION.ENTRY.READ">
              <ProgressDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/manpower"
          element={
            <ProtectedRoute permission="LABOR.ENTRY.READ">
              <LaborCountView />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/planning"
          element={
            <ProtectedRoute permission="SCHEDULE.READ">
              <PlanningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/planning/temp-users"
          element={
            <ProtectedRoute permission="TEMP_USER.VIEW">
              <VendorUserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/planning/compare"
          element={
            <ProtectedRoute permission="SCHEDULE.VERSION.READ">
              <ScheduleComparisonGrid />
            </ProtectedRoute>
          }
        />
        <Route
          path="wbs/templates"
          element={
            <ProtectedRoute permission="WBS.TEMPLATE.READ">
              <TemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="wbs/templates/:templateId"
          element={
            <ProtectedRoute permission="WBS.TEMPLATE.MANAGE">
              <TemplateDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/ehs"
          element={
            <ProtectedRoute permission="EHS.DASHBOARD.READ">
              <EhsProjectDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/quality"
          element={
            <ProtectedRoute permission="QUALITY.DASHBOARD.READ">
              <QualityProjectDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/quality/activity-lists"
          element={
            <ProtectedRoute permission="QUALITY.ACTIVITYLIST.READ">
              <ActivityListsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/quality/requests"
          element={
            <ProtectedRoute permission="QUALITY.INSPECTION.READ">
              <InspectionRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/quality/approvals"
          element={
            <ProtectedRoute permission="QUALITY.INSPECTION.APPROVE">
              <QualityApprovalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/quality/activity-lists/:listId/activities"
          element={
            <ProtectedRoute permission="QUALITY.ACTIVITY.READ">
              <SequenceManagerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/quality/activity-lists/:listId/sequence"
          element={
            <ProtectedRoute permission="QUALITY.SEQUENCE.READ">
              <QualitySequencer />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/quality/workflow"
          element={
            <ProtectedRoute permission="QUALITY.WORKFLOW.READ">
              <WorkflowDesignerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/design"
          element={
            <ProtectedRoute permission="DESIGN.DRAWING.READ">
              <DesignDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/vendor-mapping"
          element={
            <ProtectedRoute permission="WORKORDER.MAPPING.READ">
              <VendorMappingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/approvals"
          element={
            <ProtectedRoute permission="EXECUTION.ENTRY.APPROVE">
              <ApprovalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="plugins/:pluginKey"
          element={
            <ProtectedRoute permission="PLUGIN.RUNTIME.READ">
              <PluginHostPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="plugins/:pluginKey/:pageKey"
          element={
            <ProtectedRoute permission="PLUGIN.RUNTIME.READ">
              <PluginHostPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/plugins/:pluginKey"
          element={
            <ProtectedRoute permission="PLUGIN.RUNTIME.READ">
              <PluginHostPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/plugins/:pluginKey/:pageKey"
          element={
            <ProtectedRoute permission="PLUGIN.RUNTIME.READ">
              <PluginHostPage />
            </ProtectedRoute>
          }
        />

        {/* ── AI Insights ──────────────────────────────────────────────── */}
        <Route
          path="ai-insights"
          element={
            <ProtectedRoute permission="AI.INSIGHTS.READ">
              <AiInsightsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="ai-insights/runs/:id"
          element={
            <ProtectedRoute permission="AI.INSIGHTS.READ">
              <InsightResultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="ai-insights/admin"
          element={
            <ProtectedRoute permission="AI.INSIGHTS.ADMIN">
              <AiInsightsAdminPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PluginRuntimeProvider>
          <AppRoutes />
        </PluginRuntimeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
