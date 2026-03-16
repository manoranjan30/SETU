import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'floor_progress.dart';
import 'tower_view_mode.dart';

/// Fully-resolved render instructions for one tower.
/// The [IsometricBuildingPainter] reads this model — it contains no API calls.
/// [activeMode] determines the color-coding logic applied to each floor.
class TowerRenderModel extends Equatable {
  final int epsNodeId;
  final String towerName;

  /// Floors ordered bottom-to-top: index 0 = ground floor.
  final List<FloorProgress> floors;

  final double overallProgress;
  final TowerViewMode activeMode;

  /// Index into [floors] that is currently selected (lifted + detail shown).
  final int? selectedFloorIndex;

  const TowerRenderModel({
    required this.epsNodeId,
    required this.towerName,
    required this.floors,
    required this.overallProgress,
    this.activeMode = TowerViewMode.progress,
    this.selectedFloorIndex,
  });

  // ─── Color resolution ────────────────────────────────────────────────────────

  /// Returns the top-face fill color for floor [floorIndex] based on the
  /// active visualization mode. Transparent = ghost/wireframe (not started).
  Color resolveTopColor(int floorIndex) {
    if (floorIndex < 0 || floorIndex >= floors.length) {
      return const Color(0xFFE5E7EB);
    }
    final floor = floors[floorIndex];

    switch (activeMode) {
      case TowerViewMode.progress:
        return _progressColor(floor);
      case TowerViewMode.quality:
        return _qualityColor(floor);
      case TowerViewMode.ehs:
        return _ehsColor(floor);
    }
  }

  /// Returns the outline stroke color for a floor.
  Color resolveOutlineColor(int floorIndex) {
    if (floorIndex < 0 || floorIndex >= floors.length) {
      return const Color(0xFFD1D5DB);
    }
    final floor = floors[floorIndex];

    // Selected floor gets a strong blue outline
    if (selectedFloorIndex == floorIndex) return const Color(0xFF1D4ED8);
    // Floors with unresolved issues in progress mode get amber warning
    if (activeMode == TowerViewMode.progress && floor.hasIssues) {
      return const Color(0xFFF59E0B);
    }
    // Complete floors get a dark green outline
    if (floor.phase == FloorPhase.complete) return const Color(0xFF16A34A);
    // Default: neutral grey
    return const Color(0xFFD1D5DB);
  }

  /// Whether this floor should be rendered as a ghost wireframe only.
  /// Ghost = no activities or 0% progress with no data.
  bool isGhost(int floorIndex) {
    if (floorIndex < 0 || floorIndex >= floors.length) return true;
    final floor = floors[floorIndex];
    return floor.isEmpty || (floor.progressPct == 0 && floor.totalActivities == 0);
  }

  // ─── Private color maps ──────────────────────────────────────────────────────

  Color _progressColor(FloorProgress floor) {
    if (floor.isEmpty) return const Color(0x00000000); // transparent = ghost
    switch (floor.phase) {
      case FloorPhase.notStarted:
        return const Color(0x00000000); // transparent — drawn as wireframe
      case FloorPhase.structure:
        return const Color(0xFFD1D5DB); // light concrete grey
      case FloorPhase.mepRoughIn:
        return const Color(0xFFFED7AA); // warm amber
      case FloorPhase.finishing:
        return const Color(0xFFFEF08A); // soft yellow
      case FloorPhase.nearComplete:
        return const Color(0xFFBBF7D0); // light green
      case FloorPhase.complete:
        return const Color(0xFF22C55E); // rich green
    }
  }

  Color _qualityColor(FloorProgress floor) {
    if (floor.isEmpty) return const Color(0xFFE5E7EB);
    if (floor.rejectedRfis > 0 || floor.openQualityObs >= 4) {
      return const Color(0xFFEF4444); // red — critical issues
    }
    if (floor.openQualityObs >= 1) {
      return const Color(0xFFF59E0B); // amber — some issues
    }
    return const Color(0xFF22C55E); // green — clean
  }

  Color _ehsColor(FloorProgress floor) {
    if (floor.isEmpty) return const Color(0xFFE5E7EB);
    if (floor.openEhsObs > 3) return const Color(0xFFEF4444); // red
    if (floor.openEhsObs > 0) return const Color(0xFFF97316); // orange
    return const Color(0xFF22C55E); // green
  }

  // ─── Convenience copy methods ────────────────────────────────────────────────

  TowerRenderModel withMode(TowerViewMode mode) =>
      copyWith(activeMode: mode, selectedFloorIndex: null);

  TowerRenderModel withSelectedFloor(int? index) =>
      copyWith(selectedFloorIndex: index);

  TowerRenderModel copyWith({
    int? epsNodeId,
    String? towerName,
    List<FloorProgress>? floors,
    double? overallProgress,
    TowerViewMode? activeMode,
    int? selectedFloorIndex,
  }) =>
      TowerRenderModel(
        epsNodeId: epsNodeId ?? this.epsNodeId,
        towerName: towerName ?? this.towerName,
        floors: floors ?? this.floors,
        overallProgress: overallProgress ?? this.overallProgress,
        activeMode: activeMode ?? this.activeMode,
        selectedFloorIndex: selectedFloorIndex,
      );

  @override
  List<Object?> get props =>
      [epsNodeId, floors, activeMode, selectedFloorIndex, overallProgress];
}
