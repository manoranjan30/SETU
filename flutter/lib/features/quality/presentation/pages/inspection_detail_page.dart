import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:open_file/open_file.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/core/network/connectivity_banner.dart';
import 'package:setu_mobile/core/widgets/offline_banner.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/data/models/rfi_attachment.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/checklist_item_tile.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/linked_rfi_detail_sheet.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/observation_card.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/raise_observation_sheet.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/signature_approval_sheet.dart';
import 'package:setu_mobile/shared/widgets/rectify_sheet.dart';
import 'package:setu_mobile/features/quality/presentation/pages/cube_register_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/pour_card_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/pre_pour_clearance_page.dart';

/// QC Inspector detail page for a single inspection.
/// Shows checklist stages (expandable), observations, and approval actions.
/// Tabs: "Checklist" (stages with pass/fail items) and "Observations" (raised issues).
/// The bottom action bar drives the multi-level workflow approval chain.
class InspectionDetailPage extends StatefulWidget {
  final QualityInspection inspection;

  /// When set (from a push notification tap), the Observations tab
  /// auto-scrolls to and briefly highlights this observation ID on load.
  final int? highlightObservationId;

  /// 'rectify'  — auto-opens the fix sheet for [highlightObservationId]
  ///              (maker received a "rectification rejected" notification).
  /// 'review'   — scrolls to the obs and shows a "ready to close" banner
  ///              (checker received a "rectified" notification).
  /// 'readonly' — obs is closed; just scroll to it.
  /// null       — standard open, no auto-action.
  final String? initialObsAction;

  const InspectionDetailPage({
    super.key,
    required this.inspection,
    this.highlightObservationId,
    this.initialObsAction,
  });

  @override
  State<InspectionDetailPage> createState() => _InspectionDetailPageState();
}

