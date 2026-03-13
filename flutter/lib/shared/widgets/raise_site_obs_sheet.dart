import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/injection_container.dart';

/// Generic bottom sheet for raising a new site observation.
/// Used by both Quality and EHS modules. Photos are compressed + uploaded
/// directly (not via bloc) to avoid shared bloc state pollution.
class RaiseSiteObsSheet extends StatefulWidget {
  final String title;

  /// Category options shown in a chip group.
  final List<String> categories;

  /// Whether to show an optional free-text location field.
  final bool showLocationField;

  /// Callback when the user submits — receives description, severity,
  /// optional category, optional location label, and uploaded photo URLs.
  final Future<void> Function({
    required String description,
    required String severity,
    String? category,
    String? locationLabel,
    List<String> photoUrls,
  }) onSubmit;

  const RaiseSiteObsSheet({
    super.key,
    required this.title,
    required this.categories,
    required this.onSubmit,
    this.showLocationField = false,
  });

  /// Convenience launcher
  static Future<void> show(
    BuildContext context, {
    required String title,
    required List<String> categories,
    required Future<void> Function({
      required String description,
      required String severity,
      String? category,
      String? locationLabel,
      List<String> photoUrls,
    }) onSubmit,
    bool showLocationField = false,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => RaiseSiteObsSheet(
        title: title,
        categories: categories,
        onSubmit: onSubmit,
        showLocationField: showLocationField,
      ),
    );
  }

  @override
  State<RaiseSiteObsSheet> createState() => _RaiseSiteObsSheetState();
}

class _RaiseSiteObsSheetState extends State<RaiseSiteObsSheet> {
  final _formKey = GlobalKey<FormState>();
  final _descCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();

  // DB enum values: INFO | MINOR | MAJOR | CRITICAL  (uppercase, must match exactly)
  String _severity = 'MINOR';
  String? _category;
  final List<String> _photoUrls = [];
  bool _uploading = false;
  bool _submitting = false;
  String? _errorMessage;

  static const _severities = ['INFO', 'MINOR', 'MAJOR', 'CRITICAL'];
  static const _severityColors = {
    'INFO': Color(0xFF16A34A),
    'MINOR': Color(0xFFD97706),
    'MAJOR': Color(0xFFDC2626),
    'CRITICAL': Color(0xFFB91C1C),
  };
  static const _severityLabels = {
    'INFO': 'Info',
    'MINOR': 'Minor',
    'MAJOR': 'Major',
    'CRITICAL': 'Critical',
  };

  @override
  void dispose() {
    _descCtrl.dispose();
    _locationCtrl.dispose();
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
      if (url.isNotEmpty) {
        setState(() => _photoUrls.add(url));
      }
      PhotoCompressor.deleteTempFile(compressed);
    } catch (e) {
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
        description: _descCtrl.text.trim(),
        severity: _severity,
        category: _category,
        locationLabel: widget.showLocationField &&
                _locationCtrl.text.trim().isNotEmpty
            ? _locationCtrl.text.trim()
            : null,
        photoUrls: List.unmodifiable(_photoUrls),
      );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
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
          // Handle bar
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
                    // Title
                    Text(
                      widget.title,
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 16),

                    // Description
                    TextFormField(
                      controller: _descCtrl,
                      autofocus: true,
                      maxLines: 3,
                      maxLength: 500,
                      decoration: const InputDecoration(
                        labelText: 'Description *',
                        hintText: 'Describe the observation…',
                        border: OutlineInputBorder(),
                        alignLabelWithHint: true,
                      ),
                      validator: (v) =>
                          v?.trim().isEmpty ?? true
                              ? 'Description is required'
                              : null,
                    ),
                    const SizedBox(height: 12),

                    // Severity chips
                    Text('Severity',
                        style: theme.textTheme.labelLarge
                            ?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: _severities.map((s) {
                        final color = _severityColors[s]!;
                        final selected = _severity == s;
                        return FilterChip(
                          label: Text(_severityLabels[s]!),
                          selected: selected,
                          onSelected: (_) => setState(() => _severity = s),
                          selectedColor: color.withValues(alpha: 0.15),
                          checkmarkColor: color,
                          side: BorderSide(
                              color: selected
                                  ? color
                                  : theme.dividerColor,
                              width: selected ? 1.5 : 1.0),
                          labelStyle: TextStyle(
                            color: selected
                                ? color
                                : theme.colorScheme.onSurface
                                    .withValues(alpha: 0.7),
                            fontWeight: selected
                                ? FontWeight.w700
                                : FontWeight.w500,
                            fontSize: 12,
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),

                    // Category chips (if provided)
                    if (widget.categories.isNotEmpty) ...[
                      Text('Category',
                          style: theme.textTheme.labelLarge
                              ?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: widget.categories.map((c) {
                          final selected = _category == c;
                          return FilterChip(
                            label: Text(c),
                            selected: selected,
                            onSelected: (_) => setState(
                              () => _category = selected ? null : c,
                            ),
                            labelStyle: const TextStyle(fontSize: 12),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Optional location field
                    if (widget.showLocationField) ...[
                      TextFormField(
                        controller: _locationCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Location (optional)',
                          hintText: 'e.g. Tower A, Floor 3',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.location_on_outlined),
                          isDense: true,
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Photos strip
                    Row(
                      children: [
                        Text('Photos (${_photoUrls.length}/5)',
                            style: theme.textTheme.labelLarge
                                ?.copyWith(fontWeight: FontWeight.w600)),
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
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8)),
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
                                  onTap: () => setState(
                                      () => _photoUrls.removeAt(i)),
                                  child: Container(
                                    width: 18,
                                    height: 18,
                                    decoration: BoxDecoration(
                                      color: Colors.black54,
                                      borderRadius:
                                          BorderRadius.circular(9),
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

                    // Error
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _errorMessage!,
                        style: TextStyle(
                            color: theme.colorScheme.error, fontSize: 12),
                      ),
                    ],
                    const SizedBox(height: 16),

                    // Actions
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
                                : const Icon(Icons.send_rounded, size: 16),
                            label: Text(
                                _submitting ? 'Raising…' : 'Raise Observation'),
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
