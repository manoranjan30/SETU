import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/widgets/offline_banner.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/inspection_detail_page.dart';
import 'package:setu_mobile/shared/widgets/paginated_list_view.dart';

class QualityApprovalsPage extends StatefulWidget {
  final int projectId;
  final String projectName;

  const QualityApprovalsPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  State<QualityApprovalsPage> createState() => _QualityApprovalsPageState();
}

class _QualityApprovalsPageState extends State<QualityApprovalsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  static const _tabKeys = [
    'MY_PENDING',
    'PENDING',
    'ALL',
    'APPROVED',
    'REJECTED',
    'DASHBOARD'
  ];
  static const _labels = [
    'My Pending',
    'All Pending',
    'All',
    'Approved',
    'Rejected',
    'Dashboard'
  ];

  final Map<String, List<QualityInspection>> _cacheByFilter = {
    'PENDING': const [],
    'ALL': const [],
    'APPROVED': const [],
    'REJECTED': const [],
  };

  List<QualityInspection> _myPendingInspections = const [];

  InspectionsLoaded? _lastInspections;
  String _selectedFloor = 'All Floors';
  bool _showOverdueOnly = false;
  String _selectedSlaBucket = 'All';
  String _selectedView = 'All Pending';

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabKeys.length, vsync: this);
    _tabCtrl.addListener(_onTabChanged);
    _loadMyPending();
    _loadInspections('PENDING');
    _loadInspections('ALL');
  }

  void _loadMyPending() {
    context.read<QualityApprovalBloc>().add(
          LoadMyPendingInspections(projectId: widget.projectId),
        );
  }

  @override
  void dispose() {
    _tabCtrl.removeListener(_onTabChanged);
    _tabCtrl.dispose();
    super.dispose();
  }

  void _loadInspections(String filter) {
    context.read<QualityApprovalBloc>().add(
          LoadInspections(projectId: widget.projectId, filter: filter),
        );
  }

  String _tabToFilter(String tabKey) {
    if (tabKey == 'DASHBOARD' || tabKey == 'MY_PENDING') return 'ALL';
    return tabKey;
  }

  void _onTabChanged() {
    if (_tabCtrl.indexIsChanging) return;
    final key = _tabKeys[_tabCtrl.index];
    if (key == 'MY_PENDING') {
      _loadMyPending();
    } else {
      _loadInspections(_tabToFilter(key));
    }
  }

  Future<void> _openDetail(
      QualityInspection inspection, String activeTab) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<QualityApprovalBloc>(),
          child: InspectionDetailPage(inspection: inspection),
        ),
      ),
    );

    if (!mounted) return;

    if (activeTab == 'MY_PENDING') {
      _loadMyPending();
      _loadInspections('PENDING');
    } else {
      final filter = _tabToFilter(activeTab);
      _loadInspections(filter);
      if (filter != 'ALL') _loadInspections('ALL');
    }
  }

  List<QualityInspection> _cached(String filter) =>
      _cacheByFilter[filter] ?? const [];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Quality Approvals',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.projectName, style: const TextStyle(fontSize: 12)),
          ],
        ),
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: _labels.map((e) => Tab(text: e)).toList(),
          isScrollable: true,
          tabAlignment: TabAlignment.start,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                _loadInspections(_tabToFilter(_tabKeys[_tabCtrl.index])),
          ),
        ],
      ),
      body: BlocConsumer<QualityApprovalBloc, QualityApprovalState>(
        listener: (context, state) {
          if (state is QualityApprovalError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                  content: Text(state.message),
                  backgroundColor: Colors.red.shade700),
            );
          }
          if (state is ApprovalActionQueued) {
            final label = {
                  'approve': 'Approved',
                  'provisional': 'Provisionally Approved',
                  'reject': 'Rejected',
                }[state.action] ??
                'Updated';
            final msg = state.isOffline
                ? '$label (queued - sync pending)'
                : '$label successfully';
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(msg),
                backgroundColor: state.isOffline
                    ? Colors.orange.shade700
                    : Colors.green.shade700,
              ),
            );
            _loadInspections(_tabToFilter(_tabKeys[_tabCtrl.index]));
            _loadInspections('ALL');
          }
        },
        builder: (context, state) {
          if (state is InspectionsLoaded) {
            _lastInspections = state;
            _cacheByFilter[state.activeFilter] = state.inspections;
          }
          if (state is MyPendingInspectionsLoaded) {
            _myPendingInspections = state.inspections;
          }

          final loading = state is QualityApprovalLoading;
          final activeFilter = _tabToFilter(_tabKeys[_tabCtrl.index]);
          final hasData =
              _cached(activeFilter).isNotEmpty || _cached('ALL').isNotEmpty;

          if (loading && _lastInspections == null && !hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final isFromCache =
              state is InspectionsLoaded && state.fromCache;

          return Stack(
            children: [
              if (isFromCache)
                const Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: OfflineBanner(),
                ),
              TabBarView(
                controller: _tabCtrl,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _InspectionList(
                    title: 'My Pending Approvals',
                    inspections: _myPendingInspections,
                    onRefresh: _loadMyPending,
                    onInspectionTap: (x) => _openDetail(x, 'MY_PENDING'),
                  ),
                  _InspectionList(
                    title: 'All Pending Approvals',
                    inspections: _cached('PENDING'),
                    onRefresh: () => _loadInspections('PENDING'),
                    onInspectionTap: (x) => _openDetail(x, 'PENDING'),
                  ),
                  _InspectionList(
                    title: 'All RFIs',
                    inspections: _cached('ALL'),
                    onRefresh: () => _loadInspections('ALL'),
                    onInspectionTap: (x) => _openDetail(x, 'ALL'),
                  ),
                  _InspectionList(
                    title: 'Approved RFIs',
                    inspections: _cached('APPROVED'),
                    onRefresh: () => _loadInspections('APPROVED'),
                    onInspectionTap: (x) => _openDetail(x, 'APPROVED'),
                  ),
                  _InspectionList(
                    title: 'Rejected RFIs',
                    inspections: _cached('REJECTED'),
                    onRefresh: () => _loadInspections('REJECTED'),
                    onInspectionTap: (x) => _openDetail(x, 'REJECTED'),
                  ),
                  _ApprovalDashboard(
                    inspections: _cached('ALL'),
                    selectedFloor: _selectedFloor,
                    showOverdueOnly: _showOverdueOnly,
                    selectedSlaBucket: _selectedSlaBucket,
                    selectedView: _selectedView,
                    onSelectedFloorChanged: (v) =>
                        setState(() => _selectedFloor = v),
                    onShowOverdueOnlyChanged: (v) =>
                        setState(() => _showOverdueOnly = v),
                    onSelectedSlaBucketChanged: (v) =>
                        setState(() => _selectedSlaBucket = v),
                    onSelectedViewChanged: (v) =>
                        setState(() => _selectedView = v),
                    onInspectionTap: (x) => _openDetail(x, 'DASHBOARD'),
                    onRefresh: () => _loadInspections('ALL'),
                  ),
                ],
              ),
              if (loading)
                const Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: LinearProgressIndicator(minHeight: 2)),
            ],
          );
        },
      ),
    );
  }
}

