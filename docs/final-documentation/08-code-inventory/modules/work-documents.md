# Work Documents Module

Status: Draft  
Primary wave: C - Execution and Progress  
Related modules: Projects, WBS, Design, Execution, Progress, Quality, Snag, EHS, Labor, Release Strategy, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Work Documents module manages operational documents and evidence created or used during project execution. It provides controlled storage, classification, revision, review, and access for records such as method statements, checklists, permits, reports, field forms, photographs, certificates, and handover evidence where supported.

### In scope

- Work-document records and metadata
- File upload, preview, download, and attachment
- Project/WBS/execution/location classification
- Document status, review, approval, and revision
- Evidence links to progress, quality, snag, EHS, labor, and release records
- Search, filters, retention, access control, and audit

### Out of scope

- Design document ownership, which belongs to Design
- General infrastructure file storage
- Business record ownership of the workflow that uses the document
- Quality, snag, EHS, or execution status itself

## 2. System Position

```text
Execution / Quality / Snag / EHS / Progress / Release
    -> work-document metadata and evidence
    -> file storage and review
    -> controlled access and approval
    -> audit, reporting, and handover traceability
```

The module must distinguish a document file, its metadata, its revision, and the business record that references it.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Work Documents |
| Backend feature | `backend/src/workdoc/` | Document controllers, services, DTOs, entities, file metadata, and workflow |
| Web service | `frontend/src/services/work-doc.service.ts` | Document requests, upload, mapping, and client state |
| Web views | `frontend/src/App.tsx` and execution/project views | Document lists, upload, preview, review, and downloads |
| File processing | PDF processor and shared file utilities | Preview, conversion, validation, and generated output |
| Mobile consumers | Flutter execution, design, quality, EHS, progress, and project features | Field evidence and offline access where supported |

Exact file types, storage provider, endpoint paths, and workflow statuses must be verified before approval.

## 4. Document Record Model

Identify fields for document identifier, title, type/category, project/WBS/location, source module/resource, linked record, version/revision, status, author, reviewer, approver, effective date, file name/type/size/checksum, storage reference, confidentiality, and timestamps.

For each field, state whether it is user-entered, generated, imported, calculated, or controlled by workflow.

## 5. Core User Journeys

### 5.1 Upload or create a work document

An authorized user selects project and business context, enters required metadata, uploads a supported file or creates an evidence record, and submits it for storage or review.

### 5.2 Attach evidence to a business record

Users attach a document or photograph to execution, progress, quality, snag, EHS, labor, or release data. The system must preserve both the document’s identity and the referenced record’s project scope.

### 5.3 Review and approve

Reviewers inspect metadata, file, linked context, and comments, then approve, reject, request revision, or mark obsolete. Document the effect on the business record and notifications.

### 5.4 Create a revision

The system should preserve prior versions, identify the effective/current revision, and explain whether linked records reference a specific revision or the current version.

### 5.5 Download or use offline

Document authorization must be rechecked at download/preview time. Flutter behavior must define which files are cached, encrypted, expired, invalidated, or removed after sign-out or project-access changes.

## 6. Status and Revision Rules

Confirm draft, submitted, under review, approved, rejected, superseded, archived, expired, and deleted/retained states as implemented. Define file immutability after approval, revision numbering, effective dates, withdrawal, expiry, and historical retention.

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | List/search documents | Document view | Project, type, status, linked record, pagination | Document summaries | None |
| To verify | Get document | Document view | Document identifier/version | Metadata and file detail | None |
| To verify | Upload/create document | Document edit | Metadata and file | Created document/version | Storage and audit |
| To verify | Update metadata | Document edit | Metadata DTO | Updated record | Audit and validation |
| To verify | Review/approve/reject | Document workflow | Decision, comments, evidence | Updated status | Notification and audit |
| To verify | Download/preview | Document download | Document/version identifier | File/preview | Download audit if configured |
| To verify | Create revision/archive | Administration | Prior record and action | Updated/versioned record | Supersession and audit |

For each confirmed endpoint, document project/resource authorization, file limits, validation, preview behavior, errors, and audit/notification side effects.

## 8. File Safety and Storage

Document supported file types, size limits, naming, storage, checksums, temporary files, malware scanning, PDF/DXF/model processing, preview conversion, download controls, retention, backup, and failure/retry behavior.

Sensitive files should not be exposed through public URLs or notification previews. Generated files must have an owner, expiry/retention rule, and access check.

## 9. Data Model and Relationships

Identify links to Projects, WBS, Design, Execution, Progress, Quality, Snag, EHS, Labor, Release Strategy, Notifications, and Audit.

Historical records must preserve the exact document version used as evidence. Replacing or archiving a file must not erase its previous business context.

## 10. Security, Permissions, and Audit

Confirm separate permissions for viewing metadata, uploading, editing, reviewing, approving, downloading, exporting, archiving, deleting, and administering document types.

Audit upload, metadata changes, revisions, review decisions, downloads/exports where sensitive, retention actions, linking/unlinking, and access failures. Enforce project and resource scope at every read/download path.

## 11. Testing Checklist

- Upload valid and invalid file types
- Validate required metadata and project/record scope
- Prevent unauthorized upload, view, download, and deletion
- Review, approve, reject, revise, supersede, and archive
- Preserve prior versions and linked-record references
- Validate size, checksum, conversion, storage, and cleanup behavior
- Attach evidence to execution, progress, quality, snag, EHS, and release records
- Verify notification and audit events
- Verify offline/mobile cache, expiry, sign-out cleanup, and access removal
- Handle interrupted upload, duplicate upload, and retry safely

## 12. Open Questions for Approval

1. Which document categories and file types are supported?
2. Is this module separate from Design and general document management?
3. What is the exact review/approval state machine?
4. Which records require document evidence?
5. Are revisions immutable after approval?
6. Which files are available offline in Flutter?
7. What are retention, archival, download-audit, and deletion rules?
8. Is a PDF/CAD processing service required for previews?
9. How are sensitive files protected in storage and generated links?
10. Who can approve or override document requirements for release/handover?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/workdoc/`
- Web service: `frontend/src/services/work-doc.service.ts`
- Design reference: `Final Documentation/modules/design.md`
- Execution reference: `Final Documentation/modules/execution.md`
- Progress reference: `Final Documentation/modules/progress.md`
- Release reference: `Final Documentation/modules/release-strategy.md`
- Audit reference: `Final Documentation/modules/audit.md`
- Sync reference: `Final Documentation/modules/sync.md`

