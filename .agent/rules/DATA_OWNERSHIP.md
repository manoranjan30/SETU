# DATA_OWNERSHIP.md
## Data Ownership & Bounded Context Rules
### Construction Project Intelligence & Control Platform

---

## 1. Purpose of This Document

This document defines **clear data ownership boundaries** across all backend modules.

It establishes:
- which module OWNS which data
- which modules may READ data
- which modules are FORBIDDEN from modifying data
- how data is shared safely using events and APIs

This document is **authoritative** and **binding** for all AI-generated and human-written code.

---

## 2. Core Data Ownership Principles (Non-Negotiable)

1. **Single Owner Rule**
   - Every entity/table has exactly ONE owning module

2. **Write Exclusivity**
   - Only the owning module may CREATE, UPDATE, or DELETE its data

3. **Read via Contract**
   - Other modules may read data only via:
     - exposed APIs
     - materialized read models
     - domain events

4. **No Cross-Module Writes**
   - Direct database writes across modules are forbidden

5. **Event-Driven Synchronization**
   - State changes are propagated via domain events

6. **AI Safety Rule**
   - AI must never infer ownership
   - Ownership must be explicitly defined here

---

## 3. Ownership Legend

| Term | Meaning |
|----|-------|
| OWNS | Module has full CRUD authority |
| READ | Module may read but not modify |
| SUBSCRIBE | Module consumes domain events only |
| FORBIDDEN | Module must not access data |

---

## 4. Authoritative Data Ownership Map

---

### 4.1 Identity & Tenant Module

**OWNS**
- Tenant
- User
- Role
- Permission
- RoleAssignment
- ScopeAssignment

**READ**
- Project (basic metadata)

**SUBSCRIBE**
- ProjectCreated

**FORBIDDEN**
- BOQ
- WBS
- Progress
- Cost
- Quality
- EHS

---

### 4.2 Project & Structure Module

**OWNS**
- Project
- Site
- Block / Zone / Building
- Floor / Level
- Discipline

**READ**
- Tenant
- User (basic identity)

**SUBSCRIBE**
- TenantCreated

**FORBIDDEN**
- BOQ rates
- Cost values
- Progress quantities

---

### 4.3 BOQ & Contract Module

**OWNS**
- BOQ
- BOQItem
- ContractType
- MeasurementStandard
- MeasurementRule

**READ**
- Project
- Discipline

**SUBSCRIBE**
- ProjectCreated

**FORBIDDEN**
- ProgressEntry
- CostActual
- EarnedValue

---

### 4.4 WBS & Planning Module

**OWNS**
- WBS
- WBSNode
- Task / Activity
- Dependency
- Calendar
- Milestone

**READ**
- BOQItem
- MeasurementRule
- Discipline

**SUBSCRIBE**
- BOQImported
- BOQItemClassified

**FORBIDDEN**
- QuantityMeasurement
- CostRecognition

---

### 4.5 Baseline & Versioning Module

**OWNS**
- Baseline
- BaselineVersion
- LockState

**READ**
- WBS
- Task
- ResourceAllocation

**SUBSCRIBE**
- WBSCreated
- TaskCreated

**FORBIDDEN**
- ProgressEntry
- QualityInspection
- Incident

---

### 4.6 Resource Management Module

**OWNS**
- Resource
- ResourceType
- ResourceAllocation
- ProductivityNorm

**READ**
- Task
- Calendar
- ContractType

**SUBSCRIBE**
- BaselineApproved

**FORBIDDEN**
- CostBaseline
- EarnedValue

---

### 4.7 Lookahead & Forecasting Module

**OWNS**
- LookaheadPlan
- ForecastWindow

**READ**
- Task
- ResourceAllocation
- ProgressEntry

**SUBSCRIBE**
- ProgressUpdated
- BaselineApproved

**FORBIDDEN**
- Direct resource modification
- Cost recognition

---

### 4.8 Progress & Quantity Module

**OWNS**
- ProgressEntry
- QuantityMeasurement
- Certification

**READ**
- Task
- MeasurementRule
- ResourceAllocation

**SUBSCRIBE**
- TaskStarted
- TaskCompleted

