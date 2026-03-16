import 'package:drift/drift.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart' as db;
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/progress/data/models/progress_model.dart';

// ==================== EVENTS ====================

/// Base class for all progress BLoC events.
abstract class ProgressEvent extends Equatable {
  const ProgressEvent();

  @override
  List<Object?> get props => [];
}

/// Save a single progress entry (offline-first: local DB first, then sync).
class SaveProgress extends ProgressEvent {
  final ProgressEntry entry;

  const SaveProgress(this.entry);

  @override
  List<Object?> get props => [entry];
}

/// Save multiple progress entries in one batch (e.g. multiple BOQ items).
class SaveMultipleProgress extends ProgressEvent {
  final List<ProgressEntry> entries;

  const SaveMultipleProgress(this.entries);

  @override
  List<Object?> get props => [entries];
}

/// Load progress history for a project from the local Drift database.
class LoadProgressHistory extends ProgressEvent {
  final int projectId;

  const LoadProgressHistory(this.projectId);

  @override
  List<Object?> get props => [projectId];
}

/// Manually trigger a sync of all pending local entries to the server.
class SyncProgress extends ProgressEvent {}

/// Load the supervisor approval queue for a project.
/// Returns progress logs with status PENDING that the supervisor can approve/reject.
class LoadPendingApprovals extends ProgressEvent {
  final int projectId;
  const LoadPendingApprovals(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

/// Approve one or more progress log entries.
/// Triggers a reload of the approval queue after success.
class ApproveProgress extends ProgressEvent {
  final int projectId;
  final List<int> logIds;
  const ApproveProgress({required this.projectId, required this.logIds});
  @override
  List<Object?> get props => [projectId, logIds];
}

/// Reject one or more progress log entries with a mandatory reason.
/// Triggers a reload of the approval queue after success.
class RejectProgress extends ProgressEvent {
  final int projectId;
  final List<int> logIds;
  final String reason;
  const RejectProgress({
    required this.projectId,
    required this.logIds,
    required this.reason,
  });
  @override
  List<Object?> get props => [projectId, logIds, reason];
}

// ==================== STATES ====================

/// Base class for all progress states.
abstract class ProgressState extends Equatable {
  const ProgressState();

  @override
  List<Object?> get props => [];
}

/// No data loaded yet.
class ProgressInitial extends ProgressState {}

/// Async operation in progress — show a loading indicator.
class ProgressLoading extends ProgressState {}

/// Entry was persisted to local DB (and optionally synced to server).
///
/// [isOffline] = true means the sync attempt failed — data is queued.
/// [pendingSyncCount] shows how many entries still need to be synced.
/// The UI shows a green "Saved" toast if online, or "Saved offline" if not.
class ProgressSaved extends ProgressState {
  final bool isOffline;
  final int pendingSyncCount;

  const ProgressSaved({
    this.isOffline = false,
    this.pendingSyncCount = 0,
  });

  @override
  List<Object?> get props => [isOffline, pendingSyncCount];
}

/// Local history has been loaded.
class ProgressHistoryLoaded extends ProgressState {
  final List<ProgressEntry> entries;

  const ProgressHistoryLoaded(this.entries);

  @override
  List<Object?> get props => [entries];
}

/// In-progress sync — used to drive a progress bar.
/// [current] = items synced so far, [total] = items queued.
class ProgressSyncing extends ProgressState {
  final int current;
  final int total;

  const ProgressSyncing({
    required this.current,
    required this.total,
  });

  @override
  List<Object?> get props => [current, total];
}

/// Sync finished — [synced] succeeded, [failed] still need retry.
class ProgressSyncCompleted extends ProgressState {
  final int synced;
  final int failed;

  const ProgressSyncCompleted({
    required this.synced,
    required this.failed,
  });

  @override
  List<Object?> get props => [synced, failed];
}

/// Unrecoverable error during a progress action.
class ProgressError extends ProgressState {
  final String message;

  const ProgressError(this.message);

  @override
  List<Object?> get props => [message];
}

/// The supervisor approval queue has been loaded.
class PendingApprovalsLoaded extends ProgressState {
  final List<ProgressLog> logs;
  const PendingApprovalsLoaded(this.logs);
  @override
  List<Object?> get props => [logs];
}

/// An approve or reject action completed successfully.
/// [wasApproval] = true → "Approved X entries", false → "Rejected X entries".
class ProgressApprovalSuccess extends ProgressState {
  final int count;
  final bool wasApproval; // true = approved, false = rejected
  const ProgressApprovalSuccess({required this.count, required this.wasApproval});
  @override
  List<Object?> get props => [count, wasApproval];
}

/// An approval or rejection action failed.
class ProgressApprovalError extends ProgressState {
  final String message;
  const ProgressApprovalError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

/// Manages offline-first progress logging and the supervisor approval workflow.
///
/// Save flow (offline-first):
///   1. Entry is written to the local Drift DB immediately.
///   2. A sync attempt is made right away (if online, entry goes to server).
///   3. [ProgressSaved] is emitted with isOffline=true if the sync failed.
///   4. The background [SyncService] will retry on next connectivity event.
///
/// Approval flow:
///   1. Supervisor calls [LoadPendingApprovals] to see queued entries.
///   2. Approves/rejects with [ApproveProgress] / [RejectProgress].
///   3. Success → queue is automatically reloaded so the UI refreshes.
class ProgressBloc extends Bloc<ProgressEvent, ProgressState> {
  final db.AppDatabase _database;
  final SyncService _syncService;
  final SetuApiClient _apiClient;

  ProgressBloc({
    required db.AppDatabase database,
    required SyncService syncService,
    required SetuApiClient apiClient,
  })  : _database = database,
        _syncService = syncService,
        _apiClient = apiClient,
        super(ProgressInitial()) {
    on<SaveProgress>(_onSaveProgress);
    on<SaveMultipleProgress>(_onSaveMultipleProgress);
    on<LoadProgressHistory>(_onLoadProgressHistory);
    on<SyncProgress>(_onSyncProgress);
    on<LoadPendingApprovals>(_onLoadPendingApprovals);
    on<ApproveProgress>(_onApproveProgress);
    on<RejectProgress>(_onRejectProgress);
  }

  /// Writes a single progress entry to the local DB, then attempts an
  /// immediate sync so entries appear on the web dashboard without delay.
  Future<void> _onSaveProgress(
    SaveProgress event,
    Emitter<ProgressState> emit,
  ) async {
    emit(ProgressLoading());

    try {
      // Save to local database first — this is the offline-first guarantee.
      await _saveProgressToLocal(event.entry);

      // Attempt an immediate sync to the server. If this fails (no network),
      // the entry stays queued and will be retried by SyncService.
      final syncResult = await _syncService.syncAll();

      emit(ProgressSaved(
        isOffline: !syncResult.success,
        pendingSyncCount: await _syncService.getPendingSyncCount(),
      ));
    } catch (e) {
      emit(ProgressError(e.toString()));
    }
  }

  /// Batch version of [_onSaveProgress] — loops through each entry and
  /// writes them all to local DB before attempting a single sync call.
  Future<void> _onSaveMultipleProgress(
    SaveMultipleProgress event,
    Emitter<ProgressState> emit,
  ) async {
    emit(ProgressLoading());

    try {
      // Save all entries to local database
      for (final entry in event.entries) {
        await _saveProgressToLocal(entry);
      }

      // Try to sync all entries in one batch
      final syncResult = await _syncService.syncAll();

      emit(ProgressSaved(
        isOffline: !syncResult.success,
        pendingSyncCount: await _syncService.getPendingSyncCount(),
      ));
    } catch (e) {
      emit(ProgressError(e.toString()));
    }
  }

  /// Queries the local Drift DB for all progress entries belonging to a project.
  /// Does not hit the network — purely for the offline history view.
  Future<void> _onLoadProgressHistory(
    LoadProgressHistory event,
    Emitter<ProgressState> emit,
  ) async {
    emit(ProgressLoading());

    try {
      // Load from local database
      final entries = await (_database.select(_database.progressEntries)
            ..where((t) => t.projectId.equals(event.projectId)))
          .get();

      // Map Drift row objects to domain model instances
      final progressEntries = entries.map((e) => ProgressEntry(
            id: e.id,
            serverId: e.serverId,
            projectId: e.projectId,
            activityId: e.activityId,
            epsNodeId: e.epsNodeId,
            boqItemId: e.boqItemId,
            microActivityId: e.microActivityId,
            quantity: e.quantity,
            date: DateTime.parse(e.date),
            remarks: e.remarks,
            syncStatus: SyncStatus.fromValue(e.syncStatus),
            createdAt: e.createdAt,
            syncedAt: e.syncedAt,
          ));

      emit(ProgressHistoryLoaded(progressEntries.toList()));
    } catch (e) {
      emit(ProgressError(e.toString()));
    }
  }

  /// Manually kicks off a sync of all pending entries.
  /// Emits [ProgressSyncing] first so the UI can show a progress indicator.
  Future<void> _onSyncProgress(
    SyncProgress event,
    Emitter<ProgressState> emit,
  ) async {
    final pendingCount = await _syncService.getPendingSyncCount();

    // Emit syncing state with total count so the UI can show "Syncing 3 items…"
    emit(ProgressSyncing(current: 0, total: pendingCount));

    try {
      final result = await _syncService.syncAll();

      emit(ProgressSyncCompleted(
        synced: result.totalSynced,
        failed: result.totalFailed,
      ));
    } catch (e) {
      emit(ProgressError(e.toString()));
    }
  }

  /// Fetches the list of pending-approval progress logs from the server.
  Future<void> _onLoadPendingApprovals(
    LoadPendingApprovals event,
    Emitter<ProgressState> emit,
  ) async {
    emit(ProgressLoading());
    try {
      final raw = await _apiClient.getPendingApprovals(event.projectId);
      final logs = raw
          .map((e) => ProgressLog.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(PendingApprovalsLoaded(logs));
    } catch (e) {
      emit(ProgressApprovalError(_friendlyError(e)));
    }
  }

  /// Approves one or more progress log entries by ID.
  /// Automatically reloads the approval queue so the UI reflects the change.
  Future<void> _onApproveProgress(
    ApproveProgress event,
    Emitter<ProgressState> emit,
  ) async {
    emit(ProgressLoading());
    try {
      await _apiClient.approveMeasurements(event.logIds);
      emit(ProgressApprovalSuccess(
        count: event.logIds.length,
        wasApproval: true,
      ));
      // Reload the queue so the UI reflects the change immediately
      add(LoadPendingApprovals(event.projectId));
    } catch (e) {
      emit(ProgressApprovalError(_friendlyError(e)));
    }
  }

  /// Rejects one or more progress log entries with a mandatory reason string.
  /// Automatically reloads the approval queue so the UI reflects the change.
  Future<void> _onRejectProgress(
    RejectProgress event,
    Emitter<ProgressState> emit,
  ) async {
    emit(ProgressLoading());
    try {
      await _apiClient.rejectMeasurements(
        logIds: event.logIds,
        reason: event.reason,
      );
      emit(ProgressApprovalSuccess(
        count: event.logIds.length,
        wasApproval: false,
      ));
      // Reload the queue so the UI reflects the change immediately
      add(LoadPendingApprovals(event.projectId));
    } catch (e) {
      emit(ProgressApprovalError(_friendlyError(e)));
    }
  }

  /// Translates raw exceptions into concise user-facing error strings.
  /// Handles permission, session, and connectivity error patterns.
  String _friendlyError(dynamic e) {
    final s = e.toString().toLowerCase();
    if (s.contains('403') || s.contains('forbidden')) {
      return 'You do not have permission to approve progress entries.';
    }
    if (s.contains('401') || s.contains('unauthorized')) {
      return 'Session expired. Please log in again.';
    }
    if (s.contains('connection') || s.contains('network') || s.contains('socket')) {
      return 'No connection. Please try again when online.';
    }
    return 'Something went wrong. Please try again.';
  }

  /// Inserts a single [ProgressEntry] into the local Drift DB with
  /// status=PENDING and a unique idempotency key.
  ///
  /// The idempotency key prevents duplicate entries if the sync retries
  /// the same entry after a partial failure (e.g. network cut mid-request).
  Future<int> _saveProgressToLocal(ProgressEntry entry) async {
    return await _database.into(_database.progressEntries).insert(
          db.ProgressEntriesCompanion.insert(
            projectId: entry.projectId,
            activityId: entry.activityId,
            epsNodeId: entry.epsNodeId,
            boqItemId: entry.boqItemId,
            quantity: entry.quantity,
            date: entry.date.toIso8601String(),
            microActivityId: Value(entry.microActivityId),
            remarks: Value(entry.remarks),
            photoPaths: Value(entry.photoPaths?.join(',')),
            syncStatus: Value(db.SyncStatus.pending.value),
            idempotencyKey: Value(SyncService.generateIdempotencyKey()),
          ),
        );
  }
}
