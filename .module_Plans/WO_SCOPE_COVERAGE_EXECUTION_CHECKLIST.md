# WO Scope Coverage Execution Checklist

## Database Migration Tasks
- Add WO scope coverage columns to `work_order_items`
  - `issueScopeMode`
  - `originalBoqQty`
  - `originalBoqRate`
  - `issuedScopeSummary`
  - `pendingScopeSummary`
  - `creepScopeSummary`
  - `scopeCreepReason`
  - `issuedScopeComponents`
  - `pendingScopeComponents`
  - `creepScopeComponents`
  - `hasPendingScope`
  - `vendorOnboardStatus`
- Backfill existing WO items to `FULL_SCOPE`
- Backfill `originalBoqQty` from `boqQty`
- Backfill `originalBoqRate` from `rate`

## API Endpoint List
- `GET /workdoc/:projectId/available-boq-qty`
  - now returns BOQ rows with `hasPendingScope` and `eligibleForAdd`
- `GET /workdoc/:projectId/pending-vendor-board`
  - returns `QTY_PENDING`, `SCOPE_PENDING`, `CREEP_PENDING`
- `POST /workdoc/:projectId/confirm`
  - accepts reviewed BOQ-to-WO scope payload
- `POST /workdoc/work-orders/:woId/add-boq-items`
  - accepts reviewed BOQ add payload for amendments
- `POST /workdoc/work-orders/:woId/update`
  - accepts qty/rate and scope mode updates for existing WO lines

## Frontend Component List
- `frontend/src/components/workdoc/BoqSelectModal.tsx`
  - selection from BOQ balance or pending scope
- `frontend/src/components/workdoc/BoqAllocationReviewModal.tsx`
  - review qty/rate and full/split/creep scope before add
- `frontend/src/components/workdoc/WorkOrderEditModal.tsx`
  - amend WO and add BOQ items through review flow
- `frontend/src/components/workdoc/WorkOrderManualEntryModal.tsx`
  - BOQ import path updated to use review flow
- `frontend/src/components/workdoc/PendingVendorBoard.tsx`
  - pending onboarding tabs and scope visibility
- `frontend/src/components/workdoc/WorkDocManager.tsx`
  - Vendor On Board and Pending Vendor On Board tabs
- `frontend/src/components/planning/mapper/ScheduleTreePanel.tsx`
  - smart schedule tree search/hide/session memory

## Acceptance Criteria By Screen

### BOQ Select Modal
- Shows only BOQ rows with quantity balance or pending scope by default
- Can optionally reveal fully covered rows
- Clearly indicates rows with pending scope

### BOQ Allocation Review Modal
- Defaults every row to `Full Scope`
- Allows WO qty and WO rate editing before add
- Allows explicit `Split Scope` with pending scope details
- Allows explicit `Scope Creep` with reason/details

### Work Order Edit / Amend
- `Add From BOQ` opens selection then review flow
- Existing measurement-linked WO qty cannot exceed BOQ balance
- Scope type and pending/creep text can be amended on WO lines

### Work Order Manual Entry
- BOQ-imported lines go through the same review flow
- Full scope remains the default with no extra work for users

### Pending Vendor On Board
- Has tabs for `All Pending`, `Qty Pending`, `Scope Pending`, `Creep Pending`
- Shows why an item is still pending even if qty is already issued
- Shows issued scope and remaining/pending scope clearly

### WO Qty Mapper
- Search keeps parent context visible
- User can hide noisy branches
- Hidden and expanded state survive during the session
- `Clear Hidden` restores the full tree quickly
