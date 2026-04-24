import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_view_mode.dart';
import 'package:setu_mobile/features/tower_lens/data/repositories/tower_progress_repository.dart';
import 'package:setu_mobile/features/tower_lens/presentation/bloc/tower_lens_bloc.dart';

import '../../../helpers/mocks.mocks.dart';

void main() {
  late MockTowerProgressRepository mockRepo;

  setUp(() {
    mockRepo = MockTowerProgressRepository();
  });

  TowerLensBloc buildBloc() => TowerLensBloc(repository: mockRepo);

  // Minimal fake tower for seeding loaded state in mode-change tests.
  const fakeTower = TowerRenderModel(
    epsNodeId: 1,
    towerName: 'Tower A',
    floors: [],
    overallProgress: 50.0,
    activeMode: TowerViewMode.progress,
  );

  // ── 1. Initial state ────────────────────────────────────────────────────────

  test('initial state is TowerLensInitial', () {
    final bloc = buildBloc();
    addTearDown(bloc.close);
    expect(bloc.state, isA<TowerLensInitial>());
  });

  // ── 2. LoadTowerLens → [TowerLensLoading, TowerLensLoaded] on success ────────

  blocTest<TowerLensBloc, TowerLensState>(
    'LoadTowerLens emits [TowerLensLoading, TowerLensLoaded] when repository succeeds',
    build: () {
      when(mockRepo.buildForProject(any)).thenAnswer((_) async =>
          const TowerProgressResult(models: [fakeTower], isFromCache: false));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadTowerLens(10)),
    expect: () => [
      isA<TowerLensLoading>(),
      isA<TowerLensLoaded>(),
    ],
    verify: (bloc) {
      final loaded = bloc.state as TowerLensLoaded;
      expect(loaded.towers.length, 1);
      expect(loaded.towers.first.towerName, 'Tower A');
      expect(loaded.isFromCache, false);
    },
  );

  // ── 3. LoadTowerLens → [TowerLensLoading, TowerLensError] when repo throws ──

  blocTest<TowerLensBloc, TowerLensState>(
    'LoadTowerLens emits [TowerLensLoading, TowerLensError] when repository throws',
    build: () {
      when(mockRepo.buildForProject(any))
          .thenThrow(Exception('API unavailable'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadTowerLens(10)),
    expect: () => [
      isA<TowerLensLoading>(),
      isA<TowerLensError>(),
    ],
  );

  // ── 4. ChangeTowerViewMode updates activeMode in loaded state ────────────────

  blocTest<TowerLensBloc, TowerLensState>(
    'ChangeTowerViewMode updates activeMode to quality in TowerLensLoaded',
    build: () => buildBloc(),
    seed: () => const TowerLensLoaded(
      towers: [fakeTower],
      activeMode: TowerViewMode.progress,
    ),
    act: (bloc) => bloc.add(const ChangeTowerViewMode(TowerViewMode.quality)),
    expect: () => [
      isA<TowerLensLoaded>(),
    ],
    verify: (bloc) {
      final loaded = bloc.state as TowerLensLoaded;
      expect(loaded.activeMode, TowerViewMode.quality);
    },
  );
}
