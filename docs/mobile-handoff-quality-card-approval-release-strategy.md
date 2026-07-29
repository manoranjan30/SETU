# Mobile Handoff: Quality Card Approval via Release Strategy

## Summary

Pour card and pre-pour clearance approval are now separated from QC inspection/RFI approval.

The mobile app must treat these as independent approval actions:

- QC inspection/RFI workflow approval: `QUALITY / QA_QC_APPROVAL`
- Concrete pour card approval: `QUALITY / CARD_APPROVAL / CONCRETE_POUR_CARD`
- Pre-pour clearance approval: `QUALITY / CARD_APPROVAL / PRE_POUR_CLEARANCE`

Do not infer pour card or pre-pour clearance approval access from RFI approval access.

## Backend Permission Changes

`QUALITY.INSPECTION.APPROVE` no longer implies:

- `QUALITY.POUR_CARD.APPROVE`
- `QUALITY.POUR_CLEARANCE.APPROVE`

The mobile app should check explicit permissions:

- Read pour card: `QUALITY.POUR_CARD.READ`
- Update pour card: `QUALITY.POUR_CARD.UPDATE`
- Submit pour card: `QUALITY.POUR_CARD.SUBMIT`
- Approve/reject pour card: `QUALITY.POUR_CARD.APPROVE`
- Read pre-pour clearance: `QUALITY.POUR_CLEARANCE.READ`
- Update pre-pour clearance: `QUALITY.POUR_CLEARANCE.UPDATE`
- Submit pre-pour clearance: `QUALITY.POUR_CLEARANCE.SUBMIT`
- Approve/reject pre-pour clearance: `QUALITY.POUR_CLEARANCE.APPROVE`
- Sign pre-pour clearance signoffs: `QUALITY.POUR_CLEARANCE.SIGN`

Even if the user has the explicit approve permission, backend will also require the user to be an approver in the active release strategy for that card type. Admin bypass still applies.

## Release Strategy Configuration Required

Before non-admin users can approve/reject these cards, configure active strategies:

### Concrete Pour Card

- `moduleCode`: `QUALITY`
- `processCode`: `CARD_APPROVAL`
- `documentType`: `CONCRETE_POUR_CARD`
- recommended steps: single level, QA/QC role or named QA/QC users

### Pre-Pour Clearance

- `moduleCode`: `QUALITY`
- `processCode`: `CARD_APPROVAL`
- `documentType`: `PRE_POUR_CLEARANCE`
- recommended steps: single level or configured role/users as required by project

## API Endpoints

### Concrete Pour Card

- `GET /api/quality/inspections/:inspectionId/pour-card`
- `PUT /api/quality/inspections/:inspectionId/pour-card`
- `POST /api/quality/inspections/:inspectionId/pour-card/submit`
- `POST /api/quality/inspections/:inspectionId/pour-card/approve`
- `POST /api/quality/inspections/:inspectionId/pour-card/reject`
- `GET /api/quality/inspections/:inspectionId/pour-card/pdf`

Approve/reject body:

```json
{
  "remarks": "Optional comment"
}
```

### Pre-Pour Clearance

- `GET /api/quality/inspections/:inspectionId/pre-pour-clearance`
- `PUT /api/quality/inspections/:inspectionId/pre-pour-clearance`
- `POST /api/quality/inspections/:inspectionId/pre-pour-clearance/submit`
- `POST /api/quality/inspections/:inspectionId/pre-pour-clearance/approve`
- `POST /api/quality/inspections/:inspectionId/pre-pour-clearance/reject`
- `POST /api/quality/inspections/:inspectionId/pre-pour-clearance/signoffs/:signoffId/qr`
- `POST /api/quality/inspections/:inspectionId/pre-pour-clearance/attachments`
- `DELETE /api/quality/inspections/:inspectionId/pre-pour-clearance/attachments/:attachmentId`
- `GET /api/quality/inspections/:inspectionId/pre-pour-clearance/pdf`

Approve/reject body:

```json
{
  "remarks": "Optional comment"
}
```

## Status Lifecycle

Both card types use:

- `DRAFT`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `LOCKED`

Expected mobile actions:

- `DRAFT` or `REJECTED`: allow edit if user has update permission.
- `DRAFT` or `REJECTED`: allow submit if user has submit permission and required fields are valid.
- `SUBMITTED`: allow approve/reject only if user has explicit approve permission. Backend will enforce release-strategy eligibility.
- `APPROVED` or `LOCKED`: read-only.

## Approved By Field

`approvedByName` is system-controlled.

Mobile must not allow users to edit `approvedByName`.

Backend now sets approval identity from authenticated `userId`:

- `approvedByUserId`
- `approvedByName`
- `approvedAt`

PDF generation also resolves the approver name from `approvedByUserId` for existing approved cards.

The concrete pour card PDF now also shows an approval/signature block at the bottom. It uses the approving user's saved profile signature when available:

- `users.signatureData`
- fallback: `users.signatureImageUrl`

If no saved signature exists, the PDF still shows approver name, approval date, and card status. Mobile should encourage approvers to save a profile signature before approval so the generated PDF contains the visual signature.

## Concrete Pour Card Detail Capture

The mobile pour card screen must capture every field needed by the standard `F/QA/16 Concrete Pourcard` format.

Card-level fields:

- `projectNameSnapshot`
- `clientName`
- `consultantName`
- `contractorName`
- `elementName`
- `locationText`
- `formatNo`
- `revisionNo`
- `remarks`

Entry-level fields inside `entries[]`:

- `slNo`
- `pourDate`
- `supplierName`
- `truckNo`
- `deliveryChallanNo`
- `mixIdOrGrade`
- `quantityM3`
- `cumulativeQtyM3`
- `batchStartTime`
- `arrivalTimeAtSite`
- `finishingTime`
- `timeTakenMinutes`
- `slumpMm`
- `concreteTemperature`
- `noOfCubesTaken`
- `contractorRepresentative`
- `clientRepresentative`
- `remarks`

Compatibility note: older web/mobile builds may have used `supplierRepresentative` as the visible supplier value. The backend PDF now prefers `supplierName` for the standard `Name of the Supplier` column and falls back to `supplierRepresentative` only for older saved cards.

Recommended mobile UX:

- Show `supplierName` as `Supplier Name`.
- Keep `supplierRepresentative` only if the mobile team wants to capture the supplier person's name separately; it is not a primary column in the standard PDF.
- Keep `approvedByName` read-only.
- On approve, show a reminder if the user has no saved profile signature, because the PDF signature image comes from the approver profile.

## Error Handling

The backend may return these important errors:

- `403 Forbidden`: user has permission token mismatch or is not configured as a release strategy approver.
- `400 Bad Request`: no active release strategy is configured for the card type, or the active strategy has no eligible approvers.
- `400 Bad Request`: card is not in `SUBMITTED` state.

Recommended mobile copy:

- For 403: `You are not assigned as an approver for this card.`
- For missing strategy: `Approval strategy is not configured for this card type. Contact admin.`
- For wrong state: `This card must be submitted before approval.`

## Regression Checks For Mobile

1. Vendor with submit-only permissions can create/update/submit a pour card but cannot approve/reject it.
2. Vendor with `QUALITY.INSPECTION.APPROVE` but without explicit `QUALITY.POUR_CARD.APPROVE` cannot approve/reject pour card.
3. QA/QC user with `QUALITY.POUR_CARD.APPROVE` but not included in `CONCRETE_POUR_CARD` release strategy receives 403.
4. QA/QC user with explicit permission and release strategy assignment can approve.
5. PDF shows real approver, not vendor-entered text.
6. `approvedByName` is displayed read-only.
