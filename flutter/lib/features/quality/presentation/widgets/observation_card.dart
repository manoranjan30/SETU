import 'package:flutter/material.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

/// Card showing a single activity observation with its status badge
/// and optional action buttons (Close / View Rectification).
class ObservationCard extends StatelessWidget {
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
        statusLabel = 'Rectified ✓';
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
        side: BorderSide(
          color: statusColor.withValues(alpha: 0.3),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status badge + type row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: statusColor.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 12, color: statusColor),
                      const SizedBox(width: 4),
                      Text(
                        statusLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                    ],
                  ),
                ),
                if (obs.type.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.secondaryContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      obs.type,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color:
                            theme.colorScheme.onSecondaryContainer,
                      ),
                    ),
                  ),
                ],
                const Spacer(),
                Text(
                    _formatDate(obs.createdAt),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface
                          .withValues(alpha: 0.5),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 8),

            // Observation text
            Text(
              obs.observationText,
              style: theme.textTheme.bodyMedium,
            ),

            // Observation photos
            if (obs.photos.isNotEmpty) ...[
              const SizedBox(height: 8),
              PhotoThumbnailStrip(photoUrls: obs.photos),
            ],

            // Rectification notes + evidence photos (show when either exists)
            if ((obs.closureText?.isNotEmpty ?? false) ||
                obs.closureEvidence.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                      color: Colors.blue.shade200),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.build_outlined,
                        size: 14, color: Colors.blue.shade700),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (obs.closureText?.isNotEmpty ?? false)
                            Text(
                              obs.closureText!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: Colors.blue.shade800,
                              ),
                            ),
                          if (obs.closureEvidence.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            PhotoThumbnailStrip(
                                photoUrls: obs.closureEvidence),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Full-width Close button for RECTIFIED observations
            if (obs.status == ObservationStatus.rectified) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: onClose,
                  icon: const Icon(Icons.verified_outlined, size: 16),
                  label: const Text('Close Observation'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],

            // Delete / Fix action row
            if (onRectify != null || onDelete != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  if (onDelete != null)
                    IconButton(
                      onPressed: onDelete,
                      icon: Icon(Icons.delete_outline,
                          size: 18, color: Colors.red.shade400),
                      tooltip: 'Delete observation',
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                    ),
                  const Spacer(),
                  if (onRectify != null)
                    OutlinedButton.icon(
                      onPressed: onRectify,
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
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}
