import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/data/models/snag_desnag_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/snag_desnag_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/snag_item_action_sheets.dart';
import 'package:setu_mobile/features/quality/presentation/pages/snag_raise_flow_page.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/signature_approval_sheet.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/app_snackbar.dart';
import 'package:setu_mobile/shared/widgets/empty_state_view.dart';
import 'package:setu_mobile/shared/widgets/loading_view.dart';

/// The operational "unit workspace" — header, current round summary, the
/// actual raised snag list with rectify/close/reject/hold actions (single
/// and bulk), submit-snag-phase / submit-for-desnag-approval, the desnag
/// approval panel, final closure, and the status-report PDF.
///
/// Permission model (verified against `snag.controller.ts`, not assumed
/// from the handoff's prose): raising, closing, rejecting rectification,
/// and final closure are all Checker actions gated on
/// `QUALITY.SNAG.APPROVE` — rectifying, holding, and submitting are Maker
/// actions gated on `QUALITY.SNAG.UPDATE`. Approver/checker eligibility for
/// the release-strategy panel is never decided locally beyond that same
/// permission check — any further ineligibility is reported by the
/// backend's own error.
class SnagUnitWorkspacePage extends StatelessWidget {
  final int projectId;
  final int qualityUnitId;
  final String unitLabel;
  final String towerLabel;
  final String floorLabel;
  final String? blockLabel;

  /// The unit's existing snag list id, if any — pass
  /// [SnagUnitSummary.snagListId] from whichever units list navigated here.
  /// When null, the unit hasn't started snagging yet; the workspace shows a
  /// "Mark Ready" screen instead of auto-creating the list (see
  /// [OpenSnagUnit]'s doc comment).
  final int? snagListId;

  const SnagUnitWorkspacePage({
    super.key,
    required this.projectId,
    required this.qualityUnitId,
    required this.unitLabel,
    required this.towerLabel,
    required this.floorLabel,
    this.blockLabel,
    this.snagListId,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => SnagDesnagBloc(apiClient: sl<SetuApiClient>(), syncService: sl<SyncService>())
        ..add(OpenSnagUnit(projectId, qualityUnitId, snagListId: snagListId)),
      child: _WorkspaceView(
        projectId: projectId,
        unitLabel: unitLabel,
        towerLabel: towerLabel,
        floorLabel: floorLabel,
        blockLabel: blockLabel,
      ),
    );
  }
}

SnagList? _listFrom(SnagDesnagState state) => switch (state) {
  final SnagUnitDetailLoaded s => s.list,
  final SnagUnitActionInProgress s => s.list,
  final SnagActionSuccess s => s.list,
  _ => null,
};

class _WorkspaceView extends StatefulWidget {
  final int projectId;
  final String unitLabel;
  final String towerLabel;
  final String floorLabel;
  final String? blockLabel;

  const _WorkspaceView({
    required this.projectId,
    required this.unitLabel,
    required this.towerLabel,
    required this.floorLabel,
    this.blockLabel,
  });

  @override
  State<_WorkspaceView> createState() => _WorkspaceViewState();
}

class _WorkspaceViewState extends State<_WorkspaceView> {
  bool _bulkMode = false;
  final Set<int> _selectedItemIds = {};
  bool _downloadingPdf = false;

  void _toggleBulkMode() => setState(() {
    _bulkMode = !_bulkMode;
    _selectedItemIds.clear();
  });

  void _toggleSelect(int itemId) => setState(() {
    if (!_selectedItemIds.remove(itemId)) _selectedItemIds.add(itemId);
  });

