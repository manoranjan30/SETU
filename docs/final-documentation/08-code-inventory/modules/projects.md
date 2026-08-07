# Projects Module

Status: Draft  
Primary wave: A - Foundations and Access  
Related modules: Auth, Users, Roles, Permissions, App Config, WBS, Planning, Execution, Progress, Audit, Sync  
Last repository review: 2026-07-20

## 1. Purpose and Scope

The Projects module is the primary organizational boundary for SETU business data. It represents a construction or development project, its lifecycle, its basic metadata, and the relationship between users and project access.

### In scope

- Project creation and core metadata
- Project lifecycle and status
- Project membership and access scope
- Project-level configuration and reference values
- Project selection and current-project context
- Project activation, suspension, closure, or archival
- Project visibility across web and Flutter clients

### Out of scope

- User identity, which belongs to Users
- Role and permission definitions, which belong to Roles and Permissions
- Detailed project planning, BOQ, execution, quality, and progress data, which belong to their respective modules
- Global application settings, unless explicitly scoped to a project

## 2. System Position

```text
Authenticated user
    -> effective roles and permissions
    -> project membership/scope
    -> current project context
    -> project-owned business data
    -> project reports, dashboards, and workflows
```

Project context is a critical data-isolation boundary. Every project-owned endpoint should define how the project is identified and how the backend verifies that the current user is allowed to access it.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the Projects module |
| Backend feature | `backend/src/projects/` | Project controllers, services, DTOs, entities, and lifecycle logic |
| User access | `backend/src/users/`, `backend/src/roles/`, and `backend/src/permissions/` | Membership, role, and scope evaluation |
| Web route surface | `frontend/src/App.tsx` and project pages/views | Project list, project selection, and project administration |
| Web API access | `frontend/src/api/` and `frontend/src/services/` | Project queries, mutations, selection, and client models |
| Mobile project context | `flutter/lib/features/projects/` | Project selection, project details, and mobile context |
| Mobile sync | `flutter/lib/features/sync/` and related repositories | Project-scoped offline data and synchronization |

Exact entity names, route paths, status values, and membership relationships must be verified from source before approval.

## 4. Project Identity and Metadata

The approved document should identify the canonical project identifier and all required metadata, such as:

- Project code and project name
- Location and address
- Business unit, company, or organization
- Project type and development category
- Planned start and completion dates
- Actual start and completion dates
- Project manager and accountable owners
- Project status
- Currency, units, and regional settings
- Towers, blocks, phases, or other project subdivisions
- Created-by, updated-by, and timestamps

For each field, state whether it is user-entered, imported, calculated, configured, or derived from another module.

## 5. Project Lifecycle

The actual status enum must be confirmed from code. The expected lifecycle should be documented in a form similar to:

```text
Draft or setup
    -> Active
    -> On hold or suspended
    -> Completed
    -> Archived
```

For every status, document:

- Who can transition the project
- Whether new records can be created
- Whether existing records can be edited
- Whether reports remain available
- Whether mobile sync continues
- Whether users can still select the project
- Whether the transition is reversible
- Required approvals and audit events

Closing or archiving a project must preserve historical records, reports, documents, approvals, and audit references.

## 6. Core User Journeys

### 6.1 Create a project

1. An authorized administrator opens project administration.
2. Required project metadata is entered and validated.
3. The system enforces project-code uniqueness and organization scope.
4. The project is created in its initial lifecycle state.
5. Default configuration, reference data, or templates are applied if supported.
6. The creator or project owner receives appropriate access.
7. The operation is audited.

### 6.2 Select a current project

The web and mobile clients should provide a clear project-selection mechanism. The document must state where the selected project is stored, how it survives reload or restart, and how the client prevents requests from accidentally using a previous project context.

### 6.3 Manage project membership

An authorized administrator adds or removes users, assigns project roles, and reviews effective access. Membership changes should state whether they affect active sessions, mobile offline data, notifications, and assigned work.

### 6.4 Update project metadata

The final document must separate editable metadata from immutable identifiers and identify which changes trigger downstream recalculation, notifications, reports, or audit entries.

### 6.5 Suspend, complete, or archive a project

The system should validate dependencies before a lifecycle transition. Document handling for open snags, pending approvals, active schedules, outstanding work documents, sync queues, and unresolved quality/EHS items.

