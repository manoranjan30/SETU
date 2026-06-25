# Quality Observation, NCR, and Signature Mobile Handoff

## Scope

Update only these mobile experiences:

1. Quality Site Observation creation and display.
2. Quality checklist/RFI observation creation and display.
3. Quality NC Register.
4. Profile signature upload and cleanup.

## Observation Rating Categories

Use these fixed values and descriptions:

```text
OFI
Opportunity for Improvement
The observation would not affect finished product quality but provides scope
for improvement.

MINOR
Minor (Mi)
The observation would not affect finished product quality or achievement of
the quality system. Requirements would still be achieved.

MODERATE
Moderate (Mo)
The observation may affect finished product quality, cause delays, or fail a
quality process, while important requirements would still be met.

MAJOR
Major (Ma)
The observation would fail one or more quality-system processes and may affect
finished product quality. Secondary requirements may not be achieved.

CRITICAL
Critical (C)
The observation would fail the quality system and affect finished product
quality or minimum acceptable requirements. It is automatically registered as
an NCR.
```

Show the description below each selection and through an information tooltip.

## Site Observation API

Existing endpoint:

```http
POST /api/quality/site-observations
```

Add this field:

```json
{
  "observationRating": "MODERATE"
}
```

Keep the existing technical `category` field such as Structural, MEP, or
Workmanship. `observationRating` is the quality-impact classification.

The backend maps ratings to legacy severity:

```text
OFI      -> INFO
MINOR    -> MINOR
MODERATE -> MAJOR
MAJOR    -> MAJOR
CRITICAL -> CRITICAL
```

Site observation responses now include:

```text
observationRating
ncrId
```

## Checklist Observation API

Existing endpoint:

```http
POST /api/quality/activities/{activityId}/observation
```

Payload:

```json
{
  "inspectionId": 161,
  "stageId": 44,
  "observationText": "Honeycombing identified at column face.",
  "observationRating": "CRITICAL",
  "photos": ["/uploads/evidence.jpg"]
}
```

Checklist observation responses now include:

```text
observationRating
ncrId
```

## Observation Actor Audit Trail

Both Quality Site Observation and checklist observation responses include
resolved user details for the observation raiser, rectifier, and closer.

Actor object:

```json
{
  "id": 42,
  "username": "site.engineer",
  "displayName": "Site Engineer",
  "designation": "Senior Engineer"
}
```

Site Observation fields:

```text
raisedById
raisedBy
createdAt

rectifiedById
rectifiedBy
rectifiedAt

closedById
closedBy
closedAt
```

Checklist Observation fields:

```text
inspectorId
raisedBy
createdAt

resolvedBy
rectifiedBy
resolvedAt

closedBy
closedByUser
closedAt
```

`closedBy` on checklist observations is the stored user ID. `closedByUser` is
the resolved actor object. Keep the existing ID fields for offline and
backward-compatible models.

Mobile display requirements:

- Show the actor display name, designation when available, and local date/time.
- Display all three audit entries in observation details and approval views.
- Use the username when display name is empty.
- Fall back to `User #{id}` when an old record cannot resolve a user profile.
- Show `Pending` when rectification or closure has not happened.
- Do not derive closer identity from the rectifier. They are separate actions.

## Rectification Rejection

All Quality checklist observations, Quality Site Observations, and EHS Site
Observations support rejection of a submitted rectification.

Endpoints:

```http
PATCH /api/quality/activities/{activityId}/observation/{observationId}/reject-rectification
PATCH /api/quality/site-observations/{observationId}/reject-rectification
PATCH /api/ehs/site-observations/{observationId}/reject-rectification
```

Payload:

```json
{
  "rejectionRemarks": "Honeycombing repair remains incomplete at the lower edge."
}
```

Rejection remarks are mandatory. Rejection changes the observation back to
`PENDING` for checklist observations and `OPEN` for Quality/EHS Site
Observations.

The backend preserves every attempt in `rectificationHistory`:

```text
type: RECTIFIED | REJECTED
text
photos
rejectionRemarks
actorId
at
```

Mobile must render the complete history in chronological order, including old
and newly submitted rectification text, evidence, rejection reasons, actor,
and local date/time. Do not replace or hide earlier attempts.

Permissions:

```text
QUALITY.OBSERVATION.REJECT_RECTIFICATION
QUALITY.SITE_OBS.REJECT_RECTIFICATION
EHS.SITE_OBS.REJECT_RECTIFICATION
```

Existing roles with the corresponding CLOSE permission remain compatible
because CLOSE implies the new rejection permission.

## Critical Observation Behavior

When either Quality observation type is `CRITICAL`, the backend automatically
creates one linked NCR. Mobile must not make a second NCR-create request.

The NCR status is synchronized by the backend:

```text
Observation created   -> NCR Open
Rectification saved   -> NCR In Progress
Rectification rejected -> NCR Open
Observation closed    -> NCR Closed
Observation deleted   -> linked NCR deleted
```

## NC Register

Use the existing endpoint:

```http
GET /api/quality/{projectId}/observation-ncr
```

Filter records where:

```text
type == NCR
```

New linked-source fields:

```text
sourceType:
  QUALITY_SITE_OBSERVATION
  QUALITY_CHECKLIST_OBSERVATION

sourceId
sourceReference
```

Show `sourceReference` prominently. Examples:

```text
Quality Site Observation {uuid}
RFI #161 / GO 2
```

Use existing permissions:

```text
QUALITY.NCR.READ
QUALITY.NCR.CREATE
QUALITY.NCR.UPDATE
QUALITY.NCR.DELETE
```

## Profile Signature Upload

Keep the existing signature API:

```http
GET /api/users/me/signature
PUT /api/users/me/signature
```

Confirmed cleaned signature payload:

```json
{
  "signatureData": "data:image/png;base64,..."
}
```

### Processing Requirements

Processing must happen locally before upload:

1. Accept JPG, PNG, and WebP.
2. Maximum source image size: 5 MB.
3. Downscale very large photographs.
4. Convert pixels to luminance.
5. Remove near-white paper pixels by setting alpha to zero.
6. Normalize remaining ink to a dark color.
7. Detect non-transparent bounds and crop with padding.
8. Export transparent PNG.
9. Show a confirmation preview.
10. Upload only after the user presses Confirm and Save.

Do not upload or retain the original paper photograph.

The backend rejects unsupported data formats and signature payloads larger
than approximately 3 MB.

## Mobile UI

- Site Observation: keep technical category and add a separate five-option
  observation rating selector.
- Checklist Observation: replace Minor/Major/Critical selector with all five
  ratings.
- Critical option must display an NCR warning.
- Observation lists must display the rating label, not only legacy severity.
- Add NC Register under the Quality module.
- Profile menu must support both drawn and uploaded-paper signatures.
- Uploaded signature preview must offer Discard and Confirm and Save.

## Acceptance

- All five rating descriptions match web.
- Critical site observations create exactly one NCR.
- Critical checklist observations create exactly one NCR.
- NCR status follows rectification and closure.
- NC Register shows source references.
- Existing non-critical observations remain backward compatible.
- Paper background is transparent after processing.
- Signature ink is clear and dark.
- Raw paper photograph is never uploaded.
- Confirmed uploaded signature works anywhere the saved drawn signature works.
