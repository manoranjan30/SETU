import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/full_screen_photo_viewer.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/data/models/rfi_attachment.dart';
import 'package:setu_mobile/injection_container.dart';

/// "Peek" view of a linked RFI's full detail — checklist responses,
/// observations, and attachments — without navigating away from (or
/// disposing) the approval screen that opened it.
///
/// This is intentionally a standalone, read-only fetch rather than going
/// through [QualityApprovalBloc]: the bloc instance backing the page that
/// opened this sheet is mid-approval (may have an in-progress reject/reverse
/// dialog, unsaved checklist edits, etc.) and must not be touched.
class LinkedRfiDetailSheet extends StatefulWidget {
  final int inspectionId;
  const LinkedRfiDetailSheet({super.key, required this.inspectionId});

  static Future<void> show(BuildContext context, int inspectionId) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        expand: false,
        builder: (context, scrollController) => LinkedRfiDetailSheet(
          inspectionId: inspectionId,
        ),
      ),
    );
  }

  @override
  State<LinkedRfiDetailSheet> createState() => _LinkedRfiDetailSheetState();
}

class _LinkedRfiDetailSheetState extends State<LinkedRfiDetailSheet> {
  QualityInspection? _inspection;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await sl<SetuApiClient>().getQualityInspectionDetail(widget.inspectionId);
      if (mounted) setState(() => _inspection = QualityInspection.fromJson(raw));
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load RFI #${widget.inspectionId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(child: Text(_error!, style: TextStyle(color: Colors.red.shade700)));
    }
    if (_inspection == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final insp = _inspection!;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36, height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    insp.activityName ?? 'RFI #${insp.id}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: insp.status.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(insp.status.label,
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: insp.status.color)),
                ),
              ],
            ),
            Text('RFI #${insp.id}  ·  ${insp.requestDate}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
            const SizedBox(height: 12),
            Expanded(
              child: ListView(
                children: [
                  // ── Checklist stages (read-only) ──────────────────────
                  if (insp.stages.isNotEmpty) ...[
                    const Text('Checklist',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    const SizedBox(height: 6),
                    ...insp.stages.map((stage) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Card(
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                              side: BorderSide(color: Colors.grey.shade200),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(stage.stageName ?? 'Stage',
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 4),
                                  ...stage.items.map((item) => Padding(
                                        padding: const EdgeInsets.symmetric(vertical: 2),
                                        child: Row(
                                          children: [
                                            Icon(
                                              item.itemStatus == null
                                                  ? Icons.circle_outlined
                                                  : (item.itemStatus == ChecklistItemStatus.pass
                                                      ? Icons.check_circle
                                                      : Icons.remove_circle_outline),
                                              size: 14,
                                              color: item.itemStatus == null
                                                  ? Colors.grey
                                                  : (item.itemStatus == ChecklistItemStatus.pass
                                                      ? Colors.green
                                                      : Colors.orange),
                                            ),
                                            const SizedBox(width: 6),
                                            Expanded(
                                              child: Text(item.itemText,
                                                  style: const TextStyle(fontSize: 11)),
                                            ),
                                          ],
                                        ),
                                      )),
                                ],
                              ),
                            ),
                          ),
                        )),
                    const SizedBox(height: 12),
                  ],

                  // ── Attachments ────────────────────────────────────────
                  Text('Attachments (${insp.attachments.length})',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  const SizedBox(height: 6),
                  if (insp.attachments.isEmpty)
                    Text('No attachments.',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade500))
                  else
                    AttachmentGrid(attachments: insp.attachments, readOnly: true),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Read-only/editable grid of attachment thumbnails. Mutation controls
/// (delete) are suppressed per-item when [RfiAttachment.isLocked] is true,
/// or entirely when [readOnly] is true (e.g. this "peek" sheet should never
/// allow editing another approver's evidence).
class AttachmentGrid extends StatelessWidget {
  final List<RfiAttachment> attachments;
  final bool readOnly;
  final void Function(RfiAttachment)? onDelete;

  /// Re-opens an image attachment in the annotation editor and replaces it
  /// in place. Only offered for non-PDF, unlocked attachments — the same
  /// constraint [onDelete] already enforces.
  final void Function(RfiAttachment)? onEdit;

  const AttachmentGrid({
    super.key,
    required this.attachments,
    this.readOnly = false,
    this.onDelete,
    this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: attachments.map((a) => _AttachmentTile(
            attachment: a,
            onTap: () => _openAttachment(context, a),
            onDelete: (!readOnly && !a.isLocked && onDelete != null)
                ? () => onDelete!(a)
                : null,
            onEdit: (!readOnly && !a.isLocked && !a.isPdf && onEdit != null)
                ? () => onEdit!(a)
                : null,
          )).toList(),
    );
  }

  void _openAttachment(BuildContext context, RfiAttachment a) {
    if (a.isPdf) {
      // PDFs are attachment-only — open externally rather than preview inline.
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => _PdfPlaceholderPage(attachment: a),
      ));
      return;
    }
    final urls = attachments.where((x) => !x.isPdf).map((x) => ApiEndpoints.resolveUrl(x.previewUrl)).toList();
    final index = attachments.where((x) => !x.isPdf).toList().indexOf(a);
    FullScreenPhotoViewer.show(context, urls, initialIndex: index < 0 ? 0 : index);
  }
}

