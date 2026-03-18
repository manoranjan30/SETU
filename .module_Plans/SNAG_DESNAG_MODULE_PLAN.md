# Snagging & De-snagging Module — Detailed Implementation Plan (v2)

**Date:** 2026-03-18 (Updated)
**Module:** Quality → Snagging & De-snagging
**Scope:** Full-stack (NestJS backend + Flutter mobile + React web)
**Status:** PLAN — Do not implement until approved

---

## 1. Correct Understanding of the Process

### Definitions
| Term | Meaning |
|------|---------|
| **Snag** | The act of **raising / tagging defect points** in a unit — done by the QC Inspector, room by room |
| **De-snag** | The act of **rectifying + closing those defect points** — done by contractor (rectify) + QC Inspector (close/verify) |

These are two **distinct sequential phases** within each round. De-snag phase is **locked** until the Snag phase is fully submitted/closed.

---

## 2. Full Three-Round Workflow

```
┌────────────────────────────────────────────────────────────────────┐
│  ROUND 1                                                           │
│                                                                    │
│  ┌─ SNAG PHASE (Inspector) ─────────────────────────────────────┐ │
│  │  Inspector opens unit → sees room grid                       │ │
│  │  Taps each room → adds snag points (photos mandatory)        │ │
│  │  When all rooms inspected → presses "Submit Snag 1"          │ │
│  │  Snag Phase status → SUBMITTED                               │ │
│  └──────────────────────────────────────────────────────────────┘ │
│            ↓ (De-snag unlocks automatically)                       │
│  ┌─ DE-SNAG PHASE (Contractor + QC) ───────────────────────────┐ │
│  │  Contractor sees all open snag points grouped by room       │ │
│  │  For each item: marks "Rectified" + uploads after-photos    │ │
│  │  QC Inspector: verifies and marks each item "Closed"        │ │
│  │  When ALL items closed → "Submit for Release Approval"      │ │
│  │  Multi-level approval: QC Eng → QC Manager                  │ │
│  │  De-snag Phase status → RELEASED                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
         ↓ Round 2 unlocks only after De-snag 1 is RELEASED

┌────────────────────────────────────────────────────────────────────┐
│  ROUND 2  (same pattern as Round 1)                               │
│  Inspector walks again → raises new snag points per room         │
│  Submit Snag 2 → De-snag 2 unlocks → rectify → close → release  │
└────────────────────────────────────────────────────────────────────┘
         ↓ Round 3 unlocks only after De-snag 2 is RELEASED

┌────────────────────────────────────────────────────────────────────┐
│  ROUND 3  (Final round)                                           │
│  Inspector raises final snag points per room (if any)            │
│  Submit Snag 3 → De-snag 3 unlocks → rectify → close → release  │
│  De-snag 3 RELEASED → Unit stamped → HANDOVER READY ✓            │
└────────────────────────────────────────────────────────────────────┘
```

### Phase Status Rules
1. **De-snag phase** for Round N is **invisible/locked** until Snag phase of Round N is `submitted`.
2. **Round N+1** only opens after De-snag phase of Round N is `released` (multi-level approval passed).
3. During the Snag phase, the inspector navigates **room by room** inside the unit to tag defects.
4. Each snag point must be linked to a **specific room** (from the existing `quality_rooms` structure).
5. Photos are mandatory when **raising** a snag point (before photos) and when **rectifying** (after photos).
6. An item can be marked **"On Hold"** during De-snag — it carries forward to the next round's Snag phase.
7. Round 3 is the maximum — there is no Round 4.

---

## 3. Room Structure Integration

The quality module already stores unit/room structure:
- `quality_units` — one row per flat/unit (linked to `quality_floor_structures`)
- `quality_rooms` — rooms inside a unit: "Master Bedroom", "Bathroom 1", "Kitchen", "Living Room", etc.
- Fetched via: `GET /quality/:projectId/structure/floor/:floorId`

**Snag points are always tagged to a specific room** from this existing structure.
The room grid is the primary navigation screen inside a unit during the Snag phase.

---

## 4. Data Model Design

### 4.1 Backend Entities (TypeORM / PostgreSQL)

#### `snag_list` table
One record per unit per project. This is the master container.
```
id                    SERIAL PRIMARY KEY
project_id            INTEGER FK → eps_nodes (project root)
eps_node_id           INTEGER FK → eps_nodes (unit EPS node)
quality_unit_id       INTEGER FK → quality_units  (links to QC unit structure)
unit_label            VARCHAR(100)          -- denormalised flat label e.g. "A1-F3-103"
current_round         INTEGER DEFAULT 1     -- 1 | 2 | 3 — active round
overall_status        ENUM('snagging','desnagging','released','handover_ready') DEFAULT 'snagging'
created_by_id         INTEGER FK → users
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP
```
- **Unique constraint**: `(project_id, quality_unit_id)`
- `overall_status` transitions:
  - `snagging` = inspector currently raising snag points
  - `desnagging` = snag phase submitted, contractor/QC working on rectification
  - `released` = de-snag approved; next round is open (or unit is handover_ready after round 3)
  - `handover_ready` = all 3 rounds complete and released

#### `snag_round` table
Each round (1, 2, 3) has **two separate phase statuses**.
```
id                        SERIAL PRIMARY KEY
snag_list_id              INTEGER FK → snag_list
round_number              INTEGER              -- 1 | 2 | 3

-- Phase 1: Snag (Inspector raises points)
snag_phase_status         ENUM('open','submitted') DEFAULT 'open'
snag_submitted_at         TIMESTAMP nullable
snag_submitted_by_id      INTEGER FK → users nullable
snag_submitted_comments   TEXT nullable

-- Phase 2: De-snag (Contractor rectifies, QC closes, then multi-level release)
desnag_phase_status       ENUM('locked','open','approval_pending','approved','rejected')
                          DEFAULT 'locked'
desnag_released_at        TIMESTAMP nullable
desnag_release_comments   TEXT nullable

initiated_by_id           INTEGER FK → users
initiated_at              TIMESTAMP
```
- `desnag_phase_status = 'locked'` until `snag_phase_status = 'submitted'`
- When `snag_phase_status` → `submitted`, backend auto-sets `desnag_phase_status` → `open`

