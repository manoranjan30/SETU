import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/network/connectivity_banner.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/checklist_item_tile.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/observation_card.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/raise_observation_sheet.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/signature_approval_sheet.dart';

/// QC Inspector detail page for a single inspection.
/// Shows checklist stages (expandable), observations, and approval actions.
/// Tabs: "Checklist" (stages with pass/fail items) and "Observations" (raised issues).
/// The bottom action bar drives the multi-level workflow approval chain.
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
    // Two tabs: Checklist and Observations
    _tabCtrl = TabController(length: 2, vsync: this);
    // Kick off the detail load immediately on construction
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
            // Activity name as primary title, fallback to inspection ID
            Text(
              widget.inspection.activityName ?? 'Inspection #${widget.inspection.id}',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            // EPS node label (e.g. "Block A / Tower 1 / Floor 3") as subtitle
            if (widget.inspection.epsNodeLabel != null)
              Text(
                widget.inspection.epsNodeLabel!,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal),
              ),
          ],
        ),
        actions: [
          // Manual refresh button dispatches RefreshInspectionDetail event
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
          // Show red snack for any bloc-level error
          if (state is QualityApprovalError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red.shade700,
            ));
          }
          // Show save confirmation — orange if offline (queued), green if synced
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
          // Approval action completed — build a context-aware message and pop the page
          if (state is ApprovalActionQueued) {
            String msg;
            if (state.action == 'approve' &&
                state.completedLevel != null &&
                state.totalLevels != null) {
              if (state.completedLevel == state.totalLevels) {
                // Final level approved — RFI is fully closed
                msg = state.isOffline
                    ? 'Final approval queued — will sync when online'
                    : 'All levels approved — RFI fully approved';
              } else {
                // Intermediate level — show forwarded-to-next-level message
                final next = state.completedLevel! + 1;
                msg = state.isOffline
                    ? 'Level ${state.completedLevel} queued — will sync when online'
                    : 'Level ${state.completedLevel} approved — forwarded to Level $next approver';
              }
            } else {
              // Map action key to human-readable label for the snack
              final label = {
                'approve': 'Approved',
                'provisional': 'Provisionally Approved',
                'reject': 'Rejected',
                'delegate': 'Step delegated',
                'reverse': 'Approval reversed',
              }[state.action] ?? 'Done';
              msg = state.isOffline
                  ? '$label (queued — will sync when online)'
                  : '$label successfully';
            }
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(msg),
              backgroundColor: state.isOffline
                  ? Colors.orange.shade700
                  : Colors.green.shade700,
            ));
            // Pop back to the approvals list after any approval action
            Navigator.of(context).pop();
          }
          // Stage-level approval completed
          if (state is StageApproveSuccess) {
            String msg;
            if (state.inspectionFullyApproved) {
              msg = 'All stages approved — inspection fully approved!';
            } else if (state.stageFullyApproved) {
              msg = 'Stage fully approved';
            } else {
              msg = state.pendingDisplay != null
                  ? 'Approved — next: ${state.pendingDisplay}'
                  : 'Stage level approved';
            }
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(msg),
              backgroundColor: state.inspectionFullyApproved
                  ? Colors.green.shade800
                  : Colors.green.shade700,
            ));
            if (state.inspectionFullyApproved) {
              Navigator.of(context).pop();
            } else {
              context
                  .read<QualityApprovalBloc>()
                  .add(const RefreshInspectionDetail());
            }
          }
          // Observation action (raise/close/delete) — show result and refresh
          if (state is ObservationActionQueued) {
            final String msg;
            if (state.action == 'raise') {
              msg = state.isOffline
                  ? 'Observation queued — will sync when online'
                  : 'Observation raised';
            } else if (state.action == 'deleted') {
              msg = 'Observation deleted';
            } else {
              msg = state.isOffline
                  ? 'Close queued — will sync when online'
                  : 'Observation closed';
            }
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(msg),
              backgroundColor: state.isOffline
                  ? Colors.orange.shade700
                  : Colors.green.shade700,
            ));
            // Reload the detail so the observations list reflects the change
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

          // Prefer the freshest loaded state; fall back to cached last detail
          final display = state is InspectionDetailLoaded
              ? state
              : _lastDetail;

          if (display != null) {
            return Stack(
              children: [
                Column(
                  children: [
                    // Offline/online connectivity indicator banner
                    const ConnectivityBanner(),
                    Expanded(
                      child: TabBarView(
                        controller: _tabCtrl,
                        children: [
                          // Tab 0: checklist stages with expandable items
                          _ChecklistTab(state: display),
                          // Tab 1: observations raised against this inspection
                          _ObservationsTab(state: display),
                        ],
                      ),
                    ),
                    // Sticky bottom bar with approve/reject/delegate actions
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

/// Renders the list of checklist stages for the inspection.
/// If a workflow run is attached, shows the approval timeline above the stages.
class _ChecklistTab extends StatelessWidget {
  final InspectionDetailLoaded state;
  const _ChecklistTab({required this.state});

  @override
  Widget build(BuildContext context) {
    final hasWorkflow = state.workflow != null;

    if (state.stages.isEmpty && !hasWorkflow) {
      return const Center(child: Text('No checklist stages defined'));
    }

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        // Workflow approval timeline shown above stages when workflow is active
        if (hasWorkflow) _WorkflowTimeline(workflow: state.workflow!),
        if (state.stages.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: Text('No checklist stages defined')),
          )
        else
          // One collapsible card per stage
          ...List.generate(
            state.stages.length,
            (i) => _StageSection(stage: state.stages[i], stageIndex: i),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Workflow Timeline
// ---------------------------------------------------------------------------

/// Renders the multi-level approval workflow as a vertical timeline.
/// Each step shows its status icon, label, assignee, and comments.
class _WorkflowTimeline extends StatelessWidget {
  final InspectionWorkflowRun workflow;
  const _WorkflowTimeline({required this.workflow});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final steps = workflow.steps;

    // Determine the overall run status label and accent colour
    String runStatusLabel;
    Color runStatusColor;
    switch (workflow.status) {
      case WorkflowRunStatus.completed:
        runStatusLabel = 'Workflow Completed';
        runStatusColor = Colors.green;
      case WorkflowRunStatus.rejected:
        runStatusLabel = 'Workflow Rejected';
        runStatusColor = Colors.red;
      case WorkflowRunStatus.reversed:
        runStatusLabel = 'Workflow Reversed';
        runStatusColor = Colors.grey;
      case WorkflowRunStatus.inProgress:
        // Calculate "Level X of Y" from the real (non-raise) steps
        final realSteps = steps.where((s) => !s.isRaiseStep).toList();
        final completedReal = realSteps
            .where((s) => s.status == WorkflowStepStatus.completed)
            .length;
        runStatusLabel =
            'Level ${completedReal + 1} of ${realSteps.length}';
        runStatusColor = Colors.blue;
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.account_tree_outlined, size: 16),
                const SizedBox(width: 6),
                Text('Approval Workflow',
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const Spacer(),
                // Status badge (Completed / Rejected / Level X of Y)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: runStatusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: runStatusColor.withValues(alpha: 0.4)),
                  ),
                  child: Text(runStatusLabel,
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: runStatusColor)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Render each step as a vertical timeline row
            ...steps.asMap().entries.map((entry) {
              final i = entry.key;
              final step = entry.value;
              final isLast = i == steps.length - 1;
              return _WorkflowStepRow(step: step, isLast: isLast);
            }),
          ],
        ),
      ),
    );
  }
}

/// Single row in the workflow timeline.
/// Shows a status icon, connecting line, step label, assignee, and comments.
class _WorkflowStepRow extends StatelessWidget {
  final InspectionWorkflowStep step;
  final bool isLast;
  const _WorkflowStepRow({required this.step, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = step.status.color;

    // Map step status to the appropriate icon
    IconData stepIcon;
    switch (step.status) {
      case WorkflowStepStatus.completed:
        stepIcon = Icons.check_circle;
      case WorkflowStepStatus.rejected:
        stepIcon = Icons.cancel;
      case WorkflowStepStatus.skipped:
        stepIcon = Icons.remove_circle_outline;
      case WorkflowStepStatus.pending:
      case WorkflowStepStatus.inProgress:
        stepIcon = Icons.radio_button_checked;
      case WorkflowStepStatus.waiting:
        stepIcon = Icons.radio_button_unchecked;
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Connector column: icon + vertical line to the next step
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Icon(stepIcon, size: 20, color: color),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 2),
                      color: theme.dividerColor,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Step content: label, status chip, signed-by, and comments
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          step.stepLabel ??
                              'Level ${step.stepOrder}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            // Active step shown in bold full-opacity text
                            fontWeight: step.isActive
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: step.isActive
                                ? theme.colorScheme.onSurface
                                : theme.colorScheme.onSurface
                                    .withValues(alpha: 0.6),
                          ),
                        ),
                      ),
                      // Status chip (Completed / Rejected / In Progress / Waiting)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(step.status.label,
                            style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: color)),
                      ),
                    ],
                  ),
                  // Signed-by and comments shown when available
                  if (step.signedBy != null || step.comments != null) ...[
                    const SizedBox(height: 2),
                    if (step.signedBy != null)
                      Text(
                        'By: ${step.signedBy}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontSize: 11,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.5),
                        ),
                      ),
                    if (step.comments != null &&
                        step.comments!.isNotEmpty)
                      Text(
                        step.comments!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontSize: 11,
                          fontStyle: FontStyle.italic,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.5),
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Collapsible card for a single checklist stage.
/// Header shows stage number, name, and resolved/total count.
/// Body lists [ChecklistItemTile]s with pass/fail controls and a Save button.
class _StageSection extends StatefulWidget {
  final InspectionStage stage;
  final int stageIndex;

