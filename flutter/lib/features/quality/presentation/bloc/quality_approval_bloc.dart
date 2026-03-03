import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ==================== EVENTS ====================

abstract class QualityApprovalEvent extends Equatable {
  const QualityApprovalEvent();
  @override
  List<Object?> get props => [];
}

/// Load inspection list for a project with optional filter
class LoadInspections extends QualityApprovalEvent {
  final int projectId;
  final String filter; // 'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED'
  const LoadInspections({required this.projectId, this.filter = 'PENDING'});
  @override
  List<Object?> get props => [projectId, filter];
}

/// Load full inspection detail (stages + observations)
class LoadInspectionDetail extends QualityApprovalEvent {
  final QualityInspection inspection;
  const LoadInspectionDetail(this.inspection);
  @override
  List<Object?> get props => [inspection.id];
}

/// Set (or clear) a checklist item status — local state only until Save.
/// Pass null to clear (mark as unevaluated).
class SetChecklistItemStatus extends QualityApprovalEvent {
  final int stageId;
  final int itemId;
  final ChecklistItemStatus? itemStatus;
  const SetChecklistItemStatus({
    required this.stageId,
    required this.itemId,
    this.itemStatus,
  });
  @override
  List<Object?> get props => [stageId, itemId, itemStatus];
}

/// Update remarks on a checklist item (local state only)
class UpdateItemRemarks extends QualityApprovalEvent {
  final int itemId;
  final String remarks;
  const UpdateItemRemarks({required this.itemId, required this.remarks});
  @override
  List<Object?> get props => [itemId, remarks];
}

/// Save checklist progress (PATCH /quality/inspections/stage/:id)
class SaveChecklistProgress extends QualityApprovalEvent {
  const SaveChecklistProgress();
}

/// Approve the inspection (saves stages + sets status=APPROVED)
class ApproveInspection extends QualityApprovalEvent {
  final String? comments;
  const ApproveInspection({this.comments});
  @override
  List<Object?> get props => [comments];
}

/// Provisionally approve the inspection
class ProvisionallyApproveInspection extends QualityApprovalEvent {
  final String justification;
  const ProvisionallyApproveInspection(this.justification);
  @override
  List<Object?> get props => [justification];
}

/// Reject the inspection
class RejectInspection extends QualityApprovalEvent {
  final String reason;
  const RejectInspection(this.reason);
  @override
  List<Object?> get props => [reason];
}

/// Raise a new observation on the current inspection's activity
class RaiseObservation extends QualityApprovalEvent {
  final String observationText;
  final String type;
  final List<String> photos;
  const RaiseObservation({
    required this.observationText,
    this.type = 'Minor',
    this.photos = const [],
  });
  @override
  List<Object?> get props => [observationText, type];
}

/// Upload a photo for a new observation being composed
class UploadObservationPhoto extends QualityApprovalEvent {
  final String filePath;
  const UploadObservationPhoto(this.filePath);
  @override
  List<Object?> get props => [filePath];
}

/// Close an observation after reviewing rectification
class CloseObservation extends QualityApprovalEvent {
  final String obsId;
  const CloseObservation(this.obsId);
  @override
  List<Object?> get props => [obsId];
}

/// Refresh the detail view (reload observations/stages)
class RefreshInspectionDetail extends QualityApprovalEvent {
  const RefreshInspectionDetail();
}

// ==================== STATES ====================

abstract class QualityApprovalState extends Equatable {
  const QualityApprovalState();
  @override
  List<Object?> get props => [];
}

class QualityApprovalInitial extends QualityApprovalState {}

class QualityApprovalLoading extends QualityApprovalState {}

class InspectionsLoaded extends QualityApprovalState {
  final List<QualityInspection> inspections;
  final String activeFilter;
  final int projectId;
  const InspectionsLoaded({
    required this.inspections,
    required this.activeFilter,
    required this.projectId,
  });
  @override
  List<Object?> get props => [inspections, activeFilter, projectId];
}

class InspectionDetailLoaded extends QualityApprovalState {
  final QualityInspection inspection;
  final List<InspectionStage> stages; // mutable local copy for checkbox toggling
  final List<ActivityObservation> observations;
  const InspectionDetailLoaded({
    required this.inspection,
    required this.stages,
    required this.observations,
  });

