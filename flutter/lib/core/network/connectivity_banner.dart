import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

/// A slim banner that appears at the top of a page when the device is offline.
///
/// Usage — add inside a [Column] above the main body:
/// ```dart
/// Column(children: [
///   const ConnectivityBanner(),
///   Expanded(child: _body),
/// ])
/// ```
class ConnectivityBanner extends StatefulWidget {
  const ConnectivityBanner({super.key});

  @override
  State<ConnectivityBanner> createState() => _ConnectivityBannerState();
}

class _ConnectivityBannerState extends State<ConnectivityBanner> {
  // dynamic subscription to support both connectivity_plus v4 and v5+
  StreamSubscription<dynamic>? _sub;
  bool _isOffline = false;

  @override
  void initState() {
    super.initState();
    Connectivity().checkConnectivity().then((r) => _update(_offline(r)));
    _sub = Connectivity()
        .onConnectivityChanged
        .listen((dynamic r) => _update(_offline(r)));
  }

  bool _offline(dynamic r) {
    if (r is List) return r.every((e) => e == ConnectivityResult.none);
    return r == ConnectivityResult.none;
  }

  void _update(bool offline) {
    if (!mounted || offline == _isOffline) return;
    setState(() => _isOffline = offline);
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isOffline) return const SizedBox.shrink();
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      color: Colors.red.shade700,
      child: const Row(
        children: [
          Icon(Icons.wifi_off, size: 14, color: Colors.white),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Offline — changes saved and will sync when reconnected',
              style: TextStyle(fontSize: 12, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
