import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/injection_container.dart';

/// WO–Schedule Linker — browse Work Order items and link them to schedule activities.
///
/// Left-side tree: Vendor → Work Order → BOQ item → sub-items/measurement items.
/// Tapping the link icon on a leaf item opens an EPS-tree activity picker.
/// Already-linked items show a green indicator; unlinked show orange.
class WoSchedulePage extends StatefulWidget {
  final Project project;
  const WoSchedulePage({super.key, required this.project});

  @override
  State<WoSchedulePage> createState() => _WoSchedulePageState();
}

class _WoSchedulePageState extends State<WoSchedulePage> {
  bool _loading = true;
  String? _error;

  List<_VendorNode> _vendors = [];
  List<_WbsNode> _wbsRoots = [];
  List<_WbsNode> _leavesInOrder = [];
  bool _activitiesLoaded = false;

  // Expand/collapse state for the WO tree (keyed by node string key)
  final Set<String> _expanded = {};

  // Per-item linking spinner: workOrderItemId → true while API call in flight
  final Map<int, bool> _linking = {};

  // Persists within the session
  static _WbsNode? _lastLinked;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool force = false}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = sl<SetuApiClient>();
      if (force) await api.clearCache();

      // Load WO tree and schedule versions in parallel
      final parallel = await Future.wait([
        api.getWoItemsTree(widget.project.id),
        api.getScheduleVersions(widget.project.id),
      ]);
      final vendors = _parseVendorTree(parallel[0]);

      // Primary: version activities (for projects with a published schedule version)
      final roots = <_WbsNode>[];
      final stack = <_WbsNode>[];

      void addToTree(_WbsNode node) {
        while (stack.isNotEmpty && !_isChildCode(node.code, stack.last.code)) {
          stack.removeLast();
        }
        if (stack.isEmpty) roots.add(node); else stack.last.children.add(node);
        stack.add(node);
      }

      final versions = parallel[1] as List;
      if (versions.isNotEmpty) {
        try {
          final versionList = versions.cast<Map<String, dynamic>>();
          final activeVersion = versionList.firstWhere(
              (v) => v['isActive'] == true, orElse: () => versionList.first);
          final actRaw = await api.getVersionActivities(activeVersion['id'] as int);
          for (final e in actRaw) {
            final m = e as Map<String, dynamic>;
            final act = m['activity'] as Map<String, dynamic>? ?? m;
            final id = m['activityId'] as int? ?? act['id'] as int? ?? 0;
            final name = act['name'] as String? ?? act['activityName'] as String? ?? '';
            final code = act['activityCode'] as String? ?? act['code'] as String?;
            if (id == 0 || name.isEmpty) continue;
            addToTree(_WbsNode(id: id, name: name, code: code));
          }
        } catch (_) {
          roots.clear(); stack.clear();
        }
      }

      // Fallback: use the existing WBS controller endpoints (these power the web viewer
      // and are guaranteed to work for all projects regardless of schedule versions).
      if (roots.isEmpty) {
        try {
          final results = await Future.wait([
            api.getWbsNodes(widget.project.id),
            api.getWbsActivities(widget.project.id),
          ]);
          final wbsRaw = results[0];
          final actRaw = results[1];

          // Pass 1: create _WbsNode for each WBS node (negative id avoids collision with activity ids)
          final wbsById = <int, _WbsNode>{};
          for (final e in wbsRaw) {
            final m = e as Map<String, dynamic>;
            final dbId = m['id'] as int? ?? 0;
            final name = m['wbsName'] as String? ?? '';
            final code = m['wbsCode'] as String?;
            if (dbId == 0 || name.isEmpty) continue;
            wbsById[dbId] = _WbsNode(id: -dbId, name: name, code: code);
          }

          // Pass 2: wire WBS parent-child links; collect roots
          final wbsRoots = <_WbsNode>[];
          for (final e in wbsRaw) {
            final m = e as Map<String, dynamic>;
            final dbId = m['id'] as int? ?? 0;
            final parentId = m['parentId'] as int?;
            if (dbId == 0 || !wbsById.containsKey(dbId)) continue;
            final node = wbsById[dbId]!;
            if (parentId != null && wbsById.containsKey(parentId)) {
              wbsById[parentId]!.children.add(node);
            } else {
              wbsRoots.add(node);
            }
          }

          // Pass 3: attach activity leaves to their WBS parent (appended after WBS children)
          for (final e in actRaw) {
            final m = e as Map<String, dynamic>;
            final id = m['id'] as int? ?? 0;
            final name = m['activityName'] as String? ?? '';
            final code = m['activityCode'] as String?;
            final wbsNodeId = (m['wbsNode'] as Map<String, dynamic>?)?['id'] as int?;
            if (id == 0 || name.isEmpty) continue;
            final leaf = _WbsNode(id: id, name: name, code: code, forceLeaf: true);
            if (wbsNodeId != null && wbsById.containsKey(wbsNodeId)) {
              wbsById[wbsNodeId]!.children.add(leaf);
            } else {
              wbsRoots.add(leaf); // orphan activity — show at root
            }
          }

          roots.addAll(wbsRoots);
        } catch (e) {
          debugPrint('[WoSchedule] WBS fallback failed: $e');
        }
      }

      // Build fullPath on each node (WBS breadcrumb shown below WO item after linking)
      void buildPaths(_WbsNode n, String parentPath) {
        n.fullPath = parentPath.isEmpty ? n.name : '$parentPath > ${n.name}';
        for (final c in n.children) buildPaths(c, n.fullPath);
      }
      for (final r in roots) buildPaths(r, '');

      // Flatten leaves in WBS order for search and "Suggested Next"
      final leaves = <_WbsNode>[];
      void flattenLeaves(_WbsNode n) {
        if (n.isLeaf) leaves.add(n);
        else { for (final c in n.children) { flattenLeaves(c); } }
      }
      for (final r in roots) flattenLeaves(r);

      // Build activity-id → node map so already-linked WO items get full WBS paths.
      // Index ALL positive-ID nodes (not just leaves) because a version-activity tree
      // may mark an activity as non-leaf when it has sub-activities in the schedule.
      final actNodeById = <int, _WbsNode>{};
      void indexNode(_WbsNode n) {
        if (n.id > 0) actNodeById[n.id] = n; // negative IDs are WBS header nodes
        for (final c in n.children) indexNode(c);
      }
      for (final r in roots) indexNode(r);

      // Resolve full path for every WO item that already has a linkedActivityId
      void resolveLinkedPaths(List<_WoItem> items) {
        for (final item in items) {
          final actId = item.linkedActivityId;
          if (actId != null && actNodeById.containsKey(actId)) {
            item.linkedActivities = actNodeById[actId]!.fullPath;
          }
        }
      }
      for (final v in vendors) {
        for (final wo in v.workOrders) {
          for (final b in wo.boqItems) {
            resolveLinkedPaths(b.directWoItems);
            for (final s in b.subItems) {
              if (s.woItem != null) resolveLinkedPaths([s.woItem!]);
              resolveLinkedPaths(s.measurements);
            }
          }
        }
      }

      if (mounted) {
        setState(() {
          _vendors = vendors;
          _wbsRoots = roots;
          _leavesInOrder = leaves;
          _activitiesLoaded = true;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load: $e'; _loading = false; });
    }
  }

  /// True if [child]'s WBS code is a direct descendant of [parent]'s code.
  static bool _isChildCode(String? child, String? parent) {
    if (child == null || parent == null || child.length <= parent.length) return false;
    if (!child.startsWith(parent)) return false;
    final sep = child[parent.length];
    return sep == '.' || sep == '-' || sep == ' ';
  }

  /// The leaf immediately after the last-linked one — for floor-by-floor linking.
  _WbsNode? get _suggestedNext {
    if (_lastLinked == null) return null;
    final idx = _leavesInOrder.indexWhere((n) => n.id == _lastLinked!.id);
    if (idx == -1 || idx >= _leavesInOrder.length - 1) return null;
    return _leavesInOrder[idx + 1];
  }

  /// Returns the ancestor node IDs (parent → grandparent chain) for [target],
  /// traversing [_wbsRoots]. Used to auto-expand the picker to the last linked level.
  List<int> _getAncestorIds(_WbsNode? target) {
    if (target == null) return [];
    final path = <int>[];
    bool find(List<_WbsNode> nodes) {
      for (final n in nodes) {
        path.add(n.id);
        if (n.id == target.id) return true;
        if (!n.isLeaf && find(n.children)) return true;
        path.removeLast();
      }
      return false;
    }
    find(_wbsRoots);
    // Remove the target leaf itself — we only want the ancestors to expand
    if (path.isNotEmpty && path.last == target.id) path.removeLast();
    return path;
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
    linkedActivityId: m['linkedActivityId'] as int?,
    isLeaf: m['isExecutableLeaf'] as bool? ?? true,
  );

  void _toggleExpand(String key) {
    setState(() {
      if (_expanded.contains(key)) _expanded.remove(key); else _expanded.add(key);
    });
  }

  Future<void> _linkItem(_WoItem item) async {
    if (_leavesInOrder.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No schedule activities available to link to')));
      return;
    }
    final selected = await showModalBottomSheet<_WbsNode>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => _WbsTreePickerSheet(
        roots: _wbsRoots,
        leavesInOrder: _leavesInOrder,
        currentLinked: item.linkedActivities,
        currentLinkedId: item.linkedActivityId,
        lastLinked: _lastLinked,
        suggestedNext: _suggestedNext,
        initialExpanded: _getAncestorIds(_lastLinked),
        projectId: widget.project.id,
      ),
    );
    if (!mounted) return;

    // null means user dismissed without selecting
    if (selected == null) return;

    // selected.id == -1 is the special "unlink" sentinel
    final isUnlink = selected.id == -1;
    setState(() => _linking[item.workOrderItemId] = true);
    try {
      final api = sl<SetuApiClient>();
      if (isUnlink) {
        await api.unlinkWoItem(workOrderItemId: item.workOrderItemId);
        if (!mounted) return;
        setState(() {
          item.mappingStatus = 'UNMAPPED';
          item.linkedActivities = '';
          item.linkedActivityId = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Activity unlinked')));
      } else {
        await api.linkWoItemToActivity(
          projectId: widget.project.id,
          workOrderItemId: item.workOrderItemId,
          activityId: selected.id,
        );
        if (!mounted) return;
        setState(() {
          item.mappingStatus = 'MAPPED';
          item.linkedActivities = selected.fullPath;
          item.linkedActivityId = selected.id;
          _lastLinked = selected;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Linked to ${selected.name}'), backgroundColor: Colors.green.shade700));
      }
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().replaceFirst('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${isUnlink ? "Unlink" : "Link"} failed',
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(msg, style: const TextStyle(fontSize: 12)),
        ]),
        backgroundColor: Colors.red.shade700,
        duration: const Duration(seconds: 8),
        action: SnackBarAction(label: 'Dismiss', textColor: Colors.white, onPressed: () {}),
      ));
    } finally {
      if (mounted) setState(() => _linking.remove(item.workOrderItemId));
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
                        Text('${_leavesInOrder.length} schedule activities',
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                    ]),
                  ),
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
    // Non-leaf "master" items (isLeaf=false) are grouping nodes — not directly
    // linkable — so exclude them from the colour and count logic.
    final linkableItems = allItems.where((i) => i.isLeaf).toList();
    final mappedCount = linkableItems.where((i) => i.mappingStatus == 'MAPPED').length;
    // Background colour signals linking completion at a glance
    final bgColor = linkableItems.isEmpty
        ? Colors.blue.shade50
        : mappedCount == linkableItems.length
            ? Colors.green.shade50   // all items linked
            : mappedCount > 0
                ? Colors.amber.shade50  // partially linked
                : Colors.red.shade50;   // none linked
    return Column(children: [
      InkWell(
        onTap: () => _toggleExpand(key),
        child: Container(
          color: bgColor,
          padding: const EdgeInsets.fromLTRB(44, 8, 12, 8),
          child: Row(children: [
            const Icon(Icons.list_alt_outlined, size: 15, color: Colors.blue),
            const SizedBox(width: 6),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${b.code.isEmpty ? "" : "${b.code} · "}${b.description}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              if (b.uom.isNotEmpty) Text(b.uom, style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
            ])),
            if (linkableItems.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: mappedCount == linkableItems.length ? Colors.green.shade50 : Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('$mappedCount/${linkableItems.length}',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                        color: mappedCount == linkableItems.length ? Colors.green.shade700 : Colors.orange.shade700)),
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
    // Collect all WO items under this sub-item to derive linking status
    final subItems = [if (s.woItem != null) s.woItem!, ...s.measurements];
    final linkableSubItems = subItems.where((i) => i.isLeaf).toList();
    final mappedCount = linkableSubItems.where((i) => i.mappingStatus == 'MAPPED').length;
    final bgColor = linkableSubItems.isEmpty
        ? Colors.teal.shade50
        : mappedCount == linkableSubItems.length
            ? Colors.green.shade50
            : mappedCount > 0
                ? Colors.amber.shade50
                : Colors.red.shade50;
    return Column(children: [
      InkWell(
        onTap: () => _toggleExpand(key),
        child: Container(
          color: bgColor,
          padding: const EdgeInsets.fromLTRB(56, 7, 12, 7),
          child: Row(children: [
            Icon(Icons.subdirectory_arrow_right, size: 14,
                color: mappedCount == linkableSubItems.length && linkableSubItems.isNotEmpty
                    ? Colors.green.shade700
                    : Colors.teal),
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
    final isLinking = _linking[item.workOrderItemId] == true;
    // Row tint reflects the mapping state of this specific item
    final rowBg = isMapped ? Colors.green.shade50 : Colors.red.shade50;
    return ColoredBox(
      color: rowBg,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ListTile(
        dense: true,
        contentPadding: const EdgeInsets.fromLTRB(64, 0, 12, 0),
        leading: isLinking
            ? SizedBox(width: 16, height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.indigo.shade400))
            : Icon(isMapped ? Icons.link : Icons.link_off, size: 16,
                color: isMapped ? Colors.green.shade600 : Colors.orange.shade600),
        title: Text(item.description, style: const TextStyle(fontSize: 12)),
        subtitle: Text(
          item.qty > 0 ? '${item.qty} ${item.uom}' : '',
          style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
        ),
        trailing: item.isLeaf && !isLinking
            ? IconButton(
                icon: Icon(isMapped ? Icons.edit_outlined : Icons.add_link,
                    size: 18, color: isMapped ? Colors.blue.shade600 : Colors.orange.shade700),
                tooltip: isMapped ? 'Change / unlink' : 'Link to activity',
                onPressed: () => _linkItem(item),
              )
            : null,
      ),
      // Linked activity full path — shown below the tile when mapped
      if (isMapped && item.linkedActivities.isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(80, 0, 12, 6),
          child: Row(children: [
            Icon(Icons.account_tree_outlined, size: 11, color: Colors.green.shade600),
            const SizedBox(width: 4),
            Expanded(child: Text(
              item.linkedActivities,
              style: TextStyle(fontSize: 10, color: Colors.green.shade700, height: 1.3),
            )),
          ]),
        ),
      ]),
    );
  }
}

// ── Data models ───────────────────────────────────────────────────────────────

class _VendorNode { final int id; final String name; final List<_WoNode> workOrders; const _VendorNode({required this.id, required this.name, required this.workOrders}); }
class _WoNode { final int id; final String number; final List<_BoqItemNode> boqItems; const _WoNode({required this.id, required this.number, required this.boqItems}); }
class _BoqItemNode { final int id; final String code; final String description; final String uom; final List<_WoItem> directWoItems; final List<_SubItemNode> subItems; const _BoqItemNode({required this.id, required this.code, required this.description, required this.uom, required this.directWoItems, required this.subItems}); }
class _SubItemNode { final int id; final String description; final _WoItem? woItem; final List<_WoItem> measurements; const _SubItemNode({required this.id, required this.description, this.woItem, required this.measurements}); }

/// WO item — mutable fields updated inline after link/unlink without full reload.
class _WoItem {
  final int workOrderItemId;
  final String description;
  final double qty;
  final String uom;
  String mappingStatus;
  String linkedActivities; // full path shown in subtitle
  int? linkedActivityId;   // actual activity id for unlink detection
  final bool isLeaf;
  _WoItem({required this.workOrderItemId, required this.description, required this.qty, required this.uom, required this.mappingStatus, required this.linkedActivities, this.linkedActivityId, required this.isLeaf});
}

// ── WBS tree node ─────────────────────────────────────────────────────────────

/// One node in the WBS tree.
/// [forceLeaf] = true for activities in the depth-based tree that happen to
/// have no children but are explicitly marked as leaf activities by the backend.
/// [fullPath] is built lazily when the node is selected.
class _WbsNode {
  final int id;
  final String name;
  final String? code;
  final bool forceLeaf; // true → always selectable (never a collapsible header)
  final List<_WbsNode> children = [];
  String fullPath = ''; // populated when building the tree for display

  _WbsNode({required this.id, required this.name, this.code, this.forceLeaf = false});

  bool get isLeaf => forceLeaf || children.isEmpty;

  /// Total selectable (leaf) activities in this subtree.
  int get leafCount => isLeaf ? 1 : children.fold(0, (s, c) => s + c.leafCount);

  /// Sentinel returned by the picker to signal "unlink this item".
  static final _WbsNode unlink = _WbsNode(id: -1, name: 'Unlink', forceLeaf: true);
}

// ── WBS tree picker sheet ─────────────────────────────────────────────────────

class _WbsTreePickerSheet extends StatefulWidget {
  final List<_WbsNode> roots;
  final List<_WbsNode> leavesInOrder;
  final String currentLinked;
  final int? currentLinkedId;  // used to show "Unlink" option
  final _WbsNode? lastLinked;
  final _WbsNode? suggestedNext;
  final List<int> initialExpanded; // ancestor IDs to auto-expand on open
  final int projectId; // used to persist hidden-section state per device

  const _WbsTreePickerSheet({
    required this.roots,
    required this.leavesInOrder,
    required this.currentLinked,
    this.currentLinkedId,
    this.lastLinked,
    this.suggestedNext,
    this.initialExpanded = const [],
    required this.projectId,
  });

  @override
  State<_WbsTreePickerSheet> createState() => _WbsTreePickerSheetState();
}

class _WbsTreePickerSheetState extends State<_WbsTreePickerSheet> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  final Set<int> _expanded = {};
  // Nodes hidden by the user — persisted to SharedPreferences so the
  // preference survives across picker opens until the user taps "show all".
  Set<int> _hiddenNodes = {};
  bool _allCollapsed = false;

  String get _prefKey => 'wbs_hidden_${widget.projectId}';

  @override
  void initState() {
    super.initState();
    if (widget.initialExpanded.isNotEmpty) {
      // Expand only the path leading to the last linked activity
      _expanded.addAll(widget.initialExpanded);
    } else {
      // No prior link: expand all roots so user sees top level
      for (final root in widget.roots) {
        _expanded.add(root.id);
      }
    }
    _loadHiddenNodes();
  }

  Future<void> _loadHiddenNodes() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getStringList(_prefKey);
    if (stored != null && mounted) {
      setState(() {
        _hiddenNodes = stored
            .map((s) => int.tryParse(s) ?? -1)
            .where((id) => id >= 0)
            .toSet();
      });
    }
  }

  Future<void> _saveHiddenNodes() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
        _prefKey, _hiddenNodes.map((id) => '$id').toList());
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  void _collapseAll() => setState(() { _expanded.clear(); _allCollapsed = true; });

  void _expandAll() {
    void addAll(_WbsNode n) {
      if (!n.isLeaf) { _expanded.add(n.id); for (final c in n.children) addAll(c); }
    }
    setState(() { _allCollapsed = false; for (final r in widget.roots) addAll(r); });
  }

  // Returns the set of node IDs that should be visible for the given search query.
  // A node is visible if it matches OR any ancestor matches (show all children)
  // OR any descendant matches (show path to match).
  Set<int> _computeVisibleForSearch(String q) {
    final visible = <int>{};
    bool visit(_WbsNode n) {
      // Never search inside hidden subtrees
      if (_hiddenNodes.contains(n.id)) return false;
      final selfMatches = n.name.toLowerCase().contains(q) || (n.code?.toLowerCase().contains(q) ?? false);
      if (selfMatches) {
        // Mark self and ALL descendants visible (parent match → show full subtree)
        void markAll(_WbsNode x) {
          if (_hiddenNodes.contains(x.id)) return;
          visible.add(x.id);
          for (final c in x.children) markAll(c);
        }
        markAll(n);
        return true;
      }
      bool anyChild = false;
      for (final c in n.children) {
        if (visit(c)) anyChild = true;
      }
      if (anyChild) visible.add(n.id); // show this branch because a child matched
      return anyChild;
    }
    for (final r in widget.roots) visit(r);
    return visible;
  }

  // ── Recursive node builder ────────────────────────────────────────────────
  //
  // [visibleIds] is non-null only in search mode — only nodes in the set are shown,
  // and all visible branches are auto-expanded.

  Widget _buildNode(_WbsNode node, {int depth = 0, Set<int>? visibleIds}) {
    // Hidden nodes are never shown — even in search mode
    if (_hiddenNodes.contains(node.id)) return const SizedBox.shrink();
    // Search mode: skip nodes not in the visible set
    if (visibleIds != null && !visibleIds.contains(node.id)) return const SizedBox.shrink();

    if (node.isLeaf) {
      return _LeafTile(node: node, depth: depth, onTap: () => Navigator.pop(context, node));
    }

    final isSearchMode = visibleIds != null;
    // In search mode always expand so matched paths are visible
    final isExpanded = isSearchMode ? true : _expanded.contains(node.id);
    final color = _depthColor(depth);
    final leftPad = 12.0 + depth * 14.0;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      InkWell(
        onTap: isSearchMode ? null : () => setState(() {
          if (isExpanded) _expanded.remove(node.id); else _expanded.add(node.id);
        }),
        child: Container(
          color: color.withValues(alpha: 0.06 + depth * 0.012),
          padding: EdgeInsets.fromLTRB(leftPad, 9, 12, 9),
          child: Row(children: [
            Icon(_depthIcon(depth), size: 13, color: color),
            const SizedBox(width: 6),
            Expanded(child: Text(
              node.code != null ? '${node.code}  ${node.name}' : node.name,
              style: TextStyle(
                fontSize: (13 - depth.clamp(0, 2)).toDouble(),
                fontWeight: FontWeight.w700, color: color,
              ),
            )),
            // Hide button for L1/L2/L3 (depth 0-2) — only in normal mode
            if (!isSearchMode && depth <= 2)
              GestureDetector(
                onTap: () {
                  setState(() => _hiddenNodes.add(node.id));
                  _saveHiddenNodes();
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Icon(Icons.visibility_off_outlined, size: 14, color: color.withValues(alpha: 0.6)),
                ),
              ),
            if (!isSearchMode) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                child: Text('${node.leafCount}',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
              ),
              const SizedBox(width: 4),
              Icon(isExpanded ? Icons.expand_less : Icons.expand_more, size: 16, color: color),
            ],
          ]),
        ),
      ),
      if (isExpanded)
        ...node.children.map((child) => _buildNode(child, depth: depth + 1, visibleIds: visibleIds)),
    ]);
  }

  static Color _depthColor(int depth) {
    switch (depth % 4) {
      case 0: return Colors.indigo.shade700;
      case 1: return Colors.blue.shade700;
      case 2: return Colors.teal.shade700;
      default: return Colors.green.shade700;
    }
  }

  static IconData _depthIcon(int depth) {
    switch (depth) {
      case 0: return Icons.corporate_fare_outlined;
      case 1: return Icons.domain_outlined;
      case 2: return Icons.layers_outlined;
      default: return Icons.subdirectory_arrow_right;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSearching = _query.isNotEmpty;
    final isMapped = widget.currentLinkedId != null;
    final hiddenCount = _hiddenNodes.length;
    return DraggableScrollableSheet(
      initialChildSize: 0.88,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (_, scrollCtrl) => Column(children: [
        // Handle
        Center(child: Container(
          margin: const EdgeInsets.only(top: 10, bottom: 4),
          width: 36, height: 4,
          decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(2)),
        )),
        // Title row
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 10, 2),
          child: Row(children: [
            const Icon(Icons.account_tree_outlined, size: 17, color: Colors.indigo),
            const SizedBox(width: 8),
            const Expanded(child: Text('Link to Schedule Activity',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold))),
            if (!isSearching)
              TextButton.icon(
                onPressed: _allCollapsed ? _expandAll : _collapseAll,
                icon: Icon(_allCollapsed ? Icons.unfold_more : Icons.unfold_less, size: 14),
                label: Text(_allCollapsed ? 'Expand All' : 'Collapse All',
                    style: const TextStyle(fontSize: 11)),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
          ]),
        ),
        // Currently linked row + Unlink button
        if (isMapped)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 2),
            child: Row(children: [
              Icon(Icons.link, size: 13, color: Colors.green.shade600),
              const SizedBox(width: 4),
              Expanded(child: Text(widget.currentLinked,
                  style: TextStyle(fontSize: 11, color: Colors.green.shade700),
                  overflow: TextOverflow.ellipsis, maxLines: 2)),
              const SizedBox(width: 6),
              TextButton.icon(
                onPressed: () => Navigator.pop(context, _WbsNode.unlink),
                icon: const Icon(Icons.link_off, size: 13),
                label: const Text('Unlink', style: TextStyle(fontSize: 11)),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.red.shade600,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ]),
          ),
        // Hidden-sections bar
        if (hiddenCount > 0 && !isSearching)
          InkWell(
            onTap: () {
              setState(() => _hiddenNodes.clear());
              _saveHiddenNodes();
            },
            child: Container(
              width: double.infinity,
              color: Colors.orange.shade50,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              child: Row(children: [
                Icon(Icons.visibility_outlined, size: 13, color: Colors.orange.shade700),
                const SizedBox(width: 6),
                Text('$hiddenCount section${hiddenCount > 1 ? "s" : ""} hidden — tap to show all',
                    style: TextStyle(fontSize: 11, color: Colors.orange.shade800)),
              ]),
            ),
          ),
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 6),
          child: TextField(
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: 'Search — parent match shows all children…',
              prefixIcon: const Icon(Icons.search, size: 18),
              border: const OutlineInputBorder(),
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 8),
              suffixIcon: _query.isNotEmpty
                  ? IconButton(icon: const Icon(Icons.clear, size: 16),
                      onPressed: () { _searchCtrl.clear(); setState(() => _query = ''); })
                  : null,
            ),
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: isSearching
              ? _buildSearchTree(scrollCtrl)
              : _buildTreeView(scrollCtrl),
        ),
      ]),
    );
  }

  // ── Search tree (search mode) ─────────────────────────────────────────────
  // Renders the tree filtered to only matching subtrees, auto-expanded.

  Widget _buildSearchTree(ScrollController ctrl) {
    final visibleIds = _computeVisibleForSearch(_query.toLowerCase());
    final visibleRoots = widget.roots.where((r) => visibleIds.contains(r.id)).toList();
    if (visibleRoots.isEmpty) {
      return Center(child: Padding(
        padding: const EdgeInsets.all(32),
        child: Text('No activities match "$_query"',
            style: const TextStyle(color: Colors.grey), textAlign: TextAlign.center),
      ));
    }
    return ListView(
      controller: ctrl,
      padding: const EdgeInsets.only(bottom: 24),
      children: visibleRoots.map((r) => _buildNode(r, visibleIds: visibleIds)).toList(),
    );
  }

  // ── Tree view (default mode) ──────────────────────────────────────────────

  Widget _buildTreeView(ScrollController ctrl) {
    final suggested = widget.suggestedNext;
    final lastLinked = widget.lastLinked;
    return ListView(
      controller: ctrl,
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        // ── Suggested Next ───────────────────────────────────────────────────
        if (suggested != null) ...[
          _PinHeader(
            icon: Icons.arrow_forward_rounded,
            label: 'Suggested Next',
            color: Colors.deepPurple.shade700,
          ),
          _LeafTile(
            node: suggested,
            depth: 0,
            highlightColor: Colors.deepPurple.shade50,
            highlightIcon: Icons.bolt_rounded,
            highlightIconColor: Colors.deepPurple.shade600,
            onTap: () => Navigator.pop(context, suggested),
          ),
          const Divider(height: 1),
        ],
        // ── Last Linked (only if different from suggested) ────────────────────
        if (lastLinked != null && lastLinked.id != suggested?.id) ...[
          _PinHeader(
            icon: Icons.history_rounded,
            label: 'Last Linked',
            color: Colors.teal.shade700,
          ),
          _LeafTile(
            node: lastLinked,
            depth: 0,
            highlightColor: Colors.teal.shade50,
            highlightIcon: Icons.check_circle_outline_rounded,
            highlightIconColor: Colors.teal.shade600,
            onTap: () => Navigator.pop(context, lastLinked),
          ),
          const Divider(height: 1),
        ],
        // ── WBS tree (_buildNode handles hidden nodes at any depth) ──────────
        ...widget.roots.map((root) => _buildNode(root)),
      ],
    );
  }
}

