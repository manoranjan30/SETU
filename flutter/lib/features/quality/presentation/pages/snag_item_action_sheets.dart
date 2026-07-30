import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/injection_container.dart';

/// Result of [showRectifySheet] / [showCloseSheet] — the notes/remarks and
/// any photo URLs the user attached, or `null` if they cancelled.
class SnagActionInput {
  final String? notes;
  final List<String> photoUrls;
  const SnagActionInput({this.notes, this.photoUrls = const []});
}

/// Rectification form: notes + after-photos. Whether a photo is mandatory
/// depends on the current process step's `rectificationPhotoRequired` flag
/// ([photoRequired]) — admin-configured per step, not hard-coded.
Future<SnagActionInput?> showRectifySheet(BuildContext context, {bool photoRequired = false}) {
  return showModalBottomSheet<SnagActionInput>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _PhotoNoteSheet(
      title: 'Mark Rectified',
      notesLabel: 'Rectification Notes',
      confirmLabel: 'Mark Rectified',
      photosLabel: photoRequired ? 'After Photos *' : 'After Photos (optional)',
      photoRequired: photoRequired,
    ),
  );
}

/// Close/desnag form: remarks + closure photos, mandatory when the current
/// process step's `desnagCompletionPhotoRequired` flag ([photoRequired]) is set.
Future<SnagActionInput?> showCloseSheet(BuildContext context, {bool photoRequired = false}) {
  return showModalBottomSheet<SnagActionInput>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _PhotoNoteSheet(
      title: 'Close Snag Point',
      notesLabel: 'Closure Remarks',
      confirmLabel: 'Close',
      photosLabel: photoRequired ? 'Closure Photos *' : 'Closure Photos (optional)',
      photoRequired: photoRequired,
    ),
  );
}

/// Hold reason — required by the backend DTO (`HoldSnagItemDto.holdReason`
/// is non-optional), so the confirm button stays disabled until non-empty.
Future<String?> showHoldReasonSheet(BuildContext context) {
  return _showReasonDialog(context, title: 'Hold Snag Point', label: 'Reason', confirmLabel: 'Hold', requireNonEmpty: true);
}

/// Not-satisfactory remarks for [RejectRectificationEvent]. The DTO field
/// is technically optional, but requiring it here is a deliberate product
/// choice for a decent audit trail — it doesn't violate the API contract,
/// since a non-empty string is always valid input for an optional field.
Future<String?> showRejectRectificationSheet(BuildContext context) {
  return _showReasonDialog(
    context,
    title: 'Not Satisfactory',
    label: 'Remarks',
    confirmLabel: 'Reject',
    requireNonEmpty: true,
    confirmColor: Colors.red,
  );
}

Future<String?> _showReasonDialog(
  BuildContext context, {
  required String title,
  required String label,
  required String confirmLabel,
  required bool requireNonEmpty,
  MaterialColor? confirmColor,
}) {
  final ctrl = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(labelText: requireNonEmpty ? '$label *' : label, border: const OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: requireNonEmpty && ctrl.text.trim().isEmpty
                ? null
                : () => Navigator.of(ctx).pop(ctrl.text.trim()),
            style: confirmColor != null ? FilledButton.styleFrom(backgroundColor: confirmColor.shade700) : null,
            child: Text(confirmLabel),
          ),
        ],
      ),
    ),
  );
}

class _PhotoNoteSheet extends StatefulWidget {
  final String title;
  final String notesLabel;
  final String confirmLabel;
  final String photosLabel;
  final bool photoRequired;

  const _PhotoNoteSheet({
    required this.title,
    required this.notesLabel,
    required this.confirmLabel,
    required this.photosLabel,
    this.photoRequired = false,
  });

  @override
  State<_PhotoNoteSheet> createState() => _PhotoNoteSheetState();
}

class _PhotoNoteSheetState extends State<_PhotoNoteSheet> {
  final _notesCtrl = TextEditingController();
  final List<String> _photoUrls = [];
  bool _uploading = false;
  bool _submitting = false;

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _addPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.of(ctx).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Gallery'),
              onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;

    final photo = await ImagePicker().pickImage(source: source, imageQuality: 90);
    if (photo == null || !mounted) return;

    setState(() => _uploading = true);
    try {
      final compressed = await PhotoCompressor.compress(photo.path);
      try {
        // Online path: upload immediately and store the server URL.
        final result = await sl<SetuApiClient>().uploadFile(filePath: compressed);
        final url = result['url'] as String? ?? result['path'] as String? ?? '';
        if (url.isNotEmpty && mounted) setState(() => _photoUrls.add(url));
      } catch (_) {
        // Offline path: save a compressed copy locally — SyncService
        // uploads it once the queued rectify/close mutation is replayed.
        final localPath = await _savePhotoLocally(compressed);
        if (mounted) {
          setState(() => _photoUrls.add(localPath));
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('Photo saved locally — will upload when online.'),
            backgroundColor: Colors.orange.shade700,
          ));
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Could not capture photo. Please try again.'),
        ));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  /// Saves a photo to the app's pending-snag-photos directory so it survives
  /// until [SyncService] can upload it alongside the queued mutation.
  Future<String> _savePhotoLocally(String sourcePath) async {
    final dir = await getApplicationDocumentsDirectory();
    final pendingDir = Directory(p.join(dir.path, 'pending_snag_photos'));
    await pendingDir.create(recursive: true);
    final fileName = '${DateTime.now().millisecondsSinceEpoch}_snag.jpg';
    final dest = File(p.join(pendingDir.path, fileName));
    await File(sourcePath).copy(dest.path);
    return dest.path; // absolute local path used as placeholder URL
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          TextField(
            controller: _notesCtrl,
            maxLines: 3,
            decoration: InputDecoration(labelText: widget.notesLabel, border: const OutlineInputBorder(), isDense: true),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(widget.photosLabel, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
              const Spacer(),
              TextButton.icon(
                onPressed: _uploading ? null : _addPhoto,
                icon: _uploading
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.add_a_photo_outlined, size: 16),
                label: Text(_uploading ? 'Uploading…' : 'Add Photo'),
              ),
            ],
          ),
          if (_photoUrls.isNotEmpty)
            PhotoThumbnailStrip(
              photoUrls: _photoUrls,
              canDelete: true,
              onDelete: (url) => setState(() => _photoUrls.remove(url)),
            ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: _submitting || (widget.photoRequired && _photoUrls.isEmpty)
                      ? null
                      : () {
                          setState(() => _submitting = true);
                          Navigator.of(context).pop(SnagActionInput(
                            notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
                            photoUrls: _photoUrls,
                          ));
                        },
                  child: Text(widget.confirmLabel),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
