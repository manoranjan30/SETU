import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/planning/data/models/phase2_models.dart';
import 'package:setu_mobile/injection_container.dart';

/// Shows a search-and-select bottom sheet listing both internal team members
/// and vendor users for a project. Never exposes raw user IDs to the user.
class AssigneePicker extends StatefulWidget {
  final int projectId;
  final AssigneeOption? selected;
  final ValueChanged<AssigneeOption?> onChanged;

  const AssigneePicker({
    super.key,
    required this.projectId,
    this.selected,
    required this.onChanged,
  });

  @override
  State<AssigneePicker> createState() => _AssigneePickerState();
}

class _AssigneePickerState extends State<AssigneePicker> {
  List<AssigneeOption> _options = [];
  List<AssigneeOption> _filtered = [];
  bool _loading = true;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _searchCtrl.addListener(() {
      final q = _searchCtrl.text.toLowerCase();
      setState(() => _filtered = q.isEmpty
          ? _options
          : _options.where((o) => o.label.toLowerCase().contains(q) ||
              (o.company?.toLowerCase().contains(q) ?? false) ||
              (o.designation?.toLowerCase().contains(q) ?? false)).toList());
    });
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final raw = await sl<SetuApiClient>().getAssigneeOptions(widget.projectId);
      final options = raw.map((e) => AssigneeOption.fromJson(e as Map<String, dynamic>)).toList();
      if (mounted) setState(() { _options = options; _filtered = options; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Inline display (compact trigger)
        InkWell(
          onTap: () => _showPicker(context),
          child: InputDecorator(
            decoration: const InputDecoration(
              labelText: 'Assigned To',
              border: OutlineInputBorder(),
              isDense: true,
              suffixIcon: Icon(Icons.people_outline, size: 18),
            ),
            child: Text(
              widget.selected?.label ?? 'Select assignee',
              style: TextStyle(
                color: widget.selected == null ? Colors.grey.shade500 : null,
                fontSize: 13,
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _showPicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => _AssigneePickerSheet(
        options: _filtered,
        allOptions: _options,
        loading: _loading,
        searchCtrl: _searchCtrl,
        selected: widget.selected,
        onSelect: (option) {
          widget.onChanged(option);
          Navigator.of(ctx).pop();
        },
        onClear: () {
          widget.onChanged(null);
          Navigator.of(ctx).pop();
        },
      ),
    );
  }
}

class _AssigneePickerSheet extends StatelessWidget {
  final List<AssigneeOption> options;
  final List<AssigneeOption> allOptions;
  final bool loading;
  final TextEditingController searchCtrl;
  final AssigneeOption? selected;
  final ValueChanged<AssigneeOption> onSelect;
  final VoidCallback onClear;

  const _AssigneePickerSheet({
    required this.options, required this.allOptions, required this.loading,
    required this.searchCtrl, required this.selected,
    required this.onSelect, required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      expand: false,
      builder: (_, scrollCtrl) => Column(children: [
        Center(child: Container(
          margin: const EdgeInsets.only(top: 12, bottom: 8),
          width: 40, height: 4,
          decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(2)),
        )),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            const Text('Select Assignee', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Spacer(),
            if (selected != null)
              TextButton(onPressed: onClear, child: const Text('Clear')),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: searchCtrl,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'Search name or company…',
              prefixIcon: Icon(Icons.search, size: 18),
              border: OutlineInputBorder(),
              isDense: true,
              contentPadding: EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
        if (loading)
          const Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())
        else
          Expanded(
            child: ListView.separated(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
              itemCount: options.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final o = options[i];
                final isSelected = selected?.userId == o.userId && selected?.tempUserId == o.tempUserId;
                return ListTile(
                  dense: true,
                  selected: isSelected,
                  selectedTileColor: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.3),
                  leading: CircleAvatar(
                    radius: 18,
                    backgroundColor: o.isVendor ? Colors.purple.shade100 : Colors.blue.shade100,
                    child: Icon(
                      o.isVendor ? Icons.business_outlined : Icons.person_outline,
                      size: 18,
                      color: o.isVendor ? Colors.purple.shade700 : Colors.blue.shade700,
                    ),
                  ),
                  title: Text(o.label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (o.designation != null)
                      Text(o.designation!, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                    if (o.company != null)
                      Text(o.company!, style: TextStyle(fontSize: 10, color: o.isVendor ? Colors.purple.shade600 : Colors.grey.shade500)),
                  ]),
                  trailing: isSelected ? const Icon(Icons.check_circle, color: Colors.green) : null,
                  onTap: () => onSelect(o),
                );
              },
            ),
          ),
      ]),
    );
  }
}
