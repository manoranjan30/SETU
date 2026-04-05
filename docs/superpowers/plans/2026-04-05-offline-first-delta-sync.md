# Offline-First Delta Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all offline-first gaps across Progress, Quality, and EHS modules — add delta sync, make Quality/EHS BLoCs cache-first, add photo upload queue, and add sync status dots.

**Architecture:** Schema-first — DB migration (v6) → backend SyncModule → Flutter SyncService delta sync → BLoC cache-first reads → photo queue → UI dots. Each task is independently testable.

**Tech Stack:** Flutter + Drift (SQLite), NestJS + TypeORM (PostgreSQL), Dio, flutter_bloc, shared_preferences, workmanager

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `flutter/lib/core/database/app_database.dart` | Modify | Add 3 columns + schema v6 migration |
| `backend/src/sync/sync-query.dto.ts` | Create | DTO: `since` + `projectId` query params |
| `backend/src/sync/sync.service.ts` | Create | Query logic: `updatedAt > since` for all 3 modules |
| `backend/src/sync/sync.controller.ts` | Create | 3 GET endpoints |
| `backend/src/sync/sync.module.ts` | Create | NestJS module wiring |
| `backend/src/app.module.ts` | Modify | Register SyncModule |
| `flutter/lib/core/sync/delta_sync_cursors.dart` | Create | SharedPreferences cursor read/write helper |
| `flutter/lib/core/api/api_endpoints.dart` | Modify | Add 3 `/sync/*` endpoint static methods |
| `flutter/lib/core/api/setu_api_client.dart` | Modify | Add 3 `deltaSync*()` methods |
| `flutter/lib/core/sync/sync_service.dart` | Modify | Add `_deltaSync()`, call from `syncAll()`, add photo dispatch |
| `flutter/lib/features/quality/presentation/bloc/quality_request_bloc.dart` | Modify | Cache-first reads for EPS tree + activity lists |
| `flutter/lib/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart` | Modify | Cache-first reads |
| `flutter/lib/features/ehs/presentation/bloc/ehs_incident_bloc.dart` | Modify | Use Drift cache instead of SharedPreferences |

---

## Task 1: Flutter — Schema v6 Migration

**Files:**
- Modify: `flutter/lib/core/database/app_database.dart`

- [ ] **Step 1: Add 3 columns to ProgressEntries class**

In `app_database.dart`, find the `ProgressEntries` class (around line 639). Add these 3 columns **after** the `idempotencyKey` column:

```dart
/// Server's last-modified timestamp — used for delta sync conflict detection.
/// Null until the record has been synced at least once and the server response
/// includes an updatedAt value.
DateTimeColumn get serverUpdatedAt => dateTime().nullable()();

/// Client's last-modified timestamp — set on every local create or update.
/// Used to determine which version wins in a conflict: if serverUpdatedAt >
/// localUpdatedAt the server has newer data; otherwise the user's edit wins.
DateTimeColumn get localUpdatedAt =>
    dateTime().withDefault(currentDateAndTime)();

/// Soft-delete flag. 1 = deleted locally, row not yet purged.
/// Allows the sync queue to send a DELETE to the server before the row
/// is removed, preventing ghost entries on the server.
IntColumn get isDeleted => integer().withDefault(const Constant(0))();
```

- [ ] **Step 2: Add the same 3 columns to DailyLogs class**

Find the `DailyLogs` class (around line 668). Add the same 3 columns after `idempotencyKey`:

```dart
DateTimeColumn get serverUpdatedAt => dateTime().nullable()();
DateTimeColumn get localUpdatedAt =>
    dateTime().withDefault(currentDateAndTime)();
IntColumn get isDeleted => integer().withDefault(const Constant(0))();
```

- [ ] **Step 3: Bump schema version from 5 to 6**

Find this line (around line 41):
```dart
int get schemaVersion => 5;
```
Change it to:
```dart
int get schemaVersion => 6;
```

- [ ] **Step 4: Add v6 migration block**

In the `onUpgrade` method, after the `if (from < 5)` block, add:

```dart
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
```

- [ ] **Step 5: Regenerate Drift generated code**

Run from the `flutter/` directory:
```bash
dart run build_runner build --delete-conflicting-outputs
```
Expected: `app_database.g.dart` regenerated with no errors. If Drift reports a schema mismatch, double-check the column definitions in Step 1/2 match the raw SQL in Step 4.

- [ ] **Step 6: Commit**

```bash
git add flutter/lib/core/database/app_database.dart flutter/lib/core/database/app_database.g.dart
git commit -m "feat(db): schema v6 — add server_updated_at, local_updated_at, is_deleted"
```

---

## Task 2: Backend — NestJS SyncModule

