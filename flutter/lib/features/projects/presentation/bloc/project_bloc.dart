import 'dart:convert';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:drift/drift.dart' as drift;
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

// ==================== EVENTS ====================

/// Base class for all project-related events.
abstract class ProjectEvent extends Equatable {
  const ProjectEvent();

  @override
  List<Object?> get props => [];
}

/// Load the list of projects accessible to the current user.
/// Triggered on the project selection screen.
class LoadProjects extends ProjectEvent {}

/// Drill into a specific project's EPS tree.
/// The server returns a flat list of nodes; the BLoC builds the hierarchy
/// client-side and then enters the [EpsExplorerState].
class LoadProjectHierarchy extends ProjectEvent {
  final int projectId;

  const LoadProjectHierarchy(this.projectId);

  @override
  List<Object?> get props => [projectId];
}

/// The user tapped a node in the EPS tree (e.g. Tower 1 → Floor 3).
/// Emits immediately with the node's cached children, then fetches
/// activities from the server in the background.
class NavigateToNode extends ProjectEvent {
  final EpsNode node;

  const NavigateToNode(this.node);

  @override
  List<Object?> get props => [node];
}

/// The user tapped a breadcrumb segment to jump up the hierarchy.
/// Navigates to the node at [index] in the current path list.
class NavigateToPathIndex extends ProjectEvent {
  final int index;

  const NavigateToPathIndex(this.index);

  @override
  List<Object?> get props => [index];
}

/// Navigate back one level (equivalent to the device back button
/// while inside the EPS explorer).
class NavigateBack extends ProjectEvent {}

/// Re-fetch activities for the currently visible EPS node.
/// Used to refresh the list after a progress entry is saved.
class RefreshCurrentNode extends ProjectEvent {}

/// The user tapped an activity row to enter a progress entry.
/// Transitions to [ActivitySelected] which the progress BLoC listens to.
class SelectActivity extends ProjectEvent {
  final Activity activity;

  const SelectActivity(this.activity);

  @override
  List<Object?> get props => [activity];
}

/// Return to the project list and reset all navigation state.
class ClearNavigation extends ProjectEvent {}

// ==================== STATES ====================

/// Base class for all project states.
abstract class ProjectState extends Equatable {
  const ProjectState();

  @override
  List<Object?> get props => [];
}

/// Initial state before any data is loaded.
class ProjectInitial extends ProjectState {}

/// Full-screen loading indicator while fetching project list or hierarchy.
class ProjectLoading extends ProjectState {}

/// The project list has been successfully loaded.
class ProjectsLoaded extends ProjectState {
  final List<Project> projects;

  const ProjectsLoaded(this.projects);

  @override
  List<Object?> get props => [projects];
}

/// The EPS hierarchical navigator is active.
///
/// Carries:
///   - [currentPath] — breadcrumb trail from project root to current node
///   - [currentNode] — the node currently displayed
///   - [childNodes]  — sub-nodes listed in the current pane
///   - [activities]  — execution-ready activities at the current node
///   - [activityIndexByEpsNode] — in-memory cache keyed by node ID so
///     breadcrumb back-navigation is instant (no extra API calls)
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

  /// Look up pre-loaded activities for any node by ID from the in-memory index.
  /// Returns empty list rather than null to simplify widget code.
  List<Activity> getActivitiesForNode(int epsNodeId) {
    return activityIndexByEpsNode[epsNodeId] ?? [];
  }

  /// True when the current node has child sub-nodes to drill into.
  bool get hasChildren => childNodes.isNotEmpty;

  /// True when the current node has activities for progress entry.
  bool get hasActivities => activities.isNotEmpty;

  /// True when there is nothing to show at this node (leaf with no activities).
  bool get isEmpty => !hasChildren && !hasActivities;

  /// Display string for the breadcrumb bar, e.g. "Block A > Tower 1 > Floor 3".
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

/// Transient state signalling that an activity was selected for progress entry.
/// The progress entry screen listens for this state and opens accordingly.
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

/// An unrecoverable error occurred (e.g. no cache AND no network).
class ProjectError extends ProjectState {
  final String message;

  const ProjectError(this.message);

  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

/// Manages EPS (Enterprise Project Structure) tree navigation.
///
/// Architecture notes:
///   - The backend GET /eps endpoint returns a FLAT list of all node records.
///     The tree is assembled client-side using [_buildChildrenIndex] and
///     [_attachChildrenRecursive].
///   - Activities are loaded lazily — only when the user navigates to a node.
///   - Loaded activities are stored in [EpsExplorerState.activityIndexByEpsNode]
///     so that breadcrumb back-navigation is instant.
///   - All node/activity data is written to Drift (SQLite) for offline use.
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

