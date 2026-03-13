import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';

// ==================== ENUMS ====================

enum EhsObsStatus {
  open,
  rectified,
  closed;

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
        return const Color(0xFFDC2626);
      case EhsObsStatus.rectified:
        return const Color(0xFF2563EB);
      case EhsObsStatus.closed:
        return const Color(0xFF16A34A);
    }
  }
}

/// EHS observation categories with icons and colors.
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
    List<String> resolvePhotos(dynamic raw) {
      if (raw == null) return const [];
      return (raw as List<dynamic>)
          .map((e) => ApiEndpoints.resolveUrl(e.toString()))
          .toList();
    }

    DateTime? parseDate(dynamic raw) {
      if (raw == null || raw == '') return null;
      if (raw is DateTime) return raw;
      return DateTime.tryParse(raw.toString());
    }

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

  EhsCategory get categoryEnum =>
      category != null ? EhsCategory.fromString(category!) : EhsCategory.other;

  @override
  List<Object?> get props => [id, projectId, description, severity, status, createdAt];
}