class _InspectionList extends StatefulWidget {
  final String title;
  final List<QualityInspection> inspections;
  final VoidCallback onRefresh;
  final void Function(QualityInspection) onInspectionTap;

  const _InspectionList({
    required this.title,
    required this.inspections,
    required this.onRefresh,
    required this.onInspectionTap,
  });

  @override
  State<_InspectionList> createState() => _InspectionListState();
}

class _InspectionListState extends State<_InspectionList> {
  String _floorFilter = '';
  String _goFilter = '';
  String _sortBy = 'newest';

  List<QualityInspection> get _filtered {
    var list = widget.inspections;

    if (_floorFilter.isNotEmpty) {
      final q = _floorFilter.toLowerCase();
      list = list.where((i) =>
          (i.floorName?.toLowerCase().contains(q) ?? false) ||
          i.locationDisplay.toLowerCase().contains(q)).toList();
    }
    if (_goFilter.isNotEmpty) {
      final q = _goFilter.toLowerCase();
      list = list.where((i) =>
          (i.goLabel?.toLowerCase().contains(q) ?? false) ||
          (i.goNo?.toString() == _goFilter)).toList();
    }

    final sorted = List<QualityInspection>.from(list);
    switch (_sortBy) {
      case 'oldest':
        sorted.sort((a, b) => a.requestDate.compareTo(b.requestDate));
      case 'overdue':
        sorted.sort((a, b) {
          final aDate = a.slaDueAt ?? DateTime(9999);
          final bDate = b.slaDueAt ?? DateTime(9999);
          return aDate.compareTo(bDate); // earliest due first = most overdue
        });
      case 'obs':
        sorted.sort((a, b) => b.pendingObservationCount.compareTo(a.pendingObservationCount));
      default: // newest
        sorted.sort((a, b) => b.requestDate.compareTo(a.requestDate));
    }
    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    final list = _filtered;
    final all = widget.inspections;
    final pending = all.where(_isPendingStatus).length;
    final approved = all
        .where((i) =>
            i.status == InspectionStatus.approved ||
            i.status == InspectionStatus.provisionallyApproved)
        .length;
    final rejected =
        all.where((i) => i.status == InspectionStatus.rejected).length;

    return Column(
      children: [
        // ── Filter & sort bar ──────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Floor…',
                    prefixIcon: const Icon(Icons.search, size: 16),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                    border: const OutlineInputBorder(),
                    filled: true,
                    fillColor: Theme.of(context).colorScheme.surface,
                  ),
                  onChanged: (v) => setState(() => _floorFilter = v),
                ),
              ),
              const SizedBox(width: 6),
              SizedBox(
                width: 70,
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'GO',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                    border: const OutlineInputBorder(),
                    filled: true,
                    fillColor: Theme.of(context).colorScheme.surface,
                  ),
                  onChanged: (v) => setState(() => _goFilter = v),
                ),
              ),
              PopupMenuButton<String>(
                icon: Icon(
                  Icons.sort,
                  size: 20,
                  color: _sortBy == 'newest' ? null : Theme.of(context).colorScheme.primary,
                ),
                tooltip: 'Sort',
                onSelected: (v) => setState(() => _sortBy = v),
                itemBuilder: (_) => [
                  _sortMenuItem('newest', 'Newest First', _sortBy),
                  _sortMenuItem('oldest', 'Oldest First', _sortBy),
                  _sortMenuItem('overdue', 'Most Overdue First', _sortBy),
                  _sortMenuItem('obs', 'Most Open Observations', _sortBy),
                ],
              ),
            ],
          ),
        ),
        // ── List ────────────────────────────────────────────────────
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async => widget.onRefresh(),
            child: list.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 180),
                    Center(
                      child: Text(_floorFilter.isNotEmpty || _goFilter.isNotEmpty
                          ? 'No inspections match your filter'
                          : 'No inspections found'),
                    ),
                  ])
                : Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
                        child: Card(
                          elevation: 0,
                          color: Theme.of(context)
                              .colorScheme
                              .surfaceContainerHighest
                              .withValues(alpha: 0.4),
                          child: ListTile(
                            dense: true,
                            title: Text(widget.title),
                            subtitle: Text(
                                'Showing ${list.length}/${all.length}  Pending $pending  Approved $approved  Rejected $rejected'),
                          ),
                        ),
                      ),
                      Expanded(
                        child: PaginatedListView<QualityInspection>(
                          items: list,
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                          separatorBuilder: (_) => const SizedBox(height: 8),
                          itemBuilder: (context, inspection, __) => _InspectionCard(
                              inspection: inspection,
                              onTap: () => widget.onInspectionTap(inspection)),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  PopupMenuItem<String> _sortMenuItem(String value, String label, String current) =>
      PopupMenuItem<String>(
        value: value,
        child: Row(children: [
          if (current == value)
            const Icon(Icons.check, size: 16)
          else
            const SizedBox(width: 16),
          const SizedBox(width: 8),
          Text(label),
        ]),
      );
}

class _InspectionCard extends StatelessWidget {
  final QualityInspection inspection;
  final VoidCallback onTap;

  const _InspectionCard({required this.inspection, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = _statusVisual(inspection.status);
    final progress = inspection.totalStages == 0
        ? 0.0
        : inspection.completedStages / math.max(inspection.totalStages, 1);
    final age = _ageLabel(inspection.requestDateTime);
    final overdue = _isOverdue(inspection);

    final goText = [
      if (inspection.goLabel?.isNotEmpty ?? false) inspection.goLabel,
      if (inspection.goDetails?.isNotEmpty ?? false) inspection.goDetails,
    ].join(' — ');

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Theme.of(context).dividerColor),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(
                  'RFI #${inspection.id} · ${inspection.activityName ?? 'Inspection'}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .bodyLarge
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 8),
              Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(status.icon, size: 14, color: status.color),
                const SizedBox(width: 3),
                Text(status.label,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: status.color)),
              ]),
            ]),
            _detailRow(
              context,
              Icons.location_on_outlined,
              inspection.locationHierarchy.isEmpty
                  ? 'Location unavailable'
                  : inspection.locationHierarchy.join(' > '),
            ),
            if (inspection.elementName?.isNotEmpty ?? false)
              _detailRow(context, Icons.category_outlined,
                  'Element: ${inspection.elementName}'),
            if (inspection.drawingNo?.isNotEmpty ?? false)
              _detailRow(context, Icons.architecture_outlined,
                  'Drawing: ${inspection.drawingNo}'),
            if (goText.isNotEmpty)
              _detailRow(context, Icons.water_drop_outlined, 'GO: $goText'),
            if (inspection.isMultiPart)
              _detailRow(context, Icons.layers_outlined,
                  'Checklist: ${inspection.partDisplay}'),
            _detailRow(context, Icons.person_outline,
                inspection.inspectedBy ?? 'Pending inspector'),
            if (inspection.requestDate.isNotEmpty)
              _detailRow(context, Icons.calendar_today_outlined,
                  'Raised ${inspection.requestDate}'),
            _ApprovalLevelsRow(inspection: inspection),
            if (age != null)
              _detailRow(
                context,
                overdue ? Icons.warning_amber_rounded : Icons.timer_outlined,
                overdue ? 'Overdue $age' : 'Age $age',
                color: overdue ? Colors.red.shade700 : null,
              ),
            if (inspection.pendingObservationCount > 0)
              _detailRow(context, Icons.report_problem_outlined,
                  '${inspection.pendingObservationCount} open observation(s)',
                  color: Colors.red.shade700),
            if (inspection.totalStages > 0) ...[
              const SizedBox(height: 8),
              LinearProgressIndicator(value: progress, minHeight: 5),
              const SizedBox(height: 4),
              Text(
                  '${inspection.completedStages}/${inspection.totalStages} stages completed',
                  style: Theme.of(context).textTheme.bodySmall),
            ],
            // Pour card / clearance status indicators
            if (inspection.requiresPourCard || inspection.requiresPourClearanceCard) ...[
              const SizedBox(height: 6),
              if (inspection.requiresPourCard)
                _detailRow(
                  context,
                  Icons.description_outlined,
                  'Pour Card: ${_cardStatusText(inspection.pourCardStatus, inspection.pourCardApproved)}',
                  color: _cardStatusColor(inspection.pourCardStatus, inspection.pourCardApproved),
                ),
              if (inspection.requiresPourClearanceCard)
                _detailRow(
                  context,
                  Icons.fact_check_outlined,
                  'Clearance: ${_cardStatusText(inspection.prePourClearanceStatus, inspection.prePourClearanceApproved)}',
                  color: _cardStatusColor(
                      inspection.prePourClearanceStatus, inspection.prePourClearanceApproved),
                ),
            ],
          ]),
        ),
      ),
    );
  }

  Widget _detailRow(BuildContext context, IconData icon, String text,
      {Color? color}) {
    final c = color ??
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7);
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 13, color: c),
          const SizedBox(width: 6),
          Expanded(
            child: Text(text, style: TextStyle(fontSize: 12, color: c)),
          ),
        ],
      ),
    );
  }

  String _cardStatusText(String? status, bool approved) {
    if (approved) return 'Approved';
    if (status == null || status == 'DRAFT') return 'Draft';
    if (status == 'SUBMITTED') return 'Pending';
    if (status == 'REJECTED') return 'Rejected';
    return status;
  }

  Color _cardStatusColor(String? status, bool approved) {
    if (approved) return Colors.green.shade700;
    if (status == null || status == 'DRAFT') return Colors.grey.shade600;
    if (status == 'SUBMITTED') return Colors.orange.shade700;
    if (status == 'REJECTED') return Colors.red.shade700;
    return Colors.blue.shade700;
  }
}

