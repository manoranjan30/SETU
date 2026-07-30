# Quality Snag / Desnag Implementation Plan

## Objective

Build a configurable snag/desnag workflow under the Quality module where each project can define multiple sequential snag process steps, map activities and common snag points to each step, execute unit-level snagging/desnagging, and unlock the next process only after the previous process is fully approved.

## Implementation Status

Implemented in this pass:

- Quality > Configuration > Floor and Unit Structure.
- Quality > Configuration > Snag / Desnag Process.
- Backend snag/desnag configuration tables.
- Backend APIs for process steps, activity mapping, drag/drop move targets, and common points.
- Existing snag execution now reads configured process count instead of hardcoding exactly 3 cycles.
- New snag lists are seeded with configured common snag points.

Existing release strategy process retained for compatibility:

- `moduleCode`: `QUALITY`
- `processCode`: `SNAG_RELEASE_APPROVAL`
- `documentType`: `SNAG_ROUND_RELEASE`

The older release process is the active implementation for desnag release approval. A later migration can alias or rename it to `SNAG_DESNAG` if required, but changing the process code now would risk existing strategy records.

## Navigation

Quality top tabs:

- Add `Configuration`.
- Move existing structure setup inside `Configuration`.
- Rename existing structure setup to `Floor and Unit Structure`.
- Add future configuration pages under the same menu:
  - `Snag / Desnag Process`
  - `Snag Activity Mapping`
  - `Common Snag Points`

Operational menu:

- Keep existing `Snag List` / snagging page as the execution screen.
- Fine tune it to display project-configured snag process steps.

## Configuration Model

### 1. Snag Process Step

Purpose: Define the number and order of snag/desnag cycles for a project.

Recommended table: `quality_snag_process_steps`

Fields:

- `id`
- `projectId`
- `name`
- `description`
- `workflowSerialNo`
- `isActive`
- `createdAt`
- `updatedAt`

Rules:

- `workflowSerialNo` must be unique per project.
- Only step `1` is open at project/unit start.
- Step `N + 1` opens for a unit only after step `N` is fully desnag approved.
- Admin/configurator can reorder steps, but only if no active unit workflow would be corrupted.

### 2. Snag Process Activity Mapping

Purpose: Define which activities are covered under each snag/desnag process.

Recommended table: `quality_snag_process_activities`

Fields:

- `id`
- `projectId`
- `processStepId`
- `activityId`
- `sortOrder`
- `isActive`

Rules:

- Activities are drag-and-drop between process steps.
- When an activity is moved to another process step, all child common snag points move with it.
- Same activity should not appear twice in the same project snag configuration unless explicitly allowed later.

### 3. Common Snag Points

Purpose: Store predefined snag points for each configured activity.

Recommended table: `quality_snag_common_points`

Fields:

- `id`
- `projectId`
- `processActivityId`
- `activityId`
- `title`
- `description`
- `severity`
- `requiresEvidence`
- `sortOrder`
- `isActive`

Rules:

- Users can select predefined points while raising actual snags.
- Users can also create custom snag points during execution.
- Evidence can be optional or mandatory based on `requiresEvidence`.

## Execution Model

### 1. Unit Process Instance

Purpose: Track each unit through each snag process step.

Recommended table: `quality_snag_unit_processes`

Fields:

- `id`
- `projectId`
- `processStepId`
- `workflowSerialNo`
- `blockId`
- `towerId`
- `floorId`
- `unitId`
- `status`
- `readyForSnaggingAt`
- `readyForSnaggingByUserId`
- `snagSubmittedAt`
- `snagSubmittedByUserId`
- `desnagReadyAt`
- `desnagReadyByUserId`
- `desnagApprovedAt`
- `desnagApprovedByUserId`
- `desnagRejectedAt`
- `desnagRejectedByUserId`
- `createdAt`
- `updatedAt`

Statuses:

- `LOCKED`
- `NOT_READY`
- `READY_FOR_SNAGGING`
- `SNAGGING_IN_PROGRESS`
- `SNAGGED`
- `RECTIFICATION_IN_PROGRESS`
- `DESNAG_READY`
- `DESNAG_APPROVED`
- `DESNAG_REJECTED`
- `COMPLETE`

Rules:

- Step 1 unit process starts as `NOT_READY`.
- Step 2+ unit processes start as `LOCKED`.
- `Mark Unit Ready for Snagging` changes `NOT_READY` to `READY_FOR_SNAGGING`.
- Once a unit has snag points, status becomes `SNAGGING_IN_PROGRESS` or `SNAGGED`.
- Once all snag points are rectified, enable `Mark Desnag Ready`.
- Desnag approver can approve all rectified points or mark individual points as not satisfied.
- If any point is not satisfied, unit returns to `RECTIFICATION_IN_PROGRESS`.
- If all points are approved/desnagged, unit process becomes `COMPLETE`.
- Completing step `N` unlocks step `N + 1` for that same unit.
- If final configured process step is complete, unit appears in `Full and Final Approved`.

