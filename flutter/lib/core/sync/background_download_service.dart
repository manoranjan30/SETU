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

/// Entry point registered with WorkManager for background task execution.
///
/// This function runs in a **separate Dart isolate** spawned by the Android
/// WorkManager framework. Because it is a different isolate, it cannot access
/// any singleton objects or DI containers from the main isolate. The only
/// shared state available is [SharedPreferences] (which is persisted to disk).
///
/// Rather than attempting to recreate the full DI graph in this isolate, the
/// strategy is to write a flag (`bg_pending_download`) that the main isolate
/// reads on next resume via [BackgroundDownloadService.checkAndRunPendingDownload].
/// This keeps the background isolate thin and avoids complex isolate-to-isolate
/// communication.
///
/// `@pragma('vm:entry-point')` prevents the Dart tree-shaker from removing
/// this function, which would silently break WorkManager's ability to call it.
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    if (taskName == BackgroundDownloadService.bgTaskName) {
      final prefs = await SharedPreferences.getInstance();

      // Skip if already synced within the last 4 hours (guard against over-firing).
      // WorkManager's minimum period is 15 minutes on Android, so the platform
      // may fire more frequently than our 6-hour target. The time check here
      // provides a second layer of throttling that persists across app restarts.
      final lastSync = prefs.getInt(BackgroundDownloadService.prefLastSyncMs) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      if (now - lastSync < 4 * 3600 * 1000) return true; // 4 h guard in isolate

      // Signal the app to download next time it resumes (avoids complex isolate DI).
      // The flag is read and cleared by [checkAndRunPendingDownload] when the
      // main isolate resumes, ensuring the download runs with full DI context.
      await prefs.setBool(BackgroundDownloadService.prefPendingBgDownload, true);
    }
    return true; // Always return true — WorkManager treats false as "retry"
  });
}

// ---------------------------------------------------------------------------
// Download progress model
// ---------------------------------------------------------------------------

/// Represents the lifecycle state of a background download operation.
enum DownloadStatus { idle, starting, downloading, done, capReached, error }

/// Immutable progress snapshot emitted by [BackgroundDownloadService.progress].
///
/// The UI listens to the [BackgroundDownloadService.progress] stream and
/// renders a status row based on this object.
class DownloadProgress {
  final DownloadStatus status;

  /// Human-readable label for the current download step (e.g. "Projects…").
  final String? stepLabel;

  /// Cumulative bytes downloaded in this session.
  final int bytesUsed;

  final String? errorMessage;

  const DownloadProgress({
    required this.status,
    this.stepLabel,
    this.bytesUsed = 0,
    this.errorMessage,
  });

  /// True when the download has finished (either successfully or due to cap).
  bool get isDone =>
      status == DownloadStatus.done || status == DownloadStatus.capReached;
}

// ---------------------------------------------------------------------------
// BackgroundDownloadService
// ---------------------------------------------------------------------------

/// Manages offline data pre-download — both WiFi-triggered and manual.
///
/// Responsibility: keep the local SQLite cache fresh so the app works fully
/// offline for field engineers. Data is downloaded in priority order:
///   1. Projects list (~2 MB) — needed for any feature.
///   2. Quality activity lists for all known projects.
///   3. Quality activities (checklist items) within each activity list.
///   4. Quality site observations for all known projects.
///   5. EHS site observations for all known projects.
///
/// Storage cap: 500 MB total. The cap is evaluated against the byte count
/// from the **previous** completed run (stored in SharedPreferences) to
/// avoid re-accumulating on every fresh download.
///
/// The service supports three trigger mechanisms:
/// - **Periodic background task** (WorkManager, every 6 h, WiFi only).
/// - **WiFi event listener** (`startWifiListener`) — triggers when the device
///   connects to WiFi and the last download was > 6 hours ago.
/// - **Manual** (`downloadNow`) — called from the Settings screen.
class BackgroundDownloadService {
  /// WorkManager task identifier — must be unique within the app.
  static const bgTaskName = 'setuBgDownload';

