import 'package:equatable/equatable.dart';

/// A locally-stored progress entry (offline-first record).
///
/// This is distinct from [ProgressLog] which represents a server-side record
/// fetched for the supervisor approval queue. [ProgressEntry] lives in the
/// local Drift DB until it is synced to the server, at which point [serverId]
/// is populated.
class ProgressEntry extends Equatable {
  /// Local Drift row ID — null before the first insert.
  final int? id;

  /// Server-assigned ID after a successful sync — null while pending.
  final int? serverId;

  final int projectId;
  final int activityId;
  final int epsNodeId;
  final int boqItemId;

  /// Optional micro-activity if the activity uses a micro-schedule breakdown.
  final int? microActivityId;

  final double quantity;
  final DateTime date;
  final String? remarks;

  /// Local file paths for photos taken at the time of entry.
  final List<String>? photoPaths;

  /// Sync lifecycle status — drives UI badge (Pending / Synced / Failed).
  final SyncStatus syncStatus;
  final DateTime createdAt;

  /// Populated when the entry has been successfully uploaded to the server.
  final DateTime? syncedAt;

  const ProgressEntry({
    this.id,
    this.serverId,
    required this.projectId,
    required this.activityId,
    required this.epsNodeId,
    required this.boqItemId,
    this.microActivityId,
    required this.quantity,
    required this.date,
    this.remarks,
    this.photoPaths,
    this.syncStatus = SyncStatus.pending,
    required this.createdAt,
    this.syncedAt,
  });

  /// Parses a progress entry from JSON.
  /// Handles both camelCase and snake_case field names for backend compatibility.
  factory ProgressEntry.fromJson(Map<String, dynamic> json) {
    return ProgressEntry(
      id: json['id'] as int?,
      serverId: json['serverId'] as int? ?? json['server_id'] as int?,
      projectId: json['projectId'] as int? ?? json['project_id'] as int? ?? 0,
      activityId: json['activityId'] as int? ?? json['activity_id'] as int? ?? 0,
      epsNodeId: json['epsNodeId'] as int? ?? json['eps_node_id'] as int? ?? 0,
      boqItemId: json['boqItemId'] as int? ?? json['boq_item_id'] as int? ?? 0,
      microActivityId: json['microActivityId'] as int? ?? json['micro_activity_id'] as int?,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      date: json['date'] != null ? DateTime.parse(json['date']) : DateTime.now(),
      remarks: json['remarks'] as String?,
      photoPaths: (json['photoPaths'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      // Defaults to pending if the value is missing (e.g. freshly created entry).
      syncStatus: SyncStatus.fromValue(json['syncStatus'] as int? ?? json['sync_status'] as int? ?? 0),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      syncedAt: json['syncedAt'] != null
          ? DateTime.parse(json['syncedAt'])
          : null,
    );
  }

  /// Serialises to JSON for local caching.
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'serverId': serverId,
      'projectId': projectId,
      'activityId': activityId,
      'epsNodeId': epsNodeId,
      'boqItemId': boqItemId,
      'microActivityId': microActivityId,
      'quantity': quantity,
      'date': date.toIso8601String(),
      'remarks': remarks,
      'photoPaths': photoPaths,
      'syncStatus': syncStatus.value,
      'createdAt': createdAt.toIso8601String(),
      'syncedAt': syncedAt?.toIso8601String(),
    };
  }

  /// Minimal payload sent to the server when syncing.
  /// Only the fields the backend needs — IDs are already known from context.
  Map<String, dynamic> toApiPayload() {
    return {
      'boqItemId': boqItemId,
      'microActivityId': microActivityId,
      'quantity': quantity,
    };
  }

