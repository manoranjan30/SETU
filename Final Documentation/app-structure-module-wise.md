# SETU App Structure - Module Wise Documentation

## 1. Product Architecture Overview

SETU is structured as a construction project management platform with three main application surfaces and supporting tools:

- `backend/`: NestJS API server, PostgreSQL persistence through TypeORM, auth, permissions, project modules, uploads, reports, plugins, and integrations.
- `frontend/`: React 19 + Vite web application for desktop/admin/project workflows.
- `flutter/`: Flutter mobile application for site users, offline-friendly field workflows, QR flows, media capture, and push notifications.
- `plugins-sdk/`: Plugin packaging/validation SDK with sample plugin manifests.
- `load-tests/`: k6 load testing suite and generated reports.
- Docker files: root-level orchestration for local/dev/container deployments.

The backend is the system of record. The web and mobile clients consume backend APIs, enforce route-level permissions in UI, and use service layers to call domain endpoints.

## 2. Root Repository Layout

| Path | Purpose |
| --- | --- |
| `backend/` | NestJS API, TypeORM entities, controllers, services, migrations, tests, uploaded files, and built frontend client assets in `backend/client/`. |
| `frontend/` | React/Vite web app with route modules, project dashboards, admin screens, reusable components, API services, theme, and mobile web shell under `src/mobile/`. |
| `flutter/` | Native/mobile Flutter app using BLoC, Dio, local storage, background sync, camera/media, notifications, and feature-first folders. |
| `plugins-sdk/` | Plugin package tooling and sample plugin definitions for pages, menus, widgets, reports, workflows, settings, and permissions. |
| `load-tests/k6/` | k6 scenarios for smoke auth, planning reads, progress reads/writes, dashboard, design, and mixed read workloads. |
| `docs/` | Existing project documentation groups such as Azure, plugins, security, and superpowers docs. |
| `plans/`, `.module_Plans/`, root `*-plan.md` files | Implementation plans and module-specific work notes. |
| `docker-compose.yml` | Production-like composition: Postgres and combined app container. |
| `docker-compose.dev.yml` | Dev composition: separate backend and frontend services with Postgres. |
| `Dockerfile` | Multi-stage application build used by compose files. |

## 3. Backend Application Structure

### 3.1 Backend Technology Stack

- Framework: NestJS 11.
- Database: PostgreSQL 15 with TypeORM 0.3.
- Auth: JWT, Passport local/JWT strategies, bcrypt.
- Scheduling/background: Nest schedule, cron.
- File/document handling: Multer, PDF libraries, XLSX, XML parsing, QR code generation.
- Notifications: Firebase Admin, notification log storage.
- API docs: Swagger packages are installed.
- Static serving: backend serves built frontend assets from `client/` and uploads from `/uploads`.

### 3.2 Backend Entry Points

| File | Responsibility |
| --- | --- |
| `backend/src/main.ts` | Nest bootstrap entry point. |
| `backend/src/app.module.ts` | Root module. Registers database connection, all TypeORM entities, static file serving, and every domain module. |
| `backend/src/app.controller.ts` | Root app controller. |
| `backend/src/data-source.ts` | TypeORM CLI/migration data source. |
| `backend/migrations/` | SQL migration assets, including micro-schedule tables and rollback. |
| `backend/scripts/` | Operational/debug scripts for migrations, project data, checks, and repair utilities. |

### 3.3 Backend Domain Modules

