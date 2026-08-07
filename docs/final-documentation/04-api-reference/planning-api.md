# Planning API Reference

[Back to Index](../README.md)

| Area | Endpoints |
| --- | --- |
| EPS | `GET /eps`, `POST /eps`, `GET /eps/:id/tree`, `PATCH /eps/:id/profile` |
| WBS | `GET /projects/:projectId/wbs`, `POST /projects/:projectId/wbs`, `POST /projects/:projectId/wbs/:nodeId/activities` |
| Schedule | `GET /projects/:projectId/schedule`, `POST /projects/:projectId/schedule/calculate`, `POST /projects/:projectId/schedule/import` |
| BOQ | `GET /boq/project/:projectId`, `POST /boq/import/:projectId`, `GET /boq/export/:projectId` |
| Planning | Feature controllers under `backend/src/planning` for budget, cost, issue tracker, project health, release strategy, custom tracker, and planning extension. |

