# Permission Flow Architecture

> **Status**: ✅ ACTIVE — Binding reference for all developers and AI agents
> **Last Updated**: 2026-02-22
> **Scope**: Full-stack (Backend + Frontend)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PERMISSION FLOW                               │
│                                                                      │
│  ┌────────────────────┐    ┌─────────────────────┐                   │
│  │   permission-      │    │  permissions.        │                   │
│  │   registry.ts      │───▶│  service.ts          │                   │
│  │                    │    │                      │                   │
│  │  SINGLE SOURCE     │    │  • registerAll()     │                   │
│  │  OF TRUTH          │    │  • migrateOldCodes() │                   │
│  │                    │    │  • Bootstrap seed     │                   │
│  │  180+ permissions  │    └──────────┬───────────┘                   │
│  │  19 modules        │               │                              │
│  │  Auto-dependencies │               ▼                              │
│  └────────┬───────────┘    ┌─────────────────────┐                   │
│           │                │  PostgreSQL DB       │                   │
│           │                │  • permission table  │                   │
│           ▼                │  • role_permissions  │                   │
│  ┌────────────────────┐    └─────────────────────┘                   │
│  │  permission-       │                                              │
│  │  config.ts         │◀── Re-exports from registry                  │
│  │  (Backend compat)  │                                              │
│  └────────────────────┘                                              │
│           │                                                          │
│           ▼                                                          │
│  ┌────────────────────┐                                              │
│  │  permissions.ts    │◀── Frontend mirror (manual sync)             │
│  │  (Frontend)        │                                              │
│  └────────────────────┘                                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Request Flow — How Permissions Are Enforced

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│   Browser    │────▶│   NestJS     │────▶│   JwtAuthGuard    │────▶│ PermissionsGuard │
│   Request    │     │   Router     │     │                   │     │                  │
│              │     │              │     │  1. Extract JWT   │     │ 1. Read metadata │
│              │     │              │     │  2. Validate      │     │ 2. Get required  │
│              │     │              │     │  3. Attach user   │     │    permissions   │
│              │     │              │     │     to request    │     │ 3. Check user    │
│              │     │              │     │                   │     │    has them      │
│              │     │              │     │  user.permissions │     │ 4. Allow/Deny    │
│              │     │              │     │  = ['EHS.DASH...']│     │                  │
└─────────────┘     └──────────────┘     └───────────────────┘     └────────┬─────────┘
                                                                            │
                                                                            ▼
                                                                   ┌──────────────────┐
                                                                   │    Controller     │
                                                                   │    Handler        │
                                                                   │                   │
                                                                   │ @Permissions(     │
                                                                   │  'EHS.DASH.READ') │
                                                                   └──────────────────┘
```

### Step-by-Step Flow:

1. **User logs in** → Backend generates JWT with user's permissions array baked in
2. **Frontend stores JWT** → All API calls include `Authorization: Bearer <token>`
3. **Request hits router** → NestJS matches the route to a controller method
4. **JwtAuthGuard** → Validates token, extracts user payload (including permissions)
5. **PermissionsGuard** → Reads `@Permissions()` decorator metadata from the handler
6. **Permission check** → Compares required permissions against `user.permissions`
7. **Allow or 403** → If user has the permission → proceed. If not → `ForbiddenException`

---

## 3. Frontend Flow — Sidebar Visibility

```
┌──────────────────────────────────────────────────┐
│                 SIDEBAR RENDERING                 │
│                                                   │
│  User JWT decoded → permissions: [...]            │
│                                                   │
│  For each menu item:                              │
│  ┌──────────────────────────────────────────┐     │
│  │ item.permission exists?                  │     │
│  │   ├─ YES → hasPermission(item.permission)│     │
│  │   │    ├─ true  → SHOW item              │     │
│  │   │    └─ false → HIDE item              │     │
│  │   └─ NO  → SHOW item (public/no guard)   │     │
│  └──────────────────────────────────────────┘     │
│                                                   │
│  For parent items with children:                  │
│  ┌──────────────────────────────────────────┐     │
│  │ Filter children by permission            │     │
│  │ If 0 visible children → HIDE parent      │     │
│  │ If 1+ visible children → SHOW parent     │     │
│  └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### Sidebar Permission Mapping (ALL items):

