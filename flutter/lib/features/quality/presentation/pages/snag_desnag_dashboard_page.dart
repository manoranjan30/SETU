import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/data/models/snag_desnag_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/snag_desnag_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/snag_full_final_approved_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/snag_unit_explorer_page.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/empty_state_view.dart';
import 'package:setu_mobile/shared/widgets/loading_view.dart';

/// Landing screen for the process-driven Snag / Desnag module
/// (Project > Quality > Snag / Desnag). Unit-status counts and navigation
/// are driven by this page's own [SnagDesnagBloc] (`LoadSnagOverview`, fed
/// by `GET /snag/:projectId/units`). The analytics section further down
/// (`GET /snag/:projectId/analytics` — confirmed to exist in
/// `snag.service.ts:getProjectAnalytics`, not assumed) uses its *own*,
/// separately-provided bloc instance scoped to [_AnalyticsSection] — the
/// bloc's state is a single value, so `LoadSnagOverview` and
/// `LoadSnagAnalytics` can't safely share one instance (whichever call
/// finishes last would silently overwrite the other's result). Standard
/// nested-provider shadowing keeps `context.read<SnagDesnagBloc>()`
/// unambiguous in each subtree without any extra plumbing.
class SnagDesnagDashboardPage extends StatelessWidget {
  final int projectId;
  final String projectName;

  const SnagDesnagDashboardPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => SnagDesnagBloc(apiClient: sl<SetuApiClient>(), syncService: sl<SyncService>())..add(LoadSnagOverview(projectId)),
      child: _DashboardView(projectId: projectId, projectName: projectName),
    );
  }
}

class _DashboardView extends StatelessWidget {
  final int projectId;
  final String projectName;

  const _DashboardView({required this.projectId, required this.projectName});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Snag / Desnag', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            Text(projectName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal)),
          ],
        ),
      ),
      body: BlocBuilder<SnagDesnagBloc, SnagDesnagState>(
        buildWhen: (_, state) => state is SnagDesnagOverviewLoaded || state is SnagDesnagError || state is SnagDesnagLoading,
        builder: (overviewContext, overviewState) {
          if (overviewState is SnagDesnagError) {
            return EmptyStateView.error(
              message: overviewState.message,
              onRetry: () => overviewContext.read<SnagDesnagBloc>().add(LoadSnagOverview(projectId)),
            );
          }
          if (overviewState is! SnagDesnagOverviewLoaded) {
            return const LoadingView();
          }

          final counts = _StatusCounts.from(overviewState.units);

          return RefreshIndicator(
            onRefresh: () async => overviewContext.read<SnagDesnagBloc>().add(LoadSnagOverview(projectId)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('Project Snag Health',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
                const SizedBox(height: 10),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 1.7,
                  children: [
                    _StatCard(label: 'Total Units', value: counts.total, color: Colors.blueGrey),
                    _StatCard(label: 'Not Started', value: counts.notStarted, color: Colors.grey),
                    _StatCard(label: 'Ready for Snagging', value: counts.readyForSnag, color: Colors.purple),
                    _StatCard(label: 'In Snagging', value: counts.snagging, color: Colors.deepOrange),
                    _StatCard(label: 'In Desnagging', value: counts.desnagging, color: Colors.blue),
                    _StatCard(label: 'Released', value: counts.released, color: Colors.teal),
                    _StatCard(
                      label: 'Ready for Customer Inspection',
                      value: counts.handoverReady,
                      color: Colors.green,
                      onTap: () => _openFullFinal(overviewContext, overviewState),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text('Process Steps', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
                const SizedBox(height: 8),
                if (overviewState.processSteps.isEmpty)
                  Text('No snag/desnag process configured for this project.',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600))
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: overviewState.processSteps
                        .map((s) => Chip(
                              label: Text('${s.workflowSerialNo}. ${s.name}', style: const TextStyle(fontSize: 11)),
                              backgroundColor: Colors.indigo.shade50,
                            ))
                        .toList(),
                  ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => BlocProvider.value(
                      value: overviewContext.read<SnagDesnagBloc>(),
                      child: SnagUnitExplorerPage(
                        projectId: projectId,
                        processSteps: overviewState.processSteps,
                        units: overviewState.units,
                      ),
                    ),
                  )),
                  icon: const Icon(Icons.explore_outlined),
                  label: const Text('Browse Units'),
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => _openFullFinal(overviewContext, overviewState),
                  icon: const Icon(Icons.verified_outlined),
                  label: const Text('Full & Final Approved'),
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                ),
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 8),
                Text('Analytics', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
                const SizedBox(height: 10),
                _AnalyticsSection(projectId: projectId),
              ],
            ),
          );
        },
      ),
    );
  }

  void _openFullFinal(BuildContext context, SnagDesnagOverviewLoaded state) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => SnagFullFinalApprovedPage(
        projectId: projectId,
        units: state.units,
        totalProcessSteps: state.processSteps.length,
      ),
    ));
  }
}