/// Compact one-line row showing approval level progress.
///
/// Priority: stage-level approval dots (most detailed) → workflow-level
/// pipeline → text-only fallback. The row is the same height as a
/// [_InspectionCard._detailRow] so it never expands the card.
class _ApprovalLevelsRow extends StatelessWidget {
  final QualityInspection inspection;
  const _ApprovalLevelsRow({required this.inspection});

  @override
  Widget build(BuildContext context) {
    // New stage-based approval: each stage has per-level data
    final stagesWithApproval =
        inspection.stages.where((s) => s.stageApproval != null).toList();
    if (stagesWithApproval.isNotEmpty) {
      return _fromStages(context, stagesWithApproval);
    }

    // Old workflow run: use workflowCurrentLevel / workflowTotalLevels
    final current = inspection.workflowCurrentLevel;
    final total = inspection.workflowTotalLevels;
    if (current != null && total != null && total > 0) {
      return _workflowPipeline(context, current, total);
    }

    // Plain text fallback (pendingApprovalDisplay / Label)
    final text =
        inspection.pendingApprovalDisplay ?? inspection.pendingApprovalLabel;
    if (text != null) {
      return Padding(
        padding: const EdgeInsets.only(top: 5),
        child: Row(children: [
          Icon(Icons.pending_actions_outlined,
              size: 13, color: Colors.blue.shade700),
          const SizedBox(width: 6),
          Expanded(
            child: Text(text,
                style: TextStyle(fontSize: 12, color: Colors.blue.shade700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ),
        ]),
      );
    }
    return const SizedBox.shrink();
  }

  // ── Old-system: single linear pipeline of N level dots ───────────────────

  Widget _workflowPipeline(BuildContext context, int current, int total) {
    final dots = <Widget>[];
    for (int i = 1; i <= total; i++) {
      final approved = i < current;
      final pending = i == current;
      if (i > 1) {
        dots.add(Container(
          width: 6,
          height: 1.5,
          color: approved ? Colors.green.shade300 : Colors.grey.shade300,
        ));
      }
      dots.add(Tooltip(
        message: approved
            ? 'L$i — Approved'
            : pending
                ? 'L$i — Pending'
                : 'L$i — Waiting',
        child: Icon(
          approved ? Icons.circle : Icons.circle_outlined,
          size: 8,
          color: approved
              ? Colors.green.shade600
              : pending
                  ? Colors.orange.shade700
                  : Colors.grey.shade400,
        ),
      ));
    }

    final role = _extractRole(inspection.pendingApprovalDisplay);

    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(Icons.pending_actions_outlined,
              size: 13, color: Colors.blue.shade600),
          const SizedBox(width: 6),
          ...dots,
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              role != null ? 'L$current · $role' : 'L$current of $total',
              style: TextStyle(fontSize: 11, color: Colors.orange.shade700),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  // ── New stage-based system: per-stage dot clusters ────────────────────────

  Widget _fromStages(BuildContext context, List<InspectionStage> stages) {
    final clusters = <Widget>[];
    for (int si = 0; si < stages.length; si++) {
      final stage = stages[si];
      final approval = stage.stageApproval!;
      final total = approval.requiredLevelCount;
      final approvedCount = approval.approvedLevelCount;

      if (si > 0) clusters.add(const SizedBox(width: 5));

      final levelDots = <Widget>[];
      for (int li = 0; li < total; li++) {
        final isApproved = li < approvedCount;
        final isPending = li == approvedCount && !approval.fullyApproved;
        if (li > 0) {
          levelDots.add(Container(
            width: 3,
            height: 1.5,
            color:
                isApproved ? Colors.green.shade300 : Colors.grey.shade300,
          ));
        }
        levelDots.add(Icon(
          isApproved ? Icons.circle : Icons.circle_outlined,
          size: 7,
          color: isApproved
              ? Colors.green.shade600
              : isPending
                  ? Colors.orange.shade700
                  : Colors.grey.shade400,
        ));
      }

      clusters.add(Tooltip(
        message:
            '${stage.stageName ?? "Stage ${si + 1}"}: $approvedCount/$total approved',
        child: Row(mainAxisSize: MainAxisSize.min, children: levelDots),
      ));
    }

    final label = inspection.pendingApprovalLabel ??
        _extractRole(inspection.pendingApprovalDisplay);

    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(Icons.pending_actions_outlined,
              size: 13, color: Colors.blue.shade600),
          const SizedBox(width: 6),
          ...clusters,
          if (label != null) ...[
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                style: TextStyle(fontSize: 11, color: Colors.orange.shade700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // Extracts the approver role from strings like
  // "Stage Pre-Execution - Level 2 Pending: QC Engineer" → "QC Engineer"
  String? _extractRole(String? display) {
    if (display == null) return null;
    final colonIdx = display.lastIndexOf(':');
    if (colonIdx >= 0 && colonIdx < display.length - 1) {
      return display.substring(colonIdx + 1).trim();
    }
    return null;
  }
}

class _MiniChip extends StatelessWidget {
  final String text;
  final IconData icon;
  final Color? color;

  const _MiniChip({required this.text, required this.icon, this.color});

  @override
  Widget build(BuildContext context) {
    final chipColor = color ??
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.75);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: chipColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: chipColor),
        const SizedBox(width: 4),
        Text(text,
            style: Theme.of(context)
                .textTheme
                .labelSmall
                ?.copyWith(color: chipColor)),
      ]),
    );
  }
}


class _ApprovalDashboard extends StatelessWidget {
  final List<QualityInspection> inspections;
  final String selectedFloor;
  final bool showOverdueOnly;
  final String selectedSlaBucket;
  final String selectedView;
  final ValueChanged<String> onSelectedFloorChanged;
  final ValueChanged<bool> onShowOverdueOnlyChanged;
  final ValueChanged<String> onSelectedSlaBucketChanged;
  final ValueChanged<String> onSelectedViewChanged;
  final void Function(QualityInspection) onInspectionTap;
  final VoidCallback onRefresh;

