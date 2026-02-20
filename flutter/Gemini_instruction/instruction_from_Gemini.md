# Mobile App Development Plan: Site Level Progress & Navigation

> **Context:** This document outlines the implementation plan to enable "Site Level" progress updates in the SETU mobile application. The current implementation lists all project activities in a flat list, which is inefficient for site engineers. We need to implement a hierarchical navigation flow (Project -> Zone -> Floor -> Activities) to match the physical execution workflow.

---

## 1. System Overview

### **Backend Architecture (NestJS)**
- **Framework:** NestJS with TypeORM and PostgreSQL.
- **Key Entities:**
  - `Project` (Root container)
  - `EpsNode` (Hierarchical structure: Towers, Zones, Floors)
  - **Data Structure:** `EpsNode` has a self-referencing `children` relation.
  - `Activity` (The actual task to be executed, linked to an `epsNodeId`)
  - `ProgressEntry` (Records quantity updates against an Activity)
- **Current Capabilities:**
  - **EPS/Projects:** Can serve project details and EPS hierarchy.
  - **Activities:** Can serve activities linked to a project (`/planning/projects/:id/activities`).
  - **Progress:** supports recording numeric progress.
- **Limitations:**
  - **Photo Uploads:** **POSTPONE.** API endpoint exists but is not priority. Focus on navigation.

### **Mobile Architecture (Flutter)**
- **Architecture:** Clean Architecture (Presentation, Domain, Data).
- **State Management:** BLoC pattern (`ProjectBloc`, `ProgressBloc`).
- **Offline Storage:** Drift Database (SQLite).
- **Current State:**
  - `ProjectsListPage` loads projects.
  - Clicking a project loads **ALL** activities (Flat List). **(TO BE CHANGED)**

---

## 2. The Problem: "Flat List" vs. "Site Logic"

Currently, the app fetches **every single activity** for a project and displays them in one list.
- **Issue:** A site engineer on "Tower A, 2nd Floor" has to scroll through thousands of activities to find their tasks.
- **Requirement:** Work happens at a specific **Location** (EPS Node). The app must reflect this.

---

## 3. The Solution: Hierarchical Navigation

Refactor the navigation flow to allow drill-down:
`Project Selection` -> `EPS Level 1 (e.g., Towers)` -> `EPS Level 2 (e.g., Floors)` -> ... -> `Activity List (Filtered by EPS)`

### **New Workflow**
1.  **Projects List:** User selects a Project.
2.  **EPS Explorer (New Page):**
    - **Logic:** Checks if the selected node has children nodes.
    - **UI:** Displays a list of **Folders** (e.g., "Tower A", "Tower B").
    - **Action:** User taps a folder to drill down deeper.
3.  **Leaf Node View:**
    - **Logic:** When a node has no children (or user decides to view tasks for this level).
    - **UI:** Displays the list of **Activities** linked specifically to this EPS Node.
    - **Action:** User taps an activity to open `ProgressEntryPage`.

---

## 4. Detailed UI/UX Specifications

### **A. Visual Design & Layout**

#### 1. The Breadcrumb Navigation (Top Bar)
- **Placement:** Sticky at the top, just below the AppBar.
- **Content:** Shows the path: `Project Name > Tower A > Level 1`.
- **Interaction:** Tapping a previous item in the path navigates back to that level.
- **Style:** Scrollable horizontally, small text, primary color for current level.

#### 2. The List View (Folder & Activity Mix)
- **Folder Items (EPS Nodes):**
  - **Icon:** 📁 (`Icons.folder`, Amber/Gold color).
  - **Title:** EPS Node Name (e.g., "Tower A").
  - **Subtitle:** "3 Sub-zones, 15 Activities".
  - **Trailing:** Chevron Right (`Icons.chevron_right`).
  - **Behavior:** Tapping pushes a new `EpsExplorerPage` onto the stack with this node as root.

- **Activity Items (Tasks):**
  - **Icon:** 📋 (`Icons.assignment`, Primary Blue color).
  - **Title:** Activity Name (e.g., "Block Work").
  - **Subtitle:** Progress Bar + "% Complete".
  - **Status Pill:** Small chip showing "In Progress" (Blue) or "Completed" (Green).
  - **Behavior:** Tapping navigates to standard `ProgressEntryPage`.

### **B. Behavioral Requirements**

- **Drill Down:** User must feel like they are "entering" a location. Transitions should be smooth (standard SlideRight).
- **Back Navigation:**
  - Hardware Back / AppBar Back: Goes UP one level in the EPS hierarchy.
  - Long Press Back: Returns to Project List.
- **Empty States:**
  - If a folder has no children AND no activities: Show "No work packages defined for this location."
  - If loading: Show `SkeletonListTile` (shimmer effect).

