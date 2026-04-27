import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';

// ==================== ENUMS ====================

/// The display status of a quality activity row in the site engineer's checklist.
///
/// This is a CLIENT-SIDE concept derived by [QualityRequestBloc._buildRows]
/// from the combination of the activity's backend status + its inspection record
/// + the predecessor chain. It drives the row's icon, colour, and available actions.
enum ActivityDisplayStatus {
  /// Predecessor activity has not yet been approved — cannot raise RFI yet.
  locked,

  /// All predecessors are approved (or allowBreak=true) — RFI can be raised.
  ready,

  /// RFI has been raised and is awaiting the QC inspector's evaluation.
  pending,

  /// The QC inspector approved this activity.
  approved,

  /// The QC inspector rejected this activity — needs rework and re-inspection.
  rejected,

  /// Provisionally approved — approved with a pending minor follow-up.
  provisionallyApproved,

  /// The QC inspector raised a defect observation — the site engineer must
  /// rectify the issue and submit evidence before re-inspection.
  pendingObservation,
}

/// Extension providing UI-ready properties for [ActivityDisplayStatus].
extension ActivityDisplayStatusX on ActivityDisplayStatus {
  /// Human-readable label shown in the activity row badge.
  String get label {
    switch (this) {
      case ActivityDisplayStatus.locked:
        return 'Locked';
      case ActivityDisplayStatus.ready:
        return 'Ready to Request';
      case ActivityDisplayStatus.pending:
        return 'QC Pending';
      case ActivityDisplayStatus.approved:
        return 'Approved';
      case ActivityDisplayStatus.rejected:
        return 'Rejected';
      case ActivityDisplayStatus.provisionallyApproved:
        return 'Prov. Approved';
      case ActivityDisplayStatus.pendingObservation:
        return 'Fix Observation';
    }
  }

  /// Foreground colour for the status badge text and icon.
  Color get color {
    switch (this) {
      case ActivityDisplayStatus.locked:
        return Colors.grey;
      case ActivityDisplayStatus.ready:
        return Colors.blue;
      case ActivityDisplayStatus.pending:
        return Colors.amber.shade700;
      case ActivityDisplayStatus.approved:
        return Colors.green;
      case ActivityDisplayStatus.rejected:
        return Colors.red;
      case ActivityDisplayStatus.provisionallyApproved:
        return Colors.blue.shade700;
      case ActivityDisplayStatus.pendingObservation:
        return Colors.red.shade700;
    }
  }

  /// Background colour for the status badge chip.
  Color get backgroundColor {
    switch (this) {
      case ActivityDisplayStatus.locked:
        return Colors.grey.shade100;
      case ActivityDisplayStatus.ready:
        return Colors.blue.shade50;
      case ActivityDisplayStatus.pending:
        return Colors.amber.shade50;
      case ActivityDisplayStatus.approved:
        return Colors.green.shade50;
      case ActivityDisplayStatus.rejected:
        return Colors.red.shade50;
      case ActivityDisplayStatus.provisionallyApproved:
        return Colors.blue.shade50;
      case ActivityDisplayStatus.pendingObservation:
        return Colors.red.shade50;
    }
  }

  /// Icon shown alongside the status badge.
  IconData get icon {
    switch (this) {
      case ActivityDisplayStatus.locked:
        return Icons.lock_outline;
      case ActivityDisplayStatus.ready:
        return Icons.assignment_outlined;
      case ActivityDisplayStatus.pending:
        return Icons.schedule;
      case ActivityDisplayStatus.approved:
        return Icons.check_circle_outline;
      case ActivityDisplayStatus.rejected:
        return Icons.cancel_outlined;
      case ActivityDisplayStatus.provisionallyApproved:
        return Icons.verified_outlined;
      case ActivityDisplayStatus.pendingObservation:
        return Icons.warning_amber_outlined;
    }
  }
}

/// Server-side status of a [QualityInspection] (RFI) record.
enum InspectionStatus {
  pending,
  partiallyApproved,
  approved,
  provisionallyApproved,
  rejected,
  canceled,
  reversed;

  /// Parse from the backend string value (case-insensitive).
  static InspectionStatus fromString(String v) {
    switch (v.toUpperCase()) {
      case 'PENDING':
        return InspectionStatus.pending;
      case 'PARTIALLY_APPROVED':
        return InspectionStatus.partiallyApproved;
      case 'APPROVED':
        return InspectionStatus.approved;
      case 'PROVISIONALLY_APPROVED':
        return InspectionStatus.provisionallyApproved;
      case 'REJECTED':
        return InspectionStatus.rejected;
      case 'CANCELED':
        return InspectionStatus.canceled;
      case 'REVERSED':
        return InspectionStatus.reversed;
      default:
        return InspectionStatus.pending;
    }
  }

  /// Display label for the inspection status chip.
  String get label {
    switch (this) {
      case InspectionStatus.pending:
        return 'Pending QC';
      case InspectionStatus.partiallyApproved:
        return 'Partially Approved';
      case InspectionStatus.approved:
        return 'Approved';
      case InspectionStatus.provisionallyApproved:
        return 'Prov. Approved';
      case InspectionStatus.rejected:
        return 'Rejected';
      case InspectionStatus.canceled:
        return 'Canceled';
      case InspectionStatus.reversed:
        return 'Reversed';
    }
  }

  /// Foreground colour for the status chip.
  Color get color {
    switch (this) {
      case InspectionStatus.pending:
        return Colors.amber.shade700;
      case InspectionStatus.partiallyApproved:
        return Colors.orange;
      case InspectionStatus.approved:
        return Colors.green;
      case InspectionStatus.provisionallyApproved:
        return Colors.blue;
      case InspectionStatus.rejected:
        return Colors.red;
      case InspectionStatus.canceled:
      case InspectionStatus.reversed:
        return Colors.grey;
    }
  }