  const _ApprovalDashboard({
    required this.inspections,
    required this.selectedFloor,
    required this.showOverdueOnly,
    required this.selectedSlaBucket,
    required this.selectedView,
    required this.onSelectedFloorChanged,
    required this.onShowOverdueOnlyChanged,
    required this.onSelectedSlaBucketChanged,
    required this.onSelectedViewChanged,
    required this.onInspectionTap,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final pending = inspections.where(_isPendingStatus).toList();
    final approved = inspections
        .where((i) =>
            i.status == InspectionStatus.approved ||
            i.status == InspectionStatus.provisionallyApproved)
        .toList();
    final rejected = inspections
        .where((i) => i.status == InspectionStatus.rejected)
        .toList();

    final floorGroups = <String, List<QualityInspection>>{};
    for (final i in inspections) {
      final floor = i.primaryFloorLabel ?? 'Unmapped';
      floorGroups.putIfAbsent(floor, () => []).add(i);
    }

    var queue = pending;
    switch (selectedView) {
      case 'Overdue Focus':
        queue = queue.where(_isOverdue).toList();
      case 'High Risk':
        queue = queue.where((i) => _priorityScore(i) >= 140).toList();
      case 'Ready For Closeout':
        queue = queue
            .where((i) =>
                i.totalStages > 0 &&
                i.completedStages == i.totalStages &&
                i.pendingObservationCount == 0)
            .toList();
      case 'All Pending':
      default:
        break;
    }
    if (selectedFloor != 'All Floors') {
      queue = queue
          .where((i) => (i.primaryFloorLabel ?? 'Unmapped') == selectedFloor)
          .toList();
    }
    if (selectedSlaBucket != 'All') {
      queue = queue.where((i) => _slaBucket(i) == selectedSlaBucket).toList();
    }
    if (showOverdueOnly) {
      queue = queue.where(_isOverdue).toList();
    }
    queue.sort((a, b) => _priorityScore(b).compareTo(_priorityScore(a)));

    final floors = floorGroups.keys.toList()..sort();
    final missingLocation =
        inspections.where((i) => i.locationHierarchy.isEmpty).length;
    final missingStages = inspections.where((i) => i.totalStages == 0).length;
    final unknownWorkflow =
        inspections.where((i) => i.workflowTotalLevels == null).length;

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: inspections.isEmpty
          ? ListView(children: const [
              SizedBox(height: 180),
              Center(child: Text('No inspections available for dashboard'))
            ])
          : ListView(
              padding: const EdgeInsets.all(12),
              children: [
                _DashboardKpis(
                  total: inspections.length,
                  pending: pending.length,
                  approved: approved.length,
                  rejected: rejected.length,
                  floorsPending: floorGroups.entries
                      .where((e) => e.value.any(_isPendingStatus))
                      .length,
                  floorsCompleted: floorGroups.entries
                      .where((e) =>
                          e.value.isNotEmpty &&
                          e.value.every((x) =>
                              x.status == InspectionStatus.approved ||
                              x.status ==
                                  InspectionStatus.provisionallyApproved))
                      .length,
                ),
                const SizedBox(height: 8),
                Card(
                  elevation: 0,
                  color: Theme.of(context)
                      .colorScheme
                      .surfaceContainerHighest
                      .withValues(alpha: 0.35),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            'All Pending',
                            'Overdue Focus',
                            'High Risk',
                            'Ready For Closeout'
                          ]
                              .map(
                                (view) => ChoiceChip(
                                  label: Text(view),
                                  selected: selectedView == view,
                                  onSelected: (_) =>
                                      onSelectedViewChanged(view),
                                ),
                              )
                              .toList(),
                        ),
                        const SizedBox(height: 10),
                        Row(children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: selectedFloor,
                              decoration: const InputDecoration(
                                  labelText: 'Floor',
                                  border: OutlineInputBorder(),
                                  isDense: true),
                              items: [
                                const DropdownMenuItem(
                                    value: 'All Floors',
                                    child: Text('All Floors')),
                                ...floors.map((f) =>
                                    DropdownMenuItem(value: f, child: Text(f))),
                              ],
                              onChanged: (v) {
                                if (v != null) {
                                  onSelectedFloorChanged(v);
                                }
                              },
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: selectedSlaBucket,
                              decoration: const InputDecoration(
                                  labelText: 'SLA Bucket',
                                  border: OutlineInputBorder(),
                                  isDense: true),
                              items: const [
                                DropdownMenuItem(
                                    value: 'All', child: Text('All')),
                                DropdownMenuItem(
                                    value: 'Overdue', child: Text('Overdue')),
                                DropdownMenuItem(
                                    value: 'Due <24h', child: Text('Due <24h')),
                                DropdownMenuItem(
                                    value: 'Due 24-48h',
                                    child: Text('Due 24-48h')),
                                DropdownMenuItem(
                                    value: 'Upcoming',
                                    child: Text('Upcoming >48h')),
                              ],
                              onChanged: (v) {
                                if (v != null) {
                                  onSelectedSlaBucketChanged(v);
                                }
                              },
                            ),
                          ),
                        ]),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            FilterChip(
                              selected: showOverdueOnly,
                              label: const Text('Overdue only'),
                              onSelected: onShowOverdueOnlyChanged,
                            ),
                            const SizedBox(width: 8),
                            Text('View: $selectedView'),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                if (missingLocation > 0 ||
                    missingStages > 0 ||
                    unknownWorkflow > 0)
                  Card(
                    elevation: 0,
                    color: Colors.amber.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Data Quality Alerts',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w700)),
                          const SizedBox(height: 6),
                          Text('Missing location hierarchy: $missingLocation'),
                          Text('No checklist stages: $missingStages'),
                          Text('Unknown workflow levels: $unknownWorkflow'),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                Text('Floor Status Board',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                _FloorStatusGrid(groups: floorGroups),
                const SizedBox(height: 12),
                Text('Floor Completion Insight',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                _FloorCompletionInsight(groups: floorGroups),
                const SizedBox(height: 12),
                Text('Priority Pending Queue',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _MiniChip(
                        text:
                            'Overdue ${queue.where((i) => _slaBucket(i) == 'Overdue').length}',
                        icon: Icons.warning_amber_rounded,
                        color: Colors.red.shade700),
                    _MiniChip(
                        text:
                            'Due <24h ${queue.where((i) => _slaBucket(i) == 'Due <24h').length}',
                        icon: Icons.schedule,
                        color: Colors.orange.shade700),
                    _MiniChip(
                        text:
                            'Due 24-48h ${queue.where((i) => _slaBucket(i) == 'Due 24-48h').length}',
                        icon: Icons.schedule_send,
                        color: Colors.blue.shade700),
                    _MiniChip(
                        text:
                            'Upcoming ${queue.where((i) => _slaBucket(i) == 'Upcoming').length}',
                        icon: Icons.update,
                        color: Colors.green.shade700),
                  ],
                ),
                const SizedBox(height: 6),
                if (queue.isEmpty)
                  const Card(
                      child: Padding(
                          padding: EdgeInsets.all(12),
                          child: Text(
                              'No pending inspections for current filters')))
                else
                  ...queue.take(20).map((x) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _InspectionCard(
                            inspection: x, onTap: () => onInspectionTap(x)),
                      )),
                const SizedBox(height: 12),
                Text('Recently Approved',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                _ApprovedTimeline(
                    inspections: approved, onInspectionTap: onInspectionTap),
              ],
            ),
    );
  }
}

