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

## 4. detailed UI/UX Specifications

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

## 6. Action Plan for Implementation

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

### **Phase 4: Testing**
1.  **Hierarchy Check:** Verify 3-level depth (Project -> Tower -> Floor).
2.  **Data Check:** Verify activities are correctly filtered (Activity for Floor 1 should NOT show on Floor 2).
3.  **Nav Check:** Verify Back button works step-by-step.
