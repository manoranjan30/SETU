# Executive Dashboard Module

Status: Draft  
Primary wave: E - Analytics and Extensibility  
Related modules: Dashboard, Projects, Progress, Milestones, Quality, EHS, Cost/Budget, AI Insights, Audit

## Purpose

Provides portfolio and executive-level views of project health, delivery, schedule, cost, quality, safety, and risk.

## Documentation Requirements

Document portfolio scope, executive roles, KPI definitions, aggregation across projects, data freshness, thresholds, drill-down limits, snapshot/export behavior, and source lineage. Distinguish executive metrics from operational Dashboard metrics.

## Code and Review

Inspect backend executive-dashboard capability, `frontend/src/services/executive-dashboard.service.ts`, dashboard routes/views, and chart components. Confirm permission filtering before aggregation, cached/materialized data, and sensitive commercial/customer visibility.

## Testing and Decisions

Test cross-project aggregation, project isolation, stale/partial source data, exports, responsive views, and audit. Confirm canonical KPI owners, portfolio hierarchy, refresh SLA, and mobile support.

