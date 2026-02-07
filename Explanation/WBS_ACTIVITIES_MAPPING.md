# WBS Activities Mapping Architecture

## Overview
Activities represent the smallest units of work execution attached to a specific WBS Node. While WBS defines the "What" (Deliverables), Activities define the "How" (Tasks).

**Constraints:**
1.  **Ownership**: Every Activity MUST belong to exactly one WBS Node.
2.  **Scope**: Activities inherit the Project Context of their parent WBS Node.
3.  **Scheduling**: Dates and Logic (Predecessors) are explicitly **EXCLUDED** from this module (reserved for Schedule Module).

## Data Model

### Entity: `Activity`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | PK (Int) | Unique Identifier |
| `projectId` | FK (Int) | Project Context (Redundant but efficient for guards) |
| `wbsNodeId` | FK (Int) | Parent WBS Node |
| `activityCode` | String | Unique within Project (e.g., "A100") |
| `activityName` | String | Descriptive Name |
| `activityType` | Enum | `TASK`, `MILESTONE` |
| `responsibleRoleId` | FK (Int) | Role responsible for execution |
| `responsibleUserId` | FK (Int) | User responsible for execution (Optional override) |
| `status` | Enum | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` |
| `createdOn` | Timestamp | Audit |
| `createdBy` | String | Audit |

## Permissions

| Permission | Description |
| :--- | :--- |
| `ACTIVITY.READ` | View activities within assigned scope |
| `ACTIVITY.CREATE` | Create activities (Requires `WBS.UPDATE` or specific `ACTIVITY.CREATE`) |
| `ACTIVITY.UPDATE` | properties, status |
| `ACTIVITY.DELETE` | Delete activity (Validation: No linked records in future modules) |

## API Endpoints

-   `GET /projects/:projectId/wbs/:wbsNodeId/activities` - List activities for a node.
-   `GET /projects/:projectId/activities` - Flat list for project (optional filter by status/type).
-   `POST /projects/:projectId/wbs/:wbsNodeId/activities` - Create.
-   `PATCH /projects/:projectId/activities/:activityId` - Update.
-   `DELETE /projects/:projectId/activities/:activityId` - Delete.

## Security
-   **Guards**: `JwtAuthGuard`, `ProjectContextGuard`, `ProjectAssignmentGuard` (Read/Write Scope).
-   **Resolution**: User must have access to the `wbsNodeId` (Parent) to access the Activity.
