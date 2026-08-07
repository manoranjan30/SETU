# Quality API Reference

[Back to Index](../README.md)

| Area | Endpoints |
| --- | --- |
| Activity lists | `GET /quality/activity-lists`, `POST /quality/activity-lists`, `PATCH /quality/activity-lists/:id` |
| Inspections | `GET /quality/inspections`, `POST /quality/inspections`, `GET /quality/inspections/:id` |
| Workflow | `GET /quality/inspections/:id/workflow`, `POST /quality/inspections/:id/workflow/advance`, `POST /quality/inspections/:id/workflow/reject`, `POST /quality/inspections/:id/workflow/reverse` |
| Reports | `GET /quality/inspections/:id/report` |
| Pour card | `GET /quality/inspections/:inspectionId/pour-card`, `PUT /quality/inspections/:inspectionId/pour-card`, `POST /quality/inspections/:inspectionId/pour-card/submit`, `GET /quality/inspections/:inspectionId/pour-card/pdf` |
| Pre-pour clearance | `GET /quality/inspections/:inspectionId/pre-pour-clearance`, `PUT /quality/inspections/:inspectionId/pre-pour-clearance`, `POST /quality/inspections/:inspectionId/pre-pour-clearance/submit`, `GET /quality/inspections/:inspectionId/pre-pour-clearance/pdf` |
| Structure | `GET /quality/:projectId/structure/floor/:floorId`, `POST /quality/:projectId/structure/floor/:floorId/apply-build` |

