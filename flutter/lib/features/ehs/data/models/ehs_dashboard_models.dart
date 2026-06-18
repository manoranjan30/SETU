import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

// ============================================================
// EHS SUMMARY (Overview tab)
// ============================================================
//
// Mirrors the EXACT nested shape returned by the backend's
// `GET /ehs/:projectId/summary` (see backend EhsService.getSummary) — the
// backend does not return flat KPI fields, it returns per-domain stat
// blocks (incidents, legal, machinery, vehicle, competency, inspections,
// training) plus two cumulative manhour totals.

class EhsCountStats extends Equatable {
  final int total;
  final int fatal;
  final int major;
  final int minor;
  final int firstAid;
  final int nearMiss;
  final int dangerous;

  const EhsCountStats({
    this.total = 0,
    this.fatal = 0,
    this.major = 0,
    this.minor = 0,
    this.firstAid = 0,
    this.nearMiss = 0,
    this.dangerous = 0,
  });

  factory EhsCountStats.fromJson(Map<String, dynamic>? j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    if (j == null) return const EhsCountStats();
    return EhsCountStats(
      total: i(j['total']),
      fatal: i(j['fatal']),
      major: i(j['major']),
      minor: i(j['minor']),
      firstAid: i(j['firstAid']),
      nearMiss: i(j['nearMiss']),
      dangerous: i(j['dangerous']),
    );
  }

  @override
  List<Object?> get props => [total, fatal, major, minor, firstAid, nearMiss, dangerous];
}

/// Used for legal / machinery / vehicle / competency compliance blocks —
/// all four share the same {total, expired, expiringSoon, valid} shape.
class EhsComplianceStats extends Equatable {
  final int total;
  final int expired;
  final int expiringSoon;
  final int valid;

  const EhsComplianceStats({
    this.total = 0,
    this.expired = 0,
    this.expiringSoon = 0,
    this.valid = 0,
  });

  factory EhsComplianceStats.fromJson(Map<String, dynamic>? j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    if (j == null) return const EhsComplianceStats();
    return EhsComplianceStats(
      total: i(j['total']),
      expired: i(j['expired']),
      expiringSoon: i(j['expiringSoon']),
      valid: i(j['valid']),
    );
  }

  @override
  List<Object?> get props => [total, expired, expiringSoon, valid];
}

class EhsInspectionStats extends Equatable {
  final int total;
  final int completed;
  final int pending;
  final int overdue;

  const EhsInspectionStats({
    this.total = 0,
    this.completed = 0,
    this.pending = 0,
    this.overdue = 0,
  });

  factory EhsInspectionStats.fromJson(Map<String, dynamic>? j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    if (j == null) return const EhsInspectionStats();
    return EhsInspectionStats(
      total: i(j['total']),
      completed: i(j['completed']),
      pending: i(j['pending']),
      overdue: i(j['overdue']),
    );
  }

  @override
  List<Object?> get props => [total, completed, pending, overdue];
}

class EhsTrainingStats extends Equatable {
  final int total;
  final int participants;

  const EhsTrainingStats({this.total = 0, this.participants = 0});

  factory EhsTrainingStats.fromJson(Map<String, dynamic>? j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    if (j == null) return const EhsTrainingStats();
    return EhsTrainingStats(total: i(j['total']), participants: i(j['participants']));
  }

  @override
  List<Object?> get props => [total, participants];
}

class EhsSummary extends Equatable {
  final double cumulativeSafeManhours;
  final double cumulativeManpower;
  final EhsCountStats incidents;
  final EhsComplianceStats legal;
  final EhsComplianceStats machinery;
  final EhsComplianceStats vehicle;
  final EhsComplianceStats competency;
  final EhsInspectionStats inspections;
  final EhsTrainingStats training;

  const EhsSummary({
    this.cumulativeSafeManhours = 0,
    this.cumulativeManpower = 0,
    this.incidents = const EhsCountStats(),
    this.legal = const EhsComplianceStats(),
    this.machinery = const EhsComplianceStats(),
    this.vehicle = const EhsComplianceStats(),
    this.competency = const EhsComplianceStats(),
    this.inspections = const EhsInspectionStats(),
    this.training = const EhsTrainingStats(),
  });

  factory EhsSummary.fromJson(Map<String, dynamic> j) {
    double d(dynamic v) => v == null ? 0.0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0.0);
    return EhsSummary(
      cumulativeSafeManhours: d(j['cumulativeSafeManhours']),
      cumulativeManpower: d(j['cumulativeManpower']),
      incidents: EhsCountStats.fromJson(j['incidents'] as Map<String, dynamic>?),
      legal: EhsComplianceStats.fromJson(j['legal'] as Map<String, dynamic>?),
      machinery: EhsComplianceStats.fromJson(j['machinery'] as Map<String, dynamic>?),
      vehicle: EhsComplianceStats.fromJson(j['vehicle'] as Map<String, dynamic>?),
      competency: EhsComplianceStats.fromJson(j['competency'] as Map<String, dynamic>?),
      inspections: EhsInspectionStats.fromJson(j['inspections'] as Map<String, dynamic>?),
      training: EhsTrainingStats.fromJson(j['training'] as Map<String, dynamic>?),
    );
  }

  @override
  List<Object?> get props => [
        cumulativeSafeManhours,
        cumulativeManpower,
        incidents,
        legal,
        machinery,
        vehicle,
        competency,
        inspections,
        training,
      ];
}

