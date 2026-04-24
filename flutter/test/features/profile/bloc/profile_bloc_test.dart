import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:setu_mobile/features/profile/presentation/bloc/profile_bloc.dart';

import '../../../helpers/mocks.mocks.dart';
import '../../../helpers/test_fixtures.dart';

void main() {
  late MockSetuApiClient mockApi;

  setUp(() {
    mockApi = MockSetuApiClient();
  });

  ProfileBloc buildBloc() => ProfileBloc(apiClient: mockApi);

  // ── 1. Initial state ────────────────────────────────────────────────────────

  test('initial state is ProfileInitial', () {
    final bloc = buildBloc();
    addTearDown(bloc.close);
    expect(bloc.state, isA<ProfileInitial>());
  });

  // ── 2. LoadProfile → [ProfileLoading, ProfileLoaded] on success ─────────────

  blocTest<ProfileBloc, ProfileState>(
    'LoadProfile emits [ProfileLoading, ProfileLoaded] when API returns profile',
    build: () {
      when(mockApi.getUserProfile()).thenAnswer((_) async => fakeUserJson);
      when(mockApi.getUserSignature())
          .thenAnswer((_) async => {'data': 'abc123=='});
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadProfile()),
    expect: () => [
      isA<ProfileLoading>(),
      isA<ProfileLoaded>(),
    ],
    verify: (bloc) {
      final loaded = bloc.state as ProfileLoaded;
      expect(loaded.user.id, 1);
      expect(loaded.user.email, 'test@setu.com');
      expect(loaded.signatureBase64, 'abc123==');
    },
  );

  // ── 3. LoadProfile → [ProfileLoading, ProfileError] when API throws ─────────

  blocTest<ProfileBloc, ProfileState>(
    'LoadProfile emits [ProfileLoading, ProfileError] when getUserProfile throws',
    build: () {
      when(mockApi.getUserProfile()).thenThrow(Exception('server error'));
      // signature is non-fatal via catchError, so only profile throwing matters
      return buildBloc();
    },
    act: (bloc) => bloc.add(const LoadProfile()),
    expect: () => [
      isA<ProfileLoading>(),
      isA<ProfileError>(),
    ],
  );

  // ── 4. UpdateProfile → [ProfileSaving, ProfileSaveSuccess] on success ────────
  //
  // _cachedUser is a private field set inside _onLoadProfile. We cannot seed it
  // via bloc's `seed:` parameter. Instead we dispatch LoadProfile first and await
  // the ProfileLoaded state deterministically using stream.firstWhere before
  // dispatching UpdateProfile — no timing races.

  blocTest<ProfileBloc, ProfileState>(
    'UpdateProfile emits [ProfileSaving, ProfileSaveSuccess] when API succeeds',
    build: () {
      when(mockApi.getUserProfile()).thenAnswer((_) async => fakeUserJson);
      when(mockApi.getUserSignature()).thenAnswer((_) async => <String, dynamic>{});
      when(mockApi.updateUserProfile(
        displayName: anyNamed('displayName'),
        email: anyNamed('email'),
        phone: anyNamed('phone'),
        designation: anyNamed('designation'),
      )).thenAnswer((_) async => fakeUserJson);
      return buildBloc();
    },
    act: (bloc) async {
      // Prime _cachedUser by awaiting ProfileLoaded deterministically.
      bloc.add(const LoadProfile());
      await bloc.stream.firstWhere((s) => s is ProfileLoaded);
      bloc.add(const UpdateProfile(
        fullName: 'New Name',
        email: 'new@setu.com',
        phone: '9999999999',
        designation: 'Engineer',
      ));
    },
    expect: () => [
      isA<ProfileLoading>(),
      isA<ProfileLoaded>(),
      isA<ProfileSaving>(),
      isA<ProfileSaveSuccess>(),
    ],
    verify: (bloc) {
      expect((bloc.state as ProfileSaveSuccess).message,
          'Profile updated successfully');
    },
  );

  // ── 5. UpdateProfile → [ProfileSaving, ProfileError] when API throws ─────────

  blocTest<ProfileBloc, ProfileState>(
    'UpdateProfile emits [ProfileSaving, ProfileError] when updateUserProfile throws',
    build: () {
      when(mockApi.getUserProfile()).thenAnswer((_) async => fakeUserJson);
      when(mockApi.getUserSignature()).thenAnswer((_) async => <String, dynamic>{});
      when(mockApi.updateUserProfile(
        displayName: anyNamed('displayName'),
        email: anyNamed('email'),
        phone: anyNamed('phone'),
        designation: anyNamed('designation'),
      )).thenThrow(Exception('403 forbidden'));
      return buildBloc();
    },
    act: (bloc) async {
      // Prime _cachedUser by awaiting ProfileLoaded deterministically.
      bloc.add(const LoadProfile());
      await bloc.stream.firstWhere((s) => s is ProfileLoaded);
      bloc.add(const UpdateProfile(
        fullName: 'New Name',
        email: 'new@setu.com',
        phone: '9999999999',
        designation: 'Engineer',
      ));
    },
    expect: () => [
      isA<ProfileLoading>(),
      isA<ProfileLoaded>(),
      isA<ProfileSaving>(),
      isA<ProfileError>(),
    ],
  );
}
