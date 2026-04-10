# Flutter Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a comprehensive automated test suite (BLoC + model + service + widget) for all 9 SETU feature modules so `flutter test` catches regressions before release.

**Architecture:** Mirror the `lib/` folder structure under `test/`. All mockito-generated mocks live in a single `test/helpers/mocks.dart` so `build_runner` runs once. BLoC tests use `bloc_test`'s `blocTest()` helper; model tests verify `fromJson`/`toJson` round-trips; service tests stub dependencies via generated mocks; widget tests use `pumpWidget` with a minimal BLoC stub.

**Tech Stack:** `flutter_test`, `bloc_test ^9.1.5`, `mockito ^5.4.4`, `build_runner ^2.4.7` — all already in `pubspec.yaml`.

---

## File Map

| File | Create/Modify |
|---|---|
| `test/helpers/mocks.dart` | Create |
| `test/helpers/test_fixtures.dart` | Create |
| `.gitignore` | Modify |
| `test/features/auth/models/user_model_test.dart` | Create |
| `test/features/quality/models/quality_models_test.dart` | Create |
| `test/features/ehs/models/ehs_models_test.dart` | Create |
| `test/features/labor/models/labor_models_test.dart` | Create |
| `test/features/progress/models/progress_model_test.dart` | Create |
| `test/features/projects/models/project_model_test.dart` | Create |
| `test/features/tower_lens/models/floor_progress_test.dart` | Create |
| `test/features/auth/bloc/auth_bloc_test.dart` | Create |
| `test/features/quality/bloc/quality_site_obs_bloc_test.dart` | Create |
| `test/features/quality/bloc/quality_approval_bloc_test.dart` | Create |
| `test/features/ehs/bloc/ehs_site_obs_bloc_test.dart` | Create |
| `test/features/labor/bloc/labor_bloc_test.dart` | Create |
| `test/features/progress/bloc/progress_bloc_test.dart` | Create |
| `test/features/projects/bloc/project_bloc_test.dart` | Create |
| `test/features/tower_lens/bloc/tower_lens_bloc_test.dart` | Create |
| `test/features/profile/bloc/profile_bloc_test.dart` | Create |
| `test/core/auth/auth_service_test.dart` | Create |
| `test/widget/auth/login_page_test.dart` | Create |
| `test/widget/shared/severity_badge_test.dart` | Create |

All paths are relative to `flutter/`.

---

## Task 1: Mock setup + test fixtures + .gitignore

**Files:**
- Create: `test/helpers/mocks.dart`
- Create: `test/helpers/test_fixtures.dart`
- Modify: root `.gitignore`

- [ ] **Step 1: Create `test/helpers/mocks.dart`**

```dart
import 'package:mockito/annotations.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/auth_service.dart';
import 'package:setu_mobile/core/auth/token_manager.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/tower_lens/data/repositories/tower_progress_repository.dart';

@GenerateMocks([
  SetuApiClient,
  AppDatabase,
  SyncService,
  AuthService,
  TokenManager,
  TowerProgressRepository,
])
void main() {}
```

- [ ] **Step 2: Create `test/helpers/test_fixtures.dart`**

```dart
import 'package:setu_mobile/features/auth/data/models/user_model.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';
import 'package:setu_mobile/features/labor/data/models/labor_models.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

/// Canonical fake user for all auth tests.
final fakeUser = User(
  id: 1,
  username: 'test_user',
  email: 'test@setu.com',
  fullName: 'Test User',
  roles: ['site_engineer'],
  permissions: ['QUALITY.INSPECTION.APPROVE'],
  projectIds: [10, 20],
  isActive: true,
);

/// Fake user JSON matching the backend login response shape.
final fakeUserJson = {
  'id': 1,
  'username': 'test_user',
  'email': 'test@setu.com',
  'fullName': 'Test User',
  'roles': ['site_engineer'],
  'permissions': ['QUALITY.INSPECTION.APPROVE'],
  'projectIds': [10, 20],
  'isActive': true,
};

/// Fake login response (access token + inline user).
final fakeLoginResponse = {
  'access_token': 'fake_token_abc',
  'refresh_token': 'fake_refresh_xyz',
  'expires_in': 28800,
  'user': fakeUserJson,
};

/// Single fake quality site observation.
final fakeQualityObsJson = {
  'id': 'obs-001',
  'projectId': 10,
  'description': 'Crack in column C5',
  'severity': 'HIGH',
  'status': 'OPEN',
  'createdAt': '2026-04-01T10:00:00.000Z',
  'updatedAt': '2026-04-01T10:00:00.000Z',
  'photoUrls': [],
};

/// Single fake EHS observation.
final fakeEhsObsJson = {
  'id': 'ehs-001',
  'projectId': 10,
  'description': 'Worker without PPE on floor 3',
  'severity': 'HIGH',
  'status': 'OPEN',
  'createdAt': '2026-04-01T10:00:00.000Z',
  'updatedAt': '2026-04-01T10:00:00.000Z',
  'photoUrls': [],
};

/// Single fake project.
final fakeProjectJson = {
  'id': 10,
  'name': 'Purva Bliss',
  'code': 'PB-001',
  'status': 'ACTIVE',
  'progress': 45.5,
  'children': [],
};

/// Fake labor category.
final fakeLaborCategoryJson = {
  'id': 1,
  'name': 'Masons',
  'projectId': 10,
};

/// Fake daily labor entry (server response).
final fakeLaborEntryJson = {
  'categoryId': 1,
  'categoryName': 'Masons',
  'count': 5,
  'contractorName': 'ABC Contractors',
  'date': '2026-04-08',
};
```

- [ ] **Step 3: Add generated mock file to `.gitignore`**

Open `flutter/.gitignore` (or root `.gitignore`) and add:
```
# Generated mock files — regenerate with: flutter pub run build_runner build
test/helpers/mocks.mocks.dart
```

- [ ] **Step 4: Run build_runner to generate mocks**

```bash
cd flutter
flutter pub run build_runner build --delete-conflicting-outputs
```

Expected output: `[INFO] Succeeded after Xs with N outputs`  
Verify `test/helpers/mocks.mocks.dart` now exists.

- [ ] **Step 5: Commit setup**

```bash
cd flutter
git add test/helpers/mocks.dart test/helpers/test_fixtures.dart .gitignore
git commit -m "test: add mock generation setup and shared test fixtures"
```

---

## Task 2: User model tests

**Files:**
- Create: `test/features/auth/models/user_model_test.dart`

- [ ] **Step 1: Write the test file**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';