#### `snag_item` table
Individual defect point raised during the Snag phase.
```
id                    SERIAL PRIMARY KEY
snag_list_id          INTEGER FK → snag_list
snag_round_id         INTEGER FK → snag_round
quality_room_id       INTEGER FK → quality_rooms    -- ROOM where defect is located
room_label            VARCHAR(100)                  -- denormalised e.g. "Master Bedroom"
title                 VARCHAR(255)                  -- short defect description
description           TEXT nullable                 -- detailed notes
category              ENUM('civil','electrical','plumbing','painting',
                           'carpentry','tiling','waterproofing','finishing',
                           'doors_windows','false_ceiling','sanitary','other')
severity              ENUM('critical','major','minor') DEFAULT 'minor'
status                ENUM('open','rectified','closed','on_hold') DEFAULT 'open'

-- Who raised it
raised_by_id          INTEGER FK → users
raised_at             TIMESTAMP DEFAULT NOW()

-- Rectification info (filled by contractor)
rectified_at          TIMESTAMP nullable
rectified_by_id       INTEGER FK → users nullable
rectification_remarks TEXT nullable

-- Close/verify info (filled by QC Inspector)
closed_at             TIMESTAMP nullable
closed_by_id          INTEGER FK → users nullable
close_remarks         TEXT nullable

-- On Hold
on_hold_reason        TEXT nullable
on_hold_by_id         INTEGER FK → users nullable
carried_from_round    INTEGER nullable     -- if this item was carried from a previous round

item_sequence         INTEGER              -- order within room (for display)
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP
```

#### `snag_photo` table
Photos for a snag item. Both before (raised by inspector) and after (uploaded by contractor).
```
id                    SERIAL PRIMARY KEY
snag_item_id          INTEGER FK → snag_item
photo_type            ENUM('before','after','reference')
                      -- 'before' = raised by inspector during snag phase
                      -- 'after'  = uploaded by contractor during de-snag phase
file_url              VARCHAR(500)
file_path             VARCHAR(500)
uploaded_by_id        INTEGER FK → users
uploaded_at           TIMESTAMP DEFAULT NOW()
caption               VARCHAR(255) nullable
```

#### `snag_release_approval` table (mirrors InspectionWorkflowRun)
Created when de-snag phase moves to `approval_pending`.
```
id                    SERIAL PRIMARY KEY
snag_round_id         INTEGER FK → snag_round     UNIQUE
workflow_config_id    INTEGER nullable FK → approval_workflow_configs
status                ENUM('pending','approved','rejected') DEFAULT 'pending'
current_level         INTEGER DEFAULT 1
total_levels          INTEGER
created_at            TIMESTAMP DEFAULT NOW()
```

#### `snag_release_approval_step` table (mirrors InspectionWorkflowStep)
```
id                    SERIAL PRIMARY KEY
release_approval_id   INTEGER FK → snag_release_approval
level                 INTEGER
approver_role         VARCHAR(100)
approver_user_id      INTEGER FK → users nullable
status                ENUM('pending','approved','rejected','delegated') DEFAULT 'pending'
comments              TEXT nullable
acted_at              TIMESTAMP nullable
signature_data        TEXT nullable
```

### 4.2 Room Snag Count View (Backend Computed)
For the room grid UI, the backend should return per-room snag counts in a single query:
```
Room → { roomId, roomLabel, openCount, rectifiedCount, closedCount, onHoldCount, criticalCount }
```
This is computed at query time (no separate table needed).

### 4.3 Flutter Dart Models

