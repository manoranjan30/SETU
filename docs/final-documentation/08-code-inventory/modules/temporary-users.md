# Temporary Users Module

Status: Draft  
Primary wave: E - Analytics and Extensibility  
Related modules: Auth, Users, Roles, Permissions, Projects, Audit, Notifications, Sync

## Purpose

Manages limited-duration or exceptional user access for contractors, visitors, reviewers, vendors, or other temporary participants.

## Documentation Requirements

Document creation/invitation, identity linkage, expiry, scope, role restrictions, activation/deactivation, renewal, project access, session revocation, data retention, and distinction from permanent Users.

## Code and Review

Inspect `backend/src/temp-user/`, `frontend/src/services/tempUser.service.ts`, routes, invitation/notification logic, and mobile behavior. Confirm whether temporary users share Auth/Users records or use a separate identity path.

## Security and Testing

Enforce automatic expiry, least privilege, project isolation, audit, and token/session invalidation. Test invitation, expiry, renewal, access removal, offline data cleanup, duplicate identities, and historical audit references.

