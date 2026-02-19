import 'package:flutter/material.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

/// Breadcrumb navigation widget for EPS hierarchy
class BreadcrumbWidget extends StatelessWidget {
  final List<EpsNode> path;
  final Function(int index) onNavigateToIndex;

  const BreadcrumbWidget({
    super.key,
    required this.path,
    required this.onNavigateToIndex,
  });

  @override
  Widget build(BuildContext context) {
    if (path.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.05),
        border: Border(
          bottom: BorderSide(
            color: AppColors.divider,
            width: 1,
          ),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _buildBreadcrumbItems(context),
        ),
      ),
    );
  }

  List<Widget> _buildBreadcrumbItems(BuildContext context) {
    final items = <Widget>[];

    for (int i = 0; i < path.length; i++) {
      final isLast = i == path.length - 1;
      final node = path[i];

      items.add(
        GestureDetector(
          onTap: isLast ? null : () => onNavigateToIndex(i),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (i > 0) ...[
                Icon(
                  Icons.chevron_right,
                  size: 16,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 4),
              ],
              Text(
                node.name,
                style: TextStyle(
                  fontSize: 13,
                  color: isLast ? AppColors.primary : AppColors.textSecondary,
                  fontWeight: isLast ? FontWeight.w600 : FontWeight.normal,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      );

      if (i < path.length - 1) {
        items.add(const SizedBox(width: 4));
      }
    }

    return items;
  }
}

/// Sync status indicator widget
class SyncStatusIndicator extends StatelessWidget {
  final SyncStatus status;
  final int pendingCount;
  final VoidCallback? onTap;

  const SyncStatusIndicator({
    super.key,
    required this.status,
    this.pendingCount = 0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: _getBackgroundColor().withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _getIcon(),
              size: 16,
              color: _getBackgroundColor(),
            ),
            if (pendingCount > 0) ...[
              const SizedBox(width: 4),
              Text(
                '$pendingCount',
                style: TextStyle(
                  fontSize: 12,
                  color: _getBackgroundColor(),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _getBackgroundColor() {
    switch (status) {
      case SyncStatus.allSynced:
        return AppColors.success;
      case SyncStatus.syncing:
        return AppColors.info;
      case SyncStatus.offline:
        return AppColors.warning;
      case SyncStatus.error:
        return AppColors.error;
    }
  }

  IconData _getIcon() {
    switch (status) {
      case SyncStatus.allSynced:
        return Icons.cloud_done;
      case SyncStatus.syncing:
        return Icons.cloud_sync;
      case SyncStatus.offline:
        return Icons.cloud_off;
      case SyncStatus.error:
        return Icons.cloud_queue;
    }
  }
}

/// Sync status enum for the indicator
enum SyncStatus {
  allSynced,
  syncing,
  offline,
  error,
}
