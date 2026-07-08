import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/planning/data/models/micro_schedule_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/micro_schedule_bloc.dart';
import 'package:setu_mobile/features/planning/presentation/widgets/daily_log_sheet.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:intl/intl.dart';

class MicroSchedulePage extends StatefulWidget {
  final Project project;
  const MicroSchedulePage({super.key, required this.project});

  @override
  State<MicroSchedulePage> createState() => _MicroSchedulePageState();
}

class _MicroSchedulePageState extends State<MicroSchedulePage> {
  @override
  void initState() {
    super.initState();
    context.read<MicroScheduleBloc>().add(LoadMicroSchedules(widget.project.id));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Look-Ahead / Micro Schedule', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text(widget.project.name, style: const TextStyle(fontSize: 12)),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<MicroScheduleBloc>().add(LoadMicroSchedules(widget.project.id)),
          ),
        ],
      ),
      body: BlocConsumer<MicroScheduleBloc, MicroScheduleState>(
        listener: (ctx, state) {
          if (state is MicroScheduleActionSuccess) {
            ScaffoldMessenger.of(ctx).showSnackBar(
                SnackBar(content: Text(state.message), backgroundColor: Colors.green.shade700));
          }
          if (state is MicroScheduleError) {
            ScaffoldMessenger.of(ctx).showSnackBar(
                SnackBar(content: Text(state.message), backgroundColor: Colors.red.shade700));
          }
        },
        builder: (ctx, state) {
          if (state is MicroScheduleLoading) return const Center(child: CircularProgressIndicator());

          if (state is MicroScheduleError) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(state.message),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.read<MicroScheduleBloc>().add(LoadMicroSchedules(widget.project.id)),
                child: const Text('Retry'),
              ),
            ]));
          }

          if (state is MicroSchedulesLoaded) {
            if (state.schedules.isEmpty) {
              return const Center(child: Padding(
                padding: EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.calendar_view_week_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 12),
                  Text('No look-ahead schedules found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  SizedBox(height: 8),
                  Text('Micro schedules are created from the web app and will appear here.', textAlign: TextAlign.center),
                ]),
              ));
            }
            return RefreshIndicator(
              onRefresh: () async => context.read<MicroScheduleBloc>().add(LoadMicroSchedules(widget.project.id)),
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: state.schedules.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) => _ScheduleCard(
                  schedule: state.schedules[i],
                  onTap: () => context.read<MicroScheduleBloc>()
                      .add(LoadMicroActivities(state.schedules[i].id)),
                ),
              ),
            );
          }

          if (state is MicroActivitiesLoaded) {
            return _ActivitiesView(
              schedule: state.schedule,
              activities: state.activities,
              onBack: () => context.read<MicroScheduleBloc>()
                  .add(LoadMicroSchedules(widget.project.id)),
              onSelectActivity: (a) => context.read<MicroScheduleBloc>().add(LoadActivityLogs(a.id)),
            );
          }

          if (state is ActivityLogsLoaded) {
            return _LogsView(
              activity: state.activity,
              logs: state.logs,
              onBack: () => context.read<MicroScheduleBloc>()
                  .add(LoadMicroActivities(state.activity.microScheduleId)),
              onAddLog: () async {
                await DailyLogSheet.show(ctx, activity: state.activity);
              },
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  final MicroSchedule schedule;
  final VoidCallback onTap;
  const _ScheduleCard({required this.schedule, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: schedule.status.color.withValues(alpha: 0.35)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(schedule.name,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: schedule.status.color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(schedule.status.label,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: schedule.status.color)),
              ),
            ]),
            const SizedBox(height: 8),
            LinearProgressIndicator(value: schedule.progress, minHeight: 6, borderRadius: BorderRadius.circular(3)),
            const SizedBox(height: 6),
            Row(children: [
              Text('${(schedule.progress * 100).toStringAsFixed(1)}% complete',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              const Spacer(),
              if (schedule.plannedFinish != null)
                Text('Finish: ${schedule.plannedFinish}',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _ActivitiesView extends StatelessWidget {
  final MicroSchedule schedule;
  final List<MicroActivity> activities;
  final VoidCallback onBack;
  final void Function(MicroActivity) onSelectActivity;

  const _ActivitiesView({
    required this.schedule, required this.activities,
    required this.onBack, required this.onSelectActivity,
  });

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        child: ListTile(
          leading: const BackButton(),
          title: Text(schedule.name, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text('${activities.length} activities'),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: schedule.status.color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(schedule.status.label,
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: schedule.status.color)),
          ),
        ),
      ),
      Expanded(
        child: activities.isEmpty
            ? const Center(child: Text('No activities in this schedule'))
            : ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: activities.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _ActivityCard(activity: activities[i], onTap: () => onSelectActivity(activities[i])),
              ),
      ),
    ]);
  }
}