| Sidebar Item | Permission Required | Module |
|---|---|---|
| **Dashboard** | `VIEW_DASHBOARD` | System |
| **Projects** | `VIEW_PROJECTS` | System |
| **Site Execution** | `EXECUTION.ENTRY.READ` | Execution |
| **Admin → User Management** | `MANAGE_USERS` | Admin |
| **Admin → Role Management** | `MANAGE_ROLES` | Admin |
| **Admin → System Permissions** | `MANAGE_ROLES` | Admin |
| **Admin → System Logs** | `AUDIT.LOG.READ` | Audit |
| WBS Structure | `WBS.NODE.READ` | WBS |
| Bill of Quantities | `BOQ.ITEM.READ` | BOQ |
| Planning & Schedule | `PLANNING.MATRIX.READ` | Planning |
| Progress | `PROGRESS.DASHBOARD.READ` | Progress |
| Manpower | `LABOR.ENTRY.READ` | Labor |
| **Site Safety (EHS)** | `EHS.DASHBOARD.READ` | EHS |
| **Quality Control** | `QUALITY.DASHBOARD.READ` | Quality |
| Quality Requests | `QUALITY.INSPECTION.READ` | Quality |
| QA/QC Approvals | `QUALITY.INSPECTION.APPROVE` | Quality |
| Activity Lists | `QUALITY.ACTIVITYLIST.READ` | Quality |
| Design (Drawings) | `DESIGN.DRAWING.READ` | Design |

---

## 4. Guard Stack Order (All Controllers)

Every controller MUST follow this guard order:

```typescript
@Controller('module-name')
@UseGuards(JwtAuthGuard, PermissionsGuard)   // ← ALWAYS both
export class ModuleController {

  @Get()
  @Permissions('MODULE.ENTITY.READ')         // ← ALWAYS on every endpoint
  async findAll() { ... }

  @Post()
  @Permissions('MODULE.ENTITY.CREATE')
  async create() { ... }
}
```

### Guard Execution Order:
```
1. JwtAuthGuard      →  Authentication (Is user logged in?)
2. PermissionsGuard  →  Authorization  (Does user have permission?)
3. ProjectContextGuard → (Optional) Project scope validation
4. EpsPermissionGuard  → (Optional) EPS node-level permission
```

---

## 5. Permission Assignment Flow

```
Admin UI (Role Management)
    │
    ▼
┌───────────────────────────────────────────────┐
│  Admin assigns permissions to a Role:         │
│                                               │
│  Role: "Site Engineer"                        │
│  ✅ EXECUTION.ENTRY.READ                      │
│  ✅ EXECUTION.ENTRY.CREATE                    │
│  ✅ WBS.ACTIVITY.READ                         │
│  ❌ EHS.DASHBOARD.READ     ← NOT assigned    │
│  ❌ QUALITY.DASHBOARD.READ ← NOT assigned    │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│  User "manoranjan" has role "Site Engineer"    │
│                                               │
│  JWT token.permissions = [                    │
│    'EXECUTION.ENTRY.READ',                    │
│    'EXECUTION.ENTRY.CREATE',                  │
│    'WBS.ACTIVITY.READ',                       │
│  ]                                            │
│                                               │
│  Missing: EHS.*, QUALITY.*, DESIGN.*          │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│  Sidebar:                                     │
│  ✅ WBS Structure        (WBS.NODE.READ)      │
│  ✅ Site Execution       (EXECUTION.ENTRY.READ)│
│  ❌ Site Safety (EHS)    (EHS.DASHBOARD.READ)  │
│  ❌ Quality Control      (QUALITY.DASHBOARD.READ)│
│  ❌ Design (Drawings)    (DESIGN.DRAWING.READ) │
│                                               │
│  API calls to /ehs/* → 403 Forbidden          │
│  API calls to /quality/* → 403 Forbidden       │
└───────────────────────────────────────────────┘
```

---

