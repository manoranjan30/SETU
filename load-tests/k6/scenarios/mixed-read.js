import { stagedOptions } from '../lib/options.js';
import { login } from '../lib/auth.js';
import {
  getProjectContext,
  loadExecutiveDashboard,
  loadProgressDashboard,
  loadProgressEntryRead,
  loadPlanningRead,
  loadWorkdocRead,
  loadQualityRead,
  loadEhsRead,
  think,
} from '../lib/flow.js';
import { getUserPool, pickUser } from '../lib/users.js';
import exec from 'k6/execution';

export const options = stagedOptions([
  { duration: '1m', target: 50 },
  { duration: '2m', target: 150 },
  { duration: '2m', target: 300 },
  { duration: '1m', target: 0 },
], {
  thresholds: {
    http_req_duration: ['p(95)<2500', 'p(99)<5000'],
  },
});

const users = getUserPool();

export default function () {
  const user = pickUser(users, exec.vu.idInTest);
  const session = login(user);
  const context = getProjectContext();

  loadExecutiveDashboard(session.token, context);
  think(1, 3);
  loadProgressDashboard(session.token, context.projectId);
  think(1, 3);
  loadProgressEntryRead(session.token, context);
  think(2, 5);
  loadPlanningRead(session.token, context.projectId);
  think(2, 5);
  loadWorkdocRead(session.token, context.projectId);
  think(1, 3);
  loadQualityRead(session.token, context.projectId);
  think(1, 3);
  loadEhsRead(session.token, context.projectId);
  think(2, 5);
}
