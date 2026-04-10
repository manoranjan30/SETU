import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/labor/data/models/labor_models.dart';
import 'package:setu_mobile/features/labor/presentation/bloc/labor_bloc.dart';

import '../../../helpers/mocks.mocks.dart';
import '../../../helpers/test_fixtures.dart';

void main() {
  late MockSetuApiClient mockApi;

  setUp(() {
    mockApi = MockSetuApiClient();
  });

  LaborBloc buildBloc() => LaborBloc(apiClient: mockApi);

  // Reusable fake entry with count=5 (used for seeding and verification).
  const fakeEntry = DailyLaborEntry(
    categoryId: 1,
    categoryName: 'Masons',
    count: 5,
  );

  // A loaded state seeded with one entry for save tests.
  const seededLoadedState = LaborLoaded(
    entries: [fakeEntry],
    totalWorkers: 5,
  );

  // ── 1. Initial state ────────────────────────────────────────────────────────

  test('initial state is LaborInitial', () {
    expect(buildBloc().state, isA<LaborInitial>());
  });

  // ── 2. LoadLaborPresence → API success (merged entries) ─────────────────────

  blocTest<LaborBloc, LaborState>(
    'LoadLaborPresence emits [LaborLoading, LaborLoaded] with merged entries on success',
    build: () {
      when(mockApi.getLaborCategories(projectId: anyNamed('projectId')))
          .thenAnswer((_) async => [fakeLaborCategoryJson]);
      when(mockApi.getLaborPresence(
        projectId: anyNamed('projectId'),
        date: anyNamed('date'),
      )).thenAnswer((_) async => []);
      return buildBloc();
    },
    act: (bloc) =>
        bloc.add(const LoadLaborPresence(projectId: 10, date: '2026-04-08')),
    expect: () => [
      isA<LaborLoading>(),
      isA<LaborLoaded>(),
    ],
    verify: (bloc) {
      final loaded = bloc.state as LaborLoaded;
      // One entry per category.
      expect(loaded.entries.length, 1);
      expect(loaded.entries.first.categoryId, 1);
    },
  );

  // ── 3. LoadLaborPresence → totalWorkers calculated from entries ──────────────

  blocTest<LaborBloc, LaborState>(
    'LoadLaborPresence sets totalWorkers to sum of entry counts',
    build: () {
      when(mockApi.getLaborCategories(projectId: anyNamed('projectId')))
          .thenAnswer((_) async => [fakeLaborCategoryJson]);
      // Return an existing presence record with count=5 for the category.
      when(mockApi.getLaborPresence(
        projectId: anyNamed('projectId'),
        date: anyNamed('date'),
      )).thenAnswer((_) async => [
            {
              'categoryId': 1,
              'count': 5,
              'category': {'name': 'Masons'},
            }
          ]);
      return buildBloc();
    },
    act: (bloc) =>
        bloc.add(const LoadLaborPresence(projectId: 10, date: '2026-04-08')),
    expect: () => [
      isA<LaborLoading>(),
      isA<LaborLoaded>(),
    ],
    verify: (bloc) {
      expect((bloc.state as LaborLoaded).totalWorkers, 5);
    },
  );

  // ── 4. LoadLaborPresence → API throws → LaborError ──────────────────────────

  blocTest<LaborBloc, LaborState>(
    'LoadLaborPresence emits [LaborLoading, LaborError] when API throws',
    build: () {
      when(mockApi.getLaborCategories(projectId: anyNamed('projectId')))
          .thenThrow(Exception('network error'));
      return buildBloc();
    },
    act: (bloc) =>
        bloc.add(const LoadLaborPresence(projectId: 10, date: '2026-04-08')),
    expect: () => [
      isA<LaborLoading>(),
      isA<LaborError>(),
    ],
  );

  // ── 5. UpdateLaborEntry does nothing when state is not LaborLoaded ───────────

  blocTest<LaborBloc, LaborState>(
    'UpdateLaborEntry emits nothing when state is not LaborLoaded',
    build: () => buildBloc(),
    // Default state is LaborInitial — not LaborLoaded.
    act: (bloc) => bloc.add(
        const UpdateLaborEntry(categoryId: 1, count: 3)),
    expect: () => [],
  );

  // ── 6. SaveLaborPresence → success → LaborSaveSuccess(1) ────────────────────

  blocTest<LaborBloc, LaborState>(
    'SaveLaborPresence emits [LaborSaving, LaborSaveSuccess(1)] when save succeeds',
    build: () {
      when(mockApi.saveLaborPresence(
        projectId: anyNamed('projectId'),
        entries: anyNamed('entries'),
      )).thenAnswer((_) async => []);
      return buildBloc();
    },
    seed: () => seededLoadedState,
    act: (bloc) =>
        bloc.add(const SaveLaborPresence(projectId: 10, date: '2026-04-08')),
    expect: () => [
      isA<LaborSaving>(),
      isA<LaborSaveSuccess>(),
    ],
    verify: (bloc) {
      expect((bloc.state as LaborSaveSuccess).savedCount, 1);
    },
  );

  // ── 7. SaveLaborPresence → all zero counts → LaborSaveError (no LaborSaving) ─

  blocTest<LaborBloc, LaborState>(
    'SaveLaborPresence emits [LaborSaveError] when all entries have count=0',
    build: () => buildBloc(),
    seed: () => const LaborLoaded(
      entries: [
        DailyLaborEntry(categoryId: 1, categoryName: 'Masons', count: 0),
      ],
      totalWorkers: 0,
    ),
    act: (bloc) =>
        bloc.add(const SaveLaborPresence(projectId: 10, date: '2026-04-08')),
    expect: () => [
      isA<LaborSaveError>(),
    ],
  );

  // ── 8. SaveLaborPresence → API throws → LaborSaveError ──────────────────────

  blocTest<LaborBloc, LaborState>(
    'SaveLaborPresence emits [LaborSaving, LaborSaveError] when API throws',
    build: () {
      when(mockApi.saveLaborPresence(
        projectId: anyNamed('projectId'),
        entries: anyNamed('entries'),
      )).thenThrow(Exception('server error'));
      return buildBloc();
    },
    seed: () => seededLoadedState,
    act: (bloc) =>
        bloc.add(const SaveLaborPresence(projectId: 10, date: '2026-04-08')),
    expect: () => [
      isA<LaborSaving>(),
      isA<LaborSaveError>(),
    ],
  );
}