#### `snag_models.dart`
```dart
// ── Enums ─────────────────────────────────────────────────────────────────

enum SnagItemCategory {
  civil, electrical, plumbing, painting,
  carpentry, tiling, waterproofing, finishing,
  doorsWindows, falseCeiling, sanitary, other;

  String get label { ... }   // "Civil", "Electrical", etc.
  IconData get icon { ... }  // per-category icon
}

enum SnagSeverity {
  critical, major, minor;
  Color get color { critical: red, major: orange, minor: amber }
  String get label { "Critical", "Major", "Minor" }
  IconData get icon { ... }
}

enum SnagItemStatus {
  open, rectified, closed, onHold;
  Color get color { open: red, rectified: blue, closed: green, onHold: grey }
  Color get bgColor { ... 10% opacity of color }
  String get label { ... }
  IconData get icon { ... }
}

enum SnagPhaseStatus {
  open,       // inspector still adding items
  submitted;  // inspector has submitted, de-snag phase unlocked
  String get label { "In Progress", "Submitted" }
  Color get color { ... }
}

enum DesnagPhaseStatus {
  locked,            // waiting for snag phase to be submitted
  open,              // contractor rectifying
  approvalPending,   // all items closed, awaiting multi-level approval
  approved,          // released — next round can open
  rejected;          // approval rejected — items need attention

  String get label { ... }
  Color get color { locked: grey, open: blue, approvalPending: amber, approved: green, rejected: red }
}

enum SnagListStatus {
  snagging,       // current round: snag phase open
  desnagging,     // current round: de-snag phase open
  released,       // de-snag approved (intermediate — next round starting)
  handoverReady;  // all 3 rounds done and released

  Color get color { snagging: blue, desnagging: orange, released: teal, handoverReady: green }
  String get label { "Snagging", "De-snagging", "Released", "Handover Ready" }
}

// ── Room Snag Summary (for room grid on unit page) ────────────────────────

class RoomSnagSummary extends Equatable {
  final int qualityRoomId;
  final String roomLabel;      // "Master Bedroom", "Kitchen", etc.
  final int openCount;
  final int rectifiedCount;
  final int closedCount;
  final int onHoldCount;
  final int criticalCount;
  final int totalItems;

  bool get hasItems => totalItems > 0;
  bool get allClosed => totalItems > 0 && openCount == 0 && rectifiedCount == 0;
  // Tile colour logic:
  Color get tileColor {
    if (totalItems == 0) return Colors.grey.shade100;      // no snags raised yet
    if (criticalCount > 0 && openCount > 0) return Colors.red.shade50;    // critical open
    if (openCount > 0) return Colors.orange.shade50;       // has open items
    if (rectifiedCount > 0) return Colors.blue.shade50;    // pending QC close
    return Colors.green.shade50;                           // all closed
  }
}

// ── Snag Item ─────────────────────────────────────────────────────────────

class SnagPhoto extends Equatable {
  final int id;
  final String photoType;    // 'before' | 'after' | 'reference'
  final String fileUrl;
  final String? caption;
  final String uploadedAt;
}

class SnagItem extends Equatable {
  final int id;
  final int snagListId;
  final int snagRoundId;
  final int qualityRoomId;
  final String roomLabel;
  final String title;
  final String? description;
  final SnagItemCategory category;
  final SnagSeverity severity;
  final SnagItemStatus status;
  final String? rectificationRemarks;
  final String? closeRemarks;
  final String? onHoldReason;
  final int? carriedFromRound;
  final List<SnagPhoto> photos;
  final String raisedAt;
  final String? rectifiedAt;
  final String? closedAt;

  List<SnagPhoto> get beforePhotos => photos.where((p) => p.photoType == 'before').toList();
  List<SnagPhoto> get afterPhotos  => photos.where((p) => p.photoType == 'after').toList();
}

// ── Snag Round ────────────────────────────────────────────────────────────

class SnagRound extends Equatable {
  final int id;
  final int snagListId;
  final int roundNumber;               // 1 | 2 | 3
  final SnagPhaseStatus snagPhaseStatus;
  final String? snagSubmittedAt;
  final DesnagPhaseStatus desnagPhaseStatus;
  final String? desnagReleasedAt;
  final String initiatedAt;
  // Per-room summaries for the room grid
  final List<RoomSnagSummary> roomSummaries;
  // Aggregate counts
  final int totalItems;
  final int openCount;
  final int rectifiedCount;
  final int closedCount;
  final int onHoldCount;
  final int criticalCount;

  bool get snagPhaseComplete => snagPhaseStatus == SnagPhaseStatus.submitted;
  bool get desnagVisible     => desnagPhaseStatus != DesnagPhaseStatus.locked;
  bool get allItemsClosed    => totalItems > 0 && openCount == 0 && rectifiedCount == 0 && onHoldCount == 0;
}

// ── Snag List (full unit record) ──────────────────────────────────────────

class SnagList extends Equatable {
  final int id;
  final int projectId;
  final int epsNodeId;
  final int qualityUnitId;
  final String unitLabel;
  final int currentRound;              // 1 | 2 | 3
  final SnagListStatus overallStatus;
  final List<SnagRound> rounds;        // up to 3 rounds

  SnagRound? get activeRound =>
      rounds.where((r) => r.roundNumber == currentRound).firstOrNull;
}

// ── Unit Summary (for floor unit grid navigation) ─────────────────────────

class UnitSnagSummary extends Equatable {
  final int epsNodeId;
  final int qualityUnitId;
  final String unitLabel;
  final int currentRound;
  final SnagListStatus status;
  final int openCount;
  final int criticalCount;
  final bool hasSnagList;   // false = inspector has not yet initiated snagging for this unit
  final bool myActionPending; // true if current user has an action to take (raise/rectify/approve)
}

// ── Floor Summary (for floor grid navigation) ─────────────────────────────

class FloorSnagSummary extends Equatable {
  final int floorId;
  final String floorLabel;
  final int totalUnits;
  final int unitsHandoverReady;
  final int unitsSnagging;
  final int unitsDesnagging;
  final int unitsNotStarted;
  final int criticalOpenCount;  // total critical open items in this floor
}
```

### 4.4 Drift DB Cache Tables
```dart
class CachedSnagLists extends Table {
  IntColumn get id => integer()();
  IntColumn get projectId => integer()();
  IntColumn get qualityUnitId => integer()();
  TextColumn get unitLabel => text()();
  IntColumn get currentRound => integer()();
  TextColumn get overallStatus => text()();
  TextColumn get jsonData => text()();   // full SnagList JSON blob
  DateTimeColumn get cachedAt => dateTime()();
  @override Set<Column> get primaryKey => {id};
}

class CachedSnagItems extends Table {
  IntColumn get id => integer()();
  IntColumn get snagListId => integer()();
  IntColumn get snagRoundId => integer()();
  IntColumn get qualityRoomId => integer()();
  TextColumn get status => text()();
  TextColumn get jsonData => text()();
  DateTimeColumn get cachedAt => dateTime()();
  @override Set<Column> get primaryKey => {id};
}
```

---

## 5. Backend Implementation

### 5.1 File Structure
```
backend/src/snag/
├── snag.module.ts
├── snag.controller.ts
├── snag.service.ts                   // CRUD + phase transitions
├── snag-release.service.ts           // multi-level de-snag approval
├── dto/
│   ├── create-snag-list.dto.ts       // { projectId, epsNodeId, qualityUnitId }
│   ├── create-snag-item.dto.ts       // { qualityRoomId, title, description, category, severity }
│   ├── update-snag-item.dto.ts
│   ├── rectify-snag-item.dto.ts      // { rectificationRemarks }  + photo uploads separate
│   ├── close-snag-item.dto.ts        // { closeRemarks }
│   ├── hold-snag-item.dto.ts         // { reason }
│   ├── submit-snag-phase.dto.ts      // { comments? }
│   └── release-approval.dto.ts       // { comments, signature? }
├── entities/
│   ├── snag-list.entity.ts
│   ├── snag-round.entity.ts
│   ├── snag-item.entity.ts
│   ├── snag-photo.entity.ts
│   ├── snag-release-approval.entity.ts
│   └── snag-release-approval-step.entity.ts
└── migrations/
    └── CreateSnagTables.ts
```

### 5.2 REST API Endpoints

