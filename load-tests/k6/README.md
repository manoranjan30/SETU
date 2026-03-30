# SETU k6 Load Test Suite

This folder contains a safe, additive load-test scaffold for SETU.

It does not alter the app. It gives you runnable `k6` scripts for:
- authentication smoke
- dashboards
- progress entry read flow
- planning read flow
- design/document read flow
- mixed read traffic
- transactional progress/approval flow using explicit payload templates

## Prerequisites
- Install `k6`: https://k6.io/docs/get-started/installation/
- Run against a production-like environment, not local dev watch mode.
- Make sure `node` is available in PATH for report generation.

## Folder Structure
- `lib/`
  - shared helpers
- `scenarios/`
  - runnable scripts
- `payloads/`
  - optional JSON payload templates for write scenarios
- `scripts/`
  - report generator
- `reports/`
  - output folder created by the runner

## Quick Start

### 1. Smoke auth test
```powershell
$env:BASE_URL="http://localhost:3000"
$env:K6_USERNAME="admin"
$env:K6_PASSWORD="admin"
k6 run load-tests/k6/scenarios/smoke-auth.js
```

### 2. Executive dashboard test
```powershell
$env:BASE_URL="http://localhost:3000"
$env:K6_USERNAME="admin"
$env:K6_PASSWORD="admin"
$env:PROJECT_ID="2"
$env:COMPANY_ID="1"
k6 run load-tests/k6/scenarios/dashboard.js
```

### 3. Progress read test
```powershell
$env:BASE_URL="http://localhost:3000"
$env:K6_USERNAME="admin"
$env:K6_PASSWORD="admin"
$env:PROJECT_ID="2"
$env:ACTIVITY_ID="1967"
$env:EPS_NODE_ID="410"
k6 run load-tests/k6/scenarios/progress-read.js
```

### 4. Planning read test
```powershell
$env:BASE_URL="http://localhost:3000"
$env:K6_USERNAME="admin"
$env:K6_PASSWORD="admin"
$env:PROJECT_ID="2"
k6 run load-tests/k6/scenarios/planning-read.js
```

### 5. Design/document read test
```powershell
$env:BASE_URL="http://localhost:3000"
$env:K6_USERNAME="admin"
$env:K6_PASSWORD="admin"
$env:PROJECT_ID="2"
k6 run load-tests/k6/scenarios/design-read.js
```

## One-command suite runner
```powershell
powershell -ExecutionPolicy Bypass -File .\load-tests\k6\run-k6-suite.ps1 `
  -BaseUrl "http://localhost:3000" `
  -Username "admin" `
  -Password "admin" `
  -ProjectId "2" `
  -CompanyId "1" `
  -ActivityId "1967" `
  -EpsNodeId "410" `
  -ScenarioSet "core-read"
```

This will:
- run the selected scenarios sequentially
- save raw `k6` summaries and console logs
- generate:
  - `suite-manifest.json`
  - `load-test-report.md`
  - `load-test-report.pdf`

Reports are written under:
- `load-tests/k6/reports/<timestamp>/`

## Windows batch shortcut
You can also run the suite with:
```bat
load-tests\k6\run-k6-suite.bat
```

If `load-tests\k6\.env` exists, the batch file will load values from it first.

To get started quickly:
1. copy `load-tests\k6\.env.example` to `load-tests\k6\.env`
2. edit the values
3. run `load-tests\k6\run-k6-suite.bat`

## Auto-discover `.env` and progress payload
If your backend is running and your credentials are valid, you can auto-refresh the load-test config from the API:

```powershell
node .\load-tests\k6\scripts\discover-load-context.cjs
```

This updates:
- `load-tests/k6/.env`
- `load-tests/k6/payloads/progress-entry.auto.json`

The discovery script tries to:
- log in
- find a company and project
- find a likely EPS floor node
- find a likely execution-ready activity
- fetch progress breakdown
- build a usable write payload

## Important: what `BASE_URL` should be
`BASE_URL` must be the **backend URL**, not the frontend URL.

Examples:
- local backend:
  - `BASE_URL=http://localhost:3000`
- deployed backend:
  - `BASE_URL=http://your-server-ip:3000`
  - or `BASE_URL=https://api.yourdomain.com`

Do not use:
- `http://localhost:5173`
- any frontend Vite URL

## Automatic k6 download
If `k6` is not installed in PATH, the PowerShell runner now:
- downloads a local Windows `k6.exe`
- stores it under:
  - `load-tests/k6/tools/k6/current/k6.exe`
- uses that local executable automatically

You do not need to install `k6` manually anymore for Windows if internet access is available.

## Environment Variables

### Common
- `BASE_URL`
  - backend root, for example `http://localhost:3000`
- `K6_USERNAME`
- `K6_PASSWORD`
- `PROJECT_ID`
- `COMPANY_ID`
- `ACTIVITY_ID`
- `EPS_NODE_ID`

### Optional user pools
- `K6_USERS_JSON`
  - JSON array of users:
  ```json
  [
    { "username": "planner1", "password": "secret" },
    { "username": "planner2", "password": "secret" }
  ]
  ```
- `K6_APPROVERS_JSON`
  - JSON array of approver users for approval scenarios

### Transactional scenario helpers
- `PROGRESS_WRITE_PAYLOAD_FILE`
  - path to a JSON payload template for `POST /api/execution/progress/micro`
- `APPROVAL_MODE`
  - `approve` or `reject`

## Why the write flow uses payload files
The read scenarios are fully generic and safe to run.

The transactional `progress-write-approve.js` script is also usable, but progress payloads in this app depend on live mapped activity/vendor/WO/micro context. To avoid guessing fields incorrectly, the script supports loading an explicit payload template from `payloads/`.

This keeps the suite accurate and safe.

## PDF report generation
- The suite uses:
  - `load-tests/k6/scripts/generate-k6-report.cjs`
- It tries to load `pdfkit` from:
  - normal Node resolution
  - `backend/node_modules/pdfkit`

If you only want JSON and Markdown outputs:
```powershell
powershell -ExecutionPolicy Bypass -File .\load-tests\k6\run-k6-suite.ps1 -SkipPdf
```

The PDF report now includes:
- executive summary
- scenario table
- p95 latency chart by scenario
- error-rate chart by scenario
- detailed notes per scenario

## Suggested Ramp Order
1. `smoke-auth.js`
2. `dashboard.js`
3. `progress-read.js`
4. `planning-read.js`
5. `design-read.js`
6. `mixed-read.js`
7. `progress-write-approve.js`

## Recommended First Concurrency Waves
- 10 VUs
- 50 VUs
- 150 VUs
- 300 VUs
- 500 VUs
- 1000 VUs

Only go beyond that after analyzing latency, errors, and DB connections.
