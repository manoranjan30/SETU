import exec from 'k6/execution';
import { stagedOptions } from '../lib/options.js';
import { getEnv, getRequiredEnv } from '../lib/env.js';
import { login } from '../lib/auth.js';
import {
  getProjectContext,
  loadPendingApprovals,
  approveLogs,
  rejectLogs,
  submitProgressPayload,
  think,
} from '../lib/flow.js';
import { getApproverPool, getUserPool, pickUser } from '../lib/users.js';

export const options = stagedOptions([
  { duration: '1m', target: 10 },
  { duration: '2m', target: 25 },
  { duration: '2m', target: 50 },
  { duration: '1m', target: 0 },
], {
  thresholds: {
    http_req_duration: ['p(95)<2500', 'p(99)<5000'],
    http_req_failed: ['rate<0.02'],
  },
});

const entryUsers = getUserPool();
const approverUsers = getApproverPool();

function loadPayloadTemplate() {
  const file = getRequiredEnv('PROGRESS_WRITE_PAYLOAD_FILE');
  const raw = open(file);
  return JSON.parse(raw);
}

function buildPayload(template, vuId) {
  return {
    ...template,
    remarks: `${template.remarks || 'k6 progress entry'} [vu:${vuId}]`,
  };
}

export default function () {
  const mode = getEnv('APPROVAL_MODE', 'approve');
  const context = getProjectContext();
  const template = loadPayloadTemplate();

  const submitter = pickUser(entryUsers, exec.vu.idInTest);
  const submitterSession = login(submitter);
  const payload = buildPayload(template, exec.vu.idInTest);
  submitProgressPayload(submitterSession.token, payload);

  think(1, 3);

  const approver = pickUser(approverUsers, exec.vu.idInTest);
  const approverSession = login(approver);
  const pending = loadPendingApprovals(approverSession.token, context.projectId);

  const rows = Array.isArray(pending)
    ? pending
    : (pending && Array.isArray(pending.items))
      ? pending.items
      : (pending && Array.isArray(pending.data))
        ? pending.data
        : [];

  const logIds = rows
    .map((row) => row.id || row.logId)
    .filter((id) => typeof id === 'number' || typeof id === 'string')
    .slice(0, 1);

  if (!logIds.length) {
    return;
  }

  if (mode === 'reject') {
    rejectLogs(approverSession.token, logIds, 'k6 rejection');
  } else {
    approveLogs(approverSession.token, logIds);
  }
}
