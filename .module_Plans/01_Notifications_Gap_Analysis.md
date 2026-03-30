# Notifications Gap Analysis and Solution Plan

## Current State

### Existing backend push capabilities

File scanned:

- `backend/src/notifications/push-notification.service.ts`

Supported today:

- send to explicit users
- send to users in a project role
- send to users in a project who hold a permission
- resolve users by project role for approval workflows

Existing module integrations found:

- planning
- release strategy
- quality
- EHS
- quality inspection workflow

### Current gaps

1. Message composition is decentralized
2. Many payloads do not resolve readable project/tower/floor/activity context
3. Approval notifications are not built from a single approval-authority contract
4. Push and in-app notifications are split
5. There is no preference model for user-level channel control
6. Notification bodies can still expose ids indirectly through generic messages

## Target State

Notifications should be:

- project-scoped
- authority-aware
- permission-aware
- human-readable
- available as push and in-app feed where relevant

Example target message:

- `Quality Approval Required`
- `Project: Equinox 2 | Floor: H3 > 1 | RFI #124 requires QC Manager approval`

## Proposed Architecture

### 1. Notification Context Resolver

New shared service:

- `NotificationContextService`

Responsibilities:

- resolve project name
- resolve EPS path
- resolve readable floor/tower/block label
- resolve activity code and name
- resolve WO/vendor/document/issue labels
- return a normalized context object

### 2. Notification Composer

New shared service:

- `NotificationComposerService`

Responsibilities:

- map domain events to titles and body templates
- produce short push body plus richer in-app content
- avoid ids in user-facing text

### 3. Notification Event Types

Standardize event categories:

- approval required
- approval approved
- approval rejected
- assignment created
- issue due/overdue
- inspection raised
- observation closed
- drawing action required
- progress approval pending

### 4. Delivery Router

Use existing transport plus a richer routing layer:

- user-specific
- project-role
- project-permission
- approval-authority resolution

## Module Coverage Plan

### Phase A

- planning approvals
- progress approvals
- quality inspection workflow
- EHS observations

### Phase B

- design register/revision actions
- issue tracker
- milestone triggers
- snag approvals

## Data Model Additions

Recommended:

- `notification_event` table
- `notification_recipient` table
- optional `user_notification_preference` table

This allows:

- push retries
- in-app inbox
- read/unread tracking
- auditability

## Verification

- correct recipients for project permission and approval authority
- no cross-project leakage
- project/floor labels visible in notification text
- no raw ids in push body
- read/unread state available for in-app notifications

