# Issue Tracker — Enhanced Implementation Plan (v2)

**Date:** 2026-03-18
**Status:** PLAN — Do not implement until approved
**Based on:** Existing code audit of issue-tracker-*.entity.ts, issue-tracker.service.ts, IssueTrackerPage.tsx, issueTracker.service.ts

---

## 1. Current State Audit

What already exists and what is wrong:

| Existing | Problem |
|---|---|
| `issue_tracker_departments` has `projectId` column | Must be GLOBAL (admin panel) — no projectId |
| Department `memberUserIds` stored as jsonb on department row | Members are project-specific — must be separate table |
| No `priority` on issues | Required |
| No commitment date change history | Required — only one date stored |
| No activity/audit log per issue | No trace of who did what |
| No notification system | Required |
| No drag-and-drop flow order on departments | Required |
| No per-issue flow editing | Required |
| No Kanban view | Required |
| No issue serial number (ISS-001) | Hard to reference in conversations |
| No attachments | Required |
| Single-page UI with tabs — no Kanban | Needs full redesign |
| Department management mixed inside project page | Must move to Admin Panel |

---

## 2. Architecture Decision: Two Levels

| Level | Where | What |
|---|---|---|
| **Global** | Admin Panel (`/admin/issue-tracker`) | Define departments (name, color, sequence, description) |
| **Project** | Issue Tracker page (`/projects/:id/issue-tracker`) | Assign members to departments per project, create/manage issues, Kanban |

Departments are like **master data** — defined once, reused across all projects. Member assignments are project-specific.

---

## 3. Data Model — Full Redesign

### 3.1 Schema Changes Overview

| Table | Action | What Changes |
|---|---|---|
| `issue_tracker_departments` | ALTER | Remove `projectId`, remove `memberUserIds`, add `sequenceOrder`, add `defaultSladays` |
| `issue_tracker_dept_project_config` | CREATE NEW | Project-level member assignment per department |
| `issue_tracker_issues` | ALTER | Add `priority`, `issueNumber`, `attachmentCount`, `commentCount` |
| `issue_tracker_steps` | ALTER | Add `slaDays`, `dueDays` (computed), `isOverdue` flag |
| `issue_tracker_commitment_history` | CREATE NEW | Full history of every commitment date change |
| `issue_tracker_activity_log` | CREATE NEW | Audit trail: every action on every issue |
| `issue_tracker_attachments` | CREATE NEW | File/photo attachments on issues and step responses |
| `issue_tracker_notifications` | CREATE NEW | Per-user notification queue |

---

### 3.2 Altered Entity: `issue_tracker_departments`

**Migration: remove `projectId`, remove `memberUserIds`, add new columns**

```typescript
@Entity('issue_tracker_departments')
export class IssueTrackerDepartment {
  @PrimaryGeneratedColumn()
  id: number;

  // REMOVED: projectId  (departments are now global)
  // REMOVED: memberUserIds  (moved to issue_tracker_dept_project_config)

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null;          // hex color for Kanban column header

  @Column({ type: 'varchar', length: 60, nullable: true })
  icon: string | null;           // lucide icon name e.g. "Hammer", "Zap", "Droplets"

  @Column({ type: 'int', default: 0 })
  sequenceOrder: number;         // drag-and-drop default flow order (1, 2, 3…)

  @Column({ type: 'int', nullable: true })
  defaultSlaDays: number | null; // default days this dept gets to respond

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

**Global endpoints (Admin Panel):**
```
GET    /admin/issue-tracker/departments             → list all global departments (ordered by sequenceOrder)
POST   /admin/issue-tracker/departments             → create department
PATCH  /admin/issue-tracker/departments/:id         → edit name/color/icon/slaDays
DELETE /admin/issue-tracker/departments/:id         → soft-delete (isActive=false)
PATCH  /admin/issue-tracker/departments/reorder     → drag-and-drop: save new sequenceOrder array
```

---

### 3.3 New Entity: `issue_tracker_dept_project_config`

Project-level member assignment for each department.

```typescript
@Entity('issue_tracker_dept_project_config')
export class IssueTrackerDeptProjectConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;               // which project

  @Column({ type: 'int' })
  departmentId: number;            // which global department

  @Column({ type: 'varchar', length: 150 })
  departmentName: string;          // denormalised for speed

  @Column({ type: 'jsonb', nullable: true })
  memberUserIds: number[] | null;  // users assigned to this dept on this project

  @Column({ type: 'int', nullable: true })
  coordinatorUserId: number | null; // the one person who can CLOSE from this dept

  @Column({ type: 'varchar', length: 150, nullable: true })
  coordinatorName: string | null;

  @Column({ type: 'boolean', default: true })
  isIncludedInDefaultFlow: boolean; // if false, dept is not auto-added to new issues

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
// UNIQUE INDEX on (projectId, departmentId)
```

**Rules:**
- `memberUserIds` — team members who can **respond** (mark complete from their end)
- `coordinatorUserId` — the single person who **closes** the department step (moves issue to next dept)
- A department member can respond but the **coordinator closes** — this satisfies "marking member to that department is project level... coordinator closes the department level"

**Project-level endpoints:**
```
GET    /planning/:projectId/issue-tracker/dept-config           → all dept configs for project
POST   /planning/:projectId/issue-tracker/dept-config           → add dept to project + assign members
PUT    /planning/:projectId/issue-tracker/dept-config/:id       → update members/coordinator
DELETE /planning/:projectId/issue-tracker/dept-config/:id       → remove dept from project
```

---

### 3.4 Altered Entity: `issue_tracker_issues`

New columns to add:

```typescript
// ADD to existing issue_tracker_issues table:

