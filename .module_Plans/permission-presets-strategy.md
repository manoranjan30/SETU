# SETU — Permission Presets Strategy
# Action Templates for Role Assignment

> **Status**: 📋 PLAN — 2026-02-23
> **Purpose**: Define reusable "Permission Preset" bundles that can be applied to
>  any role in one click — just like how we grouped `EXECUTION.ENTRY.READ` +
>  `PLANNING.MATRIX.READ` to unblock Site Engineers for progress entry.
>
> **Core Idea**: Instead of picking 40+ individual permissions one by one,
>  an admin selects a **Preset** (e.g., "Progress Entry Operator") and all
>  required permissions are bundled in. Presets can be stacked (combined).

---

## 📐 PRESET DESIGN PRINCIPLES

| # | Principle | Explanation |
|---|-----------|-------------|
| 1 | **Job-Based** | Each preset maps to a real job action ("What does this person DO?") |
| 2 | **Minimal** | Each preset contains the *minimum* permissions to complete that job |
| 3 | **Stackable** | Presets combine cleanly — no conflicts, no redundancy |
| 4 | **Read-Implies-Access** | Every preset automatically inherits VIEW_DASHBOARD + VIEW_PROJECTS |
| 5 | **No Overlap** | Presets are orthogonal — each one covers a distinct job boundary |
| 6 | **Auditable** | Each preset has a clear name, description, and permission list |

---

## 🏗️ PRESET TIER STRUCTURE

Every permission in the system falls into one of 3 tiers:

```
TIER 1 — READ ONLY    : Can see data, cannot change anything
TIER 2 — CONTRIBUTOR  : Can create and update (not delete, not approve)
TIER 3 — FULL CONTROL : CRUD + approvals + management actions
```

Each module has its own TIER 1 / 2 / 3. A preset is a named bundle
that selects specific tiers across specific modules.

---

## 📦 MODULE-BY-MODULE TIER BREAKDOWN

### 🔷 MODULE: EPS (Project Structure)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | EPS Viewer | `EPS.NODE.READ` |
| T2 | EPS Editor | `EPS.NODE.READ` + `EPS.NODE.CREATE` + `EPS.NODE.UPDATE` |
| T3 | EPS Admin | All T2 + `EPS.NODE.DELETE` + `EPS.NODE.IMPORT` + `MANAGE_EPS` |

---

### 🔷 MODULE: WBS (Work Breakdown Structure)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | WBS Viewer | `WBS.NODE.READ` + `WBS.ACTIVITY.READ` |
| T2 | WBS Builder | All T1 + `WBS.NODE.CREATE` + `WBS.NODE.UPDATE` + `WBS.ACTIVITY.CREATE` + `WBS.ACTIVITY.UPDATE` + `WBS.TEMPLATE.READ` + `WBS.TEMPLATE.APPLY` |
| T3 | WBS Admin | All T2 + `WBS.NODE.DELETE` + `WBS.NODE.IMPORT` + `WBS.ACTIVITY.DELETE` + `WBS.TEMPLATE.MANAGE` |

---

### 🔷 MODULE: SCHEDULE (CPM Planning)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Schedule Viewer | `SCHEDULE.READ` + `SCHEDULE.VERSION.READ` + `SCHEDULE.CALENDAR.READ` |
| T2 | Schedule Planner | All T1 + `SCHEDULE.UPDATE` + `SCHEDULE.IMPORT` + `SCHEDULE.VERSION.CREATE` + `SCHEDULE.CALENDAR.CREATE` + `SCHEDULE.CALENDAR.UPDATE` |
| T3 | Schedule Admin | All T2 + `SCHEDULE.CALENDAR.DELETE` |

---

### 🔷 MODULE: BOQ (Bill of Quantities)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | BOQ Viewer | `BOQ.ITEM.READ` |
| T2 | BOQ Contributor | All T1 + `BOQ.ITEM.CREATE` + `BOQ.ITEM.UPDATE` + `BOQ.MEASUREMENT.MANAGE` + `BOQ.MEASUREMENT.IMPORT` + `BOQ.PROGRESS.CREATE` |
| T3 | BOQ Admin | All T2 + `BOQ.ITEM.DELETE` + `BOQ.ITEM.IMPORT` |

---

### 🔷 MODULE: PLANNING (Distribution Matrix)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Planning Viewer | `PLANNING.MATRIX.READ` + `PLANNING.ANALYSIS.READ` |
| T2 | Planning Editor | All T1 + `PLANNING.MATRIX.UPDATE` + `PLANNING.LOOKAHEAD.CREATE` |
| T3 | Planning Admin | All T2 + `PLANNING.RECOVERY.MANAGE` |

---

