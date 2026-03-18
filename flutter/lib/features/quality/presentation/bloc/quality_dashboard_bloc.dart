import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/features/quality/data/models/dashboard_models.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ==================== EVENTS ====================

abstract class QualityDashboardEvent extends Equatable {
  const QualityDashboardEvent();
  @override
  List<Object?> get props => [];
}

/// Load the project-level summary: block cards, aggregate counts.
class LoadDashboard extends QualityDashboardEvent {
  final int projectId;
  const LoadDashboard(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

/// Refresh (re-fetch) the same project summary.
class RefreshDashboard extends QualityDashboardEvent {
  final int projectId;
  const RefreshDashboard(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

/// Load the activity detail view for a specific floor.
class LoadFloorDetail extends QualityDashboardEvent {
  final int projectId;
  final int floorId;
  final String floorLabel;
  final String? blockName;
  const LoadFloorDetail({
    required this.projectId,
    required this.floorId,
    required this.floorLabel,
    this.blockName,
  });
  @override
  List<Object?> get props => [projectId, floorId];
}

// ==================== STATES ====================

abstract class QualityDashboardState extends Equatable {
  const QualityDashboardState();
  @override
  List<Object?> get props => [];
}

class DashboardInitial extends QualityDashboardState {}

class DashboardLoading extends QualityDashboardState {
  const DashboardLoading();
}

class DashboardLoaded extends QualityDashboardState {
  final int projectId;
  final List<BlockSummary> blocks;
  final int totalInspections;
  final int approvedCount;
  final int inReviewCount;
  final int pendingCount;
  final int myPendingCount;
  /// True when data was loaded from the local cache (no network).
  final bool isOffline;

  const DashboardLoaded({
    required this.projectId,
    required this.blocks,
    required this.totalInspections,
    required this.approvedCount,
    required this.inReviewCount,
    required this.pendingCount,
    required this.myPendingCount,
    this.isOffline = false,
  });

  @override
  List<Object?> get props => [
        projectId, blocks, totalInspections, approvedCount,
        inReviewCount, pendingCount, myPendingCount, isOffline,
      ];
}

class FloorDetailLoading extends QualityDashboardState {
  final int floorId;
  final String floorLabel;
  const FloorDetailLoading({required this.floorId, required this.floorLabel});
  @override
  List<Object?> get props => [floorId, floorLabel];
}

class FloorDetailLoaded extends QualityDashboardState {
  final int projectId;
  final int floorId;
  final String floorLabel;
  final String? blockName;
  final DashboardSections sections;
  final List<QualityActivityList> lists;

  const FloorDetailLoaded({
    required this.projectId,
    required this.floorId,
    required this.floorLabel,
    this.blockName,
    required this.sections,
    required this.lists,
  });

  @override
  List<Object?> get props =>
      [projectId, floorId, floorLabel, sections, lists];
}

class DashboardError extends QualityDashboardState {
  final String message;
  const DashboardError(this.message);
  @override
  List<Object?> get props => [message];
}

class FloorDetailError extends QualityDashboardState {
  final int floorId;
  final String message;
  const FloorDetailError({required this.floorId, required this.message});
  @override
  List<Object?> get props => [floorId, message];
}

// ==================== BLOC ====================

class QualityDashboardBloc
    extends Bloc<QualityDashboardEvent, QualityDashboardState> {
  final SetuApiClient _apiClient;
  final AppDatabase _database;

  QualityDashboardBloc({
    required SetuApiClient apiClient,
    required AppDatabase database,
  })  : _apiClient = apiClient,
        _database = database,
        super(DashboardInitial()) {
    on<LoadDashboard>(_onLoadDashboard);
    on<RefreshDashboard>(
        (e, emit) => _onLoadDashboard(LoadDashboard(e.projectId), emit));
    on<LoadFloorDetail>(_onLoadFloorDetail);
  }

  // ---------------------------------------------------------------------------
  // Project Summary
  // ---------------------------------------------------------------------------

  Future<void> _onLoadDashboard(
      LoadDashboard event, Emitter<QualityDashboardState> emit) async {
    emit(const DashboardLoading());
    try {
      final projectId = event.projectId;

      // Fetch EPS tree and inspections in parallel
      final results = await Future.wait([
        _apiClient.getEpsTreeForProject(projectId),
        _apiClient.getQualityInspections(projectId: projectId),
        _apiClient.getMyPendingInspections(projectId),
      ]);

      final rawTree = results[0];
      final rawInspections = results[1];
      final rawMyPending = results[2];

      // Parse EPS tree
      final treeNodes = rawTree
          .map((e) => EpsTreeNode.fromJson(e as Map<String, dynamic>))
          .toList();

      // Parse inspections
      final inspections = rawInspections
          .map((e) => QualityInspection.fromJson(e as Map<String, dynamic>))
          .toList();

      // Build inspection lookup: epsNodeId → list of inspections
      final inspByFloor = <int, List<QualityInspection>>{};
      for (final insp in inspections) {
        if (insp.epsNodeId != null) {
          inspByFloor.putIfAbsent(insp.epsNodeId!, () => []).add(insp);
        }
      }

      // Aggregate counts
      int approved = 0, inReview = 0, pending = 0;
      for (final insp in inspections) {
        switch (insp.status) {
          case InspectionStatus.approved:
          case InspectionStatus.provisionallyApproved:
            approved++;
            break;
          case InspectionStatus.pending:
          case InspectionStatus.partiallyApproved:
            inReview++;
            break;
          case InspectionStatus.rejected:
            pending++;
            break;
          default:
            break;
        }
      }

      // Build BlockSummary list from EPS tree
      final blocks = _buildBlockSummaries(treeNodes, inspByFloor);

      emit(DashboardLoaded(
        projectId: projectId,
        blocks: blocks,
        totalInspections: inspections.length,
        approvedCount: approved,
        inReviewCount: inReview,
        pendingCount: pending,
        myPendingCount: rawMyPending.length,
      ));
    } catch (e) {
      // Network failed — attempt to build dashboard from cached data.
      try {
        final cachedNodes =
            await _database.getEpsNodesForProject(event.projectId);
        if (cachedNodes.isNotEmpty) {
          // Rebuild EpsTreeNode hierarchy from flat cached list.
          final treeNodes = _buildCachedTree(cachedNodes);
          // No inspection data available offline — empty map gives 0 counts.
          final blocks = _buildBlockSummaries(treeNodes, {});
          emit(DashboardLoaded(
            projectId: event.projectId,
            blocks: blocks,
            totalInspections: 0,
            approvedCount: 0,
            inReviewCount: 0,
            pendingCount: 0,
            myPendingCount: 0,
            isOffline: true,
          ));
          return;
        }
      } catch (_) {
        // Cache read failed — fall through to error state.
      }
      emit(DashboardError(_friendly(e)));
    }
  }

  /// Reconstructs an [EpsTreeNode] hierarchy from a flat list of cached rows.
  ///
  /// The flat list is stored with parent IDs; this method assembles it into
  /// a proper tree so [_buildBlockSummaries] can traverse it normally.
  List<EpsTreeNode> _buildCachedTree(List<CachedEpsNode> rows) {
    final nodeMap = <int, EpsTreeNode>{};
    // First pass: create all nodes from cached properties.
    for (final row in rows) {
      nodeMap[row.id] = EpsTreeNode(
        id: row.id,
        label: row.name,
        type: row.type,
        children: const [], // populated in second pass
      );
    }
    // Second pass: wire children.
    final childrenMap = <int, List<EpsTreeNode>>{};
    final roots = <EpsTreeNode>[];
    for (final row in rows) {
      if (row.parentId != null && nodeMap.containsKey(row.parentId)) {
        childrenMap.putIfAbsent(row.parentId!, () => []).add(nodeMap[row.id]!);
      } else {
        roots.add(nodeMap[row.id]!);
      }
    }
    // Third pass: attach children lists (EpsTreeNode is immutable, so rebuild).
    EpsTreeNode withChildren(EpsTreeNode node) {
      final kids = childrenMap[node.id] ?? [];
      return EpsTreeNode(
        id: node.id,
        label: node.label,
        type: node.type,
        children: kids.map(withChildren).toList(),
      );
    }
    return roots.map(withChildren).toList();
  }

  /// Walks the EPS tree recursively to collect all BLOCK/TOWER nodes,
  /// deriving [BlockSummary] with their child FLOOR summaries.
  List<BlockSummary> _buildBlockSummaries(
    List<EpsTreeNode> nodes,
    Map<int, List<QualityInspection>> inspByFloor,
  ) {
    final blocks = <BlockSummary>[];
    for (final node in nodes) {
      _collectBlocks(node, inspByFloor, blocks, null);
    }
    return blocks;
  }

  void _collectBlocks(
    EpsTreeNode node,
    Map<int, List<QualityInspection>> inspByFloor,
    List<BlockSummary> blocks,
    String? parentName,
  ) {
    final type = node.type?.toUpperCase() ?? '';
    final isFloorLevel = type == 'FLOOR' || type == 'UNIT' || type == 'ROOM';
    final isBlockOrTower = type == 'BLOCK' || type == 'TOWER' || type == 'PROJECT';

    if (isBlockOrTower) {
      // Collect all FLOOR-type descendants
      final floors = <FloorSummary>[];
      _collectFloors(node.children, inspByFloor, floors);

      if (floors.isNotEmpty) {
        int total = 0, appCount = 0, inRev = 0, needsAct = 0, withObs = 0;
        for (final f in floors) {
          total += f.totalActivities;
          appCount += f.approvedCount;
          // Derive inReview/needsAction from floor status
          if (f.status == FloorStatus.awaitingApproval ||
              f.status == FloorStatus.inProgress) {
            inRev += f.pendingCount;
          } else if (f.status == FloorStatus.needsAction) {
            needsAct += f.pendingCount;
          }
          final floorInsps = inspByFloor[f.floorId] ?? [];
          withObs += floorInsps
              .where((i) => i.pendingObservationCount > 0)
              .length;
        }
        blocks.add(BlockSummary(
          epsNodeId: node.id,
          name: node.label,
          towerName: parentName,
          total: total,
          approved: appCount,
          inReview: inRev,
          pending: needsAct,
          withObservation: withObs,
          floors: floors,
        ));
      }
      // Also recurse into children for nested structures
      for (final child in node.children) {
        _collectBlocks(child, inspByFloor, blocks, node.label);
      }
    } else if (!isFloorLevel) {
      // Unknown type — recurse to find blocks inside
      for (final child in node.children) {
        _collectBlocks(child, inspByFloor, blocks, parentName ?? node.label);
      }
    }
  }

  void _collectFloors(
    List<EpsTreeNode> nodes,
    Map<int, List<QualityInspection>> inspByFloor,
    List<FloorSummary> floors,
  ) {
    for (final node in nodes) {
      final type = node.type?.toUpperCase() ?? '';
      if (type == 'FLOOR') {
        final insps = inspByFloor[node.id] ?? [];
        final approvedCount = insps
            .where((i) =>
                i.status == InspectionStatus.approved ||
                i.status == InspectionStatus.provisionallyApproved)
            .length;
        final inReviewCount = insps
            .where((i) =>
                i.status == InspectionStatus.pending ||
                i.status == InspectionStatus.partiallyApproved)
            .length;
        final rejectedCount = insps
            .where((i) => i.status == InspectionStatus.rejected)
            .length;
        final obsCount =
            insps.where((i) => i.pendingObservationCount > 0).length;
        final total = insps.length;

        final needsActionCount = rejectedCount + obsCount;
        final status = deriveFloorStatus(
          total: total,
          approved: approvedCount,
          inReview: inReviewCount,
          needsActionCount: needsActionCount,
        );

        floors.add(FloorSummary(
          floorId: node.id,
          label: node.label,
          status: status,
          totalActivities: total,
          approvedCount: approvedCount,
          pendingCount: total - approvedCount,
        ));
      } else if (type != 'UNIT' && type != 'ROOM') {
        // Could be a TOWER containing floors — recurse
        _collectFloors(node.children, inspByFloor, floors);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Floor Detail
  // ---------------------------------------------------------------------------

  Future<void> _onLoadFloorDetail(
      LoadFloorDetail event, Emitter<QualityDashboardState> emit) async {
    emit(FloorDetailLoading(
        floorId: event.floorId, floorLabel: event.floorLabel));
    try {
      final projectId = event.projectId;
      final floorId = event.floorId;

      // Fetch activity lists, inspections, and floor structure in parallel
      final results = await Future.wait([
        _apiClient.getQualityActivityLists(
            projectId: projectId, epsNodeId: floorId),
        _apiClient.getQualityInspections(
            projectId: projectId, epsNodeId: floorId),
        _safeGetFloorStructure(projectId, floorId),
      ]);

      final rawLists = results[0];
      final rawInspections = results[1];
      final floorUnits = results[2] as List<Map<String, dynamic>>;

      final lists = rawLists
          .map((e) => QualityActivityList.fromJson(e as Map<String, dynamic>))
          .toList();
      final inspections = rawInspections
          .map((e) => QualityInspection.fromJson(e as Map<String, dynamic>))
          .toList();

      // Load all activities for all lists in parallel
      final activitiesByList = await Future.wait(
        lists.map((list) => _apiClient.getQualityListActivities(list.id)),
      );

      // Flatten all activities
      final allActivities = <QualityActivity>[];
      for (final raw in activitiesByList) {
        for (final e in raw) {
          allActivities
              .add(QualityActivity.fromJson(e as Map<String, dynamic>));
        }
      }

      // Build inspection maps
      final inspMap = <int, QualityInspection>{};
      final inspListMap = <int, List<QualityInspection>>{};
      for (final i in inspections) {
        if (!inspMap.containsKey(i.activityId)) inspMap[i.activityId] = i;
        inspListMap.putIfAbsent(i.activityId, () => []).add(i);
      }

      // Build ActivityRow list (mirrors QualityRequestBloc._buildRows)
      final rows =
          _buildRows(allActivities, inspMap, inspListMap, floorUnits);

      final sections = buildSections(rows);

      emit(FloorDetailLoaded(
        projectId: projectId,
        floorId: floorId,
        floorLabel: event.floorLabel,
        blockName: event.blockName,
        sections: sections,
        lists: lists,
      ));
    } catch (e) {
      emit(FloorDetailError(floorId: event.floorId, message: _friendly(e)));
    }
  }

  List<ActivityRow> _buildRows(
    List<QualityActivity> activities,
    Map<int, QualityInspection> inspMap,
    Map<int, List<QualityInspection>> inspListMap,
    List<Map<String, dynamic>> floorUnits,
  ) {
    return activities.map((act) {
      final inspection = inspMap[act.id];

      // Check predecessor chain
      bool predecessorDone = true;
      if (act.incomingEdges.isNotEmpty) {
        for (final edge in act.incomingEdges) {
          final prevInsp = inspMap[edge.sourceId];
          if (prevInsp == null ||
              prevInsp.status != InspectionStatus.approved) {
            predecessorDone = false;
            break;
          }
        }
      } else if (act.previousActivityId != null) {
        final prevInsp = inspMap[act.previousActivityId!];
        if (prevInsp == null ||
            prevInsp.status != InspectionStatus.approved) {
          predecessorDone = false;
        }
      }

      // Compute display status
      ActivityDisplayStatus displayStatus;
      if (act.status == 'PENDING_OBSERVATION') {
        displayStatus = ActivityDisplayStatus.pendingObservation;
      } else if (inspection != null) {
        switch (inspection.status) {
          case InspectionStatus.pending:
          case InspectionStatus.partiallyApproved:
            displayStatus = ActivityDisplayStatus.pending;
            break;
          case InspectionStatus.approved:
            displayStatus = ActivityDisplayStatus.approved;
            break;
          case InspectionStatus.provisionallyApproved:
            displayStatus = ActivityDisplayStatus.provisionallyApproved;
            break;
          case InspectionStatus.rejected:
            displayStatus = ActivityDisplayStatus.rejected;
            break;
          default:
            displayStatus = ActivityDisplayStatus.locked;
        }
      } else {
        displayStatus = (predecessorDone || act.allowBreak)
            ? ActivityDisplayStatus.ready
            : ActivityDisplayStatus.locked;
      }

      return ActivityRow(
        activity: act,
        inspection: inspection,
        displayStatus: displayStatus,
        predecessorDone: predecessorDone,
        allInspections: inspListMap[act.id] ?? [],
        floorUnits:
            act.applicabilityLevel == 'UNIT' ? floorUnits : const [],
      );
    }).toList();
  }

  Future<List<Map<String, dynamic>>> _safeGetFloorStructure(
      int projectId, int floorId) async {
    try {
      return await _apiClient.getFloorStructure(projectId, floorId);
    } catch (_) {
      return [];
    }
  }

  String _friendly(Object e) {
    final msg = e.toString();
    if (msg.contains('SocketException') || msg.contains('Connection refused')) {
      return 'Cannot reach server. Check your connection.';
    }
    if (msg.contains('401') || msg.contains('Unauthorized')) {
      return 'Session expired. Please log in again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
