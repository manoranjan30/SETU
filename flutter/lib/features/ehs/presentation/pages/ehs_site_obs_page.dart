import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/navigation/app_routes.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_site_obs_detail_page.dart';
import 'package:setu_mobile/features/projects/presentation/widgets/breadcrumb_widget.dart'
    as widgets;
import 'package:setu_mobile/shared/widgets/advanced_filter_sheet.dart';
import 'package:setu_mobile/shared/widgets/filter_chip_bar.dart';
import 'package:setu_mobile/shared/widgets/obs_status_badge.dart';
import 'package:setu_mobile/shared/widgets/raise_site_obs_sheet.dart';
import 'package:setu_mobile/shared/widgets/severity_badge.dart';
import 'package:setu_mobile/shared/widgets/shimmer_list.dart';
import 'package:setu_mobile/shared/widgets/sync_status_banner.dart';

/// EHS Site Observations page — status tabs, severity filter chips, and swipe actions.
/// Tabs: All / Open / Rectified / Closed.
/// Severity chip bar narrows results further.
/// Swipe-left on a card to reveal Close and Delete actions (permission-gated).
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
  late final ScrollController _scrollCtrl;

  // Tab label strings shown in the TabBar
  static const _tabs = ['All', 'Open', 'Rectified', 'Closed'];

  // Status filter value sent to the bloc for each tab; null = no filter (All)
  static const _tabFilters = [null, 'OPEN', 'RECTIFIED', 'CLOSED'];

  // Holds advanced filter state (severity, sort order, etc.)
  ObsFilterOptions _filterOptions = const ObsFilterOptions();

  // Severity filter chips — ALL means no filter
  static const _severityOptions = ['ALL', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];

  /// Resolves the active status filter: advanced filter overrides tab selection.
  String? get _activeStatusFilter {
    if (_filterOptions.statusFilter != null) {
      return _filterOptions.statusFilter;
    }
    return _tabFilters[_tabCtrl.index];
  }

  /// Returns the active severity filter from the advanced filter options.
  String? get _activeSeverityFilter => _filterOptions.severityFilter;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
    // Attach infinite-scroll listener to load the next page near list bottom
    _scrollCtrl = ScrollController()..addListener(_onScroll);
    // When the user switches tabs, clear the status override and reload
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) {
        // Clear status filter override when tab changes so the tab drives the filter
        setState(() {
          _filterOptions = ObsFilterOptions(
            severityFilter: _filterOptions.severityFilter,
            sortOrder: _filterOptions.sortOrder,
          );
        });
        _load();
      }
    });
    // Dispatch initial load on construction
    _load();
  }

  /// Triggers [LoadMoreEhsSiteObs] when the user scrolls near the list bottom.
  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      context.read<EhsSiteObsBloc>().add(const LoadMoreEhsSiteObs());
    }
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  /// Dispatches a full load (shows shimmer skeleton) with current filter state.
  void _load() {
    context.read<EhsSiteObsBloc>().add(LoadEhsSiteObs(
          projectId: widget.projectId,
          statusFilter: _activeStatusFilter,
          severityFilter: _activeSeverityFilter,
        ));
  }

  /// Dispatches a refresh (pull-to-refresh, no shimmer) with current filters.
  void _refresh() {
    context.read<EhsSiteObsBloc>().add(RefreshEhsSiteObs(
          projectId: widget.projectId,
          statusFilter: _activeStatusFilter,
          severityFilter: _activeSeverityFilter,
        ));
  }

  /// Opens the [RaiseSiteObsSheet] to create a new EHS observation.
  /// Permission-gated: only called when [PermissionService.canCreateEhsObs] is true.
  Future<void> _raiseObservation() async {
    final ps = PermissionService.of(context);
    // Guard: should not be called without create permission but defensive check
    if (!ps.canCreateEhsObs) return;

    await RaiseSiteObsSheet.show(
      context,
      title: 'Raise EHS Observation',
      projectId: widget.projectId,
      // Populate the category dropdown with EHS-specific category labels
      categories: EhsCategory.allLabels,
      onSubmit: ({
        required description,
        required severity,
        category,
        epsNodeId,
        locationLabel,
        photoUrls = const [],
      }) async {
        // Dispatch CreateEhsSiteObs to the bloc with all form values
        context.read<EhsSiteObsBloc>().add(CreateEhsSiteObs(
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

  /// Opens the [AdvancedFilterSheet] and applies the result to the active filters.
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
    // Read permissions once for FAB and swipe-action gating
    final ps = PermissionService.of(context);
    final activeFilters = _filterOptions.activeCount;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('EHS Observations',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.projectName,
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.normal),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ],
        ),
        // Status tabs: All / Open / Rectified / Closed
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        ),
        actions: [
          // Advanced filter button with active-filter count badge
          Stack(
            alignment: Alignment.topRight,
            children: [
              IconButton(
                icon: const Icon(Icons.tune_rounded),
                tooltip: 'Advanced filter',
                onPressed: _openAdvancedFilter,
              ),
              // Badge shows number of active advanced filters
              if (activeFilters > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    width: 16,
                    height: 16,
                    decoration: const BoxDecoration(
                      color: Color(0xFFD97706),
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
          // Manual refresh button
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _refresh,
          ),
          const widgets.LiveSyncStatusIndicator(),
          const SizedBox(width: 4),
        ],
      ),
      // FAB shown only when user has EHS observation create permission
      floatingActionButton: ps.canCreateEhsObs
          ? FloatingActionButton.extended(
              onPressed: _raiseObservation,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Raise'),
              backgroundColor: const Color(0xFFD97706),
            )
          : null,
      body: Column(
        children: [
          const SyncStatusBanner(),
          // Severity filter chip bar — tapping a chip re-fetches with that severity
          Container(
            color: Theme.of(context).colorScheme.surface,
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: FilterChipBar(
              options: _severityOptions,
              selected: _activeSeverityFilter ?? 'ALL',
              onSelected: (val) {
                // 'ALL' means no severity filter — clear the field
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
            child: BlocConsumer<EhsSiteObsBloc, EhsSiteObsState>(
              listener: (context, state) {
                // On successful action (create/close/delete): show green snack and reload
                if (state is EhsSiteObsActionSuccess) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(_successMessage(state.action)),
                      backgroundColor: Colors.green,
                    ),
                  );
                  _load();
                } else if (state is EhsSiteObsActionError) {
                  // Show error message as a red snack
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(state.message),
                      backgroundColor: Theme.of(context).colorScheme.error,
                    ),
                  );
                }
              },
              builder: (context, state) {
                // Show shimmer skeleton on initial load (not refresh)
                if (state is EhsSiteObsLoading && !state.isRefresh) {
                  return const ShimmerList(itemCount: 6);
                }
                // Full-page error with retry
                if (state is EhsSiteObsError) {
                  return _ErrorView(message: state.message, onRetry: _load);
                }
                // Extract observations and metadata from loaded state
                final loadedState =
                    state is EhsSiteObsLoaded ? state : null;
                final obs =
                    loadedState?.observations ?? <EhsSiteObservation>[];
                // fromCache is true when serving offline/cached data
                final fromCache = loadedState?.fromCache ?? false;
                final cacheAge = loadedState?.cacheAge;
                final isStale = cacheAge != null &&
                    DateTime.now().difference(cacheAge) >
                        const Duration(hours: 4);

                final isLoadingMore = loadedState?.isLoadingMore ?? false;
                final hasMore = loadedState?.hasMore ?? false;

                return Column(
                  children: [
                    // Offline cache banner — shown when data comes from local store
                    if (fromCache)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        color: isStale
                            ? Colors.red.shade50
                            : Colors.orange.shade50,
                        child: Row(
                          children: [
                            Icon(
                              isStale
                                  ? Icons.warning_amber_rounded
                                  : Icons.cloud_off_rounded,
                              size: 14,
                              color: isStale
                                  ? Colors.red.shade700
                                  : Colors.orange.shade700,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              isStale
                                  ? 'Cached data may be outdated — pull to refresh'
                                  : 'Showing cached data — pull to refresh',
                              style: TextStyle(
                                  fontSize: 11,
                                  color: isStale
                                      ? Colors.red.shade700
                                      : Colors.orange.shade700),
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
                                canCreate: ps.canCreateEhsObs,
                                onRaise: _raiseObservation,
                                // Show clear-filters button only when filters are active
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
                                // +1 for the load-more indicator row at the bottom
                                itemCount: obs.length + (hasMore ? 1 : 0),
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (_, i) {
                                  // Last item slot: load-more spinner or empty shrink
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
                                  // RepaintBoundary isolates card repaints during scroll
                                  return RepaintBoundary(
                                    child: _SwipeableEhsCard(
                                      obs: obs[i],
                                      ps: ps,
                                      onTap: () => _openDetail(obs[i]),
                                      // Delete swipe action — gated behind delete permission
                                      onDelete: ps.canDeleteEhsObs
                                          ? () => _confirmDelete(
                                              context, obs[i])
                                          : null,
                                      // Close swipe action — only for rectified obs or INFO-severity open obs
                                      onClose: ps.canCloseEhsObs &&
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

  /// Navigates to [EhsSiteObsDetailPage] using a [SlideUpRoute] transition.
  /// Passes the parent's bloc via [BlocProvider.value] and reloads on return.
  void _openDetail(EhsSiteObservation obs) {
    Navigator.push(
      context,
      SlideUpRoute(
        child: BlocProvider.value(
          // Share the existing bloc so detail actions update the parent list
          value: context.read<EhsSiteObsBloc>(),
          child: EhsSiteObsDetailPage(
            obs: obs,
            projectId: widget.projectId,
          ),
        ),
      ),
    ).then((_) => _load()); // Reload list when returning from detail
  }

  /// Dispatches [CloseEhsSiteObs] directly without a confirmation dialog.
  void _quickClose(BuildContext context, String id) {
    context.read<EhsSiteObsBloc>().add(CloseEhsSiteObs(id: id));
  }

  /// Shows a confirmation dialog before dispatching [DeleteEhsSiteObs].
  void _confirmDelete(BuildContext context, EhsSiteObservation obs) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Observation'),
        content: const Text(
            'Are you sure? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              // Dispatch delete after dialog is dismissed
              context
                  .read<EhsSiteObsBloc>()
                  .add(DeleteEhsSiteObs(id: obs.id));
            },
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  /// Maps an action string from the bloc to a human-readable success message.
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

// ─── Swipeable card wrapper ────────────────────────────────────────────────────

/// Wraps an [_EhsObsCard] in a [Slidable] to expose Close and Delete swipe actions.
/// When neither action is available, renders the plain card without a Slidable wrapper.
class _SwipeableEhsCard extends StatelessWidget {
  final EhsSiteObservation obs;
  final PermissionService ps;
  final VoidCallback onTap;
  final VoidCallback? onDelete;
  final VoidCallback? onClose;

  const _SwipeableEhsCard({
    required this.obs,
    required this.ps,
    required this.onTap,
    this.onDelete,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    // Skip the Slidable wrapper when no swipe actions are available
    final hasActions = onDelete != null || onClose != null;
    if (!hasActions) return _EhsObsCard(obs: obs, onTap: onTap);

    return Slidable(
      key: ValueKey(obs.id),
      // Swipe-left reveals the end action pane
      endActionPane: ActionPane(
        motion: const DrawerMotion(),
        // Wider extent when both Close and Delete actions are present
        extentRatio: onDelete != null && onClose != null ? 0.4 : 0.22,
        children: [
          // Close action — rounded left corners when it is the first action
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
          // Delete action — rounded left corners when it is the only action
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
      child: _EhsObsCard(obs: obs, onTap: onTap),
    );
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/// Single EHS observation card.
/// Shows status badge, severity badge, category chip, description,
/// location, photo count, and creation date.
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
        // Open observations have a stronger tinted border for visual urgency
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
                  // Status badge (Open / Rectified / Closed)
                  ObsStatusBadge(status: obs.status.label),
                  const SizedBox(width: 6),
                  // Severity badge (Critical / Major / Minor / Info)
                  SeverityBadge(severity: obs.severity),
                  const SizedBox(width: 6),
                  // EHS category chip (Safety / Health / Environment / Near Miss)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD97706).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: const Color(0xFFD97706)
                              .withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(catEnum.icon,
                            size: 11,
                            color: const Color(0xFFD97706)),
                        const SizedBox(width: 3),
                        Text(catEnum.label,
                            style: const TextStyle(
                                fontSize: 10,
                                color: Color(0xFFD97706),
                                fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                  if (obs.id.startsWith('local_')) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.cloud_upload_outlined,
                              size: 11,
                              color: Colors.orange.shade800),
                          const SizedBox(width: 3),
                          Text('Pending',
                              style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.orange.shade800,
                                  fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ],
                  const Spacer(),
                  // Photo count shown when attachments are present
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
              // Observation description capped at 2 lines
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
                  // Location chip shown when a label is available
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
                  // Creation date aligned right
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

  /// Formats a [DateTime] as DD/MM/YYYY for display in the card footer.
  String _fmtDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
}

// ─── Empty / Error ─────────────────────────────────────────────────────────────

/// Empty state shown when no observations match the current filters.
/// Shows "Clear filters" when filters are active, or "Raise First Observation"
/// when no filters are set and the user has create permission.
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
    // Context-aware label and subtitle based on whether filters are active
    final hasFilter = filter != null || severity != null;
    final label = hasFilter
        ? 'No matching observations'
        : 'No EHS observations yet';
    final sub = hasFilter
        ? 'Try adjusting your filters'
        : 'Site looking safe — tap Raise to log an issue';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              // Different icon when filters are active vs. no data at all
              hasFilter
                  ? Icons.filter_list_off_rounded
                  : Icons.health_and_safety_outlined,
              size: 56,
              color: const Color(0xFFD97706).withValues(alpha: 0.3),
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
            // When filters are active, offer to clear them; otherwise offer to raise
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
                style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706)),
              ),
          ],
        ),
      ),
    );
  }
}

/// Full-page error state with a message and retry button.
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
