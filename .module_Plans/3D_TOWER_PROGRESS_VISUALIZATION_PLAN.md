# 3D Tower Progress Visualization — Innovation Plan
## SETU Mobile App — Feature: "Tower Lens"

**Prepared for:** Puravankara Limited — SETU Platform
**Date:** March 2026
**Type:** New Feature — Creative Mobile Experience

---

## 1. Vision

Construction progress today is communicated through spreadsheets and flat percentage numbers. A site manager looking at "Floor 7 — 68% complete" has no spatial context, no emotional connection to what that means on the ground.

**Tower Lens** transforms that number into a living, breathing 3D building that grows floor by floor on your phone screen — green where work is done, orange where crews are active, grey ghost-frames where foundations haven't been poured yet. You see the building at a glance, tap a floor to inspect it, rotate it with a finger, and watch it animate to life when you first open it.

The goal is to make project progress **visceral** — something you *feel*, not just read.

---

## 2. Design Principles

| Principle | What it means |
|-----------|--------------|
| **No third-party 3D engine** | Pure Flutter `CustomPainter` — no WebView, no Unity, no native bridge. Instant startup, fully offline. |
| **Data-driven geometry** | Every floor's color, height fill, and glow comes from real project data — not placeholders. |
| **One tap to insight** | Tap any floor → instantly see activities, quality issues, EHS flags without a second load. |
| **Delight on first open** | The building assembles itself floor by floor (stacking animation) the first time you view a tower. |
| **Honest visualization** | Planned-but-not-started floors are shown as wireframes (ghost floors) — the app doesn't hide the future. |

---

## 3. User Stories

```
AS a Site Manager,
  I want to see all towers in my project at a glance with color-coded progress,
  SO THAT I know at a single look which tower needs my attention today.

AS a Project Manager,
  I want to tap Floor 8 in Tower H and see its breakdown of pending activities,
  SO THAT I can quickly identify why it's showing 43% when it should be 70%.

AS a QC Inspector,
  I want to toggle "Quality View" and see which floors have open observations highlighted,
  SO THAT I know exactly which floors to walk today.

AS an EHS Officer,
  I want to see EHS incidents mapped to floors as warning markers,
  SO THAT I can brief the safety crew on hotspots before their morning walk.

AS a Director,
  I want the project dashboard to show a compact 3D building thumbnail,
  SO THAT I get an instant visual status without entering the feature.
```

---

## 4. Screen Architecture

### 4.1 New Screens / Widgets

```
features/tower_lens/
├── data/
│   ├── models/
│   │   ├── floor_progress.dart        # Per-floor aggregated data model
│   │   ├── tower_render_model.dart    # Geometry + color resolved model
│   │   └── tower_view_mode.dart       # Enum: progress / quality / ehs
│   └── repositories/
│       └── tower_progress_repository.dart # Aggregates EPS + activities + obs
│
├── presentation/
│   ├── bloc/
│   │   └── tower_lens_bloc.dart       # State: loading / rendered / floor selected
│   ├── pages/
│   │   └── tower_lens_page.dart       # Main 3D full-screen view
│   └── widgets/
│       ├── isometric_building_painter.dart  # Core CustomPainter — renders 3D
│       ├── floor_detail_sheet.dart          # Bottom sheet — floor breakdown
│       ├── view_mode_switcher.dart          # Progress / Quality / EHS toggle
│       ├── floor_legend_bar.dart            # Horizontal scroll — floor names + %
│       ├── tower_mini_card.dart             # Dashboard thumbnail widget
│       ├── project_site_map.dart            # Top-down multi-tower site overview
│       └── progress_timeline_scrubber.dart  # Historical scrub slider (Phase 2)
```

### 4.2 Navigation

```
ProjectDashboardPage
  └── [Tower Lens tile in module grid]
        └── TowerLensPage (project overview — all towers)
              └── [tap a tower]
                    └── TowerLensPage (single tower detail)
                          └── [tap a floor]
                                └── FloorDetailSheet (bottom sheet, modal)
                                      └── [tap activity]
                                            └── ActivityListDetailPage (existing)
```

---

## 5. Visual Design Specification

### 5.1 Isometric Projection

