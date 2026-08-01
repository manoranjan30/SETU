import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_dashboard_bloc.dart'
    hide DashboardLoaded, DashboardLoading, DashboardInitial, DashboardError;
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/materials_testing_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_approvals_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_dashboard_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_request_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_site_obs_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/snag_desnag_dashboard_page.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/empty_state_view.dart';

/// Landing hub for the Quality main module — groups everything that used to
/// be separate top-level dashboard tiles (Quality Request, Quality
/// Approvals, Checklist Progress, Quality Observations, Materials Testing,
/// Snag/Desnag) under one entry point. Pure navigation/UI grouping — every
/// tile still opens the exact same page with the exact same permission gate
/// as before.
///
/// The older flat "Snag List" tile was removed entirely (not just moved
/// here) — Quality Observations already covers general ad-hoc site defects,
/// and Snag/Desnag is the structured per-unit handover-clearance workflow;
/// the old flat punch-list was legacy duplication of both.
class QualityHubPage extends StatelessWidget {
  final int projectId;
  final String projectName;
  const QualityHubPage({super.key, required this.projectId, required this.projectName});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    final theme = Theme.of(context);

    final tiles = <_HubTile>[
      if (ps.canRaiseRfi)
        _HubTile(
          icon: Icons.task_alt_rounded,
          color: const Color(0xFF0E7490),
          title: 'Quality Request',
          subtitle: 'Raise an RFI for inspection',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => BlocProvider(
              create: (_) => sl<QualityRequestBloc>(),
              child: QualityRequestPage(projectId: projectId, projectName: projectName),
            ),
          )),
        ),
      if (ps.canReadInspection)
        _HubTile(
          icon: Icons.verified_rounded,
          color: const Color(0xFF3730A3),
          title: 'Quality Approvals',
          subtitle: 'Review and act on inspection requests',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => BlocProvider(
              create: (_) => sl<QualityApprovalBloc>(),
              child: QualityApprovalsPage(projectId: projectId, projectName: projectName),
            ),
          )),
        ),
      if (ps.canReadInspection || ps.canRaiseRfi)
        _HubTile(
          icon: Icons.dashboard_rounded,
          color: const Color(0xFF0891B2),
          title: 'Checklist Progress',
          subtitle: 'Block > Floor > Activity checklist drill-down',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => BlocProvider(
              create: (_) => sl<QualityDashboardBloc>(),
              child: QualityDashboardPage(projectId: projectId, projectName: projectName),
            ),
          )),
        ),
      if (ps.hasAnyQualityObsAccess)
        _HubTile(
          icon: Icons.remove_red_eye_outlined,
          color: const Color(0xFF0F766E),
          title: 'Quality Observations',
          subtitle: 'General site defects not tied to a checklist item',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => BlocProvider(
              create: (_) => sl<QualitySiteObsBloc>(),
              child: QualitySiteObsPage(projectId: projectId, projectName: projectName),
            ),
          )),
        ),
      if (ps.canReadCubeTest)
        _HubTile(
          icon: Icons.science_outlined,
          color: const Color(0xFF6D28D9),
          title: 'Materials Testing',
          subtitle: 'Concrete cube test register',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => MaterialsTestingPage(projectId: projectId, projectName: projectName),
          )),
        ),
      if (ps.canReadSnag)
        _HubTile(
          icon: Icons.checklist_rtl_rounded,
          color: const Color(0xFF9D174D),
          title: 'Snag / Desnag',
          subtitle: 'Per-unit handover clearance workflow',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => SnagDesnagDashboardPage(projectId: projectId, projectName: projectName),
          )),
        ),
    ];

    return Scaffold(
      backgroundColor: theme.colorScheme.surfaceContainerLow,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Quality', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(projectName, style: const TextStyle(fontSize: 12)),
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
