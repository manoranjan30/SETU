import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
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
    // Admin-only destructive override (August 2026 handoff) — the backend
    // enforces this role check itself regardless of permission grants, but
    // mobile still hides the button for everyone else so it isn't offered
    // as a substitute for the ordinary Checker/Maker flow. `hasRole('Admin')`
    // mirrors `snag.service.ts:isAdminUser`'s `role.name === 'Admin'` check.
    final authState = context.read<AuthBloc>().state;
    final isAdmin = authState is AuthAuthenticated && authState.user.hasRole('Admin');

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
          if (isAdmin && ps.canDeleteSnag)
            BlocBuilder<SnagDesnagBloc, SnagDesnagState>(
              builder: (context, state) {
                final list = _listFrom(state);
                final round = list?.activeRound;
                if (list == null || round == null) return const SizedBox.shrink();
                return IconButton(
                  icon: const Icon(Icons.delete_forever_outlined),
                  tooltip: 'Admin: Delete All Points and Reset Stage',
                  onPressed: () => _confirmAdminReset(context, round.id),
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

          final isFromCache = state is SnagUnitDetailLoaded && state.isFromCache;
          final round = list.activeRound;
          final step = list.processSteps.where((s) => s.workflowSerialNo == list.currentRound).firstOrNull;
          // Raising is a Checker action per the current backend contract
          // (`addItem` is gated QUALITY.SNAG.APPROVE) — not the Maker
          // CREATE permission that marks the unit ready in the first place
          // (see the SnagUnitNotStarted branch above).
          //
          // `canRaiseSnag` is backend-computed (snag.service.ts:
          // serializeRound) — per the multi-level handoff, mobile must use
          // that boolean rather than re-deriving round-state rules locally.
          final canRaise = ps.canApproveSnag && (round?.canRaiseSnag ?? false);
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
                    if (isFromCache)
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(8)),
                        child: Row(
                          children: [
                            Icon(Icons.cloud_off_outlined, size: 16, color: Colors.orange.shade800),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Offline — showing the last saved data. Pull to refresh once back online.',
                                style: TextStyle(fontSize: 11, color: Colors.orange.shade900),
                              ),
                            ),
                          ],
                        ),
                      ),
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
                          onTap: !_bulkMode ? () => _showItemActions(context, item, ps, step, round) : null,
                          gates: _computeItemGates(item, ps, round),
                          onView: () => _showItemEvidence(context, item),
                          onRectify: () => _performItemAction(context, item, step, 'rectify'),
                          onConfirm: () => _performItemAction(context, item, step, 'close'),
                          onReject: () => _performItemAction(context, item, step, 'reject'),
                        ),
                    if (round != null && !round.isSkipped) ...[
                      const SizedBox(height: 16),
                      _VerifierLevelSection(round: round, canApprove: ps.canApproveSnag),
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
                // Mirrors the gate above the item list.
                final canRaise = ps.canApproveSnag && (round?.canRaiseSnag ?? false);
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
                          projectId: widget.projectId,
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

  /// Admin-only destructive override — see [AdminResetSnagRoundToUnreadyEvent]'s
  /// doc comment. [reason] is mandatory server-side (`ResetSnagRoundDto`),
  /// so the confirm button stays disabled until non-empty, matching the
  /// hold-reason dialog's convention in `snag_item_action_sheets.dart`.
  Future<void> _confirmAdminReset(BuildContext context, int roundId) async {
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Delete All Points and Reset Stage'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'This permanently deletes every snag point, photo, approval, and level closure for this stage and rolls it back to unready. This cannot be undone.',
                style: TextStyle(color: Colors.red.shade700, fontSize: 12.5),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: reasonCtrl,
                autofocus: true,
                maxLines: 2,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(labelText: 'Reason *', border: OutlineInputBorder(), isDense: true),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
            FilledButton(
              onPressed: reasonCtrl.text.trim().isEmpty ? null : () => Navigator.of(ctx).pop(reasonCtrl.text.trim()),
              style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
              child: const Text('Delete & Reset'),
            ),
          ],
        ),
      ),
    );
    if (reason == null || reason.isEmpty || !context.mounted) return;
    context.read<SnagDesnagBloc>().add(AdminResetSnagRoundToUnreadyEvent(roundId, reason));
  }

  /// Per-item action gates shared by [_showItemActions]'s bottom sheet and
  /// the inline icons on [_SnagItemTile] — computed once here so both entry
  /// points can never disagree about what's currently allowed.
  ///
  /// The item's own level must match the round's currently-active level —
  /// an item raised at a level that's already closed (or not yet reached)
  /// can't be acted on, matching closeItem/rejectRectification's own
  /// server-side check (snag.service.ts). Backend-computed round gates
  /// (`canRectify`/`canConfirmDesnag`), per the multi-level handoff, drive
  /// this rather than locally re-derived status/permission checks alone.
  _ItemGates _computeItemGates(SnagItem item, PermissionService ps, SnagRound round) {
    final isActiveLevel = item.verifierLevelOrder ==
        (round.activeVerifierLevel?.levelOrder ?? round.currentVerifierLevel);
    return _ItemGates(
      canRectify: item.status == SnagItemStatus.open && ps.canUpdateSnag && round.canRectify,
      canHold: item.status == SnagItemStatus.open && ps.canUpdateSnag,
      canConfirm: item.status == SnagItemStatus.rectified &&
          ps.canApproveSnag &&
          round.canConfirmDesnag &&
          isActiveLevel,
    );
  }

  Future<void> _showItemActions(
    BuildContext context, SnagItem item, PermissionService ps, SnagProcessStep? step, SnagRound round,
  ) async {
    final gates = _computeItemGates(item, ps, round);
    final canRectifyThis = gates.canRectify;
    final canHoldThis = gates.canHold;
    final canConfirmThis = gates.canConfirm;

    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined, color: Colors.indigo),
              title: const Text('View Evidence Photos'),
              onTap: () => Navigator.of(ctx).pop('view'),
            ),
            if (canRectifyThis)
              ListTile(
                leading: const Icon(Icons.check_circle_outline, color: Colors.blue),
                title: const Text('Mark Rectified'),
                onTap: () => Navigator.of(ctx).pop('rectify'),
              ),
            if (canHoldThis)
              ListTile(
                leading: const Icon(Icons.pause_circle_outline, color: Colors.grey),
                title: const Text('Hold'),
                onTap: () => Navigator.of(ctx).pop('hold'),
              ),
            if (canConfirmThis) ...[
              ListTile(
                leading: const Icon(Icons.task_alt, color: Colors.green),
                title: const Text('De-snag Confirmed'),
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
    await _performItemAction(context, item, step, action);
  }

  /// The actual per-action logic (photo/notes sheet, then bloc dispatch) —
  /// shared by [_showItemActions]'s bottom sheet and the inline action icons
  /// on [_SnagItemTile], so both entry points behave identically.
  Future<void> _performItemAction(
    BuildContext context, SnagItem item, SnagProcessStep? step, String action,
  ) async {
    switch (action) {
      case 'view':
        await _showItemEvidence(context, item);
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

  /// Read-only view of the three evidence sections the multi-level handoff
  /// calls out — Snagged / Rectified / De-snag Confirmed — reusing
  /// [PhotoThumbnailStrip] the same way every other photo-bearing feature
  /// in the app does, rather than inventing a new gallery widget.
  Future<void> _showItemEvidence(BuildContext context, SnagItem item) async {
    List<String> urls(List<SnagPhoto> photos) =>
        photos.map((p) => ApiEndpoints.resolveUrl(p.fileUrl)).toList();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.defectTitle, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              _EvidenceSection(label: 'Snagged Photos', urls: urls(item.snaggedPhotos)),
              _EvidenceSection(label: 'Rectified Photos', urls: urls(item.rectifiedPhotos)),
              _EvidenceSection(label: 'De-snag Confirmed Photos', urls: urls(item.desnagConfirmedPhotos)),
            ],
          ),
        ),
      ),
    );
  }
}

