# Mobile Quality Module & EHS Site Observation — Implementation Plan
**Module:** Flutter Mobile App
**Status:** Not Started
**Platform:** Flutter (BLoC + Drift + SetuApiClient)
**Covers:** Quality Inspection Workflow completion + Quality Site Obs + EHS Site Observation

---

## 1. CURRENT STATE SUMMARY

| Sub-module | Backend | Flutter |
|---|---|---|
| Quality RFI (raise) | ✅ Full | ✅ Done |
| Quality Activity observations | ✅ Full | ✅ Done |
| Quality Inspection approval workflow | ✅ Full | ⚠️ Bloc exists, UI incomplete |
| Quality Site Observations | ✅ Full | ❌ Not started |
| EHS Site Observations | ✅ Full | ❌ Not started |
| EHS Incidents / Training / etc. | ✅ Full | ❌ Not started (out of scope here) |

**This plan covers:**
- Part A — Permission Service (shared foundation)
- Part B — Quality Inspection Workflow (complete the gaps)
- Part C — Quality Site Observations (new)
- Part D — EHS Site Observations (new, full feature)
- Part E — Shared Widgets (observation card, raise sheet, rectify sheet)
- Part F — Navigation & Entry Points
- Part G — Offline Strategy
- Part H — File & DI change summary

---

## 2. ARCHITECTURE PRINCIPLES

### 2.1 Permission-Driven UI
Every action button is gated by a permission check. No permission → button hidden (not just disabled). This prevents role confusion on shared devices.

```dart
// PermissionService — singleton, loaded once at login
class PermissionService {
  final Set<String> _permissions;

  bool can(String permission) => _permissions.contains(permission);

  // Convenience shortcuts
  bool get canRaiseRfi         => can('QUALITY.INSPECTION.RAISE');
  bool get canApproveInspection => can('QUALITY.INSPECTION.APPROVE');
  bool get canStageApprove     => can('QUALITY.INSPECTION.STAGE_APPROVE');
  bool get canFinalApprove     => can('QUALITY.INSPECTION.FINAL_APPROVE');
  bool get canReverseRfi       => can('QUALITY.INSPECTION.REVERSE');
  bool get canCreateQualityObs => can('QUALITY.SITE_OBS.CREATE');
  bool get canRectifyQualityObs => can('QUALITY.SITE_OBS.RECTIFY');
  bool get canCloseQualityObs  => can('QUALITY.SITE_OBS.CLOSE');
  bool get canCreateEhsObs     => can('EHS.SITE_OBS.CREATE');
  bool get canRectifyEhsObs    => can('EHS.SITE_OBS.RECTIFY');
  bool get canCloseEhsObs      => can('EHS.SITE_OBS.CLOSE');
}
```

Permissions are fetched from the JWT payload or `/auth/me` at login and stored in the service locator.

### 2.2 Offline-First Strategy
| Operation | Offline Behavior |
|---|---|
| Load lists | Show cached data + LinearProgressIndicator overlay when refreshing |
| Create observation | Queue in SyncService → show optimistic UI |
| Rectify / Close | Queue in SyncService → update local Drift record |
| Advance workflow | **Online required** — workflow steps need server-side state; show "Connect to network" if offline |
| Stage approve | **Online required** — same reason |

### 2.3 Photo Handling
Use existing `PhotoCompressor` + `SetuPhotoCacheManager` pattern. Photos are uploaded directly via `SetuApiClient.uploadFile()` — not through the BLoC — to avoid shared state pollution.

### 2.4 Smart UX Rules
- **Contextual action buttons** — what a user sees depends on both permission AND the current inspection/observation state
- **Empty state intelligence** — if list is empty but user has CREATE permission, show a CTA button; if no permission, show "No records" only
- **Loading states** — use `QrLoadingSource` enum pattern (existing): `listLoad | actionLoad | refresh` — never show full-screen spinner for background refreshes

---

## 3. PART A — PERMISSION SERVICE

### 3.1 Create `lib/core/auth/permission_service.dart`

```dart
class PermissionService {
  final Set<String> _permissions;

  PermissionService({required List<String> permissions})
      : _permissions = permissions.toSet();

  bool can(String permission) => _permissions.contains(permission);
}
```

### 3.2 Register in service locator (`lib/core/di/injection_container.dart`)

```dart
// After login / token decode, build PermissionService:
sl.registerSingleton<PermissionService>(
  PermissionService(permissions: decodedJwt['permissions'] as List<String>),
);
```

### 3.3 API: Fetch permissions if not in JWT

If the JWT doesn't embed permissions, add a call to `GET /auth/me` after login and store the returned `permissions[]` list.

Add to `SetuApiClient`:
```dart
Future<List<String>> getMyPermissions() async {
  final response = await _dio.get('/auth/me');
  return List<String>.from(response.data['permissions'] ?? []);
}
```

---

## 4. PART B — QUALITY INSPECTION WORKFLOW (Complete the gaps)

The `QualityApprovalBloc` exists but the UI pages are incomplete. Complete the following:

### 4.1 Inspection List Page (`quality_approvals_page.dart`)