```
# ── Snag Lists ───────────────────────────────────────────────────────────
GET    /snag/project/:projectId/summary         → aggregate stats by block
GET    /snag/project/:projectId/floor/:floorId  → per-unit snag summaries for floor
POST   /snag                                    → initiate snag list for a unit
GET    /snag/:snagListId                        → full detail: rounds + room summaries
DELETE /snag/:snagListId                        → admin only

# ── Snag Rounds ───────────────────────────────────────────────────────────
GET    /snag/:snagListId/rounds                 → all rounds with phase status
POST   /snag/:snagListId/round/next             → open next round (2 or 3, after de-snag N released)

# ── Snag Phase Actions (Inspector raises snag points) ─────────────────────
GET    /snag/:snagListId/round/:roundId/rooms   → room grid with per-room snag counts
GET    /snag/:snagListId/round/:roundId/room/:roomId/items  → all items in a room
POST   /snag/:snagListId/round/:roundId/items   → add a snag point to a room
PATCH  /snag/:snagListId/items/:itemId          → update a snag item (inspector, while snag open)
DELETE /snag/:snagListId/items/:itemId          → delete (inspector only, while snag phase open)
POST   /snag/:snagListId/round/:roundId/submit-snag  → close snag phase → unlocks de-snag

# ── De-snag Phase Actions ─────────────────────────────────────────────────
GET    /snag/:snagListId/round/:roundId/desnag-items        → all items, grouped by room
PATCH  /snag/:snagListId/items/:itemId/rectify              → contractor: mark rectified
PATCH  /snag/:snagListId/items/:itemId/close                → QC Inspector: verify + close
PATCH  /snag/:snagListId/items/:itemId/reopen               → QC Inspector: reject rectification
PATCH  /snag/:snagListId/items/:itemId/hold                 → put on hold

# ── Photos ────────────────────────────────────────────────────────────────
POST   /snag/items/:itemId/photos                           → upload before or after photo
DELETE /snag/items/:itemId/photos/:photoId                  → delete photo

# ── Release Approvals (Multi-Level De-snag Release) ───────────────────────
POST   /snag/:snagListId/round/:roundId/submit-desnag       → all items closed → submit for approval
GET    /snag/round/:roundId/approval                        → approval status + steps
POST   /snag/round/:roundId/approval/advance                → approver approves (with signature)
POST   /snag/round/:roundId/approval/reject                 → approver rejects
POST   /snag/round/:roundId/approval/delegate               → delegate to another user

# ── My Pending ────────────────────────────────────────────────────────────
GET    /snag/my-pending?projectId=X                         → rounds where I need to act
  (returns: my approval steps + units where I'm inspector and snag phase open
           + units where I'm contractor and items are open for rectification)
```

### 5.3 Key Service Logic

**`snag.service.ts` — `initiateSnagList`**
1. Check no snag list exists for `qualityUnitId` in this project (unique guard)
2. Create `SnagList` with `currentRound=1`, `overallStatus='snagging'`
3. Create `SnagRound` for Round 1: `snagPhaseStatus='open'`, `desnagPhaseStatus='locked'`
4. Return full snag list with empty room grid

**`snag.service.ts` — `submitSnagPhase(snagListId, roundId)`**
1. Validate round exists and `snagPhaseStatus='open'`
2. Check at least 1 snag item has been raised (cannot submit empty snag)
3. Set `snagPhaseStatus='submitted'`, `snagSubmittedAt=NOW()`
4. Auto-set `desnagPhaseStatus='open'`
5. Update `SnagList.overallStatus='desnagging'`
6. Push notification to contractor/site team

**`snag.service.ts` — `submitDesnagForApproval(snagListId, roundId)`**
1. Validate `desnagPhaseStatus='open'`
2. Check ALL items are `closed` or `on_hold` (no `open` or `rectified` items allowed)
   - If any `rectified` items exist → `BadRequestException("X items awaiting QC closure")`
   - If any `open` items exist → `BadRequestException("X items not yet rectified")`
3. Set `desnagPhaseStatus='approval_pending'`
4. Create `SnagReleaseApproval` + first `SnagReleaseApprovalStep` (Level 1)
5. Push notification to Level 1 approver

**`snag-release.service.ts` — `advanceApproval(roundId, approverUserId, comments, signature)`**
1. Verify caller is the Level N approver
2. Mark current step `status='approved'`, set signature + comments
3. If more levels remain → create Level N+1 step + push notification
4. If final level:
   - Mark `SnagReleaseApproval.status='approved'`
   - Set `SnagRound.desnagPhaseStatus='approved'`, `desnagReleasedAt=NOW()`
   - If `roundNumber == 3`:
     - `SnagList.overallStatus='handover_ready'`
     - Push notification to CRM/Customer Handover team
   - If `roundNumber < 3`:
     - `SnagList.overallStatus='released'` (temporary — next round will set it back)

**`snag.service.ts` — `openNextRound(snagListId)`**
1. Validate current round de-snag is `approved`
2. Validate `currentRound < 3`
3. Get all `on_hold` items from current round → carry them forward
4. Create new `SnagRound` for `currentRound+1`: `snagPhaseStatus='open'`, `desnagPhaseStatus='locked'`
5. Create new snag items for carried-forward `on_hold` items:
   - `status='open'`, `carriedFromRound=previousRound`
6. Update `SnagList.currentRound += 1`, `overallStatus='snagging'`

---

## 6. Flutter App — Navigation & UX

### 6.1 Full Navigation Tree
```
Project Dashboard (Module Hub)
└── "Snagging" tile
    └── SnagProjectSummaryPage
        └── [Block card] → SnagFloorGridPage
            └── [Floor tile] → SnagUnitGridPage   ← navigate to a flat
                └── [Unit tile] → UnitSnagDetailPage
                    ├── [Snag Phase Tab]
                    │   └── SnagRoomGridPage      ← room-by-room snag tagging
                    │       └── [Room tile] → RoomSnagItemsPage
                    │           └── [Item] → SnagItemDetailPage
                    │           └── [+ FAB] → AddSnagItemSheet
                    │   └── [Submit Snag N] → confirmation dialog
                    │
                    └── [De-snag Phase Tab]  (locked until snag submitted)
                        └── Desnag items list (grouped by room)
                            └── [Item] → SnagItemDetailPage
                                ├── [Mark Rectified + upload photos] (contractor)
                                └── [Mark Closed / Reopen] (QC Inspector)
                        └── [Submit for Release Approval] (when all closed)
                            └── SnagReleaseApprovalSheet

SnagPendingApprovalsPage (shortcut from My Action dashboard)
```

