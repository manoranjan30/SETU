import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/planning/data/models/planning_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/issue_tracker_bloc.dart';
import 'package:setu_mobile/features/planning/presentation/pages/issue_detail_page.dart';
import 'package:setu_mobile/features/planning/presentation/widgets/raise_issue_sheet.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

class IssueTrackerPage extends StatefulWidget {
  final Project project;
  const IssueTrackerPage({super.key, required this.project});

  @override
  State<IssueTrackerPage> createState() => _IssueTrackerPageState();
}

class _IssueTrackerPageState extends State<IssueTrackerPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;
  static const _filters = ['ALL', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];
  static const _labels = ['All', 'Open', 'In Progress', 'Completed', 'Closed'];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: _filters.length, vsync: this);
    _tab.addListener(() {
      if (!_tab.indexIsChanging) {
        final f = _filters[_tab.index];
        context.read<IssueTrackerBloc>().add(
          LoadIssues(widget.project.id, statusFilter: f == 'ALL' ? null : f));
      }
    });
    context.read<IssueTrackerBloc>().add(LoadIssues(widget.project.id));
  }

  @override
  void dispose() { _tab.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Issue Tracker', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text(widget.project.name, style: const TextStyle(fontSize: 12)),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<IssueTrackerBloc>().add(const RefreshIssues()),
          ),
        ],
        bottom: TabBar(
          controller: _tab,
          tabs: _labels.map((l) => Tab(text: l)).toList(),
          isScrollable: true,
          tabAlignment: TabAlignment.start,
        ),
      ),
      body: BlocConsumer<IssueTrackerBloc, IssueTrackerState>(
        listener: (context, state) {
          if (state is IssueActionSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.green.shade700));
          }
          if (state is IssueTrackerError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.red.shade700));
          }
        },
        builder: (context, state) {
          if (state is IssueTrackerLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is IssueTrackerError) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(state.message),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.read<IssueTrackerBloc>().add(LoadIssues(widget.project.id)),
                child: const Text('Retry'),
              ),
            ]));
          }
          if (state is! IssuesLoaded) return const SizedBox.shrink();

          final issues = state.issues;
          if (issues.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.check_circle_outline, size: 64, color: Colors.green.shade300),
              const SizedBox(height: 12),
              const Text('No issues found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ]));
          }
          return RefreshIndicator(
            onRefresh: () async => context.read<IssueTrackerBloc>().add(const RefreshIssues()),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: issues.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) => _IssueCard(
                issue: issues[i],
                onTap: () async {
                  await Navigator.push(context, MaterialPageRoute(
                    builder: (_) => BlocProvider.value(
                      value: context.read<IssueTrackerBloc>(),
                      child: IssueDetailPage(project: widget.project, issue: issues[i]),
                    ),
                  ));
                  if (context.mounted) {
                    context.read<IssueTrackerBloc>().add(const RefreshIssues());
                  }
                },
              ),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await RaiseIssueSheet.show(context, project: widget.project);
          if (context.mounted) context.read<IssueTrackerBloc>().add(const RefreshIssues());
        },
        icon: const Icon(Icons.add),
        label: const Text('Raise Issue'),
        backgroundColor: Colors.red.shade700,
      ),
    );
  }
}

class _IssueCard extends StatelessWidget {
  final IssueTrackerIssue issue;
  final VoidCallback onTap;
  const _IssueCard({required this.issue, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: issue.status.color.withValues(alpha: 0.3)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: issue.priority.color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(issue.priority.icon, size: 12, color: issue.priority.color),
                  const SizedBox(width: 3),
                  Text(issue.priority.label,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: issue.priority.color)),
                ]),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: issue.status.color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(issue.status.label,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: issue.status.color)),
              ),
              const Spacer(),
              Text(issue.issueNumber, style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
            ]),
            const SizedBox(height: 8),
            Text(issue.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14), maxLines: 2, overflow: TextOverflow.ellipsis),
            if (issue.description?.isNotEmpty ?? false) ...[
              const SizedBox(height: 4),
              Text(issue.description!, style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)), maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
            const SizedBox(height: 8),
            Row(children: [
              Icon(Icons.person_outline, size: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
              const SizedBox(width: 4),
              Text(issue.raisedByName ?? 'Unknown', style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.6))),
              if (issue.requiredDate != null) ...[
                const Spacer(),
                Icon(Icons.schedule, size: 12, color: Colors.orange.shade700),
                const SizedBox(width: 4),
                Text('Due ${issue.requiredDate}', style: TextStyle(fontSize: 11, color: Colors.orange.shade700)),
              ],
            ]),
            if (issue.currentDepartmentName != null) ...[
              const SizedBox(height: 4),
              Row(children: [
                Icon(Icons.business_outlined, size: 12, color: Colors.blue.shade700),
                const SizedBox(width: 4),
                Text('With: ${issue.currentDepartmentName}', style: TextStyle(fontSize: 11, color: Colors.blue.shade700)),
              ]),
            ],
          ]),
        ),
      ),
    );
  }
}
