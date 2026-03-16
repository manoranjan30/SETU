import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/labor/data/models/labor_models.dart';

// ═══════════════════════════════════════════ EVENTS ══════════════════════════

/// Base class for all labor tracking events.
abstract class LaborEvent extends Equatable {
  const LaborEvent();
  @override
  List<Object?> get props => [];
}

/// Load labor categories + any existing presence records for the given date.
/// The result is merged into one [DailyLaborEntry] per category.
class LoadLaborPresence extends LaborEvent {
  final int projectId;
  final String date; // ISO date string: "YYYY-MM-DD"
  const LoadLaborPresence({required this.projectId, required this.date});
  @override
  List<Object?> get props => [projectId, date];
}

/// Update the count (and optional contractor name) for a single category row.
/// This is a local-state-only operation — no API call until [SaveLaborPresence].
class UpdateLaborEntry extends LaborEvent {
  final int categoryId;
  final int count;
  final String? contractorName;
  const UpdateLaborEntry({
    required this.categoryId,
    required this.count,
    this.contractorName,
  });
  @override
  List<Object?> get props => [categoryId, count];
}

/// Save the current presence data to the server.
/// Only rows with count > 0 are submitted to avoid creating empty records.
class SaveLaborPresence extends LaborEvent {
  final int projectId;
  final String date; // ISO date string: "YYYY-MM-DD"
  const SaveLaborPresence({required this.projectId, required this.date});
  @override
  List<Object?> get props => [projectId, date];
}

// ═══════════════════════════════════════════ STATES ══════════════════════════

/// Base class for all labor states.
abstract class LaborState extends Equatable {
  const LaborState();
  @override
  List<Object?> get props => [];
}

class LaborInitial extends LaborState {}

/// Full-screen loading spinner while categories and presence are being fetched.
class LaborLoading extends LaborState {}

/// The presence list is loaded and ready for editing.
///
/// [totalWorkers] is the running sum of all category counts —
/// recomputed on every [UpdateLaborEntry] so the header badge stays live.
class LaborLoaded extends LaborState {
  final List<DailyLaborEntry> entries;
  final int totalWorkers;

  const LaborLoaded({required this.entries, required this.totalWorkers});

  /// Returns a new [LaborLoaded] with [updated] replacing the matching entry.
  /// Also recalculates [totalWorkers] from the new list.
  LaborLoaded copyWithEntry(DailyLaborEntry updated) {
    final list = entries
        .map((e) => e.categoryId == updated.categoryId ? updated : e)
        .toList();
    return LaborLoaded(
      entries: list,
      // Recompute total from scratch to stay accurate after any edit.
      totalWorkers: list.fold(0, (sum, e) => sum + e.count),
    );
  }

  @override
  List<Object?> get props => [entries, totalWorkers];
}

/// An error occurred while loading.
class LaborError extends LaborState {
  final String message;
  const LaborError(this.message);
  @override
  List<Object?> get props => [message];
}

/// In-flight save — shows a loading indicator while keeping the filled-in
/// list visible (so the UI doesn't blank out during the API call).
class LaborSaving extends LaborState {
  final List<DailyLaborEntry> entries;
  final int totalWorkers;
  const LaborSaving({required this.entries, required this.totalWorkers});
}

/// Save completed — [savedCount] is the number of non-zero rows persisted.
class LaborSaveSuccess extends LaborState {
  final int savedCount;
  const LaborSaveSuccess(this.savedCount);
  @override
  List<Object?> get props => [savedCount];
}

/// Save failed — displayed as an inline error below the Save button.
class LaborSaveError extends LaborState {
  final String message;
  const LaborSaveError(this.message);
  @override
  List<Object?> get props => [message];
}

// ═══════════════════════════════════════════ BLOC ════════════════════════════

/// Manages daily labor presence (headcount) tracking.
///
/// Workflow:
///   1. [LoadLaborPresence] → fetch categories + existing date-specific records.
///   2. Merge: one [DailyLaborEntry] per category, pre-filled if a record exists.
///   3. [UpdateLaborEntry] → update a row's count locally (no API call).
///   4. [SaveLaborPresence] → filter count > 0 rows and POST to the server.
class LaborBloc extends Bloc<LaborEvent, LaborState> {
  final SetuApiClient _api;

