# Progress Approval System Implementation Plan

## 1. Executive Summary
This document outlines the implementation of a "Maker-Checker" workflow for site progress reporting. Site engineers will submit progress updates which remain in a `PENDING` state until reviewed by a Project Manager or Admin. A dedicated **Approvals Dashboard** will allow managers to bulk review, edit, and approve these entries.

---

## 2. Database Schema Changes

We will modify the existing `execution_progress` (or equivalent) entity to support the approval workflow.

### 2.1 Entity: `DailyProgress` (or `ExecutionEntry`)
*   **Column**: `status` (Enum: `'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'DRAFT'`)
    *   *Default*: `'PENDING'` (for standard users), `'APPROVED'` (for Admins/PMs if self-approving).
*   **Column**: `reviewedBy` (String/User ID, Nullable)
*   **Column**: `reviewedAt` (Timestamp, Nullable)
*   **Column**: `rejectionReason` (Text, Nullable) - To store feedback when rejecting.
*   **Column**: `submissionNote` (Text, Nullable) - Optional note from Site Engineer.

### 2.2 Data Migration
*   Create a migration script to set `status = 'APPROVED'` for all *existing* records to avoid breaking historical data.

---

## 3. Backend Logic Updates

### 3.1 Progress Calculation Logic
*   **Schedule Update**: The logic that updates the "Actual %" and "Finish Date" of linked Schedule Activities must **ONLY** consider records where `status = 'APPROVED'`.
*   **Balance Quantity**: The logic calculating "Remaining Qty" for BOQ items must sum:
    *   `Approved Quantities` (Confirmed Consumption)
    *   `Pending Quantities` (To prevent duplicate entry/over-reporting while pending).
    *   *Ignored*: `Rejected Quantities`.

### 3.2 API Endpoints
*   `GET /execution/project/:id/pending`: Fetch all pending entries for a project. Returns joined data (Activity Name, BOQ Item, Contractor, User, Date).
*   `POST /execution/approve`: Bulk approve endpoint. Accepts array of IDs. Triggers schedule recalculation.
*   `POST /execution/reject`: Bulk reject endpoint. Accepts IDs and a `reason`.
*   `PUT /execution/entry/:id`: Update entry (Edit quantity/date) *and* optionally change status (e.g., Edit & Approve).

---

## 4. Frontend Implementation

### 4.1 New Menu Item
*   Add **"Approvals"** (Icon: `CheckSquare`) under the **Site Execution** module in `MENU_CONFIG`.
*   Visible only to users with `EXECUTION_APPROVE` permission.

### 4.2 Approvals Dashboard (`ApprovalPage.tsx`)
*   **KPI Cards**: "Pending Requests", "Total Value Waiting", "Oldest Request".
*   **Data Grid**:
    *   **Columns**: Date, Activity Code, Description, Location, Contractor, Quantity, Unit, Submitted By.
    *   **Inline Actions**: "Approve" (Green Tick), "Reject" (Red Cross), "Edit" (Pencil).
    *   **Bulk Actions**: Select multiple -> "Approve Selected".
*   **Edit Modal**: Allow PM to correct a wrong quantity (e.g., Engineer entered 100, actual is 90) and Approve immediately.

### 4.3 Notification / Alert
*   Add a visual indicator (Red Badge) to the "Site Execution" and "Approvals" menu items showing the count of pending requests.

---

## 5. Development Steps

1.  **Backend**: Modify Entity & DTOs.
2.  **Backend**: Create Migration (Update existing data).
3.  **Backend**: Update `ProgressService` calculation logic (Filter by Status).
4.  **Backend**: Implement Approval/Rejection API endpoints.
5.  **Frontend**: Create `ApprovalPage` component.
6.  **Frontend**: Integrate API and add Bulk Actions.
7.  **Frontend**: Add Sidebar Badge logic.
