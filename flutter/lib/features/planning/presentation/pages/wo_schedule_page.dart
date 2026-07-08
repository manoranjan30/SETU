import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/injection_container.dart';

/// WO–Schedule Linker — browse Work Order items and link them to schedule activities.
///
/// Left-side tree: Vendor → Work Order → BOQ item → sub-items/measurement items.
/// Tapping a linkable leaf item opens an activity search sheet to link it.
/// Already-linked items show a green indicator; unlinked show orange.
///
/// Data is cached via dio_cache_interceptor (3-min TTL). Refresh button forces
/// a fresh fetch by clearing the cache first.
class WoSchedulePage extends StatefulWidget {
  final Project project;
  const WoSchedulePage({super.key, required this.project});

  @override
  State<WoSchedulePage> createState() => _WoSchedulePageState();
}

class _WoSchedulePageState extends State<WoSchedulePage>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;
  bool _loading = true;
  String? _error;

  // WO items tree from the backend
  List<_VendorNode> _vendors = [];

  // Schedule activities for linking (loaded from active version)
  List<_ScheduleActivity> _activities = [];
  bool _activitiesLoaded = false;

  // Expand/collapse state keyed by node ID
  final Set<String> _expanded = {};

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() { _tab.dispose(); super.dispose(); }

  Future<void> _load({bool force = false}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = sl<SetuApiClient>();
      if (force) await api.clearCache();

      // Load WO items tree
      final raw = await api.getWoItemsTree(widget.project.id);
      final vendors = _parseVendorTree(raw);

      // Load schedule activities — try versioned schedule first (active/working version),
      // fall back to execution-ready activities from the WBS when no versions exist.
      List<_ScheduleActivity> activities = [];
      try {
        final versions = await api.getScheduleVersions(widget.project.id);
        if (versions.isNotEmpty) {
          final versionList = versions.cast<Map<String, dynamic>>();
          final activeVersion = versionList.firstWhere(
              (v) => v['isActive'] == true,
              orElse: () => versionList.first);
          final actRaw = await api.getVersionActivities(activeVersion['id'] as int);
          activities = actRaw
              .map((e) => _ScheduleActivity.fromJson(e as Map<String, dynamic>))
              .where((a) => a.name.isNotEmpty)
              .toList();
        }
      } catch (_) {
        // Version fetch failed — fall through to WBS fallback below.
      }

      // Fallback: load activities from EPS tree when no versioned schedule exists.
      // getExecutionReadyActivities aggregates recursively from the root node.
      if (activities.isEmpty) {
        try {
          final epsTree = await api.getEpsTreeForProject(widget.project.id);
          // Collect all unique EPS node IDs and fetch activities for each root
          final rootNodeIds = (epsTree).cast<Map<String, dynamic>>()
              .map((n) => n['id'] as int?)
              .whereType<int>()
              .toList();
          final seen = <int>{};
          for (final nodeId in rootNodeIds) {
            final raw = await api.getExecutionReadyActivities(widget.project.id, nodeId);
            for (final e in raw) {
              final m = e as Map<String, dynamic>;
              final id = m['id'] as int? ?? 0;
              if (id != 0 && seen.add(id)) {
                final name = m['activityName'] as String? ?? m['name'] as String? ?? '';
                final code = m['activityCode'] as String? ?? m['code'] as String?;
                if (name.isNotEmpty) {
                  activities.add(_ScheduleActivity(id: id, name: name, activityCode: code));
                }
              }
            }
          }
        } catch (_) {
          // WBS fallback also failed — activities list stays empty.
        }
      }

      // Sort by activity code / name for consistent display
      activities.sort((a, b) {
        final codeA = a.activityCode ?? '';
        final codeB = b.activityCode ?? '';
        if (codeA.isNotEmpty && codeB.isNotEmpty) return codeA.compareTo(codeB);
        return a.name.compareTo(b.name);
      });

      if (mounted) {
        setState(() {
          _vendors = vendors;
          _activities = activities;
          _activitiesLoaded = true;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load: $e'; _loading = false; });
    }
  }

  List<_VendorNode> _parseVendorTree(dynamic raw) {
    if (raw is! List) return [];
    return raw.map((v) {
      final vm = v as Map<String, dynamic>;
      return _VendorNode(
        id: vm['vendorId'] as int? ?? 0,
        name: vm['vendorName'] as String? ?? 'Vendor',
        workOrders: ((vm['workOrders'] as List<dynamic>?) ?? []).map((w) {
          final wm = w as Map<String, dynamic>;
          return _WoNode(
            id: wm['workOrderId'] as int? ?? 0,
            number: wm['woNumber'] as String? ?? '',
            boqItems: ((wm['boqItems'] as List<dynamic>?) ?? []).map((b) {
              final bm = b as Map<String, dynamic>;
              return _BoqItemNode(
                id: bm['boqItemId'] as int? ?? 0,
                code: bm['boqCode'] as String? ?? '',
                description: bm['description'] as String? ?? 'Item',
                uom: bm['uom'] as String? ?? '',
                directWoItems: ((bm['directWoItems'] as List<dynamic>?) ?? [])
                    .map((e) => _parseWoItem(e as Map<String, dynamic>)).toList(),
                subItems: ((bm['subItems'] as List<dynamic>?) ?? []).map((s) {
                  final sm = s as Map<String, dynamic>;
                  return _SubItemNode(
                    id: sm['boqSubItemId'] as int? ?? 0,
                    description: sm['description'] as String? ?? 'Sub-item',
                    woItem: sm['woItem'] != null ? _parseWoItem(sm['woItem'] as Map<String, dynamic>) : null,
                    measurements: ((sm['measurements'] as List<dynamic>?) ?? [])
                        .map((e) => _parseWoItem(e as Map<String, dynamic>)).toList(),
                  );
                }).toList(),
              );
            }).toList(),
          );
        }).toList(),
      );
    }).toList();
  }

  _WoItem _parseWoItem(Map<String, dynamic> m) => _WoItem(
    workOrderItemId: m['workOrderItemId'] as int? ?? 0,
    description: m['description'] as String? ?? 'Item',
    qty: (m['qty'] as num?)?.toDouble() ?? 0,
    uom: m['uom'] as String? ?? '',
    mappingStatus: m['mappingStatus'] as String? ?? 'UNMAPPED',
    linkedActivities: m['linkedActivities'] as String? ?? '',
    isLeaf: m['isExecutableLeaf'] as bool? ?? true,
  );

  void _toggleExpand(String key) {
    setState(() {
      if (_expanded.contains(key)) _expanded.remove(key); else _expanded.add(key);
    });
  }

  Future<void> _linkItem(_WoItem item) async {
    if (_activities.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No schedule activities available to link to')));
      return;
    }
    final selected = await showModalBottomSheet<_ScheduleActivity>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => _ActivityPickerSheet(activities: _activities, current: item.linkedActivities),
    );
    if (selected == null || !mounted) return;
    try {
      await sl<SetuApiClient>().linkWoItemToActivity(
        projectId: widget.project.id,
        workOrderItemId: item.workOrderItemId,
        activityId: selected.id,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Linked to ${selected.name}'), backgroundColor: Colors.green.shade700));
      _load(force: true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Link failed: $e'), backgroundColor: Colors.red.shade700));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('WO–Schedule Linker', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text(widget.project.name, style: const TextStyle(fontSize: 12)),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Force refresh (clears cache)',
            onPressed: () => _load(force: true),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 12),
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  ElevatedButton(onPressed: () => _load(force: true), child: const Text('Retry')),
                ]))
              : Column(children: [
                  // Summary bar
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    color: Theme.of(context).colorScheme.surfaceContainerLow,
                    child: Row(children: [
                      _summaryChip('Vendors', _vendors.length, Colors.indigo),
                      const SizedBox(width: 8),
                      _summaryChip('Mapped', _countByStatus('MAPPED'), Colors.green),
                      const SizedBox(width: 8),
                      _summaryChip('Unmapped', _countByStatus('UNMAPPED'), Colors.orange),
                      const Spacer(),
                      if (_activitiesLoaded)
                        Text('${_activities.length} schedule activities',
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                    ]),
                  ),
                  // WO Tree
                  Expanded(
                    child: _vendors.isEmpty
                        ? const Center(child: Text('No active Work Orders found for this project.'))
                        : ListView(
                            padding: const EdgeInsets.all(8),
                            children: _vendors.map(_buildVendorNode).toList(),
                          ),
                  ),
                ]),
    );
  }

  int _countByStatus(String status) {
    int count = 0;
    for (final v in _vendors) {
      for (final wo in v.workOrders) {
        for (final b in wo.boqItems) {
          count += b.directWoItems.where((i) => i.mappingStatus == status).length;
          for (final s in b.subItems) {
            if (s.woItem?.mappingStatus == status) count++;
            count += s.measurements.where((i) => i.mappingStatus == status).length;
          }
        }
      }
    }
    return count;
  }

  Widget _summaryChip(String label, int count, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Text('$count ', style: TextStyle(fontWeight: FontWeight.w700, color: color, fontSize: 13)),
      Text(label, style: TextStyle(fontSize: 11, color: color)),
    ]),
  );

  Widget _buildVendorNode(_VendorNode v) {
    final key = 'v${v.id}';
    final expanded = _expanded.contains(key);
    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.indigo.shade100)),
      child: Column(children: [
        InkWell(
          onTap: () => _toggleExpand(key),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              const Icon(Icons.business_outlined, size: 18, color: Colors.indigo),
              const SizedBox(width: 8),
              Expanded(child: Text(v.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
              Text('${v.workOrders.length} WO', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              const SizedBox(width: 4),
              Icon(expanded ? Icons.expand_less : Icons.expand_more, color: Colors.grey),
            ]),
          ),
        ),
        if (expanded) ...v.workOrders.map((wo) => _buildWoNode(wo, v.id)),
      ]),
    );
  }

  Widget _buildWoNode(_WoNode wo, int vendorId) {
    final key = 'wo${wo.id}';
    final expanded = _expanded.contains(key);
    return Column(children: [
      InkWell(
        onTap: () => _toggleExpand(key),
        child: Container(
          color: Colors.purple.shade50,
          padding: const EdgeInsets.fromLTRB(28, 8, 12, 8),
          child: Row(children: [
            const Icon(Icons.description_outlined, size: 16, color: Colors.purple),
            const SizedBox(width: 6),
            Expanded(child: Text(wo.number, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
            Text('${wo.boqItems.length} items', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
            const SizedBox(width: 4),
            Icon(expanded ? Icons.expand_less : Icons.expand_more, size: 18, color: Colors.grey),
          ]),
        ),
      ),
      if (expanded) ...wo.boqItems.map((b) => _buildBoqNode(b, wo.id)),
    ]);
  }

  Widget _buildBoqNode(_BoqItemNode b, int woId) {
    final key = 'b${b.id}_$woId';
    final expanded = _expanded.contains(key);
    final allItems = [...b.directWoItems, ...b.subItems.expand((s) => [if (s.woItem != null) s.woItem!, ...s.measurements])];
    final mappedCount = allItems.where((i) => i.mappingStatus == 'MAPPED').length;
    return Column(children: [
      InkWell(
        onTap: () => _toggleExpand(key),
        child: Container(
          color: Colors.blue.shade50,
          padding: const EdgeInsets.fromLTRB(44, 8, 12, 8),
          child: Row(children: [
            const Icon(Icons.list_alt_outlined, size: 15, color: Colors.blue),
            const SizedBox(width: 6),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${b.code.isEmpty ? "" : "${b.code} · "}${b.description}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              if (b.uom.isNotEmpty) Text(b.uom, style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
            ])),
            if (allItems.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: mappedCount == allItems.length ? Colors.green.shade50 : Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('$mappedCount/${allItems.length}',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                        color: mappedCount == allItems.length ? Colors.green.shade700 : Colors.orange.shade700)),
              ),
            const SizedBox(width: 4),
            Icon(expanded ? Icons.expand_less : Icons.expand_more, size: 16, color: Colors.grey),
          ]),
        ),
      ),
      if (expanded) ...[
        ...b.directWoItems.map(_buildWoItemRow),
        ...b.subItems.map((s) => _buildSubItemNode(s, b.id)),
      ],
    ]);
  }

  Widget _buildSubItemNode(_SubItemNode s, int boqId) {
    final key = 'sub${s.id}_$boqId';
    final expanded = _expanded.contains(key);
    return Column(children: [
      InkWell(
        onTap: () => _toggleExpand(key),
        child: Container(
          color: Colors.teal.shade50,
          padding: const EdgeInsets.fromLTRB(56, 7, 12, 7),
          child: Row(children: [
            const Icon(Icons.subdirectory_arrow_right, size: 14, color: Colors.teal),
            const SizedBox(width: 4),
            Expanded(child: Text(s.description, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500))),
            Icon(expanded ? Icons.expand_less : Icons.expand_more, size: 14, color: Colors.grey),
          ]),
        ),
      ),
      if (expanded) ...[
        if (s.woItem != null) _buildWoItemRow(s.woItem!),
        ...s.measurements.map(_buildWoItemRow),
      ],
    ]);
  }

  Widget _buildWoItemRow(_WoItem item) {
    final isMapped = item.mappingStatus == 'MAPPED';
    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.fromLTRB(64, 0, 12, 0),
      leading: Icon(
        isMapped ? Icons.link : Icons.link_off,
        size: 16,
        color: isMapped ? Colors.green.shade600 : Colors.orange.shade600,
      ),
      title: Text(item.description, style: const TextStyle(fontSize: 12)),
      subtitle: item.linkedActivities.isNotEmpty
          ? Text('→ ${item.linkedActivities}', style: TextStyle(fontSize: 10, color: Colors.green.shade700))
          : Text('${item.qty > 0 ? "${item.qty} ${item.uom}" : ""}${isMapped ? "" : " · Tap to link"}',
              style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
      trailing: item.isLeaf
          ? IconButton(
              icon: Icon(isMapped ? Icons.edit_outlined : Icons.add_link,
                  size: 18, color: isMapped ? Colors.blue.shade600 : Colors.orange.shade700),
              tooltip: isMapped ? 'Change link' : 'Link to activity',
              onPressed: () => _linkItem(item),
            )
          : null,
    );
  }
}

