import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

/// Tile for a single inspection checklist item.
/// Shows the criterion text, animated [Yes] / [N/A] toggle buttons,
/// and an optional remarks field.
/// [onStatusChanged] and [onRemarksChanged] update local BLoC state only.
class ChecklistItemTile extends StatefulWidget {
  final ChecklistItem item;
  final bool readOnly;
  final ValueChanged<ChecklistItemStatus?>? onStatusChanged;
  final ValueChanged<String>? onRemarksChanged;

  const ChecklistItemTile({
    super.key,
    required this.item,
    this.readOnly = false,
    this.onStatusChanged,
    this.onRemarksChanged,
  });

  @override
  State<ChecklistItemTile> createState() => _ChecklistItemTileState();
}

class _ChecklistItemTileState extends State<ChecklistItemTile> {
  late TextEditingController _remarksCtrl;

  @override
  void initState() {
    super.initState();
    _remarksCtrl = TextEditingController(text: widget.item.remarks ?? '');
  }

  @override
  void didUpdateWidget(ChecklistItemTile old) {
    super.didUpdateWidget(old);
    if (old.item.remarks != widget.item.remarks) {
      _remarksCtrl.text = widget.item.remarks ?? '';
    }
  }

  @override
  void dispose() {
    _remarksCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final item = widget.item;
    final status = item.itemStatus;

    // Show remarks field when N/A is selected (reason required)
    // or when remarks already exist.
    final showRemarksField = !widget.readOnly &&
        (status == ChecklistItemStatus.na ||
            (item.remarks?.isNotEmpty ?? false));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Criterion text
              Expanded(
                child: Text(
                  item.itemText,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Action buttons (editable) or read-only chip
              if (!widget.readOnly) ...[
                _StatusBtn(
                  label: 'Yes',
                  icon: Icons.check_rounded,
                  selected: status == ChecklistItemStatus.pass,
                  selectedColor: Colors.green.shade600,
                  onTap: () => widget.onStatusChanged?.call(
                    status == ChecklistItemStatus.pass
                        ? null
                        : ChecklistItemStatus.pass,
                  ),
                ),
                const SizedBox(width: 6),
                _StatusBtn(
                  label: 'N/A',
                  icon: Icons.remove_rounded,
                  selected: status == ChecklistItemStatus.na,
                  selectedColor: Colors.blueGrey.shade600,
                  onTap: () => widget.onStatusChanged?.call(
                    status == ChecklistItemStatus.na
                        ? null
                        : ChecklistItemStatus.na,
                  ),
                ),
              ] else
                _ReadOnlyStatusChip(status: status),
            ],
          ),
        ),

        // Remarks input (N/A selection or existing remarks)
        if (showRemarksField)
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 12, bottom: 8),
            child: TextField(
              controller: _remarksCtrl,
              readOnly: widget.readOnly,
              onChanged: widget.onRemarksChanged,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: status == ChecklistItemStatus.na
                    ? 'Reason for N/A…'
                    : 'Add remarks…',
                isDense: true,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              style: theme.textTheme.bodySmall,
            ),
          ),

        // Read-only remarks display
        if (widget.readOnly && (item.remarks?.isNotEmpty ?? false))
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 12, bottom: 8),
            child: Text(
              'Remarks: ${item.remarks}',
              style: theme.textTheme.bodySmall?.copyWith(
                fontStyle: FontStyle.italic,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ),

        Divider(
          height: 1,
          indent: 16,
          endIndent: 16,
          color: theme.dividerColor.withValues(alpha: 0.5),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Toggle button (editable mode)
// ---------------------------------------------------------------------------

class _StatusBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final Color selectedColor;
  final VoidCallback? onTap;

  const _StatusBtn({
    required this.label,
    required this.icon,
    required this.selected,
    required this.selectedColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final unselectedColor =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: selected
              ? selectedColor.withValues(alpha: 0.12)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: selected ? selectedColor : Theme.of(context).dividerColor,
            width: selected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: selected ? selectedColor : unselectedColor,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight:
                    selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? selectedColor : unselectedColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Read-only status chip
// ---------------------------------------------------------------------------

class _ReadOnlyStatusChip extends StatelessWidget {
  final ChecklistItemStatus? status;
  const _ReadOnlyStatusChip({this.status});

  @override
  Widget build(BuildContext context) {
    final Color color;
    final String label;
    final IconData icon;

    switch (status) {
      case ChecklistItemStatus.pass:
        color = Colors.green.shade600;
        label = 'Yes';
        icon = Icons.check_rounded;
      case ChecklistItemStatus.na:
        color = Colors.blueGrey.shade600;
        label = 'N/A';
        icon = Icons.remove_rounded;
      case null:
        color = Colors.grey.shade400;
        label = 'Pending';
        icon = Icons.radio_button_unchecked;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
