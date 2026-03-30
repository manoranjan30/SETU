#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function maybeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return Number(value).toFixed(digits);
}

function fmtPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function metric(summary, key) {
  return summary.metrics?.[key]?.values || {};
}

function summarizeScenario(entry) {
  const summary = fs.existsSync(entry.summaryPath) ? readJson(entry.summaryPath) : {};
  const duration = metric(summary, 'http_req_duration');
  const failed = metric(summary, 'http_req_failed');
  const requests = metric(summary, 'http_reqs');
  const iterations = metric(summary, 'iterations');
  const checks = metric(summary, 'checks');

  const avg = maybeNumber(duration.avg);
  const p95 = maybeNumber(duration['p(95)'] ?? duration.p95);
  const p99 = maybeNumber(duration['p(99)'] ?? duration.p99);
  const errorRate = maybeNumber(failed.rate);
  const reqRate = maybeNumber(requests.rate);
  const iterationRate = maybeNumber(iterations.rate);
  const checkRate = maybeNumber(checks.rate);

  let health = 'Healthy';
  if (entry.exitCode !== 0 || (errorRate !== null && errorRate >= 0.05) || (p95 !== null && p95 >= 3000)) {
    health = 'Critical';
  } else if ((errorRate !== null && errorRate >= 0.01) || (p95 !== null && p95 >= 1500)) {
    health = 'Watch';
  }

  return {
    ...entry,
    summary,
    metrics: { avg, p95, p99, errorRate, reqRate, iterationRate, checkRate },
    health,
  };
}

function buildExecutiveSummary(scenarios) {
  const total = scenarios.length;
  const passed = scenarios.filter((s) => s.exitCode === 0).length;
  const failed = total - passed;
  const watch = scenarios.filter((s) => s.health === 'Watch').length;
  const critical = scenarios.filter((s) => s.health === 'Critical').length;
  const worstP95 = scenarios.map((s) => s.metrics.p95).filter((v) => v !== null).reduce((m, v) => Math.max(m, v), 0);
  const worstErrorRate = scenarios.map((s) => s.metrics.errorRate).filter((v) => v !== null).reduce((m, v) => Math.max(m, v), 0);
  return { total, passed, failed, watch, critical, worstP95, worstErrorRate };
}

function buildRecommendations(summary, scenarios) {
  const lines = [];
  if (summary.failed > 0) lines.push('One or more scenarios failed completely. Stabilize those endpoints before increasing concurrency.');
  if (summary.worstErrorRate >= 0.01) lines.push('At least one scenario exceeded 1% error rate. Review logs, DB pressure, and slow queries.');
  if (summary.worstP95 >= 1500) lines.push('At least one scenario exceeded the p95 latency target of 1500 ms. Optimize the slowest endpoints before scaling up.');

  const criticalNames = scenarios.filter((s) => s.health === 'Critical').map((s) => s.name);
  if (criticalNames.length) lines.push(`Critical scenarios: ${criticalNames.join(', ')}.`);
  if (!lines.length) lines.push('All executed scenarios stayed within the default thresholds used by this report.');
  return lines;
}

function drawBarChart(doc, title, data, options = {}) {
  const chartWidth = options.width || 480;
  const barHeight = options.barHeight || 14;
  const gap = options.gap || 10;
  const maxValue = data.reduce((m, item) => Math.max(m, item.value || 0), 0) || 1;
  const left = doc.page.margins.left;

  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#184d2f').text(title);
  doc.moveDown(0.2);

  for (const item of data) {
    const label = item.label;
    const value = item.value || 0;
    const valueText = item.formatter ? item.formatter(value) : String(value);
    const barWidth = Math.max(0, (value / maxValue) * (chartWidth - 170));
    const y = doc.y;

    doc.font('Helvetica').fontSize(9).fillColor('#000').text(label, left, y, { width: 120 });
    doc
      .rect(left + 125, y + 2, chartWidth - 170, barHeight)
      .fillAndStroke('#eef4ef', '#d2ddd4');
    doc
      .rect(left + 125, y + 2, barWidth, barHeight)
      .fillAndStroke(item.color || '#3da35a', item.color || '#3da35a');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text(valueText, left + chartWidth - 40, y, {
      width: 40,
      align: 'right',
    });

    doc.y = y + barHeight + gap;
  }
}

