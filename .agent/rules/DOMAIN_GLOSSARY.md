# DOMAIN_GLOSSARY.md
## Construction Project Intelligence & Control Platform

---

## 1. Purpose of This Document

This document defines the **canonical domain language** for the platform.

All code, database models, APIs, workflows, dashboards, documentation, plugins, and AI prompts **MUST use these terms exactly as defined**.

No synonyms, alternate names, or overloaded meanings are permitted.

---

## 2. Core Governance Terms

### Tenant
A company or legal entity using the platform.  
All data is logically isolated per tenant.

### User
An authenticated individual belonging to a tenant.

### Role
A named collection of permissions assigned to a user within a scope.

### Permission
An atomic, verifiable action that a user or plugin may perform.

### Scope
The boundary within which a role and its permissions apply.
Supported scopes: Tenant, Project, Site.

### Audit Log
An immutable record capturing who did what, when, where, and why.

---

## 3. Project & Structural Terms

### Project
A construction project executed under a tenant, defined by contractual scope, schedule, cost, quality, and safety requirements.

### Site
A physical location where construction activities are executed.

### Block / Zone / Building
A logical or physical subdivision of a site.

### Floor / Level
A vertical subdivision within a block or building.

### Discipline
A functional classification of work (e.g., Civil, Structural, MEP, Finishes).

---

## 4. Contract & BOQ Terms

### Contract
A legally binding agreement governing scope, rates, measurement rules, and execution obligations.

### Contract Type
The method by which work is priced and paid:
- Item Rate
- Lump Sum / Composite
- Resource-Based
- Hybrid

### BOQ (Bill of Quantities)
A contractual list of items describing scope, quantity, unit, and rate.

### BOQ Item
A single measurable line item in a BOQ.

### Measurement Standard
The formal rule set governing how quantities are measured  
(e.g., IS, CPWD, or project-specific standards).

### Measurement Rule
A specific instruction for measuring, rounding, aggregating, or certifying quantities.

---

## 5. Planning & Scheduling Terms

### WBS (Work Breakdown Structure)
A hierarchical decomposition of project scope into manageable execution units.

### WBS Node
A single element within the WBS hierarchy.

### Task / Activity
The smallest schedulable unit of work with defined duration, dependencies, and quantities.

### Dependency
A logical relationship between tasks (FS, SS, FF, SF).

### Calendar
A definition of working and non-working days, shifts, and holidays.

### Milestone
A zero-duration control point representing a key event or deliverable.

---

## 6. Baseline & Versioning Terms

### Baseline
An approved, frozen reference plan for scope, schedule, cost, and resources.

### Baseline Version
A historical snapshot of a baseline at a specific point in time.

### Lock Level
The degree of immutability applied to baseline data:
- Task-level lock
- Project-level lock

---

## 7. Resource Management Terms

### Resource
Any input required to execute work:
- Labor
- Equipment
- Material

### Resource Allocation
The assignment of a resource to a task for a defined duration and quantity.

### Productivity Norm
A standard rate defining output per unit of resource effort.

---

## 8. Execution & Progress Terms

### Progress Entry
A recorded update reflecting actual execution status of a task.

### Quantity Measurement
The measured quantity of work executed, based on measurement rules.

### Partial Quantity Certification
Approval of a portion of executed quantity prior to full task completion.

### Execution Status
The lifecycle state of a task:
- Not Started
- In Progress
- Completed
- Blocked
- Delayed

---

## 9. Quality Management (QMS) Terms

### Quality Standard
A defined quality requirement or specification governing work acceptance.

### Checklist Template
A reusable set of inspection questions mapped to activities.

### Pre-Execution Checklist
Quality checks required before task execution begins.

### Post-Execution Checklist
Quality checks required before final task closure.

### Inspection
A formal quality evaluation conducted against a checklist.

### NCR (Non-Conformance Report)
A formal record of deviation from quality requirements.

### CAPA (Corrective and Preventive Action)
Actions defined to correct and prevent recurrence of non-conformances.

---

## 10. EHS (Environment, Health & Safety) Terms

### EHS
Environment, Health, and Safety governance framework.

### Safety Checklist
A checklist ensuring safe execution of an activity.

### Risk Assessment
Identification and evaluation of hazards and control measures.

### Incident
An unplanned event resulting in injury, damage, or near miss.

### Observation
A recorded safety-related note or unsafe condition.

---

## 11. Execution Gate Terms

### Execution Gate
A mandatory approval checkpoint controlling task start or closure.

### Pre-Execution Gate
Approval required before an activity can begin.

### Post-Execution Gate
Approval required before an activity can be finalized.

---

## 12. Cost & Performance Terms

### Cost Baseline
Approved planned cost derived from BOQ and resource planning.

### Actual Cost
Cost incurred based on certified progress.

### Earned Value
Value of work performed based on approved progress.

### EVA (Earned Value Analysis)
Performance measurement technique comparing planned, earned, and actual values.

---

## 13. Delay, Claims & EOT Terms

### Delay Event
A recorded instance where execution deviates from baseline schedule.

### Concurrency Delay
Overlapping delays affecting parallel activities.

### Impact Analysis
Assessment of delay effects on schedule and milestones.

### EOT (Extension of Time)
A formal request to extend contractual completion dates.

### Claim
A contractual request for time or cost compensation.

---

## 14. Lookahead & Forecasting Terms

### Lookahead Plan
A short-term execution forecast derived from baseline and progress.

### 3-Month Lookahead
A rolling forecast covering the next three months.

### 6-Month Lookahead
A rolling forecast covering the next six months.

### Forecast Window
The defined time horizon for lookahead planning.

---

## 15. Simulation & Intelligence Terms

### What-If Simulation
Scenario-based analysis to evaluate potential impacts of changes.

### Simulation Scenario
A defined set of hypothetical changes.

### Simulation Result
Computed outcomes of a simulation scenario.

---

## 16. Document & Evidence Terms

### Document
Any controlled file stored in the system (drawings, reports, photos).

### Document Version
A specific revision of a document.

### Evidence
Supporting proof such as photos, videos, or files.

### Geo-Tagged Evidence
Evidence captured with location metadata.

---

## 17. Integration & Plugin Terms

### Plugin
An external extension subscribing to platform events.

### Webhook
An HTTP callback triggered by a domain event.

### API Key
A credential granting scoped API access.

---

## 18. Forbidden Terms & Practices

The following are prohibited:
- Synonyms for defined terms
- Ambiguous naming
- Overloaded meanings
- Module-specific reinterpretations

If a concept is not defined here, it **must be added to this document before implementation**.

---

## 19. AI Governance Rules

When generating code or documentation:
- AI must use these terms exactly
- AI must not invent new domain terms
- AI must request glossary updates before introducing new concepts

---

### 🔒 Governance Rule

This document is **authoritative and binding**.  
Any implementation that violates this glossary is invalid.