class _DashboardKpis extends StatelessWidget {
  final int total;
  final int pending;
  final int approved;
  final int rejected;
  final int floorsPending;
  final int floorsCompleted;

  const _DashboardKpis({
    required this.total,
    required this.pending,
    required this.approved,
    required this.rejected,
    required this.floorsPending,
    required this.floorsCompleted,
  });

  @override
  Widget build(BuildContext context) {
    Widget chip(String label, int value, Color color) {
      return Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$value',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(color: color, fontWeight: FontWeight.w700)),
            Text(label, style: Theme.of(context).textTheme.labelSmall),
          ],
        ),
      );
    }

    return SizedBox(
      height: 86,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          chip('Total RFIs', total, Colors.indigo),
          chip('Pending', pending, Colors.orange.shade700),
          chip('Approved', approved, Colors.green.shade700),
          chip('Rejected', rejected, Colors.red.shade700),
          chip('Floors Pending', floorsPending, Colors.deepOrange),
          chip('Floors Completed', floorsCompleted, Colors.teal),
        ],
      ),
    );
  }
}

class _FloorStatusGrid extends StatelessWidget {
  final Map<String, List<QualityInspection>> groups;

  const _FloorStatusGrid({required this.groups});

  @override
  Widget build(BuildContext context) {
    final keys = groups.keys.toList()..sort();
    if (keys.isEmpty) {
      return const Card(
          child: Padding(
              padding: EdgeInsets.all(12), child: Text('No floor groups')));
    }

    return LayoutBuilder(
      builder: (context, c) {
        final count = c.maxWidth > 900 ? 4 : (c.maxWidth > 700 ? 3 : 2);
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: keys.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: count,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
              childAspectRatio: 1.45),
          itemBuilder: (context, i) {
            final floor = keys[i];
            final rows = groups[floor] ?? const [];
            final p = rows.where(_isPendingStatus).length;
            final a = rows
                .where((x) =>
                    x.status == InspectionStatus.approved ||
                    x.status == InspectionStatus.provisionallyApproved)
                .length;
            final r =
                rows.where((x) => x.status == InspectionStatus.rejected).length;
            final accent = p > 0
                ? Colors.orange.shade700
                : (r > 0 ? Colors.red.shade700 : Colors.green.shade700);
            return Card(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: accent.withValues(alpha: 0.35))),
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(floor,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      const Spacer(),
                      Text('Pending: $p',
                          style: Theme.of(context).textTheme.bodySmall),
                      Text('Approved: $a',
                          style: Theme.of(context).textTheme.bodySmall),
                      Text('Rejected: $r',
                          style: Theme.of(context).textTheme.bodySmall),
                    ]),
              ),
            );
          },
        );
      },
    );
  }
}

