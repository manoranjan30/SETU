/// RFI attachment types — mirrors the backend's
/// `QualityInspectionAttachmentType` enum.
enum RfiAttachmentType {
  drawingMarkup,
  supportingDocument;

  String get apiValue => switch (this) {
        RfiAttachmentType.drawingMarkup => 'DRAWING_MARKUP',
        RfiAttachmentType.supportingDocument => 'SUPPORTING_DOCUMENT',
      };
}

/// Lifecycle of a single attachment upload within the Raise RFI flow.
enum DraftUploadStatus { uploading, uploaded, failed }

/// A single attachment being staged for an RFI that doesn't exist yet.
///
/// [clientUploadId] is generated once, before the first upload attempt, and
/// reused on every retry — the backend treats repeat uploads with the same
/// id as idempotent (returns the existing draft instead of duplicating it).
class RfiAttachmentDraft {
  final String clientUploadId;
  final RfiAttachmentType attachmentType;
  final String fileName;
  final int sizeBytes;
  final String localOriginalPath;
  final String? localAnnotatedPath;
  final String? annotationDataJson;

  DraftUploadStatus status;
  String? serverAttachmentId;
  String? errorMessage;

  RfiAttachmentDraft({
    required this.clientUploadId,
    required this.attachmentType,
    required this.fileName,
    required this.sizeBytes,
    required this.localOriginalPath,
    this.localAnnotatedPath,
    this.annotationDataJson,
    this.status = DraftUploadStatus.uploading,
    this.serverAttachmentId,
    this.errorMessage,
  });

  bool get isImage => localAnnotatedPath != null ||
      attachmentType == RfiAttachmentType.drawingMarkup;
}
