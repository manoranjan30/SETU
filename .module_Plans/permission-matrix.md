# SETU Permission Matrix — Complete Module & Functionality Map

> **Status**: ✅ IMPLEMENTED — 2026-02-22
> **Created**: 2026-02-22
> **Purpose**: Define every module, every functionality, and its exact permission code.
> **Implementation Files**:
> - `backend/src/auth/permission-registry.ts` — Single Source of Truth
> - `backend/src/permissions/permissions.service.ts` — DB Registration + Migration
> - `backend/src/auth/permission-config.ts` — Re-exports from registry
> - `frontend/src/config/permissions.ts` — Frontend mirror

---

## 📐 PERMISSION NAMING CONVENTION (Standard Rule)

### Format: `{MODULE}.{ENTITY}.{ACTION}`

```
MODULE    = The top-level domain (EPS, WBS, BOQ, EXECUTION, etc.)
ENTITY    = The specific resource (Node, Item, Entry, Drawing, etc.)
ACTION    = The operation (Read, Create, Update, Delete, Import, Approve, Manage)
```

### Rules for New Modules

| # | Rule | Example |
|---|------|---------|
| 1 | **ALL CAPS** for MODULE name | `EPS`, `WBS`, `BOQ`, `EXECUTION` |
| 2 | **PascalCase** for ENTITY name | `Node`, `Item`, `Entry`, `Drawing` |
| 3 | **PascalCase** for ACTION name | `Read`, `Create`, `Update`, `Delete` |
| 4 | **Dot separator** only | `MODULE.Entity.Action` |
| 5 | Every module MUST have at least a `.Read` permission | `NEWMODULE.Entity.Read` |
| 6 | `Manage` = full CRUD (used for admin-level access) | `LABOR.Category.Manage` |
| 7 | `Approve` = workflow approval/rejection | `EXECUTION.Entry.Approve` |
| 8 | `Import` = bulk data import from files | `SCHEDULE.Schedule.Import` |
| 9 | **No duplicate codes** across the system | — |
| 10 | New permissions must be added to **3 places** (see below) | — |

### Where to Register a New Permission (Checklist)

When creating a new module, you MUST update these 3 files:

| # | File | What to Add |
|---|------|-------------|
| 1 | `backend/src/permissions/permissions.service.ts` | Register in `systemPermissions[]` array |
| 2 | `backend/src/auth/permission-config.ts` | Add to `PERMISSION_DEPENDENCIES` map |
| 3 | `frontend/src/config/permissions.ts` | Add the `PermissionCode` constant |

### Permission Flow (How it Works End-to-End)

