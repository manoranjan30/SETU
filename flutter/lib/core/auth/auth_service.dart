import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/token_manager.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';

/// Authentication service for login, logout, and user management
class AuthService {
  final SetuApiClient _apiClient;
  final TokenManager _tokenManager;

  AuthService(this._apiClient, this._tokenManager);

  /// Login with username and password
  /// Returns User model on success
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
      final userJson = response['user'] as Map<String, dynamic>?;
      print('[AuthService] Access token: ${accessToken != null ? "received" : "null"}');
      print('[AuthService] User JSON: $userJson');

      if (accessToken == null) {
        throw Exception('Invalid login response: missing access token');
      }

      // Save tokens
      await _tokenManager.saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken ?? '',
        expiresIn: expiresIn ?? 28800, // Default 8 hours
        userId: userJson?['id'] ?? 0,
      );
      print('[AuthService] Tokens saved successfully');

      // Return user
      if (userJson != null) {
        final user = User.fromJson(userJson);
        print('[AuthService] User parsed: ${user.username}');
        return user;
      }

      // If user data not in response, fetch profile
      print('[AuthService] Fetching profile separately');
      return await getProfile();
    } catch (e) {
      print('[AuthService] Login error: $e');
      rethrow;
    }
  }

  /// Get current user profile
  Future<User> getProfile() async {
    final response = await _apiClient.getProfile();
    return User.fromJson(response);
  }

  /// Check if user is currently logged in
  Future<bool> isLoggedIn() async {
    return await _tokenManager.isLoggedIn();
  }

  /// Logout - clear all tokens
  Future<void> logout() async {
    await _tokenManager.clearTokens();
  }

  /// Get current user ID
  Future<int?> getCurrentUserId() async {
    return await _tokenManager.getUserId();
  }

  /// Refresh authentication state
  /// Returns true if user is still authenticated
  Future<bool> refreshAuthState() async {
    final isLoggedIn = await _tokenManager.isLoggedIn();
    if (!isLoggedIn) {
      // Try to refresh token
      final refreshed = await _tokenManager.refreshToken();
      return refreshed;
    }
    return true;
  }
}
