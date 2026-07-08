import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfx/pdfx.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/full_screen_photo_viewer.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/features/quality/data/models/rfi_attachment_draft.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:uuid/uuid.dart';

/// Lets the user attach up to 5 photos/PDFs to an RFI *before* the RFI
/// itself exists, by uploading each one immediately as an attachment draft
/// and binding the resulting ids when the RFI is created
/// ([RfiAttachmentDraft.serverAttachmentId] → `attachmentDraftIds`).
///
/// Each draft uploads as soon as it's picked — there is no separate
/// "upload" step. [onChanged] fires after every add/remove/retry so the
/// parent form can read [readyDraftIds] and block submission while any
/// draft is still uploading or has failed (per the offline-sync contract:
/// never submit the RFI while a required upload is pending or failed).
class RfiAttachmentPicker extends StatefulWidget {
  final int projectId;
  final ValueChanged<List<RfiAttachmentDraft>> onChanged;

  const RfiAttachmentPicker({
    super.key,
    required this.projectId,
    required this.onChanged,
  });

  @override
  State<RfiAttachmentPicker> createState() => _RfiAttachmentPickerState();
}

class _RfiAttachmentPickerState extends State<RfiAttachmentPicker> {
  static const _maxFiles = 5;
  static const _maxBytes = 10 * 1024 * 1024;
  static const _allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

  final List<RfiAttachmentDraft> _drafts = [];

  void _notify() => widget.onChanged(List.unmodifiable(_drafts));

