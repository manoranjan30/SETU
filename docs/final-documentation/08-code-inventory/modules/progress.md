# Progress Module

Status: Draft  
Primary wave: C - Execution and Progress  
Related modules: Projects, WBS, BOQ, Planning, Micro Schedule, Execution, Labor, Quality, Snag, EHS, Milestones, Dashboard, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Progress module measures and communicates project delivery against planned quantities, activities, dates, milestones, and baselines. It turns execution updates and verified field information into progress values used by project teams and leadership.

### In scope

- Progress records and measurement periods
- Planned, actual, earned, weighted, and percentage progress
- Quantity-based and activity-based calculations
- WBS/BOQ/planning aggregation
- Evidence, verification, approval, and correction
- Period close, revisions, and historical reporting
- Forecast, variance, milestone, and dashboard inputs

### Out of scope

- Work execution record ownership
- Master schedule ownership
- Quality, snag, EHS, and labor record ownership
- Commercial certification unless explicitly implemented here

## 2. System Position

```text
BOQ / Planning / Execution / field evidence
    -> progress measurement and verification
    -> WBS/BOQ/activity aggregation
    -> planned-versus-actual variance
    -> forecast, milestones, dashboards, and reports
```

The document must distinguish reported progress, verified progress, earned progress, and forecast completion.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Progress |
| Backend feature | `backend/src/progress/` | Progress controllers, services, DTOs, entities, calculations, and approvals |
| Web services | `frontend/src/services/` and progress/project-health services | Progress requests, mapping, aggregation, and health indicators |
| Web views | `frontend/src/App.tsx` and dashboard/execution views | Progress entry, review, charts, trends, and reports |
| Mobile features | `flutter/lib/features/progress/` and execution/planning features | Field progress capture and review where supported |

Exact calculation engine, endpoint paths, measurement period, and approval states must be verified before approval.

## 4. Progress Model

Identify fields for project/WBS/BOQ/activity reference, period, unit, planned quantity, actual quantity, earned quantity/value, percentage, weight, status, evidence, reported-by, verified-by, approval, correction reason, and timestamps.

For every measure, state whether it is entered, calculated, imported, inherited, or verified.

## 5. Core User Journeys

### 5.1 Record progress

An authorized user selects the project, period, WBS/BOQ/activity context, quantity or activity state, and evidence. The system validates units, scope, period, and remaining quantity.

### 5.2 Review and verify progress

A supervisor or authorized reviewer checks evidence, quantity, execution state, and quality dependencies, then accepts, rejects, or returns the record for correction.

### 5.3 Close a reporting period

Document period cut-off, locking, late-entry, adjustment, approval, and reopening behavior. Historical period reports must remain reproducible.

### 5.4 Analyze variance and forecast

Users compare baseline, planned, actual, earned, and forecast progress, identify delayed areas, and communicate recovery actions. Forecast changes should link to Planning and Milestones.

## 6. Calculation Rules

Confirm:

- Quantity-based, activity-based, weighted, or hybrid calculation
- Weight source and hierarchy aggregation
- Unit conversion and decimal precision
- Partial completion and overrun behavior
- Baseline versus current plan
- Period and cumulative progress
- Earned value/amount if supported
- Rounding and aggregation order
- Treatment of rejected, cancelled, rework, and corrected records
- Locking and late corrections

The document must identify the authoritative source for each displayed progress value.

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/get progress | Progress view | Project, period, WBS, BOQ, status, pagination | Progress records/summary | None |
| To verify | Create/update progress | Progress edit | Measurement DTO and evidence | Saved progress | Calculation and audit |
| To verify | Submit/verify/reject | Progress approval | Record/period, decision, comments | Updated state | Notifications and reporting |
| To verify | Close/reopen period | Progress administration | Period/action/reason | Period status | Locking, audit, recalculation |
| To verify | Progress summary/trend | Progress view | Scope, period, baseline | Aggregated metrics | None |
| To verify | Import/export progress | Administration | File/filters/format | Results/file | Bulk changes and audit |

For each confirmed endpoint, document project scope, calculation timing, evidence rules, period locks, pagination, and errors.

## 8. Data Model and Relationships

Identify links to Projects, WBS, BOQ, Planning, Micro Schedule, Execution, Resources, Labor, Quality, Snag, EHS, Milestones, Dashboards, Notifications, and Audit.

Historical records must retain the plan/baseline, measurement period, source execution context, reviewer, and correction history used for the result.

## 9. Verification and Evidence

Define required evidence by progress type, such as quantity measurement, field photo, document, inspection, supervisor confirmation, or approval. Confirm file storage, timestamp/device metadata, reviewer rules, rejection reasons, and correction behavior.

Progress must not be marked verified solely because a user submitted a value when the project requires independent verification.

## 10. Security, Permissions, and Audit

Confirm separate permissions for viewing, reporting, entering, importing, verifying, approving, correcting, closing periods, reopening periods, and exporting.

Audit progress creation, quantity/date changes, evidence, verification, rejection, approval, period close/reopen, imports, corrections, and manual overrides. Protect project and commercially sensitive progress data by scope.

## 11. Integrations and Consumers

### Upstream dependencies

- Projects, WBS, BOQ, Planning, Micro Schedule, Execution, and field evidence
- App Config units, weights, calendars, and thresholds
- Authenticated user and project permissions

### Downstream consumers

- Milestones and Release Strategy
- Dashboards, project health, executive reporting, and AI Insights
- Quality, Snag, EHS, Labor, Cost/Budget, Notifications, and Audit

## 12. Mobile and Offline Behavior

Confirm Flutter support for offline measurement, local evidence, queued submissions, duplicate prevention, conflict handling, period locks, and access removal. Server verification remains authoritative after synchronization.

## 13. Testing Checklist

- Record valid quantity/activity progress
- Reject invalid units, periods, scope, and over-quantity cases
- Calculate period, cumulative, weighted, and aggregate progress correctly
- Verify baseline/current-plan comparisons
- Submit, verify, reject, correct, approve, close, and reopen periods
- Preserve historical reports and correction history
- Validate evidence and reviewer permissions
- Update milestones and dashboards correctly
- Prevent cross-project access and unauthorized overrides
- Verify mobile/offline queue and conflict behavior
- Record notifications and audit events

## 14. Open Questions for Approval

1. What progress calculation models are supported?
2. What is the source of weights, quantities, and earned values?
3. Which users can report, verify, approve, correct, and close periods?
4. What evidence is mandatory by progress type?
5. How are baseline and current-plan variances calculated?
6. How are rejected, cancelled, rework, and corrected quantities treated?
7. Are reporting periods configurable and lockable?
8. How does Progress update Planning, Milestones, and dashboards?
9. Is offline/mobile progress capture supported?
10. Which progress outputs feed Cost/Budget or executive reports?

## 15. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/progress/`
- Mobile feature: `flutter/lib/features/progress/`
- Execution reference: `Final Documentation/modules/execution.md`
- Planning reference: `Final Documentation/modules/planning.md`
- BOQ reference: `Final Documentation/modules/boq.md`
- Micro Schedule reference: `Final Documentation/modules/micro-schedule.md`
- Milestones reference: `Final Documentation/modules/milestones.md`
- Audit reference: `Final Documentation/modules/audit.md`