// ── Data models ───────────────────────────────────────────────────────────────

class _VendorNode { final int id; final String name; final List<_WoNode> workOrders; const _VendorNode({required this.id, required this.name, required this.workOrders}); }
class _WoNode { final int id; final String number; final List<_BoqItemNode> boqItems; const _WoNode({required this.id, required this.number, required this.boqItems}); }
class _BoqItemNode { final int id; final String code; final String description; final String uom; final List<_WoItem> directWoItems; final List<_SubItemNode> subItems; const _BoqItemNode({required this.id, required this.code, required this.description, required this.uom, required this.directWoItems, required this.subItems}); }
class _SubItemNode { final int id; final String description; final _WoItem? woItem; final List<_WoItem> measurements; const _SubItemNode({required this.id, required this.description, this.woItem, required this.measurements}); }
class _WoItem { final int workOrderItemId; final String description; final double qty; final String uom; final String mappingStatus; final String linkedActivities; final bool isLeaf; const _WoItem({required this.workOrderItemId, required this.description, required this.qty, required this.uom, required this.mappingStatus, required this.linkedActivities, required this.isLeaf}); }

class _ScheduleActivity {
  final int id;
  final String name;
  final String? activityCode;
  const _ScheduleActivity({required this.id, required this.name, this.activityCode});
  factory _ScheduleActivity.fromJson(Map<String, dynamic> j) {
    final act = j['activity'] as Map<String, dynamic>? ?? j;
    return _ScheduleActivity(
      id: j['activityId'] as int? ?? act['id'] as int? ?? 0,
      name: act['name'] as String? ?? act['activityName'] as String? ?? '',
      activityCode: act['activityCode'] as String?,
    );
  }
}

