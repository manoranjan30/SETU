import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';
import 'package:setu_mobile/core/network/network_info.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';

/// Connectivity-triggered auto-sync service.
///
/// This service monitors network connectivity and automatically triggers
/// sync when the device comes back online. It implements the "Break-Proof"
/// offline-first strategy as per the requirements.
///
/// It sits between [SyncService] (which knows nothing about the network) and
/// the UI (which must not drive sync directly). The pattern is:
///   NetworkInfo → ConnectivitySyncService → SyncService → AppDatabase + API
///
/// [ChangeNotifier] is used rather than streams so that the UI layer can
/// simply call `context.watch<ConnectivitySyncService>()` and rebuild
/// automatically when any of the observable properties change.
///
/// Features:
/// - Monitors connectivity changes
/// - Auto-syncs when connection is restored
/// - Notifies UI of sync status changes
/// - Handles sync failures gracefully
class ConnectivitySyncService extends ChangeNotifier {
  final NetworkInfo _networkInfo;
  final SyncService _syncService;
  final Logger _logger = Logger();

  /// Holds the connectivity subscription so it can be cancelled on [dispose].
  StreamSubscription<bool>? _connectivitySubscription;

  bool _isOnline = true;
  bool _isSyncing = false;
  int _pendingCount = 0;
  int _errorCount = 0;
  String? _lastError;

  /// Current online status.
  bool get isOnline => _isOnline;

  /// Whether sync is currently in progress.
  bool get isSyncing => _isSyncing;

  /// Number of pending items to sync.
  ///
  /// Shown in the UI as a badge to inform the user how much local data is
  /// waiting to reach the server.
  int get pendingCount => _pendingCount;

  /// Number of items with sync errors (permanent failures requiring attention).
  int get errorCount => _errorCount;

  /// Last sync error message, if any.
  String? get lastError => _lastError;

  /// Computed sync status for UI display.
  ///
  /// Derived from the combination of [_isOnline], [_isSyncing], [_errorCount],
  /// and [_pendingCount]. The priority order here matters: offline takes
  /// precedence over all other states because nothing else is meaningful when
  /// there is no network.
  SyncStatusInfo get syncStatus {
    if (!_isOnline) {
      return SyncStatusInfo.offline();
    }
    if (_isSyncing) {
      return SyncStatusInfo.syncing();
    }
    if (_errorCount > 0) {
      // Prefer the last known error message, or a generic fallback.
      return SyncStatusInfo.error(_lastError ?? 'Sync errors');
    }
    if (_pendingCount > 0) {
      return SyncStatusInfo.partial(_pendingCount);
    }
    return SyncStatusInfo.synced();
  }

  ConnectivitySyncService({
    required NetworkInfo networkInfo,
    required SyncService syncService,
  })  : _networkInfo = networkInfo,
        _syncService = syncService {
    // Kick off async initialization immediately after construction so the
    // service is ready by the time the first widget tree is built.
    _initialize();
  }

  /// Bootstrap the service: check current connectivity, seed counts, and
  /// attach listeners.
  Future<void> _initialize() async {
    // Check initial connectivity
    _isOnline = await _networkInfo.isConnected;
    // Seed the pending/error counts from the database so the UI has accurate
    // badge counts immediately on app launch, before the first sync attempt.
    _pendingCount = await _syncService.getPendingSyncCount();
    _errorCount = await _syncService.getErrorSyncCount();
    notifyListeners();

    // Listen for connectivity changes — the stream emits `true` when the
    // device goes online and `false` when it goes offline.
    _connectivitySubscription = _networkInfo.onConnectionStatusChanged.listen(
      _onConnectivityChanged,
    );

    // Wire up the SyncService callback so state changes inside SyncService
    // are reflected here without SyncService needing a reference back to this
    // class (avoids a circular dependency).
    _syncService.onStatusChanged = (status) => _onSyncStatusChanged(status);

    _logger.i(
        'ConnectivitySyncService initialized. Online: $_isOnline, Pending: $_pendingCount');
  }

  /// Handle connectivity changes.
  ///
  /// The key decision here is: only auto-sync when transitioning from offline
  /// → online (not on every online event) AND only when there are pending
  /// items. This avoids unnecessary network traffic when the device simply
  /// switches between WiFi networks while already online.
  Future<void> _onConnectivityChanged(bool isConnected) async {
    final wasOffline = !_isOnline;
    _isOnline = isConnected;

    _logger.i(
        'Connectivity changed. Online: $isConnected, Was offline: $wasOffline');

    // Notify UI immediately so the offline/online banner updates before the
    // sync completes.
    notifyListeners();

    // Only trigger auto-sync on the offline → online transition and only when
    // there is actually something to send (avoids a no-op sync on every
    // network re-attach, e.g. when switching WiFi networks).
    if (wasOffline && isConnected && _pendingCount > 0) {
      _logger.i(
          'Connection restored. Auto-syncing $_pendingCount pending items...');
      await syncNow();
    }
  }

