import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/navigation/app_routes.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_incident_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_incidents_page.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_site_obs_page.dart';
import 'package:setu_mobile/features/labor/presentation/bloc/labor_bloc.dart';
import 'package:setu_mobile/features/labor/presentation/pages/labor_presence_page.dart';
import 'package:setu_mobile/features/progress/presentation/pages/progress_approvals_page.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/cubit/dashboard_cubit.dart';
import 'package:setu_mobile/features/projects/presentation/pages/eps_explorer_page.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_dashboard_bloc.dart'
    hide DashboardLoaded, DashboardLoading, DashboardInitial, DashboardError;
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_approvals_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_dashboard_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_request_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_site_obs_page.dart';
import 'package:setu_mobile/features/tower_lens/presentation/pages/tower_lens_page.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/connectivity_banner.dart';

/// Full project dashboard — replaces the plain ModuleSelectionPage.
/// Shows stat cards, module grid, and navigates to feature modules.
/// [pendingModule] auto-navigates on load (used for deep-link from notifications).
class ProjectDashboardPage extends StatelessWidget {
  final Project project;

  /// Optional module key (e.g. 'quality_site_obs') coming from a deep link.
  /// When present, [_DashboardViewState.initState] calls [_navigateToModule]
  /// after the first frame so the user lands directly in the right feature.
  final String? pendingModule;

  const ProjectDashboardPage({
    super.key,
    required this.project,
    this.pendingModule,
  });

  @override
  Widget build(BuildContext context) {
    // Provide a scoped DashboardCubit that loads counts for the stat cards
    return BlocProvider<DashboardCubit>(
      create: (_) => DashboardCubit(
        apiClient: sl<SetuApiClient>(),
        database: sl<AppDatabase>(),
        projectId: project.id,
      )..load(), // kick off the initial load immediately
      child: _DashboardView(project: project, pendingModule: pendingModule),
    );
  }
}

/// Stateful inner widget that owns the deep-link auto-navigation logic.
class _DashboardView extends StatefulWidget {
  final Project project;
  final String? pendingModule;
  const _DashboardView({required this.project, this.pendingModule});

  @override
  State<_DashboardView> createState() => _DashboardViewState();
}

