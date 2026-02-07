# Labor Management Module

## Overview
The Labor Management module tracks the daily deployment of workforce across the project. It provides visibility into labor strength, trade distribution, and productivity, serving as a critical input for EHS (manhours) and Progress (productivity) calculations.

## Key Features

### 1. Daily Labor Report (DLR)
- **Attendance**: Log headcount by category (e.g., Masons, Helpers, Carpenters).
- **Contractor Wise**: Track labor counts per subcontractor.
- **Shift Tracking**: Day/Night shift logging.

### 2. Labor Categorization
- **Categories**: Skilled (Mason, Carpenter, Fitter) vs Unskilled (Helper).
- **Trades**: Structure, Finishes, MEP, external works.
- **Mapping**: Dynamic mapping of Excel import codes to system categories.

### 3. Productivity Analysis
- **Planned vs Actual**: Compare deployed labor against work executed (linked to Progress module).
- **Labours Productivity**: Output per man-day calculation.

### 4. Excel Integration
- **Import**: Capabilities to upload DLR from standard Excel formats.
- **Mapping Tool**: Interface to map Excel columns/values to system Labor Categories.

## Architecture

### Backend (`src/labor/`)
- **Entities**:
  - `LaborCategory`: Master list of trade categories.
  - `DailyLaborPresence`: Transactional table for daily counts.
  - `LaborExcelMapping`: Configuration for parsing imported files.
- **Service**: `LaborService` handles the daily logging and aggregation logic.

### Frontend (`src/views/labor/`)
- **LaborCountView**: Grid view for data entry.
- **Charts**: Bar charts showing labor strength trend over the week.

## Integration
- **With EHS**: The `DailyLaborPresence` data automatically feeds into `EhsManhours` to generate Safe Manhours statistics.
- **With Progress**: Used to calculate "Labor Cost" or "Effort" for specific activities.
