# SETU Module Documentation Plan

## 1. Purpose

This plan defines how SETU will be documented module by module. It is intended to support a deliberate review process: we first agree on the documentation depth and format, then document one module at a time using verified repository evidence.

This plan is complementary to [`app-structure-module-wise.md`](./app-structure-module-wise.md). That document describes the current application landscape; this document describes the work required to create maintainable, detailed module documentation.

## 2. Documentation Principles

1. Document behavior from source code, routes, database entities, and tests rather than assumptions.
2. Keep business behavior, technical implementation, and operational guidance distinguishable.
3. Record uncertainty explicitly when code, configuration, or runtime behavior is incomplete.
4. Link every module document to its backend, web, mobile, API, and database evidence.
5. Document permissions, status transitions, audit behavior, synchronization, and failure paths wherever they apply.
6. Keep module documents independently useful, while maintaining a common vocabulary across the full set.
7. Review each module with the product owner or module owner before moving to the next approval gate.

## 3. Recommended Documentation Set

The work should produce the following documents:

| Document | Purpose |
|---|---|
| `docs/app-structure-module-wise.md` | Overall repository and application architecture overview |
| `docs/module-documentation-plan.md` | This sequencing, template, and review plan |
| `docs/modules/<module>.md` | One approved document per functional module |
| `docs/api/<module>.md` | Optional endpoint-level reference for modules with a large API surface |
| `docs/data/<module>.md` | Optional entity, relationship, and data lifecycle reference |
| `docs/workflows/<workflow>.md` | Optional cross-module business workflow reference |
| `docs/decisions/<id>-<topic>.md` | Important design decisions and unresolved architectural choices |
| `docs/glossary.md` | Shared business and technical terminology |
| `docs/module-index.md` | Status, ownership, links, and last-reviewed date for every module |

The first pass should use one module document per functional area. Split out API, data, or workflow documents only when the main document becomes difficult to navigate.

## 4. Standard Module Document Template

Every module document should use the following sections. Sections that do not apply should say `Not applicable` with a reason instead of being silently omitted.

### 4.1 Identity and Scope

- Module name and short description
- Business purpose
- In-scope capabilities
- Out-of-scope capabilities
- Primary user roles
- Module owner and technical owner
- Status: draft, under review, approved, or needs update

### 4.2 User and Business Behavior

- User journeys and entry points
- Main screens, routes, and actions
- Business rules and validations
- State transitions and status meanings
- Notifications, approvals, escalations, and audit requirements
- Expected success and failure outcomes

### 4.3 Architecture and Code Map

- Backend module, controllers, services, entities, DTOs, guards, and helpers
- Frontend pages, views, components, services, types, and route configuration
- Flutter screens, providers/blocs/controllers, repositories, and local models
- External integrations and shared dependencies
- Important configuration and environment variables

### 4.4 API Contract

For each endpoint or endpoint group:

- HTTP method and path
- Authentication and permission requirements
- Request parameters, body, and examples
- Response shape and important fields
- Pagination, filtering, sorting, and export behavior
- Validation and error responses
- Side effects and audit events

### 4.5 Data Model and Lifecycle

- Tables/entities and ownership
- Key fields and relationships
- Create, update, archive, delete, and restore behavior
- Status/history/audit records
- Transaction boundaries and consistency expectations
- Import/export and synchronization behavior
- Seed, migration, or reference-data dependencies

### 4.6 Integration and Runtime Behavior

- Events and module-to-module dependencies
- Background jobs or scheduled processes
- File, PDF, spreadsheet, or image processing
- Offline/mobile synchronization behavior
- Caching and performance considerations
- Logging, monitoring, and operational troubleshooting

### 4.7 Security and Permissions

- Roles and permission keys
- Resource/project-level access rules
- Data sensitivity and exposed fields
- Input validation and upload restrictions
- Audit expectations
- Known security risks or open questions

### 4.8 Testing and Support

- Existing unit, integration, API, and end-to-end tests
- Manual test scenarios
- Important edge cases
- Known gaps and technical debt
- Deployment prerequisites
- Troubleshooting guide

### 4.9 Traceability

- Source file links
- Route and endpoint links
- Entity/table links
- Related modules
- Related decisions, issues, and workflow documents
- Last verified commit/date

## 5. Evidence Collection Checklist

Before writing a module, inspect the following evidence in order:

1. Backend module directory and `app.module.ts` registration.
2. Controllers and route decorators.
3. Services and business rules.
4. Entities, migrations, DTOs, enums, and validation pipes.
5. Guards, permission checks, audit calls, and shared utilities.
6. Frontend routes, pages, views, components, API services, and types.
7. Flutter feature screens, state management, repositories, local persistence, and sync code.
8. Tests, fixtures, seed data, and test scripts.
9. Docker/configuration files and environment variables.
10. Git history or existing project plans when behavior is unclear.

The document writer should distinguish `implemented`, `partially implemented`, `configured but unused`, and `planned/inferred` behavior.

## 6. Documentation Workflow and Approval Gates

### Phase 0: Agree on the Documentation Contract

Output: approved template, naming convention, audience, ownership model, and definition of done.

Decisions to make together:

- Is the primary audience product, engineering, operations, or all three?
- Should API details live inside module documents or separate API documents?
- Should diagrams be Mermaid, screenshots, or both?
- How much code-level detail is expected for frontend and Flutter internals?
- Who approves business behavior and who approves technical accuracy?
- What is the target review cadence and document versioning approach?

