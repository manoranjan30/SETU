# SETU - Construction Project Management System
## Context Exchange for Multi-AI Collaboration

**Last Updated**: 2026-03-08 19:05 IST  
**Project Status**: Active Development - Core Architecture Complete

---

## 🎯 PROJECT OVERVIEW

**SETU** is a comprehensive construction project management platform designed for real-world construction workflows in India. It manages the complete lifecycle from BOQ (Bill of Quantities) to execution, tracking, and vendor management.

### Core Purpose
- **BOQ-Centric Architecture**: All project data flows from and relates to the Bill of Quantities
- **Hierarchical Project Structure**: EPS (Enterprise Project Structure) with multi-level organization
- **Vendor Work Order Management**: Import, map, and track vendor deliverables against BOQ items
- **Progress Tracking**: Site execution monitoring with measurement-based progress calculation
- **Multi-Module System**: Budget, Procurement, Quality, Safety, Planning modules

---

## 🏗️ ARCHITECTURE & TECH STACK

### Backend (NestJS + TypeORM + PostgreSQL)
```
backend/
├── src/
│   ├── boq/              # Bill of Quantities - CORE MODULE
│   ├── eps/              # Enterprise Project Structure (Hierarchy)
│   ├── workdoc/          # Work Orders & Vendor Management - RECENTLY DEVELOPED
│   ├── progress/         # Site Execution & Progress Tracking
│   ├── planning/         # Schedule & WBS Management
│   ├── procurement/      # Material Procurement
│   ├── budget/           # Budget Management
│   ├── quality/          # Quality Control & Snag Lists
│   └── safety/           # Safety Inspections
```

**Key Technologies**:
- **Framework**: NestJS (TypeScript)
- **ORM**: TypeORM with PostgreSQL
- **File Processing**: XLSX (Excel import/export), pdf-parse
- **API**: RESTful endpoints

### Frontend (React + TypeScript + Vite)
```
frontend/
├── src/
│   ├── components/
│   │   ├── workdoc/      # Work Order components - RECENTLY DEVELOPED
│   │   │   ├── ExcelImportModal.tsx
│   │   │   ├── PendingVendorBoard.tsx
│   │   │   └── WorkOrderUploadModal.tsx
│   │   └── common/       # Reusable UI components
│   ├── views/            # Page-level components
│   │   ├── boq/
│   │   ├── progress/
│   │   ├── planning/
│   │   └── quality/
│   ├── services/         # API service layer
│   │   └── work-doc.service.ts  # RECENTLY DEVELOPED
│   └── api/
│       └── axios.ts      # HTTP client configuration
```

**Key Technologies**:
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (custom design system)
- **State Management**: React Hooks (useState, useEffect, useCallback)
- **Routing**: React Router v6
- **HTTP**: Axios
- **UI Libraries**: Lucide React (icons), React Hot Toast (notifications)

---

## 📊 DATABASE SCHEMA (Key Entities)

### Core Hierarchy
```
EpsNode (Enterprise Project Structure)
├── id, name, code, type (PROJECT, BLOCK, FLOOR, UNIT, etc.)
├── parentId (self-referencing hierarchy)
└── Relations: BOQ Items, Work Orders, Progress Records
```

### BOQ (Bill of Quantities) - CENTRAL ENTITY
```
BoqItem
├── id, projectId, epsNodeId
├── boqCode, description, longDescription
├── uom, qty, rate, amount
├── qtyMode (MANUAL, DERIVED, FORMULA)
├── consumedQty (from work orders)
└── Relations: BoqSubItems, MeasurementElements, WorkOrderItems

BoqSubItem
├── id, boqItemId
├── description, uom, qty, rate, amount
└── Relations: MeasurementElements

MeasurementElement
├── id, boqItemId, boqSubItemId, epsNodeId
├── elementId, elementName, elementCategory
├── length, breadth, depth, height, qty
├── grid, linkingElement, baseCoordinates
└── Purpose: Detailed quantity derivation from site measurements
```

