# Customer Milestone Module — Detailed Implementation Plan

**Date:** 2026-03-18
**Module:** Planning → Customer Milestones
**Scope:** Full-stack (NestJS backend + Flutter mobile + React web)
**Status:** PLAN — Do not implement until approved

---

## 1. Business Context & Domain Rules

### What are Customer Milestones?
In real-estate projects (like Puravankara), the sale agreement defines a payment schedule based on construction milestones. When a specific construction stage is completed:
- The **milestone is marked as achieved**
- A **collection demand** is raised for the customer
- The amount due = `collection_percentage × flat_sale_value`

### Example Milestone Schedule (typical Puravankara structure)

| # | Milestone Name | Linked Construction Activity | Collection % |
|---|---|---|---|
| 1 | Booking Amount | (manual — no activity) | 5% |
| 2 | Foundation Complete | Raft Foundation / Pile Cap Complete (QC Approved) | 10% |
| 3 | 5th Slab Complete | Floor 5 Slab Casting (QC Approved) | 10% |
| 4 | 10th Slab Complete | Floor 10 Slab Casting (QC Approved) | 10% |
| 5 | Structure Complete | Terrace Slab (QC Approved) | 10% |
| 6 | Brickwork Complete | Internal Brickwork Completion (Progress 100%) | 5% |
| 7 | Plaster Complete | Internal Plaster Completion (Progress 100%) | 5% |
| 8 | Flooring Complete | Floor/Tiling Completion (QC Approved) | 5% |
| 9 | Snag 1 Cleared | Snag 1 Round Released (Snag Module) | 5% |
| 10 | Possession / Handover | Snag 3 Round Released (Snag Module) | 35% |

### Key Business Rules
1. **Milestones are defined at project level** (template) — same milestone names across all units in a project.
2. **Achievement is per flat/unit** — milestone X is achieved separately for each unit.
3. **Auto-trigger**: When the linked activity (progress or quality) reaches the configured threshold, the milestone status auto-changes to **"Triggered"** (waiting collection team to confirm and raise invoice).
4. **Manual-trigger**: Some milestones (like Booking) have no linked activity; they are marked manually.
5. **Collection team confirms**: A separate role (Collection / CRM) reviews triggered milestones and marks them **"Achieved + Invoice Raised"** with invoice reference and actual collected amount.
6. **Collection % accumulates**: Shows running total % collected per flat.
7. **Partial collection**: A milestone may be collected in parts (e.g. first 50% collected, balance pending).

### Trigger Types (How a milestone is auto-triggered)

| Trigger Type | Description | Example |
|---|---|---|
| `QUALITY_APPROVED` | Linked quality activity (RFI) approved | Slab casting QC approved |
| `PROGRESS_PCT` | Linked planning activity reaches configured % | Brickwork reaches 100% |
| `SNAG_ROUND_RELEASED` | A snag round is released | Snag 1 or Snag 3 released |
| `MANUAL` | No linked activity — manually triggered | Booking amount |

---

## 2. Data Model Design

### 2.1 Backend Entities (TypeORM / PostgreSQL)

#### `customer_milestone_template` table
```
id                    SERIAL PRIMARY KEY
project_id            INTEGER FK → eps_nodes (project root)
name                  VARCHAR(255)                  -- "Foundation Complete"
description           TEXT nullable
sequence              INTEGER                        -- display order (1, 2, 3…)
collection_pct        DECIMAL(5,2)                  -- e.g. 10.00 (%)
trigger_type          ENUM('QUALITY_APPROVED','PROGRESS_PCT','SNAG_ROUND_RELEASED','MANUAL')
trigger_activity_id   INTEGER FK → planning_activities nullable   -- for PROGRESS_PCT
trigger_quality_activity_id  INTEGER FK → quality_activities nullable  -- for QUALITY_APPROVED
trigger_snag_round    INTEGER nullable               -- 1|2|3 for SNAG_ROUND_RELEASED
trigger_progress_pct  DECIMAL(5,2) nullable         -- threshold % for PROGRESS_PCT (usually 100)
applicable_to         ENUM('all_units','tower','floor','unit') DEFAULT 'all_units'
applicable_eps_ids    INTEGER[] nullable             -- specific towers/floors if not 'all_units'
is_active             BOOLEAN DEFAULT TRUE
created_by_id         INTEGER FK → users
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP
```