  /// SharedPreferences key: epoch ms of the last completed download.
  static const prefLastSyncMs = 'bg_last_sync_ms';

  /// SharedPreferences key: cumulative bytes downloaded in the last run.
  static const prefTotalBytes = 'bg_total_bytes';

  /// SharedPreferences key: user preference for auto-download on WiFi.
  static const prefAutoDownload = 'bg_auto_download';

  /// SharedPreferences key: flag set by the WorkManager isolate to request a
  /// download on next main-isolate resume.
  static const prefPendingBgDownload = 'bg_pending_download';

  /// Hard cap on total cached data. Chosen to fit comfortably on low-end
  /// Android devices common on Indian construction sites (typically 8–16 GB
  /// internal storage), without monopolising storage for a single app.
  static const maxStorageBytes = 500 * 1024 * 1024; // 500 MB

  final SetuApiClient _apiClient;
  final AppDatabase _database;
  final Logger _log = Logger();

  bool _isDownloading = false;

  /// True while a download is in progress — prevents concurrent runs.
  bool get isDownloading => _isDownloading;

  /// Broadcast stream of [DownloadProgress] events.
  ///
  /// Broadcast (not single-subscription) so multiple UI widgets can listen
  /// simultaneously (e.g. a status bar widget and a settings page detail).
  final _progressCtrl = StreamController<DownloadProgress>.broadcast();
  Stream<DownloadProgress> get progress => _progressCtrl.stream;

  // Use dynamic to be compatible with both connectivity_plus v4 (single result)
  // and v5+ (list of results). The connectivity_plus API changed its emission
  // type between major versions; [_isWifi] normalises both shapes.
  StreamSubscription<dynamic>? _connectivitySub;

  BackgroundDownloadService({
    required SetuApiClient apiClient,
    required AppDatabase database,
  })  : _apiClient = apiClient,
        _database = database;

  // ---- WorkManager setup --------------------------------------------------

  /// Initialise the WorkManager framework with our [callbackDispatcher].
  ///
  /// Must be called once at app startup (before registering tasks).
  /// [isInDebugMode] enables WorkManager's verbose logging in debug builds.
  static Future<void> initWorkManager() async {
    await Workmanager().initialize(
      callbackDispatcher,
      isInDebugMode: kDebugMode,
    );
  }

  /// Register periodic background task (WiFi only, battery not low, every 6h).
  ///
  /// [ExistingPeriodicWorkPolicy.keep] means that if a task with this unique
  /// name already exists in the WorkManager queue, the registration is ignored.
  /// This prevents a new 6-hour window from starting every time the app launches.
  static Future<void> schedulePeriodicTask() async {
    await Workmanager().registerPeriodicTask(
      bgTaskName,
      bgTaskName,
      frequency: const Duration(hours: 6),
      constraints: Constraints(
        // `unmetered` = WiFi or ethernet — prevents downloads over mobile data
        // which would consume the user's data allowance without consent.
        networkType: NetworkType.unmetered,
        requiresBatteryNotLow: true, // Avoid draining battery on site
      ),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    );
  }

  /// Cancel the periodic background task.
  ///
  /// Called when the user disables auto-download in settings.
  static Future<void> cancelPeriodicTask() async {
    await Workmanager().cancelByUniqueName(bgTaskName);
  }

  // ---- Auto-WiFi listener -------------------------------------------------

  /// Start watching for WiFi connections. Auto-downloads when detected.
  ///
  /// The WiFi listener is a foreground complement to the WorkManager background
  /// task: it triggers immediately when the user walks into a WiFi zone, rather
  /// than waiting up to 6 hours for the next WorkManager window.
  ///
  /// Cancels any existing subscription before re-subscribing so this can be
  /// called multiple times (e.g. after a settings toggle) without leaking
  /// stream subscriptions.
  void startWifiListener() {
    _connectivitySub?.cancel();
    _connectivitySub =
        Connectivity().onConnectivityChanged.listen((dynamic result) async {
      final bool onWifi = _isWifi(result);
      // Bail out early if not on WiFi or a download is already in progress.
      if (!onWifi || _isDownloading) return;

      final prefs = await SharedPreferences.getInstance();
      final autoEnabled = prefs.getBool(prefAutoDownload) ?? true;
      if (!autoEnabled) return; // Respect the user's setting

      // Enforce the 6-hour minimum gap between downloads to avoid re-downloading
      // the same data every time the user briefly disconnects and reconnects.
      final lastSync = prefs.getInt(prefLastSyncMs) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      if (now - lastSync < 6 * 3600 * 1000) return; // 6h minimum gap

      _log.i('BackgroundDownload: WiFi detected, starting auto-download');
      await _performDownload(prefs);
    });
  }

