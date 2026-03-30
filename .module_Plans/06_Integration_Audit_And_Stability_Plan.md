# Integration Audit and Stability Plan

## Audit Objective

Audit the current backend/frontend integration health, identify live drift risks, and define a safe rollout path that avoids breaking the working web application.

---

## Current Health Findings

### 1. Backend build health

Observed:

- `npm --prefix backend run build` is currently blocked by a local filesystem lock in `backend/dist`
- the failing symptom is:
  - `EBUSY: resource busy or locked, unlink ... project-progress-summary.source.js.map`

Assessment:

- this is a local runtime/build artifact lock, not proof of a TypeScript code failure
- build verification should prefer non-destructive type validation or be rerun after the locking process is released

### 2. Frontend health

Observed:

- the repo still has known frontend lint/type debt outside the recently touched dashboard and planning files
- this means “full app clean build” is not currently a reliable gate for every isolated change

Assessment:

- we need scoped verification on touched modules plus cautious rollout
- shared foundations should be added in a way that does not force unrelated pages to compile-clean first

### 3. Notification integration coverage

Confirmed existing push integration only in a small set of modules:

- planning
- release strategy
- quality
- quality inspection workflow
- EHS

Gap:

- notification phrasing and context are inconsistent
- not all approval-driven modules share the same recipient resolution or message style

### 4. Import/export coverage

Confirmed:

- import and export capability exists, but is fragmented and module-specific
- there is no uniform import/export contract across all data grids and modules

Gap:

- no single staged CSV import workflow
- no universal export menu behavior

### 5. Project lifecycle drift

Confirmed:

- `dashboard-executive.service.ts` already filtered out closed/completed/archived projects
- `dashboard.service.ts` still returned `activeProjects: totalProjects`

Status:

- fixed in this implementation wave by introducing a shared lifecycle helper

### 6. 3D fallback gap

Confirmed:

- the 3D viewer had hierarchy fallback only if some polygon existed
- no synthetic geometry existed for projects with zero coordinate data

Status:

- safe synthetic fallback geometry has now been introduced in the viewer for the no-coordinate case

---

## Stability Risks

### High-risk areas

- progress, approvals, and quantity integrity
- schedule/WO/micro linkage
- financial burn and dashboard aggregation
- broad schema changes for import frameworks

### Low-risk areas

- synthetic 3D geometry fallback
- lifecycle helper centralization
- notification message composition foundation
- shared export UI utilities

---

## Recommended Safe Rollout

### Wave 1: Stabilize shared infrastructure

1. shared project lifecycle helper
2. notification context/composer layer
3. shared export contracts and UI helpers
4. synthetic 3D fallback geometry

### Wave 2: Improve integrations without changing business rules

1. clearer notification text and recipient routing
2. export coverage for highest-value modules
3. active vs closed project filtering in selectors and dashboards

### Wave 3: Bulk import standardization

1. staged CSV import framework
2. BOQ, schedule, work order, and labor adapters

---

## What Was Auto-Implemented in This Audit Pass

### Implemented

1. Shared project lifecycle utility
   - `backend/src/common/project-lifecycle.util.ts`

2. Dashboard summary alignment
   - `backend/src/dashboard/dashboard.service.ts`
   - `backend/src/dashboard/dashboard-executive.service.ts`

3. Synthetic 3D no-coordinate fallback
   - `frontend/src/components/planning/BuildingProgress3DTab.tsx`

### Not yet implemented in this pass

1. centralized notification composer
2. staged CSV import framework
3. module-wide export registry
4. closeout filtering in all frontend project selectors

---

## Verification Strategy

### Immediate checks

- scoped backend verification after build lock is released
- manual dashboard summary validation for active vs closed projects
- manual 3D viewer validation on a project with no coordinates

### Next checks

- notification context unit tests once composer layer is added
- export smoke tests on BOQ, work orders, planning, and progress tables
- lifecycle regression check on dashboard selectors and project lists

