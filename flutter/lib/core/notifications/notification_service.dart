import 'dart:convert';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';

/// Top-level background message handler (must be a top-level function).
///
/// FCM requires this to be a top-level (not class-level) function so that
/// it can be invoked in an isolate when the app is terminated or backgrounded.
/// The `@pragma('vm:entry-point')` annotation prevents the Dart tree-shaker
/// from removing it in release builds.
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  // Background messages are handled by the system notification tray.
  // No local notification needed here — Firebase delivers the notification.
  debugPrint('FCM background message: ${message.messageId}');
}

/// Handles all Firebase Cloud Messaging (FCM) concerns for the SETU app.
///
/// Three notification delivery scenarios are handled:
/// 1. **Foreground** — app is open: [_onForegroundMessage] fires, a local
///    heads-up notification is shown via [FlutterLocalNotificationsPlugin].
/// 2. **Background** — app is open but behind other apps: the system tray
///    shows the notification; tapping it triggers [onMessageOpenedApp].
/// 3. **Cold start (terminated)** — app was not running; tapping the notification
///    launches the app and [getInitialMessage] returns the message.
///
/// In scenarios 2 and 3 the payload is forwarded to [onNotificationTap] so
/// [SETUMobileApp] can parse it and set a [PendingDeepLink].
///
/// This is a singleton so [main.dart] registers the [init] callback once and
/// every other call site just accesses the shared instance.
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  // Android notification channel config — must match values declared in
  // AndroidManifest.xml if using a custom channel there.
  static const _channelId = 'setu_quality';
  static const _channelName = 'Quality Notifications';
  static const _channelDesc =
      'Notifications for RFI raised, approved, rejected, and observations';

  /// Callback invoked whenever the user taps a notification.
  ///
  /// The argument is the FCM data payload serialised as a JSON string.
  /// Set by [SETUMobileApp.initState] so the app widget can handle
  /// navigation logic without coupling [NotificationService] to the widget tree.
  void Function(String payload)? onNotificationTap;

  // ----------------------------------------------------------------

  /// Initialises FCM permissions, the local notification channel, and all
  /// message/tap listeners.
  ///
  /// Must be called after [Firebase.initializeApp].  In [main.dart] this is
  /// called post-[runApp] as a non-blocking task to avoid delaying first paint.
  Future<void> init() async {
    // Request permission (iOS / Android 13+)
    // On Android < 13 this is a no-op but the call is safe to make.
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false, // false = requires explicit user grant on iOS
    );

    // Android local notification channel
    // Must be created before any notification is shown; creating an existing
    // channel with the same ID is idempotent (safe to call on every launch).
    const androidChannel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: _channelDesc,
      importance: Importance.high, // Shows as heads-up notification on Android
      playSound: true,
    );

    final androidImpl =
        _local.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidImpl?.createNotificationChannel(androidChannel);

    // Init local notifications
    // iOS permissions are NOT re-requested here because Firebase already
    // requested them above — setting all to false avoids a duplicate prompt.
    const androidInit =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: (details) {
        // User tapped a local notification shown during foreground delivery.
        // The payload is the FCM data map encoded as JSON in [_onForegroundMessage].
        final payload = details.payload ?? '{}';
        onNotificationTap?.call(payload);
      },
    );

    // Foreground message handler — show a local notification
    // FCM does NOT automatically show a visible notification when the app is
    // in the foreground, so we must display one manually.
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // Background handler
    // Registered here but executes in a separate isolate — any heavy work
    // must be self-contained and cannot access widgets or BLoCs.
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

    // Notification tap when app is in background (system notification tapped)
    // onMessageOpenedApp fires once the user brings the app back to foreground
    // by tapping the system tray notification.
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      final payload = jsonEncode(msg.data);
      onNotificationTap?.call(payload);
    });

    // Notification tap when app was terminated (cold start)
    // getInitialMessage returns the message that launched the app, or null if
    // the app was opened normally (not via a notification tap).
    final initial = await _messaging.getInitialMessage();
    if (initial != null) {
      final payload = jsonEncode(initial.data);
      onNotificationTap?.call(payload);
    }
  }

  /// Returns the FCM registration token for this device installation.
  ///
  /// The token uniquely identifies this device+app combination on Firebase.
  /// It must be registered with the SETU backend so the server knows where
  /// to send push notifications for this user.
  Future<String?> getToken() => _messaging.getToken();

  /// Registers the FCM device token with the SETU backend API.
  ///
  /// Called after a successful login ([SETUMobileApp] BlocConsumer) so the
  /// server can associate this device with the authenticated user.  Also
  /// subscribes to [FirebaseMessaging.onTokenRefresh] so that if Firebase
  /// rotates the token (e.g. after app reinstall), the backend is updated
  /// without requiring a re-login.
  Future<void> registerToken(SetuApiClient apiClient) async {
    try {
      final token = await getToken();
      if (token == null) return; // FCM not available (simulator, no Play Services)
      await apiClient.registerFcmToken(token);
      debugPrint('FCM token registered: $token');

      // Listen for token refresh and re-register
      // Firebase may rotate tokens; the listener ensures the backend always
      // has the current token so notifications are not silently dropped.
      _messaging.onTokenRefresh.listen((newToken) async {
        try {
          await apiClient.registerFcmToken(newToken);
          debugPrint('FCM token refreshed and re-registered');
        } catch (e) {
          debugPrint('FCM token refresh registration failed: $e');
        }
      });
    } catch (e) {
      debugPrint('FCM token registration failed: $e');
    }
  }

  // ----------------------------------------------------------------

  /// Displays a local heads-up notification for a message received while
  /// the app is in the foreground.
  ///
  /// [message.hashCode] is used as the notification ID — not globally unique,
  /// but sufficient to differentiate simultaneous rapid notifications since
  /// each FCM message has a distinct [RemoteMessage.messageId].
  ///
  /// The full FCM data map is serialised as the payload so [onNotificationTap]
  /// can reconstruct the navigation intent when the user taps the banner.
  Future<void> _onForegroundMessage(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return; // Data-only message — nothing to display

    final android = notification.android;
    await _local.show(
      message.hashCode,
      notification.title ?? 'SETU Quality',
      notification.body ?? '',
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDesc,
          importance: Importance.high,
          priority: Priority.high,
          // Use the server-specified small icon if provided, fall back to the
          // app launcher icon so the notification always has a valid drawable.
          icon: android?.smallIcon ?? '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      // Encode the FCM data map so the tap handler can parse navigation intent.
      payload: jsonEncode(message.data),
    );
  }
}
