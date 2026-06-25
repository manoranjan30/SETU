import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/observation_rating.dart';

/// Five-option observation rating selector — shared by Site Observation and
/// Checklist Observation raise flows. Shows the description of the
/// currently-selected rating below the chips, an info tooltip per option,
/// and a prominent warning when [QualityObservationRating.critical] is
/// selected (since that automatically registers an NCR server-side).
class ObservationRatingSelector extends StatelessWidget {
  final QualityObservationRating? value;
  final ValueChanged<QualityObservationRating> onChanged;
  final String label;

  const ObservationRatingSelector({
    super.key,
    required this.value,
    required this.onChanged,
    this.label = 'Observation Rating',
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: qualityObservationRatings.map((rating) {
            final selected = value == rating;
            return Tooltip(
              message: rating.description,
              triggerMode: TooltipTriggerMode.tap,
              child: ChoiceChip(
                avatar: Icon(rating.icon, size: 14, color: selected ? Colors.white : rating.color),
                label: Text(rating.shortLabel, style: const TextStyle(fontSize: 12)),
                selected: selected,
                selectedColor: rating.color,
                labelStyle: TextStyle(color: selected ? Colors.white : null),
                onSelected: (_) => onChanged(rating),
              ),
            );
          }).toList(),
        ),
        if (value != null) ...[
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Text(value!.description,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ),
        ],
        if (value?.isCritical == true) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.crisis_alert_rounded, size: 16, color: Colors.red.shade700),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Critical observations automatically create a Non-Conformance '
                    'Report (NCR) — no separate NCR submission is needed.',
                    style: TextStyle(fontSize: 11, color: Colors.red.shade800, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Compact badge for observation lists — shows the rating when available,
/// falling back to the legacy severity string for older records raised
/// before this rating system existed (keeps old data readable instead of
/// showing a blank/unknown badge).
class ObservationRatingBadge extends StatelessWidget {
  final String? observationRating;
  final String? legacySeverity;

  const ObservationRatingBadge({
    super.key,
    this.observationRating,
    this.legacySeverity,
  });

  @override
  Widget build(BuildContext context) {
    final rating = QualityObservationRating.fromApiValue(observationRating) ??
        QualityObservationRating.fromApiValue(legacySeverity);
    final label = rating?.shortLabel ?? legacySeverity ?? 'Unknown';
    final color = rating?.color ?? Colors.grey;
    final icon = rating?.icon ?? Icons.info_outline_rounded;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
