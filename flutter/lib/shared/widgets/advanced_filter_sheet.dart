import 'package:flutter/material.dart';

/// Filter options model returned by [AdvancedFilterSheet.show].
class ObsFilterOptions {
  final String? statusFilter;   // 'OPEN' | 'RECTIFIED' | 'CLOSED' | null = all
  final String? severityFilter; // 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO' | null = all
  final String sortOrder;       // 'NEWEST' | 'OLDEST' | 'SEVERITY'

  const ObsFilterOptions({
    this.statusFilter,
    this.severityFilter,
    this.sortOrder = 'NEWEST',
  });

  ObsFilterOptions copyWith({
    Object? statusFilter = _sentinel,
    Object? severityFilter = _sentinel,
    String? sortOrder,
  }) {
    return ObsFilterOptions(
      statusFilter: statusFilter == _sentinel
          ? this.statusFilter
          : statusFilter as String?,
      severityFilter: severityFilter == _sentinel
          ? this.severityFilter
          : severityFilter as String?,
      sortOrder: sortOrder ?? this.sortOrder,
    );
  }

  bool get isDefault =>
      statusFilter == null && severityFilter == null && sortOrder == 'NEWEST';

  int get activeCount {
    int count = 0;
    if (statusFilter != null) count++;
    if (severityFilter != null) count++;
    if (sortOrder != 'NEWEST') count++;
    return count;
  }
}

const _sentinel = Object();

/// Bottom sheet for configuring observation list filters.
/// Returns the updated [ObsFilterOptions] or null if dismissed.
class AdvancedFilterSheet extends StatefulWidget {
  final ObsFilterOptions initial;

  const AdvancedFilterSheet({super.key, required this.initial});

  static Future<ObsFilterOptions?> show(
    BuildContext context, {
    required ObsFilterOptions initial,
  }) {
    return showModalBottomSheet<ObsFilterOptions>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => AdvancedFilterSheet(initial: initial),
    );
  }

  @override
  State<AdvancedFilterSheet> createState() => _AdvancedFilterSheetState();
}

class _AdvancedFilterSheetState extends State<AdvancedFilterSheet> {
  late ObsFilterOptions _options;

  @override
  void initState() {
    super.initState();
    _options = widget.initial;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 4),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.dividerColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Header
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                children: [
                  const Text(
                    'Filter',
                    style: TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  if (!_options.isDefault)
                    TextButton(
                      onPressed: () => setState(() => _options =
                          const ObsFilterOptions()),
                      child: const Text('Reset all'),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),

            // ── Status ────────────────────────────────────────────────────
            _Section(
              title: 'STATUS',
              child: Wrap(
                spacing: 8,
                children: [
                  null, 'OPEN', 'RECTIFIED', 'CLOSED'
                ].map((s) {
                  final label = s == null ? 'All' : _capitalize(s);
                  final active = _options.statusFilter == s;
                  return ChoiceChip(
                    label: Text(label),
                    selected: active,
                    onSelected: (_) => setState(
                        () => _options = _options.copyWith(statusFilter: s)),
                    selectedColor: theme.colorScheme.primary
                        .withValues(alpha: 0.15),
                    labelStyle: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          active ? FontWeight.w600 : FontWeight.w500,
                      color: active
                          ? theme.colorScheme.primary
                          : theme.colorScheme.onSurface
                              .withValues(alpha: 0.7),
                    ),
                  );
                }).toList(),
              ),
            ),

            // ── Severity ──────────────────────────────────────────────────
            _Section(
              title: 'SEVERITY',
              child: Wrap(
                spacing: 8,
                children: [
                  null, 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'
                ].map((s) {
                  final label = s == null ? 'All' : _capitalize(s);
                  final active = _options.severityFilter == s;
                  final color = _severityColor(s);
                  return ChoiceChip(
                    label: Text(label),
                    selected: active,
                    onSelected: (_) => setState(
                        () => _options =
                            _options.copyWith(severityFilter: s)),
                    selectedColor: color.withValues(alpha: 0.15),
                    labelStyle: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          active ? FontWeight.w600 : FontWeight.w500,
                      color: active
                          ? color
                          : Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.7),
                    ),
                  );
                }).toList(),
              ),
            ),

            // ── Sort ──────────────────────────────────────────────────────
            _Section(
              title: 'SORT BY',
              child: Wrap(
                spacing: 8,
                children: [
                  ('NEWEST', 'Newest first'),
                  ('OLDEST', 'Oldest first'),
                  ('SEVERITY', 'By severity'),
                ].map((pair) {
                  final active = _options.sortOrder == pair.$1;
                  return ChoiceChip(
                    label: Text(pair.$2),
                    selected: active,
                    onSelected: (_) => setState(() =>
                        _options = _options.copyWith(sortOrder: pair.$1)),
                    selectedColor: theme.colorScheme.primary
                        .withValues(alpha: 0.15),
                    labelStyle: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          active ? FontWeight.w600 : FontWeight.w500,
                      color: active
                          ? theme.colorScheme.primary
                          : theme.colorScheme.onSurface
                              .withValues(alpha: 0.7),
                    ),
                  );
                }).toList(),
              ),
            ),

            const SizedBox(height: 8),
            const Divider(height: 1),

            // ── Action buttons ────────────────────────────────────────────
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: () =>
                          Navigator.of(context).pop(_options),
                      child: Text(
                        _options.isDefault
                            ? 'Apply'
                            : 'Apply (${_options.activeCount})',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _capitalize(String s) =>
      s[0] + s.substring(1).toLowerCase();

  Color _severityColor(String? s) {
    switch (s) {
      case 'CRITICAL':
        return const Color(0xFFDC2626);
      case 'MAJOR':
        return const Color(0xFFEA580C);
      case 'MINOR':
        return const Color(0xFFD97706);
      case 'INFO':
        return const Color(0xFF2563EB);
      default:
        return const Color(0xFF6B7280);
    }
  }
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;

  const _Section({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.45),
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}
