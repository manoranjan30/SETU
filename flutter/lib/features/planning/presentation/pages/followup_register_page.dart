import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/planning/data/models/phase2_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/planning_phase2_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/injection_container.dart';

class FollowupRegisterPage extends StatefulWidget {
  final Project project;
  const FollowupRegisterPage({super.key, required this.project});

  @override
  State<FollowupRegisterPage> createState() => _FollowupRegisterPageState();
}

class _FollowupRegisterPageState extends State<FollowupRegisterPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
    _tab.addListener(() {
      if (!_tab.indexIsChanging) {
        if (_tab.index == 0) {
          context.read<PlanningPhase2Bloc>().add(LoadFollowups(widget.project.id));
        } else if (_tab.index == 1) {
          context.read<PlanningPhase2Bloc>().add(LoadFollowups(widget.project.id, myOnly: true));
        } else {
          context.read<PlanningPhase2Bloc>().add(LoadFollowups(widget.project.id));
        }
      }
    });
    context.read<PlanningPhase2Bloc>().add(LoadFollowups(widget.project.id));
  }

  @override
  void dispose() { _tab.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Follow-up Register', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text(widget.project.name, style: const TextStyle(fontSize: 12)),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.refresh),
              onPressed: () => context.read<PlanningPhase2Bloc>().add(LoadFollowups(widget.project.id))),
        ],
        bottom: TabBar(
          controller: _tab,
          tabs: const [Tab(text: 'All'), Tab(text: 'Mine'), Tab(text: 'Overdue')],
        ),
      ),
      body: BlocConsumer<PlanningPhase2Bloc, Phase2State>(
        listener: (ctx, state) {
          if (state is Phase2ActionSuccess) {
            ScaffoldMessenger.of(ctx).showSnackBar(
                SnackBar(content: Text(state.message), backgroundColor: Colors.green.shade700));
          }
          if (state is Phase2Error) {
            ScaffoldMessenger.of(ctx).showSnackBar(
                SnackBar(content: Text(state.message), backgroundColor: Colors.red.shade700));
          }
        },
        builder: (ctx, state) {
          if (state is Phase2Loading) return const Center(child: CircularProgressIndicator());
          if (state is! FollowupsLoaded) return const SizedBox.shrink();

          final all = state.followups;
          final overdue = all.where((f) => f.isOverdue && f.status != FollowupStatus.closed).toList();
          final mine = state.myOnly ? all : all;

          List<FollowUpAction> currentList;
          if (_tab.index == 1) {
            currentList = mine;
          } else if (_tab.index == 2) {
            currentList = overdue;
          } else {
            currentList = all;
          }

          if (currentList.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.assignment_late_outlined, size: 64, color: Colors.grey.shade300),
              const SizedBox(height: 12),
              const Text('No follow-ups found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ]));
          }
          return RefreshIndicator(
            onRefresh: () async => context.read<PlanningPhase2Bloc>().add(LoadFollowups(widget.project.id)),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: currentList.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final f = currentList[i];
                final pid = widget.project.id;
                return _FollowupCard(
                  followup: f,
                  canUpdate: ps.canUpdateFollowup,
                  canDelete: ps.canDeleteFollowup,
                  onClose: ps.canUpdateFollowup && f.status != FollowupStatus.closed
                      ? (remarks) => context.read<PlanningPhase2Bloc>().add(CloseFollowup(pid, f.id, remarks: remarks)) : null,
                  onReopen: ps.canUpdateFollowup && f.status == FollowupStatus.closed
                      ? () => context.read<PlanningPhase2Bloc>().add(ReopenFollowup(pid, f.id)) : null,
                  onSnooze: ps.canUpdateFollowup && f.status != FollowupStatus.closed
                      ? () => _showSnoozeDialog(context, pid, f.id) : null,
                  onConvertToTask: ps.canUpdateFollowup && f.status != FollowupStatus.closed
                      ? () => context.read<PlanningPhase2Bloc>().add(ConvertFollowupToTask(pid, f.id)) : null,
                  onDelete: ps.canDeleteFollowup
                      ? () => context.read<PlanningPhase2Bloc>().add(DeleteFollowup(pid, f.id)) : null,
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: ps.canCreateFollowup ? FloatingActionButton.extended(
        onPressed: () => _showCreateSheet(context),
        icon: const Icon(Icons.add),
        label: const Text('New Follow-up'),
        backgroundColor: Colors.deepOrange.shade700,
      ) : null,
    );
  }

  void _showSnoozeDialog(BuildContext context, int projectId, int followupId) {
    DateTime? newDueDate;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Snooze Follow-up'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Select new due date:'),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () async {
                final d = await showDatePicker(
                  context: ctx,
                  initialDate: DateTime.now().add(const Duration(days: 2)),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 90)),
                );
                if (d != null) setDialogState(() => newDueDate = d);
              },
              icon: const Icon(Icons.calendar_today_outlined, size: 16),
              label: Text(newDueDate == null
                  ? 'Pick date'
                  : '${newDueDate!.day.toString().padLeft(2,'0')}/${newDueDate!.month.toString().padLeft(2,'0')}/${newDueDate!.year}'),
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: newDueDate == null ? null : () {
                Navigator.pop(ctx);
                // Remind at 9am on the new due date
                final reminderAt = DateTime(newDueDate!.year, newDueDate!.month, newDueDate!.day, 9)
                    .toIso8601String();
                context.read<PlanningPhase2Bloc>().add(SnoozeFollowup(
                  projectId, followupId,
                  dueDate: newDueDate!.toIso8601String().split('T').first,
                  reminderAt: reminderAt,
                ));
              },
              child: const Text('Snooze'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCreateSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => BlocProvider.value(
        value: context.read<PlanningPhase2Bloc>(),
        child: _CreateFollowupSheet(project: widget.project),
      ),
    );
  }
}

