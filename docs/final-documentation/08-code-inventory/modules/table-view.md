# Table View Module

Status: Draft  
Primary wave: E - Analytics and Extensibility  
Related modules: Dashboard, Custom Tracker, BOQ, Planning, Progress, Projects, Permissions

## Purpose

Provides reusable tabular data views with columns, filters, sorting, pagination, grouping, saved views, and export behavior.

## Documentation Requirements

Document view definitions, data-source permissions, column metadata, filter syntax, sorting, aggregation, saved preferences, responsive behavior, exports, and large-data limits.

## Code and Review

Inspect `frontend/src/services/table-view.service.ts`, table/grid components, AG Grid configuration, backend query endpoints, and route consumers. Confirm whether views are personal, role-based, or shared.

## Security and Testing

Apply server-side scope to queries and exports; do not rely on hidden columns. Test filters, pagination, sorting, saved views, responsive layout, redaction, large datasets, and source errors.

