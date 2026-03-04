# Temporary Vendor User Management — Implementation Plan

**Module:** Planning → Vendor User Management
**Status:** Design / Pre-implementation
**Author:** SETU Architecture Team
**Date:** 2026-02-28

---

## 1. Business Problem

In the current system, only admins can create user accounts. On a live construction site,
vendors and contractors (e.g., civil contractors raising RFIs, sub-contractors uploading
rectification evidence) need login access. Waiting for admin every time is impractical.

**Solution:** Allow planning engineers (site-in-charge) to create temporary, vendor-linked
user accounts — but only within permission boundaries pre-defined by the admin.

---

## 2. Actors & Roles

| Actor | Who | What they can do in this module |
|---|---|---|
| **Admin** | System administrator | Define Temporary Role Templates (permission ceilings) |
| **Planning Engineer** | Site-in-charge, non-admin | Create temp users for vendors linked to work orders |
| **Temporary User** | Vendor / contractor person | Log in, access ONLY assigned modules, ONLY assigned project |

---

## 3. Complete Workflow

```
ADMIN SETUP (one-time or as-needed)
────────────────────────────────────────────────────────────────
  Admin logs in → Admin Panel → Settings → Vendor Access Templates
      │
      ├── Creates "Vendor-RFI Reporter" template
      │     Permissions: [QUALITY.RFI.RAISE, QUALITY.OBSERVATION.VIEW]
      │
      ├── Creates "Contractor Rectification" template
      │     Permissions: [QUALITY.OBSERVATION.RECTIFY, QUALITY.EVIDENCE.UPLOAD]
      │
      └── Creates "Vendor Progress Reporter" template
            Permissions: [PROGRESS.ENTRY.CREATE, PROGRESS.VIEW]

      These templates define the MAX permissions a temp user can ever get.
      Admin publishes templates → available to Planning Engineers.


PLANNING ENGINEER WORKFLOW (per vendor / per work order)
────────────────────────────────────────────────────────────────
  Planning Engineer → Planning Module → Vendor User Management
      │
      Step 1: SELECT PROJECT
      │   (auto-populated from engineer's current project context)
      │
      Step 2: SELECT VENDOR
      │   Pull vendor list from: GET /planning/work-orders/vendors?projectId=X
      │   Only vendors with at least one ACTIVE work order on this project shown.
      │
      Step 3: SELECT WORK ORDER
      │   Pull work orders: GET /planning/work-orders?vendorId=Y&projectId=X
      │   Shows WO number, scope, validity dates.
      │   Validates: WO must be ACTIVE and not expired.
      │
      Step 4: CREATE USER DETAILS
      │   Form fields:
      │     - Full Name (required)
      │     - Mobile Number (required, used as username)
      │     - Email (optional)
      │     - Designation (e.g., "Site Supervisor")
      │
      Step 5: ASSIGN ROLE TEMPLATE
      │   Dropdown: admin-defined templates only.
      │   Engineer CANNOT create custom permissions — must pick from templates.
      │
      Step 6: REVIEW & CONFIRM
      │   Summary card:
      │     Vendor: ABC Contractors
      │     Work Order: WO-2024-042 (valid until 30-Jun-2026)
      │     Role: Vendor-RFI Reporter
      │     Permissions: QUALITY.RFI.RAISE, QUALITY.OBSERVATION.VIEW
      │   [Create User] button
      │
      Step 7: SYSTEM ACTIONS (backend, automatic)
            ├── Creates User record (username = mobile number)
            ├── Generates temporary password (sent via SMS / shown once)
            ├── Creates TempUser record (links user ↔ vendor ↔ WO ↔ project)
            ├── Assigns role permissions from template to user
            ├── Auto-adds user to project team (so they can access the project)
            └── Sets expiry = work order end date


TEMP USER EXPERIENCE
────────────────────────────────────────────────────────────────
  Temp user logs in via mobile app / web
      │
      ├── JWT token issued (8-hour expiry vs 24h for permanent users)
      ├── Token payload includes: { isTempUser: true, vendorId, workOrderId }
      │
      ├── Middleware check on every request:
      │     1. Is work order still ACTIVE? (not expired/cancelled)
      │     2. Is temp user still active (not suspended by engineer)?
      │     3. Does the requested resource belong to user's assigned project?
      │
      └── Sees only: modules matching their template permissions
          Project scope: only their assigned project (cannot browse others)


AUTO-EXPIRY / LIFECYCLE
────────────────────────────────────────────────────────────────
  When work order is CLOSED or CANCELLED in planning module:
      └── All temp users linked to that WO → status set to EXPIRED
          └── Their next login attempt is rejected with "Access expired"

  Daily cron job:
      └── Checks all TempUser records where expiryDate < today
          └── Sets status = EXPIRED
```