void main() {
  group('User.fromJson', () {
    test('parses all fields from a complete JSON map', () {
      final json = {
        'id': 42,
        'username': 'ravi_kumar',
        'email': 'ravi@setu.com',
        'fullName': 'Ravi Kumar',
        'roles': ['site_engineer', 'qc_inspector'],
        'permissions': ['QUALITY.INSPECTION.APPROVE'],
        'projectIds': [1, 2, 3],
        'phone': '9876543210',
        'designation': 'Site Engineer',
        'isActive': true,
        'isTempUser': false,
      };

      final user = User.fromJson(json);

      expect(user.id, 42);
      expect(user.username, 'ravi_kumar');
      expect(user.email, 'ravi@setu.com');
      expect(user.fullName, 'Ravi Kumar');
      expect(user.roles, ['site_engineer', 'qc_inspector']);
      expect(user.permissions, ['QUALITY.INSPECTION.APPROVE']);
      expect(user.projectIds, [1, 2, 3]);
      expect(user.phone, '9876543210');
      expect(user.designation, 'Site Engineer');
      expect(user.isActive, true);
      expect(user.isTempUser, false);
    });

    test('uses displayName fallback when fullName is absent', () {
      final json = {
        'id': 1,
        'username': 'u',
        'email': 'u@x.com',
        'displayName': 'Display Name',
      };
      final user = User.fromJson(json);
      expect(user.fullName, 'Display Name');
    });

    test('uses snake_case full_name as third fallback', () {
      final json = {
        'id': 1,
        'username': 'u',
        'email': 'u@x.com',
        'full_name': 'Snake Case Name',
      };
      final user = User.fromJson(json);
      expect(user.fullName, 'Snake Case Name');
    });

    test('handles missing optional fields with safe defaults', () {
      final json = {
        'id': 1,
        'username': 'minimal',
        'email': 'min@test.com',
      };
      final user = User.fromJson(json);
      expect(user.fullName, '');
      expect(user.roles, isEmpty);
      expect(user.permissions, isEmpty);
      expect(user.projectIds, isEmpty);
      expect(user.phone, isNull);
      expect(user.isActive, true);
      expect(user.isTempUser, false);
    });

    test('accepts both projectIds (camelCase) and project_ids (snake_case)', () {
      final snakeJson = {'id': 1, 'username': 'u', 'email': 'u@x.com', 'project_ids': [5, 6]};
      final camelJson = {'id': 1, 'username': 'u', 'email': 'u@x.com', 'projectIds': [7, 8]};

      expect(User.fromJson(snakeJson).projectIds, [5, 6]);
      expect(User.fromJson(camelJson).projectIds, [7, 8]);
    });

    test('parses temp user with nested vendor object', () {
      final json = {
        'id': 1,
        'username': 'vendor_u',
        'email': 'v@x.com',
        'isTempUser': true,
        'vendor': {'id': 99, 'name': 'ABC Contractors'},
      };
      final user = User.fromJson(json);
      expect(user.isTempUser, true);
      expect(user.vendorId, 99);
      expect(user.vendorName, 'ABC Contractors');
    });
  });

  group('User.toJson round-trip', () {
    test('toJson output can be parsed back to equal User', () {
      final original = User(
        id: 7,
        username: 'roundtrip',
        email: 'rt@test.com',
        fullName: 'Round Trip',
        roles: ['admin'],
        permissions: ['READ'],
        projectIds: [1],
      );
      final parsed = User.fromJson(original.toJson());
      expect(parsed, original);
    });
  });

  group('User helper methods', () {
    final user = User(
      id: 1,
      username: 'u',
      email: 'u@x.com',
      fullName: 'Ravi Kumar',
      roles: ['site_engineer', 'admin'],
      permissions: ['QUALITY.INSPECTION.APPROVE', 'EHS.OBS.CREATE'],
      projectIds: [10, 20],
    );

    test('hasRole returns true for an assigned role', () {
      expect(user.hasRole('admin'), true);
    });

    test('hasRole returns false for an unassigned role', () {
      expect(user.hasRole('qc_inspector'), false);
    });

    test('hasPermission returns true for an assigned permission', () {
      expect(user.hasPermission('EHS.OBS.CREATE'), true);
    });

    test('hasPermission returns false for an unassigned permission', () {
      expect(user.hasPermission('UNKNOWN.PERM'), false);
    });

    test('hasAnyRole returns true when at least one role matches', () {
      expect(user.hasAnyRole(['qc_inspector', 'admin']), true);
    });

    test('hasAnyRole returns false when no roles match', () {
      expect(user.hasAnyRole(['vendor', 'guest']), false);
    });

    test('hasProjectAccess returns true for an assigned project', () {
      expect(user.hasProjectAccess(10), true);
    });

    test('hasProjectAccess returns false for an unassigned project', () {
      expect(user.hasProjectAccess(99), false);
    });

    test('initials returns two-letter initial for a two-word name', () {
      expect(user.initials, 'RK');
    });

    test('initials returns one letter for a single-word name', () {
      final singleName = User(id: 1, username: 'u', email: 'u@x.com', fullName: 'Ravi');
      expect(singleName.initials, 'R');
    });

    test('initials falls back to username first letter when fullName is empty', () {
      final noName = User(id: 1, username: 'ravi', email: 'u@x.com', fullName: '');
      expect(noName.initials, 'R');
    });
  });
}
```

- [ ] **Step 2: Run the test**

```bash
cd flutter && flutter test test/features/auth/models/user_model_test.dart -v
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add test/features/auth/models/user_model_test.dart
git commit -m "test: add User model fromJson/toJson and helper method tests"
```

---

## Task 3: Quality, EHS, Labor, Project model tests

**Files:**
- Create: `test/features/quality/models/quality_models_test.dart`
- Create: `test/features/ehs/models/ehs_models_test.dart`
- Create: `test/features/labor/models/labor_models_test.dart`
- Create: `test/features/projects/models/project_model_test.dart`

- [ ] **Step 1: Create quality models test**

```dart
// test/features/quality/models/quality_models_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

void main() {
  group('QualitySiteObservation.fromJson', () {
    final json = {
      'id': 'obs-001',
      'projectId': 10,
      'description': 'Crack in column C5',
      'severity': 'HIGH',
      'status': 'OPEN',
      'createdAt': '2026-04-01T10:00:00.000Z',
      'updatedAt': '2026-04-01T10:00:00.000Z',
      'photoUrls': ['https://example.com/photo1.jpg'],
    };

    test('parses all required fields', () {
      final obs = QualitySiteObservation.fromJson(json);
      expect(obs.id, 'obs-001');
      expect(obs.projectId, 10);
      expect(obs.description, 'Crack in column C5');
      expect(obs.severity, 'HIGH');
      expect(obs.status, 'OPEN');
    });

    test('handles missing optional fields without throwing', () {
      final minimal = {'id': 'x', 'projectId': 1, 'description': 'd', 'severity': 'LOW', 'status': 'OPEN'};
      expect(() => QualitySiteObservation.fromJson(minimal), returnsNormally);
    });
  });

  group('ActivityDisplayStatus extension', () {
    test('locked has correct label', () {
      expect(ActivityDisplayStatus.locked.label, 'Locked');
    });

    test('approved has correct label', () {
      expect(ActivityDisplayStatus.approved.label, 'Approved');
    });

    test('pendingObservation has correct label', () {
      expect(ActivityDisplayStatus.pendingObservation.label, 'Fix Observation');
    });

    test('every status has a non-null color', () {
      for (final status in ActivityDisplayStatus.values) {
        expect(status.color, isNotNull);
      }
    });
  });
}
```

- [ ] **Step 2: Create EHS models test**

```dart
// test/features/ehs/models/ehs_models_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';

void main() {
  group('EhsObsStatus', () {
    test('fromString parses RECTIFIED', () {
      expect(EhsObsStatus.fromString('RECTIFIED'), EhsObsStatus.rectified);
    });

    test('fromString parses CLOSED', () {
      expect(EhsObsStatus.fromString('CLOSED'), EhsObsStatus.closed);
    });

    test('fromString defaults to open for unknown values', () {
      expect(EhsObsStatus.fromString('UNKNOWN'), EhsObsStatus.open);
    });

    test('fromString is case-insensitive', () {
      expect(EhsObsStatus.fromString('closed'), EhsObsStatus.closed);
    });

    test('every status has a label and color', () {
      for (final s in EhsObsStatus.values) {
        expect(s.label, isNotEmpty);
        expect(s.color, isNotNull);
      }
    });
  });
}
```

- [ ] **Step 3: Create labor models test**

```dart
// test/features/labor/models/labor_models_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/labor/data/models/labor_models.dart';

void main() {
  group('LaborCategory.fromJson', () {
    test('parses id and name', () {
      final cat = LaborCategory.fromJson({'id': 1, 'name': 'Masons', 'projectId': 10});
      expect(cat.id, 1);
      expect(cat.name, 'Masons');
    });
  });

  group('DailyLaborEntry', () {
    test('fromJson parses count and categoryName', () {
      final entry = DailyLaborEntry.fromJson({
        'categoryId': 1,
        'categoryName': 'Masons',
        'count': 5,
        'contractorName': 'ABC',
      });
      expect(entry.count, 5);
      expect(entry.categoryName, 'Masons');
      expect(entry.contractorName, 'ABC');
    });

    test('copyWith updates count and keeps other fields', () {
      final original = DailyLaborEntry(categoryId: 1, categoryName: 'Masons', count: 3);
      final updated = original.copyWith(count: 10);
      expect(updated.count, 10);
      expect(updated.categoryName, 'Masons');
    });

    test('toJson includes the date string passed in', () {
      final entry = DailyLaborEntry(categoryId: 1, categoryName: 'Masons', count: 5);
      final json = entry.toJson('2026-04-08');
      expect(json['date'], '2026-04-08');
      expect(json['count'], 5);
    });
  });
}
```

- [ ] **Step 4: Create project model test**

```dart
// test/features/projects/models/project_model_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