#### `customer_milestone_achievement` table
```
id                    SERIAL PRIMARY KEY
template_id           INTEGER FK → customer_milestone_template
project_id            INTEGER FK → eps_nodes
eps_node_id           INTEGER FK → eps_nodes        -- the unit/flat node
quality_unit_id       INTEGER FK → quality_units nullable
unit_label            VARCHAR(100)                  -- flat number, e.g. "A1-F3-103"
status                ENUM('not_triggered','triggered','invoice_raised','collected','partially_collected','waived')
  DEFAULT 'not_triggered'
triggered_at          TIMESTAMP nullable
triggered_by          VARCHAR(255) nullable          -- 'system' or user name
trigger_reference     VARCHAR(255) nullable          -- inspection ID / activity ID that caused trigger
collection_pct        DECIMAL(5,2)                  -- copy from template at time of trigger
flat_sale_value       DECIMAL(15,2) nullable        -- sale value of the flat (from FlatSaleInfo)
collection_amount     DECIMAL(15,2) nullable        -- = flat_sale_value × collection_pct / 100
invoice_number        VARCHAR(100) nullable
invoice_date          DATE nullable
invoice_raised_by_id  INTEGER FK → users nullable
amount_received       DECIMAL(15,2) nullable        -- actually collected
received_date         DATE nullable
received_by_id        INTEGER FK → users nullable
remarks               TEXT nullable
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP
```

#### `flat_sale_info` table
```
id                    SERIAL PRIMARY KEY
project_id            INTEGER FK → eps_nodes
eps_node_id           INTEGER FK → eps_nodes        -- unit node
quality_unit_id       INTEGER FK → quality_units nullable
unit_label            VARCHAR(100)
total_sale_value      DECIMAL(15,2)                 -- agreement value
customer_name         VARCHAR(255) nullable
agreement_date        DATE nullable
loan_bank             VARCHAR(255) nullable
remarks               TEXT nullable
created_by_id         INTEGER FK → users
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP
```
*Note: `flat_sale_info` may be imported from CRM/ERP via CSV or API integration.*

#### `milestone_collection_tranche` table (for partial collections)
```
id                    SERIAL PRIMARY KEY
achievement_id        INTEGER FK → customer_milestone_achievement
amount                DECIMAL(15,2)
received_date         DATE
payment_mode          ENUM('cheque','neft','rtgs','upi','demand_draft','other')
reference_number      VARCHAR(100)
bank_name             VARCHAR(255) nullable
remarks               TEXT nullable
collected_by_id       INTEGER FK → users
created_at            TIMESTAMP DEFAULT NOW()
```

### 2.2 Flutter Dart Models

#### `milestone_models.dart`
```dart
// ── Enums ─────────────────────────────────────────────────────────────────

enum MilestoneTriggerType {
  qualityApproved,
  progressPct,
  snagRoundReleased,
  manual;

  String get label {
    switch (this) {
      case MilestoneTriggerType.qualityApproved: return 'QC Approved';
      case MilestoneTriggerType.progressPct:    return 'Progress %';
      case MilestoneTriggerType.snagRoundReleased: return 'Snag Round';
      case MilestoneTriggerType.manual:          return 'Manual';
    }
  }
}

enum MilestoneAchievementStatus {
  notTriggered,
  triggered,
  invoiceRaised,
  collected,
  partiallyCollected,
  waived;

  Color get color {
    switch (this) {
      case MilestoneAchievementStatus.notTriggered:        return Colors.grey;
      case MilestoneAchievementStatus.triggered:           return Colors.amber.shade700;
      case MilestoneAchievementStatus.invoiceRaised:       return Colors.blue;
      case MilestoneAchievementStatus.collected:           return Colors.green;
      case MilestoneAchievementStatus.partiallyCollected:  return Colors.teal;
      case MilestoneAchievementStatus.waived:              return Colors.purple;
    }
  }

  String get label {
    switch (this) {
      case MilestoneAchievementStatus.notTriggered:       return 'Not Yet';
      case MilestoneAchievementStatus.triggered:          return 'Triggered';
      case MilestoneAchievementStatus.invoiceRaised:      return 'Invoice Raised';
      case MilestoneAchievementStatus.collected:          return 'Collected';
      case MilestoneAchievementStatus.partiallyCollected: return 'Partial';
      case MilestoneAchievementStatus.waived:             return 'Waived';
    }
  }

  IconData get icon { ... }
}

// ── Models ────────────────────────────────────────────────────────────────

class CustomerMilestoneTemplate extends Equatable {
  final int id;
  final int projectId;
  final String name;
  final String? description;
  final int sequence;
  final double collectionPct;
  final MilestoneTriggerType triggerType;
  final int? triggerActivityId;
  final int? triggerQualityActivityId;
  final int? triggerSnagRound;
  final double? triggerProgressPct;
  final bool isActive;
}

class MilestoneAchievement extends Equatable {
  final int id;
  final int templateId;
  final String milestoneName;   // denormalized from template
  final int sequence;           // denormalized from template
  final double collectionPct;   // denormalized from template
  final int epsNodeId;
  final String unitLabel;
  final MilestoneAchievementStatus status;
  final DateTime? triggeredAt;
  final String? triggerReference;
  final double? flatSaleValue;
  final double? collectionAmount;   // = flatSaleValue × collectionPct / 100
  final String? invoiceNumber;
  final String? invoiceDate;
  final double? amountReceived;
  final String? receivedDate;
  final String? remarks;
}

// ── Unit-level aggregate: all milestones for one flat ──────────────────────

class UnitMilestoneReport extends Equatable {
  final int epsNodeId;
  final String unitLabel;
  final double? flatSaleValue;
  final double totalCollectionPct;     // sum of all collected/invoiced milestones %
  final double totalAmountDue;         // sum of all triggered+ milestone amounts
  final double totalAmountCollected;   // sum of actual received amounts
  final int milestonesTotal;
  final int milestonesTriggered;
  final int milestonesCollected;
  final List<MilestoneAchievement> achievements;  // ordered by sequence
}

// ── Project-level aggregate ────────────────────────────────────────────────

class ProjectMilestoneSummary extends Equatable {
  final int projectId;
  final int totalUnits;
  final int milestonesConfigured;      // total milestone templates
  final double totalProjectValue;      // sum of all flat sale values
  final double totalAmountDue;         // sum of all triggered milestone amounts
  final double totalAmountCollected;   // sum of all received amounts
  final double collectionPct;          // totalAmountCollected / totalProjectValue × 100
  final List<MilestoneBlockSummary> blocks;
}

class MilestoneBlockSummary extends Equatable {
  final int epsNodeId;
  final String blockName;
  final int totalUnits;
  final double blockValue;
  final double blockCollected;
  final double collectionPct;
}
```

