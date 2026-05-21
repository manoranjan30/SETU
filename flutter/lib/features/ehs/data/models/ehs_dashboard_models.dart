import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

// ============================================================
// EHS SUMMARY (Overview tab)
// ============================================================

class EhsSummary extends Equatable {
  final int totalIncidents;
  final int nearMissCount;
  final int openObservations;
  final int closedObservations;
  final double trainingCompliancePercent;
  final double legalCompliancePercent;
  final int totalManhoursThisMonth;
  final int totalWorkersOnSite;

  const EhsSummary({
    this.totalIncidents = 0,
    this.nearMissCount = 0,
    this.openObservations = 0,
    this.closedObservations = 0,
    this.trainingCompliancePercent = 0,
    this.legalCompliancePercent = 0,
    this.totalManhoursThisMonth = 0,
    this.totalWorkersOnSite = 0,
  });

  factory EhsSummary.fromJson(Map<String, dynamic> j) {
    double d(dynamic v) => v == null ? 0.0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0.0);
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    return EhsSummary(
      totalIncidents: i(j['totalIncidents'] ?? j['incidentCount']),
      nearMissCount: i(j['nearMissCount'] ?? j['nearMiss']),
      openObservations: i(j['openObservations'] ?? j['openObs']),
      closedObservations: i(j['closedObservations'] ?? j['closedObs']),
      trainingCompliancePercent: d(j['trainingCompliancePercent'] ?? j['trainingCompliance']),
      legalCompliancePercent: d(j['legalCompliancePercent'] ?? j['legalCompliance']),
      totalManhoursThisMonth: i(j['totalManhoursThisMonth'] ?? j['manhours']),
      totalWorkersOnSite: i(j['totalWorkersOnSite'] ?? j['workers']),
    );
  }

  @override
  List<Object?> get props => [totalIncidents, nearMissCount, openObservations, trainingCompliancePercent];
}

// ============================================================
// EHS PERFORMANCE (Performance tab)
// ============================================================

class EhsPerformanceData extends Equatable {
  final double trifr;         // Total Recordable Incident Frequency Rate
  final double nearMissRate;
  final int ltiCount;         // Lost Time Injuries
  final int firstAidCount;
  final List<EhsIncidentPoint> incidentTrend; // monthly trend

  const EhsPerformanceData({
    this.trifr = 0,
    this.nearMissRate = 0,
    this.ltiCount = 0,
    this.firstAidCount = 0,
    this.incidentTrend = const [],
  });

