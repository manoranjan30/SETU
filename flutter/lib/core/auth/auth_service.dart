import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/token_manager.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';

/// Orchestrates login, logout, and session checking for the SETU app.
///
/// This service sits between the API layer and the token storage layer:
/// it calls [SetuApiClient] to authenticate with the backend, then
/// delegates all token persistence to [TokenManager]. BLoCs and UI
/// should interact with [AuthBloc] rather than calling this service
/// directly — [AuthBloc] owns the observable auth state.
class AuthService {
  final SetuApiClient _apiClient;
  final TokenManager _tokenManager;

  AuthService(this._apiClient, this._tokenManager);

  /// Authenticates the user against the SETU backend.
  ///
  /// On success, tokens are persisted via [TokenManager] and the
  /// resulting [User] object is returned so [AuthBloc] can emit
  /// [AuthAuthenticated].  The user data may arrive inline in the
  /// login response (fast path) or require a second `/profile` call
  /// if the backend omits it (fallback path).
  ///
  /// Throws on network error, bad credentials, or a response that
  /// is missing the access token.
  Future<User> login({
    required String username,
    required String password,
  }) async {
    try {
      print('[AuthService] Starting login for: $username');

      final response = await _apiClient.login(
        username: username,
        password: password,
      );
      print('[AuthService] Login response: $response');

      // Parse the response
      final accessToken = response['access_token'] as String?;
      final refreshToken = response['refresh_token'] as String?;
      final expiresIn = response['expires_in'] as int?;
      print('[AuthService] Access token: ${accessToken != null ? "received" : "null"}');

      // A missing access token indicates an unexpected backend response
      // (e.g. the server returned 200 but with an error body).
      if (accessToken == null) {
        throw Exception('Invalid login response: missing access token');
      }

      // Backend returns user data nested under a 'user' key with all fields
      // including permissions, roles, and project_ids.
      final userJson = response['user'] as Map<String, dynamic>?;
      print('[AuthService] User JSON keys: ${userJson?.keys.toList()}');
      print('[AuthService] Permissions from login: ${userJson?['permissions']}');

      // Save tokens
      await _tokenManager.saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken ?? '',
        expiresIn: expiresIn ?? 28800, // Default 8 hours
        userId: userJson?['id'] as int? ?? 0,
      );
      print('[AuthService] Tokens saved successfully');

      if (userJson != null) {
        // Fast path: user data (including permissions) came inline in the
        // login response under the 'user' key.
        final user = User.fromJson(userJson);
        print('[AuthService] User parsed: ${user.username}, '
            'permissions count: ${user.permissions.length}, '
            'permissions: ${user.permissions}');
        return user;
      }

      // Fallback path: backend did not include user in the login response,
      // so make a dedicated profile request using the newly saved token.
      print('[AuthService] Fetching profile separately');
      return await getProfile();
    } catch (e) {
      print('[AuthService] Login error: $e');
      rethrow;
    }
  }

  /// Fetches the profile of the currently authenticated user.
  ///
  /// Used as a fallback during login and on app resume to refresh
  /// user data (e.g. updated permissions).
  Future<User> getProfile() async {
    final response = await _apiClient.getProfile();
    return User.fromJson(response);
  }

  /// Returns true if a non-expired access token exists in secure storage.
  ///
  /// Does NOT validate the token against the server — it only checks
  /// the locally stored expiry timestamp.  Used by [AuthBloc] on startup
  /// to decide whether to show [LoginPage] or [ProjectsListPage].
  Future<bool> isLoggedIn() async {
    return await _tokenManager.isLoggedIn();
  }

  /// Clears all stored tokens, effectively logging the user out locally.
  ///
  /// Does not call a server-side logout endpoint (no such endpoint exists
  /// in the current API).  After this call, [isLoggedIn] will return false
  /// and [SetuApiClient] will have no token to attach to requests.
  Future<void> logout() async {
    await _tokenManager.clearTokens();
  }

  /// Returns the numeric user ID stored at login time, or null if not set.
  ///
  /// Useful for feature blocs that need to scope data to the current user
  /// without going through the full [AuthBloc] state.
  Future<int?> getCurrentUserId() async {
    return await _tokenManager.getUserId();
  }

  /// Checks whether the current session is still valid and attempts a
  /// silent token refresh if it has expired.
  ///
  /// Returns true if the user remains authenticated after this call.
  /// Returns false if both the access token is expired AND the refresh
  /// attempt fails — callers should trigger a re-login in that case.
  ///
  /// Note: [TokenManager.refreshToken] is currently stubbed and always
  /// returns false, so any expired session will require re-login.
  Future<bool> refreshAuthState() async {
    final isLoggedIn = await _tokenManager.isLoggedIn();
    if (!isLoggedIn) {
      // Token is expired or missing — attempt a silent refresh before
      // forcing the user back to the login screen.
      final refreshed = await _tokenManager.refreshToken();
      return refreshed;
    }
    return true;
  }
}
