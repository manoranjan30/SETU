import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

// ============================================================
// CONCRETE GRADE
// ============================================================

class ConcreteGrade extends Equatable {
  final int id;
  final int projectId;
  final String grade;
  final String? targetMeanStrengthMpa;
  final String? characteristicStrengthMpa;
  final String? mixRatio;
  final String? slumpRangeMm;
  final bool isActive;

  const ConcreteGrade({
    required this.id,
    required this.projectId,
    required this.grade,
    this.targetMeanStrengthMpa,
    this.characteristicStrengthMpa,
    this.mixRatio,
    this.slumpRangeMm,
    this.isActive = true,
  });

  factory ConcreteGrade.fromJson(Map<String, dynamic> j) => ConcreteGrade(
        id: j['id'] as int? ?? 0,
        projectId: j['projectId'] as int? ?? 0,
        grade: j['grade'] as String? ?? '',
        targetMeanStrengthMpa: j['targetMeanStrengthMpa']?.toString(),
        characteristicStrengthMpa: j['characteristicStrengthMpa']?.toString(),
        mixRatio: j['mixRatio'] as String?,
        slumpRangeMm: j['slumpRangeMm'] as String?,
        isActive: j['isActive'] as bool? ?? true,
      );

  @override
  List<Object?> get props => [id, grade, isActive];
}

// ============================================================
// CUBE TEST STATUS / AGE ENUMS
// ============================================================

enum CubeTestStatus {
  pending, dueToday, overdue, tested, approved, failed;

  static CubeTestStatus fromString(String s) {
    switch (s.toUpperCase()) {
      case 'DUE_TODAY': return CubeTestStatus.dueToday;
      case 'OVERDUE':   return CubeTestStatus.overdue;
      case 'TESTED':    return CubeTestStatus.tested;
      case 'APPROVED':  return CubeTestStatus.approved;
      case 'FAILED':    return CubeTestStatus.failed;
      default:          return CubeTestStatus.pending;
    }
  }

  String get label => switch (this) {
    CubeTestStatus.pending  => 'Pending',
    CubeTestStatus.dueToday => 'Due Today',
    CubeTestStatus.overdue  => 'Overdue',
    CubeTestStatus.tested   => 'Tested',
    CubeTestStatus.approved => 'Approved',
    CubeTestStatus.failed   => 'Failed',
  };

  Color get color => switch (this) {
    CubeTestStatus.pending  => const Color(0xFF6B7280),
    CubeTestStatus.dueToday => const Color(0xFFF59E0B),
    CubeTestStatus.overdue  => const Color(0xFFDC2626),
    CubeTestStatus.tested   => const Color(0xFF1D4ED8),
    CubeTestStatus.approved => const Color(0xFF15803D),
    CubeTestStatus.failed   => const Color(0xFFDC2626),
  };

  bool get isTerminal => this == CubeTestStatus.approved;
  bool get needsAttention =>
      this == CubeTestStatus.dueToday || this == CubeTestStatus.overdue;
}

enum CubeTestAge {
  sevenDay, twentyEightDay;

  static CubeTestAge fromString(String s) =>
      s.contains('7') ? CubeTestAge.sevenDay : CubeTestAge.twentyEightDay;

  String get label => this == CubeTestAge.sevenDay ? '7-Day' : '28-Day';
}

// ============================================================
// CUBE TEST RECORD
// ============================================================

class CubeTestRecord extends Equatable {
  final int id;
  final int projectId;
  final String cubeId;
  final CubeTestAge testAge;
  final String castDate;
  final String dueDate;
  final CubeTestStatus status;

  // Context snapshots
  final String? elementName;
  final String? goLabel;
  final String? locationText;
  final String? mixIdOrGrade;
  final String? truckNo;
  final String? deliveryChallanNo;
  final String? activityName;

  // Test results
  final String? loadKn;
  final String? compressiveStrengthMpa;
  final String? requiredStrengthMpa;
  final String? averageStrengthMpa;
  final String? testedByName;
  final String? testedDate;
  final String? remarks;
  final Map<String, dynamic>? calculationDetails;

  // Approval
  final DateTime? approvedAt;

  const CubeTestRecord({
    required this.id,
    required this.projectId,
    required this.cubeId,
    required this.testAge,
    required this.castDate,
    required this.dueDate,
    required this.status,
    this.elementName,
    this.goLabel,
    this.locationText,
    this.mixIdOrGrade,
    this.truckNo,
    this.deliveryChallanNo,
    this.activityName,
    this.loadKn,
    this.compressiveStrengthMpa,
    this.requiredStrengthMpa,
    this.averageStrengthMpa,
    this.testedByName,
    this.testedDate,
    this.remarks,
    this.calculationDetails,
    this.approvedAt,
  });

  factory CubeTestRecord.fromJson(Map<String, dynamic> j) => CubeTestRecord(
        id: j['id'] as int? ?? 0,
        projectId: j['projectId'] as int? ?? 0,
        cubeId: j['cubeId'] as String? ?? '',
        testAge: CubeTestAge.fromString(j['testAge'] as String? ?? '28_DAY'),
        castDate: j['castDate'] as String? ?? '',
        dueDate: j['dueDate'] as String? ?? '',
        status: CubeTestStatus.fromString(j['status'] as String? ?? 'PENDING'),
        elementName: j['elementName'] as String?,
        goLabel: j['goLabel'] as String?,
        locationText: j['locationText'] as String?,
        mixIdOrGrade: j['mixIdOrGrade'] as String?,
        truckNo: j['truckNo'] as String?,
        deliveryChallanNo: j['deliveryChallanNo'] as String?,
        activityName: j['activityName'] as String?,
        loadKn: j['loadKn']?.toString(),
        compressiveStrengthMpa: j['compressiveStrengthMpa']?.toString(),
        requiredStrengthMpa: j['requiredStrengthMpa']?.toString(),
        averageStrengthMpa: j['averageStrengthMpa']?.toString(),
        testedByName: j['testedByName'] as String?,
        testedDate: j['testedDate'] as String?,
        remarks: j['remarks'] as String?,
        calculationDetails:
            j['calculationDetails'] as Map<String, dynamic>?,
        approvedAt: j['approvedAt'] == null
            ? null
            : DateTime.tryParse(j['approvedAt'].toString()),
      );

  /// Days until due (negative = overdue)
  int get daysUntilDue {
    final dt = DateTime.tryParse(dueDate);
    if (dt == null) return 0;
    return dt.difference(DateTime.now()).inDays;
  }

  bool get hasPassed {
    final calc = compressiveStrengthMpa != null
        ? double.tryParse(compressiveStrengthMpa!)
        : null;
    final req = requiredStrengthMpa != null
        ? double.tryParse(requiredStrengthMpa!)
        : null;
    if (calc == null || req == null) return false;
    return calc >= req;
  }

  @override
  List<Object?> get props => [id, cubeId, status, loadKn];
}