  /// Background colour — derived from [color] at 10% opacity.
  Color get backgroundColor {
    return color.withValues(alpha: 0.1);
  }
}

/// Lifecycle status of an activity-level defect observation.
enum ObservationStatus {
  pending,
  rectified,
  closed;

  /// Parse from the backend string value.
  static ObservationStatus fromString(String v) {
    switch (v.toUpperCase()) {
      case 'RECTIFIED':
        return ObservationStatus.rectified;
      case 'CLOSED':
        return ObservationStatus.closed;
      default:
        return ObservationStatus.pending;
    }
  }

  String get label {
    switch (this) {
      case ObservationStatus.pending:
        return 'Pending';
      case ObservationStatus.rectified:
        return 'Rectified ✓';
      case ObservationStatus.closed:
        return 'Closed';
    }
  }

  Color get color {
    switch (this) {
      case ObservationStatus.pending:
        return Colors.red;
      case ObservationStatus.rectified:
        return Colors.blue;
      case ObservationStatus.closed:
        return Colors.green;
    }
  }
}

/// Status of a single checklist item. `null` means not yet evaluated.
enum ChecklistItemStatus {
  pass,
  na;

  /// Parse from a checklist item JSON object.
  ///
  /// Supports two backend formats:
  ///   - New format: `"status": "PASS"` or `"status": "NA"`
  ///   - Old format: `"isOk": true` (treated as PASS; false → null/unevaluated)
  static ChecklistItemStatus? fromJson(Map<String, dynamic> json) {
    final statusStr = json['status'] as String?;
    if (statusStr != null) {
      switch (statusStr.toUpperCase()) {
        case 'PASS':
          return ChecklistItemStatus.pass;
        case 'NA':
        case 'NOT_APPLICABLE':
          return ChecklistItemStatus.na;
      }
    }
    // Also check `value` field — the backend stores the inspector's selection
    // here and returns it on every stage fetch.
    final valueStr = json['value'] as String?;
    if (valueStr != null) {
      switch (valueStr.toUpperCase()) {
        case 'YES':
          return ChecklistItemStatus.pass;
        case 'NA':
          return ChecklistItemStatus.na;
      }
    }
    // Backward compat: old backend sends `isOk: true/false`
    final isOk = json['isOk'] as bool?;
    return isOk == true ? ChecklistItemStatus.pass : null;
  }

  /// Value sent to the API when saving checklist progress.
  String get apiValue {
    switch (this) {
      case ChecklistItemStatus.pass:
        return 'PASS';
      case ChecklistItemStatus.na:
        return 'NA';
    }
  }

  /// Label shown next to the toggle button in the checklist UI.
  String get label {
    switch (this) {
      case ChecklistItemStatus.pass:
        return 'Yes';
      case ChecklistItemStatus.na:
        return 'N/A';
    }
  }
}

// ==================== MODELS ====================

/// A named checklist template assigned to an EPS location node.
/// Lists group related quality activities (e.g. "Structural Slab Checklist").
class QualityActivityList extends Equatable {
  final int id;
  final String name;
  final String? description;
  final int projectId;
  final int? epsNodeId;
  final int activityCount;

  const QualityActivityList({
    required this.id,
    required this.name,
    this.description,
    required this.projectId,
    this.epsNodeId,
    this.activityCount = 0,
  });

  factory QualityActivityList.fromJson(Map<String, dynamic> json) {
    return QualityActivityList(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      projectId: json['projectId'] as int? ?? 0,
      epsNodeId: json['epsNodeId'] as int?,
      // Prefer the pre-computed count field; fall back to counting the
      // embedded activities array if it was included in the response.
      activityCount: (json['activityCount'] as int?) ??
          (json['activities'] as List?)?.length ??
          0,
    );
  }

  @override
  List<Object?> get props =>
      [id, name, description, projectId, epsNodeId, activityCount];
}

/// A single quality activity (checklist item) within a [QualityActivityList].
///
/// [holdPoint] = true means work must stop until QC approves this activity.
/// [witnessPoint] = true means QC must witness the work (but doesn't block it).
/// [allowBreak] = true means this activity can be raised out-of-sequence
///   (i.e. the normal predecessor gate is overridden).
/// [incomingEdges] defines the multi-predecessor graph (takes priority over
///   the legacy [previousActivityId] single-chain model).
/// [applicabilityLevel] determines the RFI mode: 'FLOOR' (One Go / Multi Go),
///   'UNIT' (Unit Wise — one RFI per unit), or 'ROOM'. Null = default FLOOR.
class QualityActivity extends Equatable {
  final int id;
  final int listId;
  final int sequence;
  final String activityName;
  final String? description;
  final bool holdPoint;
  final bool witnessPoint;
  final bool allowBreak;
  final String status; // raw string from backend
  final int? previousActivityId;
  final List<IncomingEdge> incomingEdges;
  final String? applicabilityLevel; // 'FLOOR' | 'UNIT' | 'ROOM' | null

  const QualityActivity({
    required this.id,
    required this.listId,
    required this.sequence,
    required this.activityName,
    this.description,
    this.holdPoint = false,
    this.witnessPoint = false,
    this.allowBreak = false,
    this.status = 'NOT_STARTED',
    this.previousActivityId,
    this.incomingEdges = const [],
    this.applicabilityLevel,
  });