### Work Orders & Vendor Management - **RECENTLY DEVELOPED**
```
Vendor
├── id, vendorCode, name, contactPerson
├── phone, email, address, gstNumber
└── Relations: WorkOrders

WorkOrder
├── id, projectId, vendorId
├── woNumber, date, status
├── pdfPath, excelPath, originalFileName
└── Relations: WorkOrderItems

WorkOrderItem
├── id, workOrderId, boqItemId
├── serialNumber, parentSerialNumber, level, isParent
├── materialCode, shortText, longText
├── uom, quantity, rate, amount
├── executedQuantity, mappingStatus
└── Purpose: Links vendor work items to BOQ items
```

### Planning & Schedule
```
WbsNode (Work Breakdown Structure)
├── id, projectId, parentId
├── wbsCode, name, level
└── Relations: Activities

Activity
├── id, wbsNodeId, epsNodeId, boqItemId
├── activityCode, name, duration
├── startDate, endDate, progress
├── predecessors (JSON array of dependencies)
└── Relations: Progress records
```

### Progress Tracking
```
ProgressRecord
├── id, projectId, epsNodeId, activityId, boqItemId
├── date, quantityExecuted, remarks
└── Purpose: Daily site execution tracking
```

---

## 🚀 RECENTLY COMPLETED FEATURES (Feb 2026)

### 1. **Work Order Import & Mapping System** ✅
**Problem Solved**: Vendors provide work orders in Excel/PDF format that need to be mapped to project BOQ items.

**Implementation**:
- **3-Step Sequential Workflow**:
  1. **Upload**: File preview with header detection
  2. **Column Mapping**: User maps Excel columns to system fields
  3. **Review**: Hierarchical table view with inline editing

- **Backend Services** (`workdoc.service.ts`):
  - `previewExcelFile()`: Reads Excel, returns preview rows and potential headers
  - `parseExcelWorkOrder()`: Imports Excel with column mapping, calculates hierarchy
  - `confirmWorkOrder()`: Saves work order and items to database
  - `autoMapWorkOrder()`: Auto-maps items to BOQ by material code or description
  - `bulkMapItems()`: Manual bulk mapping interface

- **Frontend Components**:
  - `ExcelImportModal.tsx`: Multi-step import wizard with state management
  - `PendingVendorBoard.tsx`: Dashboard for unmapped work order items
  - `VendorMappingPage.tsx`: Full-page mapping interface

- **Key Features**:
  - Hierarchical work order structure (parent-child relationships)
  - Serial number parsing (e.g., "10.1.2" → Level 2, Parent "10.1")
  - Automatic parent amount calculation (sum of children)
  - Inline editing of quantities, rates, descriptions
  - Indent/Outdent controls for hierarchy adjustment

**Files Modified/Created**:
- Backend: `backend/src/workdoc/workdoc.service.ts`, `workdoc.controller.ts`
- Frontend: `frontend/src/components/workdoc/ExcelImportModal.tsx`, `PendingVendorBoard.tsx`, `VendorMappingPage.tsx`
- Services: `frontend/src/services/work-doc.service.ts`
- Routes: Added `/projects/:projectId/vendor-mapping` route

### 2. **Type Safety & Build Stability** ✅
**Problem Solved**: TypeScript compilation errors and linting issues blocking builds.

**Fixes Applied**:
- Added type parameters to `XLSX.utils.sheet_to_json<any[]>()` calls
- Created interfaces: `ExcelItem`, `ColumnMapping`, `ConfirmWorkOrderData`, `ExcelImportResult`
- Replaced `any` types with specific interfaces across components
- Fixed React hooks issues (`useCallback` for stable dependencies)
- Resolved `set-state-in-effect` linting errors with proper async patterns

**Build Status**: ✅ Backend & Frontend both compile successfully

---

## 🔄 DATA FLOW PATTERNS

### BOQ Import Flow
```
Excel File → BoqImportService.importBoq()
  → Parse rows with column mapping
  → Resolve EPS hierarchy (Block → Floor → Unit)
  → Create BoqItem entities
  → Link to EpsNode
  → Save to database
```

