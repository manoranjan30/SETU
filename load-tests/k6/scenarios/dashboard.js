import { standardOptions } from '../lib/options.js';
import { login, fetchProfile } from '../lib/auth.js';
import { getProjectContext, loadExecutiveDashboard, loadProgressDashboard, think } from '../lib/flow.js';
import { getUserPool, pickUser } from '../lib/users.js';
import exec from 'k6/execution';

export const options = standardOptions({
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3500'],
  },
});

const users = getUserPool();

export default function () {
  const user = pickUser(users, exec.vu.idInTest);
  const session = login(user);
  fetchProfile(session.token);

  const context = getProjectContext();
  loadExecutiveDashboard(session.token, context);
  think(1, 3);
  loadProgressDashboard(session.token, context.projectId);
  think(2, 5);
}