  bool get allItemsOk =>
      stages.isEmpty ||
      stages.every((s) => s.items.isEmpty || s.items.every((i) => i.itemStatus != null));

  int get pendingObsCount =>
      observations.where((o) => o.isPending).length;

  bool get canFinalApprove => allItemsOk && pendingObsCount == 0;

  InspectionDetailLoaded copyWith({
    List<InspectionStage>? stages,
    List<ActivityObservation>? observations,
  }) {
    return InspectionDetailLoaded(
      inspection: inspection,
      stages: stages ?? this.stages,
      observations: observations ?? this.observations,
    );
  }

  @override
  List<Object?> get props => [inspection, stages, observations];
}

class ChecklistProgressSaved extends QualityApprovalState {
  final bool isOffline;
  const ChecklistProgressSaved({required this.isOffline});
  @override
  List<Object?> get props => [isOffline];
}

class ApprovalActionQueued extends QualityApprovalState {
  final String action; // 'approve' | 'provisional' | 'reject'
  final bool isOffline;
  final int pendingSyncCount;
  const ApprovalActionQueued({
    required this.action,
    required this.isOffline,
    required this.pendingSyncCount,
  });
  @override
  List<Object?> get props => [action, isOffline, pendingSyncCount];
}

class ObservationPhotoUploaded extends QualityApprovalState {
  final String url;
  const ObservationPhotoUploaded(this.url);
  @override
  List<Object?> get props => [url];
}

class ObservationActionQueued extends QualityApprovalState {
  final String action; // 'raise' | 'close'
  final bool isOffline;
  const ObservationActionQueued({required this.action, required this.isOffline});
  @override
  List<Object?> get props => [action, isOffline];
}