  const _StageSection({required this.stage, required this.stageIndex});

  @override
  State<_StageSection> createState() => _StageSectionState();
}

class _StageSectionState extends State<_StageSection> {
  // Stages are expanded by default so checklist items are immediately visible
  bool _expanded = true;

  /// Shows a confirmation dialog then dispatches [ApproveStage] for this stage.
  void _showStageApproveDialog(
      BuildContext context, InspectionStage stage) {
    final commentsCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Approve: ${stage.stageName ?? "Stage"}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (stage.stageApproval?.pendingDisplay != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'Pending: ${stage.stageApproval!.pendingDisplay}',
                  style: TextStyle(
                      fontSize: 12, color: Colors.blue.shade700),
                ),
              ),
            TextField(
              controller: commentsCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Comments (optional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              context.read<QualityApprovalBloc>().add(ApproveStage(
                    stageId: stage.id,
                    comments: commentsCtrl.text.trim().isEmpty
                        ? null
                        : commentsCtrl.text.trim(),
                  ));
              Navigator.pop(ctx);
            },
            style: FilledButton.styleFrom(
                backgroundColor: Colors.green.shade700),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
  }

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
          // Stage header — tap to toggle expand/collapse
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  // Stage number badge — green when all items evaluated
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
                        // Progress: "X / Y evaluated" + approval level if available
                        Text(
                          stage.stageApproval != null
                              ? '$resolvedCount / $totalCount evaluated · Approval ${stage.stageApproval!.progressLabel}'
                              : '$resolvedCount / $totalCount evaluated',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.6),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Gold star when fully approved, green check when items done
                  if (stage.isFullyApproved)
                    Icon(Icons.verified, color: Colors.green.shade700, size: 20)
                  else if (stage.allOk)
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

