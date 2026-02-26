# Quality Module Enhancements: Implementation Plan

## Overview
This document outlines the detailed implementation plan to enhance the Quality Module based on user feedback. The core focus areas are improving the UX for photo viewing (in-app modal), unifying the observation lifecycle view (issue vs. resolution), enhancing the "All RFIs" read-only view with observation history, and introducing granular Stage-by-Stage approvals leading to a final PDF sign-off.

---

## Part 1: Improved Photo Viewing Experience (In-App Modal)
**Goal:** Prevent photos from opening in a new browser tab/window. Instead, display them in an overlay popup within the app, complete with a close button and potentially navigation (next/prev).

### Frontend Tasks:
1. **Create `ImageModal` Component:**
   * **Location:** `frontend/src/components/common/ImageModal.tsx`
   * **Props:** `isOpen`, `imageUrl`, `onClose`, `altText`.
   * **UI/UX:** A full-screen dark overlay with a centered image container. Must include a clear 'X' close button in the top right. Should handle clicks outside the image to close.
2. **Integrate Modal in `InspectionRequestPage`:**
   * Replace `target="_blank"` anchor tags around observation and closure photos with click handlers that set the selected image URL and open the `ImageModal`.
3. **Integrate Modal in `QualityApprovalsPage`:**
   * Same as above. Ensure all instances of `href={getFileUrl(url)}` are replaced with modal triggers.

---

## Part 2: Unified Observation Lifecycle View
**Goal:** In the "Observation Log", clearly display the raised observation photo(s) directly alongside the corresponding rectification photo(s) for easy "Before & After" comparison.

### Frontend Tasks:
1. **Redesign Observation Card (`QualityApprovalsPage.tsx` & `InspectionRequestPage.tsx`):**
   * Change the layout of the individual observation item to a split-view or clearly delineated sections if space is tight.
   * **Section A (Issue):** Display `observationText`, `type`, timestamp, and the **Issue Evidence photos**.
   * **Section B (Resolution):** Conditionally render if status is `RECTIFIED` or `CLOSED`. Display `closureText` and the **Rectification Evidence photos** immediately adjacent to or directly beneath Section A.
2. **Consistent Styling:** Ensure consistent use of borders (e.g., standard for issue, blue/green for resolution) to visually distinguish the two phases.

---

## Part 3: Enhanced "All RFIs" View
**Goal:** When viewing a closed or historically processed RFI in the "All RFIs" list, users should be able to see the complete history of observations raised and how they were closed, providing full traceability.

### Backend Tasks:
1. **Extend Inspection Details Endpoint:**
   * Ensure the endpoint that serves inspection details (`GET /quality/inspections/:id`) also returns associated observations, or fetch them concurrently on the frontend.
   * *Current State Check:* Currently, observations are tied to `activityId`. The frontend fetches them separately. This is fine, but we must ensure we fetch 'All' observations for the activity, not just 'Pending' ones when in the "All RFIs" view.

### Frontend Tasks:
1. **`QualityApprovalsPage.tsx` Updates for "All RFIs" mode:**
   * **Conditional UI:** Ensure the "Save Progress", "Reject", "Provisional Approval", and "Final Approve" buttons are hidden when the inspection is not `PENDING`.
   * **Display Observations Inline:** Instead of requiring a click to open the Observation Modal, consider displaying a read-only list of all observations (with their Before/After photos as per Part 2) beneath the checklist stages for completed RFIs.
   * **Alternatively:** Keep the "Observations" button, but make it clearly visible and accessible even for closed RFIs, opening the newly designed unified view modal in a read-only state.

---

## Part 4: Stage-by-Stage Approval & Partial Approval Status
**Goal:** Allow users to approve an RFI incrementally (stage by stage). For example, approving the "Pre-check" stage transitions the RFI status to "Partially Approved". Final approval closes the RFI.

### Backend Tasks:
1. **Update Inspection Status Enum (`QualityInspection.status`):**
   * Add `PARTIALLY_APPROVED` to the `<InspectionStatus>` enum.
2. **Modify `updateStageStatus` Endpoint (`quality-inspection.service.ts`):**
   * When a stage status is updated to `APPROVED` or `COMPLETED`:
     * Check the status of *all* stages for that inspection.
     * If *some* (but not all) stages are completed/approved, update the parent Inspection status to `PARTIALLY_APPROVED`.
     * If *all* stages are completed/approved, update the parent Inspection status to `APPROVED`.
3. **Validation Logic:** Ensure `PARTIALLY_APPROVED` RFIs cannot be fully closed until all stages report a `COMPLETED` or `APPROVED` status.

### Frontend Tasks:
1. **Add Stage-Level Action Buttons (`QualityApprovalsPage.tsx`):**
   * In the checklist area, for each Stage container, add an "Approve Stage" button.
   * **Logic:** This button calls `updateStageStatus` with `status: 'APPROVED'`. It should only be enabled if all items within *that specific stage* are marked as `isOk`.
2. **Update Status Badge Logic:** Add a distinct visual style (e.g., light blue pill) for the `PARTIALLY_APPROVED` status across all list views.
3. **Remove "Final Approve" Button Dependency (Optional):** If the backend automatically sets the inspection to `APPROVED` when the final stage is approved, the main "Final Approve" button might become redundant, replaced by the stage-level buttons. Determine the best UX flow here (e.g., keep Final Approve as a final confirmation step after all stages are green).

---

## Part 5: Final Sign-off PDF Generation
**Goal:** Upon final approval, generate a comprehensive PDF document detailing the RFI, the completed checklist, who approved which stage, and the full list of observations with their resolutions.

### Backend Tasks:
1. **Create `PdfGenerationService` (or utilize existing tools/services):**
   * *Note: The `docker-compose.yml` indicates a `pdf-tool` service exists. We should utilize this if capable, or build a standard NestJS PDF generator using a library like `puppeteer` or `pdfkit`.*
   * **Payload Construction:** Create a function to gather all required data:
     * RFI Header details (Project, Location, Activity Name, Dates).
     * Checklist Data (Stages, Items, 'isOk' status, Remarks).
     * Stage Approvers (Who approved each stage, timestamps).
     * Observation History (Issue text, type, Rectification text, timestamps).
2. **Trigger PDF Generation:**
   * Link the final approval transition (`updateStatus` to `APPROVED`) to trigger the PDF generation.
   * Save the resulting PDF file (either locally in `uploads/` or a dedicated `reports/` folder).
   * Save the PDF path in the database (e.g., add a `reportPath` string column to the `QualityInspection` entity).
3. **Endpoint to Serve PDF:** Create a new endpoint `GET /quality/inspections/:id/report` to download or view the generated PDF.

### Frontend Tasks:
1. **Download Report Button (`QualityApprovalsPage.tsx`):**
   * In the "All RFIs" view, if an RFI is `APPROVED`, display a prominent "Download PDF Report" button.
   * Connect this button to the new backend endpoint to trigger the download or open the PDF in the browser.
