import 'package:flutter/foundation.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';

class UpdateCheckResult {
  final bool hasUpdate;
  final bool isForced;
  final String? message;
  final String? updateUrl;

  const UpdateCheckResult({
    required this.hasUpdate,
    required this.isForced,
    this.message,
    this.updateUrl,
  });

  static const noUpdate = UpdateCheckResult(hasUpdate: false, isForced: false);
}

class AppUpdateService {
  final SetuApiClient _api;

  // Hard-coded app version matching pubspec.yaml `version: X.Y.Z+build`
  // Update this whenever pubspec version changes.
  static const String _currentVersion = '1.0.1';

  AppUpdateService(this._api);

  Future<UpdateCheckResult> checkForUpdate() async {
    try {
      final config = await _api.getAppConfig(platform: 'android');

      final latestVersion = config['latestVersion'] as String? ?? _currentVersion;
      final minimumVersion = config['minimumVersion'] as String? ?? _currentVersion;
      final forceUpdate = config['forceUpdate'] as bool? ?? false;
      final message = config['updateMessage'] as String?;
      final updateUrl = config['updateUrl'] as String?;

      final isForced =
          forceUpdate || _isVersionBelow(_currentVersion, minimumVersion);
      final hasUpdate = _isVersionBelow(_currentVersion, latestVersion);

      if (!hasUpdate && !isForced) return UpdateCheckResult.noUpdate;

      return UpdateCheckResult(
        hasUpdate: hasUpdate || isForced,
        isForced: isForced,
        message: message,
        updateUrl: updateUrl,
      );
    } catch (e) {
      debugPrint('[AppUpdateService] Version check failed (non-fatal): $e');
      return UpdateCheckResult.noUpdate;
    }
  }

  /// Returns true when [current] is strictly less than [minimum].
  /// Compares major.minor.patch numerically.
  bool _isVersionBelow(String current, String minimum) {
    try {
      final c = _parse(current);
      final m = _parse(minimum);
      for (int i = 0; i < 3; i++) {
        if (c[i] < m[i]) return true;
        if (c[i] > m[i]) return false;
      }
      return false; // equal
    } catch (_) {
      return false;
    }
  }

  List<int> _parse(String version) {
    final parts = version.split('.');
    while (parts.length < 3) { parts.add('0'); }
    return parts.map((p) => int.tryParse(p) ?? 0).toList();
  }
}
