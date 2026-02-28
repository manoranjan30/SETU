import 'dart:convert';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ==================== EVENTS ====================

abstract class QualityRequestEvent extends Equatable {
  const QualityRequestEvent();
  @override
  List<Object?> get props => [];
}

/// Load EPS tree for location picker
class LoadEpsTree extends QualityRequestEvent {
  final int projectId;
  const LoadEpsTree(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

/// User selected an EPS node — load activity lists for it
class SelectEpsNode extends QualityRequestEvent {
  final int projectId;
  final int epsNodeId;
  const SelectEpsNode({required this.projectId, required this.epsNodeId});
  @override
  List<Object?> get props => [projectId, epsNodeId];
}

/// User selected a list — load activities + inspections
class SelectActivityList extends QualityRequestEvent {
  final QualityActivityList list;
  final int projectId;
  final int epsNodeId;
  const SelectActivityList({
    required this.list,
    required this.projectId,
    required this.epsNodeId,
  });
  @override
  List<Object?> get props => [list.id, projectId, epsNodeId];
}

/// Raise an RFI for an activity
class RaiseRfi extends QualityRequestEvent {
  final int projectId;
  final int epsNodeId;
  final int listId;
  final QualityActivity activity;
  final String? comments;
  const RaiseRfi({
    required this.projectId,
    required this.epsNodeId,
    required this.listId,
    required this.activity,
    this.comments,
  });
  @override
  List<Object?> get props => [projectId, epsNodeId, listId, activity.id];
}

/// Upload a rectification photo for an observation
class UploadRectificationPhoto extends QualityRequestEvent {
  final String obsId;
  final String filePath;
  const UploadRectificationPhoto({required this.obsId, required this.filePath});
  @override
  List<Object?> get props => [obsId, filePath];
}

/// Submit rectification for an observation
class SubmitRectification extends QualityRequestEvent {
  final int activityId;
  final String obsId;
  final String closureText;
  final List<String> closureEvidence;
  const SubmitRectification({
    required this.activityId,
    required this.obsId,
    required this.closureText,
    this.closureEvidence = const [],
  });
  @override
  List<Object?> get props => [activityId, obsId];
}

/// Reload the current list (after RFI raised or observation resolved)
class RefreshCurrentList extends QualityRequestEvent {
  const RefreshCurrentList();
}

// ==================== STATES ====================

abstract class QualityRequestState extends Equatable {
  const QualityRequestState();
  @override
  List<Object?> get props => [];
}

class QualityRequestInitial extends QualityRequestState {}

class QualityRequestLoading extends QualityRequestState {}

class EpsTreeLoaded extends QualityRequestState {
  final List<EpsTreeNode> nodes;
  final int projectId;
  const EpsTreeLoaded({required this.nodes, required this.projectId});
  @override
  List<Object?> get props => [nodes, projectId];
}

class ActivityListsLoaded extends QualityRequestState {
  final List<QualityActivityList> lists;
  final int projectId;
  final int epsNodeId;
  final bool isFromCache;
  const ActivityListsLoaded({
    required this.lists,
    required this.projectId,
    required this.epsNodeId,
    this.isFromCache = false,
  });
  @override
  List<Object?> get props => [lists, projectId, epsNodeId, isFromCache];
}

class ActivitiesLoaded extends QualityRequestState {
  final QualityActivityList list;
  final List<ActivityRow> rows;
  final int projectId;
  final int epsNodeId;
  final bool isFromCache;
  const ActivitiesLoaded({
    required this.list,
    required this.rows,
    required this.projectId,
    required this.epsNodeId,
    this.isFromCache = false,
  });
  @override
  List<Object?> get props => [list.id, rows, isFromCache];
}

class RfiQueued extends QualityRequestState {
  final bool isOffline;
  final int pendingSyncCount;
  const RfiQueued({required this.isOffline, required this.pendingSyncCount});
  @override
  List<Object?> get props => [isOffline, pendingSyncCount];
}

class PhotoUploaded extends QualityRequestState {
  final String obsId;
  final String url;
  const PhotoUploaded({required this.obsId, required this.url});
  @override
  List<Object?> get props => [obsId, url];
}

class RectificationQueued extends QualityRequestState {
  final bool isOffline;
  final int pendingSyncCount;
  const RectificationQueued(
      {required this.isOffline, required this.pendingSyncCount});
  @override
  List<Object?> get props => [isOffline, pendingSyncCount];
}

class QualityRequestError extends QualityRequestState {
  final String message;
  const QualityRequestError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class QualityRequestBloc
    extends Bloc<QualityRequestEvent, QualityRequestState> {
  final SetuApiClient _apiClient;
  final AppDatabase _database;
  final SyncService _syncService;

  // Keep context for refresh
  QualityActivityList? _currentList;
  int? _currentProjectId;
  int? _currentEpsNodeId;

  QualityRequestBloc({
    required SetuApiClient apiClient,
    required AppDatabase database,
    required SyncService syncService,
  })  : _apiClient = apiClient,
        _database = database,
        _syncService = syncService,
        super(QualityRequestInitial()) {
    on<LoadEpsTree>(_onLoadEpsTree);
    on<SelectEpsNode>(_onSelectEpsNode);
    on<SelectActivityList>(_onSelectActivityList);
    on<RaiseRfi>(_onRaiseRfi);
    on<UploadRectificationPhoto>(_onUploadRectificationPhoto);
    on<SubmitRectification>(_onSubmitRectification);
    on<RefreshCurrentList>(_onRefreshCurrentList);
  }

  Future<void> _onLoadEpsTree(
      LoadEpsTree event, Emitter<QualityRequestState> emit) async {
    emit(QualityRequestLoading());
    try {
      final raw = await _apiClient.getEpsTreeForProject(event.projectId);
      final nodes = raw
          .map((e) => EpsTreeNode.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(EpsTreeLoaded(nodes: nodes, projectId: event.projectId));
    } catch (e) {
      emit(QualityRequestError(_friendly(e)));
    }
  }

  Future<void> _onSelectEpsNode(
      SelectEpsNode event, Emitter<QualityRequestState> emit) async {
    emit(QualityRequestLoading());
    try {
      final raw = await _apiClient.getQualityActivityLists(
        projectId: event.projectId,
        epsNodeId: event.epsNodeId,
      );
      // Cache for offline
      await _database.cacheActivityLists(
          raw.cast<Map<String, dynamic>>(), event.projectId);

      final lists = raw
          .map((e) =>
              QualityActivityList.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(ActivityListsLoaded(
        lists: lists,
        projectId: event.projectId,
        epsNodeId: event.epsNodeId,
      ));
    } catch (_) {
      // Serve from cache
      final cached = await _database.getCachedActivityLists(
          event.projectId, event.epsNodeId);
      if (cached.isNotEmpty) {
        final lists = cached
            .map((c) => QualityActivityList.fromJson(
                jsonDecode(c.rawData ?? '{}') as Map<String, dynamic>))
            .toList();
        emit(ActivityListsLoaded(
          lists: lists,
          projectId: event.projectId,
          epsNodeId: event.epsNodeId,
          isFromCache: true,
        ));
      } else {
        emit(const QualityRequestError(
            'No connection and no cached data. Connect to load checklists.'));
      }
    }
  }

  Future<void> _onSelectActivityList(
      SelectActivityList event, Emitter<QualityRequestState> emit) async {
    _currentList = event.list;
    _currentProjectId = event.projectId;
    _currentEpsNodeId = event.epsNodeId;
    emit(QualityRequestLoading());
    await _loadActivities(emit,
        list: event.list,
        projectId: event.projectId,
        epsNodeId: event.epsNodeId);
  }

  Future<void> _onRefreshCurrentList(
      RefreshCurrentList event, Emitter<QualityRequestState> emit) async {
    if (_currentList == null ||
        _currentProjectId == null ||
        _currentEpsNodeId == null) {
      return;
    }
    emit(QualityRequestLoading());
    await _loadActivities(emit,
        list: _currentList!,
        projectId: _currentProjectId!,
        epsNodeId: _currentEpsNodeId!);
  }

  Future<void> _loadActivities(
    Emitter<QualityRequestState> emit, {
    required QualityActivityList list,
    required int projectId,
    required int epsNodeId,
  }) async {
    try {
      // Fetch activities + inspections in parallel
      final results = await Future.wait([
        _apiClient.getQualityListActivities(list.id),
        _apiClient.getQualityInspections(
          projectId: projectId,
          epsNodeId: epsNodeId,
          listId: list.id,
        ),
      ]);

      final activitiesRaw = results[0];
      final inspectionsRaw = results[1];

      final activities = activitiesRaw
          .map((e) => QualityActivity.fromJson(e as Map<String, dynamic>))
          .toList();
      final inspections = inspectionsRaw
          .map((e) =>
              QualityInspection.fromJson(e as Map<String, dynamic>))
          .toList();

      // Cache for offline
      await _database.cacheQualityActivities(
          activitiesRaw.cast<Map<String, dynamic>>(),
          list.id,
          projectId,
          epsNodeId);

      // Map latest inspection per activityId
      final inspMap = <int, QualityInspection>{};
      for (final i in inspections) {
        if (!inspMap.containsKey(i.activityId)) inspMap[i.activityId] = i;
      }

      // Fetch observations for PENDING_OBSERVATION activities
      final pendingObsActivities =
          activities.where((a) => a.status == 'PENDING_OBSERVATION').toList();
      final obsMap = <int, List<ActivityObservation>>{};
      if (pendingObsActivities.isNotEmpty) {
        final obsFutures = pendingObsActivities.map((a) => _apiClient
            .getActivityObservations(a.id)
            .then((raw) => MapEntry(
                a.id,
                raw
                    .map((e) => ActivityObservation.fromJson(
                        e as Map<String, dynamic>))
                    .toList()))
            .catchError((_) => MapEntry(a.id, <ActivityObservation>[])));
        final obsResults = await Future.wait(obsFutures);
        for (final e in obsResults) {
          obsMap[e.key] = e.value;
        }
      }

      final rows = _buildRows(activities, inspMap, obsMap);
      emit(ActivitiesLoaded(
        list: list,
        rows: rows,
        projectId: projectId,
        epsNodeId: epsNodeId,
      ));
    } catch (_) {
      // Serve from cache
      final cached = await _database.getCachedQualityActivities(list.id);
      if (cached.isNotEmpty) {
        final activities = cached
            .map((c) => QualityActivity.fromJson(
                jsonDecode(c.rawData ?? '{}') as Map<String, dynamic>))
            .toList();
        final rows = _buildRows(activities, {}, {});
        emit(ActivitiesLoaded(
          list: list,
          rows: rows,
          projectId: projectId,
          epsNodeId: epsNodeId,
          isFromCache: true,
        ));
      } else {
        emit(const QualityRequestError(
            'No connection and no cached data. Connect to load activities.'));
      }
    }
  }

  List<ActivityRow> _buildRows(
    List<QualityActivity> activities,
    Map<int, QualityInspection> inspMap,
    Map<int, List<ActivityObservation>> obsMap,
  ) {
    return activities.map((act) {
      final inspection = inspMap[act.id];

      // Predecessor check
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
        observations: obsMap[act.id] ?? [],
      );
    }).toList();
  }

  Future<void> _onRaiseRfi(
      RaiseRfi event, Emitter<QualityRequestState> emit) async {
    emit(QualityRequestLoading());
    try {
      // 1. Queue the action locally first
      await _syncService.addToQueue(
        entityType: 'quality_rfi',
        entityId: event.activity.id,
        operation: 'create',
        payload: {
          'projectId': event.projectId,
          'epsNodeId': event.epsNodeId,
          'listId': event.listId,
          'activityId': event.activity.id,
          if (event.comments != null && event.comments!.isNotEmpty)
            'comments': event.comments,
        },
        priority: 2,
      );

      // 2. Optimistically update cached activity status
      await _database.updateCachedActivityStatus(
          event.activity.id, 'RFI_RAISED');

      // 3. Try to sync immediately
      final syncResult = await _syncService.syncAll();
      final pending = await _syncService.getPendingSyncCount();

      emit(RfiQueued(isOffline: !syncResult.success, pendingSyncCount: pending));
    } catch (e) {
      emit(QualityRequestError(_friendly(e)));
    }
  }

  Future<void> _onUploadRectificationPhoto(
      UploadRectificationPhoto event,
      Emitter<QualityRequestState> emit) async {
    try {
      final result = await _apiClient.uploadFile(filePath: event.filePath);
      final url = result['url'] as String? ?? result['path'] as String? ?? '';
      emit(PhotoUploaded(obsId: event.obsId, url: url));
    } catch (e) {
      emit(QualityRequestError('Photo upload failed: ${_friendly(e)}'));
    }
  }

  Future<void> _onSubmitRectification(
      SubmitRectification event, Emitter<QualityRequestState> emit) async {
    emit(QualityRequestLoading());
    try {
      await _syncService.addToQueue(
        entityType: 'quality_obs_resolve',
        entityId: event.activityId,
        operation: 'update',
        payload: {
          'activityId': event.activityId,
          'obsId': event.obsId,
          'closureText': event.closureText,
          if (event.closureEvidence.isNotEmpty)
            'closureEvidence': event.closureEvidence,
        },
        priority: 2,
      );

      final syncResult = await _syncService.syncAll();
      final pending = await _syncService.getPendingSyncCount();

      emit(RectificationQueued(
          isOffline: !syncResult.success, pendingSyncCount: pending));
    } catch (e) {
      emit(QualityRequestError(_friendly(e)));
    }
  }

  String _friendly(dynamic e) {
    final s = e.toString().toLowerCase();
    if (s.contains('connection') || s.contains('network') || s.contains('socket')) {
      return 'No connection to server. Data saved and will sync when online.';
    }
    if (s.contains('403') || s.contains('forbidden')) {
      return 'You do not have permission for this action.';
    }
    if (s.contains('400') || s.contains('bad request')) {
      // Try to extract backend message
      final msg = RegExp(r'"message":"([^"]+)"').firstMatch(e.toString());
      return msg?.group(1) ?? 'Invalid request. Please check and try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
