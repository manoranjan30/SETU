import 'package:equatable/equatable.dart';

/// Project model representing a construction project
class Project extends Equatable {
  final int id;
  final String name;
  final String? code;
  final String? status;
  final DateTime? startDate;
  final DateTime? endDate;
  final double? progress;
  final List<EpsNode> children;

  const Project({
    required this.id,
    required this.name,
    this.code,
    this.status,
    this.startDate,
    this.endDate,
    this.progress,
    this.children = const [],
  });

  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      code: json['code'] as String?,
      status: json['status'] as String?,
      startDate: json['startDate'] != null
          ? DateTime.tryParse(json['startDate'])
          : null,
      endDate:
          json['endDate'] != null ? DateTime.tryParse(json['endDate']) : null,
      progress: (json['progress'] as num?)?.toDouble(),
      children: (json['children'] as List<dynamic>?)
              ?.map((e) => EpsNode.fromJson(e))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'code': code,
      'status': status,
      'startDate': startDate?.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'progress': progress,
      'children': children.map((e) => e.toJson()).toList(),
    };
  }

  @override
  List<Object?> get props =>
      [id, name, code, status, startDate, endDate, progress, children];
}

/// EPS Node model for project hierarchy
class EpsNode extends Equatable {
  final int id;
  final String name;
  final String? code;
  final String type; // 'project', 'phase', 'building', 'floor', etc.
  final String? status;
  final double? progress;
  final List<EpsNode> children;
  final int? parentId;

  const EpsNode({
    required this.id,
    required this.name,
    this.code,
    required this.type,
    this.status,
    this.progress,
    this.children = const [],
    this.parentId,
  });

  factory EpsNode.fromJson(Map<String, dynamic> json) {
    return EpsNode(
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      code: json['code'] as String?,
      type: json['type'] as String? ?? 'unknown',
      status: json['status'] as String?,
      progress: (json['progress'] as num?)?.toDouble(),
      children: (json['children'] as List<dynamic>?)
              ?.map((e) => EpsNode.fromJson(e))
              .toList() ??
          [],
      parentId: json['parentId'] as int? ?? json['parent_id'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'code': code,
      'type': type,
      'status': status,
      'progress': progress,
      'children': children.map((e) => e.toJson()).toList(),
      'parentId': parentId,
    };
  }

  bool get hasChildren => children.isNotEmpty;

  @override
  List<Object?> get props =>
      [id, name, code, type, status, progress, children, parentId];
}

/// Activity model for project activities
class Activity extends Equatable {
  final int id;
  final String name;
  final String? code;
  final int projectId;
  final int? epsNodeId;
  final String? status;
  final DateTime? startDate;
  final DateTime? endDate;
  final double? plannedProgress;
  final double? actualProgress;
  final double? plannedQuantity;
  final double? actualQuantity;
  final String? unit;
  final bool hasMicroSchedule;

  const Activity({
    required this.id,
    required this.name,
    this.code,
    required this.projectId,
    this.epsNodeId,
    this.status,
    this.startDate,
    this.endDate,
    this.plannedProgress,
    this.actualProgress,
    this.plannedQuantity,
    this.actualQuantity,
    this.unit,
    this.hasMicroSchedule = false,
  });

  factory Activity.fromJson(Map<String, dynamic> json) {
    int? readInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value);
      return null;
    }

    final nestedEps = json['epsNode'] ?? json['eps_node'];
    final nestedProject = json['project'];

    return Activity(
      id: readInt(json['id']) ?? 0,
      name: json['name'] as String? ?? '',
      code: json['code'] as String?,
      projectId: readInt(json['projectId']) ??
          readInt(json['project_id']) ??
          (nestedProject is Map<String, dynamic>
              ? readInt(nestedProject['id'])
              : null) ??
          0,
      epsNodeId: readInt(json['epsNodeId']) ??
          readInt(json['eps_node_id']) ??
          (nestedEps is Map<String, dynamic> ? readInt(nestedEps['id']) : null),
      status: json['status'] as String?,
      startDate: json['startDate'] != null
          ? DateTime.tryParse(json['startDate'].toString())
          : null,
      endDate: json['endDate'] != null
          ? DateTime.tryParse(json['endDate'].toString())
          : null,
      plannedProgress: (json['plannedProgress'] as num?)?.toDouble() ??
          (json['planned_progress'] as num?)?.toDouble(),
      actualProgress: (json['actualProgress'] as num?)?.toDouble() ??
          (json['actual_progress'] as num?)?.toDouble(),
      plannedQuantity: (json['plannedQuantity'] as num?)?.toDouble() ??
          (json['planned_quantity'] as num?)?.toDouble(),
      actualQuantity: (json['actualQuantity'] as num?)?.toDouble() ??
          (json['actual_quantity'] as num?)?.toDouble(),
      unit: json['unit'] as String?,
      hasMicroSchedule: json['hasMicroSchedule'] as bool? ??
          json['has_micro_schedule'] as bool? ??
          false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'code': code,
      'projectId': projectId,
      'epsNodeId': epsNodeId,
      'status': status,
      'startDate': startDate?.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'plannedProgress': plannedProgress,
      'actualProgress': actualProgress,
      'plannedQuantity': plannedQuantity,
      'actualQuantity': actualQuantity,
      'unit': unit,
      'hasMicroSchedule': hasMicroSchedule,
    };
  }

  double get progress => actualProgress ?? 0;

  @override
  List<Object?> get props => [
        id,
        name,
        code,
        projectId,
        epsNodeId,
        status,
        startDate,
        endDate,
        plannedProgress,
        actualProgress,
        plannedQuantity,
        actualQuantity,
        unit,
        hasMicroSchedule,
      ];
}
