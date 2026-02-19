import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/theme/app_dimensions.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/pages/eps_explorer_page.dart';
import 'package:setu_mobile/injection_container.dart';

class ProjectsListPage extends StatefulWidget {
  const ProjectsListPage({super.key});

  @override
  State<ProjectsListPage> createState() => _ProjectsListPageState();
}

class _ProjectsListPageState extends State<ProjectsListPage> {
  @override
  void initState() {
    super.initState();
    // Load projects on page init
    context.read<ProjectBloc>().add(LoadProjects());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SETU'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              context.read<ProjectBloc>().add(LoadProjects());
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              _showLogoutDialog(context);
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

          if (state is ProjectsLoaded) {
            if (state.projects.isEmpty) {
              return _buildEmptyState();
            }
            return _buildProjectsList(state.projects);
          }

          return _buildEmptyState();
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.folder_off_outlined,
            size: 64,
            color: AppColors.textSecondary,
          ),
          const SizedBox(height: 16),
          Text(
            'No projects assigned',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Contact your administrator to get project access',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildProjectsList(List<Project> projects) {
    return RefreshIndicator(
      onRefresh: () async {
        context.read<ProjectBloc>().add(LoadProjects());
      },
      child: ListView.builder(
        padding: const EdgeInsets.all(AppDimensions.paddingMD),
        itemCount: projects.length,
        itemBuilder: (context, index) {
          return _buildProjectCard(projects[index]);
        },
      ),
    );
  }

  Widget _buildProjectCard(Project project) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginMD),
      child: InkWell(
        onTap: () {
          _navigateToEpsExplorer(project);
        },
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.cardPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.business_outlined,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          project.name,
                          style: Theme.of(context).textTheme.titleMedium,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (project.code != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            project.code!,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
              if (project.status != null || project.progress != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (project.status != null)
                      _buildStatusChip(project.status!),
                    const Spacer(),
                    if (project.progress != null)
                      Text(
                        '${(project.progress! * 100).toStringAsFixed(0)}%',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              color: AppColors.primary,
                            ),
                      ),
                  ],
                ),
              ],
              // Show EPS structure preview
              if (project.children.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  '${project.children.length} zones',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusChip(String status) {
    Color chipColor;
    switch (status.toLowerCase()) {
      case 'active':
      case 'in_progress':
        chipColor = AppColors.success;
        break;
      case 'completed':
        chipColor = AppColors.info;
        break;
      case 'on_hold':
      case 'delayed':
        chipColor = AppColors.warning;
        break;
      default:
        chipColor = AppColors.textSecondary;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: chipColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status.replaceAll('_', ' ').toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: chipColor,
            ),
      ),
    );
  }

  void _navigateToEpsExplorer(Project project) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BlocProvider(
          create: (context) => sl<ProjectBloc>(),
          child: EpsExplorerPage(project: project),
        ),
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              context.read<AuthBloc>().add(Logout());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}