**Current state:** exists but basic.

**Add:**
- **Tab bar:** `All | Pending My Action | Approved | Rejected`
  - "Pending My Action" calls `GET /quality/inspections/my-pending`
  - "All" calls `GET /quality/inspections?projectId=X`
- **Filter chips:** by Activity Type, by Contractor/Vendor, by EPS location
- **Permission gate:** If `!canApproveInspection && !canStageApprove`, hide the approvals tab entirely from navigation
- **Smart empty state:**
  ```
  [No pending inspections]
  All inspections are up to date ✅
  ```

**Inspection Card** shows:
```
[CL-QA-08C]  Beam & Slab Concreting               Rev 01
  📍 Tower A → Floor 3 → Unit 301
  🏗 Contractor: ABC Builders  Vendor: XYZ Corp
  ─────────────────────────────────────────────────
  Status: [AWAITING_APPROVAL] ● Stage 2 of 3
  Raised: 11 Mar 2026  Part 1 of 2
                              [View Details →]
```

Fields: `checklistNo`, `activityTitle`, `partDisplay` (shows "Part 1 of 2" if `isMultiPart`), location from EPS, `vendorName`, status badge, workflow progress.

### 4.2 Inspection Detail Page (`inspection_detail_page.dart`)

**Sections:**

#### Section 1 — Header Info Card
```
Checklist No:  CL-QA-08C        Rev:    01
Activity:      CONCRETING        Drawing: GFC-001
Location:      Tower A / Floor 3 / Unit 301
Contractor:    ABC Builders      Vendor: XYZ
Raised by:     Site Engineer     Date: 11 Mar 2026
Part:          1 of 2
```

#### Section 2 — Workflow Timeline
Visual stepper showing workflow steps (use `InspectionWorkflowStep` list from `GET /quality/inspections/:id/workflow`):

```
✅ Step 1: Site Engineer        Approved  10 Mar
✅ Step 2: QC Engineer          Approved  11 Mar
🔵 Step 3: QA & PE              Pending ← YOU ARE HERE
○  Step 4: Project Manager      Waiting
```

- Current user's pending step is highlighted in blue
- Past steps show approver name + date
- Future steps show role only

Permission gate on action buttons:
```dart
// Only show Approve/Reject if it's the current user's step
final isMyStep = currentWorkflowStep.assignedUserId == sl<AuthService>().currentUserId;
final canAct = sl<PermissionService>().canApproveInspection && isMyStep;
```

#### Section 3 — Checklist Stages (accordion)

Each stage is an expandable card:
```
▼ PRE-EXECUTION CHECKS   (13 items)   [APPROVED ✅]
  ┌─────────────────────────────────────────────┐
  │ 1  GFC Drawing available?        [✅ YES]   │
  │ 2  Work method statement ready?  [✅ YES]   │
  │ 3  Materials tested & approved?  [✅ YES]   │
  │ ...                                         │
  └─────────────────────────────────────────────┘

▼ CHECKS DURING EXECUTION  (10 items)  [PENDING 🔵]
  ├─ Tap item to change status (if canStageApprove)
  └─ Each item: YES / NA / Remarks button
```

Stage-level action (if `canStageApprove`):
```
[Approve Stage ✅]  [Add Remark]
```

#### Section 4 — Observations Panel (collapsible)

Shows existing observations on this inspection's activity. If `canCreateQualityObs`, shows `[+ Raise Observation]` button that opens `RaiseObservationSheet`.

#### Section 5 — Action Bar (bottom fixed)

```dart
// Logic tree for action bar:
if (inspection.status == 'AWAITING_APPROVAL' && canAct) {
  // Show: [Reject] [Approve with Signature]
} else if (inspection.status == 'AWAITING_FINAL_APPROVAL' && canFinalApprove) {
  // Show: [Reject] [Final Approve]
} else if (inspection.status == 'APPROVED' && canReverseRfi) {
  // Show: [Reverse Approval]
} else {
  // No actions — view only
}
```

Approve button opens `SignatureApprovalSheet` (existing widget) → calls `advanceWorkflowStep()`.

### 4.3 Checklist Item Tile (`checklist_item_tile.dart`)

**Add:**
- Tap-to-cycle status: `PENDING → PASS → NA → PENDING`
- Long-press → add remark (text dialog)
- Photo icon if `photoRequired == true` — tapping opens camera
- `isEditable` flag (false if stage is already approved or user lacks `canStageApprove`)

```dart
class ChecklistItemTile extends StatelessWidget {
  final ChecklistItem item;
  final bool isEditable;
  final ValueChanged<ChecklistItemStatus>? onStatusChanged;
  final ValueChanged<String>? onRemarkChanged;
  final VoidCallback? onPhotoTap;
  // ...
}
```

### 4.4 Signature Approval Sheet (existing — verify complete)

Must support:
- Free-hand signature pad (`signature` package)
- `signedBy` name input (pre-filled from current user)
- `comments` optional text
- "Submit" calls `advanceWorkflowStep()` or `finalApprove()`
- Permission check before showing

### 4.5 Delegate Workflow Sheet (new)

