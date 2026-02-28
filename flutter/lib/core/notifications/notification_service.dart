import 'dart:convert';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';

/// Top-level background message handler (must be a top-level function).
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  // Background messages are handled by the system notification tray.
  // No local notification needed here — Firebase delivers the notification.
  debugPrint('FCM background message: ${message.messageId}');
}

/// Handles Firebase Cloud Messaging (FCM) — initialises, displays
/// foreground notifications, and registers the device token with SETU backend.
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  static const _channelId = 'setu_quality';
  static const _channelName = 'Quality Notifications';
  static const _channelDesc =
      'Notifications for RFI raised, approved, rejected, and observations';

  /// Callback invoked when user taps a notification.
  /// Receives the notification payload (JSON string).
  void Function(String payload)? onNotificationTap;

  // ----------------------------------------------------------------

  Future<void> init() async {
    // Request permission (iOS / Android 13+)
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    // Android local notification channel
    const androidChannel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: _channelDesc,
      importance: Importance.high,
      playSound: true,
    );

    final androidImpl =
        _local.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidImpl?.createNotificationChannel(androidChannel);

    // Init local notifications
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
        final payload = details.payload ?? '{}';
        onNotificationTap?.call(payload);
      },
    );

    // Foreground message handler — show a local notification
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // Background handler
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

    // Notification tap when app is in background (system notification tapped)
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      final payload = jsonEncode(msg.data);
      onNotificationTap?.call(payload);
    });

    // Notification tap when app was terminated (cold start)
    final initial = await _messaging.getInitialMessage();
    if (initial != null) {
      final payload = jsonEncode(initial.data);
      onNotificationTap?.call(payload);
    }
  }

  /// Get the current FCM token for this device.
  Future<String?> getToken() => _messaging.getToken();

  /// Register the FCM token with the SETU backend.
  /// Call this after successful login.
  Future<void> registerToken(SetuApiClient apiClient) async {
    try {
      final token = await getToken();
      if (token == null) return;
      await apiClient.registerFcmToken(token);
      debugPrint('FCM token registered: $token');

      // Listen for token refresh and re-register
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

  Future<void> _onForegroundMessage(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

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
          icon: android?.smallIcon ?? '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }
}
