import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';

/// Records the tappable hit area for a single floor.
/// The page's GestureDetector uses this list to detect which floor was tapped.
class FloorHitArea {
  final int floorIndex;
  final Path topFacePath;
  final Path frontFacePath;

  const FloorHitArea({
    required this.floorIndex,
    required this.topFacePath,
    required this.frontFacePath,
  });

  /// Returns true if [point] falls within either visible face of this floor.
  bool contains(Offset point) =>
      topFacePath.contains(point) || frontFacePath.contains(point);
}

/// Renders a multi-floor building in isometric 2.5D projection using CustomPainter.
///
/// Geometry:
///   Each floor = isometric box with 3 visible faces (top, front-left, front-right).
///   Top face = rhombus (diamond) shape — colored by progress/quality/EHS mode.
///   Left face = slightly darker shade for depth illusion.
///   Right face = darkest shade for depth illusion.
///   Ghost floors (not started) = dashed wireframe only, no fill.
///
/// Isometric projection formula used:
///   back   = Offset(cx,           baseY - z)           ← top of diamond
///   right  = Offset(cx + fw/2,    baseY - z + fd)      ← right of diamond
///   front  = Offset(cx,           baseY - z + 2*fd)    ← bottom of diamond
///   left   = Offset(cx - fw/2,    baseY - z + fd)      ← left of diamond
///
/// Where:
///   fw  = floor width in screen pixels
///   fd  = floor depth perspective = fw / 4  (2:1 isometric ratio)
///   fh  = floor height in screen pixels
///   z   = floorIndex * fh  (elevation)
///   cx  = horizontal center of canvas
///   baseY = vertical baseline (bottom of building)
///
/// Animation:
///   [buildProgress] (0.0→1.0) drives the stacking build-up animation.
///   [rotationAngle] (−π/12 to π/12) applies a parallax skew for finger-drag.
///   [scale] (0.5–2.5) applied via canvas transform for pinch zoom.
///   [selectedLift] (0–4 px) lifts the selected floor.
///
/// Hit testing:
///   After each paint(), [hitAreas] is populated with [FloorHitArea] objects.
///   The parent widget reads this list in its GestureDetector.onTapUp handler.
class IsometricBuildingPainter extends CustomPainter {
  final TowerRenderModel model;
  final double buildProgress;   // 0.0 to 1.0 — stacking animation
  final double rotationAngle;   // −π/12 to π/12 — parallax drag rotation
  final double scale;           // 0.5 to 2.5 — pinch zoom
  final double selectedLift;    // 0 to 4 — lift of selected floor in px
  final double pulseOpacity;    // 0.3 to 0.8 — active floor pulse alpha

  // Hit areas populated during paint() — read by parent GestureDetector
  final List<FloorHitArea> hitAreas;

  // Visual constants
  static const double _floorWidth = 200.0;   // screen px, full diamond width
  static const double _floorDepth = 50.0;    // fd = fw/4 for 2:1 isometric ratio
  static const double _floorHeight = 28.0;   // vertical px per floor
  static const double _ghostDash = 5.0;
  static const double _ghostGap = 4.0;

  const IsometricBuildingPainter({
    required this.model,
    required this.hitAreas,
    this.buildProgress = 1.0,
    this.rotationAngle = 0.0,
    this.scale = 1.0,
    this.selectedLift = 0.0,
    this.pulseOpacity = 0.6,
  });

  @override
  void paint(Canvas canvas, Size size) {
    hitAreas.clear();

    // Total height occupied by all floors in the building
    final totalFloors = model.floors.length;
    final buildingScreenH = totalFloors * _floorHeight + _floorDepth * 2;

    // Center the building on canvas. Shift upward slightly for aesthetic balance.
    final cx = size.width / 2;
    // baseY: the bottom-most point of the lowest floor's front vertex
    final baseY = size.height * 0.55 + buildingScreenH / 2;

    canvas.save();

    // Apply parallax rotation skew — cheap "rotate" effect via matrix skew
    if (rotationAngle != 0) {
      final matrix = Matrix4.identity()
        ..translate(cx, baseY)
        ..rotateZ(rotationAngle * 0.06)  // subtle tilt
        ..translate(-cx, -baseY);
      canvas.transform(matrix.storage);
    }

    // Apply pinch zoom (centered on canvas center)
    if (scale != 1.0) {
      canvas.translate(cx, baseY);
      canvas.scale(scale);
      canvas.translate(-cx, -baseY);
    }

    // Draw floors BOTTOM to TOP so upper floors correctly overlap lower ones
    // (painter's algorithm for correct layering)
    final visibleFloorCount = (totalFloors * buildProgress).ceil()
        .clamp(0, totalFloors);

    for (int i = 0; i < totalFloors; i++) {
      if (i < visibleFloorCount) {
        _drawSolidFloor(canvas, i, cx, baseY);
      } else {
        // Floors beyond buildProgress are shown as ghost
        _drawGhostFloor(canvas, i, cx, baseY);
      }
    }

    // Draw overlay markers (quality dots, EHS triangles, active pulse)
    for (int i = 0; i < visibleFloorCount; i++) {
      _drawOverlayMarkers(canvas, i, cx, baseY);
    }

    canvas.restore();
  }

