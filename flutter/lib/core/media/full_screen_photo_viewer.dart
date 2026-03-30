import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import 'package:setu_mobile/core/media/photo_cache_manager.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';

/// Full-screen pinch-zoom photo gallery.
/// Swipe horizontally between multiple photos.
class FullScreenPhotoViewer extends StatefulWidget {
  final List<String> photoUrls;
  final int initialIndex;

  const FullScreenPhotoViewer({
    super.key,
    required this.photoUrls,
    this.initialIndex = 0,
  });

  static void show(
    BuildContext context,
    List<String> urls, {
    int initialIndex = 0,
  }) {
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => FullScreenPhotoViewer(
          photoUrls: urls,
          initialIndex: initialIndex,
        ),
      ),
    );
  }

  @override
  State<FullScreenPhotoViewer> createState() => _FullScreenPhotoViewerState();
}

class _FullScreenPhotoViewerState extends State<FullScreenPhotoViewer> {
  late int _current;
  late PageController _pageCtrl;

  @override
  void initState() {
    super.initState();
    _current = widget.initialIndex;
    _pageCtrl = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.photoUrls.length;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black87,
        foregroundColor: Colors.white,
        title: Text(
          total > 1 ? '${_current + 1} / $total' : 'Photo',
        ),
      ),
      body: PhotoViewGallery.builder(
        pageController: _pageCtrl,
        itemCount: total,
        onPageChanged: (i) => setState(() => _current = i),
        backgroundDecoration: const BoxDecoration(color: Colors.black),
        builder: (context, index) {
          final url = widget.photoUrls[index];
          final isLocal = PhotoThumbnailStrip.isLocalPath(url);
          final ImageProvider<Object> imageProvider = isLocal
              ? FileImage(File(url.replaceFirst('file://', '')))
                  as ImageProvider<Object>
              : CachedNetworkImageProvider(url,
                  cacheManager: SetuPhotoCacheManager())
                  as ImageProvider<Object>;
          return PhotoViewGalleryPageOptions(
            imageProvider: imageProvider,
            minScale: PhotoViewComputedScale.contained,
            maxScale: PhotoViewComputedScale.covered * 3,
            errorBuilder: (_, __, ___) => const Center(
              child: Icon(Icons.broken_image_outlined,
                  color: Colors.white54, size: 64),
            ),
          );
        },
        loadingBuilder: (_, __) => const Center(
          child: CircularProgressIndicator(color: Colors.white54),
        ),
      ),
    );
  }
}
