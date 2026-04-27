# Quality Activity Floor Visibility Plan

## Objective

Add a new activity configuration control in the Quality activity list editor to define:

- when a user clicks a `Floor` in `Raise RFI`
- which activities should be shown for that floor

This is **not** the same as the existing activity `applicabilityLevel`.

It is a separate visibility rule meant to solve this specific problem:

- today, when users click a floor in `InspectionRequestPage`
- activities from unrelated floors can still appear
- users then see too many irrelevant activities while raising RFI

The requested solution is:

- add a button in the activity list editor
- open a project tree showing `Blocks > Towers > Floors`
- all nodes checked by default
- user can uncheck floors or parent branches
- only activities mapped to the checked floor tree should appear when raising RFI from that floor context

## Important Clarification

This feature must remain separate from:

- `activity.applicabilityLevel = FLOOR / UNIT / ROOM`

Why:

- `applicabilityLevel` defines the execution scope type of the activity
- this new feature defines the floor-wise visibility of the activity when selecting a floor in Raise RFI

Example:

- an activity can still be a `UNIT` level activity
- but it should appear only for selected floors like `Tower A > Floor 3` and `Tower A > Floor 4`

So the two concepts are:

1. `Execution Level`
   - floor/unit/room behavior
2. `Floor Visibility`
   - which floors should show that activity in Raise RFI

## Current State

Today, activity visibility in `InspectionRequestPage.tsx` is mainly driven by:

- selected list
- selected EPS node
- `applicabilityLevel`

What is missing:

- no per-activity floor whitelist
- no project-tree selection UI inside activity editor
- no filtering rule that hides unrelated activities when a floor is selected

## Recommended Design

### 1. Add a separate activity field

Do not call it `locationApplicability`.

Use a feature-specific name like:

- `floorVisibility`

Recommended entity field on `quality_activity`:

```ts
floorVisibility: {
  mode?: 'ALL' | 'RESTRICTED';
  selectedBlockIds?: number[];
  selectedTowerIds?: number[];
  selectedFloorIds?: number[];
  selectedNodeIds?: number[];
  version?: number;
} | null;
```

Recommended meaning:

- `null` or `mode = 'ALL'`
  - activity is visible for all floors
- `mode = 'RESTRICTED'`
  - activity is visible only for selected blocks/towers/floors

### 2. Restrict only by Block / Tower / Floor

The tree for this feature should show only:

- `BLOCK`
- `TOWER`
- `FLOOR`

Do not include:

- unit
- room

Reason:

- your requirement is specifically about what should appear after clicking a floor in Raise RFI
- the problem is floor visibility, not unit or room visibility

### 3. Matching rule in Raise RFI

When a user selects a node in `InspectionRequestPage`:

- if selected node is a `FLOOR`
  - activity is visible if:
    - that floor is selected directly
    - or its parent tower is selected
    - or its parent block is selected
- if selected node is a `UNIT` or `ROOM`
  - first resolve parent floor/tower/block
  - then use the same floor visibility rule

This keeps behavior intuitive:

- checking a block means all floors under that block are allowed
- checking a tower means all floors under that tower are allowed
- checking a floor means only that floor is allowed

## UX Plan

### Sequence Manager

In `SequenceManagerPage.tsx`:

- add a new button on each activity card:
  - `Floor Visibility`
- add the same action inside add/edit activity form

Recommended placement:

- near the current `Applicability: FLOOR / UNIT / ROOM` badge
- but visually separated so users understand it is a different setting

Suggested labels:

- `Execution Level: FLOOR`
- `Visible On Floors: All`

or

- `Visible On Floors: Restricted`

### Modal behavior

Clicking `Floor Visibility` opens a modal:

- title: `Select Floors For Activity Visibility`
- subtitle: `Choose where this activity should appear in Raise RFI`

Data source:

- use project EPS tree from `GET /eps/:projectId/tree`

Tree behavior:

- show only block/tower/floor hierarchy
- all checked by default for new activities
- checkbox on parent checks/unchecks descendants
- partial state for mixed child selection

Modal actions:

- `Select All`
- `Clear All`
- `Save`
- `Cancel`

Activity card summary examples:

- `Visible On Floors: All`
- `Visible On Floors: 2 Blocks, 1 Tower, 5 Floors`

## Backend Plan

### Entity change

Update `backend/src/quality/entities/quality-activity.entity.ts`:

```ts
@Column({ type: 'jsonb', nullable: true })
floorVisibility: {
  mode?: 'ALL' | 'RESTRICTED';
  selectedNodeIds?: number[];
  selectedBlockIds?: number[];
  selectedTowerIds?: number[];
  selectedFloorIds?: number[];
  version?: number;
} | null;
```

### DTO changes

Extend:

- `CreateActivityDto`
- `UpdateActivityDto`

