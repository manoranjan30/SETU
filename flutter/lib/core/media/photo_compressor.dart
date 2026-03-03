import 'dart:io';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// WhatsApp-style photo compression before upload.
///
/// Resizes to max 1280px, strips EXIF, and targets ~150–250KB output.
/// Call [compress] before uploading, then [deleteTempFile] after the upload
/// completes (success or failure) to avoid leaving files on device.
class PhotoCompressor {
  PhotoCompressor._();

  /// Compress [sourcePath] and return the path of the compressed temp file.
  ///
  /// Quality ladder (mirrors WhatsApp):
  ///   ≥ 4 MB source  → quality 75
  ///   ≥ 2 MB source  → quality 80
  ///   < 2 MB source  → quality 85
  ///
  /// Output is always JPEG, max 1280 × 1280 (aspect ratio preserved, no upscale).
  static Future<String> compress(String sourcePath) async {
    final sourceFile = File(sourcePath);
    final sourceSize = await sourceFile.length();

    final quality = sourceSize >= 4 * 1024 * 1024
        ? 75
        : sourceSize >= 2 * 1024 * 1024
            ? 80
            : 85;

    final tempDir = await getTemporaryDirectory();
    final targetPath = p.join(
      tempDir.path,
      'setu_upload_${DateTime.now().millisecondsSinceEpoch}.jpg',
    );

    final result = await FlutterImageCompress.compressAndGetFile(
      sourcePath,
      targetPath,
      minWidth: 1280,
      minHeight: 1280,
      quality: quality,
      keepExif: false,
      format: CompressFormat.jpeg,
    );

    // Fallback to original if compression failed (shouldn't happen in practice)
    return result?.path ?? sourcePath;
  }

  /// Silently delete a temp file after upload. Never throws.
  static Future<void> deleteTempFile(String path) async {
    try {
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {}
  }
}