The building is rendered using **isometric projection** — a mathematically clean fake-3D that makes buildings look architectural and professional.

```
Each floor = a box with 3 visible faces:

          TOP FACE (progress fill color)
         ┌──────────────┐
        /              /│
       /   Top Face   / │
      /              /  │ RIGHT FACE
     └──────────────┘   │ (dark shade)
     │              │   │
     │  FRONT FACE  │   /
     │  (mid shade) │  /
     │              │ /
     └──────────────┘

Floor height = 28px (isometric units)
Floor width  = 120px
Floor depth  = 80px
```

**Isometric math:**
```dart
// Convert 3D world coordinates to 2D canvas coordinates
Offset isoProject(double x, double y, double z) {
  // Standard 2:1 isometric ratio
  final isoX = (x - y) * (floorWidth / 2);
  final isoY = (x + y) * (floorWidth / 4) - z * floorHeight;
  return Offset(canvasCenterX + isoX, canvasCenterY + isoY);
}
```

### 5.2 Color System

| Progress % | Phase Name | Top Face Color | Meaning |
|-----------|-----------|----------------|---------|
| 0% | Ghost / Planned | Transparent wireframe, grey outline `#9CA3AF` | Not started |
| 1–30% | Structure | `#D1D5DB` (light concrete grey) | Foundation / structure work |
| 31–55% | MEP & Rough-In | `#FED7AA` (warm amber) | Plumbing, electrical, blockwork |
| 56–80% | Finishing | `#FEF08A` (soft yellow) | Plastering, tiling, painting |
| 81–99% | Near Complete | `#BBF7D0` (light green) | Final touches |
| 100% | Complete ✓ | `#22C55E` (rich green) with subtle shimmer | Handed over |

**Face shading:** Left face = base color at 75% brightness. Right face = 55% brightness. Creates depth without shadows.

**Overlay modes** (replaces top face color):

*Quality Mode:*
- Green = 0 open observations
- Amber = 1–3 open observations
- Red = 4+ open observations or rejected RFI

*EHS Mode:*
- Green = 0 incidents/observations
- Orange = open observation
- Red = LTI or critical EHS event

### 5.3 Special Visual States

| State | Visual Treatment |
|-------|-----------------|
| **Active floor** (crew working today) | Subtle blue glow pulse animation (2s loop) |
| **Rejected RFI** | Red diagonal stripe texture on floor face |
| **Pending approval** | Dotted outline on top face |
| **Top-most built floor** | Tiny animated crane icon (🏗 SVG) |
| **100% complete floor** | Single confetti burst animation (one-time, on completion event) |
| **Selected floor** | Extruded slightly (lifted by 4px) with drop shadow |

---

## 6. Data Model

### 6.1 FloorProgress

```dart
/// Aggregated progress data for a single floor, computed from
/// the EPS node's activities, inspections, and observations.
class FloorProgress {
  final int epsNodeId;
  final String floorName;       // "GF", "Floor 1", "Floor 12", "Terrace"
  final int floorIndex;         // 0 = ground floor (for z-ordering in render)
  final double progressPct;     // 0.0 – 100.0 (avg of activity actualProgress)
  final int totalActivities;
  final int completedActivities;
  final int pendingActivities;  // ready but not raised RFI
  final int inProgressActivities; // RFI raised, pending approval
  final int openQualityObs;     // quality site observations open
  final int openEhsObs;         // EHS observations open
  final int pendingRfis;        // raised but not yet approved
  final int rejectedRfis;
  final bool hasActiveWork;     // progress entry logged today
  final FloorPhase phase;       // computed enum: structure / mep / finishing / complete

  FloorPhase get phase {
    if (progressPct == 100) return FloorPhase.complete;
    if (progressPct >= 56)  return FloorPhase.finishing;
    if (progressPct >= 31)  return FloorPhase.mepRoughIn;
    if (progressPct > 0)    return FloorPhase.structure;
    return FloorPhase.notStarted;
  }

  bool get hasIssues => openQualityObs > 0 || openEhsObs > 0 || rejectedRfis > 0;
}

enum FloorPhase { notStarted, structure, mepRoughIn, finishing, nearComplete, complete }
```

