# SYSTEM_ARCHITECTURE.md
## System Architecture & Technical Blueprint
### Construction Project Intelligence & Control Platform

---

## 1. Purpose of This Document

This document defines the **end-to-end system architecture** of the platform.

It governs:
- application layers
- data flow
- service boundaries
- communication patterns
- non-functional requirements
- operational principles

This document is **authoritative and binding** for all AI-generated and human-written code.

---

## 2. Architectural Goals

The system architecture must:

1. Support complex construction workflows (BOQ, planning, execution, quality, EHS, cost)
2. Enforce execution gates (Quality + EHS)
3. Scale to large projects and portfolios
4. Remain auditable and compliant
5. Enable AI-driven development and future AI agents
6. Support plugins and integrations safely
7. Work reliably in low-connectivity site conditions

---

## 3. Architecture Style (Non-Negotiable)

### 3.1 Primary Style
- **Modular Monolith**
- **Event-Driven**
- **API-First**
- **Multi-Tenant SaaS**

### 3.2 Explicitly Not Used (for now)
- Distributed microservices
- Direct database sharing
- Client-side business logic
- Point-to-point integrations

---

## 4. High-Level System View

┌────────────────────┐
│ Web Application │
└─────────┬──────────┘
│
┌─────────▼──────────┐
│ Mobile Application│
└─────────┬──────────┘
│
┌─────────▼──────────┐
│ API Gateway │
│ (NestJS Controllers)│
└─────────┬──────────┘
│
┌─────────▼────────────────────────────────────────┐
│ Backend Application │
│ (Modular Monolith – NestJS) │
│ │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │ Planning │ │ Progress │ │ Quality │ │
│ └────────────┘ └────────────┘ └────────────┘ │
│ ▲ ▲ ▲ │
│ │ │ │ │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │ BOQ │ │ EHS │ │ Cost │ │
│ └────────────┘ └────────────┘ └────────────┘ │
│ │
│ Event Bus (Internal Domain Events) │
└─────────┬────────────────────────────────────────┘
│
┌─────────▼──────────┐
│ Infrastructure │
│ (DB, Cache, Queue) │
└────────────────────┘



---

## 5. System Layers (Authoritative)

---

### 5.1 Client Layer (Web & Mobile)

#### Responsibilities
- UI rendering
- User interactions
- Data visualization
- Offline data capture (mobile)

#### Restrictions
- No business logic
- No permission logic
- No state authority
- No execution gate decisions

Clients **only reflect backend decisions**.

---

### 5.2 API Layer (Gateway)

Implemented using **NestJS Controllers**

#### Responsibilities
- Authentication validation (via IdP)
- Authorization enforcement
- Request validation
- DTO mapping
- API versioning
- OpenAPI documentation

All client access passes through this layer.

---

### 5.3 Domain Layer (Modules)

The heart of the system.

#### Responsibilities
- Business rules
- State transitions
- Invariants
- Domain event emission

Each domain module is a **bounded context** as defined in  
`MODULE_BREAKDOWN_AND_BACKEND_ARCHITECTURE.md`.

---

### 5.4 Infrastructure Layer

#### Components
- PostgreSQL (Prisma ORM)
- Redis (cache, queues)
- Object Storage (documents, photos)
- Internal Event Bus
- Background Workers

#### Responsibilities
- Persistence
- Messaging
- Async processing
- External communication

---

## 6. Authentication & Authorization Architecture

### 6.1 Authentication
- Handled by external Identity Provider (Keycloak / Auth0 / Azure AD)
- Backend trusts IdP for identity only

### 6.2 Authorization
- Implemented internally using:
  - RBAC + ABAC
  - Scope enforcement (Tenant / Project / Site)

Defined fully in:
`AUTHORIZATION_MODEL.md`

---

## 7. Data Architecture

### 7.1 Database Strategy
- PostgreSQL
- Single logical database
- Multi-tenant via `tenant_id`
- Strong referential integrity

### 7.2 Data Ownership
- Strict module ownership
- No cross-module writes
- Synchronization via events only

Defined fully in:
`DATA_OWNERSHIP.md`

---

## 8. Event-Driven Architecture

### 8.1 Event Types
- Domain Events (internal)
- Integration Events (external)

### 8.2 Event Bus
- In-process for internal events
- Queue-backed for async tasks

### 8.3 Event Contracts
- Defined in `DOMAIN_EVENTS.md`
- Immutable
- Versioned

---

## 9. Execution Gate Architecture (Critical)

Execution gates enforce:

- Quality approvals
- EHS approvals

### Gate Types
- Pre-Execution Gate (before task start)
- Post-Execution Gate (before task closure)

### Enforcement
- Server-side only
- Cannot be bypassed
- Required for cost recognition

---

## 10. Mobile Offline Architecture

### 10.1 Offline Strategy
- Local persistence (SQLite / secure storage)
- Offline action queue
- Conflict-safe sync

### 10.2 Sync Rules
- Client submits intent
- Server validates state
- Server resolves conflicts
- Events reflect final state

---

## 11. Integration & Plugin Architecture

### 11.1 Integration Style
- API-based
- Event-driven
- Webhooks

### 11.2 Plugin Model
- External plugins only
- Subscribes to approved events
- Uses scoped API keys

Plugins:
- Cannot access DB
- Cannot bypass execution gates

---

## 12. Background Processing Architecture

Used for:
- Lookahead generation
- Forecasting
- Notifications
- Report generation
- Sync reconciliation
- Analytics aggregation

Implemented using:
- Queue workers
- Idempotent jobs

---

## 13. Observability & Audit Architecture

### 13.1 Logging
- Structured logs
- Correlation IDs

### 13.2 Audit Trails
- Immutable audit records
- Event-driven reconstruction

Defined in:
`AUDIT & COMPLIANCE MODULE`

---

## 14. Security Architecture

### Key Controls
- HTTPS everywhere
- Token-based auth
- Permission enforcement
- Data isolation
- Evidence immutability

### Forbidden
- Direct DB access
- Hardcoded permissions
- Client-side authorization

---

## 15. Scalability Strategy

### Current
- Single backend deployment
- Horizontal scaling via stateless services

### Future
- Module extraction into microservices
- Read replicas
- Dedicated analytics store

No redesign required.

---

## 16. Failure & Recovery

- Graceful degradation
- Retryable async jobs
- Event replay capability
- Backup & restore strategy

---

## 17. AI-First Development Rules

- Architecture documents are read before coding
- AI must not invent layers or services
- AI must respect module boundaries
- AI must emit domain events
- AI must not shortcut gates or validation

---

## 18. Why This Architecture Works

- Mirrors real construction workflows
- Enforces safety and quality
- Supports claims and audits
- Scales with complexity
- Ideal for AI-driven development

---

### 🔒 Governance Rule

This system architecture is **authoritative and binding**.  
Any implementation that violates this document is invalid.