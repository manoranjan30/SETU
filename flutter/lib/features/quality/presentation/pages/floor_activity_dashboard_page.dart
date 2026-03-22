import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/dashboard_models.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_dashboard_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/inspection_detail_page.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/activity_status_badge.dart';
import 'package:setu_mobile/injection_container.dart';

/// Sectioned floor activity list screen.
/// Groups activities into: Needs Action / Awaiting Approval / Completed / Blocked.
class FloorActivityDashboardPage extends StatefulWidget {
  final int projectId;
  final int floorId;
  final String floorLabel;
  final String? blockName;

  const FloorActivityDashboardPage({
    super.key,
    required this.projectId,
    required this.floorId,
    required this.floorLabel,
    this.blockName,
  });

  @override
  State<FloorActivityDashboardPage> createState() =>
      _FloorActivityDashboardPageState();
}

enum _DashFilter { all, pending, raised, done, observations }

class _FloorActivityDashboardPageState
    extends State<FloorActivityDashboardPage> {
  _DashFilter _filter = _DashFilter.all;
  bool _showCompleted = false;
  bool _showBlocked = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.floorLabel,
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.bold)),
            Text(
              widget.blockName ?? 'Floor Activities',
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () => context.read<QualityDashboardBloc>().add(
                  LoadFloorDetail(
                    projectId: widget.projectId,
                    floorId: widget.floorId,
                    floorLabel: widget.floorLabel,
                    blockName: widget.blockName,
                  ),
                ),
          ),
        ],
      ),
      body: BlocBuilder<QualityDashboardBloc, QualityDashboardState>(
        buildWhen: (prev, curr) =>
            curr is FloorDetailLoading ||
            (curr is FloorDetailLoaded && curr.floorId == widget.floorId) ||
            (curr is FloorDetailError && curr.floorId == widget.floorId),
        builder: (context, state) {
          if (state is FloorDetailLoading &&
              state.floorId == widget.floorId) {
            return _LoadingView(label: widget.floorLabel);
          }
          if (state is FloorDetailError &&
              state.floorId == widget.floorId) {
            return _ErrorView(
              message: state.message,
              onRetry: () =>
                  context.read<QualityDashboardBloc>().add(LoadFloorDetail(
                        projectId: widget.projectId,
                        floorId: widget.floorId,
                        floorLabel: widget.floorLabel,
                        blockName: widget.blockName,
                      )),
            );
          }
          if (state is FloorDetailLoaded &&
              state.floorId == widget.floorId) {
            return _FloorBody(
              state: state,
              filter: _filter,
              showCompleted: _showCompleted,
              showBlocked: _showBlocked,
              onFilterChanged: (f) => setState(() => _filter = f),
              onToggleCompleted: () =>
                  setState(() => _showCompleted = !_showCompleted),
              onToggleBlocked: () =>
                  setState(() => _showBlocked = !_showBlocked),
              onTapInspection: (insp) => _openInspection(context, insp),
            );
          }
          // Still loading initial state
          return _LoadingView(label: widget.floorLabel);
        },
      ),
    );
  }

  void _openInspection(BuildContext context, QualityInspection insp) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider(
          create: (_) => sl<QualityApprovalBloc>(),
          child: InspectionDetailPage(inspection: insp),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Body
// ─────────────────────────────────────────────────────────────────────────────

class _FloorBody extends StatelessWidget {
  final FloorDetailLoaded state;
  final _DashFilter filter;
  final bool showCompleted;
  final bool showBlocked;
  final ValueChanged<_DashFilter> onFilterChanged;
  final VoidCallback onToggleCompleted;
  final VoidCallback onToggleBlocked;
  final ValueChanged<QualityInspection> onTapInspection;

  const _FloorBody({
    required this.state,
    required this.filter,
    required this.showCompleted,
    required this.showBlocked,
    required this.onFilterChanged,
    required this.onToggleCompleted,
    required this.onToggleBlocked,
    required this.onTapInspection,
  });

  @override
  Widget build(BuildContext context) {
    final sections = state.sections;
    final total = sections.total;
    final pendingCount =
        sections.needsAction.length + sections.awaitingApproval.length;

    return Column(
      children: [
        // ── Summary strip ───────────────────────────────────────────────
        _SummaryStrip(sections: sections),
        // ── Filter chips ────────────────────────────────────────────────
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            children: _DashFilter.values.map((f) {
              final label = _filterLabel(f, sections);
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: FilterChip(
                  label: Text(label,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: filter == f
                              ? FontWeight.w700
                              : FontWeight.normal)),
                  selected: filter == f,
                  onSelected: (_) => onFilterChanged(f),
                  selectedColor: const Color(0xFF0E7490).withValues(alpha: 0.12),
                  checkmarkColor: const Color(0xFF0E7490),
                  side: BorderSide(
                      color: filter == f
                          ? const Color(0xFF0E7490)
                          : const Color(0xFFD1D5DB)),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                ),
              );
            }).toList(),
          ),
        ),
        // ── Sections ────────────────────────────────────────────────────
        Expanded(
          child: total == 0
              ? const _EmptyView()
              : RefreshIndicator(
                  onRefresh: () async {},
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 32),
                    children: [
                      // Needs Action
                      if (_show(filter, _DashFilter.pending) &&
                          sections.needsAction.isNotEmpty) ...[
                        _SectionHeader(
                          icon: Icons.error_rounded,
                          color: const Color(0xFFF44336),
                          title: 'Needs Action',
                          count: sections.needsAction.length,
                        ),
                        ...sections.needsAction.map((row) =>
                            _ActivityRowTile(
                              row: row,
                              onTapInspection: onTapInspection,
                            )),
                      ],
                      // Awaiting Approval
                      if (_show(filter, _DashFilter.raised) &&
                          sections.awaitingApproval.isNotEmpty) ...[
                        _SectionHeader(
                          icon: Icons.schedule_rounded,
                          color: const Color(0xFFFF9800),
                          title: 'Awaiting Approval',
                          count: sections.awaitingApproval.length,
                        ),
                        ...sections.awaitingApproval.map((row) =>
                            _ActivityRowTile(
                              row: row,
                              onTapInspection: onTapInspection,
                            )),
                      ],
                      // Completed (collapsible)
                      if (_show(filter, _DashFilter.done) &&
                          sections.completed.isNotEmpty) ...[
                        _SectionHeader(
                          icon: Icons.check_circle_rounded,
                          color: const Color(0xFF4CAF50),
                          title: 'Completed',
                          count: sections.completed.length,
                          collapsible: true,
                          expanded: showCompleted,
                          onToggle: onToggleCompleted,
                        ),
                        if (showCompleted)
                          ...sections.completed.map((row) =>
                              _ActivityRowTile(
                                row: row,
                                onTapInspection: onTapInspection,
                              )),
                      ],
                      // Blocked (collapsible)
                      if (filter == _DashFilter.all &&
                          sections.blocked.isNotEmpty) ...[
                        _SectionHeader(
                          icon: Icons.lock_outline_rounded,
                          color: const Color(0xFF9CA3AF),
                          title: 'Blocked (Predecessor Pending)',
                          count: sections.blocked.length,
                          collapsible: true,
                          expanded: showBlocked,
                          onToggle: onToggleBlocked,
                        ),
                        if (showBlocked)
                          ...sections.blocked.map((row) =>
                              _ActivityRowTile(
                                row: row,
                                onTapInspection: onTapInspection,
                              )),
                      ],
                      // Empty filtered result
                      if (_isFilteredEmpty(filter, sections, pendingCount))
                        const _EmptyFilterView(),
                    ],
                  ),
                ),
        ),
      ],
    );
  }

  bool _show(_DashFilter current, _DashFilter target) {
    if (current == _DashFilter.all) return true;
    if (current == _DashFilter.observations) return true; // show all for obs
    return current == target;
  }

  bool _isFilteredEmpty(
      _DashFilter f, DashboardSections s, int pending) {
    switch (f) {
      case _DashFilter.all:
        return s.total == 0;
      case _DashFilter.pending:
        return s.needsAction.isEmpty;
      case _DashFilter.raised:
        return s.awaitingApproval.isEmpty;
      case _DashFilter.done:
        return s.completed.isEmpty;
      case _DashFilter.observations:
        return s.needsAction
            .where((r) =>
                r.displayStatus == ActivityDisplayStatus.pendingObservation)
            .isEmpty;
    }
  }

  String _filterLabel(_DashFilter f, DashboardSections s) {
    switch (f) {
      case _DashFilter.all:
        return 'All ${s.total}';
      case _DashFilter.pending:
        return 'Action ${s.needsAction.length}';
      case _DashFilter.raised:
        return 'Raised ${s.awaitingApproval.length}';
      case _DashFilter.done:
        return 'Done ${s.completed.length}';
      case _DashFilter.observations:
        final obsCount = s.needsAction
            .where((r) =>
                r.displayStatus == ActivityDisplayStatus.pendingObservation)
            .length;
        return 'Obs $obsCount';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Strip
// ─────────────────────────────────────────────────────────────────────────────

class _SummaryStrip extends StatelessWidget {
  final DashboardSections sections;
  const _SummaryStrip({required this.sections});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          _Chip(
            count: sections.needsAction.length,
            label: 'Action',
            color: const Color(0xFFF44336),
          ),
          const SizedBox(width: 8),
          _Chip(
            count: sections.awaitingApproval.length,
            label: 'Awaiting',
            color: const Color(0xFFFF9800),
          ),
          const SizedBox(width: 8),
          _Chip(
            count: sections.completed.length,
            label: 'Done',
            color: const Color(0xFF4CAF50),
          ),
          const SizedBox(width: 8),
          _Chip(
            count: sections.blocked.length,
            label: 'Blocked',
            color: const Color(0xFF9CA3AF),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final int count;
  final String label;
  final Color color;
  const _Chip(
      {required this.count, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$count',
            style: TextStyle(
                fontWeight: FontWeight.w800, fontSize: 13, color: color),
          ),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(fontSize: 10, color: color.withValues(alpha: 0.8))),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final int count;
  final bool collapsible;
  final bool expanded;
  final VoidCallback? onToggle;

  const _SectionHeader({
    required this.icon,
    required this.color,
    required this.title,
    required this.count,
    this.collapsible = false,
    this.expanded = false,
    this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: collapsible ? onToggle : null,
      child: Padding(
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 6),
            Text(
              title.toUpperCase(),
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: color,
                  letterSpacing: 0.6),
            ),
            const SizedBox(width: 6),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: color),
              ),
            ),
            const Spacer(),
            if (collapsible)
              Icon(
                expanded
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
                color: const Color(0xFF9CA3AF),
                size: 18,
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Row Tile
// ─────────────────────────────────────────────────────────────────────────────

/// Compact read-only activity tile for the dashboard.
/// Shows status, name, inspection info. Tapping the inspection navigates
/// to [InspectionDetailPage] for full detail + approval actions.
class _ActivityRowTile extends StatelessWidget {
  final ActivityRow row;
  final ValueChanged<QualityInspection> onTapInspection;

  const _ActivityRowTile({
    required this.row,
    required this.onTapInspection,
  });

  @override
  Widget build(BuildContext context) {
    final status = row.displayStatus;
    final activity = row.activity;
    final insp = row.inspection;
    final color = status.color;
    final hasObs = row.observations.isNotEmpty &&
        row.observations.any((o) => o.status == ObservationStatus.pending);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 4,
              offset: const Offset(0, 1))
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: insp != null ? () => onTapInspection(insp) : null,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status icon
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(status.icon, color: color, size: 18),
              ),
              const SizedBox(width: 10),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            activity.activityName,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              color: status == ActivityDisplayStatus.locked ||
                                      status == ActivityDisplayStatus.approved
                                  ? const Color(0xFF6B7280)
                                  : const Color(0xFF111827),
                            ),
                          ),
                        ),
                        ActivityStatusBadge(status: status),
                      ],
                    ),
                    if (insp != null) ...[
                      const SizedBox(height: 4),
                      _InspectionInfo(insp: insp),
                    ],
                    // Multi-go indicator
                    if (insp != null && insp.isMultiPart) ...[
                      const SizedBox(height: 4),
                      _MultiGoChip(insp: insp, allInspections: row.allInspections),
                    ],
                    // Open observation warning
                    if (hasObs) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.warning_amber_rounded,
                              size: 12,
                              color: Colors.orange.shade700),
                          const SizedBox(width: 4),
                          Text(
                            '${row.observations.where((o) => o.status == ObservationStatus.pending).length}'
                            ' open observation(s)',
                            style: TextStyle(
                                fontSize: 11,
                                color: Colors.orange.shade700),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (insp != null)
                const Padding(
                  padding: EdgeInsets.only(left: 4, top: 4),
                  child: Icon(Icons.chevron_right_rounded,
                      color: Color(0xFFD1D5DB), size: 18),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InspectionInfo extends StatelessWidget {
  final QualityInspection insp;
  const _InspectionInfo({required this.insp});

  @override
  Widget build(BuildContext context) {
    final dateStr = insp.requestDateTime != null
        ? _formatDate(insp.requestDateTime!)
        : '';
    final levelStr = (insp.workflowCurrentLevel != null &&
            insp.workflowTotalLevels != null)
        ? ' · L${insp.workflowCurrentLevel}/${insp.workflowTotalLevels}'
        : '';

    return Text(
      'RFI #${insp.id}$levelStr${dateStr.isNotEmpty ? ' · $dateStr' : ''}',
      style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
    );
  }

  String _formatDate(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inDays == 0) return 'Today';
    if (diff.inDays == 1) return '1d ago';
    if (diff.inDays < 30) return '${diff.inDays}d ago';
    return '${d.day}/${d.month}/${d.year}';
  }
}

class _MultiGoChip extends StatelessWidget {
  final QualityInspection insp;
  final List<QualityInspection> allInspections;
  const _MultiGoChip(
      {required this.insp, required this.allInspections});

  @override
  Widget build(BuildContext context) {
    final raised = allInspections.length;
    final total = insp.totalParts;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFF2196F3).withValues(alpha: 0.4)),
      ),
      child: Text(
        'Multi-Go: $raised/$total raised',
        style: const TextStyle(
            fontSize: 10,
            color: Color(0xFF2196F3),
            fontWeight: FontWeight.w600),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Error / Empty
// ─────────────────────────────────────────────────────────────────────────────

class _LoadingView extends StatelessWidget {
  final String label;
  const _LoadingView({required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text('Loading $label activities…',
              style: const TextStyle(
                  fontSize: 13, color: Color(0xFF6B7280))),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined,
                size: 48, color: Color(0xFFD1D5DB)),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13, color: Color(0xFF6B7280))),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.task_alt_outlined,
              size: 56, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          const Text('No activities found',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF9CA3AF))),
          const SizedBox(height: 4),
          const Text('No checklists are assigned to this floor yet.',
              style: TextStyle(fontSize: 12, color: Color(0xFFD1D5DB))),
        ],
      ),
    );
  }
}

class _EmptyFilterView extends StatelessWidget {
  const _EmptyFilterView();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(40),
      child: Center(
        child: Text('No items match this filter.',
            style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
      ),
    );
  }
}
