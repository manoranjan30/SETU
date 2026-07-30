import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/features/quality/data/models/cube_register_models.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/pour_card_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/pour_card_entry_detail_page.dart';

class PourCardPage extends StatelessWidget {
  final int inspectionId;
  final int? projectId;
  final String? activityName;
  final String? locationLabel;

  const PourCardPage({
    super.key,
    required this.inspectionId,
    this.projectId,
    this.activityName,
    this.locationLabel,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => PourCardBloc(apiClient: sl<SetuApiClient>())
        ..add(LoadPourCard(inspectionId)),
      child: _PourCardView(
        inspectionId: inspectionId,
        projectId: projectId,
        activityName: activityName,
        locationLabel: locationLabel,
      ),
    );
  }
}

class _PourCardView extends StatefulWidget {
  final int inspectionId;
  final int? projectId;
  final String? activityName;
  final String? locationLabel;

  const _PourCardView({
    required this.inspectionId,
    this.projectId,
    this.activityName,
    this.locationLabel,
  });

  @override
  State<_PourCardView> createState() => _PourCardViewState();
}

class _PourCardViewState extends State<_PourCardView> {
  bool _isPdfDownloading = false;
  List<ConcreteGrade> _grades = [];

  @override
  void initState() {
    super.initState();
    if (widget.projectId != null) {
      _loadGrades();
    }
  }

  Future<void> _loadGrades() async {
    try {
      final raw = await sl<SetuApiClient>().getConcreteGrades(widget.projectId!);
      if (mounted) {
        setState(() {
          _grades = raw
              .whereType<Map<String, dynamic>>()
              .map(ConcreteGrade.fromJson)
              .where((g) => g.isActive)
              .toList();
        });
      }
    } catch (_) {}
  }

  Future<void> _downloadPdf(BuildContext context, int inspectionId) async {
    setState(() => _isPdfDownloading = true);
    try {
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/pour_card_$inspectionId.pdf';
      await sl<SetuApiClient>().downloadPourCardPdf(inspectionId, path);
      final result = await OpenFile.open(path);
      if (result.type != ResultType.done && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open PDF: ${result.message}')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('PDF download failed: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isPdfDownloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<PourCardBloc, PourCardState>(
      listener: (context, state) {
        if (state is PourCardError) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.red.shade700,
          ));
        }
        if (state is PourCardActionSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.green.shade700,
          ));
          // Pop after approve/reject (terminal states)
          final status = state.card.status;
          if (status == QualityCardStatus.approved ||
              status == QualityCardStatus.rejected) {
            Navigator.of(context).pop();
          }
        }
      },
      builder: (context, state) {
        final QualityPourCard? card = switch (state) {
          final PourCardLoaded s => s.card,
          final PourCardSaving s => s.card,
          final PourCardActionSuccess s => s.card,
          _ => null,
        };

        final isLoading = state is PourCardLoading;
        final isSaving = state is PourCardSaving;

        return Scaffold(
          appBar: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Pour Card', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                if (widget.activityName != null)
                  Text(widget.activityName!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal)),
              ],
            ),
            actions: [
              if (card != null &&
                  (card.status == QualityCardStatus.approved ||
                      card.status == QualityCardStatus.submitted))
                _isPdfDownloading
                    ? const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 14),
                        child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                      )
                    : IconButton(
                        icon: const Icon(Icons.picture_as_pdf_outlined),
                        tooltip: 'Download PDF',
                        onPressed: () => _downloadPdf(context, widget.inspectionId),
                      ),
            ],
          ),
          body: isLoading
              ? const Center(child: CircularProgressIndicator())
              : card == null
                  ? _ErrorView(inspectionId: widget.inspectionId)
                  : Stack(
                      children: [
                        _PourCardBody(
                          card: card,
                          inspectionId: widget.inspectionId,
                          projectId: widget.projectId,
                          concreteGrades: _grades,
                        ),
                        if (isSaving)
                          const Positioned(
                            top: 0, left: 0, right: 0,
                            child: LinearProgressIndicator(),
                          ),
                      ],
                    ),
        );
      },
    );
  }
}

