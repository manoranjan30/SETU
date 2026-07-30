import 'dart:io';

import 'package:flutter/material.dart';
import 'package:setu_mobile/features/quality/data/batch_slip_parser.dart';

/// Review-before-apply screen for a batch-slip OCR scan, per the UX
/// direction in docs/mobile-handoff-batch-slip-scan-config.md: image
/// preview, per-field confidence, quick edit, and a single confirmation
/// action rather than silently writing OCR output into the form.
///
/// Pops with a `Map<BatchSlipFieldKey, String>` of the (possibly
/// hand-edited) field values to apply if confirmed, or `null` if the user
/// cancelled — the caller decides how to apply those into its own
/// controllers.
class BatchSlipReviewPage extends StatefulWidget {
  final String imagePath;
  final BatchSlipExtraction extraction;

  const BatchSlipReviewPage({super.key, required this.imagePath, required this.extraction});

  @override
  State<BatchSlipReviewPage> createState() => _BatchSlipReviewPageState();
}

class _BatchSlipReviewPageState extends State<BatchSlipReviewPage> {
  late final Map<BatchSlipFieldKey, TextEditingController> _controllers;

  @override
  void initState() {
    super.initState();
    _controllers = {
      for (final key in BatchSlipFieldKey.values)
        key: TextEditingController(text: _initialText(key)),
    };
  }

  String _initialText(BatchSlipFieldKey key) {
    final result = widget.extraction.byKey(key);
    return result.value?.toString() ?? '';
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _confirm() {
    final values = {for (final e in _controllers.entries) e.key: e.value.text.trim()};
    Navigator.of(context).pop(values);
  }

  @override
  Widget build(BuildContext context) {
    final highConfidence = BatchSlipFieldKey.values
        .where((k) => widget.extraction.byKey(k).confidence == BatchSlipFieldConfidence.high)
        .toList();
    final needsReview = BatchSlipFieldKey.values
        .where((k) => widget.extraction.byKey(k).confidence != BatchSlipFieldConfidence.high)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review Scanned Slip', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: AspectRatio(
              aspectRatio: 4 / 3,
              child: Image.file(File(widget.imagePath), fit: BoxFit.cover),
            ),
          ),
          const SizedBox(height: 16),
          if (highConfidence.isNotEmpty) ...[
            Text('Matched Fields', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
            const SizedBox(height: 8),
            for (final key in highConfidence) _FieldRow(fieldKey: key, controller: _controllers[key]!, confidence: BatchSlipFieldConfidence.high),
            const SizedBox(height: 16),
          ],
          if (needsReview.isNotEmpty) ...[
            Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: Colors.orange.shade700),
                const SizedBox(width: 4),
                Text('Needs Review', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.orange.shade800)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'These weren\'t confidently matched — check or fill them in before confirming.',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 8),
            for (final key in needsReview)
              _FieldRow(
                fieldKey: key,
                controller: _controllers[key]!,
                confidence: widget.extraction.byKey(key).confidence,
              ),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _confirm,
                  icon: const Icon(Icons.check, size: 18),
                  label: const Text('Confirm & Fill'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FieldRow extends StatelessWidget {
  final BatchSlipFieldKey fieldKey;
  final TextEditingController controller;
  final BatchSlipFieldConfidence confidence;

  const _FieldRow({required this.fieldKey, required this.controller, required this.confidence});

  @override
  Widget build(BuildContext context) {
    final badge = switch (confidence) {
      BatchSlipFieldConfidence.high => const _Badge(label: 'Matched', color: Colors.green),
      BatchSlipFieldConfidence.low => const _Badge(label: 'Low confidence', color: Colors.orange),
      BatchSlipFieldConfidence.none => const _Badge(label: 'Not found', color: Colors.grey),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          labelText: fieldKey.displayLabel,
          labelStyle: const TextStyle(fontSize: 12),
          border: const OutlineInputBorder(),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          isDense: true,
          suffixIcon: Padding(padding: const EdgeInsets.only(right: 8), child: Center(widthFactor: 1, child: badge)),
          suffixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final MaterialColor color;
  const _Badge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(color: color.shade50, borderRadius: BorderRadius.circular(4), border: Border.all(color: color.shade200)),
      child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color.shade800)),
    );
  }
}
