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

/// Opens the native time picker and writes the result into [controller] as
/// 24-hour `HH:mm` (e.g. `14:05`).
///
/// If [controller] already holds a parseable `HH:mm` value, the picker
/// opens pre-selected on that time instead of "now" — matters when editing
/// a record that already has a saved time.
Future<void> pickTimeInto(
  BuildContext context,
  TextEditingController controller, {
  VoidCallback? onPicked,
}) async {
  var initial = TimeOfDay.now();
  final existing = controller.text.trim();
  if (existing.isNotEmpty) {
    final parts = existing.split(':');
    final h = parts.isNotEmpty ? int.tryParse(parts[0]) : null;
    final m = parts.length > 1 ? int.tryParse(parts[1]) : null;
    if (h != null && m != null && h >= 0 && h < 24 && m >= 0 && m < 60) {
      initial = TimeOfDay(hour: h, minute: m);
    }
  }

  final picked = await showTimePicker(
    context: context,
    initialTime: initial,
    builder: (ctx, child) => MediaQuery(
      // Force 24-hour display regardless of device locale so the stored
      // "HH:mm" string round-trips unambiguously (no AM/PM parsing needed).
      data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: true),
      child: child!,
    ),
  );
  if (picked == null) return;

  controller.text =
      '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
  onPicked?.call();
}
