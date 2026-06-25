import 'package:flutter/foundation.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/token_manager.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';

/// Thrown when the backend requires OTP verification before issuing a JWT.
/// Carry the challenge details so the bloc can emit the right state.
class OtpRequiredException implements Exception {
  final String challengeId;
  final String deliveryChannel;
  final String destinationMasked;
  final String expiresAt;
  final int expiresInSeconds;

  const OtpRequiredException({
    required this.challengeId,
    required this.deliveryChannel,
    required this.destinationMasked,
    required this.expiresAt,
    required this.expiresInSeconds,
  });
}

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
      if (kDebugMode) debugPrint('[AuthService] Starting login for: $username');

      final response = await _apiClient.login(
        username: username,
        password: password,
      );
      // Note: never log the raw response here — it carries the plaintext
      // access/refresh tokens, which must not end up in device logs even
      // in debug builds (logcat capture, bug-report attachments, etc.).

      // Parse the response
      // OTP challenge — server wants a second factor before issuing a token.
      if (response['otpRequired'] == true) {
        throw OtpRequiredException(
          challengeId: response['challengeId'] as String? ?? '',
          deliveryChannel: response['deliveryChannel'] as String? ?? 'EMAIL',
          destinationMasked: response['destinationMasked'] as String? ?? '',
          expiresAt: response['expiresAt'] as String? ?? '',
          expiresInSeconds: response['expiresInSeconds'] as int? ?? 300,
        );
      }

      final accessToken = response['access_token'] as String?;
      final refreshToken = response['refresh_token'] as String?;
      final expiresIn = response['expires_in'] as int?;
      if (kDebugMode) {
        debugPrint('[AuthService] Access token: ${accessToken != null ? "received" : "null"}');
      }

      if (accessToken == null) {
        throw Exception('Invalid login response: missing access token');
      }

      // Backend returns user data nested under a 'user' key with all fields
      // including permissions, roles, and project_ids.
      final userJson = response['user'] as Map<String, dynamic>?;
      if (kDebugMode) {
        debugPrint('[AuthService] User JSON keys: ${userJson?.keys.toList()}');
      }

      // Save tokens
      await _tokenManager.saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken ?? '',
        expiresIn: expiresIn ?? 28800, // Default 8 hours
        userId: userJson?['id'] as int? ?? 0,
      );
      if (kDebugMode) debugPrint('[AuthService] Tokens saved successfully');

      if (userJson != null) {
        // Fast path: user data (including permissions) came inline in the
        // login response under the 'user' key.
        final user = User.fromJson(userJson);
        if (kDebugMode) {
          debugPrint('[AuthService] User parsed: ${user.username}, '
              'permissions count: ${user.permissions.length}');
        }
        return user;
      }

      // Fallback path: backend did not include user in the login response,
      // so make a dedicated profile request using the newly saved token.
      if (kDebugMode) debugPrint('[AuthService] Fetching profile separately');
      return await getProfile();
    } catch (e) {
      if (kDebugMode) debugPrint('[AuthService] Login error: $e');
      rethrow;
    }
  }

  /// Completes an OTP challenge and returns the authenticated [User].
  /// Saves tokens exactly like a successful password login.
  Future<User> verifyOtp({
    required String challengeId,
    required String otp,
  }) async {
    final response = await _apiClient.verifyOtp(
      challengeId: challengeId,
      otp: otp,
    );

    final accessToken = response['access_token'] as String?;
    if (accessToken == null) {
      throw Exception('OTP verification failed: missing access token');
    }

    final userJson = response['user'] as Map<String, dynamic>?;
    await _tokenManager.saveTokens(
      accessToken: accessToken,
      refreshToken: response['refresh_token'] as String? ?? '',
      expiresIn: response['expires_in'] as int? ?? 28800,
      userId: userJson?['id'] as int? ?? 0,
    );

    if (userJson != null) return User.fromJson(userJson);
    return await getProfile();
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
