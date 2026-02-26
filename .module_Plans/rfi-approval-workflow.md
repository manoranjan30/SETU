# Implementation Plan: RFI Approval Workflow Designer

> **Status:** PLANNING  
> **Author:** Antigravity  
> **Date:** 2026-02-25  
> **Priority:** High

---

## 📋 Executive Summary

Build a **visual node-based approval workflow designer** for the QA/QC module. Like the existing Activity Sequencer (React Flow canvas), this new "Approval Workflow" will allow a project admin to define **who approves what and in what order** for each RFI (Request for Inspection).

The workflow is **linked to an Activity List (not per-activity)**, so one workflow template covers all activities in that list. When an RFI is raised, the system instantiates the workflow and routes it step-by-step through the defined approvers — each person must digitally sign before the next receives the task.

---

## 🏗️ Architecture Decision

### Core Concept: "Approval Chain Template" per Activity List

```
QualityActivityList  1 ──── 1  ApprovalWorkflowTemplate
                                        │
                                        ▼
                              [Ordered list of Nodes]
                              ┌─────────────────────────────────────────┐
                              │ Node 1: Site Engineer (Raise RFI)        │
                              │    ↓ (edge)                              │
                              │ Node 2: QC Engineer (Inspect Stage 1-3)  │
                              │    ↓ (edge)                              │
                              │ Node 3: QA Manager (Final Approval)      │
                              └─────────────────────────────────────────┘
```

### Workflow Execution per Inspection

```
QualityInspection  1 ──── 1  InspectionWorkflowRun
                                  │
                                  ▼
                         [InspectionWorkflowStep per Node]
                         - step_order: 1
                         - assignedUserId: 12 (Site Engineer)
                         - status: COMPLETED
                         - signatureId: → quality_signatures.id
                         - completedAt: timestamp
                         ─────────────────────
                         - step_order: 2
                         - assignedUserId: 45 (QC Engineer)
                         - status: PENDING  ← CURRENT STEP
                         ─────────────────────
                         - step_order: 3
                         - assignedUserId: 89 (QA Mgr)
                         - status: WAITING
```

---

## 📐 Data Model — New Entities

### 1. `ApprovalWorkflowTemplate` (definition per Activity List)

```typescript
@Entity('approval_workflow_templates')
class ApprovalWorkflowTemplate {
  id: number;                // PK
  listId: number;            // FK → QualityActivityList.id (UNIQUE — one workflow per list)
  name: string;              // e.g. "Structural Works Approval Chain"
  isActive: boolean;         // Only one can be active per list
  createdBy: number;         // FK → User.id
  nodes: ApprovalWorkflowNode[];  // OneToMany
  edges: ApprovalWorkflowEdge[];  // OneToMany
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. `ApprovalWorkflowNode` (each approver box)

```typescript
@Entity('approval_workflow_nodes')
class ApprovalWorkflowNode {
  id: number;                // PK
  workflowId: number;        // FK → ApprovalWorkflowTemplate.id
  
  // Visual canvas position (mirroring activity sequencer)
  position: { x: number; y: number }; // JSONB
  
  // Who is this step for?
  stepType: 'RAISE_RFI' | 'INSPECT' | 'APPROVE' | 'FINAL_APPROVE' | 'WITNESS';
  
  // Assignment: EITHER a specific user OR a role (resolved at runtime)
  assignmentMode: 'USER' | 'ROLE';
  assignedUserId: number | null;    // FK → User.id (nullable)
  assignedRoleId: number | null;    // FK → Role.id (nullable) - resolved from project team
  
  label: string;             // Display label on canvas node, e.g. "Site Engineer Sign-off"
  stepOrder: number;         // 1-based sequential order
  isOptional: boolean;       // Can be skipped?
  canDelegate: boolean;      // Allow delegating to another team member?
  
  // What actions are allowed at this step?
  allowRaiseRFI: boolean;    // Can raise/request inspection
  allowStageApprove: boolean;// Can approve individual stages/checklist sections
  allowFinalApprove: boolean;// Can finalize entire inspection
  allowReject: boolean;      // Can reject and send back
  allowObservation: boolean; // Can raise an observation/NCR
  