void main() {
  group('Project.fromJson', () {
    final json = {
      'id': 10,
      'name': 'Purva Bliss',
      'code': 'PB-001',
      'status': 'ACTIVE',
      'progress': 45.5,
      'startDate': '2025-01-01T00:00:00.000Z',
      'children': [],
    };

    test('parses id and name', () {
      final p = Project.fromJson(json);
      expect(p.id, 10);
      expect(p.name, 'Purva Bliss');
    });

    test('parses progress as double', () {
      final p = Project.fromJson(json);
      expect(p.progress, 45.5);
    });

    test('handles null startDate without throwing', () {
      final j = Map<String, dynamic>.from(json)..['startDate'] = null;
      expect(() => Project.fromJson(j), returnsNormally);
    });

    test('toJson round-trip preserves id and name', () {
      final p = Project.fromJson(json);
      final reparsed = Project.fromJson(p.toJson());
      expect(reparsed.id, p.id);
      expect(reparsed.name, p.name);
    });
  });
}
```

- [ ] **Step 5: Run all model tests**

```bash
cd flutter && flutter test test/features/auth/models/ test/features/quality/models/ test/features/ehs/models/ test/features/labor/models/ test/features/projects/models/ -v
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add test/features/
git commit -m "test: add model unit tests for User, Quality, EHS, Labor, Project"
```

---

## Task 4: AuthBloc tests

**Files:**
- Create: `test/features/auth/bloc/auth_bloc_test.dart`

Dependencies: `MockAuthService` from `mocks.mocks.dart`.

- [ ] **Step 1: Create the test file**

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import '../../../helpers/mocks.mocks.dart';
import '../../../helpers/test_fixtures.dart';

void main() {
  late MockAuthService mockAuthService;

  setUp(() {
    mockAuthService = MockAuthService();
  });

  group('AuthBloc', () {
    test('initial state is AuthInitial', () {
      final bloc = AuthBloc(authService: mockAuthService);
      expect(bloc.state, isA<AuthInitial>());
      bloc.close();
    });

    group('CheckAuthStatus', () {
      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthAuthenticated] when token is valid',
        build: () {
          when(mockAuthService.isLoggedIn()).thenAnswer((_) async => true);
          when(mockAuthService.getProfile()).thenAnswer((_) async => fakeUser);
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(CheckAuthStatus()),
        expect: () => [isA<AuthLoading>(), isA<AuthAuthenticated>()],
        verify: (_) {
          verify(mockAuthService.isLoggedIn()).called(1);
          verify(mockAuthService.getProfile()).called(1);
        },
      );

      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthUnauthenticated] when no token found',
        build: () {
          when(mockAuthService.isLoggedIn()).thenAnswer((_) async => false);
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(CheckAuthStatus()),
        expect: () => [isA<AuthLoading>(), isA<AuthUnauthenticated>()],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthUnauthenticated] when isLoggedIn throws',
        build: () {
          when(mockAuthService.isLoggedIn()).thenThrow(Exception('DB error'));
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(CheckAuthStatus()),
        expect: () => [isA<AuthLoading>(), isA<AuthUnauthenticated>()],
      );

      blocTest<AuthBloc, AuthState>(
        'AuthAuthenticated carries the full user object',
        build: () {
          when(mockAuthService.isLoggedIn()).thenAnswer((_) async => true);
          when(mockAuthService.getProfile()).thenAnswer((_) async => fakeUser);
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(CheckAuthStatus()),
        expect: () => [
          isA<AuthLoading>(),
          isA<AuthAuthenticated>().having((s) => s.user.username, 'username', 'test_user'),
        ],
      );
    });

    group('Login', () {
      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthAuthenticated] on successful login',
        build: () {
          when(mockAuthService.login(username: 'user', password: 'pass'))
              .thenAnswer((_) async => fakeUser);
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(const Login(username: 'user', password: 'pass')),
        expect: () => [isA<AuthLoading>(), isA<AuthAuthenticated>()],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthError] with credential message on 401',
        build: () {
          when(mockAuthService.login(username: anyNamed('username'), password: anyNamed('password')))
              .thenThrow(Exception('401 Unauthorized'));
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(const Login(username: 'bad', password: 'wrong')),
        expect: () => [
          isA<AuthLoading>(),
          isA<AuthError>().having(
            (s) => s.message,
            'message',
            contains('Invalid username or password'),
          ),
        ],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthError] with WiFi hint on connection refused',
        build: () {
          when(mockAuthService.login(username: anyNamed('username'), password: anyNamed('password')))
              .thenThrow(Exception('ConnectionError: connection refused'));
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(const Login(username: 'u', password: 'p')),
        expect: () => [
          isA<AuthLoading>(),
          isA<AuthError>().having((s) => s.message, 'message', contains('WiFi')),
        ],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthError] with timeout message on timeout',
        build: () {
          when(mockAuthService.login(username: anyNamed('username'), password: anyNamed('password')))
              .thenThrow(Exception('Connection timed out'));
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(const Login(username: 'u', password: 'p')),
        expect: () => [
          isA<AuthLoading>(),
          isA<AuthError>().having((s) => s.message, 'message', contains('timed out')),
        ],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthError] with vendor expiry message on TEMP_EXPIRED',
        build: () {
          when(mockAuthService.login(username: anyNamed('username'), password: anyNamed('password')))
              .thenThrow(Exception('TEMP_EXPIRED'));
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(const Login(username: 'u', password: 'p')),
        expect: () => [
          isA<AuthLoading>(),
          isA<AuthError>().having((s) => s.message, 'message', contains('Temporary vendor')),
        ],
      );
    });

    group('Logout', () {
      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthUnauthenticated] on logout success',
        build: () {
          when(mockAuthService.logout()).thenAnswer((_) async {});
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(Logout()),
        expect: () => [isA<AuthLoading>(), isA<AuthUnauthenticated>()],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [AuthLoading, AuthUnauthenticated] even when logout throws',
        build: () {
          when(mockAuthService.logout()).thenThrow(Exception('network error'));
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(Logout()),
        expect: () => [isA<AuthLoading>(), isA<AuthUnauthenticated>()],
      );
    });

    group('RefreshProfile', () {
      blocTest<AuthBloc, AuthState>(
        'emits [AuthAuthenticated] with updated user on success',
        build: () {
          when(mockAuthService.getProfile()).thenAnswer((_) async => fakeUser);
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(RefreshProfile()),
        expect: () => [isA<AuthAuthenticated>()],
      );

      blocTest<AuthBloc, AuthState>(
        'emits nothing when refresh fails (silent — do not log out)',
        build: () {
          when(mockAuthService.getProfile()).thenThrow(Exception('network error'));
          return AuthBloc(authService: mockAuthService);
        },
        act: (bloc) => bloc.add(RefreshProfile()),
        expect: () => [],
      );
    });
  });
}
```

- [ ] **Step 2: Run the test**

```bash
cd flutter && flutter test test/features/auth/bloc/auth_bloc_test.dart -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add test/features/auth/bloc/auth_bloc_test.dart
git commit -m "test: add AuthBloc state machine tests for all events"
```

---

## Task 5: QualitySiteObsBloc tests

**Files:**
- Create: `test/features/quality/bloc/quality_site_obs_bloc_test.dart`

Dependencies: `MockSetuApiClient`, `MockAppDatabase`, `MockSyncService`.

Note: `SyncResult` is defined in `sync_service.dart`. `AppDatabase.getCachedQualitySiteObs` returns a list of `CachedQualitySiteObsData` with a `.rawData` String field. We need to create a fake for that return value.

- [ ] **Step 1: Create the test file**

