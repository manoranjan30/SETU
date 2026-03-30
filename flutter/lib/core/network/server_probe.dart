import 'dart:async';
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';

/// Actively probes whether the SETU backend server is reachable.
///
/// Problem this solves:
///   [connectivity_plus] only checks whether a network *interface* is active
///   (i.e. whether the WiFi or mobile icon is visible in the status bar).
///   On construction floors with weak signal the device shows "connected" but
///   TCP connections to the server time out or are refused — the app then
///   waits the full Dio receive-timeout (15 s) for every request before
///   falling back to cached data.
///
/// Solution:
///   [ServerProbe] makes a lightweight HEAD request to the API base URL with
///   a **3-second connect timeout**. Any HTTP response (including 401, 404, 500)
///   proves the server is reachable — only a true TCP timeout or DNS failure
///   is treated as "unreachable".  The result is cached for [_cacheTtl] seconds
///   so multiple simultaneous BLoC initialisations do not hammer the server.
///
/// Usage:
///   ```dart
///   final probe = sl<ServerProbe>(); // injected via GetIt
///   if (await probe.isReachable()) { ... }
///   ```
///
/// Singleton via GetIt — register once in `injection_container.dart`.
class ServerProbe {
  static const Duration _probeTimeout = Duration(seconds: 3);

  /// How long a probe result is cached before the next real check.
  /// 15 seconds strikes a balance: fresh enough to detect reconnect quickly,
  /// but cheap enough to be called on every screen load.
  static const Duration _cacheTtl = Duration(seconds: 15);

  final Logger _log = Logger();

  /// Dedicated lightweight Dio for probes only.
  /// No auth interceptors — we are only checking TCP reachability, not
  /// fetching authenticated data.  validateStatus accepts all status codes
  /// so a 401/403/404 from the server is treated as "reachable".
  final Dio _probeDio = Dio(
    BaseOptions(
      connectTimeout: _probeTimeout,
      receiveTimeout: _probeTimeout,
      sendTimeout: _probeTimeout,
      // Do not follow redirects — we only need the first response to confirm
      // the server is listening, not to reach the actual resource.
      followRedirects: false,
      validateStatus: (_) => true,
    ),
  );

  bool? _cached;
  DateTime? _cacheExpiry;

  // Guard against concurrent in-flight probes: if a probe is already running
  // return the same future rather than launching a second one.
  Future<bool>? _inFlight;

  /// Returns `true` if the SETU backend server is currently reachable.
  ///
  /// Uses cached result within [_cacheTtl] window. Concurrent callers while
  /// a probe is in flight share the single in-flight future.
  Future<bool> isReachable() async {
    final now = DateTime.now();

    // Cache hit — return immediately without a network call.
    if (_cached != null &&
        _cacheExpiry != null &&
        now.isBefore(_cacheExpiry!)) {
      return _cached!;
    }

    // Deduplicate: if a probe is already in-flight, await it.
    if (_inFlight != null) return _inFlight!;

    _inFlight = _doProbe();
    try {
      final result = await _inFlight!;
      return result;
    } finally {
      _inFlight = null;
    }
  }

  Future<bool> _doProbe() async {
    final url = ApiEndpoints.baseUrl;
    try {
      // HEAD request: no response body is downloaded, so this is essentially
      // free in terms of bandwidth.  Any response (200, 401, 404 …) confirms
      // the server TCP stack is alive and accepting connections.
      await _probeDio.head(url);
      _setCache(true);
      _log.d('ServerProbe: reachable ✓ ($url)');
      return true;
    } on DioException catch (e) {
      // Connection timeout / no route to host / DNS failure → unreachable.
      // Response errors (4xx, 5xx) are NOT thrown because validateStatus
      // accepts everything — so reaching here means a network-level failure.
      _setCache(false);
      _log.d('ServerProbe: unreachable — ${e.type.name}');
      return false;
    } catch (_) {
      _setCache(false);
      return false;
    }
  }

  void _setCache(bool value) {
    _cached = value;
    _cacheExpiry = DateTime.now().add(_cacheTtl);
  }

  /// Force the next [isReachable] call to make a fresh network probe.
  ///
  /// Call this when the app becomes foreground or the connectivity stream
  /// fires a change so the cached result does not stay stale across a
  /// network transition.
  void invalidate() {
    _cached = null;
    _cacheExpiry = null;
    _inFlight = null;
  }
}