  factory QualityActivity.fromJson(Map<String, dynamic> json) {
    return QualityActivity(
      id: json['id'] as int,
      listId: json['listId'] as int? ?? 0,
      sequence: json['sequence'] as int? ?? 0,
      activityName: json['activityName'] as String? ?? '',
      description: json['description'] as String?,
      holdPoint: json['holdPoint'] as bool? ?? false,
      witnessPoint: json['witnessPoint'] as bool? ?? false,
      allowBreak: json['allowBreak'] as bool? ?? false,
      status: json['status'] as String? ?? 'NOT_STARTED',
      previousActivityId: json['previousActivityId'] as int?,
      incomingEdges: (json['incomingEdges'] as List<dynamic>?)
              ?.map((e) => IncomingEdge.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      applicabilityLevel: json['applicabilityLevel'] as String?,
    );
  }

  /// Compute the display status for this activity from its backend status
  /// and its latest inspection record. Used in the offline list view.
  ActivityDisplayStatus displayStatus(QualityInspection? inspection) {
    if (status == 'PENDING_OBSERVATION') {
      return ActivityDisplayStatus.pendingObservation;
    }
    if (inspection != null) {
      switch (inspection.status) {
        case InspectionStatus.pending:
          return ActivityDisplayStatus.pending;
        case InspectionStatus.approved:
          return ActivityDisplayStatus.approved;
        case InspectionStatus.provisionallyApproved:
          return ActivityDisplayStatus.provisionallyApproved;
        case InspectionStatus.rejected:
          return ActivityDisplayStatus.rejected;
        default:
          return ActivityDisplayStatus.pending;
      }
    }
    // No inspection and not pending observation — default to locked.
    return ActivityDisplayStatus.locked;
  }

  /// True when the site engineer is allowed to raise an RFI for this activity.
  bool canRaiseRfi(bool predecessorDone) =>
      (status == 'NOT_STARTED') && (predecessorDone || allowBreak);

  /// True when the site engineer must resolve an outstanding observation before
  /// any further action on this activity.
  bool get needsObservationFix => status == 'PENDING_OBSERVATION';

  @override
  List<Object?> get props => [id, listId, sequence, activityName, status];
}

/// A directed edge from a predecessor activity to this activity.
/// Used to enforce that predecessor work is approved before this activity
/// can be unlocked for inspection.
class IncomingEdge extends Equatable {
  /// The ID of the activity that must be approved before this one is unlocked.
  final int sourceId;

  const IncomingEdge({required this.sourceId});

  factory IncomingEdge.fromJson(Map<String, dynamic> json) {
    return IncomingEdge(
      sourceId: json['sourceId'] as int? ?? 0,
    );
  }

  @override
  List<Object?> get props => [sourceId];
}

/// An inspection record (RFI) raised by a site engineer for a quality activity.
///
/// The server response includes several optional location fields that may come
/// from different sources (top-level, `location` sub-object, or `epsNode`).
/// [fromJson] normalises these into flat fields using the [readString] /
/// [readInt] helpers so the UI never has to parse nested JSON.
class QualityInspection extends Equatable {
  final int id;
  final int activityId;
  final int? epsNodeId;
  final int? listId;
  final int? projectId;
  final InspectionStatus status;
  final String requestDate;
  final String? inspectionDate;
  final String? comments;
  final String? inspectedBy;
  final String? activityName; // joined from activity relation
  final String? epsNodeLabel; // joined from epsNode relation
  final String? blockName;
  final String? towerName;
  final String? floorName;
  final String? unitName;
  final String? locationPath;
  final int? workflowCurrentLevel;
  final int? workflowTotalLevels;
  final int pendingObservationCount;
  final DateTime? slaDueAt;
  final List<InspectionStage> stages;

  // Multi-part RFI support (e.g. "Part 1 of 3")
  final int partNo;
  final int totalParts;
  final String? partLabel;

  // Vendor captured at RFI creation
  final int? vendorId;
  final String? vendorName;

  // Unit Wise RFI — the specific unit this inspection covers
  final int? qualityUnitId;

  /// Stage-driven pending approval display, e.g. "Stage Pre-Execution - Level 2 Pending: QC Engineer".
  /// Set by the backend's `attachWorkflowSummary` — null until the inspection
  /// enters the approval flow.
  final String? pendingApprovalDisplay;

  /// Short label for the approval cards list, e.g. "2 stages pending".
  final String? pendingApprovalLabel;

  const QualityInspection({
    required this.id,
    required this.activityId,
    this.epsNodeId,
    this.listId,
    this.projectId,
    required this.status,
    required this.requestDate,
    this.inspectionDate,
    this.comments,
    this.inspectedBy,
    this.activityName,
    this.epsNodeLabel,
    this.blockName,
    this.towerName,
    this.floorName,
    this.unitName,
    this.locationPath,
    this.workflowCurrentLevel,
    this.workflowTotalLevels,
    this.pendingObservationCount = 0,
    this.slaDueAt,
    this.stages = const [],
    this.partNo = 1,
    this.totalParts = 1,
    this.partLabel,
    this.vendorId,
    this.vendorName,
    this.qualityUnitId,
    this.pendingApprovalDisplay,
    this.pendingApprovalLabel,
  });

