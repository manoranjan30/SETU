# Checklist Approval Progress Dashboard — Mobile App Plan

**Date:** 2026-03-17
**Module:** Quality → Checklist Approval Progress
**Platform:** Flutter (Mobile App)

---

## 1. Goal

Give site engineers and QC managers a fast, visual, drill-down dashboard to answer:

- **"What is pending across the whole project?"**
- **"Which floor has the most open RFIs?"**
- **"Which activity needs my attention right now?"**

Navigation must feel like zooming into a building: Project → Block → Floor → Activity.

---

## 2. Navigation Structure (Drill-Down)

```
[Project Summary Screen]
        │
        ▼
[Block List Screen]           ← summary cards per Block (EPS level)
        │
        ▼
[Floor Grid Screen]           ← 13 floor tiles (GF, 1F … 12F) colour-coded
        │
        ▼
[Floor Activity List Screen]  ← all activities for that floor, grouped by status
        │
        ▼
[Activity Detail / RFI Card]  ← existing inspection_detail_page (reuse)
```

All screens are pushed onto the same Navigator stack — back button always takes the user one level up.

---

## 3. Screen-by-Screen Design

---

### 3.1 Project Summary Screen
**Route:** `/quality/dashboard`
**Entry Point:** "Quality" bottom-nav tab, first tab = "Progress"

#### Layout
```
┌──────────────────────────────────────────┐
│  CHECKLIST PROGRESS          [🔔 3]  [⚙] │
├──────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ TOTAL    │  │ PENDING  │  │ APPROVED│ │
│  │  382     │  │   127    │  │  201   │  │
│  │Activities│  │   33%    │  │  52%   │  │
│  └──────────┘  └──────────┘  └────────┘  │
│                                          │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒░░░░░░░░░░░░   52% │
│  ■ Approved  ■ In-Review  ■ Pending      │
│                                          │
│  QUICK FILTERS:                          │
│  [All] [My Pending] [Observations] [NCR] │
│                                          │
│  ──── BY BLOCK ────────────────────────  │
│  ┌────────────────────────────────────┐  │
│  │ Block 4 · Tower H          ▶       │  │
│  │ ▓▓▓▓▓▓▒▒░░  64% done · 8 pending  │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Block 3 · Tower H3         ▶       │  │
│  │ ▒▒▒░░░░░░░  12% done · 45 pending  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**Data source:** `GET /quality/inspections?projectId=X` → aggregate counts client-side, grouped by `epsNodeId` (Block-level EPS nodes).

---

### 3.2 Block / Tower Screen
**Route:** `/quality/dashboard/block/:blockId`

#### Layout
```
┌──────────────────────────────────────────┐
│  ← Block 4 · Tower H                     │
│     64% complete · 8 pending review      │
├──────────────────────────────────────────┤
│  FLOORS                  [Sort ▼] [🔍]   │
├──────────────────────────────────────────┤
│  ┌──────────────────────────────────┐    │
│  │  FLOOR GRID (3 columns)          │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐     │    │
│  │  │  GF  │ │  1F  │ │  2F  │     │    │
│  │  │ 🟢 ✓ │ │ 🟡 2 │ │ 🔴 5 │     │    │
│  │  └──────┘ └──────┘ └──────┘     │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐     │    │
│  │  │  3F  │ │  4F  │ │  5F  │     │    │
│  │  │ 🟢 ✓ │ │ 🟡 1 │ │ 🔴 3 │     │    │
│  │  └──────┘ └──────┘ └──────┘     │    │
│  │  … GF through 12F               │    │
│  └──────────────────────────────────┘    │
│                                          │
│  LEGEND:                                 │
│  🟢 All Done  🟡 In Review  🔴 Pending   │
│  ⚪ Not Started  🔵 Partially Done       │
└──────────────────────────────────────────┘
```

**Floor tile colour logic:**

| Colour | Condition |
|--------|-----------|
| Green | All activities for floor: `APPROVED` |
| Blue | Mix of approved + in-review (no pending/locked) |
| Amber | Any activity `IN_REVIEW` or `PARTIALLY_APPROVED` |
| Red | Any activity `LOCKED` (not raised) or has open observation |
| Grey | No activities yet (floor not started) |

The **number badge** on each tile = count of activities that are NOT yet fully approved.

**Data source:** `GET /quality/inspections?projectId=X&epsNodeId=<floorId>` — called once for all floors using `Promise.all`, cached in BLoC state.

---

### 3.3 Floor Activity List Screen
**Route:** `/quality/dashboard/block/:blockId/floor/:floorId`

This is the **most important screen** — where the user finds what to action.

#### Layout
```
┌──────────────────────────────────────────┐
│  ← Floor 3 · Block 4                     │
│     18 Activities · 5 Pending · 2 Raised  │
├──────────────────────────────────────────┤
│  [All 18] [Pending 5] [Raised 2] [Done 11]│
├──────────────────────────────────────────┤
│  ── NEEDS ACTION ──────────────────────  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🔴 Plastering - Internal Walls     │  │
│  │    Not raised · Predecessors Done  │  │
│  │    [Raise RFI]                 ▶  │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 🟠 Windows & Ventilators           │  │
│  │    Observation Open: "Gap in frame"│  │
│  │    [View Observation]          ▶  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ── AWAITING APPROVAL ─────────────────  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🟡 Flooring - Master Bedroom       │  │
│  │    RFI #1042 · Stage 2/3 Pending   │  │
│  │    Raised 2d ago                   │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 🔵 Ceiling Painting (Multi-Go)     │  │
│  │    Part 1 ✓ · Part 2 Ready         │  │
│  │    [Raise Part 2]              ▶  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ── COMPLETED ─────────────────────────  │
│  (collapsed, tap to expand · 11 items)   │
└──────────────────────────────────────────┘
```

#### Section Grouping Logic

| Section | Activities included |
|---------|-------------------|
| **Needs Action** | `LOCKED` with all predecessors done + activities with open observations |
| **Awaiting Approval** | `IN_REVIEW` / `PARTIALLY_APPROVED` / Multi-Go Part 2 ready |
| **Completed** | `APPROVED` (collapsed by default) |
| **Blocked** | `LOCKED` with predecessor not done (hidden by default, accessible via filter) |

#### Filter Chips (top)
- **All** — show everything
- **Pending** — Needs Action + Awaiting
- **Raised** — currently in approval workflow
- **Done** — Approved
- **Observations** — activities with open observations
- **Multi-Go** — activities using multi-part RFI

**Data source:** Reuses existing `GET /quality/inspections?projectId=X&epsNodeId=<floorId>` + `quality_activities` from existing QualityRequestBloc. No new API needed.

---

### 3.4 "My Pending" Quick View (Global)
**Route:** Access via 🔔 badge on Project Summary

```
┌──────────────────────────────────────────┐
│  ← My Pending Actions          3 items   │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ 🟡 Block 4 · Floor 3               │  │
│  │    Flooring - Master Bedroom       │  │
│  │    Awaiting my L2 Approval         │  │
│  │    RFI #1042 · 2 days ago      ▶  │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 🔴 Block 4 · Floor 5               │  │
│  │    Plastering - Common Corridor    │  │
│  │    Open Observation (NCR)      ▶  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**Data source:** `GET /quality/inspections/my-pending?projectId=X`

