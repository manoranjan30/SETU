# Progress Update Workflow

[Back to Index](../README.md) | Related: [Site Execution](../02-modules/site-execution.md), [Progress](../02-modules/progress.md)

```mermaid
flowchart LR
    Activity[Activity] --> Measurement[Measurement/progress entry]
    Measurement --> Log[Execution log]
    Log --> Approval[Approval pending]
    Approval --> Approved[Approved]
    Approval --> Rejected[Rejected]
    Approved --> Dashboard[Progress dashboard]
    Rejected --> Measurement
```

## Source Code

- Backend: `backend/src/execution`, `backend/src/progress`
- Frontend: `frontend/src/pages/execution`, `frontend/src/views/progress`

