import { standardOptions } from '../lib/options.js';
import { login } from '../lib/auth.js';
import { getProjectContext, loadProgressEntryRead, think } from '../lib/flow.js';
import { getUserPool, pickUser } from '../lib/users.js';
import exec from 'k6/execution';

export const options = standardOptions({
  thresholds: {
    http_req_duration: ['p(95)<1800', 'p(99)<3000'],
  },
});

const users = getUserPool();

export default function () {
  const user = pickUser(users, exec.vu.idInTest);
  const session = login(user);
  const context = getProjectContext();

  loadProgressEntryRead(session.token, context);
  think(2, 6);
}
