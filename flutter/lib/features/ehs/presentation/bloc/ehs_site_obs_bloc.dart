import 'dart:convert';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';

// ═══════════════════════════════════════════ EVENTS ══════════════════════════

/// Base class for all EHS site observation events.
abstract class EhsSiteObsEvent extends Equatable {
  const EhsSiteObsEvent();
  @override
  List<Object?> get props => [];
}

/// Initial load of the EHS site observation list.
class LoadEhsSiteObs extends EhsSiteObsEvent {
  final int projectId;
  final String? statusFilter;
  final String? severityFilter;

  const LoadEhsSiteObs({
    required this.projectId,
    this.statusFilter,
    this.severityFilter,
  });

  @override
  List<Object?> get props => [projectId, statusFilter, severityFilter];
}

/// Pull-to-refresh — resets pagination and shows shimmer.
class RefreshEhsSiteObs extends EhsSiteObsEvent {
  final int projectId;
  final String? statusFilter;
  final String? severityFilter;

  const RefreshEhsSiteObs({
    required this.projectId,
    this.statusFilter,
    this.severityFilter,
  });

  @override
  List<Object?> get props => [projectId, statusFilter, severityFilter];
}

/// Create a new EHS safety observation (unsafe act / unsafe condition).
class CreateEhsSiteObs extends EhsSiteObsEvent {
  final int projectId;
  final int? epsNodeId;
  final String description;
  final String severity;
  final String? category;
  final String? locationLabel;
  final List<String> photoUrls;

