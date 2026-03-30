# Bulk CSV Import and Excel/CSV Export Plan

## Current State

### Imports already present

- BOQ import
- WBS / schedule import
- work order Excel import
- labor import
- quality checklist import
- schedule revision import

### Exports already present

- some schedule exports
- BOQ templates
- isolated CSV export in cost/planning widgets

## Current Gaps

1. No shared import staging framework
2. CSV import is not standardized across modules
3. Validation, preview, and error reporting vary by module
4. No common grid/table export contract
5. Some modules export only current UI state, some only backend full data, many neither
6. Audit trail is inconsistent for import/export actions

## Target State

### Import

Every major data module should support:

- CSV upload
- template download
- column mapping
- validation preview
- row-level errors
- partial rejection report
- auditable commit

### Export

Every major table/grid should support:

- Excel export
- CSV export
- current filtered view export
- full scoped dataset export

## Shared Framework Proposal

### Backend

Create shared import contracts:

- `ImportBatch`
- `ImportRowError`
- `ImportPreviewResult`
- `ImportCommitResult`

Create shared export contracts:

- `ExportRequestDto`
- `ExportColumnConfig`
- `ExportScope`

### Frontend

Create shared components:

- `BulkImportWizard`
- `ExportMenu`
- `ImportErrorReportModal`

## Module Rollout Priority

### High priority

- BOQ
- Work Orders
- WBS / Schedule
- Progress / Execution history
- Labor
- Quality observations / inspections

### Medium priority

- EHS
- Design register
- Milestones
- Resources

### Lower priority

- AI Insights datasets
- Dashboard builder datasets
- support/admin lookup tables

## Safe Rollout Rules

- imports must stage before commit
- exports must respect permission scope and current project scope
- all import/export operations must be audited
- template downloads should be versioned by module

## Verification

- row counts match
- validation catches duplicates and bad foreign keys
- export preserves filters and sort when exporting current grid
- export filenames identify module, project, and date