---

## 4. Color & Status System

| Colour | Hex | Meaning |
|--------|-----|---------|
| Green `🟢` | `#4CAF50` | Fully Approved |
| Blue `🔵` | `#2196F3` | In approval pipeline, progressing |
| Amber `🟡` | `#FF9800` | Awaiting approval, my action needed |
| Red `🔴` | `#F44336` | Not raised / open observation blocking |
| Orange `🟠` | `#FF5722` | Observation raised (not NCR) |
| Grey `⚪` | `#9E9E9E` | No activities or not started |
| Purple `🟣` | `#9C27B0` | Unit-wise RFI (UNIT type) |

---

## 5. Flutter Architecture

### 5.1 New BLoC: `QualityDashboardBloc`

```
Events:
  LoadDashboard(projectId)
  LoadBlockFloors(projectId, blockId)
  LoadFloorActivities(projectId, floorId)
  ApplyFilter(DashboardFilter filter)

States:
  DashboardLoading
  DashboardLoaded(
    blocks: List<BlockSummary>,
    myPendingCount: int,
  )
  BlockFloorsLoaded(
    blockId: int,
    floorSummaries: List<FloorSummary>,
  )
  FloorActivitiesLoaded(
    floorId: int,
    sections: DashboardSections,  // needsAction, awaiting, done, blocked
  )
```

### 5.2 New Models

```dart
class BlockSummary {
  final int epsNodeId;
  final String name;
  final int total, approved, inReview, pending;
  double get pct => total == 0 ? 0 : approved / total;
}

class FloorSummary {
  final int floorId;
  final String label;   // "GF", "1F" etc.
  final FloorStatus status;   // green/blue/amber/red/grey
  final int pendingCount;
}

class DashboardSections {
  final List<ActivityRow> needsAction;
  final List<ActivityRow> awaitingApproval;
  final List<ActivityRow> completed;
  final List<ActivityRow> blocked;
}
```

### 5.3 New Files

