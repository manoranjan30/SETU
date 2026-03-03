/// Data models for the GET /execution/breakdown response.
///
/// The backend returns a unified view of micro-scheduled activities PLUS
/// the "balance" (direct / unassigned) quantity for each BOQ item linked
/// to an activity.
library;

// ---------------------------------------------------------------------------
// BreakdownItem — one row inside a BOQ item breakdown
// ---------------------------------------------------------------------------

class BreakdownItem {
  /// 'MICRO' for a micro-schedule activity; 'BALANCE' for the unassigned qty.
  final String type;

  /// ID of the MicroScheduleActivity (null when type == 'BALANCE').
  final int? id;

  /// Display name (micro activity name, or "Unassigned Quantity (Direct)").
  final String name;

  /// Quantity planned/allocated to this item.
  final double allocatedQty;

  /// Quantity already executed (approved + pending on server).
  final double executedQty;

  /// Remaining quantity available for input (allocatedQty − executedQty).
  final double balanceQty;

  const BreakdownItem({
    required this.type,
    this.id,
    required this.name,
    required this.allocatedQty,
    required this.executedQty,
    required this.balanceQty,
  });

  bool get isMicro => type == 'MICRO';

  factory BreakdownItem.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic v) {
      if (v == null) return 0;
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v) ?? 0;
      return 0;
    }

    return BreakdownItem(
      type: json['type'] as String? ?? 'BALANCE',
      id: json['id'] as int?,
      name: json['name'] as String? ?? '',
      allocatedQty: toDouble(json['allocatedQty']),
      executedQty: toDouble(json['executedQty']),
      balanceQty: toDouble(json['balanceQty']),
    );
  }
}

// ---------------------------------------------------------------------------
// BoqItemBreakdown — one BOQ item with its micro + balance rows
// ---------------------------------------------------------------------------

class BoqItemBreakdown {
  final int boqItemId;
  final String description;
  final String? uom;

  /// Total planned quantity for this BOQ item across the whole activity.
  final double totalScope;

  /// Portion allocated to micro-schedule activities.
  final double allocatedToMicro;

  /// Portion not yet assigned to any micro activity (available for direct entry).
  final double balanceDirect;

  /// Ordered list: MICRO items first, then BALANCE item.
  final List<BreakdownItem> items;

  const BoqItemBreakdown({
    required this.boqItemId,
    required this.description,
    this.uom,
    required this.totalScope,
    required this.allocatedToMicro,
    required this.balanceDirect,
    required this.items,
  });

  factory BoqItemBreakdown.fromJson(Map<String, dynamic> json) {
    final boqItem = json['boqItem'] as Map<String, dynamic>? ?? {};
    final scope = json['scope'] as Map<String, dynamic>? ?? {};

    double toDouble(dynamic v) {
      if (v == null) return 0;
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v) ?? 0;
      return 0;
    }

    return BoqItemBreakdown(
      boqItemId: boqItem['id'] as int? ?? 0,
      // BoqItem entity may use 'description' or 'name'
      description:
          boqItem['description'] as String? ?? boqItem['name'] as String? ?? '',
      uom: boqItem['uom'] as String?,
      totalScope: toDouble(scope['total']),
      allocatedToMicro: toDouble(scope['allocated']),
      balanceDirect: toDouble(scope['balance']),
      items:
          (json['items'] as List<dynamic>?)
              ?.map((e) => BreakdownItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

// ---------------------------------------------------------------------------
// ExecutionBreakdown — top-level response model
// ---------------------------------------------------------------------------

class ExecutionBreakdown {
  final int activityId;
  final int epsNodeId;
  final List<BoqItemBreakdown> boqBreakdown;

  const ExecutionBreakdown({
    required this.activityId,
    required this.epsNodeId,
    required this.boqBreakdown,
  });

  factory ExecutionBreakdown.fromJson(Map<String, dynamic> json) {
    return ExecutionBreakdown(
      activityId: json['activityId'] as int? ?? 0,
      epsNodeId: json['epsNodeId'] as int? ?? 0,
      boqBreakdown:
          (json['boqBreakdown'] as List<dynamic>?)
              ?.map((e) => BoqItemBreakdown.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