| Module | Path | Main Responsibility |
| --- | --- | --- |
| App | `backend/src/app.module.ts` | Root composition, database entity registry, static serving, seed service, and module wiring. |
| Admin Data | `backend/src/admin-data/` | Data correction and maintenance console support. |
| AI Insights | `backend/src/ai-insights/` | AI model configuration, insight templates, insight runs, data aggregation, and providers such as Azure OpenAI/OpenRouter. |
| App Config | `backend/src/app-config/` | Runtime application configuration stored in DB. |
| Audit | `backend/src/audit/` | Audit log entity, interceptor, decorators, audit module map, and audit APIs. |
| Auth | `backend/src/auth/` | Login, JWT auth, local/JWT strategies, OTP challenge, role/permission guards, and auth decorators. |
| BOQ | `backend/src/boq/` | BOQ elements/items/sub-items, measurements, progress quantities, imports, and scope APIs. |
| Common | `backend/src/common/` | Shared platform APIs: uploads, table views, system settings, export presets/history, approval runtime, path utilities, mobile cache headers. |
| Dashboard | `backend/src/dashboard/` | Standard dashboard and executive dashboard services/controllers. |
| Dashboard Builder | `backend/src/dashboard-builder/` | Custom dashboards, widgets, templates, assignments, reports, schedules, data source registry, and query executor. |
| Design | `backend/src/design/` | Drawing categories, drawing register, revisions, open receipts, design document workflows. |
| EHS | `backend/src/ehs/` | Observations, incidents, environmental data, training, manhours, inspections, legal register, machinery, vehicles, competency, project config. |
| EPS | `backend/src/eps/` | Enterprise/project structure tree, project profiles, user-role-node assignments. |
| Execution | `backend/src/execution/` | Execution context, progress entries, progress adjustments, validation, breakdowns, approval-facing execution flows. |
| Labor | `backend/src/labor/` | Labor categories, daily labor presence, activity labor updates, Excel mappings. |
| Micro Schedule | `backend/src/micro-schedule/` | Micro schedules, micro activities, daily logs, quantity ledgers, delay reasons. |
| Milestone | `backend/src/milestone/` | Customer milestone templates, activity links, achievements, flat sale info, collection tranches. |
| Notifications | `backend/src/notifications/` | Push notifications, pending tasks, notification composition/context, notification log. |
| Permissions | `backend/src/permissions/` | Permission entity, permission controller/service, create permission DTOs. |
| Planning | `backend/src/planning/` | Schedule planning, versions, activity plans, recovery plans, release strategy, budgets, project health, custom trackers, issue tracker, cost, building line coordinates, planning extensions. |
| Plugins | `backend/src/plugins/` | Plugin package registry, installs, permissions, menus, pages, widgets, reports, workflows, settings, audit logs, runtime APIs. |
| Progress | `backend/src/progress/` | Progress dashboard/reporting APIs separate from write-oriented execution APIs. |
| Projects | `backend/src/projects/` | Project assignment and team audit management. |
| Quality | `backend/src/quality/` | Quality dashboard, inspections, material tests/ITP, checklists, activity lists, sequencing, workflow designer, signatures, observations, NCR sync, ratings, pour cards, cube tests, inspection attachments. |
| Resources | `backend/src/resources/` | Resource masters, analysis templates, analysis coefficients for planning/cost/resource workflows. |
| Roles | `backend/src/roles/` | Roles, action presets, role templates, role presets, role-template APIs. |
| Snag | `backend/src/snag/` | Snag lists, rounds, items, photos, release approvals, approval steps. |
| Sync | `backend/src/sync/` | Sync API for mobile/offline data exchange. |
| Temp User | `backend/src/temp-user/` | Temporary/vendor users, temp role templates, expiry cron, temp auth guard. |
| Template Builder | `backend/src/template-builder/` | PDF template entity, template builder APIs, visual/coordinate template support. |
| Users | `backend/src/users/` | User entity, user controller/service, create user DTO. |
| WBS | `backend/src/wbs/` | WBS tree, activities, relationships, schedule imports, calendars, work weeks, WBS templates, CPM service. |
| WorkDoc | `backend/src/workdoc/` | Vendors, work orders, work order items, BOQ mappings, work document templates. |

### 3.4 Backend Supporting Folders

