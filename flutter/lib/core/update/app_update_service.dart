import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
/// Backend contract (`GET /app/config?platform=android`, no auth required) —
/// this matches the SETU backend's actual `AppConfigService.getConfig()`
/// response (the full `app_config` row):
/// ```json
/// {
///   "platform": "android",
///   "latestVersion": "1.0.2",
///   "minimumVersion": "1.0.0",
///   "forceUpdate": false,
///   "updateMessage": "Bug fixes and performance improvements",
///   "updateUrl": "/uploads/mobile-app/android/1780428694958-app-release.apk",
///   "apkFileName": "1780428694958-app-release.apk",
///   "apkOriginalName": "app-release.apk",
///   "apkFileSize": 86374912,
///   "apkUploadedAt": "2026-06-19T10:15:00.000Z"
/// }
/// ```
///
/// IMPORTANT: uploading a new APK through the admin panel (`POST
/// /app/mobile-app/apk`) only updates `updateUrl`/`apkFileName`/
/// `apkFileSize`/`apkUploadedAt` — it does NOT touch `latestVersion` or
/// `minimumVersion` (confirmed by reading `AppConfigService.updateApk()`).
/// Those are only changed by a separate `PUT /app/config` call. So relying
/// on version-string comparison ALONE means a freshly-uploaded APK is
/// invisible to this check unless someone also remembers to bump the
/// version fields separately.
///
/// To close that gap without requiring a backend change, this service ALSO
/// tracks `apkFileName` (which is unique per upload — it's prefixed with
/// `Date.now()`) locally via [SharedPreferences]. If the backend's
/// `apkFileName` differs from the last one this device has already shown a
/// prompt for, that alone counts as "update available" — independent of
/// whatever the version fields say. Once shown, that filename is recorded
/// so the same upload doesn't keep re-prompting on every launch.
class AppUpdateService {
  final SetuApiClient _api;
  static const _lastSeenApkKey = 'update_last_seen_apk_filename';

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
      final apkFileName = config['apkFileName'] as String?;

      final isForced = forceUpdate ||
          _isBehind(currentVersion, currentBuild, minimumVersion, minimumBuild);
      final versionHasUpdate =
          _isBehind(currentVersion, currentBuild, latestVersion, latestBuild);

      // Catches a freshly-uploaded APK even when the admin didn't also bump
      // latestVersion/minimumVersion — see class doc for why this is needed.
      final apkChanged = await _hasNewApkUpload(apkFileName);

      final hasUpdate = versionHasUpdate || apkChanged;

      if (!hasUpdate && !isForced) return UpdateCheckResult.noUpdate;

      if (hasUpdate && apkFileName != null) {
        await _rememberSeenApk(apkFileName);
      }

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

  /// True when [apkFileName] is set and differs from the last filename this
  /// device has already been prompted about. `null` on a fresh install (no
  /// prior record) — that's NOT treated as "changed" since there's nothing
  /// to compare against yet; the version-based check still covers that case.
  Future<bool> _hasNewApkUpload(String? apkFileName) async {
    if (apkFileName == null) return false;
    final prefs = await SharedPreferences.getInstance();
    final lastSeen = prefs.getString(_lastSeenApkKey);
    if (lastSeen == null) {
      // First check ever on this device — record the baseline rather than
      // flagging it, so installing the app fresh from the current latest
      // upload doesn't immediately prompt to "update" to itself.
      await prefs.setString(_lastSeenApkKey, apkFileName);
      return false;
    }
    return lastSeen != apkFileName;
  }

  Future<void> _rememberSeenApk(String apkFileName) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lastSeenApkKey, apkFileName);
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
