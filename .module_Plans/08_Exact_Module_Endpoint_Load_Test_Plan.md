# Exact Module and Endpoint Load-Test Plan

## Objective
- Determine whether SETU can safely support increasing active-user concurrency.
- Measure which modules and endpoints break first under realistic traffic.
- Produce capacity evidence for infrastructure sizing and optimization decisions.

## Scope
- This plan targets live operational and reporting APIs already used by the web app.
- Existing import systems are excluded from the main load plan and should not be altered.
- Schedule import is explicitly out of scope.

## Test Philosophy
- Do not test only a single endpoint in isolation.
- Model real user journeys from the frontend call patterns.
- Separate:
  - read-heavy traffic
  - write-heavy traffic
  - file/document traffic
  - approval/workflow traffic
- Run tests in waves so you can find the failure point instead of jumping straight to 2000.

## Production-Like Test Environment Required
- Frontend:
  - static build or same production serving model as deployment
- Backend:
  - production build, not dev watch mode
- Database:
  - production-like PostgreSQL version and roughly realistic data volume
- Data:
  - at least:
    - 20+ projects
    - 5 active enterprise dashboards worth of data
    - 100k+ activity / planning / quality / execution rows combined if possible
    - realistic BOQ / WO / EPS / drawing / inspection records

## Core KPIs
- API latency:
  - p50
  - p95
  - p99
- Error rate:
  - 4xx
  - 5xx
- Throughput:
  - requests/sec by endpoint group
- System:
  - backend CPU
  - backend RAM
  - DB CPU
  - DB RAM
  - active DB connections
  - slow query count
  - disk IOPS
  - network throughput

## Suggested Acceptance Thresholds
- Read-heavy endpoints:
  - p95 < 1000 ms
  - p99 < 2500 ms
  - error rate < 1%
- Transactional writes:
  - p95 < 1500 ms
  - p99 < 3000 ms
  - error rate < 1%
- Approval / workflow actions:
  - p95 < 2000 ms
  - p99 < 4000 ms
  - error rate < 1%
- File/document preview/download:
  - measure separately; do not allow them to degrade core transactional APIs

## Test Waves
### Wave 0: Smoke
- 10 virtual users
- Validate auth, test data, and scripts

### Wave 1: Baseline
- 50 concurrent active users
- Identify obvious slow endpoints

### Wave 2: Departmental
- 150 concurrent active users

### Wave 3: Multi-project live usage
- 300 concurrent active users

### Wave 4: Heavy operations window
- 500 concurrent active users

### Wave 5: Stress
- 1000 concurrent active users

### Wave 6: Target evaluation
- 1500 concurrent active users
- 2000 concurrent active users

## User Journey Mix
- 25% dashboards and landing pages
- 20% planning / schedule / matrix views
- 15% progress entry and approvals
- 10% work orders and WO mapping reads
- 10% quality inspections / approvals
- 8% EHS read/write
- 7% design register / document preview
- 5% labor views and entries

Adjust based on your real usage if you have logs.

## Authentication Setup
- Pre-create test users for:
  - project admin
  - planner
  - progress entry user
  - progress approver
  - quality approver
  - EHS user
- Authenticate once per virtual user and reuse JWT for scenario duration.
- Include a small login/auth scenario separately to test burst login load.

---

# Scenario Catalog by Module

## 1. Authentication and Session Boot
### Purpose
- Check login burst behavior and initial session loading.

### Frontend pattern
- Login page posts credentials, then fetches profile.

### Endpoints
- `POST /api/auth/login`
- `GET /api/auth/profile`

### Load model
- Burst login: 20, 50, 100 logins per 30 seconds
- Sustained login churn: 5-10% of total VUs

### Success criteria
- No auth failure spikes
- No p95 explosion during burst

---

## 2. Executive and Management Dashboards
### Purpose
- These are likely some of the most expensive aggregated reads.

### Endpoints
- `GET /api/dashboard/summary`
- `GET /api/dashboard/burn-rate`
- `GET /api/dashboard/manpower`
- `GET /api/dashboard/milestones`
- `GET /api/dashboard/alerts`
- `GET /api/dashboard/quality-metrics`
- `GET /api/dashboard/ehs-metrics`
- `GET /api/dashboard/executive/options/companies`
- `GET /api/dashboard/executive/options/projects`
- `GET /api/dashboard/executive/enterprise`
- `GET /api/dashboard/executive/company/:companyId`
- `GET /api/dashboard/executive/project/:projectId`

