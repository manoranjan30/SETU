import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/planning/data/models/planning_models.dart';

abstract class ScheduleViewerEvent extends Equatable {
  const ScheduleViewerEvent();
  @override List<Object?> get props => [];
}

class LoadScheduleVersions extends ScheduleViewerEvent {
  final int projectId;
  const LoadScheduleVersions(this.projectId);
  @override List<Object?> get props => [projectId];
}

class LoadVersionActivities extends ScheduleViewerEvent {
  final int versionId;
  final String? searchQuery;
  const LoadVersionActivities(this.versionId, {this.searchQuery});
  @override List<Object?> get props => [versionId, searchQuery];
}

abstract class ScheduleViewerState extends Equatable {
  const ScheduleViewerState();
  @override List<Object?> get props => [];
}

class ScheduleViewerInitial extends ScheduleViewerState { const ScheduleViewerInitial(); }
class ScheduleViewerLoading extends ScheduleViewerState { const ScheduleViewerLoading(); }

class ScheduleVersionsLoaded extends ScheduleViewerState {
  final List<ScheduleVersion> versions;
  const ScheduleVersionsLoaded(this.versions);
  @override List<Object?> get props => [versions];
}

class ScheduleActivitiesLoaded extends ScheduleViewerState {
  final ScheduleVersion version;
  final List<ScheduleActivity> activities;
  final String? searchQuery;
  const ScheduleActivitiesLoaded({required this.version, required this.activities, this.searchQuery});
  @override List<Object?> get props => [version, activities, searchQuery];
}

/// Emitted when no schedule versions exist — shows activities from the WBS
/// (execution-ready activities) as the base/unversioned schedule view.
class ScheduleBaseActivitiesLoaded extends ScheduleViewerState {
  final List<ScheduleActivity> activities;
  final int projectId;
  final Map<int, String> epsNodeNames;
  const ScheduleBaseActivitiesLoaded({required this.activities, required this.projectId, this.epsNodeNames = const {}});
  @override List<Object?> get props => [activities, projectId, epsNodeNames];
}

class ScheduleViewerError extends ScheduleViewerState {
  final String message;
  const ScheduleViewerError(this.message);
  @override List<Object?> get props => [message];
}

class ScheduleViewerBloc extends Bloc<ScheduleViewerEvent, ScheduleViewerState> {
  final SetuApiClient _apiClient;

  ScheduleViewerBloc({required SetuApiClient apiClient})
      : _apiClient = apiClient,
        super(const ScheduleViewerInitial()) {
    on<LoadScheduleVersions>(_onLoadVersions);
    on<LoadVersionActivities>(_onLoadActivities);
  }

  Future<void> _onLoadVersions(LoadScheduleVersions event, Emitter<ScheduleViewerState> emit) async {
    emit(const ScheduleViewerLoading());
    try {
      final raw = await _apiClient.getScheduleVersions(event.projectId);
      final versions = raw.map((e) => ScheduleVersion.fromJson(e as Map<String, dynamic>)).toList();
      if (versions.isNotEmpty) {
        emit(ScheduleVersionsLoaded(versions));
      } else {
        // No schedule versions — fall back to execution-ready activities from the WBS.
        await _loadBaseActivities(event.projectId, emit);
      }
    } catch (e) {
      emit(ScheduleViewerError('Failed to load schedule: $e'));
    }
  }

  /// Loads activities from the EPS/WBS when no schedule version has been created yet.
  Future<void> _loadBaseActivities(int projectId, Emitter<ScheduleViewerState> emit) async {
    try {
      final epsTree = await _apiClient.getEpsTreeForProject(projectId);
      // Build flat map of EPS node id → name for the view to group by
      final epsNodeNames = <int, String>{};
      void flattenEps(List<dynamic> nodes) {
        for (final n in nodes) {
          final m = n as Map<String, dynamic>;
          final id = m['id'] as int? ?? 0;
          final name = (m['label'] ?? m['name'] ?? '') as String;
          if (id != 0 && name.isNotEmpty) epsNodeNames[id] = name;
          final children = m['children'] as List<dynamic>? ?? [];
          if (children.isNotEmpty) flattenEps(children);
        }
      }
      flattenEps(epsTree);

      final rootIds = (epsTree).cast<Map<String, dynamic>>()
          .map((n) => n['id'] as int?)
          .whereType<int>()
          .toList();
      final seen = <int>{};
      final activities = <ScheduleActivity>[];
      for (final nodeId in rootIds) {
        final raw = await _apiClient.getExecutionReadyActivities(projectId, nodeId);
        for (final e in raw) {
          final m = e as Map<String, dynamic>;
          final id = m['id'] as int? ?? 0;
          if (id != 0 && seen.add(id)) {
            final name = m['activityName'] as String? ?? m['name'] as String? ?? '';
            if (name.isNotEmpty) {
              activities.add(ScheduleActivity(
                id: id,
                name: name,
                activityCode: m['activityCode'] as String? ?? m['code'] as String?,
                epsNodeId: m['epsNodeId'] as int? ?? m['wbsNodeId'] as int?,
              ));
            }
          }
        }
      }
      emit(ScheduleBaseActivitiesLoaded(activities: activities, projectId: projectId, epsNodeNames: epsNodeNames));
    } catch (_) {
      emit(const ScheduleViewerError(
          'No schedule data available for this project.\n'
          'Create a schedule version in the web app under:\n'
          'Planning → Schedule → New Version'));
    }
  }

  Future<void> _onLoadActivities(LoadVersionActivities event, Emitter<ScheduleViewerState> emit) async {
    final currentState = state;
    ScheduleVersion? version;
    if (currentState is ScheduleVersionsLoaded) {
      version = currentState.versions.firstWhere((v) => v.id == event.versionId, orElse: () => currentState.versions.first);
    } else if (currentState is ScheduleActivitiesLoaded) {
      version = currentState.version;
    }
    if (version == null) return;
    emit(const ScheduleViewerLoading());
    try {
      final raw = await _apiClient.getVersionActivities(event.versionId, q: event.searchQuery);
      final activities = raw.map((e) => ScheduleActivity.fromJson(e as Map<String, dynamic>)).toList();
      emit(ScheduleActivitiesLoaded(version: version, activities: activities, searchQuery: event.searchQuery));
    } catch (e) {
      emit(ScheduleViewerError('Failed to load activities: $e'));
    }
  }
}
