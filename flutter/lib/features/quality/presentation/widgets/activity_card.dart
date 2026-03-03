import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/activity_status_badge.dart';

/// Card representing a single quality activity in the site-engineer flow.
/// Shows name, sequence, status badge, hold/witness point indicators,
/// and an expandable inline observations list with per-observation Fix buttons.
class ActivityCard extends StatefulWidget {
  final ActivityRow row;
  final VoidCallback? onRaiseRfi;
  /// Called when the user taps Fix on a specific pending observation.
  final void Function(ActivityObservation obs)? onFixObservation;

  const ActivityCard({
    super.key,
    required this.row,
    this.onRaiseRfi,
    this.onFixObservation,
  });

  @override
  State<ActivityCard> createState() => _ActivityCardState();
}

class _ActivityCardState extends State<ActivityCard> {
  late bool _obsExpanded;

  @override
  void initState() {
    super.initState();
    // Auto-expand when there are pending observations so the user notices them.
    _obsExpanded =
        widget.row.observations.any((o) => o.status == ObservationStatus.pending);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final activity = widget.row.activity;
    final status = widget.row.displayStatus;
    final observations = widget.row.observations;
    final locked = status == ActivityDisplayStatus.locked;

    final pendingCount =
        observations.where((o) => o.status == ObservationStatus.pending).length;

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Main content ────────────────────────────────────────────────
          Padding(
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
                              ? theme.colorScheme.onSurface
                                  .withValues(alpha: 0.4)
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
                              ? theme.colorScheme.onSurface
                                  .withValues(alpha: 0.4)
                              : null,
                        ),
                      ),
                    ),
                    ActivityStatusBadge(status: status),
                  ],
                ),

                // Hold/Witness chips
                if (activity.holdPoint || activity.witnessPoint) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const SizedBox(width: 38),
                      if (activity.holdPoint)
                        _PointChip(
                            label: 'Hold Point',
                            color: Colors.red.shade700),
                      if (activity.holdPoint && activity.witnessPoint)
                        const SizedBox(width: 6),
                      if (activity.witnessPoint)
                        _PointChip(
                            label: 'Witness Point',
                            color: Colors.orange.shade700),
                    ],
                  ),
                ],

                // Raise RFI button
                if (!locked && widget.onRaiseRfi != null) ...[
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton.icon(
                      onPressed: widget.onRaiseRfi,
                      icon: const Icon(Icons.add_task, size: 16),
                      label: const Text('Raise RFI'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        textStyle: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),

          // ── Observations toggle row ──────────────────────────────────────
          if (observations.isNotEmpty) ...[
            Divider(
                height: 1,
                color: theme.dividerColor.withValues(alpha: 0.5)),
            InkWell(
              onTap: () => setState(() => _obsExpanded = !_obsExpanded),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.warning_amber_outlined,
                      size: 16,
                      color: pendingCount > 0
                          ? Colors.orange.shade700
                          : Colors.green.shade700,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      pendingCount > 0
                          ? '$pendingCount pending observation${pendingCount > 1 ? 's' : ''}'
                          : '${observations.length} observation${observations.length > 1 ? 's' : ''} — all resolved',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: pendingCount > 0
                            ? Colors.orange.shade700
                            : Colors.green.shade700,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Icon(
                      _obsExpanded
                          ? Icons.expand_less
                          : Icons.expand_more,
                      size: 18,
                      color: theme.colorScheme.onSurface
                          .withValues(alpha: 0.5),
                    ),
                  ],
                ),
              ),
            ),

            // ── Inline observation list ────────────────────────────────────
            if (_obsExpanded)
              ...observations.map((obs) => _InlineObservationRow(
                    obs: obs,
                    onFix: obs.status == ObservationStatus.pending &&
                            widget.onFixObservation != null
                        ? () => widget.onFixObservation!(obs)
                        : null,
                  )),

            const SizedBox(height: 4),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Compact inline observation row
// ---------------------------------------------------------------------------

class _InlineObservationRow extends StatelessWidget {
  final ActivityObservation obs;
  final VoidCallback? onFix;

  const _InlineObservationRow({required this.obs, this.onFix});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColor = obs.status.color;
    final statusLabel = obs.status.label;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: statusColor.withValues(alpha: 0.25)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Status dot
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: statusColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                // Type chip
                if (obs.type.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.secondaryContainer,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      obs.type,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: theme.colorScheme.onSecondaryContainer,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                ],
                // Status label
                Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
                const Spacer(),
                // Date
                Text(
                  '${obs.createdAt.day}/${obs.createdAt.month}/${obs.createdAt.year}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface
                        .withValues(alpha: 0.45),
                    fontSize: 10,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            // Observation text
            Text(
              obs.observationText,
              style: theme.textTheme.bodySmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            // Fix button for pending observations
            if (onFix != null) ...[
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton.icon(
                  onPressed: onFix,
                  icon: const Icon(Icons.build_outlined, size: 14),
                  label: const Text('Fix'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.orange.shade700,
                    side: BorderSide(color: Colors.orange.shade400),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    textStyle: const TextStyle(fontSize: 11),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------

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
