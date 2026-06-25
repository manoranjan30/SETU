import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Data model
// ─────────────────────────────────────────────────────────────────────────────

enum _AnnotationTool { pen, rectangle, circle, arrow, text }

class _Stroke {
  final String id;
  final _AnnotationTool tool;
  final Color color;
  final double width;
  // pen: all points;  rectangle/circle/arrow: [start, end];  text: [tap position]
  final List<Offset> points;
  final String? text; // text tool only

  _Stroke({
    required this.tool,
    required this.color,
    required this.width,
    required this.points,
    this.text,
    String? id,
  }) : id = id ?? const Uuid().v4();
}

/// Result of [ImageAnnotationPage] — both the flattened raster image (for
/// upload/preview) and the normalized vector shape data (for re-editing or
/// audit) using the *original* image's pixel coordinate space, independent
/// of whatever zoom/pan the user applied while drawing.
class AnnotationResult {
  /// Flattened PNG combining the original image and all annotations.
  final String flattenedImagePath;

  /// Path to a JSON file with the same shape data as [shapesJson] — written
  /// to disk so callers that only deal in file paths (e.g. multipart upload
  /// helpers) don't need to re-serialize it themselves.
  final String shapesJsonPath;

  /// Parsed shape data — see module docs for the schema. Coordinates are in
  /// original-image pixels, not screen/widget pixels.
  final Map<String, dynamic> shapesJson;

