# Implementation Plan: Quality Checklist-Driven Inspection Architecture

## 1. Domain Understanding & Overview
This plan outlines the complete overhaul of the Quality Inspection module to move from a direct Activity → Approval model to a robust **Checklist-Driven Inspection Architecture**. Key paradigm shifts include dropping the "NO" option in favor of "YES/NA", introducing a dedicated `ActivityObservation` entity distinct from project-wide NCRs, and strictly enforcing a state machine where an Activity cannot be approved until all associated checklist items are completed or marked NA, and any observations are resolved.

---

## 2. Database Schema & Entities (Phase 1)

### 2.1 Update `QualityActivity` Entity
- **Add Array Field:** `assignedChecklistIds` (UUID[]) to hold references to checklists.
- **Update Enum Status:** Change `status` to use the new state machine values:
  - `NOT_STARTED`
  - `RFI_RAISED`
  - `UNDER_INSPECTION`
  - `PENDING_OBSERVATION`
  - `APPROVED`
- **Fields Update:** Ensure `unitId` and `roomId` exist for granular location mapping.

### 2.2 Update `ChecklistItem` Entity
- **Update Enum:** `inputType` should now strictly map items to `YES_OR_NA`. Remove existing variations like `YES_NO` if applicable, and write a database migration to update existing records gracefully.

### 2.3 Create `ActivityObservation` Entity
- **Fields:**
  - `id`: UUID (Primary Key)
  - `activityId`: UUID (Foreign Key to QualityActivity)
  - `checklistId`: UUID (Nullable/Optional context pointer)
  - `inspectorId`: UUID (Foreign Key to User)
  - `observationText`: string (Mandatory)
  - `remarks`: string (Optional)
  - `photos`: string[] (Optional)
  - `status`: Enum (`PENDING`, `RESOLVED`)
  - `createdAt`: timestamp

### 2.4 Create `InspectionApproval` Entity / Audit Log (Digital Signature)
- **Fields:**
  - `activityId`: UUID
  - `inspectorName`: string
  - `digitalSignatureHash`: string
  - `approvedAt`: timestamp

---

## 3. Backend API Development (Phase 2)

### 3.1 Checklist Assignment Endpoint
- `POST /quality/activity/:id/assign-checklist`
  - **Payload:** `{ checklistIds: string[] }`
  - **Logic:** Validate checklists exist and are active. Update `QualityActivity.assignedChecklistIds`.

### 3.2 RFI Raising Endpoint
- `POST /quality/activity/:id/rfi`
  - **Logic:** Verifies that at least 1 checklist is assigned. Changes activity status to `RFI_RAISED`.

### 3.3 Inspection Submission Endpoint
- `POST /quality/activity/:id/inspection`
  - **Payload:**
    ```json
    {
      "checklistResults": [
        { "itemId": "uuid", "status": "YES" | "NOT_APPLICABLE" }
      ]
    }
    ```
  - **Logic:** Performs UPSERT on checklist results. Transitions status to `UNDER_INSPECTION`. Does **not** auto-approve.

### 3.4 Observation Endpoints
- `POST /quality/activity/:id/observation`
  - **Payload:** `{ observationText, photos, remarks, checklistId }`
  - **Logic:** Creates `ActivityObservation` record. Changes status to `PENDING_OBSERVATION`.
- `PATCH /quality/activity/:id/observation/:obsId/resolve`
  - **Logic:** Marks observation as `RESOLVED`. If all resolved, transitions status back to `RFI_RAISED` or `UNDER_INSPECTION`.

### 3.5 Approval & Locking Endpoint
- `POST /quality/activity/:id/approve`
  - **Validation logic:**
    - Are ALL mapped checklist items for this activity answered with YES/NA? (Throws 400 if FALSE)
    - Are there ANY unresolved `ActivityObservation`s? (Throws 400 if TRUE)
  - **Execution:** Generates `InspectionApproval` hash, locks checklists to read-only, sets activity status to `APPROVED`.

---

## 4. Frontend Application Workflow (Phase 3)

### 4.1 Activity Management Screen
- **UI Element:** Add a "Checklist Assignment" multi-select dropdown to the Quality Activity card/modal.
- **RFI Button:** Disable the "Raise RFI" button if `assignedChecklistIds.length === 0`.

### 4.2 Inspection Execution Screen
- **Header:** Display Project, Unit, Room, Activity Name, and RFI Number.
- **Checklist Render:** Iterate through `assignedChecklistIds` and fetch items. Each row should feature strictly constrained toggle buttons: `[ YES ] [ N/A ]`.
  - Removed 'NO' inputs/logic entirely.
- **Validation State Tracker:** Compute locally if all items are filled. Drive UI states off this validation (e.g., enable/disable 'Approve' button).

### 4.3 Observation Modal
- **Trigger:** "Keep Pending with Observation" button.
- **Form:** Textarea for observation (mandatory), photo upload component, remarks field.
- **Submission:** On success, close modal and redirect to Activity Dashboard with status `PENDING_OBSERVATION`.

### 4.4 Final Approval Action
- **Trigger:** Verify local completeness constraint. Call `/approve`.
- **Digital Signature Flow:** Generate lock visual (mimicking what is currently in `QualityInspection.tsx` digitally signed hash UI).
- **Read-only Mode:** If `status === 'APPROVED'`, disable all toggles and observation buttons.

---

## 5. Migration & Deployment Strategy (Phase 4)
- **Database Migration:** Provide SQL scripts to add new entities and replace `YES_NO` enums with `YES_OR_NA`. Migrate old data explicitly pointing existing `YES` to `YES`, and old `NO` will need to be categorized (potentially moving to `NA` with an observation note, to be discussed).
- **Permissions Registration:** Ensure new endpoints are decorated securely (`@Permissions('QUALITY.INSPECTION.EXECUTE')`).
- **Tests (AAA Pattern):** 
  - *Unit:* Test state machine transitions in the service layer.
  - *Integration:* Trigger validation failure scenarios for `/approve` when items are unchecked or observations act as blockers.