### 6.2 TowerRenderModel

```dart
/// Fully resolved render instructions for a tower.
/// The painter reads this — it does NOT call APIs or BLoCs.
class TowerRenderModel {
  final String towerName;
  final List<FloorProgress> floors; // ordered bottom-to-top
  final double overallProgress;
  final TowerViewMode activeMode;
  final int? selectedFloorIndex;

  /// Returns the color for the top face of a floor based on
  /// the active view mode and floor's data.
  Color resolveTopColor(int floorIndex) { ... }

  /// Returns the stroke color for a floor's outline.
  Color resolveOutlineColor(int floorIndex) { ... }

  /// Whether this floor should render as wireframe only (not started).
  bool isGhost(int floorIndex) =>
    floors[floorIndex].progressPct == 0;
}
```

### 6.3 TowerViewMode

```dart
enum TowerViewMode {
  progress,  // Default: color by completion %
  quality,   // Color by open quality observations
  ehs,       // Color by open EHS events
  timeline,  // Future: scrub through historical progress
}
```

---

## 7. Isometric Building Painter — Core Engine

### 7.1 Architecture

```dart
class IsometricBuildingPainter extends CustomPainter {
  final TowerRenderModel model;
  final double rotationAngle;   // -π/6 to π/6 for finger-drag rotation
  final double scale;           // 0.5 to 2.0 for pinch zoom
  final double buildProgress;   // 0.0 to 1.0 — stacking animation drive

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Apply camera transform (translate to center, scale, rotate)
    canvas.save();
    _applyCameraTransform(canvas, size);

    // 2. Paint floors BOTTOM to TOP so upper floors correctly overlap lower
    for (int i = 0; i < model.floors.length; i++) {
      final floorVisible = i < (model.floors.length * buildProgress);
      if (!floorVisible) _drawGhostFloor(canvas, i);
      else _drawSolidFloor(canvas, i);
    }

    // 3. Overlay markers (quality dots, EHS triangles, crane icon)
    _drawOverlayMarkers(canvas);

    canvas.restore();
  }

  void _drawSolidFloor(Canvas canvas, int index) {
    final z = index.toDouble(); // floor elevation
    final topColor = model.resolveTopColor(index);
    final isSelected = model.selectedFloorIndex == index;
    final lift = isSelected ? 4.0 : 0.0; // lift selected floor

    // Compute the 8 vertices of the isometric box
    final v = _computeFloorVertices(index, lift);

    // Draw right face (darkest)
    _fillPath(canvas, [v.topFrontRight, v.topBackRight, v.botBackRight, v.botFrontRight],
        color: topColor.withHSLLightness(topColor.lightness * 0.55));

    // Draw left face (medium)
    _fillPath(canvas, [v.topFrontLeft, v.topFrontRight, v.botFrontRight, v.botFrontLeft],
        color: topColor.withHSLLightness(topColor.lightness * 0.75));

    // Draw top face (brightest — shows progress color)
    _fillPath(canvas, [v.topBackLeft, v.topBackRight, v.topFrontRight, v.topFrontLeft],
        color: topColor);

    // Draw outline
    _strokePath(canvas, v.allTopEdges, color: model.resolveOutlineColor(index),
        strokeWidth: isSelected ? 1.5 : 0.8);

    // Progress fill bar on front face (optional detail at high zoom)
    if (scale > 1.4) _drawProgressFillBar(canvas, index, v);
  }

  void _drawGhostFloor(Canvas canvas, int index) {
    // Ghost = wireframe only (dashed grey lines), no fill
    final v = _computeFloorVertices(index, 0);
    _strokeDashedPath(canvas, v.allEdges,
        color: const Color(0xFF9CA3AF), dashLength: 4, gapLength: 4);
  }
}
```

### 7.2 Rotation Parallax Effect

Instead of true free rotation (expensive), a **horizontal drag** shifts the vanishing-point angle by ±15 degrees using a simple affine transform. This creates the illusion of rotating the building:

