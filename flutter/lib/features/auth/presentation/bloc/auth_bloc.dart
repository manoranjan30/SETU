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

/// Submit the OTP entered by the user to complete an email OTP login.
class VerifyOtp extends AuthEvent {
  final String challengeId;
  final String otp;
  const VerifyOtp({required this.challengeId, required this.otp});
  @override
  List<Object?> get props => [challengeId, otp];
}

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

/// Emitted when the backend requires OTP verification before issuing a JWT.
/// The OTP screen stays live; retry re-dispatches [VerifyOtp].
class AuthOtpChallenge extends AuthState {
  final String challengeId;
  final String deliveryChannel;
  final String destinationMasked;
  final String expiresAt;
  final int expiresInSeconds;

  const AuthOtpChallenge({
    required this.challengeId,
    required this.deliveryChannel,
    required this.destinationMasked,
    required this.expiresAt,
    required this.expiresInSeconds,
  });

  @override
  List<Object?> get props =>
      [challengeId, deliveryChannel, destinationMasked, expiresAt, expiresInSeconds];
}

/// Emitted when [VerifyOtp] fails (wrong code, expired).
/// Keeps the challenge details so the user can retry on the OTP screen.
class AuthOtpError extends AuthState {
  final String challengeId;
  final String destinationMasked;
  final int expiresInSeconds;
  final String message;

  const AuthOtpError({
    required this.challengeId,
    required this.destinationMasked,
    required this.expiresInSeconds,
    required this.message,
  });

  @override
  List<Object?> get props => [challengeId, message];
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
    on<VerifyOtp>(_onVerifyOtp);
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
  /// If the server returns an OTP challenge, emits [AuthOtpChallenge] instead
  /// of an error so the UI can present the OTP entry screen.
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
    } on OtpRequiredException catch (e) {
      emit(AuthOtpChallenge(
        challengeId: e.challengeId,
        deliveryChannel: e.deliveryChannel,
        destinationMasked: e.destinationMasked,
        expiresAt: e.expiresAt,
        expiresInSeconds: e.expiresInSeconds,
      ));
    } catch (e) {
      emit(AuthError(_parseError(e)));
    }
  }

  /// Verifies the user-entered OTP against the active challenge.
  /// Success → [AuthAuthenticated]. Wrong code / expired → [AuthOtpError]
  /// so the OTP screen can show an inline error and let the user retry.
  Future<void> _onVerifyOtp(
    VerifyOtp event,
    Emitter<AuthState> emit,
  ) async {
    // Snapshot the current challenge details so we can restore them on failure.
    final currentState = state;
    final challenge = currentState is AuthOtpChallenge
        ? currentState
        : currentState is AuthOtpError
            ? AuthOtpChallenge(
                challengeId: currentState.challengeId,
                deliveryChannel: 'EMAIL',
                destinationMasked: currentState.destinationMasked,
                expiresAt: '',
                expiresInSeconds: currentState.expiresInSeconds,
              )
            : null;

    emit(AuthLoading());

    try {
      final user = await _authService.verifyOtp(
        challengeId: event.challengeId,
        otp: event.otp,
      );
      emit(AuthAuthenticated(user));
    } catch (e) {
      final msg = _parseOtpError(e);
      emit(AuthOtpError(
        challengeId: event.challengeId,
        destinationMasked: challenge?.destinationMasked ?? '',
        expiresInSeconds: challenge?.expiresInSeconds ?? 300,
        message: msg,
      ));
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

  String _parseOtpError(dynamic e) {
    final s = e.toString().toLowerCase();
    if (s.contains('expired')) return 'OTP has expired. Please log in again.';
    if (s.contains('invalid') || s.contains('incorrect') || s.contains('wrong')) {
      return 'Incorrect OTP. Please check the code and try again.';
    }
    if (s.contains('429') || s.contains('too many')) {
      return 'Too many attempts. Please wait before trying again.';
    }
    if (s.contains('connection') || s.contains('socket')) {
      return 'No connection. Check your network and try again.';
    }
    return 'OTP verification failed. Please try again.';
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