class _EvidenceSection extends StatelessWidget {
  final String label;
  final List<String> urls;
  const _EvidenceSection({required this.label, required this.urls});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
          const SizedBox(height: 6),
          if (urls.isEmpty)
            Text('No photos', style: TextStyle(fontSize: 12, color: Colors.grey.shade500))
          else
            PhotoThumbnailStrip(photoUrls: urls),
        ],
      ),
    );
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
    final activeLevelOrder = round.activeVerifierLevel?.levelOrder ?? round.currentVerifierLevel;
    final allOpen = selectedItems.isNotEmpty && selectedItems.every((i) => i.status == SnagItemStatus.open);
    final allRectified = selectedItems.isNotEmpty &&
        selectedItems.every((i) => i.status == SnagItemStatus.rectified && i.verifierLevelOrder == activeLevelOrder);

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
          if (allOpen && canUpdate && round.canRectify)
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
          else if (allRectified && canApprove && round.canConfirmDesnag)
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
              label: const Text('Bulk De-snag Confirm'),
            )
          else
            Text('Select items with the same status to act on them together.',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
        ],
      ),
    );
  }
}

/// Multi-level verifier timeline + signed level closure — the *only* way a
/// snag stage's verifier levels close, per the multi-level handoff. Item
/// actions (raise/rectify/de-snag confirm) auto-advance the round's level
/// state on the backend (see `snag.service.ts:rectifyItem`/`closeItem`),
/// so — unlike the older flow this replaces — there's no separate "submit
/// snag phase" / "submit for desnag approval" step for the user to press;
/// closing the active level is available as soon as every one of its items
/// is de-snag confirmed.
class _VerifierLevelSection extends StatelessWidget {
  final SnagRound round;
  final bool canApprove;
  const _VerifierLevelSection({required this.round, required this.canApprove});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Verifier Levels', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
        const SizedBox(height: 8),
        for (final level in round.verifierLevels) _VerifierLevelTile(level: level),
        if (round.isFinallyClosed) ...[
          const SizedBox(height: 8),
          Container(
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
                    'Snag stage finally closed${round.finalClosureRemarks != null ? ' — ${round.finalClosureRemarks}' : ''}',
                    style: TextStyle(fontSize: 12, color: Colors.green.shade800),
                  ),
                ),
              ],
            ),
          ),
        ] else if (canApprove) ...[
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: round.canCloseLevel ? () => _closeLevel(context) : null,
            icon: const Icon(Icons.gavel_outlined, size: 16),
            label: Text(
              round.canFinalCloseStage
                  ? 'Final Closure of Snag Stage ${round.roundNumber}'
                  : 'Close Level ${round.activeVerifierLevel?.levelOrder ?? round.currentVerifierLevel}',
            ),
            style: FilledButton.styleFrom(backgroundColor: Colors.indigo.shade700, minimumSize: const Size.fromHeight(44)),
          ),
          if (!round.canCloseLevel)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Every snag point at the active verifier level must be de-snag confirmed before closure.',
                style: TextStyle(fontSize: 11, color: Colors.orange.shade800),
              ),
            ),
        ],
      ],
    );
  }

  Future<void> _closeLevel(BuildContext context) async {
    final activeLevel = round.activeVerifierLevel;
    final levelOrder = activeLevel?.levelOrder ?? round.currentVerifierLevel;
    final isFinal = round.canFinalCloseStage;
    final title = isFinal ? 'Final Closure of Snag Stage ${round.roundNumber}' : 'Close Level $levelOrder';

    final remarksCtrl = TextEditingController();
    final proceed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isFinal
                  ? 'This is the final gate for this snag stage — closing all items alone does not release the unit. You\'ll sign next.'
                  : 'This closes ${activeLevel?.levelName ?? 'the active level'} and opens the next verifier level for raising. You\'ll sign next.',
            ),
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

    final signed = await SignatureApprovalSheet.showForSignoff(context, department: title);
    if (signed == null || !context.mounted) return;

    context.read<SnagDesnagBloc>().add(CloseVerifierLevelEvent(
          round.id,
          levelOrder,
          remarks: remarksCtrl.text.trim().isEmpty ? null : remarksCtrl.text.trim(),
          signatureData: signed.$1,
        ));
  }
}

