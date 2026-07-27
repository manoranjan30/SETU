# SETU Final Documentation Index

This is the canonical index for approved and in-progress SETU documentation. New module documents should be added under this folder and linked here after their scope is agreed.

The full documentation-set completion summary is available in [completion-note.md](./completion-note.md).

The source-level function/class inventory is available in [code-inventory.md](./code-inventory.md).

For a searchable, rendered view of the documentation, open [documentation-viewer.html](./documentation-viewer.html), then select this folder with `Open Documentation Folder`.

## Current Set

| Area | Document | Status | Review state |
|---|---|---|---|
| Architecture | [Application Structure](./app-structure-module-wise.md) | Available | Baseline overview |
| Process | [Module Documentation Plan](./module-documentation-plan.md) | Available | Recommended pilot: Auth |
| Foundation | [Authentication](./modules/auth.md) | Draft | Ready for owner review |
| Foundation | [Users](./modules/users.md) | Draft | Ready for owner review |
| Foundation | [Roles](./modules/roles.md) | Draft | Ready for owner review |
| Foundation | [Permissions](./modules/permissions.md) | Draft | Ready for owner review |
| Foundation | [Projects](./modules/projects.md) | Draft | Ready for owner review |
| Foundation | [App Config](./modules/app-config.md) | Draft | Ready for owner review |
| Foundation | [Audit](./modules/audit.md) | Draft | Ready for owner review |
| Foundation | [Notifications](./modules/notifications.md) | Draft | Ready for owner review |
| Foundation | [Sync](./modules/sync.md) | Draft | Ready for owner review |
| Foundation | [Common and Shared Services](./modules/common-shared-services.md) | Draft | Ready for owner review |
| Planning | [WBS](./modules/wbs.md) | Draft | Ready for owner review |
| Planning | [Design](./modules/design.md) | Draft | Ready for owner review |
| Planning | [BOQ](./modules/boq.md) | Draft | Ready for owner review |
| Planning | [Resources](./modules/resources.md) | Draft | Ready for owner review |
| Planning | [Planning](./modules/planning.md) | Draft | Ready for owner review |
| Planning | [Micro Schedule](./modules/micro-schedule.md) | Draft | Ready for owner review |
| Planning | [Milestones](./modules/milestones.md) | Draft | Ready for owner review |
| Planning | [Release Strategy](./modules/release-strategy.md) | Draft | Ready for owner review |
| Planning | [Template Builder](./modules/template-builder.md) | Draft | Ready for owner review |
| Execution | [Execution](./modules/execution.md) | Draft | Ready for owner review |
| Execution | [Progress](./modules/progress.md) | Draft | Ready for owner review |
| Execution | [Work Documents](./modules/work-documents.md) | Draft | Ready for owner review |
| Execution | [Labor](./modules/labor.md) | Draft | Ready for owner review |
| Execution | [Dashboard](./modules/dashboard.md) | Draft | Ready for owner review |
| Execution | [Customer Milestones](./modules/customer-milestones.md) | Draft | Ready for owner review |
| Control | [Quality](./modules/quality.md) | Draft | Ready for owner review |
| Control | [Snag](./modules/snag.md) | Draft | Ready for owner review |
| Control | [EHS](./modules/ehs.md) | Draft | Ready for owner review |
| Control | [Issue Tracker](./modules/issue-tracker.md) | Draft | Ready for owner review |
| Control | [Cost and Budget](./modules/cost-budget.md) | Draft | Ready for owner review |
| Analytics | [Executive Dashboard](./modules/executive-dashboard.md) | Draft | Ready for owner review |
| Analytics | [Dashboard Builder](./modules/dashboard-builder.md) | Draft | Ready for owner review |
| Analytics | [AI Insights](./modules/ai-insights.md) | Draft | Ready for owner review |
| Administration | [Admin Data](./modules/admin-data.md) | Draft | Ready for owner review |
| Extensibility | [Custom Tracker](./modules/custom-tracker.md) | Draft | Ready for owner review |
| Extensibility | [Table View](./modules/table-view.md) | Draft | Ready for owner review |
| Extensibility | [Plugins and Plugin SDK](./modules/plugins-sdk.md) | Draft | Ready for owner review |
| Administration | [Temporary Users](./modules/temporary-users.md) | Draft | Ready for owner review |
| Platform | [Flutter Mobile Platform](./platform/flutter.md) | Draft | Ready for owner review |
| Platform | [PDF Processor](./platform/pdf-processor.md) | Draft | Ready for owner review |
| Platform | [Load Testing and Performance](./platform/load-testing.md) | Draft | Ready for owner review |
| Platform | [Deployment and Operations](./platform/deployment-operations.md) | Draft | Ready for owner review |
| Cross-cutting | [Code-Level Function and Class Inventory](./code-inventory.md) | Generated | Static source analysis complete |