class _ActivityCard extends StatelessWidget {
  final MicroActivity activity;
  final VoidCallback onTap;
  const _ActivityCard({required this.activity, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final pct = (activity.progress * 100).toStringAsFixed(1);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: Theme.of(context).dividerColor)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(activity.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
              Text('$pct%', style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w700,
                  color: activity.progress >= 1 ? Colors.green.shade700 : Colors.blue.shade700)),
            ]),
            const SizedBox(height: 6),
            LinearProgressIndicator(value: activity.progress, minHeight: 4,
              backgroundColor: Colors.grey.shade200,
              color: activity.progress >= 1 ? Colors.green.shade600 : Colors.blue.shade600),
            const SizedBox(height: 4),
            Text('${activity.actualQty} / ${activity.allocatedQty} ${activity.unit ?? ""}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ]),
        ),
      ),
    );
  }
}

class _LogsView extends StatelessWidget {
  final MicroActivity activity;
  final List<MicroDailyLog> logs;
  final VoidCallback onBack;
  final VoidCallback onAddLog;

  const _LogsView({required this.activity, required this.logs, required this.onBack, required this.onAddLog});

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd/MM/yyyy');
    return Column(children: [
      Container(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        child: ListTile(
          leading: const BackButton(),
          title: Text(activity.name, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text('${logs.length} log entries'),
        ),
      ),
      Padding(
        padding: const EdgeInsets.all(12),
        child: FilledButton.icon(
          onPressed: onAddLog,
          icon: const Icon(Icons.add, size: 16),
          label: const Text("Add Today's Log"),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(40)),
        ),
      ),
      Expanded(
        child: logs.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.event_note_outlined, size: 48, color: Colors.grey.shade400),
                const SizedBox(height: 8),
                const Text('No log entries yet'),
              ]))
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                itemCount: logs.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final log = logs[i];
                  DateTime? dt;
                  try { dt = DateTime.parse(log.logDate); } catch (_) {}
                  return Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: BorderSide(color: Theme.of(context).dividerColor),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Icon(Icons.calendar_today_outlined, size: 13, color: Colors.blue.shade700),
                          const SizedBox(width: 6),
                          Text(dt != null ? fmt.format(dt) : log.logDate,
                              style: TextStyle(fontWeight: FontWeight.w700, color: Colors.blue.shade700)),
                          const Spacer(),
                          Text('${log.qtyDone} ${activity.unit ?? ""}',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        ]),
                        if (log.manpowerCount != null) ...[
                          const SizedBox(height: 4),
                          Text('Manpower: ${log.manpowerCount}',
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                        ],
                        if (log.delayReason?.isNotEmpty ?? false) ...[
                          const SizedBox(height: 4),
                          Row(children: [
                            Icon(Icons.warning_amber_outlined, size: 13, color: Colors.orange.shade700),
                            const SizedBox(width: 4),
                            Text('Delay: ${log.delayReason}',
                                style: TextStyle(fontSize: 11, color: Colors.orange.shade700)),
                          ]),
                        ],
                        if (log.remarks?.isNotEmpty ?? false) ...[
                          const SizedBox(height: 4),
                          Text(log.remarks!, style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
                        ],
                      ]),
                    ),
                  );
                },
              ),
      ),
    ]);
  }
}
