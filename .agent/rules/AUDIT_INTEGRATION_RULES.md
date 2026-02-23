# AUDIT_INTEGRATION_RULES.md
## Audit Logging Integration Contract
### SETU Construction Intelligence Platform

---

## 1. Purpose of This Document

This document is the **authoritative and binding contract** for integrating audit logging
into any new module, feature, service, or controller added to SETU.

**Any AI or developer building new functionality MUST read and follow this document.**

It answers:
- What to log
- Where to log it
- How to wire it correctly in the SETU tech stack
- What NOT to do

---

## 2. Core Audit Principles (Non-Negotiable)

1. **Every mutation must leave a trail.**
   - Any POST, PATCH, PUT, DELETE action that modifies data **must** be auditable.

2. **Audit failures must NEVER break user workflows.**
   - Audit writes are always fire-and-forget (non-blocking).
   - Always wrap audit calls in try/catch. Errors are logged but swallowed.

3. **Sensitive data must NEVER enter audit logs.**
   - Strip `password`, `passwordHash`, `token`, `secret` before logging.

4. **Audit logs are immutable.**
   - No UPDATE or DELETE endpoint for `audit_logs` table ever. Read-only API only.

5. **The interceptor is the safety net — decorators are the signal.**
   - Layer 1 catches everything automatically.
   - Layer 2 (`@Auditable`) gives human-readable meaning.
   - Layer 3 (`auditService.log()`) provides deep diff/context when needed.

---

## 3. The 3-Layer System (Read This First)

```
HTTP Request
    │
    ▼  Layer 1 (Global, Automatic — Zero Developer Effort)
┌─────────────────────────────────────────────────────┐
│                 AuditInterceptor                     │
│  backend/src/audit/audit.interceptor.ts             │
│                                                     │
│  • Catches ALL POST/PATCH/PUT/DELETE automatically  │
│  • Derives module from ROUTE_MODULE_MAP             │
│  • Derives action from HTTP method                  │
│  • Fires AFTER response (no false-positive logs)    │
│  • Reads @Auditable() metadata if present           │
└──────────────────────┬──────────────────────────────┘
                       │ reads (optional)
                       ▼  Layer 2 (Controller-Level, Recommended)
┌─────────────────────────────────────────────────────┐
│              @Auditable() Decorator                  │
│  backend/src/audit/auditable.decorator.ts           │
│                                                     │
│  • Used on controller methods                       │
│  • Gives semantic module + action names             │
│  • One line of code — high signal, zero cost        │
└──────────────────────┬──────────────────────────────┘
                       │ optionally
                       ▼  Layer 3 (Service-Level, For Complex Diffs)
┌─────────────────────────────────────────────────────┐
│              AuditService.log()                      │
│  backend/src/audit/audit.service.ts                 │
│                                                     │
│  • Used when before/after state diff is needed      │
│  • Captures old values, transitions, details        │
│  • Globally injectable — no module import needed    │
└─────────────────────────────────────────────────────┘
```

---

## 4. When You Add a New Module — MANDATORY Checklist

### ✅ Step 1 — Register the Route in the Module Map (REQUIRED)

**File:** `backend/src/audit/audit-module-map.ts`

Add ONE entry to `ROUTE_MODULE_MAP`:

```typescript
export const ROUTE_MODULE_MAP: Record<string, string> = {
  // ... existing entries ...

  // ADD YOUR NEW MODULE HERE:
  '/your-route-prefix': 'YOUR_MODULE_NAME',
};
```

**Rules for naming:**
- Use SCREAMING_SNAKE_CASE: `MATERIALS`, `PROCUREMENT`, `CONTRACTS`
- The key is the URL prefix your controller uses (from `@Controller('your-route-prefix')`)
- Longer/more-specific prefixes match first — no collision risk

**This single step guarantees Layer 1 automatic coverage.**

---

### ✅ Step 2 — Annotate Controller Methods (RECOMMENDED)

**File:** Your new `your-module.controller.ts`

Import the decorator at the top:
```typescript
import { Auditable } from '../audit/auditable.decorator';
```

Add `@Auditable(module, action, recordIdParam?)` to every mutating method:

```typescript
@Post()
@Auditable('YOUR_MODULE', 'CREATE_ITEM')
async create(@Body() dto: CreateDto) { ... }

@Patch(':id')
@Auditable('YOUR_MODULE', 'UPDATE_ITEM', 'id')   // 'id' = the param name for recordId
async update(@Param('id') id: string, @Body() dto: UpdateDto) { ... }

@Delete(':id')
@Auditable('YOUR_MODULE', 'DELETE_ITEM', 'id')
async remove(@Param('id') id: string) { ... }

@Post(':id/approve')
@Auditable('YOUR_MODULE', 'APPROVE_ITEM', 'id')
async approve(@Param('id') id: string) { ... }
```

**Rules:**
- Do NOT annotate GET methods — reads are never logged
- The third argument (`'id'`) tells the interceptor which route param to use as `recordId`
- If omitted, interceptor will attempt `req.params.id` or `response.id` automatically

---

### ✅ Step 3 — Deep logging for status changes or transitions (OPTIONAL)

When your business logic involves **before/after state that matters** (approvals,
status transitions, role changes, deletions of named records), use Layer 3:

**In your service constructor:**
```typescript
constructor(
  @InjectRepository(YourEntity)
  private readonly repo: Repository<YourEntity>,
  private readonly auditService: AuditService,   // ← Inject this (globally available)
) {}
```

**In your service method:**
```typescript
async approveItem(id: number, userId: number, comments: string) {
  const item = await this.repo.findOneBy({ id });
  const oldStatus = item.status;

  item.status = 'APPROVED';
  item.approvedBy = userId;
  const saved = await this.repo.save(item);

  // Layer 3: Log the specific details of what changed
  await this.auditService.log(
    userId,
    'YOUR_MODULE',
    'APPROVE_ITEM',
    id,
    item.projectId,
    { 
      oldStatus, 
      newStatus: 'APPROVED',
      comments 
    },
  );

  return saved;
}
```

> **IMPORTANT:** If you use both `@Auditable()` (Layer 2) AND `auditService.log()` (Layer 3)
> on the SAME endpoint, you will get **2 audit entries** — one from the interceptor, one from
> the service. This is acceptable for high-importance actions. For low-importance actions,
> use only Layer 2 to avoid duplication.

---

## 5. AuditService.log() — Full Method Signature

```typescript
// Available in: backend/src/audit/audit.service.ts
// Globally injectable — no need to add AuditModule to your module imports.

await this.auditService.log(
  userId,     // number     — ID of the user performing the action
  module,     // string     — Module name e.g. 'WBS', 'QUALITY', 'MATERIALS'
  action,     // string     — Action name e.g. 'DELETE_NODE', 'APPROVE_RFI'
  recordId?,  // number     — (optional) ID of the record being acted upon
  projectId?, // number     — (optional) Project context
  details?,   // object     — (optional) Any additional payload / diff data
  ipAddress?, // string     — (optional) Client IP (usually from interceptor)
);
```

---

## 6. Module Name Conventions (Use These)

| Module Name     | Route Prefix       | Used For                              |
|----------------|--------------------|---------------------------------------|
| `WBS`          | `/wbs`             | WBS nodes and activities              |
| `QUALITY`      | `/quality`         | RFI, checklists, approvals            |
| `SCHEDULE`     | `/planning`        | Distribution, versioning, baselines   |
| `MICRO_SCHEDULE`| `/micro-schedule` | Site-level micro schedules            |
| `BOQ`          | `/boq`             | Bill of Quantities items              |
| `EPS`          | `/eps`             | Enterprise Project Structure          |
| `TEAM`         | `/projects`        | Team assignments, roles               |
| `RESOURCES`    | `/resources`       | Resource master and analysis          |
| `LABOR`        | `/labor`           | Daily labor presence and categories   |
| `PROGRESS`     | `/progress`        | Progress tracking and records         |
| `EHS`          | `/ehs`             | Safety, incidents, inspections        |
| `DESIGN`       | `/design`          | Drawings and revisions                |
| `WORKDOC`      | `/workdoc`         | Vendors, work orders                  |
| `AUTH`         | `/users`, `/roles` | User and role management              |
| `SYSTEM`       | `/calendars`       | Calendars, templates, system settings |
| *YOUR MODULE*  | `/your-route`      | Add to audit-module-map.ts            |

---

## 7. Action Name Conventions (Use These Verbs)

