import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';

// ═══════════════════════════════════════════ EVENTS ══════════════════════════

abstract class EhsSiteObsEvent extends Equatable {
  const EhsSiteObsEvent();
  @override
  List<Object?> get props => [];
}

class LoadEhsSiteObs extends EhsSiteObsEvent {
  final int projectId;
  final String? statusFilter;
  final String? severityFilter;

  const LoadEhsSiteObs({
    required this.projectId,
    this.statusFilter,
    this.severityFilter,
  });

  @override
  List<Object?> get props => [projectId, statusFilter, severityFilter];
}

class RefreshEhsSiteObs extends EhsSiteObsEvent {
  final int projectId;
  final String? statusFilter;
  final String? severityFilter;

  const RefreshEhsSiteObs({
    required this.projectId,
    this.statusFilter,
    this.severityFilter,
  });

  @override
  List<Object?> get props => [projectId, statusFilter, severityFilter];
}

class CreateEhsSiteObs extends EhsSiteObsEvent {
  final int projectId;
  final int? epsNodeId;
  final String description;
  final String severity;
  final String? category;
  final String? locationLabel;
  final List<String> photoUrls;

  const CreateEhsSiteObs({
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

class RectifyEhsSiteObs extends EhsSiteObsEvent {
  final String id;
  final String notes;
  final List<String> photoUrls;

  const RectifyEhsSiteObs({
    required this.id,
    required this.notes,
    this.photoUrls = const [],
  });

  @override
  List<Object?> get props => [id, notes];
}

class CloseEhsSiteObs extends EhsSiteObsEvent {
  final String id;
  final String? closureNotes;

  const CloseEhsSiteObs({required this.id, this.closureNotes});

  @override
  List<Object?> get props => [id];
}

class DeleteEhsSiteObs extends EhsSiteObsEvent {
  final String id;
  const DeleteEhsSiteObs({required this.id});

  @override
  List<Object?> get props => [id];
}

// ═══════════════════════════════════════════ STATES ══════════════════════════

abstract class EhsSiteObsState extends Equatable {
  const EhsSiteObsState();
  @override
  List<Object?> get props => [];
}

class EhsSiteObsInitial extends EhsSiteObsState {}

class EhsSiteObsLoading extends EhsSiteObsState {
  final bool isRefresh;
  const EhsSiteObsLoading({this.isRefresh = false});
  @override
  List<Object?> get props => [isRefresh];
}

class EhsSiteObsLoaded extends EhsSiteObsState {
  final List<EhsSiteObservation> observations;
  final String? appliedStatusFilter;
  final String? appliedSeverityFilter;

  const EhsSiteObsLoaded({
    required this.observations,
    this.appliedStatusFilter,
    this.appliedSeverityFilter,
  });

  @override
  List<Object?> get props =>
      [observations, appliedStatusFilter, appliedSeverityFilter];
}

class EhsSiteObsError extends EhsSiteObsState {
  final String message;
  const EhsSiteObsError(this.message);
  @override
  List<Object?> get props => [message];
}

class EhsSiteObsActionSuccess extends EhsSiteObsState {
  final String action;
  const EhsSiteObsActionSuccess(this.action);
  @override
  List<Object?> get props => [action];
}

class EhsSiteObsActionError extends EhsSiteObsState {
  final String message;
  const EhsSiteObsActionError(this.message);
  @override
  List<Object?> get props => [message];
}

// ═══════════════════════════════════════════ BLOC ════════════════════════════

class EhsSiteObsBloc extends Bloc<EhsSiteObsEvent, EhsSiteObsState> {
  final SetuApiClient _api;

  EhsSiteObsBloc({required SetuApiClient apiClient})
      : _api = apiClient,
        super(EhsSiteObsInitial()) {
    on<LoadEhsSiteObs>(_onLoad);
    on<RefreshEhsSiteObs>(_onRefresh);
    on<CreateEhsSiteObs>(_onCreate);
    on<RectifyEhsSiteObs>(_onRectify);
    on<CloseEhsSiteObs>(_onClose);
    on<DeleteEhsSiteObs>(_onDelete);
  }

  Future<void> _onLoad(
    LoadEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    emit(const EhsSiteObsLoading());
    await _fetch(event.projectId, event.statusFilter, event.severityFilter,
        emit);
  }

  Future<void> _onRefresh(
    RefreshEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    emit(const EhsSiteObsLoading(isRefresh: true));
    await _fetch(event.projectId, event.statusFilter, event.severityFilter,
        emit);
  }

  Future<void> _fetch(
    int projectId,
    String? statusFilter,
    String? severityFilter,
    Emitter<EhsSiteObsState> emit,
  ) async {
    try {
      final raw = await _api.getEhsSiteObs(
        projectId: projectId,
        status: statusFilter,
        severity: severityFilter,
      );
      final obs = raw
          .map((e) => EhsSiteObservation.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(EhsSiteObsLoaded(
        observations: obs,
        appliedStatusFilter: statusFilter,
        appliedSeverityFilter: severityFilter,
      ));
    } catch (e) {
      emit(EhsSiteObsError('Failed to load EHS observations. $e'));
    }
  }

  Future<void> _onCreate(
    CreateEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    try {
      await _api.createEhsSiteObs(
        projectId: event.projectId,
        epsNodeId: event.epsNodeId,
        description: event.description,
        severity: event.severity,
        category: event.category,
        locationLabel: event.locationLabel,
        photoUrls: event.photoUrls,
      );
      emit(const EhsSiteObsActionSuccess('created'));
    } catch (e) {
      emit(EhsSiteObsActionError('Failed to raise observation. $e'));
    }
  }

  Future<void> _onRectify(
    RectifyEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    try {
      await _api.rectifyEhsSiteObs(
        id: event.id,
        notes: event.notes,
        photoUrls: event.photoUrls,
      );
      emit(const EhsSiteObsActionSuccess('rectified'));
    } catch (e) {
      emit(EhsSiteObsActionError('Failed to submit rectification. $e'));
    }
  }

  Future<void> _onClose(
    CloseEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    try {
      await _api.closeEhsSiteObs(
        id: event.id,
        closureNotes: event.closureNotes,
      );
      emit(const EhsSiteObsActionSuccess('closed'));
    } catch (e) {
      emit(EhsSiteObsActionError('Failed to close observation. $e'));
    }
  }

  Future<void> _onDelete(
    DeleteEhsSiteObs event,
    Emitter<EhsSiteObsState> emit,
  ) async {
    try {
      await _api.deleteEhsSiteObs(id: event.id);
      emit(const EhsSiteObsActionSuccess('deleted'));
    } catch (e) {
      emit(EhsSiteObsActionError('Failed to delete observation. $e'));
    }
  }
}
