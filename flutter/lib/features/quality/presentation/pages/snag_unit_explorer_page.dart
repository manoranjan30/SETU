import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/snag_desnag_models.dart';
import 'package:setu_mobile/features/quality/presentation/pages/snag_unit_workspace_page.dart';

/// Block > Tower > Floor > Unit drilldown over the flat unit list from
/// `GET /snag/:projectId/units`, with an optional process-step filter.
///
/// Unit cards intentionally show only what [SnagUnitSummary] actually
/// carries (status, current round/step, room count) — not open/rectified/
/// closed item counts, since the bulk units endpoint doesn't return
/// item-level data (see [SnagDesnagDashboardPage]'s doc comment for why).
/// Tapping a unit fetches that one unit's real detail on demand instead.
class SnagUnitExplorerPage extends StatefulWidget {
  final int projectId;
  final List<SnagProcessStep> processSteps;
  final List<SnagUnitSummary> units;

  const SnagUnitExplorerPage({
    super.key,
    required this.projectId,
    required this.processSteps,
    required this.units,
  });

  @override
  State<SnagUnitExplorerPage> createState() => _SnagUnitExplorerPageState();
}

enum _Level { block, tower, floor, unit }

class _SnagUnitExplorerPageState extends State<SnagUnitExplorerPage> {
  int? _selectedStepSerial; // null = all steps
  int? _selectedBlockId;
  String? _selectedBlockLabel;
  int? _selectedTowerId;
  String? _selectedTowerLabel;
  int? _selectedFloorId;
  String? _selectedFloorLabel;

  List<SnagUnitSummary> get _filteredByStep => _selectedStepSerial == null
      ? widget.units
      : widget.units.where((u) => u.currentRound == _selectedStepSerial).toList();

  bool get _hasBlocks => widget.units.any((u) => u.blockId != null);

  _Level get _level {
    if (_hasBlocks && _selectedBlockId == null) return _Level.block;
    if (_selectedTowerId == null) return _Level.tower;
    if (_selectedFloorId == null) return _Level.floor;
    return _Level.unit;
  }

  void _reset() {
    setState(() {
      _selectedBlockId = null;
      _selectedTowerId = null;
      _selectedFloorId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Unit Explorer', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          _StepFilterBar(
            steps: widget.processSteps,
            selectedSerial: _selectedStepSerial,
            onSelected: (serial) => setState(() => _selectedStepSerial = serial),
          ),
          _Breadcrumb(
            blockLabel: _selectedBlockLabel,
            towerLabel: _selectedTowerLabel,
            floorLabel: _selectedFloorLabel,
            onHome: _reset,
            onBlock: () => setState(() {
              _selectedTowerId = null;
              _selectedFloorId = null;
            }),
            onTower: () => setState(() => _selectedFloorId = null),
          ),
          const Divider(height: 1),
          Expanded(child: _buildLevel(context)),
        ],
      ),
    );
  }

  Widget _buildLevel(BuildContext context) {
    switch (_level) {
      case _Level.block:
        final blocks = <int, String>{};
        for (final u in _filteredByStep) {
          if (u.blockId != null) blocks[u.blockId!] = u.blockLabel ?? 'Block ${u.blockId}';
        }
        return _EntryList(
          entries: blocks.entries.map((e) => (id: e.key, label: e.value)).toList(),
          icon: Icons.apartment_outlined,
          emptyMessage: 'No blocks found for this filter.',
          onTap: (id, label) => setState(() {
            _selectedBlockId = id;
            _selectedBlockLabel = label;
          }),
        );

      case _Level.tower:
        final scoped = _filteredByStep.where((u) => _selectedBlockId == null || u.blockId == _selectedBlockId);
        final towers = <int, String>{};
        for (final u in scoped) {
          towers[u.towerId] = u.towerLabel;
        }
        return _EntryList(
          entries: towers.entries.map((e) => (id: e.key, label: e.value)).toList(),
          icon: Icons.location_city_outlined,
          emptyMessage: 'No towers found for this filter.',
          onTap: (id, label) => setState(() {
            _selectedTowerId = id;
            _selectedTowerLabel = label;
          }),
        );

      case _Level.floor:
        final scoped = _filteredByStep.where((u) => u.towerId == _selectedTowerId);
        final floors = <int, String>{};
        for (final u in scoped) {
          floors[u.floorId] = u.floorLabel;
        }
        return _EntryList(
          entries: floors.entries.map((e) => (id: e.key, label: e.value)).toList(),
          icon: Icons.layers_outlined,
          emptyMessage: 'No floors found for this filter.',
          onTap: (id, label) => setState(() {
            _selectedFloorId = id;
            _selectedFloorLabel = label;
          }),
        );

      case _Level.unit:
        final scoped = _filteredByStep.where((u) => u.floorId == _selectedFloorId).toList()
          ..sort((a, b) => a.unitLabel.compareTo(b.unitLabel));
        if (scoped.isEmpty) {
          return const Center(child: Text('No units on this floor.', style: TextStyle(color: Colors.grey)));
        }
        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: scoped.length,
          itemBuilder: (_, i) => _UnitCard(
            unit: scoped[i],
            processSteps: widget.processSteps,
            onTap: () => _openUnit(context, scoped[i]),
          ),
        );
    }
  }

  Future<void> _openUnit(BuildContext context, SnagUnitSummary unit) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => SnagUnitWorkspacePage(
        projectId: widget.projectId,
        qualityUnitId: unit.qualityUnitId,
        unitLabel: unit.unitLabel,
        towerLabel: unit.towerLabel,
        floorLabel: unit.floorLabel,
        blockLabel: unit.blockLabel,
      ),
    ));
  }
}

