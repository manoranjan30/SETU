import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';

/// Manages the user-selected backend server URL at runtime.
///
/// Responsibilities:
/// - Persists the selected URL across app restarts via [SharedPreferences].
/// - Maintains a capped list of recently-used URLs (max 8) for quick re-selection.
/// - Keeps [ApiEndpoints] runtime override in sync whenever the URL changes.
///
/// Call [init] once in main() before [SetuApiClient] is constructed so that
/// [ApiEndpoints.baseUrl] already returns the saved URL by the time Dio is set up.
class ServerConfigService {
  static const _urlKey        = 'setu_server_url';
  static const _recentKey     = 'setu_recent_urls';
  static const _configuredKey = 'setu_server_configured';
  static const _maxRecent     = 8;

  // Singleton — injected via GetIt so tests can swap it.
  static final ServerConfigService instance = ServerConfigService._();
  ServerConfigService._();

  // ── Initialisation ──────────────────────────────────────────────────────

  /// Loads the saved URL from SharedPreferences and primes [ApiEndpoints].
  /// Call this in main() BEFORE constructing [SetuApiClient].
  /// Returns the loaded URL (or null if not yet configured).
  static Future<String?> init() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_urlKey);
    if (saved != null && saved.isNotEmpty) {
      ApiEndpoints.setRuntimeUrl(saved);
    }
    return saved;
  }

  // ── Read ────────────────────────────────────────────────────────────────

  /// Whether the user has ever saved a server URL.
  Future<bool> isConfigured() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_configuredKey) ?? false;
  }

  /// Currently saved server URL, or null if not configured.
  Future<String?> getSavedUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_urlKey);
  }

  /// Up to [_maxRecent] recently used URLs, newest first.
  Future<List<String>> getRecentUrls() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_recentKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      return List<String>.from(jsonDecode(raw) as List);
    } catch (_) {
      return [];
    }
  }

  // ── Write ───────────────────────────────────────────────────────────────

  /// Persists [url] as the active server URL, adds it to the recent list,
  /// and updates [ApiEndpoints] runtime override.
  ///
  /// Also updates the Dio instance if [apiClientUpdateCallback] is provided
  /// (pass `sl<SetuApiClient>().updateBaseUrl`).
  Future<void> saveUrl(
    String url, {
    void Function(String)? apiClientUpdateCallback,
  }) async {
    final trimmed = url.trim();
    if (trimmed.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();

    // Persist as the active URL
    await prefs.setString(_urlKey, trimmed);
    await prefs.setBool(_configuredKey, true);

    // Update runtime override so all future ApiEndpoints.baseUrl calls return it
    ApiEndpoints.setRuntimeUrl(trimmed);

    // Update Dio's base URL live if the client is already running
    apiClientUpdateCallback?.call(trimmed);

    // Add to recent list (deduplicated, newest first, capped at _maxRecent)
    await _addToRecent(prefs, trimmed);
  }

  /// Clears the saved URL and recent list, reverts to compile-time default.
  Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_urlKey);
    await prefs.remove(_recentKey);
    await prefs.setBool(_configuredKey, false);
    ApiEndpoints.clearRuntimeUrl();
  }

  /// Removes one entry from the recent list (e.g. user swipes to delete).
  Future<void> removeRecent(String url) async {
    final prefs = await SharedPreferences.getInstance();
    final list  = await getRecentUrls();
    list.remove(url);
    await prefs.setString(_recentKey, jsonEncode(list));
  }

  // ── Presets ─────────────────────────────────────────────────────────────

  /// Static preset options shown in [ServerSetupPage].
  /// The compile-time URL is always shown so the user can revert to it.
  List<ServerPreset> get presets => [
    ServerPreset(
      label:      'Dev Default (compile-time)',
      url:        ApiEndpoints.compileTimeUrl,
      isEditable: false,
      icon:       'code',
    ),
    ServerPreset(
      label:      'Cloudflare Tunnel',
      url:        '',
      isEditable: true,
      hint:       'https://xxxx.trycloudflare.com',
      icon:       'cloud',
    ),
    ServerPreset(
      label:      'Custom / LAN IP',
      url:        '',
      isEditable: true,
      hint:       'http://192.168.x.x:3000/api',
      icon:       'router',
    ),
  ];

  // ── Private ─────────────────────────────────────────────────────────────

  Future<void> _addToRecent(SharedPreferences prefs, String url) async {
    var list = await getRecentUrls();
    list.remove(url);          // remove duplicate if exists
    list.insert(0, url);       // newest first
    if (list.length > _maxRecent) list = list.sublist(0, _maxRecent);
    await prefs.setString(_recentKey, jsonEncode(list));
  }
}

/// Describes a preset server option shown as a selectable tile.
class ServerPreset {
  final String label;
  final String url;
  final bool   isEditable;
  final String hint;
  final String icon;

  const ServerPreset({
    required this.label,
    required this.url,
    required this.isEditable,
    this.hint = '',
    this.icon = 'dns',
  });
}
