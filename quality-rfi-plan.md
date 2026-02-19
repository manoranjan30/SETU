# Quality Module — Request for Inspection (RFI) Plan

## Phase 4: Request for Inspection Management

### 1. Backend Changes

#### 1.1 Update `QualityInspection` Entity
- [ ] Rename/Refactor existing `QualityInspection` or create a new one if it's too different.
- [ ] Add relations:
    - `activityId` (FK -> `QualityActivity`)
    - `listId` (FK -> `QualityActivityList`)
    - `epsNodeId` (FK -> `EpsNode`) - The specific location of inspection
- [ ] Add fields:
    - `status`: 'PENDING', 'APPROVED', 'REJECTED', 'CANCELED'
    - `requestDate`: Date
    - `inspectionDate`: Date (nullable)
    - `inspectedBy`: User ID (nullable)
    - `comments`: Text
    - `sequence`: Copy of activity sequence for sorting

#### 1.2 Service Logic (`QualityInspectionService`)
- [ ] `raiseInspection(dto)`:
    - **Validation**:
        1. Check if an open RFI already exists for this (Activity + EPS Node).
        2. Check Predecessor:
            - Find the `previousActivityId` from the `QualityActivity` definition.
            - If one exists:
                - Find the *latest* RFI for that predecessor at this *same* EPS Node.
                - If no RFI found OR status != 'APPROVED':
                    - Check `allowBreak` flag on current activity.
                    - If `allowBreak` is false -> **THROW ERROR** (Sequence violation).
    - **Create**: Insert new `QualityInspection` record with status 'PENDING'.

- [ ] `updateStatus(id, status, comments)`:
    - Approve/Reject logic.
    - If Rejected, allow a new RFI to be raised for the same activity later? (Yes, usually re-inspection).

- [ ] `getInspections(projectId, epsNodeId?, listId?)`:
    - Return list of inspections.
    - crucial for the frontend to know the "Current State" of the checklist.

### 2. Frontend Changes

#### 2.1 API Integration
- [ ] Add `api.get('/quality/inspections?...')`
- [ ] Add `api.post('/quality/inspections')` (Raise RFI)
- [ ] Add `api.patch('/quality/inspections/:id')` (Approve/Reject)

#### 2.2 RFI Management Page (`InspectionRequestPage`)
- [ ] **Selection Area**:
    - Select EPS Node (Location) - e.g., "Tower A > Floor 1".
    - Select Activity List - e.g., "Slab Cycle".
- [ ] **Checklist View** (The Core UI):
    - Render the `QualityActivityList` items in sequence.
    - For each item, determing its **State** based on existing RFIs:
        - `LOCKED`: Predecessor not done.
        - `READY`: Predecessor done, no RFI yet.
        - `PENDING`: RFI raised, waiting.
        - `APPROVED`: Done.
        - `REJECTED`: Needs re-work/re-request.
    - **Actions**:
        - "Request Inspection" button (only for READY or REJECTED state).
        - "Approve/Reject" buttons (visible to Admin/QC role - for now just toggle for demo).

#### 2.3 Route & Sidebar
- [ ] Add `/dashboard/projects/:projectId/quality/inspections`
- [ ] Add sidebar item "Site Inspections".

## 3. Implementation Steps

1. **Backend Entity**: `QualityInspection` (Update)
2. **Backend Service**: Validations & CRUD.
3. **Backend Controller**: Endpoints.
4. **Frontend**: Page & Logic.