  /// Stop the WiFi connectivity listener and cancel the subscription.
  void stopWifiListener() {
    _connectivitySub?.cancel();
    _connectivitySub = null;
  }

  /// Normalise the connectivity_plus result to a simple WiFi boolean.
  ///
  /// connectivity_plus v4 emits a single [ConnectivityResult]; v5+ emits a
  /// [List<ConnectivityResult>]. This helper handles both without requiring
  /// a version-specific import.
  bool _isWifi(dynamic result) {
    if (result is List) {
      // v5+: check if any of the active connections is WiFi.
      return result.any((r) => r == ConnectivityResult.wifi);
    }
    // v4: result is a single enum value.
    return result == ConnectivityResult.wifi;
  }

  // ---- Check pending flag set by WorkManager isolate ----------------------

  /// Check whether the WorkManager isolate set a pending download flag and,
  /// if so, execute the download now in the main isolate.
  ///
  /// Called on app resume (from `main.dart`). The flag is cleared before the
  /// download starts to prevent a second download if the app is backgrounded
  /// and resumed again before the first completes.
  Future<void> checkAndRunPendingDownload() async {
    final prefs = await SharedPreferences.getInstance();
    final pending = prefs.getBool(prefPendingBgDownload) ?? false;
    if (!pending || _isDownloading) return;
    // Clear the flag before starting so it isn't processed again on the next
    // resume if the download is still in progress.
    await prefs.setBool(prefPendingBgDownload, false);
    await _performDownload(prefs);
  }

  // ---- Manual trigger (from settings UI) ----------------------------------

  /// Trigger a download immediately, regardless of the last sync time.
  ///
  /// Used by the "Download now" button in the Settings screen. The 6-hour
  /// cooldown is intentionally bypassed here because the user explicitly
  /// requested a refresh.
  Future<void> downloadNow() async {
    if (_isDownloading) return; // Prevent double-tap
    final prefs = await SharedPreferences.getInstance();
    await _performDownload(prefs);
  }

  // ---- Core download logic ------------------------------------------------