When `canApproveInspection` but user wants to delegate:
- User picker (list of project members with the required role)
- Comment field
- Calls `POST /quality/inspections/:id/workflow/delegate`

### 4.6 New BLoC Events to Add

Add to `QualityApprovalBloc`:
```dart
// New events:
class LoadMyPendingInspections extends QualityApprovalEvent {
  final int projectId;
}
class ApproveStage extends QualityApprovalEvent {
  final int inspectionId;
  final int stageId;
  final String? comments;
}
class FinalApproveInspection extends QualityApprovalEvent {
  final int inspectionId;
  final String? signatureData;
  final String? signedBy;
  final String? comments;
}
class DelegateWorkflowStep extends QualityApprovalEvent {
  final int inspectionId;
  final int delegateUserId;
  final String? comments;
}
class ReverseInspectionApproval extends QualityApprovalEvent {
  final int inspectionId;
  final String reason;
}

// New states:
class MyPendingInspectionsLoaded extends QualityApprovalState {
  final List<QualityInspection> inspections;
}
class StageApproved extends QualityApprovalState { final int stageId; }
class InspectionFinalApproved extends QualityApprovalState { final int inspectionId; }
class WorkflowDelegated extends QualityApprovalState {}
class InspectionReversed extends QualityApprovalState {}
```

### 4.7 New API Client Methods

Add to `SetuApiClient`:
```dart
Future<List<QualityInspection>> getMyPendingInspections(int projectId) async {
  final r = await _dio.get('/quality/inspections/my-pending',
    queryParameters: {'projectId': projectId});
  return (r.data as List).map(QualityInspection.fromJson).toList();
}

Future<void> approveInspectionStage({
  required int inspectionId,
  required int stageId,
  String? comments,
}) async {
  await _dio.post('/quality/inspections/$inspectionId/stages/$stageId/approve',
    data: {'comments': comments});
}

Future<void> finalApproveInspection({
  required int inspectionId,
  String? signatureData,
  String? signedBy,
  String? comments,
}) async {
  await _dio.post('/quality/inspections/$inspectionId/final-approve',
    data: {'signatureData': signatureData, 'signedBy': signedBy, 'comments': comments});
}

Future<void> delegateWorkflowStep({
  required int inspectionId,
  required int delegateUserId,
  String? comments,
}) async {
  await _dio.post('/quality/inspections/$inspectionId/workflow/delegate',
    data: {'delegateUserId': delegateUserId, 'comments': comments});
}

Future<void> reverseInspectionApproval({
  required int inspectionId,
  required String reason,
}) async {
  await _dio.post('/quality/inspections/$inspectionId/workflow/reverse',
    data: {'reason': reason});
}
```

---

## 5. PART C — QUALITY SITE OBSERVATIONS

### 5.1 Model: `QualitySiteObservation`

Add to `quality_models.dart`:

```dart
enum SiteObsSeverity { low, medium, high, critical }
enum SiteObsStatus { open, rectified, closed }

class QualitySiteObservation extends Equatable {
  final int id;
  final int projectId;
  final int? epsNodeId;
  final String description;
  final SiteObsSeverity severity;
  final SiteObsStatus status;
  final String? category;
  final List<String> photoUrls;
  final String raisedByName;
  final DateTime raisedAt;
  final String? rectificationNotes;
  final List<String> rectificationPhotoUrls;
  final DateTime? rectifiedAt;
  final String? closureNotes;
  final DateTime? closedAt;

  // fromJson / toJson
  factory QualitySiteObservation.fromJson(Map<String, dynamic> json) { ... }
}
```

### 5.2 BLoC: `QualitySiteObsBloc`

**File:** `lib/features/quality/presentation/bloc/quality_site_obs_bloc.dart`

```dart
// Events
class LoadQualitySiteObs extends QualitySiteObsEvent {
  final int projectId;
  final SiteObsStatus? statusFilter;
  final SiteObsSeverity? severityFilter;
}
class CreateQualitySiteObs extends QualitySiteObsEvent {
  final int projectId;
  final int? epsNodeId;
  final String description;
  final SiteObsSeverity severity;
  final String? category;
  final List<String> photoUrls;  // already uploaded URLs
}
class RectifyQualitySiteObs extends QualitySiteObsEvent {
  final int observationId;
  final String notes;
  final List<String> photoUrls;
}
class CloseQualitySiteObs extends QualitySiteObsEvent {
  final int observationId;
  final String? closureNotes;
}
class RefreshQualitySiteObs extends QualitySiteObsEvent {}

// States
class QualitySiteObsInitial extends QualitySiteObsState {}
class QualitySiteObsLoading extends QualitySiteObsState {
  final bool isRefresh; // true = show overlay, false = full screen
}
class QualitySiteObsLoaded extends QualitySiteObsState {
  final List<QualitySiteObservation> observations;
  final SiteObsStatus? activeFilter;
}
class QualitySiteObsActionSuccess extends QualitySiteObsState {
  final String message; // "Observation raised", "Rectification submitted", "Closed"
}
class QualitySiteObsError extends QualitySiteObsState {
  final String message;
}
```

