import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Manages JWT tokens using platform-secure storage (Android Keystore /
/// iOS Keychain via [FlutterSecureStorage]).
///
/// Responsibilities:
/// - Persist access token, refresh token, expiry time, and user ID after login.
/// - Provide a single source of truth for whether the current session is valid.
/// - Expose [updateAccessToken] so that a future token-refresh flow can update
///   only the access token without touching the refresh token.
///
/// The [refreshToken] method is intentionally stubbed — it currently always
/// returns false, causing [AuthService.refreshAuthState] to report an expired
/// session and driving the user back to [LoginPage].  When a real refresh
/// endpoint is implemented, only this method needs to be updated.
class TokenManager {
  final FlutterSecureStorage _secureStorage;

  // Namespaced keys prevent collisions if multiple apps share the keychain.
  static const String _accessTokenKey = 'setu_access_token';
  static const String _refreshTokenKey = 'setu_refresh_token';
  static const String _tokenExpiryKey = 'setu_token_expiry';
  static const String _userIdKey = 'setu_user_id';

  TokenManager(this._secureStorage);

  /// Persists all four token-related values after a successful login.
  ///
  /// [expiresIn] is the server-provided TTL in **seconds**.  The absolute
  /// expiry timestamp is calculated and stored so that expiry checks remain
  /// accurate even if the device clock drifts between app launches.
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required int expiresIn, // Token expiry in seconds
    required int userId,
  }) async {
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);
    await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
    await _secureStorage.write(key: _userIdKey, value: userId.toString());

    // Convert the relative TTL to an absolute ISO-8601 timestamp.
    // Storing as ISO string rather than epoch millis makes it human-readable
    // during debugging and avoids integer overflow on 32-bit platforms.
    final expiryTime = DateTime.now().add(Duration(seconds: expiresIn));
    await _secureStorage.write(key: _tokenExpiryKey, value: expiryTime.toIso8601String());
  }

  /// Retrieves the stored JWT access token, or null if none exists.
  ///
  /// [SetuApiClient] calls this before every request to attach the
  /// Authorization header.
  Future<String?> getAccessToken() async {
    return await _secureStorage.read(key: _accessTokenKey);
  }

  /// Retrieves the stored JWT refresh token, or null if none exists.
  ///
  /// Currently unused in production — kept for when token refresh is
  /// implemented in [refreshToken].
  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: _refreshTokenKey);
  }

  /// Returns the numeric user ID that was stored at login time.
  ///
  /// Returns null if no user ID has been saved (e.g. before first login).
  /// Stored as a string because [FlutterSecureStorage] only accepts strings;
  /// [int.tryParse] is used here for safe conversion.
  Future<int?> getUserId() async {
    final userIdStr = await _secureStorage.read(key: _userIdKey);
    return userIdStr != null ? int.tryParse(userIdStr) : null;
  }

  /// Returns true if the stored access token has expired (or is missing).
  ///
  /// A 5-minute buffer is applied so that tokens nearing expiry are treated
  /// as expired before the server would actually reject them — this avoids
  /// in-flight requests failing mid-operation when the clock is tight.
  Future<bool> isTokenExpired() async {
    final expiryStr = await _secureStorage.read(key: _tokenExpiryKey);
    if (expiryStr == null) return true; // No expiry stored → treat as expired

    try {
      final expiry = DateTime.parse(expiryStr);
      // Consider token expired 5 minutes before actual expiry
      return DateTime.now().isAfter(expiry.subtract(const Duration(minutes: 5)));
    } catch (e) {
      // Malformed timestamp — safest to treat as expired and force re-login.
      return true;
    }
  }

  /// Returns true if the user has a valid, non-expired access token.
  ///
  /// This is a purely local check (no network call).  Used on cold start
  /// by [AuthService.isLoggedIn] to decide initial route.
  Future<bool> isLoggedIn() async {
    final accessToken = await getAccessToken();
    if (accessToken == null) return false; // Never logged in, or already cleared

    final isExpired = await isTokenExpired();
    return !isExpired;
  }

  /// Attempts to obtain a new access token using the stored refresh token.
  ///
  /// **Currently stubbed** — always returns false.  The intent is that when
  /// a backend refresh endpoint (`POST /auth/refresh`) is available, this
  /// method will call it, persist the new token via [updateAccessToken], and
  /// return true.  Until then, any expired session requires re-login.
  Future<bool> refreshToken() async {
    final refreshToken = await getRefreshToken();
    if (refreshToken == null) return false; // No refresh token stored

    try {
      // TODO: Call the refresh token API endpoint
      // For now, return false to trigger re-login
      // In production, this would call the backend's refresh endpoint
      return false;
    } catch (e) {
      return false;
    }
  }

  /// Deletes all four stored token values.
  ///
  /// Called by [AuthService.logout].  After this, [isLoggedIn] returns false
  /// and [getAccessToken] returns null, so no authenticated API calls can
  /// be made until the user logs in again.
  Future<void> clearTokens() async {
    await _secureStorage.delete(key: _accessTokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _tokenExpiryKey);
    await _secureStorage.delete(key: _userIdKey);
  }

  /// Replaces the access token and its expiry after a successful token refresh.
  ///
  /// Does NOT overwrite the refresh token — that should only change if the
  /// server issues a rotating refresh token as part of the refresh response.
  Future<void> updateAccessToken({
    required String accessToken,
    required int expiresIn,
  }) async {
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);

    // Recalculate and persist the new absolute expiry timestamp.
    final expiryTime = DateTime.now().add(Duration(seconds: expiresIn));
    await _secureStorage.write(key: _tokenExpiryKey, value: expiryTime.toIso8601String());
  }
}
