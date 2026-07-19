# Pour Card And Pre-Pour Clearance Mobile Handoff

## Scope

Update Flutter Quality RFI/checklist approval screens to use the backend-owned
card gate rules for:

- Pre-pour clearance card activation.
- Pour card activation.
- Checklist stage approval blocking.
- Final checklist approval blocking.

Backend now enforces these rules. Mobile should use the returned summary fields
to show/hide cards, disable approval actions, and display blocker messages.

## Activity Configuration

Quality activity responses can include:

```json
{
  "requiresPourCard": true,
  "requiresPourClearanceCard": true,
  "pourClearanceTriggerStageTemplateId": 12,
  "prePourClearanceApprovalRequirement": "SUBMITTED",
  "pourCardTriggerStageTemplateId": 14
}
```

`pourCardTriggerStageTemplateId` is optional. If null and `requiresPourCard` is
true, the pour card is active immediately.

Pre-pour clearance is active only after
`pourClearanceTriggerStageTemplateId` is fully approved.

`prePourClearanceApprovalRequirement` controls the gate after the pre-pour
clearance card becomes active:

- `SUBMITTED`: later checklist approvals can continue after the clearance card
  is submitted.
- `APPROVED`: later checklist approvals must wait until the clearance card is
  formally approved.

Default to `SUBMITTED` when the field is absent.

## Inspection Detail/List Contract

`GET /api/quality/inspections` and
`GET /api/quality/inspections/{inspectionId}` include:

```json
{
  "stageApprovalSummary": {
    "pourClearanceTriggerStageTemplateId": 12,
    "pourClearanceTriggerStageName": "Reinforcement",
    "pourClearanceTriggerApproved": true,
    "pourCardTriggerStageTemplateId": 14,
    "pourCardTriggerStageName": "Pre Pour Checks",
    "pourCardTriggerApproved": true
  },
  "cardSummary": {
    "requiresPourCard": true,
    "requiresPrePourClearance": true,
    "pourCardStatus": "SUBMITTED",
    "pourCardSubmitted": true,
    "pourCardApproved": false,
    "pourCardTriggerStageTemplateId": 14,
    "pourCardTriggerStageName": "Pre Pour Checks",
    "pourCardTriggerApproved": true,
    "pourCardActive": true,
    "pourCardActivationMode": "AFTER_STAGE",
    "prePourClearanceStatus": "APPROVED",
    "prePourClearanceSubmitted": true,
    "prePourClearanceApproved": true,
    "prePourClearanceApprovalRequirement": "SUBMITTED",
    "prePourClearanceGateSatisfied": true,
    "prePourClearanceTriggerStageTemplateId": 12,
    "prePourClearanceTriggerStageName": "Reinforcement",
    "prePourClearanceTriggerApproved": true,
    "prePourClearanceActive": true,
    "stageApprovalBlockers": [],
    "finalApprovalBlockers": [
      "Pour card approval is required before final checklist approval."
    ],
    "approvalBlockersByStageId": {
      "101": [],
      "102": [
        "Pour card submission is required before approving this stage."
      ]
    }
  }
}
```

## Mobile UI Rules

- Show Pre-pour Clearance only when `cardSummary.prePourClearanceActive == true`.
- Show Pour Card when `cardSummary.pourCardActive == true`.
- If Pour Card is enabled and `pourCardActivationMode == "IMMEDIATE"`, show it
  as soon as the RFI/checklist detail opens.
- If a card is not active yet, show a compact locked hint using the trigger name.

Example:

```text
Pour Card available after: Pre Pour Checks
Pre-pour Clearance available after: Reinforcement
```

## Stage Approval Blocking

Before enabling an approve button for a stage:

1. Read `cardSummary.approvalBlockersByStageId[stage.id]`.
2. If the array is non-empty, disable approval.
3. Show the blocker messages above the approval button.

Backend will also reject invalid approval attempts, so always display backend
error messages if a stale mobile screen attempts approval.

## Final Approval Blocking

Before enabling final checklist approval:

1. Read `cardSummary.finalApprovalBlockers`.
2. If non-empty, disable final approval.
3. Show the returned blocker messages.

Important rule:

- Pour Card submitted is enough for intermediate stage approvals.
- Pour Card approved is required for the last checklist stage and final
  checklist approval.
- Pre-pour clearance blocking is activity-configurable:
  `SUBMITTED` means submission is enough; `APPROVED` means formal approval is
  required.

## My Pending

Keep using the existing higher-level takeover behavior for my-pending and
pending approval lists. Backend blockers in `cardSummary` remain the source of
truth for whether the current user can approve a stage.

## Refresh Rules

Refresh inspection detail after:

- Pre-pour clearance save/submit/approve/reject.
- Pour card save/submit/approve/reject.
- Any checklist stage approval.
- Final checklist approval.

## Acceptance

- Pour Card can be configured to show immediately or after a selected stage.
- Pre-pour clearance shows only after its selected activation stage is approved.
- Later stages after activation show backend blocker messages until required
  card submission or approval is done, depending on
  `prePourClearanceApprovalRequirement`.
- Last checklist stage and final approval remain blocked until Pour Card is
  approved.
- Mobile never relies only on local calculations; backend `cardSummary` is the
  source of truth.
