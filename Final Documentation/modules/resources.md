# Resources Module

Status: Draft  
Primary wave: B - Project Definition and Planning  
Related modules: Projects, WBS, BOQ, Planning, Execution, Labor, Progress, Cost/Budget, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Resources module manages people, materials, equipment, tools, and other capacity inputs required to plan and deliver project work.

### In scope

- Resource master records and categories
- Material, equipment, labor, subcontractor, and tool resources where supported
- Units, conversions, availability, calendars, capacity, and status
- Project/WBS/BOQ allocation
- Planned quantity, rate, cost, and usage references
- Resource search, import/export, and lifecycle management

### Out of scope

- User identity and employee profile ownership
- Attendance/timesheets unless explicitly implemented here
- Procurement or inventory ownership unless implemented here
- Actual progress capture, which belongs to Progress/Execution

## 2. System Position

```text
Project/WBS/BOQ
    -> resource definitions and availability
    -> planned allocation and rates
    -> schedule and execution consumption
    -> labor/material/equipment reporting
```

The approved document must distinguish reusable resource masters from project allocations and actual consumption.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Resources |
| Backend feature | `backend/src/resources/` | Controllers, services, DTOs, entities, allocation, and availability |
| Project structure | `backend/src/projects/`, `backend/src/wbs/` | Project and hierarchy scope |
| BOQ relationship | `backend/src/boq/` | Quantity, unit, and cost context |
| Web services | `frontend/src/services/` and planning views | Resource lists, allocation, import, and reporting |
| Mobile consumers | Flutter planning, labor, execution, and progress features | Field selection or usage where supported |

Exact categories, endpoints, rate ownership, and mobile support must be verified before approval.

## 4. Resource Model

Identify fields for resource identifier/code, name, description, category, unit, conversion, status, owner/supplier, capacity, calendar, location, rate, project/WBS/BOQ associations, and audit timestamps.

For each field, state whether it is master data, project configuration, imported, calculated, or actual usage.

## 5. Core User Journeys

### 5.1 Create or import a resource

An authorized user selects a resource category and scope, enters identity/unit/availability/rate data, and submits it for validation. The system checks codes, units, duplicates, and required fields before activation and audit.

### 5.2 Allocate resources to work

An authorized planner selects project, WBS/BOQ/activity, resource, quantity, period, and rate basis. The system validates capacity and makes the allocation available to planning and reporting.

### 5.3 Update availability or status

Document behavior when a resource is unavailable, retired, transferred, delayed, or overallocated. Existing allocations and future activities must be handled explicitly.

### 5.4 Record or consume usage

If usage is captured through execution, labor, or progress, document whether resources are consumed against planned quantities, whether overuse is allowed, and how adjustments are approved.

## 6. Availability and Allocation Rules

Confirm global/project scope, capacity and calendar model, allocation period, over-allocation behavior, leveling/conflict detection, shared resources, effective-dated rates, substitutes, retired resources, partial allocation, and remaining availability.

Resource planning should retain enough history to explain why a schedule or cost changed.

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/search resources | Resource view | Category, project, status, filters, pagination | Resource summaries | None |
| To verify | Get resource | Resource view | Resource identifier | Resource detail | None |
| To verify | Create/update resource | Resource edit | Resource DTO | Saved resource | Audit and availability impact |
| To verify | Import/export resources | Administration | File/filters/format | Results/file | Bulk changes and audit |
| To verify | Allocate resource | Planning/resource edit | Project, WBS/BOQ/activity, quantity, period | Allocation result | Capacity and cost impact |
| To verify | Update availability/status | Administration | Resource/status/calendar DTO | Updated state | Allocation effects and audit |

For each confirmed endpoint, document project scope, unit/rate validation, capacity checks, pagination, bulk behavior, and errors.

## 8. Data Model and Relationships

Identify relationships to projects, WBS nodes, BOQ items, units, planning activities, micro schedules, labor records, equipment/material usage, execution, progress, Cost/Budget, and reports.

Distinguish planned allocation, committed quantity, actual usage, remaining availability, and cost/value calculations.

## 9. Security, Permissions, and Audit

Confirm separate permissions for viewing, creating, editing, importing, exporting, allocating, changing rates, retiring, and adjusting usage.

Audit creation, code/unit changes, rate changes, availability changes, allocations, bulk imports, retirement, and manual adjustments. Protect supplier, rate, labor, and commercially sensitive fields from unauthorized project access.

## 10. Integrations and Consumers

### Upstream dependencies

- Projects and project membership
- WBS and BOQ
- App Config units, calendars, and defaults
- Users or labor master data where relevant

### Downstream consumers

- Planning and Micro Schedule
- Execution and Progress
- Labor and workforce tracking
- Cost/Budget, dashboards, Notifications, and Audit

## 11. Testing Checklist

- Create valid resources by category
- Reject invalid codes, units, duplicate records, and malformed rates
- Assign global and project scope correctly
- Validate capacity and over-allocation behavior
- Allocate resources to valid WBS/BOQ/activities
- Update availability without corrupting historical allocations
- Retire resources while preserving historical usage
- Import/export valid and invalid files with row feedback
- Calculate planned, actual, remaining, and cost values correctly
- Prevent cross-project access and unauthorized rate changes
- Verify audit events and downstream notifications

## 12. Open Questions for Approval

1. Which resource categories are supported?
2. Are masters global, project-specific, or both?
3. Who owns labor/personnel master data?
4. Which units and conversions are supported?
5. How is capacity and availability represented?
6. Are rates owned by Resources, BOQ, or Cost/Budget?
7. What happens when a resource is overallocated or unavailable?
8. How are planned allocations connected to actual usage?
9. Can resources be shared across projects?
10. What resource behavior is available offline in Flutter?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/resources/`
- Project reference: `Final Documentation/modules/projects.md`
- WBS reference: `Final Documentation/modules/wbs.md`
- BOQ reference: `Final Documentation/modules/boq.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Audit reference: `Final Documentation/modules/audit.md`

