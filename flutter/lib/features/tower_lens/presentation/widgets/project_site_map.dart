import 'package:flutter/material.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';
import 'package:setu_mobile/features/tower_lens/presentation/widgets/isometric_building_painter.dart';

/// Grid overview showing all towers in a project as mini isometric buildings.
/// Used as the "site map" tab in TowerLensPage when multiple towers exist.
class ProjectSiteMap extends StatelessWidget {
  final List<TowerRenderModel> towers;
  final int? activeTowerIndex;
  final ValueChanged<int> onTowerSelected;

  const ProjectSiteMap({
    super.key,
    required this.towers,
    required this.onTowerSelected,
    this.activeTowerIndex,
  });

  @override
  Widget build(BuildContext context) {
    if (towers.isEmpty) {
      return const Center(
        child: Text('No towers found.',
            style: TextStyle(color: Colors.grey)),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.85,
      ),
      itemCount: towers.length,
      itemBuilder: (context, i) {
        final tower = towers[i];
        final isActive = activeTowerIndex == i;
        final hitAreas = <FloorHitArea>[];

        return GestureDetector(
          onTap: () => onTowerSelected(i),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: isActive
                    ? const Color(0xFF3B82F6)
                    : Colors.transparent,
                width: 2,
              ),
              boxShadow: isActive
                  ? [
                      BoxShadow(
                        color: const Color(0xFF3B82F6).withValues(alpha: 0.3),
                        blurRadius: 12,
                        spreadRadius: 1,
                      )
                    ]
                  : null,
            ),
            child: Column(
              children: [
                // Mini 3D building
                Expanded(
                  child: CustomPaint(
                    painter: IsometricBuildingPainter(
                      model: tower,
                      hitAreas: hitAreas,
                      buildProgress: 1.0,
                      scale: 0.42,
                    ),
                    child: const SizedBox.expand(),
                  ),
                ),

                // Tower name + progress
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: const BorderRadius.vertical(
                        bottom: Radius.circular(12)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tower.towerName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(
                          value: tower.overallProgress / 100,
                          minHeight: 3,
                          backgroundColor:
                              Colors.white.withValues(alpha: 0.1),
                          color: _progressColor(tower.overallProgress),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${tower.overallProgress.toStringAsFixed(0)}%',
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.white.withValues(alpha: 0.55),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Color _progressColor(double pct) {
    if (pct >= 100) return const Color(0xFF22C55E);
    if (pct >= 56) return const Color(0xFF84CC16);
    if (pct >= 31) return const Color(0xFFF59E0B);
    return const Color(0xFF6B7280);
  }
}