### 2.3 Drift DB Cache Tables

```dart
// cached_milestone_templates — project milestone config
class CachedMilestoneTemplates extends Table {
  IntColumn get id => integer()();
  IntColumn get projectId => integer()();
  TextColumn get name => text()();
  IntColumn get sequence => integer()();
  RealColumn get collectionPct => real()();
  TextColumn get triggerType => text()();
  TextColumn get jsonData => text()();
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

// cached_milestone_achievements — per-unit status
class CachedMilestoneAchievements extends Table {
  IntColumn get id => integer()();
  IntColumn get templateId => integer()();
  IntColumn get projectId => integer()();
  IntColumn get epsNodeId => integer()();
  TextColumn get status => text()();
  TextColumn get jsonData => text()();
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
```

---

## 3. Backend Implementation

### 3.1 File Structure
```
backend/src/milestone/
├── milestone.module.ts
├── milestone.controller.ts
├── milestone.service.ts
├── milestone-trigger.service.ts      // event listener for auto-triggers
├── milestone-report.service.ts       // aggregation/reporting queries
├── dto/
│   ├── create-milestone-template.dto.ts
│   ├── update-milestone-template.dto.ts
│   ├── raise-invoice.dto.ts          // { invoiceNumber, invoiceDate, collectionAmount }
│   ├── record-collection.dto.ts      // { amount, receivedDate, paymentMode, refNo }
│   ├── manual-trigger.dto.ts         // { reason, triggeredAt }
│   └── import-flat-sale-info.dto.ts  // for CSV import
├── entities/
│   ├── customer-milestone-template.entity.ts
│   ├── customer-milestone-achievement.entity.ts
│   ├── flat-sale-info.entity.ts
│   └── milestone-collection-tranche.entity.ts
└── migrations/
    └── CreateMilestoneTables.ts
```

### 3.2 REST API Endpoints

```
# Milestone Templates (Admin/Manager setup)
GET    /milestone/project/:projectId/templates         → list all templates for project
POST   /milestone/project/:projectId/templates         → create new milestone template
PATCH  /milestone/templates/:id                        → update template
DELETE /milestone/templates/:id                        → soft-delete template
POST   /milestone/project/:projectId/templates/reorder → reorder sequences

# Flat Sale Info
GET    /milestone/project/:projectId/flat-info         → list all flat sale values
POST   /milestone/project/:projectId/flat-info         → add/update a flat sale value
POST   /milestone/project/:projectId/flat-info/import  → bulk import via CSV/JSON
PATCH  /milestone/flat-info/:id                        → update flat sale info
DELETE /milestone/flat-info/:id                        → remove

# Achievements (per-unit milestone status)
GET    /milestone/project/:projectId/achievements      → all achievements, filterable
  ?epsNodeId=X          → achievements for one unit
  ?templateId=X         → achievements for one milestone across all units
  ?status=triggered     → only triggered (pending invoice)
  ?blockId=X            → filter by block
GET    /milestone/unit/:epsNodeId                      → full unit milestone report

# Actions on Achievements
POST   /milestone/achievements/:id/trigger             → manual trigger
POST   /milestone/achievements/:id/raise-invoice       → mark invoice raised
POST   /milestone/achievements/:id/collect             → record collection tranche
PATCH  /milestone/achievements/:id/waive               → waive (with reason)
GET    /milestone/achievements/:id/tranches            → collection tranches history

# Dashboard / Reports
GET    /milestone/project/:projectId/summary           → project-level aggregate
GET    /milestone/project/:projectId/block-summary     → per-block summary
GET    /milestone/project/:projectId/pending-invoices  → triggered but invoice not yet raised
GET    /milestone/project/:projectId/pending-collection → invoice raised but not collected

# Event hooks (internal — called by other services)
POST   /milestone/internal/trigger-by-quality          → called by QualityInspectionService on approve
POST   /milestone/internal/trigger-by-progress         → called by ExecutionService on progress update
POST   /milestone/internal/trigger-by-snag             → called by SnagReleaseService on round release
```

