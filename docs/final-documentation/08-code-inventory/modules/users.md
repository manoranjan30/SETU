# Users Module

Status: Draft  
Primary wave: A - Foundations and Access  
Related modules: Auth, Roles, Permissions, Projects, Audit, Notifications, Temporary Users  
Last repository review: 2026-07-20

## 1. Purpose and Scope

The Users module manages the SETU user identity after authentication has established that a person can access the system. It provides the user profile and lifecycle information consumed by authorization, project access, audit, notifications, and operational administration.

### In scope

- User profile and directory information
- Active, inactive, invited, suspended, or archived user lifecycle states, where implemented
- Association of users with roles and projects
- User search, filtering, and administrative views
- User-specific preferences or notification settings, where implemented
- User deactivation and access-impact behavior

### Out of scope

- Credential validation and token issuance, which belong to Auth
- Definition of permission keys and role policies, which belong to Roles and Permissions
- Project business data, which belongs to Projects and the relevant project modules
- Temporary or one-time access unless the implementation shares the same user record and lifecycle

## 2. Relationship to Authentication

Auth answers: “Can this request be associated with a valid identity?”

Users answers: “Who is that identity, what is its current lifecycle state, and what profile and organizational context belong to it?”

The expected relationship is:

```text
Authentication credential
        -> authenticated identity identifier
        -> user record
        -> active/inactive and project context
        -> roles and permissions
        -> module access
```

Deactivating a user must have an explicitly documented effect on existing sessions, refresh credentials, mobile credentials, assigned work, notifications, and audit history.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the Users module with the NestJS application |
| Backend feature | `backend/src/users/` | User controllers, services, DTOs, entities, and lifecycle logic |
| Web route surface | `frontend/src/App.tsx` and user/admin pages | User directory, administration, and profile entry points |
| Web API access | `frontend/src/api/` and `frontend/src/services/` | Requests, response mapping, and user-related client state |
| Mobile feature context | `flutter/lib/features/auth/` and `flutter/lib/features/profile/` | Current-user profile and identity presentation on mobile |
| Related administration | `backend/src/roles/`, `backend/src/permissions/`, and temporary-user areas | Access assignment and exceptional access paths |

Exact controller names, DTO names, route paths, and entity names must be verified from the current source before this document is approved.

## 4. User Lifecycle

The final implementation should be documented against the actual states. The following is the lifecycle model to confirm:

```text
Invited or provisioned
        -> Active
        -> Suspended or inactive
        -> Archived, if supported
```

For every state, document:

- Who can create or transition the user
- Whether sign-in is allowed
- Whether existing sessions remain valid
- Whether project assignments remain active
- Whether notifications continue
- Whether historical audit records remain visible
- Whether the user can be restored

The system should preserve historical ownership and audit references even when a user is deactivated. Hard deletion must be treated as a special case and justified because it can compromise historical traceability.

## 5. Core User Journeys

### 5.1 Create or provision a user

1. An authorized administrator opens the user-management surface.
2. The administrator supplies the required identity and organizational fields.
3. The system validates uniqueness and required values.
4. The system creates or links the user identity.
5. The system assigns the initial role/project context if that behavior is supported.
6. The system records an audit event.
7. The user receives an invitation or notification if configured.

### 5.2 View and search users

The directory should document supported filters, search fields, sorting, pagination, status filters, project filters, role filters, and export behavior. It should also identify which fields are visible to administrators versus ordinary users.

### 5.3 Update a user

User edits should identify which fields are self-service and which require an administrator. Changes to email, mobile number, external identity, role, project access, or active state should have explicit validation and audit behavior.

### 5.4 Deactivate or reactivate a user

The final document must describe the authorization required, confirmation behavior, immediate access effect, effect on mobile/offline data, treatment of assigned work, and reactivation path.

### 5.5 View current profile

The current-user profile should document editable fields, read-only fields, preference settings, profile-photo behavior if available, and how changes propagate between web, backend, and Flutter.

## 6. API Contract to Confirm

The endpoint inventory must be extracted from the Users controller and related controllers. Use this table in the approved version:

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/search users | To verify | Filters, pagination, sort | User summaries/page | None or access-log event |
| To verify | Get user | To verify | User identifier | User detail | None |
| To verify | Create/provision user | To verify | User DTO | Created user/invitation result | User, role, project, notification, audit |
| To verify | Update user | To verify | User update DTO | Updated user | Audit and downstream context changes |
| To verify | Activate/deactivate user | To verify | User identifier and action | Updated lifecycle state | Session/access effects and audit |
| To verify | Current profile | Authenticated | Optional profile fields | Current user | None or profile update |

