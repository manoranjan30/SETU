# Notifications Module

Status: Draft  
Primary wave: A - Foundations and Access  
Related modules: Auth, Users, Projects, Audit, Sync, Planning, Execution, Quality, EHS, Snag, Progress  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Notifications module informs users about events that require attention, confirm a workflow change, or provide operational updates. It should separate event generation from channel delivery so business modules do not need to know the details of web, mobile, email, or push delivery.

### In scope

- In-app notification records
- Notification templates and event types
- Recipient resolution
- Read/unread and acknowledgement state
- User notification preferences
- Web, Flutter, email, push, or other configured channels
- Delivery status, retries, and failure handling
- Project and role-based notification scope

### Out of scope

- The business decision that creates an event, which belongs to the originating module
- Authentication credentials or provider secrets
- General application logs
- Full workflow approval ownership, which remains with the relevant business module

## 2. System Position

```text
Business event or scheduled trigger
    -> notification event/recipient resolution
    -> template and preference evaluation
    -> channel delivery
    -> delivered/read/failed state
    -> audit and operational monitoring
```

Notifications should be treated as a cross-cutting service. Every business module should document which events it emits and link to this document for delivery behavior.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the Notifications module |
| Backend feature | `backend/src/notifications/` | Notification controllers, services, entities, templates, and delivery logic |
| Web client | `frontend/src/services/notification.service.ts` and related components | Fetches, displays, reads, and filters notifications |
| Web routing | `frontend/src/App.tsx` and protected views | Provides notification entry points and navigation |
| Flutter client | `flutter/lib/features/notifications/` if present, plus auth/settings/sync features | Displays notifications and stores mobile delivery state |
| User/preferences | Users, profile, and App Config modules | Supplies recipient identity and channel preferences |
| Business producers | Planning, execution, quality, EHS, snag, progress, and other modules | Emits notification-triggering events |

Exact provider integrations, event names, route paths, and client feature directories must be verified from source before approval.

## 4. Notification Model

The approved document should identify the canonical notification fields:

- Notification identifier
- Event type and template identifier
- Recipient user identifier or recipient group
- Project and resource context
- Title and body/content
- Priority or severity
- Channel and delivery status
- Created, scheduled, sent, delivered, read, and failed timestamps
- Deep link or route target
- Source module and source event identifier
- Retry count and failure reason
- Expiry date, if supported

Sensitive business data should not be placed in notification text when a secure deep link can direct the user to the protected record.

## 5. Notification Categories

The event catalog should distinguish at least:

- Informational updates
- Action-required notifications
- Approval and rejection events
- Schedule or milestone risks
- Quality, snag, EHS, and safety alerts
- Assignment and ownership changes
- User, role, permission, and project-access changes
- Synchronization or integration failures
- System or operational alerts

Each event type should identify its owner, priority, recipient rule, supported channels, template, expiry, and audit expectation.

## 6. Core User Journeys

### 6.1 Receive a notification

1. A business module emits a supported event.
2. The notification service resolves recipients using user, role, project, and responsibility context.
3. User preferences and channel policy are evaluated.
4. The notification is persisted or queued.
5. One or more channels attempt delivery.
6. Delivery status and failure information are recorded.

### 6.2 Read or acknowledge a notification

The system must distinguish `delivered`, `read`, and `acknowledged` if all three exist. An action-required notification should not be considered resolved merely because the message was opened.

### 6.3 Manage notification preferences

Users may be able to control channel preferences, categories, quiet hours, or digest behavior. Mandatory safety, security, and access notifications should not be suppressible unless explicitly approved by policy.

### 6.4 Follow a notification to its source

Deep links must preserve project and resource scope. A recipient who no longer has access should receive a safe access-denied experience rather than a data leak through notification content.

## 7. Recipient Resolution and Priority

The implementation must confirm how recipients are calculated:

- Direct user assignment
- Project member or project role
- Record owner or assignee
- Supervisor/manager chain
- Permission-based audience
- Static operational group
- Broadcast or system-wide audience

The system should define deduplication when one user qualifies through multiple paths. It should also state whether priority is inherited from the event, template, project, or recipient policy.

## 8. API Contract to Confirm

