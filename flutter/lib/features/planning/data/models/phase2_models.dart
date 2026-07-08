import 'package:flutter/material.dart';

// ── Assignee Picker ───────────────────────────────────────────────────────────

class AssigneeOption {
  final String type; // INTERNAL_USER | VENDOR_USER
  final int? userId;
  final int? tempUserId;
  final String label;
  final String? designation;
  final String? company;

  const AssigneeOption({
    required this.type, this.userId, this.tempUserId,
    required this.label, this.designation, this.company,
  });

  bool get isVendor => type == 'VENDOR_USER';

  factory AssigneeOption.fromJson(Map<String, dynamic> j) => AssigneeOption(
    type: j['type'] as String? ?? 'INTERNAL_USER',
    userId: j['userId'] as int?,
    tempUserId: j['tempUserId'] as int?,
    label: j['label'] as String? ?? j['displayName'] as String? ?? j['username'] as String? ?? '',
    designation: j['designation'] as String?,
    company: j['company'] as String?,
  );

  Map<String, dynamic> toPayload() => {
    'assignedToType': type,
    'assignedToUserId': userId,
    'assignedToTempUserId': tempUserId,
  };
}

// ── Planning Action Summary ───────────────────────────────────────────────────

class PlanningActionSummary {
  final int activeTasks;
  final int completedTasks;
  final int overdueFollowups;
  final int dueTodayFollowups;
  final String? todayJournalStatus;
  final int? todayJournalId;

  const PlanningActionSummary({
    this.activeTasks = 0, this.completedTasks = 0,
    this.overdueFollowups = 0, this.dueTodayFollowups = 0,
    this.todayJournalStatus, this.todayJournalId,
  });

  factory PlanningActionSummary.fromJson(Map<String, dynamic> j) => PlanningActionSummary(
    activeTasks: j['activeTasks'] as int? ?? 0,
    completedTasks: j['completedTasks'] as int? ?? 0,
    overdueFollowups: j['overdueFollowups'] as int? ?? 0,
    dueTodayFollowups: j['dueTodayFollowups'] as int? ?? 0,
    todayJournalStatus: j['todayJournalStatus'] as String?,
    todayJournalId: j['todayJournalId'] as int?,
  );
}

// ── Task Manager ──────────────────────────────────────────────────────────────

enum TaskStatus { todo, inProgress, done, blocked }
enum TaskPriority { low, medium, high, critical }

extension TaskStatusX on TaskStatus {
  String get apiValue => switch (this) {
    TaskStatus.todo => 'TODO',
    TaskStatus.inProgress => 'IN_PROGRESS',
    TaskStatus.done => 'DONE',
    TaskStatus.blocked => 'BLOCKED',
  };
  String get label => switch (this) {
    TaskStatus.todo => 'To Do',
    TaskStatus.inProgress => 'In Progress',
    TaskStatus.done => 'Done',
    TaskStatus.blocked => 'Blocked',
  };
  Color get color => switch (this) {
    TaskStatus.todo => Colors.grey.shade600,
    TaskStatus.inProgress => Colors.blue.shade700,
    TaskStatus.done => Colors.green.shade700,
    TaskStatus.blocked => Colors.red.shade700,
  };
  static TaskStatus fromApi(String v) => switch (v.toUpperCase()) {
    'IN_PROGRESS' => TaskStatus.inProgress,
    'DONE' => TaskStatus.done,
    'BLOCKED' => TaskStatus.blocked,
    _ => TaskStatus.todo,
  };
}

extension TaskPriorityX on TaskPriority {
  String get apiValue => name.toUpperCase();
  String get label => switch (this) {
    TaskPriority.low => 'Low',
    TaskPriority.medium => 'Medium',
    TaskPriority.high => 'High',
    TaskPriority.critical => 'Critical',
  };
  Color get color => switch (this) {
    TaskPriority.low => Colors.grey.shade600,
    TaskPriority.medium => Colors.orange.shade600,
    TaskPriority.high => Colors.red.shade600,
    TaskPriority.critical => Colors.red.shade900,
  };
  static TaskPriority fromApi(String v) => switch (v.toUpperCase()) {
    'CRITICAL' => TaskPriority.critical,
    'HIGH' => TaskPriority.high,
    'MEDIUM' => TaskPriority.medium,
    _ => TaskPriority.low,
  };
}

class TaskChecklistItem {
  final String text;
  final bool done;
  const TaskChecklistItem({required this.text, required this.done});
  factory TaskChecklistItem.fromJson(Map<String, dynamic> j) =>
      TaskChecklistItem(text: j['text'] as String? ?? '', done: j['done'] as bool? ?? false);
  Map<String, dynamic> toJson() => {'text': text, 'done': done};
}

