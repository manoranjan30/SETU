import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/theme/app_theme.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/auth/presentation/pages/login_page.dart';
import 'package:setu_mobile/features/projects/presentation/pages/projects_list_page.dart';
import 'package:setu_mobile/injection_container.dart';

class SETUMobileApp extends StatelessWidget {
  const SETUMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (_) => sl<AuthBloc>()..add(CheckAuthStatus()),
        ),
      ],
      child: BlocBuilder<AuthBloc, AuthState>(
        builder: (context, authState) {
          return MaterialApp(
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
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    } else {
      return const LoginPage();
    }
  }
}
