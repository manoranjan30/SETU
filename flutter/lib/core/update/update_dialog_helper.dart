import 'dart:async';

import 'package:flutter/material.dart';
import 'package:open_file/open_file.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/update/android_apk_downloader.dart';
import 'package:setu_mobile/core/update/app_update_service.dart';
import 'package:setu_mobile/injection_container.dart';

/// True while an APK download initiated by [downloadAndInstallUpdate] is
/// still running in *this* process. Prevents a resume event firing mid-poll
/// from re-entering the check. This is only a same-process fast path — the
/// durable cross-restart guard is [_loadPendingDownload]/[SharedPreferences],
/// since Android frequently kills the app process while a background
/// DownloadManager transfer keeps running.
/// Cleared on completion — success clears it after the installer opens;
/// failure clears it so the user can retry on the next app resume.
bool _downloadInProgress = false;

const _kPendingDownloadIdKey = 'update_pending_download_id';
const _kPendingVersionLabelKey = 'update_pending_version_label';
const _kPendingApkUrlKey = 'update_pending_apk_url';

/// A DownloadManager download started on a previous [downloadAndInstallUpdate]
/// call, tracked in [SharedPreferences] so it survives the app process being
/// killed mid-download (common on Android once the app is backgrounded).
class _PendingDownload {
  final int downloadId;
  final String versionLabel;
  final String apkUrl;
  const _PendingDownload(this.downloadId, this.versionLabel, this.apkUrl);
}

Future<void> _savePendingDownload({
  required int downloadId,
  required String versionLabel,
  required String apkUrl,
}) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setInt(_kPendingDownloadIdKey, downloadId);
  await prefs.setString(_kPendingVersionLabelKey, versionLabel);
  await prefs.setString(_kPendingApkUrlKey, apkUrl);
}

Future<_PendingDownload?> _loadPendingDownload() async {
  final prefs = await SharedPreferences.getInstance();
  final id = prefs.getInt(_kPendingDownloadIdKey);
  final versionLabel = prefs.getString(_kPendingVersionLabelKey);
  final apkUrl = prefs.getString(_kPendingApkUrlKey);
  if (id == null || versionLabel == null || apkUrl == null) return null;
  return _PendingDownload(id, versionLabel, apkUrl);
}

Future<void> _clearPendingDownload() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_kPendingDownloadIdKey);
  await prefs.remove(_kPendingVersionLabelKey);
  await prefs.remove(_kPendingApkUrlKey);
}

/// Discards a tracked download's DownloadManager record. `DownloadManager
/// .remove()` deletes both the row *and* the downloaded APK file on disk —
/// this is the only cleanup step needed, no separate file I/O required.
Future<void> _discardPendingDownload(_PendingDownload pending) async {
  await AndroidApkDownloader.remove(pending.downloadId);
  await _clearPendingDownload();
}

/// Parses a `"X.Y.Z"` or `"X.Y.Z+build"` label (as produced by
/// [UpdateCheckResult.latestVersionLabel]) and reports whether the
/// currently-running (version, build) already satisfies it — i.e. the
/// update this label refers to has already been installed.
bool _versionSatisfies(String currentVersion, int currentBuild, String targetLabel) {
  final labelParts = targetLabel.split('+');
  final targetVersion = labelParts[0];
  final targetBuild = labelParts.length > 1 ? int.tryParse(labelParts[1]) : null;
  try {
    final c = currentVersion.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final t = targetVersion.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    while (c.length < 3) {
      c.add(0);
    }
    while (t.length < 3) {
      t.add(0);
    }
    for (int i = 0; i < 3; i++) {
      if (c[i] > t[i]) return true;
      if (c[i] < t[i]) return false;
    }
    if (targetBuild != null) return currentBuild >= targetBuild;
    return true;
  } catch (_) {
    return false;
  }
}

