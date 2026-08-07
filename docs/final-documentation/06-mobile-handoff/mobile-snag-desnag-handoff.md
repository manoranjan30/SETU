# Mobile Snag De-snag Handoff

[Back to Index](../README.md)

Mobile snag/de-snag must show configured stages at the top. Inside a selected stage, show verifier levels from release strategy and the active unit workflow.

## Required Mobile Behavior

- Show `Ready for L1 Snagging`, `Ready for L2 Snagging`, or `Ready for Snagging` only when the active level is the last/only level.
- Let maker mark ready only when backend returns permission.
- Let active checker raise snag points.
- Capture vendor against the snag point.
- Photos are optional unless backend configuration says mandatory.
- Let maker rectify.
- Let active checker mark de-snag confirmed or not satisfactory.
- Show not-satisfactory history for analysis.
- Do not automatically start the next stage after closure; show maker action for next stage readiness.
- Admin-only reset/delete all stage snag points must be hidden from non-admin users.

Related backend doc: [Snag De-snag](../02-modules/quality-snag-desnag.md).