```
CREATE_*        — new record created
UPDATE_*        — existing record modified
DELETE_*        — record removed permanently
APPROVE_*       — approval granted
REJECT_*        — approval denied
ASSIGN_*        — assignment made
REMOVE_*        — assignment removed
IMPORT_*        — bulk data imported
EXPORT_*        — data exported
COMPLETE_*      — activity/stage completed
DISTRIBUTE_*    — duplicated to sub-projects
RAISE_*         — request raised (e.g. RFI)
CLONE_*         — record duplicated
REORDER_*       — sequence/order changed
UPDATE_STATUS   — status transition
UPDATE_*_STATUS — specific status for an entity type
```

---

## 8. What to Log vs. What Not to Log

### ✅ LOG These:
- Creating, updating, or deleting any data record
- Status transitions (especially approvals, rejections)
- Assignment and removal of users to projects/roles
- Import/export operations
- Deletions of named entities (capture name/code BEFORE deletion)

### ❌ DO NOT LOG These:
- GET/READ requests (read-only, never log)
- Failed/errored requests (no false-positive entries)
- Repeated heartbeat or polling calls
- Internal background job housekeeping
- Audit log reads themselves (already in `AUDIT_SKIP_ROUTES`)

---

## 9. What Every Audit Entry Looks Like in the DB

```json
{
  "id": 1042,
  "timestamp": "2026-02-22T17:44:59.000Z",
  "userId": 4,
  "user": { "id": 4, "username": "manoranjan" },
  "module": "WBS",
  "action": "DELETE_NODE",
  "recordId": "89",
  "projectId": 3,
  "ipAddress": "192.168.1.10",
  "details": {
    "code": "WBS-2.3",
    "name": "Foundation - Block B"
  }
}
```

---

## 10. Anti-Patterns — NEVER Do These

| ❌ Anti-Pattern | ✅ Correct Approach |
|----------------|---------------------|
| Throwing errors inside auditService.log() | Wrap in try/catch internally (already done in AuditService) |
| Awaiting audit logs in the critical path without protection | auditService.log() is already try/catch wrapped |
| Logging passwords or tokens in `details` | Sanitise body before logging — interceptor does this automatically |
| Adding `AuditModule` to every new module's imports | Not needed — AuditModule is `@Global()` |
| Using `auditService.log()` for every simple CRUD (over-engineering) | Use `@Auditable()` (Layer 2) for simple cases |
| Skipping audit for a new module because "it's low risk" | ALWAYS register in `audit-module-map.ts` — even low-risk modules |
| Storing entire request/response bodies as details | Only log key fields — max 10 scalar values from the body |

---

## 11. File Reference Map

| Need to...                             | Edit This File                                        |
|---------------------------------------|-------------------------------------------------------|
| Register a new module route            | `backend/src/audit/audit-module-map.ts`               |
| Add semantic label to a controller method | Your controller — add `@Auditable()` decorator     |
| Log deep before/after in a service    | Your service — call `auditService.log()`              |
| View all audit entries (admin UI)     | `frontend/src/views/admin/SystemLogs.tsx`              |
| Add new action to the query API       | `backend/src/audit/audit.controller.ts`               |
| Understand interceptor logic           | `backend/src/audit/audit.interceptor.ts`              |
| Read the architecture plan            | `.module_Plans/AUDIT_LOGGING_GUIDE.md`                |

---

## 12. AI Governance Rules

When an AI agent is asked to **build a new module**, it MUST:

1. ✅ Add the route prefix to `ROUTE_MODULE_MAP` in `audit-module-map.ts`
2. ✅ Import `{ Auditable }` from `'../audit/auditable.decorator'` in the new controller
3. ✅ Annotate every `@Post()`, `@Patch()`, `@Put()`, `@Delete()` method with `@Auditable()`
4. ✅ Inject `AuditService` in the service when before/after state diffs are needed
5. ✅ Use SCREAMING_SNAKE_CASE for all module and action names
6. ✅ Never expose a delete endpoint for audit_logs
7. ✅ Never log sensitive fields (password, token, secret)

Failure to register in `audit-module-map.ts` means the module is **invisible to the audit system**.

---

## Governance Rule

This document is **authoritative and binding**.  
Any new module built without audit integration as defined here is **incomplete and non-compliant**.