@Column({ type: 'varchar', length: 20, nullable: true })
issueNumber: string | null;       // auto-generated: "ISS-0001", "ISS-0002"

@Column({ type: 'varchar', length: 20, default: 'MEDIUM' })
priority: IssuePriority;          // CRITICAL | HIGH | MEDIUM | LOW

@Column({ type: 'jsonb', nullable: true })
customFlowDepartmentIds: number[] | null;
// If null → use global default dept sequence
// If set → this issue has a custom department flow

@Column({ type: 'int', default: 0 })
attachmentCount: number;          // denormalised counter for fast display

@Column({ type: 'int', default: 0 })
commentCount: number;             // denormalised activity log count

// NEW enum
export enum IssuePriority {
  CRITICAL = 'CRITICAL',
  HIGH     = 'HIGH',
  MEDIUM   = 'MEDIUM',
  LOW      = 'LOW',
}
```

**Priority colour map (frontend):**
| Priority | Color | Background |
|---|---|---|
| CRITICAL | `#DC2626` red | `#FEE2E2` |
| HIGH | `#EA580C` orange | `#FED7AA` |
| MEDIUM | `#D97706` amber | `#FEF3C7` |
| LOW | `#059669` green | `#D1FAE5` |

---

### 3.5 Altered Entity: `issue_tracker_steps`

New columns to add:

```typescript
// ADD to existing issue_tracker_steps table:

@Column({ type: 'int', nullable: true })
slaDays: number | null;           // max days allowed — copied from dept defaultSlaDays at creation

@Column({ type: 'jsonb', nullable: true })
committedDateHistory: CommittedDateRecord[] | null;
// Array of: { date: string, changedAt: string, changedByName: string, reason: string }
// Every time committedCompletionDate changes, old value pushed here

@Column({ type: 'text', nullable: true })
coordinatorRemarks: string | null;  // remarks when coordinator closes this step

@Column({ type: 'timestamptz', nullable: true })
coordinatorClosedAt: Date | null;

@Column({ type: 'int', nullable: true })
coordinatorClosedById: number | null;

// interface for history record (stored in jsonb):
interface CommittedDateRecord {
  previousDate: string | null;
  newDate: string;
  changedAt: string;       // ISO timestamp
  changedByName: string;
  reason: string;          // mandatory when changing an existing commitment date
}
```

---

### 3.6 New Entity: `issue_tracker_activity_log`

Audit trail for every action.

```typescript
@Entity('issue_tracker_activity_log')
export class IssueTrackerActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  issueId: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'varchar', length: 60 })
  action: string;
  // Values: 'CREATED' | 'RESPONDED' | 'COORDINATOR_CLOSED' | 'STEP_MOVED'
  //         'COMMITMENT_DATE_CHANGED' | 'PRIORITY_CHANGED' | 'FLOW_EDITED'
  //         'ISSUE_CLOSED' | 'ATTACHMENT_ADDED' | 'DEPARTMENT_ADDED' | 'DEPARTMENT_REMOVED'

  @Column({ type: 'text', nullable: true })
  detail: string | null;          // human-readable description e.g. "Committed date changed from 20 Mar to 25 Mar"

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;  // raw change data

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ type: 'varchar', length: 150 })
  actorName: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

---

### 3.7 New Entity: `issue_tracker_attachments`

```typescript
@Entity('issue_tracker_attachments')
export class IssueTrackerAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  issueId: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'int', nullable: true })
  stepId: number | null;          // null = attached to the issue itself; set = attached to a step response

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  fileSizeBytes: number | null;

  @Column({ type: 'int' })
  uploadedByUserId: number;

  @Column({ type: 'varchar', length: 150 })
  uploadedByName: string;

  @CreateDateColumn()
  uploadedAt: Date;
}
```

---

### 3.8 New Entity: `issue_tracker_notifications`

```typescript
@Entity('issue_tracker_notifications')
export class IssueTrackerNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  recipientUserId: number;

  @Column({ type: 'int' })
  issueId: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'varchar', length: 60 })
  type: NotificationType;
  // 'ISSUE_ASSIGNED'       — issue landed in your department
  // 'COMMITMENT_DUE_SOON'  — commitment date is 3 days away
  // 'TARGET_DATE_DUE_SOON' — required date is 3 days away
  // 'OVERDUE'              — target date passed and issue still open
  // 'COMMITMENT_MISSED'    — commitment date passed without update
  // 'DEPT_CLOSED_MOVED'    — your dept completed, moved to next
  // 'ISSUE_CLOSED'         — issue fully closed

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  issueTitle: string | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