  // ─── Floor vertex computation ─────────────────────────────────────────────

  /// Returns the 4 isometric vertices of the TOP FACE of floor [i].
  /// back = top of diamond, right = right, front = bottom, left = left.
  _FloorVertices _getVertices(int floorIndex, double cx, double baseY, {double liftPx = 0}) {
    // z = elevation of TOP of this floor (in screen pixels from baseY going up)
    final zTop = (floorIndex + 1) * _floorHeight + liftPx;
    final zBot = floorIndex * _floorHeight + liftPx;

    // Compute the 4 diamond points at the TOP of the floor
    final back  = Offset(cx,             baseY - zTop);
    final right = Offset(cx + _floorWidth / 2, baseY - zTop + _floorDepth);
    final front = Offset(cx,             baseY - zTop + _floorDepth * 2);
    final left  = Offset(cx - _floorWidth / 2, baseY - zTop + _floorDepth);

    // Bottom counterparts (same x, just lower by floorHeight)
    final backBot  = Offset(cx,             baseY - zBot);
    final rightBot = Offset(cx + _floorWidth / 2, baseY - zBot + _floorDepth);
    final frontBot = Offset(cx,             baseY - zBot + _floorDepth * 2);
    final leftBot  = Offset(cx - _floorWidth / 2, baseY - zBot + _floorDepth);

    return _FloorVertices(
      back: back, right: right, front: front, left: left,
      backBot: backBot, rightBot: rightBot, frontBot: frontBot, leftBot: leftBot,
    );
  }

  // ─── Solid floor rendering ────────────────────────────────────────────────

  void _drawSolidFloor(Canvas canvas, int i, double cx, double baseY) {
    final isSelected = model.selectedFloorIndex == i;
    final lift = isSelected ? selectedLift : 0.0;
    final v = _getVertices(i, cx, baseY, liftPx: lift);
    final floor = model.floors[i];

    final topColor = model.resolveTopColor(i);
    final outlineColor = model.resolveOutlineColor(i);

    // Ghost floors (0% and no activities) still draw as solid but transparent
    if (model.isGhost(i)) {
      _drawGhostFloor(canvas, i, cx, baseY);
      return;
    }

    // ── Right visible face (front-right) ──────────────────────────
    // Vertices: back → right → rightBot → backBot  (right side of building)
    final rightFacePath = Path()
      ..moveTo(v.back.dx,     v.back.dy)
      ..lineTo(v.right.dx,    v.right.dy)
      ..lineTo(v.rightBot.dx, v.rightBot.dy)
      ..lineTo(v.backBot.dx,  v.backBot.dy)
      ..close();

    final rightColor = _darken(topColor, 0.45);
    canvas.drawPath(rightFacePath, Paint()
      ..color = rightColor
      ..style = PaintingStyle.fill);

    // ── Left visible face (front-left) ────────────────────────────
    // Vertices: left → front → frontBot → leftBot  (left side of building)
    final leftFacePath = Path()
      ..moveTo(v.left.dx,     v.left.dy)
      ..lineTo(v.front.dx,    v.front.dy)
      ..lineTo(v.frontBot.dx, v.frontBot.dy)
      ..lineTo(v.leftBot.dx,  v.leftBot.dy)
      ..close();

    final leftColor = _darken(topColor, 0.28);
    canvas.drawPath(leftFacePath, Paint()
      ..color = leftColor
      ..style = PaintingStyle.fill);

    // ── Top face (rhombus / diamond) ──────────────────────────────
    final topFacePath = Path()
      ..moveTo(v.back.dx,  v.back.dy)
      ..lineTo(v.right.dx, v.right.dy)
      ..lineTo(v.front.dx, v.front.dy)
      ..lineTo(v.left.dx,  v.left.dy)
      ..close();

    canvas.drawPath(topFacePath, Paint()
      ..color = topColor
      ..style = PaintingStyle.fill);

    // ── Progress fill bar on front face (visible when zoomed in) ──
    if (scale > 1.3 && floor.progressPct > 0 && floor.progressPct < 100) {
      _drawProgressFillBar(canvas, i, v, floor.progressPct);
    }

    // ── Outline strokes ───────────────────────────────────────────
    final outlinePaint = Paint()
      ..color = outlineColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = isSelected ? 1.8 : 0.8;

    // Top face outline
    canvas.drawPath(topFacePath, outlinePaint);

    // Visible vertical edges (right and left)
    canvas.drawLine(v.back, v.backBot, outlinePaint);
    canvas.drawLine(v.right, v.rightBot, outlinePaint);
    canvas.drawLine(v.left, v.leftBot, outlinePaint);
    canvas.drawLine(v.front, v.frontBot, outlinePaint);

    // Bottom edge of visible faces
    canvas.drawLine(v.backBot, v.rightBot, outlinePaint);
    canvas.drawLine(v.leftBot, v.frontBot, outlinePaint);
    canvas.drawLine(v.rightBot, v.frontBot, outlinePaint);

    // ── Register hit area for tap detection ───────────────────────
    hitAreas.add(FloorHitArea(
      floorIndex: i,
      topFacePath: topFacePath,
      frontFacePath: leftFacePath, // front-left is the most tapable face
    ));
  }

