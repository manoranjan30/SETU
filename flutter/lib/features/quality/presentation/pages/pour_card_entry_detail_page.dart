import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:setu_mobile/core/media/batch_slip_ocr_service.dart';
import 'package:setu_mobile/features/quality/data/batch_slip_parser.dart';
import 'package:setu_mobile/features/quality/data/models/cube_register_models.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/pour_card_bloc.dart';
import 'package:setu_mobile/shared/utils/date_picker_util.dart';

/// Full-form editor for one [PourCardEntry], opened by tapping its summary
/// line on [PourCardPage]. Replaces the old always-expanded per-entry card
/// so the entry list stays scannable while still capturing every field the
/// `F/QA/16 Concrete Pourcard` PDF format needs.
///
/// Edits are kept local to this page's controllers and only committed to
/// [PourCardBloc] when the user taps Save — which also autosaves the whole
/// card as a draft. Leaving with unsaved edits prompts to save or discard.
class PourEntryDetailPage extends StatefulWidget {
  final int index;
  final PourCardEntry entry;
  final bool isEditable;
  final bool isNew;
  final List<ConcreteGrade> concreteGrades;

  /// Sum of quantityM3 across all entries *before* this one — used to show
  /// a live "running total after this entry" preview without needing to
  /// see the rest of the card's state.
  final double precedingCumulativeQtyM3;

  const PourEntryDetailPage({
    super.key,
    required this.index,
    required this.entry,
    required this.isEditable,
    required this.precedingCumulativeQtyM3,
    this.isNew = false,
    this.concreteGrades = const [],
  });

  @override
  State<PourEntryDetailPage> createState() => _PourEntryDetailPageState();
}

enum _ExitAction { save, discard, cancel }

class _PourEntryDetailPageState extends State<PourEntryDetailPage> {
  late final TextEditingController _pourDateCtrl;
  late final TextEditingController _supplierNameCtrl;
  late final TextEditingController _supplierRepCtrl;
  late final TextEditingController _truckNoCtrl;
  late final TextEditingController _challanCtrl;
  late final TextEditingController _gradeCtrl;
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _batchStartCtrl;
  late final TextEditingController _arrivalCtrl;
  late final TextEditingController _finishingCtrl;
  late final TextEditingController _timeTakenCtrl;
  late final TextEditingController _slumpCtrl;
  late final TextEditingController _tempCtrl;
  late final TextEditingController _cubesCtrl;
  late final TextEditingController _contractorRepCtrl;
  late final TextEditingController _clientRepCtrl;
  late final TextEditingController _remarksCtrl;

  bool _dirty = false;
  bool _saving = false;
  bool _scanning = false;
  final _ocrService = BatchSlipOcrService();

  @override
  void initState() {
    super.initState();
    final e = widget.entry;
    _pourDateCtrl = TextEditingController(text: e.pourDate ?? '');
    _supplierNameCtrl = TextEditingController(text: e.supplierName ?? '');
    _supplierRepCtrl = TextEditingController(text: e.supplierRepresentative ?? '');
    _truckNoCtrl = TextEditingController(text: e.truckNo ?? '');
    _challanCtrl = TextEditingController(text: e.deliveryChallanNo ?? '');
    _gradeCtrl = TextEditingController(text: e.mixIdOrGrade ?? '');
    _qtyCtrl = TextEditingController(text: e.quantityM3?.toString() ?? '');
    _batchStartCtrl = TextEditingController(text: e.batchStartTime ?? '');
    _arrivalCtrl = TextEditingController(text: e.arrivalTimeAtSite ?? '');
    _finishingCtrl = TextEditingController(text: e.finishingTime ?? '');
    _timeTakenCtrl = TextEditingController(text: e.timeTakenMinutes?.toString() ?? '');
    _slumpCtrl = TextEditingController(text: e.slumpMm?.toString() ?? '');
    _tempCtrl = TextEditingController(text: e.concreteTemperature?.toString() ?? '');
    _cubesCtrl = TextEditingController(text: e.noOfCubesTaken?.toString() ?? '');
    _contractorRepCtrl = TextEditingController(text: e.contractorRepresentative ?? '');
    _clientRepCtrl = TextEditingController(text: e.clientRepresentative ?? '');
    _remarksCtrl = TextEditingController(text: e.remarks ?? '');
  }