  factory QualityInspection.fromJson(Map<String, dynamic> json) {
    // Inline helpers for defensive field extraction across different API versions.
    final activity = json['activity'] as Map<String, dynamic>?;
    final epsNode = json['epsNode'] as Map<String, dynamic>?;
    final location = json['location'] as Map<String, dynamic>?;

    // Accepts a raw value that may be null, DateTime, or ISO string.
    DateTime? parseDate(dynamic raw) {
      if (raw == null) return null;
      if (raw is DateTime) return raw;
      if (raw is String && raw.isNotEmpty) return DateTime.tryParse(raw);
      return null;
    }

    // Returns the first non-empty string from a list of candidate values.
    // Used to normalise location fields that may arrive under different keys.
    String? readString(List<dynamic> candidates) {
      for (final candidate in candidates) {
        if (candidate is String && candidate.trim().isNotEmpty) {
          return candidate.trim();
        }
      }
      return null;
    }

    // Returns the first parseable int from a list of candidate values.
    // Handles int, num, and numeric string representations.
    int? readInt(List<dynamic> candidates) {
      for (final candidate in candidates) {
        if (candidate is int) return candidate;
        if (candidate is num) return candidate.toInt();
        if (candidate is String) {
          final parsed = int.tryParse(candidate);
          if (parsed != null) return parsed;
        }
      }
      return null;
    }

    return QualityInspection(
      id: json['id'] as int,
      activityId: json['activityId'] as int? ?? 0,
      epsNodeId: json['epsNodeId'] as int?,
      listId: json['listId'] as int?,
      projectId: json['projectId'] as int?,
      status:
          InspectionStatus.fromString(json['status'] as String? ?? 'PENDING'),
      requestDate: json['requestDate'] as String? ?? '',
      inspectionDate: json['inspectionDate'] as String?,
      comments: json['comments'] as String?,
      inspectedBy: json['inspectedBy'] as String?,
      activityName: activity?['activityName'] as String?,
      epsNodeLabel: epsNode?['label'] as String? ?? epsNode?['name'] as String?,
      // Normalise location fields from multiple possible source keys.
      blockName: readString(
          [json['blockName'], location?['blockName'], location?['block']]),
      towerName: readString(
          [json['towerName'], location?['towerName'], location?['tower']]),
      floorName: readString(
          [json['floorName'], location?['floorName'], location?['floor']]),
      unitName: readString(
          [json['unitName'], location?['unitName'], location?['unit']]),
      locationPath: readString(
          [json['locationPath'], location?['path'], location?['locationPath']]),
      // Workflow level fields may come from different API shapes depending on
      // which endpoint returned this inspection.
      workflowCurrentLevel: readInt([
        json['workflowCurrentLevel'],
        json['currentApprovalLevel'],
        json['currentLevel'],
      ]),
      workflowTotalLevels: readInt([
        json['workflowTotalLevels'],
        json['approvalLevels'],
        json['totalLevels'],
      ]),
      // Similarly, pending observation count may be named differently.
      pendingObservationCount: readInt([
            json['pendingObservationCount'],
            json['openObservationCount'],
            json['observationPendingCount'],
          ]) ??
          0,
      slaDueAt: parseDate(json['slaDueAt'] ?? json['dueAt']),
      stages: (json['stages'] as List<dynamic>?)
              ?.map((e) => InspectionStage.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      partNo: json['partNo'] as int? ?? 1,
      totalParts: json['totalParts'] as int? ?? 1,
      partLabel: json['partLabel'] as String?,
      vendorId: json['vendorId'] as int?,
      vendorName: json['vendorName'] as String?,
      qualityUnitId: json['qualityUnitId'] as int?,
      pendingApprovalDisplay: json['pendingApprovalDisplay'] as String?,
      pendingApprovalLabel: json['pendingApprovalLabel'] as String?,
    );
  }

  /// True when this RFI is one of multiple parts (e.g. Part 2 of 3).
  bool get isMultiPart => totalParts > 1;

  /// Display label for multi-part RFI, e.g. "Part 1 of 3" or a custom label.
  String get partDisplay =>
      partLabel?.isNotEmpty == true ? partLabel! : 'Part $partNo of $totalParts';

  bool get isPending => status == InspectionStatus.pending;
  DateTime? get requestDateTime =>
      requestDate.isEmpty ? null : DateTime.tryParse(requestDate);

  /// Count of stages where all items have been evaluated.
  int get completedStages => stages.where((s) => s.allOk).length;
  int get totalStages => stages.length;

  /// Returns the first floor-like part of the location hierarchy for compact display.
  String? get primaryFloorLabel {
    if (floorName != null && floorName!.isNotEmpty) return floorName;
    for (final part in locationHierarchy) {
      if (part.toLowerCase().contains('floor')) return part;
    }
    return null;
  }

  /// Builds an ordered list of non-empty location labels (block, tower, floor, unit).
  /// Falls back to splitting [locationPath] or [epsNodeLabel] by common delimiters.
  List<String> get locationHierarchy {
    final hierarchy = <String>[
      if (blockName != null && blockName!.isNotEmpty) blockName!,
      if (towerName != null && towerName!.isNotEmpty) towerName!,
      if (floorName != null && floorName!.isNotEmpty) floorName!,
      if (unitName != null && unitName!.isNotEmpty) unitName!,
    ];
    if (hierarchy.isNotEmpty) return hierarchy;

    // Fall back to splitting the raw location path by common separators.
    final raw = locationPath ?? epsNodeLabel;
    if (raw == null || raw.trim().isEmpty) return const [];
    final parts = raw
        .split(RegExp(r'[>/|,]'))
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
    return parts;
  }

  /// Single-line location string for list tiles (e.g. "Block A > Tower 1 > Floor 3").
  String get locationDisplay {
    final hierarchy = locationHierarchy;
    if (hierarchy.isNotEmpty) return hierarchy.join(' > ');
    return 'Location unavailable';
  }

  @override
  List<Object?> get props => [
        id,
        activityId,
        status,
        requestDate,
        inspectionDate,
        comments,
        inspectedBy,
        activityName,
        epsNodeLabel,
        blockName,
        towerName,
        floorName,
        unitName,
        locationPath,
        workflowCurrentLevel,
        workflowTotalLevels,
        pendingObservationCount,
        slaDueAt,
        stages,
        partNo,
        totalParts,
        partLabel,
        vendorId,
        vendorName,
        pendingApprovalDisplay,
        pendingApprovalLabel,
      ];
}

/// A checklist stage within an inspection.
/// Stages group related checklist items (e.g. "Pre-Pour Checks", "Post-Pour Checks").
class InspectionStage extends Equatable {
  final int id;
  final String? stageName;
  final String status;
  final List<ChecklistItem> items;

