# Quality RFI + Elements + Dynamic GO + Pour Card Blueprint

## Objective

Implement four connected quality-module enhancements:

1. Add an `Elements` text field while raising an RFI and persist it in the database.
2. Allow multi-GO checklist series to be expanded after the first RFI is already raised.
3. Add two activity-level checkboxes:
   - `Attach Pour Clearance Card`
   - `Attach Pour Card`
4. Build structured `Pour Card` and `Pre-Pour Clearance Card` creation inside the checklist flow, and store all entered details against the relevant checklist/RFI.

This plan is based on the current quality module structure in:

- `frontend/src/views/quality/InspectionRequestPage.tsx`
- `frontend/src/views/quality/SequenceManagerPage.tsx`
- `frontend/src/views/quality/QualityApprovalsPage.tsx`
- `frontend/src/views/quality/subviews/QualityChecklist.tsx`
- `frontend/src/services/quality.service.ts`
- `backend/src/quality/quality-inspection.controller.ts`
- `backend/src/quality/quality-inspection.service.ts`
- `backend/src/quality/quality-activity.service.ts`
- `backend/src/quality/checklist-template.service.ts`
- `backend/src/quality/entities/quality-activity.entity.ts`
- `backend/src/quality/entities/quality-inspection.entity.ts`
- `backend/src/quality/entities/quality-checklist-template.entity.ts`
- `backend/src/quality/entities/quality-execution-item.entity.ts`

The attached PDFs indicate two structured form families:

- `F/QA/16 Concrete Pourcard`
- `F/QA/20 Pre-Pour Clearance Card`

## Current State Summary

### What already exists

- RFI creation already persists `drawingNo`, `goNo`, `goLabel`, `partNo`, `totalParts`, `vendor`, `comments`, and location scope into `quality_inspections`.
- Multi-GO is implemented as repeated `QualityInspection` rows with duplicated `totalParts`.
- Activities are configured in `SequenceManagerPage.tsx` and saved through `QualityActivityService`.
- Activities can already be linked to one or more checklist templates through `assignedChecklistIds`.
- When an RFI is raised, the backend expands all assigned checklist templates into `QualityInspectionStage` and `QualityExecutionItem` records.
- The inspection execution and approval experience is concentrated in `QualityApprovalsPage.tsx`.

### Current design gaps relative to the requirement

- No `Elements` field exists in `CreateInspectionDto` or `QualityInspection`.
- Multi-GO total count is duplicated on every inspection row, so post-creation GO expansion is awkward and error-prone.
- `QualityActivity` has no flags for pour card requirements.
- There is no structured data model for pour card / pre-pour clearance card headers, line items, sign-offs, or their link to inspections.
- The checklist execution UI has no dedicated card menu at the top.

## Recommended Target Design

### 1. Add inspection-scoped `elementName`

Persist the user-entered element name on the inspection itself because:

- it belongs to a specific raised RFI/checklist execution, not the activity template
- it should appear in reports, approval screens, and pour card headers
- it may vary across repeated RFIs for the same activity

Recommended field:

- `QualityInspection.elementName: varchar(255) null`

### 2. Normalize multi-GO into an inspection series

The current `totalParts` duplication works for initial creation but becomes fragile when users want to add GO 4 after raising GO 1..3.

Recommended new entity:

- `quality_inspection_series`

Suggested fields:

- `id`
- `projectId`
- `listId`
- `activityId`
- `epsNodeId`
- `qualityUnitId nullable`
- `qualityRoomId nullable`
- `drawingNo`
- `elementName nullable`
- `seriesType enum('SINGLE','MULTI_GO')`
- `totalParts`
- `currentMaxGo`
- `status`
- `createdBy`
- timestamps

Then add:

- `QualityInspection.seriesId nullable`

Why this is the best fit:

- one source of truth for GO count
- easy `Add GO` action: increment `currentMaxGo` and `totalParts`
- cleaner dashboard aggregation
- avoids bulk-updating historical inspection rows just to reflect the new allowed max

If the team wants a lower-change first release, the fallback is to update all sibling inspections sharing the same scope, but that is a tactical workaround, not the preferred design.

### 3. Store pour-card requirements on `QualityActivity`

Add two booleans to `QualityActivity`:

- `requiresPourCard`
- `requiresPourClearanceCard`

These are activity-level execution requirements, not checklist template metadata, because the requirement explicitly asks for them at activity creation time.

### 4. Store card data as structured inspection-linked records

Do not store pour card data as free-text comments or raw JSON only.

Recommended entities:

