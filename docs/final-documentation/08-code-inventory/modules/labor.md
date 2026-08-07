# Labor Module

Status: Draft  
Primary wave: C - Execution and Progress  
Related modules: Projects, Users, Resources, Planning, Micro Schedule, Execution, Progress, Cost/Budget, Quality, EHS, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Labor module manages workforce participation and labor-related project records used to plan deployment, capture work contribution, measure productivity, and support project reporting.

### In scope

- Labor categories, crews, contractors, and worker assignments
- Project/WBS/activity deployment
- Daily labor entries, hours, shifts, and attendance where supported
- Labor quantity/productivity references
- Approval, correction, and period close
- Worker safety or compliance references where linked
- Labor cost/reporting inputs

### Out of scope

- User identity master ownership
- Payroll and HR systems unless explicitly integrated
- Resource master ownership outside labor-specific records
- EHS incident ownership
- Execution/progress record ownership

## 2. System Position

```text
Users / labor resources / project plan
    -> crew or worker deployment
    -> daily hours, shifts, and work contribution
    -> approval and productivity measurement
    -> execution, progress, cost, and workforce reporting
```

The document must distinguish a worker identity, a labor resource, a project assignment, and a daily labor entry.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Labor |
| Backend feature | `backend/src/labor/` | Labor controllers, services, DTOs, entities, assignments, and entries |
| Web service | `frontend/src/services/` and labor/execution views | Labor lists, deployment, daily entries, and reporting |
| Web routes/views | `frontend/src/App.tsx` and project views | Workforce and labor screens |
| Mobile feature | `flutter/lib/features/labor/` | Field labor capture and review where supported |

Exact workforce entities, endpoint paths, attendance scope, and cost behavior must be verified before approval.

## 4. Labor Model

Identify fields for worker/crew identifier, user or contractor link, category/trade, project/WBS/activity, shift/date, hours, attendance/status, quantity/work contribution, rate/cost, supervisor, evidence, approval, and timestamps.

For each field, state whether it is imported, user-entered, calculated, inherited, or approved.

## 5. Core User Journeys

### 5.1 Assign workforce

An authorized supervisor or planner assigns workers/crews to a project, location, WBS, activity, or shift. The system validates project access, worker status, duplicate assignments, and capacity.

### 5.2 Record daily labor

The user records date, shift, worker/crew, hours, work context, quantity, remarks, and evidence where required. The system validates date, project scope, hours, and duplicate entries.

### 5.3 Review and approve

A supervisor reviews attendance/hours, assignment, work contribution, exceptions, and evidence, then approves, rejects, or returns the entry for correction.

### 5.4 Correct or close a labor period

Document period cut-off, late entries, correction permissions, approval lock, reopening, and audit behavior.

## 6. Labor and Productivity Rules

Confirm:

- Worker versus crew entry model
- Regular/overtime/shift hours
- Attendance and absence values
- Maximum hours and overlap validation
- Productivity denominator and quantity source
- Labor rate, cost, and currency ownership
- Contractor/subcontractor handling
- Duplicate and correction behavior
- Project/WBS/activity scope
- Treatment of inactive workers or ended assignments

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List workers/crews | Labor view | Project, trade, status, filters | Workforce summaries | None |
| To verify | Assign/deploy labor | Labor edit | Worker/crew, project, WBS/activity, dates | Assignment result | Resource/planning effect and audit |
| To verify | Create/update labor entry | Labor entry | Date, hours, shift, work context, quantity | Saved entry | Progress/cost and audit |
| To verify | Submit/approve/reject | Labor approval | Entry/period, decision, reason | Updated state | Notifications and reporting |
| To verify | Close/reopen period | Labor administration | Period/action/reason | Period status | Locking and audit |
| To verify | Import/export labor | Administration | File/filters/format | Results/file | Bulk changes and audit |

For each confirmed endpoint, document personal-data scope, project authorization, hour/quantity rules, period locks, pagination, and errors.

## 8. Data Model and Relationships

Identify relationships to Users, Resources, Projects, WBS, Planning, Micro Schedule, Execution, Progress, Cost/Budget, Quality, EHS, Notifications, and Audit.

Historical labor entries must preserve worker/crew, assignment, date/shift, hours, work context, approval state, and correction history.

## 9. Privacy and Security

- Limit worker personal data to authorized roles and project scope.
- Protect contractor, attendance, rate, and cost information.
- Prevent users from submitting entries for unauthorized workers/projects.
- Validate hours, dates, shifts, and assignments server-side.
- Audit deployment, rate, hour, approval, correction, and period changes.
- Define retention and deletion rules for personal and labor records.
- Ensure offline device data is protected and cleared on sign-out/access removal.

## 10. Mobile and Offline Behavior

Confirm Flutter support for offline worker/crew lookup, daily-entry creation, local evidence, queued submission, duplicate prevention, conflict handling, period locks, and access changes.

## 11. Integrations and Consumers

### Upstream dependencies

- Users, Resources, Projects, WBS, Planning, Micro Schedule
- App Config shifts, units, calendars, and rates
- Authenticated user and project permissions

### Downstream consumers

- Execution and Progress
- Productivity and cost reporting
- Quality and EHS workforce checks
- Dashboards, Notifications, and Audit

## 12. Testing Checklist

- Assign valid workers/crews to project work
- Reject invalid, duplicate, overlapping, or unauthorized assignments
- Record regular, overtime, shift, absent, and exception entries
- Validate hours, quantities, dates, and project/WBS/activity links
- Submit, approve, reject, correct, close, and reopen periods
- Calculate productivity and cost outputs correctly
- Protect personal and rate data
- Verify mobile/offline queue, retries, and conflicts
- Preserve history after worker deactivation or assignment end
- Record notifications and audit events

## 13. Open Questions for Approval

1. Which labor categories and workforce types are supported?
2. Are workers sourced from Users, Resources, an HR system, or all three?
3. Is attendance part of Labor or a separate module?
4. Are entries worker-based, crew-based, or both?
5. How are overtime, shifts, breaks, and overlapping hours handled?
6. Who owns labor rates and cost calculations?
7. How is productivity calculated and connected to Progress?
8. Which users can approve, correct, close, and reopen labor periods?
9. What personal data is retained and for how long?
10. Is offline/mobile labor capture supported?

## 14. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/labor/`
- Mobile feature: `flutter/lib/features/labor/`
- Users reference: `Final Documentation/modules/users.md`
- Resources reference: `Final Documentation/modules/resources.md`
- Execution reference: `Final Documentation/modules/execution.md`
- Progress reference: `Final Documentation/modules/progress.md`
- Sync reference: `Final Documentation/modules/sync.md`
- Audit reference: `Final Documentation/modules/audit.md`

