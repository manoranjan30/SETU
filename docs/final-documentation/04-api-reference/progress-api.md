# Progress API Reference

[Back to Index](../README.md)

| Area | Endpoints |
| --- | --- |
| Progress dashboard | `GET /progress/stats/:projectId`, `GET /progress/plan-vs-achieved/:projectId`, `GET /progress/insights/:projectId` |
| Execution updates | `POST /execution/:projectId/measurements`, `GET /execution/:projectId/logs`, `PATCH /execution/logs/:logId` |
| Execution approvals | `GET /execution/:projectId/approvals/pending`, `POST /execution/approve`, `POST /execution/reject` |

