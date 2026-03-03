import 'dart:convert';
import 'dart:typed_data';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';

// ==================== EVENTS ====================

abstract class ProfileEvent extends Equatable {
  const ProfileEvent();
  @override
  List<Object?> get props => [];
}

class LoadProfile extends ProfileEvent {
  const LoadProfile();
}

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

class SaveSignature extends ProfileEvent {
  final Uint8List pngBytes;
  const SaveSignature(this.pngBytes);
  @override
  List<Object?> get props => [pngBytes.length];
}

// ==================== STATES ====================

abstract class ProfileState extends Equatable {
  const ProfileState();
  @override
  List<Object?> get props => [];
}

class ProfileInitial extends ProfileState {}

class ProfileLoading extends ProfileState {}

class ProfileLoaded extends ProfileState {
  final User user;
  final String? signatureBase64; // null = no signature saved yet

  const ProfileLoaded({required this.user, this.signatureBase64});

  @override
  List<Object?> get props => [user, signatureBase64];
}

class ProfileSaving extends ProfileState {
  final User user;
  final String? signatureBase64;

  const ProfileSaving({required this.user, this.signatureBase64});

  @override
  List<Object?> get props => [user, signatureBase64];
}

class ProfileSaveSuccess extends ProfileState {
  final String message;
  const ProfileSaveSuccess(this.message);
  @override
  List<Object?> get props => [message];
}

class ProfileError extends ProfileState {
  final String message;
  const ProfileError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final SetuApiClient _apiClient;

  User? _cachedUser;
  String? _cachedSignature;

  ProfileBloc({required SetuApiClient apiClient})
      : _apiClient = apiClient,
        super(ProfileInitial()) {
    on<LoadProfile>(_onLoadProfile);
    on<UpdateProfile>(_onUpdateProfile);
    on<SaveSignature>(_onSaveSignature);
  }

  Future<void> _onLoadProfile(
      LoadProfile event, Emitter<ProfileState> emit) async {
    emit(ProfileLoading());
    try {
      final results = await Future.wait([
        _apiClient.getUserProfile(),
        _apiClient
            .getUserSignature()
            .catchError((_) => <String, dynamic>{}),
      ]);

      final userJson = results[0];
      final sigJson = results[1];

      _cachedUser = User.fromJson(userJson);
      _cachedSignature = sigJson['data'] as String? ??
          sigJson['signature'] as String? ??
          sigJson['signatureData'] as String?;

      emit(ProfileLoaded(
        user: _cachedUser!,
        signatureBase64: _cachedSignature,
      ));
    } catch (e) {
      emit(ProfileError(_friendly(e)));
    }
  }

  Future<void> _onUpdateProfile(
      UpdateProfile event, Emitter<ProfileState> emit) async {
    if (_cachedUser == null) return;
    emit(ProfileSaving(user: _cachedUser!, signatureBase64: _cachedSignature));
    try {
      final updated = await _apiClient.updateUserProfile(
        displayName: event.fullName,
        email: event.email,
        phone: event.phone,
        designation: event.designation,
      );
      _cachedUser = User.fromJson(updated);
      emit(const ProfileSaveSuccess('Profile updated successfully'));
    } catch (e) {
      emit(ProfileError(_friendly(e)));
    }
  }

  Future<void> _onSaveSignature(
      SaveSignature event, Emitter<ProfileState> emit) async {
    if (_cachedUser == null) return;
    emit(ProfileSaving(user: _cachedUser!, signatureBase64: _cachedSignature));
    try {
      final base64Data = base64Encode(event.pngBytes);
      await _apiClient.updateUserSignature(base64Data);
      _cachedSignature = base64Data;
      emit(const ProfileSaveSuccess('Signature saved successfully'));
    } catch (e) {
      emit(ProfileError(_friendly(e)));
    }
  }

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
