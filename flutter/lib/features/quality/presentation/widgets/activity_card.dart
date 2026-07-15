import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/activity_status_badge.dart';

/// Card representing a single quality activity in the site-engineer flow.
/// Shows name, sequence, status badge, hold/witness point indicators,
/// multi-go / unit-wise progress chips, and observations.
class ActivityCard extends StatefulWidget {
  final ActivityRow row;
  final VoidCallback? onRaiseRfi;

  /// Called when the user taps "Raise GO X" in the multi-go progress section.
  /// [partNo] is the GO number to raise, [totalParts] is the total.
  final void Function(int partNo, int totalParts)? onRaisePart;

  /// Called when the user taps "+ Add GO" to expand the series.
  final VoidCallback? onExpandGo;

  /// Called when the user taps a unit chip or "Raise All" in unit-wise mode.
  /// [unitId] is the qualityUnitId, [unitName] is the display label.
  final void Function(int unitId, String unitName)? onRaiseUnit;

  /// Called when the user taps "View in Approvals" on a pending-observation
  /// activity. Passes the inspection that should be opened.
  final void Function(QualityInspection inspection)? onViewApproval;

  const ActivityCard({
    super.key,
    required this.row,
    this.onRaiseRfi,
    this.onRaisePart,
    this.onRaiseUnit,
    this.onViewApproval,
    this.onExpandGo,
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

                // Raise RFI button — only before any GO is raised.
                // Once allInspections is non-empty the multi-go / unit-wise
                // section handles further raises via "Add GO" chips.
                if (!locked &&
                    widget.onRaiseRfi != null &&
                    widget.row.allInspections.isEmpty) ...[
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
                // Show for any FLOOR-level activity that has at least one
                // raised inspection — whether single-GO or multi-GO.
                if (!locked &&
                    activity.applicabilityLevel != 'UNIT' &&
                    widget.row.allInspections.isNotEmpty)
                  _MultiGoProgress(
                    allInspections: widget.row.allInspections,
                    onRaisePart: widget.onRaisePart,
                    onExpandGo: widget.onExpandGo,
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
              ...observations.map((obs) => _InlineObservationRow(obs: obs)),

            // ── "View in Approvals" CTA when there are pending observations ─
            if (_obsExpanded &&
                pendingCount > 0 &&
                widget.onViewApproval != null &&
                widget.row.inspection != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 4, 10, 6),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        widget.onViewApproval!(widget.row.inspection!),
                    icon: const Icon(Icons.assignment_turned_in_outlined,
                        size: 16),
                    label: const Text('View in Approvals →'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.orange.shade800,
                      side: BorderSide(color: Colors.orange.shade400),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      textStyle: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ),

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

  const _InlineObservationRow({required this.obs});

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
  final VoidCallback? onExpandGo;

  const _MultiGoProgress({
    required this.allInspections,
    this.onRaisePart,
    this.onExpandGo,
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
          // Header row: label + "Add GO" button
          Row(
            children: [
              Icon(Icons.layers_outlined,
                  size: 13, color: Colors.blue.shade700),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'GO Progress ($raisedCount/$totalParts)',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.blue.shade700,
                  ),
                ),
              ),
              // "+ Add GO" expands the series total
              if (onExpandGo != null)
                GestureDetector(
                  onTap: onExpandGo,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade700,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, size: 11, color: Colors.white),
                        SizedBox(width: 3),
                        Text('Add GO',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            )),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          // GO chips
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: List.generate(totalParts, (i) {
              final partNo = i + 1;
              final matches = allInspections.where((insp) => insp.partNo == partNo);
              final matchInsp = matches.isEmpty ? null : matches.first;
              final isRaised = matchInsp != null;
              final goLabel = matchInsp?.goLabel ??
                  (matchInsp?.partLabel?.isNotEmpty == true
                      ? matchInsp!.partLabel!
                      : 'GO $partNo');

              // Status-aware chip colors
              Color chipColor;
              Color borderColor;
              IconData chipIcon;
              String chipText;

              if (!isRaised) {
                chipColor = Colors.white;
                borderColor = onRaisePart != null ? Colors.blue.shade400 : theme.dividerColor;
                chipIcon = Icons.add_circle_outline;
                chipText = 'Raise $goLabel';
              } else {
                final status = matchInsp.status;
                if (status == InspectionStatus.approved ||
                    status == InspectionStatus.provisionallyApproved) {
                  chipColor = Colors.amber.shade50;
                  borderColor = Colors.amber.shade400;
                  chipIcon = Icons.verified_outlined;
                  chipText = '$goLabel · Approved';
                } else if (status == InspectionStatus.rejected) {
                  chipColor = Colors.red.shade50;
                  borderColor = Colors.red.shade300;
                  chipIcon = Icons.cancel_outlined;
                  chipText = '$goLabel · Rejected';
                } else {
                  // pending / partiallyApproved / reversed
                  chipColor = Colors.green.shade50;
                  borderColor = Colors.green.shade300;
                  chipIcon = Icons.pending_outlined;
                  chipText = '$goLabel · RFI #${matchInsp.id}';
                }
              }

              return GestureDetector(
                onTap: (!isRaised && onRaisePart != null)
                    ? () => onRaisePart!(partNo, totalParts)
                    : null,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: chipColor,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: borderColor),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(chipIcon, size: 12,
                          color: !isRaised
                              ? (onRaisePart != null ? Colors.blue.shade700 : theme.disabledColor)
                              : borderColor),
                      const SizedBox(width: 3),
                      Text(chipText,
                          style: TextStyle(
                            fontSize: 11,
                            color: !isRaised
                                ? (onRaisePart != null ? Colors.blue.shade700 : theme.disabledColor)
                                : borderColor,
                            fontWeight: FontWeight.w500,
                          )),
                    ],
                  ),
                ),
              );
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
                    ? '${insp.unitName} · RFI #${insp.id}'
                    : 'Unit $unitId · RFI #${insp.id}';
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
