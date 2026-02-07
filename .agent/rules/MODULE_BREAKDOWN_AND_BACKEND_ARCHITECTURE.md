# MODULE_BREAKDOWN_AND_BACKEND_ARCHITECTURE.md
## Construction Project Intelligence & Control Platform

---

## 1. Purpose of This Document

This document defines the **authoritative backend module structure and architecture** for the Construction Project Intelligence & Control Platform.

It is a **governing document for AI-driven development**.  
All backend code, schemas, APIs, workflows, and events MUST conform to this structure.

---

## 2. Architectural Principles (Non-Negotiable)

### 2.1 Architecture Style
- Modular Monolith
- Event-driven internal communication
- API-first design
- Multi-tenant SaaS
- AI-first development

### 2.2 Why Modular Monolith
- Ensures transactional consistency across schedule, cost, quality, and EHS
- Simplifies enforcement of execution gates
- Enables safe AI refactoring
- Allows future extraction into microservices if required
- Avoids premature distributed complexity

---

## 3. High-Level Backend Architecture

Web / Mobile Clients
|
v
API Layer (NestJS Controllers)
|
v
Domain Modules (Isolated Bounded Contexts)
|
v
Infrastructure Layer
├── PostgreSQL (Prisma ORM)
├── Redis (cache, queues)
├── Object Storage (documents, photos)
├── Event Bus (internal)
└── External Integrations / Plugins

---

## 4. Backend Layering Model

### 4.1 API Layer
Responsibilities:
- Authentication validation
- Authorization enforcement
- Request/response DTOs
- Input validation
- OpenAPI generation

### 4.2 Domain Layer
Responsibilities:
- Business rules
- State transitions
- Invariants
- Domain events

### 4.3 Infrastructure Layer
Responsibilities:
- Database persistence
- Messaging / queues
- File storage
- External API calls

---

## 5. Master Module Breakdown (Authoritative)

Each module is a **bounded context** with strict data ownership.

---

### 5.1 Identity & Tenant Module

**Purpose**  
Multi-tenant governance, identity, and authorization foundation.

**Owns**
- Tenant
- User
- Role
- Permission
- RoleAssignment

**Responsibilities**
- Tenant isolation
- User-role assignment
- Scope resolution (Tenant / Project / Site)
- Permission evaluation

**Key Events**
- TenantCreated
- UserInvited
- RoleAssigned

---

### 5.2 Project & Structure Module

**Purpose**  
Defines the physical and logical project hierarchy.

**Owns**
- Project
- Site
- Block / Zone / Building
- Floor / Level
- Discipline

**Responsibilities**
- Hierarchical structure creation
- Ownership and responsibility mapping
- Project lifecycle state

**Key Events**
- ProjectCreated
- ProjectStructureUpdated

---

### 5.3 BOQ & Contract Module

**Purpose**  
Contractual scope, quantities, rates, and measurement logic.

**Owns**
- BOQ
- BOQItem
- ContractType
- MeasurementStandard
- MeasurementRule

**Responsibilities**
- BOQ import & validation
- Contract classification
- Measurement standard enforcement
- BOQ → WBS traceability

**Key Events**
- BOQImported
- BOQValidated
- BOQItemClassified

---

### 5.4 WBS & Planning Module

**Purpose**  
Execution structure and schedule logic.

**Owns**
- WBS
- Activity / Task
- Dependency
- Calendar
- Milestone

**Responsibilities**
- BOQ-driven WBS generation
- Task sequencing & dependencies
- Schedule creation

**Key Events**
- WBSCreated
- TaskCreated
- DependencyDefined

---

### 5.5 Baseline & Versioning Module

**Purpose**  
Governance, locking, and historical traceability.

**Owns**
- Baseline
- BaselineVersion
- LockState

**Responsibilities**
- Baseline submission & approval
- Task-level and project-level locks
- Version comparison

**Key Events**
- BaselineSubmitted
- BaselineApproved
- BaselineSuperseded

---

### 5.6 Resource Management Module

**Purpose**  
Labor, equipment, and material planning.

**Owns**
- Resource
- ResourceType
- ResourceAllocation
- ProductivityNorm

**Responsibilities**
- Contract-aware resource planning
- Capacity analysis
- Allocation rules

**Key Events**
- ResourceAllocated
- ResourceReleased

---

### 5.7 Lookahead & Forecasting Module

**Purpose**  
Proactive execution planning.

**Owns**
- LookaheadPlan
- ForecastWindow

**Responsibilities**
- 3-month lookahead
- 6-month lookahead
- Demand forecasting
- Mobilization alerts

**Key Events**
- LookaheadGenerated
- ForecastUpdated

---

### 5.8 Progress & Quantity Module

**Purpose**  
Ground-truth execution capture.

**Owns**
- ProgressEntry
- QuantityMeasurement
- Certification

**Responsibilities**
- Mobile progress capture
- Partial quantity certification
- Measurement rule enforcement

**Key Events**
- ProgressUpdated
- QuantityCertified

---

### 5.9 Quality Management (QMS) Module