```dart
import 'dart:convert';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';
import '../../../helpers/mocks.mocks.dart';
import '../../../helpers/test_fixtures.dart';

/// Minimal fake for a cached quality obs row (has a .rawData string field).
class _FakeCachedQualityObsRow {
  final String rawData;
  _FakeCachedQualityObsRow(this.rawData);
}

void main() {
  late MockSetuApiClient mockApi;
  late MockAppDatabase mockDb;
  late MockSyncService mockSync;

  QualitySiteObsBloc buildBloc() => QualitySiteObsBloc(
        apiClient: mockApi,
        database: mockDb,
        syncService: mockSync,
      );

  setUp(() {
    mockApi = MockSetuApiClient();
    mockDb = MockAppDatabase();
    mockSync = MockSyncService();
  });

  group('QualitySiteObsBloc', () {
    test('initial state is QualitySiteObsInitial', () {
      final bloc = buildBloc();
      expect(bloc.state, isA<QualitySiteObsInitial>());
      bloc.close();
    });

    group('LoadQualitySiteObs', () {
      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'emits [Loading, Loaded] when API returns data',
        build: () {
          when(mockApi.getQualitySiteObs(
            projectId: anyNamed('projectId'),
            status: anyNamed('status'),
            severity: anyNamed('severity'),
            limit: anyNamed('limit'),
            offset: anyNamed('offset'),
          )).thenAnswer((_) async => [fakeQualityObsJson]);
          when(mockDb.cacheQualitySiteObs(any, any)).thenAnswer((_) async {});
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
        expect: () => [
          isA<QualitySiteObsLoading>(),
          isA<QualitySiteObsLoaded>().having(
            (s) => s.observations.length,
            'observation count',
            1,
          ),
        ],
      );

      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'emits [Loading, Loaded(fromCache:true)] when API fails and cache exists',
        build: () {
          when(mockApi.getQualitySiteObs(
            projectId: anyNamed('projectId'),
            status: anyNamed('status'),
            severity: anyNamed('severity'),
            limit: anyNamed('limit'),
            offset: anyNamed('offset'),
          )).thenThrow(Exception('No internet'));
          when(mockDb.getCachedQualitySiteObs(any, any)).thenAnswer((_) async {
            // Return a list with one fake row where rawData is the obs JSON.
            final fakeRow = _FakeCachedQualityObsRow(jsonEncode(fakeQualityObsJson));
            return [fakeRow] as dynamic;
          });
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
        expect: () => [
          isA<QualitySiteObsLoading>(),
          isA<QualitySiteObsLoaded>().having((s) => s.fromCache, 'fromCache', true),
        ],
      );

      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'emits [Loading, Error] when both API and cache fail',
        build: () {
          when(mockApi.getQualitySiteObs(
            projectId: anyNamed('projectId'),
            status: anyNamed('status'),
            severity: anyNamed('severity'),
            limit: anyNamed('limit'),
            offset: anyNamed('offset'),
          )).thenThrow(Exception('No internet'));
          when(mockDb.getCachedQualitySiteObs(any, any))
              .thenThrow(Exception('Cache empty'));
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
        expect: () => [isA<QualitySiteObsLoading>(), isA<QualitySiteObsError>()],
      );

      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'Loaded state has hasMore=true when full page (25) returned',
        build: () {
          // Return exactly 25 items (the page limit)
          final items = List.generate(25, (_) => Map<String, dynamic>.from(fakeQualityObsJson));
          when(mockApi.getQualitySiteObs(
            projectId: anyNamed('projectId'),
            status: anyNamed('status'),
            severity: anyNamed('severity'),
            limit: anyNamed('limit'),
            offset: anyNamed('offset'),
          )).thenAnswer((_) async => items);
          when(mockDb.cacheQualitySiteObs(any, any)).thenAnswer((_) async {});
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
        expect: () => [
          isA<QualitySiteObsLoading>(),
          isA<QualitySiteObsLoaded>().having((s) => s.hasMore, 'hasMore', true),
        ],
      );

      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'Loaded state has hasMore=false when less than 25 items returned',
        build: () {
          when(mockApi.getQualitySiteObs(
            projectId: anyNamed('projectId'),
            status: anyNamed('status'),
            severity: anyNamed('severity'),
            limit: anyNamed('limit'),
            offset: anyNamed('offset'),
          )).thenAnswer((_) async => [fakeQualityObsJson]);
          when(mockDb.cacheQualitySiteObs(any, any)).thenAnswer((_) async {});
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
        expect: () => [
          isA<QualitySiteObsLoading>(),
          isA<QualitySiteObsLoaded>().having((s) => s.hasMore, 'hasMore', false),
        ],
      );
    });

    group('CreateQualitySiteObs', () {
      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'emits [ActionSuccess("created")] when online sync succeeds',
        build: () {
          when(mockSync.addToQueue(
            entityType: anyNamed('entityType'),
            entityId: anyNamed('entityId'),
            operation: anyNamed('operation'),
            payload: anyNamed('payload'),
            priority: anyNamed('priority'),
          )).thenAnswer((_) async {});
          final result = SyncResult()..success = true;
          when(mockSync.syncAll()).thenAnswer((_) async => result);
          return buildBloc();
        },
        act: (bloc) => bloc.add(const CreateQualitySiteObs(
          projectId: 10,
          description: 'Test observation',
          severity: 'HIGH',
        )),
        expect: () => [
          isA<QualitySiteObsActionSuccess>().having((s) => s.action, 'action', 'created'),
        ],
      );

      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'emits [ActionSuccess("created_offline")] when sync fails (queued offline)',
        build: () {
          when(mockSync.addToQueue(
            entityType: anyNamed('entityType'),
            entityId: anyNamed('entityId'),
            operation: anyNamed('operation'),
            payload: anyNamed('payload'),
            priority: anyNamed('priority'),
          )).thenAnswer((_) async {});
          final result = SyncResult()..success = false;
          when(mockSync.syncAll()).thenAnswer((_) async => result);
          return buildBloc();
        },
        act: (bloc) => bloc.add(const CreateQualitySiteObs(
          projectId: 10,
          description: 'Offline obs',
          severity: 'MEDIUM',
        )),
        expect: () => [
          isA<QualitySiteObsActionSuccess>()
              .having((s) => s.action, 'action', 'created_offline'),
        ],
      );

      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'emits [ActionError] when addToQueue throws',
        build: () {
          when(mockSync.addToQueue(
            entityType: anyNamed('entityType'),
            entityId: anyNamed('entityId'),
            operation: anyNamed('operation'),
            payload: anyNamed('payload'),
            priority: anyNamed('priority'),
          )).thenThrow(Exception('DB full'));
          return buildBloc();
        },
        act: (bloc) => bloc.add(const CreateQualitySiteObs(
          projectId: 10,
          description: 'Failing obs',
          severity: 'LOW',
        )),
        expect: () => [isA<QualitySiteObsActionError>()],
      );
    });

    group('DeleteQualitySiteObs', () {
      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'emits [ActionSuccess("deleted")] on successful API delete',
        build: () {
          when(mockApi.deleteQualitySiteObs(id: anyNamed('id')))
              .thenAnswer((_) async {});
          return buildBloc();
        },
        act: (bloc) => bloc.add(const DeleteQualitySiteObs(id: 'obs-001')),
        expect: () => [
          isA<QualitySiteObsActionSuccess>()
              .having((s) => s.action, 'action', 'deleted'),
        ],
      );

      blocTest<QualitySiteObsBloc, QualitySiteObsState>(
        'emits [ActionError] when delete API throws',
        build: () {
          when(mockApi.deleteQualitySiteObs(id: anyNamed('id')))
              .thenThrow(Exception('Not found'));
          return buildBloc();
        },
        act: (bloc) => bloc.add(const DeleteQualitySiteObs(id: 'obs-999')),
        expect: () => [isA<QualitySiteObsActionError>()],
      );
    });
  });
}
```

- [ ] **Step 2: Run the test**

```bash
cd flutter && flutter test test/features/quality/bloc/quality_site_obs_bloc_test.dart -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add test/features/quality/bloc/quality_site_obs_bloc_test.dart
git commit -m "test: add QualitySiteObsBloc tests — load, cache fallback, CRUD, offline path"
```

---

## Task 6: EhsSiteObsBloc tests

**Files:**
- Create: `test/features/ehs/bloc/ehs_site_obs_bloc_test.dart`

Note: `EhsSiteObsBloc` has the same pattern as `QualitySiteObsBloc` — load/refresh/create/rectify/close/delete using `SetuApiClient`, `AppDatabase`, `SyncService`.

- [ ] **Step 1: Create the test file**

