import 'package:flutter/material.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_view_mode.dart';

/// Segmented 3-button toggle for switching between Progress / Quality / EHS views.
/// Used in the TowerLensPage AppBar actions row.
class ViewModeSwitcher extends StatelessWidget {
  final TowerViewMode activeMode;
  final ValueChanged<TowerViewMode> onChanged;

  const ViewModeSwitcher({
    super.key,
    required this.activeMode,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 32,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: TowerViewMode.values.map((mode) {
          final isActive = mode == activeMode;
          return GestureDetector(
            onTap: () => onChanged(mode),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isActive
                    ? Colors.white.withValues(alpha: 0.9)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(7),
              ),
              child: Text(
                mode.label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight:
                      isActive ? FontWeight.w700 : FontWeight.w500,
                  color: isActive
                      ? const Color(0xFF1D4ED8)
                      : Colors.white.withValues(alpha: 0.85),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
