import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/activity_status_badge.dart';

/// Card representing a single quality activity in the site-engineer flow.
/// Shows name, sequence, status badge, hold/witness point indicators,
/// multi-go / unit-wise progress chips, and observations.
class ActivityCard extends StatefulWidget {
  final ActivityRow row;
  final VoidCallback? onRaiseRfi;

  /// Called when the user taps Fix on a specific pending observation.
  final void Function(ActivityObservation obs)? onFixObservation;

  /// Called when the user taps "Raise Part X" in the multi-go progress section.
  /// [partNo] is the part number to raise, [totalParts] is the total.
  final void Function(int partNo, int totalParts)? onRaisePart;

  /// Called when the user taps a unit chip or "Raise All" in unit-wise mode.
  /// [unitId] is the qualityUnitId, [unitName] is the display label.
  final void Function(int unitId, String unitName)? onRaiseUnit;

  const ActivityCard({
    super.key,
    required this.row,
    this.onRaiseRfi,
    this.onFixObservation,
    this.onRaisePart,
    this.onRaiseUnit,
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

                // Raise RFI button (only for "ready" activities)
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

                // ── Multi-Go progress ──────────────────────────────────
                if (!locked &&
                    activity.applicabilityLevel != 'UNIT' &&
                    widget.row.allInspections.any((i) => i.totalParts > 1))
                  _MultiGoProgress(
                    allInspections: widget.row.allInspections,
                    onRaisePart: widget.onRaisePart,
                  ),

                // ── Unit-Wise progress ─────────────────────────────────
                if (!locked && activity.applicabilityLevel == 'UNIT')
                  _UnitWiseProgress(
                    allInspections: widget.row.allInspections,
                    floorUnits: widget.row.floorUnits,
                    onRaiseUnit: widget.onRaiseUnit,
                  ),
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

// ---------------------------------------------------------------------------
// Multi-Go progress section
// ---------------------------------------------------------------------------

/// Shows which parts of a multi-go RFI have been raised and buttons to raise
/// any remaining parts. Mirrors the web app's "Multi-Go Progress (X/N)" UI.
class _MultiGoProgress extends StatelessWidget {
  final List<QualityInspection> allInspections;
  final void Function(int partNo, int totalParts)? onRaisePart;

  const _MultiGoProgress({
    required this.allInspections,
    this.onRaisePart,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // Determine total parts from the maximum seen across all inspections.
    int totalParts = 1;
    for (final i in allInspections) {
      if (i.totalParts > totalParts) totalParts = i.totalParts;
    }

    // Collect already-raised part numbers.
    final raisedPartNos =
        allInspections.map((i) => i.partNo).toSet();
    final raisedCount = raisedPartNos.length;

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.blue.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header label
          Row(
            children: [
              Icon(Icons.layers_outlined,
                  size: 13, color: Colors.blue.shade700),
              const SizedBox(width: 4),
              Text(
                'Multi-Go Progress ($raisedCount/$totalParts)',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.blue.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Part chips
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: List.generate(totalParts, (i) {
              final partNo = i + 1;
              final isRaised = raisedPartNos.contains(partNo);
              if (isRaised) {
                // Already raised — show greyed label
                return Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.green.shade300),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_outline,
                          size: 12, color: Colors.green.shade700),
                      const SizedBox(width: 3),
                      Text(
                        'Part $partNo Raised',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.green.shade700,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                );
              } else {
                // Not yet raised — show action button
                return GestureDetector(
                  onTap: onRaisePart != null
                      ? () => onRaisePart!(partNo, totalParts)
                      : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: onRaisePart != null
                              ? Colors.blue.shade400
                              : theme.dividerColor),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add_circle_outline,
                            size: 12,
                            color: onRaisePart != null
                                ? Colors.blue.shade700
                                : theme.disabledColor),
                        const SizedBox(width: 3),
                        Text(
                          'Raise Part $partNo',
                          style: TextStyle(
                            fontSize: 11,
                            color: onRaisePart != null
                                ? Colors.blue.shade700
                                : theme.disabledColor,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }
            }),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Unit-Wise progress section
// ---------------------------------------------------------------------------

/// Shows which units have been raised and buttons to raise remaining units.
/// Mirrors the web app's "Unit Progress (X/N)" with per-unit chips.
class _UnitWiseProgress extends StatelessWidget {
  final List<QualityInspection> allInspections;
  final List<Map<String, dynamic>> floorUnits;
  final void Function(int unitId, String unitName)? onRaiseUnit;

  const _UnitWiseProgress({
    required this.allInspections,
    required this.floorUnits,
    this.onRaiseUnit,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // Map of unitId → inspection for already-raised units.
    final raisedMap = <int, QualityInspection>{};
    for (final i in allInspections) {
      if (i.qualityUnitId != null) {
        raisedMap.putIfAbsent(i.qualityUnitId!, () => i);
      }
    }

    final totalCount =
        floorUnits.isNotEmpty ? floorUnits.length : raisedMap.length;
    final raisedCount = raisedMap.length;

    // Units not yet raised
    final pendingUnits = floorUnits
        .where((u) => !raisedMap.containsKey(u['id'] as int))
        .toList();

    // Nothing to show if no inspections and no floor units loaded
    if (raisedCount == 0 && floorUnits.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.purple.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.purple.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(Icons.grid_view_outlined,
                  size: 13, color: Colors.purple.shade700),
              const SizedBox(width: 4),
              Text(
                'Unit Progress ($raisedCount/$totalCount)',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.purple.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Unit chips
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              // Already-raised units
              ...raisedMap.entries.map((e) {
                final unitId = e.key;
                final insp = e.value;
                final label = insp.unitName?.isNotEmpty == true
                    ? insp.unitName!
                    : 'Unit $unitId';
                return Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.green.shade300),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_outline,
                          size: 12, color: Colors.green.shade700),
                      const SizedBox(width: 3),
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.green.shade700,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                );
              }),
              // Pending units (only when floor structure loaded)
              ...pendingUnits.map((u) {
                final unitId = u['id'] as int;
                final unitName =
                    u['name'] as String? ?? 'Unit $unitId';
                return GestureDetector(
                  onTap: onRaiseUnit != null
                      ? () => onRaiseUnit!(unitId, unitName)
                      : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: onRaiseUnit != null
                              ? Colors.purple.shade400
                              : theme.dividerColor),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add_circle_outline,
                            size: 12,
                            color: onRaiseUnit != null
                                ? Colors.purple.shade700
                                : theme.disabledColor),
                        const SizedBox(width: 3),
                        Text(
                          'Raise $unitName',
                          style: TextStyle(
                            fontSize: 11,
                            color: onRaiseUnit != null
                                ? Colors.purple.shade700
                                : theme.disabledColor,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ),
          // "Raise All Pending" shortcut when more than one unit is pending
          if (pendingUnits.length > 1 && onRaiseUnit != null) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  for (final u in pendingUnits) {
                    onRaiseUnit!(
                      u['id'] as int,
                      u['name'] as String? ?? 'Unit ${u['id']}',
                    );
                  }
                },
                icon: const Icon(Icons.playlist_add, size: 14),
                label: Text('Raise All Pending (${pendingUnits.length})'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.purple.shade700,
                  side: BorderSide(color: Colors.purple.shade300),
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  textStyle: const TextStyle(fontSize: 11),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
