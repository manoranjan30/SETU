# Quality Approval UX and Reporting Plan

Date: 2026-04-25
Scope: Quality module > QA/QC Approvals, Release Strategy alignment, permission-driven visibility, reporting
Primary users: QA/QC Engineer, Site Engineer, Project Manager, Admin

## Objective

Improve the Quality approval experience so that users can clearly understand:

- what is pending
- what is partially approved
- whose turn it is to act
- why an action is blocked
- how to find pending/completed RFIs quickly
- how to download clean, meeting-ready reports by tower, floor, GO, and other useful slices

This plan also aligns Release Strategy configuration with real approval execution, improves permission-driven UI hiding, and strengthens QA/QC operational reporting without breaking the current API contract used by web and mobile clients.

## Current Baseline

The current system already has useful building blocks:

- QA/QC approvals page:
  - `frontend/src/views/quality/QualityApprovalsPage.tsx`
- Quality project dashboard:
  - `frontend/src/views/quality/QualityProjectDashboard.tsx`
- Approval workflow runtime:
  - `backend/src/quality/inspection-workflow.service.ts`
- Inspection list/detail and workflow summary:
  - `backend/src/quality/quality-inspection.service.ts`
- Release Strategy configuration:
  - Planning module UI and backend services
- Permission-aware navigation:
  - `frontend/src/context/AuthContext.tsx`
  - menu and tab configs across frontend

Recent improvements already in place:

- `PARTIALLY_APPROVED` can now be treated as pending in the QA/QC approvals worklist
- the QA/QC approvals worklist now supports better filtering, sorting, and CSV report download
- role/menu visibility has started moving toward stricter permission-based behavior

## Current Pain Points

From the recent QA/QC workflow review, the main operator pain points are:

1. Users cannot always tell whether an RFI is actionable right now.
2. A user assigned in Release Strategy may still not understand why approval is blocked.
3. The screen does not always clearly distinguish:
   - pending now
   - partially approved
   - waiting for previous level
   - fully approved
   - rejected
4. Button disable states are not always self-explanatory.
5. Users need stronger list filtering and reporting by:
   - block
   - tower
   - floor
   - GO
   - status
   - approval level
   - pending/completed
6. Managers need clean downloadable summaries instead of manually reading the live queue.
7. Permission-driven hiding still needs deeper cleanup so the product feels role-specific and professional.

## Target Product Behavior

1. The QA/QC approvals worklist behaves like a true operator queue.
2. `PARTIALLY_APPROVED` items remain visible in pending work until the workflow is actually complete.
3. Every RFI clearly shows:
   - current approval state
   - current active level
   - completed levels
   - next actor or pending actor
   - reason an action is blocked
4. A user assigned to a future level can see they are assigned, but also clearly see that it is not their turn yet.
5. List filtering supports fast operational drilldown by tower/floor/GO and related dimensions.
6. Sorting helps users quickly find:
   - oldest pending
   - highest-risk pending
   - level-wise pending
   - completed items
7. Users can export readable tabular reports for site follow-up and review meetings.
8. Menu tabs and action controls that a user cannot access are hidden or clearly explained.
9. Admin always retains full visibility and full access.

## Recommended Delivery Waves

## Wave 1: QA/QC Approval Clarity

### Goal

Make the QA/QC approvals screen immediately understandable for operational users.

### Frontend scope

- Improve RFI state labeling in `QualityApprovalsPage.tsx`
- Add clearer visual distinctions for:
  - pending
  - partially approved
  - waiting for previous level
  - approved
  - rejected
  - reversed
- Add explicit action-state helper text near approve controls:
  - checklist incomplete
  - observations open
  - waiting on previous level
  - missing permission
  - delegated elsewhere
- Improve workflow strip wording so the active level is obvious
- Add “assigned to you”, “assigned later”, and “not assigned to you” cues where useful

### Backend scope

- Review workflow summary payload returned by:
  - inspection list
  - inspection detail
  - workflow endpoint