| Path | Purpose |
| --- | --- |
| `backend/src/config/` | Feature/config constants. |
| `backend/src/database/` | Seed service and seed SQL. |
| `backend/src/migrations/` | Source-level migration helpers if used by app code. |
| `backend/src/test-utils/` | Backend test utilities. |
| `backend/test/` | Jest e2e config and app e2e spec. |
| `backend/client/` | Built frontend assets served by Nest in container/production mode. |
| `backend/uploads/` | Runtime upload storage mounted in Docker. |

### 3.5 Backend API Surface by Controller

The backend exposes controllers for:

- Core/auth/admin: `app`, `auth`, `users`, `roles`, `role-presets`, `role-templates`, `permissions`, `audit`, `app-config`, `admin-data`.
- Project setup: `eps`, `projects`, `wbs`, `wbs-template`, `schedule`, `calendars`, `boq`, `resources`, `workdoc`.
- Execution/progress: `execution`, `progress`, `labor`, `micro-schedule`, `sync`.
- Planning: `planning`, `planning-extension`, `budget`, `cost`, `custom-tracker`, `project-health`.
- Quality/EHS/design: `quality`, `quality-activity`, `quality-inspection`, `quality-pour-card`, `quality-rating`, `quality-sequencer`, `approval-workflow`, `checklist-template`, `material-itp`, `site-observation`, `ehs`, `ehs-observation`, `design`, `snag`.
- Dashboards/reports/plugins: `dashboard`, `dashboard-builder`, `plugins`, `ai-insights`.
- Utilities: `upload`, `table-view`, `system-settings`, `export-preset`, `export-history`, `pending-tasks`, `template-builder`, `temp-user`, `temp-role`, `customer-milestone`, `admin-issue-tracker`.

## 4. Frontend Application Structure

### 4.1 Frontend Technology Stack

- React 19 with TypeScript.
- Vite 7 build/dev server.
- React Router 7.
- Axios API client.
- AG Grid, React Grid Layout, React Window, Recharts.
- Three.js for 3D/progress visualizations.
- Konva/React Konva for visual editing/annotation.
- PDF/DXF/XLSX parsing support.
- Lucide React icons.

### 4.2 Frontend Entry Points

| File | Responsibility |
| --- | --- |
| `frontend/src/main.tsx` | React bootstrap entry. |
| `frontend/src/App.tsx` | Router definition, auth provider, plugin runtime provider, protected routes, lazy-loaded pages. |
| `frontend/src/DashboardRouter.tsx` | Dashboard landing/router logic. |
| `frontend/src/api/axios.ts` | Axios instance/API transport setup. |
| `frontend/src/api/baseUrl.ts` | API base URL configuration. |
| `frontend/src/context/AuthContext.tsx` | Authentication state and permission checks. |
| `frontend/src/context/PluginRuntimeContext.tsx` | Plugin runtime integration. |
| `frontend/src/context/ThemeContext.tsx` | Theme state. |

### 4.3 Frontend Top-Level Folders

| Path | Purpose |
| --- | --- |
| `frontend/src/api/` | HTTP client and base URL configuration. |
| `frontend/src/assets/` | Static frontend assets. |
| `frontend/src/components/` | Reusable and domain-specific components. |
| `frontend/src/config/` | Menu, permission, and quality rating config. |
| `frontend/src/context/` | React context providers for auth, plugins, theme. |
| `frontend/src/mobile/` | Mobile web shell and mobile CSS for `/m/*` routes. |
| `frontend/src/pages/` | Route-level pages for project/admin/main modules. |
| `frontend/src/services/` | API service wrappers grouped by domain. |
| `frontend/src/theme/` | Design tokens, chart colors, AG Grid theme. |
| `frontend/src/types/` | Shared TypeScript domain types. |
| `frontend/src/utils/` | Formatting, exports, imports, lifecycle utilities. |
| `frontend/src/views/` | Larger module dashboards and subviews. |

### 4.4 Frontend Route Modules

The main web app mounts under `/dashboard` after login, with protected route checks using permission keys.