  /// Stage-level approval matrix from the backend's `attachWorkflowSummary`.
  /// Null when the inspection has not yet entered the approval flow.
  final StageApproval? stageApproval;

  /// Count of open (pending) observations linked to this stage.
  /// A stage cannot be approved while this is > 0.
  final int openObservationCount;

  const InspectionStage({
    required this.id,
    this.stageName,
    required this.status,
    this.items = const [],
    this.stageApproval,
    this.openObservationCount = 0,
  });

  factory InspectionStage.fromJson(Map<String, dynamic> json) {
    // Stage name comes from the stageTemplate relation, not directly on the stage record.
    final template = json['stageTemplate'] as Map<String, dynamic>?;
    final approvalRaw = json['stageApproval'] as Map<String, dynamic>?;
    return InspectionStage(
      id: json['id'] as int,
      stageName: template?['name'] as String? ?? 'General Checks',
      status: json['status'] as String? ?? 'PENDING',
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => ChecklistItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      stageApproval:
          approvalRaw != null ? StageApproval.fromJson(approvalRaw) : null,
      openObservationCount: json['openObservationCount'] as int? ?? 0,
    );
  }

  /// Count of items explicitly marked as PASS.
  int get completedCount => items.where((i) => i.isOk).length;

  /// Count of items that have been evaluated in any way (PASS or N/A).
  int get resolvedCount => items.where((i) => i.itemStatus != null).length;
  int get totalCount => items.length;

  /// True when every item has been evaluated (none left as null/unevaluated).
  bool get allOk =>
      items.isNotEmpty && items.every((i) => i.itemStatus != null);

  /// True when this stage has been fully approved through all release levels.
  bool get isFullyApproved => stageApproval?.fullyApproved == true;

  /// True when items are all evaluated, no open observations, and not yet approved.
  bool get canApprove =>
      allOk && openObservationCount == 0 && !isFullyApproved;

  /// Returns a new [InspectionStage] with the given items, preserving other fields.
  InspectionStage copyWithItems(List<ChecklistItem> newItems) {
    return InspectionStage(
      id: id,
      stageName: stageName,
      status: status,
      items: newItems,
      stageApproval: stageApproval,
      openObservationCount: openObservationCount,
    );
  }

  @override
  List<Object?> get props =>
      [id, stageName, status, items, stageApproval, openObservationCount];
}

/// A single checklist item within an [InspectionStage].
///
/// [itemStatus] = null means the item has not been evaluated yet.
/// [itemText] comes from the `itemTemplate` relation (the template defines
/// the question text; the instance record carries the inspector's response).
class ChecklistItem extends Equatable {
  final int id;
  final String itemText;
  final int sequence;

  /// null = not yet evaluated, pass = Yes, na = Not Applicable
  final ChecklistItemStatus? itemStatus;
  final String? remarks;
  final String? value;

  const ChecklistItem({
    required this.id,
    required this.itemText,
    required this.sequence,
    this.itemStatus,
    this.remarks,
    this.value,
  });

  /// True only when marked as PASS (backend uses this field exclusively).
  bool get isOk => itemStatus == ChecklistItemStatus.pass;

  factory ChecklistItem.fromJson(Map<String, dynamic> json) {
    // Item text comes from the itemTemplate relation, not the instance record.
    final template = json['itemTemplate'] as Map<String, dynamic>?;
    return ChecklistItem(
      id: json['id'] as int,
      itemText: template?['itemText'] as String? ?? 'Checklist Item',
      sequence: template?['sequence'] as int? ?? 0,
      // Delegates to ChecklistItemStatus.fromJson to handle both new and old formats.
      itemStatus: ChecklistItemStatus.fromJson(json),
      remarks: json['remarks'] as String?,
      value: json['value'] as String?,
    );
  }

  /// Copy with updated remarks only. Used by [UpdateItemRemarks] in the BLoC.
  ChecklistItem copyWith({String? remarks}) {
    return ChecklistItem(
      id: id,
      itemText: itemText,
      sequence: sequence,
      itemStatus: itemStatus,
      remarks: remarks ?? this.remarks,
      value: value,
    );
  }

  /// Copy with a new status value. Used by [SetChecklistItemStatus] in the BLoC.
  ChecklistItem copyWithStatus(ChecklistItemStatus? newStatus) {
    return ChecklistItem(
      id: id,
      itemText: itemText,
      sequence: sequence,
      itemStatus: newStatus,
      remarks: remarks,
      value: value,
    );
  }

  /// Serialises to the format expected by the PATCH /quality/stages/:id endpoint.
  /// Sends both `isOk` (backward compat) and `status` (new format).
  /// `value` is always derived from [itemStatus] so that NA items correctly
  /// pass the backend's `value === 'NA'` approval check even when the item
  /// was freshly set in the UI and was never loaded from the server.
  Map<String, dynamic> toApiPayload() => {
        'id': id,
        'isOk': isOk, // backward compat with older backend versions
        if (itemStatus != null) 'status': itemStatus!.apiValue,
        'remarks': remarks,
        'value': itemStatus == ChecklistItemStatus.pass
            ? 'YES'
            : itemStatus == ChecklistItemStatus.na
                ? 'NA'
                : value,
      };

  @override
  List<Object?> get props => [id, itemStatus, remarks, value];
}

/// A defect observation raised by a QC inspector on a specific activity.
///
/// Lifecycle: pending → rectified (by site engineer) → closed (by QC inspector).
/// Photos are resolved to absolute URLs via [ApiEndpoints.resolveUrl] at parse
/// time so widgets never need to know the server base URL.
class ActivityObservation extends Equatable {
  final String id; // UUID from backend
  final int activityId;
  final String observationText;
  final String type; // Minor / Major / Critical
  final String? remarks;
  final List<String> photos;
  final String? closureText;
  final List<String> closureEvidence;
  final ObservationStatus status;
  final DateTime createdAt;

