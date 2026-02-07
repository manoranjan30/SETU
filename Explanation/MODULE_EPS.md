# EPS (Enterprise Project Structure) Module

## Overview
The EPS module manages the hierarchical organization of projects. It is the backbone of the application, defining how projects, towers, floors, and units are structured.

## Data Model

### `EpsNode` Entity
*   **id**: UUID
*   **name**: String
*   **type**: Enum (`COMPANY`, `PROJECT`, `BLOCK`, `TOWER`, `FLOOR`, `UNIT`, `ROOM`)
*   **parentId**: Self-referencing FK.
*   **projectProfile**: One-to-One relation to `ProjectProfile` (for Project-level nodes).

### `ProjectProfile` Entity
*   **Dynamic Properties**: Stores JSONB data for flexible schema (e.g., "RERA Number", "Launch Date").

## Key Features
1.  **Infinite Hierarchy**: No hard limit on depth, though logic enforces specific parent-child type relationships (e.g., TOWER must be under BLOCK or PROJECT).
2.  **Efficient Retrieval**: Uses recursive queries to fetch entire subtrees or specific levels.
3.  **Strict Typing**: DTOs enforce validity of creates/updates.

## Permissions & Security
*   **Isolation**: Non-admin users can ONLY see Projects (and descendants) they are specifically assigned to.
*   **Enforcement**:
    *   **Read**: Filtered at Database level (`findAll`).
    *   **Write**: Verified by `PermissionResolutionService` against assignments.
*   See `MODULE_PROJECTS.md` and `EPS_SUBTREE_PERMISSION_INHERITANCE.md` for detailed Resolution Logic.

## Events
*   `EpsNodeCreated`: (Proposed) Emit when a node is created to trigger default folder creation in DMS.
*   `EpsNodeDeleted`: Triggers cascade checks (prevent deletion if children exist).