  Future<void> _downloadPdf(BuildContext context, int listId, int roundNumber) async {
    setState(() => _downloadingPdf = true);
    try {
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/snag_status_${listId}_round_$roundNumber.pdf';
      await sl<SetuApiClient>().downloadSnagStatusReportPdf(widget.projectId, listId, roundNumber, path);
      final result = await OpenFile.open(path);
      if (result.type != ResultType.done && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open PDF: ${result.message}')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        AppSnackbar.error(context, 'PDF download failed: $e');
      }
    } finally {
      if (mounted) setState(() => _downloadingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.unitLabel, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            Text(
              [if (widget.blockLabel != null) widget.blockLabel!, widget.towerLabel, widget.floorLabel].join(' • '),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        actions: [
          BlocBuilder<SnagDesnagBloc, SnagDesnagState>(
            builder: (context, state) {
              final list = _listFrom(state);
              final round = list?.activeRound;
              if (list == null || round == null || round.items.isEmpty) return const SizedBox.shrink();
              return _downloadingPdf
                  ? const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 14),
                      child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                    )
                  : IconButton(
                      icon: const Icon(Icons.picture_as_pdf_outlined),
                      tooltip: 'Download Status Report',
                      onPressed: () => _downloadPdf(context, list.id, round.roundNumber),
                    );
            },
          ),
          if (ps.canUpdateSnag || ps.canApproveSnag)
            BlocBuilder<SnagDesnagBloc, SnagDesnagState>(
              builder: (context, state) {
                final list = _listFrom(state);
                final hasItems = list?.activeRound?.items.isNotEmpty ?? false;
                if (!hasItems) return const SizedBox.shrink();
                return TextButton(
                  onPressed: _toggleBulkMode,
                  child: Text(_bulkMode ? 'Cancel' : 'Select', style: const TextStyle(color: Colors.white)),
                );
              },
            ),
        ],
      ),
      body: BlocConsumer<SnagDesnagBloc, SnagDesnagState>(
        listener: (context, state) {
          if (state is SnagDesnagError) {
            AppSnackbar.error(context, state.message);
          }
          if (state is SnagActionSuccess) {
            AppSnackbar.success(context, state.message);
            setState(() {
              _bulkMode = false;
              _selectedItemIds.clear();
            });
          }
          if (state is SnagUnitWasReset) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unit reset to unready')));
            Navigator.of(context).pop(true);
          }
        },
        builder: (context, state) {
          final list = _listFrom(state);
          if (list == null) {
            if (state is SnagDesnagError) {
              return EmptyStateView(icon: Icons.error_outline, message: state.message);
            }
            if (state is SnagUnitNotStarted) {
              // Not [EmptyStateView] — "Mark Ready" is a primary action the
              // user is meant to take here, not an incidental retry, so it
              // keeps its own prominent FilledButton + icon.
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.hourglass_empty_rounded, size: 48, color: Colors.grey.shade400),
                      const SizedBox(height: 12),
                      const Text(
                        "This unit hasn't started snagging yet.",
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600),
                      ),
                      if (ps.canCreateSnag) ...[
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: () => context.read<SnagDesnagBloc>().add(
                              MarkSnagUnitReadyEvent(state.projectId, state.qualityUnitId, epsNodeId: state.epsNodeId)),
                          icon: const Icon(Icons.playlist_add_check_rounded),
                          label: const Text('Mark Ready for Snagging'),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }
            return const LoadingView();
          }

          final round = list.activeRound;
          final step = list.processSteps.where((s) => s.workflowSerialNo == list.currentRound).firstOrNull;
          // Raising is a Checker action per the current backend contract
          // (`addItem` is gated QUALITY.SNAG.APPROVE) — not the Maker
          // CREATE permission that marks the unit ready in the first place
          // (see the SnagUnitNotStarted branch above).
          //
          // Matches `addItem`'s real backend gate (snag.service.ts), not
          // just "snagPhaseStatus == open": per the July 2026 handoff, a
          // Checker can still raise additional points after the snag phase
          // is submitted (even after every de-snag point is closed) right
          // up until final closure — the backend silently reopens the round
          // when that happens. Blocked only once the round is finally
          // closed, skipped, or the unit is `released` awaiting the Maker
          // to start the next cycle.
          final canRaise = ps.canApproveSnag &&
              round != null &&
              !round.isSkipped &&
              !round.isFinallyClosed &&
              list.overallStatus != SnagListStatus.released;
          final canResetReady = ps.canApproveSnag &&
              list.overallStatus == SnagListStatus.readyForSnag &&
              (round?.items.isEmpty ?? true);
          // Maker action to open the next configured cycle once the
          // current one is finally closed but more cycles remain — the
          // unit sits in `released` until this is pressed. Distinct
          // endpoint from first-time readiness; see MarkNextSnagCycleReadyEvent.
          final canStartNextCycle = ps.canCreateSnag && list.overallStatus == SnagListStatus.released;

          return Stack(
            children: [
              RefreshIndicator(
                onRefresh: () async => context.read<SnagDesnagBloc>().add(
                    OpenSnagUnit(widget.projectId, list.qualityUnitId, snagListId: list.id)),
                child: ListView(
                  padding: EdgeInsets.fromLTRB(16, 16, 16, _bulkMode && _selectedItemIds.isNotEmpty ? 90 : 16),
                  children: [
                    _HeaderCard(list: list, step: step),
                    if (canStartNextCycle) ...[
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: () => context.read<SnagDesnagBloc>().add(
                            MarkNextSnagCycleReadyEvent(widget.projectId, list.id)),
                        icon: const Icon(Icons.playlist_add_check_rounded),
                        label: Text('Mark Ready and Start Snag ${list.currentRound + 1}'),
                        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)),
                      ),
                    ],
                    if (canResetReady) ...[
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: () => _confirmResetReady(context),
                        icon: const Icon(Icons.undo, size: 16),
                        label: const Text('Reset to Unready'),
                        style: OutlinedButton.styleFrom(foregroundColor: Colors.grey.shade700),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Text('Snag Points — Round ${round?.roundNumber ?? list.currentRound}',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
                    const SizedBox(height: 8),
                    if (round == null || round.items.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text(
                            canRaise ? 'No snag points raised yet. Tap "Raise Snag" to add one.' : 'No snag points raised yet.',
                            style: const TextStyle(color: Colors.grey),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      )
                    else
                      for (final item in round.items)
                        _SnagItemTile(
                          item: item,
                          bulkMode: _bulkMode,
                          selected: _selectedItemIds.contains(item.id),
                          onToggleSelect: () => _toggleSelect(item.id),
                          onTap: (ps.canUpdateSnag || ps.canApproveSnag) && !_bulkMode
                              ? () => _showItemActions(context, item, ps, step)
                              : null,
                        ),
                    if (round != null) ...[
                      const SizedBox(height: 16),
                      _PhaseActions(round: round, canUpdate: ps.canUpdateSnag),
                    ],
                    if (round != null && round.approvals.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _ApprovalPanel(approval: round.approvals.last, canApprove: ps.canApproveSnag),
                    ],
                    if (round != null && !round.isSkipped) ...[
                      const SizedBox(height: 16),
                      _FinalClosureSection(round: round, canApprove: ps.canApproveSnag),
                    ],
                  ],
                ),
              ),
              if (state is SnagUnitActionInProgress)
                const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator()),
              if (_bulkMode && _selectedItemIds.isNotEmpty && round != null)
                Positioned(
                  left: 0, right: 0, bottom: 0,
                  child: _BulkActionBar(
                    selectedCount: _selectedItemIds.length,
                    round: round,
                    selectedIds: _selectedItemIds,
                    canUpdate: ps.canUpdateSnag,
                    canApprove: ps.canApproveSnag,
                    step: step,
                  ),
                ),
            ],
          );
        },
      ),
      floatingActionButton: _bulkMode
          ? null
          : BlocBuilder<SnagDesnagBloc, SnagDesnagState>(
              builder: (context, state) {
                final list = _listFrom(state);
                if (list == null) return const SizedBox.shrink();
                final round = list.activeRound;
                // Mirrors the gate above the item list — see that comment
                // for why this isn't just "snagPhaseStatus == open".
                final canRaise = ps.canApproveSnag &&
                    round != null &&
                    !round.isSkipped &&
                    !round.isFinallyClosed &&
                    list.overallStatus != SnagListStatus.released;
                if (!canRaise) return const SizedBox.shrink();

                final bloc = context.read<SnagDesnagBloc>();
                return FloatingActionButton.extended(
                  onPressed: () {
                    // BlocProvider.value shares this same bloc instance with
                    // the pushed page, so RaiseSnagItemEvent there updates
                    // (or offline-queues against) the state we're already
                    // watching here — no separate refetch needed on return.
                    Navigator.of(context).push<bool>(MaterialPageRoute(
                      builder: (_) => BlocProvider.value(
                        value: bloc,
                        child: SnagRaiseFlowPage(
                          rooms: list.rooms,
                          processStep: list.processSteps.where((s) => s.workflowSerialNo == list.currentRound).firstOrNull,
                        ),
                      ),
                    ));
                  },
                  icon: const Icon(Icons.add_circle_outline),
                  label: const Text('Raise Snag'),
                );
              },
            ),
    );
  }

  void _confirmResetReady(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Reset to Unready'),
        content: const Text('This removes the unit\'s snag workspace entirely since no points have been raised yet. Continue?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.read<SnagDesnagBloc>().add(const ResetSnagReadyEvent());
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Reset'),
          ),
        ],
      ),
    );
  }

  Future<void> _showItemActions(BuildContext context, SnagItem item, PermissionService ps, SnagProcessStep? step) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (item.status == SnagItemStatus.open && ps.canUpdateSnag) ...[
              ListTile(
                leading: const Icon(Icons.check_circle_outline, color: Colors.blue),
                title: const Text('Mark Rectified'),
                onTap: () => Navigator.of(ctx).pop('rectify'),
              ),
              ListTile(
                leading: const Icon(Icons.pause_circle_outline, color: Colors.grey),
                title: const Text('Hold'),
                onTap: () => Navigator.of(ctx).pop('hold'),
              ),
            ],
            if (item.status == SnagItemStatus.rectified && ps.canApproveSnag) ...[
              ListTile(
                leading: const Icon(Icons.task_alt, color: Colors.green),
                title: const Text('Close / Desnag'),
                onTap: () => Navigator.of(ctx).pop('close'),
              ),
              ListTile(
                leading: const Icon(Icons.thumb_down_outlined, color: Colors.red),
                title: const Text('Not Satisfactory'),
                subtitle: const Text('Sends the point back to open with remarks'),
                onTap: () => Navigator.of(ctx).pop('reject'),
              ),
            ],
          ],
        ),
      ),
    );
    if (action == null || !context.mounted) return;

    switch (action) {
      case 'rectify':
        final input = await showRectifySheet(context, photoRequired: step?.rectificationPhotoRequired ?? false);
        if (input != null && context.mounted) {
          context.read<SnagDesnagBloc>().add(RectifySnagItemEvent(
                item.id,
                afterPhotoUrls: input.photoUrls,
                rectificationNotes: input.notes,
              ));
        }
      case 'close':
        final input = await showCloseSheet(context, photoRequired: step?.desnagCompletionPhotoRequired ?? false);
        if (input != null && context.mounted) {
          context.read<SnagDesnagBloc>().add(CloseSnagItemEvent(
                item.id,
                remarks: input.notes,
                closurePhotoUrls: input.photoUrls,
              ));
        }
      case 'hold':
        final reason = await showHoldReasonSheet(context);
        if (reason != null && context.mounted) {
          context.read<SnagDesnagBloc>().add(HoldSnagItemEvent(item.id, reason));
        }
      case 'reject':
        final remarks = await showRejectRectificationSheet(context);
        if (remarks != null && context.mounted) {
          context.read<SnagDesnagBloc>().add(RejectRectificationEvent(item.id, remarks: remarks));
        }
    }
  }
}

