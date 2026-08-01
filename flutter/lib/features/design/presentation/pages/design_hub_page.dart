import 'package:flutter/material.dart';
import 'package:setu_mobile/features/design/presentation/pages/design_register_page.dart';

/// Landing hub for the Design main module. Currently a single tile (Design
/// Drawings) — kept as its own hub page rather than skipping straight to
/// [DesignRegisterPage] so the top-level dashboard stays a consistent
/// 4-tile grid, and so future design-related features have somewhere to go
/// without another top-level dashboard change.
class DesignHubPage extends StatelessWidget {
  final int projectId;
  final String projectName;
  const DesignHubPage({super.key, required this.projectId, required this.projectName});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.colorScheme.surfaceContainerLow,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Design', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(projectName, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _HubTile(
            icon: Icons.architecture_outlined,
            color: const Color(0xFF0C4A6E),
            title: 'Design Drawings',
            subtitle: 'Drawing register — view and open DWG/PDF files',
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => DesignRegisterPage(projectId: projectId, projectName: projectName),
            )),
          ),
        ],
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