---

## 4. Backend Service Logic

### 4.1 Updated `createIssue` Flow

```
1. Look up the project's dept-config (isIncludedInDefaultFlow=true, ordered by dept.sequenceOrder)
2. Filter to depts that match the selected tags' departments
3. If dto.customFlowDepartmentIds is set → use that order instead
4. Create issue with issueNumber = "ISS-" + zeroPad(nextCount, 4)
5. Create steps (one per department in flow order)
6. Log activity: 'CREATED'
7. Notify: dept coordinator + members of Step 1 dept → type 'ISSUE_ASSIGNED'
```

### 4.2 `respondToIssue` (Department Member)

```
Member marks their item complete (fills responseText + committedDate if not set)
- If committedDate already set and now changing → push old date to committedDateHistory with reason
- Mark step as COMPLETED (but coordinator still needs to close to advance)
- Log activity: 'RESPONDED'
- Notify: coordinator of that department → "Member responded, ready for your review"
```

### 4.3 NEW: `coordinatorCloseStep` (Coordinator Only)

```
Coordinator signs off on their department's step:
1. Validate: user is the coordinator for this dept on this project
2. Validate: step status is ACTIVE and member has responded (responseText is set)
3. Set step: coordinatorClosedAt, coordinatorClosedById, coordinatorRemarks, status = COMPLETED
4. Advance issue to next step:
   - If next step exists → set it ACTIVE, update issue.currentDepartmentId
   - If no next step → issue.status = COMPLETED
5. Log activity: 'COORDINATOR_CLOSED'
6. Notify: next dept's coordinator + members → 'ISSUE_ASSIGNED'
7. Notify: issue raiser → 'DEPT_CLOSED_MOVED' with message "Moved from X to Y"
```

### 4.4 `updateCommitmentDate` (with history)

```
When user updates committedCompletionDate on a step:
1. If previous date exists → push {previousDate, newDate, changedAt, changedByName, reason} to committedDateHistory
2. Update committedCompletionDate
3. Log activity: 'COMMITMENT_DATE_CHANGED'
4. Notify: issue raiser of the date change
```

### 4.5 `editIssueFlow` (per-issue dept flow editing)

```
Per-issue flow editing:
- addDepartmentToFlow(issueId, deptId, insertAfterStepId?) → insert new PENDING step at position
- removeDepartmentFromFlow(issueId, stepId) → only if step is PENDING (not active/completed)
- reorderSteps(issueId, newSequenceOrder[]) → drag-and-drop reorder of PENDING future steps
Log activity: 'FLOW_EDITED' / 'DEPARTMENT_ADDED' / 'DEPARTMENT_REMOVED'
```

### 4.6 Notification Scheduler (Cron)

```typescript
// Runs daily at 8:00 AM
@Cron('0 8 * * *')
async runDailyNotifications() {
  const today = new Date();

  // 1. Commitment date due in 3 days
  const soonCommitted = await stepRepo
    .createQueryBuilder('step')
    .where("step.committedCompletionDate = :date", { date: addDays(today, 3) })
    .andWhere("step.status = 'ACTIVE'")
    .getMany();
  // → notify dept members + coordinator

  // 2. Target date due in 3 days
  const soonRequired = await issueRepo
    .createQueryBuilder('issue')
    .where("issue.requiredDate = :date", { date: formatDate(addDays(today, 3)) })
    .andWhere("issue.status NOT IN ('CLOSED','COMPLETED')")
    .getMany();
  // → notify issue raiser + current dept members + coordinator

  // 3. Overdue issues (requiredDate passed, not closed)
  const overdue = await issueRepo
    .createQueryBuilder('issue')
    .where("issue.requiredDate < :today", { today: formatDate(today) })
    .andWhere("issue.status NOT IN ('CLOSED','COMPLETED')")
    .getMany();
  // → notify issue raiser + current dept + send push via FCM

  // 4. Commitment date missed (not updated)
  const missedCommitment = await stepRepo
    .createQueryBuilder('step')
    .where("step.committedCompletionDate < :today", { today: formatDate(today) })
    .andWhere("step.status = 'ACTIVE'")
    .getMany();
  // → notify dept members + coordinator
}
```