  @override
  void dispose() {
    _pourDateCtrl.dispose();
    _supplierNameCtrl.dispose();
    _supplierRepCtrl.dispose();
    _truckNoCtrl.dispose();
    _challanCtrl.dispose();
    _gradeCtrl.dispose();
    _qtyCtrl.dispose();
    _batchStartCtrl.dispose();
    _arrivalCtrl.dispose();
    _finishingCtrl.dispose();
    _timeTakenCtrl.dispose();
    _slumpCtrl.dispose();
    _tempCtrl.dispose();
    _cubesCtrl.dispose();
    _contractorRepCtrl.dispose();
    _clientRepCtrl.dispose();
    _remarksCtrl.dispose();
    _ocrService.close();
    super.dispose();
  }

  void _markDirty() {
    if (!_dirty) setState(() => _dirty = true);
  }

  /// Captures a photo of the batching-plant slip, runs on-device OCR, and
  /// fills in whatever fields the regex parser can confidently pull out —
  /// only ever into controllers that are currently *empty*, so a scan can
  /// never clobber something the user already typed. Everything filled
  /// stays a normal editable text field; nothing here is final until Save.
  Future<void> _scanBatchSlip() async {
    final photo = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 90,
    );
    if (photo == null || !mounted) return;

    setState(() => _scanning = true);
    try {
      final text = await _ocrService.recognizeText(photo.path);
      final extraction = parseBatchSlipText(text);
      if (!mounted) return;

      if (extraction.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text("Couldn't read the slip clearly — please enter details manually."),
        ));
        return;
      }

      var filledCount = 0;
      void fill(TextEditingController ctrl, String? value) {
        if (value == null || ctrl.text.trim().isNotEmpty) return;
        ctrl.text = value;
        filledCount++;
      }

      fill(_truckNoCtrl, extraction.truckNo);
      fill(_challanCtrl, extraction.deliveryChallanNo);
      fill(_gradeCtrl, extraction.mixIdOrGrade);
      fill(_qtyCtrl, extraction.quantityM3?.toString());
      fill(_slumpCtrl, extraction.slumpMm?.toString());
      fill(_batchStartCtrl, extraction.batchStartTime);
      fill(_supplierNameCtrl, extraction.supplierName);

      if (filledCount > 0) {
        _dirty = true;
        setState(() {}); // refresh cumulative-quantity preview + dirty state
      }

      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(filledCount > 0
            ? 'Filled $filledCount field${filledCount == 1 ? '' : 's'} from the batch slip — please review.'
            : 'Read the slip, but every matched field was already filled in.'),
      ));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not scan the slip: $e'),
          backgroundColor: Colors.red.shade700,
        ));
      }
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  PourCardEntry _buildDraft() {
    double? d(String s) => s.trim().isEmpty ? null : double.tryParse(s.trim());
    int? i(String s) => s.trim().isEmpty ? null : int.tryParse(s.trim());
    String? s(String v) => v.trim().isEmpty ? null : v.trim();
    return widget.entry.copyWith(
      pourDate: s(_pourDateCtrl.text),
      supplierName: s(_supplierNameCtrl.text),
      supplierRepresentative: s(_supplierRepCtrl.text),
      truckNo: s(_truckNoCtrl.text),
      deliveryChallanNo: s(_challanCtrl.text),
      mixIdOrGrade: s(_gradeCtrl.text),
      quantityM3: d(_qtyCtrl.text),
      batchStartTime: s(_batchStartCtrl.text),
      arrivalTimeAtSite: s(_arrivalCtrl.text),
      finishingTime: s(_finishingCtrl.text),
      timeTakenMinutes: i(_timeTakenCtrl.text),
      slumpMm: d(_slumpCtrl.text),
      concreteTemperature: d(_tempCtrl.text),
      noOfCubesTaken: i(_cubesCtrl.text),
      contractorRepresentative: s(_contractorRepCtrl.text),
      clientRepresentative: s(_clientRepCtrl.text),
      remarks: s(_remarksCtrl.text),
    );
  }

  void _save() {
    setState(() => _saving = true);
    context.read<PourCardBloc>().add(SavePourEntry(widget.index, _buildDraft()));
    // Fire-and-forget from this page's perspective — PourCardPage's
    // BlocConsumer shows the saved/error snackbar once the bloc resolves it.
    Navigator.of(context).pop();
  }

  void _discard() {
    if (widget.isNew) {
      // A blank row was added to the card just to open this screen — back
      // it out entirely rather than leaving an empty entry behind.
      context.read<PourCardBloc>().add(RemovePourEntry(widget.index));
    }
    Navigator.of(context).pop();
  }

  Future<_ExitAction> _confirmExit() async {
    final action = await showDialog<_ExitAction>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Save changes?'),
        content: const Text('This pour entry has unsaved changes.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(_ExitAction.cancel),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(_ExitAction.discard),
            style: TextButton.styleFrom(foregroundColor: Colors.red.shade700),
            child: const Text('Discard'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(_ExitAction.save),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    return action ?? _ExitAction.cancel;
  }

  @override
  Widget build(BuildContext context) {
    final qty = double.tryParse(_qtyCtrl.text.trim()) ?? 0;
    final previewCumulative = widget.precedingCumulativeQtyM3 + qty;

    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final action = await _confirmExit();
        if (!mounted) return;
        if (action == _ExitAction.save) {
          _save();
        } else if (action == _ExitAction.discard) {
          _discard();
        }
        // Cancel: do nothing, stay on the page.
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text('Pour Entry #${widget.index + 1}'),
          actions: [
            if (widget.isEditable)
              TextButton.icon(
                onPressed: _saving ? null : _save,
                icon: const Icon(Icons.check, size: 18, color: Colors.white),
                label: const Text('Save', style: TextStyle(color: Colors.white)),
              ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (widget.isEditable) ...[
              OutlinedButton.icon(
                onPressed: _scanning ? null : _scanBatchSlip,
                icon: _scanning
                    ? const SizedBox(
                        width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.document_scanner_outlined, size: 18),
                label: Text(_scanning ? 'Reading slip…' : 'Scan Batch Slip'),
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
              ),
              const SizedBox(height: 4),
              Text(
                'Photograph the batching-plant slip to auto-fill truck no., quantity, grade and more. Always review before saving.',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontStyle: FontStyle.italic),
              ),
              const SizedBox(height: 12),
            ],
            _Section(
              title: 'Supplier & Delivery',
              children: [
                _DateField('Pour Date', _pourDateCtrl, widget.isEditable, _markDirty),
                _TextField('Supplier Name', _supplierNameCtrl, widget.isEditable, _markDirty),
                _TextField('Supplier Rep. (person)', _supplierRepCtrl, widget.isEditable, _markDirty),
                _TextField('Truck No.', _truckNoCtrl, widget.isEditable, _markDirty),
                _TextField('Delivery Challan No.', _challanCtrl, widget.isEditable, _markDirty),
                if (widget.concreteGrades.isNotEmpty)
                  _GradeDropdown(
                    currentValue: _gradeCtrl.text.isEmpty ? null : _gradeCtrl.text,
                    grades: widget.concreteGrades,
                    enabled: widget.isEditable,
                    onChanged: (v) {
                      _gradeCtrl.text = v ?? '';
                      _markDirty();
                    },
                  )
                else
                  _TextField('Mix ID / Grade', _gradeCtrl, widget.isEditable, _markDirty),
              ],
            ),
            const SizedBox(height: 12),
            _Section(
              title: 'Quantity & Timing',
              children: [
                _NumberField('Quantity (m³)', _qtyCtrl, widget.isEditable, () {
                  _markDirty();
                  setState(() {}); // refresh the cumulative preview below
                }),
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Running total after this entry: ${previewCumulative.toStringAsFixed(2)} m³',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontStyle: FontStyle.italic),
                  ),
                ),
                _TimeField('Batch Start Time (A)', _batchStartCtrl, widget.isEditable, _markDirty),
                _TimeField('Arrival Time at Site', _arrivalCtrl, widget.isEditable, _markDirty),
                _TimeField('Finishing Time (B)', _finishingCtrl, widget.isEditable, _markDirty),
                _NumberField('Time Taken, B-A (minutes)', _timeTakenCtrl, widget.isEditable, _markDirty),
              ],
            ),
            const SizedBox(height: 12),
            _Section(
              title: 'Quality Testing',
              children: [
                _NumberField('Slump (mm)', _slumpCtrl, widget.isEditable, _markDirty),
                _NumberField('Concrete Temp (°C)', _tempCtrl, widget.isEditable, _markDirty),
                _NumberField('No. of Cubes Taken', _cubesCtrl, widget.isEditable, _markDirty),
                if (widget.entry.cubeIds.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Wrap(
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
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.indigo.shade700)),
                            ))
                        .toList(),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            _Section(
              title: 'Representatives & Remarks',
              children: [
                _TextField('Contractor Representative', _contractorRepCtrl, widget.isEditable, _markDirty),
                _TextField('Client Representative', _clientRepCtrl, widget.isEditable, _markDirty),
                _TextField('Remarks', _remarksCtrl, widget.isEditable, _markDirty, maxLines: 3),
              ],
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _Section({required this.title, required this.children});

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
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            const Divider(height: 16),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _TextField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onChanged;
  final int maxLines;
  const _TextField(this.label, this.controller, this.enabled, this.onChanged, {this.maxLines = 1});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        enabled: enabled,
        maxLines: maxLines,
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

class _NumberField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onChanged;
  const _NumberField(this.label, this.controller, this.enabled, this.onChanged);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        enabled: enabled,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
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

class _DateField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onChanged;
  const _DateField(this.label, this.controller, this.enabled, this.onChanged);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        enabled: enabled,
        readOnly: true,
        onTap: enabled
            ? () => pickDateInto(context, controller, format: 'dd/MM/yyyy', onPicked: onChanged)
            : null,
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(fontSize: 12),
          border: const OutlineInputBorder(),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          isDense: true,
          suffixIcon: const Icon(Icons.calendar_today_outlined, size: 16),
        ),
      ),
    );
  }
}

