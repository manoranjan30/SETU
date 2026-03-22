import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/activity_list_detail_page.dart';

/// Entry page for the Quality Request (site engineer) flow.
/// Shows a two-panel layout:
///  1. EPS location picker (expandable tree)
///  2. Activity lists for the selected location
class QualityRequestPage extends StatefulWidget {
  final int projectId;
  final String projectName;

  const QualityRequestPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  State<QualityRequestPage> createState() => _QualityRequestPageState();
}

class _QualityRequestPageState extends State<QualityRequestPage> {
  EpsTreeNode? _selectedNode;

  /// Last successfully loaded lists — kept so that returning from
  /// ActivityListDetailPage (where the bloc state may be ActivitiesLoaded /
  /// QualityRequestLoading(refresh)) doesn't show a full-screen spinner.
  ActivityListsLoaded? _lastLists;

  /// Types at which RFIs can be raised (floor and below).
  static const _rfiLevelTypes = {'FLOOR', 'UNIT', 'ROOM'};

  @override
  void initState() {
    super.initState();
    context.read<QualityRequestBloc>().add(LoadEpsTree(widget.projectId));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Quality Request',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.projectName,
                style:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
      ),
      body: BlocConsumer<QualityRequestBloc, QualityRequestState>(
        listener: (context, state) {
          if (state is QualityRequestError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Colors.red.shade700,
              ),
            );
          }
        },
        builder: (context, state) {
          // Cache the last known lists so returning from detail page doesn't
          // show a spinner when the bloc state is ActivitiesLoaded / Loading.
          if (state is ActivityListsLoaded) _lastLists = state;

          // Full-screen spinner only before the first load (no cached data yet).
          if ((state is QualityRequestInitial ||
                  (state is QualityRequestLoading &&
                      _selectedNode == null)) &&
              _lastLists == null) {
            return const Center(child: CircularProgressIndicator());
          }

          // Error state — always show a proper error widget instead of a spinner
          if (state is QualityRequestError && _lastLists == null) {
            return _buildErrorPanel(context, state.message);
          }

          if (state is EpsTreeLoaded) {
            return Column(
              children: [
                Expanded(
                  child: _EpsTreePanel(
                    nodes: state.nodes,
                    selectedNode: _selectedNode,
                    onNodeSelected: (node) {
                      final isFloor = _rfiLevelTypes
                          .contains(node.type?.toUpperCase());
                      // Only mark non-floor nodes as selected to show the hint.
                      // Only load activity lists for floor-level nodes.
                      if (isFloor) {
                        setState(() => _selectedNode = node);
                        context.read<QualityRequestBloc>().add(SelectEpsNode(
                              projectId: widget.projectId,
                              epsNodeId: node.id,
                            ));
                      }
                      // Non-floor nodes: _EpsNodeTile handles expand/collapse
                      // internally; do not update _selectedNode so they remain
                      // un-highlighted and the hint is not shown.
                    },
                  ),
                ),
              ],
            );
          }

          if (state is ActivityListsLoaded) {
            return _buildListsPanel(context, state);
          }

          // Returned from detail page while bloc is in ActivitiesLoaded /
          // QualityRequestLoading(refresh) / RfiQueued / RectificationQueued —
          // show the cached lists instead of a full-screen spinner.
          if (_lastLists != null) {
            return _buildListsPanel(context, _lastLists!);
          }

          return const Center(child: CircularProgressIndicator());
        },
      ),
    );
  }

  Widget _buildErrorPanel(BuildContext context, String message) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded,
                size: 56, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
              onPressed: () {
                if (_selectedNode != null) {
                  context.read<QualityRequestBloc>().add(SelectEpsNode(
                        projectId: widget.projectId,
                        epsNodeId: _selectedNode!.id,
                      ));
                } else {
                  context
                      .read<QualityRequestBloc>()
                      .add(LoadEpsTree(widget.projectId));
                }
              },
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () {
                setState(() => _selectedNode = null);
                context
                    .read<QualityRequestBloc>()
                    .add(LoadEpsTree(widget.projectId));
              },
              child: const Text('Change Location'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildListsPanel(BuildContext context, ActivityListsLoaded state) {
    final theme = Theme.of(context);
    return Column(
      children: [
        // Location breadcrumb
        if (_selectedNode != null)
          Container(
            width: double.infinity,
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: theme.colorScheme.secondaryContainer,
            child: Row(
              children: [
                Icon(Icons.location_on_outlined,
                    size: 16,
                    color: theme.colorScheme.onSecondaryContainer),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _selectedNode!.label,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSecondaryContainer,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () {
                    setState(() => _selectedNode = null);
                    context
                        .read<QualityRequestBloc>()
                        .add(LoadEpsTree(widget.projectId));
                  },
                  child: const Text('Change'),
                ),
              ],
            ),
          ),

        if (state.isFromCache)
          Container(
            width: double.infinity,
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            color: Colors.orange.shade50,
            child: Row(
              children: [
                Icon(Icons.offline_bolt_outlined,
                    size: 14, color: Colors.orange.shade700),
                const SizedBox(width: 6),
                Text('Showing cached data',
                    style: TextStyle(
                        fontSize: 12, color: Colors.orange.shade700)),
              ],
            ),
          ),

        Expanded(
          child: state.lists.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.checklist_outlined,
                          size: 64,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.3)),
                      const SizedBox(height: 12),
                      Text('No activity lists for this location',
                          style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5))),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    context
                        .read<QualityRequestBloc>()
                        .add(const RefreshCurrentList());
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: state.lists.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 4),
                    itemBuilder: (context, i) {
                      final list = state.lists[i];
                      return _ActivityListTile(
                        list: list,
                        onTap: () {
                          context.read<QualityRequestBloc>().add(
                                SelectActivityList(
                                  list: list,
                                  projectId: state.projectId,
                                  epsNodeId: state.epsNodeId,
                                ),
                              );
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => BlocProvider.value(
                                value: context.read<QualityRequestBloc>(),
                                child: ActivityListDetailPage(
                                  list: list,
                                  projectId: state.projectId,
                                  epsNodeId: state.epsNodeId,
                                ),
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// EPS Tree Panel
// ---------------------------------------------------------------------------

class _EpsTreePanel extends StatelessWidget {
  final List<EpsTreeNode> nodes;
  final EpsTreeNode? selectedNode;
  final ValueChanged<EpsTreeNode> onNodeSelected;

  const _EpsTreePanel({
    required this.nodes,
    required this.selectedNode,
    required this.onNodeSelected,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (nodes.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.account_tree_outlined,
                size: 64,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.3)),
            const SizedBox(height: 12),
            const Text('No locations found for this project'),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Text(
            'Select Location',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            children: nodes
                .map((n) => _EpsNodeTile(
                      node: n,
                      depth: 0,
                      selectedNode: selectedNode,
                      onSelected: onNodeSelected,
                    ))
                .toList(),
          ),
        ),
      ],
    );
  }
}

class _EpsNodeTile extends StatefulWidget {
  final EpsTreeNode node;
  final int depth;
  final EpsTreeNode? selectedNode;
  final ValueChanged<EpsTreeNode> onSelected;

  const _EpsNodeTile({
    required this.node,
    required this.depth,
    required this.selectedNode,
    required this.onSelected,
  });

  @override
  State<_EpsNodeTile> createState() => _EpsNodeTileState();
}

class _EpsNodeTileState extends State<_EpsNodeTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final node = widget.node;
    final isSelected = widget.selectedNode?.id == node.id;
    final hasChildren = node.children.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () {
            if (hasChildren) {
              setState(() => _expanded = !_expanded);
            }
            widget.onSelected(node);
          },
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: EdgeInsets.only(
              left: 8.0 + widget.depth * 16.0,
              right: 8,
              top: 8,
              bottom: 8,
            ),
            decoration: isSelected
                ? BoxDecoration(
                    color:
                        theme.colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: theme.colorScheme.primary
                            .withValues(alpha: 0.4)),
                  )
                : null,
            child: Row(
              children: [
                Icon(
                  _nodeIcon(node.type),
                  size: 18,
                  color: isSelected
                      ? theme.colorScheme.primary
                      : theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    node.label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.normal,
                      color: isSelected
                          ? theme.colorScheme.primary
                          : null,
                    ),
                  ),
                ),
                if (hasChildren)
                  Icon(
                    _expanded
                        ? Icons.expand_less
                        : Icons.expand_more,
                    size: 18,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                  ),
              ],
            ),
          ),
        ),
        if (_expanded && hasChildren)
          ...node.children.map((child) => _EpsNodeTile(
                node: child,
                depth: widget.depth + 1,
                selectedNode: widget.selectedNode,
                onSelected: widget.onSelected,
              )),
      ],
    );
  }

  IconData _nodeIcon(String? type) {
    switch (type?.toLowerCase()) {
      case 'floor':
        return Icons.layers_outlined;
      case 'building':
      case 'tower':
        return Icons.apartment_outlined;
      case 'unit':
      case 'room':
        return Icons.meeting_room_outlined;
      case 'block':
        return Icons.grid_view_outlined;
      default:
        return Icons.folder_outlined;
    }
  }
}

// ---------------------------------------------------------------------------
// Activity List Tile
// ---------------------------------------------------------------------------

class _ActivityListTile extends StatelessWidget {
  final QualityActivityList list;
  final VoidCallback onTap;

  const _ActivityListTile({required this.list, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 1,
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: theme.colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(Icons.checklist_outlined,
              color: theme.colorScheme.onPrimaryContainer),
        ),
        title: Text(list.name,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: list.description != null
            ? Text(list.description!,
                maxLines: 1, overflow: TextOverflow.ellipsis)
            : null,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${list.activityCount}',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.primary,
              ),
            ),
            const Text('items', style: TextStyle(fontSize: 10)),
          ],
        ),
        onTap: onTap,
      ),
    );
  }
}