---

## 5. REST API — Full Endpoint List

### Admin Panel (Global Departments)
```
GET    /admin/issue-tracker/departments              → list all global depts (ordered by sequenceOrder)
POST   /admin/issue-tracker/departments              → create global dept
PATCH  /admin/issue-tracker/departments/:id          → update name/color/icon/slaDays
DELETE /admin/issue-tracker/departments/:id          → soft-delete
PATCH  /admin/issue-tracker/departments/reorder      → save new drag-drop sequenceOrder
                                                       body: { orderedIds: number[] }
```

### Project-Level Department Config
```
GET    /planning/:pId/issue-tracker/dept-config              → all dept configs for project
POST   /planning/:pId/issue-tracker/dept-config              → add dept to project
PUT    /planning/:pId/issue-tracker/dept-config/:id          → update members/coordinator
DELETE /planning/:pId/issue-tracker/dept-config/:id          → remove dept from project
```

### Tags (no change to structure, just linked to global depts now)
```
GET    /planning/:pId/issue-tracker/tags             → list tags
POST   /planning/:pId/issue-tracker/tags             → create tag
PUT    /planning/:pId/issue-tracker/tags/:id         → update tag
DELETE /planning/:pId/issue-tracker/tags/:id         → soft-delete
```

### Issues
```
GET    /planning/:pId/issue-tracker/issues           → list issues
                                                       ?scope=all|department|my|overdue
                                                       ?status=OPEN|IN_PROGRESS|COMPLETED|CLOSED
                                                       ?priority=CRITICAL|HIGH|MEDIUM|LOW
                                                       ?departmentId=X
POST   /planning/:pId/issue-tracker/issues           → create issue
GET    /planning/:pId/issue-tracker/issues/:id       → get full detail
PATCH  /planning/:pId/issue-tracker/issues/:id       → edit title/description/priority/requiredDate
DELETE /planning/:pId/issue-tracker/issues/:id       → delete (admin only, or raiser if OPEN)

POST   /planning/:pId/issue-tracker/issues/:id/respond         → member responds
POST   /planning/:pId/issue-tracker/issues/:id/coordinator-close → coordinator closes dept step
POST   /planning/:pId/issue-tracker/issues/:id/close           → fully close issue (coordinator of last step)
POST   /planning/:pId/issue-tracker/issues/:id/update-commitment → update commitment date with reason
PATCH  /planning/:pId/issue-tracker/issues/:id/priority        → change priority

# Flow editing
POST   /planning/:pId/issue-tracker/issues/:id/flow/add-dept   → add dept step to issue flow
DELETE /planning/:pId/issue-tracker/issues/:id/flow/step/:stepId → remove PENDING step from flow
PATCH  /planning/:pId/issue-tracker/issues/:id/flow/reorder    → reorder future PENDING steps

# Kanban
GET    /planning/:pId/issue-tracker/kanban           → issues grouped by currentDepartmentId
                                                       also includes COMPLETED and CLOSED columns

# Activity Log
GET    /planning/:pId/issue-tracker/issues/:id/activity → full activity log for an issue

# Attachments
POST   /planning/:pId/issue-tracker/issues/:id/attachments     → upload file
DELETE /planning/:pId/issue-tracker/issues/:id/attachments/:aid → delete attachment

# Notifications
GET    /planning/:pId/issue-tracker/notifications    → my unread notifications (paginated)
PATCH  /planning/:pId/issue-tracker/notifications/read-all → mark all read
PATCH  /planning/:pId/issue-tracker/notifications/:nid/read → mark one read
```

---

## 6. Frontend — Full Page/Component Design

### 6.1 Routing

```
/admin/issue-tracker                 → AdminIssueDepartmentsPage (new admin route)
/projects/:id/issue-tracker          → IssueTrackerLayout (new wrapper with nav)
/projects/:id/issue-tracker/kanban   → IssueKanbanPage
/projects/:id/issue-tracker/list     → IssueListPage
/projects/:id/issue-tracker/issue/:issueId → IssueDetailPage
/projects/:id/issue-tracker/setup    → IssueTrackerSetupPage (dept members, tags)
/projects/:id/issue-tracker/reports  → IssueReportsPage
```

---

### 6.2 Admin Panel — `AdminIssueDepartmentsPage`

**Location:** Inside existing admin panel, new menu item "Issue Tracker" → "Departments"

**UI:**
- Header: "Issue Departments (Global)" + [+ New Department] button
- **Drag-and-drop list** (using `@dnd-kit/core` or `react-beautiful-dnd`):
  - Each row: `⠿` drag handle + colour dot + dept name + icon + SLA days + active badge
  - Inline Edit button → opens `DepartmentFormModal`
  - Delete button (with confirmation: "X projects use this dept — are you sure?")