**Handler logic:**
- `LoadQualitySiteObs` → `GET /quality/site-observations?projectId=X&status=Y`
- `CreateQualitySiteObs` → Queue in SyncService (offline-first) → optimistic add to local list
- `RectifyQualitySiteObs` → Queue in SyncService → update local record
- `CloseQualitySiteObs` → Queue in SyncService → update local record

### 5.3 API Methods (add to `SetuApiClient`)

```dart
Future<List<QualitySiteObservation>> getQualitySiteObs({
  required int projectId,
  String? status,
  String? severity,
}) async {
  final r = await _dio.get('/quality/site-observations',
    queryParameters: {'projectId': projectId, 'status': status, 'severity': severity}
      ..removeWhere((k, v) => v == null));
  return (r.data as List).map(QualitySiteObservation.fromJson).toList();
}

Future<QualitySiteObservation> createQualitySiteObs({
  required int projectId,
  int? epsNodeId,
  required String description,
  required String severity,
  String? category,
  List<String>? photoUrls,
}) async {
  final r = await _dio.post('/quality/site-observations', data: {
    'projectId': projectId,
    'epsNodeId': epsNodeId,
    'description': description,
    'severity': severity,
    'category': category,
    'photoUrls': photoUrls,
  });
  return QualitySiteObservation.fromJson(r.data);
}

Future<void> rectifyQualitySiteObs({
  required int id,
  required String notes,
  List<String>? photoUrls,
}) async {
  await _dio.patch('/quality/site-observations/$id/rectify',
    data: {'notes': notes, 'photoUrls': photoUrls});
}

Future<void> closeQualitySiteObs({required int id, String? closureNotes}) async {
  await _dio.patch('/quality/site-observations/$id/close',
    data: {'closureNotes': closureNotes});
}
```

### 5.4 Page: `QualitySiteObsPage`

```
┌──────────────────────────────────────────────────┐
│  ← Site Observations           [🔍] [+ Raise]   │
│  ──────────────────────────────────────────────  │
│  [All] [Open] [Rectified] [Closed]               │
│  ──────────────────────────────────────────────  │
│  🔴 HIGH  Improper curing on slab         OPEN   │
│     📍 Tower A / Floor 3                         │
│     Raised: 11 Mar 2026  by: Site Eng.           │
│     ──────────────────────────────────────────   │
│  🟡 MED   Shuttering not cleaned          OPEN   │
│     📍 Tower B / Floor 1                         │
│  ──────────────────────────────────────────────  │
│  🟢 LOW   Housekeeping pending           CLOSED  │
│     📍 Tower A / Floor 2                         │
└──────────────────────────────────────────────────┘
```

- `[+ Raise]` visible only if `canCreateQualityObs`
- Status filter tabs with count badges
- Tapping a card opens `SiteObsDetailPage`

### 5.5 Detail Page: `QualitySiteObsDetailPage`

```
Severity badge  [🔴 HIGH]                 Status: [OPEN]
Description:    Improper curing on slab post-pour — hessian cloth missing
Location:       Tower A / Floor 3 / Unit 301
Raised by:      Site Engineer  •  11 Mar 2026
Photos:         [📷][📷][📷]

─────────────────────────────────────────────────
RECTIFICATION
  [Submit Rectification]  ← visible if OPEN and canRectifyQualityObs
─────────────────────────────────────────────────
CLOSURE
  [Close Observation]  ← visible if RECTIFIED and canCloseQualityObs
```

---

## 6. PART D — EHS SITE OBSERVATIONS (New Feature)

### 6.1 Feature Folder Structure

```
lib/features/ehs/
├── data/
│   └── models/
│       └── ehs_models.dart           ← EhsSiteObservation model + enums
├── presentation/
│   ├── bloc/
│   │   └── ehs_site_obs_bloc.dart    ← BLoC (events/states/handlers)
│   ├── pages/
│   │   ├── ehs_site_obs_page.dart    ← Main list page
│   │   └── ehs_site_obs_detail_page.dart
│   └── widgets/
│       └── ehs_obs_card.dart         ← Uses shared SiteObsCard widget
```

### 6.2 Model: `EhsSiteObservation`

**File:** `lib/features/ehs/data/models/ehs_models.dart`

```dart
enum EhsObsSeverity { low, medium, high, critical }
enum EhsObsStatus   { open, rectified, closed }
enum EhsObsCategory {
  ppe,          // Personal Protective Equipment
  housekeeping,
  scaffolding,
  machinery,
  electrical,
  fire,
  environmental,
  other
}

class EhsSiteObservation extends Equatable {
  final int id;
  final int projectId;
  final int? epsNodeId;
  final String description;
  final EhsObsSeverity severity;
  final EhsObsStatus status;
  final EhsObsCategory? category;
  final List<String> photoUrls;
  final String raisedByName;
  final DateTime raisedAt;
  final String? rectificationNotes;
  final List<String> rectificationPhotoUrls;
  final DateTime? rectifiedAt;
  final String? closureNotes;
  final DateTime? closedAt;

  factory EhsSiteObservation.fromJson(Map<String, dynamic> json) { ... }

  Color get severityColor => switch (severity) {
    EhsObsSeverity.critical => Colors.red[900]!,
    EhsObsSeverity.high     => Colors.red,
    EhsObsSeverity.medium   => Colors.orange,
    EhsObsSeverity.low      => Colors.green,
  };

  IconData get categoryIcon => switch (category) {
    EhsObsCategory.ppe          => Icons.safety_check,
    EhsObsCategory.fire         => Icons.local_fire_department,
    EhsObsCategory.machinery    => Icons.precision_manufacturing,
    EhsObsCategory.electrical   => Icons.electrical_services,
    EhsObsCategory.scaffolding  => Icons.foundation,
    _                           => Icons.warning_amber,
  };
}
```

