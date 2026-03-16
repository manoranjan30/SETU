import 'dart:convert';
import 'dart:typed_data';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';

// ==================== EVENTS ====================

/// Base class for all profile management events.
abstract class ProfileEvent extends Equatable {
  const ProfileEvent();
  @override
  List<Object?> get props => [];
}

/// Trigger a fresh load of the authenticated user's profile and signature.
///
/// Dispatched when the profile screen mounts and on explicit pull-to-refresh.
class LoadProfile extends ProfileEvent {
  const LoadProfile();
}

/// Submit edited profile fields to the server.
///
/// All four fields are required because the API replaces the full profile
/// object — partial update is not supported by the backend endpoint.
class UpdateProfile extends ProfileEvent {
  final String fullName;
  final String email;
  final String phone;
  final String designation;

  const UpdateProfile({
    required this.fullName,
    required this.email,
    required this.phone,
    required this.designation,
  });

  @override
  List<Object?> get props => [fullName, email, phone, designation];
}

/// Save a new handwritten signature captured from the signature pad.
///
/// [pngBytes] is the raw PNG output from the drawing canvas widget.
/// The BLoC base64-encodes it before sending to the API so the image
/// travels as a JSON string rather than a multipart upload.
class SaveSignature extends ProfileEvent {
  final Uint8List pngBytes;
  const SaveSignature(this.pngBytes);
  @override
  // Equality is based on byte length only — comparing full byte arrays
  // in props would be expensive and rarely necessary for state deduplication.
  List<Object?> get props => [pngBytes.length];
}

// ==================== STATES ====================

/// Base class for all profile states.
abstract class ProfileState extends Equatable {
  const ProfileState();
  @override
  List<Object?> get props => [];
}

/// No profile data has been loaded yet (app cold start).
class ProfileInitial extends ProfileState {}

/// Full-screen loading spinner shown while profile + signature are fetched.
class ProfileLoading extends ProfileState {}

/// Profile data is available and ready for display or editing.
///
/// [signatureBase64] is the raw base64 PNG string (no data-URI prefix).
/// A null value means the user has not saved a signature yet.
class ProfileLoaded extends ProfileState {
  final User user;
  final String? signatureBase64; // null = no signature saved yet

  const ProfileLoaded({required this.user, this.signatureBase64});

  @override
  List<Object?> get props => [user, signatureBase64];
}

/// In-flight save — emitted while an update/signature API call is in progress.
///
/// Carries the current [user] and [signatureBase64] so the UI can keep
/// displaying the filled-in form (with a loading overlay) rather than
/// blanking out or reverting to a spinner.
class ProfileSaving extends ProfileState {
  final User user;
  final String? signatureBase64;

  const ProfileSaving({required this.user, this.signatureBase64});

  @override
  List<Object?> get props => [user, signatureBase64];
}

/// The last save operation completed successfully.
///
/// [message] is a human-readable confirmation shown as a snack-bar.
/// After displaying the message the UI should navigate back or re-emit
/// [LoadProfile] to refresh the displayed data.
class ProfileSaveSuccess extends ProfileState {
  final String message;
  const ProfileSaveSuccess(this.message);
  @override
  List<Object?> get props => [message];
}

/// An error occurred while loading or saving profile data.
///
/// [message] is already user-friendly (mapped via [ProfileBloc._friendly]).
class ProfileError extends ProfileState {
  final String message;
  const ProfileError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

/// Manages the authenticated user's profile and handwritten signature.
///
/// Instance variables [_cachedUser] and [_cachedSignature] hold the last
/// successfully loaded values so that [UpdateProfile] and [SaveSignature]
/// handlers can emit [ProfileSaving] (which needs current data) without
/// having to re-fetch from the server first.
class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final SetuApiClient _apiClient;

  /// Last successfully fetched user — used by update/save handlers to
  /// populate [ProfileSaving] without a redundant API round-trip.
  User? _cachedUser;

  /// Last fetched signature in raw base64 (no data-URI prefix).
  /// Kept in sync whenever a new signature is successfully saved.
  String? _cachedSignature;

  ProfileBloc({required SetuApiClient apiClient})
      : _apiClient = apiClient,
        super(ProfileInitial()) {
    on<LoadProfile>(_onLoadProfile);
    on<UpdateProfile>(_onUpdateProfile);
    on<SaveSignature>(_onSaveSignature);
  }

