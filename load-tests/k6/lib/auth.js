import http from 'k6/http';
import { check } from 'k6';
import { buildApiUrl } from './env.js';
import { safeJson } from './http.js';

export function login(user) {
  const response = http.post(
    buildApiUrl('/auth/login'),
    JSON.stringify({
      username: user.username,
      password: user.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(response, {
    'login status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  const body = safeJson(response) || {};
  const token =
    body.access_token ||
    body.accessToken ||
    body.token ||
    body.jwt ||
    ((body.data && body.data.access_token) ? body.data.access_token : null);

  if (!token) {
    throw new Error(`Login succeeded but no token found for user ${user.username}`);
  }

  return {
    token,
    raw: body,
  };
}

export function fetchProfile(token) {
  const response = http.get(buildApiUrl('/auth/profile'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  check(response, {
    'profile status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  return safeJson(response);
}