function buildMarkdown(manifest, scenarios, summary, recommendations) {
  const out = [];
  out.push('# SETU Load Test Report');
  out.push('');
  out.push(`- Generated at: ${manifest.generatedAt}`);
  out.push(`- Base URL: ${manifest.baseUrl}`);
  out.push(`- Scenario set: ${manifest.scenarioSet}`);
  out.push(`- Project ID: ${manifest.environment?.projectId ?? 'n/a'}`);
  out.push(`- Company ID: ${manifest.environment?.companyId ?? 'n/a'}`);
  out.push(`- Activity ID: ${manifest.environment?.activityId ?? 'n/a'}`);
  out.push(`- EPS Node ID: ${manifest.environment?.epsNodeId ?? 'n/a'}`);
  out.push('');
  out.push('## Executive Summary');
  out.push('');
  out.push(`- Scenarios executed: ${summary.total}`);
  out.push(`- Passed: ${summary.passed}`);
  out.push(`- Failed: ${summary.failed}`);
  out.push(`- Watch: ${summary.watch}`);
  out.push(`- Critical: ${summary.critical}`);
  out.push(`- Worst p95 latency: ${fmt(summary.worstP95)} ms`);
  out.push(`- Worst error rate: ${fmtPercent(summary.worstErrorRate)}`);
  out.push('');
  out.push('## Scenario Summary');
  out.push('');
  out.push('| Scenario | Status | Health | Avg ms | p95 ms | p99 ms | Error rate | Req/s | Iter/s |');
  out.push('|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const s of scenarios) {
    out.push(`| ${s.name} | ${s.status} | ${s.health} | ${fmt(s.metrics.avg)} | ${fmt(s.metrics.p95)} | ${fmt(s.metrics.p99)} | ${fmtPercent(s.metrics.errorRate)} | ${fmt(s.metrics.reqRate)} | ${fmt(s.metrics.iterationRate)} |`);
  }
  out.push('');
  out.push('## Recommendations');
  out.push('');
  for (const line of recommendations) out.push(`- ${line}`);
  out.push('');
  out.push('## Details');
  out.push('');
  for (const s of scenarios) {
    out.push(`### ${s.name}`);
    out.push('');
    out.push(`- Status: ${s.status}`);
    out.push(`- Health: ${s.health}`);
    out.push(`- Avg latency: ${fmt(s.metrics.avg)} ms`);
    out.push(`- p95 latency: ${fmt(s.metrics.p95)} ms`);
    out.push(`- p99 latency: ${fmt(s.metrics.p99)} ms`);
    out.push(`- Error rate: ${fmtPercent(s.metrics.errorRate)}`);
    out.push(`- Request rate: ${fmt(s.metrics.reqRate)} req/s`);
    out.push(`- Iteration rate: ${fmt(s.metrics.iterationRate)} iter/s`);
    out.push(`- Checks pass rate: ${fmtPercent(s.metrics.checkRate)}`);
    out.push(`- Summary JSON: ${s.summaryPath}`);
    out.push(`- Console log: ${s.stdoutPath}`);
    out.push('');
  }
  return `${out.join('\n')}\n`;
}

