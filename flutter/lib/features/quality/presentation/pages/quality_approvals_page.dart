import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/inspection_detail_page.dart';

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
    'PENDING',
    'ALL',
    'APPROVED',
    'REJECTED',
    'DASHBOARD'
  ];
  static const _labels = [
    'Pending',
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
    _loadInspections('PENDING');
    _loadInspections('ALL');
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

  String _tabToFilter(String tabKey) => tabKey == 'DASHBOARD' ? 'ALL' : tabKey;

  void _onTabChanged() {
    if (_tabCtrl.indexIsChanging) return;
    _loadInspections(_tabToFilter(_tabKeys[_tabCtrl.index]));
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

    final filter = _tabToFilter(activeTab);
    _loadInspections(filter);
    if (filter != 'ALL') _loadInspections('ALL');
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

          final loading = state is QualityApprovalLoading;
          final activeFilter = _tabToFilter(_tabKeys[_tabCtrl.index]);
          final hasData =
              _cached(activeFilter).isNotEmpty || _cached('ALL').isNotEmpty;

          if (loading && _lastInspections == null && !hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          return Stack(
            children: [
              TabBarView(
                controller: _tabCtrl,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _InspectionList(
                    title: 'Pending Approvals',
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

class _InspectionList extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final pending = inspections.where(_isPendingStatus).length;
    final approved = inspections
        .where((i) =>
            i.status == InspectionStatus.approved ||
            i.status == InspectionStatus.provisionallyApproved)
        .length;
    final rejected =
        inspections.where((i) => i.status == InspectionStatus.rejected).length;

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: inspections.isEmpty
          ? ListView(children: const [
              SizedBox(height: 180),
              Center(child: Text('No inspections found'))
            ])
          : ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: inspections.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                if (i == 0) {
                  return Card(
                    elevation: 0,
                    color: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest
                        .withValues(alpha: 0.4),
                    child: ListTile(
                      title: Text(title),
                      subtitle: Text(
                          'Total ${inspections.length}  Pending $pending  Approved $approved  Rejected $rejected'),
                    ),
                  );
                }
                final inspection = inspections[i - 1];
                return _InspectionCard(
                    inspection: inspection,
                    onTap: () => onInspectionTap(inspection));
              },
            ),
    );
  }
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
    final workflow = inspection.workflowCurrentLevel != null &&
            inspection.workflowTotalLevels != null
        ? 'L${inspection.workflowCurrentLevel}/${inspection.workflowTotalLevels}'
        : null;
    final age = _ageLabel(inspection.requestDateTime);
    final overdue = _isOverdue(inspection);

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: status.color.withValues(alpha: 0.35)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(
                  inspection.activityName ?? 'Inspection #${inspection.id}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .bodyLarge
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 8),
              _MiniChip(
                  text: status.label, color: status.color, icon: status.icon),
            ]),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: inspection.locationHierarchy.isEmpty
                  ? const [
                      _MiniChip(
                          text: 'Location unavailable',
                          icon: Icons.location_off_outlined)
                    ]
                  : inspection.locationHierarchy
                      .take(4)
                      .map((e) =>
                          _MiniChip(text: e, icon: Icons.location_on_outlined))
                      .toList(),
            ),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              _MiniChip(
                  text: inspection.inspectedBy ?? 'Pending inspector',
                  icon: Icons.person_outline),
              if (inspection.requestDate.isNotEmpty)
                _MiniChip(
                    text: inspection.requestDate,
                    icon: Icons.calendar_today_outlined),
              if (workflow != null)
                _MiniChip(text: workflow, icon: Icons.rule_folder_outlined),
              if (age != null)
                _MiniChip(
                  text: overdue ? 'Overdue $age' : 'Age $age',
                  icon: overdue
                      ? Icons.warning_amber_rounded
                      : Icons.timer_outlined,
                  color: overdue ? Colors.red.shade700 : null,
                ),
              if (inspection.pendingObservationCount > 0)
                _MiniChip(
                    text: '${inspection.pendingObservationCount} open obs',
                    icon: Icons.report_problem_outlined,
                    color: Colors.red.shade700),
            ]),
            if (inspection.totalStages > 0) ...[
              const SizedBox(height: 10),
              LinearProgressIndicator(value: progress, minHeight: 5),
              const SizedBox(height: 4),
              Text(
                  '${inspection.completedStages}/${inspection.totalStages} stages completed',
                  style: Theme.of(context).textTheme.bodySmall),
            ],
          ]),
        ),
      ),
    );
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
      i.status == InspectionStatus.partiallyApproved;
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
