import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';

// ==================== ENUMS ====================

enum ActivityDisplayStatus {
  locked,
  ready,
  pending,
  approved,
  rejected,
  provisionallyApproved,
  pendingObservation,
}

extension ActivityDisplayStatusX on ActivityDisplayStatus {
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

enum InspectionStatus {
  pending,
  partiallyApproved,
  approved,
  provisionallyApproved,
  rejected,
  canceled,
  reversed;

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

  Color get backgroundColor {
    return color.withValues(alpha: 0.1);
  }
}

enum ObservationStatus {
  pending,
  rectified,
  closed;

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
        return 'Rectified';
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

/// Status for a single checklist item. null = not yet evaluated.
enum ChecklistItemStatus {
  pass,
  na;

  /// Parse from JSON — supports new `status` string field and old `isOk` bool.
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
    // Backward compat: old backend sends `isOk: true/false`
    final isOk = json['isOk'] as bool?;
    return isOk == true ? ChecklistItemStatus.pass : null;
  }

  String get apiValue {
    switch (this) {
      case ChecklistItemStatus.pass:
        return 'PASS';
      case ChecklistItemStatus.na:
        return 'NA';
    }
  }

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

/// Quality activity list (a named checklist template assigned to an EPS node)
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
      activityCount: (json['activityCount'] as int?) ??
          (json['activities'] as List?)?.length ??
          0,
    );
  }

  @override
  List<Object?> get props => [id, name, description, projectId, epsNodeId, activityCount];
}

/// A single quality activity within a list
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
    );
  }

  /// Compute display status based on activity status string and inspection
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
    return ActivityDisplayStatus.locked;
  }

  bool canRaiseRfi(bool predecessorDone) =>
      (status == 'NOT_STARTED') && (predecessorDone || allowBreak);

  bool get needsObservationFix => status == 'PENDING_OBSERVATION';

  @override
  List<Object?> get props => [id, listId, sequence, activityName, status];
}

