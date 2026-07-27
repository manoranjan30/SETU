# Audit Module

Status: Draft  
Primary wave: A - Foundations and Access  
Related modules: Auth, Users, Roles, Permissions, Projects, Notifications, Sync, every business module  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Audit module records significant security, administrative, and business actions in SETU. It provides an authoritative history of who performed an action, what changed, when it happened, and which project or resource was affected.

### In scope

- Authentication and access events, where configured
- User, role, permission, and project changes
- Create, update, approve, submit, reject, archive, and delete events
- Before/after values or change summaries
- Project and resource context
- Audit search, filtering, export, and retention
- Audit access controls and tamper-resistance expectations

### Out of scope

- Application debugging logs and stack traces
- High-volume performance telemetry unless explicitly stored as audit data
- Business records themselves, which remain owned by their functional modules
- Notification delivery logs unless they are explicitly part of audit history

## 2. System Position

```text
User or system action
    -> business/security operation
    -> audit event creation
    -> protected audit storage
    -> authorized search/reporting/export
```

Audit is cross-cutting. Each module document should identify its auditable events and link back to this document instead of defining separate incompatible audit conventions.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the Audit module |
| Backend feature | `backend/src/audit/` | Audit controllers, services, DTOs, entities, and query logic |
| Security context | Auth, Users, Roles, and Permissions modules | Provides actor and authorization context |
| Business producers | All backend domain modules | Emit audit events for significant changes and actions |
| Web consumers | Administration, project, and reporting views | Display or filter audit history where permitted |
| Mobile producers/consumers | Flutter feature and sync modules | Record or synchronize mobile-originated actions as supported |
| Runtime operations | Docker, database, and deployment configuration | Retention, backup, access, and operational handling |

Exact event names, persistence fields, controller paths, and producer behavior must be verified from source before approval.

## 4. Audit Event Model

The approved document should identify the canonical event structure. At minimum, confirm support for:

- Event identifier
- Event timestamp and timezone
- Actor user identifier and display context
- System/service actor when no human initiated the action
- Action name and event category
- Module/resource type
- Resource identifier
- Project/organization scope
- Request or correlation identifier
- Source platform: web, Flutter, API, job, or integration
- Outcome: success, failure, denied, or partial
- Change summary
- Before and after values where appropriate
- Reason/comment or approval reference, where required

Sensitive values, credentials, tokens, and unnecessary personal data must not be captured in raw form.

## 5. Events to Record

The exact event catalog must be confirmed with product and security owners. The baseline review should cover:

### Access and identity

- Sign-in success and failure, if policy requires
- Sign-out and token/session events, if available
- Account activation, deactivation, suspension, and restoration
- Password or identity-provider changes, without recording secrets

### Authorization administration

- Role creation, update, and retirement
- Permission catalog changes
- Role-permission changes
- User-role assignments
- Project membership changes

### Project and business operations

- Project creation and lifecycle transitions
- Important record creation and updates
- Submissions, approvals, rejections, and reversals
- Imports, exports, bulk updates, and deletions
- File uploads, downloads, and document state changes where sensitive

### Operational and integration events

- Synchronization conflicts or rejected changes
- Background jobs with business impact
- External integration actions and failures
- Configuration and feature-flag changes

Each functional module should state which of these categories apply to its data.

## 6. Audit Capture Rules

The implementation must confirm:

- Whether audit creation occurs in controllers, services, interceptors, database triggers, or a combination
- Whether audit events are written in the same transaction as the business change
- What happens when the business action succeeds but audit persistence fails
- Whether failed and denied actions are recorded
- How bulk operations are represented
- How system-generated and user-generated events are distinguished
- Whether offline/mobile events carry the original event time and sync time
- How correlation IDs connect related actions across services

For high-risk actions, losing the audit event should not be silently ignored. The operational policy must define retry, failure, alerting, and reconciliation behavior.

## 7. Core User Journeys

### 7.1 View audit history

An authorized user filters audit history by project, module, actor, action, resource, date range, outcome, or source platform. The document must define visibility by role and project scope.

### 7.2 Investigate a change