class _FloorCompletionInsight extends StatelessWidget {
  final Map<String, List<QualityInspection>> groups;

  const _FloorCompletionInsight({required this.groups});

  @override
  Widget build(BuildContext context) {
    final floors = groups.keys.toList()..sort();
    if (floors.isEmpty) {
      return const Card(
          child: Padding(
              padding: EdgeInsets.all(12),
              child: Text('No floor progress data')));
    }

    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: math.min(floors.length, 12),
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final floor = floors[i];
          final rows = groups[floor] ?? const [];
          final approvedCount = rows
              .where((x) =>
                  x.status == InspectionStatus.approved ||
                  x.status == InspectionStatus.provisionallyApproved)
              .length;
          final pct = rows.isEmpty ? 0.0 : approvedCount / rows.length;

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                    child: Text(floor,
                        style: Theme.of(context).textTheme.bodyMedium)),
                Text('$approvedCount/${rows.length}',
                    style: Theme.of(context).textTheme.labelSmall),
              ]),
              const SizedBox(height: 6),
              LinearProgressIndicator(value: pct, minHeight: 5),
            ]),
          );
        },
      ),
    );
  }
}

class _ApprovedTimeline extends StatelessWidget {
  final List<QualityInspection> inspections;
  final void Function(QualityInspection) onInspectionTap;