  ProgressEntry copyWith({
    int? id,
    int? serverId,
    int? projectId,
    int? activityId,
    int? epsNodeId,
    int? boqItemId,
    int? microActivityId,
    double? quantity,
    DateTime? date,
    String? remarks,
    List<String>? photoPaths,
    SyncStatus? syncStatus,
    DateTime? createdAt,
    DateTime? syncedAt,
  }) {
    return ProgressEntry(
      id: id ?? this.id,
      serverId: serverId ?? this.serverId,
      projectId: projectId ?? this.projectId,
      activityId: activityId ?? this.activityId,
      epsNodeId: epsNodeId ?? this.epsNodeId,
      boqItemId: boqItemId ?? this.boqItemId,
      microActivityId: microActivityId ?? this.microActivityId,
      quantity: quantity ?? this.quantity,
      date: date ?? this.date,
      remarks: remarks ?? this.remarks,
      photoPaths: photoPaths ?? this.photoPaths,
      syncStatus: syncStatus ?? this.syncStatus,
      createdAt: createdAt ?? this.createdAt,
      syncedAt: syncedAt ?? this.syncedAt,
    );
  }

  @override
  List<Object?> get props => [
        id,
        serverId,
        projectId,
        activityId,
        epsNodeId,
        boqItemId,
        microActivityId,
        quantity,
        date,
        remarks,
        photoPaths,
        syncStatus,
        createdAt,
        syncedAt,
      ];
}

/// Sync lifecycle for a locally-stored progress entry.
///
/// pending → the entry has not yet been sent to the server
/// synced  → the server accepted the entry and returned a server ID
/// failed  → the sync attempt was rejected (e.g. validation error) — will not retry
enum SyncStatus {
  pending(0),
  synced(1),
  failed(2);

  final int value;
  const SyncStatus(this.value);

  /// Parse from integer stored in the Drift column.
  /// Defaults to [pending] for unknown values to avoid silent data loss.
  static SyncStatus fromValue(int value) {
    return SyncStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => SyncStatus.pending,
    );
  }
}

/// A BOQ (Bill of Quantities) line item that progress can be logged against.
class BoqItem extends Equatable {
  final int id;
  final String name;
  final String? description;
  final String? unit;

  /// Total contracted quantity for this item.
  final double quantity;
  final double? rate;

  /// Quantity already executed and approved.
  final double? executedQuantity;

  /// Remaining quantity = contracted − executed.
  final double? balanceQuantity;

  const BoqItem({
    required this.id,
    required this.name,
    this.description,
    this.unit,
    required this.quantity,
    this.rate,
    this.executedQuantity,
    this.balanceQuantity,
  });

  /// Parses from the /activities/:id/boq-items API response.
  /// Accepts both camelCase and snake_case for backward compatibility.
  factory BoqItem.fromJson(Map<String, dynamic> json) {
    return BoqItem(
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      unit: json['unit'] as String?,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      rate: (json['rate'] as num?)?.toDouble(),
      executedQuantity: (json['executedQuantity'] as num?)?.toDouble() ??
          (json['executed_quantity'] as num?)?.toDouble(),
      balanceQuantity: (json['balanceQuantity'] as num?)?.toDouble() ??
          (json['balance_quantity'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'unit': unit,
      'quantity': quantity,
      'rate': rate,
      'executedQuantity': executedQuantity,
      'balanceQuantity': balanceQuantity,
    };
  }

  /// How much quantity is left to execute.
  /// Uses server-computed [balanceQuantity] when available; falls back to
  /// calculating it locally so offline entries render correctly.
  double get remainingQuantity => balanceQuantity ?? (quantity - (executedQuantity ?? 0));

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        unit,
        quantity,
        rate,
        executedQuantity,
        balanceQuantity,
      ];
}

/// A micro-activity within a micro-schedule breakdown.
///
/// When a construction activity is broken down into daily targets (micro-schedule),
/// progress is logged at this level rather than against the top-level BOQ item.
/// Added vendor/work-order context in March 2026 for the WO integration sprint.
class MicroActivity extends Equatable {
  final int id;
  final String name;
  final int microScheduleId;
  final double plannedQuantity;
  final double? executedQuantity;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? status;

  /// The BOQ item this micro-activity rolls up into.
  final int? boqItemId;

  // Work Order & Vendor context (added Mar 2026 — WO integration)
  final int? workOrderItemId;
  final int? vendorId;

  const MicroActivity({
    required this.id,
    required this.name,
    required this.microScheduleId,
    required this.plannedQuantity,
    this.executedQuantity,
    this.startDate,
    this.endDate,
    this.status,
    this.boqItemId,
    this.workOrderItemId,
    this.vendorId,
  });