/// Checks the backend for an update and shows the appropriate UI.
///
/// Used both for the automatic check on app launch/resume ([silent] = true
/// — stays invisible unless there's actually an update) and the manual
/// "Check for Update" action in the profile page ([silent] = false — shows
/// a brief spinner and a "you're up to date" SnackBar when there's nothing
/// new, so a manual tap always gives the user feedback).
Future<void> checkForUpdateAndPrompt(BuildContext context, {bool silent = true}) async {
  // A download is already running in this process — skip the check
  // entirely. The user tapped "Update Now", the download started, then
  // minimized the app. Showing the dialog again on resume would start a
  // second parallel download, which is wrong.
  if (_downloadInProgress) return;

  // A download from a previous app session may still be running, already
  // finished, or already installed — reconcile that before ever asking to
  // download again. Handles the app process having been killed mid-download
  // (DownloadManager itself survives that; this app's in-memory state does
  // not).
  if (await _reconcilePendingDownload(context, silent: silent)) return;
  if (!context.mounted) return;

  if (!silent) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );
  }

  final result = await sl<AppUpdateService>().checkForUpdate();

  if (!silent && context.mounted) {
    Navigator.of(context, rootNavigator: true).pop(); // close the spinner
  }
  if (!context.mounted) return;

  if (!result.hasUpdate) {
    if (!silent) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("You're on the latest version")),
      );
    }
    return;
  }

  await showUpdateAvailableDialog(context, result);
}

/// Shows the "Update Available"/"Update Required" dialog for a positive
/// [UpdateCheckResult]. Non-dismissible when [UpdateCheckResult.isForced].
Future<void> showUpdateAvailableDialog(BuildContext context, UpdateCheckResult result) async {
  await showDialog(
    context: context,
    barrierDismissible: !result.isForced,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Icon(
            result.isForced ? Icons.system_update_outlined : Icons.new_releases_outlined,
            color: result.isForced ? Colors.red : Colors.blue,
            size: 22,
          ),
          const SizedBox(width: 8),
          Text(
            result.isForced ? 'Update Required' : 'Update Available',
            style: const TextStyle(fontSize: 17),
          ),
        ],
      ),
      content: Text(
        result.message ??
            (result.isForced
                ? 'This version is no longer supported. Please update SETU to continue.'
                : 'A newer version of SETU is available. Update for the latest features and fixes.'),
        style: const TextStyle(fontSize: 14),
      ),
      actions: [
        if (!result.isForced)
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Later'),
          ),
        ElevatedButton.icon(
          icon: const Icon(Icons.download_outlined, size: 18),
          label: const Text('Update Now'),
          onPressed: () {
            Navigator.of(ctx).pop();
            if (result.apkUrl != null) {
              downloadAndInstallUpdate(context, result.apkUrl!, result.latestVersionLabel);
            }
          },
        ),
      ],
    ),
  );
}

/// Reconciles a download started on a previous app session (tracked via
/// [_loadPendingDownload]) before any fresh update check runs. Returns
/// `true` if it fully handled this call — the caller should stop and not
/// proceed to its own [AppUpdateService.checkForUpdate] / dialog flow.
///
/// Covers three cases:
/// - Already installed (current app version now satisfies the tracked
///   download's target) → discard the now-redundant APK file.
/// - Still downloading → don't start a second parallel download; let
///   DownloadManager's own notification carry progress.
/// - Finished downloading → confirm it's still the latest build (a newer
///   one may have been published since), then prompt to install straight
///   from the existing file instead of re-downloading.
Future<bool> _reconcilePendingDownload(BuildContext context, {required bool silent}) async {
  final pending = await _loadPendingDownload();
  if (pending == null) return false;

  final packageInfo = await PackageInfo.fromPlatform();
  final currentBuild = int.tryParse(packageInfo.buildNumber) ?? 0;

  if (_versionSatisfies(packageInfo.version, currentBuild, pending.versionLabel)) {
    await _discardPendingDownload(pending);
    return false;
  }

  final snapshot = await AndroidApkDownloader.query(pending.downloadId);
  if (snapshot == null || snapshot.status == ApkDownloadStatus.failed) {
    await _clearPendingDownload();
    return false;
  }

  if (snapshot.status != ApkDownloadStatus.successful) {
    // Still pending/running/paused.
    if (!silent && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Update is already downloading…')),
      );
    }
    return true;
  }

  if (snapshot.localUri == null) {
    await _discardPendingDownload(pending);
    return false;
  }

  // Downloaded file is complete — but don't trust it blindly. Confirm the
  // backend hasn't published a newer build since this download started.
  //
  // Only discard on a *confirmed* newer version. checkForUpdate() swallows
  // network errors and returns the same "no update" shape for both "you're
  // genuinely current" and "the check failed" (e.g. offline on a site with
  // flaky connectivity) — treating those the same here would delete a
  // perfectly good, already-downloaded update file just because the
  // network hiccuped, forcing a pointless re-download. We already know the
  // installed app is behind pending.versionLabel (checked above), so an
  // inconclusive result is far more likely a failed check than the backend
  // genuinely disagreeing — proceed with what's already downloaded.
  final result = await sl<AppUpdateService>().checkForUpdate();
  if (result.hasUpdate && result.latestVersionLabel != pending.versionLabel) {
    await _discardPendingDownload(pending);
    return false;
  }

  if (!context.mounted) return true;
  await _promptInstallReady(context, pending, snapshot.localUri!);
  return true;
}

