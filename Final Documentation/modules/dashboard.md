# Dashboard Module

Status: Draft  
Primary wave: C - Execution and Progress  
Related modules: Projects, Planning, Execution, Progress, Milestones, Quality, Snag, EHS, Labor, Cost/Budget, AI Insights, Audit  
Last repository review: 2026-07-21

## 1. Purpose and Scope

The Dashboard module presents project and operational metrics so users can monitor progress, schedule, risk, quality, safety, workforce, cost, and project health.

### In scope

- Project and role-based dashboard views
- KPI cards, charts, tables, trends, and status indicators
- Project, date, WBS, location, and module filters
- Drill-down to authorized source records
- Metric calculation, freshness, refresh, and export behavior

### Out of scope

- Ownership of source records and calculations
- Configurable dashboard construction if owned by Dashboard Builder
- Executive-specific composition if owned by Executive Dashboard
- AI-generated insights, which belong to AI Insights

## 2. System Position

```text
Source modules
    -> metric/query aggregation
    -> dashboard filters and permissions
    -> KPI/chart/table presentation
    -> drill-down, export, and decisions
```

Every important metric must identify its source, calculation period, scope, and freshness.

## 3. Code and Configuration Map

| Layer | Evidence location | Responsibility |
|---|---|---|
| Backend registration | `backend/src/app.module.ts` | Registers Dashboard |
| Backend feature | `backend/src/dashboard/` | Controllers, services, metric queries, and aggregation |
| Web routes/views | `frontend/src/App.tsx` and dashboard views | Layouts, filters, charts, tables, and drill-downs |
| Web services | `frontend/src/services/executive-dashboard.service.ts`, project-health services, related APIs | Dashboard data and health metrics |
| Visualization | `frontend/src/` chart/table components | Shared presentation behavior |
| Mobile consumer | Flutter project/progress/dashboard features | Mobile summaries where supported |

Exact metric ownership, endpoint paths, cache strategy, and Dashboard/Executive Dashboard boundaries must be verified before approval.

## 4. Dashboard and Metric Model

Identify view identifier, owner, audience, project scope, layout, widgets, metric definitions, filters, date range, refresh policy, saved preferences, and access rules.

For each widget/metric, document source module, formula, units, aggregation, target/threshold, freshness, drill-down, and empty/error state.

## 5. Core User Journeys

### 5.1 Open a project dashboard

The user selects a permitted project and view. The system applies project, date, WBS, and role scope before loading metrics and displays data freshness.

### 5.2 Filter and drill down

Users apply filters and select a KPI/chart/table value to reach source records. Drill-down must preserve project scope and authorization.

### 5.3 Monitor an exception

The dashboard highlights late milestones, blocked work, quality/snag issues, EHS risks, labor variance, or cost/progress exceptions with owner, source, and last-update context.

### 5.4 Export or share

Document formats, filter preservation, redaction, permissions, generated-file retention, and whether sharing is a snapshot or live link.

## 6. Metric and Data Rules

Confirm baseline/current-plan/actual/forecast definitions, date/timezone behavior, WBS/project aggregation, treatment of missing or unverified records, freshness/cache duration, threshold rules, rounding, units, currency, and permission filtering before aggregation.

Dashboard calculations should reuse canonical source definitions rather than creating different business meanings.

## 7. API Contract to Confirm

| Method | Path | Permission | Request | Response | Side effects |
|---|---|---|---|---|---|
| To verify | Get dashboard/view | Dashboard view | Project and view identifier | Layout/widgets | None |
| To verify | Get dashboard metrics | Dashboard view | Filters and date range | Metric data | None |
| To verify | Get project health | Project view | Project/filter context | Health indicators | None |
| To verify | Drill-down records | Source permission | Widget/filter context | Authorized records | None |
| To verify | Export dashboard | Dashboard export | View, filters, format | File/snapshot | Export audit if configured |

For each confirmed endpoint, document calculation timing, scope, caching, pagination, partial failures, and errors.

## 8. Data Model and Relationships

Identify links to Projects, WBS, Planning, Execution, Progress, Milestones, Quality, Snag, EHS, Labor, Cost/Budget, Notifications, AI Insights, and Audit.

Each metric should trace to source records and specify whether it is live, cached, materialized, or snapshot-based.

## 9. Security and Permissions

- Enforce project/resource scope before metric aggregation.
- Do not expose restricted counts or trends through charts or totals.
- Apply source-module permissions to drill-downs and exports.
- Protect commercially sensitive cost, workforce, customer, and safety information.
- Audit dashboard administration, sensitive views, and exports where required.
- Do not treat hidden client widgets as authorization.

## 10. Integrations and Consumers

### Upstream dependencies

- Projects, WBS, Planning, Execution, Progress, Milestones
- Quality, Snag, EHS, Labor, Cost/Budget
- Auth, Roles, Permissions, App Config, and Audit

### Downstream consumers

- Project managers and operational teams
- Executive Dashboard and AI Insights
- Notifications, reports, web, and Flutter dashboards

## 11. Testing Checklist

- Load dashboards within project permissions
- Apply project, WBS, date, location, and status filters
- Calculate metrics consistently with source modules
- Display freshness and empty/error states
- Drill down only to authorized records
- Handle stale, rejected, missing, and partial source data
- Preserve baseline/current/actual/forecast semantics
- Export filtered results with correct redaction
- Verify responsive web/mobile layouts where supported
- Prevent leakage through aggregates or tooltips
- Record sensitive dashboard access and exports

## 12. Open Questions for Approval

1. Which metrics belong to Dashboard versus Executive Dashboard or Dashboard Builder?
2. What are the canonical formulas and owners for health/KPI values?
3. What is the data freshness and cache policy?
4. Which filters apply globally across widgets?
5. How are unverified or rejected progress records treated?
6. Which roles can view, configure, export, or share dashboards?
7. Are dashboards live, cached, or snapshot-based?
8. Which mobile dashboard views are supported?
9. How are metric changes versioned and communicated?
10. Which charts or totals require data-lineage support?

## 13. Traceability

- Application registration: `backend/src/app.module.ts`
- Backend implementation: `backend/src/dashboard/`
- Web service relationships: `frontend/src/services/executive-dashboard.service.ts`, project-health services
- Project reference: `Final Documentation/modules/projects.md`
- Progress reference: `Final Documentation/modules/progress.md`
- Milestones reference: `Final Documentation/modules/milestones.md`
- Permission reference: `Final Documentation/modules/permissions.md`
- Audit reference: `Final Documentation/modules/audit.md`

