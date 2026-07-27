# SETU Staging Performance Analysis

- Analysis generated: 2026-07-26T18:41:38.111Z
- Test generated: 2026-07-26T23:36:14
- Base URL: http://localhost:3000
- Scenario set: core-read
- Project ID: 2
- Company ID: 1
- Activity ID: 1967
- EPS Node ID: 410

## Overall Grade: Functional but not load-ready

| Scenario | Health | Status | Avg | Median | p90 | p95 | p99 | Max | Fail | Checks | Req/s | Requests |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| smoke-auth | Critical | failed | 992 ms | 785 ms | 2.19s | 2.46s | 0 ms | 2.74s | 0.00% | 100.00% | 0.66 | 10 |
| dashboard | Critical | failed | 1.51s | 417 ms | 1.77s | 11.61s | 0 ms | 23.05s | 0.00% | 100.00% | 5.30 | 360 |
| progress-read | Critical | failed | 5.11s | 1.18s | 22.15s | 24.93s | 0 ms | 26.87s | 0.00% | 100.00% | 1.67 | 150 |
| planning-read | Critical | failed | 2.92s | 1.43s | 5.81s | 14.00s | 0 ms | 26.56s | 3.86% | 96.14% | 2.88 | 259 |
| design-read | Critical | failed | 6.15s | 789 ms | 23.85s | 25.67s | 0 ms | 25.99s | 0.00% | 100.00% | 1.20 | 90 |
| mixed-read | Critical | failed | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## Interpretation

- Healthy: p95 is under 2s, failures are below 1%, checks are at least 99%.
- Watch: p95 is 2-5s or low failures/check misses are present.
- Critical: p95 is above 5s, failures exceed safe limits, checks are weak, or the scenario did not finish.

## Recommendations

- Optimize high p95 latency first: design-read, progress-read, planning-read, dashboard.
- Investigate request failures/check failures in: planning-read.
- Re-run or isolate scenarios without summaries: mixed-read.
- Treat mixed-read failure as a capacity warning. Reduce ramp size, inspect DB slow queries, then increase concurrency gradually.
- Compare this staging report against local and future reports using p95 latency, error rate, checks pass rate, and throughput.

## Files

- Manifest: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\suite-manifest.json
- k6 Markdown report: C:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\load-tests\k6\reports\20260726-233614\load-test-report.md

