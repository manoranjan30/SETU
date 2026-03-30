import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// A slim informational banner shown when a screen is displaying cached data
/// rather than live data from the server.
///
/// Drop this widget at the top of any list or detail screen to give the user
/// a clear, consistent signal that:
///   - They are currently working offline, OR
///   - The data shown was loaded from the local cache (may not reflect the
///     latest server state).
///
/// Usage (inside a Column above the main content):
/// ```dart
/// if (state.isOffline) OfflineBanner(),
/// if (state.isFromCache) OfflineBanner(cachedAt: state.cachedAt),
/// ```
///
/// The banner is intentionally compact (single line, amber/orange) so it does
/// not steal too much screen real estate on small construction-site phones.
class OfflineBanner extends StatelessWidget {
  /// Optional timestamp of when the data was last cached.
  /// If provided, shown as "Last updated: 26 Mar, 14:32".
  final DateTime? cachedAt;

  /// Override the default message. If null, a sensible default is shown.
  final String? message;

  const OfflineBanner({super.key, this.cachedAt, this.message});

  @override
  Widget build(BuildContext context) {
    final label = message ?? _buildLabel();

    return Material(
      color: Colors.transparent,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.amber.shade700.withValues(alpha: 0.15),
          border: Border(
            bottom: BorderSide(
              color: Colors.amber.shade700.withValues(alpha: 0.4),
              width: 1,
            ),
          ),
        ),
        child: Row(
          children: [
            Icon(
              Icons.cloud_off_rounded,
              size: 16,
              color: Colors.amber.shade800,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.amber.shade900,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _buildLabel() {
    if (cachedAt != null) {
      final formatted =
          DateFormat('d MMM, HH:mm').format(cachedAt!);
      return 'Showing offline data · Last updated $formatted';
    }
    return 'Showing offline data · Connect to refresh';
  }
}

/// A small chip-style offline indicator for use in AppBar actions or inside
/// cards where a full-width banner would be too intrusive.
///
/// Usage (in AppBar actions):
/// ```dart
/// if (state.isFromCache) const OfflineChip(),
/// ```
class OfflineChip extends StatelessWidget {
  const OfflineChip({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.amber.shade700.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.amber.shade700.withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off_rounded, size: 12, color: Colors.amber.shade800),
          const SizedBox(width: 4),
          Text(
            'Offline',
            style: TextStyle(
              fontSize: 11,
              color: Colors.amber.shade900,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
