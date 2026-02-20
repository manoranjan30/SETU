import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/theme/app_dimensions.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/widgets/breadcrumb_widget.dart';
import 'package:setu_mobile/features/progress/presentation/pages/progress_entry_page.dart';
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';
import 'package:setu_mobile/injection_container.dart';

/// EPS Explorer Page - Hierarchical navigation through project structure
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Project Structure'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              context.read<ProjectBloc>().add(RefreshCurrentNode());
            },
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
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is ProjectLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is EpsExplorerState) {
            return _buildExplorerContent(state);
          }

          return _buildLoadingState();
        },
      ),
    );
  }

  Widget _buildExplorerContent(EpsExplorerState state) {
    return Column(
      children: [
        // Breadcrumb navigation
        BreadcrumbWidget(
          path: state.currentPath,
          onNavigateToIndex: (index) {
            context.read<ProjectBloc>().add(NavigateToPathIndex(index));
          },
        ),

        // Offline indicator
        if (state.isOffline)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: AppColors.warning.withOpacity(0.1),
            child: Row(
              children: [
                Icon(Icons.cloud_off, size: 16, color: AppColors.warning),
                const SizedBox(width: 8),
                Text(
                  'Offline - showing cached data',
                  style: TextStyle(
                    color: AppColors.warning,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),

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

  Widget _buildItemsList(EpsExplorerState state) {
    final items = <Widget>[];

    // Add folder items (EPS nodes)
    for (final node in state.childNodes) {
      items.add(_buildFolderItem(node, state));
    }

    // Add activity items
    for (final activity in state.activities) {
      items.add(_buildActivityItem(activity, state));
    }

    return ListView(
      padding: const EdgeInsets.all(AppDimensions.paddingMD),
      children: items,
    );
  }

  Widget _buildFolderItem(EpsNode node, EpsExplorerState state) {
    // Get child count
    final childCount = node.children.length;
    
    // Get activity count for this node
    final activityCount = state.getActivitiesForNode(node.id).length;

    return Card(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: Colors.amber.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(
            Icons.folder,
            color: Colors.amber,
            size: 24,
          ),
        ),
        title: Text(
          node.name,
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        subtitle: Text(
          '$childCount sub-zones${activityCount > 0 ? ', $activityCount activities' : ''}',
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12,
          ),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          context.read<ProjectBloc>().add(NavigateToNode(node));
        },
      ),
    );
  }

  Widget _buildActivityItem(Activity activity, EpsExplorerState state) {
    final progress = activity.progress;
    final progressPercent = (progress * 100).toStringAsFixed(0);

    return Card(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            activity.hasMicroSchedule ? Icons.task_alt : Icons.assignment,
            color: activity.hasMicroSchedule ? AppColors.success : AppColors.primary,
            size: 22,
          ),
        ),
        title: Text(activity.name),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: AppColors.divider,
                valueColor: AlwaysStoppedAnimation<Color>(
                  progress >= 1.0 ? AppColors.success : AppColors.primary,
                ),
                minHeight: 6,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '$progressPercent% Complete',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
              ),
            ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildStatusChip(activity.status),
            const Icon(Icons.chevron_right),
          ],
        ),
        onTap: () {
          _navigateToProgressEntry(activity, state);
        },
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
        color: chipColor.withOpacity(0.1),
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

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.folder_open_outlined,
            size: 64,
            color: AppColors.textSecondary,
          ),
          const SizedBox(height: 16),
          Text(
            'No work packages defined',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'This location has no sub-zones or activities',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return ListView.builder(
      padding: const EdgeInsets.all(AppDimensions.paddingMD),
      itemCount: 5,
      itemBuilder: (context, index) => _buildSkeletonTile(),
    );
  }

  Widget _buildSkeletonTile() {
    return Card(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppColors.divider,
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        title: Container(
          height: 16,
          decoration: BoxDecoration(
            color: AppColors.divider,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        subtitle: Container(
          height: 12,
          margin: const EdgeInsets.only(top: 8),
          decoration: BoxDecoration(
            color: AppColors.divider,
            borderRadius: BorderRadius.circular(4),
          ),
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
          ),
        ),
      ),
    );
  }
}
