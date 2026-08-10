import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/pages/pour_card_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/pre_pour_clearance_page.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/empty_state_view.dart';
import 'package:setu_mobile/shared/widgets/loading_view.dart';

/// "My Card Approvals" inbox — pour card / pre-pour clearance card
/// approvals currently actionable by the logged-in user, from
/// `GET /quality/inspections/card-approvals/pending?projectId=X`. The
/// backend already scopes this to items the user (or an admin) can act on
/// right now, so unlike the RFI approvals list this needs no further
/// client-side permission filtering — see
/// `quality-pour-card.service.ts:listPendingCardApprovals`.
class CardApprovalsPage extends StatefulWidget {
  final int projectId;
  final String projectName;
  const CardApprovalsPage({super.key, required this.projectId, required this.projectName});

  @override
  State<CardApprovalsPage> createState() => _CardApprovalsPageState();
}

class _CardApprovalsPageState extends State<CardApprovalsPage> {
  List<PendingCardApproval>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final raw = await sl<SetuApiClient>().getPendingCardApprovals(widget.projectId);
      final items = raw.whereType<Map<String, dynamic>>().map(PendingCardApproval.fromJson).toList();
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load card approvals. Pull to retry.');
    }
  }

  Future<void> _openCard(PendingCardApproval item) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => item.isPourCard
          ? PourCardPage(
              inspectionId: item.inspectionId,
              projectId: item.projectId,
              activityName: item.activityName,
              locationLabel: item.locationText,
            )
          : PrePourClearancePage(
              inspectionId: item.inspectionId,
              projectId: item.projectId,
              epsNodeId: item.epsNodeId,
              activityName: item.activityName,
              locationLabel: item.locationText,
            ),
    ));
    // The user may have approved/rejected this item (which can also move it
    // to the next level rather than remove it) — refresh so the list always
    // reflects the current actionable set.
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Card Approvals', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            Text(widget.projectName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal)),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return EmptyStateView.error(message: _error!, onRetry: _load);
    }
    final items = _items;
    if (items == null) return const LoadingView();
    if (items.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          EmptyStateView(icon: Icons.task_alt_rounded, message: 'No card approvals waiting on you right now.'),
        ],
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (_, i) => _CardApprovalTile(item: items[i], onTap: () => _openCard(items[i])),
    );
  }
}

class _CardApprovalTile extends StatelessWidget {
  final PendingCardApproval item;
  final VoidCallback onTap;
  const _CardApprovalTile({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = item.isPourCard ? Colors.blue : Colors.teal;
    final level = item.activeLevel;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: Colors.grey.shade200)),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(item.isPourCard ? Icons.assignment_outlined : Icons.checklist_outlined, size: 16, color: color.shade700),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(item.title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color.shade800)),
                  ),
                  if (level != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.indigo.shade50, borderRadius: BorderRadius.circular(6)),
                      child: Text(
                        'L${level.stepOrder} ${level.stepName}',
                        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Colors.indigo.shade700),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                [if (item.elementName != null) item.elementName!, if (item.locationText != null) item.locationText!].join(' • '),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              if (item.activityName != null) ...[
                const SizedBox(height: 2),
                Text(item.activityName!, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              ],
              if (item.submittedAt != null) ...[
                const SizedBox(height: 6),
                Text(
                  'Submitted ${DateFormat('d MMM, HH:mm').format(item.submittedAt!)}',
                  style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
