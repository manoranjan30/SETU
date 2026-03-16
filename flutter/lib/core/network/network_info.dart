import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Thin wrapper around the `connectivity_plus` package that provides
/// clean async/stream accessors for the current network state.
///
/// This class is injected wherever one-shot connectivity checks are needed
/// (e.g., before attempting an API call or starting a sync).  For continuous
/// reactive updates throughout the widget tree, use [NetworkStatusNotifier]
/// with a `Provider` instead.
class NetworkInfo {
  // Single Connectivity instance created once per NetworkInfo object.
  // connectivity_plus manages its own platform channel lifecycle internally.
  final Connectivity _connectivity = Connectivity();

  /// Returns `true` if the device currently has any network interface active.
  ///
  /// This is a one-shot async check — it does not stream future changes.
  /// [ConnectivityResult.none] is the only result considered "offline";
  /// wifi, mobile, ethernet, VPN, etc. are all treated as "online" here.
  Future<bool> get isConnected async {
    final result = await _connectivity.checkConnectivity();
    return result != ConnectivityResult.none;
  }

  /// Returns the current connectivity type as the app-defined [ConnectivityType] enum.
  ///
  /// Uses [ConnectivityType] rather than the raw [ConnectivityResult] so that
  /// feature code is decoupled from the `connectivity_plus` package types —
  /// if the package changes, only this class needs updating.
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
        // Covers ConnectivityResult.none, vpn, bluetooth, and any future
        // values added by the package that we haven't mapped yet.
        return ConnectivityType.none;
    }
  }

  /// Raw stream of [ConnectivityResult] changes from the platform.
  ///
  /// Exposed primarily for [NetworkStatusNotifier] which listens to this
  /// stream and translates events into notifyListeners() calls.
  Stream<ConnectivityResult> get onConnectivityChanged =>
      _connectivity.onConnectivityChanged;

  /// Convenience stream that emits `true` (online) or `false` (offline)
  /// whenever connectivity status changes.
  ///
  /// Maps the raw [ConnectivityResult] stream so callers don't need to
  /// import `connectivity_plus` to consume the boolean status.
  Stream<bool> get onConnectionStatusChanged {
    return _connectivity.onConnectivityChanged.map(
      // Any result other than 'none' is considered connected.
      (result) => result != ConnectivityResult.none,
    );
  }
}

/// Simplified connectivity type used throughout the app.
///
/// Intentionally narrower than [ConnectivityResult] — VPN, Bluetooth, and
/// other exotic connection types are all treated as [none] since the app only
/// needs to distinguish wifi vs. mobile for UX hints (e.g., "high-res photo
/// upload is only recommended on wifi").
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
/// Widgets can then call `context.watch<NetworkStatusNotifier>().isConnected`
/// to reactively rebuild when connectivity changes.
///
/// The notifier initialises by doing a one-shot check immediately, then
/// subscribes to the platform stream for all subsequent changes.
class NetworkStatusNotifier extends ChangeNotifier {
  final NetworkInfo _networkInfo;

  // Optimistic initial state — assume connected until proven otherwise.
  // This prevents unnecessary "no connection" flash on startup before the
  // first async check completes.
  bool _isConnected = true;
  ConnectivityType _connectivityType = ConnectivityType.none;

  /// Creates the notifier and immediately starts monitoring connectivity.
  NetworkStatusNotifier(this._networkInfo) {
    // Kick off the async initialisation; any errors are surfaced via the
    // platform stream listener below.
    _initialize();
  }

  /// Whether the device currently has an active network connection.
  bool get isConnected => _isConnected;

  /// The type of the current active connection (wifi, mobile, etc.).
  ConnectivityType get connectivityType => _connectivityType;

  /// Performs an initial one-shot check, updates state, then subscribes to
  /// ongoing connectivity changes for the lifetime of this notifier.
  Future<void> _initialize() async {
    // One-shot check on startup to set the correct initial state before any
    // widgets render — avoids the false "connected" default being shown.
    _isConnected = await _networkInfo.isConnected;
    _connectivityType = await _networkInfo.connectivityType;

    // Notify synchronously so any already-mounted widgets get the correct state.
    notifyListeners();

    // Subscribe to the raw stream for all future connectivity changes.
    // We re-map ConnectivityResult here (rather than the boolean stream) so
    // we can update both _isConnected and _connectivityType in one listener.
    _networkInfo.onConnectivityChanged.listen((result) {
      _isConnected = result != ConnectivityResult.none;

      // Translate the raw result to our internal enum.
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
          // none, vpn, bluetooth, etc. — all treated as disconnected/unknown.
          _connectivityType = ConnectivityType.none;
      }

      // Trigger a rebuild on all listening widgets (e.g., sync status banner).
      notifyListeners();
    });
  }
}