### 🔷 MODULE: EXECUTION (Site Progress Entry)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Progress Viewer | `EXECUTION.ENTRY.READ` + `PLANNING.MATRIX.READ` |
| T2 | Progress Entry Operator | All T1 + `EXECUTION.ENTRY.CREATE` + `EXECUTION.ENTRY.UPDATE` + `EXECUTION.MICRO.CREATE` |
| T3 | Progress Approver | All T2 + `EXECUTION.ENTRY.DELETE` + `EXECUTION.ENTRY.APPROVE` |

> 💡 **Key Insight**: T1 requires PLANNING.MATRIX.READ because the
>  execution-ready endpoint is in the Planning controller. This was the
>  bug we fixed for Site Engineers — the preset captures this dependency.

---

### 🔷 MODULE: MICRO SCHEDULE

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Micro Viewer | `MICRO.SCHEDULE.READ` + `MICRO.ACTIVITY.READ` |
| T2 | Micro Planner | All T1 + `MICRO.SCHEDULE.CREATE` + `MICRO.SCHEDULE.UPDATE` + `MICRO.SCHEDULE.SUBMIT` + `MICRO.ACTIVITY.CREATE` + `MICRO.ACTIVITY.UPDATE` + `MICRO.LOG.CREATE` + `MICRO.LOG.UPDATE` |
| T3 | Micro Admin | All T2 + `MICRO.SCHEDULE.DELETE` + `MICRO.ACTIVITY.DELETE` + `MICRO.LOG.DELETE` + `MICRO.SCHEDULE.APPROVE` + `MICRO.SCHEDULE.MANAGE` |

---

### 🔷 MODULE: PROGRESS (Analytics)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Analytics Viewer | `PROGRESS.DASHBOARD.READ` |
| T2 | Analytics + AI | All T1 + `PROGRESS.INSIGHTS.READ` |
| T3 | (same as T2) | — |

---

### 🔷 MODULE: LABOR (Manpower)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Labor Viewer | `LABOR.CATEGORY.READ` + `LABOR.ENTRY.READ` |
| T2 | Labor Entry Operator | All T1 + `LABOR.ENTRY.CREATE` + `LABOR.MAPPING.MANAGE` |
| T3 | Labor Admin | All T2 + `LABOR.CATEGORY.MANAGE` + `LABOR.ENTRY.IMPORT` |

---

### 🔷 MODULE: EHS (Safety)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | EHS Viewer | `EHS.DASHBOARD.READ` + `EHS.OBSERVATION.READ` + `EHS.INCIDENT.READ` + `EHS.INSPECTION.READ` + `EHS.TRAINING.READ` + `EHS.MANHOUR.READ` |
| T2 | EHS Field Officer | All T1 + `EHS.OBSERVATION.CREATE` + `EHS.OBSERVATION.UPDATE` + `EHS.INCIDENT.CREATE` + `EHS.INSPECTION.CREATE` + `EHS.INSPECTION.UPDATE` + `EHS.TRAINING.CREATE` + `EHS.MANHOUR.CREATE` + `EHS.ENVIRONMENTAL.READ` + `EHS.ENVIRONMENTAL.CREATE` |
| T3 | EHS Manager | All T2 + `EHS.OBSERVATION.DELETE` + `EHS.INCIDENT.DELETE` + `EHS.INSPECTION.DELETE` + `EHS.TRAINING.DELETE` + `EHS.LEGAL.READ` + `EHS.LEGAL.MANAGE` + `EHS.MACHINERY.MANAGE` + `EHS.PERFORMANCE.MANAGE` + `EHS.COMPETENCY.MANAGE` + `EHS.VEHICLE.MANAGE` + `EHS.INCIDENTREGISTER.MANAGE` |

---

### 🔷 MODULE: QUALITY (QA/QC)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Quality Viewer | `QUALITY.DASHBOARD.READ` + `QUALITY.CHECKLIST.READ` + `QUALITY.ACTIVITYLIST.READ` + `QUALITY.ACTIVITY.READ` + `QUALITY.SEQUENCE.READ` + `QUALITY.INSPECTION.READ` + `QUALITY.NCR.READ` + `QUALITY.SNAG.READ` |
| T2 | QC Field Inspector | All T1 + `QUALITY.INSPECTION.RAISE` + `QUALITY.NCR.CREATE` + `QUALITY.NCR.UPDATE` + `QUALITY.SNAG.CREATE` + `QUALITY.SNAG.UPDATE` + `QUALITY.TEST.READ` + `QUALITY.TEST.CREATE` + `QUALITY.TEST.UPDATE` |
| T3 | QC Manager | All T2 + `QUALITY.CHECKLIST.CREATE` + `QUALITY.CHECKLIST.UPDATE` + `QUALITY.CHECKLIST.DELETE` + `QUALITY.ACTIVITYLIST.CREATE` + `QUALITY.ACTIVITYLIST.UPDATE` + `QUALITY.ACTIVITYLIST.DELETE` + `QUALITY.ACTIVITYLIST.MANAGE` + `QUALITY.ACTIVITY.CREATE` + `QUALITY.ACTIVITY.UPDATE` + `QUALITY.ACTIVITY.DELETE` + `QUALITY.SEQUENCE.UPDATE` + `QUALITY.INSPECTION.APPROVE` + `QUALITY.NCR.DELETE` + `QUALITY.SNAG.DELETE` + `QUALITY.TEST.DELETE` + `QUALITY.AUDIT.READ` + `QUALITY.AUDIT.CREATE` + `QUALITY.DOCUMENT.READ` + `QUALITY.DOCUMENT.MANAGE` + `QUALITY.STRUCTURE.MANAGE` |

