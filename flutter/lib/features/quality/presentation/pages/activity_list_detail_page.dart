import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/core/network/connectivity_banner.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart'
    hide SubmitRectification;
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/inspection_detail_page.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/activity_card.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/observation_card.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/paginated_list_view.dart';

/// Shows the activities inside a selected checklist, allowing the site engineer
/// to raise RFIs and submit rectifications for pending observations.
///
/// Activities are displayed as cards with status badges:
///   • locked — prerequisite not met
///   • ready — user can raise an RFI
///   • pending — RFI raised, awaiting inspector
///   • pendingObservation — inspector raised an observation; engineer must fix
///   • approved — all stages passed
///   • rejected — RFI was rejected
class ActivityListDetailPage extends StatefulWidget {
  final QualityActivityList list;
  final int projectId;
  final int epsNodeId;

  const ActivityListDetailPage({
    super.key,
    required this.list,
    required this.projectId,
    required this.epsNodeId,
  });

  @override
  State<ActivityListDetailPage> createState() =>
      _ActivityListDetailPageState();
}

class _ActivityListDetailPageState extends State<ActivityListDetailPage> {
  /// Last successfully loaded state — shown while background refresh runs
  /// (e.g. after raising an RFI) so the list stays visible.
  ActivitiesLoaded? _lastActivities;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Checklist name as the page title
            Text(widget.list.name,
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.bold)),
            // Optional checklist description as subtitle
            if (widget.list.description != null)
              Text(widget.list.description!,
                  style: const TextStyle(
                      fontSize: 11, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          // Manual refresh for the activity list
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => context
                .read<QualityRequestBloc>()
                .add(const RefreshCurrentList()),
          ),
        ],
      ),
      body: Column(
        children: [
          // Offline / connectivity banner at the top
          const ConnectivityBanner(),
          Expanded(
            child: BlocConsumer<QualityRequestBloc, QualityRequestState>(
              listener: (context, state) {
                // RFI raised — show success or queued snack
                if (state is RfiQueued) {
                  final msg = state.isOffline
                      ? 'RFI queued — will sync when online'
                      : 'RFI raised successfully';
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(msg),
                    backgroundColor: state.isOffline
                        ? Colors.orange.shade700
                        : Colors.green.shade700,
                  ));
                }
                // Rectification submitted — show success or queued snack
                if (state is RectificationQueued) {
                  final msg = state.isOffline
                      ? 'Rectification queued — will sync when online'
                      : 'Rectification submitted successfully';
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(msg),
                    backgroundColor: state.isOffline
                        ? Colors.orange.shade700
                        : Colors.green.shade700,
                  ));
                }
                // Generic error — show a red snack
                if (state is QualityRequestError) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(state.message),
                    backgroundColor: Colors.red.shade700,
                  ));
                }
              },
              builder: (context, state) {
                // Cache last loaded state for use during background operations
                // (so the list stays visible while an RFI is being submitted)
                if (state is ActivitiesLoaded) _lastActivities = state;

                // Full-screen spinner only on initial list load with no cache
                if (state is QualityRequestLoading &&
                    state.source == QrLoadingSource.listLoad &&
                    _lastActivities == null) {
                  return const Center(child: CircularProgressIndicator());
                }

                // Prefer the fresh state; fall back to the cached snapshot
                final display = state is ActivitiesLoaded
                    ? state
                    : _lastActivities;

                if (display != null) {
                  // Show thin progress bar at top for background operations
                  // (e.g. RFI submission in progress)
                  final showBar = state is QualityRequestLoading &&
                      state.source != QrLoadingSource.listLoad;
                  return Stack(
                    children: [
                      _ActivityListBody(
                        state: display,
                        projectId: widget.projectId,
                        epsNodeId: widget.epsNodeId,
                        listId: widget.list.id,
                      ),
                      // Thin linear progress bar overlaid at the top
                      if (showBar)
                        const Positioned(
                          top: 0,
                          left: 0,
                          right: 0,
                          child: LinearProgressIndicator(),
                        ),
                    ],
                  );
                }

                // Fallback while waiting for state to arrive
                return const Center(child: CircularProgressIndicator());
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------

/// Body of the activity list: progress summary bar + the scrollable list.
class _ActivityListBody extends StatelessWidget {
  final ActivitiesLoaded state;
  final int projectId;
  final int epsNodeId;
  final int listId;

  const _ActivityListBody({
    required this.state,
    required this.projectId,
    required this.epsNodeId,
    required this.listId,
  });

  @override
  Widget build(BuildContext context) {
    final rows = state.rows;

    return Column(
      children: [
        // Horizontal progress bar showing approved / total ratio
        _ProgressBar(rows: rows),

        // Offline data banner when the list came from local cache
        if (state.isFromCache)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            color: Colors.orange.shade50,
            child: Row(
              children: [
                Icon(Icons.offline_bolt_outlined,
                    size: 14, color: Colors.orange.shade700),
                const SizedBox(width: 6),
                Text('Showing cached data',
                    style: TextStyle(
                        fontSize: 12, color: Colors.orange.shade700)),
              ],
            ),
          ),

        // Scrollable activity card list
        Expanded(
          child: rows.isEmpty
              ? const Center(child: Text('No activities in this list'))
              : RefreshIndicator(
                  // Pull-to-refresh triggers a background refresh
                  onRefresh: () async => context
                      .read<QualityRequestBloc>()
                      .add(const RefreshCurrentList()),
                  child: PaginatedListView<ActivityRow>(
                    items: rows,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemBuilder: (context, row, i) {
                      final status = row.displayStatus;

                      // Determine which CTA is available based on status
                      final canRaiseRfi =
                          status == ActivityDisplayStatus.ready;
                      // Allow raising additional parts / units when the
                      // activity isn't locked or fully approved.
                      final canRaiseMore =
                          status != ActivityDisplayStatus.locked &&
                              status != ActivityDisplayStatus.approved;

                      return ActivityCard(
                        row: row,
                        // "Raise RFI" callback only available for ready activities
                        onRaiseRfi: canRaiseRfi
                            ? () => _showRfiDialog(context, row.activity)
                            : null,
                        // Multi-Go: raise a specific part number
                        onRaisePart: canRaiseMore
                            ? (partNo, totalParts) => _raiseRfiPart(
                                context, row, partNo, totalParts)
                            : null,
                        // Unit Wise: raise RFI for a specific unit
                        onRaiseUnit: canRaiseMore
                            ? (unitId, unitName) =>
                                _raiseUnitRfi(context, row, unitId)
                            : null,
                        // Navigate to approval page when pending observations exist
                        onViewApproval: row.inspection != null &&
                                row.observations.any((o) =>
                                    o.status == ObservationStatus.pending ||
                                    o.status == ObservationStatus.rectified)
                            ? (inspection) =>
                                _openInspectionApproval(context, inspection)
                            : null,
                        // Expand GO series: add more GOs to an existing series
                        onExpandGo: canRaiseMore &&
                                row.allInspections.isNotEmpty &&
                                row.activity.applicabilityLevel != 'UNIT'
                            ? () => _showExpandGoDialog(context, row)
                            : null,
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  /// Navigates to [InspectionDetailPage] for [inspection] in approval mode.
  /// Provides a fresh [QualityApprovalBloc] so the detail page can load
  /// the checklist stages, observations and workflow independently of any
  /// parent bloc that may not exist in this navigator branch.
  void _openInspectionApproval(
      BuildContext context, QualityInspection inspection) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider(
          create: (_) => sl<QualityApprovalBloc>(),
          child: InspectionDetailPage(inspection: inspection),
        ),
      ),
    ).then((_) {
      // Refresh the activity list when returning so the status badge updates
      if (context.mounted) {
        context.read<QualityRequestBloc>().add(const RefreshCurrentList());
      }
    });
  }

  /// Opens the Raise RFI dialog, passing the activity and the required context
  /// (project, EPS node, list) for the [RaiseRfi] event.
  void _showRfiDialog(BuildContext context, QualityActivity activity) {
    // Capture the current user before entering the dialog builder so we can
    // decide whether to show the vendor picker (internal user) or auto-select
    // the vendor from the user's own company (temp/vendor user).
    final authState = context.read<AuthBloc>().state;
    final currentUser =
        authState is AuthAuthenticated ? authState.user : null;

    showDialog(
      context: context,
      builder: (ctx) {
        return _RaiseRfiDialog(
          activity: activity,
          projectId: projectId,
          epsNodeId: epsNodeId,
          listId: listId,
          // Pass the parent bloc by reference so the dialog can dispatch events
          bloc: context.read<QualityRequestBloc>(),
          currentUser: currentUser,
        );
      },
    );
  }

  /// Opens the full RFI dialog to raise a specific part of a multi-GO series.
  /// Shows the same fields as the first GO (drawing no, element name, GO details,
  /// vendor, comments) with the GO mode selector hidden since partNo is fixed.
  void _raiseRfiPart(
      BuildContext context, ActivityRow row, int partNo, int totalParts) {
    final authState = context.read<AuthBloc>().state;
    final currentUser = authState is AuthAuthenticated ? authState.user : null;
    showDialog(
      context: context,
      builder: (ctx) => _RaiseRfiDialog(
        activity: row.activity,
        projectId: projectId,
        epsNodeId: epsNodeId,
        listId: listId,
        bloc: context.read<QualityRequestBloc>(),
        currentUser: currentUser,
        partNo: partNo,
        totalParts: totalParts,
        initialVendorId: row.inspection?.vendorId,
        initialVendorName: row.inspection?.vendorName,
      ),
    );
  }

  /// Shows a compact drawing-number prompt then raises a Unit Wise RFI for
  /// a single unit. Reuses the vendor from the existing inspection.
  void _raiseUnitRfi(BuildContext context, ActivityRow row, int unitId) {
    _showDrawingNoPrompt(
      context,
      title: 'Raise Unit RFI',
      onConfirm: (drawingNo) {
        context.read<QualityRequestBloc>().add(RaiseRfi(
              projectId: projectId,
              epsNodeId: epsNodeId,
              listId: listId,
              activity: row.activity,
              drawingNo: drawingNo,
              documentType: 'UNIT_RFI',
              qualityUnitId: unitId,
              vendorId: row.inspection?.vendorId,
              vendorName: row.inspection?.vendorName,
            ));
      },
    );
  }

  /// Shows a minimal dialog that collects a drawing number, then calls
  /// [onConfirm] with the trimmed value. Used for quick-raises from
  /// progress chips where the full RFI dialog is not needed again.
  /// Opens a dialog to expand the GO series for [row]'s activity.
  /// Loads the current totalParts from existing inspections and lets the user
  /// set a higher total — then calls the backend expand-go endpoint.
  void _showExpandGoDialog(BuildContext context, ActivityRow row) {
    final currentTotal =
        row.allInspections.fold(1, (max, i) => i.totalParts > max ? i.totalParts : max);
    int newTotal = currentTotal + 1;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('Add GO'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Activity: ${row.activity.activityName}',
                style: const TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 4),
              Text(
                'Current total GOs: $currentTotal',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Text('New total GOs:', style: TextStyle(fontSize: 13)),
                  const SizedBox(width: 12),
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline),
                    onPressed: newTotal > currentTotal + 1
                        ? () => setS(() => newTotal--)
                        : null,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                  const SizedBox(width: 8),
                  Text('$newTotal',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline),
                    onPressed: newTotal < 20
                        ? () => setS(() => newTotal++)
                        : null,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'GO ${currentTotal + 1}–$newTotal will be added to the series.',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await sl<SetuApiClient>().expandGoSeries(
                    projectId: projectId,
                    epsNodeId: epsNodeId,
                    activityId: row.activity.id,
                    newTotalParts: newTotal,
                  );
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(
                          'GO series expanded to $newTotal GOs. Raise the new GOs from the list.'),
                      backgroundColor: Colors.green.shade700,
                    ));
                    context
                        .read<QualityRequestBloc>()
                        .add(const RefreshCurrentList());
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text('Failed to expand GO series: $e'),
                      backgroundColor: Colors.red.shade700,
                    ));
                  }
                }
              },
              child: Text('Add ${newTotal - currentTotal} GO(s)'),
            ),
          ],
        ),
      ),
    );
  }

  void _showDrawingNoPrompt(
    BuildContext context, {
    required String title,
    required void Function(String drawingNo) onConfirm,
  }) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Text(title, style: const TextStyle(fontSize: 15)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Drawing Number *',
                  style: TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              TextField(
                controller: ctrl,
                autofocus: true,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'e.g. DWG-STR-001',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                onChanged: (_) => setS(() {}),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: ctrl.text.trim().isEmpty
                  ? null
                  : () {
                      final drawingNo = ctrl.text.trim();
                      Navigator.pop(ctx);
                      onConfirm(drawingNo);
                    },
              child: const Text('Raise RFI'),
            ),
          ],
        ),
      ),
    ).then((_) => ctrl.dispose());
  }

}

