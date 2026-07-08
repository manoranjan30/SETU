import 'package:flutter/material.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/injection_container.dart';

/// WO–Schedule Linker — shows the audit of Work Order Item → Activity mappings.
/// Fetches from `GET /planning/:projectId/wo-mapper/mappings` which returns
/// each WO item that has been distributed to an activity (same data the web
/// app's Execution Mapper shows in its audit/review panel).
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
  List<_WoMapping> _mappings = [];
  List<_WoItem> _unlinkedItems = [];
  String _search = '';

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        sl<SetuApiClient>().getWoMappings(widget.project.id),
        sl<SetuApiClient>().getWoItemsTree(widget.project.id).catchError((_) => null),
      ]);

      final mappingRaw = results[0] as List<dynamic>;
      final mappings = mappingRaw.map((e) => _WoMapping.fromJson(e as Map<String, dynamic>)).toList();

      // Build set of already-mapped WO item IDs
      final mappedIds = {for (final m in mappings) m.workOrderItemId};

      // Extract unlinked items from the vendor tree
      final unlinked = <_WoItem>[];
      final treeRaw = results[1];
      if (treeRaw != null) {
        _extractWoItems(treeRaw, unlinked, mappedIds);
      }

      if (mounted) setState(() {
        _mappings = mappings;
        _unlinkedItems = unlinked;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load: $e'; _loading = false; });
    }
  }

  void _extractWoItems(dynamic node, List<_WoItem> out, Set<dynamic> mappedIds) {
    if (node is List) {
      for (final item in node) { _extractWoItems(item, out, mappedIds); }
    } else if (node is Map) {
      // Work order item node — has workOrderItemId
      final itemId = node['workOrderItemId'] ?? node['id'];
      final desc = node['description'] as String? ?? node['itemDescription'] as String? ?? '';
      if (itemId != null && desc.isNotEmpty && !mappedIds.contains(itemId)) {
        out.add(_WoItem(
          id: itemId.toString(),
          description: desc,
          woNumber: node['woNumber'] as String? ?? '',
          vendorName: node['vendorName'] as String? ?? '',
          boqCode: node['boqCode'] as String? ?? '',
        ));
      }
      // Recurse into children/items
      for (final key in ['children', 'items', 'workOrders', 'vendors']) {
        if (node[key] != null) _extractWoItems(node[key], out, mappedIds);
      }
    }
  }

  List<_WoMapping> get _filteredMappings {
    if (_search.isEmpty) return _mappings;
    final q = _search.toLowerCase();
    return _mappings.where((m) =>
        m.activityName.toLowerCase().contains(q) ||
        m.activityCode.toLowerCase().contains(q) ||
        m.woItemDescription.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('WO–Schedule Linker', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text(widget.project.name, style: const TextStyle(fontSize: 12)),
        ]),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
        bottom: TabBar(
          controller: _tab,
          tabs: [
            Tab(text: 'Linked (${_mappings.length})'),
            Tab(text: 'Unlinked (${_unlinkedItems.length})'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 12),
                  Text(_error!),
                  const SizedBox(height: 16),
                  ElevatedButton(onPressed: _load, child: const Text('Retry')),
                ]))
              : TabBarView(
                  controller: _tab,
                  children: [
                    // Tab 0 — Linked mappings (audit)
                    Column(children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                        child: TextField(
                          decoration: const InputDecoration(
                            hintText: 'Search activity, WO item…',
                            prefixIcon: Icon(Icons.search, size: 18),
                            isDense: true, border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(vertical: 8),
                          ),
                          onChanged: (v) => setState(() => _search = v),
                        ),
                      ),
                      Expanded(
                        child: _filteredMappings.isEmpty
                            ? const Center(child: Padding(
                                padding: EdgeInsets.all(24),
                                child: Text('No WO items linked to schedule activities yet.\nUse the web app\'s Execution Mapper to create linkages.', textAlign: TextAlign.center),
                              ))
                            : ListView.separated(
                                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                                itemCount: _filteredMappings.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 8),
                                itemBuilder: (_, i) => _MappingCard(mapping: _filteredMappings[i]),
                              ),
                      ),
                    ]),
                    // Tab 1 — Unlinked items
                    _unlinkedItems.isEmpty
                        ? const Center(child: Text('All WO items are linked to schedule activities.'))
                        : ListView.separated(
                            padding: const EdgeInsets.all(12),
                            itemCount: _unlinkedItems.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (_, i) => _UnlinkedCard(item: _unlinkedItems[i]),
                          ),
                  ],
                ),
    );
  }
}

