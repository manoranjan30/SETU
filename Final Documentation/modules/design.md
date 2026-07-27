# Design Module

Status: Draft  
Primary wave: B - Project Definition and Planning  
Related modules: Projects, WBS, BOQ, Planning, Work Documents, Execution, Quality, Snag, EHS, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Design module manages project design information used to define, coordinate, approve, and execute construction work. It provides controlled access to drawings, models, design documents, revisions, submissions, and design-related decisions.

### In scope

- Design packages, drawings, models, and supporting documents
- Design metadata and project/WBS classification
- Revision and version control
- Submission, review, approval, rejection, and supersession
- Design responsibility, discipline, and document status
- Controlled download, preview, and sharing
- Design links to BOQ, WBS, planning, execution, quality, and snag records

### Out of scope

- General project document storage without design workflow ownership
- BOQ pricing and cost ownership
- Construction progress or execution status
- Quality or snag closure, except for design-related references
- External CAD/model authoring tools unless explicitly integrated

## 2. System Position

```text
Project and WBS
    -> design package/document
    -> review and revision lifecycle
    -> approved/superseded design reference
    -> BOQ, planning, execution, quality, and field use
```

Design revision and approval state must be unambiguous. Field users should be able to determine which document is current and approved for use.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers the Design module |
| Backend feature | `backend/src/design/` | Design controllers, services, DTOs, entities, file metadata, and workflow logic |
| Project structure | `backend/src/projects/` and `backend/src/wbs/` | Supplies project and WBS scope |
| Web route surface | `frontend/src/App.tsx` and design/project views | Design list, viewer, upload, revision, and approval experiences |
| Web API/files | `frontend/src/api/`, `frontend/src/services/`, and file utilities | Design metadata, upload, preview, download, and revision requests |
| Mobile consumers | Flutter design/project features | Field access, download, and offline availability where supported |
| PDF/CAD processing | PDF processor and frontend PDF/DXF utilities | Preview, conversion, extraction, or rendering behavior where configured |

Exact controller names, supported file types, storage provider, and design-state values must be verified from source before approval.

## 4. Design Record Model

The approved document should identify fields for:

- Design/document identifier
- Project and WBS reference
- Package, discipline, category, and document type
- Drawing/model number and title
- Revision number/letter
- Status: draft, submitted, under review, approved, rejected, superseded, or equivalent
- Author, designer, reviewer, approver, and responsible organization
- Issue date, review date, approval date, and effective date
- File name, type, size, checksum/version, and storage reference
- Related BOQ, activity, location, tower/block/phase, or issue references
- Created/updated information and audit context

For each field, state whether it is user-entered, generated, imported, derived, or controlled by workflow.

## 5. Core User Journeys

### 5.1 Upload or create a design record

1. An authorized project user selects the project, package, discipline, and WBS context.
2. The user uploads a supported file or creates the metadata record.
3. The system validates file type, size, required metadata, naming, and duplicate/revision rules.
4. The design enters its initial state.
5. The system records the creator, file version, and audit event.

### 5.2 Submit design for review

The submitter selects reviewers or a configured review route. Document the required fields, submission lock behavior, notification, due date, and whether a revised file can be uploaded while review is active.

### 5.3 Review, approve, or reject

1. A permitted reviewer opens the design and related context.
2. The reviewer records comments, actions, and outcome.
3. Approval makes the revision effective according to policy.
4. Rejection returns the design to an editable or resubmission state.
5. The event is audited and relevant users are notified.

### 5.4 Create a new revision

The final document must specify whether a new revision copies metadata, how revision identifiers are generated, whether the previous revision remains downloadable, and how linked records choose the current approved revision.

### 5.5 Use an approved design in the field

Users should be able to identify the current approved version, its effective date, and any supersession warning. Offline access must preserve revision identity and remove or mark outdated files according to policy.

## 6. Revision and Status Rules

Confirm the implementation for:

- Revision numbering and uniqueness
- Draft versus published metadata
- Whether files are immutable after submission
- Approval and rejection transitions
- Superseding an approved revision
- Reopening or withdrawing an approval
- Deleting versus archiving a design record
- Multiple approved revisions by discipline or area
- Effective dates and future-dated documents
- Impact on downstream activities and records

No field workflow should rely on a file merely being uploaded; it should use the documented approved/effective state.

## 7. API Contract to Confirm