with:

- `floorVisibility?: ...`

### Service changes

In `quality-activity.service.ts`:

- persist `floorVisibility`
- normalize payload before save

Add helper:

- `normalizeFloorVisibility(payload)`

Normalization rules:

- remove duplicates
- keep only numeric IDs
- if all nodes selected, store `null` or `mode = 'ALL'`

## Frontend Plan

### SequenceManagerPage changes

Add to `Activity` interface:

- `floorVisibility?: ...`

Add state:

- `showFloorVisibilityModal`
- `floorVisibilityTarget`
- `epsTree`
- `selectedFloorVisibilityIds`

Implementation:

- fetch tree using `projectId`
- build recursive checkbox tree
- save `floorVisibility` with activity create/edit

### Shared utility

Recommended new utility:

- `frontend/src/views/quality/utils/floorVisibility.ts`

Helpers:

- filter EPS tree to block/tower/floor only
- collect descendants
- compute checked/partial states
- summarize selection
- resolve selected node ancestry
- check whether activity is visible for current floor context

## Raise RFI Integration

### InspectionRequestPage behavior

In `InspectionRequestPage.tsx`:

- keep current `applicabilityLevel` logic as-is
- add a second filter for `floorVisibility`

Recommended sequence:

1. load raw activities
2. filter by existing execution-level rules
3. filter by floor visibility rules
4. render only final visible activities

This prevents unrelated activities from showing when a floor is clicked.

### Visibility helper

Recommended helper:

- `isActivityVisibleForSelectedFloor(activity, selectedNode, ancestry)`

Inputs:

- activity with `floorVisibility`
- selected EPS node
- resolved `{ blockId, towerId, floorId }`

Output:

- boolean

## Backend Enforcement

Even if frontend hides disallowed activities, backend must also validate.

In `quality-inspection.service.ts` inside `createInspection()`:

- resolve selected node ancestry
- validate activity `floorVisibility`
- reject if user tries to raise RFI for a floor where activity should not appear

Suggested error:

- `This activity is not configured to be visible for the selected floor.`

This is important for:

- stale frontend states
- direct API requests
- future mobile clients

## Data Semantics

### Default for existing activities

All old activities should behave as:

- `floorVisibility = null`
- meaning visible on all floors

So there is no regression on release.

### Parent-child rules

To keep v1 simple:

- positive whitelist only
- no explicit child exclusion under a checked parent

Meaning:

- if block is checked, all towers/floors below are allowed
- if tower is checked, all floors below are allowed
- to allow only one floor, user must uncheck parent and select that floor directly

## Migration Plan

Add a migration to:

- add `floor_visibility` JSONB column to `quality_activity`

No backfill required.

Existing records remain unrestricted by default.

## Verification Plan

### Backend verification

1. Create activity without `floorVisibility`
   - activity remains visible for all floors
2. Create activity with restricted floors
   - payload stored correctly
3. Raise RFI from allowed floor
   - succeeds
4. Raise RFI from blocked floor
   - rejected
5. Unit/room activity under allowed floor
   - visible and raisable if parent floor is allowed

### Frontend verification

1. Open activity editor
   - `Floor Visibility` button is shown
2. Open tree modal
   - blocks/towers/floors load correctly
   - all checked by default
3. Save restricted tree
   - summary appears on activity card
4. Open Raise RFI page
   - click different floors
   - only floor-relevant activities appear
5. Select a unit/room under a floor
   - same floor visibility rule still applies

## Rollout Order

### Phase 1

- backend entity + DTO + migration for `floorVisibility`

### Phase 2

- Sequence Manager modal and save flow

### Phase 3

- frontend filtering in `InspectionRequestPage`

### Phase 4

- backend validation in `createInspection()`

### Phase 5

- QA validation with:
  - multiple blocks
  - multiple towers
  - same activity visible on selected floors only

## Risks

### Risk 1: confusion with existing applicability level

Mitigation:

- explicitly label this feature as `Floor Visibility`
- do not reuse `locationApplicability`
- do not merge it with `Execution Level`

### Risk 2: irregular EPS tree

Mitigation:

- only use valid block/tower/floor ancestry
- fallback safely to unrestricted behavior if ancestry cannot be resolved
- log backend warning for bad tree data

### Risk 3: hidden activities may look like missing data

Mitigation:

- show optional helper text in Raise RFI:
  - `Activities are filtered by floor visibility configuration`

## Recommended Final Shape

The right v1 design is:

- a separate `floorVisibility` field on each activity
- tree-based block/tower/floor selector in Sequence Manager
- filtering in Raise RFI based on selected floor ancestry
- backend enforcement on RFI creation

This directly solves your actual problem:

- when user clicks a floor, only activities configured for that floor should be shown

without mixing it into the broader activity applicability model.