class _StepFilterBar extends StatelessWidget {
  final List<SnagProcessStep> steps;
  final int? selectedSerial;
  final ValueChanged<int?> onSelected;

  const _StepFilterBar({required this.steps, required this.selectedSerial, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: ChoiceChip(
              label: const Text('All Steps', style: TextStyle(fontSize: 11)),
              selected: selectedSerial == null,
              onSelected: (_) => onSelected(null),
            ),
          ),
          for (final s in steps)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ChoiceChip(
                label: Text(s.name, style: const TextStyle(fontSize: 11)),
                selected: selectedSerial == s.workflowSerialNo,
                onSelected: (_) => onSelected(s.workflowSerialNo),
              ),
            ),
        ],
      ),
    );
  }
}

class _Breadcrumb extends StatelessWidget {
  final String? blockLabel;
  final String? towerLabel;
  final String? floorLabel;
  final VoidCallback onHome;
  final VoidCallback onBlock;
  final VoidCallback onTower;

  const _Breadcrumb({
    required this.blockLabel,
    required this.towerLabel,
    required this.floorLabel,
    required this.onHome,
    required this.onBlock,
    required this.onTower,
  });

  @override
  Widget build(BuildContext context) {
    if (blockLabel == null && towerLabel == null) return const SizedBox.shrink();
    final crumbs = <Widget>[
      InkWell(onTap: onHome, child: const Icon(Icons.home_outlined, size: 16)),
    ];
    if (blockLabel != null) {
      crumbs.add(const Icon(Icons.chevron_right, size: 14, color: Colors.grey));
      crumbs.add(InkWell(onTap: onBlock, child: Text(blockLabel!, style: const TextStyle(fontSize: 12))));
    }
    if (towerLabel != null) {
      crumbs.add(const Icon(Icons.chevron_right, size: 14, color: Colors.grey));
      crumbs.add(InkWell(onTap: onTower, child: Text(towerLabel!, style: const TextStyle(fontSize: 12))));
    }
    if (floorLabel != null) {
      crumbs.add(const Icon(Icons.chevron_right, size: 14, color: Colors.grey));
      crumbs.add(Text(floorLabel!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)));
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Wrap(spacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: crumbs),
    );
  }
}

class _EntryList extends StatelessWidget {
  final List<({int id, String label})> entries;
  final IconData icon;
  final String emptyMessage;
  final void Function(int id, String label) onTap;

  const _EntryList({
    required this.entries,
    required this.icon,
    required this.emptyMessage,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return Center(child: Text(emptyMessage, style: const TextStyle(color: Colors.grey)));
    }
    final sorted = [...entries]..sort((a, b) => a.label.compareTo(b.label));
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: sorted.length,
      separatorBuilder: (_, __) => const SizedBox(height: 6),
      itemBuilder: (_, i) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.grey.shade200)),
        child: ListTile(
          leading: Icon(icon, color: Colors.indigo),
          title: Text(sorted[i].label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          trailing: const Icon(Icons.chevron_right, size: 18),
          onTap: () => onTap(sorted[i].id, sorted[i].label),
        ),
      ),
    );
  }
}

class _UnitCard extends StatelessWidget {
  final SnagUnitSummary unit;
  final List<SnagProcessStep> processSteps;
  final VoidCallback onTap;

  const _UnitCard({required this.unit, required this.processSteps, required this.onTap});

  Color get _statusColor => switch (unit.overallStatus) {
    SnagListStatus.unready => Colors.grey,
    SnagListStatus.readyForSnag => Colors.purple,
    SnagListStatus.snagging => Colors.deepOrange,
    SnagListStatus.desnagging => Colors.blue,
    SnagListStatus.released => Colors.teal,
    SnagListStatus.handoverReady => Colors.green,
  };

  String get _stepLabel {
    for (final s in processSteps) {
      if (s.workflowSerialNo == unit.currentRound) return s.name;
    }
    return 'Step ${unit.currentRound}';
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.grey.shade200)),
      child: ListTile(
        onTap: onTap,
        title: Text(unit.unitLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        subtitle: Text(
          unit.isNotStarted ? 'Not started' : '$_stepLabel • ${unit.roomCount} rooms',
          style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: _statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
          child: Text(
            unit.isNotStarted ? 'Not Started' : unit.overallStatus.label,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor),
          ),
        ),
      ),
    );
  }
}