### Work Order Import Flow
```
Excel File → WorkDocService.previewExcelFile()
  → User maps columns (serialNumber, description, qty, rate, etc.)
  → WorkDocService.parseExcelWorkOrder()
  → Calculate hierarchy levels from serial numbers
  → Calculate parent amounts (sum of children)
  → User reviews in ExcelImportModal
  → WorkDocService.confirmWorkOrder()
  → Save WorkOrder + WorkOrderItems
  → Items initially unmapped (boqItemId = null)
```

### Mapping Flow
```
Unmapped WorkOrderItems → PendingVendorBoard
  → Option 1: Auto-map by material code (exact match)
  → Option 2: Auto-map by description (fuzzy match)
  → Option 3: Manual mapping via UI
  → Update WorkOrderItem.boqItemId
  → Update BoqItem.consumedQty
```

### Progress Tracking Flow
```
Site Measurement → MeasurementElement
  → Calculate qty from (length × breadth × depth)
  → Roll up to BoqSubItem.qty
  → Roll up to BoqItem.qty
  → Link to Activity via boqItemId
  → Create ProgressRecord
  → Update Activity.progress percentage
```

---

## 🎨 UI/UX DESIGN PRINCIPLES

### Design System
- **Color Palette**: 
  - Primary: Blue/Indigo (`bg-blue-600`, `text-blue-600`)
  - Accent: Orange (`bg-orange-600` for CTAs)
  - Status: Green (success), Red (error), Amber (warning)
- **Typography**: System fonts, bold headings, clear hierarchy
- **Components**: Rounded corners (`rounded-xl`), shadows, hover states
- **Icons**: Lucide React (consistent icon set)

### Key UI Patterns
- **Modal Workflows**: Multi-step wizards with progress indicators
- **Tables**: Sticky headers, hover effects, inline editing
- **Hierarchical Views**: Expand/collapse, indentation, parent-child relationships
- **Toast Notifications**: Success/error feedback with react-hot-toast

---

## 🔧 CURRENT DEVELOPMENT STATE

### ✅ Completed Modules
1. **EPS Management**: Hierarchical project structure (Project → Block → Floor → Unit)
2. **BOQ Management**: Import, view, edit, measurement-based quantity derivation
3. **Work Order Import**: Excel import with column mapping and hierarchy
4. **Vendor Mapping**: Auto and manual mapping of work items to BOQ
5. **Progress Tracking**: Site execution with measurement elements
6. **Planning Module**: WBS, Activities, Gantt chart, Schedule table
7. **Quality Module**: Snag lists, inspections
8. **Safety Module**: Safety inspections, incident tracking

### 🚧 In Progress / Pending
1. **Dashboard Mocks**: Visual mockups for "Map/Review" actions
2. **Manual Mapping Modal**: Individual item mapping UI in PendingVendorBoard
3. **Advanced Fuzzy Matching**: Improved auto-mapping algorithms
4. **PDF Header Extraction**: Parse work order headers from PDF files
5. **Execution Workflow**: Complete flow from work order → execution → progress

### 🐛 Known Issues / Technical Debt
- Frontend still has ~500+ linting warnings (mostly in older modules)
- Some components use `any` types (gradual migration to strict typing)
- PDF parsing needs enhancement for complex layouts
- Performance optimization needed for large BOQ datasets (1000+ items)

---

## 📁 KEY FILE LOCATIONS

### Configuration
- **Backend**: `backend/src/main.ts`, `backend/ormconfig.ts`
- **Frontend**: `frontend/vite.config.ts`, `frontend/tsconfig.json`
- **Database**: PostgreSQL connection via TypeORM

### API Endpoints (Backend)
- **BOQ**: `/boq/:projectId/*`
- **Work Orders**: `/workdoc/:projectId/*`
- **Progress**: `/progress/:projectId/*`
- **Planning**: `/planning/:projectId/*`

### Service Layer (Frontend)
- **API Client**: `frontend/src/api/axios.ts`
- **Services**: `frontend/src/services/*.service.ts`