**Files:**
- Create: `backend/src/sync/sync-query.dto.ts`
- Create: `backend/src/sync/sync.service.ts`
- Create: `backend/src/sync/sync.controller.ts`
- Create: `backend/src/sync/sync.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create the query DTO**

Create `backend/src/sync/sync-query.dto.ts`:

```typescript
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class SyncQueryDto {
  /**
   * ISO-8601 timestamp. Only records updated AFTER this time are returned.
   * If omitted, all records for the project are returned (bootstrap fetch).
   */
  @IsOptional()
  @IsDateString()
  since?: string;

  /** The project to scope the sync to. */
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  projectId: number;
}
```

- [ ] **Step 2: Create sync.service.ts**

Create `backend/src/sync/sync.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ExecutionProgressEntry } from '../execution/entities/execution-progress-entry.entity';
import { QualityActivityList } from '../quality/entities/quality-activity-list.entity';
import { QualityActivity } from '../quality/entities/quality-activity.entity';
import { SiteObservation } from '../quality/entities/site-observation.entity';
import { EhsObservation } from '../ehs/entities/ehs-observation.entity';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(ExecutionProgressEntry)
    private readonly progressRepo: Repository<ExecutionProgressEntry>,
    @InjectRepository(QualityActivityList)
    private readonly qualityListRepo: Repository<QualityActivityList>,
    @InjectRepository(QualityActivity)
    private readonly qualityActivityRepo: Repository<QualityActivity>,
    @InjectRepository(SiteObservation)
    private readonly qualitySiteObsRepo: Repository<SiteObservation>,
    @InjectRepository(EhsObservation)
    private readonly ehsObsRepo: Repository<EhsObservation>,
  ) {}

  /** Returns progress entries for a project updated after [since]. */
  async getProgressDelta(projectId: number, since?: string) {
    const where: any = { projectId };
    if (since) {
      where.updatedAt = MoreThan(new Date(since));
    }
    const data = await this.progressRepo.find({
      where,
      order: { updatedAt: 'ASC' },
    });
    return { synced_at: new Date().toISOString(), count: data.length, data };
  }

  /** Returns quality lists + activities + site obs for a project updated after [since]. */
  async getQualityDelta(projectId: number, since?: string) {
    const dateFilter = since ? MoreThan(new Date(since)) : undefined;
    const whereBase: any = { projectId };
    if (dateFilter) whereBase.updatedAt = dateFilter;

    const [lists, activities, siteObs] = await Promise.all([
      this.qualityListRepo.find({ where: whereBase, order: { updatedAt: 'ASC' } }),
      this.qualityActivityRepo.find({ where: whereBase, order: { updatedAt: 'ASC' } }),
      this.qualitySiteObsRepo.find({ where: whereBase, order: { updatedAt: 'ASC' } }),
    ]);

    return {
      synced_at: new Date().toISOString(),
      count: lists.length + activities.length + siteObs.length,
      data: { lists, activities, siteObs },
    };
  }

  /** Returns EHS observations for a project updated after [since]. */
  async getEhsDelta(projectId: number, since?: string) {
    const where: any = { projectId };
    if (since) {
      where.updatedAt = MoreThan(new Date(since));
    }
    const data = await this.ehsObsRepo.find({
      where,
      order: { updatedAt: 'ASC' },
    });
    return { synced_at: new Date().toISOString(), count: data.length, data };
  }
}
```

- [ ] **Step 3: Create sync.controller.ts**

Create `backend/src/sync/sync.controller.ts`:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';
import { SyncQueryDto } from './sync-query.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * GET /api/sync/progress?projectId=123&since=2026-04-01T00:00:00Z
   * Returns progress entries updated after [since] for the project.
   * If [since] is omitted, returns all entries (bootstrap).
   */
  @Get('progress')
  getProgressDelta(@Query() query: SyncQueryDto) {
    return this.syncService.getProgressDelta(query.projectId, query.since);
  }

  /**
   * GET /api/sync/quality?projectId=123&since=2026-04-01T00:00:00Z
   * Returns quality lists, activities, and site observations updated after [since].
   */
  @Get('quality')
  getQualityDelta(@Query() query: SyncQueryDto) {
    return this.syncService.getQualityDelta(query.projectId, query.since);
  }

  /**
   * GET /api/sync/ehs?projectId=123&since=2026-04-01T00:00:00Z
   * Returns EHS observations updated after [since].
   */
  @Get('ehs')
  getEhsDelta(@Query() query: SyncQueryDto) {
    return this.syncService.getEhsDelta(query.projectId, query.since);
  }
}
```

- [ ] **Step 4: Create sync.module.ts**

Create `backend/src/sync/sync.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { ExecutionProgressEntry } from '../execution/entities/execution-progress-entry.entity';
import { QualityActivityList } from '../quality/entities/quality-activity-list.entity';
import { QualityActivity } from '../quality/entities/quality-activity.entity';
import { SiteObservation } from '../quality/entities/site-observation.entity';
import { EhsObservation } from '../ehs/entities/ehs-observation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExecutionProgressEntry,
      QualityActivityList,
      QualityActivity,
      SiteObservation,
      EhsObservation,
    ]),
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
```

- [ ] **Step 5: Register SyncModule in app.module.ts**

Open `backend/src/app.module.ts`. Find the imports array. Add `SyncModule` to it.

First, add the import at the top of the file (after the other module imports):
```typescript
import { SyncModule } from './sync/sync.module';
```

