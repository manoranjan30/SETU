import 'package:equatable/equatable.dart';

/// Construction phase derived from completion percentage.
/// Used to assign phase-appropriate colors to each floor.
enum FloorPhase {
  notStarted,   // 0% — ghost wireframe
  structure,    // 1–30% — foundation & structural works
  mepRoughIn,   // 31–55% — MEP, blockwork, rough-in
  finishing,    // 56–80% — plaster, tiles, painting
  nearComplete, // 81–99% — final touches
  complete,     // 100% — handed over
}

/// Aggregated progress snapshot for a single floor (EPS FLOOR node).
/// Computed by [TowerProgressRepository] from activities + observations.
class FloorProgress extends Equatable {
  final int epsNodeId;

  /// Display name — "GF", "Floor 1", "Floor 12", "Terrace"
  final String floorName;

  /// Sort index — 0 = ground floor (bottom of the tower stack).
  final int floorIndex;

  /// Average completion across all activities on this floor (0.0–100.0).
  final double progressPct;

  final int totalActivities;
  final int completedActivities;

  /// Activities with no RFI raised yet (status: ready / locked).
  final int pendingActivities;

  /// Activities with an RFI raised but not yet approved.
  final int inProgressActivities;

  /// Open quality site observations linked to this floor.
  final int openQualityObs;

  /// Open EHS observations linked to this floor.
  final int openEhsObs;

  final int pendingRfis;
  final int rejectedRfis;

  /// True if any progress entry was logged today — drives the pulse animation.
  final bool hasActiveWork;

  /// Coordinate polygon for this floor from the building-line-coordinates API.
  /// JSON string — e.g. "[[0,0],[25000,0],[25000,20000],[0,20000]]"
  /// Null when the admin has not yet drawn coordinates for this floor.
  final String? coordinatesText;

  /// Unit of measurement for [coordinatesText] values — 'mm', 'cm', or 'm'.
  final String? coordinateUom;

  /// Floor-to-ceiling height in metres (used for isometric extrusion depth).
  final double? heightMeters;

  const FloorProgress({
    required this.epsNodeId,
    required this.floorName,
    required this.floorIndex,
    required this.progressPct,
    required this.totalActivities,
    required this.completedActivities,
    required this.pendingActivities,
    required this.inProgressActivities,
    required this.openQualityObs,
    required this.openEhsObs,
    required this.pendingRfis,
    required this.rejectedRfis,
    required this.hasActiveWork,
    this.coordinatesText,
    this.coordinateUom,
    this.heightMeters,
  });

  // ─── Computed getters ────────────────────────────────────────────────────────

  /// Construction phase based on completion percentage.
  FloorPhase get phase {
    if (progressPct >= 100) return FloorPhase.complete;
    if (progressPct >= 81) return FloorPhase.nearComplete;
    if (progressPct >= 56) return FloorPhase.finishing;
    if (progressPct >= 31) return FloorPhase.mepRoughIn;
    if (progressPct > 0) return FloorPhase.structure;
    return FloorPhase.notStarted;
  }

  /// True if there are any unresolved quality or EHS issues on this floor.
  bool get hasIssues =>
      openQualityObs > 0 || openEhsObs > 0 || rejectedRfis > 0;

  /// True if this floor has no activities configured yet (no data).
  bool get isEmpty => totalActivities == 0;

  // ─── Factories ───────────────────────────────────────────────────────────────

  /// Empty floor — no data yet. Uses node-level EPS progress if available.
  factory FloorProgress.empty(
    int epsNodeId,
    String floorName,
    int floorIndex, {
    double progressPct = 0.0,
    String? coordinatesText,
    String? coordinateUom,
    double? heightMeters,
  }) =>
      FloorProgress(
        epsNodeId: epsNodeId,
        floorName: floorName,
        floorIndex: floorIndex,
        progressPct: progressPct,
        totalActivities: 0,
        completedActivities: 0,
        pendingActivities: 0,
        inProgressActivities: 0,
        openQualityObs: 0,
        openEhsObs: 0,
        pendingRfis: 0,
        rejectedRfis: 0,
        hasActiveWork: false,
        coordinatesText: coordinatesText,
        coordinateUom: coordinateUom,
        heightMeters: heightMeters,
      );

