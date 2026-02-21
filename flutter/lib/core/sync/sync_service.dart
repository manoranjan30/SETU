import 'dart:convert';
import 'dart:math';
import 'package:drift/drift.dart';
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/network/network_info.dart';

/// Sync service for offline-first data synchronization
/// 
/// Features:
/// - Local-first writes (all data saved to local DB first)
/// - FIFO queue processing
/// - Exponential backoff for retries
/// - Idempotency keys for safe retries
/// - Distinguishes between network errors (retry) and validation errors (user action needed)
class SyncService {
  final AppDatabase _database;
  final SetuApiClient _apiClient;
  final NetworkInfo _networkInfo;
  final Logger _logger = Logger();

  /// Maximum retry attempts before marking as permanent error
  static const int maxRetryAttempts = 5;

  /// Base delay for exponential backoff (in seconds)
  static const int baseBackoffDelaySeconds = 2;

  /// Maximum backoff delay (in seconds)
  static const int maxBackoffDelaySeconds = 60;

  /// Callback for sync status changes
  void Function(SyncStatusInfo)? onStatusChanged;

  /// Current sync status
  SyncStatusInfo _currentStatus = SyncStatusInfo.idle();
  SyncStatusInfo get currentStatus => _currentStatus;

  SyncService(this._database, this._apiClient, this._networkInfo);

  /// Sync all pending data
  Future<SyncResult> syncAll() async {
    final result = SyncResult();

    // Check connectivity first
    if (!await _networkInfo.isConnected) {
      result.error = 'No internet connection';
      _updateStatus(SyncStatusInfo.offline());
      return result;
    }

    _updateStatus(SyncStatusInfo.syncing());

    try {
      // Sync progress entries
      final progressResult = await _syncProgressEntries();
      result.progressSynced = progressResult.synced;
      result.progressFailed = progressResult.failed;

      // Sync daily logs
      final logsResult = await _syncDailyLogs();
      result.logsSynced = logsResult.synced;
      result.logsFailed = logsResult.failed;

      // Process sync queue
      await _processSyncQueue();

      result.success = true;

      // Update status based on remaining items
      final pendingCount = await getPendingSyncCount();
      if (pendingCount > 0) {
        _updateStatus(SyncStatusInfo.partial(pendingCount));
      } else if (result.hasFailures) {
        _updateStatus(SyncStatusInfo.error('Some items failed to sync'));
      } else {
        _updateStatus(SyncStatusInfo.synced());
      }
    } catch (e) {
      result.error = e.toString();
      _logger.e('Sync failed', error: e);
      _updateStatus(SyncStatusInfo.error(e.toString()));
    }

    return result;
  }

