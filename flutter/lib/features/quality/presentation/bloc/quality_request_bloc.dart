import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/api_exceptions.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ==================== EVENTS ====================

/// Base class for all quality request (RFI workflow) events.
abstract class QualityRequestEvent extends Equatable {
  const QualityRequestEvent();
  @override
  List<Object?> get props => [];
}

/// Load the EPS location tree for the RFI location picker.
class LoadEpsTree extends QualityRequestEvent {
  final int projectId;
  const LoadEpsTree(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

/// User selected an EPS node — load the checklist lists available there.
class SelectEpsNode extends QualityRequestEvent {
  final int projectId;
  final int epsNodeId;
  const SelectEpsNode({required this.projectId, required this.epsNodeId});
  @override
  List<Object?> get props => [projectId, epsNodeId];
}

/// User selected a checklist list — load activities + inspections merged together.
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

/// Raise an RFI (Request for Inspection) for a specific quality activity.
///
/// Supports three modes driven by [activity.applicabilityLevel]:
///   • FLOOR + [totalParts]=1  → One Go (single inspection for whole floor)
///   • FLOOR + [totalParts]>1  → Multi Go (Part [partNo] of [totalParts])
///   • UNIT                    → Unit Wise ([qualityUnitId] identifies the unit)
///
/// [documentType] mirrors the web app: 'FLOOR_RFI', 'UNIT_RFI', or 'ROOM_RFI'.
/// [vendorId] links the RFI to the contractor whose work is being inspected.
class RaiseRfi extends QualityRequestEvent {
  final int projectId;
  final int epsNodeId;
  final int listId;
  final QualityActivity activity;
  final String? comments;

  // Multi-part RFI support
  final int partNo;
  final int totalParts;
  final String? partLabel;

  // Vendor context (optional — selected by site engineer)
  final int? vendorId;
  final String? vendorName;

  // Unit Wise RFI support
  final int? qualityUnitId;

  // Document type sent to backend: FLOOR_RFI | UNIT_RFI | ROOM_RFI
  final String? documentType;

  // Required by backend — reference drawing for the inspection
  final String drawingNo;

  const RaiseRfi({
    required this.projectId,
    required this.epsNodeId,
    required this.listId,
    required this.activity,
    required this.drawingNo,
    this.comments,
    this.partNo = 1,
    this.totalParts = 1,
    this.partLabel,
    this.vendorId,
    this.vendorName,
    this.qualityUnitId,
    this.documentType,
  });
  @override
  List<Object?> get props => [
        projectId,
        epsNodeId,
        listId,
        activity.id,
        partNo,
        totalParts,
        vendorId,
        qualityUnitId,
      ];
}

/// Upload a photo to the server as part of a rectification submission.
/// Emits [PhotoUploaded] with the server URL on success.
class UploadRectificationPhoto extends QualityRequestEvent {
  final String obsId;
  final String filePath;
  const UploadRectificationPhoto({required this.obsId, required this.filePath});
  @override
  List<Object?> get props => [obsId, filePath];
}

/// Submit a rectification (fix response) for an observation with evidence.
/// Queued offline-first; the server link is made when sync runs.
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

/// Reload the current list after an RFI is raised or an observation is resolved.
class RefreshCurrentList extends QualityRequestEvent {
  const RefreshCurrentList();
}

// ==================== STATES ====================

/// Base class for all quality request states.
abstract class QualityRequestState extends Equatable {
  const QualityRequestState();
  @override
  List<Object?> get props => [];
}

/// Identifies what triggered a loading state so the UI can decide whether to
/// show a full-screen spinner or just an inline indicator over existing data.
enum QrLoadingSource { listLoad, rfiRaise, rectification, refresh }

/// Initial state before any data is loaded.
class QualityRequestInitial extends QualityRequestState {}

/// Loading indicator — [source] tells the UI whether to show a full-screen
/// spinner (listLoad) or a small in-page spinner (rfiRaise/refresh).
class QualityRequestLoading extends QualityRequestState {
  final QrLoadingSource source;
  const QualityRequestLoading({this.source = QrLoadingSource.listLoad});
  @override
  List<Object?> get props => [source];
}

/// EPS location tree loaded — displayed in the location picker.
class EpsTreeLoaded extends QualityRequestState {
  final List<EpsTreeNode> nodes;
  final int projectId;
  const EpsTreeLoaded({required this.nodes, required this.projectId});
  @override
  List<Object?> get props => [nodes, projectId];
}

/// Checklist lists loaded for the selected EPS node.
/// [isFromCache] = true means we are showing offline data.
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

/// Activities loaded and merged with inspections/observations into [ActivityRow]s.
/// [isFromCache] = true means we are showing offline data.
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

/// RFI was queued (and optionally synced to server).
/// [isOffline] = true means it will sync when connectivity is restored.
class RfiQueued extends QualityRequestState {
  final bool isOffline;
  final int pendingSyncCount;
  const RfiQueued({required this.isOffline, required this.pendingSyncCount});
  @override
  List<Object?> get props => [isOffline, pendingSyncCount];
}

/// A rectification photo was uploaded and the server URL is available.
class PhotoUploaded extends QualityRequestState {
  final String obsId;
  final String url;
  const PhotoUploaded({required this.obsId, required this.url});
  @override
  List<Object?> get props => [obsId, url];
}

/// Rectification was queued (and optionally synced).
class RectificationQueued extends QualityRequestState {
  final bool isOffline;
  final int pendingSyncCount;
  const RectificationQueued(
      {required this.isOffline, required this.pendingSyncCount});
  @override
  List<Object?> get props => [isOffline, pendingSyncCount];
}

/// An error occurred — the UI shows this message inline.
class QualityRequestError extends QualityRequestState {
  final String message;
  const QualityRequestError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

/// Manages the site engineer's quality request (RFI) workflow.
///
/// Key responsibilities:
///   1. Load the EPS tree for location selection.
///   2. Load checklist lists for a node.
///   3. Load activities + inspections + observations, merge into [ActivityRow]s,
///      and compute [ActivityDisplayStatus] (locked / ready / pending / approved
///      / rejected / pendingObservation) from the predecessor chain.
///   4. Raise RFIs offline-first (queue → sync).
///   5. Submit rectifications with photo evidence offline-first.
class QualityRequestBloc
    extends Bloc<QualityRequestEvent, QualityRequestState> {
  final SetuApiClient _apiClient;
  final AppDatabase _database;
  final SyncService _syncService;

  // Stash current list context so [RefreshCurrentList] can re-run _loadActivities
  // without needing to carry the IDs through a separate event.
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
    emit(const QualityRequestLoading());
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

  /// Loads checklist lists for the selected EPS node.
  /// On network failure, falls back to the local cache. Non-network errors
  /// (403, 400, 500) are NOT cached-through — they surface immediately.
  Future<void> _onSelectEpsNode(
      SelectEpsNode event, Emitter<QualityRequestState> emit) async {
    emit(const QualityRequestLoading());
    try {
      final raw = await _apiClient.getQualityActivityLists(
        projectId: event.projectId,
        epsNodeId: event.epsNodeId,
      );
      // Cache for offline use
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
    } catch (e) {
      // Non-network errors must surface immediately — don't fall through to cache.
      if (_isNonNetworkError(e)) {
        emit(QualityRequestError(_friendly(e)));
        return;
      }
      // Network / timeout errors → serve from cache
      final cached = await _database.getCachedActivityLists(
          event.projectId, event.epsNodeId);
      if (cached.isNotEmpty) {
        final lists = cached
            .map((c) => QualityActivityList.fromJson(
                jsonDecode(c.rawData) as Map<String, dynamic>))
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

  /// Saves current list context (for refresh) and delegates to [_loadActivities].
  Future<void> _onSelectActivityList(
      SelectActivityList event, Emitter<QualityRequestState> emit) async {
    _currentList = event.list;
    _currentProjectId = event.projectId;
    _currentEpsNodeId = event.epsNodeId;
    emit(const QualityRequestLoading());
    await _loadActivities(emit,
        list: event.list,
        projectId: event.projectId,
        epsNodeId: event.epsNodeId);
  }

  /// Re-runs [_loadActivities] using the stashed context from the last
  /// [SelectActivityList] call. No-ops if context is not set.
  Future<void> _onRefreshCurrentList(
      RefreshCurrentList event, Emitter<QualityRequestState> emit) async {
    if (_currentList == null ||
        _currentProjectId == null ||
        _currentEpsNodeId == null) {
      return;
    }
    // Use the refresh source so the UI shows only a shimmer, not a full spinner.
    emit(const QualityRequestLoading(source: QrLoadingSource.refresh));
    await _loadActivities(emit,
        list: _currentList!,
        projectId: _currentProjectId!,
        epsNodeId: _currentEpsNodeId!);
  }

  /// Core data-loading method: fetches activities, inspections, and observations
  /// in parallel, then merges them into [ActivityRow] list via [_buildRows].
  ///
  /// Parallel fetch strategy:
  ///   - Activities and inspections are fetched simultaneously (Future.wait).
  ///   - A 5-second timeout is applied — if exceeded, cached data is served.
  ///   - Observations are only fetched for PENDING_OBSERVATION activities to
  ///     minimise network cost.
  Future<void> _loadActivities(
    Emitter<QualityRequestState> emit, {
    required QualityActivityList list,
    required int projectId,
    required int epsNodeId,
  }) async {
    try {
      // Fetch activities + inspections in parallel.
      // 5-second timeout — if exceeded the catch block serves cached data.
      final results = await Future.wait([
        _apiClient.getQualityListActivities(list.id),
        _apiClient.getQualityInspections(
          projectId: projectId,
          epsNodeId: epsNodeId,
          listId: list.id,
        ),
      ]).timeout(const Duration(seconds: 5));

      final activitiesRaw = results[0];
      final inspectionsRaw = results[1];

      final activities = activitiesRaw
          .map((e) => QualityActivity.fromJson(e as Map<String, dynamic>))
          .toList();
      final inspections = inspectionsRaw
          .map((e) =>
              QualityInspection.fromJson(e as Map<String, dynamic>))
          .toList();

      // Cache activities for offline use
      await _database.cacheQualityActivities(
          activitiesRaw.cast<Map<String, dynamic>>(),
          list.id,
          projectId,
          epsNodeId);

      // Build inspection maps keyed by activityId.
      // inspMap: latest inspection per activity (for status computation).
      // inspListMap: ALL inspections per activity (for multi-go / unit progress).
      final inspMap = <int, QualityInspection>{};
      final inspListMap = <int, List<QualityInspection>>{};
      for (final i in inspections) {
        if (!inspMap.containsKey(i.activityId)) inspMap[i.activityId] = i;
        inspListMap.putIfAbsent(i.activityId, () => []).add(i);
      }

      // Only fetch observations for activities that are PENDING_OBSERVATION
      // (i.e. the QC inspector raised an issue). Skip others to save bandwidth.
      final pendingObsActivities =
          activities.where((a) => a.status == 'PENDING_OBSERVATION').toList();
      final obsMap = <int, List<ActivityObservation>>{};
      if (pendingObsActivities.isNotEmpty) {
        // Fire all observation fetches in parallel; individual failures are
        // swallowed with catchError so one bad activity doesn't fail the page.
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

      // For UNIT activities, fetch the floor structure so the card can show
      // individual unit chips ("Raise 101", "Raise 102" etc.). Failure is
      // swallowed — the card degrades gracefully without unit names.
      List<Map<String, dynamic>> floorUnits = [];
      final hasUnitActivities =
          activities.any((a) => a.applicabilityLevel == 'UNIT');
      if (hasUnitActivities) {
        try {
          floorUnits =
              await _apiClient.getFloorStructure(projectId, epsNodeId);
        } catch (_) {
          // Non-critical — unit chips will not show unraised units without this.
        }
      }

      final rows = _buildRows(activities, inspMap, inspListMap, obsMap, floorUnits);
      emit(ActivitiesLoaded(
        list: list,
        rows: rows,
        projectId: projectId,
        epsNodeId: epsNodeId,
      ));
    } catch (e) {
      // Non-network errors must surface immediately — don't fall through to cache.
      if (_isNonNetworkError(e)) {
        emit(QualityRequestError(_friendly(e)));
        return;
      }
      // Network / timeout errors → serve from cache
      final cached = await _database.getCachedQualityActivities(list.id);
      if (cached.isNotEmpty) {
        final activities = cached
            .map((c) => QualityActivity.fromJson(
                jsonDecode(c.rawData) as Map<String, dynamic>))
            .toList();
        // No inspection or observation data available offline — show as empty.
        final rows = _buildRows(activities, {}, {}, {}, []);
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

  /// Merges activities, their latest inspections, and any observations into
  /// a flat list of [ActivityRow]s, each with a computed [ActivityDisplayStatus].
  ///
  /// Status computation logic (in priority order):
  ///   1. PENDING_OBSERVATION → the QC inspector raised an issue to fix first.
  ///   2. Inspection exists:
  ///      - pending / partiallyApproved → ActivityDisplayStatus.pending
  ///      - approved                    → ActivityDisplayStatus.approved
  ///      - provisionallyApproved       → ActivityDisplayStatus.provisionallyApproved
  ///      - rejected                    → ActivityDisplayStatus.rejected
  ///   3. No inspection:
  ///      - All predecessors approved (or allowBreak=true) → ready
  ///      - Otherwise → locked (cannot raise RFI yet)
  List<ActivityRow> _buildRows(
    List<QualityActivity> activities,
    Map<int, QualityInspection> inspMap,
    Map<int, List<QualityInspection>> inspListMap,
    Map<int, List<ActivityObservation>> obsMap,
    List<Map<String, dynamic>> floorUnits,
  ) {
    return activities.map((act) {
      final inspection = inspMap[act.id];

      // Check predecessor chain: all predecessors must be approved before
      // this activity can be unlocked (unless allowBreak overrides).
      bool predecessorDone = true;
      if (act.incomingEdges.isNotEmpty) {
        // Multi-predecessor graph edges take priority over the simple previousActivityId.
        for (final edge in act.incomingEdges) {
          final prevInsp = inspMap[edge.sourceId];
          if (prevInsp == null ||
              prevInsp.status != InspectionStatus.approved) {
            predecessorDone = false;
            break;
          }
        }
      } else if (act.previousActivityId != null) {
        // Simple linear predecessor (legacy single-chain model).
        final prevInsp = inspMap[act.previousActivityId!];
        if (prevInsp == null ||
            prevInsp.status != InspectionStatus.approved) {
          predecessorDone = false;
        }
      }

      // Compute the display status from the merged context
      ActivityDisplayStatus displayStatus;
      if (act.status == 'PENDING_OBSERVATION') {
        // QC inspector raised a defect — the site engineer must rectify it.
        displayStatus = ActivityDisplayStatus.pendingObservation;
      } else if (inspection != null) {
        // For multi-go (totalParts > 1) or unit-wise activities, check ALL
        // parts/units before declaring the whole activity as approved.
        // This prevents one approved unit from blocking the others from being raised.
        final allInsp = inspListMap[act.id] ?? [];
        final isMultiGoOrUnit =
            inspection.totalParts > 1 || act.applicabilityLevel == 'UNIT';

        if (isMultiGoOrUnit) {
          final expectedCount = act.applicabilityLevel == 'UNIT'
              ? (floorUnits.isNotEmpty ? floorUnits.length : null)
              : inspection.totalParts;
          final allPartsRaised =
              expectedCount == null || allInsp.length >= expectedCount;
          final allApproved = allInsp.isNotEmpty &&
              allInsp.every((i) =>
                  i.status == InspectionStatus.approved ||
                  i.status == InspectionStatus.provisionallyApproved);
          final anyRejected =
              allInsp.any((i) => i.status == InspectionStatus.rejected);
          final anyPending = allInsp.any((i) =>
              i.status == InspectionStatus.pending ||
              i.status == InspectionStatus.partiallyApproved);

          if (allApproved && allPartsRaised) {
            displayStatus = ActivityDisplayStatus.approved;
          } else if (anyRejected) {
            displayStatus = ActivityDisplayStatus.rejected;
          } else if (anyPending) {
            // Some parts awaiting approval, others may still be raiseable.
            displayStatus = ActivityDisplayStatus.pending;
          } else {
            // Some parts approved but not all raised yet — keep ready so user
            // can raise remaining parts/units.
            displayStatus = (predecessorDone || act.allowBreak)
                ? ActivityDisplayStatus.ready
                : ActivityDisplayStatus.locked;
          }
        } else {
          // Single inspection — standard status mapping.
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
        }
      } else {
        // No inspection raised yet — unlock if predecessor chain is satisfied
        // OR if allowBreak is true (allows out-of-sequence work).
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
        allInspections: inspListMap[act.id] ?? [],
        floorUnits:
            act.applicabilityLevel == 'UNIT' ? floorUnits : const [],
      );
    }).toList();
  }

  /// Raises an RFI for an activity using the offline-first sync queue.
  ///
  /// Steps:
  ///   1. Queue the action locally.
  ///   2. Optimistically update the cached activity status to 'RFI_RAISED'
  ///      so the list doesn't show it as "Ready" while syncing.
  ///   3. Attempt an immediate sync.
  ///   4. Emit [RfiQueued] with online/offline flag.
  ///   5. Automatically refresh the activity list so the UI reflects the new status.
  Future<void> _onRaiseRfi(
      RaiseRfi event, Emitter<QualityRequestState> emit) async {
    emit(const QualityRequestLoading(source: QrLoadingSource.rfiRaise));
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
          'drawingNo': event.drawingNo,
          if (event.comments != null && event.comments!.isNotEmpty)
            'comments': event.comments,
          if (event.documentType != null) 'documentType': event.documentType,
          // Include part info when it is meaningful (multi-part or explicit single).
          if (event.partNo != 1 || event.totalParts != 1) ...{
            'partNo': event.partNo,
            'totalParts': event.totalParts,
            if (event.partLabel != null) 'partLabel': event.partLabel,
          },
          if (event.qualityUnitId != null) 'qualityUnitId': event.qualityUnitId,
          if (event.vendorId != null) 'vendorId': event.vendorId,
          if (event.vendorName != null && event.vendorName!.isNotEmpty)
            'vendorName': event.vendorName,
        },
        priority: 2,
      );

      // 2. Optimistically update cached activity status so UI is responsive.
      await _database.updateCachedActivityStatus(
          event.activity.id, 'RFI_RAISED');

      // 3. Try to sync immediately
      final syncResult = await _syncService.syncAll();
      final pending = await _syncService.getPendingSyncCount();

      // 4. Show the success / queued toast
      emit(RfiQueued(isOffline: !syncResult.success, pendingSyncCount: pending));

      // 5. Immediately reload the activity list so the UI shows the updated
      //    status and stops showing the spinner.
      add(const RefreshCurrentList());
    } catch (e) {
      emit(QualityRequestError(_friendly(e)));
    }
  }

  /// Uploads a photo file to the server and returns the public URL.
  /// Called before [SubmitRectification] so the evidence URLs are ready.
  Future<void> _onUploadRectificationPhoto(
      UploadRectificationPhoto event,
      Emitter<QualityRequestState> emit) async {
    try {
      final result = await _apiClient.uploadFile(filePath: event.filePath);
      // Backend may return 'url' or 'path' depending on the upload endpoint version.
      final url = result['url'] as String? ?? result['path'] as String? ?? '';
      emit(PhotoUploaded(obsId: event.obsId, url: url));
    } catch (e) {
      emit(QualityRequestError('Photo upload failed: ${_friendly(e)}'));
    }
  }

  /// Queues a rectification submission offline-first.
  /// The site engineer provides closure text and photo URLs collected
  /// via prior [UploadRectificationPhoto] calls.
  Future<void> _onSubmitRectification(
      SubmitRectification event, Emitter<QualityRequestState> emit) async {
    emit(const QualityRequestLoading(source: QrLoadingSource.rectification));
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

  /// Unwraps a [DioException] to expose the underlying [ApiException] set by
  /// the Dio error interceptor. Returns the original error if not a DioException.
  dynamic _unwrap(dynamic e) {
    if (e is DioException && e.error is ApiException) return e.error;
    return e;
  }

  /// Returns true for errors that should NOT fall through to the offline cache.
  ///
  /// These are authoritative server responses (403, 401, 400, 500) that indicate
  /// the request was definitively rejected — caching would be misleading.
  bool _isNonNetworkError(dynamic e) {
    final err = _unwrap(e);
    return err is ForbiddenException ||
        err is UnauthorizedException ||
        err is BadRequestException ||
        err is ServerErrorException;
  }

  /// Translates exceptions to concise user-readable strings.
  /// Handles typed [ApiException]s from the Dio interceptor first,
  /// then falls back to string pattern matching for raw errors.
  String _friendly(dynamic e) {
    final err = _unwrap(e);
    if (err is ForbiddenException) {
      return 'You do not have permission for this action.';
    }
    if (err is UnauthorizedException) {
      return 'Session expired. Please log in again.';
    }
    if (err is BadRequestException) {
      // Show the server's message if it's non-empty; otherwise a generic hint.
      return err.message.isNotEmpty
          ? err.message
          : 'Invalid request. Please check and try again.';
    }
    if (err is ServerErrorException) {
      return 'Server error. Please try again later.';
    }
    final s = e.toString().toLowerCase();
    if (s.contains('connection') || s.contains('network') || s.contains('socket')) {
      return 'No connection to server. Data saved and will sync when online.';
    }
    if (s.contains('403') || s.contains('forbidden')) {
      return 'You do not have permission for this action.';
    }
    if (s.contains('400') || s.contains('bad request')) {
      // Try to extract the server's validation message from the JSON body.
      final msg = RegExp(r'"message":"([^"]+)"').firstMatch(e.toString());
      return msg?.group(1) ?? 'Invalid request. Please check and try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