Then, in the `@Module({ imports: [ ... ] })` array, add `SyncModule` on its own line (anywhere in the list — order doesn't matter):
```typescript
SyncModule,
```

- [ ] **Step 6: Verify the backend compiles**

From `backend/`:
```bash
npm run build
```
Expected: exits with code 0. If TypeScript errors appear about entity imports (e.g. `QualityActivityList` not found), check the exact file path with:
```bash
find src -name "quality-activity-list.entity.ts"
```
Then fix the import path in `sync.service.ts` and `sync.module.ts` accordingly.

- [ ] **Step 7: Smoke-test the endpoints**

Start the backend (`npm run start:dev`) and run:
```bash
# Replace TOKEN with a valid JWT from login
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/sync/progress?projectId=1"
```
Expected: `{"synced_at":"...","count":N,"data":[...]}`. If you get 401, check the JWT. If 404, check `SyncModule` is registered.

- [ ] **Step 8: Commit**

```bash
git add backend/src/sync/ backend/src/app.module.ts
git commit -m "feat(backend): add SyncModule with delta sync endpoints for progress, quality, EHS"
```

---

## Task 3: Flutter — Delta Sync Wiring (Cursors + API Client)

**Files:**
- Create: `flutter/lib/core/sync/delta_sync_cursors.dart`
- Modify: `flutter/lib/core/api/api_endpoints.dart`
- Modify: `flutter/lib/core/api/setu_api_client.dart`

- [ ] **Step 1: Create DeltaSyncCursors**

Create `flutter/lib/core/sync/delta_sync_cursors.dart`:

```dart
import 'package:shared_preferences/shared_preferences.dart';

/// Manages the ISO-8601 timestamps used as cursors for delta sync.
///
/// Each module (progress, quality, ehs) has its own cursor stored in
/// SharedPreferences. When a delta sync completes successfully the cursor
/// is advanced to the [synced_at] timestamp returned by the server.
///
/// A null cursor means "never synced" — the SyncService will call the
/// endpoint without a [since] parameter to bootstrap all data.
class DeltaSyncCursors {
  static const _progressKey = 'last_delta_sync_progress_at';
  static const _qualityKey = 'last_delta_sync_quality_at';
  static const _ehsKey = 'last_delta_sync_ehs_at';

  final SharedPreferences _prefs;

  DeltaSyncCursors(this._prefs);

  /// Factory constructor — awaits SharedPreferences.
  static Future<DeltaSyncCursors> create() async {
    final prefs = await SharedPreferences.getInstance();
    return DeltaSyncCursors(prefs);
  }

  String? get progressCursor => _prefs.getString(_progressKey);
  String? get qualityCursor => _prefs.getString(_qualityKey);
  String? get ehsCursor => _prefs.getString(_ehsKey);

  Future<void> setProgressCursor(String syncedAt) =>
      _prefs.setString(_progressKey, syncedAt);
  Future<void> setQualityCursor(String syncedAt) =>
      _prefs.setString(_qualityKey, syncedAt);
  Future<void> setEhsCursor(String syncedAt) =>
      _prefs.setString(_ehsKey, syncedAt);

  /// Reset all cursors — forces a full re-download on the next sync.
  Future<void> resetAll() async {
    await _prefs.remove(_progressKey);
    await _prefs.remove(_qualityKey);
    await _prefs.remove(_ehsKey);
  }
}
```

- [ ] **Step 2: Add sync endpoints to ApiEndpoints**

Open `flutter/lib/core/api/api_endpoints.dart`. After the last endpoint block, add:

```dart
// ==================== DELTA SYNC ENDPOINTS ====================

/// GET /sync/progress?projectId=X&since=ISO
/// Returns progress entries updated after [since] for the project.
/// [since] is nullable — omit for a full bootstrap fetch.
static String syncProgress({required int projectId, String? since}) {
  final params = 'projectId=$projectId${since != null ? '&since=${Uri.encodeComponent(since)}' : ''}';
  return '/sync/progress?$params';
}

/// GET /sync/quality?projectId=X&since=ISO
/// Returns quality lists, activities, and site observations.
static String syncQuality({required int projectId, String? since}) {
  final params = 'projectId=$projectId${since != null ? '&since=${Uri.encodeComponent(since)}' : ''}';
  return '/sync/quality?$params';
}

/// GET /sync/ehs?projectId=X&since=ISO
/// Returns EHS observations updated after [since].
static String syncEhs({required int projectId, String? since}) {
  final params = 'projectId=$projectId${since != null ? '&since=${Uri.encodeComponent(since)}' : ''}';
  return '/sync/ehs?$params';
}
```

- [ ] **Step 3: Add deltaSync methods to SetuApiClient**

Open `flutter/lib/core/api/setu_api_client.dart`. After the last method block, add:

```dart
// ==================== DELTA SYNC ENDPOINTS ====================

/// GET /sync/progress?projectId=X&since=ISO
/// Returns `{synced_at, count, data: [...]}`.
/// Pass [since] = null for a full bootstrap.
Future<Map<String, dynamic>> deltaProgressSync({
  required int projectId,
  String? since,
}) async {
  final response = await _dio.get(
    ApiEndpoints.syncProgress(projectId: projectId, since: since),
  );
  return response.data as Map<String, dynamic>;
}

/// GET /sync/quality?projectId=X&since=ISO
/// Returns `{synced_at, count, data: {lists, activities, siteObs}}`.
Future<Map<String, dynamic>> deltaQualitySync({
  required int projectId,
  String? since,
}) async {
  final response = await _dio.get(
    ApiEndpoints.syncQuality(projectId: projectId, since: since),
  );
  return response.data as Map<String, dynamic>;
}

/// GET /sync/ehs?projectId=X&since=ISO
/// Returns `{synced_at, count, data: [...]}`.
Future<Map<String, dynamic>> deltaEhsSync({
  required int projectId,
  String? since,
}) async {
  final response = await _dio.get(
    ApiEndpoints.syncEhs(projectId: projectId, since: since),
  );
  return response.data as Map<String, dynamic>;
}
```

- [ ] **Step 4: Commit**

```bash
git add flutter/lib/core/sync/delta_sync_cursors.dart \
        flutter/lib/core/api/api_endpoints.dart \
        flutter/lib/core/api/setu_api_client.dart
git commit -m "feat(flutter): add DeltaSyncCursors helper and delta sync API methods"
```

---

## Task 4: Flutter — SyncService Delta Sync

**Files:**
- Modify: `flutter/lib/core/sync/sync_service.dart`

- [ ] **Step 1: Add DeltaSyncCursors import**

At the top of `sync_service.dart`, add:
```dart
import 'package:setu_mobile/core/sync/delta_sync_cursors.dart';
```

- [ ] **Step 2: Add _deltaSync() method**

Add this method to `SyncService`, after `_processQualityQueue()`:

```dart
/// Pull changes from the server since the last successful delta sync.
///
/// For each module (progress, quality, ehs):
///   1. Reads the stored cursor timestamp from SharedPreferences.
///   2. Calls GET /sync/{module}?since=cursor&projectId=projectId.
///   3. Upserts the returned records into the local Drift cache tables.
///   4. Skips local records with sync_status = pending (user's edits win).
///   5. Advances the cursor to response.synced_at on success.
///
/// Only runs when the device is online. Silently no-ops on network error
/// so it does not interfere with the existing push-sync logic.
Future<void> _deltaSync(int projectId) async {
  if (!await _networkInfo.isConnected) return;

  final cursors = await DeltaSyncCursors.create();

  // ── Progress delta ──────────────────────────────────────────────────────
  try {
    final res = await _apiClient.deltaProgressSync(
      projectId: projectId,
      since: cursors.progressCursor,
    );
    final syncedAt = res['synced_at'] as String;
    final records = (res['data'] as List<dynamic>).cast<Map<String, dynamic>>();

    for (final record in records) {
      final serverId = record['id'] as int?;
      if (serverId == null) continue;

      // Find the matching local entry (if any).
      final localEntries = await (_database.select(_database.progressEntries)
            ..where((t) => t.serverId.equals(serverId)))
          .get();

      if (localEntries.isNotEmpty) {
        final local = localEntries.first;
        // USER WINS: never overwrite a pending local edit with server data.
        if (local.syncStatus == SyncStatus.pending.value) continue;
        // Update server timestamp so future delta syncs have a valid cursor.
        await (_database.update(_database.progressEntries)
              ..where((t) => t.id.equals(local.id)))
            .write(ProgressEntriesCompanion(
          serverUpdatedAt: Value(
              DateTime.tryParse(record['updatedAt']?.toString() ?? '')),
        ));
      }
      // No local entry — nothing to update (server record not yet seen locally).
    }
    await cursors.setProgressCursor(syncedAt);
  } catch (e) {
    _logger.w('Progress delta sync failed (non-fatal): $e');
  }

  // ── Quality delta ───────────────────────────────────────────────────────
  try {
    final res = await _apiClient.deltaQualitySync(
      projectId: projectId,
      since: cursors.qualityCursor,
    );
    final syncedAt = res['synced_at'] as String;
    final data = res['data'] as Map<String, dynamic>;

    final lists = (data['lists'] as List<dynamic>).cast<Map<String, dynamic>>();
    final activities =
        (data['activities'] as List<dynamic>).cast<Map<String, dynamic>>();
    final siteObs =
        (data['siteObs'] as List<dynamic>).cast<Map<String, dynamic>>();

    if (lists.isNotEmpty) {
      await _database.cacheActivityLists(lists, projectId);
    }
    if (activities.isNotEmpty) {
      await _database.cacheQualityActivities(activities, projectId);
    }
    if (siteObs.isNotEmpty) {
      await _database.cacheQualitySiteObs(siteObs, projectId);
    }

    await cursors.setQualityCursor(syncedAt);
  } catch (e) {
    _logger.w('Quality delta sync failed (non-fatal): $e');
  }

  // ── EHS delta ────────────────────────────────────────────────────────────
  try {
    final res = await _apiClient.deltaEhsSync(
      projectId: projectId,
      since: cursors.ehsCursor,
    );
    final syncedAt = res['synced_at'] as String;
    final records = (res['data'] as List<dynamic>).cast<Map<String, dynamic>>();

    if (records.isNotEmpty) {
      await _database.cacheEhsSiteObs(records, projectId);
    }

    await cursors.setEhsCursor(syncedAt);
  } catch (e) {
    _logger.w('EHS delta sync failed (non-fatal): $e');
  }
}
```

- [ ] **Step 3: Call _deltaSync from syncAll()**

In `syncAll()`, add the delta sync call after `_processQualityQueue()` and before the pending count check. The method needs a `projectId` — add it as a parameter to `syncAll()`.

Find the `syncAll()` signature:
```dart
Future<SyncResult> syncAll() async {
```
Change it to:
```dart
Future<SyncResult> syncAll({int? projectId}) async {
```

Then in the body, after `await _processQualityQueue();`, add:
```dart
// Pull server changes (delta sync) — runs after push to avoid overwriting
// data we just uploaded.
if (projectId != null) {
  await _deltaSync(projectId);
}
```

- [ ] **Step 4: Check if cacheQualityActivities and cacheEhsSiteObs exist**

Open `flutter/lib/core/database/app_database.dart` and search for `cacheActivityLists`. If `cacheQualityActivities` and `cacheEhsSiteObs` methods don't exist, add them after the existing cache methods:

```dart
/// Upsert quality activities into the local cache.
Future<void> cacheQualityActivities(
    List<Map<String, dynamic>> records, int projectId) async {
  await batch((b) {
    for (final r in records) {
      b.insertAll(
        cachedQualityActivities,
        [
          CachedQualityActivitiesCompanion.insert(
            id: r['id'] as int,
            listId: r['listId'] as int,
            projectId: projectId,
            epsNodeId: Value(r['epsNodeId'] as int?),
            sequence: r['sequence'] as int? ?? 0,
            activityName: r['activityName'] as String? ?? '',
            status: Value(r['status'] as String?),
            holdPoint: Value(r['holdPoint'] as bool? ?? false),
            witnessPoint: Value(r['witnessPoint'] as bool? ?? false),
            rawData: jsonEncode(r),
          )
        ],
        mode: InsertMode.insertOrReplace,
      );
    }
  });
}

/// Upsert EHS site observations into the local cache.
Future<void> cacheEhsSiteObs(
    List<Map<String, dynamic>> records, int projectId) async {
  await batch((b) {
    for (final r in records) {
      b.insertAll(
        cachedEhsSiteObs,
        [
          CachedEhsSiteObsCompanion.insert(
            id: r['id'] as String,
            projectId: projectId,
            status: Value(r['status'] as String?),
            severity: Value(r['severity'] as String?),
            rawData: jsonEncode(r),
          )
        ],
        mode: InsertMode.insertOrReplace,
      );
    }
  });
}
```

- [ ] **Step 5: Re-run code generation if app_database.dart was modified**

```bash
cd flutter && dart run build_runner build --delete-conflicting-outputs
```

- [ ] **Step 6: Commit**

```bash
git add flutter/lib/core/sync/sync_service.dart flutter/lib/core/database/app_database.dart flutter/lib/core/database/app_database.g.dart
git commit -m "feat(flutter): add delta sync pull in SyncService._deltaSync()"
```

---

## Task 5: Flutter — QualityRequestBloc Cache-First Reads

**Files:**
- Modify: `flutter/lib/features/quality/presentation/bloc/quality_request_bloc.dart`

The BLoC already has Drift cache fallback on network failure. This task changes it to **serve cached data first** (instantly) while refreshing in the background.

- [ ] **Step 1: Make _onLoadEpsTree cache-first**

Find the `_onLoadEpsTree` method. Replace the entire method body:

```dart
Future<void> _onLoadEpsTree(
    LoadEpsTree event, Emitter<QualityRequestState> emit) async {
  emit(const QualityRequestLoading());
  final prefsKey = 'eps_tree_${event.projectId}';

  // Serve cache immediately so the UI is not blocked.
  final prefs = await SharedPreferences.getInstance();
  final cached = prefs.getString(prefsKey);
  if (cached != null) {
    final raw = jsonDecode(cached) as List<dynamic>;
    final nodes = raw
        .map((e) => EpsTreeNode.fromJson(e as Map<String, dynamic>))
        .toList();
    emit(EpsTreeLoaded(nodes: nodes, projectId: event.projectId));
    // Don't return — fall through to refresh from server in background.
  }

  try {
    final raw = await _apiClient.getEpsTreeForProject(event.projectId);
    await prefs.setString(prefsKey, jsonEncode(raw));
    final nodes = raw
        .map((e) => EpsTreeNode.fromJson(e as Map<String, dynamic>))
        .toList();
    emit(EpsTreeLoaded(nodes: nodes, projectId: event.projectId));
  } catch (e) {
    if (_isNonNetworkError(e)) {
      emit(QualityRequestError(_friendly(e)));
      return;
    }
    // Already served from cache above — if cache was null, show error.
    if (cached == null) {
      emit(const QualityRequestError(
          'No connection and no cached EPS tree. Connect to load locations.'));
    }
    // If cache was served, silently swallow the network error — user sees data.
  }
}
```

- [ ] **Step 2: Make _onSelectEpsNode cache-first**

Find the `_onSelectEpsNode` method. Replace the entire method body:

```dart
Future<void> _onSelectEpsNode(
    SelectEpsNode event, Emitter<QualityRequestState> emit) async {
  emit(const QualityRequestLoading());

  // Serve Drift cache immediately (instant).
  final cachedLists = await _database.getCachedActivityLists(
      event.projectId, event.epsNodeId);
  if (cachedLists.isNotEmpty) {
    final lists = cachedLists
        .map((c) => QualityActivityList.fromJson(
            jsonDecode(c.rawData) as Map<String, dynamic>))
        .toList();
    emit(ActivityListsLoaded(
      lists: lists,
      projectId: event.projectId,
      epsNodeId: event.epsNodeId,
      isFromCache: true,
    ));
    // Fall through to refresh in background.
  }

  try {
    final raw = await _apiClient.getQualityActivityLists(
      projectId: event.projectId,
      epsNodeId: event.epsNodeId,
    );
    await _database.cacheActivityLists(
        raw.cast<Map<String, dynamic>>(), event.projectId);
    final lists = raw
        .map((e) => QualityActivityList.fromJson(e as Map<String, dynamic>))
        .toList();
    emit(ActivityListsLoaded(
      lists: lists,
      projectId: event.projectId,
      epsNodeId: event.epsNodeId,
    ));
  } catch (e) {
    if (_isNonNetworkError(e)) {
      emit(QualityRequestError(_friendly(e)));
      return;
    }
    if (cachedLists.isEmpty) {
      emit(const QualityRequestError(
          'Template not available offline. Please sync while connected.'));
    }
    // If cache was served, swallow network error silently.
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add flutter/lib/features/quality/presentation/bloc/quality_request_bloc.dart
git commit -m "feat(quality): make BLoC cache-first — serve Drift cache instantly, refresh in background"
```

---

## Task 6: Flutter — EHS BLoC Cache-First

**Files:**
- Modify: `flutter/lib/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart`
- Modify: `flutter/lib/features/ehs/presentation/bloc/ehs_incident_bloc.dart`

**Context:** `EhsSiteObsBloc` already writes page-0 data to `CachedEhsSiteObs` Drift table and reads it back on network failure (lines 324-363 of the BLoC). The fix is to serve cached data FIRST (before attempting the API), then update when the API responds. `EhsIncidentBloc` uses SharedPreferences — keep that pattern but serve the cache immediately instead of only on failure. Note: no permits-to-work feature exists in the current app.

### EhsSiteObsBloc — make _fetch() cache-first

- [ ] **Step 1: Serve Drift cache immediately in _fetch()**

The existing `_fetch()` in `ehs_site_obs_bloc.dart` currently:
1. Tries API → caches on success
2. Falls back to Drift on failure

Change it to serve Drift first. Find the `_fetch()` method (around line 305). Replace the **entire method body** (from the opening `async {` to the closing `}`):

```dart
}) async {
  // ── Step 1: Serve Drift cache immediately (page-0 unfiltered only) ──────
  if (offset == 0) {
    try {
      final cached = await _db.getCachedEhsSiteObs(projectId, statusFilter);
      if (cached.isNotEmpty) {
        final obs = cached
            .map((r) => EhsSiteObservation.fromJson(
                jsonDecode(r.rawData) as Map<String, dynamic>))
            .toList();
        emit(EhsSiteObsLoaded(
          observations: obs,
          appliedStatusFilter: statusFilter,
          appliedSeverityFilter: severityFilter,
          fromCache: true,
          hasMore: false,
        ));
        // Fall through — try to refresh from server in background.
      }
    } catch (_) {
      // Cache read failed — proceed to API attempt.
    }
  }

  // ── Step 2: Attempt live API fetch ──────────────────────────────────────
  try {
    final raw = await _api.getEhsSiteObs(
      projectId: projectId,
      status: statusFilter,
      severity: severityFilter,
      limit: _pageLimit,
      offset: offset,
    );
    final rawList = raw.map((e) => e as Map<String, dynamic>).toList();

    // Only cache unfiltered page-0 for offline fallback.
    if (statusFilter == null && severityFilter == null && offset == 0) {
      await _db.cacheEhsSiteObs(rawList, projectId);
    }
    final newObs = rawList.map(EhsSiteObservation.fromJson).toList();
    final all = [...existing, ...newObs];
    _nextOffset = offset + newObs.length;
    emit(EhsSiteObsLoaded(
      observations: all,
      appliedStatusFilter: statusFilter,
      appliedSeverityFilter: severityFilter,
      hasMore: newObs.length == _pageLimit,
    ));
  } catch (_) {
    if (offset > 0) {
      // Load-more failed — keep existing list, just disable hasMore.
      final current = state;
      if (current is EhsSiteObsLoaded) {
        emit(current.copyWith(hasMore: false, isLoadingMore: false));
      }
      return;
    }
    // Page-0 API failure — if cache was already emitted, stay silent.
    final current = state;
    if (current is EhsSiteObsLoaded && current.fromCache) return;
    // Nothing was cached — show error.
    emit(EhsSiteObsError(
        'Failed to load EHS observations. No cached data available.'));
  }
}
```

### EhsIncidentBloc — cache-first with SharedPreferences

- [ ] **Step 2: Make EhsIncidentBloc._fetch() cache-first**

The existing `_fetch()` in `ehs_incident_bloc.dart` tries API first, then falls back to SharedPreferences cache on failure. Change it to serve the cache immediately, then update.

Replace the entire `_fetch()` method:

```dart
Future<void> _fetch(int projectId, Emitter<EhsIncidentState> emit) async {
  // ── Serve SharedPreferences cache immediately ────────────────────────────
  final prefs = await SharedPreferences.getInstance();
  final cached =
      prefs.getString(BackgroundDownloadService.ehsIncidentsKey(projectId));
  if (cached != null) {
    try {
      final list = jsonDecode(cached) as List<dynamic>;
      final incidents = list
          .map((e) => EhsIncident.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(EhsIncidentLoaded(incidents, fromCache: true));
      // Fall through to refresh from server.
    } catch (_) {
      // Corrupted cache — ignore, proceed to API.
    }
  }

  // ── Attempt live API fetch ───────────────────────────────────────────────
  try {
    final raw = await _api.getEhsIncidents(projectId);
    final incidents =
        raw.map((e) => EhsIncident.fromJson(e as Map<String, dynamic>)).toList();
    await prefs.setString(
        BackgroundDownloadService.ehsIncidentsKey(projectId), jsonEncode(raw));
    emit(EhsIncidentLoaded(incidents));
  } catch (_) {
    // API failed — if cache was already emitted, stay silent.
    final current = state;
    if (current is EhsIncidentLoaded && current.fromCache) return;
    emit(const EhsIncidentError(
        'No connection and no cached data. Connect to load incidents.'));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add flutter/lib/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart \
        flutter/lib/features/ehs/presentation/bloc/ehs_incident_bloc.dart
git commit -m "feat(ehs): make EHS BLoCs cache-first — serve cached data instantly, refresh in background"
```

---

## Task 7: Flutter — Photo Upload Queue

**Files:**
- Modify: `flutter/lib/core/sync/sync_service.dart`

Photos are currently saved as local filesystem paths in `photoPaths` (JSON array). They must be uploaded to `POST /api/files/upload` and the local path replaced with the returned server URL.

- [ ] **Step 1: Add photo upload to _processSyncQueue dispatch**

In `sync_service.dart`, find the `_processSyncQueue()` switch statement (around line 478). Add a `'photo'` case:

```dart
case 'photo':
  await _uploadPhoto(item);
  break;
```

- [ ] **Step 2: Add _uploadPhoto() method**

Add this method to `SyncService`:

```dart
/// Upload a single photo from local storage to the server.
///
/// The [SyncQueue] row payload must have:
///   - `localPath`: absolute path to the file on device
///   - `entryType`: 'progress' | 'quality'
///   - `entryLocalId`: local DB id of the parent entry
///
/// On success: the parent entry's photoPaths JSON array is updated to
/// replace [localPath] with the returned server URL.
/// On failure: retryCount is incremented; after 3 failures the queue item
/// is marked as a permanent error.
Future<void> _uploadPhoto(SyncQueueData item) async {
  final payload = jsonDecode(item.payload) as Map<String, dynamic>;
  final localPath = payload['localPath'] as String?;
  final entryType = payload['entryType'] as String?;
  final entryLocalId = payload['entryLocalId'] as int?;

  if (localPath == null || entryType == null || entryLocalId == null) {
    await _markQueueItemAsError(item.id, 'Invalid photo payload');
    return;
  }

  final file = File(localPath);
  if (!file.existsSync()) {
    // File was deleted — remove from queue silently.
    await (_database.delete(_database.syncQueue)
          ..where((t) => t.id.equals(item.id)))
        .go();
    return;
  }

  try {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        localPath,
        filename: localPath.split('/').last,
      ),
    });
    final response = await _apiClient.uploadFile(formData);
    final serverUrl = response['url'] as String;

    // Replace the local path with the server URL in the parent entry.
    if (entryType == 'progress') {
      final entries = await (_database.select(_database.progressEntries)
            ..where((t) => t.id.equals(entryLocalId)))
          .get();
      if (entries.isNotEmpty) {
        final entry = entries.first;
        final paths = entry.photoPaths != null
            ? (jsonDecode(entry.photoPaths!) as List<dynamic>).cast<String>()
            : <String>[];
        final updated = paths
            .map((p) => p == localPath ? serverUrl : p)
            .toList();
        await (_database.update(_database.progressEntries)
              ..where((t) => t.id.equals(entryLocalId)))
            .write(ProgressEntriesCompanion(
          photoPaths: Value(jsonEncode(updated)),
        ));
      }
    }

    // Remove from queue on success.
    await (_database.delete(_database.syncQueue)
          ..where((t) => t.id.equals(item.id)))
        .go();
  } catch (e) {
    final newRetry = item.retryCount + 1;
    if (newRetry >= 3) {
      await _markQueueItemAsError(item.id, 'Photo upload failed: $e');
    } else {
      await (_database.update(_database.syncQueue)
            ..where((t) => t.id.equals(item.id)))
          .write(SyncQueueCompanion(
        retryCount: Value(newRetry),
        lastError: Value(e.toString()),
        lastAttemptAt: Value(DateTime.now()),
      ));
    }
  }
}

Future<void> _markQueueItemAsError(int id, String message) async {
  await (_database.update(_database.syncQueue)
        ..where((t) => t.id.equals(id)))
      .write(SyncQueueCompanion(
    lastError: Value(message),
    retryCount: const Value(999), // Sentinel: do not retry.
    lastAttemptAt: Value(DateTime.now()),
  ));
}
```

- [ ] **Step 3: Add uploadFile method to SetuApiClient**

Open `setu_api_client.dart`. Add:

```dart
/// POST /api/files/upload — multipart file upload.
/// Returns `{url, filename, originalname}`.
Future<Map<String, dynamic>> uploadFile(FormData formData) async {
  final response = await _dio.post(
    '/files/upload',
    data: formData,
    options: Options(
      headers: {'Content-Type': 'multipart/form-data'},
      sendTimeout: const Duration(seconds: 60), // Photos can be large.
    ),
  );
  return response.data as Map<String, dynamic>;
}
```

Add `import 'package:dio/dio.dart';` at the top if not already present (it should be).

- [ ] **Step 4: Enqueue photo uploads when saving a progress entry**

Search for where `ProgressEntries` rows are inserted locally (in `ProgressBloc` or wherever `SyncQueue` items are added for progress). After the `progressEntries.insertOne(...)` call, add photo queue items.

Find the file:
```bash
grep -r "progressEntries.insertOne\|progressEntries.into\|insertReturning.*progress" \
  flutter/lib --include="*.dart" -l
```

In that file, after inserting the progress entry, add:

```dart
// Enqueue each photo for upload.
if (photoPaths != null && photoPaths.isNotEmpty) {
  for (final localPath in photoPaths) {
    await database.into(database.syncQueue).insert(
      SyncQueueCompanion.insert(
        entityType: 'photo',
        entityId: newEntryId,       // local id returned by insert
        operation: 'upload',
        payload: jsonEncode({
          'localPath': localPath,
          'entryType': 'progress',
          'entryLocalId': newEntryId,
        }),
        priority: const Value(1),   // Lower priority than data entries
      ),
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add flutter/lib/core/sync/sync_service.dart \
        flutter/lib/core/api/setu_api_client.dart
git commit -m "feat(sync): add photo upload queue — upload local photos to /api/files/upload on sync"
```

---

## Task 8: Flutter — UI Sync Status Dots on Quality & EHS

**Files:**
- Search for Quality and EHS list item widgets to wire sync dots

- [ ] **Step 1: Find existing sync dot widget**

```bash
grep -r "LiveSyncStatusIndicator\|SyncDot\|syncStatus.*dot\|SyncStatusDot" \
  flutter/lib --include="*.dart" -l
```

Note the widget name and import path.

- [ ] **Step 2: Find Quality list item widget**

```bash
grep -r "ActivityListsLoaded\|ActivityRow\|QualityActivityCard\|quality.*ListTile\|quality.*Card" \
  flutter/lib/features/quality --include="*.dart" -l
```

Open the Quality list page file. In each list item build method, wrap the trailing with the sync status dot. Look for where `SyncQueue` items of type `quality_rfi` exist for this activity. Example pattern to add:

```dart
// In the list item for a quality activity/inspection:
trailing: BlocBuilder<SyncService, ...>(
  builder: (context, _) => FutureBuilder<SyncStatus?>(
    future: _getSyncStatusForItem(item.id),
    builder: (context, snap) => _SyncDot(status: snap.data),
  ),
),
```

Use the exact widget already used in the Progress module list items.

- [ ] **Step 3: Find EHS list item widget**

```bash
grep -r "EhsSiteObsLoaded\|EhsObsCard\|ehs.*ListTile\|ehs.*Card" \
  flutter/lib/features/ehs --include="*.dart" -l
```

Apply the same sync dot pattern to EHS observation list items.

- [ ] **Step 4: Commit**

```bash
git add flutter/lib/features/quality/ flutter/lib/features/ehs/
git commit -m "feat(ui): add sync status dots to Quality and EHS list items"
```

---

## Final Verification

After all 8 tasks are complete, test these scenarios manually:

**Scenario 1: Online → Offline → Online**
1. Open app online, navigate to Progress/Quality/EHS — verify data loads
2. Turn off WiFi/data on device
3. Create a new progress entry — verify "Saved offline" toast appears and entry shows amber dot
4. Navigate to Quality — verify cached data shows immediately with amber offline banner
5. Turn WiFi back on — verify sync triggers automatically, dots turn green

**Scenario 2: Start offline from cold launch**
1. Turn off device network
2. Kill and reopen app
3. Navigate to all 3 modules — data should show from Drift cache
4. Turn network on — verify delta sync runs and data refreshes

**Scenario 3: Photo upload**
1. Online: create a progress entry with 1 photo — verify photo dot turns green after sync
2. Offline: create a progress entry with 1 photo — verify amber dot, then green after reconnect
3. Check server: verify `GET /api/files/upload` folder has the photo

**Scenario 4: EHS permit guard**
1. Turn off network
2. Navigate to EHS → try to create a new permit
3. Verify error message: "Permit creation requires an active connection for authorization."
