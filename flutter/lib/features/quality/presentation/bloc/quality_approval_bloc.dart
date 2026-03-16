import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ==================== EVENTS ====================

/// Base class for all quality approval events.
abstract class QualityApprovalEvent extends Equatable {
  const QualityApprovalEvent();
  @override
  List<Object?> get props => [];
}

/// Load the inspection list for a project with an optional status filter.
/// [filter] is one of: 'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED'
class LoadInspections extends QualityApprovalEvent {
  final int projectId;
  final String filter; // 'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED'
  const LoadInspections({required this.projectId, this.filter = 'PENDING'});
  @override
  List<Object?> get props => [projectId, filter];
}

/// Load full inspection detail (stages, checklist items, observations, workflow).
class LoadInspectionDetail extends QualityApprovalEvent {
  final QualityInspection inspection;
  const LoadInspectionDetail(this.inspection);
  @override
  List<Object?> get props => [inspection.id];
}

/// Toggle a checklist item status (pass / na / null to clear).
/// This is a local-state-only operation until [SaveChecklistProgress] is called.
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

/// Update the remarks text on a checklist item (local state only).
class UpdateItemRemarks extends QualityApprovalEvent {
  final int itemId;
  final String remarks;
  const UpdateItemRemarks({required this.itemId, required this.remarks});
  @override
  List<Object?> get props => [itemId, remarks];
}

/// Persist the current checklist item state to the server via the sync queue.
/// Called by the "Save Progress" button before a full approval.
class SaveChecklistProgress extends QualityApprovalEvent {
  const SaveChecklistProgress();
}

/// Approve the current inspection — saves all stages as COMPLETED then sets
/// the inspection status to APPROVED.
class ApproveInspection extends QualityApprovalEvent {
  final String? comments;
  const ApproveInspection({this.comments});
  @override
  List<Object?> get props => [comments];
}

/// Provisionally approve the inspection with a mandatory justification.
/// Used when work is acceptable but a minor item needs follow-up.
class ProvisionallyApproveInspection extends QualityApprovalEvent {
  final String justification;
  const ProvisionallyApproveInspection(this.justification);
  @override
  List<Object?> get props => [justification];
}

/// Reject the inspection with a mandatory reason string.
class RejectInspection extends QualityApprovalEvent {
  final String reason;
  const RejectInspection(this.reason);
  @override
  List<Object?> get props => [reason];
}

/// Approve a single checklist stage at its current pending release level.
///
/// This is the primary approval action — each stage progresses independently
/// through the release-strategy levels. When all stages of an inspection
/// pass all levels, the backend auto-grants final APPROVED status.
class ApproveStage extends QualityApprovalEvent {
  final int stageId;
  final String? comments;
  final String? signatureData;
  final String? signedBy;
  const ApproveStage({
    required this.stageId,
    this.comments,
    this.signatureData,
    this.signedBy,
  });
  @override
  List<Object?> get props => [stageId, comments, signedBy];
}

/// Raise a new defect observation on the current inspection's activity.
/// [stageId] links the observation to a specific checklist stage so the
/// stage-level approval can block until the observation is closed.
class RaiseObservation extends QualityApprovalEvent {
  final String observationText;
  final String type;
  final List<String> photos;
  final int? stageId; // which stage this observation belongs to
  const RaiseObservation({
    required this.observationText,
    this.type = 'Minor',
    this.photos = const [],
    this.stageId,
  });
  @override
  List<Object?> get props => [observationText, type, stageId];
}

/// Upload a photo for a new observation being composed by the QC inspector.
class UploadObservationPhoto extends QualityApprovalEvent {
  final String filePath;
  const UploadObservationPhoto(this.filePath);
  @override
  List<Object?> get props => [filePath];
}

/// Close an observation after reviewing the site engineer's rectification.
class CloseObservation extends QualityApprovalEvent {
  final String obsId;
  const CloseObservation(this.obsId);
  @override
  List<Object?> get props => [obsId];
}

/// Hard-delete an activity observation (QC inspector only).
class DeleteActivityObservation extends QualityApprovalEvent {
  final String obsId;
  const DeleteActivityObservation(this.obsId);
  @override
  List<Object?> get props => [obsId];
}

