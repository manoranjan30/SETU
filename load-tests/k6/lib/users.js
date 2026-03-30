import { getEnv, getJsonEnv } from './env.js';

export function getDefaultUser() {
  return {
    username: getEnv('K6_USERNAME', 'admin'),
    password: getEnv('K6_PASSWORD', 'admin'),
  };
}

export function getDefaultApprover() {
  return {
    username: getEnv('K6_APPROVER_USERNAME', getEnv('K6_USERNAME', 'admin')),
    password: getEnv('K6_APPROVER_PASSWORD', getEnv('K6_PASSWORD', 'admin')),
  };
}

export function getUserPool() {
  const users = getJsonEnv('K6_USERS_JSON', []);
  return users.length ? users : [getDefaultUser()];
}

export function getApproverPool() {
  const users = getJsonEnv('K6_APPROVERS_JSON', []);
  return users.length ? users : [getDefaultApprover()];
}

export function pickUser(users, vuId = 1) {
  return users[(Math.max(1, vuId) - 1) % users.length];
}