  /// Parses from the /activities/:id/execution-breakdown API response.
  factory MicroActivity.fromJson(Map<String, dynamic> json) {
    return MicroActivity(
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      microScheduleId: json['microScheduleId'] as int? ?? json['micro_schedule_id'] as int? ?? 0,
      plannedQuantity: (json['plannedQuantity'] as num?)?.toDouble() ??
          (json['planned_quantity'] as num?)?.toDouble() ?? 0,
      executedQuantity: (json['executedQuantity'] as num?)?.toDouble() ??
          (json['executed_quantity'] as num?)?.toDouble(),
      startDate: json['startDate'] != null
          ? DateTime.tryParse(json['startDate'] as String)
          : null,
      endDate: json['endDate'] != null
          ? DateTime.tryParse(json['endDate'] as String)
          : null,
      status: json['status'] as String?,
      boqItemId: json['boqItemId'] as int? ?? json['boq_item_id'] as int?,
      workOrderItemId: json['workOrderItemId'] as int? ?? json['work_order_item_id'] as int?,
      vendorId: json['vendorId'] as int? ?? json['vendor_id'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'microScheduleId': microScheduleId,
      'plannedQuantity': plannedQuantity,
      'executedQuantity': executedQuantity,
      'startDate': startDate?.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'status': status,
      'boqItemId': boqItemId,
      'workOrderItemId': workOrderItemId,
      'vendorId': vendorId,
    };
  }

  /// Fraction of planned quantity completed (0.0–1.0), clamped to valid range.
  double get progress => plannedQuantity > 0
      ? ((executedQuantity ?? 0) / plannedQuantity).clamp(0.0, 1.0)
      : 0;

  /// How much planned quantity remains to be executed.
  double get remainingQuantity => plannedQuantity - (executedQuantity ?? 0);

  /// True when this micro-activity is linked to a work order item.
  bool get hasWorkOrder => workOrderItemId != null;

  @override
  List<Object?> get props => [
        id,
        name,
        microScheduleId,
        plannedQuantity,
        executedQuantity,
        startDate,
        endDate,
        status,
        boqItemId,
        workOrderItemId,
        vendorId,
      ];
}

// ==================== PROGRESS APPROVAL MODELS ====================

/// Server-side approval status for a synced progress log entry.
/// Distinct from [SyncStatus] which tracks the local-to-server sync lifecycle.
enum ProgressApprovalStatus {
  pending,
  approved,
  rejected;

  /// Parse from the backend string value — defaults to [pending].
  static ProgressApprovalStatus fromString(String v) {
    switch (v.toUpperCase()) {
      case 'APPROVED':
        return ProgressApprovalStatus.approved;
      case 'REJECTED':
        return ProgressApprovalStatus.rejected;
      default:
        return ProgressApprovalStatus.pending;
    }
  }

  /// Human-readable label for display in the approval queue UI.
  String get label {
    switch (this) {
      case ProgressApprovalStatus.pending:
        return 'Awaiting Approval';
      case ProgressApprovalStatus.approved:
        return 'Approved';
      case ProgressApprovalStatus.rejected:
        return 'Rejected';
    }
  }
}

/// A server-side progress log entry used in the supervisor approval queue.
///
/// Distinct from [ProgressEntry] which is the local offline-first record.
/// [ProgressLog] is always fetched from the server — it is never stored locally.
/// It carries joined display fields (activity name, BOQ item name, etc.) that
/// are flattened from the server response for easy rendering.
class ProgressLog extends Equatable {
  final int id;
  final int projectId;
  final int activityId;
  final int epsNodeId;
  final int boqItemId;
  final int? microActivityId;
  final double quantity;
  final String unit;
  final DateTime date;
  final String? remarks;
  final List<String> photoPaths;
  final ProgressApprovalStatus approvalStatus;
  final String? rejectionReason;
  final String? submittedByName;
  final DateTime createdAt;

  // Joined display fields — flattened from the server relation payload
  final String? activityName;
  final String? epsNodeLabel;
  final String? boqItemName;

  const ProgressLog({
    required this.id,
    required this.projectId,
    required this.activityId,
    required this.epsNodeId,
    required this.boqItemId,
    this.microActivityId,
    required this.quantity,
    this.unit = '',
    required this.date,
    this.remarks,
    this.photoPaths = const [],
    this.approvalStatus = ProgressApprovalStatus.pending,
    this.rejectionReason,
    this.submittedByName,
    required this.createdAt,
    this.activityName,
    this.epsNodeLabel,
    this.boqItemName,
  });

