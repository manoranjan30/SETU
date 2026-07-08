import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/planning/data/models/phase2_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/planning_phase2_bloc.dart';
import 'package:setu_mobile/features/planning/presentation/widgets/assignee_picker.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

class CreateTaskSheet extends StatefulWidget {
  final Project project;
  const CreateTaskSheet({super.key, required this.project});

  static Future<void> show(BuildContext context, {required Project project}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => BlocProvider.value(
        value: context.read<PlanningPhase2Bloc>(),
        child: CreateTaskSheet(project: project),
      ),
    );
  }

  @override
  State<CreateTaskSheet> createState() => _CreateTaskSheetState();
}

class _CreateTaskSheetState extends State<CreateTaskSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  TaskPriority _priority = TaskPriority.medium;
  TaskStatus _status = TaskStatus.todo;
  String _taskType = 'GENERAL';
  DateTime? _dueDate;
  AssigneeOption? _assignee;
  bool _submitting = false;
  final List<Map<String, dynamic>> _checklistItems = [];
  final _checklistCtrl = TextEditingController();

  @override
  void dispose() { _titleCtrl.dispose(); _descCtrl.dispose(); _checklistCtrl.dispose(); super.dispose(); }

  void _addChecklistItem() {
    final text = _checklistCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() { _checklistItems.add({'text': text, 'done': false}); _checklistCtrl.clear(); });
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    final data = {
      'title': _titleCtrl.text.trim(),
      'description': _descCtrl.text.trim().isNotEmpty ? _descCtrl.text.trim() : null,
      'taskType': _taskType,
      'priority': _priority.apiValue,
      'status': _status.apiValue,
      if (_dueDate != null) 'dueDate': _dueDate!.toIso8601String().split('T').first,
      if (_assignee != null) ..._assignee!.toPayload(),
      'tags': [],
      'attachments': [],
      if (_checklistItems.isNotEmpty) 'checklistItems': _checklistItems,
    };
    if (mounted) {
      context.read<PlanningPhase2Bloc>().add(CreateTask(widget.project.id, data));
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
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 40, height: 4,
                decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            const Text('New Task', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Task Title *', border: OutlineInputBorder(), isDense: true),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descCtrl, maxLines: 2,
              decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder(), isDense: true),
            ),
            const SizedBox(height: 12),
            // Task type
            DropdownButtonFormField<String>(
              initialValue: _taskType,
              decoration: const InputDecoration(labelText: 'Task Type', border: OutlineInputBorder(), isDense: true),
              items: ['GENERAL', 'SCHEDULE', 'QUALITY', 'SAFETY', 'MATERIAL', 'DOCUMENT']
                  .map((t) => DropdownMenuItem(value: t, child: Text(t, style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (v) { if (v != null) setState(() => _taskType = v); },
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Priority', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                DropdownButtonFormField<TaskPriority>(
                  initialValue: _priority,
                  decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                  items: TaskPriority.values.map((p) => DropdownMenuItem(value: p, child: Text(p.label, style: TextStyle(color: p.color, fontWeight: FontWeight.w600, fontSize: 13)))).toList(),
                  onChanged: (v) { if (v != null) setState(() => _priority = v); },
                ),
              ])),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Status', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                DropdownButtonFormField<TaskStatus>(
                  initialValue: _status,
                  decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                  items: TaskStatus.values.map((s) => DropdownMenuItem(value: s, child: Text(s.label, style: const TextStyle(fontSize: 13)))).toList(),
                  onChanged: (v) { if (v != null) setState(() => _status = v); },
                ),
              ])),
            ]),
            const SizedBox(height: 12),
            // Assignee picker — covers internal + vendor users with display labels
            AssigneePicker(
              projectId: widget.project.id,
              selected: _assignee,
              onChanged: (v) => setState(() => _assignee = v),
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: () async {
                final d = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 3)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                if (d != null) setState(() => _dueDate = d);
              },
              child: InputDecorator(
                decoration: const InputDecoration(labelText: 'Due Date', border: OutlineInputBorder(), isDense: true, suffixIcon: Icon(Icons.calendar_today_outlined, size: 18)),
                child: Text(_dueDate == null ? 'Optional'
                    : '${_dueDate!.day.toString().padLeft(2,'0')}/${_dueDate!.month.toString().padLeft(2,'0')}/${_dueDate!.year}',
                    style: TextStyle(color: _dueDate == null ? Colors.grey.shade500 : null, fontSize: 13)),
              ),
            ),
            const SizedBox(height: 12),
            // Checklist items
            const Text('Checklist (optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            ...(_checklistItems.map((item) => ListTile(
              dense: true, contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.check_box_outline_blank, size: 18),
              title: Text(item['text'] as String, style: const TextStyle(fontSize: 12)),
              trailing: IconButton(
                icon: const Icon(Icons.close, size: 16), padding: EdgeInsets.zero,
                onPressed: () => setState(() => _checklistItems.remove(item)),
              ),
            ))),
            Row(children: [
              Expanded(child: TextFormField(
                controller: _checklistCtrl,
                decoration: const InputDecoration(hintText: 'Add checklist item…', isDense: true, border: OutlineInputBorder()),
                onFieldSubmitted: (_) => _addChecklistItem(),
              )),
              const SizedBox(width: 8),
              IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: _addChecklistItem),
            ]),
            const SizedBox(height: 20),
            Row(children: [
              OutlinedButton(onPressed: _submitting ? null : () => Navigator.of(context).pop(), child: const Text('Cancel')),
              const Spacer(),
              FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.add_task, size: 16),
                label: const Text('Create Task'),
                style: FilledButton.styleFrom(backgroundColor: Colors.indigo.shade700),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}