class QualityApprovalError extends QualityApprovalState {
  final String message;
  const QualityApprovalError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class QualityApprovalBloc
    extends Bloc<QualityApprovalEvent, QualityApprovalState> {
  final SetuApiClient _apiClient;
  final SyncService _syncService;

  // Keep current inspection for refresh and observation actions
  QualityInspection? _currentInspection;

  QualityApprovalBloc({
    required SetuApiClient apiClient,
    required SyncService syncService,
  })  : _apiClient = apiClient,
        _syncService = syncService,
        super(QualityApprovalInitial()) {
    on<LoadInspections>(_onLoadInspections);
    on<LoadInspectionDetail>(_onLoadInspectionDetail);
    on<SetChecklistItemStatus>(_onSetChecklistItemStatus);
    on<UpdateItemRemarks>(_onUpdateItemRemarks);
    on<SaveChecklistProgress>(_onSaveChecklistProgress);
    on<ApproveInspection>(_onApproveInspection);
    on<ProvisionallyApproveInspection>(_onProvisionallyApproveInspection);
    on<RejectInspection>(_onRejectInspection);
    on<RaiseObservation>(_onRaiseObservation);
    on<UploadObservationPhoto>(_onUploadObservationPhoto);
    on<CloseObservation>(_onCloseObservation);
    on<RefreshInspectionDetail>(_onRefreshInspectionDetail);
  }

  Future<void> _onLoadInspections(
      LoadInspections event, Emitter<QualityApprovalState> emit) async {
    emit(QualityApprovalLoading());
    try {
      final raw = await _apiClient.getQualityInspections(
        projectId: event.projectId,
      );
      final all = raw
          .map((e) => QualityInspection.fromJson(e as Map<String, dynamic>))
          .toList();

      final filtered = _filter(all, event.filter);
      emit(InspectionsLoaded(
        inspections: filtered,
        activeFilter: event.filter,
        projectId: event.projectId,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  Future<void> _onLoadInspectionDetail(
      LoadInspectionDetail event,
      Emitter<QualityApprovalState> emit) async {
    _currentInspection = event.inspection;
    emit(QualityApprovalLoading());
    try {
      final results = await Future.wait([
        _apiClient.getQualityInspectionDetail(event.inspection.id),
        _apiClient.getActivityObservations(event.inspection.activityId),
      ]);

      final detailRaw = results[0] as Map<String, dynamic>;
      final obsRaw = results[1] as List<dynamic>;

      final detail = QualityInspection.fromJson(detailRaw);
      _currentInspection = detail;

      final observations = obsRaw
          .map((e) =>
              ActivityObservation.fromJson(e as Map<String, dynamic>))
          .toList();

      emit(InspectionDetailLoaded(
        inspection: detail,
        stages: List<InspectionStage>.from(detail.stages),
        observations: observations,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  Future<void> _onRefreshInspectionDetail(
      RefreshInspectionDetail event,
      Emitter<QualityApprovalState> emit) async {
    if (_currentInspection == null) return;
    add(LoadInspectionDetail(_currentInspection!));
  }

  void _onSetChecklistItemStatus(
      SetChecklistItemStatus event, Emitter<QualityApprovalState> emit) {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    final newStages = current.stages.map((stage) {
      if (stage.id != event.stageId) return stage;
      final newItems = stage.items.map((item) {
        if (item.id != event.itemId) return item;
        return item.copyWithStatus(event.itemStatus);
      }).toList();
      return stage.copyWithItems(newItems);
    }).toList();

    emit(current.copyWith(stages: newStages));
  }

  void _onUpdateItemRemarks(
      UpdateItemRemarks event, Emitter<QualityApprovalState> emit) {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    final newStages = current.stages.map((stage) {
      final newItems = stage.items.map((item) {
        if (item.id != event.itemId) return item;
        return item.copyWith(remarks: event.remarks);
      }).toList();
      return stage.copyWithItems(newItems);
    }).toList();

    emit(current.copyWith(stages: newStages));
  }

  Future<void> _onSaveChecklistProgress(
      SaveChecklistProgress event,
      Emitter<QualityApprovalState> emit) async {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    try {
      for (final stage in current.stages) {
        await _syncService.addToQueue(
          entityType: 'quality_stage_save',
          entityId: stage.id,
          operation: 'update',
          payload: {
            'stageId': stage.id,
            'status': stage.status,
            'items': stage.items.map((i) => i.toApiPayload()).toList(),
          },
          priority: 2,
        );
      }
      final syncResult = await _syncService.syncAll();
      emit(ChecklistProgressSaved(isOffline: !syncResult.success));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  Future<void> _onApproveInspection(
      ApproveInspection event,
      Emitter<QualityApprovalState> emit) async {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    emit(QualityApprovalLoading());
    try {
      final today = DateTime.now().toIso8601String().split('T')[0];
      // Save all stages as COMPLETED then approve
      for (final stage in current.stages) {
        await _syncService.addToQueue(
          entityType: 'quality_stage_save',
          entityId: stage.id,
          operation: 'update',
          payload: {
            'stageId': stage.id,
            'status': 'COMPLETED',
            'items': stage.items.map((i) => i.toApiPayload()).toList(),
          },
          priority: 3,
        );
      }
      await _syncService.addToQueue(
        entityType: 'quality_approve',
        entityId: current.inspection.id,
        operation: 'update',
        payload: {
          'inspectionId': current.inspection.id,
          'status': 'APPROVED',
          'comments': event.comments ?? 'Approved after completing checklist',
          'inspectionDate': today,
        },
        priority: 3,
      );

      final syncResult = await _syncService.syncAll();
      final pending = await _syncService.getPendingSyncCount();
      emit(ApprovalActionQueued(
        action: 'approve',
        isOffline: !syncResult.success,
        pendingSyncCount: pending,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  Future<void> _onProvisionallyApproveInspection(
      ProvisionallyApproveInspection event,
      Emitter<QualityApprovalState> emit) async {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    emit(QualityApprovalLoading());
    try {
      final today = DateTime.now().toIso8601String().split('T')[0];
      for (final stage in current.stages) {
        await _syncService.addToQueue(
          entityType: 'quality_stage_save',
          entityId: stage.id,
          operation: 'update',
          payload: {
            'stageId': stage.id,
            'status': 'COMPLETED',
            'items': stage.items.map((i) => i.toApiPayload()).toList(),
          },
          priority: 3,
        );
      }
      await _syncService.addToQueue(
        entityType: 'quality_approve',
        entityId: current.inspection.id,
        operation: 'update',
        payload: {
          'inspectionId': current.inspection.id,
          'status': 'PROVISIONALLY_APPROVED',
          'comments': event.justification,
          'inspectionDate': today,
        },
        priority: 3,
      );

      final syncResult = await _syncService.syncAll();
      final pending = await _syncService.getPendingSyncCount();
      emit(ApprovalActionQueued(
        action: 'provisional',
        isOffline: !syncResult.success,
        pendingSyncCount: pending,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  Future<void> _onRejectInspection(
      RejectInspection event, Emitter<QualityApprovalState> emit) async {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    emit(QualityApprovalLoading());
    try {
      final today = DateTime.now().toIso8601String().split('T')[0];
      for (final stage in current.stages) {
        await _syncService.addToQueue(
          entityType: 'quality_stage_save',
          entityId: stage.id,
          operation: 'update',
          payload: {
            'stageId': stage.id,
            'status': 'REJECTED',
            'items': stage.items.map((i) => i.toApiPayload()).toList(),
          },
          priority: 3,
        );
      }
      await _syncService.addToQueue(
        entityType: 'quality_approve',
        entityId: current.inspection.id,
        operation: 'update',
        payload: {
          'inspectionId': current.inspection.id,
          'status': 'REJECTED',
          'comments': event.reason,
          'inspectionDate': today,
        },
        priority: 3,
      );

      final syncResult = await _syncService.syncAll();
      final pending = await _syncService.getPendingSyncCount();
      emit(ApprovalActionQueued(
        action: 'reject',
        isOffline: !syncResult.success,
        pendingSyncCount: pending,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  Future<void> _onRaiseObservation(
      RaiseObservation event, Emitter<QualityApprovalState> emit) async {
    if (_currentInspection == null) return;
    try {
      await _syncService.addToQueue(
        entityType: 'quality_obs_raise',
        entityId: _currentInspection!.activityId,
        operation: 'create',
        payload: {
          'activityId': _currentInspection!.activityId,
          'observationText': event.observationText,
          'type': event.type,
          if (event.photos.isNotEmpty) 'photos': event.photos,
        },
        priority: 2,
      );
      final syncResult = await _syncService.syncAll();
      emit(ObservationActionQueued(
          action: 'raise', isOffline: !syncResult.success));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  Future<void> _onUploadObservationPhoto(
      UploadObservationPhoto event,
      Emitter<QualityApprovalState> emit) async {
    try {
      final result = await _apiClient.uploadFile(filePath: event.filePath);
      final url = result['url'] as String? ?? result['path'] as String? ?? '';
      emit(ObservationPhotoUploaded(url));
    } catch (e) {
      emit(QualityApprovalError('Photo upload failed: ${_friendly(e)}'));
    }
  }

  Future<void> _onCloseObservation(
      CloseObservation event, Emitter<QualityApprovalState> emit) async {
    if (_currentInspection == null) return;
    try {
      await _syncService.addToQueue(
        entityType: 'quality_obs_close',
        entityId: _currentInspection!.activityId,
        operation: 'update',
        payload: {
          'activityId': _currentInspection!.activityId,
          'obsId': event.obsId,
        },
        priority: 2,
      );
      final syncResult = await _syncService.syncAll();
      emit(ObservationActionQueued(
          action: 'close', isOffline: !syncResult.success));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  List<QualityInspection> _filter(
      List<QualityInspection> all, String filter) {
    switch (filter.toUpperCase()) {
      case 'APPROVED':
        return all
            .where((i) =>
                i.status == InspectionStatus.approved ||
                i.status == InspectionStatus.provisionallyApproved)
            .toList();
      case 'REJECTED':
        return all
            .where((i) => i.status == InspectionStatus.rejected)
            .toList();
      case 'PENDING':
        return all
            .where((i) =>
                i.status == InspectionStatus.pending ||
                i.status == InspectionStatus.partiallyApproved)
            .toList();
      default: // ALL
        return all;
    }
  }

  String _friendly(dynamic e) {
    final s = e.toString().toLowerCase();
    if (s.contains('connection') ||
        s.contains('network') ||
        s.contains('socket')) {
      return 'No connection. Action saved and will sync when online.';
    }
    if (s.contains('403') || s.contains('forbidden')) {
      return 'You do not have permission for this action.';
    }
    if (s.contains('400')) {
      final msg = RegExp(r'"message":"([^"]+)"').firstMatch(e.toString());
      return msg?.group(1) ?? 'Invalid request.';
    }
    return 'Something went wrong. Please try again.';
  }
}