class ProjectTask {
  final int id;
  final int projectId;
  final String title;
  final String? description;
  final String? taskType;
  final TaskStatus status;
  final TaskPriority priority;
  final String? assignedToLabel;
  final int? assignedToUserId;
  final int? assignedToTempUserId;
  final String? assignedToType;
  final String? createdByName;
  final String? dueDate;
  final String? reminderAt;
  final String? completedAt;
  final int progressPercent;
  final int? linkedActivityId;
  final int? linkedIssueId;
  final String? linkedModule;
  final String? linkedRecordId;
  final List<String> tags;
  final List<TaskChecklistItem> checklistItems;
  final int commentsCount;
  final String createdAt;

  const ProjectTask({
    required this.id, required this.projectId, required this.title,
    this.description, this.taskType, required this.status, required this.priority,
    this.assignedToLabel, this.assignedToUserId, this.assignedToTempUserId,
    this.assignedToType, this.createdByName, this.dueDate, this.reminderAt,
    this.completedAt, this.progressPercent = 0,
    this.linkedActivityId, this.linkedIssueId, this.linkedModule, this.linkedRecordId,
    this.tags = const [], this.checklistItems = const [],
    this.commentsCount = 0, required this.createdAt,
  });

  bool get isOverdue {
    if (dueDate == null || status == TaskStatus.done) return false;
    return DateTime.tryParse(dueDate!)?.isBefore(DateTime.now()) ?? false;
  }

  double get checklistProgress {
    if (checklistItems.isEmpty) return progressPercent / 100;
    return checklistItems.where((i) => i.done).length / checklistItems.length;
  }

  factory ProjectTask.fromJson(Map<String, dynamic> j) {
    final assignedTo = j['assignedTo'] as Map<String, dynamic>?;
    final createdBy = j['createdBy'] as Map<String, dynamic>?;
    return ProjectTask(
      id: j['id'] as int,
      projectId: j['projectId'] as int? ?? 0,
      title: j['title'] as String? ?? '',
      description: j['description'] as String?,
      taskType: j['taskType'] as String?,
      status: TaskStatusX.fromApi(j['status'] as String? ?? 'TODO'),
      priority: TaskPriorityX.fromApi(j['priority'] as String? ?? 'MEDIUM'),
      assignedToLabel: j['assigneeLabel'] as String? ?? assignedTo?['label'] as String? ??
          assignedTo?['displayName'] as String? ?? assignedTo?['username'] as String?,
      assignedToUserId: j['assignedToUserId'] as int?,
      assignedToTempUserId: j['assignedToTempUserId'] as int?,
      assignedToType: j['assignedToType'] as String?,
      createdByName: createdBy?['displayName'] as String? ?? createdBy?['username'] as String?,
      dueDate: j['dueDate'] as String?,
      reminderAt: j['reminderAt'] as String?,
      completedAt: j['completedAt'] as String?,
      progressPercent: j['progressPercent'] as int? ?? 0,
      linkedActivityId: j['linkedActivityId'] as int?,
      linkedIssueId: j['linkedIssueId'] as int?,
      linkedModule: j['linkedModule'] as String?,
      linkedRecordId: j['linkedRecordId']?.toString(),
      tags: (j['tags'] as List<dynamic>? ?? []).map((t) => t.toString()).toList(),
      checklistItems: (j['checklistItems'] as List<dynamic>? ?? [])
          .map((e) => TaskChecklistItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      commentsCount: j['commentsCount'] as int? ?? 0,
      createdAt: j['createdAt'] as String? ?? '',
    );
  }
}

class TaskComment {
  final int id;
  final String comment;
  final String? authorName;
  final String createdAt;
  const TaskComment({required this.id, required this.comment, this.authorName, required this.createdAt});
  factory TaskComment.fromJson(Map<String, dynamic> j) {
    final author = j['createdBy'] as Map<String, dynamic>?;
    return TaskComment(
      id: j['id'] as int,
      comment: j['comment'] as String? ?? '',
      authorName: author?['displayName'] as String? ?? author?['username'] as String?,
      createdAt: j['createdAt'] as String? ?? '',
    );
  }
}

// ── Follow-up Register ────────────────────────────────────────────────────────

enum FollowupStatus { open, inProgress, closed, overdue }

extension FollowupStatusX on FollowupStatus {
  String get apiValue => switch (this) {
    FollowupStatus.open => 'OPEN',
    FollowupStatus.inProgress => 'IN_PROGRESS',
    FollowupStatus.closed => 'CLOSED',
    FollowupStatus.overdue => 'OVERDUE',
  };
  String get label => switch (this) {
    FollowupStatus.open => 'Open',
    FollowupStatus.inProgress => 'In Progress',
    FollowupStatus.closed => 'Closed',
    FollowupStatus.overdue => 'Overdue',
  };
  Color get color => switch (this) {
    FollowupStatus.open => Colors.blue.shade700,
    FollowupStatus.inProgress => Colors.orange.shade700,
    FollowupStatus.closed => Colors.green.shade700,
    FollowupStatus.overdue => Colors.red.shade700,
  };
  static FollowupStatus fromApi(String v) => switch (v.toUpperCase()) {
    'IN_PROGRESS' => FollowupStatus.inProgress,
    'CLOSED' => FollowupStatus.closed,
    'OVERDUE' => FollowupStatus.overdue,
    _ => FollowupStatus.open,
  };
}

class FollowUpAction {
  final int id;
  final int projectId;
  final String actionItem;
  final String? raisedByName;
  final String? assignedToLabel;
  final int? assignedToUserId;
  final int? assignedToTempUserId;
  final String? assignedToType;
  final String raisedDate;
  final String dueDate;
  final String? reminderAt;
  final String? closedDate;
  final FollowupStatus status;
  final String priority;
  final String? followupType;
  final String? remarks;
  final String? meetingReference;
  final String createdAt;

