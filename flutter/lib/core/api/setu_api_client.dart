import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/api/api_exceptions.dart';
import 'package:setu_mobile/core/auth/token_manager.dart';

/// Test raw socket connection using dart:io
Future<bool> testRawSocketConnection(String host, int port) async {
  print('[NetworkTest] Testing raw socket to $host:$port');
  try {
    final socket = await Socket.connect(
      host,
      port,
      timeout: const Duration(seconds: 10),
    );
    print('[NetworkTest] Raw socket connected successfully!');
    await socket.close();
    return true;
  } catch (e) {
    print('[NetworkTest] Raw socket failed: $e');
    return false;
  }
}

/// Test using dart:io HttpClient (system HTTP stack)
Future<Map<String, dynamic>?> testHttpClientLogin(String username, String password) async {
  print('[NetworkTest] Testing with dart:io HttpClient...');
  try {
    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 10);
    
    final uri = Uri.parse('${ApiEndpoints.baseUrl}${ApiEndpoints.login}');
    final request = await client.postUrl(uri);
    request.headers.contentType = ContentType.json;
    request.write('{"username":"$username","password":"$password"}');
    
    final response = await request.close();
    final responseBody = await response.transform(utf8.decoder).join();
    print('[NetworkTest] HttpClient response: ${response.statusCode}');
    
    if (response.statusCode == 200 || response.statusCode == 201) {
      return {'success': true, 'body': responseBody};
    }
    return {'success': false, 'status': response.statusCode, 'body': responseBody};
  } catch (e) {
    print('[NetworkTest] HttpClient failed: $e');
    return null;
  }
}

/// SETU API Client using Dio
class SetuApiClient {
  final TokenManager _tokenManager;
  late final Dio _dio;

  SetuApiClient(this._tokenManager) {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add interceptors
    _dio.interceptors.addAll([
      _AuthInterceptor(_tokenManager),
      _ErrorInterceptor(),
      PrettyDioLogger(
        requestHeader: true,
        requestBody: true,
        responseBody: true,
        responseHeader: false,
        error: true,
        compact: true,
        maxWidth: 90,
      ),
    ]);
  }

  /// Update base URL (for environment switching)
  void updateBaseUrl(String baseUrl) {
    _dio.options.baseUrl = baseUrl;
  }

  // ==================== AUTH ENDPOINTS ====================