- **Sequence** is the global default flow order — users reorder by drag
- **`DepartmentFormModal`**:
  - Name (required)
  - Description
  - Color picker (hex — same swatch as existing)
  - Icon selector (lucide icon grid — 20 common options)
  - Default SLA Days (number input)
  - Active toggle
- Save → PATCH `/admin/issue-tracker/departments/reorder` with new order on drag end

---

### 6.3 Project Setup Page — `IssueTrackerSetupPage`

**Location:** `/projects/:id/issue-tracker/setup` (accessible by PM/Admin)

**Two sections:**

**Section A — Department Configuration (left panel)**
- List of all global active departments (ordered by global sequenceOrder)
- Each row shows: colour dot + dept name + member count + coordinator name
- Toggle "Include in default flow" per dept
- [Configure Members →] button → opens side drawer `DeptMemberDrawer`:
  - Department name + colour header
  - "Members" multi-select from project users (those who can respond)
  - "Coordinator" single-select (who closes the dept step)
  - Saves to `issue_tracker_dept_project_config`

**Section B — Tags/Categories (right panel)**
- Same as existing tag management but UI improved
- Each tag linked to a global department
- [+ New Tag] → modal: name, description, linked department

---

### 6.4 Issue Kanban — `IssueKanbanPage` ← KEY SCREEN

This is the main working view.

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Issue Tracker · [Project Name]                    [+ New Issue]  [🔔 3]  [Filter ▾]     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Filter bar: Priority ▾  |  Dept ▾  |  Date Range  |  Scope: All / My Dept / My Issues   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  [Civil Dept]    [Electrical]   [Plumbing]   [Painting]   [Completed]   [Closed]         │
│  ─────────────  ───────────    ──────────   ──────────   ──────────    ──────────        │
│  ┌──────────┐   ┌──────────┐                                                            │
│  │ ISS-0012 │   │ ISS-0009 │                                                            │
│  │ Leaking  │   │ Wiring   │                                                            │
│  │ pipe …   │   │ fault…   │                                                            │
│  │ ▲HIGH    │   │ ●MEDIUM  │                                                            │
│  │ Due: 20M │   │ Due: 22M │                                                            │
│  │ 👤 A.K.  │   │ Committed│                                                            │
│  │ 2d over  │   │ 25 Mar   │                                                            │
│  └──────────┘   └──────────┘                                                            │
│  ┌──────────┐                                                                            │
│  │ ISS-0015 │                                                                            │
│  │ …        │                                                                            │
│  └──────────┘                                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Kanban columns:**
- One column per **department** (in `sequenceOrder`) — shows issues currently in that dept (`currentDepartmentId = deptId`)
- Additional fixed columns: **Completed** (all steps done, awaiting formal close) + **Closed** (fully closed)
- Column header: dept colour + dept name + issue count badge
- Issue card — `IssueKanbanCard` component:
  - Issue number (ISS-XXXX) + title (truncated)
  - Priority badge (CRITICAL red / HIGH orange / MEDIUM amber / LOW green)
  - Target date — turns red if past due
  - Committed date chip (if set)
  - Overdue indicator: "🔴 X days over" badge
  - Raiser name (small)
  - Tag chips (first 2, then "+N")
  - Action button:
    - Dept member: [Respond] (if ACTIVE and not yet responded)
    - Coordinator: [Close Dept ✓] (if member has responded)
    - Raiser: [View]
  - Tap card → `IssueDetailPage`

**Filters:**
- Priority multi-select chips
- Department filter
- Date range (requiredDate)
- Scope: All / My Department / Issues I Raised / Overdue only

---

### 6.5 Issue Detail Page — `IssueDetailPage`

Full-screen page (not modal — issues are too complex for modals).

**Layout (two-column on desktop, stacked on mobile):**

**Left column (60%) — Main content:**
- Header: `ISS-0012` badge + Title + Priority badge + Status chip
- Description (rich text display)
- Target Date | Raised By | Raised Date | Tags
- **Edit button** (raiser / admin) → inline edit of title/description/priority/requiredDate

**Flow Progress section:**
- Visual horizontal stepper showing department flow:
  ```
  [Civil ✓] → [Electrical ⏳ ACTIVE] → [Plumbing ○ pending] → [Painting ○ pending]
  ```
  - ✓ green = COMPLETED (coordinator closed)
  - ⏳ amber = ACTIVE (waiting for response/coordinator close)
  - ○ grey = PENDING (future step)