// ---------------------------------------------------------------------------
// Progress summary bar
// ---------------------------------------------------------------------------

/// Horizontal bar at the top of the list showing approved vs total activities.
class _ProgressBar extends StatelessWidget {
  final List<ActivityRow> rows;
  const _ProgressBar({required this.rows});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = rows.length;
    // Count only rows that have reached the approved status
    final approved =
        rows.where((r) => r.displayStatus == ActivityDisplayStatus.approved).length;
    final pct = total == 0 ? 0.0 : approved / total;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: theme.colorScheme.surfaceContainerLow,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Progress',
                  style: theme.textTheme.labelMedium
                      ?.copyWith(fontWeight: FontWeight.w600)),
              // Fraction label e.g. "4 / 12 approved"
              Text('$approved / $total approved',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                  )),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 6,
              backgroundColor:
                  theme.colorScheme.onSurface.withValues(alpha: 0.1),
              valueColor:
                  AlwaysStoppedAnimation<Color>(Colors.green.shade600),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Rectification bottom sheet (site engineer fixes observation)
// ---------------------------------------------------------------------------

/// Modal bottom sheet that lets the site engineer describe what was done to
/// address a raised observation and optionally attach photo evidence.
class _RectificationSheet extends StatefulWidget {
  final QualityActivity activity;
  final List<ActivityObservation> observations;
  final int projectId;

