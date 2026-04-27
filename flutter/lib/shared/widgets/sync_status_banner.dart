import 'package:flutter/material.dart';
import 'package:setu_mobile/core/sync/connectivity_sync_service.dart';
import 'package:setu_mobile/injection_container.dart';

/// A zero-height-when-empty banner strip showing pending sync state.
///
/// Place this as the first child inside any `Column` body to show:
///   - "N items pending upload" (amber) when mutations are queued offline.
///   - "Syncing…" (blue + spinner) while a sync cycle is running.
///   - "N items failed — tap to retry" (red) when sync errors exist.
///
/// Collapses to nothing (`SizedBox.shrink`) when the queue is empty and
/// no sync is in progress, so it never takes space when not needed.
///
/// Example:
/// ```dart
/// body: Column(children: [
///   const SyncStatusBanner(),
///   Expanded(child: _myContent),
/// ])
/// ```
class SyncStatusBanner extends StatefulWidget {
  const SyncStatusBanner({super.key});

  @override
  State<SyncStatusBanner> createState() => _SyncStatusBannerState();
}

class _SyncStatusBannerState extends State<SyncStatusBanner> {
  late final ConnectivitySyncService _svc;

  @override
  void initState() {
    super.initState();
    _svc = sl<ConnectivitySyncService>();
    _svc.addListener(_onChanged);
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _svc.removeListener(_onChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pending = _svc.pendingCount;
    final syncing = _svc.isSyncing;
    final errors = _svc.errorCount;

    if (pending == 0 && !syncing && errors == 0) {
      return const SizedBox.shrink();
    }

    final Color bg;
    final Color fg;
    final IconData icon;
    final String message;

    if (syncing) {
      bg = const Color(0xFFEFF6FF);
      fg = const Color(0xFF2563EB);
      icon = Icons.sync_rounded;
      message = 'Syncing…';
    } else if (errors > 0) {
      bg = const Color(0xFFFEF2F2);
      fg = const Color(0xFFDC2626);
      icon = Icons.sync_problem_rounded;
      message = errors == 1
          ? '1 item failed to sync — tap to retry'
          : '$errors items failed to sync — tap to retry';
    } else {
      bg = const Color(0xFFFFF7ED);
      fg = const Color(0xFFD97706);
      icon = Icons.cloud_upload_outlined;
      message = pending == 1
          ? '1 item pending upload'
          : '$pending items pending upload';
    }

    return GestureDetector(
      onTap: errors > 0 ? () => _svc.retryFailed() : null,
      child: AnimatedSize(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: Container(
          width: double.infinity,
          color: bg,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              syncing
                  ? SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.5,
                        color: fg,
                      ),
                    )
                  : Icon(icon, size: 13, color: fg),
              const SizedBox(width: 7),
              Text(
                message,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: fg),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
