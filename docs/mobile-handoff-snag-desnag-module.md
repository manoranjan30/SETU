# Mobile Handoff: Snag / Desnag Module

## Scope

The mobile app must implement the operational Snag / Desnag experience under each project.

Configuration is backend/web-only. Mobile must not create or edit:

- Snag/desnag process steps
- Activity-to-process mapping
- Common snag point masters
- Floor/unit structure
- Release strategy

Mobile must read backend configuration and use it to drive the project snag/desnag workflow.

## Current Process Contract

The web/backend process is now:

1. Maker marks a unit ready for the current snag cycle.
2. Checker opens the unit, selects room, selects configured activity, and raises actual snag points.
3. Checker may reset a ready unit back to unready only before snag points are raised.
4. Maker rectifies open snag points.
5. Photos are optional by default, but backend process-step configuration can make photos mandatory separately for:
   - raising snag points
   - rectification
   - de-snag completion
6. When every open point is rectified, the unit enters de-snag review.
7. Checker reviews each rectified point.
8. If satisfactory, Checker marks the point as de-snag completed / closed.
9. If not satisfactory, Checker marks the point as rejected/not satisfactory with remarks. Backend increments `notSatisfactoryCount`, stores latest rejection remarks/date/user, and sends the point back to `open`.
10. Maker re-rectifies rejected/open points.
11. Once all points in that cycle are closed, Checker must press `Final Closure of Snag X`.
12. Final closure records checker signoff details and marks the completed cycle as released. It must not automatically start the next snag cycle.
13. If another configured cycle exists, the unit status becomes `released`, meaning the next cycle is waiting for Maker action.
14. Maker must explicitly press `Mark Ready and Start Snag X+1` before Checker can raise points in the next cycle.
15. After final closure of the last configured snag cycle, unit status becomes `handover_ready`, shown in UI as `Ready for Customer Inspection`.

Important: closing all items alone must not be treated as final release. The final closure button/signoff is the gate. Final closure is also not the gate to auto-start the next cycle; Maker readiness is a separate gate.

## July 2026 Workflow Update

Use this updated state behavior in the mobile app:

- `POST /api/snag/:projectId/lists` is only for first-time unit readiness where no snag list exists yet.
- `POST /api/snag/:projectId/lists/:listId/mark-current-round-ready` starts the next configured cycle after the previous cycle is finally closed or skipped and the list is in `released` status.
- When `overallStatus = released`, show a Maker action named `Mark Ready and Start Snag N`.
- While `overallStatus = released`, Checker must not be allowed to raise new points. Backend will reject it.
- Once Maker marks ready, backend sets `overallStatus = ready_for_snag`, increments `currentRound`, creates/carries forward the next round, and Checker can raise points.
- If Checker finds additional defects after all de-snag points were closed but before `finalClosureSignedAt`, mobile must still allow `Raise Snag Point` in the same round.
- Raising an additional point before final closure reopens the current round and backend clears stale release approval state for that round. The new point then follows the normal open -> rectified -> closed flow.
- After `finalClosureSignedAt` is present for a round, mobile must not allow new points in that round.
- Display point timestamps from backend fields:
  - `raisedAt`
  - `rectifiedAt`
  - `closedAt`
  - `lastNotSatisfactoryAt`

## Required Mobile Workflow Hierarchy

The mobile Snag / De-snag screen must be process-step first, not unit-first.

Top-level hierarchy:

1. Show the configured `n` process steps at the top of the Snag / De-snag screen.
2. Each process step tab/card represents one configured workflow serial number, for example:
   - `Snag 1 / De-snag 1`
   - `Snag 2 / De-snag 2`
   - `Snag 3 / De-snag 3`
   - Any other configured step name from backend configuration
3. User taps a process step.
4. Below the selected process step, show the project hierarchy and unit board:
   - Blocks
   - Towers
   - Floors
   - Units
5. Each unit card must show its status for the selected process step.
6. User taps a unit to enter the current Snag / De-snag workspace for that selected process step.

Do not show the full configured step list only inside every unit as the primary navigation. A unit workspace may still show a compact progress strip, but the main navigation must start from configured process steps.

## Unit Status Mapping For Selected Step

Given:

- `selectedRound = selected process step workflowSerialNo`
- `unit.snagListId`
- `unit.currentRound`
- `unit.overallStatus`

Map each unit card like this:

- If `snagListId = null` and `selectedRound = 1`: show `Not ready`.
- If `snagListId = null` and `selectedRound > 1`: show `Locked`.
- If `overallStatus = handover_ready`: show `Ready for Customer Inspection` / completed.
- If `unit.currentRound > selectedRound`: show `Snag N completed`.
- If `unit.currentRound < selectedRound`:
  - If `overallStatus = released` and `unit.currentRound + 1 = selectedRound`: show `Ready request pending for Snag N`.
  - Otherwise show `Locked`.
