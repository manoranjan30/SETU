import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';
import 'package:setu_mobile/core/network/network_info.dart';
import 'package:setu_mobile/core/sync/background_download_service.dart';
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
/// **Two-level connectivity:**
///   - [isOnline] reflects the network interface status (from connectivity_plus).
///     This is the fast path used for badges and UI indicators.
///   - [isServerReachable] additionally probes the backend server (3 s HEAD
///     request via ServerProbe).  Only when the server is actually reachable
///     should the app attempt live API calls — devices on construction floors
///     often show "connected" but cannot reach the server.
///
/// **Cache-invalidation on reconnect:**
///   [onReconnected] is a broadcast stream that fires once per offline→online
///   transition (only after the server probe confirms reachability).  BLoCs
///   subscribe to this stream and add a "refresh" event to themselves so the
///   UI always shows fresh server data rather than carrying stale cached data.
///
/// [ChangeNotifier] is used so the UI layer can call
/// `context.watch<ConnectivitySyncService>()` and rebuild automatically.
class ConnectivitySyncService extends ChangeNotifier {
  final NetworkInfo _networkInfo;
  final SyncService _syncService;
  final BackgroundDownloadService _backgroundDownloadService;
  final Logger _logger = Logger();

  StreamSubscription<bool>? _connectivitySubscription;

  /// Periodic timer that retries pending sync items every 5 minutes when online.
  Timer? _retryTimer;

  bool _isOnline = true;
  bool _isSyncing = false;
  int _pendingCount = 0;
  int _errorCount = 0;
  String? _lastError;

  /// Broadcast stream that fires each time the device transitions from
  /// offline → online AND the SETU server is confirmed reachable.
  ///
  /// BLoCs should subscribe to this in their constructor and dispatch a
  /// refresh event so users always see fresh data after reconnection instead
  /// of carrying over stale cached data from when they were offline.
  ///
  /// Example in a BLoC:
  /// ```dart
  /// _connectivitySyncService.onReconnected.listen((_) {
  ///   add(RefreshCurrentNode()); // or LoadProjects(), etc.
  /// });
  /// ```
  final StreamController<void> _reconnectedCtrl =
      StreamController<void>.broadcast();
  Stream<void> get onReconnected => _reconnectedCtrl.stream;

  bool get isOnline => _isOnline;
  bool get isSyncing => _isSyncing;
  int get pendingCount => _pendingCount;
  int get errorCount => _errorCount;
  String? get lastError => _lastError;

  SyncStatusInfo get syncStatus {
    if (!_isOnline) return SyncStatusInfo.offline();
    if (_isSyncing) return SyncStatusInfo.syncing();
    if (_errorCount > 0) return SyncStatusInfo.error(_lastError ?? 'Sync errors');
    if (_pendingCount > 0) return SyncStatusInfo.partial(_pendingCount);
    return SyncStatusInfo.synced();
  }

  ConnectivitySyncService({
    required NetworkInfo networkInfo,
    required SyncService syncService,
    required BackgroundDownloadService backgroundDownloadService,
  })  : _networkInfo = networkInfo,
        _syncService = syncService,
        _backgroundDownloadService = backgroundDownloadService {
    _initialize();
  }

  Future<void> _initialize() async {
    // Use server reachability (not just interface) for the initial state.
    // This prevents the app from showing "online" on startup when the device
    // has WiFi/4G but the server is not reachable.
    _isOnline = await _networkInfo.isServerReachable;
    _pendingCount = await _syncService.getPendingSyncCount();
    _errorCount = await _syncService.getErrorSyncCount();
    notifyListeners();

    // Listen to interface-level connectivity changes.  We use the raw
    // interface stream here (not the server probe) so the UI responds
    // instantly when the WiFi/4G icon disappears.  The server probe is used
    // in [_onConnectivityChanged] only when transitioning to "connected" to
    // decide whether to fire [onReconnected] and sync.
    _connectivitySubscription = _networkInfo.onConnectionStatusChanged.listen(
      _onConnectivityChanged,
    );

    _syncService.onStatusChanged = (status) => _onSyncStatusChanged(status);

    // Periodic retry every 5 minutes — catches items that were queued while
    // the app was already online between auto-sync cycles. Also handles the
    // case where the server became reachable without a connectivity event
    // (e.g. backend started while device already had a network interface).
    _retryTimer = Timer.periodic(const Duration(minutes: 5), (_) async {
      if (_isSyncing || _pendingCount == 0) return;
      if (!_isOnline) {
        // Re-probe silently — server may have come back without interface change.
        _networkInfo.invalidateProbe();
        final reachable = await _networkInfo.isServerReachable;
        if (!reachable) return;
        _isOnline = true;
        notifyListeners();
      }
      _logger.i('Periodic retry: syncing $_pendingCount pending items…');
      syncNow();
    });

    _logger.i(
        'ConnectivitySyncService initialized. Online: $_isOnline, Pending: $_pendingCount');
  }