| Route Area | Main Routes / Pages |
| --- | --- |
| Auth | `/login`, `/m/login`. |
| Mobile Web | `/m/*` loads `MobileApp`. |
| Dashboard Home | `/dashboard` loads `DashboardRouter`. |
| Admin/User Management | `/dashboard/users`, `/dashboard/roles`, `/dashboard/permissions`, `/dashboard/admin/settings`, `/dashboard/admin/logs`, `/dashboard/admin/data-maintenance`. |
| EPS & Project Setup | `/dashboard/eps`, project WBS, BOQ, calendars, templates. |
| Planning | `/dashboard/projects/:projectId/planning`, compare, vendor temp users, issue tracker, planning reports/actions/health/cost/budget pages. |
| Execution & Progress | `/dashboard/execution`, project execution mapper, progress dashboard, approvals. |
| Labor | Project manpower route redirects into planning manpower view; labor components support imports, entry, categories, allocation. |
| EHS | `/dashboard/projects/:projectId/ehs` with EHS dashboard/subviews. |
| Quality | Project quality dashboard, activity lists, inspection requests, approvals, sequence manager, sequencer, workflow designer. |
| Design | Project design dashboard and drawing register flows. |
| WorkDoc/Vendor Mapping | Project vendor mapping and work document components. |
| Dashboard Builder | Admin dashboard builder home, dashboard designer, dashboard viewer. |
| Report Builder | Admin report list, create/edit designer, report viewer. |
| Plugins | Plugin registry and runtime host routes, both global and project-scoped. |
| AI Insights | Insights list, run result view, admin configuration. |
| Profile/Mobile Download | User profile and mobile app download page. |

### 4.5 Frontend Domain Components

| Component Area | Path | Responsibility |
| --- | --- | --- |
| Layout | `components/layout/` | Sidebar and primary app navigation. |
| Common | `components/common/` | Tree, theme picker, modal, image modal, signature pad, EPS location picker, back button. |
| BOQ Resources | `components/boq/resources/` | Resource master, mapping, analysis template details, summary views. |
| WBS/Schedule | `components/wbs/`, `components/schedule/` | WBS modals, imports, activity list, schedule table/import, Gantt chart. |
| Planning | `components/planning/` | Dashboard, matrix, execution view, look-ahead, gap analysis, 3D progress panels, distributor/mapper/cost/version submodules. |
| Execution | `components/execution/` | Vendor progress pane and execution breakdown modal. |
| Labor | `components/labor/` | Labor import, entry, category, and allocation UI. |
| Quality | `components/quality/`, `views/quality/` | Quality dashboards, approvals, inspection requests, sequencer, workflow, attachments, signature, annotation, checklist import. |
| WorkDoc | `components/workdoc/` | Work order management, vendor management, template designer/editor, BOQ linkage, Excel import, allocation review. |
| Template Builder | `components/template-builder/` | PDF template editor, test panel, properties panel, zone overlay. |
| Dashboard Builder | `views/dashboard-builder/` | Dashboard/report builders, viewers, widget renderer/config panel, widget library. |
| Design | `views/design/` | Design dashboard, drawing register, upload, preview, revision history, CAD viewer. |
| EHS | `views/ehs/` | EHS dashboard and subviews for observation, incident, performance, training, machinery, environmental, legal, competency, manhours. |

### 4.6 Frontend Services

API service wrappers are grouped under `frontend/src/services/`:

- `aiInsights.service.ts`
- `boq.service.ts`
- `budget.service.ts`
- `buildingLineCoordinates.service.ts`
- `cost.service.ts`
- `customerMilestone.service.ts`
- `customTracker.service.ts`
- `dashboard-builder.service.ts`
- `execution.service.ts`
- `executive-dashboard.service.ts`
- `issueTracker.service.ts`
- `micro-schedule.service.ts`
- `notification.service.ts`
- `planning.service.ts`
- `planning-extension.service.ts`
- `plugin.service.ts`
- `project-health.service.ts`
- `quality.service.ts`
- `releaseStrategy.service.ts`
- `snag.service.ts`
- `table-view.service.ts`
- `tempUser.service.ts`
- `work-doc.service.ts`