/// Shown when a previously-downloaded APK is already complete and still
/// current — skips straight to installing instead of re-downloading.
Future<void> _promptInstallReady(
  BuildContext context,
  _PendingDownload pending,
  String localUri,
) async {
  final shouldInstall = await showDialog<bool>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Update Ready to Install'),
      content: Text(
        'SETU v${pending.versionLabel} has already been downloaded and is ready to install.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Later'),
        ),
        ElevatedButton.icon(
          icon: const Icon(Icons.install_mobile_outlined, size: 18),
          label: const Text('Install'),
          onPressed: () => Navigator.of(ctx).pop(true),
        ),
      ],
    ),
  );
  if (shouldInstall != true || !context.mounted) return;
  final savePath = Uri.parse(localUri).toFilePath();
  await _openApk(context, savePath, pending.apkUrl);
}

/// Downloads the APK from [apkUrl] with a live progress dialog, then hands
/// it to the OS package installer via [OpenFile.open]. Falls back to showing
/// the raw URL in a SnackBar if either step fails (e.g. server unreachable,
/// or "install unknown apps" not yet granted — the system itself prompts for
/// that permission when the installer opens).
///
/// The download itself runs via Android's native `DownloadManager`
/// ([AndroidApkDownloader]) rather than a plain in-process HTTP request —
/// DownloadManager is an OS-level service, so it keeps downloading even if
/// the user minimizes the app mid-update. A Dio/Dart-isolate download would
/// get throttled or frozen the moment the app leaves the foreground on
/// several Android OEMs' aggressive battery optimizers, which is what was
/// previously pausing the update.
Future<void> downloadAndInstallUpdate(
  BuildContext context,
  String apkUrl,
  String? versionLabel,
) async {
  _downloadInProgress = true;
  final progress = ValueNotifier<double?>(0);
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (_) => ValueListenableBuilder<double?>(
      valueListenable: progress,
      builder: (_, value, __) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Downloading${versionLabel != null ? ' v$versionLabel' : ''}…'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LinearProgressIndicator(value: value),
            const SizedBox(height: 12),
            Text(value != null ? '${(value * 100).toStringAsFixed(0)}%' : 'Starting…'),
            const SizedBox(height: 4),
            Text(
              'You can minimize the app — the download will continue.',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    ),
  );

  Timer? poller;
  try {
    final fileName =
        'setu_update_${versionLabel ?? DateTime.now().millisecondsSinceEpoch}.apk';
    final downloadId = await AndroidApkDownloader.enqueue(
      url: ApiEndpoints.resolveUrl(apkUrl),
      fileName: fileName,
      title: 'SETU update${versionLabel != null ? ' v$versionLabel' : ''}',
    );

    // Track this download so a later app session (including one that starts
    // after the OS kills this process mid-download) can find it again
    // instead of starting a duplicate. Skipped when versionLabel is
    // unavailable — that value doubles as the staleness key on the next
    // check, so there's nothing reliable to compare against without it.
    if (versionLabel != null) {
      await _savePendingDownload(
        downloadId: downloadId,
        versionLabel: versionLabel,
        apkUrl: apkUrl,
      );
    }

    final completer = Completer<ApkDownloadSnapshot>();
    poller = Timer.periodic(const Duration(milliseconds: 700), (timer) async {
      final snapshot = await AndroidApkDownloader.query(downloadId);
      if (snapshot == null) {
        timer.cancel();
        if (!completer.isCompleted) {
          completer.completeError('Download record not found');
        }
        return;
      }
      if (snapshot.progress != null) progress.value = snapshot.progress;
      if (snapshot.status == ApkDownloadStatus.successful ||
          snapshot.status == ApkDownloadStatus.failed) {
        timer.cancel();
        if (!completer.isCompleted) completer.complete(snapshot);
      }
    });

    final result = await completer.future;
    poller.cancel();

    if (context.mounted) Navigator.of(context, rootNavigator: true).pop(); // close progress dialog
    if (!context.mounted) return;

    if (result.status != ApkDownloadStatus.successful || result.localUri == null) {
      await AndroidApkDownloader.remove(downloadId);
      await _clearPendingDownload();
      if (context.mounted) _showUpdateFallback(context, apkUrl, 'Download failed.');
      return;
    }

    final savePath = Uri.parse(result.localUri!).toFilePath();
    await _openApk(context, savePath, apkUrl);
  } catch (e) {
    poller?.cancel();
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop(); // close progress dialog
    if (context.mounted) _showUpdateFallback(context, apkUrl, 'Download failed: $e');
  } finally {
    // Always clear the guard — on success the installer has launched; on
    // failure the user should be able to retry on next app resume.
    _downloadInProgress = false;
  }
}

