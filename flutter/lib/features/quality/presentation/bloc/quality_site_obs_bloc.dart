import 'dart:convert';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ═══════════════════════════════════════════ EVENTS ══════════════════════════

/// Base class for all quality site observation events.
abstract class QualitySiteObsEvent extends Equatable {
  const QualitySiteObsEvent();
  @override
  List<Object?> get props => [];
}

/// Initial load of the site observation list.
/// Resets pagination and fetches from offset 0.
class LoadQualitySiteObs extends QualitySiteObsEvent {
  final int projectId;
  final String? statusFilter; // 'OPEN' | 'RECTIFIED' | 'CLOSED' | null = all
  final String? severityFilter;

  const LoadQualitySiteObs({
    required this.projectId,
    this.statusFilter,
    this.severityFilter,
  });

  @override
  List<Object?> get props => [projectId, statusFilter, severityFilter];
}

/// Pull-to-refresh — same as Load but shows a shimmer over the existing list.
class RefreshQualitySiteObs extends QualitySiteObsEvent {
  final int projectId;
  final String? statusFilter;
  final String? severityFilter;

  const RefreshQualitySiteObs({
    required this.projectId,
    this.statusFilter,
    this.severityFilter,
  });

  @override
  List<Object?> get props => [projectId, statusFilter, severityFilter];
}

/// Create a new site-level quality observation (not linked to any activity).
class CreateQualitySiteObs extends QualitySiteObsEvent {
  final int projectId;
  final int? epsNodeId;
  final String description;
  final String severity;
  final String? category;
  final String? locationLabel;
  final List<String> photoUrls;

  const CreateQualitySiteObs({
    required this.projectId,
    this.epsNodeId,
    required this.description,
    required this.severity,
    this.category,
    this.locationLabel,
    this.photoUrls = const [],
  });

  @override
  List<Object?> get props => [projectId, description, severity];
}

/// Submit a rectification for an existing open observation.
class RectifyQualitySiteObs extends QualitySiteObsEvent {
  final String id;
  final String notes;
  final List<String> photoUrls;

  const RectifyQualitySiteObs({
    required this.id,
    required this.notes,
    this.photoUrls = const [],
  });

  @override
  List<Object?> get props => [id, notes];
}

/// Close an observation after the QC inspector reviews the rectification.
class CloseQualitySiteObs extends QualitySiteObsEvent {
  final String id;
  final String? closureNotes;

  const CloseQualitySiteObs({required this.id, this.closureNotes});

  @override
  List<Object?> get props => [id];
}

/// Hard-delete an observation (direct API call — not queued).
class DeleteQualitySiteObs extends QualitySiteObsEvent {
  final String id;

  const DeleteQualitySiteObs({required this.id});

  @override
  List<Object?> get props => [id];
}

/// Load the next page of results (infinite scroll).
class LoadMoreQualitySiteObs extends QualitySiteObsEvent {
  const LoadMoreQualitySiteObs();
}

// ═══════════════════════════════════════════ STATES ══════════════════════════

/// Base class for all quality site observation states.
abstract class QualitySiteObsState extends Equatable {
  const QualitySiteObsState();
  @override
  List<Object?> get props => [];
}

class QualitySiteObsInitial extends QualitySiteObsState {}

/// Loading indicator.
/// [isRefresh] = true → the list is already visible, show a shimmer.
/// [isRefresh] = false → full-screen spinner (initial load).
class QualitySiteObsLoading extends QualitySiteObsState {
  /// When true, we are refreshing (list already visible — show shimmer)
  final bool isRefresh;
  const QualitySiteObsLoading({this.isRefresh = false});
  @override
  List<Object?> get props => [isRefresh];
}

/// The observation list is visible.
///
/// [fromCache] = true means we are showing offline data.
/// [cacheAge] is set when [fromCache] is true — the UI uses this to warn the
/// user when the cached data is older than 4 hours.
/// [hasMore] = true means there are more pages to load.
/// [isLoadingMore] = true means a load-more request is in flight.
class QualitySiteObsLoaded extends QualitySiteObsState {
  final List<QualitySiteObservation> observations;
  final String? appliedStatusFilter;
  final String? appliedSeverityFilter;
  final bool fromCache;
  final DateTime? cacheAge;
  final bool hasMore;
  final bool isLoadingMore;

