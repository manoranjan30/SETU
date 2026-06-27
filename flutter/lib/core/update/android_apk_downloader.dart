import 'package:flutter/services.dart';

enum ApkDownloadStatus { pending, running, paused, successful, failed, unknown }

/// A point-in-time snapshot of a DownloadManager download, as returned by
/// [AndroidApkDownloader.query].
class ApkDownloadSnapshot {
  final ApkDownloadStatus status;
  final int bytesDownloaded;
  final int totalBytes;

  /// `file://`-prefixed path to the downloaded file once [status] is
  /// [ApkDownloadStatus.successful].
  final String? localUri;

  const ApkDownloadSnapshot({
    required this.status,
    required this.bytesDownloaded,
    required this.totalBytes,
    this.localUri,
  });

  double? get progress => totalBytes > 0 ? bytesDownloaded / totalBytes : null;
}

/// Thin wrapper around Android's native `DownloadManager`, used for the
/// in-app update APK so the download survives the app being minimized.
///
/// A plain Dio request tied to the Flutter engine's isolate gets throttled
/// or frozen by the OS/OEM battery optimizer within seconds of the app
/// leaving the foreground (very aggressive on several Android brands common
/// on site devices — Xiaomi, Vivo, Oppo, Realme). `DownloadManager` runs as
/// an OS-level system service entirely independent of the app process, so
/// the download keeps going regardless of the app's foreground/background
/// state — this class just polls its status for the progress UI.
class AndroidApkDownloader {
  AndroidApkDownloader._();

  static const _channel = MethodChannel('com.setu.setu_mobile/download');

  /// Starts a download and returns the DownloadManager-assigned id, used to
  /// [query] progress and locate the file once complete.
  static Future<int> enqueue({
    required String url,
    required String fileName,
    String? title,
  }) async {
    final id = await _channel.invokeMethod<int>('enqueue', {
      'url': url,
      'fileName': fileName,
      'title': title ?? fileName,
    });
    return id!;
  }

  /// Returns the current status of [downloadId], or null if DownloadManager
  /// no longer has a record of it (e.g. already [remove]d).
  static Future<ApkDownloadSnapshot?> query(int downloadId) async {
    final raw =
        await _channel.invokeMethod<Map<dynamic, dynamic>>('query', {'downloadId': downloadId});
    if (raw == null) return null;
    return ApkDownloadSnapshot(
      status: _mapStatus(raw['status'] as int),
      bytesDownloaded: (raw['bytesDownloaded'] as num).toInt(),
      totalBytes: (raw['totalBytes'] as num).toInt(),
      localUri: raw['localUri'] as String?,
    );
  }

  /// Removes [downloadId]'s record (and downloaded file) from DownloadManager
  /// — used to clean up after a failed/stale attempt before retrying.
  static Future<void> remove(int downloadId) async {
    await _channel.invokeMethod('remove', {'downloadId': downloadId});
  }

  /// Maps Android's `DownloadManager.STATUS_*` int constants.
  static ApkDownloadStatus _mapStatus(int code) {
    switch (code) {
      case 1:
        return ApkDownloadStatus.pending;
      case 2:
        return ApkDownloadStatus.running;
      case 4:
        return ApkDownloadStatus.paused;
      case 8:
        return ApkDownloadStatus.successful;
      case 16:
        return ApkDownloadStatus.failed;
      default:
        return ApkDownloadStatus.unknown;
    }
  }
}
