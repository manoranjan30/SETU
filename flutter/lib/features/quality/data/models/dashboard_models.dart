import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ==================== ENUMS ====================

/// Visual status for a floor tile in the floor grid.
enum FloorStatus {
  allDone,      // All activities approved  → green
  inProgress,   // Mix: some approved, rest in-review → blue
  awaitingApproval, // Any activity pending/in-review → amber
  needsAction,  // Any activity not-raised or open observation → red
  notStarted,   // No activities or no inspections at all → grey
}

extension FloorStatusX on FloorStatus {
  Color get color {
    switch (this) {
      case FloorStatus.allDone:
        return const Color(0xFF4CAF50);
      case FloorStatus.inProgress:
        return const Color(0xFF2196F3);
      case FloorStatus.awaitingApproval:
        return const Color(0xFFFF9800);
      case FloorStatus.needsAction:
        return const Color(0xFFF44336);
      case FloorStatus.notStarted:
        return const Color(0xFF9E9E9E);
    }
  }

  Color get bgColor => color.withValues(alpha: 0.12);

  IconData get icon {
    switch (this) {
      case FloorStatus.allDone:
        return Icons.check_circle_rounded;
      case FloorStatus.inProgress:
        return Icons.autorenew_rounded;
      case FloorStatus.awaitingApproval:
        return Icons.schedule_rounded;
      case FloorStatus.needsAction:
        return Icons.error_rounded;
      case FloorStatus.notStarted:
        return Icons.radio_button_unchecked_rounded;
    }
  }
}

// ==================== MODELS ====================

/// Summary card data for one Block (top-level EPS node containing towers/floors).
class BlockSummary extends Equatable {
  final int epsNodeId;
  final String name;
  final int total;
  final int approved;
  final int inReview;
  final int pending;
  final int withObservation;
  /// Floors collected directly under this block (used when there is no tower
  /// level, e.g. Block → Floor). When towers are present, floors is the union
  /// of all tower floors (used for aggregate counts only).
  final List<FloorSummary> floors;
  /// Tower-level children. Non-empty when the EPS hierarchy has a tower level
  /// (Block → Tower → Floor). When empty the dashboard navigates directly to
  /// the floor grid, preserving backwards compatibility.
  final List<TowerSummary> towers;

  const BlockSummary({
    required this.epsNodeId,
    required this.name,
    required this.total,
    required this.approved,
    required this.inReview,
    required this.pending,
    required this.withObservation,
    this.floors = const [],
    this.towers = const [],
  });

  double get pct => total == 0 ? 0.0 : approved / total;

  @override
  List<Object?> get props =>
      [epsNodeId, name, total, approved, inReview, pending, withObservation];
}

/// Summary card data for one Tower within a Block.
class TowerSummary extends Equatable {
  final int epsNodeId;
  final String name;
  final int total;
  final int approved;
  final int inReview;
  final int pending;
  final int withObservation;
  final List<FloorSummary> floors;

  const TowerSummary({
    required this.epsNodeId,
    required this.name,
    required this.total,
    required this.approved,
    required this.inReview,
    required this.pending,
    required this.withObservation,
    this.floors = const [],
  });

  double get pct => total == 0 ? 0.0 : approved / total;

  @override
  List<Object?> get props =>
      [epsNodeId, name, total, approved, inReview, pending, withObservation];
}

/// Summary data for a single floor tile in the grid.
class FloorSummary extends Equatable {
  final int floorId;
  final String label; // "GF", "1F", "Floor 3" etc.
  final FloorStatus status;
  final int totalActivities;
  final int approvedCount;
  final int pendingCount; // not yet fully approved

  const FloorSummary({
    required this.floorId,
    required this.label,
    required this.status,
    required this.totalActivities,
    required this.approvedCount,
    required this.pendingCount,
  });

  @override
  List<Object?> get props =>
      [floorId, label, status, totalActivities, approvedCount, pendingCount];
}

/// Grouped sections of activity rows for the floor detail screen.
class DashboardSections extends Equatable {
  /// Activities the engineer can act on right now (ready-to-raise + open obs).
  final List<ActivityRow> needsAction;

  /// Activities currently in the approval workflow.
  final List<ActivityRow> awaitingApproval;

  /// Fully approved activities (shown collapsed by default).
  final List<ActivityRow> completed;

  /// Locked activities where predecessor is not yet done.
  final List<ActivityRow> blocked;

  const DashboardSections({
    this.needsAction = const [],
    this.awaitingApproval = const [],
    this.completed = const [],
    this.blocked = const [],
  });

  int get total =>
      needsAction.length +
      awaitingApproval.length +
      completed.length +
      blocked.length;

  @override
  List<Object?> get props =>
      [needsAction, awaitingApproval, completed, blocked];
}

/// Derives [DashboardSections] from a flat list of [ActivityRow]s.
DashboardSections buildSections(List<ActivityRow> rows) {
  final needsAction = <ActivityRow>[];
  final awaiting = <ActivityRow>[];
  final done = <ActivityRow>[];
  final blocked = <ActivityRow>[];

  for (final row in rows) {
    switch (row.displayStatus) {
      case ActivityDisplayStatus.ready:
        needsAction.add(row);
        break;
      case ActivityDisplayStatus.pendingObservation:
        needsAction.add(row);
        break;
      case ActivityDisplayStatus.pending:
      case ActivityDisplayStatus.provisionallyApproved:
      case ActivityDisplayStatus.rejected:
        awaiting.add(row);
        break;
      case ActivityDisplayStatus.approved:
        done.add(row);
        break;
      case ActivityDisplayStatus.locked:
        if (row.predecessorDone) {
          needsAction.add(row);
        } else {
          blocked.add(row);
        }
        break;
    }
  }

  return DashboardSections(
    needsAction: needsAction,
    awaitingApproval: awaiting,
    completed: done,
    blocked: blocked,
  );
}

/// Derives [FloorStatus] from aggregated counts.
FloorStatus deriveFloorStatus({
  required int total,
  required int approved,
  required int inReview,
  required int needsActionCount,
}) {
  if (total == 0) return FloorStatus.notStarted;
  if (approved == total) return FloorStatus.allDone;
  if (needsActionCount > 0) return FloorStatus.needsAction;
  if (inReview > 0) return FloorStatus.awaitingApproval;
  if (approved > 0) return FloorStatus.inProgress;
  return FloorStatus.notStarted;
}
