import 'package:flutter/material.dart';

/// Colored pill that indicates observation severity.
/// Accepts DB enum values: 'INFO' | 'MINOR' | 'MAJOR' | 'CRITICAL'
class SeverityBadge extends StatelessWidget {
  final String severity;

  const SeverityBadge({super.key, required this.severity});

  @override
  Widget build(BuildContext context) {
    final color = _color(severity);
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
          Icon(_icon(severity), size: 11, color: color),
          const SizedBox(width: 4),
          Text(
            severity.toUpperCase(),
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

  static Color _color(String s) {
    switch (s.toUpperCase()) {
      case 'CRITICAL':
        return const Color(0xFFB91C1C); // red-700
      case 'MAJOR':
        return const Color(0xFFDC2626); // red-600
      case 'MINOR':
        return const Color(0xFFD97706); // amber-600
      case 'INFO':
        return const Color(0xFF16A34A); // green-600
      default:
        return Colors.grey;
    }
  }

  static IconData _icon(String s) {
    switch (s.toUpperCase()) {
      case 'CRITICAL':
        return Icons.crisis_alert_rounded;
      case 'MAJOR':
        return Icons.warning_rounded;
      case 'MINOR':
        return Icons.warning_amber_rounded;
      default:
        return Icons.info_outline_rounded;
    }
  }

  /// Returns color for use outside the widget (e.g. card borders)
  static Color colorFor(String severity) => _color(severity);
}
