# Admin Permission Entities

[Back to Index](../README.md)

```mermaid
erDiagram
    USER ||--o{ USER_PROJECT_ASSIGNMENT : has
    ROLE ||--o{ USER_PROJECT_ASSIGNMENT : grants
    PERMISSION ||--o{ ROLE_PERMISSION : assigned
    AUDIT_LOG ||--o{ ADMIN_DATA_CORRECTION : records
```

Code paths: `backend/src/users`, `backend/src/roles`, `backend/src/permissions`, `backend/src/projects`, `backend/src/audit`, `backend/src/admin-data`.

