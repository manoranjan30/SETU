# Authentication & Security Module

## Overview
The Authentication module handles user identity verification and access control. It follows a "Fail-Closed" security model—access is denied unless explicitly granted via Permissions.

## Architecture

### 1. JWT Strategy
*   **Login**: Accepts `username`/`password`. Validates against hashed password (bcrypt).
*   **Token Generation**: On success, generates a JWT containing:
    *   `sub`: User ID
    *   `username`: Username
    *   `roles`: Array of Role names
    *   `permissions`: Flattened array of ALL permissions from assigned roles.
*   **Validation**: The `JwtStrategy` validates the signature and extracts the payload into `req.user`.

### 2. Permissions Guard
*   **File**: `src/auth/permissions.guard.ts`
*   **Usage**: Global or Per-Controller.
*   **Logic**:
    1.  Checks for `@SetMetadata('permissions', [])`.
    2.  If 'Admin' role is present -> **ALLOW**.
    3.  If no permissions required -> **ALLOW**.
    4.  Otherwise, checks if `user.permissions` contains AT LEAST ONE of the required permissions.

### 3. Frontend Integration
*   **AuthContext**: Decodes JWT and stores `user` state.
*   **Sidebar**: Hides menu items if `user.permissions` misses the required code.
*   **ProtectedRoute**: React wrapper that redirects/blocks access if permission is missing.

## Security Architecture Layers (Implemented)
1.  **Level 1: Authentication** (JWT) - Verifies identity.
2.  **Level 2: Global Permissions** (RBAC) - `PermissionsGuard` checks generic rights (e.g., `EPS.VIEW`).
3.  **Level 3: Project Isolation** (Zero Trust) - `ProjectContextGuard` ensures request targets a project.
4.  **Level 4: Assignment Check** - `ProjectAssignmentGuard` checks `UserProjectAssignment` table.
5.  **Level 5: Scope Enforcement** - `PermissionResolutionService` validates scope (Full vs Limited).

## Key Files
*   **Backend**:
    *   `auth.service.ts`: Login logic, permission flattening.
    *   `permissions.guard.ts`: Level 2 Enforcer.
    *   `project-context.guard.ts`: Level 3 Enforcer.
    *   `project-assignment.guard.ts`: Level 4 Enforcer.
*   **Frontend**:
    *   `AuthContext.tsx`: Manages user state and permission helper `hasPermission()`.
    *   `menu.ts`: Maps UI items to Permissions.

## Future Extensibility
To add a new permission:
1.  Add code to `frontend/src/config/permissions.ts`.
2.  Add code to `SeedService` (backend) to ensure it exists in DB.
3.  Assign to a Role via UI or Seed.
4.  Protect Route/API using the new code.
