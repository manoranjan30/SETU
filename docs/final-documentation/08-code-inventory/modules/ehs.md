# Environment, Health and Safety (EHS) Module

Status: Draft  
Primary wave: D - Control and Compliance  
Related modules: Projects, Execution, Labor, Quality, Snag, Work Documents, Release Strategy, Notifications, Audit

## Purpose

Manages safety observations, inspections, permits, incidents, corrective actions, compliance evidence, and EHS reporting.

## Code Map

- Backend registration: `backend/src/app.module.ts`
- Backend evidence: `backend/src/ehs/`
- Web routes/services: `frontend/src/App.tsx`, EHS services/views
- Mobile evidence: `flutter/lib/features/ehs/`

## Module Behavior

Document observation/incident/inspection types, severity, location, work context, affected worker/team, immediate action, investigation, corrective action, owner, due date, evidence, approval, closure, and escalation. Define mandatory controls and release/stop-work effects.

## API/Data/Security

Inventory create, assign, evidence, investigate, close, approve, notify, and report endpoints. Identify sensitive personal/incident data, retention, permissions, project isolation, and audit. Protect worker health and safety information with strict access and redaction.

## Testing and Decisions

Test incident/report creation, severity escalation, overdue action, evidence, approval, closure, notification, offline capture, and audit. Confirm incident taxonomy, legal retention, stop-work authority, and integration with Quality, Snag, Labor, and Release Strategy.

