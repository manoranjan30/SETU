import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/clearance_card_bloc.dart';

/// The 7 attachment types used on the pre-pour clearance card.
const _kAttachmentKeys = [
  'mixDesignApproval',
  'preInspectionClearance',
  'rfaApproval',
  'shopDrawings',
  'materialApproval',
  'pour_plan',
  'castingRecord',
];

const _kAttachmentLabels = {
  'mixDesignApproval': 'Mix Design Approval',
  'preInspectionClearance': 'Pre-Inspection Clearance',
  'rfaApproval': 'RFA Approval',
  'shopDrawings': 'Shop Drawings',
  'materialApproval': 'Material Approval',
  'pour_plan': 'Pour Plan',
  'castingRecord': 'Casting Record',
};

class PrePourClearancePage extends StatelessWidget {
  final int inspectionId;
  final String? activityName;
  final String? locationLabel;

  const PrePourClearancePage({
    super.key,
    required this.inspectionId,
    this.activityName,
    this.locationLabel,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => ClearanceCardBloc(apiClient: sl<SetuApiClient>())
        ..add(LoadClearanceCard(inspectionId)),
      child: _ClearanceView(
        inspectionId: inspectionId,
        activityName: activityName,
        locationLabel: locationLabel,
      ),
    );
  }
}

class _ClearanceView extends StatefulWidget {
  final int inspectionId;
  final String? activityName;
  final String? locationLabel;

  const _ClearanceView({
    required this.inspectionId,
    this.activityName,
    this.locationLabel,
  });

  @override
  State<_ClearanceView> createState() => _ClearanceViewState();
}

class _ClearanceViewState extends State<_ClearanceView> {
  bool _isPdfDownloading = false;

