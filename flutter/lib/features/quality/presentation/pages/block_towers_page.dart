import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/dashboard_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_dashboard_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/block_floors_page.dart';

/// Shows all towers within a block as drillable cards.
/// Tapping a tower navigates to [BlockFloorsPage] scoped to that tower.
class BlockTowersPage extends StatelessWidget {
  final int projectId;
  final BlockSummary block;

  const BlockTowersPage({
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
              '${block.towers.length} towers'
              ' · ${(block.pct * 100).toStringAsFixed(0)}% complete',
              style:
                  const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
            ),
          ],
        ),
      ),
      body: block.towers.isEmpty
          ? const _NoTowersView()
          : CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: _BlockSummaryBar(block: block),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final tower = block.towers[index];
                        return _TowerCard(
                          tower: tower,
                          onTap: () => _openTower(context, tower),
                        );
                      },
                      childCount: block.towers.length,
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  void _openTower(BuildContext context, TowerSummary tower) {
    // Build a synthetic BlockSummary so BlockFloorsPage can render generically.
    final synthetic = BlockSummary(
      epsNodeId: tower.epsNodeId,
      name: '${block.name} · ${tower.name}',
      total: tower.total,
      approved: tower.approved,
      inReview: tower.inReview,
      pending: tower.pending,
      withObservation: tower.withObservation,
      floors: tower.floors,
    );

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<QualityDashboardBloc>(),
          child: BlockFloorsPage(
            projectId: projectId,
            block: synthetic,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Block-level summary bar (aggregated across all towers)
// ─────────────────────────────────────────────────────────────────────────────

class _BlockSummaryBar extends StatelessWidget {
  final BlockSummary block;
  const _BlockSummaryBar({required this.block});

  @override
  Widget build(BuildContext context) {
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
          _MiniStat(
              value: '${block.towers.length}',
              label: 'Towers',
              color: const Color(0xFF374151)),
          _MiniStat(
              value: '${block.approved}',
              label: 'Approved',
              color: const Color(0xFF4CAF50)),
          _MiniStat(
              value: '${block.inReview}',
              label: 'In Review',
              color: const Color(0xFFFF9800)),
          _MiniStat(
              value: '${block.pending}',
              label: 'Pending',
              color: const Color(0xFFF44336)),
          _MiniStat(
              value: '${(block.pct * 100).toStringAsFixed(0)}%',
              label: 'Done',
              color: const Color(0xFF2196F3)),
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
                fontSize: 18,
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
// Tower Card
// ─────────────────────────────────────────────────────────────────────────────

class _TowerCard extends StatelessWidget {
  final TowerSummary tower;
  final VoidCallback onTap;

  const _TowerCard({required this.tower, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final pct = tower.pct;
    final hasObservation = tower.withObservation > 0;

    Color statusColor;
    if (tower.pending > 0 || hasObservation) {
      statusColor = const Color(0xFFF44336);
    } else if (tower.inReview > 0) {
      statusColor = const Color(0xFFFF9800);
    } else if (tower.approved == tower.total && tower.total > 0) {
      statusColor = const Color(0xFF4CAF50);
    } else {
      statusColor = const Color(0xFF9E9E9E);
    }

    final doneFloors =
        tower.floors.where((f) => f.status == FloorStatus.allDone).length;
    final actionFloors =
        tower.floors.where((f) => f.status == FloorStatus.needsAction).length;
    final awaitingFloors =
        tower.floors.where((f) => f.status == FloorStatus.awaitingApproval).length;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 6,
              offset: const Offset(0, 2))
        ],
        border: Border.all(
            color: statusColor.withValues(alpha: 0.25), width: 1.5),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 36,
                    decoration: BoxDecoration(
                        color: statusColor,
                        borderRadius: BorderRadius.circular(2)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(tower.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                            color: Color(0xFF111827))),
                  ),
                  if (tower.pending > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: const Color(0xFFF44336)
                                .withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        '${tower.pending} pending',
                        style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFFF44336),
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  const SizedBox(width: 8),
                  const Icon(Icons.chevron_right_rounded,
                      color: Color(0xFFD1D5DB), size: 22),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: pct.clamp(0.0, 1.0),
                  minHeight: 6,
                  backgroundColor: const Color(0xFFE5E7EB),
                  valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${tower.floors.length} floors'
                      ' · ${tower.approved}/${tower.total} approved'
                      ' · ${(pct * 100).toStringAsFixed(0)}%',
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF6B7280)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              // Floor-status chips
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  if (doneFloors > 0)
                    _FloorChip(
                        count: doneFloors,
                        label: 'done',
                        color: const Color(0xFF4CAF50)),
                  if (awaitingFloors > 0)
                    _FloorChip(
                        count: awaitingFloors,
                        label: 'awaiting',
                        color: const Color(0xFFFF9800)),
                  if (actionFloors > 0)
                    _FloorChip(
                        count: actionFloors,
                        label: 'action',
                        color: const Color(0xFFF44336)),
                ],
              ),
              if (hasObservation) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.warning_amber_rounded,
                        size: 13, color: Colors.orange.shade700),
                    const SizedBox(width: 4),
                    Text(
                      '${tower.withObservation} open observation(s)',
                      style: TextStyle(
                          fontSize: 11, color: Colors.orange.shade700),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _FloorChip extends StatelessWidget {
  final int count;
  final String label;
  final Color color;
  const _FloorChip(
      {required this.count, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        '$count $label',
        style: TextStyle(
            fontSize: 10, color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _NoTowersView extends StatelessWidget {
  const _NoTowersView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.apartment_outlined, size: 56, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          const Text('No tower data yet',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF9CA3AF))),
          const SizedBox(height: 4),
          const Text('Towers will appear once checklists are assigned.',
              style: TextStyle(fontSize: 12, color: Color(0xFFD1D5DB))),
        ],
      ),
    );
  }
}