  Future<void> _pickAndUpload() async {
    if (_drafts.length >= _maxFiles) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 5 attachments per RFI')),
      );
      return;
    }

    final source = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(ctx, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Photo Gallery'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
            ListTile(
              leading: const Icon(Icons.picture_as_pdf_outlined),
              title: const Text('Choose PDF'),
              onTap: () => Navigator.pop(ctx, 'pdf'),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    XFile? file;
    try {
      if (source == 'camera') {
        file = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 90);
      } else if (source == 'gallery') {
        file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90);
      } else {
        final result = await FilePicker.platform.pickFiles(
          type: FileType.custom,
          allowedExtensions: const ['pdf'],
          withData: false,
        );
        if (result?.files.isNotEmpty == true && result!.files.first.path != null) {
          file = XFile(result.files.first.path!);
        }
      }
    } catch (_) {}
    if (file == null || !mounted) return;

    final ext = file.path.split('.').last.toLowerCase();
    if (!_allowedExtensions.contains(ext)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Only JPG, PNG, WebP, or PDF files are allowed')),
      );
      return;
    }

    final isPdf = ext == 'pdf';
    final originalPath = isPdf ? file.path : await PhotoCompressor.compress(file.path);
    String? annotatedPath;
    String? annotationDataJson;
    var attachmentType = RfiAttachmentType.supportingDocument;
    // For a PDF, the *original* file uploaded is always the real PDF
    // (preserves the full document, all pages) — only the annotation
    // source is a rendered raster of page 1. For an image, the same path
    // serves both purposes.
    String? pdfPageRenderPath;

    if (!mounted) return;
    var annotationSourcePath = originalPath;
    if (isPdf) {
      try {
        pdfPageRenderPath = await _renderPdfFirstPage(originalPath);
        annotationSourcePath = pdfPageRenderPath;
      } catch (_) {
        // Rendering failed (corrupt/encrypted PDF, etc.) — fall back to
        // attaching the PDF as-is with no annotation option this time.
        pdfPageRenderPath = null;
      }
    }

    if (pdfPageRenderPath != null || !isPdf) {
      if (!mounted) return;
      final shouldAnnotate = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(isPdf ? 'Annotate this document?' : 'Annotate this photo?'),
          content: Text(isPdf
              ? 'Mark up page 1 of this PDF before attaching, or attach as-is. '
                  'The full PDF is always kept — this only adds a marked-up preview image.'
              : 'Mark up drawings/issues before attaching, or attach as-is.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Attach As-Is'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Annotate'),
            ),
          ],
        ),
      );
      if (!mounted) return;
      if (shouldAnnotate == true) {
        final result = await ImageAnnotationPage.show(
          context, annotationSourcePath,
          // Pass PDF page info so the exported JSON includes pdfPageNumber.
          // Currently always page 1 since _renderPdfFirstPage renders page 1.
          pdfPageNumber: isPdf ? 1 : null,
          pdfPageCount: isPdf ? 1 : null, // updated if multi-page support is added
        );
        if (result != null) {
          annotatedPath = result.flattenedImagePath;
          annotationDataJson = result.shapesJsonPath.isNotEmpty
              ? await File(result.shapesJsonPath).readAsString()
              : null;
          attachmentType = RfiAttachmentType.drawingMarkup;
        }
      }
      // The rendered page was only needed as an annotation source — if the
      // user declined to annotate, or it wasn't used as the annotatedPath
      // itself (annotation always re-exports its own flattened copy), it
      // can be cleaned up immediately.
      if (pdfPageRenderPath != null) {
        await PhotoCompressor.deleteTempFile(pdfPageRenderPath);
      }
    }

    final size = await File(originalPath).length();
    if (size > _maxBytes) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('File exceeds 10 MB limit')),
        );
      }
      return;
    }

    final draft = RfiAttachmentDraft(
      clientUploadId: const Uuid().v4(),
      attachmentType: attachmentType,
      fileName: file.name,
      sizeBytes: size,
      localOriginalPath: originalPath,
      localAnnotatedPath: annotatedPath,
      annotationDataJson: annotationDataJson,
    );
    setState(() => _drafts.add(draft));
    _notify();
    await _upload(draft);
  }

  /// Rasterizes page 1 of [pdfPath] to a temp PNG so it can be fed through
  /// the same annotation editor used for photos — the actual PDF file is
  /// always uploaded separately as the original, this is only ever used as
  /// an annotation source/preview.
  Future<String> _renderPdfFirstPage(String pdfPath) async {
    final doc = await PdfDocument.openFile(pdfPath);
    try {
      final page = await doc.getPage(1);
      try {
        final rendered = await page.render(
          width: page.width * 2,
          height: page.height * 2,
          format: PdfPageImageFormat.png,
          // Text-based PDFs leave most of the page un-painted (no full-bleed
          // image content) — pdfx renders that as transparent, which then
          // flattens to solid black once composited. An explicit white
          // background avoids this; image-based PDFs already fill every
          // pixel so this has no visible effect on them.
          backgroundColor: '#FFFFFF',
        );
        if (rendered == null) throw Exception('PDF render returned no image');
        final dir = await getTemporaryDirectory();
        final outPath =
            '${dir.path}/pdf_page_${DateTime.now().millisecondsSinceEpoch}.png';
        await File(outPath).writeAsBytes(rendered.bytes);
        return outPath;
      } finally {
        await page.close();
      }
    } finally {
      await doc.close();
    }
  }

  /// Uploads [draft], reusing its existing [RfiAttachmentDraft.clientUploadId]
  /// whether this is the first attempt or a manual retry — the backend
  /// returns the same draft record for a repeated id instead of duplicating
  /// the upload, so retrying is always safe.
  Future<void> _upload(RfiAttachmentDraft draft) async {
    setState(() {
      draft.status = DraftUploadStatus.uploading;
      draft.errorMessage = null;
    });
    _notify();
    try {
      final result = await sl<SetuApiClient>().createAttachmentDraft(
        projectId: widget.projectId,
        clientUploadId: draft.clientUploadId,
        attachmentType: draft.attachmentType.apiValue,
        originalFilePath: draft.localOriginalPath,
        annotatedFilePath: draft.localAnnotatedPath,
        annotationDataJson: draft.annotationDataJson,
      );
      if (!mounted) return;
      setState(() {
        draft.status = DraftUploadStatus.uploaded;
        draft.serverAttachmentId = result['id'] as String?;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        draft.status = DraftUploadStatus.failed;
        draft.errorMessage = 'Upload failed — check connection and retry';
      });
    } finally {
      _notify();
    }
  }

  Future<void> _remove(RfiAttachmentDraft draft) async {
    // Only an already-uploaded draft has a server record to clean up;
    // uploading/failed drafts never reached the server (or the attempt
    // that did is harmless to abandon — the same UUID would just be
    // reused if the user re-adds the same file).
    if (draft.status == DraftUploadStatus.uploaded &&
        draft.serverAttachmentId != null) {
      try {
        await sl<SetuApiClient>().deleteAttachmentDraft(draft.serverAttachmentId!);
      } catch (_) {
        // Best-effort cleanup — if this fails the draft is simply orphaned
        // server-side (never bound to an RFI), not a correctness issue.
      }
    }
    if (!mounted) return;
    setState(() => _drafts.remove(draft));
    _notify();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Attachments (${_drafts.length}/$_maxFiles)',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const Spacer(),
            TextButton.icon(
              onPressed: _drafts.length >= _maxFiles ? null : _pickAndUpload,
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add', style: TextStyle(fontSize: 12)),
              style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8)),
            ),
          ],
        ),
        if (_drafts.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Text('No attachments added.',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
          )
        else
          Column(
            children: _drafts.map((d) => _DraftRow(
                  draft: d,
                  onRetry: () => _upload(d),
                  onRemove: () => _remove(d),
                )).toList(),
          ),
      ],
    );
  }
}

