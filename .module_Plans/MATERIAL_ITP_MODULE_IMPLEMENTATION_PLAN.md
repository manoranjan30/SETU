# Material ITP Module Implementation Plan

Date: 2026-04-21
Scope: Quality module > Materials / Material Testing
Sample studied: `C:\Users\omano\Downloads\1. ITP cement.pdf`

## Objective

Build a project-level Material Inspection and Testing Plan module where QA/QC users can define an ITP per material, route ITP templates through a release-strategy approval process, copy approved ITPs to other projects, register incoming material lots, auto-generate required inspection/testing obligations from the active ITP, log test results against those obligations, route material test results through a separate release-strategy approval process, and surface missing, due-soon, expired, failed, approval-pending, or hold-point actions in the Quality module and Pending Tasks.

## Current App Baseline

The current Material Test feature is simple CRUD:

- Frontend: `frontend/src/views/quality/subviews/QualityMaterialTest.tsx`
- Backend endpoints: `backend/src/quality/quality.controller.ts`
- Backend service: `backend/src/quality/quality.service.ts`
- Entity: `backend/src/quality/entities/quality-material-test.entity.ts`
- Existing fields: projectId, materialName, batchNumber, supplier, receivedDate, testDate, testType, result, testParameters, status, reportUrl.

Relevant reusable patterns already exist:

- Checklist templates with stages/items, import preview, revisions, and usage lock rules.
- Quality RFI execution creates checklist execution rows from templates.
- Pending Tasks side panel is backed by `backend/src/notifications/pending-tasks.service.ts`.
- Quality permissions already include `QUALITY.TEST.*`; new ITP-specific permissions should be added rather than overloading only test CRUD.
- Project-scoped release strategy already exists in Planning and is used by Quality RFI/checklist approvals through process codes, document types, approver roles, user approvers, and restart policies.

## PDF Study Summary

The sample is a one-page "INSPECTION AND TEST PLAN FOR CEMENT" with code `ITP-MAT-QA-01`, revision `01`.

It contains these core structures:

- Header metadata:
  - ITP title
  - ITP number
  - revision number
  - material: Cement
  - standard references: IS 269:2015, IS 4031 parts, IS 4032

- Columns:
  - Sl. No.
  - Characteristic to be inspected/tested
  - Reference to test specification
  - Unit
  - Verifying document
  - Frequency of testing/inspection
  - Acceptance criteria
  - Inspection categories
  - Responsibility/action columns for Contractor/Supplier and PPL/PMC
  - Remarks

- Legend values:
  - A = Source approval
  - S = Surveillance checks
  - ILR = Internal lab report/record
  - ELR = External lab report
  - MTC = Manufacturer test certificate
  - H = Hold point
  - W = Witness
  - R = Review records
  - C = Conduct
  - T = Test by third party
  - CHK = Inspection checklist

- Cement-specific incoming load checks:
  - Check brand and grade, verifying document: delivery challan, frequency: every load, category/review by Contractor and PPL/PMC.
  - Date of manufacture/week number, verifying document: MTC, frequency: every load.
  - Age of cement, frequency: every load, condition: not more than three months from packing.

- Cement physical requirements:
  - Fineness minimum, unit m2/kg, MTC/ELR, standard IS 269:2015 and IS 4031 Part 2.
  - Soundness by Le-Chatelier maximum, unit mm, standard IS 4031 Part 3.
  - Soundness by autoclave expansion maximum, unit percentage.
  - Initial setting time minimum, unit minutes, standard IS 4031 Part 5.
  - Final setting time maximum, unit minutes.
  - Compressive strength at 72 +/- 1h, 168 +/- 2h, 672 +/- 4h, unit MPa, standard IS 4031 Part 6.

- Cement chemical requirements:
  - Ratio of lime to silica/alumina/iron oxide.
  - Ratio of alumina to iron oxide.
  - Insoluble residue.
  - Magnesia.
  - Sulphur content as SO3.
  - Loss on ignition.
  - Chloride content.

- Acceptance criteria vary by cement grade:
  - OPC 33 Grade
  - OPC 43 Grade
  - OPC 43S Grade
  - OPC 53 Grade
  - OPC 53S Grade

- Frequency pattern:
  - Every load for receipt checks.
  - MTC for each consignment.
  - ELR one test every six months for each brand.
  - Source approval requires ELR.

## Target Product Behavior

1. QA/QC defines an ITP template for each material in a project.
2. Draft ITP templates are submitted through a release strategy process before they become active.
3. ITP templates contain multiple inspection/testing checkpoints with frequency, document, acceptance criteria, standards, and responsibility rules.
4. Only approved/active ITPs can be copied from one project to another or used for incoming material obligation generation.
5. Templates can be revised without breaking past results; each revision must follow ITP approval again.
6. When a material lot is received, the system selects the active ITP by material/brand/grade and creates due obligations.
7. Users log results only against the generated obligations, not as free-form unrelated tests.
8. Submitted material test results follow a separate release strategy process from ITP template approval.
9. The result form shows the expected parameter, unit, acceptance criteria, verifying document, standard, and required evidence.
10. Missing tests, overdue tests, expired material-age checks, failed criteria, approval-pending items, and hold points are visible in:
   - Material Test dashboard
   - ITP detail view
   - Incoming lot detail
   - Pending Tasks side panel
   - Quality Overview summary
11. Existing simple material test rows remain accessible through a compatibility migration path.

## Proposed Domain Model

### 1. `quality_material_itp_templates`

Purpose: One ITP header/revision for one material within a project.

Fields:

- `id`
- `projectId`
- `materialName`
- `materialCode` nullable
- `itpNo`
- `revNo`
- `title`
- `description`
- `standardRefs` jsonb, example `["IS 269:2015", "IS 4031 Part 2"]`
- `status`: DRAFT, SUBMITTED, APPROVAL_IN_PROGRESS, APPROVED, ACTIVE, REJECTED, INACTIVE, SUPERSEDED
- `approvalStatus`: NOT_SUBMITTED, PENDING, APPROVED, REJECTED, REWORK_REQUIRED
- `approvalRunId` nullable
- `approvalStrategyId` nullable
- `approvalStrategyVersion` nullable
- `submittedById` nullable
- `submittedAt` nullable
- `effectiveFrom`
- `effectiveTo` nullable
- `isGlobal` boolean
- `sourceTemplateId` nullable
- `copiedFromProjectId` nullable
- `createdById` nullable
- `approvedById` nullable
- `approvedAt` nullable
- timestamps

Indexes:

- `(projectId, materialName, status)`
- unique partial `(projectId, itpNo, revNo)`
- `(isGlobal)`

Rules:

- Only one ACTIVE ITP per `(projectId, materialName, materialCode)` unless material variants are explicitly split by grade/brand.
- ACTIVE templates cannot have their checkpoint structure mutated if obligations/results exist; create a new revision instead.
- ITP activation is allowed only after the ITP template approval workflow completes.
- Rejected ITPs can be revised into a new DRAFT or returned to DRAFT based on release strategy restart policy.

### 2. `quality_material_itp_checkpoints`

Purpose: ITP line items/checkpoints.

Fields:

- `id`
- `templateId`
- `sequence`
- `section`: SOURCE_APPROVAL, RECEIPT_INSPECTION, PHYSICAL_REQUIREMENT, CHEMICAL_REQUIREMENT, OTHER
- `slNo`
- `characteristic`
- `testSpecification`
- `unit`
- `verifyingDocument`: DELIVERY_CHALLAN, MTC, ILR, ELR, CHK, OTHER
- `frequencyType`: EVERY_LOAD, EACH_CONSIGNMENT, MONTHLY, EVERY_N_MONTHS, SOURCE_APPROVAL, MANUAL, LOT_QUANTITY_BASED
- `frequencyValue` nullable
- `frequencyUnit` nullable
- `acceptanceCriteria` jsonb
- `applicableGrades` jsonb
- `inspectionCategory` jsonb, example `{ "sourceApproval": true, "surveillance": true }`
- `contractorAction` jsonb, example `{ "review": true, "conduct": false, "testThirdParty": true }`
- `pmcAction` jsonb, example `{ "review": true, "hold": true, "witness": false }`
- `isMandatory`
- `requiresDocument`
- `requiresPhotoEvidence`
- `requiresNumericResult`
- `requiresLabReport`
- `requiresThirdParty`
- `requiredEvidenceTypes` jsonb, example `["DELIVERY_CHALLAN", "MTC", "TEST_REPORT", "SITE_PHOTO"]`
- `minPhotoCount` int default 0
- `dueOffsetHours` nullable
- `expiryWindowDays` nullable
- timestamps

Acceptance criteria examples:

```json
{
  "mode": "GRADE_MATRIX",
  "grades": {
    "OPC 33 Grade": { "min": 225 },
    "OPC 43 Grade": { "min": 225 },
    "OPC 43S Grade": { "min": 370 },
    "OPC 53 Grade": { "min": 225 },
    "OPC 53S Grade": { "min": 370 }
  }
}
```

```json
{
  "mode": "TEXT_RULE",
  "text": "Not more than three months from the date of packing"
}
```

### 3. `quality_material_receipts`

Purpose: Incoming material lots/loads/consignments.

Fields:

- `id`
- `projectId`
- `itpTemplateId`
- `materialName`
- `materialCode` nullable
- `brand`
- `grade`
- `supplier`
- `manufacturer`
- `batchNumber`
- `lotNumber` nullable
- `challanNumber`
- `quantity` nullable
- `uom` nullable
- `receivedDate`
- `manufactureDate` nullable
- `packingWeekNo` nullable
- `mtcDocumentUrl` nullable
- `deliveryChallanUrl` nullable
- `status`: RECEIVED, UNDER_TEST, ACCEPTED, REJECTED, QUARANTINED, PARTIALLY_ACCEPTED
- timestamps

Indexes:

- `(projectId, receivedDate)`
- `(projectId, materialName, brand, grade)`
- `(batchNumber)`

Rules:

- If ITP requires source approval and no valid approval exists for brand/source, create source approval obligations.
- If cement age is beyond allowed window, mark receipt with `EXPIRED_MATERIAL` alert before tests pass.

### 4. `quality_material_test_obligations`

Purpose: Generated test/inspection tasks from a receipt and active ITP.

Fields:

- `id`
- `projectId`
- `receiptId` nullable for recurring/source-approval obligations
- `templateId`
- `checkpointId`
- `materialName`
- `brand`
- `grade`
- `dueDate`
- `warningDate`
- `status`: PENDING, DUE_SOON, OVERDUE, COMPLETED, WAIVED, NOT_APPLICABLE, FAILED
- `priority`: LOW, MEDIUM, HIGH, CRITICAL
- `assignedRole` nullable
- `assignedUserId` nullable
- `reason`
- `lastResultId` nullable
- timestamps

Indexes:

- `(projectId, status, dueDate)`
- `(receiptId)`
- `(checkpointId)`

Generation examples:

- Every load checkpoint: create one obligation per receipt.
- ELR every six months for each brand: create recurring obligation per `(projectId, materialName, brand, grade, checkpointId)` if last valid ELR result is older than six months.
- Source approval: create obligation until a valid approval/result exists for the source.