## 5. Flutter Mobile Application Structure

### 5.1 Mobile Technology Stack

- Flutter SDK `>=3.2.0 <4.0.0`.
- State management: `flutter_bloc`, `equatable`.
- Networking: `dio`, `pretty_dio_logger`, `dio_cache_interceptor`.
- Storage/offline: Drift/SQLite, Hive, secure storage, shared preferences.
- Navigation: `go_router`.
- Media: camera, image picker, file picker, image compression/cropper, PDF rendering, signature capture.
- Background/connectivity: workmanager, connectivity_plus.
- Notifications: Firebase Messaging and local notifications.
- QR/server setup: mobile_scanner, app links.

### 5.2 Flutter Entry Points

| File | Responsibility |
| --- | --- |
| `flutter/lib/main.dart` | Mobile app bootstrap. |
| `flutter/lib/app.dart` | Main app shell/routing composition. |
| `flutter/lib/injection_container.dart` | Dependency injection setup. |

### 5.3 Flutter Feature Modules

| Feature | Path | Responsibility |
| --- | --- | --- |
| Auth | `flutter/lib/features/auth/` | Login, OTP verification, auth bloc, user model. |
| Projects | `flutter/lib/features/projects/` | Project selection/context. |
| Planning | `flutter/lib/features/planning/` | Planning models, phase 2 models, micro schedule models. |
| Progress | `flutter/lib/features/progress/` | Progress entry, approvals, progress BLoC, progress models, execution breakdown. |
| Quality | `flutter/lib/features/quality/` | Quality dashboard, requests, approvals, site observations, inspections, activity/floor/tower flows, snag, pour card, cube register, NCR register, signatures, attachment picking, annotation-related widgets. |
| EHS | `flutter/lib/features/ehs/` | EHS hub, incidents, observations, dashboard models, EHS BLoCs. |
| Design | `flutter/lib/features/design/` | Design register models/pages/BLoC. |
| Labor | `flutter/lib/features/labor/` | Labor presence page, labor models, labor BLoC. |
| Profile | `flutter/lib/features/profile/` | User profile page and BLoC. |
| Sync | `flutter/lib/features/sync/` | Sync log and offline sync visibility. |
| Server Setup | `flutter/lib/features/server_setup/` | Server setup and QR scanner pages. |
| Settings | `flutter/lib/features/settings/` | Offline data/settings page. |
| Tower Lens | `flutter/lib/features/tower_lens/` | Tower/floor render models and view modes. |

## 6. Retired External PDF Extractor

The former Python PDF extractor sidecar has been removed from active SETU setup. Current PDF behavior is owned inside the relevant app modules, such as Quality PDF reports, Design previews, Work Document uploads, and Template Builder manual zone configuration.

## 7. Plugin SDK Structure

| Path | Purpose |
| --- | --- |
| `plugins-sdk/validate-plugin.ts` | Validates plugin package structure/manifests. |
| `plugins-sdk/pack-plugin.ts` | Packs plugin definitions. |
| `plugins-sdk/inspect-plugin.ts` | Inspects plugin packages. |
| `plugins-sdk/examples/sample-report-plugin/` | Example plugin with manifests for reports, widgets, pages, menus, permissions, workflows, settings. |
| `plugins-sdk/examples/sample-project-insights-plugin/` | Example project insights plugin including `plugin.bundle.json`. |

Backend plugin runtime entities live in `backend/src/plugins/entities/`, and frontend runtime host pages live under `frontend/src/pages/plugins/` and `frontend/src/context/PluginRuntimeContext.tsx`.

## 8. Load Testing Structure