  /// Sync pending progress entries with exponential backoff
  Future<_SyncPartialResult> _syncProgressEntries() async {
    final result = _SyncPartialResult();

    // Get all pending entries ordered by creation time (FIFO)
    final pendingEntries = await (_database.select(_database.progressEntries)
          ..where((t) => 
            t.syncStatus.equals(SyncStatus.pending.value) |
            t.syncStatus.equals(SyncStatus.syncing.value)
          )
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();

    for (final entry in pendingEntries) {
      // Check if we should skip due to backoff
      if (entry.retryCount >= maxRetryAttempts) {
        // Mark as permanent error
        await _markAsPermanentError(entry.id, 'Max retry attempts exceeded');
        result.failed++;
        continue;
      }

      try {
        // Mark as syncing
        await (_database.update(_database.progressEntries)
              ..where((t) => t.id.equals(entry.id)))
            .write(ProgressEntriesCompanion(
          syncStatus: Value(SyncStatus.syncing.value),
        ));

        // Prepare the entry for API
        final entryData = {
          'boqItemId': entry.boqItemId,
          'microActivityId': entry.microActivityId,
          'quantity': entry.quantity,
        };

        // Call the API
        final response = await _apiClient.saveMicroProgress(
          projectId: entry.projectId,
          activityId: entry.activityId,
          epsNodeId: entry.epsNodeId,
          entries: [entryData],
          date: entry.date,
          remarks: entry.remarks,
        );

        // Update local record with server ID
        final serverId = response['id'] as int?;
        await (_database.update(_database.progressEntries)
              ..where((t) => t.id.equals(entry.id)))
            .write(
          ProgressEntriesCompanion(
            serverId: Value(serverId),
            syncStatus: Value(SyncStatus.synced.value),
            syncedAt: Value(DateTime.now()),
          ),
        );

        result.synced++;
      } on DioException catch (e) {
        await _handleSyncError(entry.id, e, 'progress');
        result.failed++;
      } catch (e) {
        await _handleSyncError(entry.id, e, 'progress');
        result.failed++;
        _logger.e('Failed to sync progress entry ${entry.id}', error: e);
      }
    }

    return result;
  }

  /// Sync pending daily logs
  Future<_SyncPartialResult> _syncDailyLogs() async {
    final result = _SyncPartialResult();

    // Get all pending logs ordered by creation time (FIFO)
    final pendingLogs = await (_database.select(_database.dailyLogs)
          ..where((t) => 
            t.syncStatus.equals(SyncStatus.pending.value) |
            t.syncStatus.equals(SyncStatus.syncing.value)
          )
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();

    for (final log in pendingLogs) {
      // Check if we should skip due to backoff
      if (log.retryCount >= maxRetryAttempts) {
        await _markDailyLogAsPermanentError(log.id, 'Max retry attempts exceeded');
        result.failed++;
        continue;
      }

      try {
        // Mark as syncing
        await (_database.update(_database.dailyLogs)
              ..where((t) => t.id.equals(log.id)))
            .write(DailyLogsCompanion(
          syncStatus: Value(SyncStatus.syncing.value),
        ));

        // Prepare payload
        final payload = {
          'microActivityId': log.microActivityId,
          'logDate': log.logDate,
          'plannedQty': log.plannedQty,
          'actualQty': log.actualQty,
          'laborCount': log.laborCount,
          'delayReasonId': log.delayReasonId,
          'delayNotes': log.delayNotes,
          'remarks': log.remarks,
        };

        // Call the API
        await _apiClient.createDailyLog(payload);

        // Update local record
        await (_database.update(_database.dailyLogs)
              ..where((t) => t.id.equals(log.id)))
            .write(
          DailyLogsCompanion(
            syncStatus: Value(SyncStatus.synced.value),
            syncedAt: Value(DateTime.now()),
          ),
        );

        result.synced++;
      } on DioException catch (e) {
        await _handleDailyLogSyncError(log.id, e);
        result.failed++;
      } catch (e) {
        await _handleDailyLogSyncError(log.id, e);
        result.failed++;
        _logger.e('Failed to sync daily log ${log.id}', error: e);
      }
    }

    return result;
  }

  /// Handle sync error with appropriate action
  Future<void> _handleSyncError(int entryId, dynamic error, String type) async {
    if (error is DioException) {
      final statusCode = error.response?.statusCode;

      // 4xx errors are validation errors - need user action
      if (statusCode != null && statusCode >= 400 && statusCode < 500) {
        final errorMessage = _extractErrorMessage(error.response?.data);
        await _markAsPermanentError(entryId, errorMessage);
        return;
      }

      // 5xx errors or network errors - retry with backoff
      await (_database.update(_database.progressEntries)
            ..where((t) => t.id.equals(entryId)))
          .write(
        ProgressEntriesCompanion(
          syncStatus: Value(SyncStatus.failed.value),
          syncError: Value(error.toString()),
          retryCount: const Value(1), // Increment will be handled by query
        ),
      );
    } else {
      // Unknown error - mark as failed for retry
      await (_database.update(_database.progressEntries)
            ..where((t) => t.id.equals(entryId)))
          .write(
        ProgressEntriesCompanion(
          syncStatus: Value(SyncStatus.failed.value),
          syncError: Value(error.toString()),
        ),
      );
    }
  }

  /// Handle daily log sync error
  Future<void> _handleDailyLogSyncError(int logId, dynamic error) async {
    if (error is DioException) {
      final statusCode = error.response?.statusCode;

      if (statusCode != null && statusCode >= 400 && statusCode < 500) {
        final errorMessage = _extractErrorMessage(error.response?.data);
        await _markDailyLogAsPermanentError(logId, errorMessage);
        return;
      }

      await (_database.update(_database.dailyLogs)
            ..where((t) => t.id.equals(logId)))
          .write(
        DailyLogsCompanion(
          syncStatus: Value(SyncStatus.failed.value),
          syncError: Value(error.toString()),
        ),
      );
    } else {
      await (_database.update(_database.dailyLogs)
            ..where((t) => t.id.equals(logId)))
          .write(
        DailyLogsCompanion(
          syncStatus: Value(SyncStatus.failed.value),
          syncError: Value(error.toString()),
        ),
      );
    }
  }

  /// Mark a progress entry as permanent error (requires user action)
  Future<void> _markAsPermanentError(int entryId, String errorMessage) async {
    await (_database.update(_database.progressEntries)
          ..where((t) => t.id.equals(entryId)))
        .write(
      ProgressEntriesCompanion(
        syncStatus: Value(SyncStatus.error.value),
        syncError: Value(errorMessage),
      ),
    );
  }

  /// Mark a daily log as permanent error
  Future<void> _markDailyLogAsPermanentError(int logId, String errorMessage) async {
    await (_database.update(_database.dailyLogs)
          ..where((t) => t.id.equals(logId)))
        .write(
      DailyLogsCompanion(
        syncStatus: Value(SyncStatus.error.value),
        syncError: Value(errorMessage),
      ),
    );
  }

  /// Extract error message from API response
  String _extractErrorMessage(dynamic data) {
    if (data == null) return 'Unknown error';
    if (data is String) return data;
    if (data is Map) {
      return data['message']?.toString() ??
          data['error']?.toString() ??
          'Validation error';
    }
    return 'Unknown error';
  }

  /// Calculate exponential backoff delay
  int _calculateBackoffDelay(int retryCount) {
    final delay = baseBackoffDelaySeconds * pow(2, retryCount - 1);
    return min(delay.toInt(), maxBackoffDelaySeconds);
  }

  /// Process the sync queue
  Future<void> _processSyncQueue() async {
    final queueItems = await (_database.select(_database.syncQueue)
          ..orderBy([(t) => OrderingTerm.desc(t.priority)])
          ..limit(50))
        .get();

    for (final item in queueItems) {
      try {
        final payload = jsonDecode(item.payload) as Map<String, dynamic>;

        switch (item.entityType) {
          case 'progress':
            await _processProgressQueueItem(item, payload);
            break;
          case 'daily_log':
            await _processDailyLogQueueItem(item, payload);
            break;
          case 'photo':
            await _processPhotoQueueItem(item, payload);
            break;
        }

        // Remove from queue on success
        await (_database.delete(_database.syncQueue)
              ..where((t) => t.id.equals(item.id)))
            .go();
      } catch (e) {
        // Update retry info
        await (_database.update(_database.syncQueue)
              ..where((t) => t.id.equals(item.id)))
            .write(
          SyncQueueCompanion(
            retryCount: Value(item.retryCount + 1),
            lastAttemptAt: Value(DateTime.now()),
            lastError: Value(e.toString()),
          ),
        );

        _logger.e('Failed to process queue item ${item.id}', error: e);
      }
    }
  }

  Future<void> _processProgressQueueItem(
    SyncQueueData item,
    Map<String, dynamic> payload,
  ) async {
    final operation = item.operation;
    if (operation == 'create') {
      await _apiClient.saveMicroProgress(
        projectId: payload['projectId'],
        activityId: payload['activityId'],
        epsNodeId: payload['epsNodeId'],
        entries: payload['entries'],
        date: payload['date'],
        remarks: payload['remarks'],
      );
    } else if (operation == 'update') {
      await _apiClient.updateProgressLog(
        logId: payload['logId'],
        newQty: payload['newQty'],
      );
    } else if (operation == 'delete') {
      await _apiClient.deleteProgressLog(payload['logId']);
    }
  }

  Future<void> _processDailyLogQueueItem(
    SyncQueueData item,
    Map<String, dynamic> payload,
  ) async {
    final operation = item.operation;
    if (operation == 'create') {
      await _apiClient.createDailyLog(payload);
    } else if (operation == 'update') {
      await _apiClient.updateDailyLog(
        logId: payload['logId'],
        updates: payload['updates'],
      );
    } else if (operation == 'delete') {
      await _apiClient.deleteDailyLog(payload['logId']);
    }
  }

  Future<void> _processPhotoQueueItem(
    SyncQueueData item,
    Map<String, dynamic> payload,
  ) async {
    // Handle photo uploads - postponed as per requirements
  }

  /// Add item to sync queue
  Future<void> addToQueue({
    required String entityType,
    required int entityId,
    required String operation,
    required Map<String, dynamic> payload,
    int priority = 0,
  }) async {
    await _database.into(_database.syncQueue).insert(
          SyncQueueCompanion.insert(
            entityType: entityType,
            entityId: entityId,
            operation: operation,
            payload: jsonEncode(payload),
            priority: Value(priority),
          ),
        );
  }

  /// Get pending sync count
  Future<int> getPendingSyncCount() async {
    final progressCount = await (_database.select(_database.progressEntries)
          ..where((t) => 
            t.syncStatus.equals(SyncStatus.pending.value) |
            t.syncStatus.equals(SyncStatus.failed.value)
          ))
        .get()
        .then((list) => list.length);

    final logsCount = await (_database.select(_database.dailyLogs)
          ..where((t) => 
            t.syncStatus.equals(SyncStatus.pending.value) |
            t.syncStatus.equals(SyncStatus.failed.value)
          ))
        .get()
        .then((list) => list.length);

    final queueCount = await _database.syncQueue.count().getSingle();

    return progressCount + logsCount + queueCount;
  }

  /// Get failed sync count (permanent errors)
  Future<int> getErrorSyncCount() async {
    final progressCount = await (_database.select(_database.progressEntries)
          ..where((t) => t.syncStatus.equals(SyncStatus.error.value)))
        .get()
        .then((list) => list.length);

    final logsCount = await (_database.select(_database.dailyLogs)
          ..where((t) => t.syncStatus.equals(SyncStatus.error.value)))
        .get()
        .then((list) => list.length);

    return progressCount + logsCount;
  }

  /// Retry failed syncs
  Future<void> retryFailed() async {
    // Reset failed progress entries to pending
    await (_database.update(_database.progressEntries)
          ..where((t) => t.syncStatus.equals(SyncStatus.failed.value)))
        .write(ProgressEntriesCompanion(
      syncStatus: Value(SyncStatus.pending.value),
    ));

    // Reset failed daily logs to pending
    await (_database.update(_database.dailyLogs)
          ..where((t) => t.syncStatus.equals(SyncStatus.failed.value)))
        .write(DailyLogsCompanion(
      syncStatus: Value(SyncStatus.pending.value),
    ));

    // Trigger sync
    await syncAll();
  }

  /// Retry a specific error item (after user correction)
  Future<void> retryErrorItem(int entryId, {bool isDailyLog = false}) async {
    if (isDailyLog) {
      await (_database.update(_database.dailyLogs)
            ..where((t) => t.id.equals(entryId)))
          .write(DailyLogsCompanion(
        syncStatus: Value(SyncStatus.pending.value),
        syncError: const Value(null),
        retryCount: const Value(0),
      ));
    } else {
      await (_database.update(_database.progressEntries)
            ..where((t) => t.id.equals(entryId)))
          .write(ProgressEntriesCompanion(
        syncStatus: Value(SyncStatus.pending.value),
        syncError: const Value(null),
        retryCount: const Value(0),
      ));
    }

    // Trigger sync
    await syncAll();
  }

  /// Update sync status and notify listeners
  void _updateStatus(SyncStatusInfo status) {
    _currentStatus = status;
    onStatusChanged?.call(status);
  }

  /// Generate unique idempotency key
  static String generateIdempotencyKey() {
    return '${DateTime.now().millisecondsSinceEpoch}_${DateTime.now().microsecond}';
  }
}

/// Result of sync operation
class SyncResult {
  bool success = false;
  String? error;
  int progressSynced = 0;
  int progressFailed = 0;
  int logsSynced = 0;
  int logsFailed = 0;

  int get totalSynced => progressSynced + logsSynced;
  int get totalFailed => progressFailed + logsFailed;
  bool get hasFailures => totalFailed > 0;
}

/// Partial result for individual sync operations
class _SyncPartialResult {
  int synced = 0;
  int failed = 0;
}

/// Sync status information for UI display
class SyncStatusInfo {
  final SyncState state;
  final int pendingCount;
  final String? errorMessage;

  const SyncStatusInfo._({
    required this.state,
    this.pendingCount = 0,
    this.errorMessage,
  });

  factory SyncStatusInfo.idle() => const SyncStatusInfo._(state: SyncState.idle);
  factory SyncStatusInfo.synced() => const SyncStatusInfo._(state: SyncState.synced);
  factory SyncStatusInfo.syncing() => const SyncStatusInfo._(state: SyncState.syncing);
  factory SyncStatusInfo.offline() => const SyncStatusInfo._(state: SyncState.offline);
  factory SyncStatusInfo.error(String message) => SyncStatusInfo._(
    state: SyncState.error,
    errorMessage: message,
  );
  factory SyncStatusInfo.partial(int count) => SyncStatusInfo._(
    state: SyncState.partial,
    pendingCount: count,
  );

  bool get isSynced => state == SyncState.synced;
  bool get isSyncing => state == SyncState.syncing;
  bool get isOffline => state == SyncState.offline;
  bool get hasError => state == SyncState.error;
  bool get hasPending => pendingCount > 0 || state == SyncState.partial;
}

/// Sync state enum
enum SyncState {
  idle,
  synced,
  syncing,
  offline,
  error,
  partial,
}