### 5. `quality_material_test_results`

Purpose: Actual execution result against a generated obligation.

Fields:

- `id`
- `projectId`
- `obligationId`
- `receiptId` nullable
- `templateId`
- `checkpointId`
- `testDate`
- `testedById` nullable
- `testedByName`
- `labType`: INTERNAL, EXTERNAL, MANUFACTURER, THIRD_PARTY, SITE
- `documentType`
- `primaryDocumentUrl` nullable
- `numericValue` nullable
- `textValue` nullable
- `observedGrade` nullable
- `result`: PASS, FAIL, NA, PENDING_REVIEW
- `reviewStatus`: DRAFT, SUBMITTED, APPROVAL_IN_PROGRESS, APPROVED, REJECTED, REWORK_REQUIRED
- `approvalRunId` nullable
- `approvalStrategyId` nullable
- `approvalStrategyVersion` nullable
- `submittedById` nullable
- `submittedAt` nullable
- `reviewedById` nullable
- `reviewedAt` nullable
- `remarks`
- `criteriaSnapshot` jsonb
- `itpSnapshot` jsonb
- `evidenceSummary` jsonb nullable
- timestamps

Rules:

- Store criteria snapshot at result time so old results remain auditable after ITP revisions.
- For numeric checkpoints, backend calculates pass/fail from criteria where possible.
- Failures create NCR/material quarantine prompt.
- Evidence requirements are validated from the checkpoint before submission or approval.
- Result attachments must be locked after approval; rework creates a new attachment revision rather than overwriting approved evidence.
- Submitted results cannot be edited while approval is in progress except through a controlled rework/revision action.
- Approved results lock the obligation as completed; rejected/rework results reopen the obligation.

### 6. `quality_material_evidence_files`

Purpose: Photographs and document uploads linked to ITP templates, material receipts, test obligations, test results, and approval steps.

Fields:

- `id`
- `projectId`
- `ownerType`: ITP_TEMPLATE, MATERIAL_RECEIPT, TEST_OBLIGATION, TEST_RESULT, APPROVAL_STEP
- `ownerId`
- `resultId` nullable
- `receiptId` nullable
- `templateId` nullable
- `checkpointId` nullable
- `evidenceType`: DELIVERY_CHALLAN, MTC, ILR, ELR, TEST_REPORT, CALIBRATION_CERTIFICATE, SITE_PHOTO, LAB_PHOTO, SOURCE_APPROVAL, OTHER
- `fileKind`: PHOTO, DOCUMENT
- `fileName`
- `originalName`
- `mimeType`
- `sizeBytes`
- `relativeUrl`
- `thumbnailUrl` nullable
- `description` nullable
- `uploadedById`
- `uploadedAt`
- `isRequired`
- `isLocked`
- `lockedAt` nullable
- `lockReason` nullable
- `revisionNo` default 1
- `metadata` jsonb nullable, example GPS, capture time, report number, lab name
- timestamps

Indexes:

- `(projectId, ownerType, ownerId)`
- `(resultId)`
- `(receiptId)`
- `(templateId, checkpointId)`
- `(evidenceType)`

Rules:

- Store file paths as relative paths, consistent with existing upload utilities.
- Use separate evidence rows for MTC, ELR, challan, test reports, and photos; do not hide multiple files inside one JSON field.
- Enforce file type and size limits on the backend.
- Photos should support thumbnail generation or at least responsive preview URLs.
- Approval comments may request additional evidence; rework uploads should be traceable by revision.

### 7. `quality_material_approval_runs`

Purpose: Generic approval run records for Material ITP templates and Material Test Results using the existing project release strategy engine.

Fields:

- `id`
- `projectId`
- `documentType`: MATERIAL_ITP_TEMPLATE, MATERIAL_TEST_RESULT
- `documentId`
- `releaseStrategyId`
- `releaseStrategyVersion`
- `strategyName`
- `moduleCode`: QUALITY
- `processCode`: MATERIAL_ITP_APPROVAL or MATERIAL_TEST_RESULT_APPROVAL
- `status`: IN_PROGRESS, COMPLETED, REJECTED, REWORK_REQUIRED, REVERSED, CANCELED
- `currentStepOrder`
- `initiatorUserId`
- `contextSnapshot` jsonb
- timestamps

Indexes:

- `(projectId, documentType, documentId)`
- `(projectId, processCode, status)`
- `(releaseStrategyId, releaseStrategyVersion)`

Rules:

- ITP template approvals and test result approvals must use separate process codes and separate release strategy definitions.
- A document can have only one active approval run at a time.
- The run stores the matched release strategy version so future strategy edits do not alter an in-flight approval.

### 8. `quality_material_approval_steps`

Purpose: Approval levels generated from release strategy steps.

Fields:

- `id`
- `runId`
- `stepOrder`
- `stepName`
- `approverMode`: USER, PROJECT_ROLE
- `assignedUserId` nullable
- `assignedUserIds` jsonb nullable
- `assignedRoleId` nullable
- `minApprovalsRequired`
- `currentApprovalCount`
- `approvedUserIds` jsonb nullable
- `status`: WAITING, PENDING, COMPLETED, REJECTED, SKIPPED
- `signatureId` nullable if reusing `QualitySignature`
- `signedBy`, `signerDisplayName`, `signerCompany`, `signerRole`
- `completedAt`
- `comments`
- timestamps

Rules:

- Approval authorization must use project-scoped actors from `ApprovalRuntimeService`.
- Multi-user steps follow `minApprovalsRequired`.
- Digital signature/comment requirements should match the existing Quality RFI approval style where possible.