  /// Fetches the flat EPS list, extracts PROJECT-type nodes, builds their
  /// children tree, caches the result, and emits [ProjectsLoaded].
  /// Falls back to Drift cache on network failure.
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
      // Try to load from cache. If the cache query itself fails (e.g. in a
      // test environment where Drift has no real SQLite backend), catch that
      // secondary exception and emit ProjectError rather than rethrowing.
      try {
        final cachedProjects = await _loadCachedProjects();
        if (cachedProjects.isNotEmpty) {
          emit(ProjectsLoaded(cachedProjects));
        } else {
          emit(ProjectError(e.toString()));
        }
      } catch (_) {
        emit(ProjectError(e.toString()));
      }
    }
  }

  /// Builds the full EPS tree for a single project, starting from the flat
  /// API response, and emits the initial [EpsExplorerState] at project root.
  ///
  /// The virtual root node uses a negative ID (-project.id) to guarantee
  /// it never collides with a real EPS node ID from the database.
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

  /// Handles drilling down into an EPS child node.
  ///
  /// Strategy:
  ///   1. Emit immediately with cached activities (if any) so UI snaps into
  ///      place — no waiting before the screen changes.
  ///   2. Fetch live activities from the server in the background.
  ///   3. Only emit the updated activities if the user hasn't already
  ///      navigated away from this node (stale-update guard).
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
      final response = await _apiClient.getExecutionReadyActivities(currentState.project.id, event.node.id);
      final seen = <int>{};
      final activities = response
          .map<Activity>((raw) {
            final json = Map<String, dynamic>.from(raw as Map<String, dynamic>);
            // The backend now returns epsNodeId for activities that have a BOQ
            // item assigned to a specific EPS node.  Only fall back to injecting
            // the current node's ID when the backend didn't provide one (e.g.
            // project-level BOQ items not tied to a specific floor/unit).
            if (json['epsNodeId'] == null && json['eps_node_id'] == null) {
              json['epsNodeId'] = event.node.id;
            }
            return Activity.fromJson(json);
          })
          // Deduplicate by activity ID — safety net in case the API ever returns
          // the same activity more than once.
          .where((a) => seen.add(a.id))
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

      // Merge into the in-memory index so back-navigation stays instant
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

  /// Handles a breadcrumb tap — jump to path[index] without a server call
  /// because activities for ancestor nodes are already in [activityIndexByEpsNode].
  void _onNavigateToPathIndex(
    NavigateToPathIndex event,
    Emitter<ProjectState> emit,
  ) {
    final currentState = state;
    if (currentState is! EpsExplorerState) return;

    if (event.index < 0 || event.index >= currentState.currentPath.length) return;

    // Trim the path to the requested depth
    final newPath = currentState.currentPath.sublist(0, event.index + 1);
    final targetNode = newPath.last;

    // Get activities for this node from the in-memory index (no network call needed)
    final nodeActivities = currentState.activityIndexByEpsNode[targetNode.id] ?? [];

    emit(currentState.copyWith(
      currentPath: newPath,
      currentNode: targetNode,
      childNodes: targetNode.children,
      activities: nodeActivities,
    ));
  }

  /// Handles the device back button while inside the EPS explorer.
  ///
  /// When at the project root (path length == 1), we let the UI's
  /// _handleBackPress() pop the route — emitting here would cause a
  /// loading flicker because LoadProjects is heavy.
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

    // Go back one level by navigating to parent index
    final newIndex = currentState.currentPath.length - 2;
    add(NavigateToPathIndex(newIndex));
  }

  /// Re-fetches activities for the currently visible EPS node.
  /// Used after a progress entry is saved to refresh the activity list.
  /// Marks offline only when the current activities list was already empty —
  /// avoids flashing "Offline" unnecessarily on a transient error.
  Future<void> _onRefreshCurrentNode(
    RefreshCurrentNode event,
    Emitter<ProjectState> emit,
  ) async {
    final currentState = state;
    if (currentState is! EpsExplorerState) return;

    emit(currentState.copyWith(isLoadingChildren: true));

    try {
      // Re-fetch activities for the CURRENT node — same endpoint as navigation.
      // (The old code wrongly called getProjectActivities which is deprecated.)
      final activitiesResponse = await _apiClient
          .getExecutionReadyActivities(currentState.project.id, currentState.currentNode.id);
      final seen = <int>{};
      final activities = activitiesResponse
          .map<Activity>((raw) {
            final json = Map<String, dynamic>.from(raw as Map<String, dynamic>);
            if (json['epsNodeId'] == null && json['eps_node_id'] == null) {
              json['epsNodeId'] = currentState.currentNode.id;
            }
            return Activity.fromJson(json);
          })
          .where((a) => seen.add(a.id))
          .toList();

      // Update only this node's slice in the in-memory index
      final updatedIndex = Map<int, List<Activity>>.from(
        currentState.activityIndexByEpsNode,
      )..[currentState.currentNode.id] = activities;

      emit(currentState.copyWith(
        activities: activities,
        activityIndexByEpsNode: updatedIndex,
        isLoadingChildren: false,
        isOffline: false,
      ));
    } catch (e) {
      // Don't flash "Offline" on a transient error — only mark offline if
      // there's genuinely nothing to show (the list was already empty).
      emit(currentState.copyWith(
        isLoadingChildren: false,
        isOffline: currentState.activities.isEmpty,
      ));
    }
  }

  /// Transitions to [ActivitySelected] so the progress entry screen can open.
  /// Captures the current EPS node as context for the progress entry.
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

  /// Resets navigation state and re-loads the project list.
  /// Called when the user taps "Back to Projects" from within the explorer.
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
  /// Nodes without a parentId (root nodes) are excluded from the index.
  Map<int, List<Map<String, dynamic>>> _buildChildrenIndex(
    List<Map<String, dynamic>> allNodes,
  ) {
    final index = <int, List<Map<String, dynamic>>>{};
    for (final node in allNodes) {
      // Backend may use either camelCase or snake_case field names.
      final parentId = node['parentId'] as int? ?? node['parent_id'] as int?;
      if (parentId != null) {
        index.putIfAbsent(parentId, () => []).add(node);
      }
    }
    return index;
  }

  /// Recursively attaches `children` lists to a node map using the index.
  /// Children are sorted by: explicit `order` field first, then natural name order.
  /// Natural sort ensures "Floor 10" comes after "Floor 9", not after "Floor 1".
  Map<String, dynamic> _attachChildrenRecursive(
    Map<String, dynamic> node,
    Map<int, List<Map<String, dynamic>>> childrenByParentId,
  ) {
    final id = node['id'] as int? ?? 0;
    final children = List<Map<String, dynamic>>.from(
      childrenByParentId[id] ?? [],
    );
    children.sort((a, b) {
      // Prefer explicit order field; fall back to natural name comparison.
      final aOrder = (a['order'] as num?)?.toInt() ?? 999999;
      final bOrder = (b['order'] as num?)?.toInt() ?? 999999;
      if (aOrder != bOrder) return aOrder.compareTo(bOrder);
      final aName = a['name'] as String? ?? a['label'] as String? ?? '';
      final bName = b['name'] as String? ?? b['label'] as String? ?? '';
      return _naturalCompare(aName, bName);
    });
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

  /// Natural string comparison: "Floor 2" < "Floor 10" < "Floor 20".
  ///
  /// Splits strings into runs of digits and non-digits and compares each
  /// numeric segment numerically, so "10" > "2" rather than "10" < "2".
  /// Without this, "Floor 10" would sort before "Floor 2" lexicographically.
  int _naturalCompare(String a, String b) {
    final regex = RegExp(r'(\d+|\D+)');
    final aParts = regex.allMatches(a).map((m) => m.group(0)!).toList();
    final bParts = regex.allMatches(b).map((m) => m.group(0)!).toList();
    for (int i = 0; i < aParts.length && i < bParts.length; i++) {
      final ap = aParts[i];
      final bp = bParts[i];
      final an = int.tryParse(ap);
      final bn = int.tryParse(bp);
      if (an != null && bn != null) {
        // Both segments are numeric — compare as integers, not strings
        if (an != bn) return an.compareTo(bn);
      } else {
        final cmp = ap.compareTo(bp);
        if (cmp != 0) return cmp;
      }
    }
    // Shorter string sorts first when all shared segments are equal
    return aParts.length.compareTo(bParts.length);
  }

  // ---------------------------------------------------------------------------

  /// Persists a list of projects (and their EPS subtrees) to Drift.
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

    // Recursively persist the EPS node tree for each project
    for (final project in projects) {
      await _cacheEpsNodesRecursive(project.children, project.id);
    }
  }

  /// Recursively walks the EPS tree and writes each node to the local DB.
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

  /// Loads cached project records from Drift (offline fallback).
  Future<List<Project>> _loadCachedProjects() async {
    final cached = await _database.select(_database.cachedProjects).get();
    if (cached.isEmpty) return [];

    return cached.map((row) {
      final json = jsonDecode(row.rawData) as Map<String, dynamic>;
      return Project.fromJson(json);
    }).toList();
  }

  /// Reconstructs a full [EpsExplorerState] from the local Drift database.
  ///
  /// Used when the server is unreachable and a cached hierarchy exists.
  /// Rebuilds the node tree using the same parent→children approach as the
  /// live path, then restores the in-memory activity index from cached rows.
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

    // Build a quick lookup map so we can reconstruct children by parent ID
    final nodeById = <int, CachedEpsNode>{for (final node in cachedNodes) node.id: node};
    final childIdsByParent = <int?, List<int>>{};
    for (final node in cachedNodes) {
      childIdsByParent.putIfAbsent(node.parentId, () => []).add(node.id);
    }

    // Recursive helper that reassembles an EpsNode from the flat cache rows
    EpsNode buildNode(int nodeId) {
      final cachedNode = nodeById[nodeId]!;
      final children = (childIdsByParent[nodeId] ?? <int>[])
          .map(buildNode)
          .toList(growable: true)
          ..sort((a, b) => _naturalCompare(a.name, b.name));

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
        .toList(growable: true)
        ..sort((a, b) => _naturalCompare(a.name, b.name));

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

    // Rebuild the activity index keyed by epsNodeId for instant breadcrumb nav
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