  /// Login with username and password
  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.login,
      data: {'username': username, 'password': password},
    );
    return response.data;
  }

  /// Get current user profile
  Future<Map<String, dynamic>> getProfile() async {
    final response = await _dio.get(ApiEndpoints.profile);
    return response.data;
  }

  // ==================== PROJECT ENDPOINTS ====================

  /// Get user's assigned projects
  Future<List<dynamic>> getMyProjects() async {
    final response = await _dio.get(ApiEndpoints.myProjects);
    return response.data;
  }

  /// Get EPS node details
  Future<Map<String, dynamic>> getEpsNode(int nodeId) async {
    final response = await _dio.get('${ApiEndpoints.epsNode}/$nodeId');
    return response.data;
  }

  /// Get EPS node children
  Future<List<dynamic>> getEpsChildren(int nodeId) async {
    final response = await _dio.get('${ApiEndpoints.epsChildren}/$nodeId/children');
    return response.data;
  }

  // ==================== PROGRESS/EXECUTION ENDPOINTS ====================

  /// Save measurements for a project
  Future<Map<String, dynamic>> saveMeasurements({
    required int projectId,
    required List<Map<String, dynamic>> entries,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.measurements(projectId),
      data: {'entries': entries},
    );
    return response.data;
  }

  /// Get progress logs for a project
  Future<List<dynamic>> getProgressLogs(int projectId) async {
    final response = await _dio.get(ApiEndpoints.progressLogs(projectId));
    return response.data;
  }

  /// Update a progress log
  Future<Map<String, dynamic>> updateProgressLog({
    required int logId,
    required double newQty,
  }) async {
    final response = await _dio.patch(
      ApiEndpoints.updateLog(logId),
      data: {'newQty': newQty},
    );
    return response.data;
  }

  /// Delete a progress log
  Future<void> deleteProgressLog(int logId) async {
    await _dio.delete(ApiEndpoints.deleteLog(logId));
  }

  /// Check if activity has micro schedule
  Future<bool> hasMicroSchedule(int activityId) async {
    final response = await _dio.get(ApiEndpoints.hasMicroSchedule(activityId));
    return response.data['hasMicro'] ?? false;
  }

  /// Get execution breakdown (micro + balance)
  Future<Map<String, dynamic>> getExecutionBreakdown({
    required int activityId,
    required int epsNodeId,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.executionBreakdown,
      queryParameters: {
        'activityId': activityId,
        'epsNodeId': epsNodeId,
      },
    );
    return response.data;
  }

  /// Save micro progress
  Future<Map<String, dynamic>> saveMicroProgress({
    required int projectId,
    required int activityId,
    required int epsNodeId,
    required List<Map<String, dynamic>> entries,
    required String date,
    String? remarks,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.saveMicroProgress,
      data: {
        'projectId': projectId,
        'activityId': activityId,
        'epsNodeId': epsNodeId,
        'entries': entries,
        'date': date,
        if (remarks != null) 'remarks': remarks,
      },
    );
    return response.data;
  }

  /// Get pending approvals for a project
  Future<List<dynamic>> getPendingApprovals(int projectId) async {
    final response = await _dio.get(ApiEndpoints.pendingApprovals(projectId));
    return response.data;
  }

  /// Approve measurements
  Future<void> approveMeasurements(List<int> logIds) async {
    await _dio.post(ApiEndpoints.approveMeasurements, data: {'logIds': logIds});
  }

  /// Reject measurements
  Future<void> rejectMeasurements({
    required List<int> logIds,
    required String reason,
  }) async {
    await _dio.post(
      ApiEndpoints.rejectMeasurements,
      data: {'logIds': logIds, 'reason': reason},
    );
  }

  // ==================== MICRO SCHEDULE ENDPOINTS ====================

  /// Get delay reasons
  Future<List<dynamic>> getDelayReasons() async {
    final response = await _dio.get(ApiEndpoints.delayReasons);
    return response.data;
  }

  /// Get micro schedules by project
  Future<List<dynamic>> getMicroSchedulesByProject(int projectId) async {
    final response = await _dio.get(ApiEndpoints.microSchedulesByProject(projectId));
    return response.data;
  }

  /// Get micro schedules by activity
  Future<List<dynamic>> getMicroSchedulesByActivity(int activityId) async {
    final response = await _dio.get(ApiEndpoints.microSchedulesByActivity(activityId));
    return response.data;
  }

  /// Get micro schedule activities
  Future<List<dynamic>> getMicroScheduleActivities(int microScheduleId) async {
    final response = await _dio.get(ApiEndpoints.microScheduleActivities(microScheduleId));
    return response.data;
  }

  // ==================== DAILY LOG ENDPOINTS ====================

  /// Create daily log
  Future<Map<String, dynamic>> createDailyLog(Map<String, dynamic> data) async {
    final response = await _dio.post(ApiEndpoints.createDailyLog, data: data);
    return response.data;
  }

  /// Get activity logs
  Future<List<dynamic>> getActivityLogs(int activityId) async {
    final response = await _dio.get(ApiEndpoints.activityLogs(activityId));
    return response.data;
  }

  /// Get today's logs for a micro schedule
  Future<List<dynamic>> getTodayLogs(int microScheduleId) async {
    final response = await _dio.get(ApiEndpoints.todayLogs(microScheduleId));
    return response.data;
  }

  /// Update daily log
  Future<Map<String, dynamic>> updateDailyLog({
    required int logId,
    required Map<String, dynamic> updates,
  }) async {
    final response = await _dio.patch(
      ApiEndpoints.updateDailyLog(logId),
      data: updates,
    );
    return response.data;
  }

  /// Delete daily log
  Future<void> deleteDailyLog(int logId) async {
    await _dio.delete(ApiEndpoints.deleteDailyLog(logId));
  }

  // ==================== PLANNING ENDPOINTS ====================

  /// Get project activities
  Future<List<dynamic>> getProjectActivities(int projectId) async {
    final response = await _dio.get(ApiEndpoints.projectActivities(projectId));
    return response.data;
  }

  /// Get activity details
  Future<Map<String, dynamic>> getActivity(int activityId) async {
    final response = await _dio.get(ApiEndpoints.activity(activityId));
    return response.data;
  }

  // ==================== BOQ ENDPOINTS ====================

  /// Get project BOQ
  Future<List<dynamic>> getProjectBoq(int projectId) async {
    final response = await _dio.get(ApiEndpoints.projectBoq(projectId));
    return response.data;
  }

  /// Get BOQ items
  Future<List<dynamic>> getBoqItems(int boqId) async {
    final response = await _dio.get(ApiEndpoints.boqItems(boqId));
    return response.data;
  }

  // ==================== FILE UPLOAD ====================

  /// Upload file
  Future<Map<String, dynamic>> uploadFile({
    required String filePath,
    String? entityType,
    int? entityId,
  }) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
      if (entityType != null) 'entityType': entityType,
      if (entityId != null) 'entityId': entityId,
    });
    final response = await _dio.post(ApiEndpoints.uploadFile, data: formData);
    return response.data;
  }
}

