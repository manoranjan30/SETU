# Bill of Quantities (BOQ) Module

Status: Draft  
Primary wave: B - Project Definition and Planning  
Related modules: Projects, WBS, Design, Resources, Planning, Execution, Progress, Cost/Budget, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The BOQ module manages the structured list of project work items, quantities, units, rates, and related commercial or measurement information used to plan and control delivery.

### In scope

- BOQ headers, sections, and line items
- Item codes, descriptions, units, quantities, rates, and amounts
- WBS, design, location, and resource mapping
- Revisions, versions, approvals, and baselines
- Imports, exports, bulk updates, and validation
- Planned quantity/value supplied to planning, execution, and progress
- Change history and auditability

### Out of scope

- General ledger or accounting ownership
- Procurement workflows unless explicitly implemented here
- Actual progress capture, which belongs to Progress/Execution
- Resource master data, which belongs to Resources

## 2. System Position

```text
Project and WBS
    -> design-linked BOQ structure
    -> item quantities, units, and rates
    -> planning and resource allocation
    -> execution measurement and progress
    -> cost and project reporting
```

BOQ version and approval state must be clear. Downstream modules should identify which BOQ revision supplied a planned quantity or value.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the BOQ module |
| Backend feature | `backend/src/boq/` | Controllers, services, DTOs, entities, calculations, and import logic |
| Project structure | `backend/src/projects/`, `backend/src/wbs/` | Project and hierarchy scope |
| Design relationship | `backend/src/design/` | Design package/revision references where supported |
| Web routes/views | `frontend/src/App.tsx` and BOQ/planning views | BOQ tree/grid, edit, import, export, and review |
| Web service | `frontend/src/services/boq.service.ts` | BOQ requests and client mapping |
| Mobile consumer | Flutter planning/progress/project features | Reference or field measurement behavior where supported |

Exact entities, calculations, endpoint paths, import formats, and mobile support must be verified before approval.

## 4. BOQ Record Model

The approved document should identify:

- BOQ and project identifiers
- Section/group/parent item
- Item code and description
- Specification, category, and trade
- Unit of measure
- Original and current quantity
- Rate, amount, currency, and calculation basis
- WBS, design, location, tower/block/phase, and resource references
- Planned, measured, executed, certified, and remaining quantities
- Item status and revision/baseline identifier
- Created/updated references and timestamps

For each field, state whether it is user-entered, imported, calculated, inherited, approved, or derived.

## 5. Core User Journeys

### 5.1 Create or import BOQ

1. An authorized project user creates a BOQ or selects an import template.
2. The user supplies project, WBS, item, unit, quantity, and commercial data.
3. The system validates required fields, codes, units, numeric values, and relationships.
4. The BOQ is saved in a draft or initial state.
5. Validation results and rejected rows are reported clearly.

### 5.2 Review and approve

Document review roles, approval state, lock behavior, effective date, notifications, and audit events. Users must know whether they are using a draft, approved, or superseded BOQ.

### 5.3 Revise BOQ

Document how quantity/rate changes are versioned, how previous values are retained, how changes are compared, and how existing planning/progress records are protected.

### 5.4 Use BOQ downstream

Planning activities and execution/progress records may reference BOQ items. State whether the relationship is required, whether quantities are consumed, and how over-measurement, cancellation, rework, and adjustments are handled.

## 6. Quantity and Value Rules

Confirm:

- Decimal precision by unit type
- Unit catalog and conversion rules
- Quantity validation and negative-value behavior
- Rate, amount, tax, escalation, discount, or overhead calculations
- Currency and rounding point
- Planned versus actual/measured quantity
- Remaining quantity and overrun behavior
- Manual adjustment and approval requirements

Calculations must identify their source of truth and rounding policy.

## 7. API Contract to Confirm

Extract exact endpoints from the BOQ controller and import/export routes.

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/get BOQ | Project/BOQ view | Project, version, WBS, filters, pagination | BOQ summary/tree/items | None |
| To verify | Create/update item | BOQ edit | Item DTO | Saved item | Calculation and audit |
| To verify | Bulk import | BOQ administration | File/template/options | Row results and summary | Bulk changes and audit |
| To verify | Export BOQ | BOQ export | Filters/version/format | File/download | Export event if configured |
| To verify | Submit/approve/reject | BOQ workflow | Version/action/comments | Updated state | Notification and audit |
| To verify | Create revision | BOQ administration | Prior version and changes | New version | Baseline and downstream impact |

For each confirmed endpoint, document project scope, field validation, numeric precision, transaction behavior, partial failures, pagination, and errors.

## 8. Data Model and Relationships

Identify relationships to:

- Projects and WBS nodes
- Design packages and revisions
- Resources and labor categories
- Planning activities and micro-schedule tasks
- Execution measurements and progress updates
- Cost, budget, commercial records, and reports

Historical planning and progress should retain the BOQ revision or quantity basis used at the time of the record.

## 9. Import, Export, Security, and Audit

Define supported file types, template versions, required columns, mapping, duplicate behavior, invalid-row handling, row/file limits, export permissions, and downloadable error reports.

Confirm separate permissions for viewing, editing, importing, exporting, submitting, approving, revising, and adjusting quantities/rates. Audit creation/import, item changes, quantity/rate changes, revisions, approvals, bulk updates, exports, and manual adjustments.

Protect commercial fields and project scope from cross-project access. Bulk changes should be idempotent or provide a safe repeat strategy.

## 10. Integrations and Consumers

### Upstream dependencies

- Projects and project membership
- WBS and project structure
- Design and approved references
- Resources, units, and App Config

### Downstream consumers

- Planning and Micro Schedule
- Execution and Progress
- Cost/Budget and commercial reporting
- Dashboards and exports
- Quality, Snag, EHS, documents, Notifications, and Audit

## 11. Testing Checklist

- Create valid sections and items
- Validate project/WBS/design relationships
- Reject invalid units, quantities, rates, duplicates, and codes
- Calculate amounts, totals, rounding, and remaining quantity correctly
- Import valid and invalid templates with row-level feedback
- Export only authorized project/version data
- Submit, approve, reject, revise, and supersede versions
- Protect approved values from unauthorized edits
- Preserve historical revision references downstream
- Handle overrun, cancellation, adjustment, and rework
- Verify large BOQ pagination and grid behavior
- Record audit and notification events

## 12. Open Questions for Approval

1. What is the canonical BOQ hierarchy and item model?
2. Which units, currencies, precisions, and conversions are supported?
3. Are rates and amounts owned by BOQ or Cost/Budget?
4. What is the approval and baseline lifecycle?
5. Can approved items be edited or only revised?
6. How are quantity changes reflected in planning and progress?
7. Are overrun and manual adjustments separate permissions?
8. Which import/export templates and formats are supported?
9. Which records must reference a BOQ revision?
10. What BOQ behavior is available offline in Flutter?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/boq/`
- Project reference: `Final Documentation/modules/projects.md`
- WBS reference: `Final Documentation/modules/wbs.md`
- Design reference: `Final Documentation/modules/design.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Audit reference: `Final Documentation/modules/audit.md`
- Web BOQ service: `frontend/src/services/boq.service.ts`

