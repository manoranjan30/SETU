import 'dart:convert';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';

import '../../../helpers/mocks.mocks.dart';
import '../../../helpers/test_fixtures.dart';

void main() {
  late MockSetuApiClient mockApi;
  late MockAppDatabase mockDb;
  late MockSyncService mockSync;

  setUp(() {
    mockApi = MockSetuApiClient();
    mockDb = MockAppDatabase();
    mockSync = MockSyncService();
  });

  EhsSiteObsBloc buildBloc() => EhsSiteObsBloc(
        apiClient: mockApi,
        database: mockDb,
        syncService: mockSync,
      );

  // Helper to build a real CachedEhsSiteOb row.
  CachedEhsSiteOb fakeEhsRow() => CachedEhsSiteOb(
        id: 'ehs-001',
        projectId: 10,
        status: 'OPEN',
        rawData: jsonEncode(fakeEhsObsJson),
        cachedAt: DateTime(2026, 4, 1),
      );

  // ── 1. Initial state ────────────────────────────────────────────────────────

  test('initial state is EhsSiteObsInitial', () {
    expect(buildBloc().state, isA<EhsSiteObsInitial>());
  });

  // ── 2. LoadEhsSiteObs → API success (empty cache) ───────────────────────────
  // EHS is cache-first: cache is read first, if empty falls straight through.
  // Then API succeeds → emits Loaded(fromCache:false).

  blocTest<EhsSiteObsBloc, EhsSiteObsState>(
    'LoadEhsSiteObs emits [Loading, Loaded] when API returns data (cache empty)',
    build: () {
      when(mockDb.getCachedEhsSiteObs(any, any))
          .thenAnswer((_) async => []); // cache empty — no intermediate emit
      when(mockApi.getEhsSiteObs(
        projectId: anyNamed('projectId'),
        status: anyNamed('status'),
        severity: anyNamed('severity'),
        limit: anyNamed('limit'),
        offset: anyNamed('offset'),
      )).thenAnswer((_) async => [fakeEhsObsJson]);
      when(mockDb.cacheEhsSiteObs(any, any)).thenAnswer((_) async {});
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadEhsSiteObs(projectId: 10)),
    expect: () => [
      isA<EhsSiteObsLoading>(),
      isA<EhsSiteObsLoaded>(),
    ],
    verify: (bloc) {
      expect((bloc.state as EhsSiteObsLoaded).fromCache, isFalse);
    },
  );

  // ── 3. LoadEhsSiteObs → API fails but cache has data → Loaded(fromCache:true) ─
  // Cache is served immediately (fromCache:true), then API throws.
  // Since fromCache is already true in current state, the bloc stays silent.
  // Net result: [Loading, Loaded(fromCache:true)] — no error state.

  blocTest<EhsSiteObsBloc, EhsSiteObsState>(
    'LoadEhsSiteObs emits [Loading, Loaded(fromCache:true)] when API fails and cache has data',
    build: () {
      when(mockDb.getCachedEhsSiteObs(any, any))
          .thenAnswer((_) async => [fakeEhsRow()]);
      when(mockApi.getEhsSiteObs(
        projectId: anyNamed('projectId'),
        status: anyNamed('status'),
        severity: anyNamed('severity'),
        limit: anyNamed('limit'),
        offset: anyNamed('offset'),
      )).thenThrow(Exception('network error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadEhsSiteObs(projectId: 10)),
    expect: () => [
      isA<EhsSiteObsLoading>(),
      isA<EhsSiteObsLoaded>(),
    ],
    verify: (bloc) {
      expect((bloc.state as EhsSiteObsLoaded).fromCache, isTrue);
    },
  );

  // ── 4. LoadEhsSiteObs → both fail → EhsSiteObsError ────────────────────────
  // Cache returns empty → no intermediate emit.
  // API throws → current state is NOT fromCache → emit Error.

  blocTest<EhsSiteObsBloc, EhsSiteObsState>(
    'LoadEhsSiteObs emits [Loading, Error] when both API and cache fail',
    build: () {
      when(mockDb.getCachedEhsSiteObs(any, any))
          .thenAnswer((_) async => []); // empty cache — no emit
      when(mockApi.getEhsSiteObs(
        projectId: anyNamed('projectId'),
        status: anyNamed('status'),
        severity: anyNamed('severity'),
        limit: anyNamed('limit'),
        offset: anyNamed('offset'),
      )).thenThrow(Exception('network error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadEhsSiteObs(projectId: 10)),
    expect: () => [
      isA<EhsSiteObsLoading>(),
      isA<EhsSiteObsError>(),
    ],
  );

  // ── 5. CreateEhsSiteObs → syncAll succeeds → 'created' ──────────────────────

  blocTest<EhsSiteObsBloc, EhsSiteObsState>(
    'CreateEhsSiteObs emits [ActionSuccess("created")] when online',
    build: () {
      when(mockSync.addToQueue(
        entityType: anyNamed('entityType'),
        entityId: anyNamed('entityId'),
        operation: anyNamed('operation'),
        payload: anyNamed('payload'),
        priority: anyNamed('priority'),
      )).thenAnswer((_) async {});
      when(mockSync.syncAll())
          .thenAnswer((_) async => SyncResult()..success = true);
      return buildBloc();
    },
    act: (bloc) => bloc.add(const CreateEhsSiteObs(
      projectId: 10,
      description: 'Worker without PPE',
      severity: 'HIGH',
    )),
    expect: () => [
      isA<EhsSiteObsActionSuccess>(),
    ],
    verify: (bloc) {
      expect((bloc.state as EhsSiteObsActionSuccess).action, 'created');
    },
  );

  // ── 6. CreateEhsSiteObs → syncAll fails → 'created_offline' ─────────────────

  blocTest<EhsSiteObsBloc, EhsSiteObsState>(
    'CreateEhsSiteObs emits [ActionSuccess("created_offline")] when sync fails',
    build: () {
      when(mockSync.addToQueue(
        entityType: anyNamed('entityType'),
        entityId: anyNamed('entityId'),
        operation: anyNamed('operation'),
        payload: anyNamed('payload'),
        priority: anyNamed('priority'),
      )).thenAnswer((_) async {});
      when(mockSync.syncAll())
          .thenAnswer((_) async => SyncResult()..success = false);
      return buildBloc();
    },
    act: (bloc) => bloc.add(const CreateEhsSiteObs(
      projectId: 10,
      description: 'Worker without PPE',
      severity: 'HIGH',
    )),
    expect: () => [
      isA<EhsSiteObsActionSuccess>(),
    ],
    verify: (bloc) {
      expect((bloc.state as EhsSiteObsActionSuccess).action, 'created_offline');
    },
  );
}
