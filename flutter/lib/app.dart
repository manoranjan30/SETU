import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/notifications/notification_service.dart';
import 'package:setu_mobile/core/theme/app_theme.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/auth/presentation/pages/login_page.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/pages/projects_list_page.dart';
import 'package:setu_mobile/injection_container.dart';

class SETUMobileApp extends StatefulWidget {
  const SETUMobileApp({super.key});

  @override
  State<SETUMobileApp> createState() => _SETUMobileAppState();
}

class _SETUMobileAppState extends State<SETUMobileApp> {
  final _navigatorKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    // Handle notification taps — navigate to the relevant screen
    sl<NotificationService>().onNotificationTap = _handleNotificationTap;
  }

  void _handleNotificationTap(String payload) {
    // Pop to the projects list root first so the user is in a clean state.
    _navigatorKey.currentState?.popUntil((route) => route.isFirst);

    // Parse the FCM data payload and show a contextual prompt.
    Map<String, dynamic> data = {};
    try {
      data = jsonDecode(payload) as Map<String, dynamic>;
    } catch (_) {}

    final type = data['type'] as String? ?? '';
    String message;
    Color color;
    IconData icon;

    switch (type) {
      case 'RFI_RAISED':
        message = 'New RFI pending your approval — select a project to review.';
        color = Colors.orange.shade700;
        icon = Icons.assignment_outlined;
        break;
      case 'INSPECTION_APPROVED':
        message = 'Your RFI has been approved — select a project to view.';
        color = Colors.green.shade700;
        icon = Icons.check_circle_outline;
        break;
      case 'INSPECTION_REJECTED':
        message = 'Your RFI was rejected — select a project to view details.';
        color = Colors.red.shade700;
        icon = Icons.cancel_outlined;
        break;
      case 'WORKFLOW_STEP_ASSIGNED':
        message = 'An inspection step is assigned to you — select a project.';
        color = Colors.blue.shade700;
        icon = Icons.pending_actions_outlined;
        break;
      case 'PROGRESS_SUBMITTED':
        message = 'Progress entry submitted — select a project to review.';
        color = Colors.teal.shade700;
        icon = Icons.bar_chart_outlined;
        break;
      default:
        message = 'New SETU notification — select a project to continue.';
        color = Colors.blueGrey.shade700;
        icon = Icons.notifications_outlined;
    }

    final context = _navigatorKey.currentContext;
    if (context == null) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 6),
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
        BlocProvider<AuthBloc>(
          create: (_) => sl<AuthBloc>()..add(CheckAuthStatus()),
        ),
        BlocProvider<ProjectBloc>(
          create: (_) => sl<ProjectBloc>(),
        ),
      ],
      child: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, authState) {
          if (authState is AuthAuthenticated) {
            // Register FCM token with SETU backend after each login
            sl<NotificationService>().registerToken(sl<SetuApiClient>());
          }
        },
        builder: (context, authState) {
          return MaterialApp(
            navigatorKey: _navigatorKey,
            title: 'SETU Mobile',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: ThemeMode.system,
            home: _buildHome(authState),
          );
        },
      ),
    );
  }

  Widget _buildHome(AuthState authState) {
    if (authState is AuthAuthenticated) {
      return const ProjectsListPage();
    } else if (authState is AuthLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    } else {
      return const LoginPage();
    }
  }
}