**Purpose**  
Quality governance and compliance.

**Owns**
- QualityStandard
- ChecklistTemplate
- Inspection
- NCR
- CAPA

**Responsibilities**
- Pre-execution inspections
- Post-execution inspections
- NCR lifecycle management

**Key Events**
- InspectionCompleted
- NCRCreated
- NCRClosed

---

### 5.10 EHS Management Module

**Purpose**  
Environmental, Health & Safety enforcement.

**Owns**
- SafetyChecklist
- RiskAssessment
- Incident
- Observation

**Responsibilities**
- Safety gating
- Incident reporting
- Risk escalation

**Key Events**
- IncidentReported
- SafetyApproved
- SafetyRejected

---

### 5.11 Execution Gate Module

**Purpose**  
Enforces Quality + EHS gates on activities.

**Owns**
- ExecutionGate
- GateApproval

**Responsibilities**
- Block activity start without pre-check approval
- Block activity closure without final sign-off
- Coordinate QC + EHS approvals

**Key Events**
- PreExecutionApproved
- PostExecutionApproved
- ActivityFinalized

---

### 5.12 Delay, Claims & EOT Module

**Purpose**  
Delay intelligence and claims readiness.

**Owns**
- DelayEvent
- DelayImpact
- EOTRequest
- ClaimArtifact

**Responsibilities**
- Delay detection
- Concurrency analysis
- Claim documentation

**Key Events**
- DelayDetected
- DelayApproved
- EOTPrepared

---

### 5.13 Cost & Earned Value Module

**Purpose**  
Financial performance tracking.

**Owns**
- CostBaseline
- CostActual
- EarnedValue

**Responsibilities**
- Cost recognition (post QC/EHS)
- Earned value calculations
- Cost dashboards

**Key Events**
- CostRecognized
- EarnedValueCalculated

---

### 5.14 Simulation & What-If Module

**Purpose**  
Decision support and scenario analysis.

**Owns**
- SimulationScenario
- SimulationResult

**Responsibilities**
- Schedule simulations
- Resource simulations
- Risk impact analysis

**Key Events**
- SimulationRun
- ScenarioCompared

---

### 5.15 Document Management Module

**Purpose**  
Controlled document lifecycle.

**Owns**
- Document
- DocumentVersion
- ApprovalRecord

**Responsibilities**
- Drawing management
- Version control
- Approval workflows

**Key Events**
- DocumentUploaded
- DocumentApproved

---

### 5.16 Workflow & Notification Module

**Purpose**  
Human approvals and escalations.

**Owns**
- WorkflowInstance
- ApprovalTask
- Notification

**Responsibilities**
- Approval routing
- Escalations
- Reminders

**Key Events**
- ApprovalRequested
- ApprovalCompleted

---

### 5.17 Audit & Compliance Module

**Purpose**  
Legal and regulatory traceability.

**Owns**
- AuditLog

**Responsibilities**
- Immutable audit trails
- Forensic reconstruction

**Key Events**
- AuditRecorded

---

### 5.18 Integration & Plugin Module

**Purpose**  
External ecosystem enablement.

**Owns**
- Webhook
- Plugin
- APIKey

**Responsibilities**
- Event subscriptions
- External integrations
- Plugin lifecycle management

**Key Events**
- PluginInstalled
- WebhookTriggered

---

## 6. Cross-Cutting Concerns

| Concern | Implementation |
|------|----------------|
| Authentication | External IdP |
| Authorization | Permission service |
| Validation | DTO + domain rules |
| Events | Central event bus |
| Files | Object storage |
| Offline sync | Progress module |
| Background jobs | Queue workers |

---

## 7. Backend Repository Structure

apps/api/src/modules/
identity/
project/
boq/
planning/
baseline/
resource/
lookahead/
progress/
quality/
ehs/
execution-gate/
delay/
cost/
simulation/
documents/
workflow/
audit/
integration/

yaml
Copy code

Each module contains:
- controller/
- service/
- domain/
- dto/
- events/
- permissions.ts

---

## 8. Event-Driven Backbone

All inter-module communication must occur via **domain events**, not direct data access.

Benefits:
- Plugin readiness
- Analytics readiness
- AI agent compatibility
- Loose coupling

---

## 9. AI Governance Rules

- No module accesses another module’s database tables directly
- All state changes emit domain events
- Execution gates cannot be bypassed
- Quality & EHS approvals are mandatory for cost recognition
- No business logic in frontend

---

## 10. Why This Architecture Works

- Matches real construction workflows
- Supports quality, safety, and claims
- Scales to large portfolios
- Safe for AI-driven development
- Future-proof for plugins and AI agents

---

## 11. Next Recommended Artifacts

From this architecture, the next logical documents are:

1. Prisma Master Data Model  
2. Permission Matrix (Roles × Actions × Scope)  
3. API Contracts (OpenAPI)  
4. Execution Gate Workflow Diagrams  

---

###  Governance Rule

This document is **authoritative**.  
Any backend implementation that deviates from this structure is considered invalid.