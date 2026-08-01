import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/models/snag_desnag_models.dart';
import 'package:setu_mobile/features/quality/presentation/pages/snag_unit_workspace_page.dart';

/// Units where every configured process step is complete
/// (`overallStatus == handoverReady`). Filtered client-side from the
/// already-fetched units list — there is no dedicated backend endpoint for
/// this (verified against `snag.controller.ts`; only the earlier planning
/// doc mentioned one, it was never actually built), so this page only
/// shows what [SnagUnitSummary] already carries: unit, location, and how
/// many process steps are configured. Approval date/approver aren't in the
/// bulk units response — tap through to the unit's real workspace (which
/// has the actual round/approval history) rather than showing fabricated
/// summary data here.
class SnagFullFinalApprovedPage extends StatelessWidget {
  final int projectId;
  final List<SnagUnitSummary> units;
  final int totalProcessSteps;

  const SnagFullFinalApprovedPage({
    super.key,
    required this.projectId,
    required this.units,
    required this.totalProcessSteps,
  });

  @override
  Widget build(BuildContext context) {
    final approved = units.where((u) => u.overallStatus == SnagListStatus.handoverReady).toList()
      ..sort((a, b) => a.unitLabel.compareTo(b.unitLabel));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Full & Final Approved', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
      ),
      body: approved.isEmpty
          ? const Center(child: Text('No units are fully approved yet.', style: TextStyle(color: Colors.grey)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: approved.length,
              itemBuilder: (_, i) {
                final unit = approved[i];
                return Card(
                  elevation: 0,
                  margin: const EdgeInsets.only(bottom: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.grey.shade200)),
                  child: ListTile(
                    leading: const Icon(Icons.verified, color: Colors.green),
                    title: Text(unit.unitLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    subtitle: Text(
                      [
                        [if (unit.blockLabel != null) unit.blockLabel!, unit.towerLabel, unit.floorLabel].join(' • '),
                        if (totalProcessSteps > 0) 'All $totalProcessSteps process step${totalProcessSteps == 1 ? '' : 's'} complete',
                      ].join('\n'),
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                    ),
                    isThreeLine: totalProcessSteps > 0,
                    trailing: const Icon(Icons.chevron_right, size: 18),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => SnagUnitWorkspacePage(
                        projectId: projectId,
                        qualityUnitId: unit.qualityUnitId,
                        unitLabel: unit.unitLabel,
                        towerLabel: unit.towerLabel,
                        floorLabel: unit.floorLabel,
                        blockLabel: unit.blockLabel,
                        snagListId: unit.snagListId,
                      ),
                    )),
                  ),
                );
              },
            ),
    );
  }
}