### 6.2 Screen Designs

#### Screen 1: `SnagProjectSummaryPage`
- **Header** (purple gradient): Project name + "X Units Total"
- **Stats row** (4 boxes):
  - Not Started (grey)
  - Snagging Active (blue — snag phase open)
  - De-snagging Active (orange — de-snag phase open)
  - Handover Ready (green)
- **Overall progress bar**: `handoverReady / totalUnits × 100%`
- **Block cards list**: name, unit count, mini-progress bar, critical items badge
- **My Action button** (prominent): badge count of units needing my action

---

#### Screen 2: `SnagFloorGridPage`
- **AppBar**: Block name + tower name + "X% Handover Ready"
- **Summary strip**: Total Floors | All Ready | Active | Not Started
- **SliverGrid (3-col)**: Floor tiles colour-coded:
  - 🟢 Green = all units handover_ready
  - 🟡 Amber = mix of statuses
  - 🔵 Blue = all snagging active
  - 🟠 Orange = all desnagging active
  - 🔴 Red = has units with critical open items
  - ⚫ Grey = not started
  - Each tile: floor label + unit count + critical badge (if any)

---

#### Screen 3: `SnagUnitGridPage` ← KEY NAVIGATION SCREEN
- **AppBar**: Floor label + "X units"
- **Filter chips**: All | Snagging | De-snagging | Ready | Not Started | My Action
- **Grid (2-col)**: Unit tiles — `_SnagUnitTile`:
  ```
  ┌──────────────────────┐
  │  103                 │  ← flat number (large, bold)
  │  [S2] [De-snag]      │  ← round badge + phase badge
  │  ● 3 open  ▲ 1 crit  │  ← open count + critical count
  │  [Action needed →]   │  ← if user has pending action
  └──────────────────────┘
  ```
  - Tile background colour by `SnagListStatus`:
    - `snagging` → blue.shade50 (inspector needs to tag rooms)
    - `desnagging` → orange.shade50 (rectification in progress)
    - `released` (transitional) → teal.shade50
    - `handover_ready` → green.shade50
    - not started → grey.shade100 with "+" initiate button
  - "+" button on grey tiles → dialog confirming unit, then calls `InitiateSnagList`

---

#### Screen 4: `UnitSnagDetailPage` ← CENTRAL UNIT SCREEN
- **AppBar**: Flat number + block/floor breadcrumb + overall status badge
- **Round stepper** (horizontal, prominent):
  ```
  [Round 1]     [Round 2]     [Round 3]
  Snag ✓        Snag →        (locked)
  De-snag ✓     De-snag ⏳
  ```
  - Each round shows: Snag phase status + De-snag phase status
  - Locked rounds shown as grey/locked icon
- **Two-tab layout for the active round**:
  - **Tab 1: Snag** (blue tab, inspector-facing)
  - **Tab 2: De-snag** (orange tab, locked with 🔒 icon until snag submitted)

**Snag Tab content:**
- Summary strip: X rooms | X items raised | X critical
- Room grid (from `SnagRoomGridPage` embedded or navigated)
- Bottom action bar:
  - If snag phase open + inspector role: [Submit Snag N] button (enabled when ≥1 item raised)
  - If snag phase submitted: "Snag N submitted — De-snag phase open" banner

**De-snag Tab content:**
- If `desnagPhaseStatus = 'locked'`: Large lock icon + "Submit Snag N first" message
- If open: Items grouped by room, each row shows status badge + action button
- Progress strip: X closed | X rectified (pending QC) | X open | X on hold
- Bottom action bar:
  - If all items closed/on_hold + correct role: [Submit for Release Approval] button
  - If `approval_pending`: Approval level indicator + "Awaiting Level X" banner
  - If `approved` + round < 3: [Start Round N+1 →] button
  - If `approved` + round 3: "✓ Handover Ready" green banner

---

#### Screen 5: `SnagRoomGridPage` ← SNAG PHASE KEY SCREEN
This is where the inspector tags defects, room by room.
- **AppBar**: "Round N — Snag" + flat number
- **Instruction banner** (first visit): "Tap each room to raise snag points"
- **Room grid (2-col)**: `_RoomSnagTile`:
  ```
  ┌──────────────────────────┐
  │  🛏 Master Bedroom        │  ← room icon + name
  │  3 items  ▲1 crit        │  ← snag count + critical badge
  │  ████░░░░ 2/3 closed     │  ← mini progress bar (in de-snag phase)
  └──────────────────────────┘
  ```
  - Room tile colour:
    - No items yet: grey.shade100 (tap to add first snag)
    - Has items + some open/critical: red.shade50
    - Has items + all open (no critical): orange.shade50
    - Has items + all rectified (de-snag in progress): blue.shade50
    - Has items + all closed: green.shade50
  - Tap room → `RoomSnagItemsPage`
- **FAB**: [+ Add Snag Point] — quick shortcut (asks room first)

---

#### Screen 6: `RoomSnagItemsPage`
Items list for one specific room + ability to add new ones.
- **AppBar**: Room name + "Round N" + items count
- **Item list**: `_SnagItemTile` rows:
  - Title (truncated)
  - Category icon + severity badge
  - Status badge
  - Thumbnail of latest photo (before or after)
  - Age in days (grey text, turns red if > 7 days pending)
- **Sections during De-snag** (orange section headers):
  - 🔴 Open (contractor must rectify)
  - 🔵 Rectified (QC must close)
  - ⏸ On Hold
  - ✅ Closed (collapsed, expandable)
- **FAB**: [+ Add Snag Point] (only during snag phase)
- Tap item → `SnagItemDetailPage`

---

#### Screen 7: `SnagItemDetailPage`
Full detail + actions for one snag point.
- **AppBar**: Item title + round badge
- **Status indicator** (top pill): current status with colour
- **Info card**: Room | Category | Severity | Raised by | Date | Carried from Round (if applicable)
- **Before Photos section** (grid): inspector's photos uploaded during snagging
  - [+ Add Photo] button (only during snag phase)
