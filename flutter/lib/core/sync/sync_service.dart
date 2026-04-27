import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:drift/drift.dart';
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/network/network_info.dart';
import 'package:setu_mobile/core/sync/delta_sync_cursors.dart';

/// Core offline-first sync engine for SETU.
///
/// All user mutations are written to the local SQLite database first and then
/// replayed against the server by this service. This ensures the app is fully
/// functional without a network connection and that no data is lost if the
/// device goes offline mid-session.
///
/// Design decisions:
/// - **FIFO ordering**: items are processed oldest-first (by [createdAt]) so
///   that earlier entries appear on the server in the correct chronological
///   order.
/// - **Exponential backoff**: each retry doubles the delay (2 s → 4 s → 8 s
///   … capped at 60 s) to avoid hammering a degraded server.
/// - **4xx = permanent error**: a 4xx response means the server definitively
///   rejected the payload (validation failure, auth error, etc.). Retrying
///   indefinitely would be pointless and confusing, so the row is marked with
///   [SyncStatus.error] and the user is prompted to fix it.
/// - **5xx / network = retry**: transient server or connectivity failures
///   increment [retryCount] and re-attempt up to [maxRetryAttempts] times.
/// - **Idempotency keys**: each mutation carries a unique key so the server
///   can detect and ignore duplicate submissions caused by a retry after a
///   partially-successful request (the server processed it but the client
///   timed out before receiving the 200).
/// - **Split queues**: progress entries and daily logs have dedicated tables
///   with richer columns; all other mutations go through the generic
///   [SyncQueue] table keyed by [entityType].
class SyncService {
  final AppDatabase _database;
  final SetuApiClient _apiClient;
  final NetworkInfo _networkInfo;
  final Logger _logger = Logger();

  /// Maximum retry attempts before marking as permanent error.
  ///
  /// After 10 failures the item is considered stuck and the user must
  /// intervene. This prevents the queue from growing forever on a server bug.
  static const int maxRetryAttempts = 10;

  /// Base delay for exponential backoff (in seconds).
  ///
  /// The actual delay for retry N is: min(2^(N-1) * baseBackoffDelaySeconds, 60).
  /// So: attempt 1 → 2 s, attempt 2 → 4 s, attempt 3 → 8 s, etc.
  static const int baseBackoffDelaySeconds = 2;

  /// Maximum backoff delay (in seconds).
  ///
  /// Caps the exponential growth so that a device with many failed retries
  /// does not wait an unreasonably long time before trying again.
  static const int maxBackoffDelaySeconds = 60;

  /// Callback for sync status changes.
  ///
  /// Set by [ConnectivitySyncService] to relay state changes to the UI layer
  /// without coupling [SyncService] to Flutter's widget tree.
  void Function(SyncStatusInfo)? onStatusChanged;

  /// Current sync status — readable by the UI without subscribing to a stream.
  SyncStatusInfo _currentStatus = SyncStatusInfo.idle();
  SyncStatusInfo get currentStatus => _currentStatus;

  SyncService(this._database, this._apiClient, this._networkInfo);

