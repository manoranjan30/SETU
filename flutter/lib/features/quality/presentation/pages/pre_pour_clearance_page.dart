import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:open_file/open_file.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/clearance_card_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/signature_approval_sheet.dart';

/// The 7 attachment keys — must match the backend's CLEARANCE_ATTACHMENT_KEYS.
const _kAttachmentKeys = [
  'checklistPccAttached',
  'checklistWaterproofingAttached',
  'checklistFormworkAttached',
  'checklistReinforcementAttached',
  'checklistMepAttached',
  'checklistConcretingAttached',
  'concretePourCardAttached',
];

const _kAttachmentLabels = {
  'checklistPccAttached': 'PCC Checklist',
  'checklistWaterproofingAttached': 'Waterproofing Checklist',
  'checklistFormworkAttached': 'Formwork Checklist',
  'checklistReinforcementAttached': 'Reinforcement Checklist',
  'checklistMepAttached': 'MEP Checklist',
  'checklistConcretingAttached': 'Concreting Checklist',
  'concretePourCardAttached': 'Concrete Pour Card',
};

class PrePourClearancePage extends StatelessWidget {
  final int inspectionId;
  final String? activityName;
  final String? locationLabel;
  final int? projectId;
  final int? epsNodeId;

  const PrePourClearancePage({
    super.key,
    required this.inspectionId,
    this.activityName,
    this.locationLabel,
    this.projectId,
    this.epsNodeId,
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
        projectId: projectId,
        epsNodeId: epsNodeId,
      ),
    );
  }
}

class _ClearanceView extends StatefulWidget {
  final int inspectionId;
  final String? activityName;
  final String? locationLabel;
  final int? projectId;
  final int? epsNodeId;

  const _ClearanceView({
    required this.inspectionId,
    this.activityName,
    this.locationLabel,
    this.projectId,
    this.epsNodeId,
  });

  @override
  State<_ClearanceView> createState() => _ClearanceViewState();
}

class _ClearanceViewState extends State<_ClearanceView> {
  bool _isPdfDownloading = false;

  // Approved floor inspections for the attachment checklist selector
  List<QualityInspection> _floorInspections = [];

  @override
  void initState() {
    super.initState();
    if (widget.projectId != null) {
      _loadFloorInspections();
    }
  }

  Future<void> _loadFloorInspections() async {
    try {
      final raw = await sl<SetuApiClient>().getQualityInspections(
        projectId: widget.projectId!,
        epsNodeId: widget.epsNodeId,
      );
      if (!mounted) return;
      setState(() {
        _floorInspections = raw
            .whereType<Map<String, dynamic>>()
            .map(QualityInspection.fromJson)
            .where((i) =>
                i.status != InspectionStatus.canceled &&
                i.status != InspectionStatus.reversed)
            .toList();
      });
    } catch (_) {}
  }

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
          final ClearanceCardLoaded s => s.card,
          final ClearanceCardSaving s => s.card,
          final ClearanceCardActionSuccess s => s.card,
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
                        _ClearanceBody(
                          card: card,
                          inspectionId: widget.inspectionId,
                          floorInspections: _floorInspections,
                        ),
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
  final List<QualityInspection> floorInspections;