  const ActivityObservation({
    required this.id,
    required this.activityId,
    required this.observationText,
    this.type = 'Minor',
    this.remarks,
    this.photos = const [],
    this.closureText,
    this.closureEvidence = const [],
    required this.status,
    required this.createdAt,
  });

  factory ActivityObservation.fromJson(Map<String, dynamic> json) {
    return ActivityObservation(
      id: json['id'] as String,
      activityId: json['activityId'] as int? ?? 0,
      observationText: json['observationText'] as String? ?? '',
      type: json['type'] as String? ?? 'Minor',
      remarks: json['remarks'] as String?,
      // Resolve relative photo paths to absolute URLs using the configured base URL.
      photos: (json['photos'] as List<dynamic>?)
              ?.map((e) => ApiEndpoints.resolveUrl(e.toString()))
              .toList() ??
          [],
      closureText: json['closureText'] as String?,
      closureEvidence: (json['closureEvidence'] as List<dynamic>?)
              ?.map((e) => ApiEndpoints.resolveUrl(e.toString()))
              .toList() ??
          [],
      status:
          ObservationStatus.fromString(json['status'] as String? ?? 'PENDING'),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  bool get isPending => status == ObservationStatus.pending;
  bool get isRectified => status == ObservationStatus.rectified;
  bool get isClosed => status == ObservationStatus.closed;

  @override
  List<Object?> get props =>
      [id, activityId, observationText, status, closureText];
}

// ==================== STAGE APPROVAL MODELS ====================

/// A single level in the stage-level approval matrix.
///
/// Mirrors the `buildStageApprovalDetails` response from the backend:
/// each level corresponds to one release-strategy step.
class StageApprovalLevel extends Equatable {
  final int stepOrder;
  final String stepName;
  final bool approved;
  final bool autoInherited;
  final String? signerDisplayName;
  final String? signerCompany;
  final String? signerRoleLabel;
  final String? approvedAt;

  const StageApprovalLevel({
    required this.stepOrder,
    required this.stepName,
    required this.approved,
    this.autoInherited = false,
    this.signerDisplayName,
    this.signerCompany,
    this.signerRoleLabel,
    this.approvedAt,
  });

  factory StageApprovalLevel.fromJson(Map<String, dynamic> json) {
    return StageApprovalLevel(
      stepOrder: json['stepOrder'] as int? ?? 0,
      stepName: json['stepName'] as String? ?? '',
      approved: json['approved'] as bool? ?? false,
      autoInherited: json['autoInherited'] as bool? ?? false,
      signerDisplayName: json['signerDisplayName'] as String?,
      signerCompany: json['signerCompany'] as String?,
      signerRoleLabel: json['signerRoleLabel'] as String?,
      approvedAt: json['approvedAt'] as String?,
    );
  }

  @override
  List<Object?> get props =>
      [stepOrder, stepName, approved, autoInherited, signerDisplayName, approvedAt];
}

/// Aggregated approval state for a single checklist stage.
///
/// Returned by `attachWorkflowSummary` on the backend under each stage's
/// `stageApproval` key.
class StageApproval extends Equatable {
  final List<StageApprovalLevel> levels;
  final List<StageApprovalLevel> pendingLevels;
  final int approvedLevelCount;
  final int requiredLevelCount;
  final bool fullyApproved;
  final String? pendingDisplay;

  const StageApproval({
    this.levels = const [],
    this.pendingLevels = const [],
    this.approvedLevelCount = 0,
    this.requiredLevelCount = 0,
    this.fullyApproved = false,
    this.pendingDisplay,
  });

  factory StageApproval.fromJson(Map<String, dynamic> json) {
    return StageApproval(
      levels: (json['levels'] as List<dynamic>?)
              ?.map((e) => StageApprovalLevel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      pendingLevels: (json['pendingLevels'] as List<dynamic>?)
              ?.map((e) => StageApprovalLevel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      approvedLevelCount: json['approvedLevelCount'] as int? ?? 0,
      requiredLevelCount: json['requiredLevelCount'] as int? ?? 0,
      fullyApproved: json['fullyApproved'] as bool? ?? false,
      pendingDisplay: json['pendingDisplay'] as String?,
    );
  }

  String get progressLabel => '$approvedLevelCount / $requiredLevelCount';

  @override
  List<Object?> get props =>
      [approvedLevelCount, requiredLevelCount, fullyApproved, pendingDisplay];
}

// ==================== WORKFLOW MODELS ====================

/// Overall status of a multi-level approval workflow run.
enum WorkflowRunStatus {
  inProgress,
  completed,
  rejected,
  reversed;

  static WorkflowRunStatus fromString(String v) {
    switch (v.toUpperCase()) {
      case 'COMPLETED':
        return WorkflowRunStatus.completed;
      case 'REJECTED':
        return WorkflowRunStatus.rejected;
      case 'REVERSED':
        return WorkflowRunStatus.reversed;
      default:
        return WorkflowRunStatus.inProgress;
    }
  }
}

/// Status of a single step within a workflow run.
enum WorkflowStepStatus {
  waiting,
  pending,
  inProgress,
  completed,
  rejected,
  skipped;

  static WorkflowStepStatus fromString(String v) {
    switch (v.toUpperCase()) {
      case 'PENDING':
        return WorkflowStepStatus.pending;
      case 'IN_PROGRESS':
        return WorkflowStepStatus.inProgress;
      case 'COMPLETED':
        return WorkflowStepStatus.completed;
      case 'REJECTED':
        return WorkflowStepStatus.rejected;
      case 'SKIPPED':
        return WorkflowStepStatus.skipped;
      default:
        return WorkflowStepStatus.waiting;
    }
  }

  String get label {
    switch (this) {
      case WorkflowStepStatus.waiting:
        return 'Waiting';
      case WorkflowStepStatus.pending:
        return 'Pending';
      case WorkflowStepStatus.inProgress:
        return 'In Progress';
      case WorkflowStepStatus.completed:
        return 'Approved';
      case WorkflowStepStatus.rejected:
        return 'Rejected';
      case WorkflowStepStatus.skipped:
        return 'Skipped';
    }
  }

  Color get color {
    switch (this) {
      case WorkflowStepStatus.waiting:
        return Colors.grey;
      case WorkflowStepStatus.pending:
        return Colors.orange;
      case WorkflowStepStatus.inProgress:
        return Colors.blue;
      case WorkflowStepStatus.completed:
        return Colors.green;
      case WorkflowStepStatus.rejected:
        return Colors.red;
      case WorkflowStepStatus.skipped:
        return Colors.grey;
    }
  }
}

/// A single step in an inspection approval workflow run.
///
/// [isRaiseStep] = true for the synthetic first step that represents the
/// site engineer raising the RFI. This step is excluded when computing
/// "Level X of Y" approval progress display.
class InspectionWorkflowStep extends Equatable {
  final int id;
  final int stepOrder;
  final WorkflowStepStatus status;
  final String? stepLabel;
  final String? stepType; // e.g. 'RAISE_RFI', 'APPROVE'
  final int? assignedUserId;
  final String? assignedUserName;
  final String? signedBy;
  final String? comments;
  final String? completedAt;

  const InspectionWorkflowStep({
    required this.id,
    required this.stepOrder,
    required this.status,
    this.stepLabel,
    this.stepType,
    this.assignedUserId,
    this.assignedUserName,
    this.signedBy,
    this.comments,
    this.completedAt,
  });

  factory InspectionWorkflowStep.fromJson(Map<String, dynamic> json) {
    // Step label and type come from the workflowNode template record.
    final node = json['workflowNode'] as Map<String, dynamic>?;
    return InspectionWorkflowStep(
      id: json['id'] as int,
      stepOrder: json['stepOrder'] as int? ?? 0,
      status:
          WorkflowStepStatus.fromString(json['status'] as String? ?? 'WAITING'),
      stepLabel: node?['label'] as String? ?? node?['name'] as String?,
      stepType: node?['stepType'] as String?,
      assignedUserId: json['assignedUserId'] as int?,
      assignedUserName: json['assignedUserName'] as String?,
      signedBy: json['signedBy'] as String?,
      comments: json['comments'] as String?,
      completedAt: json['completedAt'] as String?,
    );
  }

  /// True when this is the synthetic RFI-raise step — not a real approval level.
  bool get isRaiseStep => stepType == 'RAISE_RFI';

  /// True when this step is currently awaiting action.
  bool get isActive =>
      status == WorkflowStepStatus.pending ||
      status == WorkflowStepStatus.inProgress;

  @override
  List<Object?> get props =>
      [id, stepOrder, status, stepType, assignedUserId, signedBy, comments];
}

/// The running workflow for an inspection (multi-level approval chain).
///
/// [currentStepOrder] tracks which step is currently awaiting action.
/// [steps] is the full ordered list of approval levels.
class InspectionWorkflowRun extends Equatable {
  final int id;
  final int inspectionId;
  final int currentStepOrder;
  final WorkflowRunStatus status;
  final List<InspectionWorkflowStep> steps;

  const InspectionWorkflowRun({
    required this.id,
    required this.inspectionId,
    required this.currentStepOrder,
    required this.status,
    this.steps = const [],
  });

  factory InspectionWorkflowRun.fromJson(Map<String, dynamic> json) {
    return InspectionWorkflowRun(
      id: json['id'] as int,
      inspectionId: json['inspectionId'] as int? ?? 0,
      currentStepOrder: json['currentStepOrder'] as int? ?? 1,
      status: WorkflowRunStatus.fromString(
          json['status'] as String? ?? 'IN_PROGRESS'),
      steps: (json['steps'] as List<dynamic>?)
              ?.map((e) =>
                  InspectionWorkflowStep.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  /// Returns the step currently awaiting action, or null if not found.
  InspectionWorkflowStep? get currentStep =>
      steps.where((s) => s.stepOrder == currentStepOrder).firstOrNull;

  bool get isCompleted => status == WorkflowRunStatus.completed;
  bool get isRejected => status == WorkflowRunStatus.rejected;
  bool get isInProgress => status == WorkflowRunStatus.inProgress;

  @override
  List<Object?> get props =>
      [id, inspectionId, currentStepOrder, status, steps];
}

// ==================== EPS MODELS ====================

/// A node in the EPS location tree used by the quality location picker.
/// Structurally similar to [EpsNode] in the projects feature but scoped
/// to the quality domain and loaded from the quality-specific endpoint.
class EpsTreeNode extends Equatable {
  final int id;
  final String label;
  final String? type;
  final List<EpsTreeNode> children;

  const EpsTreeNode({
    required this.id,
    required this.label,
    this.type,
    this.children = const [],
  });

  factory EpsTreeNode.fromJson(Map<String, dynamic> json) {
    return EpsTreeNode(
      id: json['id'] as int,
      // Accept either 'label' or 'name' depending on the API shape.
      label: json['label'] as String? ?? json['name'] as String? ?? '',
      type: json['type'] as String?,
      children: (json['children'] as List<dynamic>?)
              ?.map((e) => EpsTreeNode.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  /// True when this node has no children (leaf node — a specific location).
  bool get isLeaf => children.isEmpty;

  @override
  List<Object?> get props => [id, label, type];
}

/// Merged view of an activity row in the quality request screen.
///
/// Combines a [QualityActivity], its latest [QualityInspection] (if any),
/// the computed [ActivityDisplayStatus], the predecessor chain state,
/// and any current observations. Used by the activity list widget.
class ActivityRow extends Equatable {
  final QualityActivity activity;
  final QualityInspection? inspection; // latest, used for status display
  final ActivityDisplayStatus displayStatus;
  final bool predecessorDone;
  final List<ActivityObservation> observations;

  /// All inspections for this activity (across all parts / units).
  /// Used to render Multi-Go progress chips and Unit Wise progress chips.
  final List<QualityInspection> allInspections;

  /// Units available under the floor EPS node — populated only for UNIT
  /// activities so the card can display "Raise [unit]" chips for unraised units.
  final List<Map<String, dynamic>> floorUnits;

  const ActivityRow({
    required this.activity,
    this.inspection,
    required this.displayStatus,
    required this.predecessorDone,
    this.observations = const [],
    this.allInspections = const [],
    this.floorUnits = const [],
  });

  @override
  List<Object?> get props =>
      [activity, inspection, displayStatus, predecessorDone, observations,
       allInspections, floorUnits];
}

// ==================== QUALITY SITE OBSERVATION ====================

/// Lifecycle status of a site-level quality observation.
enum SiteObsStatus {
  open,
  rectified,
  closed;

  static SiteObsStatus fromString(String v) {
    switch (v.toUpperCase()) {
      case 'RECTIFIED':
        return SiteObsStatus.rectified;
      case 'CLOSED':
        return SiteObsStatus.closed;
      default:
        return SiteObsStatus.open;
    }
  }

  String get label {
    switch (this) {
      case SiteObsStatus.open:
        return 'Open';
      case SiteObsStatus.rectified:
        return 'Rectified';
      case SiteObsStatus.closed:
        return 'Closed';
    }
  }

  Color get color {
    switch (this) {
      case SiteObsStatus.open:
        return const Color(0xFFDC2626);
      case SiteObsStatus.rectified:
        return const Color(0xFF2563EB);
      case SiteObsStatus.closed:
        return const Color(0xFF16A34A);
    }
  }
}

/// A site-level quality observation — not tied to a specific checklist activity.
///
/// These are raised by QC inspectors for general site defects (e.g. rebar
/// cover issue, concrete finishing defect) that span multiple activities or
/// cannot be attributed to a single checklist item.
/// Photo URLs are resolved to absolute paths at parse time.
class QualitySiteObservation extends Equatable {
  final String id; // UUID from backend
  final int projectId;
  final int? epsNodeId;
  final String description;
  final String severity; // INFO | MINOR | MAJOR | CRITICAL (DB enum)
  final String? category;
  final String? locationLabel;
  final SiteObsStatus status;
  final List<String> photoUrls;
  final String? raisedByName;
  final String? rectificationNotes;
  final List<String> rectificationPhotoUrls;
  final String? closureNotes;
  final DateTime createdAt;
  final DateTime? rectifiedAt;
  final DateTime? closedAt;

  const QualitySiteObservation({
    required this.id,
    required this.projectId,
    this.epsNodeId,
    required this.description,
    required this.severity,
    this.category,
    this.locationLabel,
    required this.status,
    this.photoUrls = const [],
    this.raisedByName,
    this.rectificationNotes,
    this.rectificationPhotoUrls = const [],
    this.closureNotes,
    required this.createdAt,
    this.rectifiedAt,
    this.closedAt,
  });

  factory QualitySiteObservation.fromJson(Map<String, dynamic> json) {
    // Resolve photo paths to absolute URLs.
    // Local file paths (captured offline, stored with file:// scheme) must NOT
    // be passed through resolveUrl — that would corrupt them by prepending the
    // server origin. They are handled as local files by PhotoThumbnailStrip.
    List<String> resolvePhotos(dynamic raw) {
      if (raw == null) return const [];
      return (raw as List<dynamic>).map((e) {
        final url = e.toString();
        if (url.startsWith('file://')) return url;
        return ApiEndpoints.resolveUrl(url);
      }).toList();
    }

    // Parse date from multiple input types (null, DateTime, or ISO string).
    DateTime? parseDate(dynamic raw) {
      if (raw == null || raw == '') return null;
      if (raw is DateTime) return raw;
      return DateTime.tryParse(raw.toString());
    }

    // raisedBy may be a nested user object or a flat name string.
    final raisedBy = json['raisedBy'] as Map<String, dynamic>?;
    return QualitySiteObservation(
      id: json['id'].toString(),
      projectId: json['projectId'] as int? ?? 0,
      epsNodeId: json['epsNodeId'] as int?,
      description: json['description'] as String? ?? '',
      severity: json['severity'] as String? ?? 'MINOR',
      category: json['category'] as String?,
      locationLabel: json['locationLabel'] as String?,
      status: SiteObsStatus.fromString(json['status'] as String? ?? 'OPEN'),
      // Support both 'photoUrls' and legacy 'photos' field names.
      photoUrls: resolvePhotos(json['photoUrls'] ?? json['photos']),
      raisedByName: raisedBy?['name'] as String? ??
          json['raisedByName'] as String?,
      rectificationNotes: json['rectificationNotes'] as String?,
      rectificationPhotoUrls: resolvePhotos(
          json['rectificationPhotoUrls'] ?? json['rectificationPhotos']),
      closureNotes: json['closureNotes'] as String?,
      createdAt: parseDate(json['createdAt']) ?? DateTime.now(),
      rectifiedAt: parseDate(json['rectifiedAt']),
      closedAt: parseDate(json['closedAt']),
    );
  }

  bool get isOpen => status == SiteObsStatus.open;
  bool get isRectified => status == SiteObsStatus.rectified;
  bool get isClosed => status == SiteObsStatus.closed;

  @override
  List<Object?> get props => [
        id, projectId, description, severity, status, createdAt,
      ];
}
