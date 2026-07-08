import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/core/network/connectivity_banner.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/data/models/rfi_attachment.dart';
import 'package:setu_mobile/features/quality/data/models/rfi_attachment_draft.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart'
    hide SubmitRectification;
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/inspection_detail_page.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/activity_card.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/linked_rfi_detail_sheet.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/observation_card.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/rfi_attachment_picker.dart';
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
    final ps = PermissionService.of(context);

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
                      // AND the user's QUALITY.INSPECTION.RAISE permission —
                      // status alone is not enough, a viewer-only user must
                      // not see Raise RFI/GO buttons regardless of status.
                      final canRaiseRfi = ps.canRaiseRfi &&
                          status == ActivityDisplayStatus.ready;
                      // Allow raising additional parts / units when the
                      // activity isn't locked or fully approved.
                      final canRaiseMore = ps.canRaiseRfi &&
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
                        // Add GO: reserve and raise the next GO in the series
                        onExpandGo: canRaiseMore &&
                                row.allInspections.isNotEmpty &&
                                row.activity.applicabilityLevel != 'UNIT'
                            ? () => _showAddGoDialog(context, row)
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
  /// Reserves the next single GO for [row]'s activity via the backend
  /// add-go endpoint, then immediately opens the raise dialog for that GO —
  /// one tap, no upfront count picker (matches the web-aligned GO workflow).
  void _showAddGoDialog(BuildContext context, ActivityRow row) {
    final currentTotal =
        row.allInspections.fold(1, (max, i) => i.totalParts > max ? i.totalParts : max);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add GO'),
        content: Text(
          'Activity: ${row.activity.activityName}\n'
          'This reserves GO ${currentTotal + 1} — you\'ll raise it right after.',
          style: const TextStyle(fontSize: 13),
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
                final result = await sl<SetuApiClient>().addGo(
                  projectId: projectId,
                  epsNodeId: epsNodeId,
                  activityId: row.activity.id,
                );
                if (!context.mounted) return;
                final nextGoNo = result['nextGoNo'] as int? ?? currentTotal + 1;
                final newTotalParts = result['newTotalParts'] as int? ?? nextGoNo;
                _raiseRfiPart(context, row, nextGoNo, newTotalParts);
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text('Failed to add GO: $e'),
                    backgroundColor: Colors.red.shade700,
                  ));
                }
              }
            },
            child: const Text('Add GO'),
          ),
        ],
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
    final annotationResult =
        await ImageAnnotationPage.show(context, xfile.path);
    final uploadPath = annotationResult?.flattenedImagePath ?? xfile.path;

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
      if (annotationResult != null) {
        await PhotoCompressor.deleteTempFile(annotationResult.flattenedImagePath);
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

  // UNIT mode — units fetched from floor structure API
  List<Map<String, dynamic>> _units = [];
  final Set<int> _selectedUnitIds = {};
  bool _unitsLoading = false;

  // Related checklist tree for this floor/node — checklist+activity groups
  // with selectable RFI children, fed by GET /quality/inspections/related-options.
  List<Map<String, dynamic>> _relatedGroups = [];
  final Set<int> _selectedRelatedIds = {};
  bool _relatedLoading = false;
  final _relatedSearchCtrl = TextEditingController();
  String _relatedSearch = '';

  // Attachments staged via RfiAttachmentPicker — uploaded as drafts before
  // this RFI exists, then bound at create time via attachmentDraftIds.
  List<RfiAttachmentDraft> _attachmentDrafts = const [];

  // Backdating: optional manual request date when project setting allows it.
  bool _backdatingEnabled = false;
  DateTime? _requestDate; // null = use today (backend default)

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
    if (_isFloor) _loadRelatedOptions();
    _loadBackdatingSettings();
  }

  Future<void> _loadBackdatingSettings() async {
    try {
      final settings = await sl<SetuApiClient>().getProjectDateSettings(widget.projectId);
      if (mounted) {
        setState(() => _backdatingEnabled = settings['enabled'] as bool? ?? false);
      }
    } catch (_) {
      // Non-fatal — feature stays disabled
    }
  }

  @override
  void dispose() {
    _drawingNoCtrl.dispose();
    _elementNameCtrl.dispose();
    _goDetailsCtrl.dispose();
    _commentsCtrl.dispose();
    _relatedSearchCtrl.dispose();
    super.dispose();
  }

  /// Shows the full context for a linked checklist RFI — the inline row only
  /// has room for a single truncated line of "GO label · activity · RFI #"
  /// plus the checklist name, and never shows `goDetails` at all. Also
  /// fetches and shows the linked RFI's attachment images so the user can
  /// visually verify before selecting it for linking — and can select it
  /// directly from here via the bottom button.
  void _showRelatedRfiDetail(
      BuildContext context, Map<String, dynamic> group, Map<String, dynamic> child) {
    final inspectionId = child['inspectionId'] as int;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        minChildSize: 0.4,
        expand: false,
        builder: (sheetCtx, scrollController) => _RelatedRfiDetailSheet(
          group: group,
          child: child,
          inspectionId: inspectionId,
          isSelected: _selectedRelatedIds.contains(inspectionId),
          scrollController: scrollController,
          onToggleSelect: () {
            setState(() {
              if (_selectedRelatedIds.contains(inspectionId)) {
                _selectedRelatedIds.remove(inspectionId);
              } else {
                _selectedRelatedIds.add(inspectionId);
              }
            });
            Navigator.of(sheetCtx).pop();
          },
        ),
      ),
    );
  }

  /// Finds the (group, child) pair for [inspectionId] across all loaded
  /// groups — used to render the "Selected" removable-chip summary without
  /// re-fetching anything.
  (Map<String, dynamic>, Map<String, dynamic>)? _findRelatedChild(int inspectionId) {
    for (final group in _relatedGroups) {
      final children = (group['children'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      for (final child in children) {
        if (child['inspectionId'] == inspectionId) return (group, child);
      }
    }
    return null;
  }

  /// True if [child] (within [group]) matches the current search query
  /// across checklist, activity, RFI number, GO, GO details, element,
  /// drawing, and status — matching the web-aligned tree picker's search.
  bool _matchesRelatedSearch(Map<String, dynamic> group, Map<String, dynamic> child) {
    if (_relatedSearch.isEmpty) return true;
    final q = _relatedSearch.toLowerCase();
    final haystack = [
      group['checklistName'],
      group['checklistNo'],
      group['activityName'],
      group['listName'],
      child['rfiNumber'],
      child['goLabel'],
      child['goNo']?.toString(),
      child['goDetails'],
      child['elementName'],
      child['drawingNo'],
      child['status'],
    ].whereType<String>().map((s) => s.toLowerCase());
    return haystack.any((s) => s.contains(q));
  }

  Future<void> _loadRelatedOptions() async {
    setState(() => _relatedLoading = true);
    try {
      final groups = await sl<SetuApiClient>().getRelatedChecklistOptions(
        projectId: widget.projectId,
        epsNodeId: widget.epsNodeId,
      );
      if (!mounted) return;
      setState(() {
        _relatedGroups = groups;
        _relatedLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _relatedLoading = false);
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
    // Never submit while an attachment is still uploading or has failed —
    // the RFI must not be created referencing an attachment that doesn't
    // exist yet (or never will, without the user noticing and retrying).
    if (_attachmentDrafts.any((d) => d.status != DraftUploadStatus.uploaded)) {
      return false;
    }
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
    final requestDateStr = (_backdatingEnabled && _requestDate != null)
        ? '${_requestDate!.year}-${_requestDate!.month.toString().padLeft(2,'0')}-${_requestDate!.day.toString().padLeft(2,'0')}'
        : null;
    final attachmentIds = _attachmentDrafts
        .where((d) => d.status == DraftUploadStatus.uploaded && d.serverAttachmentId != null)
        .map((d) => d.serverAttachmentId!)
        .toList();

    if (_isUnit) {
      // Queue one RFI per selected unit (Unit Wise mode). A draft can only
      // ever bind to one inspection, so attachments are only forwarded when
      // exactly one unit is raised — batch unit creation must upload and
      // submit attachments independently per RFI (not supported by this
      // dialog's single shared attachment list).
      final singleUnitAttachmentIds =
          _selectedUnitIds.length == 1 ? attachmentIds : const <String>[];
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
          attachmentDraftIds: singleUnitAttachmentIds,
          requestDate: requestDateStr,
        ));
      }
    } else {
      // Additional GO mode: partNo/totalParts are fixed from the existing
      // series (reserved via Add GO). A brand-new floor activity always
      // starts at GO 1 / partNo 1 / totalParts 1 — later GOs are reserved
      // one at a time via Add GO, never picked upfront.
      final partNo = _isAdditionalGo ? widget.partNo! : 1;
      final totalParts = _isAdditionalGo ? widget.totalParts! : 1;
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
        attachmentDraftIds: attachmentIds,
        requestDate: requestDateStr,
      ));
    }
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
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
              const SizedBox(height: 6),

              // Selected summary — removable chips, shown above the tree so
              // the user always sees what they've picked without scrolling.
              if (_selectedRelatedIds.isNotEmpty) ...[
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: _selectedRelatedIds.map((id) {
                    final found = _findRelatedChild(id);
                    final label = found == null
                        ? 'RFI #$id'
                        : (found.$2['rfiNumber'] as String? ?? 'RFI #$id');
                    return Chip(
                      label: Text(label, style: const TextStyle(fontSize: 11)),
                      visualDensity: VisualDensity.compact,
                      deleteIcon: const Icon(Icons.close, size: 14),
                      onDeleted: () =>
                          setState(() => _selectedRelatedIds.remove(id)),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 8),
              ],

              if (_relatedLoading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Row(children: [
                    SizedBox(width: 14, height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2)),
                    SizedBox(width: 8),
                    Text('Loading…', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ]),
                )
              else if (_relatedGroups.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    'No previous RFIs available for this location.',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                  ),
                )
              else ...[
                // Search across checklist, activity, RFI, GO, GO details,
                // element, drawing, and status.
                TextField(
                  controller: _relatedSearchCtrl,
                  decoration: InputDecoration(
                    isDense: true,
                    border: const OutlineInputBorder(),
                    hintText: 'Search checklist, RFI, GO, element, drawing…',
                    prefixIcon: const Icon(Icons.search, size: 18),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    suffixIcon: _relatedSearch.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.clear, size: 16),
                            onPressed: () => setState(() {
                              _relatedSearchCtrl.clear();
                              _relatedSearch = '';
                            }),
                          ),
                  ),
                  style: const TextStyle(fontSize: 12),
                  onChanged: (v) => setState(() => _relatedSearch = v.trim()),
                ),
                const SizedBox(height: 6),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 260),
                  child: SingleChildScrollView(
                    child: Column(
                      children: _relatedGroups.map((group) {
                        final children = (group['children'] as List<dynamic>? ?? [])
                            .cast<Map<String, dynamic>>()
                            .where((c) => _matchesRelatedSearch(group, c))
                            .toList();
                        if (children.isEmpty) return const SizedBox.shrink();
                        return ExpansionTile(
                          initiallyExpanded: _relatedSearch.isNotEmpty,
                          dense: true,
                          tilePadding: EdgeInsets.zero,
                          title: Text(
                            '${group['checklistName'] ?? 'Checklist'} · ${group['activityName'] ?? ''}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: group['checklistNo'] != null
                              ? Text(group['checklistNo'] as String,
                                  style: TextStyle(fontSize: 10, color: Colors.grey.shade500))
                              : null,
                          children: children.map((child) {
                            final inspectionId = child['inspectionId'] as int;
                            final isSelected = _selectedRelatedIds.contains(inspectionId);
                            final goLabel = child['goLabel'] as String? ??
                                (child['goNo'] != null ? 'GO ${child['goNo']}' : null);
                            final label = [
                              if (goLabel != null) goLabel,
                              child['rfiNumber'] as String? ?? 'RFI #$inspectionId',
                            ].join(' · ');
                            final sublabel = [
                              if (child['elementName'] != null) child['elementName'] as String,
                              if (child['drawingNo'] != null) child['drawingNo'] as String,
                            ].join(' · ');
                            final status = InspectionStatus.fromString(
                                child['status'] as String? ?? 'PENDING');
                            return InkWell(
                              onTap: () => setState(() {
                                if (isSelected) {
                                  _selectedRelatedIds.remove(inspectionId);
                                } else {
                                  _selectedRelatedIds.add(inspectionId);
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
                                          _selectedRelatedIds.add(inspectionId);
                                        } else {
                                          _selectedRelatedIds.remove(inspectionId);
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
                                          if (sublabel.isNotEmpty)
                                            Text(sublabel,
                                                style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                                                overflow: TextOverflow.ellipsis),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: status.color.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        status.label,
                                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: status.color),
                                      ),
                                    ),
                                    InkWell(
                                      onTap: () => _showRelatedRfiDetail(context, group, child),
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
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ],
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
                initialValue: _selectedVendor,
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

            // ── Attachments ───────────────────────────────────────────────
            RfiAttachmentPicker(
              projectId: widget.projectId,
              onChanged: (drafts) => setState(() => _attachmentDrafts = drafts),
            ),
            if (_isUnit && _selectedUnitIds.length > 1 && _attachmentDrafts.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Attachments only apply when raising a single unit — they '
                  'will not be attached when raising ${_selectedUnitIds.length} units at once.',
                  style: TextStyle(fontSize: 11, color: Colors.orange.shade800),
                ),
              ),
            const SizedBox(height: 16),

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
            // Backdated request date — only shown when the project setting enables it
            if (_backdatingEnabled) ...[
              const SizedBox(height: 12),
              InkWell(
                onTap: () async {
                  final d = await showDatePicker(
                    context: context,
                    initialDate: _requestDate ?? DateTime.now(),
                    firstDate: DateTime.now().subtract(const Duration(days: 365)),
                    lastDate: DateTime.now(),
                  );
                  if (d != null) setState(() => _requestDate = d);
                },
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'RFI Request Date (optional — today if not set)',
                    border: OutlineInputBorder(),
                    suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
                  ),
                  child: Text(
                    _requestDate == null
                        ? 'Today (default)'
                        : '${_requestDate!.day.toString().padLeft(2,'0')}/${_requestDate!.month.toString().padLeft(2,'0')}/${_requestDate!.year}',
                    style: TextStyle(
                      color: _requestDate == null ? Colors.grey.shade500 : null,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],
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
// Related RFI detail sheet — text fields + attachment images + select action
// ---------------------------------------------------------------------------

/// Full detail for one related-checklist tree child, fetched fresh (the tree
/// endpoint only returns summary fields, not attachments) so the user can
/// visually verify the linked checklist's evidence photos before selecting
/// it for linking — selection happens directly from this sheet via
/// [onToggleSelect], rather than requiring the user to close this sheet and
/// find the checkbox again in the tree.
class _RelatedRfiDetailSheet extends StatefulWidget {
  final Map<String, dynamic> group;
  final Map<String, dynamic> child;
  final int inspectionId;
  final bool isSelected;
  final VoidCallback onToggleSelect;
  final ScrollController scrollController;

  const _RelatedRfiDetailSheet({
    required this.group,
    required this.child,
    required this.inspectionId,
    required this.isSelected,
    required this.onToggleSelect,
    required this.scrollController,
  });

  @override
  State<_RelatedRfiDetailSheet> createState() => _RelatedRfiDetailSheetState();
}

class _RelatedRfiDetailSheetState extends State<_RelatedRfiDetailSheet> {
  List<RfiAttachment>? _attachments;
  bool _loadingAttachments = true;

  @override
  void initState() {
    super.initState();
    _loadAttachments();
  }

  Future<void> _loadAttachments() async {
    try {
      final raw = await sl<SetuApiClient>()
          .getQualityInspectionDetail(widget.inspectionId);
      final attachments = (raw['attachments'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(RfiAttachment.fromJson)
              .toList() ??
          const [];
      if (mounted) {
        setState(() {
          _attachments = attachments;
          _loadingAttachments = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingAttachments = false);
    }
  }

  Widget _detailLine(IconData icon, String label, String value, [Color? color]) {
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

  @override
  Widget build(BuildContext context) {
    final group = widget.group;
    final child = widget.child;
    final goLabel = child['goLabel'] as String? ??
        (child['goNo'] != null ? 'GO ${child['goNo']}' : null);
    final go = [
      if (goLabel != null) goLabel,
      if (child['goDetails'] != null) child['goDetails'] as String,
    ].join(' — ');
    final status =
        InspectionStatus.fromString(child['status'] as String? ?? 'PENDING');

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
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
              style: Theme.of(context).textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Expanded(
            child: ListView(
              controller: widget.scrollController,
              children: [
                _detailLine(Icons.checklist_rtl_outlined, 'Checklist',
                    group['checklistName'] as String? ?? '—'),
                _detailLine(Icons.construction_outlined, 'Activity',
                    group['activityName'] as String? ?? '—'),
                _detailLine(Icons.assignment_outlined, 'GO Details', go.isEmpty ? '—' : go),
                if (child['elementName'] != null)
                  _detailLine(Icons.location_on_outlined, 'Element', child['elementName'] as String),
                if (child['drawingNo'] != null)
                  _detailLine(Icons.description_outlined, 'Drawing No.', child['drawingNo'] as String),
                _detailLine(Icons.flag_outlined, 'Status', status.label, status.color),
                _detailLine(Icons.event_outlined, 'Requested', child['requestDate'] as String? ?? '—'),
                const SizedBox(height: 12),
                Text('Attachments',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey.shade600)),
                const SizedBox(height: 6),
                if (_loadingAttachments)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                else if ((_attachments ?? const []).isEmpty)
                  Text('No attachments.', style: TextStyle(fontSize: 12, color: Colors.grey.shade500))
                else
                  AttachmentGrid(attachments: _attachments!, readOnly: true),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: widget.onToggleSelect,
              icon: Icon(widget.isSelected ? Icons.remove_circle_outline : Icons.check_circle_outline, size: 18),
              label: Text(widget.isSelected ? 'Remove From Selection' : 'Select This Checklist'),
              style: FilledButton.styleFrom(
                backgroundColor: widget.isSelected ? Colors.red.shade600 : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