  /// Fetches the user profile and signature in parallel, then merges results.
  ///
  /// `Future.wait` runs both requests concurrently to minimise perceived
  /// load time. The signature fetch is wrapped in `.catchError` so a
  /// missing/404 signature does not fail the entire load — the profile
  /// is still useful without a signature, and the user can add one later.
  Future<void> _onLoadProfile(
      LoadProfile event, Emitter<ProfileState> emit) async {
    emit(ProfileLoading());
    try {
      final results = await Future.wait([
        _apiClient.getUserProfile(),
        // Signature absence is non-fatal — swallow the error and return
        // an empty map so the rest of the parsing logic can treat it
        // as "no signature yet" rather than propagating an exception.
        _apiClient
            .getUserSignature()
            .catchError((_) => <String, dynamic>{}),
      ]);

      final userJson = results[0];
      final sigJson = results[1];

      _cachedUser = User.fromJson(userJson);
      // The signature field may be keyed differently across API versions —
      // try all known field names in order of preference.
      var rawSig = sigJson['data'] as String? ??
          sigJson['signature'] as String? ??
          sigJson['signatureData'] as String?;
      // Backend may return a data-URL like "data:image/png;base64,<actual>"
      // base64Decode() only accepts the raw base64 part — strip the prefix.
      if (rawSig != null && rawSig.contains(';base64,')) {
        rawSig = rawSig.split(';base64,').last;
      }
      _cachedSignature = rawSig;

      emit(ProfileLoaded(
        user: _cachedUser!,
        signatureBase64: _cachedSignature,
      ));
    } catch (e) {
      emit(ProfileError(_friendly(e)));
    }
  }

  /// Sends updated profile fields to the server and refreshes [_cachedUser].
  ///
  /// Guards against being called before the profile is loaded ([_cachedUser]
  /// would be null). Emits [ProfileSaving] first so the UI can show an
  /// in-progress overlay while keeping the current data visible.
  /// On success, re-parses the returned JSON to pick up any server-side
  /// transformations (e.g. name normalisation).
  Future<void> _onUpdateProfile(
      UpdateProfile event, Emitter<ProfileState> emit) async {
    // Guard: update makes no sense if we haven't loaded the user yet.
    if (_cachedUser == null) return;
    // Keep current data visible during the API call — avoids a UI blank.
    emit(ProfileSaving(user: _cachedUser!, signatureBase64: _cachedSignature));
    try {
      final updated = await _apiClient.updateUserProfile(
        displayName: event.fullName,
        email: event.email,
        phone: event.phone,
        designation: event.designation,
      );
      // Re-parse from the server response so _cachedUser reflects any
      // server-side changes (e.g. trimmed whitespace, normalised casing).
      _cachedUser = User.fromJson(updated);
      emit(const ProfileSaveSuccess('Profile updated successfully'));
    } catch (e) {
      emit(ProfileError(_friendly(e)));
    }
  }

  /// Encodes the PNG bytes to base64 and persists them via the API.
  ///
  /// The signature pad widget produces raw PNG bytes; base64 encoding
  /// allows the image to be sent as a plain JSON string field rather
  /// than requiring a multipart/form-data upload endpoint.
  /// After a successful save, [_cachedSignature] is updated in-memory
  /// so subsequent [ProfileSaving] emits reflect the new signature
  /// without needing another server round-trip.
  Future<void> _onSaveSignature(
      SaveSignature event, Emitter<ProfileState> emit) async {
    // Guard: signature save requires a loaded user for ProfileSaving state.
    if (_cachedUser == null) return;
    emit(ProfileSaving(user: _cachedUser!, signatureBase64: _cachedSignature));
    try {
      // Convert raw PNG bytes to a base64 string — the API stores and
      // returns it in this format, so no data-URI wrapping is needed here.
      final base64Data = base64Encode(event.pngBytes);
      await _apiClient.updateUserSignature(base64Data);
      // Cache locally so the next ProfileSaving emit shows the new signature.
      _cachedSignature = base64Data;
      emit(const ProfileSaveSuccess('Signature saved successfully'));
    } catch (e) {
      emit(ProfileError(_friendly(e)));
    }
  }

  /// Maps raw exceptions to user-friendly error messages.
  ///
  /// Connectivity-related errors (connection refused, network unreachable,
  /// socket closed) all map to a single "no connection" message to avoid
  /// leaking technical details. 403/Forbidden gets a permissions message.
  /// All other errors get a generic retry prompt.
  String _friendly(dynamic e) {
    final s = e.toString().toLowerCase();
    if (s.contains('connection') ||
        s.contains('network') ||
        s.contains('socket')) {
      return 'No connection. Check your network and try again.';
    }
    if (s.contains('403') || s.contains('forbidden')) {
      return 'You do not have permission for this action.';
    }
    return 'Something went wrong. Please try again.';
  }
}