### 9. Compatibility With `quality_material_tests`

Options:

- Preferred: migrate existing rows into `quality_material_test_results` with synthetic checkpoints named from `testType`.
- Keep `quality_material_tests` as legacy read-only for one release.
- In the frontend, show an "Imported legacy tests" filter until migration is complete.

## Backend Architecture

Create a focused sub-module inside `backend/src/quality`:

- `material-itp.controller.ts`
- `material-itp.service.ts`
- `material-itp-obligation.service.ts`
- `material-itp-compliance.service.ts`
- `material-itp-copy.service.ts`
- `material-itp-approval.service.ts`
- `material-itp-evidence.service.ts`
- DTOs under `backend/src/quality/dto/material-itp`
- Entities under `backend/src/quality/entities`

Endpoints:

- `GET /quality/:projectId/material-itps`
- `POST /quality/:projectId/material-itps`
- `GET /quality/material-itps/:id`
- `PUT /quality/material-itps/:id`
- `POST /quality/material-itps/:id/submit-approval`
- `POST /quality/material-itps/:id/approval/:stepId/approve`
- `POST /quality/material-itps/:id/approval/:stepId/reject`
- `POST /quality/material-itps/:id/approval/reverse`
- `POST /quality/material-itps/:id/activate`
- `POST /quality/material-itps/:id/revise`
- `DELETE /quality/material-itps/:id`
- `POST /quality/material-itps/:id/copy`
- `POST /quality/:projectId/material-itps/copy-from-project`
- `GET /quality/:projectId/material-receipts`
- `POST /quality/:projectId/material-receipts`
- `GET /quality/material-receipts/:id`
- `PUT /quality/material-receipts/:id`
- `POST /quality/material-receipts/:id/generate-obligations`
- `GET /quality/:projectId/material-test-obligations`
- `GET /quality/:projectId/material-test-compliance`
- `POST /quality/material-test-obligations/:id/results`
- `PUT /quality/material-test-results/:id`
- `POST /quality/material-test-results/:id/submit`
- `POST /quality/material-test-results/:id/submit-approval`
- `POST /quality/material-test-results/:id/approval/:stepId/approve`
- `POST /quality/material-test-results/:id/approval/:stepId/reject`
- `POST /quality/material-test-results/:id/approval/reverse`
- `POST /quality/material-test-obligations/:id/waive`
- `GET /quality/material-evidence`
- `POST /quality/material-evidence/upload`
- `DELETE /quality/material-evidence/:id`
- `POST /quality/material-evidence/:id/lock`

Upload endpoint behavior:

- Accept `multipart/form-data`.
- Required fields: `ownerType`, `ownerId`, `projectId`, `evidenceType`, `fileKind`.
- Optional fields: `resultId`, `receiptId`, `templateId`, `checkpointId`, `description`, `metadata`.
- Validate extension/MIME by `fileKind`:
  - Photos: jpg, jpeg, png, webp.
  - Documents: pdf, xlsx, xls, docx, csv, image scans if needed.
- Save to a material-quality path such as `uploads/quality/material-evidence/YYYY/MM`.
- Return the created evidence row with relative URL and preview metadata.

Release strategy process codes:

- `moduleCode`: `QUALITY`
- `processCode`: `MATERIAL_ITP_APPROVAL`
- `documentType`: material category or `MATERIAL_ITP_TEMPLATE`
- `processCode`: `MATERIAL_TEST_RESULT_APPROVAL`
- `documentType`: test category, lab type, or `MATERIAL_TEST_RESULT`

Recommended release strategy matching context:

```json
{
  "projectId": 2,
  "moduleCode": "QUALITY",
  "processCode": "MATERIAL_TEST_RESULT_APPROVAL",
  "documentType": "CEMENT_PHYSICAL_TEST",
  "documentId": 101,
  "initiatorUserId": 9,
  "extraAttributes": {
    "materialName": "Cement",
    "brand": "ACC",
    "grade": "OPC 53 Grade",
    "labType": "EXTERNAL",
    "result": "PASS",
    "hasHoldPoint": true,
    "isThirdParty": true,
    "isFailed": false
  }
}
```

Permissions:

- `QUALITY.MATERIAL_ITP.READ`
- `QUALITY.MATERIAL_ITP.CREATE`
- `QUALITY.MATERIAL_ITP.UPDATE`
- `QUALITY.MATERIAL_ITP.DELETE`
- `QUALITY.MATERIAL_ITP.APPROVE`
- `QUALITY.MATERIAL_ITP.REVERSE_APPROVAL`
- `QUALITY.MATERIAL_RECEIPT.READ`
- `QUALITY.MATERIAL_RECEIPT.CREATE`
- `QUALITY.MATERIAL_RECEIPT.UPDATE`
- `QUALITY.MATERIAL_TEST.LOG`
- `QUALITY.MATERIAL_TEST.REVIEW`
- `QUALITY.MATERIAL_TEST.APPROVE`
- `QUALITY.MATERIAL_TEST.REVERSE_APPROVAL`
- `QUALITY.MATERIAL_EVIDENCE.UPLOAD`
- `QUALITY.MATERIAL_EVIDENCE.DELETE`
- Keep `QUALITY.TEST.*` as backward compatibility aliases during migration.

Approval runtime design:

- Prefer extracting the shared parts of `InspectionWorkflowService` into a reusable approval runtime service instead of copying large approval logic.
- The new material approval service should use `ReleaseStrategyService.resolveStrategy(...)`, `ApprovalRuntimeService.getProjectActorMap(...)`, project-role approver checks, restart policy, and notification composition in the same style as Quality RFI approval.
- Do not reuse `inspection_workflow_runs` directly because it has a unique `inspectionId` relation. Use material-specific approval run/step entities or generalize the schema in a separate migration.