class _ErrorView extends StatelessWidget {
  final int inspectionId;
  const _ErrorView({required this.inspectionId});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.grey),
            const SizedBox(height: 16),
            const Text('Failed to load pour card', style: TextStyle(color: Colors.grey)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => context.read<PourCardBloc>().add(LoadPourCard(inspectionId)),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PourCardBody extends StatefulWidget {
  final QualityPourCard card;
  final int inspectionId;
  final int? projectId;
  final List<ConcreteGrade> concreteGrades;

  const _PourCardBody({
    required this.card,
    required this.inspectionId,
    this.projectId,
    this.concreteGrades = const [],
  });

  @override
  State<_PourCardBody> createState() => _PourCardBodyState();
}

class _PourCardBodyState extends State<_PourCardBody> {
  late final TextEditingController _elementCtrl;
  late final TextEditingController _locationCtrl;
  late final TextEditingController _remarksCtrl;

  @override
  void initState() {
    super.initState();
    _elementCtrl = TextEditingController(text: widget.card.elementName ?? '');
    _locationCtrl = TextEditingController(text: widget.card.locationText ?? '');
    _remarksCtrl = TextEditingController(text: widget.card.remarks ?? '');
  }

  @override
  void dispose() {
    _elementCtrl.dispose();
    _locationCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final card = widget.card;
    final ps = PermissionService.of(context);
    final isEditable = card.status.isEditable && ps.canUpdatePourCard;
    // Submit is independent of edit rights — a user may be allowed to
    // submit a card without being allowed to change its field values.
    final canSubmit = card.status.isEditable && ps.canSubmitPourCard;
    final canApprove = ps.canApprovePourCard;
    final theme = Theme.of(context);

    return Column(
      children: [
        // Status banner
        _StatusBanner(status: card.status),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Header info
              _SectionCard(
                title: 'Format: ${card.formatNo}',
                child: Column(
                  children: [
                    if (card.projectNameSnapshot != null)
                      _InfoRow('Project', card.projectNameSnapshot!),
                    if (card.clientName != null)
                      _InfoRow('Client', card.clientName!),
                    if (card.consultantName != null)
                      _InfoRow('Consultant', card.consultantName!),
                    if (card.contractorName != null)
                      _InfoRow('Contractor', card.contractorName!),
                    const SizedBox(height: 8),
                    _EditableField(
                      label: 'Element / Structure',
                      controller: _elementCtrl,
                      enabled: isEditable,
                      onChanged: (_) => _pushHeader(context),
                    ),
                    const SizedBox(height: 8),
                    _EditableField(
                      label: 'Location',
                      controller: _locationCtrl,
                      enabled: isEditable,
                      onChanged: (_) => _pushHeader(context),
                    ),
                    const SizedBox(height: 8),
                    _EditableField(
                      label: 'Remarks',
                      controller: _remarksCtrl,
                      enabled: isEditable,
                      maxLines: 2,
                      onChanged: (_) => _pushHeader(context),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Concrete pour entries — slim summary lines, tap to open the
              // full entry form. Total quantity up front so QC/site staff
              // don't have to add up every row by hand.
              _SectionCard(
                title: 'Concrete Pour Entries',
                trailing: isEditable
                    ? TextButton.icon(
                        onPressed: () => _addEntry(context),
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add Row'),
                      )
                    : null,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (card.entries.isNotEmpty) ...[
                      Row(
                        children: [
                          const Text('Total Quantity',
                              style: TextStyle(fontSize: 12, color: Colors.black54)),
                          const Spacer(),
                          Text(
                            '${_totalQuantity(card.entries).toStringAsFixed(2)} m³',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                    ],
                    if (card.entries.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Center(child: Text('No entries yet. Tap "Add Row" to begin.', style: TextStyle(color: Colors.grey))),
                      )
                    else
                      for (int i = 0; i < card.entries.length; i++)
                        _PourEntrySummaryTile(
                          index: i,
                          entry: card.entries[i],
                          isEditable: isEditable,
                          onTap: () => _openEntry(context, index: i, entry: card.entries[i]),
                          onDelete: isEditable
                              ? () => context.read<PourCardBloc>().add(RemovePourEntry(i))
                              : null,
                        ),
                  ],
                ),
              ),

              // Approval info (if approved/rejected)
              if (card.approvedByName != null || card.rejectionRemarks != null) ...[
                const SizedBox(height: 16),
                _SectionCard(
                  title: card.status == QualityCardStatus.rejected ? 'Rejection Details' : 'Approval Details',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (card.approvedByName != null)
                        _InfoRow('By', card.approvedByName!),
                      if (card.approvedAt != null)
                        _InfoRow('Date', _formatDate(card.approvedAt!)),
                      if (card.rejectionRemarks != null)
                        _InfoRow('Reason', card.rejectionRemarks!),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),
            ],
          ),
        ),

        // Action buttons
        _ActionBar(
          card: card,
          isEditable: isEditable,
          canSubmit: canSubmit,
          canApprove: canApprove,
          theme: theme,
          onSave: () => context.read<PourCardBloc>().add(const SavePourCard()),
          onSubmit: () => _confirmSubmit(context),
          onApprove: () => _showApproveDialog(context),
          onReject: () => _showRejectDialog(context),
        ),
      ],
    );
  }

  void _pushHeader(BuildContext context) {
    context.read<PourCardBloc>().add(UpdatePourCardHeader(
      elementName: _elementCtrl.text,
      locationText: _locationCtrl.text,
      remarks: _remarksCtrl.text,
    ));
  }

  double _totalQuantity(List<PourCardEntry> entries) =>
      entries.fold<double>(0, (sum, e) => sum + (e.quantityM3 ?? 0));

  /// Adds a blank entry, then opens it directly for editing — the user is
  /// dropped straight into filling it in rather than seeing a new empty row
  /// appear in the list.
  ///
  /// Computes the new entry's index/value locally (matching what
  /// `PourCardBloc._onAddEntry` appends) instead of reading `bloc.state`
  /// right after `add()` — bloc events are processed asynchronously, so the
  /// state wouldn't reliably reflect the new entry yet on the very next line.
  Future<void> _addEntry(BuildContext context) async {
    final newIndex = widget.card.entries.length;
    context.read<PourCardBloc>().add(const AddPourEntry());
    await _openEntry(context, index: newIndex, entry: const PourCardEntry(), isNew: true);
  }

  Future<void> _openEntry(
    BuildContext context, {
    required int index,
    required PourCardEntry entry,
    bool isNew = false,
  }) async {
    final ps = PermissionService.of(context);
    final isEditable = widget.card.status.isEditable && ps.canUpdatePourCard;
    final preceding = widget.card.entries
        .take(index)
        .fold<double>(0, (sum, e) => sum + (e.quantityM3 ?? 0));
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => BlocProvider.value(
        value: context.read<PourCardBloc>(),
        child: PourEntryDetailPage(
          index: index,
          entry: entry,
          isEditable: isEditable,
          isNew: isNew,
          concreteGrades: widget.concreteGrades,
          precedingCumulativeQtyM3: preceding,
          projectId: widget.projectId,
        ),
      ),
    ));
  }

  void _confirmSubmit(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Submit Pour Card'),
        content: const Text('Submit this pour card for QC approval? You will not be able to edit it after submission.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<PourCardBloc>().add(const SubmitPourCard());
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  void _showApproveDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Approve Pour Card'),
        content: TextField(
          controller: ctrl,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'Remarks (optional)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<PourCardBloc>().add(ApprovePourCard(remarks: ctrl.text.trim().isEmpty ? null : ctrl.text.trim()));
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
  }

  void _showRejectDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Pour Card'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Reason for rejection *',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (ctrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              context.read<PourCardBloc>().add(RejectPourCard(ctrl.text.trim()));
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
}

// ---------------------------------------------------------------------------
// Supporting widgets
// ---------------------------------------------------------------------------

class _StatusBanner extends StatelessWidget {
  final QualityCardStatus status;
  const _StatusBanner({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: status.color.withValues(alpha: 0.12),
      child: Row(
        children: [
          Icon(_statusIcon(status), size: 16, color: status.color),
          const SizedBox(width: 8),
          Text(
            status.label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: status.color,
            ),
          ),
        ],
      ),
    );
  }

  IconData _statusIcon(QualityCardStatus s) => switch (s) {
    QualityCardStatus.draft => Icons.edit_outlined,
    QualityCardStatus.submitted => Icons.hourglass_top_outlined,
    QualityCardStatus.approved => Icons.verified_outlined,
    QualityCardStatus.rejected => Icons.cancel_outlined,
    QualityCardStatus.locked => Icons.lock_outline,
  };
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  final Widget? trailing;

  const _SectionCard({required this.title, required this.child, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                ),
                if (trailing != null) trailing!,
              ],
            ),
            const Divider(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

class _EditableField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool enabled;
  final int maxLines;
  final ValueChanged<String>? onChanged;

  const _EditableField({
    required this.label,
    required this.controller,
    required this.enabled,
    this.maxLines = 1,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      enabled: enabled,
      maxLines: maxLines,
      onChanged: onChanged,
      style: const TextStyle(fontSize: 13),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 12),
        border: const OutlineInputBorder(),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        isDense: true,
      ),
    );
  }
}

/// Slim, scannable summary line for one pour entry — truck number,
/// quantity, grade, and a time — so the entries list stays readable without
/// scrolling through a dozen fields per row. Tap opens
/// [PourEntryDetailPage] for the full form; the trailing icon deletes the
/// entry directly from the list.
class _PourEntrySummaryTile extends StatelessWidget {
  final int index;
  final PourCardEntry entry;
  final bool isEditable;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  const _PourEntrySummaryTile({
    required this.index,
    required this.entry,
    required this.isEditable,
    required this.onTap,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final time = entry.arrivalTimeAtSite ?? entry.batchStartTime;
    final hasTruck = entry.truckNo?.isNotEmpty == true;
    final isIncomplete = !hasTruck || entry.quantityM3 == null;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 20,
              child: Text('${index + 1}',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.local_shipping_outlined, size: 13, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Text(
                        hasTruck ? entry.truckNo! : 'No truck no.',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: hasTruck ? Colors.black87 : Colors.grey.shade400,
                        ),
                      ),
                      if (isIncomplete) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade50,
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: Colors.orange.shade200),
                          ),
                          child: Text('Incomplete',
                              style: TextStyle(fontSize: 9, color: Colors.orange.shade800, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (entry.quantityM3 != null) '${entry.quantityM3!.toStringAsFixed(2)} m³',
                      if (entry.mixIdOrGrade?.isNotEmpty == true) entry.mixIdOrGrade!,
                      if (time?.isNotEmpty == true) time!,
                    ].join('  •  '),
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            if (onDelete != null)
              GestureDetector(
                onTap: onDelete,
                child: Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: Icon(Icons.delete_outline, size: 18, color: Colors.red.shade400),
                ),
              )
            else
              Icon(Icons.chevron_right, size: 18, color: Colors.grey.shade400),
          ],
        ),
      ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  final QualityPourCard card;
  final bool isEditable;
  final bool canSubmit;
  final bool canApprove;
  final ThemeData theme;
  final VoidCallback onSave;
  final VoidCallback onSubmit;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  const _ActionBar({
    required this.card,
    required this.isEditable,
    required this.canSubmit,
    required this.canApprove,
    required this.theme,
    required this.onSave,
    required this.onSubmit,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    // Locked / approved / rejected — no actions needed
    if (!card.status.isEditable &&
        card.status != QualityCardStatus.submitted) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          if (isEditable) ...[
            OutlinedButton.icon(
              onPressed: onSave,
              icon: const Icon(Icons.save_outlined, size: 16),
              label: const Text('Save Draft'),
              style: OutlinedButton.styleFrom(textStyle: const TextStyle(fontSize: 12)),
            ),
            const SizedBox(width: 8),
          ],
          if (canSubmit)
            Expanded(
              child: FilledButton.icon(
                onPressed: onSubmit,
                icon: const Icon(Icons.send_outlined, size: 16),
                label: const Text('Submit'),
                style: FilledButton.styleFrom(textStyle: const TextStyle(fontSize: 12)),
              ),
            ),
          if (card.status == QualityCardStatus.submitted && canApprove) ...[
            OutlinedButton.icon(
              onPressed: onReject,
              icon: const Icon(Icons.cancel_outlined, size: 16),
              label: const Text('Reject'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red.shade700,
                side: BorderSide(color: Colors.red.shade400),
                textStyle: const TextStyle(fontSize: 12),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                onPressed: onApprove,
                icon: const Icon(Icons.verified_outlined, size: 16),
                label: const Text('Approve'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.green.shade700,
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
