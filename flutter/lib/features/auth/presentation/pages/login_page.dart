import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/theme/app_dimensions.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/pages/projects_list_page.dart';
import 'package:setu_mobile/features/server_setup/presentation/pages/server_setup_page.dart';

/// The app's entry screen.
/// Divided into two sections: a cream-coloured brand panel (42% of screen
/// height) at the top, and a white rounded card (58%) at the bottom that
/// holds the login form.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  // Form key used to trigger validation before dispatching the login event
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();

  // Controls whether the password field shows dots or plain text
  bool _obscurePassword = true;

  // Mirrors AuthLoading state to disable the form while a request is in-flight
  bool _isLoading = false;

  @override
  void dispose() {
    // Release text-editing resources when the page is removed from the tree
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// Validates the form then fires the [Login] event on [AuthBloc].
  /// Trimming the username prevents accidental leading/trailing spaces.
  void _handleLogin() {
    if (_formKey.currentState!.validate()) {
      context.read<AuthBloc>().add(Login(
            username: _usernameController.text.trim(),
            password: _passwordController.text,
          ));
    }
  }

  /// Shows an [AlertDialog] describing why the login attempt failed.
  /// Includes troubleshooting tips relevant to the on-premise Docker setup.
  void _showErrorDialog(BuildContext context, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.error_outline, color: AppColors.error, size: 20),
            SizedBox(width: 8),
            Text('Login Failed', style: TextStyle(fontSize: 17)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Display the actual error message from the auth bloc
            Text(message, style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
            // Static troubleshooting hints for field engineers
            const Text('Troubleshooting Tips:',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
            const SizedBox(height: 4),
            const Text(
              '• Ensure phone is on same WiFi as server\n'
              '• Check server is running (docker ps)\n'
              '• Verify firewall allows the backend port',
              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      // Server settings icon — top-right, visible above the brand section.
      // Lets testers switch backend URL without rebuilding the APK.
      floatingActionButton: FloatingActionButton.small(
        heroTag: 'server_settings',
        tooltip: 'Server Settings',
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.textSecondary,
        elevation: 1,
        onPressed: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const ServerSetupPage(canPop: true),
            ),
          );
          // Rebuild so _buildServerInfo() reflects any URL change
          if (mounted) setState(() {});
        },
        child: const Icon(Icons.settings_ethernet, size: 18),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endTop,
      body: BlocConsumer<AuthBloc, AuthState>(
        // Listener reacts to side-effects: navigate on success, show error on failure
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const ProjectsListPage()),
              (route) => false,
            );
          } else if (state is AuthError) {
            _showErrorDialog(context, state.message);
          }
        },
        builder: (context, state) {
          // Keep _isLoading in sync so the form / button disable correctly
          _isLoading = state is AuthLoading;
          return SafeArea(
            child: Column(
              children: [
                // ── Top brand section (cream background, 42% height) ──────────
                Expanded(
                  flex: 42,
                  child: Container(
                    color: AppColors.background,
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(32, 32, 32, 0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // App icon badge
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.construction_rounded,
                            size: 30,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 20),
                        // App name
                        const Text(
                          'SETU',
                          style: TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            letterSpacing: -1.0,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(height: 6),
                        // App tagline
                        const Text(
                          'Construction Project Management',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                            letterSpacing: 0.1,
                          ),
                        ),
                        const SizedBox(height: 28),
                      ],
                    ),
                  ),
                ),

                // ── Bottom form card (white rounded surface, 58% height) ──────
                Expanded(
                  flex: 58,
                  child: Container(
                    decoration: const BoxDecoration(
                      color: AppColors.surface,
                      // Rounded top corners create the "card floats over brand"
                      // visual effect
                      borderRadius:
                          BorderRadius.vertical(top: Radius.circular(28)),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.shadowColorMd,
                          blurRadius: 24,
                          offset: Offset(0, -4),
                        ),
                      ],
                    ),
                    child: SingleChildScrollView(
                      padding:
                          const EdgeInsets.fromLTRB(28, 32, 28, 24),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'Sign in to continue',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                                letterSpacing: -0.3,
                              ),
                            ),
                            const SizedBox(height: 24),

                            // ── Username field ────────────────────────────────
                            TextFormField(
                              controller: _usernameController,
                              // Disable field while login is in-flight
                              enabled: !_isLoading,
                              decoration: const InputDecoration(
                                labelText: 'Username',
                                prefixIcon:
                                    Icon(Icons.person_outline_rounded),
                              ),
                              // Advance focus to the password field on "next"
                              textInputAction: TextInputAction.next,
                              validator: (v) => (v == null || v.trim().isEmpty)
                                  ? 'Required'
                                  : null,
                            ),
                            const SizedBox(height: 16),

                            // ── Password field ────────────────────────────────
                            TextFormField(
                              controller: _passwordController,
                              enabled: !_isLoading,
                              // Toggle between obscured and plain text
                              obscureText: _obscurePassword,
                              decoration: InputDecoration(
                                labelText: 'Password',
                                prefixIcon:
                                    const Icon(Icons.lock_outline_rounded),
                                // Eye icon toggles password visibility
                                suffixIcon: IconButton(
                                  icon: Icon(_obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined),
                                  onPressed: () => setState(
                                      () => _obscurePassword = !_obscurePassword),
                                ),
                              ),
                              // Submit the form when user presses "done" on the
                              // keyboard — avoids needing to tap the button
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _handleLogin(),
                              validator: (v) =>
                                  (v == null || v.isEmpty) ? 'Required' : null,
                            ),
                            const SizedBox(height: 28),

                            // ── Login button ──────────────────────────────────
                            SizedBox(
                              height: AppDimensions.buttonHeight,
                              child: ElevatedButton(
                                // Disabled while loading; prevents double-submit
                                onPressed: _isLoading ? null : _handleLogin,
                                child: _isLoading
                                    // Show spinner while auth request is pending
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.5,
                                          valueColor: AlwaysStoppedAnimation(
                                              Colors.white),
                                        ),
                                      )
                                    : const Text('Login'),
                              ),
                            ),
                            const SizedBox(height: 20),

                            // ── Server info footer ────────────────────────────
                            // Shows the currently configured API host:port so
                            // engineers can verify they're pointing at the right
                            // backend instance
                            _buildServerInfo(),
                            const SizedBox(height: 16),

                            // App version + copyright notice
                            const Center(
                              child: Text(
                                'Version 1.1.0  ·  © 2026 SETU',
                                style: TextStyle(
                                    fontSize: 11, color: AppColors.textHint),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  /// Parses [ApiEndpoints.baseUrl] and renders the host + port in a small
  /// monospace chip at the bottom of the form card.
  /// Helps field engineers confirm which server the app is talking to.
  Widget _buildServerInfo() {
    final uri = Uri.tryParse(ApiEndpoints.baseUrl);
    final host = uri?.host ?? ApiEndpoints.baseUrl;
    final port = uri?.port ?? 0;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.dns_outlined, size: 13, color: AppColors.textHint),
        const SizedBox(width: 6),
        Text(
          // Only append port if one is explicitly present in the URL
          port > 0 ? '$host:$port' : host,
          style: const TextStyle(
            fontSize: 11,
            color: AppColors.textHint,
            fontFamily: 'monospace',
          ),
        ),
      ],
    );
  }
}