  const _ClearanceBody({
    required this.card,
    required this.inspectionId,
    this.floorInspections = const [],
  });

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
    // Signing does not require raise-RFI permission — any authenticated user can sign.
    final canSign = card.status.isEditable && card.isActivated;
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
                    final selectedIds = card.attachmentChecklistSelections[key] ?? [];
                    return _AttachmentRow(
                      lineKey: key,
                      label: label,
                      value: current,
                      enabled: isEditable,
                      inspectionId: widget.inspectionId,
                      availableInspections: widget.floorInspections,
                      selectedChecklistIds: selectedIds,
                      documents: card.attachmentDocuments[key] ?? [],
                      onChanged: (v) => context.read<ClearanceCardBloc>().add(UpdateAttachment(key, v)),
                      onChecklistSelectionChanged: isEditable
                          ? (ids) => context.read<ClearanceCardBloc>()
                              .add(UpdateAttachmentChecklistSelection(key, ids))
                          : null,
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
                              inspectionId: widget.inspectionId,
                              // Signing is open to any authenticated user — no canRaiseRfi check
                              onSign: canSign
                                  ? () {
                                      final signoff = card.signoffs[i];
                                      SignatureApprovalSheet.showForSignoff(
                                        context,
                                        department: signoff.department,
                                        personName: signoff.personName,
                                      ).then((result) {
                                        if (result != null && context.mounted) {
                                          context.read<ClearanceCardBloc>().add(
                                            MarkSignoffSigned(i, result.$1, result.$2),
                                          );
                                        }
                                      });
                                    }
                                  : null,
                              onWaive: canSign
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

/// Icon + label + value row used in the checklist detail bottom sheet.
class _DetailLine extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _DetailLine({
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
          Icon(icon, size: 16, color: Colors.grey.shade500),
          const SizedBox(width: 8),
          SizedBox(
            width: 96,
            child: Text(label,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ),
          Expanded(
            child: Text(value,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: valueColor)),
          ),
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

class _AttachmentRow extends StatefulWidget {
  final String lineKey;
  final String label;
  final String value;
  final bool enabled;
  final ValueChanged<String> onChanged;
  final List<QualityInspection> availableInspections;
  final List<int> selectedChecklistIds;
  final void Function(List<int>)? onChecklistSelectionChanged;
  final List<ClearanceAttachmentDocument> documents;
  final int inspectionId;

  const _AttachmentRow({
    required this.lineKey,
    required this.label,
    required this.value,
    required this.enabled,
    required this.onChanged,
    required this.inspectionId,
    this.availableInspections = const [],
    this.selectedChecklistIds = const [],
    this.onChecklistSelectionChanged,
    this.documents = const [],
  });

  @override
  State<_AttachmentRow> createState() => _AttachmentRowState();
}

class _AttachmentRowState extends State<_AttachmentRow> {
  bool _isUploading = false;
  String? _uploadError;

  static const int _maxDocs = 5;
  static const int _maxBytes = 10 * 1024 * 1024; // 10 MB

  String _mimeType(String fileName) {
    switch (fileName.toLowerCase().split('.').last) {
      case 'pdf': return 'application/pdf';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'webp': return 'image/webp';
      default: return 'application/octet-stream';
    }
  }

  /// Shows the full context for a related checklist RFI — Checklist Name >
  /// Element (block/tower/floor/unit) > GO Details — so the user doesn't
  /// have to guess what a bare "RFI #123" row refers to.
  void _showChecklistDetail(BuildContext context, QualityInspection insp) {
    final element = insp.locationPath ??
        insp.epsNodeLabel ??
        [insp.blockName, insp.towerName, insp.floorName, insp.unitName]
            .where((s) => s != null && s.isNotEmpty)
            .join(' › ');
    final go = [
      if (insp.goLabel != null) insp.goLabel!,
      if (insp.goNo != null && insp.goLabel == null) 'GO ${insp.goNo}',
      if (insp.goDetails != null) insp.goDetails!,
    ].join(' — ');

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36, height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text('Checklist Detail',
                style: Theme.of(ctx).textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            _DetailLine(
              icon: Icons.checklist_rtl_outlined,
              label: 'Checklist Name',
              value: insp.activityName ?? '—',
            ),
            _DetailLine(
              icon: Icons.location_on_outlined,
              label: 'Element',
              value: element.isEmpty ? '—' : element,
            ),
            _DetailLine(
              icon: Icons.assignment_outlined,
              label: 'GO Details',
              value: go.isEmpty ? '—' : go,
            ),
            if (insp.isMultiPart)
              _DetailLine(
                icon: Icons.layers_outlined,
                label: 'Part',
                value: insp.partDisplay,
              ),
            if (insp.vendorName != null)
              _DetailLine(
                icon: Icons.business_outlined,
                label: 'Vendor',
                value: insp.vendorName!,
              ),
            _DetailLine(
              icon: Icons.flag_outlined,
              label: 'Status',
              value: insp.status.label,
              valueColor: insp.status.color,
            ),
            _DetailLine(
              icon: Icons.event_outlined,
              label: 'Requested',
              value: insp.requestDate,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndUpload() async {
    if (widget.documents.length >= _maxDocs) {
      setState(() => _uploadError = 'Maximum $_maxDocs documents per line');
      return;
    }

    final source = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(ctx, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Photo Gallery'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
            ListTile(
              leading: const Icon(Icons.upload_file_outlined),
              title: const Text('Choose File (PDF / Image)'),
              onTap: () => Navigator.pop(ctx, 'file'),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;

    XFile? file;
    try {
      if (source == 'camera') {
        file = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 80);
      } else if (source == 'gallery') {
        file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
      } else {
        final result = await FilePicker.platform.pickFiles(
          type: FileType.custom,
          allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
          withData: false,
        );
        if (result?.files.isNotEmpty == true && result!.files.first.path != null) {
          file = XFile(result.files.first.path!);
        }
      }
    } catch (_) {}
    if (file == null) return;

    final size = await file.length();
    if (size > _maxBytes) {
      setState(() => _uploadError = 'File exceeds 10 MB limit');
      return;
    }

    setState(() { _isUploading = true; _uploadError = null; });
    try {
      final data = await sl<SetuApiClient>().uploadClearanceAttachment(
        inspectionId: widget.inspectionId,
        lineKey: widget.lineKey,
        filePath: file.path,
        fileName: file.name,
        mimeType: _mimeType(file.name),
      );
      if (!mounted) return;
      context.read<ClearanceCardBloc>().add(
        AddClearanceDocument(
          widget.lineKey,
          ClearanceAttachmentDocument.fromJson(data),
        ),
      );
    } catch (e) {
      // Offline (or any upload failure): persist the file so it survives app
      // restart/cache cleanup, then queue it for upload — without this the
      // picked file would just be discarded and the document permanently lost.
      try {
        final localPath = await _savePendingDocLocally(file.path, file.name);
        await sl<SyncService>().addToQueue(
          entityType: 'clearance_attachment_upload',
          entityId: widget.inspectionId,
          operation: 'create',
          payload: {
            'inspectionId': widget.inspectionId,
            'lineKey': widget.lineKey,
            'localPath': localPath,
            'fileName': file.name,
            'mimeType': _mimeType(file.name),
          },
          priority: 2,
        );
        // Attempt immediate sync in case the first failure was transient
        // (e.g. a momentary network blip) rather than truly offline.
        unawaited(sl<SyncService>().syncAll());
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('Saved locally — will upload when online.'),
            backgroundColor: Colors.orange.shade700,
          ));
        }
      } catch (_) {
        if (mounted) setState(() => _uploadError = 'Upload failed. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  /// Saves a picked attachment to a persistent app directory so it survives
  /// app restarts and OS temp-cache cleanup until [SyncService] uploads it.
  /// Mirrors the `pending_obs_photos` pattern used by the offline-capable
  /// observation flows elsewhere in the app.
  Future<String> _savePendingDocLocally(String sourcePath, String fileName) async {
    final dir = await getApplicationDocumentsDirectory();
    final pendingDir = Directory(p.join(dir.path, 'pending_clearance_docs'));
    await pendingDir.create(recursive: true);
    final dest = File(p.join(
        pendingDir.path, '${DateTime.now().millisecondsSinceEpoch}_$fileName'));
    await File(sourcePath).copy(dest.path);
    return dest.path;
  }

  Future<void> _openDocument(ClearanceAttachmentDocument doc) async {
    try {
      final dir = await getTemporaryDirectory();
      final ext = doc.originalName.contains('.')
          ? doc.originalName.split('.').last
          : 'bin';
      final savePath = '${dir.path}/clearance_doc_${doc.id}.$ext';
      await sl<SetuApiClient>().downloadFile(doc.url, savePath);
      await OpenFile.open(savePath);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open document')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final value = widget.value;
    final enabled = widget.enabled;
    final docs = widget.documents;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── YES / NO / N/A toggle row ──────────────────────────────────
          Row(
            children: [
              Expanded(child: Text(widget.label, style: const TextStyle(fontSize: 12))),
              _ToggleChip(
                label: 'YES', selected: value == 'YES',
                color: Colors.green, enabled: enabled,
                onTap: enabled ? () => widget.onChanged('YES') : null,
              ),
              const SizedBox(width: 4),
              _ToggleChip(
                label: 'NO', selected: value == 'NO',
                color: Colors.red, enabled: enabled,
                onTap: enabled ? () => widget.onChanged('NO') : null,
              ),
              const SizedBox(width: 4),
              _ToggleChip(
                label: 'N/A', selected: value == 'NA',
                color: Colors.grey, enabled: enabled,
                onTap: enabled ? () => widget.onChanged('NA') : null,
              ),
            ],
          ),

          // ── Panel shown only when YES ──────────────────────────────────
          if (value == 'YES') ...[
            const SizedBox(height: 6),

            // Related checklist RFI selector
            if (widget.availableInspections.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Select related checklist RFIs',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                          color: Colors.green.shade800),
                    ),
                    const SizedBox(height: 4),
                    ...widget.availableInspections.map((insp) {
                      final isSelected = widget.selectedChecklistIds.contains(insp.id);
                      final displayLabel = [
                        if (insp.goLabel != null) insp.goLabel!,
                        if (insp.activityName != null) insp.activityName!,
                        'RFI #${insp.id}',
                      ].join(' · ');
                      return InkWell(
                        onTap: widget.onChecklistSelectionChanged == null ? null : () {
                          final updated = List<int>.from(widget.selectedChecklistIds);
                          if (isSelected) {
                            updated.remove(insp.id);
                          } else {
                            updated.add(insp.id);
                          }
                          widget.onChecklistSelectionChanged!(updated);
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 20, height: 20,
                                child: Checkbox(
                                  value: isSelected,
                                  visualDensity: VisualDensity.compact,
                                  onChanged: widget.onChecklistSelectionChanged == null ? null : (v) {
                                    final updated = List<int>.from(widget.selectedChecklistIds);
                                    if (v == true) {
                                      updated.add(insp.id);
                                    } else {
                                      updated.remove(insp.id);
                                    }
                                    widget.onChecklistSelectionChanged!(updated);
                                  },
                                ),
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(displayLabel,
                                    style: const TextStyle(fontSize: 11),
                                    overflow: TextOverflow.ellipsis),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: insp.status.color.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(3),
                                ),
                                child: Text(insp.status.label,
                                    style: TextStyle(fontSize: 9, color: insp.status.color,
                                        fontWeight: FontWeight.w600)),
                              ),
                              InkWell(
                                onTap: () => _showChecklistDetail(context, insp),
                                borderRadius: BorderRadius.circular(12),
                                child: const Padding(
                                  padding: EdgeInsets.all(4),
                                  child: Icon(Icons.info_outline_rounded,
                                      size: 14, color: Color(0xFF15803D)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
              const SizedBox(height: 6),
            ] else if (widget.selectedChecklistIds.isNotEmpty) ...[
              // Read-only chips when no floor inspections loaded yet
              Wrap(
                spacing: 4,
                children: widget.selectedChecklistIds.map((id) => Chip(
                  label: Text('RFI #$id', style: const TextStyle(fontSize: 10)),
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                )).toList(),
              ),
              const SizedBox(height: 6),
            ],

            // ── Supporting Documents panel ─────────────────────────────
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Supporting Documents',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                        color: Colors.blue.shade800),
                  ),
                  if (docs.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    ...docs.map((doc) => _DocumentTile(
                      doc: doc,
                      canDelete: enabled,
                      onOpen: () => _openDocument(doc),
                      onDelete: enabled
                          ? () => context.read<ClearanceCardBloc>().add(
                                DeleteClearanceDocument(widget.lineKey, doc.id))
                          : null,
                    )),
                  ],
                  if (_isUploading)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 6),
                      child: LinearProgressIndicator(),
                    ),
                  if (_uploadError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        _uploadError!,
                        style: TextStyle(fontSize: 10, color: Colors.red.shade700),
                      ),
                    ),
                  if (enabled && docs.length < _maxDocs && !_isUploading) ...[
                    const SizedBox(height: 4),
                    GestureDetector(
                      onTap: _pickAndUpload,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add_circle_outline,
                              size: 14, color: Colors.blue.shade700),
                          const SizedBox(width: 4),
                          Text(
                            'Add document (${docs.length}/$_maxDocs)',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.blue.shade700,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  final ClearanceAttachmentDocument doc;
  final bool canDelete;
  final VoidCallback onOpen;
  final VoidCallback? onDelete;

  const _DocumentTile({
    required this.doc,
    required this.canDelete,
    required this.onOpen,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(
            doc.isImage ? Icons.image_outlined : Icons.picture_as_pdf_outlined,
            size: 18,
            color: doc.isImage ? Colors.blue.shade600 : Colors.red.shade600,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  doc.originalName,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  doc.sizeLabel,
                  style: TextStyle(fontSize: 9, color: Colors.grey.shade500),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.open_in_new_outlined,
                size: 16, color: Colors.blue.shade600),
            tooltip: 'Open',
            onPressed: onOpen,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
          if (canDelete) ...[
            const SizedBox(width: 2),
            IconButton(
              icon: Icon(Icons.delete_outline,
                  size: 16, color: Colors.red.shade400),
              tooltip: 'Delete',
              onPressed: onDelete,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
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

class _SignoffRow extends StatefulWidget {
  final int index;
  final ClearanceSignoff signoff;
  final bool isEditable;
  final int inspectionId;
  final VoidCallback? onSign;
  final VoidCallback? onWaive;
  final VoidCallback? onRemove;

  const _SignoffRow({
    required this.index,
    required this.signoff,
    required this.isEditable,
    required this.inspectionId,
    this.onSign,
    this.onWaive,
    this.onRemove,
  });

  @override
  State<_SignoffRow> createState() => _SignoffRowState();
}

class _SignoffRowState extends State<_SignoffRow> {
  bool _qrLoading = false;

  Future<void> _showQr() async {
    final signoffId = widget.signoff.id;
    if (signoffId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Save the card first before generating a QR code.')),
      );
      return;
    }

    setState(() => _qrLoading = true);
    try {
      final data = await sl<SetuApiClient>().createClearanceSignoffQr(
        inspectionId: widget.inspectionId,
        signoffId: signoffId,
      );
      if (!mounted) return;
      setState(() => _qrLoading = false);
      _openQrDialog(data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _qrLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not generate QR: ${e.toString().replaceAll('Exception: ', '')}'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  void _openQrDialog(Map<String, dynamic> data) {
    showDialog(
      context: context,
      builder: (ctx) => _SignoffQrDialog(
        data: data,
        department: widget.signoff.department,
        designation: widget.signoff.designation,
        inspectionId: widget.inspectionId,
        signoffId: widget.signoff.id!,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final signoff = widget.signoff;
    final isEditable = widget.isEditable;
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
                // Signature thumbnail — shown when this row has been digitally signed
                if (signoff.signatureData != null) ...[
                  const SizedBox(height: 6),
                  Container(
                    height: 48,
                    width: 120,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(4),
                      color: Colors.white,
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: Image.memory(
                        () {
                          final s = signoff.signatureData!;
                          final b64 = s.contains(',') ? s.split(',').last : s;
                          return base64Decode(b64);
                        }(),
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  if (signoff.signedByName != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        signoff.signedByName!,
                        style: TextStyle(fontSize: 9, color: Colors.grey.shade500),
                      ),
                    ),
                ],
              ],
            ),
          ),
          if (signoff.status == ClearanceSignoffStatus.pending) ...[
            // QR code — visible to all users so signatory can scan from their own phone
            _qrLoading
                ? const SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : IconButton(
                    icon: const Icon(Icons.qr_code_2_outlined, size: 18),
                    color: Colors.indigo.shade600,
                    tooltip: 'Show Signature QR',
                    onPressed: widget.onSign != null ? _showQr : null,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
            const SizedBox(width: 4),
            // Direct sign button (same permission as QR)
            IconButton(
              icon: const Icon(Icons.check_circle_outline, size: 18),
              color: Colors.green.shade600,
              tooltip: 'Sign',
              onPressed: widget.onSign,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(Icons.remove_circle_outline, size: 18),
              color: Colors.grey.shade600,
              tooltip: 'Waive',
              onPressed: widget.onWaive,
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
              onPressed: widget.onRemove,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }
}

// ── QR dialog ──────────────────────────────────────────────────────────────

/// Shows the QR code image for a specific clearance signoff.
/// Includes a 5-minute countdown and a Regenerate button when the code expires.
class _SignoffQrDialog extends StatefulWidget {
  final Map<String, dynamic> data;
  final String department;
  final String? designation;
  final int inspectionId;
  final String signoffId;

  const _SignoffQrDialog({
    required this.data,
    required this.department,
    this.designation,
    required this.inspectionId,
    required this.signoffId,
  });

  @override
  State<_SignoffQrDialog> createState() => _SignoffQrDialogState();
}

class _SignoffQrDialogState extends State<_SignoffQrDialog> {
  late Map<String, dynamic> _data;
  late int _secondsLeft;
  Timer? _timer;
  bool _regenerating = false;

  @override
  void initState() {
    super.initState();
    _data = widget.data;
    _secondsLeft = _data['expiresInSeconds'] as int? ?? 300;
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) t.cancel();
    });
  }

  Future<void> _regenerate() async {
    setState(() => _regenerating = true);
    try {
      final fresh = await sl<SetuApiClient>().createClearanceSignoffQr(
        inspectionId: widget.inspectionId,
        signoffId: widget.signoffId,
      );
      if (!mounted) return;
      setState(() {
        _data = fresh;
        _secondsLeft = fresh['expiresInSeconds'] as int? ?? 300;
        _regenerating = false;
      });
      _startTimer();
    } catch (e) {
      if (!mounted) return;
      setState(() => _regenerating = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not regenerate QR: ${e.toString().replaceAll('Exception: ', '')}'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  Uint8List? _decodeQr() {
    final dataUrl = _data['qrCodeDataUrl'] as String?;
    if (dataUrl == null || dataUrl.isEmpty) return null;
    try {
      final b64 = dataUrl.contains(',') ? dataUrl.split(',').last : dataUrl;
      return base64Decode(b64);
    } catch (_) {
      return null;
    }
  }

  String get _timerLabel {
    final m = (_secondsLeft ~/ 60).toString().padLeft(2, '0');
    final s = (_secondsLeft % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  bool get _expired => _secondsLeft <= 0;

  @override
  Widget build(BuildContext context) {
    final qrBytes = _decodeQr();
    final theme = Theme.of(context);

    return AlertDialog(
      title: Row(
        children: [
          Icon(Icons.qr_code_2, color: theme.colorScheme.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.department,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                if (widget.designation != null)
                  Text(widget.designation!,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              ],
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // QR image
          if (qrBytes != null && !_expired)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Image.memory(qrBytes, width: 220, height: 220, fit: BoxFit.contain),
            )
          else if (_expired)
            Container(
              width: 220, height: 220,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.timer_off_outlined, size: 48, color: Colors.grey.shade400),
                  const SizedBox(height: 8),
                  Text('QR Expired', style: TextStyle(color: Colors.grey.shade500)),
                ],
              ),
            ),

          const SizedBox(height: 12),

          // Countdown
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.timer_outlined,
                size: 14,
                color: _expired
                    ? Colors.red.shade600
                    : _secondsLeft <= 60
                        ? Colors.orange.shade700
                        : Colors.green.shade700,
              ),
              const SizedBox(width: 4),
              Text(
                _expired ? 'Expired' : 'Expires in $_timerLabel',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: _expired
                      ? Colors.red.shade600
                      : _secondsLeft <= 60
                          ? Colors.orange.shade700
                          : Colors.green.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Signatory scans this with the SETU app to sign',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
          ),
        ],
      ),
      actions: [
        if (_expired || _secondsLeft <= 30)
          TextButton.icon(
            icon: _regenerating
                ? const SizedBox(width: 14, height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.refresh, size: 16),
            label: const Text('Regenerate'),
            onPressed: _regenerating ? null : _regenerate,
          ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
      ],
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
