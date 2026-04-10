import 'package:shared_preferences/shared_preferences.dart';

/// Manages the ISO-8601 timestamps used as cursors for delta sync.
///
/// Each module (progress, quality, ehs) has its own cursor stored in
/// SharedPreferences. When a delta sync completes successfully the cursor
/// is advanced to the [synced_at] timestamp returned by the server.
///
/// A null cursor means "never synced" — the SyncService will call the
/// endpoint without a [since] parameter to bootstrap all data.
class DeltaSyncCursors {
  static const _progressKey = 'last_delta_sync_progress_at';
  static const _qualityKey = 'last_delta_sync_quality_at';
  static const _ehsKey = 'last_delta_sync_ehs_at';

  final SharedPreferences _prefs;

  DeltaSyncCursors(this._prefs);

  /// Factory constructor — awaits SharedPreferences.
  static Future<DeltaSyncCursors> create() async {
    final prefs = await SharedPreferences.getInstance();
    return DeltaSyncCursors(prefs);
  }

  String? get progressCursor => _prefs.getString(_progressKey);
  String? get qualityCursor => _prefs.getString(_qualityKey);
  String? get ehsCursor => _prefs.getString(_ehsKey);

  Future<void> setProgressCursor(String syncedAt) =>
      _prefs.setString(_progressKey, syncedAt);
  Future<void> setQualityCursor(String syncedAt) =>
      _prefs.setString(_qualityKey, syncedAt);
  Future<void> setEhsCursor(String syncedAt) =>
      _prefs.setString(_ehsKey, syncedAt);

  /// Reset all cursors — forces a full re-download on the next sync.
  Future<void> resetAll() async {
    await _prefs.remove(_progressKey);
    await _prefs.remove(_qualityKey);
    await _prefs.remove(_ehsKey);
  }
}