- **Rectification Notes section** (shown if rectified/closed):
  - Remarks text
  - After Photos grid (contractor's evidence)
  - [+ Upload After Photo] (only contractor role, during de-snag phase)
- **QC Verification section** (shown if closed):
  - Close remarks + closed by + date
- **Status History** (collapsible timeline): every status change with timestamp + user
- **Action buttons** (role + phase sensitive):
  - Inspector, during Snag phase: [Edit] [Delete] [Put On Hold with reason]
  - Contractor, during De-snag phase: [Mark Rectified] → requires ≥1 after-photo
  - QC Inspector, during De-snag phase (item is `rectified`): [Mark Closed ✓] [Reopen ✗]
  - QC Inspector, any state: [Put On Hold] (defers to next round)

---

#### Screen 8: `AddSnagItemSheet` (Modal Bottom Sheet)
Quick-add form for a snag point — opened from the room page.
- Room selector (pre-filled if opened from room page)
- Title field (required)
- Description field (optional)
- Category dropdown (12 options)
- Severity selector (Critical / Major / Minor chips)
- Photo upload (required — at least 1 before photo)
- [Save Snag Point] button

---

#### Screen 9: `SnagReleaseApprovalSheet` (Modal Bottom Sheet)
Opened when submitting de-snag for multi-level approval.
- Round summary card: "Round N De-snag | X items all closed"
- On-hold summary (if any): "X items on hold — will carry to Round N+1"
- Approval level indicator: "Level 1 of 2 — QC Engineer"
- Signature pad
- Comments field (required)
- [Submit for Approval] button (for submitter)
- — OR —
- Level N approver view: shows submitter's comments + [Approve] [Reject] buttons

---

#### Screen 10: `SnagPendingApprovalsPage`
Shortcut screen showing everything pending my action.
- **Tabs**: Inspector Tasks | Contractor Tasks | My Approvals
- Each tab shows relevant units/items
- Tap → deep links into the correct page (unit detail or item detail)

### 6.3 Colour System
```dart
class SnagColors {
  static const moduleAccent  = Color(0xFF7C3AED);  // purple — module branding
  static const moduleLight   = Color(0xFFEDE9FE);
  static const snagPhase     = Color(0xFF2563EB);  // blue — inspector snag phase
  static const desnagPhase   = Color(0xFFEA580C);  // orange — contractor de-snag phase
  static const round1        = Color(0xFF3B82F6);  // blue
  static const round2        = Color(0xFF8B5CF6);  // purple
  static const round3        = Color(0xFF059669);  // green
  static const critical      = Color(0xFFDC2626);
  static const major         = Color(0xFFEA580C);
  static const minor         = Color(0xFFD97706);
  static const handoverReady = Color(0xFF059669);  // green
}
```

---

## 7. Flutter BLoC Architecture

### 7.1 BLoCs to Create

#### `SnagDashboardBloc`
- **Events**: `LoadSnagDashboard(projectId)`, `LoadFloorUnits({projectId, floorId})`
- **States**: `SnagDashboardLoading`, `SnagDashboardLoaded(blocks, summary)`, `FloorUnitsLoaded(units)`, `SnagDashboardError`

#### `UnitSnagBloc`
- **Events**:
  - `LoadUnitSnag({projectId, qualityUnitId})`
  - `InitiateSnagList({projectId, epsNodeId, qualityUnitId})`
  - `LoadRoomItems({snagListId, roundId, roomId})`
  - `AddSnagItem(dto)`                           // snag phase: inspector adds point
  - `UpdateSnagItem(itemId, dto)`
  - `DeleteSnagItem(itemId)`
  - `UploadSnagPhoto({itemId, photoType, filePath})`
  - `SubmitSnagPhase({snagListId, roundId})`     // inspector closes snag phase
  - `RectifySnagItem({itemId, remarks})`         // contractor marks rectified
  - `CloseSnagItem({itemId, remarks})`           // QC closes
  - `ReopenSnagItem(itemId)`                     // QC rejects rectification
  - `HoldSnagItem({itemId, reason})`
  - `SubmitDesnagForApproval({snagListId, roundId, comments})`
  - `OpenNextRound(snagListId)`
- **States**: `UnitSnagLoading`, `UnitSnagLoaded(snagList)`, `RoomItemsLoaded(items)`, `SnagActionInProgress`, `SnagActionSuccess(message)`, `UnitSnagError`

#### `SnagApprovalBloc`
- **Events**: `LoadMyPendingSnag(projectId)`, `AdvanceSnagApproval({roundId, comments, signature})`, `RejectSnagApproval({roundId, comments})`
- **States**: `SnagApprovalLoading`, `PendingSnagLoaded(items)`, `SnagApprovalSuccess`, `SnagApprovalError`

### 7.2 BLoC Registration in `main.dart`
```dart
sl.registerFactory(() => SnagDashboardBloc(apiClient: sl()));
sl.registerFactory(() => UnitSnagBloc(apiClient: sl(), db: sl()));
sl.registerFactory(() => SnagApprovalBloc(apiClient: sl()));
```

---

## 8. Permission System

### 8.1 New Permission Strings

| Permission String | Assigned To | What It Allows |
|---|---|---|
| `SNAG.LIST.READ` | All QC roles | View snag lists, rounds, items |
| `SNAG.LIST.CREATE` | QC Inspector, QC Manager | Initiate snagging for a unit |
| `SNAG.ITEM.RAISE` | QC Inspector | Add snag points during Snag phase |
| `SNAG.PHASE.SUBMIT` | QC Inspector | Submit Snag phase → unlock De-snag |
| `SNAG.ITEM.RECTIFY` | Site Engineer, Contractor rep | Mark items rectified + upload after-photos |
| `SNAG.ITEM.CLOSE` | QC Inspector | Verify rectification + close items |
| `SNAG.DESNAG.SUBMIT` | QC Inspector | Submit De-snag phase for release approval |
| `SNAG.ROUND.APPROVE` | QC Manager, Project Director | Approve/release a de-snag round |
| `SNAG.ROUND.REJECT` | QC Manager, Project Director | Reject approval → sends back to de-snag |
| `SNAG.ROUND.DELEGATE` | QC Manager | Delegate approval step to another user |

### 8.2 `PermissionService` additions
```dart
// ── Snagging ──────────────────────────────────────────────────────────────
bool get canReadSnag          => can('SNAG.LIST.READ');
bool get canCreateSnagList    => can('SNAG.LIST.CREATE');
bool get canRaiseSnagItem     => can('SNAG.ITEM.RAISE');
bool get canSubmitSnagPhase   => can('SNAG.PHASE.SUBMIT');
bool get canRectifySnagItem   => can('SNAG.ITEM.RECTIFY');
bool get canCloseSnagItem     => can('SNAG.ITEM.CLOSE');
bool get canSubmitDesnag      => can('SNAG.DESNAG.SUBMIT');
bool get canApproveSnagRound  => can('SNAG.ROUND.APPROVE');
bool get canRejectSnagRound   => can('SNAG.ROUND.REJECT');
bool get hasAnySnagAccess     =>
    canReadSnag || canRaiseSnagItem || canRectifySnagItem || canApproveSnagRound;
```

---

## 9. Module Hub Integration

### `project_dashboard_page.dart`
```dart
if (ps.hasAnySnagAccess)
  _ModuleDef(
    icon: Icons.verified_outlined,
    label: 'Snagging',
    color: const Color(0xFF7C3AED),
    onTap: () => _goSnagging(context),
  ),
```

### `module_selection_page.dart`
```dart
if (ps.hasAnySnagAccess) ...[
  _ModuleRow(
    icon: Icons.verified_outlined,
    title: 'Snagging & De-snagging',
    subtitle: 'Room-wise punch list · Rectification · 3-round release',
    color: const Color(0xFF7C3AED),
    onTap: () => _navigateToSnagging(context),
  ),
],
```

---

## 10. API Endpoints (`api_endpoints.dart`)

```dart
// ── Snag List ─────────────────────────────────────────────────────────────
static String snagProjectSummary(int projectId)          => '/snag/project/$projectId/summary';
static String snagFloorUnits(int projectId, int floorId) => '/snag/project/$projectId/floor/$floorId';
static const String createSnagList                       = '/snag';
static String snagList(int snagListId)                   => '/snag/$snagListId';
static String snagRounds(int snagListId)                 => '/snag/$snagListId/rounds';
static String openNextSnagRound(int snagListId)          => '/snag/$snagListId/round/next';

// ── Snag Phase ────────────────────────────────────────────────────────────
static String snagRoomGrid(int snagListId, int roundId)  => '/snag/$snagListId/round/$roundId/rooms';
static String snagRoomItems(int snagListId, int roundId, int roomId) =>
    '/snag/$snagListId/round/$roundId/room/$roomId/items';
static String snagItems(int snagListId, int roundId)     => '/snag/$snagListId/round/$roundId/items';
static String snagItem(int snagListId, int itemId)       => '/snag/$snagListId/items/$itemId';
static String submitSnagPhase(int snagListId, int roundId) => '/snag/$snagListId/round/$roundId/submit-snag';

// ── De-snag Phase ─────────────────────────────────────────────────────────
static String desnagItems(int snagListId, int roundId)   => '/snag/$snagListId/round/$roundId/desnag-items';
static String rectifySnagItem(int snagListId, int itemId)=> '/snag/$snagListId/items/$itemId/rectify';
static String closeSnagItem(int snagListId, int itemId)  => '/snag/$snagListId/items/$itemId/close';
static String reopenSnagItem(int snagListId, int itemId) => '/snag/$snagListId/items/$itemId/reopen';
static String holdSnagItem(int snagListId, int itemId)   => '/snag/$snagListId/items/$itemId/hold';
static String submitDesnagApproval(int snagListId, int roundId) =>
    '/snag/$snagListId/round/$roundId/submit-desnag';

// ── Photos ────────────────────────────────────────────────────────────────
static String snagItemPhotos(int itemId)                 => '/snag/items/$itemId/photos';
static String deleteSnagPhoto(int itemId, int photoId)   => '/snag/items/$itemId/photos/$photoId';

// ── Approval ─────────────────────────────────────────────────────────────
static String snagRoundApproval(int roundId)             => '/snag/round/$roundId/approval';
static String advanceSnagApproval(int roundId)           => '/snag/round/$roundId/approval/advance';
static String rejectSnagApproval(int roundId)            => '/snag/round/$roundId/approval/reject';
static String delegateSnagApproval(int roundId)          => '/snag/round/$roundId/approval/delegate';
static const String myPendingSnagApprovals               = '/snag/my-pending';
```

---

## 11. Quality Room Structure Integration

The existing `GET /quality/:projectId/structure/floor/:floorId` returns:
```json
[{
  "qualityUnitId": 101,
  "unitLabel": "A1-F3-103",
  "rooms": [
    { "id": 501, "label": "Master Bedroom" },
    { "id": 502, "label": "Bedroom 2" },
    { "id": 503, "label": "Bathroom 1" },
    { "id": 504, "label": "Kitchen" },
    { "id": 505, "label": "Living Room" },
    { "id": 506, "label": "Balcony" }
  ]
}]
```

**Integration approach:**
- `SnagRoomGridPage` fetches the room list from the snag API (which internally fetches from `quality_rooms`)
- The `snag_item.quality_room_id` is a FK to `quality_rooms.id` — rooms are not duplicated, just referenced
- When displaying the room grid, the backend joins `quality_rooms` with snag item counts

---

## 12. Offline Strategy

### Download on WiFi
- **P3**: Snag summaries for all accessible projects (summaries only — lightweight)
- **P4**: Full snag lists (rounds + items) for units where user has an active action

### Queue Offline
- `AddSnagItem`, `UpdateSnagItem` → queue → sync on reconnect
- `RectifySnagItem` → queue (without photos — photos are online-only)
- `CloseSnagItem`, `HoldSnagItem` → queue

### Always Online Only
- Photo uploads (before/after)
- `SubmitSnagPhase` (triggers notifications — needs to be live)
- `SubmitDesnagForApproval` (creates approval record — needs to be live)
- Approval advance/reject

---

## 13. Complete File List

### Backend (New Files — 17 files)
```
backend/src/snag/snag.module.ts
backend/src/snag/snag.controller.ts
backend/src/snag/snag.service.ts
backend/src/snag/snag-release.service.ts
backend/src/snag/dto/create-snag-list.dto.ts
backend/src/snag/dto/create-snag-item.dto.ts
backend/src/snag/dto/update-snag-item.dto.ts
backend/src/snag/dto/rectify-snag-item.dto.ts
backend/src/snag/dto/close-snag-item.dto.ts
backend/src/snag/dto/hold-snag-item.dto.ts
backend/src/snag/dto/submit-snag-phase.dto.ts
backend/src/snag/dto/release-approval.dto.ts
backend/src/snag/entities/snag-list.entity.ts
backend/src/snag/entities/snag-round.entity.ts
backend/src/snag/entities/snag-item.entity.ts
backend/src/snag/entities/snag-photo.entity.ts
backend/src/snag/entities/snag-release-approval.entity.ts
backend/src/snag/entities/snag-release-approval-step.entity.ts
backend/src/migrations/CreateSnagTables.ts
```

### Backend (Modified Files)
```
backend/src/app.module.ts            → import SnagModule
```

### Flutter (New Files — 19 files)
```
flutter/lib/features/snag/data/models/snag_models.dart
flutter/lib/features/snag/presentation/bloc/snag_dashboard_bloc.dart
flutter/lib/features/snag/presentation/bloc/unit_snag_bloc.dart
flutter/lib/features/snag/presentation/bloc/snag_approval_bloc.dart
flutter/lib/features/snag/presentation/pages/snag_project_summary_page.dart
flutter/lib/features/snag/presentation/pages/snag_floor_grid_page.dart
flutter/lib/features/snag/presentation/pages/snag_unit_grid_page.dart
flutter/lib/features/snag/presentation/pages/unit_snag_detail_page.dart
flutter/lib/features/snag/presentation/pages/snag_room_grid_page.dart          ← NEW
flutter/lib/features/snag/presentation/pages/room_snag_items_page.dart          ← NEW
flutter/lib/features/snag/presentation/pages/snag_item_detail_page.dart
flutter/lib/features/snag/presentation/pages/snag_pending_approvals_page.dart
flutter/lib/features/snag/presentation/widgets/snag_unit_tile.dart
flutter/lib/features/snag/presentation/widgets/room_snag_tile.dart              ← NEW
flutter/lib/features/snag/presentation/widgets/snag_item_tile.dart
flutter/lib/features/snag/presentation/widgets/snag_round_stepper.dart
flutter/lib/features/snag/presentation/widgets/snag_photo_grid.dart
flutter/lib/features/snag/presentation/widgets/add_snag_item_sheet.dart         ← NEW
flutter/lib/features/snag/presentation/widgets/snag_release_approval_sheet.dart
```

### Flutter (Modified Files)
```
flutter/lib/features/projects/presentation/pages/project_dashboard_page.dart   → add tile
flutter/lib/features/projects/presentation/pages/module_selection_page.dart    → add row
flutter/lib/core/auth/permission_service.dart                                   → add snag permissions
flutter/lib/core/api/api_endpoints.dart                                         → add snag endpoints
flutter/lib/main.dart                                                            → register BLoCs
flutter/lib/core/database/app_database.dart                                     → add cache tables
flutter/lib/core/sync/background_download_service.dart                          → add snag download
```

### React Web (New Files)
```
frontend/src/pages/snag/SnagDashboardPage.tsx
frontend/src/pages/snag/UnitSnagPage.tsx
frontend/src/services/snag.service.ts
```

---

## 14. Estimated Effort

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Backend entities + migrations | 2 days |
| Phase 2 | Backend CRUD + snag/de-snag phase transitions | 3 days |
| Phase 3 | Multi-level de-snag release approval service | 2 days |
| Phase 4 | Flutter models + BLoCs + API client | 2 days |
| Phase 5 | Dashboard → Floor → Unit grid screens | 2 days |
| Phase 6 | **Room grid + room items page (snag phase)** | 2 days |
| Phase 7 | Unit detail (tabs: snag / de-snag) + item detail | 3 days |
| Phase 8 | Add snag item sheet + photo upload | 1 day |
| Phase 9 | Approval sheet + pending approvals page | 1 day |
| Phase 10 | Offline cache + background download | 1 day |
| Phase 11 | React Web pages | 2 days |
| **Total** | | **~21 days** |

---

## 15. Dependencies / Prerequisites

1. **`quality_units` + `quality_rooms`** tables exist — ✅ already in backend
2. **`GET /quality/:projectId/structure/floor/:floorId`** endpoint exists — ✅ already built
3. **EPS tree** fetchable per project — ✅ already exists
4. **File upload service** (`/files/upload`) — ✅ already exists
5. **Push notification service** — ✅ already exists
6. **ApprovalWorkflowConfig** — reuse existing pattern (configurable levels per project)

---

## 16. Summary of Changes from v1

| What Changed | Why |
|---|---|
| Snag = raise points, De-snag = rectify + close | Correct terminology clarified by user |
| Two-phase model per round (Snag phase + De-snag phase) | De-snag is a distinct phase, not same as "round submission" |
| De-snag tab LOCKED until Snag phase submitted | Business rule: contractor cannot start until inspector finishes |
| Added `SnagRoomGridPage` as dedicated screen | Rooms are the primary navigation inside a unit during snagging |
| Added `RoomSnagItemsPage` | Per-room item list with add/manage actions |
| Added `AddSnagItemSheet` | Quick-add bottom sheet for new snag points |
| `snag_round` now has `snag_phase_status` + `desnag_phase_status` | Two distinct statuses, not one |
| `snag_item.quality_room_id` added | Links each snag point to a specific room from quality_rooms |
| Carried-forward items from On Hold only | Open items are NOT automatically carried forward — they must be on_hold or the de-snag won't be submittable |
| `submit-snag` and `submit-desnag` are separate endpoints | Two distinct submission actions |
