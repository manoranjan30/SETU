import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Opens the native date picker and writes the result into [controller]
/// using [format] (default ISO `yyyy-MM-dd`).
///
/// If [controller] already holds a date string parseable with [format],
/// the picker opens pre-selected on that date instead of today — this
/// matters when editing a record that already has a saved date.
Future<void> pickDateInto(
  BuildContext context,
  TextEditingController controller, {
  String format = 'yyyy-MM-dd',
  DateTime? firstDate,
  DateTime? lastDate,
  VoidCallback? onPicked,
}) async {
  final df = DateFormat(format);
  final now = DateTime.now();
  var initial = now;
  if (controller.text.trim().isNotEmpty) {
    try {
      initial = df.parseStrict(controller.text.trim());
    } catch (_) {
      // Unparseable existing text (e.g. legacy free-typed value) — fall
      // back to today rather than letting showDatePicker throw.
    }
  }

  final picked = await showDatePicker(
    context: context,
    initialDate: initial,
    firstDate: firstDate ?? DateTime(now.year - 10),
    lastDate: lastDate ?? DateTime(now.year + 10),
  );
  if (picked == null) return;

  controller.text = df.format(picked);
  onPicked?.call();
}