---

## 5. Technical Data Handling

### **A. Data Models & Relations**
- **Project Structure:**
  - The `Project` model already contains `children: List<EpsNode>`.
  - **CRITICAL:** Ensure `EpsNode` allows nested `children`.
- **Activity Mapping:**
  - `Activity` model has `epsNodeId`.
  - **Filtering:** The UI must filter activities locally or request them by ID.
  - *Efficient Approach:* Fetch all activities for the Project ONCE (background), index them by `epsNodeId` in a Map/Hash, and query this local cache when opening a folder.

### **B. State Management (`ProjectBloc`)**
We need to manage the "Current Scope".

1.  **Event: `NavigateToNode(EpsNode node)`**
    - Pushes a new view.
    - Sets `currentEpsNode = node`.
    - Filters `allActivities` to find those matching `activity.epsNodeId == node.id`.

2.  **Event: `RefreshCurrentNode()`**
    - Re-fetches data for the current location only (optimizes bandwidth).

### **C. Offline First Strategy (Drift/SQLite)**
1.  **Sync:** When `LoadProjects` is called, download the full EPS Tree and store in `EpsNodesTable`.
2.  **Read:** `EpsExplorerPage` should strictly read from the local database (`select * from eps_nodes where parent_id = ?`).
3.  **Consistency:** Progress updates are written to `ProgressEntriesTable` immediately (UI updates instantly), then synced to backend via `SyncService`.

---

## 6. Robust Offline-Sync Mechanism (CRITICAL)

**Requirement:** The app must be "Break-Proof" and fully functional offline. Progress data MUST NOT get lost if network fails.

### **A. Core Principles**
1.  **Local First:** ALL writes go to Local DB (`progress_entries` with `sync_status = 'pending'`) FIRST. Never write to API directly.
2.  **Background Sync:** A background service monitors network connectivity (using `internet_connection_checker` or `connectivity_plus`).
3.  **Queue Management:** Sync jobs are processed sequentially (FIFO) to ensure data integrity.

### **B. The Sync Workflow**
1.  **Offline Input:**
    *   User enters 50m of concrete work.
    *   App saves to `ProgressEntriesTable` with `status: PENDING`.
    *   UI shows success toaster: "Saved to Device (Pending Sync)".
    *   Item in list shows a **Clock Icon 🕒** (orange).

2.  **Network Detected (Auto-Sync):**
    *   `SyncQueueWatcher` detects valid internet.
    *   Fetches all `PENDING` items ordered by `timestamp ASC`.
    *   **Loop:**
        *   Pick Item 1.
        *   Send POST to Backend.
        *   **If Success (200 OK):**
            *   Update Local DB: `status: SYNCED`, `server_id: X`.
            *   UI updates to **Checkmark Icon ✅** (green).
        *   **If Fail (500/Timeout):**
            *   Mark Local DB: `status: FAILED` (optional: `error_msg`).
            *   Stop queue processing (or retry 3 times with exponential backoff).
            *   **Notification:** Trigger local notification "Sync Failed: 3 items remaining."

### **C. Conflict & Error Handling**
-   **Partial Sync:** If 5 items are offline, and only 3 sync before network drops, specific status must track this.
    -   Item 1, 2, 3: **Synced ✅**
    -   Item 4, 5: **Pending 🕒**
-   **Permanent Failure:**
    -   If an item fails validation (e.g., "Quantity > Budget"), the backend returns 400.
    -   App must mark item as `ERROR ❌` (red).
    -   **Actionable UI:** User sees red icon -> Taps item -> Sees specific error ("Quantity exceeds BOQ limits") -> Can Edit & Resubmit.

### **D. User Visibility**
-   **Sync Status Bar:** Small indicator in AppBar (Cloud icon).
    -   Cloud with Check: All Synced.
    -   Cloud with Spinner: Syncing...
    -   Cloud with Slash: Offline.
    -   Cloud with Exclamation: Sync Errors.
-   **History Log:** A specific "Sync Log" page where users can see all their uploads and retry manually if needed.

---

## 7. Action Plan for Implementation

### **Phase 1: Data Layer**
1.  **Update `SetuApiClient`:** Ensure generic `getProjectActivities` is optimized OR add `getActivitiesByEps`.
2.  **Update `AppDatabase`:** Ensure `EpsNodes` table exists and is populated during sync.

### **Phase 2: BLoC Logic**
1.  Modify `ProjectState` to hold `currentPath` (List of EpsNodes).
2.  Implement `SelectEpsNode` event in `ProjectBloc`.

### **Phase 3: UI Construction**
1.  Create `BreadcrumbWidget`.
2.  Create `EpsExplorerPage` (The new main view).
3.  Modify `ProjectsListPage` to route to `EpsExplorerPage`.

