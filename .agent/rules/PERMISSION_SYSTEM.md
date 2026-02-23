# PERMISSION_SYSTEM.md
## SETU Permission Architecture — Binding Rules for AI Development

---

> **Status**: ✅ ACTIVE — MANDATORY for ALL development
> **Last Updated**: 2026-02-22
> **Scope**: Backend + Frontend — every module, controller, and endpoint
> **Trigger**: ANY time you create, modify, or add functionality to a module

---

## 🔴 CRITICAL: When This Rule Applies

This rule is **MANDATORY** when:

| Trigger | Example |
|---------|---------|
| Creating a **new module** | "Build an inventory module" |
| Adding a **new controller** | "Add a reports controller" |
| Adding a **new endpoint** to an existing controller | "Add an export endpoint to BOQ" |
| Creating a **new entity** that requires access control | "Add a PurchaseOrder entity" |
| Modifying **any `@Permissions()` decorator** | "Change access level on this endpoint" |
| Adding **any new feature or functionality** | "Add approval workflow to X" |

**If you write backend code without checking this file → PROTOCOL VIOLATION.**

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  SINGLE SOURCE OF TRUTH                                              │
│  backend/src/auth/permission-registry.ts                             │
│                                                                      │
│  Defines ALL permissions for ALL modules.                            │
│  Auto-generates dependency maps.                                     │
│  Exports: ALL_PERMISSIONS, MIGRATION_MAP, expandPermissions()        │
├──────────────────────────────────────────────────────────────────────┤
│                        ↓ imports from registry                       │
│                                                                      │
│  permissions.service.ts  → Registers all permissions in DB on boot   │
│  permission-config.ts    → Re-exports registry + PermissionCode map  │
│  frontend permissions.ts → Mirror of all permission codes            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Permission Naming Convention (Non-Negotiable)

### Format: `MODULE.ENTITY.ACTION`

```
MODULE    = ALL CAPS top-level domain (EPS, WBS, BOQ, EXECUTION, etc.)
ENTITY    = ALL CAPS resource name (NODE, ITEM, ENTRY, DRAWING, etc.)
ACTION    = ALL CAPS operation (READ, CREATE, UPDATE, DELETE, IMPORT, APPROVE, MANAGE)
SEPARATOR = Dot (.) only
```

### Examples

```
✅ CORRECT                    ❌ WRONG
BOQ.ITEM.READ                 BOQ.Item.Read        (PascalCase)
EXECUTION.ENTRY.CREATE        Execution.Entry.Create (mixed case)
QUALITY.INSPECTION.APPROVE    QUALITY_INSPECTION    (underscores)
EHS.INCIDENT.CREATE           EHS.Incident.Create   (PascalCase)
MICRO.SCHEDULE.READ           MicroSchedule.Read    (no dots)
```

### Naming Rules

| # | Rule | Example |
|---|------|---------|
| 1 | **ALL CAPS** for MODULE, ENTITY, and ACTION | `EPS.NODE.CREATE` |
| 2 | **Dot separator** only — never underscores in codes | `BOQ.ITEM.READ` |
| 3 | Every module MUST have at least a `.READ` permission | `NEWMODULE.ENTITY.READ` |
| 4 | `Manage` = full CRUD (admin-level access to an entity) | `LABOR.CATEGORY.MANAGE` |
| 5 | `Approve` = workflow approval/rejection | `EXECUTION.ENTRY.APPROVE` |
| 6 | `Import` = bulk data import from files | `SCHEDULE.IMPORT` |
| 7 | **No duplicate codes** across the entire system | — |
| 8 | Legacy system codes are the ONLY exception | `VIEW_DASHBOARD`, `MANAGE_USERS` |

---

## 3. How to Add Permissions for a New Module (Step-by-Step)

### Step 1: Define permissions in the registry

**File**: `backend/src/auth/permission-registry.ts`

Add a new constant array for your module. Use the `crud()` helper for standard CRUD, or `perm()` for individual permissions.

```typescript
// ═══════════════════════════════════════════════════════════════
// MODULE XX: INVENTORY (Example New Module)
// ═══════════════════════════════════════════════════════════════

export const INVENTORY_PERMISSIONS: PermissionDef[] = [
  // Standard CRUD for the main entity
  ...crud('INVENTORY', 'ITEM', 'Inventory Item'),
  // Additional specific permissions
  perm('INVENTORY.ITEM.IMPORT', 'Import Inventory', 'INVENTORY', C),
  perm('INVENTORY.TRANSFER.CREATE', 'Create Transfer', 'INVENTORY', C),
  perm('INVENTORY.TRANSFER.APPROVE', 'Approve Transfer', 'INVENTORY', S),
];
```

