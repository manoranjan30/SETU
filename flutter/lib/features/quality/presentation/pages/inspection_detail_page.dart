import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/network/connectivity_banner.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/checklist_item_tile.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/observation_card.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/raise_observation_sheet.dart';

/// QC Inspector detail page for a single inspection.
/// Shows checklist stages (expandable), observations, and approval actions.
class InspectionDetailPage extends StatefulWidget {
  final QualityInspection inspection;

  const InspectionDetailPage({super.key, required this.inspection});

  @override
  State<InspectionDetailPage> createState() => _InspectionDetailPageState();
}

class _InspectionDetailPageState extends State<InspectionDetailPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  /// Last successfully loaded state — shown while approval actions run
  /// and when transient errors occur (e.g. photo upload failures).
  InspectionDetailLoaded? _lastDetail;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    context
        .read<QualityApprovalBloc>()
        .add(LoadInspectionDetail(widget.inspection));
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.inspection.activityName ?? 'Inspection #${widget.inspection.id}',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            if (widget.inspection.epsNodeLabel != null)
              Text(
                widget.inspection.epsNodeLabel!,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => context
                .read<QualityApprovalBloc>()
                .add(const RefreshInspectionDetail()),
          ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: const [
            Tab(text: 'Checklist'),
            Tab(text: 'Observations'),
          ],
        ),
      ),
      body: BlocConsumer<QualityApprovalBloc, QualityApprovalState>(
        listener: (context, state) {
          if (state is QualityApprovalError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red.shade700,
            ));
          }
          if (state is ChecklistProgressSaved) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.isOffline
                  ? 'Progress saved — will sync when online'
                  : 'Progress saved'),
              backgroundColor: state.isOffline
                  ? Colors.orange.shade700
                  : Colors.green.shade700,
            ));
          }
          if (state is ApprovalActionQueued) {
            final label = {
              'approve': 'Approved',
              'provisional': 'Provisionally Approved',
              'reject': 'Rejected',
            }[state.action]!;
            final msg = state.isOffline
                ? '$label (queued — will sync when online)'
                : '$label successfully';
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(msg),
              backgroundColor: state.isOffline
                  ? Colors.orange.shade700
                  : Colors.green.shade700,
            ));
            Navigator.of(context).pop();
          }
          if (state is ObservationActionQueued) {
            final msg = state.action == 'raise'
                ? (state.isOffline
                    ? 'Observation queued — will sync when online'
                    : 'Observation raised')
                : (state.isOffline
                    ? 'Close queued — will sync when online'
                    : 'Observation closed');
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(msg),
              backgroundColor: state.isOffline
                  ? Colors.orange.shade700
                  : Colors.green.shade700,
            ));
            context
                .read<QualityApprovalBloc>()
                .add(const RefreshInspectionDetail());
          }
        },
        builder: (context, state) {
          // Cache the last good state so errors/loading don't blank the page
          if (state is InspectionDetailLoaded) _lastDetail = state;

          // Full spinner only on initial load (nothing to show yet)
          if (state is QualityApprovalLoading && _lastDetail == null) {
            return const Center(child: CircularProgressIndicator());
          }

          final display = state is InspectionDetailLoaded
              ? state
              : _lastDetail;

          if (display != null) {
            return Stack(
              children: [
                Column(
                  children: [
                    const ConnectivityBanner(),
                    Expanded(
                      child: TabBarView(
                        controller: _tabCtrl,
                        children: [
                          _ChecklistTab(state: display),
                          _ObservationsTab(state: display),
                        ],
                      ),
                    ),
                    _ActionBar(state: display),
                  ],
                ),
                // Slim progress bar while approval/checklist save is running
                if (state is QualityApprovalLoading)
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
    );
  }
}

// ---------------------------------------------------------------------------
// Checklist Tab
// ---------------------------------------------------------------------------

class _ChecklistTab extends StatelessWidget {
  final InspectionDetailLoaded state;
  const _ChecklistTab({required this.state});

  @override
  Widget build(BuildContext context) {
    if (state.stages.isEmpty) {
      return const Center(child: Text('No checklist stages defined'));
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: state.stages.length,
      itemBuilder: (context, i) =>
          _StageSection(stage: state.stages[i], stageIndex: i),
    );
  }
}

class _StageSection extends StatefulWidget {
  final InspectionStage stage;
  final int stageIndex;

  const _StageSection({required this.stage, required this.stageIndex});

  @override
  State<_StageSection> createState() => _StageSectionState();
}

class _StageSectionState extends State<_StageSection> {
  bool _expanded = true;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final stage = widget.stage;
    final resolvedCount = stage.resolvedCount;
    final totalCount = stage.totalCount;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Column(
        children: [
          // Stage header
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: stage.allOk
                          ? Colors.green.shade100
                          : theme.colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '${widget.stageIndex + 1}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: stage.allOk
                            ? Colors.green.shade800
                            : theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(stage.stageName ?? 'Stage',
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600)),
                        Text(
                          '$resolvedCount / $totalCount evaluated',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.6),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (stage.allOk)
                    Icon(Icons.check_circle,
                        color: Colors.green.shade600, size: 20),
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    color:
                        theme.colorScheme.onSurface.withValues(alpha: 0.5),
                  ),
                ],
              ),
            ),
          ),

          // Stage items
          if (_expanded)
            ...stage.items.map((item) => ChecklistItemTile(
                  item: item,
                  onStatusChanged: (status) => context
                      .read<QualityApprovalBloc>()
                      .add(SetChecklistItemStatus(
                        stageId: stage.id,
                        itemId: item.id,
                        itemStatus: status,
                      )),
                  onRemarksChanged: (text) => context
                      .read<QualityApprovalBloc>()
                      .add(UpdateItemRemarks(itemId: item.id, remarks: text)),
                )),

          // Save progress button
          if (_expanded && stage.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
              child: Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton.icon(
                  onPressed: () => context
                      .read<QualityApprovalBloc>()
                      .add(const SaveChecklistProgress()),
                  icon: const Icon(Icons.save_outlined, size: 16),
                  label: const Text('Save Progress'),
                  style: OutlinedButton.styleFrom(
                    textStyle: const TextStyle(fontSize: 12),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Observations Tab
// ---------------------------------------------------------------------------

class _ObservationsTab extends StatelessWidget {
  final InspectionDetailLoaded state;
  const _ObservationsTab({required this.state});

  @override
  Widget build(BuildContext context) {
    final obs = state.observations;
    final theme = Theme.of(context);

    return Column(
      children: [
        // Summary strip
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: theme.colorScheme.surfaceContainerLow,
          child: Row(
            children: [
              _ObsStat(
                label: 'Pending',
                count: obs.where((o) => o.isPending).length,
                color: Colors.orange.shade700,
              ),
              const SizedBox(width: 24),
              _ObsStat(
                label: 'Rectified',
                count: obs.where((o) => o.isRectified).length,
                color: Colors.blue.shade700,
              ),
              const SizedBox(width: 24),
              _ObsStat(
                label: 'Closed',
                count: obs
                    .where((o) => o.status == ObservationStatus.closed)
                    .length,
                color: Colors.green.shade700,
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: () =>
                    RaiseObservationSheet.show(context),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Raise'),
                style: TextButton.styleFrom(
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
        ),

        Expanded(
          child: obs.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_outline,
                          size: 64,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.3)),
                      const SizedBox(height: 12),
                      Text('No observations raised',
                          style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5))),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: obs.length,
                  itemBuilder: (context, i) {
                    final o = obs[i];
                    return ObservationCard(
                      obs: o,
                      onClose: o.isRectified
                          ? () => context
                              .read<QualityApprovalBloc>()
                              .add(CloseObservation(o.id))
                          : null,
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _ObsStat extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _ObsStat(
      {required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$count',
          style: TextStyle(
              fontSize: 18, fontWeight: FontWeight.bold, color: color),
        ),
        Text(label,
            style: TextStyle(fontSize: 11, color: color.withValues(alpha: 0.8))),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Bottom Action Bar
// ---------------------------------------------------------------------------

class _ActionBar extends StatelessWidget {
  final InspectionDetailLoaded state;
  const _ActionBar({required this.state});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canApprove = state.canFinalApprove;
    final hasPendingObs = state.pendingObsCount > 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasPendingObs)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(Icons.info_outline,
                      size: 14, color: Colors.orange.shade700),
                  const SizedBox(width: 6),
                  Text(
                    '${state.pendingObsCount} pending observation(s) must be closed before final approval',
                    style: TextStyle(
                        fontSize: 11, color: Colors.orange.shade700),
                  ),
                ],
              ),
            ),
          Row(
            children: [
              // Reject
              OutlinedButton.icon(
                onPressed: () => _showRejectDialog(context),
                icon: const Icon(Icons.cancel_outlined, size: 16),
                label: const Text('Reject'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red.shade700,
                  side: BorderSide(color: Colors.red.shade400),
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
              const SizedBox(width: 8),
              // Provisional approve
              OutlinedButton.icon(
                onPressed: () => _showProvisionalDialog(context),
                icon: const Icon(Icons.check_outlined, size: 16),
                label: const Text('Provisional'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.teal.shade700,
                  side: BorderSide(color: Colors.teal.shade400),
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
              const Spacer(),
              // Full approve
              FilledButton.icon(
                onPressed: canApprove
                    ? () => context
                        .read<QualityApprovalBloc>()
                        .add(const ApproveInspection())
                    : null,
                icon: const Icon(Icons.verified_outlined, size: 16),
                label: const Text('Approve'),
                style: FilledButton.styleFrom(
                  backgroundColor:
                      canApprove ? Colors.green.shade700 : null,
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showRejectDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Inspection'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Reason for rejection *',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (ctrl.text.trim().isEmpty) return;
              context
                  .read<QualityApprovalBloc>()
                  .add(RejectInspection(ctrl.text.trim()));
              Navigator.pop(ctx);
            },
            style: FilledButton.styleFrom(
                backgroundColor: Colors.red.shade700),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  void _showProvisionalDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Provisional Approval'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Justification *',
            border: OutlineInputBorder(),
            hintText:
                'Explain why provisional approval is being granted…',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (ctrl.text.trim().isEmpty) return;
              context.read<QualityApprovalBloc>().add(
                  ProvisionallyApproveInspection(ctrl.text.trim()));
              Navigator.pop(ctx);
            },
            style: FilledButton.styleFrom(
                backgroundColor: Colors.teal.shade700),
            child: const Text('Provisionally Approve'),
          ),
        ],
      ),
    );
  }
}
