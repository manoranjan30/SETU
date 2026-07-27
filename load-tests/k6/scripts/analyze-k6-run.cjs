#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function values(summary, metricName) {
  const metric = summary.metrics?.[metricName];
  return metric?.values || metric || {};
}

function number(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function ms(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)} ms`;
}

function percent(value) {
  if (!Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(2)}%`;
}

function scenarioMetrics(entry) {
  if (!entry.summaryPath || !fs.existsSync(entry.summaryPath)) {
    return {
      name: entry.name,
      status: entry.status || 'failed',
      hasSummary: false,
      health: 'Critical',
      note: 'Summary JSON was not produced. Scenario likely failed, was stopped, or timed out before export.',
    };
  }

  const summary = readJson(entry.summaryPath);
  const duration = values(summary, 'http_req_duration');
  const failed = values(summary, 'http_req_failed');
  const checks = values(summary, 'checks');
  const requests = values(summary, 'http_reqs');
  const iterations = values(summary, 'iterations');

  const avg = number(duration.avg);
  const med = number(duration.med);
  const p90 = number(duration['p(90)']);
  const p95 = number(duration['p(95)']);
  const p99 = number(duration['p(99)']);
  const max = number(duration.max);
  const failRate = number(failed.rate ?? failed.value);
  const checkRate = number(checks.rate ?? checks.value);
  const requestRate = number(requests.rate);

  let health = 'Healthy';
  if (entry.exitCode !== 0 || failRate >= 0.05 || p95 >= 5000 || checkRate < 0.98) {
    health = 'Critical';
  } else if (failRate >= 0.01 || p95 >= 2000 || checkRate < 0.99) {
    health = 'Watch';
  }

  return {
    name: entry.name,
    status: entry.status,
    exitCode: entry.exitCode,
    hasSummary: true,
    health,
    avg,
    med,
    p90,
    p95,
    p99,
    max,
    failRate,
    checkRate,
    requestRate,
    requests: number(requests.count),
    iterations: number(iterations.count),
    summaryPath: entry.summaryPath,
    stdoutPath: entry.stdoutPath,
    stderrPath: entry.stderrPath,
  };
}

function grade(metrics) {
  const completed = metrics.filter((item) => item.hasSummary);
  const worstP95 = completed.reduce((max, item) => Math.max(max, item.p95 || 0), 0);
  const worstFail = completed.reduce((max, item) => Math.max(max, item.failRate || 0), 0);
  const critical = metrics.filter((item) => item.health === 'Critical').length;

  if (critical > 0 || worstFail >= 0.05 || worstP95 >= 10000) return 'Functional but not load-ready';
  if (worstFail >= 0.01 || worstP95 >= 3000) return 'Usable, needs performance tuning';
  if (worstP95 >= 1500) return 'Acceptable for light usage';
  return 'Healthy baseline';
}

function recommendations(metrics) {
  const recs = [];
  const slow = metrics
    .filter((item) => item.hasSummary && item.p95 >= 5000)
    .sort((left, right) => right.p95 - left.p95)
    .map((item) => item.name);
  const failing = metrics
    .filter((item) => item.hasSummary && item.failRate >= 0.01)
    .map((item) => item.name);
  const missing = metrics.filter((item) => !item.hasSummary).map((item) => item.name);

  if (slow.length) {
    recs.push(`Optimize high p95 latency first: ${slow.join(', ')}.`);
  }
  if (failing.length) {
    recs.push(`Investigate request failures/check failures in: ${failing.join(', ')}.`);
  }
  if (missing.length) {
    recs.push(`Re-run or isolate scenarios without summaries: ${missing.join(', ')}.`);
  }
  if (metrics.some((item) => item.name === 'mixed-read' && item.health === 'Critical')) {
    recs.push('Treat mixed-read failure as a capacity warning. Reduce ramp size, inspect DB slow queries, then increase concurrency gradually.');
  }
  recs.push('Compare this staging report against local and future reports using p95 latency, error rate, checks pass rate, and throughput.');
  return recs;
}

function markdown(manifest, metrics) {
  const runGrade = grade(metrics);
  const recs = recommendations(metrics);
  const generatedAt = new Date().toISOString();
  const rows = [];

  rows.push('# SETU Staging Performance Analysis');
  rows.push('');
  rows.push(`- Analysis generated: ${generatedAt}`);
  rows.push(`- Test generated: ${manifest.generatedAt || 'n/a'}`);
  rows.push(`- Base URL: ${manifest.baseUrl || 'n/a'}`);
  rows.push(`- Scenario set: ${manifest.scenarioSet || 'n/a'}`);
  rows.push(`- Project ID: ${manifest.environment?.projectId || 'n/a'}`);
  rows.push(`- Company ID: ${manifest.environment?.companyId || 'n/a'}`);
  rows.push(`- Activity ID: ${manifest.environment?.activityId || 'n/a'}`);
  rows.push(`- EPS Node ID: ${manifest.environment?.epsNodeId || 'n/a'}`);
  rows.push('');
  rows.push(`## Overall Grade: ${runGrade}`);
  rows.push('');
  rows.push('| Scenario | Health | Status | Avg | Median | p90 | p95 | p99 | Max | Fail | Checks | Req/s | Requests |');
  rows.push('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const item of metrics) {
    if (!item.hasSummary) {
      rows.push(`| ${item.name} | ${item.health} | ${item.status} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`);
      continue;
    }
    rows.push(`| ${item.name} | ${item.health} | ${item.status} | ${ms(item.avg)} | ${ms(item.med)} | ${ms(item.p90)} | ${ms(item.p95)} | ${ms(item.p99)} | ${ms(item.max)} | ${percent(item.failRate)} | ${percent(item.checkRate)} | ${item.requestRate.toFixed(2)} | ${item.requests} |`);
  }
  rows.push('');
  rows.push('## Interpretation');
  rows.push('');
  rows.push('- Healthy: p95 is under 2s, failures are below 1%, checks are at least 99%.');
  rows.push('- Watch: p95 is 2-5s or low failures/check misses are present.');
  rows.push('- Critical: p95 is above 5s, failures exceed safe limits, checks are weak, or the scenario did not finish.');
  rows.push('');
  rows.push('## Recommendations');
  rows.push('');
  for (const rec of recs) rows.push(`- ${rec}`);
  rows.push('');
  rows.push('## Files');
  rows.push('');
  rows.push(`- Manifest: ${manifest.runDirectory ? path.join(manifest.runDirectory, 'suite-manifest.json') : 'n/a'}`);
  rows.push(`- k6 Markdown report: ${manifest.runDirectory ? path.join(manifest.runDirectory, 'load-test-report.md') : 'n/a'}`);
  rows.push('');
  return `${rows.join('\n')}\n`;
}

const args = parseArgs(process.argv);
const manifestPath = args.manifest;
const outPath = args.out;

if (!manifestPath || !outPath) {
  console.error('Usage: node analyze-k6-run.cjs --manifest <suite-manifest.json> --out <analysis.md>');
  process.exit(1);
}

const manifest = readJson(manifestPath);
const metrics = (manifest.scenarios || []).map(scenarioMetrics);
fs.writeFileSync(outPath, markdown(manifest, metrics), 'utf8');
console.log(`Analysis written to ${outPath}`);
