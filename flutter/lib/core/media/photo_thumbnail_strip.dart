import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:setu_mobile/core/media/full_screen_photo_viewer.dart';

/// Horizontal scrollable strip of photo thumbnails.
///
/// Tapping any thumbnail opens [FullScreenPhotoViewer].
/// When [canDelete] is true, each thumbnail shows an ✕ button that calls [onDelete].
class PhotoThumbnailStrip extends StatelessWidget {
  final List<String> photoUrls;
  final bool canDelete;
  final void Function(String url)? onDelete;

  const PhotoThumbnailStrip({
    super.key,
    required this.photoUrls,
    this.canDelete = false,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    if (photoUrls.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(vertical: 2),
        itemCount: photoUrls.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          return _Thumbnail(
            url: photoUrls[i],
            canDelete: canDelete,
            onDelete: onDelete != null ? () => onDelete!(photoUrls[i]) : null,
            onTap: () => FullScreenPhotoViewer.show(
              context,
              photoUrls,
              initialIndex: i,
            ),
          );
        },
      ),
    );
  }
}

class _Thumbnail extends StatelessWidget {
  final String url;
  final bool canDelete;
  final VoidCallback? onDelete;
  final VoidCallback onTap;

  const _Thumbnail({
    required this.url,
    required this.canDelete,
    this.onDelete,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        GestureDetector(
          onTap: onTap,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: CachedNetworkImage(
              imageUrl: url,
              width: 72,
              height: 72,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(
                width: 72,
                height: 72,
                color: Colors.grey.shade200,
                child: const Icon(Icons.photo_outlined,
                    color: Colors.grey, size: 28),
              ),
              errorWidget: (_, __, ___) => Container(
                width: 72,
                height: 72,
                color: Colors.grey.shade200,
                child: const Icon(Icons.broken_image_outlined,
                    color: Colors.grey, size: 28),
              ),
            ),
          ),
        ),
        if (canDelete && onDelete != null)
          Positioned(
            top: -6,
            right: -6,
            child: GestureDetector(
              onTap: onDelete,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: Colors.red.shade600,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
                      blurRadius: 3,
                    ),
                  ],
                ),
                child: const Icon(Icons.close, size: 12, color: Colors.white),
              ),
            ),
          ),
      ],
    );
  }
}