## 7. API Contract to Confirm

Extract the exact endpoint inventory from the Projects controller and related membership routes.

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List projects | To verify | Search, status, organization, pagination | Project summaries | None |
| To verify | Get project | Project view | Project identifier | Project detail | None |
| To verify | Create project | Project administration | Project DTO | Created project | Defaults, membership, audit |
| To verify | Update project | Project administration | Project update DTO | Updated project | Audit and downstream effects |
| To verify | Change project status | Project administration | Status transition | Updated status | Validation, notifications, audit |
| To verify | List members | Membership administration | Project identifier and filters | Member list | None |
| To verify | Add/remove member | Membership administration | User, role, and project identifiers | Updated membership | Access, sync, notification, audit |
| To verify | Project configuration | To verify | Project-scoped settings | Configuration values | Downstream behavior changes |

For each confirmed endpoint, document project-scope validation, role requirements, status restrictions, pagination, error responses, and side effects.

## 8. Data Model and Ownership

The approved document must identify:

- Project entity/table and primary key
- Membership entity/table and relationship to users
- Project-role relationship and effective-scope calculation
- Parent/child project or phase relationships, if any
- Tower, block, phase, or location structures
- Project configuration and reference-data storage
- Foreign keys from planning, execution, quality, progress, labor, documents, and audit data
- Soft-delete/archive behavior

Every downstream module should state whether its records require a project identifier, inherit project scope through a parent record, or can exist globally.

## 9. Access Isolation and Security

- Enforce project access on the backend for every project-owned read and write.
- Do not trust a project identifier supplied by the client without membership verification.
- Prevent access to one project by changing a URL, query parameter, body field, or local storage value.
- Ensure exports and dashboards apply project scope consistently.
- Audit membership, ownership, lifecycle, and configuration changes.
- Protect project metadata that may be commercially sensitive.
- Define administrator access across multiple projects explicitly.
- Confirm behavior when a user loses project membership while holding offline data.

## 10. Integrations and Consumers

### Upstream dependencies

- Authenticated user context
- Users, Roles, and Permissions
- Organization/company configuration
- Project templates or reference data

### Downstream consumers

- WBS, Design, BOQ, Resources, Planning, and Micro Schedule
- Execution, Progress, Work Documents, Labor, and Milestones
- Quality, Snag, EHS, and Issue Tracker
- Dashboards, AI Insights, exports, and reports
- Flutter project selection, offline storage, and synchronization
- Notifications and audit

## 11. Synchronization and Offline Behavior

The final document must define:

- How the current project is selected on Flutter
- Which project metadata is cached locally
- How membership changes reach the device
- What happens when a project is archived while data is offline
- Whether offline-created records are rejected after access is removed
- How conflicts are resolved
- Whether sync is project-by-project or global
- How the client clears data after sign-out or membership removal

## 12. Testing Checklist

- Create a valid project
- Reject missing, malformed, or duplicate project identity fields
- List only projects visible to the current user
- Prevent cross-project reads and writes
- Add and remove project members according to permissions
- Verify role and project-scope interaction
- Enforce lifecycle transition rules
- Prevent invalid changes to completed or archived projects
- Preserve historical data after archive/closure
- Verify dashboard, export, and report project filtering
- Verify web reload and Flutter restart retain the correct project context
- Verify offline data and sync after membership or project-status changes
- Record audit events for privileged changes

Existing automated test locations and known coverage gaps should be added during technical review.

## 13. Open Questions for Approval

1. What is the canonical project identifier and uniqueness rule?
2. Which project lifecycle statuses are implemented?
3. Can one user belong to multiple projects at the same time?
4. Are project roles separate from global roles?
5. Who can create projects and assign project members?
6. What is the behavior of active sessions after membership removal?
7. What data can be edited after completion or archival?
8. Which defaults, templates, or reference data are created with a new project?
9. How are towers, blocks, phases, and other subdivisions represented?
10. What is the offline and synchronization policy for archived or inaccessible projects?

## 14. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/projects/`
- Authentication reference: `Final Documentation/modules/auth.md`
- User reference: `Final Documentation/modules/users.md`
- Role reference: `Final Documentation/modules/roles.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Web routing: `frontend/src/App.tsx`
- Mobile project feature: `flutter/lib/features/projects/`
- Mobile synchronization: `flutter/lib/features/sync/`

