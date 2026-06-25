import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_edit_helper.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart' as proj;
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/observation_rating.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/observation_rating_selector.dart';
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

  /// When true, replaces the legacy 4-value severity chips with the
  /// five-option [ObservationRatingSelector] (Quality module only — EHS has
  /// no quality-impact rating concept and keeps the plain severity chips).
  final bool showObservationRating;

  /// Callback when the user submits — receives description, severity,
  /// optional rating (Quality only), optional category, optional EPS node
  /// id + label, and uploaded photo URLs.
  final Future<void> Function({
    required String description,
    required String severity,
    String? observationRating,
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
    this.showObservationRating = false,
    required this.onSubmit,
  });

  /// Convenience launcher
  static Future<void> show(
    BuildContext context, {
    required String title,
    required int projectId,
    required List<String> categories,
    bool showObservationRating = false,
    required Future<void> Function({
      required String description,
      required String severity,
      String? observationRating,
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
        showObservationRating: showObservationRating,
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
  QualityObservationRating? _rating;
  String? _category;
  int? _epsNodeId;
  String? _locationLabel;
  /// True when the picker dialog found no locations (cache empty + offline).
  /// Used to block submission and guide the user to go online first.
  bool _locationUnavailableOffline = false;
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

  /// Copies the compressed photo to the app's persistent pending-observations
  /// directory so it survives process kill until the sync service can upload it.
  Future<String> _savePhotoLocally(String sourcePath) async {
    final dir = await getApplicationDocumentsDirectory();
    final pendingDir = Directory(p.join(dir.path, 'pending_obs_photos'));
    await pendingDir.create(recursive: true);
    final fileName = '${DateTime.now().millisecondsSinceEpoch}_site_obs.jpg';
    final dest = File(p.join(pendingDir.path, fileName));
    await File(sourcePath).copy(dest.path);
    return dest.path;
  }

  /// Re-opens an already-added photo in the annotation editor — lets the
  /// user touch it up again before the observation itself is submitted.
  /// See [editAddedPhoto] for how local-vs-already-uploaded photos differ.
  Future<void> _editPhoto(int index, String url) async {
    final newUrl = await editAddedPhoto(context, url);
    if (newUrl != null && mounted) {
      setState(() => _photoUrls[index] = newUrl);
    }
  }

  /// Shows camera/gallery picker → markup editor → compresses → uploads.
  /// When offline the compressed file is saved locally and added as a local
  /// path placeholder — [SyncService._resolvePhotos] uploads it on next sync.
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
    final annotationResult = await ImageAnnotationPage.show(context, xfile.path);
    final uploadPath = annotationResult?.flattenedImagePath ?? xfile.path;

    if (!mounted) return;
    setState(() => _uploading = true);
    String? compressed;
    bool savedLocally = false;
    try {
      compressed = await PhotoCompressor.compress(uploadPath);
      try {
        // Online path: upload immediately and store the server URL.
        final result = await sl<SetuApiClient>().uploadFile(filePath: compressed);
        final url = result['url'] as String? ?? result['path'] as String? ?? '';
        if (url.isNotEmpty && mounted) setState(() => _photoUrls.add(url));
      } catch (_) {
        // Offline path: persist the compressed copy locally.
        // SyncService._resolvePhotos() uploads it when connectivity returns.
        final localPath = await _savePhotoLocally(compressed);
        savedLocally = true;
        if (mounted) {
          setState(() => _photoUrls.add(localPath));
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('Photo saved locally — will upload when online.'),
            backgroundColor: Colors.orange.shade700,
            behavior: SnackBarBehavior.floating,
          ));
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() => _errorMessage = 'Could not capture photo. Please try again.');
      }
    } finally {
      // Delete the compressed temp file only when we did NOT save it as the
      // local copy — if savedLocally is true, the file IS the local copy.
      if (compressed != null && !savedLocally) {
        PhotoCompressor.deleteTempFile(compressed);
      }
      if (annotationResult != null) {
        PhotoCompressor.deleteTempFile(annotationResult.flattenedImagePath);
      }
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
      builder: (_) => _EpsPickerDialog(
        projectId: widget.projectId,
        onUnavailable: () {
          if (mounted) setState(() => _locationUnavailableOffline = true);
        },
      ),
    );
    if (result != null) {
      setState(() {
        _epsNodeId = result.id;
        _locationLabel = result.label;
        _locationUnavailableOffline = false;
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_locationUnavailableOffline && _epsNodeId == null) {
      setState(() => _errorMessage =
          'Connect to the internet to load locations before saving.');
      return;
    }
    if (widget.showObservationRating && _rating == null) {
      setState(() => _errorMessage = 'Select an observation rating.');
      return;
    }
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      await widget.onSubmit(
        description: _descCtrl.text.trim(),
        // The backend derives severity from observationRating when present
        // — this is only the fallback value for non-Quality (EHS) callers.
        severity: widget.showObservationRating
            ? _rating!.legacySiteSeverity
            : _severity,
        observationRating: widget.showObservationRating ? _rating!.apiValue : null,
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

                    // Severity chips (EHS) or the five-option observation
                    // rating selector (Quality) — never both.
                    if (widget.showObservationRating)
                      ObservationRatingSelector(
                        value: _rating,
                        onChanged: (r) => setState(() => _rating = r),
                      )
                    else ...[
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
                    ],
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
                            backgroundColor: theme.colorScheme.surfaceContainerLowest,
                            selectedColor:
                                theme.colorScheme.primary.withValues(alpha: 0.15),
                            checkmarkColor: theme.colorScheme.primary,
                            side: BorderSide(
                                color: selected
                                    ? theme.colorScheme.primary
                                    : theme.dividerColor),
                            labelStyle: TextStyle(
                              fontSize: 12,
                              fontWeight:
                                  selected ? FontWeight.w700 : FontWeight.w500,
                              color: selected
                                  ? theme.colorScheme.primary
                                  : theme.colorScheme.onSurface,
                            ),
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
                    if (_locationUnavailableOffline && _epsNodeId == null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: const Color(0xFFFCA5A5)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.wifi_off_rounded,
                                size: 14, color: Color(0xFFDC2626)),
                            SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'No locations available offline. '
                                'Go online to load EPS locations first.',
                                style: TextStyle(
                                    fontSize: 11, color: Color(0xFFDC2626)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    InkWell(
                      onTap: _locationUnavailableOffline ? null : _pickLocation,
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
                        onEdit: (index, url) => _editPhoto(index, url),
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
  /// Called when the picker finds no cached locations (offline + empty cache).
  /// The parent sheet uses this to set a flag that blocks submission and
  /// guides the user to connect to the internet first.
  final VoidCallback? onUnavailable;

  const _EpsPickerDialog({
    required this.projectId,
    this.onUnavailable,
  });

  @override
  State<_EpsPickerDialog> createState() => _EpsPickerDialogState();
}

class _EpsPickerDialogState extends State<_EpsPickerDialog> {
  List<EpsTreeNode>? _nodes;
  String? _error;
  String? _appVersionLabel;

  @override
  void initState() {
    super.initState();
    _load();
    // Stamps the installed build onto every screenshot of this dialog so a
    // bug report can never be mistaken for an older build that already
    // shipped a fix — this exact ambiguity has cost a full debugging round
    // trip before.
    PackageInfo.fromPlatform().then((info) {
      if (mounted) setState(() => _appVersionLabel = '${info.version}+${info.buildNumber}');
    });
  }

  /// Converts the projects-list EPS shape into the tree shape this dialog
  /// renders — same fields, different model class (each was written against
  /// a different endpoint that happens to return identically-shaped data).
  EpsTreeNode _convertEpsNode(proj.EpsNode node) {
    return EpsTreeNode(
      id: node.id,
      label: node.name,
      type: node.type,
      children: node.children.map(_convertEpsNode).toList(),
    );
  }

  /// Loads the location tree, preferring the EPS data already embedded in
  /// the projects list (`ProjectBloc`'s `ProjectsLoaded.projects[i].children`)
  /// — fetched once at app start and held in memory for the whole session.
  /// This "initial config" data is what every other working location-aware
  /// screen in the app (e.g. the Quality dashboard) effectively relies on,
  /// whereas this dialog previously made its own separate live call to
  /// `/eps/:id/tree` that was producing an empty result for at least one
  /// real project despite the same data being available via the project
  /// list — so it's the more reliable source, not just a redundant cache.
  ///
  /// Falls back to the Drift cache, then a live fetch, only if the project
  /// isn't found in `ProjectBloc`'s state (e.g. opened via a deep link
  /// before the project list has loaded).
  Future<void> _load() async {
    final projectState = context.read<ProjectBloc>().state;
    if (projectState is ProjectsLoaded) {
      final project = projectState.projects
          .where((p) => p.id == widget.projectId)
          .firstOrNull;
      if (project != null && project.children.isNotEmpty) {
        if (mounted) {
          setState(() {
            _nodes = project.children.map(_convertEpsNode).toList();
            _error = null;
          });
        }
        return;
      }
    }
    await _loadFallback();
  }

  /// Cache-first so the picker is instantly usable even on a slow site
  /// network, then refreshes from the server in the background. Previously
  /// this fetched live first and only fell back to cache on failure — on a
  /// slow/flaky mobile connection the live call
  /// could take the full timeout before the (already-available) cache was
  /// ever consulted, making the picker look broken/empty.
  Future<void> _loadFallback() async {
    await _loadFromCache();
    try {
      final raw = await sl<SetuApiClient>().getEpsTreeForProject(widget.projectId);
      // Flatten the tree into a list of maps (preserving parentId) and cache it
      // to Drift so the offline picker has data the next time the user is offline.
      final flatNodes = <Map<String, dynamic>>[];
      void flatten(List<dynamic> nodes, int? parentId) {
        for (final n in nodes) {
          final m = n as Map<String, dynamic>;
          flatNodes.add({
            ...m,
            // Inject parentId — the raw map may not contain it if the server
            // only provides it via nesting rather than as an explicit field.
            if (parentId != null) 'parentId': parentId,
          });
          final children = m['children'];
          if (children is List && children.isNotEmpty) {
            flatten(children, m['id'] as int?);
          }
        }
      }
      flatten(raw, null);
      if (flatNodes.isNotEmpty) {
        await sl<AppDatabase>().cacheEpsNodes(flatNodes, widget.projectId);
      }

      var nodes = raw
          .map((e) => EpsTreeNode.fromJson(e as Map<String, dynamic>))
          .toList();
      // The API returns [projectRoot] where projectRoot.children are the actual
      // EPS nodes (blocks, towers). Skip the root to show blocks at the top level.
      if (nodes.length == 1 && nodes.first.children.isNotEmpty) {
        nodes = nodes.first.children;
      }
      // Don't let a successful-but-empty live response wipe out a non-empty
      // cached list — an empty result is far more likely to indicate a
      // transient/partial backend response than the project's locations
      // genuinely vanishing between the cache write and now.
      if (nodes.isEmpty && _nodes != null && _nodes!.isNotEmpty) {
        return;
      }
      if (mounted) {
        setState(() {
          _nodes = nodes;
          _error = null;
        });
      }
    } catch (_) {
      // Live refresh failed — if the cache load above also found nothing,
      // surface the unavailable state now.
      if (_nodes == null && mounted) {
        widget.onUnavailable?.call();
        setState(() => _error =
            'No locations available offline. Go online to load EPS locations first.');
      }
    }
  }

  Future<void> _loadFromCache() async {
    try {
      final cached = await sl<AppDatabase>().getEpsNodesForProject(widget.projectId);
      if (cached.isEmpty) return; // Let the live fetch attempt surface errors.
      // Build parent→children map from flat list.
      final childrenByParent = <int?, List<EpsTreeNode>>{};
      for (final n in cached) {
        childrenByParent.putIfAbsent(n.parentId, () => []);
        childrenByParent[n.parentId]!.add(EpsTreeNode(
          id: n.id,
          label: n.name,
          type: n.type,
          children: const [],
        ));
      }
      // Recursively attach children.
      List<EpsTreeNode> attach(List<EpsTreeNode> nodes) {
        return nodes.map((n) {
          final kids = childrenByParent[n.id] ?? [];
          return EpsTreeNode(id: n.id, label: n.label, type: n.type, children: attach(kids));
        }).toList();
      }
      var roots = attach(childrenByParent[null] ?? []);
      // Mirror the API convention: skip single project-root wrapper.
      if (roots.length == 1 && roots.first.children.isNotEmpty) {
        roots = roots.first.children;
      }
      if (mounted) setState(() => _nodes = roots);
    } catch (_) {
      // Cache read failed — live fetch attempt will still run.
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
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Select Location',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w700)),
                      if (_appVersionLabel != null)
                        Text('App v$_appVersionLabel',
                            style: TextStyle(
                                fontSize: 10, color: Colors.grey.shade500)),
                    ],
                  ),
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
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Text('No locations found.',
                                      textAlign: TextAlign.center),
                                  const SizedBox(height: 8),
                                  // Surfaces which backend this request actually
                                  // hit — the EPS tree call succeeded but came
                                  // back empty, which most often means this
                                  // device is connected to a different server
                                  // than wherever the structure was created
                                  // (e.g. the web app). Check Settings > Server.
                                  Text(
                                    'Connected to: ${ApiEndpoints.baseUrl}',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                        fontSize: 11, color: Colors.grey.shade500),
                                  ),
                                ],
                              ),
                            ),
                          )
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