### 3.3 Key Service Logic

#### `milestone-trigger.service.ts` — Auto-trigger engine

```typescript
// Called by QualityInspectionService when an inspection is approved
async triggerByQualityApproval(
  qualityActivityId: number,
  epsNodeId: number,
  qualityUnitId: number | null,
  projectId: number,
): Promise<void> {
  // 1. Find templates with triggerType='QUALITY_APPROVED' AND triggerQualityActivityId=qualityActivityId
  // 2. For each matching template, find or create achievement for this unit
  // 3. If achievement.status = 'not_triggered' → update to 'triggered', set triggeredAt, triggerReference
  // 4. Calculate collectionAmount = flatSaleValue × collectionPct / 100 (if flatSaleValue is set)
  // 5. Push notification to collection role
}

// Called by ExecutionService when activity progress changes
async triggerByProgress(
  planningActivityId: number,
  epsNodeId: number,
  newProgressPct: number,
  projectId: number,
): Promise<void> {
  // 1. Find templates with triggerType='PROGRESS_PCT' AND triggerActivityId=planningActivityId
  // 2. Check if newProgressPct >= template.triggerProgressPct
  // 3. If yes and achievement not yet triggered → trigger
}

// Called by SnagReleaseService when a round is approved/released
async triggerBySnagRelease(
  snagListId: number,
  roundNumber: number,  // 1 | 2 | 3
  epsNodeId: number,
  qualityUnitId: number | null,
  projectId: number,
): Promise<void> {
  // 1. Find templates with triggerType='SNAG_ROUND_RELEASED' AND triggerSnagRound=roundNumber
  // 2. Trigger matching achievements for this unit
}
```

#### `milestone.service.ts` — `getUnitMilestoneReport`
1. Fetch all active templates for project (ordered by sequence)
2. Fetch all achievements for this epsNodeId
3. Fetch flatSaleInfo for this unit
4. Left-join: for each template, find matching achievement (or create virtual "not_triggered")
5. Compute totals: totalAmountDue, totalAmountCollected, collectionPct
6. Return `UnitMilestoneReport`

#### `milestone-report.service.ts` — `getProjectSummary`
1. Aggregate all achievements grouped by template, compute triggered/collected counts
2. Aggregate by block for block summary
3. Sum all flat sale values for totalProjectValue
4. Return `ProjectMilestoneSummary`

---

## 4. Flutter App — Navigation & UX Design

### 4.1 Navigation Tree

```
Project Dashboard
└── Planning Module Hub  [OR]  Module Hub (standalone tile)
    └── [NEW] "Customer Milestones" tile (icon: emoji_events, color: #D97706 amber-gold)
        └── MilestoneProjectSummaryPage
            ├── [Tab 1] Overview (project stats + block cards)
            ├── [Tab 2] Pending Invoices (triggered, not yet invoiced)
            └── [Tab 3] Pending Collection (invoiced, not yet collected)
                └── MilestoneBlockPage (per-block unit list)
                    └── UnitMilestonePage (all milestones for one flat)
                        └── MilestoneDetailSheet (bottom sheet: invoice, collection)
```

### 4.2 Screen Designs

#### Screen 1: `MilestoneProjectSummaryPage`
- **Header card** (gold gradient):
  - Project name
  - Total Project Value: ₹ XXX Cr
  - Amount Due (triggered): ₹ XX Cr  /  Amount Collected: ₹ XX Cr
  - **Collection Progress bar**: `totalCollected / totalProjectValue × 100%`
  - Sub-line: "X% collected · ₹ XX Cr balance"
- **3-tab layout**:

**Tab 1 — Overview**
- Milestone pipeline horizontal scroll:
  ```
  [M1: Foundation 10%] → [M2: Slab5 10%] → ... → [M10: Possession 35%]
  Each pill: name (truncated) + % + achieved count / total units
  ```
