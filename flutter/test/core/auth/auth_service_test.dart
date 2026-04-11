import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/core/auth/auth_service.dart';

import '../../helpers/mocks.mocks.dart';
import '../../helpers/test_fixtures.dart';

void main() {
  late MockSetuApiClient mockApiClient;
  late MockTokenManager mockTokenManager;
  late AuthService authService;

  setUp(() {
    mockApiClient = MockSetuApiClient();
    mockTokenManager = MockTokenManager();
    authService = AuthService(mockApiClient, mockTokenManager);
  });

  // ── 1. login happy path ──────────────────────────────────────────────────────

  test('login returns User with correct username on happy path', () async {
    when(mockApiClient.login(
      username: anyNamed('username'),
      password: anyNamed('password'),
    )).thenAnswer((_) async => fakeLoginResponse);

    when(mockTokenManager.saveTokens(
      accessToken: anyNamed('accessToken'),
      refreshToken: anyNamed('refreshToken'),
      expiresIn: anyNamed('expiresIn'),
      userId: anyNamed('userId'),
    )).thenAnswer((_) async {});

    final user = await authService.login(
      username: 'test_user',
      password: 'secret',
    );

    expect(user.username, 'test_user');
  });

  // ── 2. login throws when access_token missing ────────────────────────────────

  test('login throws when access_token is missing from response', () async {
    when(mockApiClient.login(
      username: anyNamed('username'),
      password: anyNamed('password'),
    )).thenAnswer((_) async => {
          'refresh_token': 'some_refresh',
          'expires_in': 3600,
        });

    expect(
      () => authService.login(username: 'test_user', password: 'secret'),
      throwsA(isA<Exception>()),
    );
  });

  // ── 3. login falls back to getProfile when 'user' key absent ────────────────

  test('login calls getProfile as fallback when user key absent from response',
      () async {
    // Response has token but no 'user' key
    when(mockApiClient.login(
      username: anyNamed('username'),
      password: anyNamed('password'),
    )).thenAnswer((_) async => {
          'access_token': 'fake_token_abc',
          'refresh_token': 'fake_refresh_xyz',
          'expires_in': 28800,
          // no 'user' key
        });

    when(mockTokenManager.saveTokens(
      accessToken: anyNamed('accessToken'),
      refreshToken: anyNamed('refreshToken'),
      expiresIn: anyNamed('expiresIn'),
      userId: anyNamed('userId'),
    )).thenAnswer((_) async {});

    when(mockApiClient.getProfile()).thenAnswer((_) async => fakeUserJson);

    final user = await authService.login(
      username: 'test_user',
      password: 'secret',
    );

    verify(mockApiClient.getProfile()).called(1);
    expect(user.username, 'test_user');
  });

  // ── 4. login rethrows on API exception ──────────────────────────────────────

  test('login rethrows when API throws', () async {
    when(mockApiClient.login(
      username: anyNamed('username'),
      password: anyNamed('password'),
    )).thenThrow(Exception('Network error'));

    expect(
      () => authService.login(username: 'test_user', password: 'secret'),
      throwsA(isA<Exception>()),
    );
  });

  // ── 5. isLoggedIn returns true when TokenManager says true ───────────────────

  test('isLoggedIn returns true when TokenManager says true', () async {
    when(mockTokenManager.isLoggedIn()).thenAnswer((_) async => true);

    final result = await authService.isLoggedIn();

    expect(result, isTrue);
  });

  // ── 6. isLoggedIn returns false when TokenManager says false ─────────────────

  test('isLoggedIn returns false when TokenManager says false', () async {
    when(mockTokenManager.isLoggedIn()).thenAnswer((_) async => false);

    final result = await authService.isLoggedIn();

    expect(result, isFalse);
  });

  // ── 7. logout calls TokenManager.clearTokens ────────────────────────────────

  test('logout calls TokenManager.clearTokens', () async {
    when(mockTokenManager.clearTokens()).thenAnswer((_) async {});

    await authService.logout();

    verify(mockTokenManager.clearTokens()).called(1);
  });

  // ── 8. getProfile returns User parsed from API response ─────────────────────

  test('getProfile returns User parsed from API response', () async {
    when(mockApiClient.getProfile()).thenAnswer((_) async => fakeUserJson);

    final user = await authService.getProfile();

    expect(user.username, fakeUser.username);
    expect(user.email, fakeUser.email);
    expect(user.id, fakeUser.id);
  });
}