### Frontend flows
- Management dashboard boot
- Executive dashboard boot
- enterprise/company/project scope switching

### Load model
- 25% of active users
- Refresh cadence every 60-120 seconds
- Add a burst where many users open dashboard at shift start

### Risks to watch
- large aggregation queries
- repeated cross-module joins
- dashboard refresh storms

---

## 3. Progress Dashboard
### Purpose
- Measure project progress reporting landing performance.

### Endpoints
- `GET /api/progress/stats/:projectId`
- `GET /api/progress/plan-vs-achieved/:projectId`
- `GET /api/progress/insights/:projectId`
- `GET /api/execution/:projectId/approvals/pending`

### Frontend flow
- open project progress dashboard tab

### Load model
- 10% of active users
- refresh every 90-180 seconds

### Risks
- derived execution and burn calculations
- project-level aggregation fanout

---

## 4. Progress Entry Read Path
### Purpose
- This is a critical transactional journey and must be tested end-to-end.

### Endpoints
- `GET /api/eps/:projectId/tree`
- `GET /api/execution/vendors/:activityId`
- `GET /api/execution/breakdown/:activityId/:epsNodeId`
- `GET /api/execution/has-micro/:activityId`

### Frontend flow
- open progress entry page
- load EPS tree
- select floor
- load activities
- select activity
- load vendors
- select vendor
- load WO/micro/direct breakdown

### Load model
- 8% of active users
- realistic user think time between steps: 2-8 seconds

### Risks
- hierarchy traversal in EPS/activity chains
- repeated breakdown queries
- micro/WO aggregation cost

---

## 5. Progress Entry Save and Approval
### Purpose
- Measure the most business-critical write path.

### Endpoints
- `POST /api/execution/progress/micro`
- `GET /api/execution/:projectId/approvals/pending`
- `POST /api/execution/approve`
- `POST /api/execution/reject`
- `GET /api/execution/:projectId/logs`
- `PATCH /api/execution/logs/:logId`
- `DELETE /api/execution/logs/:logId`

### Scenarios
#### Scenario A: Submit progress
- select mapped micro item or direct item
- submit qty

#### Scenario B: Approve progress
- approver loads pending items
- approves selected rows

#### Scenario C: Mixed contention
- entry users submit while approvers approve at same time

### Load model
- 5% submitters
- 2% approvers

### Special checks
- lock contention
- duplicate submission behavior
- race conditions in quantity reservation

---

## 6. Planning and Execution Mapping Reads
### Purpose
- Validate heavy planning screens that planners keep open for long sessions.

### Endpoints
- `GET /api/planning/:projectId/stats`
- `GET /api/planning/:projectId/matrix`
- `GET /api/planning/:projectId/unlinked-activities`
- `GET /api/planning/mapper/boq/:projectId`
- `GET /api/planning/:projectId/gap-analysis`
- `GET /api/planning/:projectId/execution-ready`
- `GET /api/planning/:projectId/distribution-matrix`
- `GET /api/planning/:projectId/relationships`
- `GET /api/projects/:projectId/wbs`
- `GET /api/projects/:projectId/wbs/activities`
- `GET /api/workdoc/mapper/wo-items/:projectId`

### Frontend flows
- planning matrix boot
- schedule distribution matrix boot
- WO mapper boot
- gap analysis open

### Load model
- 10% of active users
- lower concurrency than dashboards, but potentially heavier queries

### Risks
- large payload sizes
- nested data trees
- unpaginated matrix endpoints

---

## 7. WBS and Schedule Read Path
### Purpose
- Measure planner-heavy schedule reading without touching schedule import.

### Endpoints
- `GET /api/projects/:projectId/wbs`
- `GET /api/projects/:projectId/wbs/activities`
- `GET /api/projects/:projectId/schedule`
- `GET /api/planning/:projectId/relationships`
- `GET /api/planning/:projectId/versions`
- `GET /api/planning/versions/compare`
- `GET /api/planning/versions/:versionId/activities`

### Frontend flows
- schedule page open
- working schedule list open
- comparison view open

### Load model
- 8% of active users

### Risks
- large schedule trees
- compare endpoints and version reads

---

## 8. Work Orders and WO Linkage
### Purpose
- Validate vendor/WO-heavy project controls usage.