---

### 🔷 MODULE: DESIGN (Drawings)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Drawings Viewer | `DESIGN.CATEGORY.READ` + `DESIGN.DRAWING.READ` |
| T2 | Drawings Contributor | All T1 + `DESIGN.CATEGORY.CREATE` + `DESIGN.DRAWING.CREATE` + `DESIGN.DRAWING.UPLOAD` + `DESIGN.DRAWING.UPDATE` |
| T3 | Drawings Admin | All T2 + `DESIGN.DRAWING.DELETE` + `DESIGN.DRAWING.APPROVE` |

---

### 🔷 MODULE: WORK ORDERS (Vendor)

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Work Order Viewer | `WORKORDER.ORDER.READ` + `WORKORDER.VENDOR.READ` + `WORKORDER.MAPPING.READ` |
| T2 | Work Order Manager | All T1 + `WORKORDER.VENDOR.CREATE` + `WORKORDER.VENDOR.UPDATE` + `WORKORDER.ORDER.CREATE` + `WORKORDER.ORDER.IMPORT` + `WORKORDER.MAPPING.MANAGE` |
| T3 | Work Order Admin | All T2 + `WORKORDER.VENDOR.DELETE` + `WORKORDER.ORDER.DELETE` + `WORKORDER.TEMPLATE.MANAGE` |

---

### 🔷 MODULE: RESOURCES

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Resource Viewer | `RESOURCE.MASTER.READ` |
| T2 | Resource Editor | All T1 + `RESOURCE.MASTER.CREATE` + `RESOURCE.MASTER.UPDATE` + `RESOURCE.MASTER.IMPORT` |
| T3 | Resource Admin | All T2 + `RESOURCE.MASTER.DELETE` + `RESOURCE.TEMPLATE.MANAGE` |

---

### 🔷 MODULE: DASHBOARD

| Tier | Name | Permissions |
|------|------|-------------|
| T1 | Dashboard Viewer | `DASHBOARD.SUMMARY.READ` + `DASHBOARD.ALERTS.READ` |
| T2 | Analytics Viewer | All T1 + `DASHBOARD.ANALYTICS.READ` + `PROGRESS.DASHBOARD.READ` + `PROGRESS.INSIGHTS.READ` |
| T3 | (same as T2) | — |

---

## 🎯 NAMED PERMISSION PRESETS (Ready-to-Use Bundles)

These are the actual **presets** that appear in the Role Management UI.
Each preset is a named bundle of permissions that maps to a real job function.

---

### PRESET GROUP A — PROJECT EXECUTION (Field Team)

---

#### 🟢 PRESET: `PROGRESS_VIEWER`
**"Can view site progress but cannot enter anything"**

| Module | Tier |
|--------|------|
| EPS | T1 |
| WBS | T1 |
| Schedule | T1 |
| BOQ | T1 |
| Planning | T1 |
| Execution | T1 |
| Micro Schedule | T1 |
| Progress Analytics | T1 |
| Dashboard | T1 |

**Permissions included:**
```
EPS.NODE.READ
WBS.NODE.READ, WBS.ACTIVITY.READ
SCHEDULE.READ, SCHEDULE.VERSION.READ, SCHEDULE.CALENDAR.READ
BOQ.ITEM.READ
PLANNING.MATRIX.READ, PLANNING.ANALYSIS.READ
EXECUTION.ENTRY.READ
MICRO.SCHEDULE.READ, MICRO.ACTIVITY.READ
PROGRESS.DASHBOARD.READ
DASHBOARD.SUMMARY.READ, DASHBOARD.ALERTS.READ
```
**Count: 14 permissions**
**Use For:** Management, Auditors, External Stakeholders

---

