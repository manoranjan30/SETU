# Common and Shared Services Module

Status: Draft  
Primary wave: A - Foundations and Access  
Related modules: Auth, Users, Roles, Permissions, Projects, App Config, Audit, Notifications, Sync, every business module  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Common/Shared Services area contains reusable technical capabilities used across SETU modules. It establishes consistent behavior for validation, errors, authorization helpers, pagination, file handling, logging, dates, identifiers, responses, and other cross-cutting concerns.

### In scope

- Shared DTOs, enums, constants, and types
- Validation and transformation helpers
- Common API response and error conventions
- Pagination, filtering, sorting, and query helpers
- Authentication and authorization support helpers
- Audit, notification, and event integration helpers
- File and document utilities
- Logging, correlation, and request-context utilities
- Date, time, number, and identifier utilities
- Shared web and Flutter API/model utilities where applicable

### Out of scope

- Domain-specific business rules
- Ownership of users, projects, roles, permissions, or audit records
- Infrastructure services with separate operational documentation

## 2. System Position

```text
Shared contracts and utilities
    -> backend domain modules
    -> web API/services/components
    -> Flutter repositories/features
    -> consistent validation, errors, data access, and operations
```

Shared code has a high blast radius. Changes require cross-module compatibility review and migration notes where behavior changes.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Imports shared/common capabilities into the application |
| Backend shared code | `backend/src/common/` | Shared guards, decorators, filters, interceptors, DTOs, helpers, and utilities |
| Backend consumers | `backend/src/*/` | Domain modules using shared contracts and services |
| Frontend shared code | `frontend/src/api/`, `frontend/src/config/`, `frontend/src/types/`, `frontend/src/utils/`, `frontend/src/components/` | Transport, types, formatting, and reusable UI behavior |
| Flutter shared code | `flutter/lib/` and feature shared layers | Networking, persistence, state, and platform behavior |
| Runtime configuration | Root Docker/configuration files | Environment, service URL, and operational behavior |

Exact directory contents and ownership boundaries must be verified from source before approval.

## 4. Shared Contract Categories

### API and transport

- Base URL and environment resolution
- Request headers and authentication context
- Correlation/request identifiers
- Timeout and retry policy
- Response normalization
- Error parsing and display-safe messages

### Validation and errors

- DTO validation and transformation
- Required, optional, and null semantics
- Standard validation, not-found, conflict, forbidden, unauthorized, and server-error responses
- Client-side mapping of backend errors

### Query behavior

- Pagination defaults and maximums
- Sorting and filter syntax
- Search behavior
- Date-range and timezone handling
- Export limits and empty-result behavior

### Security and operations

- Authentication guards and permission helpers
- Project/resource-scope checks
- User-context extraction
- File/upload validation
- Redaction and safe logging
- Structured logs, correlation, health, and background-job conventions

## 5. Request Lifecycle

The final document should describe the actual backend request path:

```text
Request
    -> correlation/request context
    -> authentication
    -> authorization
    -> validation/transformation
    -> controller
    -> service/business logic
    -> persistence/integration
    -> audit/notification side effects
    -> normalized response or error
```

Confirm the actual ordering of guards, pipes, interceptors, filters, transactions, logging, and audit behavior. Ordering differences can change security and error handling.

## 6. API and Error Standards

The approved document must define:

- Successful response shape, if a wrapper is used
- Error code versus human-readable message
- Field-level validation errors
- Pagination metadata
- Request/correlation identifier exposure
- HTTP status mapping
- Retryable versus non-retryable errors
- Safe user messages versus operator diagnostics

Domain modules should not invent competing formats without an explicit decision record.

## 7. Validation and File Safety

Confirm that:

- Input DTO validation occurs on the server
- Unknown fields are rejected or stripped intentionally
- Numeric, date, enum, and identifier formats are consistent
- File names, MIME types, sizes, and content are checked where uploads exist
- Client validation is convenience, not security enforcement
- Validation messages do not expose internal structure or sensitive values
- File downloads and previews enforce project/resource access
- Temporary files are cleaned up and generated-file retention is defined

Business modules remain responsible for why a file exists and what workflow state it represents.

## 8. Date, Time, and Client Behavior

The project should establish one standard for:

- Server storage timezone and client display timezone
- Date-only versus timestamp semantics
- Daylight-saving and calendar calculations
- Number, currency, percentage, and unit formatting
- Locale and language behavior
- Web protected routing and global API errors
- Flutter connectivity, local persistence, and sync errors

Planning, milestones, labor, progress, notifications, and audit records are especially sensitive to inconsistent date handling.

## 9. Dependencies and Consumers

### Upstream dependencies

- Runtime environment and service configuration
- Framework lifecycle and dependency injection
- Database/ORM and transport libraries
- Authenticated request context

### Downstream consumers

- Every backend domain module
- Every web page, view, component, and service
- Every Flutter feature and synchronization path
- Audit, notifications, files, reports, and integrations

## 10. Security and Operational Requirements

- Keep shared security helpers centralized and consistently applied.
- Do not log credentials, tokens, sensitive payloads, or protected personal data.
- Use safe defaults for validation, file handling, timeouts, and permissions.
- Ensure correlation identifiers cannot spoof actor or project context.
- Define backward compatibility for shared API contracts.
- Monitor shared error rates, latency, file failures, and retry loops.
- Record breaking changes and migration requirements.

## 11. Testing Checklist

- Shared validation accepts valid data and rejects invalid data consistently
- Standard errors map correctly across representative modules
- Unauthorized and forbidden requests are distinguished correctly
- Project/resource-scope helpers prevent cross-project access
- Pagination, sorting, and filtering behave consistently
- Date/time utilities handle boundary cases
- File validation rejects unsafe types and oversized payloads
- Correlation IDs propagate through logs and side effects
- Audit and notification helpers preserve actor/resource context
- Web and Flutter clients handle common errors consistently
- Shared changes pass regression tests across affected modules

## 12. Open Questions for Approval

1. Which code is officially owned by Common versus a feature module?
2. What is the canonical API success and error format?
3. What are the pagination, filtering, sorting, and export standards?
4. Which shared helpers enforce authentication, permissions, and project scope?
5. What is the server/client timezone policy?
6. What is the shared file-upload and download policy?
7. Which shared services are safe to use from Flutter offline flows?
8. What is the compatibility policy for changing shared DTOs or response fields?
9. Which common errors are retryable?
10. What regression gate is required for shared security or transport changes?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend shared code: `backend/src/common/`
- Backend modules: `backend/src/`
- Web shared code: `frontend/src/api/`, `frontend/src/config/`, `frontend/src/types/`, `frontend/src/utils/`, `frontend/src/components/`
- Flutter shared code: `flutter/lib/`
- Auth reference: `Final Documentation/modules/auth.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Audit reference: `Final Documentation/modules/audit.md`
- Notification reference: `Final Documentation/modules/notifications.md`
- Sync reference: `Final Documentation/modules/sync.md`

