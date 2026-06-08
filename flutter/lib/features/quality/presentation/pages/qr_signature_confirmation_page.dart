import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/widgets/signature_approval_sheet.dart';

/// Confirmation screen for a QR-based digital signature.
/// Fetches session context from the backend, shows card details and signoff
/// information, then posts the user's signature on confirmation.
class QrSignatureConfirmationPage extends StatefulWidget {
  final String token;

  const QrSignatureConfirmationPage({super.key, required this.token});

  @override
  State<QrSignatureConfirmationPage> createState() =>
      _QrSignatureConfirmationPageState();
}

class _QrSignatureConfirmationPageState
    extends State<QrSignatureConfirmationPage> {
  // Session data
  Map<String, dynamic>? _session;
  bool _loading = true;
  String? _loadError;

  // Submission state
  bool _submitting = false;
  bool _success = false;
  String? _submitError;

  // Countdown timer
  Timer? _timer;
  int _secondsLeft = 0;

  @override
  void initState() {
    super.initState();
    _fetchSession();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetchSession() async {
    setState(() { _loading = true; _loadError = null; });
    try {
      final data = await sl<SetuApiClient>().getMobileSignatureSession(widget.token);
      if (!mounted) return;
      final expiresAt = data['expiresAt'] as String?;
      int secs = 300;
      if (expiresAt != null) {
        final exp = DateTime.tryParse(expiresAt);
        if (exp != null) {
          secs = exp.difference(DateTime.now()).inSeconds.clamp(0, 600);
        }
      }
      setState(() {
        _session = data;
        _loading = false;
        _secondsLeft = secs;
      });
      _startCountdown();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = _friendlyError(e);
      });
    }
  }

  void _startCountdown() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) { t.cancel(); }
    });
  }

  Future<void> _confirm({String? signatureData}) async {
    setState(() { _submitting = true; _submitError = null; });
    try {
      await sl<SetuApiClient>().confirmMobileSignatureSession(
        token: widget.token,
        signatureData: signatureData,
      );
      if (!mounted) return;
      setState(() { _submitting = false; _success = true; });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = _friendlyError(e);
      });
    }
  }

  Future<void> _onConfirmTapped() async {
    // Try to confirm — if the server requires a signature, the error will say so;
    // prompt the user to draw one and resubmit.
    await _confirm(signatureData: null);
  }

  Future<void> _onDrawSignatureTapped() async {
    final result = await SignatureApprovalSheet.showForSignoff(
      context,
      department: _signoffDept ?? 'Sign',
      personName: _currentUserName,
    );
    if (result == null || !mounted) return;
    await _confirm(signatureData: result.$1);
  }

  String? get _signoffDept {
    final s = _session?['signoff'] as Map<String, dynamic>?;
    return s?['department'] as String?;
  }

  String? get _currentUserName {
    final auth = context.read<AuthBloc>().state;
    if (auth is AuthAuthenticated) return auth.user.fullName;
    return null;
  }

  String _friendlyError(Object e) {
    final s = e.toString().toLowerCase();
    if (s.contains('expired')) return 'This QR code has expired. Please generate a new one.';
    if (s.contains('already') || s.contains('used')) return 'This QR code has already been used.';
    if (s.contains('locked') || s.contains('approved')) return 'This card is locked and cannot be signed.';
    if (s.contains('signature') && s.contains('required')) {
      return 'A signature is required. Please draw your signature.';
    }
    if (s.contains('connection') || s.contains('socket')) return 'No connection. Check your network.';
    if (s.contains('401') || s.contains('unauthorized')) return 'Session expired. Please log in again.';
    return 'Something went wrong. Please try again.';
  }

  String get _timerLabel {
    final m = (_secondsLeft ~/ 60).toString().padLeft(2, '0');
    final s = (_secondsLeft % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  bool get _isExpired => _secondsLeft <= 0;
  bool get _requiresSignature =>
      _submitError != null && _submitError!.toLowerCase().contains('signature');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign Confirmation')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? _ErrorBody(message: _loadError!, onRetry: _fetchSession)
              : _success
                  ? _SuccessBody(onDone: () => Navigator.of(context).pop())
                  : _buildContent(),
    );
  }

  Widget _buildContent() {
    final session = _session!;
    final card = session['card'] as Map<String, dynamic>? ?? {};
    final signoff = session['signoff'] as Map<String, dynamic>? ?? {};
    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Expiry banner ───────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: _isExpired
                  ? Colors.red.shade50
                  : _secondsLeft <= 60
                      ? Colors.orange.shade50
                      : Colors.green.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: _isExpired
                    ? Colors.red.shade300
                    : _secondsLeft <= 60
                        ? Colors.orange.shade300
                        : Colors.green.shade300,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  _isExpired ? Icons.timer_off_outlined : Icons.timer_outlined,
                  size: 18,
                  color: _isExpired
                      ? Colors.red.shade700
                      : _secondsLeft <= 60
                          ? Colors.orange.shade700
                          : Colors.green.shade700,
                ),
                const SizedBox(width: 8),
                Text(
                  _isExpired
                      ? 'QR code expired'
                      : 'Expires in $_timerLabel',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _isExpired
                        ? Colors.red.shade700
                        : _secondsLeft <= 60
                            ? Colors.orange.shade700
                            : Colors.green.shade700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Card details ────────────────────────────────────────────
          Text('Card Details',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          _DetailCard(
            items: [
              if (card['projectNameSnapshot'] != null)
                _DetailRow('Project', card['projectNameSnapshot'] as String),
              if (card['elementName'] != null)
                _DetailRow('Element', card['elementName'] as String),
              if (card['pourLocation'] != null)
                _DetailRow('Pour Location', card['pourLocation'] as String),
              if (card['gradeOfConcrete'] != null)
                _DetailRow('Grade', card['gradeOfConcrete'] as String),
            ],
          ),
          const SizedBox(height: 16),

          // ── Signoff details ─────────────────────────────────────────
          Text('Signing As',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          _DetailCard(
            items: [
              if (signoff['department'] != null)
                _DetailRow('Department', signoff['department'] as String),
              if (signoff['designation'] != null)
                _DetailRow('Designation', signoff['designation'] as String),
            ],
          ),
          const SizedBox(height: 24),

          // ── Error message ───────────────────────────────────────────
          if (_submitError != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline,
                      size: 18, color: Colors.red.shade700),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_submitError!,
                        style: TextStyle(
                            fontSize: 13, color: Colors.red.shade700)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // ── Action buttons ──────────────────────────────────────────
          if (!_isExpired) ...[
            if (_requiresSignature) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.draw_outlined),
                  label: const Text('Draw & Confirm Signature'),
                  onPressed: _submitting ? null : _onDrawSignatureTapped,
                ),
              ),
            ] else ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.check_circle_outline),
                  label: Text(_submitting ? 'Confirming…' : 'Confirm Signature'),
                  onPressed: _submitting ? null : _onConfirmTapped,
                  style: FilledButton.styleFrom(
                      backgroundColor: Colors.green.shade700),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.draw_outlined),
                  label: const Text('Draw Signature Instead'),
                  onPressed: _submitting ? null : _onDrawSignatureTapped,
                ),
              ),
            ],
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: _submitting
                    ? null
                    : () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
            ),
          ] else ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Close'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Supporting widgets ───────────────────────────────────────────────────────

class _DetailCard extends StatelessWidget {
  final List<_DetailRow> items;
  const _DetailCard({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: items
            .map((r) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 110,
                        child: Text(r.label,
                            style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                                fontWeight: FontWeight.w500)),
                      ),
                      Expanded(
                        child: Text(r.value,
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }
}

class _DetailRow {
  final String label;
  final String value;
  const _DetailRow(this.label, this.value);
}

class _ErrorBody extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorBody({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.qr_code_2, size: 56, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(message,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              onPressed: onRetry,
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SuccessBody extends StatelessWidget {
  final VoidCallback onDone;
  const _SuccessBody({required this.onDone});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.verified_outlined,
                  size: 56, color: Colors.green.shade700),
            ),
            const SizedBox(height: 20),
            const Text('Signature captured successfully',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text('The signoff has been recorded.',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
            const SizedBox(height: 28),
            FilledButton(
              onPressed: onDone,
              style: FilledButton.styleFrom(
                  backgroundColor: Colors.green.shade700),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }
}