### Routing (Frontend)
- **Main Router**: `frontend/src/App.tsx`
- **Routes**: `/projects/:projectId/boq`, `/projects/:projectId/vendor-mapping`, etc.

---

## 🔐 IMPORTANT CONVENTIONS

### Naming Conventions
- **Database**: snake_case (e.g., `boq_item`, `work_order_id`)
- **TypeScript**: camelCase for variables, PascalCase for types/interfaces
- **Components**: PascalCase (e.g., `ExcelImportModal.tsx`)
- **API Endpoints**: kebab-case (e.g., `/pending-vendor-board`)

### Code Standards
- **Backend**: NestJS decorators, dependency injection, DTOs for validation
- **Frontend**: Functional components, React Hooks, TypeScript strict mode
- **Error Handling**: Try-catch with toast notifications, proper error types

### Git Workflow
- Feature branches merged to main
- Commit messages: Descriptive with module prefix (e.g., "workdoc: Add Excel import modal")

---

## 📝 CHANGE LOG

### 2026-03-08 19:05 IST - Antigravity
- **Action**: Dashboard Role Alignment & Notification Integration
- **Features**:
  - Fixed `DashboardBuilderService` to resolve JWT role names into database `roleIds` for hierarchical assignment lookup.
  - Corrected `DashboardBuilderController` endpoint routing (`/defaults/my`) and added missing `@Query` decorator.
  - Registered `NotificationsModule` in `AppModule`, restoring functionality for `/api/pending-tasks/my`.
  - Created `quick_build_parallel.bat` utilizing Docker BuildKit and `--parallel` for significantly faster container builds.
  - Restored corrupted method boundaries in `DashboardBuilderService` (removed duplicated code fragments).
- **Files**:
  - `backend/src/dashboard-builder/dashboard-builder.service.ts`
  - `backend/src/dashboard-builder/dashboard-builder.controller.ts`
  - `backend/src/app.module.ts`
  - `quick_build_parallel.bat`
- **Summary**: Dashboard assignment logic is now robust and production-ready. Build system is optimized for speed.

### 2026-03-08 10:15 IST - Antigravity
- **Action**: Project-Scoped Approval Routing Implementation
- **Features**:
  - Implemented `sendToProjectRole()` in `PushNotificationService`.
  - Refactored RFI creation to target only specific project team members for notifications.
  - Added "Notify Next Approver" logic to `InspectionWorkflowService`.
  - Injected `UserProjectAssignment` repository into `NotificationsModule`.
- **Files**:
  - `backend/src/notifications/push-notification.service.ts`
  - `backend/src/quality/quality-inspection.service.ts`
  - `backend/src/quality/inspection-workflow.service.ts`
- **Summary**: Notifications for workflow actions are now strictly restricted to users assigned to the relevant project.

### 2026-02-11 00:50 IST - Antigravity (Claude 3.5 Sonnet)
- **Action**: Phase 2 Completed - Micro Schedule Development
- **Features**:
  - Implemented `MicroScheduleForm` for schedule creation and editing.
  - Implemented `MicroActivityBreakdown` for activity-level quantity allocation and tracking.
  - Implemented `DailyLogEntry` for recording daily progress, manpower, and delay reasons.
  - Added Backend support for Delay Reasons and project activity lookups.
  - Verified integration and data flow in `MicroSchedulePage`.
- **Status**: Phase 2 functionally complete. Ready for real-world testing.

### 2026-02-11 00:20 IST - Antigravity (Claude 3.5 Sonnet)
- **Action**: Phase 2 Progress - Integrated Micro Schedule into Planning Module
- **Features**:
  - Moved "Micro Schedule" from global menu to **Project Planning Dashboard** (`PlanningDashboard.tsx`)
  - Created `MicroSchedulePage.tsx` as the module entry point with view management
  - Created `MicroScheduleList.tsx` with native date formatting, status badges, and progress indicators
  - Updated `PlanningPage.tsx` routing to support `?view=micro_schedule`
  - Removed dependency on `date-fns` for lightweight bundle
