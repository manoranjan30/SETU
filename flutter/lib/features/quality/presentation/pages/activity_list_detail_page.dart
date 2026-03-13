import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/core/network/connectivity_banner.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/activity_card.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/observation_card.dart';
import 'package:setu_mobile/injection_container.dart';

/// Shows the activities inside a selected checklist, allowing the site engineer
/// to raise RFIs and submit rectifications for pending observations.
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
  /// Last successfully loaded state — shown while background refresh runs.
  ActivitiesLoaded? _lastActivities;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.list.name,
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.bold)),
            if (widget.list.description != null)
              Text(widget.list.description!,
                  style: const TextStyle(
                      fontSize: 11, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
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
          const ConnectivityBanner(),
          Expanded(
            child: BlocConsumer<QualityRequestBloc, QualityRequestState>(
              listener: (context, state) {
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
                if (state is QualityRequestError) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(state.message),
                    backgroundColor: Colors.red.shade700,
                  ));
                }
              },
              builder: (context, state) {
                // Cache last loaded state for use during background operations
                if (state is ActivitiesLoaded) _lastActivities = state;

                // Full-screen spinner only on initial list load with no cache
                if (state is QualityRequestLoading &&
                    state.source == QrLoadingSource.listLoad &&
                    _lastActivities == null) {
                  return const Center(child: CircularProgressIndicator());
                }

                final display = state is ActivitiesLoaded
                    ? state
                    : _lastActivities;

                if (display != null) {
                  // Show thin progress bar for background operations
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
        // Progress summary bar
        _ProgressBar(rows: rows),

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

        // Activity list
        Expanded(
          child: rows.isEmpty
              ? const Center(child: Text('No activities in this list'))
              : RefreshIndicator(
                  onRefresh: () async => context
                      .read<QualityRequestBloc>()
                      .add(const RefreshCurrentList()),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: rows.length,
                    itemBuilder: (context, i) {
                      final row = rows[i];
                      final status = row.displayStatus;

                      final canRaiseRfi =
                          status == ActivityDisplayStatus.ready;
                      final hasPendingObs =
                          status == ActivityDisplayStatus.pendingObservation;

                      return ActivityCard(
                        row: row,
                        onRaiseRfi: canRaiseRfi
                            ? () => _showRfiDialog(context, row.activity)
                            : null,
                        onFixObservation: hasPendingObs
                            ? (obs) =>
                                _showRectificationSheet(context, row.activity, obs)
                            : null,
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  void _showRfiDialog(BuildContext context, QualityActivity activity) {
    final commentsCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return _RaiseRfiDialog(
          activity: activity,
          projectId: projectId,
          epsNodeId: epsNodeId,
          listId: listId,
          commentsCtrl: commentsCtrl,
          bloc: context.read<QualityRequestBloc>(),
        );
      },
    );
  }

  void _showRectificationSheet(
      BuildContext context, QualityActivity activity, ActivityObservation obs) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => BlocProvider.value(
        value: context.read<QualityRequestBloc>(),
        child: _RectificationSheet(
          activity: activity,
          observations: [obs],
          projectId: projectId,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Progress summary bar
// ---------------------------------------------------------------------------

class _ProgressBar extends StatelessWidget {
  final List<ActivityRow> rows;
  const _ProgressBar({required this.rows});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = rows.length;
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
  ActivityObservation? _selectedObs;
  final _textCtrl = TextEditingController();
  final List<String> _photoUrls = [];
  bool _submitting = false;
  bool _uploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    if (widget.observations.length == 1) {
      _selectedObs = widget.observations.first;
    }
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final xfile = await ImagePicker().pickImage(source: ImageSource.camera);
    if (xfile == null || !mounted) return;

    // Open annotation editor before uploading
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
    if (_selectedObs == null || _textCtrl.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    context.read<QualityRequestBloc>().add(SubmitRectification(
          activityId: widget.activity.id,
          obsId: _selectedObs!.id,
          closureText: _textCtrl.text.trim(),
          closureEvidence: List.from(_photoUrls),
        ));
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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

          // Observation selector (if multiple)
          if (widget.observations.length > 1) ...[
            Text('Select Observation', style: theme.textTheme.labelLarge),
            const SizedBox(height: 8),
            ...widget.observations.map((o) => ObservationCard(
                  obs: o,
                  onRectify: _selectedObs?.id == o.id
                      ? null
                      : () => setState(() => _selectedObs = o),
                )),
            const SizedBox(height: 12),
          ] else if (widget.observations.isNotEmpty)
            ObservationCard(obs: widget.observations.first),

          const SizedBox(height: 12),

          if (_selectedObs != null) ...[
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
                  label:
                      Text(_uploadingPhoto ? 'Uploading…' : 'Add Evidence'),
                ),
                const Spacer(),
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
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
// Raise RFI Dialog — loads active vendors, requires vendor selection
// ---------------------------------------------------------------------------

class _RaiseRfiDialog extends StatefulWidget {
  final QualityActivity activity;
  final int projectId;
  final int epsNodeId;
  final int listId;
  final TextEditingController commentsCtrl;
  final QualityRequestBloc bloc;

  const _RaiseRfiDialog({
    required this.activity,
    required this.projectId,
    required this.epsNodeId,
    required this.listId,
    required this.commentsCtrl,
    required this.bloc,
  });

  @override
  State<_RaiseRfiDialog> createState() => _RaiseRfiDialogState();
}

class _RaiseRfiDialogState extends State<_RaiseRfiDialog> {
  List<Map<String, dynamic>> _vendors = [];
  Map<String, dynamic>? _selectedVendor;
  bool _loading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _loadVendors();
  }

  Future<void> _loadVendors() async {
    try {
      final vendors =
          await sl<SetuApiClient>().getActiveVendors(widget.projectId);
      if (!mounted) return;
      setState(() {
        _vendors = vendors;
        _loading = false;
        if (vendors.length == 1) _selectedVendor = vendors.first;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = 'Could not load vendors';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = !_loading &&
        (_selectedVendor != null || _vendors.isEmpty || _loadError != null);

    return AlertDialog(
      title: const Text('Raise RFI'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Activity: ${widget.activity.activityName}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),

            // Vendor selector
            if (_loading)
              const Row(children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                SizedBox(width: 8),
                Text('Loading vendors…', style: TextStyle(fontSize: 13)),
              ])
            else if (_loadError != null)
              Text('$_loadError — will submit without vendor.',
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
            const SizedBox(height: 12),

            TextField(
              controller: widget.commentsCtrl,
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
          onPressed: canSubmit
              ? () {
                  widget.bloc.add(RaiseRfi(
                    projectId: widget.projectId,
                    epsNodeId: widget.epsNodeId,
                    listId: widget.listId,
                    activity: widget.activity,
                    comments: widget.commentsCtrl.text.trim().isEmpty
                        ? null
                        : widget.commentsCtrl.text.trim(),
                    vendorId: _selectedVendor?['id'] as int?,
                    vendorName: _selectedVendor?['name'] as String?,
                  ));
                  Navigator.pop(context);
                }
              : null,
          child: const Text('Raise RFI'),
        ),
      ],
    );
  }
}