- Block cards grid: Each block shows
  - Block name + unit count
  - Progress bar: collected %
  - 3 count badges: Triggered (amber) / Invoiced (blue) / Collected (green)
  - Tap → `MilestoneBlockPage`

**Tab 2 — Pending Invoices**
- List of achievements with `status='triggered'` grouped by milestone name
- Each card: Flat number + milestone name + amount due + triggered date + days elapsed (age badge turns red if > 7 days)
- Bulk action: [Raise Invoices] button for collection team

**Tab 3 — Pending Collection**
- List of achievements with `status='invoice_raised'` grouped by milestone name
- Each card: Flat number + invoice number + invoice date + amount + days pending
- Tap → record collection

#### Screen 2: `MilestoneBlockPage`
- **AppBar**: Block name + "X units"
- **Filter chips**: All / Triggered / Invoice Raised / Collected / Partial
- **Unit list** (NOT grid — needs more info per unit):
  - Each tile `_UnitMilestoneTile`:
    - Flat number (large, bold)
    - Floor label (smaller)
    - **Milestone progress strip**: mini horizontal bar showing how many milestones achieved (green) vs triggered (amber) vs pending (grey)
    - Collection amount: "₹ X.XX L collected of ₹ X.XX L" (if flat sale value is set)
    - Next milestone badge (upcoming): amber pill with milestone name
    - Tap → `UnitMilestonePage`

#### Screen 3: `UnitMilestonePage` ← KEY SCREEN
- **AppBar**: Flat number + floor + block path
- **Flat info card** (collapsible):
  - Customer Name, Agreement Value, Agreement Date, Loan Bank
  - Edit button (for CRM/Collection role)
- **Collection summary row**:
  - "₹ XX L / ₹ XX L" (collected / total)
  - Big progress bar
  - "XX% collected"
- **Milestone list** (vertical stepper-style, ordered by sequence):
  ```
  Each milestone row:
  ┌──────────────────────────────────────────────────┐
  │ ● [status icon]  M3 — 5th Slab Complete          │
  │   Trigger: QC Approved · Triggered: 15 Jan 2026  │
  │   Collection %: 10%  · Amount: ₹ 8.5 L           │
  │   [Invoice Raised] [Collected ✓]                 │
  │   Invoice: INV-2026-0031 · Received: ₹ 8.5 L     │
  └──────────────────────────────────────────────────┘
  ```
  - Status icons: ⚫ not_triggered | 🟡 triggered | 🔵 invoice_raised | 🟢 collected | 🔷 partial | 🟣 waived
  - Long-press or tap → `MilestoneDetailSheet`
- **FAB**: Only for manual-trigger milestones → [+ Mark Triggered]

#### Screen 4: `MilestoneDetailSheet` (Modal Bottom Sheet)
- **Header**: Milestone name + status badge
- **Info section**: Trigger type | Linked activity | Trigger date | Trigger reference
- **Financial section**:
  - Flat sale value (editable if not set)
  - Collection % (from template)
  - Calculated amount due
- **Timeline** (vertical): Not Triggered → Triggered → Invoice Raised → Collected
- **Action buttons** (role-based):
  - `triggered` + CRM role: [Raise Invoice] → dialog asking invoice number, date, amount
  - `invoice_raised` + Collection role: [Record Collection] → payment form
  - `any` + Manager role: [Waive Milestone] → with mandatory reason
  - Manual trigger milestones: [Mark as Triggered] → confirmation with reason
- **Collection Tranches** (if partiallyCollected): list of partial payments

#### Screen 5: `MilestoneConfigPage` (Admin — Web primarily, mobile read-only)
- List of milestone templates for project
- Each template row: sequence drag handle + name + trigger type + linked activity + %
- [+ Add Milestone] → drawer form
- Reorder by drag
- Note: configured on web admin; mobile shows read-only

### 4.3 Colour System for Milestone Module

```dart
class MilestoneColors {
  static const gold         = Color(0xFFD97706);  // module accent — amber/gold
  static const goldLight    = Color(0xFFFEF3C7);
  static const triggered    = Color(0xFFD97706);  // amber
  static const invoiced     = Color(0xFF2563EB);  // blue
  static const collected    = Color(0xFF059669);  // green
  static const partial      = Color(0xFF0D9488);  // teal
  static const waived       = Color(0xFF7C3AED);  // purple
  static const notTriggered = Color(0xFF9CA3AF);  // grey
}
```

---

## 5. Flutter BLoC Architecture

### 5.1 BLoCs to Create

#### `MilestoneProjectBloc`
- **Events**:
  - `LoadMilestoneProject(projectId)`
  - `RefreshMilestoneProject(projectId)`
  - `LoadPendingInvoices(projectId)`
  - `LoadPendingCollection(projectId)`