          // Stage approval matrix — shown when stageApproval data is available
          if (_expanded && stage.stageApproval != null)
            _StageApprovalMatrix(approval: stage.stageApproval!),

          // Open observation warning for this stage
          if (_expanded && stage.openObservationCount > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 4),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_rounded,
                      size: 14, color: Colors.orange.shade700),
                  const SizedBox(width: 4),
                  Text(
                    '${stage.openObservationCount} open observation(s) — resolve before approving this stage',
                    style: TextStyle(
                        fontSize: 11, color: Colors.orange.shade700),
                  ),
                ],
              ),
            ),

          // Stage items — each dispatches SetChecklistItemStatus or UpdateItemRemarks
          if (_expanded)
            ...stage.items.map((item) => ChecklistItemTile(
                  item: item,
                  // Pass/fail toggle dispatches SetChecklistItemStatus to the bloc
                  onStatusChanged: (status) => context
                      .read<QualityApprovalBloc>()
                      .add(SetChecklistItemStatus(
                        stageId: stage.id,
                        itemId: item.id,
                        itemStatus: status,
                      )),
                  // Remarks text dispatches UpdateItemRemarks to the bloc
                  onRemarksChanged: (text) => context
                      .read<QualityApprovalBloc>()
                      .add(UpdateItemRemarks(itemId: item.id, remarks: text)),
                )),

          // Bottom row: Save Progress + Approve Stage
          if (_expanded && stage.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  // Save progress (offline-first)
                  OutlinedButton.icon(
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
                  // Per-stage approve button — only shown when canApprove
                  if (stage.canApprove) ...[
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      onPressed: () =>
                          _showStageApproveDialog(context, stage),
                      icon: const Icon(Icons.verified_outlined, size: 16),
                      label: const Text('Approve Stage'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.green.shade700,
                        textStyle: const TextStyle(fontSize: 12),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                      ),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Stage Approval Matrix
// ---------------------------------------------------------------------------

/// Renders the level-by-level approval matrix for a single checklist stage.
/// Each level is shown as a small chip — green tick when approved, grey clock when pending.
class _StageApprovalMatrix extends StatelessWidget {
  final StageApproval approval;
  const _StageApprovalMatrix({required this.approval});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.verified_user_outlined,
                  size: 13, color: theme.colorScheme.primary),
              const SizedBox(width: 4),
              Text(
                'Approval: ${approval.progressLabel} levels',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: approval.fullyApproved
                      ? Colors.green.shade700
                      : theme.colorScheme.primary,
                ),
              ),
              if (approval.fullyApproved) ...[
                const SizedBox(width: 4),
                Icon(Icons.check_circle,
                    size: 13, color: Colors.green.shade700),
              ],
            ],
          ),
          if (approval.levels.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Wrap(
                spacing: 4,
                runSpacing: 2,
                children: approval.levels.map((level) {
                  final approved = level.approved;
                  return Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: approved
                          ? Colors.green.shade50
                          : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: approved
                            ? Colors.green.shade300
                            : Colors.grey.shade300,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          approved
                              ? Icons.check_circle_outline
                              : Icons.schedule,
                          size: 10,
                          color: approved
                              ? Colors.green.shade700
                              : Colors.grey.shade600,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          level.stepName,
                          style: TextStyle(
                            fontSize: 10,
                            color: approved
                                ? Colors.green.shade800
                                : Colors.grey.shade700,
                          ),
                        ),
                        if (approved && level.signerDisplayName != null) ...[
                          const SizedBox(width: 2),
                          Text(
                            '· ${level.signerDisplayName}',
                            style: TextStyle(
                              fontSize: 9,
                              color: Colors.green.shade600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                }).toList(),
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

/// Lists all observations raised against this inspection.
/// Summary strip shows pending/rectified/closed counts.
/// Each observation card can be closed or deleted based on permissions.
class _ObservationsTab extends StatelessWidget {
  final InspectionDetailLoaded state;
  const _ObservationsTab({required this.state});

  @override
  Widget build(BuildContext context) {
    final obs = state.observations;
    final theme = Theme.of(context);
    // Read permissions to gate delete action on observation cards
    final ps = PermissionService.of(context);

    return Column(
      children: [
        // Summary strip — pending / rectified / closed counts + Raise button
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
              // Raise new observation — opens the RaiseObservationSheet bottom sheet
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
                      // Close button hidden once observation is already closed
                      onClose: !o.isClosed
                          ? () => context
                              .read<QualityApprovalBloc>()
                              .add(CloseObservation(o.id))
                          : null,
                      // Delete gated behind QUALITY.ACTIVITY_OBS.DELETE permission
                      onDelete: ps.canDeleteActivityObs
                          ? () => context
                              .read<QualityApprovalBloc>()
                              .add(DeleteActivityObservation(o.id))
                          : null,
                    );
                  },
                ),
        ),
      ],
    );
  }
}