```dart
import 'dart:convert';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import '../../../helpers/mocks.mocks.dart';
import '../../../helpers/test_fixtures.dart';

void main() {
  late MockSetuApiClient mockApi;
  late MockAppDatabase mockDb;
  late MockSyncService mockSync;

  EhsSiteObsBloc buildBloc() => EhsSiteObsBloc(
        apiClient: mockApi,
        database: mockDb,
        syncService: mockSync,
      );

  setUp(() {
    mockApi = MockSetuApiClient();
    mockDb = MockAppDatabase();
    mockSync = MockSyncService();
  });

  group('EhsSiteObsBloc', () {
    test('initial state is EhsSiteObsInitial', () {
      final bloc = buildBloc();
      expect(bloc.state, isA<EhsSiteObsInitial>());
      bloc.close();
    });

    group('LoadEhsSiteObs', () {
      blocTest<EhsSiteObsBloc, EhsSiteObsState>(
        'emits [Loading, Loaded] when API returns data',
        build: () {
          when(mockApi.getEhsSiteObs(
            projectId: anyNamed('projectId'),
            status: anyNamed('status'),
            severity: anyNamed('severity'),
            limit: anyNamed('limit'),
            offset: anyNamed('offset'),
          )).thenAnswer((_) async => [fakeEhsObsJson]);
          when(mockDb.cacheEhsSiteObs(any, any)).thenAnswer((_) async {});
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadEhsSiteObs(projectId: 10)),
        expect: () => [
          isA<EhsSiteObsLoading>(),
          isA<EhsSiteObsLoaded>().having((s) => s.observations.length, 'count', 1),
        ],
      );

      blocTest<EhsSiteObsBloc, EhsSiteObsState>(
        'emits [Loading, Loaded(fromCache:true)] when API fails and cache exists',
        build: () {
          when(mockApi.getEhsSiteObs(
            projectId: anyNamed('projectId'),
            status: anyNamed('status'),
            severity: anyNamed('severity'),
            limit: anyNamed('limit'),
            offset: anyNamed('offset'),
          )).thenThrow(Exception('Offline'));
          when(mockDb.getCachedEhsSiteObs(any, any)).thenAnswer((_) async {
            final fake = _FakeCachedEhsRow(jsonEncode(fakeEhsObsJson));
            return [fake] as dynamic;
          });
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadEhsSiteObs(projectId: 10)),
        expect: () => [
          isA<EhsSiteObsLoading>(),
          isA<EhsSiteObsLoaded>().having((s) => s.fromCache, 'fromCache', true),
        ],
      );

      blocTest<EhsSiteObsBloc, EhsSiteObsState>(
        'emits [Loading, Error] when API and cache both fail',
        build: () {
          when(mockApi.getEhsSiteObs(
            projectId: anyNamed('projectId'),
            status: anyNamed('status'),
            severity: anyNamed('severity'),
            limit: anyNamed('limit'),
            offset: anyNamed('offset'),
          )).thenThrow(Exception('Offline'));
          when(mockDb.getCachedEhsSiteObs(any, any)).thenThrow(Exception('Empty'));
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadEhsSiteObs(projectId: 10)),
        expect: () => [isA<EhsSiteObsLoading>(), isA<EhsSiteObsError>()],
      );
    });

    group('CreateEhsSiteObs', () {
      blocTest<EhsSiteObsBloc, EhsSiteObsState>(
        'emits [ActionSuccess("created")] when online sync succeeds',
        build: () {
          when(mockSync.addToQueue(
            entityType: anyNamed('entityType'),
            entityId: anyNamed('entityId'),
            operation: anyNamed('operation'),
            payload: anyNamed('payload'),
            priority: anyNamed('priority'),
          )).thenAnswer((_) async {});
          final result = SyncResult()..success = true;
          when(mockSync.syncAll()).thenAnswer((_) async => result);
          return buildBloc();
        },
        act: (bloc) => bloc.add(const CreateEhsSiteObs(
          projectId: 10,
          description: 'Worker without helmet',
          severity: 'HIGH',
        )),
        expect: () => [
          isA<EhsSiteObsActionSuccess>().having((s) => s.action, 'action', 'created'),
        ],
      );

      blocTest<EhsSiteObsBloc, EhsSiteObsState>(
        'emits [ActionSuccess("created_offline")] when sync fails',
        build: () {
          when(mockSync.addToQueue(
            entityType: anyNamed('entityType'),
            entityId: anyNamed('entityId'),
            operation: anyNamed('operation'),
            payload: anyNamed('payload'),
            priority: anyNamed('priority'),
          )).thenAnswer((_) async {});
          final result = SyncResult()..success = false;
          when(mockSync.syncAll()).thenAnswer((_) async => result);
          return buildBloc();
        },
        act: (bloc) => bloc.add(const CreateEhsSiteObs(
          projectId: 10,
          description: 'Offline obs',
          severity: 'MEDIUM',
        )),
        expect: () => [
          isA<EhsSiteObsActionSuccess>()
              .having((s) => s.action, 'action', 'created_offline'),
        ],
      );
    });
  });
}

class _FakeCachedEhsRow {
  final String rawData;
  _FakeCachedEhsRow(this.rawData);
}
```

- [ ] **Step 2: Run the test**

```bash
cd flutter && flutter test test/features/ehs/bloc/ehs_site_obs_bloc_test.dart -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add test/features/ehs/bloc/ehs_site_obs_bloc_test.dart
git commit -m "test: add EhsSiteObsBloc tests — load, cache fallback, create online/offline"
```

---

## Task 7: LaborBloc tests

**Files:**
- Create: `test/features/labor/bloc/labor_bloc_test.dart`

Note: `LaborBloc` only depends on `SetuApiClient` — no DB or sync.

- [ ] **Step 1: Create the test file**

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/labor/presentation/bloc/labor_bloc.dart';
import '../../../helpers/mocks.mocks.dart';
import '../../../helpers/test_fixtures.dart';

void main() {
  late MockSetuApiClient mockApi;

  LaborBloc buildBloc() => LaborBloc(apiClient: mockApi);

  setUp(() {
    mockApi = MockSetuApiClient();
  });

  group('LaborBloc', () {
    test('initial state is LaborInitial', () {
      expect(buildBloc().state, isA<LaborInitial>());
    });

    group('LoadLaborPresence', () {
      blocTest<LaborBloc, LaborState>(
        'emits [LaborLoading, LaborLoaded] with merged entries',
        build: () {
          when(mockApi.getLaborCategories(projectId: anyNamed('projectId')))
              .thenAnswer((_) async => [fakeLaborCategoryJson]);
          when(mockApi.getLaborPresence(
            projectId: anyNamed('projectId'),
            date: anyNamed('date'),
          )).thenAnswer((_) async => [fakeLaborEntryJson]);
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadLaborPresence(projectId: 10, date: '2026-04-08')),
        expect: () => [
          isA<LaborLoading>(),
          isA<LaborLoaded>().having((s) => s.entries.length, 'entries count', 1),
        ],
      );

      blocTest<LaborBloc, LaborState>(
        'calculates totalWorkers from merged entries',
        build: () {
          when(mockApi.getLaborCategories(projectId: anyNamed('projectId')))
              .thenAnswer((_) async => [fakeLaborCategoryJson]);
          when(mockApi.getLaborPresence(
            projectId: anyNamed('projectId'),
            date: anyNamed('date'),
          )).thenAnswer((_) async => [fakeLaborEntryJson]); // count: 5
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadLaborPresence(projectId: 10, date: '2026-04-08')),
        expect: () => [
          isA<LaborLoading>(),
          isA<LaborLoaded>().having((s) => s.totalWorkers, 'total', 5),
        ],
      );

      blocTest<LaborBloc, LaborState>(
        'emits [LaborLoading, LaborError] when API throws',
        build: () {
          when(mockApi.getLaborCategories(projectId: anyNamed('projectId')))
              .thenThrow(Exception('Network error'));
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadLaborPresence(projectId: 10, date: '2026-04-08')),
        expect: () => [isA<LaborLoading>(), isA<LaborError>()],
      );
    });

    group('UpdateLaborEntry', () {
      blocTest<LaborBloc, LaborState>(
        'updates count for specified categoryId and recalculates total',
        build: () {
          when(mockApi.getLaborCategories(projectId: anyNamed('projectId')))
              .thenAnswer((_) async => [fakeLaborCategoryJson]);
          when(mockApi.getLaborPresence(
            projectId: anyNamed('projectId'),
            date: anyNamed('date'),
          )).thenAnswer((_) async => []);
          return buildBloc();
        },
        seed: () => const LaborLoaded(
          entries: [],
          totalWorkers: 0,
        ),
        act: (bloc) => bloc.add(
          const UpdateLaborEntry(categoryId: 1, count: 10),
        ),
        // When state is LaborLoaded with empty entries, the update finds no
        // matching categoryId and keeps entries the same — total stays 0.
        expect: () => [isA<LaborLoaded>()],
      );

      blocTest<LaborBloc, LaborState>(
        'does nothing when current state is not LaborLoaded',
        build: () => buildBloc(),
        // Initial state is LaborInitial — UpdateLaborEntry should be ignored.
        act: (bloc) => bloc.add(const UpdateLaborEntry(categoryId: 1, count: 5)),
        expect: () => [],
      );
    });

    group('SaveLaborPresence', () {
      blocTest<LaborBloc, LaborState>(
        'emits [LaborSaving, LaborSaveSuccess] when save succeeds',
        build: () {
          when(mockApi.saveLaborPresence(
            projectId: anyNamed('projectId'),
            entries: anyNamed('entries'),
          )).thenAnswer((_) async {});
          return buildBloc();
        },
        seed: () => LaborLoaded(
          entries: [
            const _LaborEntry(categoryId: 1, categoryName: 'Masons', count: 5),
          ],
          totalWorkers: 5,
        ),
        act: (bloc) => bloc.add(const SaveLaborPresence(projectId: 10, date: '2026-04-08')),
        expect: () => [
          isA<LaborSaving>(),
          isA<LaborSaveSuccess>().having((s) => s.savedCount, 'savedCount', 1),
        ],
      );

      blocTest<LaborBloc, LaborState>(
        'emits [LaborSaveError] when all entries have count 0',
        build: () => buildBloc(),
        seed: () => LaborLoaded(
          entries: [
            const _LaborEntry(categoryId: 1, categoryName: 'Masons', count: 0),
          ],
          totalWorkers: 0,
        ),
        act: (bloc) => bloc.add(const SaveLaborPresence(projectId: 10, date: '2026-04-08')),
        expect: () => [isA<LaborSaveError>()],
      );

      blocTest<LaborBloc, LaborState>(
        'emits [LaborSaving, LaborSaveError] when API throws during save',
        build: () {
          when(mockApi.saveLaborPresence(
            projectId: anyNamed('projectId'),
            entries: anyNamed('entries'),
          )).thenThrow(Exception('Server error'));
          return buildBloc();
        },
        seed: () => LaborLoaded(
          entries: [
            const _LaborEntry(categoryId: 1, categoryName: 'Masons', count: 3),
          ],
          totalWorkers: 3,
        ),
        act: (bloc) => bloc.add(const SaveLaborPresence(projectId: 10, date: '2026-04-08')),
        expect: () => [isA<LaborSaving>(), isA<LaborSaveError>()],
      );
    });
  });
}

