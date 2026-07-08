import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio_cache_interceptor/dio_cache_interceptor.dart';
import 'package:flutter/foundation.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/api/api_exceptions.dart';
import 'package:setu_mobile/core/auth/token_manager.dart';

/// Central HTTP client for all SETU backend communication.
///
/// Built on top of [Dio] with two custom interceptors:
/// - [_AuthInterceptor]: injects the JWT Bearer token into every request and
///   transparently retries once on 401 after refreshing the token.
/// - [_ErrorInterceptor]: normalises all [DioException] variants into typed
///   [ApiException] objects so callers never have to inspect raw Dio errors.
/// - [DioCacheInterceptor]: caches GET responses in memory for up to 3 minutes
///   so navigating back to a previously-loaded screen is instant.
///
/// In debug builds, [PrettyDioLogger] is added to print human-readable
/// request/response logs to the console.
///
/// Instantiated once via dependency injection (GetIt) and shared app-wide.
class SetuApiClient {
  final TokenManager _tokenManager;

  // Shared in-memory cache store — lives for the lifetime of the process.
  // MemCacheStore is cleared on app restart, which is the right behavior:
  // fresh session → fresh data, but within a session back-navigation is instant.
  static final _cacheStore = MemCacheStore();
  static final _cacheOptions = CacheOptions(
    store: _cacheStore,
    // Request-first caching: respect backend Cache-Control headers. Workflow,
    // approval, observation, task, follow-up, and journal endpoints return
    // no-store so actions are visible immediately after mutation.
    policy: CachePolicy.request,
    maxStale: const Duration(minutes: 3),
    // Serve stale cached data on any network error EXCEPT auth errors —
    // keeps the app usable on poor construction-site connectivity.
    hitCacheOnErrorCodes: [],
    priority: CachePriority.normal,
  );

  // Dio instance is created in the constructor and held privately.
  // late final ensures it is only assigned once and never null after init.
  late final Dio _dio;

