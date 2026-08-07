# Dashboard Builder Module

Status: Draft  
Primary wave: E - Analytics and Extensibility  
Related modules: Dashboard, Projects, App Config, Permissions, Audit, all metric source modules

## Purpose

Allows authorized users to configure reusable dashboard layouts, widgets, filters, data sources, thresholds, and role/project visibility.

## Documentation Requirements

Document builder model, widget catalog, metric query safety, layout/versioning, draft/publish lifecycle, role/project scope, calculated fields, export, rollback, and impact of source schema changes.

## Code and Review

Inspect backend dashboard-builder capability, `frontend/src/services/dashboard-builder.service.ts`, routes, builder views, and shared chart/table components. Confirm whether custom queries or only approved data sources are allowed.

## Security, Testing, Decisions

Prevent custom configurations from bypassing source permissions or exposing data. Test validation, publishing, versioning, broken sources, filters, responsive layout, and rollback. Confirm who can build/publish dashboards and how metric definitions are governed.

