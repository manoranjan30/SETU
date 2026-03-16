import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// Generic shimmer placeholder list shown during initial page load.
/// Mimics the actual observation card layout (badge row + text lines + meta row).
class ShimmerList extends StatelessWidget {
  final int itemCount;
  final double cardHeight;
  final EdgeInsets padding;

  const ShimmerList({
    super.key,
    this.itemCount = 6,
    this.cardHeight = 104,
    this.padding = const EdgeInsets.fromLTRB(12, 8, 12, 16),
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, __) => _ShimmerCard(height: cardHeight),
    );
  }
}

class _ShimmerCard extends StatelessWidget {
  final double height;
  const _ShimmerCard({required this.height});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = isDark ? Colors.grey.shade700 : Colors.grey.shade200;
    final highlight = isDark ? Colors.grey.shade600 : Colors.grey.shade50;

    return Shimmer.fromColors(
      baseColor: base,
      highlightColor: highlight,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: base),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Badge row
            Row(
              children: [
                _Rect(width: 62, height: 20, radius: 20),
                const SizedBox(width: 8),
                _Rect(width: 52, height: 20, radius: 20),
                const SizedBox(width: 8),
                _Rect(width: 70, height: 20, radius: 20),
              ],
            ),
            const SizedBox(height: 10),
            // Description
            _Rect(width: double.infinity, height: 14, radius: 4),
            const SizedBox(height: 6),
            _Rect(width: 220, height: 12, radius: 4),
            const Spacer(),
            // Meta row
            Row(
              children: [
                _Rect(width: 90, height: 11, radius: 4),
                const Spacer(),
                _Rect(width: 64, height: 11, radius: 4),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Rect extends StatelessWidget {
  final double width;
  final double height;
  final double radius;

  const _Rect({
    required this.width,
    required this.height,
    required this.radius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}
