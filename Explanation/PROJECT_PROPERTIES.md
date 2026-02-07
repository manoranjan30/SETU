# Project Properties Module

## 1. Overview
The **Project Properties** module provides a detailed metadata layer for every project (EPS Node). It transforms a simple tree node into a comprehensive project record, compliant with core construction management standards (PMBOK/Prince2).

## 2. Architecture
*   **Entity**: `ProjectProfile` (1:1 with `EpsNode`).
*   **Lazy Loading**: Profile data is fetched on-demand to keep the EPS Tree lightweight.
*   **Schema Enforcement**: Uses strict columns for reporting consistency, not a loose JSON blob.

## 3. User Interface (Dynamic Property Form)
The "Project Properties" settings modal is organized into **7 Functional Tabs** to manage complexity.

### A. Core Identity
Defines the fundamental attributes of the project.
| Field | Type | Options / Validation |
| :--- | :--- | :--- |
| **Project Code** | Text | Required* |
| **Project Name** | Text | Required*. Defaults to Node Name. |
| **Project Type** | Enum | Residential, Commercial, Infrastructure, Mixed |
| **Project Category** | Text | e.g., "Luxury", "Affordable", "Township" |
| **Project Status** | Enum | Planned, Active, On-Hold, Closed |
| **Project Version** | Text | Revision number (e.g., v1.0) |
| **RERA Number** | Text | Regulatory ID |
| **Description** | Long Text | Executive summary |

### B. Organization & Governance
Assigns key stakeholders responsible for delivery.
*   **Owning Company**: Legal entity.
*   **Business Unit**: Internal division.
*   **Key Roles** (User Selectors):
    *   Project Sponsor
    *   Project Manager
    *   Planning Manager
    *   Cost Controller
    *   Approval Authority

### C. Location & Site
Geospatial and land data.
| Field | Type |
| :--- | :--- |
| **Address** | State, City, Country, Full Site Address |
| **Coordinates** | Latitude / Longitude (Decimal precision) |
| **Land Area** | Number (Sq. Meters/Acres) |
| **Land Ownership** | Owned, Lease, JV |
| **Zoning** | Classification (e.g., SEZ, Residential) |

### D. Schedule Controls
High-level time constraints.
*   **Planned Start/End**: Baseline timeline.
*   **Actual Start/End**: Execution reality.
*   **Project Calendar**: Work-week definition (e.g., "6-Day Work Week").
*   **Shift Pattern**: Single / Double / Triple.
*   **Milestone Strategy**: Text.

### E. Financial & Commercial
Budgetary framework.
| Field | Type | Notes |
| :--- | :--- | :--- |
| **Currency** | Text | Base currency (INR, USD) |
| **Est. Cost** | Decimal | Pre-tender estimate |
| **Approved Budget** | Decimal | Control budget |
| **Funding Type** | Enum | Self, Bank, JV |
| **Revenue Model** | Enum | Sale, Lease, BOT |
| **Tax Structure** | Text | GST/VAT details |
| **Escalation** | Boolean | Is escalation clause applicable? |

### F. Construction & Technical
Physical parameters of the build.
*   **Technology**: Conventional, Alu-Form, Precast, Hybrid.
*   **Structural System**: Text description.
*   **Scale**:
    *   Number of Buildings
    *   Typical Floor Count
    *   Total Built-up Area
*   **Constraints**:
    *   Height Restriction
    *   Seismic Zone
    *   Unit Mix (Text)

### G. Audit & Lifecycle
*   **Lifecycle Stage**: Concept, Design, Execution, Handover, Closeout.
*   **Change Reason**: Justification for recent property updates.

## 4. Technical Implementation
### Backend
*   **File**: `src/eps/project-profile.entity.ts`
*   **API Endpoints**:
    *   `GET /eps/:id/profile`: Returns `ProjectProfile` or empty object.
    *   `PATCH /eps/:id/profile`: Upsert logic (Updates if exists, Creates if not).
*   **Validation**:
    *   Numeric fields use `decimal` type for precision.
    *   Dates are stored as strict `Date` objects.

### Frontend
*   **File**: `frontend/src/components/eps/DynamicPropertyForm.tsx` (or `ProjectPropertiesModal.tsx`)
*   **State**: Uses a local formData state initialized from API.
*   **Auto-Save**: Currently explicit "Save" button.

## 5. Usage Flow
1.  User selects a specific **Project** in the EPS Tree.
2.  Clics the orange **Settings (Gear)** icon.
3.  Modal opens to the "Core Identity" tab.
4.  User navigates tabs to fill data.
5.  Clicking **Save** commits all tab data in a single transaction.

## 6. Access Control
*   **View**: Requires `EPS.READ` + Project Assignment.
*   **Edit**: Requires `EPS.UPDATE` + Project Assignment.
