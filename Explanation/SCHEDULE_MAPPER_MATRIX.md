# Schedule Mapper (Distribution Matrix)

## Overview
The Schedule Mapper is a powerful coordination tool that bridges the gap between the **Master Schedule** and the **Enterprise Project Structure (EPS)**. 

In construction, a single Master Activity (e.g., "Slab Casting") often repeats across multiple floors, blocks, or towers. Instead of creating hundreds of duplicate activities in the Master Schedule, the **Schedule Mapper** allows a planner to define a Master Activity once and "distribute" it across the physical structure of the project.

## Core Concepts

### 1. The Matrix
The Mapper is visualized as a grid:
- **Rows**: Master Schedule Activities (from WBS).
- **Columns**: EPS Nodes (Blocks, Towers, Floors, Units).
- **Cells**: Intersections where an activity is valid for a particular location.

### 2. Multi-Level Linking
- **Direct Linking**: Link a specific activity to a specific floor.
- **Top-Down Linking**: Link a Parent WBS (e.g., "Superstructure") to a Parent EPS Node (e.g., "Block A"). The system automatically distributes all sub-activities to all sub-floors within that block.

### 3. Data Integrity
- **Physical Context**: Once an activity is mapped to an EPS Node, it gains a physical context. This ID is used throughout the system (Quality, Safety, Micro Schedule) to ensure data is recorded at the correct location.
- **Source of Truth**: The `distribution_matrix` table stores these mappings. In the backend, a distributed activity is represented by an `Activity` record where `masterActivityId` points back to the original schedule activity.

## Usage in Other Modules

### Micro Schedule
When creating a Micro Schedule for a distributed activity (e.g., "1st Floor Slab"), the system uses the Matrix to identify exactly which EPS Node (e.g. `Equinox 2 > Tower H > 1st Floor`) the work belongs to. This ensures that:
1. Daily Logs are attributed to the correct physical location.
2. Quantity ledger checks are performed against the correct scope.

### Site Execution
Progress recorded in the field is attributed to the EPS Node. The system uses the Matrix to roll this progress back up to the Master Activity in the project schedule.

## Implementation Details

### Backend (`src/planning/`)
- **Table**: `boq_activity_plan` (often used to store distributed quantities/logic).
- **Logic**: `PlanningService.distributeActivitiesToEps` handles the recursive replication of activities across the EPS tree.

### Frontend (`src/components/planning/distributor/`)
- **ScheduleDistributionMatrix.tsx**: The core grid interface with hierarchical expansion for both WBS (vertical) and EPS (horizontal).