- `quality_pour_cards`
- `quality_pour_card_entries`
- `quality_pour_clearance_cards`
- `quality_pour_clearance_signoffs`

Suggested header model:

#### `quality_pour_cards`

- `id`
- `inspectionId`
- `seriesId nullable`
- `projectId`
- `activityId`
- `epsNodeId`
- `elementName nullable`
- `locationText nullable`
- `projectNameSnapshot nullable`
- `clientName nullable`
- `consultantName nullable`
- `contractorName nullable`
- `approvedByName nullable`
- `formatNo default 'F/QA/16'`
- `revisionNo`
- `remarks nullable`
- `status enum('DRAFT','SUBMITTED','LOCKED')`
- `createdBy`
- timestamps

#### `quality_pour_card_entries`

- `id`
- `pourCardId`
- `slNo`
- `pourDate`
- `truckNo`
- `deliveryChallanNo`
- `mixIdOrGrade`
- `quantityM3`
- `cumulativeQtyM3`
- `batchStartTime`
- `finishingTime`
- `timeTakenMinutes`
- `slumpMm`
- `concreteTemperature`
- `arrivalTimeAtSite`
- `noOfCubesTaken`
- `supplierRepresentative nullable`
- `contractorRepresentative nullable`
- `clientRepresentative nullable`
- `remarks nullable`

#### `quality_pour_clearance_cards`

- `id`
- `inspectionId`
- `seriesId nullable`
- `projectId`
- `activityId`
- `epsNodeId`
- `elementName nullable`
- `activityLabel`
- `projectNameSnapshot nullable`
- `cardDate`
- `locationText nullable`
- `pourStartTime nullable`
- `pourEndTime nullable`
- `contractorName nullable`
- `pourLocation nullable`
- `estimatedConcreteQty nullable`
- `actualConcreteQty nullable`
- `pourNo nullable`
- `gradeOfConcrete nullable`
- `placementMethod nullable`
- `concreteSupplier nullable`
- `cubeMouldCount nullable`
- `targetSlump nullable`
- `vibratorCount nullable`
- fixed attachment booleans:
  - `checklistPccAttached`
  - `checklistWaterproofingAttached`
  - `checklistFormworkAttached`
  - `checklistReinforcementAttached`
  - `checklistMepAttached`
  - `checklistConcretingAttached`
  - `concretePourCardAttached`
- `status enum('DRAFT','SUBMITTED','LOCKED')`
- `createdBy`
- timestamps

#### `quality_pour_clearance_signoffs`

- `id`
- `clearanceCardId`
- `department`
- `personName nullable`
- `signedDate nullable`
- `signatureData nullable`
- `sequence`
- `status enum('PENDING','SIGNED','WAIVED')`

This structure preserves all detail from the attached forms while still allowing reporting and later PDF export.

## UX / Product Flow

## Step 1. Activity setup

In `SequenceManagerPage.tsx` activity form:

- add two new checkboxes under the existing Hold Point / Witness Point / Allow Break toggles
  - `Attach Pour Clearance Card`
  - `Attach Pour Card`
- persist them through create and update activity APIs
- show badges in the activity list row so users can see card requirements at a glance

## Step 2. RFI raise modal

In `InspectionRequestPage.tsx`:

- add `Elements` text box in the RFI raise modal
- make it visible for all applicable levels unless business wants it floor-only
- prefill card section visibility based on activity flags:
  - if `requiresPourCard`, show note that `Pour Card` will be available in checklist top section
  - if `requiresPourClearanceCard`, show note that `Pre-Pour Clearance Card` will be available in checklist top section
- when creating a multi-GO RFI, create or reuse a `seriesId`

## Step 3. Expand GO later

For multi-GO activities in `InspectionRequestPage.tsx`:

- add `Add GO` button near current GO progress
- action opens a small confirm modal:
  - current total GO
  - new total GO
  - optional first new GO to raise immediately
- backend increments the series size
- frontend refreshes progress and enables raising the newly added GO number(s)

## Step 4. Checklist execution top menu

In `QualityApprovalsPage.tsx` inspection detail header:

- when `activity.requiresPourCard`, show `Pour Card` action/tab
- when `activity.requiresPourClearanceCard`, show `Pre-Pour Clearance` action/tab
- display card completion state:
  - `Not Started`
  - `Draft Saved`
  - `Submitted`
  - `Locked`

Suggested header actions:

- `Open Pour Card`
- `Open Pre-Pour Clearance`
- `Download Pour Card PDF`
- `Download Clearance Card PDF`

