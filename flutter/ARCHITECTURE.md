# SETU Mobile App - Flutter Architecture

## 📱 Overview

SETU Mobile is a Flutter-based mobile application for construction project progress reporting. It connects to the existing SETU NestJS backend and provides field workers with offline-capable progress entry capabilities.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUTTER MOBILE APP                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        PRESENTATION LAYER                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │    │
│  │  │   Screens   │  │  Widgets    │  │   Routes    │  │  Themes    │ │    │
│  │  │  (Pages)    │  │  (UI Comp)  │  │ (Navigation)│  │  (Styles)  │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        STATE MANAGEMENT (BLoC)                       │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │    │
│  │  │  AuthBloc   │  │ProjectBloc  │  │ ProgressBloc│  │ DailyLogBloc│ │    │
│  │  │  AuthState  │  │ProjectState │  │ProgressState│  │DailyLogState│ │    │
│  │  │  AuthEvent  │  │ProjectEvent │  │ProgressEvent│  │DailyLogEvent│ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          DOMAIN LAYER                                │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │    │
│  │  │  Entities   │  │ Repositories│  │  Use Cases  │  │   Value    │ │    │
│  │  │  (Models)   │  │ (Abstract)  │  │ (Business)  │  │  Objects   │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           DATA LAYER                                 │    │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────┐   │    │
│  │  │      REMOTE DATA SOURCE     │  │      LOCAL DATA SOURCE      │   │    │
│  │  │  ┌───────────────────────┐  │  │  ┌───────────────────────┐  │   │    │
│  │  │  │    Setu Api Client    │  │  │  │   SQLite (Drift)      │  │   │    │
│  │  │  │    (Dio HTTP)         │  │  │  │   Hive (Key-Value)    │  │   │    │
│  │  │  │    JWT Interceptor    │  │  │  │   Secure Storage      │  │   │    │
│  │  │  └───────────────────────┘  │  │  └───────────────────────┘  │   │    │
│  │  └─────────────────────────────┘  └─────────────────────────────┘   │    │
│  │                                                                     │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    REPOSITORY IMPLEMENTATIONS                │    │    │
│  │  │  AuthRepositoryImpl | ProjectRepositoryImpl | ProgressRepoImpl│    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (REST API)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NESTJS BACKEND (EXISTING)                             │
│                                                                              │
│  /auth/login                    - User authentication                        │
│  /auth/profile                  - User profile                               │
│  /eps/my-projects               - Get user's assigned projects               │
│  /execution/:projectId/...      - Progress reporting                         │
│  /micro-schedules/...           - Micro schedule & daily logs                │
│  /planning/...                  - Planning data                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
flutter/
├── lib/
│   ├── main.dart                          # App entry point
│   ├── app.dart                           # MaterialApp configuration
│   │
│   ├── core/                              # Core functionality
│   │   ├── api/
│   │   │   ├── setu_api_client.dart       # Dio HTTP client setup
│   │   │   ├── api_interceptors.dart      # JWT, logging interceptors
│   │   │   ├── api_exceptions.dart        # Custom API exceptions
│   │   │   └── api_endpoints.dart         # API endpoint constants
│   │   │
│   │   ├── auth/
│   │   │   ├── auth_service.dart          # Authentication logic
│   │   │   ├── token_manager.dart         # JWT token storage/retrieval
│   │   │   └── auth_guard.dart            # Route protection
│   │   │
│   │   ├── database/
│   │   │   ├── app_database.dart          # Drift database setup
│   │   │   ├── tables/                    # Database tables
│   │   │   │   ├── projects.dart
│   │   │   │   ├── progress_entries.dart
│   │   │   │   ├── daily_logs.dart
│   │   │   │   └── sync_queue.dart
│   │   │   └── daos/                      # Data Access Objects
│   │   │       ├── project_dao.dart
│   │   │       ├── progress_dao.dart
│   │   │       └── sync_dao.dart
│   │   │
│   │   ├── sync/
│   │   │   ├── sync_service.dart          # Offline sync logic
│   │   │   ├── sync_status.dart           # Sync status tracking
│   │   │   └── conflict_resolver.dart     # Data conflict resolution
│   │   │
│   │   ├── storage/
│   │   │   ├── secure_storage.dart        # Flutter_secure_storage wrapper
│   │   │   ├── hive_service.dart          # Hive box management
│   │   │   └── cache_service.dart         # Data caching
│   │   │
│   │   ├── network/
│   │   │   ├── network_info.dart          # Connectivity checking
│   │   │   └── network_interceptor.dart   # Offline queue interceptor
│   │   │
│   │   ├── utils/
│   │   │   ├── date_utils.dart
│   │   │   ├── formatters.dart
│   │   │   ├── validators.dart
│   │   │   └── constants.dart
│   │   │
│   │   └── theme/
│   │       ├── app_theme.dart             # Theme configuration
│   │       ├── app_colors.dart
│   │       ├── app_text_styles.dart
│   │       └── app_dimensions.dart
│   │
│   ├── features/                          # Feature-based modules
│   │   │
│   │   ├── auth/                          # Authentication feature
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── user_model.dart
│   │   │   │   │   ├── login_request.dart
│   │   │   │   │   └── login_response.dart
│   │   │   │   └── repositories/
│   │   │   │       └── auth_repository_impl.dart
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── user.dart
│   │   │   │   └── repositories/
│   │   │   │       └── auth_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── bloc/
│   │   │   │   │   ├── auth_bloc.dart
│   │   │   │   │   ├── auth_event.dart
│   │   │   │   │   └── auth_state.dart
│   │   │   │   ├── pages/
│   │   │   │   │   ├── login_page.dart
│   │   │   │   │   └── splash_page.dart
│   │   │   │   └── widgets/
│   │   │   │       └── login_form.dart
│   │   │   └── auth_module.dart           # Dependency injection
│   │   │
│   │   ├── projects/                      # Projects listing feature
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── project_model.dart
│   │   │   │   │   ├── eps_node_model.dart
│   │   │   │   │   └── activity_model.dart
│   │   │   │   └── repositories/
│   │   │   │       └── project_repository_impl.dart
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── project.dart
│   │   │   │   └── repositories/
│   │   │   │       └── project_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── bloc/
│   │   │   │   │   ├── project_bloc.dart
│   │   │   │   │   ├── project_event.dart
│   │   │   │   │   └── project_state.dart
│   │   │   │   ├── pages/
│   │   │   │   │   ├── projects_list_page.dart
│   │   │   │   │   └── project_detail_page.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── project_card.dart
│   │   │   │       └── activity_list_tile.dart
│   │   │   └── projects_module.dart
│   │   │
│   │   ├── progress/                      # Progress reporting feature
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── progress_entry_model.dart
│   │   │   │   │   ├── measurement_model.dart
│   │   │   │   │   ├── micro_progress_dto.dart
│   │   │   │   │   └── boq_item_model.dart
│   │   │   │   └── repositories/
│   │   │   │       └── progress_repository_impl.dart
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── progress_entry.dart
│   │   │   │   │   └── measurement.dart
│   │   │   │   ├── repositories/
│   │   │   │   │   └── progress_repository.dart
│   │   │   │   └── usecases/
│   │   │   │       ├── save_progress.dart
│   │   │   │       ├── sync_progress.dart
│   │   │   │       └── validate_progress.dart
│   │   │   ├── presentation/
│   │   │   │   ├── bloc/
│   │   │   │   │   ├── progress_bloc.dart
│   │   │   │   │   ├── progress_event.dart
│   │   │   │   │   └── progress_state.dart
│   │   │   │   ├── pages/
│   │   │   │   │   ├── progress_entry_page.dart
│   │   │   │   │   ├── measurement_form_page.dart
│   │   │   │   │   └── progress_history_page.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── progress_form.dart
│   │   │   │       ├── measurement_input.dart
│   │   │   │       ├── boq_item_selector.dart
│   │   │   │       ├── micro_activity_selector.dart
│   │   │   │       ├── photo_capture_widget.dart
│   │   │   │       ├── offline_indicator.dart
│   │   │   │       └── sync_status_widget.dart
│   │   │   └── progress_module.dart
│   │   │
│   │   ├── daily_logs/                    # Daily logs feature
│   │   │   ├── data/
│   │   │   │   ├── models/
│   │   │   │   │   ├── daily_log_model.dart
│   │   │   │   │   └── delay_reason_model.dart
│   │   │   │   └── repositories/
│   │   │   │       └── daily_log_repository_impl.dart
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── daily_log.dart
│   │   │   │   └── repositories/
│   │   │   │       └── daily_log_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── bloc/
│   │   │   │   │   ├── daily_log_bloc.dart
│   │   │   │   │   ├── daily_log_event.dart
│   │   │   │   │   └── daily_log_state.dart
│   │   │   │   ├── pages/
│   │   │   │   │   ├── daily_log_page.dart
│   │   │   │   │   └── log_history_page.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── daily_log_form.dart
│   │   │   │       ├── delay_reason_dropdown.dart
│   │   │   │       └── labor_input_widget.dart
│   │   │   └── daily_logs_module.dart
│   │   │
│   │   └── settings/                      # App settings
│   │       ├── presentation/
│   │       │   ├── pages/
│   │       │   │   └── settings_page.dart
│   │       │   └── widgets/
│   │       │       └── sync_settings.dart
│   │       └── settings_module.dart
│   │
│   ├── shared/                            # Shared components
│   │   ├── widgets/
│   │   │   ├── loading_overlay.dart
│   │   │   ├── error_dialog.dart
│   │   │   ├── confirm_dialog.dart
│   │   │   ├── empty_state_widget.dart
│   │   │   ├── custom_app_bar.dart
│   │   │   ├── custom_drawer.dart
│   │   │   └── bottom_nav_bar.dart
│   │   │
│   │   └── extensions/
│   │       ├── context_extensions.dart
│   │       └── string_extensions.dart
│   │
│   └── injection_container.dart           # GetIt dependency injection
│
├── test/                                  # Tests
│   ├── unit/
│   ├── widget/
│   └── integration/
│
├── android/                               # Android-specific config
├── ios/                                   # iOS-specific config
├── pubspec.yaml                           # Dependencies
├── analysis_options.yaml                  # Linting rules
└── README.md                              # Project documentation
```

---

## 🔌 API Endpoints Integration

### Authentication APIs

| Endpoint | Method | Purpose | Mobile Usage |
|----------|--------|---------|--------------|
| `/auth/login` | POST | User login | ✅ Primary auth |
| `/auth/profile` | GET | Get user profile | ✅ User info display |
| `/auth/refresh` | POST | Refresh token | ✅ Token renewal |

### Project APIs

| Endpoint | Method | Purpose | Mobile Usage |
|----------|--------|---------|--------------|
| `/eps/my-projects` | GET | Get user's projects | ✅ Project list |
| `/eps/:id` | GET | Get EPS node details | ✅ Project details |
| `/eps/:id/activities` | GET | Get activities | ✅ Activity selection |

### Progress Reporting APIs

| Endpoint | Method | Purpose | Mobile Usage |
|----------|--------|---------|--------------|
| `/execution/:projectId/measurements` | POST | Save measurements | ✅ **Core feature** |
| `/execution/:projectId/logs` | GET | Get progress logs | ✅ History view |
| `/execution/progress/micro` | POST | Save micro progress | ✅ **Core feature** |
| `/execution/breakdown` | GET | Get execution breakdown | ✅ Micro activities |
| `/execution/has-micro/:activityId` | GET | Check micro schedule | ✅ Feature detection |

### Daily Log APIs

| Endpoint | Method | Purpose | Mobile Usage |
|----------|--------|---------|--------------|
| `/micro-schedules/logs` | POST | Create daily log | ✅ **Core feature** |
| `/micro-schedules/activities/:id/logs` | GET | Get activity logs | ✅ History view |
| `/micro-schedules/delay-reasons` | GET | Get delay reasons | ✅ Dropdown data |

---

## 📊 Data Models

### User Model
```dart
class User {
  final int id;
  final String username;
  final String email;
  final String fullName;
  final List<String> roles;
  final List<int> projectIds;
}
```

### Project Model
```dart
class Project {
  final int id;
  final String name;
  final String code;
  final String status;
  final DateTime startDate;
  final DateTime? endDate;
  final List<EpsNode> children;
}
```

### Progress Entry Model
```dart
class ProgressEntry {
  final int? id;                    // Local ID
  final int? serverId;              // Server ID after sync
  final int projectId;
  final int activityId;
  final int epsNodeId;
  final int boqItemId;
  final int? microActivityId;
  final double quantity;
  final DateTime date;
  final String? remarks;
  final List<String>? photoPaths;
  final SyncStatus syncStatus;      // pending, synced, failed
  final DateTime createdAt;
  final DateTime? syncedAt;
}
```

### Daily Log Model
```dart
class DailyLog {
  final int? id;
  final int? serverId;
  final int microActivityId;
  final DateTime logDate;
  final double plannedQty;
  final double actualQty;
  final int? laborCount;
  final int? delayReasonId;
  final String? delayNotes;
  final String? remarks;
  final SyncStatus syncStatus;
  final DateTime createdAt;
}
```

---

## 🔄 Offline-First Architecture

### Sync Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         OFFLINE-FIRST SYNC FLOW                           │
└──────────────────────────────────────────────────────────────────────────┘

USER ACTION                    LOCAL STORAGE                  SERVER
    │                              │                            │
    │  1. Save Progress            │                            │
    ├─────────────────────────────►│                            │
    │                              │                            │
    │                              │ 2. Save to SQLite          │
    │                              │    (sync_status=pending)   │
    │                              │                            │
    │  3. Show success to user     │                            │
    │◄─────────────────────────────┤                            │
    │                              │                            │
    │                              │  4. Check connectivity     │
    │                              │     (if online)            │
    │                              │                            │
    │                              │  5. POST to API ──────────►│
    │                              │                            │
    │                              │  6. Receive response ◄─────┤
    │                              │     (server_id, synced_at) │
    │                              │                            │
    │                              │  7. Update local record    │
    │                              │     (sync_status=synced)   │
    │                              │                            │
    │  8. Background sync notification (optional)              │
    │◄─────────────────────────────┤                            │
    │                              │                            │
```

