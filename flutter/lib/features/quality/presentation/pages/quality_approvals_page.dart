import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/inspection_detail_page.dart';

/// QC Inspector entry page — shows a tabbed list of inspections
/// (Pending / All / Approved / Rejected).
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
  late TabController _tabCtrl;

  static const _filters = ['PENDING', 'ALL', 'APPROVED', 'REJECTED'];
  static const _labels = ['Pending', 'All', 'Approved', 'Rejected'];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _filters.length, vsync: this);
    _tabCtrl.addListener(_onTabChanged);
    context.read<QualityApprovalBloc>().add(
          LoadInspections(projectId: widget.projectId, filter: 'PENDING'),
        );
  }

  void _onTabChanged() {
    if (_tabCtrl.indexIsChanging) return;
    context.read<QualityApprovalBloc>().add(
          LoadInspections(
            projectId: widget.projectId,
            filter: _filters[_tabCtrl.index],
          ),
        );
  }

  @override
  void dispose() {
    _tabCtrl.removeListener(_onTabChanged);
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
            const Text('Quality Approvals',
                style:
                    TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.projectName,
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: _labels.map((l) => Tab(text: l)).toList(),
          isScrollable: false,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => context.read<QualityApprovalBloc>().add(
                  LoadInspections(
                    projectId: widget.projectId,
                    filter: _filters[_tabCtrl.index],
                  ),
                ),
          ),
        ],
      ),
      body: BlocConsumer<QualityApprovalBloc, QualityApprovalState>(
        listener: (context, state) {
          if (state is QualityApprovalError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red.shade700,
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
            // Reload list after action
            context.read<QualityApprovalBloc>().add(LoadInspections(
                  projectId: widget.projectId,
                  filter: _filters[_tabCtrl.index],
                ));
          }
        },
        builder: (context, state) {
          if (state is QualityApprovalLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is InspectionsLoaded) {
            return TabBarView(
              controller: _tabCtrl,
              physics: const NeverScrollableScrollPhysics(),
              children: _filters
                  .map((f) => f == state.activeFilter
                      ? _InspectionList(
                          inspections: state.inspections,
                          projectId: widget.projectId,
                        )
                      : const Center(child: CircularProgressIndicator()))
                  .toList(),
            );
          }

          return const Center(child: CircularProgressIndicator());
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------

class _InspectionList extends StatelessWidget {
  final List<QualityInspection> inspections;
  final int projectId;

  const _InspectionList({
    required this.inspections,
    required this.projectId,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (inspections.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.task_alt,
                size: 64,
                color:
                    theme.colorScheme.onSurface.withValues(alpha: 0.3)),
            const SizedBox(height: 12),
            Text('No inspections found',
                style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurface
                        .withValues(alpha: 0.5))),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => context.read<QualityApprovalBloc>().add(
            LoadInspections(projectId: projectId, filter: 'PENDING'),
          ),
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: inspections.length,
        separatorBuilder: (_, __) => const SizedBox(height: 4),
        itemBuilder: (context, i) => _InspectionCard(
          inspection: inspections[i],
          projectId: projectId,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------

class _InspectionCard extends StatelessWidget {
  final QualityInspection inspection;
  final int projectId;

  const _InspectionCard(
      {required this.inspection, required this.projectId});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = inspection.status;

    final Color statusColor;
    final String statusLabel;
    final IconData statusIcon;

    switch (status) {
      case InspectionStatus.approved:
        statusColor = Colors.green.shade700;
        statusLabel = 'Approved';
        statusIcon = Icons.verified_outlined;
      case InspectionStatus.provisionallyApproved:
        statusColor = Colors.teal.shade700;
        statusLabel = 'Prov. Approved';
        statusIcon = Icons.check_circle_outline;
      case InspectionStatus.rejected:
        statusColor = Colors.red.shade700;
        statusLabel = 'Rejected';
        statusIcon = Icons.cancel_outlined;
      case InspectionStatus.partiallyApproved:
        statusColor = Colors.blue.shade700;
        statusLabel = 'Partial';
        statusIcon = Icons.timelapse_outlined;
      case InspectionStatus.pending:
      default:
        statusColor = Colors.orange.shade700;
        statusLabel = 'Pending';
        statusIcon = Icons.pending_outlined;
    }

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: context.read<QualityApprovalBloc>(),
              child: InspectionDetailPage(inspection: inspection),
            ),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      inspection.activityName ?? 'Unknown Activity',
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: statusColor.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(statusIcon, size: 12, color: statusColor),
                        const SizedBox(width: 4),
                        Text(statusLabel,
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: statusColor)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.person_outline,
                      size: 14,
                      color: theme.colorScheme.onSurface
                          .withValues(alpha: 0.5)),
                  const SizedBox(width: 4),
                  Text(inspection.inspectedBy ?? 'Pending Inspector',
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.6))),
                  const SizedBox(width: 16),
                  if (inspection.requestDate.isNotEmpty) ...[
                    Icon(Icons.calendar_today_outlined,
                        size: 14,
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.5)),
                    const SizedBox(width: 4),
                    Text(inspection.requestDate,
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.6))),
                  ],
                ],
              ),
              if (inspection.stages.isNotEmpty) ...[
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: inspection.stages
                          .where((s) => s.allOk)
                          .length /
                      inspection.stages.length,
                  minHeight: 4,
                  backgroundColor:
                      theme.colorScheme.onSurface.withValues(alpha: 0.1),
                  valueColor: AlwaysStoppedAnimation<Color>(
                      Colors.green.shade600),
                ),
                const SizedBox(height: 4),
                Text(
                  '${inspection.stages.where((s) => s.allOk).length}/${inspection.stages.length} stages complete',
                  style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface
                          .withValues(alpha: 0.5)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

}
