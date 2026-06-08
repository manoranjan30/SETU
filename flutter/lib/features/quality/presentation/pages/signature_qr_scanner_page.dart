import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:setu_mobile/features/quality/presentation/pages/qr_signature_confirmation_page.dart';

/// Full-screen QR scanner that recognises SETU signature deep links:
///   setu://signature/confirm?token=<token>
///
/// On a valid scan it pushes [QrSignatureConfirmationPage] directly.
/// Unexpected QR codes show a brief error and resume scanning.
class SignatureQrScannerPage extends StatefulWidget {
  const SignatureQrScannerPage({super.key});

  @override
  State<SignatureQrScannerPage> createState() => _SignatureQrScannerPageState();
}

class _SignatureQrScannerPageState extends State<SignatureQrScannerPage> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    returnImage: false,
  );

  bool _processing = false;
  bool _torchOn = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_processing) return;
    final raw = capture.barcodes.firstOrNull?.rawValue?.trim();
    if (raw == null || raw.isEmpty) return;

    final uri = Uri.tryParse(raw);
    if (uri == null) { _showError('Cannot read QR code.'); return; }

    // Accept the setu:// deep-link format only.
    if (uri.scheme == 'setu' &&
        uri.host == 'signature' &&
        uri.pathSegments.firstOrNull == 'confirm') {
      final token = uri.queryParameters['token'];
      if (token == null || token.isEmpty) {
        _showError('QR code is missing a token.');
        return;
      }
      _handleToken(token);
      return;
    }

    _showError('Not a SETU signature QR code.');
  }

  void _handleToken(String token) {
    _processing = true;
    _controller.stop();
    // Replace this scanner with the confirmation page — user can still go back.
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => QrSignatureConfirmationPage(token: token),
      ),
    );
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.shade700,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan Signature QR'),
        actions: [
          IconButton(
            icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            tooltip: 'Toggle torch',
            onPressed: () {
              _controller.toggleTorch();
              setState(() => _torchOn = !_torchOn);
            },
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_ios_outlined),
            tooltip: 'Flip camera',
            onPressed: _controller.switchCamera,
          ),
        ],
      ),
      body: Stack(
        children: [
          // Live camera feed
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),

          // Scan-frame overlay
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white30, width: 1.5),
                borderRadius: BorderRadius.circular(16),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Stack(children: [
                  _Corner(top: true,  left: true),
                  _Corner(top: true,  left: false),
                  _Corner(top: false, left: true),
                  _Corner(top: false, left: false),
                ]),
              ),
            ),
          ),

          // Animated scan line
          Positioned.fill(
            child: _ScanLine(),
          ),

          // Instruction label
          Positioned(
            bottom: 64,
            left: 0,
            right: 0,
            child: Column(
              children: [
                const Icon(Icons.qr_code_2, color: Colors.white54, size: 32),
                const SizedBox(height: 10),
                const Text(
                  'Point the camera at the signature QR code',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 14),
                ),
                const SizedBox(height: 4),
                Text(
                  'Generated from Pre-Pour Clearance card',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white38, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Corner accent widget (identical to QrScannerPage's _Corner) ──────────────

class _Corner extends StatelessWidget {
  final bool top;
  final bool left;
  const _Corner({required this.top, required this.left});

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top:    top  ? 0 : null,
      bottom: top  ? null : 0,
      left:   left ? 0 : null,
      right:  left ? null : 0,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          border: Border(
            top:    top  ? const BorderSide(color: Colors.greenAccent, width: 3) : BorderSide.none,
            bottom: top  ? BorderSide.none : const BorderSide(color: Colors.greenAccent, width: 3),
            left:   left ? const BorderSide(color: Colors.greenAccent, width: 3) : BorderSide.none,
            right:  left ? BorderSide.none : const BorderSide(color: Colors.greenAccent, width: 3),
          ),
        ),
      ),
    );
  }
}

// ── Animated horizontal scan line ────────────────────────────────────────────

class _ScanLine extends StatefulWidget {
  @override
  State<_ScanLine> createState() => _ScanLineState();
}

class _ScanLineState extends State<_ScanLine>
    with SingleTickerProviderStateMixin {
  late final AnimationController _anim;
  late final Animation<double> _pos;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pos = Tween<double>(begin: 0.3, end: 0.7).animate(
      CurvedAnimation(parent: _anim, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pos,
      builder: (_, __) => Align(
        alignment: Alignment(0, (_pos.value - 0.5) * 2),
        child: Container(
          width: 240,
          height: 2,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Colors.transparent,
                Colors.greenAccent.withValues(alpha: 0.8),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ),
    );
  }
}