class _BulkActionBar extends StatelessWidget {
  final int selectedCount;
  final SnagRound round;
  final Set<int> selectedIds;
  final bool canUpdate;
  final bool canApprove;
  final SnagProcessStep? step;

  const _BulkActionBar({
    required this.selectedCount,
    required this.round,
    required this.selectedIds,
    required this.canUpdate,
    required this.canApprove,
    required this.step,
  });

  @override
  Widget build(BuildContext context) {
    final selectedItems = round.items.where((i) => selectedIds.contains(i.id)).toList();
    final allOpen = selectedItems.isNotEmpty && selectedItems.every((i) => i.status == SnagItemStatus.open);
    final allRectified = selectedItems.isNotEmpty && selectedItems.every((i) => i.status == SnagItemStatus.rectified);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, -2))],
      ),
      child: Row(
        children: [
          Text('$selectedCount selected', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          const Spacer(),
          if (allOpen && canUpdate)
            FilledButton.icon(
              onPressed: () async {
                final input = await showRectifySheet(context, photoRequired: step?.rectificationPhotoRequired ?? false);
                if (input != null && context.mounted) {
                  context.read<SnagDesnagBloc>().add(BulkRectifySnagItemsEvent(
                        round.roundNumber,
                        selectedIds.toList(),
                        afterPhotoUrls: input.photoUrls,
                        rectificationNotes: input.notes,
                      ));
                }
              },
              icon: const Icon(Icons.check_circle_outline, size: 16),
              label: const Text('Bulk Rectify'),
            )
          else if (allRectified && canApprove)
            FilledButton.icon(
              onPressed: () async {
                final input = await showCloseSheet(context, photoRequired: step?.desnagCompletionPhotoRequired ?? false);
                if (input != null && context.mounted) {
                  context.read<SnagDesnagBloc>().add(BulkCloseSnagItemsEvent(
                        round.roundNumber,
                        selectedIds.toList(),
                        remarks: input.notes,
                        closurePhotoUrls: input.photoUrls,
                      ));
                }
              },
              icon: const Icon(Icons.task_alt, size: 16),
              label: const Text('Bulk Close'),
            )
          else
            Text('Select items with the same status to act on them together.',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
        ],
      ),
    );
  }
}

