import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_incident_bloc.dart';

import '../../../helpers/mocks.mocks.dart';

void main() {
  late MockSetuApiClient mockApi;
  late MockSyncService mockSync;

  setUp(() {
    mockApi = MockSetuApiClient();
    mockSync = MockSyncService();
    // Provide an empty in-memory SharedPreferences for all tests.
    SharedPreferences.setMockInitialValues({});
  });

  EhsIncidentBloc buildBloc() =>
      EhsIncidentBloc(apiClient: mockApi, syncService: mockSync);

  // ── 1. Initial state ─────────────────────────────────────────────────────────

  test('initial state is EhsIncidentInitial', () {
    final bloc = buildBloc();
    addTearDown(bloc.close);
    expect(bloc.state, isA<EhsIncidentInitial>());
  });

  // ── 2. Load → [Loading, Loaded] on API success ───────────────────────────────
  // No cache → no intermediate emit. API returns empty list → Loaded(fromCache:false).

  blocTest<EhsIncidentBloc, EhsIncidentState>(
    'LoadEhsIncidents emits [Loading, Loaded] when API returns empty list',
    build: () {
      when(mockApi.getEhsIncidents(any)).thenAnswer((_) async => []);
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadEhsIncidents(10)),
    expect: () => [
      isA<EhsIncidentLoading>(),
      isA<EhsIncidentLoaded>(),
    ],
    verify: (bloc) {
      final state = bloc.state as EhsIncidentLoaded;
      expect(state.incidents, isEmpty);
      expect(state.fromCache, isFalse);
    },
  );

  // ── 3. Load → [Loading, Error] when API throws and no cache ─────────────────

  blocTest<EhsIncidentBloc, EhsIncidentState>(
    'LoadEhsIncidents emits [Loading, Error] when API throws and cache is empty',
    build: () {
      when(mockApi.getEhsIncidents(any))
          .thenThrow(Exception('network error'));
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadEhsIncidents(10)),
    expect: () => [
      isA<EhsIncidentLoading>(),
      isA<EhsIncidentError>(),
    ],
  );
}
