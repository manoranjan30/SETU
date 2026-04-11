import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';

import '../../../helpers/mocks.mocks.dart';

void main() {
  late MockSetuApiClient mockApi;
  late MockAppDatabase mockDb;

  setUp(() {
    mockApi = MockSetuApiClient();
    mockDb = MockAppDatabase();
  });

  ProjectBloc buildBloc() => ProjectBloc(
        apiClient: mockApi,
        database: mockDb,
      );

  // ── 1. Initial state ────────────────────────────────────────────────────────

  test('initial state is ProjectInitial', () {
    expect(buildBloc().state, isA<ProjectInitial>());
  });

  // ── 2. LoadProjects → success: API returns data, ProjectsLoaded emitted ─────

  blocTest<ProjectBloc, ProjectState>(
    'LoadProjects emits [ProjectLoading, ProjectsLoaded] when API returns projects',
    build: () {
      // Return a flat list with one PROJECT node (and a child so the tree builds)
      when(mockApi.getMyProjects()).thenAnswer((_) async => [
            {
              'id': 10,
              'name': 'Purva Bliss',
              'code': 'PB-001',
              'type': 'PROJECT',
              'status': 'ACTIVE',
              'progress': 45.5,
              'parentId': null,
            }
          ]);
      // batch() returns a void Future — SmartFake handles this correctly.
      return buildBloc();
    },
    act: (bloc) => bloc.add(LoadProjects()),
    expect: () => [
      isA<ProjectLoading>(),
      isA<ProjectsLoaded>(),
    ],
    verify: (bloc) {
      final loaded = bloc.state as ProjectsLoaded;
      expect(loaded.projects.length, 1);
      expect(loaded.projects.first.id, 10);
      expect(loaded.projects.first.name, 'Purva Bliss');
    },
  );

  // ── 3. LoadProjects → ProjectError when API throws and cache is unavailable ──
  //
  // When API throws, the bloc tries to load from Drift cache.
  // If the cache query also fails (SmartFake has no real SQLite backend),
  // the bloc catches the secondary exception and emits ProjectError.

  blocTest<ProjectBloc, ProjectState>(
    'LoadProjects emits [ProjectLoading, ProjectError] when API throws and Drift cache is inaccessible',
    build: () {
      when(mockApi.getMyProjects()).thenThrow(Exception('no network'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(LoadProjects()),
    expect: () => [
      isA<ProjectLoading>(),
      isA<ProjectError>(),
    ],
  );
}