#### 🟡 PRESET: `PROGRESS_ENTRY_OPERATOR`
**"Can view schedule, and submit daily site progress"**

| Module | Tier |
|--------|------|
| EPS | T1 |
| WBS | T1 |
| Schedule | T1 |
| BOQ | T1 |
| Planning | T1 |
| Execution | **T2** |
| Micro Schedule | T1 |
| Progress Analytics | T1 |

**Permissions included** (everything in PROGRESS_VIEWER +):
```
+ EXECUTION.ENTRY.CREATE
+ EXECUTION.ENTRY.UPDATE
+ EXECUTION.MICRO.CREATE
+ MICRO.LOG.CREATE
+ MICRO.LOG.UPDATE
```
**Count: 19 permissions**
**Use For:** Site Engineers, Field Supervisors
**Real-World Action:** Open activity list → select item → enter % done

---

#### 🔴 PRESET: `PROGRESS_APPROVER`
**"Can approve or reject site progress submitted by field team"**

| Module | Tier |
|--------|------|
| Execution | **T3** |
| Micro Schedule | T2 (approve) |

**Permissions included** (everything in PROGRESS_ENTRY_OPERATOR +):
```
+ EXECUTION.ENTRY.DELETE
+ EXECUTION.ENTRY.APPROVE
+ MICRO.SCHEDULE.APPROVE
```
**Count: 22 permissions**
**Use For:** Project Managers, Planning Engineers for approval workflow

---

### PRESET GROUP B — PLANNING & SCHEDULING

---

#### 🟢 PRESET: `SCHEDULE_VIEWER`
**"Can read schedules, Gantt charts, baselines — read only"**

```
EPS.NODE.READ
WBS.NODE.READ, WBS.ACTIVITY.READ
SCHEDULE.READ, SCHEDULE.VERSION.READ, SCHEDULE.CALENDAR.READ
PLANNING.MATRIX.READ, PLANNING.ANALYSIS.READ
PROGRESS.DASHBOARD.READ
DASHBOARD.SUMMARY.READ, DASHBOARD.ANALYTICS.READ, DASHBOARD.ALERTS.READ
```
**Count: 13 permissions**
**Use For:** Senior Management reviewing plans without editing

---

#### 🟡 PRESET: `SCHEDULE_PLANNER`
**"Can build and update work schedules, micro-schedules, and look-ahead plans"**

```
Everything in SCHEDULE_VIEWER +
WBS.NODE.CREATE, WBS.NODE.UPDATE
WBS.ACTIVITY.CREATE, WBS.ACTIVITY.UPDATE
WBS.TEMPLATE.READ, WBS.TEMPLATE.APPLY
SCHEDULE.UPDATE, SCHEDULE.IMPORT
SCHEDULE.VERSION.CREATE
SCHEDULE.CALENDAR.CREATE, SCHEDULE.CALENDAR.UPDATE
PLANNING.MATRIX.UPDATE, PLANNING.LOOKAHEAD.CREATE
MICRO.SCHEDULE.CREATE, MICRO.SCHEDULE.UPDATE, MICRO.SCHEDULE.SUBMIT
MICRO.ACTIVITY.CREATE, MICRO.ACTIVITY.UPDATE
```
**Count: 32 permissions**
**Use For:** Planning Engineers, Project Planners

---

#### 🔴 PRESET: `SCHEDULE_ADMIN`
**"Full control over schedule structure — can delete, import, manage baselines"**

```
Everything in SCHEDULE_PLANNER +
WBS.NODE.DELETE, WBS.NODE.IMPORT
WBS.ACTIVITY.DELETE
WBS.TEMPLATE.MANAGE
SCHEDULE.CALENDAR.DELETE
MICRO.SCHEDULE.DELETE, MICRO.SCHEDULE.MANAGE
MICRO.ACTIVITY.DELETE
MICRO.LOG.DELETE
PLANNING.RECOVERY.MANAGE
```
**Count: 42 permissions**
**Use For:** Senior Planners, Construction Managers

---

### PRESET GROUP C — BOQ & COST MANAGEMENT

---

#### 🟢 PRESET: `BOQ_VIEWER`
**"Can read BOQ items, work orders, and cost data"**

```
EPS.NODE.READ
BOQ.ITEM.READ
WORKORDER.ORDER.READ, WORKORDER.VENDOR.READ, WORKORDER.MAPPING.READ
DASHBOARD.ANALYTICS.READ
```
**Count: 6 permissions**
**Use For:** Accounts team, External QS, Auditors

---

#### 🟡 PRESET: `BOQ_CONTRIBUTOR`
**"Can create and update BOQ items, manage measurements, link to work orders"**

