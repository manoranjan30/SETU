import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_site_obs_page.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/pages/eps_explorer_page.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_approvals_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_request_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_site_obs_page.dart';
import 'package:setu_mobile/injection_container.dart';

/// Module hub shown after selecting a project.
/// Lists all available modules and navigates to each on tap.
class ModuleSelectionPage extends StatelessWidget {
  final Project project;

  const ModuleSelectionPage({super.key, required this.project});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              project.name,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const Text(
              'Select Module',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
            ),
          ],
        ),
      ),
      body: ListView(
        children: [
          _ModuleRow(
            icon: Icons.timeline_rounded,
            title: 'Progress Reporting',
            subtitle: 'Report daily activity progress',
            color: const Color(0xFF1565C0),
            onTap: () => _navigateToEpsExplorer(context),
          ),
          const Divider(height: 1),
          _ModuleRow(
            icon: Icons.task_alt_rounded,
            title: 'Quality Request',
            subtitle: 'Raise RFI — navigate to Floor level',
            color: const Color(0xFF0E7490),
            onTap: () => _navigateToQualityRequest(context),
          ),
          const Divider(height: 1),
          _ModuleRow(
            icon: Icons.verified_rounded,
            title: 'Quality Approvals',
            subtitle: 'Review and approve inspection requests',
            color: const Color(0xFF3730A3),
            onTap: () => _navigateToQualityApprovals(context),
          ),
          if (ps.canReadQualityObs || ps.canCreateQualityObs) ...[
            const Divider(height: 1),
            _ModuleRow(
              icon: Icons.remove_red_eye_outlined,
              title: 'Quality Site Observations',
              subtitle: 'Raise and track site quality issues',
              color: const Color(0xFF0F766E),
              onTap: () => _navigateToQualitySiteObs(context),
            ),
          ],
          if (ps.hasAnyEhsAccess) ...[
            const Divider(height: 1),
            _ModuleRow(
              icon: Icons.health_and_safety_outlined,
              title: 'EHS Observations',
              subtitle: 'Environment, Health & Safety observations',
              color: const Color(0xFFD97706),
              onTap: () => _navigateToEhsSiteObs(context),
            ),
          ],
          const Divider(height: 1),
        ],
      ),
    );
  }

  void _navigateToEpsExplorer(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BlocProvider(
          create: (context) => sl<ProjectBloc>(),
          child: EpsExplorerPage(project: project),
        ),
      ),
    );
  }

  void _navigateToQualityRequest(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BlocProvider(
          create: (_) => sl<QualityRequestBloc>(),
          child: QualityRequestPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _navigateToQualityApprovals(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BlocProvider(
          create: (_) => sl<QualityApprovalBloc>(),
          child: QualityApprovalsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _navigateToQualitySiteObs(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider(
          create: (_) => sl<QualitySiteObsBloc>(),
          child: QualitySiteObsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _navigateToEhsSiteObs(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider(
          create: (_) => sl<EhsSiteObsBloc>(),
          child: EhsSiteObsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------

class _ModuleRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ModuleRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        child: Row(
          children: [
            // Icon circle
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 16),
            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: Color(0xFF111111),
                      letterSpacing: -0.1,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right_rounded,
                color: color.withValues(alpha: 0.6), size: 22),
          ],
        ),
      ),
    );
  }
}