class _PhaseActions extends StatelessWidget {
  final SnagRound round;
  final bool canUpdate;
  const _PhaseActions({required this.round, required this.canUpdate});

  @override
  Widget build(BuildContext context) {
    if (!canUpdate) return const SizedBox.shrink();

    if (round.snagPhaseStatus == SnagRoundSnagPhaseStatus.open) {
      return OutlinedButton.icon(
        onPressed: () => _confirm(
          context,
          title: 'Submit Snag Phase',
          message: 'Submit this round\'s snagging for review? You can still raise more points until the round moves on.',
          onConfirm: () => context.read<SnagDesnagBloc>().add(SubmitSnagPhaseEvent(round.id)),
        ),
        icon: const Icon(Icons.send_outlined, size: 16),
        label: const Text('Submit Snag Phase'),
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
      );
    }

    if (round.snagPhaseStatus == SnagRoundSnagPhaseStatus.submitted &&
        round.desnagPhaseStatus == SnagRoundDesnagPhaseStatus.open) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilledButton.icon(
            onPressed: round.allItemsResolved
                ? () => _confirm(
                      context,
                      title: 'Submit for Desnag Approval',
                      message: 'Send this round for desnag approval? The assigned approver will be notified.',
                      onConfirm: () => context.read<SnagDesnagBloc>().add(SubmitDesnagReleaseEvent(round.id)),
                    )
                : null,
            icon: const Icon(Icons.verified_outlined, size: 16),
            label: const Text('Submit for Desnag Approval'),
          ),
          if (!round.allItemsResolved)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'All snag items must be closed or held before release approval.',
                style: TextStyle(fontSize: 11, color: Colors.orange.shade800),
              ),
            ),
        ],
      );
    }

    return const SizedBox.shrink();
  }

  void _confirm(BuildContext context, {required String title, required String message, required VoidCallback onConfirm}) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              onConfirm();
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }
}