## Step 5. Card creation screens inside checklist menu

Create two embedded form panels, ideally under:

- `frontend/src/views/quality/components/PourCardPanel.tsx`
- `frontend/src/views/quality/components/PourClearancePanel.tsx`

Behavior:

- loaded within the inspection detail experience, not as a separate module
- auto-seeded with inspection values:
  - project
  - location
  - drawing no
  - element name
  - contractor/vendor
  - GO number
- saved as draft repeatedly
- optionally locked on final approval or explicit submit

## API and Backend Strategy

## Step A. Schema migration

### Update existing tables

#### `quality_inspections`

- add `elementName`
- add `seriesId nullable`

#### `quality_activity`

- add `requiresPourCard default false`
- add `requiresPourClearanceCard default false`

### New tables

- `quality_inspection_series`
- `quality_pour_cards`
- `quality_pour_card_entries`
- `quality_pour_clearance_cards`
- `quality_pour_clearance_signoffs`

### Indexes

Add indexes on:

- `quality_inspections(seriesId)`
- `quality_inspection_series(projectId, activityId, epsNodeId, qualityUnitId, qualityRoomId)`
- `quality_pour_cards(inspectionId)`
- `quality_pour_clearance_cards(inspectionId)`

## Step B. Activity API changes

Files:

- `backend/src/quality/quality-activity.service.ts`
- `backend/src/quality/quality-activity.controller.ts`
- `frontend/src/services/quality.service.ts`

Changes:

- extend `CreateActivityDto` and `UpdateActivityDto`
- persist `requiresPourCard` and `requiresPourClearanceCard`
- return these fields in activity list responses

## Step C. Inspection raise API changes

Files:

- `backend/src/quality/dto/create-inspection.dto.ts`
- `backend/src/quality/quality-inspection.service.ts`
- `backend/src/quality/quality-inspection.controller.ts`

Changes:

- add `elementName`
- add optional `seriesId`
- add optional `createSeries` metadata for multi-GO creation
- create or attach inspection series during RFI raise
- snapshot `elementName` into inspection
- include `elementName` in `getInspections()` and `getInspectionDetails()`

## Step D. New series expansion endpoint

Recommended endpoint:

- `POST /quality/inspections/series/:seriesId/add-go`

Payload:

- `incrementBy`
- `raiseImmediately boolean`
- `drawingNo optional override`
- `requestDate optional`

Behavior:

- validate requester permissions
- increment `totalParts` and `currentMaxGo`
- optionally create next inspection row immediately
- return updated progress summary

## Step E. New pour-card endpoints

Recommended controller:

- `backend/src/quality/quality-pour-card.controller.ts`

Recommended service:

- `backend/src/quality/quality-pour-card.service.ts`

Endpoints:

- `GET /quality/inspections/:inspectionId/pour-card`
- `PUT /quality/inspections/:inspectionId/pour-card`
- `POST /quality/inspections/:inspectionId/pour-card/submit`
- `GET /quality/inspections/:inspectionId/pour-card/pdf`
- `GET /quality/inspections/:inspectionId/pre-pour-clearance`
- `PUT /quality/inspections/:inspectionId/pre-pour-clearance`
- `POST /quality/inspections/:inspectionId/pre-pour-clearance/submit`
- `GET /quality/inspections/:inspectionId/pre-pour-clearance/pdf`

## Frontend Implementation Strategy

## Step F. Shared types

Update:

- `frontend/src/types/quality.ts`

Add:

- activity flags
- inspection `elementName`
- `QualityInspectionSeries`
- `QualityPourCard`
- `QualityPourCardEntry`
- `QualityPourClearanceCard`
- `QualityPourClearanceSignoff`

## Step G. Service layer

Update:

- `frontend/src/services/quality.service.ts`

Add methods for:

- create/update activity with card flags
- get/save inspection cards
- add GO to series
- fetch series progress
- download card PDFs

## Step H. Activity configuration UI

Update:

- `frontend/src/views/quality/SequenceManagerPage.tsx`

Changes:

- add new checkboxes into form state
- pass them in create/update payloads
- render requirement badges in list rows

## Step I. RFI raising UI

Update:

- `frontend/src/views/quality/InspectionRequestPage.tsx`

Changes:

- add `elementName` state
- add textbox in modal
- include `elementName` in all single, GO, and batch create payloads
- show current series GO progress
- add `Add GO` button for eligible multi-GO activities
- refresh series summary after add/raise

## Step J. Checklist execution / approvals UI

Update:

- `frontend/src/views/quality/QualityApprovalsPage.tsx`