  const AnnotationResult({
    required this.flattenedImagePath,
    required this.shapesJsonPath,
    required this.shapesJson,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

/// Full-screen photo annotation editor.
///
/// Shows the photo with drawing tools: pen, rectangle, circle, arrow, text.
/// Supports undo/redo, pinch-zoom/pan (toggled separately from drawing so
/// the two gestures don't fight each other), and exports both a flattened
/// PNG and a normalized-coordinate JSON shape list. [imagePath] itself is
/// never modified or deleted — only read.
class ImageAnnotationPage extends StatefulWidget {
  final String imagePath;

  const ImageAnnotationPage({super.key, required this.imagePath});

  /// Push the annotation editor and return the export result, or null if
  /// the user cancelled.
  static Future<AnnotationResult?> show(BuildContext context, String imagePath) {
    return Navigator.of(context).push<AnnotationResult>(
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
  final List<_Stroke> _redoStack = [];
  _Stroke? _currentStroke;
  final GlobalKey _repaintKey = GlobalKey();
  final TransformationController _viewController = TransformationController();
  bool _busy = false;
  bool _panZoomMode = false;

  // Natural pixel size of the source image — needed to convert on-screen
  // drawing coordinates into the original image's coordinate space.
  int? _imageWidth;
  int? _imageHeight;

  static const _colorOptions = [
    Colors.red,
    Colors.orange,
    Colors.yellow,
    Colors.green,
    Colors.blue,
    Colors.white,
  ];

  @override
  void initState() {
    super.initState();
    _loadImageDimensions();
  }

  @override
  void dispose() {
    _viewController.dispose();
    super.dispose();
  }

  Future<void> _loadImageDimensions() async {
    final bytes = await File(widget.imagePath).readAsBytes();
    final image = await decodeImageFromList(bytes);
    if (!mounted) return;
    setState(() {
      _imageWidth = image.width;
      _imageHeight = image.height;
    });
  }

  // ── Gesture handling ─────────────────────────────────────────────────────

  void _onPanStart(DragStartDetails d) {
    if (_panZoomMode || _tool == _AnnotationTool.text) return;
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
          id: _currentStroke!.id,
          tool: _currentStroke!.tool,
          color: _currentStroke!.color,
          width: _currentStroke!.width,
          points: [..._currentStroke!.points, d.localPosition],
        );
      } else {
        // Rectangle / Circle / Arrow: only track start + end
        _currentStroke = _Stroke(
          id: _currentStroke!.id,
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
        _redoStack.clear(); // a fresh stroke invalidates any pending redo
      }
      _currentStroke = null;
    });
  }

  void _onTapDown(TapDownDetails d) async {
    if (_panZoomMode || _tool != _AnnotationTool.text) return;
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
      _redoStack.clear();
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

  void _undo() {
    if (_strokes.isEmpty) return;
    setState(() => _redoStack.add(_strokes.removeLast()));
  }

  void _redo() {
    if (_redoStack.isEmpty) return;
    setState(() => _strokes.add(_redoStack.removeLast()));
  }

  void _clear() {
    if (_strokes.isEmpty) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear all annotations?'),
        content: const Text('This removes every shape drawn on this photo.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                _redoStack
                  ..clear()
                  ..addAll(_strokes.reversed);
                _strokes.clear();
              });
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
  }

  void _resetZoom() => _viewController.value = Matrix4.identity();

  // ── Coordinate mapping (screen px → original-image px) ──────────────────

  /// Maps a point in the drawing canvas's local coordinate space to the
  /// equivalent pixel position in the *original* (un-zoomed, full-resolution)
  /// image, accounting for the BoxFit.contain letterboxing.
  Offset? _toImageSpace(Offset canvasPoint, Size canvasSize) {
    final iw = _imageWidth?.toDouble();
    final ih = _imageHeight?.toDouble();
    if (iw == null || ih == null || iw == 0 || ih == 0) return null;
    final scale = min(canvasSize.width / iw, canvasSize.height / ih);
    final displayedW = iw * scale;
    final displayedH = ih * scale;
    final offsetX = (canvasSize.width - displayedW) / 2;
    final offsetY = (canvasSize.height - displayedH) / 2;
    return Offset(
      ((canvasPoint.dx - offsetX) / scale).clamp(0, iw),
      ((canvasPoint.dy - offsetY) / scale).clamp(0, ih),
    );
  }

  String _colorToHex(Color c) =>
      '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

  /// Builds the normalized shapes JSON in original-image coordinates.
  Map<String, dynamic>? _buildShapesJson(Size canvasSize) {
    if (_imageWidth == null || _imageHeight == null) return null;
    final shapes = <Map<String, dynamic>>[];
    for (final s in _strokes) {
      final mapped = s.points
          .map((p) => _toImageSpace(p, canvasSize))
          .whereType<Offset>()
          .toList();
      if (mapped.isEmpty) continue;
      final base = {
        'id': s.id,
        'color': _colorToHex(s.color),
        'strokeWidth': s.width,
      };
      switch (s.tool) {
        case _AnnotationTool.pen:
          shapes.add({
            ...base,
            'type': 'pen',
            'points': mapped.map((p) => {'x': p.dx, 'y': p.dy}).toList(),
          });
        case _AnnotationTool.rectangle:
          if (mapped.length < 2) continue;
          final rect = Rect.fromPoints(mapped[0], mapped[1]);
          shapes.add({
            ...base,
            'type': 'rectangle',
            'x': rect.left,
            'y': rect.top,
            'width': rect.width,
            'height': rect.height,
          });
        case _AnnotationTool.circle:
          if (mapped.length < 2) continue;
          final rect = Rect.fromPoints(mapped[0], mapped[1]);
          shapes.add({
            ...base,
            'type': 'circle',
            'x': rect.left,
            'y': rect.top,
            'width': rect.width,
            'height': rect.height,
          });
        case _AnnotationTool.arrow:
          if (mapped.length < 2) continue;
          shapes.add({
            ...base,
            'type': 'arrow',
            'x1': mapped[0].dx,
            'y1': mapped[0].dy,
            'x2': mapped[1].dx,
            'y2': mapped[1].dy,
          });
        case _AnnotationTool.text:
          shapes.add({
            ...base,
            'type': 'text',
            'x': mapped[0].dx,
            'y': mapped[0].dy,
            'text': s.text,
          });
      }
    }
    return {
      'version': 1,
      'imageWidth': _imageWidth,
      'imageHeight': _imageHeight,
      'shapes': shapes,
    };
  }

  // ── Export helpers ────────────────────────────────────────────────────────

  Future<String?> _exportFlattenedPng() async {
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
    final boundary = _repaintKey.currentContext?.findRenderObject()
        as RenderRepaintBoundary?;
    final canvasSize = boundary?.size ?? Size.zero;
    final flattenedPath = await _exportFlattenedPng();
    final shapesJson = _buildShapesJson(canvasSize);
    if (flattenedPath == null || shapesJson == null || !mounted) {
      setState(() => _busy = false);
      return;
    }
    final dir = await getTemporaryDirectory();
    final jsonPath =
        '${dir.path}/ann_shapes_${DateTime.now().millisecondsSinceEpoch}.json';
    await File(jsonPath).writeAsString(jsonEncode(shapesJson));
    if (!mounted) return;
    Navigator.of(context).pop(AnnotationResult(
      flattenedImagePath: flattenedPath,
      shapesJsonPath: jsonPath,
      shapesJson: shapesJson,
    ));
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
            _AppBarActionBtn(
              icon: Icons.undo,
              tooltip: 'Undo',
              enabled: _strokes.isNotEmpty,
              onPressed: _undo,
            ),
            _AppBarActionBtn(
              icon: Icons.redo,
              tooltip: 'Redo',
              enabled: _redoStack.isNotEmpty,
              onPressed: _redo,
            ),
            _AppBarActionBtn(
              icon: Icons.delete_sweep_outlined,
              tooltip: 'Clear all',
              enabled: _strokes.isNotEmpty,
              onPressed: _clear,
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
            child: InteractiveViewer(
              transformationController: _viewController,
              panEnabled: _panZoomMode,
              scaleEnabled: _panZoomMode,
              minScale: 1.0,
              maxScale: 5.0,
              child: GestureDetector(
                // Drawing gestures must be fully unregistered (not just a
                // no-op inside the callback) while pan/zoom mode is active —
                // a GestureDetector with non-null onPan* callbacks wins the
                // gesture arena over InteractiveViewer's own recognizers
                // regardless of what the callback body does, which is why
                // pinch-zoom/pan silently did nothing before this fix.
                onPanStart: _panZoomMode ? null : _onPanStart,
                onPanUpdate: _panZoomMode ? null : _onPanUpdate,
                onPanEnd: _panZoomMode ? null : _onPanEnd,
                onTapDown: _panZoomMode ? null : _onTapDown,
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
                      selected: !_panZoomMode && _tool == _AnnotationTool.pen,
                      onTap: () => setState(() {
                        _panZoomMode = false;
                        _tool = _AnnotationTool.pen;
                      }),
                    ),
                    _ToolBtn(
                      icon: Icons.crop_square_outlined,
                      label: 'Rect',
                      selected: !_panZoomMode && _tool == _AnnotationTool.rectangle,
                      onTap: () => setState(() {
                        _panZoomMode = false;
                        _tool = _AnnotationTool.rectangle;
                      }),
                    ),
                    _ToolBtn(
                      icon: Icons.circle_outlined,
                      label: 'Circle',
                      selected: !_panZoomMode && _tool == _AnnotationTool.circle,
                      onTap: () => setState(() {
                        _panZoomMode = false;
                        _tool = _AnnotationTool.circle;
                      }),
                    ),
                    _ToolBtn(
                      icon: Icons.arrow_forward,
                      label: 'Arrow',
                      selected: !_panZoomMode && _tool == _AnnotationTool.arrow,
                      onTap: () => setState(() {
                        _panZoomMode = false;
                        _tool = _AnnotationTool.arrow;
                      }),
                    ),
                    _ToolBtn(
                      icon: Icons.text_fields,
                      label: 'Text',
                      selected: !_panZoomMode && _tool == _AnnotationTool.text,
                      onTap: () => setState(() {
                        _panZoomMode = false;
                        _tool = _AnnotationTool.text;
                      }),
                    ),
                    _ToolBtn(
                      icon: Icons.pan_tool_alt_outlined,
                      label: 'Pan/Zoom',
                      selected: _panZoomMode,
                      onTap: () => setState(() => _panZoomMode = !_panZoomMode),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(width: 1, height: 30, color: Colors.white24),
                    const SizedBox(width: 10),
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
                    const SizedBox(width: 10),
                    TextButton.icon(
                      onPressed: _resetZoom,
                      icon: const Icon(Icons.zoom_out_map, size: 16, color: Colors.white70),
                      label: const Text('Reset zoom',
                          style: TextStyle(color: Colors.white70, fontSize: 12)),
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

      case _AnnotationTool.rectangle:
        if (s.points.length < 2) return;
        canvas.drawRect(Rect.fromPoints(s.points[0], s.points[1]), paint);

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

/// AppBar action button with a clearly visible highlighted background while
/// [enabled] — a plain color change between white/white24 wasn't visible
/// enough against the dark app bar to tell at a glance whether undo/redo/
/// clear had anything to act on.
class _AppBarActionBtn extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final bool enabled;
  final VoidCallback onPressed;

  const _AppBarActionBtn({
    required this.icon,
    required this.tooltip,
    required this.enabled,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Tooltip(
        message: tooltip,
        child: InkWell(
          onTap: enabled ? onPressed : null,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: enabled ? Colors.white.withValues(alpha: 0.18) : Colors.transparent,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 22,
              color: enabled ? Colors.white : Colors.white24,
            ),
          ),
        ),
      ),
    );
  }
}

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
