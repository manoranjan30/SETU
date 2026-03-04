
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import RoleManagement from './pages/RoleManagement';
import PermissionsTab from './pages/user-management/PermissionsTab';
import EpsPage from './pages/EpsPage';
import WbsPage from './pages/WbsPage';
import TemplatesPage from './pages/TemplatesPage';
import TemplateDetailPage from './pages/TemplateDetailPage';

import CalendarListPage from './pages/admin/CalendarListPage';
import CalendarEditor from './pages/admin/CalendarEditor';
import BoqPage from './pages/scope/BoqPage';
import ExecutionMapper from './pages/execution/ExecutionMapper';
import ExecutionDashboard from './pages/execution/ExecutionDashboard';
import ProgressDashboard from './views/progress/ProgressDashboard';
import PlanningPage from './pages/PlanningPage';
import ScheduleComparisonGrid from './components/planning/versions/ScheduleComparisonGrid';
import LaborCountView from './views/labor/LaborCountView';
import EhsProjectDashboard from './views/ehs/EhsProjectDashboard';
import QualityProjectDashboard from './views/quality/QualityProjectDashboard';
import ActivityListsPage from './views/quality/ActivityListsPage';
import SequenceManagerPage from './views/quality/SequenceManagerPage';
import QualitySequencer from './views/quality/sequencer/QualitySequencer';
import InspectionRequestPage from './views/quality/InspectionRequestPage';
import QualityApprovalsPage from './views/quality/QualityApprovalsPage';
import DesignDashboard from './views/design/DesignDashboard';
import SystemSettings from './views/admin/SystemSettings';
import TemplateBuilder from './views/admin/TemplateBuilder';
import SystemLogs from './views/admin/SystemLogs';
import VendorMappingPage from './pages/VendorMappingPage';
import ApprovalsPage from './pages/execution/ApprovalsPage';
import WorkflowDesignerPage from './views/quality/workflow/WorkflowDesignerPage';
import UserProfilePage from './pages/UserProfilePage';
import { VendorAccessTemplatesPage } from './pages/admin/VendorAccessTemplatesPage';
import { VendorUserManagementPage } from './pages/planning/VendorUserManagementPage';
import DashboardBuilderHome from './views/dashboard-builder/DashboardBuilderHome';
import DashboardDesigner from './views/dashboard-builder/DashboardDesigner';
import DashboardViewer from './views/dashboard-builder/DashboardViewer';
import ReportBuilderHome from './views/dashboard-builder/ReportBuilderHome';
import ReportDesigner from './views/dashboard-builder/ReportDesigner';
import ReportViewer from './views/dashboard-builder/ReportViewer';
import DashboardRouter from './DashboardRouter';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

