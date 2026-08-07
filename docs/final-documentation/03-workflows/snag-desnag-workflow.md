# Snag De-snag Workflow

[Back to Index](../README.md) | Related: [Quality Snag De-snag](../02-modules/quality-snag-desnag.md)

```mermaid
flowchart TD
    Stage[Configured Snag Stage] --> Ready[Maker marks ready for active level]
    Ready --> Raise[Active checker raises snag points]
    Raise --> Rectify[Maker/rectifier marks points rectified]
    Rectify --> Verify[Active checker verifies]
    Verify --> NotSat{Satisfactory?}
    NotSat -- No --> Rework[Not satisfactory saved in history]
    Rework --> Rectify
    NotSat -- Yes --> AllClosed{All level points closed?}
    AllClosed -- No --> Verify
    AllClosed -- Yes --> LevelClose[Checker signs level closure]
    LevelClose --> MoreLevels{More levels in stage?}
    MoreLevels -- Yes --> Ready
    MoreLevels -- No --> StageClose[Final closure of stage]
    StageClose --> NextStage[Maker can mark next stage ready]
```

## Source Code

- Backend: `backend/src/snag`
- Frontend: `frontend/src/views/quality/SnagManagementPage.tsx`
- Configuration: `frontend/src/views/quality/subviews/SnagDesnagConfigPage.tsx`

## Important Rules

- Next snag stage must not start automatically.
- A stage can contain multiple verifier levels.
- Only the active checker level can raise/confirm/close that level.
- Snag points are saved with timestamp, vendor, evidence, rectification, de-snag confirmation, and not-satisfactory history.
- Admin-only reset/delete must log action details.

