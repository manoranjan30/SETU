import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/planning/data/models/planning_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/issue_tracker_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/injection_container.dart';

class RaiseIssueSheet extends StatefulWidget {
  final Project project;

  const RaiseIssueSheet({super.key, required this.project});

  static Future<void> show(BuildContext context, {required Project project}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => BlocProvider.value(
        value: context.read<IssueTrackerBloc>(),
        child: RaiseIssueSheet(project: project),
      ),
    );
  }

  @override
  State<RaiseIssueSheet> createState() => _RaiseIssueSheetState();
}

class _RaiseIssueSheetState extends State<RaiseIssueSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  IssuePriority _priority = IssuePriority.medium;
  DateTime? _requiredDate;
  bool _submitting = false;

  // Tags (required — backend enforces at least one)
  List<IssueTag> _availableTags = [];
  Set<int> _selectedTagIds = {};
  bool _loadingTags = true;

  // Optional: custom department flow
  List<IssueTrackerDepartment> _departments = [];
  List<int> _selectedDeptIds = [];

  @override
  void initState() {
    super.initState();
    _loadMeta();
  }

  Future<void> _loadMeta() async {
    try {
      final results = await Future.wait([
        sl<SetuApiClient>().getIssueTags(widget.project.id),
        sl<SetuApiClient>().getIssueDepartments(widget.project.id),
      ]);
      if (mounted) {
        setState(() {
          _availableTags = (results[0]).map((e) => IssueTag.fromJson(e as Map<String, dynamic>)).toList();
          _departments = (results[1]).map((e) => IssueTrackerDepartment.fromJson(e as Map<String, dynamic>)).toList();
          _loadingTags = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingTags = false);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_selectedTagIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one tag'), backgroundColor: Colors.orange));
      return;
    }
    setState(() => _submitting = true);
    final data = {
      'title': _titleCtrl.text.trim(),
      'description': _descCtrl.text.trim().isNotEmpty ? _descCtrl.text.trim() : '',
      'priority': _priority.apiValue,
      'tagIds': _selectedTagIds.toList(),
      if (_requiredDate != null)
        'requiredDate': _requiredDate!.toIso8601String().split('T').first,
      if (_selectedDeptIds.isNotEmpty)
        'customFlowDepartmentIds': _selectedDeptIds,
    };
    if (mounted) {
      context.read<IssueTrackerBloc>().add(CreateIssue(widget.project.id, data));
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(2)),
              )),
              const SizedBox(height: 16),
              const Text('Raise Issue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextFormField(
                controller: _titleCtrl,
                decoration: const InputDecoration(labelText: 'Issue Title *', border: OutlineInputBorder(), isDense: true),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descCtrl,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder(), isDense: true),
              ),
              const SizedBox(height: 12),
              const Text('Priority', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                children: IssuePriority.values.map((p) => ChoiceChip(
                  label: Text(p.label),
                  selected: _priority == p,
                  selectedColor: p.color.withValues(alpha: 0.2),
                  labelStyle: TextStyle(color: _priority == p ? p.color : null, fontWeight: _priority == p ? FontWeight.w700 : null),
                  onSelected: (_) => setState(() => _priority = p),
                )).toList(),
              ),
              const SizedBox(height: 12),
              // Tags — required
              Row(children: [
                const Text('Tags *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(width: 6),
                if (_loadingTags)
                  const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                else if (_availableTags.isEmpty)
                  Text('No tags configured — add tags from the web app', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ]),
              const SizedBox(height: 6),
              if (!_loadingTags && _availableTags.isNotEmpty)
                Wrap(
                  spacing: 8, runSpacing: 4,
                  children: _availableTags.map((t) {
                    final selected = _selectedTagIds.contains(t.id);
                    return FilterChip(
                      label: Text(t.name, style: TextStyle(fontSize: 12, color: selected ? Colors.indigo.shade700 : null)),
                      selected: selected,
                      selectedColor: Colors.indigo.shade50,
                      checkmarkColor: Colors.indigo.shade700,
                      onSelected: (v) => setState(() => v ? _selectedTagIds.add(t.id) : _selectedTagIds.remove(t.id)),
                    );
                  }).toList(),
                ),
              const SizedBox(height: 12),
              // Optional dept flow override
              if (_departments.isNotEmpty) ...[
                const Text('Routing (optional)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text('Leave empty to use default department flow', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8, runSpacing: 4,
                  children: _departments.map((d) {
                    final selected = _selectedDeptIds.contains(int.tryParse(d.id) ?? 0);
                    return FilterChip(
                      label: Text(d.name, style: const TextStyle(fontSize: 12)),
                      selected: selected,
                      onSelected: (v) => setState(() {
                        final id = int.tryParse(d.id) ?? 0;
                        v ? _selectedDeptIds.add(id) : _selectedDeptIds.remove(id);
                      }),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
              ],
              InkWell(
                onTap: () async {
                  final d = await showDatePicker(
                    context: context,
                    initialDate: DateTime.now().add(const Duration(days: 7)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (d != null) setState(() => _requiredDate = d);
                },
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Required By (optional)',
                    border: OutlineInputBorder(), isDense: true,
                    suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
                  ),
                  child: Text(
                    _requiredDate == null ? 'Select date'
                        : '${_requiredDate!.day.toString().padLeft(2,'0')}/${_requiredDate!.month.toString().padLeft(2,'0')}/${_requiredDate!.year}',
                    style: TextStyle(color: _requiredDate == null ? Colors.grey.shade500 : null),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Row(children: [
                OutlinedButton(onPressed: _submitting ? null : () => Navigator.of(context).pop(), child: const Text('Cancel')),
                const Spacer(),
                FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.bug_report_outlined, size: 16),
                  label: const Text('Raise Issue'),
                  style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}
