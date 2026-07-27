# Quality Module

Status: Draft  
Primary wave: D - Control and Compliance  
Related modules: Projects, WBS, Design, Execution, Progress, Snag, EHS, Work Documents, Release Strategy, Audit

## Purpose

Manages quality plans, inspections, checklists, test results, nonconformities, approvals, evidence, and quality readiness for project work.

## Code Map

- Backend registration: `backend/src/app.module.ts`
- Backend evidence: `backend/src/quality/`
- Web evidence: `frontend/src/services/quality.service.ts`, `frontend/src/App.tsx`
- Mobile evidence: `flutter/lib/features/quality/`

## Module Behavior

Document inspection/checklist templates, work/design/WBS links, sampling, result values, pass/fail rules, evidence, reviewer, rejection, corrective action, reinspection, and closure. Define whether quality records can block Progress, Execution, Release Strategy, or Customer Milestones.

## API/Data/Security

Inventory inspection, checklist, result, evidence, approval, rejection, corrective-action, close, and export endpoints. Identify entities, versioned templates, result history, project scope, and audit events. Restrict sensitive findings and enforce server-side workflow permissions.

## Testing and Decisions

Test checklist execution, failed result, reinspection, evidence, approval, project isolation, offline capture, and release gating. Confirm quality-template ownership, mandatory checks, sampling rules, integration with Snag/EHS, and approval authority.

