import 'dart:convert';
import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

/// The app's single SQLite database, managed by Drift.
///
/// Covers all offline storage concerns for SETU:
/// - User-generated data (progress entries, daily logs) that must survive
///   network outages and be synced later.
/// - A generic [SyncQueue] for queueing any server mutation offline.
/// - Per-project read-only caches (projects, activities, BOQ, EPS tree,
///   quality lists/activities, quality/EHS site observations).
///
/// Current schema version: 5.
/// Each incremental migration is guarded by `from < N` checks so a device
/// that skips versions (e.g. v1 → v5) applies every missing step.
@DriftDatabase(
  tables: [
    ProgressEntries,
    DailyLogs,
    SyncQueue,
    CachedProjects,
    CachedActivities,
    CachedBoqItems,
    CachedEpsNodes,
    CachedQualityActivityLists,
    CachedQualityActivities,
    CachedQualitySiteObs,
    CachedEhsSiteObs,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 6;

  @override
  MigrationStrategy get migration {
    return MigrationStrategy(
      // Fresh install: create all tables and indexes in one shot.
      onCreate: (Migrator m) async {
        await m.createAll();
        // Indexes are not created by Drift's createAll() — we must add them
        // manually via raw SQL.
        await _createIndexes();
      },
      onUpgrade: (Migrator m, int from, int to) async {
        // Each block is idempotent: `from < N` means "this device has not
        // yet applied the schema changes introduced in version N".
        // Using < instead of == allows devices that skipped versions to
        // catch up by running every block in order.

        if (from < 2) {
          // v2: Added the EPS (Engineering Project Structure) node cache so
          // users can browse the project hierarchy offline.
          await m.createTable(cachedEpsNodes);
        }
        if (from < 3) {
          // v3: Added quality module caches — activity lists and individual
          // activities within each list.
          await m.createTable(cachedQualityActivityLists);
          await m.createTable(cachedQualityActivities);
        }
        if (from < 4) {
          // v4: Added site observation caches for both Quality and EHS
          // modules so inspectors can view open observations offline.
          await m.createTable(cachedQualitySiteObs);
          await m.createTable(cachedEhsSiteObs);
        }
        if (from < 5) {
          // v5: Backfilled project-scoped indexes on all cache tables.
          // Previously missing indexes caused full-table scans on every
          // per-project query; this migration adds them for existing installs.
          await _createIndexes();
        }
        if (from < 6) {
          // v6: Added server_updated_at, local_updated_at, is_deleted to
          // ProgressEntries and DailyLogs to support delta sync conflict
          // detection and offline soft-deletes.
          await customStatement(
              'ALTER TABLE progress_entries ADD COLUMN server_updated_at INTEGER;');
          await customStatement(
              'ALTER TABLE progress_entries ADD COLUMN local_updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\') * 1000);');
          await customStatement(
              'ALTER TABLE progress_entries ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;');
          await customStatement(
              'ALTER TABLE daily_logs ADD COLUMN server_updated_at INTEGER;');
          await customStatement(
              'ALTER TABLE daily_logs ADD COLUMN local_updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\') * 1000);');
          await customStatement(
              'ALTER TABLE daily_logs ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;');
        }
      },
    );
  }

  /// Create projectId indexes on all cached tables for fast per-project queries.
  ///
  /// `CREATE INDEX IF NOT EXISTS` is used so this is safe to call during both
  /// [onCreate] and incremental [onUpgrade] without risking a duplicate-index
  /// error if migrations are replayed.
  Future<void> _createIndexes() async {
    await customStatement(
        'CREATE INDEX IF NOT EXISTS idx_cached_activities_project ON cached_activities (project_id);');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS idx_cached_eps_nodes_project ON cached_eps_nodes (project_id);');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS idx_cached_boq_items_project ON cached_boq_items (project_id);');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS idx_cached_quality_lists_project ON cached_quality_activity_lists (project_id);');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS idx_cached_quality_activities_project ON cached_quality_activities (project_id);');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS idx_cached_quality_obs_project ON cached_quality_site_obs (project_id);');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS idx_cached_ehs_obs_project ON cached_ehs_site_obs (project_id);');
  }

  /// Delete cached rows older than [daysOld] days from all cache tables.
  ///
  /// Called on app start (after DB init) to prevent unbounded local growth.
  /// 90 days is chosen because construction site engineers may be offline for
  /// weeks at a stretch (remote sites, intermittent connectivity). 30 days was
  /// too aggressive and caused data loss for infrequent users. Only cache tables
  /// are evicted — user-authored data (progress entries, daily logs, sync queue)
  /// is never automatically deleted.
  Future<void> evictStaleCaches({int daysOld = 90}) async {
    final cutoff = DateTime.now().subtract(Duration(days: daysOld));
    // Each delete is a separate statement because Drift's typed DSL does not
    // support multi-table deletes. The operations are sequential rather than
    // batched so that a partial failure (rare) does not roll back successful
    // evictions.
    await (delete(cachedActivities)
          ..where((t) => t.cachedAt.isSmallerThanValue(cutoff)))
        .go();
    await (delete(cachedEpsNodes)
          ..where((t) => t.cachedAt.isSmallerThanValue(cutoff)))
        .go();
    await (delete(cachedBoqItems)
          ..where((t) => t.cachedAt.isSmallerThanValue(cutoff)))
        .go();
    await (delete(cachedQualityActivityLists)
          ..where((t) => t.cachedAt.isSmallerThanValue(cutoff)))
        .go();
    await (delete(cachedQualityActivities)
          ..where((t) => t.cachedAt.isSmallerThanValue(cutoff)))
        .go();
    await (delete(cachedQualitySiteObs)
          ..where((t) => t.cachedAt.isSmallerThanValue(cutoff)))
        .go();
    await (delete(cachedEhsSiteObs)
          ..where((t) => t.cachedAt.isSmallerThanValue(cutoff)))
        .go();
  }

  // Clear all data (for logout)
  /// Wipe every table on logout so that the next user starts from a clean
  /// slate. The sync queue is also cleared intentionally: any unsynced data
  /// belonged to the previous authenticated session and must not be re-sent
  /// under a different token.
  Future<void> clearAll() async {
    await delete(progressEntries).go();
    await delete(dailyLogs).go();
    await delete(syncQueue).go();
    await delete(cachedProjects).go();
    await delete(cachedActivities).go();
    await delete(cachedBoqItems).go();
    await delete(cachedEpsNodes).go();
    await delete(cachedQualityActivityLists).go();
    await delete(cachedQualityActivities).go();
    await delete(cachedQualitySiteObs).go();
    await delete(cachedEhsSiteObs).go();
  }

  // ==================== EPS NODE QUERIES ====================

  /// Get EPS nodes by parent ID (for hierarchical navigation).
  ///
  /// Passing [parentId] as `null` retrieves root-level nodes — i.e., nodes
  /// with no parent — which form the top of the EPS tree.
  Future<List<CachedEpsNode>> getEpsNodesByParent(int? parentId) async {
    if (parentId == null) {
      // Get root nodes (no parent)
      return (select(cachedEpsNodes)..where((t) => t.parentId.isNull())).get();
    }
    return (select(cachedEpsNodes)..where((t) => t.parentId.equals(parentId)))
        .get();
  }

  /// Get all EPS nodes for a project.
  ///
  /// Used when the caller needs the full tree (e.g. to rebuild a hierarchy
  /// in memory) rather than one level at a time.
  Future<List<CachedEpsNode>> getEpsNodesForProject(int projectId) async {
    return (select(cachedEpsNodes)..where((t) => t.projectId.equals(projectId)))
        .get();
  }

  /// Cache EPS nodes from API response.
  ///
  /// Uses [InsertMode.insertOrReplace] so subsequent calls act as a full
  /// refresh — any stale local data for a node is overwritten atomically.
  /// Wrapping inserts in [batch] reduces the number of SQLite transactions
  /// from O(n) to 1, which is critical for large EPS trees (hundreds of nodes).
  Future<void> cacheEpsNodes(
      List<Map<String, dynamic>> nodes, int projectId) async {
    await batch((batch) {
      for (final node in nodes) {
        batch.insert(
          cachedEpsNodes,
          CachedEpsNodesCompanion.insert(
            id: Value(node['id'] as int),
            projectId: projectId,
            name: node['name'] as String,
            code: Value(node['code'] as String?),
            type: node['type'] as String? ?? 'unknown',
            // API may return parentId as camelCase or snake_case depending on
            // endpoint version — try both keys before defaulting to null.
            parentId:
                Value(node['parentId'] as int? ?? node['parent_id'] as int?),
            rawData: jsonEncode(node),
          ),
          mode: InsertMode.insertOrReplace,
        );
      }
    });
  }

  // ==================== ACTIVITY QUERIES ====================

  /// Get activities by EPS node ID.
  ///
  /// This is the primary read path when the user drills into a specific floor
  /// or phase node in the project tree.
  Future<List<CachedActivity>> getActivitiesByEpsNode(int epsNodeId) async {
    return (select(cachedActivities)
          ..where((t) => t.epsNodeId.equals(epsNodeId)))
        .get();
  }

  /// Get all activities for a project.
  ///
  /// Used for bulk operations such as export or full-project refresh.
  Future<List<CachedActivity>> getActivitiesForProject(int projectId) async {
    return (select(cachedActivities)
          ..where((t) => t.projectId.equals(projectId)))
        .get();
  }

  /// Cache activities from API response.
  ///
  /// The [readInt] helper is needed because the server returns numeric IDs
  /// inconsistently — sometimes as `int`, sometimes as `double` (num), and
  /// occasionally as a stringified integer. All three cases must be handled
  /// to avoid a runtime cast exception.
  ///
  /// `epsNodeId` is resolved with a priority chain: explicit camelCase key →
  /// snake_case key → `floorId` alias → `floor_id` alias → nested `epsNode`
  /// object. This defensive lookup accommodates different API versions that
  /// have renamed or restructured this field over time.
  Future<void> cacheActivities(
      List<Map<String, dynamic>> activities, int projectId) async {
    int? readInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value);
      return null;
    }

    await batch((batch) {
      for (final activity in activities) {
        // Resolve the EPS node this activity belongs to, trying several key
        // names to handle API response variations across versions.
        final epsNode = activity['epsNode'] ?? activity['eps_node'];
        final epsNodeId = readInt(activity['epsNodeId']) ??
            readInt(activity['eps_node_id']) ??
            readInt(activity['floorId']) ??
            readInt(activity['floor_id']) ??
            (epsNode is Map<String, dynamic> ? readInt(epsNode['id']) : null);

        batch.insert(
          cachedActivities,
          CachedActivitiesCompanion.insert(
            id: Value(activity['id'] as int),
            projectId: projectId,
            name: activity['name'] as String,
            epsNodeId: Value(epsNodeId),
            status: Value(activity['status'] as String?),
            // Accept both camelCase and snake_case date keys.
            startDate: Value(activity['startDate'] as String? ??
                activity['start_date'] as String?),
            endDate: Value(activity['endDate'] as String? ??
                activity['end_date'] as String?),
            // Coerce progress to double; default to 0.0 if absent.
            progress: Value((activity['actualProgress'] as num?)?.toDouble() ??
                (activity['actual_progress'] as num?)?.toDouble() ??
                0.0),
            rawData: jsonEncode(activity),
          ),
          mode: InsertMode.insertOrReplace,
        );
      }
    });
  }

  // ==================== BOQ CACHE QUERIES ====================

  /// Get cached BOQ items for a project.
  ///
  /// Used by the progress entry page when the device is offline so field
  /// engineers can still select BOQ items and enter quantities without a
  /// live API call.
  Future<List<CachedBoqItem>> getCachedBoqItems(int projectId) async {
    return (select(cachedBoqItems)
          ..where((t) => t.projectId.equals(projectId)))
        .get();
  }

  /// Cache BOQ items from API response.
  ///
  /// Uses [InsertMode.insertOrReplace] so subsequent calls act as a full
  /// refresh — any stale local data is overwritten. BOQ items include the
  /// full server JSON in [rawData] so the progress entry form can reconstruct
  /// all fields (unit, planned quantity, work-order references, etc.) offline.
  Future<void> cacheBoqItems(
      List<Map<String, dynamic>> items, int projectId) async {
    await batch((b) {
      for (final item in items) {
        // Defensive id extraction — server may return id as int or num.
        final rawId = item['id'];
        final id = rawId is int
            ? rawId
            : rawId is num
                ? rawId.toInt()
                : int.tryParse(rawId.toString()) ?? 0;
        if (id == 0) continue; // Skip malformed rows

        b.insert(
          cachedBoqItems,
          CachedBoqItemsCompanion.insert(
            id: Value(id),
            projectId: projectId,
            name: item['name'] as String? ??
                item['description'] as String? ??
                'BOQ Item',
            unit: Value(item['unit'] as String?),
            quantity: (item['quantity'] as num?)?.toDouble() ??
                (item['totalQuantity'] as num?)?.toDouble() ??
                0.0,
            rate: Value((item['rate'] as num?)?.toDouble()),
            rawData: jsonEncode(item),
          ),
          mode: InsertMode.insertOrReplace,
        );
      }
    });
  }

  // ==================== QUALITY CACHE QUERIES ====================

  /// Get cached activity lists for a project + optional EPS node.
  ///
  /// The EPS node filter is applied in Dart rather than SQL because the
  /// column is nullable and matching nullable columns in Drift's query DSL
  /// requires extra null handling. Given that the number of lists per project
  /// is small (typically < 50), the in-memory filter is acceptable.
  Future<List<CachedQualityActivityList>> getCachedActivityLists(
      int projectId, int? epsNodeId) async {
    final all = await (select(cachedQualityActivityLists)
          ..where((t) => t.projectId.equals(projectId)))
        .get();
    if (epsNodeId != null) {
      // Filter by EPS node in Dart; see docstring for why not in SQL.
      return all.where((r) => r.epsNodeId == epsNodeId).toList();
    }
    return all;
  }

  /// Cache quality activity lists from API response.
  ///
  /// `activityCount` is computed from the embedded `activities` list if the
  /// server does not return it explicitly, so the UI can show a count without
  /// a second query.
  Future<void> cacheActivityLists(
      List<Map<String, dynamic>> lists, int projectId) async {
    await batch((b) {
      for (final l in lists) {
        b.insert(
          cachedQualityActivityLists,
          CachedQualityActivityListsCompanion.insert(
            id: Value(l['id'] as int),
            projectId: projectId,
            epsNodeId: Value(l['epsNodeId'] as int?),
            name: l['name'] as String,
            description: Value(l['description'] as String?),
            // Prefer the explicit count field; fall back to the length of the
            // embedded activities array if present; default to 0.
            activityCount: Value(
              (l['activityCount'] as int?) ??
                  (l['activities'] as List?)?.length ??
                  0,
            ),
            rawData: jsonEncode(l),
          ),
          mode: InsertMode.insertOrReplace,
        );
      }
    });
  }

  /// Get cached quality activities for a list, ordered by sequence.
  ///
  /// Ordering by [sequence] ensures the UI presents activities in the
  /// inspector-defined order rather than insertion order, which can differ
  /// after partial re-caching.
  Future<List<CachedQualityActivity>> getCachedQualityActivities(
      int listId) async {
    return (select(cachedQualityActivities)
          ..where((t) => t.listId.equals(listId))
          ..orderBy([(t) => OrderingTerm.asc(t.sequence)]))
        .get();
  }

  /// Cache quality activities from API response.
  ///
  /// Boolean hold/witness point flags are stored as 0/1 integers because
  /// SQLite has no native boolean type and Drift's bool column maps to
  /// integer anyway — being explicit here avoids any ambiguity during reads.
  Future<void> cacheQualityActivities(
    List<Map<String, dynamic>> activities,
    int listId,
    int projectId,
    int? epsNodeId,
  ) async {
    await batch((b) {
      for (final a in activities) {
        b.insert(
          cachedQualityActivities,
          CachedQualityActivitiesCompanion.insert(
            id: Value(a['id'] as int),
            listId: listId,
            projectId: projectId,
            epsNodeId: Value(epsNodeId),
            sequence: Value(a['sequence'] as int? ?? 0),
            activityName: a['activityName'] as String,
            status: Value(a['status'] as String? ?? 'NOT_STARTED'),
            // Convert bool → int (1/0) explicitly; SQLite has no bool type.
            holdPoint: Value((a['holdPoint'] as bool? ?? false) ? 1 : 0),
            witnessPoint: Value((a['witnessPoint'] as bool? ?? false) ? 1 : 0),
            rawData: jsonEncode(a),
          ),
          mode: InsertMode.insertOrReplace,
        );
      }
    });
  }

  /// Optimistically update a cached activity status (after RFI queued offline).
  ///
  /// When a user raises an RFI while offline, the UI should immediately reflect
  /// the new status (e.g. "PENDING_INSPECTION") rather than waiting for the
  /// next sync round-trip. This write is "optimistic" — if the server later
  /// rejects the RFI, the cache will be corrected on the next full refresh.
  Future<void> updateCachedActivityStatus(
      int activityId, String newStatus) async {
    await (update(cachedQualityActivities)
          ..where((t) => t.id.equals(activityId)))
        .write(CachedQualityActivitiesCompanion(
      status: Value(newStatus),
    ));
  }

  // ==================== QUALITY SITE OBS CACHE QUERIES ====================

  /// Get cached quality site observations for a project, optionally filtered
  /// by status (e.g. "OPEN", "CLOSED").
  ///
  /// The status filter is applied at the SQL level to keep the result set small
  /// when the project has many historical observations.
  Future<List<CachedQualitySiteOb>> getCachedQualitySiteObs(
      int projectId, String? statusFilter) async {
    final query = select(cachedQualitySiteObs)
      ..where((t) => t.projectId.equals(projectId));
    if (statusFilter != null) {
      // Only append the additional where clause when a filter is requested,
      // so the unfiltered path avoids an unnecessary AND condition.
      query.where((t) => t.status.equals(statusFilter));
    }
    return query.get();
  }

  /// Cache quality site observations from API response.
  ///
  /// Uses [InsertMode.insertOrReplace] so that updated observation state
  /// (e.g. status transitions from OPEN → CLOSED) overwrites the stale row.
  /// Any optimistic-insert rows (id starts with `local_`) are removed first
  /// so they are replaced by the confirmed server copy.
  Future<void> cacheQualitySiteObs(
      List<Map<String, dynamic>> items, int projectId) async {
    await (delete(cachedQualitySiteObs)
          ..where((t) =>
              t.projectId.equals(projectId) & t.id.like('local_%')))
        .go();
    await batch((b) {
      for (final item in items) {
        b.insert(
          cachedQualitySiteObs,
          CachedQualitySiteObsCompanion.insert(
            id: item['id'] as String,
            projectId: projectId,
            status: item['status'] as String? ?? 'OPEN',
            severity: Value(item['severity'] as String?),
            rawData: jsonEncode(item),
          ),
          mode: InsertMode.insertOrReplace,
        );
      }
    });
  }

  // ==================== EHS SITE OBS CACHE QUERIES ====================

  /// Get cached EHS site observations for a project, optionally filtered by
  /// status.
  ///
  /// Mirrors the quality site obs query pattern — EHS observations share the
  /// same open/closed lifecycle.
  Future<List<CachedEhsSiteOb>> getCachedEhsSiteObs(
      int projectId, String? statusFilter) async {
    final query = select(cachedEhsSiteObs)
      ..where((t) => t.projectId.equals(projectId));
    if (statusFilter != null) {
      query.where((t) => t.status.equals(statusFilter));
    }
    return query.get();
  }

  /// Cache EHS site observations from API response.
  ///
  /// Removes optimistic-insert rows (id starts with `local_`) before writing
  /// server data so confirmed server copies replace the pending placeholders.
  Future<void> cacheEhsSiteObs(
      List<Map<String, dynamic>> items, int projectId) async {
    await (delete(cachedEhsSiteObs)
          ..where((t) =>
              t.projectId.equals(projectId) & t.id.like('local_%')))
        .go();
    await batch((b) {
      for (final item in items) {
        b.insert(
          cachedEhsSiteObs,
          CachedEhsSiteObsCompanion.insert(
            id: item['id'] as String,
            projectId: projectId,
            status: item['status'] as String? ?? 'OPEN',
            severity: Value(item['severity'] as String?),
            rawData: jsonEncode(item),
          ),
          mode: InsertMode.insertOrReplace,
        );
      }
    });
  }

  /// Return distinct projectIds across all cached tables.
  ///
  /// Used by [BackgroundDownloadService] to know which projects to refresh
  /// during background downloads. Collects IDs from three sources so that a
  /// project opened in any feature (quality, progress, EHS) is included even
  /// if not all tables have been populated yet.
  ///
  /// Sources:
  /// - [CachedProjects]             — projects the user has ever opened
  /// - [CachedActivities]           — projects with cached planning activities
  /// - [CachedQualityActivityLists] — projects with cached QC data
  Future<List<int>> selectOnlyDistinctProjectIds() async {
    final Set<int> ids = {};

    // Source 1: cached projects list
    final projectQuery = selectOnly(cachedProjects, distinct: true)
      ..addColumns([cachedProjects.id]);
    final projectRows = await projectQuery.get();
    ids.addAll(
        projectRows.map((r) => r.read(cachedProjects.id)).whereType<int>());

    // Source 2: cached activities (projectId column)
    final activityQuery = selectOnly(cachedActivities, distinct: true)
      ..addColumns([cachedActivities.projectId]);
    final activityRows = await activityQuery.get();
    ids.addAll(activityRows
        .map((r) => r.read(cachedActivities.projectId))
        .whereType<int>());

    // Source 3: quality activity lists (original source — kept for backwards compat)
    final qualityQuery = selectOnly(cachedQualityActivityLists, distinct: true)
      ..addColumns([cachedQualityActivityLists.projectId]);
    final qualityRows = await qualityQuery.get();
    ids.addAll(qualityRows
        .map((r) => r.read(cachedQualityActivityLists.projectId))
        .whereType<int>());

    return ids.toList();
  }

  // ==================== SYNC STATUS QUERIES ====================

  /// Get pending progress entries count.
  ///
  /// Uses a SQL COUNT aggregate rather than loading all rows so that the
  /// query cost is O(1) regardless of how many pending entries exist.
  Future<int> getPendingProgressCount() async {
    final query = selectOnly(progressEntries)
      ..addColumns([progressEntries.id.count()])
      ..where(progressEntries.syncStatus.equals(SyncStatus.pending.value));
    final result = await query.getSingle();
    return result.read(progressEntries.id.count()) ?? 0;
  }

  /// Get sync status summary.
  ///
  /// Returns a map of [SyncStatus] → count for all progress entries. Useful
  /// for the sync status dashboard. Each status requires a separate query
  /// because Drift's typed DSL does not support GROUP BY on an integer column
  /// directly — iterating over enum values is the pragmatic alternative.
  Future<Map<SyncStatus, int>> getSyncStatusSummary() async {
    final result = <SyncStatus, int>{};
    for (final status in SyncStatus.values) {
      final query = selectOnly(progressEntries)
        ..addColumns([progressEntries.id.count()])
        ..where(progressEntries.syncStatus.equals(status.value));
      final row = await query.getSingle();
      result[status] = row.read(progressEntries.id.count()) ?? 0;
    }
    return result;
  }
}