  const _RectificationSheet({
    required this.activity,
    required this.observations,
    required this.projectId,
  });

  @override
  State<_RectificationSheet> createState() => _RectificationSheetState();
}

class _RectificationSheetState extends State<_RectificationSheet> {
  // Which observation is being rectified (relevant when multiple exist)
  ActivityObservation? _selectedObs;
  final _textCtrl = TextEditingController();
  final List<String> _photoUrls = [];
  bool _submitting = false;
  bool _uploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    // Auto-select when there's only one observation to simplify the UX
    if (widget.observations.length == 1) {
      _selectedObs = widget.observations.first;
    }
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  /// Saves a photo to the app's pending-observations directory so it survives
  /// until the SyncService can upload it to the server — mirrors
  /// [RectifySheet._savePhotoLocally] (the working offline pattern used for
  /// site observation rectification).
  Future<String> _savePhotoLocally(String sourcePath) async {
    final dir = await getApplicationDocumentsDirectory();
    final pendingDir = Directory(p.join(dir.path, 'pending_obs_photos'));
    await pendingDir.create(recursive: true);
    final fileName = '${DateTime.now().millisecondsSinceEpoch}_activity_rectify.jpg';
    final dest = File(p.join(pendingDir.path, fileName));
    await File(sourcePath).copy(dest.path);
    return dest.path;
  }

