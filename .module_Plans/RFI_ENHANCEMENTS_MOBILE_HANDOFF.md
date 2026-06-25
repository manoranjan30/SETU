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
- Open linked RFI detail without discarding the active approval form.
- Show checklist responses, signatures, observations, and attachments.
- Preview `annotatedUrl` when present; otherwise use `originalUrl`.
- Open/download PDFs.
- Hide mutation controls when `isLocked` is true.
- Keep dialogs and drawers inside the active fullscreen host.

## Acceptance Checklist

- GO 1 is the only initial GO.
- Add GO reserves one unique next number under concurrent requests.
- Related tree selections match web selections.
- Cross-project/location links show the backend validation error.
- Online and offline attachment submissions bind correctly.
- Duplicate retries do not create duplicate files.
- Annotation survives upload and detail reload.
- Approvers can inspect linked RFIs without losing current work.
- Approved evidence is read-only.
- Existing RFI workflows continue to use the backend workflow response as the
  source of truth.