// ============================================================
// EHS PERFORMANCE (Performance tab)
// ============================================================
//
// `GET /ehs/:projectId/performance` returns an ARRAY of monthly records
// (one EhsPerformance row per month), each holding just an EHS rating and
// a housekeeping rating out of (typically) 5 or 10 — there is no
// TRIFR/LTI/near-miss-rate field on the backend.

class EhsPerformanceRecord extends Equatable {
  final int id;
  final String month; // 'YYYY-MM-DD' (first of month)
  final double ehsRating;
  final double housekeepingRating;

  const EhsPerformanceRecord({
    required this.id,
    required this.month,
    this.ehsRating = 0,
    this.housekeepingRating = 0,
  });

  factory EhsPerformanceRecord.fromJson(Map<String, dynamic> j) {
    double d(dynamic v) => v == null ? 0.0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0.0);
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    return EhsPerformanceRecord(
      id: i(j['id']),
      month: j['month'] as String? ?? '',
      ehsRating: d(j['ehsRating']),
      housekeepingRating: d(j['housekeepingRating']),
    );
  }

  @override
  List<Object?> get props => [id, month, ehsRating, housekeepingRating];
}

// ============================================================
// EHS MANHOURS
// ============================================================
//
// Field names mirror the `EhsManhours` entity exactly.

class EhsManhoursRecord extends Equatable {
  final int id;
  final String month; // e.g. "2026-05-01"
  final int staffMale;
  final int staffFemale;
  final int workersMale;
  final int workersFemale;
  final int totalWorkers;
  final int totalManpower;
  final int workingDays;
  final double avgWorkHours;
  final double totalManhours;
  final double ltiDeductions;
  final double safeManhours;
  final String? remarks;

  const EhsManhoursRecord({
    required this.id,
    required this.month,
    this.staffMale = 0,
    this.staffFemale = 0,
    this.workersMale = 0,
    this.workersFemale = 0,
    this.totalWorkers = 0,
    this.totalManpower = 0,
    this.workingDays = 0,
    this.avgWorkHours = 0,
    this.totalManhours = 0,
    this.ltiDeductions = 0,
    this.safeManhours = 0,
    this.remarks,
  });

  factory EhsManhoursRecord.fromJson(Map<String, dynamic> j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    double d(dynamic v) => v == null ? 0.0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0.0);
    return EhsManhoursRecord(
      id: i(j['id']),
      month: j['month'] as String? ?? '',
      staffMale: i(j['staffMale']),
      staffFemale: i(j['staffFemale']),
      workersMale: i(j['workersMale']),
      workersFemale: i(j['workersFemale']),
      totalWorkers: i(j['totalWorkers']),
      totalManpower: i(j['totalManpower']),
      workingDays: i(j['workingDays']),
      avgWorkHours: d(j['avgWorkHours']),
      totalManhours: d(j['totalManhours']),
      ltiDeductions: d(j['ltiDeductions']),
      safeManhours: d(j['safeManhours']),
      remarks: j['remarks'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, month, totalManhours, totalWorkers];
}

// ============================================================
// EHS TRAINING
// ============================================================
//
// Field names mirror the `EhsTraining` entity exactly (note: `trainer`,
// `attendeeCount`, `date` — not `trainerName`/`participantCount`/
// `trainingDate`, and there is no `expiryDate`/expiry concept here).

class EhsTrainingRecord extends Equatable {
  final int id;
  final String trainingType; // INDUCTION | TBT | SPECIALIZED | FIRE_DRILL | FIRST_AID
  final String status;       // defaults to 'Completed'
  final String date;
  final String topic;
  final String trainer;
  final int attendeeCount;
  final List<String> attendeeNames;
  final int duration; // minutes
  final String? remarks;

  const EhsTrainingRecord({
    required this.id,
    required this.trainingType,
    this.status = 'Completed',
    required this.date,
    required this.topic,
    required this.trainer,
    this.attendeeCount = 0,
    this.attendeeNames = const [],
    this.duration = 0,
    this.remarks,
  });

