import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/planning/data/models/phase2_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/planning_phase2_bloc.dart';
import 'package:setu_mobile/features/planning/presentation/widgets/create_task_sheet.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

class TaskManagerPage extends StatefulWidget {
  final Project project;
  const TaskManagerPage({super.key, required this.project});

  @override
  State<TaskManagerPage> createState() => _TaskManagerPageState();
}

class _TaskManagerPageState extends State<TaskManagerPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;
  static const _tabs = ['ALL', 'MY', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
  static const _labels = ['All', 'Mine', 'To Do', 'In Progress', 'Blocked', 'Done'];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: _tabs.length, vsync: this);
    _tab.addListener(() {
      if (!_tab.indexIsChanging) _reload();
    });
    context.read<PlanningPhase2Bloc>().add(LoadTasks(widget.project.id));
  }

  void _reload() {
    final idx = _tab.index;
    if (_tabs[idx] == 'MY') {
      context.read<PlanningPhase2Bloc>().add(LoadTasks(widget.project.id, myTasksOnly: true));
    } else {
      context.read<PlanningPhase2Bloc>().add(LoadTasks(widget.project.id,
          statusFilter: ['ALL', 'MY'].contains(_tabs[idx]) ? null : _tabs[idx]));
    }
  }

  @override
  void dispose() { _tab.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Task Manager', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text(widget.project.name, style: const TextStyle(fontSize: 12)),
        ]),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _reload)],
        bottom: TabBar(
          controller: _tab,
          tabs: _labels.map((l) => Tab(text: l)).toList(),
          isScrollable: true,
          tabAlignment: TabAlignment.start,
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
          if (state is Phase2Error) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12), Text(state.message),
            const SizedBox(height: 16), ElevatedButton(onPressed: _reload, child: const Text('Retry')),
          ]));
          if (state is! TasksLoaded) return const SizedBox.shrink();
          final tasks = state.tasks;
          if (tasks.isEmpty) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.task_outlined, size: 64, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            const Text('No tasks found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ]));
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: tasks.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) => _TaskCard(
                task: tasks[i],
                onStatusChange: (s) => context.read<PlanningPhase2Bloc>()
                    .add(UpdateTaskStatus(widget.project.id, tasks[i].id, s)),
                onDelete: ps.canDeleteTask ? () => context.read<PlanningPhase2Bloc>()
                    .add(DeleteTask(widget.project.id, tasks[i].id)) : null,
              ),
            ),
          );
        },
      ),
      floatingActionButton: ps.canCreateTask ? FloatingActionButton.extended(
        onPressed: () async {
          await CreateTaskSheet.show(context, project: widget.project);
          _reload();
        },
        icon: const Icon(Icons.add),
        label: const Text('New Task'),
        backgroundColor: Colors.indigo.shade700,
      ) : null,
    );
  }
}

class _TaskCard extends StatelessWidget {
  final ProjectTask task;
  final void Function(String status) onStatusChange;
  final VoidCallback? onDelete;
  const _TaskCard({required this.task, required this.onStatusChange, this.onDelete});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: task.isOverdue ? Colors.red.shade300 : theme.dividerColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: task.priority.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(task.priority.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: task.priority.color)),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: task.status.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(task.status.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: task.status.color)),
            ),
            if (task.isOverdue) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(4)),
                child: Text('Overdue', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.red.shade700)),
              ),
            ],
            const Spacer(),
            if (onDelete != null)
              IconButton(
                icon: Icon(Icons.delete_outline, size: 18, color: Colors.red.shade400),
                onPressed: onDelete, padding: EdgeInsets.zero, constraints: const BoxConstraints(),
              ),
          ]),
          const SizedBox(height: 8),
          Text(task.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          if (task.description?.isNotEmpty ?? false) ...[
            const SizedBox(height: 4),
            Text(task.description!, style: TextStyle(fontSize: 12, color: Colors.grey.shade700), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 8),
          Row(children: [
            if (task.assignedToLabel != null) ...[
              Icon(Icons.person_outline, size: 13, color: Colors.grey.shade600),
              const SizedBox(width: 4),
              Text(task.assignedToLabel!, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
            ],
            if (task.dueDate != null) ...[
              const Spacer(),
              Icon(Icons.event_outlined, size: 13, color: task.isOverdue ? Colors.red.shade700 : Colors.grey.shade600),
              const SizedBox(width: 4),
              Text('Due ${task.dueDate}', style: TextStyle(fontSize: 11, color: task.isOverdue ? Colors.red.shade700 : Colors.grey.shade600)),
            ],
          ]),
          const SizedBox(height: 8),
          // Quick status update
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: TaskStatus.values.map((s) {
              final isActive = task.status == s;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: GestureDetector(
                  onTap: isActive ? null : () => onStatusChange(s.apiValue),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isActive ? s.color : Colors.transparent,
                      border: Border.all(color: isActive ? s.color : Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(s.label, style: TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w600,
                      color: isActive ? Colors.white : Colors.grey.shade600,
                    )),
                  ),
                ),
              );
            }).toList()),
          ),
        ]),
      ),
    );
  }
}