/// The Checker's final sign-off gate — stricter than [_PhaseActions]'
/// desnag-approval submit: every item must be exactly `closed` (an
/// on-hold item blocks this), matching `finalClosureRound`'s backend rule.
/// Not dependent on the release-strategy approval panel having run first —
/// the backend accepts final closure independently.
class _FinalClosureSection extends StatelessWidget {
  final SnagRound round;
  final bool canApprove;
  const _FinalClosureSection({required this.round, required this.canApprove});

  @override
  Widget build(BuildContext context) {
    if (round.isFinallyClosed) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.green.shade100),
        ),
        child: Row(
          children: [
            Icon(Icons.verified, color: Colors.green.shade700, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Finally closed${round.finalClosureRemarks != null ? ' — ${round.finalClosureRemarks}' : ''}',
                style: TextStyle(fontSize: 12, color: Colors.green.shade800),
              ),
            ),
          ],
        ),
      );
    }

    if (!canApprove) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FilledButton.icon(
          onPressed: round.allItemsClosed ? () => _finalClose(context) : null,
          icon: const Icon(Icons.gavel_outlined, size: 16),
          label: Text('Final Closure of Snag ${round.roundNumber}'),
          style: FilledButton.styleFrom(backgroundColor: Colors.indigo.shade700, minimumSize: const Size.fromHeight(44)),
        ),
        if (!round.allItemsClosed)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              'Every snag point in this round must be Closed (not on hold) before final closure.',
              style: TextStyle(fontSize: 11, color: Colors.orange.shade800),
            ),
          ),
      ],
    );
  }

  Future<void> _finalClose(BuildContext context) async {
    final remarksCtrl = TextEditingController();
    final proceed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Final Closure of Snag ${round.roundNumber}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('This is the final gate — closing all items alone does not release the unit. You\'ll sign next.'),
            const SizedBox(height: 12),
            TextField(
              controller: remarksCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Remarks (optional)', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: Colors.indigo.shade700),
            child: const Text('Continue to Sign'),
          ),
        ],
      ),
    );
    if (proceed != true || !context.mounted) return;

    final signed = await SignatureApprovalSheet.showForSignoff(
      context,
      department: 'Snag ${round.roundNumber} Final Closure',
    );
    if (signed == null || !context.mounted) return;

    context.read<SnagDesnagBloc>().add(FinalClosureEvent(
          round.id,
          remarks: remarksCtrl.text.trim().isEmpty ? null : remarksCtrl.text.trim(),
          signatureData: signed.$1,
        ));
  }
}