const ProtectedRoute = ({ children, permission }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;

  if (permission && !hasPermission(permission)) {
    return <div className="p-8 text-red-600">You do not have permission to view this page.</div>;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardRouter />} />
        <Route path="execution" element={
          <ProtectedRoute permission="EXECUTION.ENTRY.READ">
            <ExecutionDashboard />
          </ProtectedRoute>
        } />
        <Route path="users" element={
          <ProtectedRoute permission="MANAGE_USERS">
            <UserManagement />
          </ProtectedRoute>
        } />
        <Route path="roles" element={
          <ProtectedRoute permission="MANAGE_ROLES">
            <RoleManagement />
          </ProtectedRoute>
        } />
        <Route path="permissions" element={
          <ProtectedRoute permission="MANAGE_ROLES">
            <PermissionsTab />
          </ProtectedRoute>
        } />
        <Route path="calendars" element={
          <ProtectedRoute permission="SCHEDULE.CALENDAR.READ">
            <CalendarListPage />
          </ProtectedRoute>
        } />
        <Route path="admin/settings" element={
          <ProtectedRoute permission="MANAGE_USERS">
            <SystemSettings />
          </ProtectedRoute>
        } />
        <Route path="admin/template-builder" element={
          <ProtectedRoute permission="MANAGE_USERS">
            <TemplateBuilder />
          </ProtectedRoute>
        } />
        <Route path="admin/vendor-access-templates" element={
          <ProtectedRoute permission="TEMP_ROLE.VIEW">
            <VendorAccessTemplatesPage />
          </ProtectedRoute>
        } />
        <Route path="admin/logs" element={
          <ProtectedRoute permission="AUDIT.READ">
            <SystemLogs />
          </ProtectedRoute>
        } />
        <Route path="admin/dashboard-builder" element={
          <ProtectedRoute permission="ADMIN.DASHBOARD.READ">
            <DashboardBuilderHome />
          </ProtectedRoute>
        } />
        <Route path="admin/dashboard-builder/:id/edit" element={
          <ProtectedRoute permission="ADMIN.DASHBOARD.UPDATE">
            <DashboardDesigner />
          </ProtectedRoute>
        } />
        <Route path="viewer" element={
          <ProtectedRoute>
            <DashboardViewer />
          </ProtectedRoute>
        } />
        <Route path="viewer/:id" element={
          <ProtectedRoute>
            <DashboardViewer />
          </ProtectedRoute>
        } />
        <Route path="admin/reports" element={
          <ProtectedRoute permission="ADMIN.REPORT.READ">
            <ReportBuilderHome />
          </ProtectedRoute>
        } />
        <Route path="admin/reports/new" element={
          <ProtectedRoute permission="ADMIN.REPORT.CREATE">
            <ReportDesigner />
          </ProtectedRoute>
        } />
        <Route path="admin/reports/:id/edit" element={
          <ProtectedRoute permission="ADMIN.REPORT.UPDATE">
            <ReportDesigner />
          </ProtectedRoute>
        } />
        <Route path="admin/reports/:id" element={
          <ProtectedRoute permission="ADMIN.REPORT.READ">
            <ReportViewer />
          </ProtectedRoute>
        } />
        <Route path="profile" element={
          <ProtectedRoute>
            <UserProfilePage />
          </ProtectedRoute>
        } />
        <Route path="calendars/new" element={
          <ProtectedRoute permission="SCHEDULE.CALENDAR.CREATE">
            <CalendarEditor />
          </ProtectedRoute>
        } />
        <Route path="calendars/:id" element={
          <ProtectedRoute permission="SCHEDULE.CALENDAR.UPDATE">
            <CalendarEditor />
          </ProtectedRoute>
        } />
        <Route path="eps" element={
          <ProtectedRoute permission="EPS.NODE.READ">
            <EpsPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/wbs" element={
          <ProtectedRoute permission="WBS.NODE.READ">
            <WbsPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/boq" element={
          <ProtectedRoute permission="BOQ.ITEM.READ">
            <BoqPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/execution-mapper" element={
          <ProtectedRoute permission="PLANNING.MATRIX.READ">
            <ExecutionMapper />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/progress" element={
          <ProtectedRoute permission="EXECUTION.ENTRY.READ">
            <ProgressDashboard />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/manpower" element={
          <ProtectedRoute permission="LABOR.ENTRY.READ">
            <LaborCountView />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/planning" element={
          <ProtectedRoute permission="SCHEDULE.READ">
            <PlanningPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/planning/temp-users" element={
          <ProtectedRoute permission="TEMP_USER.VIEW">
            <VendorUserManagementPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/planning/compare" element={
          <ProtectedRoute permission="SCHEDULE.VERSION.READ">
            <ScheduleComparisonGrid />
          </ProtectedRoute>
        } />
        <Route path="wbs/templates" element={
          <ProtectedRoute permission="WBS.TEMPLATE.READ">
            <TemplatesPage />
          </ProtectedRoute>
        } />
        <Route path="wbs/templates/:templateId" element={
          <ProtectedRoute permission="WBS.TEMPLATE.MANAGE">
            <TemplateDetailPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/ehs" element={
          <ProtectedRoute permission="EHS.DASHBOARD.READ">
            <EhsProjectDashboard />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/quality" element={
          <ProtectedRoute permission="QUALITY.DASHBOARD.READ">
            <QualityProjectDashboard />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/quality/activity-lists" element={
          <ProtectedRoute permission="QUALITY.ACTIVITYLIST.READ">
            <ActivityListsPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/quality/requests" element={
          <ProtectedRoute permission="QUALITY.INSPECTION.READ">
            <InspectionRequestPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/quality/approvals" element={
          <ProtectedRoute permission="QUALITY.INSPECTION.APPROVE">
            <QualityApprovalsPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/quality/activity-lists/:listId/activities" element={
          <ProtectedRoute permission="QUALITY.ACTIVITY.READ">
            <SequenceManagerPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/quality/activity-lists/:listId/sequence" element={
          <ProtectedRoute permission="QUALITY.SEQUENCE.READ">
            <QualitySequencer />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/quality/workflow" element={
          <ProtectedRoute permission="QUALITY.WORKFLOW.READ">
            <WorkflowDesignerPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/design" element={
          <ProtectedRoute permission="DESIGN.DRAWING.READ">
            <DesignDashboard />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/vendor-mapping" element={
          <ProtectedRoute permission="WORKORDER.MAPPING.READ">
            <VendorMappingPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/approvals" element={
          <ProtectedRoute permission="EXECUTION.ENTRY.APPROVE">
            <ApprovalsPage />
          </ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