- **Files**:
  - `frontend/src/pages/micro-schedule/MicroSchedulePage.tsx`
  - `frontend/src/components/micro-schedule/MicroScheduleList.tsx`
  - `frontend/src/components/planning/PlanningDashboard.tsx` (updated)
  - `frontend/src/pages/PlanningPage.tsx` (updated)
- **Summary**: Micro Schedule is now deeply integrated into the Project Planning workflow. List view is functional. Next: Implement Create/Edit forms.

### 2026-02-11 00:10 IST - Antigravity (Claude 3.5 Sonnet)
- **Action**: Started Phase 2 - Frontend UI Development
- **Features**:
  - Created complete frontend service layer (`micro-schedule.service.ts`)
  - TypeScript interfaces matching all backend DTOs
  - Status constants (MicroScheduleStatus, MicroActivityStatus, DelayCategory)
  - 25+ API service methods (CRUD, workflow, stats)
  - Added "Micro Schedule" menu item with Calendar icon
  - Fixed Vite enum compatibility (converted to const objects)
- **Files**:
  - `frontend/src/services/micro-schedule.service.ts` (350+ lines)
  - `frontend/src/config/menu.ts` (updated)
- **Summary**: Phase 2 started (15% complete). Service layer ready for UI components. Next: Create list view, form modal, and daily logging components.

### 2026-02-10 23:55 IST - Antigravity (Claude 3.5 Sonnet)
- **Action**: Created Database Migration Scripts for Micro Schedule Module
- **Features**:
  - Complete SQL migration script with 5 tables (delay_reason, micro_schedule, micro_schedule_activity, micro_daily_log, micro_quantity_ledger)
  - 15+ indexes for performance optimization
  - Foreign key constraints for data integrity
  - Unique constraints for business rules
  - Seeded 26 delay reasons across 9 categories
  - Rollback script for safe removal
  - Comprehensive migration guide with verification steps
- **Files**:
  - `backend/migrations/micro-schedule-tables.sql` (300+ lines)
  - `backend/migrations/micro-schedule-rollback.sql`
  - `backend/migrations/README-MICRO-SCHEDULE.md`
- **Summary**: Database migration ready for execution. Tables designed with soft deletes, decimal precision (12,3), and proper indexing for performance.

### 2026-02-10 23:45 IST - Antigravity (Claude 3.5 Sonnet)
- **Action**: Completed Micro Schedule Module Phase 1 (Core Foundation)
- **Features**:
  - Implemented all 4 core services (MicroScheduleService, MicroActivityService, MicroDailyLogService, MicroLedgerService)
  - Created REST API controller with 25+ endpoints
  - Configured NestJS module and registered in app.module.ts
  - Added approval workflow (DRAFT → SUBMITTED → APPROVED → ACTIVE → COMPLETED)
  - Implemented overshoot detection (forecast > parent finish)
  - Built productivity calculation and forecast engine
  - Added quantity validation preventing over-allocation
- **Files**:
  - `backend/src/micro-schedule/micro-schedule.service.ts`
  - `backend/src/micro-schedule/micro-activity.service.ts`
  - `backend/src/micro-schedule/micro-daily-log.service.ts`
  - `backend/src/micro-schedule/micro-schedule.controller.ts`
  - `backend/src/micro-schedule/micro-schedule.module.ts`
  - `backend/src/app.module.ts` (updated)
- **Summary**: Phase 1 (100% complete) establishes complete backend infrastructure for quantity-driven lookahead planning. Ready for Phase 2 (Frontend UI).

### 2026-02-10 23:30 IST - Antigravity (Claude 3.5 Sonnet)
- **Action**: Started Micro Schedule Module implementation (Phase 1: Core Foundation)
- **Features**:
  - Created 5 database entities (MicroSchedule, MicroScheduleActivity, MicroDailyLog, MicroQuantityLedger, DelayReason)
  - Created 3 DTOs for API contracts
  - Implemented MicroLedgerService with quantity allocation validation
  - Designed comprehensive implementation plan with 7 phases
