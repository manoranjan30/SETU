import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/snag_desnag_models.dart';
import 'package:setu_mobile/features/quality/presentation/pages/snag_unit_workspace_page.dart';

/// Process-step-first Block > Tower > Floor > Unit drilldown over the flat
/// unit list from `GET /snag/:projectId/units`.
///
/// Per the mobile handoff's "Required Mobile Workflow Hierarchy": the
/// configured process steps are the *primary* navigation, not an optional
/// filter layered on top of a unit-first drilldown. Selecting a step never
/// hides units that aren't on that step — every unit still appears at
/// every level, but its status label/color and whether it's tappable are
/// computed *relative to the selected step* via [computeSnagStepUnitStatus].
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
  late int? _selectedStepSerial = widget.processSteps.isEmpty
      ? null
      : (widget.processSteps.map((s) => s.workflowSerialNo).toList()..sort()).first;
  int? _selectedBlockId;
  String? _selectedBlockLabel;
  int? _selectedTowerId;
  String? _selectedTowerLabel;
  int? _selectedFloorId;
  String? _selectedFloorLabel;

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
            units: widget.units,
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
          Expanded(child: _selectedStepSerial == null ? _buildNoSteps() : _buildLevel(context, _selectedStepSerial!)),
        ],
      ),
    );
  }

  Widget _buildNoSteps() {
    return const Center(
      child: Text('No process steps are configured for this project.', style: TextStyle(color: Colors.grey)),
    );
  }

  Widget _buildLevel(BuildContext context, int selectedStep) {
    switch (_level) {
      case _Level.block:
        final blocks = <int, String>{};
        for (final u in widget.units) {
          if (u.blockId != null) blocks[u.blockId!] = u.blockLabel ?? 'Block ${u.blockId}';
        }
        return _EntryList(
          entries: blocks.entries.map((e) => (id: e.key, label: e.value)).toList(),
          icon: Icons.apartment_outlined,
          emptyMessage: 'No blocks found.',
          onTap: (id, label) => setState(() {
            _selectedBlockId = id;
            _selectedBlockLabel = label;
          }),
        );

      case _Level.tower:
        final scoped = widget.units.where((u) => _selectedBlockId == null || u.blockId == _selectedBlockId);
        final towers = <int, String>{};
        for (final u in scoped) {
          towers[u.towerId] = u.towerLabel;
        }
        return _EntryList(
          entries: towers.entries.map((e) => (id: e.key, label: e.value)).toList(),
          icon: Icons.location_city_outlined,
          emptyMessage: 'No towers found.',
          onTap: (id, label) => setState(() {
            _selectedTowerId = id;
            _selectedTowerLabel = label;
          }),
        );

      case _Level.floor:
        final scoped = widget.units.where((u) => u.towerId == _selectedTowerId);
        final floors = <int, String>{};
        for (final u in scoped) {
          floors[u.floorId] = u.floorLabel;
        }
        return _EntryList(
          entries: floors.entries.map((e) => (id: e.key, label: e.value)).toList(),
          icon: Icons.layers_outlined,
          emptyMessage: 'No floors found.',
          onTap: (id, label) => setState(() {
            _selectedFloorId = id;
            _selectedFloorLabel = label;
          }),
        );

      case _Level.unit:
        final scoped = widget.units.where((u) => u.floorId == _selectedFloorId).toList()
          ..sort((a, b) => a.unitLabel.compareTo(b.unitLabel));
        if (scoped.isEmpty) {
          return const Center(child: Text('No units on this floor.', style: TextStyle(color: Colors.grey)));
        }
        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: scoped.length,
          itemBuilder: (_, i) {
            final unit = scoped[i];
            final status = computeSnagStepUnitStatus(unit, selectedStep);
            return _UnitCard(
              unit: unit,
              status: status,
              selectedStep: selectedStep,
              onTap: status.isLocked ? null : () => _openUnit(context, unit),
            );
          },
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
        snagListId: unit.snagListId,
      ),
    ));
  }
}

class _StepFilterBar extends StatelessWidget {
  final List<SnagProcessStep> steps;
  final List<SnagUnitSummary> units;
  final int? selectedSerial;
  final ValueChanged<int?> onSelected;

  const _StepFilterBar({
    required this.steps,
    required this.units,
    required this.selectedSerial,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) return const SizedBox.shrink();
    final sorted = [...steps]..sort((a, b) => a.workflowSerialNo.compareTo(b.workflowSerialNo));
    return SizedBox(
      height: 56,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [
          for (final s in sorted)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _StepChip(
                step: s,
                units: units,
                selected: selectedSerial == s.workflowSerialNo,
                onTap: () => onSelected(s.workflowSerialNo),
              ),
            ),
        ],
      ),
    );
  }
}

class _StepChip extends StatelessWidget {
  final SnagProcessStep step;
  final List<SnagUnitSummary> units;
  final bool selected;
  final VoidCallback onTap;

  const _StepChip({required this.step, required this.units, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    var active = 0, waiting = 0, done = 0;
    for (final u in units) {
      switch (computeSnagStepUnitStatus(u, step.workflowSerialNo).bucket) {
        case SnagStepCounterBucket.active:
          active++;
        case SnagStepCounterBucket.waiting:
          waiting++;
        case SnagStepCounterBucket.done:
          done++;
        case SnagStepCounterBucket.locked:
          break;
      }
    }
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? theme.colorScheme.primary.withValues(alpha: 0.1) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? theme.colorScheme.primary : Colors.grey.shade300),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              step.name,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: selected ? theme.colorScheme.primary : Colors.grey.shade800,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '$active active • $waiting waiting • $done done',
              style: TextStyle(fontSize: 9, color: Colors.grey.shade600),
            ),
          ],
        ),
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
  final SnagStepUnitStatus status;
  final int selectedStep;
  final VoidCallback? onTap;

  const _UnitCard({required this.unit, required this.status, required this.selectedStep, required this.onTap});

  Color get _statusColor => switch (status) {
    SnagStepUnitStatus.notReady => Colors.grey,
    SnagStepUnitStatus.locked => const Color(0xFF9CA3AF),
    SnagStepUnitStatus.readyForStep => Colors.purple,
    SnagStepUnitStatus.open => Colors.deepOrange,
    SnagStepUnitStatus.desnagActive => Colors.blue,
    SnagStepUnitStatus.closedNextPending => Colors.teal,
    SnagStepUnitStatus.readyRequestPending => Colors.amber.shade800,
    SnagStepUnitStatus.stepCompleted => Colors.green,
    SnagStepUnitStatus.customerInspectionReady => const Color(0xFF15803D),
  };

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.grey.shade200)),
      child: Opacity(
        opacity: status.isLocked ? 0.6 : 1,
        child: ListTile(
          onTap: onTap,
          title: Text(unit.unitLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          subtitle: Text('${unit.roomCount} rooms', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: _statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Text(
              status.label(selectedStep),
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor),
            ),
          ),
        ),
      ),
    );
  }
}