/// Open (or create) the SQLite database file on the device.
///
/// [LazyDatabase] defers the actual file open until the first query, which
/// avoids blocking the UI thread during app startup. The file lives in the
/// application documents directory so it is backed up by iOS/Android cloud
/// backup and is not cleared by the OS temp-file cleaner.
///
/// [NativeDatabase.createInBackground] spawns a dedicated isolate for all
/// database I/O, keeping the main UI thread responsive even during large
/// batch inserts.
LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'setu_mobile.db'));
    return NativeDatabase.createInBackground(file);
  });
}

// ==================== TABLE DEFINITIONS ====================

/// Progress entries table for offline storage.
///
/// Each row represents a single quantity measurement entered by a site engineer
/// for a specific BOQ item + activity combination. Rows are written locally
/// first and synced to the server later by [SyncService].
class ProgressEntries extends Table {
  IntColumn get id => integer().autoIncrement()();
  /// Server-assigned ID returned after a successful sync; null until synced.
  IntColumn get serverId => integer().nullable()();
  IntColumn get projectId => integer()();
  IntColumn get activityId => integer()();
  IntColumn get epsNodeId => integer()();
  IntColumn get boqItemId => integer()();
  /// Reused to carry the execution plan ID (planId) when submitting to the
  /// measurements endpoint. Named microActivityId for historical reasons.
  IntColumn get microActivityId => integer().nullable()();
  RealColumn get quantity => real()();
  TextColumn get date => text()();
  TextColumn get remarks => text().nullable()();
  TextColumn get photoPaths => text().nullable()(); // JSON array of local paths
  IntColumn get syncStatus =>
      integer().withDefault(const Constant(0))(); // See SyncStatus enum below
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get syncedAt => dateTime().nullable()();
  TextColumn get syncError => text().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get idempotencyKey => text().nullable()(); // For safe retry
  /// Server's last-modified timestamp — used for delta sync conflict detection.
  DateTimeColumn get serverUpdatedAt => dateTime().nullable()();
  /// Client's last-modified timestamp — set on every local create or update.
  DateTimeColumn get localUpdatedAt =>
      dateTime().withDefault(currentDateAndTime)();
  /// Soft-delete flag. 1 = deleted locally, row not yet purged.
  IntColumn get isDeleted => integer().withDefault(const Constant(0))();
}