Changes:

- load `elementName`
- show element in inspection header, queue cards, and reports
- add top-level buttons/tabs for pour card and clearance card
- embed two structured forms
- disable lock-sensitive edits when workflow reaches approved/locked state

## PDF-Specific Mapping

The attached forms suggest the following field mapping.

## F/QA/16 Concrete Pourcard

Map these fields:

- project
- client
- consultant
- contractor
- element
- location
- approved by
- repeated pour rows for truck / challan / mix / quantity / slump / temperature / cubes / timing / remarks

Implementation note:

- this form requires a repeatable grid, so a parent-child header + entry table is the correct design

## F/QA/20 Pre-Pour Clearance Card

Map these fields:

- activity
- project
- date
- location
- pour start time
- pour end time
- contractor
- pour location
- estimated qty
- actual qty
- pour no
- concrete grade
- placement method
- supplier
- cube mould count
- target slump
- vibrator count
- attachment checklist booleans
- signature confirmation rows by department

Implementation note:

- sign-off rows should be stored as structured child rows, not a single signature blob

## Data Integrity Rules

1. `elementName` is required when raising an RFI for activities that require pour card or clearance card.
2. `Add GO` is allowed only for inspections tied to a `MULTI_GO` series.
3. New GO numbers must be unique inside a series.
4. Submitted or locked card records cannot be silently overwritten.
5. Final approval should either:
   - require mandatory cards to be at least submitted, or
   - warn but allow, depending on business rule chosen.

Recommended rule:

- If activity requires a card, final workflow approval should block until that card is submitted.

## Rollout Plan

## Phase 1. Foundation

- schema migration
- activity flags
- inspection `elementName`
- inspection series model

## Phase 2. RFI and GO expansion

- update RFI modal
- add series APIs
- add `Add GO` flow

## Phase 3. Card persistence

- add backend entities/services/controllers
- save draft + submit flows

## Phase 4. Checklist embedding

- add card panels into approval/checklist screen
- load/save status in top menu

## Phase 5. Reporting and lock rules

- export card PDFs
- show card status in dashboard/report
- block final approval when required cards are missing

## Verification Strategy

### Backend

- unit tests for new DTO validation
- service tests for:
  - RFI create with `elementName`
  - series creation
  - series GO expansion
  - pour card draft save
  - pour card submit
  - approval blocking when mandatory cards missing

### Frontend

- component tests for:
  - activity form checkboxes
  - RFI modal `Elements` input
  - GO expansion button state
  - pour card panel save/submit state

### End-to-end

1. Create activity with both card flags enabled.
2. Raise multi-GO RFI with `Elements` value.
3. Add one extra GO after initial creation.
4. Open checklist and fill pour clearance card.
5. Fill pour card rows.
6. Submit both cards.
7. Approve workflow.
8. Reopen inspection and confirm data persists.

## Risks and Mitigations

### Risk: ambiguous GO grouping with current model

Mitigation:

- introduce `quality_inspection_series` instead of trying to infer siblings from duplicated inspection columns

### Risk: storing card data as JSON becomes unreportable later

Mitigation:

- use structured header + child-row tables now

### Risk: approval screen becomes overcrowded

Mitigation:

- keep cards in collapsible panels or top tabs, not inline inside every checklist stage

### Risk: legacy inspections have no series

Mitigation:

- make `seriesId` nullable
- backfill only for new multi-GO inspections
- optional future migration script for legacy records

## Recommended Execution Order

1. Database and entity changes
2. Activity create/update changes
3. Inspection create/read changes
4. Series and GO expansion APIs
5. Frontend RFI modal updates
6. Pour card backend
7. Pour card frontend panels
8. Approval gating and reports

## Open Business Decisions To Confirm Before Build

1. Should `Elements` be mandatory for all RFIs, or only for concreting / pour-card-enabled activities?
2. Should one inspection have exactly one pour card and one clearance card, or allow multiple revisions?
3. Should `Add GO` only expand the series, or also auto-create the next GO inspection?
4. Should final approval be blocked if required cards are only in draft?
5. Should card PDFs be generated from structured data only, or also allow uploading signed scanned copies?

## Recommended Default Decisions

1. `Elements` mandatory only when `requiresPourCard` or `requiresPourClearanceCard` is true.
2. One active card of each type per inspection, with revision history added later only if needed.
3. `Add GO` expands series first and optionally offers `raise new GO now`.
4. Final approval blocked until required cards are submitted.
5. Generate PDFs from structured data; scanned copy upload can be a later enhancement.
