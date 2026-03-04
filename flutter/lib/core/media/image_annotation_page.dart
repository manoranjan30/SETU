import 'dart:io';
import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Data model
// ─────────────────────────────────────────────────────────────────────────────

enum _AnnotationTool { pen, circle, arrow, text }

class _Stroke {
  final _AnnotationTool tool;
  final Color color;
  final double width;
  // pen: all points;  circle/arrow: [start, end];  text: [tap position]
  final List<Offset> points;
  final String? text; // text tool only

  const _Stroke({
    required this.tool,
    required this.color,
    required this.width,
    required this.points,
    this.text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

/// Full-screen photo annotation editor.
///
/// Shows the photo with drawing tools: pen, circle, arrow, text.
/// Crop launches the native OS crop UI via [image_cropper].
/// Returns the path to the exported annotated PNG, or null if cancelled.
class ImageAnnotationPage extends StatefulWidget {
  final String imagePath;

  const ImageAnnotationPage({super.key, required this.imagePath});

  /// Push the annotation editor and return the exported annotated image path.
  static Future<String?> show(BuildContext context, String imagePath) {
    return Navigator.of(context).push<String>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => ImageAnnotationPage(imagePath: imagePath),
      ),
    );
  }

  @override
  State<ImageAnnotationPage> createState() => _ImageAnnotationPageState();
}

class _ImageAnnotationPageState extends State<ImageAnnotationPage> {
  _AnnotationTool _tool = _AnnotationTool.pen;
  Color _color = Colors.red;
  double _strokeWidth = 3.0;

  final List<_Stroke> _strokes = [];
  _Stroke? _currentStroke;
  final GlobalKey _repaintKey = GlobalKey();
  bool _busy = false;

  static const _colorOptions = [
    Colors.red,
    Colors.orange,
    Colors.yellow,
    Colors.green,
    Colors.blue,
    Colors.white,
  ];

  // ── Gesture handling ─────────────────────────────────────────────────────

  void _onPanStart(DragStartDetails d) {
    if (_tool == _AnnotationTool.text) return;
    setState(() {
      _currentStroke = _Stroke(
        tool: _tool,
        color: _color,
        width: _strokeWidth,
        points: [d.localPosition],
      );
    });
  }

  void _onPanUpdate(DragUpdateDetails d) {
    if (_currentStroke == null) return;
    setState(() {
      if (_tool == _AnnotationTool.pen) {
        _currentStroke = _Stroke(
          tool: _currentStroke!.tool,
          color: _currentStroke!.color,
          width: _currentStroke!.width,
          points: [..._currentStroke!.points, d.localPosition],
        );
      } else {
        // Circle / Arrow: only track start + end
        _currentStroke = _Stroke(
          tool: _currentStroke!.tool,
          color: _currentStroke!.color,
          width: _currentStroke!.width,
          points: [_currentStroke!.points.first, d.localPosition],
        );
      }
    });
  }

  void _onPanEnd(DragEndDetails _) {
    if (_currentStroke == null) return;
    setState(() {
      if (_currentStroke!.points.length >= 2 ||
          _tool == _AnnotationTool.pen) {
        _strokes.add(_currentStroke!);
      }
      _currentStroke = null;
    });
  }

  void _onTapDown(TapDownDetails d) async {
    if (_tool != _AnnotationTool.text) return;
    final text = await _promptText();
    if (text == null || text.trim().isEmpty || !mounted) return;
    setState(() {
      _strokes.add(_Stroke(
        tool: _AnnotationTool.text,
        color: _color,
        width: _strokeWidth,
        points: [d.localPosition],
        text: text.trim(),
      ));
    });
  }

