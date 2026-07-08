import 'package:flutter/material.dart';

enum MicroScheduleStatus { draft, submitted, approved, active, suspended, completed, archived }

extension MicroScheduleStatusX on MicroScheduleStatus {
  String get label => switch (this) {
    MicroScheduleStatus.draft => 'Draft',
    MicroScheduleStatus.submitted => 'Submitted',
    MicroScheduleStatus.approved => 'Approved',
    MicroScheduleStatus.active => 'Active',
    MicroScheduleStatus.suspended => 'Suspended',
    MicroScheduleStatus.completed => 'Completed',
    MicroScheduleStatus.archived => 'Archived',
  };
  Color get color => switch (this) {
    MicroScheduleStatus.draft => Colors.grey.shade600,
    MicroScheduleStatus.submitted => Colors.orange.shade700,
    MicroScheduleStatus.approved => Colors.blue.shade700,
    MicroScheduleStatus.active => Colors.green.shade700,
    MicroScheduleStatus.suspended => Colors.red.shade700,
    MicroScheduleStatus.completed => Colors.teal.shade700,
    MicroScheduleStatus.archived => Colors.grey.shade500,
  };
  static MicroScheduleStatus fromApi(String v) => switch (v.toUpperCase()) {
    'SUBMITTED' => MicroScheduleStatus.submitted,
    'APPROVED' => MicroScheduleStatus.approved,
    'ACTIVE' => MicroScheduleStatus.active,
    'SUSPENDED' => MicroScheduleStatus.suspended,
    'COMPLETED' => MicroScheduleStatus.completed,
    'ARCHIVED' => MicroScheduleStatus.archived,
    _ => MicroScheduleStatus.draft,
  };
}

class MicroSchedule {
  final int id;
  final int projectId;
  final int parentActivityId;
  final String name;
  final MicroScheduleStatus status;
  final String? plannedStart;
  final String? plannedFinish;
  final String? actualStart;
  final String? forecastFinish;
  final double totalAllocatedQty;
  final double totalActualQty;
  final String? unit;

  const MicroSchedule({
    required this.id, required this.projectId, required this.parentActivityId,
    required this.name, required this.status,
    this.plannedStart, this.plannedFinish, this.actualStart, this.forecastFinish,
    this.totalAllocatedQty = 0, this.totalActualQty = 0, this.unit,
  });

  double get progress => totalAllocatedQty > 0
      ? (totalActualQty / totalAllocatedQty).clamp(0.0, 1.0)
      : 0.0;

  factory MicroSchedule.fromJson(Map<String, dynamic> j) => MicroSchedule(
    id: j['id'] as int,
    projectId: j['projectId'] as int? ?? 0,
    parentActivityId: j['parentActivityId'] as int? ?? 0,
    name: j['name'] as String? ?? '',
    status: MicroScheduleStatusX.fromApi(j['status'] as String? ?? 'DRAFT'),
    plannedStart: j['plannedStart'] as String?,
    plannedFinish: j['plannedFinish'] as String?,
    actualStart: j['actualStart'] as String?,
    forecastFinish: j['forecastFinish'] as String?,
    totalAllocatedQty: ((j['totalAllocatedQty'] ?? 0) as num).toDouble(),
    totalActualQty: ((j['totalActualQty'] ?? 0) as num).toDouble(),
    unit: j['unit'] as String?,
  );
}

class MicroActivity {
  final int id;
  final int microScheduleId;
  final String name;
  final String? description;
  final double allocatedQty;
  final double actualQty;
  final String? unit;
  final String? plannedStart;
  final String? plannedFinish;

  const MicroActivity({
    required this.id, required this.microScheduleId, required this.name,
    this.description, this.allocatedQty = 0, this.actualQty = 0,
    this.unit, this.plannedStart, this.plannedFinish,
  });

  double get progress => allocatedQty > 0
      ? (actualQty / allocatedQty).clamp(0.0, 1.0)
      : 0.0;

  factory MicroActivity.fromJson(Map<String, dynamic> j) => MicroActivity(
    id: j['id'] as int,
    microScheduleId: j['microScheduleId'] as int? ?? 0,
    name: j['name'] as String? ?? '',
    description: j['description'] as String?,
    allocatedQty: ((j['allocatedQty'] ?? 0) as num).toDouble(),
    actualQty: ((j['actualQty'] ?? 0) as num).toDouble(),
    unit: j['unit'] as String?,
    plannedStart: j['plannedStart'] as String?,
    plannedFinish: j['plannedFinish'] as String?,
  );
}

class MicroDailyLog {
  final int id;
  final int microActivityId;
  final String logDate;
  final double qtyDone;
  final int? manpowerCount;
  final double? equipmentHours;
  final String? delayReason;
  final String? remarks;

  const MicroDailyLog({
    required this.id, required this.microActivityId, required this.logDate,
    required this.qtyDone, this.manpowerCount, this.equipmentHours,
    this.delayReason, this.remarks,
  });

  factory MicroDailyLog.fromJson(Map<String, dynamic> j) => MicroDailyLog(
    id: j['id'] as int,
    microActivityId: j['microActivityId'] as int? ?? 0,
    logDate: j['logDate'] as String? ?? '',
    qtyDone: ((j['qtyDone'] ?? 0) as num).toDouble(),
    manpowerCount: j['manpowerCount'] as int?,
    equipmentHours: (j['equipmentHours'] as num?)?.toDouble(),
    delayReason: (j['delayReason'] as Map?)?['name'] as String? ?? j['delayReasonId'] as String?,
    remarks: j['remarks'] as String?,
  );
}
