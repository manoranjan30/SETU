# Synchronization Module

Status: Draft  
Primary wave: A - Foundations and Access  
Related modules: Auth, Users, Projects, Notifications, Audit, Common, Flutter feature modules  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Sync module coordinates data exchange between SETU clients, especially Flutter mobile clients that may operate with intermittent connectivity. It determines what data is downloaded, what offline actions are queued, how changes are uploaded, and how conflicts or authorization changes are handled.

### In scope

- Initial data/bootstrap synchronization
- Incremental pull and push synchronization
- Offline write queue
- Sync status, retries, and failure handling
- Conflict detection and resolution
- Project/user/permission scope during sync
- Local data invalidation and cleanup
- Sync observability and reconciliation

### Out of scope

- Authentication and token issuance, which belong to Auth
- Domain-specific business rules, which remain owned by each feature module
- General network infrastructure, except where needed for sync behavior
- Permanent server-side data ownership, which remains with backend domain modules

## 2. System Position

```text
Backend source of truth
    <-> sync API / change feed
    <-> client sync coordinator
    <-> local database/cache and offline queue
    <-> Flutter feature repositories and screens
```

The backend remains authoritative for authorization and final data validity. Local state supports continuity and offline work; it must not bypass server-side permission or validation rules.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the Sync module |
| Backend feature | `backend/src/sync/` | Sync endpoints, services, change tracking, and reconciliation logic |
| Flutter feature | `flutter/lib/features/sync/` | Sync coordinator, state, queue, repository, and UI/status behavior |
| Flutter storage | Sync feature and shared data/persistence directories | Stores local records, pending operations, and sync metadata |
| Feature consumers | `flutter/lib/features/*/` | Supplies domain records and consumes synchronized data |
| Web client | `frontend/src/` and API services | May refresh/read server state; exact sync participation must be confirmed |
| Shared identity | Auth, Users, Projects, Roles, Permissions | Determines authenticated and project-scoped sync context |

Exact local database technology, endpoint paths, queue model, and change-token fields must be verified from source before approval.

## 4. Sync Modes

The approved document should distinguish the supported modes:

- **Bootstrap**: first download of the user’s permitted project and reference data.
- **Incremental pull**: download changes since a cursor, timestamp, version, or token.
- **Push**: upload locally created or modified operations.
- **Bidirectional sync**: push local operations and pull server changes in an ordered cycle.
- **Manual sync**: user-triggered refresh or retry.
- **Automatic sync**: foreground, background, connectivity-triggered, or scheduled behavior.
- **Full resync**: recovery operation when local state or cursor is invalid.

For each mode, document network requirements, user feedback, concurrency limits, and failure recovery.

## 5. Core User Journeys

### 5.1 First-time project sync

1. The user authenticates and selects a permitted project.
2. The client requests bootstrap metadata and supported feature data.
3. The backend applies user, role, permission, and project scope.
4. The client stores records and synchronization metadata locally.
5. The client reports progress and final status.
6. The user can open supported offline features.

### 5.2 Offline create/update

1. The user performs a supported action without connectivity.
2. The client validates locally to the extent possible.
3. The operation receives a local identifier and enters the pending queue.
4. The UI indicates pending/syncing/failed state.
5. On connectivity, the client submits the operation.
6. The server validates authorization and business rules.
7. The client reconciles the server response and updates local state.

### 5.3 Incremental sync

1. The client sends its last known cursor/version and project context.
2. The backend returns authorized changes and the next cursor.
3. The client applies changes idempotently.
4. Pending local operations are retained or reconciled according to ordering rules.
5. The client commits the new cursor only after successful application.

### 5.4 Conflict resolution

The system must identify the conflicting resource, local operation, server version, winning value, and user-visible action. Silent last-write-wins behavior should not be assumed for approvals, safety, quality, financial, or ownership-sensitive records.

### 5.5 Sign-out or access removal

The client must define what happens to local project data, queued operations, cached notifications, and tokens when a user signs out, changes account, loses project membership, or becomes inactive.

## 6. Scope and Authorization

Every sync request and returned record must be scoped by authenticated user, project, organization, and effective permissions as applicable. Confirm:

- Whether the client can request multiple projects in one operation
- How project membership changes invalidate local data
- Whether permission changes are included in sync metadata
- Whether deleted/archived records are represented as tombstones
- How restricted records are removed from the client
- Whether a queued operation is rejected when access is removed before upload

