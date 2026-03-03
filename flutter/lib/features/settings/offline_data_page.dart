import 'dart:async';
import 'package:flutter/material.dart';
import 'package:setu_mobile/core/sync/background_download_service.dart';
import 'package:setu_mobile/injection_container.dart';

/// Settings page for offline data management.
///
/// Shows storage usage, last sync time, auto-download toggle,
/// and a manual "Download Now" button.
class OfflineDataPage extends StatefulWidget {
  const OfflineDataPage({super.key});

  @override
  State<OfflineDataPage> createState() => _OfflineDataPageState();
}

class _OfflineDataPageState extends State<OfflineDataPage> {
  late final BackgroundDownloadService _svc;
  StreamSubscription<DownloadProgress>? _progressSub;

  bool _autoEnabled = true;
  int _bytesUsed = 0;
  DateTime? _lastSync;
  DownloadProgress? _currentProgress;

  static const _maxBytes = BackgroundDownloadService.maxStorageBytes;

  @override
  void initState() {
    super.initState();
    _svc = sl<BackgroundDownloadService>();
    _load();
    _progressSub = _svc.progress.listen((p) {
      if (mounted) setState(() => _currentProgress = p);
    });
  }

  Future<void> _load() async {
    final auto = await BackgroundDownloadService.isAutoDownloadEnabled();
    final bytes = await BackgroundDownloadService.cachedStorageBytes();
    final last = await BackgroundDownloadService.lastSyncTime();
    if (mounted) {
      setState(() {
        _autoEnabled = auto;
        _bytesUsed = bytes;
        _lastSync = last;
      });
    }
  }

  @override
  void dispose() {
    _progressSub?.cancel();
    super.dispose();
  }

  String _fmt(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }

  String _lastSyncLabel() {
    if (_lastSync == null) return 'Never';
    final diff = DateTime.now().difference(_lastSync!);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Future<void> _toggleAuto(bool val) async {
    await BackgroundDownloadService.setAutoDownload(val);
    if (mounted) setState(() => _autoEnabled = val);
  }

  Future<void> _downloadNow() async {
    await _svc.downloadNow();
    await _load(); // refresh stats after download
  }

  Future<void> _clearCache() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear offline data?'),
        content: const Text(
            'This will reset the offline storage counter. Cached data in the '
            'database will be refreshed on next download.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
                backgroundColor: Colors.red.shade700),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await BackgroundDownloadService.clearStorageCounter();
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pct = (_bytesUsed / _maxBytes).clamp(0.0, 1.0);
    final isDownloading = _svc.isDownloading;
    final progress = _currentProgress;

    return Scaffold(
      appBar: AppBar(title: const Text('Offline Data')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ---- Storage card ----
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Storage Used',
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(_fmt(_bytesUsed),
                          style: theme.textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.bold)),
                      Text('of ${_fmt(_maxBytes)}',
                          style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.6))),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct,
                      minHeight: 8,
                      backgroundColor:
                          theme.colorScheme.onSurface.withValues(alpha: 0.1),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        pct > 0.8
                            ? Colors.orange.shade700
                            : theme.colorScheme.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Last sync: ${_lastSyncLabel()}',
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.6)),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // ---- Download progress (visible while downloading) ----
          if (isDownloading && progress != null) ...[
            Card(
              color: theme.colorScheme.primaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        progress.stepLabel ?? 'Downloading…',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // ---- Auto download toggle ----
          Card(
            child: SwitchListTile(
              title: const Text('Auto-download on WiFi'),
              subtitle: const Text(
                  'Refresh offline data automatically every 6 hours when connected to WiFi'),
              value: _autoEnabled,
              onChanged: isDownloading ? null : _toggleAuto,
            ),
          ),

          const SizedBox(height: 8),

          // ---- Manual download button ----
          FilledButton.icon(
            onPressed: isDownloading ? null : _downloadNow,
            icon: isDownloading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child:
                        CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.download_outlined),
            label: Text(isDownloading ? 'Downloading…' : 'Download Now'),
            style: FilledButton.styleFrom(
              minimumSize: const Size(double.infinity, 48),
            ),
          ),

          const SizedBox(height: 8),

          // ---- Clear cache ----
          OutlinedButton.icon(
            onPressed: isDownloading ? null : _clearCache,
            icon: Icon(Icons.delete_outline, color: Colors.red.shade700),
            label: Text('Clear Offline Data',
                style: TextStyle(color: Colors.red.shade700)),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: Colors.red.shade300),
              minimumSize: const Size(double.infinity, 48),
            ),
          ),

          const SizedBox(height: 24),

          // ---- Info section ----
          Text('How offline data works',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const _InfoRow(
            icon: Icons.storage_outlined,
            text:
                'Up to 500 MB of project data is stored on your device. When the cap is reached, older data is removed first.',
          ),
          const _InfoRow(
            icon: Icons.wifi_outlined,
            text:
                'Data downloads automatically on WiFi every 6 hours. Use "Download Now" for an immediate refresh.',
          ),
          const _InfoRow(
            icon: Icons.photo_outlined,
            text:
                'Downloaded photos are cached for 15 days and then removed to save space.',
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon,
              size: 18,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: theme.textTheme.bodySmall?.copyWith(
                    color:
                        theme.colorScheme.onSurface.withValues(alpha: 0.7))),
          ),
        ],
      ),
    );
  }
}
