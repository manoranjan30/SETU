# Mobile Pour Card Handoff

[Back to Index](../README.md)

Mobile pour screens must use backend activation fields for visibility.

## Required Mobile Behavior

- Show pre-pour clearance only when backend says visible/active.
- Show pour card only when backend says visible/active.
- Do not hide a card only because final RFI approval is pending; visibility may be configured at a lower stage or approval level.
- Respect clearance dependency rule: submitted is enough or approval required.
- Submit approvals/rejections through backend endpoints.
- Show PDF preview/download links from backend.
- Show clear error details when the backend returns a validation or gate failure.

Related backend doc: [Pour Clearance And Pour Card](../02-modules/quality-pour-clearance-and-pour-card.md).

