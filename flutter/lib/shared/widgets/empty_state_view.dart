import 'package:flutter/material.dart';

/// Shared "nothing here" screen — icon, message, and an optional action
/// button. Replaces the icon+text block that used to get hand-rolled
/// separately on every list/detail page (no permission, no data yet,
/// nothing matches the filter, etc.), so all of those look and read the
/// same instead of each page inventing its own spacing/wording/icon size.
///
/// Covers the two shapes those hand-rolled blocks came in: a plain message
/// (e.g. "No modules available") and a message with a retry/action button
/// (e.g. "Failed to load — Retry").
class EmptyStateView extends StatelessWidget {
  final IconData icon;
  final String message;

  /// Optional second line — used for a hint ("Contact your administrator")
  /// or a fuller explanation under a short headline message.
  final String? subMessage;

  final String? actionLabel;
  final VoidCallback? onAction;
  final Color? iconColor;

  const EmptyStateView({
    super.key,
    required this.icon,
    required this.message,
    this.subMessage,
    this.actionLabel,
    this.onAction,
    this.iconColor,
  });

  /// Convenience factory for the common "couldn't load, let them retry"
  /// case — pairs a network-off icon with a "Retry" button by default.
  factory EmptyStateView.error({
    required String message,
    required VoidCallback onRetry,
    String actionLabel = 'Retry',
  }) {
    return EmptyStateView(
      icon: Icons.cloud_off_outlined,
      message: message,
      actionLabel: actionLabel,
      onAction: onRetry,
    );
  }

  /// Convenience factory for "you don't have access to anything here" —
  /// the lock-icon variant that used to be copy-pasted per module grid.
  factory EmptyStateView.noAccess({
    String message = 'Nothing available here',
    String subMessage = 'Contact your administrator',
  }) {
    return EmptyStateView(
      icon: Icons.lock_outline_rounded,
      message: message,
      subMessage: subMessage,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: iconColor ?? Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13, fontWeight: FontWeight.w600),
            ),
            if (subMessage != null) ...[
              const SizedBox(height: 4),
              Text(
                subMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
