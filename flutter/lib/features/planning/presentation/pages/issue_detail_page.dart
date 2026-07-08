import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/planning/data/models/planning_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/issue_tracker_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

class IssueDetailPage extends StatefulWidget {
  final Project project;
  final IssueTrackerIssue issue;
  const IssueDetailPage({super.key, required this.project, required this.issue});

  @override
  State<IssueDetailPage> createState() => _IssueDetailPageState();
}

class _IssueDetailPageState extends State<IssueDetailPage> {
  @override
  void initState() {
    super.initState();
    context.read<IssueTrackerBloc>()
        .add(LoadIssueDetail(widget.project.id, widget.issue.id));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.issue.issueNumber, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      ),
      body: BlocConsumer<IssueTrackerBloc, IssueTrackerState>(
        listener: (ctx, state) {
          if (state is IssueActionSuccess) {
            ScaffoldMessenger.of(ctx).showSnackBar(
                SnackBar(content: Text(state.message), backgroundColor: Colors.green.shade700));
            Navigator.of(ctx).pop();
          }
          if (state is IssueTrackerError) {
            ScaffoldMessenger.of(ctx).showSnackBar(
                SnackBar(content: Text(state.message), backgroundColor: Colors.red.shade700));
          }
        },
        builder: (ctx, state) {
          if (state is IssueTrackerLoading) return const Center(child: CircularProgressIndicator());
          final issue = state is IssueDetailLoaded ? state.issue : widget.issue;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Header card
              Card(child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: issue.priority.color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(issue.priority.icon, size: 14, color: issue.priority.color),
                        const SizedBox(width: 4),
                        Text(issue.priority.label,
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: issue.priority.color)),
                      ]),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: issue.status.color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(issue.status.label,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: issue.status.color)),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Text(issue.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  if (issue.description?.isNotEmpty ?? false) ...[
                    const SizedBox(height: 8),
                    Text(issue.description!, style: TextStyle(fontSize: 13, color: Colors.grey.shade700)),
                  ],
                  const SizedBox(height: 12),
                  _DetailRow(icon: Icons.person_outline, text: 'Raised by: ${issue.raisedByName ?? "Unknown"}'),
                  _DetailRow(icon: Icons.calendar_today_outlined, text: 'Raised: ${issue.raisedDate}'),
                  if (issue.requiredDate != null)
                    _DetailRow(icon: Icons.schedule, text: 'Required by: ${issue.requiredDate}', color: Colors.orange.shade700),
                  if (issue.committedDate != null)
                    _DetailRow(icon: Icons.event_available_outlined, text: 'Committed: ${issue.committedDate}', color: Colors.blue.shade700),
                  if (issue.currentDepartmentName != null)
                    _DetailRow(icon: Icons.business_outlined, text: 'With: ${issue.currentDepartmentName}', color: Colors.indigo.shade700),
                ]),
              )),

              // Flow steps
              if (issue.flowSteps.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Approval Flow', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                const SizedBox(height: 8),
                ...issue.flowSteps.map((step) => _FlowStepCard(step: step)),
              ],

              // Actions — gated by backend permission flags
              if (issue.canRespond || issue.canCoordinatorClose || issue.canClose) ...[
                const SizedBox(height: 20),
                const Text('Actions', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                const SizedBox(height: 8),
                _RespondSection(issue: issue, project: widget.project),
              ],
            ]),
          );
        },
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color? color;
  const _DetailRow({required this.icon, required this.text, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.65);
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(children: [
        Icon(icon, size: 14, color: c),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(fontSize: 12, color: c)),
      ]),
    );
  }
}

class _FlowStepCard extends StatelessWidget {
  final IssueFlowStep step;
  const _FlowStepCard({required this.step});

  @override
  Widget build(BuildContext context) {
    final isPending = step.status == 'PENDING';
    final color = isPending ? Colors.orange.shade700 : Colors.green.shade700;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: color.withValues(alpha: 0.3)),
      ),
      child: ListTile(
        dense: true,
        leading: CircleAvatar(
          radius: 14,
          backgroundColor: color.withValues(alpha: 0.1),
          child: Text('${step.stepIndex + 1}', style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700)),
        ),
        title: Text(step.departmentName ?? 'Department ${step.stepIndex + 1}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        subtitle: step.responseText?.isNotEmpty == true
            ? Text(step.responseText!, style: const TextStyle(fontSize: 11))
            : null,
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
          child: Text(isPending ? 'Pending' : step.status,
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
        ),
      ),
    );
  }
}

class _RespondSection extends StatefulWidget {
  final IssueTrackerIssue issue;
  final Project project;
  const _RespondSection({required this.issue, required this.project});

  @override
  State<_RespondSection> createState() => _RespondSectionState();
}

class _RespondSectionState extends State<_RespondSection> {
  final _ctrl = TextEditingController();

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Card(child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(
          controller: _ctrl,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Add your response or remarks…',
            border: OutlineInputBorder(),
            isDense: true,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (widget.issue.canRespond)
            OutlinedButton.icon(
              onPressed: () {
                if (_ctrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Enter a response before submitting')));
                  return;
                }
                context.read<IssueTrackerBloc>().add(
                  RespondToIssue(widget.project.id, widget.issue.id, _ctrl.text.trim()));
              },
              icon: const Icon(Icons.reply_outlined, size: 16),
              label: const Text('Submit Response'),
            ),
          if (widget.issue.canCoordinatorClose)
            OutlinedButton.icon(
              onPressed: () => context.read<IssueTrackerBloc>().add(
                RespondToIssue(widget.project.id, widget.issue.id, _ctrl.text.trim())),
              icon: const Icon(Icons.verified_outlined, size: 16),
              label: const Text('Coordinator Close'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.blue.shade700, side: BorderSide(color: Colors.blue.shade300)),
            ),
          if (widget.issue.canClose)
            FilledButton.icon(
              onPressed: () => context.read<IssueTrackerBloc>().add(
                CloseIssue(widget.project.id, widget.issue.id, remarks: _ctrl.text.trim().isNotEmpty ? _ctrl.text.trim() : null)),
              icon: const Icon(Icons.check_circle_outline, size: 16),
              label: const Text('Close Issue'),
              style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700),
            ),
        ]),
      ]),
    ));
  }
}
