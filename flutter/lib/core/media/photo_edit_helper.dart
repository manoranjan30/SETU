import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/image_annotation_page.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/injection_container.dart';

/// Re-opens an already-added observation photo in the annotation editor and
/// returns its replacement URL/path — used by both Quality and EHS site
/// observation sheets, and the checklist observation sheet, so a photo can
/// still be touched up after being added but before the observation itself
/// is submitted.
///
/// [currentUrl] may be a remote URL (already uploaded) or a local `file://`
/// path (saved offline, pending sync) — annotation needs a local source
/// either way, so a remote photo is downloaded to a temp file first.
///
/// Returns null if the user cancelled, or if editing failed (a SnackBar is
/// shown with the reason in that case) — callers should leave the original
/// entry untouched on null.
Future<String?> editAddedPhoto(BuildContext context, String currentUrl) async {
  String? tempDownloadPath;
  try {
    String localSource;
    if (PhotoThumbnailStrip.isLocalPath(currentUrl)) {
      localSource = currentUrl.replaceFirst('file://', '');
    } else {
      final dir = await getTemporaryDirectory();
      tempDownloadPath = p.join(
          dir.path, 'edit_src_${DateTime.now().millisecondsSinceEpoch}.jpg');
      await sl<SetuApiClient>().downloadFile(currentUrl, tempDownloadPath);
      localSource = tempDownloadPath;
    }

    if (!context.mounted) return null;
    final result = await ImageAnnotationPage.show(context, localSource);
    if (result == null) return null;

    final compressed = await PhotoCompressor.compress(result.flattenedImagePath);
    try {
      // Only attempt a re-upload if the photo was already uploaded —
      // mirrors the original picker's online/offline split so a still-
      // pending local photo stays local (and gets picked up by the same
      // sync queue entry) rather than jumping ahead of it.
      final wasRemote = !PhotoThumbnailStrip.isLocalPath(currentUrl);
      if (wasRemote) {
        try {
          final uploadResult =
              await sl<SetuApiClient>().uploadFile(filePath: compressed);
          final newUrl =
              uploadResult['url'] as String? ?? uploadResult['path'] as String? ?? '';
          if (newUrl.isNotEmpty) return newUrl;
        } catch (_) {
          // Fell offline mid-edit — fall through to the local-save path
          // below so the edit isn't lost.
        }
      }
      return await _saveEditedPhotoLocally(compressed);
    } finally {
      await PhotoCompressor.deleteTempFile(compressed);
      await PhotoCompressor.deleteTempFile(result.flattenedImagePath);
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not edit photo: $e'), backgroundColor: Colors.red.shade700),
      );
    }
    return null;
  } finally {
    if (tempDownloadPath != null) {
      await PhotoCompressor.deleteTempFile(tempDownloadPath);
    }
  }
}

/// Persists a compressed, edited photo to the same `pending_obs_photos`
/// directory the observation sheets already use for offline-saved photos,
/// so it survives until [SyncService] uploads it.
Future<String> _saveEditedPhotoLocally(String compressedPath) async {
  final dir = await getApplicationDocumentsDirectory();
  final pendingDir = Directory(p.join(dir.path, 'pending_obs_photos'));
  await pendingDir.create(recursive: true);
  final fileName = '${DateTime.now().millisecondsSinceEpoch}_edited.jpg';
  final dest = File(p.join(pendingDir.path, fileName));
  await File(compressedPath).copy(dest.path);
  return dest.path;
}