- **Files**:
  - `backend/src/micro-schedule/entities/*.entity.ts` (5 files)
  - `backend/src/micro-schedule/dto/*.dto.ts` (3 files)
  - `backend/src/micro-schedule/micro-ledger.service.ts`
  - `.agent/tasks/micro-schedule-implementation.md`
  - `.agent/tasks/micro-schedule-progress.md`
- **Summary**: Micro Schedule is a quantity-driven lookahead planning and execution control system that bridges master schedule and daily execution. Phase 1 (20% complete) establishes core data model and quantity validation engine.

### 2026-02-10 23:35 IST - Antigravity (Claude 3.5 Sonnet)
- **Action**: Fixed BOQ Export issue where EPS Name was missing for measurements
- **Fix**: Added `subItems.measurements.epsNode` to the TypeORM query relations in `BoqImportService`.
- **Files**: `backend/src/boq/boq-import.service.ts`


### 2026-02-10 20:15 IST - Antigravity (Claude 3.5 Sonnet)
- **Action**: Populated CONTEXT_EXCHANGE.md with comprehensive project documentation
- **Purpose**: Enable multi-AI collaboration with shared context
- **Files**: CONTEXT_EXCHANGE.md
- **Summary**: Documented complete architecture, tech stack, database schema, completed features, data flows, and current state for seamless handoff between AI assistants.

### 2026-02-10 (Earlier) - Antigravity (Claude 3.5 Sonnet)
- **Action**: Fixed all TypeScript build errors in backend and frontend
- **Files**: 
  - `backend/src/workdoc/workdoc.service.ts`
  - `backend/src/boq/boq-import.service.ts`
  - `frontend/src/components/workdoc/ExcelImportModal.tsx`
  - `frontend/src/components/workdoc/PendingVendorBoard.tsx`
  - `frontend/src/services/work-doc.service.ts`
  - `frontend/src/views/quality/subviews/QualitySnagList.tsx`
- **Summary**: Added type parameters, created interfaces, fixed React hooks, eliminated `any` types. Both backend and frontend now build successfully.

### 2026-02-08 to 2026-02-10 - Antigravity (Claude 3.5 Sonnet)
- **Action**: Implemented complete Work Order Import & Mapping system
- **Features**:
  - Excel file preview and import with column mapping
  - Hierarchical work order structure support
  - 3-step sequential workflow (Upload → Map → Review)
  - Auto-mapping by material code and description
  - Pending vendor board for unmapped items
  - Inline editing and hierarchy adjustment
- **Files**: Multiple files in `backend/src/workdoc/` and `frontend/src/components/workdoc/`

### 2026-02-10 (Initial) - Codex (OpenAI)
- **Action**: Created CONTEXT_EXCHANGE.md structure
- **Files**: CONTEXT_EXCHANGE.md
- **Summary**: Established file format and conventions for cross-AI coordination

---

## 🤝 GUIDELINES FOR AI ASSISTANTS

### When Working on This Project:
1. **Read This File First**: Understand the architecture and current state
2. **Update This File**: Add entries for significant changes
3. **Maintain Consistency**: Follow established patterns and conventions
4. **Check Dependencies**: Understand how modules interact (especially BOQ-centric flow)
5. **Test Builds**: Run `npm run build` in both backend and frontend before committing
6. **Type Safety**: Prefer interfaces over `any`, use TypeScript strict mode

### Common Tasks:
- **Adding a New Module**: Follow NestJS module structure, create entities, DTOs, service, controller
- **Adding a UI Component**: Use functional components, TypeScript, Tailwind CSS, Lucide icons
- **Database Changes**: Update entities, create migrations, update DTOs
- **API Changes**: Update backend controller/service AND frontend service layer

### Getting Started Commands:
```bash
# Backend
cd backend
npm install
npm run start:dev  # Development server on port 3000

# Frontend
cd frontend
npm install
npm run dev        # Development server on port 5173

# Database
# PostgreSQL must be running
# Connection details in backend/ormconfig.ts
```

---

## 📞 CONTACT & RESOURCES