```
┌─────────────────────────────────────────────────────────────┐
│  1. SYSTEM BOOT                                             │
│     permissions.service.ts registers all permission codes   │
│     in the `permission` DB table                            │
├─────────────────────────────────────────────────────────────┤
│  2. ADMIN ASSIGNS                                           │
│     Admin → Role Management → Assigns permissions to Roles  │
│     Admin → User Management → Assigns Roles to Users        │
│     Admin → Project Team → Assigns Users to Projects        │
├─────────────────────────────────────────────────────────────┤
│  3. USER LOGIN                                              │
│     auth.service.ts → collects permissions from all roles   │
│     + project-specific role permissions                     │
│     → expandPermissions() adds implied permissions          │
│       (e.g., WBS.Node.Read → auto-gets VIEW_PROJECTS)      │
│     → JWT token = { permissions: [...expanded], roles: [] } │
├─────────────────────────────────────────────────────────────┤
│  4. FRONTEND ROUTE GUARD                                    │
│     App.tsx → <ProtectedRoute permission="VIEW_PROJECTS">   │
│     Checks: user.permissions.includes("VIEW_PROJECTS")      │
│     Admin role → always bypassed ✅                          │
├─────────────────────────────────────────────────────────────┤
│  5. BACKEND API GUARD                                       │
│     @Permissions('WBS.Node.Read') decorator on controller   │
│     permissions.guard.ts checks JWT token permissions        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ SYSTEM-LEVEL PERMISSIONS

These are abstract/system permissions implied automatically by the expansion system.

| Permission Code | Purpose | Who Gets It |
|---|---|---|
| `VIEW_DASHBOARD` | Access the main dashboard | Anyone with any read permission |
| `VIEW_PROJECTS` | Access project pages (WBS, BOQ, etc.) | Auto-implied when user has any module read permission |
| `MANAGE_USERS` | Access User Management | Admin only |
| `MANAGE_ROLES` | Access Role Management | Admin only |
| `MANAGE_EPS` | Create/Edit EPS structure | Admin + Project Manager |
| `AUDIT.READ` | View system audit logs | Admin only |

---

## 📦 MODULE 1: EPS (Enterprise Project Structure)

**Purpose**: Create and manage the project hierarchy (Programs → Projects → Locations)

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View EPS tree | `EPS.Node.Read` | READ | See the full tree |
| 2 | Create EPS node (program/project/folder) | `EPS.Node.Create` | CREATE | Add new nodes |
| 3 | Update EPS node | `EPS.Node.Update` | UPDATE | Rename, reorder |
| 4 | Delete EPS node | `EPS.Node.Delete` | DELETE | Remove nodes |
| 5 | Import project from file | `EPS.Node.Import` | CREATE | 🆕 *Currently unguarded* |
| 6 | View project profile/properties | `PROJECT.Properties.Read` | READ | Project details |
| 7 | Update project profile/properties | `PROJECT.Properties.Update` | UPDATE | Edit project details |

---

## 📦 MODULE 2: PROJECT TEAM

**Purpose**: Assign users to projects with specific roles

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View project team | `PROJECT.Team.Read` | READ | 🆕 *Currently uses MANAGE_EPS* |
| 2 | Assign user to project | `PROJECT.Team.Manage` | SPECIAL | Add/remove team members |
| 3 | Change user status in project | `PROJECT.Team.Manage` | SPECIAL | Activate/deactivate |
| 4 | Remove user from project | `PROJECT.Team.Manage` | SPECIAL | Unassign user |

---

## 📦 MODULE 3: WBS (Work Breakdown Structure)

**Purpose**: Define the project scope structure (Summary Tasks, Work Packages, Activities)

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View WBS tree | `WBS.Node.Read` | READ | See WBS hierarchy |
| 2 | Create WBS node | `WBS.Node.Create` | CREATE | Add sections/packages |
| 3 | Update WBS node | `WBS.Node.Update` | UPDATE | Rename, reorder |
| 4 | Delete WBS node | `WBS.Node.Delete` | DELETE | Remove nodes |
| 5 | View activities | `WBS.Activity.Read` | READ | See activities under WBS |
| 6 | Create activity | `WBS.Activity.Create` | CREATE | Add activities |
| 7 | Update activity | `WBS.Activity.Update` | UPDATE | Edit activity properties |
| 8 | Delete activity | `WBS.Activity.Delete` | DELETE | Remove activities |
| 9 | Apply WBS template | `WBS.Template.Apply` | CREATE | Apply pre-built template |
| 10 | Save as template | `WBS.Template.Manage` | SPECIAL | Save current WBS as template |
| 11 | Import WBS from file | `WBS.Node.Import` | CREATE | 🆕 *Currently unguarded* |

---

## 📦 MODULE 4: WBS TEMPLATES

**Purpose**: Manage reusable WBS structure templates

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View template list | `WBS.Template.Read` | READ | Browse templates |
| 2 | Create template | `WBS.Template.Manage` | SPECIAL | Build new template |
| 3 | Edit template nodes | `WBS.Template.Manage` | SPECIAL | Modify template |
| 4 | Delete template | `WBS.Template.Manage` | SPECIAL | Remove template |

---

## 📦 MODULE 5: SCHEDULE (Planning & Calendar)

**Purpose**: CPM scheduling, critical path, baselines, look-ahead plans

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View schedule / Gantt chart | `SCHEDULE.Schedule.Read` | READ | Read schedule data |
| 2 | Calculate/recalculate schedule | `SCHEDULE.Schedule.Update` | UPDATE | Run CPM engine |
| 3 | Import schedule from file | `SCHEDULE.Schedule.Import` | CREATE | P6/Excel import |
| 4 | Repair durations | `SCHEDULE.Schedule.Update` | UPDATE | Fix inconsistencies |
| 5 | Reschedule (push plan) | `SCHEDULE.Schedule.Update` | UPDATE | Recovery schedule |
| 6 | Create baseline version | `SCHEDULE.Version.Create` | CREATE | 🆕 Save snapshot |
| 7 | View baseline versions | `SCHEDULE.Version.Read` | READ | 🆕 Compare versions |
| 8 | Compare baselines | `SCHEDULE.Version.Read` | READ | 🆕 Side-by-side |
| 9 | View calendar | `SCHEDULE.Calendar.Read` | READ | See working calendars |
| 10 | Create calendar | `SCHEDULE.Calendar.Create` | CREATE | New calendar |
| 11 | Update calendar | `SCHEDULE.Calendar.Update` | UPDATE | Edit calendar |
| 12 | Delete calendar | `SCHEDULE.Calendar.Delete` | DELETE | Remove calendar |

---

## 📦 MODULE 6: BOQ (Bill of Quantities)

**Purpose**: Cost/scope management — items, quantities, measurements

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View BOQ items | `BOQ.Item.Read` | READ | See bill of quantities |
| 2 | Create BOQ item | `BOQ.Item.Create` | CREATE | Add new line items |
| 3 | Update BOQ item | `BOQ.Item.Update` | UPDATE | Edit qty, rate, description |
| 4 | Delete BOQ item | `BOQ.Item.Delete` | DELETE | Remove items |
| 5 | Import BOQ from file | `BOQ.Item.Import` | CREATE | Excel import |
| 6 | Export BOQ to file | `BOQ.Item.Read` | READ | Download template |
| 7 | Create sub-item | `BOQ.Item.Create` | CREATE | Nested items |
| 8 | Manage measurements | `BOQ.Measurement.Manage` | SPECIAL | 🆕 Add/edit/delete measurements |
| 9 | Import measurements from file | `BOQ.Measurement.Import` | CREATE | 🆕 Bulk measurement import |
| 10 | Log BOQ progress | `BOQ.Progress.Create` | CREATE | 🆕 Track quantity progress |

---

## 📦 MODULE 7: PLANNING (Execution Mapping)

**Purpose**: Link BOQ ↔ Schedule, distribution matrix, gap analysis

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View distribution matrix | `PLANNING.Matrix.Read` | READ | See BOQ-Schedule mapping |
| 2 | Distribute (link BOQ to schedule) | `PLANNING.Matrix.Update` | UPDATE | Create/edit mappings |
| 3 | Undistribute (remove links) | `PLANNING.Matrix.Update` | UPDATE | Remove mappings |
| 4 | View gap analysis | `PLANNING.Analysis.Read` | READ | Unlinked items report |
| 5 | View execution readiness | `PLANNING.Analysis.Read` | READ | Readiness check |
| 6 | Create recovery plan | `PLANNING.Recovery.Manage` | SPECIAL | 🆕 Recovery schedule |
| 7 | Schedule distribution | `PLANNING.Matrix.Update` | UPDATE | Distribute schedules |
| 8 | Create look-ahead plan | `PLANNING.LookAhead.Create` | CREATE | 🆕 Short-term plan |

---

## 📦 MODULE 8: EXECUTION (Site Progress)

**Purpose**: Daily progress entry, micro-schedules, approvals

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View progress logs | `EXECUTION.Entry.Read` | READ | See daily entries |
| 2 | Log daily progress | `EXECUTION.Entry.Create` | CREATE | Submit work done |
| 3 | Edit progress log | `EXECUTION.Entry.Update` | UPDATE | Modify entries |
| 4 | Delete progress log | `EXECUTION.Entry.Delete` | DELETE | 🆕 Remove entry |
| 5 | View breakdown (activities) | `EXECUTION.Entry.Read` | READ | Execution activities |
| 6 | Submit micro-schedule log | `EXECUTION.Micro.Create` | CREATE | 🆕 Micro-level progress |
| 7 | View pending approvals | `EXECUTION.Entry.Approve` | SPECIAL | View approval queue |
| 8 | Approve progress entry | `EXECUTION.Entry.Approve` | SPECIAL | Accept submission |
| 9 | Reject progress entry | `EXECUTION.Entry.Approve` | SPECIAL | Reject submission |

---

## 📦 MODULE 9: MICRO SCHEDULE

**Purpose**: Detailed short-term scheduling per activity

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View micro schedules | `MICRO.Schedule.Read` | READ | 🆕 See micro plans |
| 2 | Create micro schedule | `MICRO.Schedule.Create` | CREATE | 🆕 Build micro plan |
| 3 | Update micro schedule | `MICRO.Schedule.Update` | UPDATE | 🆕 Edit details |
| 4 | Delete micro schedule | `MICRO.Schedule.Delete` | DELETE | 🆕 Remove plan |
| 5 | Submit micro schedule | `MICRO.Schedule.Submit` | SPECIAL | 🆕 Send for approval |
| 6 | Approve micro schedule | `MICRO.Schedule.Approve` | SPECIAL | 🆕 Approve plan |
| 7 | Activate micro schedule | `MICRO.Schedule.Manage` | SPECIAL | 🆕 Activate for execution |
| 8 | View micro activities | `MICRO.Activity.Read` | READ | 🆕 See breakdown |
| 9 | Create micro activity | `MICRO.Activity.Create` | CREATE | 🆕 Add activity |
| 10 | Update micro activity | `MICRO.Activity.Update` | UPDATE | 🆕 Edit activity |
| 11 | Delete micro activity | `MICRO.Activity.Delete` | DELETE | 🆕 Remove activity |
| 12 | Log daily micro progress | `MICRO.Log.Create` | CREATE | 🆕 Daily entry |
| 13 | Edit micro progress log | `MICRO.Log.Update` | UPDATE | 🆕 Modify log |
| 14 | Delete micro progress log | `MICRO.Log.Delete` | DELETE | 🆕 Remove log |

---

## 📦 MODULE 10: PROGRESS (Analytics Dashboard)

**Purpose**: Project-level analytics — S-curves, plan vs actual

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View progress stats/S-curve | `PROGRESS.Dashboard.Read` | READ | 🆕 Analytics view |
| 2 | View plan vs achieved chart | `PROGRESS.Dashboard.Read` | READ | 🆕 S-curve comparison |
| 3 | View AI insights | `PROGRESS.Insights.Read` | READ | 🆕 AI recommendations |

---

## 📦 MODULE 11: LABOR (Manpower)

**Purpose**: Track labor categories, attendance, allocations

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View labor categories | `LABOR.Category.Read` | READ | 🆕 See categories |
| 2 | Create labor category | `LABOR.Category.Manage` | SPECIAL | Add category |
| 3 | View attendance/presence | `LABOR.Entry.Read` | READ | Daily counts |
| 4 | Log attendance | `LABOR.Entry.Create` | CREATE | Submit headcount |
| 5 | View activity allocations | `LABOR.Entry.Read` | READ | Per-activity breakdown |
| 6 | Manage activity mapping | `LABOR.Mapping.Manage` | SPECIAL | 🆕 Link labor to activities |
| 7 | Import labor data | `LABOR.Entry.Import` | CREATE | 🆕 Bulk import |

---

## 📦 MODULE 12: EHS (Environment, Health & Safety)

**Purpose**: Safety management — incidents, inspections, compliance

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View EHS summary/dashboard | `EHS.Dashboard.Read` | READ | 🆕 Safety overview |
| 2 | View safety observations | `EHS.Observation.Read` | READ | 🆕 See observations |
| 3 | Create observation | `EHS.Observation.Create` | CREATE | 🆕 Log observation |
| 4 | Update observation | `EHS.Observation.Update` | UPDATE | 🆕 Edit observation |
| 5 | View incidents | `EHS.Incident.Read` | READ | 🆕 See incident log |
| 6 | Create incident | `EHS.Incident.Create` | CREATE | Log new incident |
| 7 | View inspections | `EHS.Inspection.Read` | READ | 🆕 See inspections |
| 8 | Create inspection | `EHS.Inspection.Create` | CREATE | Perform inspection |
| 9 | Update inspection | `EHS.Inspection.Update` | UPDATE | 🆕 Edit inspection |
| 10 | Delete inspection | `EHS.Inspection.Delete` | DELETE | 🆕 Remove inspection |
| 11 | View trainings | `EHS.Training.Read` | READ | 🆕 See training log |
| 12 | Create training | `EHS.Training.Create` | CREATE | 🆕 Log training |
| 13 | Update training | `EHS.Training.Update` | UPDATE | 🆕 Edit training |
| 14 | Delete training | `EHS.Training.Delete` | DELETE | 🆕 Remove training |
| 15 | View environmental records | `EHS.Environmental.Read` | READ | 🆕 |
| 16 | Create environmental record | `EHS.Environmental.Create` | CREATE | 🆕 |
| 17 | View legal compliance | `EHS.Legal.Read` | READ | 🆕 |
| 18 | Manage legal compliance | `EHS.Legal.Manage` | SPECIAL | 🆕 |
| 19 | Manage machinery records | `EHS.Machinery.Manage` | SPECIAL | 🆕 |
| 20 | Manage performance metrics | `EHS.Performance.Manage` | SPECIAL | 🆕 |
| 21 | Manage competencies | `EHS.Competency.Manage` | SPECIAL | 🆕 |
| 22 | Manage vehicles | `EHS.Vehicle.Manage` | SPECIAL | 🆕 |
| 23 | Manage incident register | `EHS.IncidentRegister.Manage` | SPECIAL | 🆕 |
| 24 | View manhour data | `EHS.Manhour.Read` | READ | 🆕 |
| 25 | Log manhour data | `EHS.Manhour.Create` | CREATE | 🆕 |

---

## 📦 MODULE 13: QUALITY (QA/QC)

**Purpose**: Quality control — inspections, checklists, material tests, NCR, snags

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View quality summary | `QUALITY.Dashboard.Read` | READ | 🆕 QC overview |
| 2 | View quality checklists | `QUALITY.Checklist.Read` | READ | 🆕 See checklists |
| 3 | Create checklist | `QUALITY.Checklist.Create` | CREATE | 🆕 New checklist |
| 4 | Update checklist | `QUALITY.Checklist.Update` | UPDATE | 🆕 Edit checklist |
| 5 | Delete checklist | `QUALITY.Checklist.Delete` | DELETE | 🆕 Remove |
| 6 | View material tests | `QUALITY.Test.Read` | READ | 🆕 See tests |
| 7 | Create material test | `QUALITY.Test.Create` | CREATE | 🆕 |
| 8 | Update material test | `QUALITY.Test.Update` | UPDATE | 🆕 |
| 9 | Delete material test | `QUALITY.Test.Delete` | DELETE | 🆕 |
| 10 | View NCR/observations | `QUALITY.NCR.Read` | READ | 🆕 |
| 11 | Create NCR/observation | `QUALITY.NCR.Create` | CREATE | 🆕 |
| 12 | Update NCR/observation | `QUALITY.NCR.Update` | UPDATE | 🆕 |
| 13 | Delete NCR/observation | `QUALITY.NCR.Delete` | DELETE | 🆕 |
| 14 | View snag list | `QUALITY.Snag.Read` | READ | 🆕 |
| 15 | Create snag | `QUALITY.Snag.Create` | CREATE | 🆕 |
| 16 | Update snag | `QUALITY.Snag.Update` | UPDATE | 🆕 |
| 17 | Delete snag | `QUALITY.Snag.Delete` | DELETE | 🆕 |
| 18 | View audits | `QUALITY.Audit.Read` | READ | 🆕 |
| 19 | Create audit | `QUALITY.Audit.Create` | CREATE | 🆕 |
| 20 | Update audit | `QUALITY.Audit.Update` | UPDATE | 🆕 |
| 21 | Delete audit | `QUALITY.Audit.Delete` | DELETE | 🆕 |
| 22 | View quality documents | `QUALITY.Document.Read` | READ | 🆕 |
| 23 | Manage quality documents | `QUALITY.Document.Manage` | SPECIAL | 🆕 |
| 24 | View activity lists | `QUALITY.ActivityList.Read` | READ | 🆕 |
| 25 | Create activity list | `QUALITY.ActivityList.Create` | CREATE | 🆕 |
| 26 | Update activity list | `QUALITY.ActivityList.Update` | UPDATE | 🆕 |
| 27 | Delete activity list | `QUALITY.ActivityList.Delete` | DELETE | 🆕 |
| 28 | Clone activity list | `QUALITY.ActivityList.Manage` | SPECIAL | 🆕 |
| 29 | View quality activities | `QUALITY.Activity.Read` | READ | 🆕 |
| 30 | Create quality activity | `QUALITY.Activity.Create` | CREATE | 🆕 |
| 31 | Update quality activity | `QUALITY.Activity.Update` | UPDATE | 🆕 |
| 32 | Delete quality activity | `QUALITY.Activity.Delete` | DELETE | 🆕 |
| 33 | View sequence graph | `QUALITY.Sequence.Read` | READ | 🆕 |
| 34 | Update sequence graph | `QUALITY.Sequence.Update` | UPDATE | 🆕 |
| 35 | View inspections (RFI) | `QUALITY.Inspection.Read` | READ | 🆕 |
| 36 | Raise inspection (RFI) | `QUALITY.Inspection.Raise` | CREATE | Submit RFI |
| 37 | Approve inspection | `QUALITY.Inspection.Approve` | SPECIAL | Accept/Reject RFI |
| 38 | Manage structure templates | `QUALITY.Structure.Manage` | SPECIAL | 🆕 |

---

## 📦 MODULE 14: DESIGN (Drawings)

**Purpose**: Drawing register, revision management, GFC approvals

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View drawing categories | `DESIGN.Category.Read` | READ | 🆕 Browse categories |
| 2 | Create drawing category | `DESIGN.Category.Create` | CREATE | 🆕 |
| 3 | View drawing register | `DESIGN.Drawing.Read` | READ | Browse drawings |
| 4 | Create drawing entry | `DESIGN.Drawing.Create` | CREATE | 🆕 Register new drawing |
| 5 | Upload drawing revision | `DESIGN.Drawing.Upload` | CREATE | Upload file |
| 6 | Download drawing | `DESIGN.Drawing.Read` | READ | Download file |
| 7 | View revisions | `DESIGN.Drawing.Read` | READ | See revision history |
| 8 | Update drawing details | `DESIGN.Drawing.Update` | UPDATE | 🆕 Edit metadata |
| 9 | Delete drawing | `DESIGN.Drawing.Delete` | DELETE | Remove drawing |
| 10 | Approve drawing (GFC) | `DESIGN.Drawing.Approve` | SPECIAL | Approve for construction |

---

## 📦 MODULE 15: WORK ORDERS (Vendor Management)

**Purpose**: Work orders, vendor management, BOQ-WO mapping

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View vendors | `WORKORDER.Vendor.Read` | READ | 🆕 |
| 2 | Create vendor | `WORKORDER.Vendor.Create` | CREATE | 🆕 |
| 3 | Update vendor | `WORKORDER.Vendor.Update` | UPDATE | 🆕 |
| 4 | Delete vendor | `WORKORDER.Vendor.Delete` | DELETE | 🆕 |
| 5 | View work orders | `WORKORDER.Order.Read` | READ | 🆕 |
| 6 | Analyze WO PDF | `WORKORDER.Order.Create` | CREATE | 🆕 PDF upload |
| 7 | Import WO Excel | `WORKORDER.Order.Import` | CREATE | 🆕 Excel import |
| 8 | Delete work order | `WORKORDER.Order.Delete` | DELETE | 🆕 |
| 9 | Map WO items to BOQ | `WORKORDER.Mapping.Manage` | SPECIAL | 🆕 |
| 10 | View mapping suggestions | `WORKORDER.Mapping.Read` | READ | 🆕 |
| 11 | Auto-map items | `WORKORDER.Mapping.Manage` | SPECIAL | 🆕 |
| 12 | Manage WO templates | `WORKORDER.Template.Manage` | SPECIAL | 🆕 |

---

## 📦 MODULE 16: RESOURCES (Master Data)

**Purpose**: Resource master list, resource templates, project resource mapping

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View resource master | `RESOURCE.Master.Read` | READ | 🆕 |
| 2 | Create resource | `RESOURCE.Master.Create` | CREATE | 🆕 |
| 3 | Update resource | `RESOURCE.Master.Update` | UPDATE | 🆕 |
| 4 | Delete resource | `RESOURCE.Master.Delete` | DELETE | 🆕 |
| 5 | Import resources | `RESOURCE.Master.Import` | CREATE | 🆕 |
| 6 | Manage resource templates | `RESOURCE.Template.Manage` | SPECIAL | 🆕 |

---

## 📦 MODULE 17: DASHBOARD (Management View)

**Purpose**: Executive summary, burn rate, milestones, alerts

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View management dashboard | `VIEW_DASHBOARD` | READ | System-level |
| 2 | View project summary | `DASHBOARD.Summary.Read` | READ | 🆕 |
| 3 | View burn rate chart | `DASHBOARD.Analytics.Read` | READ | 🆕 |
| 4 | View milestones | `DASHBOARD.Analytics.Read` | READ | 🆕 |
| 5 | View alerts | `DASHBOARD.Alerts.Read` | READ | 🆕 |

---

## 📦 MODULE 18: ADMIN (Users, Roles, Settings)

**Purpose**: User management, role management, system settings

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View users | `USER.Management.Read` | READ | |
| 2 | Create user | `USER.Management.Create` | CREATE | |
| 3 | Update user | `USER.Management.Update` | UPDATE | |
| 4 | Delete user | `USER.Management.Delete` | DELETE | |
| 5 | View roles | `ROLE.Management.Read` | READ | |
| 6 | Create role | `ROLE.Management.Create` | CREATE | |
| 7 | Update role | `ROLE.Management.Update` | UPDATE | |
| 8 | Delete role | `ROLE.Management.Delete` | DELETE | |
| 9 | View audit logs | `AUDIT.Log.Read` | READ | |
| 10 | Manage system settings | `ADMIN.Settings.Manage` | SPECIAL | 🆕 |
| 11 | Manage report templates | `ADMIN.Template.Manage` | SPECIAL | 🆕 |

---

## 📦 MODULE 19: TEMPLATE BUILDER (Checklist Templates)

**Purpose**: Create/manage checklist templates for quality & other modules

| # | Functionality | Permission Code | Action | Notes |
|---|---|---|---|---|
| 1 | View templates | `TEMPLATE.Builder.Read` | READ | 🆕 |
| 2 | Create template | `TEMPLATE.Builder.Create` | CREATE | 🆕 |
| 3 | Update template | `TEMPLATE.Builder.Update` | UPDATE | 🆕 |
| 4 | Delete template | `TEMPLATE.Builder.Delete` | DELETE | 🆕 |
| 5 | Import template | `TEMPLATE.Builder.Import` | CREATE | 🆕 |
| 6 | Export template | `TEMPLATE.Builder.Read` | READ | 🆕 |

---

## ⚠️ DUPLICATE/CONFLICTING PERMISSIONS (Current State)

These are duplicates or inconsistencies in the **current** system that need cleanup:

| Current Code (DB) | Also Exists As | Problem | Resolution |
|---|---|---|---|
| `EHS.Read` | `EHS.READ` (backend config) | Different casing | Standardize to `EHS.Dashboard.Read` |
| `Quality.Read` | `QUALITY.READ` (backend config) | Different casing | Standardize to `QUALITY.Dashboard.Read` |
| `EXECUTION.READ` (config only) | `Execution.Entry.Read` (DB) | Config vs DB mismatch | Remove from config, use DB code |
| `PLANNING.READ` (config only) | No DB equivalent | Ghost permission | Remove, use `SCHEDULE.Schedule.Read` |
| `BOQ.READ` (config only) | `BOQ.Item.Read` (DB) | Config vs DB mismatch | Remove from config, use DB code |
| `DESIGN.READ` (config only) | `Design.Drawing.Read` (DB) | Config vs DB mismatch | Remove from config, use DB code |
| `LABOR.READ` (config only) | `Labor.Entry.Read` (DB) | Config vs DB mismatch | Remove from config, use DB code |
| `EHS.READ` (config only) | `EHS.Read` (DB) | Casing mismatch | Remove from config, use DB code |
| `MANAGE_USERS` (system) | `User.Management.*` (DB) | Legacy + granular overlap | Keep both — MANAGE_USERS is implied |
| `MANAGE_ROLES` (system) | `Role.Management.*` (DB) | Legacy + granular overlap | Keep both — MANAGE_ROLES is implied |
| `VIEW_DASHBOARD` (system) | `SYSTEM.DASHBOARD.VIEW` (old frontend) | Frontend had wrong code | ✅ Fixed in this session |
| `MANAGE_EPS` (system) | `EPS.NODE.MANAGE` (old frontend) | Frontend had wrong code | ✅ Fixed in this session |

---

## 📋 NEXT STEPS

1. **Review this document** — Confirm module list and functionality coverage
2. **Decide on permissions per role** — Which roles get which permissions
3. **Clean up duplicates** — Standardize all codes to the `MODULE.Entity.Action` format
4. **Register new permissions** — Add 🆕 marked permissions to the 3 required files
5. **Apply backend guards** — Add `@Permissions()` decorators to all controller endpoints
6. **Test each role** — Verify each role can only access what it should

---

## 📋 ROLE SUGGESTION MATRIX (Draft)

| Permission Area | Admin | Project Manager | Site Engineer | QC Engineer | User (Basic) |
|---|:---:|:---:|:---:|:---:|:---:|
| **System** (Users, Roles) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **EPS** (Create/Edit) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **WBS** (Structure) | ✅ | ✅ | Read | ❌ | Read |
| **Schedule** (Plan) | ✅ | ✅ | Read | ❌ | Read |
| **BOQ** (Cost) | ✅ | ✅ | Read | Read | Read |
| **Execution** (Progress) | ✅ | Read + Approve | CRUD | ❌ | Read |
| **Micro Schedule** | ✅ | Create + Approve | CRUD | ❌ | ❌ |
| **Quality** (QA/QC) | ✅ | Read + Approve | Raise RFI | Full CRUD + Approve | Read |
| **Design** (Drawings) | ✅ | Read + Approve | Read | Read | Read |
| **EHS** (Safety) | ✅ | CRUD | CRUD | Read | Read |
| **Labor** (Manpower) | ✅ | Read | CRUD | ❌ | ❌ |
| **Work Orders** | ✅ | Full | Read | ❌ | ❌ |
| **Dashboard** | ✅ | ✅ | Read | Read | Read |
