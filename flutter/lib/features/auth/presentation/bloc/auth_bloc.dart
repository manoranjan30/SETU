import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/auth_service.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';

// ==================== EVENTS ====================

/// Base class for all authentication events.
/// Uses Equatable so BLoC can deduplicate identical event dispatches.
abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

/// Fired on app start to check if a valid token already exists in secure storage.
/// If a token is found, the app skips the login screen entirely.
class CheckAuthStatus extends AuthEvent {}

/// Login with username and password.
/// Dispatched by the login form submit button.
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

/// Logout current user — clears token from secure storage.
class Logout extends AuthEvent {}

/// Re-fetch the user profile from the server (e.g. after a profile update).
/// Only fires if already authenticated — does not navigate away on failure.
class RefreshProfile extends AuthEvent {}

// ==================== STATES ====================

/// Base class for all authentication states.
abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

/// Emitted while [CheckAuthStatus] is in progress.
/// Shown as a splash screen or activity indicator before routing.
class AuthInitial extends AuthState {}

/// Emitted immediately when any auth action starts (login, check, logout).
/// The UI shows a loading spinner during this state.
class AuthLoading extends AuthState {}

/// Emitted after successful login or a valid token is found on startup.
/// Carries the full [User] object so the app can render user-specific UI.
class AuthAuthenticated extends AuthState {
  final User user;

  const AuthAuthenticated(this.user);

  @override
  List<Object?> get props => [user];
}

/// Emitted when no valid token is found (fresh install / expired session).
/// The optional [message] is displayed in snackbars (e.g. after a logout).
class AuthUnauthenticated extends AuthState {
  final String? message;

  const AuthUnauthenticated({this.message});

  @override
  List<Object?> get props => [message];
}

/// Emitted when login fails. Carries a human-readable [message].
/// The UI stays on the login page and renders this message inline.
class AuthError extends AuthState {
  final String message;

  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

/// Manages the authentication lifecycle for the entire app.
///
/// Flow:
///   1. App opens → dispatches [CheckAuthStatus]
///   2. Token found → [AuthAuthenticated] → navigate to home
///   3. No token   → [AuthUnauthenticated] → navigate to login
///   4. User logs in → [Login] → success → [AuthAuthenticated]
///   5. User logs out → [Logout] → [AuthUnauthenticated]
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

  /// Reads stored token from secure storage and attempts to fetch the profile.
  /// On failure (expired / missing token), silently transitions to Unauthenticated
  /// rather than showing an error — this is an expected cold-start state.
  Future<void> _onCheckAuthStatus(
    CheckAuthStatus event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());

    try {
      final isLoggedIn = await _authService.isLoggedIn();
      if (isLoggedIn) {
        // Token exists — hydrate the user object so the app can render
        // permission-gated UI without a separate profile fetch.
        final user = await _authService.getProfile();
        emit(AuthAuthenticated(user));
      } else {
        // No token — fall through to login screen without an error message.
        emit(const AuthUnauthenticated());
      }
    } catch (e) {
      // Any unexpected error (e.g. DB corruption) — treat as unauthenticated
      // to avoid getting stuck on the splash screen.
      emit(const AuthUnauthenticated());
    }
  }

  /// Sends credentials to [AuthService.login] and emits the result.
  /// On failure, delegates to [_parseError] to produce a user-friendly string.
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
      // Login succeeded — navigate away from login page.
      emit(AuthAuthenticated(user));
    } catch (e) {
      // Map the raw exception to a readable message before showing it.
      final errorMessage = _parseError(e);
      emit(AuthError(errorMessage));
    }
  }

  /// Converts raw exception strings into user-readable login error messages.
  ///
  /// Error categories handled:
  ///   - Connection refused / failed  → WiFi / firewall guidance
  ///   - Timeout                      → network connectivity hint
  ///   - TEMP_EXPIRED                 → vendor temporary-access expiry
  ///   - 401 / Unauthorized           → bad credentials
  ///   - 500 / Server Error           → server-side fault
  ///   - Socket / network             → general connectivity
  ///   - Everything else              → cleaned-up raw message
  String _parseError(dynamic e) {
    final errorString = e.toString().toLowerCase();

    // Connection errors — common when the phone is on a different WiFi SSID
    // or when Windows Firewall blocks inbound connections on port 3000.
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
    // TEMP_EXPIRED is a custom backend code for vendor accounts whose access window
    // has lapsed or been manually revoked by an admin.
    if (errorString.contains('temp_expired')) {
      return 'Temporary vendor access has expired or was revoked.';
    }
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

    // Default: strip Dio/Exception prefixes and show the remaining message.
    return 'Login failed: ${e.toString().replaceAll('Exception: ', '').replaceAll('DioException: ', '')}';
  }

  /// Clears the session token from secure storage.
  /// Even if the server-side logout call fails (e.g. no connectivity),
  /// the local state is cleared so the user is not stuck in a broken session.
  Future<void> _onLogout(
    Logout event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());

    try {
      await _authService.logout();
      emit(const AuthUnauthenticated());
    } catch (e) {
      // Even if logout fails, clear local state — security over consistency.
      emit(const AuthUnauthenticated());
    }
  }

  /// Re-fetches the user profile from the server.
  /// Used after the user updates their profile details so the in-memory
  /// user object reflects the latest state without requiring a re-login.
  /// Silently ignores failures to avoid disrupting an active session.
  Future<void> _onRefreshProfile(
    RefreshProfile event,
    Emitter<AuthState> emit,
  ) async {
    try {
      final user = await _authService.getProfile();
      emit(AuthAuthenticated(user));
    } catch (e) {
      // If refresh fails, keep current state — don't log the user out.
    }
  }
}
