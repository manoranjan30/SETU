import http from 'k6/http';
import { check } from 'k6';
import { buildApiUrl } from './env.js';

export function jsonHeaders(token) {
  var headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  return headers;
}

function mergeParams(base, extra) {
  var out = {};
  var left = base || {};
  var right = extra || {};

  Object.keys(left).forEach(function (key) {
    out[key] = left[key];
  });

  Object.keys(right).forEach(function (key) {
    out[key] = right[key];
  });

  return out;
}

export function authGet(path, token, params) {
  return http.get(
    buildApiUrl(path),
    mergeParams(
      {
        headers: jsonHeaders(token),
      },
      params || {},
    ),
  );
}

export function authPost(path, token, body, params) {
  return http.post(
    buildApiUrl(path),
    typeof body === 'string' ? body : JSON.stringify(body),
    mergeParams(
      {
        headers: jsonHeaders(token),
      },
      params || {},
    ),
  );
}

export function authPatch(path, token, body, params) {
  return http.patch(
    buildApiUrl(path),
    typeof body === 'string' ? body : JSON.stringify(body),
    mergeParams(
      {
        headers: jsonHeaders(token),
      },
      params || {},
    ),
  );
}

export function authDelete(path, token, body, params) {
  return http.del(
    buildApiUrl(path),
    body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    mergeParams(
      {
        headers: jsonHeaders(token),
      },
      params || {},
    ),
  );
}

export function expectOk(response, label) {
  check(response, (function () {
    var assertions = {};
    assertions[label + ' status is 2xx'] = function (r) {
      return r.status >= 200 && r.status < 300;
    };
    return assertions;
  })());
  return response;
}

export function safeJson(response) {
  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}
