# Customer Milestones Module

Status: Draft  
Primary wave: C - Execution and Progress  
Related modules: Projects, Planning, Milestones, Progress, Execution, Release Strategy, Notifications, Audit

## Purpose

Manages customer-facing or contractual project milestones, their commitments, forecast/actual dates, approvals, communication, and release/handover linkage.

## Scope and Code Map

- Backend registration: `backend/src/app.module.ts`
- Backend evidence: milestone/customer-milestone files under `backend/src/`
- Web evidence: `frontend/src/services/customerMilestone.service.ts`, `frontend/src/App.tsx`
- Consumers: Planning, Progress, Release Strategy, dashboards, Notifications, Audit

## Required Documentation

Document milestone types, customer/project scope, baseline and forecast dates, dependencies, completion evidence, approval authority, status transitions, delay/exception rules, recipient visibility, and historical reporting. Confirm whether this is separate from internal Milestones.

## API/Data Questions

Inventory list, detail, create, update, forecast, approve, complete, and export endpoints. Identify customer/contract references, immutable baseline fields, notification triggers, and audit records.

## Security, Testing, and Open Decisions

Restrict customer and contractual data by project and role. Test date variance, approval, rejection, delay, release linkage, exports, and audit. Confirm customer visibility, contractual rules, reopening, and mobile support.