class _VerifierLevelTile extends StatelessWidget {
  final SnagVerifierLevel level;
  const _VerifierLevelTile({required this.level});

  @override
  Widget build(BuildContext context) {
    final (label, color) = level.isClosed
        ? ('Closed', Colors.green)
        : level.isActive
            ? ('Active', Colors.deepOrange)
            : ('Waiting', Colors.grey);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: level.isActive ? Colors.indigo.shade50 : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: level.isActive ? Colors.indigo.shade100 : Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('L${level.levelOrder} ${level.levelName}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              _LevelCountChip(label: 'Raised', count: level.raisedCount, color: Colors.blueGrey),
              _LevelCountChip(label: 'Open', count: level.openCount, color: Colors.deepOrange),
              _LevelCountChip(label: 'Rect. Pending', count: level.rectifiedPendingDesnagCount, color: Colors.blue),
              _LevelCountChip(label: 'De-snag OK', count: level.desnagConfirmedCount, color: Colors.green),
              if (level.notSatisfactoryCount > 0)
                _LevelCountChip(label: 'Not Satisfactory', count: level.notSatisfactoryCount, color: Colors.red),
            ],
          ),
          if (level.closure != null) ...[
            const SizedBox(height: 6),
            Text(
              'Signed ${level.closure!.closedAt != null ? DateFormat('d MMM, HH:mm').format(level.closure!.closedAt!) : ''}'
              '${level.closure!.remarks != null ? ' — ${level.closure!.remarks}' : ''}',
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
            ),
          ],
        ],
      ),
    );
  }
}