/// Advance the current workflow step (multi-level approval).
/// Requires a [signatureData] base64 image captured from the signature pad.
class AdvanceWorkflowStep extends QualityApprovalEvent {
  final String? signatureData; // base64 or data URI — required by backend
  final String? signedBy;      // approver display name
  final String? comments;
  const AdvanceWorkflowStep({this.signatureData, this.signedBy, this.comments});
  @override
  List<Object?> get props => [signatureData, signedBy, comments];
}

/// Reject the inspection via the multi-level workflow.
class RejectWorkflowStep extends QualityApprovalEvent {
  final String reason;
  const RejectWorkflowStep(this.reason);
  @override
  List<Object?> get props => [reason];
}

/// Delegate the current workflow step to another user (e.g. when absent).
class DelegateWorkflowStep extends QualityApprovalEvent {
  final int toUserId;
  final String? comments;
  const DelegateWorkflowStep({required this.toUserId, this.comments});
  @override
  List<Object?> get props => [toUserId, comments];
}

/// Undo (reverse) the most recent approval on this inspection.
class ReverseWorkflowStep extends QualityApprovalEvent {
  final String reason;
  const ReverseWorkflowStep(this.reason);
  @override
  List<Object?> get props => [reason];
}

/// Load only inspections where MY approval is currently pending.
/// Used by the "My Approvals" dashboard badge/count.
class LoadMyPendingInspections extends QualityApprovalEvent {
  final int projectId;
  const LoadMyPendingInspections({required this.projectId});
  @override
  List<Object?> get props => [projectId];
}

/// Refresh the detail view (e.g. after raising or closing an observation).
class RefreshInspectionDetail extends QualityApprovalEvent {
  const RefreshInspectionDetail();
}

// ==================== STATES ====================

/// Base class for all quality approval states.
abstract class QualityApprovalState extends Equatable {
  const QualityApprovalState();
  @override
  List<Object?> get props => [];
}

class QualityApprovalInitial extends QualityApprovalState {}

/// Full-screen loading indicator.
class QualityApprovalLoading extends QualityApprovalState {}

/// The inspection list has been loaded and filtered.
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

/// Full inspection detail is loaded — the inspector can interact with checklist items.
///
/// [stages] is a mutable local copy of the inspection's checklist stages.
/// Item toggles ([SetChecklistItemStatus]) mutate this list and re-emit this state
/// without hitting the server — the changes are only persisted when the inspector
/// explicitly calls [SaveChecklistProgress] or an approval action.
class InspectionDetailLoaded extends QualityApprovalState {
  final QualityInspection inspection;
  final List<InspectionStage> stages; // mutable local copy for checkbox toggling
  final List<ActivityObservation> observations;
  final InspectionWorkflowRun? workflow; // null when no workflow configured

  const InspectionDetailLoaded({
    required this.inspection,
    required this.stages,
    required this.observations,
    this.workflow,
  });

  /// True when every checklist item across all stages has been evaluated.
  bool get allItemsOk =>
      stages.isEmpty ||
      stages.every((s) => s.items.isEmpty || s.items.every((i) => i.itemStatus != null));

  /// Count of observations still waiting for the site engineer to rectify.
  int get pendingObsCount =>
      observations.where((o) => o.isPending).length;

  /// True when the inspector can issue a final approval (all items evaluated
  /// and no outstanding observations pending rectification).
  bool get canFinalApprove => allItemsOk && pendingObsCount == 0;

  /// True when a multi-level workflow is active and awaiting this user's step.
  bool get hasActiveWorkflow =>
      workflow != null && workflow!.isInProgress;

  InspectionDetailLoaded copyWith({
    List<InspectionStage>? stages,
    List<ActivityObservation>? observations,
    InspectionWorkflowRun? workflow,
  }) {
    return InspectionDetailLoaded(
      inspection: inspection,
      stages: stages ?? this.stages,
      observations: observations ?? this.observations,
      workflow: workflow ?? this.workflow,
    );
  }

  @override
  List<Object?> get props => [inspection, stages, observations, workflow];
}