class _MappingCard extends StatelessWidget {
  final _WoMapping mapping;
  const _MappingCard({required this.mapping});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.green.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Activity
          Row(children: [
            const Icon(Icons.timeline_outlined, size: 14, color: Colors.indigo),
            const SizedBox(width: 6),
            Expanded(child: Text(
              '${mapping.activityCode.isNotEmpty ? "${mapping.activityCode} · " : ""}${mapping.activityName}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            )),
          ]),
          const SizedBox(height: 6),
          // WO item
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(6)),
            child: Row(children: [
              const Icon(Icons.description_outlined, size: 13, color: Colors.purple),
              const SizedBox(width: 6),
              Expanded(child: Text(mapping.woItemDescription, style: const TextStyle(fontSize: 12))),
            ]),
          ),
          if (mapping.plannedQty > 0) ...[
            const SizedBox(height: 4),
            Text('Planned Qty: ${mapping.plannedQty}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ],
          const SizedBox(height: 4),
          Text('Type: ${mapping.mappingType}',
              style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
        ]),
      ),
    );
  }
}

class _UnlinkedCard extends StatelessWidget {
  final _WoItem item;
  const _UnlinkedCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.orange.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.description_outlined, size: 14, color: Colors.purple),
            const SizedBox(width: 6),
            Expanded(child: Text(item.description, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
          ]),
          if (item.boqCode.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('BOQ: ${item.boqCode}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ],
          const SizedBox(height: 4),
          Row(children: [
            if (item.woNumber.isNotEmpty) ...[
              Icon(Icons.receipt_outlined, size: 12, color: Colors.grey.shade500),
              const SizedBox(width: 4),
              Text(item.woNumber, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              const SizedBox(width: 12),
            ],
            if (item.vendorName.isNotEmpty) ...[
              Icon(Icons.business_outlined, size: 12, color: Colors.grey.shade500),
              const SizedBox(width: 4),
              Expanded(child: Text(item.vendorName, style: TextStyle(fontSize: 11, color: Colors.grey.shade600))),
            ],
          ]),
          const SizedBox(height: 6),
          Text('Not linked to any schedule activity — use the web app to link.',
              style: TextStyle(fontSize: 11, color: Colors.orange.shade700, fontStyle: FontStyle.italic)),
        ]),
      ),
    );
  }
}

class _WoMapping {
  final String workOrderItemId;
  final String activityCode;
  final String activityName;
  final double plannedQty;
  final String mappingType;
  final String woItemDescription;

  const _WoMapping({
    required this.workOrderItemId, required this.activityCode,
    required this.activityName, required this.plannedQty,
    required this.mappingType, required this.woItemDescription,
  });

  factory _WoMapping.fromJson(Map<String, dynamic> j) => _WoMapping(
    workOrderItemId: j['workOrderItemId']?.toString() ?? '',
    activityCode: j['activityCode'] as String? ?? '',
    activityName: j['activityName'] as String? ?? '',
    plannedQty: ((j['plannedQuantity'] ?? 0) as num).toDouble(),
    mappingType: j['mappingType'] as String? ?? 'DIRECT',
    woItemDescription: j['treePath'] as String? ?? j['workOrderItemId']?.toString() ?? '',
  );
}

class _WoItem {
  final String id;
  final String description;
  final String woNumber;
  final String vendorName;
  final String boqCode;
  const _WoItem({required this.id, required this.description, required this.woNumber, required this.vendorName, required this.boqCode});
}