// Alias DailyLaborEntry as _LaborEntry for readability in seed states.
// This avoids importing the full model just for the test.
typedef _LaborEntry = DailyLaborEntry;
```

- [ ] **Step 2: Run the test**

```bash
cd flutter && flutter test test/features/labor/bloc/labor_bloc_test.dart -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add test/features/labor/bloc/labor_bloc_test.dart
git commit -m "test: add LaborBloc tests — load, update, save, zero-count guard"
```

---

## Task 8: ProgressBloc tests

**Files:**
- Create: `test/features/progress/bloc/progress_bloc_test.dart`

Note: `ProgressBloc` depends on `SetuApiClient`, `AppDatabase`, and `SyncService`.

- [ ] **Step 1: Create the test file**

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/progress/data/models/progress_model.dart';
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';
import '../../../helpers/mocks.mocks.dart';

void main() {
  late MockSetuApiClient mockApi;
  late MockAppDatabase mockDb;
  late MockSyncService mockSync;

  ProgressBloc buildBloc() => ProgressBloc(
        apiClient: mockApi,
        database: mockDb,
        syncService: mockSync,
      );

  setUp(() {
    mockApi = MockSetuApiClient();
    mockDb = MockAppDatabase();
    mockSync = MockSyncService();
  });

  group('ProgressBloc', () {
    test('initial state is ProgressInitial', () {
      expect(buildBloc().state, isA<ProgressInitial>());
    });

    group('SaveProgress', () {
      blocTest<ProgressBloc, ProgressState>(
        'emits [ProgressSaving, ProgressSaved] on successful save',
        build: () {
          when(mockDb.insertProgressEntry(any)).thenAnswer((_) async => 1);
          final syncResult = SyncResult()..success = true;
          when(mockSync.syncAll()).thenAnswer((_) async => syncResult);
          return buildBloc();
        },
        act: (bloc) => bloc.add(SaveProgress(
          ProgressEntry(
            projectId: 10,
            activityId: 100,
            percentage: 50.0,
            date: '2026-04-08',
          ),
        )),
        expect: () => [isA<ProgressSaving>(), isA<ProgressSaved>()],
      );

      blocTest<ProgressBloc, ProgressState>(
        'emits [ProgressSaving, ProgressError] when DB insert throws',
        build: () {
          when(mockDb.insertProgressEntry(any)).thenThrow(Exception('DB full'));
          return buildBloc();
        },
        act: (bloc) => bloc.add(SaveProgress(
          ProgressEntry(
            projectId: 10,
            activityId: 100,
            percentage: 50.0,
            date: '2026-04-08',
          ),
        )),
        expect: () => [isA<ProgressSaving>(), isA<ProgressError>()],
      );
    });

    group('LoadPendingApprovals', () {
      blocTest<ProgressBloc, ProgressState>(
        'emits [ProgressLoading, ApprovalsLoaded] when API returns data',
        build: () {
          when(mockApi.getPendingApprovals(projectId: anyNamed('projectId')))
              .thenAnswer((_) async => []);
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadPendingApprovals(10)),
        expect: () => [isA<ProgressLoading>(), isA<ApprovalsLoaded>()],
      );

      blocTest<ProgressBloc, ProgressState>(
        'emits [ProgressLoading, ProgressError] when API throws',
        build: () {
          when(mockApi.getPendingApprovals(projectId: anyNamed('projectId')))
              .thenThrow(Exception('Server error'));
          return buildBloc();
        },
        act: (bloc) => bloc.add(const LoadPendingApprovals(10)),
        expect: () => [isA<ProgressLoading>(), isA<ProgressError>()],
      );
    });
  });
}
```

- [ ] **Step 2: Run the test**

```bash
cd flutter && flutter test test/features/progress/bloc/progress_bloc_test.dart -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add test/features/progress/bloc/progress_bloc_test.dart
git commit -m "test: add ProgressBloc tests — save offline-first, load approvals"
```

---

## Task 9: ProjectBloc tests

**Files:**
- Create: `test/features/projects/bloc/project_bloc_test.dart`

- [ ] **Step 1: Create the test file**

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import '../../../helpers/mocks.mocks.dart';
import '../../../helpers/test_fixtures.dart';

void main() {
  late MockSetuApiClient mockApi;
  late MockAppDatabase mockDb;

  ProjectBloc buildBloc() => ProjectBloc(
        apiClient: mockApi,
        database: mockDb,
      );

  setUp(() {
    mockApi = MockSetuApiClient();
    mockDb = MockAppDatabase();
  });

  group('ProjectBloc', () {
    test('initial state is ProjectInitial', () {
      expect(buildBloc().state, isA<ProjectInitial>());
    });

    group('LoadProjects', () {
      blocTest<ProjectBloc, ProjectState>(
        'emits [ProjectsLoading, ProjectsLoaded] when API returns data',
        build: () {
          when(mockApi.getProjects()).thenAnswer((_) async => [fakeProjectJson]);
          when(mockDb.cacheProjects(any)).thenAnswer((_) async {});
          return buildBloc();
        },
        act: (bloc) => bloc.add(LoadProjects()),
        expect: () => [
          isA<ProjectsLoading>(),
          isA<ProjectsLoaded>().having((s) => s.projects.length, 'count', 1),
        ],
      );

      blocTest<ProjectBloc, ProjectState>(
        'emits [ProjectsLoading, ProjectsError] when API throws',
        build: () {
          when(mockApi.getProjects()).thenThrow(Exception('Unauthorized'));
          when(mockDb.getCachedProjects()).thenThrow(Exception('No cache'));
          return buildBloc();
        },
        act: (bloc) => bloc.add(LoadProjects()),
        expect: () => [isA<ProjectsLoading>(), isA<ProjectsError>()],
      );
    });
  });
}
```

- [ ] **Step 2: Run the test**

```bash
cd flutter && flutter test test/features/projects/bloc/project_bloc_test.dart -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add test/features/projects/bloc/project_bloc_test.dart
git commit -m "test: add ProjectBloc load tests"
```

---

## Task 10: TowerLensBloc + ProfileBloc tests

**Files:**
- Create: `test/features/tower_lens/bloc/tower_lens_bloc_test.dart`
- Create: `test/features/profile/bloc/profile_bloc_test.dart`

- [ ] **Step 1: Create tower lens bloc test**

```dart
// test/features/tower_lens/bloc/tower_lens_bloc_test.dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_view_mode.dart';
import 'package:setu_mobile/features/tower_lens/presentation/bloc/tower_lens_bloc.dart';
import '../../../helpers/mocks.mocks.dart';

