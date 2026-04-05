# Offline-First + Delta Sync — Design Spec
**Date:** 2026-04-05  
**Branch:** develop  
**Modules:** Progress, Quality, EHS  
**Approach:** Schema-First (Approach 1)

---

## Context

The SETU Flutter app already has a strong offline-first foundation:
- Drift/SQLite with 11 tables, schema v5
- SyncService with FIFO queue, exponential backoff, retry logic
- ConnectivitySyncService: auto-sync on reconnect, 5-min periodic retry
- WorkManager background sync (6-hour target, WiFi-triggered)
- SyncQueue (offline action queue) with priority-based dispatch
- OfflineBanner, OfflineChip, SyncLogPage UI components
- Progress module: fully offline-first

**Real gaps being closed by this spec:**
1. No delta sync — full-fetch only (no `since=` endpoints on backend)
2. Quality BLoC reads from API directly (cache tables exist but unused)
3. EHS BLoC is fully API-driven (no offline fallback)
4. Photos stored locally but never uploaded to server
5. No conflict resolution strategy
6. No sync status dots on Quality/EHS list items
7. No soft-delete flag; no `server_updated_at` / `local_updated_at` columns

---

## Sync Timing Decision

- **Background (WorkManager):** Keep existing 6-hour interval — only fires when app is closed
- **Foreground (online):** Keep existing 5-minute periodic retry — covers all active usage
- **On reconnect:** Immediate sync trigger already implemented
- **Rationale:** Workers use the app actively on-site; 5-minute retry covers all real-world cases. 6-hour background covers the closed-app scenario.

---

## Section 1: Database Schema — Migration v6

### New columns on `ProgressEntries` and `DailyLogs`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `server_updated_at` | DATETIME | null | Server's last-modified timestamp — used for conflict detection |
| `local_updated_at` | DATETIME | now | Client's last-modified timestamp — set on every local edit |
| `is_deleted` | INTEGER | 0 | Soft-delete flag — marks row deleted without removing it |

### Migration strategy
- Schema version bumps: `5 → 6`
- Migration block: `if (from < 6) { ALTER TABLE ... ADD COLUMN ... }`
- All 3 columns added to both `progress_entries` and `daily_logs`
- Idempotent — safe to re-run

### New SharedPreferences keys (delta sync cursors)

| Key | Type | Purpose |
|-----|------|---------|
| `last_delta_sync_progress_at` | String (ISO 8601) | Cursor for progress delta sync |
| `last_delta_sync_quality_at` | String (ISO 8601) | Cursor for quality delta sync |
| `last_delta_sync_ehs_at` | String (ISO 8601) | Cursor for EHS delta sync |

Null = never synced → first call fetches all records (bootstraps the delta).

---

## Section 2: Backend Delta Sync Endpoints (NestJS)

### New module: `src/sync/`

Files:
```
src/sync/
├── sync.module.ts
├── sync.controller.ts
└── sync.service.ts
```

Registered in `app.module.ts` imports array — no existing module touched.

### Endpoints

```
GET /api/sync/progress?since=<ISO_8601>&projectId=<uuid>
GET /api/sync/quality?since=<ISO_8601>&projectId=<uuid>
GET /api/sync/ehs?since=<ISO_8601>&projectId=<uuid>
```

**Auth:** Existing `JwtAuthGuard` applied to all 3 — no new auth logic.

**Query logic:**
```sql
-- progress
SELECT * FROM progress_entries
WHERE project_id = :projectId
  AND updated_at > :since
ORDER BY updated_at ASC

-- quality (activity lists + activities + site obs)
SELECT * FROM quality_activity_lists WHERE project_id = :projectId AND updated_at > :since
SELECT * FROM quality_activities WHERE project_id = :projectId AND updated_at > :since
SELECT * FROM quality_site_observations WHERE project_id = :projectId AND updated_at > :since

-- ehs
SELECT * FROM ehs_site_observations WHERE project_id = :projectId AND updated_at > :since
SELECT * FROM ehs_incidents WHERE project_id = :projectId AND updated_at > :since
```

**Response shape (all 3 endpoints):**
```json
{
  "synced_at": "2026-04-05T10:00:00.000Z",
  "count": 12,
  "data": [ ...records... ]
}
```

Returns empty `data: []` if nothing changed — client still updates cursor.

**Backend entity `updatedAt` column:** All target entities already have `@UpdateDateColumn() updatedAt` via TypeORM — confirmed across 109 files. Delta sync queries will work immediately against existing schema.

**No existing controllers/services are modified.**

---

## Section 3: Flutter Delta Sync Logic

### New method: `SyncService._deltaSync()`

Called from inside the existing `syncAll()` method, after the existing push sync completes.

