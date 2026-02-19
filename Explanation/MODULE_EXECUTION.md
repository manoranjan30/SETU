# Site Execution & Progress Module

## Overview
The Execution module captures the actual physical work done on site. It bridges the gap between the Plan (Schedule/BOQ) and Reality. It is primarily used by Site Engineers to log Daily Progress Reports (DPR).

## Key Features

### 1. Progress Recording
- **Granularity**: Progress can be logged against:
  - **BOQ Quantities**: (e.g., "Poured 10 cum of concrete").
  - **Schedule Activities**: (e.g., "Activity 40% complete").
  - **Micro Schedule Logs**: Granular daily logs for sub-activities (e.g., "Rebar fixing done").
- **Location Context**: All progress is tagged to an **EPS Node** (e.g., Block A > Floor 1 > Unit 101).

### 2. Daily Progress Report (DPR)
- A daily snapshot of what happened on site.
- Aggregates Labor (from Labor Module), Machinery, and Work Done.

### 3. Abstract / Bill Generation
- **RA Bill**: (Planned) Running Account bills generated based on "Certified" progress records.
- **Reconciliation**: Compare "Issued Material" vs "Consumed Material" based on progress.

## Architecture

### Backend (`src/progress/`, `src/execution/`)
- **Entities**:
  - `SiteProgress`: Transactional record of work done.
  - `MeasurementElement` (Usage): Progress updates often reference specific measurement lines (e.g., "Completed Wall A").
- **Logic**:
  - Validation: Ensure cumulative progress <= Total Scope.
  - Rollup: Progress on child nodes updates parent Activity completion %.

### Frontend (`src/views/progress/`)
- **ProgressUpdateView**: Interface to select a location (EPS) and update quantities for linked BOQ items/Activities.
- **History**: Log of all past updates.

## Integration
- **With Planning**: Updates "Actual Start", "Actual Finish", and "% Complete" of Schedule Activities.
- **With Scope**: Updates "Executed Qty" of BOQ Items.
- **With Quality**: (Planned) Only items with "Passed" Inspection can be claimed in Progress.
