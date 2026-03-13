import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ═══════════════════════════════════════════ EVENTS ══════════════════════════

abstract class QualitySiteObsEvent extends Equatable {
  const QualitySiteObsEvent();
  @override
  List<Object?> get props => [];
}

class LoadQualitySiteObs extends QualitySiteObsEvent {
  final int projectId;
  final String? statusFilter; // 'OPEN' | 'RECTIFIED' | 'CLOSED' | null = all
  final String? severityFilter;

  const LoadQualitySiteObs({
    required this.projectId,
    this.statusFilter,
    this.severityFilter,
  });

  @override
  List<Object?> get props => [projectId, statusFilter, severityFilter];
}

class RefreshQualitySiteObs extends QualitySiteObsEvent {
  final int projectId;
  final String? statusFilter;
  final String? severityFilter;

  const RefreshQualitySiteObs({
    required this.projectId,
    this.statusFilter,
    this.severityFilter,
  });

  @override
  List<Object?> get props => [projectId, statusFilter, severityFilter];
}

class CreateQualitySiteObs extends QualitySiteObsEvent {
  final int projectId;
  final int? epsNodeId;
  final String description;
  final String severity;
  final String? category;
  final String? locationLabel;
  final List<String> photoUrls;

  const CreateQualitySiteObs({
    required this.projectId,
    this.epsNodeId,
    required this.description,
    required this.severity,
    this.category,
    this.locationLabel,
    this.photoUrls = const [],
  });

  @override
  List<Object?> get props => [projectId, description, severity];
}

class RectifyQualitySiteObs extends QualitySiteObsEvent {
  final String id;
  final String notes;
  final List<String> photoUrls;

  const RectifyQualitySiteObs({
    required this.id,
    required this.notes,
    this.photoUrls = const [],
  });

  @override
  List<Object?> get props => [id, notes];
}

class CloseQualitySiteObs extends QualitySiteObsEvent {
  final String id;
  final String? closureNotes;

  const CloseQualitySiteObs({required this.id, this.closureNotes});

  @override
  List<Object?> get props => [id];
}

class DeleteQualitySiteObs extends QualitySiteObsEvent {
  final String id;

  const DeleteQualitySiteObs({required this.id});

  @override
  List<Object?> get props => [id];
}

// ═══════════════════════════════════════════ STATES ══════════════════════════

abstract class QualitySiteObsState extends Equatable {
  const QualitySiteObsState();
  @override
  List<Object?> get props => [];
}

class QualitySiteObsInitial extends QualitySiteObsState {}

class QualitySiteObsLoading extends QualitySiteObsState {
  /// When true, we are refreshing (list already visible — show shimmer)
  final bool isRefresh;
  const QualitySiteObsLoading({this.isRefresh = false});
  @override
  List<Object?> get props => [isRefresh];
}

class QualitySiteObsLoaded extends QualitySiteObsState {
  final List<QualitySiteObservation> observations;
  final String? appliedStatusFilter;
  final String? appliedSeverityFilter;

  const QualitySiteObsLoaded({
    required this.observations,
    this.appliedStatusFilter,
    this.appliedSeverityFilter,
  });

  @override
  List<Object?> get props =>
      [observations, appliedStatusFilter, appliedSeverityFilter];
}

class QualitySiteObsError extends QualitySiteObsState {
  final String message;
  const QualitySiteObsError(this.message);
  @override
  List<Object?> get props => [message];
}

class QualitySiteObsActionSuccess extends QualitySiteObsState {
  /// 'created' | 'rectified' | 'closed' | 'deleted'
  final String action;
  const QualitySiteObsActionSuccess(this.action);
  @override
  List<Object?> get props => [action];
}

class QualitySiteObsActionError extends QualitySiteObsState {
  final String message;
  const QualitySiteObsActionError(this.message);
  @override
  List<Object?> get props => [message];
}

// ═══════════════════════════════════════════ BLOC ════════════════════════════

class QualitySiteObsBloc
    extends Bloc<QualitySiteObsEvent, QualitySiteObsState> {
  final SetuApiClient _api;

  QualitySiteObsBloc({required SetuApiClient apiClient})
      : _api = apiClient,
        super(QualitySiteObsInitial()) {
    on<LoadQualitySiteObs>(_onLoad);
    on<RefreshQualitySiteObs>(_onRefresh);
    on<CreateQualitySiteObs>(_onCreate);
    on<RectifyQualitySiteObs>(_onRectify);
    on<CloseQualitySiteObs>(_onClose);
    on<DeleteQualitySiteObs>(_onDelete);
  }

  Future<void> _onLoad(
    LoadQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    emit(const QualitySiteObsLoading());
    await _fetch(event.projectId, event.statusFilter, event.severityFilter,
        emit);
  }

  Future<void> _onRefresh(
    RefreshQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    emit(const QualitySiteObsLoading(isRefresh: true));
    await _fetch(event.projectId, event.statusFilter, event.severityFilter,
        emit);
  }

  Future<void> _fetch(
    int projectId,
    String? statusFilter,
    String? severityFilter,
    Emitter<QualitySiteObsState> emit,
  ) async {
    try {
      final raw = await _api.getQualitySiteObs(
        projectId: projectId,
        status: statusFilter,
        severity: severityFilter,
      );
      final obs = raw
          .map((e) =>
              QualitySiteObservation.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(QualitySiteObsLoaded(
        observations: obs,
        appliedStatusFilter: statusFilter,
        appliedSeverityFilter: severityFilter,
      ));
    } catch (e) {
      emit(QualitySiteObsError('Failed to load observations. $e'));
    }
  }

  Future<void> _onCreate(
    CreateQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    try {
      await _api.createQualitySiteObs(
        projectId: event.projectId,
        epsNodeId: event.epsNodeId,
        description: event.description,
        severity: event.severity,
        category: event.category,
        locationLabel: event.locationLabel,
        photoUrls: event.photoUrls,
      );
      emit(const QualitySiteObsActionSuccess('created'));
    } catch (e) {
      emit(QualitySiteObsActionError('Failed to raise observation. $e'));
    }
  }

  Future<void> _onRectify(
    RectifyQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    try {
      await _api.rectifyQualitySiteObs(
        id: event.id,
        notes: event.notes,
        photoUrls: event.photoUrls,
      );
      emit(const QualitySiteObsActionSuccess('rectified'));
    } catch (e) {
      emit(QualitySiteObsActionError('Failed to submit rectification. $e'));
    }
  }

  Future<void> _onClose(
    CloseQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    try {
      await _api.closeQualitySiteObs(
        id: event.id,
        closureNotes: event.closureNotes,
      );
      emit(const QualitySiteObsActionSuccess('closed'));
    } catch (e) {
      emit(QualitySiteObsActionError('Failed to close observation. $e'));
    }
  }

  Future<void> _onDelete(
    DeleteQualitySiteObs event,
    Emitter<QualitySiteObsState> emit,
  ) async {
    try {
      await _api.deleteQualitySiteObs(id: event.id);
      emit(const QualitySiteObsActionSuccess('deleted'));
    } catch (e) {
      emit(QualitySiteObsActionError('Failed to delete observation. $e'));
    }
  }
}
