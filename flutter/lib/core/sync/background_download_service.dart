import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';

// ---------------------------------------------------------------------------
// WorkManager top-level callback — runs in a separate isolate.
// Must be a top-level function annotated with @pragma('vm:entry-point').
// ---------------------------------------------------------------------------

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    if (taskName == BackgroundDownloadService.bgTaskName) {
      final prefs = await SharedPreferences.getInstance();

      // Skip if already synced within the last 4 hours (guard against over-firing)
      final lastSync = prefs.getInt(BackgroundDownloadService.prefLastSyncMs) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      if (now - lastSync < 4 * 3600 * 1000) return true;

      // Signal the app to download next time it resumes (avoids complex isolate DI)
      await prefs.setBool(BackgroundDownloadService.prefPendingBgDownload, true);
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Download progress model
// ---------------------------------------------------------------------------

enum DownloadStatus { idle, starting, downloading, done, capReached, error }

class DownloadProgress {
  final DownloadStatus status;
  final String? stepLabel;
  final int bytesUsed;
  final String? errorMessage;

  const DownloadProgress({
    required this.status,
    this.stepLabel,
    this.bytesUsed = 0,
    this.errorMessage,
  });

  bool get isDone =>
      status == DownloadStatus.done || status == DownloadStatus.capReached;
}

// ---------------------------------------------------------------------------
// BackgroundDownloadService
// ---------------------------------------------------------------------------

/// Manages offline data download — both WiFi-triggered and manual.
///
/// Storage cap: 500 MB total. Size cap takes priority over age.
class BackgroundDownloadService {
  static const bgTaskName = 'setuBgDownload';
  static const prefLastSyncMs = 'bg_last_sync_ms';
  static const prefTotalBytes = 'bg_total_bytes';
  static const prefAutoDownload = 'bg_auto_download';
  static const prefPendingBgDownload = 'bg_pending_download';
  static const maxStorageBytes = 500 * 1024 * 1024; // 500 MB

  final SetuApiClient _apiClient;
  final AppDatabase _database;
  final Logger _log = Logger();

  bool _isDownloading = false;
  bool get isDownloading => _isDownloading;

  final _progressCtrl = StreamController<DownloadProgress>.broadcast();
  Stream<DownloadProgress> get progress => _progressCtrl.stream;

  // Use dynamic to be compatible with both connectivity_plus v4 (single result)
  // and v5+ (list of results)
  StreamSubscription<dynamic>? _connectivitySub;

  BackgroundDownloadService({
    required SetuApiClient apiClient,
    required AppDatabase database,
  })  : _apiClient = apiClient,
        _database = database;

  // ---- WorkManager setup --------------------------------------------------

  static Future<void> initWorkManager() async {
    await Workmanager().initialize(
      callbackDispatcher,
      isInDebugMode: kDebugMode,
    );
  }

  /// Register periodic background task (WiFi only, battery not low, every 6h).
  static Future<void> schedulePeriodicTask() async {
    await Workmanager().registerPeriodicTask(
      bgTaskName,
      bgTaskName,
      frequency: const Duration(hours: 6),
      constraints: Constraints(
        networkType: NetworkType.unmetered,
        requiresBatteryNotLow: true,
      ),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    );
  }

  static Future<void> cancelPeriodicTask() async {
    await Workmanager().cancelByUniqueName(bgTaskName);
  }

  // ---- Auto-WiFi listener -------------------------------------------------

  /// Start watching for WiFi connections. Auto-downloads when detected.
  void startWifiListener() {
    _connectivitySub?.cancel();
    _connectivitySub =
        Connectivity().onConnectivityChanged.listen((dynamic result) async {
      final bool onWifi = _isWifi(result);
      if (!onWifi || _isDownloading) return;

      final prefs = await SharedPreferences.getInstance();
      final autoEnabled = prefs.getBool(prefAutoDownload) ?? true;
      if (!autoEnabled) return;

      final lastSync = prefs.getInt(prefLastSyncMs) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      if (now - lastSync < 6 * 3600 * 1000) return; // 6h minimum gap

      _log.i('BackgroundDownload: WiFi detected, starting auto-download');
      await _performDownload(prefs);
    });
  }

  void stopWifiListener() {
    _connectivitySub?.cancel();
    _connectivitySub = null;
  }

  bool _isWifi(dynamic result) {
    if (result is List) {
      return result.any((r) => r == ConnectivityResult.wifi);
    }
    return result == ConnectivityResult.wifi;
  }

  // ---- Check pending flag set by WorkManager isolate ----------------------

  Future<void> checkAndRunPendingDownload() async {
    final prefs = await SharedPreferences.getInstance();
    final pending = prefs.getBool(prefPendingBgDownload) ?? false;
    if (!pending || _isDownloading) return;
    await prefs.setBool(prefPendingBgDownload, false);
    await _performDownload(prefs);
  }

  // ---- Manual trigger (from settings UI) ----------------------------------

  Future<void> downloadNow() async {
    if (_isDownloading) return;
    final prefs = await SharedPreferences.getInstance();
    await _performDownload(prefs);
  }

  // ---- Core download logic ------------------------------------------------

  Future<void> _performDownload(SharedPreferences prefs) async {
    _isDownloading = true;
    _emit(const DownloadProgress(status: DownloadStatus.starting));

    try {
      var bytesUsed = prefs.getInt(prefTotalBytes) ?? 0;

      if (bytesUsed >= maxStorageBytes) {
        _emit(DownloadProgress(
            status: DownloadStatus.capReached, bytesUsed: bytesUsed));
        return;
      }

      // P1: Refresh EPS/project list (~2 MB)
      _emit(DownloadProgress(
          status: DownloadStatus.downloading,
          stepLabel: 'Projects…',
          bytesUsed: bytesUsed));
      bytesUsed += await _downloadProjects();

      if (bytesUsed < maxStorageBytes) {
        // P2: Activity lists for all cached projects
        _emit(DownloadProgress(
            status: DownloadStatus.downloading,
            stepLabel: 'Activity lists…',
            bytesUsed: bytesUsed));
        bytesUsed += await _downloadActivityLists(prefs);
      }

      await prefs.setInt(prefTotalBytes, bytesUsed);
      await prefs.setInt(prefLastSyncMs, DateTime.now().millisecondsSinceEpoch);

      _emit(DownloadProgress(status: DownloadStatus.done, bytesUsed: bytesUsed));
      _log.i('BackgroundDownload: done. Storage: ${_fmt(bytesUsed)}');
    } catch (e) {
      _log.e('BackgroundDownload error: $e');
      _emit(DownloadProgress(
          status: DownloadStatus.error, errorMessage: e.toString()));
    } finally {
      _isDownloading = false;
    }
  }

  Future<int> _downloadProjects() async {
    try {
      final raw = await _apiClient.getMyProjects();
      return jsonEncode(raw).length;
    } catch (_) {
      return 0;
    }
  }

  Future<int> _downloadActivityLists(SharedPreferences prefs) async {
    try {
      // Discover known project IDs from the local cache
      final rows = await _database.selectOnlyDistinctProjectIds();
      int totalBytes = 0;

      for (final projectId in rows) {
        final raw = await _apiClient.getQualityActivityLists(
            projectId: projectId);
        await _database.cacheActivityLists(
            raw.cast<Map<String, dynamic>>(), projectId);
        totalBytes += jsonEncode(raw).length;

        if ((prefs.getInt(prefTotalBytes) ?? 0) + totalBytes >=
            maxStorageBytes) {
          break;
        }
      }
      return totalBytes;
    } catch (_) {
      return 0;
    }
  }

  void _emit(DownloadProgress p) {
    if (!_progressCtrl.isClosed) _progressCtrl.add(p);
  }

  String _fmt(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }

  void dispose() {
    stopWifiListener();
    _progressCtrl.close();
  }

  // ---- Static preference helpers (used by settings UI) --------------------

  static Future<bool> isAutoDownloadEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(prefAutoDownload) ?? true;
  }

  static Future<void> setAutoDownload(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(prefAutoDownload, enabled);
    if (enabled) {
      await schedulePeriodicTask();
    } else {
      await cancelPeriodicTask();
    }
  }

  static Future<DateTime?> lastSyncTime() async {
    final prefs = await SharedPreferences.getInstance();
    final ms = prefs.getInt(prefLastSyncMs);
    return ms != null ? DateTime.fromMillisecondsSinceEpoch(ms) : null;
  }

  static Future<int> cachedStorageBytes() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(prefTotalBytes) ?? 0;
  }

  static Future<void> clearStorageCounter() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(prefTotalBytes);
    await prefs.remove(prefLastSyncMs);
  }
}
