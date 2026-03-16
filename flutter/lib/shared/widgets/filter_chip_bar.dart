import 'package:flutter/material.dart';

/// A horizontally scrollable row of filter chips.
/// Supports single-select (severity filter) or multi-select depending on usage.
///
/// Usage:
/// ```dart
/// FilterChipBar(
///   options: const ['ALL', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'],
///   selected: _severityFilter ?? 'ALL',
///   onSelected: (val) => setState(() {
///     _severityFilter = val == 'ALL' ? null : val;
///     _load();
///   }),
///   colorFor: SeverityBadge.colorFor,
/// )
/// ```
class FilterChipBar extends StatelessWidget {
  final List<String> options;
  final String selected;
  final ValueChanged<String> onSelected;

  /// Optional color resolver — returns null for default primary color
  final Color? Function(String)? colorFor;

  const FilterChipBar({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
    this.colorFor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final option = options[i];
          final isActive = option == selected;
          final color = colorFor?.call(option) ?? theme.colorScheme.primary;

          return GestureDetector(
            onTap: () => onSelected(option),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isActive
                    ? color.withValues(alpha: 0.15)
                    : theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isActive
                      ? color.withValues(alpha: 0.6)
                      : theme.dividerColor,
                  width: isActive ? 1.5 : 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isActive) ...[
                    Icon(Icons.check_rounded, size: 13, color: color),
                    const SizedBox(width: 4),
                  ],
                  Text(
                    _label(option),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isActive
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: isActive
                          ? color
                          : theme.colorScheme.onSurface
                              .withValues(alpha: 0.65),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  String _label(String option) {
    switch (option) {
      case 'ALL':
        return 'All';
      case 'CRITICAL':
        return 'Critical';
      case 'MAJOR':
        return 'Major';
      case 'MINOR':
        return 'Minor';
      case 'INFO':
        return 'Info';
      default:
        return option.length > 8
            ? '${option[0]}${option.substring(1).toLowerCase()}'
            : option;
    }
  }
}