| Path | Purpose |
| --- | --- |
| `load-tests/k6/scenarios/smoke-auth.js` | Authentication smoke test. |
| `load-tests/k6/scenarios/planning-read.js` | Planning read workload. |
| `load-tests/k6/scenarios/progress-read.js` | Progress read workload. |
| `load-tests/k6/scenarios/progress-write-approve.js` | Progress write/approval workload. |
| `load-tests/k6/scenarios/dashboard.js` | Dashboard workload. |
| `load-tests/k6/scenarios/design-read.js` | Design module read workload. |
| `load-tests/k6/scenarios/mixed-read.js` | Mixed read workload. |
| `load-tests/k6/run-k6-suite.ps1`, `.bat` | Suite runners. |
| `load-tests/k6/scripts/` | Report generation and load context discovery scripts. |
| `load-tests/k6/reports/` | Historical test outputs and generated summaries. |

## 9. Deployment and Runtime Structure

### Production-Like Compose

`docker-compose.yml` defines:

- `db`: PostgreSQL 15 Alpine, database `setu_db`, exposed on `5432`.
- `app`: combined app container, exposed on `3000`, depends on `db`, runs DB migrations, mounts backend uploads.

### Dev Compose

`docker-compose.dev.yml` defines:

- `backend`: backend service on `3000`, using backend build target and migrated production start.
- `frontend`: Vite dev server on `5173`, bind-mounted frontend source, `VITE_API_URL=http://localhost:3000`.
- `app`: disabled with profile `donotstart`.

## 10. Cross-Module Relationships

| Flow | Backend Modules | Frontend/Mobile Areas |
| --- | --- | --- |
| Login and access control | `auth`, `users`, `roles`, `permissions`, `temp-user`, `audit` | `AuthContext`, protected routes, user/role/permission pages, mobile auth. |
| Project hierarchy setup | `eps`, `projects`, `wbs`, `boq`, `resources`, `workdoc` | EPS page, WBS page, BOQ page, vendor mapping, workdoc components. |
| Planning and scheduling | `planning`, `wbs`, `micro-schedule`, `resources`, `labor`, `milestone` | Planning page, schedule compare, cost/budget/project health/custom tracker/issue tracker pages, Flutter planning/progress. |
| Execution and progress | `execution`, `progress`, `labor`, `notifications`, `sync` | Execution dashboard, progress dashboard, approvals, mobile progress entry/approvals. |
| Quality management | `quality`, `snag`, `notifications`, `audit`, `sync` | Quality dashboard, inspections, approvals, sequencer, workflow, Flutter quality field modules. |
| EHS management | `ehs`, `notifications`, `sync` | EHS project dashboard and Flutter EHS modules. |
| Design management | `design`, `common` upload utilities | Drawing register, CAD/PDF preview, mobile design register. |
| Dashboards and reporting | `dashboard`, `dashboard-builder`, `ai-insights` | Dashboard builder, report builder, executive dashboard, AI insights pages. |
| Plugin runtime | `plugins`, `permissions`, `audit` | Plugin registry, plugin host, plugin runtime context, plugin SDK. |
| Offline/mobile sync | `sync`, domain modules, `notifications` | Flutter local storage, BLoCs, sync log, server setup, QR scanner. |

## 11. Suggested Detailed Documentation Set

Use this file as the master structure page. The next detailed documents can be split as:

1. `backend-api-map.md`: controller-wise API endpoints, permissions, DTOs, and entities.
2. `database-entity-map.md`: TypeORM entities grouped by business domain and relationships.
3. `frontend-route-map.md`: route, page component, permission, service, and backend endpoint mapping.
4. `mobile-feature-map.md`: Flutter feature-wise pages, BLoCs, models, repositories, and sync behavior.
5. `permissions-matrix.md`: permission keys, route usage, backend guard usage, roles/templates.
6. `deployment-runbook.md`: Docker, environment variables, migrations, uploads, backups.
7. `plugin-development-guide.md`: plugin manifests, packaging, registry install flow, runtime page/widget/report integration.
8. `testing-strategy.md`: backend Jest/e2e, frontend build/lint, Flutter tests, k6 load scenarios.
