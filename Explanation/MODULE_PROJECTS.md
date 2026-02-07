# Projects & Team Isolation Module (Architecture Plan)

## Overview
This module defines the core "Project Isolation" logic. Unlike the classic "Admin sees all" model, this system typically restricts access to specific Projects. 
A User must be explicitly assigned to a Project (with a Role and Scope) to interact with it.

## Architecture

### 1. Project Assignment
*   **Entity**: `UserProjectAssignment`
*   **Fields**:
    *   `userId`: FK to User
    *   `projectId`: FK to EPS Node (Type=PROJECT)
    *   `roleId`: FK to Role (e.g., Project Manager, Site Engineer)
    *   `scopeType`: `FULL` or `LIMITED`
    *   `scopeNodeId`: (Optional) If Limited, restricts access to a specific Tower/Block/Floor.

### 2. Role Templates
Standard roles tailored for project-level access. These should be seeded into the system.

| Role Name | Code | Recommended Scope | Key Permissions |
|-----------|------|-------------------|-----------------|
| **Project Admin** | `PROJECT_ADMIN` | Full Project | `PROJECT.*`, `EPS.*`, `TEAM.MANAGE` |
| **Project Manager** | `PROJECT_MANAGER` | Full Project | `PROJECT.READ`, `PROJECT.UPDATE`, `EPS.VIEW` |
| **Planning Engineer** | `PLANNING_ENGINEER` | Project / Block | `PROJECT.READ`, `SCHEDULE.*`, `WBS.*` |
| **Site Engineer** | `SITE_ENGINEER` | Tower / Floor | `PROJECT.READ`, `Quality.*`, `Safety.*` |
| **Viewer** | `PROJECT_VIEWER` | Full Project | `PROJECT.READ`, `EPS.VIEW` |

## Data Model Snapshot

### 3. Team Audit (`ProjectTeamAudit`)
Every change to project access must be immutable and auditable.
*   **Entity**: `ProjectTeamAudit`
*   **Fields**:
    *   `projectId`: EPS Node ID (Nullable for system events)
    *   `actionType`: String (Nullable)
    *   `performedByUserId`: User ID (Nullable for system events)
    *   `details`: JSONB (Flexible payload for old/new values)

## API Endpoints (`ProjectsController`)
*   `GET /projects/:id/team`: Validates `EPS.VIEW`.
*   `POST /projects/:id/assign`: Validates `TEAM.MANAGE`. Use to add User/Role.
*   `DELETE /projects/:id/users/:userId`: Validates `TEAM.MANAGE`.
*   `GET /projects/:id/check-permission/:nodeId`: Debugging/Frontend check.
