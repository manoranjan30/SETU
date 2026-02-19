import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/auth_service.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';

// ==================== EVENTS ====================

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

/// Check if user is already authenticated
class CheckAuthStatus extends AuthEvent {}

/// Login with username and password
class Login extends AuthEvent {
  final String username;
  final String password;

  const Login({
    required this.username,
    required this.password,
  });

  @override
  List<Object?> get props => [username, password];
}

/// Logout current user
class Logout extends AuthEvent {}

/// Refresh user profile
class RefreshProfile extends AuthEvent {}

// ==================== STATES ====================

abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

/// Initial state - checking auth status
class AuthInitial extends AuthState {}

/// Loading state - during login/check
class AuthLoading extends AuthState {}

/// Authenticated state - user is logged in
class AuthAuthenticated extends AuthState {
  final User user;

  const AuthAuthenticated(this.user);

  @override
  List<Object?> get props => [user];
}

/// Unauthenticated state - user needs to login
class AuthUnauthenticated extends AuthState {
  final String? message;

  const AuthUnauthenticated({this.message});

  @override
  List<Object?> get props => [message];
}

/// Error state - login failed
class AuthError extends AuthState {
  final String message;

  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthService _authService;

  AuthBloc({required AuthService authService})
      : _authService = authService,
        super(AuthInitial()) {
    on<CheckAuthStatus>(_onCheckAuthStatus);
    on<Login>(_onLogin);
    on<Logout>(_onLogout);
    on<RefreshProfile>(_onRefreshProfile);
  }

  /// Check if user is already authenticated
  Future<void> _onCheckAuthStatus(
    CheckAuthStatus event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());

    try {
      final isLoggedIn = await _authService.isLoggedIn();
      if (isLoggedIn) {
        final user = await _authService.getProfile();
        emit(AuthAuthenticated(user));
      } else {
        emit(const AuthUnauthenticated());
      }
    } catch (e) {
      emit(const AuthUnauthenticated());
    }
  }

  /// Handle login
  Future<void> _onLogin(
    Login event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());

    try {
      final user = await _authService.login(
        username: event.username,
        password: event.password,
      );
      emit(AuthAuthenticated(user));
    } catch (e) {
      emit(AuthError(e.toString()));
    }
  }

  /// Handle logout
  Future<void> _onLogout(
    Logout event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());

    try {
      await _authService.logout();
      emit(const AuthUnauthenticated());
    } catch (e) {
      // Even if logout fails, clear local state
      emit(const AuthUnauthenticated());
    }
  }

  /// Refresh user profile
  Future<void> _onRefreshProfile(
    RefreshProfile event,
    Emitter<AuthState> emit,
  ) async {
    try {
      final user = await _authService.getProfile();
      emit(AuthAuthenticated(user));
    } catch (e) {
      // If refresh fails, keep current state
    }
  }
}
