# Quality Control Module

## Overview
The Quality Control (QC) module is a comprehensive system designed to digitize and manage the quality assurance processes of construction projects. It enables site engineers and quality managers to track inspections, material tests, audit findings, and non-conformance reports (NCRs) in real-time.

## Key Features

### 1. Dashboard & Analytics
- **Quality Score**: Real-time calculation based on pass/fail rates of inspections.
- **KPIs**: Tracking of Open NCRs, Pending Inspections, Failed Material Tests.
- **Trend Analysis**: Visual indicators of quality performance over time.

### 2. Inspection Register (ITP/WIR)
- **Workflow**: Create -> Schedule -> Inspect -> Approve/Reject.
- **Fields**: Location, Checklist Reference, Inspector, Witness.
- **Status Tracking**: Pending, Passed, Failed.

### 3. Material Testing
- **Test Logging**: Record results for Concrete (Cube Tests), Steel, Soil, etc.
- **Verification**: Track "Witnessed By" and "Approved By".
- **Compliance**: Automatic flagging of failed tests.

### 4. Observations & NCRs
- **Observations**: Minor issues that need correction but don't warrant a full NCR.
- **NCR (Non-Conformance Report)**: Formal process for serious quality deviations.
    - **Severity**: Minor, Major, Critical.
    - **Root Cause Analysis**: Mandatory field for NCRs.
    - **Corrective Action**: Tracking the fix and closure date.

### 5. Digital Checklists
- **Template Based**: Pre-defined checklists (e.g., "Column Reinforcement").
- **Itemized tracking**: Individual check items (Pass/Fail/NA).
- **Progress**: Visual progress bar for checklist completion.

### 6. Snag Lists
- **Defect Management**: Punch list items for finishing works.
- **Data Points**: Location (Zone/Floor/Unit), Trade (Painting, Carpentry), Description.
- **Assignee**: Link to specific contractors or team members.

### 7. Quality Audits
- **Types**: Internal, External (ISO), Client.
- **Findings**: Log major/minor findings and NCR counts.
- **Scoring**: Audit score tracking.

### 8. Document Control
- **Registry**: Shop Drawings, Method Statements, RFIs.
- **Revision Control**: Track current revision and status (Approved, Rejected, R&R).

## Architecture

### Backend (`src/quality/`)
- **Entities**:
  - `QualityInspection`: Core inspection data.
  - `QualityMaterialTest`: Material test records.
  - `QualityObservationNcr`: dual-purpose entity for issues.
  - `QualityChecklist`: Checklists with JSON-stored items.
  - `QualitySnagList`: Defect tracking.
  - `QualityAudit`: Audit headers.
  - `QualityDocument`: Document metadata.
- **Service**: `QualityService` handles CRUD and aggregation logic (Summary generation).
- **API**: Exposed at `/quality/:projectId/...`.

### Frontend (`src/views/quality/`)
- **Dashboard**: `QualityProjectDashboard` (Tabbed container).
- **Subviews**: Independent components for each feature (`QualityInspection`, `QualityOverview`, etc.).
- **UX**:
  - Color-coded statuses (Green=Pass, Red=Fail/NCR).
  - Modal-based forms for quick data entry.
  - Responsive Grid/Card layouts.

## Data Flow
1. **User** initiates an Inspection Request via Frontend.
2. **Backend** saves record with status "Pending".
3. **Inspector** updates record with results and closes it.
4. **Dashboard** aggregates data to update "Quality Score" instantly.
