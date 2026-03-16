import 'package:flutter/material.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';

/// Horizontal scrollable strip at the bottom of the tower view.
/// One chip per floor — shows name + completion %. Tapping selects the floor.
class FloorLegendBar extends StatefulWidget {
  final TowerRenderModel model;
  final int? selectedFloorIndex;
  final ValueChanged<int> onFloorTapped;

  const FloorLegendBar({
    super.key,
    required this.model,
    required this.selectedFloorIndex,
    required this.onFloorTapped,
  });

  @override
  State<FloorLegendBar> createState() => _FloorLegendBarState();
}

class _FloorLegendBarState extends State<FloorLegendBar> {
  late final ScrollController _scroll;

  @override
  void initState() {
    super.initState();
    _scroll = ScrollController();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final floors = widget.model.floors;
    return Container(
      height: 60,
      color: const Color(0xFF1E293B),
      child: ListView.builder(
        controller: _scroll,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        itemCount: floors.length,
        itemBuilder: (context, i) {
          // Display floors top-to-bottom (reverse render order)
          final idx = floors.length - 1 - i;
          final floor = floors[idx];
          final isSelected = widget.selectedFloorIndex == idx;
          final topColor = widget.model.resolveTopColor(idx);
          final chipColor = topColor.alpha == 0
              ? const Color(0xFF374151)
              : topColor;

          return GestureDetector(
            onTap: () => widget.onFloorTapped(idx),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isSelected
                    ? chipColor
                    : chipColor.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isSelected
                      ? Colors.white.withValues(alpha: 0.8)
                      : chipColor.withValues(alpha: 0.5),
                  width: isSelected ? 1.5 : 0.8,
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    floor.floorName,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: isSelected
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: isSelected
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.7),
                    ),
                  ),
                  Text(
                    '${floor.progressPct.toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontSize: 9,
                      color: isSelected
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.5),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