  const FollowUpAction({
    required this.id, required this.projectId, required this.actionItem,
    this.raisedByName, this.assignedToLabel, this.assignedToUserId,
    this.assignedToTempUserId, this.assignedToType,
    required this.raisedDate, required this.dueDate, this.reminderAt,
    this.closedDate, required this.status, required this.priority,
    this.followupType, this.remarks, this.meetingReference, required this.createdAt,
  });

  bool get isOverdue => status == FollowupStatus.overdue ||
      (status != FollowupStatus.closed && DateTime.tryParse(dueDate)?.isBefore(DateTime.now()) == true);

  bool get isDueToday {
    final due = DateTime.tryParse(dueDate);
    if (due == null) return false;
    final now = DateTime.now();
    return due.year == now.year && due.month == now.month && due.day == now.day;
  }

  factory FollowUpAction.fromJson(Map<String, dynamic> j) {
    final raisedBy = j['raisedBy'] as Map<String, dynamic>?;
    final assignedTo = j['assignedTo'] as Map<String, dynamic>?;
    return FollowUpAction(
      id: j['id'] as int,
      projectId: j['projectId'] as int? ?? 0,
      actionItem: j['actionItem'] as String? ?? '',
      raisedByName: raisedBy?['displayName'] as String? ?? raisedBy?['username'] as String?,
      assignedToLabel: j['assigneeLabel'] as String? ?? assignedTo?['label'] as String? ??
          assignedTo?['displayName'] as String?,
      assignedToUserId: j['assignedToUserId'] as int?,
      assignedToTempUserId: j['assignedToTempUserId'] as int?,
      assignedToType: j['assignedToType'] as String?,
      raisedDate: j['raisedDate'] as String? ?? '',
      dueDate: j['dueDate'] as String? ?? '',
      reminderAt: j['reminderAt'] as String?,
      closedDate: j['closedDate'] as String?,
      status: FollowupStatusX.fromApi(j['status'] as String? ?? 'OPEN'),
      priority: j['priority'] as String? ?? 'MEDIUM',
      followupType: j['followupType'] as String?,
      remarks: j['remarks'] as String?,
      meetingReference: j['meetingReference'] as String?,
      createdAt: j['createdAt'] as String? ?? '',
    );
  }
}

// ── Site Journal ──────────────────────────────────────────────────────────────

enum WeatherCondition { sunny, cloudy, rainy, foggy }
enum JournalStatus { draft, submitted, locked }

extension WeatherX on WeatherCondition {
  String get apiValue => name.toUpperCase();
  String get label => switch (this) {
    WeatherCondition.sunny => 'Sunny',
    WeatherCondition.cloudy => 'Cloudy',
    WeatherCondition.rainy => 'Rainy',
    WeatherCondition.foggy => 'Foggy',
  };
  IconData get icon => switch (this) {
    WeatherCondition.sunny => Icons.wb_sunny_outlined,
    WeatherCondition.cloudy => Icons.cloud_outlined,
    WeatherCondition.rainy => Icons.water_drop_outlined,
    WeatherCondition.foggy => Icons.filter_drama_outlined,
  };
  static WeatherCondition fromApi(String v) => switch (v.toUpperCase()) {
    'CLOUDY' => WeatherCondition.cloudy,
    'RAINY' => WeatherCondition.rainy,
    'FOGGY' => WeatherCondition.foggy,
    _ => WeatherCondition.sunny,
  };
}

extension JournalStatusX on JournalStatus {
  String get apiValue => switch (this) {
    JournalStatus.draft => 'DRAFT',
    JournalStatus.submitted => 'SUBMITTED',
    JournalStatus.locked => 'LOCKED',
  };
  String get label => switch (this) {
    JournalStatus.draft => 'Draft',
    JournalStatus.submitted => 'Submitted',
    JournalStatus.locked => 'Locked',
  };
  Color get color => switch (this) {
    JournalStatus.draft => Colors.orange.shade700,
    JournalStatus.submitted => Colors.blue.shade700,
    JournalStatus.locked => Colors.green.shade700,
  };
  static JournalStatus fromApi(String v) => switch (v.toUpperCase()) {
    'SUBMITTED' => JournalStatus.submitted,
    'LOCKED' => JournalStatus.locked,
    _ => JournalStatus.draft,
  };
}

class SiteJournalEntry {
  final int id;
  final int projectId;
  final String date;
  final String? authorName;
  final WeatherCondition? weather;
  final String? journalType;
  final String? locationText;
  final int? epsNodeId;
  final String summary;
  final String? workDoneToday;
  final String? progressNotes;
  final String? issuesRaised;
  final String? safetyObservations;
  final String? qualityObservations;
  final String? decisionsTaken;
  final String? instructionsGiven;
  final String? materialReceived;
  final String? delaysOrConstraints;
  final String? tomorrowPlan;
  final int? laborCount;
  final String? equipmentOnSite;
  final String? visitorsOnSite;
  final List<String> photoUrls;
  final List<String> tags;
  final String? remarks;
  final JournalStatus status;
  final String createdAt;

