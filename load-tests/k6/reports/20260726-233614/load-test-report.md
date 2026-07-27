# SETU Load Test Report

- Generated at: 2026-07-26T23:36:14
- Base URL: http://localhost:3000
- Scenario set: core-read
- Project ID: 2
- Company ID: 1
- Activity ID: 1967
- EPS Node ID: 410

## Executive Summary

- Scenarios executed: 6
- Passed: 0
- Failed: 6
- Watch: 0
- Critical: 6
- Worst p95 latency: 0.00 ms
- Worst error rate: 0.00%

## Scenario Summary

| Scenario | Status | Health | Avg ms | p95 ms | p99 ms | Error rate | Req/s | Iter/s |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| smoke-auth | failed | Critical | n/a | n/a | n/a | n/a | n/a | n/a |
| dashboard | failed | Critical | n/a | n/a | n/a | n/a | n/a | n/a |
| progress-read | failed | Critical | n/a | n/a | n/a | n/a | n/a | n/a |
| planning-read | failed | Critical | n/a | n/a | n/a | n/a | n/a | n/a |
| design-read | failed | Critical | n/a | n/a | n/a | n/a | n/a | n/a |
| mixed-read | failed | Critical | n/a | n/a | n/a | n/a | n/a | n/a |

## Recommendations

- One or more scenarios failed completely. Stabilize those endpoints before increasing concurrency.
- Critical scenarios: smoke-auth, dashboard, progress-read, planning-read, design-read, mixed-read.

## Details

### smoke-auth

- Status: failed
- Health: Critical
- Avg latency: n/a ms
- p95 latency: n/a ms
- p99 latency: n/a ms
- Error rate: n/a
- Request rate: n/a req/s
- Iteration rate: n/a iter/s
- Checks pass rate: n/a
- Summary JSON: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\smoke-auth-summary.json
- Console log: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\smoke-auth-stdout.txt

### dashboard

- Status: failed
- Health: Critical
- Avg latency: n/a ms
- p95 latency: n/a ms
- p99 latency: n/a ms
- Error rate: n/a
- Request rate: n/a req/s
- Iteration rate: n/a iter/s
- Checks pass rate: n/a
- Summary JSON: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\dashboard-summary.json
- Console log: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\dashboard-stdout.txt

### progress-read

- Status: failed
- Health: Critical
- Avg latency: n/a ms
- p95 latency: n/a ms
- p99 latency: n/a ms
- Error rate: n/a
- Request rate: n/a req/s
- Iteration rate: n/a iter/s
- Checks pass rate: n/a
- Summary JSON: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\progress-read-summary.json
- Console log: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\progress-read-stdout.txt

### planning-read

- Status: failed
- Health: Critical
- Avg latency: n/a ms
- p95 latency: n/a ms
- p99 latency: n/a ms
- Error rate: n/a
- Request rate: n/a req/s
- Iteration rate: n/a iter/s
- Checks pass rate: n/a
- Summary JSON: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\planning-read-summary.json
- Console log: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\planning-read-stdout.txt

### design-read

- Status: failed
- Health: Critical
- Avg latency: n/a ms
- p95 latency: n/a ms
- p99 latency: n/a ms
- Error rate: n/a
- Request rate: n/a req/s
- Iteration rate: n/a iter/s
- Checks pass rate: n/a
- Summary JSON: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\design-read-summary.json
- Console log: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\design-read-stdout.txt

### mixed-read

- Status: failed
- Health: Critical
- Avg latency: n/a ms
- p95 latency: n/a ms
- p99 latency: n/a ms
- Error rate: n/a
- Request rate: n/a req/s
- Iteration rate: n/a iter/s
- Checks pass rate: n/a
- Summary JSON: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\mixed-read-summary.json
- Console log: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\mixed-read-stdout.txt

