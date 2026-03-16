import 'package:flutter/material.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';
import 'package:setu_mobile/features/tower_lens/presentation/widgets/isometric_building_painter.dart';

/// Compact 3D tower card for the project dashboard.
/// Shows the mini isometric building, overall progress, and key counts.
/// Tapping navigates to the full [TowerLensPage].
class TowerMiniCard extends StatelessWidget {
  final TowerRenderModel model;
  final VoidCallback onTap;

  const TowerMiniCard({
    super.key,
    required this.model,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hitAreas = <FloorHitArea>[];
    final totalOpenIssues = model.floors
        .fold(0, (sum, f) => sum + f.openQualityObs + f.openEhsObs);
    final completedFloors =
        model.floors.where((f) => f.progressPct >= 100).length;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1E293B).withValues(alpha: 0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            // ── Mini 3D building ──────────────────────────────────────────
            SizedBox(
              width: 130,
              height: 130,
              child: CustomPaint(
                painter: IsometricBuildingPainter(
                  model: model,
                  hitAreas: hitAreas,
                  buildProgress: 1.0,
                  scale: 0.55, // scaled down for the mini card
                ),
              ),
            ),

            // ── Stats panel ───────────────────────────────────────────────
            Expanded(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      model.towerName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Overall progress bar
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: model.overallProgress / 100,
                        minHeight: 6,
                        backgroundColor:
                            Colors.white.withValues(alpha: 0.15),
                        color: model.overallProgress >= 100
                            ? const Color(0xFF22C55E)
                            : const Color(0xFF3B82F6),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${model.overallProgress.toStringAsFixed(0)}% complete',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Floor stats
                    Row(
                      children: [
                        _MiniStat(
                          label: 'Floors',
                          value: '${model.floors.length}',
                          icon: Icons.layers_outlined,
                        ),
                        const SizedBox(width: 12),
                        _MiniStat(
                          label: 'Done',
                          value: '$completedFloors',
                          icon: Icons.check_circle_outline_rounded,
                          color: const Color(0xFF4ADE80),
                        ),
                        if (totalOpenIssues > 0) ...[
                          const SizedBox(width: 12),
                          _MiniStat(
                            label: 'Issues',
                            value: '$totalOpenIssues',
                            icon: Icons.warning_amber_rounded,
                            color: const Color(0xFFFBBF24),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Icon(
                Icons.chevron_right_rounded,
                color: Colors.white.withValues(alpha: 0.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? Colors.white.withValues(alpha: 0.6);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 11, color: c),
            const SizedBox(width: 3),
            Text(label,
                style: TextStyle(
                    fontSize: 9,
                    color: Colors.white.withValues(alpha: 0.45))),
          ],
        ),
        Text(value,
            style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: c)),
      ],
    );
  }
}