Extract exact endpoint names and paths from the Notifications controller and client service.

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List my notifications | Authenticated | Status, category, project, pagination | Notification page | Read tracking only when specified |
| To verify | Get notification | Authenticated | Notification identifier | Notification detail | None |
| To verify | Mark read/acknowledge | Authenticated | Notification identifier/action | Updated state | Read/audit event if configured |
| To verify | Update preferences | Authenticated | Preference DTO | Updated preferences | Preference audit if required |
| To verify | Notification administration | To verify | Template/event filters | Administrative data | None |
| Internal/to verify | Create/queue notification | Service/system | Event and recipient data | Queued/persisted result | Delivery attempts |

For each confirmed endpoint, document recipient scope, ownership checks, pagination, idempotency, error handling, and whether the action changes business workflow state.

## 9. Delivery Channels and Reliability

The approved document must identify supported channels and their guarantees:

- In-app/web
- Flutter push or local notification
- Email
- SMS or messaging provider, if configured
- Digest or scheduled delivery

For each channel, document provider, credentials/configuration, timeout, retry/backoff, rate limits, duplicate handling, delivery receipt, failure status, and support escalation. Delivery failure should not silently erase the underlying business event.

## 10. Data Model and Retention

Confirm the actual storage for:

- Notification event
- Recipient association
- Delivery attempt
- Read/acknowledgement state
- Preference
- Template and version
- Source event/correlation identifier

Define retention and cleanup for old notifications, failed deliveries, read history, and user preferences. Audit records should remain independent when a notification is deleted from a user’s inbox.

## 11. Security and Privacy

- Enforce recipient authorization when creating and retrieving notifications.
- Do not trust client-supplied recipient or project identifiers.
- Avoid sensitive data in push previews, email subjects, and browser notifications.
- Protect notification deep links with normal backend authorization.
- Do not allow one user to mark or inspect another user’s private notifications without explicit permission.
- Protect provider credentials and webhook verification.
- Audit administrative template, event, and preference-policy changes.
- Define behavior after a user is deactivated or loses project access.

## 12. Integrations and Consumers

### Upstream dependencies

- Authenticated user identity
- Users, Roles, Permissions, and Projects
- App Config and provider configuration
- Events from business modules
- Audit and scheduling infrastructure

### Downstream consumers

- Web inbox, badges, banners, and deep links
- Flutter notifications and local/offline state
- Email/push providers
- Audit and operational reporting
- Support workflows for failed delivery

## 13. Mobile and Synchronization Behavior

The final document must confirm:

- Whether notifications are available offline
- How unread state is synchronized across web and Flutter
- How duplicate push and in-app messages are deduplicated
- What happens when a notification points to an inaccessible project
- Whether read/acknowledgement actions queue offline
- How notification state is cleared on sign-out or account switching

## 14. Testing Checklist

- Generate a notification from each supported event category
- Resolve recipients correctly by user, role, project, and assignment
- Deduplicate multi-path recipients
- Apply mandatory and optional preferences correctly
- Deliver through each configured channel
- Retry transient failures and record permanent failures
- Prevent unauthorized notification access
- Mark read and acknowledge correctly
- Preserve notification-to-source deep-link scope
- Verify web and Flutter unread state synchronization
- Verify deactivated-user and removed-project-member behavior
- Verify template/version changes do not corrupt existing records
- Confirm audit and operational visibility of high-risk delivery failures

Existing automated tests and provider-integration gaps should be added during technical review.

## 15. Open Questions for Approval

1. Which delivery channels are active in production?
2. Which events are mandatory, optional, or user-configurable?
3. Are notification templates database-managed, code-managed, or hybrid?
4. How are recipients resolved for project and record-level events?
5. What are the retry, deduplication, and rate-limit policies?
6. Is acknowledgement different from read state in business workflows?
7. How are push/email previews protected from sensitive data exposure?
8. What happens to queued notifications after user deactivation or project-access removal?
9. What is the retention policy for delivered, read, and failed notifications?
10. Which notification events must be included in the audit trail?

## 16. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/notifications/`
- Web service: `frontend/src/services/notification.service.ts`
- Authentication reference: `Final Documentation/modules/auth.md`
- User reference: `Final Documentation/modules/users.md`
- Role/permission references: `Final Documentation/modules/roles.md`, `Final Documentation/modules/permissions.md`
- Project reference: `Final Documentation/modules/projects.md`
- Audit reference: `Final Documentation/modules/audit.md`
- Sync reference: `Final Documentation/modules/sync.md` (planned)

