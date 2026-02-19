import 'dart:convert';
import 'package:drift/drift.dart';
import 'package:logger/logger.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/network/network_info.dart';

/// Sync service for offline-first data synchronization
class SyncService {
  final AppDatabase _database;
  final SetuApiClient _apiClient;
  final NetworkInfo _networkInfo;
  final Logger _logger = Logger();

  SyncService(this._database, this._apiClient, this._networkInfo);

  /// Sync all pending data
  Future<SyncResult> syncAll() async {
    final result = SyncResult();

    // Check connectivity first
    if (!await _networkInfo.isConnected) {
      result.error = 'No internet connection';
      return result;
    }

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
    } catch (e) {
      result.error = e.toString();
      _logger.e('Sync failed', error: e);
    }

    return result;
  }

  /// Sync pending progress entries
  Future<_SyncPartialResult> _syncProgressEntries() async {
    final result = _SyncPartialResult();

    // Get all pending entries
    final pendingEntries = await (_database.select(_database.progressEntries)
          ..where((t) => t.syncStatus.equals(SyncStatus.pending.value)))
        .get();

    for (final entry in pendingEntries) {
      try {
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
      } catch (e) {
        // Update retry count and error
        await (_database.update(_database.progressEntries)
              ..where((t) => t.id.equals(entry.id)))
            .write(
          ProgressEntriesCompanion(
            syncStatus: Value(SyncStatus.failed.value),
            syncError: Value(e.toString()),
            retryCount: Value(entry.retryCount + 1),
          ),
        );
        result.failed++;
        _logger.e('Failed to sync progress entry ${entry.id}', error: e);
      }
    }

    return result;
  }

  /// Sync pending daily logs
  Future<_SyncPartialResult> _syncDailyLogs() async {
    final result = _SyncPartialResult();

    // Get all pending logs
    final pendingLogs = await (_database.select(_database.dailyLogs)
          ..where((t) => t.syncStatus.equals(SyncStatus.pending.value)))
        .get();

    for (final log in pendingLogs) {
      try {
        // Call the API
        await _apiClient.createDailyLog({
          'microActivityId': log.microActivityId,
          'logDate': log.logDate,
          'plannedQty': log.plannedQty,
          'actualQty': log.actualQty,
          'laborCount': log.laborCount,
          'delayReasonId': log.delayReasonId,
          'delayNotes': log.delayNotes,
          'remarks': log.remarks,
        });

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
      } catch (e) {
        await (_database.update(_database.dailyLogs)
              ..where((t) => t.id.equals(log.id)))
            .write(
          DailyLogsCompanion(
            syncStatus: Value(SyncStatus.failed.value),
            syncError: Value(e.toString()),
            retryCount: Value(log.retryCount + 1),
          ),
        );
        result.failed++;
        _logger.e('Failed to sync daily log ${log.id}', error: e);
      }
    }

    return result;
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
    // Process based on operation type
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
    // Handle photo uploads
    final operation = item.operation;
    if (operation == 'upload') {
      // await _apiClient.uploadPhoto(payload);
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
          ..where((t) => t.syncStatus.equals(SyncStatus.pending.value)))
        .get()
        .then((list) => list.length);

    final logsCount = await (_database.select(_database.dailyLogs)
          ..where((t) => t.syncStatus.equals(SyncStatus.pending.value)))
        .get()
        .then((list) => list.length);

    final queueCount = await _database.syncQueue.count().getSingle();

    return progressCount + logsCount + queueCount;
  }

  /// Get failed sync count
  Future<int> getFailedSyncCount() async {
    final progressCount = await (_database.select(_database.progressEntries)
          ..where((t) => t.syncStatus.equals(SyncStatus.failed.value)))
        .get()
        .then((list) => list.length);

    final logsCount = await (_database.select(_database.dailyLogs)
          ..where((t) => t.syncStatus.equals(SyncStatus.failed.value)))
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