void main() {
  late MockTowerProgressRepository mockRepo;

  TowerLensBloc buildBloc() => TowerLensBloc(repository: mockRepo);

  setUp(() {
    mockRepo = MockTowerProgressRepository();
  });

  group('TowerLensBloc', () {
    test('initial state is TowerLensInitial', () {
      expect(buildBloc().state, isA<TowerLensInitial>());
    });

    blocTest<TowerLensBloc, TowerLensState>(
      'emits [TowerLensLoading, TowerLensLoaded] when repository returns data',
      build: () {
        when(mockRepo.getTowerRenderModels(projectId: anyNamed('projectId')))
            .thenAnswer((_) async => <TowerRenderModel>[]);
        return buildBloc();
      },
      act: (bloc) => bloc.add(const LoadTowerLens(10)),
      expect: () => [isA<TowerLensLoading>(), isA<TowerLensLoaded>()],
    );

    blocTest<TowerLensBloc, TowerLensState>(
      'emits [TowerLensLoading, TowerLensError] when repository throws',
      build: () {
        when(mockRepo.getTowerRenderModels(projectId: anyNamed('projectId')))
            .thenThrow(Exception('Network error'));
        return buildBloc();
      },
      act: (bloc) => bloc.add(const LoadTowerLens(10)),
      expect: () => [isA<TowerLensLoading>(), isA<TowerLensError>()],
    );

    blocTest<TowerLensBloc, TowerLensState>(
      'ChangeTowerViewMode updates the active mode in the loaded state',
      build: () {
        when(mockRepo.getTowerRenderModels(projectId: anyNamed('projectId')))
            .thenAnswer((_) async => <TowerRenderModel>[]);
        return buildBloc();
      },
      act: (bloc) async {
        bloc.add(const LoadTowerLens(10));
        await Future.delayed(Duration.zero);
        bloc.add(const ChangeTowerViewMode(TowerViewMode.quality));
      },
      expect: () => [
        isA<TowerLensLoading>(),
        isA<TowerLensLoaded>(),
        isA<TowerLensLoaded>().having(
          (s) => s.viewMode,
          'viewMode',
          TowerViewMode.quality,
        ),
      ],
    );
  });
}
```

- [ ] **Step 2: Create profile bloc test**

```dart
// test/features/profile/bloc/profile_bloc_test.dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/profile/presentation/bloc/profile_bloc.dart';
import '../../../helpers/mocks.mocks.dart';
import '../../../helpers/test_fixtures.dart';

void main() {
  late MockSetuApiClient mockApi;

  ProfileBloc buildBloc() => ProfileBloc(apiClient: mockApi);

  setUp(() {
    mockApi = MockSetuApiClient();
  });

  group('ProfileBloc', () {
    test('initial state is ProfileInitial', () {
      expect(buildBloc().state, isA<ProfileInitial>());
    });

    blocTest<ProfileBloc, ProfileState>(
      'emits [ProfileLoading, ProfileLoaded] when API returns user and signature',
      build: () {
        when(mockApi.getProfile()).thenAnswer((_) async => fakeUserJson);
        when(mockApi.getSignature()).thenAnswer((_) async => null);
        return buildBloc();
      },
      act: (bloc) => bloc.add(const LoadProfile()),
      expect: () => [isA<ProfileLoading>(), isA<ProfileLoaded>()],
    );

    blocTest<ProfileBloc, ProfileState>(
      'emits [ProfileLoading, ProfileError] when getProfile throws',
      build: () {
        when(mockApi.getProfile()).thenThrow(Exception('Unauthorized'));
        return buildBloc();
      },
      act: (bloc) => bloc.add(const LoadProfile()),
      expect: () => [isA<ProfileLoading>(), isA<ProfileError>()],
    );

    blocTest<ProfileBloc, ProfileState>(
      'emits [ProfileSaving, ProfileSaved] on successful UpdateProfile',
      build: () {
        when(mockApi.updateProfile(any)).thenAnswer((_) async => fakeUserJson);
        return buildBloc();
      },
      act: (bloc) => bloc.add(const UpdateProfile(
        fullName: 'Updated Name',
        email: 'new@email.com',
        phone: '9999999999',
        designation: 'QC Inspector',
      )),
      expect: () => [isA<ProfileSaving>(), isA<ProfileSaved>()],
    );

    blocTest<ProfileBloc, ProfileState>(
      'emits [ProfileSaving, ProfileError] when updateProfile throws',
      build: () {
        when(mockApi.updateProfile(any)).thenThrow(Exception('Validation failed'));
        return buildBloc();
      },
      act: (bloc) => bloc.add(const UpdateProfile(
        fullName: 'Name',
        email: 'e@x.com',
        phone: '123',
        designation: 'Eng',
      )),
      expect: () => [isA<ProfileSaving>(), isA<ProfileError>()],
    );
  });
}
```

- [ ] **Step 3: Run both tests**

```bash
cd flutter && flutter test test/features/tower_lens/bloc/ test/features/profile/bloc/ -v
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add test/features/tower_lens/bloc/ test/features/profile/bloc/
git commit -m "test: add TowerLensBloc and ProfileBloc tests"
```

---

## Task 11: Core service tests (AuthService)

**Files:**
- Create: `test/core/auth/auth_service_test.dart`

Note: `AuthService` wraps `SetuApiClient` + `TokenManager`. Both are mockable.

- [ ] **Step 1: Create the test file**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/core/auth/auth_service.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';
import '../../helpers/mocks.mocks.dart';
import '../../helpers/test_fixtures.dart';

void main() {
  late MockSetuApiClient mockApi;
  late MockTokenManager mockTokenManager;
  late AuthService authService;

  setUp(() {
    mockApi = MockSetuApiClient();
    mockTokenManager = MockTokenManager();
    authService = AuthService(mockApi, mockTokenManager);
  });

  group('AuthService.login', () {
    test('returns User when access_token and user are present in response', () async {
      when(mockApi.login(username: 'user', password: 'pass'))
          .thenAnswer((_) async => fakeLoginResponse);
      when(mockTokenManager.saveTokens(
        accessToken: anyNamed('accessToken'),
        refreshToken: anyNamed('refreshToken'),
        expiresIn: anyNamed('expiresIn'),
        userId: anyNamed('userId'),
      )).thenAnswer((_) async {});

      final user = await authService.login(username: 'user', password: 'pass');

      expect(user, isA<User>());
      expect(user.username, 'test_user');
    });

    test('throws when access_token is missing from response', () async {
      when(mockApi.login(username: anyNamed('username'), password: anyNamed('password')))
          .thenAnswer((_) async => {'user': fakeUserJson}); // no access_token

      expect(
        () => authService.login(username: 'u', password: 'p'),
        throwsA(isA<Exception>()),
      );
    });

    test('calls getProfile as fallback when user is absent from login response', () async {
      when(mockApi.login(username: anyNamed('username'), password: anyNamed('password')))
          .thenAnswer((_) async => {
                'access_token': 'token123',
                'expires_in': 28800,
                // No 'user' key — forces fallback to getProfile
              });
      when(mockTokenManager.saveTokens(
        accessToken: anyNamed('accessToken'),
        refreshToken: anyNamed('refreshToken'),
        expiresIn: anyNamed('expiresIn'),
        userId: anyNamed('userId'),
      )).thenAnswer((_) async {});
      when(mockApi.getProfile()).thenAnswer((_) async => fakeUserJson);

      final user = await authService.login(username: 'u', password: 'p');

      verify(mockApi.getProfile()).called(1);
      expect(user.username, 'test_user');
    });

    test('rethrows API exception on network failure', () async {
      when(mockApi.login(username: anyNamed('username'), password: anyNamed('password')))
          .thenThrow(Exception('connection refused'));

      expect(
        () => authService.login(username: 'u', password: 'p'),
        throwsA(isA<Exception>()),
      );
    });
  });

  group('AuthService.isLoggedIn', () {
    test('returns true when TokenManager reports logged in', () async {
      when(mockTokenManager.isLoggedIn()).thenAnswer((_) async => true);
      expect(await authService.isLoggedIn(), true);
    });

    test('returns false when TokenManager reports not logged in', () async {
      when(mockTokenManager.isLoggedIn()).thenAnswer((_) async => false);
      expect(await authService.isLoggedIn(), false);
    });
  });

  group('AuthService.logout', () {
    test('calls TokenManager.clearTokens', () async {
      when(mockTokenManager.clearTokens()).thenAnswer((_) async {});
      await authService.logout();
      verify(mockTokenManager.clearTokens()).called(1);
    });
  });

  group('AuthService.getProfile', () {
    test('parses and returns User from API response', () async {
      when(mockApi.getProfile()).thenAnswer((_) async => fakeUserJson);
      final user = await authService.getProfile();
      expect(user.id, 1);
      expect(user.email, 'test@setu.com');
    });
  });
}
```