/// Owns its own [SnagDesnagBloc] instance (`LoadSnagAnalytics`), separate
/// from the overview bloc higher up the tree — a plain nested
/// `BlocProvider<SnagDesnagBloc>` shadows the outer one for this subtree
/// only, so `BlocBuilder`/`context.read` inside here resolve to the
/// analytics bloc with no extra plumbing, and nothing outside this widget
/// is affected.
class _AnalyticsSection extends StatelessWidget {
  final int projectId;
  const _AnalyticsSection({required this.projectId});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SnagDesnagBloc>(
      create: (_) => SnagDesnagBloc(apiClient: sl<SetuApiClient>(), syncService: sl<SyncService>())..add(LoadSnagAnalytics(projectId)),
      child: BlocBuilder<SnagDesnagBloc, SnagDesnagState>(
        builder: (_, state) {
          if (state is SnagDesnagError) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(state.message, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            );
          }
          if (state is! SnagAnalyticsLoaded) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: LoadingView(),
            );
          }
          return _AnalyticsBody(analytics: state.analytics);
        },
      ),
    );
  }
}

class _AnalyticsBody extends StatelessWidget {
  final SnagAnalytics analytics;
  const _AnalyticsBody({required this.analytics});

  @override
  Widget build(BuildContext context) {
    final s = analytics.summary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.7,
          children: [
            _StatCard(label: 'Open Snag Points', value: s.openSnagPoints, color: Colors.deepOrange),
            _StatCard(label: 'Rectified, Pending Desnag', value: s.rectifiedPendingDesnag, color: Colors.blue),
            _StatCard(label: 'Not Satisfactory', value: s.notSatisfactoryPoints, color: Colors.red),
            _StatCard(label: 'Closed Points', value: s.closedSnagPoints, color: Colors.green),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(8)),
          child: Row(
            children: [
              const Icon(Icons.hourglass_bottom_outlined, size: 16, color: Colors.grey),
              const SizedBox(width: 8),
              Text('Average open age: ${s.averageOpenAgeDays.toStringAsFixed(1)} days',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        _BarListSection(title: 'Aging (open points)', rows: analytics.agingBuckets, color: Colors.deepOrange),
        _BarListSection(title: 'By Process Step', rows: analytics.byProcessStep, color: Colors.indigo),
        _BarListSection(title: 'By Tower', rows: analytics.byTower, color: Colors.blue),
        _BarListSection(title: 'By Floor', rows: analytics.byFloor, color: Colors.teal),
        _BarListSection(title: 'By Room', rows: analytics.byRoom, color: Colors.purple),
        _BarListSection(title: 'By Activity / Trade', rows: analytics.byActivity, color: Colors.brown),
        _BarListSection(title: 'By Priority', rows: analytics.byPriority, color: Colors.orange),
        _BarListSection(title: 'Top Recurring Snag Points', rows: analytics.recurringSnags, color: Colors.pink),
        if (analytics.blockedUnits.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Units Blocked by Rejections', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
          const SizedBox(height: 6),
          for (final u in analytics.blockedUnits)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_rounded, size: 14, color: Colors.red.shade400),
                  const SizedBox(width: 6),
                  Expanded(child: Text(u.unitLabel, style: const TextStyle(fontSize: 12))),
                  Text('Round ${u.currentRound} • ${u.status}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                ],
              ),
            ),
        ],
      ],
    );
  }
}

class _BarListSection extends StatelessWidget {
  final String title;
  final List<SnagCountRow> rows;
  final MaterialColor color;
  const _BarListSection({required this.title, required this.rows, required this.color});

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();
    final maxCount = rows.map((r) => r.count).fold<int>(0, (a, b) => a > b ? a : b).clamp(1, 1 << 30);
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
          const SizedBox(height: 6),
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  SizedBox(
                    width: 96,
                    child: Text(row.label, style: const TextStyle(fontSize: 11), overflow: TextOverflow.ellipsis),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: row.count / maxCount,
                        minHeight: 10,
                        backgroundColor: color.shade50,
                        valueColor: AlwaysStoppedAnimation(color.shade400),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 28,
                    child: Text('${row.count}', textAlign: TextAlign.end, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StatusCounts {
  final int total;
  final int notStarted;
  final int readyForSnag;
  final int snagging;
  final int desnagging;
  final int released;
  final int handoverReady;

  const _StatusCounts({
    required this.total,
    required this.notStarted,
    required this.readyForSnag,
    required this.snagging,
    required this.desnagging,
    required this.released,
    required this.handoverReady,
  });

  factory _StatusCounts.from(List<SnagUnitSummary> units) {
    var notStarted = 0, readyForSnag = 0, snagging = 0, desnagging = 0, released = 0, handoverReady = 0;
    for (final u in units) {
      switch (u.overallStatus) {
        case SnagListStatus.unready:
          notStarted++;
        case SnagListStatus.readyForSnag:
          readyForSnag++;
        case SnagListStatus.snagging:
          snagging++;
        case SnagListStatus.desnagging:
          desnagging++;
        case SnagListStatus.released:
          released++;
        case SnagListStatus.handoverReady:
          handoverReady++;
      }
    }
    return _StatusCounts(
      total: units.length,
      notStarted: notStarted,
      readyForSnag: readyForSnag,
      snagging: snagging,
      desnagging: desnagging,
      released: released,
      handoverReady: handoverReady,
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  final MaterialColor color;
  final VoidCallback? onTap;

  const _StatCard({required this.label, required this.value, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.shade50,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.shade100),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('$value',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color.shade800)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: color.shade700)),
          ],
        ),
      ),
    );
  }
}

