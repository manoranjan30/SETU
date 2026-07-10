import 'package:flutter/material.dart';

// ── Issue Tracker ─────────────────────────────────────────────────────────────

enum IssueStatus { open, inProgress, completed, closed }
enum IssuePriority { low, medium, high, critical }

extension IssueStatusX on IssueStatus {
  String get apiValue => name.toUpperCase().replaceAll('_', '');
  String get label => switch (this) {
    IssueStatus.open => 'Open',
    IssueStatus.inProgress => 'In Progress',
    IssueStatus.completed => 'Completed',
    IssueStatus.closed => 'Closed',
  };
  Color get color => switch (this) {
    IssueStatus.open => Colors.orange.shade700,
    IssueStatus.inProgress => Colors.blue.shade700,
    IssueStatus.completed => Colors.teal.shade700,
    IssueStatus.closed => Colors.green.shade700,
  };
  static IssueStatus fromApi(String v) => switch (v.toUpperCase()) {
    'IN_PROGRESS' => IssueStatus.inProgress,
    'COMPLETED' => IssueStatus.completed,
    'CLOSED' => IssueStatus.closed,
    _ => IssueStatus.open,
  };
}

extension IssuePriorityX on IssuePriority {
  String get apiValue => name.toUpperCase();
  String get label => switch (this) {
    IssuePriority.low => 'Low',
    IssuePriority.medium => 'Medium',
    IssuePriority.high => 'High',
    IssuePriority.critical => 'Critical',
  };
  Color get color => switch (this) {
    IssuePriority.low => Colors.grey.shade600,
    IssuePriority.medium => Colors.orange.shade600,
    IssuePriority.high => Colors.red.shade600,
    IssuePriority.critical => Colors.red.shade900,
  };
  IconData get icon => switch (this) {
    IssuePriority.critical => Icons.warning_rounded,
    IssuePriority.high => Icons.arrow_upward,
    IssuePriority.medium => Icons.remove,
    IssuePriority.low => Icons.arrow_downward,
  };
  static IssuePriority fromApi(String v) => switch (v.toUpperCase()) {
    'CRITICAL' => IssuePriority.critical,
    'HIGH' => IssuePriority.high,
    'MEDIUM' => IssuePriority.medium,
    _ => IssuePriority.low,
  };
}

class IssueTrackerDepartment {
  final String id;
  final String name;
  const IssueTrackerDepartment({required this.id, required this.name});
  factory IssueTrackerDepartment.fromJson(Map<String, dynamic> j) =>
      IssueTrackerDepartment(id: j['id'].toString(), name: j['name'] as String? ?? '');
}

class IssueTag {
  final int id;
  final String name;
  const IssueTag({required this.id, required this.name});
  factory IssueTag.fromJson(Map<String, dynamic> j) =>
      IssueTag(id: j['id'] as int, name: j['name'] as String? ?? '');
}

class IssueFlowStep {
  final String id;
  final String departmentId;
  final String? departmentName;
  final int stepIndex;
  final String status;
  final String? responseText;
  final String? respondedAt;
  const IssueFlowStep({
    required this.id, required this.departmentId, this.departmentName,
    required this.stepIndex, required this.status, this.responseText, this.respondedAt,
  });
  factory IssueFlowStep.fromJson(Map<String, dynamic> j) => IssueFlowStep(
    id: j['id'].toString(),
    departmentId: j['departmentId']?.toString() ?? '',
    departmentName: j['department']?['name'] as String? ?? j['departmentName'] as String?,
    stepIndex: j['stepIndex'] as int? ?? 0,
    status: j['status'] as String? ?? 'PENDING',
    responseText: j['responseText'] as String?,
    respondedAt: j['respondedAt'] as String?,
  );
}

class IssueTrackerIssue {
  final int id;
  final int projectId;
  final String issueNumber;
  final String title;
  final String? description;
  final IssueStatus status;
  final IssuePriority priority;
  final String? raisedByName;
  final String raisedDate;
  final String? requiredDate;
  final String? committedDate;
  final String? closedDate;
  final String? currentDepartmentName;
  final List<IssueFlowStep> flowSteps;
  final List<String> tagNames;
  // Permission flags from backend (current user's allowed actions)
  final bool canRespond;
  final bool canCoordinatorClose;
  final bool canClose;

  const IssueTrackerIssue({
    required this.id, required this.projectId, required this.issueNumber,
    required this.title, this.description, required this.status,
    required this.priority, this.raisedByName, required this.raisedDate,
    this.requiredDate, this.committedDate, this.closedDate,
    this.currentDepartmentName,
    this.flowSteps = const [], this.tagNames = const [],
    this.canRespond = false, this.canCoordinatorClose = false, this.canClose = false,
  });

  bool get isOpen => status == IssueStatus.open || status == IssueStatus.inProgress;