```
Everything in BOQ_VIEWER +
BOQ.ITEM.CREATE, BOQ.ITEM.UPDATE
BOQ.MEASUREMENT.MANAGE, BOQ.MEASUREMENT.IMPORT
BOQ.PROGRESS.CREATE
WORKORDER.ORDER.CREATE, WORKORDER.ORDER.IMPORT
WORKORDER.MAPPING.MANAGE
WORKORDER.VENDOR.CREATE, WORKORDER.VENDOR.UPDATE
```
**Count: 17 permissions**
**Use For:** Quantity Surveyors, BOQ Managers

---

#### 🔴 PRESET: `BOQ_ADMIN`
**"Full BOQ control — can delete items, import bulk, manage vendor work orders"**

```
Everything in BOQ_CONTRIBUTOR +
BOQ.ITEM.DELETE, BOQ.ITEM.IMPORT
WORKORDER.VENDOR.DELETE, WORKORDER.ORDER.DELETE
WORKORDER.TEMPLATE.MANAGE
```
**Count: 22 permissions**
**Use For:** Project Commercial Managers

---

### PRESET GROUP D — QUALITY MANAGEMENT (QA/QC)

---

#### 🟢 PRESET: `QUALITY_VIEWER`
**"Can see QC records, checklists, inspection status — read only"**

```
QUALITY.DASHBOARD.READ
QUALITY.CHECKLIST.READ, QUALITY.ACTIVITYLIST.READ, QUALITY.ACTIVITY.READ
QUALITY.SEQUENCE.READ, QUALITY.INSPECTION.READ
QUALITY.NCR.READ, QUALITY.SNAG.READ, QUALITY.TEST.READ
QUALITY.AUDIT.READ, QUALITY.DOCUMENT.READ
```
**Count: 11 permissions**
**Use For:** Project Manager review, Client auditors, Site Engineers reading QC

---

#### 🟡 PRESET: `QC_FIELD_INSPECTOR`
**"Can raise RFIs, log NCRs/snags, perform material tests"**

```
Everything in QUALITY_VIEWER +
QUALITY.INSPECTION.RAISE
QUALITY.NCR.CREATE, QUALITY.NCR.UPDATE
QUALITY.SNAG.CREATE, QUALITY.SNAG.UPDATE
QUALITY.TEST.CREATE, QUALITY.TEST.UPDATE
```
**Count: 18 permissions**
**Use For:** QC Engineers, Site Inspection Officers

---

#### 🔴 PRESET: `QC_MANAGER`
**"Full QC control — manages checklists, activity lists, approves inspections"**

```
Everything in QC_FIELD_INSPECTOR +
QUALITY.CHECKLIST.CREATE, QUALITY.CHECKLIST.UPDATE, QUALITY.CHECKLIST.DELETE
QUALITY.ACTIVITYLIST.CREATE, QUALITY.ACTIVITYLIST.UPDATE
QUALITY.ACTIVITYLIST.DELETE, QUALITY.ACTIVITYLIST.MANAGE
QUALITY.ACTIVITY.CREATE, QUALITY.ACTIVITY.UPDATE, QUALITY.ACTIVITY.DELETE
QUALITY.SEQUENCE.UPDATE
QUALITY.INSPECTION.APPROVE
QUALITY.NCR.DELETE, QUALITY.SNAG.DELETE, QUALITY.TEST.DELETE
QUALITY.AUDIT.CREATE, QUALITY.DOCUMENT.MANAGE
QUALITY.STRUCTURE.MANAGE
```
**Count: 36 permissions**
**Use For:** QA/QC Managers, Quality Heads

---

### PRESET GROUP E — SAFETY (EHS)

---

#### 🟢 PRESET: `EHS_VIEWER`
**"Can read all EHS records — no entry capability"**

```
EHS.DASHBOARD.READ
EHS.OBSERVATION.READ, EHS.INCIDENT.READ
EHS.INSPECTION.READ, EHS.TRAINING.READ
EHS.MANHOUR.READ, EHS.ENVIRONMENTAL.READ, EHS.LEGAL.READ
```
**Count: 9 permissions**
**Use For:** Management, Compliance reviewers

---

#### 🟡 PRESET: `EHS_FIELD_OFFICER`
**"Can log safety observations, incidents, manhours on site"**

```
Everything in EHS_VIEWER +
EHS.OBSERVATION.CREATE, EHS.OBSERVATION.UPDATE
EHS.INCIDENT.CREATE
EHS.INSPECTION.CREATE, EHS.INSPECTION.UPDATE
EHS.TRAINING.CREATE
EHS.MANHOUR.CREATE
EHS.ENVIRONMENTAL.CREATE
```
**Count: 17 permissions**
**Use For:** Safety Officers, EHS Engineers

---

