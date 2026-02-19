import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

// ==================== EVENTS ====================

abstract class ProjectEvent extends Equatable {
  const ProjectEvent();

  @override
  List<Object?> get props => [];
}

/// Load user's assigned projects
class LoadProjects extends ProjectEvent {}

/// Load project hierarchy (EPS tree + activities) for offline use
class LoadProjectHierarchy extends ProjectEvent {
  final int projectId;

  const LoadProjectHierarchy(this.projectId);

  @override
  List<Object?> get props => [projectId];
}

/// Navigate to an EPS node (drill down)
class NavigateToNode extends ProjectEvent {
  final EpsNode node;

  const NavigateToNode(this.node);

  @override
  List<Object?> get props => [node];
}

/// Navigate back to a specific path index (breadcrumb tap)
class NavigateToPathIndex extends ProjectEvent {
  final int index;

  const NavigateToPathIndex(this.index);

  @override
  List<Object?> get props => [index];
}

/// Navigate back one level
class NavigateBack extends ProjectEvent {}

/// Refresh current node data
class RefreshCurrentNode extends ProjectEvent {}

/// Select an activity for progress entry
class SelectActivity extends ProjectEvent {
  final Activity activity;

  const SelectActivity(this.activity);

  @override
  List<Object?> get props => [activity];
}

/// Clear navigation state (return to project list)
class ClearNavigation extends ProjectEvent {}

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

/// EPS Explorer state - for hierarchical navigation
class EpsExplorerState extends ProjectState {
  final Project project;
  final List<EpsNode> currentPath; // Breadcrumb path
  final EpsNode currentNode;
  final List<EpsNode> childNodes; // Children of current node
  final List<Activity> activities; // Activities at current node
  final Map<int, List<Activity>> activityIndexByEpsNode; // In-memory index
  final bool isLoadingChildren;
  final bool isOffline;

  const EpsExplorerState({
    required this.project,
    required this.currentPath,
    required this.currentNode,
    required this.childNodes,
    required this.activities,
    required this.activityIndexByEpsNode,
    this.isLoadingChildren = false,
    this.isOffline = false,
  });

  /// Get activities for a specific EPS node from the index
  List<Activity> getActivitiesForNode(int epsNodeId) {
    return activityIndexByEpsNode[epsNodeId] ?? [];
  }

  /// Check if current node has children
  bool get hasChildren => childNodes.isNotEmpty;

  /// Check if current node has activities
  bool get hasActivities => activities.isNotEmpty;

  /// Check if current node is empty (no children, no activities)
  bool get isEmpty => !hasChildren && !hasActivities;

  /// Get breadcrumb display text
  String get breadcrumbText => currentPath.map((n) => n.name).join(' > ');

  EpsExplorerState copyWith({
    Project? project,
    List<EpsNode>? currentPath,
    EpsNode? currentNode,
    List<EpsNode>? childNodes,
    List<Activity>? activities,
    Map<int, List<Activity>>? activityIndexByEpsNode,
    bool? isLoadingChildren,
    bool? isOffline,
  }) {
    return EpsExplorerState(
      project: project ?? this.project,
      currentPath: currentPath ?? this.currentPath,
      currentNode: currentNode ?? this.currentNode,
      childNodes: childNodes ?? this.childNodes,
      activities: activities ?? this.activities,
      activityIndexByEpsNode: activityIndexByEpsNode ?? this.activityIndexByEpsNode,
      isLoadingChildren: isLoadingChildren ?? this.isLoadingChildren,
      isOffline: isOffline ?? this.isOffline,
    );
  }

  @override
  List<Object?> get props => [
        project,
        currentPath,
        currentNode,
        childNodes,
        activities,
        activityIndexByEpsNode,
        isLoadingChildren,
        isOffline,
      ];
}

/// Activity selected for progress entry
class ActivitySelected extends ProjectState {
  final Activity activity;
  final Project project;
  final EpsNode? epsNode;

  const ActivitySelected({
    required this.activity,
    required this.project,
    this.epsNode,
  });