**Project Owner**: Manoranjan (Puravankara Limited)  
**Development Period**: 2025-2026  
**Primary AI Assistant**: Antigravity (Claude 3.5 Sonnet)  
**Secondary AI**: Codex (OpenAI)

**Repository Structure**: Monorepo with `backend/` and `frontend/` folders  
**Deployment**: Not yet deployed (local development)

---

*This document is a living reference. Please update it when making significant changes to help future AI assistants (and humans!) understand the project quickly.*

- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Upgraded 	emp Workings/boq_converter.py with smarter hierarchy extraction (from first 4 BOQ code columns), strict confidence-based review output, and optional description summarization modes (
one|heuristic|ollama).
- Files: temp Workings/boq_converter.py, temp Workings/BOQ_Import_preview.csv, temp Workings/BOQ_Import_preview_review_required.csv


- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Built a non-core GUI tool for BOQ conversion with one-click file selection, conversion, strict review output, and Ollama setup actions (install via winget + model pull + status).
- Files: temp Workings/boq_converter_gui.py, temp Workings/run_boq_converter_gui.bat


- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Refactored converter to measurement-first workflow: each quantity row is an anchor; rows between measurements are used as context to resolve/emit MAIN_ITEM and SUB_ITEM, with deterministic sub-item numbering for alpha/roman codes and numbering-aware LLM summarization prompts.
- Files: temp Workings/boq_converter.py, temp Workings/BOQ_Import_preview.csv, temp Workings/BOQ_Import_preview_review_required.csv


- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Improved GUI observability and install reliability diagnostics: added progress bar with measurement-based conversion progress, real-time streamed logs for winget/ollama commands, clearer install failure status with exit code, and manual fallback link to Ollama download page.
- Files: temp Workings/boq_converter.py, temp Workings/boq_converter_gui.py


- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Added instruction-driven LLM summarization controls: GUI now supports preset prompt styles and custom instruction text; converter now accepts custom instruction via GUI/CLI and injects it into Ollama prompt with label/code context.
- Files: temp Workings/boq_converter.py, temp Workings/boq_converter_gui.py


- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Updated parser to strict serial-based hierarchy rules per user workflow: Qty rows => MEASUREMENT; only numeric integer serials => MAIN_ITEM; only numeric dotted serials => SUB_ITEM; alpha/roman rows are treated as description text. Implemented block-based detailed-description merging (main: main->sub/measurement, sub: sub->measurement) and fed detailed+measurement text to LLM summarization input.
- Files: temp Workings/boq_converter.py, temp Workings/BOQ_Import_preview.csv


- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Added manual column mapping UI to converter GUI so users can map input CSV fields directly (Item/Description/UOM/Qty/Rate/Amount/Remarks). Includes header loader, auto-prefill suggestions, manual/auto toggle, and passes selected mapping into parser.
- Files: temp Workings/boq_converter_gui.py


- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Major workflow upgrade completed: staged 6-step progress model (10/20/40/60/80/100), hierarchy-isolated structured LLM payloads per item block, retry-once LLM error handling with continue, model dropdown + custom model support, and instruction profile CRUD persisted to JSON with load/update/delete in GUI.
- Files: temp Workings/boq_converter.py, temp Workings/boq_converter_gui.py, temp Workings/instruction_profiles.json (runtime)


- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Updated GUI model handling to use only system-installed local models from ollama list in the model dropdown, with auto-refresh on status check. Added dedicated 'Model to Download' textbox used by download action for pulling any required model name.
- Files: temp Workings/boq_converter_gui.py


- Date: 2026-02-11
- Time: [local time]
- Agent: Codex (OpenAI)
- Summary: Aligned parser/summarization with user-defined BOQ workflow: explicit row typing rules (A/B/C and 1/2/3 as ITEM; 1.1/1.2 and a/b/c as SUB_ITEM when no qty; qty rows as MEASUREMENT), phased long-description merging to item/sub-item, hierarchy-isolated LLM text generation per node, and persisted fields for WBS Structure + LLM Text + Short Description.
- Files: temp Workings/boq_converter.py

