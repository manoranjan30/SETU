import { sleep } from 'k6';
import { standardOptions } from '../lib/options.js';
import { login, fetchProfile } from '../lib/auth.js';
import { getDefaultUser } from '../lib/users.js';

export const options = standardOptions({
  vus: 1,
  duration: '15s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
});

export default function () {
  const user = getDefaultUser();
  const session = login(user);
  fetchProfile(session.token);
  sleep(1);
}
