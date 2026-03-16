import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/theme/app_dimensions.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/widgets/breadcrumb_widget.dart';
import 'package:setu_mobile/features/progress/presentation/pages/progress_entry_page.dart';
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';
import 'package:setu_mobile/features/sync/presentation/pages/sync_log_page.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:shimmer/shimmer.dart';

/// EPS Explorer Page - Hierarchical navigation through project structure.
///
/// Implements the "Site Level" navigation flow:
/// Project → Zone/Block → Tower → Floor → Activities
///
/// The breadcrumb at the top always reflects the current navigation depth.
/// Back button pops one level up; long-pressing it returns to the projects list.
class EpsExplorerPage extends StatefulWidget {
  final Project project;

  const EpsExplorerPage({
    super.key,
    required this.project,
  });

  @override
  State<EpsExplorerPage> createState() => _EpsExplorerPageState();
}

class _EpsExplorerPageState extends State<EpsExplorerPage> {
  @override
  void initState() {
    super.initState();
    // Kick off the initial hierarchy load when the page mounts
    context.read<ProjectBloc>().add(LoadProjectHierarchy(widget.project.id));
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      // Intercept the hardware back button to navigate up within the EPS tree
      // instead of immediately leaving the page
      onWillPop: _handleBackPress,
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: _handleBackTap,
            // Long-press shortcuts the user all the way back to the projects list
            onLongPress: () {
              Navigator.of(context).popUntil((route) => route.isFirst);
            },
            tooltip: 'Back (long press to projects)',
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Project Structure'),
              // Show the project name as a subtitle for context
              Text(
                widget.project.name,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF6B7280),
                    ),
              ),
            ],
          ),
          actions: [
            // Live sync status dot — tapping opens the sync log
            LiveSyncStatusIndicator(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SyncLogPage()),
                );
              },
            ),
            const SizedBox(width: 8),
            // Manual refresh for the currently-viewed node
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () {
                context.read<ProjectBloc>().add(RefreshCurrentNode());
              },
              tooltip: 'Refresh',
            ),
          ],
        ),
        body: BlocConsumer<ProjectBloc, ProjectState>(
          // Show a floating error snack on any ProjectError state
          listener: (context, state) {
            if (state is ProjectError) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(state.message),
                  backgroundColor: AppColors.error,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          },
          builder: (context, state) {
            // Full-screen shimmer while the initial load is in-flight
            if (state is ProjectLoading) {
              return _buildLoadingShimmer();
            }

            // Main content once the EPS tree has been loaded
            if (state is EpsExplorerState) {
              return _buildExplorerContent(state);
            }

            // Error state — show the full-page error widget
            if (state is ProjectError) {
              return _buildErrorState(state.message);
            }

            // Fallback to shimmer for any unhandled state
            return _buildLoadingShimmer();
          },
        ),
      ),
    );
  }

  /// Builds the main explorer body: breadcrumb strip + optional banners +
  /// the scrollable list of child nodes and activities.
  Widget _buildExplorerContent(EpsExplorerState state) {
    return Column(
      children: [
        // Sticky breadcrumb — tapping any crumb navigates to that level
        BreadcrumbWidget(
          path: state.currentPath,
          onNavigateToIndex: (index) {
            context.read<ProjectBloc>().add(NavigateToPathIndex(index));
          },
        ),

        // Offline indicator — shown when serving from local cache
        if (state.isOffline)
          _buildOfflineBanner(),

        // Thin progress bar at the top while child nodes are loading in the
        // background (e.g. after tapping a folder)
        if (state.isLoadingChildren)
          const LinearProgressIndicator(minHeight: 2),

        // Scrollable list of folders + activities for the current node
        Expanded(
          child: _isEffectivelyEmpty(state)
              ? _buildEmptyState()
              : _buildItemsList(state),
        ),
      ],
    );
  }

  /// Amber warning banner shown when the EPS tree is loaded from local cache
  /// because the device is offline.
  Widget _buildOfflineBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppColors.warning.withOpacity(0.15),
      child: const Row(
        children: [
          Icon(Icons.cloud_off, size: 18, color: AppColors.warning),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Offline - showing cached data',
              style: TextStyle(
                color: AppColors.warning,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Returns true when the current node has no child folders AND no activities
  /// directly attached to it (activities on deeper children are excluded).
  bool _isEffectivelyEmpty(EpsExplorerState state) {
    if (state.childNodes.isNotEmpty) return false;
    return state.activities.every((a) => a.epsNodeId != state.currentNode.id);
  }

  /// Renders the combined list of EPS folder items and leaf activities for
  /// the currently-viewed node.
  Widget _buildItemsList(EpsExplorerState state) {
    // Only show activities directly assigned to the current node.
    // executionReady returns ALL descendant activities — activities for child
    // nodes are accessible by drilling into those children and should not
    // appear at a parent level.
    final directActivities = state.activities
        .where((a) => a.epsNodeId == state.currentNode.id)
        .toList();

    return ListView(
      padding: const EdgeInsets.all(AppDimensions.paddingMD),
      children: [
        // ── Folder items section ───────────────────────────────────────────
        if (state.childNodes.isNotEmpty) ...[
          _buildSectionHeader(
            _getSectionLabel(state.childNodes),
            state.childNodes.length,
            _getSectionIcon(state.childNodes),
          ),
          const SizedBox(height: 8),
          ...state.childNodes.map((node) => _buildFolderItem(node, state)),
        ],

        // ── Leaf activity items — only those directly on this node ─────────
        if (directActivities.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildSectionHeader(
            'Activities',
            directActivities.length,
            Icons.assignment_outlined,
          ),
          const SizedBox(height: 8),
          ...directActivities.map((activity) => _buildActivityItem(activity, state)),
        ],
      ],
    );
  }

  /// Small header row with an icon, section name, and an item count badge.
  Widget _buildSectionHeader(String title, int count, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(width: 8),
          // Count badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Card for an EPS folder node (Zone / Block / Tower / Floor etc.).
  /// Tapping dispatches [NavigateToNode] to drill into that level.
  Widget _buildFolderItem(EpsNode node, EpsExplorerState state) {
    // Child folder count (sub-nodes)
    final childCount = node.children.length;
    // Activities directly assigned to this folder node
    final activityCount = state.getActivitiesForNode(node.id).length;

    return Card(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        side: const BorderSide(color: AppColors.divider, width: 1),
      ),
      child: InkWell(
        // Navigate into this node when tapped
        onTap: () {
          context.read<ProjectBloc>().add(NavigateToNode(node));
        },
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Node type icon with a tinted background
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: _getNodeColor(node.type).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  _getNodeIcon(node.type),
                  color: _getNodeColor(node.type),
                  size: 26,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      node.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Subtitle shows child count + activity count in human form
                    Text(
                      _buildFolderSubtitle(childCount, activityCount, node.type),
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              // Navigation affordance
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textSecondary,
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Builds the descriptive subtitle for a folder card, e.g. "3 floors · 5 activities".
  String _buildFolderSubtitle(int childCount, int activityCount, String nodeType) {
    final parts = <String>[];
    if (childCount > 0) {
      final childLabel = _childTypeLabelOf(nodeType);
      parts.add('$childCount $childLabel${childCount > 1 ? 's' : ''}');
    }
    if (activityCount > 0) {
      parts.add('$activityCount activit${activityCount > 1 ? 'ies' : 'y'}');
    }
    if (parts.isEmpty) {
      return 'Tap to explore';
    }
    return parts.join(' · ');
  }

  /// Returns the singular label for the expected child type of [parentType].
  String _childTypeLabelOf(String parentType) {
    switch (parentType.toUpperCase()) {
      case 'PROJECT': return 'block';
      case 'BLOCK':   return 'tower';
      case 'TOWER':   return 'floor';
      case 'FLOOR':   return 'unit';
      case 'UNIT':    return 'room';
      default:        return 'zone';
    }
  }

  /// Returns a human-readable plural label for the section header based on
  /// the type of the first child node.
  String _getSectionLabel(List<EpsNode> nodes) {
    if (nodes.isEmpty) return 'Zones';
    switch (nodes.first.type.toUpperCase()) {
      case 'BLOCK':    return 'Blocks';
      case 'TOWER':    return 'Towers';
      case 'FLOOR':    return 'Floors';
      case 'UNIT':     return 'Units';
      case 'ROOM':     return 'Rooms';
      case 'PHASE':    return 'Phases';
      case 'BUILDING': return 'Buildings';
      default:         return 'Zones';
    }
  }

  /// Returns the section header icon for the given list of nodes.
  IconData _getSectionIcon(List<EpsNode> nodes) {
    if (nodes.isEmpty) return Icons.folder_outlined;
    return _getNodeIcon(nodes.first.type);
  }

  /// Maps an EPS node type string to a Material icon.
  IconData _getNodeIcon(String type) {
    switch (type.toUpperCase()) {
      case 'BLOCK':    return Icons.domain_rounded;
      case 'TOWER':
      case 'BUILDING': return Icons.apartment_rounded;
      case 'FLOOR':    return Icons.layers_rounded;
      case 'UNIT':     return Icons.home_rounded;
      case 'ROOM':     return Icons.meeting_room_rounded;
      case 'PHASE':    return Icons.timeline_rounded;
      default:         return Icons.folder_rounded;
    }
  }

  /// Maps an EPS node type to a distinctive colour used for the icon bg.
  Color _getNodeColor(String type) {
    switch (type.toUpperCase()) {
      case 'BLOCK':    return const Color(0xFF1565C0); // deep blue
      case 'TOWER':
      case 'BUILDING': return const Color(0xFF6A1B9A); // purple
      case 'FLOOR':    return const Color(0xFFE65100); // orange
      case 'UNIT':     return const Color(0xFF2E7D32); // green
      case 'ROOM':     return const Color(0xFF00695C); // teal
      case 'PHASE':    return const Color(0xFF558B2F); // light green
      default:         return Colors.amber;
    }
  }

  /// Card for a leaf-level WBS [Activity].
  /// Shows progress bar, status badge, and actual vs planned quantities.
  /// Tapping navigates to [ProgressEntryPage].
  Widget _buildActivityItem(Activity activity, EpsExplorerState state) {
    final progress = activity.progress;
    final progressPercent = (progress * 100).toStringAsFixed(0);
    final isCompleted = progress >= 1.0;

    return Card(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        side: BorderSide(
          // Tinted green border for completed activities
          color: isCompleted
              ? AppColors.success.withOpacity(0.3)
              : AppColors.divider,
          width: 1,
        ),
      ),
      child: InkWell(
        // Navigate to progress entry form on tap
        onTap: () {
          _navigateToProgressEntry(activity, state);
        },
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Activity icon — different icon for micro-schedule activities
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: isCompleted
                      ? AppColors.success.withOpacity(0.12)
                      : AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  // task_alt icon signals the activity has a micro schedule
                  activity.hasMicroSchedule
                      ? Icons.task_alt_rounded
                      : Icons.assignment_rounded,
                  color: isCompleted
                      ? AppColors.success
                      : AppColors.primary,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            activity.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        // Status chip (Completed / In Progress / Not Started)
                        _buildStatusChip(activity.status),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Progress bar showing completion as a coloured fill
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        backgroundColor: AppColors.divider,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          isCompleted ? AppColors.success : AppColors.primary,
                        ),
                        minHeight: 6,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Percentage completion text
                        Text(
                          '$progressPercent% Complete',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        // Actual vs planned quantity when data is available
                        if (activity.unit != null && activity.plannedQuantity != null)
                          Text(
                            '${activity.actualQuantity?.toStringAsFixed(1) ?? '0'} / ${activity.plannedQuantity!.toStringAsFixed(1)} ${activity.unit}',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Navigation affordance
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textSecondary,
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Pill chip coloured by activity status value.
  Widget _buildStatusChip(String? status) {
    if (status == null) return const SizedBox.shrink();

    Color chipColor;
    String label;

    switch (status.toLowerCase()) {
      case 'completed':
        chipColor = AppColors.success;
        label = 'Completed';
        break;
      case 'in_progress':
      case 'in progress':
        chipColor = AppColors.info;
        label = 'In Progress';
        break;
      case 'not_started':
      case 'not started':
        chipColor = AppColors.textSecondary;
        label = 'Not Started';
        break;
      default:
        chipColor = AppColors.textSecondary;
        label = status.replaceAll('_', ' ');
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: chipColor.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: chipColor,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  /// Full-page error state with a Retry button that reloads the hierarchy.
  Widget _buildErrorState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.cloud_off_outlined,
                size: 40,
                color: AppColors.error,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Failed to load project',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                // Re-fire the hierarchy load event
                context
                    .read<ProjectBloc>()
                    .add(LoadProjectHierarchy(widget.project.id));
              },
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  /// Empty state shown when the current node has no sub-zones or activities.
  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.textSecondary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.folder_open_outlined,
                size: 40,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No work packages defined',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'This location has no sub-zones or activities assigned.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// Shimmer-animated skeleton list shown during the initial load.
  Widget _buildLoadingShimmer() {
    return ListView.builder(
      padding: const EdgeInsets.all(AppDimensions.paddingMD),
      itemCount: 6,
      itemBuilder: (context, index) => _buildShimmerTile(),
    );
  }

  /// Single shimmer placeholder tile matching the folder/activity card shape.
  Widget _buildShimmerTile() {
    return Container(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        border: Border.all(color: AppColors.divider),
      ),
      child: Shimmer.fromColors(
        baseColor: Colors.grey[300]!,
        highlightColor: Colors.grey[100]!,
        child: Row(
          children: [
            // Icon placeholder
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title placeholder
                  Container(
                    height: 16,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Subtitle placeholder
                  Container(
                    height: 12,
                    width: 150,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Pushes [ProgressEntryPage] for the selected [activity].
  /// Passes [currentEpsNodeId] so the progress form uses the correct EPS node
  /// (mirrors the web frontend's selectedEpsIds[0] selection).
  void _navigateToProgressEntry(Activity activity, EpsExplorerState state) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BlocProvider(
          create: (context) => sl<ProgressBloc>(),
          child: ProgressEntryPage(
            activity: activity,
            project: state.project,
            // Pass the exact EPS node the user is viewing — mirrors the web
            // frontend's selectedEpsIds[0] so micro activities are found.
            currentEpsNodeId: state.currentNode.id,
          ),
        ),
      ),
    );
  }

  /// Handles the system back gesture.
  /// Returns false (absorbs the event) if the user can navigate up within the
  /// EPS tree; returns true to allow the OS to pop the route once at the root.
  Future<bool> _handleBackPress() async {
    final projectState = context.read<ProjectBloc>().state;
    if (projectState is EpsExplorerState && projectState.currentPath.length > 1) {
      // Navigate up one level in the EPS tree
      context.read<ProjectBloc>().add(NavigateBack());
      return false; // do NOT pop the route
    }
    return true; // at root — allow the route to pop
  }

  /// Handles the AppBar back button tap by reusing [_handleBackPress] logic.
  void _handleBackTap() {
    _handleBackPress().then((shouldPop) {
      if (shouldPop && mounted) {
        Navigator.of(context).pop();
      }
    });
  }
}
