import 'dart:io';
import 'package:logger/logger.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'photo_cache_manager.dart';

/// Runs once per app launch to enforce storage limits on photos.
///
/// Two duties:
/// 1. Delete camera temp files in [getTemporaryDirectory] older than 15 days
///    (These are normally deleted right after upload, but this acts as a safety net.)
/// 2. Trim the [SetuPhotoCacheManager] cache to the 150 MB hard cap,
///    evicting the oldest files first until under the limit.
class MediaCleanupService {
  static const _maxCacheBytes = 150 * 1024 * 1024; // 150 MB
  static const _maxAgeDays = 15;

  final Logger _log = Logger();

  /// Run all cleanup tasks. Non-blocking — awaited in main() after app starts.
  Future<void> runCleanup() async {
    await Future.wait([
      _cleanTempUploads(),
      _trimPhotoCache(),
    ]);
  }

  /// Delete setu_upload_* temp files older than [_maxAgeDays] days.
  Future<void> _cleanTempUploads() async {
    try {
      final tempDir = await getTemporaryDirectory();
      final cutoff = DateTime.now().subtract(const Duration(days: _maxAgeDays));
      int freed = 0;

      final entries = tempDir.listSync(followLinks: false);
      for (final entry in entries) {
        if (entry is File && p.basename(entry.path).startsWith('setu_upload_')) {
          final stat = await entry.stat();
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
      _log.w('MediaCleanup: temp upload cleanup failed: $e');
    }
  }

  /// Trim the photo cache to [_maxCacheBytes] by deleting oldest entries first.
  Future<void> _trimPhotoCache() async {
    try {
      final cacheDir = await _getCacheDir();
      if (cacheDir == null || !cacheDir.existsSync()) return;

      final files = cacheDir
          .listSync(followLinks: false)
          .whereType<File>()
          .toList();

      // Compute total size
      var totalBytes = 0;
      final sized = <({File file, int size, DateTime modified})>[];
      for (final f in files) {
        final stat = await f.stat();
        totalBytes += stat.size;
        sized.add((file: f, size: stat.size, modified: stat.modified));
      }

      if (totalBytes <= _maxCacheBytes) return;

      // Sort oldest first — evict until under cap
      sized.sort((a, b) => a.modified.compareTo(b.modified));
      int freed = 0;
      for (final entry in sized) {
        if (totalBytes - freed <= _maxCacheBytes) break;
        try {
          await entry.file.delete();
          freed += entry.size;
        } catch (_) {}
      }

      _log.i('MediaCleanup: trimmed photo cache, freed ${_fmt(freed)}');
    } catch (e) {
      _log.w('MediaCleanup: cache trim failed: $e');
    }
  }

  Future<Directory?> _getCacheDir() async {
    try {
      final appCache = await getApplicationCacheDirectory();
      // flutter_cache_manager stores under <appCache>/libCachedImageData/<key>
      final dir = Directory(p.join(appCache.path, 'libCachedImageData', 'setu_photos'));
      return dir.existsSync() ? dir : null;
    } catch (_) {
      return null;
    }
  }

  String _fmt(int bytes) {
    if (bytes >= 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }
}
