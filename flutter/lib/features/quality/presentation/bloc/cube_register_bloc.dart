import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/quality/data/models/cube_register_models.dart';

// ==================== EVENTS ====================

abstract class CubeRegisterEvent extends Equatable {
  const CubeRegisterEvent();
  @override
  List<Object?> get props => [];
}

class LoadCubeRegister extends CubeRegisterEvent {
  final int projectId;
  const LoadCubeRegister(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

class UpdateCubeTest extends CubeRegisterEvent {
  final int id;
  final Map<String, dynamic> data;
  const UpdateCubeTest(this.id, this.data);
  @override
  List<Object?> get props => [id];
}

class ApproveCubeTest extends CubeRegisterEvent {
  final int id;
  const ApproveCubeTest(this.id);
  @override
  List<Object?> get props => [id];
}

// ==================== STATES ====================

abstract class CubeRegisterState extends Equatable {
  const CubeRegisterState();
  @override
  List<Object?> get props => [];
}

class CubeRegisterInitial extends CubeRegisterState {
  const CubeRegisterInitial();
}

class CubeRegisterLoading extends CubeRegisterState {
  const CubeRegisterLoading();
}

class CubeRegisterLoaded extends CubeRegisterState {
  final int projectId;
  final List<CubeTestRecord> records;

  const CubeRegisterLoaded({required this.projectId, required this.records});

  @override
  List<Object?> get props => [projectId, records];
}

class CubeRegisterActionSuccess extends CubeRegisterState {
  final String message;
  final List<CubeTestRecord> records;
  const CubeRegisterActionSuccess({required this.message, required this.records});
  @override
  List<Object?> get props => [message];
}

class CubeRegisterError extends CubeRegisterState {
  final String message;
  const CubeRegisterError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class CubeRegisterBloc extends Bloc<CubeRegisterEvent, CubeRegisterState> {
  final SetuApiClient _api;
  int? _projectId;
  List<CubeTestRecord> _records = [];

  CubeRegisterBloc({required SetuApiClient apiClient})
      : _api = apiClient,
        super(const CubeRegisterInitial()) {
    on<LoadCubeRegister>(_onLoad);
    on<UpdateCubeTest>(_onUpdate);
    on<ApproveCubeTest>(_onApprove);
  }

  Future<void> _onLoad(
      LoadCubeRegister event, Emitter<CubeRegisterState> emit) async {
    _projectId = event.projectId;
    emit(const CubeRegisterLoading());
    try {
      final raw = await _api.getCubeTestRegister(event.projectId);
      _records = raw
          .whereType<Map<String, dynamic>>()
          .map(CubeTestRecord.fromJson)
          .toList();
      emit(CubeRegisterLoaded(projectId: event.projectId, records: _records));
    } catch (e) {
      emit(CubeRegisterError(_friendly(e)));
    }
  }

  Future<void> _onUpdate(
      UpdateCubeTest event, Emitter<CubeRegisterState> emit) async {
    if (_projectId == null) return;
    try {
      final updated = await _api.updateCubeTestRecord(event.id, event.data);
      final record = CubeTestRecord.fromJson(updated);
      _records = _records
          .map((r) => r.id == event.id ? record : r)
          .toList();
      emit(CubeRegisterActionSuccess(
        message: 'Cube test result saved',
        records: _records,
      ));
    } catch (e) {
      emit(CubeRegisterError(_friendly(e)));
    }
  }

  Future<void> _onApprove(
      ApproveCubeTest event, Emitter<CubeRegisterState> emit) async {
    if (_projectId == null) return;
    try {
      final updated = await _api.approveCubeTestRecord(event.id);
      final record = CubeTestRecord.fromJson(updated);
      _records = _records
          .map((r) => r.id == event.id ? record : r)
          .toList();
      emit(CubeRegisterActionSuccess(
        message: 'Cube test approved',
        records: _records,
      ));
    } catch (e) {
      emit(CubeRegisterError(_friendly(e)));
    }
  }

  String _friendly(Object e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('401') || msg.contains('unauthorized')) {
      return 'Session expired. Please log in again.';
    }
    if (msg.contains('403') || msg.contains('forbidden')) {
      return 'You do not have permission for this action.';
    }
    if (msg.contains('connection') || msg.contains('socket')) {
      return 'No connection. Check your network and try again.';
    }
    return 'Failed. Please try again.';
  }
}
