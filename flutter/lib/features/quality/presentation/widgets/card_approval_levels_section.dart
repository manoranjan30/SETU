import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

/// Multi-level approval chain timeline for a pour card / pre-pour clearance
/// card — shared by [PourCardPage] and [PrePourClearancePage] so both cards
/// render the exact same "verifier level" style progress view (matching the
/// pattern already used for Snag/Desnag's multi-level workflow). Shows
/// nothing but the level list; approve/reject actions live in each page's
/// own action bar, gated separately on [CardApprovalWorkflow.canApprove].
class CardApprovalLevelsSection extends StatelessWidget {
  final CardApprovalWorkflow workflow;
  const CardApprovalLevelsSection({super.key, required this.workflow});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.grey.shade200)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text('Approval Progress', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                ),
                if (workflow.totalLevels > 0)
                  Text(
                    'Level ${workflow.currentStepOrder} of ${workflow.totalLevels}',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
                  ),
              ],
            ),
            const Divider(height: 16),
            if (workflow.levels.isEmpty)
              Text('No approval levels configured.', style: TextStyle(fontSize: 12, color: Colors.grey.shade500))
            else
              for (final level in workflow.levels) _LevelTile(level: level),
          ],
        ),
      ),
    );
  }
}

class _LevelTile extends StatelessWidget {
  final CardApprovalLevel level;
  const _LevelTile({required this.level});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (level.status) {
      'COMPLETED' => ('Completed', Colors.green),
      'REJECTED' => ('Rejected', Colors.red),
      'PENDING' => ('Active', Colors.deepOrange),
      _ => ('Waiting', Colors.grey),
    };
    final isActive = level.status == 'PENDING';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isActive ? Colors.indigo.shade50 : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isActive ? Colors.indigo.shade100 : Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('L${level.stepOrder} ${level.stepName}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color.shade700)),
              ),
            ],
          ),
          if (level.signerDisplayName != null || level.completedAt != null) ...[
            const SizedBox(height: 4),
            Text(
              [
                if (level.signerDisplayName != null) 'By ${level.signerDisplayName}',
                if (level.completedAt != null) DateFormat('d MMM, HH:mm').format(level.completedAt!),
              ].join(' • '),
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
            ),
          ],
          if (level.comments != null && level.comments!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(level.comments!, style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
          ],
        ],
      ),
    );
  }
}
