import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/pages/eps_explorer_page.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_approvals_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_request_page.dart';
import 'package:setu_mobile/injection_container.dart';

/// Module hub shown after selecting a project.
/// Lists all available modules and navigates to each on tap.
class ModuleSelectionPage extends StatelessWidget {
  final Project project;

  const ModuleSelectionPage({super.key, required this.project});

  @override
  Widget build(BuildContext context) {
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
        padding: const EdgeInsets.all(16),
        children: [
          _ModuleCard(
            icon: Icons.timeline_rounded,
            title: 'Progress Reporting',
            subtitle: 'Report daily activity progress and quantities',
            color: const Color(0xFF1565C0),
            onTap: () => _navigateToEpsExplorer(context),
          ),
          const SizedBox(height: 12),
          _ModuleCard(
            icon: Icons.task_alt_rounded,
            title: 'Quality Request',
            subtitle: 'Raise Request for Inspection (RFI) — navigate to Floor level',
            color: Colors.teal.shade700,
            onTap: () => _navigateToQualityRequest(context),
          ),
          const SizedBox(height: 12),
          _ModuleCard(
            icon: Icons.verified_rounded,
            title: 'Quality Approvals',
            subtitle: 'Review and approve pending inspection requests',
            color: Colors.indigo.shade700,
            onTap: () => _navigateToQualityApprovals(context),
          ),
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
}

// ---------------------------------------------------------------------------

class _ModuleCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ModuleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withValues(alpha: 0.3)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 26),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right_rounded,
                  color: color.withValues(alpha: 0.7)),
            ],
          ),
        ),
      ),
    );
  }
}