  const _ApprovedTimeline(
      {required this.inspections, required this.onInspectionTap});

  @override
  Widget build(BuildContext context) {
    if (inspections.isEmpty) {
      return const Card(
          child: Padding(
              padding: EdgeInsets.all(12),
              child: Text('No approved RFIs yet')));
    }
    final sorted = [...inspections]..sort((a, b) =>
        (b.requestDateTime ?? DateTime.fromMillisecondsSinceEpoch(0)).compareTo(
            a.requestDateTime ?? DateTime.fromMillisecondsSinceEpoch(0)));

    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: math.min(sorted.length, 10),
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final row = sorted[i];
          return ListTile(
            dense: true,
            leading: Icon(Icons.check_circle,
                color: Colors.green.shade700, size: 18),
            title: Text(row.activityName ?? 'Inspection #${row.id}',
                maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text(row.locationDisplay,
                maxLines: 1, overflow: TextOverflow.ellipsis),
            trailing: Text(row.requestDate,
                style: Theme.of(context).textTheme.bodySmall),
            onTap: () => onInspectionTap(row),
          );
        },
      ),
    );
  }
}

class _StatusVisual {
  final String label;
  final Color color;
  final IconData icon;

  const _StatusVisual(
      {required this.label, required this.color, required this.icon});
}

