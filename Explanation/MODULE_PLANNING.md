# Planning & Scheduling Module

## Overview
The Planning module handles the time aspect of the project. It supports Industry-Standard scheduling (CPM), Gantt Charts, WBS (Work Breakdown Structure), and resource loading. It mimics features found in tools like MS Project or Oracle Primavera P6.

## Key Features

### 1. Work Breakdown Structure (WBS)
- **Hierarchy**: Define the breakdown of work (e.g., Substructure -> Foundation -> Piling).
- **Activities**: Tasks are created under WBS nodes.

### 2. Activity Management
- **Properties**: Duration, Start Date, Finish Date, Calendar.
- **Relationships**: Finish-to-Start (FS), SS, FF, SF dependencies with Lag.
- **Critical Path**: Automatic calculation of Critical Path Method (CPM), Float, and Early/Late dates.

### 3. Gantt Chart
- **Visualization**: Interactive Timeline view.
- **Interactivity**: Drag-and-drop bars to change dates (if logic allows), resize to change duration.
- **Zoom/Scale**: Day, Week, Month views.

### 4. Excel/MSP Import
- **Import**: Ability to import schedules from CSV/Excel formats exported from MSP/Primavera.

## Architecture

### Backend (`src/planning/`, `src/wbs/`)
- **Entities**:
  - `WbsNode`: The structural hierarchy.
  - `ProjectActivity`: The tasks with duration and logic.
  - `ActivityDependency`: The links between tasks.
- **Engine**: A custom CPM calculation engine (Forward/Backward pass) to compute valid dates based on network logic.

### Frontend (`src/pages/`)
- **SchedulePage**: The main Gantt interface using `ag-grid` for the table and custom SVG/Canvas rendering for the bars.
- **WbsPage**: Tree-view for organizing the WBS structure before adding activities.

## Data Flow
1. **Definition**: Planner defines WBS in **WbsPage**.
2. **Scheduling**: Planner adds Activities and links them in **SchedulePage**.
3. **Calculation**: Planner hits "Reschedule" -> Backend runs CPM Engine -> Updates Dates.
4. **Baseline**: (Planned) Snapshot of the schedule is saved as "Baseline".
