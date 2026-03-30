import { getNumberEnv } from './env.js';

function merge(target, source) {
  const out = {};
  const left = target || {};
  const right = source || {};

  Object.keys(left).forEach((key) => {
    out[key] = left[key];
  });

  Object.keys(right).forEach((key) => {
    out[key] = right[key];
  });

  return out;
}

export function standardOptions(overrides) {
  const baseThresholds = {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  };

  const safeOverrides = overrides || {};
  const mergedThresholds = merge(baseThresholds, safeOverrides.thresholds);
  const baseOptions = {
    vus: getNumberEnv('VUS', 10),
    duration: String(getNumberEnv('DURATION_SECONDS', 60)) + 's',
    thresholds: mergedThresholds,
  };

  return merge(baseOptions, safeOverrides);
}

export function stagedOptions(stages, overrides) {
  const baseThresholds = {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  };

  const safeOverrides = overrides || {};
  const mergedThresholds = merge(baseThresholds, safeOverrides.thresholds);
  const baseOptions = {
    stages: stages,
    thresholds: mergedThresholds,
  };

  return merge(baseOptions, safeOverrides);
}