- Each step card (expanded on click):
  - Department name + colour
  - **Member's response** (responseText + committedDate + respondedDate + respondedByName)
  - **Coordinator close** (coordinatorRemarks + coordinatorClosedAt + name)
  - **Commitment date history** (expandable timeline):
    ```
    📅 Original: 15 Mar 2026
    📅 Changed to: 20 Mar 2026 — by Ram Kumar on 14 Mar — Reason: "Material delayed"
    📅 Changed to: 25 Mar 2026 — by Ram Kumar on 19 Mar — Reason: "Labour shortage"
    ```
  - Action buttons for active step (role-based):
    - [Respond + Set Commitment Date] (member)
    - [Close This Department ✓] (coordinator)
    - [Update Commitment Date] (member, if date already set — must give reason)

**Per-Issue Flow Editing panel** (visible for admin / issue raiser, while issue not CLOSED):
- "Add Department to Flow" dropdown → adds a PENDING step at end (or at chosen position)
- Remove button on each PENDING future step
- Drag-and-drop to reorder PENDING steps
- Shows warning: "Changes only apply to future PENDING steps. Active/completed steps cannot be changed."

**Right column (40%) — Sidebar:**

**Attachments section:**
- Grid of uploaded files/photos
- [+ Upload] button → drag-drop or file picker
- Thumbnail for images, file icon + name for docs
- Delete button (uploader or admin)

**Activity Log section:**
- Reverse-chronological list of all actions:
  ```
  👤 Ram Kumar responded to Civil step — 18 Mar 2026 14:32
  🔄 Issue moved to Electrical department — 18 Mar 2026 14:33
  📅 Commitment date changed: 15 Mar → 20 Mar (Reason: Material delayed) — 16 Mar
  ⚡ Priority changed: MEDIUM → HIGH — by PM on 17 Mar
  📎 Attachment added: site_photo.jpg — 18 Mar
  ```
- Each entry has: icon + text + timestamp + actor name

---

### 6.6 Create Issue Modal — `CreateIssueModal`

Uses existing `Modal.tsx` (size="xl")

**Form fields:**
1. **Title** — text input (required)
2. **Description** — textarea (required)
3. **Priority** — 4 chip buttons: LOW | MEDIUM | HIGH | CRITICAL (default MEDIUM)
4. **Target Date** (requiredDate) — date picker (required)
5. **Tags** — multi-select checkboxes grouped by department; selecting a tag adds that dept to the flow preview
6. **Flow Preview** (auto-generated + editable):
   ```
   Issue will flow through these departments in order:
   [Civil] → [Electrical] → [Plumbing]
   Drag to reorder  |  [+ Add Department]  |  Remove ✕
   ```
   - Derived from selected tags' departments in global sequenceOrder
   - User can reorder by drag BEFORE creating
   - User can add extra departments not in the tags
   - User can remove departments

7. **Attachments** (optional) — upload files at creation time

**Submit:** POST `/planning/:pId/issue-tracker/issues`

---

### 6.7 Notification Bell — `IssueNotificationDropdown`

Integrated into the Issue Tracker page header (not the global app nav — issue tracker specific).

- Bell icon + unread count badge
- Dropdown list of notifications:
  ```
  🔴 ISS-0012: Commitment date missed — Civil Dept — 2h ago
  🟡 ISS-0009: Target date in 3 days — Electrical — 1d ago
  🟢 ISS-0007: Closed — Painting Dept — 2d ago
  ```
- [Mark all read] button
- Click → navigate to that issue detail page

---

### 6.8 Issue Reports Page — `IssueReportsPage`

**Three views:**

**View 1 — Aging Report (table)**
| ISS# | Title | Priority | Dept | Days Open | Target Date | Status | Overdue |
|---|---|---|---|---|---|---|---|
| ISS-0012 | ... | HIGH | Civil | 14d | 20 Mar | IN_PROGRESS | 🔴 2d |

Sortable by any column. Export to CSV.

**View 2 — Department Performance (bar chart)**
- X axis: departments
- Grouped bars: Avg response time / SLA compliance % / Issues currently pending

**View 3 — Commitment Date Compliance**
- List of issues where commitment date was changed > 1 time
- Shows: original date → final committed date → actual close date (if done)
- Highlights repeated deferrals

---

### 6.9 Issue List Page — `IssueListPage`

Alternative to Kanban — table/list view of all issues.

- Sortable table: ISS# | Title | Priority | Status | Dept | Target | Committed | Overdue | Actions
- Row expand → shows step flow inline
- Quick filter chips at top
- Useful for bulk operations and report-style viewing

---

## 7. Frontend File Structure

### New/Modified Files

