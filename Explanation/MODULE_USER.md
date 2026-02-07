# User & Role Management Module

## Overview
Manages the internal users (`User`), their roles (`Role`), and the definition of what those roles can do (`Permission`).

## Data Model

### `User`
*   `username`, `passwordHash`, `isActive`.
*   `roles`: Many-to-Many with `Role`.

### `Role`
*   `name`, `description`.
*   `permissions`: Many-to-Many with `Permission`.

### `Permission`
*   `permissionCode`: Unique string identifier (e.g., `VIEW_PROJECTS`).
*   `module`: Grouping identifier (e.g., `EPS`, `ADMIN`).
*   `isSystem`: Boolean (System permissions cannot be deleted via UI).

## Seeding Strategy (`SeedService`)
The `SeedService` is critical for initializing the system.
*   **On Startup**:
    1.  Syncs all hardcoded `Permission` codes to the DB.
    2.  Ensures 'Admin' role exists and has ALL permissions.
    3.  Ensures 'Project Manager' / 'User' roles exist and have BASE permissions.
    4.  Ensures default users (`admin`, `pm`) exist with correct roles.

## Future Guidelines
*   **Role Logic**: Avoid hardcoding Role IDs. Always look up Roles by Name.
*   **Composite Roles**: Future support for Roles inheriting from other Roles.
*   **User Groups**: Group users for bulk assignment to Projects.