// ── Activity picker sheet ─────────────────────────────────────────────────────

class _ActivityPickerSheet extends StatefulWidget {
  final List<_ScheduleActivity> activities;
  final String current;
  const _ActivityPickerSheet({required this.activities, required this.current});

  @override
  State<_ActivityPickerSheet> createState() => _ActivityPickerSheetState();
}

class _ActivityPickerSheetState extends State<_ActivityPickerSheet> {
  final _searchCtrl = TextEditingController();
  List<_ScheduleActivity> _filtered = [];

  @override
  void initState() {
    super.initState();
    _filtered = widget.activities;
    _searchCtrl.addListener(() {
      final q = _searchCtrl.text.toLowerCase();
      setState(() => _filtered = q.isEmpty
          ? widget.activities
          : widget.activities.where((a) =>
              a.name.toLowerCase().contains(q) ||
              (a.activityCode?.toLowerCase().contains(q) ?? false)).toList());
    });
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (_, scrollCtrl) => Column(children: [
        Center(child: Container(margin: const EdgeInsets.only(top: 12, bottom: 8), width: 40, height: 4,
            decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(2)))),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('Link to Schedule Activity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        ),
        if (widget.current.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: Text('Currently: ${widget.current}',
                style: TextStyle(fontSize: 11, color: Colors.green.shade700)),
          ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchCtrl,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'Search activity name or code…',
              prefixIcon: Icon(Icons.search, size: 18),
              border: OutlineInputBorder(),
              isDense: true,
              contentPadding: EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            controller: scrollCtrl,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
            itemCount: _filtered.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final a = _filtered[i];
              return ListTile(
                dense: true,
                leading: const Icon(Icons.timeline_outlined, size: 18, color: Colors.indigo),
                title: Text('${a.activityCode != null ? "${a.activityCode} · " : ""}${a.name}',
                    style: const TextStyle(fontSize: 13)),
                onTap: () => Navigator.pop(context, a),
              );
            },
          ),
        ),
      ]),
    );
  }
}
