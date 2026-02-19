import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Manages JWT tokens securely using platform-specific secure storage
class TokenManager {
  final FlutterSecureStorage _secureStorage;

  // Storage keys
  static const String _accessTokenKey = 'setu_access_token';
  static const String _refreshTokenKey = 'setu_refresh_token';
  static const String _tokenExpiryKey = 'setu_token_expiry';
  static const String _userIdKey = 'setu_user_id';

  TokenManager(this._secureStorage);

  /// Save tokens after successful login
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required int expiresIn, // Token expiry in seconds
    required int userId,
  }) async {
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);
    await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
    await _secureStorage.write(key: _userIdKey, value: userId.toString());

    // Calculate expiry time
    final expiryTime = DateTime.now().add(Duration(seconds: expiresIn));
    await _secureStorage.write(key: _tokenExpiryKey, value: expiryTime.toIso8601String());
  }

  /// Get access token
  Future<String?> getAccessToken() async {
    return await _secureStorage.read(key: _accessTokenKey);
  }

  /// Get refresh token
  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: _refreshTokenKey);
  }

  /// Get user ID
  Future<int?> getUserId() async {
    final userIdStr = await _secureStorage.read(key: _userIdKey);
    return userIdStr != null ? int.tryParse(userIdStr) : null;
  }

  /// Check if token is expired
  Future<bool> isTokenExpired() async {
    final expiryStr = await _secureStorage.read(key: _tokenExpiryKey);
    if (expiryStr == null) return true;

    try {
      final expiry = DateTime.parse(expiryStr);
      // Consider token expired 5 minutes before actual expiry
      return DateTime.now().isAfter(expiry.subtract(const Duration(minutes: 5)));
    } catch (e) {
      return true;
    }
  }

  /// Check if user is logged in
  Future<bool> isLoggedIn() async {
    final accessToken = await getAccessToken();
    if (accessToken == null) return false;

    final isExpired = await isTokenExpired();
    return !isExpired;
  }

  /// Refresh the access token using refresh token
  /// Returns true if refresh was successful
  Future<bool> refreshToken() async {
    final refreshToken = await getRefreshToken();
    if (refreshToken == null) return false;

    try {
      // TODO: Call the refresh token API endpoint
      // For now, return false to trigger re-login
      // In production, this would call the backend's refresh endpoint
      return false;
    } catch (e) {
      return false;
    }
  }

  /// Clear all tokens (logout)
  Future<void> clearTokens() async {
    await _secureStorage.delete(key: _accessTokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _tokenExpiryKey);
    await _secureStorage.delete(key: _userIdKey);
  }

  /// Update access token (after refresh)
  Future<void> updateAccessToken({
    required String accessToken,
    required int expiresIn,
  }) async {
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);

    final expiryTime = DateTime.now().add(Duration(seconds: expiresIn));
    await _secureStorage.write(key: _tokenExpiryKey, value: expiryTime.toIso8601String());
  }
}
