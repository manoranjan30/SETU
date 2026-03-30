import { sleep } from 'k6';
import { authGet, authPost, expectOk, safeJson } from './http.js';
import { getNumberEnv, getRequiredEnv } from './env.js';

export function think(minSeconds = 1, maxSeconds = 3) {
  const range = Math.max(0, maxSeconds - minSeconds);
  const seconds = minSeconds + Math.random() * range;
  sleep(seconds);
}

export function getProjectContext() {
  return {
    projectId: getRequiredEnv('PROJECT_ID'),
    companyId: getNumberEnv('COMPANY_ID', 1),
    activityId: getNumberEnv('ACTIVITY_ID', 1967),
    epsNodeId: getNumberEnv('EPS_NODE_ID', 410),
  };
}

export function loadExecutiveDashboard(token, { projectId, companyId }) {
  expectOk(authGet('/dashboard/summary', token), 'dashboard summary');
  expectOk(authGet('/dashboard/burn-rate', token), 'dashboard burn rate');
  expectOk(authGet('/dashboard/manpower', token), 'dashboard manpower');
  expectOk(authGet('/dashboard/milestones', token), 'dashboard milestones');
  expectOk(authGet('/dashboard/alerts', token), 'dashboard alerts');
  expectOk(authGet('/dashboard/quality-metrics', token), 'dashboard quality metrics');
  expectOk(authGet('/dashboard/ehs-metrics', token), 'dashboard ehs metrics');
  expectOk(authGet('/dashboard/executive/options/companies', token), 'dashboard companies');
  expectOk(authGet('/dashboard/executive/options/projects', token), 'dashboard projects');
  expectOk(authGet('/dashboard/executive/enterprise', token), 'dashboard enterprise');
  expectOk(authGet(`/dashboard/executive/company/${companyId}`, token), 'dashboard company');
  expectOk(authGet(`/dashboard/executive/project/${projectId}`, token), 'dashboard project');
}

export function loadProgressDashboard(token, projectId) {
  expectOk(authGet(`/progress/stats/${projectId}`, token), 'progress stats');
  expectOk(authGet(`/progress/plan-vs-achieved/${projectId}`, token), 'progress plan-vs-achieved');
  expectOk(authGet(`/progress/insights/${projectId}`, token), 'progress insights');
  expectOk(authGet(`/execution/${projectId}/approvals/pending`, token), 'progress approvals pending');
}

export function loadProgressEntryRead(token, { projectId, activityId, epsNodeId }) {
  expectOk(authGet(`/eps/${projectId}/tree`, token), 'eps tree');
  expectOk(authGet(`/execution/vendors/${activityId}`, token), 'execution vendors');
  expectOk(authGet(`/execution/has-micro/${activityId}`, token), 'execution has-micro');
  return safeJson(expectOk(authGet(`/execution/breakdown/${activityId}/${epsNodeId}`, token), 'execution breakdown'));
}

export function loadPlanningRead(token, projectId) {
  expectOk(authGet(`/projects/${projectId}/wbs`, token), 'wbs tree');
  expectOk(authGet(`/projects/${projectId}/wbs/activities`, token), 'wbs activities');
  expectOk(authGet(`/projects/${projectId}/schedule`, token), 'project schedule');
  expectOk(authGet(`/planning/${projectId}/stats`, token), 'planning stats');
  expectOk(authGet(`/planning/${projectId}/matrix`, token), 'planning matrix');
  expectOk(authGet(`/planning/${projectId}/unlinked-activities`, token), 'planning unlinked');
  expectOk(authGet(`/planning/mapper/boq/${projectId}`, token), 'planning boq mapper');
  expectOk(authGet(`/planning/${projectId}/gap-analysis`, token), 'planning gap analysis');
  expectOk(authGet(`/planning/${projectId}/execution-ready`, token), 'planning execution ready');
  expectOk(authGet(`/planning/${projectId}/distribution-matrix`, token), 'planning distribution matrix');
  expectOk(authGet(`/planning/${projectId}/relationships`, token), 'planning relationships');
  expectOk(authGet(`/planning/${projectId}/versions`, token), 'planning versions');
}

export function loadDesignRead(token, projectId) {
  const registerResponse = expectOk(authGet(`/design/${projectId}/register`, token), 'design register');
  const register = safeJson(registerResponse);
  const firstItem = Array.isArray(register)
    ? register[0]
    : (register && register.items && Array.isArray(register.items) ? register.items[0] : null);

  if (firstItem && firstItem.id) {
    expectOk(
      authGet(`/design/${projectId}/register/${firstItem.id}/revisions`, token),
      'design revisions',
    );
  }
}

export function loadWorkdocRead(token, projectId) {
  expectOk(authGet('/workdoc/vendors', token), 'workdoc vendors');
  expectOk(authGet(`/workdoc/${projectId}/work-orders`, token), 'workdoc project work orders');
  expectOk(authGet(`/workdoc/${projectId}/linkage-data`, token), 'workdoc linkage data');
  expectOk(authGet(`/workdoc/${projectId}/boq-tree-for-wo`, token), 'workdoc boq tree');
  expectOk(authGet(`/workdoc/${projectId}/available-boq-qty`, token), 'workdoc available boq qty');
}

export function loadQualityRead(token, projectId) {
  expectOk(authGet(`/quality/${projectId}/summary`, token), 'quality summary');
  expectOk(authGet('/quality/activity-lists', token), 'quality activity lists');
  expectOk(authGet('/quality/inspections', token), 'quality inspections');
  expectOk(authGet('/quality/inspections/my-pending', token), 'quality my pending');
  expectOk(authGet('/quality/inspections/approval-dashboard', token), 'quality approval dashboard');
}

export function loadEhsRead(token, projectId) {
  expectOk(authGet(`/ehs/${projectId}/summary`, token), 'ehs summary');
  expectOk(authGet(`/ehs/${projectId}/performance`, token), 'ehs performance');
  expectOk(authGet(`/ehs/${projectId}/manhours`, token), 'ehs manhours');
  expectOk(authGet(`/ehs/${projectId}/labor-stats`, token), 'ehs labor stats');
  expectOk(authGet(`/ehs/${projectId}/inspections`, token), 'ehs inspections');
}

export function submitProgressPayload(token, payload) {
  return expectOk(authPost('/execution/progress/micro', token, payload), 'execution submit progress');
}

export function loadPendingApprovals(token, projectId) {
  return safeJson(expectOk(authGet(`/execution/${projectId}/approvals/pending`, token), 'execution pending approvals'));
}

export function approveLogs(token, logIds) {
  return expectOk(authPost('/execution/approve', token, { logIds }), 'execution approve');
}

export function rejectLogs(token, logIds, reason = 'Load test rejection') {
  return expectOk(authPost('/execution/reject', token, { logIds, reason }), 'execution reject');
}
