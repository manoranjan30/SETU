import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Read-side offline cache for the Snag/De-snag module, mirroring
/// [DeltaSyncCursors]'s SharedPreferences-based pattern.
///
/// Unlike quality/progress/EHS, snag has no server-side delta-sync endpoint
/// to pull incremental changes from, so this isn't a full offline dataset —
/// it's a "last known good" snapshot of whatever the user has actually
/// viewed. Every successful load of the process-step/unit overview or a
/// unit's list detail is cached automatically (no explicit "download"
/// button); if a later load fails purely because the device is offline, the
/// bloc falls back to whatever snapshot exists here instead of showing a
/// blank error screen. A 4xx/5xx failure (a real server rejection) does
/// NOT fall back to cache — only [NetworkException] does, since a cached
/// snapshot masking a real server error would be misleading.
class SnagOfflineCache {
  static const _overviewPrefix = 'snag_offline_overview_';
  static const _listPrefix = 'snag_offline_list_';

  final SharedPreferences _prefs;
  SnagOfflineCache._(this._prefs);

  static Future<SnagOfflineCache> create() async {
    final prefs = await SharedPreferences.getInstance();
    return SnagOfflineCache._(prefs);
  }

  Future<void> saveOverview(int projectId, {required List<dynamic> processSteps, required List<dynamic> units}) =>
      _prefs.setString(
        '$_overviewPrefix$projectId',
        jsonEncode({'processSteps': processSteps, 'units': units}),
      );

  /// Returns `(processSteps, units)` from the last cached snapshot for
  /// [projectId], or `null` if nothing has ever been cached.
  (List<dynamic>, List<dynamic>)? readOverview(int projectId) {
    final raw = _prefs.getString('$_overviewPrefix$projectId');
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return (decoded['processSteps'] as List<dynamic>? ?? [], decoded['units'] as List<dynamic>? ?? []);
    } catch (_) {
      return null; // corrupt cache entry — treat as absent rather than crash
    }
  }

  Future<void> saveListDetail(int listId, Map<String, dynamic> data) =>
      _prefs.setString('$_listPrefix$listId', jsonEncode(data));

  Map<String, dynamic>? readListDetail(int listId) {
    final raw = _prefs.getString('$_listPrefix$listId');
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }
}
