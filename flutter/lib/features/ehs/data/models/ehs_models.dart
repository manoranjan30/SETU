import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';

// ==================== ENUMS ====================

/// Lifecycle status of an EHS site-level safety observation.
enum EhsObsStatus {
  open,
  rectified,
  closed;

  /// Parse from the backend string value — defaults to [open].
  static EhsObsStatus fromString(String v) {
    switch (v.toUpperCase()) {
      case 'RECTIFIED':
        return EhsObsStatus.rectified;
      case 'CLOSED':
        return EhsObsStatus.closed;
      default:
        return EhsObsStatus.open;
    }
  }

  String get label {
    switch (this) {
      case EhsObsStatus.open:
        return 'Open';
      case EhsObsStatus.rectified:
        return 'Rectified';
      case EhsObsStatus.closed:
        return 'Closed';
    }
  }

  Color get color {
    switch (this) {
      case EhsObsStatus.open:
        return const Color(0xFFDC2626); // Red — requires attention
      case EhsObsStatus.rectified:
        return const Color(0xFF2563EB); // Blue — fix submitted, awaiting closure
      case EhsObsStatus.closed:
        return const Color(0xFF16A34A); // Green — fully resolved
    }
  }
}

/// EHS safety observation categories with associated icons.
///
/// Used to classify the type of unsafe act or condition being reported.
/// All category labels are accessible via [EhsCategory.allLabels] for
/// use in the category picker dropdown.
enum EhsCategory {
  ppe,
  housekeeping,
  scaffold,
  electrical,
  fire,
  chemical,
  excavation,
  machinery,
  fall,
  other;

  /// Human-readable category name shown in the UI.
  String get label {
    switch (this) {
      case EhsCategory.ppe:
        return 'PPE';
      case EhsCategory.housekeeping:
        return 'Housekeeping';
      case EhsCategory.scaffold:
        return 'Scaffolding';
      case EhsCategory.electrical:
        return 'Electrical';
      case EhsCategory.fire:
        return 'Fire Safety';
      case EhsCategory.chemical:
        return 'Chemical';
      case EhsCategory.excavation:
        return 'Excavation';
      case EhsCategory.machinery:
        return 'Machinery';
      case EhsCategory.fall:
        return 'Fall Protection';
      case EhsCategory.other:
        return 'Other';
    }
  }

  /// Material icon associated with this EHS category.
  IconData get icon {
    switch (this) {
      case EhsCategory.ppe:
        return Icons.safety_divider_rounded;
      case EhsCategory.housekeeping:
        return Icons.cleaning_services_outlined;
      case EhsCategory.scaffold:
        return Icons.foundation_outlined;
      case EhsCategory.electrical:
        return Icons.electrical_services_outlined;
      case EhsCategory.fire:
        return Icons.local_fire_department_outlined;
      case EhsCategory.chemical:
        return Icons.science_outlined;
      case EhsCategory.excavation:
        return Icons.terrain_outlined;
      case EhsCategory.machinery:
        return Icons.precision_manufacturing_outlined;
      case EhsCategory.fall:
        return Icons.warning_amber_rounded;
      case EhsCategory.other:
        return Icons.category_outlined;
    }
  }

  /// Parse from a backend category string.
  /// Handles both the short form ('scaffold') and the long form ('scaffolding').
  /// Defaults to [other] for unrecognised values.
  static EhsCategory fromString(String v) {
    switch (v.toLowerCase()) {
      case 'ppe':
        return EhsCategory.ppe;
      case 'housekeeping':
        return EhsCategory.housekeeping;
      case 'scaffold':
      case 'scaffolding':
        return EhsCategory.scaffold;
      case 'electrical':
        return EhsCategory.electrical;
      case 'fire':
      case 'fire safety':
        return EhsCategory.fire;
      case 'chemical':
        return EhsCategory.chemical;
      case 'excavation':
        return EhsCategory.excavation;
      case 'machinery':
        return EhsCategory.machinery;
      case 'fall':
      case 'fall protection':
        return EhsCategory.fall;
      default:
        return EhsCategory.other;
    }
  }

  /// All category label strings for use in UI pickers.
  static List<String> get allLabels =>
      EhsCategory.values.map((e) => e.label).toList();
}

// ==================== MODEL ====================

/// An EHS safety observation (unsafe act or unsafe condition).
///
/// Lifecycle: open → rectified (by person responsible) → closed (by EHS officer).
/// Photo URLs are resolved to absolute paths at parse time.
/// [categoryEnum] is lazily derived from the raw [category] string.
class EhsSiteObservation extends Equatable {
  final String id; // UUID from backend
  final int projectId;
  final int? epsNodeId;
  final String description;
  final String severity; // INFO | MINOR | MAJOR | CRITICAL (DB enum)
  final String? category;
  final String? locationLabel;
  final EhsObsStatus status;
  final List<String> photoUrls;
  final String? raisedByName;
  final String? rectificationNotes;
  final List<String> rectificationPhotoUrls;
  final String? closureNotes;
  final DateTime createdAt;
  final DateTime? rectifiedAt;
  final DateTime? closedAt;