### Endpoints
- `GET /api/workdoc/vendors`
- `GET /api/workdoc/:projectId/work-orders`
- `GET /api/workdoc/work-orders/:woId`
- `GET /api/workdoc/:projectId/linkage-data`
- `GET /api/workdoc/:projectId/boq-tree-for-wo`
- `GET /api/workdoc/:projectId/available-boq-qty`
- `GET /api/workdoc/execution/vendors-for-activity`
- `GET /api/workdoc/execution/wo-items-for-activity`
- `POST /api/workdoc/items/:itemId/map`
- `POST /api/planning/distribute-wo`
- `POST /api/planning/unlink-wo`

### Load model
- 7% of active users

### Risks
- heavy linkage trees
- repeated BOQ/WO hierarchy reconstruction

---

## 9. BOQ Module
### Purpose
- Validate high-volume scope data reads and common edits.

### Endpoints
- `GET /api/boq/project/:projectId`
- `GET /api/boq/export/:projectId`
- `GET /api/boq/eps/:nodeId`
- `POST /api/boq`
- `POST /api/boq/sub-item`
- `PATCH /api/boq/sub-item/:id`
- `POST /api/boq/measurement`
- `PATCH /api/boq/measurement/:id`
- `PATCH /api/boq/measurements/bulk`
- `DELETE /api/boq/:id`
- `POST /api/boq/measurements/bulk-delete`

### Load model
- 5% of active users for reads
- 1-2% for edits

### Risks
- large nested project BOQ payloads
- bulk update transactions

---

## 10. Quality Inspections and Approvals
### Purpose
- Quality workflows are approval-heavy and likely high traffic.

### Endpoints
- `GET /api/quality/inspections`
- `GET /api/quality/inspections/my-pending`
- `GET /api/quality/inspections/approval-dashboard`
- `GET /api/quality/inspections/:id`
- `GET /api/quality/inspections/:id/workflow`
- `POST /api/quality/inspections`
- `PATCH /api/quality/inspections/:id/status`
- `PATCH /api/quality/inspections/stage/:stageId`
- `POST /api/quality/inspections/:id/workflow/advance`
- `POST /api/quality/inspections/:id/workflow/reject`
- `POST /api/quality/inspections/:id/workflow/reverse`
- `POST /api/quality/inspections/:id/workflow/delegate`
- `POST /api/quality/inspections/:id/stages/:stageId/approve`
- `POST /api/quality/inspections/:id/final-approve`

### Frontend flows
- inspection request
- approver work queue
- stage approval
- final approval

### Load model
- 8% of active users

### Risks
- workflow transition contention
- notification side effects
- document/photo attachments around inspections

---

## 11. Quality Lists and Site Observations
### Endpoints
- `GET /api/quality/activity-lists`
- `GET /api/quality/activity-lists/:id`
- `GET /api/quality/activity-lists/:listId/activities`
- `POST /api/quality/activity-lists`
- `PATCH /api/quality/activity-lists/:id`
- `DELETE /api/quality/activity-lists/:id`
- `POST /api/quality/activity-lists/:id/clone`
- `POST /api/quality/activities/:id/observation`
- `PATCH /api/quality/activities/:id/observation/:obsId/resolve`
- `PATCH /api/quality/activities/:id/observation/:obsId/close`
- `GET /api/quality/site-observations`
- `POST /api/quality/site-observations`
- `PATCH /api/quality/site-observations/:id/rectify`
- `PATCH /api/quality/site-observations/:id/close`

### Load model
- 5% of active users

### Risks
- activity list filters
- image upload adjacency
- workflow/notification fanout

---

## 12. EHS Module
### Purpose
- Cover broad CRUD-heavy module with moderate concurrency.

### Key endpoints
- `GET /api/ehs/:projectId/summary`
- `GET /api/ehs/:projectId/performance`
- `POST /api/ehs/:projectId/performance`
- `GET /api/ehs/:projectId/manhours`
- `POST /api/ehs/:projectId/manhours`
- `GET /api/ehs/:projectId/labor-stats`
- `GET /api/ehs/:projectId/inspections`
- `POST /api/ehs/:projectId/inspections`
- `GET /api/ehs/:projectId/trainings`
- `POST /api/ehs/:projectId/trainings`
- `GET /api/ehs/site-observations`
- `POST /api/ehs/site-observations`
- `PATCH /api/ehs/site-observations/:id/rectify`
- `PATCH /api/ehs/site-observations/:id/close`

### Load model
- 7% of active users

### Risks
- wide CRUD set across many entities
- summary dashboards mixed with transactional writes

---