class _InspectionDetailPageState extends State<InspectionDetailPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  /// Last successfully loaded state — shown while approval actions run
  /// and when transient errors occur (e.g. photo upload failures).
  InspectionDetailLoaded? _lastDetail;

  bool _isPdfDownloading = false;

  /// Reserves the next GO number for this activity's floor RFI series.
  /// A single confirmation — the backend always reserves exactly one GO at
  /// a time (no upfront part count); the new GO is then raised from the
  /// activity list like any other GO.
  void _showAddGoDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add GO'),
        content: Text(
          'Reserve the next GO for:\n${widget.inspection.activityName ?? 'this RFI'}\n\n'
          'Raise it from the activity list afterward.',
          style: const TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<QualityApprovalBloc>().add(AddGo(
                projectId: widget.inspection.projectId ?? 0,
                epsNodeId: widget.inspection.epsNodeId ?? 0,
                activityId: widget.inspection.activityId,
              ));
            },
            child: const Text('Add GO'),
          ),
        ],
      ),
    );
  }

  Future<void> _downloadPdf() async {
    setState(() => _isPdfDownloading = true);
    try {
      final bytes = await sl<SetuApiClient>().downloadInspectionReport(widget.inspection.id);
      if (bytes.isEmpty) throw Exception('Empty PDF response');

      final dir = await getTemporaryDirectory();
      final fileName =
          'RFI_Report_${widget.inspection.id}_${DateTime.now().millisecondsSinceEpoch}.pdf';
      final file = File('${dir.path}/$fileName');
      await file.writeAsBytes(bytes, flush: true);

      final result = await OpenFile.open(file.path);
      if (result.type != ResultType.done && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open PDF: ${result.message}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('PDF download failed: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isPdfDownloading = false);
    }
  }

  @override
  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    context
        .read<QualityApprovalBloc>()
        .add(LoadInspectionDetail(widget.inspection));
    // If opened from a notification, jump straight to the Observations tab.
    if (widget.highlightObservationId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _tabCtrl.animateTo(1);
      });
    }
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
          // Add GO — shown when this is a single-part FLOOR RFI and the
          // user has permission to raise RFIs
          if (PermissionService.of(context).canRaiseRfi &&
              widget.inspection.totalParts == 1)
            IconButton(
              icon: const Icon(Icons.add_circle_outline),
              tooltip: 'Add GO',
              onPressed: () => _showAddGoDialog(context),
            ),
          // PDF report download
          _isPdfDownloading
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14),
                  child: SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : IconButton(
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  tooltip: 'Download PDF Report',
                  onPressed: _downloadPdf,
                ),
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
            Tab(text: 'Attachments'),
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
                'expand_go': 'GO series expanded',
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
          // Observation action (raise/rectify/close/delete) — show result and refresh
          if (state is ObservationActionQueued) {
            final String msg;
            if (state.action == 'raise') {
              msg = state.isOffline
                  ? 'Observation queued — will sync when online'
                  : 'Observation raised';
            } else if (state.action == 'rectify') {
              msg = state.isOffline
                  ? 'Rectification queued — will sync when online'
                  : 'Rectification submitted — tap Close once QC is verified';
            } else if (state.action == 'close') {
              msg = state.isOffline
                  ? 'Close queued — will sync when online'
                  : 'Observation closed';
            } else if (state.action == 'deleted') {
              msg = 'Observation deleted';
            } else {
              msg = 'Done';
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
                    // Data-from-cache indicator (shown when loaded offline)
                    if (display.fromCache) const OfflineBanner(),
                    Expanded(
                      child: TabBarView(
                        controller: _tabCtrl,
                        children: [
                          // Tab 0: checklist stages with expandable items
                          _ChecklistTab(state: display),
                          // Tab 1: observations raised against this inspection
                          _ObservationsTab(
                            state: display,
                            highlightObservationId: widget.highlightObservationId,
                            initialObsAction: widget.initialObsAction,
                          ),
                          // Tab 2: drawings/supporting docs bound to this RFI
                          _AttachmentsTab(inspection: display.inspection),
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

          // No cached data available offline — show an error with retry.
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off, size: 48, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text(
                    'No cached data available.\nConnect to the internet and try again.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => context
                        .read<QualityApprovalBloc>()
                        .add(LoadInspectionDetail(widget.inspection)),
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry'),
                  ),
                ],
              ),
            ),
          );
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
    // Hide legacy timeline when the new stage-approval system is active
    // (any stage has stageApproval data). The old workflow run is not updated
    // by the approveStage endpoint and would show stale "Pending" state.
    final usesStageApproval =
        state.stages.any((s) => s.stageApproval != null);

    if (state.stages.isEmpty && !hasWorkflow) {
      return const Center(child: Text('No checklist stages defined'));
    }

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        // Pour Card / Pre-Pour Clearance quick-access panel
        if (state.inspection.requiresPourCard || state.inspection.requiresPourClearanceCard)
          _PourCardPanel(inspection: state.inspection),
        // Linked checklists — previously approved RFIs referenced by this inspection
        if (state.inspection.relatedChecklistInspectionIds.isNotEmpty)
          _LinkedChecklistsSection(inspection: state.inspection),
        // Workflow approval timeline shown only when NOT using stage-level approval
        if (hasWorkflow && !usesStageApproval) _WorkflowTimeline(workflow: state.workflow!),
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
// Pour Card / Pre-Pour Clearance Panel
// ---------------------------------------------------------------------------

/// Shows "Open Pour Card" and/or "Open Pre-Pour Clearance" buttons when the
/// inspection's activity requires them. Appears at the top of the checklist tab.
class _PourCardPanel extends StatelessWidget {
  final QualityInspection inspection;
  const _PourCardPanel({required this.inspection});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: Colors.blue.shade100),
        ),
        color: Colors.blue.shade50,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.water_drop_outlined, size: 14, color: Colors.blue.shade700),
                  const SizedBox(width: 6),
                  Text(
                    'Concrete Pour Documents',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.blue.shade800,
                    ),
                  ),
                  const Spacer(),
                  // GO label badge (e.g. "GO 1") — shown when goLabel or goNo is set
                  if (inspection.goLabel != null || inspection.goNo != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade700,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        inspection.goLabel ?? 'GO ${inspection.goNo}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                ],
              ),
              // GO details text
              if (inspection.goDetails != null && inspection.goDetails!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  inspection.goDetails!,
                  style: TextStyle(fontSize: 11, color: Colors.blue.shade700),
                ),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  if (inspection.requiresPourCard)
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PourCardPage(
                              inspectionId: inspection.id,
                              projectId: inspection.projectId,
                              activityName: inspection.activityName,
                              locationLabel: inspection.locationDisplay,
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.assignment_outlined, size: 14),
                        label: const Text('Pour Card'),
                        style: OutlinedButton.styleFrom(
                          textStyle: const TextStyle(fontSize: 12),
                          foregroundColor: Colors.blue.shade700,
                          side: BorderSide(color: Colors.blue.shade300),
                        ),
                      ),
                    ),
                  if (inspection.requiresPourCard && inspection.requiresPourClearanceCard)
                    const SizedBox(width: 8),
                  if (inspection.requiresPourClearanceCard)
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PrePourClearancePage(
                              inspectionId: inspection.id,
                              activityName: inspection.activityName,
                              locationLabel: inspection.locationDisplay,
                              projectId: inspection.projectId,
                              epsNodeId: inspection.epsNodeId,
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.checklist_outlined, size: 14),
                        label: const Text('Clearance'),
                        style: OutlinedButton.styleFrom(
                          textStyle: const TextStyle(fontSize: 12),
                          foregroundColor: Colors.teal.shade700,
                          side: BorderSide(color: Colors.teal.shade300),
                        ),
                      ),
                    ),
                ],
              ),
              // Cube Register — always shown for pour card activities (read-only link)
              if (inspection.requiresPourCard && inspection.projectId != null) ...[
                const SizedBox(height: 6),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => CubeRegisterPage(
                          projectId: inspection.projectId!,
                          projectName: inspection.locationDisplay,
                        ),
                      ),
                    ),
                    icon: const Icon(Icons.science_outlined, size: 14),
                    label: const Text('Cube Register'),
                    style: OutlinedButton.styleFrom(
                      textStyle: const TextStyle(fontSize: 12),
                      foregroundColor: Colors.deepPurple.shade700,
                      side: BorderSide(color: Colors.deepPurple.shade300),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Linked Checklists Section
// ---------------------------------------------------------------------------

/// Shows the list of previously approved RFIs linked to this inspection.
/// Each linked inspection is loaded lazily via a single floor-level API call
/// and displayed as a compact info card for the approver to verify.
class _LinkedChecklistsSection extends StatefulWidget {
  final QualityInspection inspection;
  const _LinkedChecklistsSection({required this.inspection});

  @override
  State<_LinkedChecklistsSection> createState() => _LinkedChecklistsSectionState();
}

class _LinkedChecklistsSectionState extends State<_LinkedChecklistsSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    // The detail response already embeds full summaries for every linked
    // id (see QualityInspection.relatedChecklistInspections) — no second
    // round-trip needed to render these cards.
    final linked = widget.inspection.relatedChecklistInspections;
    final count = widget.inspection.relatedChecklistInspectionIds.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: Colors.amber.shade200),
        ),
        color: Colors.amber.shade50,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Icon(Icons.link_rounded, size: 14, color: Colors.amber.shade800),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Linked Checklists ($count)',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ),
                    Icon(
                      _expanded ? Icons.expand_less : Icons.expand_more,
                      size: 18,
                      color: Colors.amber.shade800,
                    ),
                  ],
                ),
              ),
            ),
            if (_expanded) ...[
              const Divider(height: 1),
              if (linked.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    'No details available for linked RFIs.',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                )
              else
                ...linked.map((l) => _LinkedInspectionCard(linked: l)),
            ],
          ],
        ),
      ),
    );
  }
}