#### 🔴 PRESET: `EHS_MANAGER`
**"Full EHS control — manages all records, legal compliance, machinery/vehicles"**

```
Everything in EHS_FIELD_OFFICER +
EHS.OBSERVATION.DELETE, EHS.INCIDENT.DELETE
EHS.INSPECTION.DELETE, EHS.TRAINING.DELETE
EHS.LEGAL.MANAGE, EHS.MACHINERY.MANAGE
EHS.PERFORMANCE.MANAGE, EHS.COMPETENCY.MANAGE
EHS.VEHICLE.MANAGE, EHS.INCIDENTREGISTER.MANAGE
```
**Count: 27 permissions**
**Use For:** EHS Managers, Safety Heads

---

### PRESET GROUP F — DESIGN (Drawings)

---

#### 🟢 PRESET: `DRAWINGS_VIEWER`
**"Can browse and download drawings and their revisions"**

```
DESIGN.CATEGORY.READ, DESIGN.DRAWING.READ
```
**Count: 2 permissions**
**Use For:** Any team member who needs to reference GFC drawings

---

#### 🟡 PRESET: `DRAWINGS_CONTRIBUTOR`
**"Can upload new drawing revisions and register drawings"**

```
Everything in DRAWINGS_VIEWER +
DESIGN.CATEGORY.CREATE
DESIGN.DRAWING.CREATE, DESIGN.DRAWING.UPLOAD, DESIGN.DRAWING.UPDATE
```
**Count: 6 permissions**
**Use For:** Design Engineers, Document Controllers

---

#### 🔴 PRESET: `DRAWINGS_ADMIN`
**"Can approve GFC drawings and delete entries"**

```
Everything in DRAWINGS_CONTRIBUTOR +
DESIGN.DRAWING.DELETE, DESIGN.DRAWING.APPROVE
```
**Count: 8 permissions**
**Use For:** Design Managers, Chief Engineers who give GFC approval

---

### PRESET GROUP G — LABOR MANAGEMENT

---

#### 🟡 PRESET: `LABOR_ENTRY_OPERATOR`
**"Can log daily attendance and link labor to activities"**

```
LABOR.CATEGORY.READ, LABOR.ENTRY.READ
LABOR.ENTRY.CREATE, LABOR.MAPPING.MANAGE
```
**Count: 4 permissions**
**Use For:** Site Engineers, Labor In-charge

---

#### 🔴 PRESET: `LABOR_ADMIN`
**"Full labor management — creates categories, imports bulk data"**

```
Everything in LABOR_ENTRY_OPERATOR +
LABOR.CATEGORY.MANAGE, LABOR.ENTRY.IMPORT
```
**Count: 6 permissions**
**Use For:** HR Managers, Construction Managers

---

### PRESET GROUP H — SYSTEM ADMINISTRATION

---

#### 🔴 PRESET: `USER_ADMIN`
**"Can create and manage users, assign roles"**

```
USER.MANAGEMENT.READ, USER.MANAGEMENT.CREATE
USER.MANAGEMENT.UPDATE, USER.MANAGEMENT.DELETE
ROLE.MANAGEMENT.READ, ROLE.MANAGEMENT.CREATE
ROLE.MANAGEMENT.UPDATE, ROLE.MANAGEMENT.DELETE
AUDIT.LOG.READ
ADMIN.SETTINGS.MANAGE
```
**Count: 10 permissions (SYSTEM scope)**
**Use For:** System Administrators only

---

#### 🔴 PRESET: `RESOURCE_ADMIN`
**"Can manage resource master data and templates"**

```
RESOURCE.MASTER.READ, RESOURCE.MASTER.CREATE
RESOURCE.MASTER.UPDATE, RESOURCE.MASTER.DELETE
RESOURCE.MASTER.IMPORT, RESOURCE.TEMPLATE.MANAGE
TEMPLATE.BUILDER.READ, TEMPLATE.BUILDER.CREATE
TEMPLATE.BUILDER.UPDATE, TEMPLATE.BUILDER.DELETE
TEMPLATE.BUILDER.IMPORT
```
**Count: 11 permissions**
**Use For:** Planning Heads, System Admins, Library managers

---

## 🧩 COMPOSITE ROLE PRESETS (Stacked Bundles for Common Roles)

These combine multiple module presets into a complete role definition.
Apply these at the Role level — the system stacks all permissions.

---

### 👷 ROLE: Site Engineer
**"Field team: enters progress, logs labor, raises safety & QC items"**

```
PRESET STACK:
  ✅ PROGRESS_ENTRY_OPERATOR  (enter site progress)
  ✅ LABOR_ENTRY_OPERATOR      (log manpower)
  ✅ EHS_FIELD_OFFICER         (safety observations)
  ✅ QC_FIELD_INSPECTOR        (raise RFIs, log snags)
  ✅ DRAWINGS_VIEWER           (reference GFC drawings)
```

