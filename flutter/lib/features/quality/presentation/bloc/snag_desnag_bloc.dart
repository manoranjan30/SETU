import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/api_exceptions.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/data/models/snag_desnag_models.dart';

// ==================== EVENTS ====================

abstract class SnagDesnagEvent extends Equatable {
  const SnagDesnagEvent();
  @override
  List<Object?> get props => [];
}

/// Loads the project's configured process steps and every unit's
/// snag/desnag status — the two calls the Dashboard and Unit Explorer both
/// need. Both endpoints are cheap (one row per step/unit, no item-level
/// detail), unlike opening an individual unit's workspace.
class LoadSnagOverview extends SnagDesnagEvent {
  final int projectId;
  const LoadSnagOverview(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

/// Opens a single unit's snag list detail — used by the Unit Workspace.
/// Also the entry point that lets the mutating events below know which
/// project/unit to refresh after a successful action.
///
/// [snagListId] must be passed whenever the caller already knows it (from
/// [SnagUnitSummary.snagListId], e.g. navigating from the Unit Explorer) —
/// when present, this does a plain read (`GET lists/:listId`) and nothing
/// is created. When null (the unit has never been started), this does
/// **not** call the create-or-get endpoint either — per backend guidance,
/// simply opening/viewing a unit must never silently create its snag list
/// as a side effect. Instead [SnagUnitNotStarted] is emitted, and creation
/// only happens if the user explicitly dispatches [MarkSnagUnitReadyEvent].
class OpenSnagUnit extends SnagDesnagEvent {
  final int projectId;
  final int qualityUnitId;
  final int? epsNodeId;
  final int? snagListId;
  const OpenSnagUnit(this.projectId, this.qualityUnitId, {this.epsNodeId, this.snagListId});
  @override
  List<Object?> get props => [projectId, qualityUnitId, epsNodeId, snagListId];
}

/// Explicit "Mark Ready for Snagging" action for a unit's *very first*
/// readiness, where no snag list exists yet. Gated client-side on
/// `QUALITY.SNAG.CREATE` (`PermissionService.canCreateSnag`), matching the
/// backend's `@Permissions('QUALITY.SNAG.CREATE')` on `POST :projectId/lists`.
///
/// Not for starting the *next* configured cycle after a `released` unit —
/// that's [MarkNextSnagCycleReadyEvent], a different endpoint per the
/// July 2026 handoff (`POST .../lists` is documented as first-time-only;
/// reusing it for the next cycle would incorrectly try to create a second
/// list row for the same unit).
class MarkSnagUnitReadyEvent extends SnagDesnagEvent {
  final int projectId;
  final int qualityUnitId;
  final int? epsNodeId;
  const MarkSnagUnitReadyEvent(this.projectId, this.qualityUnitId, {this.epsNodeId});
  @override
  List<Object?> get props => [projectId, qualityUnitId, epsNodeId];
}

/// Maker action to start the next configured snag cycle once a unit is
/// `released` (its current cycle was finally closed but more cycles remain
/// per the project's configured process steps). Calls
/// `POST .../lists/:listId/mark-current-round-ready`, distinct from
/// [MarkSnagUnitReadyEvent]'s first-time `POST .../lists`. Gated on the
/// same `QUALITY.SNAG.CREATE` permission — verified against
/// `snag.controller.ts:markCurrentRoundReady`.
class MarkNextSnagCycleReadyEvent extends SnagDesnagEvent {
  final int projectId;
  final int listId;
  const MarkNextSnagCycleReadyEvent(this.projectId, this.listId);
  @override
  List<Object?> get props => [projectId, listId];
}

/// Raises a new snag point against the currently-open unit/round. Routed
/// through the bloc (rather than [SnagRaiseFlowPage] calling
/// [SetuApiClient] directly) so it can share [_runMutation]'s offline
/// fallback — see that method's doc comment.
class RaiseSnagItemEvent extends SnagDesnagEvent {
  final int? qualityRoomId;
  final String? roomLabel;
  final String defectTitle;
  final String? defectDescription;
  final String? trade;
  final String priority;
  final String? linkedChecklistItemId;
  final List<String> beforePhotoUrls;
  const RaiseSnagItemEvent({
    this.qualityRoomId,
    this.roomLabel,
    required this.defectTitle,
    this.defectDescription,
    this.trade,
    this.priority = 'medium',
    this.linkedChecklistItemId,
    this.beforePhotoUrls = const [],
  });
  @override
  List<Object?> get props =>
      [qualityRoomId, roomLabel, defectTitle, defectDescription, trade, priority, linkedChecklistItemId, beforePhotoUrls];
}

class RectifySnagItemEvent extends SnagDesnagEvent {
  final int itemId;
  final List<String> afterPhotoUrls;
  final String? rectificationNotes;
  const RectifySnagItemEvent(this.itemId, {this.afterPhotoUrls = const [], this.rectificationNotes});
  @override
  List<Object?> get props => [itemId, afterPhotoUrls, rectificationNotes];
}

class BulkRectifySnagItemsEvent extends SnagDesnagEvent {
  final int roundNumber;
  final List<int> itemIds;
  final List<String> afterPhotoUrls;
  final String? rectificationNotes;
  const BulkRectifySnagItemsEvent(this.roundNumber, this.itemIds, {this.afterPhotoUrls = const [], this.rectificationNotes});
  @override
  List<Object?> get props => [roundNumber, itemIds, afterPhotoUrls, rectificationNotes];
}

class CloseSnagItemEvent extends SnagDesnagEvent {
  final int itemId;
  final String? remarks;
  final List<String>? closurePhotoUrls;
  const CloseSnagItemEvent(this.itemId, {this.remarks, this.closurePhotoUrls});
  @override
  List<Object?> get props => [itemId, remarks, closurePhotoUrls];
}

class BulkCloseSnagItemsEvent extends SnagDesnagEvent {
  final int roundNumber;
  final List<int> itemIds;
  final String? remarks;
  final List<String>? closurePhotoUrls;
  const BulkCloseSnagItemsEvent(this.roundNumber, this.itemIds, {this.remarks, this.closurePhotoUrls});
  @override
  List<Object?> get props => [roundNumber, itemIds, remarks, closurePhotoUrls];
}

class HoldSnagItemEvent extends SnagDesnagEvent {
  final int itemId;
  final String holdReason;
  const HoldSnagItemEvent(this.itemId, this.holdReason);
  @override
  List<Object?> get props => [itemId, holdReason];
}

class SubmitSnagPhaseEvent extends SnagDesnagEvent {
  final int roundId;
  final String? comments;
  const SubmitSnagPhaseEvent(this.roundId, {this.comments});
  @override
  List<Object?> get props => [roundId, comments];
}

class SubmitDesnagReleaseEvent extends SnagDesnagEvent {
  final int roundId;
  final String? comments;
  const SubmitDesnagReleaseEvent(this.roundId, {this.comments});
  @override
  List<Object?> get props => [roundId, comments];
}

/// [action] is `'APPROVE'` or `'REJECT'`. Eligibility is decided by the
/// backend's release strategy, never locally — a 403/400 here surfaces the
/// backend's own message (see [SnagDesnagBloc._friendlyError]).
class AdvanceSnagApprovalEvent extends SnagDesnagEvent {
  final int approvalId;
  final String action;
  final String? comments;
  const AdvanceSnagApprovalEvent(this.approvalId, {required this.action, this.comments});
  @override
  List<Object?> get props => [approvalId, action, comments];
}

/// Checker sends a rectified item back to `open` with remarks — the
/// backend increments `notSatisfactoryCount` and stores the rejection.
class RejectRectificationEvent extends SnagDesnagEvent {
  final int itemId;
  final String? remarks;
  const RejectRectificationEvent(this.itemId, {this.remarks});
  @override
  List<Object?> get props => [itemId, remarks];
}

/// Checker's final sign-off gate for a round — stricter than
/// [SubmitDesnagReleaseEvent]/[AdvanceSnagApprovalEvent]: the backend
/// requires every item in the round to be exactly `closed` first (see
/// [SnagRound.allItemsClosed]). Moves the unit to the next configured
/// cycle, or to `handover_ready` if this was the last one.
class FinalClosureEvent extends SnagDesnagEvent {
  final int roundId;
  final String? remarks;
  final String? signatureData;
  const FinalClosureEvent(this.roundId, {this.remarks, this.signatureData});
  @override
  List<Object?> get props => [roundId, remarks, signatureData];
}

/// Checker reverts a ready-for-snag unit with zero raised points back to
/// unready — deletes the underlying list row (`resetReadyForSnag`), so
/// unlike the other mutating events there's nothing left to refetch
/// afterward; see [SnagUnitWasReset].
class ResetSnagReadyEvent extends SnagDesnagEvent {
  const ResetSnagReadyEvent();
}

/// Project-wide aggregation for the Dashboard — separate from
/// [LoadSnagOverview] since it hits its own endpoint
/// (`GET /snag/:projectId/analytics`).
class LoadSnagAnalytics extends SnagDesnagEvent {
  final int projectId;
  const LoadSnagAnalytics(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

// ==================== STATES ====================

abstract class SnagDesnagState extends Equatable {
  const SnagDesnagState();
  @override
  List<Object?> get props => [];
}

class SnagDesnagInitial extends SnagDesnagState {
  const SnagDesnagInitial();
}

class SnagDesnagLoading extends SnagDesnagState {
  const SnagDesnagLoading();
}

class SnagDesnagOverviewLoaded extends SnagDesnagState {
  final List<SnagProcessStep> processSteps;
  final List<SnagUnitSummary> units;

  const SnagDesnagOverviewLoaded({
    required this.processSteps,
    required this.units,
  });

  @override
  List<Object?> get props => [processSteps, units];
}

/// A unit was opened with no existing snag list ([OpenSnagUnit.snagListId]
/// was null) — nothing was created. The workspace should show a "Not
/// Started" screen offering [MarkSnagUnitReadyEvent] as the only way
/// forward, rather than any snag detail.
class SnagUnitNotStarted extends SnagDesnagState {
  final int projectId;
  final int qualityUnitId;
  final int? epsNodeId;
  const SnagUnitNotStarted(this.projectId, this.qualityUnitId, {this.epsNodeId});
  @override
  List<Object?> get props => [projectId, qualityUnitId, epsNodeId];
}

class SnagUnitDetailLoaded extends SnagDesnagState {
  final SnagList list;
  const SnagUnitDetailLoaded(this.list);
  @override
  List<Object?> get props => [list];
}

/// Mutating action in flight — keeps the current list visible (unlike
/// [SnagDesnagLoading], which blanks the screen) so the workspace doesn't
/// flash back to a spinner every time the user rectifies/closes an item.
class SnagUnitActionInProgress extends SnagDesnagState {
  final SnagList list;
  const SnagUnitActionInProgress(this.list);
  @override
  List<Object?> get props => [list];
}

class SnagActionSuccess extends SnagDesnagState {
  final String message;
  final SnagList list;
  const SnagActionSuccess({required this.message, required this.list});
  @override
  List<Object?> get props => [message, list];
}

/// Terminal state after a successful [ResetSnagReadyEvent] — the list row
/// is gone, so there's nothing left to display; the workspace page should
/// pop back to wherever it was opened from.
class SnagUnitWasReset extends SnagDesnagState {
  const SnagUnitWasReset();
}

class SnagAnalyticsLoaded extends SnagDesnagState {
  final SnagAnalytics analytics;
  const SnagAnalyticsLoaded(this.analytics);
  @override
  List<Object?> get props => [analytics];
}

class SnagDesnagError extends SnagDesnagState {
  final String message;
  const SnagDesnagError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class SnagDesnagBloc extends Bloc<SnagDesnagEvent, SnagDesnagState> {
  final SetuApiClient _api;
  final SyncService _syncService;

  SnagDesnagBloc({required SetuApiClient apiClient, required SyncService syncService})
      : _api = apiClient,
        _syncService = syncService,
        super(const SnagDesnagInitial()) {
    on<LoadSnagOverview>(_onLoadOverview);
    on<OpenSnagUnit>(_onOpenUnit);
    on<MarkSnagUnitReadyEvent>(_onMarkReady);
    on<MarkNextSnagCycleReadyEvent>(_onMarkNextCycleReady);
    on<RaiseSnagItemEvent>(_onRaiseItem);
    on<RectifySnagItemEvent>(_onRectifyItem);
    on<BulkRectifySnagItemsEvent>(_onBulkRectifyItems);
    on<CloseSnagItemEvent>(_onCloseItem);
    on<BulkCloseSnagItemsEvent>(_onBulkCloseItems);
    on<HoldSnagItemEvent>(_onHoldItem);
    on<SubmitSnagPhaseEvent>(_onSubmitSnagPhase);
    on<SubmitDesnagReleaseEvent>(_onSubmitDesnagRelease);
    on<AdvanceSnagApprovalEvent>(_onAdvanceApproval);
    on<RejectRectificationEvent>(_onRejectRectification);
    on<FinalClosureEvent>(_onFinalClosure);
    on<ResetSnagReadyEvent>(_onResetReady);
    on<LoadSnagAnalytics>(_onLoadAnalytics);
  }

  // Tracks which unit is currently open so mutating events (which only take
  // an itemId/roundId, matching their REST endpoints) know what to refresh
  // and re-emit afterward without the UI having to pass projectId/listId
  // through every single action call.
  int? _projectId;
  SnagList? _currentList;

  Future<void> _onLoadOverview(
    LoadSnagOverview event,
    Emitter<SnagDesnagState> emit,
  ) async {
    emit(const SnagDesnagLoading());
    try {
      final results = await Future.wait([
        _api.getSnagProcessSteps(event.projectId),
        _api.getSnagUnits(event.projectId),
      ]);
      final processSteps = (results[0])
          .whereType<Map<String, dynamic>>()
          .map(SnagProcessStep.fromJson)
          .where((s) => s.isActive)
          .toList()
        ..sort((a, b) => a.workflowSerialNo.compareTo(b.workflowSerialNo));
      final units = (results[1])
          .whereType<Map<String, dynamic>>()
          .map(SnagUnitSummary.fromJson)
          .toList();
      emit(SnagDesnagOverviewLoaded(processSteps: processSteps, units: units));
    } catch (e) {
      emit(SnagDesnagError(_friendlyError(e)));
    }
  }

  Future<void> _onOpenUnit(
    OpenSnagUnit event,
    Emitter<SnagDesnagState> emit,
  ) async {
    emit(const SnagDesnagLoading());
    _projectId = event.projectId;

    if (event.snagListId == null) {
      // No list exists for this unit yet. Do not call the create-or-get
      // endpoint just because the user opened/viewed it — per backend
      // guidance, a plain "flat entry" navigation must not silently create
      // the snag list as a side effect. Only MarkSnagUnitReadyEvent does that.
      _currentList = null;
      emit(SnagUnitNotStarted(event.projectId, event.qualityUnitId, epsNodeId: event.epsNodeId));
      return;
    }

    try {
      final data = await _api.getSnagListDetail(event.projectId, event.snagListId!);
      final list = SnagList.fromJson(data);
      _currentList = list;
      emit(SnagUnitDetailLoaded(list));
    } catch (e) {
      emit(SnagDesnagError(_friendlyError(e)));
    }
  }

  /// Explicit "Mark Ready for Snagging" action for first-time readiness —
  /// the only path that creates a unit's snag list. See
  /// [MarkSnagUnitReadyEvent]'s doc comment.
  Future<void> _onMarkReady(
    MarkSnagUnitReadyEvent event,
    Emitter<SnagDesnagState> emit,
  ) async {
    emit(const SnagDesnagLoading());
    _projectId = event.projectId;
    try {
      final data = await _api.createOrGetSnagList(
        event.projectId,
        qualityUnitId: event.qualityUnitId,
        epsNodeId: event.epsNodeId,
      );
      final list = SnagList.fromJson(data);
      _currentList = list;
      emit(SnagUnitDetailLoaded(list));
    } catch (e) {
      emit(SnagDesnagError(_friendlyError(e)));
    }
  }

  /// Maker action to start the next configured snag cycle for a `released`
  /// unit. See [MarkNextSnagCycleReadyEvent]'s doc comment.
  Future<void> _onMarkNextCycleReady(
    MarkNextSnagCycleReadyEvent event,
    Emitter<SnagDesnagState> emit,
  ) async {
    final list = _currentList;
    if (list == null) return;
    emit(SnagUnitActionInProgress(list));
    try {
      final data = await _api.markSnagRoundReady(event.projectId, event.listId);
      final refreshed = SnagList.fromJson(data);
      _currentList = refreshed;
      emit(SnagActionSuccess(message: 'Snag ${refreshed.currentRound} started', list: refreshed));
    } catch (e) {
      emit(SnagDesnagError(_friendlyError(e)));
      if (_currentList != null) emit(SnagUnitDetailLoaded(_currentList!));
    }
  }

  /// Re-fetches the currently-open unit's detail — used after every
  /// mutating action so the UI reflects the real post-action state
  /// (updated statuses, counts, approval steps) rather than a locally
  /// guessed one. Uses the plain read endpoint (the list is guaranteed to
  /// already exist by the time this is called — every mutating event
  /// requires [_currentList] to be non-null first) rather than
  /// create-or-get, consistent with [_onOpenUnit] no longer touching that
  /// endpoint outside of [MarkSnagUnitReadyEvent].
  Future<SnagList> _refetchCurrentList() async {
    final projectId = _projectId;
    final list = _currentList;
    if (projectId == null || list == null) {
      throw StateError('No snag unit is open — call OpenSnagUnit first.');
    }
    final data = await _api.getSnagListDetail(projectId, list.id);
    final refreshed = SnagList.fromJson(data);
    _currentList = refreshed;
    return refreshed;
  }

  /// Runs a mutating [action] against [_api], then refreshes and emits the
  /// unit's current state — shared by every rectify/close/hold/submit/
  /// approval handler below so each one is just "call this endpoint."
  ///
  /// When [onOffline] is provided and [action] fails with a
  /// [NetworkException] (no connectivity, not a server-side rejection), the
  /// mutation is queued for later delivery instead of surfacing an error:
  /// [onOffline] enqueues the equivalent [SyncQueue] entry and returns an
  /// optimistically-updated [SnagList] (built in-memory — this bloc has no
  /// local cache table to persist it in, so a killed app loses the
  /// optimistic view, though the queued mutation itself survives in Drift
  /// and still syncs next launch). Handlers that pass no [onOffline]
  /// (hold/submit/approval/reject/final-closure) remain online-only, since
  /// those are checker/approval actions ordinarily done with connectivity,
  /// not on-site raise/rectify/close work.
  Future<void> _runMutation(
    Emitter<SnagDesnagState> emit,
    Future<void> Function() action,
    String successMessage, {
    Future<SnagList> Function()? onOffline,
  }) async {
    final list = _currentList;
    if (list == null) return;
    emit(SnagUnitActionInProgress(list));
    try {
      await action();
      final refreshed = await _refetchCurrentList();
      emit(SnagActionSuccess(message: successMessage, list: refreshed));
    } catch (e) {
      if (e is NetworkException && onOffline != null) {
        try {
          final queued = await onOffline();
          _currentList = queued;
          emit(SnagActionSuccess(message: 'Saved offline — will sync when back online', list: queued));
          return;
        } catch (queueError) {
          emit(SnagDesnagError(_friendlyError(queueError)));
          if (_currentList != null) emit(SnagUnitDetailLoaded(_currentList!));
          return;
        }
      }
      emit(SnagDesnagError(_friendlyError(e)));
      // Restore the last-known-good list so the workspace doesn't get
      // stuck on a bare error screen after a failed action.
      if (_currentList != null) emit(SnagUnitDetailLoaded(_currentList!));
    }
  }

  /// Returns [_currentList] with [update] applied to the round identified
  /// by [roundId] — used to optimistically insert a newly-raised item.
  SnagList _withUpdatedRound(int roundId, SnagRound Function(SnagRound) update) {
    final list = _currentList!;
    final rounds = list.rounds.map((r) => r.id == roundId ? update(r) : r).toList();
    return list.copyWith(rounds: rounds);
  }

  /// Returns [_currentList] with [update] applied to the single item whose
  /// id is [itemId], wherever it lives among the rounds.
  SnagList _updateItem(int itemId, SnagItem Function(SnagItem) update) {
    final list = _currentList!;
    final rounds = list.rounds.map((r) {
      if (!r.items.any((i) => i.id == itemId)) return r;
      return r.copyWith(items: r.items.map((i) => i.id == itemId ? update(i) : i).toList());
    }).toList();
    return list.copyWith(rounds: rounds);
  }

  /// Bulk variant of [_updateItem] — applies [update] to every item whose
  /// id is in [itemIds].
  SnagList _updateItems(List<int> itemIds, SnagItem Function(SnagItem) update) {
    final list = _currentList!;
    final idSet = itemIds.toSet();
    final rounds = list.rounds.map((r) {
      if (!r.items.any((i) => idSet.contains(i.id))) return r;
      return r.copyWith(items: r.items.map((i) => idSet.contains(i.id) ? update(i) : i).toList());
    }).toList();
    return list.copyWith(rounds: rounds);
  }

  Future<void> _onRaiseItem(RaiseSnagItemEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    final list = _currentList;
    final round = list?.activeRound;
    if (projectId == null || list == null || round == null) return;
    await _runMutation(
      emit,
      () => _api.addSnagItem(
        projectId, list.id, round.roundNumber,
        qualityRoomId: event.qualityRoomId,
        roomLabel: event.roomLabel,
        defectTitle: event.defectTitle,
        defectDescription: event.defectDescription,
        trade: event.trade,
        priority: event.priority,
        linkedChecklistItemId: event.linkedChecklistItemId,
        beforePhotoUrls: event.beforePhotoUrls,
      ),
      'Snag point raised',
      onOffline: () async {
        await _syncService.addToQueue(
          entityType: 'snag_item_raise',
          entityId: list.id,
          operation: 'create',
          payload: {
            'projectId': projectId,
            'listId': list.id,
            'roundNumber': round.roundNumber,
            if (event.qualityRoomId != null) 'qualityRoomId': event.qualityRoomId,
            if (event.roomLabel != null) 'roomLabel': event.roomLabel,
            'defectTitle': event.defectTitle,
            if (event.defectDescription != null) 'defectDescription': event.defectDescription,
            if (event.trade != null) 'trade': event.trade,
            'priority': event.priority,
            if (event.linkedChecklistItemId != null) 'linkedChecklistItemId': event.linkedChecklistItemId,
            'beforePhotoUrls': event.beforePhotoUrls,
          },
          priority: 2,
        );
        final optimisticItem = SnagItem(
          // Negative, timestamp-derived id — never collides with a real
          // (positive, DB-assigned) item id. Replaced once the queued
          // mutation lands and the unit is next re-fetched.
          id: -DateTime.now().millisecondsSinceEpoch,
          snagRoundId: round.id,
          qualityRoomId: event.qualityRoomId,
          roomLabel: event.roomLabel,
          defectTitle: event.defectTitle,
          defectDescription: event.defectDescription,
          trade: event.trade,
          priority: event.priority,
          raisedAt: DateTime.now(),
          isPendingSync: true,
        );
        return _withUpdatedRound(round.id, (r) => r.copyWith(items: [...r.items, optimisticItem]));
      },
    );
  }

  Future<void> _onRectifyItem(RectifySnagItemEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    if (projectId == null) return;
    await _runMutation(
      emit,
      () => _api.rectifySnagItem(projectId, event.itemId,
          afterPhotoUrls: event.afterPhotoUrls, rectificationNotes: event.rectificationNotes),
      'Snag point marked rectified',
      onOffline: () async {
        await _syncService.addToQueue(
          entityType: 'snag_item_rectify',
          entityId: event.itemId,
          operation: 'update',
          payload: {
            'projectId': projectId,
            'itemId': event.itemId,
            'afterPhotoUrls': event.afterPhotoUrls,
            if (event.rectificationNotes != null) 'rectificationNotes': event.rectificationNotes,
          },
          priority: 2,
        );
        return _updateItem(event.itemId, (item) => item.copyWith(
          status: SnagItemStatus.rectified,
          rectificationNotes: event.rectificationNotes,
          rectifiedAt: DateTime.now(),
          isPendingSync: true,
        ));
      },
    );
  }

  Future<void> _onBulkRectifyItems(BulkRectifySnagItemsEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    final list = _currentList;
    if (projectId == null || list == null) return;
    await _runMutation(
      emit,
      () => _api.bulkRectifySnagItems(projectId, list.id, event.roundNumber,
          itemIds: event.itemIds, afterPhotoUrls: event.afterPhotoUrls, rectificationNotes: event.rectificationNotes),
      '${event.itemIds.length} snag point${event.itemIds.length == 1 ? '' : 's'} marked rectified',
      onOffline: () async {
        await _syncService.addToQueue(
          entityType: 'snag_item_bulk_rectify',
          entityId: list.id,
          operation: 'update',
          payload: {
            'projectId': projectId,
            'listId': list.id,
            'roundNumber': event.roundNumber,
            'itemIds': event.itemIds,
            'afterPhotoUrls': event.afterPhotoUrls,
            if (event.rectificationNotes != null) 'rectificationNotes': event.rectificationNotes,
          },
          priority: 2,
        );
        return _updateItems(event.itemIds, (item) => item.copyWith(
          status: SnagItemStatus.rectified,
          rectificationNotes: event.rectificationNotes,
          rectifiedAt: DateTime.now(),
          isPendingSync: true,
        ));
      },
    );
  }

  Future<void> _onCloseItem(CloseSnagItemEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    if (projectId == null) return;
    await _runMutation(
      emit,
      () => _api.closeSnagItem(projectId, event.itemId, remarks: event.remarks, closurePhotoUrls: event.closurePhotoUrls),
      'Snag point closed',
      onOffline: () async {
        await _syncService.addToQueue(
          entityType: 'snag_item_close',
          entityId: event.itemId,
          operation: 'update',
          payload: {
            'projectId': projectId,
            'itemId': event.itemId,
            if (event.remarks != null) 'remarks': event.remarks,
            if (event.closurePhotoUrls != null) 'closurePhotoUrls': event.closurePhotoUrls,
          },
          priority: 2,
        );
        return _updateItem(event.itemId, (item) => item.copyWith(
          status: SnagItemStatus.closed,
          closureRemarks: event.remarks,
          closedAt: DateTime.now(),
          isPendingSync: true,
        ));
      },
    );
  }

  Future<void> _onBulkCloseItems(BulkCloseSnagItemsEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    final list = _currentList;
    if (projectId == null || list == null) return;
    await _runMutation(
      emit,
      () => _api.bulkCloseSnagItems(projectId, list.id, event.roundNumber,
          itemIds: event.itemIds, remarks: event.remarks, closurePhotoUrls: event.closurePhotoUrls),
      '${event.itemIds.length} snag point${event.itemIds.length == 1 ? '' : 's'} closed',
      onOffline: () async {
        await _syncService.addToQueue(
          entityType: 'snag_item_bulk_close',
          entityId: list.id,
          operation: 'update',
          payload: {
            'projectId': projectId,
            'listId': list.id,
            'roundNumber': event.roundNumber,
            'itemIds': event.itemIds,
            if (event.remarks != null) 'remarks': event.remarks,
            if (event.closurePhotoUrls != null) 'closurePhotoUrls': event.closurePhotoUrls,
          },
          priority: 2,
        );
        return _updateItems(event.itemIds, (item) => item.copyWith(
          status: SnagItemStatus.closed,
          closureRemarks: event.remarks,
          closedAt: DateTime.now(),
          isPendingSync: true,
        ));
      },
    );
  }

  Future<void> _onHoldItem(HoldSnagItemEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    if (projectId == null) return;
    await _runMutation(
      emit,
      () => _api.holdSnagItem(projectId, event.itemId, holdReason: event.holdReason),
      'Snag point put on hold',
    );
  }

  Future<void> _onSubmitSnagPhase(SubmitSnagPhaseEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    if (projectId == null) return;
    await _runMutation(
      emit,
      () => _api.submitSnagPhase(projectId, event.roundId, comments: event.comments),
      'Snag phase submitted',
    );
  }

  Future<void> _onSubmitDesnagRelease(SubmitDesnagReleaseEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    if (projectId == null) return;
    await _runMutation(
      emit,
      () => _api.submitDesnagRelease(projectId, event.roundId, comments: event.comments),
      'Submitted for desnag approval',
    );
  }

  Future<void> _onAdvanceApproval(AdvanceSnagApprovalEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    if (projectId == null) return;
    await _runMutation(
      emit,
      () => _api.advanceSnagApproval(projectId, event.approvalId, action: event.action, comments: event.comments),
      event.action == 'APPROVE' ? 'Desnag release approved' : 'Desnag release rejected',
    );
  }

  Future<void> _onRejectRectification(RejectRectificationEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    if (projectId == null) return;
    await _runMutation(
      emit,
      () => _api.rejectSnagRectification(projectId, event.itemId, remarks: event.remarks),
      'Rectification marked not satisfactory',
    );
  }

  Future<void> _onFinalClosure(FinalClosureEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    if (projectId == null) return;
    await _runMutation(
      emit,
      () => _api.finalCloseSnagRound(projectId, event.roundId, remarks: event.remarks, signatureData: event.signatureData),
      'Snag cycle finally closed',
    );
  }

  Future<void> _onResetReady(ResetSnagReadyEvent event, Emitter<SnagDesnagState> emit) async {
    final projectId = _projectId;
    final list = _currentList;
    if (projectId == null || list == null) return;
    emit(SnagUnitActionInProgress(list));
    try {
      await _api.resetSnagReady(projectId, list.id);
      // The list row is gone — refetching would just recreate it via
      // create-or-get, undoing the reset. Nothing to show; the workspace
      // page pops on this state instead.
      _currentList = null;
      emit(const SnagUnitWasReset());
    } catch (e) {
      emit(SnagDesnagError(_friendlyError(e)));
      if (_currentList != null) emit(SnagUnitDetailLoaded(_currentList!));
    }
  }

  Future<void> _onLoadAnalytics(LoadSnagAnalytics event, Emitter<SnagDesnagState> emit) async {
    emit(const SnagDesnagLoading());
    try {
      final data = await _api.getSnagAnalytics(event.projectId);
      emit(SnagAnalyticsLoaded(SnagAnalytics.fromJson(data)));
    } catch (e) {
      emit(SnagDesnagError(_friendlyError(e)));
    }
  }

  /// Prefers the backend's own error message over a generic one — release-
  /// strategy rejections and phase-state validation errors are already
  /// written for end users. Falls back to the handoff's suggested copy
  /// only when the backend gives a bare, unhelpful message.
  String _friendlyError(Object e) {
    if (e is UnauthorizedException) return 'Session expired. Please log in again.';
    if (e is NetworkException) return 'No connection. Check your network and try again.';
    if (e is ForbiddenException) {
      return e.message == 'Forbidden'
          ? 'You are not assigned to approve this desnag release.'
          : e.message;
    }
    if (e is BadRequestException) return e.message;
    return 'An error occurred. Please try again.';
  }
}
