# Permission Resolution Engine (Architecture)

## Overview
This module defines how the system determines if `User U` has `Permission P` on `Node N`.
Instead of complex granular ACLs on every node, we use **Project-Based Inheritance** to ensure performance and manageability.

## Core Resolution Logic
The `PermissionResolutionService` follows this deterministic path:

1.  **Admin Bypass**:
    *   If User has Global `Admin` role -> **ALLOW**.

2.  **Project Context Resolution**:
    *   Find the **Project Root** `P` for `Node N`. (Traverse parents until type=PROJECT).
    *   If `N` is above Project (e.g., Company) -> Check Global Roles.

3.  **Assignment Verification**:
    *   Fetch `UserProjectAssignment` for `User U` on `Project P`.
    *   If No Assignment -> **DENY** (Zero Trust).
    *   If Assignment Inactive -> **DENY**.

4.  **Scope Verification**:
    *   If Assignment Scope is `FULL` -> Proceed to Role Check.
    *   If Assignment Scope is `LIMITED` to `Node S`:
        *   Check if `Node N` is a descendant of `Node S`.
        *   If Not Descendant -> **DENY**.

5.  **Role Verification**:
    *   Get the `Role` from the Assignment.
    *   Check if `Role.permissions` contains `Permission P`.
    *   If Yes -> **ALLOW**.
    *   If No -> **DENY**.

## Data Model
*   **UserProjectAssignment**: Links User, Project, Role, and Scope.
*   **Role**: Contains a flat list of permission strings (e.g., `EPS.UPDATE`, `TEAM.MANAGE`).

## Caching Strategy (Future)
*   Permission checks are frequent.
*   We can cache `(UserId, ProjectId) -> Permissions[]` in Redis/Memory.
*   Invalidate cache on `Assignment` update or `Role` update.
