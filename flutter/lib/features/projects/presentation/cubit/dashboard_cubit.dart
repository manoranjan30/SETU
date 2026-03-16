import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';

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
  final int projectId;

  DashboardCubit({required SetuApiClient apiClient, required this.projectId})
      : _apiClient = apiClient,
        super(DashboardLoading());

  Future<void> load() async {
    if (state is! DashboardLoaded) emit(DashboardLoading());

    // Load all counts in parallel; each silently returns 0 on error
    final results = await Future.wait([
      _safeCount(() => _apiClient.getMyPendingInspections(projectId)),
      _safeCount(() => _apiClient.getPendingApprovals(projectId)),
      _safeCount(() => _apiClient.getEhsSiteObs(projectId: projectId, status: 'OPEN')),
      _safeCount(() => _apiClient.getQualitySiteObs(projectId: projectId, status: 'OPEN')),
    ]);

    emit(DashboardLoaded(
      pendingInspections: results[0],
      pendingProgressApprovals: results[1],
      openEhsObs: results[2],
      openQualityObs: results[3],
    ));
  }

  Future<void> refresh() => load();

  Future<int> _safeCount(Future<List<dynamic>> Function() fn) async {
    try {
      final list = await fn();
      return list.length;
    } catch (_) {
      return 0;
    }
  }
}