- **States**: `MilestoneProjectLoading`, `MilestoneProjectLoaded(summary, blocks)`, `PendingInvoicesLoaded`, `PendingCollectionLoaded`, `MilestoneProjectError`

#### `UnitMilestoneBloc`
- **Events**:
  - `LoadUnitMilestone({projectId, epsNodeId})`
  - `ManualTriggerMilestone({achievementId, reason})`
  - `RaiseInvoice({achievementId, invoiceNumber, invoiceDate, amount})`
  - `RecordCollection({achievementId, amount, receivedDate, paymentMode, refNo})`
  - `WaiveMilestone({achievementId, reason})`
  - `UpdateFlatSaleValue({epsNodeId, saleValue})`
- **States**: `UnitMilestoneLoading`, `UnitMilestoneLoaded(report)`, `MilestoneActionInProgress`, `MilestoneActionSuccess`, `UnitMilestoneError`

#### `MilestoneConfigBloc` (for template management — web)
- **Events**: `LoadTemplates(projectId)`, `CreateTemplate(dto)`, `UpdateTemplate(id, dto)`, `DeleteTemplate(id)`, `ReorderTemplates(newOrder)`
- **States**: `TemplatesLoaded(templates)`, `TemplateError`

### 5.2 Service Registration in `main.dart`
```dart
sl.registerFactory(() => MilestoneProjectBloc(apiClient: sl()));
sl.registerFactory(() => UnitMilestoneBloc(apiClient: sl(), db: sl()));
sl.registerFactory(() => MilestoneConfigBloc(apiClient: sl()));
```

---

## 6. Permission System

### 6.1 New Permission Strings

| Permission String | Who Has It | Description |
|---|---|---|
| `MILESTONE.READ` | All roles | View milestones and achievement status |
| `MILESTONE.TEMPLATE.CREATE` | Project Manager, Admin | Create/edit milestone templates |
| `MILESTONE.TEMPLATE.DELETE` | Admin | Delete milestone templates |
| `MILESTONE.FLATINFO.EDIT` | CRM, Collection team | Update flat sale values |
| `MILESTONE.FLATINFO.IMPORT` | Admin | Bulk import flat sale info |
| `MILESTONE.TRIGGER.MANUAL` | QC Manager, PM | Manually trigger a milestone |
| `MILESTONE.INVOICE.RAISE` | CRM, Collection team | Mark invoice raised |
| `MILESTONE.COLLECT` | Collection team | Record collection payment |
| `MILESTONE.WAIVE` | Project Director | Waive a milestone |

### 6.2 `PermissionService` additions
```dart
// ── Customer Milestones ───────────────────────────────────────────────────
bool get canReadMilestone          => can('MILESTONE.READ');
bool get canCreateMilestoneTemplate => can('MILESTONE.TEMPLATE.CREATE');
bool get canEditFlatInfo           => can('MILESTONE.FLATINFO.EDIT');
bool get canManualTriggerMilestone => can('MILESTONE.TRIGGER.MANUAL');
bool get canRaiseInvoice           => can('MILESTONE.INVOICE.RAISE');
bool get canRecordCollection       => can('MILESTONE.COLLECT');
bool get canWaiveMilestone         => can('MILESTONE.WAIVE');
bool get hasAnyMilestoneAccess     => canReadMilestone || canRaiseInvoice || canRecordCollection;
```

---

## 7. Module Hub Integration

### 7.1 `project_dashboard_page.dart` — add tile
```dart
if (ps.hasAnyMilestoneAccess)
  _ModuleDef(
    icon: Icons.emoji_events_rounded,
    label: 'Customer\nMilestones',
    color: const Color(0xFFD97706),   // amber-gold
    onTap: () => _goCustomerMilestones(context),
  ),
```

### 7.2 In Planning Page context
- Add as a tab or card inside the existing `PlanningPage`
- Or as a separate entry in the Planning section of the module list

---

## 8. API Endpoints to Add in `api_endpoints.dart`

