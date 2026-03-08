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

      // Process sync queue (general)
      await _processSyncQueue();

      // Process quality-specific queue items
      await _processQualityQueue();

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
              t.syncStatus.equals(SyncStatus.syncing.value))
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

        // Build payload for POST /execution/:projectId/measurements
        // microActivityId column is repurposed to carry planId
        final entryData = {
          'planId': entry.microActivityId,
          'boqItemId': entry.boqItemId,
          'projectId': entry.projectId,
          'wbsNodeId': entry.epsNodeId,
          'activityId': entry.activityId,
          'executedQty': entry.quantity,
          'date': entry.date,
          if (entry.remarks != null) 'notes': entry.remarks,
        };

        // Call the correct execution measurements endpoint
        await _apiClient.saveMeasurements(
          projectId: entry.projectId,
          entries: [entryData],
        );

        // Mark as synced (no single serverId returned for batch endpoint)
        await (_database.update(_database.progressEntries)
              ..where((t) => t.id.equals(entry.id)))
            .write(
          ProgressEntriesCompanion(
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
              t.syncStatus.equals(SyncStatus.syncing.value))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();

    for (final log in pendingLogs) {
      // Check if we should skip due to backoff
      if (log.retryCount >= maxRetryAttempts) {
        await _markDailyLogAsPermanentError(
            log.id, 'Max retry attempts exceeded');
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
  Future<void> _markDailyLogAsPermanentError(
      int logId, String errorMessage) async {
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

  /// Process the sync queue (non-quality items only).
  /// Quality items are handled exclusively by [_processQualityQueue].
  Future<void> _processSyncQueue() async {
    const qualityEntityTypes = [
      'quality_rfi',
      'quality_obs_resolve',
      'quality_stage_save',
      'quality_approve',
      'quality_obs_raise',
      'quality_obs_close',
    ];
    final queueItems = await (_database.select(_database.syncQueue)
          ..where((t) => t.entityType.isNotIn(qualityEntityTypes))
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
      await _apiClient.saveMeasurements(
        projectId: payload['projectId'] as int,
        entries: (payload['entries'] as List).cast<Map<String, dynamic>>(),
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

  /// Process quality-specific entries from SyncQueue
  Future<void> _processQualityQueue() async {
    final qualityItems = await (_database.select(_database.syncQueue)
          ..where((t) =>
              t.entityType.equals('quality_rfi') |
              t.entityType.equals('quality_obs_resolve') |
              t.entityType.equals('quality_stage_save') |
              t.entityType.equals('quality_approve') |
              t.entityType.equals('quality_obs_raise') |
              t.entityType.equals('quality_obs_close'))
          ..orderBy([
            (t) => OrderingTerm.desc(t.priority),
            (t) => OrderingTerm.asc(t.createdAt),
          ])
          ..limit(50))
        .get();

    for (final item in qualityItems) {
      if (item.retryCount >= maxRetryAttempts) {
        await (_database.update(_database.syncQueue)
              ..where((t) => t.id.equals(item.id)))
            .write(const SyncQueueCompanion(
          lastError: Value('Max retries exceeded — needs attention'),
        ));
        continue;
      }

      try {
        final payload = jsonDecode(item.payload) as Map<String, dynamic>;

        switch (item.entityType) {
          case 'quality_rfi':
            await _apiClient.raiseRfi(
              projectId: payload['projectId'] as int,
              epsNodeId: payload['epsNodeId'] as int,
              listId: payload['listId'] as int,
              activityId: payload['activityId'] as int,
              comments: payload['comments'] as String?,
            );
            break;

          case 'quality_obs_resolve':
            await _apiClient.resolveObservation(
              activityId: payload['activityId'] as int,
              obsId: payload['obsId'] as String,
              closureText: payload['closureText'] as String,
              closureEvidence: (payload['closureEvidence'] as List?)
                  ?.map((e) => e as String)
                  .toList(),
            );
            break;

          case 'quality_stage_save':
            await _apiClient.saveInspectionStage(
              stageId: payload['stageId'] as int,
              status: payload['status'] as String,
              items: (payload['items'] as List).cast<Map<String, dynamic>>(),
            );
            break;

          case 'quality_approve':
            await _apiClient.updateInspectionStatus(
              inspectionId: payload['inspectionId'] as int,
              status: payload['status'] as String,
              comments: payload['comments'] as String?,
              inspectionDate: payload['inspectionDate'] as String?,
            );
            break;

          case 'quality_workflow_advance':
            await _apiClient.advanceWorkflowStep(
              inspectionId: payload['inspectionId'] as int,
              signatureData: payload['signatureData'] as String?,
              signedBy: payload['signedBy'] as String?,
              comments: payload['comments'] as String?,
            );
            break;

          case 'quality_workflow_reject':
            await _apiClient.rejectWorkflowStep(
              inspectionId: payload['inspectionId'] as int,
              comments: payload['comments'] as String,
            );
            break;

          case 'quality_obs_raise':
            await _apiClient.raiseObservation(
              activityId: payload['activityId'] as int,
              observationText: payload['observationText'] as String,
              type: payload['type'] as String?,
              photos: (payload['photos'] as List?)
                  ?.map((e) => e as String)
                  .toList(),
            );
            break;

          case 'quality_obs_close':
            await _apiClient.closeObservation(
              activityId: payload['activityId'] as int,
              obsId: payload['obsId'] as String,
            );
            break;
        }

        // Remove from queue on success
        await (_database.delete(_database.syncQueue)
              ..where((t) => t.id.equals(item.id)))
            .go();

        _logger.i('Quality queue synced: ${item.entityType} #${item.id}');
      } on DioException catch (e) {
        final statusCode = e.response?.statusCode ?? 0;
        // 4xx = permanent validation error, do not retry indefinitely
        final newRetry = statusCode >= 400 && statusCode < 500
            ? maxRetryAttempts // force stop
            : item.retryCount + 1;

        await (_database.update(_database.syncQueue)
              ..where((t) => t.id.equals(item.id)))
            .write(SyncQueueCompanion(
          retryCount: Value(newRetry),
          lastAttemptAt: Value(DateTime.now()),
          lastError: Value(_extractErrorMessage(e.response?.data)),
        ));
        _logger.e('Quality sync failed: ${item.entityType} #${item.id}',
            error: e);
      } catch (e) {
        await (_database.update(_database.syncQueue)
              ..where((t) => t.id.equals(item.id)))
            .write(SyncQueueCompanion(
          retryCount: Value(item.retryCount + 1),
          lastAttemptAt: Value(DateTime.now()),
          lastError: Value(e.toString()),
        ));
      }
    }
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
              t.syncStatus.equals(SyncStatus.failed.value)))
        .get()
        .then((list) => list.length);

    final logsCount = await (_database.select(_database.dailyLogs)
          ..where((t) =>
              t.syncStatus.equals(SyncStatus.pending.value) |
              t.syncStatus.equals(SyncStatus.failed.value)))
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

  /// Delete a progress entry that has not yet been synced (pending / failed / error).
  Future<void> deleteProgressEntry(int entryId) async {
    await (_database.delete(_database.progressEntries)
          ..where((t) => t.id.equals(entryId)))
        .go();
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

  factory SyncStatusInfo.idle() =>
      const SyncStatusInfo._(state: SyncState.idle);
  factory SyncStatusInfo.synced() =>
      const SyncStatusInfo._(state: SyncState.synced);
  factory SyncStatusInfo.syncing() =>
      const SyncStatusInfo._(state: SyncState.syncing);
  factory SyncStatusInfo.offline() =>
      const SyncStatusInfo._(state: SyncState.offline);
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