The client must not treat locally cached data as proof that the user still has access.

## 7. Sync Queue and Idempotency

The approved document should describe each queued operation’s:

- Local operation identifier
- Entity/resource type and local identifier
- Project scope
- Operation type
- Payload or change set
- Creation time and device context
- Retry count and next retry time
- Current state: pending, uploading, applied, rejected, conflict, or abandoned
- Server response and error classification
- Correlation identifier

Uploads must be idempotent or safely deduplicated. Retrying after a timeout must not create duplicate work documents, snags, inspections, labor entries, approvals, or other business records.

## 8. API Contract to Confirm

Extract exact endpoint names and payloads from the Sync controller and Flutter data sources.

| Method | Path | Auth/scope | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | Bootstrap | Authenticated/project | Project, feature set, device/version | Initial dataset and cursor | Local initialization |
| To verify | Pull changes | Authenticated/project | Cursor, filters, limit | Changes, tombstones, next cursor | Local application |
| To verify | Push operation(s) | Authenticated/project | Idempotent operation batch | Applied/rejected/conflict results | Server writes |
| To verify | Sync status | Authenticated | Project/device context | Queue and last-sync status | None |
| To verify | Resolve conflict | To verify | Resource, versions, resolution | Reconciled record | Business/audit effects |
| To verify | Full resync | Authenticated/project | Project and reset reason | Rebuild dataset | Local invalidation |

For each confirmed endpoint, document batch limits, ordering, cursors, payload size, authorization, error categories, retry safety, and version compatibility.

## 9. Conflict and Error Classification

The implementation should distinguish at least:

- Network timeout or unavailable service
- Authentication expiry
- Permission/access removal
- Validation failure
- Business-state conflict
- Version conflict
- Duplicate/idempotency response
- Payload/schema incompatibility
- Storage or device-capacity failure
- Permanent server error

Each class must define whether the client retries automatically, asks the user to act, keeps the operation for later, or discards it with an explanation.

## 10. Data Lifecycle and Local Storage

Confirm:

- Which entities are stored locally
- Which fields are excluded or encrypted
- How local identifiers map to server identifiers
- How tombstones and deletions are represented
- How long local data is retained
- How storage is cleared on sign-out, account switch, project removal, or full resync
- How database/schema migrations are handled on app upgrade
- What happens when the device has insufficient storage

Sensitive project data should use platform-appropriate protection. Offline availability should be an explicit product decision by module, not an accidental result of caching.

## 11. Notifications and Audit

The document must confirm:

- Whether sync failures generate notifications
- Whether sync-created or sync-updated actions carry the original actor and source platform
- How audit events preserve offline event time and server acceptance time
- How retries and duplicate submissions appear in audit history
- Whether conflict resolution requires a separate audit event

## 12. Testing Checklist

- Bootstrap a new project successfully
- Pull incremental changes using a valid cursor
- Push a new offline record and reconcile its server identifier
- Retry after timeout without duplication
- Handle expired authentication
- Handle removed project access
- Reject invalid or unauthorized queued operations
- Detect and resolve version/data conflicts
- Apply tombstones and deletions correctly
- Recover from a corrupted/invalid cursor with full resync
- Sync across app restart and device restart
- Verify storage cleanup on sign-out/account switch
- Verify schema migration across mobile app versions
- Verify audit and notification behavior for failures/conflicts
- Test poor connectivity, intermittent connectivity, and large batches

Existing automated tests and device/network test coverage should be added during technical review.

## 13. Open Questions for Approval

1. Which Flutter feature modules support offline create/update?
2. What local database and encryption strategy is used?
3. Are sync cursors, timestamps, or version numbers authoritative?
4. Is synchronization project-by-project or multi-project?
5. What is the conflict policy for each high-risk entity type?
6. Are uploads idempotent, and how are duplicate operations detected?
7. How are permission changes and access removal propagated to devices?
8. What data is retained locally and for how long?
9. What background-sync behavior is supported on Android/iOS?
10. What operational metrics and alerts identify stuck queues or repeated failures?

## 14. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/sync/`
- Flutter implementation: `flutter/lib/features/sync/`
- Authentication reference: `Final Documentation/modules/auth.md`
- User reference: `Final Documentation/modules/users.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Project reference: `Final Documentation/modules/projects.md`
- Audit reference: `Final Documentation/modules/audit.md`
- Notification reference: `Final Documentation/modules/notifications.md`

