import 'package:flutter/material.dart';

/// Colored pill showing observation lifecycle status.
/// Accepts: 'open' | 'rectified' | 'closed'
class ObsStatusBadge extends StatelessWidget {
  final String status;

  const ObsStatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final color = colorFor(status);
    final icon = _icon(status);
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
            _label(status),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  static Color colorFor(String s) {
    switch (s.toLowerCase()) {
      case 'open':
        return const Color(0xFFDC2626);
      case 'rectified':
        return const Color(0xFF2563EB);
      case 'closed':
        return const Color(0xFF16A34A);
      default:
        return Colors.grey;
    }
  }

  static String _label(String s) {
    switch (s.toLowerCase()) {
      case 'open':
        return 'OPEN';
      case 'rectified':
        return 'RECTIFIED';
      case 'closed':
        return 'CLOSED';
      default:
        return s.toUpperCase();
    }
  }

  static IconData _icon(String s) {
    switch (s.toLowerCase()) {
      case 'open':
        return Icons.radio_button_checked_rounded;
      case 'rectified':
        return Icons.build_circle_outlined;
      case 'closed':
        return Icons.check_circle_rounded;
      default:
        return Icons.help_outline;
    }
  }
}
