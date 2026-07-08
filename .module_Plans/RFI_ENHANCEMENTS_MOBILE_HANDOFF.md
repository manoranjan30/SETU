# RFI Enhancements Mobile Handoff

## Scope

Implement the web-aligned RFI experience in Flutter. Vendor role/template
administration is web-only and is not part of the mobile scope.

## GO Workflow

- Remove One GO, Multiple GO, and initial GO-count controls.
- A new floor activity starts with `GO 1`, `partNo: 1`, and `totalParts: 1`.
- Reserve one later GO at a time:

```http
POST /api/quality/inspections/add-go
Content-Type: application/json

{
  "projectId": 2,
  "epsNodeId": 410,
  "activityId": 3,
  "qualityUnitId": null,
  "qualityRoomId": null
}
```

Response:

```json
{
  "previousTotalParts": 1,
  "newTotalParts": 2,
  "nextGoNo": 2,
  "nextGoLabel": "GO 2"
}
```

After reserving the GO, raise that GO through the existing inspection-create API.
Refresh activity/GO progress after both operations.

`POST /api/quality/inspections/expand-go` remains temporarily available for
backward compatibility but must not be used by new mobile UI.

## Related Checklist Tree

```http
GET /api/quality/inspections/related-options?projectId=2&epsNodeId=410
```

Response groups checklist and activity parents with selectable RFI children:

```json
[
  {
    "checklistId": 12,
    "checklistName": "Mivan Checklist",
    "checklistNo": "QA-CL-012",
    "activityId": 3,
    "activityName": "Concrete",
    "listName": "Mivan",
    "children": [
      {
        "inspectionId": 161,
        "rfiNumber": "RFI #161",
        "goNo": 2,
        "goLabel": "GO 2",
        "goDetails": "Column C1 to C15",
        "elementName": "Column",
        "drawingNo": "STR-104",
        "status": "APPROVED",
        "requestDate": "2026-06-25"
      }
    ]
  }
]
```

Requirements:

- Search checklist, activity, RFI, GO, GO details, element, drawing, and status.
- Select individual RFI children, not parent groups.
- Submit IDs in `relatedChecklistInspectionIds`.
- Show selected children as removable summary rows.
- Backend rejects links outside the exact project and EPS location.
- Inspection detail responses include `relatedChecklistInspections`.

## Attachment Model

```text
id: string UUID
projectId: number
inspectionId: number?
attachmentType: DRAWING_MARKUP | SUPPORTING_DOCUMENT
originalName: string
mimeType: string
size: number
originalUrl: string
annotatedUrl: string?
annotationData: JSON?
uploadedAt: ISO timestamp
isLocked: boolean
```

Rules:

- Maximum 5 files per RFI.
- Maximum 10 MB per file.
- Original file types: JPG, JPEG, PNG, WebP, PDF.
- Annotation output must be JPG, PNG, or WebP.
- PDF may be attached without markup or opened in the markup editor.
- For PDF markup, the selected page is flattened as an annotated PNG while
  the original PDF remains preserved.
- Approved RFI attachments are locked.

## Draft Upload Before RFI Creation

```http
POST /api/quality/inspections/attachment-drafts
Content-Type: multipart/form-data
```

Fields:

```text
projectId: required number
clientUploadId: required persistent UUID for offline/idempotent retry
attachmentType: DRAWING_MARKUP | SUPPORTING_DOCUMENT
originalFile: required file
annotatedFile: optional flattened image
annotationData: optional JSON string
```

Delete an unused draft:

```http
DELETE /api/quality/inspections/attachment-drafts/{attachmentId}
```

Bind uploaded drafts during existing inspection creation:

```json
{
  "relatedChecklistInspectionIds": [161, 166],
  "attachmentDraftIds": [
    "532c1d8c-5ab1-42b2-b355-3cfa0e36c139"
  ]
}
```

Do not reuse one draft ID across multiple RFIs. For batch unit creation,
attachments must be uploaded and submitted independently for each RFI.

## Existing RFI Attachment APIs

```http
GET    /api/quality/inspections/{inspectionId}/attachments
POST   /api/quality/inspections/{inspectionId}/attachments
DELETE /api/quality/inspections/{inspectionId}/attachments/{attachmentId}
```

The POST multipart fields are the same as draft upload except `projectId` is
derived from the inspection.

## Mobile Annotation

Extend the existing image/PDF annotation screen with:

- Pen, arrow, rectangle, circle, and text.
- Color and stroke-width controls.
- Undo, redo, and clear.
- Zoom, pan, and reset.
- Preserve the original file.
- Export flattened PNG.
- Export normalized JSON using original-image coordinates.
- For PDFs, select the page to annotate and store `pdfPageNumber` and
  `pdfPageCount` in the annotation JSON.

Suggested JSON:

```json
{
  "version": 1,
  "imageWidth": 3024,
  "imageHeight": 4032,
  "shapes": [
    {
      "id": "uuid",
      "type": "rectangle",
      "color": "#dc2626",
      "strokeWidth": 4,
      "x": 420,
      "y": 610,
      "width": 800,
      "height": 360
    }
  ]
}
```

## Offline Synchronization

1. Persist each upload as its own sync operation.
2. Generate and persist `clientUploadId` before the first upload attempt.
3. Retry uploads independently using the same UUID.
4. Upload all required files before submitting the RFI.
5. Add returned attachment IDs to `attachmentDraftIds`.
6. Do not submit the RFI while required uploads are pending or failed.
7. Remove local temporary files only after the RFI create response confirms
   successful binding.
8. A repeated upload with the same UUID is idempotent.

## Checker And Approver UI

- Render linked checklist cards with activity, RFI number, GO, element,
  drawing, date, and status.
- Before final approval, allow checker/approver users to add or remove linked
  previous checklist RFIs from the approval/detail screen using the same
  related checklist tree used while raising an RFI.
- Open linked RFI detail without discarding the active approval form.
- Show checklist responses, signatures, observations, and attachments.
- Preview `annotatedUrl` when present; otherwise use `originalUrl`.
- Open/download PDFs.
- Hide mutation controls when `isLocked` is true.
- Keep dialogs and drawers inside the active fullscreen host.

### Related Checklist Linking During Approval

When an RFI is already raised but not finally approved, mobile should show
`Link Previous Checklist RFIs` on the approval/detail screen.

Load options with the current RFI excluded:

```http
GET /api/quality/inspections/related-options?projectId=2&epsNodeId=410&excludeInspectionId=180
```

Save selected links:

```http
PATCH /api/quality/inspections/180/related-checklists
Content-Type: application/json

{
  "relatedChecklistInspectionIds": [161, 166]
}
```

Response is the updated inspection summary including:

```json
{
  "relatedChecklistInspectionIds": [161, 166],
  "relatedChecklistInspections": []
}
```

Rules:

- Show this editor only while `inspection.status != APPROVED` and
  `inspection.isLocked != true`.
- Hide/disable the editor after final approval. Existing linked RFIs remain
  visible as read-only cards.
- Backend rejects links after final approval or lock.
- Backend rejects self-linking and cross-project/cross-location links.
- After saving, refresh the active inspection detail and approval list cache.

## Acceptance Checklist

- GO 1 is the only initial GO.
- Add GO reserves one unique next number under concurrent requests.
- Related tree selections match web selections.
- Related checklist links can be edited from the approval screen before final
  approval.
- Related checklist links become read-only after final approval.
- Cross-project/location links show the backend validation error.
- Online and offline attachment submissions bind correctly.
- Duplicate retries do not create duplicate files.
- Annotation survives upload and detail reload.
- Approvers can inspect linked RFIs without losing current work.
- Approved evidence is read-only.
- Existing RFI workflows continue to use the backend workflow response as the
  source of truth.

## Manual RFI Request And Approval Dates

Backend now supports optional manual RFI request and stage approval dates.
This is disabled by default.

Global admin setting:

```text
QUALITY_RFI_BACKDATING_ENABLED
```

Project setting:

```http
GET /api/quality/inspections/project-date-settings?projectId=2
```

Response:

```json
{
  "globalEnabled": true,
  "projectEnabled": true,
  "enabled": true,
  "projectSettingKey": "QUALITY_RFI_BACKDATING_PROJECT_2"
}
```

Project update:

```http
PATCH /api/quality/inspections/project-date-settings?projectId=2
Content-Type: application/json

{
  "enabled": true
}
```

Use `enabled == true` to show date pickers. If false, hide date fields and let
the backend use today/current timestamp.

When `enabled` is true, add optional `requestDate` to the existing RFI create
payload:

```json
{
  "projectId": 2,
  "epsNodeId": 410,
  "activityId": 3,
  "requestDate": "2026-07-08"
}
```

When `enabled` is true, show an approval date picker in the signature approval
screen and submit the selected date with stage approval:

```http
POST /api/quality/inspections/{inspectionId}/stages/{stageId}/approve
Content-Type: application/json

{
  "signatureData": "data:image/png;base64,...",
  "approvalDate": "2026-07-08",
  "signatureEvidence": {
    "approvalDate": "2026-07-08",
    "mode": "SAVED_PROFILE"
  },
  "comments": "Stage approved from mobile app"
}
```

Rules:

- Date format must be `yyyy-MM-dd`.
- Future dates are rejected.
- If the feature is not enabled globally and for the project, the backend
  rejects manually supplied dates.
- If dates are omitted, backend behaves as before.
- The selected approval date is saved as the approval signature timestamp used
  by workflow history and PDF/report date display.
- Backend also stores the real server signing timestamp in hidden signature
  metadata as `actualSignedAt`, with `effectiveApprovalAt` and
  `isBackdatedSignature` for audit. Mobile should not display `actualSignedAt`
  in normal approval screens.
