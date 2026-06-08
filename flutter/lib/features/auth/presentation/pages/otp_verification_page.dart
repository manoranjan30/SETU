import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/pages/projects_list_page.dart';

/// OTP entry screen shown after the server returns an email OTP challenge.
/// Remains live while the user retries; goes back to login on expiry or cancel.
class OtpVerificationPage extends StatefulWidget {
  final String challengeId;
  final String destinationMasked;
  final int expiresInSeconds;

  const OtpVerificationPage({
    super.key,
    required this.challengeId,
    required this.destinationMasked,
    required this.expiresInSeconds,
  });

  @override
  State<OtpVerificationPage> createState() => _OtpVerificationPageState();
}

class _OtpVerificationPageState extends State<OtpVerificationPage> {
  final _controllers = List.generate(6, (_) => TextEditingController());
  final _focusNodes = List.generate(6, (_) => FocusNode());

  late int _secondsLeft;
  Timer? _timer;

  // Tracks the current challenge ID — may change if page receives a new
  // AuthOtpError that carries updated challenge metadata.
  late String _challengeId;

  @override
  void initState() {
    super.initState();
    _challengeId = widget.challengeId;
    _secondsLeft = widget.expiresInSeconds;
    _startCountdown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _controllers) { c.dispose(); }
    for (final f in _focusNodes) { f.dispose(); }
    super.dispose();
  }

  void _startCountdown() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) {
        t.cancel();
        if (mounted) _onExpired();
      }
    });
  }

  void _onExpired() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('OTP Expired'),
        content: const Text('The verification code has expired. Please log in again.'),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop(); // back to login
            },
            child: const Text('Back to Login'),
          ),
        ],
      ),
    );
  }

  String get _otp => _controllers.map((c) => c.text).join();

  void _submit() {
    if (_otp.length < 6) return;
    context.read<AuthBloc>().add(VerifyOtp(challengeId: _challengeId, otp: _otp));
  }

  void _onDigitChanged(int index, String value) {
    if (value.length == 1 && index < 5) {
      _focusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
    if (_otp.length == 6) _submit();
  }

  // Handle paste — spread pasted digits across boxes.
  void _onPaste(String pasted) {
    final digits = pasted.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 6) return;
    for (int i = 0; i < 6; i++) {
      _controllers[i].text = digits[i];
    }
    _focusNodes[5].requestFocus();
    _submit();
  }

  String get _timerLabel {
    final m = (_secondsLeft ~/ 60).toString().padLeft(2, '0');
    final s = (_secondsLeft % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated) {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const ProjectsListPage()),
            (r) => false,
          );
        } else if (state is AuthOtpError) {
          // Update challenge details so retry uses the right ID.
          setState(() {
            _challengeId = state.challengeId;
            _secondsLeft = state.expiresInSeconds;
            for (final c in _controllers) { c.clear(); }
            _focusNodes[0].requestFocus();
          });
        } else if (state is AuthUnauthenticated) {
          // Session rejected / expired by server — go back to login.
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Verify Your Identity'),
          leading: BackButton(onPressed: () {
            // Cancel OTP — return user to login page cleanly.
            Navigator.of(context).pop();
          }),
        ),
        body: SafeArea(
          child: BlocBuilder<AuthBloc, AuthState>(
            builder: (context, state) {
              final isLoading = state is AuthLoading;
              final errorMsg = state is AuthOtpError ? state.message : null;

              return Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const SizedBox(height: 32),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primaryContainer,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.mark_email_unread_outlined,
                          size: 40, color: theme.colorScheme.primary),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Check your email',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'We sent a 6-digit code to\n${widget.destinationMasked}',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                    ),
                    const SizedBox(height: 32),

                    // ── Six digit boxes ──────────────────────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(6, (i) {
                        return Container(
                          width: 44,
                          height: 54,
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: _controllers[i].text.isNotEmpty
                                  ? theme.colorScheme.primary
                                  : Colors.grey.shade300,
                              width: _focusNodes[i].hasFocus ? 2 : 1.5,
                            ),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(
                            child: TextField(
                              controller: _controllers[i],
                              focusNode: _focusNodes[i],
                              textAlign: TextAlign.center,
                              keyboardType: TextInputType.number,
                              maxLength: 1,
                              enabled: !isLoading,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(1),
                              ],
                              decoration: const InputDecoration(
                                counterText: '',
                                border: InputBorder.none,
                              ),
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                              ),
                              onChanged: (v) {
                                if (v.length > 1) {
                                  _onPaste(v);
                                } else {
                                  setState(() {});
                                  _onDigitChanged(i, v);
                                }
                              },
                            ),
                          ),
                        );
                      }),
                    ),

                    // ── Error message ────────────────────────────────────
                    if (errorMsg != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.error_outline,
                                size: 16, color: Colors.red.shade700),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(errorMsg,
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.red.shade700)),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),

                    // ── Countdown ────────────────────────────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.timer_outlined,
                          size: 15,
                          color: _secondsLeft <= 30
                              ? Colors.red.shade600
                              : Colors.grey.shade500,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Expires in $_timerLabel',
                          style: TextStyle(
                            fontSize: 13,
                            color: _secondsLeft <= 30
                                ? Colors.red.shade600
                                : Colors.grey.shade500,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 28),

                    // ── Verify button ────────────────────────────────────
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: isLoading || _otp.length < 6 || _secondsLeft <= 0
                            ? null
                            : _submit,
                        child: isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Verify Code'),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ── Back to login ────────────────────────────────────
                    TextButton(
                      onPressed: isLoading
                          ? null
                          : () => Navigator.of(context).pop(),
                      child: const Text('Use a different account'),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