class _LinkedInspectionCard extends StatelessWidget {
  final RelatedChecklistSummary linked;
  const _LinkedInspectionCard({required this.linked});

  @override
  Widget build(BuildContext context) {
    final status = InspectionStatus.fromString(linked.status);
    return InkWell(
      onTap: () => LinkedRfiDetailSheet.show(context, linked.id),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    linked.activityName,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
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
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: status.color),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFF1D4ED8)),
              ],
            ),
            const SizedBox(height: 2),
            if (linked.goLabel != null || linked.goNo != null)
              Row(children: [
                Icon(Icons.water_drop_outlined, size: 11, color: Colors.blue.shade600),
                const SizedBox(width: 3),
                Text(linked.goLabel ?? 'GO ${linked.goNo}',
                    style: TextStyle(fontSize: 11, color: Colors.blue.shade700, fontWeight: FontWeight.w600)),
              ]),
            if (linked.goDetails != null && linked.goDetails!.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(linked.goDetails!, style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
            ],
            if (linked.elementName != null) ...[
              const SizedBox(height: 2),
              Row(children: [
                Icon(Icons.location_on_outlined, size: 11, color: Colors.grey.shade500),
                const SizedBox(width: 3),
                Expanded(child: Text(linked.elementName!,
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                    overflow: TextOverflow.ellipsis)),
              ]),
            ],
            if (linked.drawingNo != null) ...[
              const SizedBox(height: 2),
              Row(children: [
                Icon(Icons.description_outlined, size: 11, color: Colors.grey.shade500),
                const SizedBox(width: 3),
                Text(linked.drawingNo!,
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              ]),
            ],
            Text('RFI #${linked.id}  ·  ${linked.requestDate}',
                style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
            const Divider(height: 12),
          ],
        ),
      ),
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

  /// Opens the [SignatureApprovalSheet] to capture the approver's signature
  /// then dispatches [ApproveStage] for this stage.
  void _showStageApproveDialog(BuildContext context, InspectionStage stage) {
    SignatureApprovalSheet.showForStage(
      context,
      stageName: stage.stageName ?? 'Stage',
      pendingDisplay: stage.stageApproval?.pendingDisplay,
      onSubmit: (signatureData, signedBy, comments) {
        context.read<QualityApprovalBloc>().add(ApproveStage(
              stageId: stage.id,
              signatureData: signatureData,
              signedBy: signedBy,
              comments: comments,
            ));
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ps = PermissionService.of(context);
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
                  // (server-computed: is this the next stage in sequence)
                  // AND the user actually holds the approve permission —
                  // status alone isn't a permission check.
                  if (stage.canApprove && ps.canStageApprove) ...[
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
class _ObservationsTab extends StatefulWidget {
  final InspectionDetailLoaded state;
  final int? highlightObservationId;
  final String? initialObsAction;

  const _ObservationsTab({
    required this.state,
    this.highlightObservationId,
    this.initialObsAction,
  });

  @override
  State<_ObservationsTab> createState() => _ObservationsTabState();
}

class _ObservationsTabState extends State<_ObservationsTab> {
  final Map<String, GlobalKey> _obsKeys = {};
  bool _scrollTriggered = false;

  void _tryScrollToHighlight(List<ActivityObservation> obs) {
    if (widget.highlightObservationId == null || _scrollTriggered) return;
    final targetId = widget.highlightObservationId.toString();
    final target = obs.where((o) => o.id == targetId).firstOrNull;
    if (target == null) return;
    _scrollTriggered = true;
    final key = _obsKeys[targetId];
    if (key?.currentContext != null) {
      Scrollable.ensureVisible(
        key!.currentContext!,
        duration: const Duration(milliseconds: 400),
        alignment: 0.2,
      );
    }
    // Auto-open the rectification sheet for "rejected" notifications.
    if (widget.initialObsAction == 'rectify' && target.isPending) {
      final capturedContext = context;
      Future.delayed(const Duration(milliseconds: 600), () {
        if (!mounted) return;
        // ignore: use_build_context_synchronously
        RectifySheet.show(
          capturedContext,
          title: 'Fix Observation',
          onSubmit: ({required String notes, List<String> photoUrls = const []}) async {
            if (!mounted) return;
            context.read<QualityApprovalBloc>().add(SubmitRectification(
                  obsId: target.id,
                  closureText: notes,
                  closureEvidence: photoUrls,
                ));
          },
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final obs = widget.state.observations;
    final theme = Theme.of(context);
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
              // Raise new observation — only available with QUALITY.OBSERVATION.CREATE
              TextButton.icon(
                onPressed: ps.canCreateActivityObs
                    ? () => RaiseObservationSheet.show(context, stages: widget.state.stages)
                    : () => ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                                'Insufficient permission to raise observations.'),
                          ),
                        ),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Raise'),
                style: TextButton.styleFrom(
                  textStyle: const TextStyle(fontSize: 12),
                  foregroundColor:
                      ps.canCreateActivityObs ? null : Colors.grey,
                ),
              ),
            ],
          ),
        ),

        Expanded(
          child: RefreshIndicator(
            onRefresh: () async =>
                context.read<QualityApprovalBloc>().add(const RefreshInspectionDetail()),
            child: obs.isEmpty
              ? ListView(
                  children: [
                    SizedBox(
                      height: 200,
                      child: Center(
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
                            const SizedBox(height: 8),
                            Text('Pull down to refresh',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: theme.colorScheme.onSurface
                                        .withValues(alpha: 0.35))),
                          ],
                        ),
                      ),
                    ),
                  ],
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: obs.length,
                  itemBuilder: (context, i) {
                    final o = obs[i];
                    final cardKey = _obsKeys.putIfAbsent(o.id, GlobalKey.new);
                    // On the last item, attempt scroll-to-highlight once.
                    if (i == obs.length - 1) {
                      WidgetsBinding.instance.addPostFrameCallback(
                          (_) => _tryScrollToHighlight(obs));
                    }
                    return KeyedSubtree(
                      key: cardKey,
                      child: ObservationCard(
                      obs: o,
                      // Fix button shown only for PENDING observations AND
                      // when the user holds QUALITY.OBSERVATION.RESOLVE —
                      // status alone is not a permission check.
                      onRectify: o.isPending && ps.canResolveActivityObs
                          ? () => RectifySheet.show(
                                context,
                                title: 'Fix Observation',
                                onSubmit: ({required String notes, List<String> photoUrls = const []}) async {
                                  context.read<QualityApprovalBloc>().add(
                                        SubmitRectification(
                                          obsId: o.id,
                                          closureText: notes,
                                          closureEvidence: photoUrls,
                                        ),
                                      );
                                },
                              )
                          : null,
                      // Close button shown for RECTIFIED observations AND
                      // when the user holds QUALITY.OBSERVATION.CLOSE.
                      onClose: o.isRectified && ps.canCloseActivityObs
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
                    ));
                  },
                ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Attachments Tab
// ---------------------------------------------------------------------------

/// Drawings/supporting documents bound to this inspection. Unlike the
/// pre-creation [RfiAttachmentPicker] (drafts not yet bound to any RFI),
/// adds and deletes here go straight to the inspection via
/// [SetuApiClient.addInspectionAttachment]/[deleteInspectionAttachment].
/// Mutation controls are hidden per-attachment when [RfiAttachment.isLocked]
/// is true (e.g. the RFI has been approved).
class _AttachmentsTab extends StatefulWidget {
  final QualityInspection inspection;
  const _AttachmentsTab({required this.inspection});

  @override
  State<_AttachmentsTab> createState() => _AttachmentsTabState();
}

class _AttachmentsTabState extends State<_AttachmentsTab> {
  List<RfiAttachment>? _attachments;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _attachments = widget.inspection.attachments;
  }

  Future<void> _refresh() async {
    try {
      final raw = await sl<SetuApiClient>().getInspectionAttachments(widget.inspection.id);
      if (mounted) {
        setState(() => _attachments = raw.map(RfiAttachment.fromJson).toList());
      }
    } catch (_) {
      // Keep showing the last known list — this is a best-effort refresh.
    }
  }

  Future<void> _addAttachment() async {
    final attachments = _attachments ?? const [];
    if (attachments.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 5 attachments per RFI')),
      );
      return;
    }
    final source = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(ctx, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Photo Gallery'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
            ListTile(
              leading: const Icon(Icons.picture_as_pdf_outlined),
              title: const Text('Choose PDF'),
              onTap: () => Navigator.pop(ctx, 'pdf'),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    XFile? file;
    try {
      if (source == 'camera') {
        file = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 90);
      } else if (source == 'gallery') {
        file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90);
      } else {
        final result = await FilePicker.platform
            .pickFiles(type: FileType.custom, allowedExtensions: const ['pdf'], withData: false);
        if (result?.files.isNotEmpty == true && result!.files.first.path != null) {
          file = XFile(result.files.first.path!);
        }
      }
    } catch (_) {}
    if (file == null || !mounted) return;

    final isPdf = file.path.toLowerCase().endsWith('.pdf');
    var path = file.path;
    if (!isPdf) path = await PhotoCompressor.compress(path);

    final size = await File(path).length();
    if (size > 10 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('File exceeds 10 MB limit')));
      }
      return;
    }

    setState(() => _uploading = true);
    try {
      await sl<SetuApiClient>().addInspectionAttachment(
        inspectionId: widget.inspection.id,
        clientUploadId: const Uuid().v4(),
        attachmentType: 'SUPPORTING_DOCUMENT',
        originalFilePath: path,
      );
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _deleteAttachment(RfiAttachment a) async {
    try {
      await sl<SetuApiClient>()
          .deleteInspectionAttachment(inspectionId: widget.inspection.id, attachmentId: a.id);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $e'), backgroundColor: Colors.red.shade700),
        );
      }
    }
  }

  /// Re-opens an already-attached image in the annotation editor and
  /// replaces it in-place (upload the edited copy, then delete the old
  /// record) — only offered while the attachment is unlocked, i.e. before
  /// the RFI's first approval.
  Future<void> _editAttachment(RfiAttachment a) async {
    if (a.isPdf || a.isLocked) return;
    String? downloadPath;
    String? flattenedPath;
    String? compressedPath;
    try {
      final dir = await getTemporaryDirectory();
      downloadPath = p.join(
          dir.path, 'attach_edit_${DateTime.now().millisecondsSinceEpoch}.jpg');
      await sl<SetuApiClient>().downloadFile(a.previewUrl, downloadPath);

      if (!mounted) return;
      final result = await ImageAnnotationPage.show(context, downloadPath);
      if (result == null) return;
      flattenedPath = result.flattenedImagePath;
      compressedPath = await PhotoCompressor.compress(flattenedPath);

      setState(() => _uploading = true);
      await sl<SetuApiClient>().addInspectionAttachment(
        inspectionId: widget.inspection.id,
        clientUploadId: const Uuid().v4(),
        attachmentType: a.attachmentType,
        originalFilePath: compressedPath,
      );
      await sl<SetuApiClient>()
          .deleteInspectionAttachment(inspectionId: widget.inspection.id, attachmentId: a.id);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Edit failed: $e'), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (downloadPath != null) await PhotoCompressor.deleteTempFile(downloadPath);
      if (flattenedPath != null) await PhotoCompressor.deleteTempFile(flattenedPath);
      if (compressedPath != null) await PhotoCompressor.deleteTempFile(compressedPath);
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final attachments = _attachments ?? const [];
    final ps = PermissionService.of(context);
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Text('Attachments (${attachments.length}/5)',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              const Spacer(),
              if (ps.canRaiseRfi)
                _uploading
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : TextButton.icon(
                        onPressed: attachments.length >= 5 ? null : _addAttachment,
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add'),
                      ),
            ],
          ),
          const SizedBox(height: 12),
          if (attachments.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text('No attachments yet.',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ),
            )
          else
            AttachmentGrid(
              attachments: attachments,
              onDelete: ps.canRaiseRfi ? _deleteAttachment : null,
              onEdit: ps.canRaiseRfi ? _editAttachment : null,
            ),
        ],
      ),
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
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
            children: [
              // Reject button — requires QUALITY.INSPECTION.STAGE_APPROVE in
              // workflow mode (matches the backend guard on
              // POST :id/workflow/reject) or QUALITY.INSPECTION.APPROVE for
              // direct/non-workflow inspections (matches PATCH :id/status).
              // Hidden entirely (not just disabled) when the user lacks it,
              // rather than showing a button that the backend will refuse.
              if (isAssignedApprover &&
                  (useWorkflow ? ps.canStageApprove : ps.canApproveInspection))
                OutlinedButton.icon(
                  onPressed: () => useWorkflow
                      ? _showWorkflowRejectDialog(context)
                      : _showRejectDialog(context),
                  icon: const Icon(Icons.cancel_outlined, size: 16),
                  label: const Text('Reject'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red.shade700,
                    side: BorderSide(color: Colors.red.shade400),
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                ),
              // Delegate button — only shown in workflow mode with delegate permission
              if (useWorkflow && isAssignedApprover && ps.canDelegateInspection)
                OutlinedButton.icon(
                  onPressed: () => _showDelegateDialog(context, state.inspection.projectId),
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
                OutlinedButton.icon(
                  onPressed: () => _showReverseDialog(context),
                  icon: const Icon(Icons.undo_rounded, size: 16),
                  label: const Text('Reverse'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.deepOrange.shade700,
                    side: BorderSide(color: Colors.deepOrange.shade300),
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                ),
              // Overall workflow Approve button removed — per-stage "Approve Stage"
              // buttons handle each approval level; once all stages are approved
              // the inspection is considered fully approved without a separate
              // overall advance action.
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


  /// Shows a dialog with the list of eligible approvers loaded from the API,
  /// then dispatches [DelegateWorkflowStep] with the selected user's ID.
  void _showDelegateDialog(BuildContext context, int? projectId) {
    showDialog(
      context: context,
      builder: (ctx) => _DelegateDialog(
        projectId: projectId,
        onDelegate: (userId, comments) {
          context.read<QualityApprovalBloc>().add(DelegateWorkflowStep(
                toUserId: userId,
                comments: comments,
              ));
        },
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

// ---------------------------------------------------------------------------
// Delegate Dialog — loads eligible approvers from API and shows a picker
// ---------------------------------------------------------------------------

class _DelegateDialog extends StatefulWidget {
  final int? projectId;
  final void Function(int userId, String? comments) onDelegate;

  const _DelegateDialog({required this.projectId, required this.onDelegate});

  @override
  State<_DelegateDialog> createState() => _DelegateDialogState();
}

class _DelegateDialogState extends State<_DelegateDialog> {
  final _commentsCtrl = TextEditingController();
  List<Map<String, dynamic>> _users = [];
  Map<String, dynamic>? _selected;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _commentsCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (widget.projectId == null) {
      setState(() { _loading = false; _error = 'Project ID unavailable'; });
      return;
    }
    try {
      final users = await sl<SetuApiClient>().getEligibleApprovers(widget.projectId!);
      if (mounted) setState(() { _users = users; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = 'Could not load approvers'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Delegate Step'),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Text(_error!, style: TextStyle(color: Colors.red.shade700))
            else if (_users.isEmpty)
              const Text('No eligible approvers found for this project.',
                  style: TextStyle(fontSize: 13, color: Colors.grey))
            else
              DropdownButtonFormField<Map<String, dynamic>>(
                initialValue: _selected,
                isExpanded: true,
                hint: const Text('Select approver'),
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                items: _users.map((u) {
                  final name = u['displayName'] as String? ??
                      u['fullName'] as String? ?? 'User ${u['id']}';
                  final role = u['designation'] as String? ?? u['role'] as String?;
                  return DropdownMenuItem(
                    value: u,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(name, style: const TextStyle(fontSize: 13)),
                        if (role != null)
                          Text(role,
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                      ],
                    ),
                  );
                }).toList(),
                onChanged: (v) => setState(() => _selected = v),
              ),
            const SizedBox(height: 12),
            TextField(
              controller: _commentsCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Comments (optional)',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _selected == null ? null : () {
            final id = _selected!['id'] as int?;
            if (id == null) return;
            Navigator.pop(context);
            widget.onDelegate(
              id,
              _commentsCtrl.text.trim().isEmpty ? null : _commentsCtrl.text.trim(),
            );
          },
          style: FilledButton.styleFrom(backgroundColor: Colors.indigo.shade700),
          child: const Text('Delegate'),
        ),
      ],
    );
  }
}