/// Small stat widget showing a numeric count and label in the observations summary strip.
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

/// Sticky bottom action bar driving the inspection approval workflow.
/// Displays contextual hint lines (current step, pending obs warning) and
/// exposes Reject / Delegate / Reverse / Provisional / Approve buttons
/// gated by permission and assignee checks.
class _ActionBar extends StatelessWidget {
  final InspectionDetailLoaded state;
  const _ActionBar({required this.state});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ps = PermissionService.of(context);
    final hasPendingObs = state.pendingObsCount > 0;
    final useWorkflow = state.hasActiveWorkflow;
    final currentStep = state.workflow?.currentStep;
    // Stage-driven pending label shown in the action bar
    final pendingApprovalDisplay =
        state.inspection.pendingApprovalDisplay;
    // Whether all stages have been fully approved via release strategy
    final allStagesApproved = state.stages.isNotEmpty &&
        state.stages.every((s) => s.isFullyApproved);

    // Permission check: only the assigned approver can advance/reject the step
    final authState = context.read<AuthBloc>().state;
    final currentUserId =
        authState is AuthAuthenticated ? authState.user.id : null;
    // If no step assignment exists, treat current user as the assignee
    final isAssignedApprover = !useWorkflow ||
        currentStep?.assignedUserId == null ||
        currentUserId == currentStep?.assignedUserId;

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
          // Stage-driven pending display — "Stage X · Level Y pending"
          if (pendingApprovalDisplay != null && !allStagesApproved)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(Icons.schedule_outlined,
                      size: 14, color: Colors.blue.shade700),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      pendingApprovalDisplay,
                      style: TextStyle(
                          fontSize: 11, color: Colors.blue.shade700),
                    ),
                  ),
                ],
              ),
            ),
          // All stages approved banner
          if (allStagesApproved)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(Icons.verified,
                      size: 14, color: Colors.green.shade700),
                  const SizedBox(width: 6),
                  Text(
                    'All stages fully approved',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.green.shade700),
                  ),
                ],
              ),
            ),
          // Warning banner when pending observations exist
          if (hasPendingObs)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(Icons.info_outline,
                      size: 14, color: Colors.orange.shade700),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${state.pendingObsCount} pending observation(s) — resolve before approving stages',
                      style: TextStyle(
                          fontSize: 11, color: Colors.orange.shade700),
                    ),
                  ),
                ],
              ),
            ),
          Row(
            children: [
              // Reject button — opens text dialog; routes to workflow or direct reject
              OutlinedButton.icon(
                onPressed: isAssignedApprover
                    ? () => useWorkflow
                        ? _showWorkflowRejectDialog(context)
                        : _showRejectDialog(context)
                    : null,
                icon: const Icon(Icons.cancel_outlined, size: 16),
                label: const Text('Reject'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red.shade700,
                  side: BorderSide(color: Colors.red.shade400),
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
              const SizedBox(width: 8),
              // Delegate button — only shown in workflow mode with delegate permission
              if (useWorkflow && isAssignedApprover && ps.canDelegateInspection)
                OutlinedButton.icon(
                  onPressed: () => _showDelegateDialog(context),
                  icon: const Icon(Icons.person_outline, size: 16),
                  label: const Text('Delegate'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.indigo.shade700,
                    side: BorderSide(color: Colors.indigo.shade300),
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                ),
              // Reverse approval — requires QUALITY.INSPECTION.REVERSE permission
              if (ps.canReverseInspection)
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: OutlinedButton.icon(
                    onPressed: () => _showReverseDialog(context),
                    icon: const Icon(Icons.undo_rounded, size: 16),
                    label: const Text('Reverse'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.deepOrange.shade700,
                      side: BorderSide(color: Colors.deepOrange.shade300),
                      textStyle: const TextStyle(fontSize: 12),
                    ),
                  ),
                ),
              // Stage-based flow has no single final-approve button.
              // Approval happens per-stage via the Approve Stage button in each stage card.
            ],
          ),
        ],
      ),
    );
  }

  /// Shows a dialog requiring a rejection reason, then dispatches [RejectInspection].
  /// Used for direct (non-workflow) inspections.
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
              // Prevent submission without a reason
              if (ctrl.text.trim().isEmpty) return;
              context
                  .read<QualityApprovalBloc>()
                  .add(RejectInspection(ctrl.text.trim()));
              Navigator.pop(ctx);
            },
            style:
                FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  /// Shows a dialog requiring a rejection reason, then dispatches [RejectWorkflowStep].
  /// Used when the inspection is governed by a multi-level workflow.
  void _showWorkflowRejectDialog(BuildContext context) {
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
                  .add(RejectWorkflowStep(ctrl.text.trim()));
              Navigator.pop(ctx);
            },
            style:
                FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  /// Opens the [SignatureApprovalSheet] to capture the approver's signature
  /// before advancing the workflow to the next level.
  void _showWorkflowAdvanceDialog(BuildContext context) {
    SignatureApprovalSheet.show(context);
  }

  /// Shows a dialog requiring justification before dispatching
  /// [ProvisionallyApproveInspection] for direct (non-workflow) inspections.
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
            hintText: 'Explain why provisional approval is being granted…',
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

  /// Shows a dialog to collect a delegate user ID and optional comments,
  /// then dispatches [DelegateWorkflowStep].
  /// Gated behind [PermissionService.canDelegateInspection].
  void _showDelegateDialog(BuildContext context) {
    final userIdCtrl = TextEditingController();
    final commentsCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delegate Step'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Numeric user ID input for the delegate
            TextField(
              controller: userIdCtrl,
              keyboardType: TextInputType.number,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Delegate to User ID *',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: commentsCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Comments (optional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              // Validate that a numeric user ID was entered
              final id = int.tryParse(userIdCtrl.text.trim());
              if (id == null) return;
              context.read<QualityApprovalBloc>().add(DelegateWorkflowStep(
                    toUserId: id,
                    comments: commentsCtrl.text.trim().isEmpty
                        ? null
                        : commentsCtrl.text.trim(),
                  ));
              Navigator.pop(ctx);
            },
            style: FilledButton.styleFrom(
                backgroundColor: Colors.indigo.shade700),
            child: const Text('Delegate'),
          ),
        ],
      ),
    );
  }

  /// Shows a dialog requiring a reversal reason, then dispatches [ReverseWorkflowStep].
  /// Gated behind [PermissionService.canReverseInspection].
  void _showReverseDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reverse Approval'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Reason for reversal *',
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
                  .add(ReverseWorkflowStep(ctrl.text.trim()));
              Navigator.pop(ctx);
            },
            style: FilledButton.styleFrom(
                backgroundColor: Colors.deepOrange.shade700),
            child: const Text('Reverse'),
          ),
        ],
      ),
    );
  }
}