### Phase 1: Build the Module Register

Output: `docs/module-index.md` with module names, owners, dependencies, document status, and review status.

The register should reconcile three views of the product:

- Backend domain modules
- Web frontend route and service modules
- Flutter mobile feature modules

Cross-platform modules should have one primary module document with platform-specific subsections unless their behavior is materially different.

### Phase 2: Document the Platform Foundations

Output: foundation documentation used by every later module.

Topics:

- Authentication, session/token handling, and user identity
- Roles and permissions
- Projects, tenants, configuration, and reference data
- Audit, notifications, synchronization, and shared error handling
- Deployment, database, PDF processor, storage, and environment configuration

### Phase 3: Document Core Planning and Execution Modules

Output: the first business-critical module set. These modules establish the project lifecycle and most downstream dependencies.

### Phase 4: Document Commercial, Quality, Safety, and Workforce Modules

Output: operational module documentation, including the data and workflow links back to planning and execution.

### Phase 5: Document Analytics, Administration, and Extensibility

Output: documentation for dashboards, AI insights, admin tools, builders, plugins, and configuration-driven capabilities.

### Phase 6: Cross-Module Workflows and System Verification

Output: workflow documents and a traceability review showing that every route, backend module, and mobile feature is either documented or intentionally excluded.

## 7. Proposed Module Sequence

The sequence is dependency-aware. It is a starting proposal for review, not a claim that the business priority cannot change.

### Wave A: Foundations and Access

1. Auth
2. Users
3. Roles
4. Permissions
5. Projects
6. App Config
7. Audit
8. Notifications
9. Sync
10. Common/shared services

### Wave B: Project Definition and Planning

11. WBS
12. Design
13. BOQ
14. Resources
15. Planning
16. Micro Schedule
17. Milestones
18. Release Strategy
19. Template Builder

### Wave C: Execution and Progress

20. Execution
21. Progress
22. Work Documents
23. Labor
24. Dashboard
25. Customer Milestones

### Wave D: Control and Compliance

26. Quality
27. Snag
28. EHS
29. Issue Tracker
30. Cost and Budget

### Wave E: Analytics, Administration, and Extensibility

31. Executive Dashboard
32. Dashboard Builder
33. AI Insights
34. Admin Data
35. Custom Tracker
36. Table View
37. Plugins and Plugin SDK
38. Temporary Users

### Wave F: Platform and Client Operations

39. Flutter mobile shell and shared mobile infrastructure
40. Flutter offline-first and synchronization behavior
41. Flutter feature parity by feature: planning, design, EHS, labor, progress, projects, quality, profile, settings, server setup, and Tower Lens
42. PDF processor service
43. Load testing and performance documentation
44. Deployment, release, backup, and recovery operations

## 8. Per-Module Execution Plan

Each module should pass through the same small loop:

1. Define scope and owner.
2. Collect source evidence.
3. Map the business workflow.
4. Map backend, web, and mobile implementation.
5. Record API and data behavior.
6. Record permissions, audit, integrations, and failure paths.
7. Draft the document.
8. Run a technical verification against the repository.
9. Run a business review with the module owner.
10. Resolve findings and mark the module approved.
11. Add links and dependencies to `module-index.md`.
12. Record unresolved decisions separately instead of hiding them in prose.

## 9. Definition of Done

A module is complete only when:

- Its scope and owner are recorded.
- All known entry points are listed.
- Backend, web, and mobile implementations are mapped.
- API, data, permission, audit, and integration behavior are described.
- Happy paths and important failure paths are documented.
- Existing tests and meaningful gaps are listed.
- Source links have been checked against the current repository.
- Business and technical reviewers have approved it, or open findings are explicitly recorded.
- The module index links to the document and records its review date.

## 10. Review Questions for Every Module

- What problem does this module solve for the user?
- Which roles can view, create, edit, approve, export, or delete data?
- What is the source of truth for each important field?
- What statuses exist, and who or what changes them?
- Which other modules must be configured first?
- What happens when an API call, upload, integration, or sync operation fails?
- What data is historical, auditable, calculated, or user-entered?
- Are web and Flutter behavior equivalent? If not, what is intentionally different?
- Which behavior is implemented today versus planned or inferred?
- What support issue would a new engineer or operator most likely need to troubleshoot?

## 11. Initial Decision Log

These decisions should be confirmed before Wave A begins:

- Documentation audience and level of technical depth
- Canonical module names and grouping of frontend-only services
- Whether `Cost and Budget`, `Customer Milestones`, `Issue Tracker`, `Release Strategy`, and `Custom Tracker` are standalone business modules or submodules
- API documentation format and example payload policy
- Diagram standard and storage location
- Ownership and approval responsibilities
- Versioning policy for documents when behavior changes
- Treatment of known configuration inconsistencies, including the PDF processor port mismatch noted in the architecture overview

## 12. Suggested Working Rhythm

Review one foundation module first to validate the template. Then complete one module per review cycle, keeping the register updated after every approval. After each wave, perform a dependency and terminology review before starting the next wave.

The first practical milestone is not a large batch of documents: it is an approved template plus one approved foundation module, preferably Auth or Projects. That gives the team a concrete standard to refine before the documentation effort expands.
