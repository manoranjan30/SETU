import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/navigation/app_routes.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/design/presentation/pages/design_hub_page.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_incident_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_incidents_page.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_main_hub_page.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_site_obs_page.dart';
import 'package:setu_mobile/features/labor/presentation/bloc/labor_bloc.dart';
import 'package:setu_mobile/features/labor/presentation/pages/labor_presence_page.dart';
import 'package:setu_mobile/features/progress/presentation/pages/progress_approvals_page.dart';
import 'package:setu_mobile/features/progress/presentation/pages/progress_hub_page.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/cubit/dashboard_cubit.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_approvals_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_hub_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_site_obs_page.dart';
import 'package:setu_mobile/features/planning/presentation/pages/planning_hub_page.dart';
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
  // Company/project logos for the identity card — loaded lazily and
  // non-blocking; the dashboard renders immediately with icon fallbacks and
  // the card just swaps in the real logo once (if) this resolves. Not every
  // project has a profile filled in, so a failure here is silent.
  String? _companyLogoUrl;
  String? _projectLogoUrl;
  String? _owningCompany;

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
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await sl<SetuApiClient>().getProjectProfile(widget.project.id);
      final companyLogo = profile['companyLogoUrl'] as String?;
      final projectLogo = profile['projectLogoUrl'] as String?;
      if (!mounted) return;
      setState(() {
        _companyLogoUrl = (companyLogo != null && companyLogo.isNotEmpty) ? ApiEndpoints.resolveUrl(companyLogo) : null;
        _projectLogoUrl = (projectLogo != null && projectLogo.isNotEmpty) ? ApiEndpoints.resolveUrl(projectLogo) : null;
        _owningCompany = profile['owningCompany'] as String?;
      });
    } catch (_) {
      // No profile yet, or offline — the identity card just shows icon
      // fallbacks instead of real logos, nothing breaks.
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
        Navigator.push(context, FadeSlideRoute(
          child: ProgressApprovalsPage(projectId: project.id, projectName: project.name),
        ));
        break;
      case 'planning':
        Navigator.push(context, FadeSlideRoute(
          child: PlanningHubPage(project: project),
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
              // ── Colourful project identity card: logos, name, progress ───
              _ProjectIdentityCard(
                userName: userName,
                project: project,
                companyLogoUrl: _companyLogoUrl,
                projectLogoUrl: _projectLogoUrl,
                owningCompany: _owningCompany,
              ),
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

// ─── Project identity card ─────────────────────────────────────────────────

/// Colourful "hero" card at the top of the dashboard — company logo, project
/// logo, project name/code, overall progress ring, and a time-aware
/// greeting, over a rich multi-stop gradient with soft decorative circles.
/// Logos come from the project's `ProjectProfile` (`GET /eps/:id/profile`);
/// either one may be unset, in which case [_LogoAvatar] falls back to a
/// gold initial-letter badge rather than leaving a blank space.
class _ProjectIdentityCard extends StatelessWidget {
  final String userName;
  final Project project;
  final String? companyLogoUrl;
  final String? projectLogoUrl;
  final String? owningCompany;

  const _ProjectIdentityCard({
    required this.userName,
    required this.project,
    this.companyLogoUrl,
    this.projectLogoUrl,
    this.owningCompany,
  });

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        // Richer three-stop brand gradient (navy → teal-blue → deep teal)
        // instead of the old flat two-tone — reads as more "alive" while
        // staying within the Puravankara palette.
        gradient: const LinearGradient(
          colors: [Color(0xFF0F3460), Color(0xFF1B5E82), Color(0xFF10685A)],
          stops: [0.0, 0.55, 1.0],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F3460).withValues(alpha: 0.35),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Decorative translucent circles for depth — purely cosmetic,
          // clipped by the parent Container's borderRadius.
          Positioned(right: -30, top: -34, child: _decorCircle(96, 0.10)),
          Positioned(right: 36, bottom: -46, child: _decorCircle(72, 0.08)),
          Positioned(left: -24, bottom: -50, child: _decorCircle(100, 0.06)),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _LogoAvatar(url: projectLogoUrl, fallbackText: project.name, size: 52),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            project.name,
                            style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800, height: 1.15),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (project.code != null) ...[
                            const SizedBox(height: 5),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(project.code!, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (project.progress != null) ...[
                      const SizedBox(width: 10),
                      _ProgressRing(progress: project.progress!),
                    ],
                  ],
                ),
                // Only render this row at all when there's something real to
                // show — never invent a company name/logo. `owningCompany`
                // comes straight from ProjectProfile.owningCompany; it's
                // frequently unset (as it is here), and this project's own
                // logo may belong to a different brand within the group, so
                // guessing a name would actively mislead rather than help.
                if (companyLogoUrl != null || (owningCompany?.isNotEmpty ?? false)) ...[
                  const SizedBox(height: 14),
                  Divider(color: Colors.white.withValues(alpha: 0.14), height: 1),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _LogoAvatar(url: companyLogoUrl, fallbackText: owningCompany, fallbackIcon: Icons.apartment_rounded, size: 22),
                      if (owningCompany?.isNotEmpty ?? false) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            owningCompany!,
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 11, fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
                const SizedBox(height: 10),
                Text(
                  '$greeting, $userName 👋',
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _decorCircle(double size, double alpha) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: alpha)),
  );
}

/// Circular logo badge — shows [url] via [CachedNetworkImage] when present,
/// otherwise a gold initial-letter avatar derived from [fallbackText] so
/// there's never a blank circle even before a project's logos are set up.
class _LogoAvatar extends StatelessWidget {
  final String? url;

  /// When present (and non-empty), the fallback shows this text's first
  /// letter. When null/empty, [fallbackIcon] is shown instead — an initial
  /// letter should only ever come from real data (e.g. the project's own
  /// name), never a guessed/hardcoded label.
  final String? fallbackText;
  final IconData fallbackIcon;
  final double size;

  const _LogoAvatar({
    required this.url,
    this.fallbackText,
    this.fallbackIcon = Icons.business_rounded,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(size * 0.1),
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: ClipOval(
        child: (url == null || url!.isEmpty)
            ? _initial()
            : CachedNetworkImage(
                imageUrl: url!,
                fit: BoxFit.contain,
                placeholder: (_, __) => const SizedBox.shrink(),
                errorWidget: (_, __, ___) => _initial(),
              ),
      ),
    );
  }

  Widget _initial() => Container(
    color: const Color(0xFFC9912A),
    alignment: Alignment.center,
    child: (fallbackText != null && fallbackText!.isNotEmpty)
        ? Text(
            fallbackText![0].toUpperCase(),
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: size * 0.42),
          )
        : Icon(fallbackIcon, color: Colors.white, size: size * 0.5),
  );
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
            if (loaded != null && cards.length > 1) ...[
              const SizedBox(height: 14),
              _InsightsBarChart(cards: cards),
            ],
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

/// Compact horizontal bar-chart card comparing the same counts already
/// shown in the stat card grid above — turns the raw numbers into an
/// at-a-glance "where's the load concentrated" view without any extra
/// network calls (reuses [DashboardCubit]'s already-loaded state) or new
/// charting dependency (plain animated Containers, cheap to build/animate).
class _InsightsBarChart extends StatelessWidget {
  final List<_CardDef> cards;
  const _InsightsBarChart({required this.cards});

  @override
  Widget build(BuildContext context) {
    final maxCount = cards.map((c) => c.count ?? 0).fold(0, (a, b) => a > b ? a : b);
    final total = cards.fold(0, (sum, c) => sum + (c.count ?? 0));

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.insights_rounded, size: 15, color: Color(0xFF6B7280)),
              const SizedBox(width: 6),
              const Text('Insights', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF374151))),
              const Spacer(),
              Text(
                total == 0 ? 'Nothing pending' : '$total total',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF9CA3AF)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (final card in cards) ...[
            _InsightBarRow(def: card, maxCount: maxCount == 0 ? 1 : maxCount),
            if (card != cards.last) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

/// One labelled, animated bar within [_InsightsBarChart] — width is
/// proportional to [def.count] relative to [maxCount] across all cards.
class _InsightBarRow extends StatelessWidget {
  final _CardDef def;
  final int maxCount;
  const _InsightBarRow({required this.def, required this.maxCount});

  @override
  Widget build(BuildContext context) {
    final count = def.count ?? 0;
    final fraction = (count / maxCount).clamp(0.0, 1.0);

    return Row(
      children: [
        SizedBox(
          width: 84,
          child: Text(
            def.label.replaceAll('\n', ' '),
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF4B5563)),
            maxLines: 2,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: Container(
              height: 9,
              color: const Color(0xFFF3F4F6),
              alignment: Alignment.centerLeft,
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: fraction),
                duration: const Duration(milliseconds: 700),
                curve: Curves.easeOutCubic,
                builder: (_, value, __) => FractionallySizedBox(
                  widthFactor: value,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [def.color.withValues(alpha: 0.7), def.color]),
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 20,
          child: Text(
            '$count',
            textAlign: TextAlign.right,
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: count > 0 ? def.color : const Color(0xFF9CA3AF)),
          ),
        ),
      ],
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
                      style: const TextStyle(
                        fontSize: 10,
                        color: Color(0xFF6B7280),
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

/// 4-tile grid for the app's main modules (Progress, Quality, EHS, Design).
/// Everything that used to be a separate top-level tile now lives inside
/// the corresponding hub page — see [ProgressHubPage], [QualityHubPage],
/// [EhsMainHubPage], [DesignHubPage]. A main tile is hidden only when the
/// user has none of that module's underlying permissions; Progress and
/// Design always show since Planning/3D Tower Progress/Design Drawings
/// require no permission.
class _ModuleGrid extends StatelessWidget {
  final Project project;
  final PermissionService ps;

  const _ModuleGrid({required this.project, required this.ps});

  @override
  Widget build(BuildContext context) {
    final showQuality = ps.canRaiseRfi ||
        ps.canReadInspection ||
        ps.hasAnyQualityObsAccess ||
        ps.canReadCubeTest ||
        ps.canReadSnag;
    final showEhs = ps.hasAnyEhsAccess ||
        ps.hasAnyEhsIncidentAccess ||
        ps.canReadEhsDashboard;

    // Pull live counts from the already-loaded DashboardCubit so each
    // module tile can surface its own "insight" badge — e.g. Quality shows
    // how many inspections/observations need attention right now — without
    // any extra network calls.
    return BlocBuilder<DashboardCubit, DashboardState>(
      builder: (context, state) {
        final loaded = state is DashboardLoaded ? state : null;

        final modules = <_ModuleDef>[
          // Progress — reporting, approvals, planning, 3D tower progress, labor.
          // Always shown: Planning/3D Tower Progress require no permission.
          _ModuleDef(
            icon: Icons.timeline_rounded,
            label: 'Progress',
            color: AppColors.moduleProgress,
            count: loaded?.pendingProgressApprovals,
            countLabel: 'pending',
            onTap: () => Navigator.push(context, FadeSlideRoute(
              child: ProgressHubPage(project: project),
            )),
          ),
          // Quality — request, approvals, checklist progress, observations,
          // materials testing, snag/desnag.
          if (showQuality)
            _ModuleDef(
              icon: Icons.verified_rounded,
              label: 'Quality',
              color: AppColors.moduleQuality,
              count: loaded == null ? null : loaded.pendingInspections + loaded.openQualityObs,
              countLabel: 'open',
              onTap: () => Navigator.push(context, FadeSlideRoute(
                child: QualityHubPage(projectId: project.id, projectName: project.name),
              )),
            ),
          // EHS — observations, incidents, EHS hub dashboard.
          if (showEhs)
            _ModuleDef(
              icon: Icons.health_and_safety_outlined,
              label: 'EHS',
              color: AppColors.moduleEhs,
              count: loaded?.openEhsObs,
              countLabel: 'open',
              onTap: () => Navigator.push(context, FadeSlideRoute(
                child: EhsMainHubPage(projectId: project.id, projectName: project.name),
              )),
            ),
          // Design — drawing register. Always shown (available to all users).
          // No live count source for this module — badge stays hidden.
          _ModuleDef(
            icon: Icons.architecture_outlined,
            label: 'Design',
            color: AppColors.moduleDesign,
            onTap: () => Navigator.push(context, FadeSlideRoute(
              child: DesignHubPage(projectId: project.id, projectName: project.name),
            )),
          ),
        ];

        return GridView.builder(
          shrinkWrap: true,
          // Prevent independent scrolling — the parent ListView handles scrolling
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.25,
          ),
          itemCount: modules.length,
          itemBuilder: (_, i) => _ModuleGridItem(def: modules[i]),
        );
      },
    );
  }
}

/// Data class for a single module grid tile definition.
class _ModuleDef {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  /// Live "items needing attention" count for this module, when available —
  /// null hides the badge entirely (loading, or no data source for this
  /// module) rather than showing a misleading 0.
  final int? count;
  final String countLabel;

  const _ModuleDef({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.count,
    this.countLabel = '',
  });
}

/// Renders a single module tile as a vivid gradient card in the module's own
/// accent colour, with a large translucent icon watermark for depth and an
/// optional live count badge — a deliberately bolder look than the old
/// white-card-with-tinted-icon style, so the four modules read as distinct,
/// colourful destinations rather than a plain settings-style menu.
class _ModuleGridItem extends StatelessWidget {
  final _ModuleDef def;
  const _ModuleGridItem({required this.def});

  @override
  Widget build(BuildContext context) {
    final hasCount = (def.count ?? 0) > 0;
    final darker = Color.lerp(def.color, Colors.black, 0.25)!;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: def.onTap,
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              colors: [def.color, darker],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              // Coloured "glow" shadow matching the tile's own accent,
              // rather than a generic grey shadow — reinforces the colour
              // identity even before the eye reaches the tile itself.
              BoxShadow(color: def.color.withValues(alpha: 0.35), blurRadius: 10, offset: const Offset(0, 4)),
            ],
          ),
          child: Stack(
            children: [
              // Oversized, mostly-transparent icon watermark bleeding off
              // the bottom-right corner — purely decorative texture.
              Positioned(
                right: -14,
                bottom: -14,
                child: Icon(def.icon, size: 84, color: Colors.white.withValues(alpha: 0.14)),
              ),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(11),
                          ),
                          child: Icon(def.icon, color: Colors.white, size: 20),
                        ),
                        if (def.count != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: hasCount ? Colors.white : Colors.white.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              '${def.count}',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: hasCount ? darker : Colors.white),
                            ),
                          ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          def.label,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                        if (def.count != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            hasCount ? '${def.count} ${def.countLabel}' : 'All clear',
                            style: TextStyle(fontSize: 10, color: Colors.white.withValues(alpha: 0.85), fontWeight: FontWeight.w600),
                          ),
                        ],
                      ],
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