## Frontend Architecture

Replace the current single Material Test screen with a richer tabbed material quality workspace under existing Quality > Materials.

Top-level tabs:

1. Overview
   - KPI cards: active ITPs, pending tests, overdue tests, failed tests, expiring source approvals, receipts under quarantine.
   - Material-wise compliance table.

2. ITP Library
   - Cards/table grouped by material.
   - Create/Edit ITP builder.
   - Submit ITP for approval.
   - Approval status timeline and current approver.
   - Copy from another project.
   - Revision history.
   - View ITP in PDF-like format similar to the sample.
   - Activation allowed only for approved templates.
   - Optional template-level attachments such as approved source document, method statement, or original PDF reference.

3. Incoming Materials
   - Register material load.
   - Attach delivery challan, MTC, supplier documents, and receipt photographs.
   - Select material/brand/grade.
   - Show applicable active ITP.
   - Auto-generate obligations.
   - Immediate warnings for expired material age or missing source approval.

4. Test Schedule
   - Obligation list with filters: Pending, Due Soon, Overdue, Failed, Completed, Waived.
   - Each row shows checkpoint, receipt/batch, frequency, due date, document required, responsible role, hold/witness/review flags.

5. Result Log
   - Result entry is launched from an obligation.
   - Form is parameter-driven by the checkpoint:
     - characteristic
     - standard
     - unit
     - grade-specific acceptance criteria
     - verifying document
     - numeric/text value
     - evidence photographs
     - document/report upload
     - pass/fail auto evaluation
   - Submit result for release-strategy approval.
   - Approval status, approver comments, rejection/rework loop, and final approved lock.
   - Evidence gallery grouped by required type: MTC, ELR, test report, site photos, lab photos, other.

6. Reports
   - ITP compliance export.
   - Receipt-wise test pack.
   - Failed tests/NCR report.

Important UI details:

- Do not let users log arbitrary "Cube Test/Pass" without selecting an ITP checkpoint.
- For a cement receipt, after selecting grade `OPC 53`, the result form should only show the OPC 53 acceptance criteria for that checkpoint.
- ITP display should use a dense table similar to the PDF, with frozen characteristic/spec columns and grade columns.
- The result submit button should stay disabled until mandatory evidence is uploaded.
- Approvers should see thumbnails/photos and documents in the approval drawer without downloading first where browser preview is supported.
- Approved evidence should show a lock indicator; rework evidence should show revision history.
- Use color coding:
  - red: overdue/failed/expired material
  - amber: due soon/review needed
  - green: completed/pass
  - blue: source approval/surveillance info

## Notification and Due Logic

Integrate obligations into `PendingTasksService`:

New item types:

- `MATERIAL_TEST_DUE`
- `MATERIAL_TEST_OVERDUE`
- `MATERIAL_SOURCE_APPROVAL_DUE`
- `MATERIAL_RECEIPT_EXPIRED`
- `MATERIAL_TEST_REVIEW`
- `MATERIAL_ITP_APPROVAL`
- `MATERIAL_TEST_APPROVAL`
- `MATERIAL_ITP_REWORK`
- `MATERIAL_TEST_REWORK`

Pending task behavior:

- QC users see due/overdue test obligations.
- Assigned reviewers see submitted results requiring review.
- Assigned approvers see ITP template approvals and material test result approvals generated from release strategy steps.
- ITP creators see rejected/rework ITP templates.
- Test submitters see rejected/rework test results.
- Vendor/supplier roles can see obligations assigned to them if project role mapping exists.
- Clicking a task opens `/dashboard/projects/:projectId/quality?tab=materials&materialTask=:id`.
- Approval tasks open directly to the approval drawer for that ITP template or test result.

Due status rules:

- `DUE_SOON`: due date within configured warning window, default 7 days.
- `OVERDUE`: due date before today and no completed/waived result.
- `EXPIRED_MATERIAL`: material receipt has an age rule violation, for cement "not more than three months from packing".
- `FAILED`: last result failed acceptance criteria.

## Cement ITP Seed Template

Add an optional seed function or admin import sample, not auto-enabled for every project unless requested.

Template:

- materialName: Cement
- itpNo: ITP-MAT-QA-01
- revNo: 01
- standardRefs:
  - IS 269:2015
  - IS 4031 Part 2
  - IS 4031 Part 3
  - IS 4031 Part 5
  - IS 4031 Part 6
  - IS 4032

Initial checkpoints:

- Brand and grade check, delivery challan plus receipt photo evidence, every load, review records.
- Date of manufacture/week number, MTC upload required, every load.
- Age of cement, every load, max three months from packing.
- Fineness minimum by grade, MTC/ELR report upload required.
- Soundness Le-Chatelier maximum by grade, MTC/ELR report upload required.
- Soundness autoclave expansion maximum, MTC/ELR report upload required.
- Initial setting time minimum by grade, MTC/ELR report upload required.
- Final setting time maximum, MTC/ELR report upload required.
- Compressive strength at 72h, 168h, and 672h by grade, lab report upload required.
- Lime/silica/alumina/iron oxide ratio by grade.
- Alumina/iron oxide ratio.
- Insoluble residue maximum.
- Magnesia maximum.
- Sulphur content as SO3 maximum.
- Loss on ignition maximum.
- Chloride content maximum.

## Implementation Steps

### Step 1: Data Model and Migration

Owner: backend
Depends on: none
Files:

- `backend/src/quality/entities/*`
- `backend/src/migrations/*-CreateMaterialItpTables.ts`
- `backend/src/quality/quality.module.ts`
- `backend/src/app.module.ts`

