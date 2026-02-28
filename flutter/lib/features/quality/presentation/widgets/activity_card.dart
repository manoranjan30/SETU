import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/activity_status_badge.dart';

/// Card representing a single quality activity in the site-engineer flow.
/// Shows name, sequence, status badge, hold/witness point indicators.
/// [onRaiseRfi] is null when the activity is not eligible for RFI.
/// [onFixObservation] is null when there are no pending observations.
class ActivityCard extends StatelessWidget {
  final ActivityRow row;
  final VoidCallback? onRaiseRfi;
  final VoidCallback? onFixObservation;

  const ActivityCard({
    super.key,
    required this.row,
    this.onRaiseRfi,
    this.onFixObservation,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final activity = row.activity;
    final status = row.displayStatus;
    final bool locked = status == ActivityDisplayStatus.locked;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      elevation: locked ? 0 : 2,
      color: locked ? theme.colorScheme.surfaceContainerHighest : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: locked
            ? BorderSide(color: theme.dividerColor)
            : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: locked
                        ? theme.colorScheme.surfaceContainerHighest
                        : theme.colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${activity.sequence}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: locked
                          ? theme.colorScheme.onSurface.withValues(alpha: 0.4)
                          : theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    activity.activityName,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: locked
                          ? theme.colorScheme.onSurface.withValues(alpha: 0.4)
                          : null,
                    ),
                  ),
                ),
                ActivityStatusBadge(status: status),
              ],
            ),

            // Hold/Witness indicators
            if (activity.holdPoint || activity.witnessPoint) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const SizedBox(width: 38),
                  if (activity.holdPoint)
                    _PointChip(
                        label: 'Hold Point', color: Colors.red.shade700),
                  if (activity.holdPoint && activity.witnessPoint)
                    const SizedBox(width: 6),
                  if (activity.witnessPoint)
                    _PointChip(
                        label: 'Witness Point',
                        color: Colors.orange.shade700),
                ],
              ),
            ],

            // Action buttons
            if (!locked) ...[
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (onFixObservation != null)
                    OutlinedButton.icon(
                      onPressed: onFixObservation,
                      icon: const Icon(Icons.build_outlined, size: 16),
                      label: const Text('Fix Observation'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.orange.shade700,
                        side: BorderSide(color: Colors.orange.shade400),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        textStyle: const TextStyle(fontSize: 12),
                      ),
                    ),
                  if (onFixObservation != null && onRaiseRfi != null)
                    const SizedBox(width: 8),
                  if (onRaiseRfi != null)
                    ElevatedButton.icon(
                      onPressed: onRaiseRfi,
                      icon: const Icon(Icons.add_task, size: 16),
                      label: const Text('Raise RFI'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        textStyle: const TextStyle(fontSize: 12),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PointChip extends StatelessWidget {
  final String label;
  final Color color;
  const _PointChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
