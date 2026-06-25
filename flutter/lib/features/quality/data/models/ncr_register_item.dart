/// A single row from the unified Observation/NCR register
/// (`quality_observations_ncr` table). The NC Register screen shows only
/// rows where [type] == `'NCR'` — the same table also holds plain
/// `'Observation'` rows used elsewhere, which mobile does not surface here.
///
/// Mirrors `QualityObservationNcr` (`backend/src/quality/entities/quality-observation-ncr.entity.ts`).
class NcrRegisterItem {
  final int id;
  final int projectId;
  final String type; // Observation | NCR
  final String severity; // Critical | Major | Minor
  final String category;
  final String issueDescription;
  final String? location;
  final String reportedDate;
  final String reportedBy;
  final String? assignedTo;
  final String status; // Open | In Progress | Resolved | Verified | Closed
  final String? rootCause;
  final String? correctiveAction;
  final String? targetDate;
  final String? closedDate;
  final String? attachmentUrl;

  /// QUALITY_SITE_OBSERVATION | QUALITY_CHECKLIST_OBSERVATION — which
  /// mobile flow auto-created this NCR.
  final String? sourceType;
  final String? sourceId;

  /// Human-readable pointer back to the originating observation, e.g.
  /// "Quality Site Observation 42" or "RFI #161 / GO 2" — shown prominently
  /// per the handoff spec.
  final String? sourceReference;

  const NcrRegisterItem({
    required this.id,
    required this.projectId,
    required this.type,
    required this.severity,
    required this.category,
    required this.issueDescription,
    this.location,
    required this.reportedDate,
    required this.reportedBy,
    this.assignedTo,
    required this.status,
    this.rootCause,
    this.correctiveAction,
    this.targetDate,
    this.closedDate,
    this.attachmentUrl,
    this.sourceType,
    this.sourceId,
    this.sourceReference,
  });

  bool get isLinkedToObservation => sourceType != null && sourceId != null;

  factory NcrRegisterItem.fromJson(Map<String, dynamic> json) => NcrRegisterItem(
        id: json['id'] as int,
        projectId: json['projectId'] as int? ?? 0,
        type: json['type'] as String? ?? 'NCR',
        severity: json['severity'] as String? ?? 'Major',
        category: json['category'] as String? ?? '',
        issueDescription: json['issueDescription'] as String? ?? '',
        location: json['location'] as String?,
        reportedDate: json['reportedDate'] as String? ?? '',
        reportedBy: json['reportedBy'] as String? ?? '',
        assignedTo: json['assignedTo'] as String?,
        status: json['status'] as String? ?? 'Open',
        rootCause: json['rootCause'] as String?,
        correctiveAction: json['correctiveAction'] as String?,
        targetDate: json['targetDate'] as String?,
        closedDate: json['closedDate'] as String?,
        attachmentUrl: json['attachmentUrl'] as String?,
        sourceType: json['sourceType'] as String?,
        sourceId: json['sourceId'] as String?,
        sourceReference: json['sourceReference'] as String?,
      );
}