  createdAt: Date;
}
```

### 3. `ApprovalWorkflowEdge` (flow arrows)

```typescript
@Entity('approval_workflow_edges')
class ApprovalWorkflowEdge {
  id: number;
  workflowId: number;        // FK → ApprovalWorkflowTemplate.id
  sourceNodeId: number;      // FK → ApprovalWorkflowNode.id
  targetNodeId: number;      // FK → ApprovalWorkflowNode.id
  // All edges are sequential — no complex branching needed for MVP
  createdAt: Date;
}
```

### 4. `InspectionWorkflowRun` (live instance per inspection)

```typescript
@Entity('inspection_workflow_runs')
class InspectionWorkflowRun {
  id: number;
  inspectionId: number;       // FK → QualityInspection.id (UNIQUE)
  workflowTemplateId: number; // FK → ApprovalWorkflowTemplate.id (snapshot reference)
  currentStepOrder: number;   // Which step is active right now
  status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'REVERSED';
  steps: InspectionWorkflowStep[]; // OneToMany
  createdAt: Date;
  updatedAt: Date;
}
```

### 5. `InspectionWorkflowStep` (one row per node per inspection)

```typescript
@Entity('inspection_workflow_steps')
class InspectionWorkflowStep {
  id: number;
  runId: number;              // FK → InspectionWorkflowRun.id
  workflowNodeId: number;     // FK → ApprovalWorkflowNode.id (original template node)
  stepOrder: number;          // Copied from node for fast querying
  
  // Resolved user at runtime (from project team, based on role if mode=ROLE)
  assignedUserId: number | null;  // FK → User.id
  
  status: 'WAITING' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'SKIPPED';
  
  signatureId: number | null;  // FK → QualitySignature.id (created when step completed)
  signedBy: string | null;     // Name snapshot for quick display
  completedAt: Date | null;
  comments: string | null;     // Rejection reason or sign-off notes
  createdAt: Date;
}
```

---

## 🔌 API Endpoints — Backend

### Workflow Template CRUD

| Method | Endpoint                                                  | Description                          | Permission             |
|--------|-----------------------------------------------------------|--------------------------------------|------------------------|
| GET    | `/quality/workflow-templates?listId=:id`                 | Get workflow for a list              | QUALITY.WORKFLOW.READ  |
| POST   | `/quality/workflow-templates`                             | Create new workflow template          | QUALITY.WORKFLOW.WRITE |
| PUT    | `/quality/workflow-templates/:id`                         | Update (nodes + edges) — full replace | QUALITY.WORKFLOW.WRITE |
| DELETE | `/quality/workflow-templates/:id`                         | Delete template                       | QUALITY.WORKFLOW.WRITE |
| GET    | `/quality/workflow-templates/:id/nodes`                   | Get all nodes (with user/role info)  | QUALITY.WORKFLOW.READ  |
| GET    | `/projects/:projectId/team-members`                       | **Reuse existing** — source for node assignment | (existing endpoint) |

### Workflow Run / Execution

| Method | Endpoint                                                           | Description                              | Permission                    |
|--------|--------------------------------------------------------------------|------------------------------------------|-------------------------------|
| GET    | `/quality/inspections/:inspectionId/workflow`                      | Get live workflow run + step statuses     | QUALITY.INSPECTION.READ        |
| POST   | `/quality/inspections/:inspectionId/workflow/advance`              | Complete current step (with signature)   | QUALITY.INSPECTION.APPROVE     |
| POST   | `/quality/inspections/:inspectionId/workflow/reject`               | Reject & send back to previous step       | QUALITY.INSPECTION.APPROVE     |
| GET    | `/quality/workflow-tasks?userId=:id`                               | Get all pending tasks for a user (Dashboard) | QUALITY.WORKFLOW.READ      |

---

## 🖥️ Frontend — Pages & Components

### Page 1: Workflow Designer (`/quality/:projectId/workflow-designer/:listId`)

**Visual node canvas (React Flow), same as SequenceManagerPage.tsx**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [ ← Back ]  Activity List: "Structural Works"    [ Save Workflow ]       │
├─────────────────────────────┬────────────────────────────────────────────┤
│   TOOL PANEL                │          CANVAS                            │
│                             │                                            │
│  [ + Add Step Node ]        │   ╭────────────────╮                       │
│                             │   │  🏗️ RAISE RFI   │                       │
│  Step Types:                │   │  Site Engineer  │                       │
│  ● Raise RFI                │   │  [John Smith]   │                       │
│  ● Inspect Stage            │   ╰────────┬───────╯                       │
│  ● Approve                  │            │                                │
│  ● Final Approve            │            ▼                                │
│  ● Witness Point            │   ╭────────────────╮                       │
│                             │   │  🔍 INSPECT     │                       │
│  NODE PROPERTIES:           │   │  QC Engineer   │                       │
│  [when node selected]       │   │  [Role-based]   │                       │
│  Name: [________]           │   ╰────────┬───────╯                       │
│  Assigned to: [dropdown]    │            │                                │
│  Assignment: ○User ●Role   │            ▼                                │
│  Role: [QC Engineer ▼]      │   ╭────────────────╮                       │
│  Can Reject: [✓]            │   │  ✅ FINAL APPROV│                       │
│  Optional: [ ]              │   │  QA Manager    │                       │
│  Actions: [checkboxes]      │   │  [Priya Sharma] │                       │
│                             │   ╰────────────────╯                       │
└─────────────────────────────┴────────────────────────────────────────────┘
```