/// Authentication interceptor for adding JWT token to requests
class _AuthInterceptor extends Interceptor {
  final TokenManager _tokenManager;

  _AuthInterceptor(this._tokenManager);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Skip token for login endpoint
    if (options.path.contains('/auth/login')) {
      return handler.next(options);
    }

    final token = await _tokenManager.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // If 401, try to refresh token
    if (err.response?.statusCode == 401) {
      final refreshed = await _tokenManager.refreshToken();
      if (refreshed) {
        // Retry the request with new token
        final token = await _tokenManager.getAccessToken();
        err.requestOptions.headers['Authorization'] = 'Bearer $token';
        try {
          final response = await Dio().fetch(err.requestOptions);
          return handler.resolve(response);
        } catch (e) {
          return handler.next(err);
        }
      } else {
        // Token refresh failed, logout user
        await _tokenManager.clearTokens();
      }
    }
    handler.next(err);
  }
}

/// Error interceptor for converting Dio errors to custom exceptions
class _ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // Enhanced logging for connection errors
    if (err.type == DioExceptionType.connectionError) {
      print('[ErrorInterceptor] Connection Error Details:');
      print('[ErrorInterceptor] - Error type: ${err.type}');
      print('[ErrorInterceptor] - Error object: ${err.error}');
      print('[ErrorInterceptor] - Error runtimeType: ${err.error?.runtimeType}');
      print('[ErrorInterceptor] - Error message: ${err.message}');
      print('[ErrorInterceptor] - Request URL: ${err.requestOptions.uri}');
      
      // Try to get more details from the underlying error
      if (err.error != null) {
        final underlyingError = err.error;
        print('[ErrorInterceptor] - Underlying error: $underlyingError');
        if (underlyingError is SocketException) {
          final socketError = underlyingError;
          print('[ErrorInterceptor] - SocketException message: ${socketError.message}');
          print('[ErrorInterceptor] - SocketException OS error: ${socketError.osError}');
        }
      }
    }
    
    final exception = _convertToApiException(err);
    handler.next(DioException(
      requestOptions: err.requestOptions,
      response: err.response,
      type: err.type,
      error: exception,
    ));
  }

  ApiException _convertToApiException(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException.networkError('Connection timeout');
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        final message = error.response?.data?['message'] ?? 'Unknown error';
        switch (statusCode) {
          case 400:
            return ApiException.badRequest(message);
          case 401:
            return const ApiException.unauthorized();
          case 403:
            return const ApiException.forbidden();
          case 404:
            return const ApiException.notFound();
          case 500:
            return const ApiException.serverError();
          default:
            return ApiException.httpError(statusCode ?? 0, message);
        }
      case DioExceptionType.cancel:
        return const ApiException.cancelled();
      case DioExceptionType.connectionError:
        return const ApiException.networkError('No internet connection');
      default:
        return ApiException.unknown(error.message ?? 'Unknown error');
    }
  }
}
