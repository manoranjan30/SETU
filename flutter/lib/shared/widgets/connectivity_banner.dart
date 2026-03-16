import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

/// App-level offline indicator banner.
/// Wraps a child widget — when the device goes offline, an animated amber banner
/// slides in at the top. When back online, it slides out and briefly shows a
/// green "Back online" confirmation.
class ConnectivityBanner extends StatefulWidget {
  final Widget child;

  const ConnectivityBanner({super.key, required this.child});

  @override
  State<ConnectivityBanner> createState() => _ConnectivityBannerState();
}

class _ConnectivityBannerState extends State<ConnectivityBanner> {
  bool _isOffline = false;
  bool _showOnlineBriefly = false;
  Timer? _onlineTimer;
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _checkInitial();
    _sub = Connectivity()
        .onConnectivityChanged
        .listen(_handleConnectivityChange);
  }

  Future<void> _checkInitial() async {
    final result = await Connectivity().checkConnectivity();
    final offline = _resultIsOffline(result);
    if (mounted && offline) setState(() => _isOffline = true);
  }

  bool _resultIsOffline(dynamic result) {
    if (result is List) {
      final list = result;
      return list.isEmpty ||
          list.every((r) => r == ConnectivityResult.none);
    }
    return result == ConnectivityResult.none;
  }

  void _handleConnectivityChange(dynamic result) {
    final offline = _resultIsOffline(result);
    if (!mounted) return;

    if (offline && !_isOffline) {
      // Just went offline
      _onlineTimer?.cancel();
      setState(() {
        _isOffline = true;
        _showOnlineBriefly = false;
      });
    } else if (!offline && _isOffline) {
      // Just came back online
      setState(() {
        _isOffline = false;
        _showOnlineBriefly = true;
      });
      _onlineTimer?.cancel();
      _onlineTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _showOnlineBriefly = false);
      });
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    _onlineTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Offline banner
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
          child: _isOffline
              ? _Banner(
                  icon: Icons.cloud_off_rounded,
                  message: 'You\'re offline — showing cached data',
                  color: const Color(0xFFD97706),
                  bg: const Color(0xFFFEF3C7),
                )
              : _showOnlineBriefly
                  ? _Banner(
                      icon: Icons.cloud_done_rounded,
                      message: 'Back online',
                      color: const Color(0xFF16A34A),
                      bg: const Color(0xFFF0FDF4),
                    )
                  : const SizedBox.shrink(),
        ),
        Expanded(child: widget.child),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  final IconData icon;
  final String message;
  final Color color;
  final Color bg;

  const _Banner({
    required this.icon,
    required this.message,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: bg,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 8),
          Text(
            message,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
