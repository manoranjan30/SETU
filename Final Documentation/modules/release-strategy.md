# Release Strategy Module

Status: Draft  
Primary wave: B - Project Definition and Planning  
Related modules: Projects, WBS, Planning, Micro Schedule, Milestones, Execution, Quality, Snag, Work Documents, Notifications, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Release Strategy module manages how completed project scope is grouped, validated, approved, and released for the next operational, customer, or handover stage. It provides a controlled bridge between construction completion and release readiness.

### In scope

- Release phases, packages, areas, towers, blocks, or units
- Release criteria and readiness gates
- Planned, forecast, and actual release dates
- Dependency on execution, quality, snags, EHS, documents, and approvals
- Release checklist, evidence, sign-off, and rejection
- Release status, blockers, exceptions, and rework
- Notifications, handover reporting, and audit history

### Out of scope

- Detailed planning and activity scheduling, which belong to Planning/Micro Schedule
- Quality and snag record ownership
- Customer milestone ownership if separately implemented
- Contract, legal, or financial handover processes unless explicitly represented here

## 2. System Position

```text
Project/WBS/Planning
    -> release package and readiness criteria
    -> execution, quality, snag, EHS, and document checks
    -> review and sign-off
    -> release/handover status
    -> customer, operations, and reporting workflows
```

The document must make clear whether a release is a physical area handover, a customer milestone, an internal stage gate, or a combination.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers release-strategy capability |
| Backend feature | `backend/src/` release-strategy files | Release entities, checklist, workflow, and readiness logic |
| Web service | `frontend/src/services/releaseStrategy.service.ts` | Release requests, mapping, and status handling |
| Web routes/views | `frontend/src/App.tsx` and planning/execution views | Release lists, package detail, checklist, approvals, and reporting |
| Mobile consumer | Flutter projects, execution, quality, snag, and progress features | Field readiness/release access where supported |

Exact backend directory, entity names, route paths, checklist configuration, and customer-facing behavior must be verified before approval.

## 4. Release Model

Identify fields for release identifier, project, area/tower/block/unit, WBS context, package type, owner, planned/forecast/actual dates, status, readiness score, checklist, dependencies, exceptions, evidence, approvers, handover recipient, and audit timestamps.

The document must distinguish a release package from the records that prove its readiness.

## 5. Core User Journeys

### 5.1 Create a release package

An authorized project user defines the area/scope, release type, planned date, owner, criteria, dependencies, and expected evidence. The system validates project scope and duplicate packages.

### 5.2 Prepare for release

Responsible teams complete checklist items and attach evidence. The system identifies incomplete, failed, expired, or blocked criteria and calculates readiness according to the implemented rules.

### 5.3 Review and approve

Reviewers inspect the package, linked records, evidence, exceptions, and open snags/issues. They approve, reject, defer, or approve with exception according to policy.

### 5.4 Release or hand over

Once approval gates pass, the release is marked released/handed over. The system records actual date, recipient, conditions, outstanding obligations, notifications, and downstream status effects.

### 5.5 Reopen or revoke

Document when a released package can be reopened, who can do so, what happens to downstream commitments, and how the reversal is audited.

## 6. Readiness and Gate Rules

Confirm:

- Required checklist items and weighting
- Mandatory versus advisory criteria
- Quality inspection and snag thresholds
- EHS and safety prerequisites
- Document/drawing/as-built requirements
- Testing, commissioning, and approval dependencies
- Exception/waiver authority
- Expiry of evidence
- Partial release or phased release
- Rejection, rework, and reinspection behavior

Readiness indicators must not be treated as approval unless the workflow explicitly grants that meaning.

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/get releases | Release view | Project, area, status, dates, pagination | Release packages | None |
| To verify | Create/update release | Release edit | Release DTO | Saved package | Audit and assignment effects |
| To verify | Update checklist/evidence | Release preparation | Item/evidence DTO | Updated readiness | Notifications and audit |
| To verify | Submit for approval | Release workflow | Release/comments | Submitted result | Reviewer notification |
| To verify | Approve/reject/exception | Release approval | Decision, reason, conditions | Updated status | Audit and downstream status |
| To verify | Release/handover | Release approval | Date, recipient, evidence | Released result | Milestone, notification, and audit |

For each confirmed endpoint, document project scope, readiness validation, exception rules, file behavior, permissions, and error responses.

## 8. Data Model and Relationships

Identify links to Projects, WBS, Planning, Micro Schedule, Milestones, Execution, Quality, Snag, EHS, Work Documents, Customer Milestones, Notifications, and Audit.

Historical release records must preserve the checklist version, evidence, approvals, exceptions, and exact scope released. Later changes to linked records should not erase the release history.

## 9. Security, Permissions, and Audit

Confirm separate permissions for creating packages, editing scope, completing checklist items, attaching evidence, submitting, approving, granting exceptions, releasing, reopening, and exporting.

Audit scope changes, checklist changes, evidence, failed/approved/rejected criteria, exceptions, approvals, release dates, recipients, reopening, and bulk changes. Protect customer and operational handover data by project scope.

## 10. Notifications and Reporting

Define notifications for package creation, assignment, missing criteria, approaching date, at-risk readiness, rejection, approval, exception, release, and reopening. Document recipients, escalation, dashboard indicators, and customer/operations visibility.

## 11. Testing Checklist

- Create valid release packages and scope
- Reject duplicate or cross-project scope
- Complete checklist items and attach valid evidence
- Calculate readiness and mandatory-gate behavior
- Block approval when required criteria fail
- Approve, reject, defer, and approve with exception
- Release and record recipient/date/conditions
- Reopen/revoke according to permission
- Preserve evidence and historical checklist state
- Verify quality, snag, EHS, document, and milestone dependencies
- Trigger correct notifications and audit events
- Verify mobile/field behavior where supported

## 12. Open Questions for Approval

1. What does a release represent: area, unit, tower, phase, package, or handover stage?
2. Which readiness criteria are mandatory?
3. Who owns checklist configuration and approval authority?
4. How are quality, snags, EHS, and documents gated?
5. Are exceptions/waivers supported, and who can grant them?
6. Can releases be partial, phased, or approved conditionally?
7. How does release status relate to Customer Milestones?
8. What evidence is required and how long is it retained?
9. Can an approved release be reopened or revoked?
10. Which events notify customers, operations, or executives?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: release-strategy files under `backend/src/` (exact location to verify)
- Web service: `frontend/src/services/releaseStrategy.service.ts`
- Project reference: `Final Documentation/modules/projects.md`
- Planning reference: `Final Documentation/modules/planning.md`
- Milestones reference: `Final Documentation/modules/milestones.md`
- Quality/Snag/EHS references: planned Wave D documents
- Notification reference: `Final Documentation/modules/notifications.md`
- Audit reference: `Final Documentation/modules/audit.md`

