import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/dashboard_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_dashboard_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/block_floors_page.dart';

/// Project-level checklist approval progress summary.
/// Shows aggregate stats and a card per Block for drill-down navigation.
class QualityDashboardPage extends StatefulWidget {
  final int projectId;
  final String projectName;

  const QualityDashboardPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  State<QualityDashboardPage> createState() => _QualityDashboardPageState();
}

class _QualityDashboardPageState extends State<QualityDashboardPage> {
  @override
  void initState() {
    super.initState();
    context.read<QualityDashboardBloc>().add(LoadDashboard(widget.projectId));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Checklist Progress',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.projectName,
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          BlocBuilder<QualityDashboardBloc, QualityDashboardState>(
            builder: (context, state) {
              if (state is DashboardLoaded && state.myPendingCount > 0) {
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.notifications_outlined),
                      onPressed: () {},
                      tooltip: 'My Pending',
                    ),
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        constraints: const BoxConstraints(
                            minWidth: 16, minHeight: 16),
                        child: Text(
                          '${state.myPendingCount}',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ],
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: BlocBuilder<QualityDashboardBloc, QualityDashboardState>(
        builder: (context, state) {
          if (state is DashboardLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is DashboardError) {
            return _ErrorView(
              message: state.message,
              onRetry: () => context
                  .read<QualityDashboardBloc>()
                  .add(LoadDashboard(widget.projectId)),
            );
          }
          if (state is DashboardLoaded) {
            return RefreshIndicator(
              onRefresh: () async {
                context
                    .read<QualityDashboardBloc>()
                    .add(RefreshDashboard(widget.projectId));
                await Future.delayed(const Duration(milliseconds: 500));
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Offline banner — shown when data is from local cache
                  if (state.isOffline)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3CD),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFFD700)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.wifi_off_rounded,
                              size: 16, color: Color(0xFF856404)),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Showing cached structure. Pull to refresh when online for inspection data.',
                              style: TextStyle(
                                  fontSize: 12, color: Color(0xFF856404)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  // ── Summary Stats ──────────────────────────────────────
                  _SummaryStatsCard(state: state),
                  const SizedBox(height: 16),
                  // ── Block Cards ────────────────────────────────────────
                  if (state.blocks.isEmpty)
                    const _EmptyBlocksView()
                  else ...[
                    const Padding(
                      padding: EdgeInsets.only(bottom: 10),
                      child: Text(
                        'BLOCKS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF9CA3AF),
                          letterSpacing: 1.0,
                        ),
                      ),
                    ),
                    ...state.blocks.map((b) => _BlockCard(
                          block: b,
                          onTap: () => _openBlock(context, b),
                        )),
                  ],
                ],
              ),
            );
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }

  void _openBlock(BuildContext context, BlockSummary block) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<QualityDashboardBloc>(),
          child: BlockFloorsPage(
            projectId: widget.projectId,
            block: block,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Stats Card
// ─────────────────────────────────────────────────────────────────────────────

class _SummaryStatsCard extends StatelessWidget {
  final DashboardLoaded state;
  const _SummaryStatsCard({required this.state});

  @override
  Widget build(BuildContext context) {
    final total = state.totalInspections;
    final approved = state.approvedCount;
    final inReview = state.inReviewCount;
    final pending = state.pendingCount;
    final pct = total == 0 ? 0.0 : approved / total;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2))
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Three stat boxes
          Row(
            children: [
              _StatBox(
                  label: 'Total RFIs',
                  value: '$total',
                  color: const Color(0xFF374151)),
              _StatBox(
                  label: 'Approved',
                  value: '$approved',
                  color: const Color(0xFF4CAF50)),
              _StatBox(
                  label: 'In Review',
                  value: '$inReview',
                  color: const Color(0xFFFF9800)),
              _StatBox(
                  label: 'Rejected',
                  value: '$pending',
                  color: const Color(0xFFF44336)),
            ],
          ),
          const SizedBox(height: 14),
          // Progress bar
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: pct.clamp(0.0, 1.0),
                    minHeight: 8,
                    backgroundColor: const Color(0xFFE5E7EB),
                    valueColor: const AlwaysStoppedAnimation<Color>(
                        Color(0xFF4CAF50)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '${(pct * 100).toStringAsFixed(0)}%',
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: Color(0xFF374151)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Legend
          const Row(
            children: [
              _LegendDot(color: Color(0xFF4CAF50), label: 'Approved'),
              SizedBox(width: 12),
              _LegendDot(color: Color(0xFFFF9800), label: 'In Review'),
              SizedBox(width: 12),
              _LegendDot(color: Color(0xFFF44336), label: 'Rejected'),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatBox(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 22,
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
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label,
            style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Block Card
// ─────────────────────────────────────────────────────────────────────────────

class _BlockCard extends StatelessWidget {
  final BlockSummary block;
  final VoidCallback onTap;

  const _BlockCard({required this.block, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final pct = block.pct;
    final hasObservation = block.withObservation > 0;

    // Determine dominant status colour
    Color statusColor;
    if (block.pending > 0 || hasObservation) {
      statusColor = const Color(0xFFF44336);
    } else if (block.inReview > 0) {
      statusColor = const Color(0xFFFF9800);
    } else if (block.approved == block.total && block.total > 0) {
      statusColor = const Color(0xFF4CAF50);
    } else {
      statusColor = const Color(0xFF9E9E9E);
    }

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
                  // Colour indicator strip
                  Container(
                    width: 4,
                    height: 36,
                    decoration: BoxDecoration(
                        color: statusColor,
                        borderRadius: BorderRadius.circular(2)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(block.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                                color: Color(0xFF111827))),
                        if (block.towerName != null &&
                            block.towerName!.isNotEmpty)
                          Text(block.towerName!,
                              style: const TextStyle(
                                  fontSize: 12, color: Color(0xFF6B7280))),
                      ],
                    ),
                  ),
                  // Pending badge
                  if (block.pending > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: const Color(0xFFF44336).withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        '${block.pending} pending',
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
              // Progress bar
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: pct.clamp(0.0, 1.0),
                  minHeight: 6,
                  backgroundColor: const Color(0xFFE5E7EB),
                  valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${block.floors.length} floors',
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF9CA3AF)),
                  ),
                  Text(
                    '${block.approved}/${block.total} approved'
                    ' · ${(pct * 100).toStringAsFixed(0)}%',
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF6B7280)),
                  ),
                ],
              ),
              if (hasObservation) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.warning_amber_rounded,
                        size: 13,
                        color: Colors.orange.shade700),
                    const SizedBox(width: 4),
                    Text(
                      '${block.withObservation} open observation(s)',
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

// ─────────────────────────────────────────────────────────────────────────────
// Empty / Error
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyBlocksView extends StatelessWidget {
  const _EmptyBlocksView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 60),
        child: Column(
          children: [
            Icon(Icons.domain_outlined,
                size: 56, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            const Text('No blocks found',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF9CA3AF))),
            const SizedBox(height: 4),
            const Text('No checklist data for this project yet.',
                style:
                    TextStyle(fontSize: 13, color: Color(0xFFD1D5DB))),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined,
                size: 56, color: Color(0xFFD1D5DB)),
            const SizedBox(height: 16),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 14, color: Color(0xFF6B7280))),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