Tasks:

- Add the ITP, receipt, obligation, result, evidence file, approval run, and approval step entities listed above.
- Create TypeORM migration with tables, foreign keys, indexes, and enum/check constraints where practical.
- Register entities in `QualityModule` and `AppModule`.
- Add seed-safe default statuses.
- Add compatibility nullable links from existing `quality_material_tests` to new result/obligation if we choose progressive migration.

Verification:

- `npm run build` in backend.
- Run migration against local DB.
- Confirm rollback drops only new ITP tables/columns.

Exit criteria:

- Schema supports templates, checkpoints, receipts, obligations, results, evidence files, approval runs/steps, and revision snapshots.

Rollback:

- Revert migration and entity registration.

### Step 2: Backend DTOs and ITP Template CRUD

Owner: backend
Depends on: Step 1
Files:

- `backend/src/quality/dto/material-itp/*.ts`
- `backend/src/quality/material-itp.controller.ts`
- `backend/src/quality/material-itp.service.ts`
- `backend/src/auth/permission-registry.ts`
- `backend/src/auth/permission-presets.ts`

Tasks:

- Implement create/update/list/detail.
- Implement submit approval, activate, deactivate, revise.
- Enforce one active ITP per material/variant.
- Lock used templates; update creates new revision when obligations/results exist.
- Add permissions and preset mappings.
- Resolve and start `MATERIAL_ITP_APPROVAL` release strategy when an ITP is submitted.
- Allow activation only when approval run is completed.

Verification:

- Unit tests for validation and revision lock.
- Unit tests for submit approval without active strategy, with active strategy, rejection, and approval completion.
- API calls with missing/invalid checkpoint criteria return 400.

Exit criteria:

- QA can maintain a versioned ITP library through API and route ITP templates through release-strategy approval before activation.

Rollback:

- Remove controller/provider and permissions; schema remains inert.

### Step 3: Copy Between Projects and Global Templates

Owner: backend
Depends on: Step 2
Files:

- `material-itp-copy.service.ts`
- `material-itp.controller.ts`

Tasks:

- Copy one ITP to another project.
- Bulk copy all active ITPs from a source project.
- Preserve source template metadata but create independent target revisions.
- Collision modes: SKIP, OVERWRITE_DRAFT_ONLY, CREATE_NEW_REVISION.

Verification:

- Copy cement ITP from project A to B.
- Confirm source and target checkpoints have separate IDs.
- Confirm target edits do not mutate source.

Exit criteria:

- Project setup can reuse a standard ITP library.

Rollback:

- Disable copy endpoints without affecting CRUD.

### Step 3A: Release Strategy Process Setup for Material ITP and Material Test Approvals

Owner: backend + frontend configuration
Depends on: Step 2
Files:

- `backend/src/database/seed.service.ts`
- `backend/src/planning/release-strategy.service.ts`
- `frontend/src/pages/planning/ReleaseStrategyPage.tsx`
- `.module_Plans/MATERIAL_ITP_MODULE_IMPLEMENTATION_PLAN.md`

Tasks:

- Define two separate default release strategy templates per project:
  - `QUALITY / MATERIAL_ITP_APPROVAL / MATERIAL_ITP_TEMPLATE`
  - `QUALITY / MATERIAL_TEST_RESULT_APPROVAL / MATERIAL_TEST_RESULT`
- Seed them as DRAFT or provide a "Create recommended strategy" action so projects can choose approvers.
- Recommended ITP approval levels:
  - Level 1: QA/QC Engineer review
  - Level 2: QA/QC Head / Project Quality Manager approval
  - Optional Level 3: Consultant/PMC approval for hold-point or source-approval ITPs
- Recommended material test result approval levels:
  - Level 1: QA/QC Engineer review of result/report
  - Level 2: QA/QC Head approval for failed, external lab, third-party, or hold-point tests
  - Optional Level 3: Consultant/PMC witness/hold approval when checkpoint `pmcAction.hold` or `pmcAction.witness` is true
- Add release strategy condition examples:
  - `extraAttributes.materialName = Cement`
  - `extraAttributes.isFailed = true`
  - `extraAttributes.hasHoldPoint = true`
  - `extraAttributes.labType IN [EXTERNAL, THIRD_PARTY]`
  - `documentType = CEMENT_PHYSICAL_TEST`
- Ensure Release Strategy page can filter by `moduleCode = QUALITY` and these process codes.

Verification:

- Project admin can create and activate one ITP approval strategy and one material test approval strategy.
- Strategy simulation resolves the correct strategy for cement ITP approval.
- Strategy simulation resolves a stricter strategy for failed/hold-point material test results.

Exit criteria:

- ITP template approval and material test approval are configured separately and do not share approval steps unless the project deliberately configures them that way.

Rollback:

- Deactivate these strategies; ITP/test submission should return clear "No active release strategy" messages.

### Step 4: Material Receipt and Obligation Generation

Owner: backend
Depends on: Step 2
Files:

- `material-itp-obligation.service.ts`
- receipt DTOs/entities/controller endpoints

Tasks:

- Create receipt registration API.
- Resolve active ITP by material/brand/grade.
- Generate obligations:
  - every load
  - source approval
  - each consignment MTC
  - recurring ELR every N months
  - due offsets for time-based tests such as 72h/168h/672h if configured
- Prevent duplicate active obligations for same receipt/checkpoint.
- Calculate cement age expiry from manufacture/packing date.

Verification:

- Register cement receipt with grade OPC 53.
- Obligations appear for load checks and relevant physical/chemical tests.
- Receipt older than three months is flagged.