- If `unit.currentRound = selectedRound`, map `overallStatus` directly:
  - `ready_for_snag`: `Ready for Snag N`
  - `snagging`: `Snag N open`
  - `desnagging`: `De-snag N active`
  - `released`: `Snag N closed - next snag pending`
  - `handover_ready`: `Ready for Customer Inspection`

Unit actions:

- `Not ready` on Snag 1: Maker can mark unit ready using `POST /api/snag/:projectId/lists`.
- `Ready request pending for Snag N`: Maker can start next step using `POST /api/snag/:projectId/lists/:listId/mark-current-round-ready`.
- `Ready for Snag N`, `Snag N open`, `De-snag N active`: open the unit workspace for that round.
- `Locked`: do not allow raising snag points.
- `Completed`: allow read-only viewing of the completed round if detail exists.

Step cards at the top should show small counters:

- Active: units in `ready_for_snag`, `snagging`, or `desnagging` for that selected step.
- Waiting: units where previous round is `released` and this step is waiting for Maker readiness.
- Done: units where this step is complete or the unit is customer-inspection ready.
- Locked: units not yet eligible for this step.

## Navigation

Add a dedicated project menu:

- Project > Quality > Snag / Desnag

Recommended submenus:

- Dashboard
- Unit Explorer
- My Actions
- Snag Register
- Analytics
- Full & Final Approved

The first screen should be the Dashboard, not a static landing page.

## Backend Configuration To Consume

Mobile must read process configuration from:

```http
GET /api/snag/:projectId/config/process-steps
```

Use this response to render the configured snag/desnag process steps dynamically. Do not hardcode 1, 2, or 3 cycles.

Each process step may include:

- `id`
- `name`
- `workflowSerialNo`
- `isActive`
- `activities[]`
- `activities[].activity`
- `activities[].commonPoints[]`

Mobile behavior:

- Sort process steps by `workflowSerialNo`.
- Hide inactive steps unless an admin/debug view is later required.
- Show locked/unlocked/completed state per unit based on unit/list/round data.

## Existing Operational APIs

Unit explorer:

```http
GET /api/snag/:projectId/units
```

Project analytics:

```http
GET /api/snag/:projectId/analytics
```

Analytics response shape:

```json
{
  "summary": {
    "totalUnits": 120,
    "notReadyUnits": 40,
    "readyUnits": 12,
    "snaggingUnits": 18,
    "desnaggingUnits": 20,
    "customerInspectionReadyUnits": 30,
    "totalSnagPoints": 420,
    "openSnagPoints": 110,
    "rectifiedPendingDesnag": 32,
    "closedSnagPoints": 240,
    "notSatisfactoryPoints": 14,
    "averageOpenAgeDays": 5.6
  },
  "byStatus": [{ "label": "snagging", "count": 18 }],
  "byProcessStep": [{ "label": "Snag 1", "count": 50 }],
  "byTower": [{ "label": "Tower A", "count": 24 }],
  "byFloor": [{ "label": "Floor 10", "count": 8 }],
  "byRoom": [{ "label": "Bedroom 1", "count": 12 }],
  "byActivity": [{ "label": "Painting", "count": 50 }],
  "byPriority": [{ "label": "medium", "count": 70 }],
  "agingBuckets": [{ "label": "0-3 days", "count": 25 }],
  "recurringSnags": [{ "label": "Paint patch visible", "count": 9 }],
  "blockedUnits": [
    {
      "listId": 88,
      "unitLabel": "1002",
      "currentRound": 1,
      "status": "snagging"
    }
  ]
}
```

Open or create unit snag workspace:

```http
POST /api/snag/:projectId/lists
```

Body:

```json
{
  "qualityUnitId": 123,
  "epsNodeId": 456
}
```

Get unit snag detail:

```http
GET /api/snag/:projectId/lists/:listId
```

Add snag point:

```http
POST /api/snag/:projectId/lists/:listId/rounds/:roundNumber/items
```

Body:

```json
{
  "qualityRoomId": 10,
  "roomLabel": "Bedroom 1",
  "defectTitle": "Wall paint patch visible",
  "defectDescription": "Patch visible near window sill",
  "trade": "Painting",
  "priority": "medium",
  "beforePhotoUrls": ["/uploads/abc.jpg"],
  "linkedChecklistItemId": "optional-common-point-id"
}
```

Rectify item:

```http
POST /api/snag/:projectId/items/:itemId/rectify
```

Close/desnag item:

```http
POST /api/snag/:projectId/items/:itemId/close
```

Reject rectification / not satisfactory:

```http
POST /api/snag/:projectId/items/:itemId/reject-rectification
```

Body:

```json
{
  "remarks": "Patch still visible near window sill"
}
```

Hold item:

```http
POST /api/snag/:projectId/items/:itemId/hold
```

