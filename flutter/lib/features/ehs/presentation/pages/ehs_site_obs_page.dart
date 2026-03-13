import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_site_obs_detail_page.dart';
import 'package:setu_mobile/shared/widgets/obs_status_badge.dart';
import 'package:setu_mobile/shared/widgets/raise_site_obs_sheet.dart';
import 'package:setu_mobile/shared/widgets/severity_badge.dart';

/// EHS Site Observations — filterable list with permission-gated create.
class EhsSiteObsPage extends StatefulWidget {
  final int projectId;
  final String projectName;

  const EhsSiteObsPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  State<EhsSiteObsPage> createState() => _EhsSiteObsPageState();
}

class _EhsSiteObsPageState extends State<EhsSiteObsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  static const _tabs = ['All', 'Open', 'Rectified', 'Closed'];
  static const _tabFilters = [null, 'OPEN', 'RECTIFIED', 'CLOSED'];

  String? get _activeFilter => _tabFilters[_tabCtrl.index];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) _load();
    });
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  void _load() {
    context.read<EhsSiteObsBloc>().add(LoadEhsSiteObs(
          projectId: widget.projectId,
          statusFilter: _activeFilter,
        ));
  }

  void _refresh() {
    context.read<EhsSiteObsBloc>().add(RefreshEhsSiteObs(
          projectId: widget.projectId,
          statusFilter: _activeFilter,
        ));
  }

  Future<void> _raiseObservation() async {
    final ps = PermissionService.of(context);
    if (!ps.canCreateEhsObs) return;

    await RaiseSiteObsSheet.show(
      context,
      title: 'Raise EHS Observation',
      categories: EhsCategory.allLabels,
      showLocationField: true,
      onSubmit: ({
        required description,
        required severity,
        category,
        locationLabel,
        photoUrls = const [],
      }) async {
        context.read<EhsSiteObsBloc>().add(CreateEhsSiteObs(
              projectId: widget.projectId,
              description: description,
              severity: severity,
              category: category,
              locationLabel: locationLabel,
              photoUrls: photoUrls,
            ));
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('EHS Observations',
                style:
                    TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.projectName,
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.normal),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ],
        ),
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _refresh,
          ),
        ],
      ),
      floatingActionButton: ps.canCreateEhsObs
          ? FloatingActionButton.extended(
              onPressed: _raiseObservation,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Raise'),
              backgroundColor: const Color(0xFFD97706),
            )
          : null,
      body: BlocConsumer<EhsSiteObsBloc, EhsSiteObsState>(
        listener: (context, state) {
          if (state is EhsSiteObsActionSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(_successMessage(state.action)),
                backgroundColor: Colors.green,
              ),
            );
            _load();
          } else if (state is EhsSiteObsActionError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Theme.of(context).colorScheme.error,
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is EhsSiteObsLoading && !state.isRefresh) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is EhsSiteObsError) {
            return _ErrorView(message: state.message, onRetry: _load);
          }
          final obs = state is EhsSiteObsLoaded
              ? state.observations
              : <EhsSiteObservation>[];

          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: obs.isEmpty
                ? _EmptyView(
                    filter: _activeFilter,
                    canCreate: ps.canCreateEhsObs,
                    onRaise: _raiseObservation,
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
                    itemCount: obs.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: 8),
                    itemBuilder: (_, i) => _EhsObsCard(
                      obs: obs[i],
                      onTap: () => _openDetail(obs[i]),
                    ),
                  ),
          );
        },
      ),
    );
  }

  void _openDetail(EhsSiteObservation obs) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<EhsSiteObsBloc>(),
          child: EhsSiteObsDetailPage(
            obs: obs,
            projectId: widget.projectId,
          ),
        ),
      ),
    ).then((_) => _load());
  }

  String _successMessage(String action) {
    switch (action) {
      case 'created':
        return 'EHS observation raised';
      case 'rectified':
        return 'Marked as rectified';
      case 'closed':
        return 'Observation closed';
      case 'deleted':
        return 'Observation deleted';
      default:
        return 'Done';
    }
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

class _EhsObsCard extends StatelessWidget {
  final EhsSiteObservation obs;
  final VoidCallback onTap;

  const _EhsObsCard({required this.obs, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final severityColor = SeverityBadge.colorFor(obs.severity);
    final catEnum = obs.categoryEnum;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: obs.isOpen
              ? severityColor.withValues(alpha: 0.5)
              : theme.dividerColor,
          width: obs.isOpen ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ObsStatusBadge(status: obs.status.label),
                  const SizedBox(width: 6),
                  SeverityBadge(severity: obs.severity),
                  const SizedBox(width: 6),
                  // Category icon chip
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD97706).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color:
                              const Color(0xFFD97706).withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(catEnum.icon,
                            size: 11, color: const Color(0xFFD97706)),
                        const SizedBox(width: 3),
                        Text(catEnum.label,
                            style: const TextStyle(
                                fontSize: 10,
                                color: Color(0xFFD97706),
                                fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                  const Spacer(),
                  if (obs.photoUrls.isNotEmpty)
                    Row(
                      children: [
                        Icon(Icons.photo_outlined,
                            size: 13,
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.4)),
                        const SizedBox(width: 2),
                        Text('${obs.photoUrls.length}',
                            style: TextStyle(
                                fontSize: 11,
                                color: theme.colorScheme.onSurface
                                    .withValues(alpha: 0.4))),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                obs.description,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w500),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  if (obs.locationLabel != null) ...[
                    Icon(Icons.location_on_outlined,
                        size: 12,
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.5)),
                    const SizedBox(width: 2),
                    Flexible(
                      child: Text(
                        obs.locationLabel!,
                        style: TextStyle(
                            fontSize: 11,
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.6)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  const Spacer(),
                  Text(
                    _fmtDate(obs.createdAt),
                    style: TextStyle(
                        fontSize: 11,
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.5)),
                  ),
                ],
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

// ─── Empty / Error ────────────────────────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  final String? filter;
  final bool canCreate;
  final VoidCallback onRaise;

  const _EmptyView({
    this.filter,
    required this.canCreate,
    required this.onRaise,
  });

  @override
  Widget build(BuildContext context) {
    final label = filter == null
        ? 'No EHS observations yet'
        : 'No ${filter!.toLowerCase()} observations';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.health_and_safety_outlined,
                size: 56,
                color: const Color(0xFFD97706).withValues(alpha: 0.25)),
            const SizedBox(height: 16),
            Text(label,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.5))),
            if (canCreate && filter == null) ...[
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: onRaise,
                icon: const Icon(Icons.add_rounded, size: 16),
                label: const Text('Raise First Observation'),
                style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded,
                size: 48,
                color: Theme.of(context)
                    .colorScheme
                    .error
                    .withValues(alpha: 0.6)),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.6))),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
