# QA QC Checklist Process - Claude Code Prompt for Flutter Mobile App

Use this prompt to brief Claude for updating the existing Flutter mobile app so the Quality Request and Quality Approval menus correctly support the current backend-driven QA/QC checklist workflow.

## Objective

Update the existing Flutter mobile app so the Quality module supports the real QA/QC checklist process already implemented in the backend and web app.

The mobile app is not a new app. It must update the existing Flutter codebase and use the existing backend, database, and authentication model.

Focus on these menus in mobile:

- `Quality Request`
- `Quality Approval`

The mobile implementation must align with the real process below and must not invent a separate workflow model.

---

## Business Process - Source of Truth

### Core hierarchy

- `Checklist / RFI / Inspection` is the parent record
- `Stages` inside the checklist are the real approval units
- `Checklist items` live inside each stage

### Approval logic

- Release Strategy defines the approval levels
- The release strategy applies to each stage
- Each stage must independently pass through all required approval levels
- If any stage is still pending at any level, the whole checklist remains `PARTIALLY_APPROVED`
- When all stages complete all required approval levels, the checklist automatically becomes `APPROVED`
- There should be no separate manual final approval action required once all stages are fully approved

### Stage progression

Example:

- Stage 1 -> Level 1 approver signs
- Stage 1 immediately moves to Level 2
- It must not wait for Stage 2
- Stage 2 can remain pending at Level 1 while Stage 1 is already at Level 2

So the pending approval is stage-specific, not only checklist-level.

### Higher-level auto-fill rule

If a higher-level approver approves a stage before a lower level has signed:

- the missing lower levels should be auto-filled in that higher approver's own name
- but only within the release strategy levels the backend allows
- if lower levels are already approved, keep the original lower-level signer names

### Observation rule

Observations inside QA/QC checklist approval must be linked to a stage.

- A stage cannot be approved while that stage has any open observation
- Observation must be closed first
- Open observations on Stage 2 must not block Stage 1 approval

### Auto final approval

Once all stages are approved at all levels:

- checklist status becomes `APPROVED`
- checklist locks
- no extra final-approve button should be needed

---

## Important Backend Reality to Respect

Claude must implement the mobile app to match these backend behaviors:

1. Stage-level approval matrix exists
- each stage can carry approval data per level
- stage approval details should be shown level-by-level

2. Pending approval display is now stage-driven
- users should see which stage is pending and at which approval level

3. Observations can now be linked to `stageId`
- mobile must send `inspectionId` and `stageId` while raising a QA/QC observation from a stage

4. Stage approval is blocked if that stage has unresolved observations

5. Checklist auto-approves after all stages clear all release-strategy levels

6. Approval access must remain bounded by backend permissions and release strategy
- mobile must not assume a user can approve just because a button is visible
- still call backend and use backend responses as final authority

---

## Mobile App Functional Requirements

### 1. Quality Request Menu

The Quality Request menu should let user:

- raise a QA/QC request / RFI
- view existing requests
- open request details
- see stage-by-stage progress
- see stage-level pending approval

For request detail:

- show checklist header
- show stage list
- show each stage's checklist items
- show stage-level approval matrix
- show stage observations

### 2. Quality Approval Menu

The Quality Approval menu should show:

- requests relevant to the logged-in user
- which stage is pending for the user
- which level is pending
- approval history per stage
- approved stages vs pending stages

Do not model approval as only one checklist-level step.

Instead show:

- `Stage A - Level 2 Pending`
- `Stage B - Approved`
- `Stage C - Level 1 Pending`

### 3. Stage card behavior

Each stage card must show:

- stage name
- checklist completion count
- stage-level approval matrix
- current pending level
- linked observations for that stage
- approve button only if allowed and stage is ready

Approve Stage button rules:

- enabled only when checklist items of that stage are complete
- disabled if stage has any non-closed observation
- disabled if stage is already fully approved
- disabled if backend permission / release strategy does not allow current user

### 4. Observation behavior

Inside each stage:

- show `Observations`
- allow raising observation linked to that stage
- allow rectification flow according to permissions
- allow closure according to permissions

Stage observation payload must include:

- `activityId`
- `inspectionId`
- `stageId`