  const EhsSiteObservation({
    required this.id,
    required this.projectId,
    this.epsNodeId,
    required this.description,
    required this.severity,
    this.category,
    this.locationLabel,
    required this.status,
    this.photoUrls = const [],
    this.raisedByName,
    this.rectificationNotes,
    this.rectificationPhotoUrls = const [],
    this.closureNotes,
    required this.createdAt,
    this.rectifiedAt,
    this.closedAt,
  });

  factory EhsSiteObservation.fromJson(Map<String, dynamic> json) {
    // Resolve relative photo paths to absolute URLs.
    List<String> resolvePhotos(dynamic raw) {
      if (raw == null) return const [];
      return (raw as List<dynamic>)
          .map((e) => ApiEndpoints.resolveUrl(e.toString()))
          .toList();
    }

    // Parse date from null, DateTime, or ISO string.
    DateTime? parseDate(dynamic raw) {
      if (raw == null || raw == '') return null;
      if (raw is DateTime) return raw;
      return DateTime.tryParse(raw.toString());
    }

    // raisedBy may be a nested user object or a flat name string.
    final raisedBy = json['raisedBy'] as Map<String, dynamic>?;
    return EhsSiteObservation(
      id: json['id'].toString(),
      projectId: json['projectId'] as int? ?? 0,
      epsNodeId: json['epsNodeId'] as int?,
      description: json['description'] as String? ?? '',
      severity: json['severity'] as String? ?? 'MINOR',
      category: json['category'] as String?,
      locationLabel: json['locationLabel'] as String?,
      status: EhsObsStatus.fromString(json['status'] as String? ?? 'OPEN'),
      // Support both 'photoUrls' and legacy 'photos' field names.
      photoUrls: resolvePhotos(json['photoUrls'] ?? json['photos']),
      raisedByName:
          raisedBy?['name'] as String? ?? json['raisedByName'] as String?,
      rectificationNotes: json['rectificationNotes'] as String?,
      rectificationPhotoUrls: resolvePhotos(
          json['rectificationPhotoUrls'] ?? json['rectificationPhotos']),
      closureNotes: json['closureNotes'] as String?,
      createdAt: parseDate(json['createdAt']) ?? DateTime.now(),
      rectifiedAt: parseDate(json['rectifiedAt']),
      closedAt: parseDate(json['closedAt']),
    );
  }

  bool get isOpen => status == EhsObsStatus.open;
  bool get isRectified => status == EhsObsStatus.rectified;
  bool get isClosed => status == EhsObsStatus.closed;

  /// Derives the typed [EhsCategory] enum from the raw category string.
  /// Defaults to [EhsCategory.other] if category is null or unrecognised.
  EhsCategory get categoryEnum =>
      category != null ? EhsCategory.fromString(category!) : EhsCategory.other;

  @override
  List<Object?> get props => [id, projectId, description, severity, status, createdAt];
}

// ==================== EHS INCIDENT ====================

/// Classification of an EHS incident by severity and type.
///
/// Based on the standard industry hierarchy:
///   nearMiss < FAC < MTC < LTI (increasing severity)
///   propertyDamage and environmental are separate categories.
enum IncidentType {
  nearMiss,
  fac,           // First Aid Case
  mtc,           // Medical Treatment Case
  lti,           // Lost Time Injury
  propertyDamage,
  environmental;

  /// Human-readable label for the incident type picker.
  String get label {
    switch (this) {
      case IncidentType.nearMiss:
        return 'Near Miss';
      case IncidentType.fac:
        return 'First Aid Case';
      case IncidentType.mtc:
        return 'Medical Treatment';
      case IncidentType.lti:
        return 'Lost Time Injury';
      case IncidentType.propertyDamage:
        return 'Property Damage';
      case IncidentType.environmental:
        return 'Environmental';
    }
  }

  /// Colour coding for the incident type badge.
  Color get color {
    switch (this) {
      case IncidentType.nearMiss:
        return const Color(0xFFF59E0B); // Amber — warning
      case IncidentType.fac:
        return const Color(0xFF3B82F6); // Blue
      case IncidentType.mtc:
        return const Color(0xFFEF4444); // Red
      case IncidentType.lti:
        return const Color(0xFF7C3AED); // Purple — most severe
      case IncidentType.propertyDamage:
        return const Color(0xFF6B7280); // Grey
      case IncidentType.environmental:
        return const Color(0xFF10B981); // Green
    }
  }

