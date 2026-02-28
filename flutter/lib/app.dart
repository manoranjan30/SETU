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
    // payload is JSON from the FCM data field
    // e.g. {"type":"rfi_raised","projectId":"1","inspectionId":"42"}
    // Currently navigates to root; deep-link per type can be added later.
    _navigatorKey.currentState?.popUntil((route) => route.isFirst);
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