class _LevelCountChip extends StatelessWidget {
  final String label;
  final int count;
  final MaterialColor color;
  const _LevelCountChip({required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(color: color.shade50, borderRadius: BorderRadius.circular(6)),
      child: Text('$label: $count', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color.shade800)),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  final SnagList list;
  final SnagProcessStep? step;
  const _HeaderCard({required this.list, required this.step});

  /// Per the "update snag/de-snag mobile labels only" handoff: while the
  /// round is `ready_for_snag`, a multi-level round whose active verifier
  /// level isn't the last configured one shows which level is waiting
  /// ("Ready for L2 Snagging") rather than the generic status label — the
  /// backend made no API change for this, it's purely a label read off the
  /// existing `activeVerifierLevel`/`verifierLevels` fields.
  String get _statusLabel {
    if (list.overallStatus != SnagListStatus.readyForSnag) return list.overallStatus.label;
    final round = list.activeRound;
    final levels = round?.verifierLevels ?? const [];
    if (levels.length <= 1) return 'Ready for Snagging';
    final levelOrder = round?.activeVerifierLevel?.levelOrder ?? round?.currentVerifierLevel ?? 1;
    final lastLevelOrder = levels.last.levelOrder;
    return levelOrder != lastLevelOrder ? 'Ready for L$levelOrder Snagging' : 'Ready for Snagging';
  }

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
                child: Text(_statusLabel, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
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
  final _ItemGates gates;
  final VoidCallback onView;
  final VoidCallback onRectify;
  final VoidCallback onConfirm;
  final VoidCallback onReject;

  const _SnagItemTile({
    required this.item,
    required this.bulkMode,
    required this.selected,
    required this.onToggleSelect,
    required this.onTap,
    required this.gates,
    required this.onView,
    required this.onRectify,
    required this.onConfirm,
    required this.onReject,
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

  /// Small `label: value`-style badge shared by every meta chip on the
  /// card — kept to one consistent visual weight so a dense row of them
  /// still scans quickly rather than looking noisy.
  Widget _badge(String text, MaterialColor color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(color: color.shade50, borderRadius: BorderRadius.circular(4)),
    child: Text(text, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color.shade700)),
  );

  @override
  Widget build(BuildContext context) {
    // Slim, custom-laid-out row instead of Card+ListTile — ListTile's
    // built-in content padding/min-height makes each point take up roughly
    // twice the vertical space this needs, and with 10-50+ points per round
    // being able to see several at once while scanning matters more than
    // per-tile whitespace. The left status stripe keeps the same "scan by
    // color" affordance the old trailing chip gave, just cheaper on space.
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: selected ? Colors.indigo.shade50 : Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: selected ? Colors.indigo.shade200 : Colors.grey.shade200),
      ),
      child: InkWell(
        // A pending-sync item's id is a local placeholder, not a real server
        // id — rectify/close/bulk actions against it would 404. Block
        // interaction until the queued raise has synced and this tile is
        // replaced by the real item.
        onTap: item.isPendingSync
            ? () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text("This snag point hasn't synced yet — actions will be available once it syncs."),
                ))
            : (bulkMode ? onToggleSelect : onTap),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: _color),
              if (bulkMode)
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Checkbox(
                    value: selected,
                    onChanged: item.isPendingSync ? null : (_) => onToggleSelect(),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              item.defectTitle,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.2),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          if (item.isPendingSync)
                            Padding(
                              padding: const EdgeInsets.only(right: 4),
                              child: Tooltip(
                                message: 'Saved offline — will sync when back online',
                                child: Icon(Icons.sync_problem_outlined, size: 14, color: Colors.orange.shade700),
                              ),
                            ),
                          if (item.photos.isEmpty)
                            Icon(Icons.image_not_supported_outlined, size: 14, color: Colors.grey.shade400)
                          else
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.photo_outlined, size: 14, color: Colors.grey.shade500),
                                const SizedBox(width: 2),
                                Text('${item.photos.length}', style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                              ],
                            ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(color: _color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                            child: Text(item.status.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _color)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 5,
                        runSpacing: 3,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          _badge('L${item.verifierLevelOrder}${item.verifierLevelName != null ? ' ${item.verifierLevelName}' : ''}', Colors.indigo),
                          if (item.roomLabel != null || item.trade != null)
                            Text(
                              [if (item.roomLabel != null) item.roomLabel!, if (item.trade != null) item.trade!].join(' • '),
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                            ),
                          if (item.vendorName != null && item.vendorName!.isNotEmpty)
                            Tooltip(
                              message: item.vendorName!,
                              child: _badge(_vendorInitials(item.vendorName!), Colors.teal),
                            ),
                          if (item.notSatisfactoryCount > 0)
                            _badge('Rejected ${item.notSatisfactoryCount}x', Colors.red),
                        ],
                      ),
                      if (_timelineLabel != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(_timelineLabel!, style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                        ),
                      if (!bulkMode && !item.isPendingSync)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              _ActionIcon(icon: Icons.photo_library_outlined, color: Colors.indigo, tooltip: 'View Evidence', onTap: onView),
                              if (gates.canRectify)
                                _ActionIcon(icon: Icons.check_circle_outline, color: Colors.blue, tooltip: 'Mark Rectified', onTap: onRectify),
                              if (gates.canConfirm) ...[
                                _ActionIcon(icon: Icons.task_alt, color: Colors.green, tooltip: 'De-snag Confirmed', onTap: onConfirm),
                                _ActionIcon(icon: Icons.thumb_down_outlined, color: Colors.red, tooltip: 'Not Satisfactory', onTap: onReject),
                              ],
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact icon-only action button for [_SnagItemTile]'s inline action row —
/// small enough that up to four fit on one line without pushing the card's
/// height up, unlike a full [IconButton] with its default 48dp tap target.
class _ActionIcon extends StatelessWidget {
  final IconData icon;
  final MaterialColor color;
  final String tooltip;
  final VoidCallback onTap;
  const _ActionIcon({required this.icon, required this.color, required this.tooltip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        borderRadius: BorderRadius.circular(6),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: Icon(icon, size: 17, color: color.shade700),
        ),
      ),
    );
  }
}

/// Gating flags for a single snag item's actions — see
/// `_WorkspaceViewState._computeItemGates`'s doc comment for how these are
/// derived and why they're computed in one shared place.
class _ItemGates {
  final bool canRectify;
  final bool canHold;
  final bool canConfirm;
  const _ItemGates({required this.canRectify, required this.canHold, required this.canConfirm});
}

/// Short form of a vendor's name for the card badge — first letter of each
/// word, capped to 4 characters (e.g. "ABC Constructions Pvt Ltd" → "ACPL").
/// The full name is still available via the badge's [Tooltip].
String _vendorInitials(String name) {
  final letters = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .map((w) => w[0].toUpperCase())
      .join();
  return letters.length > 4 ? letters.substring(0, 4) : letters;
}