| File | Purpose |
|------|---------|
| `features/quality/presentation/bloc/quality_dashboard_bloc.dart` | New BLoC |
| `features/quality/presentation/pages/quality_dashboard_page.dart` | Project summary |
| `features/quality/presentation/pages/block_floors_page.dart` | Floor grid |
| `features/quality/presentation/pages/floor_activity_dashboard_page.dart` | Activity list with sections |
| `features/quality/presentation/widgets/floor_tile.dart` | Coloured floor tile widget |
| `features/quality/presentation/widgets/dashboard_activity_card.dart` | Compact activity row |
| `features/quality/data/models/dashboard_models.dart` | BlockSummary, FloorSummary, DashboardSections |

### 5.4 Reused (No Changes Needed)

- `QualityRequestBloc` — loads activities per floor (reused for FloorActivities data)
- `inspection_detail_page.dart` — tap on any activity card drills into existing detail page
- `activity_card.dart` — can be embedded in `FloorActivityDashboardPage` directly
- `setu_api_client.dart` — `getInspections`, `getMyPendingInspections` already exist

---

## 6. API Mapping

| Screen | API Call | Endpoint |
|--------|---------|---------|
| Project Summary | Get all inspections for project | `GET /quality/inspections?projectId=X` |
| My Pending badge | My pending count | `GET /quality/inspections/my-pending?projectId=X` |
| Block Floors (colour) | Per-floor inspection counts | Derive from inspections already loaded (group by epsNodeId) |
| Floor Activities | Activities + inspections for floor | `GET /quality/inspections?projectId=X&epsNodeId=<floorId>` (existing call) |
| Unit progress per activity | Per-unit status | `GET /quality/inspections/unit-progress?projectId=X&epsNodeId=X&activityId=X` |

**All APIs already exist.** No new backend endpoints required.

---

## 7. Progressive Loading Strategy

To keep the UI snappy:

1. **Project Summary** loads immediately from cached inspections (already fetched elsewhere).
2. **Block Floors grid** is computed from those same cached inspections — zero additional API calls.
3. **Floor Activity List** triggers a fresh `getInspections` only when the user taps a floor tile.
4. Pull-to-refresh on any screen re-fetches that level's data.
5. Background sync keeps inspections cache fresh (existing sync service).

---

## 8. Navigation Entry Points

### Primary: Quality Tab → "Progress" sub-tab
Add a second tab "Progress" next to existing "Requests" / "Approvals" tabs in `quality_page.dart`.

### Secondary: Deep Links from Notification
When a push notification says "RFI #1042 needs your approval" → open `FloorActivityDashboardPage` pre-filtered to that floor.

### Tertiary: "My Pending" badge
Tap the badge on any screen → opens global `MyPendingPage`.

---

## 9. Key UX Decisions

| Decision | Rationale |
|----------|-----------|
| Floor Grid (not list) | Visual spatial map matches the physical building layout engineers already have in their head |
| Sections over flat list | "Needs Action" always at top — zero hunting for pending items |
| "Completed" collapsed | Hides noise; engineers rarely need to review done items |
| Colour coded tiles | Site engineer can scan 13 floors in 2 seconds |
| No new API endpoints | Uses existing data, ships faster, no backend risk |
| Reuse `ActivityCard` | Consistent UI, no learning curve for existing users |

---

## 10. Implementation Order

| Phase | What | Effort |
|-------|------|--------|
| 1 | `dashboard_models.dart` + `QualityDashboardBloc` skeleton | 1 day |
| 2 | `QualityDashboardPage` (Project Summary) | 1 day |
| 3 | `BlockFloorsPage` with `FloorTile` widget | 1 day |
| 4 | `FloorActivityDashboardPage` with sections | 2 days |
| 5 | Navigation wiring + Quality tab sub-tabs | 0.5 day |
| 6 | My Pending screen + badge | 0.5 day |
| **Total** | | **~6 days** |

---

## 11. Wireframe Summary

```
Quality Tab
├── [Requests]  [Approvals]  [Progress ← NEW]
│
└── Progress Tab
    └── QualityDashboardPage
        │  Summary stats + block cards
        │
        └── BlockFloorsPage (tap a block)
            │  Floor grid 3-col, colour coded
            │
            └── FloorActivityDashboardPage (tap a floor)
                │  Sections: Needs Action / Awaiting / Done
                │  Filter chips: All / Pending / Raised / Done / Observations
                │
                └── InspectionDetailPage (tap activity) ← EXISTING
```

---

## 12. Out of Scope (This Phase)

- Push notifications (separate plan)
- Analytics / trend charts (future dashboard builder)
- NCR management screen (separate module)
- 3D Tower Visualization (see `3D_TOWER_PROGRESS_VISUALIZATION_PLAN.md`)
