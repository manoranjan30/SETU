# Authentication Module

Status: Draft  
Recommended next step: technical and product-owner review  
Primary wave: A - Foundations and Access  
Last repository review: 2026-07-20

## 1. Purpose and Scope

The Authentication module establishes the identity of a person using SETU and provides the authenticated context used by downstream authorization and project-level access checks.

### In scope

- Sign-in and session establishment
- Token validation and authenticated request context
- Current-user identity resolution
- Authentication failures and session expiry
- The handoff between authentication, users, roles, and permissions
- Web and mobile authentication entry points

### Out of scope

- Role and permission administration, which belongs to the Roles and Permissions modules
- Project membership and business-resource authorization, which belongs to Projects and authorization policy documentation
- Business workflows performed after a user is authenticated

## 2. System Position

Authentication is an upstream platform capability. The expected request path is:

```text
Web or Flutter client
        -> authentication API / identity provider
        -> authenticated user context
        -> roles and permissions
        -> project and module authorization
        -> business module API
```

Every later module document should reference this document when describing login state, token requirements, or unauthenticated behavior.

## 3. Code and Configuration Map

The following locations are the starting evidence map and must be kept synchronized with the implementation:

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the Auth module with the NestJS application |
| Backend feature | `backend/src/auth/` | Authentication controllers, services, DTOs, guards, and supporting logic |
| Web entry point | `frontend/src/App.tsx` | Defines public/protected route behavior and authenticated application routing |
| Web API layer | `frontend/src/api/` and `frontend/src/services/` | Stores or sends authentication context for browser requests |
| Flutter entry point | `flutter/lib/` and `flutter/lib/features/auth/` | Mobile authentication screens, state, and integration |
| Shared authorization | Backend guards and permission modules | Uses authenticated identity for authorization decisions |

The exact class names, route decorators, token storage mechanism, and provider configuration should be confirmed from the files above during technical review. This avoids treating route names or inferred provider behavior as contractual facts.

## 4. Primary User Flows

### 4.1 Sign-in

1. The user opens the web or mobile sign-in experience.
2. The client collects the required identity credentials or provider response.
3. The client sends the authentication request to the configured identity endpoint.
4. The backend or identity provider validates the request.
5. On success, the client stores the session/token according to the platform implementation.
6. Subsequent requests include the authenticated context.
7. The user is routed to the authorized application surface.

### 4.2 Authenticated request

1. The client sends the token or session credential.
2. The backend authentication guard or middleware validates it.
3. The request receives a user identity.
4. Roles and permissions are evaluated by the relevant authorization layer.
5. The target module executes only if access is allowed.

### 4.3 Expired or invalid session

The client should treat an expired, malformed, revoked, or otherwise invalid credential as an authentication failure. The expected behavior is to clear unusable local credentials, return the user to sign-in, and avoid retry loops. Exact status codes and refresh behavior must be verified from the implementation.

### 4.4 Mobile/offline behavior

Authentication is a prerequisite for offline synchronization. The mobile document set must explicitly confirm whether an existing authenticated session can be used offline, how long it remains valid, and what happens when a sync operation discovers that the session has expired.

## 5. API Contract to Confirm

The Auth controller should be inventoried directly from route decorators. The final approved version must include one row for every endpoint using this format:

| Method | Path | Auth required | Request | Success response | Failure responses | Side effects |
|---|---|---:|---|---|---|---|
| To verify | To verify | Public or authenticated | DTO/body/query | Token/user/session shape | Validation and auth errors | User/session/audit effects |

The review must also confirm:

- Credential validation rules
- Token type, claims, expiry, and refresh strategy
- Whether the API returns user, role, or permission data at sign-in
- Whether logout invalidates server-side state or only clears client state
- Rate limiting, lockout, or brute-force controls
- CORS and client-origin expectations
- Error-message exposure and sensitive-data handling

## 6. Data and Identity Lifecycle

Authentication depends on a user identity, but identity ownership should remain with the Users module or configured identity provider. The documentation must identify the authoritative source for:

- User identifier
- Display name and email/mobile fields
- Active/inactive status
- Role assignments
- Project associations
- Provider-specific subject identifier
- Session or refresh-token records, if persisted

The Auth module should not be documented as owning user profile data unless the source code confirms that responsibility.

## 7. Security and Permissions

Authentication is the first security boundary; it does not replace authorization. Reviewers should verify:

- Passwords or provider secrets are never logged or returned.
- Tokens are stored using the platform-appropriate protected mechanism.
- Protected backend routes reject missing or invalid credentials.
- Token expiry and clock-skew behavior are predictable.
- User deactivation prevents continued access according to the intended policy.
- Authentication events are audited where required.
- Mobile local data is protected when a user signs out or changes account.
- Error responses do not reveal whether sensitive account details exist unless explicitly intended.

## 8. Dependencies and Consumers

### Upstream dependencies

- User identity source and user records
- Environment configuration and secrets
- Database or identity-provider availability
- Client runtime configuration

### Downstream consumers

- Roles and Permissions
- Projects and project membership
- Every protected backend controller
- Web protected routes and navigation
- Flutter feature access and synchronization
- Audit and notification behavior where configured

## 9. Failure and Support Scenarios

The final document should include verified handling for:

- Incorrect credentials
- Missing required credentials
- Inactive or deleted user
- Expired access token
- Invalid refresh token
- Identity provider outage
- Backend unavailable after successful sign-in
- Multiple accounts or account switching on mobile
- Sign-out while offline
- Device replacement or lost local credentials

## 10. Testing Checklist

- Successful sign-in with valid credentials
- Rejection of invalid credentials
- Protected endpoint rejection without credentials
- Protected endpoint rejection with malformed or expired credentials
- Correct authenticated user attached to the request
- Deactivated-user behavior
- Refresh or re-authentication behavior
- Browser reload behavior
- Mobile cold-start behavior
- Mobile offline and subsequent sync behavior
- Sign-out and local credential cleanup
- Regression checks for role and permission enforcement

The names and locations of existing automated tests should be added during the technical review. Untested behavior should be recorded as a gap, not assumed to work.

## 11. Open Questions for Approval

1. Is SETU authentication local, Firebase/provider-backed, or a combination?
2. Which exact endpoints establish, refresh, and terminate a session?
3. Where are web tokens stored and how are they cleared?
4. What is the intended session duration for web and Flutter?
5. Can authenticated users work offline, and what is the maximum offline window?
6. Does logout revoke refresh credentials server-side?
7. Which authentication events must be included in the audit trail?
8. Who owns sign-in policy decisions: the Auth module, Users, or an external identity provider?

## 12. Traceability

- Application module registration: `backend/src/app.module.ts`
- Backend authentication implementation: `backend/src/auth/`
- Web route protection: `frontend/src/App.tsx`
- Mobile authentication feature: `flutter/lib/features/auth/`
- Related documents: Users, Roles, Permissions, Projects, Audit, Sync