/// Incoming edge for predecessor tracking
class IncomingEdge extends Equatable {
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

/// Inspection record (RFI)
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
  final List<InspectionStage> stages;

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
    this.stages = const [],
  });

  factory QualityInspection.fromJson(Map<String, dynamic> json) {
    final activity = json['activity'] as Map<String, dynamic>?;
    final epsNode = json['epsNode'] as Map<String, dynamic>?;
    return QualityInspection(
      id: json['id'] as int,
      activityId: json['activityId'] as int? ?? 0,
      epsNodeId: json['epsNodeId'] as int?,
      listId: json['listId'] as int?,
      projectId: json['projectId'] as int?,
      status: InspectionStatus.fromString(json['status'] as String? ?? 'PENDING'),
      requestDate: json['requestDate'] as String? ?? '',
      inspectionDate: json['inspectionDate'] as String?,
      comments: json['comments'] as String?,
      inspectedBy: json['inspectedBy'] as String?,
      activityName: activity?['activityName'] as String?,
      epsNodeLabel: epsNode?['label'] as String? ?? epsNode?['name'] as String?,
      stages: (json['stages'] as List<dynamic>?)
              ?.map((e) => InspectionStage.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  bool get isPending => status == InspectionStatus.pending;

  @override
  List<Object?> get props => [id, activityId, status, requestDate, stages];
}

/// A checklist stage within an inspection
class InspectionStage extends Equatable {
  final int id;
  final String? stageName;
  final String status;
  final List<ChecklistItem> items;

  const InspectionStage({
    required this.id,
    this.stageName,
    required this.status,
    this.items = const [],
  });

  factory InspectionStage.fromJson(Map<String, dynamic> json) {
    final template = json['stageTemplate'] as Map<String, dynamic>?;
    return InspectionStage(
      id: json['id'] as int,
      stageName: template?['name'] as String? ?? 'General Checks',
      status: json['status'] as String? ?? 'PENDING',
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => ChecklistItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  /// Items marked PASS.
  int get completedCount => items.where((i) => i.isOk).length;
  /// Items marked PASS or N/A (i.e. evaluated).
  int get resolvedCount => items.where((i) => i.itemStatus != null).length;
  int get totalCount => items.length;
  /// True when every item has been evaluated (PASS or N/A).
  bool get allOk => items.isNotEmpty && items.every((i) => i.itemStatus != null);

  InspectionStage copyWithItems(List<ChecklistItem> newItems) {
    return InspectionStage(
      id: id,
      stageName: stageName,
      status: status,
      items: newItems,
    );
  }

  @override
  List<Object?> get props => [id, stageName, status, items];
}

/// A single checklist item within a stage
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

  /// True when marked as PASS or N/A — both satisfy checklist requirements.
  bool get isOk =>
      itemStatus == ChecklistItemStatus.pass ||
      itemStatus == ChecklistItemStatus.na;

  factory ChecklistItem.fromJson(Map<String, dynamic> json) {
    final template = json['itemTemplate'] as Map<String, dynamic>?;
    return ChecklistItem(
      id: json['id'] as int,
      itemText: template?['itemText'] as String? ?? 'Checklist Item',
      sequence: template?['sequence'] as int? ?? 0,
      itemStatus: ChecklistItemStatus.fromJson(json),
      remarks: json['remarks'] as String?,
      value: json['value'] as String?,
    );
  }

  /// Copy with updated remarks only.
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

  /// Copy with a new status (pass / na / null to clear).
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

  Map<String, dynamic> toApiPayload() => {
        'id': id,
        'isOk': isOk, // backward compat with older backend versions
        if (itemStatus != null) 'status': itemStatus!.apiValue,
        'remarks': remarks,
        if (value != null) 'value': value,
      };

  @override
  List<Object?> get props => [id, itemStatus, remarks, value];
}

/// An observation (defect) logged by QC Inspector
class ActivityObservation extends Equatable {
  final String id; // UUID
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
      photos: (json['photos'] as List<dynamic>?)
              ?.map((e) => ApiEndpoints.resolveUrl(e.toString()))
              .toList() ??
          [],
      closureText: json['closureText'] as String?,
      closureEvidence: (json['closureEvidence'] as List<dynamic>?)
              ?.map((e) => ApiEndpoints.resolveUrl(e.toString()))
              .toList() ??
          [],
      status: ObservationStatus.fromString(
          json['status'] as String? ?? 'PENDING'),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  bool get isPending => status == ObservationStatus.pending;
  bool get isRectified => status == ObservationStatus.rectified;

  @override
  List<Object?> get props =>
      [id, activityId, observationText, status, closureText];
}

// ==================== WORKFLOW MODELS ====================

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

/// A single step in an inspection approval workflow run
class InspectionWorkflowStep extends Equatable {
  final int id;
  final int stepOrder;
  final WorkflowStepStatus status;
  final String? stepLabel;
  final String? assignedUserName;
  final String? signedBy;
  final String? comments;
  final String? completedAt;

  const InspectionWorkflowStep({
    required this.id,
    required this.stepOrder,
    required this.status,
    this.stepLabel,
    this.assignedUserName,
    this.signedBy,
    this.comments,
    this.completedAt,
  });

  factory InspectionWorkflowStep.fromJson(Map<String, dynamic> json) {
    final node = json['workflowNode'] as Map<String, dynamic>?;
    return InspectionWorkflowStep(
      id: json['id'] as int,
      stepOrder: json['stepOrder'] as int? ?? 0,
      status: WorkflowStepStatus.fromString(
          json['status'] as String? ?? 'WAITING'),
      stepLabel: node?['label'] as String? ?? node?['name'] as String?,
      assignedUserName: json['assignedUserName'] as String?,
      signedBy: json['signedBy'] as String?,
      comments: json['comments'] as String?,
      completedAt: json['completedAt'] as String?,
    );
  }

  bool get isActive =>
      status == WorkflowStepStatus.pending ||
      status == WorkflowStepStatus.inProgress;

  @override
  List<Object?> get props =>
      [id, stepOrder, status, signedBy, comments];
}

/// The running workflow for an inspection (multi-level approval)
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
              ?.map((e) => InspectionWorkflowStep.fromJson(
                  e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

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

/// EPS tree node (for location selection)
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
      label: json['label'] as String? ?? json['name'] as String? ?? '',
      type: json['type'] as String?,
      children: (json['children'] as List<dynamic>?)
              ?.map((e) => EpsTreeNode.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  bool get isLeaf => children.isEmpty;

  @override
  List<Object?> get props => [id, label, type];
}

/// Combined activity row used in the Request screen (activity + inspection + observations)
class ActivityRow extends Equatable {
  final QualityActivity activity;
  final QualityInspection? inspection;
  final ActivityDisplayStatus displayStatus;
  final bool predecessorDone;
  final List<ActivityObservation> observations;

  const ActivityRow({
    required this.activity,
    this.inspection,
    required this.displayStatus,
    required this.predecessorDone,
    this.observations = const [],
  });

  @override
  List<Object?> get props =>
      [activity, inspection, displayStatus, predecessorDone, observations];
}