  /// Execute the full download sequence and update SharedPreferences state.
  ///
  /// Downloads are performed in priority order (projects first, then activity
  /// lists) with a storage cap check between steps. Each step emits a
  /// [DownloadProgress] event so the UI can show granular progress.
  ///
  /// [bytesUsed] is reset to 0 at the start of each run rather than
  /// accumulated across runs. This is correct because all inserts use
  /// [InsertMode.insertOrReplace] — a re-download replaces existing rows and
  /// does not increase the actual on-disk footprint. Accumulating would cause
  /// the cap to be hit prematurely on subsequent runs.
  Future<void> _performDownload(SharedPreferences prefs) async {
    _isDownloading = true;
    _emit(const DownloadProgress(status: DownloadStatus.starting));

    try {
      // Always start from 0 — each download upserts (replaces) existing cached
      // data in SQLite, so the footprint of a re-download is the same as the
      // first download and should NOT be accumulated on top of prior runs.
      var bytesUsed = 0;

      // Cap guard: if the previous completed run already saturated storage, bail.
      // This prevents a full download attempt when we know storage is full,
      // even before hitting the network.
      final prevBytes = prefs.getInt(prefTotalBytes) ?? 0;
      if (prevBytes >= maxStorageBytes) {
        _emit(DownloadProgress(
            status: DownloadStatus.capReached, bytesUsed: prevBytes));
        return;
      }

      // P1: Refresh EPS/project list (~2 MB).
      // Always downloaded first because every other feature depends on the
      // project list being current.
      _emit(DownloadProgress(
          status: DownloadStatus.downloading,
          stepLabel: 'Projects…',
          bytesUsed: bytesUsed));
      bytesUsed += await _downloadProjects();

      if (bytesUsed < maxStorageBytes) {
        // P2: Activity lists for all cached projects.
        // Only attempted if P1 left room under the cap.
        _emit(DownloadProgress(
            status: DownloadStatus.downloading,
            stepLabel: 'Activity lists…',
            bytesUsed: bytesUsed));
        bytesUsed += await _downloadActivityLists(prefs, bytesUsed);
      }

      if (bytesUsed < maxStorageBytes) {
        // P3: Checklist activities within each activity list.
        // Downloads the individual activity items so the quality request
        // workflow (raise RFI) works fully offline.
        _emit(DownloadProgress(
            status: DownloadStatus.downloading,
            stepLabel: 'Checklist items…',
            bytesUsed: bytesUsed));
        bytesUsed += await _downloadChecklistActivities(bytesUsed);
      }

      if (bytesUsed < maxStorageBytes) {
        // P4: Quality site observations for all known projects.
        _emit(DownloadProgress(
            status: DownloadStatus.downloading,
            stepLabel: 'Quality observations…',
            bytesUsed: bytesUsed));
        bytesUsed += await _downloadQualitySiteObs(bytesUsed);
      }

      if (bytesUsed < maxStorageBytes) {
        // P5: EHS site observations for all known projects.
        _emit(DownloadProgress(
            status: DownloadStatus.downloading,
            stepLabel: 'EHS observations…',
            bytesUsed: bytesUsed));
        bytesUsed += await _downloadEhsSiteObs(bytesUsed);
      }

      if (bytesUsed < maxStorageBytes) {
        // P6: Tower progress (aggregated floor progress per project).
        // Used by the 3D Tower Lens feature when offline.
        _emit(DownloadProgress(
            status: DownloadStatus.downloading,
            stepLabel: 'Tower progress…',
            bytesUsed: bytesUsed));
        bytesUsed += await _downloadTowerProgress(bytesUsed);
      }

      if (bytesUsed < maxStorageBytes) {
        // P7: Building coordinate polygons per project.
        // Used to render actual building footprints in Tower Lens when offline.
        _emit(DownloadProgress(
            status: DownloadStatus.downloading,
            stepLabel: 'Building coordinates…',
            bytesUsed: bytesUsed));
        bytesUsed += await _downloadBuildingCoordinates(bytesUsed);
      }

      // Persist the final byte count so the cap guard works on the next run,
      // and record the completion timestamp for the 6-hour cooldown checks.
      await prefs.setInt(prefTotalBytes, bytesUsed);
      await prefs.setInt(prefLastSyncMs, DateTime.now().millisecondsSinceEpoch);

      _emit(DownloadProgress(status: DownloadStatus.done, bytesUsed: bytesUsed));
      _log.i('BackgroundDownload: done. Storage: ${_fmt(bytesUsed)}');
    } catch (e) {
      _log.e('BackgroundDownload error: $e');
      _emit(DownloadProgress(
          status: DownloadStatus.error, errorMessage: e.toString()));
    } finally {
      // Always clear the downloading flag so future triggers are not blocked.
      _isDownloading = false;
    }
  }

  /// Download the projects list and cache it locally.
  ///
  /// Returns the approximate byte count of the downloaded data (measured as
  /// the JSON-encoded length) so the caller can track cumulative storage use.
  /// Returns 0 on failure so a projects-fetch error does not abort the rest
  /// of the download sequence — the user may still benefit from activity list
  /// updates even if the project list call fails.
  Future<int> _downloadProjects() async {
    try {
      final raw = await _apiClient.getMyProjects();
      // Byte estimate: JSON string length ≈ UTF-8 byte count for ASCII content.
      return jsonEncode(raw).length;
    } catch (_) {
      // Swallow errors silently — the caller only needs a byte count of 0
      // to indicate nothing was cached. The main download flow continues.
      return 0;
    }
  }

