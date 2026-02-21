import 'dart:convert';
import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

/// Local database for offline storage using Drift (SQLite)
@DriftDatabase(
  tables: [
    ProgressEntries,
    DailyLogs,
    SyncQueue,
    CachedProjects,
    CachedActivities,
    CachedBoqItems,
    CachedEpsNodes,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration {
    return MigrationStrategy(
      onCreate: (Migrator m) async {
        await m.createAll();
      },
      onUpgrade: (Migrator m, int from, int to) async {
        // Handle migrations for version 2
        if (from < 2) {
          await m.createTable(cachedEpsNodes);
        }
      },
    );
  }

  // Clear all data (for logout)
  Future<void> clearAll() async {
    await delete(progressEntries).go();
    await delete(dailyLogs).go();
    await delete(syncQueue).go();
    await delete(cachedProjects).go();
    await delete(cachedActivities).go();
    await delete(cachedBoqItems).go();
    await delete(cachedEpsNodes).go();
  }

  // ==================== EPS NODE QUERIES ====================

  /// Get EPS nodes by parent ID (for hierarchical navigation)
  Future<List<CachedEpsNode>> getEpsNodesByParent(int? parentId) async {
    if (parentId == null) {
      // Get root nodes (no parent)
      return (select(cachedEpsNodes)..where((t) => t.parentId.isNull())).get();
    }
    return (select(cachedEpsNodes)..where((t) => t.parentId.equals(parentId)))
        .get();
  }

  /// Get all EPS nodes for a project
  Future<List<CachedEpsNode>> getEpsNodesForProject(int projectId) async {
    return (select(cachedEpsNodes)..where((t) => t.projectId.equals(projectId)))
        .get();
  }

  /// Cache EPS nodes from API response
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

  /// Get activities by EPS node ID
  Future<List<CachedActivity>> getActivitiesByEpsNode(int epsNodeId) async {
    return (select(cachedActivities)
          ..where((t) => t.epsNodeId.equals(epsNodeId)))
        .get();
  }

  /// Get all activities for a project
  Future<List<CachedActivity>> getActivitiesForProject(int projectId) async {
    return (select(cachedActivities)
          ..where((t) => t.projectId.equals(projectId)))
        .get();
  }

  /// Cache activities from API response
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
            startDate: Value(activity['startDate'] as String? ??
                activity['start_date'] as String?),
            endDate: Value(activity['endDate'] as String? ??
                activity['end_date'] as String?),
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

  // ==================== SYNC STATUS QUERIES ====================

  /// Get pending progress entries count
  Future<int> getPendingProgressCount() async {
    final query = selectOnly(progressEntries)
      ..addColumns([progressEntries.id.count()])
      ..where(progressEntries.syncStatus.equals(SyncStatus.pending.value));
    final result = await query.getSingle();
    return result.read(progressEntries.id.count()) ?? 0;
  }

  /// Get sync status summary
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

/// Open database connection
LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'setu_mobile.db'));
    return NativeDatabase.createInBackground(file);
  });
}

// ==================== TABLE DEFINITIONS ====================

/// Progress entries table for offline storage
class ProgressEntries extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get serverId => integer().nullable()();
  IntColumn get projectId => integer()();
  IntColumn get activityId => integer()();
  IntColumn get epsNodeId => integer()();
  IntColumn get boqItemId => integer()();
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
}

/// Daily logs table for offline storage
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
}

/// Sync queue for tracking pending uploads
class SyncQueue extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get entityType => text()(); // 'progress', 'daily_log', 'photo'
  IntColumn get entityId => integer()();
  TextColumn get operation => text()(); // 'create', 'update', 'delete'
  TextColumn get payload => text()(); // JSON payload
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get lastAttemptAt => dateTime().nullable()();
  TextColumn get lastError => text().nullable()();
  IntColumn get priority =>
      integer().withDefault(const Constant(0))(); // Higher = more important
}

/// Cached projects for offline viewing
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

/// Cached activities for offline viewing
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

/// Cached BOQ items for offline viewing
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

/// Cached EPS nodes for hierarchical navigation
class CachedEpsNodes extends Table {
  IntColumn get id => integer()();
  IntColumn get projectId => integer()();
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

// ==================== SYNC STATUS ENUM ====================

enum SyncStatus {
  pending(0),
  syncing(1),
  synced(2),
  failed(3),
  error(4); // Permanent error - requires user action

  final int value;
  const SyncStatus(this.value);

  static SyncStatus fromValue(int value) {
    return SyncStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => SyncStatus.pending,
    );
  }
}