  factory EhsTrainingRecord.fromJson(Map<String, dynamic> j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    return EhsTrainingRecord(
      id: i(j['id']),
      trainingType: j['trainingType'] as String? ?? 'INDUCTION',
      status: j['status'] as String? ?? 'Completed',
      date: j['date'] as String? ?? '',
      topic: j['topic'] as String? ?? '',
      trainer: j['trainer'] as String? ?? '',
      attendeeCount: i(j['attendeeCount']),
      attendeeNames: (j['attendeeNames'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      duration: i(j['duration']),
      remarks: j['remarks'] as String?,
    );
  }

  Color get statusColor => switch (status.toUpperCase()) {
        'EXPIRED' => const Color(0xFFDC2626),
        'SCHEDULED' => const Color(0xFF1D4ED8),
        _ => const Color(0xFF15803D),
      };

  @override
  List<Object?> get props => [id, trainingType, topic, status, date];
}

// ============================================================
// EHS LEGAL COMPLIANCE
// ============================================================
//
// Field names mirror the `EhsLegalRegister` entity exactly — the backend
// has no `licenseType`/`licenseNumber` columns, it tracks a freeform
// `requirement` and a `responsibility` (the party accountable for it).

class EhsLegalItem extends Equatable {
  final int id;
  final String requirement;
  final String responsibility;
  final String status; // Valid | Expired | Expiring Soon
  final String? certifiedDate;
  final String? expiryDate;
  final String? remarks;

  const EhsLegalItem({
    required this.id,
    required this.requirement,
    required this.responsibility,
    this.status = 'Valid',
    this.certifiedDate,
    this.expiryDate,
    this.remarks,
  });

  factory EhsLegalItem.fromJson(Map<String, dynamic> j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    return EhsLegalItem(
      id: i(j['id']),
      requirement: j['requirement'] as String? ?? '',
      responsibility: j['responsibility'] as String? ?? '',
      status: j['status'] as String? ?? 'Valid',
      certifiedDate: j['certifiedDate'] as String?,
      expiryDate: j['expiryDate'] as String?,
      remarks: j['remarks'] as String?,
    );
  }

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
        'EXPIRING SOON' => const Color(0xFFF59E0B),
        _ => const Color(0xFF15803D),
      };

  @override
  List<Object?> get props => [id, requirement, status, expiryDate];
}

// ============================================================
// EHS MACHINERY
// ============================================================
//
// Field names mirror the `EhsMachinery` entity exactly.

class EhsMachineryRecord extends Equatable {
  final int id;
  final String equipmentName;
  final String idNumber;
  final String location;
  final String? certifiedDate;
  final String? expiryDate;
  final String status; // defaults to 'Valid'
  final bool isActive;
  final String? remarks;

  const EhsMachineryRecord({
    required this.id,
    required this.equipmentName,
    required this.idNumber,
    required this.location,
    this.certifiedDate,
    this.expiryDate,
    this.status = 'Valid',
    this.isActive = true,
    this.remarks,
  });

  factory EhsMachineryRecord.fromJson(Map<String, dynamic> j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    return EhsMachineryRecord(
      id: i(j['id']),
      equipmentName: j['equipmentName'] as String? ?? '',
      idNumber: j['idNumber'] as String? ?? '',
      location: j['location'] as String? ?? '',
      certifiedDate: j['certifiedDate'] as String?,
      expiryDate: j['expiryDate'] as String?,
      status: j['status'] as String? ?? 'Valid',
      isActive: j['isActive'] as bool? ?? true,
      remarks: j['remarks'] as String?,
    );
  }

  Color get statusColor => switch (status.toUpperCase()) {
        'EXPIRED' => const Color(0xFFDC2626),
        'EXPIRING SOON' => const Color(0xFFF59E0B),
        _ => const Color(0xFF15803D),
      };

  @override
  List<Object?> get props => [id, equipmentName, status, expiryDate];
}

// ============================================================
// EHS VEHICLES
// ============================================================
//
// Field names mirror the `EhsVehicle` entity exactly — there is no
// driver-related column on the backend.

class EhsVehicleRecord extends Equatable {
  final int id;
  final String vehicleNumber;
  final String vehicleType;
  final String? fitnessCertDate;
  final String? insuranceDate;
  final String? pollutionDate;
  final String? remarks;
  final bool isActive;

  const EhsVehicleRecord({
    required this.id,
    required this.vehicleNumber,
    required this.vehicleType,
    this.fitnessCertDate,
    this.insuranceDate,
    this.pollutionDate,
    this.remarks,
    this.isActive = true,
  });

  factory EhsVehicleRecord.fromJson(Map<String, dynamic> j) {
    int i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
    return EhsVehicleRecord(
      id: i(j['id']),
      vehicleNumber: j['vehicleNumber'] as String? ?? '',
      vehicleType: j['vehicleType'] as String? ?? '',
      fitnessCertDate: j['fitnessCertDate'] as String?,
      insuranceDate: j['insuranceDate'] as String?,
      pollutionDate: j['pollutionDate'] as String?,
      remarks: j['remarks'] as String?,
      isActive: j['isActive'] as bool? ?? true,
    );
  }

  bool get hasExpiringDocs {
    final now = DateTime.now();
    for (final dateStr in [fitnessCertDate, insuranceDate, pollutionDate]) {
      if (dateStr == null) continue;
      final dt = DateTime.tryParse(dateStr);
      if (dt != null && dt.difference(now).inDays <= 30) return true;
    }
    return false;
  }

  Color get statusColor => isActive ? const Color(0xFF15803D) : const Color(0xFF6B7280);

  @override
  List<Object?> get props => [id, vehicleNumber, vehicleType, isActive];
}