  /// Download quality activity lists for all projects currently in the cache.
  ///
  /// Project IDs are discovered by querying [AppDatabase.selectOnlyDistinctProjectIds]
  /// rather than hardcoded, so the list automatically grows as the user opens
  /// new projects in the foreground.
  ///
  /// [alreadyUsedBytes] is passed in so the per-project cap check accounts for
  /// data downloaded in earlier steps (e.g. the projects list). The loop
  /// breaks as soon as the combined total reaches [maxStorageBytes].
  Future<int> _downloadActivityLists(
      SharedPreferences prefs, int alreadyUsedBytes) async {
    try {
      // Discover known project IDs from the local cache.
      final rows = await _database.selectOnlyDistinctProjectIds();
      int totalBytes = 0;

      for (final projectId in rows) {
        final raw = await _apiClient.getQualityActivityLists(
            projectId: projectId);
        // Upsert into local cache — existing rows for this project are replaced
        // with fresher data.
        await _database.cacheActivityLists(
            raw.cast<Map<String, dynamic>>(), projectId);
        totalBytes += jsonEncode(raw).length;

        // Stop downloading more projects once the combined storage cap is hit,
        // to avoid exceeding [maxStorageBytes]. Already-cached projects are
        // not evicted — the cap only limits further writes.
        if (alreadyUsedBytes + totalBytes >= maxStorageBytes) break;
      }
      return totalBytes;
    } catch (_) {
      return 0;
    }
  }

  /// Download the activities (checklist items) for every cached activity list.
  ///
  /// [_downloadActivityLists] only caches the list *metadata*. This step
  /// fetches the individual activity rows within each list so the quality
  /// request flow (raise RFI, view checklist) works fully offline.
  Future<int> _downloadChecklistActivities(int alreadyUsedBytes) async {
    try {
      final projectIds = await _database.selectOnlyDistinctProjectIds();
      int totalBytes = 0;
      for (final projectId in projectIds) {
        final lists = await _database.getCachedActivityLists(projectId, null);
        for (final list in lists) {
          final raw = await _apiClient.getQualityListActivities(list.id);
          await _database.cacheQualityActivities(
            raw.cast<Map<String, dynamic>>(),
            list.id,
            projectId,
            list.epsNodeId,
          );
          totalBytes += jsonEncode(raw).length;
          if (alreadyUsedBytes + totalBytes >= maxStorageBytes) return totalBytes;
        }
      }
      return totalBytes;
    } catch (_) {
      return 0;
    }
  }

  /// Download quality site observations for all known projects.
  Future<int> _downloadQualitySiteObs(int alreadyUsedBytes) async {
    try {
      final projectIds = await _database.selectOnlyDistinctProjectIds();
      int totalBytes = 0;
      for (final projectId in projectIds) {
        // Fetch with a high limit to get all records in one call.
        final raw = await _apiClient.getQualitySiteObs(
            projectId: projectId, limit: 200);
        await _database.cacheQualitySiteObs(
            raw.cast<Map<String, dynamic>>(), projectId);
        totalBytes += jsonEncode(raw).length;
        if (alreadyUsedBytes + totalBytes >= maxStorageBytes) return totalBytes;
      }
      return totalBytes;
    } catch (_) {
      return 0;
    }
  }

  /// Download EHS site observations for all known projects.
  Future<int> _downloadEhsSiteObs(int alreadyUsedBytes) async {
    try {
      final projectIds = await _database.selectOnlyDistinctProjectIds();
      int totalBytes = 0;
      for (final projectId in projectIds) {
        final raw = await _apiClient.getEhsSiteObs(
            projectId: projectId, limit: 200);
        await _database.cacheEhsSiteObs(
            raw.cast<Map<String, dynamic>>(), projectId);
        totalBytes += jsonEncode(raw).length;
        if (alreadyUsedBytes + totalBytes >= maxStorageBytes) return totalBytes;
      }
      return totalBytes;
    } catch (_) {
      return 0;
    }
  }

