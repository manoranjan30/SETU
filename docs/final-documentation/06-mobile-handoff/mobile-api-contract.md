# Mobile API Contract

[Back to Index](../README.md)

Mobile must treat the backend as the source of truth for status and available actions.

## Required Response Pattern

Backend workflow responses should provide:

- Current status.
- Active stage/level.
- Available actions using `can*` flags.
- Required evidence/signature rules.
- Current user role and assignment context where useful.
- Latest server timestamp.

## Mobile Rule

Mobile should not infer whether a user can approve, raise, rectify, or close from labels alone. It must use backend-provided action flags and handle 403/409 responses cleanly.