// ── Shared sub-widgets ────────────────────────────────────────────────────────

class _PinHeader extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _PinHeader({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    color: color.withValues(alpha: 0.07),
    padding: const EdgeInsets.fromLTRB(14, 8, 12, 8),
    child: Row(children: [
      Icon(icon, size: 13, color: color),
      const SizedBox(width: 6),
      Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    ]),
  );
}

class _LeafTile extends StatelessWidget {
  final _WbsNode node;
  final int depth;
  final bool showCode;
  final Color? highlightColor;
  final IconData? highlightIcon;
  final Color? highlightIconColor;
  final VoidCallback onTap;

  const _LeafTile({
    required this.node,
    required this.depth,
    required this.onTap,
    this.showCode = true,
    this.highlightColor,
    this.highlightIcon,
    this.highlightIconColor,
  });

  @override
  Widget build(BuildContext context) {
    final leftPad = 16.0 + depth * 14.0;
    final isHighlighted = highlightColor != null;
    return InkWell(
      onTap: onTap,
      child: Container(
        color: highlightColor,
        padding: EdgeInsets.fromLTRB(leftPad, 10, 12, 10),
        child: Row(children: [
          Icon(
            highlightIcon ?? Icons.radio_button_unchecked,
            size: 14,
            color: highlightIconColor ?? Colors.indigo.shade300,
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              showCode && node.code != null ? '${node.code} · ${node.name}' : node.name,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isHighlighted ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ])),
        ]),
      ),
    );
  }
}