  @override
  List<Object?> get props => [activity, project, epsNode];
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
  final AppDatabase _database;

  ProjectBloc({
    required SetuApiClient apiClient,
    required AppDatabase database,
  })  : _apiClient = apiClient,
        _database = database,
        super(ProjectInitial()) {
    on<LoadProjects>(_onLoadProjects);
    on<LoadProjectHierarchy>(_onLoadProjectHierarchy);
    on<NavigateToNode>(_onNavigateToNode);
    on<NavigateToPathIndex>(_onNavigateToPathIndex);
    on<NavigateBack>(_onNavigateBack);
    on<RefreshCurrentNode>(_onRefreshCurrentNode);
    on<SelectActivity>(_onSelectActivity);
    on<ClearNavigation>(_onClearNavigation);
  }

  Future<void> _onLoadProjects(
    LoadProjects event,
    Emitter<ProjectState> emit,
  ) async {
    emit(ProjectLoading());

    try {
      // Try to fetch from API
      final response = await _apiClient.getMyProjects();
      final projects = response
          .map<Project>((json) => Project.fromJson(json))
          .toList();

      // Cache projects for offline use
      await _cacheProjects(projects);

      emit(ProjectsLoaded(projects));
    } catch (e) {
      // Try to load from cache
      final cachedProjects = await _loadCachedProjects();
      if (cachedProjects.isNotEmpty) {
        emit(ProjectsLoaded(cachedProjects));
      } else {
        emit(ProjectError(e.toString()));
      }
    }
  }

  Future<void> _onLoadProjectHierarchy(
    LoadProjectHierarchy event,
    Emitter<ProjectState> emit,
  ) async {
    emit(ProjectLoading());

    try {
      // Get the project
      final projectsResponse = await _apiClient.getMyProjects();
      final project = projectsResponse
          .map<Project>((json) => Project.fromJson(json))
          .firstWhere((p) => p.id == event.projectId);

      // Fetch all activities for the project
      final activitiesResponse = await _apiClient.getProjectActivities(event.projectId);
      final allActivities = activitiesResponse
          .map<Activity>((json) => Activity.fromJson(json))
          .toList();

      // Build activity index by EPS node
      final activityIndex = <int, List<Activity>>{};
      for (final activity in allActivities) {
        if (activity.epsNodeId != null) {
          activityIndex.putIfAbsent(activity.epsNodeId!, () => []);
          activityIndex[activity.epsNodeId!]!.add(activity);
        }
      }

      // Cache activities for offline use
      await _database.cacheActivities(
        activitiesResponse.cast<Map<String, dynamic>>(),
        event.projectId,
      );

      // Get root EPS nodes (children of project)
      final rootNodes = project.children;

      // Create a virtual root node for the project
      final projectRootNode = EpsNode(
        id: -project.id, // Negative ID to avoid collision
        name: project.name,
        type: 'project',
        children: rootNodes,
      );

      emit(EpsExplorerState(
        project: project,
        currentPath: [projectRootNode],
        currentNode: projectRootNode,
        childNodes: rootNodes,
        activities: [], // No activities at project root
        activityIndexByEpsNode: activityIndex,
      ));
    } catch (e) {
      // Try to load from cache
      final cachedState = await _loadCachedHierarchy(event.projectId);
      if (cachedState != null) {
        emit(cachedState.copyWith(isOffline: true));
      } else {
        emit(ProjectError(e.toString()));
      }
    }
  }

  void _onNavigateToNode(
    NavigateToNode event,
    Emitter<ProjectState> emit,
  ) {
    final currentState = state;
    if (currentState is! EpsExplorerState) return;

    // Get activities for this node
    final nodeActivities = currentState.activityIndexByEpsNode[event.node.id] ?? [];

    // Update path
    final newPath = [...currentState.currentPath, event.node];

    emit(currentState.copyWith(
      currentPath: newPath,
      currentNode: event.node,
      childNodes: event.node.children,
      activities: nodeActivities,
    ));
  }