## 13. Design Register and Drawing Operations
### Purpose
- Separate metadata load from actual file transfer.

### Metadata endpoints
- `GET /api/design/:projectId/register`
- `GET /api/design/:projectId/register/:registerId/revisions`
- `POST /api/design/:projectId/register/:registerId/open`
- `POST /api/design/:projectId/register`
- `PATCH /api/design/:projectId/register/:registerId`
- `DELETE /api/design/:projectId/register/:registerId`

### File endpoints
- `POST /api/design/:projectId/upload`
- `GET /api/design/:projectId/download/:revisionId`
- `GET /api/design/:projectId/preview/:revisionId`

### Load model
- Metadata: 4% of active users
- File operations: separate low-concurrency heavy-file scenario

### Risks
- uploads/downloads sharing API process
- memory and bandwidth spikes

---

## 14. Labor Module
### Endpoints
- `GET /api/labor/presence/:projectId`
- `POST /api/labor/presence/:projectId`
- `GET /api/labor/categories`
- `POST /api/labor/categories`
- `GET /api/labor/allocations/:projectId`
- `GET /api/labor/activity/:activityId`
- `POST /api/labor/activity`
- `GET /api/labor/mappings/:projectId`
- `POST /api/labor/mappings`

### Load model
- 4% of active users

### Risks
- repeated daily entry bursts

---

# Test Suites

## Suite A: Read-Only Daily Usage
- Mix:
  - dashboards
  - progress entry read path
  - planning matrix
  - work order reads
  - quality/EHS summaries
- Goal:
  - identify sustainable concurrent read capacity

## Suite B: Transactional Shift Start
- Mix:
  - login bursts
  - progress entry reads
  - progress submissions
  - approvals
  - labor entries
- Goal:
  - assess morning peak behavior

## Suite C: Planner Heavy Session
- Mix:
  - WBS/schedule reads
  - planning matrix
  - WO mapping reads
  - tower progress
  - cost summary/aop
- Goal:
  - expose heavy read/query bottlenecks

## Suite D: Quality/EHS Operational Day
- Mix:
  - inspections
  - approvals
  - observations
  - EHS summaries and updates
- Goal:
  - assess workflow write load and notification overhead

## Suite E: File and Document Stress
- Mix:
  - drawing register open
  - revision history
  - preview
  - download
- Goal:
  - confirm documents do not starve core APIs

---

# Tooling Recommendation

## Primary tool
- `k6`

## Why
- scriptable user journeys
- easy concurrency wave control
- clear p95/p99 output
- good CI integration later

## Optional supporting tools
- PostgreSQL slow query logging / pg_stat_statements
- Prometheus + Grafana or managed APM
- container metrics from Docker / Kubernetes / cloud platform

---

# Test Data Requirements
- At least:
  - 10 active projects with realistic data
  - 3 projects with large BOQ + WO + micro-schedule setups
  - 3 projects with active quality and EHS data
  - 1 project with large design register
- Create test users with realistic permission distributions:
  - dashboard viewers
  - planners
  - progress entry operators
  - progress approvers
  - quality inspectors/approvers
  - EHS officers

---

# Pass/Fail Decision Framework

## Pass for a concurrency level
- Core read APIs stay under SLA
- Transactional writes stay under SLA
- Error rate below threshold
- DB connections stable
- no systemic timeout cascade
- no memory runaway

## Fail for a concurrency level
- p95 or p99 breaches persist after ramp-up
- DB connection pool exhaustion
- repeated 5xx errors
- backend CPU pinned with latency collapse
- document/file scenarios degrade unrelated APIs severely

---

# Deliverables From Test Run
- endpoint leaderboard by p95 and error rate
- saturation point by suite
- DB slow-query report
- recommended infra size for current workload
- optimization backlog ranked by impact

---

# Recommended Execution Order
1. Add monitoring and slow-query visibility
2. Run Suite A at 50, 150, 300 users
3. Fix top slow endpoints
4. Run Suite B and Suite C at 150, 300, 500 users
5. Fix transactional and DB issues
6. Run all suites at 1000 users
7. Scale infra and retest
8. Only then attempt 1500 and 2000-user target validation

## Notes for This Codebase
- Prioritize dashboard endpoints first; they are likely to be the most expensive aggregated reads.
- Prioritize execution/progress next; this is business-critical and sensitive to concurrency.
- Test document preview/download separately because file traffic can distort API capacity results.
- Keep import flows out of the main capacity plan since they are intentionally excluded and should not be altered.