## 6. Controller Permission Audit Status

| Controller | JwtAuth | PermGuard | @Permissions | Status |
|---|:---:|:---:|:---:|:---:|
| `ehs.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `quality.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `quality-sequencer.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `quality-inspection.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `quality-activity.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `checklist-template.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `execution.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `labor.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `micro-schedule.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `resources.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `progress.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `dashboard.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `template-builder.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `boq.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `wbs.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `wbs-template.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `schedule.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `calendars.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `planning.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `design.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `workdoc.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `system-settings.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `audit.controller.ts` | ✅ | ✅ | ✅ | ✅ SECURED |
| `eps.controller.ts` | ✅ | Custom | Custom | ✅ SECURED |
| `projects.controller.ts` | ✅ | Custom | Custom | ✅ SECURED |
| `users.controller.ts` | ✅ | RolesGuard | @Roles | ✅ LEGACY OK |
| `roles.controller.ts` | ✅ | RolesGuard | @Roles | ✅ LEGACY OK |
| `permissions.controller.ts` | ✅ | RolesGuard | @Roles | ✅ LEGACY OK |
| `table-view.controller.ts` | ✅ | — | — | ✅ USER-SCOPED |
| `auth.controller.ts` | — | — | — | ✅ PUBLIC (login) |
| `app.controller.ts` | — | — | — | ✅ PUBLIC (health) |

---

## 7. Rules for Future Development

### When creating a NEW module:

1. ✅ Define permissions in `permission-registry.ts`
2. ✅ Add `@UseGuards(JwtAuthGuard, PermissionsGuard)` to controller
3. ✅ Add `@Permissions('MODULE.ENTITY.ACTION')` to EVERY endpoint
4. ✅ Add codes to frontend `permissions.ts`
5. ✅ Add `permission` field to sidebar item
6. ✅ Test: Login as restricted user → Module should be HIDDEN + API should return 403

### When adding a NEW endpoint to existing module:

1. ✅ Verify the controller already has `PermissionsGuard`
2. ✅ Add `@Permissions()` with appropriate code
3. ✅ If new code → register in `permission-registry.ts` + frontend `permissions.ts`

### Anti-Patterns (FORBIDDEN):

```typescript
// ❌ NEVER: Controller without PermissionsGuard
@Controller('module')
@UseGuards(JwtAuthGuard)  // Missing PermissionsGuard!
export class ModuleController { }

// ❌ NEVER: Endpoint without @Permissions
@Get()
async findAll() { }  // No @Permissions decorator!

// ❌ NEVER: Sidebar item without permission
item={{ label: 'Module', path: '/module' }}  // No permission field!

// ✅ ALWAYS: Full guard stack
@Controller('module')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModuleController {
  @Get()
  @Permissions('MODULE.ENTITY.READ')
  async findAll() { }
}
```

---

## 8. Important: Re-login Required After Permission Changes

When permissions are added, renamed, or reorganized:
- Users **MUST re-login** to get a new JWT with updated permissions
- The JWT contains a snapshot of permissions at login time
- Old tokens will NOT reflect new permission assignments

---

## 9. File Reference

| File | Location | Purpose |
|---|---|---|
| `permission-registry.ts` | `backend/src/auth/` | **SINGLE SOURCE OF TRUTH** — all 180+ permission definitions |
| `permissions.service.ts` | `backend/src/permissions/` | Bootstrap seeding & migration |
| `permission-config.ts` | `backend/src/auth/` | Backend re-exports (compat) |
| `permissions.ts` | `frontend/src/config/` | Frontend mirror of permission codes |
| `permissions.guard.ts` | `backend/src/auth/` | NestJS guard that enforces permissions |
| `permissions.decorator.ts` | `backend/src/auth/` | `@Permissions()` decorator |
| `Sidebar.tsx` | `frontend/src/components/layout/` | Sidebar with permission-based visibility |
| `PERMISSION_SYSTEM.md` | `.agent/rules/` | AI agent rules for permission management |
| `PERMISSION_FLOW.md` | `.agent/rules/` | **THIS FILE** — Architecture & flow documentation |
