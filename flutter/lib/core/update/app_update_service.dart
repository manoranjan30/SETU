import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';

class UpdateCheckResult {
  final bool hasUpdate;
  final bool isForced;
  final String? message;
  final String? apkUrl;
  final String? latestVersionLabel;

  const UpdateCheckResult({
    required this.hasUpdate,
    required this.isForced,
    this.message,
    this.apkUrl,
    this.latestVersionLabel,
  });

  static const noUpdate = UpdateCheckResult(hasUpdate: false, isForced: false);
}

/// Checks the backend for a newer mobile app build and exposes enough
/// information ([UpdateCheckResult.apkUrl]) for the caller to download and
/// install it in-app.
///
/// The currently-installed version/build number is read from the platform
/// at runtime via [PackageInfo] — it is NOT hard-coded, so this never goes
/// stale relative to `pubspec.yaml`'s `version: X.Y.Z+build`.
///
/// Backend contract (`GET /app/config?platform=android`, no auth required):
/// ```json
/// {
///   "latestVersion": "1.0.2",       // semantic version, the X.Y.Z before the '+'
///   "latestBuildNumber": 5,         // integer, the build number after the '+'
///   "minimumVersion": "1.0.0",
///   "minimumBuildNumber": 1,
///   "forceUpdate": false,
///   "updateMessage": "Bug fixes and performance improvements",
///   "updateUrl": "https://yourserver.com/uploads/app-builds/setu-1.0.2.apk"
/// }
/// ```
/// `latestBuildNumber`/`minimumBuildNumber` are optional — if the backend
/// only tracks `latestVersion`/`minimumVersion`, build-number comparison is
/// skipped and version-string comparison alone still works.
class AppUpdateService {
  final SetuApiClient _api;

  AppUpdateService(this._api);

  Future<UpdateCheckResult> checkForUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version;
      final currentBuild = int.tryParse(packageInfo.buildNumber) ?? 0;

      final config = await _api.getAppConfig(platform: 'android');

      final latestVersion = config['latestVersion'] as String? ?? currentVersion;
      final latestBuild = config['latestBuildNumber'] as int?;
      final minimumVersion = config['minimumVersion'] as String? ?? currentVersion;
      final minimumBuild = config['minimumBuildNumber'] as int?;
      final forceUpdate = config['forceUpdate'] as bool? ?? false;
      final message = config['updateMessage'] as String?;
      final apkUrl = config['updateUrl'] as String?;

      final isForced = forceUpdate ||
          _isBehind(currentVersion, currentBuild, minimumVersion, minimumBuild);
      final hasUpdate =
          _isBehind(currentVersion, currentBuild, latestVersion, latestBuild);

      if (!hasUpdate && !isForced) return UpdateCheckResult.noUpdate;

      return UpdateCheckResult(
        hasUpdate: hasUpdate || isForced,
        isForced: isForced,
        message: message,
        apkUrl: apkUrl,
        latestVersionLabel: latestBuild != null
            ? '$latestVersion+$latestBuild'
            : latestVersion,
      );
    } catch (e) {
      debugPrint('[AppUpdateService] Version check failed (non-fatal): $e');
      return UpdateCheckResult.noUpdate;
    }
  }

  /// True when the installed (version, build) is strictly behind the given
  /// (targetVersion, targetBuild). Version string wins first; when versions
  /// are equal, the build number is the tiebreaker — this is what lets the
  /// same semantic version with a newer build (e.g. a hotfix re-upload)
  /// still trigger the prompt, per the "different build" requirement.
  bool _isBehind(String currentVersion, int currentBuild,
      String targetVersion, int? targetBuild) {
    try {
      final c = _parseVersion(currentVersion);
      final t = _parseVersion(targetVersion);
      for (int i = 0; i < 3; i++) {
        if (c[i] < t[i]) return true;
        if (c[i] > t[i]) return false;
      }
      // Versions are equal — fall back to build number if the backend sent one.
      if (targetBuild != null && currentBuild < targetBuild) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  List<int> _parseVersion(String version) {
    final parts = version.split('.');
    while (parts.length < 3) {
      parts.add('0');
    }
    return parts.map((p) => int.tryParse(p) ?? 0).toList();
  }
}