```
frontend/src/
├── types/
│   └── issueTracker.types.ts          ← NEW — TypeScript interfaces
├── services/
│   └── issueTracker.service.ts        ← MODIFY — add new endpoints
├── views/
│   └── issue-tracker/                 ← NEW FOLDER (rename from pages/planning/)
│       ├── IssueTrackerLayout.tsx     ← NEW — nav tabs wrapper
│       ├── IssueKanbanPage.tsx        ← NEW — main Kanban view
│       ├── IssueListPage.tsx          ← NEW — list/table view
│       ├── IssueDetailPage.tsx        ← NEW — full issue detail
│       ├── IssueTrackerSetupPage.tsx  ← NEW — dept member config + tags
│       ├── IssueReportsPage.tsx       ← NEW — aging + performance reports
│       └── components/
│           ├── IssueKanbanCard.tsx    ← NEW
│           ├── IssueKanbanColumn.tsx  ← NEW
│           ├── CreateIssueModal.tsx   ← NEW
│           ├── IssueStepCard.tsx      ← NEW — one dept step in flow
│           ├── IssueFlowStepper.tsx   ← NEW — horizontal flow visualiser
│           ├── CommitmentDateHistory.tsx ← NEW
│           ├── ActivityLogFeed.tsx    ← NEW
│           ├── AttachmentGrid.tsx     ← NEW
│           ├── IssueNotificationDropdown.tsx ← NEW
│           ├── PriorityBadge.tsx      ← NEW
│           ├── DeptMemberDrawer.tsx   ← NEW
│           └── FlowEditor.tsx         ← NEW — drag-drop flow editor
├── pages/
│   └── admin/
│       └── AdminIssueDepartmentsPage.tsx ← NEW — global dept management
```

### Deprecated / Replaced
```
frontend/src/pages/planning/IssueTrackerPage.tsx  ← DELETE (replaced by new folder above)
```

---

## 8. Database Migration Plan

Two migrations needed (existing tables + new tables):

### Migration 1 — Alter existing tables
```typescript
// AlterIssueTrackerTables — YYYYMMDD
// 1. ALTER issue_tracker_departments:
//    - DROP COLUMN projectId
//    - DROP COLUMN memberUserIds
//    - ADD COLUMN sequenceOrder INT DEFAULT 0
//    - ADD COLUMN icon VARCHAR(60)
//    - ADD COLUMN defaultSlaDays INT
//
// 2. ALTER issue_tracker_issues:
//    - ADD COLUMN issueNumber VARCHAR(20)
//    - ADD COLUMN priority VARCHAR(20) DEFAULT 'MEDIUM'
//    - ADD COLUMN customFlowDepartmentIds JSONB
//    - ADD COLUMN attachmentCount INT DEFAULT 0
//    - ADD COLUMN commentCount INT DEFAULT 0
//
// 3. ALTER issue_tracker_steps:
//    - ADD COLUMN slaDays INT
//    - ADD COLUMN committedDateHistory JSONB
//    - ADD COLUMN coordinatorRemarks TEXT
//    - ADD COLUMN coordinatorClosedAt TIMESTAMPTZ
//    - ADD COLUMN coordinatorClosedById INT
//
// 4. Data migration: set sequenceOrder = id (preserve existing order)
// 5. Generate issueNumbers for existing issues: UPDATE SET issueNumber = 'ISS-' || LPAD(id::text, 4, '0')
```

### Migration 2 — Create new tables
```typescript
// CreateIssueTrackerNewTables — YYYYMMDD
// CREATE TABLE issue_tracker_dept_project_config
// CREATE TABLE issue_tracker_activity_log
// CREATE TABLE issue_tracker_attachments
// CREATE TABLE issue_tracker_notifications
// CREATE INDEXES on issueId, recipientUserId, projectId, createdAt
```

---

## 9. Additional Features Added (Beyond User Request)

| Feature | Rationale |
|---|---|
| **Issue Number (ISS-0001)** | Easy verbal/written reference — "please look at ISS-0045" |
| **Attachments on issues + steps** | Evidence-based issue tracking — photos of the problem, rectification |
| **Activity Log** | Full audit trail — who changed what when; legally useful |
| **Per-dept SLA days** | Configurable response SLAs; powers the reports |
| **Priority field** | User requested, enables Kanban sorting and urgency colour-coding |
| **Coordinator vs Member separation** | Members respond from their side; coordinator validates and formally moves it forward |
| **Issue number auto-generation** | Serial: ISS-0001, ISS-0002 per project |
| **Reports page** | Aging report, SLA compliance, commitment date deferrals |
| **Flow editor on issue** | Add/remove/reorder departments for a specific issue without changing the default |
| **Kanban + List dual view** | Kanban for workflow view, List for bulk/report operations |
| **Notification queue in DB** | Persistent — user doesn't miss notification if offline; also feeds mobile push |
| **Tag colours** | Visual differentiation in Kanban cards |

---

## 10. Permissions

