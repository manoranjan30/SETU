import 'package:flutter/material.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/observation_rating_selector.dart';

/// Compact accordion card for a single activity observation.
///
/// Collapsed: one-row summary — status dot, observation text (1 line),
/// camera badge (if photos), action chip (if actionable), expand chevron.
/// Expanded: full detail with photos, rectification notes, action buttons.
class ObservationCard extends StatefulWidget {
  final ActivityObservation obs;

  /// Called by QC inspector to close a RECTIFIED observation.
  final VoidCallback? onClose;

  /// Called by site engineer to fix/rectify a PENDING observation.
  final VoidCallback? onRectify;

  /// Called to delete the observation (only passed if user has
  /// QUALITY.OBSERVATION.CREATE permission — enforced by the caller).
  final VoidCallback? onDelete;

  const ObservationCard({
    super.key,
    required this.obs,
    this.onClose,
    this.onRectify,
    this.onDelete,
  });

  @override
  State<ObservationCard> createState() => _ObservationCardState();
}

class _ObservationCardState extends State<ObservationCard> {
  bool _expanded = false;

  ActivityObservation get obs => widget.obs;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final Color statusColor;
    final String statusLabel;
    final IconData statusIcon;

    switch (obs.status) {
      case ObservationStatus.pending:
        statusColor = Colors.orange.shade700;
        statusLabel = 'Pending';
        statusIcon = Icons.pending_outlined;
      case ObservationStatus.rectified:
        statusColor = Colors.blue.shade700;
        statusLabel = 'Rectified';
        statusIcon = Icons.check_circle_outline;
      case ObservationStatus.closed:
        statusColor = Colors.green.shade700;
        statusLabel = 'Closed';
        statusIcon = Icons.verified_outlined;
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Collapsed header — always visible ────────────────────────────
          InkWell(
            borderRadius: _expanded
                ? const BorderRadius.vertical(top: Radius.circular(10))
                : BorderRadius.circular(10),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Row(children: [
                // Status dot
                Icon(statusIcon, size: 14, color: statusColor),
                const SizedBox(width: 6),
                // Observation text (1 line ellipsis)
                Expanded(
                  child: Text(
                    obs.observationText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                // Camera badge — tap does nothing extra (expand to see photos)
                if (obs.photos.isNotEmpty) ...[
                  Stack(clipBehavior: Clip.none, children: [
                    Icon(Icons.photo_camera_outlined, size: 14,
                        color: theme.colorScheme.onSurface.withValues(alpha: 0.45)),
                    if (obs.photos.length > 1)
                      Positioned(
                        top: -4,
                        right: -5,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade600,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text('${obs.photos.length}',
                              style: const TextStyle(fontSize: 8, color: Colors.white,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ),
                  ]),
                  const SizedBox(width: 6),
                ],
                // Compact status chip — only show label, saves space
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withValues(alpha: 0.35)),
                  ),
                  child: Text(statusLabel,
                      style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: statusColor)),
                ),
                const SizedBox(width: 4),
                Icon(
                  _expanded ? Icons.expand_less : Icons.expand_more,
                  size: 16,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ]),
            ),
          ),

          // ── Expanded body ─────────────────────────────────────────────────
          if (_expanded) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Badges row
                  Row(children: [
                    ObservationRatingBadge(
                      observationRating: obs.observationRating,
                      legacySeverity: obs.type,
                    ),
                    if (obs.ncrId != null) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Text('NCR #${obs.ncrId}',
                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700,
                                color: Colors.red.shade700)),
                      ),
                    ],
                    const Spacer(),
                    Text(
                      _formatDateTime(obs.createdAt),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                        fontSize: 10,
                      ),
                    ),
                  ]),

                  const SizedBox(height: 8),

                  // Full observation text
                  Text(obs.observationText, style: theme.textTheme.bodyMedium),
                  if (obs.raisedByName != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Raised by ${obs.raisedByName}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                  ],

                  // Observation photos
                  if (obs.photos.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    PhotoThumbnailStrip(photoUrls: obs.photos),
                  ],

                  // Rectification notes + evidence
                  if ((obs.closureText?.isNotEmpty ?? false) ||
                      obs.closureEvidence.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.blue.shade200),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.build_outlined, size: 14,
                              color: Colors.blue.shade700),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (obs.closureText?.isNotEmpty ?? false)
                                  Text(
                                    obs.closureText!,
                                    style: theme.textTheme.bodySmall
                                        ?.copyWith(color: Colors.blue.shade800),
                                  ),
                                if (obs.rectifiedAt != null) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    obs.rectifiedByName != null
                                        ? 'By ${obs.rectifiedByName} on ${_formatDateTime(obs.rectifiedAt!)}'
                                        : 'Rectified on ${_formatDateTime(obs.rectifiedAt!)}',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                        color: Colors.blue.shade600, fontSize: 11),
                                  ),
                                ],
                                if (obs.isClosed && obs.closedAt != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    obs.closedByName != null
                                        ? 'Closed by ${obs.closedByName} on ${_formatDateTime(obs.closedAt!)}'
                                        : 'Closed on ${_formatDateTime(obs.closedAt!)}',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                        color: Colors.green.shade700, fontSize: 11),
                                  ),
                                ],
                                if (obs.closureEvidence.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  PhotoThumbnailStrip(photoUrls: obs.closureEvidence),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Action buttons — compact row
                  if (obs.status == ObservationStatus.rectified ||
                      widget.onRectify != null ||
                      widget.onDelete != null) ...[
                    const SizedBox(height: 10),
                    Row(children: [
                      if (widget.onDelete != null)
                        IconButton(
                          onPressed: widget.onDelete,
                          icon: Icon(Icons.delete_outline, size: 18,
                              color: Colors.red.shade400),
                          tooltip: 'Delete observation',
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                        ),
                      const Spacer(),
                      if (widget.onRectify != null)
                        OutlinedButton.icon(
                          onPressed: widget.onRectify,
                          icon: const Icon(Icons.build_outlined, size: 14),
                          label: const Text('Mark as Rectified'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.orange.shade700,
                            side: BorderSide(color: Colors.orange.shade400),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            textStyle: const TextStyle(fontSize: 11),
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                      if (obs.status == ObservationStatus.rectified) ...[
                        if (widget.onRectify != null) const SizedBox(width: 8),
                        OutlinedButton.icon(
                          onPressed: widget.onClose,
                          icon: const Icon(Icons.verified_outlined, size: 14),
                          label: const Text('Mark as Closed'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.green.shade700,
                            side: BorderSide(color: Colors.green.shade400),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            textStyle: const TextStyle(fontSize: 11),
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                      ],
                    ]),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDateTime(DateTime dt) {
    final date = '${dt.day.toString().padLeft(2, '0')}/'
        '${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    final hour12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final period = dt.hour < 12 ? 'AM' : 'PM';
    final time = '$hour12:${dt.minute.toString().padLeft(2, '0')} $period';
    return '$date · $time';
  }
}