  /// Parse from the backend enum string (case-insensitive).
  static IncidentType fromString(String v) {
    switch (v.toUpperCase()) {
      case 'NEAR_MISS':
        return IncidentType.nearMiss;
      case 'FAC':
        return IncidentType.fac;
      case 'MTC':
        return IncidentType.mtc;
      case 'LTI':
        return IncidentType.lti;
      case 'PROPERTY_DAMAGE':
        return IncidentType.propertyDamage;
      case 'ENVIRONMENTAL':
        return IncidentType.environmental;
      default:
        return IncidentType.nearMiss;
    }
  }

  /// The exact string value sent to the API (matches the backend DB enum).
  String get apiValue {
    switch (this) {
      case IncidentType.nearMiss:
        return 'NEAR_MISS';
      case IncidentType.fac:
        return 'FAC';
      case IncidentType.mtc:
        return 'MTC';
      case IncidentType.lti:
        return 'LTI';
      case IncidentType.propertyDamage:
        return 'PROPERTY_DAMAGE';
      case IncidentType.environmental:
        return 'ENVIRONMENTAL';
    }
  }
}

/// Investigation/closure status of an EHS incident.
enum IncidentStatus {
  reported,
  investigating,
  closed;

  String get label {
    switch (this) {
      case IncidentStatus.reported:
        return 'Reported';
      case IncidentStatus.investigating:
        return 'Investigating';
      case IncidentStatus.closed:
        return 'Closed';
    }
  }

  Color get color {
    switch (this) {
      case IncidentStatus.reported:
        return const Color(0xFFEF4444); // Red — newly reported
      case IncidentStatus.investigating:
        return const Color(0xFFF59E0B); // Amber — under investigation
      case IncidentStatus.closed:
        return const Color(0xFF16A34A); // Green — fully closed
    }
  }

  /// Parse from the backend string value — defaults to [reported].
  static IncidentStatus fromString(String v) {
    switch (v.toUpperCase()) {
      case 'INVESTIGATING':
        return IncidentStatus.investigating;
      case 'CLOSED':
        return IncidentStatus.closed;
      default:
        return IncidentStatus.reported;
    }
  }
}

/// A recorded EHS incident on a construction site.
///
/// Covers near-misses through to Lost Time Injuries and environmental incidents.
/// [affectedPersons] is a list of names (not IDs) — entered free-form at time
/// of reporting. Root cause analysis ([rootCause]) is typically added during
/// the investigation phase by the EHS officer.
class EhsIncident extends Equatable {
  final int id;
  final int projectId;
  final String incidentDate;
  final IncidentType incidentType;
  final String location;
  final String description;
  final IncidentStatus status;
  final List<String> affectedPersons;
  final String? immediateCause;

  /// Root cause — filled in after investigation, may be null on initial report.
  final String? rootCause;
  final bool firstAidGiven;
  final bool hospitalVisit;

  /// Relevant for LTI incidents — number of work days lost.
  final int daysLost;
  final List<String> photoUrls;
  final DateTime createdAt;

  const EhsIncident({
    required this.id,
    required this.projectId,
    required this.incidentDate,
    required this.incidentType,
    required this.location,
    required this.description,
    required this.status,
    this.affectedPersons = const [],
    this.immediateCause,
    this.rootCause,
    this.firstAidGiven = false,
    this.hospitalVisit = false,
    this.daysLost = 0,
    this.photoUrls = const [],
    required this.createdAt,
  });

  factory EhsIncident.fromJson(Map<String, dynamic> json) {
    // Parse a list field that may be null or a JSON array.
    List<String> parseList(dynamic raw) {
      if (raw == null) return const [];
      if (raw is List) return raw.map((e) => e.toString()).toList();
      return const [];
    }

    return EhsIncident(
      id: json['id'] as int? ?? 0,
      projectId: json['projectId'] as int? ?? 0,
      incidentDate: json['incidentDate'] as String? ?? '',
      incidentType:
          IncidentType.fromString(json['incidentType'] as String? ?? ''),
      location: json['location'] as String? ?? '',
      description: json['description'] as String? ?? '',
      status:
          IncidentStatus.fromString(json['status'] as String? ?? 'REPORTED'),
      affectedPersons: parseList(json['affectedPersons']),
      immediateCause: json['immediateCause'] as String?,
      rootCause: json['rootCause'] as String?,
      firstAidGiven: json['firstAidGiven'] as bool? ?? false,
      hospitalVisit: json['hospitalVisit'] as bool? ?? false,
      // daysLost may come as a number — convert to int safely.
      daysLost: (json['daysLost'] as num?)?.toInt() ?? 0,
      photoUrls: parseList(json['photoUrls']),
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  @override
  List<Object?> get props =>
      [id, projectId, incidentDate, incidentType, status];
}
