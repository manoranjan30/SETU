import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_dashboard_models.dart';

// ==================== EVENTS ====================

abstract class EhsDashboardEvent extends Equatable {
  const EhsDashboardEvent();
  @override
  List<Object?> get props => [];
}

class LoadEhsDashboard extends EhsDashboardEvent {
  final int projectId;
  const LoadEhsDashboard(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

class RefreshEhsTab extends EhsDashboardEvent {
  final int projectId;
  final EhsTab tab;
  const RefreshEhsTab(this.projectId, this.tab);
  @override
  List<Object?> get props => [projectId, tab];
}

class CreateEhsManhours extends EhsDashboardEvent {
  final int projectId;
  final Map<String, dynamic> data;
  const CreateEhsManhours(this.projectId, this.data);
  @override
  List<Object?> get props => [projectId];
}

class CreateEhsTraining extends EhsDashboardEvent {
  final int projectId;
  final Map<String, dynamic> data;
  const CreateEhsTraining(this.projectId, this.data);
  @override
  List<Object?> get props => [projectId];
}

class CreateEhsLegal extends EhsDashboardEvent {
  final int projectId;
  final Map<String, dynamic> data;
  const CreateEhsLegal(this.projectId, this.data);
  @override
  List<Object?> get props => [projectId];
}

class UpdateEhsLegal extends EhsDashboardEvent {
  final int projectId;
  final int itemId;
  final Map<String, dynamic> data;
  const UpdateEhsLegal(this.projectId, this.itemId, this.data);
  @override
  List<Object?> get props => [projectId, itemId];
}

class CreateEhsMachinery extends EhsDashboardEvent {
  final int projectId;
  final Map<String, dynamic> data;
  const CreateEhsMachinery(this.projectId, this.data);
  @override
  List<Object?> get props => [projectId];
}

class CreateEhsVehicle extends EhsDashboardEvent {
  final int projectId;
  final Map<String, dynamic> data;
  const CreateEhsVehicle(this.projectId, this.data);
  @override
  List<Object?> get props => [projectId];
}

enum EhsTab { overview, performance, manhours, training, legal, machinery, vehicles }

// ==================== STATES ====================

abstract class EhsDashboardState extends Equatable {
  const EhsDashboardState();
  @override
  List<Object?> get props => [];
}

class EhsDashboardInitial extends EhsDashboardState {
  const EhsDashboardInitial();
}

class EhsDashboardLoading extends EhsDashboardState {
  const EhsDashboardLoading();
}

class EhsDashboardLoaded extends EhsDashboardState {
  final int projectId;
  final EhsSummary? summary;
  final EhsPerformanceData? performance;
  final List<EhsManhoursRecord> manhours;
  final List<EhsTrainingRecord> training;
  final List<EhsLegalItem> legal;
  final List<EhsMachineryRecord> machinery;
  final List<EhsVehicleRecord> vehicles;

  const EhsDashboardLoaded({
    required this.projectId,
    this.summary,
    this.performance,
    this.manhours = const [],
    this.training = const [],
    this.legal = const [],
    this.machinery = const [],
    this.vehicles = const [],
  });

  EhsDashboardLoaded copyWith({
    EhsSummary? summary,
    EhsPerformanceData? performance,
    List<EhsManhoursRecord>? manhours,
    List<EhsTrainingRecord>? training,
    List<EhsLegalItem>? legal,
    List<EhsMachineryRecord>? machinery,
    List<EhsVehicleRecord>? vehicles,
  }) =>
      EhsDashboardLoaded(
        projectId: projectId,
        summary: summary ?? this.summary,
        performance: performance ?? this.performance,
        manhours: manhours ?? this.manhours,
        training: training ?? this.training,
        legal: legal ?? this.legal,
        machinery: machinery ?? this.machinery,
        vehicles: vehicles ?? this.vehicles,
      );

  @override
  List<Object?> get props => [projectId, summary, manhours, training, legal, machinery, vehicles];
}

class EhsDashboardTabLoading extends EhsDashboardState {
  final EhsDashboardLoaded base;
  final EhsTab tab;
  const EhsDashboardTabLoading(this.base, this.tab);
  @override
  List<Object?> get props => [base, tab];
}

class EhsDashboardActionSuccess extends EhsDashboardState {
  final String message;
  final EhsDashboardLoaded data;
  const EhsDashboardActionSuccess({required this.message, required this.data});
  @override
  List<Object?> get props => [message, data];
}

class EhsDashboardError extends EhsDashboardState {
  final String message;
  const EhsDashboardError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class EhsDashboardBloc extends Bloc<EhsDashboardEvent, EhsDashboardState> {
  final SetuApiClient _api;

  EhsDashboardBloc({required SetuApiClient apiClient})
      : _api = apiClient,
        super(const EhsDashboardInitial()) {
    on<LoadEhsDashboard>(_onLoad);
    on<RefreshEhsTab>(_onRefreshTab);
    on<CreateEhsManhours>(_onCreateManhours);
    on<CreateEhsTraining>(_onCreateTraining);
    on<CreateEhsLegal>(_onCreateLegal);
    on<UpdateEhsLegal>(_onUpdateLegal);
    on<CreateEhsMachinery>(_onCreateMachinery);
    on<CreateEhsVehicle>(_onCreateVehicle);
  }

  EhsDashboardLoaded? _loaded;

  Future<void> _onLoad(LoadEhsDashboard event, Emitter<EhsDashboardState> emit) async {
    emit(const EhsDashboardLoading());
    try {
      // Load all sub-modules in parallel
      final results = await Future.wait([
        _api.getEhsSummary(event.projectId).catchError((_) => <String, dynamic>{}),
        _api.getEhsPerformance(event.projectId).catchError((_) => <String, dynamic>{}),
        _api.getEhsManhours(event.projectId).catchError((_) => <Map<String, dynamic>>[]),
        _api.getEhsTraining(event.projectId).catchError((_) => <Map<String, dynamic>>[]),
        _api.getEhsLegal(event.projectId).catchError((_) => <Map<String, dynamic>>[]),
        _api.getEhsMachinery(event.projectId).catchError((_) => <Map<String, dynamic>>[]),
        _api.getEhsVehicles(event.projectId).catchError((_) => <Map<String, dynamic>>[]),
      ]);

      _loaded = EhsDashboardLoaded(
        projectId: event.projectId,
        summary: _parseSummary(results[0]),
        performance: _parsePerformance(results[1]),
        manhours: _parseList(results[2], EhsManhoursRecord.fromJson),
        training: _parseList(results[3], EhsTrainingRecord.fromJson),
        legal: _parseList(results[4], EhsLegalItem.fromJson),
        machinery: _parseList(results[5], EhsMachineryRecord.fromJson),
        vehicles: _parseList(results[6], EhsVehicleRecord.fromJson),
      );
      emit(_loaded!);
    } catch (e) {
      emit(EhsDashboardError(_friendlyError(e)));
    }
  }

  Future<void> _onRefreshTab(RefreshEhsTab event, Emitter<EhsDashboardState> emit) async {
    if (_loaded == null) {
      add(LoadEhsDashboard(event.projectId));
      return;
    }
    emit(EhsDashboardTabLoading(_loaded!, event.tab));
    try {
      switch (event.tab) {
        case EhsTab.overview:
          final data = await _api.getEhsSummary(event.projectId);
          _loaded = _loaded!.copyWith(summary: _parseSummary(data));
        case EhsTab.performance:
          final data = await _api.getEhsPerformance(event.projectId);
          _loaded = _loaded!.copyWith(performance: _parsePerformance(data));
        case EhsTab.manhours:
          final list = await _api.getEhsManhours(event.projectId);
          _loaded = _loaded!.copyWith(manhours: _parseList(list, EhsManhoursRecord.fromJson));
        case EhsTab.training:
          final list = await _api.getEhsTraining(event.projectId);
          _loaded = _loaded!.copyWith(training: _parseList(list, EhsTrainingRecord.fromJson));
        case EhsTab.legal:
          final list = await _api.getEhsLegal(event.projectId);
          _loaded = _loaded!.copyWith(legal: _parseList(list, EhsLegalItem.fromJson));
        case EhsTab.machinery:
          final list = await _api.getEhsMachinery(event.projectId);
          _loaded = _loaded!.copyWith(machinery: _parseList(list, EhsMachineryRecord.fromJson));
        case EhsTab.vehicles:
          final list = await _api.getEhsVehicles(event.projectId);
          _loaded = _loaded!.copyWith(vehicles: _parseList(list, EhsVehicleRecord.fromJson));
      }
      emit(_loaded!);
    } catch (e) {
      emit(_loaded!); // restore previous state, don't error out
    }
  }

  Future<void> _onCreateManhours(CreateEhsManhours event, Emitter<EhsDashboardState> emit) async {
    try {
      await _api.createEhsManhours(event.projectId, event.data);
      add(RefreshEhsTab(event.projectId, EhsTab.manhours));
      if (_loaded != null) {
        emit(EhsDashboardActionSuccess(message: 'Manhours record added', data: _loaded!));
      }
    } catch (e) {
      emit(EhsDashboardError(_friendlyError(e)));
    }
  }

  Future<void> _onCreateTraining(CreateEhsTraining event, Emitter<EhsDashboardState> emit) async {
    try {
      await _api.createEhsTraining(event.projectId, event.data);
      add(RefreshEhsTab(event.projectId, EhsTab.training));
      if (_loaded != null) {
        emit(EhsDashboardActionSuccess(message: 'Training record added', data: _loaded!));
      }
    } catch (e) {
      emit(EhsDashboardError(_friendlyError(e)));
    }
  }

  Future<void> _onCreateLegal(CreateEhsLegal event, Emitter<EhsDashboardState> emit) async {
    try {
      await _api.createEhsLegal(event.projectId, event.data);
      add(RefreshEhsTab(event.projectId, EhsTab.legal));
      if (_loaded != null) {
        emit(EhsDashboardActionSuccess(message: 'Legal item added', data: _loaded!));
      }
    } catch (e) {
      emit(EhsDashboardError(_friendlyError(e)));
    }
  }

  Future<void> _onUpdateLegal(UpdateEhsLegal event, Emitter<EhsDashboardState> emit) async {
    try {
      await _api.updateEhsLegal(event.projectId, event.itemId, event.data);
      add(RefreshEhsTab(event.projectId, EhsTab.legal));
      if (_loaded != null) {
        emit(EhsDashboardActionSuccess(message: 'Legal item updated', data: _loaded!));
      }
    } catch (e) {
      emit(EhsDashboardError(_friendlyError(e)));
    }
  }

  Future<void> _onCreateMachinery(CreateEhsMachinery event, Emitter<EhsDashboardState> emit) async {
    try {
      await _api.createEhsMachinery(event.projectId, event.data);
      add(RefreshEhsTab(event.projectId, EhsTab.machinery));
      if (_loaded != null) {
        emit(EhsDashboardActionSuccess(message: 'Machinery record added', data: _loaded!));
      }
    } catch (e) {
      emit(EhsDashboardError(_friendlyError(e)));
    }
  }

  Future<void> _onCreateVehicle(CreateEhsVehicle event, Emitter<EhsDashboardState> emit) async {
    try {
      await _api.createEhsVehicle(event.projectId, event.data);
      add(RefreshEhsTab(event.projectId, EhsTab.vehicles));
      if (_loaded != null) {
        emit(EhsDashboardActionSuccess(message: 'Vehicle record added', data: _loaded!));
      }
    } catch (e) {
      emit(EhsDashboardError(_friendlyError(e)));
    }
  }

  // Helpers
  EhsSummary? _parseSummary(dynamic data) {
    if (data is Map<String, dynamic> && data.isNotEmpty) return EhsSummary.fromJson(data);
    return null;
  }

  EhsPerformanceData? _parsePerformance(dynamic data) {
    if (data is Map<String, dynamic> && data.isNotEmpty) return EhsPerformanceData.fromJson(data);
    return null;
  }

  List<T> _parseList<T>(dynamic data, T Function(Map<String, dynamic>) fromJson) {
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().map(fromJson).toList();
    }
    return [];
  }

  String _friendlyError(Object e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('401') || msg.contains('unauthorized')) return 'Session expired. Please log in again.';
    if (msg.contains('403') || msg.contains('forbidden')) return 'You do not have permission to view EHS data.';
    if (msg.contains('connection') || msg.contains('socket')) return 'No connection. Check your network and try again.';
    return 'Failed to load EHS data. Please try again.';
  }
}