  void _onNavigateToPathIndex(
    NavigateToPathIndex event,
    Emitter<ProjectState> emit,
  ) {
    final currentState = state;
    if (currentState is! EpsExplorerState) return;

    if (event.index < 0 || event.index >= currentState.currentPath.length) return;

    // Navigate to the specified index
    final newPath = currentState.currentPath.sublist(0, event.index + 1);
    final targetNode = newPath.last;

    // Get activities for this node
    final nodeActivities = currentState.activityIndexByEpsNode[targetNode.id] ?? [];

    emit(currentState.copyWith(
      currentPath: newPath,
      currentNode: targetNode,
      childNodes: targetNode.children,
      activities: nodeActivities,
    ));
  }

  void _onNavigateBack(
    NavigateBack event,
    Emitter<ProjectState> emit,
  ) {
    final currentState = state;
    if (currentState is! EpsExplorerState) return;

    if (currentState.currentPath.length <= 1) {
      // At root, go back to project list
      add(LoadProjects());
      return;
    }

    // Go back one level
    final newIndex = currentState.currentPath.length - 2;
    add(NavigateToPathIndex(newIndex));
  }

  Future<void> _onRefreshCurrentNode(
    RefreshCurrentNode event,
    Emitter<ProjectState> emit,
  ) async {
    final currentState = state;
    if (currentState is! EpsExplorerState) return;

    emit(currentState.copyWith(isLoadingChildren: true));

    try {
      // Re-fetch activities for the project
      final activitiesResponse = await _apiClient.getProjectActivities(currentState.project.id);
      final allActivities = activitiesResponse
          .map<Activity>((json) => Activity.fromJson(json))
          .toList();

      // Rebuild activity index
      final activityIndex = <int, List<Activity>>{};
      for (final activity in allActivities) {
        if (activity.epsNodeId != null) {
          activityIndex.putIfAbsent(activity.epsNodeId!, () => []);
          activityIndex[activity.epsNodeId!]!.add(activity);
        }
      }

      // Get activities for current node
      final nodeActivities = activityIndex[currentState.currentNode.id] ?? [];

      emit(currentState.copyWith(
        activities: nodeActivities,
        activityIndexByEpsNode: activityIndex,
        isLoadingChildren: false,
        isOffline: false,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        isLoadingChildren: false,
        isOffline: true,
      ));
    }
  }

  void _onSelectActivity(
    SelectActivity event,
    Emitter<ProjectState> emit,
  ) {
    final currentState = state;
    EpsNode? epsNode;

    if (currentState is EpsExplorerState) {
      epsNode = currentState.currentNode;
    }

    emit(ActivitySelected(
      activity: event.activity,
      project: currentState is EpsExplorerState 
          ? currentState.project 
          : throw StateError('Invalid state'),
      epsNode: epsNode,
    ));
  }

  void _onClearNavigation(
    ClearNavigation event,
    Emitter<ProjectState> emit,
  ) {
    emit(ProjectInitial());
    add(LoadProjects());
  }

  // ==================== HELPER METHODS ====================

  Future<void> _cacheProjects(List<Project> projects) async {
    // Projects are cached via the EPS nodes
    for (final project in projects) {
      // Cache EPS nodes recursively
      await _cacheEpsNodesRecursive(project.children, project.id);
    }
  }

  Future<void> _cacheEpsNodesRecursive(List<EpsNode> nodes, int projectId) async {
    for (final node in nodes) {
      await _database.cacheEpsNodes([
        {
          'id': node.id,
          'name': node.name,
          'code': node.code,
          'type': node.type,
          'parentId': node.parentId,
        }
      ], projectId);

      if (node.children.isNotEmpty) {
        await _cacheEpsNodesRecursive(node.children, projectId);
      }
    }
  }

  Future<List<Project>> _loadCachedProjects() async {
    // For now, return empty list
    // In a full implementation, we would reconstruct projects from cached EPS nodes
    return [];
  }

  Future<EpsExplorerState?> _loadCachedHierarchy(int projectId) async {
    // For now, return null
    // In a full implementation, we would reconstruct the hierarchy from cache
    return null;
  }
}
