# Project-Scoped Approval Routing

## Goal
Ensure RFI approval notifications and workflow routing are **strictly project-scoped** — only team members assigned to THAT specific project (with the correct role) receive notifications and can approve, not every user in the system with the same role.

---

## Current State Analysis

### ✅ What Already Works Well
| Component | Status | Details |
|-----------|--------|---------|
| `UserProjectAssignment` entity | ✅ Solid | Links User → Project → Roles with scope (FULL/LIMITED) |
| `ApprovalWorkflowTemplate` | ✅ Per-Project | One template per `projectId` |
| `ApprovalWorkflowNode` | ✅ Role-based | Supports `AssignmentMode.ROLE` with `assignedRoleId` |
| `InspectionWorkflowService.startWorkflowForInspection` | ✅ Resolves roles | Already queries `UserProjectAssignment` to find the right project team member |
| `PermissionResolutionService` | ✅ Project-scoped | `hasPermission()` resolves via project context + scope |
| `ProjectAssignmentService` | ✅ Full CRUD | Assign/remove users with roles to projects |
| JWT Token | ✅ Has `project_ids` | Token carries assigned project IDs |

### 🔴 What's Broken / Missing
| Issue | Location | Problem |
|-------|----------|---------|
| **Push notifications are GLOBAL** | `quality-inspection.service.ts:296-305` | `sendToPermission('QUALITY.INSPECTION.APPROVE')` sends to ALL users with that permission across all projects |
| **Workflow role resolution picks FIRST match** | `inspection-workflow.service.ts:99-104` | `.find()` picks the first team member with matching role — no fallback, no multi-user support |
| **No project-scoped notification helper** | `push-notification.service.ts` | Only has `sendToUsers()` and `sendToPermission()` — no `sendToProjectRole()` |
| **Advance workflow also lacks scoped notify** | `inspection-workflow.service.ts:230-271` | After advancing step, no notification is sent to the NEXT approver |
| **PermissionsGuard is NOT project-scoped** | `permissions.guard.ts` | Checks global permission list from JWT, not per-project |

---

## Implementation Tasks

### Task 1: Add `sendToProjectRole()` to PushNotificationService
**File:** `backend/src/notifications/push-notification.service.ts`
**What:** Add method that sends push notifications only to users assigned to a specific project with a matching role.

```typescript
async sendToProjectRole(
  projectId: number,
  roleId: number,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void>
```

- Query `UserProjectAssignment` where `project.id = projectId` AND `roles` contains `roleId` AND `status = ACTIVE`
- Extract user FCM tokens from those matches only
- Send notification to those tokens

**Verify:** Method exists, compiles, and only queries project-scoped assignments.

---

### Task 2: Fix RFI Creation Notification (Make Project-Scoped)
**File:** `backend/src/quality/quality-inspection.service.ts` (lines 296-305)
**What:** Replace the global `sendToPermission()` call with a project-scoped notification.

**Current (BROKEN):**
```typescript
this.pushService.sendToPermission(
  'QUALITY.INSPECTION.APPROVE',   // ← sends to ALL users with this perm
  'New RFI Raised', ...
);
```

**Fix:** After `startWorkflowForInspection()`, get the workflow run's next pending step → get assigned user → notify THAT specific user.

If no workflow run is available, fall back to notifying all project team members who have the approver role for that project (using the new `sendToProjectRole()`).

**Verify:** Only project-assigned team members get the RFI notification.

---

### Task 3: Add "Notify Next Approver" After Workflow Advance
**File:** `backend/src/quality/inspection-workflow.service.ts` (inside `advanceWorkflow()`)
**What:** When a step is completed and the next step becomes PENDING, send a push notification to the `assignedUserId` of the next step.

```typescript
if (nextStep && nextStep.assignedUserId) {
  this.pushService.sendToUsers(
    [nextStep.assignedUserId],
    'Approval Required 📋',
    `RFI #${inspectionId} is awaiting your approval at Step ${nextStep.stepOrder}.`,
    { inspectionId: String(inspectionId), type: 'PENDING_APPROVAL' },
  ).catch(() => { /* non-fatal */ });
}
```

**Verify:** Each time a workflow step completes, only the next assigned approver (resolved to a specific project team member) gets notified.

---

### Task 4: Improve Role Resolution in startWorkflowForInspection
**File:** `backend/src/quality/inspection-workflow.service.ts` (lines 95-121)
**What:** Strengthen the role-to-user resolution to handle edge cases:

1. If multiple team members have the same role → pick by `scopeType` fit (if `LIMITED` scope, prefer the member whose scope covers the RFI location)
2. If no team member found for a role → leave `assignedUserId` as null and log a warning (admin can delegate later)
3. Step 1 (RAISE_RFI) always uses `raiserUserId` — this is already correct ✅

**Verify:** Workflow steps are created with correctly resolved user IDs based on project team.

---

### Task 5: Inject UserProjectAssignment into PushNotificationService
**File:** `backend/src/notifications/notifications.module.ts`
**What:** Add `UserProjectAssignment` to the module imports so the new `sendToProjectRole()` can query project teams.

**Verify:** Module compiles and `PushNotificationService` can access `UserProjectAssignment` repo.

---

### Task 6: Verify End-to-End Flow
**Manual Test Steps:**
1. Create two projects (Project A, Project B)
2. Assign User X as "Site Engineer" to Project A only
3. Assign User Y as "Quality Engineer" to Project A only
4. Assign User Z as "Quality Engineer" to Project B only
5. User X raises RFI in Project A
6. **Expected:** Only User Y gets notified (not User Z)
7. User Y approves → workflow advances → if next step exists, only that step's assignee gets notified
8. User Z should see NO notifications from Project A

---

## Done When
- [x] `sendToProjectRole()` method exists in `PushNotificationService`
- [x] RFI creation sends project-scoped notification (not global)
- [x] Workflow advance notifies only the next specific approver
- [x] Role resolution handles missing team members gracefully
- [x] Backend builds successfully
- [x] Frontend unchanged (no frontend changes needed)

## Notes
- The `PermissionsGuard` in `permissions.guard.ts` checks global permissions from the JWT. This is acceptable for API endpoint access control. The project-scoping happens at the **data layer** (workflow resolution + notification routing), not at the guard level.
- The frontend `CreateTempUserWizard` and mobile app don't need changes — the routing logic is entirely backend.
- The JWT token already includes `project_ids` for frontend project-switching. The backend uses `UserProjectAssignment` for runtime checks.
