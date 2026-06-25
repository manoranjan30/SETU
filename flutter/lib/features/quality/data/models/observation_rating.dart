import 'package:flutter/material.dart';

/// Quality-impact classification for Site and Checklist observations.
///
/// Mirrors the backend's `QualityObservationRating` enum exactly
/// (`backend/src/quality/observation-rating.ts`). The backend derives the
/// legacy `severity`/`type` fields from this rating and auto-creates an NCR
/// when the rating is [critical] — mobile only ever needs to send
/// [apiValue], never a separately-computed severity.
enum QualityObservationRating {
  ofi,
  minor,
  moderate,
  major,
  critical;

  String get apiValue => switch (this) {
        QualityObservationRating.ofi => 'OFI',
        QualityObservationRating.minor => 'MINOR',
        QualityObservationRating.moderate => 'MODERATE',
        QualityObservationRating.major => 'MAJOR',
        QualityObservationRating.critical => 'CRITICAL',
      };

  /// Short chip label, matching the backend's `ratingLabel()` exactly.
  String get label => switch (this) {
        QualityObservationRating.ofi => 'Opportunity for Improvement (OFI)',
        QualityObservationRating.minor => 'Minor (Mi)',
        QualityObservationRating.moderate => 'Moderate (Mo)',
        QualityObservationRating.major => 'Major (Ma)',
        QualityObservationRating.critical => 'Critical (C)',
      };

  /// Compact label for badges/lists where space is tight.
  String get shortLabel => switch (this) {
        QualityObservationRating.ofi => 'OFI',
        QualityObservationRating.minor => 'Minor',
        QualityObservationRating.moderate => 'Moderate',
        QualityObservationRating.major => 'Major',
        QualityObservationRating.critical => 'Critical',
      };

  /// Full description shown below the selected chip and in the info tooltip.
  String get description => switch (this) {
        QualityObservationRating.ofi =>
          'The observation would not affect finished product quality but '
              'provides scope for improvement.',
        QualityObservationRating.minor =>
          'The observation would not affect finished product quality or '
              'achievement of the quality system. Requirements would still '
              'be achieved.',
        QualityObservationRating.moderate =>
          'The observation may affect finished product quality, cause '
              'delays, or fail a quality process, while important '
              'requirements would still be met.',
        QualityObservationRating.major =>
          'The observation would fail one or more quality-system processes '
              'and may affect finished product quality. Secondary '
              'requirements may not be achieved.',
        QualityObservationRating.critical =>
          'The observation would fail the quality system and affect '
              'finished product quality or minimum acceptable requirements. '
              'It is automatically registered as an NCR.',
      };

  Color get color => switch (this) {
        QualityObservationRating.ofi => const Color(0xFF16A34A), // green-600
        QualityObservationRating.minor => const Color(0xFFD97706), // amber-600
        QualityObservationRating.moderate => const Color(0xFFEA580C), // orange-600
        QualityObservationRating.major => const Color(0xFFDC2626), // red-600
        QualityObservationRating.critical => const Color(0xFFB91C1C), // red-700
      };

  IconData get icon => switch (this) {
        QualityObservationRating.ofi => Icons.lightbulb_outline_rounded,
        QualityObservationRating.minor => Icons.info_outline_rounded,
        QualityObservationRating.moderate => Icons.warning_amber_rounded,
        QualityObservationRating.major => Icons.warning_rounded,
        QualityObservationRating.critical => Icons.crisis_alert_rounded,
      };

  bool get isCritical => this == QualityObservationRating.critical;

  /// Parses the backend's rating string, with the same aliases the backend
  /// accepts (`INFO`→OFI, `MI`→MINOR, `MO`→MODERATE, `MA`→MAJOR, `C`→CRITICAL),
  /// plus legacy 3/4-value severity strings for records raised before this
  /// rating system existed (`MINOR`/`MAJOR`/`CRITICAL` pass through directly;
  /// legacy `INFO` maps to OFI). Returns null for an empty/unrecognized value
  /// so callers can fall back to displaying the legacy severity instead.
  static QualityObservationRating? fromApiValue(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    switch (value.trim().toUpperCase().replaceAll(RegExp(r'\s+'), '_')) {
      case 'OFI':
      case 'INFO':
      case 'OPPORTUNITY_FOR_IMPROVEMENT':
        return QualityObservationRating.ofi;
      case 'MINOR':
      case 'MI':
        return QualityObservationRating.minor;
      case 'MODERATE':
      case 'MO':
        return QualityObservationRating.moderate;
      case 'MAJOR':
      case 'MA':
        return QualityObservationRating.major;
      case 'CRITICAL':
      case 'C':
        return QualityObservationRating.critical;
      default:
        return null;
    }
  }

  /// Mirrors the backend's `ratingToSiteSeverity()` mapping, for the rare
  /// case mobile needs to populate the legacy `severity` field itself
  /// (the backend derives it automatically from `observationRating` when
  /// that field is present, so this is a defensive fallback, not the
  /// primary path).
  String get legacySiteSeverity => switch (this) {
        QualityObservationRating.ofi => 'INFO',
        QualityObservationRating.minor => 'MINOR',
        QualityObservationRating.moderate => 'MAJOR',
        QualityObservationRating.major => 'MAJOR',
        QualityObservationRating.critical => 'CRITICAL',
      };
}

const List<QualityObservationRating> qualityObservationRatings = [
  QualityObservationRating.ofi,
  QualityObservationRating.minor,
  QualityObservationRating.moderate,
  QualityObservationRating.major,
  QualityObservationRating.critical,
];