  const CreateEhsSiteObs({
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

/// Submit a rectification for an open EHS observation.
class RectifyEhsSiteObs extends EhsSiteObsEvent {
  final String id;
  final String notes;
  final List<String> photoUrls;

  const RectifyEhsSiteObs({
    required this.id,
    required this.notes,
    this.photoUrls = const [],
  });

  @override
  List<Object?> get props => [id, notes];
}

/// Close an EHS observation after verifying the rectification.
class CloseEhsSiteObs extends EhsSiteObsEvent {
  final String id;
  final String? closureNotes;

  const CloseEhsSiteObs({required this.id, this.closureNotes});

  @override
  List<Object?> get props => [id];
}

/// Hard-delete an EHS observation (direct API call).
class DeleteEhsSiteObs extends EhsSiteObsEvent {
  final String id;
  const DeleteEhsSiteObs({required this.id});

  @override
  List<Object?> get props => [id];
}

/// Load the next page of EHS observations (infinite scroll).
class LoadMoreEhsSiteObs extends EhsSiteObsEvent {
  const LoadMoreEhsSiteObs();
}

// ═══════════════════════════════════════════ STATES ══════════════════════════

/// Base class for all EHS site observation states.
abstract class EhsSiteObsState extends Equatable {
  const EhsSiteObsState();
  @override
  List<Object?> get props => [];
}

class EhsSiteObsInitial extends EhsSiteObsState {}

/// Loading indicator.
/// [isRefresh] = true → shimmer over existing list.
/// [isRefresh] = false → full-screen spinner.
class EhsSiteObsLoading extends EhsSiteObsState {
  final bool isRefresh;
  const EhsSiteObsLoading({this.isRefresh = false});
  @override
  List<Object?> get props => [isRefresh];
}

/// The observation list is visible.
///
/// [fromCache] = true means we are showing offline data.
/// [hasMore] / [isLoadingMore] drive the infinite-scroll footer.
class EhsSiteObsLoaded extends EhsSiteObsState {
  final List<EhsSiteObservation> observations;
  final String? appliedStatusFilter;
  final String? appliedSeverityFilter;
  final bool fromCache;
  final bool hasMore;
  final bool isLoadingMore;

  const EhsSiteObsLoaded({
    required this.observations,
    this.appliedStatusFilter,
    this.appliedSeverityFilter,
    this.fromCache = false,
    this.hasMore = false,
    this.isLoadingMore = false,
  });

  EhsSiteObsLoaded copyWith({
    List<EhsSiteObservation>? observations,
    bool? hasMore,
    bool? isLoadingMore,
    bool? fromCache,
  }) {
    return EhsSiteObsLoaded(
      observations: observations ?? this.observations,
      appliedStatusFilter: appliedStatusFilter,
      appliedSeverityFilter: appliedSeverityFilter,
      fromCache: fromCache ?? this.fromCache,
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
        hasMore,
        isLoadingMore,
      ];
}

/// A fetch failed — displayed as an error banner.
class EhsSiteObsError extends EhsSiteObsState {
  final String message;
  const EhsSiteObsError(this.message);
  @override
  List<Object?> get props => [message];
}

/// A create / rectify / close / delete action completed.
class EhsSiteObsActionSuccess extends EhsSiteObsState {
  final String action;
  const EhsSiteObsActionSuccess(this.action);
  @override
  List<Object?> get props => [action];
}

/// A create / rectify / close action failed.
class EhsSiteObsActionError extends EhsSiteObsState {
  final String message;
  const EhsSiteObsActionError(this.message);
  @override
  List<Object?> get props => [message];
}

// ═══════════════════════════════════════════ BLOC ════════════════════════════

/// Manages EHS safety observations (unsafe acts and unsafe conditions).
///
/// This BLoC mirrors the pattern in [QualitySiteObsBloc]:
///   - Paginated loading (25 per page) with infinite scroll.
///   - Offline-first create/rectify/close via the sync queue.
///   - Hard-delete via direct API call (no offline queue needed).
///   - Cache fallback: unfiltered page-0 data written to Drift.
///
/// The main difference from quality site observations is the safety-specific
/// category taxonomy ([EhsCategory]) and the severity scale.
class EhsSiteObsBloc extends Bloc<EhsSiteObsEvent, EhsSiteObsState> {
  final SetuApiClient _api;
  final AppDatabase _db;
  final SyncService _syncService;

  /// Number of observations per API page.
  static const _pageLimit = 25;

  // Pagination tracking — reset on each fresh load/refresh.
  int _nextOffset = 0;
  int? _lastProjectId;
  String? _lastStatusFilter;
  String? _lastSeverityFilter;

  EhsSiteObsBloc({
    required SetuApiClient apiClient,
    required AppDatabase database,
    required SyncService syncService,
  })  : _api = apiClient,
        _db = database,
        _syncService = syncService,
        super(EhsSiteObsInitial()) {
    on<LoadEhsSiteObs>(_onLoad);
    on<RefreshEhsSiteObs>(_onRefresh);
    on<LoadMoreEhsSiteObs>(_onLoadMore);
    on<CreateEhsSiteObs>(_onCreate);
    on<RectifyEhsSiteObs>(_onRectify);
    on<CloseEhsSiteObs>(_onClose);
    on<DeleteEhsSiteObs>(_onDelete);
  }

  /// Initial load — resets pagination and shows a full-screen spinner.
  Future<void> _onLoad(
    LoadEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    _nextOffset = 0;
    _lastProjectId = event.projectId;
    _lastStatusFilter = event.statusFilter;
    _lastSeverityFilter = event.severityFilter;
    emit(const EhsSiteObsLoading());
    await _fetch(event.projectId, event.statusFilter, event.severityFilter,
        emit, offset: 0, existing: []);
  }

  /// Refresh — resets pagination and shows shimmer over existing data.
  Future<void> _onRefresh(
    RefreshEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    _nextOffset = 0;
    _lastProjectId = event.projectId;
    _lastStatusFilter = event.statusFilter;
    _lastSeverityFilter = event.severityFilter;
    emit(const EhsSiteObsLoading(isRefresh: true));
    await _fetch(event.projectId, event.statusFilter, event.severityFilter,
        emit, offset: 0, existing: []);
  }

  /// Load-more (infinite scroll) — appends to the existing list.
  Future<void> _onLoadMore(
    LoadMoreEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    final current = state;
    if (current is! EhsSiteObsLoaded) return;
    // Guard against duplicate calls while a page is in-flight.
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
  /// Only the unfiltered (no status/severity filter) page-0 response is
  /// cached to Drift. Filtered views are not cached to avoid stale partial data.
  Future<void> _fetch(
    int projectId,
    String? statusFilter,
    String? severityFilter,
    Emitter<EhsSiteObsState> emit, {
    required int offset,
    required List<EhsSiteObservation> existing,
  }) async {
    // ── Step 1: Serve Drift cache immediately (page-0 unfiltered only) ──────
    if (offset == 0) {
      try {
        final cached = await _db.getCachedEhsSiteObs(projectId, statusFilter);
        if (cached.isNotEmpty) {
          final obs = cached
              .map((r) => EhsSiteObservation.fromJson(
                  jsonDecode(r.rawData) as Map<String, dynamic>))
              .toList();
          emit(EhsSiteObsLoaded(
            observations: obs,
            appliedStatusFilter: statusFilter,
            appliedSeverityFilter: severityFilter,
            fromCache: true,
            hasMore: false,
          ));
          // Fall through — try to refresh from server in background.
        }
      } catch (_) {
        // Cache read failed — proceed to API attempt.
      }
    }

    // ── Step 2: Attempt live API fetch ──────────────────────────────────────
    try {
      final raw = await _api.getEhsSiteObs(
        projectId: projectId,
        status: statusFilter,
        severity: severityFilter,
        limit: _pageLimit,
        offset: offset,
      );
      final rawList = raw.map((e) => e as Map<String, dynamic>).toList();

      // Only cache unfiltered page-0 for offline fallback.
      if (statusFilter == null && severityFilter == null && offset == 0) {
        await _db.cacheEhsSiteObs(rawList, projectId);
      }
      final newObs = rawList.map(EhsSiteObservation.fromJson).toList();
      final all = [...existing, ...newObs];
      _nextOffset = offset + newObs.length;
      emit(EhsSiteObsLoaded(
        observations: all,
        appliedStatusFilter: statusFilter,
        appliedSeverityFilter: severityFilter,
        hasMore: newObs.length == _pageLimit,
      ));
    } catch (_) {
      if (offset > 0) {
        // Load-more failed — keep existing list, just disable hasMore.
        final current = state;
        if (current is EhsSiteObsLoaded) {
          emit(current.copyWith(hasMore: false, isLoadingMore: false));
        }
        return;
      }
      // Page-0 API failure — if cache was already emitted, stay silent.
      final current = state;
      if (current is EhsSiteObsLoaded && current.fromCache) return;
      // Nothing was cached — show error.
      emit(EhsSiteObsError(
          'Failed to load EHS observations. No cached data available.'));
    }
  }

  /// Creates a new EHS safety observation via the sync queue (offline-first).
  Future<void> _onCreate(
    CreateEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    try {
      await _syncService.addToQueue(
        entityType: 'ehs_site_obs_create',
        entityId: event.projectId,
        operation: 'create',
        payload: {
          'projectId': event.projectId,
          if (event.epsNodeId != null) 'epsNodeId': event.epsNodeId,
          'description': event.description,
          'severity': event.severity,
          if (event.category != null) 'category': event.category,
          if (event.locationLabel != null) 'locationLabel': event.locationLabel,
          if (event.photoUrls.isNotEmpty) 'photoUrls': event.photoUrls,
        },
        priority: 2,
      );
      final syncResult = await _syncService.syncAll();
      // '_offline' suffix tells the UI to show "Saved — will sync when online".
      emit(EhsSiteObsActionSuccess(
          syncResult.success ? 'created' : 'created_offline'));
    } catch (e) {
      emit(EhsSiteObsActionError('Failed to raise observation. $e'));
    }
  }

  /// Submits a rectification via the sync queue.
  Future<void> _onRectify(
    RectifyEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    try {
      await _syncService.addToQueue(
        entityType: 'ehs_site_obs_rectify',
        entityId: 0, // entityId is UUID string — use 0 as placeholder int
        operation: 'update',
        payload: {
          'id': event.id,
          'notes': event.notes,
          if (event.photoUrls.isNotEmpty) 'photoUrls': event.photoUrls,
        },
        priority: 2,
      );
      final syncResult = await _syncService.syncAll();
      emit(EhsSiteObsActionSuccess(
          syncResult.success ? 'rectified' : 'rectified_offline'));
    } catch (e) {
      emit(EhsSiteObsActionError('Failed to submit rectification. $e'));
    }
  }

  /// Closes an observation via the sync queue.
  Future<void> _onClose(
    CloseEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    try {
      await _syncService.addToQueue(
        entityType: 'ehs_site_obs_close',
        entityId: 0, // entityId is UUID string — use 0 as placeholder int
        operation: 'update',
        payload: {
          'id': event.id,
          if (event.closureNotes != null) 'closureNotes': event.closureNotes,
        },
        priority: 2,
      );
      final syncResult = await _syncService.syncAll();
      emit(EhsSiteObsActionSuccess(
          syncResult.success ? 'closed' : 'closed_offline'));
    } catch (e) {
      emit(EhsSiteObsActionError('Failed to close observation. $e'));
    }
  }

  /// Hard-deletes an observation via direct API call (not queued).
  Future<void> _onDelete(
    DeleteEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    try {
      await _api.deleteEhsSiteObs(id: event.id);
      emit(const EhsSiteObsActionSuccess('deleted'));
    } catch (e) {
      emit(EhsSiteObsActionError('Failed to delete observation. $e'));
    }
  }
}