  /// Handle sync status changes from SyncService.
  ///
  /// Called via the [SyncService.onStatusChanged] callback rather than a
  /// stream to avoid introducing a StreamController inside SyncService, which
  /// is intentionally kept non-Flutter.
  void _onSyncStatusChanged(SyncStatusInfo status) {
    _isSyncing = status.isSyncing;

    if (status.hasError) {
      _lastError = status.errorMessage;
    } else if (status.isSynced) {
      // Clear the last error once a successful sync completes so stale errors
      // don't persist in the UI after recovery.
      _lastError = null;
    }

    // Re-query actual counts rather than deriving them from the status object,
    // because [SyncStatusInfo.pendingCount] may be stale if items were added
    // to the queue during the sync cycle.
    _refreshCounts();
  }

  /// Manually trigger sync.
  ///
  /// Guards against double-triggering and offline attempts, returning an
  /// appropriate error [SyncResult] rather than throwing — the caller decides
  /// whether to surface the error to the user.
  Future<SyncResult> syncNow() async {
    // Guard: do not stack multiple concurrent sync cycles.
    if (_isSyncing) {
      _logger.w('Sync already in progress');
      final result = SyncResult();
      result.error = 'Sync already in progress';
      return result;
    }

    if (!_isOnline) {
      _logger.w('Cannot sync: offline');
      final result = SyncResult();
      result.error = 'No internet connection';
      return result;
    }

    _isSyncing = true;
    // Notify UI immediately so the sync spinner appears before the first
    // network call is made.
    notifyListeners();

    try {
      final result = await _syncService.syncAll();

      // Re-query counts after sync so the badge reflects the true DB state
      // (some items may have moved from pending → synced, others may have
      // entered a failed state).
      _pendingCount = await _syncService.getPendingSyncCount();
      _errorCount = await _syncService.getErrorSyncCount();

      if (result.hasFailures) {
        _lastError = '${result.totalFailed} items failed to sync';
      } else {
        _lastError = null;
      }

      _logger.i(
          'Sync completed. Synced: ${result.totalSynced}, Failed: ${result.totalFailed}');

      return result;
    } catch (e) {
      _lastError = e.toString();
      _logger.e('Sync failed', error: e);
      final result = SyncResult();
      result.error = e.toString();
      return result;
    } finally {
      // Always clear the syncing flag, even if an exception was thrown, so
      // the UI spinner does not get stuck in the syncing state.
      _isSyncing = false;
      notifyListeners();
    }
  }

  /// Retry failed syncs.
  ///
  /// Delegates to [SyncService.retryFailed] which resets failed rows to
  /// pending and triggers a new sync cycle. Does not retry permanent errors
  /// ([SyncStatus.error]) — those require the user to edit or delete the item.
  Future<void> retryFailed() async {
    if (!_isOnline) {
      _logger.w('Cannot retry: offline');
      return;
    }

    await _syncService.retryFailed();
    // Refresh counts after the retry so the badge is accurate.
    await _refreshCounts();
  }

  /// Refresh pending and error counts from the database.
  ///
  /// Called after any operation that may have changed queue depth:
  /// sync completion, error resolution, or a new item being added.
  /// [notifyListeners] is called at the end so the UI rebuilds once rather
  /// than on each individual count update.
  Future<void> _refreshCounts() async {
    _pendingCount = await _syncService.getPendingSyncCount();
    _errorCount = await _syncService.getErrorSyncCount();
    notifyListeners();
  }

  /// Called when a new progress entry is saved locally.
  ///
  /// Optimistically increments [_pendingCount] before the DB write completes
  /// so the UI badge updates immediately. If the device is already online and
  /// no sync is in progress, triggers a sync right away rather than waiting
  /// for the next periodic sync cycle — this gives a "near real-time" feel
  /// when the user is connected.
  void onProgressSaved() {
    _pendingCount++;
    notifyListeners();

    // If online, trigger sync
    if (_isOnline && !_isSyncing) {
      syncNow();
    }
  }

  @override
  void dispose() {
    // Cancel the connectivity stream subscription to avoid memory leaks and
    // callbacks arriving after the service has been disposed.
    _connectivitySubscription?.cancel();
    super.dispose();
  }
}
