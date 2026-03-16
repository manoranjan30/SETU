import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';

/// Horizontal scrollable photo thumbnail strip with cached loading.
/// Tapping a thumbnail opens a fullscreen swipe-able gallery.
/// Replaces the duplicate _PhotoStrip + _FullscreenGallery pattern in detail pages.
class PhotoGalleryStrip extends StatelessWidget {
  final List<String> urls;
  final double thumbSize;

  const PhotoGalleryStrip({
    super.key,
    required this.urls,
    this.thumbSize = 72,
  });

  @override
  Widget build(BuildContext context) {
    if (urls.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: thumbSize,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: urls.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) => GestureDetector(
          onTap: () => _openGallery(context, i),
          child: Hero(
            tag: 'photo_${urls[i]}',
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedNetworkImage(
                imageUrl: urls[i],
                width: thumbSize,
                height: thumbSize,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(
                  width: thumbSize,
                  height: thumbSize,
                  color: Colors.grey.shade200,
                  child: const Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
                errorWidget: (_, __, ___) => Container(
                  width: thumbSize,
                  height: thumbSize,
                  color: Colors.grey.shade200,
                  child: const Icon(
                    Icons.broken_image_outlined,
                    color: Colors.grey,
                    size: 22,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _openGallery(BuildContext context, int initial) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (_, __, ___) =>
            _FullscreenGallery(urls: urls, initial: initial),
        transitionDuration: const Duration(milliseconds: 280),
        transitionsBuilder: (_, animation, __, child) => FadeTransition(
          opacity: animation,
          child: child,
        ),
      ),
    );
  }
}

// ─── Fullscreen gallery ───────────────────────────────────────────────────────

class _FullscreenGallery extends StatefulWidget {
  final List<String> urls;
  final int initial;

  const _FullscreenGallery({required this.urls, required this.initial});

  @override
  State<_FullscreenGallery> createState() => _FullscreenGalleryState();
}

class _FullscreenGalleryState extends State<_FullscreenGallery> {
  late int _current;
  late final PageController _pageCtrl;

  @override
  void initState() {
    super.initState();
    _current = widget.initial;
    _pageCtrl = PageController(initialPage: widget.initial);
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(
          '${_current + 1} / ${widget.urls.length}',
          style: const TextStyle(color: Colors.white, fontSize: 15),
        ),
        elevation: 0,
      ),
      body: PhotoViewGallery.builder(
        pageController: _pageCtrl,
        itemCount: widget.urls.length,
        onPageChanged: (i) => setState(() => _current = i),
        builder: (_, i) => PhotoViewGalleryPageOptions(
          imageProvider: CachedNetworkImageProvider(widget.urls[i]),
          minScale: PhotoViewComputedScale.contained,
          maxScale: PhotoViewComputedScale.covered * 3,
          heroAttributes: PhotoViewHeroAttributes(tag: 'photo_${widget.urls[i]}'),
        ),
        loadingBuilder: (_, event) => Center(
          child: CircularProgressIndicator(
            value: event == null || event.expectedTotalBytes == null
                ? null
                : event.cumulativeBytesLoaded / event.expectedTotalBytes!,
            color: Colors.white,
          ),
        ),
        backgroundDecoration: const BoxDecoration(color: Colors.black),
      ),
    );
  }
}