/// Daily logs table for offline storage.
///
/// Records planned vs. actual quantities per micro-activity per day, along
/// with optional delay reasons and labour counts. Follows the same
/// pending → syncing → synced/error lifecycle as [ProgressEntries].
class DailyLogs extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get serverId => integer().nullable()();
  IntColumn get microActivityId => integer()();
  TextColumn get logDate => text()();
  RealColumn get plannedQty => real()();
  RealColumn get actualQty => real()();
  IntColumn get laborCount => integer().nullable()();
  IntColumn get delayReasonId => integer().nullable()();
  TextColumn get delayNotes => text().nullable()();
  TextColumn get remarks => text().nullable()();
  IntColumn get syncStatus => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get syncedAt => dateTime().nullable()();
  TextColumn get syncError => text().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get idempotencyKey => text().nullable()();
  /// Server's last-modified timestamp — used for delta sync conflict detection.
  DateTimeColumn get serverUpdatedAt => dateTime().nullable()();
  /// Client's last-modified timestamp — set on every local create or update.
  DateTimeColumn get localUpdatedAt =>
      dateTime().withDefault(currentDateAndTime)();
  /// Soft-delete flag. 1 = deleted locally, row not yet purged.
  IntColumn get isDeleted => integer().withDefault(const Constant(0))();
}

