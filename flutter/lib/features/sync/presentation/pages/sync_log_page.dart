import 'package:drift/drift.dart' as drift;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/core/sync/connectivity_sync_service.dart';

// ---------------------------------------------------------------------------
// Unified item wrapper — covers progressEntries, dailyLogs, and syncQueue
// ---------------------------------------------------------------------------

enum _SyncItemType { progress, dailyLog, queue }

enum SyncStatusEntry { pending, syncing, synced, failed, error }

class _SyncItem {
  final _SyncItemType type;
  final int id;
  final String title;
  final String subtitle;
  final DateTime createdAt;
  final SyncStatusEntry status;
  final String? errorMessage;

  /// Raw refs for actions
  final ProgressEntry? progressEntry;
  final DailyLog? dailyLog;
  // queue items are managed by SyncService; no direct delete

  const _SyncItem({
    required this.type,
    required this.id,
    required this.title,
    required this.subtitle,
    required this.createdAt,
    required this.status,
    this.errorMessage,
    this.progressEntry,
    this.dailyLog,
  });

  bool get isDeletable =>
      (type == _SyncItemType.progress || type == _SyncItemType.dailyLog) &&
      (status == SyncStatusEntry.pending ||
          status == SyncStatusEntry.failed ||
          status == SyncStatusEntry.error);

  bool get isRetryable =>
      status == SyncStatusEntry.error || status == SyncStatusEntry.failed;
}

SyncStatusEntry _statusFromInt(int value) {
  switch (value) {
    case 0:
      return SyncStatusEntry.pending;
    case 1:
      return SyncStatusEntry.syncing;
    case 2:
      return SyncStatusEntry.synced;
    case 3:
      return SyncStatusEntry.failed;
    case 4:
      return SyncStatusEntry.error;
    default:
      return SyncStatusEntry.pending;
  }
}

