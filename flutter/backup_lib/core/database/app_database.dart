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
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration {
    return MigrationStrategy(
      onCreate: (Migrator m) async {
        await m.createAll();
      },
      onUpgrade: (Migrator m, int from, int to) async {
        // Handle future migrations here
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
  IntColumn get syncStatus => integer().withDefault(const Constant(0))(); // 0=pending, 1=synced, 2=failed
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get syncedAt => dateTime().nullable()();
  TextColumn get syncError => text().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
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
  IntColumn get priority => integer().withDefault(const Constant(0))(); // Higher = more important
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

// ==================== SYNC STATUS ENUM ====================

enum SyncStatus {
  pending(0),
  synced(1),
  failed(2);

  final int value;
  const SyncStatus(this.value);

  static SyncStatus fromValue(int value) {
    return SyncStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => SyncStatus.pending,
    );
  }
}
