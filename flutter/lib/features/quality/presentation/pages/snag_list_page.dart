import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/snag_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/snag_detail_page.dart';

class SnagListPage extends StatelessWidget {
  final int projectId;
  final String projectName;

  const SnagListPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => SnagBloc(apiClient: sl<SetuApiClient>())
        ..add(LoadSnags(projectId)),
      child: _SnagListView(projectId: projectId, projectName: projectName),
    );
  }
}

class _SnagListView extends StatefulWidget {
  final int projectId;
  final String projectName;

  const _SnagListView({required this.projectId, required this.projectName});

  @override
  State<_SnagListView> createState() => _SnagListViewState();
}

class _SnagListViewState extends State<_SnagListView>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  List<QualitySnag> _lastSnags = [];

  // Tabs: All, Open, Rectified, Verified
  static const _tabs = [null, SnagStatus.open, SnagStatus.rectified, SnagStatus.verified];
  static const _tabLabels = ['All', 'Open', 'Rectified', 'Verified'];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) {
        context.read<SnagBloc>().add(FilterSnags(_tabs[_tabCtrl.index]));
      }
    });
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Snag List', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            Text(widget.projectName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => context.read<SnagBloc>().add(LoadSnags(widget.projectId)),
          ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          tabs: _tabLabels.map((l) => Tab(text: l)).toList(),
        ),
      ),
      body: BlocConsumer<SnagBloc, SnagState>(
        listener: (context, state) {
          if (state is SnagError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red.shade700,
            ));
          }
          if (state is SnagActionSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.green.shade700,
            ));
            // Keep current filter after action
            final filter = _tabs[_tabCtrl.index];
            context.read<SnagBloc>().add(FilterSnags(filter));
          }
        },
        builder: (context, state) {
          List<QualitySnag> snags;
          final isLoading = state is SnagLoading;

          if (state is SnagLoaded) {
            _lastSnags = state.filteredSnags;
            snags = state.filteredSnags;
          } else if (state is SnagActionSuccess) {
            final filter = _tabs[_tabCtrl.index];
            snags = filter == null
                ? state.snags
                : state.snags.where((s) => s.status == filter).toList();
            _lastSnags = snags;
          } else {
            snags = _lastSnags;
          }

          if (isLoading && _lastSnags.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          return Stack(
            children: [
              TabBarView(
                controller: _tabCtrl,
                children: _tabs.map((filter) {
                  final filtered = filter == null
                      ? (state is SnagLoaded ? state.allSnags : _lastSnags)
                      : (state is SnagLoaded
                          ? state.allSnags.where((s) => s.status == filter).toList()
                          : _lastSnags.where((s) => s.status == filter).toList());

                  if (filtered.isEmpty) {
                    return _EmptyTab(
                      filter: filter,
                      onRefresh: () => context.read<SnagBloc>().add(LoadSnags(widget.projectId)),
                    );
                  }
                  return RefreshIndicator(
                    onRefresh: () async => context.read<SnagBloc>().add(LoadSnags(widget.projectId)),
                    child: ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: filtered.length,
                      itemBuilder: (context, i) => _SnagCard(
                        snag: filtered[i],
                        onTap: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => SnagDetailPage(snag: filtered[i]),
                            ),
                          );
                          if (context.mounted) {
                            context.read<SnagBloc>().add(LoadSnags(widget.projectId));
                          }
                        },
                      ),
                    ),
                  );
                }).toList(),
              ),
              if (isLoading)
                const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator()),
            ],
          );
        },
      ),
      floatingActionButton: ps.canCreateQualityObs
          ? FloatingActionButton.extended(
              onPressed: () => _showCreateDialog(context),
              icon: const Icon(Icons.add),
              label: const Text('New Snag'),
            )
          : null,
    );
  }

  void _showCreateDialog(BuildContext context) {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final locationCtrl = TextEditingController();
    String priority = 'MEDIUM';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('New Snag', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextField(
                controller: titleCtrl,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Title *',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: descCtrl,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: locationCtrl,
                decoration: const InputDecoration(
                  labelText: 'Location',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: priority,
                decoration: const InputDecoration(
                  labelText: 'Priority',
                  border: OutlineInputBorder(),
                ),
                items: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (v) => setModalState(() => priority = v ?? 'MEDIUM'),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () {
                      if (titleCtrl.text.trim().isEmpty) return;
                      context.read<SnagBloc>().add(CreateSnag(
                        projectId: widget.projectId,
                        title: titleCtrl.text.trim(),
                        description: descCtrl.text.trim().isEmpty ? null : descCtrl.text.trim(),
                        location: locationCtrl.text.trim().isEmpty ? null : locationCtrl.text.trim(),
                        priority: priority,
                      ));
                      Navigator.pop(ctx);
                    },
                    child: const Text('Create'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyTab extends StatelessWidget {
  final SnagStatus? filter;
  final VoidCallback onRefresh;

  const _EmptyTab({this.filter, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final msg = filter == null
        ? 'No snags recorded for this project'
        : 'No ${filter!.label.toLowerCase()} snags';
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle_outline, size: 48, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          Text(msg, style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh'),
          ),
        ],
      ),
    );
  }
}

class _SnagCard extends StatelessWidget {
  final QualitySnag snag;
  final VoidCallback onTap;

  const _SnagCard({required this.snag, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Priority indicator bar
              Container(
                width: 4,
                height: 52,
                decoration: BoxDecoration(
                  color: snag.priorityColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            snag.title,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        _StatusChip(status: snag.status),
                      ],
                    ),
                    if (snag.location != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.location_on_outlined, size: 12, color: Colors.grey.shade500),
                          const SizedBox(width: 2),
                          Text(snag.location!, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                        ],
                      ),
                    ],
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _PriorityChip(priority: snag.priority, color: snag.priorityColor),
                        const Spacer(),
                        Text(
                          _fmtDate(snag.createdAt),
                          style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmtDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
}

class _StatusChip extends StatelessWidget {
  final SnagStatus status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: status.color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: status.color,
        ),
      ),
    );
  }
}

class _PriorityChip extends StatelessWidget {
  final String priority;
  final Color color;
  const _PriorityChip({required this.priority, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Text(
        priority,
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