  const QualitySiteObsLoaded({
    required this.observations,
    this.appliedStatusFilter,
    this.appliedSeverityFilter,
    this.fromCache = false,
    this.cacheAge,
    this.hasMore = false,
    this.isLoadingMore = false,
  });

  QualitySiteObsLoaded copyWith({
    List<QualitySiteObservation>? observations,
    bool? hasMore,
    bool? isLoadingMore,
    bool? fromCache,
  }) {
    return QualitySiteObsLoaded(
      observations: observations ?? this.observations,
      appliedStatusFilter: appliedStatusFilter,
      appliedSeverityFilter: appliedSeverityFilter,
      fromCache: fromCache ?? this.fromCache,
      cacheAge: cacheAge,
      hasMore: hasMore ?? this.hasMore,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    );
  }

  @override
  List<Object?> get props => [
        observations,
        appliedStatusFilter,
        appliedSeverityFilter,
        fromCache,
        cacheAge,
        hasMore,
        isLoadingMore,
      ];
}

/// A fetch failed — displayed as an error banner.
class QualitySiteObsError extends QualitySiteObsState {
  final String message;
  const QualitySiteObsError(this.message);
  @override
  List<Object?> get props => [message];
}

/// A create / rectify / close / delete action completed.
/// [action] is one of: 'created' | 'created_offline' | 'rectified' |
/// 'rectified_offline' | 'closed' | 'closed_offline' | 'deleted'.
/// Widgets listen for this state to pop the form and refresh the list.
class QualitySiteObsActionSuccess extends QualitySiteObsState {
  /// 'created' | 'rectified' | 'closed' | 'deleted'
  final String action;
  const QualitySiteObsActionSuccess(this.action);
  @override
  List<Object?> get props => [action];
}

/// A create / rectify / close action failed.
class QualitySiteObsActionError extends QualitySiteObsState {
  final String message;
  const QualitySiteObsActionError(this.message);
  @override
  List<Object?> get props => [message];
}

// ═══════════════════════════════════════════ BLOC ════════════════════════════

