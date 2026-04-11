import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/progress/data/models/progress_model.dart';
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';

import '../../../helpers/mocks.mocks.dart';

void main() {
  late MockSetuApiClient mockApi;
  late MockAppDatabase mockDb;
  late MockSyncService mockSync;

  setUp(() {
    mockApi = MockSetuApiClient();
    mockDb = MockAppDatabase();
    mockSync = MockSyncService();
  });

  ProgressBloc buildBloc() => ProgressBloc(
        database: mockDb,
        syncService: mockSync,
        apiClient: mockApi,
      );

  // ── 1. Initial state ────────────────────────────────────────────────────────

  test('initial state is ProgressInitial', () {
    expect(buildBloc().state, isA<ProgressInitial>());
  });

  // ── 2. SaveProgress → success path ──────────────────────────────────────────
  //
  // NOTE: A unit test for the happy path of SaveProgress cannot be written with
  // a MockAppDatabase because _saveProgressToLocal calls
  //   _database.into(_database.progressEntries).insert(...)
  // which is a Drift-generated chain. The `into()` method returns a SmartFake
  // InsertStatement whose `insert()` method throws MissingStubError — there is
  // no public API on MockAppDatabase to stub this return value.
  //
  // The happy path (ProgressSaved) is covered by widget/integration tests that
  // use an in-memory Drift database (driftTestDatabase). A missing unit test is
  // preferable to a test that accepts ProgressError as a valid success outcome.
  //
  // The error path is fully covered by test 3 below.

  // ── 3. SaveProgress → error when DB insert throws ───────────────────────────

  blocTest<ProgressBloc, ProgressState>(
    'SaveProgress emits [ProgressLoading, ProgressError] when DB throws',
    build: () {
      // Make the database throw when into() is called on it by throwing
      // from a method that will definitely be called: progressEntries getter.
      when(mockDb.progressEntries).thenThrow(Exception('db error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(SaveProgress(
      ProgressEntry(
        projectId: 10,
        activityId: 1,
        epsNodeId: 2,
        boqItemId: 3,
        quantity: 5.0,
        date: DateTime(2026, 4, 8),
        createdAt: DateTime(2026, 4, 8),
      ),
    )),
    expect: () => [
      isA<ProgressLoading>(),
      isA<ProgressError>(),
    ],
  );

  // ── 4. LoadPendingApprovals → [Loading, PendingApprovalsLoaded] on success ──

  blocTest<ProgressBloc, ProgressState>(
    'LoadPendingApprovals emits [ProgressLoading, PendingApprovalsLoaded] when API succeeds',
    build: () {
      when(mockApi.getPendingApprovals(any)).thenAnswer((_) async => [
            {
              'id': 1,
              'projectId': 10,
              'activityId': 1,
              'epsNodeId': 2,
              'boqItemId': 3,
              'quantity': 5.0,
              'date': '2026-04-08',
              'createdAt': '2026-04-08T00:00:00.000Z',
              'status': 'PENDING',
            }
          ]);
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadPendingApprovals(10)),
    expect: () => [
      isA<ProgressLoading>(),
      isA<PendingApprovalsLoaded>(),
    ],
    verify: (bloc) {
      final loaded = bloc.state as PendingApprovalsLoaded;
      expect(loaded.logs.length, 1);
      expect(loaded.logs.first.id, 1);
    },
  );

  // ── 5. LoadPendingApprovals → [Loading, ProgressApprovalError] on API throw ─

  blocTest<ProgressBloc, ProgressState>(
    'LoadPendingApprovals emits [ProgressLoading, ProgressApprovalError] when API throws',
    build: () {
      when(mockApi.getPendingApprovals(any))
          .thenThrow(Exception('network error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadPendingApprovals(10)),
    expect: () => [
      isA<ProgressLoading>(),
      isA<ProgressApprovalError>(),
    ],
  );
}
