import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/planning/data/models/micro_schedule_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/micro_schedule_bloc.dart';

class DailyLogSheet extends StatefulWidget {
  final MicroActivity activity;

  const DailyLogSheet({super.key, required this.activity});

  static Future<void> show(BuildContext context, {required MicroActivity activity}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => BlocProvider.value(
        value: context.read<MicroScheduleBloc>(),
        child: DailyLogSheet(activity: activity),
      ),
    );
  }

  @override
  State<DailyLogSheet> createState() => _DailyLogSheetState();
}

class _DailyLogSheetState extends State<DailyLogSheet> {
  final _formKey = GlobalKey<FormState>();
  final _qtyCtrl = TextEditingController();
  final _manpowerCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();
  DateTime _date = DateTime.now();
  bool _submitting = false;

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _manpowerCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    final data = {
      'microActivityId': widget.activity.id,
      'logDate': _date.toIso8601String().split('T').first,
      'qtyDone': double.tryParse(_qtyCtrl.text.trim()) ?? 0,
      if (_manpowerCtrl.text.trim().isNotEmpty)
        'manpowerCount': int.tryParse(_manpowerCtrl.text.trim()),
      if (_remarksCtrl.text.trim().isNotEmpty)
        'remarks': _remarksCtrl.text.trim(),
    };
    if (mounted) {
      context.read<MicroScheduleBloc>().add(SubmitDailyLog(data));
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(2)),
            )),
            const SizedBox(height: 16),
            const Row(children: [
              Icon(Icons.event_note_outlined, color: Colors.teal),
              SizedBox(width: 8),
              Text('Add Daily Log', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ]),
            const SizedBox(height: 4),
            Text(widget.activity.name, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 16),
            // Date
            InkWell(
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime.now().subtract(const Duration(days: 30)),
                  lastDate: DateTime.now(),
                );
                if (d != null) setState(() => _date = d);
              },
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Log Date',
                  border: OutlineInputBorder(),
                  isDense: true,
                  suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
                ),
                child: Text('${_date.day.toString().padLeft(2,'0')}/${_date.month.toString().padLeft(2,'0')}/${_date.year}'),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _qtyCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: 'Quantity Done *${widget.activity.unit != null ? " (${widget.activity.unit})" : ""}',
                border: const OutlineInputBorder(),
                isDense: true,
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Quantity is required';
                if (double.tryParse(v.trim()) == null) return 'Enter a valid number';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _manpowerCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Manpower Count (optional)',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _remarksCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Remarks / Delay Reason (optional)',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 20),
            Row(children: [
              OutlinedButton(
                onPressed: _submitting ? null : () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.save_outlined, size: 16),
                label: const Text('Save Log'),
                style: FilledButton.styleFrom(backgroundColor: Colors.teal.shade700),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}