```dart
// ── Milestone Template Endpoints ──────────────────────────────────────────
static String milestoneTemplates(int projectId)      => '/milestone/project/$projectId/templates';
static String milestoneTemplate(int id)              => '/milestone/templates/$id';
static String reorderMilestones(int projectId)       => '/milestone/project/$projectId/templates/reorder';

// ── Flat Sale Info Endpoints ──────────────────────────────────────────────
static String flatSaleInfo(int projectId)            => '/milestone/project/$projectId/flat-info';
static String flatSaleInfoItem(int id)               => '/milestone/flat-info/$id';
static String importFlatSaleInfo(int projectId)      => '/milestone/project/$projectId/flat-info/import';

// ── Achievement Endpoints ─────────────────────────────────────────────────
static String milestoneAchievements(int projectId)   => '/milestone/project/$projectId/achievements';
static String unitMilestoneReport(int epsNodeId)     => '/milestone/unit/$epsNodeId';
static String triggerMilestone(int id)               => '/milestone/achievements/$id/trigger';
static String raiseInvoice(int id)                   => '/milestone/achievements/$id/raise-invoice';
static String recordCollection(int id)               => '/milestone/achievements/$id/collect';
static String waiveMilestone(int id)                 => '/milestone/achievements/$id/waive';
static String collectionTranches(int id)             => '/milestone/achievements/$id/tranches';

// ── Dashboard / Report Endpoints ─────────────────────────────────────────
static String milestoneProjectSummary(int projectId) => '/milestone/project/$projectId/summary';
static String milestoneBlockSummary(int projectId)   => '/milestone/project/$projectId/block-summary';
static String milestonePendingInvoices(int projectId) => '/milestone/project/$projectId/pending-invoices';
static String milestonePendingCollection(int projectId) => '/milestone/project/$projectId/pending-collection';
```

---

## 9. Auto-Trigger Integration Points (Backend Hooks)

### 9.1 In `QualityInspectionService` — after final approval

```typescript
// Inside approveInspection() / advanceWorkflow() when status → APPROVED:
await this.milestoneTriggerService.triggerByQualityApproval(
  inspection.activityId,
  inspection.epsNodeId,
  inspection.qualityUnitId,
  inspection.projectId,
);
```

### 9.2 In `ExecutionService` / `ExecutionBreakdownService` — after progress update

```typescript
// Inside saveMeasurements() after computing new activityProgress:
const newPct = computedActivityProgress;
await this.milestoneTriggerService.triggerByProgress(
  activityId,
  epsNodeId,
  newPct,
  projectId,
);
```

### 9.3 In `SnagReleaseService` — after round approval (future, after Snag module)

```typescript
// Inside advanceApproval() when round status → 'approved':
await this.milestoneTriggerService.triggerBySnagRelease(
  snagList.id,
  round.roundNumber,
  snagList.epsNodeId,
  snagList.qualityUnitId,
  snagList.projectId,
);
```

---

## 10. React Web Implementation

### 10.1 New Pages
```
frontend/src/pages/milestone/MilestoneDashboardPage.tsx     → project summary + tabs
frontend/src/pages/milestone/MilestoneSetupPage.tsx          → template config (admin)
frontend/src/pages/milestone/UnitMilestonePage.tsx           → per-unit detail
```

### 10.2 Key Web Components
- `MilestoneTemplateTable` — sortable/draggable template list with inline editing
- `MilestoneProgressBar` — coloured bar: grey/amber/blue/green segments per milestone status
- `FlatInfoImportModal` — CSV import dialog with column mapping
- `InvoiceRaiseModal` — form: invoice number, date, amount, remarks
- `CollectionRecordModal` — form: amount, date, payment mode, ref
- `MilestoneStatusBadge` — consistent status chip (reused across list/detail)

### 10.3 New Service
```typescript
// frontend/src/services/milestone.service.ts
getProjectSummary(projectId)
getTemplates(projectId)
createTemplate(projectId, dto)
updateTemplate(id, dto)
deleteTemplate(id)
reorderTemplates(projectId, orderedIds)
getAchievements(projectId, filters)
getUnitReport(epsNodeId)
raiseInvoice(achievementId, dto)
recordCollection(achievementId, dto)
manualTrigger(achievementId, dto)
waive(achievementId, dto)
getFlatSaleInfo(projectId)
importFlatInfo(projectId, file)
```

---

## 11. Offline Strategy

### What to Download (BackgroundDownloadService additions)
- **P3 (on WiFi)**: Milestone templates for project — lightweight, rarely changes
- **P4 (on WiFi)**: Achievement statuses for all accessible units

### What is Always Online-Only
- Raise invoice / Record collection — financial transactions, never offline
- Flat sale info import

---

## 12. Database Migration

```typescript
// backend/src/migrations/CreateMilestoneTables.ts
// Creates:
//   customer_milestone_template
//   customer_milestone_achievement
//   flat_sale_info
//   milestone_collection_tranche
// Adds permission strings:
//   MILESTONE.READ, MILESTONE.TEMPLATE.CREATE, MILESTONE.TEMPLATE.DELETE,
//   MILESTONE.FLATINFO.EDIT, MILESTONE.FLATINFO.IMPORT,
//   MILESTONE.TRIGGER.MANUAL, MILESTONE.INVOICE.RAISE,
//   MILESTONE.COLLECT, MILESTONE.WAIVE
```

---

## 13. File List to Create / Modify

