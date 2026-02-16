
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
import ManagementDashboard from './views/dashboard/ManagementDashboard';
import EhsProjectDashboard from './views/ehs/EhsProjectDashboard';
import QualityProjectDashboard from './views/quality/QualityProjectDashboard';
import DesignDashboard from './views/design/DesignDashboard';
import SystemSettings from './views/admin/SystemSettings';
import TemplateBuilder from './views/admin/TemplateBuilder';

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
        <Route index element={<ManagementDashboard />} />
        <Route path="execution" element={
          <ProtectedRoute permission="VIEW_PROJECTS">
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
          <ProtectedRoute permission="MANAGE_ROLES">
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
        <Route path="calendars/new" element={
          <ProtectedRoute permission="MANAGE_ROLES">
            <CalendarEditor />
          </ProtectedRoute>
        } />
        <Route path="calendars/:id" element={
          <ProtectedRoute permission="MANAGE_ROLES">
            <CalendarEditor />
          </ProtectedRoute>
        } />
        <Route path="eps" element={
          <ProtectedRoute permission="MANAGE_EPS">
            <EpsPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/wbs" element={
          <ProtectedRoute permission="WBS.READ">
            <WbsPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/boq" element={
          <ProtectedRoute permission="WBS.READ">
            <BoqPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/execution-mapper" element={
          <ProtectedRoute permission="WBS.READ">
            <ExecutionMapper />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/progress" element={
          <ProtectedRoute permission="WBS.READ">
            <ProgressDashboard />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/manpower" element={
          <ProtectedRoute permission="WBS.READ">
            <LaborCountView />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/planning" element={
          <ProtectedRoute permission="WBS.READ">
            <PlanningPage />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/planning/compare" element={
          <ProtectedRoute permission="WBS.READ">
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
          <ProtectedRoute permission="VIEW_PROJECTS">
            <EhsProjectDashboard />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/quality" element={
          <ProtectedRoute permission="VIEW_PROJECTS">
            <QualityProjectDashboard />
          </ProtectedRoute>
        } />
        <Route path="projects/:projectId/design" element={
          <ProtectedRoute permission="VIEW_PROJECTS">
            <DesignDashboard />
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