function loadPdfKit() {
  const candidates = [
    'pdfkit',
    path.resolve(__dirname, '../../../backend/node_modules/pdfkit'),
    path.resolve(process.cwd(), 'backend/node_modules/pdfkit'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (_error) {
      // continue
    }
  }
  throw new Error('Could not load pdfkit. Make sure backend/node_modules are installed.');
}

async function writePdf(filePath, manifest, scenarios, summary, recommendations) {
  const PDFDocument = loadPdfKit();
  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  function ensureSpace(lines = 6) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - lines * 14) {
      doc.addPage();
    }
  }

  function section(title) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#184d2f').text(title);
    doc.moveDown(0.2);
  }

  function kv(label, value) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(String(value));
  }

  doc.font('Helvetica-Bold').fontSize(22).fillColor('#184d2f').text('SETU Load Test Report');
  doc.moveDown(0.4);
  kv('Generated at', manifest.generatedAt);
  kv('Base URL', manifest.baseUrl);
  kv('Scenario set', manifest.scenarioSet);
  kv('Project ID', manifest.environment?.projectId ?? 'n/a');
  kv('Company ID', manifest.environment?.companyId ?? 'n/a');
  kv('Activity ID', manifest.environment?.activityId ?? 'n/a');
  kv('EPS Node ID', manifest.environment?.epsNodeId ?? 'n/a');

  section('Executive Summary');
  kv('Scenarios executed', summary.total);
  kv('Passed', summary.passed);
  kv('Failed', summary.failed);
  kv('Watch', summary.watch);
  kv('Critical', summary.critical);
  kv('Worst p95 latency', `${fmt(summary.worstP95)} ms`);
  kv('Worst error rate', fmtPercent(summary.worstErrorRate));

  section('Recommendations');
  for (const rec of recommendations) {
    ensureSpace();
    doc.font('Helvetica').fontSize(10).fillColor('#000').text(`- ${rec}`, { width });
  }

  ensureSpace(18);
  section('Charts');
  drawBarChart(
    doc,
    'p95 Latency by Scenario',
    scenarios.map((s) => ({
      label: s.name,
      value: s.metrics.p95 || 0,
      formatter: (value) => `${fmt(value)} ms`,
      color: s.health === 'Critical' ? '#d9534f' : s.health === 'Watch' ? '#f0ad4e' : '#3da35a',
    })),
    { width }
  );

  ensureSpace(18);
  drawBarChart(
    doc,
    'Error Rate by Scenario',
    scenarios.map((s) => ({
      label: s.name,
      value: (s.metrics.errorRate || 0) * 100,
      formatter: (value) => `${fmt(value)}%`,
      color: s.health === 'Critical' ? '#d9534f' : s.health === 'Watch' ? '#f0ad4e' : '#2b7de9',
    })),
    { width }
  );

  section('Scenario Summary');
  const headers = ['Scenario', 'Status', 'Health', 'Avg', 'p95', 'p99', 'Error'];
  const cols = [145, 60, 60, 55, 55, 55, 70];
  let x = doc.page.margins.left;
  let y = doc.y;
  headers.forEach((header, index) => {
    doc.font('Helvetica-Bold').fontSize(9).text(header, x, y, { width: cols[index] });
    x += cols[index];
  });
  doc.moveTo(doc.page.margins.left, y + 14).lineTo(doc.page.width - doc.page.margins.right, y + 14).stroke('#cccccc');
  doc.y = y + 20;

  for (const s of scenarios) {
    ensureSpace(3);
    const vals = [
      s.name,
      s.status,
      s.health,
      fmt(s.metrics.avg),
      fmt(s.metrics.p95),
      fmt(s.metrics.p99),
      fmtPercent(s.metrics.errorRate),
    ];
    let rowX = doc.page.margins.left;
    const rowY = doc.y;
    vals.forEach((val, index) => {
      doc.font('Helvetica').fontSize(9).fillColor('#000').text(String(val), rowX, rowY, { width: cols[index] });
      rowX += cols[index];
    });
    doc.y = rowY + 18;
  }

  section('Detailed Scenario Notes');
  for (const s of scenarios) {
    ensureSpace(10);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#184d2f').text(s.name);
    doc.font('Helvetica').fontSize(10).fillColor('#000');
    kv('Status', s.status);
    kv('Health', s.health);
    kv('Avg latency', `${fmt(s.metrics.avg)} ms`);
    kv('p95 latency', `${fmt(s.metrics.p95)} ms`);
    kv('p99 latency', `${fmt(s.metrics.p99)} ms`);
    kv('Error rate', fmtPercent(s.metrics.errorRate));
    kv('Request rate', `${fmt(s.metrics.reqRate)} req/s`);
    kv('Iteration rate', `${fmt(s.metrics.iterationRate)} iter/s`);
    kv('Checks pass rate', fmtPercent(s.metrics.checkRate));
    doc.moveDown(0.5);
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.manifest) throw new Error('Missing --manifest argument');

  const manifest = readJson(args.manifest);
  const scenarios = (manifest.scenarios || []).map(summarizeScenario);
  const summary = buildExecutiveSummary(scenarios);
  const recommendations = buildRecommendations(summary, scenarios);
  const markdown = buildMarkdown(manifest, scenarios, summary, recommendations);

  if (args.markdown) {
    fs.writeFileSync(args.markdown, markdown, 'utf8');
  }

  const skipPdf = String(args['skip-pdf'] || 'false').toLowerCase() === 'true';
  if (args.pdf && !skipPdf) {
    await writePdf(args.pdf, manifest, scenarios, summary, recommendations);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