/// Opens the downloaded APK via the OS installer. On Android 8+, installing
/// an APK requires the user to have granted the per-app "install unknown
/// apps" permission — this is NOT a normal runtime permission dialog, it's a
/// toggle in system Settings, so we have to send the user there ourselves
/// the first time and retry the install once they come back.
Future<void> _openApk(BuildContext context, String savePath, String apkUrl) async {
  final result = await OpenFile.open(savePath);
  if (result.type == ResultType.done) return;
  if (!context.mounted) return;

  if (result.type == ResultType.permissionDenied) {
    await _promptInstallPermission(context, savePath, apkUrl);
    return;
  }

  _showUpdateFallback(context, apkUrl, 'Could not launch installer: ${result.message}');
}

/// Explains why the install was blocked and sends the user to the system
/// "install unknown apps" settings screen. [Permission.requestInstallPackages]
/// suspends until the user backs out of that settings screen, so we can
/// retry opening the already-downloaded APK immediately afterward without
/// re-downloading it.
Future<void> _promptInstallPermission(
  BuildContext context,
  String savePath,
  String apkUrl,
) async {
  final shouldOpenSettings = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Allow Installing Updates'),
      content: const Text(
        'To install this update, Android needs your permission to let SETU '
        'install apps. Tap "Open Settings" and enable "Allow from this source", '
        'then come back here.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: const Text('Open Settings'),
        ),
      ],
    ),
  );

  if (shouldOpenSettings != true) return;

  await Permission.requestInstallPackages.request();
  final granted = await Permission.requestInstallPackages.isGranted;
  if (!context.mounted) return;

  if (granted) {
    await _openApk(context, savePath, apkUrl);
  } else {
    _showUpdateFallback(
      context,
      apkUrl,
      'Permission still not granted — could not launch installer.',
    );
  }
}

/// Shows the raw APK URL in a long-lived SnackBar so the user can open it
/// in a browser manually when the in-app download/install path fails.
void _showUpdateFallback(BuildContext context, String apkUrl, String reason) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text('$reason\nDownload manually: $apkUrl'),
      duration: const Duration(seconds: 12),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
