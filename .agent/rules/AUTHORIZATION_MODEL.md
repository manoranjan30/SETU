# AUTHORIZATION_MODEL.md
## Authorization & Access Control Model
### Construction Project Intelligence & Control Platform

---

## 1. Purpose of This Document

This document defines the **authoritative authorization model** for the platform.

It governs:
- who can do what
- at which scope
- under which conditions
- with which approvals

This is a **governing contract for AI-driven development**.  
All backend logic, APIs, workflows, and plugins MUST follow this model.

---

## 2. Core Authorization Principles (Non-Negotiable)

1. **Authentication ≠ Authorization**
   - Authentication is handled by an external Identity Provider (IdP)
   - Authorization is enforced internally by this system

2. **Permission-Driven, Not Role-Driven**
   - Roles are collections of permissions
   - Permissions are the atomic units of access

3. **Scope-Aware Access**
   - Permissions are valid only within assigned scopes
   - Scope determines data visibility and action rights

4. **Server-Side Enforcement Only**
   - No authorization logic in frontend
   - Frontend only reflects server decisions

5. **Auditability**
   - Every privileged action must be auditable
   - Authorization decisions must be reconstructable

---

## 3. Authorization Model Overview

The platform uses a **hybrid RBAC + ABAC model**:

User
└── RoleAssignment
├── Role
│ └── Permissions
└── Scope (Tenant / Project / Site)



- **RBAC** → who *can* do something
- **ABAC** → *under what conditions* they can do it

---

## 4. Scope Model (Authoritative)

### 4.1 Supported Scope Levels

1. **Tenant**
   - Company-wide access
   - Cross-project visibility

2. **Project**
   - Access limited to a specific project

3. **Site**
   - Access limited to a physical site/location

### 4.2 Scope Rules

- A user may have multiple roles across different scopes
- Same user can have different roles in different projects
- Higher scope does NOT automatically grant lower-scope permissions unless explicitly defined

---

## 5. Roles (Default System Roles)

> Roles are configurable, but the following are canonical system roles.

### 5.1 Tenant-Level Roles

| Role | Description |
|----|-----------|
| TenantAdmin | Full administrative control across tenant |
| PortfolioManager | Read/write access across projects |
| Auditor | Read-only access with audit visibility |

---

### 5.2 Project-Level Roles

| Role | Description |
|----|-----------|
| ProjectManager | Overall project control & approvals |
| PlanningEngineer | Schedule, baseline, and planning |
| QuantitySurveyor | BOQ, measurement, cost certification |
| QCManager | Quality governance & NCR approvals |
| EHSManager | Safety & environmental governance |
| ContractsManager | Claims, EOT, contract changes |

---

### 5.3 Site-Level Roles

| Role | Description |
|----|-----------|
| SiteEngineer | Daily execution & progress updates |
| Supervisor | Site-level coordination |
| QCInspector | Inspections & checklist approvals |
| EHSEngineer | Safety inspections & incidents |
| StoreIncharge | Material receipt & issue |

---

### 5.4 External / Limited Roles

| Role | Description |
|----|-----------|
| Contractor | Limited execution visibility |
| Subcontractor | BOQ-specific execution access |
| ClientViewer | Read-only access |
| Consultant | Review & recommendation access |

---

## 6. Permission Model

### 6.1 Permission Naming Convention

<module>.<resource>.<action>[.<subaction>]



**Examples**
- project.create
- boq.import
- wbs.generate
- task.update.progress
- quality.precheck.approve
- ehs.incident.report
- cost.certify.partial
- baseline.approve
- delay.approve
- eot.prepare

---

### 6.2 Permission Categories

These can be created while developing the module

#### Structural & Planning
- project.create
- project.update
- boq.import
- boq.classify
- wbs.create
- task.create
- dependency.define
- baseline.submit
- baseline.approve

#### Execution & Progress
- task.start
- task.update.progress
- task.mark.complete
- quantity.measure
- quantity.certify.partial

#### Quality (QMS)
- quality.precheck.submit
- quality.precheck.approve
- quality.postcheck.submit
- quality.postcheck.approve
- ncr.create
- ncr.resolve

#### EHS
- ehs.precheck.submit
- ehs.precheck.approve
- ehs.incident.report
- ehs.incident.escalate
- ehs.postcheck.approve

#### Cost & Finance
- cost.view
- cost.certify
- cost.recognize

#### Delay & Claims
- delay.log
- delay.approve
- eot.prepare
- claim.prepare

#### Administration
- role.assign
- permission.assign
- plugin.install
- integration.configure

---

## 7. Conditional (ABAC) Rules

Some permissions are subject to conditions:

### 7.1 Execution Gate Conditions

- `task.start` requires:
  - quality.precheck.approved == true
  - ehs.precheck.approved == true

- `task.mark.complete` requires:
  - post-execution checklists submitted

- `cost.recognize` requires:
  - quality.postcheck.approved == true
  - ehs.postcheck.approved == true

---

### 7.2 Contract-Aware Rules

- Item-rate contracts:
  - cost recognized by quantity certification
- Resource-based contracts:
  - cost recognized only after resource + progress validation

---

### 7.3 Delay & Claims Rules

- Delay approval requires:
  - baseline exists
  - impact analysis completed
  - authority level ≥ delay severity

---

## 8. Delegation & Subcontract Access

- Subcontractors:
  - Access limited to mapped BOQ items
  - Cannot modify baseline or cost rates
  - Cannot approve quality or EHS

- Delegation:
  - Temporary delegation allowed
  - Time-bound and auditable
  - Explicit permission mapping required

---

## 9. Authorization Enforcement Points

Authorization MUST be enforced at:

1. API Gateway / Controller layer
2. Domain service layer
3. Execution Gate checks
4. Background jobs
5. Plugin API boundaries

---

## 10. Audit & Traceability Requirements

For every privileged action, the system must record:

- user id
- role
- permission
- scope
- timestamp
- affected entity
- old value → new value

These records must be immutable.

---

## 11. Plugin & Integration Authorization

- Plugins receive scoped API keys
- Plugin permissions are explicitly granted
- Plugins cannot bypass execution gates
- Plugins are read-only by default unless explicitly allowed

---

## 12. Authorization Anti-Patterns (Forbidden)

Hardcoded role checks  
Frontend-enforced permissions  
Direct DB access by plugins  
Implicit scope inheritance  
Bypassing quality or EHS gates  

---

## 13. AI Governance Rules

When generating code:

- AI must use permission constants, not strings
- AI must not infer permissions implicitly
- AI must always validate scope
- AI must log authorization decisions for critical actions

---

## 14. Definition of Success

The authorization system is successful if:

- No unauthorized action is possible['hich
- Quality and EHS gates cannot be bypassed
- Subcontractors are strictly sandboxed
- Claims and audits can reconstruct all decisions
- Permissions can evolve without code rewrites

---

###Governance Rule

This document is **authoritative and binding**.  
Any backend implementation that violates this authorization model is invalid.