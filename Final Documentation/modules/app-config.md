# App Config Module

Status: Draft  
Primary wave: A - Foundations and Access  
Related modules: Projects, Auth, Users, Roles, Permissions, Notifications, Sync, Deployment  
Last repository review: 2026-07-20

## 1. Purpose and Scope

The App Config module centralizes runtime and business configuration used by SETU. It provides controlled values for application behavior without requiring every change to be hard-coded into a client or service.

### In scope

- Global application settings
- Project-scoped settings
- Reference values and configurable business parameters
- Feature flags and module enablement, where implemented
- Client/runtime configuration exposed to web or Flutter
- Configuration validation, versioning, and audit

### Out of scope

- Secrets and credentials, which must remain in protected deployment configuration
- User identity and access policy, which belong to Auth, Users, Roles, and Permissions
- Business records that happen to contain configurable values
- Infrastructure deployment configuration unless explicitly surfaced through the application

## 2. System Position

```text
Deployment/environment configuration
        -> application configuration service
        -> global and project-scoped values
        -> backend modules and client runtimes
        -> business behavior, labels, limits, and feature availability
```

Configuration is behavior. Changes must be treated as controlled changes with ownership, validation, audit, and rollback expectations.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the App Config module |
| Backend feature | `backend/src/app-config/` | Configuration controllers, services, DTOs, entities, and validation |
| Environment configuration | Backend root configuration and Docker files | Supplies environment-specific values and service endpoints |
| Web runtime | `frontend/src/config/` and API bootstrap | Reads runtime/client configuration |
| Web consumers | `frontend/src/` and `frontend/src/services/` | Applies configured feature, display, and behavior values |
| Mobile runtime | `flutter/lib/features/server_setup/`, settings, and shared configuration | Stores server and client configuration on Flutter |
| Project context | `backend/src/projects/` and project-facing clients | Applies project-scoped settings |

Exact config keys, precedence, storage, and mutation routes must be verified from source before approval.

## 4. Configuration Classes

The final document should classify every setting into one of these categories:

- **Secret**: credentials, signing keys, private tokens, or passwords; never expose through ordinary app-config APIs.
- **Environment**: deployment-specific service URLs, database settings, and infrastructure behavior.
- **Global runtime**: settings shared by the entire application instance.
- **Project-scoped**: values belonging to one project, such as units, thresholds, calendars, or enabled modules.
- **Reference data**: controlled lists used by business modules.
- **Feature flag**: switches that enable or disable a capability.
- **User preference**: personal display or notification behavior, owned by Users/Profile where appropriate.

The module must document the source of truth and owner for each class.

## 5. Precedence and Resolution

The implementation must define the resolution order when values exist at more than one level. A typical model is:

```text
Secret/deployment value
    -> global application value
    -> organization value
    -> project value
    -> user preference
    -> module default
```

Do not assume this order is implemented. The approved document must explicitly state:

- Which levels exist
- Which level wins
- Whether a value can be nullified or only overridden
- What happens when a value is missing or invalid
- Whether values are cached
- How changes propagate to already-running clients

## 6. Core User Journeys

### 6.1 View configuration

An authorized administrator views configuration by category, scope, status, and effective value. Sensitive fields must be masked or excluded.

### 6.2 Update a configuration value

1. An authorized administrator selects a configuration key and scope.
2. The system displays the current value, source, and impact where possible.
3. The administrator enters a new value.
4. The backend validates type, range, allowed values, and scope.
5. The value is saved and versioned/audited.
6. Dependent modules and clients receive the change according to the refresh policy.

### 6.3 Enable or disable a feature

Feature flags must document activation scope, rollout behavior, dependency checks, user impact, and rollback steps. Disabling a feature should not destroy data created while it was active.

### 6.4 Apply project defaults

When a project is created, the system may apply global defaults, templates, or reference data. Document whether defaults are copied or dynamically inherited, and whether later global changes affect existing projects.

## 7. API Contract to Confirm