```
ISSUE_TRACKER.DEPT.MANAGE    → Admin only — create/edit/delete global departments
ISSUE_TRACKER.ISSUE.CREATE   → Any project member
ISSUE_TRACKER.ISSUE.RESPOND  → Department members (assigned via project config)
ISSUE_TRACKER.DEPT.CLOSE     → Coordinator only (closes department step)
ISSUE_TRACKER.ISSUE.CLOSE    → Coordinator of last step or Admin
ISSUE_TRACKER.FLOW.EDIT      → Issue raiser or Admin
ISSUE_TRACKER.REPORT.VIEW    → PM, Admin
ISSUE_TRACKER.SETUP          → PM, Admin (configure dept members per project)
```

---

## 11. Estimated Effort

| Phase | Scope | Days |
|---|---|---|
| Phase 1 | Migrations (alter + new tables) | 1 |
| Phase 2 | Backend service updates (createIssue, respond, coordinator-close, flow-edit, notifications) | 3 |
| Phase 3 | Backend new endpoints (dept-config, attachments, activity log, kanban) | 2 |
| Phase 4 | Cron notification scheduler | 1 |
| Phase 5 | Admin panel — global dept management page | 1 |
| Phase 6 | Frontend types + updated service | 0.5 |
| Phase 7 | IssueKanbanPage + IssueKanbanCard/Column | 3 |
| Phase 8 | IssueDetailPage (flow stepper, activity log, attachments, flow editor) | 3 |
| Phase 9 | CreateIssueModal (with flow preview + drag-drop ordering) | 1.5 |
| Phase 10 | IssueTrackerSetupPage (dept members + coordinator config) | 1 |
| Phase 11 | Notifications dropdown + IssueReportsPage | 1.5 |
| Phase 12 | IssueListPage + routing + menu updates | 1 |
| **Total** | | **~19.5 days** |

---

## 12. Files to Create / Modify Summary

### Backend — New Files
```
backend/src/migrations/YYYYMMDD-AlterIssueTrackerTables.ts
backend/src/migrations/YYYYMMDD-CreateIssueTrackerNewTables.ts
backend/src/planning/entities/issue-tracker-dept-project-config.entity.ts
backend/src/planning/entities/issue-tracker-activity-log.entity.ts
backend/src/planning/entities/issue-tracker-attachment.entity.ts
backend/src/planning/entities/issue-tracker-notification.entity.ts
backend/src/planning/dto/issue-tracker-v2.dto.ts
```

### Backend — Modified Files
```
backend/src/planning/entities/issue-tracker-department.entity.ts  → remove projectId/memberUserIds, add new cols
backend/src/planning/entities/issue-tracker-issue.entity.ts       → add priority, issueNumber, customFlow
backend/src/planning/entities/issue-tracker-step.entity.ts        → add committedDateHistory, coordinator fields
backend/src/planning/issue-tracker.service.ts                     → major rewrite of all methods + new ones
backend/src/planning/planning.controller.ts                       → add new endpoint handlers
backend/src/planning/planning.module.ts                           → register new entities
backend/src/app.module.ts                                         → add cron module if not present
```

### Frontend — New Files
```
frontend/src/types/issueTracker.types.ts
frontend/src/views/issue-tracker/IssueTrackerLayout.tsx
frontend/src/views/issue-tracker/IssueKanbanPage.tsx
frontend/src/views/issue-tracker/IssueListPage.tsx
frontend/src/views/issue-tracker/IssueDetailPage.tsx
frontend/src/views/issue-tracker/IssueTrackerSetupPage.tsx
frontend/src/views/issue-tracker/IssueReportsPage.tsx
frontend/src/views/issue-tracker/components/IssueKanbanCard.tsx
frontend/src/views/issue-tracker/components/IssueKanbanColumn.tsx
frontend/src/views/issue-tracker/components/CreateIssueModal.tsx
frontend/src/views/issue-tracker/components/IssueStepCard.tsx
frontend/src/views/issue-tracker/components/IssueFlowStepper.tsx
frontend/src/views/issue-tracker/components/CommitmentDateHistory.tsx
frontend/src/views/issue-tracker/components/ActivityLogFeed.tsx
frontend/src/views/issue-tracker/components/AttachmentGrid.tsx
frontend/src/views/issue-tracker/components/IssueNotificationDropdown.tsx
frontend/src/views/issue-tracker/components/PriorityBadge.tsx
frontend/src/views/issue-tracker/components/DeptMemberDrawer.tsx
frontend/src/views/issue-tracker/components/FlowEditor.tsx
frontend/src/pages/admin/AdminIssueDepartmentsPage.tsx
```

### Frontend — Modified Files
```
frontend/src/services/issueTracker.service.ts   → add all new API calls
frontend/src/App.tsx                            → add new routes
frontend/src/config/menu.ts                     → update issue tracker menu entries
```

### Frontend — Deleted Files
```
frontend/src/pages/planning/IssueTrackerPage.tsx   → replaced by new views/issue-tracker/ folder
```