### **Phase 4: Sync Mechanism**
1.  Implement `ConnectivityService`.
2.  Update `SyncService` to handle `retry` logic and `exponential backoff`.
3.  Add `SyncStatusIndicator` widget to the global `Layout`.

### **Phase 5: Testing**
1.  **Hierarchy Check:** Verify 3-level depth (Project -> Tower -> Floor).
2.  **Data Check:** Verify activities are correctly filtered.
3.  **Offline Test:** Turn off WiFi -> Add Progress -> Turn on WiFi -> Watch it turn green automatically.

---

## 8. AI Execution Blueprint (Seamless Extension)

This section translates the above strategy into an execution sequence that another AI model can implement with minimal ambiguity.

### **A. Discovery & Baseline (Do First)**
1. Trace current route from `ProjectsListPage` to flat activities list.
2. Confirm existing `ProjectBloc`, `ProgressBloc`, repository contracts, and Drift schema.
3. Verify backend payload contracts for EPS tree, planning activities, and progress APIs.
4. Produce a short "As-Is" note before coding.

### **B. Target State (Define Before Coding)**
1. Navigation model: `Project -> EPS Node -> ... -> Activities`.
2. State model:
   - `currentPath: List<EpsNode>`
   - `currentNodeId`
   - `childrenAtCurrentNode`
   - `activitiesAtCurrentNode`
   - `activityIndexByEpsNodeId`
3. Sync model:
   - local-first writes
   - queue states (`pending/syncing/synced/error`)
   - retry/backoff
   - idempotency-safe submission.

### **C. Build Order (Strict Sequence)**
1. Data model + Drift migration updates.
2. Repository and datasource updates.
3. BLoC event/state updates for EPS navigation.
4. `EpsExplorerPage` + `BreadcrumbWidget` UI.
5. Local-first progress queue.
6. Connectivity-triggered sync worker.
7. Sync status indicators + error recovery UX.
8. Unit/widget/integration tests.

### **D. Scale & Safety Controls**
1. Use in-memory index `Map<epsNodeId, List<Activity>>` for fast filtering.
2. Add threshold guard: if project activity volume is too high, fallback to server-side filtered fetch (`getActivitiesByEps`).
3. Ensure every queued progress entry carries an `idempotency_key` to prevent duplicate server writes during retry.
4. Define deterministic conflict policy for edited unsynced records.

---

## 9. File-Level Task Mapping (Flutter)

### **A. Presentation Layer**
1. `ProjectBloc`: add `LoadProjectHierarchy`, `SelectEpsNode`, `NavigateToPathIndex`, `RefreshCurrentNode`.
2. Create `EpsExplorerPage` as the main post-project screen.
3. Create `BreadcrumbWidget` with clickable hierarchy segments.
4. Update `ProjectsListPage` routing to open `EpsExplorerPage` instead of flat activities.

### **B. Domain/Data Layer**
1. Ensure `EpsNode` supports recursive hierarchy and parent linkage.
2. Ensure `Activity` includes stable `epsNodeId` mapping.
3. Extend repository APIs for EPS-tree + activities loading strategy.
4. Build local activity index by EPS node ID.

### **C. Offline/Sync Layer**
1. Extend `progress_entries` with `sync_status`, `retry_count`, `last_error`, `idempotency_key`.
2. Implement FIFO sync worker in `SyncService`.
3. Retry policy:
   - 5xx/timeout: retry with exponential backoff
   - 4xx validation: mark `error`, require user correction.
4. Add top-level sync indicator (all-synced/syncing/offline/error).

---

## 10. Environment and API Configuration Guardrail

1. Move away from hardcoded local IP base URL.
2. Use environment/flavor-driven configuration for `dev/staging/prod`.
3. Keep endpoint constants stable while switching host by flavor.

---

## 11. Test Strategy (Mandatory)

### **A. Unit Tests**
1. Path navigation and breadcrumb jump behavior.
2. EPS-based activity filtering correctness.
3. Sync queue state transitions (`pending -> synced/error`).

### **B. Widget Tests**
1. Mixed folder/activity list rendering.
2. Empty/loading/error states.
3. Sync status indicator state rendering.

### **C. Integration Tests**
1. Offline progress entry -> reconnect -> autosync success.
2. Partial sync interruption and safe resume.
3. Validation error flow with actionable retry/edit behavior.

---

## 12. Definition of Done (Release Gate)

1. Flat activity list is replaced by EPS drill-down flow.
2. User can navigate location hierarchy and log progress at target node.
3. Offline writes are always preserved locally and visibly tracked.
4. Reconnect sync is reliable, idempotent, and recoverable after failures.
5. Critical tests for hierarchy/filtering/sync all pass.