  factory EhsPerformanceData.fromJson(Map<String, dynamic> j) {
    double d(dynamic v) => v == null ? 0.0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0.0);
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    return EhsPerformanceData(
      trifr: d(j['trifr'] ?? j['TRIFR']),
      nearMissRate: d(j['nearMissRate']),
      ltiCount: i(j['ltiCount'] ?? j['lti']),
      firstAidCount: i(j['firstAidCount'] ?? j['firstAid']),
      incidentTrend: (j['incidentTrend'] as List<dynamic>? ?? [])
          .map((e) => EhsIncidentPoint.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  @override
  List<Object?> get props => [trifr, ltiCount, incidentTrend];
}

class EhsIncidentPoint extends Equatable {
  final String monthLabel;
  final int count;

  const EhsIncidentPoint({required this.monthLabel, required this.count});

  factory EhsIncidentPoint.fromJson(Map<String, dynamic> j) => EhsIncidentPoint(
    monthLabel: j['month'] as String? ?? j['label'] as String? ?? '',
    count: j['count'] as int? ?? 0,
  );

  @override
  List<Object?> get props => [monthLabel, count];
}

// ============================================================
// EHS MANHOURS
// ============================================================

class EhsManhoursRecord extends Equatable {
  final int id;
  final String month;        // e.g. "2026-05"
  final int totalManhours;
  final int totalWorkers;
  final int tbmCount;        // Toolbox Meeting count
  final String? remarks;
  final DateTime? recordedAt;

  const EhsManhoursRecord({
    required this.id,
    required this.month,
    required this.totalManhours,
    this.totalWorkers = 0,
    this.tbmCount = 0,
    this.remarks,
    this.recordedAt,
  });

  factory EhsManhoursRecord.fromJson(Map<String, dynamic> j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    return EhsManhoursRecord(
      id: j['id'] as int? ?? 0,
      month: j['month'] as String? ?? '',
      totalManhours: i(j['totalManhours'] ?? j['manhours']),
      totalWorkers: i(j['totalWorkers'] ?? j['workers']),
      tbmCount: i(j['tbmCount'] ?? j['tbm']),
      remarks: j['remarks'] as String?,
      recordedAt: j['recordedAt'] == null ? null : DateTime.tryParse(j['recordedAt'].toString()),
    );
  }

  @override
  List<Object?> get props => [id, month, totalManhours];
}

// ============================================================
// EHS TRAINING
// ============================================================

class EhsTrainingRecord extends Equatable {
  final int id;
  final String trainingType;   // INDUCTION | SKILL | REFRESHER | CERTIFICATION
  final String topic;
  final String? trainerName;
  final int participantCount;
  final String? trainingDate;
  final String? expiryDate;
  final String status;         // COMPLETED | SCHEDULED | EXPIRED
  final String? remarks;

  const EhsTrainingRecord({
    required this.id,
    required this.trainingType,
    required this.topic,
    this.trainerName,
    this.participantCount = 0,
    this.trainingDate,
    this.expiryDate,
    this.status = 'COMPLETED',
    this.remarks,
  });

  factory EhsTrainingRecord.fromJson(Map<String, dynamic> j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    return EhsTrainingRecord(
      id: j['id'] as int? ?? 0,
      trainingType: j['trainingType'] as String? ?? j['type'] as String? ?? 'INDUCTION',
      topic: j['topic'] as String? ?? j['title'] as String? ?? '',
      trainerName: j['trainerName'] as String?,
      participantCount: i(j['participantCount'] ?? j['participants']),
      trainingDate: j['trainingDate'] as String?,
      expiryDate: j['expiryDate'] as String?,
      status: j['status'] as String? ?? 'COMPLETED',
      remarks: j['remarks'] as String?,
    );
  }

  bool get isExpired => expiryDate != null &&
      DateTime.tryParse(expiryDate!)?.isBefore(DateTime.now()) == true;

  Color get statusColor {
    if (isExpired || status == 'EXPIRED') return const Color(0xFFDC2626);
    if (status == 'SCHEDULED') return const Color(0xFF1D4ED8);
    return const Color(0xFF15803D);
  }

  @override
  List<Object?> get props => [id, trainingType, topic, status];
}

// ============================================================
// EHS LEGAL COMPLIANCE
// ============================================================

class EhsLegalItem extends Equatable {
  final int id;
  final String licenseType;    // LABOUR_LICENSE | FACTORY_LICENSE | FIRE_NOC | POLLUTION_NOC | etc.
  final String description;
  final String? licenseNumber;
  final String? issuingAuthority;
  final String? issueDate;
  final String? expiryDate;
  final String status;         // VALID | EXPIRING_SOON | EXPIRED | PENDING_RENEWAL
  final String? documentUrl;
  final String? remarks;

  const EhsLegalItem({
    required this.id,
    required this.licenseType,
    required this.description,
    this.licenseNumber,
    this.issuingAuthority,
    this.issueDate,
    this.expiryDate,
    this.status = 'VALID',
    this.documentUrl,
    this.remarks,
  });

  factory EhsLegalItem.fromJson(Map<String, dynamic> j) => EhsLegalItem(
    id: j['id'] as int? ?? 0,
    licenseType: j['licenseType'] as String? ?? j['type'] as String? ?? '',
    description: j['description'] as String? ?? j['title'] as String? ?? '',
    licenseNumber: j['licenseNumber'] as String?,
    issuingAuthority: j['issuingAuthority'] as String?,
    issueDate: j['issueDate'] as String?,
    expiryDate: j['expiryDate'] as String?,
    status: j['status'] as String? ?? 'VALID',
    documentUrl: j['documentUrl'] as String?,
    remarks: j['remarks'] as String?,
  );

  bool get isExpired {
    if (expiryDate == null) return false;
    return DateTime.tryParse(expiryDate!)?.isBefore(DateTime.now()) == true;
  }

  bool get isExpiringSoon {
    if (expiryDate == null) return false;
    final dt = DateTime.tryParse(expiryDate!);
    if (dt == null) return false;
    final daysLeft = dt.difference(DateTime.now()).inDays;
    return daysLeft >= 0 && daysLeft <= 30;
  }

  Color get statusColor => switch (status.toUpperCase()) {
    'EXPIRED' => const Color(0xFFDC2626),
    'EXPIRING_SOON' => const Color(0xFFF59E0B),
    'PENDING_RENEWAL' => const Color(0xFF1D4ED8),
    _ => const Color(0xFF15803D),
  };

  @override
  List<Object?> get props => [id, licenseType, status, expiryDate];
}

// ============================================================
// EHS MACHINERY
// ============================================================

class EhsMachineryRecord extends Equatable {
  final int id;
  final String machineryType;
  final String? machineName;
  final String? equipmentId;
  final String? operator_;
  final String inspectionDate;
  final String? nextInspectionDate;
  final String status;         // FIT | UNFIT | UNDER_REPAIR
  final String? fitnessCertNo;
  final String? remarks;

  const EhsMachineryRecord({
    required this.id,
    required this.machineryType,
    this.machineName,
    this.equipmentId,
    this.operator_,
    required this.inspectionDate,
    this.nextInspectionDate,
    this.status = 'FIT',
    this.fitnessCertNo,
    this.remarks,
  });

  factory EhsMachineryRecord.fromJson(Map<String, dynamic> j) => EhsMachineryRecord(
    id: j['id'] as int? ?? 0,
    machineryType: j['machineryType'] as String? ?? j['type'] as String? ?? '',
    machineName: j['machineName'] as String? ?? j['name'] as String?,
    equipmentId: j['equipmentId'] as String?,
    operator_: j['operator'] as String?,
    inspectionDate: j['inspectionDate'] as String? ?? '',
    nextInspectionDate: j['nextInspectionDate'] as String?,
    status: j['status'] as String? ?? 'FIT',
    fitnessCertNo: j['fitnessCertNo'] as String?,
    remarks: j['remarks'] as String?,
  );

  Color get statusColor => switch (status.toUpperCase()) {
    'UNFIT' => const Color(0xFFDC2626),
    'UNDER_REPAIR' => const Color(0xFFF59E0B),
    _ => const Color(0xFF15803D),
  };

  @override
  List<Object?> get props => [id, machineryType, status, inspectionDate];
}

// ============================================================
// EHS VEHICLES
// ============================================================

class EhsVehicleRecord extends Equatable {
  final int id;
  final String vehicleType;
  final String? vehicleNumber;
  final String? driverName;
  final String? driverLicense;
  final String? pucExpiryDate;
  final String? insuranceExpiryDate;
  final String? fitnessExpiryDate;
  final String status;         // ACTIVE | INACTIVE | UNDER_MAINTENANCE
  final String? remarks;
  final DateTime? recordedAt;

  const EhsVehicleRecord({
    required this.id,
    required this.vehicleType,
    this.vehicleNumber,
    this.driverName,
    this.driverLicense,
    this.pucExpiryDate,
    this.insuranceExpiryDate,
    this.fitnessExpiryDate,
    this.status = 'ACTIVE',
    this.remarks,
    this.recordedAt,
  });

  factory EhsVehicleRecord.fromJson(Map<String, dynamic> j) => EhsVehicleRecord(
    id: j['id'] as int? ?? 0,
    vehicleType: j['vehicleType'] as String? ?? j['type'] as String? ?? '',
    vehicleNumber: j['vehicleNumber'] as String? ?? j['number'] as String?,
    driverName: j['driverName'] as String?,
    driverLicense: j['driverLicense'] as String?,
    pucExpiryDate: j['pucExpiryDate'] as String?,
    insuranceExpiryDate: j['insuranceExpiryDate'] as String?,
    fitnessExpiryDate: j['fitnessExpiryDate'] as String?,
    status: j['status'] as String? ?? 'ACTIVE',
    remarks: j['remarks'] as String?,
    recordedAt: j['recordedAt'] == null ? null : DateTime.tryParse(j['recordedAt'].toString()),
  );

  bool get hasExpiringDocs {
    final now = DateTime.now();
    for (final dateStr in [pucExpiryDate, insuranceExpiryDate, fitnessExpiryDate]) {
      if (dateStr == null) continue;
      final dt = DateTime.tryParse(dateStr);
      if (dt != null && dt.difference(now).inDays <= 30) return true;
    }
    return false;
  }

  Color get statusColor => switch (status.toUpperCase()) {
    'INACTIVE' => const Color(0xFF6B7280),
    'UNDER_MAINTENANCE' => const Color(0xFFF59E0B),
    _ => const Color(0xFF15803D),
  };

  @override
  List<Object?> get props => [id, vehicleType, vehicleNumber, status];
}
