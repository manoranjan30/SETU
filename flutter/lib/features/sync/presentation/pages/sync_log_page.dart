import 'package:drift/drift.dart' as drift;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/core/sync/connectivity_sync_service.dart';

/// Sync Log Page - Shows all progress entries and their sync status
///
/// Features:
/// - Lists all progress entries with sync status
/// - Shows pending, synced, and error items
/// - Allows retry for failed items
/// - Shows detailed error messages
class SyncLogPage extends StatefulWidget {
  const SyncLogPage({super.key});

  @override
  State<SyncLogPage> createState() => _SyncLogPageState();
}

class _SyncLogPageState extends State<SyncLogPage> {
  List<ProgressEntry> _entries = [];
  bool _isLoading = true;
  String _filter = 'all'; // 'all', 'pending', 'synced', 'error'

  @override
  void initState() {
    super.initState();
    _loadEntries();
  }

  Future<void> _loadEntries() async {
    setState(() => _isLoading = true);

    try {
      final database = sl<AppDatabase>();
      var query = database.select(database.progressEntries)
        ..orderBy([(t) => drift.OrderingTerm.desc(t.createdAt)]);

      // Apply filter
      if (_filter == 'pending') {
        query = query..where((t) => t.syncStatus.equals(0));
      } else if (_filter == 'synced') {
        query = query..where((t) => t.syncStatus.equals(2));
      } else if (_filter == 'error') {
        query = query
          ..where((t) => t.syncStatus.equals(3) | t.syncStatus.equals(4));
      }

      final entries = await query.get();

      setState(() {
        _entries = entries;
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
        title: const Text('Sync Log'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadEntries,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          // Sync status summary
          _buildSyncStatusCard(),

          // Filter chips
          _buildFilterChips(),

          // Entries list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _entries.isEmpty
                    ? _buildEmptyState()
                    : _buildEntriesList(),
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
                _getStatusColor(status).withOpacity(0.15),
                _getStatusColor(status).withOpacity(0.05),
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
                  color: _getStatusColor(status).withOpacity(0.2),
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
        _loadEntries();
      },
      selectedColor: AppColors.primary.withOpacity(0.2),
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
            Icons.history_rounded,
            size: 64,
            color: AppColors.textSecondary.withOpacity(0.5),
          ),
          const SizedBox(height: 16),
          Text(
            'No entries found',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildEntriesList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _entries.length,
      itemBuilder: (context, index) {
        final entry = _entries[index];
        return _buildEntryCard(entry);
      },
    );
  }

  Widget _buildEntryCard(ProgressEntry entry) {
    final syncStatus = _getSyncStatusEnum(entry.syncStatus);
    final dateFormat = DateFormat('MMM d, yyyy');
    final timeFormat = DateFormat('h:mm a');

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: _getSyncStatusColor(syncStatus).withOpacity(0.3),
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
                color: _getSyncStatusColor(syncStatus).withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                _getSyncStatusIcon(syncStatus),
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
                      Text(
                        'Activity #${entry.activityId}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        '${entry.quantity.toStringAsFixed(1)} units',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${dateFormat.format(entry.createdAt)} at ${timeFormat.format(entry.createdAt)}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  if (entry.syncError != null) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        entry.syncError!,
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
            // Retry button for errors
            if (syncStatus == SyncStatusEntry.error ||
                syncStatus == SyncStatusEntry.failed)
              IconButton(
                icon:
                    const Icon(Icons.refresh_rounded, color: AppColors.primary),
                onPressed: () => _retryEntry(entry),
                tooltip: 'Retry',
              ),
          ],
        ),
      ),
    );
  }

  void _syncNow(ConnectivitySyncService syncService) async {
    await syncService.syncNow();
    _loadEntries();
  }

  void _retryEntry(ProgressEntry entry) async {
    final syncService = sl<SyncService>();
    await syncService.retryErrorItem(entry.id);
    _loadEntries();
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

  SyncStatusEntry _getSyncStatusEnum(int value) {
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

  IconData _getSyncStatusIcon(SyncStatusEntry status) {
    switch (status) {
      case SyncStatusEntry.pending:
        return Icons.schedule_rounded;
      case SyncStatusEntry.syncing:
        return Icons.sync_rounded;
      case SyncStatusEntry.synced:
        return Icons.check_circle_rounded;
      case SyncStatusEntry.failed:
      case SyncStatusEntry.error:
        return Icons.error_rounded;
    }
  }
}

enum SyncStatusEntry {
  pending,
  syncing,
  synced,
  failed,
  error,
}
