import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_incident_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_hub_page.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_incidents_page.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_site_obs_page.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/empty_state_view.dart';

/// Landing hub for the EHS main module — groups everything that used to be
/// separate top-level dashboard tiles (EHS Observations, EHS Incidents, EHS
/// Hub) under one entry point. Pure navigation/UI grouping — every tile
/// still opens the exact same page with the exact same permission gate as
/// before.
///
/// Named "Main" to disambiguate from [EhsHubPage] (the manhours/training/
/// legal/machinery/vehicles data dashboard, which is itself one of this
/// page's tiles, not a synonym for it).
class EhsMainHubPage extends StatelessWidget {
  final int projectId;
  final String projectName;
  const EhsMainHubPage({super.key, required this.projectId, required this.projectName});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    final theme = Theme.of(context);

    final tiles = <_HubTile>[
      if (ps.hasAnyEhsAccess)
        _HubTile(
          icon: Icons.health_and_safety_outlined,
          color: const Color(0xFFD97706),
          title: 'EHS Observations',
          subtitle: 'Unsafe acts and unsafe conditions',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => BlocProvider(
              create: (_) => sl<EhsSiteObsBloc>(),
              child: EhsSiteObsPage(projectId: projectId, projectName: projectName),
            ),
          )),
        ),
      if (ps.hasAnyEhsIncidentAccess)
        _HubTile(
          icon: Icons.report_problem_outlined,
          color: const Color(0xFFB91C1C),
          title: 'EHS Incidents',
          subtitle: 'Safety incident reporting',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => BlocProvider(
              create: (_) => sl<EhsIncidentBloc>(),
              child: EhsIncidentsPage(projectId: projectId, projectName: projectName),
            ),
          )),
        ),
      if (ps.canReadEhsDashboard)
        _HubTile(
          icon: Icons.shield_outlined,
          color: const Color(0xFF7C3AED),
          title: 'EHS Hub',
          subtitle: 'Manhours, training, legal, machinery, vehicles',
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => EhsHubPage(projectId: projectId, projectName: projectName),
          )),
        ),
    ];

    return Scaffold(
      backgroundColor: theme.colorScheme.surfaceContainerLow,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('EHS', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