class _TimeField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onChanged;
  const _TimeField(this.label, this.controller, this.enabled, this.onChanged);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        enabled: enabled,
        readOnly: true,
        onTap: enabled ? () => pickTimeInto(context, controller, onPicked: onChanged) : null,
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(fontSize: 12),
          border: const OutlineInputBorder(),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          isDense: true,
          suffixIcon: const Icon(Icons.access_time_outlined, size: 16),
        ),
      ),
    );
  }
}

class _GradeDropdown extends StatelessWidget {
  final String? currentValue;
  final List<ConcreteGrade> grades;
  final bool enabled;
  final ValueChanged<String?> onChanged;

  const _GradeDropdown({
    required this.currentValue,
    required this.grades,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final validValue = grades.any((g) => g.grade == currentValue) ? currentValue : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DropdownButtonFormField<String>(
        initialValue: validValue,
        isExpanded: true,
        isDense: true,
        hint: const Text('Select grade', style: TextStyle(fontSize: 12)),
        decoration: const InputDecoration(
          labelText: 'Mix ID / Grade',
          labelStyle: TextStyle(fontSize: 12),
          border: OutlineInputBorder(),
          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          isDense: true,
        ),
        items: grades
            .map((g) => DropdownMenuItem(value: g.grade, child: Text(g.grade, style: const TextStyle(fontSize: 12))))
            .toList(),
        onChanged: enabled ? onChanged : null,
      ),
    );
  }
}