Extract the exact endpoint inventory from the Design controller and file/document routes.

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/search designs | Project/design view | Project, WBS, discipline, status, revision, pagination | Design summaries | None |
| To verify | Get design | Project/design view | Design identifier | Metadata and current revision | None |
| To verify | Upload/create design | Design edit | Metadata and file | Created design/revision | Storage, audit, notification |
| To verify | Update metadata | Design edit | Metadata DTO | Updated record | Audit and validation |
| To verify | Submit for review | Design workflow | Design identifier/comment | Workflow result | Notification and audit |
| To verify | Approve/reject | Design approval | Design identifier, decision, comments | Updated status | Notification, audit, downstream effect |
| To verify | Create revision | Design edit | Prior design and new file/metadata | New revision | Supersession links and audit |
| To verify | Download/preview | Design view/download | Design/revision identifier | File or preview | Access/download audit if configured |

For every confirmed endpoint, document project-scope authorization, file limits, validation, response behavior, error handling, and audit/notification side effects.

## 8. File, Preview, and Storage Behavior

The approved document must identify:

- Supported file types, including PDF, images, CAD/DXF, and model formats if applicable
- Maximum file size and upload limits
- Storage location and naming strategy
- Preview/conversion service and failure behavior
- Download authorization and watermarking, if supported
- Checksums/version integrity
- Temporary-file cleanup
- Virus/malware scanning, if configured
- Retention, archival, and backup

The PDF processor and any CAD/model viewer should have operational links when the design experience depends on them.

## 9. Data Model and Downstream Links

Identify relationships to:

- Projects, towers, blocks, phases, and locations
- WBS nodes
- BOQ items and quantities
- Planning activities and micro-schedule tasks
- Execution/work documents
- Quality inspections, snags, and EHS observations
- Design comments, issues, and approvals

Document whether downstream records reference a specific revision, the current approved revision, or only a design package. Historical records should preserve the revision used at the time of work or decision.

## 10. Security, Permissions, and Audit

Confirm separate permissions for viewing, uploading, revising, submitting, reviewing, approving, rejecting, downloading, exporting, and administering design configuration.

At minimum, audit:

- Upload and metadata creation
- File replacement or revision creation
- Review comments and decisions
- Approval/rejection/withdrawal
- Supersession and effective-date changes
- Downloads/exports where commercially sensitive
- Deletion, archive, or retention actions

Protect sensitive design files from cross-project access and ensure deep links enforce current authorization.

## 11. Integrations and Consumers

### Upstream dependencies

- Projects and project membership
- WBS and project subdivisions
- Roles and Permissions
- File storage, PDF/CAD processing, and configuration

### Downstream consumers

- BOQ and cost analysis
- Planning and Micro Schedule
- Execution and field work
- Quality, Snag, and EHS
- Work Documents and reports
- Notifications and Audit
- Flutter offline design access where supported

## 12. Testing Checklist

- Upload valid and invalid file types
- Validate required design metadata and project scope
- Create and identify revisions correctly
- Submit, review, approve, reject, and resubmit
- Prevent unauthorized workflow transitions
- Prevent editing immutable approved files
- Identify current approved and superseded revisions
- Preview/download only within project permissions
- Verify file-size, conversion, storage, and cleanup behavior
- Preserve revision references in downstream records
- Verify offline/mobile behavior for approved design files
- Record audit and notification events
- Test duplicate uploads, interrupted uploads, and retry behavior

Existing automated test locations and file-provider/PDF/CAD coverage gaps should be added during technical review.

## 13. Open Questions for Approval

1. Which design file formats are officially supported?
2. What is the exact review and approval state machine?
3. Who may approve each design discipline or project scope?
4. Are revision identifiers generated or user-entered?
5. Can approved revisions be withdrawn or edited?
6. Which downstream records must reference a specific revision?
7. Is an external document-management or storage provider used?
8. Which files are available offline in Flutter?
9. What are retention, archival, and download-audit requirements?
10. How are design changes communicated to affected execution and quality teams?

## 14. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/design/`
- Project reference: `Final Documentation/modules/projects.md`
- WBS reference: `Final Documentation/modules/wbs.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Audit reference: `Final Documentation/modules/audit.md`
- Notification reference: `Final Documentation/modules/notifications.md`
- PDF processing: `Final Documentation/pdf-processor.md` (planned)
- Web routing: `frontend/src/App.tsx`
- Mobile design feature: `flutter/lib/features/design/`

