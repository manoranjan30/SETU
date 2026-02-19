# Micro Schedule Module

## Overview
The Micro Schedule module provides granular tracking of Master Schedule activities. While the Master Schedule (CPM) handles high-level milestones and work packages, the **Micro Schedule** allows site engineers to break these down into daily/weekly trackable tasks with specific quantity allocations and locations.

## Key Features

### 1. Activity Breakdown
- **Granular Tasks**: Break down a Master Activity (e.g., "1st floor Slab Concrete") into smaller chunks (e.g., "Beam Bottoms", "Rebar Fixing", "Casting").
- **Quantity Allocation**: Links tasks directly to BOQ items and tracks the specific quantity assigned to each micro-activity.

### 2. Location Intelligence (EPS Integration)
- **Automatic Mapping**: Integrated with the **Schedule Mapper (Distribution Matrix)**. 
- **EPS Path Awareness**: Automatically identifies and displays the detailed EPS hierarchy (e.g., `Equinox 2 > Tower H > 1st Floor`) for each activity based on its distribution in the master matrix.
- **Validation**: Ensures that micro-activities are only created for locations where the parent activity is validly distributed.

### 3. Execution Tracking (Daily Logs)
- **Daily Reporting**: Field engineers log "Actual Done" quantities daily.
- **Manpower & Equipment**: Tracks resources used per task.
- **Delay Tracking**: Categorizes reasons for delays (Weather, Material, Manpower, etc.) with specific delay reasons from a standardized registry.

### 4. Progress Rollup
- **Automated Calculations**: Daily logs roll up into Micro Activity progress.
- **Parent Sync**: Micro Activity progress updates the Master Activity's % complete and financial data.

## Architecture

### Backend (`src/micro-schedule/`)
- **Entities**:
  - `MicroSchedule`: The container for a set of breakdown activities.
  - `MicroScheduleActivity`: The granular task linked to a Master Activity and a BOQ Item.
  - `MicroDailyLog`: Execution records with quantity and resource data.
  - `MicroQuantityLedger`: Tracks the remaining/allocated balance from the Parent Activity's total quantity.

### Frontend (`src/components/micro-schedule/`)
- **MicroSchedulePage**: Management dashboard for micro schedules.
- **MicroActivityBreakdown**: The core interface for defining tasks and viewing current status.
- **DailyLogEntry**: Modal for entering progress and resource usage.

## Data Flow
1. **Selection**: User selects a Master Activity that has been distributed in the Schedule Mapper.
2. **Breakdown**: User creates a Micro Schedule and adds activities, allocating quantities from the available BOQ items.
3. **Execution**: Site engineers enter Daily Logs.
4. **Visibility**: Progress is visualized via progress bars and rolls up to the Master Schedule for project-wide reporting.