  /// Creates the [SetuApiClient] and configures the underlying [Dio] instance.
  ///
  /// [tokenManager] is used by [_AuthInterceptor] to read and refresh tokens.
  SetuApiClient(this._tokenManager) {
    _dio = Dio(
      BaseOptions(
        // Base URL resolved from ApiEndpoints (compile-time dart-define or
        // runtime override set by ServerConfigService before this constructor runs).
        baseUrl: ApiEndpoints.baseUrl,
        // 5 s connect timeout: fail fast when the server is unreachable (no signal,
        // firewall, etc.).  On construction floors the device may show "connected"
        // (WiFi/4G icon) but the TCP handshake never completes — 5 s surfaces this
        // quickly so the app can fall back to cached data instead of blocking the UI.
        //
        // 15 s receive timeout: once a connection IS established, allow slow signals
        // (e.g. weak 4G on upper floors) enough time to stream the full response body.
        // The _ErrorInterceptor maps both timeout types to ApiException.networkError
        // so BLoCs treat them as offline → write to SyncQueue → retry later.
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 15),
        sendTimeout: const Duration(seconds: 10),
        headers: {
          // Tell the backend we are sending and expecting JSON for all requests.
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Interceptors are evaluated in insertion order:
    // 1. DioCacheInterceptor — serves GET responses from in-memory cache when fresh.
    // 2. _AuthInterceptor   — adds Authorization header before the request leaves.
    // 3. _ErrorInterceptor  — maps Dio errors to ApiException after response arrives.
    // 4. PrettyDioLogger    — only in debug builds; logs to console for developer inspection.
    _dio.interceptors.addAll([
      DioCacheInterceptor(options: _cacheOptions),
      _MutationCacheInvalidationInterceptor(),
      _AuthInterceptor(_tokenManager, _dio),
      _ErrorInterceptor(),
      if (kDebugMode)
        PrettyDioLogger(
          requestHeader: true,
          requestBody: true,
          responseBody: true,
          responseHeader: false, // Headers are verbose; omit to keep logs readable.
          error: true,
          compact: true,
          maxWidth: 90,
        ),
    ]);
  }

  /// Updates the Dio base URL at runtime.
  ///
  /// Primarily used in environment-switching screens (e.g. developer settings
  /// that let a tester point the app at a different server without rebuilding).
  void updateBaseUrl(String baseUrl) {
    _dio.options.baseUrl = baseUrl;
  }

  /// Clears the in-memory HTTP response cache.
  ///
  /// Call this after any mutating operation (raise RFI, submit observation,
  /// etc.) so the next list fetch goes to the server rather than returning
  /// stale cached data. Also called by blocs on explicit pull-to-refresh.
  Future<void> clearCache() async {
    await _cacheStore.clean();
  }

  // ==================== AUTH ENDPOINTS ====================

  /// Authenticates the user and returns the raw token response map.
  ///
  /// The [_AuthInterceptor] intentionally skips injecting a Bearer token for
  /// this endpoint because no token exists yet at login time.
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

  /// Verifies an email OTP challenge returned by [login].
  /// On success returns the same shape as a normal login response
  /// (access_token, user, etc.).
  Future<Map<String, dynamic>> verifyOtp({
    required String challengeId,
    required String otp,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.loginVerifyOtp,
      data: {'challengeId': challengeId, 'otp': otp},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Fetches the authenticated user's profile from the server.
  Future<Map<String, dynamic>> getProfile() async {
    final response = await _dio.get(ApiEndpoints.profile);
    return response.data;
  }

  // ==================== QR SIGNATURE SESSIONS ====================

  /// Fetches the context for a QR-based signature session.
  Future<Map<String, dynamic>> getMobileSignatureSession(String token) async {
    final response = await _dio.get(ApiEndpoints.mobileSignatureSession(token));
    return response.data as Map<String, dynamic>;
  }

  /// Confirms a QR signature session. [signatureData] is an optional base64
  /// data URI; omit it when the user has a saved profile signature on the server.
  Future<Map<String, dynamic>> confirmMobileSignatureSession({
    required String token,
    String? signatureData,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.mobileSignatureSessionConfirm(token),
      data: {
        if (signatureData != null) 'signatureData': signatureData,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  // ==================== PROJECT ENDPOINTS ====================

  /// Returns the list of EPS project nodes assigned to the current user.
  Future<List<dynamic>> getMyProjects() async {
    final response = await _dio.get(ApiEndpoints.myProjects);
    return response.data;
  }

  /// Returns the details of a single EPS node by its database ID.
  Future<Map<String, dynamic>> getEpsNode(int nodeId) async {
    final response = await _dio.get('${ApiEndpoints.epsNode}/$nodeId');
    return response.data;
  }

  /// Returns the direct children of an EPS node.
  ///
  /// Note: the backend endpoint for this may not be fully implemented;
  /// use [getEpsTree] for a full recursive hierarchy instead.
  Future<List<dynamic>> getEpsChildren(int nodeId) async {
    final response = await _dio.get('${ApiEndpoints.epsChildren}/$nodeId/children');
    return response.data;
  }

  /// Returns the full nested EPS hierarchy rooted at [nodeId].
  ///
  /// Response shape: `[{id, label, type, children: [...], data: {...}}]`
  ///
  /// Used to build the project/tower/floor navigation tree in the app.
  Future<List<dynamic>> getEpsTree(int nodeId) async {
    final response = await _dio.get('${ApiEndpoints.epsNode}/$nodeId/tree');
    return response.data;
  }

  // ==================== PROGRESS/EXECUTION ENDPOINTS ====================

  /// Submits one or more quantity measurement entries for a project.
  ///
  /// [entries] is a list of measurement objects; the exact shape is
  /// determined by the backend's `CreateMeasurementDto`.
  Future<dynamic> saveMeasurements({
    required int projectId,
    required List<Map<String, dynamic>> entries,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.measurements(projectId),
      data: {'entries': entries},
    );
    return response.data;
  }

  /// Returns the full history of submitted progress logs for a project.
  Future<List<dynamic>> getProgressLogs(int projectId) async {
    final response = await _dio.get(ApiEndpoints.progressLogs(projectId));
    return response.data;
  }

  /// Updates the quantity recorded on an existing progress log.
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

  /// Permanently deletes a progress log entry.
  Future<void> deleteProgressLog(int logId) async {
    await _dio.delete(ApiEndpoints.deleteLog(logId));
  }

  /// Quick check that returns `true` if the activity has an associated
  /// micro-schedule, without fetching the full schedule payload.
  ///
  /// The `?? false` guards against a null response body from the backend.
  Future<bool> hasMicroSchedule(int activityId) async {
    final response = await _dio.get(ApiEndpoints.hasMicroSchedule(activityId));
    return response.data['hasMicro'] ?? false;
  }

  /// Returns the execution breakdown (micro + balance quantities split across
  /// vendors) for a given activity at a specific EPS node.
  ///
  /// The backend may return a plain string or null when no data exists, so
  /// we guard against a non-map response and return a safe empty structure
  /// instead of crashing with a cast error.
  Future<Map<String, dynamic>> getExecutionBreakdown({
    required int activityId,
    required int epsNodeId,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.executionBreakdown(activityId, epsNodeId),
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return data;
    // Backend returned non-map (plain string error or null) — return empty breakdown
    return {'activityId': activityId, 'epsNodeId': epsNodeId, 'vendorBreakdown': []};
  }

  /// Saves progress entries that belong to a micro-schedule activity.
  ///
  /// Returns `dynamic` (not `Map`) because the backend returns a JSON array
  /// of saved records, not a single object. The return value is currently
  /// not consumed by callers — they only care whether an exception was thrown.
  Future<dynamic> saveMicroProgress({
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
        // Only include remarks in the payload when explicitly provided —
        // sending null would overwrite an existing remark on the backend.
        if (remarks != null) 'remarks': remarks,
      },
    );
    return response.data;
  }

  /// Marks a planning activity as fully COMPLETED.
  ///
  /// Sets the activity status to COMPLETED and records today as the actual
  /// finish date on the backend. Mirrors the web app's "Mark Complete" button.
  /// Throws [ApiException] if the user lacks permission or the request fails.
  Future<void> markActivityComplete(int activityId) async {
    await _dio.post(ApiEndpoints.activityComplete(activityId));
  }

  /// Returns all progress logs awaiting approval by the current user's role.
  Future<List<dynamic>> getPendingApprovals(int projectId) async {
    final response = await _dio.get(ApiEndpoints.pendingApprovals(projectId));
    return response.data;
  }

  /// Bulk-approves a list of progress log IDs.
  Future<void> approveMeasurements(List<int> logIds) async {
    await _dio.post(ApiEndpoints.approveMeasurements, data: {'logIds': logIds});
  }

  /// Bulk-rejects a list of progress log IDs.
  ///
  /// [reason] is mandatory — the backend rejects the request without it.
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

  /// Returns the master list of delay reason codes used in daily logs.
  Future<List<dynamic>> getDelayReasons() async {
    final response = await _dio.get(ApiEndpoints.delayReasons);
    return response.data;
  }

  /// Returns all micro-schedules associated with a project.
  Future<List<dynamic>> getMicroSchedulesByProject(int projectId) async {
    final response = await _dio.get(ApiEndpoints.microSchedulesByProject(projectId));
    return response.data;
  }

  /// Returns all micro-schedules filtered to a single planning activity.
  Future<List<dynamic>> getMicroSchedulesByActivity(int activityId) async {
    final response = await _dio.get(ApiEndpoints.microSchedulesByActivity(activityId));
    return response.data;
  }

  /// Returns the list of micro-schedule activities within a specific schedule.
  Future<List<dynamic>> getMicroScheduleActivities(int microScheduleId) async {
    final response = await _dio.get(ApiEndpoints.microScheduleActivities(microScheduleId));
    return response.data;
  }

  // ==================== DAILY LOG ENDPOINTS ====================

  /// Creates a new daily progress log entry under a micro-schedule activity.
  Future<Map<String, dynamic>> createDailyLog(Map<String, dynamic> data) async {
    final response = await _dio.post(ApiEndpoints.createDailyLog, data: data);
    return response.data;
  }

  /// Returns all daily logs for a given micro-schedule activity.
  Future<List<dynamic>> getActivityLogs(int activityId) async {
    final response = await _dio.get(ApiEndpoints.activityLogs(activityId));
    return response.data;
  }

  /// Returns only today's daily logs for a specific micro-schedule.
  ///
  /// More efficient than fetching all logs and filtering client-side.
  Future<List<dynamic>> getTodayLogs(int microScheduleId) async {
    final response = await _dio.get(ApiEndpoints.todayLogs(microScheduleId));
    return response.data;
  }

  /// Partially updates an existing daily log with the provided [updates] map.
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

  /// Permanently deletes a daily log entry.
  Future<void> deleteDailyLog(int logId) async {
    await _dio.delete(ApiEndpoints.deleteDailyLog(logId));
  }

  // ==================== PLANNING ENDPOINTS ====================

  /// Returns activities released for on-site execution at [epsNodeId].
  ///
  /// The backend aggregates recursively, so passing a tower node ID will
  /// return activities from all floors and units beneath it — you do not need
  /// to query each child node separately.
  ///
  /// Endpoint: GET /planning/:projectId/execution-ready?wbsNodeId=:epsNodeId
  Future<List<dynamic>> getExecutionReadyActivities(int projectId, int epsNodeId) async {
    final response = await _dio.get(
      ApiEndpoints.executionReady(projectId),
      queryParameters: {'wbsNodeId': epsNodeId},
    );
    return response.data;
  }

  /// @deprecated — the `/planning/projects/:id/activities` endpoint does not
  /// exist on the backend. This method is retained only for reference.
  /// Use [getExecutionReadyActivities] instead.
  Future<List<dynamic>> getProjectActivities(int projectId) async {
    final response = await _dio.get(ApiEndpoints.projectActivities(projectId));
    return response.data;
  }

  /// Returns the full detail of a single planning activity.
  Future<Map<String, dynamic>> getActivity(int activityId) async {
    final response = await _dio.get(ApiEndpoints.activity(activityId));
    return response.data;
  }

  // ==================== ISSUE TRACKER ====================

  Future<List<dynamic>> getIssues(int projectId, {String? status, String? priority}) async {
    final response = await _dio.get(
      '/planning/$projectId/issue-tracker/issues',
      queryParameters: {
        if (status != null) 'status': status,
        if (priority != null) 'priority': priority,
      },
    );
    return response.data is List ? response.data as List<dynamic>
        : (response.data['items'] ?? response.data['data'] ?? []) as List<dynamic>;
  }

  Future<Map<String, dynamic>> getIssue(int projectId, int issueId) async {
    final response = await _dio.get('/planning/$projectId/issue-tracker/issues/$issueId');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createIssue(int projectId, Map<String, dynamic> data) async {
    final response = await _dio.post('/planning/$projectId/issue-tracker/issues', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateIssue(int projectId, int issueId, Map<String, dynamic> data) async {
    final response = await _dio.patch('/planning/$projectId/issue-tracker/issues/$issueId', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> respondToIssue(int projectId, int issueId, {
    required String responseText,
    String? committedDate,
  }) async {
    final response = await _dio.post(
      '/planning/$projectId/issue-tracker/issues/$issueId/respond',
      data: {'responseText': responseText, if (committedDate != null) 'committedCompletionDate': committedDate},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> closeIssue(int projectId, int issueId, {String? remarks}) async {
    final response = await _dio.post(
      '/planning/$projectId/issue-tracker/issues/$issueId/close',
      data: {if (remarks != null) 'remarks': remarks},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> getIssueDepartments(int projectId) async {
    try {
      final response = await _dio.get('/planning/$projectId/issue-tracker/dept-config');
      return response.data is List ? response.data as List<dynamic> : [];
    } catch (_) {
      try {
        final response = await _dio.get('/admin/issue-tracker/departments');
        return response.data is List ? response.data as List<dynamic> : [];
      } catch (_) {
        return [];
      }
    }
  }

  Future<List<dynamic>> getIssueEligibleUsers(int projectId) async {
    final response = await _dio.get('/planning/$projectId/issue-tracker/users');
    return response.data is List ? response.data as List<dynamic> : [];
  }

  Future<List<dynamic>> getIssueTags(int projectId) async {
    final response = await _dio.get('/planning/$projectId/issue-tracker/tags');
    return response.data is List ? response.data as List<dynamic> : [];
  }

  // ==================== PLANNING ACTION SUMMARY ====================

  Future<Map<String, dynamic>> getPlanningActionSummary(int projectId) async {
    try {
      final response = await _dio.get('/planning/projects/$projectId/actions/summary');
      return response.data as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  // ==================== ASSIGNEE PICKER ====================

  Future<List<dynamic>> getAssigneeOptions(int projectId) async {
    final response = await _dio.get('/planning/projects/$projectId/tasks/assignee-options');
    return response.data is List ? response.data as List<dynamic> : [];
  }

  // ==================== TASK MANAGER ====================

  List<dynamic> _unwrapList(dynamic raw) {
    if (raw is List) return raw;
    if (raw is Map) {
      final inner = raw['data'] ?? raw['items'] ?? [];
      return inner is List ? inner : [];
    }
    return [];
  }

  Future<List<dynamic>> getTasks(int projectId, {String? subPath}) async {
    final path = subPath != null ? '/planning/projects/$projectId/tasks/$subPath' : '/planning/projects/$projectId/tasks';
    final response = await _dio.get(path);
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> getTask(int projectId, int taskId) async {
    final response = await _dio.get('/planning/projects/$projectId/tasks/$taskId');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createTask(int projectId, Map<String, dynamic> data) async {
    final response = await _dio.post('/planning/projects/$projectId/tasks', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateTask(int projectId, int taskId, Map<String, dynamic> data) async {
    final response = await _dio.patch('/planning/projects/$projectId/tasks/$taskId', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<void> updateTaskStatus(int projectId, int taskId, String status) async {
    await _dio.patch('/planning/projects/$projectId/tasks/$taskId/status', data: {'status': status});
  }

  Future<void> completeTask(int projectId, int taskId) async {
    await _dio.post('/planning/projects/$projectId/tasks/$taskId/complete');
  }

  Future<void> reopenTask(int projectId, int taskId) async {
    await _dio.post('/planning/projects/$projectId/tasks/$taskId/reopen');
  }

  Future<void> deleteTask(int projectId, int taskId) async {
    await _dio.delete('/planning/projects/$projectId/tasks/$taskId');
  }

  Future<List<dynamic>> getTaskComments(int projectId, int taskId) async {
    final response = await _dio.get('/planning/projects/$projectId/tasks/$taskId/comments');
    return _unwrapList(response.data);
  }

  Future<void> addTaskComment(int projectId, int taskId, String comment) async {
    await _dio.post('/planning/projects/$projectId/tasks/$taskId/comments', data: {'comment': comment});
  }

  // ==================== FOLLOW-UP REGISTER ====================

  Future<List<dynamic>> getFollowups(int projectId, {String? subPath}) async {
    final path = subPath != null ? '/planning/projects/$projectId/followups/$subPath' : '/planning/projects/$projectId/followups';
    final response = await _dio.get(path);
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> createFollowup(int projectId, Map<String, dynamic> data) async {
    final response = await _dio.post('/planning/projects/$projectId/followups', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<void> closeFollowup(int projectId, int followupId, {String? remarks}) async {
    await _dio.post('/planning/projects/$projectId/followups/$followupId/close',
        data: {if (remarks != null) 'remarks': remarks});
  }

  Future<void> reopenFollowup(int projectId, int followupId) async {
    await _dio.post('/planning/projects/$projectId/followups/$followupId/reopen');
  }

  Future<void> snoozeFollowup(int projectId, int followupId, {required String dueDate, required String reminderAt}) async {
    await _dio.post('/planning/projects/$projectId/followups/$followupId/snooze',
        data: {'dueDate': dueDate, 'reminderAt': reminderAt});
  }

  Future<Map<String, dynamic>> convertFollowupToTask(int projectId, int followupId) async {
    final response = await _dio.post('/planning/projects/$projectId/followups/$followupId/convert-to-task');
    return response.data as Map<String, dynamic>;
  }

  Future<void> deleteFollowup(int projectId, int followupId) async {
    await _dio.delete('/planning/projects/$projectId/followups/$followupId');
  }

  // ==================== SITE JOURNAL ====================

  Future<List<dynamic>> getJournalEntries(int projectId, {String? search}) async {
    final response = await _dio.get('/planning/projects/$projectId/journal',
        queryParameters: {if (search != null && search.isNotEmpty) 'q': search});
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>?> getTodayJournal(int projectId) async {
    try {
      final response = await _dio.get('/planning/projects/$projectId/journal/today');
      return response.data as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> getJournalEntry(int projectId, int journalId) async {
    try {
      final response = await _dio.get('/planning/projects/$projectId/journal/$journalId');
      return response.data as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>> upsertJournalEntry(int projectId, Map<String, dynamic> data) async {
    final response = await _dio.post('/planning/projects/$projectId/journal', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateJournalEntry(int projectId, int journalId, Map<String, dynamic> data) async {
    final response = await _dio.patch('/planning/projects/$projectId/journal/$journalId', data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<void> submitJournalEntry(int projectId, int journalId) async {
    await _dio.post('/planning/projects/$projectId/journal/$journalId/submit');
  }

  Future<void> lockJournalEntry(int projectId, int journalId) async {
    await _dio.post('/planning/projects/$projectId/journal/$journalId/lock');
  }

  Future<void> reopenJournalEntry(int projectId, int journalId) async {
    await _dio.post('/planning/projects/$projectId/journal/$journalId/reopen');
  }

  Future<Map<String, dynamic>> uploadJournalPhotos(int projectId, int journalId, List<String> filePaths) async {
    final files = <MultipartFile>[];
    for (final path in filePaths) {
      files.add(await MultipartFile.fromFile(path, filename: path.split('/').last));
    }
    final response = await _dio.post(
      '/planning/projects/$projectId/journal/$journalId/photos',
      data: FormData.fromMap({'files': files}),
    );
    return response.data as Map<String, dynamic>;
  }

  // ==================== SCHEDULE VIEWER ====================

  Future<List<dynamic>> getScheduleVersions(int projectId) async {
    final response = await _dio.get('/planning/$projectId/versions');
    return response.data is List ? response.data as List<dynamic> : [];
  }

  Future<List<dynamic>> getVersionActivities(int versionId, {String? q}) async {
    final response = await _dio.get(
      '/planning/versions/$versionId/activities',
      queryParameters: {if (q != null && q.isNotEmpty) 'q': q},
    );
    return response.data is List ? response.data as List<dynamic> : [];
  }

  // ==================== WO–SCHEDULE LINKER ====================

  /// Links a WO item to a schedule activity via POST /planning/distribute-wo.
  /// quantity: -1 lets the backend use the full allocated quantity.
  Future<void> linkWoItemToActivity({
    required int projectId,
    required int workOrderItemId,
    required int activityId,
    double quantity = -1,
    String mappingType = 'DIRECT',
  }) async {
    await _dio.post('/planning/distribute-wo', data: {
      'projectId': projectId,
      'activityId': activityId,
      'workOrderItemId': workOrderItemId,
      'quantity': quantity,
      'mappingType': mappingType,
      'mappingRules': null,
    });
  }

  /// Returns the audit of all WO item → activity mappings for the project.
  Future<List<dynamic>> getWoMappings(int projectId) async {
    final response = await _dio.get('/planning/$projectId/wo-mapper/mappings');
    return response.data is List ? response.data as List<dynamic> : [];
  }

  /// Returns the WO item tree (vendor → WO → items) for the project mapper.
  Future<dynamic> getWoItemsTree(int projectId) async {
    final response = await _dio.get('/workdoc/mapper/wo-items/$projectId');
    return response.data;
  }

  Future<List<dynamic>> getProjectWorkOrders(int projectId) async {
    final response = await _dio.get('/workdoc/$projectId/work-orders');
    return response.data is List ? response.data as List<dynamic> : [];
  }

  // ==================== BOQ ENDPOINTS ====================

  /// Returns all Bill-of-Quantities documents for a project.
  Future<List<dynamic>> getProjectBoq(int projectId) async {
    final response = await _dio.get(ApiEndpoints.projectBoq(projectId));
    return response.data;
  }

  /// Returns the line items within a specific BOQ document.
  Future<List<dynamic>> getBoqItems(int boqId) async {
    final response = await _dio.get(ApiEndpoints.boqItems(boqId));
    return response.data;
  }

  // ==================== FILE UPLOAD ====================

  /// Uploads a local file to the server using multipart/form-data.
  ///
  /// After upload, the server returns a relative path (e.g. `/uploads/uuid.jpg`).
  /// This method resolves that path to a full URL via [ApiEndpoints.resolveUrl]
  /// so that widgets like `CachedNetworkImage` can load the image immediately
  /// without any additional URL manipulation by the caller.
  Future<Map<String, dynamic>> uploadFile({
    required String filePath,
    String? entityType,
    int? entityId,
  }) async {
    // Build a multipart form; optional metadata fields are only included when provided.
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
      if (entityType != null) 'entityType': entityType,
      if (entityId != null) 'entityId': entityId,
    });
    final response = await _dio.post(ApiEndpoints.uploadFile, data: formData);

    // Make a mutable copy so we can overwrite the URL fields below.
    final data = Map<String, dynamic>.from(response.data as Map);

    // The backend may use either 'url' or 'path' depending on the upload handler.
    // Resolve whichever is present to an absolute URL for use in CachedNetworkImage.
    final rawUrl = data['url'] as String? ?? data['path'] as String? ?? '';
    if (rawUrl.isNotEmpty) {
      final resolved = ApiEndpoints.resolveUrl(rawUrl);
      // Write back to both keys so consumers can access via either field name.
      data['url'] = resolved;
      data['path'] = resolved;
    }
    return data;
  }

  // ==================== QUALITY ENDPOINTS ====================

  /// Returns the full nested EPS hierarchy for a project.
  ///
  /// Used to populate the location picker in the inspection creation form
  /// so the user can select a specific floor or unit.
  ///
  /// The backend builds this tree by loading every EPS node in the system
  /// and filtering in-memory (no project-scoped query), which can take
  /// longer than the default 15s receive timeout on a slow site network —
  /// give this specific call extra headroom rather than failing fast.
  Future<List<dynamic>> getEpsTreeForProject(int projectId) async {
    final response = await _dio.get(
      ApiEndpoints.epsTree(projectId),
      options: Options(receiveTimeout: const Duration(seconds: 30)),
    );
    return response.data;
  }

  /// Returns QC activity lists scoped to a project, optionally filtered to
  /// a specific EPS node (e.g., a particular floor).
  Future<List<dynamic>> getQualityActivityLists({
    required int projectId,
    int? epsNodeId,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.qualityActivityLists,
      queryParameters: {
        'projectId': projectId,
        // Only send epsNodeId when provided — omitting it returns all lists.
        if (epsNodeId != null) 'epsNodeId': epsNodeId,
      },
    );
    return response.data;
  }

  /// Returns the individual checkable activities within a QC activity list.
  Future<List<dynamic>> getQualityListActivities(int listId) async {
    final response =
        await _dio.get(ApiEndpoints.qualityListActivities(listId));
    return response.data;
  }

  /// Returns inspection requests (RFIs) with optional filters.
  ///
  /// Returns inspection requests (RFIs) with optional filters.
  ///
  /// When [limit] is provided the backend activates its pagination branch
  /// (`skip/take`) rather than a full-table `getMany()`, which also limits
  /// how many records `attachWorkflowSummary` processes — directly reducing
  /// the response size and server CPU.  The response shape changes from a
  /// plain `List` to `{ data: [...], total, limit, offset, hasMore }`;
  /// [_unwrapInspections] normalises both shapes so callers don't need to
  /// handle the difference.
  Future<List<dynamic>> getQualityInspections({
    required int projectId,
    int? epsNodeId,
    int? listId,
    int? limit,
    int? offset,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.qualityInspections,
      queryParameters: {
        'projectId': projectId,
        if (epsNodeId != null) 'epsNodeId': epsNodeId,
        if (listId != null) 'listId': listId,
        if (limit != null) 'limit': limit,
        if (offset != null) 'offset': offset,
      },
    );
    return _unwrapInspections(response.data);
  }

  /// Normalises the two possible response shapes from the inspections endpoint:
  ///   - Paginated:  `{ data: [...], total, hasMore, ... }`
  ///   - Unpaginated: `[...]`
  static List<dynamic> _unwrapInspections(dynamic raw) {
    if (raw is List) return raw;
    if (raw is Map) {
      final data = raw['data'];
      if (data is List) return data;
    }
    return const [];
  }

  /// Returns a single inspection with its full checklist stages and items.
  Future<Map<String, dynamic>> getQualityInspectionDetail(int id) async {
    final response = await _dio.get(ApiEndpoints.qualityInspection(id));
    return response.data;
  }

  /// Creates a new inspection request (Raise RFI) against a specific
  /// activity and location.
  ///
  /// [documentType] is 'FLOOR_RFI' (default), 'UNIT_RFI', or 'ROOM_RFI'.
  /// [partNo]/[totalParts] support Multi Go (e.g. Part 1 of 3).
  /// [qualityUnitId] is required for UNIT_RFI — links to a specific unit.
  /// [vendorId]/[vendorName] are optional contractor context.
  Future<Map<String, dynamic>> raiseRfi({
    required int projectId,
    required int epsNodeId,
    required int listId,
    required int activityId,
    required String drawingNo,
    String? comments,
    int? partNo,
    int? totalParts,
    String? partLabel,
    String? documentType,
    int? qualityUnitId,
    int? vendorId,
    String? vendorName,
    String? elementName,
    String? goDetails,
    List<int>? relatedChecklistInspectionIds,
    List<String>? attachmentDraftIds,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.raiseRfi,
      data: {
        'projectId': projectId,
        'epsNodeId': epsNodeId,
        'listId': listId,
        'activityId': activityId,
        'processCode': 'QA_QC_APPROVAL',
        'drawingNo': drawingNo,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
        if (documentType != null) 'documentType': documentType,
        if (partNo != null) 'partNo': partNo,
        if (totalParts != null) 'totalParts': totalParts,
        if (partLabel != null) 'partLabel': partLabel,
        if (qualityUnitId != null) 'qualityUnitId': qualityUnitId,
        if (vendorId != null) 'vendorId': vendorId,
        if (vendorName != null && vendorName.isNotEmpty) 'vendorName': vendorName,
        if (elementName != null && elementName.isNotEmpty) 'elementName': elementName,
        if (goDetails != null && goDetails.isNotEmpty) 'goDetails': goDetails,
        if (relatedChecklistInspectionIds != null && relatedChecklistInspectionIds.isNotEmpty)
          'relatedChecklistInspectionIds': relatedChecklistInspectionIds,
        if (attachmentDraftIds != null && attachmentDraftIds.isNotEmpty)
          'attachmentDraftIds': attachmentDraftIds,
      },
    );
    return response.data;
  }

  /// Returns checklist/activity groups with selectable RFI children for the
  /// "Link Previous Checklist RFIs" tree picker at this project/location.
  /// Updates the related checklist links on an already-raised inspection.
  /// Only allowed while inspection.status != APPROVED and !isLocked.
  Future<Map<String, dynamic>> updateRelatedChecklists({
    required int inspectionId,
    required List<int> relatedChecklistInspectionIds,
  }) async {
    final response = await _dio.patch(
      '/quality/inspections/$inspectionId/related-checklists',
      data: {'relatedChecklistInspectionIds': relatedChecklistInspectionIds},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getRelatedChecklistOptions({
    required int projectId,
    required int epsNodeId,
    int? excludeInspectionId,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.relatedChecklistOptions,
      queryParameters: {
        'projectId': projectId,
        'epsNodeId': epsNodeId,
        if (excludeInspectionId != null) 'excludeInspectionId': excludeInspectionId,
      },
    );
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  /// Returns whether manual RFI request and approval date backdating is enabled
  /// for this project. When `enabled == true`, show date pickers in the RFI
  /// raise dialog and the stage approval sheet.
  Future<Map<String, dynamic>> getProjectDateSettings(int projectId) async {
    try {
      final response = await _dio.get(
        '/quality/inspections/project-date-settings',
        queryParameters: {'projectId': projectId},
      );
      return response.data as Map<String, dynamic>;
    } catch (_) {
      // If the endpoint isn't available yet (older backend), default to disabled.
      return {'enabled': false, 'globalEnabled': false, 'projectEnabled': false};
    }
  }

  /// Uploads an RFI attachment before the RFI itself exists. [clientUploadId]
  /// must be generated and persisted by the caller before the first attempt
  /// so retries reuse the same UUID — the backend returns the existing draft
  /// unchanged on a repeat upload with the same id (idempotent).
  Future<Map<String, dynamic>> createAttachmentDraft({
    required int projectId,
    required String clientUploadId,
    required String attachmentType,
    required String originalFilePath,
    String? annotatedFilePath,
    String? annotationDataJson,
    void Function(int sent, int total)? onProgress,
  }) async {
    final formData = FormData.fromMap({
      'projectId': projectId.toString(),
      'clientUploadId': clientUploadId,
      'attachmentType': attachmentType,
      'originalFile': await MultipartFile.fromFile(originalFilePath),
      if (annotatedFilePath != null)
        'annotatedFile': await MultipartFile.fromFile(annotatedFilePath),
      if (annotationDataJson != null) 'annotationData': annotationDataJson,
    });
    final response = await _dio.post(
      ApiEndpoints.attachmentDrafts,
      data: formData,
      onSendProgress: onProgress,
    );
    return response.data as Map<String, dynamic>;
  }

  /// Deletes an unused attachment draft (one never bound to an RFI).
  Future<void> deleteAttachmentDraft(String attachmentId) async {
    await _dio.delete(ApiEndpoints.deleteAttachmentDraft(attachmentId));
  }

  /// Lists attachments already bound to an existing inspection.
  Future<List<Map<String, dynamic>>> getInspectionAttachments(
      int inspectionId) async {
    final response =
        await _dio.get(ApiEndpoints.inspectionAttachments(inspectionId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  /// Adds an attachment directly to an existing inspection (same multipart
  /// fields as [createAttachmentDraft], minus [projectId] which the backend
  /// derives from the inspection).
  Future<Map<String, dynamic>> addInspectionAttachment({
    required int inspectionId,
    required String clientUploadId,
    required String attachmentType,
    required String originalFilePath,
    String? annotatedFilePath,
    String? annotationDataJson,
    void Function(int sent, int total)? onProgress,
  }) async {
    final formData = FormData.fromMap({
      'clientUploadId': clientUploadId,
      'attachmentType': attachmentType,
      'originalFile': await MultipartFile.fromFile(originalFilePath),
      if (annotatedFilePath != null)
        'annotatedFile': await MultipartFile.fromFile(annotatedFilePath),
      if (annotationDataJson != null) 'annotationData': annotationDataJson,
    });
    final response = await _dio.post(
      ApiEndpoints.addInspectionAttachment(inspectionId),
      data: formData,
      onSendProgress: onProgress,
    );
    return response.data as Map<String, dynamic>;
  }

  /// Removes an attachment already bound to [inspectionId]. Fails server-side
  /// if the inspection (and therefore its attachments) is locked.
  Future<void> deleteInspectionAttachment({
    required int inspectionId,
    required String attachmentId,
  }) async {
    await _dio.delete(
      ApiEndpoints.deleteInspectionAttachment(inspectionId, attachmentId),
    );
  }

  /// Returns the list of units under a floor EPS node.
  /// Used to populate the unit selector for Unit Wise RFI raising.
  Future<List<Map<String, dynamic>>> getFloorStructure(
      int projectId, int floorId) async {
    final response =
        await _dio.get(ApiEndpoints.floorStructure(projectId, floorId));
    final data = response.data;
    if (data is Map) {
      final units = data['units'] as List<dynamic>? ?? [];
      return units.cast<Map<String, dynamic>>();
    }
    return [];
  }

  /// Updates the status of an inspection (Approve / Reject / Provisional).
  ///
  /// This is the legacy single-step status change, used alongside the
  /// multi-step workflow. [inspectionDate] records when the physical
  /// inspection took place (ISO 8601 string).
  Future<Map<String, dynamic>> updateInspectionStatus({
    required int inspectionId,
    required String status,
    String? comments,
    String? inspectionDate,
  }) async {
    final response = await _dio.patch(
      ApiEndpoints.inspectionStatus(inspectionId),
      data: {
        'status': status,
        if (comments != null) 'comments': comments,
        if (inspectionDate != null) 'inspectionDate': inspectionDate,
      },
    );
    return response.data;
  }

  /// Fetches the multi-step approval workflow state for an inspection.
  ///
  /// Returns `null` instead of throwing when the inspection has no workflow
  /// configured — callers should gracefully degrade to the legacy status UI.
  Future<Map<String, dynamic>?> getInspectionWorkflow(int inspectionId) async {
    try {
      final response =
          await _dio.get(ApiEndpoints.inspectionWorkflow(inspectionId));
      return response.data as Map<String, dynamic>?;
    } catch (_) {
      // Any error (404 if no workflow, network error, etc.) returns null
      // so the UI can fall back to the simple approve/reject path.
      return null;
    }
  }

  /// Advances the workflow to the next step (i.e., approves the current step).
  ///
  /// [signatureData] should be a base64-encoded PNG data URI captured from
  /// the in-app signature pad. The backend stores it against the workflow step.
  /// [signedBy] is the human-readable name stamped onto the approval record.
  Future<Map<String, dynamic>> advanceWorkflowStep({
    required int inspectionId,
    String? signatureData,
    String? signedBy,
    String? comments,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.advanceWorkflow(inspectionId),
      data: {
        if (signatureData != null) 'signatureData': signatureData,
        if (signedBy != null) 'signedBy': signedBy,
        // Only include non-empty comments to avoid overwriting with blank text.
        if (comments != null && comments.isNotEmpty) 'comments': comments,
      },
    );
    return response.data;
  }

  /// Rejects the inspection at the current workflow step.
  ///
  /// [comments] are mandatory on the backend — the UI must enforce this too.
  Future<Map<String, dynamic>> rejectWorkflowStep({
    required int inspectionId,
    required String comments,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.rejectWorkflow(inspectionId),
      data: {'comments': comments},
    );
    return response.data;
  }

  /// Delegates the current pending workflow step to another user.
  ///
  /// Used when an approver is unavailable and nominates a deputy ([toUserId]).
  Future<Map<String, dynamic>> delegateWorkflowStep({
    required int inspectionId,
    required int toUserId,
    String? comments,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.delegateWorkflow(inspectionId),
      data: {
        'toUserId': toUserId,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
      },
    );
    return response.data;
  }

  /// Reverses (undoes) a previously approved workflow step.
  ///
  /// [reason] is mandatory — it is recorded in the audit trail so senior QC
  /// management can understand why an approval was rolled back.
  Future<Map<String, dynamic>> reverseWorkflowStep({
    required int inspectionId,
    required String reason,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.reverseWorkflow(inspectionId),
      data: {'reason': reason},
    );
    return response.data;
  }

  /// Returns only inspections where the current user is the next required approver.
  ///
  /// Scoped to a project so the approvals dashboard does not show records
  /// from unrelated projects.
  Future<List<dynamic>> getMyPendingInspections(int projectId) async {
    final response = await _dio.get(
      ApiEndpoints.myPendingInspections,
      queryParameters: {'projectId': projectId},
    );
    return response.data;
  }

  /// Saves the checked/unchecked status of all items within a single
  /// checklist stage, along with an overall stage status string.
  Future<Map<String, dynamic>> saveInspectionStage({
    required int stageId,
    required String status,
    required List<Map<String, dynamic>> items,
  }) async {
    final response = await _dio.patch(
      ApiEndpoints.inspectionStage(stageId),
      data: {
        'status': status,
        'items': items,
      },
    );
    return response.data;
  }

  /// Approves a single checklist stage through one release-strategy level.
  ///
  /// Called by `ApproveStage` in [QualityApprovalBloc].
  /// The backend `approveStage` handler advances the stage through the next
  /// pending level and auto-grants final inspection approval when all stages
  /// pass all levels.
  Future<Map<String, dynamic>> approveInspectionStage({
    required int inspectionId,
    required int stageId,
    String? comments,
    String? signatureData,
    String? signedBy,
    /// yyyy-MM-dd — only sent when project backdating is enabled.
    String? approvalDate,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.approveStage(inspectionId, stageId),
      data: {
        if (comments != null && comments.isNotEmpty) 'comments': comments,
        if (signatureData != null) 'signatureData': signatureData,
        if (signedBy != null) 'signedBy': signedBy,
        if (approvalDate != null) 'approvalDate': approvalDate,
        if (approvalDate != null)
          'signatureEvidence': {
            'approvalDate': approvalDate,
            'mode': 'SAVED_PROFILE',
          },
      },
    );
    return response.data as Map<String, dynamic>;
  }

  /// Returns QC observations raised against a specific activity.
  ///
  /// Pass [inspectionId] to scope results to a single inspection
  /// (e.g. a specific floor/unit RFI). Without it, the backend returns
  /// all observations for the activity across every floor and unit.
  Future<List<dynamic>> getActivityObservations(
    int activityId, {
    int? inspectionId,
  }) async {
    final queryParams = inspectionId != null
        ? <String, dynamic>{'inspectionId': inspectionId}
        : null;
    final response = await _dio.get(
      ApiEndpoints.activityObservations(activityId),
      queryParameters: queryParams,
    );
    return response.data;
  }

  /// Downloads the PDF inspection report for [inspectionId] as raw bytes.
  Future<List<int>> downloadInspectionReport(int inspectionId) async {
    final response = await _dio.get<List<int>>(
      ApiEndpoints.inspectionReport(inspectionId),
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data ?? [];
  }

  /// Creates a new non-conformance observation linked to an activity.
  ///
  /// Raised by the QC Inspector during or after an inspection.
  /// [photos] should be fully-resolved URLs (after [uploadFile] is called).
  Future<Map<String, dynamic>> raiseObservation({
    required int activityId,
    required String observationText,
    required int inspectionId,
    int? stageId,
    String? type,
    String? observationRating,
    List<String>? photos,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.raiseObservation(activityId),
      data: {
        'observationText': observationText,
        'inspectionId': inspectionId,
        if (stageId != null) 'stageId': stageId,
        if (type != null) 'type': type,
        if (observationRating != null) 'observationRating': observationRating,
        // Only send photos array if it is non-empty to avoid unnecessary payload.
        if (photos != null && photos.isNotEmpty) 'photos': photos,
      },
    );
    return response.data;
  }

  /// Submits rectification evidence for an observation (site engineer action).
  ///
  /// [closureText] describes what corrective action was taken.
  /// [closureEvidence] is a list of photo URLs proving the fix.
  Future<Map<String, dynamic>> resolveObservation({
    required int activityId,
    required String obsId,
    required String closureText,
    List<String>? closureEvidence,
  }) async {
    final response = await _dio.patch(
      ApiEndpoints.resolveObservation(activityId, obsId),
      data: {
        'closureText': closureText,
        if (closureEvidence != null && closureEvidence.isNotEmpty)
          'closureEvidence': closureEvidence,
      },
    );
    return response.data;
  }

  /// Closes an observation after the QC Inspector verifies the rectification.
  ///
  /// This is the final step in the observation lifecycle (Raised → Resolved → Closed).
  Future<Map<String, dynamic>> closeObservation({
    required int activityId,
    required String obsId,
  }) async {
    final response = await _dio.patch(
      ApiEndpoints.closeObservation(activityId, obsId),
    );
    return response.data;
  }

  /// Deletes an activity observation permanently.
  ///
  /// Typically only available to the observation's creator or an admin.
  Future<void> deleteActivityObservation({
    required int activityId,
    required String obsId,
  }) async {
    await _dio.delete(
      ApiEndpoints.deleteActivityObservation(activityId, obsId),
    );
  }

  // ==================== QUALITY SITE OBSERVATIONS ====================

  /// Lists free-form quality site observations with optional server-side filtering.
  ///
  /// Pagination is supported via [limit] and [offset]; the default page size
  /// of 25 keeps initial load times fast on low-bandwidth connections.
  Future<List<dynamic>> getQualitySiteObs({
    required int projectId,
    String? status,
    String? severity,
    int limit = 25,
    int offset = 0,
  }) async {
    // Build params map and add optional filters only when provided.
    final params = <String, dynamic>{
      'projectId': projectId,
      'limit': limit,
      'offset': offset,
    };
    if (status != null) params['status'] = status;
    if (severity != null) params['severity'] = severity;
    final response = await _dio.get(
      ApiEndpoints.qualitySiteObservations,
      queryParameters: params,
    );
    return response.data as List<dynamic>;
  }

  /// Returns a single quality site observation by ID.
  /// Used by NotificationNavigator to deep-link directly from a push notification
  /// into the observation detail page without loading the full list first.
  Future<Map<String, dynamic>> getQualitySiteObsById(int id) async {
    final response =
        await _dio.get(ApiEndpoints.qualitySiteObservation(id.toString()));
    return response.data as Map<String, dynamic>;
  }

  /// Returns a single EHS site observation by ID.
  Future<Map<String, dynamic>> getEhsSiteObsById(int id) async {
    final response =
        await _dio.get(ApiEndpoints.ehsSiteObservation(id.toString()));
    return response.data as Map<String, dynamic>;
  }

  /// Creates a new quality site observation for a project.
  ///
  /// [photoUrls] should already be resolved absolute URLs after uploading
  /// via [uploadFile] — do not pass raw file paths here.
  Future<Map<String, dynamic>> createQualitySiteObs({
    required int projectId,
    int? epsNodeId,
    required String description,
    required String severity,
    String? observationRating,
    String? category,
    String? locationLabel,
    List<String>? photoUrls,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.qualitySiteObservations,
      data: {
        'projectId': projectId,
        if (epsNodeId != null) 'epsNodeId': epsNodeId,
        'description': description,
        'severity': severity,
        if (observationRating != null) 'observationRating': observationRating,
        if (category != null) 'category': category,
        if (locationLabel != null) 'locationLabel': locationLabel,
        // Backend DTO uses 'photos' — not 'photoUrls'
        if (photoUrls != null && photoUrls.isNotEmpty) 'photos': photoUrls,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  /// Permanently deletes a quality site observation.
  Future<void> deleteQualitySiteObs({required String id}) async {
    await _dio.delete(ApiEndpoints.deleteQualitySiteObs(id));
  }

  /// Submits rectification notes and optional evidence photos for a quality
  /// site observation (raised-to-rectified lifecycle transition).
  Future<void> rectifyQualitySiteObs({
    required String id,
    required String notes,
    List<String>? photoUrls,
  }) async {
    await _dio.patch(
      ApiEndpoints.rectifyQualitySiteObs(id),
      data: {
        'notes': notes,
        // Backend DTO uses 'rectificationPhotos' — not 'photoUrls'
        if (photoUrls != null && photoUrls.isNotEmpty)
          'rectificationPhotos': photoUrls,
      },
    );
  }

  /// Closes a quality site observation after rectification is verified.
  Future<void> closeQualitySiteObs({
    required String id,
    String? closureNotes,
  }) async {
    await _dio.patch(
      ApiEndpoints.closeQualitySiteObs(id),
      // Only include closureNotes key if the value is provided.
      data: {if (closureNotes != null) 'closureNotes': closureNotes},
    );
  }

  // ==================== EHS SITE OBSERVATIONS ====================

  /// Lists EHS site observations with optional server-side filtering.
  ///
  /// Mirrors [getQualitySiteObs] in structure; separated because the EHS
  /// module uses different backend routes and entity types.
  Future<List<dynamic>> getEhsSiteObs({
    required int projectId,
    String? status,
    String? severity,
    int limit = 25,
    int offset = 0,
  }) async {
    final params = <String, dynamic>{
      'projectId': projectId,
      'limit': limit,
      'offset': offset,
    };
    if (status != null) params['status'] = status;
    if (severity != null) params['severity'] = severity;
    final response = await _dio.get(
      ApiEndpoints.ehsSiteObservations,
      queryParameters: params,
    );
    final data = response.data;
    if (data is List) return data;
    if (data is Map) {
      final inner = data['data'] ?? data['items'] ?? data['observations'];
      if (inner is List) return inner;
    }
    return [];
  }

  /// Creates a new EHS site observation.
  ///
  /// EHS observations track safety and environmental non-conformances on site,
  /// distinct from QC observations which track workmanship quality.
  Future<Map<String, dynamic>> createEhsSiteObs({
    required int projectId,
    int? epsNodeId,
    required String description,
    required String severity,
    String? category,
    String? locationLabel,
    List<String>? photoUrls,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.ehsSiteObservations,
      data: {
        'projectId': projectId,
        if (epsNodeId != null) 'epsNodeId': epsNodeId,
        'description': description,
        'severity': severity,
        if (category != null) 'category': category,
        if (locationLabel != null) 'locationLabel': locationLabel,
        // Backend DTO uses 'photos' — not 'photoUrls'
        if (photoUrls != null && photoUrls.isNotEmpty) 'photos': photoUrls,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  /// Permanently deletes an EHS site observation.
  Future<void> deleteEhsSiteObs({required String id}) async {
    await _dio.delete(ApiEndpoints.deleteEhsSiteObs(id));
  }

  /// Submits corrective action details for an EHS site observation.
  Future<void> rectifyEhsSiteObs({
    required String id,
    required String notes,
    List<String>? photoUrls,
  }) async {
    await _dio.patch(
      ApiEndpoints.rectifyEhsSiteObs(id),
      data: {
        'notes': notes,
        // Backend DTO uses 'rectificationPhotos' — not 'photoUrls'
        if (photoUrls != null && photoUrls.isNotEmpty)
          'rectificationPhotos': photoUrls,
      },
    );
  }

  /// Closes an EHS site observation after corrective action is verified.
  Future<void> closeEhsSiteObs({
    required String id,
    String? closureNotes,
  }) async {
    await _dio.patch(
      ApiEndpoints.closeEhsSiteObs(id),
      data: {if (closureNotes != null) 'closureNotes': closureNotes},
    );
  }

  /// Returns vendors who have active (ongoing) inspections in the project.
  ///
  /// The raw response is a `List<dynamic>` from JSON, so we cast each element
  /// to `Map<String, dynamic>` to give callers a type-safe list.
  Future<List<Map<String, dynamic>>> getActiveVendors(int projectId) async {
    final response = await _dio.get(
      ApiEndpoints.activeVendors,
      queryParameters: {'projectId': projectId},
    );
    // Cast elements individually; a direct `.cast<>()` on a JSON list is safe here.
    final list = response.data as List<dynamic>? ?? [];
    return list.cast<Map<String, dynamic>>();
  }

  /// Returns the list of users eligible to approve inspections in [projectId].
  /// Used to populate the delegation picker in the inspection detail page.
  Future<List<Map<String, dynamic>>> getEligibleApprovers(int projectId) async {
    final response = await _dio.get(
      ApiEndpoints.eligibleApprovers,
      queryParameters: {'projectId': projectId},
    );
    final list = response.data as List<dynamic>? ?? [];
    return list.cast<Map<String, dynamic>>();
  }

  /// Reserves the next GO number for an existing floor RFI series.
  /// Backend expects projectId/epsNodeId/activityId — NOT inspectionId.
  /// Returns `{previousTotalParts, newTotalParts, nextGoNo, nextGoLabel}` —
  /// raise the reserved GO immediately afterward via [raiseRfi].
  Future<Map<String, dynamic>> addGo({
    required int projectId,
    required int epsNodeId,
    required int activityId,
    int? qualityUnitId,
    int? qualityRoomId,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.addGo,
      data: {
        'projectId': projectId,
        'epsNodeId': epsNodeId,
        'activityId': activityId,
        'qualityUnitId': qualityUnitId,
        'qualityRoomId': qualityRoomId,
      },
    );
    return response.data as Map<String, dynamic>? ?? {};
  }

  // ==================== LABOR ====================

  /// Returns the master list of labour trade categories.
  ///
  /// [projectId] is optional — omitting it returns global categories while
  /// providing it may return project-specific overrides if configured.
  Future<List<dynamic>> getLaborCategories({int? projectId}) async {
    final response = await _dio.get(
      ApiEndpoints.laborCategories,
      queryParameters: {if (projectId != null) 'projectId': projectId},
    );
    return response.data as List<dynamic>;
  }

  /// Returns labour attendance (presence) records for a project on a date.
  ///
  /// [date] should be an ISO 8601 date string (YYYY-MM-DD). Omitting it
  /// typically defaults to today on the backend.
  Future<List<dynamic>> getLaborPresence({
    required int projectId,
    String? date,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.laborPresence(projectId),
      queryParameters: {if (date != null) 'date': date},
    );
    return response.data as List<dynamic>;
  }

  /// Saves an array of labour presence entries for a project on a given date.
  ///
  /// Backend expects `{ entries: [...], userId: N }` — wraps accordingly.
  Future<List<dynamic>> saveLaborPresence({
    required int projectId,
    required List<Map<String, dynamic>> entries,
  }) async {
    final userId = await _tokenManager.getUserId();
    final response = await _dio.post(
      ApiEndpoints.laborPresence(projectId),
      data: {'entries': entries, 'userId': userId ?? 0},
    );
    return response.data as List<dynamic>;
  }

  // ==================== EHS INCIDENTS ====================

  /// Returns all EHS incidents (near-misses, first aid events, LTIs, etc.)
  /// reported for the given project.
  Future<List<dynamic>> getEhsIncidents(int projectId) async {
    final response = await _dio.get(ApiEndpoints.ehsIncidents(projectId));
    final data = response.data;
    if (data is List) return data;
    if (data is Map) {
      final inner = data['data'] ?? data['items'] ?? data['incidents'];
      if (inner is List) return inner;
    }
    return [];
  }

  /// Creates a new EHS incident report.
  ///
  /// [payload] maps directly to the backend's `CreateEhsIncidentDto` —
  /// keeping this as a generic map decouples the client from the DTO shape
  /// and avoids tight coupling when new incident fields are added.
  Future<Map<String, dynamic>> createEhsIncident({
    required int projectId,
    required Map<String, dynamic> payload,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.createEhsIncident(projectId),
      data: payload,
    );
    return response.data as Map<String, dynamic>;
  }

  // ==================== USER PROFILE ====================

  /// Returns the authenticated user's full profile including name, email,
  /// phone, designation, and role assignments.
  Future<Map<String, dynamic>> getUserProfile() async {
    final response = await _dio.get(ApiEndpoints.userMe);
    return response.data as Map<String, dynamic>;
  }

  /// Updates the editable fields on the authenticated user's profile.
  ///
  /// All four fields are required by the backend's PUT handler — send the
  /// current values for fields the user did not change.
  Future<Map<String, dynamic>> updateUserProfile({
    required String displayName,
    required String email,
    required String phone,
    required String designation,
  }) async {
    final response = await _dio.put(ApiEndpoints.userMe, data: {
      'displayName': displayName,
      'email': email,
      'phone': phone,
      'designation': designation,
    });
    return response.data as Map<String, dynamic>;
  }

  /// Returns the user's stored digital signature.
  ///
  /// Response shape: `{signatureData: String, signatureUpdatedAt: String?}`
  /// where `signatureData` is a base64-encoded PNG data URI.
  Future<Map<String, dynamic>> getUserSignature() async {
    final response = await _dio.get(ApiEndpoints.userSignature);
    return response.data as Map<String, dynamic>;
  }

  /// Persists the user's digital signature as a base64 PNG data URI.
  ///
  /// The signature is captured in-app via a drawing pad widget and passed
  /// here directly. It is later fetched by [advanceWorkflowStep] to
  /// pre-populate the approval signature field.
  Future<void> updateUserSignature(String signatureData) async {
    await _dio.put(ApiEndpoints.userSignature, data: {
      'signatureData': signatureData,
    });
  }

  /// Changes the authenticated user's password.
  ///
  /// Throws a [DioException] with status 401 if [currentPassword] is wrong.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _dio.put(ApiEndpoints.userPassword, data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  // ==================== QUALITY POUR CARD ====================

  Future<Map<String, dynamic>> getPourCard(int inspectionId) async {
    final response = await _dio.get(ApiEndpoints.pourCard(inspectionId));
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> savePourCard(
      int inspectionId, Map<String, dynamic> data) async {
    final response =
        await _dio.put(ApiEndpoints.pourCard(inspectionId), data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> submitPourCard(int inspectionId) async {
    final response =
        await _dio.post(ApiEndpoints.pourCardSubmit(inspectionId));
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> approvePourCard(
      int inspectionId, {String? remarks}) async {
    final response = await _dio.post(ApiEndpoints.pourCardApprove(inspectionId),
        data: {'remarks': remarks});
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> rejectPourCard(
      int inspectionId, {String? remarks}) async {
    final response = await _dio.post(ApiEndpoints.pourCardReject(inspectionId),
        data: {'remarks': remarks});
    return response.data as Map<String, dynamic>;
  }

  Future<void> downloadPourCardPdf(int inspectionId, String savePath) async {
    await _dio.download(ApiEndpoints.pourCardPdf(inspectionId), savePath);
  }

  // ==================== QUALITY PRE-POUR CLEARANCE ====================

  Future<Map<String, dynamic>> getClearanceCard(int inspectionId) async {
    final response = await _dio.get(ApiEndpoints.clearanceCard(inspectionId));
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> saveClearanceCard(
      int inspectionId, Map<String, dynamic> data) async {
    final response =
        await _dio.put(ApiEndpoints.clearanceCard(inspectionId), data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> submitClearanceCard(int inspectionId) async {
    final response =
        await _dio.post(ApiEndpoints.clearanceCardSubmit(inspectionId));
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> approveClearanceCard(
      int inspectionId, {String? remarks}) async {
    final response = await _dio.post(
        ApiEndpoints.clearanceCardApprove(inspectionId),
        data: {'remarks': remarks});
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> rejectClearanceCard(
      int inspectionId, {String? remarks}) async {
    final response = await _dio.post(
        ApiEndpoints.clearanceCardReject(inspectionId),
        data: {'remarks': remarks});
    return response.data as Map<String, dynamic>;
  }

  Future<void> downloadClearanceCardPdf(
      int inspectionId, String savePath) async {
    await _dio.download(
        ApiEndpoints.clearanceCardPdf(inspectionId), savePath);
  }

  /// Downloads any file by URL to [savePath].
  /// Resolves relative paths against the server origin before downloading.
  Future<void> downloadFile(
    String url,
    String savePath, {
    void Function(int received, int total)? onProgress,
  }) async {
    final fullUrl = ApiEndpoints.resolveUrl(url);
    await _dio.download(fullUrl, savePath, onReceiveProgress: onProgress);
  }

  /// Generates a QR-code session for a specific clearance card signoff row.
  /// Returns { sessionId, token, deepLink, qrCodeDataUrl, expiresAt, expiresInSeconds, signoff }.
  Future<Map<String, dynamic>> createClearanceSignoffQr({
    required int inspectionId,
    required String signoffId,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.clearanceCardSignoffQr(inspectionId, signoffId),
    );
    return response.data as Map<String, dynamic>;
  }

  /// Uploads a supporting document for a clearance attachment line.
  /// Returns the newly created [ClearanceAttachmentDocument] JSON.
  Future<Map<String, dynamic>> uploadClearanceAttachment({
    required int inspectionId,
    required String lineKey,
    required String filePath,
    required String fileName,
    required String mimeType,
    void Function(int sent, int total)? onProgress,
  }) async {
    final formData = FormData.fromMap({
      'lineKey': lineKey,
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
    });
    // Do NOT set a custom Content-Type — Dio sets multipart/form-data with
    // the correct boundary automatically when data is a FormData object.
    final response = await _dio.post(
      ApiEndpoints.clearanceCardAttachments(inspectionId),
      data: formData,
      onSendProgress: onProgress,
    );
    return response.data as Map<String, dynamic>;
  }

  /// Returns the full Observation/NCR register for a project. Callers
  /// filter client-side for `type == 'NCR'` — the same endpoint also
  /// returns plain 'Observation' rows used elsewhere.
  Future<List<Map<String, dynamic>>> getObservationNcrRegister(int projectId) async {
    final response = await _dio.get(ApiEndpoints.observationNcrRegister(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  /// Updates manual NCR fields (root cause, corrective action, target date,
  /// status). The auto-created-from-observation fields (severity, category,
  /// sourceType/sourceId/sourceReference) are not editable from mobile.
  Future<Map<String, dynamic>> updateObservationNcr(
    int id, {
    String? status,
    String? rootCause,
    String? correctiveAction,
    String? targetDate,
    String? assignedTo,
  }) async {
    final response = await _dio.put(
      ApiEndpoints.observationNcr(id),
      data: {
        if (status != null) 'status': status,
        if (rootCause != null) 'rootCause': rootCause,
        if (correctiveAction != null) 'correctiveAction': correctiveAction,
        if (targetDate != null) 'targetDate': targetDate,
        if (assignedTo != null) 'assignedTo': assignedTo,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  /// Permanently deletes an NCR register entry.
  Future<void> deleteObservationNcr(int id) async {
    await _dio.delete(ApiEndpoints.deleteObservationNcr(id));
  }

  /// Deletes a supporting document from a clearance attachment line.
  Future<void> deleteClearanceAttachment({
    required int inspectionId,
    required String attachmentId,
    required String lineKey,
  }) async {
    await _dio.delete(
      ApiEndpoints.clearanceCardAttachment(inspectionId, attachmentId),
      queryParameters: {'lineKey': lineKey},
    );
  }

  // ==================== QUALITY SNAGS ====================

  // ==================== CONCRETE GRADES ====================

  Future<List<Map<String, dynamic>>> getConcreteGrades(int projectId) async {
    final response = await _dio.get(ApiEndpoints.concreteGrades(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  // ==================== CUBE TEST REGISTER ====================

  Future<List<Map<String, dynamic>>> getCubeTestRegister(int projectId) async {
    final response = await _dio.get(ApiEndpoints.cubeTestRegister(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  Future<Map<String, dynamic>> updateCubeTestRecord(
      int id, Map<String, dynamic> data) async {
    final response = await _dio.put(ApiEndpoints.cubeTestRecord(id), data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> approveCubeTestRecord(int id) async {
    final response = await _dio.post(ApiEndpoints.cubeTestApprove(id));
    return response.data as Map<String, dynamic>;
  }

  // ==================== SNAGS ====================

  Future<List<Map<String, dynamic>>> getSnags(int projectId) async {
    final response = await _dio.get(ApiEndpoints.snags(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  Future<Map<String, dynamic>> createSnag(
      Map<String, dynamic> data) async {
    final response =
        await _dio.post(ApiEndpoints.createSnag, data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateSnag(
      int snagId, Map<String, dynamic> data) async {
    final response =
        await _dio.put(ApiEndpoints.updateSnag(snagId), data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<void> deleteSnag(int snagId) async {
    await _dio.delete(ApiEndpoints.deleteSnag(snagId));
  }

  // ==================== EHS DASHBOARD ====================

  Future<Map<String, dynamic>> getEhsSummary(int projectId) async {
    final response = await _dio.get(ApiEndpoints.ehsSummary(projectId));
    return response.data as Map<String, dynamic>;
  }

  /// Returns the monthly EHS performance records for a project.
  ///
  /// The backend's `getPerformance` returns an ARRAY of monthly
  /// `EhsPerformance` rows (one per month), not a single aggregate object —
  /// the previous `as Map<String, dynamic>` cast here threw on every call.
  Future<List<Map<String, dynamic>>> getEhsPerformance(int projectId) async {
    final response = await _dio.get(ApiEndpoints.ehsPerformance(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    if (data is Map && data['data'] is List) {
      return (data['data'] as List).cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getEhsManhours(int projectId) async {
    final response = await _dio.get(ApiEndpoints.ehsManhours(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    if (data is Map && data['data'] is List) {
      return (data['data'] as List).cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<Map<String, dynamic>> createEhsManhours(
      int projectId, Map<String, dynamic> data) async {
    final response =
        await _dio.post(ApiEndpoints.ehsManhours(projectId), data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getEhsTraining(int projectId) async {
    final response = await _dio.get(ApiEndpoints.ehsTraining(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    if (data is Map && data['data'] is List) {
      return (data['data'] as List).cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<Map<String, dynamic>> createEhsTraining(
      int projectId, Map<String, dynamic> data) async {
    final response =
        await _dio.post(ApiEndpoints.ehsTraining(projectId), data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getEhsLegal(int projectId) async {
    final response = await _dio.get(ApiEndpoints.ehsLegal(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    if (data is Map && data['data'] is List) {
      return (data['data'] as List).cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<Map<String, dynamic>> createEhsLegal(
      int projectId, Map<String, dynamic> data) async {
    final response =
        await _dio.post(ApiEndpoints.ehsLegal(projectId), data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateEhsLegal(
      int projectId, int itemId, Map<String, dynamic> data) async {
    final response = await _dio
        .put(ApiEndpoints.ehsLegalItem(projectId, itemId), data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getEhsMachinery(int projectId) async {
    final response = await _dio.get(ApiEndpoints.ehsMachinery(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    if (data is Map && data['data'] is List) {
      return (data['data'] as List).cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<Map<String, dynamic>> createEhsMachinery(
      int projectId, Map<String, dynamic> data) async {
    final response =
        await _dio.post(ApiEndpoints.ehsMachinery(projectId), data: data);
    return response.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getEhsVehicles(int projectId) async {
    final response = await _dio.get(ApiEndpoints.ehsVehicles(projectId));
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    if (data is Map && data['data'] is List) {
      return (data['data'] as List).cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<Map<String, dynamic>> createEhsVehicle(
      int projectId, Map<String, dynamic> data) async {
    final response =
        await _dio.post(ApiEndpoints.ehsVehicles(projectId), data: data);
    return response.data as Map<String, dynamic>;
  }

  // ==================== DESIGN MODULE ====================

  /// Returns all drawing categories (ARCH, STR, MEP, etc.)
  Future<List<Map<String, dynamic>>> getDrawingCategories() async {
    final response = await _dio.get(ApiEndpoints.designCategories);
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  /// Returns the drawing register for a project, optionally filtered by category.
  Future<List<Map<String, dynamic>>> getDrawingRegister(
    int projectId, {
    int? categoryId,
  }) async {
    final query = categoryId != null ? '?categoryId=$categoryId' : '';
    final response =
        await _dio.get('${ApiEndpoints.designRegister(projectId)}$query');
    final data = response.data;
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  /// Downloads a drawing revision file to [savePath] with progress callback.
  ///
  /// Uses the authenticated Dio instance so the Bearer token is sent.
  /// [onProgress] receives bytes received and total bytes (total may be -1
  /// if the server does not send Content-Length).
  Future<void> downloadDrawingRevision({
    required int projectId,
    required int revisionId,
    required String savePath,
    void Function(int received, int total)? onProgress,
  }) async {
    await _dio.download(
      ApiEndpoints.designDownload(projectId, revisionId),
      savePath,
      onReceiveProgress: onProgress,
    );
  }

  // ==================== TOWER LENS / 3D PROGRESS ====================

  /// Fetches per-floor aggregated progress for all towers in a project.
  ///
  /// This is the Phase 7 optimized endpoint. When available on the backend,
  /// it replaces the N×3 parallel calls done by [TowerProgressRepository].
  /// Falls back gracefully if the endpoint is not yet deployed (returns null).
  Future<Map<String, dynamic>?> getTowerProgress(int projectId) async {
    try {
      final response = await _dio.get(ApiEndpoints.towerProgress(projectId));
      return response.data as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  /// Fetches building coordinate polygons for every EPS node in the project.
  /// Returns the nested tree with [coordinatesText], [coordinateUom], and
  /// [heightMeters] per node. Returns null on failure (coordinates optional).
  Future<Map<String, dynamic>?> getBuildingLineCoordinates(int projectId) async {
    try {
      final response =
          await _dio.get(ApiEndpoints.buildingLineCoordinates(projectId));
      return response.data as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  // ==================== FCM / PUSH NOTIFICATION ====================

  /// Registers the device's FCM token with the backend.
  ///
  /// Must be called after each successful login so the backend can associate
  /// this physical device with the authenticated user for push notifications.
  /// Should also be called when the FCM token rotates (onTokenRefresh callback).
  Future<void> registerFcmToken(String token) async {
    await _dio.post(
      ApiEndpoints.fcmToken,
      data: {'token': token},
    );
  }

  /// Removes the FCM token from the backend so this device stops receiving
  /// push notifications after the user logs out.
  Future<void> clearFcmToken() async {
    await _dio.delete(ApiEndpoints.clearFcmToken);
  }

  /// Fetches version metadata from the backend to decide if an update is needed.
  /// Returns the raw JSON map — no auth required, called before/at login.
  Future<Map<String, dynamic>> getAppConfig({String platform = 'android'}) async {
    final response = await _dio.get(ApiEndpoints.appConfig(platform));
    return response.data as Map<String, dynamic>;
  }

  // ==================== DELTA SYNC ENDPOINTS ====================

  /// GET /sync/progress?projectId=X&since=ISO
  /// Returns `{synced_at, count, data: [...]}`.
  /// Pass [since] = null for a full bootstrap.
  Future<Map<String, dynamic>> deltaProgressSync({
    required int projectId,
    String? since,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.syncProgress(projectId: projectId, since: since),
    );
    return response.data as Map<String, dynamic>;
  }

  /// GET /sync/quality?projectId=X&since=ISO
  /// Returns `{synced_at, count, data: {lists, activities, siteObs}}`.
  Future<Map<String, dynamic>> deltaQualitySync({
    required int projectId,
    String? since,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.syncQuality(projectId: projectId, since: since),
    );
    return response.data as Map<String, dynamic>;
  }

  /// GET /sync/ehs?projectId=X&since=ISO
  /// Returns `{synced_at, count, data: [...]}`.
  Future<Map<String, dynamic>> deltaEhsSync({
    required int projectId,
    String? since,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.syncEhs(projectId: projectId, since: since),
    );
    return response.data as Map<String, dynamic>;
  }

}

/// Dio interceptor that injects the JWT Bearer token into every outgoing
/// request and transparently handles token expiry via a single retry.
///
/// Token flow:
/// 1. [onRequest]: reads the access token from [TokenManager] and adds the
///    `Authorization: Bearer <token>` header.
/// 2. [onError]: on a 401 response, attempts a token refresh once (guarded
///    by the `_retry` extra flag to prevent infinite loops). If refresh
///    succeeds, the original request is replayed with the new token.
///    If refresh fails, tokens are cleared (forces re-login).
class _MutationCacheInvalidationInterceptor extends Interceptor {
  @override
  Future<void> onResponse(
    Response response,
    ResponseInterceptorHandler handler,
  ) async {
    final method = response.requestOptions.method.toUpperCase();
    final statusCode = response.statusCode ?? 0;
    if (method != 'GET' && statusCode >= 200 && statusCode < 400) {
      await SetuApiClient._cacheStore.clean();
    }
    handler.next(response);
  }
}

class _AuthInterceptor extends Interceptor {
  final TokenManager _tokenManager;

  // Reference to the parent Dio instance is needed to replay the failed
  // request after a successful token refresh (cannot use handler.resolve here
  // because we need the full Dio request pipeline to run again).
  final Dio _dio;

  _AuthInterceptor(this._tokenManager, this._dio);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // The login endpoint sends credentials to obtain tokens — there is nothing
    // to inject yet, so skip it to avoid a circular dependency.
    if (options.path.contains('/auth/login')) {
      return handler.next(options);
    }

    final token = await _tokenManager.getAccessToken();
    if (token != null) {
      // Attach the token on this specific request's headers, not globally on
      // _dio.options.headers, to avoid race conditions during token refresh.
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Only attempt refresh on 401 Unauthorized AND only if this is the first
    // attempt for this request. The `_retry` extra flag prevents a refresh
    // loop if the backend keeps returning 401 even with the new token.
    if (err.response?.statusCode == 401 &&
        err.requestOptions.extra['_retry'] != true) {
      final refreshed = await _tokenManager.refreshToken();
      if (refreshed) {
        // Token refresh succeeded — update the failed request's headers and
        // mark it as a retry so the loop-guard above fires next time.
        final token = await _tokenManager.getAccessToken();
        final opts = err.requestOptions
          ..headers['Authorization'] = 'Bearer $token'
          ..extra['_retry'] = true;
        try {
          // Use _dio.fetch to replay the request through the full interceptor
          // chain, which will add a fresh token via onRequest above.
          final response = await _dio.fetch(opts);
          return handler.resolve(response);
        } catch (e) {
          // If the retry itself fails (e.g., network error), fall through
          // to propagate the original error.
          return handler.next(err);
        }
      } else {
        // Refresh token is also expired or invalid — clear all stored tokens
        // so the app's auth state guard redirects the user to the login screen.
        await _tokenManager.clearTokens();
      }
    }
    // For all other errors (or failed refresh), continue normal error handling.
    handler.next(err);
  }
}

/// Dio interceptor that converts every [DioException] into a typed [ApiException].
///
/// This shields the rest of the app from knowing about Dio internals — feature
/// layers only need to catch [ApiException] subtypes.
///
/// Additionally, logs detailed diagnostics for connection errors because raw
/// socket errors are otherwise opaque in Dio's error model.
class _ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // Connection errors (SocketException, etc.) lose detail when wrapped by Dio,
    // so we print the underlying error before it gets normalised, helping debug
    // physical-device vs. emulator networking issues.
    if (err.type == DioExceptionType.connectionError) {
      debugPrint('[ErrorInterceptor] Connection Error Details:');
      debugPrint('[ErrorInterceptor] - Error type: ${err.type}');
      debugPrint('[ErrorInterceptor] - Error object: ${err.error}');
      debugPrint('[ErrorInterceptor] - Error runtimeType: ${err.error?.runtimeType}');
      debugPrint('[ErrorInterceptor] - Error message: ${err.message}');
      debugPrint('[ErrorInterceptor] - Request URL: ${err.requestOptions.uri}');

      // Dig into the underlying OS-level error for extra context (e.g., the
      // exact errno that caused the connection refusal).
      if (err.error != null) {
        final underlyingError = err.error;
        debugPrint('[ErrorInterceptor] - Underlying error: $underlyingError');
        if (underlyingError is SocketException) {
          final socketError = underlyingError;
          debugPrint('[ErrorInterceptor] - SocketException message: ${socketError.message}');
          debugPrint('[ErrorInterceptor] - SocketException OS error: ${socketError.osError}');
        }
      }
    }

    // Convert the DioException to our domain-level ApiException.
    final exception = _convertToApiException(err);

    // Re-wrap in a new DioException with the ApiException as the `.error`
    // field so callers can extract it with `(e.error as ApiException)`.
    handler.next(DioException(
      requestOptions: err.requestOptions,
      response: err.response,
      type: err.type,
      error: exception,
    ));
  }

  /// Maps a [DioException] to the most specific [ApiException] subtype.
  ///
  /// HTTP status codes in the `badResponse` case are mapped to semantic
  /// exception types (e.g., 401 → unauthorized) so that UI layers can
  /// display appropriate messages without parsing raw status codes.
  ApiException _convertToApiException(DioException error) {
    switch (error.type) {
      // All three timeout types (connect, send, receive) map to the same
      // networkError type from the user's perspective.
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException.networkError('Connection timeout');

      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        // Backend error message may be a String or a List<String>; fall back
        // to 'Unknown error' to avoid null reference in the exception message.
        final message = error.response?.data?['message'] ?? 'Unknown error';
        switch (statusCode) {
          case 400:
            return ApiException.badRequest(message);
          case 401:
            // TEMP_EXPIRED is a custom backend signal meaning the user's
            // temporary password session has expired and they must set a
            // permanent password — handled differently from a plain 401.
            if (message == 'TEMP_EXPIRED') {
              return const ApiException.unauthorized('TEMP_EXPIRED');
            }
            return const ApiException.unauthorized();
          case 403:
            return const ApiException.forbidden();
          case 404:
            return const ApiException.notFound();
          case 500:
            return const ApiException.serverError();
          default:
            // Catch-all for uncommon HTTP status codes (e.g., 409 Conflict,
            // 422 Unprocessable Entity) that we have not specialised yet.
            return ApiException.httpError(statusCode ?? 0, message);
        }

      case DioExceptionType.cancel:
        // Request was cancelled programmatically (e.g., user navigated away).
        return const ApiException.cancelled();

      case DioExceptionType.connectionError:
        // No route to host, server unreachable, or no internet connection.
        return const ApiException.networkError('No internet connection');

      default:
        // Catch-all for unknown/future Dio exception types.
        return ApiException.unknown(error.message ?? 'Unknown error');
    }
  }
}
