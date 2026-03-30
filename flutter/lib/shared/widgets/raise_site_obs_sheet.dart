import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/injection_container.dart';

/// Generic bottom sheet for raising a new site observation.
/// Used by both Quality and EHS modules. Photos are compressed + uploaded
/// directly (not via bloc) to avoid shared bloc state pollution.
///
/// Location is selected from the project EPS tree (Block → Tower → Floor)
/// and stored as both [epsNodeId] and a human-readable [locationLabel].
class RaiseSiteObsSheet extends StatefulWidget {
  final String title;
  final int projectId;

  /// Category options shown in a chip group.
  final List<String> categories;

  /// Callback when the user submits — receives description, severity,
  /// optional category, optional EPS node id + label, and uploaded photo URLs.
  final Future<void> Function({
    required String description,
    required String severity,
    String? category,
    int? epsNodeId,
    String? locationLabel,
    List<String> photoUrls,
  }) onSubmit;

  const RaiseSiteObsSheet({
    super.key,
    required this.title,
    required this.projectId,
    required this.categories,
    required this.onSubmit,
  });

  /// Convenience launcher
  static Future<void> show(
    BuildContext context, {
    required String title,
    required int projectId,
    required List<String> categories,
    required Future<void> Function({
      required String description,
      required String severity,
      String? category,
      int? epsNodeId,
      String? locationLabel,
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
      builder: (_) => RaiseSiteObsSheet(
        title: title,
        projectId: projectId,
        categories: categories,
        onSubmit: onSubmit,
      ),
    );
  }

  @override
  State<RaiseSiteObsSheet> createState() => _RaiseSiteObsSheetState();
}

class _RaiseSiteObsSheetState extends State<RaiseSiteObsSheet> {
  final _formKey = GlobalKey<FormState>();
  final _descCtrl = TextEditingController();

  String _severity = 'MINOR';
  String? _category;
  int? _epsNodeId;
  String? _locationLabel;
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
    super.dispose();
  }

  /// Shows camera/gallery picker → markup editor → compresses → uploads.
  Future<void> _pickPhoto() async {
    if (_photoUrls.length >= 5) return;

    // Ask user: camera or gallery
    final source = await _choosePhotoSource();
    if (source == null) return;

    final xfile = await ImagePicker().pickImage(
      source: source,
      imageQuality: 70,
    );
    if (xfile == null || !mounted) return;

    // Guard: reject files > 15 MB before attempting compression
    final fileSizeBytes = await File(xfile.path).length();
    if (fileSizeBytes > 15 * 1024 * 1024) {
      if (mounted) {
        setState(() =>
            _errorMessage = 'Image too large. Please retake or choose another.');
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
      final result = await sl<SetuApiClient>().uploadFile(filePath: compressed);
      final url = result['url'] as String? ?? result['path'] as String? ?? '';
      if (url.isNotEmpty) setState(() => _photoUrls.add(url));
    } catch (_) {
      if (mounted) {
        setState(() => _errorMessage = 'Photo upload failed. Please retry.');
      }
    } finally {
      if (compressed != null) PhotoCompressor.deleteTempFile(compressed);
      if (annotatedPath != null) PhotoCompressor.deleteTempFile(annotatedPath);
      PhotoCompressor.deleteTempFile(xfile.path);
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<ImageSource?> _choosePhotoSource() async {
    return showModalBottomSheet<ImageSource>(
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
  }

  /// Opens the EPS tree picker to select a location node.
  Future<void> _pickLocation() async {
    final result = await showDialog<({int id, String label})>(
      context: context,
      builder: (_) => _EpsPickerDialog(projectId: widget.projectId),
    );
    if (result != null) {
      setState(() {
        _epsNodeId = result.id;
        _locationLabel = result.label;
      });
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
        epsNodeId: _epsNodeId,
        locationLabel: _locationLabel,
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
                              color: selected ? color : theme.dividerColor,
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

                    // Location picker — from EPS tree
                    Text('Location',
                        style: theme.textTheme.labelLarge
                            ?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: _pickLocation,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          border: Border.all(color: theme.dividerColor),
                          borderRadius: BorderRadius.circular(8),
                          color: theme.colorScheme.surfaceContainerLowest,
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.location_on_outlined,
                                size: 16,
                                color: _locationLabel != null
                                    ? theme.colorScheme.primary
                                    : theme.colorScheme.onSurface
                                        .withValues(alpha: 0.4)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _locationLabel ?? 'Select location from EPS…',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: _locationLabel != null
                                      ? theme.colorScheme.onSurface
                                      : theme.colorScheme.onSurface
                                          .withValues(alpha: 0.4),
                                ),
                              ),
                            ),
                            Icon(Icons.arrow_drop_down,
                                color: theme.colorScheme.onSurface
                                    .withValues(alpha: 0.4)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Photos
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
                      PhotoThumbnailStrip(
                        photoUrls: _photoUrls,
                        canDelete: true,
                        onDelete: (url) =>
                            setState(() => _photoUrls.remove(url)),
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

// ─── EPS Picker Dialog ────────────────────────────────────────────────────────

class _EpsPickerDialog extends StatefulWidget {
  final int projectId;
  const _EpsPickerDialog({required this.projectId});

  @override
  State<_EpsPickerDialog> createState() => _EpsPickerDialogState();
}

class _EpsPickerDialogState extends State<_EpsPickerDialog> {
  List<EpsTreeNode>? _nodes;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await sl<SetuApiClient>().getEpsTreeForProject(widget.projectId);
      var nodes = raw
          .map((e) => EpsTreeNode.fromJson(e as Map<String, dynamic>))
          .toList();
      // The API returns [projectRoot] where projectRoot.children are the actual
      // EPS nodes (blocks, towers). Skip the root to show blocks at the top level.
      if (nodes.length == 1 && nodes.first.children.isNotEmpty) {
        nodes = nodes.first.children;
      }
      if (mounted) setState(() => _nodes = nodes);
    } catch (_) {
      if (mounted) setState(() => _error = 'Failed to load locations.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 40),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
            child: Row(
              children: [
                const Icon(Icons.account_tree_outlined, size: 20),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text('Select Location',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700)),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: _error != null
                ? Center(child: Text(_error!))
                : _nodes == null
                    ? const Center(child: CircularProgressIndicator())
                    : _nodes!.isEmpty
                        ? const Center(
                            child: Text('No locations found.'))
                        : ListView(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            children: _nodes!
                                .map((n) => _EpsNodeTile(
                                      node: n,
                                      depth: 0,
                                      parentLabels: const [],
                                      onSelected: (nodeId, fullLabel) =>
                                          Navigator.of(context).pop(
                                        (id: nodeId, label: fullLabel),
                                      ),
                                    ))
                                .toList(),
                          ),
          ),
        ],
      ),
    );
  }
}

class _EpsNodeTile extends StatefulWidget {
  final EpsTreeNode node;
  final int depth;
  /// Labels of all ancestors, ordered from root to immediate parent.
  /// Used to build the full breadcrumb when the user selects this node.
  final List<String> parentLabels;
  /// Called with (nodeId, fullBreadcrumbLabel) when a selectable node is tapped.
  final void Function(int nodeId, String fullLabel) onSelected;

  const _EpsNodeTile({
    required this.node,
    required this.depth,
    required this.onSelected,
    this.parentLabels = const [],
  });

  @override
  State<_EpsNodeTile> createState() => _EpsNodeTileState();
}

class _EpsNodeTileState extends State<_EpsNodeTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final node = widget.node;
    final hasChildren = node.children.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () {
            if (hasChildren) {
              // Parent node: toggle expand/collapse only — never select here.
              // Selecting the dialog would close it before the user navigates down.
              setState(() => _expanded = !_expanded);
            } else {
              // Leaf node: build full breadcrumb and return to the sheet.
              final fullLabel = [...widget.parentLabels, node.label].join(' › ');
              widget.onSelected(node.id, fullLabel);
            }
          },
          borderRadius: BorderRadius.circular(6),
          child: Padding(
            padding: EdgeInsets.only(
              left: 8.0 + widget.depth * 16.0,
              right: 8,
              top: 10,
              bottom: 10,
            ),
            child: Row(
              children: [
                Icon(_nodeIcon(node.type), size: 16,
                    color: hasChildren
                        ? theme.colorScheme.primary.withValues(alpha: 0.7)
                        : theme.colorScheme.onSurface.withValues(alpha: 0.55)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    node.label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: hasChildren ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ),
                if (hasChildren)
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    size: 18,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.45),
                  )
                else
                  Icon(
                    Icons.radio_button_unchecked,
                    size: 14,
                    color: theme.colorScheme.primary.withValues(alpha: 0.5),
                  ),
              ],
            ),
          ),
        ),
        if (_expanded && hasChildren)
          ...node.children.map((child) => _EpsNodeTile(
                node: child,
                depth: widget.depth + 1,
                parentLabels: [...widget.parentLabels, node.label],
                onSelected: widget.onSelected,
              )),
      ],
    );
  }

  IconData _nodeIcon(String? type) {
    switch (type?.toLowerCase()) {
      case 'floor':
        return Icons.layers_outlined;
      case 'building':
      case 'tower':
        return Icons.apartment_outlined;
      case 'unit':
      case 'room':
        return Icons.meeting_room_outlined;
      case 'block':
        return Icons.grid_view_outlined;
      default:
        return Icons.folder_outlined;
    }
  }
}
