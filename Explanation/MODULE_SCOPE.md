# Scope & BOQ Management Module

## Overview
The Scope module is the financial and quantitative backbone of the project. It manages the Bill of Quantities (BOQ), Measurement Books (MB), and tracks quantities from Tender to Execution (Certified).

## Key Features

### 1. Bill of Quantities (BOQ)
- **Hierarchy**: Supports infinite nesting (Parent Items -> Sub Items).
- **Import**: Advanced Excel Import with smart column mapping and hierarchy detection.
- **Modes**:
  - `MANUAL`: User inputs quantity directly.
  - `DERIVED`: Quantity is rolled up from Sub-items or Measurements.

### 2. Measurement Manager
- **Detailed Takeoff**: Record Line-Item-Measurements (L-B-D) for each BOQ Item.
- **EPS Linking**: Each measurement is linked to a specific location (EPS Node), enabling location-based costing.
- **Formulas**: Supports standard calculation fields (Length, Breadth, Depth, Area, Volume).
- **Auto-Rollup**: Measurements sum up to update the BOQ Item quantity automatically.

### 3. Change Management
*Planned Feature*
- Variations/Change Orders tracking.
- Revision history for BOQ rates and quantities.

## Architecture

### Backend (`src/boq/`)
- **Entities**:
  - `BoqItem`: Main line item.
  - `BoqSubItem`: Child items.
  - `MeasurementElement`: Detailed LBD records linked to `EpsNode` and `BoqItem`.
- **Services**:
  - `BoqService`: core CRUD.
  - `BoqImportService`: Complex Excel parsing logic (`xlsx` based).

### Frontend (`src/pages/scope/`)
- **BoqPage**: Tree-grid view of the BOQ. Supports inline editing and Excel-like interaction.
- **MeasurementManager**: Detailed view to add measurement sheets for a selected BOQ item.

## Data Flow
1. **Import**: User uploads Tender BOQ (Excel).
2. **Setup**: BOQ Structure is created.
3. **Takeoff**: QS (Quantity Surveyor) allows measurements to items, tagging them to Floors/Units (EPS).
4. **Budgeting**: These quantities form the "Zero Budget".
5. **Execution**: Site team executes work, consuming these quantities (tracked in Progress module).