### 6.3 BLoC: `EhsSiteObsBloc`

**File:** `lib/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart`

```dart
// Events
class LoadEhsSiteObs extends EhsSiteObsEvent {
  final int projectId;
  final EhsObsStatus? statusFilter;
  final EhsObsSeverity? severityFilter;
}
class CreateEhsSiteObs extends EhsSiteObsEvent {
  final int projectId;
  final int? epsNodeId;
  final String description;
  final EhsObsSeverity severity;
  final EhsObsCategory? category;
  final List<String> photoUrls;
}
class RectifyEhsSiteObs extends EhsSiteObsEvent {
  final int observationId;
  final String notes;
  final List<String> photoUrls;
}
class CloseEhsSiteObs extends EhsSiteObsEvent {
  final int observationId;
  final String? closureNotes;
}
class RefreshEhsSiteObs extends EhsSiteObsEvent {}

// States — mirror QualitySiteObsBloc pattern
class EhsSiteObsInitial extends EhsSiteObsState {}
class EhsSiteObsLoading extends EhsSiteObsState { final bool isRefresh; }
class EhsSiteObsLoaded extends EhsSiteObsState {
  final List<EhsSiteObservation> observations;
  final EhsObsStatus? activeFilter;
}
class EhsSiteObsActionSuccess extends EhsSiteObsState { final String message; }
class EhsSiteObsError extends EhsSiteObsState { final String message; }
```

**Handler notes:**
- `LoadEhsSiteObs` → 5-second timeout → fall back to Drift cache → `EhsSiteObsLoaded`
- `CreateEhsSiteObs` → Online? Direct API call → add to Drift → emit success. Offline? Queue → emit success with "will sync" indicator
- `RectifyEhsSiteObs` / `CloseEhsSiteObs` → same offline-first pattern

### 6.4 API Methods (add to `SetuApiClient`)

```dart
Future<List<EhsSiteObservation>> getEhsSiteObs({
  required int projectId,
  String? status,
  String? severity,
}) async {
  final r = await _dio.get('/ehs/site-observations',
    queryParameters: {'projectId': projectId, 'status': status, 'severity': severity}
      ..removeWhere((k, v) => v == null));
  return (r.data as List).map(EhsSiteObservation.fromJson).toList();
}

Future<EhsSiteObservation> createEhsSiteObs({
  required int projectId,
  int? epsNodeId,
  required String description,
  required String severity,
  String? category,
  List<String>? photoUrls,
}) async {
  final r = await _dio.post('/ehs/site-observations', data: {
    'projectId': projectId,
    'epsNodeId': epsNodeId,
    'description': description,
    'severity': severity,
    'category': category,
    'photoUrls': photoUrls,
  });
  return EhsSiteObservation.fromJson(r.data);
}

Future<void> rectifyEhsSiteObs({
  required int id,
  required String notes,
  List<String>? photoUrls,
}) async {
  await _dio.patch('/ehs/site-observations/$id/rectify',
    data: {'notes': notes, 'photoUrls': photoUrls});
}

Future<void> closeEhsSiteObs({required int id, String? closureNotes}) async {
  await _dio.patch('/ehs/site-observations/$id/close',
    data: {'closureNotes': closureNotes});
}
```

### 6.5 API Endpoints (add to `api_endpoints.dart`)

```dart
// EHS Site Observations
static const String ehsSiteObservations = '/ehs/site-observations';
static String ehsSiteObservation(int id) => '/ehs/site-observations/$id';
static String rectifyEhsObs(int id) => '/ehs/site-observations/$id/rectify';
static String closeEhsObs(int id) => '/ehs/site-observations/$id/close';
```

### 6.6 Pages

#### `EhsSiteObsPage` — List

```
┌──────────────────────────────────────────────────┐
│  ← EHS Site Observations       [🔍] [+ Raise]   │
│  ──────────────────────────────────────────────  │
│  [All] [Open] [Rectified] [Closed]               │
│                                                  │
│  🔴 CRITICAL  No safety harness at height  OPEN  │
│     🏗 Scaffolding  📍 Tower A / Floor 8          │
│     11 Mar 2026 · Site Safety Officer            │
│  ──────────────────────────────────────────────  │
│  🟡 HIGH  PPE not worn at concreting point  OPEN │
│     🦺 PPE  📍 Tower B / Floor 2                 │
│  ──────────────────────────────────────────────  │
│  🟢 LOW   Housekeeping issue              CLOSED │
└──────────────────────────────────────────────────┘
```