class _DashboardViewState extends State<_DashboardView> {
  @override
  void initState() {
    super.initState();
    // If a pendingModule was injected (e.g. from a deep link / FCM tap),
    // schedule navigation after the first frame to avoid pushing a route
    // during the build phase
    if (widget.pendingModule != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _navigateToModule(widget.pendingModule!);
      });
    }
  }

  /// Routes to the correct feature page based on the [module] key.
  /// Each case provisions the required BLoC and navigates with [FadeSlideRoute].
  void _navigateToModule(String module) {
    final project = widget.project;
    switch (module) {
      case 'quality_site_obs':
        // Quality site observations require QualitySiteObsBloc
        Navigator.push(context, FadeSlideRoute(
          child: BlocProvider(
            create: (_) => sl<QualitySiteObsBloc>(),
            child: QualitySiteObsPage(projectId: project.id, projectName: project.name),
          ),
        ));
        break;
      case 'ehs_site_obs':
        // EHS observations require EhsSiteObsBloc
        Navigator.push(context, FadeSlideRoute(
          child: BlocProvider(
            create: (_) => sl<EhsSiteObsBloc>(),
            child: EhsSiteObsPage(projectId: project.id, projectName: project.name),
          ),
        ));
        break;
      case 'quality_approvals':
        // Quality approvals require QualityApprovalBloc
        Navigator.push(context, FadeSlideRoute(
          child: BlocProvider(
            create: (_) => sl<QualityApprovalBloc>(),
            child: QualityApprovalsPage(projectId: project.id, projectName: project.name),
          ),
        ));
        break;
      case 'progress_approvals':
        // Progress approvals page manages its own cubit internally
        Navigator.push(context, FadeSlideRoute(
          child: ProgressApprovalsPage(projectId: project.id, projectName: project.name),
        ));
        break;
      case 'ehs_incidents':
        // EHS incidents require EhsIncidentBloc
        Navigator.push(context, FadeSlideRoute(
          child: BlocProvider(
            create: (_) => sl<EhsIncidentBloc>(),
            child: EhsIncidentsPage(projectId: project.id, projectName: project.name),
          ),
        ));
        break;
      case 'labor':
        // Labor register requires LaborBloc
        Navigator.push(context, FadeSlideRoute(
          child: BlocProvider(
            create: (_) => sl<LaborBloc>(),
            child: LaborPresencePage(projectId: project.id, projectName: project.name),
          ),
        ));
        break;
      case 'tower_lens':
        // Tower Lens creates its own BLoC internally via TowerProgressRepository
        Navigator.push(context, FadeSlideRoute(
          child: TowerLensPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ));
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final project = widget.project;
    // Read permissions once — PermissionService wraps the auth state
    final ps = PermissionService.of(context);
    final authState = context.read<AuthBloc>().state;
    // Extract first name for a personalised greeting
    final userName = authState is AuthAuthenticated
        ? authState.user.fullName.split(' ').first
        : 'there';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Project name — truncated to one line in the app bar
            Text(
              project.name,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            // Optional project code shown below the name
            if (project.code != null)
              Text(
                project.code!,
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.normal),
              ),
          ],
        ),
        actions: [
          // Refresh both the dashboard counts and the project data
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () =>
                context.read<DashboardCubit>().refresh(),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: ConnectivityBanner(
        child: RefreshIndicator(
          // Pull-to-refresh triggers a DashboardCubit reload
          onRefresh: () => context.read<DashboardCubit>().refresh(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              // ── Time-based greeting card with progress ring ──────────────
              _GreetingCard(userName: userName, project: project),
              const SizedBox(height: 16),

              // ── Action stat cards (pending items the user must act on) ───
              _StatCardsSection(project: project, ps: ps),
              const SizedBox(height: 20),

              // ── Feature module grid ──────────────────────────────────────
              const _SectionLabel('MODULES'),
              const SizedBox(height: 10),
              _ModuleGrid(project: project, ps: ps),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Greeting ────────────────────────────────────────────────────────────────

/// Top banner card with a time-aware greeting and an optional circular
/// progress ring showing the project's overall completion percentage.
class _GreetingCard extends StatelessWidget {
  final String userName;
  final Project project;

  const _GreetingCard({required this.userName, required this.project});

  @override
  Widget build(BuildContext context) {
    // Derive the appropriate greeting based on current hour
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        // Dark blue gradient matching the Puravankara brand palette
        gradient: const LinearGradient(
          colors: [Color(0xFF0F3460), Color(0xFF1A5276)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$greeting, $userName 👋',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Select a module below to get started',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          // Show progress ring only when project.progress is available
          if (project.progress != null) ...[
            const SizedBox(width: 12),
            _ProgressRing(progress: project.progress!),
          ],
        ],
      ),
    );
  }
}

/// Circular progress indicator overlaid with the completion percentage text.
/// Uses the gold accent colour to stand out on the dark blue background.
class _ProgressRing extends StatelessWidget {
  final double progress;
  const _ProgressRing({required this.progress});

  @override
  Widget build(BuildContext context) {
    // Format 0-1 decimal as a whole-number percentage
    final pct = (progress * 100).toStringAsFixed(0);
    return SizedBox(
      width: 56,
      height: 56,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Ring track (semi-transparent white) + filled arc
          CircularProgressIndicator(
            value: progress,
            strokeWidth: 5,
            backgroundColor: Colors.white.withValues(alpha: 0.2),
            valueColor:
                const AlwaysStoppedAnimation<Color>(Color(0xFFC9912A)),
          ),
          // Percentage label centred inside the ring
          Text(
            '$pct%',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

/// Renders a 2-column grid of action stat cards, each showing a live count
/// of pending items the current user can act on (approvals, observations).
/// Only cards for which the user has permission are included.
class _StatCardsSection extends StatelessWidget {
  final Project project;
  final PermissionService ps;

  const _StatCardsSection({required this.project, required this.ps});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<DashboardCubit, DashboardState>(
      builder: (context, state) {
        // Safely cast to the loaded type; null means still loading
        final loaded = state is DashboardLoaded ? state : null;

        // Build the card definitions based on what this user can do
        final cards = <_CardDef>[
          // Pending inspections card — only for users who can approve RFIs
          if (ps.canApproveInspection ||
              ps.canStageApprove ||
              ps.canFinalApprove)
            _CardDef(
              label: 'Pending\nInspections',
              icon: Icons.assignment_outlined,
              color: const Color(0xFF3730A3),
              count: loaded?.pendingInspections,
              onTap: () => _goQualityApprovals(context),
            ),
          // Progress approvals card — only for users who can approve progress entries
          if (ps.canApproveProgress)
            _CardDef(
              label: 'Progress\nApprovals',
              icon: Icons.fact_check_outlined,
              color: const Color(0xFF0369A1),
              count: loaded?.pendingProgressApprovals,
              onTap: () => _goProgressApprovals(context),
            ),
          // Open quality observations — requires any quality obs access
          if (ps.hasAnyQualityObsAccess)
            _CardDef(
              label: 'Open Quality\nObservations',
              icon: Icons.remove_red_eye_outlined,
              color: const Color(0xFF0F766E),
              count: loaded?.openQualityObs,
              onTap: () => _goQualityObs(context),
            ),
          // Open EHS observations — requires any EHS access
          if (ps.hasAnyEhsAccess)
            _CardDef(
              label: 'Open EHS\nObservations',
              icon: Icons.health_and_safety_outlined,
              color: const Color(0xFFD97706),
              count: loaded?.openEhsObs,
              onTap: () => _goEhsObs(context),
            ),
        ];

        // Hide the entire section if the user has no actionable modules
        if (cards.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionLabel('MY ACTIONS'),
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              // Prevent the grid from scrolling independently inside the ListView
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate:
                  const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.6,
              ),
              itemCount: cards.length,
              itemBuilder: (_, i) => _ActionStatCard(def: cards[i]),
            ),
          ],
        );
      },
    );
  }

  /// Navigate to the Quality Approvals page, provisioning the required BLoC.
  void _goQualityApprovals(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<QualityApprovalBloc>(),
          child: QualityApprovalsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  /// Navigate to the Progress Approvals page (manages its own cubit).
  void _goProgressApprovals(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: ProgressApprovalsPage(
          projectId: project.id,
          projectName: project.name,
        ),
      ),
    );
  }

  /// Navigate to the Quality Site Observations page.
  void _goQualityObs(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<QualitySiteObsBloc>(),
          child: QualitySiteObsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  /// Navigate to the EHS Site Observations page.
  void _goEhsObs(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<EhsSiteObsBloc>(),
          child: EhsSiteObsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }
}

/// Data class describing a single action stat card.
class _CardDef {
  final String label;
  final IconData icon;
  final Color color;

  /// Null while the count is still loading; renders a skeleton placeholder.
  final int? count;
  final VoidCallback onTap;

  const _CardDef({
    required this.label,
    required this.icon,
    required this.color,
    required this.count,
    required this.onTap,
  });
}

/// A single tappable stat card showing a coloured icon, animated count,
/// and a descriptive label. Highlights its border when count > 0.
class _ActionStatCard extends StatelessWidget {
  final _CardDef def;
  const _ActionStatCard({required this.def});

  @override
  Widget build(BuildContext context) {
    // hasItems drives the border highlight so urgent cards draw attention
    final hasItems = (def.count ?? 0) > 0;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: def.onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              // Thicker, coloured border when there are items requiring attention
              color: hasItems
                  ? def.color.withValues(alpha: 0.4)
                  : const Color(0xFFE5E7EB),
              width: hasItems ? 1.5 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              // Coloured icon background
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: def.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(def.icon, color: def.color, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Show skeleton while count is loading, then animate in
                    def.count == null
                        ? _LoadingCount()
                        : _AnimatedCount(
                            count: def.count!,
                            color: def.color,
                          ),
                    const SizedBox(height: 2),
                    Text(
                      def.label,
                      style: TextStyle(
                        fontSize: 10,
                        color: const Color(0xFF6B7280),
                        height: 1.3,
                      ),
                      maxLines: 2,
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
}

/// Grey pill placeholder rendered while the dashboard count is still loading.
class _LoadingCount extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 20,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

/// Counts up from 0 to [count] over 900 ms using a tween animation.
/// Coloured grey when zero to visually de-emphasise empty queues.
class _AnimatedCount extends StatelessWidget {
  final int count;
  final Color color;

  const _AnimatedCount({required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<int>(
      tween: IntTween(begin: 0, end: count),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (_, val, __) => Text(
        '$val',
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          // Use the card's accent colour when non-zero; grey when empty
          color: count > 0 ? color : const Color(0xFF9CA3AF),
          height: 1,
        ),
      ),
    );
  }
}

// ─── Module grid ──────────────────────────────────────────────────────────────

/// 3-column grid of feature module tiles.  Only tiles for which the current
/// user holds the relevant permission are rendered.
class _ModuleGrid extends StatelessWidget {
  final Project project;
  final PermissionService ps;

  const _ModuleGrid({required this.project, required this.ps});

  @override
  Widget build(BuildContext context) {
    // Assemble module list based on user permissions
    final modules = <_ModuleDef>[
      // Progress reporting — navigates to EPS explorer
      if (ps.canEntryProgress)
        _ModuleDef(
          icon: Icons.timeline_rounded,
          label: 'Progress\nReporting',
          color: const Color(0xFF1565C0),
          onTap: () => _goProgress(context),
        ),
      // Progress approvals — only for approvers
      if (ps.canApproveProgress)
        _ModuleDef(
          icon: Icons.fact_check_outlined,
          label: 'Progress\nApprovals',
          color: const Color(0xFF0369A1),
          onTap: () => _goProgressApprovals(context),
        ),
      // Quality RFI request — for site engineers
      if (ps.canRaiseRfi)
        _ModuleDef(
          icon: Icons.task_alt_rounded,
          label: 'Quality\nRequest',
          color: const Color(0xFF0E7490),
          onTap: () => _goQualityRequest(context),
        ),
      // Quality inspection approvals — for QC inspectors
      if (ps.canReadInspection)
        _ModuleDef(
          icon: Icons.verified_rounded,
          label: 'Quality\nApprovals',
          color: const Color(0xFF3730A3),
          onTap: () => _goQualityApprovals(context),
        ),
      // Checklist Progress Dashboard — drill-down Block→Floor→Activity
      if (ps.canReadInspection || ps.canRaiseRfi)
        _ModuleDef(
          icon: Icons.dashboard_rounded,
          label: 'Checklist\nProgress',
          color: const Color(0xFF0891B2),
          onTap: () => _goChecklistDashboard(context),
        ),
      // Quality site observations
      if (ps.hasAnyQualityObsAccess)
        _ModuleDef(
          icon: Icons.remove_red_eye_outlined,
          label: 'Quality\nObservations',
          color: const Color(0xFF0F766E),
          onTap: () => _goQualityObs(context),
        ),
      // EHS site observations
      if (ps.hasAnyEhsAccess)
        _ModuleDef(
          icon: Icons.health_and_safety_outlined,
          label: 'EHS\nObservations',
          color: const Color(0xFFD97706),
          onTap: () => _goEhsObs(context),
        ),
      // EHS incidents — safety incident reporting
      if (ps.hasAnyEhsIncidentAccess)
        _ModuleDef(
          icon: Icons.report_problem_outlined,
          label: 'EHS\nIncidents',
          color: const Color(0xFFB91C1C),
          onTap: () => _goEhsIncidents(context),
        ),
      // Labor register — daily headcount entry
      if (ps.hasAnyLaborAccess)
        _ModuleDef(
          icon: Icons.people_outline_rounded,
          label: 'Labor\nRegister',
          color: const Color(0xFF065F46),
          onTap: () => _goLabor(context),
        ),
      // Tower Lens — 3D building progress visualization (available to all users)
      _ModuleDef(
        icon: Icons.view_in_ar_rounded,
        label: '3D Tower\nProgress',
        color: const Color(0xFF4C1D95),
        onTap: () => _goTowerLens(context),
      ),
    ];

    // No accessible modules — show a lock icon + admin message
    if (modules.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.lock_outline_rounded,
                  size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              Text(
                'No modules available\nContact your administrator',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    return GridView.builder(
      shrinkWrap: true,
      // Prevent independent scrolling — the parent ListView handles scrolling
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.9,
      ),
      itemCount: modules.length,
      itemBuilder: (_, i) => _ModuleGridItem(def: modules[i]),
    );
  }

  /// Navigate to the EPS explorer (progress reporting entry point).
  void _goProgress(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<ProjectBloc>(),
          child: EpsExplorerPage(project: project),
        ),
      ),
    );
  }

  void _goProgressApprovals(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: ProgressApprovalsPage(
          projectId: project.id,
          projectName: project.name,
        ),
      ),
    );
  }

  void _goQualityRequest(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<QualityRequestBloc>(),
          child: QualityRequestPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _goQualityApprovals(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<QualityApprovalBloc>(),
          child: QualityApprovalsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _goQualityObs(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<QualitySiteObsBloc>(),
          child: QualitySiteObsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _goEhsObs(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<EhsSiteObsBloc>(),
          child: EhsSiteObsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _goEhsIncidents(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<EhsIncidentBloc>(),
          child: EhsIncidentsPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _goLabor(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<LaborBloc>(),
          child: LaborPresencePage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _goChecklistDashboard(BuildContext context) {
    Navigator.push(
      context,
      FadeSlideRoute(
        child: BlocProvider(
          create: (_) => sl<QualityDashboardBloc>(),
          child: QualityDashboardPage(
            projectId: project.id,
            projectName: project.name,
          ),
        ),
      ),
    );
  }

  void _goTowerLens(BuildContext context) {
    // TowerLensPage creates its own BLoC and TowerProgressRepository internally
    Navigator.push(
      context,
      FadeSlideRoute(
        child: TowerLensPage(
          projectId: project.id,
          projectName: project.name,
        ),
      ),
    );
  }
}

/// Data class for a single module grid tile definition.
class _ModuleDef {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ModuleDef({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
}

/// Renders a single module tile: a coloured icon box above a two-line label.
/// The card border uses a tinted version of the module's accent colour.
class _ModuleGridItem extends StatelessWidget {
  final _ModuleDef def;
  const _ModuleGridItem({required this.def});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: def.onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              // Subtle tinted border matches the module's colour identity
              color: def.color.withValues(alpha: 0.2),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Icon in a soft-tinted rounded container
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: def.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(def.icon, color: def.color, size: 22),
              ),
              const SizedBox(height: 8),
              Text(
                def.label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF374151),
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Section label ────────────────────────────────────────────────────────────

/// Small all-caps section heading used to separate dashboard sections.
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
      ),
    );
  }
}
