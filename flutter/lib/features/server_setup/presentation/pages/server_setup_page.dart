import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/config/server_config_service.dart';
import 'package:setu_mobile/features/auth/presentation/pages/login_page.dart';
import 'package:setu_mobile/features/server_setup/presentation/pages/qr_scanner_page.dart';
import 'package:setu_mobile/injection_container.dart';

/// Pre-login screen that lets the user pick which backend server to connect to.
///
/// Options:
///  1. Dev Default  — compile-time dart-define URL (no edit)
///  2. Cloudflare Tunnel — editable text field + QR scan
///  3. Custom / LAN IP  — editable text field + QR scan
///
/// Recent URLs are shown as dismissible chips for fast re-selection.
/// A "Test Connection" button pings the server before committing.
class ServerSetupPage extends StatefulWidget {
  /// When true the page shows a back arrow (opened from login settings icon).
  /// When false it shows no back arrow (first-launch mandatory setup).
  final bool canPop;

  const ServerSetupPage({super.key, this.canPop = true});

  @override
  State<ServerSetupPage> createState() => _ServerSetupPageState();
}

class _ServerSetupPageState extends State<ServerSetupPage> {
  final _svc = ServerConfigService.instance;

  // Which preset tile is selected (0 = Dev Default, 1 = Cloudflare, 2 = Custom)
  int _selectedIndex = 0;

  // Controllers for editable fields (indices 1 & 2)
  final _cfCtrl     = TextEditingController();
  final _customCtrl = TextEditingController();

  List<String> _recentUrls = [];
  bool _testing   = false;
  bool _saving    = false;
  String? _testResult;  // null = not tested, '' = ok, else error msg
  bool _testOk    = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _cfCtrl.dispose();
    _customCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final recent  = await _svc.getRecentUrls();
    final current = await _svc.getSavedUrl();

    setState(() {
      _recentUrls = recent;
      // Pre-fill whichever field matches the saved URL
      if (current != null && current != ApiEndpoints.compileTimeUrl) {
        final isCf = current.contains('trycloudflare') ||
                     current.contains('cloudflare');
        if (isCf) {
          _selectedIndex = 1;
          _cfCtrl.text = current;
        } else {
          _selectedIndex = 2;
          _customCtrl.text = current;
        }
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /// Active URL based on selected preset + text field value.
  String get _activeUrl {
    switch (_selectedIndex) {
      case 0:  return ApiEndpoints.compileTimeUrl;
      case 1:  return _cfCtrl.text.trim();
      case 2:  return _customCtrl.text.trim();
      default: return ApiEndpoints.compileTimeUrl;
    }
  }

  /// Fills the currently selected editable field with [url].
  void _fillField(String url) {
    setState(() {
      _testResult = null;
      _testOk = false;
      if (_selectedIndex == 1) {
        _cfCtrl.text = url;
      } else {
        _selectedIndex = 2;
        _customCtrl.text = url;
      }
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  Future<void> _scanQr() async {
    final url = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const QrScannerPage()),
    );
    if (url != null && mounted) _fillField(url);
  }

  Future<void> _testConnection() async {
    final url = _activeUrl;
    if (url.isEmpty) {
      _showSnack('Enter a URL first', isError: true);
      return;
    }

    setState(() { _testing = true; _testResult = null; _testOk = false; });

    try {
      // Strip /api suffix for the health check since NestJS serves health at root
      final base   = url.endsWith('/api') ? url.substring(0, url.length - 4) : url;
      final health = '$base/health';

      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
      ));
      final sw = Stopwatch()..start();
      await dio.get(health);
      sw.stop();

      setState(() {
        _testOk     = true;
        _testResult = 'Connected in ${sw.elapsedMilliseconds} ms';
      });
    } on DioException catch (e) {
      // A 401/404 still means the server is reachable — network is fine
      final code = e.response?.statusCode;
      if (code != null && code < 500) {
        setState(() {
          _testOk     = true;
          _testResult = 'Server reachable (HTTP $code)';
        });
      } else {
        setState(() {
          _testOk     = false;
          _testResult = e.message ?? 'Connection failed';
        });
      }
    } catch (e) {
      setState(() {
        _testOk     = false;
        _testResult = e.toString();
      });
    } finally {
      setState(() => _testing = false);
    }
  }

  Future<void> _connect() async {
    final url = _activeUrl;
    if (url.isEmpty) {
      _showSnack('Enter a server URL', isError: true);
      return;
    }

    setState(() => _saving = true);
    await _svc.saveUrl(
      url,
      apiClientUpdateCallback: sl<SetuApiClient>().updateBaseUrl,
    );
    setState(() {
      _saving = false;
      _recentUrls = []; // will reload
    });
    await _load();

    if (!mounted) return;
    if (widget.canPop) {
      Navigator.of(context).pop(true); // return true = URL was changed
    } else {
      // First-launch: replace the setup page with LoginPage
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginPage()),
      );
    }
  }