**FORBIDDEN**
- CostActual
- QualityInspection approval

---

### 4.9 Quality Management (QMS) Module

**OWNS**
- QualityStandard
- ChecklistTemplate
- Inspection
- NCR
- CAPA

**READ**
- Task
- BOQItem
- ProgressEntry

**SUBSCRIBE**
- TaskStarted
- ProgressUpdated

**FORBIDDEN**
- Cost recognition
- Schedule modification

---

### 4.10 EHS Management Module

**OWNS**
- SafetyChecklist
- RiskAssessment
- Incident
- Observation

**READ**
- Task
- Site
- ProgressEntry

**SUBSCRIBE**
- TaskStarted
- IncidentReported

**FORBIDDEN**
- CostActual
- Baseline modification

---

### 4.11 Execution Gate Module

**OWNS**
- ExecutionGate
- GateApproval

**READ**
- Inspection
- SafetyChecklist
- Task

**SUBSCRIBE**
- PreExecutionChecklistApproved
- SafetyPreCheckApproved
- PostExecutionChecklistApproved

**FORBIDDEN**
- Editing checklist results
- Editing progress data

---

### 4.12 Delay, Claims & EOT Module

**OWNS**
- DelayEvent
- DelayImpact
- EOTRequest
- ClaimArtifact

**READ**
- Baseline
- Task
- ProgressEntry

**SUBSCRIBE**
- DelayDetected
- BaselineSuperseded

**FORBIDDEN**
- Progress modification
- Cost recognition

---

### 4.13 Cost & Earned Value Module

**OWNS**
- CostBaseline
- CostActual
- EarnedValue

**READ**
- QuantityMeasurement
- Certification
- ContractType

**SUBSCRIBE**
- QuantityCertified
- ActivityFinalized

**FORBIDDEN**
- Editing progress
- Editing quality or EHS data

---

### 4.14 Simulation & What-If Module

**OWNS**
- SimulationScenario
- SimulationResult

**READ**
- Task
- ResourceAllocation
- Baseline

**SUBSCRIBE**
- BaselineApproved

**FORBIDDEN**
- Writing to live schedules
- Writing to cost or progress

---

### 4.15 Document Management Module

**OWNS**
- Document
- DocumentVersion
- ApprovalRecord

**READ**
- Project
- Task

**SUBSCRIBE**
- TaskCompleted

**FORBIDDEN**
- Progress modification
- Cost modification

---

### 4.16 Workflow & Notification Module

**OWNS**
- WorkflowInstance
- ApprovalTask
- Notification

**READ**
- Domain entities (read-only)

**SUBSCRIBE**
- ApprovalRequested
- ApprovalCompleted

**FORBIDDEN**
- Domain data mutation

---

### 4.17 Audit & Compliance Module

**OWNS**
- AuditLog

**READ**
- All (read-only)

**SUBSCRIBE**
- All critical events

**FORBIDDEN**
- Modifying any domain data

---

### 4.18 Integration & Plugin Module

**OWNS**
- Plugin
- Webhook
- APIKey

**READ**
- Event payloads only

**SUBSCRIBE**
- Approved public events only

**FORBIDDEN**
- Direct DB access
- Internal state mutation

---

## 5. Data Sharing Mechanisms (Allowed)

Data may be shared ONLY via:

1. Domain events
2. Read-only APIs
3. Read-model projections
4. Cached materialized views

---

## 6. Forbidden Data Access Patterns

Cross-module database joins  
Writing foreign module tables  
Silent data duplication  
Plugin DB access  
AI-generated “helper writes”  

---

## 7. AI Governance Rules

When generating code:

- AI must consult this document before schema creation
- AI must reject cross-module writes
- AI must use events for synchronization
- AI must not infer ownership implicitly

---

## 8. Why This Document Is Critical

Without strict data ownership:
- Quality & EHS gates break
- Cost recognition becomes unreliable
- Claims & audits fail
- AI refactors cause regressions

With this document:
- Modules remain isolated
- Events become the backbone
- System scales safely
- AI becomes predictable

---

###  Governance Rule

This document is **authoritative and binding**.  
Any implementation that violates these data ownership rules is invalid.
