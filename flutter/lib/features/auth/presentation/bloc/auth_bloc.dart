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
      final errorMessage = _parseError(e);
      emit(AuthError(errorMessage));
    }
  }

  /// Parse error to user-friendly message
  String _parseError(dynamic e) {
    final errorString = e.toString().toLowerCase();

    // Connection errors
    if (errorString.contains('connectionerror') ||
        errorString.contains('connection refused') ||
        errorString.contains('connection failed')) {
      return 'Cannot connect to server. Please check:\n'
          '- Your phone is on the same WiFi network as the server\n'
          '- The server is running\n'
          '- Windows Firewall allows port 3000';
    }

    // Timeout errors
    if (errorString.contains('timeout') || errorString.contains('timed out')) {
      return 'Connection timed out. Please check your network connection.';
    }

    // Authentication errors
    if (errorString.contains('401') || errorString.contains('unauthorized')) {
      return 'Invalid username or password';
    }

    // Server errors
    if (errorString.contains('500') ||
        errorString.contains('internal server error')) {
      return 'Server error. Please try again later.';
    }

    // Network errors
    if (errorString.contains('network') || errorString.contains('socket')) {
      return 'Network error. Please check your internet connection.';
    }

    // Default: return a cleaned up version
    return 'Login failed: ${e.toString().replaceAll('Exception: ', '').replaceAll('DioException: ', '')}';
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
