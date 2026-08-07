# Template Builder Module

Status: Draft  
Primary wave: B - Project Definition and Planning  
Related modules: Projects, App Config, WBS, BOQ, Design, Resources, Planning, Micro Schedule, Milestones, Quality, Snag, EHS, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Template Builder module allows authorized administrators to define reusable project structures and configuration that can accelerate project setup and standardize delivery practices.

### In scope

- Project and module templates
- Template sections, nodes, activities, items, checklists, defaults, and mappings
- Template versioning, draft/publish lifecycle, and effective dates
- Template selection during project creation or module setup
- Copy, inherit, override, and customization behavior
- Template validation, preview, import/export, and audit

### Out of scope

- Runtime configuration ownership, which belongs to App Config
- Live project records after template application
- Business approval workflows owned by individual modules
- User access policy, except for template administration permissions

## 2. System Position

```text
Template definition
    -> validation and publish
    -> project/module selection
    -> copied or inherited defaults
    -> project-specific customization
    -> planning, execution, quality, and reporting setup
```

The system must distinguish a template definition from the project data created from it. Later template changes should not silently rewrite active project records unless explicitly designed.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Template Builder |
| Backend feature | `backend/src/template-builder/` | Template entities, services, controllers, validation, and publishing |
| Web service | `frontend/src/services/` and builder views | Template creation, editing, preview, and application |
| Web routes/views | `frontend/src/App.tsx` and admin/project setup views | Template administration and project setup |
| Mobile consumer | Flutter project/planning features | Consumes configured project structure where supported |
| Configuration relationship | App Config, Projects, WBS, BOQ, Planning, and control modules | Provides defaults and receives generated records |

Exact backend location, template types, endpoint paths, and application strategy must be verified before approval.

## 4. Template Model

Identify fields for template identifier/code, name, description, type, scope, applicable project type, status, version, owner, effective dates, source template, contained sections/items, mappings, defaults, validation rules, and audit timestamps.

For each contained element, state whether it is copied as a new record, linked to the template, or inherited dynamically.

## 5. Core User Journeys

### 5.1 Create or edit a template

An authorized administrator creates a draft, selects template type, adds structures and defaults, maps references, validates the content, and saves changes without affecting live projects.

### 5.2 Preview and publish

The administrator previews generated project/module data, resolves validation issues, publishes a version, and defines effective date and allowed scope. Publishing should be audited.

### 5.3 Apply a template

During project creation or module setup, an authorized user selects a published template. The system validates compatibility, creates or links configured records, reports the result, and records the source template/version.

### 5.4 Customize a generated project

Document which values can be changed after application, whether changes detach an item from the template, and whether later template versions can be compared or optionally applied.

### 5.5 Retire or replace a template

Retirement must prevent new use while preserving the source/version of existing projects. Replacement and migration behavior must be explicit.

## 6. Versioning and Inheritance Rules

Confirm:

- Draft, published, effective, retired, and archived states
- Version numbering and comparison
- Copy versus live inheritance
- Override and detach behavior
- Effective-date behavior
- Compatibility by project type or module version
- Partial application and rollback
- Reapplication to an existing project
- Protection of templates referenced by historical projects

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/get templates | Template view | Type, status, scope, filters | Template summaries/detail | None |
| To verify | Create/update template | Template edit | Template DTO/content | Saved draft | Validation and audit |
| To verify | Validate/preview template | Template edit | Template/version/options | Validation or preview result | None |
| To verify | Publish/retire template | Template administration | Version/action | Updated state | Audit and availability impact |
| To verify | Apply template | Project/template use | Project, template, version, options | Created records/result | Project data, audit, notifications |
| To verify | Import/export template | Administration | File/format/options | Results/file | Bulk changes and audit |

For each confirmed endpoint, document permissions, compatibility checks, transaction/rollback behavior, partial failures, and generated-record traceability.

## 8. Data Model and Generated Records

Identify relationships to Projects, WBS, BOQ, Design, Resources, Planning, Micro Schedule, Milestones, checklists, Quality, Snag, EHS, App Config, and Audit.

Every generated record should retain template identifier/version where traceability matters. The final document must state whether generated records can be deleted, changed, detached, or regenerated safely.

## 9. Security and Governance

Confirm separate permissions for viewing, editing, validating, publishing, retiring, importing/exporting, and applying templates.

Audit template creation, structural changes, publishing, retirement, application, generated-record changes, overrides, and bulk operations. Prevent template content from granting roles or permissions without a separately authorized access workflow.

## 10. Testing Checklist

- Create valid templates by supported type
- Validate required sections, mappings, codes, units, and defaults
- Preview generated records accurately
- Publish and retire versions according to policy
- Apply a template to a valid project
- Reject incompatible or unauthorized applications
- Preserve template/version traceability
- Verify copy, inherit, override, and detach behavior
- Handle partial failures and rollback
- Import/export valid and invalid templates
- Prevent later template changes from corrupting active projects
- Record audit and notification events

## 11. Open Questions for Approval

1. Which template types are supported?
2. What project/module structures can templates generate?
3. Are generated records copied, linked, or inherited?
4. Can a project be re-synced with a newer template version?
5. How are project-specific overrides represented?
6. Who can publish, retire, and apply templates?
7. What happens when a template references retired WBS, BOQ, resource, or configuration values?
8. Can templates include permission, role, or notification configuration?
9. What is the rollback strategy for a failed application?
10. What template behavior is available offline in Flutter?

## 12. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/template-builder/`
- Project reference: `Final Documentation/modules/projects.md`
- WBS reference: `Final Documentation/modules/wbs.md`
- BOQ reference: `Final Documentation/modules/boq.md`
- Planning reference: `Final Documentation/modules/planning.md`
- App Config reference: `Final Documentation/modules/app-config.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Audit reference: `Final Documentation/modules/audit.md`

