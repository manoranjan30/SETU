import 'package:flutter/material.dart';
import 'package:setu_mobile/shared/widgets/obs_status_badge.dart';
import 'package:setu_mobile/shared/widgets/severity_badge.dart';

/// Generic site observation card used by both Quality and EHS modules.
/// Completely stateless — all data comes through constructor params.
class SiteObsCard extends StatelessWidget {
  final String description;
  final String severity;
  final String status;
  final String? category;
  final IconData? categoryIcon;
  final String? locationLabel;
  final String raisedByName;
  final DateTime raisedAt;
  final int photoCount;
  final VoidCallback onTap;

  const SiteObsCard({
    super.key,
    required this.description,
    required this.severity,
    required this.status,
    this.category,
    this.categoryIcon,
    this.locationLabel,
    required this.raisedByName,
    required this.raisedAt,
    this.photoCount = 0,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final borderColor = SeverityBadge.colorFor(severity).withValues(alpha: 0.3);

    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: borderColor),
      ),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: severity badge + status badge
              Row(
                children: [
                  SeverityBadge(severity: severity),
                  const SizedBox(width: 6),
                  ObsStatusBadge(status: status),
                  const Spacer(),
                  if (photoCount > 0) ...[
                    Icon(Icons.photo_library_outlined,
                        size: 13,
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.4)),
                    const SizedBox(width: 3),
                    Text(
                      '$photoCount',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                  const SizedBox(width: 4),
                  Icon(Icons.chevron_right_rounded,
                      size: 18,
                      color:
                          theme.colorScheme.onSurface.withValues(alpha: 0.3)),
                ],
              ),
              const SizedBox(height: 8),

              // Description
              Text(
                description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),

              // Meta row: category, location, raised by
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  if (category != null)
                    _MetaChip(
                      icon: categoryIcon ?? Icons.label_outline_rounded,
                      text: category!,
                    ),
                  if (locationLabel != null)
                    _MetaChip(
                      icon: Icons.location_on_outlined,
                      text: locationLabel!,
                    ),
                  _MetaChip(
                    icon: Icons.person_outline_rounded,
                    text: raisedByName,
                  ),
                  _MetaChip(
                    icon: Icons.calendar_today_outlined,
                    text: _formatDate(raisedAt),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt.toLocal());
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String text;

  const _MetaChip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final color =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 3),
        Text(
          text,
          style: TextStyle(fontSize: 11, color: color),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
