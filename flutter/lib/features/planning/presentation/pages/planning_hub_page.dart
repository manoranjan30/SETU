import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/issue_tracker_bloc.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/micro_schedule_bloc.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/planning_phase2_bloc.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/schedule_viewer_bloc.dart';
import 'package:setu_mobile/features/planning/presentation/pages/followup_register_page.dart';
import 'package:setu_mobile/features/planning/presentation/pages/issue_tracker_page.dart';
import 'package:setu_mobile/features/planning/presentation/pages/micro_schedule_page.dart';
import 'package:setu_mobile/features/planning/presentation/pages/schedule_viewer_page.dart';
import 'package:setu_mobile/features/planning/presentation/pages/site_journal_page.dart';
import 'package:setu_mobile/features/planning/presentation/pages/task_manager_page.dart';
import 'package:setu_mobile/features/planning/presentation/pages/wo_schedule_page.dart';
import 'package:setu_mobile/features/progress/presentation/pages/progress_approvals_page.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/injection_container.dart';

/// Central hub for all planning sub-modules. Each tile navigates to the
/// corresponding feature page (Issue Tracker, Schedule Viewer, WO Linker,
/// Micro Schedule / Look-Ahead, Progress Approvals).
class PlanningHubPage extends StatelessWidget {
  final Project project;
  const PlanningHubPage({super.key, required this.project});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.colorScheme.surfaceContainerLow,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Planning', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(project.name, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const _SectionHeader('Schedule & Programme'),
          _HubTile(
            icon: Icons.timeline_outlined,
            color: Colors.indigo.shade700,
            title: 'Schedule Viewer',
            subtitle: 'View Baseline, Revised & Working schedule versions',
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => BlocProvider(
                create: (_) => sl<ScheduleViewerBloc>(),
                child: ScheduleViewerPage(project: project),
              ),
            )),
          ),
          _HubTile(
            icon: Icons.link_outlined,
            color: Colors.purple.shade700,
            title: 'WO–Schedule Linker',
            subtitle: 'View Work Order to Activity linkages',
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => WoSchedulePage(project: project),
            )),
          ),
          _HubTile(
            icon: Icons.calendar_view_week_outlined,
            color: Colors.teal.shade700,
            title: 'Look-Ahead / Micro Schedule',
            subtitle: 'Weekly look-ahead plans and daily progress logs',
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => BlocProvider(
                create: (_) => sl<MicroScheduleBloc>(),
                child: MicroSchedulePage(project: project),
              ),
            )),
          ),
          const SizedBox(height: 8),
          const _SectionHeader('Issues & Actions'),
          _HubTile(
            icon: Icons.bug_report_outlined,
            color: Colors.red.shade700,
            title: 'Issue Tracker',
            subtitle: 'Raise, track, and close cross-department issues',
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => BlocProvider(
                create: (_) => sl<IssueTrackerBloc>(),
                child: IssueTrackerPage(project: project),
              ),
            )),
          ),
          _HubTile(
            icon: Icons.task_alt_outlined,
            color: Colors.indigo.shade700,
            title: 'Task Manager',
            subtitle: 'Create, assign, and track tasks linked to schedule',
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => BlocProvider(
                create: (_) => sl<PlanningPhase2Bloc>(),
                child: TaskManagerPage(project: project),
              ),
            )),
          ),
          _HubTile(
            icon: Icons.assignment_late_outlined,
            color: Colors.deepOrange.shade700,
            title: 'Follow-up Register',
            subtitle: 'Action items from meetings and site reviews',
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => BlocProvider(
                create: (_) => sl<PlanningPhase2Bloc>(),
                child: FollowupRegisterPage(project: project),
              ),
            )),
          ),
          _HubTile(
            icon: Icons.menu_book_outlined,
            color: Colors.brown.shade600,
            title: 'Site Journal',
            subtitle: 'Daily site diary — weather, work done, headcount',
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => BlocProvider(
                create: (_) => sl<PlanningPhase2Bloc>(),
                child: SiteJournalPage(project: project),
              ),
            )),
          ),
          const SizedBox(height: 8),
          const _SectionHeader('Progress'),
          _HubTile(
            icon: Icons.bar_chart_outlined,
            color: Colors.green.shade700,
            title: 'Progress Approvals',
            subtitle: 'Review and approve submitted progress entries',
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => ProgressApprovalsPage(
                projectId: project.id,
                projectName: project.name,
              ),
            )),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8, top: 4),
    child: Text(
      title.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
      ),
    ),
  );
}

class _HubTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _HubTile({
    required this.icon, required this.color, required this.title,
    required this.subtitle, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: TextStyle(fontSize: 12,
                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55))),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Theme.of(context).dividerColor),
            ],
          ),
        ),
      ),
    );
  }
}