```
_deltaSync():
  1. Read last_delta_sync_*_at cursors from SharedPreferences
  2. For each module (progress, quality, ehs):
     a. Call GET /api/sync/{module}?since=cursor&projectId=projectId
     b. For each returned record:
        - Find matching local row by serverId
        - IF local sync_status == 'pending' → SKIP (user's unsaved changes win)
        - IF server record is reference data (activity lists, templates) → upsert (server wins)
        - IF server record is field entry (progress %, inspection result, observation) → upsert only if server_updated_at > local local_updated_at
        - IF conflict (both modified) → keep user version, set sync_status = 'conflict', flag for supervisor review
     c. On success: update last_delta_sync_*_at = response.synced_at
  3. Emit SyncStatusInfo update
```

### Conflict resolution rules

| Data type | Rule | Rationale |
|-----------|------|-----------|
| Reference data (project details, activity templates, task definitions) | **Server wins** — always upsert | Read-only for field workers; server is authoritative |
| Field entries (progress %, inspection results, EHS observations) | **User wins** — keep local if `local_updated_at > server_updated_at` | Field worker's direct measurement is ground truth |
| Both modified simultaneously | Keep user version, set `sync_status = 'conflict'`, log for supervisor | Never silently discard field data |

### `local_updated_at` write rule

Set `local_updated_at = DateTime.now()` on every local create or update — in the Drift companion before inserting/updating.

---

## Section 4: Quality & EHS BLoC Offline Reads

### Quality BLoC refactor

**Current:** `LoadQualityData` event → calls API directly.

**New:**
```
LoadQualityData:
  1. Emit loading state
  2. Read from CachedQualityActivityLists + CachedQualityActivities (Drift)
  3. If cache non-empty → emit loaded state (offline-first, instant)
  4. If online → refresh cache from server in background, re-emit
  5. If cache empty AND offline → emit error: "Template not available offline. Please sync while connected."
```

Mutations (raise RFI, mark inspection, log observation):
- Save to SyncQueue with appropriate entityType — already implemented
- Local optimistic update — already implemented

### EHS BLoC refactor

**Current:** `LoadEhsData` event → calls API only.

**New:**
```
LoadEhsData:
  1. Read from CachedEhsSiteObs (Drift)
  2. If cache non-empty → emit loaded state
  3. If online → refresh cache, re-emit
  4. If cache empty AND offline → emit error with offline message
```

**Permit-to-work guard:**
```
CreatePermit event:
  IF NOT isOnline:
    emit error: "Permit creation requires an active connection for authorization."
    return
  ELSE:
    proceed normally
```

---

## Section 5: Photo Upload Queue

### Problem
Photos are compressed and stored locally. The `photoPaths` column holds local filesystem paths. These paths are sent to the server during sync — but the server cannot access local device paths. Photos never reach the server.

### Fix

**On entry save** (Progress or Quality):
- For each photo in the entry, add a row to `SyncQueue`:
  ```
  entityType: 'photo'
  entityId: <entry local id>
  operation: 'upload'
  payload: { localPath: '/path/to/photo.jpg', entryType: 'progress'|'quality', entryId: '...' }
  ```

**In `_processSyncQueue()` dispatch:**
- Add `'photo'` case → call multipart POST to existing photo upload endpoint
- On success: replace local path with returned server URL in parent entry's `photoPaths`
- Upload endpoint: `POST /api/files/upload` (multipart, field name `file`) — returns `{ url, filename }`
- On success: replace local path with returned `url` in parent entry's `photoPaths`
- On failure: increment retryCount, retry up to 3 times with exponential backoff (2s, 4s, 8s)
- After 3 failures: set SyncQueue entry to error state → show red dot on parent entry

**Photo items processed after** their parent entry is synced (priority ordering).

---

## Section 6: UI Sync Status Dots — Quality & EHS

### Existing pattern (Progress)
`LiveSyncStatusIndicator` widget is already used on Progress list items. It reads `syncStatus` from the entry and shows colored dots.

### New: apply same pattern to Quality & EHS

For each Quality and EHS list item card, wrap with the existing `LiveSyncStatusIndicator` (or equivalent small dot widget):

| Dot color | Meaning |
|-----------|---------|
| Green | `synced` — confirmed on server |
| Amber | `pending` — saved locally, waiting for sync |
| Gray | `syncing` — upload in progress |
| Red | `error` / `failed` — tap to retry |

**No new widget needed** — reuse existing component. Wire to `sync_status` field in the relevant SyncQueue item or cached entry.

---

## Implementation Order (Schema-First)

1. **DB migration v6** — add 3 columns, update Drift schema
2. **Backend SyncModule** — 3 new GET endpoints, no existing changes
3. **Flutter delta sync** — `_deltaSync()` in SyncService + SharedPreferences cursors
4. **Quality BLoC offline reads** — read from cache first
5. **EHS BLoC offline reads** — read from cache first + permit guard
6. **Photo upload queue** — SyncQueue 'photo' dispatch
7. **UI sync dots** — Quality & EHS list items

Each step is independently testable before moving to the next.

---

## Constraints Honoured

- No existing navigation or screen structure broken
- All new services injectable/mockable (GetIt pattern maintained)
- SQLite schema migrations versioned (v6 block added to existing array)
- All sync operations on background thread (SyncService already runs off-main)
- Works on both iOS and Android
- Backend: only new routes added — zero existing routes modified