  Future<String?> _promptText() {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add text label'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Type your label…'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text),
              child: const Text('Add')),
        ],
      ),
    );
  }

  // ── Export helpers ────────────────────────────────────────────────────────

  Future<String?> _exportCurrentView() async {
    final boundary = _repaintKey.currentContext?.findRenderObject()
        as RenderRepaintBoundary?;
    if (boundary == null) return null;
    final ratio = MediaQuery.devicePixelRatioOf(context);
    final img = await boundary.toImage(pixelRatio: ratio);
    final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
    if (bytes == null) return null;
    final dir = await getTemporaryDirectory();
    final path =
        '${dir.path}/ann_${DateTime.now().millisecondsSinceEpoch}.png';
    await File(path).writeAsBytes(bytes.buffer.asUint8List());
    return path;
  }

  Future<void> _done() async {
    setState(() => _busy = true);
    final path = await _exportCurrentView();
    if (path != null && mounted) {
      Navigator.of(context).pop(path);
    } else {
      setState(() => _busy = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black87,
        foregroundColor: Colors.white,
        title: const Text('Annotate Photo'),
        actions: [
          if (_busy)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              ),
            )
          else ...[
            if (_strokes.isNotEmpty)
              IconButton(
                icon: const Icon(Icons.undo),
                tooltip: 'Undo last',
                onPressed: () => setState(() => _strokes.removeLast()),
              ),
            FilledButton(
              onPressed: _done,
              style: FilledButton.styleFrom(
                  backgroundColor: Colors.green.shade600),
              child: const Text('Done'),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
      body: Column(
        children: [
          // ── Drawing canvas ──────────────────────────────────────────────
          Expanded(
            child: GestureDetector(
              onPanStart: _onPanStart,
              onPanUpdate: _onPanUpdate,
              onPanEnd: _onPanEnd,
              onTapDown: _onTapDown,
              child: RepaintBoundary(
                key: _repaintKey,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.file(
                      File(widget.imagePath),
                      fit: BoxFit.contain,
                    ),
                    CustomPaint(
                      painter: _AnnotationPainter(
                        strokes: _strokes,
                        current: _currentStroke,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Tool bar ───────────────────────────────────────────────────
          Container(
            color: Colors.black87,
            padding: const EdgeInsets.fromLTRB(8, 10, 8, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Color swatches
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: _colorOptions.map((c) {
                    final isSelected = _color.toARGB32() == c.toARGB32();
                    return GestureDetector(
                      onTap: () => setState(() => _color = c),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 120),
                        width: 30,
                        height: 30,
                        margin: const EdgeInsets.symmetric(horizontal: 5),
                        decoration: BoxDecoration(
                          color: c,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isSelected
                                ? Colors.white
                                : Colors.transparent,
                            width: 2.5,
                          ),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: Colors.white
                                        .withValues(alpha: 0.5),
                                    blurRadius: 8,
                                  )
                                ]
                              : null,
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 10),

                // Tool buttons + stroke width
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _ToolBtn(
                      icon: Icons.draw_outlined,
                      label: 'Pen',
                      selected: _tool == _AnnotationTool.pen,
                      onTap: () =>
                          setState(() => _tool = _AnnotationTool.pen),
                    ),
                    _ToolBtn(
                      icon: Icons.circle_outlined,
                      label: 'Circle',
                      selected: _tool == _AnnotationTool.circle,
                      onTap: () =>
                          setState(() => _tool = _AnnotationTool.circle),
                    ),
                    _ToolBtn(
                      icon: Icons.arrow_forward,
                      label: 'Arrow',
                      selected: _tool == _AnnotationTool.arrow,
                      onTap: () =>
                          setState(() => _tool = _AnnotationTool.arrow),
                    ),
                    _ToolBtn(
                      icon: Icons.text_fields,
                      label: 'Text',
                      selected: _tool == _AnnotationTool.text,
                      onTap: () =>
                          setState(() => _tool = _AnnotationTool.text),
                    ),
                    Container(
                        width: 1, height: 36, color: Colors.white24),
                    // Stroke widths
                    _WidthBtn(
                      dotSize: 3,
                      selected: _strokeWidth == 2,
                      onTap: () => setState(() => _strokeWidth = 2),
                    ),
                    _WidthBtn(
                      dotSize: 5,
                      selected: _strokeWidth == 4,
                      onTap: () => setState(() => _strokeWidth = 4),
                    ),
                    _WidthBtn(
                      dotSize: 8,
                      selected: _strokeWidth == 7,
                      onTap: () => setState(() => _strokeWidth = 7),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Annotation painter
// ─────────────────────────────────────────────────────────────────────────────

class _AnnotationPainter extends CustomPainter {
  final List<_Stroke> strokes;
  final _Stroke? current;

  const _AnnotationPainter({required this.strokes, this.current});

  @override
  void paint(Canvas canvas, Size size) {
    final all = [...strokes, if (current != null) current!];
    for (final stroke in all) {
      _draw(canvas, stroke);
    }
  }

  void _draw(Canvas canvas, _Stroke s) {
    final paint = Paint()
      ..color = s.color
      ..strokeWidth = s.width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    switch (s.tool) {
      case _AnnotationTool.pen:
        if (s.points.length < 2) return;
        final path = Path()
          ..moveTo(s.points[0].dx, s.points[0].dy);
        for (var i = 1; i < s.points.length; i++) {
          path.lineTo(s.points[i].dx, s.points[i].dy);
        }
        canvas.drawPath(path, paint);

      case _AnnotationTool.circle:
        if (s.points.length < 2) return;
        canvas.drawOval(Rect.fromPoints(s.points[0], s.points[1]), paint);

      case _AnnotationTool.arrow:
        if (s.points.length < 2) return;
        final start = s.points[0];
        final end = s.points[1];
        canvas.drawLine(start, end, paint);
        // Arrowhead
        const headLen = 18.0;
        const headAngle = 0.42;
        final angle = atan2(end.dy - start.dy, end.dx - start.dx);
        final p1 = Offset(
          end.dx - headLen * cos(angle - headAngle),
          end.dy - headLen * sin(angle - headAngle),
        );
        final p2 = Offset(
          end.dx - headLen * cos(angle + headAngle),
          end.dy - headLen * sin(angle + headAngle),
        );
        canvas.drawLine(end, p1, paint);
        canvas.drawLine(end, p2, paint);

      case _AnnotationTool.text:
        if (s.text == null || s.points.isEmpty) return;
        final fontSize = s.width * 5.0 + 10.0;
        final tp = TextPainter(
          text: TextSpan(
            text: s.text,
            style: TextStyle(
              color: s.color,
              fontSize: fontSize,
              fontWeight: FontWeight.bold,
              shadows: [
                Shadow(
                  blurRadius: 4,
                  color: Colors.black.withValues(alpha: 0.85),
                  offset: const Offset(1, 1),
                ),
              ],
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, s.points[0]);
    }
  }

  @override
  bool shouldRepaint(_AnnotationPainter old) => true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar micro-widgets
// ─────────────────────────────────────────────────────────────────────────────

class _ToolBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ToolBtn({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 130),
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: selected
                  ? Colors.white.withValues(alpha: 0.22)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              icon,
              color: selected ? Colors.white : Colors.white54,
              size: 22,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: selected ? Colors.white : Colors.white54,
            ),
          ),
        ],
      ),
    );
  }
}

class _WidthBtn extends StatelessWidget {
  final double dotSize;
  final bool selected;
  final VoidCallback onTap;

  const _WidthBtn({
    required this.dotSize,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected
              ? Colors.white.withValues(alpha: 0.18)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Container(
          width: dotSize * 3,
          height: dotSize,
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.white54,
            borderRadius: BorderRadius.circular(dotSize),
          ),
        ),
      ),
    );
  }
}
