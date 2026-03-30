import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/injection_container.dart';

/// Bottom sheet for rectifying a site observation (Quality or EHS).
/// Photos are compressed + uploaded directly to avoid bloc state pollution.
class RectifySheet extends StatefulWidget {
  final String title;

  /// Callback when user submits rectification notes + optional photos.
  final Future<void> Function({
    required String notes,
    List<String> photoUrls,
  }) onSubmit;

  const RectifySheet({
    super.key,
    required this.title,
    required this.onSubmit,
  });

  static Future<void> show(
    BuildContext context, {
    required String title,
    required Future<void> Function({
      required String notes,
      List<String> photoUrls,
    }) onSubmit,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => RectifySheet(title: title, onSubmit: onSubmit),
    );
  }

  @override
  State<RectifySheet> createState() => _RectifySheetState();
}

class _RectifySheetState extends State<RectifySheet> {
  final _formKey = GlobalKey<FormState>();
  final _notesCtrl = TextEditingController();

  final List<String> _photoUrls = [];
  bool _uploading = false;
  bool _submitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  /// Saves a photo to the app's pending-observations directory so it survives
  /// until the SyncService can upload it to the server.
  Future<String> _savePhotoLocally(String sourcePath) async {
    final dir = await getApplicationDocumentsDirectory();
    final pendingDir = Directory(p.join(dir.path, 'pending_obs_photos'));
    await pendingDir.create(recursive: true);
    final fileName = '${DateTime.now().millisecondsSinceEpoch}_rectify.jpg';
    final dest = File(p.join(pendingDir.path, fileName));
    await File(sourcePath).copy(dest.path);
    return dest.path;
  }

  Future<void> _pickPhoto() async {
    if (_photoUrls.length >= 5) return;

    // Ask user: camera or gallery
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 8, bottom: 4),
              width: 32,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Take Photo'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from Gallery'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    final xfile = await ImagePicker().pickImage(
      source: source,
      imageQuality: 85,
    );
    if (xfile == null || !mounted) return;

    // Guard: reject files > 15 MB
    final fileSizeBytes = await File(xfile.path).length();
    if (fileSizeBytes > 15 * 1024 * 1024) {
      if (mounted) {
        setState(() => _errorMessage = 'Image too large. Please choose another.');
      }
      return;
    }

    // Open annotation/markup editor
    if (!mounted) return;
    final annotatedPath = await ImageAnnotationPage.show(context, xfile.path);
    final uploadPath = annotatedPath ?? xfile.path;

    if (!mounted) return;
    setState(() => _uploading = true);
    String? compressed;
    try {
      compressed = await PhotoCompressor.compress(uploadPath);
      try {
        // Online path: upload immediately and store server URL.
        final result = await sl<SetuApiClient>().uploadFile(filePath: compressed);
        final url = result['url'] as String? ?? result['path'] as String? ?? '';
        if (mounted && url.isNotEmpty) setState(() => _photoUrls.add(url));
      } catch (_) {
        // Offline path: save compressed copy locally.
        // The SyncService will upload it when connectivity is restored.
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
        setState(() => _errorMessage = 'Could not capture photo. Please try again.');
      }
    } finally {
      // Only delete the compressed temp file if it was NOT saved as the local copy.
      if (compressed != null && !_photoUrls.contains(compressed)) {
        await PhotoCompressor.deleteTempFile(compressed);
      }
      if (annotatedPath != null) PhotoCompressor.deleteTempFile(annotatedPath);
      PhotoCompressor.deleteTempFile(xfile.path);
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      await widget.onSubmit(
        notes: _notesCtrl.text.trim(),
        photoUrls: List.unmodifiable(_photoUrls),
      );
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _errorMessage = 'Submission failed. Please try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 4),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primaryContainer,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            Icons.build_circle_outlined,
                            size: 18,
                            color: theme.colorScheme.onPrimaryContainer,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          widget.title,
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Rectification notes
                    TextFormField(
                      controller: _notesCtrl,
                      autofocus: true,
                      maxLines: 4,
                      maxLength: 500,
                      decoration: const InputDecoration(
                        labelText: 'Rectification Notes *',
                        hintText: 'Describe what was done to rectify…',
                        border: OutlineInputBorder(),
                        alignLabelWithHint: true,
                      ),
                      validator: (v) =>
                          v == null || v.trim().isEmpty
                              ? 'Notes are required'
                              : null,
                    ),
                    const SizedBox(height: 12),

                    // Photos strip
                    Row(
                      children: [
                        Text(
                          'Evidence Photos (${_photoUrls.length}/5)',
                          style: theme.textTheme.labelLarge
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const Spacer(),
                        if (_uploading)
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        else if (_photoUrls.length < 5)
                          TextButton.icon(
                            onPressed: _pickPhoto,
                            icon: const Icon(Icons.add_a_photo_outlined,
                                size: 16),
                            label: const Text('Add'),
                            style: TextButton.styleFrom(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 8)),
                          ),
                      ],
                    ),
                    if (_photoUrls.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      PhotoThumbnailStrip(
                        photoUrls: _photoUrls,
                        canDelete: true,
                        onDelete: (url) =>
                            setState(() => _photoUrls.remove(url)),
                      ),
                    ],

                    if (_errorMessage != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _errorMessage!,
                        style: TextStyle(
                            color: theme.colorScheme.error, fontSize: 12),
                      ),
                    ],
                    const SizedBox(height: 16),

                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _submitting
                                ? null
                                : () => Navigator.of(context).pop(),
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: FilledButton.icon(
                            onPressed: _submitting ? null : _submit,
                            icon: _submitting
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white),
                                  )
                                : const Icon(Icons.check_circle_outline,
                                    size: 16),
                            label: Text(
                                _submitting ? 'Submitting…' : 'Mark Rectified'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
