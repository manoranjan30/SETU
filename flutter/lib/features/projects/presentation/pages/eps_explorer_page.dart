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

/// EPS Explorer Page - Hierarchical navigation through project structure
/// 
/// This page implements the "Site Level" navigation flow as per the requirements:
/// Project -> Zone -> Floor -> Activities
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
    // Load project hierarchy on page init
    context.read<ProjectBloc>().add(LoadProjectHierarchy(widget.project.id));
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _handleBackPress,
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: _handleBackTap,
            onLongPress: () {
              Navigator.of(context).popUntil((route) => route.isFirst);
            },
            tooltip: 'Back (long press to projects)',
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Project Structure'),
              Text(
                widget.project.name,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF6B7280),
                    ),
              ),
            ],
          ),
          actions: [
            LiveSyncStatusIndicator(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SyncLogPage()),
                );
              },
            ),
            const SizedBox(width: 8),
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
            if (state is ProjectLoading) {
              return _buildLoadingShimmer();
            }

            if (state is EpsExplorerState) {
              return _buildExplorerContent(state);
            }

            if (state is ProjectError) {
              return _buildErrorState(state.message);
            }

            return _buildLoadingShimmer();
          },
        ),
      ),
    );
  }

  Widget _buildExplorerContent(EpsExplorerState state) {
    return Column(
      children: [
        // Breadcrumb navigation - sticky at top
        BreadcrumbWidget(
          path: state.currentPath,
          onNavigateToIndex: (index) {
            context.read<ProjectBloc>().add(NavigateToPathIndex(index));
          },
        ),

        // Offline indicator
        if (state.isOffline)
          _buildOfflineBanner(),

        // Loading indicator for children
        if (state.isLoadingChildren)
          const LinearProgressIndicator(minHeight: 2),

        // Content
        Expanded(
          child: state.isEmpty
              ? _buildEmptyState()
              : _buildItemsList(state),
        ),
      ],
    );
  }

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

  Widget _buildItemsList(EpsExplorerState state) {
    return ListView(
      padding: const EdgeInsets.all(AppDimensions.paddingMD),
      children: [
        // Folder items (EPS nodes) section
        if (state.childNodes.isNotEmpty) ...[
          _buildSectionHeader(
            _getSectionLabel(state.childNodes),
            state.childNodes.length,
            _getSectionIcon(state.childNodes),
          ),
          const SizedBox(height: 8),
          ...state.childNodes.map((node) => _buildFolderItem(node, state)),
        ],

        // Activity items section
        if (state.activities.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildSectionHeader(
            'Activities',
            state.activities.length,
            Icons.assignment_outlined,
          ),
          const SizedBox(height: 8),
          ...state.activities.map((activity) => _buildActivityItem(activity, state)),
        ],
      ],
    );
  }

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

  Widget _buildFolderItem(EpsNode node, EpsExplorerState state) {
    // Get child count
    final childCount = node.children.length;
    
    // Get activity count for this node
    final activityCount = state.getActivitiesForNode(node.id).length;

    return Card(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        side: const BorderSide(color: AppColors.divider, width: 1),
      ),
      child: InkWell(
        onTap: () {
          context.read<ProjectBloc>().add(NavigateToNode(node));
        },
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Node icon with type-based color
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
              // Content
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
              // Chevron
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

  /// Returns singular label for the expected child type
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

  /// Returns a display label for the section header based on children's type
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

  IconData _getSectionIcon(List<EpsNode> nodes) {
    if (nodes.isEmpty) return Icons.folder_outlined;
    return _getNodeIcon(nodes.first.type);
  }

  /// Icon per EPS node type
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

  /// Color per EPS node type
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
          color: isCompleted 
              ? AppColors.success.withOpacity(0.3)
              : AppColors.divider,
          width: 1,
        ),
      ),
      child: InkWell(
        onTap: () {
          _navigateToProgressEntry(activity, state);
        },
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Activity icon with background
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
              // Content
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
                        _buildStatusChip(activity.status),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Progress bar
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
                        Text(
                          '$progressPercent% Complete',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
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
              // Chevron
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

  Widget _buildLoadingShimmer() {
    return ListView.builder(
      padding: const EdgeInsets.all(AppDimensions.paddingMD),
      itemCount: 6,
      itemBuilder: (context, index) => _buildShimmerTile(),
    );
  }

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
                  Container(
                    height: 16,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 8),
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

  Future<bool> _handleBackPress() async {
    final projectState = context.read<ProjectBloc>().state;
    if (projectState is EpsExplorerState && projectState.currentPath.length > 1) {
      context.read<ProjectBloc>().add(NavigateBack());
      return false;
    }
    return true;
  }

  void _handleBackTap() {
    _handleBackPress().then((shouldPop) {
      if (shouldPop && mounted) {
        Navigator.of(context).pop();
      }
    });
  }
}

