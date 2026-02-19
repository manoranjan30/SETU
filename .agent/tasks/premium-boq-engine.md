# Task: Premium BOQ Management Engine (Safety & Dashboard)

Implement enhancements to the BOQ module to transform the import/export engine into a premium enterprise-grade tool.

## Phase 1: Import Validation & Dry-Run (Backend)
- [ ] Modify `BoqImportService.importBoq` to support a `dryRun` mode.
- [ ] In `dryRun` mode:
    - [ ] Return a summary: `newCount`, `updateCount`, `errorCount`.
    - [ ] Return detailed `errors` array (row-by-row).
    - [ ] Return `preview` data (sample of what is being updated/created).
    - [ ] DO NOT save any data to the database.

## Phase 2: Enhanced Import Workflow (Frontend)
- [ ] Update `ExcelImportModal` for BOQ to include a sequential workflow:
    1. **Upload**: Select file.
    2. **Mapping**: Match Excel columns to system fields.
    3. **Preview/Validation**: Show dry-run results (Errors, Changes).
    4. **Confirmation**: Final sync.

## Phase 3: QS Logic & Auditing (Backend)
- [ ] Implement `validateRollups` during import:
    - [ ] Check if `Sum(Measurements) == SubItem.Qty`.
    - [ ] Check if `Sum(SubItems) == MainItem.Qty`.
- [ ] Record these as "Warnings" in the dry-run response.

## Phase 4: Versioning/Audit Log
- [ ] Ensure every import is logged in the `AuditService` with a summary of changes.
