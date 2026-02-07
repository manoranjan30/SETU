# Environment, Health & Safety (EHS) Module

## Overview
The EHS module is designed to ensure safety compliance and environmental responsibility across construction sites. It allows safety officers to log incidents, conduct inspections, track manhours for safety statistics, and manage legal compliance.

## Key Features

### 1. Incident Management
- **Incident Register**: Log Near Misses, First Aid cases, LTI (Lost Time Injuries), and Fatalities.
- **Investigation**: Root cause analysis and preventive action planning.
- **Reporting**: Automatic calculation of accident frequency rates.

### 2. Safety Inspections & Observations
- **Observations**: "Unsafe Act" vs "Unsafe Condition" logging.
- **Inspections**: Scheduled safety walks and audits.
- **Penalties**: Tracking of penalties issued for safety violations.

### 3. Manhours & Statistics
- **Daily Manhour Log**: Input total manhours workflow (Staff + Labor).
- **Safe Manhours**: Automatic tracking of cumulative safe manhours since last LTI.
- **Stats**: Calculation of Frequency Rate (FR) and Severity Rate (SR).

### 4. Environmental Monitoring
- **Metrics**: Track Water Consumption, Electricity, Fuel, and Waste generation.
- **Compliance**: Monitoring against allowable limits.

### 5. Training & Competency
- **Induction**: Track worker safety inductions (Safety Pass).
- **Training Log**: Toolbox talks, specialized training (Height work, Fire safety).
- **Competency**: Certificates and expiry tracking for specialized workers (Crane operators, Welders).

### 6. Permit to Work (PTW)
*Planned Feature*
- Digital workflows for Hot Work, Height Work, and Confined Space permits.

## Architecture

### Backend (`src/ehs/`)
- **Entities**:
  - `EhsIncident`: Core incident data.
  - `EhsObservation`: Unsafe acts/conditions.
  - `EhsManhours`: Daily/Monthly manhour logs.
  - `EhsEnvironmental`: Consumption data.
  - `EhsTraining`: Training records.
  - `EhsCompetency`: Worker certifications.
- **Service**: `EhsService` aggregates data for the Dashboard (e.g., Safe Manhours calculation).

### Frontend (`src/views/ehs/`)
- **Dashboard**: `EhsProjectDashboard`.
- **KPIs**: Big number cards for "Safe Manhours", "LTI Free Days".
- **Charts**: Incident trends, Observation categorization.

## Workflow
1. **Safety Officer** logs Daily Manhours.
2. System updates "Cumulative Safe Manhours".
3. If an **Incident** (LTI) occurs:
   - User logs Incident with date and time.
   - System resets "Safe Manhours" counter or marks the break.
   - Dashboard reflects the incident in stats.
4. **Safety Walk**: Officer logs 10 Observations -> 2 escalated to NCRs.
