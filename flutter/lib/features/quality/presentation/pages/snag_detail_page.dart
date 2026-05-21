import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/snag_bloc.dart';

/// Detail view for a single snag — shows all info and allows status transitions.
/// The SnagBloc must be provided by the parent (SnagListPage).
class SnagDetailPage extends StatelessWidget {
  final QualitySnag snag;

  const SnagDetailPage({super.key, required this.snag});

  @override
  Widget build(BuildContext context) {
    // Re-use the parent's SnagBloc via context.read
    return _SnagDetailView(snag: snag);
  }
}

class _SnagDetailView extends StatelessWidget {
  final QualitySnag snag;
  const _SnagDetailView({required this.snag});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);

    return BlocListener<SnagBloc, SnagState>(
      listener: (context, state) {
        if (state is SnagError) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.red.shade700,
          ));
        }
        if (state is SnagActionSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.green.shade700,
          ));
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Snag Detail', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          actions: [
            if (ps.canDeleteQualityObs && snag.status == SnagStatus.open)
              IconButton(
                icon: const Icon(Icons.delete_outline),
                tooltip: 'Delete snag',
                onPressed: () => _confirmDelete(context),
              ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Status & priority header
            Row(
              children: [
                _StatusBadge(status: snag.status),
                const SizedBox(width: 8),
                _PriorityBadge(priority: snag.priority, color: snag.priorityColor),
              ],
            ),
            const SizedBox(height: 16),

            // Title
            Text(snag.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            // Details card
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    if (snag.description != null)
                      _DetailRow(
                        icon: Icons.description_outlined,
                        label: 'Description',
                        value: snag.description!,
                      ),
                    if (snag.location != null)
                      _DetailRow(
                        icon: Icons.location_on_outlined,
                        label: 'Location',
                        value: snag.location!,
                      ),
                    if (snag.raisedByName != null)
                      _DetailRow(
                        icon: Icons.person_outline,
                        label: 'Raised by',
                        value: snag.raisedByName!,
                      ),
                    _DetailRow(
                      icon: Icons.calendar_today_outlined,
                      label: 'Created',
                      value: _fmtDate(snag.createdAt),
                    ),
                    if (snag.dueDate != null)
                      _DetailRow(
                        icon: Icons.event_outlined,
                        label: 'Due Date',
                        value: _fmtDate(snag.dueDate!),
                        valueColor: snag.dueDate!.isBefore(DateTime.now()) &&
                                snag.status == SnagStatus.open
                            ? Colors.red.shade700
                            : null,
                      ),
                    if (snag.rectifiedAt != null)
                      _DetailRow(
                        icon: Icons.build_outlined,
                        label: 'Rectified',
                        value: _fmtDate(snag.rectifiedAt!),
                      ),
                    if (snag.verifiedAt != null)
                      _DetailRow(
                        icon: Icons.verified_outlined,
                        label: 'Verified',
                        value: _fmtDate(snag.verifiedAt!),
                      ),
                  ],
                ),
              ),
            ),

            // Photos
            if (snag.photoUrls.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text('Photos', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              SizedBox(
                height: 100,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: snag.photoUrls.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, i) => ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Image.network(
                      snag.photoUrls[i],
                      width: 100,
                      height: 100,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 100,
                        height: 100,
                        color: Colors.grey.shade200,
                        child: const Icon(Icons.broken_image_outlined),
                      ),
                    ),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 24),

            // Action buttons
            _ActionButtons(snag: snag, ps: ps),
          ],
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Snag'),
        content: const Text('Are you sure you want to delete this snag? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<SnagBloc>().add(DeleteSnag(snag.id));
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  String _fmtDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
}

class _ActionButtons extends StatelessWidget {
  final QualitySnag snag;
  final PermissionService ps;

  const _ActionButtons({required this.snag, required this.ps});

  @override
  Widget build(BuildContext context) {
    final canRectify = ps.canRectifyQualityObs && snag.status == SnagStatus.open;
    final canVerify = ps.canCloseQualityObs && snag.status == SnagStatus.rectified;

    if (!canRectify && !canVerify) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (canRectify)
          FilledButton.icon(
            onPressed: () => _showStatusDialog(
              context,
              title: 'Mark as Rectified',
              message: 'Confirm that this snag has been rectified.',
              newStatus: SnagStatus.rectified,
              buttonLabel: 'Mark Rectified',
              buttonColor: Colors.blue.shade700,
            ),
            icon: const Icon(Icons.build_outlined, size: 16),
            label: const Text('Mark as Rectified'),
            style: FilledButton.styleFrom(backgroundColor: Colors.blue.shade700),
          ),
        if (canVerify) ...[
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: () => _showStatusDialog(
              context,
              title: 'Verify & Close',
              message: 'Confirm rectification and close this snag.',
              newStatus: SnagStatus.verified,
              buttonLabel: 'Verify & Close',
              buttonColor: Colors.green.shade700,
            ),
            icon: const Icon(Icons.verified_outlined, size: 16),
            label: const Text('Verify & Close'),
            style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700),
          ),
        ],
      ],
    );
  }

  void _showStatusDialog(
    BuildContext context, {
    required String title,
    required String message,
    required SnagStatus newStatus,
    required String buttonLabel,
    required Color buttonColor,
  }) {
    final remarksCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message),
            const SizedBox(height: 12),
            TextField(
              controller: remarksCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Remarks (optional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<SnagBloc>().add(UpdateSnagStatus(
                snagId: snag.id,
                newStatus: newStatus,
                remarks: remarksCtrl.text.trim().isEmpty ? null : remarksCtrl.text.trim(),
              ));
            },
            style: FilledButton.styleFrom(backgroundColor: buttonColor),
            child: Text(buttonLabel),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final SnagStatus status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: status.color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: status.color.withValues(alpha: 0.4)),
      ),
      child: Text(status.label,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: status.color)),
    );
  }
}

class _PriorityBadge extends StatelessWidget {
  final String priority;
  final Color color;
  const _PriorityBadge({required this.priority, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(priority,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: Colors.grey.shade500),
          const SizedBox(width: 8),
          SizedBox(
            width: 90,
            child: Text(label,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: valueColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
