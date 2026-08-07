# Snag Entities

[Back to Index](../README.md)

```mermaid
erDiagram
    PROJECT ||--o{ SNAG_PROCESS_STEP : configures
    SNAG_PROCESS_STEP ||--o{ SNAG_PROCESS_ACTIVITY_MAP : maps
    SNAG_PROCESS_ACTIVITY_MAP ||--o{ SNAG_COMMON_POINT : contains
    SNAG_LIST ||--o{ SNAG_ROUND : contains
    SNAG_ROUND ||--o{ SNAG_ITEM : raises
    SNAG_ROUND ||--o{ SNAG_ROUND_LEVEL_CLOSURE : signs
```

Code path: `backend/src/snag/entities`.

Important entity rules:

- Snag list belongs to a unit and stage.
- Snag round tracks stage cycle and active verifier level.
- Snag item belongs to the verifier level that raised it.
- Closure record preserves level sign-off identity.
- Not-satisfactory history is retained for analysis.

