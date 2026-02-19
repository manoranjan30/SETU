import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

// ==================== EVENTS ====================

abstract class ProjectEvent extends Equatable {
  const ProjectEvent();

  @override
  List<Object?> get props => [];
}

/// Load user's assigned projects
class LoadProjects extends ProjectEvent {}

/// Load activities for a project
class LoadActivities extends ProjectEvent {
  final int projectId;

  const LoadActivities(this.projectId);

  @override
  List<Object?> get props => [projectId];
}

/// Load EPS node details
class LoadEpsNode extends ProjectEvent {
  final int nodeId;

  const LoadEpsNode(this.nodeId);

  @override
  List<Object?> get props => [nodeId];
}

/// Select a project
class SelectProject extends ProjectEvent {
  final Project project;

  const SelectProject(this.project);

  @override
  List<Object?> get props => [project];
}

/// Select an activity
class SelectActivity extends ProjectEvent {
  final Activity activity;

  const SelectActivity(this.activity);

  @override
  List<Object?> get props => [activity];
}

// ==================== STATES ====================

abstract class ProjectState extends Equatable {
  const ProjectState();

  @override
  List<Object?> get props => [];
}

/// Initial state
class ProjectInitial extends ProjectState {}

/// Loading state
class ProjectLoading extends ProjectState {}

/// Projects loaded successfully
class ProjectsLoaded extends ProjectState {
  final List<Project> projects;

  const ProjectsLoaded(this.projects);

  @override
  List<Object?> get props => [projects];
}

/// Activities loaded successfully
class ActivitiesLoaded extends ProjectState {
  final List<Activity> activities;
  final Project selectedProject;

  const ActivitiesLoaded({
    required this.activities,
    required this.selectedProject,
  });

  @override
  List<Object?> get props => [activities, selectedProject];
}

/// EPS node loaded
class EpsNodeLoaded extends ProjectState {
  final EpsNode node;

  const EpsNodeLoaded(this.node);

  @override
  List<Object?> get props => [node];
}

/// Project selected
class ProjectSelected extends ProjectState {
  final Project project;

  const ProjectSelected(this.project);

  @override
  List<Object?> get props => [project];
}

/// Activity selected
class ActivitySelected extends ProjectState {
  final Activity activity;
  final Project project;

  const ActivitySelected({
    required this.activity,
    required this.project,
  });

  @override
  List<Object?> get props => [activity, project];
}

/// Error state
class ProjectError extends ProjectState {
  final String message;

  const ProjectError(this.message);

  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class ProjectBloc extends Bloc<ProjectEvent, ProjectState> {
  final SetuApiClient _apiClient;

  ProjectBloc({required SetuApiClient apiClient})
      : _apiClient = apiClient,
        super(ProjectInitial()) {
    on<LoadProjects>(_onLoadProjects);
    on<LoadActivities>(_onLoadActivities);
    on<LoadEpsNode>(_onLoadEpsNode);
    on<SelectProject>(_onSelectProject);
    on<SelectActivity>(_onSelectActivity);
  }

  Future<void> _onLoadProjects(
    LoadProjects event,
    Emitter<ProjectState> emit,
  ) async {
    emit(ProjectLoading());

    try {
      final response = await _apiClient.getMyProjects();
      final projects = response
          .map<Project>((json) => Project.fromJson(json))
          .toList();
      emit(ProjectsLoaded(projects));
    } catch (e) {
      emit(ProjectError(e.toString()));
    }
  }

  Future<void> _onLoadActivities(
    LoadActivities event,
    Emitter<ProjectState> emit,
  ) async {
    emit(ProjectLoading());

    try {
      final response = await _apiClient.getProjectActivities(event.projectId);
      final activities = response
          .map<Activity>((json) => Activity.fromJson(json))
          .toList();
      
      // Get the current project from state
      Project? currentProject;
      if (state is ProjectsLoaded) {
        final projectsState = state as ProjectsLoaded;
        currentProject = projectsState.projects.firstWhere(
          (p) => p.id == event.projectId,
          orElse: () => projectsState.projects.first,
        );
      }

      if (currentProject != null) {
        emit(ActivitiesLoaded(
          activities: activities,
          selectedProject: currentProject,
        ));
      } else {
        emit(ProjectError('Project not found'));
      }
    } catch (e) {
      emit(ProjectError(e.toString()));
    }
  }

  Future<void> _onLoadEpsNode(
    LoadEpsNode event,
    Emitter<ProjectState> emit,
  ) async {
    emit(ProjectLoading());

    try {
      final response = await _apiClient.getEpsNode(event.nodeId);
      final node = EpsNode.fromJson(response);
      emit(EpsNodeLoaded(node));
    } catch (e) {
      emit(ProjectError(e.toString()));
    }
  }

  void _onSelectProject(
    SelectProject event,
    Emitter<ProjectState> emit,
  ) {
    emit(ProjectSelected(event.project));
  }

  void _onSelectActivity(
    SelectActivity event,
    Emitter<ProjectState> emit,
  ) {
    if (state is ProjectSelected) {
      final projectState = state as ProjectSelected;
      emit(ActivitySelected(
        activity: event.activity,
        project: projectState.project,
      ));
    }
  }
}
