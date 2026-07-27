# Milestones Module

Status: Draft  
Primary wave: B - Project Definition and Planning  
Related modules: Projects, WBS, Planning, Micro Schedule, Execution, Progress, Customer Milestones, Notifications, Dashboard, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Milestones module manages significant project dates and completion gates used to govern delivery, communicate commitments, and measure schedule performance.

### In scope

- Internal and external milestone records
- Planned, baseline, actual, and forecast dates
- Milestone type, owner, dependencies, and project/WBS context
- Completion criteria and evidence
- Approval, sign-off, and status
- Variance, delay reason, and recovery action
- Notifications, dashboards, and milestone reporting

### Out of scope

- Detailed activity scheduling, which belongs to Planning
- Daily task commitments, which belong to Micro Schedule
- Customer-facing contractual milestone behavior if separately owned by Customer Milestones
- Actual construction evidence ownership, which belongs to Execution/Progress

## 2. System Position

```text
Project/WBS/Planning
    -> milestone commitment and baseline
    -> activity/task progress and forecast
    -> milestone completion/evidence
    -> variance, notifications, dashboards, and governance
```

The document must distinguish planned, baseline, forecast, actual, and approved completion dates.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Milestone capability |
| Backend feature | `backend/src/milestone/` | Milestone controllers, services, DTOs, entities, dates, and workflow |
| Web service | `frontend/src/services/customerMilestone.service.ts` and related services | Milestone queries, updates, dashboards, or customer-facing mapping |
| Web routes/views | `frontend/src/App.tsx` and planning/dashboard views | Milestone lists, timelines, approvals, and reports |
| Mobile consumer | Flutter planning, progress, project, and dashboard features | Milestone visibility/update where supported |

Exact distinction between internal milestones and customer milestones, endpoint paths, and evidence rules must be verified before approval.

## 4. Milestone Model

Identify fields for milestone identifier, project/WBS/planning context, name, type, owner, responsible team, baseline date, planned date, forecast date, actual date, status, dependency, completion criteria, evidence, delay reason, approval, and audit timestamps.

For each field, state whether it is calculated, user-entered, inherited, or controlled by workflow.

## 5. Core User Journeys

### 5.1 Create a milestone

An authorized planner or project manager selects the project, milestone type, date, owner, dependencies, and completion criteria. The system validates scope and date relationships and records the action.

### 5.2 Baseline or approve a milestone

Document who can commit or approve a milestone, what becomes locked, how revisions are handled, and how changes are communicated.

### 5.3 Update forecast and completion

Planning or field users update the forecast based on activity/task results. Completion should require the defined evidence or approval, not only a manually selected status.

### 5.4 Handle a delayed milestone

The user records the delay reason, impact, responsible owner, new forecast, recovery action, and affected milestones or project commitments. Notifications and audit behavior must be explicit.

## 6. Status and Date Rules

Confirm:

- Draft, planned, committed, at-risk, delayed, achieved, cancelled, or equivalent states
- Date precedence and calculation rules
- Dependency and predecessor behavior
- Tolerance/early-warning thresholds
- Completion evidence and approval requirements
- Reopening or reversing achievement
- Future-dated milestones
- Customer/contractual versus internal milestones

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/get milestones | Milestone view | Project, type, status, date filters | Milestone data | None |
| To verify | Create/update milestone | Milestone edit | Milestone DTO | Saved milestone | Audit and notifications |
| To verify | Baseline/commit milestone | Planning approval | Milestone/version/action | Committed milestone | Baseline and audit |
| To verify | Update forecast/status | Milestone update | Date/status/reason/evidence | Updated milestone | Variance and notification |
| To verify | Complete/approve milestone | Milestone approval | Evidence/comments | Completed result | Audit and downstream reporting |

For each confirmed endpoint, document project scope, date validation, evidence requirements, permissions, idempotency, and errors.

## 8. Data Model and Relationships

Identify links to Projects, WBS, Planning activities, Micro Schedule tasks, Execution, Progress, Customer Milestones, Notifications, Dashboards, and Audit.

Historical reports must preserve baseline and prior forecast dates. A milestone’s actual achievement should not rewrite the original commitment.

## 9. Notifications and Reporting

Define triggers for:

- Upcoming milestone
- At-risk threshold
- Forecast movement
- Delay
- Achievement
- Rejection or reopened milestone
- Customer/contractual commitment risk

Document recipients, escalation levels, dashboard indicators, and whether notifications are mandatory or preference-controlled.

## 10. Security, Permissions, and Audit

Confirm separate permissions for viewing, creating, editing dates, committing/baselining, updating forecasts, completing, approving, reopening, and exporting.

Audit creation, date changes, baseline/commitment, forecast movement, delay reason, evidence, completion, approval, reopening, and bulk updates. Protect customer/contractual dates and project scope.

## 11. Testing Checklist

- Create milestones with valid project and planning context
- Reject invalid dates, dependencies, and unauthorized owners
- Baseline and revise milestones according to policy
- Calculate at-risk/delay thresholds correctly
- Update forecast without changing historical baseline
- Complete only with required evidence/approval
- Reopen or cancel according to permissions
- Trigger correct notifications and dashboard states
- Preserve customer/internal distinction
- Enforce project isolation
- Record audit events and history
- Verify web/mobile visibility where supported

## 12. Open Questions for Approval

1. What milestone types are supported?
2. Which milestones are customer-facing or contractual?
3. Are dates entered manually, calculated from Planning, or both?
4. What constitutes at-risk and delayed status?
5. What evidence and approval are required for completion?
6. Who can baseline, forecast, complete, and reopen milestones?
7. How do milestones relate to Customer Milestones?
8. Which events trigger escalation notifications?
9. How are milestone changes reflected in executive dashboards?
10. What milestone behavior is available offline in Flutter?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/milestone/`
- Web service relationship: `frontend/src/services/customerMilestone.service.ts`
- Planning reference: `Final Documentation/modules/planning.md`
- Micro Schedule reference: `Final Documentation/modules/micro-schedule.md`
- Project reference: `Final Documentation/modules/projects.md`
- Notification reference: `Final Documentation/modules/notifications.md`
- Audit reference: `Final Documentation/modules/audit.md`