  /// Parses a progress log from the /planning/pending-approvals API response.
  ///
  /// The server response includes nested objects (`activity`, `epsNode`, `boqItem`,
  /// `submittedByUser`) — we flatten relevant display fields here so the UI
  /// never has to deal with nested JSON at render time.
  factory ProgressLog.fromJson(Map<String, dynamic> json) {
    final activity = json['activity'] as Map<String, dynamic>?;
    final epsNode = json['epsNode'] as Map<String, dynamic>?;
    final boqItem = json['boqItem'] as Map<String, dynamic>?;
    final submitter = json['submittedByUser'] as Map<String, dynamic>?;

    return ProgressLog(
      id: json['id'] as int,
      projectId: json['projectId'] as int? ?? 0,
      activityId: json['activityId'] as int? ?? 0,
      epsNodeId: json['epsNodeId'] as int? ?? 0,
      boqItemId: json['boqItemId'] as int? ?? 0,
      microActivityId: json['microActivityId'] as int?,
      // Support both 'quantity' and 'quantityExecuted' field names from the API.
      quantity: (json['quantity'] as num?)?.toDouble() ??
          (json['quantityExecuted'] as num?)?.toDouble() ?? 0,
      // Unit may come from the boqItem relation if not on the root object.
      unit: json['unit'] as String? ?? boqItem?['unit'] as String? ?? '',
      date: json['date'] != null
          ? DateTime.tryParse(json['date'] as String) ?? DateTime.now()
          : DateTime.now(),
      remarks: json['remarks'] as String?,
      photoPaths: (json['photos'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      // Backend may send 'approvalStatus' or the simpler 'status' key.
      approvalStatus: ProgressApprovalStatus.fromString(
          json['approvalStatus'] as String? ??
          json['status'] as String? ?? 'PENDING'),
      rejectionReason: json['rejectionReason'] as String?,
      // Check both the root field and the nested submitter object.
      submittedByName: json['submittedByName'] as String? ??
          submitter?['name'] as String? ??
          submitter?['fullName'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      // Flatten nested display names for easy rendering
      activityName: activity?['name'] as String? ?? activity?['activityName'] as String?,
      epsNodeLabel: epsNode?['label'] as String? ?? epsNode?['name'] as String?,
      boqItemName: boqItem?['name'] as String? ?? boqItem?['description'] as String?,
    );
  }

  bool get isPending => approvalStatus == ProgressApprovalStatus.pending;
  bool get isApproved => approvalStatus == ProgressApprovalStatus.approved;
  bool get isRejected => approvalStatus == ProgressApprovalStatus.rejected;

  @override
  List<Object?> get props => [
        id,
        projectId,
        activityId,
        quantity,
        date,
        approvalStatus,
        rejectionReason,
      ];
}

/// Aggregates the execution breakdown for an activity — either a micro-schedule
/// (daily targets) or a flat list of remaining BOQ balance items.
///
/// The UI switches between two entry modes based on [hasMicroSchedule]:
///   - true  → show micro-activity rows with planned/executed quantities
///   - false → show balance BOQ items with a free-entry quantity field
class ExecutionBreakdown extends Equatable {
  final List<MicroActivity> microActivities;
  final List<BoqItem> balanceItems;
  final bool hasMicroSchedule;

  const ExecutionBreakdown({
    this.microActivities = const [],
    this.balanceItems = const [],
    this.hasMicroSchedule = false,
  });

  factory ExecutionBreakdown.fromJson(Map<String, dynamic> json) {
    return ExecutionBreakdown(
      microActivities: (json['microActivities'] as List<dynamic>?)
              ?.map((e) => MicroActivity.fromJson(e))
              .toList() ??
          [],
      balanceItems: (json['balanceItems'] as List<dynamic>?)
              ?.map((e) => BoqItem.fromJson(e))
              .toList() ??
          [],
      hasMicroSchedule: json['hasMicroSchedule'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [microActivities, balanceItems, hasMicroSchedule];
}
