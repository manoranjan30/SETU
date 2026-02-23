import 'package:flutter/material.dart';
import 'package:setu_mobile/core/sync/connectivity_sync_service.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/injection_container.dart';

/// Breadcrumb navigation widget for EPS hierarchy
/// 
/// Features:
/// - Sticky at the top, just below the AppBar
/// - Shows the path: Project Name > Tower A > Level 1
/// - Tapping a previous item navigates back to that level
/// - Scrollable horizontally for long paths
/// - Current level highlighted with primary color
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.04),
        border: const Border(
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
      final isFirst = i == 0;
      final node = path[i];

      // Add chevron before items (except first)
      if (i > 0) {
        items.add(
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 4),
            child: Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: AppColors.textSecondary,
            ),
          ),
        );
      }

      // Add the breadcrumb item
      items.add(
        _BreadcrumbItem(
          label: node.name,
          isActive: isLast,
          isRoot: isFirst,
          onTap: isLast ? null : () => onNavigateToIndex(i),
        ),
      );
    }

    return items;
  }
}

/// Individual breadcrumb item
class _BreadcrumbItem extends StatelessWidget {
  final String label;
  final bool isActive;
  final bool isRoot;
  final VoidCallback? onTap;

  const _BreadcrumbItem({
    required this.label,
    this.isActive = false,
    this.isRoot = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // isRoot → project home icon
    // isActive → "you are here" pin icon
    // intermediate → folder icon
    final IconData icon;
    if (isRoot) {
      icon = Icons.home_work_rounded;
    } else if (isActive) {
      icon = Icons.place_rounded;
    } else {
      icon = Icons.folder_open_rounded;
    }

    final iconColor = isActive ? AppColors.primary : AppColors.textSecondary;

    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: isActive ? AppColors.primary : AppColors.textSecondary,
              fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );

    if (onTap == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: isActive
            ? BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              )
            : null,
        child: content,
      );
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: content,
        ),
      ),
    );
  }
}

/// Sync status indicator widget for AppBar
/// 
/// Shows the current sync status with appropriate icon:
/// - Cloud with Check: All Synced
/// - Cloud with Spinner: Syncing...
/// - Cloud with Slash: Offline
/// - Cloud with Exclamation: Sync Errors
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: _getBackgroundColor().withOpacity(0.15),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _getIcon(),
              size: 18,
              color: _getBackgroundColor(),
            ),
            if (pendingCount > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: _getBackgroundColor(),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$pendingCount',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
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
      case SyncStatus.pending:
        return AppColors.warning;
      case SyncStatus.offline:
        return AppColors.warning;
      case SyncStatus.error:
        return AppColors.error;
    }
  }

  IconData _getIcon() {
    switch (status) {
      case SyncStatus.allSynced:
        return Icons.cloud_done_rounded;
      case SyncStatus.syncing:
        return Icons.cloud_sync_rounded;
      case SyncStatus.pending:
        return Icons.cloud_upload_rounded;
      case SyncStatus.offline:
        return Icons.cloud_off_rounded;
      case SyncStatus.error:
        return Icons.cloud_queue_rounded;
    }
  }
}

/// Live sync status indicator connected to ConnectivitySyncService
class LiveSyncStatusIndicator extends StatelessWidget {
  final VoidCallback? onTap;

  const LiveSyncStatusIndicator({
    super.key,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final syncService = sl<ConnectivitySyncService>();

    return ListenableBuilder(
      listenable: syncService,
      builder: (context, child) {
        final status = syncService.syncStatus;
        final mappedStatus = _mapStatus(status);

        return SyncStatusIndicator(
          status: mappedStatus,
          pendingCount: status.pendingCount,
          onTap: onTap,
        );
      },
    );
  }

  SyncStatus _mapStatus(SyncStatusInfo status) {
    if (status.isOffline) return SyncStatus.offline;
    if (status.isSyncing) return SyncStatus.syncing;
    if (status.hasError) return SyncStatus.error;
    if (status.hasPending) return SyncStatus.pending;
    return SyncStatus.allSynced;
  }
}

/// Sync status enum for the indicator
enum SyncStatus {
  allSynced,
  syncing,
  pending,
  offline,
  error,
}

/// Sync status bar widget for showing sync progress
class SyncStatusBar extends StatelessWidget {
  final int pendingCount;
  final int syncedCount;
  final int errorCount;
  final bool isSyncing;
  final VoidCallback? onRetry;
  final VoidCallback? onViewDetails;

  const SyncStatusBar({
    super.key,
    this.pendingCount = 0,
    this.syncedCount = 0,
    this.errorCount = 0,
    this.isSyncing = false,
    this.onRetry,
    this.onViewDetails,
  });

  @override
  Widget build(BuildContext context) {
    if (pendingCount == 0 && errorCount == 0 && !isSyncing) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: _getBackgroundColor().withOpacity(0.1),
        border: Border(
          bottom: BorderSide(
            color: _getBackgroundColor().withOpacity(0.2),
          ),
        ),
      ),
      child: Row(
        children: [
          // Status icon
          if (isSyncing)
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(_getBackgroundColor()),
              ),
            )
          else
            Icon(
              _getIcon(),
              size: 18,
              color: _getBackgroundColor(),
            ),
          const SizedBox(width: 12),
          // Status text
          Expanded(
            child: Text(
              _getStatusText(),
              style: TextStyle(
                color: _getBackgroundColor(),
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          // Action buttons
          if (errorCount > 0 && onRetry != null)
            TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                minimumSize: Size.zero,
              ),
              child: Text(
                'Retry',
                style: TextStyle(
                  color: _getBackgroundColor(),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          if (onViewDetails != null)
            TextButton(
              onPressed: onViewDetails,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                minimumSize: Size.zero,
              ),
              child: Text(
                'Details',
                style: TextStyle(
                  color: _getBackgroundColor(),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Color _getBackgroundColor() {
    if (isSyncing) return AppColors.info;
    if (errorCount > 0) return AppColors.error;
    if (pendingCount > 0) return AppColors.warning;
    return AppColors.success;
  }

  IconData _getIcon() {
    if (errorCount > 0) return Icons.error_outline_rounded;
    if (pendingCount > 0) return Icons.cloud_upload_outlined;
    return Icons.check_circle_outline_rounded;
  }

  String _getStatusText() {
    if (isSyncing) return 'Syncing... ($pendingCount remaining)';
    if (errorCount > 0) return '$errorCount item${errorCount > 1 ? 's' : ''} failed to sync';
    if (pendingCount > 0) return '$pendingCount item${pendingCount > 1 ? 's' : ''} pending sync';
    return 'All synced';
  }
}
