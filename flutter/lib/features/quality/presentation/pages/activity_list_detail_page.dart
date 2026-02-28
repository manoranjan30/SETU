import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/activity_card.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/observation_card.dart';

/// Shows the activities inside a selected checklist, allowing the site engineer
/// to raise RFIs and submit rectifications for pending observations.
class ActivityListDetailPage extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(list.name,
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.bold)),
            if (list.description != null)
              Text(list.description!,
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
      body: BlocConsumer<QualityRequestBloc, QualityRequestState>(
        listener: (context, state) {
          if (state is RfiQueued) {
            final msg = state.isOffline
                ? 'RFI queued — will sync when online'
                : 'RFI raised successfully';
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(msg),
              backgroundColor:
                  state.isOffline ? Colors.orange.shade700 : Colors.green.shade700,
            ));
          }
          if (state is RectificationQueued) {
            final msg = state.isOffline
                ? 'Rectification queued — will sync when online'
                : 'Rectification submitted successfully';
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(msg),
              backgroundColor:
                  state.isOffline ? Colors.orange.shade700 : Colors.green.shade700,
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
          if (state is QualityRequestLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is ActivitiesLoaded) {
            return _ActivityListBody(
              state: state,
              projectId: projectId,
              epsNodeId: epsNodeId,
              listId: list.id,
            );
          }

          // Still loading — show spinner
          return const Center(child: CircularProgressIndicator());
        },
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
                            ? () => _showObservationsSheet(context, row)
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
      builder: (ctx) => AlertDialog(
        title: const Text('Raise RFI'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Activity: ${activity.activityName}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            TextField(
              controller: commentsCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Comments (optional)',
                border: OutlineInputBorder(),
                hintText: 'Add any comments for the inspector…',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              context.read<QualityRequestBloc>().add(RaiseRfi(
                    projectId: projectId,
                    epsNodeId: epsNodeId,
                    listId: listId,
                    activity: activity,
                    comments: commentsCtrl.text.trim().isEmpty
                        ? null
                        : commentsCtrl.text.trim(),
                  ));
              Navigator.pop(ctx);
            },
            child: const Text('Raise RFI'),
          ),
        ],
      ),
    );
  }

  void _showObservationsSheet(BuildContext context, ActivityRow row) {
    final pendingObs = row.observations
        .where((o) => o.status == ObservationStatus.pending)
        .toList();

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
          activity: row.activity,
          observations: pendingObs,
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
    final picker = ImagePicker();
    final xfile =
        await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (xfile == null || !mounted) return;
    context
        .read<QualityRequestBloc>()
        .add(UploadRectificationPhoto(obsId: _selectedObs!.id, filePath: xfile.path));

    final sub = context.read<QualityRequestBloc>().stream.listen((s) {
      if (s is PhotoUploaded && s.obsId == _selectedObs!.id && mounted) {
        setState(() => _photoUrls.add(s.url));
      }
    });
    await Future.delayed(const Duration(seconds: 10));
    sub.cancel();
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
            if (_photoUrls.isNotEmpty)
              Wrap(
                spacing: 8,
                children: _photoUrls
                    .map((url) => Chip(
                          avatar: const Icon(Icons.photo, size: 16),
                          label: Text('Photo ${_photoUrls.indexOf(url) + 1}',
                              style: const TextStyle(fontSize: 12)),
                          onDeleted: () =>
                              setState(() => _photoUrls.remove(url)),
                        ))
                    .toList(),
              ),
            Row(
              children: [
                TextButton.icon(
                  onPressed: _pickPhoto,
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: const Text('Add Evidence'),
                ),
                const Spacer(),
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 18, height: 18,
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
