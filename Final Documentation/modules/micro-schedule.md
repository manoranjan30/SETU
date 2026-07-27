# Micro Schedule Module

Status: Draft  
Primary wave: B - Project Definition and Planning  
Related modules: Projects, WBS, Planning, BOQ, Resources, Execution, Progress, Labor, Milestones, Notifications, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Micro Schedule module converts the project plan into short-horizon, actionable work commitments for teams working on site. It provides task-level visibility for daily or weekly execution while maintaining a clear relationship to the master Planning schedule.

### In scope

- Short-horizon tasks and work packages
- Daily/weekly planning and commitments
- Task sequencing and dependencies
- Resource, labor, location, and WBS/BOQ assignment
- Planned versus completed work
- Constraints, blockers, reasons for delay, and recovery actions
- Reconciliation with Planning, Execution, Progress, and Milestones

### Out of scope

- Master schedule ownership, which belongs to Planning
- Actual work evidence and completion capture, which belong to Execution/Progress
- Resource master ownership, which belongs to Resources
- Quality, snag, and EHS finding ownership

## 2. System Position

```text
Master plan
    -> short-horizon work package
    -> daily/weekly task commitment
    -> assigned team/resource/location
    -> field update and completion
    -> progress, delay, and forecast feedback to Planning
```

The final document must state whether Micro Schedule tasks are independent records, generated from Planning activities, or both.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Micro Schedule |
| Backend feature | `backend/src/micro-schedule/` | Task controllers, services, DTOs, entities, assignments, and updates |
| Web service | `frontend/src/services/micro-schedule.service.ts` | Micro-schedule API requests and mapping |
| Web views | `frontend/src/App.tsx` and execution/planning views | Task board, list, calendar, daily/weekly views, and updates |
| Mobile feature | `flutter/lib/features/planning/` and execution/progress features | Field task access and updates where supported |

Exact task fields, status values, endpoint paths, and relationship to Planning must be verified before approval.

## 4. Micro-Schedule Model

Identify fields for task identifier/code, name, project, WBS/BOQ/planning activity link, location, date/shift, duration, assigned user/team/resource, planned quantity, target, status, actual quantity, completion evidence, blocker, delay reason, and audit timestamps.

The document must distinguish a commitment, an assignment, an update, and an actual completion record.

## 5. Core User Journeys

### 5.1 Create a short-horizon task

An authorized planner or supervisor selects the project, planning context, WBS/BOQ, location, date, target, and responsible team. The system validates scope, dates, dependencies, resource availability, and duplicate commitments.

### 5.2 Publish a daily/weekly plan

Document review, publication, locking, notification, and change behavior. Teams should know which commitments are active and which are draft.

### 5.3 Update task progress

Users record started, completed, partially completed, blocked, delayed, or cancelled state with quantity/evidence where supported. The system should preserve the original commitment and the reason for variance.

### 5.4 Escalate a blocker

The user records blocker category, owner, due date, impact, and recovery action. The system may create a notification or issue and should identify whether the blocker affects the master schedule.

## 6. Status and Scheduling Rules

Confirm:

- Draft, published, in-progress, completed, blocked, delayed, cancelled, or equivalent states
- Daily/weekly calendar and shift behavior
- Task dependency types and predecessor constraints
- Quantity and completion calculation
- Partial completion and carry-forward
- Late-task and missed-commitment behavior
- Rescheduling and approval requirements
- Repeating/recurring tasks, if supported
- Location, tower, block, and work-front rules

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List tasks | Micro-schedule view | Project, date, status, team, WBS, pagination | Task list/board | None |
| To verify | Create/update task | Micro-schedule edit | Task DTO | Saved task | Audit and assignment impact |
| To verify | Publish plan | Micro-schedule approval | Date range/version | Published tasks | Notifications and audit |
| To verify | Update task status/progress | Field update | Task update DTO | Updated status/quantity | Progress, notification, audit |
| To verify | Record blocker/delay | Supervisor/update | Blocker DTO | Blocker result | Escalation and schedule impact |
| To verify | Reconcile to Planning | Planning integration | Task/activity context | Reconciliation result | Forecast and variance update |

For each confirmed endpoint, document project scope, update ownership, idempotency, bulk behavior, pagination, and error responses.

## 8. Data Model and Relationships

Identify relationships to Projects, WBS nodes, BOQ items, Planning activities, Resources, Labor, Execution, Progress, Milestones, Issues, Notifications, and Audit.

The system should preserve the original planned commitment, each update, actual evidence, and final outcome. Reconciliation should not overwrite the master plan without the appropriate planning workflow.

## 9. Planning Reconciliation

The approved document must explain how Micro Schedule results affect Planning:

- Completed task and actual date
- Remaining quantity/duration
- Missed commitment
- Delay reason and impact
- Forecast movement
- Affected milestone or critical activity
- Recovery or resequencing action

Confirm whether reconciliation is automatic, user-approved, or report-only.

## 10. Security, Notifications, and Audit

Confirm permissions for viewing, creating, assigning, publishing, updating, closing, overriding, and reconciling tasks.

Audit plan publication, assignment changes, status/quantity updates, blockers, delay reasons, overrides, and reconciliation. Notify responsible teams when assignments, dates, blockers, or commitments change.

## 11. Testing Checklist

- Create valid daily/weekly tasks
- Validate project, WBS, BOQ, planning, resource, and location references
- Reject invalid dates, duplicate commitments, and unauthorized assignments
- Publish and lock a plan correctly
- Update partial, complete, blocked, delayed, and cancelled tasks
- Carry forward incomplete work according to policy
- Record blockers and escalation notifications
- Reconcile outcomes with master Planning
- Preserve original commitments and update history
- Verify mobile/offline task behavior where supported
- Enforce project and role permissions
- Record audit and notification events

## 12. Open Questions for Approval

1. What is the exact relationship between Planning activities and Micro Schedule tasks?
2. Are tasks daily, weekly, shift-based, or configurable?
3. Who can create, publish, assign, update, and override tasks?
4. How are quantities and completion percentages calculated?
5. What is the carry-forward policy for incomplete work?
6. How are blockers linked to Issues, Snag, Quality, or EHS?
7. How does a missed commitment affect the master schedule and milestones?
8. What field evidence is required for task completion?
9. Is offline/mobile creation and update supported?
10. Which events trigger notifications and escalation?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/micro-schedule/`
- Web service: `frontend/src/services/micro-schedule.service.ts`
- Planning reference: `Final Documentation/modules/planning.md`
- WBS reference: `Final Documentation/modules/wbs.md`
- BOQ reference: `Final Documentation/modules/boq.md`
- Resources reference: `Final Documentation/modules/resources.md`
- Notification reference: `Final Documentation/modules/notifications.md`
- Audit reference: `Final Documentation/modules/audit.md`

