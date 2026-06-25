import 'package:flutter/material.dart';
import 'package:open_file/open_file.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/update/app_update_service.dart';
import 'package:setu_mobile/injection_container.dart';

/// Checks the backend for an update and shows the appropriate UI.
///
/// Used both for the automatic check on app launch/resume ([silent] = true
/// — stays invisible unless there's actually an update) and the manual
/// "Check for Update" action in the profile page ([silent] = false — shows
/// a brief spinner and a "you're up to date" SnackBar when there's nothing
/// new, so a manual tap always gives the user feedback).
Future<void> checkForUpdateAndPrompt(BuildContext context, {bool silent = true}) async {
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

/// Downloads the APK from [apkUrl] to a temp file with a live progress
/// dialog, then hands it to the OS package installer via [OpenFile.open].
/// Falls back to showing the raw URL in a SnackBar if either step fails
/// (e.g. server unreachable, or "install unknown apps" not yet granted —
/// the system itself prompts for that permission when the installer opens).
Future<void> downloadAndInstallUpdate(
  BuildContext context,
  String apkUrl,
  String? versionLabel,
) async {
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
          ],
        ),
      ),
    ),
  );

  try {
    final dir = await getTemporaryDirectory();
    final savePath = p.join(dir.path,
        'setu_update_${versionLabel ?? DateTime.now().millisecondsSinceEpoch}.apk');

    await sl<SetuApiClient>().downloadFile(
      apkUrl,
      savePath,
      onProgress: (received, total) {
        if (total > 0) progress.value = received / total;
      },
    );

    if (context.mounted) Navigator.of(context, rootNavigator: true).pop(); // close progress dialog
    if (!context.mounted) return;

    await _openApk(context, savePath, apkUrl);
  } catch (e) {
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop(); // close progress dialog
    if (context.mounted) _showUpdateFallback(context, apkUrl, 'Download failed: $e');
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