  // ─── Ghost (wireframe) floor ──────────────────────────────────────────────

  void _drawGhostFloor(Canvas canvas, int i, double cx, double baseY) {
    final v = _getVertices(i, cx, baseY);

    final ghostPaint = Paint()
      ..color = const Color(0xFF9CA3AF).withValues(alpha: 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8;

    // Draw dashed outline for top face diamond
    _drawDashedLine(canvas, v.back, v.right, ghostPaint);
    _drawDashedLine(canvas, v.right, v.front, ghostPaint);
    _drawDashedLine(canvas, v.front, v.left, ghostPaint);
    _drawDashedLine(canvas, v.left, v.back, ghostPaint);

    // Vertical edges
    _drawDashedLine(canvas, v.back, v.backBot, ghostPaint);
    _drawDashedLine(canvas, v.right, v.rightBot, ghostPaint);
    _drawDashedLine(canvas, v.left, v.leftBot, ghostPaint);
    _drawDashedLine(canvas, v.front, v.frontBot, ghostPaint);

    // Bottom edges
    _drawDashedLine(canvas, v.backBot, v.rightBot, ghostPaint);
    _drawDashedLine(canvas, v.leftBot, v.frontBot, ghostPaint);

    // Register hit area so ghost floors are also tappable
    final topFacePath = Path()
      ..moveTo(v.back.dx, v.back.dy)
      ..lineTo(v.right.dx, v.right.dy)
      ..lineTo(v.front.dx, v.front.dy)
      ..lineTo(v.left.dx, v.left.dy)
      ..close();
    hitAreas.add(FloorHitArea(
      floorIndex: i,
      topFacePath: topFacePath,
      frontFacePath: topFacePath,
    ));
  }

  // ─── Overlay markers ─────────────────────────────────────────────────────

  void _drawOverlayMarkers(Canvas canvas, int i, double cx, double baseY) {
    final floor = model.floors[i];
    final v = _getVertices(i, cx, baseY,
        liftPx: model.selectedFloorIndex == i ? selectedLift : 0.0);

    // Center of the front-left face — good anchor for markers
    final faceCenter = Offset(
      (v.left.dx + v.front.dx) / 2,
      (v.left.dy + v.front.dy + v.leftBot.dy + v.frontBot.dy) / 4,
    );

    // ── Quality observation dot (top-left area of front face) ────
    if (floor.openQualityObs > 0) {
      final dotPos = faceCenter.translate(-18, -6);
      final dotColor = floor.openQualityObs >= 4
          ? const Color(0xFFEF4444)
          : const Color(0xFFF59E0B);
      _drawLabeledDot(canvas, dotPos, dotColor, '${floor.openQualityObs}');
    }

    // ── EHS warning triangle (top-right area of front face) ──────
    if (floor.openEhsObs > 0) {
      final triPos = faceCenter.translate(16, -6);
      _drawWarningTriangle(canvas, triPos, const Color(0xFFF97316));
    }

    // ── Active work pulse dot (center of top face) ────────────────
    if (floor.hasActiveWork) {
      final topCenter = Offset(cx, (v.back.dy + v.front.dy) / 2);
      final pulsePaint = Paint()
        ..color = const Color(0xFF2563EB).withValues(alpha: pulseOpacity)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(topCenter, 5.0, pulsePaint);
      // Outer ring
      canvas.drawCircle(
        topCenter,
        8.0,
        Paint()
          ..color = const Color(0xFF2563EB).withValues(alpha: pulseOpacity * 0.4)
          ..style = PaintingStyle.fill,
      );
    }

    // ── Rejected RFI stripe on top face ──────────────────────────
    if (floor.rejectedRfis > 0) {
      _drawRejectedStripe(canvas, v);
    }
  }

  // ─── Detail helpers ───────────────────────────────────────────────────────

  /// Draws a small progress fill bar on the front face (shown when zoomed).
  void _drawProgressFillBar(
      Canvas canvas, int i, _FloorVertices v, double pct) {
    final barLeft = v.leftBot.dx + 6;
    final barRight = v.frontBot.dx - 6;
    final barY = v.leftBot.dy - 4;
    final barWidth = barRight - barLeft;

    // Background track
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(barLeft, barY - 3, barWidth, 3),
        const Radius.circular(2),
      ),
      Paint()..color = Colors.white.withValues(alpha: 0.3),
    );