class _AttachmentTile extends StatelessWidget {
  final RfiAttachment attachment;
  final VoidCallback onTap;
  final VoidCallback? onDelete;
  final VoidCallback? onEdit;

  const _AttachmentTile({
    required this.attachment,
    required this.onTap,
    this.onDelete,
    this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: attachment.isPdf
                ? Container(
                    width: 72, height: 72,
                    color: Colors.red.shade50,
                    alignment: Alignment.center,
                    child: const Icon(Icons.picture_as_pdf_outlined, color: Colors.red, size: 28),
                  )
                : CachedNetworkImage(
                    imageUrl: ApiEndpoints.resolveUrl(attachment.previewUrl),
                    width: 72, height: 72,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      width: 72, height: 72, color: Colors.grey.shade200,
                      child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      width: 72, height: 72, color: Colors.grey.shade200,
                      child: const Icon(Icons.broken_image_outlined, color: Colors.grey),
                    ),
                  ),
          ),
          if (attachment.isLocked)
            Positioned(
              left: 2, top: 2,
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Icon(Icons.lock, size: 10, color: Colors.white),
              ),
            ),
          if (onDelete != null)
            Positioned(
              right: 2, top: 2,
              child: GestureDetector(
                onTap: onDelete,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                  child: const Icon(Icons.close, size: 12, color: Colors.white),
                ),
              ),
            ),
          if (onEdit != null)
            Positioned(
              right: 2, bottom: 2,
              child: GestureDetector(
                onTap: onEdit,
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: const BoxDecoration(color: Colors.blue, shape: BoxShape.circle),
                  child: const Icon(Icons.edit, size: 11, color: Colors.white),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Minimal full-screen page for opening a PDF attachment's URL — downloading
/// and handing off to the OS viewer mirrors the existing inspection-report
/// PDF flow elsewhere in this feature.
class _PdfPlaceholderPage extends StatelessWidget {
  final RfiAttachment attachment;
  const _PdfPlaceholderPage({required this.attachment});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(attachment.originalName)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.picture_as_pdf_outlined, size: 64, color: Colors.red),
              const SizedBox(height: 12),
              Text(attachment.originalName, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () {
                  // Hand off to the device browser/PDF viewer for the
                  // resolved URL — consistent with how other download-only
                  // documents are handled in this app.
                  Navigator.of(context).pop();
                },
                icon: const Icon(Icons.open_in_new),
                label: const Text('Open in browser'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