/// Checklist progress was persisted (or queued for offline sync).
class ChecklistProgressSaved extends QualityApprovalState {
  final bool isOffline;
  const ChecklistProgressSaved({required this.isOffline});
  @override
  List<Object?> get props => [isOffline];
}

/// An approve / reject / delegate / reverse action was queued (and optionally synced).
///
/// [completedLevel] and [totalLevels] are populated for workflow-based approvals
/// so the UI can show "Approved Level 1 of 3" feedback.
class ApprovalActionQueued extends QualityApprovalState {
  final String action; // 'approve' | 'provisional' | 'reject' | 'delegate' | 'reverse'
  final bool isOffline;
  final int pendingSyncCount;
  /// 1-based index of the real approval level just completed (excluding RAISE_RFI step)
  final int? completedLevel;
  /// Total number of real approval levels (excluding RAISE_RFI step)
  final int? totalLevels;
  const ApprovalActionQueued({
    required this.action,
    required this.isOffline,
    required this.pendingSyncCount,
    this.completedLevel,
    this.totalLevels,
  });
  @override
  List<Object?> get props => [action, isOffline, pendingSyncCount, completedLevel, totalLevels];
}

/// A photo was uploaded for a new observation being composed.
class ObservationPhotoUploaded extends QualityApprovalState {
  final String url;
  const ObservationPhotoUploaded(this.url);
  @override
  List<Object?> get props => [url];
}

/// An observation was raised, closed, or deleted.
/// [action] is one of: 'raise' | 'close' | 'deleted'.
class ObservationActionQueued extends QualityApprovalState {
  final String action; // 'raise' | 'close'
  final bool isOffline;
  const ObservationActionQueued({required this.action, required this.isOffline});
  @override
  List<Object?> get props => [action, isOffline];
}

/// A stage-level approval was successfully submitted.
///
/// [stageName] and [pendingDisplay] come from the updated stage response
/// so the UI can show "Stage X approved — Level Y pending" feedback.
class StageApproveSuccess extends QualityApprovalState {
  final int stageId;
  final String? stageName;
  final bool stageFullyApproved;
  final bool inspectionFullyApproved;
  final String? pendingDisplay;
  const StageApproveSuccess({
    required this.stageId,
    this.stageName,
    this.stageFullyApproved = false,
    this.inspectionFullyApproved = false,
    this.pendingDisplay,
  });
  @override
  List<Object?> get props => [
        stageId,
        stageFullyApproved,
        inspectionFullyApproved,
        pendingDisplay,
      ];
}

/// An error occurred during an approval action.
class QualityApprovalError extends QualityApprovalState {
  final String message;
  const QualityApprovalError(this.message);
  @override
  List<Object?> get props => [message];
}

/// Inspections requiring MY approval were loaded.
class MyPendingInspectionsLoaded extends QualityApprovalState {
  final List<QualityInspection> inspections;
  final int projectId;
  const MyPendingInspectionsLoaded({
    required this.inspections,
    required this.projectId,
  });
  @override
  List<Object?> get props => [inspections, projectId];
}

// ==================== BLOC ====================

