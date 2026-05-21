import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ==================== EVENTS ====================

abstract class SnagEvent extends Equatable {
  const SnagEvent();
  @override
  List<Object?> get props => [];
}

class LoadSnags extends SnagEvent {
  final int projectId;
  const LoadSnags(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

class CreateSnag extends SnagEvent {
  final int projectId;
  final String title;
  final String? description;
  final String? location;
  final String priority;
  final int? epsNodeId;
  final DateTime? dueDate;

  const CreateSnag({
    required this.projectId,
    required this.title,
    this.description,
    this.location,
    this.priority = 'MEDIUM',
    this.epsNodeId,
    this.dueDate,
  });

  @override
  List<Object?> get props => [projectId, title, priority];
}

class UpdateSnagStatus extends SnagEvent {
  final int snagId;
  final SnagStatus newStatus;
  final String? remarks;

  const UpdateSnagStatus({
    required this.snagId,
    required this.newStatus,
    this.remarks,
  });

  @override
  List<Object?> get props => [snagId, newStatus];
}

class DeleteSnag extends SnagEvent {
  final int snagId;
  const DeleteSnag(this.snagId);
  @override
  List<Object?> get props => [snagId];
}

class FilterSnags extends SnagEvent {
  final SnagStatus? statusFilter; // null = show all
  const FilterSnags(this.statusFilter);
  @override
  List<Object?> get props => [statusFilter];
}

// ==================== STATES ====================

abstract class SnagState extends Equatable {
  const SnagState();
  @override
  List<Object?> get props => [];
}

class SnagInitial extends SnagState {
  const SnagInitial();
}

class SnagLoading extends SnagState {
  const SnagLoading();
}

class SnagLoaded extends SnagState {
  final List<QualitySnag> allSnags;
  final List<QualitySnag> filteredSnags;
  final SnagStatus? activeFilter;

  const SnagLoaded({
    required this.allSnags,
    required this.filteredSnags,
    this.activeFilter,
  });

  @override
  List<Object?> get props => [allSnags, filteredSnags, activeFilter];
}

class SnagActionSuccess extends SnagState {
  final String message;
  final List<QualitySnag> snags;
  const SnagActionSuccess({required this.message, required this.snags});
  @override
  List<Object?> get props => [message, snags];
}

class SnagError extends SnagState {
  final String message;
  const SnagError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class SnagBloc extends Bloc<SnagEvent, SnagState> {
  final SetuApiClient _api;

  SnagBloc({required SetuApiClient apiClient})
      : _api = apiClient,
        super(const SnagInitial()) {
    on<LoadSnags>(_onLoad);
    on<CreateSnag>(_onCreate);
    on<UpdateSnagStatus>(_onUpdateStatus);
    on<DeleteSnag>(_onDelete);
    on<FilterSnags>(_onFilter);
  }

  List<QualitySnag> _allSnags = [];

  Future<void> _onLoad(LoadSnags event, Emitter<SnagState> emit) async {
    emit(const SnagLoading());
    try {
      final list = await _api.getSnags(event.projectId);
      _allSnags = list.map((e) => QualitySnag.fromJson(e)).toList();
      emit(SnagLoaded(allSnags: _allSnags, filteredSnags: _allSnags));
    } catch (e) {
      emit(SnagError(_friendlyError(e)));
    }
  }

  Future<void> _onCreate(CreateSnag event, Emitter<SnagState> emit) async {
    try {
      final data = await _api.createSnag({
        'projectId': event.projectId,
        'title': event.title,
        if (event.description != null) 'description': event.description,
        if (event.location != null) 'location': event.location,
        'priority': event.priority,
        if (event.epsNodeId != null) 'epsNodeId': event.epsNodeId,
        if (event.dueDate != null) 'dueDate': event.dueDate!.toIso8601String(),
      });
      final newSnag = QualitySnag.fromJson(data);
      _allSnags = [newSnag, ..._allSnags];
      emit(SnagActionSuccess(message: 'Snag created', snags: _allSnags));
    } catch (e) {
      emit(SnagError(_friendlyError(e)));
    }
  }

  Future<void> _onUpdateStatus(UpdateSnagStatus event, Emitter<SnagState> emit) async {
    try {
      final data = await _api.updateSnag(event.snagId, {
        'status': event.newStatus.name.toUpperCase(),
        if (event.remarks != null) 'remarks': event.remarks,
      });
      final updated = QualitySnag.fromJson(data);
      _allSnags = _allSnags.map((s) => s.id == event.snagId ? updated : s).toList();
      emit(SnagActionSuccess(
        message: 'Snag status updated to ${event.newStatus.label}',
        snags: _allSnags,
      ));
    } catch (e) {
      emit(SnagError(_friendlyError(e)));
    }
  }

  Future<void> _onDelete(DeleteSnag event, Emitter<SnagState> emit) async {
    try {
      await _api.deleteSnag(event.snagId);
      _allSnags = _allSnags.where((s) => s.id != event.snagId).toList();
      emit(SnagActionSuccess(message: 'Snag deleted', snags: _allSnags));
    } catch (e) {
      emit(SnagError(_friendlyError(e)));
    }
  }

  void _onFilter(FilterSnags event, Emitter<SnagState> emit) {
    final filtered = event.statusFilter == null
        ? _allSnags
        : _allSnags.where((s) => s.status == event.statusFilter).toList();
    emit(SnagLoaded(
      allSnags: _allSnags,
      filteredSnags: filtered,
      activeFilter: event.statusFilter,
    ));
  }

  String _friendlyError(Object e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('401') || msg.contains('unauthorized')) return 'Session expired. Please log in again.';
    if (msg.contains('403') || msg.contains('forbidden')) return 'You do not have permission to perform this action.';
    if (msg.contains('connection') || msg.contains('socket')) return 'No connection. Check your network and try again.';
    return 'An error occurred. Please try again.';
  }
}
