# Snag API Reference

[Back to Index](../README.md)

| Area | Endpoints |
| --- | --- |
| Process steps | `GET /snag/:projectId/config/process-steps`, `POST /snag/:projectId/config/process-steps`, `DELETE /snag/:projectId/config/process-steps/:stepId` |
| Activity map | `GET /snag/:projectId/config/activity-map`, `POST /snag/:projectId/config/activity-map`, `POST /snag/:projectId/config/activity-map/reorder` |
| Common points | `POST /snag/:projectId/config/activity-map/:mappingId/common-points`, `DELETE /snag/:projectId/config/common-points/:pointId` |
| Units and analytics | `GET /snag/:projectId/units`, `GET /snag/:projectId/analytics`, `GET /snag/:projectId/vendors` |
| Lists | `POST /snag/:projectId/lists`, `GET /snag/:projectId/lists/:listId`, `POST /snag/:projectId/lists/:listId/mark-current-round-ready` |
| Items | `POST /snag/:projectId/lists/:listId/rounds/:roundNumber/items`, `POST /snag/:projectId/items/:itemId/rectify`, `POST /snag/:projectId/items/:itemId/close`, `POST /snag/:projectId/items/:itemId/reject-rectification` |
| PDF | `GET /snag/:projectId/lists/:listId/rounds/:roundNumber/status-report.pdf` |

Source: `backend/src/snag/snag.controller.ts`.