Permission gates:
- `[+ Raise]` → `canCreateEhsObs`
- Rectify button on card → `canRectifyEhsObs`
- Close button on detail → `canCloseEhsObs`

#### `EhsSiteObsDetailPage`

```
Category:   🦺 PPE                  Severity: [🔴 HIGH]
Status:     OPEN
─────────────────────────────────────────────────────
Description:
  Concreting workers observed without safety helmets
  and high-visibility vests at grid C3-C5.

Location:   Tower B / Floor 2
Raised by:  Safety Officer · 11 Mar 2026
Photos:     [📷][📷]  [View all 3]

─────────────────────────────────────────────────────
[Submit Rectification]   ← if OPEN + canRectifyEhsObs
─────────────────────────────────────────────────────

RECTIFICATION HISTORY (if rectified)
  Notes:   Safety briefing conducted. PPE distributed.
  Photos:  [📷]
  By:      Site Supervisor · 12 Mar 2026

─────────────────────────────────────────────────────
[Close Observation]   ← if RECTIFIED + canCloseEhsObs
```

---

## 7. PART E — SHARED WIDGETS

Both Quality and EHS site observations share the same UI patterns. Build shared widgets that accept a generic interface.

### 7.1 `SiteObsCard` (shared)

**File:** `lib/shared/widgets/site_obs_card.dart`

```dart
class SiteObsCard extends StatelessWidget {
  final String description;
  final String severity;           // 'low' | 'medium' | 'high' | 'critical'
  final String status;             // 'open' | 'rectified' | 'closed'
  final String? category;
  final String? locationLabel;     // "Tower A / Floor 3"
  final String raisedByName;
  final DateTime raisedAt;
  final VoidCallback onTap;
  final Widget? trailingAction;    // optional action button
}
```

### 7.2 `RaiseObservationSheet` (shared, enhanced)

**File:** `lib/shared/widgets/raise_observation_sheet.dart`

Existing widget for quality activity observations. Enhance to be generic:

```dart
class RaiseObservationSheet extends StatefulWidget {
  final String title;                    // "Raise Quality Observation" or "Raise EHS Observation"
  final List<String> categoryOptions;    // passed in — differs by module
  final List<String> severityOptions;    // ['Low', 'Medium', 'High', 'Critical']
  final bool showEpsLocation;            // EHS: yes (pick location), Quality: no (inherited from activity)
  final int? projectId;
  final Future<void> Function({
    required String description,
    required String severity,
    String? category,
    int? epsNodeId,
    List<String> photoUrls,
  }) onSubmit;
}
```

**Form fields:**
1. Description (multi-line, required)
2. Severity (chip selector: Low / Medium / High / Critical — colored)
3. Category (dropdown — module-specific options)
4. Location (EPS node picker — shown only if `showEpsLocation: true`)
5. Photos (up to 5, compressed via `PhotoCompressor` before upload)

Photo upload flow:
```
User taps [📷 Add Photo]
  → Image picker (camera or gallery)
  → PhotoCompressor.compress()
  → SetuApiClient.uploadFile()  ← direct call, not via bloc
  → Store returned URL in local list
  → Show thumbnail in form
OnSubmit: pass URL list to onSubmit callback
```

### 7.3 `RectifySheet` (shared)

**File:** `lib/shared/widgets/rectify_sheet.dart`

```dart
class RectifySheet extends StatefulWidget {
  final String title;                    // "Submit Rectification"
  final Future<void> Function({
    required String notes,
    List<String> photoUrls,
  }) onSubmit;
}
```

**Form fields:**
1. Rectification notes (multi-line, required)
2. Evidence photos (up to 5)

### 7.4 `SeverityBadge` (shared)

```dart
class SeverityBadge extends StatelessWidget {
  final String severity; // 'low' | 'medium' | 'high' | 'critical'
  // Renders: pill with colored background and text
}
```

### 7.5 `ObsStatusBadge` (shared)

```dart
class ObsStatusBadge extends StatelessWidget {
  final String status; // 'open' | 'rectified' | 'closed'
  // OPEN → blue, RECTIFIED → orange, CLOSED → green
}
```

---

## 8. PART F — NAVIGATION & ENTRY POINTS

### 8.1 Bottom Navigation / App Shell

The app shell currently has tabs for: Projects, Progress, Quality, Sync.

Add **EHS** tab (visible only if user has any `EHS.*` permission):

```dart
// In app shell:
final hasEhsAccess = sl<PermissionService>().can('EHS.SITE_OBS.READ') ||
                     sl<PermissionService>().can('EHS.DASHBOARD.READ');
```

### 8.2 Quality Module — Tab Structure

Inside Quality section, add a **tab bar** (or bottom sheet menu):

```
Quality
├── [RFI / Raise]      ← existing QualityRequestPage
├── [Inspections]      ← existing + enhanced QualityApprovalsPage
├── [Site Obs]         ← new QualitySiteObsPage (QUALITY.SITE_OBS.READ)
└── [Reports]          ← future (out of scope)
```

