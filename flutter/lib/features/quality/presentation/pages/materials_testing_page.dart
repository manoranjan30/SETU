import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/presentation/pages/cube_register_page.dart';

/// Landing page for the Materials Testing module.
/// Lists sub-modules (Cube Register, and future tests) as navigable tiles.
class MaterialsTestingPage extends StatelessWidget {
  final int projectId;
  final String projectName;

  const MaterialsTestingPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Materials Testing'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SubModuleTile(
            icon: Icons.science_outlined,
            title: 'Cube Register',
            subtitle: 'Concrete cube test results & age-wise strength tracking',
            color: const Color(0xFF6D28D9),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => CubeRegisterPage(
                  projectId: projectId,
                  projectName: projectName,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SubModuleTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _SubModuleTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                          fontSize: 13, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey.shade400),
            ],
          ),
        ),
      ),
    );
  }
}