```dart
void _applyCameraTransform(Canvas canvas, Size size) {
  canvas.translate(size.width / 2, size.height * 0.42); // center + slight upward
  canvas.scale(scale);
  // Parallax: shift x perspective with rotation angle
  // Max ±0.26 radians (±15°) — cosmetic, not full rotation
  canvas.transform(Matrix4.identity()
    ..setEntry(3, 2, 0.001 * sin(rotationAngle)) // perspective skew
    ..rotateZ(rotationAngle * 0.08)               // subtle Z tilt
    .storage);
}
```

### 7.3 Overlay Markers

```dart
void _drawOverlayMarkers(Canvas canvas) {
  for (int i = 0; i < model.floors.length; i++) {
    final floor = model.floors[i];
    final faceCenter = _getFrontFaceCenter(i);

    // Quality observation dot (top-left of front face)
    if (floor.openQualityObs > 0) {
      _drawDot(canvas, faceCenter.translate(-18, -8),
          color: floor.openQualityObs > 3 ? Colors.red : Colors.orange,
          radius: 5, label: '${floor.openQualityObs}');
    }

    // EHS marker (triangle, top-right of front face)
    if (floor.openEhsObs > 0) {
      _drawWarningTriangle(canvas, faceCenter.translate(18, -8),
          color: Colors.deepOrange);
    }

    // Active work pulsing dot (center of top face)
    if (floor.hasActiveWork) {
      _drawPulsingDot(canvas, _getTopFaceCenter(i), color: const Color(0xFF2563EB));
    }
  }
}
```

---

## 8. Animations

### 8.1 Build-Up Animation (First Open)

When `TowerLensPage` first loads, the building "assembles" from the ground up:

```dart
// In _TowerLensPageState.initState:
_buildController = AnimationController(
  duration: Duration(milliseconds: 800 + model.floors.length * 60),
  vsync: this,
);
_buildAnimation = CurvedAnimation(
  parent: _buildController,
  curve: Curves.easeOutCubic,
);
_buildController.forward(); // drives buildProgress in painter: 0.0 → 1.0
```

**Result:** Floors appear one by one from bottom to top, with a slight bounce at the top. Total duration ≈ 1.2s for a 13-floor tower.

### 8.2 Floor Selection Lift

When a floor is tapped, it "lifts" 4px with a spring animation:

```dart
_liftController = AnimationController(duration: const Duration(milliseconds: 180), vsync: this);
_liftAnimation = Tween<double>(begin: 0, end: 4).animate(
  CurvedAnimation(parent: _liftController, curve: Curves.easeOutBack),
);
```

### 8.3 Active Floor Pulse

Floors with `hasActiveWork = true` show a soft blue glow that pulses:

```dart
// Repeating 2-second sine wave
_pulseAnimation = Tween<double>(begin: 0.3, end: 0.8).animate(
  CurvedAnimation(parent: _pulseController..repeat(reverse: true), curve: Curves.easeInOut),
);
// Applied as Paint alpha on the pulsing dot overlay
```

### 8.4 View Mode Transition

Switching between Progress / Quality / EHS modes cross-fades the floor colors:

```dart
_modeTransitionController = AnimationController(
  duration: const Duration(milliseconds: 350),
  vsync: this,
);
// In painter: lerp(previousColor, newColor, _modeTransition.value)
Color resolveTopColor(int i) => Color.lerp(
  _previousModel.resolveTopColor(i),
  _currentModel.resolveTopColor(i),
  _modeTransition.value,
)!;
```

### 8.5 100% Completion Confetti

When `TowerLensBloc` detects a floor reaching 100% (first time), emit a `FloorCompleted` state that triggers a confetti burst using the `confetti` package:

```yaml
# pubspec.yaml addition
confetti: ^0.7.0
```

---

## 9. Gesture System

```
GESTURE          ACTION                      HANDLER
─────────────────────────────────────────────────────────────────
Single tap       Select floor               → lift animation + open FloorDetailSheet
Double tap       Reset camera               → zoom/rotation spring back to defaults
Horizontal drag  Rotate building            → ±15° parallax shift via rotationAngle
Vertical drag    Scroll floor legend        → GestureDetector on legend bar
Pinch in/out     Zoom                       → scale clamp 0.5–2.5
Long press       Quick stats tooltip        → show floor % + issue count tooltip
Swipe up (sheet) Expand floor detail        → DraggableScrollableSheet
```

