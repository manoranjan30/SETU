# Project Lifecycle Closeout Plan

## Requirement

When a project reaches closeout, it should move out of active lists while remaining available in history/reporting views.

## Current State

Observed:

- executive dashboard already filters `completed`, `closed`, `archived`
- project status lives on `ProjectProfile.projectStatus`
- filtering is not centralized across the stack

## Gaps

1. Active/closed logic is repeated or absent
2. Dashboards, selectors, and operational lists may diverge
3. No single helper defines “active project”

## Solution

### Shared lifecycle helper

Add one shared backend helper:

- `isOperationalProjectStatus(status)`

Treat these as non-active:

- `COMPLETED`
- `CLOSED`
- `ARCHIVED`
- optional future `CLOSEOUT`

### Backend scope updates

Apply to:

- executive dashboard project options
- portfolio summaries
- active project list endpoints
- pending task project scope lists
- approval routing helpers where relevant

### Frontend scope updates

Apply to:

- project dropdowns
- executive dashboard selectors
- sidebar active project lists
- any project switchers for operational modules

### Visibility rule

- closed projects stay visible in:
  - audit/history
  - portfolio reporting
  - dashboards when filtered intentionally
- closed projects disappear from:
  - default active selectors
  - current working project lists

## Verification

- closed projects disappear from active lists
- closed projects remain accessible by explicit reporting/history filters
- no permission regressions for archived project access