/// Manages site-level quality observations (not tied to a specific activity).
///
/// Supports:
///   - Paginated list loading (25 per page)
///   - Offline-first create/rectify/close via sync queue
///   - Hard-delete via direct API call
///   - Cache fallback: unfiltered page-0 results are written to Drift
///     so the list is available offline.
class QualitySiteObsBloc
    extends Bloc<QualitySiteObsEvent, QualitySiteObsState> {
  final SetuApiClient _api;
  final AppDatabase _db;
  final SyncService _syncService;

  /// Number of observations per API page.
  static const _pageLimit = 25;

  // Pagination state — must be reset on each fresh load/refresh.
  int _nextOffset = 0;
  int? _lastProjectId;
  String? _lastStatusFilter;
  String? _lastSeverityFilter;

  QualitySiteObsBloc({
    required SetuApiClient apiClient,
    required AppDatabase database,
    required SyncService syncService,
  })  : _api = apiClient,
        _db = database,
        _syncService = syncService,
        super(QualitySiteObsInitial()) {
    on<LoadQualitySiteObs>(_onLoad);
    on<RefreshQualitySiteObs>(_onRefresh);
    on<LoadMoreQualitySiteObs>(_onLoadMore);
    on<CreateQualitySiteObs>(_onCreate);
    on<RectifyQualitySiteObs>(_onRectify);
    on<CloseQualitySiteObs>(_onClose);
    on<DeleteQualitySiteObs>(_onDelete);
  }

  /// Initial load — resets pagination context and delegates to [_fetch].
  Future<void> _onLoad(
    LoadQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    _nextOffset = 0;
    _lastProjectId = event.projectId;
    _lastStatusFilter = event.statusFilter;
    _lastSeverityFilter = event.severityFilter;
    emit(const QualitySiteObsLoading());
    await _fetch(event.projectId, event.statusFilter, event.severityFilter,
        emit, offset: 0, existing: []);
  }

  /// Refresh — resets pagination and shows shimmer over existing data.
  Future<void> _onRefresh(
    RefreshQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    _nextOffset = 0;
    _lastProjectId = event.projectId;
    _lastStatusFilter = event.statusFilter;
    _lastSeverityFilter = event.severityFilter;
    emit(const QualitySiteObsLoading(isRefresh: true));
    await _fetch(event.projectId, event.statusFilter, event.severityFilter,
        emit, offset: 0, existing: []);
  }

  /// Load-more (infinite scroll) — appends to the existing list.
  /// Guards against duplicate calls while a load-more is in flight.
  Future<void> _onLoadMore(
    LoadMoreQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    final current = state;
    if (current is! QualitySiteObsLoaded) return;
    // Don't fire if we know there are no more pages, or if already loading.
    if (!current.hasMore || current.isLoadingMore) return;
    if (_lastProjectId == null) return;

    emit(current.copyWith(isLoadingMore: true));
    await _fetch(
      _lastProjectId!,
      _lastStatusFilter,
      _lastSeverityFilter,
      emit,
      offset: _nextOffset,
      existing: current.observations,
    );
  }

  /// Core fetch method shared by load, refresh, and load-more.
  ///
  /// Caching strategy:
  ///   - Only the unfiltered (no status/severity filter) page-0 result is
  ///     written to Drift. Filtered views are never cached because they are
  ///     smaller subsets that would not cover the full offline list.
  ///
  /// Fallback:
  ///   - On network failure for page 0 → serve from cache.
  ///   - On network failure for page > 0 → keep existing list, disable hasMore.
  Future<void> _fetch(
    int projectId,
    String? statusFilter,
    String? severityFilter,
    Emitter<QualitySiteObsState> emit, {
    required int offset,
    required List<QualitySiteObservation> existing,
  }) async {
    try {
      final raw = await _api.getQualitySiteObs(
        projectId: projectId,
        status: statusFilter,
        severity: severityFilter,
        limit: _pageLimit,
        offset: offset,
      );
      final rawList = raw.map((e) => e as Map<String, dynamic>).toList();

      // Only cache unfiltered page-0 results to keep offline data comprehensive.
      if (statusFilter == null && severityFilter == null && offset == 0) {
        await _db.cacheQualitySiteObs(rawList, projectId);
      }
      final newObs = rawList.map(QualitySiteObservation.fromJson).toList();
      final all = [...existing, ...newObs];
      // Advance the offset cursor for the next load-more call.
      _nextOffset = offset + newObs.length;
      emit(QualitySiteObsLoaded(
        observations: all,
        appliedStatusFilter: statusFilter,
        appliedSeverityFilter: severityFilter,
        // If we received a full page, there may be more data available.
        hasMore: newObs.length == _pageLimit,
      ));
    } catch (_) {
      if (offset > 0) {
        // Load-more failure — keep the existing list intact, just disable paging.
        final current = state;
        if (current is QualitySiteObsLoaded) {
          emit(current.copyWith(hasMore: false, isLoadingMore: false));
        }
        return;
      }
      // Page-0 failure — try the local cache.
      try {
        final cached = await _db.getCachedQualitySiteObs(projectId, statusFilter);
        final obs = cached
            .map((r) => QualitySiteObservation.fromJson(
                jsonDecode(r.rawData) as Map<String, dynamic>))
            .toList();
        // Use the oldest cachedAt across rows so the staleness indicator
        // reflects the age of the least-fresh item in the list.
        final oldest = cached.isEmpty
            ? null
            : cached.map((r) => r.cachedAt).reduce(
                (a, b) => a.isBefore(b) ? a : b);
        emit(QualitySiteObsLoaded(
          observations: obs,
          appliedStatusFilter: statusFilter,
          appliedSeverityFilter: severityFilter,
          fromCache: true,
          cacheAge: oldest,
          hasMore: false,
        ));
      } catch (cacheErr) {
        emit(QualitySiteObsError('Failed to load observations. No cached data available.'));
      }
    }
  }

  /// Creates a new site observation via the sync queue (offline-first).
  ///
  /// An optimistic placeholder row (`local_<timestamp>`) is inserted into the
  /// Drift cache immediately so the observation appears in the list right away
  /// even when offline. The `local_` prefix acts as a "pending upload" marker
  /// that the UI uses to show a badge. The row is replaced by the real server
  /// copy the next time `cacheQualitySiteObs` is called after a successful sync.
  Future<void> _onCreate(
    CreateQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    try {
      final payload = {
        'projectId': event.projectId,
        if (event.epsNodeId != null) 'epsNodeId': event.epsNodeId,
        'description': event.description,
        'severity': event.severity,
        if (event.category != null) 'category': event.category,
        if (event.locationLabel != null) 'locationLabel': event.locationLabel,
        if (event.photoUrls.isNotEmpty) 'photoUrls': event.photoUrls,
      };
      await _syncService.addToQueue(
        entityType: 'quality_site_obs_create',
        entityId: event.projectId,
        operation: 'create',
        payload: payload,
        priority: 2,
      );

      // Optimistic insert — visible immediately in the list.
      final localId = 'local_${DateTime.now().millisecondsSinceEpoch}';
      await _db.cacheQualitySiteObs([
        {
          ...payload,
          'id': localId,
          'status': 'OPEN',
          'createdAt': DateTime.now().toIso8601String(),
        }
      ], event.projectId);

      final syncResult = await _syncService.syncAll();
      // Suffix '_offline' tells the UI to show "Saved — will sync when online".
      emit(QualitySiteObsActionSuccess(
          syncResult.success ? 'created' : 'created_offline'));
    } catch (e) {
      emit(QualitySiteObsActionError('Failed to raise observation. $e'));
    }
  }

  /// Submits a rectification via the sync queue.
  Future<void> _onRectify(
    RectifyQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    try {
      await _syncService.addToQueue(
        entityType: 'quality_site_obs_rectify',
        entityId: 0, // entityId is the string UUID — use 0 as placeholder int
        operation: 'update',
        payload: {
          'id': event.id,
          'notes': event.notes,
          if (event.photoUrls.isNotEmpty) 'photoUrls': event.photoUrls,
        },
        priority: 2,
      );
      final syncResult = await _syncService.syncAll();
      emit(QualitySiteObsActionSuccess(
          syncResult.success ? 'rectified' : 'rectified_offline'));
    } catch (e) {
      emit(QualitySiteObsActionError('Failed to submit rectification. $e'));
    }
  }

  /// Closes an observation via the sync queue.
  Future<void> _onClose(
    CloseQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    try {
      await _syncService.addToQueue(
        entityType: 'quality_site_obs_close',
        entityId: 0, // entityId is the string UUID — use 0 as placeholder int
        operation: 'update',
        payload: {
          'id': event.id,
          if (event.closureNotes != null) 'closureNotes': event.closureNotes,
        },
        priority: 2,
      );
      final syncResult = await _syncService.syncAll();
      emit(QualitySiteObsActionSuccess(
          syncResult.success ? 'closed' : 'closed_offline'));
    } catch (e) {
      emit(QualitySiteObsActionError('Failed to close observation. $e'));
    }
  }

  /// Hard-deletes an observation via direct API call (no offline queue).
  /// Delete is not retried offline because a missing record on the server
  /// is not harmful — unlike a create or update.
  Future<void> _onDelete(
    DeleteQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    try {
      await _api.deleteQualitySiteObs(id: event.id);
      emit(const QualitySiteObsActionSuccess('deleted'));
    } catch (e) {
      emit(QualitySiteObsActionError('Failed to delete observation. $e'));
    }
  }
}
