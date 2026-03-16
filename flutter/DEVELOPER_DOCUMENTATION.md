# SETU Mobile App — Developer Documentation

**Version:** 1.1.0
**Platform:** Flutter (Android, iOS)
**Backend:** NestJS + PostgreSQL (separate repo)
**Company:** Puravankara Limited — Manoranjan Division
**Last Updated:** March 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Folder Structure](#3-folder-structure)
4. [Core Systems](#4-core-systems)
   - 4.1 [Dependency Injection](#41-dependency-injection)
   - 4.2 [API Client](#42-api-client)
   - 4.3 [Authentication & Token Management](#43-authentication--token-management)
   - 4.4 [Permission System](#44-permission-system)
   - 4.5 [Local Database (Drift/SQLite)](#45-local-database-driftsqlite)
   - 4.6 [Offline Sync Engine](#46-offline-sync-engine)
   - 4.7 [Background Download Service](#47-background-download-service)
   - 4.8 [Connectivity & Auto-Sync](#48-connectivity--auto-sync)
   - 4.9 [Push Notifications & Deep Linking](#49-push-notifications--deep-linking)
   - 4.10 [Media & Storage Management](#410-media--storage-management)
5. [Feature Modules](#5-feature-modules)
   - 5.1 [Authentication](#51-authentication)
   - 5.2 [Projects & EPS Navigation](#52-projects--eps-navigation)
   - 5.3 [Progress Entry](#53-progress-entry)
   - 5.4 [Quality Inspections (RFI)](#54-quality-inspections-rfi)
   - 5.5 [Quality Site Observations](#55-quality-site-observations)
   - 5.6 [EHS Observations](#56-ehs-observations)
   - 5.7 [EHS Incidents](#57-ehs-incidents)
   - 5.8 [Labor Register](#58-labor-register)
   - 5.9 [User Profile](#59-user-profile)
6. [State Management Patterns](#6-state-management-patterns)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [API Reference Summary](#8-api-reference-summary)
9. [Database Schema](#9-database-schema)
10. [Navigation & Routing](#10-navigation--routing)
11. [Build & Deployment](#11-build--deployment)
12. [Error Handling Strategy](#12-error-handling-strategy)
13. [Known Issues & Technical Debt](#13-known-issues--technical-debt)

---

## 1. Project Overview

SETU is a field-facing construction project management app used by Puravankara's site engineers, QC inspectors, EHS officers, and site managers. It enables:

| Feature | Description | Users |
|---------|-------------|-------|
| Progress Entry | Log daily construction quantities against WBS activities | Site Engineers |
| Quality Inspections | Raise RFIs, approve via multi-level workflow, capture checklists | QC Inspectors, Managers |
| Quality Site Observations | Raise/rectify/close site-level quality defects with photos | QC Staff |
| EHS Observations | Report/rectify/close safety observations with photos | EHS Officers |
| EHS Incidents | Record near-miss, FAC, MTC, LTI, property damage incidents | EHS Officers |
| Labor Register | Daily headcount per trade/category | Site Managers |
| Progress Approvals | Approve or reject submitted progress entries | Project Managers |
| EPS Navigation | Browse project hierarchy (Block → Tower → Floor) | All Users |

**Key Design Principle:** The app is **offline-first**. All writes go to local SQLite first. The sync engine handles background synchronization with exponential backoff. Users can work on-site without connectivity.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│                   Flutter App                    │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │   Pages  │  │  BLoCs   │  │    Models    │  │
│  │   (UI)   │◄─│ (State)  │◄─│   (Data)    │  │
│  └──────────┘  └────┬─────┘  └──────────────┘  │
│                     │                            │
│       ┌─────────────┼─────────────┐             │
│       ▼             ▼             ▼             │
│  ┌─────────┐  ┌──────────┐  ┌─────────────┐   │
│  │ API     │  │ Local DB │  │ Sync Engine │   │
│  │ Client  │  │ (Drift)  │  │ (SyncSvc)   │   │
│  │ (Dio)   │  │ SQLite   │  │             │   │
│  └────┬────┘  └──────────┘  └─────────────┘   │
│       │                                         │
└───────┼─────────────────────────────────────────┘
        │ HTTPS/REST
        ▼
   NestJS Backend
   PostgreSQL DB
```

**Pattern:** BLoC (Business Logic Component) for all state management. No Riverpod, no Provider (except NetworkStatusNotifier in one widget). GetIt for dependency injection.

**Offline-First Flow:**
1. User action → BLoC event
2. BLoC writes to local SQLite → emits `*Saved(isOffline: false)` or `*Saved(isOffline: true)`
3. SyncService attempts immediate API call
4. If API fails → item stays in SyncQueue with `pending` status
5. ConnectivitySyncService retries when connectivity is restored
6. UI shows sync badge count from ConnectivitySyncService

---

## 3. Folder Structure

```
flutter/lib/
├── app.dart                     # Root MaterialApp + notification handling
├── main.dart                    # Startup: Firebase, services, GetIt DI
├── injection_container.dart     # GetIt sl singleton declaration
│
├── core/
│   ├── api/
│   │   ├── api_endpoints.dart   # All REST endpoint strings (platform-aware URLs)
│   │   ├── api_exceptions.dart  # ApiException types (NetworkError, AuthError, etc.)
│   │   └── setu_api_client.dart # Dio HTTP client with auth interceptors
│   ├── auth/
│   │   ├── auth_service.dart    # Login/logout/session management
│   │   ├── token_manager.dart   # JWT storage (FlutterSecureStorage)
│   │   └── permission_service.dart # Role-based permission getters
│   ├── database/
│   │   ├── app_database.dart    # Drift ORM — 11 tables, V5 schema
│   │   └── app_database.g.dart  # GENERATED — do not edit manually
│   ├── logging/
│   │   └── remote_logger.dart   # Remote error logging
│   ├── media/
│   │   ├── full_screen_photo_viewer.dart  # Full-screen photo with zoom
│   │   ├── image_annotation_page.dart     # Draw annotations on photos
│   │   ├── media_cleanup_service.dart     # Startup: clear temp files, trim cache
│   │   ├── photo_cache_manager.dart       # CachedNetworkImage manager config
│   │   ├── photo_compressor.dart          # Image compression before upload
│   │   └── photo_thumbnail_strip.dart     # Row of photo thumbnails widget
│   ├── navigation/
│   │   ├── app_routes.dart       # Named route constants (if any)
│   │   └── deep_link_service.dart # FCM notification → module navigation
│   ├── network/
│   │   ├── connectivity_banner.dart # "No internet" top banner widget
│   │   └── network_info.dart        # Connectivity monitoring (connectivity_plus)
│   ├── notifications/
│   │   └── notification_service.dart # FCM setup, local notification display
│   ├── sync/
│   │   ├── background_download_service.dart # WiFi-triggered offline data download
│   │   ├── connectivity_sync_service.dart   # Auto-sync on reconnect
│   │   └── sync_service.dart               # Core sync engine (queue + backoff)
│   └── theme/
│       ├── app_colors.dart       # Brand color palette
│       ├── app_dimensions.dart   # Spacing/radius constants
│       ├── app_text_styles.dart  # TextStyle definitions
│       └── app_theme.dart        # ThemeData configuration
│
├── features/
│   ├── auth/
│   │   ├── data/models/user_model.dart
│   │   └── presentation/
│   │       ├── bloc/auth_bloc.dart
│   │       └── pages/login_page.dart
│   ├── ehs/
│   │   ├── data/models/ehs_models.dart
│   │   └── presentation/
│   │       ├── bloc/ehs_incident_bloc.dart
│   │       ├── bloc/ehs_site_obs_bloc.dart
│   │       └── pages/
│   │           ├── ehs_incidents_page.dart
│   │           ├── ehs_site_obs_detail_page.dart
│   │           └── ehs_site_obs_page.dart
│   ├── labor/
│   │   ├── data/models/labor_models.dart
│   │   └── presentation/
│   │       ├── bloc/labor_bloc.dart
│   │       └── pages/labor_presence_page.dart
│   ├── progress/
│   │   ├── data/models/
│   │   │   ├── execution_breakdown.dart
│   │   │   └── progress_model.dart
│   │   └── presentation/
│   │       ├── bloc/progress_bloc.dart
│   │       └── pages/
│   │           ├── progress_approvals_page.dart
│   │           └── progress_entry_page.dart
│   ├── projects/
│   │   ├── data/models/project_model.dart
│   │   └── presentation/
│   │       ├── bloc/project_bloc.dart
│   │       ├── cubit/dashboard_cubit.dart
│   │       ├── pages/
│   │       │   ├── eps_explorer_page.dart
│   │       │   ├── module_selection_page.dart
│   │       │   ├── project_dashboard_page.dart
│   │       │   └── projects_list_page.dart
│   │       └── widgets/breadcrumb_widget.dart
│   ├── profile/
│   │   └── presentation/
│   │       ├── bloc/profile_bloc.dart
│   │       └── pages/user_profile_page.dart
│   ├── quality/
│   │   ├── data/models/quality_models.dart
│   │   └── presentation/
│   │       ├── bloc/
│   │       │   ├── quality_approval_bloc.dart
│   │       │   ├── quality_request_bloc.dart
│   │       │   └── quality_site_obs_bloc.dart
│   │       └── pages/
│   │           ├── activity_list_detail_page.dart
│   │           ├── inspection_detail_page.dart
│   │           ├── quality_approvals_page.dart
│   │           ├── quality_request_page.dart
│   │           ├── quality_site_obs_detail_page.dart
│   │           └── quality_site_obs_page.dart
│   ├── settings/
│   │   └── offline_data_page.dart     # Offline data management UI
│   └── sync/
│       └── presentation/pages/sync_log_page.dart  # Sync queue viewer
│
└── shared/
    └── widgets/
        ├── advanced_filter_sheet.dart   # Multi-criteria filter bottom sheet
        ├── connectivity_banner.dart     # Offline banner (shared)
        ├── filter_chip_bar.dart         # Scrollable chip filter bar
        ├── obs_status_badge.dart        # open/rectified/closed badge chip
        ├── photo_gallery_strip.dart     # Scrollable photo thumbnail row
        ├── raise_site_obs_sheet.dart    # Create observation bottom sheet
        ├── rectify_sheet.dart           # Submit rectification bottom sheet
        ├── severity_badge.dart          # Critical/Major/Minor severity chip
        ├── shimmer_list.dart            # Loading skeleton placeholder
        └── site_obs_card.dart          # Observation list card widget
```

---

## 4. Core Systems

### 4.1 Dependency Injection

**File:** `lib/injection_container.dart`, `lib/main.dart`
**Library:** `get_it`

GetIt is used as a service locator. All registrations happen in `main.dart`'s `initDependencies()` function.

```dart
// Access a registered service from anywhere:
final api = sl<SetuApiClient>();
final db  = sl<AppDatabase>();

// Registration types used:
sl.registerSingleton<T>(instance)   // One instance for app lifetime
sl.registerFactory<T>(() => ...)    // New instance per BLoC.read()
```

**Singletons registered:**
- `AppDatabase` — SQLite Drift DB
- `SetuApiClient` — HTTP client
- `NotificationService` — FCM handler
- `AuthService` — Login/session
- `TokenManager` — JWT storage
- `NetworkInfo` — Connectivity monitor
- `SyncService` — Offline sync engine
- `ConnectivitySyncService` — Auto-sync wrapper
- `BackgroundDownloadService` — WiFi download

**BLoC factories registered (new instance per `context.read<>()`)**
- `AuthBloc`, `ProjectBloc`, `ProgressBloc`
- `QualityRequestBloc`, `QualityApprovalBloc`, `QualitySiteObsBloc`
- `EhsSiteObsBloc`, `EhsIncidentBloc`
- `LaborBloc`, `ProfileBloc`

---

### 4.2 API Client

**File:** `lib/core/api/setu_api_client.dart`
**Library:** `dio` + `pretty_dio_logger` (debug only)

**Configuration:**
- Connect timeout: 15 seconds
- Receive timeout: 30 seconds
- Send timeout: 30 seconds

**Interceptors (in order):**

1. **`_AuthInterceptor`** — Adds `Authorization: Bearer <token>` to every request. On 401 response: attempts token refresh. If refresh fails → clears tokens, notifies AuthBloc to re-login.

2. **`_ErrorInterceptor`** — Converts `DioException` into typed `ApiException`:
   - `ConnectionTimeout` / `ReceiveTimeout` → `NetworkException`
   - HTTP 400 → `BadRequestException`
   - HTTP 401 → `UnauthorizedException`
   - HTTP 403 → `ForbiddenException` (or `TempExpiredException` if body contains `TEMP_EXPIRED`)
   - HTTP 404 → `NotFoundException`
   - HTTP 5xx → `ServerException`
   - No connection → `NetworkException`

**API methods by module:**

| Module | Methods |
|--------|---------|
| Auth | `login()`, `getProfile()`, `registerFcmToken()` |
| EPS/Projects | `getEpsTree()`, `getEpsChildren()`, `getEpsNode()` |
| Progress | `getActivitiesForExecution()`, `saveProgressEntry()`, `getProgressHistory()` |
| Progress Approvals | `getPendingProgressApprovals()`, `approveProgress()`, `rejectProgress()` |
| Quality Inspections | `getActivityLists()`, `getActivities()`, `raiseRfi()`, `getInspection()` |
| Quality Workflow | `getInspectionWorkflow()`, `approveWorkflowStep()`, `rejectWorkflowStep()` |
| Quality Observations | `raiseActivityObservation()`, `resolveActivityObservation()`, `closeActivityObservation()` |
| Quality Site Obs | `getQualitySiteObservations()`, `createQualitySiteObservation()`, `rectifyQualitySiteObservation()`, `closeQualitySiteObservation()` |
| EHS Site Obs | `getEhsSiteObservations()`, `createEhsSiteObservation()`, `rectifyEhsSiteObservation()`, `closeEhsSiteObservation()` |
| EHS Incidents | `getEhsIncidents()`, `createEhsIncident()` |
| Labor | `getLaborCategories()`, `getLaborPresence()`, `saveLaborPresence()` |
| Files | `uploadFile()`, `getFileUrl()` |
| Profile | `getUserProfile()`, `updateUserProfile()`, `uploadSignature()` |

---

### 4.3 Authentication & Token Management

**Files:** `lib/core/auth/auth_service.dart`, `lib/core/auth/token_manager.dart`

**Login flow:**
```
LoginPage → AuthBloc(Login event)
  → AuthService.login(username, password)
    → POST /auth/login
    → Parse response → extract tokens + user
    → TokenManager.saveTokens(access, refresh, expiry, userId)
  → emit(AuthAuthenticated(user))
  → App routes to ProjectsListPage
```

**Token storage keys (FlutterSecureStorage):**
- `access_token` — JWT access token
- `refresh_token` — JWT refresh token
- `token_expiry` — ISO 8601 expiry timestamp
- `user_id` — Numeric user ID

**Token refresh:**
> **Note:** Token refresh is currently **stubbed** — `TokenManager.refreshToken()` always returns `false`. When the access token expires, the user is logged out and must re-login. A proper refresh endpoint call should be implemented here when needed.

**Session check on app start:**
```
AuthBloc(CheckAuthStatus)
  → TokenManager.isTokenExpired() ?
      true  → emit(AuthUnauthenticated)
      false → AuthService.getProfile() → emit(AuthAuthenticated(user))
```

---

### 4.4 Permission System

**File:** `lib/core/auth/permission_service.dart`

`PermissionService` reads the `user.permissions` list from the current `AuthBloc` state and exposes boolean getters that the UI uses to show/hide modules and action buttons.

**Usage:**
```dart
// In a widget with access to context:
final perms = PermissionService.of(context);

if (perms.canRaiseRfi) { /* show RFI button */ }
if (perms.hasAnyEhsAccess) { /* show EHS tile */ }
```

**Permission codes (from backend):**
| Getter | Backend Permission Code |
|--------|------------------------|
| `canEntryProgress` | `EXECUTION.ENTRY.CREATE` |
| `canApproveProgress` | `EXECUTION.ENTRY.APPROVE` |
| `canRaiseRfi` | `QUALITY.INSPECTION.CREATE` |
| `canReadInspection` | `QUALITY.INSPECTION.READ` |
| `canApproveInspection` | `QUALITY.INSPECTION.APPROVE` |
| `canStageApprove` | `QUALITY.INSPECTION.STAGE_APPROVE` |
| `canFinalApprove` | `QUALITY.INSPECTION.FINAL_APPROVE` |
| `canDelegateInspection` | `QUALITY.INSPECTION.DELEGATE` |
| `canReverseInspection` | `QUALITY.INSPECTION.REVERSE` |
| `canReadQualityObs` | `QUALITY.OBS.READ` |
| `canCreateQualityObs` | `QUALITY.OBS.CREATE` |
| `canRectifyQualityObs` | `QUALITY.OBS.RECTIFY` |
| `canCloseQualityObs` | `QUALITY.OBS.CLOSE` |
| `canCreateActivityObs` | `QUALITY.ACTIVITY_OBS.CREATE` |
| `canResolveActivityObs` | `QUALITY.ACTIVITY_OBS.RESOLVE` |
| `canReadEhsDashboard` | `EHS.DASHBOARD.READ` |
| `canReadEhsObs` | `EHS.OBS.READ` |
| `canCreateEhsObs` | `EHS.OBS.CREATE` |
| `canRectifyEhsObs` | `EHS.OBS.RECTIFY` |
| `canCloseEhsObs` | `EHS.OBS.CLOSE` |
| `canReadLabor` | `LABOR.REGISTER.READ` |
| `canCreateLabor` | `LABOR.REGISTER.CREATE` |
| `canReadEhsIncident` | `EHS.INCIDENT.READ` |
| `canCreateEhsIncident` | `EHS.INCIDENT.CREATE` |

---

### 4.5 Local Database (Drift/SQLite)

**File:** `lib/core/database/app_database.dart`
**Library:** `drift` (formerly Moor)
**Schema Version:** 5

The local database serves as a **read-through cache** and **offline write buffer**. It is NOT a primary data store — server data is authoritative.

**Tables:**

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `ProgressEntries` | Offline progress log buffer | activityId, projectId, quantity, date, syncStatus |
| `DailyLogs` | Micro-schedule daily logs | projectId, activityId, date, syncStatus |
| `SyncQueue` | Generic offline operations | operationType, payload (JSON), syncStatus, retryCount, idempotencyKey |
| `CachedProjects` | Project metadata | id, name, code, status, progressPct |
| `CachedActivities` | Activity list for EPS nodes | epsNodeId, projectId, name, wbsCode, status |
| `CachedBoqItems` | BOQ lines | projectId, boqCode, description, amount |
| `CachedEpsNodes` | EPS hierarchy nodes | projectId, parentId, type, name |
| `CachedQualityActivityLists` | Checklist template names | projectId, epsNodeId, name |
| `CachedQualityActivities` | Checklist items | activityListId, name, status |
| `CachedQualitySiteObs` | Quality observations | projectId, status, severity, location |
| `CachedEhsSiteObs` | EHS observations | projectId, status, severity, location |

**SyncStatus enum:**
```dart
enum SyncStatus {
  pending(0),   // Written locally, not yet sent
  syncing(1),   // Currently being sent
  synced(2),    // Confirmed by server
  failed(3),    // Transient error — will retry
  error(4),     // Permanent error — needs user action
}
```

**Cache eviction:**
Rows in cache tables older than 30 days are deleted on app startup to prevent unbounded storage growth:
```dart
database.evictStaleCaches() // called in main.dart post-startup
```

**Querying example (offline fallback):**
```dart
// Fetch cached projects if network unavailable
final cached = await db.getCachedProjects();
```

---

### 4.6 Offline Sync Engine

**File:** `lib/core/sync/sync_service.dart`

The sync engine processes the `SyncQueue` table with FIFO ordering, exponential backoff, and idempotency guarantees.

**Backoff schedule:**
```
Attempt 1 → 2 seconds delay
Attempt 2 → 4 seconds
Attempt 3 → 8 seconds
Attempt 4 → 16 seconds
Attempt 5 → 32 seconds (max)
After 5 failures → status = error (stop retrying)
```

**Error classification:**
- **4xx errors** → `error` status (permanent). The server rejected the payload. User must fix and retry manually.
- **5xx / network errors** → `failed` status (transient). Will be retried automatically.

**Operation types in SyncQueue:**

| operationType | Description |
|--------------|-------------|
| `quality_rfi` | Raise a new quality inspection (RFI) |
| `quality_obs_resolve` | Submit rectification for activity observation |
| `quality_obs_raise` | Raise a new activity-level observation |
| `quality_obs_close` | Close an activity-level observation |
| `quality_stage_save` | Save checklist stage (pass/na items) |
| `quality_approve` | Final approve inspection |
| `quality_workflow_advance` | Advance workflow step (stage approval) |
| `quality_workflow_reject` | Reject workflow step |
| `quality_site_obs_create` | Create quality site observation |
| `quality_site_obs_rectify` | Rectify quality site observation |
| `quality_site_obs_close` | Close quality site observation |
| `ehs_site_obs_create` | Create EHS site observation |
| `ehs_site_obs_rectify` | Rectify EHS site observation |
| `ehs_site_obs_close` | Close EHS site observation |

**Sync flow:**
```
SyncService.syncAll()
  → Process ProgressEntries (pending status)
  → Process DailyLogs (pending status)
  → Process SyncQueue items (FIFO, skip 'syncing' in progress)
    → For each item:
        → Mark as 'syncing'
        → Call appropriate API method
        → Success → Mark as 'synced', clear payload
        → 4xx error → Mark as 'error', store error message
        → 5xx/network → Mark as 'failed', increment retryCount
        → retryCount >= 5 → Mark as 'error'
```

**Manual retry:**
```dart
syncService.retryFailed()      // Retry all 'failed' items
syncService.retryErrorItem(id) // Retry one specific 'error' item
```

---

### 4.7 Background Download Service

**File:** `lib/core/sync/background_download_service.dart`
**Library:** `workmanager`

Downloads reference data for offline use when the device is on WiFi.

**Triggers:**
1. App launch with WiFi — checks if last download was >6 hours ago
2. WiFi connection detected while app is running
3. Manual trigger from settings page
4. WorkManager background task (registered at startup, runs every 6 hours)

**Download phases:**
1. **Phase 1 — Projects** (~2 MB): Refresh all projects and EPS node tree
2. **Phase 2 — Activity lists**: Download checklists for each cached project

**Storage cap:** 500 MB. If estimated download would exceed cap, it's skipped with `capReached` status.

**Progress states emitted:**
```dart
enum DownloadProgress { starting, downloading, done, capReached, error }
```

---

### 4.8 Connectivity & Auto-Sync

**File:** `lib/core/sync/connectivity_sync_service.dart`

Wraps `SyncService` and `NetworkInfo` to provide automatic sync-on-reconnect:

```
NetworkInfo detects WiFi/Mobile connection restored
  → ConnectivitySyncService._onConnectivityChanged()
    → If pendingCount > 0: SyncService.syncAll()
    → Emit SyncStatusInfo.syncing → then .synced (or .partial/.error)
```

**SyncStatusInfo states:**
```dart
enum SyncStatusInfo {
  idle,     // Nothing pending
  syncing,  // Sync in progress
  synced,   // All items synced
  offline,  // No connection
  partial,  // Some synced, some failed
  error,    // Permanent errors exist
}
```

The `ConnectivitySyncBadge` widget in `ProjectsListPage` AppBar displays an icon based on this state.

---

### 4.9 Push Notifications & Deep Linking

**Files:** `lib/core/notifications/notification_service.dart`, `lib/core/navigation/deep_link_service.dart`, `lib/app.dart`

**FCM setup:**
- Requests permission on first launch (iOS 13+, Android 13+)
- Registers device FCM token with backend via `POST /users/fcm-token`
- Re-registers on token refresh

**Notification handling (3 scenarios):**

| Scenario | Handling |
|----------|---------|
| App in foreground | Local notification shown; tap → `onNotificationTap` callback |
| App in background (running) | System tray notification; tap → `onMessageOpenedApp` → callback |
| App terminated (cold start) | `getInitialMessage()` checked on launch → callback |

**Deep link navigation flow:**
```
FCM notification arrives
  → app.dart _handleNotificationTap(data)
    → Extract: projectId, type, resourceId from FCM data
    → DeepLinkService.instance.set(PendingDeepLink(projectId, type, resourceId))
    → Show SnackBar notification

ProjectsListPage (already mounted)
  → Listening to DeepLinkService.instance.notifier
    → _onDeepLink() fires
    → Find project by projectId in ProjectBloc state
    → Push ProjectDashboardPage(pendingModule: link.targetModule)

ProjectDashboardPage.initState
  → If pendingModule != null
    → addPostFrameCallback → _navigateToModule(pendingModule)
```

**Notification type → module mapping:**
| FCM `type` | `targetModule` | Destination |
|-----------|---------------|------------|
| `rfi_assigned` | `quality_approvals` | Quality Approvals page |
| `rfi_approved` | `quality_approvals` | Quality Approvals page |
| `rfi_rejected` | `quality_approvals` | Quality Approvals page |
| `quality_obs` | `quality_site_obs` | Quality Site Observations |
| `ehs_obs` | `ehs_site_obs` | EHS Observations |
| `ehs_incident` | `ehs_incidents` | EHS Incidents |
| `progress_approval` | `progress_approvals` | Progress Approvals |
| `labor` | `labor` | Labor Register |

---

### 4.10 Media & Storage Management

**Files:** `lib/core/media/`

**Photo upload flow:**
```
User selects/captures photo
  → PhotoCompressor.compress(file) → ~800 KB JPEG
  → SetuApiClient.uploadFile(path) → POST /upload → returns URL
  → URL stored with observation/RFI payload
```

**Photo display:**
- All server photo URLs are relative paths (e.g., `/uploads/abc.jpg`)
- `ApiEndpoints.resolveUrl(url)` converts to full URL for `CachedNetworkImage`
- `PhotoCacheManager` uses `flutter_cache_manager` with 30-day expiry, 200-file limit

**Storage limits enforced by `MediaCleanupService` (on startup):**
- Temp files (`setu_upload_*`) older than 3 days → deleted
- Photo cache trimmed to **150 MB** by evicting oldest files first

---

## 5. Feature Modules

### 5.1 Authentication

**BLoC:** `AuthBloc`
**Pages:** `LoginPage`

**Login UI layout:**
- Top section (42% height): Cream background, SETU brand logo + tagline
- Bottom section (58%): White card with username/password form
- Footer: Shows API server endpoint (host:port) for debugging
- Error dialog: Shows troubleshooting checklist (server running? WiFi?)

**Error translations:**
| API Error | User Message |
|-----------|-------------|
| Connection refused | "Check WiFi, server running, firewall" |
| Timeout | "Connection timed out — try again" |
| HTTP 401 | "Invalid username or password" |
| TEMP_EXPIRED | "Your vendor access has been revoked" |
| HTTP 500 | "Server error — contact admin" |

---

### 5.2 Projects & EPS Navigation

**BLoC:** `ProjectBloc`
**Pages:** `ProjectsListPage`, `ProjectDashboardPage`, `ModuleSelectionPage`, `EpsExplorerPage`

**EPS (Enterprise Project Structure):**
The hierarchy is: Company → Project → Block → Tower → Floor → Unit

The backend returns a **flat list** of all EPS nodes. `ProjectBloc` builds the tree client-side:
```dart
// Build parent → children map
final Map<int?, List<EpsNode>> childrenMap = {};
for (final node in flatList) {
  childrenMap[node.parentId] ??= [];
  childrenMap[node.parentId]!.add(node);
}
```

**Natural sort** is applied so "Floor 10" appears after "Floor 9", not "Floor 1":
```dart
// Numeric substring comparison for natural ordering
int _naturalCompare(String a, String b) { ... }
```

**In-memory activity index:**
When user navigates into a node and sees activities, those are cached in memory (`Map<int, List<Activity>>`). Tapping breadcrumb goes back without re-fetching from API.

**Module grid (ProjectDashboardPage):**
Each project has a module grid of colored tiles. Tiles shown depend on user permissions:
- Progress Reporting (blue)
- Progress Approvals (indigo)
- Quality Inspections (purple)
- Quality Site Observations (teal)
- EHS Observations (orange)
- EHS Incidents (red)
- Labor Register (green)

---

### 5.3 Progress Entry

**BLoC:** `ProgressBloc`
**Pages:** `ProgressEntryPage`, `ProgressApprovalsPage`

**Entry flow:**
1. User navigates EPS tree → selects an activity
2. `ProgressEntryPage` opens with pre-filled activity info
3. User enters quantity + notes
4. Submit → `SaveProgress` event
5. BLoC saves to `ProgressEntries` table first (local)
6. Immediate sync attempt
7. If offline → shows "Saved (pending sync)" with badge count

**Approval flow (for PMs/Managers):**
1. `LoadPendingApprovals(projectId)` → GET endpoint
2. Display queue with submitter name, date, quantity, activity
3. Bulk select → Approve (comment optional) or Reject (reason required)
4. API call → reload queue

---

### 5.4 Quality Inspections (RFI)

**BLoC:** `QualityRequestBloc`
**Pages:** `ActivityListDetailPage`, `InspectionDetailPage`, `QualityApprovalsPage`

**RFI (Request for Inspection) lifecycle:**
```
Activity status: ready
  → User taps "Raise RFI"
    → QualityRequestBloc(RaiseRfi event)
    → Queue to SyncQueue (type: quality_rfi)
    → Optimistic update: activity status → pending
  → Sync sends to server
    → Server creates Inspection record
    → Activity status on server → pending

Inspection status: pending
  → QC Inspector opens app
    → Sees inspection in approval queue
    → Opens InspectionDetailPage
    → Reviews checklist stages (pass / NA each item)
    → Signs approval at each workflow level
    → status → approved / provisionallyApproved / rejected
```

**Activity Display Status calculation:**
Each activity row in `ActivityListDetailPage` has a computed status:

| Condition | Displayed Status |
|-----------|-----------------|
| Predecessor not approved | `locked` |
| No inspection raised | `ready` |
| Inspection pending/in-progress | `pending` |
| Inspection approved | `approved` |
| Inspection rejected | `rejected` |
| Inspection provisionally approved | `provisionallyApproved` |
| Open observations exist | `pendingObservation` |

**Multi-level workflow:**
Inspections can require N approval levels (configured per project). Each level has:
- Assigned approver
- Signature capture
- Optional comments
- Current level indicator (e.g., "Level 2 of 3")

**Observations within inspection:**
QC inspectors can raise defect observations against activities. These block re-approval until rectified.

---

### 5.5 Quality Site Observations

**BLoC:** `QualitySiteObsBloc`
**Pages:** `QualitySiteObsPage`, `QualitySiteObsDetailPage`

Site observations are **not tied to specific activities** — they cover general site defects.

**Lifecycle:** `open` → `rectified` → `closed`

**Status transitions:**
- `open`: Raised by QC inspector with photos + severity (Critical/Major/Minor) + location
- `rectified`: Contractor submits evidence of fix (photos + remarks)
- `closed`: QC inspector verifies fix and closes

**Offline support:** Create/rectify/close are queued offline via SyncQueue.

---

### 5.6 EHS Observations

**BLoC:** `EhsSiteObsBloc`
**Pages:** `EhsSiteObsPage`, `EhsSiteObsDetailPage`

Identical pattern to Quality Site Observations but for EHS (Environmental, Health & Safety).

**Additional fields:**
- `hazardCategory`: Fall, Fire, Electrical, Chemical, etc.
- `riskLevel`: Low, Medium, High, Critical

---

### 5.7 EHS Incidents

**BLoC:** `EhsIncidentBloc`
**Pages:** `EhsIncidentsPage`

Records formal safety incidents (reportable events).

**Incident types (IncidentType enum):**
| Type | Label | Color |
|------|-------|-------|
| `nearMiss` | Near Miss | Orange |
| `fac` | First Aid Case | Yellow |
| `mtc` | Medical Treatment Case | Purple |
| `lti` | Lost Time Injury | Red |
| `propertyDamage` | Property Damage | Blue |
| `environmental` | Environmental | Green |

**Create form fields:**
- Incident date (date picker)
- Incident type (dropdown)
- Location (text)
- Description (multi-line)
- Immediate cause (multi-line)
- Affected persons (comma-separated list)
- First aid given (checkbox)
- Hospital visit (checkbox)
- Days lost (stepper — only shown for MTC and LTI types)

**Note:** Incidents are currently online-only (no offline queue). If offline, creation fails with an error message.

---

### 5.8 Labor Register

**BLoC:** `LaborBloc`
**Pages:** `LaborPresencePage`

Daily headcount log for all labor categories on site.

**Load flow:**
```
LaborPresencePage.initState
  → LoadLaborPresence(projectId, date: today)
    → Parallel API calls:
        GET /labor/categories → all categories
        GET /labor/presence/:projectId?date=YYYY-MM-DD → existing entries
    → Merge: every category gets a DailyLaborEntry row
      (count = 0 if no entry, or existing count if already saved)
    → emit(LaborLoaded(entries))
```

**Save flow:**
```
User enters counts → UpdateLaborEntry events update in-memory state
User taps "Save Register"
  → SaveLaborPresence event
  → Filter entries where count > 0
  → POST /labor/presence/:projectId with all non-zero entries
  → emit(LaborSaveSuccess(savedCount))
  → Reload for today's date
```

**Date selection:** User can view/edit previous dates (up to 90 days back) using the date picker.

---

### 5.9 User Profile

**BLoC:** `ProfileBloc`
**Pages:** `UserProfilePage`

- View user info (name, email, designation, roles, permissions)
- Upload profile signature (used for inspection approvals)
- View assigned projects

---

## 6. State Management Patterns

### BLoC Pattern

All features use the `flutter_bloc` package. Every feature has:
- **Events** — What the user/system wants to do
- **States** — The current situation the UI should render
- **BLoC** — Converts events to states

```dart
// Standard structure:
abstract class XEvent extends Equatable {}
abstract class XState extends Equatable {}
class XBloc extends Bloc<XEvent, XState> {
  XBloc() : super(XInitial()) {
    on<LoadX>(_onLoad);
    on<CreateX>(_onCreate);
  }
}
```

### BlocConsumer Pattern

Pages use `BlocConsumer` for two concerns:
- **`listener`**: Side effects (SnackBars, navigation, dialogs)
- **`builder`**: UI rendering based on current state

```dart
BlocConsumer<XBloc, XState>(
  listener: (context, state) {
    if (state is XSuccess) {
      ScaffoldMessenger.of(context).showSnackBar(...);
    }
  },
  builder: (context, state) {
    if (state is XLoading) return const CircularProgressIndicator();
    if (state is XLoaded) return _buildContent(state.data);
    return const SizedBox.shrink();
  },
)
```

### BLoC Provision

BLoCs are provided at the page level (not globally) to ensure fresh state per navigation:
```dart
// In app.dart — only auth & project BLoCs are global:
MultiBlocProvider(
  providers: [
    BlocProvider(create: (_) => sl<AuthBloc>()..add(CheckAuthStatus())),
    BlocProvider(create: (_) => sl<ProjectBloc>()),
  ],
  child: MaterialApp(...),
)

// Feature pages provide their own BLoCs:
BlocProvider(
  create: (_) => sl<EhsIncidentBloc>()..add(LoadEhsIncidents(projectId)),
  child: EhsIncidentsPage(...),
)
```

---

## 7. Data Flow Diagrams

### Offline Write + Sync

```
User Action
    │
    ▼
BLoC Event
    │
    ▼
Write to SyncQueue (SQLite)
    │
    ├──► emit(ActionQueued, isOffline: true)
    │                               │
    │                               ▼
    │                         UI shows "pending sync" badge
    │
    ▼
Immediate SyncService.syncAll() attempt
    │
    ├── Connected ──► API Call ──► Success ──► syncStatus = synced
    │                          └─► 4xx ──────► syncStatus = error
    │
    └── Offline ──► skip (ConnectivitySyncService will retry on reconnect)
```

### Notification → Navigation

```
FCM Push Notification
    │
    ▼
NotificationService callback
    │
    ▼
app.dart _handleNotificationTap(data)
    │
    ├──► DeepLinkService.instance.set(PendingDeepLink)
    └──► Show SnackBar
              │
              ▼
    ProjectsListPage ValueNotifier listener fires
              │
              ▼
    Find project in ProjectBloc state
              │
              ▼
    Navigator.push(ProjectDashboardPage(pendingModule: 'xxx'))
              │
              ▼
    _DashboardViewState.initState
              │
              ▼
    addPostFrameCallback → _navigateToModule('xxx')
              │
              ▼
    Feature page opens automatically
```

---

## 8. API Reference Summary

**Base URL selection** (from `ApiEndpoints`):

| Environment | Default Base URL |
|-------------|-----------------|
| Android emulator | `http://10.0.2.2:3000/api` |
| iOS simulator / Desktop | `http://localhost:3000/api` |
| Real device (override) | Set `SETU_API_BASE_URL` env variable |

**Key endpoint groups:**

```
/auth
  POST /login               → Login
  GET  /profile             → Current user profile
  POST /users/fcm-token     → Register push token

/eps
  GET  /                    → Flat list of all EPS nodes (user-scoped)
  GET  /:id/children        → Direct children of a node

/planning/:epsNodeId
  GET  /execution-ready     → Activities for progress entry

/execution
  POST /entry               → Save progress
  GET  /history/:projectId  → Progress history
  GET  /pending-approvals   → Pending approval queue
  POST /approve             → Approve entries
  POST /reject              → Reject entries

/quality
  GET  /activity-lists/:epsNodeId    → Checklist templates
  GET  /activities/:listId           → Checklist items
  POST /inspections                  → Raise RFI
  GET  /inspections/:id              → Get inspection detail
  GET  /inspections/:id/workflow     → Workflow steps
  POST /inspections/:id/workflow/advance  → Approve step
  POST /inspections/:id/workflow/reject   → Reject step
  POST /observations                 → Raise activity observation
  POST /observations/:id/resolve     → Resolve observation
  GET  /site-observations/:projectId → Site observations list
  POST /site-observations            → Create site observation
  PATCH /site-observations/:id/rectify → Rectify
  PATCH /site-observations/:id/close   → Close

/ehs/:projectId
  GET  /observations         → EHS observations list
  POST /observations         → Create EHS observation
  PATCH /observations/:id/rectify → Rectify
  PATCH /observations/:id/close   → Close
  GET  /incidents            → Incidents list
  POST /incidents            → Create incident

/labor
  GET  /categories           → Labor category types
  GET  /presence/:projectId  → Presence for a date
  POST /presence/:projectId  → Save presence

/upload
  POST /                     → Upload file → returns URL

/users/:id/signature
  POST /                     → Upload signature image
```

---

## 9. Database Schema

**Drift table definitions** (simplified):

```dart
// SyncQueue — all offline operations flow through here
class SyncQueue extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get operationType => text()();          // e.g., 'quality_rfi'
  TextColumn get payload => text()();                 // JSON string
  IntColumn get syncStatus => integer().withDefault(const Constant(0))();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get idempotencyKey => text().nullable()(); // For safe retries
  TextColumn get errorMessage => text().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

// CachedProjects — for offline project list
class CachedProjects extends Table {
  IntColumn get id => integer()();
  TextColumn get name => text()();
  TextColumn get code => text()();
  TextColumn get status => text()();
  RealColumn get progressPct => real().withDefault(const Constant(0.0))();
  DateTimeColumn get cachedAt => dateTime()();
}
```

**Schema migrations (V1 → V5):**
- V1 → V2: Added `SyncQueue` table
- V2 → V3: Added `CachedQualityActivityLists`, `CachedQualityActivities`
- V3 → V4: Added `CachedQualitySiteObs`, `CachedEhsSiteObs`
- V4 → V5: Added nullable `idempotencyKey` to `SyncQueue`; added `retryCount`

---

## 10. Navigation & Routing

The app uses **imperative navigation** (`Navigator.push`) throughout — no named routes except for the root route.

**Navigation hierarchy:**
```
MaterialApp (root)
└── AuthGuard
    ├── LoginPage           (if not authenticated)
    └── ProjectsListPage    (if authenticated)
        └── ModuleSelectionPage (per project)
            ├── EpsExplorerPage
            │   └── ProgressEntryPage
            ├── ProgressApprovalsPage
            ├── QualityRequestPage
            │   └── ActivityListDetailPage
            │       └── InspectionDetailPage
            ├── QualityApprovalsPage
            │   └── InspectionDetailPage
            ├── QualitySiteObsPage
            │   └── QualitySiteObsDetailPage
            ├── EhsSiteObsPage
            │   └── EhsSiteObsDetailPage
            ├── EhsIncidentsPage
            └── LaborPresencePage
```

**Direct navigation from ProjectDashboardPage** (via module grid tiles):
The `ProjectDashboardPage` also serves as a direct shortcut hub. Tapping a tile goes directly to the feature page (bypassing `ModuleSelectionPage`).

---

## 11. Build & Deployment

### Build Scripts

Located in `flutter/scripts/`:

| Script | Purpose |
|--------|---------|
| `20_dual_device_test.bat` | **Primary** — Build debug + install on 2 connected devices simultaneously |
| `18_wifi_release.bat` | Build release APK for WiFi distribution |
| `_build_monitor.ps1` | PowerShell helper — monitor build progress |

### Build Commands

```bash
# Debug build (development)
cd flutter
flutter build apk --debug

# Release build (production)
flutter build apk --release --split-per-abi

# Install directly to connected device
flutter install

# Run on specific device
flutter run -d <device-id>
```

### Environment Configuration

API base URL is detected at runtime (no build-time env variables):
```dart
// In api_endpoints.dart:
static String get _baseUrl {
  const override = String.fromEnvironment('SETU_API_BASE_URL');
  if (override.isNotEmpty) return override;
  if (Platform.isAndroid) return 'http://10.0.2.2:3000/api'; // emulator
  return 'http://localhost:3000/api'; // simulator
}
```

For production, set the base URL via backend config or use a `.env` approach.

### Dependencies (key packages)

```yaml
flutter_bloc: ^8.x          # BLoC state management
get_it: ^7.x                # Dependency injection
dio: ^5.x                   # HTTP client
drift: ^2.x                 # SQLite ORM
flutter_secure_storage: ^9.x # JWT storage
firebase_messaging: ^14.x   # FCM push notifications
firebase_core: ^2.x         # Firebase initialization
workmanager: ^0.5.x         # Background tasks
connectivity_plus: ^5.x     # Network monitoring
cached_network_image: ^3.x  # Photo caching
image_picker: ^1.x          # Camera/gallery access
flutter_image_compress: ^2.x # Photo compression
equatable: ^2.x             # Value equality for BLoC states
```

---

## 12. Error Handling Strategy

### API Errors

All API errors are caught by `_ErrorInterceptor` in `SetuApiClient` and converted to `ApiException` subclasses before reaching BLoC handlers.

**BLoC error handling convention:**
```dart
try {
  final result = await _api.someCall();
  emit(SomeLoaded(result));
} on ApiException catch (e) {
  emit(SomeError(e.message));
} catch (e) {
  emit(SomeError('Unexpected error: $e'));
}
```

### Offline Error Handling

- **Write operations** never fail in offline mode — they queue and succeed silently
- **Read operations** fall back to cache where available
- If no cache → show error state with retry button

### User-Visible Error States

Every feature BLoC has an `Error` state that pages render as:
```
[Cloud Off Icon]
"Failed to load [X]. Check your connection."
[Retry button]
```

### Unhandled Errors

`RemoteLogger` (if configured) catches uncaught exceptions for remote monitoring.

---

## 13. Known Issues & Technical Debt

| Issue | File | Impact | Notes |
|-------|------|--------|-------|
| `getCacheDirectory` not defined | `core/media/media_cleanup_service.dart:98` | Low — cleanup still runs partially | `CacheStore` API changed; needs update to use `DefaultCacheManager().store` or equivalent |
| Token refresh stubbed | `core/auth/token_manager.dart` | Medium — users must re-login when token expires (typically every 24h) | Needs `POST /auth/refresh` endpoint call implementation |
| EHS Incidents not offline-queued | `features/ehs/presentation/bloc/ehs_incident_bloc.dart` | Low — creates only when online | Could add to SyncQueue like observations |
| Natural sort only on EPS nodes | `features/projects/presentation/bloc/project_bloc.dart` | Low — visual only | Activity lists not naturally sorted |
| No pagination on lists | Multiple list pages | Medium — will slow with large datasets | All observations/incidents loaded at once |
| WorkManager background task frequency | `core/sync/background_download_service.dart` | Low | 6-hour minimum gap may be too infrequent for active projects |

---

## Appendix: Adding a New Feature Module

To add a new module (e.g., "Material Tracking"):

1. **Create folder structure:**
   ```
   features/materials/
   ├── data/models/material_models.dart
   └── presentation/
       ├── bloc/material_bloc.dart
       └── pages/material_page.dart
   ```

2. **Add API methods** to `setu_api_client.dart`

3. **Add endpoint constants** to `api_endpoints.dart`

4. **Add permission getters** to `permission_service.dart`

5. **Register BLoC factory** in `main.dart`:
   ```dart
   sl.registerFactory(() => MaterialBloc(apiClient: sl()));
   ```

6. **Add module tile** to `project_dashboard_page.dart` module grid with permission check

7. **Add navigation case** in `_navigateToModule()` for deep link support

8. **Add notification type mapping** in `deep_link_service.dart` if notifications needed

9. **Add offline SyncQueue operation type** in `sync_service.dart` if offline writes needed

---

*This documentation is maintained alongside the codebase. Update relevant sections when making architectural changes.*
