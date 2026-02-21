import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';

/// A remote logging service that sends logs to a local server
/// and also displays them in the console for ADB logcat
class RemoteLogger {
  static final RemoteLogger _instance = RemoteLogger._internal();
  factory RemoteLogger() => _instance;
  RemoteLogger._internal();

  final Logger _logger = Logger(
    printer: PrettyPrinter(
      methodCount: 2,
      errorMethodCount: 8,
      lineLength: 120,
      colors: true,
      printEmojis: true,
      dateTimeFormat: DateTimeFormat.onlyTimeAndSinceStart,
    ),
  );

  final Logger _simpleLogger = Logger(
    printer: PrettyPrinter(
      methodCount: 0,
      colors: true,
      printEmojis: true,
      dateTimeFormat: DateTimeFormat.onlyTimeAndSinceStart,
    ),
  );

  /// Log levels
  static const String levelDebug = 'DEBUG';
  static const String levelInfo = 'INFO';
  static const String levelWarning = 'WARNING';
  static const String levelError = 'ERROR';
  static const String levelApi = 'API';

  /// Log with API tag for network requests
  void api(String message, {String? endpoint, Map<String, dynamic>? data}) {
    final logData = {
      'level': levelApi,
      'timestamp': DateTime.now().toIso8601String(),
      'endpoint': endpoint,
      'message': message,
      if (data != null) 'data': data,
    };
    
    debugPrint('══════════════════════════════════════════════════════════════');
    debugPrint('📱 [API] $message');
    if (endpoint != null) debugPrint('   Endpoint: $endpoint');
    if (data != null) debugPrint('   Data: ${jsonEncode(data)}');
    debugPrint('══════════════════════════════════════════════════════════════');
    
    _logger.i('[API] $message ${endpoint != null ? "- $endpoint" : ""}');
  }

  /// Log API response
  void apiResponse(String endpoint, int statusCode, dynamic response, {Duration? duration}) {
    final durationStr = duration != null ? '${duration.inMilliseconds}ms' : '';
    
    debugPrint('══════════════════════════════════════════════════════════════');
    debugPrint('📱 [API RESPONSE] $endpoint');
    debugPrint('   Status: $statusCode $durationStr');
    debugPrint('   Response: ${_truncateResponse(response)}');
    debugPrint('══════════════════════════════════════════════════════════════');
    
    _logger.i('[API RESPONSE] $endpoint - Status: $statusCode $durationStr');
  }

  /// Log API error
  void apiError(String endpoint, dynamic error, StackTrace? stackTrace) {
    debugPrint('══════════════════════════════════════════════════════════════');
    debugPrint('❌ [API ERROR] $endpoint');
    debugPrint('   Error: $error');
    if (stackTrace != null) {
      debugPrint('   Stack: ${stackTrace.toString().split('\n').take(5).join('\n')}');
    }
    debugPrint('══════════════════════════════════════════════════════════════');
    
    _logger.e('[API ERROR] $endpoint', error: error, stackTrace: stackTrace);
  }

  /// Debug log
  void debug(String message, {String? tag}) {
    final tagStr = tag != null ? '[$tag] ' : '';
    debugPrint('🔍 [DEBUG] $tagStr$message');
    _simpleLogger.d('$tagStr$message');
  }

  /// Info log
  void info(String message, {String? tag}) {
    final tagStr = tag != null ? '[$tag] ' : '';
    debugPrint('ℹ️ [INFO] $tagStr$message');
    _simpleLogger.i('$tagStr$message');
  }

  /// Warning log
  void warning(String message, {String? tag}) {
    final tagStr = tag != null ? '[$tag] ' : '';
    debugPrint('⚠️ [WARNING] $tagStr$message');
    _simpleLogger.w('$tagStr$message');
  }

  /// Error log
  void error(String message, {dynamic error, StackTrace? stackTrace, String? tag}) {
    final tagStr = tag != null ? '[$tag] ' : '';
    debugPrint('❌ [ERROR] $tagStr$message');
    if (error != null) debugPrint('   Error: $error');
    _logger.e('$tagStr$message', error: error, stackTrace: stackTrace);
  }

  /// User action log - for tracking user interactions
  void userAction(String action, {Map<String, dynamic>? params}) {
    debugPrint('👆 [USER] $action');
    if (params != null) debugPrint('   Params: ${jsonEncode(params)}');
    _simpleLogger.i('[USER] $action');
  }

  /// Navigation log
  void navigation(String from, String to) {
    debugPrint('🧭 [NAV] $from -> $to');
    _simpleLogger.i('[NAV] $from -> $to');
  }

  /// Auth log
  void auth(String message, {bool success = false}) {
    final icon = success ? '✅' : '🔐';
    debugPrint('$icon [AUTH] $message');
    _simpleLogger.i('[AUTH] $message');
  }

  /// Database log
  void db(String operation, {String? table, int? rowsAffected}) {
    final tableStr = table != null ? '[$table] ' : '';
    final rowsStr = rowsAffected != null ? ' ($rowsAffected rows)' : '';
    debugPrint('💾 [DB] $tableStr$operation$rowsStr');
    _simpleLogger.d('[DB] $tableStr$operation$rowsStr');
  }

  /// Sync log
  void sync(String message, {int? pending, int? completed}) {
    final pendingStr = pending != null ? ' Pending: $pending' : '';
    final completedStr = completed != null ? ' Completed: $completed' : '';
    debugPrint('🔄 [SYNC] $message$pendingStr$completedStr');
    _simpleLogger.i('[SYNC] $message$pendingStr$completedStr');
  }

  /// Truncate response for logging
  String _truncateResponse(dynamic response) {
    final str = response.toString();
    if (str.length > 500) {
      return '${str.substring(0, 500)}... (truncated)';
    }
    return str;
  }
}

/// Global logger instance
final logger = RemoteLogger();