/// Generic sync queue for tracking any pending server mutation.
///
/// Unlike [ProgressEntries] and [DailyLogs] which have dedicated tables, the
/// SyncQueue handles ad-hoc operations (quality RFIs, workflow steps, site
/// observations, etc.) by serialising the full payload as JSON. This means
/// new operation types can be added without schema migrations — only the
/// [SyncService] switch statement needs updating.
class SyncQueue extends Table {
  IntColumn get id => integer().autoIncrement()();
  /// Logical type of the operation, e.g. 'progress', 'daily_log',
  /// 'quality_rfi', 'ehs_site_obs_create'. Used as the dispatch key in
  /// [SyncService._processQualityQueue].
  TextColumn get entityType => text()(); // 'progress', 'daily_log', 'photo'
  IntColumn get entityId => integer()();
  TextColumn get operation => text()(); // 'create', 'update', 'delete'
  /// Full JSON-encoded payload to be sent to the server. Storing the entire
  /// payload avoids the need to re-query the source table at sync time.
  TextColumn get payload => text()(); // JSON payload
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get lastAttemptAt => dateTime().nullable()();
  TextColumn get lastError => text().nullable()();
  /// Higher priority items are processed first. Used to ensure user-initiated
  /// operations (e.g. RFI raises) complete before background refreshes.
  IntColumn get priority =>
      integer().withDefault(const Constant(0))(); // Higher = more important
}

