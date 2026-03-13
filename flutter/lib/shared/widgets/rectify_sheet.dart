import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:image_picker/image_picker.dart';

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

  Future<void> _pickPhoto() async {
    if (_photoUrls.length >= 5) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
    );
    if (file == null) return;

    setState(() => _uploading = true);
    try {
      final compressed = await PhotoCompressor.compress(file.path);
      final result = await sl<SetuApiClient>().uploadFile(filePath: compressed);
      final url = result['url'] as String? ?? result['path'] as String? ?? '';
      if (url.isNotEmpty) setState(() => _photoUrls.add(url));
      PhotoCompressor.deleteTempFile(compressed);
    } catch (_) {
      if (mounted) {
        setState(() => _errorMessage = 'Photo upload failed. Please retry.');
      }
    } finally {
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
                      SizedBox(
                        height: 60,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _photoUrls.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: 6),
                          itemBuilder: (_, i) => Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: Image.network(
                                  _photoUrls[i],
                                  width: 60,
                                  height: 60,
                                  fit: BoxFit.cover,
                                ),
                              ),
                              Positioned(
                                top: 2,
                                right: 2,
                                child: GestureDetector(
                                  onTap: () =>
                                      setState(() => _photoUrls.removeAt(i)),
                                  child: Container(
                                    width: 18,
                                    height: 18,
                                    decoration: BoxDecoration(
                                      color: Colors.black54,
                                      borderRadius: BorderRadius.circular(9),
                                    ),
                                    child: const Icon(Icons.close,
                                        size: 12, color: Colors.white),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
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