  Future<void> _removeRecent(String url) async {
    await _svc.removeRecent(url);
    final updated = await _svc.getRecentUrls();
    if (mounted) setState(() => _recentUrls = updated);
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? Colors.red.shade700 : Colors.green.shade700,
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme  = Theme.of(context);
    final scheme = theme.colorScheme;

    return PopScope(
      canPop: widget.canPop,
      child: Scaffold(
        backgroundColor: scheme.surfaceContainerLowest,
        appBar: AppBar(
          backgroundColor: scheme.surfaceContainerLowest,
          automaticallyImplyLeading: widget.canPop,
          title: const Text('Server Connection'),
          actions: [
            IconButton(
              icon: const Icon(Icons.qr_code_scanner_outlined),
              tooltip: 'Scan QR Code',
              onPressed: _scanQr,
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [

            // ── Current connection banner ──────────────────────────────────
            _CurrentBanner(),
            const SizedBox(height: 20),

            // ── Section: Presets ──────────────────────────────────────────
            _SectionLabel('Choose Connection Type'),
            const SizedBox(height: 8),
            _buildPresetTile(
              index:    0,
              icon:     Icons.computer_outlined,
              label:    'Dev Default',
              subtitle: ApiEndpoints.compileTimeUrl,
            ),
            const SizedBox(height: 8),
            _buildPresetTile(
              index:     1,
              icon:      Icons.cloud_outlined,
              label:     'Cloudflare Tunnel',
              subtitle:  'Temporary public HTTPS URL',
              controller: _cfCtrl,
              hint:       'https://xxxx.trycloudflare.com/api',
            ),
            const SizedBox(height: 8),
            _buildPresetTile(
              index:      2,
              icon:       Icons.router_outlined,
              label:      'Custom / LAN IP',
              subtitle:   'Local network or custom server',
              controller: _customCtrl,
              hint:       'http://192.168.x.x:3000/api',
            ),

            // ── Section: Recently used ────────────────────────────────────
            if (_recentUrls.isNotEmpty) ...[
              const SizedBox(height: 24),
              _SectionLabel('Recently Used'),
              const SizedBox(height: 8),
              _buildRecentList(),
            ],

            // ── Test result ───────────────────────────────────────────────
            if (_testResult != null) ...[
              const SizedBox(height: 20),
              _TestResultBanner(ok: _testOk, message: _testResult!),
            ],

            const SizedBox(height: 28),

            // ── Buttons ───────────────────────────────────────────────────
            Row(
              children: [
                // Test Connection
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _testing ? null : _testConnection,
                    icon: _testing
                        ? const SizedBox(
                            width: 14, height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.wifi_find_outlined, size: 16),
                    label: Text(_testing ? 'Testing…' : 'Test Connection'),
                  ),
                ),
                const SizedBox(width: 12),
                // Connect
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _connect,
                    icon: _saving
                        ? const SizedBox(
                            width: 14, height: 14,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.check_circle_outline, size: 16),
                    label: Text(_saving ? 'Saving…' : 'Connect & Continue'),
                  ),
                ),
              ],
            ),

            // ── Cloudflare hint ───────────────────────────────────────────
            const SizedBox(height: 24),
            _CloudflareHint(),
          ],
        ),
      ),
    );
  }

  // ── Preset tile ───────────────────────────────────────────────────────────

  Widget _buildPresetTile({
    required int        index,
    required IconData   icon,
    required String     label,
    required String     subtitle,
    TextEditingController? controller,
    String              hint = '',
  }) {
    final selected = _selectedIndex == index;
    final scheme   = Theme.of(context).colorScheme;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        color:        selected ? scheme.primaryContainer : scheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: selected ? scheme.primary : scheme.outlineVariant,
          width: selected ? 2 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => setState(() {
          _selectedIndex = index;
          _testResult    = null;
          _testOk        = false;
        }),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon,
                      size: 20,
                      color: selected ? scheme.primary : scheme.onSurfaceVariant),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(label,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: selected
                              ? scheme.onPrimaryContainer
                              : scheme.onSurface,
                        )),
                  ),
                  if (selected)
                    Icon(Icons.radio_button_checked,
                        size: 18, color: scheme.primary)
                  else
                    Icon(Icons.radio_button_off,
                        size: 18, color: scheme.outlineVariant),
                ],
              ),
              const SizedBox(height: 4),
              Padding(
                padding: const EdgeInsets.only(left: 30),
                child: Text(subtitle,
                    style: TextStyle(
                      fontSize: 11,
                      color: selected
                          ? scheme.onPrimaryContainer.withValues(alpha: 0.7)
                          : scheme.onSurfaceVariant,
                    )),
              ),

              // Editable URL field (only for Cloudflare and Custom tiles)
              if (controller != null && selected) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: controller,
                        onChanged: (_) => setState(
                            () { _testResult = null; _testOk = false; }),
                        decoration: InputDecoration(
                          hintText: hint,
                          hintStyle: const TextStyle(fontSize: 12),
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8)),
                          suffixIcon: controller.text.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear, size: 16),
                                  onPressed: () =>
                                      setState(() => controller.clear()),
                                )
                              : null,
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                        style: const TextStyle(
                            fontSize: 13, fontFamily: 'monospace'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // QR scan shortcut
                    IconButton.outlined(
                      icon: const Icon(Icons.qr_code_scanner, size: 20),
                      tooltip: 'Scan QR',
                      onPressed: _scanQr,
                    ),
                    // Paste from clipboard
                    IconButton.outlined(
                      icon: const Icon(Icons.content_paste_rounded, size: 18),
                      tooltip: 'Paste',
                      onPressed: () async {
                        final data = await Clipboard.getData('text/plain');
                        final text = data?.text?.trim() ?? '';
                        if (text.isNotEmpty) _fillField(text);
                      },
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // ── Recent URLs list ──────────────────────────────────────────────────────

  Widget _buildRecentList() {
    return Column(
      children: _recentUrls.map((url) {
        final isCurrent = url == ApiEndpoints.baseUrl;
        return Dismissible(
          key: ValueKey(url),
          direction: DismissDirection.endToStart,
          background: Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 16),
            decoration: BoxDecoration(
              color: Colors.red.shade100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.delete_outline, color: Colors.red),
          ),
          onDismissed: (_) => _removeRecent(url),
          child: Container(
            margin: const EdgeInsets.only(bottom: 6),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isCurrent
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.outlineVariant,
              ),
            ),
            child: ListTile(
              dense: true,
              leading: Icon(
                isCurrent ? Icons.check_circle : Icons.history,
                size: 18,
                color: isCurrent
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              title: Text(
                url,
                style: const TextStyle(
                    fontSize: 12, fontFamily: 'monospace'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: isCurrent
                  ? Text('Currently active',
                      style: TextStyle(
                          fontSize: 10,
                          color: Theme.of(context).colorScheme.primary))
                  : null,
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Use this URL button
                  TextButton(
                    style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8)),
                    onPressed: () => _fillField(url),
                    child: const Text('Use', style: TextStyle(fontSize: 12)),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ── Supporting widgets ────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: Theme.of(context).colorScheme.primary,
        ),
      );
}

class _CurrentBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final url    = ApiEndpoints.baseUrl;
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color:        scheme.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.dns_outlined, size: 16, color: scheme.onSecondaryContainer),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Currently connected to',
                    style: TextStyle(
                        fontSize: 10, color: scheme.onSecondaryContainer)),
                Text(url,
                    style: TextStyle(
                      fontSize: 12,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w600,
                      color: scheme.onSecondaryContainer,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TestResultBanner extends StatelessWidget {
  final bool ok;
  final String message;
  const _TestResultBanner({required this.ok, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: ok ? Colors.green.shade50 : Colors.red.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: ok ? Colors.green.shade300 : Colors.red.shade300),
      ),
      child: Row(
        children: [
          Icon(
            ok ? Icons.check_circle_outline : Icons.error_outline,
            size: 18,
            color: ok ? Colors.green.shade700 : Colors.red.shade700,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 12,
                color: ok ? Colors.green.shade800 : Colors.red.shade800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CloudflareHint extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_outline,
                  size: 14, color: Colors.orange.shade700),
              const SizedBox(width: 6),
              Text('How to get a Cloudflare Tunnel URL',
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                      color: Colors.orange.shade800)),
            ],
          ),
          const SizedBox(height: 6),
          _HintLine('1. Install: winget install cloudflare.cloudflared'),
          _HintLine('2. Run: cloudflared tunnel --url http://localhost:3000'),
          _HintLine('3. Copy the https://xxxx.trycloudflare.com URL'),
          _HintLine('4. Generate a QR from that URL and scan above'),
        ],
      ),
    );
  }
}

class _HintLine extends StatelessWidget {
  final String text;
  const _HintLine(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 11,
            fontFamily: 'monospace',
            color: Colors.orange.shade900,
          ),
        ),
      );
}
