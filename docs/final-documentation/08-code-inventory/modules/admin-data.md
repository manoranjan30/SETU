# Admin Data Module

Status: Draft  
Primary wave: E - Analytics and Extensibility  
Related modules: App Config, Users, Roles, Permissions, Projects, Audit, all reference-data consumers

## Purpose

Provides authorized administration of reference, master, and configuration data used by project and operational modules.

## Documentation Requirements

Inventory each managed data category, source of truth, fields, validation, scope, active/inactive lifecycle, import/export, dependency checks, effective dates, and downstream consumers.

## Code and Review

Inspect `backend/src/admin-data/`, relevant controllers/entities, admin routes in `frontend/src/App.tsx`, and administrative services/views. Confirm boundaries with App Config, Users, Resources, and Template Builder.

## Security and Testing

Require granular permissions, protect high-impact values, audit changes, validate references, and prevent deletion of data with historical dependencies. Test imports, invalid values, scope, effective dates, rollback, and downstream behavior.