class _ApprovalPanel extends StatelessWidget {
  final SnagApproval approval;
  final bool canApprove;
  const _ApprovalPanel({required this.approval, required this.canApprove});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.amber.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.rule_folder_outlined, size: 16, color: Colors.amber.shade900),
              const SizedBox(width: 6),
              const Text('Desnag Approval', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              const Spacer(),
              Text(approval.status.name, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.amber.shade900)),
            ],
          ),
          const SizedBox(height: 8),
          for (final step in approval.steps)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Icon(
                    step.status == SnagApprovalStepStatus.approved
                        ? Icons.check_circle
                        : step.status == SnagApprovalStepStatus.rejected
                            ? Icons.cancel
                            : Icons.radio_button_unchecked,
                    size: 14,
                    color: step.status == SnagApprovalStepStatus.approved
                        ? Colors.green
                        : step.status == SnagApprovalStepStatus.rejected
                            ? Colors.red
                            : Colors.grey,
                  ),
                  const SizedBox(width: 6),
                  Expanded(child: Text('${step.stepOrder}. ${step.stepName}', style: const TextStyle(fontSize: 12))),
                  Text(step.status.name, style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
                ],
              ),
            ),
          if (approval.status == SnagApprovalStatus.pending && canApprove) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _reject(context),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700, side: BorderSide(color: Colors.red.shade400)),
                    child: const Text('Reject'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: () => context.read<SnagDesnagBloc>().add(AdvanceSnagApprovalEvent(approval.id, action: 'APPROVE')),
                    style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700),
                    child: const Text('Approve'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  void _reject(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Reject Desnag Release'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Reason *', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (ctrl.text.trim().isEmpty) return;
              Navigator.of(ctx).pop();
              context.read<SnagDesnagBloc>().add(AdvanceSnagApprovalEvent(approval.id, action: 'REJECT', comments: ctrl.text.trim()));
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  final SnagList list;
  final SnagProcessStep? step;
  const _HeaderCard({required this.list, required this.step});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.indigo.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.indigo.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  step != null ? 'Current step: ${step!.name}' : 'Round ${list.currentRound}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: Colors.indigo.shade100, borderRadius: BorderRadius.circular(6)),
                child: Text(list.overallStatus.label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          if (list.activeRound != null) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _CountChip(label: 'Open', count: list.activeRound!.openCount, color: Colors.deepOrange),
                _CountChip(label: 'Rectified', count: list.activeRound!.rectifiedCount, color: Colors.blue),
                _CountChip(label: 'Closed', count: list.activeRound!.closedCount, color: Colors.green),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CountChip extends StatelessWidget {
  final String label;
  final int count;
  final MaterialColor color;
  const _CountChip({required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: color.shade50, borderRadius: BorderRadius.circular(8)),
      child: Text('$label: $count', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color.shade800)),
    );
  }
}

class _SnagItemTile extends StatelessWidget {
  final SnagItem item;
  final bool bulkMode;
  final bool selected;
  final VoidCallback onToggleSelect;
  final VoidCallback? onTap;

  const _SnagItemTile({
    required this.item,
    required this.bulkMode,
    required this.selected,
    required this.onToggleSelect,
    required this.onTap,
  });

  Color get _color => switch (item.status) {
    SnagItemStatus.open => Colors.deepOrange,
    SnagItemStatus.rectified => Colors.blue,
    SnagItemStatus.closed => Colors.green,
    SnagItemStatus.onHold => Colors.grey,
  };

  /// The single most relevant timestamp for this item's current state —
  /// prefers the latest not-satisfactory rejection (the most actionable
  /// event) over the plain status timestamp when both are present.
  String? get _timelineLabel {
    const fmt = 'd MMM, HH:mm';
    if (item.lastNotSatisfactoryAt != null) {
      return 'Rejected ${DateFormat(fmt).format(item.lastNotSatisfactoryAt!)}';
    }
    if (item.closedAt != null) return 'Closed ${DateFormat(fmt).format(item.closedAt!)}';
    if (item.rectifiedAt != null) return 'Rectified ${DateFormat(fmt).format(item.rectifiedAt!)}';
    if (item.raisedAt != null) return 'Raised ${DateFormat(fmt).format(item.raisedAt!)}';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.grey.shade200)),
      child: ListTile(
        // A pending-sync item's id is a local placeholder, not a real server
        // id — rectify/close/bulk actions against it would 404. Block
        // interaction until the queued raise has synced and this tile is
        // replaced by the real item.
        onTap: item.isPendingSync
            ? () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text("This snag point hasn't synced yet — actions will be available once it syncs."),
                ))
            : (bulkMode ? onToggleSelect : onTap),
        title: Text(item.defectTitle, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    [if (item.roomLabel != null) item.roomLabel!, if (item.trade != null) item.trade!].join(' • '),
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  ),
                ),
                if (item.notSatisfactoryCount > 0)
                  Container(
                    margin: const EdgeInsets.only(left: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(4)),
                    child: Text(
                      'Rejected ${item.notSatisfactoryCount}x',
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.red.shade700),
                    ),
                  ),
              ],
            ),
            if (_timelineLabel != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(_timelineLabel!, style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
              ),
          ],
        ),
        leading: bulkMode
            ? Checkbox(value: selected, onChanged: item.isPendingSync ? null : (_) => onToggleSelect())
            : (item.photos.isNotEmpty
                ? const Icon(Icons.photo_outlined, color: Colors.grey)
                : const Icon(Icons.image_not_supported_outlined, color: Colors.grey)),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (item.isPendingSync)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Tooltip(
                  message: 'Saved offline — will sync when back online',
                  child: Icon(Icons.sync_problem_outlined, size: 16, color: Colors.orange.shade700),
                ),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: _color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
              child: Text(item.status.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _color)),
            ),
          ],
        ),
      ),
    );
  }
}
