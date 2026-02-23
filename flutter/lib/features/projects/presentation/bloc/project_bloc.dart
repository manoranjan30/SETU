import 'dart:convert';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:drift/drift.dart' as drift;
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
      // GET /eps returns a FLAT list of all accessible EPS nodes.
      // Build the hierarchy client-side and surface only PROJECT-type nodes.
      final response = await _apiClient.getMyProjects();
      final projects = _buildProjectsFromFlatList(response);

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
      // GET /eps returns a flat list — build tree for the selected project.
      final allNodesResponse = await _apiClient.getMyProjects();
      final allNodes = allNodesResponse.cast<Map<String, dynamic>>();

      // Locate the project node.
      // Use num comparison to handle both int and double JSON representations.
      final projectRaw = allNodes.firstWhere(
        (n) {
          final raw = n['id'];
          if (raw is int) return raw == event.projectId;
          if (raw is num) return raw.toInt() == event.projectId;
          if (raw is String) return int.tryParse(raw) == event.projectId;
          return false;
        },
        orElse: () => throw StateError('Project ${event.projectId} not found in EPS list'),
      );

      // Build parent → children index from the full flat list
      final childrenByParentId = _buildChildrenIndex(allNodes);

      // Attach children recursively to the project node
      final projectWithChildren = _attachChildrenRecursive(
        Map<String, dynamic>.from(projectRaw),
        childrenByParentId,
      );
      final project = Project.fromJson(projectWithChildren);

      await _cacheProjects([project]);

      // Activities are loaded on-demand when the user navigates to a specific
      // EPS node (see _onNavigateToNode). Start with an empty index here.
      final activityIndex = <int, List<Activity>>{};

      // Root EPS nodes = direct children of this project
      final rootNodes = project.children;

      // Create a virtual root node representing the project itself in the breadcrumb
      final projectRootNode = EpsNode(
        id: -project.id, // Negative to avoid colliding with real node IDs
        name: project.name,
        type: 'PROJECT',
        children: rootNodes,
      );

      emit(EpsExplorerState(
        project: project,
        currentPath: [projectRootNode],
        currentNode: projectRootNode,
        childNodes: rootNodes,
        activities: const [], // No activities shown at project root level
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

  Future<void> _onNavigateToNode(
    NavigateToNode event,
    Emitter<ProjectState> emit,
  ) async {
    final currentState = state;
    if (currentState is! EpsExplorerState) return;

    final newPath = [...currentState.currentPath, event.node];

    // Check if we already have activities cached in memory for this node
    final cachedActivities = currentState.activityIndexByEpsNode[event.node.id];

    // Emit navigation immediately so the UI responds instantly
    emit(currentState.copyWith(
      currentPath: newPath,
      currentNode: event.node,
      childNodes: event.node.children,
      activities: cachedActivities ?? const [],
      // Show loading spinner only if we haven't loaded activities yet
      isLoadingChildren: cachedActivities == null,
    ));

    // If already cached, nothing more to do
    if (cachedActivities != null) return;

    // Fetch activities for this EPS node from the backend.
    // GET /planning/:epsNodeId/execution-ready — same endpoint the web app uses.
    try {
      final response = await _apiClient.getExecutionReadyActivities(event.node.id);
      final activities = response
          .map<Activity>((json) => Activity.fromJson(json as Map<String, dynamic>))
          .toList();

      // Cache to local DB for offline use (non-fatal — complex plans JSON may fail)
      if (activities.isNotEmpty) {
        try {
          await _database.cacheActivities(
            response.cast<Map<String, dynamic>>(),
            currentState.project.id,
          );
        } catch (_) {
          // Caching failure is non-critical; the activities are still shown.
        }
      }

      // Merge into the in-memory index
      final updatedIndex = Map<int, List<Activity>>.from(
        currentState.activityIndexByEpsNode,
      )..[event.node.id] = activities;

      // Only emit if we're still on the same node (user hasn't navigated away)
      final nowState = state;
      if (nowState is EpsExplorerState &&
          nowState.currentNode.id == event.node.id) {
        emit(nowState.copyWith(
          activities: activities,
          activityIndexByEpsNode: updatedIndex,
          isLoadingChildren: false,
          isOffline: false, // Clear stale offline flag — we just got live data
        ));
      }
    } catch (_) {
      // Network failed — try local DB cache
      final cachedRows = await _database.getActivitiesForProject(
        currentState.project.id,
      );
      final activities = cachedRows
          .map((row) =>
              Activity.fromJson(jsonDecode(row.rawData) as Map<String, dynamic>))
          .where((a) => a.epsNodeId == event.node.id)
          .toList();

      final nowState = state;
      if (nowState is EpsExplorerState &&
          nowState.currentNode.id == event.node.id) {
        emit(nowState.copyWith(
          activities: activities,
          activityIndexByEpsNode: Map<int, List<Activity>>.from(
            currentState.activityIndexByEpsNode,
          )..[event.node.id] = activities,
          isLoadingChildren: false,
          isOffline: true,
        ));
      }
    }
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
      // At project root — the UI's _handleBackPress() returns true to pop
      // the route. Do NOT emit here; it causes a loading flicker.
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

  // ---------------------------------------------------------------------------
  // EPS Tree Builders
  // GET /eps returns a FLAT list. These helpers build the parent→child tree
  // so the UI can drill down through the project hierarchy.
  // ---------------------------------------------------------------------------

  /// Returns only PROJECT-type nodes from the flat list, with children attached.
  List<Project> _buildProjectsFromFlatList(List<dynamic> rawNodes) {
    final allNodes = rawNodes.cast<Map<String, dynamic>>();
    final childrenByParentId = _buildChildrenIndex(allNodes);

    return allNodes
        .where((n) => (n['type'] as String? ?? '').toUpperCase() == 'PROJECT')
        .map((json) => Project.fromJson(
              _attachChildrenRecursive(Map<String, dynamic>.from(json), childrenByParentId),
            ))
        .toList();
  }

  /// Builds a parentId → [children] index from a flat node list.
  Map<int, List<Map<String, dynamic>>> _buildChildrenIndex(
    List<Map<String, dynamic>> allNodes,
  ) {
    final index = <int, List<Map<String, dynamic>>>{};
    for (final node in allNodes) {
      final parentId = node['parentId'] as int? ?? node['parent_id'] as int?;
      if (parentId != null) {
        index.putIfAbsent(parentId, () => []).add(node);
      }
    }
    return index;
  }

  /// Recursively attaches `children` lists to a node map using the index.
  Map<String, dynamic> _attachChildrenRecursive(
    Map<String, dynamic> node,
    Map<int, List<Map<String, dynamic>>> childrenByParentId,
  ) {
    final id = node['id'] as int? ?? 0;
    final children = childrenByParentId[id] ?? [];
    return {
      ...node,
      'children': children
          .map((child) => _attachChildrenRecursive(
                Map<String, dynamic>.from(child),
                childrenByParentId,
              ))
          .toList(),
    };
  }

  // ---------------------------------------------------------------------------

  Future<void> _cacheProjects(List<Project> projects) async {
    await _database.batch((batch) {
      for (final project in projects) {
          batch.insert(
            _database.cachedProjects,
            CachedProjectsCompanion.insert(
            id: drift.Value(project.id),
            name: project.name,
            code: drift.Value(project.code),
            status: drift.Value(project.status),
            startDate: drift.Value(project.startDate?.toIso8601String()),
            endDate: drift.Value(project.endDate?.toIso8601String()),
            rawData: jsonEncode(project.toJson()),
          ),
          mode: drift.InsertMode.insertOrReplace,
        );
      }
    });

    for (final project in projects) {
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
    final cached = await _database.select(_database.cachedProjects).get();
    if (cached.isEmpty) return [];

    return cached.map((row) {
      final json = jsonDecode(row.rawData) as Map<String, dynamic>;
      return Project.fromJson(json);
    }).toList();
  }

  Future<EpsExplorerState?> _loadCachedHierarchy(int projectId) async {
    final cachedProject = await (_database.select(_database.cachedProjects)
          ..where((t) => t.id.equals(projectId))
          ..limit(1))
        .getSingleOrNull();

    if (cachedProject == null) {
      return null;
    }

    final cachedNodes = await _database.getEpsNodesForProject(projectId);
    final cachedActivities = await _database.getActivitiesForProject(projectId);
    final projectJson = jsonDecode(cachedProject.rawData) as Map<String, dynamic>;

    final nodeById = <int, CachedEpsNode>{for (final node in cachedNodes) node.id: node};
    final childIdsByParent = <int?, List<int>>{};
    for (final node in cachedNodes) {
      childIdsByParent.putIfAbsent(node.parentId, () => []).add(node.id);
    }

    EpsNode buildNode(int nodeId) {
      final cachedNode = nodeById[nodeId]!;
      final children = (childIdsByParent[nodeId] ?? <int>[])
          .map(buildNode)
          .toList(growable: false);

      return EpsNode(
        id: cachedNode.id,
        name: cachedNode.name,
        code: cachedNode.code,
        type: cachedNode.type,
        progress: cachedNode.progress,
        parentId: cachedNode.parentId,
        children: children,
      );
    }

    // Direct children of the project have parentId == projectId, not null.
    final rootNodes = (childIdsByParent[projectId] ?? <int>[])
        .map(buildNode)
        .toList(growable: false);

    final project = Project(
      id: projectId,
      name: projectJson['name'] as String? ?? cachedProject.name,
      code: projectJson['code'] as String?,
      status: projectJson['status'] as String?,
      startDate: projectJson['startDate'] != null
          ? DateTime.tryParse(projectJson['startDate'] as String)
          : null,
      endDate: projectJson['endDate'] != null
          ? DateTime.tryParse(projectJson['endDate'] as String)
          : null,
      progress: (projectJson['progress'] as num?)?.toDouble(),
      children: rootNodes,
    );

    final activityIndex = <int, List<Activity>>{};
    for (final cachedActivity in cachedActivities) {
      final activityJson = jsonDecode(cachedActivity.rawData) as Map<String, dynamic>;
      final activity = Activity.fromJson(activityJson);
      final epsNodeId = activity.epsNodeId;
      if (epsNodeId != null) {
        activityIndex.putIfAbsent(epsNodeId, () => <Activity>[]).add(activity);
      }
    }

    final projectRootNode = EpsNode(
      id: -project.id,
      name: project.name,
      type: 'project',
      children: rootNodes,
    );

    return EpsExplorerState(
      project: project,
      currentPath: [projectRootNode],
      currentNode: projectRootNode,
      childNodes: rootNodes,
      activities: const [],
      activityIndexByEpsNode: activityIndex,
      isOffline: true,
    );
  }
}