- Ensure the frontend can reliably know:
  - current active level
  - whether this user is eligible now
  - whether this user is assigned only at a later level
  - current approval counts vs minimum required

### Deliverables

- clearer badges and helper states in QA/QC approvals
- less confusion around disabled approval actions
- more trustworthy list state

### Exit criteria

- A Site Engineer can tell in one glance whether the current RFI is actionable
- Partial approvals remain visible in pending work
- The system no longer appears inconsistent when a user is assigned at a future level

## Wave 2: Release Strategy and Live Workflow Alignment

### Goal

Make configured approval levels and runtime approval execution tell the same story.

### Frontend scope

- Improve Release Strategy simulation/readout so it mirrors runtime approval behavior
- Show resolved approvers clearly by level
- Show active level vs future levels in QA/QC detail
- Add a compact per-level summary:
  - waiting
  - active
  - approved
  - delegated
  - blocked

### Backend scope

- Normalize approval resolution logic so simulation and runtime use the same actor-resolution rules
- Expose richer workflow summary where needed:
  - assigned actor type
  - resolved actor names
  - completed user approvals
  - delegation state

### Deliverables

- better alignment between Planning > Release Strategy and Quality > QA/QC Approvals
- fewer “configured but not working” misunderstandings

### Exit criteria

- The live QA/QC screen and Release Strategy simulation show the same approver outcome
- A user assigned to Level 2 clearly sees that Level 1 must finish before their approval can activate

## Wave 3: Permission-Driven UX Cleanup

### Goal

Make the product feel role-specific and clean by hiding irrelevant menus, tabs, and actions.

### Frontend scope

- Review Quality module tabs and sub-tabs for permission gating
- Hide non-usable tabs instead of showing dead ends
- Hide action buttons the user cannot use due to missing permission
- Keep workflow-state-based buttons visible when explanation is valuable, but add reason text
- Extend the same logic to:
  - Planning
  - Admin
  - project-level side navigation

### Backend scope

- Keep permission APIs stable
- Ensure Admin bypass remains intact
- Ensure exact-match permission logic is consistent with route guards and nav hiding

### Deliverables

- professional, role-aware menus and actions
- less clutter for non-admin users

### Exit criteria

- A non-admin user sees only the modules and tabs they are meant to use
- Admin still sees everything
- There are no obvious empty tabs or dead-end action surfaces

## Wave 4: QA/QC Reporting Suite

### Goal

Provide clean operational and management reporting without forcing spreadsheet cleanup.

### Core reports

1. Pending vs Completed by Block / Tower / Floor
2. Partial Approval Tracker
3. Approval Level Pending Summary
4. Open Observation Ageing
5. Rejected / Rework Summary
6. Approver Bottleneck Summary
7. Contractor / Vendor-wise QA performance summary

### Frontend scope

- Extend current CSV export into more structured export options
- Add report presets inside QA/QC approvals dashboard
- Add date-range and scope filters where useful
- Add simple report table views before export so users can preview what they are downloading

### Backend scope

- If current client-side shaping becomes too heavy, add dedicated report endpoints
- Add aggregation helpers for:
  - tower/floor summaries
  - ageing buckets
  - approval-level pending counts

### Deliverables

- downloadable QA/QC operational reports
- tabular summary exports with readable columns
- better management visibility of site quality status

### Exit criteria

- PM/QC users can download a clean report and use it directly in review meetings
- Report counts reconcile with live queue counts for the same filters

## Wave 5: Stage Approval Workflow Polish

### Goal

Make stage-wise approval progress easier to understand and audit.

### Scope

- Clarify stage-level progress in checklist execution
- Show stage-wise history timeline
- Improve visibility of:
  - delegated steps
  - reversed approvals
  - pending final approval
  - blocked stages due to open observations
- Show remaining approval levels after each stage completion

### Deliverables

- stronger traceability for stage approvals
- more readable stage progression

### Exit criteria

- Users can understand exactly what happened at each stage and what is left

## Wave 6: Import and Master Data Reliability

### Goal

Reduce quality-workflow friction caused by bad upstream data.

