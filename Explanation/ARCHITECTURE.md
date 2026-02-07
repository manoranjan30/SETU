# SETU Application Architecture

## 1. High-Level Overview
SETU is a high-performance **Enterprise Project Management (EPM)** system tailored for the construction industry. It adopts a **Modular Monolith** architecture, where distinct business domains (Planning, Costing, Quality, Safety) are encapsulated within the same deployable unit but maintain clear boundaries.

### Core Principles
- **Strict Hierarchy**: Everything revolves around the Enterprise Project Structure (EPS).
- **Role-Based Access**: Granular permissions controlled by `MODULE_AUTH`.
- **Data Isolation**: Project-level data isolation is enforced at the API Guard level.

## 2. System Modules

### Infrastructure
| Module | Description | Documentation |
| :--- | :--- | :--- |
| **Auth** | JWT Authentication, Guards, Role Management. | [MODULE_AUTH.md](./MODULE_AUTH.md) |
| **User** | User profile, Team assignment, Project Access. | [MODULE_USER.md](./MODULE_USER.md) |
| **EPS** | The backbone tree structure (Company -> Unit). | [MODULE_EPS.md](./MODULE_EPS.md) |

### Functional Domains
| Module | Description | Documentation |
| :--- | :--- | :--- |
| **Scope (BOQ)** | Cost estimation, Measurements, Tender management. | [MODULE_SCOPE.md](./MODULE_SCOPE.md) |
| **Planning** | CPM Scheduling, Gantt Charts, Resource Loading. | [MODULE_PLANNING.md](./MODULE_PLANNING.md) |
| **Execution** | Site Progress, DPR, Bill Certification. | [MODULE_EXECUTION.md](./MODULE_EXECUTION.md) |
| **Quality** | Inspections, Testing, NCRs, Audits. | [MODULE_QUALITY.md](./MODULE_QUALITY.md) |
| **EHS** | Safety Incidents, Manhours, Environment stats. | [MODULE_EHS.md](./MODULE_EHS.md) |
| **Labor** | Workforce tracking, Productivity analysis. | [MODULE_LABOR.md](./MODULE_LABOR.md) |

## 3. Technology Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL (via TypeORM)
- **Key Libraries**:
  - `class-validator`: For DTO validation.
  - `passport-jwt`: For Auth.
  - `xlsx`: For heavy Excel processing (BOQ Import).
  - `decimal.js`: For precise financial calculations.

### Frontend
- **Framework**: React 19 (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: React Context + Hooks (Local state preferred).
- **Key Libraries**:
  - `ag-grid-react`: For high-performance data grids.
  - `recharts`: For Dashboards/Analytics.
  - `lucide-react`: Iconography.
  - `react-hook-form`: Form handling.

## 4. Cross-Cutting Concerns

### Security
- All API endpoints are protected by `JwtAuthGuard`.
- Project-specific routes must use `ProjectContextGuard` (Planned) or check permissions explicitly in Service.

### Performance
- **Tree Structures**: EPS and WBS use Adjacency Lists. Recursive queries or Materialized Paths are used for read optimization.
- **Batch Processing**: Large imports (BOQ/Schedule) are processed in chunks or streams to avoid memory spikes.

### Validation
- **Frontend**: Zod / standard HTML5 validation for immediate feedback.
- **Backend**: Strict DTO validation ensures data integrity before it hits the DB.

## 5. Deployment
- **Containerization**: Docker & Docker Compose.
- **CI/CD**: Standard multi-stage build process (Lint -> Build -> Test -> Image).
- **Environment**: Configured via `.env` files.

---
*For detailed Developer setup, see [DEVELOPER_GUIDE.md](./DEVELOPMENT_GUIDE.md).*
