# DOMAIN_EVENTS.md
## Domain Event Catalog
### Construction Project Intelligence & Control Platform

---

## 1. Purpose of This Document

This document defines the **official domain event catalog** for the platform.

Domain events represent **facts that have already occurred** in the system.
They are immutable, versioned contracts used for:

- internal module communication
- plugins and integrations
- notifications and workflows
- analytics and reporting
- AI-driven insights
- audit reconstruction

This document is **authoritative**.  
Events must not be renamed, repurposed, or removed without versioning.

---

## 2. Domain Event Principles (Non-Negotiable)

1. Events are **immutable facts**
2. Events are emitted **after successful state change**
3. Events describe **what happened**, not commands
4. Events are **append-only**
5. Events must be **versioned if changed**
6. Events must include sufficient context for replay
7. Events do NOT expose internal database structures

---

## 3. Standard Event Envelope (Mandatory)

All events must conform to this structure:

``json
{
  "eventId": "uuid",
  "eventType": "EventName",
  "eventVersion": "v1",
  "occurredAt": "ISO-8601 timestamp",
  "tenantId": "uuid",
  "projectId": "uuid | null",
  "siteId": "uuid | null",
  "actor": {
    "userId": "uuid",
    "role": "string"
  },
  "payload": { }
}



## 4. Identity & Tenant Events
TenantCreated
Emitted when a new tenant is created.

UserInvited
Emitted when a user is invited to a tenant.

RoleAssigned
Emitted when a role is assigned within a scope.

## 5. Project & Structure Events
ProjectCreated
ProjectUpdated
ProjectArchived
SiteCreated
SiteUpdated
ProjectStructureUpdated
Hierarchy or discipline structure modified.

##6. BOQ & Contract Events
BOQImported
BOQ uploaded and parsed successfully.

BOQValidated
BOQ validation completed.

BOQItemClassified
Contract type or measurement rule assigned.

MeasurementRuleAssigned
Measurement standard applied to BOQ items.

7. WBS & Planning Events
WBSCreated
WBSUpdated
TaskCreated
TaskUpdated
DependencyDefined
Logical dependency created or modified.

MilestoneDefined
8. Baseline & Versioning Events
BaselineDraftCreated
BaselineSubmitted
BaselineApproved
BaselineSuperseded
LockApplied
Task-level or project-level lock enabled.

9. Resource Management Events
ResourceCreated
ResourceUpdated
ResourceAllocated
ResourceReleased
ProductivityNormDefined
10. Lookahead & Forecasting Events
LookaheadGenerated
3-month or 6-month lookahead created.

ForecastUpdated
Resource or material forecast recalculated.

11. Execution & Progress Events
TaskStarted
Activity execution initiated (after pre-execution gates).

ProgressUpdated
Progress quantity or status updated.

QuantityMeasured
Quantity measured as per standard.

QuantityCertified
Partial or final quantity approved.

12. Quality Management (QMS) Events
PreExecutionChecklistRequired
Triggered when task start is requested.

PreExecutionChecklistSubmitted
Checklist completed by site team.

PreExecutionChecklistApproved
QC approval granted.

PreExecutionChecklistRejected
QC rejection with remarks.

PostExecutionChecklistRequired
Triggered on task completion request.

PostExecutionChecklistSubmitted
Post-execution inspection completed.

PostExecutionChecklistApproved
Final quality acceptance.

NCRCreated
Non-conformance reported.

NCRResolved
NCR closed after CAPA.

13. EHS (Environment, Health & Safety) Events
SafetyPreCheckRequired
SafetyPreCheckSubmitted
SafetyPreCheckApproved
SafetyPreCheckRejected
SafetyPostCheckRequired
SafetyPostCheckApproved
IncidentReported
IncidentEscalated
IncidentClosed
14. Execution Gate Events
PreExecutionGateApproved
Both QC and EHS approvals completed.

PreExecutionGateRejected
PostExecutionGateApproved
Final QC & EHS sign-off completed.

ActivityFinalized
Activity officially closed for cost recognition.

15. Cost & Earned Value Events
CostBaselineCreated
CostRecognized
EarnedValueCalculated
16. Delay, Claims & EOT Events
DelayDetected
Automatically identified schedule deviation.

DelayLogged
Manual delay entry.

ConcurrencyDelayIdentified
DelayApproved
DelayRejected
EOTPrepared
EOTSubmitted
EOTApproved
ClaimPrepared
ClaimSubmitted
17. Simulation & What-If Events
SimulationRun
SimulationResultGenerated
ScenarioCompared
18. Document Management Events
DocumentUploaded
DocumentVersionCreated
DocumentApproved
DocumentRejected
19. Workflow & Notification Events
ApprovalRequested
ApprovalCompleted
ApprovalEscalated
NotificationSent
20. Audit & Compliance Events
AuditRecorded
Represents a critical auditable action.

21. Integration & Plugin Events
WebhookRegistered
WebhookTriggered
PluginInstalled
PluginEnabled
PluginDisabled
22. Event Versioning Rules
Backward-compatible changes → same version

Breaking changes → new version (v2, v3)

Old versions must remain supported

23. Forbidden Practices
Mutating past events
Reusing event names for different meanings
Emitting events before transaction commit
Plugin access to internal events not documented here

24. AI Governance Rules
When generating code:

AI must emit events defined here

AI must not invent new events

AI must version events correctly

AI must include full event envelope
