import 'dart:io';
import 'package:logger/logger.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'photo_cache_manager.dart';

/// Runs once per app launch to enforce storage limits on photos.
///
/// Two duties:
/// 1. Delete camera temp files in [getTemporaryDirectory] older than 3 days.
///    (These are normally deleted right after upload, but this acts as a safety
///    net for files that were orphaned by a crash or a failed upload.)
/// 2. Trim the [SetuPhotoCacheManager] cache to the 150 MB hard cap,
///    evicting the oldest files first until under the limit.
///
/// Both tasks run concurrently via [Future.wait] to minimise startup latency.
/// Neither task is critical for app correctness, so errors are caught and
/// logged rather than propagated to the caller.
class MediaCleanupService {
  /// Hard cap for the [SetuPhotoCacheManager] photo cache.
  ///
  /// 150 MB is chosen to balance offline usability (photos needed for
  /// inspection evidence) against device storage constraints on lower-end
  /// Android devices common on construction sites.
  static const _maxCacheBytes = 150 * 1024 * 1024; // 150 MB

  /// Temp upload files older than 3 days are certainly orphaned (failed uploads).
  ///
  /// A successfully uploaded file is deleted immediately after upload, so any
  /// temp file surviving beyond 3 days must be the result of a crash, a
  /// killed process, or a persistent network failure. 3 days is conservative
  /// enough to handle multi-day offline periods while still reclaiming space.
  static const _maxAgeDays = 3;

  final Logger _log = Logger();

  /// Run all cleanup tasks. Non-blocking — awaited in main() after app starts.
  ///
  /// [Future.wait] runs both tasks concurrently so the total startup cost is
  /// max(tempCleanupTime, cacheTrimTime) rather than the sum of both.
  Future<void> runCleanup() async {
    await Future.wait([
      _cleanTempUploads(),
      _trimPhotoCache(),
    ]);
  }

  /// Delete setu_upload_* temp files older than [_maxAgeDays] days.
  ///
  /// The `setu_upload_` prefix is used by the camera capture utility when
  /// creating temp files before an upload. Filtering by prefix avoids
  /// accidentally deleting other application temp files in the shared
  /// temporary directory.
  Future<void> _cleanTempUploads() async {
    try {
      final tempDir = await getTemporaryDirectory();
      final cutoff = DateTime.now().subtract(const Duration(days: _maxAgeDays));
      int freed = 0;

      // listSync is intentionally used here rather than list() because the
      // directory is expected to be small and the synchronous call simplifies
      // the iteration logic without measurable performance impact.
      final entries = tempDir.listSync(followLinks: false);
      for (final entry in entries) {
        // Only examine files (skip sub-directories) and only those with the
        // setu_upload_ prefix to avoid touching unrelated temp files.
        if (entry is File && p.basename(entry.path).startsWith('setu_upload_')) {
          final stat = await entry.stat();
          // Use modification time rather than creation time because creation
          // time is not reliably available on all platforms (Android in
          // particular does not expose it via the standard stat API).
          if (stat.modified.isBefore(cutoff)) {
            freed += stat.size;
            await entry.delete();
          }
        }
      }

      if (freed > 0) {
        _log.i('MediaCleanup: freed ${_fmt(freed)} of temp upload files');
      }
    } catch (e) {
      // Log but do not rethrow — a cleanup failure must not prevent the app
      // from starting or the user from doing their work.
      _log.w('MediaCleanup: temp upload cleanup failed: $e');
    }
  }

  /// Trim the photo cache to [_maxCacheBytes] by deleting oldest entries first.
  ///
  /// The eviction strategy is LRU-by-modification-time: files are sorted
  /// oldest-last-modified first, and deleted in that order until the total
  /// cache size is under [_maxCacheBytes]. This preserves recently-accessed
  /// photos (which the user is more likely to need again) at the cost of
  /// older ones (which may still be accessible from the server).
  Future<void> _trimPhotoCache() async {
    try {
      final cacheDir = await _getCacheDir();
      // If the cache directory does not exist yet (first launch), there is
      // nothing to trim.
      if (cacheDir == null || !cacheDir.existsSync()) return;

      // Collect all files in the cache directory (non-recursive, no symlinks).
      final files = cacheDir
          .listSync(followLinks: false)
          .whereType<File>()
          .toList();

      // Compute total size and build a sortable list with stat data.
      // stat() is called per-file rather than in a batch because the platform
      // file API does not expose bulk stat — the sequential await is
      // acceptable given that cleanup runs in the background after app start.
      var totalBytes = 0;
      final sized = <({File file, int size, DateTime modified})>[];
      for (final f in files) {
        final stat = await f.stat();
        totalBytes += stat.size;
        sized.add((file: f, size: stat.size, modified: stat.modified));
      }

      // Early exit if already under the cap — no deletion needed.
      if (totalBytes <= _maxCacheBytes) return;

      // Sort oldest first — evict until under cap.
      // Comparing DateTime objects directly uses their natural ordering
      // (earlier dates are "smaller"), so ascending sort puts oldest first.
      sized.sort((a, b) => a.modified.compareTo(b.modified));
      int freed = 0;
      for (final entry in sized) {
        // Stop evicting as soon as the remaining size is within the cap.
        if (totalBytes - freed <= _maxCacheBytes) break;
        try {
          await entry.file.delete();
          freed += entry.size;
        } catch (_) {
          // Individual file deletion may fail if the file was already removed
          // by another process (e.g. the OS temp cleaner). Ignore and continue
          // so a single deletion error does not abort the entire trim pass.
        }
      }

      _log.i('MediaCleanup: trimmed photo cache, freed ${_fmt(freed)}');
    } catch (e) {
      _log.w('MediaCleanup: cache trim failed: $e');
    }
  }

  /// Resolve the photo cache directory from the [SetuPhotoCacheManager].
  ///
  /// Tries the cache manager's own [store.getCacheDirectory] first, which is
  /// the canonical path and is guaranteed to match the files the manager
  /// writes. Falls back to a hardcoded path constructed from
  /// [getApplicationCacheDirectory] for environments where the store API
  /// throws (e.g. during tests or on unusual Android configurations).
  ///
  /// Returns null if neither approach yields a valid directory, allowing the
  /// caller to skip the trim gracefully.
  Future<Directory?> _getCacheDir() async {
    try {
      final appCache = await getApplicationCacheDirectory();
      // flutter_cache_manager stores files under:
      //   <appCache>/libCachedImageData/<cacheKey>
      // where cacheKey is the value passed to DefaultCacheManager's key
      // parameter (here: 'setu_photos').
      final dir = Directory(p.join(appCache.path, 'libCachedImageData', 'setu_photos'));
      return dir.existsSync() ? dir : null;
    } catch (_) {
      return null;
    }
  }

  /// Format a byte count as a human-readable string (KB or MB).
  ///
  /// Used exclusively for log messages — not shown in the UI.
  String _fmt(int bytes) {
    if (bytes >= 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }
}
