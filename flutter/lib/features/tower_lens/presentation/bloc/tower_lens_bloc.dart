import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_view_mode.dart';
import 'package:setu_mobile/features/tower_lens/data/repositories/tower_progress_repository.dart';

// ══════════════════════════════════════════ EVENTS ══════════════════════════

abstract class TowerLensEvent extends Equatable {
  const TowerLensEvent();
  @override
  List<Object?> get props => [];
}

/// Load all tower render models for a project.
class LoadTowerLens extends TowerLensEvent {
  final int projectId;
  /// If provided, only load this specific EPS node as a single tower.
  final int? epsNodeId;
  const LoadTowerLens(this.projectId, {this.epsNodeId});
  @override
  List<Object?> get props => [projectId, epsNodeId];
}

/// Re-fetch the same project to update progress data.
class RefreshTowerLens extends TowerLensEvent {
  final int projectId;
  const RefreshTowerLens(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

/// Change the active visualization mode (progress / quality / EHS).
class ChangeTowerViewMode extends TowerLensEvent {
  final TowerViewMode mode;
  const ChangeTowerViewMode(this.mode);
  @override
  List<Object?> get props => [mode];
}

/// Select or deselect a floor (by index within the active tower's floor list).
class SelectTowerFloor extends TowerLensEvent {
  final int? floorIndex; // null = deselect
  const SelectTowerFloor(this.floorIndex);
  @override
  List<Object?> get props => [floorIndex];
}

/// Select which tower to view when multiple towers exist for a project.
class SelectTower extends TowerLensEvent {
  final int towerIndex;
  const SelectTower(this.towerIndex);
  @override
  List<Object?> get props => [towerIndex];
}

// ══════════════════════════════════════════ STATES ══════════════════════════

abstract class TowerLensState extends Equatable {
  const TowerLensState();
  @override
  List<Object?> get props => [];
}

class TowerLensInitial extends TowerLensState {}

class TowerLensLoading extends TowerLensState {}

/// Data is ready — painter and page consume this state.
class TowerLensLoaded extends TowerLensState {
  /// All towers for the project (usually 1–4).
  final List<TowerRenderModel> towers;

  /// Index of the currently displayed tower.
  final int activeTowerIndex;

  final TowerViewMode activeMode;

  /// The floor detail sheet shows data for this floor (null = no selection).
  final int? selectedFloorIndex;

  const TowerLensLoaded({
    required this.towers,
    this.activeTowerIndex = 0,
    this.activeMode = TowerViewMode.progress,
    this.selectedFloorIndex,
  });

  /// The tower currently displayed in the 3D view.
  TowerRenderModel get activeTower => towers[activeTowerIndex];

  TowerLensLoaded copyWith({
    List<TowerRenderModel>? towers,
    int? activeTowerIndex,
    TowerViewMode? activeMode,
    int? selectedFloorIndex,
    bool clearSelectedFloor = false,
  }) =>
      TowerLensLoaded(
        towers: towers ?? this.towers,
        activeTowerIndex: activeTowerIndex ?? this.activeTowerIndex,
        activeMode: activeMode ?? this.activeMode,
        selectedFloorIndex: clearSelectedFloor
            ? null
            : (selectedFloorIndex ?? this.selectedFloorIndex),
      );

  @override
  List<Object?> get props =>
      [towers, activeTowerIndex, activeMode, selectedFloorIndex];
}

/// Fired (once) when a floor reaches 100% for the first time.
/// Page listens for this to trigger the confetti animation.
class FloorCompletedState extends TowerLensState {
  final String floorName;
  final String towerName;
  const FloorCompletedState(this.floorName, this.towerName);
  @override
  List<Object?> get props => [floorName, towerName];
}

class TowerLensError extends TowerLensState {
  final String message;
  const TowerLensError(this.message);
  @override
  List<Object?> get props => [message];
}

// ══════════════════════════════════════════ BLOC ═════════════════════════════

class TowerLensBloc extends Bloc<TowerLensEvent, TowerLensState> {
  final TowerProgressRepository _repository;

  TowerLensBloc({required TowerProgressRepository repository})
      : _repository = repository,
        super(TowerLensInitial()) {
    on<LoadTowerLens>(_onLoad);
    on<RefreshTowerLens>(_onRefresh);
    on<ChangeTowerViewMode>(_onChangeMode);
    on<SelectTowerFloor>(_onSelectFloor);
    on<SelectTower>(_onSelectTower);
  }

  Future<void> _onLoad(
      LoadTowerLens event, Emitter<TowerLensState> emit) async {
    emit(TowerLensLoading());
    await _fetch(event.projectId, emit);
  }

  Future<void> _onRefresh(
      RefreshTowerLens event, Emitter<TowerLensState> emit) async {
    // Keep showing old data during refresh (no full loading state)
    await _fetch(event.projectId, emit);
  }

  Future<void> _fetch(int projectId, Emitter<TowerLensState> emit) async {
    try {
      final towers = await _repository.buildForProject(projectId);
      if (towers.isEmpty) {
        emit(const TowerLensError(
            'No tower structure found for this project. Ensure EPS nodes of type TOWER or BLOCK exist.'));
        return;
      }
      emit(TowerLensLoaded(towers: towers, activeMode: TowerViewMode.progress));
    } catch (e) {
      emit(TowerLensError('Failed to load tower data. $e'));
    }
  }

  void _onChangeMode(
      ChangeTowerViewMode event, Emitter<TowerLensState> emit) {
    final current = state;
    if (current is! TowerLensLoaded) return;

    // Apply the new mode to all towers so the site map also updates
    final updatedTowers = current.towers
        .map((t) => t.withMode(event.mode))
        .toList();

    emit(current.copyWith(towers: updatedTowers, activeMode: event.mode));
  }

  void _onSelectFloor(
      SelectTowerFloor event, Emitter<TowerLensState> emit) {
    final current = state;
    if (current is! TowerLensLoaded) return;

    // Apply selected floor index to the active tower's render model
    final updatedTowers = List<TowerRenderModel>.from(current.towers);
    updatedTowers[current.activeTowerIndex] =
        current.activeTower.withSelectedFloor(event.floorIndex);

    emit(current.copyWith(
      towers: updatedTowers,
      selectedFloorIndex: event.floorIndex,
      clearSelectedFloor: event.floorIndex == null,
    ));
  }

  void _onSelectTower(
      SelectTower event, Emitter<TowerLensState> emit) {
    final current = state;
    if (current is! TowerLensLoaded) return;
    if (event.towerIndex >= current.towers.length) return;

    emit(current.copyWith(
      activeTowerIndex: event.towerIndex,
      clearSelectedFloor: true,
    ));
  }
}
