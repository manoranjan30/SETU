# Planning Module

Status: Draft  
Primary wave: B - Project Definition and Planning  
Related modules: Projects, WBS, Design, BOQ, Resources, Micro Schedule, Milestones, Execution, Progress, Dashboard, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Planning module defines the project plan used to sequence work, assign dates and resources, track baseline commitments, and communicate forecast changes.

### In scope

- Activities, tasks, phases, and schedule structure
- WBS, BOQ, design, and resource links
- Start/finish dates, durations, calendars, and constraints
- Activity dependencies and sequencing
- Baselines, revisions, forecasts, and variance
- Planned progress and schedule updates
- Critical path, slippage, risks, and schedule reporting

### Out of scope

- Detailed field-level micro scheduling, which belongs to Micro Schedule
- Actual work completion capture, which belongs to Execution/Progress
- Project hierarchy ownership, which belongs to Projects/WBS
- Resource master ownership, which belongs to Resources

## 2. System Position

```text
Project/WBS/BOQ/design/resources
    -> baseline plan and activities
    -> dependencies, dates, and allocations
    -> updates and forecasts
    -> execution/progress comparison
    -> milestones, dashboards, and notifications
```

The system must distinguish baseline, current plan, actual dates, forecast dates, and variance.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Planning |
| Backend feature | `backend/src/planning/` | Controllers, services, DTOs, entities, dependencies, calculations, and updates |
| Web service | `frontend/src/services/planning.service.ts` | Planning requests and client mapping |
| Web extensions | `frontend/src/services/planning-extension.service.ts` | Planning-specific extensions where implemented |
| Web views | `frontend/src/App.tsx` and planning views | Schedule grids, timelines, updates, import/export, and reports |
| Mobile consumer | `flutter/lib/features/planning/` | Field planning, activity views, or updates where supported |

Exact endpoint paths, schedule engine behavior, and client feature scope must be verified before approval.

## 4. Planning Model

Identify fields for plan/version, activity identifier/code, name, WBS/BOQ/design/resource links, duration, start/finish dates, calendar, constraints, predecessor/successor links, status, planned progress, actual dates, forecast dates, owner, and audit timestamps.

The document must state which values are calculated and which are manually entered.

## 5. Core User Journeys

### 5.1 Create or import a plan

An authorized planner creates activities or imports a schedule, maps them to project/WBS context, validates dependencies and dates, and saves a draft or working plan.

### 5.2 Baseline or publish a plan

Document who may baseline/publish, what becomes immutable, how later revisions are compared, and how baseline changes are approved.

### 5.3 Update the schedule

Users record actual starts/finishes, remaining duration, progress, constraints, or forecast dates. The system recalculates dependent activities and reports variance according to the implemented rules.

### 5.4 Analyze delay and forecast

Users should identify late activities, critical path, float, affected milestones, responsible owners, and recovery actions. Exact schedule calculations must be verified rather than inferred from screen labels.

## 6. Scheduling Rules

Confirm:

- Calendar, working-day, holiday, and timezone behavior
- Dependency types and lag/lead
- Constraint types
- Duration and date calculations
- Manual versus automatic rescheduling
- Float and critical-path calculation
- Actual-progress and remaining-duration behavior
- Out-of-sequence work
- Multiple calendars and resource constraints
- Baseline and forecast comparison

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/get plan | Planning view | Project, version, WBS, filters | Plan/activity data | None |
| To verify | Create/update activity | Planning edit | Activity DTO | Saved activity | Recalculation and audit |
| To verify | Add/update dependency | Planning edit | Predecessor, successor, type, lag | Dependency result | Schedule recalculation |
| To verify | Baseline/publish plan | Planning approval | Version/action | Published baseline | Notifications and audit |
| To verify | Update progress/dates | Planning update | Activity update DTO | Updated forecast | Milestone/dashboard effects |
| To verify | Import/export schedule | Administration | File/options/filters | Results/file | Bulk changes and audit |

For each confirmed endpoint, document project scope, dependency validation, calculation behavior, bulk errors, pagination, and permissions.

## 8. Data Model and Relationships

Identify relationships to Projects, WBS, Design revisions, BOQ quantities, Resources, Micro Schedule, Milestones, Execution, Progress, Work Documents, and Dashboards.

Historical reporting must preserve the plan/baseline/version used to calculate variance. Schedule changes must not rewrite completed actual history.

## 9. Baselines, Forecasts, and Change Control

Define baseline creation, version naming, approval, comparison, variance, forecast, revision, and rollback behavior. Record who changed dates, dependencies, quantities, resources, or constraints and why.

## 10. Security, Notifications, and Audit

Confirm separate permissions for viewing, editing, importing, exporting, baseline approval, bulk update, and override of schedule constraints.

Audit plan creation, activity/dependency changes, baseline/publish, actual-date changes, forecast changes, bulk imports, and manual overrides. Notify affected owners when milestones or critical activities materially change.

## 11. Testing Checklist

- Create valid activities and dependencies
- Reject circular, invalid, or cross-project dependencies
- Calculate dates, durations, lags, float, and critical path correctly
- Apply calendars, holidays, constraints, and timezones correctly
- Baseline, revise, compare, and restore plans
- Update actual/forecast dates without corrupting history
- Detect variance and affected milestones
- Import/export valid and invalid schedules
- Validate WBS, BOQ, design, and resource links
- Enforce project and role permissions
- Verify notifications and audit events
- Confirm web and mobile behavior where planning is supported

## 12. Open Questions for Approval

1. What schedule types and activity levels are supported?
2. Which dependency types, constraints, calendars, and lag rules are implemented?
3. Is an external scheduling engine or file format used?
4. Who can baseline, publish, revise, and override plans?
5. How are actual progress and forecast dates calculated?
6. How are critical path and float calculated?
7. How are BOQ quantities and resource allocations connected to activities?
8. What is the relationship between Planning and Micro Schedule?
9. Which changes trigger milestone notifications or approvals?
10. What planning behavior is available offline in Flutter?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/planning/`
- Web services: `frontend/src/services/planning.service.ts`, `frontend/src/services/planning-extension.service.ts`
- Project reference: `Final Documentation/modules/projects.md`
- WBS reference: `Final Documentation/modules/wbs.md`
- BOQ reference: `Final Documentation/modules/boq.md`
- Resources reference: `Final Documentation/modules/resources.md`
- Planned Micro Schedule reference: `Final Documentation/modules/micro-schedule.md` (planned)
- Planned Milestones reference: `Final Documentation/modules/milestones.md` (planned)

