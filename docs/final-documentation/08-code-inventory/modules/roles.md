# Roles Module

Status: Draft  
Primary wave: A - Foundations and Access  
Related modules: Auth, Users, Permissions, Projects, Audit, Notifications  
Last repository review: 2026-07-20

## 1. Purpose and Scope

The Roles module defines named responsibility profiles that can be assigned to SETU users. A role groups access expectations for a business or operational responsibility; the Permissions module defines the individual capabilities that make up those expectations.

### In scope

- Role definitions and descriptions
- Role-to-permission assignments
- Role assignment to users, where supported
- Role activation, deactivation, or archival
- Role visibility and administration
- Role scope by project, organization, or tenant, where supported

### Out of scope

- User identity and profile management, which belongs to Users
- Credential authentication, which belongs to Auth
- The atomic definition of permission keys, which belongs to Permissions
- Business data ownership or workflow approvals unless a role assignment is used by those workflows

## 2. System Position

```text
User identity
    -> role assignment
    -> role permissions
    -> project/organization scope
    -> authorization decision
    -> business module operation
```

Roles are policy configuration. They should not be treated as proof of authentication, and a role should not grant access outside the resource scope attached to the user or assignment.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the Roles module |
| Backend feature | `backend/src/roles/` | Role controllers, services, DTOs, entities, and assignment logic |
| Permission policy | `backend/src/permissions/` | Defines the permission relationship consumed by roles |
| User relationship | `backend/src/users/` | Provides the user identity and assignment context |
| Web route surface | `frontend/src/App.tsx` and administration views | Role administration and access-management screens |
| Web API access | `frontend/src/api/` and `frontend/src/services/` | Role queries, mutations, and client models |
| Mobile consumer | `flutter/lib/features/auth/` and feature guards/state | Uses effective access to show or restrict mobile capabilities |

Exact class names, route paths, permission keys, and persistence relationships must be confirmed from the current source before approval.

## 4. Role Model

The approved document must distinguish the following concepts if they exist independently:

- Role definition: reusable named access profile
- Role permission: capability included in a role
- User-role assignment: role given to a user
- Scope: project, organization, tenant, or global boundary of the assignment
- Effective permissions: final capabilities after all role and scope rules are evaluated

The document should also identify whether roles are:

- System-defined or administrator-created
- Global or project-specific
- Mutually exclusive or composable
- Hierarchical or flat
- Versioned or immediately mutable
- Deletable, archival-only, or permanent reference data

## 5. Core User Journeys

### 5.1 View roles

An authorized administrator can view the available role definitions, descriptions, status, scope, and included permissions. The document must identify whether ordinary users can view their own effective role information.

### 5.2 Create or configure a role

1. An authorized administrator opens role administration.
2. The administrator supplies the role name, description, scope, and included permissions.
3. The system validates uniqueness and prohibited combinations.
4. The system saves the role and records an audit event.
5. The effective access impact is communicated or made visible to administrators.

### 5.3 Assign a role to a user

1. An administrator selects a user and role.
2. The system validates the administrator’s authority over that user and scope.
3. The system saves the assignment.
4. The system recalculates or exposes effective access according to the implementation.
5. The change is audited and takes effect according to the documented session policy.

### 5.4 Remove or change a role

The final document must describe whether removal is immediate, whether the user can lose their last administrative role, whether current sessions are affected, and how historical assignments remain visible in audit records.

## 6. Authorization Semantics to Confirm

The following rules must be made explicit:

- Whether multiple roles are combined using union, priority, or another rule
- Whether an explicit deny can override an allow
- Whether project scope narrows a global role
- Whether permissions can be assigned directly to a user
- Whether role changes require re-login or token refresh
- Whether inactive roles remain effective for existing sessions
- Whether a user must always retain at least one role
- Whether administrators can assign roles equal to or greater than their own authority

Until confirmed, these are design questions and must not be described as implemented behavior.

## 7. API Contract to Confirm

Extract the exact endpoint inventory from the Roles controller and related assignment routes.

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List roles | To verify | Filters, status, scope | Role summaries | None |
| To verify | Get role | To verify | Role identifier | Role and permission detail | None |
| To verify | Create role | To verify | Role DTO | Created role | Audit |
| To verify | Update role | To verify | Role update DTO | Updated role | Access recalculation and audit |
| To verify | Activate/deactivate role | To verify | Role identifier/action | Updated status | Access impact and audit |
| To verify | Assign role | To verify | User, role, and scope identifiers | Assignment result | Access change and audit |
| To verify | Remove role assignment | To verify | Assignment identifier | Updated assignment | Access change and audit |

For every confirmed endpoint, document validation, authorization scope, pagination, error responses, idempotency, and whether an access-token refresh is required.

## 8. Data Model and Lifecycle

Identify and link the actual role, permission, assignment, and scope entities. The approved document should answer:

- What is the canonical role identifier?
- Which fields must be unique?
- How are role permissions persisted?
- How are user-role assignments persisted?
- How is project or organization scope represented?
- Are role changes historized?
- What happens to assignments when a role is deactivated?
- What prevents deletion of a role referenced by historical records?
- Are seed roles required for a new environment?

Role and assignment deletion should be evaluated carefully because historical approvals, audit events, work ownership, and reports may reference them.

## 9. Security and Governance

- Restrict role creation and permission assignment to a narrowly defined administration capability.
- Prevent privilege escalation through user-controlled role identifiers or scope fields.
- Enforce server-side authorization; client route visibility is not sufficient.
- Audit all role-definition, permission-assignment, and user-assignment changes.
- Protect system-critical roles from accidental deletion or deactivation.
- Require explicit confirmation for changes affecting many users.
- Make global versus project-scoped impact visible before saving.
- Ensure exports and role listings do not expose unnecessary personal data.
- Define emergency access and break-glass behavior separately if it exists.

## 10. Integrations and Consumers

### Upstream dependencies

- Authenticated user context
- Users and user-role assignment records
- Permissions and permission catalog
- Projects or organizational scope
- Seed/configuration data

### Downstream consumers

- Backend guards and authorization decorators
- Protected controllers across every business module
- Web protected routes and navigation
- Flutter feature access and action visibility
- Audit and administrative reporting
- Notifications for access changes, where configured

## 11. Testing Checklist

- List and view roles according to administrator permissions
- Create a valid role
- Reject duplicate or invalid role definitions
- Assign valid role and scope to a user
- Reject assignment outside the administrator’s authority
- Combine multiple roles according to the intended rule
- Verify effective permission after assignment
- Remove or deactivate a role and verify access impact
- Prevent removal of the last required administrator role
- Verify session/token behavior after role changes
- Preserve audit history after role or assignment changes
- Confirm web and Flutter access behavior match backend authorization

Existing automated test paths should be added during technical review. Include permission-matrix tests for high-risk administrative roles.

## 12. Open Questions for Approval

1. Are roles global, project-scoped, organization-scoped, or a combination?
2. Can users have multiple roles at the same time?
3. Are permissions unioned across roles, or is there a deny/priority model?
4. Can administrators create custom roles, or are roles system-defined?
5. Can permissions be assigned directly to users?
6. Which roles are protected from editing or deactivation?
7. How quickly do role changes affect active sessions and mobile clients?
8. Can a role be deleted, or only archived?
9. Who approves changes to high-privilege roles?
10. Are role changes notified to affected users or project owners?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/roles/`
- Related permission implementation: `backend/src/permissions/`
- Related identity implementation: `backend/src/users/`
- Authentication reference: `Final Documentation/modules/auth.md`
- Users reference: `Final Documentation/modules/users.md`

