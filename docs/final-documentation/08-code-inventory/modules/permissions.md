# Permissions Module

Status: Draft  
Primary wave: A - Foundations and Access  
Related modules: Auth, Users, Roles, Projects, Audit, Common, every protected business module  
Last repository review: 2026-07-20

## 1. Purpose and Scope

The Permissions module defines the atomic capabilities used to authorize actions in SETU. A permission should describe a specific operation or access boundary, while Roles groups permissions into assignable responsibility profiles.

### In scope

- Permission-key catalog and descriptions
- Resource and action naming conventions
- Permission assignment to roles
- Project, organization, or global permission scope
- Backend authorization enforcement
- Permission visibility for web and mobile clients
- Permission changes, audit, and effective-access evaluation

### Out of scope

- Login and token issuance, which belong to Auth
- User profile and identity lifecycle, which belong to Users
- Role grouping and role assignment, which belong to Roles
- Business validation inside a module, such as whether a BOQ amount is valid

## 2. System Position

```text
Authenticated user
    -> assigned roles
    -> role permissions
    -> resource and project scope
    -> permission check
    -> controller/action allowed or denied
```

Permission checks are a server-side security boundary. Frontend route guards and hidden buttons improve user experience but must never be the only enforcement mechanism.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the Permissions module |
| Backend feature | `backend/src/permissions/` | Permission catalog, services, controllers, DTOs, and evaluation logic |
| Role relationship | `backend/src/roles/` | Groups permissions into assignable roles |
| User context | `backend/src/users/` and Auth guards | Supplies identity and assignments for evaluation |
| Web route enforcement | `frontend/src/App.tsx` | Protects routes and screens based on access context |
| Web action enforcement | `frontend/src/components/`, `frontend/src/views/`, and services | Controls action visibility and behavior |
| Mobile enforcement | `flutter/lib/features/` and shared auth state | Controls feature and action access in Flutter |

The exact permission keys, decorators/guards, database relationships, and client permission-state mechanism must be verified from source before approval.

## 4. Permission Model

The approved document should define the following fields for every permission:

- Stable permission key
- Human-readable name
- Resource or module
- Action: view, create, update, delete, approve, export, administer, or equivalent
- Scope: global, organization, project, own-record, or equivalent
- Description and business meaning
- Risk level
- Owning module
- Whether the permission is system-defined or configurable

Permissions should be stable identifiers. Renaming a display label should not silently change the meaning of a permission key.

## 5. Permission Naming and Granularity

The project should confirm a canonical naming pattern, such as a resource/action convention. The standard should answer:

- Are keys module-based, resource-based, or route-based?
- Are read and write operations separate?
- Are approvals separate from updates?
- Are exports and downloads separate from viewing?
- Are administration and configuration separate from business operations?
- Is project scope encoded in the key or evaluated as assignment context?
- Are wildcard permissions supported?

Avoid overly broad permissions that make it impossible to explain or audit a user’s access. Avoid permissions so narrow that normal role administration becomes unmanageable.

## 6. Authorization Evaluation

The final implementation description must confirm the evaluation order:

1. Authenticate the request.
2. Resolve the user identity.
3. Load active role and permission assignments.
4. Evaluate global, organization, project, and record-level scope.
5. Apply allow/deny or priority semantics, if supported.
6. Enforce the decision in the backend.
7. Record an audit event for sensitive actions.

The document must state whether permission checks occur in guards, decorators, services, repositories, or more than one layer. Critical authorization should not depend only on a client-supplied project identifier or permission list.

## 7. Core User Journeys

### 7.1 View the permission catalog

Authorized administrators can view available permissions, their descriptions, owning modules, and risk. The catalog should distinguish active, deprecated, and reserved permissions.

### 7.2 Add permissions to a role

1. An authorized administrator opens a role configuration.
2. The system displays only valid and assignable permissions.
3. The administrator selects permissions.
4. The system validates privilege boundaries and scope compatibility.
5. The system saves the role-permission relationship.
6. The change is audited and its effective-access impact is visible.

### 7.3 Check access to a protected action

1. The client requests or attempts a protected operation.
2. The backend resolves the required permission.
3. The backend evaluates the user’s effective permissions and resource scope.
4. The operation proceeds or returns a consistent access-denied response.
5. Sensitive denials and administrative changes are logged according to policy.

### 7.4 Change or retire a permission

Permission changes should identify affected roles, users, projects, APIs, web routes, mobile actions, and existing data. Retiring a permission must not silently make a security-critical endpoint public or unintentionally inaccessible.

## 8. API Contract to Confirm