**Key Interactions:**
- Drag node from panel → drops on canvas
- Click node → side panel shows properties
- Connect nodes by dragging handles
- Team members loaded from project team API
- Save serializes nodes + edges to backend

### Page 2: Workflow Status View (inside `QualityApprovalsPage.tsx`)

When a QC Inspector opens an RFI, instead of raw checklist, they see a **progress stepper at the top**:

```
╔══════════════════════════════════════════════════════════════╗
║  Step 1: RAISE RFI          ✅ Signed by John Smith  10:15am ║
║  Step 2: QC INSPECTION      ✏️ YOUR TURN — Pending Sign-off  ║ ← ACTIVE
║  Step 3: FINAL APPROVAL     🔒 Waiting...                    ║
╚══════════════════════════════════════════════════════════════╝
```

Each completed step shows the signer's name, role and timestamp. The active step shows the action buttons. Steps not yet reached are locked.

### Component 3: My Tasks Panel (Dashboard)

A panel in the QA Dashboard showing all RFIs where it's **the logged-in user's turn**:

```
╔══════════════════════════════════════════════════╗
║  🔔 Awaiting Your Action (3 RFIs)               ║
║  ─────────────────────────────────────────────  ║
║  • Column A Concrete - Step 2: QC Inspection →  ║
║  • Slab Level 3      - Step 2: QC Inspection →  ║
║  • Beam Grid B4      - Step 1: Raise RFI →      ║
╚══════════════════════════════════════════════════╝
```

---

## 🔄 Workflow Execution Logic (Service Layer)

### On RFI Raise (`POST /quality/inspections`)

```
1. Create QualityInspection (status: PENDING)
2. Find active ApprovalWorkflowTemplate for this listId
3. IF template exists:
   a. Create InspectionWorkflowRun (currentStepOrder: 1)
   b. Create InspectionWorkflowStep for EACH node (status: WAITING)
   c. Set Step 1 → status: PENDING (notify assigned user)
4. ELSE: fall back to old manual approval flow (backward compat)
```

### On Step Completion (`POST /quality/inspections/:id/workflow/advance`)

```
1. Validate: req.user is the assigned user for current step (or has delegated)
2. Create QualitySignature (with signatureData, role, lockHash, etc.)
3. Update InspectionWorkflowStep: status=COMPLETED, signatureId, completedAt
4. Determine NEXT step:
   a. Find step with order = currentStepOrder + 1
   b. If FINAL step → also update QualityInspection.status = APPROVED
   c. Else → set next step to PENDING, notify next user
5. Update InspectionWorkflowRun.currentStepOrder
```

### On Rejection (`POST /quality/inspections/:id/workflow/reject`)

```
1. Update current InspectionWorkflowStep: status=REJECTED, comments=reason
2. Update InspectionWorkflowRun.status=REJECTED
3. Update QualityInspection.status=REJECTED
4. Optionally: reset to Step 1 (PENDING) and notify the RFI raiser
```

### Role-Based Assignment Resolution (at run creation time)

```
When stepNode.assignmentMode = 'ROLE':
  - Query UserProjectAssignment WHERE project = this project
  - Filter by assignedRoleId matching the step's role
  - If multiple users → pick the first ACTIVE one (or notify ALL in parallel — MVP: first)
  - Store resolved userId in InspectionWorkflowStep.assignedUserId
```

---

## ⚡ Backward Compatibility Strategy

The workflow system is **optional at the list level**. If no `ApprovalWorkflowTemplate` is linked to an Activity List, the system falls back to the **existing manual approval** buttons in `QualityApprovalsPage.tsx`. This means:

- **Zero breaking changes** to existing data/functionality
- Project admins can opt-in by creating a workflow for their list
- Existing RFIs with no workflow run → continue working as today

---

## 📁 File Structure — New Files to Create

### Backend
```
backend/src/quality/
├── entities/
│   ├── approval-workflow-template.entity.ts   [NEW]
│   ├── approval-workflow-node.entity.ts        [NEW]
│   ├── approval-workflow-edge.entity.ts        [NEW]
│   ├── inspection-workflow-run.entity.ts       [NEW]
│   └── inspection-workflow-step.entity.ts      [NEW]
├── approval-workflow.controller.ts             [NEW]
├── approval-workflow.service.ts                [NEW]
```

### Frontend
```
frontend/src/views/quality/
├── WorkflowDesignerPage.tsx     [NEW] — visual canvas
│
frontend/src/views/quality/subviews/
├── WorkflowStatusBanner.tsx     [NEW] — stepper in approvals page
├── WorkflowTasksPanel.tsx       [NEW] — "My Tasks" widget
```