Exit criteria:

- Incoming material drives testing workload automatically.

Rollback:

- Hide receipt UI; generated obligations can remain read-only.

### Step 5: Result Logging and Criteria Evaluation

Owner: backend
Depends on: Step 4
Files:

- `material-itp-compliance.service.ts`
- `material-itp-evidence.service.ts`
- result DTOs/entities/controller endpoints
- upload handling for evidence photographs, MTC, ELR, challan, calibration certificates, and test reports

Tasks:

- Log result against obligation.
- Validate required numeric/text/document inputs from checkpoint config.
- Validate mandatory evidence requirements from checkpoint config: required document types, required photo count, required lab report.
- Upload and link evidence photographs/documents to receipts, obligations, and results.
- Evaluate pass/fail for min/max/range/text-rule criteria.
- Store criteria and ITP snapshot on result.
- Update obligation and receipt status.
- Resolve and start `MATERIAL_TEST_RESULT_APPROVAL` release strategy when a test result is submitted for approval.
- Add approval/rejection/rework endpoints for material test result approval steps.
- On approval completion, set result `reviewStatus = APPROVED`, lock it, and mark obligation completed when applicable.
- On approval completion, lock evidence files linked to the approved result.
- On rejection/rework, reopen the obligation/result for correction based on restart policy and keep old evidence as revision history.
- Create failure hook that can open NCR/material quarantine workflow later.

Verification:

- Fineness OPC 53 value below 225 fails.
- Fineness OPC 43S below 370 fails.
- Le-Chatelier above allowed limit fails.
- Document-required checkpoint rejects submission without attachment.
- Photo-required checkpoint rejects submission until required photo count is met.
- Uploaded evidence is stored with relative URL and appears in result detail.
- Approved evidence cannot be deleted by ordinary users.
- Submitted test result creates a `MATERIAL_TEST_RESULT_APPROVAL` approval run with the correct release strategy.
- Only assigned approvers can approve the current step.
- Approved result cannot be edited except via reversal/revision permission.

Exit criteria:

- Test result logging is ITP-driven, release-strategy approved, and auditable.

Rollback:

- Keep results in DRAFT and disable submit/review routes.

### Step 6: Pending Tasks and Quality Summary Integration

Owner: backend
Depends on: Step 4 and Step 5
Files:

- `backend/src/notifications/pending-tasks.service.ts`
- `frontend/src/services/notification.service.ts`
- `backend/src/quality/quality.service.ts`
- dashboard/summary services if needed

Tasks:

- Add pending task item types for material tests.
- Add counts for material tests due, overdue, failed, ITP approval pending, material test approval pending, and rework pending.
- Add project filter support.
- Update frontend pending task type union.
- Add navigation target metadata to pending tasks if possible.

Verification:

- Overdue obligation increases Pending Tasks badge.
- ITP approval step assigned to a user increases Pending Tasks badge.
- Material test result approval step assigned to a user increases Pending Tasks badge.
- Clicking navigates into Quality > Materials with the relevant task selected.

Exit criteria:

- Users are notified when testing is missing or expired.

Rollback:

- Remove pending task query block; core ITP remains unaffected.

### Step 7: Frontend ITP Library Builder

Owner: frontend
Depends on: Step 2 and Step 3
Files:

- `frontend/src/views/quality/subviews/QualityMaterialTest.tsx`
- new components under `frontend/src/components/quality/material-itp`
- `frontend/src/services/quality.service.ts`
- `frontend/src/types/quality.ts`

Tasks:

- Refactor Materials tab into sub-tabs.
- Build ITP list/table.
- Build ITP editor:
  - header fields
  - grade matrix editor
  - checkpoint rows
  - frequency selector
  - inspection category flags
  - verifying document selector
  - contractor/PMC responsibility flags
  - required evidence types
  - minimum photo count
- Build read-only ITP print/table view similar to the PDF.
- Add copy-from-project modal.
- Add submit-for-approval action.
- Add approval status badges: Draft, Submitted, Approval In Progress, Approved, Active, Rejected, Rework.
- Add approval timeline drawer showing release strategy name/version, levels, assigned approvers, comments, signatures, and current pending step.

Verification:

- Create cement ITP manually.
- Submit cement ITP and see approval timeline.
- Approved ITP can be activated; unapproved ITP cannot be activated.
- Display grade matrix without overlap on desktop and mobile.
- Copy project ITP from another project.

Exit criteria:

- Users can create and display ITPs inside Quality > Materials.

Rollback:

- Feature flag ITP Library tab off.

### Step 8: Frontend Receipt, Schedule, and Result Logging

Owner: frontend
Depends on: Step 4 and Step 5
Files:

- material receipt components
- obligation list components
- result log modal/page

Tasks:

- Incoming material registration form.
- ITP auto-select and warnings.
- Obligation board with status filters.
- Result logging form generated from checkpoint config.
- Criteria preview and automatic pass/fail display.
- Upload controls for evidence photographs, MTC, ELR, delivery challan, calibration certificates, and test reports.
- Preview gallery for uploaded photos and documents.
- Evidence requirement checklist showing missing/complete evidence before submission.
- Submit result for material test approval.
- Add result approval drawer/timeline.
- Add reject/rework path that returns result to editable state with approver comments.

Verification:

- Register cement load and see obligations.
- Log a physical test result and see obligation completed.
- Log failed result and see failed state.
- Missing required document blocks submit.
- Missing required photos block submit.
- Approver can view uploaded photos/documents inside the approval drawer.
- Submitted result waits for release strategy approval before final completion.
- Assigned approver can approve/reject from the approval drawer.

Exit criteria:

- Material testing workflow is end-to-end usable from the UI.

Rollback:

- Hide receipt/result tabs; ITP library remains.

### Step 9: Import/Seed From Cement PDF Shape

Owner: backend + frontend
Depends on: Step 7
Files:

- optional parser/seed under quality material ITP
- seed service if approved

Tasks:

- Add "Use Cement Sample" starter template, based on the supplied PDF.
- Later phase: add Excel/PDF import preview similar to checklist import.
- For PDF import, prefer structured Excel template first; scanned PDFs will need OCR/AI parsing and manual review.

Verification:

- One-click sample creates ITP-MAT-QA-01 with all PDF-derived checkpoints.

Exit criteria:

- Users can quickly bootstrap cement ITP.

Rollback:

- Remove sample button/seed only.

### Step 10: Tests, Migration, and Release Hardening

Owner: full stack
Depends on: all previous steps

Tasks:

- Backend unit tests for frequency generation and criteria evaluation.
- API tests for permission checks and project isolation.
- Frontend tests for ITP builder and result logging.
- Data migration for existing material tests.
- Add indexes after measuring common filters.
- Add audit logging for ITP activation, revision, result review, waiver.
- Add evidence upload security tests: file type, file size, project ownership, deletion lock, relative URL storage.
- Add export/print for ITP and receipt test pack.

Verification:

- Backend `npm run build`.
- Frontend `npm run build`.
- API smoke suite:
  - create ITP
  - submit ITP approval
  - approve ITP
  - activate
  - register receipt
  - upload challan/MTC/photo evidence
  - generate obligations
  - submit result
  - upload test report/photo evidence
  - approve result
  - pending task count updates

Exit criteria:

- Existing quality flows still pass.
- Material ITP workflow is stable and auditable.

Rollback:

- Feature flag Materials ITP UI off.
- Keep schema and data; no destructive rollback after production use unless backup restored.

## Dependency Graph

- Step 1 blocks all backend feature work.
- Step 2 blocks Step 3, Step 3A, and Step 7.
- Step 3A blocks approval-complete behavior in Step 5, but Step 5 result drafting can begin before Step 3A.
- Step 4 depends on Step 2.
- Step 5 depends on Step 4.
- Step 6 depends on Step 4 and Step 5.
- Step 7 can run after Step 2, parallel with Step 4/5.
- Step 8 depends on Step 4/5 and can run parallel with Step 6.
- Step 9 depends on Step 7 and can run parallel with Step 8.
- Step 10 depends on all.

Parallel work:

- Backend Step 3 and backend Step 4 can run in parallel after Step 2 if write scopes are separated.
- Step 3A can run in parallel with Step 4 once approval process codes are agreed.
- Frontend Step 7 can run while backend Step 4/5 are built using mocked service responses.
- Notification Step 6 can begin once obligation query shape is stable.

## Review Gate Checklist

Before implementation is accepted:

- Does every material test result link to an ITP checkpoint or explicit legacy import record?
- Can an ACTIVE used ITP be mutated in a way that changes historical acceptance criteria? It must not.
- Can an ITP template become ACTIVE without completed `MATERIAL_ITP_APPROVAL`? It must not.
- Can a material test result become final/approved without completed `MATERIAL_TEST_RESULT_APPROVAL`? It must not.
- Are the ITP approval strategy and material test result approval strategy separate process codes?
- Are approval runs snapshotting strategy ID/version/name and current approver assignments?
- Are obligations project-scoped and permission-scoped?
- Does copy-to-project create independent checkpoint IDs?
- Are overdue/due-soon calculations date-only and timezone-safe for India usage?
- Does cement grade selection drive grade-specific criteria?
- Can users waive a test only with permission and reason?
- Are failed results visible enough to prevent material acceptance by mistake?
- Are file uploads stored as relative paths, consistent with existing upload utilities?
- Are mandatory evidence requirements enforced before submit/approval?
- Are approved evidence files locked from ordinary edit/delete?
- Are photo/document uploads project-scoped so one project cannot read another project's evidence?
- Are existing material test records migrated or still visible?

## Anti-Patterns To Avoid

- Storing acceptance criteria as only free text.
- Logging tests without a receipt or obligation context.
- Editing active ITP checkpoint criteria after results exist.
- Using the same approval workflow state for ITP template approval and test result approval without separate process codes.
- Marking material test results complete immediately on submission before release-strategy approval finishes.
- Re-resolving the release strategy in the middle of an active approval run instead of using the original strategy snapshot.
- Storing multiple evidence files as an opaque JSON blob instead of auditable attachment rows.
- Allowing evidence deletion after approval without reversal/rework audit trail.
- Trusting frontend MIME validation without backend file validation.
- Copying templates by reference instead of deep copy.
- Treating every material as cement; the model must support steel, aggregates, admixtures, blocks, tiles, waterproofing, etc.
- Making PDF import the first critical path. Build manual structured ITP first; import can follow.
- Alerting everyone globally; notifications must be project and role scoped.
- Using frontend-only pass/fail calculation. Backend must be source of truth.

## Suggested First Release Scope

Release 1 should include:

- Manual ITP builder
- Release strategy process setup for ITP template approval
- Release strategy process setup for material test result approval
- Cement sample template
- Copy ITP to another project
- Incoming receipt registration
- Obligation generation
- Result logging against obligations
- Evidence photo and document upload for receipts and test results
- Approval timeline/actions for ITP templates and material test results
- Due/overdue dashboard and Pending Tasks integration

Defer:

- AI/PDF parsing
- Full report designer
- NCR auto-creation from failed tests
- Vendor mobile interface
- Advanced quantity-based sampling rules beyond simple configured frequency