For each confirmed endpoint, record:

- Validation rules and uniqueness constraints
- Whether the operation is idempotent
- Authorization by role and project scope
- Error status and error payload
- Pagination and export limits
- Whether response fields are redacted by role
- Audit and notification side effects

## 7. Data Model and Ownership

The approved document must identify the authoritative entity/table and separate identity fields from operational fields.

### Identity fields to confirm

- Internal user identifier
- External identity-provider identifier
- Name and display name
- Email and mobile number
- Authentication-provider metadata
- Profile image or avatar reference

### Operational fields to confirm

- Active/inactive or lifecycle status
- Role assignments
- Project assignments
- Department, company, or organizational context
- Created-by and updated-by references
- Created/updated timestamps
- Last sign-in or activity information
- Notification and preference settings

### Lifecycle rules

Document whether user records are soft-deleted, archived, or hard-deleted. Identify foreign-key behavior for projects, work documents, quality records, labor entries, approvals, notifications, and audit records.

## 8. Roles, Permissions, and Project Scope

User administration is a privileged capability. Reviewers should confirm:

- Who can list all users
- Who can view a user’s personal data
- Who can create, edit, deactivate, and reactivate users
- Who can assign roles
- Who can assign project access
- Whether a user administrator can affect users outside their own project or organization
- Whether self-editing a role or permission is prevented
- Whether role/project changes take effect immediately or at the next login

Roles and Permissions should remain the policy owners. Users should hold assignments and identity context, not duplicate policy definitions.

## 9. Integrations and Side Effects

The module may affect the following areas and must document confirmed behavior:

- Auth: sign-in eligibility and session invalidation
- Roles and Permissions: effective access
- Projects: project membership and visibility
- Notifications: invitations, deactivation notices, and preference routing
- Audit: creation, edits, access changes, and lifecycle events
- Sync: mobile identity and access refresh
- Temporary Users: limited or exceptional user records
- Dashboards and reports: user ownership, responsibility, and filters

## 10. Security and Privacy Review

- Restrict user administration to authorized roles.
- Avoid returning credentials, tokens, provider secrets, or unnecessary personal data.
- Protect email, phone, and organization fields according to business policy.
- Validate all user-supplied text and identifiers.
- Prevent privilege escalation through request-body fields.
- Audit role, project, status, and identity changes.
- Ensure deactivated users cannot continue to submit data through stale web or mobile sessions beyond the intended policy.
- Confirm that exports are permission-controlled and do not expose more fields than the user directory.
- Define retention and deletion rules for personal data while preserving required audit history.

## 11. Testing Checklist

- Create a valid user
- Reject missing and malformed required fields
- Reject duplicate identity fields according to the intended uniqueness rules
- Enforce administrator permissions
- Prevent unauthorized role/project assignment
- Search, filter, sort, paginate, and export users
- Update permitted and restricted fields
- Deactivate and reactivate a user
- Verify effect on sign-in and existing sessions
- Verify effect on Flutter local state and synchronization
- Preserve historical references after deactivation
- Confirm audit events for all privileged changes
- Confirm redaction of sensitive fields for lower-privilege users

Existing automated test locations and coverage should be added during technical review. Manual scenarios should be retained for identity-provider, session, and mobile cases that are difficult to cover in unit tests.

## 12. Open Questions for Approval

1. Is the Users record created locally, synchronized from an identity provider, or both?
2. Which fields are globally unique: email, mobile number, external identity, or another identifier?
3. Is user creation invitation-based, administrator-created, self-registration, or a combination?
4. What exact lifecycle states are implemented?
5. Does deactivation revoke active sessions and refresh credentials immediately?
6. Can a user belong to multiple projects or organizations?
7. Who owns role and project assignment changes?
8. Which user fields can ordinary users edit themselves?
9. What is the retention policy for inactive users and personal data?
10. How are temporary users represented and separated from permanent users?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/users/`
- Authentication relationship: `Final Documentation/modules/auth.md`
- Related implementation areas: `backend/src/roles/`, `backend/src/permissions/`, project and temporary-user modules
- Client identity surfaces: `frontend/src/App.tsx`, `frontend/src/`, `flutter/lib/features/profile/`, `flutter/lib/features/auth/`

