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
          PourCardLoaded s => s.card,
          PourCardSaving s => s.card,
          PourCardActionSuccess s => s.card,
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
  final List<ConcreteGrade> concreteGrades;

  const _PourCardBody({
    required this.card,
    required this.inspectionId,
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
    final isEditable = card.status.isEditable && ps.canRaiseRfi;
    final canApprove = ps.canApproveInspection;
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

              // Concrete pour entries table
              _SectionCard(
                title: 'Concrete Pour Entries',
                trailing: isEditable
                    ? TextButton.icon(
                        onPressed: () => context.read<PourCardBloc>().add(const AddPourEntry()),
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add Row'),
                      )
                    : null,
                child: card.entries.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Center(child: Text('No entries yet. Tap "Add Row" to begin.', style: TextStyle(color: Colors.grey))),
                      )
                    : Column(
                        children: [
                          for (int i = 0; i < card.entries.length; i++)
                            _PourEntryRow(
                              index: i,
                              entry: card.entries[i],
                              isEditable: isEditable,
                              concreteGrades: widget.concreteGrades,
                              onDelete: isEditable
                                  ? () => context.read<PourCardBloc>().add(RemovePourEntry(i))
                                  : null,
                              onUpdate: (entry) =>
                                  context.read<PourCardBloc>().add(UpdatePourEntry(i, entry)),
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

class _PourEntryRow extends StatefulWidget {
  final int index;
  final PourCardEntry entry;
  final bool isEditable;
  final List<ConcreteGrade> concreteGrades;
  final VoidCallback? onDelete;
  final ValueChanged<PourCardEntry> onUpdate;

  const _PourEntryRow({
    required this.index,
    required this.entry,
    required this.isEditable,
    this.concreteGrades = const [],
    this.onDelete,
    required this.onUpdate,
  });

  @override
  State<_PourEntryRow> createState() => _PourEntryRowState();
}

class _PourEntryRowState extends State<_PourEntryRow> {
  late final TextEditingController _pourDateCtrl;
  late final TextEditingController _truckNoCtrl;
  late final TextEditingController _challanCtrl;
  late final TextEditingController _gradeCtrl;
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _slumpCtrl;
  late final TextEditingController _tempCtrl;
  late final TextEditingController _cubesCtrl;

  @override
  void initState() {
    super.initState();
    final e = widget.entry;
    _pourDateCtrl = TextEditingController(text: e.pourDate ?? '');
    _truckNoCtrl = TextEditingController(text: e.truckNo ?? '');
    _challanCtrl = TextEditingController(text: e.deliveryChallanNo ?? '');
    _gradeCtrl = TextEditingController(text: e.mixIdOrGrade ?? '');
    _qtyCtrl = TextEditingController(text: e.quantityM3?.toString() ?? '');
    _slumpCtrl = TextEditingController(text: e.slumpMm?.toString() ?? '');
    _tempCtrl = TextEditingController(text: e.concreteTemperature?.toString() ?? '');
    _cubesCtrl = TextEditingController(text: e.noOfCubesTaken?.toString() ?? '');
  }

  @override
  void dispose() {
    _pourDateCtrl.dispose();
    _truckNoCtrl.dispose();
    _challanCtrl.dispose();
    _gradeCtrl.dispose();
    _qtyCtrl.dispose();
    _slumpCtrl.dispose();
    _tempCtrl.dispose();
    _cubesCtrl.dispose();
    super.dispose();
  }

  void _push() {
    widget.onUpdate(widget.entry.copyWith(
      pourDate: _pourDateCtrl.text.isEmpty ? null : _pourDateCtrl.text,
      truckNo: _truckNoCtrl.text.isEmpty ? null : _truckNoCtrl.text,
      deliveryChallanNo: _challanCtrl.text.isEmpty ? null : _challanCtrl.text,
      mixIdOrGrade: _gradeCtrl.text.isEmpty ? null : _gradeCtrl.text,
      quantityM3: double.tryParse(_qtyCtrl.text),
      slumpMm: double.tryParse(_slumpCtrl.text),
      concreteTemperature: double.tryParse(_tempCtrl.text),
      noOfCubesTaken: int.tryParse(_cubesCtrl.text),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Entry ${widget.index + 1}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const Spacer(),
              if (widget.onDelete != null)
                GestureDetector(
                  onTap: widget.onDelete,
                  child: Icon(Icons.delete_outline, size: 18, color: Colors.red.shade400),
                ),
            ],
          ),
          const SizedBox(height: 8),
          _RowField('Pour Date', _pourDateCtrl, widget.isEditable, _push, hint: 'DD/MM/YYYY'),
          _RowField('Truck No.', _truckNoCtrl, widget.isEditable, _push),
          _RowField('Delivery Challan No.', _challanCtrl, widget.isEditable, _push),
          // Grade — dropdown when grades are available, text field otherwise
          if (widget.concreteGrades.isNotEmpty)
            _GradeDropdownField(
              label: 'Mix ID / Grade',
              currentValue: _gradeCtrl.text.isEmpty ? null : _gradeCtrl.text,
              grades: widget.concreteGrades,
              enabled: widget.isEditable,
              onChanged: (v) {
                _gradeCtrl.text = v ?? '';
                _push();
              },
            )
          else
            _RowField('Mix ID / Grade', _gradeCtrl, widget.isEditable, _push),
          _RowField('Quantity (m³)', _qtyCtrl, widget.isEditable, _push,
              keyboardType: TextInputType.number),
          _RowField('Slump (mm)', _slumpCtrl, widget.isEditable, _push,
              keyboardType: TextInputType.number),
          _RowField('Concrete Temp (°C)', _tempCtrl, widget.isEditable, _push,
              keyboardType: TextInputType.number),
          _RowField('No. of Cubes', _cubesCtrl, widget.isEditable, _push,
              keyboardType: TextInputType.number),
          // Cube IDs — shown after pour card is approved
          if (widget.entry.cubeIds.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 140,
                  child: Text('Cube IDs',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
                ),
                Expanded(
                  child: Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: widget.entry.cubeIds
                        .map((id) => Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.indigo.shade50,
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: Colors.indigo.shade200),
                              ),
                              child: Text(id,
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.indigo.shade700)),
                            ))
                        .toList(),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _RowField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onChanged;
  final TextInputType keyboardType;
  final String? hint;

  const _RowField(
    this.label,
    this.controller,
    this.enabled,
    this.onChanged, {
    this.keyboardType = TextInputType.text,
    this.hint,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 140,
            child: Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              keyboardType: keyboardType,
              onChanged: (_) => onChanged(),
              style: const TextStyle(fontSize: 12),
              decoration: InputDecoration(
                hintText: hint,
                border: const OutlineInputBorder(),
                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                isDense: true,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Dropdown field for selecting a concrete grade from the master list.
/// Falls back gracefully: if [grades] is empty it will never be shown
/// (the caller switches to _RowField instead).
class _GradeDropdownField extends StatelessWidget {
  final String label;
  final String? currentValue;
  final List<ConcreteGrade> grades;
  final bool enabled;
  final ValueChanged<String?> onChanged;

  const _GradeDropdownField({
    required this.label,
    required this.currentValue,
    required this.grades,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    // Ensure the current value is in the list; if not, treat as null so the
    // dropdown doesn't crash with an out-of-range assertion.
    final validValue =
        grades.any((g) => g.grade == currentValue) ? currentValue : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 140,
            child: Text(label,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
          ),
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: validValue,
              isExpanded: true,
              isDense: true,
              hint: const Text('Select grade', style: TextStyle(fontSize: 12)),
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                isDense: true,
              ),
              items: grades
                  .map((g) => DropdownMenuItem(
                        value: g.grade,
                        child: Text(g.grade,
                            style: const TextStyle(fontSize: 12)),
                      ))
                  .toList(),
              onChanged: enabled ? onChanged : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  final QualityPourCard card;
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
