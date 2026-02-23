# Implement RFI Generation and Approval Separation

## Context
The RFI (Request for Inspection) module currently mixes the Requester (raising the request) and Approver (reviewing and signing off) interfaces into standard unified views (`QualityInspection.tsx` and `InspectionRequestPage.tsx`). As per the project requirements and role-based access control, these two functions must be isolated. Additionally, Approvers must mandatorily complete an associated checklist (tick all checklist items) before they are allowed to approve the RFI.

## Objectives
1. **Separate Routes and Interfaces:** Create distinct UI pages and routes for Requesters (`/quality/requests`) and Approvers (`/quality/approvals`).
2. **Mandatory Checklist Execution:** 
   - Tie RFIs to `QualityChecklistTemplate` (via `QualityActivity`).
   - Implement an interactive checklist panel for Approvers to tick off line items.
   - Enforce a rule where an RFI cannot be Approved unless the entire checklist is verified and completed.
3. **Role-Based Redirection:** Ensure navigation links conditionally display based on the user's role/permissions.

---

## 🏗 Implementation Phases

### Phase 1: Backend Data Model & Logic Upgrades

**1. Update `QualityInspection` Entity:**
Currently, `QualityInspection` links to `QualityActivity`. Since `QualityActivity` has a `checklistTemplateId`, we can create a concrete `QualityChecklist` execution record when an RFI is generated, or dynamically load the template during the approval phase.
- Add an `executionState` JSON column to `QualityInspection` (or create a dedicated `QualityInspectionChecklist` entity) where the state of each item (checked/remarks) during the approval process is persisted.

**2. Update `QualityInspectionService`:**
- **Approve Endpoint (`updateStatus`):** Add validation logic to block `APPROVED` status if the underlying checklist is incomplete. It should verify `checklistTemplateId` from `activity`, read the required items, and compare them with the saved checking state.
- **Save Checklist Progress:** Create an endpoint to save partial checklist execution progress (e.g. `PATCH /quality-inspections/:id/checklist`).

### Phase 2: Frontend Route Separation and Refactoring

**1. Define New Routes in `App.tsx` / Router:**
- Replace or split the current `/quality/inspections` route.
- Implement `/quality/requests` (My Requests).
- Implement `/quality/approvals` (Pending Approvals).

**2. Implement `<RequesterRequestsPage />`:**
- Extract the RFI creation UI from the old components.
- Display EPS Nodes and Activity Lists.
- Show a simple list of "My Requested RFIs" with statuses.
- **Action:** "Raise RFI" button.

**3. Implement `<ApproverDashboardPage />`:**
- Create a master-detail split layout.
- **Left Panel:** List of Pending RFIs waiting for approval, filterable by date and EPS node.
- **Right Panel:** The Inspection Execution Workspace.

### Phase 3: Checklist Execution UI for Approvers

**1. Create `<ChecklistExecutionPanel />` Component:**
- When an RFI is selected in the Approver Dashboard, fetch the RFI details and the linked `QualityChecklistTemplate` (with stages and template items).
- Render checkboxes for every line item.
- Provide a "Save Progress" button to patch the intermediate state back to the server.

**2. Tie Checkboxes to the Approval Action:**
- The "Approve Request" button in the execution panel will be disabled by default.
- It becomes active *only* when the UI validates that every single checklist item has been marked as `checked`.

### Phase 4: Integration and Cleanup

1. Verify `permissions.module.ts` or RBAC tokens enforce `/quality/approvals` access.
2. Update the main Navigation Menu (sidebar) to render "My Requests" and "Approvals" dynamically based on the current user's profile.
3. Remove redundant mixed-mode UI logic from the legacy `QualityInspection.tsx`.

---

## Technical Considerations & Edge Cases
- **Missing Templates:** If a `QualityActivity` has no `checklistTemplateId`, does it auto-approve, or throw an error? Requirement: Probably throw a warning forcing the assignment of a template before raising.
- **Partial Rejections:** Can an approver reject a specific line item? If they do, the whole RFI should theoretically be marked "REJECTED". The UI should handle sending the "Remarks/Reasons" back.
- **Progress Saving:** Ensure auto-save or obvious manual save buttons so Approvers don't lose data on a 100-item checklist if the browser refreshes.

## Next Steps
Trigger an agent in `edit` mode (e.g. `backend-specialist` then `frontend-specialist`) to begin executing Phase 1 and Phase 2.
