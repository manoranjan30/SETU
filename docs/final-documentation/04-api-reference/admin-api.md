# Admin API Reference

[Back to Index](../README.md)

| Area | Endpoints |
| --- | --- |
| Users | `POST /users`, `GET /users`, `GET /users/list`, `GET /users/me`, `PUT /users/me`, `PUT /users/:id`, `DELETE /users/:id` |
| Signatures | `GET /users/me/signature`, `PUT /users/me/signature` |
| Roles | `GET /roles`, `POST /roles`, `PUT /roles/:id`, `DELETE /roles/:id` |
| Role templates/presets | `GET /role-templates`, `POST /role-templates`, `GET /role-presets`, `POST /role-presets` |
| Permissions | `GET /permissions` |
| Project team | `POST /projects/:projectId/assign`, `GET /projects/:projectId/team` |
| Data maintenance | `GET /admin/data-maintenance/tables`, `GET /admin/data-maintenance/corrections`, `POST /admin/data-maintenance/corrections/:id/revert` |

Source: `backend/src/users`, `backend/src/roles`, `backend/src/permissions`, `backend/src/projects`, `backend/src/admin-data`.

