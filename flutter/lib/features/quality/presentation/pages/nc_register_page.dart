import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/quality/data/models/ncr_register_item.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/severity_badge.dart';

/// Non-Conformance Report register for a project.
///
/// Reads the unified Observation/NCR table via [SetuApiClient.getObservationNcrRegister]
/// and shows only rows where `type == 'NCR'` — these are auto-created
/// whenever a Site or Checklist observation is raised with a CRITICAL
/// rating (see [ObservationRatingSelector]), but can also be edited
/// manually here (root cause, corrective action, status) when the user
/// holds QUALITY.NCR.UPDATE.
class NcRegisterPage extends StatefulWidget {
  final int projectId;
  final String projectName;

  const NcRegisterPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  State<NcRegisterPage> createState() => _NcRegisterPageState();
}

class _NcRegisterPageState extends State<NcRegisterPage> {
  List<NcrRegisterItem>? _items;
  String? _error;
  String _statusFilter = 'All';

  static const _statuses = ['All', 'Open', 'In Progress', 'Resolved', 'Verified', 'Closed'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final raw = await sl<SetuApiClient>().getObservationNcrRegister(widget.projectId);
      final ncrs = raw
          .where((r) => (r['type'] as String?)?.toUpperCase() == 'NCR')
          .map(NcrRegisterItem.fromJson)
          .toList();
      if (mounted) setState(() => _items = ncrs);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load NC Register: $e');
    }
  }

  List<NcrRegisterItem> get _filtered {
    final items = _items ?? const [];
    if (_statusFilter == 'All') return items;
    return items.where((i) => i.status == _statusFilter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('NC Register', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.projectName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
      ),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              itemCount: _statuses.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final s = _statuses[i];
                final selected = _statusFilter == s;
                return ChoiceChip(
                  label: Text(s, style: const TextStyle(fontSize: 12)),
                  selected: selected,
                  onSelected: (_) => setState(() => _statusFilter = s),
                );
              },
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _items == null && _error == null
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(_error!, style: TextStyle(color: Colors.red.shade700)),
                          ),
                        )
                      : _filtered.isEmpty
                          ? ListView(
                              children: [
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 80),
                                  child: Center(
                                    child: Text('No NCRs found.',
                                        style: TextStyle(color: Colors.grey.shade500)),
                                  ),
                                ),
                              ],
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              itemCount: _filtered.length,
                              itemBuilder: (context, i) {
                                final item = _filtered[i];
                                return _NcrCard(
                                  item: item,
                                  onTap: () => _openDetail(item, ps),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openDetail(NcrRegisterItem item, PermissionService ps) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _NcrDetailSheet(
        item: item,
        canUpdate: ps.canUpdateNcr,
        canDelete: ps.canDeleteNcr,
      ),
    );
    if (updated == true) _load();
  }
}

class _NcrCard extends StatelessWidget {
  final NcrRegisterItem item;
  final VoidCallback onTap;
  const _NcrCard({required this.item, required this.onTap});

  Color get _statusColor => switch (item.status) {
        'Open' => Colors.red.shade700,
        'In Progress' => Colors.orange.shade700,
        'Resolved' => Colors.blue.shade700,
        'Verified' => Colors.teal.shade700,
        'Closed' => Colors.green.shade700,
        _ => Colors.grey,
      };

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4)],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SeverityBadge(severity: item.severity),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(item.status,
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor)),
                ),
                const Spacer(),
                Text('NCR #${item.id}', style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
              ],
            ),
            if (item.sourceReference != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.link_rounded, size: 13, color: Colors.indigo.shade400),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(item.sourceReference!,
                        style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600, color: Colors.indigo.shade700),
                        overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 6),
            Text(item.issueDescription,
                style: const TextStyle(fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(item.category, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                const Spacer(),
                Text(item.reportedDate, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _NcrDetailSheet extends StatefulWidget {
  final NcrRegisterItem item;
  final bool canUpdate;
  final bool canDelete;
  const _NcrDetailSheet({required this.item, required this.canUpdate, required this.canDelete});

  @override
  State<_NcrDetailSheet> createState() => _NcrDetailSheetState();
}

class _NcrDetailSheetState extends State<_NcrDetailSheet> {
  late String _status;
  late final TextEditingController _rootCauseCtrl;
  late final TextEditingController _correctiveActionCtrl;
  bool _saving = false;

  static const _statusOptions = ['Open', 'In Progress', 'Resolved', 'Verified', 'Closed'];

  @override
  void initState() {
    super.initState();
    _status = widget.item.status;
    _rootCauseCtrl = TextEditingController(text: widget.item.rootCause ?? '');
    _correctiveActionCtrl = TextEditingController(text: widget.item.correctiveAction ?? '');
  }

  @override
  void dispose() {
    _rootCauseCtrl.dispose();
    _correctiveActionCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await sl<SetuApiClient>().updateObservationNcr(
        widget.item.id,
        status: _status,
        rootCause: _rootCauseCtrl.text.trim(),
        correctiveAction: _correctiveActionCtrl.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $e'), backgroundColor: Colors.red.shade700),
        );
      }
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete NCR?'),
        content: Text('This permanently deletes NCR #${widget.item.id}. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _saving = true);
    try {
      await sl<SetuApiClient>().deleteObservationNcr(widget.item.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $e'), backgroundColor: Colors.red.shade700),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36, height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: Text('NCR #${item.id}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
                SeverityBadge(severity: item.severity),
              ],
            ),
            if (item.sourceReference != null) ...[
              const SizedBox(height: 4),
              Text(item.sourceReference!,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.indigo.shade700)),
            ],
            const SizedBox(height: 12),
            Expanded(
              child: ListView(
                controller: scrollController,
                children: [
                  _ReadOnlyField('Category', item.category),
                  _ReadOnlyField('Description', item.issueDescription),
                  if (item.location != null) _ReadOnlyField('Location', item.location!),
                  _ReadOnlyField('Reported By', item.reportedBy),
                  _ReadOnlyField('Reported Date', item.reportedDate),
                  const SizedBox(height: 12),
                  const Text('Status', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    children: _statusOptions.map((s) => ChoiceChip(
                          label: Text(s, style: const TextStyle(fontSize: 12)),
                          selected: _status == s,
                          onSelected: widget.canUpdate ? (_) => setState(() => _status = s) : null,
                        )).toList(),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _rootCauseCtrl,
                    enabled: widget.canUpdate,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'Root Cause', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _correctiveActionCtrl,
                    enabled: widget.canUpdate,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'Corrective Action', border: OutlineInputBorder()),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                if (widget.canDelete)
                  OutlinedButton.icon(
                    onPressed: _saving ? null : _delete,
                    icon: const Icon(Icons.delete_outline, size: 16),
                    label: const Text('Delete'),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700),
                  ),
                const Spacer(),
                if (widget.canUpdate)
                  FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox(width: 14, height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.save_outlined, size: 16),
                    label: const Text('Save'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  final String label;
  final String value;
  const _ReadOnlyField(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }
}
