# Schedule Import Engine (P6 & MSP)

## Overview
The Schedule Import Engine allows users to import project schedules from external tools: Oracle Primavera P6 (.xml, .xer) and Microsoft Project (.xml, .mpp).

## Supported Formats
1.  **Primavera P6 XML**: Preferred format for P6. Structured and easy to parse.
2.  **Microsoft Project XML**: Preferred format for MSP.
3.  **Spreadsheet (Excel)**: Simple list of activities (already partially supported via WBS import).

## Import Process

### 1. Upload & Parsing
- User uploads the file.
- Server parses structure into an intermediate object model:
    - `ExternalProject`
    - `ExternalWBS`
    - `ExternalActivity`
    - `ExternalRelationship`

### 2. Validation
- **WBS Structure**: Ensure distinct hierarchy.
- **Activities**: Check for valid durations, IDs.
- **Loops**: Detect logic loops before saving.

### 3. Mapping & Persistence
- **WBS Creation**: Mirrored from import file to `WbsNode` table.
- **Activity Creation**: Mapped to `Activity` table.
    - `Duration` -> `durationPlanned`
    - `Name` -> `activityName`
    - `Code` -> `activityCode`
- **Relationship Creation**: Mapped to `ActivityRelationship` table.
    - `Predecessor` -> `predecessor_activity_id`
    - `Successor` -> `successor_activity_id`
    - `Type` -> `relationshipType` (FS, SS, FF, SF)
    - `Lag` -> `lagDays`

## Rules
- **Overwrite vs Update**: Currently, import *appends* or *replaces* based on user selection.
    - *Initial implementation will likely be "New Schedule Version" or "Wipe and Replace" for simplicity.*

## Verification
- After import, the **CPM Engine** is automatically triggered to calculate dates based on the imported logic. We do *not* trust the calculated dates from the import file blindly; we trust the logic and recalculate.
