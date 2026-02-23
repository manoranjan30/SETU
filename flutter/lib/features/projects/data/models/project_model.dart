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
      // The /eps/:id/tree endpoint uses 'label' instead of 'name'
      name: json['name'] as String? ?? json['label'] as String? ?? '',
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

/// BOQ Activity Plan – one BOQ line item linked to an activity.
/// Sourced from the `plans` array in GET /planning/:epsNodeId/execution-ready.
class ActivityPlan extends Equatable {
  final int planId;
  final int boqItemId;
  final String description;
  final String? uom;
  final double plannedQuantity;
  /// Total executed quantity so far (all approved measurements).
  final double consumedQty;

  const ActivityPlan({
    required this.planId,
    required this.boqItemId,
    required this.description,
    this.uom,
    required this.plannedQuantity,
    required this.consumedQty,
  });

  factory ActivityPlan.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic v) {
      if (v == null) return 0;
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v) ?? 0;
      return 0;
    }

    return ActivityPlan(
      planId: json['planId'] as int? ?? json['plan_id'] as int? ?? 0,
      boqItemId: json['boqItemId'] as int? ?? json['boq_item_id'] as int? ?? 0,
      description: json['description'] as String? ?? '',
      uom: json['uom'] as String? ?? json['unit'] as String?,
      plannedQuantity: toDouble(json['plannedQuantity'] ?? json['planned_quantity']),
      consumedQty: toDouble(
        json['consumedQty'] ?? json['consumed_qty'] ??
        json['totalQty'] ?? json['total_qty'],
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        'planId': planId,
        'boqItemId': boqItemId,
        'description': description,
        'uom': uom,
        'plannedQuantity': plannedQuantity,
        'consumedQty': consumedQty,
      };

  /// Remaining quantity available for entry (clamped to ≥ 0).
  double get balance => (plannedQuantity - consumedQty).clamp(0, double.infinity);

  @override
  List<Object?> get props =>
      [planId, boqItemId, description, uom, plannedQuantity, consumedQty];
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
  /// BOQ plans attached to this activity (from execution-ready endpoint).
  final List<ActivityPlan> plans;

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
    this.plans = const [],
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

    // Backend's /planning/:epsNodeId/execution-ready uses percentComplete (0-100).
    // Normalise to 0.0-1.0 for consistency with the rest of the app.
    // getRawMany() in TypeORM returns PostgreSQL DECIMAL columns as Strings
    // (e.g. "0.00"), so we must handle both num and String gracefully.
    double? toDouble(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v);
      return null;
    }

    double? resolveProgress() {
      final v = toDouble(json['actualProgress'] ?? json['actual_progress']);
      if (v != null) return v;
      final pc = toDouble(json['percentComplete'] ?? json['percent_complete']);
      if (pc != null) return pc / 100.0;
      return null;
    }

    double? resolvePlannedProgress() {
      return toDouble(json['plannedProgress'] ?? json['planned_progress']);
    }

    return Activity(
      id: readInt(json['id']) ?? 0,
      // /execution-ready uses 'activityName'; WBS endpoint uses 'name'
      name: json['name'] as String? ??
          json['activityName'] as String? ??
          json['activity_name'] as String? ??
          '',
      // /execution-ready uses 'activityCode'; WBS endpoint uses 'code'
      code: json['code'] as String? ??
          json['activityCode'] as String? ??
          json['activity_code'] as String?,
      projectId: readInt(json['projectId']) ??
          readInt(json['project_id']) ??
          (nestedProject is Map<String, dynamic>
              ? readInt(nestedProject['id'])
              : null) ??
          0,
      // epsNodeId may be injected by the caller (e.g. when fetching per-node)
      // or derived from 'projectId' which in distributed activities = EPS node ID.
      epsNodeId: readInt(json['epsNodeId']) ??
          readInt(json['eps_node_id']) ??
          (nestedEps is Map<String, dynamic> ? readInt(nestedEps['id']) : null) ??
          readInt(json['projectId']),
      status: json['status'] as String?,
      startDate: json['startDate'] != null
          ? DateTime.tryParse(json['startDate'].toString())
          : (json['startDateActual'] != null
              ? DateTime.tryParse(json['startDateActual'].toString())
              : null),
      endDate: json['endDate'] != null
          ? DateTime.tryParse(json['endDate'].toString())
          : (json['finishDateActual'] != null
              ? DateTime.tryParse(json['finishDateActual'].toString())
              : null),
      plannedProgress: resolvePlannedProgress(),
      actualProgress: resolveProgress(),
      plannedQuantity: toDouble(json['plannedQuantity'] ?? json['planned_quantity']),
      actualQuantity: toDouble(json['actualQuantity'] ?? json['actual_quantity']),
      unit: json['unit'] as String?,
      hasMicroSchedule: json['hasMicroSchedule'] as bool? ??
          json['has_micro_schedule'] as bool? ??
          false,
      plans: (json['plans'] as List<dynamic>?)
              ?.map((e) => ActivityPlan.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
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
      'plans': plans.map((e) => e.toJson()).toList(),
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
        plans,
      ];
}
