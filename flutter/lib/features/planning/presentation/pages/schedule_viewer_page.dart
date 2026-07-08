import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/planning/data/models/planning_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/schedule_viewer_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

class ScheduleViewerPage extends StatefulWidget {
  final Project project;
  const ScheduleViewerPage({super.key, required this.project});

  @override
  State<ScheduleViewerPage> createState() => _ScheduleViewerPageState();
}

class _ScheduleViewerPageState extends State<ScheduleViewerPage> {
  @override
  void initState() {
    super.initState();
    context.read<ScheduleViewerBloc>().add(LoadScheduleVersions(widget.project.id));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Schedule Viewer', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text(widget.project.name, style: const TextStyle(fontSize: 12)),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<ScheduleViewerBloc>().add(LoadScheduleVersions(widget.project.id)),
          ),
        ],
      ),
      body: BlocBuilder<ScheduleViewerBloc, ScheduleViewerState>(
        builder: (context, state) {
          if (state is ScheduleViewerLoading) return const Center(child: CircularProgressIndicator());
          if (state is ScheduleViewerError) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(state.message),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.read<ScheduleViewerBloc>().add(LoadScheduleVersions(widget.project.id)),
                child: const Text('Retry'),
              ),
            ]));
          }
          if (state is ScheduleVersionsLoaded) {
            if (state.versions.isEmpty) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.calendar_month_outlined, size: 64, color: Colors.grey),
                    SizedBox(height: 12),
                    Text('No schedule versions found',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    SizedBox(height: 8),
                    Text(
                      'Create a schedule version in the web app under:\n'
                      'Planning → Schedule → New Version\n\n'
                      'If you already have a schedule imported, ensure at least\n'
                      'one version (Baseline, Revised, or Working) is created.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                  ]),
                ),
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: state.versions.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _VersionCard(
                version: state.versions[i],
                onTap: () => context.read<ScheduleViewerBloc>()
                    .add(LoadVersionActivities(state.versions[i].id)),
              ),
            );
          }
          if (state is ScheduleActivitiesLoaded) {
            return _ActivitiesView(state: state);
          }
          return const Center(child: CircularProgressIndicator());
        },
      ),
    );
  }
}

class _VersionCard extends StatelessWidget {
  final ScheduleVersion version;
  final VoidCallback onTap;
  const _VersionCard({required this.version, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: version.versionType.color.withValues(alpha: 0.35)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: version.versionType.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(version.versionType.label,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: version.versionType.color)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(version.versionCode, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              if (version.createdAt != null)
                Text(version.createdAt!.split('T').first,
                    style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5))),
            ])),
            if (version.isActive)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.green.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text('Active', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.green.shade800)),
              ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right),
          ]),
        ),
      ),
    );
  }
}

class _ActivitiesView extends StatefulWidget {
  final ScheduleActivitiesLoaded state;
  const _ActivitiesView({required this.state});

  @override
  State<_ActivitiesView> createState() => _ActivitiesViewState();
}

class _ActivitiesViewState extends State<_ActivitiesView> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final v = widget.state.version;
    return Column(children: [
      // Version header
      Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        child: Row(children: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.read<ScheduleViewerBloc>()
                .add(LoadScheduleVersions(widget.state.version.projectId)),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: v.versionType.color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(v.versionType.label,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: v.versionType.color)),
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(v.versionCode, style: const TextStyle(fontWeight: FontWeight.w600))),
          Text('${widget.state.activities.length} activities',
              style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5))),
        ]),
      ),
      // Search
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        child: TextField(
          controller: _searchCtrl,
          decoration: const InputDecoration(
            hintText: 'Search activities…',
            prefixIcon: Icon(Icons.search, size: 18),
            isDense: true,
            border: OutlineInputBorder(),
            contentPadding: EdgeInsets.symmetric(vertical: 8),
          ),
          onSubmitted: (q) => context.read<ScheduleViewerBloc>()
              .add(LoadVersionActivities(v.id, searchQuery: q.isEmpty ? null : q)),
        ),
      ),
      // Activity list
      Expanded(
        child: widget.state.activities.isEmpty
            ? const Center(child: Text('No activities found'))
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                itemCount: widget.state.activities.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) => _ActivityRow(activity: widget.state.activities[i]),
              ),
      ),
    ]);
  }
}

class _ActivityRow extends StatelessWidget {
  final ScheduleActivity activity;
  const _ActivityRow({required this.activity});

  @override
  Widget build(BuildContext context) {
    final pct = (activity.percentComplete * 100).toStringAsFixed(0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          if (activity.isCritical)
            Container(
              margin: const EdgeInsets.only(right: 6),
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(4)),
              child: Text('Critical', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.red.shade800)),
            ),
          if (activity.activityCode != null)
            Text('${activity.activityCode}  ',
                style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5))),
          Expanded(child: Text(activity.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
          Text('$pct%', style: TextStyle(
            fontSize: 12, fontWeight: FontWeight.w700,
            color: activity.percentComplete >= 1 ? Colors.green.shade700 : Colors.blue.shade700,
          )),
        ]),
        const SizedBox(height: 4),
        LinearProgressIndicator(
          value: activity.percentComplete,
          minHeight: 4,
          backgroundColor: Colors.grey.shade200,
          color: activity.percentComplete >= 1 ? Colors.green.shade600 : Colors.blue.shade600,
        ),
        const SizedBox(height: 4),
        Row(children: [
          if (activity.startDate != null)
            Text('Start: ${activity.startDate}',
                style: TextStyle(fontSize: 10, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55))),
          if (activity.finishDate != null) ...[
            const Spacer(),
            Text('Finish: ${activity.finishDate}',
                style: TextStyle(fontSize: 10, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55))),
          ],
        ]),
      ]),
    );
  }
}