Stage approval must refresh after observation close.

### 5. Approval matrix display

For every stage, mobile must show all approval levels.

Each level should show:

- level number
- level name
- signer name
- signer company
- signer role
- approved timestamp
- whether the approval was auto-inherited from higher level

If not approved:

- show `Pending`

### 6. Auto-finalization handling

Remove dependence on a separate `Final Approve` CTA for QA/QC checklist completion.

Instead:

- once last pending stage completes last required level
- refresh request detail
- show checklist `APPROVED`
- lock editing UI

### 7. Dashboard / queue behavior

The mobile Quality approval queue should prioritize:

- stage pending for my level
- stage pending for my role
- completed approvals by me
- fully approved requests

Do not show only checklist-level pending.

Use stage-driven labels like:

- `Precheck - Level 1 Pending`
- `During Construction - Level 2 Pending`

---

## Permissions and Access Rules

Claude must respect existing permission service and backend auth flow.

Important:

- temp/vendor users can approve only if:
  - they belong to the project
  - their temp role is part of the release strategy level
  - backend allows them

- permanent users can approve only if:
  - they are assigned to the project
  - their project role or user assignment matches the release strategy level

- stage action buttons must be hidden or disabled based on permission checks
- but backend response remains final authority

If backend returns insufficient permissions or blocked stage due to observations, show proper UI messaging.

---

## Suggested Flutter Implementation Areas

Update existing Quality mobile features instead of creating parallel flows.

Likely areas to update:

- Quality request list page
- Quality request detail page
- Quality approval list page
- Quality approval detail page
- existing BLoC / Cubit / Provider handling request details and approvals
- observation UI inside quality detail
- permission gating in quality pages
- API models for:
  - stage approval summary
  - stage approval levels
  - pending stage level
  - stage observations with `stageId`

---

## API / Data Expectations for Flutter

Claude should adapt Flutter models to support fields such as:

- `stageApproval`
  - `levels`
  - `pendingLevels`
  - `approvedLevelCount`
  - `requiredLevelCount`
  - `fullyApproved`
  - `pendingDisplay`

- request-level fields
  - `pendingApprovalDisplay`
  - `stageApprovalSummary`
  - `workflowSummary`

- observation fields
  - `inspectionId`
  - `stageId`
  - `status`
  - `closureText`
  - `closureEvidence`

Claude should inspect existing backend payloads and adapt Flutter models rather than hardcoding assumptions.

---

## UX Requirements

Keep the UI easy for site users and approvers.

### Request detail page

- collapsible stage cards
- clear pending badge per stage
- observation count per stage
- approval matrix visible but compact
- disable editing after full checklist approval

### Approval page

- stage-focused pending labels
- obvious approve CTA only where valid
- good feedback if blocked by open observation

### Messaging examples

- `Close all observations for this stage before approval.`
- `Stage approved at Level 1. Now pending at Level 2.`
- `Checklist fully approved.`
- `This stage is already approved and locked.`

---

## Non-Negotiable Rules

Claude must not:

- add a separate fake mobile-only workflow
- bypass release strategy
- bypass project-role or temp-user permission checks
- allow stage approval while stage observations are open
- require extra manual final approval after all stages are approved

Claude must:

- reuse existing Flutter architecture and navigation
- update existing Quality request and approval menus
- keep mobile aligned with backend truth
- make stage-level approval the main QA/QC flow

---

## Deliverables Expected From Claude

1. Update Flutter models for new QA/QC stage approval data
2. Update API layer for stage-linked observations and stage approval summaries
3. Update Quality Request UI
4. Update Quality Approval UI
5. Add stage-level pending labels
6. Add stage-level observation handling
7. Remove dependency on separate final-approve UX for checklist closure
8. Respect permission gating and temp/vendor user access
9. Keep code production-ready and consistent with existing Flutter patterns

---

## Instruction To Claude

Please inspect the existing Flutter Quality module implementation first, then update the current mobile pages and state management to implement the exact QA/QC checklist process described above. Reuse existing architecture, APIs, and permission handling. Do not create a separate parallel workflow model. The source of truth is:

- stage-driven release-strategy approvals
- stage-linked observations
- automatic final approval when all stages finish all levels