**Hit testing for floor tap:**

Since `CustomPainter` doesn't have built-in hit areas, we maintain a list of `FloorHitArea` objects in painter state:

```dart
class FloorHitArea {
  final int floorIndex;
  final Path topFacePath;   // path polygon of the top face
  final Path frontFacePath; // path polygon of the front face
  bool contains(Offset point) =>
    topFacePath.contains(point) || frontFacePath.contains(point);
}

// In GestureDetector.onTapUp:
final hit = _hitAreas.firstWhereOrNull((h) => h.contains(details.localPosition));
if (hit != null) _onFloorTapped(hit.floorIndex);
```

---

## 10. Floor Detail Sheet

When a floor is tapped, a `DraggableScrollableSheet` slides up from the bottom with:

```
┌────────────────────────────────────────────┐
│  ●●●●●  drag handle                        │
│                                            │
│  Floor 7 — Tower H          ██████░ 68%   │
│  ─────────────────────────────────────────  │
│  Activities                                │
│  ✓ 12 Approved   ⏳ 5 Pending   🔒 2 Locked │
│                                            │
│  ┌─────────────────────────────────────┐   │
│  │ Ceiling Painting          ✓ Approved │   │
│  │ Waterproofing             ⏳ RFI Raised│  │
│  │ Gypsum Works              🔒 Locked  │   │
│  └─────────────────────────────────────┘   │
│                                            │
│  Quality Observations: 2 open             │
│  [View Observations →]                    │
│                                            │
│  EHS: No active observations ✓            │
│                                            │
│  [Open Floor in Quality Module →]         │
└────────────────────────────────────────────┘
```

---

## 11. Project Site Map (Multi-Tower Overview)

When the user opens **Tower Lens** at the project level, they see a **top-down site plan** showing all towers as isometric mini-buildings:

```
┌────────────────────────────────────────────────────────────┐
│  Equinox 2 — Provident                       [3D] [Map]   │
│  ─────────────────────────────────────────────────────────  │
│                                                            │
│        ┌──────┐     ┌──────┐     ┌──────┐                 │
│        │ Blk3 │     │ Blk4 │     │ Blk5 │                 │
│        │  45% │     │  73% │     │  12% │                 │
│        │ 🟡   │     │ 🟢   │     │ 🔴   │                 │
│        └──────┘     └──────┘     └──────┘                 │
│                                                            │
│  Tap a tower to inspect in 3D                             │
└────────────────────────────────────────────────────────────┘
```

Each mini-tower is itself a small `IsometricBuildingPainter` rendering 3–5 simplified floor slices. Tapping one opens the full `TowerLensPage` for that tower.

---

## 12. Dashboard Mini Widget (TowerMiniCard)

Added to `ProjectDashboardPage` as an optional header widget:

```
┌─────────────────────────────────────────────────────┐
│                    [Mini 3D building — 120px tall]  │
│    Tower H                                          │
│    ████████████░░░   73% complete                   │
│    13 floors  ·  4 open QC obs  ·  1 EHS obs       │
│                              [Open Tower Lens →]   │
└─────────────────────────────────────────────────────┘
```

---

## 13. BLoC Design

### 13.1 TowerLensBloc

```dart
// Events
class LoadTowerLens extends TowerLensEvent {
  final int projectId;
  final int? specificEpsNodeId; // null = load all towers for project
}
class SelectFloor extends TowerLensEvent { final int floorIndex; }
class ChangeViewMode extends TowerLensEvent { final TowerViewMode mode; }
class RefreshTowerLens extends TowerLensEvent { final int projectId; }

// States
class TowerLensInitial extends TowerLensState {}
class TowerLensLoading extends TowerLensState {}

class TowerLensLoaded extends TowerLensState {
  final List<TowerRenderModel> towers;  // one per tower EPS node
  final TowerViewMode activeMode;
  final int? selectedTowerIndex;
  final int? selectedFloorIndex;
  final FloorProgress? selectedFloorData;
}

class FloorCompleted extends TowerLensState {
  // Fires confetti + success animation
  final String floorName;
  final String towerName;
}

class TowerLensError extends TowerLensState { final String message; }
```

