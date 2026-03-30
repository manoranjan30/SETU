# SETU Site-Wide Module Scan, Gap Analysis, and Rollout Blueprint

## Objective

Deliver a safe, staged rollout for these cross-cutting capabilities without breaking working systems:

1. User-wise and role-wise push notifications based on project permissions and approval authority
2. Clear notification text with project, floor, tower, and business context instead of raw ids
3. Bulk CSV import across modules
4. Excel/CSV export across all major table views and modules
5. 3D progress fallback geometry when no coordinates exist
6. Project lifecycle closeout that moves closed projects out of active lists

This document is the master scan and dependency-aware rollout plan. Focused plans live in companion files in this folder.

---

## Codebase Scan Summary

### Backend module inventory scanned

- `auth`
- `users`
- `roles`
- `permissions`
- `eps`
- `projects`
- `wbs`
- `planning`
- `boq`
- `workdoc`
- `execution`
- `progress`
- `micro-schedule`
- `resources`
- `labor`
- `design`
- `quality`
- `ehs`
- `milestone`
- `dashboard`
- `dashboard-builder`
- `notifications`
- `ai-insights`
- `audit`
- `common`
- `template-builder`
- `snag`
- `plugins`

### Frontend areas scanned

- dashboard views
- sidebar and notification surfaces
- planning and building line 3D pages
- progress and execution pages
- import/export utilities
- work order, BOQ, quality, labor, and schedule import UIs
- dashboard builder screens

---

## Existing Strengths

### Notifications

- `backend/src/notifications/push-notification.service.ts` already supports:
  - direct user push
  - project-role push
  - project-permission push
- quality, planning, release strategy, and EHS modules already call the push service
- project assignment and role resolution already exist through `UserProjectAssignment`

### Import/Export

- several modules already have import points:
  - BOQ import
  - WBS/schedule import
  - work order Excel import
  - quality checklist import
  - labor import
- several isolated exports already exist:
  - schedule version export
  - BOQ templates
  - some CSV export helpers in frontend cost/planning widgets

### 3D / Building Lines

- building-line structure service already builds a hierarchical EPS structure with coordinates and floor snapshots:
  - `backend/src/planning/building-line-coordinate.service.ts`
- 3D renderer already has hierarchy-level fallback behavior:
  - room -> unit -> floor -> tower -> block -> project polygon fallback
- progress overlays and tower/floor aggregation are already integrated into the viewer

### Project status / closeout

- executive dashboard already has one active-project filter:
  - `dashboard-executive.service.ts`
  - excludes `completed`, `closed`, `archived`
- project status is already stored on `ProjectProfile.projectStatus`

---

## Primary Gaps by Initiative

### Initiative A: Notifications

Current gaps:

- notification delivery is available, but message composition is decentralized and inconsistent
- payloads are often too generic
- approval hierarchy notifications are not consistently generated from workflow authority definitions
- some modules still maintain parallel in-app notification patterns instead of a shared notification contract
- human-readable project/tower/floor labels are not guaranteed in push content

Solution direction:

- introduce a central notification context/composer layer
- resolve project, EPS, tower, floor, activity, WO, inspection, issue, and document names before sending
- standardize approval-authority driven recipient resolution
- unify push plus in-app event records where required

### Initiative B: Bulk CSV import

Current gaps:

- imports are module-specific and format-specific
- CSV import is not a consistent first-class pattern
- no common staging, validation, preview, or error-report pattern
- auditability differs by module

Solution direction:

- create a shared bulk import framework:
  - upload
  - mapping
  - preview
  - validate
  - commit
  - reject report
- adopt module adapters rather than one giant importer

### Initiative C: Excel/CSV export across modules

Current gaps:

- export exists only in scattered screens
- no common “export current grid/table” contract
- server-side full-data exports and client-side current-view exports are mixed inconsistently
- some modules have no export at all

Solution direction:

- define shared export modes:
  - current filtered grid
  - full dataset for current module scope
  - template download where import exists
- add one export service/registry so every major table can opt in consistently

### Initiative D: 3D fallback geometry

Current gaps:

- if there are no coordinates at any level, the 3D view cannot synthesize a model
- current renderer only falls back to inherited polygons, not generated geometry

Solution direction:

- synthesize default tower/floor boxes when no coordinate data exists
- use fixed defaults:
  - 30m x 40m footprint
  - 3m floor height
  - 5m inter-tower spacing

### Initiative E: Project lifecycle closeout

Current gaps:

- active/closed filtering is partially implemented, not centralized
- project closeout does not appear to propagate consistently to selectors, sidebars, dashboards, and operational lists
- there is no clearly shared “is active project” helper across the stack

Solution direction:

- centralize lifecycle status evaluation
- expose active vs closed project queries consistently
- keep closed projects visible in history/reporting but remove them from active operational lists

---

## Module-by-Module Gap Analysis and Solution Direction

