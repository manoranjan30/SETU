import { standardOptions } from '../lib/options.js';
import { login } from '../lib/auth.js';
import { getProjectContext, loadPlanningRead, loadWorkdocRead, think } from '../lib/flow.js';
import { getUserPool, pickUser } from '../lib/users.js';
import exec from 'k6/execution';

export const options = standardOptions({
  thresholds: {
    http_req_duration: ['p(95)<2500', 'p(99)<4500'],
  },
});

const users = getUserPool();

export default function () {
  const user = pickUser(users, exec.vu.idInTest);
  const session = login(user);
  const { projectId } = getProjectContext();

  loadPlanningRead(session.token, projectId);
  think(2, 5);
  loadWorkdocRead(session.token, projectId);
  think(2, 5);
}