Submit snag phase:

```http
POST /api/snag/:projectId/rounds/:roundId/submit-snag
```

Submit desnag release:

```http
POST /api/snag/:projectId/rounds/:roundId/submit-release
```

Approve/reject release approval:

```http
POST /api/snag/:projectId/approvals/:approvalId/advance
```

Body:

```json
{
  "action": "APPROVE",
  "comments": "Approved"
}
```

Final closure after all snag points in a cycle are closed:

```http
POST /api/snag/:projectId/rounds/:roundId/final-closure
```

Body:

```json
{
  "remarks": "Snag 1 finally closed after checker verification",
  "signatureData": "optional data:image/png;base64,..."
}
```

If `signatureData` is not sent, backend uses the logged-in checker user's saved signature data/image URL when available.

Download snag status PDF report:

```http
GET /api/snag/:projectId/lists/:listId/rounds/:roundNumber/status-report.pdf
```

The PDF follows the F.QA.09 Unit and Common Area Clearance format:

- project logo from project properties
- activity-wise grouping
- room-wise indentation
- snag point rows
- Contractor Engineer Yes/No tick for rectification
- PL/PHL QA & QC Yes/No tick for checker closure
- final checker closure/signoff block

or:

```json
{
  "action": "REJECT",
  "comments": "Rectification not satisfactory"
}
```

## Permissions

Mobile must use permission checks before showing actions:

- Read: `QUALITY.SNAG.READ`
- Raise snag: `QUALITY.SNAG.CREATE`
- Rectify/submit: `QUALITY.SNAG.UPDATE`
- Delete/reset: `QUALITY.SNAG.DELETE`
- Approve/reject desnag release: `QUALITY.SNAG.APPROVE`

Mobile must gate the entire Snag module with `QUALITY.SNAG.READ`. Users without this permission should not see Snag dashboard, unit explorer, register, analytics, or PDF report links.

Action guidance:

- Maker ready for snagging: `QUALITY.SNAG.CREATE`
- Checker raise snag point: current web gates by `QUALITY.SNAG.APPROVE`; mobile should follow backend response if the app still has partial older logic.
- Maker rectification: `QUALITY.SNAG.UPDATE`
- Checker de-snag complete / reject rectification / final closure: `QUALITY.SNAG.APPROVE`
- Admin reset/delete cycle or item: `QUALITY.SNAG.DELETE`

Configuration permissions exist but mobile should not expose config editors:

- `QUALITY.SNAG_CONFIG.READ`
- `QUALITY.SNAG_CONFIG.MANAGE`

## Release Strategy

Desnag approval is backend-controlled through Release Strategy.

Current backend process:

- `moduleCode`: `QUALITY`
- `processCode`: `SNAG_RELEASE_APPROVAL`
- `documentType`: `SNAG_ROUND_RELEASE`

Mobile must not decide approver eligibility locally. It may hide buttons based on permissions, but backend remains final authority.

Recommended error copy:

- `You are not assigned to approve this desnag release.`
- `This unit is not ready for desnag approval.`
- `All snag items must be closed or held before release approval.`

## Mobile UX Requirements

### Dashboard

Build a strong, useful dashboard for project snag health.

Suggested cards:

- Total Units
- Units Not Started
- Units In Snagging
- Units In Desnagging
- Units Released / Full Final Approved
- Open Snag Points
- Rectified Pending Desnag
- Rejected / Not Satisfied
- Average Days Open
- Overdue Snags

Suggested charts:

- Snags by process step
- Snags by tower/floor
- Snags by room
- Snags by activity/trade
- Snags by priority
- Aging buckets: `0-3`, `4-7`, `8-14`, `15+ days`
- Rectification trend
- Closure trend

Suggested insights:

- Top 5 recurring snag points
- Top 5 delay-heavy activities/trades
- Towers/floors with highest open snag density
- Units ready for desnag approval
- Units blocked because of rejected desnag points

The web app now keeps `Analysis`, `Unit Workflow`, and `Customer Inspection Ready` as separate views. Mobile should follow the same separation:

- Dashboard/analytics first
- Unit execution as a separate tab/menu
- Ready for Customer Inspection as a separate completed list

### Unit Explorer

Flow:

1. Select process step.
2. Select block.
3. Select tower.
4. Select floor.
5. Select unit.
6. Open unit snag workspace.

Show unit cards with:

- Unit name
- Current process step
- Current status
- Open count
- Rectified count
- Closed count
- Approval pending indicator
- Full/final approved badge

Use visual status colors:

- Not started: neutral
- Snagging: orange/red
- Desnagging: blue
- Approval pending: amber
- Approved/released: green
- Rejected/not satisfied: red

### Unit Workspace

Header:

- Unit name
- Block/tower/floor
- Current process step
- Overall status
- Action buttons based on permission/state

Sections:

