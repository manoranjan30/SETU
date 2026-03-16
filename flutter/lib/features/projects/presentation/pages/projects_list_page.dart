import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/navigation/deep_link_service.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/theme/app_dimensions.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/pages/project_dashboard_page.dart';
import 'package:setu_mobile/features/projects/presentation/widgets/breadcrumb_widget.dart';
import 'package:setu_mobile/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:setu_mobile/features/profile/presentation/pages/user_profile_page.dart';
import 'package:setu_mobile/features/settings/offline_data_page.dart';
import 'package:setu_mobile/features/sync/presentation/pages/sync_log_page.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:shimmer/shimmer.dart';

/// Landing page shown after successful login.
/// Lists all projects assigned to the current user, each as a tappable card
/// with a progress bar, status chip, and EPS zone count.
/// Also listens for deep links that arrive from FCM notification taps.
class ProjectsListPage extends StatefulWidget {
  const ProjectsListPage({super.key});

  @override
  State<ProjectsListPage> createState() => _ProjectsListPageState();
}

class _ProjectsListPageState extends State<ProjectsListPage> {
  @override
  void initState() {
    super.initState();
    // Trigger initial project fetch from the API / cache
    context.read<ProjectBloc>().add(LoadProjects());
    // Register deep-link listener so FCM notification taps navigate directly
    // to the correct project + module without any extra user interaction
    DeepLinkService.instance.notifier.addListener(_onDeepLink);
  }

  @override
  void dispose() {
    // Always remove the listener to prevent memory leaks
    DeepLinkService.instance.notifier.removeListener(_onDeepLink);
    super.dispose();
  }

