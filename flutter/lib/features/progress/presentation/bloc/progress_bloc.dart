import 'package:drift/drift.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/database/app_database.dart' as db;
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/progress/data/models/progress_model.dart';

// ==================== EVENTS ====================

abstract class ProgressEvent extends Equatable {
  const ProgressEvent();

  @override
  List<Object?> get props => [];
}

/// Save progress entry
class SaveProgress extends ProgressEvent {
  final ProgressEntry entry;

  const SaveProgress(this.entry);

  @override
  List<Object?> get props => [entry];
}

/// Save multiple progress entries
class SaveMultipleProgress extends ProgressEvent {
  final List<ProgressEntry> entries;

  const SaveMultipleProgress(this.entries);

  @override
  List<Object?> get props => [entries];
}

/// Load progress history for a project
class LoadProgressHistory extends ProgressEvent {
  final int projectId;

  const LoadProgressHistory(this.projectId);

  @override
  List<Object?> get props => [projectId];
}

/// Sync pending progress
class SyncProgress extends ProgressEvent {}

// ==================== STATES ====================

abstract class ProgressState extends Equatable {
  const ProgressState();

  @override
  List<Object?> get props => [];
}

/// Initial state
class ProgressInitial extends ProgressState {}

/// Loading state
class ProgressLoading extends ProgressState {}

/// Progress saved successfully
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

/// Progress history loaded
class ProgressHistoryLoaded extends ProgressState {
  final List<ProgressEntry> entries;

  const ProgressHistoryLoaded(this.entries);

  @override
  List<Object?> get props => [entries];
}

/// Sync status
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

/// Sync completed
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

/// Error state
class ProgressError extends ProgressState {
  final String message;

  const ProgressError(this.message);

  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class ProgressBloc extends Bloc<ProgressEvent, ProgressState> {
  final db.AppDatabase _database;
  final SyncService _syncService;

  ProgressBloc({
    required db.AppDatabase database,
    required SyncService syncService,
  })  : _database = database,
        _syncService = syncService,
        super(ProgressInitial()) {
    on<SaveProgress>(_onSaveProgress);
    on<SaveMultipleProgress>(_onSaveMultipleProgress);
    on<LoadProgressHistory>(_onLoadProgressHistory);
    on<SyncProgress>(_onSyncProgress);
  }

  Future<void> _onSaveProgress(
    SaveProgress event,
    Emitter<ProgressState> emit,
  ) async {
    emit(ProgressLoading());

    try {
      // Save to local database first
      await _saveProgressToLocal(event.entry);

      // Try to sync immediately
      final syncResult = await _syncService.syncAll();

      emit(ProgressSaved(
        isOffline: !syncResult.success,
        pendingSyncCount: await _syncService.getPendingSyncCount(),
      ));
    } catch (e) {
      emit(ProgressError(e.toString()));
    }
  }

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

      // Try to sync
      final syncResult = await _syncService.syncAll();

      emit(ProgressSaved(
        isOffline: !syncResult.success,
        pendingSyncCount: await _syncService.getPendingSyncCount(),
      ));
    } catch (e) {
      emit(ProgressError(e.toString()));
    }
  }

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

  Future<void> _onSyncProgress(
    SyncProgress event,
    Emitter<ProgressState> emit,
  ) async {
    final pendingCount = await _syncService.getPendingSyncCount();

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

  /// Save progress entry to local database
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