class _FollowupCard extends StatelessWidget {
  final FollowUpAction followup;
  final bool canUpdate;
  final bool canDelete;
  final void Function(String? remarks)? onClose;
  final VoidCallback? onDelete;
  final VoidCallback? onReopen;
  final VoidCallback? onSnooze;
  final VoidCallback? onConvertToTask;
  const _FollowupCard({
    required this.followup, required this.canUpdate, required this.canDelete,
    this.onClose, this.onDelete, this.onReopen, this.onSnooze, this.onConvertToTask,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isClosed = followup.status == FollowupStatus.closed;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: followup.status.color.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(color: followup.status.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
              child: Text(followup.status.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: followup.status.color)),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(4)),
              child: Text(followup.priority, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
            ),
            if (followup.meetingReference != null) ...[
              const SizedBox(width: 8),
              Expanded(child: Text(followup.meetingReference!, style: TextStyle(fontSize: 10, color: Colors.grey.shade500), overflow: TextOverflow.ellipsis)),
            ],
            if (onDelete != null)
              IconButton(icon: Icon(Icons.delete_outline, size: 18, color: Colors.red.shade400), onPressed: onDelete, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
          ]),
          const SizedBox(height: 8),
          Text(followup.actionItem, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 6),
          Row(children: [
            if (followup.assignedToLabel != null) ...[
              Icon(Icons.person_outline, size: 13, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
              const SizedBox(width: 4),
              Text(followup.assignedToLabel!, style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.6))),
            ],
            const Spacer(),
            Icon(Icons.event_outlined, size: 13, color: followup.isOverdue ? Colors.red.shade700 : Colors.grey.shade600),
            const SizedBox(width: 4),
            Text('Due ${followup.dueDate}', style: TextStyle(fontSize: 11, color: followup.isOverdue ? Colors.red.shade700 : Colors.grey.shade600)),
          ]),
          if (!isClosed) ...[
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 6, children: [
              if (onClose != null)
                OutlinedButton.icon(
                  onPressed: () => _showCloseDialog(context),
                  icon: const Icon(Icons.check_circle_outline, size: 14),
                  label: const Text('Close'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.green.shade700,
                    side: BorderSide(color: Colors.green.shade300),
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                ),
              if (onSnooze != null)
                OutlinedButton.icon(
                  onPressed: onSnooze,
                  icon: const Icon(Icons.snooze_outlined, size: 14),
                  label: const Text('Snooze'),
                  style: OutlinedButton.styleFrom(textStyle: const TextStyle(fontSize: 12)),
                ),
              if (onConvertToTask != null)
                OutlinedButton.icon(
                  onPressed: onConvertToTask,
                  icon: const Icon(Icons.task_alt_outlined, size: 14),
                  label: const Text('→ Task'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.indigo.shade700,
                    side: BorderSide(color: Colors.indigo.shade300),
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                ),
            ]),
          ],
          if (isClosed && onReopen != null) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: onReopen,
              icon: const Icon(Icons.restart_alt, size: 14),
              label: const Text('Reopen'),
              style: OutlinedButton.styleFrom(textStyle: const TextStyle(fontSize: 12)),
            ),
          ],
        ]),
      ),
    );
  }

  void _showCloseDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Close Follow-up'),
        content: TextField(
          controller: ctrl, maxLines: 3,
          decoration: const InputDecoration(hintText: 'Closing remarks (optional)', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () { Navigator.pop(ctx); onClose?.call(ctrl.text.trim().isNotEmpty ? ctrl.text.trim() : null); },
            style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}

class _CreateFollowupSheet extends StatefulWidget {
  final Project project;
  const _CreateFollowupSheet({required this.project});
  @override State<_CreateFollowupSheet> createState() => _CreateFollowupSheetState();
}

class _CreateFollowupSheetState extends State<_CreateFollowupSheet> {
  final _formKey = GlobalKey<FormState>();
  final _actionCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();
  final _meetingCtrl = TextEditingController();
  String _priority = 'MEDIUM';
  DateTime? _dueDate;
  int? _assignedToUserId;
  bool _submitting = false;
  bool _loadingUsers = false;
  List<Map<String, dynamic>> _users = [];

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    setState(() => _loadingUsers = true);
    try {
      final raw = await sl<SetuApiClient>().getIssueEligibleUsers(widget.project.id);
      if (mounted) setState(() { _users = raw.cast<Map<String, dynamic>>(); _loadingUsers = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingUsers = false);
    }
  }

  @override
  void dispose() { _actionCtrl.dispose(); _remarksCtrl.dispose(); _meetingCtrl.dispose(); super.dispose(); }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_dueDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a due date')));
      return;
    }
    if (_assignedToUserId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please assign to someone')));
      return;
    }
    setState(() => _submitting = true);
    final data = {
      'actionItem': _actionCtrl.text.trim(),
      'assignedToUserId': _assignedToUserId,
      'dueDate': _dueDate!.toIso8601String().split('T').first,
      'priority': _priority,
      if (_remarksCtrl.text.trim().isNotEmpty) 'remarks': _remarksCtrl.text.trim(),
      if (_meetingCtrl.text.trim().isNotEmpty) 'meetingReference': _meetingCtrl.text.trim(),
    };
    if (mounted) {
      context.read<PlanningPhase2Bloc>().add(CreateFollowup(widget.project.id, data));
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final priorities = ['LOW', 'MEDIUM', 'HIGH'];
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 40, height: 4,
                decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            const Text('New Follow-up Action', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextFormField(
              controller: _actionCtrl, maxLines: 2,
              decoration: const InputDecoration(labelText: 'Action Item *', border: OutlineInputBorder(), isDense: true),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            if (!_loadingUsers && _users.isNotEmpty)
              DropdownButtonFormField<int>(
                initialValue: _assignedToUserId,
                decoration: const InputDecoration(labelText: 'Assigned To *', border: OutlineInputBorder(), isDense: true),
                items: _users.map((u) => DropdownMenuItem(
                  value: u['id'] as int?,
                  child: Text(u['displayName'] as String? ?? u['username'] as String? ?? '', style: const TextStyle(fontSize: 13)),
                )).toList(),
                onChanged: (v) => setState(() => _assignedToUserId = v),
                validator: (v) => v == null ? 'Please assign to someone' : null,
              ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Priority', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                DropdownButtonFormField<String>(
                  initialValue: _priority,
                  decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                  items: priorities.map((p) => DropdownMenuItem(value: p, child: Text(p, style: const TextStyle(fontSize: 13)))).toList(),
                  onChanged: (v) { if (v != null) setState(() => _priority = v); },
                ),
              ])),
              const SizedBox(width: 12),
              Expanded(child: InkWell(
                onTap: () async {
                  final d = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 7)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                  if (d != null) setState(() => _dueDate = d);
                },
                child: InputDecorator(
                  decoration: const InputDecoration(labelText: 'Due Date *', border: OutlineInputBorder(), isDense: true, suffixIcon: Icon(Icons.calendar_today_outlined, size: 18)),
                  child: Text(
                    _dueDate == null ? 'Select' : '${_dueDate!.day.toString().padLeft(2,'0')}/${_dueDate!.month.toString().padLeft(2,'0')}/${_dueDate!.year}',
                    style: TextStyle(color: _dueDate == null ? Colors.grey.shade500 : null, fontSize: 13),
                  ),
                ),
              )),
            ]),
            const SizedBox(height: 12),
            TextFormField(
              controller: _meetingCtrl,
              decoration: const InputDecoration(labelText: 'Meeting Reference (optional)', border: OutlineInputBorder(), isDense: true),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _remarksCtrl, maxLines: 2,
              decoration: const InputDecoration(labelText: 'Remarks (optional)', border: OutlineInputBorder(), isDense: true),
            ),
            const SizedBox(height: 20),
            Row(children: [
              OutlinedButton(onPressed: _submitting ? null : () => Navigator.of(context).pop(), child: const Text('Cancel')),
              const Spacer(),
              FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.assignment_add, size: 16),
                label: const Text('Create'),
                style: FilledButton.styleFrom(backgroundColor: Colors.deepOrange.shade700),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}