### 13.2 Data Assembly in Bloc

The BLoC aggregates data from multiple existing sources:

```dart
Future<void> _onLoad(LoadTowerLens event, Emitter emit) async {
  emit(TowerLensLoading());
  try {
    // 1. Get EPS tree for project
    final epsNodes = await _api.getEpsTree(event.projectId);

    // 2. Filter TOWER nodes → then get FLOOR children for each
    final towers = epsNodes.where((n) => n.type == 'TOWER').toList();

    // 3. For each tower, get all floor nodes
    final floorsByTower = await Future.wait(
      towers.map((t) => _api.getEpsChildren(t.id))
    );

    // 4. For each floor, aggregate activities + inspections + observations
    // Uses TowerProgressRepository which batches API calls efficiently
    final renderModels = await _repository.buildRenderModels(towers, floorsByTower);

    emit(TowerLensLoaded(towers: renderModels, activeMode: TowerViewMode.progress));
  } catch (e) {
    emit(TowerLensError('$e'));
  }
}
```

### 13.3 TowerProgressRepository

A new dedicated repository class (not a BLoC) that handles data aggregation:

```dart
class TowerProgressRepository {
  Future<List<TowerRenderModel>> buildRenderModels(
    List<EpsNode> towers,
    List<List<EpsNode>> floorsByTower,
  ) async {
    // Parallel fetch per tower
    return Future.wait(towers.indexed.map((entry) async {
      final (i, tower) = entry;
      final floors = floorsByTower[i];
      final floorProgressList = await Future.wait(
        floors.map((floor) => _getFloorProgress(floor))
      );
      return TowerRenderModel(
        towerName: tower.name,
        floors: floorProgressList,
        overallProgress: _average(floorProgressList.map((f) => f.progressPct)),
        activeMode: TowerViewMode.progress,
      );
    }));
  }

  Future<FloorProgress> _getFloorProgress(EpsNode floorNode) async {
    // Fetch in parallel: activities, quality obs, EHS obs
    final [activities, qualityObs, ehsObs] = await Future.wait([
      _api.getActivitiesForFloor(floorNode.id),      // existing endpoint
      _api.getQualitySiteObservations(floorNode.projectId, epsNodeId: floorNode.id),
      _api.getEhsSiteObservations(floorNode.projectId, epsNodeId: floorNode.id),
    ]);
    // Aggregate into FloorProgress
    return FloorProgress(
      epsNodeId: floorNode.id,
      floorName: floorNode.name,
      floorIndex: _parseFloorIndex(floorNode.name),
      progressPct: _avgProgress(activities),
      // ... etc
    );
  }
}
```

---

## 14. New Backend Endpoint (Recommended)

While the client-side aggregation works, a single optimized backend endpoint would be faster:

```
GET /planning/:projectId/tower-progress

Response:
{
  "towers": [
    {
      "epsNodeId": 410,
      "towerName": "Tower H",
      "floors": [
        {
          "epsNodeId": 411,
          "floorName": "GF",
          "floorIndex": 0,
          "progressPct": 100.0,
          "completedActivities": 28,
          "totalActivities": 28,
          "openQualityObs": 0,
          "openEhsObs": 0,
          "hasActiveWork": false
        },
        {
          "epsNodeId": 412,
          "floorName": "Floor 1",
          "floorIndex": 1,
          "progressPct": 87.5,
          ...
        }
      ]
    }
  ]
}
```

This avoids N×3 parallel calls (N floors × 3 API calls each) by computing the aggregation in a single SQL query with JOINs.

**Backend file:** `backend/src/planning/tower-progress.service.ts`
**Controller route:** `GET /planning/:projectId/tower-progress`

---

## 15. Implementation Phases

### Phase 1 — Core Renderer (Week 1)
**Goal:** A static 3D building renders with dummy data.

- [ ] Create `FloorProgress`, `TowerRenderModel`, `TowerViewMode` models
- [ ] Implement `IsometricBuildingPainter` with `paint()` method
  - [ ] `_computeFloorVertices()` — isometric math
  - [ ] `_drawSolidFloor()` — 3 faces with correct shading
  - [ ] `_drawGhostFloor()` — dashed wireframe
  - [ ] `_applyCameraTransform()` — scale + translate
