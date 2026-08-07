# Cost and Budget Module

Status: Draft  
Primary wave: D - Control and Compliance  
Related modules: Projects, WBS, BOQ, Resources, Planning, Execution, Progress, Labor, Dashboard, Audit

## Purpose

Manages project budget structure, planned/committed/actual cost, variance, forecasts, approvals, and cost reporting where implemented.

## Code Map

- Backend registration: `backend/src/app.module.ts`
- Backend evidence: cost/budget files under `backend/src/`
- Web evidence: `frontend/src/services/budget.service.ts`, `cost.service.ts`, and project/dashboard views

## Module Behavior

Document budget versions, cost codes, BOQ/rate/resource links, currency, commitments, actuals, forecasts, transfers, approvals, period close, variance, and audit. Clarify accounting/ERP boundaries and the source of actual financial data.

## API/Data/Security

Inventory budget, line-item, forecast, transfer, approval, variance, import/export, and summary endpoints. Protect rates, vendor, payroll, and commercial data by project and role. Test calculations, currency/rounding, revisions, period locks, exports, and audit.

## Open Decisions

Confirm whether Cost/Budget is a planning estimate, commercial control, or accounting integration; who owns rates/actuals; and how Progress, BOQ, Resources, and Labor feed cost.

