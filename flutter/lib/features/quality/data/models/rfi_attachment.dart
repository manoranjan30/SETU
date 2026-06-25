/// A confirmed attachment bound to an inspection (as opposed to
/// [RfiAttachmentDraft], which represents an upload before the RFI exists).
///
/// Mirrors the backend's `QualityInspectionAttachment` entity exactly —
/// see the RFI Enhancements handoff's "Attachment Model" section.
class RfiAttachment {
  final String id;
  final int projectId;
  final int? inspectionId;
  final String attachmentType; // DRAWING_MARKUP | SUPPORTING_DOCUMENT
  final String originalName;
  final String mimeType;
  final int size;
  final String originalUrl;
  final String? annotatedUrl;
  final Map<String, dynamic>? annotationData;
  final String? uploadedAt;
  final bool isLocked;

  const RfiAttachment({
    required this.id,
    required this.projectId,
    this.inspectionId,
    required this.attachmentType,
    required this.originalName,
    required this.mimeType,
    required this.size,
    required this.originalUrl,
    this.annotatedUrl,
    this.annotationData,
    this.uploadedAt,
    this.isLocked = false,
  });

  /// The URL to show in previews — the annotated (markup) version when one
  /// exists, otherwise the original file.
  String get previewUrl => annotatedUrl ?? originalUrl;

  bool get isPdf =>
      mimeType == 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');

  factory RfiAttachment.fromJson(Map<String, dynamic> json) => RfiAttachment(
        id: json['id'] as String,
        projectId: json['projectId'] as int? ?? 0,
        inspectionId: json['inspectionId'] as int?,
        attachmentType: json['attachmentType'] as String? ?? 'SUPPORTING_DOCUMENT',
        originalName: json['originalName'] as String? ?? 'Attachment',
        mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
        size: json['size'] as int? ?? 0,
        originalUrl: json['originalUrl'] as String? ?? '',
        annotatedUrl: json['annotatedUrl'] as String?,
        annotationData: json['annotationData'] as Map<String, dynamic>?,
        uploadedAt: json['uploadedAt'] as String?,
        isLocked: json['isLocked'] as bool? ?? false,
      );
}

/// Summary of an RFI linked via `relatedChecklistInspectionIds`, as embedded
/// directly in an inspection detail response's `relatedChecklistInspections`
/// array — enough to render a card without a second round-trip.
class RelatedChecklistSummary {
  final int id;
  final int activityId;
  final String activityName;
  final String? listName;
  final String status;
  final String requestDate;
  final int? goNo;
  final String? goLabel;
  final int partNo;
  final String? partLabel;
  final String? drawingNo;
  final String? elementName;
  final String? goDetails;

  const RelatedChecklistSummary({
    required this.id,
    required this.activityId,
    required this.activityName,
    this.listName,
    required this.status,
    required this.requestDate,
    this.goNo,
    this.goLabel,
    this.partNo = 1,
    this.partLabel,
    this.drawingNo,
    this.elementName,
    this.goDetails,
  });

  factory RelatedChecklistSummary.fromJson(Map<String, dynamic> json) =>
      RelatedChecklistSummary(
        id: json['id'] as int,
        activityId: json['activityId'] as int? ?? 0,
        activityName: json['activityName'] as String? ?? 'RFI #${json['id']}',
        listName: json['listName'] as String?,
        status: json['status'] as String? ?? 'PENDING',
        requestDate: json['requestDate'] as String? ?? '',
        goNo: json['goNo'] as int?,
        goLabel: json['goLabel'] as String?,
        partNo: json['partNo'] as int? ?? 1,
        partLabel: json['partLabel'] as String?,
        drawingNo: json['drawingNo'] as String?,
        elementName: json['elementName'] as String?,
        goDetails: json['goDetails'] as String?,
      );
}
