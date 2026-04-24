# Flutter Test Suite Design — SETU V01

**Date:** 2026-04-08  
**Author:** Manoranjan  
**Status:** Approved

---

## Goal

Create a comprehensive automated test suite for the SETU Flutter app so that any regression — broken BLoC logic, failed JSON parsing, or broken UI — is caught before release. The suite must be runnable with a single `flutter test` command.

---

## Scope

All 4 test layers across all 9 feature modules and the core layer:

| Layer | Purpose |
|---|---|
| **Model (unit)** | `fromJson` / `toJson` round-trips, helper methods |
| **BLoC (unit)** | Every event → expected state sequence |
| **Service (unit)** | AuthService, SyncService, NetworkInfo |
| **Widget** | Key pages render, loading/error states, tap interactions |

---

## Technology

All dependencies already present in `pubspec.yaml`:

- `flutter_test` — core test runner
- `bloc_test ^9.1.5` — `blocTest()` helper for BLoC assertions
- `mockito ^5.4.4` — generated mocks via `@GenerateMocks`
- `build_runner ^2.4.7` — codegen for mocks

---

## Folder Structure

```
flutter/test/
├── helpers/
│   ├── mocks.dart              # @GenerateMocks for all dependencies
│   ├── mocks.mocks.dart        # build_runner output (gitignored)
│   └── test_fixtures.dart      # shared fake data objects
│
├── core/
│   ├── auth/
│   │   ├── auth_service_test.dart
│   │   └── token_manager_test.dart
│   ├── sync/
│   │   └── sync_service_test.dart
│   └── network/
│       └── network_info_test.dart
│
├── features/
│   ├── auth/
│   │   ├── models/user_model_test.dart
│   │   └── bloc/auth_bloc_test.dart
│   ├── quality/
│   │   ├── models/quality_models_test.dart
│   │   ├── bloc/quality_site_obs_bloc_test.dart
│   │   ├── bloc/quality_approval_bloc_test.dart
│   │   ├── bloc/quality_dashboard_bloc_test.dart
│   │   └── bloc/quality_request_bloc_test.dart
│   ├── ehs/
│   │   ├── models/ehs_models_test.dart
│   │   ├── bloc/ehs_site_obs_bloc_test.dart
│   │   └── bloc/ehs_incident_bloc_test.dart
│   ├── labor/
│   │   ├── models/labor_models_test.dart
│   │   └── bloc/labor_bloc_test.dart
│   ├── progress/
│   │   ├── models/progress_model_test.dart
│   │   └── bloc/progress_bloc_test.dart
│   ├── projects/
│   │   ├── models/project_model_test.dart
│   │   ├── bloc/project_bloc_test.dart
│   │   └── cubit/dashboard_cubit_test.dart
│   ├── tower_lens/
│   │   ├── models/floor_progress_test.dart
│   │   └── bloc/tower_lens_bloc_test.dart
│   └── profile/
│       └── bloc/profile_bloc_test.dart
│
└── widget/
    ├── auth/login_page_test.dart
    ├── quality/quality_site_obs_page_test.dart
    └── shared/
        ├── severity_badge_test.dart
        └── obs_status_badge_test.dart
```

**Total: 32 test files**

---

## Mocks Strategy

Single `test/helpers/mocks.dart` file containing all `@GenerateMocks` annotations:

```dart
@GenerateMocks([
  SetuApiClient,
  AppDatabase,
  SyncService,
  AuthService,
  TokenManager,
  NetworkInfo,
])
```

Run once: `flutter pub run build_runner build --delete-conflicting-outputs`

`mocks.mocks.dart` is added to `.gitignore` so it is regenerated on each developer machine.

---

## Test Content Per Layer

### Model Tests
Each model test file covers:
- `fromJson` with a complete valid JSON map → verify all fields parsed correctly
- `fromJson` with missing/null optional fields → verify defaults applied
- `toJson` round-trip: `fromJson(model.toJson()) == model`
- Helper methods: `User.hasRole()`, `User.hasPermission()`, `User.initials`, enum label/color extensions

### BLoC Tests (using `blocTest`)
Each BLoC test file covers the full state machine:

**Standard pattern for every BLoC:**
- `initial state is XInitial`
- Load event → `[XLoading, XLoaded]` on API success
- Load event → `[XLoading, XLoaded(fromCache: true)]` on API failure with cached data
- Load event → `[XLoading, XError]` on API failure with no cache
- Refresh event → `[XLoading(isRefresh: true), XLoaded]`
- LoadMore event → appends to existing list, advances offset
- LoadMore event when `hasMore=false` → no state change
- CRUD actions (create/rectify/close/delete) → `[XActionSuccess]`
- CRUD actions on API failure → `[XActionError]`
- Offline path: CRUD → sync queue → `XActionSuccess('created_offline')`

**AuthBloc specific:**
- `CheckAuthStatus` with valid token → `[AuthLoading, AuthAuthenticated]`
- `CheckAuthStatus` with no token → `[AuthLoading, AuthUnauthenticated]`
- `Login` success → `[AuthLoading, AuthAuthenticated]`
- `Login` 401 → `[AuthLoading, AuthError('Invalid username or password')]`
- `Login` connection refused → `[AuthLoading, AuthError]` with WiFi hint
- `Logout` → `[AuthLoading, AuthUnauthenticated]`
- `RefreshProfile` success → `[AuthAuthenticated]`
- `RefreshProfile` failure → no state change (silent)

### Service Tests
- `AuthService.login`: happy path returns `User`; missing token throws; profile fallback path
- `AuthService.isLoggedIn`: delegates to `TokenManager`
- `AuthService.logout`: calls `TokenManager.clearTokens`
- `SyncService.addToQueue`: writes item to DB queue
- `SyncService.syncAll`: processes queue, marks success/error per item
- `NetworkInfo.isConnected`: returns true/false based on `connectivity_plus`

### Widget Tests
- `LoginPage`: renders username/password fields and login button; shows error state; shows loading spinner
- `QualitySiteObsPage`: renders shimmer on loading state; renders list on loaded state; renders error banner on error state
- `SeverityBadge`: renders correct color and label for each severity level
- `ObsStatusBadge`: renders correct color and label for each status

---

## What Is NOT Tested

- Pages that are pure navigation wrappers with no logic
- Theme/color constants (no logic to break)
- Generated Drift database code (`app_database.g.dart`)
- Firebase/notification service (platform-dependent, excluded from unit tests)

---

## Running Tests

```bash
# Generate mocks (once, or after adding new @GenerateMocks entries)
cd flutter && flutter pub run build_runner build --delete-conflicting-outputs

# Run all tests
cd flutter && flutter test

# Run a specific file
cd flutter && flutter test test/features/auth/bloc/auth_bloc_test.dart

# Run with coverage
cd flutter && flutter test --coverage
```

---

## Gitignore Addition

```
# Generated mock files
flutter/test/helpers/mocks.mocks.dart
```
