# Execution Module

Status: Draft  
Primary wave: C - Execution and Progress  
Related modules: Projects, WBS, BOQ, Resources, Planning, Micro Schedule, Progress, Work Documents, Quality, Snag, EHS, Labor, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Execution module records and coordinates the work performed on a project. It connects planned activities and work packages to field assignments, execution status, quantities, evidence, blockers, and operational accountability.

### In scope

- Work packages and execution records
- Assignment to teams, users, resources, locations, and WBS
- Start, pause, complete, cancel, and rework states
- Actual quantities, dates, evidence, and comments
- Execution constraints, blockers, and dependencies
- Links to BOQ, planning, micro schedule, quality, snag, EHS, labor, and documents
- Operational views, updates, and audit history

### Out of scope

- Master planning ownership
- Progress calculation/reporting ownership where separately implemented
- Quality, snag, EHS, and labor record ownership
- Resource master ownership

## 2. System Position

```text
Planning / Micro Schedule / BOQ / Resources
    -> execution assignment and work record
    -> field update, quantity, evidence, and blocker
    -> progress and quality/EHS inputs
    -> forecast, milestone, dashboard, and audit outcome
```

The document must distinguish planned work, assigned work, started work, completed work, and verified work.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Execution |
| Backend feature | `backend/src/execution/` | Execution controllers, services, DTOs, entities, status, and calculations |
| Web service | `frontend/src/services/execution.service.ts` | Execution requests, mapping, and client state |
| Web routes/views | `frontend/src/App.tsx` and execution/project views | Work lists, assignments, updates, evidence, and operational reporting |
| Mobile features | `flutter/lib/features/` execution/progress/planning areas | Field work updates and evidence where supported |

Exact entity names, endpoint paths, field evidence, and status transitions must be verified before approval.

## 4. Execution Record Model

Identify fields for execution identifier, project/WBS/BOQ/planning/micro-schedule links, work description, location, assigned team/user/resource, planned quantity, actual quantity, unit, planned/actual dates, status, blocker, delay reason, evidence, verification, and audit timestamps.

For every field, state whether it is inherited, entered in the field, calculated, or approved.

## 5. Core User Journeys

### 5.1 Create or assign work

An authorized planner or supervisor creates an execution record or converts a planned task into work, selects location and responsible team, validates scope/resources, and assigns the work.

### 5.2 Start and update work

Field users record start, pause, partial completion, quantity, comments, evidence, blockers, and revised dates. The system preserves prior updates and identifies the current state.

### 5.3 Complete and verify work

Completion may require quantity/evidence, supervisor verification, quality checks, or other gates. Document who can submit, verify, reject, reopen, and mark rework.

### 5.4 Handle blocker or rework

The user records blocker type, owner, impact, and recovery action. Rework should retain the original record and link the corrective execution work rather than erasing history.

## 6. Status and Quantity Rules

Confirm:

- Planned, assigned, started, paused, partially complete, complete, verified, blocked, cancelled, and rework states
- State-transition permissions
- Planned versus actual quantity and units
- Partial completion and overrun behavior
- Work-front/location restrictions
- Start/finish and shift/timezone behavior
- Evidence requirements
- Reopening and correction behavior
- Dependency on quality, snag, EHS, or approval gates

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/get execution records | Execution view | Project, WBS, status, location, dates, pagination | Work records | None |
| To verify | Create/assign work | Execution edit | Work DTO and assignment | Saved work | Assignment and audit |
| To verify | Update status/quantity | Field update | Update DTO and evidence | Updated record | Progress, notification, audit |
| To verify | Complete/verify/reopen | Execution approval | Action, evidence, comments | Updated state | Quality/progress effects |
| To verify | Record blocker/rework | Supervisor/update | Blocker or rework DTO | Linked result | Planning and notification effects |
| To verify | Import/export execution | Administration | File/filters/format | Results/file | Bulk changes and audit |

For each confirmed endpoint, document project scope, state validation, quantity rules, evidence/file behavior, idempotency, and errors.

## 8. Data Model and Relationships

Identify links to Projects, WBS, BOQ, Design revisions, Resources, Planning, Micro Schedule, Progress, Work Documents, Quality, Snag, EHS, Labor, Milestones, Notifications, and Audit.

Historical records must preserve original assignment, planned quantity, actual updates, verification, and the design/BOQ/planning context used at execution time.

## 9. Mobile and Offline Behavior

Confirm whether Flutter supports offline work creation/update, local evidence capture, queued updates, conflict resolution, retry, device timestamps, and access removal. Server-side authorization and validation remain authoritative after synchronization.

## 10. Security, Permissions, and Audit

Confirm separate permissions for viewing, assigning, starting, updating, completing, verifying, reopening, recording rework, importing, exporting, and overriding quantities/status.

Audit assignments, status changes, quantity/date changes, evidence, blockers, rework, verification, reopening, bulk operations, and manual overrides. Protect project/location and worker information by scope.

## 11. Integrations and Consumers

### Upstream dependencies

- Projects, WBS, BOQ, Planning, Micro Schedule, Resources, Design
- Authenticated user and project permissions
- App Config units, statuses, and workflow rules

### Downstream consumers

- Progress and dashboards
- Quality, Snag, EHS, Labor, and Work Documents
- Milestones and Release Strategy
- Notifications, Audit, and reports

## 12. Testing Checklist

- Create and assign valid work
- Reject cross-project or invalid planning/BOQ/resource references
- Enforce state transitions and permissions
- Record partial quantity, evidence, blocker, delay, and rework
- Complete and verify work with required gates
- Prevent duplicate submissions on retry
- Preserve history after correction or reopening
- Update progress and milestone consumers correctly
- Verify offline/mobile queue and conflict behavior
- Protect files and field data
- Record notifications and audit events

## 13. Open Questions for Approval

1. What is the canonical execution record versus Micro Schedule task?
2. Which roles can assign, update, complete, verify, and reopen work?
3. What evidence is required for completion and verification?
4. How are actual quantities calculated and reconciled to BOQ?
5. How are blockers and rework linked to Planning, Quality, Snag, and EHS?
6. Does execution support offline creation and update?
7. How are duplicate/retried updates handled?
8. What state changes affect Progress and Milestones?
9. Which records can be corrected after verification?
10. What execution data is visible to dashboards and reports?

## 14. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/execution/`
- Web service: `frontend/src/services/execution.service.ts`
- Planning reference: `Final Documentation/modules/planning.md`
- Micro Schedule reference: `Final Documentation/modules/micro-schedule.md`
- BOQ reference: `Final Documentation/modules/boq.md`
- Resources reference: `Final Documentation/modules/resources.md`
- Sync reference: `Final Documentation/modules/sync.md`
- Audit reference: `Final Documentation/modules/audit.md`