    // Fill
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(barLeft, barY - 3, barWidth * (pct / 100), 3),
        const Radius.circular(2),
      ),
      Paint()..color = Colors.white.withValues(alpha: 0.8),
    );
  }

  /// Draws a small colored circle with a number label (for observation count).
  void _drawLabeledDot(Canvas canvas, Offset pos, Color color, String label) {
    canvas.drawCircle(pos, 7, Paint()..color = color);
    final tp = TextPainter(
      text: TextSpan(
        text: label,
        style: const TextStyle(
            color: Colors.white, fontSize: 7, fontWeight: FontWeight.bold),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, pos.translate(-tp.width / 2, -tp.height / 2));
  }

  /// Draws a small orange warning triangle for EHS markers.
  void _drawWarningTriangle(Canvas canvas, Offset pos, Color color) {
    final path = Path()
      ..moveTo(pos.dx, pos.dy - 7)
      ..lineTo(pos.dx + 6, pos.dy + 4)
      ..lineTo(pos.dx - 6, pos.dy + 4)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
    // "!" label
    final tp = TextPainter(
      text: TextSpan(
        text: '!',
        style: const TextStyle(
            color: Colors.white, fontSize: 7, fontWeight: FontWeight.bold),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas,
        pos.translate(-tp.width / 2, -tp.height / 2 + 1));
  }

  /// Draws diagonal red stripes on the top face to indicate a rejected RFI.
  void _drawRejectedStripe(Canvas canvas, _FloorVertices v) {
    final clip = Path()
      ..moveTo(v.back.dx, v.back.dy)
      ..lineTo(v.right.dx, v.right.dy)
      ..lineTo(v.front.dx, v.front.dy)
      ..lineTo(v.left.dx, v.left.dy)
      ..close();

    canvas.save();
    canvas.clipPath(clip);

    final stripePaint = Paint()
      ..color = const Color(0xFFEF4444).withValues(alpha: 0.35)
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke;

    // Draw diagonal lines across the top face bounding box
    final bounds = clip.getBounds();
    for (double x = bounds.left - bounds.height;
        x < bounds.right + bounds.height;
        x += 10) {
      canvas.drawLine(
        Offset(x, bounds.top),
        Offset(x + bounds.height, bounds.bottom),
        stripePaint,
      );
    }

    canvas.restore();
  }

  /// Draws a dashed line between two points.
  void _drawDashedLine(Canvas canvas, Offset start, Offset end, Paint paint) {
    final total = (end - start).distance;
    if (total == 0) return;
    final dir = (end - start) / total;
    double drawn = 0;
    bool dash = true;
    while (drawn < total) {
      final segLen = dash ? _ghostDash : _ghostGap;
      final segEnd = math.min(drawn + segLen, total);
      if (dash) {
        canvas.drawLine(
          start + dir * drawn,
          start + dir * segEnd,
          paint,
        );
      }
      drawn = segEnd;
      dash = !dash;
    }
  }

  /// Returns a darkened version of [color] by [factor] (0 = black, 1 = unchanged).
  Color _darken(Color color, double factor) {
    if (color.alpha == 0) return color;
    return Color.fromARGB(
      color.alpha,
      (color.red * factor).round().clamp(0, 255),
      (color.green * factor).round().clamp(0, 255),
      (color.blue * factor).round().clamp(0, 255),
    );
  }

  @override
  bool shouldRepaint(IsometricBuildingPainter oldDelegate) {
    return oldDelegate.model != model ||
        oldDelegate.buildProgress != buildProgress ||
        oldDelegate.rotationAngle != rotationAngle ||
        oldDelegate.scale != scale ||
        oldDelegate.selectedLift != selectedLift ||
        oldDelegate.pulseOpacity != pulseOpacity;
  }
}

/// Internal struct holding the 8 isometric vertices of a floor box.
class _FloorVertices {
  final Offset back, right, front, left;         // top face corners
  final Offset backBot, rightBot, frontBot, leftBot; // bottom face corners

  const _FloorVertices({
    required this.back,
    required this.right,
    required this.front,
    required this.left,
    required this.backBot,
    required this.rightBot,
    required this.frontBot,
    required this.leftBot,
  });
}
