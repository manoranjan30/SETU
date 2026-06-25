import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

/// Thrown when a photographed signature can't be processed — bad format,
/// too large, or no ink detected — with a message safe to show the user.
class SignatureCleanupException implements Exception {
  final String message;
  const SignatureCleanupException(this.message);
  @override
  String toString() => message;
}

class SignatureCleanupResult {
  /// Transparent PNG written to a temp file — pass this to the preview UI
  /// and, once confirmed, base64-encode it for the upload payload.
  final String pngPath;
  final Uint8List pngBytes;
  const SignatureCleanupResult({required this.pngPath, required this.pngBytes});
}

/// Converts a photo of a paper signature into a clean, transparent-PNG
/// digital signature — entirely on-device, before anything is uploaded.
///
/// Pipeline (matches the web-aligned spec exactly):
///   1. Validate format (JPG/PNG/WebP) and size (≤ 5 MB).
///   2. Downscale very large photographs.
///   3. Convert each pixel to luminance.
///   4. Near-white "paper" pixels → alpha 0 (transparent).
///   5. Remaining "ink" pixels → normalized to a dark color, with alpha
///      graded by how dark the original pixel was (smooths jagged edges).
///   6. Crop to the non-transparent bounds, with padding.
///   7. Encode as PNG.
///
/// The original photograph is only ever read, never written or retained —
/// callers must not persist [sourcePath] beyond this call.
class SignatureCleanup {
  SignatureCleanup._();

  static const maxSourceBytes = 5 * 1024 * 1024;
  static const _maxDimension = 1600;

  /// Normalized luminance (0 = black, 1 = white) above which a pixel is
  /// treated as paper background rather than ink.
  static const _whiteThreshold = 0.82;

  static const _cropPadding = 24;
  static const _allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

  static bool isAllowedExtension(String path) {
    final ext = path.split('.').last.toLowerCase();
    return _allowedExtensions.contains(ext);
  }

  static Future<SignatureCleanupResult> process(String sourcePath) async {
    if (!isAllowedExtension(sourcePath)) {
      throw const SignatureCleanupException(
          'Only JPG, PNG, and WebP images are supported.');
    }
    final file = File(sourcePath);
    final size = await file.length();
    if (size > maxSourceBytes) {
      throw const SignatureCleanupException('Image exceeds 5 MB limit.');
    }

    final bytes = await file.readAsBytes();
    var decoded = img.decodeImage(bytes);
    if (decoded == null) {
      throw const SignatureCleanupException('Could not read this image file.');
    }

    // Downscale very large photographs before per-pixel processing —
    // keeps the loop fast and the exported PNG a reasonable size.
    if (decoded.width > _maxDimension || decoded.height > _maxDimension) {
      decoded = img.copyResize(
        decoded,
        width: decoded.width >= decoded.height ? _maxDimension : null,
        height: decoded.height > decoded.width ? _maxDimension : null,
      );
    }

    final width = decoded.width;
    final height = decoded.height;
    final output = img.Image(width: width, height: height, numChannels: 4);

    // A photographed sheet of paper is rarely an even, pure white across
    // the whole frame — shadows, off-white/cream paper, and uneven phone
    // lighting all leave background pixels well below a fixed luminance
    // threshold, which the old single global cutoff treated as faint ink
    // (showing up as a grey haze around the signature). To compensate,
    // estimate the *local* paper tone via a heavily downsampled copy of the
    // photo: at this resolution thin ink strokes are averaged away, leaving
    // just the lighting/paper-tone gradient. Each pixel's luminance is then
    // normalized against its local background estimate before the existing
    // threshold/alpha logic runs, so paper reads as white regardless of its
    // actual tone or position in a shadow.
    final bgThumbW = math.max(8, math.min(32, (width / 24).round()));
    final bgThumbH = math.max(8, math.min(32, (height / 24).round()));
    final bgThumb = img.copyResize(decoded,
        width: bgThumbW, height: bgThumbH, interpolation: img.Interpolation.average);

    double bgLuminanceAt(int x, int y) {
      final fx = (x / (width - 1).clamp(1, width)) * (bgThumbW - 1);
      final fy = (y / (height - 1).clamp(1, height)) * (bgThumbH - 1);
      final x0 = fx.floor().clamp(0, bgThumbW - 1);
      final y0 = fy.floor().clamp(0, bgThumbH - 1);
      final x1 = (x0 + 1).clamp(0, bgThumbW - 1);
      final y1 = (y0 + 1).clamp(0, bgThumbH - 1);
      final tx = fx - x0;
      final ty = fy - y0;
      final l00 = bgThumb.getPixel(x0, y0).luminanceNormalized;
      final l10 = bgThumb.getPixel(x1, y0).luminanceNormalized;
      final l01 = bgThumb.getPixel(x0, y1).luminanceNormalized;
      final l11 = bgThumb.getPixel(x1, y1).luminanceNormalized;
      final top = l00 * (1 - tx) + l10 * tx;
      final bottom = l01 * (1 - tx) + l11 * tx;
      return top * (1 - ty) + bottom * ty;
    }

    var minX = width, minY = height, maxX = -1, maxY = -1;

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        final rawLum = decoded.getPixel(x, y).luminanceNormalized; // 0=black .. 1=white
        final bg = bgLuminanceAt(x, y).clamp(0.3, 1.0);
        final lum = (rawLum / bg).clamp(0.0, 1.0);
        if (lum >= _whiteThreshold) {
          // Near-white paper — fully transparent.
          output.setPixelRgba(x, y, 0, 0, 0, 0);
          continue;
        }
        // Ink — normalize to a dark color; alpha graded by darkness so
        // edges anti-alias smoothly instead of looking jagged.
        final alphaFactor =
            ((_whiteThreshold - lum) / _whiteThreshold).clamp(0.0, 1.0);
        final alpha = (alphaFactor * 255).round();
        output.setPixelRgba(x, y, 20, 20, 20, alpha);
        if (alpha > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      throw const SignatureCleanupException(
          'No signature detected — try retaking the photo with better contrast.');
    }

    final cropX = (minX - _cropPadding).clamp(0, width - 1);
    final cropY = (minY - _cropPadding).clamp(0, height - 1);
    final cropW = (maxX + _cropPadding - cropX + 1).clamp(1, width - cropX);
    final cropH = (maxY + _cropPadding - cropY + 1).clamp(1, height - cropY);

    final cropped =
        img.copyCrop(output, x: cropX, y: cropY, width: cropW, height: cropH);
    final pngBytes = img.encodePng(cropped);

    final dir = await getTemporaryDirectory();
    final outPath =
        '${dir.path}/signature_${DateTime.now().millisecondsSinceEpoch}.png';
    final pngUint8 = Uint8List.fromList(pngBytes);
    await File(outPath).writeAsBytes(pngUint8, flush: true);

    return SignatureCleanupResult(pngPath: outPath, pngBytes: pngUint8);
  }
}