/// Manages the QC inspector's approval workflow.
///
/// Key responsibilities:
///   1. Load and filter the inspection list.
///   2. Load inspection detail with stages, observations, and workflow state.
///   3. Allow checklist items to be toggled locally before committing.
///   4. Approve/reject/provisionally approve via the sync queue (offline-first).
///   5. Support multi-level workflow: AdvanceWorkflowStep → queue stage saves
///      + workflow advance in one batch, then determine the completed level
///      for descriptive feedback messaging.
///   6. Raise and close defect observations.
class QualityApprovalBloc
    extends Bloc<QualityApprovalEvent, QualityApprovalState> {
  final SetuApiClient _apiClient;
  final SyncService _syncService;

  // Stash the current inspection so refresh and observation actions
  // can reference it without needing it passed through every event.
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
    on<ApproveStage>(_onApproveStage);
    on<ApproveInspection>(_onApproveInspection);
    on<ProvisionallyApproveInspection>(_onProvisionallyApproveInspection);
    on<RejectInspection>(_onRejectInspection);
    on<AdvanceWorkflowStep>(_onAdvanceWorkflowStep);
    on<RejectWorkflowStep>(_onRejectWorkflowStep);
    on<DelegateWorkflowStep>(_onDelegateWorkflowStep);
    on<ReverseWorkflowStep>(_onReverseWorkflowStep);
    on<LoadMyPendingInspections>(_onLoadMyPendingInspections);
    on<RaiseObservation>(_onRaiseObservation);
    on<UploadObservationPhoto>(_onUploadObservationPhoto);
    on<CloseObservation>(_onCloseObservation);
    on<DeleteActivityObservation>(_onDeleteActivityObservation);
    on<RefreshInspectionDetail>(_onRefreshInspectionDetail);
  }

  /// Fetches all inspections for a project and filters by status.
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

      // Client-side filter — server returns ALL for performance,
      // we slice the result here to support instant filter tab switching.
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

  /// Loads full inspection detail: stages, observations, and workflow in parallel.
  /// Also stashes the inspection for later use by refresh/observation handlers.
  Future<void> _onLoadInspectionDetail(
      LoadInspectionDetail event,
      Emitter<QualityApprovalState> emit) async {
    _currentInspection = event.inspection;
    emit(QualityApprovalLoading());
    try {
      // Fire all three data fetches in parallel to minimise latency.
      final results = await Future.wait([
        _apiClient.getQualityInspectionDetail(event.inspection.id),
        _apiClient.getActivityObservations(event.inspection.activityId),
        _apiClient.getInspectionWorkflow(event.inspection.id),
      ]);

      final detailRaw = results[0] as Map<String, dynamic>;
      final obsRaw = results[1] as List<dynamic>;
      final workflowRaw = results[2] as Map<String, dynamic>?;

      final detail = QualityInspection.fromJson(detailRaw);
      // Update the stashed inspection with the full detail data.
      _currentInspection = detail;

      final observations = obsRaw
          .map((e) =>
              ActivityObservation.fromJson(e as Map<String, dynamic>))
          .toList();

      // workflow is optional — not all inspections use multi-level approval.
      final workflow = workflowRaw != null
          ? InspectionWorkflowRun.fromJson(workflowRaw)
          : null;

      emit(InspectionDetailLoaded(
        inspection: detail,
        // Create a separate list instance so the BLoC can mutate it
        // for checklist toggling without affecting the original.
        stages: List<InspectionStage>.from(detail.stages),
        observations: observations,
        workflow: workflow,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  /// Approves a single checklist stage at its next pending release level.
  ///
  /// Direct API call (not queued) — stage approval requires server-side
  /// release-strategy evaluation that cannot be performed offline.
  ///
  /// On success, [StageApproveSuccess] is emitted with the updated stage
  /// state. The UI should then refresh the detail view to get the latest
  /// `stageApproval` matrices. When `inspectionFullyApproved` is true,
  /// the inspection status has been auto-set to APPROVED by the backend.
  Future<void> _onApproveStage(
      ApproveStage event, Emitter<QualityApprovalState> emit) async {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    try {
      final result = await _apiClient.approveInspectionStage(
        inspectionId: current.inspection.id,
        stageId: event.stageId,
        comments: event.comments,
        signatureData: event.signatureData,
        signedBy: event.signedBy,
      );

      // Extract stage approval state from the response.
      final stageApprovalRaw = result['stageApproval'] as Map<String, dynamic>?;
      final stageApproval =
          stageApprovalRaw != null ? StageApproval.fromJson(stageApprovalRaw) : null;

      emit(StageApproveSuccess(
        stageId: event.stageId,
        stageName: result['stageName'] as String?,
        stageFullyApproved: stageApproval?.fullyApproved ?? false,
        inspectionFullyApproved:
            result['inspectionStatus'] == 'APPROVED' ||
            result['allStagesApproved'] == true,
        pendingDisplay: stageApproval?.pendingDisplay,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  /// Handles the AdvanceWorkflowStep action for multi-level approval.
  ///
  /// Strategy:
  ///   1. Queue each stage save as a separate sync item (priority 3).
  ///   2. Queue the workflow advance action (priority 3).
  ///   3. Sync immediately.
  ///   4. Compute which level was just completed (for descriptive toast).
  ///   5. Emit [ApprovalActionQueued] with level context.
  Future<void> _onAdvanceWorkflowStep(
      AdvanceWorkflowStep event,
      Emitter<QualityApprovalState> emit) async {
    final current = state;
    // Guard: can only advance from the detail view.
    if (current is! InspectionDetailLoaded) return;

    emit(QualityApprovalLoading());
    try {
      // Save all stage progress first, then advance the workflow step.
      // Priority 3 (> 2) ensures these are synced before lower-priority items.
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
        entityType: 'quality_workflow_advance',
        entityId: current.inspection.id,
        operation: 'update',
        payload: {
          'inspectionId': current.inspection.id,
          if (event.signatureData != null) 'signatureData': event.signatureData,
          if (event.signedBy != null) 'signedBy': event.signedBy,
          if (event.comments != null && event.comments!.isNotEmpty)
            'comments': event.comments,
        },
        priority: 3,
      );

      final syncResult = await _syncService.syncAll();
      final pending = await _syncService.getPendingSyncCount();

      // Compute level context for descriptive post-advance message.
      // We exclude the RAISE_RFI step from level numbering since it is
      // not an approval level — it is just the initiating step.
      final wf = current.workflow;
      final realSteps = wf?.steps.where((s) => !s.isRaiseStep).toList() ?? [];
      final completedOrder = wf?.currentStepOrder ?? 1;
      // Find where the completed step sits in the filtered (real) steps list.
      final completedLevel = realSteps.indexWhere((s) => s.stepOrder == completedOrder) + 1;
      emit(ApprovalActionQueued(
        action: 'approve',
        isOffline: !syncResult.success,
        pendingSyncCount: pending,
        completedLevel: completedLevel > 0 ? completedLevel : null,
        totalLevels: realSteps.isNotEmpty ? realSteps.length : null,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  /// Rejects the current workflow step with a reason.
  Future<void> _onRejectWorkflowStep(
      RejectWorkflowStep event,
      Emitter<QualityApprovalState> emit) async {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    emit(QualityApprovalLoading());
    try {
      await _syncService.addToQueue(
        entityType: 'quality_workflow_reject',
        entityId: current.inspection.id,
        operation: 'update',
        payload: {
          'inspectionId': current.inspection.id,
          'comments': event.reason,
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

  /// Delegates the current workflow step to another user.
  /// This is a direct server call (not queued) because delegation must be
  /// confirmed in real-time — the delegatee needs to be notified immediately.
  Future<void> _onDelegateWorkflowStep(
      DelegateWorkflowStep event,
      Emitter<QualityApprovalState> emit) async {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    emit(QualityApprovalLoading());
    try {
      await _apiClient.delegateWorkflowStep(
        inspectionId: current.inspection.id,
        toUserId: event.toUserId,
        comments: event.comments,
      );
      emit(ApprovalActionQueued(
        action: 'delegate',
        isOffline: false,
        pendingSyncCount: 0,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  /// Reverses (undoes) the most recent approval on this inspection.
  /// Also a direct server call — no offline queue needed.
  Future<void> _onReverseWorkflowStep(
      ReverseWorkflowStep event,
      Emitter<QualityApprovalState> emit) async {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    emit(QualityApprovalLoading());
    try {
      await _apiClient.reverseWorkflowStep(
        inspectionId: current.inspection.id,
        reason: event.reason,
      );
      emit(ApprovalActionQueued(
        action: 'reverse',
        isOffline: false,
        pendingSyncCount: 0,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  Future<void> _onLoadMyPendingInspections(
      LoadMyPendingInspections event,
      Emitter<QualityApprovalState> emit) async {
    emit(QualityApprovalLoading());
    try {
      final raw = await _apiClient.getMyPendingInspections(event.projectId);
      final inspections = raw
          .map((e) => QualityInspection.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(MyPendingInspectionsLoaded(
        inspections: inspections,
        projectId: event.projectId,
      ));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  /// Refresh the detail view by re-dispatching [LoadInspectionDetail].
  Future<void> _onRefreshInspectionDetail(
      RefreshInspectionDetail event,
      Emitter<QualityApprovalState> emit) async {
    if (_currentInspection == null) return;
    add(LoadInspectionDetail(_currentInspection!));
  }

  /// Toggles a single checklist item status in the local copy of stages.
  ///
  /// This emits immediately without a network call — the state machine
  /// re-emits [InspectionDetailLoaded] with the mutated stages list.
  /// Actual persistence only happens on [SaveChecklistProgress] or an
  /// approval action.
  void _onSetChecklistItemStatus(
      SetChecklistItemStatus event, Emitter<QualityApprovalState> emit) {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    // Rebuild the stages list, replacing only the affected item.
    final newStages = current.stages.map((stage) {
      if (stage.id != event.stageId) return stage;
      final newItems = stage.items.map((item) {
        if (item.id != event.itemId) return item;
        // Create a new item with the updated status (immutable update).
        return item.copyWithStatus(event.itemStatus);
      }).toList();
      return stage.copyWithItems(newItems);
    }).toList();

    emit(current.copyWith(stages: newStages));
  }

  /// Updates remarks text for a single checklist item in local state.
  void _onUpdateItemRemarks(
      UpdateItemRemarks event, Emitter<QualityApprovalState> emit) {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    // Scan all stages to find the matching item by ID.
    final newStages = current.stages.map((stage) {
      final newItems = stage.items.map((item) {
        if (item.id != event.itemId) return item;
        return item.copyWith(remarks: event.remarks);
      }).toList();
      return stage.copyWithItems(newItems);
    }).toList();

    emit(current.copyWith(stages: newStages));
  }

  /// Persists the current checklist item state (from local [InspectionDetailLoaded.stages])
  /// to the server via the sync queue. One queue entry per stage.
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

  /// Approves the inspection: saves all stages as COMPLETED then queues
  /// a status change to APPROVED with the inspection date.
  Future<void> _onApproveInspection(
      ApproveInspection event,
      Emitter<QualityApprovalState> emit) async {
    final current = state;
    if (current is! InspectionDetailLoaded) return;

    emit(QualityApprovalLoading());
    try {
      // Use today's date as the inspection date (ISO date string, not timestamp).
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

  /// Provisionally approves: same as [_onApproveInspection] but sets
  /// status to PROVISIONALLY_APPROVED with the mandatory justification text.
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

  /// Rejects the inspection: saves all stages as REJECTED, queues status REJECTED.
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

  /// Raises a defect observation on the current inspection's activity.
  /// Uses _currentInspection to know which activity to link it to.
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
          'inspectionId': _currentInspection!.id,
          if (event.stageId != null) 'stageId': event.stageId,
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

  /// Uploads a photo for a new observation and emits the resulting server URL.
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

  /// Closes an observation after the inspector reviews the rectification evidence.
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

  /// Hard-deletes an observation (direct API call, not queued).
  Future<void> _onDeleteActivityObservation(
      DeleteActivityObservation event, Emitter<QualityApprovalState> emit) async {
    if (_currentInspection == null) return;
    try {
      await _apiClient.deleteActivityObservation(
        activityId: _currentInspection!.activityId,
        obsId: event.obsId,
      );
      emit(const ObservationActionQueued(action: 'deleted', isOffline: false));
    } catch (e) {
      emit(QualityApprovalError(_friendly(e)));
    }
  }

  /// Filters the full inspection list to the requested status bucket.
  /// The filter tab in the UI switches between these views without re-fetching.
  List<QualityInspection> _filter(
      List<QualityInspection> all, String filter) {
    switch (filter.toUpperCase()) {
      case 'APPROVED':
        // Both fully approved and provisionally approved are shown in the Approved tab.
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
        // partiallyApproved = some stages done but not all — still actionable.
        return all
            .where((i) =>
                i.status == InspectionStatus.pending ||
                i.status == InspectionStatus.partiallyApproved)
            .toList();
      default: // ALL
        return all;
    }
  }

  /// Translates exceptions to concise user-readable strings.
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
      // Extract the server's validation message from the JSON body if present.
      final msg = RegExp(r'"message":"([^"]+)"').firstMatch(e.toString());
      return msg?.group(1) ?? 'Invalid request.';
    }
    return 'Something went wrong. Please try again.';
  }
}