  factory IssueTrackerIssue.fromJson(Map<String, dynamic> j) {
    final flow = (j['flowSteps'] as List<dynamic>? ?? [])
        .map((e) => IssueFlowStep.fromJson(e as Map<String, dynamic>))
        .toList();
    final tags = (j['tags'] as List<dynamic>? ?? [])
        .map((e) => (e is Map ? e['name'] : e)?.toString() ?? '')
        .where((s) => s.isNotEmpty)
        .toList();
    final raisedBy = j['raisedBy'] as Map<String, dynamic>?;
    return IssueTrackerIssue(
      id: j['id'] as int,
      projectId: j['projectId'] as int? ?? 0,
      issueNumber: j['issueNumber'] as String? ?? '#${j['id']}',
      title: j['title'] as String? ?? '',
      description: j['description'] as String?,
      status: IssueStatusX.fromApi(j['status'] as String? ?? 'OPEN'),
      priority: IssuePriorityX.fromApi(j['priority'] as String? ?? 'MEDIUM'),
      raisedByName: raisedBy?['displayName'] as String? ?? raisedBy?['username'] as String?,
      raisedDate: j['raisedDate'] as String? ?? '',
      requiredDate: j['requiredDate'] as String?,
      committedDate: j['committedCompletionDate'] as String?,
      closedDate: j['closedDate'] as String?,
      currentDepartmentName: (j['currentDepartment'] as Map?)?['name'] as String?,
      flowSteps: flow,
      tagNames: tags,
      canRespond: j['canRespond'] as bool? ?? false,
      canCoordinatorClose: j['canCoordinatorClose'] as bool? ?? false,
      canClose: j['canClose'] as bool? ?? false,
    );
  }
}

// ── Schedule Version ──────────────────────────────────────────────────────────

enum VersionType { baseline, revised, working }

extension VersionTypeX on VersionType {
  String get label => switch (this) {
    VersionType.baseline => 'Baseline',
    VersionType.revised => 'Revised',
    VersionType.working => 'Working',
  };
  Color get color => switch (this) {
    VersionType.baseline => Colors.indigo.shade700,
    VersionType.revised => Colors.orange.shade700,
    VersionType.working => Colors.teal.shade700,
  };
  static VersionType fromApi(String v) => switch (v.toUpperCase()) {
    'BASELINE' => VersionType.baseline,
    'REVISED' => VersionType.revised,
    _ => VersionType.working,
  };
}

class ScheduleVersion {
  final int id;
  final int projectId;
  final String versionCode;
  final VersionType versionType;
  final bool isActive;
  final bool isLocked;
  final String? createdAt;

  const ScheduleVersion({
    required this.id, required this.projectId, required this.versionCode,
    required this.versionType, required this.isActive, required this.isLocked,
    this.createdAt,
  });

  factory ScheduleVersion.fromJson(Map<String, dynamic> j) => ScheduleVersion(
    id: j['id'] as int,
    projectId: j['projectId'] as int? ?? 0,
    versionCode: j['versionCode'] as String? ?? 'V${j['id']}',
    versionType: VersionTypeX.fromApi(j['versionType'] as String? ?? 'WORKING'),
    isActive: j['isActive'] as bool? ?? false,
    isLocked: j['isLocked'] as bool? ?? false,
    // Backend uses 'createdOn' not 'createdAt'
    createdAt: j['createdOn'] as String? ?? j['createdAt'] as String?,
  );
}

class ScheduleActivity {
  final int id;
  final String name;
  final String? activityCode;
  final String? startDate;
  final String? finishDate;
  final String? actualStart;
  final String? actualFinish;
  final double percentComplete;
  final int? totalFloat;
  final bool isCritical;
  final int? epsNodeId;

  const ScheduleActivity({
    required this.id, required this.name, this.activityCode,
    this.startDate, this.finishDate, this.actualStart, this.actualFinish,
    this.percentComplete = 0, this.totalFloat, this.isCritical = false,
    this.epsNodeId,
  });

  factory ScheduleActivity.fromJson(Map<String, dynamic> j) {
    final act = j['activity'] as Map<String, dynamic>? ?? j;
    return ScheduleActivity(
      id: j['activityId'] as int? ?? act['id'] as int? ?? 0,
      name: act['name'] as String? ?? act['activityName'] as String? ?? '',
      activityCode: act['activityCode'] as String?,
      startDate: j['startDate'] as String? ?? act['startDate'] as String?,
      finishDate: j['finishDate'] as String? ?? act['finishDate'] as String?,
      actualStart: j['actualStart'] as String? ?? act['actualStart'] as String?,
      actualFinish: j['actualFinish'] as String? ?? act['actualFinish'] as String?,
      percentComplete: ((j['percentComplete'] ?? act['percentComplete'] ?? 0) as num).toDouble(),
      totalFloat: j['totalFloat'] as int? ?? j['float'] as int?,
      isCritical: j['isCritical'] as bool? ?? false,
      epsNodeId: j['epsNodeId'] as int? ?? act['epsNodeId'] as int?,
    );
  }
}

// ── Work Order Linkage ────────────────────────────────────────────────────────

class WoMapping {
  final String woId;
  final String woNumber;
  final String? vendorName;
  final String? activityName;
  final int? activityId;
  final double mappedQty;
  final String? unit;

  const WoMapping({
    required this.woId, required this.woNumber, this.vendorName,
    this.activityName, this.activityId, this.mappedQty = 0, this.unit,
  });

  factory WoMapping.fromJson(Map<String, dynamic> j) => WoMapping(
    woId: j['woId']?.toString() ?? j['id']?.toString() ?? '',
    woNumber: j['woNumber'] as String? ?? '',
    vendorName: j['vendorName'] as String? ?? (j['vendor'] as Map?)?['name'] as String?,
    activityName: j['activityName'] as String? ?? (j['activity'] as Map?)?['name'] as String?,
    activityId: j['activityId'] as int?,
    mappedQty: ((j['mappedQty'] ?? j['qty'] ?? 0) as num).toDouble(),
    unit: j['unit'] as String?,
  );
}