## Planned Module Register

| Wave | Modules | Status |
|---|---|---|
| A - Foundations and access | Auth, Users, Roles, Permissions, Projects, App Config, Audit, Notifications, Sync, Common | Foundation wave drafts started; review gate pending |
| B - Project definition and planning | WBS, Design, BOQ, Resources, Planning, Micro Schedule, Milestones, Release Strategy, Template Builder | WBS, Design, and BOQ drafts started |
| C - Execution and progress | Execution, Progress, Work Documents, Labor, Dashboard, Customer Milestones | Not started |
| D - Control and compliance | Quality, Snag, EHS, Issue Tracker, Cost and Budget | Not started |
| E - Analytics and extensibility | Executive Dashboard, Dashboard Builder, AI Insights, Admin Data, Custom Tracker, Table View, Plugins, Temporary Users | Not started |
| F - Platform and client operations | Flutter platform, mobile feature parity, retired PDF extractor notes, load testing, deployment and operations | Not started |

## Status Definitions

- `Planned`: scope has not been documented.
- `Draft`: source inspection and first documentation pass are complete.
- `Under review`: technical or business review is active.
- `Approved`: reviewers accepted the document against the current implementation.
- `Needs update`: implementation changed or a review found material gaps.

## Review Record

| Document | Technical reviewer | Business reviewer | Last verified | Next action |
|---|---|---|---|---|
| Authentication | Pending | Pending | 2026-07-20 | Confirm flows, endpoint names, and permission expectations |
| Users | Pending | Pending | 2026-07-20 | Confirm lifecycle states, endpoint names, ownership, and deactivation behavior |
| Roles | Pending | Pending | 2026-07-20 | Confirm role composition, scope, assignment rules, and effective-permission behavior |
| Permissions | Pending | Pending | 2026-07-20 | Confirm permission catalog, evaluation semantics, scope, and enforcement coverage |
| Projects | Pending | Pending | 2026-07-20 | Confirm lifecycle, membership, project isolation, and offline behavior |
| App Config | Pending | Pending | 2026-07-20 | Confirm configuration classes, precedence, scope, caching, and secret handling |
| Audit | Pending | Pending | 2026-07-21 | Confirm event catalog, transaction behavior, retention, access, and redaction |
| Notifications | Pending | Pending | 2026-07-21 | Confirm event catalog, recipient rules, channels, retry policy, and preferences |
| Sync | Pending | Pending | 2026-07-21 | Confirm offline scope, queue model, cursors, conflict rules, and cleanup behavior |
| Common and Shared Services | Pending | Pending | 2026-07-21 | Confirm shared ownership, API/error contracts, security helpers, and regression gates |
| WBS | Pending | Pending | 2026-07-21 | Confirm hierarchy, node types, revisions, downstream links, and import/export rules |
| Design | Pending | Pending | 2026-07-21 | Confirm file types, revision lifecycle, approval rules, storage, and downstream references |
| BOQ | Pending | Pending | 2026-07-21 | Confirm item model, quantity/rate rules, revisions, imports, and downstream consumption |
| Resources | Pending | Pending | 2026-07-21 | Confirm categories, units, capacity, rates, allocation, and usage rules |
| Planning | Pending | Pending | 2026-07-21 | Confirm activity model, scheduling rules, baselines, forecasts, and update behavior |
| Micro Schedule | Pending | Pending | 2026-07-21 | Confirm task relationship, daily/weekly states, field updates, blockers, and reconciliation |
| Milestones | Pending | Pending | 2026-07-21 | Confirm types, baseline/forecast rules, evidence, approvals, and escalation behavior |
| Release Strategy | Pending | Pending | 2026-07-21 | Confirm release scope, readiness gates, exceptions, approvals, and handover behavior |
| Template Builder | Pending | Pending | 2026-07-21 | Confirm template types, generated records, versioning, inheritance, and rollback behavior |
| Execution | Pending | Pending | 2026-07-21 | Confirm work-record model, state transitions, quantities, evidence, offline behavior, and verification |
| Progress | Pending | Pending | 2026-07-21 | Confirm calculation models, evidence, period locks, approvals, corrections, and dashboard outputs |
| Work Documents | Pending | Pending | 2026-07-21 | Confirm document categories, file handling, revisions, evidence links, storage, and offline access |
| Labor | Pending | Pending | 2026-07-21 | Confirm workforce model, assignments, hours, productivity, privacy, approvals, and offline behavior |
| Dashboard | Pending | Pending | 2026-07-21 | Confirm metric ownership, formulas, filters, freshness, drill-downs, permissions, and exports |
| Customer Milestones | Pending | Pending | 2026-07-21 | Confirm customer/contract scope, date rules, approvals, release links, and visibility |
| Quality | Pending | Pending | 2026-07-21 | Confirm inspection model, checklists, evidence, approvals, and release gates |
| Snag | Pending | Pending | 2026-07-21 | Confirm defect lifecycle, assignments, verification, SLAs, and Quality/EHS boundaries |
| EHS | Pending | Pending | 2026-07-21 | Confirm incident taxonomy, sensitive data, escalation, retention, and stop-work rules |
| Issue Tracker | Pending | Pending | 2026-07-21 | Confirm issue categories, status/SLA rules, ownership, links, and escalation |
| Cost and Budget | Pending | Pending | 2026-07-21 | Confirm budget/cost ownership, calculations, actuals, periods, and ERP boundary |
| Executive Dashboard | Pending | Pending | 2026-07-21 | Confirm portfolio KPIs, aggregation, freshness, access, and source lineage |
| Dashboard Builder | Pending | Pending | 2026-07-21 | Confirm widget/data-source model, publishing, permissions, versioning, and rollback |
| AI Insights | Pending | Pending | 2026-07-21 | Confirm providers, data handling, confidence, citations, human review, and retention |
| Admin Data | Pending | Pending | 2026-07-21 | Confirm managed categories, source of truth, scope, validation, and deletion rules |
| Custom Tracker | Pending | Pending | 2026-07-21 | Confirm dynamic fields, links, permissions, versioning, and reporting behavior |
| Table View | Pending | Pending | 2026-07-21 | Confirm data sources, filters, saved views, export limits, and server-side scope |
| Plugins and Plugin SDK | Pending | Pending | 2026-07-21 | Confirm extension points, capabilities, isolation, lifecycle, and approval model |
| Temporary Users | Pending | Pending | 2026-07-21 | Confirm identity linkage, expiry, renewal, scope, session revocation, and retention |
| Flutter Mobile Platform | Pending | Pending | 2026-07-21 | Confirm feature parity, local storage, releases, platform support, and offline scope |
| PDF Processor | Pending | Pending | 2026-07-21 | Confirm operations, limits, ports, storage, health checks, and failure handling |
| Load Testing and Performance | Pending | Pending | 2026-07-21 | Confirm scenarios, thresholds, data volume, monitoring, and regression ownership |
| Deployment and Operations | Pending | Pending | 2026-07-21 | Confirm environments, migrations, secrets, backups, rollback, monitoring, and ownership |
