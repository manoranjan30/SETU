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
      emit(ScheduleVersionsLoaded(versions));
    } catch (e) {
      emit(ScheduleViewerError('Failed to load schedule versions: $e'));
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