Extract the exact endpoint inventory from the App Config controller and any project-config routes.

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List config | To verify | Category, scope, status, and search filters | Config summaries | None |
| To verify | Get effective value | To verify | Key and optional project/user context | Resolved value/source | None |
| To verify | Create/update config | To verify | Key, value, scope, and version | Saved config | Cache refresh and audit |
| To verify | Enable/disable feature | To verify | Flag and scope | Updated flag | Module/client behavior change and audit |
| To verify | List reference data | To verify | Category and status | Reference values | None |
| To verify | Update reference data | To verify | Value DTO | Updated values | Validation, cache refresh, and audit |

For every confirmed endpoint, document type validation, secret handling, scope authorization, optimistic locking/versioning, error responses, and cache invalidation.

## 8. Data Model and Lifecycle

The approved document must identify:

- Configuration key and value storage
- Value type representation
- Scope columns/relationships
- Default values
- Effective-value resolution
- Version/history records
- Created-by and updated-by references
- Activation dates or scheduled changes, if supported
- Soft-delete/deprecation behavior

Configuration changes should be recoverable. For high-impact values, retain the previous value and provide a clear rollback procedure.

## 9. Security and Governance

- Never store or return secrets through ordinary configuration-management screens.
- Restrict configuration changes by key, scope, and administrator role.
- Validate values server-side, including ranges and allowed enumerations.
- Prevent configuration keys or scope identifiers from being supplied to bypass authorization.
- Audit all high-impact changes with old and new values, excluding secrets.
- Make the effective scope and downstream impact visible before saving.
- Separate feature rollout from permission enforcement; disabling a feature must not be treated as a security control.
- Protect configuration exports and environment diagnostics.

## 10. Integrations and Consumers

### Upstream dependencies

- Environment and deployment configuration
- Authenticated administrator context
- Users, Roles, and Permissions
- Projects and organization scope

### Downstream consumers

- Planning calendars, thresholds, units, and defaults
- Execution, quality, EHS, labor, and progress rules
- Notifications and scheduled behavior
- Dashboard and reporting settings
- Web and Flutter runtime settings
- PDF processor and external service URLs
- Sync limits, feature availability, and offline behavior

Known configuration mismatches or invalid defaults should be recorded in the operational documentation and linked to an explicit decision or issue.

## 11. Client and Cache Behavior

The final document must confirm:

- How web clients obtain runtime configuration
- Whether browser reload is required after a change
- How Flutter obtains and stores server configuration
- Whether project configuration is cached offline
- How cache invalidation works
- What happens when a configured service is unavailable
- Which configuration values are safe to expose to clients
- Whether old client versions remain compatible with new configuration values

## 12. Testing Checklist

- Read global and project-scoped configuration according to permissions
- Resolve effective values with all supported precedence levels
- Reject invalid type, range, enum, and scope values
- Prevent unauthorized configuration changes
- Mask or exclude secrets
- Verify cache invalidation and client refresh behavior
- Enable and disable a feature safely
- Roll back a configuration change
- Preserve audit history
- Apply project defaults correctly at creation
- Verify existing projects are not changed unexpectedly by global updates
- Confirm web and Flutter compatibility
- Verify behavior when configuration is missing or service endpoints are unavailable

Existing automated test locations and configuration-specific test gaps should be added during technical review.

## 13. Open Questions for Approval

1. Which settings are global, project-scoped, organization-scoped, or user-specific?
2. What is the authoritative source for each configuration category?
3. Are feature flags managed through App Config or another service?
4. Are configuration values versioned and rollback-capable?
5. What is the exact precedence order?
6. Which values may safely reach the browser or Flutter client?
7. How quickly do changes propagate to running services and mobile devices?
8. How are configuration changes approved and audited?
9. Which defaults are copied into a new project versus inherited dynamically?
10. Which deployment values must remain outside the database and application UI?

## 14. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/app-config/`
- Environment/deployment references: `docker-compose.yml`, `docker-compose.dev.yml`, backend and frontend configuration
- Project relationship: `Final Documentation/modules/projects.md`
- Access relationship: `Final Documentation/modules/roles.md` and `Final Documentation/modules/permissions.md`
- Web configuration: `frontend/src/config/`
- Mobile setup/configuration: `flutter/lib/features/server_setup/` and settings features

