import 'package:flutter/material.dart';
import 'package:setu_mobile/features/tower_lens/data/models/floor_progress.dart';

/// Draggable bottom sheet showing full detail for a selected floor.
/// Opened by TowerLensPage when user taps a floor in the 3D view.
class FloorDetailSheet extends StatelessWidget {
  final FloorProgress floor;
  final String towerName;
  final VoidCallback? onViewQuality;
  final VoidCallback? onViewEhs;
  final VoidCallback onDismiss;

  const FloorDetailSheet({
    super.key,
    required this.floor,
    required this.towerName,
    required this.onDismiss,
    this.onViewQuality,
    this.onViewEhs,
  });

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.45,
      minChildSize: 0.3,
      maxChildSize: 0.85,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            boxShadow: [
              BoxShadow(
                color: Color(0x22000000),
                blurRadius: 20,
                offset: Offset(0, -4),
              )
            ],
          ),
          child: Column(
            children: [
              // Drag handle + close button
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    // Drag handle (centered)
                    Expanded(
                      child: Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: const Color(0xFFD1D5DB),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: onDismiss,
                      child: const Icon(Icons.close_rounded,
                          size: 20, color: Color(0xFF6B7280)),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                  children: [
                    // ── Header ──
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                floor.floorName,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              Text(
                                towerName,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF6B7280),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Big progress circle
                        _ProgressCircle(pct: floor.progressPct),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // ── Progress bar ──
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: floor.progressPct / 100,
                        minHeight: 8,
                        backgroundColor: const Color(0xFFE5E7EB),
                        color: _progressBarColor(floor.progressPct),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // ── Activity stats ──
                    if (floor.totalActivities > 0) ...[
                      const Text(
                        'Activities',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: Color(0xFF374151),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _StatChip(
                            label: 'Done',
                            count: floor.completedActivities,
                            color: const Color(0xFF22C55E),
                            icon: Icons.check_circle_rounded,
                          ),
                          const SizedBox(width: 8),
                          _StatChip(
                            label: 'In Progress',
                            count: floor.inProgressActivities,
                            color: const Color(0xFF3B82F6),
                            icon: Icons.timelapse_rounded,
                          ),
                          const SizedBox(width: 8),
                          _StatChip(
                            label: 'Pending',
                            count: floor.pendingActivities,
                            color: const Color(0xFF9CA3AF),
                            icon: Icons.radio_button_unchecked_rounded,
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                    ] else
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          'No activities configured for this floor.',
                          style: TextStyle(
                            color: Colors.grey.shade500,
                            fontSize: 13,
                          ),
                        ),
                      ),

                    const Divider(height: 1),
                    const SizedBox(height: 16),

                    // ── Quality section ──
                    _IssueRow(
                      icon: Icons.verified_outlined,
                      iconColor: floor.openQualityObs > 0
                          ? const Color(0xFFF59E0B)
                          : const Color(0xFF22C55E),
                      title: floor.openQualityObs > 0
                          ? '${floor.openQualityObs} open quality observation${floor.openQualityObs > 1 ? 's' : ''}'
                          : 'No open quality observations',
                      subtitle: floor.pendingRfis > 0
                          ? '${floor.pendingRfis} RFI pending approval'
                          : floor.rejectedRfis > 0
                              ? '${floor.rejectedRfis} RFI rejected'
                              : null,
                      actionLabel:
                          floor.openQualityObs > 0 ? 'View' : null,
                      onAction: onViewQuality,
                    ),

                    const SizedBox(height: 12),

                    // ── EHS section ──
                    _IssueRow(
                      icon: Icons.health_and_safety_outlined,
                      iconColor: floor.openEhsObs > 0
                          ? const Color(0xFFF97316)
                          : const Color(0xFF22C55E),
                      title: floor.openEhsObs > 0
                          ? '${floor.openEhsObs} open EHS observation${floor.openEhsObs > 1 ? 's' : ''}'
                          : 'No EHS observations',
                      onAction: floor.openEhsObs > 0 ? onViewEhs : null,
                      actionLabel: floor.openEhsObs > 0 ? 'View' : null,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Color _progressBarColor(double pct) {
    if (pct >= 100) return const Color(0xFF22C55E);
    if (pct >= 56) return const Color(0xFF84CC16);
    if (pct >= 31) return const Color(0xFFF59E0B);
    return const Color(0xFF6B7280);
  }
}

// ─── Supporting private widgets ───────────────────────────────────────────────

class _ProgressCircle extends StatelessWidget {
  final double pct;
  const _ProgressCircle({required this.pct});

  @override
  Widget build(BuildContext context) {
    final color = pct >= 100
        ? const Color(0xFF22C55E)
        : pct >= 56
            ? const Color(0xFF84CC16)
            : pct >= 31
                ? const Color(0xFFF59E0B)
                : const Color(0xFF6B7280);
    return SizedBox(
      width: 56,
      height: 56,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(
            value: pct / 100,
            strokeWidth: 5,
            backgroundColor: const Color(0xFFE5E7EB),
            color: color,
          ),
          Text(
            '${pct.toStringAsFixed(0)}%',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final IconData icon;
  const _StatChip(
      {required this.label,
      required this.count,
      required this.color,
      required this.icon});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border:
              Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 4),
            Text(
              '$count',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: color),
            ),
            Text(label,
                style: const TextStyle(
                    fontSize: 9, color: Color(0xFF6B7280))),
          ],
        ),
      ),
    );
  }
}

class _IssueRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _IssueRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: iconColor),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 13, color: Color(0xFF374151))),
              if (subtitle != null)
                Text(subtitle!,
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFFF59E0B))),
            ],
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              minimumSize: Size.zero,
            ),
            child: Text(actionLabel!,
                style: const TextStyle(fontSize: 12)),
          ),
      ],
    );
  }
}