_StatusVisual _statusVisual(InspectionStatus status) {
  switch (status) {
    case InspectionStatus.approved:
      return _StatusVisual(
          label: 'Approved',
          color: Colors.green.shade700,
          icon: Icons.verified_outlined);
    case InspectionStatus.provisionallyApproved:
      return _StatusVisual(
          label: 'Prov. Approved',
          color: Colors.teal.shade700,
          icon: Icons.check_circle_outline);
    case InspectionStatus.rejected:
      return _StatusVisual(
          label: 'Rejected',
          color: Colors.red.shade700,
          icon: Icons.cancel_outlined);
    case InspectionStatus.partiallyApproved:
      return _StatusVisual(
          label: 'Partial',
          color: Colors.blue.shade700,
          icon: Icons.timelapse_outlined);
    case InspectionStatus.pending:
    default:
      return _StatusVisual(
          label: 'Pending',
          color: Colors.orange.shade700,
          icon: Icons.pending_outlined);
  }
}

bool _isPendingStatus(QualityInspection i) {
  return i.status == InspectionStatus.pending ||
      i.status == InspectionStatus.partiallyApproved ||
      // Reversed inspections are reopened for first-level approval again —
      // treat them as pending for the dashboard's queue/counts.
      i.status == InspectionStatus.reversed;
}

String? _ageLabel(DateTime? requestDate) {
  if (requestDate == null) return null;
  final diff = DateTime.now().difference(requestDate.toLocal());
  if (diff.isNegative) return '0h';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays < 30) return '${diff.inDays}d';
  return '${(diff.inDays / 30).floor()}mo';
}

bool _isOverdue(QualityInspection inspection) {
  if (!_isPendingStatus(inspection)) return false;
  if (inspection.slaDueAt != null) {
    return DateTime.now().isAfter(inspection.slaDueAt!.toLocal());
  }
  if (inspection.requestDateTime == null) return false;
  return DateTime.now()
          .difference(inspection.requestDateTime!.toLocal())
          .inHours >
      48;
}

String _slaBucket(QualityInspection inspection) {
  if (!_isPendingStatus(inspection)) return 'Completed';
  if (_isOverdue(inspection)) return 'Overdue';

  final now = DateTime.now();
  if (inspection.slaDueAt != null) {
    final hrs = inspection.slaDueAt!.toLocal().difference(now).inHours;
    if (hrs < 24) return 'Due <24h';
    if (hrs < 48) return 'Due 24-48h';
    return 'Upcoming';
  }

  final req = inspection.requestDateTime;
  if (req == null) return 'Upcoming';
  final age = now.difference(req.toLocal()).inHours;
  if (age >= 24) return 'Due <24h';
  if (age >= 12) return 'Due 24-48h';
  return 'Upcoming';
}

int _priorityScore(QualityInspection inspection) {
  var score = 0;
  if (_isOverdue(inspection)) score += 100;
  score += inspection.pendingObservationCount * 20;

  if (inspection.requestDateTime != null) {
    score += (DateTime.now()
                .difference(inspection.requestDateTime!.toLocal())
                .inHours /
            12)
        .floor();
  }

  final curr = inspection.workflowCurrentLevel;
  final total = inspection.workflowTotalLevels;
  if (curr != null && total != null && total >= curr) {
    score += (total - curr + 1) * 2;
  }
  return score;
}
