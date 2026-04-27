import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/config/server_config_service.dart';
import 'package:setu_mobile/core/navigation/deep_link_service.dart';
import 'package:setu_mobile/core/notifications/notification_service.dart';
import 'package:setu_mobile/core/theme/app_theme.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/auth/presentation/pages/login_page.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/pages/projects_list_page.dart';
import 'package:setu_mobile/features/server_setup/presentation/pages/server_setup_page.dart';
import 'package:setu_mobile/core/media/photo_cache_manager.dart';
import 'package:setu_mobile/core/update/app_update_service.dart';
import 'package:setu_mobile/injection_container.dart';

/// Root widget of the SETU Mobile application.
///
/// Responsibilities:
/// - Wraps the widget tree in a [MultiBlocProvider] with [AuthBloc] and
///   [ProjectBloc] — these two BLoCs are global because their state (who is
///   logged in, which projects exist) must survive navigation stack changes.
/// - Listens to [AuthBloc] state changes to perform side-effects: register
///   the FCM token after login and clear the photo cache on logout.
/// - Owns the [GlobalKey<NavigatorState>] used by [_handleNotificationTap] to
///   manipulate the navigation stack from outside the widget tree.
/// - Routes the initial screen: [LoginPage], loading spinner, or
///   [ProjectsListPage] based on auth state.
class SETUMobileApp extends StatefulWidget {
  const SETUMobileApp({super.key});

  @override
  State<SETUMobileApp> createState() => _SETUMobileAppState();
}

class _SETUMobileAppState extends State<SETUMobileApp> {
  // A global navigator key is required so that [_handleNotificationTap] can
  // push routes and show SnackBars from outside the build tree (the callback
  // is set in initState, before any context is available).
  final _navigatorKey = GlobalKey<NavigatorState>();

  // Cached once in initState so that repeated auth-state rebuilds do not
  // restart the SharedPreferences lookup and flash a loading spinner each time.
  late final Future<bool> _isServerConfigured;

  @override
  void initState() {
    super.initState();
    _isServerConfigured = ServerConfigService.instance.isConfigured();
    sl<NotificationService>().onNotificationTap = _handleNotificationTap;
    _checkForUpdate();
  }