**Total unique permissions: ~48**

---

### 📐 ROLE: Planning Engineer
**"Plans schedules, distributes BOQ, creates micro-schedules"**

```
PRESET STACK:
  ✅ SCHEDULE_PLANNER          (build & update schedules)
  ✅ BOQ_VIEWER                (read BOQ for reference)
  ✅ QUALITY_VIEWER            (read QC for context)
  ✅ DRAWINGS_VIEWER           (reference drawings)
```

**Total unique permissions: ~38**

---

### 🏗️ ROLE: Project Manager
**"Reviews everything, approves progress, monitors all modules"**

```
PRESET STACK:
  ✅ PROGRESS_APPROVER         (approve daily progress)
  ✅ SCHEDULE_PLANNER          (adjust schedules)
  ✅ BOQ_CONTRIBUTOR           (manage cost)
  ✅ QC_MANAGER                (full quality control)
  ✅ EHS_MANAGER               (safety oversight)
  ✅ DRAWINGS_ADMIN            (GFC approvals)
  ✅ LABOR_ADMIN               (manage manpower)
```

**Total unique permissions: ~95**

---

### 💼 ROLE: Quantity Surveyor
**"Manages BOQ, measurements, work orders, cost tracking"**

```
PRESET STACK:
  ✅ BOQ_ADMIN                 (full BOQ control)
  ✅ SCHEDULE_VIEWER           (read schedule for reference)
  ✅ PROGRESS_VIEWER           (see what's been done)
```

**Total unique permissions: ~35**

---

### 🔬 ROLE: QA/QC Engineer
**"Manages quality checklists, RFIs, material tests, NCRs"**

```
PRESET STACK:
  ✅ QC_MANAGER                (full quality management)
  ✅ DRAWINGS_VIEWER           (reference drawings)
  ✅ SCHEDULE_VIEWER           (read schedule context)
```

**Total unique permissions: ~38**

---

### 🛡️ ROLE: Safety Officer
**"Full EHS management, logs all safety data"**

```
PRESET STACK:
  ✅ EHS_MANAGER               (full EHS control)
  ✅ LABOR_ENTRY_OPERATOR      (attendance for manhour linking)
  ✅ PROGRESS_VIEWER           (see what work is happening)
```

**Total unique permissions: ~32**

---

### 🏢 ROLE: Client / External Auditor
**"Read-only view across all modules — no data entry"**

```
PRESET STACK:
  ✅ PROGRESS_VIEWER           (see progress)
  ✅ BOQ_VIEWER                (see cost)
  ✅ QUALITY_VIEWER            (see QC status)
  ✅ EHS_VIEWER                (see safety records)
  ✅ DRAWINGS_VIEWER           (see drawings)
  ✅ SCHEDULE_VIEWER           (see plans)
```

**Total unique permissions: ~30**

---

### ⚙️ ROLE: System Admin
**"Full system administration"**

```
PRESET STACK:
  ✅ USER_ADMIN                (user & role management)
  ✅ RESOURCE_ADMIN            (resource master data)
  ✅ SCHEDULE_ADMIN            (structure management)
  ✅ BOQ_ADMIN                 (cost structure)
  🔓 Admin bypass active       (all permissions regardless)
```

**Total unique permissions: ALL (bypass active)**

---

## 🛠️ IMPLEMENTATION PLAN

### Phase 1 — Backend: Preset Registry (`permission-presets.ts`)

Create a new file: `backend/src/auth/permission-presets.ts`

```typescript
// Structure for each preset
export interface PermissionPreset {
  id: string;           // e.g., 'PROGRESS_ENTRY_OPERATOR'
  name: string;         // Human readable
  description: string;  // What this person can do
  group: string;        // e.g., 'Field Execution'
  tier: 1 | 2 | 3;     // READ / CONTRIBUTOR / FULL
  permissions: string[]; // Array of permission codes
}

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: 'PROGRESS_VIEWER',
    name: 'Progress Viewer',
    description: 'Can view site progress but cannot enter data',
    group: 'Project Execution',
    tier: 1,
    permissions: [
      'EPS.NODE.READ',
      'WBS.NODE.READ', 'WBS.ACTIVITY.READ',
      'SCHEDULE.READ', 'SCHEDULE.VERSION.READ', 'SCHEDULE.CALENDAR.READ',
      'BOQ.ITEM.READ',
      'PLANNING.MATRIX.READ', 'PLANNING.ANALYSIS.READ',
      'EXECUTION.ENTRY.READ',
      'MICRO.SCHEDULE.READ', 'MICRO.ACTIVITY.READ',
      'PROGRESS.DASHBOARD.READ',
      'DASHBOARD.SUMMARY.READ', 'DASHBOARD.ALERTS.READ',
    ]
  },
  // ... all other presets
];
```