String _entityTypeLabel(String entityType) {
  switch (entityType) {
    case 'quality_obs_raise':
      return 'Raise Observation';
    case 'quality_obs_close':
      return 'Close Observation';
    case 'quality_obs_resolve':
      return 'Resolve Observation';
    case 'quality_workflow_advance':
      return 'RFI Approval';
    case 'quality_workflow_reject':
      return 'RFI Rejection';
    case 'quality_stage_save':
      return 'Checklist Save';
    case 'progress':
      return 'Progress Entry';
    case 'daily_log':
      return 'Daily Log';
    case 'photo':
      return 'Photo Upload';
    default:
      return entityType.replaceAll('_', ' ').split(' ').map((w) {
        if (w.isEmpty) return w;
        return w[0].toUpperCase() + w.substring(1);
      }).join(' ');
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

class SyncLogPage extends StatefulWidget {
  const SyncLogPage({super.key});

  @override
  State<SyncLogPage> createState() => _SyncLogPageState();
}

class _SyncLogPageState extends State<SyncLogPage> {
  List<_SyncItem> _items = [];
  bool _isLoading = true;
  String _filter = 'all'; // 'all', 'pending', 'synced', 'error'

  @override
  void initState() {
    super.initState();
    _loadItems();
  }

  Future<void> _loadItems() async {
    setState(() => _isLoading = true);

    try {
      final database = sl<AppDatabase>();
      final List<_SyncItem> all = [];

      // 1. Progress entries
      final progressQuery = database.select(database.progressEntries)
        ..orderBy([(t) => drift.OrderingTerm.desc(t.createdAt)]);
      if (_filter == 'pending') {
        progressQuery.where((t) =>
            t.syncStatus.equals(0) | t.syncStatus.equals(3));
      } else if (_filter == 'synced') {
        progressQuery.where((t) => t.syncStatus.equals(2));
      } else if (_filter == 'error') {
        progressQuery.where((t) => t.syncStatus.equals(4));
      }
      final progressEntries = await progressQuery.get();
      for (final e in progressEntries) {
        all.add(_SyncItem(
          type: _SyncItemType.progress,
          id: e.id,
          title: 'Progress — Activity #${e.activityId}',
          subtitle: '${e.quantity.toStringAsFixed(1)} units',
          createdAt: e.createdAt,
          status: _statusFromInt(e.syncStatus),
          errorMessage: e.syncError,
          progressEntry: e,
        ));
      }

      // 2. Daily logs
      final logsQuery = database.select(database.dailyLogs)
        ..orderBy([(t) => drift.OrderingTerm.desc(t.createdAt)]);
      if (_filter == 'pending') {
        logsQuery.where((t) =>
            t.syncStatus.equals(0) | t.syncStatus.equals(3));
      } else if (_filter == 'synced') {
        logsQuery.where((t) => t.syncStatus.equals(2));
      } else if (_filter == 'error') {
        logsQuery.where((t) => t.syncStatus.equals(4));
      }
      final dailyLogs = await logsQuery.get();
      for (final l in dailyLogs) {
        all.add(_SyncItem(
          type: _SyncItemType.dailyLog,
          id: l.id,
          title: 'Daily Log — Micro #${l.microActivityId}',
          subtitle: '${l.actualQty.toStringAsFixed(1)} units · ${l.logDate}',
          createdAt: l.createdAt,
          status: _statusFromInt(l.syncStatus),
          errorMessage: l.syncError,
          dailyLog: l,
        ));
      }

      // 3. Sync queue items (quality observations, approvals, etc.)
      // Queue items are always pending (they get deleted when synced).
      // 'synced' filter — skip queue items (they don't stay after sync)
      if (_filter != 'synced') {
        final queueQuery = database.select(database.syncQueue)
          ..orderBy([(t) => drift.OrderingTerm.desc(t.createdAt)]);
        if (_filter == 'error') {
          // Show only queue items that have a lastError recorded
          queueQuery.where((t) => t.lastError.isNotNull());
        }
        final queueItems = await queueQuery.get();
        for (final q in queueItems) {
          final hasError = q.lastError != null && q.lastError!.isNotEmpty;
          all.add(_SyncItem(
            type: _SyncItemType.queue,
            id: q.id,
            title: _entityTypeLabel(q.entityType),
            subtitle: 'ID #${q.entityId}${q.retryCount > 0 ? ' · ${q.retryCount} retries' : ''}',
            createdAt: q.createdAt,
            status: hasError ? SyncStatusEntry.error : SyncStatusEntry.pending,
            errorMessage: q.lastError,
          ));
        }
      }

      // Sort all items by createdAt descending
      all.sort((a, b) => b.createdAt.compareTo(a.createdAt));

      setState(() {
        _items = all;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sync Queue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadItems,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSyncStatusCard(),
          _buildFilterChips(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _items.isEmpty
                    ? _buildEmptyState()
                    : _buildItemsList(),
          ),
        ],
      ),
    );
  }

  Widget _buildSyncStatusCard() {
    final syncService = sl<ConnectivitySyncService>();

    return ListenableBuilder(
      listenable: syncService,
      builder: (context, child) {
        final status = syncService.syncStatus;
        return Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                _getStatusColor(status).withValues(alpha: 0.15),
                _getStatusColor(status).withValues(alpha: 0.05),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: _getStatusColor(status).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  _getStatusIcon(status),
                  color: _getStatusColor(status),
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getStatusTitle(status),
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                        color: _getStatusColor(status),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _getStatusSubtitle(syncService),
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (syncService.pendingCount > 0 || syncService.errorCount > 0)
                ElevatedButton.icon(
                  onPressed: syncService.isSyncing
                      ? null
                      : () => _syncNow(syncService),
                  icon: syncService.isSyncing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.sync_rounded, size: 18),
                  label: Text(syncService.errorCount > 0 ? 'Retry' : 'Sync'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _getStatusColor(status),
                    foregroundColor: Colors.white,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFilterChips() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Wrap(
        spacing: 8,
        runSpacing: 4,
        children: [
          _buildFilterChip('All', 'all'),
          _buildFilterChip('Pending', 'pending'),
          _buildFilterChip('Synced', 'synced'),
          _buildFilterChip('Error', 'error'),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _filter == value;
    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        setState(() => _filter = value);
        _loadItems();
      },
      selectedColor: AppColors.primary.withValues(alpha: 0.2),
      checkmarkColor: AppColors.primary,
      labelStyle: TextStyle(
        color: isSelected ? AppColors.primary : AppColors.textSecondary,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.cloud_done_rounded,
            size: 64,
            color: AppColors.textSecondary.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            _filter == 'synced' ? 'No synced entries found' : 'Nothing pending — all clear',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemsList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _items.length,
      itemBuilder: (context, index) => _buildItemCard(_items[index]),
    );
  }

  Widget _buildItemCard(_SyncItem item) {
    final syncStatus = item.status;
    final dateFormat = DateFormat('MMM d, yyyy');
    final timeFormat = DateFormat('h:mm a');

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: _getSyncStatusColor(syncStatus).withValues(alpha: 0.3),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Status icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _getSyncStatusColor(syncStatus).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                _getItemIcon(item),
                color: _getSyncStatusColor(syncStatus),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        item.subtitle,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${dateFormat.format(item.createdAt)} at ${timeFormat.format(item.createdAt)}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  if (item.errorMessage != null) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        item.errorMessage!,
                        style: const TextStyle(
                          color: AppColors.error,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // Action buttons
            if (item.isRetryable)
              IconButton(
                icon: const Icon(Icons.refresh_rounded,
                    color: AppColors.primary),
                onPressed: () => _retryItem(item),
                tooltip: 'Retry',
              ),
            if (item.isDeletable)
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded,
                    color: AppColors.error),
                onPressed: () => _confirmDelete(item),
                tooltip: 'Delete',
              ),
          ],
        ),
      ),
    );
  }

  void _syncNow(ConnectivitySyncService syncService) async {
    await syncService.syncNow();
    _loadItems();
  }

  void _retryItem(_SyncItem item) async {
    final syncService = sl<SyncService>();
    if (item.type == _SyncItemType.progress) {
      await syncService.retryErrorItem(item.id);
    } else if (item.type == _SyncItemType.dailyLog) {
      await syncService.retryErrorItem(item.id, isDailyLog: true);
    } else {
      // Queue items — just trigger a full sync
      await syncService.syncAll();
    }
    _loadItems();
  }

  void _confirmDelete(_SyncItem item) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('Delete Entry?'),
        content: Text(
          '${item.title}\n\nThis entry has not been synced. Delete it permanently?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            icon: const Icon(Icons.delete_rounded, size: 18),
            label: const Text('Delete'),
            onPressed: () async {
              Navigator.pop(context);
              final syncService = sl<SyncService>();
              if (item.type == _SyncItemType.progress) {
                await syncService.deleteProgressEntry(item.id);
              }
              // dailyLog delete not exposed yet — just reload
              _loadItems();
            },
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(SyncStatusInfo status) {
    if (status.isOffline) return AppColors.warning;
    if (status.isSyncing) return AppColors.info;
    if (status.hasError) return AppColors.error;
    if (status.hasPending) return AppColors.warning;
    return AppColors.success;
  }

  IconData _getStatusIcon(SyncStatusInfo status) {
    if (status.isOffline) return Icons.cloud_off_rounded;
    if (status.isSyncing) return Icons.cloud_sync_rounded;
    if (status.hasError) return Icons.cloud_queue_rounded;
    if (status.hasPending) return Icons.cloud_upload_rounded;
    return Icons.cloud_done_rounded;
  }

  String _getStatusTitle(SyncStatusInfo status) {
    if (status.isOffline) return 'Offline';
    if (status.isSyncing) return 'Syncing...';
    if (status.hasError) return 'Sync Error';
    if (status.hasPending) return '${status.pendingCount} Pending';
    return 'All Synced';
  }

  String _getStatusSubtitle(ConnectivitySyncService syncService) {
    if (syncService.isSyncing) return 'Please wait...';
    if (syncService.errorCount > 0) {
      return '${syncService.errorCount} item${syncService.errorCount > 1 ? 's' : ''} failed';
    }
    if (syncService.pendingCount > 0) {
      return 'Tap to sync now';
    }
    return 'Last synced: Just now';
  }

  IconData _getItemIcon(_SyncItem item) {
    switch (item.status) {
      case SyncStatusEntry.synced:
        return Icons.check_circle_rounded;
      case SyncStatusEntry.error:
      case SyncStatusEntry.failed:
        return Icons.error_rounded;
      case SyncStatusEntry.syncing:
        return Icons.sync_rounded;
      case SyncStatusEntry.pending:
        break;
    }
    switch (item.type) {
      case _SyncItemType.queue:
        return Icons.cloud_upload_rounded;
      case _SyncItemType.dailyLog:
        return Icons.today_rounded;
      case _SyncItemType.progress:
        return Icons.schedule_rounded;
    }
  }

  Color _getSyncStatusColor(SyncStatusEntry status) {
    switch (status) {
      case SyncStatusEntry.pending:
        return AppColors.warning;
      case SyncStatusEntry.syncing:
        return AppColors.info;
      case SyncStatusEntry.synced:
        return AppColors.success;
      case SyncStatusEntry.failed:
      case SyncStatusEntry.error:
        return AppColors.error;
    }
  }
}