  /// Called when [DeepLinkService] fires its notifier (e.g. user taps an FCM
  /// notification while the app is open or resumes from background).
  /// Consumes the pending link and navigates to [ProjectDashboardPage] with
  /// the target module pre-selected via [pendingModule].
  void _onDeepLink() {
    final link = DeepLinkService.instance.consume();
    if (link == null || link.projectId == null) return;
    final state = context.read<ProjectBloc>().state;
    if (state is ProjectsLoaded) {
      try {
        // Find the matching project in the already-loaded list
        final project =
            state.projects.firstWhere((p) => p.id == link.projectId);
        // Schedule navigation after the current frame to avoid pushing a route
        // during the build/listener phase
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ProjectDashboardPage(
                project: project,
                // pendingModule causes the dashboard to auto-navigate on load
                pendingModule: link.targetModule,
              ),
            ),
          );
        });
      } catch (_) {
        // Project not found in list — silently ignore
      }
    } else {
      // Projects not loaded yet — reload and check again after load
      context.read<ProjectBloc>().add(LoadProjects());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            // Compact brand badge — "S" inside a primary-coloured rounded box
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Center(
                child: Text(
                  'S',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Text('SETU'),
          ],
        ),
        actions: [
          // Navigate to the user's own profile page
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            tooltip: 'My Profile',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => BlocProvider<ProfileBloc>(
                    // Provide a fresh ProfileBloc scoped to this route
                    create: (_) => sl<ProfileBloc>(),
                    child: const UserProfilePage(),
                  ),
                ),
              );
            },
          ),
          // Navigate to offline data / download settings
          IconButton(
            icon: const Icon(Icons.download_for_offline_outlined),
            tooltip: 'Offline Data',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const OfflineDataPage()),
              );
            },
          ),
          // Live sync status dot — tapping opens the sync log for details
          LiveSyncStatusIndicator(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SyncLogPage()),
              );
            },
          ),
          const SizedBox(width: 8),
          // Manual refresh — re-fires LoadProjects event
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              context.read<ProjectBloc>().add(LoadProjects());
            },
            tooltip: 'Refresh',
          ),
          // Logout — shows a confirmation dialog before dispatching Logout event
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: () {
              _showLogoutDialog(context);
            },
            tooltip: 'Logout',
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Pending approvals banner (role-gated) ──────────────────────────
          // Only shown to users who have at least one approval permission.
          // Uses AuthBloc to read permissions without causing a rebuild on
          // every project-load state change.
          BlocBuilder<AuthBloc, AuthState>(
            builder: (context, authState) {
              // Only render when the user is authenticated
              if (authState is! AuthAuthenticated) return const SizedBox.shrink();
              final user = authState.user;
              final isQualityApprover =
                  user.hasPermission('QUALITY.INSPECTION.APPROVE');
              final isProgressApprover =
                  user.hasPermission('EXECUTION.ENTRY.APPROVE');
              // Hide banner entirely if the user has neither approval permission
              if (!isQualityApprover && !isProgressApprover) {
                return const SizedBox.shrink();
              }
              return _PendingApprovalsBanner(
                showQuality: isQualityApprover,
                showProgress: isProgressApprover,
              );
            },
          ),
          // ── Project list (BlocConsumer handles load / error / loaded) ──────
          Expanded(
            child: BlocConsumer<ProjectBloc, ProjectState>(
              // Show a floating error snack when the project load fails
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
                // Show shimmer skeleton while the first load is in-flight
                if (state is ProjectLoading) {
                  return _buildLoadingShimmer();
                }

                if (state is ProjectsLoaded) {
                  if (state.projects.isEmpty) {
                    return _buildEmptyState();
                  }
                  // Render the scrollable project card list
                  return _buildProjectsList(state.projects);
                }

                // Fallback: empty state (covers initial / error states)
                return _buildEmptyState();
              },
            ),
          ),
        ],
      ),
    );
  }

  /// Shown when the user has no assigned projects or the load returned empty.
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
                Icons.folder_off_outlined,
                size: 40,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No projects assigned',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Contact your administrator to get project access',
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

  /// Wraps the project card list in a [RefreshIndicator] so pull-to-refresh
  /// re-fires [LoadProjects].
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

  /// Single project card showing name, code, status chip, progress bar,
  /// and EPS zone count. Tapping navigates to [ProjectDashboardPage].
  Widget _buildProjectCard(Project project) {
    final progress = project.progress ?? 0;
    // Convert 0-1 decimal to a display percentage string
    final progressPercent = (progress * 100).toStringAsFixed(0);

    return Container(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginMD),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadowColor,
            blurRadius: 14,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        child: InkWell(
        // Tap navigates to the project dashboard (module selection)
        onTap: () => _navigateToModuleSelection(project),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Project icon with gradient background
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary.withOpacity(0.15),
                          AppColors.primary.withOpacity(0.05),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.business_rounded,
                      color: AppColors.primary,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 14),
                  // Project name + code
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          project.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (project.code != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            project.code!,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  // Navigation affordance
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
              // ── Status chip + progress percentage badge ─────────────────
              if (project.status != null || project.progress != null) ...[
                const SizedBox(height: 14),
                Row(
                  children: [
                    if (project.status != null)
                      _buildStatusChip(project.status!),
                    const Spacer(),
                    if (project.progress != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '$progressPercent%',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
              // ── Overall progress bar ─────────────────────────────────────
              if (project.progress != null) ...[
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: AppColors.divider,
                    // Green when 100% complete, primary blue otherwise
                    valueColor: AlwaysStoppedAnimation<Color>(
                      progress >= 1.0 ? AppColors.success : AppColors.primary,
                    ),
                    minHeight: 4,
                  ),
                ),
              ],
              // ── EPS zone count preview ───────────────────────────────────
              if (project.children.isNotEmpty) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Icon(
                      Icons.folder_outlined,
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${project.children.length} zone${project.children.length > 1 ? 's' : ''}',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
      ),
    );
  }

  /// Maps a raw project status string to a colour-coded pill chip.
  Widget _buildStatusChip(String status) {
    Color chipColor;
    Color textColor;
    String label;

    switch (status.toLowerCase()) {
      case 'active':
      case 'in_progress':
        chipColor = AppColors.success;
        textColor = AppColors.success;
        label = 'Active';
        break;
      case 'completed':
        chipColor = AppColors.info;
        textColor = AppColors.info;
        label = 'Completed';
        break;
      case 'on_hold':
      case 'delayed':
        chipColor = AppColors.warning;
        textColor = AppColors.warning;
        label = 'On Hold';
        break;
      default:
        chipColor = AppColors.textSecondary;
        textColor = AppColors.textSecondary;
        // Humanise unknown statuses by replacing underscores
        label = status.replaceAll('_', ' ');
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: chipColor.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  /// Shows a shimmer-animated skeleton list of 4 placeholder cards while
  /// the real project data is loading.
  Widget _buildLoadingShimmer() {
    return ListView.builder(
      padding: const EdgeInsets.all(AppDimensions.paddingMD),
      itemCount: 4,
      itemBuilder: (context, index) => _buildShimmerCard(),
    );
  }

  /// Single shimmer placeholder card matching the shape of [_buildProjectCard].
  Widget _buildShimmerCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginMD),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        boxShadow: const [
          BoxShadow(color: AppColors.shadowColor, blurRadius: 14, offset: Offset(0, 3)),
        ],
      ),
      child: Shimmer.fromColors(
        baseColor: Colors.grey[300]!,
        highlightColor: Colors.grey[100]!,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Icon placeholder
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                const SizedBox(width: 14),
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
                        width: 100,
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
            const SizedBox(height: 14),
            // Progress bar placeholder
            Container(
              height: 4,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Pushes [ProjectDashboardPage] for [project].
  /// This is the primary tap handler — no pendingModule means normal entry.
  void _navigateToModuleSelection(Project project) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ProjectDashboardPage(project: project),
      ),
    );
  }

  /// Confirmation dialog before dispatching the [Logout] event.
  /// A two-step confirmation prevents accidental logouts in the field.
  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
              // Dispatch Logout — AuthBloc will clear tokens and redirect to
              // LoginPage via the global BlocListener in main.dart
              context.read<AuthBloc>().add(Logout());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}

/// Shown at the top of the projects list for users who have approval permissions.
/// Reminds approvers that pending items await action in their projects.
class _PendingApprovalsBanner extends StatelessWidget {
  /// Whether to show the Quality Inspections chip.
  final bool showQuality;

  /// Whether to show the Progress Approvals chip.
  final bool showProgress;

  const _PendingApprovalsBanner({
    required this.showQuality,
    required this.showProgress,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: AppColors.warningSoft,
        // Left accent border draws the eye to this important banner
        border: Border(
          left: BorderSide(color: AppColors.warning, width: 4),
          bottom: BorderSide(color: AppColors.divider),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.pending_actions_rounded,
              size: 16, color: AppColors.warning),
          const SizedBox(width: 10),
          Expanded(
            child: Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text(
                  'Approvals pending:',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
                // Quality chip — only shown when user has inspection approval perm
                if (showQuality)
                  _buildChip(Icons.assignment_outlined, 'Quality',
                      AppColors.warning),
                // Progress chip — only shown when user has progress approval perm
                if (showProgress)
                  _buildChip(Icons.bar_chart_outlined, 'Progress',
                      AppColors.secondary),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Small rounded chip showing an icon + label in the given [color].
  Widget _buildChip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