### Phase 2 — Backend: Preset Endpoint

Add to `RolesController`:
```typescript
// GET /roles/presets — returns all available presets
// POST /roles/presets/apply — applies preset to a role
//   body: { roleId: number, presetIds: string[] }
```

### Phase 3 — Frontend: Preset Selector in Role Management

In `RoleManagement.tsx`, add a **"Quick Presets"** tab/panel:

```
[Individual Permissions] [Preset Bundles]  ← Switch tabs

┌─────────────────────────────────────────┐
│  PROJECT EXECUTION                      │
│  ○ Progress Viewer (T1)                 │
│  ● Progress Entry Operator (T2) ✅ ADD  │
│  ○ Progress Approver (T3)               │
├─────────────────────────────────────────┤
│  PLANNING & SCHEDULING                  │
│  ○ Schedule Viewer (T1)                 │
│  ● Schedule Planner (T2) ✅ ADD         │
│  ○ Schedule Admin (T3)                  │
└─────────────────────────────────────────┘

  APPLIED PRESETS:
  [Progress Entry Operator ×] [Schedule Planner ×]

  Total permissions: 42 (auto-resolved, no duplicates)
  [Save Role]
```

### Phase 4 — Composite Role Templates

Add a "Role Templates" dropdown that pre-loads the composite role definitions:

```
[Apply Role Template ▾]
  ╔══════════════════════╗
  ║ Site Engineer        ║
  ║ Planning Engineer    ║
  ║ Project Manager      ║
  ║ Quantity Surveyor    ║
  ║ QA/QC Engineer       ║
  ║ Safety Officer       ║
  ║ Client / Auditor     ║
  ╚══════════════════════╝
```

Selecting a template applies its preset stack and shows the resolved permission list. Admin can then add/remove individual presets before saving.

---

## ✅ QUICK SUMMARY TABLE

| Preset | Group | Tier | Key Capability | Target Role |
|--------|-------|------|----------------|-------------|
| `PROGRESS_VIEWER` | Execution | 1 | Read-only site data | Auditor, Mgmt |
| `PROGRESS_ENTRY_OPERATOR` | Execution | 2 | Submit daily progress | Site Engineer |
| `PROGRESS_APPROVER` | Execution | 3 | Approve submissions | Project Manager |
| `SCHEDULE_VIEWER` | Planning | 1 | Read schedules | Mgmt, Client |
| `SCHEDULE_PLANNER` | Planning | 2 | Build/update plans | Planning Eng |
| `SCHEDULE_ADMIN` | Planning | 3 | Full schedule control | Sr. Planner |
| `BOQ_VIEWER` | Cost | 1 | Read BOQ/WO data | QS, Auditor |
| `BOQ_CONTRIBUTOR` | Cost | 2 | Create/update BOQ | QS |
| `BOQ_ADMIN` | Cost | 3 | Full BOQ + WO control | Commercial Mgr |
| `QUALITY_VIEWER` | Quality | 1 | Read QC records | PM, Engineer |
| `QC_FIELD_INSPECTOR` | Quality | 2 | Raise RFIs, log NCR | QC Engineer |
| `QC_MANAGER` | Quality | 3 | Full QC + approvals | QA/QC Manager |
| `EHS_VIEWER` | Safety | 1 | Read EHS records | Mgmt |
| `EHS_FIELD_OFFICER` | Safety | 2 | Log EHS data | Safety Officer |
| `EHS_MANAGER` | Safety | 3 | Full EHS control | EHS Manager |
| `DRAWINGS_VIEWER` | Design | 1 | View drawings | All field staff |
| `DRAWINGS_CONTRIBUTOR` | Design | 2 | Upload revisions | Design Eng |
| `DRAWINGS_ADMIN` | Design | 3 | GFC approvals | Design Manager |
| `LABOR_ENTRY_OPERATOR` | Labor | 2 | Log attendance | Site Engineer |
| `LABOR_ADMIN` | Labor | 3 | Full labor control | HR / Const. Mgr |
| `USER_ADMIN` | Admin | 3 | User & role mgmt | System Admin |
| `RESOURCE_ADMIN` | Admin | 3 | Resource master data | Planning Head |

**Total Presets: 22 atomic presets → 8 composite role templates**

---

*Document Version: 1.0 — Created 2026-02-23*
*Next Step: Implement `permission-presets.ts` in backend, then build Preset Selector UI in RoleManagement.tsx*