Each tab is hidden if user lacks the minimum read permission.

### 8.3 EHS Module — Tab Structure

```
EHS
├── [Site Obs]         ← new EhsSiteObsPage (EHS.SITE_OBS.READ)
└── [Dashboard]        ← future (out of scope)
```

### 8.4 Deep Link: Observation from Inspection

On the Inspection Detail page, tapping `[+ Raise Observation]` opens `RaiseObservationSheet` pre-configured for Quality context (no EPS picker since location is inherited from the activity).

---

## 9. PART G — OFFLINE STRATEGY (DETAIL)

### 9.1 Drift Schema Additions

Add to `lib/core/database/app_database.dart`:

```dart
// Quality Site Observations cache table
class QualitySiteObsCache extends Table {
  IntColumn get id => integer()();
  IntColumn get projectId => integer()();
  IntColumn get epsNodeId => integer().nullable()();
  TextColumn get rawJson => text()();  // full JSON blob
  TextColumn get status => text()();   // for filter queries
  TextColumn get severity => text()();
  DateTimeColumn get raisedAt => dateTime()();
  BoolColumn get pendingSync => boolean().withDefault(const Constant(false))();
}

// EHS Site Observations cache table
class EhsSiteObsCache extends Table {
  IntColumn get id => integer()();
  IntColumn get projectId => integer()();
  IntColumn get epsNodeId => integer().nullable()();
  TextColumn get rawJson => text()();
  TextColumn get status => text()();
  TextColumn get severity => text()();
  TextColumn get category => text().nullable()();
  DateTimeColumn get raisedAt => dateTime()();
  BoolColumn get pendingSync => boolean().withDefault(const Constant(false))();
}
```

### 9.2 Sync Queue Entry Types

Add to `SyncService` entry type enum:
```dart
enum SyncEntryType {
  // existing...
  qualitySiteObsCreate,
  qualitySiteObsRectify,
  qualitySiteObsClose,
  ehsSiteObsCreate,
  ehsSiteObsRectify,
  ehsSiteObsClose,
}
```

### 9.3 Online-Required Operations

These operations CANNOT be queued offline. Show a `SnackBar` when attempted offline:

> "Inspection approval requires an active connection. Please connect and try again."

- Advance workflow step
- Stage approve
- Final approve
- Delegate workflow

---

## 10. PART H — DI REGISTRATION

All new BLoCs must be registered in the service locator.

### 10.1 Quality BLoC registrations

```dart
// Existing (verify SetuApiClient is already a 3rd param):
sl.registerFactory(() => QualityApprovalBloc(
  apiClient: sl<SetuApiClient>(),
  database: sl<AppDatabase>(),
));

// New:
sl.registerFactory(() => QualitySiteObsBloc(
  apiClient: sl<SetuApiClient>(),
  database: sl<AppDatabase>(),
  syncService: sl<SyncService>(),
));
```

### 10.2 EHS BLoC registrations

```dart
sl.registerFactory(() => EhsSiteObsBloc(
  apiClient: sl<SetuApiClient>(),
  database: sl<AppDatabase>(),
  syncService: sl<SyncService>(),
));
```

### 10.3 Permission Service registration

```dart
// After login, rebuild the locator with user's permissions:
sl.registerSingleton<PermissionService>(
  PermissionService(permissions: userPermissions),
);
```

---

## 11. FILE CHANGE SUMMARY

### New Files

| File | Purpose |
|------|---------|
| `lib/core/auth/permission_service.dart` | Permission check singleton |
| `lib/features/quality/presentation/bloc/quality_site_obs_bloc.dart` | Quality site obs BLoC |
| `lib/features/quality/presentation/pages/quality_site_obs_page.dart` | Quality site obs list |
| `lib/features/quality/presentation/pages/quality_site_obs_detail_page.dart` | Detail + action |
| `lib/features/ehs/data/models/ehs_models.dart` | EHS observation model + enums |
| `lib/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart` | EHS site obs BLoC |
| `lib/features/ehs/presentation/pages/ehs_site_obs_page.dart` | EHS site obs list |
| `lib/features/ehs/presentation/pages/ehs_site_obs_detail_page.dart` | EHS detail + action |
| `lib/features/ehs/presentation/widgets/ehs_obs_card.dart` | EHS-specific card (wraps SiteObsCard) |
| `lib/shared/widgets/site_obs_card.dart` | Shared observation card |
| `lib/shared/widgets/raise_observation_sheet.dart` | Shared raise observation sheet (enhanced) |
| `lib/shared/widgets/rectify_sheet.dart` | Shared rectification sheet |
| `lib/shared/widgets/severity_badge.dart` | Severity pill widget |
| `lib/shared/widgets/obs_status_badge.dart` | Status pill widget |

### Modified Files

