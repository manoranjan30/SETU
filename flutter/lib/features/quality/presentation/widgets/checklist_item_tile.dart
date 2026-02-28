import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

/// Tile for a single inspection checklist item.
/// Shows the check criterion, a checkbox, and an optional remarks field.
/// [onToggle] and [onRemarksChanged] update local BLoC state only.
class ChecklistItemTile extends StatefulWidget {
  final ChecklistItem item;
  final bool readOnly;
  final ValueChanged<bool>? onToggle;
  final ValueChanged<String>? onRemarksChanged;

  const ChecklistItemTile({
    super.key,
    required this.item,
    this.readOnly = false,
    this.onToggle,
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
    _remarksCtrl =
        TextEditingController(text: widget.item.remarks ?? '');
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Criterion row with checkbox
        InkWell(
          onTap: widget.readOnly || widget.onToggle == null
              ? null
              : () => widget.onToggle!(!item.isOk),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: item.isOk,
                  onChanged: widget.readOnly || widget.onToggle == null
                      ? null
                      : (v) => widget.onToggle!(v ?? false),
                  activeColor: Colors.green.shade600,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    item.itemText,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Remarks field (shown when item is NOT ok, or if remarks already exist)
        if (!widget.readOnly && (!item.isOk || (item.remarks?.isNotEmpty ?? false)))
          Padding(
            padding: const EdgeInsets.only(
                left: 56, right: 12, bottom: 8),
            child: TextField(
              controller: _remarksCtrl,
              readOnly: widget.readOnly,
              onChanged: widget.onRemarksChanged,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Add remarks…',
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              style: theme.textTheme.bodySmall,
            ),
          ),

        if (widget.readOnly && (item.remarks?.isNotEmpty ?? false))
          Padding(
            padding:
                const EdgeInsets.only(left: 56, right: 12, bottom: 8),
            child: Text(
              'Remarks: ${item.remarks}',
              style: theme.textTheme.bodySmall?.copyWith(
                fontStyle: FontStyle.italic,
                color:
                    theme.colorScheme.onSurface.withValues(alpha: 0.7),
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
