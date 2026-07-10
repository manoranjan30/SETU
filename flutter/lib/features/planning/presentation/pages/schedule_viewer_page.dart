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
          if (state is ScheduleBaseActivitiesLoaded) {
            return _BaseActivitiesView(state: state, projectId: widget.project.id);
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

// ── Base (unversioned) schedule view ─────────────────────────────────────────

/// Shown when a project has no schedule versions yet.
/// Displays execution-ready activities grouped by EPS location (floor/tower).
class _BaseActivitiesView extends StatefulWidget {
  final ScheduleBaseActivitiesLoaded state;
  final int projectId;
  const _BaseActivitiesView({required this.state, required this.projectId});

  @override
  State<_BaseActivitiesView> createState() => _BaseActivitiesViewState();
}

class _BaseActivitiesViewState extends State<_BaseActivitiesView> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  final Set<int> _expandedGroups = {};

  // group key → [activities]  (built once from state)
  late final Map<int?, List<ScheduleActivity>> _groups;
  // sorted group keys for display (natural floor order)
  late final List<int?> _sortedKeys;

  @override
  void initState() {
    super.initState();
    _buildGroups();
  }

  void _buildGroups() {
    final map = <int?, List<ScheduleActivity>>{};
    for (final a in widget.state.activities) {
      map.putIfAbsent(a.epsNodeId, () => []).add(a);
    }
    _groups = map;
    // Sort by natural floor order; null (unlocalised) goes last
    _sortedKeys = map.keys.toList()..sort((a, b) {
      if (a == null) return 1;
      if (b == null) return -1;
      final nameA = widget.state.epsNodeNames[a] ?? '';
      final nameB = widget.state.epsNodeNames[b] ?? '';
      return _floorSortKey(nameA).compareTo(_floorSortKey(nameB));
    });
    // Auto-expand first group
    if (_sortedKeys.isNotEmpty && _sortedKeys.first != null) {
      _expandedGroups.add(_sortedKeys.first!);
    }
  }

  static int _floorSortKey(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('basement') || lower == 'b') return -2;
    if (lower.contains('ground') || lower == 'gf' || lower == 'g/f') return -1;
    if (lower.contains('stilt') || lower.contains('podium')) return 0;
    final m = RegExp(r'^(\d+)').firstMatch(name);
    if (m != null) return int.parse(m.group(1)!);
    if (lower.contains('terrace') || lower.contains('roof')) return 9999;
    return 5000;
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  List<ScheduleActivity> get _filtered {
    final q = _query.toLowerCase();
    return widget.state.activities.where((a) =>
        a.name.toLowerCase().contains(q) ||
        (a.activityCode?.toLowerCase().contains(q) ?? false)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isSearching = _query.isNotEmpty;
    return Column(children: [
      // Header banner
      Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        child: Row(children: [
          const Icon(Icons.account_tree_outlined, size: 16, color: Colors.teal),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Base Schedule (WBS Activities)',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            Text('No version created — showing execution-ready activities',
                style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
          ])),
          Text('${widget.state.activities.length}',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
        ]),
      ),
      // Search
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        child: TextField(
          controller: _searchCtrl,
          decoration: InputDecoration(
            hintText: 'Search activities…',
            prefixIcon: const Icon(Icons.search, size: 18),
            isDense: true,
            border: const OutlineInputBorder(),
            contentPadding: const EdgeInsets.symmetric(vertical: 8),
            suffixIcon: _query.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 16),
                    onPressed: () { _searchCtrl.clear(); setState(() => _query = ''); })
                : null,
          ),
          onChanged: (v) => setState(() => _query = v),
        ),
      ),
      const Divider(height: 1),
      Expanded(
        child: isSearching
            ? _buildFlatList(_filtered)
            : _buildGroupedList(),
      ),
    ]);
  }

  Widget _buildFlatList(List<ScheduleActivity> items) {
    if (items.isEmpty) {
      return Center(child: Text('No matches for "$_query"',
          style: const TextStyle(color: Colors.grey)));
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
      itemCount: items.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, i) => _ActivityRow(activity: items[i]),
    );
  }

  Widget _buildGroupedList() {
    if (widget.state.activities.isEmpty) {
      return const Center(child: Text('No activities found'));
    }
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 16),
      itemCount: _sortedKeys.length,
      itemBuilder: (_, i) {
        final key = _sortedKeys[i];
        final groupName = key != null
            ? (widget.state.epsNodeNames[key] ?? 'Location $key')
            : 'Other Activities';
        final items = _groups[key]!;
        final isExpanded = key != null
            ? _expandedGroups.contains(key)
            : _expandedGroups.contains(-1);
        final color = key != null ? Colors.teal.shade700 : Colors.grey.shade600;
        return Column(children: [
          // Group header
          InkWell(
            onTap: () => setState(() {
              final k = key ?? -1;
              if (_expandedGroups.contains(k)) _expandedGroups.remove(k);
              else _expandedGroups.add(k);
            }),
            child: Container(
              color: color.withValues(alpha: 0.07),
              padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
              child: Row(children: [
                Icon(key != null ? Icons.location_on_outlined : Icons.help_outline,
                    size: 14, color: color),
                const SizedBox(width: 7),
                Expanded(child: Text(groupName,
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text('${items.length}',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
                ),
                const SizedBox(width: 6),
                Icon(isExpanded ? Icons.expand_less : Icons.expand_more, size: 18, color: color),
              ]),
            ),
          ),
          if (isExpanded)
            ...items.map((a) => Padding(
              padding: const EdgeInsets.only(left: 14),
              child: Column(children: [
                _ActivityRow(activity: a),
                const Divider(height: 1),
              ]),
            )),
        ]);
      },
    );
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