  LaborBloc({required SetuApiClient apiClient})
      : _api = apiClient,
        super(LaborInitial()) {
    on<LoadLaborPresence>(_onLoad);
    on<UpdateLaborEntry>(_onUpdate);
    on<SaveLaborPresence>(_onSave);
  }

  /// Fetches labor categories and existing presence records for the given date,
  /// then merges them into a single list so the UI shows one row per category.
  ///
  /// Merge strategy:
  ///   - For each category, look for an existing presence record.
  ///   - If found → use the server record (pre-fills the count field).
  ///   - If not found → create a zeroed-out entry (count = 0).
  Future<void> _onLoad(
    LoadLaborPresence event,
    Emitter<LaborState> emit,
  ) async {
    emit(LaborLoading());
    try {
      // Load categories (with project-specific ones included by the API)
      final catRaw = await _api.getLaborCategories(projectId: event.projectId);
      final categories =
          catRaw.map((e) => LaborCategory.fromJson(e as Map<String, dynamic>)).toList();

      // Load existing entries for the date (may be empty for a new day)
      final presenceRaw = await _api.getLaborPresence(
        projectId: event.projectId,
        date: event.date,
      );
      final existing = presenceRaw
          .map((e) => DailyLaborEntry.fromJson(e as Map<String, dynamic>))
          .toList();

      // Build entries list — one row per category, pre-filled if data exists.
      // Categories without an existing record get count=0 as a placeholder.
      final entries = categories.map((cat) {
        final found = existing.where((e) => e.categoryId == cat.id).firstOrNull;
        return found ??
            DailyLaborEntry(
              categoryId: cat.id,
              categoryName: cat.name,
              count: 0,
            );
      }).toList();

      emit(LaborLoaded(
        entries: entries,
        totalWorkers: entries.fold(0, (sum, e) => sum + e.count),
      ));
    } catch (e) {
      emit(LaborError('Failed to load labor data. $e'));
    }
  }

  /// Updates a single entry's count in local state.
  ///
  /// This is a synchronous operation — no API call is made here.
  /// The BLoC rebuilds the full list and recalculates [totalWorkers].
  void _onUpdate(UpdateLaborEntry event, Emitter<LaborState> emit) {
    final current = state;
    // Guard: can only update when the list is loaded.
    if (current is! LaborLoaded) return;
    final updated = current.entries
        .map((e) => e.categoryId == event.categoryId
            ? e.copyWith(
                count: event.count,
                contractorName: event.contractorName,
              )
            : e)
        .toList();
    emit(LaborLoaded(
      entries: updated,
      // Recompute total — single fold is cheap and keeps the badge accurate.
      totalWorkers: updated.fold(0, (sum, e) => sum + e.count),
    ));
  }

  /// Saves the current presence data to the server.
  ///
  /// Only entries with count > 0 are sent — zero-count rows are explicitly
  /// excluded to avoid polluting the server with empty records.
  /// If all rows are zero, an early error is emitted to guide the user.
  Future<void> _onSave(
    SaveLaborPresence event,
    Emitter<LaborState> emit,
  ) async {
    final current = state;
    if (current is! LaborLoaded) return;

    // Only save entries with count > 0
    final toSave = current.entries.where((e) => e.count > 0).toList();
    if (toSave.isEmpty) {
      // Explicit validation — inform the user before making a pointless API call.
      emit(const LaborSaveError('No workers to save. Enter at least one count.'));
      return;
    }

    // Emit saving state (keeps the list visible while the spinner shows).
    emit(LaborSaving(
        entries: current.entries, totalWorkers: current.totalWorkers));
    try {
      // [DailyLaborEntry.toJson] serialises the entry with the given date string.
      final payload = toSave.map((e) => e.toJson(event.date)).toList();
      await _api.saveLaborPresence(
        projectId: event.projectId,
        entries: payload,
      );
      emit(LaborSaveSuccess(toSave.length));
    } catch (e) {
      emit(LaborSaveError('Failed to save. $e'));
    }
  }
}
