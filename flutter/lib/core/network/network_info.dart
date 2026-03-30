import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:setu_mobile/core/network/server_probe.dart';

/// Thin wrapper around the `connectivity_plus` package that provides
/// clean async/stream accessors for the current network state.
///
/// **Two-level connectivity model:**
///
/// 1. [isConnected] — checks only whether a network *interface* is active
///    (WiFi / mobile / ethernet icon in the status bar). Fast, no network
///    traffic.  Used for the quick "definitely offline" fast-path (e.g. sync
///    guard at the top of [SyncService.syncAll]).
///
/// 2. [isServerReachable] — additionally probes the SETU backend with a 3 s
///    HEAD request via [ServerProbe]. Slower but accurate: distinguishes
///    "device shows WiFi icon but server unreachable" (common on construction
///    floors with weak signal) from genuine online connectivity.  Use this
///    before deciding to show cached data vs. attempting an API call.
///
/// For continuous reactive updates throughout the widget tree use
/// [NetworkStatusNotifier] with a `Provider` instead.
class NetworkInfo {
  final Connectivity _connectivity = Connectivity();
  final ServerProbe _probe;

  NetworkInfo({ServerProbe? probe}) : _probe = probe ?? ServerProbe();

  /// Returns `true` if the device has any active network interface.
  ///
  /// This is a one-shot async check — it does not stream future changes.
  /// [ConnectivityResult.none] is the only result considered "offline".
  /// WiFi, mobile, ethernet, VPN, etc. are all treated as "interface active".
  ///
  /// **Important:** a `true` result does NOT guarantee the SETU server is
  /// reachable — use [isServerReachable] for that.
  Future<bool> get isConnected async {
    final result = await _connectivity.checkConnectivity();
    return result != ConnectivityResult.none;
  }

  /// Returns `true` if the device has a network interface AND the SETU server
  /// responds to a lightweight probe within 3 seconds.
  ///
  /// This is the recommended check before deciding whether to fetch live data
  /// or fall back to the local cache.  On construction floors the device often
  /// shows "connected" (WiFi/4G icon) but the signal is too weak to reach the
  /// server; this method surfaces that quickly rather than waiting for the full
  /// Dio receive-timeout.
  ///
  /// Results are cached by [ServerProbe] for 15 s to avoid excessive probing.
  Future<bool> get isServerReachable async {
    // Fast path: no interface at all → server definitely unreachable.
    if (!await isConnected) return false;
    return _probe.isReachable();
  }

  /// Force the server probe cache to be cleared.
  ///
  /// Called by [NetworkStatusNotifier] whenever the connectivity stream fires
  /// so that the next [isServerReachable] call makes a fresh network request
  /// rather than returning a stale cached result from before the connection
  /// change.
  void invalidateProbe() => _probe.invalidate();

  /// Returns the current connectivity type as the app-defined [ConnectivityType] enum.
  Future<ConnectivityType> get connectivityType async {
    final result = await _connectivity.checkConnectivity();
    switch (result) {
      case ConnectivityResult.wifi:
        return ConnectivityType.wifi;
      case ConnectivityResult.mobile:
        return ConnectivityType.mobile;
      case ConnectivityResult.ethernet:
        return ConnectivityType.ethernet;
      default:
        return ConnectivityType.none;
    }
  }

  /// Raw stream of [ConnectivityResult] changes from the platform.
  Stream<ConnectivityResult> get onConnectivityChanged =>
      _connectivity.onConnectivityChanged;

  /// Convenience stream that emits `true` (online) or `false` (offline)
  /// whenever the network interface status changes.
  Stream<bool> get onConnectionStatusChanged {
    return _connectivity.onConnectivityChanged.map(
      (result) => result != ConnectivityResult.none,
    );
  }
}

/// Simplified connectivity type used throughout the app.
enum ConnectivityType {
  wifi,
  mobile,
  ethernet,
  none,
}

/// A [ChangeNotifier] that keeps the app-wide network status up to date.
///
/// Designed for use with the `provider` package:
/// ```dart
/// ChangeNotifierProvider(create: (_) => NetworkStatusNotifier(NetworkInfo()))
/// ```
///
/// On every connectivity event the server probe cache is invalidated so the
/// next [isServerReachable] call is guaranteed to reflect the new network state.
class NetworkStatusNotifier extends ChangeNotifier {
  final NetworkInfo _networkInfo;

  // Optimistic initial state — assume connected until proven otherwise.
  bool _isConnected = true;
  ConnectivityType _connectivityType = ConnectivityType.none;

  NetworkStatusNotifier(this._networkInfo) {
    _initialize();
  }

  bool get isConnected => _isConnected;
  ConnectivityType get connectivityType => _connectivityType;

  Future<void> _initialize() async {
    _isConnected = await _networkInfo.isConnected;
    _connectivityType = await _networkInfo.connectivityType;
    notifyListeners();

    _networkInfo.onConnectivityChanged.listen((result) {
      // Invalidate the server probe cache whenever the network interface
      // changes so the next [isServerReachable] call probes fresh.
      _networkInfo.invalidateProbe();

      _isConnected = result != ConnectivityResult.none;
      switch (result) {
        case ConnectivityResult.wifi:
          _connectivityType = ConnectivityType.wifi;
          break;
        case ConnectivityResult.mobile:
          _connectivityType = ConnectivityType.mobile;
          break;
        case ConnectivityResult.ethernet:
          _connectivityType = ConnectivityType.ethernet;
          break;
        default:
          _connectivityType = ConnectivityType.none;
      }
      notifyListeners();
    });
  }
}