### Sync Queue Table
```dart
class SyncQueue {
  final int id;
  final String entityType;        // 'progress', 'daily_log', 'photo'
  final int entityId;             // Local entity ID
  final String operation;         // 'create', 'update', 'delete'
  final Map<String, dynamic> payload;
  final int retryCount;
  final DateTime createdAt;
  final DateTime? lastAttemptAt;
  final String? lastError;
}
```

### Conflict Resolution Strategy
```
1. Server Wins: When server has newer timestamp
2. Client Wins: When server data is older
3. Merge: Combine non-conflicting fields
4. Manual: Prompt user for complex conflicts
```

---

## 🔐 Security Architecture

### Token Management
```dart
class TokenManager {
  // Store tokens securely using flutter_secure_storage
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  });
  
  // Auto-refresh token when expired
  Future<String?> getValidToken();
  
  // Clear tokens on logout
  Future<void> clearTokens();
}
```

### API Security
- All API calls use HTTPS
- JWT token in Authorization header
- Token refresh on 401 response
- Secure token storage using platform keychain/keystore

---

## 📱 UI/UX Design Principles

### Navigation Structure
```
┌─────────────────────────────────────────────────────────────────┐
│                         APP NAVIGATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐                                                │
│  │  Splash     │ ──► Auto-login check                           │
│  └─────────────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                                │
│  │   Login     │ ──► Username/Password                          │
│  └─────────────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MAIN APP (Bottom Nav)                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │ Projects │ │ Progress │ │  Logs    │ │ Settings │    │   │
│  │  │    📋    │ │    📊    │ │    📝    │ │    ⚙️    │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  │       │            │            │            │          │   │
│  │       ▼            ▼            ▼            ▼          │   │
│  │  Project      Progress      Daily Log    Sync Status    │   │
│  │  List         Entry         History      Settings       │   │
│  │       │            │            │                        │   │
│  │       ▼            ▼            ▼                        │   │
│  │  Project      Photo         Log                         │   │
│  │  Details      Capture       Details                     │   │
│  │       │            │                                      │   │
│  │       ▼            ▼                                      │   │
│  │  Activity     Sync Queue                                  │   │
│  │  List         View                                        │   │
│  │       │                                                   │   │
│  │       ▼                                                   │   │
│  │  Activity                                                 │   │
│  │  Details                                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Offline Indicators
- Banner showing offline status
- Pending sync count badge
- Sync progress indicator
- Retry button for failed items

---

## 🧪 Testing Strategy

### Unit Tests
- BLoC state transitions
- Repository methods
- Use cases
- Utility functions

### Widget Tests
- Screen rendering
- User interactions
- Form validation

### Integration Tests
- Complete user flows
- API integration
- Offline sync scenarios

---

## 📦 Key Dependencies

```yaml
dependencies:
  # State Management
  flutter_bloc: ^8.1.0
  equatable: ^2.0.5
  
  # Networking
  dio: ^5.4.0
  pretty_dio_logger: ^1.3.0
  
  # Local Storage
  drift: ^2.14.0
  sqlite3_flutter_libs: ^0.5.0
  hive_flutter: ^1.1.0
  flutter_secure_storage: ^9.0.0
  
  # Dependency Injection
  get_it: ^7.6.0
  injectable: ^2.3.0
  
  # Navigation
  go_router: ^13.0.0
  
  # UI Components
  flutter_slidable: ^3.0.0
  shimmer: ^3.0.0
  cached_network_image: ^3.3.0
  
  # Camera & Media
  camera: ^0.10.5
  image_picker: ^1.0.7
  image: ^4.1.0
  
  # Location
  geolocator: ^10.1.0
  geocoding: ^2.1.0
  
  # Connectivity
  connectivity_plus: ^5.0.0
  workmanager: ^0.5.0
  
  # Utilities
  intl: ^0.18.0
  uuid: ^4.2.0
  logger: ^2.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  mockito: ^5.4.0
  bloc_test: ^9.1.0
  drift_dev: ^2.14.0
  build_runner: ^2.4.0
```

---

## 🚀 Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup
- [ ] Core architecture
- [ ] API client
- [ ] Authentication flow
- [ ] Token management

### Phase 2: Project Management (Week 3)
- [ ] Project list screen
- [ ] Project details
- [ ] Activity navigation
- [ ] Offline caching

### Phase 3: Progress Reporting (Week 4-5)
- [ ] Progress entry form
- [ ] BOQ item selection
- [ ] Micro activity selection
- [ ] Photo capture
- [ ] Offline queue

### Phase 4: Daily Logs (Week 6)
- [ ] Daily log form
- [ ] Delay reason selection
- [ ] Labor input
- [ ] Log history

### Phase 5: Sync & Polish (Week 7-8)
- [ ] Background sync
- [ ] Conflict resolution
- [ ] Error handling
- [ ] UI polish
- [ ] Testing

---

## 📝 Notes

- This architecture follows Clean Architecture principles
- BLoC pattern for state management (recommended by Flutter team)
- Offline-first approach for field workers
- Feature-based folder structure for scalability
- Dependency injection using GetIt for testability
