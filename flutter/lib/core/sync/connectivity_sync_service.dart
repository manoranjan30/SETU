import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';
import 'package:setu_mobile/core/network/network_info.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';

/// Connectivity-triggered auto-sync service
///
/// This service monitors network connectivity and automatically triggers
/// sync when the device comes back online. It implements the "Break-Proof"
/// offline-first strategy as per the requirements.
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

  StreamSubscription<bool>? _connectivitySubscription;

  bool _isOnline = true;
  bool _isSyncing = false;
  int _pendingCount = 0;
  int _errorCount = 0;
  String? _lastError;

  /// Current online status
  bool get isOnline => _isOnline;

  /// Whether sync is currently in progress
  bool get isSyncing => _isSyncing;

  /// Number of pending items to sync
  int get pendingCount => _pendingCount;

  /// Number of items with sync errors
  int get errorCount => _errorCount;

  /// Last sync error message
  String? get lastError => _lastError;

  /// Current sync status for UI display
  SyncStatusInfo get syncStatus {
    if (!_isOnline) {
      return SyncStatusInfo.offline();
    }
    if (_isSyncing) {
      return SyncStatusInfo.syncing();
    }
    if (_errorCount > 0) {
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
    _initialize();
  }

  Future<void> _initialize() async {
    // Check initial connectivity
    _isOnline = await _networkInfo.isConnected;
    _pendingCount = await _syncService.getPendingSyncCount();
    _errorCount = await _syncService.getErrorSyncCount();
    notifyListeners();

    // Listen for connectivity changes
    _connectivitySubscription = _networkInfo.onConnectionStatusChanged.listen(
      _onConnectivityChanged,
    );

    // Listen for sync service status changes
    _syncService.onStatusChanged = (status) => _onSyncStatusChanged(status);

    _logger.i(
        'ConnectivitySyncService initialized. Online: $_isOnline, Pending: $_pendingCount');
  }

  /// Handle connectivity changes
  Future<void> _onConnectivityChanged(bool isConnected) async {
    final wasOffline = !_isOnline;
    _isOnline = isConnected;

    _logger.i(
        'Connectivity changed. Online: $isConnected, Was offline: $wasOffline');

    notifyListeners();

    // If we just came back online and have pending items, trigger sync
    if (wasOffline && isConnected && _pendingCount > 0) {
      _logger.i(
          'Connection restored. Auto-syncing $_pendingCount pending items...');
      await syncNow();
    }
  }

  /// Handle sync status changes from SyncService
  void _onSyncStatusChanged(SyncStatusInfo status) {
    _isSyncing = status.isSyncing;

    if (status.hasError) {
      _lastError = status.errorMessage;
    } else if (status.isSynced) {
      _lastError = null;
    }

    _refreshCounts();
  }

  /// Manually trigger sync
  Future<SyncResult> syncNow() async {
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
    notifyListeners();

    try {
      final result = await _syncService.syncAll();

      // Update counts after sync
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

  /// Retry failed syncs
  Future<void> retryFailed() async {
    if (!_isOnline) {
      _logger.w('Cannot retry: offline');
      return;
    }

    await _syncService.retryFailed();
    await _refreshCounts();
  }

  /// Refresh pending and error counts
  Future<void> _refreshCounts() async {
    _pendingCount = await _syncService.getPendingSyncCount();
    _errorCount = await _syncService.getErrorSyncCount();
    notifyListeners();
  }

  /// Called when a new progress entry is saved locally
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
    _connectivitySubscription?.cancel();
    super.dispose();
  }
}