  /// Download aggregated tower/floor progress for all known projects.
  ///
  /// The response is stored in SharedPreferences (keyed per project) because
  /// it is read-only cached data — no Drift table is needed. The Tower Lens
  /// bloc reads from this cache when the network is unavailable.
  Future<int> _downloadTowerProgress(int alreadyUsedBytes) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final projectIds = await _database.selectOnlyDistinctProjectIds();
      int totalBytes = 0;
      for (final projectId in projectIds) {
        final raw = await _apiClient.getTowerProgress(projectId);
        if (raw != null) {
          final encoded = jsonEncode(raw);
          // Persist as JSON string under a per-project key.
          await prefs.setString('tower_progress_$projectId', encoded);
          totalBytes += encoded.length;
        }
        if (alreadyUsedBytes + totalBytes >= maxStorageBytes) return totalBytes;
      }
      return totalBytes;
    } catch (_) {
      return 0;
    }
  }

  /// Download building coordinate polygons for all known projects.
  ///
  /// Stored in SharedPreferences alongside tower progress so the Tower Lens
  /// painter can render real building footprints without a network call.
  Future<int> _downloadBuildingCoordinates(int alreadyUsedBytes) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final projectIds = await _database.selectOnlyDistinctProjectIds();
      int totalBytes = 0;
      for (final projectId in projectIds) {
        final raw = await _apiClient.getBuildingLineCoordinates(projectId);
        if (raw != null) {
          final encoded = jsonEncode(raw);
          await prefs.setString('building_coords_$projectId', encoded);
          totalBytes += encoded.length;
        }
        if (alreadyUsedBytes + totalBytes >= maxStorageBytes) return totalBytes;
      }
      return totalBytes;
    } catch (_) {
      return 0;
    }
  }

  /// Emit a [DownloadProgress] event to all current stream listeners.
  ///
  /// The `isClosed` guard prevents a `Bad state: Cannot add event after close`
  /// error if `dispose()` is called while a download is still in progress.
  void _emit(DownloadProgress p) {
    if (!_progressCtrl.isClosed) _progressCtrl.add(p);
  }

  /// Format a byte count as a human-readable string (KB or MB).
  String _fmt(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }

  /// Release resources.
  ///
  /// Stops the WiFi listener and closes the progress stream controller so
  /// any downstream stream consumers are properly notified of closure.
  void dispose() {
    stopWifiListener();
    _progressCtrl.close();
  }

  // ---- Static preference helpers (used by settings UI) --------------------

  /// Return whether auto-download on WiFi is currently enabled.
  ///
  /// Defaults to `true` on first launch — opt-out rather than opt-in, because
  /// the majority of field engineers benefit from having fresh data without
  /// needing to configure anything.
  static Future<bool> isAutoDownloadEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(prefAutoDownload) ?? true;
  }

  /// Enable or disable auto-download and update the WorkManager task accordingly.
  ///
  /// If enabled, schedules the periodic background task so downloads happen
  /// even when the app is not running. If disabled, cancels the task to stop
  /// background activity entirely.
  static Future<void> setAutoDownload(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(prefAutoDownload, enabled);
    if (enabled) {
      await schedulePeriodicTask();
    } else {
      await cancelPeriodicTask();
    }
  }

  /// Return the [DateTime] of the last completed download, or null if never run.
  static Future<DateTime?> lastSyncTime() async {
    final prefs = await SharedPreferences.getInstance();
    final ms = prefs.getInt(prefLastSyncMs);
    return ms != null ? DateTime.fromMillisecondsSinceEpoch(ms) : null;
  }

  /// Return the byte count cached during the last completed download run.
  ///
  /// Used by the Settings screen to display "Cache size: X MB".
  static Future<int> cachedStorageBytes() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(prefTotalBytes) ?? 0;
  }

  /// Reset the storage counter and last-sync timestamp.
  ///
  /// Called from the "Clear cache" action in Settings so the next download
  /// starts fresh without the cap guard blocking it.
  static Future<void> clearStorageCounter() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(prefTotalBytes);
    await prefs.remove(prefLastSyncMs);
  }
}