  /// Parse from the optimized backend endpoint response.
  factory FloorProgress.fromJson(Map<String, dynamic> json) {
    return FloorProgress(
      epsNodeId: json['epsNodeId'] as int? ?? json['eps_node_id'] as int? ?? 0,
      floorName: json['floorName']?.toString() ??
          json['floor_name']?.toString() ??
          'Floor',
      floorIndex:
          json['floorIndex'] as int? ?? json['floor_index'] as int? ?? 0,
      progressPct:
          (json['progressPct'] as num? ?? json['progress_pct'] as num? ?? 0)
              .toDouble()
              .clamp(0.0, 100.0),
      totalActivities: json['totalActivities'] as int? ??
          json['total_activities'] as int? ??
          0,
      completedActivities: json['completedActivities'] as int? ??
          json['completed_activities'] as int? ??
          0,
      pendingActivities: json['pendingActivities'] as int? ??
          json['pending_activities'] as int? ??
          0,
      inProgressActivities: json['inProgressActivities'] as int? ??
          json['in_progress_activities'] as int? ??
          0,
      openQualityObs: json['openQualityObs'] as int? ??
          json['open_quality_obs'] as int? ??
          0,
      openEhsObs:
          json['openEhsObs'] as int? ?? json['open_ehs_obs'] as int? ?? 0,
      pendingRfis:
          json['pendingRfis'] as int? ?? json['pending_rfis'] as int? ?? 0,
      rejectedRfis:
          json['rejectedRfis'] as int? ?? json['rejected_rfis'] as int? ?? 0,
      hasActiveWork: json['hasActiveWork'] as bool? ??
          json['has_active_work'] as bool? ??
          false,
      // Coordinates are merged in by the repository after fetching the
      // building-line-coordinates endpoint — not present in tower-progress JSON.
      coordinatesText: json['coordinatesText']?.toString() ??
          json['coordinates_text']?.toString(),
      coordinateUom: json['coordinateUom']?.toString() ??
          json['coordinate_uom']?.toString(),
      heightMeters:
          (json['heightMeters'] as num? ?? json['height_meters'] as num?)
              ?.toDouble(),
    );
  }

  FloorProgress copyWith({
    int? epsNodeId,
    String? floorName,
    int? floorIndex,
    double? progressPct,
    int? totalActivities,
    int? completedActivities,
    int? pendingActivities,
    int? inProgressActivities,
    int? openQualityObs,
    int? openEhsObs,
    int? pendingRfis,
    int? rejectedRfis,
    bool? hasActiveWork,
    String? coordinatesText,
    String? coordinateUom,
    double? heightMeters,
  }) =>
      FloorProgress(
        epsNodeId: epsNodeId ?? this.epsNodeId,
        floorName: floorName ?? this.floorName,
        floorIndex: floorIndex ?? this.floorIndex,
        progressPct: progressPct ?? this.progressPct,
        totalActivities: totalActivities ?? this.totalActivities,
        completedActivities: completedActivities ?? this.completedActivities,
        pendingActivities: pendingActivities ?? this.pendingActivities,
        inProgressActivities: inProgressActivities ?? this.inProgressActivities,
        openQualityObs: openQualityObs ?? this.openQualityObs,
        openEhsObs: openEhsObs ?? this.openEhsObs,
        pendingRfis: pendingRfis ?? this.pendingRfis,
        rejectedRfis: rejectedRfis ?? this.rejectedRfis,
        hasActiveWork: hasActiveWork ?? this.hasActiveWork,
        coordinatesText: coordinatesText ?? this.coordinatesText,
        coordinateUom: coordinateUom ?? this.coordinateUom,
        heightMeters: heightMeters ?? this.heightMeters,
      );

  @override
  List<Object?> get props => [
        epsNodeId,
        progressPct,
        openQualityObs,
        openEhsObs,
        hasActiveWork,
        totalActivities,
      ];
}