- [ ] Build `TowerLensPage` scaffold with `CustomPaint` widget
- [ ] Verify rendering on Android + iOS with hardcoded 13-floor model

**Deliverable:** A beautiful isometric tower renders with dummy data

---

### Phase 2 — Data Integration (Week 2)
**Goal:** Real project data drives the tower visualization.

- [ ] Implement `TowerProgressRepository`
- [ ] Implement `TowerLensBloc` (Load, ViewMode, SelectFloor events)
- [ ] Wire to existing `SetuApiClient` (no new endpoints needed for V1)
- [ ] Add `TowerLensPage` to `ProjectDashboardPage` module grid
- [ ] Register `TowerLensBloc` in `main.dart`
- [ ] Connect to EPS tree from `ProjectBloc` (reuse already-loaded data)

**Deliverable:** Real floor progress data drives colors

---

### Phase 3 — Interactions & Gestures (Week 2–3)
**Goal:** Users can interact with the building.

- [ ] Implement `FloorHitArea` list + `onTapUp` hit testing
- [ ] Build `FloorDetailSheet` (DraggableScrollableSheet)
  - [ ] Activity breakdown list
  - [ ] Quality obs summary + navigation link
  - [ ] EHS summary + navigation link
- [ ] Horizontal drag → rotation parallax
- [ ] Pinch zoom → scale with clamp
- [ ] Double tap → reset camera
- [ ] Long press → tooltip with floor stats

**Deliverable:** Full interactive building — tap floors, zoom, rotate

---

### Phase 4 — Animations (Week 3)
**Goal:** The building feels alive.

- [ ] Build-up stacking animation (floors appear bottom → top on first open)
- [ ] Floor lift animation (selected floor rises 4px)
- [ ] View mode cross-fade (color transition on mode switch)
- [ ] Active floor pulse animation (blue dot on top face)
- [ ] Add `confetti` package and `FloorCompleted` state trigger

**Deliverable:** Delightful animated experience

---

### Phase 5 — Multi-Tower Site Map (Week 4)
**Goal:** Project-level overview showing all towers.

- [ ] Implement `ProjectSiteMapWidget` (grid of `TowerMiniCard` widgets)
- [ ] Each `TowerMiniCard` uses same `IsometricBuildingPainter` at small scale
- [ ] Navigation: tap tower card → full `TowerLensPage`
- [ ] Overall project progress bar across all towers
- [ ] Add as tab in `TowerLensPage` ("3D" | "Map" toggle)

**Deliverable:** Multi-tower project overview

---

### Phase 6 — Dashboard Integration (Week 4)
**Goal:** Tower Lens available from the project dashboard without navigation.

- [ ] `TowerMiniCard` widget added to `ProjectDashboardPage` header
- [ ] Shows the primary tower (or most-active tower)
- [ ] Tappable → opens full `TowerLensPage`
- [ ] Add permission `VIEW.TOWER_LENS` or reuse existing `canReadEhsDashboard`

**Deliverable:** Instant tower view on dashboard

---

### Phase 7 — Backend Optimization (After V1 Launch)
**Goal:** Replace N×3 API calls with 1 optimized endpoint.

- [ ] Backend: `TowerProgressService` with aggregate SQL
- [ ] Backend: `GET /planning/:projectId/tower-progress` controller
- [ ] Frontend: `SetuApiClient.getTowerProgress(projectId)`
- [ ] Update `TowerProgressRepository` to use single endpoint
- [ ] Add to `CachedTowerProgress` table in Drift (offline support)

**Deliverable:** Sub-200ms load time for tower progress

---

### Phase 8 — Progress Timeline Scrubber (Future)
**Goal:** Scrub through historical progress to see how the building grew.

- [ ] New API: `GET /planning/:projectId/tower-progress/history?weeks=12`
- [ ] `ProgressTimelineScrubber` horizontal slider widget
- [ ] Drag slider → cross-fade floor colors to historical state
- [ ] "Play" button → auto-advance week by week (construction time-lapse)

**Deliverable:** Construction time-lapse visualization

---

## 16. Files To Create (Complete List)

