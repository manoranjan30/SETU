import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/injection_container.dart';

/// Modal bottom sheet for QC inspector to raise a new observation.
/// Dispatches [RaiseObservation] to [QualityApprovalBloc].
class RaiseObservationSheet extends StatefulWidget {
  const RaiseObservationSheet({super.key});

  /// Show the sheet and return true if observation was submitted.
  static Future<bool?> show(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => BlocProvider.value(
        value: context.read<QualityApprovalBloc>(),
        child: const RaiseObservationSheet(),
      ),
    );
  }

  @override
  State<RaiseObservationSheet> createState() => _RaiseObservationSheetState();
}

class _RaiseObservationSheetState extends State<RaiseObservationSheet> {
  final _formKey = GlobalKey<FormState>();
  final _textCtrl = TextEditingController();
  String _type = 'Minor';
  final List<String> _photoUrls = [];
  bool _submitting = false;
  bool _uploadingPhoto = false;

  static const _types = ['Minor', 'Major', 'Critical'];

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final xfile = await ImagePicker().pickImage(source: ImageSource.camera);
    if (xfile == null || !mounted) return;

    // Open annotation editor — user can draw/crop before uploading
    final annotatedPath =
        await ImageAnnotationPage.show(context, xfile.path);
    final uploadPath = annotatedPath ?? xfile.path;

    if (!mounted) return;
    setState(() => _uploadingPhoto = true);
    String? compressedPath;
    try {
      compressedPath = await PhotoCompressor.compress(uploadPath);
      final result =
          await sl<SetuApiClient>().uploadFile(filePath: compressedPath);
      final url =
          result['url'] as String? ?? result['path'] as String? ?? '';
      if (mounted && url.isNotEmpty) setState(() => _photoUrls.add(url));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Photo upload failed. Please try again.'),
          backgroundColor: Colors.red.shade700,
        ));
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
      if (compressedPath != null) {
        await PhotoCompressor.deleteTempFile(compressedPath);
      }
      await PhotoCompressor.deleteTempFile(xfile.path);
      if (annotatedPath != null) {
        await PhotoCompressor.deleteTempFile(annotatedPath);
      }
    }
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    context.read<QualityApprovalBloc>().add(RaiseObservation(
          observationText: _textCtrl.text.trim(),
          type: _type,
          photos: List.from(_photoUrls),
        ));
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.dividerColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            Text(
              'Raise Observation',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),

            // Observation type selector
            Text('Type', style: theme.textTheme.labelLarge),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: _types
                  .map((t) => ButtonSegment(value: t, label: Text(t)))
                  .toList(),
              selected: {_type},
              onSelectionChanged: (s) =>
                  setState(() => _type = s.first),
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: _typeColor(_type).withValues(alpha: 0.15),
                selectedForegroundColor: _typeColor(_type),
              ),
            ),
            const SizedBox(height: 16),

            // Observation text
            TextFormField(
              controller: _textCtrl,
              maxLines: 4,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Observation Details *',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
                hintText: 'Describe what was observed…',
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),

            // Photo thumbnails with delete
            if (_photoUrls.isNotEmpty) ...[
              PhotoThumbnailStrip(
                photoUrls: _photoUrls,
                canDelete: true,
                onDelete: (url) => setState(() => _photoUrls.remove(url)),
              ),
              const SizedBox(height: 8),
            ],

            Row(
              children: [
                TextButton.icon(
                  onPressed:
                      (_uploadingPhoto || _submitting) ? null : _pickPhoto,
                  icon: _uploadingPhoto
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.camera_alt_outlined, size: 18),
                  label: Text(_uploadingPhoto ? 'Uploading…' : 'Add Photo'),
                ),
                const Spacer(),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: (_submitting || _uploadingPhoto) ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Submit'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _typeColor(String type) {
    switch (type) {
      case 'Major':
        return Colors.orange.shade700;
      case 'Critical':
        return Colors.red.shade700;
      default:
        return Colors.blue.shade700;
    }
  }
}