  Future<void> _downloadPdf(BuildContext context, int inspectionId) async {
    setState(() => _isPdfDownloading = true);
    try {
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/clearance_card_$inspectionId.pdf';
      await sl<SetuApiClient>().downloadClearanceCardPdf(inspectionId, path);
      final result = await OpenFile.open(path);
      if (result.type != ResultType.done && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open PDF: ${result.message}')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('PDF download failed: $e'), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (mounted) setState(() => _isPdfDownloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ClearanceCardBloc, ClearanceCardState>(
      listener: (context, state) {
        if (state is ClearanceCardError) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.red.shade700,
          ));
        }
        if (state is ClearanceCardActionSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.green.shade700,
          ));
          final status = state.card.status;
          if (status == QualityCardStatus.approved || status == QualityCardStatus.rejected) {
            Navigator.of(context).pop();
          }
        }
      },
      builder: (context, state) {
        final QualityPrePourClearanceCard? card = switch (state) {
          ClearanceCardLoaded s => s.card,
          ClearanceCardSaving s => s.card,
          ClearanceCardActionSuccess s => s.card,
          _ => null,
        };
        final isLoading = state is ClearanceCardLoading;
        final isSaving = state is ClearanceCardSaving;

        return Scaffold(
          appBar: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Pre-Pour Clearance', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                if (widget.activityName != null)
                  Text(widget.activityName!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal)),
              ],
            ),
            actions: [
              if (card != null &&
                  (card.status == QualityCardStatus.approved || card.status == QualityCardStatus.submitted))
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
                        _ClearanceBody(card: card, inspectionId: widget.inspectionId),
                        if (isSaving)
                          const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator()),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 48, color: Colors.grey),
          const SizedBox(height: 16),
          const Text('Failed to load clearance card', style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => context.read<ClearanceCardBloc>().add(LoadClearanceCard(inspectionId)),
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _ClearanceBody extends StatefulWidget {
  final QualityPrePourClearanceCard card;
  final int inspectionId;

  const _ClearanceBody({required this.card, required this.inspectionId});

  @override
  State<_ClearanceBody> createState() => _ClearanceBodyState();
}

class _ClearanceBodyState extends State<_ClearanceBody> {
  late final TextEditingController _pourLocationCtrl;
  late final TextEditingController _pourNoCtrl;
  late final TextEditingController _gradeCtrl;
  late final TextEditingController _placementCtrl;
  late final TextEditingController _supplierCtrl;
  late final TextEditingController _slumpCtrl;
  late final TextEditingController _eqtyCtrl;

  @override
  void initState() {
    super.initState();
    final c = widget.card;
    _pourLocationCtrl = TextEditingController(text: c.pourLocation ?? '');
    _pourNoCtrl = TextEditingController(text: c.pourNo ?? '');
    _gradeCtrl = TextEditingController(text: c.gradeOfConcrete ?? '');
    _placementCtrl = TextEditingController(text: c.placementMethod ?? '');
    _supplierCtrl = TextEditingController(text: c.concreteSupplier ?? '');
    _slumpCtrl = TextEditingController(text: c.targetSlump ?? '');
    _eqtyCtrl = TextEditingController(text: c.estimatedConcreteQty?.toString() ?? '');
  }

  @override
  void dispose() {
    _pourLocationCtrl.dispose();
    _pourNoCtrl.dispose();
    _gradeCtrl.dispose();
    _placementCtrl.dispose();
    _supplierCtrl.dispose();
    _slumpCtrl.dispose();
    _eqtyCtrl.dispose();
    super.dispose();
  }

  void _pushHeader(BuildContext context) {
    context.read<ClearanceCardBloc>().add(UpdateClearanceHeader(
      pourLocation: _pourLocationCtrl.text,
      pourNo: _pourNoCtrl.text,
      gradeOfConcrete: _gradeCtrl.text,
      placementMethod: _placementCtrl.text,
      concreteSupplier: _supplierCtrl.text,
      targetSlump: _slumpCtrl.text,
      estimatedConcreteQty: double.tryParse(_eqtyCtrl.text),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final card = widget.card;
    final ps = PermissionService.of(context);
    final isEditable = card.status.isEditable && card.isActivated && ps.canRaiseRfi;
    final canApprove = ps.canApproveInspection;
    final theme = Theme.of(context);

    return Column(
      children: [
        // Activation banner
        if (!card.isActivated)
          _ActivationBanner(activationStageName: card.activationStageName)
        else
          _StatusBannerCard(status: card.status),

        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Format / project info
              _SectionCard(
                title: 'Format: ${card.formatNo}',
                child: Column(
                  children: [
                    if (card.projectNameSnapshot != null)
                      _InfoRow('Project', card.projectNameSnapshot!),
                    if (card.contractorName != null)
                      _InfoRow('Contractor', card.contractorName!),
                    if (card.activityLabel != null)
                      _InfoRow('Activity', card.activityLabel!),
                    if (card.elementName != null)
                      _InfoRow('Element', card.elementName!),
                    if (card.locationText != null)
                      _InfoRow('Location', card.locationText!),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Pour details form
              _SectionCard(
                title: 'Pour Details',
                child: Column(
                  children: [
                    _FormField('Pour Location', _pourLocationCtrl, isEditable, () => _pushHeader(context)),
                    _FormField('Pour No.', _pourNoCtrl, isEditable, () => _pushHeader(context)),
                    _FormField('Grade of Concrete', _gradeCtrl, isEditable, () => _pushHeader(context)),
                    _FormField('Placement Method', _placementCtrl, isEditable, () => _pushHeader(context)),
                    _FormField('Concrete Supplier', _supplierCtrl, isEditable, () => _pushHeader(context)),
                    _FormField('Target Slump', _slumpCtrl, isEditable, () => _pushHeader(context)),
                    _FormField('Est. Concrete Qty (m³)', _eqtyCtrl, isEditable, () => _pushHeader(context),
                        keyboardType: TextInputType.number),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // 7 attachment YES/NO/NA selectors
              _SectionCard(
                title: 'Documents & Attachments',
                child: Column(
                  children: _kAttachmentKeys.map((key) {
                    final label = _kAttachmentLabels[key] ?? key;
                    final current = card.attachments[key] ?? 'NO';
                    return _AttachmentRow(
                      label: label,
                      value: current,
                      enabled: isEditable,
                      onChanged: (v) => context.read<ClearanceCardBloc>().add(UpdateAttachment(key, v)),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 12),

              // Signatories panel
              _SectionCard(
                title: 'Signatories',
                trailing: isEditable
                    ? TextButton.icon(
                        onPressed: () => _showAddSignoffDialog(context),
                        icon: const Icon(Icons.person_add_outlined, size: 16),
                        label: const Text('Add'),
                      )
                    : null,
                child: card.signoffs.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Center(child: Text('No signatories yet', style: TextStyle(color: Colors.grey))),
                      )
                    : Column(
                        children: [
                          for (int i = 0; i < card.signoffs.length; i++)
                            _SignoffRow(
                              index: i,
                              signoff: card.signoffs[i],
                              isEditable: isEditable,
                              onSign: isEditable
                                  ? () => context.read<ClearanceCardBloc>().add(MarkSignoffSigned(i))
                                  : null,
                              onWaive: isEditable
                                  ? () => context.read<ClearanceCardBloc>().add(MarkSignoffWaived(i))
                                  : null,
                              onRemove: isEditable
                                  ? () => context.read<ClearanceCardBloc>().add(RemoveSignoff(i))
                                  : null,
                            ),
                        ],
                      ),
              ),

              if (card.approvalRemarks != null || card.rejectionRemarks != null) ...[
                const SizedBox(height: 12),
                _SectionCard(
                  title: card.status == QualityCardStatus.rejected ? 'Rejection Details' : 'Approval Details',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (card.approvalRemarks != null)
                        _InfoRow('Remarks', card.approvalRemarks!),
                      if (card.rejectionRemarks != null)
                        _InfoRow('Reason', card.rejectionRemarks!),
                      if (card.approvedAt != null)
                        _InfoRow('Date', _fmtDate(card.approvedAt!)),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),
            ],
          ),
        ),

        _ActionBar(
          card: card,
          isEditable: isEditable,
          canApprove: canApprove,
          theme: theme,
          onSave: () => context.read<ClearanceCardBloc>().add(const SaveClearanceCard()),
          onSubmit: () => _confirmSubmit(context),
          onApprove: () => _showApproveDialog(context),
          onReject: () => _showRejectDialog(context),
        ),
      ],
    );
  }

  void _showAddSignoffDialog(BuildContext context) {
    final deptCtrl = TextEditingController();
    final desigCtrl = TextEditingController();
    final personCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Signatory'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: deptCtrl,
              decoration: const InputDecoration(labelText: 'Department *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: desigCtrl,
              decoration: const InputDecoration(labelText: 'Designation', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: personCtrl,
              decoration: const InputDecoration(labelText: 'Person Name', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (deptCtrl.text.trim().isEmpty) return;
              context.read<ClearanceCardBloc>().add(AddSignoff(
                department: deptCtrl.text.trim(),
                designation: desigCtrl.text.trim().isEmpty ? null : desigCtrl.text.trim(),
                personName: personCtrl.text.trim().isEmpty ? null : personCtrl.text.trim(),
              ));
              Navigator.pop(ctx);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  void _confirmSubmit(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Submit Clearance Card'),
        content: const Text('Submit this pre-pour clearance card for approval? You will not be able to edit it after submission.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<ClearanceCardBloc>().add(const SubmitClearanceCard());
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
        title: const Text('Approve Clearance Card'),
        content: TextField(
          controller: ctrl,
          maxLines: 2,
          decoration: const InputDecoration(labelText: 'Remarks (optional)', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<ClearanceCardBloc>().add(ApproveClearanceCard(
                remarks: ctrl.text.trim().isEmpty ? null : ctrl.text.trim(),
              ));
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
        title: const Text('Reject Clearance Card'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Reason *', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (ctrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              context.read<ClearanceCardBloc>().add(RejectClearanceCard(ctrl.text.trim()));
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  String _fmtDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
}

// ---------------------------------------------------------------------------
// Supporting widgets
// ---------------------------------------------------------------------------

class _ActivationBanner extends StatelessWidget {
  final String? activationStageName;
  const _ActivationBanner({this.activationStageName});

  @override
  Widget build(BuildContext context) {
    final msg = activationStageName != null
        ? 'Locked — waiting for stage "$activationStageName" to be approved'
        : 'Locked — waiting for trigger stage approval';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: Colors.orange.shade50,
      child: Row(
        children: [
          Icon(Icons.lock_outline, size: 16, color: Colors.orange.shade700),
          const SizedBox(width: 8),
          Expanded(
            child: Text(msg, style: TextStyle(fontSize: 12, color: Colors.orange.shade800)),
          ),
        ],
      ),
    );
  }
}

class _StatusBannerCard extends StatelessWidget {
  final QualityCardStatus status;
  const _StatusBannerCard({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: status.color.withValues(alpha: 0.12),
      child: Row(
        children: [
          Icon(_icon(status), size: 16, color: status.color),
          const SizedBox(width: 8),
          Text(status.label,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: status.color)),
        ],
      ),
    );
  }

  IconData _icon(QualityCardStatus s) => switch (s) {
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
                Expanded(child: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
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
            width: 110,
            child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }
}

class _FormField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onChanged;
  final TextInputType keyboardType;

  const _FormField(
    this.label,
    this.controller,
    this.enabled,
    this.onChanged, {
    this.keyboardType = TextInputType.text,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextField(
        controller: controller,
        enabled: enabled,
        keyboardType: keyboardType,
        onChanged: (_) => onChanged(),
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(fontSize: 12),
          border: const OutlineInputBorder(),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          isDense: true,
        ),
      ),
    );
  }
}

class _AttachmentRow extends StatelessWidget {
  final String label;
  final String value;
  final bool enabled;
  final ValueChanged<String> onChanged;

  const _AttachmentRow({
    required this.label,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 12))),
          _ToggleChip(
            label: 'YES',
            selected: value == 'YES',
            color: Colors.green,
            enabled: enabled,
            onTap: enabled ? () => onChanged('YES') : null,
          ),
          const SizedBox(width: 4),
          _ToggleChip(
            label: 'NO',
            selected: value == 'NO',
            color: Colors.red,
            enabled: enabled,
            onTap: enabled ? () => onChanged('NO') : null,
          ),
          const SizedBox(width: 4),
          _ToggleChip(
            label: 'N/A',
            selected: value == 'NA',
            color: Colors.grey,
            enabled: enabled,
            onTap: enabled ? () => onChanged('NA') : null,
          ),
        ],
      ),
    );
  }
}

class _ToggleChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color color;
  final bool enabled;
  final VoidCallback? onTap;

  const _ToggleChip({
    required this.label,
    required this.selected,
    required this.color,
    required this.enabled,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: selected ? color : Colors.grey.shade300),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: selected ? color : (enabled ? Colors.grey.shade600 : Colors.grey.shade400),
          ),
        ),
      ),
    );
  }
}

class _SignoffRow extends StatelessWidget {
  final int index;
  final ClearanceSignoff signoff;
  final bool isEditable;
  final VoidCallback? onSign;
  final VoidCallback? onWaive;
  final VoidCallback? onRemove;

  const _SignoffRow({
    required this.index,
    required this.signoff,
    required this.isEditable,
    this.onSign,
    this.onWaive,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(signoff.department,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                if (signoff.designation != null)
                  Text(signoff.designation!,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                if (signoff.personName != null)
                  Text(signoff.personName!,
                      style: const TextStyle(fontSize: 11)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: signoff.status.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    signoff.status.label,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: signoff.status.color,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (isEditable && signoff.status == ClearanceSignoffStatus.pending) ...[
            IconButton(
              icon: const Icon(Icons.check_circle_outline, size: 18),
              color: Colors.green.shade600,
              tooltip: 'Mark Signed',
              onPressed: onSign,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(Icons.remove_circle_outline, size: 18),
              color: Colors.grey.shade600,
              tooltip: 'Waive',
              onPressed: onWaive,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 4),
          ],
          if (isEditable)
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 18),
              color: Colors.red.shade400,
              tooltip: 'Remove',
              onPressed: onRemove,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  final QualityPrePourClearanceCard card;
  final bool isEditable;
  final bool canApprove;
  final ThemeData theme;
  final VoidCallback onSave;
  final VoidCallback onSubmit;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  const _ActionBar({
    required this.card,
    required this.isEditable,
    required this.canApprove,
    required this.theme,
    required this.onSave,
    required this.onSubmit,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    if (!card.status.isEditable && card.status != QualityCardStatus.submitted) {
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
              label: const Text('Save'),
              style: OutlinedButton.styleFrom(textStyle: const TextStyle(fontSize: 12)),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                onPressed: onSubmit,
                icon: const Icon(Icons.send_outlined, size: 16),
                label: const Text('Submit'),
                style: FilledButton.styleFrom(textStyle: const TextStyle(fontSize: 12)),
              ),
            ),
          ],
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