  /// Opens the camera, routes the photo through the annotation editor,
  /// compresses it, uploads it, and appends the returned URL.
  ///
  /// When offline the upload throws — previously that just showed an error
  /// and discarded the compressed file, losing the photo entirely. Now it
  /// falls back to a persistent local copy (uploaded later by SyncService),
  /// same as every other photo-capture flow in the app.
  Future<void> _pickPhoto() async {
    final xfile = await ImagePicker().pickImage(source: ImageSource.camera);
    if (xfile == null || !mounted) return;

    // Allow the engineer to annotate (draw on) the photo before uploading
    final annotatedPath =
        await ImageAnnotationPage.show(context, xfile.path);
    final uploadPath = annotatedPath ?? xfile.path;

    if (!mounted) return;
    setState(() => _uploadingPhoto = true);
    String? compressedPath;
    bool savedLocally = false;
    try {
      // Compress to reduce upload size
      compressedPath = await PhotoCompressor.compress(uploadPath);
      try {
        final result =
            await sl<SetuApiClient>().uploadFile(filePath: compressedPath);
        final url =
            result['url'] as String? ?? result['path'] as String? ?? '';
        // Add the returned URL to the evidence list
        if (mounted && url.isNotEmpty) setState(() => _photoUrls.add(url));
      } catch (_) {
        // Offline path: persist the compressed copy locally so it isn't lost.
        final localPath = await _savePhotoLocally(compressedPath);
        savedLocally = true;
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Could not capture photo. Please try again.'),
          backgroundColor: Colors.red.shade700,
        ));
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
      // Don't delete the compressed file if it IS the local copy just saved.
      if (compressedPath != null && !savedLocally) {
        await PhotoCompressor.deleteTempFile(compressedPath);
      }
      await PhotoCompressor.deleteTempFile(xfile.path);
      if (annotatedPath != null) {
        await PhotoCompressor.deleteTempFile(annotatedPath);
      }
    }
  }

  /// Validates required fields and dispatches [SubmitRectification].
  void _submit() {
    // Both an observation and a description are required
    if (_selectedObs == null || _textCtrl.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    context.read<QualityRequestBloc>().add(SubmitRectification(
          activityId: widget.activity.id,
          obsId: _selectedObs!.id,
          closureText: _textCtrl.text.trim(),
          closureEvidence: List.from(_photoUrls),
        ));
    // Close the sheet — BlocConsumer on the parent page will show the result
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Respect the keyboard so the sheet slides up when the keyboard opens
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: theme.dividerColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Fix Observation',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),

          // Observation selector when multiple observations exist on this activity
          if (widget.observations.length > 1) ...[
            Text('Select Observation', style: theme.textTheme.labelLarge),
            const SizedBox(height: 8),
            // Tap a card to select the observation to rectify
            ...widget.observations.map((o) => ObservationCard(
                  obs: o,
                  // Disable the tap for the currently-selected one
                  onRectify: _selectedObs?.id == o.id
                      ? null
                      : () => setState(() => _selectedObs = o),
                )),
            const SizedBox(height: 12),
          ] else if (widget.observations.isNotEmpty)
            // Single observation — display read-only
            ObservationCard(obs: widget.observations.first),

          const SizedBox(height: 12),

          // Form fields only appear once an observation is selected
          if (_selectedObs != null) ...[
            // Free-text rectification description (required)
            TextField(
              controller: _textCtrl,
              maxLines: 4,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Rectification Details *',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
                hintText: 'Describe what was done to fix the observation…',
              ),
            ),
            const SizedBox(height: 12),
            // Photo thumbnail strip — shows uploaded evidence
            if (_photoUrls.isNotEmpty) ...[
              PhotoThumbnailStrip(
                photoUrls: _photoUrls,
                canDelete: true,
                // Allow the engineer to remove an uploaded photo
                onDelete: (url) => setState(() => _photoUrls.remove(url)),
              ),
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                // Camera button — disabled while uploading or submitting
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
                  label:
                      Text(_uploadingPhoto ? 'Uploading…' : 'Add Evidence'),
                ),
                const Spacer(),
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 8),
                // Submit button — disabled while uploading or submitting
                FilledButton(
                  onPressed: (_submitting || _uploadingPhoto) ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Text('Submit'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Raise RFI Dialog — One Go / Multi Go / Unit Wise
// ---------------------------------------------------------------------------

/// Dialog that collects inspection mode + vendor + optional comments before
/// raising an RFI (Request for Inspection) for a single activity.
///
/// Three modes are available based on [activity.applicabilityLevel]:
///   • FLOOR (or null) → One Go (single inspection) or Multi Go (N parts,
///     raises Part 1 now — remaining parts raised after approval).
///   • UNIT → Unit Wise: load units from floor structure, user picks which
///     units to inspect. One RFI is queued per selected unit.
class _RaiseRfiDialog extends StatefulWidget {
  final QualityActivity activity;
  final int projectId;
  final int epsNodeId;
  final int listId;
  final QualityRequestBloc bloc;

  /// The currently logged-in user. Used to distinguish vendor (temp) users
  /// from internal users so we can auto-select their company as the vendor
  /// instead of showing the picker.
  final User? currentUser;

  /// When set, the dialog is in "additional GO" mode — raises a specific
  /// part of an existing multi-GO series. Hides the GO mode selector and
  /// pre-populates the vendor from the existing inspection.
  final int? partNo;
  final int? totalParts;
  final int? initialVendorId;
  final String? initialVendorName;

  const _RaiseRfiDialog({
    required this.activity,
    required this.projectId,
    required this.epsNodeId,
    required this.listId,
    required this.bloc,
    this.currentUser,
    this.partNo,
    this.totalParts,
    this.initialVendorId,
    this.initialVendorName,
  });

  @override
  State<_RaiseRfiDialog> createState() => _RaiseRfiDialogState();
}

class _RaiseRfiDialogState extends State<_RaiseRfiDialog> {
  final _drawingNoCtrl = TextEditingController();
  final _elementNameCtrl = TextEditingController();
  final _goDetailsCtrl = TextEditingController();
  final _commentsCtrl = TextEditingController();

  // Vendor loading
  List<Map<String, dynamic>> _vendors = [];
  Map<String, dynamic>? _selectedVendor;
  bool _vendorLoading = true;
  String? _vendorError;

  // FLOOR mode: 'ONE_GO' or 'MULTI_GO'
  String _rfiMode = 'ONE_GO';
  int _rfiParts = 2;

  // UNIT mode — units fetched from floor structure API
  List<Map<String, dynamic>> _units = [];
  final Set<int> _selectedUnitIds = {};
  bool _unitsLoading = false;

  // Previous approved RFIs from the same floor/node — for the related checklist picker
  List<QualityInspection> _floorInspections = [];
  final Set<int> _selectedRelatedIds = {};
  bool _floorInspectionsLoading = false;

  bool get _isUnit => widget.activity.applicabilityLevel == 'UNIT';
  bool get _isFloor => !_isUnit;
  bool get _isAdditionalGo => widget.partNo != null;
  bool get _requiresElement =>
      widget.activity.requiresPourCard || widget.activity.requiresPourClearanceCard;

  @override
  void initState() {
    super.initState();
    _loadVendors();
    if (_isUnit) _loadUnits();
    if (_isFloor) _loadFloorInspections();
  }

  @override
  void dispose() {
    _drawingNoCtrl.dispose();
    _elementNameCtrl.dispose();
    _goDetailsCtrl.dispose();
    _commentsCtrl.dispose();
    super.dispose();
  }

  /// Shows the full context for a linked checklist RFI — the inline row only
  /// has room for a single truncated line of "GO label · activity · RFI #"
  /// plus the location, and never shows `goDetails` at all.
  void _showLinkedRfiDetail(BuildContext context, QualityInspection insp) {
    Widget detailLine(IconData icon, String label, String value, [Color? color]) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: Colors.grey.shade500),
            const SizedBox(width: 8),
            SizedBox(
              width: 96,
              child: Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
            ),
            Expanded(
              child: Text(value,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color)),
            ),
          ],
        ),
      );
    }

    final go = [
      if (insp.goLabel != null) insp.goLabel!,
      if (insp.goNo != null && insp.goLabel == null) 'GO ${insp.goNo}',
      if (insp.goDetails != null) insp.goDetails!,
    ].join(' — ');

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36, height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text('Linked Checklist Detail',
                style: Theme.of(ctx).textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            detailLine(Icons.checklist_rtl_outlined, 'Checklist Name', insp.activityName ?? '—'),
            detailLine(Icons.location_on_outlined, 'Element',
                insp.locationDisplay.isNotEmpty ? insp.locationDisplay : '—'),
            detailLine(Icons.assignment_outlined, 'GO Details', go.isEmpty ? '—' : go),
            if (insp.isMultiPart)
              detailLine(Icons.layers_outlined, 'Part', insp.partDisplay),
            if (insp.vendorName != null)
              detailLine(Icons.business_outlined, 'Vendor', insp.vendorName!),
            detailLine(Icons.flag_outlined, 'Status', insp.status.label, insp.status.color),
            detailLine(Icons.event_outlined, 'Requested', insp.requestDate),
          ],
        ),
      ),
    );
  }

  Future<void> _loadFloorInspections() async {
    setState(() => _floorInspectionsLoading = true);
    try {
      final raw = await sl<SetuApiClient>().getQualityInspections(
        projectId: widget.projectId,
        epsNodeId: widget.epsNodeId,
      );
      if (!mounted) return;
      final inspections = raw
          .whereType<Map<String, dynamic>>()
          .map(QualityInspection.fromJson)
          .where((i) =>
              i.status == InspectionStatus.approved ||
              i.status == InspectionStatus.partiallyApproved)
          .toList();
      setState(() {
        _floorInspections = inspections;
        _floorInspectionsLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _floorInspectionsLoading = false);
    }
  }

  Future<void> _loadVendors() async {
    final user = widget.currentUser;

    // Vendor (temp) users: auto-select their own company — no API call needed.
    if (user != null && user.isTempUser && user.vendorId != null) {
      setState(() {
        _selectedVendor = {
          'id': user.vendorId,
          'name': user.vendorName ?? 'My Company',
        };
        _vendorLoading = false;
      });
      return;
    }

    // Internal users: fetch the project's active vendor list.
    try {
      final vendors =
          await sl<SetuApiClient>().getActiveVendors(widget.projectId);
      if (!mounted) return;
      setState(() {
        _vendors = vendors;
        _vendorLoading = false;
        if (widget.initialVendorId != null) {
          // For additional GOs, pre-select the vendor from the existing inspection
          _selectedVendor = vendors.where((v) => v['id'] == widget.initialVendorId).firstOrNull
              ?? (vendors.length == 1 ? vendors.first : null);
        } else if (vendors.length == 1) {
          _selectedVendor = vendors.first;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _vendorLoading = false;
        _vendorError = 'Could not load vendors';
      });
    }
  }

  /// Fetches the unit list for the selected floor EPS node.
  Future<void> _loadUnits() async {
    setState(() => _unitsLoading = true);
    try {
      final units = await sl<SetuApiClient>()
          .getFloorStructure(widget.projectId, widget.epsNodeId);
      if (!mounted) return;
      setState(() {
        _units = units;
        _unitsLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _unitsLoading = false);
    }
  }

  bool get _canSubmit {
    if (_vendorLoading) return false;
    // Drawing number is required
    if (_drawingNoCtrl.text.trim().isEmpty) return false;
    // Element name is required for pour card / clearance activities
    if (_requiresElement && _elementNameCtrl.text.trim().isEmpty) return false;
    // Vendor required unless none exist or load failed
    if (_vendors.isNotEmpty &&
        _selectedVendor == null &&
        _vendorError == null) {
      return false;
    }
    // Unit Wise mode requires at least one unit selected
    if (_isUnit) return _selectedUnitIds.isNotEmpty;
    return true;
  }

  void _submit() {
    final drawingNo = _drawingNoCtrl.text.trim();
    final elementName = _elementNameCtrl.text.trim().isEmpty ? null : _elementNameCtrl.text.trim();
    final goDetails = _goDetailsCtrl.text.trim().isEmpty ? null : _goDetailsCtrl.text.trim();
    final comments = _commentsCtrl.text.trim().isEmpty ? null : _commentsCtrl.text.trim();
    final vendorId = _selectedVendor?['id'] as int?;
    final vendorName = _selectedVendor?['name'] as String?;
    final relatedIds = _selectedRelatedIds.toList();

    if (_isUnit) {
      // Queue one RFI per selected unit (Unit Wise mode)
      for (final unitId in _selectedUnitIds) {
        widget.bloc.add(RaiseRfi(
          projectId: widget.projectId,
          epsNodeId: widget.epsNodeId,
          listId: widget.listId,
          activity: widget.activity,
          drawingNo: drawingNo,
          comments: comments,
          documentType: 'UNIT_RFI',
          qualityUnitId: unitId,
          vendorId: vendorId,
          vendorName: vendorName,
          elementName: elementName,
        ));
      }
    } else {
      // Additional GO mode: partNo/totalParts are fixed from the existing series
      // First GO mode: derive from the selected inspection type
      final partNo = _isAdditionalGo ? widget.partNo! : 1;
      final totalParts = _isAdditionalGo
          ? widget.totalParts!
          : (_rfiMode == 'MULTI_GO' ? _rfiParts.clamp(2, 20) : 1);
      widget.bloc.add(RaiseRfi(
        projectId: widget.projectId,
        epsNodeId: widget.epsNodeId,
        listId: widget.listId,
        activity: widget.activity,
        drawingNo: drawingNo,
        comments: comments,
        partNo: partNo,
        totalParts: totalParts,
        partLabel: 'GO $partNo',
        documentType: 'FLOOR_RFI',
        vendorId: vendorId,
        vendorName: vendorName,
        elementName: elementName,
        goDetails: goDetails,
        relatedChecklistInspectionIds: relatedIds,
      ));
    }
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AlertDialog(
      title: Text(_isAdditionalGo
          ? 'Raise GO ${widget.partNo} of ${widget.totalParts}'
          : 'Raise RFI'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Activity name for context
            Text('Activity: ${widget.activity.activityName}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),

            // ── Drawing Number (required) ─────────────────────────────────
            const Text('Drawing Number *',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _drawingNoCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'e.g. DWG-STR-001',
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            // ── Element Name (required for pour card activities) ─────────
            Text(
              _requiresElement ? 'Element Name *' : 'Element Name',
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _elementNameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(
                border: const OutlineInputBorder(),
                hintText: 'e.g. Column C3, Slab Block A',
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                helperText: _requiresElement ? 'Required for pour card / clearance' : null,
                helperStyle: TextStyle(fontSize: 10, color: Colors.orange.shade700),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            // ── GO Details (FLOOR activities only) ───────────────────────
            if (_isFloor) ...[
              const Text('GO Details',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              TextField(
                controller: _goDetailsCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'Describe the inspection scope for this GO…',
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── Link Previous Checklist RFIs (FLOOR only) ────────────────
            if (_isFloor) ...[
              const Text('Link Previous Checklist RFIs',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 4),
              if (_floorInspectionsLoading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Row(children: [
                    SizedBox(width: 14, height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2)),
                    SizedBox(width: 8),
                    Text('Loading…', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ]),
                )
              else if (_floorInspections.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    'No previous approved RFIs available for this location.',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                  ),
                )
              else
                Column(
                  children: _floorInspections.map((insp) {
                    final isSelected = _selectedRelatedIds.contains(insp.id);
                    final label = [
                      if (insp.goLabel != null) insp.goLabel!,
                      if (insp.activityName != null) insp.activityName!,
                      'RFI #${insp.id}',
                    ].join(' · ');
                    final sublabel = insp.locationDisplay.isNotEmpty
                        ? insp.locationDisplay
                        : null;
                    return InkWell(
                      onTap: () => setState(() {
                        if (isSelected) {
                          _selectedRelatedIds.remove(insp.id);
                        } else {
                          _selectedRelatedIds.add(insp.id);
                        }
                      }),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          children: [
                            Checkbox(
                              value: isSelected,
                              visualDensity: VisualDensity.compact,
                              onChanged: (v) => setState(() {
                                if (v == true) {
                                  _selectedRelatedIds.add(insp.id);
                                } else {
                                  _selectedRelatedIds.remove(insp.id);
                                }
                              }),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(label,
                                      style: const TextStyle(fontSize: 12),
                                      overflow: TextOverflow.ellipsis),
                                  if (sublabel != null)
                                    Text(sublabel,
                                        style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                                        overflow: TextOverflow.ellipsis),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: insp.status.color.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                insp.status.label,
                                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: insp.status.color),
                              ),
                            ),
                            InkWell(
                              onTap: () => _showLinkedRfiDetail(context, insp),
                              borderRadius: BorderRadius.circular(12),
                              child: const Padding(
                                padding: EdgeInsets.only(left: 4),
                                child: Icon(Icons.info_outline_rounded,
                                    size: 14, color: Color(0xFF1D4ED8)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              const SizedBox(height: 16),
            ],

            // ── Vendor / contractor selector ─────────────────────────────
            if (_vendorLoading)
              const Row(children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                SizedBox(width: 8),
                Text('Loading vendors…', style: TextStyle(fontSize: 13)),
              ])
            // Vendor (temp) user: show their company as read-only — no picker.
            else if (widget.currentUser?.isTempUser == true &&
                _selectedVendor != null) ...[
              const Text('Vendor / Contractor',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade400),
                  borderRadius: BorderRadius.circular(4),
                  color: Colors.grey.shade100,
                ),
                child: Row(
                  children: [
                    const Icon(Icons.business, size: 16,
                        color: Colors.grey),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _selectedVendor!['name'] as String? ?? 'My Company',
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ]
            else if (_vendorError != null)
              Text('$_vendorError — will submit without vendor.',
                  style: const TextStyle(fontSize: 12, color: Colors.orange))
            else if (_vendors.isEmpty)
              const Text('No active vendors found for this project.',
                  style: TextStyle(fontSize: 12, color: Colors.grey))
            else ...[
              const Text('Vendor / Contractor *',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              DropdownButtonFormField<Map<String, dynamic>>(
                value: _selectedVendor,
                isExpanded: true,
                hint: const Text('Select vendor'),
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                items: _vendors
                    .map((v) => DropdownMenuItem(
                          value: v,
                          child: Text(
                            v['name'] as String? ?? 'Unknown',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _selectedVendor = v),
              ),
            ],
            const SizedBox(height: 16),

            // ── Inspection mode selector (FLOOR activities, first GO only) ─
            if (!_isUnit && !_isAdditionalGo) ...[
              const Text('Inspection Type',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              Row(children: [
                Expanded(
                  child: _ModeChip(
                    label: 'One Go',
                    selected: _rfiMode == 'ONE_GO',
                    onTap: () => setState(() => _rfiMode = 'ONE_GO'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _ModeChip(
                    label: 'Multi Go',
                    selected: _rfiMode == 'MULTI_GO',
                    onTap: () => setState(() => _rfiMode = 'MULTI_GO'),
                  ),
                ),
              ]),
              if (_rfiMode == 'MULTI_GO') ...[
                const SizedBox(height: 10),
                Row(children: [
                  const Text('Total GOs:',
                      style: TextStyle(fontSize: 13)),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 64,
                    child: TextFormField(
                      initialValue: _rfiParts.toString(),
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      ),
                      onChanged: (v) {
                        final n = int.tryParse(v) ?? 2;
                        setState(() => _rfiParts = n.clamp(2, 20));
                      },
                    ),
                  ),
                ]),
                const SizedBox(height: 4),
                Text(
                  'GO 1 is raised now. Use "Add GO" on the activity card to raise GOs 2–$_rfiParts.',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
              ],
              const SizedBox(height: 16),
            ],

            // ── Unit selector (UNIT activities) ──────────────────────────
            if (_isUnit) ...[
              const Text('Select Units *',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              if (_unitsLoading)
                const Row(children: [
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 8),
                  Text('Loading units…', style: TextStyle(fontSize: 13)),
                ])
              else if (_units.isEmpty)
                const Text('No units found for this floor.',
                    style: TextStyle(fontSize: 12, color: Colors.grey))
              else
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: _units.map((u) {
                    final id = u['id'] as int;
                    final name = u['name'] as String? ?? 'Unit $id';
                    final selected = _selectedUnitIds.contains(id);
                    return FilterChip(
                      label: Text(name,
                          style: const TextStyle(fontSize: 12)),
                      selected: selected,
                      onSelected: (v) => setState(() {
                        if (v) {
                          _selectedUnitIds.add(id);
                        } else {
                          _selectedUnitIds.remove(id);
                        }
                      }),
                    );
                  }).toList(),
                ),
              const SizedBox(height: 16),
            ],

            // ── Comments ─────────────────────────────────────────────────
            TextField(
              controller: _commentsCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Comments (optional)',
                border: OutlineInputBorder(),
                hintText: 'Add any comments for the inspector…',
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _canSubmit ? _submit : null,
          child: Text(_isAdditionalGo
              ? 'Raise GO ${widget.partNo}'
              : (_isUnit && _selectedUnitIds.length > 1
                  ? 'Raise ${_selectedUnitIds.length} RFIs'
                  : 'Raise RFI')),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Mode chip — toggle button for One Go / Multi Go selection
// ---------------------------------------------------------------------------

class _ModeChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ModeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: selected ? theme.colorScheme.primary : Colors.transparent,
          border: Border.all(
            color: selected
                ? theme.colorScheme.primary
                : theme.colorScheme.outline,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight:
                selected ? FontWeight.w600 : FontWeight.normal,
            color: selected
                ? theme.colorScheme.onPrimary
                : theme.colorScheme.onSurface,
          ),
        ),
      ),
    );
  }
}