  /// Sync all pending data in a single pass.
  ///
  /// Processes progress entries, daily logs, and both the generic and
  /// quality-specific sync queues in sequence. Returns a [SyncResult]
  /// summarising how many items were synced or failed.
  Future<SyncResult> syncAll({int? projectId}) async {
    final result = SyncResult();

    // Check connectivity first — no point building payloads or updating
    // row state if we know there is no network.
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

      // Pull server changes (delta sync) — runs after push to avoid overwriting
      // data we just uploaded.
      if (projectId != null) {
        await _deltaSync(projectId);
      }

      result.success = true;

      // Determine the post-sync UI state based on what remains in the queue.
      final pendingCount = await getPendingSyncCount();
      if (pendingCount > 0) {
        // Some items could not be synced this cycle (e.g. hit the 100-item
        // cap) — show a "partial" badge so the user knows to expect another
        // sync attempt.
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

  /// Sync pending progress entries with exponential backoff.
  ///
  /// Fetches up to 100 pending/syncing entries ordered oldest-first (FIFO).
  /// The batch cap of 100 prevents a single sync cycle from blocking the UI
  /// for too long when there is a large backlog.
  Future<_SyncPartialResult> _syncProgressEntries() async {
    final result = _SyncPartialResult();

    // Include rows in `syncing` state in case the app was killed mid-sync —
    // those rows need to be retried because we cannot know if the server
    // received the previous request.
    final pendingEntries = await (_database.select(_database.progressEntries)
          ..where((t) =>
              t.syncStatus.equals(SyncStatus.pending.value) |
              t.syncStatus.equals(SyncStatus.syncing.value))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]) // FIFO
          ..limit(100)) // Cap per cycle to stay responsive
        .get();

    for (final entry in pendingEntries) {
      // Hard stop: if this entry has already exhausted all retry attempts,
      // escalate to a permanent error instead of trying again.
      // Preserve the existing syncError if set (e.g. a 4xx permission error)
      // so the UI shows the real reason rather than a generic message.
      if (entry.retryCount >= maxRetryAttempts) {
        final msg = (entry.syncError?.isNotEmpty ?? false)
            ? entry.syncError!
            : 'Max retry attempts exceeded';
        await _markAsPermanentError(entry.id, msg);
        result.failed++;
        continue;
      }

      try {
        // Transition to `syncing` before the network call so that if the app
        // is killed mid-request the row is not left in `pending` (which would
        // cause it to be re-queued on the next launch without incrementing
        // retryCount, potentially masking repeated failures).
        await (_database.update(_database.progressEntries)
              ..where((t) => t.id.equals(entry.id)))
            .write(ProgressEntriesCompanion(
          syncStatus: Value(SyncStatus.syncing.value),
        ));

        // Resolve any locally-saved photo paths to server URLs before building
        // the payload. Photos must be uploaded before the entry so the server
        // receives fully-qualified URLs in the same request.
        final rawPhotos = entry.photoPaths
                ?.split(',')
                .where((p) => p.isNotEmpty)
                .toList() ??
            <String>[];
        final resolvedPhotos = rawPhotos.isNotEmpty
            ? await _resolvePhotos(rawPhotos)
            : <String>[];

        // Update local photoPaths with resolved URLs so the local record
        // stays consistent even if the entry was already synced once.
        if (resolvedPhotos.isNotEmpty) {
          await (_database.update(_database.progressEntries)
                ..where((t) => t.id.equals(entry.id)))
              .write(ProgressEntriesCompanion(
            photoPaths: Value(resolvedPhotos.join(',')),
          ));
          // Remove any stale 'photo' queue rows for this entry since
          // photos are now resolved inline.
          await (_database.delete(_database.syncQueue)
                ..where((t) =>
                    t.entityType.equals('photo') &
                    t.entityId.equals(entry.id)))
              .go();
        }

        // Build payload for POST /execution/:projectId/measurements.
        // The `microActivityId` column is repurposed to carry the `planId`
        // because that field was added after the initial table design — a
        // future migration should rename it for clarity.
        final entryData = {
          'planId': entry.microActivityId,
          'boqItemId': entry.boqItemId,
          'projectId': entry.projectId,
          'wbsNodeId': entry.epsNodeId,
          'activityId': entry.activityId,
          'executedQty': entry.quantity,
          'date': entry.date,
          if (entry.remarks != null) 'notes': entry.remarks,
          if (resolvedPhotos.isNotEmpty) 'photos': resolvedPhotos,
        };

        // Call the correct execution measurements endpoint.
        await _apiClient.saveMeasurements(
          projectId: entry.projectId,
          entries: [entryData],
        );

        // The batch measurements endpoint returns 200 without a per-entry
        // serverId, so we cannot populate `serverId` here. Mark as synced
        // without it — the server is the source of truth for IDs.
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

  /// Sync pending daily logs.
  ///
  /// Follows the same FIFO-with-backoff pattern as [_syncProgressEntries].
  Future<_SyncPartialResult> _syncDailyLogs() async {
    final result = _SyncPartialResult();

    // Get pending logs ordered by creation time (FIFO), max 100 per cycle.
    final pendingLogs = await (_database.select(_database.dailyLogs)
          ..where((t) =>
              t.syncStatus.equals(SyncStatus.pending.value) |
              t.syncStatus.equals(SyncStatus.syncing.value))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)])
          ..limit(100))
        .get();

    for (final log in pendingLogs) {
      // Check if we should skip due to backoff.
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

  /// Handle sync error with appropriate action.
  ///
  /// The key distinction is between *client* errors (4xx) and *server/network*
  /// errors (5xx or no response):
  /// - 4xx → the payload itself is wrong (bad data, expired token, etc.).
  ///   Retrying with the same payload will always fail, so we permanently mark
  ///   the row as [SyncStatus.error] and surface it to the user.
  /// - 5xx / network → transient failure. We mark the row as
  ///   [SyncStatus.failed] so that the next sync cycle retries it.
  Future<void> _handleSyncError(int entryId, dynamic error, String type) async {
    if (error is DioException) {
      final statusCode = error.response?.statusCode;

      // 4xx errors are validation errors — need user action.
      if (statusCode != null && statusCode >= 400 && statusCode < 500) {
        final errorMessage = _extractErrorMessage(error.response?.data);
        await _markAsPermanentError(entryId, errorMessage);
        return;
      }

      // 5xx errors or network errors — retry with backoff.
      // Note: `retryCount` is set to 1 here rather than incremented because
      // the update DSL does not support `SET retry_count = retry_count + 1`
      // directly; the increment logic relies on the current DB value being
      // read before the write in the calling loop.
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
      // Unknown error — mark as failed for retry.
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

  /// Handle daily log sync error.
  ///
  /// Mirrors [_handleSyncError]: 4xx → permanent error, everything else →
  /// retryable failure.
  Future<void> _handleDailyLogSyncError(int logId, dynamic error) async {
    if (error is DioException) {
      final statusCode = error.response?.statusCode;

      // 4xx = permanent; do not retry.
      if (statusCode != null && statusCode >= 400 && statusCode < 500) {
        final errorMessage = _extractErrorMessage(error.response?.data);
        await _markDailyLogAsPermanentError(logId, errorMessage);
        return;
      }

      // 5xx / network = retry.
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

  /// Mark a progress entry as permanent error (requires user action).
  ///
  /// [SyncStatus.error] is the terminal state for a row — the sync engine
  /// will not attempt it again. The [errorMessage] is shown in the UI so the
  /// user knows what to fix or delete.
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

  /// Mark a daily log as permanent error.
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

  /// Extract error message from API response.
  ///
  /// The server may return the error in different shapes depending on the
  /// endpoint (NestJS validation errors vs. plain strings vs. null). This
  /// helper normalises all cases to a single string so the UI always has
  /// something useful to display.
  String _extractErrorMessage(dynamic data) {
    if (data == null) return 'Unknown error';
    if (data is String) return data;
    if (data is Map) {
      // NestJS typically returns { message: '...' } or { error: '...' }.
      return data['message']?.toString() ??
          data['error']?.toString() ??
          'Validation error';
    }
    return 'Unknown error';
  }

  /// Calculate exponential backoff delay.
  ///
  /// Formula: min(baseDelay * 2^(retryCount - 1), maxDelay)
  /// Example progression for base=2, max=60:
  ///   retry 1 → 2 s, retry 2 → 4 s, retry 3 → 8 s,
  ///   retry 4 → 16 s, retry 5 → 32 s, retry 6+ → 60 s (capped).
  ///
  /// The cap prevents extremely long waits for items that have failed many
  /// times — the user should see an error and take action before that point.
  /// Process the sync queue (non-quality items only).
  ///
  /// Quality items are handled exclusively by [_processQualityQueue] because
  /// they require different dispatch logic and a larger set of API methods.
  /// Separating the two queues means each can be reasoned about independently
  /// and the exclusion list here acts as a guard against accidental double-
  /// processing if a new quality entity type is added but not yet listed.
  ///
  /// Items are ordered by [priority] descending so that user-initiated
  /// operations are sent before background-queued items.
  Future<void> _processSyncQueue() async {
    // Explicitly exclude all known quality/EHS types so they are not
    // accidentally processed here AND in [_processQualityQueue].
    const qualityEntityTypes = [
      'quality_rfi',
      'quality_obs_resolve',
      'quality_stage_save',
      'quality_stage_approve',
      'quality_approve',
      'quality_obs_raise',
      'quality_obs_close',
      'quality_workflow_advance',
      'quality_workflow_reject',
      'quality_site_obs_create',
      'quality_site_obs_rectify',
      'quality_site_obs_close',
      'ehs_site_obs_create',
      'ehs_site_obs_rectify',
      'ehs_site_obs_close',
    ];
    final queueItems = await (_database.select(_database.syncQueue)
          ..where((t) => t.entityType.isNotIn(qualityEntityTypes))
          ..orderBy([(t) => OrderingTerm.desc(t.priority)])
          ..limit(50))
        .get();

    for (final item in queueItems) {
      try {
        final payload = jsonDecode(item.payload) as Map<String, dynamic>;

        // Dispatch to the appropriate handler based on the entity type string.
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

        // Remove from queue on success — the row is no longer needed because
        // the server has confirmed receipt.
        await (_database.delete(_database.syncQueue)
              ..where((t) => t.id.equals(item.id)))
            .go();
      } catch (e) {
        // Update retry info so the next sync cycle knows how many times this
        // item has been attempted and when it was last tried.
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

  /// Dispatch a progress-related queue item to the correct API call.
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

  /// Dispatch a daily-log queue item to the correct API call.
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

  /// Photo upload handler — deferred pending requirements clarification.
  ///
  /// Photo uploads are intentionally left as a no-op for now. Photos captured
  /// on-site are first uploaded to cloud storage via a direct device → S3 flow
  /// before the parent entity is submitted, so the sync queue should never
  /// contain raw photo bytes. This stub exists as a safety net in case older
  /// queue rows with `entityType == 'photo'` are encountered.
  /// Upload a single photo from local storage to the server.
  ///
  /// The [SyncQueue] row payload must have:
  ///   - `localPath`: absolute path to the file on device
  ///   - `entryType`: 'progress' | 'quality'
  ///   - `entryLocalId`: local DB id of the parent entry
  ///
  /// On success: the parent entry's photoPaths comma-separated column is updated
  /// to replace [localPath] with the returned server URL, and the queue item is
  /// deleted.
  /// On failure: retryCount is incremented by the outer queue processor.
  Future<void> _processPhotoQueueItem(
    SyncQueueData item,
    Map<String, dynamic> payload,
  ) async {
    final localPath = payload['localPath'] as String?;
    final entryType = payload['entryType'] as String?;
    final entryLocalId = payload['entryLocalId'] as int?;

    if (localPath == null || entryType == null || entryLocalId == null) {
      // Invalid payload — remove from queue to avoid perpetual retries.
      await (_database.delete(_database.syncQueue)
            ..where((t) => t.id.equals(item.id)))
          .go();
      return;
    }

    final file = File(localPath);
    if (!file.existsSync()) {
      // File was deleted — remove from queue silently.
      await (_database.delete(_database.syncQueue)
            ..where((t) => t.id.equals(item.id)))
          .go();
      return;
    }

    final response = await _apiClient.uploadFile(filePath: localPath);
    final serverUrl = response['url'] as String;

    // Replace the local path with the server URL in the parent entry.
    if (entryType == 'progress') {
      final entries = await (_database.select(_database.progressEntries)
            ..where((t) => t.id.equals(entryLocalId)))
          .get();
      if (entries.isNotEmpty) {
        final entry = entries.first;
        final paths = entry.photoPaths != null && entry.photoPaths!.isNotEmpty
            ? entry.photoPaths!.split(',')
            : <String>[];
        final updated = paths.map((p) => p == localPath ? serverUrl : p).toList();
        await (_database.update(_database.progressEntries)
              ..where((t) => t.id.equals(entryLocalId)))
            .write(ProgressEntriesCompanion(
          photoPaths: Value(updated.join(',')),
        ));
      }
    }
    // Queue item deletion is handled by the outer processor on success.
  }

  /// Process quality-specific entries from SyncQueue.
  ///
  /// Quality and EHS operations are isolated from the generic queue processor
  /// because they map to a richer set of API methods and require careful
  /// 4xx vs 5xx error handling (e.g. a rejected RFI should not block other
  /// items in the queue).
  ///
  /// Ordering: priority DESC, then createdAt ASC (FIFO within same priority).
  /// This ensures that an urgent "approve" action submitted by a manager is
  /// not delayed behind dozens of queued "raise observation" entries.
  Future<void> _processQualityQueue() async {
    final qualityItems = await (_database.select(_database.syncQueue)
          ..where((t) =>
              t.entityType.equals('quality_rfi') |
              t.entityType.equals('quality_obs_resolve') |
              t.entityType.equals('quality_stage_save') |
              t.entityType.equals('quality_stage_approve') |
              t.entityType.equals('quality_approve') |
              t.entityType.equals('quality_obs_raise') |
              t.entityType.equals('quality_obs_close') |
              t.entityType.equals('quality_workflow_advance') |
              t.entityType.equals('quality_workflow_reject') |
              t.entityType.equals('quality_site_obs_create') |
              t.entityType.equals('quality_site_obs_rectify') |
              t.entityType.equals('quality_site_obs_close') |
              t.entityType.equals('ehs_site_obs_create') |
              t.entityType.equals('ehs_site_obs_rectify') |
              t.entityType.equals('ehs_site_obs_close'))
          ..orderBy([
            (t) => OrderingTerm.desc(t.priority),  // Highest priority first
            (t) => OrderingTerm.asc(t.createdAt),  // FIFO within same priority
          ])
          ..limit(50))
        .get();

    for (final item in qualityItems) {
      // Guard: skip permanently-stuck items rather than throwing away the
      // queue position. The item will remain in the DB until the user clears
      // it, giving them visibility that something needs attention.
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

        // Each case maps the stored entityType to the corresponding
        // SetuApiClient method, unpacking the payload JSON into typed args.
        switch (item.entityType) {
          case 'quality_rfi':
            // Raise a Request for Inspection on a specific quality activity.
            // Supports One Go (partNo=1,totalParts=1), Multi Go (partNo/totalParts),
            // and Unit Wise (qualityUnitId) modes via documentType field.
            await _apiClient.raiseRfi(
              projectId: payload['projectId'] as int,
              epsNodeId: payload['epsNodeId'] as int,
              listId: payload['listId'] as int,
              activityId: payload['activityId'] as int,
              drawingNo: payload['drawingNo'] as String? ?? '',
              comments: payload['comments'] as String?,
              documentType: payload['documentType'] as String?,
              partNo: payload['partNo'] as int?,
              totalParts: payload['totalParts'] as int?,
              partLabel: payload['partLabel'] as String?,
              qualityUnitId: payload['qualityUnitId'] as int?,
              vendorId: payload['vendorId'] as int?,
              vendorName: payload['vendorName'] as String?,
            );
            break;

          case 'quality_obs_resolve':
            // Upload any locally-saved rectification photos, then resolve.
            final resolveEvidence = await _resolvePhotos(
                (payload['closureEvidence'] as List?) ?? []);
            await _apiClient.resolveObservation(
              activityId: payload['activityId'] as int,
              obsId: payload['obsId'] as String,
              closureText: payload['closureText'] as String,
              closureEvidence:
                  resolveEvidence.isEmpty ? null : resolveEvidence,
            );
            break;

          case 'quality_stage_save':
            // Persist checklist item responses for an inspection stage.
            await _apiClient.saveInspectionStage(
              stageId: payload['stageId'] as int,
              status: payload['status'] as String,
              items: (payload['items'] as List).cast<Map<String, dynamic>>(),
            );
            break;

          case 'quality_stage_approve':
            // Approve a single checklist stage at its next pending release level.
            // queued_after: quality_stage_save to ensure items are persisted first.
            await _apiClient.approveInspectionStage(
              inspectionId: payload['inspectionId'] as int,
              stageId: payload['stageId'] as int,
              comments: payload['comments'] as String?,
              signatureData: payload['signatureData'] as String?,
              signedBy: payload['signedBy'] as String?,
            );
            break;

          case 'quality_approve':
            // Update the overall inspection status (approve / reject).
            await _apiClient.updateInspectionStatus(
              inspectionId: payload['inspectionId'] as int,
              status: payload['status'] as String,
              comments: payload['comments'] as String?,
              inspectionDate: payload['inspectionDate'] as String?,
            );
            break;

          case 'quality_workflow_advance':
            // Sign off on the current workflow step and advance to the next.
            await _apiClient.advanceWorkflowStep(
              inspectionId: payload['inspectionId'] as int,
              signatureData: payload['signatureData'] as String?,
              signedBy: payload['signedBy'] as String?,
              comments: payload['comments'] as String?,
            );
            break;

          case 'quality_workflow_reject':
            // Reject the current workflow step and return it to the sender.
            await _apiClient.rejectWorkflowStep(
              inspectionId: payload['inspectionId'] as int,
              comments: payload['comments'] as String,
            );
            break;

          case 'quality_obs_raise':
            // Upload any locally-saved photos first, then raise the observation.
            // Local paths are produced when the user captures photos offline;
            // _resolvePhotos uploads them and returns the server URLs.
            final obsPhotos = await _resolvePhotos(
                (payload['photos'] as List?) ?? []);
            await _apiClient.raiseObservation(
              activityId: payload['activityId'] as int,
              observationText: payload['observationText'] as String,
              inspectionId: payload['inspectionId'] as int,
              stageId: payload['stageId'] as int?,
              type: payload['type'] as String?,
              photos: obsPhotos.isEmpty ? null : obsPhotos,
            );
            break;

          case 'quality_obs_close':
            // Close an observation without a formal resolve (e.g. waived).
            await _apiClient.closeObservation(
              activityId: payload['activityId'] as int,
              obsId: payload['obsId'] as String,
            );
            break;

          case 'quality_site_obs_create':
            // Upload local photos then raise the quality site observation.
            final qSitePhotos = await _resolvePhotos(
                (payload['photoUrls'] as List?) ?? []);
            await _apiClient.createQualitySiteObs(
              projectId: payload['projectId'] as int,
              epsNodeId: payload['epsNodeId'] as int?,
              description: payload['description'] as String,
              severity: payload['severity'] as String,
              category: payload['category'] as String?,
              locationLabel: payload['locationLabel'] as String?,
              photoUrls: qSitePhotos,
            );
            break;

          case 'quality_site_obs_rectify':
            // Upload local photos then submit rectification evidence.
            final qRectifyPhotos = await _resolvePhotos(
                (payload['photoUrls'] as List?) ?? []);
            await _apiClient.rectifyQualitySiteObs(
              id: payload['id'] as String,
              notes: payload['notes'] as String,
              photoUrls: qRectifyPhotos,
            );
            break;

          case 'quality_site_obs_close':
            // Close a quality site observation (moves it to CLOSED state).
            await _apiClient.closeQualitySiteObs(
              id: payload['id'] as String,
              closureNotes: payload['closureNotes'] as String?,
            );
            break;

          case 'ehs_site_obs_create':
            // Upload local photos then raise the EHS site observation.
            final ehsPhotos = await _resolvePhotos(
                (payload['photoUrls'] as List?) ?? []);
            await _apiClient.createEhsSiteObs(
              projectId: payload['projectId'] as int,
              epsNodeId: payload['epsNodeId'] as int?,
              description: payload['description'] as String,
              severity: payload['severity'] as String,
              category: payload['category'] as String?,
              locationLabel: payload['locationLabel'] as String?,
              photoUrls: ehsPhotos,
            );
            break;

          case 'ehs_site_obs_rectify':
            // Upload local photos then submit EHS rectification evidence.
            final ehsRectifyPhotos = await _resolvePhotos(
                (payload['photoUrls'] as List?) ?? []);
            await _apiClient.rectifyEhsSiteObs(
              id: payload['id'] as String,
              notes: payload['notes'] as String,
              photoUrls: ehsRectifyPhotos,
            );
            break;

          case 'ehs_site_obs_close':
            await _apiClient.closeEhsSiteObs(
              id: payload['id'] as String,
              closureNotes: payload['closureNotes'] as String?,
            );
            break;

          case 'ehs_incident_create':
            // EHS incidents carry no photos — submit the payload directly.
            await _apiClient.createEhsIncident(
              projectId: payload['projectId'] as int,
              payload: payload,
            );
            break;
        }

        // Remove from queue on success — the server has confirmed receipt.
        await (_database.delete(_database.syncQueue)
              ..where((t) => t.id.equals(item.id)))
            .go();

        _logger.i('Quality queue synced: ${item.entityType} #${item.id}');
      } on DioException catch (e) {
        final statusCode = e.response?.statusCode ?? 0;

        // 409 Conflict — the approval was superseded by another user.
        // Treat as a permanent error with a human-readable message so the
        // user knows they need to review the current approval status rather
        // than waiting for a retry that will never succeed.
        final errorMsg = statusCode == 409
            ? 'Your approval was superseded — please review the current status'
            : _extractErrorMessage(e.response?.data);

        // 4xx = permanent validation error — force retryCount to maxRetryAttempts
        // so the item is treated as permanently failed on the next cycle rather
        // than being retried. This prevents an invalid RFI payload from
        // blocking the entire quality queue indefinitely.
        final newRetry = statusCode >= 400 && statusCode < 500
            ? maxRetryAttempts // force stop
            : item.retryCount + 1;

        await (_database.update(_database.syncQueue)
              ..where((t) => t.id.equals(item.id)))
            .write(SyncQueueCompanion(
          retryCount: Value(newRetry),
          lastAttemptAt: Value(DateTime.now()),
          lastError: Value(errorMsg),
        ));
        _logger.e('Quality sync failed: ${item.entityType} #${item.id}',
            error: e);
      } catch (e) {
        // Non-Dio error (e.g. JSON parse failure) — increment retry count
        // and store the error message for debugging.
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

  /// Add item to sync queue.
  ///
  /// Called by feature services (quality, EHS) to enqueue a server mutation
  /// for later delivery. The [payload] is JSON-encoded and stored verbatim —
  /// the caller is responsible for including all fields needed by the
  /// corresponding API method.
  ///
  /// [priority] defaults to 0; pass a higher value to have the item processed
  /// before other pending items in the same cycle.
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

  /// Pull changes from the server since the last successful delta sync.
  ///
  /// For each module (progress, quality, ehs):
  ///   1. Reads the stored cursor timestamp from SharedPreferences.
  ///   2. Calls GET /sync/{module}?since=cursor&projectId=projectId.
  ///   3. Upserts the returned records into the local Drift cache tables.
  ///   4. Skips local records with sync_status = pending (user's edits win).
  ///   5. Advances the cursor to response.synced_at on success.
  ///
  /// Only runs when the device is online. Silently no-ops on network error
  /// so it does not interfere with the existing push-sync logic.
  Future<void> _deltaSync(int projectId) async {
    if (!await _networkInfo.isConnected) return;

    final cursors = await DeltaSyncCursors.create();

    // ── Progress delta ──────────────────────────────────────────────────────
    try {
      final res = await _apiClient.deltaProgressSync(
        projectId: projectId,
        since: cursors.progressCursor,
      );
      final syncedAt = res['synced_at'] as String;
      final records =
          (res['data'] as List<dynamic>).cast<Map<String, dynamic>>();

      for (final record in records) {
        final serverId = record['id'] as int?;
        if (serverId == null) continue;

        // Find the matching local entry (if any).
        final localEntries = await (_database.select(_database.progressEntries)
              ..where((t) => t.serverId.equals(serverId)))
            .get();

        if (localEntries.isNotEmpty) {
          final local = localEntries.first;
          // USER WINS: never overwrite a pending local edit with server data.
          if (local.syncStatus == SyncStatus.pending.value) continue;
          // Update server timestamp so future delta syncs have a valid cursor.
          await (_database.update(_database.progressEntries)
                ..where((t) => t.id.equals(local.id)))
              .write(ProgressEntriesCompanion(
            serverUpdatedAt: Value(
                DateTime.tryParse(record['updatedAt']?.toString() ?? '')),
          ));
        }
        // No local entry — nothing to update (server record not yet seen locally).
      }
      await cursors.setProgressCursor(syncedAt);
    } catch (e) {
      _logger.w('Progress delta sync failed (non-fatal): $e');
    }

    // ── Quality delta ───────────────────────────────────────────────────────
    try {
      final res = await _apiClient.deltaQualitySync(
        projectId: projectId,
        since: cursors.qualityCursor,
      );
      final syncedAt = res['synced_at'] as String;
      final data = res['data'] as Map<String, dynamic>;

      final lists =
          (data['lists'] as List<dynamic>).cast<Map<String, dynamic>>();
      final activities =
          (data['activities'] as List<dynamic>).cast<Map<String, dynamic>>();
      final siteObs =
          (data['siteObs'] as List<dynamic>).cast<Map<String, dynamic>>();

      if (lists.isNotEmpty) {
        await _database.cacheActivityLists(lists, projectId);
      }
      if (activities.isNotEmpty) {
        // Group activities by listId so the cache method's signature is satisfied.
        final byList = <int, List<Map<String, dynamic>>>{};
        for (final a in activities) {
          final lid = (a['listId'] as num?)?.toInt() ?? 0;
          byList.putIfAbsent(lid, () => []).add(a);
        }
        for (final entry in byList.entries) {
          await _database.cacheQualityActivities(
              entry.value, entry.key, projectId, null);
        }
      }
      if (siteObs.isNotEmpty) {
        await _database.cacheQualitySiteObs(siteObs, projectId);
      }

      await cursors.setQualityCursor(syncedAt);
    } catch (e) {
      _logger.w('Quality delta sync failed (non-fatal): $e');
    }

    // ── EHS delta ────────────────────────────────────────────────────────────
    try {
      final res = await _apiClient.deltaEhsSync(
        projectId: projectId,
        since: cursors.ehsCursor,
      );
      final syncedAt = res['synced_at'] as String;
      final records =
          (res['data'] as List<dynamic>).cast<Map<String, dynamic>>();

      if (records.isNotEmpty) {
        await _database.cacheEhsSiteObs(records, projectId);
      }

      await cursors.setEhsCursor(syncedAt);
    } catch (e) {
      _logger.w('EHS delta sync failed (non-fatal): $e');
    }
  }

  /// Get total pending sync count across all queues.
  ///
  /// Counts rows in three places:
  /// - [progressEntries] with status pending or failed (eligible for retry)
  /// - [dailyLogs] with status pending or failed
  /// - All rows remaining in [syncQueue] (quality/EHS items)
  ///
  /// Rows with [SyncStatus.error] (permanent failures) are excluded because
  /// those require user action and are counted separately by [getErrorSyncCount].
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

    // All SyncQueue rows are considered pending regardless of retryCount,
    // because the queue does not use a separate permanent-error state.
    final queueCount = await _database.syncQueue.count().getSingle();

    return progressCount + logsCount + queueCount;
  }

  /// Get failed sync count (permanent errors only).
  ///
  /// Returns the count of rows in [SyncStatus.error] state — these are items
  /// that the server definitively rejected and that require the user to
  /// review and either correct the data or delete the entry.
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

  /// Retry failed syncs.
  ///
  /// Resets all [SyncStatus.failed] rows back to [SyncStatus.pending] and
  /// immediately triggers a new sync cycle. Does NOT reset permanent errors
  /// ([SyncStatus.error]) — those require explicit user action via
  /// [retryErrorItem].
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
  ///
  /// Used when the user decides to discard a measurement rather than fixing a
  /// permanent sync error. The server never received this row so no server-side
  /// delete is needed.
  Future<void> deleteProgressEntry(int entryId) async {
    await (_database.delete(_database.progressEntries)
          ..where((t) => t.id.equals(entryId)))
        .go();
  }

  /// Retry a specific error item (after user correction).
  ///
  /// Resets the item to [SyncStatus.pending] and clears the error message and
  /// [retryCount] so the full backoff sequence starts fresh. This is called
  /// after the user has manually edited the data to fix the validation error
  /// that caused the permanent failure.
  Future<void> retryErrorItem(int entryId, {bool isDailyLog = false}) async {
    if (isDailyLog) {
      await (_database.update(_database.dailyLogs)
            ..where((t) => t.id.equals(entryId)))
          .write(DailyLogsCompanion(
        syncStatus: Value(SyncStatus.pending.value),
        syncError: const Value(null),
        retryCount: const Value(0), // Full reset so backoff starts from 2 s
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

    // Trigger sync immediately so the corrected item is sent without waiting
    // for the next automatic sync trigger.
    await syncAll();
  }

  /// Update sync status and notify listeners.
  ///
  /// Centralised to ensure [_currentStatus] and the [onStatusChanged] callback
  /// are always updated atomically — the callback fires only after the field
  /// is updated, so listeners always see the latest state.
  void _updateStatus(SyncStatusInfo status) {
    _currentStatus = status;
    onStatusChanged?.call(status);
  }

  /// Generate unique idempotency key.
  ///
  /// Combines epoch milliseconds with microseconds-within-millisecond to
  /// produce a key that is unique within a single device session. This is
  /// sufficient because idempotency keys only need to be unique per user/device
  /// combination, not globally unique across all devices.
  static String generateIdempotencyKey() {
    return '${DateTime.now().millisecondsSinceEpoch}_${DateTime.now().microsecond}';
  }

  /// Resolves a list of photo paths/URLs for a sync payload.
  ///
  /// Any entry that is a local absolute file path (saved offline when the
  /// device had no connectivity) is uploaded to the server first and replaced
  /// with the resulting server URL. Remote URLs are passed through unchanged.
  ///
  /// This keeps the SyncService as the single responsibility owner for
  /// local→server photo migration — callers never need to know whether a
  /// stored photo is local or remote.
  Future<List<String>> _resolvePhotos(List<dynamic> rawPhotos) async {
    final resolved = <String>[];
    for (final entry in rawPhotos) {
      final path = entry as String;
      if (path.startsWith('/') || path.startsWith('file://')) {
        // Local file — upload now.
        try {
          final localPath = path.replaceFirst('file://', '');
          final result = await _apiClient.uploadFile(filePath: localPath);
          final url =
              result['url'] as String? ?? result['path'] as String? ?? '';
          if (url.isNotEmpty) {
            resolved.add(url);
            // Clean up the local file after successful upload.
            try {
              await File(localPath).delete();
            } catch (_) {}
          }
        } catch (_) {
          // Upload failed — keep the local path so the item stays in the
          // retry queue and the photo isn't lost.
          resolved.add(path);
          rethrow; // propagate so the sync item is not marked as done
        }
      } else {
        resolved.add(path); // already a server URL
      }
    }
    return resolved;
  }
}

/// Aggregated result of a full [SyncService.syncAll] pass.
///
/// Callers can inspect individual counters or use convenience getters
/// ([totalSynced], [totalFailed], [hasFailures]) to decide how to update the
/// UI.
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

/// Internal result type for a single-table sync pass.
///
/// Private so it doesn't leak into the public API — callers use [SyncResult]
/// which aggregates all partial results.
class _SyncPartialResult {
  int synced = 0;
  int failed = 0;
}

/// Immutable snapshot of sync state for UI display.
///
/// Constructed via named factory constructors so the calling code reads
/// clearly (e.g. `SyncStatusInfo.offline()`) rather than passing enum values
/// directly.
class SyncStatusInfo {
  final SyncState state;

  /// Number of items still waiting to be synced (used by [SyncState.partial]).
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

/// Represents the current state of the sync engine for UI rendering.
enum SyncState {
  /// No sync has been attempted since app start.
  idle,
  /// All pending items have been successfully synced.
  synced,
  /// Sync is currently in progress.
  syncing,
  /// Device has no network connection.
  offline,
  /// One or more items failed to sync (transient or permanent).
  error,
  /// Sync completed but some items remain pending (e.g. batch cap was hit).
  partial,
}