### Scope

- EPS import validation feedback
- better “success with warnings” behavior
- downloadable import error details
- stronger tower/floor/GO consistency checks in imported master data
- guardrails where missing location hierarchy weakens QA/QC reporting and approvals

### Deliverables

- more reliable source data for approvals and reporting

### Exit criteria

- Import success corresponds to usable downstream data
- Data quality problems surface early and clearly

## Wave 7: Mobile and API Stability Pass

### Goal

Keep Flutter/mobile usage safe while QA/QC UX evolves.

### Scope

- Maintain backend route and payload compatibility
- Ensure approval endpoints remain stable
- Review user payload size and token size concerns
- Test approval-state data on slower/mobile workflows
- Confirm menu/report changes do not assume web-only capabilities in shared API models

### Deliverables

- stable API contract for mobile clients
- safer long-term foundation for QA/QC enhancements

### Exit criteria

- Web UX improvements do not break Flutter API usage
- Approval and reporting data remain consumable across clients

## Suggested Execution Order

1. Wave 1: QA/QC Approval Clarity
2. Wave 2: Release Strategy and Live Workflow Alignment
3. Wave 3: Permission-Driven UX Cleanup
4. Wave 4: QA/QC Reporting Suite
5. Wave 5: Stage Approval Workflow Polish
6. Wave 6: Import and Master Data Reliability
7. Wave 7: Mobile and API Stability Pass

## Parallelization Guidance

Can run in parallel after Wave 2 stabilizes:

- Wave 3 permission-driven cleanup
- Wave 4 reporting suite
- Wave 6 import/master-data reliability

Should remain serial:

- Wave 1 before Wave 2, because the UI needs immediate clarity first
- Wave 2 before deeper workflow polish, because live/runtime alignment must be trustworthy before polishing surface behavior

## Immediate Next Sprint Recommendation

The most effective next sprint is:

1. clearer approval state messaging in QA/QC approvals
2. explicit active-level vs future-level rendering
3. disabled-button reason states
4. stronger tower/floor-wise report downloads
5. quality tab/button visibility cleanup based on role permissions

## Key Files Likely To Be Touched

Frontend:

- `frontend/src/views/quality/QualityApprovalsPage.tsx`
- `frontend/src/views/quality/QualityProjectDashboard.tsx`
- `frontend/src/views/quality/subviews/QualityInspection.tsx`
- `frontend/src/context/AuthContext.tsx`
- menu and route guard configuration files

Backend:

- `backend/src/quality/quality-inspection.service.ts`
- `backend/src/quality/inspection-workflow.service.ts`
- release strategy related backend services/controllers
- possible reporting aggregation endpoints if client-side shaping becomes insufficient

## Risks and Guardrails

### Risks

- UI may become over-complicated if we add too many states without hierarchy
- Release Strategy simulation and runtime logic can drift if not derived from the same rules
- Permission hiding can become inconsistent if menu logic and route guards diverge
- Reporting can become slow if too much aggregation is done naively on the client for large projects

### Guardrails

- Keep QA/QC approvals screen minimal and task-first
- Use shared workflow-summary semantics for both simulation and runtime display
- Keep Admin as full-access, locked behavior
- Prefer exact permission logic with explicit exceptions only where intentional
- Add reporting endpoints if large project performance degrades

## Acceptance Standard For This Initiative

This initiative is successful when:

- QA/QC users can immediately identify actionable pending work
- partially approved items stay visible until truly completed
- assigned approvers understand whether it is their turn now or later
- reports can be downloaded and read without manual cleanup
- non-admin roles see cleaner, more focused UI surfaces
- Admin retains complete access
- Flutter/mobile API compatibility remains intact

---

Owner: Quality / Workflow / Product Engineering
Environment: Web + API, with mobile compatibility protection
Related documents:

- `MATERIAL_ITP_MODULE_IMPLEMENTATION_PLAN.md`
- `SETU_STAGING_DEPLOYMENT_PLAN.md`
- permission strategy and quality workflow planning docs already under `.module_Plans/`
