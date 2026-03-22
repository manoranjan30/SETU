import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/dashboard_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_dashboard_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/floor_activity_dashboard_page.dart';

/// Shows all floors of a block in a colour-coded grid.
/// Tapping a floor drills into its activity list.
class BlockFloorsPage extends StatelessWidget {
  final int projectId;
  final BlockSummary block;

  const BlockFloorsPage({
    super.key,
    required this.projectId,
    required this.block,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(block.name,
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.bold)),
            Text(
              '${block.floors.length} floors'
              ' · ${(block.pct * 100).toStringAsFixed(0)}% complete',
              style:
                  const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
            ),
          ],
        ),
      ),
      body: block.floors.isEmpty
          ? const _NoFloorsView()
          : CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: _SummaryBar(block: block),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: _Legend(),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverGrid(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final floor = block.floors[index];
                        return _FloorTile(
                          floor: floor,
                          onTap: () => _openFloor(context, floor),
                        );
                      },
                      childCount: block.floors.length,
                    ),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: 1.0,
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  void _openFloor(BuildContext context, FloorSummary floor) {
    context.read<QualityDashboardBloc>().add(LoadFloorDetail(
          projectId: projectId,
          floorId: floor.floorId,
          floorLabel: floor.label,
          blockName: block.name,
        ));
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<QualityDashboardBloc>(),
          child: FloorActivityDashboardPage(
            projectId: projectId,
            floorId: floor.floorId,
            floorLabel: floor.label,
            blockName: block.name,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Bar
// ─────────────────────────────────────────────────────────────────────────────

class _SummaryBar extends StatelessWidget {
  final BlockSummary block;
  const _SummaryBar({required this.block});

  @override
  Widget build(BuildContext context) {
    final total = block.floors.length;
    final done = block.floors.where((f) => f.status == FloorStatus.allDone).length;
    final action = block.floors.where((f) => f.status == FloorStatus.needsAction).length;
    final awaiting = block.floors.where((f) => f.status == FloorStatus.awaitingApproval).length;
    final progress = block.floors.where((f) => f.status == FloorStatus.inProgress).length;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 6,
              offset: const Offset(0, 2))
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _MiniStat(value: '$total', label: 'Floors', color: const Color(0xFF374151)),
          _MiniStat(value: '$done', label: 'Done', color: const Color(0xFF4CAF50)),
          _MiniStat(value: '$awaiting', label: 'Awaiting', color: const Color(0xFFFF9800)),
          _MiniStat(value: '$action', label: 'Action', color: const Color(0xFFF44336)),
          _MiniStat(value: '$progress', label: 'Progress', color: const Color(0xFF2196F3)),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  const _MiniStat(
      {required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: color,
                height: 1.1)),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(
                fontSize: 10,
                color: Color(0xFF6B7280),
                fontWeight: FontWeight.w500)),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────────

class _Legend extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 14,
      runSpacing: 4,
      children: FloorStatus.values.map((s) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                    color: s.color, borderRadius: BorderRadius.circular(3))),
            const SizedBox(width: 4),
            Text(_label(s),
                style: const TextStyle(
                    fontSize: 10, color: Color(0xFF6B7280))),
          ],
        );
      }).toList(),
    );
  }

  String _label(FloorStatus s) {
    switch (s) {
      case FloorStatus.allDone:
        return 'All Done';
      case FloorStatus.inProgress:
        return 'In Progress';
      case FloorStatus.awaitingApproval:
        return 'Awaiting';
      case FloorStatus.needsAction:
        return 'Needs Action';
      case FloorStatus.notStarted:
        return 'Not Started';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Floor Tile
// ─────────────────────────────────────────────────────────────────────────────

/// Stateful so we can run a looping pulse animation on NeedsAction floors.
class _FloorTile extends StatefulWidget {
  final FloorSummary floor;
  final VoidCallback onTap;

  const _FloorTile({required this.floor, required this.onTap});

  @override
  State<_FloorTile> createState() => _FloorTileState();
}

class _FloorTileState extends State<_FloorTile>
    with SingleTickerProviderStateMixin {
  AnimationController? _pulse;
  Animation<double>? _opacity;

  @override
  void initState() {
    super.initState();
    if (widget.floor.status == FloorStatus.needsAction) {
      _pulse = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 900),
      )..repeat(reverse: true);
      _opacity = Tween<double>(begin: 0.55, end: 1.0).animate(
        CurvedAnimation(parent: _pulse!, curve: Curves.easeInOut),
      );
    }
  }

  @override
  void dispose() {
    _pulse?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.floor.status;
    final color = s.color;
    final bg = s.bgColor;
    final icon = s.icon;
    final badgeCount = widget.floor.pendingCount;

    Widget tile = Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: widget.onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: color.withValues(alpha: 0.35),
                width: s == FloorStatus.needsAction ? 2.0 : 1.5),
            boxShadow: [
              BoxShadow(
                  color: color.withValues(alpha: 0.08),
                  blurRadius: 4,
                  offset: const Offset(0, 2))
            ],
          ),
          child: Stack(
            children: [
              // Soft background tint
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(11),
                  ),
                ),
              ),
              // Content
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, color: color, size: 22),
                    const SizedBox(height: 5),
                    Text(
                      widget.floor.label,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: color,
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              // Pending count badge (top-right)
              if (badgeCount > 0)
                Positioned(
                  top: 5,
                  right: 5,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '$badgeCount',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );

    // Wrap needsAction tiles in a pulsing opacity to grab attention.
    if (_opacity != null) {
      tile = AnimatedBuilder(
        animation: _opacity!,
        builder: (_, child) => Opacity(opacity: _opacity!.value, child: child),
        child: tile,
      );
    }

    return tile;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _NoFloorsView extends StatelessWidget {
  const _NoFloorsView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.layers_outlined, size: 56, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          const Text('No floor data yet',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF9CA3AF))),
          const SizedBox(height: 4),
          const Text('Floors will appear once checklists are assigned.',
              style: TextStyle(fontSize: 12, color: Color(0xFFD1D5DB))),
        ],
      ),
    );
  }
}