---

## 4. Database Schema

### 4.1 New Table: `temp_role_templates`

```sql
CREATE TABLE temp_role_templates (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,       -- "Vendor-RFI Reporter"
  description     TEXT,
  allowed_permissions  JSONB NOT NULL,          -- ["QUALITY.RFI.RAISE", "QUALITY.OBSERVATION.VIEW"]
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

### 4.2 New Table: `temp_users`

```sql
CREATE TABLE temp_users (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vendor_id             INTEGER REFERENCES vendors(id),      -- from planning module
  work_order_id         INTEGER REFERENCES work_orders(id),  -- from planning module
  project_id            INTEGER REFERENCES eps_nodes(id),    -- the EPS project node
  temp_role_template_id INTEGER REFERENCES temp_role_templates(id),
  expiry_date           DATE NOT NULL,           -- = work order end date
  status                VARCHAR(20) DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED')),
  created_by            INTEGER REFERENCES users(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  suspended_at          TIMESTAMP,
  suspended_by          INTEGER REFERENCES users(id),
  suspension_reason     TEXT
);

CREATE INDEX idx_temp_users_work_order ON temp_users(work_order_id);
CREATE INDEX idx_temp_users_project    ON temp_users(project_id);
CREATE INDEX idx_temp_users_status     ON temp_users(status);
```

### 4.3 Existing Tables to Leverage (READ-ONLY from this module)

- `vendors` — from planning module
- `work_orders` — from planning module
- `users` — base auth table (new user record created here)
- `user_permissions` or `user_roles` — existing permission assignment table
- `project_members` / `team_members` — for project access control

---

## 5. NestJS Backend Structure

```
backend/src/temp-user/
├── temp-user.module.ts
├── temp-user.controller.ts        ← /temp-users endpoints (planning engineer)
├── temp-user.service.ts
├── temp-role.controller.ts        ← /temp-roles endpoints (admin only)
├── temp-role.service.ts
├── temp-user-auth.guard.ts        ← middleware: validates WO still active on each request
├── temp-user-expiry.cron.ts       ← daily job to expire stale temp users
└── entities/
    ├── temp-role-template.entity.ts
    └── temp-user.entity.ts
```

---

## 6. API Endpoint Specification

### 6.1 Admin Endpoints — Temp Role Templates

```
GET    /temp-roles
       Permission: TEMP_ROLE.VIEW
       Returns: list of all templates with their permission sets

POST   /temp-roles
       Permission: TEMP_ROLE.MANAGE (admin only)
       Body: { name, description, allowedPermissions: string[] }
       Returns: created template
       Pseudocode:
         validatePermissions(allowedPermissions)  // must be from master permission list
         if any permission not in MASTER_PERMISSION_LIST → throw 400
         return templateRepo.save({ name, description, allowedPermissions, createdBy })

PUT    /temp-roles/:id
       Permission: TEMP_ROLE.MANAGE
       Body: { name?, description?, allowedPermissions?, isActive? }
       Returns: updated template

DELETE /temp-roles/:id
       Permission: TEMP_ROLE.MANAGE
       Soft-delete: sets isActive = false
       Note: does NOT affect existing temp users with this template
```

### 6.2 Planning Engineer Endpoints — Temp User Management

```
GET    /temp-users/vendors?projectId=:id
       Permission: TEMP_USER.CREATE
       Returns: vendors that have ACTIVE work orders on this project
       Pseudocode:
         workOrders = workOrderRepo.find({
           projectId, status: IN ['ACTIVE', 'IN_PROGRESS'],
           endDate: >= today
         })
         vendorIds = unique(workOrders.map(wo => wo.vendorId))
         return vendorRepo.findByIds(vendorIds)

GET    /temp-users/work-orders?vendorId=:id&projectId=:id
       Permission: TEMP_USER.CREATE
       Returns: active work orders for this vendor on this project
       Pseudocode:
         return workOrderRepo.find({
           vendorId, projectId,
           status: IN ['ACTIVE', 'IN_PROGRESS'],
           endDate: >= today
         })

POST   /temp-users
       Permission: TEMP_USER.CREATE
       Body: {
         vendorId, workOrderId, projectId,
         templateId,
         fullName, mobile, email?, designation?
       }
       Returns: { user: {...}, tempUser: {...}, generatedPassword }
       Pseudocode:
         // 1. Validate work order
         workOrder = workOrderRepo.findOne({ id: workOrderId, vendorId, projectId })
         if (!workOrder || workOrder.status != 'ACTIVE') throw 400('Invalid/inactive WO')
         if (workOrder.endDate < today) throw 400('Work order expired')

         // 2. Validate template
         template = templateRepo.findOne({ id: templateId, isActive: true })
         if (!template) throw 400('Template not found or inactive')

         // 3. Check no duplicate user for same WO
         existing = tempUserRepo.findOne({ workOrderId, mobile, status: 'ACTIVE' })
         if (existing) throw 409('User already exists for this work order')

         // 4. Create base User
         username = mobile  // mobile number as username
         tempPassword = generatePassword(8)  // e.g., "WO2024@42"
         user = userRepo.save({
           username, displayName: fullName, email,
           phone: mobile, designation,
           passwordHash: hash(tempPassword),
           isTempUser: true,
           isFirstLogin: true   // forces password change on first login
         })

         // 5. Assign permissions from template
         for (perm of template.allowedPermissions) {
           userPermissionRepo.save({ userId: user.id, permission: perm })
         }

         // 6. Create TempUser record
         tempUser = tempUserRepo.save({
           userId: user.id, vendorId, workOrderId, projectId,
           tempRoleTemplateId: templateId,
           expiryDate: workOrder.endDate,
           status: 'ACTIVE',
           createdBy: req.user.id
         })

         // 7. Add to project team
         projectTeamRepo.save({ userId: user.id, projectId, role: 'VENDOR' })

         return { user, tempUser, generatedPassword: tempPassword }

GET    /temp-users?projectId=:id
       Permission: TEMP_USER.VIEW
       Returns: all temp users for this project with status, vendor, WO info

PUT    /temp-users/:id/suspend
       Permission: TEMP_USER.SUSPEND
       Body: { reason }
       Pseudocode:
         tempUser.status = 'SUSPENDED'
         tempUser.suspendedAt = now()
         tempUser.suspendedBy = req.user.id
         tempUser.suspensionReason = reason
         // Revoke all active JWT tokens for this user (via token blacklist or user version bump)

PUT    /temp-users/:id/reactivate
       Permission: TEMP_USER.SUSPEND
       Validates: work order must still be active before reactivating
```

### 6.3 Middleware — Request Guard for Temp Users

```typescript
// temp-user-auth.guard.ts
// Applied globally after JwtAuthGuard

async canActivate(context: ExecutionContext): Promise<boolean> {
  const req = context.switchToHttp().getRequest()
  const user = req.user

  if (!user?.isTempUser) return true  // not a temp user, pass through

  // Find temp user record
  const tempUser = await tempUserRepo.findOne({
    where: { userId: user.id, status: 'ACTIVE' }
  })

  if (!tempUser) throw new UnauthorizedException('Temp user access revoked')

  // Check work order still active
  const workOrder = await workOrderRepo.findOne({ id: tempUser.workOrderId })
  if (!workOrder || workOrder.status === 'CANCELLED') {
    await tempUserRepo.update(tempUser.id, { status: 'EXPIRED' })
    throw new UnauthorizedException('Work order cancelled — access revoked')
  }

  // Check expiry
  if (new Date() > tempUser.expiryDate) {
    await tempUserRepo.update(tempUser.id, { status: 'EXPIRED' })
    throw new UnauthorizedException('Temporary access has expired')
  }

  // Inject vendor context into request for downstream use
  req.vendorContext = { vendorId: tempUser.vendorId, workOrderId: tempUser.workOrderId }
  return true
}
```

### 6.4 Cron Job — Auto-Expiry

```typescript
// temp-user-expiry.cron.ts
@Cron('0 1 * * *')  // runs at 1:00 AM daily
async expireStaleUsers() {
  const expired = await tempUserRepo.find({
    where: {
      status: 'ACTIVE',
      expiryDate: LessThan(new Date())
    }
  })

  for (const tu of expired) {
    await tempUserRepo.update(tu.id, { status: 'EXPIRED' })
    logger.log(`Temp user ${tu.userId} expired (WO: ${tu.workOrderId})`)
  }
}
```

---

## 7. Frontend — React Web

### 7.1 Admin Panel: Vendor Access Templates

**Route:** `/admin/vendor-access-templates`

```
Page: VendorAccessTemplatesPage
├── Header: "Vendor Access Templates"  + [+ New Template] button
├── Table:
│   Columns: Name | Permissions | Status | Created By | Actions
│   Actions: Edit | Deactivate
└── Modal: CreateEditTemplateModal
    ├── Name (text input)
    ├── Description (textarea)
    ├── Permissions (multi-select checkbox list)
    │   Grouped by module:
    │   [QUALITY]
    │     ☑ QUALITY.RFI.RAISE
    │     ☐ QUALITY.OBSERVATION.RECTIFY
    │     ☑ QUALITY.EVIDENCE.UPLOAD
    │   [PROGRESS]
    │     ☐ PROGRESS.ENTRY.CREATE
    │     ☐ PROGRESS.VIEW
    └── [Save Template] button
```

```typescript
// Pseudocode: VendorAccessTemplatesPage.tsx

const [templates, setTemplates] = useState<TempRoleTemplate[]>([])
const [showModal, setShowModal] = useState(false)
const [editing, setEditing] = useState<TempRoleTemplate | null>(null)

// Load templates
useEffect(() => {
  api.get('/temp-roles').then(r => setTemplates(r.data))
}, [])

const handleSave = async (formData) => {
  if (editing) {
    await api.put(`/temp-roles/${editing.id}`, formData)
  } else {
    await api.post('/temp-roles', formData)
  }
  // refresh list
}

const handleDeactivate = (id) => {
  confirm('Deactivate this template?') && api.delete(`/temp-roles/${id}`)
}
```

### 7.2 Planning Module: Vendor User Management

**Route:** `/planning/vendor-users`

```
Page: VendorUserManagementPage
├── Project context header (auto from current project)
├── [+ Create Vendor User] button  → opens CreateTempUserWizard
├── Active Users table:
│   Columns: Name | Mobile | Vendor | Work Order | Role | Status | Expiry | Actions
│   Actions: Suspend | View Details
└── Suspended/Expired tab (historical)

Wizard: CreateTempUserWizard (4 steps)
├── Step 1: Vendor & Work Order
│   ├── Vendor dropdown (from /temp-users/vendors?projectId=X)
│   ├── Work Order dropdown (loads after vendor selected)
│   └── Shows WO details: scope, validity dates, value
├── Step 2: User Details
│   ├── Full Name *
│   ├── Mobile Number * (becomes username)
│   ├── Email (optional)
│   └── Designation
├── Step 3: Access Role
│   ├── Template dropdown (admin-defined only)
│   └── Permission preview panel:
│       "This user will be able to:"
│       • Raise RFIs
│       • View quality observations
│       (expanded list of what each permission means in plain English)
└── Step 4: Review & Create
    ├── Summary card with all details
    ├── Warning: "A temporary password will be generated. Share it securely."
    └── [Create User] → shows one-time password display dialog
```

```typescript
// Pseudocode: CreateTempUserWizard.tsx

const [step, setStep] = useState(1)
const [vendors, setVendors] = useState([])
const [workOrders, setWorkOrders] = useState([])
const [templates, setTemplates] = useState([])
const [form, setForm] = useState({
  vendorId: null, workOrderId: null,
  fullName: '', mobile: '', email: '', designation: '',
  templateId: null
})

// Step 1: load vendors on mount
useEffect(() => {
  api.get(`/temp-users/vendors?projectId=${projectId}`)
     .then(r => setVendors(r.data))
}, [])

// Step 1: load WOs when vendor selected
const onVendorSelect = (vendorId) => {
  setForm({ ...form, vendorId })
  api.get(`/temp-users/work-orders?vendorId=${vendorId}&projectId=${projectId}`)
     .then(r => setWorkOrders(r.data))
}

// Step 3: load templates
useEffect(() => {
  if (step === 3) {
    api.get('/temp-roles').then(r => setTemplates(r.data.filter(t => t.isActive)))
  }
}, [step])

// Final submit
const handleCreate = async () => {
  const res = await api.post('/temp-users', {
    ...form, projectId
  })
  showOneTimePasswordDialog(res.data.generatedPassword)
  onSuccess()
}
```

---

## 8. Permission Constants (Master List)

The following permissions are the only ones **assignable** to temporary users.
Admin can only choose from this list when creating templates.

```typescript
// shared/temp-user-permissions.constants.ts

export const TEMP_USER_ASSIGNABLE_PERMISSIONS = {
  QUALITY: [
    { key: 'QUALITY.RFI.RAISE',         label: 'Raise RFI' },
    { key: 'QUALITY.OBSERVATION.VIEW',   label: 'View Observations' },
    { key: 'QUALITY.OBSERVATION.RECTIFY',label: 'Submit Rectification' },
    { key: 'QUALITY.EVIDENCE.UPLOAD',    label: 'Upload Evidence Photos' },
    { key: 'QUALITY.CHECKLIST.FILL',     label: 'Fill Checklists' },
  ],
  PROGRESS: [
    { key: 'PROGRESS.ENTRY.CREATE',      label: 'Submit Progress Entry' },
    { key: 'PROGRESS.VIEW',              label: 'View Progress Dashboard' },
  ],
  SNAG: [
    { key: 'SNAG.VIEW',                  label: 'View Snag List' },
    { key: 'SNAG.RESPOND',               label: 'Respond to Snag Items' },
  ],
}

// Permissions that can NEVER be assigned to temp users (enforced by backend)
export const TEMP_USER_BLOCKED_PERMISSIONS = [
  'USER.CREATE', 'USER.MANAGE',
  'ADMIN.*',
  'PLANNING.*',
  'FINANCE.*',
  'TEMP_ROLE.MANAGE',
  'TEMP_USER.CREATE',
]
```

---

## 9. Security Rules (Enforced at Backend)

```
1. Temp users CANNOT create other users (isTempUser check on user creation)
2. Temp users CANNOT change their own permissions
3. Temp users CANNOT access any project other than their assigned one
4. Permissions list in JWT is intersection of (template perms) and (assignable perms list)
   → even if DB is manually modified, blocked perms are stripped at token generation
5. Temp user JWT expires in 8 hours (vs 24h for permanent users)
6. Password must be changed on first login (isFirstLogin flag)
7. Planning engineer can only manage temp users they created (not others')
   UNLESS they have TEMP_USER.MANAGE (admin-level) permission
8. All temp user actions are audit-logged with { isTempUser, vendorId, workOrderId }
```

---

## 10. Mobile App Impact (Flutter)

```dart
// After login, check if temp user and set context
if (user.isTempUser) {
  // Show only modules matching their permissions
  // Lock project navigation to their assigned project only
  // Show vendor context banner: "Logged in as: ABC Contractors"
}

// Navigation guard: if temp user tries to access unauthorized module
if (user.isTempUser && !user.permissions.contains(requiredPermission)) {
  showDialog("You don't have access to this feature")
}

// Auto-logout when WO expires (API returns 401 with reason: 'TEMP_EXPIRED')
if (dioError.response?.statusCode == 401) {
  final reason = dioError.response?.data['reason']
  if (reason == 'TEMP_EXPIRED') {
    showDialog("Your temporary access has expired. Contact your site engineer.")
    logoutUser()
  }
}
```

---

## 11. Work Order Integration Hook

When a work order status changes to `CANCELLED` or `COMPLETED` in the planning module:

```typescript
// work-order.service.ts — existing service, add this hook

async closeWorkOrder(workOrderId: number, status: 'COMPLETED' | 'CANCELLED') {
  // ... existing close logic ...

  // NEW: Expire all temp users linked to this WO
  await this.tempUserRepo.update(
    { workOrderId, status: 'ACTIVE' },
    { status: 'EXPIRED', suspendedAt: new Date() }
  )

  this.logger.log(`Expired temp users for WO ${workOrderId}`)
}
```

---

## 12. Implementation Phases

### Phase 1 — Foundation (Week 1)
- [ ] DB migration: `temp_role_templates` + `temp_users` tables
- [ ] NestJS entities for both tables
- [ ] `TempRoleModule` with admin CRUD endpoints
- [ ] `isTempUser` flag on User entity

### Phase 2 — Core Creation Flow (Week 2)
- [ ] `POST /temp-users` endpoint with full validation
- [ ] Vendor + Work Order lookup endpoints
- [ ] Auto team membership assignment
- [ ] One-time password generation + display

### Phase 3 — Auth Middleware (Week 2)
- [ ] `TempUserAuthGuard` — WO active check on every request
- [ ] Daily cron job for auto-expiry
- [ ] Work order close hook

### Phase 4 — Frontend (Week 3)
- [ ] Admin: Vendor Access Templates page
- [ ] Planning: Vendor User Management page
- [ ] `CreateTempUserWizard` 4-step component
- [ ] Suspend/Reactivate actions

### Phase 5 — Mobile (Week 4)
- [ ] Vendor context banner for temp users
- [ ] Module access guard on mobile
- [ ] Graceful handling of `TEMP_EXPIRED` 401 response

---

## 13. Open Questions / Decisions Needed

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Where to store vendor/work order data? | Existing planning module tables vs new | Use existing — query from planning module |
| 2 | Password delivery | Show once on screen, SMS, email | Show once + copy button (simplest) |
| 3 | Can one temp user have multiple WOs/projects? | One-to-one vs many | Start with one active assignment per user |
| 4 | Who can suspend temp users? | Only creator, any planning engineer, any manager | Creator + users with TEMP_USER.MANAGE permission |
| 5 | Token blacklist on suspension | Redis blacklist vs version bump in DB | DB version bump (no Redis dependency) |
| 6 | Temp user project scope | Single project only or multi-project via multiple WOs | Single project per temp user record |

---

## 14. File Creation Checklist

```
backend/
  src/temp-user/
    temp-user.module.ts
    temp-user.controller.ts
    temp-user.service.ts
    temp-role.controller.ts
    temp-role.service.ts
    temp-user-auth.guard.ts
    temp-user-expiry.cron.ts
    entities/
      temp-role-template.entity.ts
      temp-user.entity.ts
    dto/
      create-temp-role.dto.ts
      create-temp-user.dto.ts
  src/migrations/
    XXXX-add-temp-user-tables.ts

frontend/
  src/pages/admin/VendorAccessTemplatesPage.tsx
  src/pages/planning/VendorUserManagementPage.tsx
  src/components/temp-user/
    CreateTempUserWizard.tsx
    TempUserTable.tsx
    TempRoleTemplateForm.tsx
    PermissionSelector.tsx
  src/services/tempUser.service.ts

flutter/
  lib/features/temp_user/
    (minimal: auth guard changes + vendor banner only)
```
