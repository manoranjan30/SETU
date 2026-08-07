# Custom Tracker Module

Status: Draft  
Primary wave: E - Analytics and Extensibility  
Related modules: Projects, App Config, Dashboard, Permissions, Audit, Notifications

## Purpose

Provides configurable trackers for project-specific records, attributes, statuses, owners, dates, and workflows that are not covered by fixed domain modules.

## Documentation Requirements

Document tracker definitions, fields/types, required values, project scope, lifecycle, views, permissions, imports/exports, notifications, audit, and reporting. Clarify whether custom records can link to WBS, BOQ, execution, or milestones.

## Code and Review

Inspect `frontend/src/services/customTracker.service.ts`, backend tracker capability, routes, dynamic field validation, and storage. Confirm whether configuration is schema-driven or code-defined.

## Security and Testing

Prevent dynamic fields from bypassing authorization or exposing data. Test definition/version changes, validation, project isolation, filters, exports, notifications, and audit. Confirm ownership and migration when a tracker is retired.

