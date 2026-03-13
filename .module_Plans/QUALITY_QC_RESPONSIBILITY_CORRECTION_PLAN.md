# Quality QC Responsibility Correction Plan
**Module:** Quality Web Module
**Status:** Implemented
**Platform:** NestJS Backend + React Frontend

---

## Summary

The Quality module has been re-centered so `QA/QC Approvals` is the only place
that executes RFI checklist progress, stage completion, stage locking,
workflow approval, rejection, delegation, reversal, and final approval.

Immediate product outcome:
- `Quality Requests` remains the RFI raise/request board.
- `QA/QC Approvals` is the sole execution and approval workspace for RFIs.
- `Inspections` remains visible in the menu, but is now a placeholder-only
  future module with no RFI checklist or workflow actions.

This correction intentionally keeps the existing backend data model and
`/quality/inspections/*` routes as the RFI backing API for now. No schema,
permission, or route rename is part of this pass.

---

## Implemented Behavior

### 1. Quality Requests
- Continues to raise Requests for Inspection (RFI).
- No change to the backing API contract.
- User-facing copy is aligned around `RFI` / `Quality Requests`.

### 2. QA/QC Approvals
- Remains the canonical end-to-end RFI handling workspace.
- Owns checklist progress saving, stage status updates, workflow progression,
  rejection, delegation, reversal, and report download.
- User-facing copy is aligned around `RFI` and `QA/QC Approvals`.

### 3. Inspections
- The tab stays visible for future use.
- The old duplicate RFI execution UI has been removed.
- The screen now explains that standalone inspections will be handled later and
  that current RFI execution belongs to `QA/QC Approvals`.

---

## Contracts Preserved

- No database migration.
- No backend route rename.
- No permission-key rename.
- Existing `quality_inspection` records continue to back the active RFI flow.
- Existing `QUALITY.INSPECTION.*` permissions remain valid.

---

## Correction Note

The previous issue was not data-model ownership, but UI responsibility
placement: stage-wise checklist lock and approval behavior had been exposed in
the wrong tab. That behavior has now been re-homed to `QA/QC Approvals`
without changing persistence or authorization contracts.
