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

  AuthBloc buildBloc() => AuthBloc(authService: mockAuthService);

  // ── 1. Initial state ─────────────────────────────────────────────────────

  test('initial state is AuthInitial', () {
    expect(buildBloc().state, isA<AuthInitial>());
  });

  // ── 2. CheckAuthStatus → authenticated ───────────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'CheckAuthStatus emits [AuthLoading, AuthAuthenticated] when isLoggedIn=true',
    build: () {
      when(mockAuthService.isLoggedIn()).thenAnswer((_) async => true);
      when(mockAuthService.getProfile()).thenAnswer((_) async => fakeUser);
      return buildBloc();
    },
    act: (bloc) => bloc.add(CheckAuthStatus()),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthAuthenticated>(),
    ],
  );

  // ── 3. CheckAuthStatus → unauthenticated (not logged in) ─────────────────

  blocTest<AuthBloc, AuthState>(
    'CheckAuthStatus emits [AuthLoading, AuthUnauthenticated] when isLoggedIn=false',
    build: () {
      when(mockAuthService.isLoggedIn()).thenAnswer((_) async => false);
      return buildBloc();
    },
    act: (bloc) => bloc.add(CheckAuthStatus()),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthUnauthenticated>(),
    ],
  );

  // ── 4. CheckAuthStatus → unauthenticated (throws) ────────────────────────

  blocTest<AuthBloc, AuthState>(
    'CheckAuthStatus emits [AuthLoading, AuthUnauthenticated] when isLoggedIn throws',
    build: () {
      when(mockAuthService.isLoggedIn())
          .thenThrow(Exception('storage error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(CheckAuthStatus()),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthUnauthenticated>(),
    ],
  );

  // ── 5. AuthAuthenticated carries correct user ─────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'AuthAuthenticated carries user with correct username',
    build: () {
      when(mockAuthService.isLoggedIn()).thenAnswer((_) async => true);
      when(mockAuthService.getProfile()).thenAnswer((_) async => fakeUser);
      return buildBloc();
    },
    act: (bloc) => bloc.add(CheckAuthStatus()),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthAuthenticated>(),
    ],
    verify: (bloc) {
      expect((bloc.state as AuthAuthenticated).user.username, 'test_user');
    },
  );

  // ── 6. Login → success ────────────────────────────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'Login emits [AuthLoading, AuthAuthenticated] on success',
    build: () {
      when(mockAuthService.login(
        username: anyNamed('username'),
        password: anyNamed('password'),
      )).thenAnswer((_) async => fakeUser);
      return buildBloc();
    },
    act: (bloc) => bloc.add(const Login(username: 'test_user', password: 'secret')),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthAuthenticated>(),
    ],
  );

  // ── 7. Login → 401 error ──────────────────────────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'Login emits [AuthLoading, AuthError] with "Invalid username or password" on 401',
    build: () {
      when(mockAuthService.login(
        username: anyNamed('username'),
        password: anyNamed('password'),
      )).thenThrow(Exception('401 Unauthorized'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const Login(username: 'test_user', password: 'wrong')),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthError>(),
    ],
    verify: (bloc) {
      expect(
        (bloc.state as AuthError).message,
        contains('Invalid username or password'),
      );
    },
  );

  // ── 8. Login → connection refused ────────────────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'Login emits [AuthLoading, AuthError] with "WiFi" on connection refused',
    build: () {
      when(mockAuthService.login(
        username: anyNamed('username'),
        password: anyNamed('password'),
      )).thenThrow(Exception('ConnectionError: connection refused'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const Login(username: 'test_user', password: 'secret')),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthError>(),
    ],
    verify: (bloc) {
      expect(
        (bloc.state as AuthError).message,
        contains('WiFi'),
      );
    },
  );

  // ── 9. Login → timed out ──────────────────────────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'Login emits [AuthLoading, AuthError] with "timed out" on timeout',
    build: () {
      when(mockAuthService.login(
        username: anyNamed('username'),
        password: anyNamed('password'),
      )).thenThrow(Exception('Connection timed out'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const Login(username: 'test_user', password: 'secret')),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthError>(),
    ],
    verify: (bloc) {
      expect(
        (bloc.state as AuthError).message,
        contains('timed out'),
      );
    },
  );

  // ── 10. Login → TEMP_EXPIRED ──────────────────────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'Login emits [AuthLoading, AuthError] with "Temporary vendor" on TEMP_EXPIRED',
    build: () {
      when(mockAuthService.login(
        username: anyNamed('username'),
        password: anyNamed('password'),
      )).thenThrow(Exception('TEMP_EXPIRED'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const Login(username: 'test_user', password: 'secret')),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthError>(),
    ],
    verify: (bloc) {
      expect(
        (bloc.state as AuthError).message,
        contains('Temporary vendor'),
      );
    },
  );

  // ── 11. Logout → success ──────────────────────────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'Logout emits [AuthLoading, AuthUnauthenticated] on success',
    build: () {
      when(mockAuthService.logout()).thenAnswer((_) async {});
      return buildBloc();
    },
    act: (bloc) => bloc.add(Logout()),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthUnauthenticated>(),
    ],
  );

  // ── 12. Logout → throws ───────────────────────────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'Logout emits [AuthLoading, AuthUnauthenticated] even when logout throws',
    build: () {
      when(mockAuthService.logout()).thenThrow(Exception('network error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(Logout()),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthUnauthenticated>(),
    ],
  );

  // ── 13. RefreshProfile → success ─────────────────────────────────────────

  blocTest<AuthBloc, AuthState>(
    'RefreshProfile emits [AuthAuthenticated] when getProfile succeeds',
    build: () {
      when(mockAuthService.getProfile()).thenAnswer((_) async => fakeUser);
      return buildBloc();
    },
    act: (bloc) => bloc.add(RefreshProfile()),
    expect: () => [
      isA<AuthAuthenticated>(),
    ],
  );

  // ── 14. RefreshProfile → throws (no state change) ────────────────────────

  blocTest<AuthBloc, AuthState>(
    'RefreshProfile emits nothing when getProfile throws',
    build: () {
      when(mockAuthService.getProfile())
          .thenThrow(Exception('network error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(RefreshProfile()),
    expect: () => [],
  );
}