  const SiteJournalEntry({
    required this.id, required this.projectId, required this.date,
    this.authorName, this.weather, this.journalType, this.locationText, this.epsNodeId,
    required this.summary, this.workDoneToday, this.progressNotes,
    this.issuesRaised, this.safetyObservations, this.qualityObservations,
    this.decisionsTaken, this.instructionsGiven, this.materialReceived,
    this.delaysOrConstraints, this.tomorrowPlan,
    this.laborCount, this.equipmentOnSite, this.visitorsOnSite,
    this.photoUrls = const [], this.tags = const [], this.remarks,
    this.status = JournalStatus.draft, required this.createdAt,
  });

  bool get isEditable => status != JournalStatus.locked;

  factory SiteJournalEntry.fromJson(Map<String, dynamic> j) {
    final author = j['author'] as Map<String, dynamic>?;
    return SiteJournalEntry(
      id: j['id'] as int,
      projectId: j['projectId'] as int? ?? 0,
      date: j['date'] as String? ?? '',
      authorName: author?['displayName'] as String? ?? author?['username'] as String?,
      weather: j['weather'] != null ? WeatherX.fromApi(j['weather'] as String) : null,
      journalType: j['journalType'] as String?,
      locationText: j['locationText'] as String?,
      epsNodeId: j['epsNodeId'] as int?,
      summary: j['summary'] as String? ?? '',
      workDoneToday: j['workDoneToday'] as String?,
      progressNotes: j['progressNotes'] as String?,
      issuesRaised: j['issuesRaised'] as String?,
      safetyObservations: j['safetyObservations'] as String?,
      qualityObservations: j['qualityObservations'] as String?,
      decisionsTaken: j['decisionsTaken'] as String?,
      instructionsGiven: j['instructionsGiven'] as String?,
      materialReceived: j['materialReceived'] as String?,
      delaysOrConstraints: j['delaysOrConstraints'] as String?,
      tomorrowPlan: j['tomorrowPlan'] as String?,
      laborCount: j['laborCount'] as int?,
      equipmentOnSite: j['equipmentOnSite'] as String?,
      visitorsOnSite: j['visitorsOnSite'] as String?,
      photoUrls: (j['photoUrls'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
      tags: (j['tags'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
      remarks: j['remarks'] as String?,
      status: JournalStatusX.fromApi(j['status'] as String? ?? 'DRAFT'),
      createdAt: j['createdAt'] as String? ?? '',
    );
  }
}
