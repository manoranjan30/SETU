# Task: Implement Quality Snag Module & Structure Builder

## Context
The user requires a comprehensive Quality Snag Module that supports:
1.  **Custom Structure Definition**: Ability to define Unit/Room templates and bulk-apply them to Project Floors (EPS).
2.  **Flexible Copying**: Deep copy of Floor structures (Units & Rooms) to multiple target floors.
3.  **Advanced Snag Workflow**:
    *   Snag Creation with Photos.
    *   De-snagging (Rectification) with Photos & Dates.
    *   Audit Log (History of status/photos).
4.  **EPS Integration**: Units and Rooms must be part of the EPS tree for consistency, but managed via Quality Module ease-of-use tools.

## Implementation Plan

### Phase 1: Backend Architecture (Data & Logic)

#### 1. Entity Updates
*   **update `QualitySnagList`**:
    *   Link to `EpsNode` (Location).
    *   Add `status` Enum (OPEN, RECTIFIED, CLOSED).
    *   Add `priority` Enum (LOW, MEDIUM, HIGH, CRITICAL).
    *   Add Dates: `dueDate`, `rectifiedDate`, `closedDate`.
    *   Add Audit Fields: `createdBy`, `rectifiedBy`, `closedBy`.
*   **create `QualitySnagPhoto`**:
    *   Columns: `id`, `snagId`, `url`, `type` (SNAG | RECTIFIED | CLOSED), `uploadedAt`, `uploadedBy`.
*   **create `QualityUnitTemplate`**:
    *   Columns: `id`, `name`, `projectId`, `structure` (JSON: `{ rooms: string[] }`).

#### 2. Service Logic
*   **`QualityStructureService`**:
    *   `createUnitTemplate(dto)`: Save template.
    *   `applyTemplate(floorIds[], templateId, startNum)`:
        *   For each Floor ID:
            *   Create Unit Nodes (e.g. 101, 102...) based on Template.
            *   Create Room Nodes under each Unit.
    *   `copyStructure(sourceNodeId, targetParentIds[], renamePattern)`:
        *   Deep clone the source node and all recursive children (Units, Rooms) to target parents.
*   **`QualitySnagService`**:
    *   `createSnag(dto, file)`: Create snag + initial photo.
    *   `rectifySnag(id, dto, file)`: Update status to RECTIFIED + upload photo.
    *   `closeSnag(id, dto)`: Verify and close.
    *   `getProjectSnags(projectId)`: Return snags with latest status.

### Phase 2: Frontend Implementation (UI/UX)

#### 1. Components
*   **`StructureManager`**:
    *   Tree View of Floors.
    *   "Define Template" Modal (Add Rooms to a Unit Type).
    *   "Bulk Create" Action (Select Floors -> Apply Template).
    *   "Copy Floor" Action (Select Source -> Select Targets -> Copy).
*   **`SnagList`**:
    *   DataTable with filters (Status, Location, Due Date).
    *   Status Badges with colors.
*   **`SnagForm`**:
    *   Location Selector (Cascading: Tower -> Floor -> Unit -> Room).
    *   Photo Upload (with Preview).
*   **`SnagDetail`**:
    *   Timeline View: Snag Created -> Rectified (with Photo) -> Closed.
    *   Action Buttons based on Role/Status.

#### 2. Pages
*   `QualitySnagPage`: Main dashboard.
*   `QualityConfigPage`: For managing Templates and Structure.

### Phase 3: Integration & Testing
*   Verify EPS nodes are created correctly.
*   Verify Snags link to these nodes.
*   Verify Photos are audit-trailed (Snag Photo vs Rectified Photo).

## Technical Details
- **EPS Type**: Extend `EpsNodeType` to include `UNIT`, `ROOM` (already verified).
- **Date Handling**: Strict enforcement. Rectified Date cannot be before Created Date.
- **Photos**: Store paths/URLs.

