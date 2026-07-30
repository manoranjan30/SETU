import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';

/// Fetches and caches the per-project batch-slip label-synonym config
/// (`GET /quality/batch-slip-config`) that admins maintain on the backend.
/// See docs/mobile-handoff-batch-slip-scan-config.md.
///
/// Offline-first by design: a failed fetch falls back to whatever was
/// cached from the last successful one (indefinitely — there is no
/// expiry), so a scan on-site never depends on connectivity at the moment
/// it's used. The built-in label stems in `batch_slip_parser.dart` still
/// work even if nothing was ever fetched at all.
class BatchSlipConfigService {
  final SetuApiClient _api;
  const BatchSlipConfigService(this._api);

  static String _cacheKey(int projectId) => 'batch_slip_config_$projectId';

  /// Returns the resolved `{fieldKey: [labels]}` map for [projectId],
  /// refreshing from the network when possible. Never throws — an empty
  /// map (not an error) means "nothing configured, use built-in labels
  /// only," which is the same as before this feature existed.
  Future<Map<String, List<String>>> getConfig(int projectId) async {
    try {
      final raw = await _api.getBatchSlipConfig(projectId);
      await _saveCache(projectId, raw);
      return _parse(raw);
    } catch (_) {
      return await _loadCache(projectId) ?? const {};
    }
  }

  Map<String, List<String>> _parse(Map<String, dynamic> raw) => raw.map(
        (key, value) => MapEntry(
          key,
          (value as List<dynamic>?)?.whereType<String>().toList() ?? const <String>[],
        ),
      );

  Future<void> _saveCache(int projectId, Map<String, dynamic> raw) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cacheKey(projectId), jsonEncode(raw));
  }

  Future<Map<String, List<String>>?> _loadCache(int projectId) async {
    final prefs = await SharedPreferences.getInstance();
    final str = prefs.getString(_cacheKey(projectId));
    if (str == null) return null;
    try {
      return _parse(jsonDecode(str) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}