### Backend (New Files)
```
backend/src/milestone/milestone.module.ts
backend/src/milestone/milestone.controller.ts
backend/src/milestone/milestone.service.ts
backend/src/milestone/milestone-trigger.service.ts
backend/src/milestone/milestone-report.service.ts
backend/src/milestone/dto/create-milestone-template.dto.ts
backend/src/milestone/dto/update-milestone-template.dto.ts
backend/src/milestone/dto/raise-invoice.dto.ts
backend/src/milestone/dto/record-collection.dto.ts
backend/src/milestone/dto/manual-trigger.dto.ts
backend/src/milestone/dto/import-flat-sale-info.dto.ts
backend/src/milestone/entities/customer-milestone-template.entity.ts
backend/src/milestone/entities/customer-milestone-achievement.entity.ts
backend/src/milestone/entities/flat-sale-info.entity.ts
backend/src/milestone/entities/milestone-collection-tranche.entity.ts
backend/src/migrations/CreateMilestoneTables.ts
```

### Backend (Modified Files)
```
backend/src/app.module.ts                              → import MilestoneModule
backend/src/quality/quality-inspection.service.ts      → add triggerByQualityApproval hook
backend/src/execution/execution.service.ts             → add triggerByProgress hook
```

### Flutter (New Files)
```
flutter/lib/features/milestone/data/models/milestone_models.dart
flutter/lib/features/milestone/presentation/bloc/milestone_project_bloc.dart
flutter/lib/features/milestone/presentation/bloc/unit_milestone_bloc.dart
flutter/lib/features/milestone/presentation/pages/milestone_project_summary_page.dart
flutter/lib/features/milestone/presentation/pages/milestone_block_page.dart
flutter/lib/features/milestone/presentation/pages/unit_milestone_page.dart
flutter/lib/features/milestone/presentation/widgets/milestone_detail_sheet.dart
flutter/lib/features/milestone/presentation/widgets/milestone_row_tile.dart
flutter/lib/features/milestone/presentation/widgets/unit_milestone_tile.dart
flutter/lib/features/milestone/presentation/widgets/collection_progress_bar.dart
flutter/lib/features/milestone/presentation/widgets/invoice_raise_dialog.dart
flutter/lib/features/milestone/presentation/widgets/record_collection_dialog.dart
```

### Flutter (Modified Files)
```
flutter/lib/features/projects/presentation/pages/project_dashboard_page.dart  → add tile
flutter/lib/features/projects/presentation/pages/module_selection_page.dart   → add row
flutter/lib/core/auth/permission_service.dart                                  → add permissions
flutter/lib/core/api/api_endpoints.dart                                        → add endpoints
flutter/lib/main.dart                                                           → register BLoCs
flutter/lib/core/database/app_database.dart                                    → add cache tables
flutter/lib/core/sync/background_download_service.dart                         → add download
```

### React Web (New Files)
```
frontend/src/pages/milestone/MilestoneDashboardPage.tsx
frontend/src/pages/milestone/MilestoneSetupPage.tsx
frontend/src/pages/milestone/UnitMilestonePage.tsx
frontend/src/services/milestone.service.ts
```

---

## 14. Estimated Effort

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Backend entities + migrations + CRUD endpoints | 2 days |
| Phase 2 | Auto-trigger service + integration hooks | 2 days |
| Phase 3 | Report/aggregate service (summary, pending) | 1 day |
| Phase 4 | Flutter models + BLoCs + API client | 2 days |
| Phase 5 | Flutter screens (project summary → block → unit) | 2 days |
| Phase 6 | Flutter milestone detail sheet + dialogs | 2 days |
| Phase 7 | Offline cache + background download | 1 day |
| Phase 8 | React Web pages (dashboard + setup + unit) | 3 days |
| **Total** | | **~15 days** |

---

## 15. Dependencies / Prerequisites

1. **EPS tree and unit structure** — ✅ already exists
2. **Quality approval hooks** — must add trigger call in `quality-inspection.service.ts` — easy hook
3. **Planning activity IDs** — must know which activity IDs correspond to milestone-worthy stages
4. **Flat sale values** — source: CRM/ERP system. Plan: manual entry or CSV import initially, API integration later
5. **Snag module** (for snag-round-released trigger) — ✅ planned (SNAG_DESNAG_MODULE_PLAN.md)
6. **Push notification service** — ✅ already exists (for CRM team notification when milestone triggers)
7. **Role assignment** — "Collection" and "CRM" roles need to be created in the permission system if not existing

---

## 16. Relationship with Snagging Module

The two modules are closely linked:
```
Snag 1 Released → triggers → Milestone "Snag 1 Cleared" (e.g. 5% collection)
Snag 3 Released → triggers → Milestone "Possession / Handover" (e.g. 35% collection)
```
Recommended implementation order: **Milestone module first** (standalone), **Snag module second** (adds snag-based trigger support).