1. An operator identifies a resource or business event.
2. The operator opens the related audit history.
3. The system shows actor, timestamp, action, scope, result, and change summary.
4. The operator follows correlation or related-resource links where available.
5. The operator exports or shares the result only if permitted.

### 7.3 Review an administrative access change

Role, permission, project-membership, and user-status changes should expose enough context to determine who made the change, what access was affected, and when it became effective.

## 8. API Contract to Confirm

Extract the exact endpoint inventory from the Audit controller and any shared audit query routes.

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List audit events | To verify | Date, actor, project, module, action, outcome, pagination | Audit page | None |
| To verify | Get audit event | To verify | Event identifier | Full event detail | None |
| To verify | Resource history | To verify | Resource type and identifier | Related history | None |
| To verify | Export audit history | To verify | Filters and format | File/download result | Export audit event |
| Internal/to verify | Write audit event | Service/system | Event DTO | Persisted event | Audit storage |

For each confirmed endpoint, document authorization scope, filtering limits, sort order, pagination, export redaction, error responses, and retention behavior.

## 9. Data Model and Retention

The approved document must identify:

- Audit entity/table and indexes
- Event payload storage format
- Before/after value storage and redaction rules
- Actor and resource relationships
- Project/organization scope
- Correlation and request identifiers
- Retention period and archive strategy
- Immutability or append-only expectations
- Backup and restore treatment
- Deletion or legal-hold behavior

Audit history should be append-oriented. If correction or redaction is legally required, the system should preserve evidence that a controlled redaction occurred without rewriting unrelated history.

## 10. Security and Privacy

- Restrict audit access using server-side authorization and project scope.
- Prevent ordinary users from modifying or deleting audit entries.
- Do not record passwords, access tokens, refresh tokens, or private secrets.
- Redact personal or commercially sensitive fields where full values are unnecessary.
- Protect audit exports and generated files.
- Audit access to the audit history itself for sensitive environments.
- Ensure timestamps are consistent and include timezone or UTC semantics.
- Protect against spoofed actor, project, resource, and source-platform fields.

## 11. Integrations and Consumers

### Upstream dependencies

- Authenticated identity and authorization context
- Users, Roles, Permissions, and Projects
- Business module transaction outcomes
- Sync and background-job context

### Downstream consumers

- Security investigations and compliance reporting
- Project and module administration
- Support and troubleshooting workflows
- Approval and accountability reporting
- Exports and executive reporting, where appropriate
- Backup, retention, and operational monitoring

## 12. Mobile and Synchronization Behavior

The final document must confirm:

- Whether Flutter writes audit events locally or only through the backend
- Whether offline actions carry device time, server time, or both
- How audit records are reconciled after sync
- How duplicate/retried operations are represented
- Whether a user can view audit history offline
- What happens to local audit data after sign-out or project-access removal

## 13. Testing Checklist

- Record a successful create/update action
- Record an approval, rejection, and lifecycle transition
- Record access-control changes
- Record denied and failed high-risk operations according to policy
- Verify actor and project scope cannot be spoofed
- Verify before/after values and sensitive-field redaction
- Verify transaction behavior when audit persistence fails
- Query by actor, project, module, resource, action, outcome, and date
- Verify pagination, sorting, and export restrictions
- Verify append-only or mutation protection
- Verify mobile/offline event handling and deduplication
- Verify retention, archive, backup, and restore procedures

Existing automated test locations and audit coverage gaps should be added during technical review.

## 14. Open Questions for Approval

1. What is the mandatory audit-event catalog for every module?
2. Are failed and denied operations recorded, and at what detail level?
3. Is audit persistence in the same transaction as the business change?
4. What is the retention period and archive policy?
5. Who may search and export audit history?
6. Which fields require masking or omission?
7. Is the audit store append-only or otherwise tamper-evident?
8. How are bulk changes represented and correlated?
9. How are offline/mobile actions timestamped and deduplicated?
10. What alerting is required when audit persistence or integrity checks fail?

## 15. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/audit/`
- Authentication reference: `Final Documentation/modules/auth.md`
- User reference: `Final Documentation/modules/users.md`
- Role reference: `Final Documentation/modules/roles.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Project reference: `Final Documentation/modules/projects.md`
- Sync relationship: `Final Documentation/modules/sync.md` (planned)

