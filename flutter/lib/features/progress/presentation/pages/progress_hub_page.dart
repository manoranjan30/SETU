import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/labor/presentation/bloc/labor_bloc.dart';
import 'package:setu_mobile/features/labor/presentation/pages/labor_presence_page.dart';
import 'package:setu_mobile/features/planning/presentation/pages/planning_hub_page.dart';
import 'package:setu_mobile/features/progress/presentation/pages/progress_approvals_page.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/pages/eps_explorer_page.dart';
import 'package:setu_mobile/features/tower_lens/presentation/pages/tower_lens_page.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/empty_state_view.dart';

/// Landing hub for the Progress main module — groups everything that used
/// to be separate top-level dashboard tiles (Progress Reporting, Progress
/// Approvals, Planning, 3D Tower Progress, Labor Register) under one entry
/// point. Pure navigation/UI grouping — every tile still opens the exact
/// same page with the exact same permission gate as before.
class ProgressHubPage extends StatelessWidget {
  final Project project;
  const ProgressHubPage({super.key, required this.project});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    final theme = Theme.of(context);

    final tiles = <_HubTile>[
      if (ps.canEntryProgress)
        _HubTile(
          icon: Icons.timeline_rounded,
          color: const Color(0xFF1565C0),
          title: 'Progress Reporting',
          subtitle: 'Record activity progress against the EPS structure',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => BlocProvider(
              create: (_) => sl<ProjectBloc>(),
              child: EpsExplorerPage(project: project),
            ),
          )),
        ),
      if (ps.canApproveProgress)
        _HubTile(
          icon: Icons.fact_check_outlined,
          color: const Color(0xFF0369A1),
          title: 'Progress Approvals',
          subtitle: 'Review and approve submitted progress entries',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => ProgressApprovalsPage(projectId: project.id, projectName: project.name),
          )),
        ),
      _HubTile(
        icon: Icons.timeline_outlined,
        color: const Color(0xFF4F46E5),
        title: 'Planning',
        subtitle: 'Schedule, Issues, Tasks, WO Linker, Micro Schedule',
        onTap: () => Navigator.push(context, MaterialPageRoute(
          builder: (_) => PlanningHubPage(project: project),
        )),
      ),
      _HubTile(
        icon: Icons.view_in_ar_rounded,
        color: const Color(0xFF4C1D95),
        title: '3D Tower Progress',
        subtitle: 'Visual building progress by tower and floor',
        onTap: () => Navigator.push(context, MaterialPageRoute(
          builder: (_) => TowerLensPage(projectId: project.id, projectName: project.name),
        )),
      ),
      if (ps.hasAnyLaborAccess)
        _HubTile(
          icon: Icons.people_outline_rounded,
          color: const Color(0xFF065F46),
          title: 'Labor Register',
          subtitle: 'Daily headcount entry by trade and contractor',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => BlocProvider(
              create: (_) => sl<LaborBloc>(),
              child: LaborPresencePage(projectId: project.id, projectName: project.name),
            ),
          )),
        ),
    ];

    return Scaffold(
      backgroundColor: theme.colorScheme.surfaceContainerLow,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Progress', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(project.name, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
      body: tiles.isEmpty
          ? EmptyStateView.noAccess()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: tiles,
            ),
    );
  }
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