- [ ] **Step 2: Run the test**

```bash
cd flutter && flutter test test/core/auth/auth_service_test.dart -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add test/core/auth/auth_service_test.dart
git commit -m "test: add AuthService unit tests — login, logout, isLoggedIn, getProfile"
```

---

## Task 12: Widget tests

**Files:**
- Create: `test/widget/auth/login_page_test.dart`
- Create: `test/widget/shared/severity_badge_test.dart`

- [ ] **Step 1: Create login page widget test**

```dart
// test/widget/auth/login_page_test.dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/auth/presentation/pages/login_page.dart';

// Stub BLoC — never calls real handlers.
class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

void main() {
  late MockAuthBloc mockBloc;

  setUp(() {
    mockBloc = MockAuthBloc();
  });

  tearDown(() {
    mockBloc.close();
  });

  Widget buildSubject() => MaterialApp(
        home: BlocProvider<AuthBloc>.value(
          value: mockBloc,
          child: const LoginPage(),
        ),
      );

  group('LoginPage widget', () {
    testWidgets('renders username and password fields', (tester) async {
      when(() => mockBloc.state).thenReturn(AuthUnauthenticated());
      await tester.pumpWidget(buildSubject());

      expect(find.byType(TextFormField), findsAtLeastNWidgets(2));
    });

    testWidgets('renders a login button', (tester) async {
      when(() => mockBloc.state).thenReturn(AuthUnauthenticated());
      await tester.pumpWidget(buildSubject());

      // Login button may be an ElevatedButton or TextButton
      expect(find.byType(ElevatedButton), findsWidgets);
    });

    testWidgets('shows a loading indicator when state is AuthLoading', (tester) async {
      when(() => mockBloc.state).thenReturn(AuthLoading());
      await tester.pumpWidget(buildSubject());

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows error message when state is AuthError', (tester) async {
      when(() => mockBloc.state)
          .thenReturn(const AuthError('Invalid username or password'));
      await tester.pumpWidget(buildSubject());

      expect(find.text('Invalid username or password'), findsOneWidget);
    });
  });
}
```

- [ ] **Step 2: Create severity badge widget test**

```dart
// test/widget/shared/severity_badge_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/shared/widgets/severity_badge.dart';

void main() {
  group('SeverityBadge', () {
    Widget buildBadge(String severity) => MaterialApp(
          home: Scaffold(body: SeverityBadge(severity: severity)),
        );

    testWidgets('renders HIGH severity text', (tester) async {
      await tester.pumpWidget(buildBadge('HIGH'));
      expect(find.text('HIGH'), findsOneWidget);
    });

    testWidgets('renders MEDIUM severity text', (tester) async {
      await tester.pumpWidget(buildBadge('MEDIUM'));
      expect(find.text('MEDIUM'), findsOneWidget);
    });

    testWidgets('renders LOW severity text', (tester) async {
      await tester.pumpWidget(buildBadge('LOW'));
      expect(find.text('LOW'), findsOneWidget);
    });

    testWidgets('does not throw for unknown severity', (tester) async {
      await tester.pumpWidget(buildBadge('UNKNOWN'));
      expect(tester.takeException(), isNull);
    });
  });
}
```

- [ ] **Step 3: Run widget tests**

```bash
cd flutter && flutter test test/widget/ -v
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add test/widget/
git commit -m "test: add widget tests for LoginPage states and SeverityBadge"
```

---

## Task 13: Run the full suite and fix any issues

- [ ] **Step 1: Run all tests**

```bash
cd flutter && flutter test --reporter expanded
```

Expected: All tests PASS. If any tests fail, check the failure message:
- `type 'Null' is not a subtype` → a mock stub is missing — add `when(...).thenAnswer(...)` for the failing call
- `MissingStubError` → mockito strict mode — add the missing stub
- `Could not find builder for ...` → run `build_runner` again
- Compilation error in generated mock → re-run `flutter pub run build_runner build --delete-conflicting-outputs`

- [ ] **Step 2: Fix any failing tests**

For each failure:
1. Read the error message carefully
2. Add the missing stub or fix the incorrect assertion
3. Re-run only the failing test file to verify the fix

- [ ] **Step 3: Commit the final green suite**

```bash
cd flutter && git add -A
git commit -m "test: all tests passing — complete test suite for V01"
```

- [ ] **Step 4: Push to origin**

```bash
git push origin develop
```

---

## Task 14: Missing model tests (progress, tower_lens floor_progress)

**Files:**
- Create: `test/features/progress/models/progress_model_test.dart`
- Create: `test/features/tower_lens/models/floor_progress_test.dart`

- [ ] **Step 1: Create progress model test**

```dart
// test/features/progress/models/progress_model_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/progress/data/models/progress_model.dart';

void main() {
  group('ProgressEntry', () {
    test('can be instantiated with required fields', () {
      final entry = ProgressEntry(
        projectId: 10,
        activityId: 100,
        percentage: 75.0,
        date: '2026-04-08',
      );
      expect(entry.projectId, 10);
      expect(entry.percentage, 75.0);
    });
  });
}
```

- [ ] **Step 2: Create floor_progress model test**

```dart
// test/features/tower_lens/models/floor_progress_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/tower_lens/data/models/floor_progress.dart';

void main() {
  group('FloorProgress.fromJson', () {
    test('parses floorNumber and progressPercentage', () {
      final json = {
        'floorNumber': 3,
        'progressPercentage': 60.0,
        'status': 'IN_PROGRESS',
      };
      final fp = FloorProgress.fromJson(json);
      expect(fp.floorNumber, 3);
      expect(fp.progressPercentage, 60.0);
    });

    test('handles missing optional fields without throwing', () {
      expect(
        () => FloorProgress.fromJson({'floorNumber': 1, 'progressPercentage': 0.0}),
        returnsNormally,
      );
    });
  });
}
```

- [ ] **Step 3: Run these model tests**

```bash
cd flutter && flutter test test/features/progress/models/ test/features/tower_lens/models/ -v
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add test/features/progress/models/ test/features/tower_lens/models/
git commit -m "test: add ProgressEntry and FloorProgress model tests"
```

---

## Task 15: EhsIncidentBloc tests

**Files:**
- Create: `test/features/ehs/bloc/ehs_incident_bloc_test.dart`

- [ ] **Step 1: Create the test**

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_incident_bloc.dart';
import '../../../helpers/mocks.mocks.dart';

void main() {
  late MockSetuApiClient mockApi;
  late MockAppDatabase mockDb;
  late MockSyncService mockSync;

  EhsIncidentBloc buildBloc() => EhsIncidentBloc(
        apiClient: mockApi,
        database: mockDb,
        syncService: mockSync,
      );

  setUp(() {
    mockApi = MockSetuApiClient();
    mockDb = MockAppDatabase();
    mockSync = MockSyncService();
  });

  group('EhsIncidentBloc', () {
    test('initial state is EhsIncidentInitial', () {
      expect(buildBloc().state, isA<EhsIncidentInitial>());
    });

    blocTest<EhsIncidentBloc, EhsIncidentState>(
      'emits [Loading, Loaded] when API returns incidents',
      build: () {
        when(mockApi.getEhsIncidents(projectId: anyNamed('projectId')))
            .thenAnswer((_) async => []);
        return buildBloc();
      },
      act: (bloc) => bloc.add(const LoadEhsIncidents(projectId: 10)),
      expect: () => [isA<EhsIncidentLoading>(), isA<EhsIncidentLoaded>()],
    );

    blocTest<EhsIncidentBloc, EhsIncidentState>(
      'emits [Loading, Error] when API throws',
      build: () {
        when(mockApi.getEhsIncidents(projectId: anyNamed('projectId')))
            .thenThrow(Exception('Server error'));
        return buildBloc();
      },
      act: (bloc) => bloc.add(const LoadEhsIncidents(projectId: 10)),
      expect: () => [isA<EhsIncidentLoading>(), isA<EhsIncidentError>()],
    );
  });
}
```

- [ ] **Step 2: Run the test**

```bash
cd flutter && flutter test test/features/ehs/bloc/ehs_incident_bloc_test.dart -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add test/features/ehs/bloc/ehs_incident_bloc_test.dart
git commit -m "test: add EhsIncidentBloc load tests"
```

---

## Quick reference: regenerate mocks after adding a new class

```bash
cd flutter && flutter pub run build_runner build --delete-conflicting-outputs
```

Add the new class to `test/helpers/mocks.dart` inside the `@GenerateMocks([...])` annotation first.