Then add it to the `ALL_MODULE_PERMISSIONS` array at the bottom:

```typescript
export const ALL_MODULE_PERMISSIONS: PermissionDef[][] = [
  // ... existing modules ...
  INVENTORY_PERMISSIONS,  // ← ADD HERE
];
```

### Step 2: Add codes to `permission-config.ts`

**File**: `backend/src/auth/permission-config.ts`

Add the new codes to the `PermissionCode` object:

```typescript
export const PermissionCode = {
  // ... existing codes ...

  // ─── Inventory ────────────────────────────────────────────
  INVENTORY_ITEM_READ: 'INVENTORY.ITEM.READ',
  INVENTORY_ITEM_CREATE: 'INVENTORY.ITEM.CREATE',
  INVENTORY_ITEM_UPDATE: 'INVENTORY.ITEM.UPDATE',
  INVENTORY_ITEM_DELETE: 'INVENTORY.ITEM.DELETE',
  INVENTORY_ITEM_IMPORT: 'INVENTORY.ITEM.IMPORT',
  INVENTORY_TRANSFER_CREATE: 'INVENTORY.TRANSFER.CREATE',
  INVENTORY_TRANSFER_APPROVE: 'INVENTORY.TRANSFER.APPROVE',
} as const;
```

### Step 3: Add codes to frontend

**File**: `frontend/src/config/permissions.ts`

Mirror the same codes:

```typescript
export const PermissionCode = {
  // ... existing codes ...

  // ─── Inventory ────────────────────────────────────────────
  INVENTORY_ITEM_READ: 'INVENTORY.ITEM.READ',
  INVENTORY_ITEM_CREATE: 'INVENTORY.ITEM.CREATE',
  INVENTORY_ITEM_UPDATE: 'INVENTORY.ITEM.UPDATE',
  INVENTORY_ITEM_DELETE: 'INVENTORY.ITEM.DELETE',
  INVENTORY_ITEM_IMPORT: 'INVENTORY.ITEM.IMPORT',
  INVENTORY_TRANSFER_CREATE: 'INVENTORY.TRANSFER.CREATE',
  INVENTORY_TRANSFER_APPROVE: 'INVENTORY.TRANSFER.APPROVE',
} as const;
```

### Step 4: Apply `@Permissions()` to controller endpoints

**File**: `backend/src/inventory/inventory.controller.ts`

```typescript
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {

  @Get()
  @Permissions('INVENTORY.ITEM.READ')
  async findAll() { ... }

  @Post()
  @Permissions('INVENTORY.ITEM.CREATE')
  async create() { ... }

  @Patch(':id')
  @Permissions('INVENTORY.ITEM.UPDATE')
  async update() { ... }

  @Delete(':id')
  @Permissions('INVENTORY.ITEM.DELETE')
  async remove() { ... }

  @Post('import')
  @Permissions('INVENTORY.ITEM.IMPORT')
  async importFile() { ... }
}
```

### Step 5: Restart backend — permissions auto-register in DB

No manual DB seed needed. The `PermissionsService.onModuleInit()` reads the registry and creates any missing permissions automatically.

---

## 4. How to Add a New Endpoint to an Existing Module

When adding a **single new endpoint** to an existing module:

### Do I need a new permission?

| Scenario | Answer |
|----------|--------|
| New **read** endpoint for existing entity | Use existing `MODULE.ENTITY.READ` |
| New **write** endpoint for existing entity | Use existing `MODULE.ENTITY.CREATE/UPDATE` |
| New **entity type** within the module | YES — add new `MODULE.NEWENTITY.READ/CREATE/...` |
| New **action type** (Import, Export, Approve) | YES — add new `MODULE.ENTITY.ACTION` |
| Debug/health endpoint | No permission needed — but still requires `JwtAuthGuard` |

### If YES — follow Steps 1-4 from Section 3 above.

---

## 5. Dependency Auto-Generation Rules

The `buildDependencyMap()` function in the registry automatically generates permission implications based on these conventions:

| Rule | Description | Example |
|------|-------------|---------|
| **Rule 1** | All module permissions imply `VIEW_PROJECTS` | `BOQ.ITEM.READ` → gets `VIEW_PROJECTS` |
| **Rule 2** | CREATE/UPDATE/DELETE implies READ of same entity | `BOQ.ITEM.CREATE` → gets `BOQ.ITEM.READ` |
| **Rule 3** | SPECIAL (Manage/Approve) implies READ of same entity | `QUALITY.INSPECTION.APPROVE` → gets `QUALITY.INSPECTION.READ` |
| **Rule 4** | EPS mutations imply `MANAGE_EPS` | `EPS.NODE.CREATE` → gets `MANAGE_EPS` |
| **Rule 5** | `USER.MANAGEMENT.*` implies `MANAGE_USERS` | `USER.MANAGEMENT.CREATE` → gets `MANAGE_USERS` |
| **Rule 6** | `ROLE.MANAGEMENT.*` implies `MANAGE_ROLES` | `ROLE.MANAGEMENT.DELETE` → gets `MANAGE_ROLES` |
| **Rule 7** | All permissions imply `VIEW_DASHBOARD` | Any permission → gets `VIEW_DASHBOARD` |

**You do NOT need to manually define dependencies.** They are auto-generated.

---

## 6. Frontend Permission Usage

### Protecting Routes

```tsx
import { PermissionCode } from '@/config/permissions';

<ProtectedRoute permission={PermissionCode.INVENTORY_ITEM_READ}>
  <InventoryPage />
</ProtectedRoute>
```

### Conditional UI Elements

```tsx
const { hasPermission } = useAuth();

{hasPermission(PermissionCode.INVENTORY_ITEM_CREATE) && (
  <Button onClick={handleCreate}>Add Item</Button>
)}
```

### Sidebar Menu

```typescript
// frontend/src/config/menu.ts
{
  label: 'Inventory',
  path: '/dashboard/inventory',
  permission: PermissionCode.INVENTORY_ITEM_READ,
}
```

---

## 7. Files Reference (Always Update These)

| # | File | What to Add | When |
|---|------|-------------|------|
| 1 | `backend/src/auth/permission-registry.ts` | New `PermissionDef[]` array + add to `ALL_MODULE_PERMISSIONS` | **Every new module or entity** |
| 2 | `backend/src/auth/permission-config.ts` | New entries in `PermissionCode` object | **Every new permission** |
| 3 | `frontend/src/config/permissions.ts` | Mirror the same codes | **Every new permission** |
| 4 | Controller file | `@Permissions('CODE')` decorator on endpoints | **Every new endpoint** |
| 5 | `frontend/src/config/menu.ts` | `permission:` field on menu items | **If module appears in sidebar** |

---

## 8. Mandatory Checklist (Before Completing Any Task)

Before marking any backend task as DONE, verify:

- [ ] **Every controller** has `@UseGuards(JwtAuthGuard, PermissionsGuard)` at class level
- [ ] **Every endpoint** has `@Permissions('MODULE.ENTITY.ACTION')` decorator
- [ ] **Permission codes** follow `MODULE.ENTITY.ACTION` ALL CAPS format
- [ ] **Registry** (`permission-registry.ts`) contains the new permissions
- [ ] **Backend config** (`permission-config.ts`) has the new codes in `PermissionCode`
- [ ] **Frontend config** (`frontend/src/config/permissions.ts`) mirrors the codes
- [ ] **No hardcoded strings** — use `PermissionCode.CONSTANT` where possible
- [ ] **No invented codes** — every code in `@Permissions()` MUST exist in the registry

---

## 9. Anti-Patterns (FORBIDDEN)

| ❌ Anti-Pattern | ✅ Correct Approach |
|----------------|---------------------|
| `@Permissions('MANAGE_BOQ')` — invented code | `@Permissions('BOQ.ITEM.CREATE')` — registry code |
| `@Permissions('EXECUTION.READ')` on workorder endpoints | `@Permissions('WORKORDER.VENDOR.READ')` — correct module |
| PascalCase codes: `BOQ.Item.Read` | ALL CAPS: `BOQ.ITEM.READ` |
| Registering permissions inline in `module.ts` | Add to `permission-registry.ts` only |
| Creating a controller without `@Permissions` | Every endpoint MUST have a permission decorator |
| Using `MANAGE_USERS` for unrelated admin actions | Create specific permission: `ADMIN.SETTINGS.MANAGE` |
| Frontend-only permission checks without backend guards | Backend MUST enforce — frontend only hides UI |

---

## 10. Permission Registry Helpers Reference

### `crud(module, entity, readName)` — generates 4 standard permissions

```typescript
crud('INVENTORY', 'ITEM', 'Inventory Item')
// Produces:
// INVENTORY.ITEM.READ    — View Inventory Item
// INVENTORY.ITEM.CREATE  — Create Inventory Item
// INVENTORY.ITEM.UPDATE  — Update Inventory Item
// INVENTORY.ITEM.DELETE  — Delete Inventory Item
```

