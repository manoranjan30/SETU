import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';

// ═══════════════════════════════════════ STATES ══════════════════════════════

abstract class DashboardState extends Equatable {
  const DashboardState();
  @override
  List<Object?> get props => [];
}

class DashboardLoading extends DashboardState {}

class DashboardLoaded extends DashboardState {
  final int pendingInspections;
  final int pendingProgressApprovals;
  final int openEhsObs;
  final int openQualityObs;

  const DashboardLoaded({
    required this.pendingInspections,
    required this.pendingProgressApprovals,
    required this.openEhsObs,
    required this.openQualityObs,
  });

  int get totalActions =>
      pendingInspections + pendingProgressApprovals + openEhsObs + openQualityObs;

  @override
  List<Object?> get props => [
        pendingInspections,
        pendingProgressApprovals,
        openEhsObs,
        openQualityObs,
      ];
}

class DashboardError extends DashboardState {
  final String message;
  const DashboardError(this.message);
  @override
  List<Object?> get props => [message];
}

// ═══════════════════════════════════════ CUBIT ═══════════════════════════════

class DashboardCubit extends Cubit<DashboardState> {
  final SetuApiClient _apiClient;
  final AppDatabase _database;
  final int projectId;

  DashboardCubit({
    required SetuApiClient apiClient,
    required AppDatabase database,
    required this.projectId,
  })  : _apiClient = apiClient,
        _database = database,
        super(DashboardLoading());

  Future<void> load() async {
    if (state is! DashboardLoaded) emit(DashboardLoading());

    // Load all counts in parallel. Each count first tries the live API;
    // on failure it falls back to the local Drift cache so the dashboard
    // always shows a meaningful number rather than 0.
    final results = await Future.wait([
      _safeCount(
        () => _apiClient.getMyPendingInspections(projectId),
        cacheCount: null, // no cache for inspections
      ),
      _safeCount(
        () => _apiClient.getPendingApprovals(projectId),
        cacheCount: null, // no cache for approvals
      ),
      _safeCount(
        () => _apiClient.getEhsSiteObs(projectId: projectId, status: 'OPEN'),
        cacheCount: () => _database
            .getCachedEhsSiteObs(projectId, 'OPEN')
            .then((list) => list.length),
      ),
      _safeCount(
        () => _apiClient.getQualitySiteObs(projectId: projectId, status: 'OPEN'),
        cacheCount: () => _database
            .getCachedQualitySiteObs(projectId, 'OPEN')
            .then((list) => list.length),
      ),
    ]);

    emit(DashboardLoaded(
      pendingInspections: results[0],
      pendingProgressApprovals: results[1],
      openEhsObs: results[2],
      openQualityObs: results[3],
    ));
  }

  Future<void> refresh() => load();

  /// Tries the live API first. On any error, falls back to [cacheCount] if
  /// provided, or returns 0 as a last resort.
  Future<int> _safeCount(
    Future<List<dynamic>> Function() fn, {
    required Future<int> Function()? cacheCount,
  }) async {
    try {
      final list = await fn();
      return list.length;
    } catch (_) {
      if (cacheCount != null) {
        try {
          return await cacheCount();
        } catch (_) {
          return 0;
        }
      }
      return 0;
    }
  }
}