/// Cached projects for offline viewing.
///
/// The composite [rawData] column stores the full server JSON so that the app
/// can render any project detail without needing individual column migrations
/// when the server response schema evolves.
class CachedProjects extends Table {
  IntColumn get id => integer()();
  TextColumn get name => text()();
  TextColumn get code => text().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get startDate => text().nullable()();
  TextColumn get endDate => text().nullable()();
  TextColumn get rawData => text()(); // Full JSON for flexibility
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached activities for offline viewing.
///
/// A project-scoped index exists on [projectId] (added in v5) to keep
/// per-project queries fast even when the table holds data for many projects.
class CachedActivities extends Table {
  IntColumn get id => integer()();
  IntColumn get projectId => integer()();
  IntColumn get epsNodeId => integer().nullable()();
  TextColumn get name => text()();
  TextColumn get status => text().nullable()();
  TextColumn get startDate => text().nullable()();
  TextColumn get endDate => text().nullable()();
  RealColumn get progress => real().withDefault(const Constant(0))();
  TextColumn get rawData => text()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached BOQ items for offline viewing.
///
/// Bill of Quantities items are referenced when entering progress quantities
/// to validate that the entered amount does not exceed the planned total.
class CachedBoqItems extends Table {
  IntColumn get id => integer()();
  IntColumn get projectId => integer()();
  TextColumn get name => text()();
  TextColumn get unit => text().nullable()();
  RealColumn get quantity => real()();
  RealColumn get rate => real().nullable()();
  TextColumn get rawData => text()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached EPS nodes for hierarchical navigation.
///
/// The EPS (Engineering Project Structure) tree mirrors the server-side
/// project hierarchy: project → phase → building → floor → zone.
/// [type] stores the level label so the UI can render the appropriate icon.
class CachedEpsNodes extends Table {
  IntColumn get id => integer()();
  IntColumn get projectId => integer()();
  /// Null for root-level nodes; set for all child nodes.
  IntColumn get parentId => integer().nullable()();
  TextColumn get name => text()();
  TextColumn get code => text().nullable()();
  TextColumn get type =>
      text()(); // 'project', 'phase', 'building', 'floor', etc.
  RealColumn get progress => real().withDefault(const Constant(0))();
  TextColumn get rawData => text()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached quality activity lists (one per list, keyed by list id + project).
///
/// An activity list groups a set of quality inspection activities for a
/// specific work package (e.g. "Foundation Concrete Pour"). Lists are scoped
/// to a project and optionally to an EPS node.
class CachedQualityActivityLists extends Table {
  IntColumn get id => integer()();
  IntColumn get projectId => integer()();
  /// Optional — when non-null, the list is specific to this EPS node (e.g. a
  /// floor-level inspection checklist).
  IntColumn get epsNodeId => integer().nullable()();
  TextColumn get name => text()();
  TextColumn get description => text().nullable()();
  /// Denormalised count so the list view can show "12 activities" without
  /// loading the activities themselves.
  IntColumn get activityCount => integer().withDefault(const Constant(0))();
  TextColumn get rawData => text()();
  DateTimeColumn get cachedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached quality activities (one per activity, keyed by activity id).
///
/// Each row represents a single line item in a quality inspection checklist.
/// [holdPoint] and [witnessPoint] flags control whether the activity requires
/// a mandatory stop (hold) or optional observation (witness) by a third party.
class CachedQualityActivities extends Table {
  IntColumn get id => integer()();
  IntColumn get listId => integer()();
  IntColumn get projectId => integer()();
  IntColumn get epsNodeId => integer().nullable()();
  /// Display order within the checklist — the UI sorts ascending by this value.
  IntColumn get sequence => integer().withDefault(const Constant(0))();
  TextColumn get activityName => text()();
  /// Lifecycle state: NOT_STARTED → IN_PROGRESS → PENDING_INSPECTION →
  /// APPROVED / REJECTED.
  TextColumn get status =>
      text().withDefault(const Constant('NOT_STARTED'))();
  /// 1 if this is a hold point (work must stop until approved), else 0.
  IntColumn get holdPoint => integer().withDefault(const Constant(0))();
  /// 1 if this is a witness point (third party should observe), else 0.
  IntColumn get witnessPoint => integer().withDefault(const Constant(0))();
  TextColumn get rawData => text()();
  DateTimeColumn get cachedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached quality site observations.
///
/// Site observations are ad-hoc defects or non-conformances raised by
/// inspectors. Unlike structured checklist activities they use a string UUID
/// as the primary key (server-generated).
class CachedQualitySiteObs extends Table {
  /// UUID assigned by the server — stored as text to avoid int overflow on
  /// 64-bit UUIDs and to match the server's string type.
  TextColumn get id => text()();
  IntColumn get projectId => integer()();
  TextColumn get status => text()();
  TextColumn get severity => text().nullable()();
  TextColumn get rawData => text()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached EHS site observations.
///
/// Health, Safety and Environment observations follow the same open/rectify/
/// close lifecycle as quality site observations but are managed by a separate
/// team (the EHS department) and have their own API endpoints.
class CachedEhsSiteObs extends Table {
  TextColumn get id => text()();
  IntColumn get projectId => integer()();
  TextColumn get status => text()();
  TextColumn get severity => text().nullable()();
  TextColumn get rawData => text()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

// ==================== SYNC STATUS ENUM ====================

/// Represents the lifecycle state of a locally-stored data row with respect
/// to server synchronisation.
///
/// The integer [value] is persisted in the `sync_status` column so that
/// ordering and equality checks work natively in SQL without a string lookup.
enum SyncStatus {
  /// Row has been written locally but not yet attempted to sync.
  pending(0),
  /// Sync attempt is currently in progress for this row.
  syncing(1),
  /// Successfully synced to the server.
  synced(2),
  /// Last sync attempt failed but the row is eligible for retry (network/5xx).
  failed(3),
  /// Permanent error — the server rejected the data (4xx) and user action
  /// is required to correct or delete the row.
  error(4);

  final int value;
  const SyncStatus(this.value);

  /// Convert a raw integer stored in SQLite back to the enum variant.
  ///
  /// Defaults to [pending] if the stored value is unrecognised, which is
  /// safer than throwing — an unrecognised status should be retried rather
  /// than silently dropped.
  static SyncStatus fromValue(int value) {
    return SyncStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => SyncStatus.pending,
    );
  }
}