  /// Checks the backend for a newer or mandatory app version.
  /// Shows a non-dismissible dialog on force update; a dismissible one otherwise.
  Future<void> _checkForUpdate() async {
    final result = await sl<AppUpdateService>().checkForUpdate();
    if (!result.hasUpdate) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _navigatorKey.currentContext;
      if (ctx == null) return;

      showDialog(
        context: ctx,
        barrierDismissible: !result.isForced,
        builder: (_) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Icon(
                result.isForced
                    ? Icons.system_update_outlined
                    : Icons.new_releases_outlined,
                color: result.isForced ? Colors.red : Colors.blue,
                size: 22,
              ),
              const SizedBox(width: 8),
              Text(
                result.isForced ? 'Update Required' : 'Update Available',
                style: const TextStyle(fontSize: 17),
              ),
            ],
          ),
          content: Text(
            result.message ??
                (result.isForced
                    ? 'This version is no longer supported. Please update SETU to continue.'
                    : 'A newer version of SETU is available. Update for the latest features and fixes.'),
            style: const TextStyle(fontSize: 14),
          ),
          actions: [
            if (!result.isForced)
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Later'),
              ),
            ElevatedButton.icon(
              icon: const Icon(Icons.download_outlined, size: 18),
              label: const Text('Update Now'),
              onPressed: () {
                // Show the URL in a snackbar — user can copy and open in browser,
                // or admin can configure the updateUrl to an auto-download link.
                Navigator.of(ctx).pop();
                if (result.updateUrl != null) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    SnackBar(
                      content: Text('Download: ${result.updateUrl}'),
                      duration: const Duration(seconds: 10),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
            ),
          ],
        ),
      );
    });
  }

  /// Handles a notification tap from any of the three FCM delivery scenarios
  /// (foreground local notification, background system tray, cold start).
  ///
  /// Steps:
  /// 1. Pop all routes back to root ([ProjectsListPage]) so the user starts
  ///    from a clean state rather than landing mid-stack.
  /// 2. Decode the FCM data payload.
  /// 3. Build a [PendingDeepLink] and store it in [DeepLinkService] — the
  ///    [ProjectsListPage] listener will pick it up and navigate automatically.
  /// 4. Show a contextual [SnackBar] that describes why navigation happened,
  ///    giving the user immediate feedback before the project list loads.
  void _handleNotificationTap(String payload) {
    // Pop to the projects list root first so the user is in a clean state.
    _navigatorKey.currentState?.popUntil((route) => route.isFirst);

    // Parse the FCM data payload and show a contextual prompt.
    Map<String, dynamic> data = {};
    try {
      data = jsonDecode(payload) as Map<String, dynamic>;
    } catch (_) {
      // Malformed payload — continue with an empty map so the default
      // SnackBar message is shown rather than crashing.
    }

    // Set pending deep link so ProjectsListPage can auto-navigate.
    // projectId and resourceId may be absent for some notification types
    // (e.g. STRATEGY_ACTIVATED has no single resource), hence the null guards.
    final type = data['type'] as String? ?? '';
    final projectId = data['projectId'] != null
        ? int.tryParse(data['projectId'].toString())
        : null;
    // resourceId can come from several fields depending on the notification type.
    final resourceId = data['observationId'] as String? ??
        data['incidentId'] as String? ??
        data['inspectionId'] as String?;
    if (type.isNotEmpty && projectId != null) {
      // Only set a deep link when we have enough data to navigate meaningfully.
      DeepLinkService.instance.set(PendingDeepLink(
        type: type,
        projectId: projectId,
        resourceId: resourceId,
      ));
    }

    String message;
    Color color;
    IconData icon;

    switch (type) {
      // ── RFI / Workflow ──────────────────────────────────────────────────────
      case 'RFI_RAISED':
      case 'PENDING_APPROVAL':
        message = 'New RFI pending your approval — select a project to review.';
        color = Colors.orange.shade700;
        icon = Icons.assignment_outlined;
        break;
      case 'INSPECTION_APPROVED':
      case 'APPROVED':
      case 'RFI_APPROVED':
      case 'RFI_FULLY_APPROVED':
      case 'STAGE_APPROVED':
        message = 'Your RFI has been approved — select a project to view.';
        color = Colors.green.shade700;
        icon = Icons.check_circle_outline;
        break;
      case 'INSPECTION_REJECTED':
      case 'REJECTED':
      case 'RFI_WORKFLOW_REJECTED':
        message = 'Your RFI was rejected — select a project to view details.';
        color = Colors.red.shade700;
        icon = Icons.cancel_outlined;
        break;
      case 'RFI_APPROVAL_REVERSED':
        message = 'Your RFI approval was reversed — please resubmit.';
        color = Colors.deepOrange.shade700;
        icon = Icons.undo_rounded;
        break;
      case 'STAGE_LEVEL_PENDING':
        message = 'Stage approval required — select a project to review.';
        color = Colors.orange.shade700;
        icon = Icons.pending_actions_outlined;
        break;
      case 'WORKFLOW_STEP_ASSIGNED':
        message = 'An inspection step is assigned to you — select a project.';
        color = Colors.blue.shade700;
        icon = Icons.pending_actions_outlined;
        break;
      case 'WORKFLOW_DELEGATED':
        message = 'An RFI approval step has been delegated to you.';
        color = Colors.indigo.shade700;
        icon = Icons.swap_horiz_rounded;
        break;
      case 'WORKFLOW_REVERSED':
        message = 'An approved RFI has been reversed by admin — please resubmit.';
        color = Colors.deepOrange.shade700;
        icon = Icons.undo_rounded;
        break;
      // ── Progress ────────────────────────────────────────────────────────────
      case 'PROGRESS_SUBMITTED':
        message = 'Progress entry submitted — select a project to review.';
        color = Colors.teal.shade700;
        icon = Icons.bar_chart_outlined;
        break;
      case 'PROGRESS_APPROVED':
      case 'PROGRESS_REJECTED':
        message = type == 'PROGRESS_APPROVED'
            ? 'Your progress entry was approved.'
            : 'Your progress entry was rejected — select a project to view.';
        color = type == 'PROGRESS_APPROVED'
            ? Colors.green.shade700
            : Colors.red.shade700;
        icon = type == 'PROGRESS_APPROVED'
            ? Icons.check_circle_outline
            : Icons.cancel_outlined;
        break;
      // ── Quality Observations ────────────────────────────────────────────────
      case 'QUALITY_OBS_RAISED':
        {
          // Include severity in the message when available so the recipient
          // can gauge urgency without opening the app.
          final severity = data['severity'] ?? '';
          message = severity.isNotEmpty
              ? '$severity quality observation raised — immediate attention required.'
              : 'New quality observation raised — select a project to view.';
          // CRITICAL observations get a darker red to signal higher urgency.
          color = severity == 'CRITICAL'
              ? Colors.red.shade900
              : Colors.orange.shade800;
          icon = Icons.warning_amber_rounded;
        }
        break;
      case 'OBS_RECTIFIED':
        message = 'Your quality observation has been rectified — please review and close.';
        color = Colors.blue.shade700;
        icon = Icons.build_circle_outlined;
        break;
      case 'OBS_CLOSED':
        message = 'Your quality observation has been closed.';
        color = Colors.green.shade700;
        icon = Icons.check_circle_outline;
        break;
      // ── EHS ─────────────────────────────────────────────────────────────────
      case 'EHS_OBS_CRITICAL':
        {
          // Same severity-in-message pattern as quality observations.
          final ehsSeverity = data['severity'] ?? '';
          message = ehsSeverity.isNotEmpty
              ? '$ehsSeverity EHS observation raised — immediate action required.'
              : 'Critical EHS observation raised — select a project to view.';
          color = Colors.red.shade900;
          icon = Icons.health_and_safety_outlined;
        }
        break;
      case 'EHS_OBS_RECTIFIED':
        message = 'Your EHS observation has been rectified — please review and close.';
        color = Colors.blue.shade700;
        icon = Icons.build_circle_outlined;
        break;
      case 'EHS_OBS_CLOSED':
        message = 'Your EHS observation has been closed.';
        color = Colors.green.shade700;
        icon = Icons.check_circle_outline;
        break;
      // ── Release Strategy ────────────────────────────────────────────────────
      case 'STRATEGY_ACTIVATED':
        {
          // Strategy name is included to disambiguate when multiple strategies exist.
          final strategyName = data['strategyName'] ?? 'Approval strategy';
          message = '"$strategyName" is now active — approval workflows updated.';
          color = Colors.purple.shade700;
          icon = Icons.account_tree_outlined;
        }
        break;
      // ── Default ─────────────────────────────────────────────────────────────
      default:
        // Catch-all for future notification types not yet handled here.
        message = 'New SETU notification — select a project to continue.';
        color = Colors.blueGrey.shade700;
        icon = Icons.notifications_outlined;
    }

    // Guard against the edge case where the context is no longer mounted
    // (e.g. the widget was disposed between the tap and this callback firing).
    final context = _navigatorKey.currentContext;
    if (context == null) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 6), // 6 s gives time to read before acting
        content: Row(
          children: [
            Icon(icon, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        // AuthBloc is provided here (not in main) so that BlocConsumer below
        // can listen to it.  CheckAuthStatus is dispatched immediately so the
        // bloc evaluates the stored token before the first frame renders.
        BlocProvider<AuthBloc>(
          create: (_) => sl<AuthBloc>()..add(CheckAuthStatus()),
        ),
        // ProjectBloc is provided globally so that it persists across
        // navigation stack changes (e.g. popping back to the project list
        // reuses the already-loaded project data).
        BlocProvider<ProjectBloc>(
          create: (_) => sl<ProjectBloc>(),
        ),
      ],
      child: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, authState) {
          if (authState is AuthAuthenticated) {
            // Register FCM token with SETU backend after each login
            // so push notifications are routed to this device+user pair.
            sl<NotificationService>().registerToken(sl<SetuApiClient>());
          } else if (authState is AuthUnauthenticated) {
            // Clear photo cache on logout — frees ~150 MB of device storage
            // that accumulated from viewing site photos during the session.
            SetuPhotoCacheManager().emptyCache();
            // Remove FCM token from backend so this device stops receiving
            // push notifications until the next login registers a fresh token.
            sl<SetuApiClient>().clearFcmToken().catchError((_) {});
          } else if (authState is AuthError) {
            // When AuthLoading fires, _buildHome replaces LoginPage with a
            // full-screen spinner, unmounting LoginPage's BlocConsumer.
            // That means LoginPage's own error dialog listener never fires.
            // Handle it here so the user always gets feedback on login failure.
            WidgetsBinding.instance.addPostFrameCallback((_) {
              final ctx = _navigatorKey.currentContext;
              if (ctx == null) return;
              showDialog(
                context: ctx,
                builder: (_) => AlertDialog(
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16)),
                  title: const Row(
                    children: [
                      Icon(Icons.error_outline, color: Colors.red, size: 20),
                      SizedBox(width: 8),
                      Text('Login Failed',
                          style: TextStyle(fontSize: 17)),
                    ],
                  ),
                  content: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(authState.message,
                          style: const TextStyle(fontSize: 14)),
                      const SizedBox(height: 16),
                      const Divider(),
                      const SizedBox(height: 8),
                      const Text('Troubleshooting Tips:',
                          style: TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 12)),
                      const SizedBox(height: 4),
                      const Text(
                        '• Ensure phone is on same WiFi as server\n'
                        '• Check server is running (docker ps)\n'
                        '• Verify firewall allows the backend port',
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('OK'),
                    ),
                  ],
                ),
              );
            });
          }
        },
        builder: (context, authState) {
          return MaterialApp(
            navigatorKey: _navigatorKey, // Enables navigation from outside widget tree
            title: 'SETU Mobile',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: ThemeMode.system, // Respects the device's dark/light preference
            home: _buildHome(authState),
          );
        },
      ),
    );
  }

  /// Resolves the initial (home) screen based on the current [AuthState].
  ///
  /// - [AuthAuthenticated]: user has a valid token → show project list.
  /// - [AuthLoading]: token check in progress → show a spinner to avoid flicker.
  /// - [AuthUnauthenticated] on first launch (no server configured) →
  ///     show [ServerSetupPage] so the user picks a backend before logging in.
  /// - Any other state: show login page.
  Widget _buildHome(AuthState authState) {
    if (authState is AuthAuthenticated) {
      return const ProjectsListPage();
    } else if (authState is AuthLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    } else {
      // On very first launch (no server saved) show server setup page first.
      // FutureBuilder avoids blocking the build — shows a short spinner then
      // routes to either ServerSetupPage or LoginPage.
      return FutureBuilder<bool>(
        future: _isServerConfigured,
        builder: (context, snap) {
          if (!snap.hasData) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          // Not configured yet → mandatory server setup (canPop=false)
          if (!snap.data!) {
            return const ServerSetupPage(canPop: false);
          }
          return const LoginPage();
        },
      );
    }
  }
}