class _DraftRow extends StatelessWidget {
  final RfiAttachmentDraft draft;
  final VoidCallback onRetry;
  final VoidCallback onRemove;

  const _DraftRow({
    required this.draft,
    required this.onRetry,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final isPdf = draft.fileName.toLowerCase().endsWith('.pdf');
    // A PDF that was annotated has a rendered+marked-up preview image
    // (localAnnotatedPath) — show that instead of the generic PDF icon.
    final hasPreviewImage = !isPdf || draft.localAnnotatedPath != null;
    final imagePath = draft.localAnnotatedPath ?? draft.localOriginalPath;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          GestureDetector(
            onTap: hasPreviewImage
                ? () => FullScreenPhotoViewer.show(context, ['file://$imagePath'])
                : () => OpenFile.open(draft.localOriginalPath),
            child: hasPreviewImage
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: Image.file(
                      File(imagePath),
                      width: 32, height: 32, fit: BoxFit.cover,
                    ),
                  )
                : const Icon(Icons.picture_as_pdf_outlined, size: 28, color: Colors.red),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(draft.fileName,
                    style: const TextStyle(fontSize: 12),
                    overflow: TextOverflow.ellipsis),
                Text(
                  switch (draft.status) {
                    DraftUploadStatus.uploading => 'Uploading…',
                    DraftUploadStatus.uploaded => '${(draft.sizeBytes / 1024).round()} KB · Uploaded',
                    DraftUploadStatus.failed => draft.errorMessage ?? 'Failed',
                  },
                  style: TextStyle(
                    fontSize: 10,
                    color: draft.status == DraftUploadStatus.failed
                        ? Colors.red.shade700
                        : Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
          if (draft.status == DraftUploadStatus.uploading)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: SizedBox(width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (draft.status == DraftUploadStatus.failed)
            IconButton(
              icon: const Icon(Icons.refresh, size: 18, color: Colors.orange),
              tooltip: 'Retry',
              onPressed: onRetry,
            )
          else
            const Icon(Icons.check_circle, size: 18, color: Colors.green),
          IconButton(
            icon: const Icon(Icons.close, size: 18),
            tooltip: 'Remove',
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}