  /// Handle connectivity changes from the platform stream.
  ///
  /// When transitioning to "connected" the server is probed first:
  ///   - If the server is reachable: fire [onReconnected] (so BLoCs refresh
  ///     their cached data with fresh server data) and run any pending sync.
  ///   - If the server is still unreachable (weak signal, server down): stay
  ///     in the offline-indicator state without spamming API calls.
  Future<void> _onConnectivityChanged(bool interfaceConnected) async {
    final wasOffline = !_isOnline;

    if (!interfaceConnected) {
      // Interface dropped — immediately mark offline without probing.
      _isOnline = false;
      _logger.i('Connectivity: interface lost → offline');
      notifyListeners();
      return;
    }

    // Interface says "connected" — probe the server before trusting it.
    // Invalidate the cached probe result first so we get a fresh reading
    // that reflects the new network interface state.
    _networkInfo.invalidateProbe();
    final serverReachable = await _networkInfo.isServerReachable;
    _isOnline = serverReachable;

    _logger.i(
        'Connectivity: interface connected, server reachable: $serverReachable');

    // Notify the UI about the connectivity state immediately.
    notifyListeners();

    if (wasOffline && serverReachable) {
      // True offline → online transition confirmed by server probe.
      _logger.i('Connection restored (server confirmed). Triggering actions…');

      // 1. Sync any pending mutations up to the server.
      if (_pendingCount > 0) {
        _logger.i('Auto-syncing $_pendingCount pending items…');
        await syncNow();
      }

      // 2. Pre-cache fresh server data for offline use (EPS tree, project list,
      //    etc.) so the next time the device goes offline the data is not stale.
      //    Use downloadIfStale (1 h threshold) — avoids hammering the server on
      //    every brief network blip while still refreshing after a long outage.
      _backgroundDownloadService.downloadIfStale().catchError(
        (e) => _logger.w('Background pre-cache failed on reconnect: $e'),
      );

      // 3. Fire onReconnected so BLoCs refresh their READ caches.
      //    This ensures users never carry stale cached data — every screen
      //    re-fetches fresh data from the server after coming back online.
      if (!_reconnectedCtrl.isClosed) {
        _reconnectedCtrl.add(null);
      }
    }
  }

  void _onSyncStatusChanged(SyncStatusInfo status) {
    _isSyncing = status.isSyncing;
    if (status.hasError) {
      _lastError = status.errorMessage;
    } else if (status.isSynced) {
      _lastError = null;
    }
    _refreshCounts();
  }

  /// Manually trigger sync.
  ///
  /// Uses [isServerReachable] rather than just [isOnline] so we do not
  /// waste time attempting network calls when the interface says "connected"
  /// but the server is actually unreachable (common on construction floors).
  Future<SyncResult> syncNow() async {
    if (_isSyncing) {
      _logger.w('Sync already in progress');
      final result = SyncResult();
      result.error = 'Sync already in progress';
      return result;
    }

    // Two-level check: interface first (fast), then server probe (accurate).
    if (!_isOnline) {
      // Don't give up immediately — the interface state can be stale. The
      // server may have become reachable without a connectivity event firing
      // (e.g. the backend was just started while the device already had 4G).
      // Re-probe before aborting so the Sync Now button is always responsive.
      _networkInfo.invalidateProbe();
      final nowReachable = await _networkInfo.isServerReachable;
      if (!nowReachable) {
        _logger.w('Cannot sync: offline (interface + server probe)');
        final result = SyncResult();
        result.error = 'No internet connection';
        return result;
      }
      // Server is reachable — silently correct the stale _isOnline flag.
      _isOnline = true;
      notifyListeners();
    }

    // Probe the server before starting a sync cycle to avoid the case where
    // isOnline is stale (interface reconnected but server still unreachable).
    final reachable = await _networkInfo.isServerReachable;
    if (!reachable) {
      // Do NOT set _isOnline = false here — the connectivity stream owns that
      // state. A transient server-probe failure during sync should not flip the
      // UI banner to "Offline" when the device still has a network interface.
      _logger.w('Cannot sync: server unreachable (probe)');
      final result = SyncResult();
      result.error = 'Server unreachable';
      return result;
    }

    _isSyncing = true;
    notifyListeners();

    try {
      final result = await _syncService.syncAll();

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
      _isSyncing = false;
      notifyListeners();
    }
  }

  Future<void> retryFailed() async {
    if (!_isOnline) {
      _logger.w('Cannot retry: offline');
      return;
    }
    await _syncService.retryFailed();
    await _refreshCounts();
  }

  Future<void> _refreshCounts() async {
    _pendingCount = await _syncService.getPendingSyncCount();
    _errorCount = await _syncService.getErrorSyncCount();
    notifyListeners();
  }

  /// Called when a new progress entry is saved locally.
  void onProgressSaved() {
    _pendingCount++;
    notifyListeners();
    if (_isOnline && !_isSyncing) {
      syncNow();
    }
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _retryTimer?.cancel();
    if (!_reconnectedCtrl.isClosed) _reconnectedCtrl.close();
    super.dispose();
  }
}
