import 'dart:convert';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';

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

  QualitySiteObsBloc buildBloc() => QualitySiteObsBloc(
        apiClient: mockApi,
        database: mockDb,
        syncService: mockSync,
      );

  // ── 1. Initial state ────────────────────────────────────────────────────────

  test('initial state is QualitySiteObsInitial', () {
    final bloc = buildBloc();
    addTearDown(bloc.close);
    expect(bloc.state, isA<QualitySiteObsInitial>());
  });

  // ── 2. LoadQualitySiteObs → API success ─────────────────────────────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'LoadQualitySiteObs emits [Loading, Loaded] when API returns 1 item',
    build: () {
      when(mockApi.getQualitySiteObs(
        projectId: anyNamed('projectId'),
        status: anyNamed('status'),
        severity: anyNamed('severity'),
        limit: anyNamed('limit'),
        offset: anyNamed('offset'),
      )).thenAnswer((_) async => [fakeQualityObsJson]);
      when(mockDb.cacheQualitySiteObs(any, any)).thenAnswer((_) async {});
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
    expect: () => [
      isA<QualitySiteObsLoading>(),
      isA<QualitySiteObsLoaded>(),
    ],
  );

  // ── 3. LoadQualitySiteObs → API throws, cache has data ──────────────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'LoadQualitySiteObs emits [Loading, Loaded(fromCache:true)] when API throws but cache returns data',
    build: () {
      when(mockApi.getQualitySiteObs(
        projectId: anyNamed('projectId'),
        status: anyNamed('status'),
        severity: anyNamed('severity'),
        limit: anyNamed('limit'),
        offset: anyNamed('offset'),
      )).thenThrow(Exception('network error'));
      when(mockDb.getCachedQualitySiteObs(any, any)).thenAnswer(
        (_) async => [
          CachedQualitySiteOb(
            id: 'obs-001',
            projectId: 10,
            status: 'OPEN',
            rawData: jsonEncode(fakeQualityObsJson),
            cachedAt: DateTime(2026, 4, 1),
          )
        ],
      );
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
    expect: () => [
      isA<QualitySiteObsLoading>(),
      isA<QualitySiteObsLoaded>(),
    ],
    verify: (bloc) {
      expect((bloc.state as QualitySiteObsLoaded).fromCache, isTrue);
    },
  );

  // ── 4. LoadQualitySiteObs → both API and cache throw ────────────────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'LoadQualitySiteObs emits [Loading, Error] when both API and cache throw',
    build: () {
      when(mockApi.getQualitySiteObs(
        projectId: anyNamed('projectId'),
        status: anyNamed('status'),
        severity: anyNamed('severity'),
        limit: anyNamed('limit'),
        offset: anyNamed('offset'),
      )).thenThrow(Exception('network error'));
      when(mockDb.getCachedQualitySiteObs(any, any))
          .thenThrow(Exception('cache error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
    expect: () => [
      isA<QualitySiteObsLoading>(),
      isA<QualitySiteObsError>(),
    ],
  );

  // ── 5. hasMore = true when 25 items returned ─────────────────────────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'QualitySiteObsLoaded.hasMore=true when 25 items returned',
    build: () {
      final fullPage = List.filled(25, fakeQualityObsJson);
      when(mockApi.getQualitySiteObs(
        projectId: anyNamed('projectId'),
        status: anyNamed('status'),
        severity: anyNamed('severity'),
        limit: anyNamed('limit'),
        offset: anyNamed('offset'),
      )).thenAnswer((_) async => fullPage);
      when(mockDb.cacheQualitySiteObs(any, any)).thenAnswer((_) async {});
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
    expect: () => [
      isA<QualitySiteObsLoading>(),
      isA<QualitySiteObsLoaded>(),
    ],
    verify: (bloc) {
      expect((bloc.state as QualitySiteObsLoaded).hasMore, isTrue);
    },
  );

  // ── 6. hasMore = false when <25 items returned ───────────────────────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'QualitySiteObsLoaded.hasMore=false when fewer than 25 items returned',
    build: () {
      when(mockApi.getQualitySiteObs(
        projectId: anyNamed('projectId'),
        status: anyNamed('status'),
        severity: anyNamed('severity'),
        limit: anyNamed('limit'),
        offset: anyNamed('offset'),
      )).thenAnswer((_) async => [fakeQualityObsJson]);
      when(mockDb.cacheQualitySiteObs(any, any)).thenAnswer((_) async {});
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadQualitySiteObs(projectId: 10)),
    expect: () => [
      isA<QualitySiteObsLoading>(),
      isA<QualitySiteObsLoaded>(),
    ],
    verify: (bloc) {
      expect((bloc.state as QualitySiteObsLoaded).hasMore, isFalse);
    },
  );

  // ── 7. CreateQualitySiteObs → syncAll succeeds → 'created' ──────────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'CreateQualitySiteObs emits [ActionSuccess("created")] when syncAll succeeds',
    build: () {
      when(mockSync.addToQueue(
        entityType: anyNamed('entityType'),
        entityId: anyNamed('entityId'),
        operation: anyNamed('operation'),
        payload: anyNamed('payload'),
        priority: anyNamed('priority'),
      )).thenAnswer((_) async {});
      when(mockSync.syncAll()).thenAnswer((_) async => SyncResult()..success = true);
      return buildBloc();
    },
    act: (bloc) => bloc.add(const CreateQualitySiteObs(
      projectId: 10,
      description: 'Crack in column',
      severity: 'HIGH',
    )),
    expect: () => [
      isA<QualitySiteObsActionSuccess>(),
    ],
    verify: (bloc) {
      expect((bloc.state as QualitySiteObsActionSuccess).action, 'created');
    },
  );

  // ── 8. CreateQualitySiteObs → syncAll fails → 'created_offline' ─────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'CreateQualitySiteObs emits [ActionSuccess("created_offline")] when syncAll fails',
    build: () {
      when(mockSync.addToQueue(
        entityType: anyNamed('entityType'),
        entityId: anyNamed('entityId'),
        operation: anyNamed('operation'),
        payload: anyNamed('payload'),
        priority: anyNamed('priority'),
      )).thenAnswer((_) async {});
      when(mockSync.syncAll()).thenAnswer((_) async => SyncResult()..success = false);
      return buildBloc();
    },
    act: (bloc) => bloc.add(const CreateQualitySiteObs(
      projectId: 10,
      description: 'Crack in column',
      severity: 'HIGH',
    )),
    expect: () => [
      isA<QualitySiteObsActionSuccess>(),
    ],
    verify: (bloc) {
      expect((bloc.state as QualitySiteObsActionSuccess).action, 'created_offline');
    },
  );

  // ── 9. CreateQualitySiteObs → addToQueue throws → ActionError ───────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'CreateQualitySiteObs emits [ActionError] when addToQueue throws',
    build: () {
      when(mockSync.addToQueue(
        entityType: anyNamed('entityType'),
        entityId: anyNamed('entityId'),
        operation: anyNamed('operation'),
        payload: anyNamed('payload'),
        priority: anyNamed('priority'),
      )).thenThrow(Exception('db error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const CreateQualitySiteObs(
      projectId: 10,
      description: 'Crack in column',
      severity: 'HIGH',
    )),
    expect: () => [
      isA<QualitySiteObsActionError>(),
    ],
  );

  // ── 10. DeleteQualitySiteObs → success → 'deleted' ──────────────────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'DeleteQualitySiteObs emits [ActionSuccess("deleted")] on success',
    build: () {
      when(mockApi.deleteQualitySiteObs(id: anyNamed('id')))
          .thenAnswer((_) async {});
      return buildBloc();
    },
    act: (bloc) => bloc.add(const DeleteQualitySiteObs(id: 'obs-001')),
    expect: () => [
      isA<QualitySiteObsActionSuccess>(),
    ],
    verify: (bloc) {
      expect((bloc.state as QualitySiteObsActionSuccess).action, 'deleted');
    },
  );

  // ── 11. DeleteQualitySiteObs → API throws → ActionError ──────────────────────

  blocTest<QualitySiteObsBloc, QualitySiteObsState>(
    'DeleteQualitySiteObs emits [ActionError] when API throws',
    build: () {
      when(mockApi.deleteQualitySiteObs(id: anyNamed('id')))
          .thenThrow(Exception('server error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const DeleteQualitySiteObs(id: 'obs-001')),
    expect: () => [
      isA<QualitySiteObsActionError>(),
    ],
  );
}