| Module | Current Gap | Proposed Solution |
|---|---|---|
| `auth` | No central notification preference awareness; project selection may still include closed projects via assignments | add project-active filtering hooks and notification preference checks later |
| `users` | only stores FCM token, no notification preference model | add notification preference/profile table in later phase |
| `roles` | role model exists but no explicit notification routing metadata | leverage existing role-permission graph first, extend only if needed |
| `permissions` | permission checks exist, but no notification authority abstraction | introduce permission-to-notification routing map |
| `eps` | EPS hierarchy exists, but human-readable notification context is not consistently built from it | add EPS context resolver for project/block/tower/floor display strings |
| `projects` | no central active-vs-closed project query surface | add shared lifecycle filters for project lists and selectors |
| `wbs` | import/export partially exists; no CSV-first adapter | add bulk import/export adapters for WBS/activity lists |
| `planning` | rich data but fragmented import/export and notification phrasing; 3D lacks synthetic geometry fallback | add planning import/export adapter set, notification composer integration, and synthetic geometry support |
| `boq` | import exists, export inconsistent, CSV not standardized | add export endpoints and CSV import adapter through shared framework |
| `workdoc` | Excel import exists, exports and CSV are inconsistent, notifications around approvals limited | add bulk import/export adapters and approval notification context |
| `execution` | notifications and exports are not standardized; progress-related alerts need project/floor wording | use central notification composer and table export adapters |
| `progress` | dashboard and history exports limited; approval notifications not fully standardized | add export adapters and notification templates |
| `micro-schedule` | import path is manual/UI-first; exports limited | add CSV import/export after core framework lands |
| `resources` | no obvious bulk import/export standard | attach to shared grid export and staged CSV import |
| `labor` | import exists, export not standardized | reuse shared framework for CSV import/export |
| `design` | register exists, export/import not standardized, approval notifications can be clearer | add export endpoints and notification context for drawing/project/floor/package |
| `quality` | several flows already notify, but wording is generic and export coverage is inconsistent | migrate to central composer and standardized exports |
| `ehs` | similar to quality: notifications exist, export/import uneven | migrate to central composer and export coverage |
| `milestone` | customer milestones benefit from project lifecycle filtering and exports | add export coverage and closed-project scoping |
| `dashboard` | uses mixed data derivations and inconsistent project-activity active scope logic | consume central lifecycle helper and new export-ready datasets |
| `dashboard-builder` | no unified table export/import widget contract | add export-capable datasource registry and active-project filtering |
| `notifications` | push transport exists, but not a domain event + formatting platform | turn into a notification orchestration module |
| `ai-insights` | can surface import/export/notification summaries later, but not primary blocker | add integration in later wave after core infrastructure |
| `audit` | logs import/export actions already, but not uniformly used by all modules | hook shared import/export framework into audit automatically |
| `common` | lacks shared grid export/import abstractions | add reusable DTOs, helpers, and result contracts |
| `template-builder` | not a priority for these initiatives | no immediate change |
| `snag` | closeout workflow exists, export/notification consistency is still partial | fold into notification/export wave later |
| `plugins` | out of direct scope | no immediate change |

---

## Recommended Rollout Order

### Wave 1: Safe shared foundations

1. Create shared planning pack and standards
2. Add project lifecycle helper
3. Add notification context/composer service
4. Add grid export registry contracts
5. Add staged CSV import framework contracts
6. Add synthetic 3D fallback geometry helper

### Wave 2: Low-risk visible wins

1. 3D no-coordinate fallback
2. project closeout filtering in executive dashboard, selectors, and active lists
3. standardized export buttons for high-value modules:
   - BOQ
   - Work Orders
   - Progress
   - Planning grids
4. notification clarity improvements for existing push flows

### Wave 3: Bulk import standardization

1. BOQ CSV import adapter
2. WBS/Schedule CSV import adapter
3. Work Order CSV import adapter
4. Labor CSV import adapter
5. Quality/EHS structured import adapters

### Wave 4: Authority-aware notifications

1. project/role/permission aware routing standardization
2. approval-authority recipient resolution
3. notification preference model
4. in-app notification center unification

### Wave 5: Long-tail module coverage

1. design exports/imports
2. milestone exports/imports
3. dashboard-builder export-enabled datasets
4. remaining support modules

---

## Dependency Graph

- Lifecycle helper should land before broad project closeout rollout
- Notification context resolver should land before reworking module-specific push messages
- Shared export registry should land before module-by-module export retrofits
- Shared import staging framework should land before CSV adapters
- Synthetic 3D fallback can be implemented independently and early

Parallelizable workstreams after foundations:

- notification standardization
- import/export rollout
- project closeout filtering
- dashboard-builder exposure

---

## Anti-Patterns to Avoid

- importing CSV directly into live tables without staging/preview
- sending push messages with raw ids or partial context
- implementing export separately in every screen without a shared contract
- hard-coding project active-status logic in multiple frontends and services
- generating synthetic 3D geometry in inconsistent places instead of a single fallback strategy

---

## Recommended First Implementation Line

Start with the safest isolated feature:

### First implementation

Implement synthetic 3D fallback geometry when no coordinates exist anywhere in the project hierarchy.

Why first:

- isolated to planning 3D flow
- no schema migration required
- no risk to approvals, financials, or existing transactional modules
- immediate user-visible value
- creates a reusable foundation for dashboards and project previews

Follow immediately with:

1. central project lifecycle helper
2. notification context composer
3. export registry groundwork

---

## Companion Documents

- `01_Notifications_Gap_Analysis.md`
- `02_Bulk_Import_Export_Gap_Analysis.md`
- `03_3D_Fallback_Geometry_Plan.md`
- `04_Project_Lifecycle_Closeout_Plan.md`
- `05_Implementation_Waves_And_Verification.md`

