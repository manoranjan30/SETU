# Snag Module

Status: Draft  
Primary wave: D - Control and Compliance  
Related modules: Projects, WBS, Design, Execution, Progress, Quality, EHS, Work Documents, Release Strategy, Notifications, Audit

## Purpose

Manages defects, incomplete work, observations, assignments, corrective actions, verification, and closure across project locations and work packages.

## Code Map

- Backend registration: `backend/src/app.module.ts`
- Backend evidence: `backend/src/snag/`
- Web evidence: `frontend/src/services/snag.service.ts`, `frontend/src/App.tsx`
- Mobile evidence: Flutter quality/execution/project features

## Module Behavior

Document snag creation, location/WBS/design/execution links, severity, category, assignee, due date, evidence, status, root cause, corrective action, verification, reopening, and release impact. Preserve original finding and closure history.

## API/Data/Security

Inventory list, create, assign, update, comment, evidence, resolve, verify, reopen, bulk, and export endpoints. Identify status transitions, SLA/overdue rules, entities, project scope, and audit. Prevent unauthorized edits or closure and protect location/customer data.

## Testing and Decisions

Test creation, assignment, overdue, resolution, rejection, verification, reopening, release gating, offline evidence, notifications, and audit. Confirm whether Snag or Issue Tracker owns defects, and how Quality/EHS findings are linked.

