#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const payloadPath = path.join(rootDir, 'payloads', 'progress-entry.auto.json');

function parseDotEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return {};
  return parseDotEnv(fs.readFileSync(envPath, 'utf8'));
}

function saveEnv(values) {
  const lines = [
    `BASE_URL=${values.BASE_URL}`,
    `K6_USERNAME=${values.K6_USERNAME}`,
    `K6_PASSWORD=${values.K6_PASSWORD}`,
    `PROJECT_ID=${values.PROJECT_ID}`,
    `COMPANY_ID=${values.COMPANY_ID}`,
    `ACTIVITY_ID=${values.ACTIVITY_ID}`,
    `EPS_NODE_ID=${values.EPS_NODE_ID}`,
    `SCENARIO_SET=${values.SCENARIO_SET || 'core-read'}`,
    `PROGRESS_WRITE_PAYLOAD_FILE=${values.PROGRESS_WRITE_PAYLOAD_FILE || 'load-tests/k6/payloads/progress-entry.auto.json'}`,
    '',
    '# Optional',
    '# APPROVAL_MODE=approve',
    '# VUS=10',
    '# DURATION_SECONDS=60',
    '',
  ];
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

function firstNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function baseUrl(raw) {
  return String(raw || 'http://localhost:3000').replace(/\/+$/, '');
}

async function apiGet(base, token, apiPath) {
  const response = await fetch(`${base}/api${apiPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`GET ${apiPath} failed with ${response.status}`);
  }
  return response.json();
}

async function apiPost(base, token, apiPath, body) {
  const response = await fetch(`${base}/api${apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${apiPath} failed with ${response.status}`);
  }
  return response.json();
}

async function login(base, username, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(`Login failed with ${response.status}. Check K6_USERNAME/K6_PASSWORD in load-tests/k6/.env`);
  }
  const body = await response.json();
  const token = body.access_token || body.accessToken || body.token || body.jwt;
  if (!token) {
    throw new Error('Login succeeded but no token field was found in response.');
  }
  return token;
}

function flattenTree(nodes, depth = 0, parentPath = []) {
  const out = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const id = firstNumber(node.id);
    const name = node.name || node.title || node.label || '';
    const children = node.children || node.items || [];
    const pathParts = [...parentPath, name].filter(Boolean);
    out.push({
      id,
      name,
      depth,
      path: pathParts.join(' > '),
      raw: node,
    });
    out.push(...flattenTree(children, depth + 1, pathParts));
  }
  return out;
}

function deepWalk(value, visit, seen = new Set()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  visit(value);
  if (Array.isArray(value)) {
    value.forEach((item) => deepWalk(item, visit, seen));
    return;
  }
  Object.values(value).forEach((child) => deepWalk(child, visit, seen));
}

function discoverActivityCandidate(executionReady) {
  const candidates = [];

  deepWalk(executionReady, (obj) => {
    const activityId =
      firstNumber(obj.activityId) ??
      firstNumber(obj.id);
    const epsNodeId =
      firstNumber(obj.epsNodeId) ??
      firstNumber(obj.wbsNodeId) ??
      firstNumber(obj.executionEpsNodeId) ??
      firstNumber(obj.projectId);

    if (activityId && epsNodeId) {
      candidates.push({
        activityId,
        epsNodeId,
        score:
          (obj.planId ? 10 : 0) +
          (obj.workOrderItemId ? 8 : 0) +
          (obj.vendorId ? 4 : 0) +
          (obj.activityCode ? 2 : 0),
        raw: obj,
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function discoverBreakdownPayload(breakdown, fallback) {
  let payload = {
    projectId: fallback.projectId,
    activityId: fallback.activityId,
    wbsNodeId: fallback.epsNodeId,
    planId: fallback.planId || 51,
    workOrderItemId: fallback.workOrderItemId || 13796,
    microActivityId: fallback.microActivityId || 15,
    vendorId: fallback.vendorId || 1,
    boqSubItemId: fallback.boqSubItemId || 1,
    qty: 5,
    entryDate: new Date().toISOString().slice(0, 10),
    remarks: 'k6 auto payload',
  };

  deepWalk(breakdown, (obj) => {
    const planId = firstNumber(obj.planId);
    const workOrderItemId = firstNumber(obj.workOrderItemId);
    const microActivityId = firstNumber(obj.microActivityId);
    const vendorId = firstNumber(obj.vendorId);
    const boqSubItemId = firstNumber(obj.boqSubItemId);

    if (planId && workOrderItemId) {
      payload.planId = payload.planId || planId;
      payload.workOrderItemId = payload.workOrderItemId || workOrderItemId;
    }
    if (microActivityId && !payload.microActivityId) {
      payload.microActivityId = microActivityId;
    }
    if (vendorId && !payload.vendorId) {
      payload.vendorId = vendorId;
    }
    if (boqSubItemId && !payload.boqSubItemId) {
      payload.boqSubItemId = boqSubItemId;
    }
  });

  return payload;
}

async function main() {
  const fileEnv = loadEnvFile();
  const current = {
    BASE_URL: process.env.BASE_URL || fileEnv.BASE_URL || 'http://localhost:3000',
    K6_USERNAME: process.env.K6_USERNAME || fileEnv.K6_USERNAME || 'admin',
    K6_PASSWORD: process.env.K6_PASSWORD || fileEnv.K6_PASSWORD || 'admin',
    PROJECT_ID: firstNumber(process.env.PROJECT_ID || fileEnv.PROJECT_ID) || 2,
    COMPANY_ID: firstNumber(process.env.COMPANY_ID || fileEnv.COMPANY_ID) || 1,
    ACTIVITY_ID: firstNumber(process.env.ACTIVITY_ID || fileEnv.ACTIVITY_ID) || 1967,
    EPS_NODE_ID: firstNumber(process.env.EPS_NODE_ID || fileEnv.EPS_NODE_ID) || 410,
    SCENARIO_SET: process.env.SCENARIO_SET || fileEnv.SCENARIO_SET || 'core-read',
    PROGRESS_WRITE_PAYLOAD_FILE:
      process.env.PROGRESS_WRITE_PAYLOAD_FILE ||
      fileEnv.PROGRESS_WRITE_PAYLOAD_FILE ||
      'load-tests/k6/payloads/progress-entry.auto.json',
  };

  const base = baseUrl(current.BASE_URL);
  const token = await login(base, current.K6_USERNAME, current.K6_PASSWORD);

  let companyId = current.COMPANY_ID;
  let projectId = current.PROJECT_ID;
  let activityId = current.ACTIVITY_ID;
  let epsNodeId = current.EPS_NODE_ID;

  try {
    const companies = await apiGet(base, token, '/dashboard/executive/options/companies');
    const firstCompany = Array.isArray(companies) ? companies[0] : companies?.items?.[0];
    if (firstCompany) {
      companyId =
        firstNumber(firstCompany.id) ??
        firstNumber(firstCompany.companyId) ??
        companyId;
    }
  } catch (_error) {
    // keep fallback
  }

  try {
    const projects = await apiGet(base, token, '/dashboard/executive/options/projects');
    const allProjects = Array.isArray(projects) ? projects : projects?.items || projects?.data || [];
    const selectedProject =
      allProjects.find((p) => firstNumber(p.id) === projectId) ||
      allProjects[0];
    if (selectedProject) {
      projectId = firstNumber(selectedProject.id) || projectId;
      companyId = firstNumber(selectedProject.companyId) || companyId;
    }
  } catch (_error) {
    // keep fallback
  }

  try {
    const epsTree = await apiGet(base, token, `/eps/${projectId}/tree`);
    const flat = flattenTree(Array.isArray(epsTree) ? epsTree : epsTree?.data || epsTree?.items || []);
    const likelyFloor =
      flat
        .filter((n) => n.id && n.depth >= 3)
        .sort((a, b) => b.depth - a.depth)[0];
    if (likelyFloor?.id) {
      epsNodeId = likelyFloor.id;
    }
  } catch (_error) {
    // keep fallback
  }

  try {
    const executionReady = await apiGet(base, token, `/planning/${projectId}/execution-ready`);
    const candidate = discoverActivityCandidate(executionReady);
    if (candidate) {
      activityId = candidate.activityId || activityId;
      epsNodeId = candidate.epsNodeId || epsNodeId;
    }
  } catch (_error) {
    // keep fallback
  }

  let payload = {
    projectId,
    activityId,
    wbsNodeId: epsNodeId,
    planId: 51,
    workOrderItemId: 13796,
    microActivityId: 15,
    vendorId: 1,
    boqSubItemId: 1,
    qty: 5,
    entryDate: new Date().toISOString().slice(0, 10),
    remarks: 'k6 auto payload',
  };

  try {
    const breakdown = await apiGet(base, token, `/execution/breakdown/${activityId}/${epsNodeId}`);
    payload = discoverBreakdownPayload(breakdown, payload);
  } catch (_error) {
    // keep fallback
  }

  saveEnv({
    BASE_URL: base,
    K6_USERNAME: current.K6_USERNAME,
    K6_PASSWORD: current.K6_PASSWORD,
    PROJECT_ID: projectId,
    COMPANY_ID: companyId,
    ACTIVITY_ID: activityId,
    EPS_NODE_ID: epsNodeId,
    SCENARIO_SET: current.SCENARIO_SET,
    PROGRESS_WRITE_PAYLOAD_FILE: current.PROGRESS_WRITE_PAYLOAD_FILE,
  });

  fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log('Discovery complete.');
  console.log(`Updated .env: ${envPath}`);
  console.log(`Updated payload: ${payloadPath}`);
  console.log(JSON.stringify({
    projectId,
    companyId,
    activityId,
    epsNodeId,
    payload,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
