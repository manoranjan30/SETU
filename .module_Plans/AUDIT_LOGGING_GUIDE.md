# SETU Audit Logging System — Developer Guide

## Overview

The SETU audit system is a **3-layer, automatically extensible** logging framework.
Every mutating action in the platform (create, update, delete) is **automatically captured**
with zero setup required for new modules.

---

## Architecture

```
HTTP Request
    │
    ▼  Layer 1 (Automatic)
┌─────────────────────────────────┐
│       AuditInterceptor          │  Global — catches ALL POST/PATCH/PUT/DELETE
│  (audit/audit.interceptor.ts)   │  Derives module from route prefix map
└──────────────┬──────────────────┘
               │ reads optional
               ▼  Layer 2 (Semantic)
┌─────────────────────────────────┐
│    @Auditable() Decorator       │  Controller-level metadata (optional)
│ (audit/auditable.decorator.ts)  │  Overrides derived values with semantic names
└──────────────┬──────────────────┘
               │ optionally
               ▼  Layer 3 (Deep Detail)
┌─────────────────────────────────┐
│     AuditService.log()          │  Service-level explicit logging
│    (audit/audit.service.ts)     │  For complex before/after diffs
└──────────────┬──────────────────┘
               │
               ▼
         audit_logs (DB)
```

---

## How to Add a New Module

### Step 1: Register the Route (Required)
Add ONE line to `audit/audit-module-map.ts`:

```typescript
export const ROUTE_MODULE_MAP: Record<string, string> = {
  // ... existing entries ...
  '/your-new-route': 'YOUR_MODULE_NAME',  // ← ADD THIS
};
```

**That's it for basic coverage.** The interceptor will now automatically log
all mutations to your new module's endpoints using coarse-grained action names
derived from the HTTP method (POST → CREATE, DELETE → DELETE, etc.).

---

### Step 2: Add Semantic Annotations (Recommended)
For human-readable, business-meaningful audit entries, add `@Auditable()` to
each mutating controller method:

```typescript
import { Auditable } from '../audit/auditable.decorator';

@Controller('your-route')
export class YourController {

  @Post()
  @Auditable('YOUR_MODULE', 'CREATE_ITEM')        // ← action name you define
  async create(@Body() dto: CreateDto) { ... }

  @Patch(':id')
  @Auditable('YOUR_MODULE', 'UPDATE_ITEM', 'id')  // ← 3rd arg = param for recordId
  async update(@Param('id') id: string, @Body() dto: UpdateDto) { ... }

  @Delete(':id')
  @Auditable('YOUR_MODULE', 'DELETE_ITEM', 'id')
  async remove(@Param('id') id: string) { ... }
}
```

**Without `@Auditable()`**: Log entry will show `module: 'YOUR_MODULE'`, `action: 'CREATE'`
**With `@Auditable()`**: Log entry will show `module: 'YOUR_MODULE'`, `action: 'CREATE_ITEM'`

---

### Step 3: Add Deep Detail Logging (Optional)
For complex operations where you need before/after state captured (e.g., role changes,
status transitions with old values), inject `AuditService` into your service:

```typescript
// your.service.ts
constructor(
  // ... other injections ...
  private readonly auditService: AuditService, // Globally available — no module import needed
) {}

async updateSomething(id: number, dto: UpdateDto, userId: number) {
  const existing = await this.repo.findOneBy({ id });
  const oldState = { status: existing.status, value: existing.value };

  // ... perform update ...
  const updated = await this.repo.save(existing);

  // Log with rich detail
  await this.auditService.log(
    userId,
    'YOUR_MODULE',
    'UPDATE_ITEM',
    id,
    updated.projectId,
    { old: oldState, new: { status: updated.status, value: updated.value } },
  );

  return updated;
}
```

> **Note:** Layer 3 logging is additive — it creates an ADDITIONAL audit entry
> alongside the Layer 1/2 entry from the interceptor. For most cases,
> Layer 2 (`@Auditable`) is sufficient and avoids duplicate entries.
> Only use Layer 3 when you need the **specific diff/before-after data**.

---

## Audit Entry Fields

| Field        | Source                               | Example                        |
|-------------|--------------------------------------|--------------------------------|
| `userId`    | JWT token (`req.user.id`)            | `4`                            |
| `module`    | ROUTE_MODULE_MAP or @Auditable()     | `'WBS'`, `'QUALITY'`           |
| `action`    | HTTP method map or @Auditable()      | `'DELETE_NODE'`, `'RAISE_RFI'` |
| `recordId`  | Route param `id` or response `.id`   | `'123'`                        |
| `projectId` | Route param `projectId` or context   | `42`                           |
| `ipAddress` | `x-forwarded-for` or `req.ip`        | `'192.168.1.10'`               |
| `details`   | Sanitised request body summary       | `{ requestSummary: {...} }`    |
| `timestamp` | Auto — database CreateDateColumn     | `2026-02-22T17:00:00Z`         |

---

## What Is NOT Logged

- `GET` requests (read-only, never logged)
- Failed requests (errors are not logged — only successful mutations)
- Routes in `AUDIT_SKIP_ROUTES` (e.g., `/auth/login`, `/audit`)
- Requests without an authenticated user context (`req.user`)

---

## Viewing Audit Logs

**Admin UI:** `Admin → System Logs` (`/dashboard/admin/logs`)

**API:**
- `GET /audit?module=WBS&limit=100`
- `GET /audit/project/:projectId`

**Requires permission:** `AUDIT.READ`

---

## Module Name Conventions

Use **SCREAMING_SNAKE_CASE** for module and action names:

| Module         | Actions                                               |
|---------------|-------------------------------------------------------|
| `WBS`         | `CREATE_NODE`, `UPDATE_NODE`, `DELETE_NODE`, `REORDER_NODE`, `IMPORT` |
| `QUALITY`     | `RAISE_RFI`, `UPDATE_RFI_STATUS`, `COMPLETE_STAGE`    |
| `SCHEDULE`    | `DISTRIBUTE_ACTIVITIES`, `UNDISTRIBUTE_ACTIVITIES`, `COMPLETE_ACTIVITY` |
| `TEAM`        | `ASSIGN_MEMBER`, `REMOVE_MEMBER`, `UPDATE_MEMBER_STATUS` |
| `PROGRESS`    | `RECORD_PROGRESS`                                     |
| `AUTH`        | `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`, `CREATE_ROLE` |
| `BOQ`         | `CREATE`, `UPDATE`, `DELETE`, `IMPORT`                |
| `SYSTEM`      | `UPDATE_SETTINGS`, `CREATE_TEMPLATE`                  |
| `YOUR_MODULE` | `CREATE_ITEM`, `UPDATE_ITEM`, `DELETE_ITEM`           |