```
NEW FILES:
flutter/lib/features/tower_lens/
├── data/
│   ├── models/
│   │   ├── floor_progress.dart
│   │   ├── tower_render_model.dart
│   │   └── tower_view_mode.dart
│   └── repositories/
│       └── tower_progress_repository.dart
└── presentation/
    ├── bloc/
    │   └── tower_lens_bloc.dart
    ├── pages/
    │   └── tower_lens_page.dart
    └── widgets/
        ├── isometric_building_painter.dart  ← CORE ENGINE
        ├── floor_detail_sheet.dart
        ├── view_mode_switcher.dart
        ├── floor_legend_bar.dart
        ├── tower_mini_card.dart
        └── project_site_map.dart

MODIFIED FILES:
flutter/lib/main.dart                         ← Register TowerLensBloc
flutter/lib/features/projects/presentation/
  pages/project_dashboard_page.dart           ← Add Tower Lens tile + TowerMiniCard
flutter/lib/core/api/api_endpoints.dart       ← Add towerProgress endpoint
flutter/lib/core/api/setu_api_client.dart     ← Add getTowerProgress() method
flutter/pubspec.yaml                          ← Add confetti: ^0.7.0

BACKEND (new):
backend/src/planning/tower-progress.service.ts
backend/src/planning/tower-progress.controller.ts (route registered in planning.module.ts)
```

---

## 17. Performance Considerations

| Concern | Solution |
|---------|----------|
| Repainting on every frame | `IsometricBuildingPainter` uses `shouldRepaint()` with deep model equality check — only repaints when data or camera actually changes |
| N×3 API calls per tower | Batch parallel with `Future.wait()`; Phase 7 consolidates to 1 endpoint |
| 60fps animation with CustomPainter | Only `buildProgress`, `rotationAngle`, `scale`, `liftValue` are animated — painter is lightweight (no image assets, pure geometry) |
| Memory (large activity lists) | `FloorProgress` stores only counts, not full activity lists — detail is lazy-loaded in `FloorDetailSheet` on tap |
| First-open latency | Show `TowerLensLoading` skeleton (grey wireframe tower) while data loads — never blank screen |

---

## 18. Package Dependencies

```yaml
# Only ONE new package needed for confetti:
confetti: ^0.7.0

# Everything else uses existing packages:
# flutter_bloc  — state management (already present)
# dio           — HTTP (already present)
# CustomPainter — pure Flutter (no package)
# AnimationController — pure Flutter (no package)
```

---

## 19. Creative Future Extensions

### 19.1 AR Mode (Augmented Reality)
Using the device camera, overlay the 3D progress model on the actual building:
- `ar_flutter_plugin` or `ARKit` / `ARCore` bridge
- GPS + compass aligns the digital model to physical structure
- Site engineer points phone at building → sees completion % floating over each floor

### 19.2 "Blueprint Mode"
Dark theme toggle: render building as architect's blueprint lines (white on navy):
- All faces become transparent
- Only edges rendered in white
- Floor labels in white monospace font
- Gives a technical/professional feel for presentations

### 19.3 Construction Time-Lapse
"Play" button animates floors filling in week by week, showing how the project grew over time. Share as a GIF/video for stakeholder presentations.

### 19.4 Drone Photo Integration
Import site drone photos (common in Puravankara projects) and map them to the 3D model:
- Tap a floor → see the actual drone photo of that floor level
- Photo matched to floor index by GPS altitude or metadata tag

### 19.5 Snagging Heatmap
After handover, map snagging observations as a thermal heatmap overlay on the floor top face — red = many snags, green = clean floor.

---

## 20. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first 3D render | < 1.5 seconds |
| Tap-to-floor-detail response | < 300ms |
| Frames per second (animation) | ≥ 60 fps |
| New dependencies added | 1 (confetti only) |
| API calls for full tower load (Phase 1) | ≤ 15 (floors × parallel) |
| API calls for full tower load (Phase 7) | 1 |

---

*This plan uses only what Flutter's CustomPainter, AnimationController, and GestureDetector natively provide — no 3D engines, no WebViews, no licensing. The result will be a snappy, offline-capable, visually striking feature that differentiates SETU from any other construction management app in India.*
