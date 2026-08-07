# Issue Tracker Module

Status: Draft  
Primary wave: D - Control and Compliance  
Related modules: Projects, Planning, Execution, Quality, Snag, EHS, Design, Progress, Notifications, Audit

## Purpose

Manages cross-functional project issues, ownership, priority, due dates, decisions, escalation, resolution, and links to affected work.

## Code Map

- Backend registration: `backend/src/app.module.ts`
- Backend evidence: issue-tracker files under `backend/src/`
- Web service: `frontend/src/services/issueTracker.service.ts`
- Web routes: `frontend/src/App.tsx` and project views

## Module Behavior

Document issue categories, severity/priority, source, project/WBS/location, owner, watchers, due date, dependencies, comments, evidence, status, resolution, reopen, and escalation. Distinguish issues from snags, quality findings, EHS incidents, and blockers.

## API/Data/Security

Inventory list, create, assign, update, comment, link, escalate, resolve, reopen, bulk, and export endpoints. Define status transitions, SLA rules, project scope, notifications, and audit. Test permissions, overdue escalation, linked-record integrity, offline behavior, and history preservation.

