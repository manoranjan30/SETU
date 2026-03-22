import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/navigation/app_routes.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_site_obs_detail_page.dart';
import 'package:setu_mobile/shared/widgets/advanced_filter_sheet.dart';
import 'package:setu_mobile/shared/widgets/filter_chip_bar.dart';
import 'package:setu_mobile/shared/widgets/obs_status_badge.dart';
import 'package:setu_mobile/shared/widgets/raise_site_obs_sheet.dart';
import 'package:setu_mobile/shared/widgets/severity_badge.dart';
import 'package:setu_mobile/shared/widgets/shimmer_list.dart';

/// Quality Site Observations — status tabs + severity filter chips + swipe actions.
class QualitySiteObsPage extends StatefulWidget {
  final int projectId;
  final String projectName;

  const QualitySiteObsPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  State<QualitySiteObsPage> createState() => _QualitySiteObsPageState();
}

class _QualitySiteObsPageState extends State<QualitySiteObsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  late final ScrollController _scrollCtrl;
  static const _tabs = ['All', 'Open', 'Rectified', 'Closed'];
  static const _tabFilters = [null, 'OPEN', 'RECTIFIED', 'CLOSED'];

  ObsFilterOptions _filterOptions = const ObsFilterOptions();

  static const _severityOptions = ['ALL', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];

  String? get _activeStatusFilter {
    if (_filterOptions.statusFilter != null) return _filterOptions.statusFilter;
    return _tabFilters[_tabCtrl.index];
  }

  String? get _activeSeverityFilter => _filterOptions.severityFilter;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
    _scrollCtrl = ScrollController()..addListener(_onScroll);
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) {
        setState(() {
          _filterOptions = ObsFilterOptions(
            severityFilter: _filterOptions.severityFilter,
            sortOrder: _filterOptions.sortOrder,
          );
        });
        _load();
      }
    });
    _load();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      context.read<QualitySiteObsBloc>().add(const LoadMoreQualitySiteObs());
    }
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _load() {
    context.read<QualitySiteObsBloc>().add(LoadQualitySiteObs(
          projectId: widget.projectId,
          statusFilter: _activeStatusFilter,
          severityFilter: _activeSeverityFilter,
        ));
  }

  void _refresh() {
    context.read<QualitySiteObsBloc>().add(RefreshQualitySiteObs(
          projectId: widget.projectId,
          statusFilter: _activeStatusFilter,
          severityFilter: _activeSeverityFilter,
        ));
  }

  Future<void> _raiseObservation() async {
    final ps = PermissionService.of(context);
    if (!ps.canCreateQualityObs) return;

    await RaiseSiteObsSheet.show(
      context,
      title: 'Raise Quality Observation',
      projectId: widget.projectId,
      categories: const [
        'Workmanship',
        'Material',
        'Safety',
        'Structural',
        'Finishing',
        'Other',
      ],
      onSubmit: ({
        required description,
        required severity,
        category,
        epsNodeId,
        locationLabel,
        photoUrls = const [],
      }) async {
        context.read<QualitySiteObsBloc>().add(CreateQualitySiteObs(
              projectId: widget.projectId,
              description: description,
              severity: severity,
              category: category,
              epsNodeId: epsNodeId,
              locationLabel: locationLabel,
              photoUrls: photoUrls,
            ));
      },
    );
  }

  Future<void> _openAdvancedFilter() async {
    final result = await AdvancedFilterSheet.show(
      context,
      initial: _filterOptions,
    );
    if (result != null && mounted) {
      setState(() => _filterOptions = result);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    final activeFilters = _filterOptions.activeCount;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Site Observations',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
          Stack(
            alignment: Alignment.topRight,
            children: [
              IconButton(
                icon: const Icon(Icons.tune_rounded),
                tooltip: 'Advanced filter',
                onPressed: _openAdvancedFilter,
              ),
              if (activeFilters > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    width: 16,
                    height: 16,
                    decoration: const BoxDecoration(
                      color: Color(0xFF2563EB),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        '$activeFilters',
                        style: const TextStyle(
                            fontSize: 10,
                            color: Colors.white,
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _refresh,
          ),
        ],
      ),
      floatingActionButton: ps.canCreateQualityObs
          ? FloatingActionButton.extended(
              onPressed: _raiseObservation,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Raise'),
            )
          : null,
      body: Column(
        children: [
          // Severity filter chip bar
          Container(
            color: Theme.of(context).colorScheme.surface,
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: FilterChipBar(
              options: _severityOptions,
              selected: _activeSeverityFilter ?? 'ALL',
              onSelected: (val) {
                setState(() {
                  _filterOptions = _filterOptions.copyWith(
                    severityFilter: val == 'ALL' ? null : val,
                  );
                });
                _load();
              },
              colorFor: SeverityBadge.colorFor,
            ),
          ),
          Expanded(
            child: BlocConsumer<QualitySiteObsBloc, QualitySiteObsState>(
              listener: (context, state) {
                if (state is QualitySiteObsActionSuccess) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(_successMessage(state.action)),
                      backgroundColor: Colors.green,
                    ),
                  );
                  _load();
                } else if (state is QualitySiteObsActionError) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(state.message),
                      backgroundColor: Theme.of(context).colorScheme.error,
                    ),
                  );
                }
              },
              builder: (context, state) {
                if (state is QualitySiteObsLoading && !state.isRefresh) {
                  return const ShimmerList(itemCount: 6);
                }
                if (state is QualitySiteObsError) {
                  return _ErrorView(message: state.message, onRetry: _load);
                }
                final loadedState =
                    state is QualitySiteObsLoaded ? state : null;
                final obs =
                    loadedState?.observations ?? <QualitySiteObservation>[];
                final fromCache = loadedState?.fromCache ?? false;

                final isLoadingMore = loadedState?.isLoadingMore ?? false;
                final hasMore = loadedState?.hasMore ?? false;

                return Column(
                  children: [
                    if (fromCache)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        color: Colors.orange.shade50,
                        child: Row(
                          children: [
                            Icon(Icons.cloud_off_rounded,
                                size: 14,
                                color: Colors.orange.shade700),
                            const SizedBox(width: 6),
                            Text(
                              'Showing cached data — pull to refresh',
                              style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.orange.shade700),
                            ),
                          ],
                        ),
                      ),
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: () async => _refresh(),
                        child: obs.isEmpty
                            ? _EmptyView(
                                filter: _activeStatusFilter,
                                severity: _activeSeverityFilter,
                                canCreate: ps.canCreateQualityObs,
                                onRaise: _raiseObservation,
                                onClear: _filterOptions.isDefault
                                    ? null
                                    : () {
                                        setState(() => _filterOptions =
                                            const ObsFilterOptions());
                                        _load();
                                      },
                              )
                            : ListView.separated(
                                controller: _scrollCtrl,
                                padding: const EdgeInsets.fromLTRB(
                                    12, 8, 12, 96),
                                itemCount: obs.length + (hasMore ? 1 : 0),
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (_, i) {
                                  if (i == obs.length) {
                                    return Padding(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 16),
                                      child: Center(
                                        child: isLoadingMore
                                            ? const SizedBox(
                                                width: 24,
                                                height: 24,
                                                child:
                                                    CircularProgressIndicator(
                                                        strokeWidth: 2),
                                              )
                                            : const SizedBox.shrink(),
                                      ),
                                    );
                                  }
                                  return RepaintBoundary(
                                    child: _SwipeableQualityCard(
                                      obs: obs[i],
                                      ps: ps,
                                      onTap: () => _openDetail(obs[i]),
                                      onDelete: ps.canDeleteQualityObs
                                          ? () => _confirmDelete(
                                              context, obs[i])
                                          : null,
                                      onClose: ps.canCloseQualityObs &&
                                              (obs[i].isRectified ||
                                                  (obs[i].isOpen &&
                                                      obs[i].severity ==
                                                          'INFO'))
                                          ? () => _quickClose(
                                              context, obs[i].id)
                                          : null,
                                    ),
                                  );
                                },
                              ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _openDetail(QualitySiteObservation obs) {
    Navigator.push(
      context,
      SlideUpRoute(
        child: BlocProvider.value(
          value: context.read<QualitySiteObsBloc>(),
          child: QualitySiteObsDetailPage(
            obs: obs,
            projectId: widget.projectId,
          ),
        ),
      ),
    ).then((_) => _load());
  }

  void _quickClose(BuildContext context, String id) {
    context.read<QualitySiteObsBloc>().add(CloseQualitySiteObs(id: id));
  }

  void _confirmDelete(BuildContext context, QualitySiteObservation obs) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Observation'),
        content: const Text('Are you sure? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context
                  .read<QualitySiteObsBloc>()
                  .add(DeleteQualitySiteObs(id: obs.id));
            },
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  String _successMessage(String action) {
    switch (action) {
      case 'created':
        return 'Observation raised successfully';
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

// ─── Swipeable card wrapper ────────────────────────────────────────────────────

class _SwipeableQualityCard extends StatelessWidget {
  final QualitySiteObservation obs;
  final PermissionService ps;
  final VoidCallback onTap;
  final VoidCallback? onDelete;
  final VoidCallback? onClose;

  const _SwipeableQualityCard({
    required this.obs,
    required this.ps,
    required this.onTap,
    this.onDelete,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final hasActions = onDelete != null || onClose != null;
    if (!hasActions) return _QualityObsCard(obs: obs, onTap: onTap);

    return Slidable(
      key: ValueKey(obs.id),
      endActionPane: ActionPane(
        motion: const DrawerMotion(),
        extentRatio: onDelete != null && onClose != null ? 0.4 : 0.22,
        children: [
          if (onClose != null)
            SlidableAction(
              onPressed: (_) => onClose!(),
              backgroundColor: const Color(0xFF16A34A),
              foregroundColor: Colors.white,
              icon: Icons.lock_outline_rounded,
              label: 'Close',
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                bottomLeft: Radius.circular(12),
              ),
            ),
          if (onDelete != null)
            SlidableAction(
              onPressed: (_) => onDelete!(),
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              icon: Icons.delete_outline_rounded,
              label: 'Delete',
              borderRadius: BorderRadius.only(
                topLeft: onClose == null
                    ? const Radius.circular(12)
                    : Radius.zero,
                bottomLeft: onClose == null
                    ? const Radius.circular(12)
                    : Radius.zero,
                topRight: const Radius.circular(12),
                bottomRight: const Radius.circular(12),
              ),
            ),
        ],
      ),
      child: _QualityObsCard(obs: obs, onTap: onTap),
    );
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

class _QualityObsCard extends StatelessWidget {
  final QualitySiteObservation obs;
  final VoidCallback onTap;

  const _QualityObsCard({required this.obs, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final severityColor = SeverityBadge.colorFor(obs.severity);

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
                  if (obs.category != null) ...[
                    const SizedBox(width: 6),
                    _CategoryChip(obs.category!),
                  ],
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

class _CategoryChip extends StatelessWidget {
  final String label;
  const _CategoryChip(this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 10,
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.7))),
    );
  }
}

// ─── Empty / Error ─────────────────────────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  final String? filter;
  final String? severity;
  final bool canCreate;
  final VoidCallback onRaise;
  final VoidCallback? onClear;

  const _EmptyView({
    this.filter,
    this.severity,
    required this.canCreate,
    required this.onRaise,
    this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final hasFilter = filter != null || severity != null;
    final label = hasFilter
        ? 'No matching observations'
        : 'No quality observations yet';
    final sub = hasFilter
        ? 'Try adjusting your filters'
        : 'All clear — tap Raise to log an issue';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              hasFilter
                  ? Icons.filter_list_off_rounded
                  : Icons.checklist_rounded,
              size: 56,
              color: Theme.of(context)
                  .colorScheme
                  .primary
                  .withValues(alpha: 0.25),
            ),
            const SizedBox(height: 16),
            Text(label,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(
              sub,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.5)),
            ),
            const SizedBox(height: 16),
            if (onClear != null)
              OutlinedButton.icon(
                onPressed: onClear,
                icon: const Icon(Icons.clear_rounded, size: 16),
                label: const Text('Clear filters'),
              )
            else if (canCreate)
              FilledButton.icon(
                onPressed: onRaise,
                icon: const Icon(Icons.add_rounded, size: 16),
                label: const Text('Raise First Observation'),
              ),
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