| File | Change |
|------|--------|
| `lib/features/quality/data/models/quality_models.dart` | Add `QualitySiteObservation`, `SiteObsSeverity`, `SiteObsStatus` |
| `lib/features/quality/presentation/bloc/quality_approval_bloc.dart` | Add 5 new events + states + handlers |
| `lib/features/quality/presentation/pages/quality_approvals_page.dart` | Add tabs, filters, permission gates |
| `lib/features/quality/presentation/pages/inspection_detail_page.dart` | Add workflow stepper, action bar, delegate sheet |
| `lib/features/quality/presentation/widgets/checklist_item_tile.dart` | Add tap-to-cycle, long-press remark, photo |
| `lib/core/api/setu_api_client.dart` | Add 10 new methods (quality site obs, EHS site obs, workflow) |
| `lib/core/api/api_endpoints.dart` | Add EHS site obs endpoint constants |
| `lib/core/database/app_database.dart` | Add 2 new cache tables |
| `lib/core/di/injection_container.dart` | Register PermissionService + new BLoCs |
| App shell / navigation | Add EHS tab, Quality sub-tabs |

---

## 12. IMPLEMENTATION ORDER

```
Week 1: Foundation
  ├─ PermissionService (create + DI register + login integration)
  ├─ Shared widget library (SiteObsCard, RaiseObservationSheet, RectifySheet, badges)
  └─ Drift schema additions (QualitySiteObsCache, EhsSiteObsCache)

Week 2: Quality Inspection Workflow (Complete)
  ├─ QualityApprovalBloc — add 5 new events/states/handlers
  ├─ InspectionDetailPage — workflow stepper + action bar
  ├─ ChecklistItemTile — tap-to-cycle + remark
  ├─ SignatureApprovalSheet — verify/fix
  ├─ DelegateWorkflowSheet (new)
  └─ MyPendingInspections tab on ApprovalsPage

Week 3: Quality Site Observations
  ├─ QualitySiteObservation model
  ├─ QualitySiteObsBloc + handlers
  ├─ SetuApiClient — quality obs methods
  ├─ QualitySiteObsPage (list + filters + permission gates)
  └─ QualitySiteObsDetailPage (rectify + close actions)

Week 4: EHS Site Observations
  ├─ EhsSiteObservation model + enums
  ├─ EhsSiteObsBloc + handlers
  ├─ SetuApiClient — EHS obs methods
  ├─ api_endpoints.dart — EHS constants
  ├─ EhsSiteObsPage + EhsSiteObsDetailPage
  └─ App shell — EHS tab + navigation

Week 5: Testing & Polish
  ├─ Permission edge cases (no-permission empty states, hidden buttons)
  ├─ Offline queue testing (create obs offline → sync → verify server)
  ├─ Photo upload flow (compress → upload → embed URL)
  ├─ Multi-part RFI display (partDisplay on inspection cards)
  └─ End-to-end: raise obs → rectify → close (both modules)
```

---

## 13. ACCEPTANCE CRITERIA

### Permission-Driven UI
- [ ] User with only `QUALITY.INSPECTION.READ` sees inspection list but no approve buttons
- [ ] User with `QUALITY.INSPECTION.STAGE_APPROVE` sees stage approve button but not final approve
- [ ] EHS tab is hidden if user has no `EHS.*` permissions
- [ ] `[+ Raise]` buttons appear only for users with CREATE permission
- [ ] Rectify / Close buttons appear only when status allows AND user has permission

### Quality Inspection Workflow
- [ ] Inspection list shows "Pending My Action" tab filtered to current user's step
- [ ] Workflow stepper shows past approvers, current pending step (highlighted), future steps
- [ ] Checklist items cycle: PENDING → PASS → NA on tap
- [ ] Long-press checklist item shows remark input dialog
- [ ] Stage approval saves all item statuses before calling stage approve endpoint
- [ ] Advance workflow requires online connection; shows error if offline
- [ ] Signature sheet captures free-hand signature and submits with approval
- [ ] Delegate sheet lists eligible users and calls delegate endpoint
- [ ] Reverse approval requires reason and is only shown to users with `QUALITY.INSPECTION.REVERSE`

### Quality Site Observations
- [ ] List page shows severity color coding (🔴🟡🟢)
- [ ] Filter tabs work (All / Open / Rectified / Closed) with count badges
- [ ] Raising an observation offline queues it and shows "Queued — will sync" indicator
- [ ] Rectification form uploads photos (compressed) and submits notes
- [ ] Close action shown only when status = RECTIFIED and user has CLOSE permission

### EHS Site Observations
- [ ] Identical workflow to Quality site obs but calls `/ehs/site-observations` endpoints
- [ ] Category icons (PPE 🦺, Fire 🔥, Machinery ⚙, etc.) displayed on cards
- [ ] EHS observations stored in separate Drift cache table
- [ ] Full offline-first support (create / rectify / close all queueable)
- [ ] EHS tab hidden if no EHS permissions; shown immediately after login if permissions exist

### Shared Widgets
- [ ] `SiteObsCard` renders identically for Quality and EHS (just different data source)
- [ ] `RaiseObservationSheet` — Quality mode: no EPS picker; EHS mode: EPS node picker shown
- [ ] `RectifySheet` accepts up to 5 photos, each compressed before upload
- [ ] `SeverityBadge` colors: critical=deep red, high=red, medium=orange, low=green
