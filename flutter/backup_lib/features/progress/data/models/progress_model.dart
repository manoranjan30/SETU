import 'package:equatable/equatable.dart';

/// Progress entry model for saving progress data
class ProgressEntry extends Equatable {
  final int? id;
  final int? serverId;
  final int projectId;
  final int activityId;
  final int epsNodeId;
  final int boqItemId;
  final int? microActivityId;
  final double quantity;
  final DateTime date;
  final String? remarks;
  final List<String>? photoPaths;
  final SyncStatus syncStatus;
  final DateTime createdAt;
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
      syncStatus: SyncStatus.fromValue(json['syncStatus'] as int? ?? json['sync_status'] as int? ?? 0),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      syncedAt: json['syncedAt'] != null
          ? DateTime.parse(json['syncedAt'])
          : null,
    );
  }

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

  /// Convert to API payload for saving
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

/// Sync status enum
enum SyncStatus {
  pending(0),
  synced(1),
  failed(2);

  final int value;
  const SyncStatus(this.value);

  static SyncStatus fromValue(int value) {
    return SyncStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => SyncStatus.pending,
    );
  }
}

/// BOQ Item model for progress entry
class BoqItem extends Equatable {
  final int id;
  final String name;
  final String? description;
  final String? unit;
  final double quantity;
  final double? rate;
  final double? executedQuantity;
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

/// Micro Activity model for micro-schedule progress
class MicroActivity extends Equatable {
  final int id;
  final String name;
  final int microScheduleId;
  final double plannedQuantity;
  final double? executedQuantity;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? status;
  final int? boqItemId;

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
  });

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
          ? DateTime.tryParse(json['startDate'])
          : null,
      endDate: json['endDate'] != null
          ? DateTime.tryParse(json['endDate'])
          : null,
      status: json['status'] as String?,
      boqItemId: json['boqItemId'] as int? ?? json['boq_item_id'] as int?,
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
    };
  }

  double get progress => plannedQuantity > 0
      ? ((executedQuantity ?? 0) / plannedQuantity).clamp(0.0, 1.0)
      : 0;

  double get remainingQuantity => plannedQuantity - (executedQuantity ?? 0);

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
      ];
}

/// Execution breakdown model
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