### 2. Actual Snag Point

Recommended table: `quality_snag_points`

Fields:

- `id`
- `projectId`
- `unitProcessId`
- `processStepId`
- `blockId`
- `towerId`
- `floorId`
- `unitId`
- `roomId`
- `activityId`
- `commonPointId`
- `title`
- `description`
- `severity`
- `status`
- `raisedByUserId`
- `raisedAt`
- `rectifiedByUserId`
- `rectifiedAt`
- `desnaggedByUserId`
- `desnaggedAt`
- `notSatisfiedByUserId`
- `notSatisfiedAt`
- `notSatisfiedRemarks`
- `createdAt`
- `updatedAt`

Statuses:

- `OPEN`
- `RECTIFICATION_PENDING`
- `RECTIFIED`
- `DESNAGGED`
- `NOT_SATISFIED`
- `CANCELLED`

Rules:

- Snag point can be created from predefined common point or custom text.
- Activity can be selected from configured activity list for the current process step.
- `Others` activity option must be supported for custom/non-mapped snags.
- Evidence can be optional unless configured point requires evidence.
- If a `DESNAGGED` point is later reversed/not satisfied, unit goes back to rectification flow.

### 3. Evidence

Recommended table: `quality_snag_point_evidence`

Fields:

- `id`
- `snagPointId`
- `fileUrl`
- `fileName`
- `fileType`
- `evidenceStage`
- `uploadedByUserId`
- `uploadedAt`

Evidence stages:

- `RAISED`
- `RECTIFIED`
- `DESNAG_REVIEW`

## Release Strategy

Add Quality release strategy process:

- `moduleCode`: `QUALITY`
- `processCode`: `SNAG_DESNAG`

Recommended document types:

- `SNAG_READY`
- `SNAG_POINT_RAISE`
- `SNAG_RECTIFICATION`
- `DESNAG_READY`
- `DESNAG_APPROVAL`
- `FINAL_SNAG_APPROVAL`

Practical starting point:

- Use release strategy for `SNAG_READY` notification/approval if required by project.
- Use release strategy for `DESNAG_APPROVAL` as mandatory.
- Use project role/user resolution so only assigned desnag approvers can approve or reject desnag.

## Permissions

Add permissions:

- `QUALITY.SNAG_CONFIG.READ`
- `QUALITY.SNAG_CONFIG.MANAGE`
- `QUALITY.SNAG_READY.MARK`
- `QUALITY.SNAG_POINT.READ`
- `QUALITY.SNAG_POINT.RAISE`
- `QUALITY.SNAG_POINT.UPDATE`
- `QUALITY.SNAG_POINT.RECTIFY`
- `QUALITY.DESNAG_READY.MARK`
- `QUALITY.DESNAG.APPROVE`
- `QUALITY.DESNAG.REJECT`
- `QUALITY.SNAG_FINAL_APPROVAL.READ`

Suggested role behavior:

- Vendor/site execution user: raise snag points, rectify points, mark desnag ready if assigned.
- QA/QC user: mark ready for snagging, raise snag points, approve/reject desnag based on release strategy.
- Admin: manage configuration and override approvals.

## API Plan

Configuration APIs:

- `GET /quality/projects/:projectId/snag-config/process-steps`
- `POST /quality/projects/:projectId/snag-config/process-steps`
- `PATCH /quality/snag-config/process-steps/:stepId`
- `DELETE /quality/snag-config/process-steps/:stepId`
- `PATCH /quality/projects/:projectId/snag-config/process-steps/reorder`
- `GET /quality/projects/:projectId/snag-config/activity-map`
- `POST /quality/projects/:projectId/snag-config/activity-map`
- `PATCH /quality/projects/:projectId/snag-config/activity-map/reorder`
- `PATCH /quality/snag-config/activity-map/:mappingId/move`
- `GET /quality/snag-config/activity-map/:mappingId/common-points`
- `POST /quality/snag-config/activity-map/:mappingId/common-points`
- `PATCH /quality/snag-config/common-points/:pointId`
- `DELETE /quality/snag-config/common-points/:pointId`

Execution APIs:

- `GET /quality/projects/:projectId/snags/process-steps`
- `GET /quality/projects/:projectId/snags/process-steps/:stepId/blocks`
- `GET /quality/projects/:projectId/snags/process-steps/:stepId/towers?blockId=:blockId`
- `GET /quality/projects/:projectId/snags/process-steps/:stepId/floors?towerId=:towerId`
- `GET /quality/projects/:projectId/snags/process-steps/:stepId/units?floorId=:floorId`
- `GET /quality/snags/unit-processes/:unitProcessId`
- `POST /quality/snags/unit-processes/:unitProcessId/ready-for-snagging`
- `POST /quality/snags/unit-processes/:unitProcessId/points`
- `PATCH /quality/snags/points/:pointId`
- `POST /quality/snags/points/:pointId/evidence`
- `POST /quality/snags/points/:pointId/rectify`
- `POST /quality/snags/unit-processes/:unitProcessId/desnag-ready`
- `POST /quality/snags/points/:pointId/desnag-approve`
- `POST /quality/snags/points/:pointId/not-satisfied`
- `POST /quality/snags/unit-processes/:unitProcessId/desnag-approve-all`
- `GET /quality/projects/:projectId/snags/full-final-approved`

## Web UI Plan

### Configuration

Add under Quality > Configuration:

1. `Snag / Desnag Process`
   - Define total number of process steps.
   - Add/edit/delete process steps.
   - Define workflow serial number.
   - Reorder steps.

2. `Snag Activity Mapping`
   - Left side: process steps.
   - Middle: mapped activities for selected process.
   - Right side: common snag points for selected activity.
   - Support drag-and-drop activity movement between process steps.
   - Moving an activity moves its child common snag points.

3. `Common Snag Points`
   - Add/edit predefined snag descriptions.
   - Mark evidence required or optional.

Recommended drag-and-drop library:

- `@dnd-kit/core`
- `@dnd-kit/sortable`

### Execution

Update current snag page:

1. Show configured process steps as tabs/cards.
2. Disable locked process steps.
3. On process click:
   - Show blocks.
   - Then towers.
   - Then floors.
   - Then units from `Floor and Unit Structure`.
4. On unit select:
   - Show unit process status.
   - Show `Mark Unit Ready for Snagging` if allowed.
   - Show rooms.
5. On room select:
   - Show mapped activities for current process.
   - Include `Others`.
6. On activity select:
   - Show predefined common snag points.
   - Allow custom snag point.
   - Allow evidence upload.
7. Rectification:
   - Allow permitted users to mark points as rectified.
   - Allow rectification evidence.
8. Desnag:
   - Enable `Mark Desnag Ready` only when all non-cancelled points are rectified.
   - Notify release strategy approvers.
   - Approver can mark each point `DESNAGGED` or `NOT_SATISFIED`.
   - If all points are desnagged, unit process completes.
9. Full and final:
   - Show unit in full/final approved when all configured process steps are complete.

## Notifications

Trigger notifications on:

- Unit marked ready for snagging.
- Snag point raised.
- Snag point rectified.
- Unit marked desnag ready.
- Desnag rejected/not satisfied.
- Desnag approved.
- Full and final completion.

Notification recipients:

- Resolve from release strategy for approval events.
- Include assigned vendor/execution users for rectification events.

## Mobile App Handoff

Mobile must support:

- Process step list with locked/unlocked state.
- Block > tower > floor > unit selection.
- Unit ready for snagging action.
- Room selection from unit structure.
- Activity selection from configured activities plus `Others`.
- Predefined snag point selection plus custom snag entry.
- Optional/required photo evidence.
- Rectification marking with evidence.
- Desnag ready marking.
- Desnag approval/rejection for release-strategy approvers.
- Full/final approved list.

Mobile must not hardcode number of snag/desnag steps. It must read configured process steps from backend.

## Implementation Phases

Phase 1: Configuration foundation

- Add database tables and migrations.
- Add backend entities/services/controllers.
- Add permissions.
- Add Quality > Configuration UI pages.
- Add drag-and-drop activity movement.

Phase 2: Unit process execution

- Add unit process table and status logic.
- Add process-step tabs to existing snag screen.
- Add block/tower/floor/unit drilldown.
- Add ready-for-snagging flow.

Phase 3: Snag point lifecycle

- Add actual snag point table.
- Add evidence upload table.
- Add create/rectify/not-satisfied/desnagged actions.
- Add validation for evidence-required points.

Phase 4: Release strategy and notifications

- Add `QUALITY / SNAG_DESNAG` process to release strategy.
- Enforce approver eligibility for desnag approval.
- Add notifications for status transitions.

Phase 5: Reporting

- Add full/final approved list.
- Add export/report options by project, process, tower, floor, unit, status, vendor.

## Acceptance Criteria

1. Admin can define any number of snag/desnag process steps.
2. Process serial numbers control unlock order per unit.
3. Admin can map activities to process steps.
4. Dragging an activity to another process carries common snag points.
5. User can mark a unit ready for snagging only with permission.
6. User can raise predefined or custom snag points.
7. Snag evidence supports photos but can be optional.
8. User can mark snag points rectified only with permission.
9. Desnag ready is enabled only when all active points are rectified.
10. Desnag approver is resolved through release strategy.
11. Not-satisfied desnag points return to rectification.
12. Completing one process unlocks the next process for that unit.
13. Completing all configured processes puts unit in full/final approved list.
