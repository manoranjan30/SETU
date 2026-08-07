# Work Breakdown Structure (WBS) Module

Status: Draft  
Primary wave: B - Project Definition and Planning  
Related modules: Projects, Design, BOQ, Resources, Planning, Micro Schedule, Execution, Progress, Dashboards, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The WBS module defines the hierarchical structure used to organize project scope and connect planning, cost, resources, execution, and progress records. It provides the stable project structure against which downstream modules classify and report work.

### In scope

- WBS hierarchy and node management
- WBS codes, names, types, and parent-child relationships
- Ordering, indentation, and display behavior
- WBS baseline/versioning, where supported
- WBS ownership and project scope
- Linking WBS nodes to planning, BOQ, design, execution, and progress records
- Import, export, and template behavior

### Out of scope

- Project identity and membership, which belong to Projects
- Detailed activity scheduling, which belongs to Planning and Micro Schedule
- Cost item definitions, which belong to BOQ and Cost/Budget
- Actual progress capture, which belongs to Progress and Execution

## 2. System Position

```text
Project
    -> WBS hierarchy
    -> design / BOQ / resource / schedule associations
    -> execution and progress records
    -> project reporting and dashboards
```

WBS identifiers should remain stable enough for traceability while allowing controlled restructuring. The final document must state what happens to historical records when a node is moved, renamed, split, merged, or retired.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the WBS module |
| Backend feature | `backend/src/wbs/` | WBS controllers, services, DTOs, entities, and hierarchy logic |
| Project context | `backend/src/projects/` | Owns project boundary and access scope |
| Web route surface | `frontend/src/App.tsx` and planning/project views | WBS navigation, tree, grid, editing, import/export |
| Web API access | `frontend/src/api/` and `frontend/src/services/` | WBS requests, mapping, and client state |
| Downstream clients | Planning, BOQ, design, execution, and progress views/services | Select and display WBS references |
| Mobile consumer | Flutter planning/project features | Displays or edits WBS where mobile support exists |

Exact entity names, route paths, supported node types, and versioning behavior must be verified from source before approval.

## 4. WBS Model

The approved document should define the canonical fields for each node:

- WBS identifier
- Project identifier
- Parent identifier/path
- WBS code
- Name and description
- Node type or level
- Sequence/order
- Active/retired status
- Owner/responsible role, where supported
- Baseline/version identifier
- Planned dates or control dates, if owned by WBS
- Created/updated references and timestamps

It must also state whether the hierarchy is strictly tree-shaped, supports multiple parents, or has separate relationships for shared work.

## 5. Core User Journeys

### 5.1 Create project WBS

1. An authorized project user opens WBS setup.
2. The user creates a root or imports a template.
3. Child nodes are added with names, codes, types, and order.
4. The backend validates project scope, parent relationships, uniqueness, and allowed depth.
5. The structure is saved and audited.

### 5.2 Edit or reorganize WBS

The document must explain whether nodes can be renamed, reordered, moved, split, merged, or deleted. It must identify safeguards for nodes already referenced by BOQ, schedules, execution records, progress, documents, or reports.

### 5.3 Baseline or publish WBS

If the module supports a baseline or published state, document draft versus approved behavior, who can publish, whether published nodes are immutable, and how revisions are compared.

### 5.4 Use WBS in downstream modules

When a user creates a BOQ item, activity, resource assignment, execution record, or progress update, the system should define whether a WBS reference is required, optional, inherited, or immutable after creation.

## 6. Hierarchy and Validation Rules

Confirm the implementation for:

- Root-node requirements
- Maximum depth
- Code format and uniqueness scope
- Allowed characters and length
- Parent/child node-type combinations
- Circular-reference prevention
- Sibling ordering
- Empty or duplicate names
- Deletion versus retirement
- Moving referenced nodes
- Bulk import validation and partial-failure handling

Validation must be enforced on the backend; tree behavior in the client is not a security or integrity boundary.

## 7. API Contract to Confirm

Extract the exact endpoint inventory from the WBS controller and related import/export routes.

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/get WBS | Project/WBS view | Project, parent, search, filters | Tree or node list | None |
| To verify | Create node | WBS edit | Node DTO and parent | Created node | Audit and downstream availability |
| To verify | Update node | WBS edit | Node update DTO | Updated node | Reference/history impact |
| To verify | Move/reorder node | WBS edit | Node, parent, order | Updated hierarchy | Audit and path updates |
| To verify | Retire/delete node | WBS administration | Node and reason | Updated status/result | Reference validation and audit |
| To verify | Publish/baseline WBS | WBS approval | Version/action | Published version | Downstream baseline effect |
| To verify | Import/export WBS | To verify | File/filter/version | Result/file | Bulk changes and audit |

For each confirmed endpoint, document project-scope authorization, transaction behavior, validation, partial failures, pagination, and error responses.

## 8. Data Model and Lifecycle

Identify the actual WBS entity/table and relationships to:

- Projects and project subdivisions
- Design elements
- BOQ items and cost codes
- Resources and labor
- Planning activities and micro-schedule tasks
- Execution and progress records
- Work documents, quality, snags, EHS, and reports

Document whether WBS changes update linked records, preserve historical paths, or require a migration. Historical reports should be able to explain which WBS version was used.

## 9. Permissions and Audit

Confirm permissions for viewing, editing, importing, publishing, deleting/retiring, and exporting WBS. Audit at minimum:

- Node creation and deletion/retirement
- Code/name/type changes
- Parent and ordering changes
- Bulk imports
- Baseline/publish actions
- Changes affecting referenced downstream records

## 10. Integrations and Consumers

### Upstream dependencies

- Projects and project access
- Roles and Permissions
- WBS templates/reference data

### Downstream consumers

- Design
- BOQ and cost tracking
- Resources and labor
- Planning and Micro Schedule
- Execution and Progress
- Work Documents, Quality, Snag, and EHS
- Dashboards, reports, exports, and AI Insights

## 11. Testing Checklist

- Create a valid root and child hierarchy
- Reject invalid parents, circular references, duplicate codes, and unsupported depth
- Verify project isolation
- Reorder and move nodes safely
- Prevent unsafe deletion of referenced nodes
- Import valid and invalid files with clear result reporting
- Export the correct project/version structure
- Publish or baseline according to permissions
- Preserve downstream links after permitted changes
- Verify historical reporting after WBS revisions
- Confirm audit events for structural and bulk changes
- Verify web and mobile behavior where WBS editing is supported

## 12. Open Questions for Approval

1. What WBS levels and node types are supported?
2. Are codes generated, user-entered, or imported?
3. Must WBS codes be unique per project, level, or globally?
4. Can nodes be moved after downstream records exist?
5. Is there a draft/published/baselined lifecycle?
6. Can a node be deleted, or only retired?
7. Which downstream records require a WBS reference?
8. How are WBS revisions compared and migrated?
9. Which users can import, publish, or restructure WBS?
10. What is the supported offline/mobile WBS behavior?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/wbs/`
- Project reference: `Final Documentation/modules/projects.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Planned downstream modules: Design, BOQ, Resources, Planning, Micro Schedule, Execution, Progress
- Web routing: `frontend/src/App.tsx`
- Mobile planning/project features: `flutter/lib/features/planning/`, `flutter/lib/features/projects/`