### Modifications to Existing Files
```
backend/src/quality/quality.module.ts          MODIFY — register new entities/services
backend/src/quality/quality-inspection.service.ts  MODIFY — invoke workflow on RFI create
backend/src/quality/quality-inspection.controller.ts MODIFY — add /workflow endpoints
frontend/src/views/quality/QualityApprovalsPage.tsx  MODIFY — show workflow status banner
frontend/src/views/quality/ActivityListsPage.tsx     MODIFY — add "Design Workflow" button
backend/src/auth/permission-registry.ts        MODIFY — add QUALITY.WORKFLOW permissions
frontend/src/config/permissions.ts             MODIFY — mirror new permissions
```

---

## 🗺️ Route Plan

```
/quality/:projectId/workflow-designer/:listId
```

Add to the existing quality module router.

---

## 🧩 React Flow Node Types (WorkflowDesignerPage)

| Node Type      | Color   | Icon  | Meaning                                              |
|----------------|---------|-------|------------------------------------------------------|
| RAISE_RFI      | Blue    | 📩    | Person who initiates the RFI                         |
| INSPECT        | Amber   | 🔍    | QC Inspector who verifies checklist stages           |
| APPROVE        | Indigo  | ✍️    | Mid-level approver who signs off section             |
| FINAL_APPROVE  | Green   | ✅    | Final authority — completes the RFI                  |
| WITNESS        | Purple  | 👁️    | Witness point (can view, co-sign, but not gate)      |

---

## 📅 Phased Implementation

### Phase 1 — Data Foundation (1 day)
- [ ] Create 5 new TypeORM entities
- [ ] Register in `quality.module.ts`
- [ ] Run migration

### Phase 2 — Backend Services & APIs (2 days)
- [ ] `ApprovalWorkflowService` — CRUD for templates + nodes/edges
- [ ] `InspectionWorkflowService` — run instantiation + advance/reject logic
- [ ] Wire into `quality-inspection.service.ts` create flow
- [ ] Expose REST endpoints via `approval-workflow.controller.ts`
- [ ] Register permissions

### Phase 3 — Workflow Designer Frontend (2 days)
- [ ] `WorkflowDesignerPage.tsx` — React Flow canvas
- [ ] Custom `WorkflowNode` component (per type with color coding)
- [ ] Node properties panel
- [ ] Team member selector (call `/projects/:id/team-members`)
- [ ] Save/load workflow from API
- [ ] Add "Design Workflow" button in `ActivityListsPage.tsx`

### Phase 4 — Execution UI (1 day)
- [ ] `WorkflowStatusBanner.tsx` — horizontal step tracker in `QualityApprovalsPage`
- [ ] Guard: only show action buttons to assigned user for current step
- [ ] `WorkflowTasksPanel.tsx` — "My Tasks" widget in QA Dashboard
- [ ] Signature modal now reads step data (who is signing what)

### Phase 5 — Testing & Polish (1 day)
- [ ] End-to-end test: Design workflow → Raise RFI → Inspect → Final Approve
- [ ] Fallback test: List with no workflow still works
- [ ] Delegation edge case
- [ ] PDF report: show full chain of approvers with timestamps

---

## ⚠️ Key Design Decisions

| Decision                            | Rationale                                                                         |
|-------------------------------------|-----------------------------------------------------------------------------------|
| Workflow per Activity List (not per activity) | One workflow covers all activities in a list — simpler to manage           |
| Role-based OR user-specific nodes   | Flexibility: can say "any QC Engineer" or specifically "John Smith"               |
| Steps resolved at RFI creation time | Avoid stale references — if team changes, active RFIs aren't affected             |
| Optional workflow (backward compat) | Zero risk: existing projects without workflow still work                           |
| Sequential only (MVP)               | No parallel branches — easier to reason about audit trail, can add later          |
| Signature per step                  | Each step captures digital signature → feeds into PDF report zones                |

---

## 🎨 UI Design Guidance

The **Workflow Designer** should look and feel identical to the existing **SequenceManagerPage.tsx** (Activity Sequencer):
- Same React Flow setup, same toolbar layout
- Different node shapes/colors for approval types
- Right panel shows node properties (like activity properties panel)
- Team member picker is a searchable dropdown populated from the Teams API

The **Status Banner** inside QualityApprovalsPage should be:
- A horizontal timeline at the top of the detail view
- Completed steps: green with checkmark + signer name + timestamp
- Active step: blue/orange with pulsing indicator + action buttons below
- Future steps: gray with lock icon

---

> **Next Step:** Approve this plan and I will start Phase 1 implementation.