### `perm(code, name, module, action)` — single permission

```typescript
perm('INVENTORY.ITEM.IMPORT', 'Import Inventory', 'INVENTORY', C)
```

### Action Shortcuts

```typescript
const R = PermissionAction.READ;
const C = PermissionAction.CREATE;
const U = PermissionAction.UPDATE;
const D = PermissionAction.DELETE;
const S = PermissionAction.SPECIAL;  // For Manage, Approve, Submit
```

### Scope Shortcuts

```typescript
const SYS = PermissionScope.SYSTEM;   // System-wide (User/Role management)
const PRJ = PermissionScope.PROJECT;  // Project-scoped (default)
```

---

## 11. Full Example: Adding a Complete New Module

### Scenario: "Build a Material Management module"

#### 1. Registry (`permission-registry.ts`)

```typescript
export const MATERIAL_PERMISSIONS: PermissionDef[] = [
  ...crud('MATERIAL', 'ITEM', 'Material'),
  perm('MATERIAL.ITEM.IMPORT', 'Import Materials', 'MATERIAL', C),
  perm('MATERIAL.RECEIPT.READ', 'View Material Receipts', 'MATERIAL', R),
  perm('MATERIAL.RECEIPT.CREATE', 'Create Material Receipt', 'MATERIAL', C),
  perm('MATERIAL.RECEIPT.APPROVE', 'Approve Material Receipt', 'MATERIAL', S),
  perm('MATERIAL.ISSUE.READ', 'View Material Issues', 'MATERIAL', R),
  perm('MATERIAL.ISSUE.CREATE', 'Create Material Issue', 'MATERIAL', C),
];

// Add to ALL_MODULE_PERMISSIONS:
export const ALL_MODULE_PERMISSIONS: PermissionDef[][] = [
  // ... existing ...
  MATERIAL_PERMISSIONS,
];
```

#### 2. Backend Config (`permission-config.ts`)

```typescript
MATERIAL_ITEM_READ: 'MATERIAL.ITEM.READ',
MATERIAL_ITEM_CREATE: 'MATERIAL.ITEM.CREATE',
MATERIAL_ITEM_UPDATE: 'MATERIAL.ITEM.UPDATE',
MATERIAL_ITEM_DELETE: 'MATERIAL.ITEM.DELETE',
MATERIAL_ITEM_IMPORT: 'MATERIAL.ITEM.IMPORT',
MATERIAL_RECEIPT_READ: 'MATERIAL.RECEIPT.READ',
MATERIAL_RECEIPT_CREATE: 'MATERIAL.RECEIPT.CREATE',
MATERIAL_RECEIPT_APPROVE: 'MATERIAL.RECEIPT.APPROVE',
MATERIAL_ISSUE_READ: 'MATERIAL.ISSUE.READ',
MATERIAL_ISSUE_CREATE: 'MATERIAL.ISSUE.CREATE',
```

#### 3. Frontend Config (`frontend/src/config/permissions.ts`)

```typescript
// Same codes as backend config
MATERIAL_ITEM_READ: 'MATERIAL.ITEM.READ',
// ... etc
```

#### 4. Controller

```typescript
@Controller('materials')
@UseGuards(JwtAuthGuard, ProjectAssignmentGuard, PermissionsGuard)
export class MaterialController {

  @Get()
  @Permissions('MATERIAL.ITEM.READ')
  findAll() { ... }

  @Post()
  @Permissions('MATERIAL.ITEM.CREATE')
  create() { ... }

  @Post('import')
  @Permissions('MATERIAL.ITEM.IMPORT')
  import() { ... }

  @Get('receipts')
  @Permissions('MATERIAL.RECEIPT.READ')
  getReceipts() { ... }

  @Post('receipts')
  @Permissions('MATERIAL.RECEIPT.CREATE')
  createReceipt() { ... }

  @Post('receipts/:id/approve')
  @Permissions('MATERIAL.RECEIPT.APPROVE')
  approveReceipt() { ... }
}
```

#### 5. Restart → All permissions auto-registered.

---

## Governance Rule

This document is **authoritative and binding**.
Any code that creates endpoints without proper permission decorators is **invalid**.
Any permission code that doesn't follow the `MODULE.ENTITY.ACTION` ALL CAPS convention is **invalid**.
The permission-registry.ts is the **single source of truth** — never register permissions elsewhere.