Extract exact endpoint names and paths from the Permissions controller and related role endpoints.

| Method | Path | Permission required | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List permissions | To verify | Module, status, risk, and search filters | Permission catalog | None |
| To verify | Get permission | To verify | Permission key/id | Permission detail | None |
| To verify | Create permission | To verify | Permission definition | Created permission | Audit and catalog update |
| To verify | Update permission | To verify | Permission update | Updated permission | Impact review and audit |
| To verify | Deprecate/retire permission | To verify | Permission key/id | Updated status | Role/access impact and audit |
| To verify | Role-permission assignment | Role administration | Role and permission identifiers | Updated role access | Effective access and audit |
| To verify | Effective permissions | Authenticated | Optional project/resource context | Effective permission set | None |

For every confirmed endpoint, record validation, pagination, response redaction, error behavior, cache behavior, and whether changes apply immediately.

## 9. Data Model and Lifecycle

The approved document must identify the actual permission and relationship entities and answer:

- Is the permission catalog stored in the database, code, configuration, or a combination?
- How are permission keys made unique?
- How are deprecated permissions retained for historical records?
- How are role-permission links represented?
- Is scope stored on the permission, role, assignment, or resource relationship?
- Are permissions seeded during deployment?
- How are migrations handled when a new business module adds permissions?
- What prevents orphaned role-permission relationships?

Permission deletion should generally be avoided when historical role configuration or audit records depend on the key. Prefer deprecation with a migration path unless the implementation has a stronger reason.

## 10. Scope and Resource-Level Access

The document must separate capability from data scope. For example, `update` capability does not by itself establish which projects or records a user may update.

Confirm whether SETU supports:

- Global permissions
- Organization or company scope
- Project scope
- Own-record scope
- Assigned-work scope
- Record ownership or responsibility scope
- Field-level restrictions
- Approval thresholds or amount-based restrictions

Each business module should identify its required permission and its resource-scope rule in its own documentation.

## 11. Security and Governance

- Enforce permissions on the backend for every protected operation.
- Do not trust permission arrays or project identifiers supplied by the client.
- Prevent privilege escalation through role or permission request fields.
- Restrict permission-catalog changes to a small administrative group.
- Audit permission creation, changes, retirement, and role assignment.
- Show the blast radius before changing a high-risk permission.
- Protect critical permissions from accidental retirement.
- Use consistent access-denied responses without exposing sensitive resource existence.
- Review permissions whenever a new controller, route, export, approval, or mobile action is added.
- Keep deprecated keys distinguishable from active keys.

## 12. Integrations and Consumers

### Upstream dependencies

- Authenticated request context
- Users and active user state
- Roles and role-permission assignments
- Projects and resource scope
- Permission seed/configuration data

### Downstream consumers

- Backend controllers, guards, and services across all modules
- Web protected routes, menus, buttons, tables, and export actions
- Flutter feature access and action controls
- Audit and security reporting
- Administrative role-management screens

## 13. Testing Checklist

- Valid permission is recognized for an authorized role
- Missing permission returns the standard access-denied result
- Inactive user cannot use previously assigned permission
- Project scope prevents access to another project
- Multiple-role behavior matches the documented evaluation rule
- Direct client-supplied permission or project values cannot bypass checks
- Sensitive export/download permissions are enforced separately where required
- Permission changes affect active sessions according to policy
- Retired permissions do not expose or break protected endpoints unexpectedly
- Web and Flutter visibility matches backend enforcement
- Audit events exist for high-risk changes and actions
- Every protected controller has an identified permission requirement

Include a permission matrix covering high-risk roles and core modules. Existing automated test locations and uncovered permission paths should be added during technical review.

## 14. Open Questions for Approval

1. What is the canonical permission-key naming convention?
2. Are permission definitions code-owned, database-owned, or hybrid?
3. Is there a deny or override model, or are permissions unioned across roles?
4. How are global and project-scoped permissions represented?
5. Are record-level or field-level restrictions supported?
6. Are exports, approvals, downloads, and administration separate permissions?
7. How quickly do permission changes affect existing sessions and mobile clients?
8. Who approves creation or retirement of high-risk permissions?
9. How are new module permissions introduced and migrated?
10. Is there an endpoint for a client to retrieve effective permissions?

## 15. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/permissions/`
- Role relationship: `backend/src/roles/`
- User relationship: `backend/src/users/`
- Authentication reference: `Final Documentation/modules/auth.md`
- Related role reference: `Final Documentation/modules/roles.md`
- Related user reference: `Final Documentation/modules/users.md`