- Rooms
- Activities
- Common snag points
- Actual snag list
- Evidence gallery
- Timeline/history
- Approval status

### Room And Activity Flow

After selecting a unit:

1. Show rooms from unit structure.
2. User selects room.
3. Show activities mapped to the current configured process step.
4. Include `Others`.
5. User selects activity.
6. Show predefined common snag points for that activity.
7. User can pick one or create a custom snag point.

For `Others`, allow:

- Custom activity/trade name
- Custom snag title
- Description
- Priority
- Optional photos

### Snag Point Capture

Fields:

- Room
- Activity/trade
- Predefined common snag point or custom title
- Description
- Priority
- Before photos

Photo behavior:

- Allow camera capture.
- Allow gallery selection if supported.
- Compress before upload.
- Show upload progress.
- Allow multiple photos.
- Support offline draft capture if mobile app already has offline framework.

### Rectification

For open snag points:

- Show `Mark Rectified`.
- Capture rectification notes.
- Capture after photos.
- Upload evidence.
- Change status to `rectified`.

Bulk rectification is useful:

- Select multiple snag points.
- Add common rectification note.
- Upload shared evidence.

### Desnag Review

When all required items are closed/held and desnag release is submitted:

- Show approval workflow panel.
- Show pending approver step.
- If current user can approve, show:
  - Approve
  - Reject / Not Satisfied

For rejection:

- Require comments.
- Make rejected status obvious.
- Send the unit back into rectification/desnagging flow according to backend response.
- Show `notSatisfactoryCount`, latest not satisfactory remarks, date, and rejected-by user if present.

### Final Closure

After all points in a snag cycle are closed:

- Show `Final Closure of Snag X`.
- Allow only Checker/approver permission.
- Capture remarks.
- Capture drawn signature if mobile has signature pad.
- Submit to `POST /api/snag/:projectId/rounds/:roundId/final-closure`.
- After success, reload unit detail because backend may open the next snag cycle.

Do not auto-open the next cycle locally before backend confirms.

### Full & Final Approved

Show units where all configured process steps are complete and the backend overall status is:

- `handover_ready`

List columns/cards:

- Unit
- Tower/floor
- Completed process count
- Final approval date
- Last approver if provided

## Data Interpretation

From `GET /api/snag/:projectId/lists/:listId`:

- `currentRound` maps to current configured process step serial.
- `overallStatus` drives the high-level unit state.
- `rounds[]` contains per-process execution.
- `rounds[].snagPhaseStatus` drives snagging phase.
- `rounds[].desnagPhaseStatus` drives desnag/approval phase.
- `rounds[].items[]` contains actual snag points.
- `rounds[].approvals[]` contains release approval workflow.
- `processSteps[]` may be included by backend on detail response.

Important statuses:

- Snag item: `open`, `rectified`, `closed`, `on_hold`
- Snag list: `unready`, `ready_for_snag`, `snagging`, `desnagging`, `released`, `handover_ready`
- Desnag phase: `locked`, `open`, `approval_pending`, `approved`, `rejected`

Interpret `handover_ready` as `Ready for Customer Inspection` in UI copy.

## Design Direction

Make the mobile module feel operational and inspection-friendly:

- Fast scanning.
- Large touch targets.
- Sticky action bar in unit workspace.
- Camera-first evidence capture.
- Clear status chips.
- Compact analytics cards.
- Filterable snag register.
- Strong visual hierarchy by process step, tower/floor/unit, and status.

Avoid:

- Configuration editing on mobile.
- Hardcoded process counts.
- Hiding backend errors.
- Approving locally without backend release strategy response.

## Mobile Acceptance Criteria

1. Mobile reads configured snag/desnag process steps from backend.
2. Mobile does not expose configuration editing.
3. Unit explorer supports block > tower > floor > unit drilldown.
4. User can open a unit workspace.
5. User can create snag points from predefined common points.
6. User can create custom snag points through `Others`.
7. User can upload before/after/closure evidence.
8. User can rectify snag points if permitted.
9. User can submit snag phase if permitted.
10. User can submit desnag release if permitted and backend allows.
11. Approver can approve/reject release if permitted and assigned by backend.
12. Dashboard shows meaningful analysis: counts, aging, process-step breakdown, tower/floor breakdown, recurring snag points.
13. Checker can mark rectification as not satisfactory with remarks.
14. Checker can perform final closure with signature after every item in the cycle is closed.
15. Snag Status PDF report can be downloaded/opened.
16. Customer Inspection Ready list shows completed units.

## Notes For Mobile LLM

Start with a read-only dashboard plus unit explorer, then add actions:

1. Dashboard and analytics.
2. Process-step driven unit explorer.
3. Unit workspace and snag creation.
4. Rectification.
5. Desnag approval.
6. Full/final list.

Keep API models flexible because backend configuration will grow.
