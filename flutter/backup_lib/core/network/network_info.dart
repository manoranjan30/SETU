import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Network connectivity information service
class NetworkInfo {
  final Connectivity _connectivity = Connectivity();

  /// Check if device is online
  Future<bool> get isConnected async {
    final result = await _connectivity.checkConnectivity();
    return result != ConnectivityResult.none;
  }

  /// Get current connectivity type
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

  /// Stream of connectivity changes
  Stream<ConnectivityResult> get onConnectivityChanged =>
      _connectivity.onConnectivityChanged;

  /// Stream of online/offline status changes
  Stream<bool> get onConnectionStatusChanged {
    return _connectivity.onConnectivityChanged.map(
      (result) => result != ConnectivityResult.none,
    );
  }
}

/// Connectivity type enumeration
enum ConnectivityType {
  wifi,
  mobile,
  ethernet,
  none,
}

/// Network status notifier for use with providers
class NetworkStatusNotifier extends ChangeNotifier {
  final NetworkInfo _networkInfo;
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
