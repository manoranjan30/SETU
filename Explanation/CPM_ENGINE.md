# CPM Engine Logic & Rules

## Overview
The Critical Path Method (CPM) Engine is responsible for calculating early/late dates, float, and identifying the critical path for the project schedule. This engine runs server-side and is triggered by any change to activities or relationships.

## Core Principles
1.  **Calculation Only**: The engine never modifies user inputs (Duration, Logic, Constraints). It only produces calculated outputs.
2.  **Server-Side Authority**: Clients never calculate the schedule. They strictly display values from the server.
3.  **Automatic Recalculation**: Any change to `Activity` (duration, calendar) or `ActivityRelationship` triggers a recalculation job.

## Calculation Steps

### 1. Initialization
- Verify no loops in logic (Cycle Detection).
- Reset all calculated fields (`EarlyStart`, `EarlyFinish`, `LateStart`, `LateFinish`, `Float`) to null/zero.

### 2. Forward Pass (Early Dates)
- **Start**: Activities with no predecessors (or Project Start Date).
- **Rule**:
    - `EarlyStart` = Max(`Predecessor EarlyFinish` + `Lag`)
    - `EarlyFinish` = `EarlyStart` + `Duration`
- **Logic**: Moving forward in time, determine the earliest possible start and finish for every activity.

### 3. Backward Pass (Late Dates)
- **Start**: Activities with no successors (or defined Project Finish Date).
- **Rule**:
    - `LateFinish` = Min(`Successor LateStart` - `Lag`)
    - `LateStart` = `LateFinish` - `Duration`
- **Logic**: Moving backward from the project end, determine the latest possible start and finish without delaying the project.

### 4. Float Calculation
- **Total Float** = `LateStart` - `EarlyStart` (or `LateFinish` - `EarlyFinish`)
    - The amount of time an activity can play/slip without delaying the *project*.
- **Free Float** = Min(`Successor EarlyStart`) - `EarlyFinish`
    - The amount of time an activity can slip without delaying *any immediate successor*.

### 5. Critical Path Identification
- Any activity where `Total Float` = 0 (or <= threshold) is marked `isCritical = true`.

## Data Model
Calculated results are stored in `ActivitySchedule` table, separate from `Activity` table.

| Field | Description |
|-------|-------------|
| `earlyStart` | Earliest date the activity can begin |
| `earlyFinish` | Earliest date the activity can finish |
| `lateStart` | Latest date it can begin without delay |
| `lateFinish` | Latest date it can finish without delay |
| `totalFloat` | Calculation buffer |
| `isCritical` | Boolean flag |

## Future Considerations
- **Multiple Calendars**: Currently assumes a standard 7-day or 5-day calendar. Future versions will support activity-specific calendars.
- **Constraints**: Support for 'Must Start On', 'Finish No Later Than', etc.
