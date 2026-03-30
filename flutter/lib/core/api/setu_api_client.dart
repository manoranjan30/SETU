import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
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
///
/// In debug builds, [PrettyDioLogger] is added to print human-readable
/// request/response logs to the console.
///
/// Instantiated once via dependency injection (GetIt) and shared app-wide.
class SetuApiClient {
  final TokenManager _tokenManager;

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
    // 1. _AuthInterceptor  — adds Authorization header before the request leaves.
    // 2. _ErrorInterceptor — maps Dio errors to ApiException after response arrives.
    // 3. PrettyDioLogger   — only in debug builds; logs to console for developer inspection.
    _dio.interceptors.addAll([
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

  /// Fetches the authenticated user's profile from the server.
  ///
  /// Typically called right after login to populate the local user model.
  Future<Map<String, dynamic>> getProfile() async {
    final response = await _dio.get(ApiEndpoints.profile);
    return response.data;
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
  Future<List<dynamic>> getEpsTreeForProject(int projectId) async {
    final response = await _dio.get(ApiEndpoints.epsTree(projectId));
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
  /// All three query params are optional beyond [projectId]; omitting them
  /// returns all inspections across every EPS node and checklist list.
  Future<List<dynamic>> getQualityInspections({
    required int projectId,
    int? epsNodeId,
    int? listId,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.qualityInspections,
      queryParameters: {
        'projectId': projectId,
        if (epsNodeId != null) 'epsNodeId': epsNodeId,
        if (listId != null) 'listId': listId,
      },
    );
    return response.data;
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
      },
    );
    return response.data;
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
  }) async {
    final response = await _dio.post(
      ApiEndpoints.approveStage(inspectionId, stageId),
      data: {
        if (comments != null && comments.isNotEmpty) 'comments': comments,
        if (signatureData != null) 'signatureData': signatureData,
        if (signedBy != null) 'signedBy': signedBy,
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
    List<String>? photos,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.raiseObservation(activityId),
      data: {
        'observationText': observationText,
        'inspectionId': inspectionId,
        if (stageId != null) 'stageId': stageId,
        if (type != null) 'type': type,
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

  /// Creates a new quality site observation for a project.
  ///
  /// [photoUrls] should already be resolved absolute URLs after uploading
  /// via [uploadFile] — do not pass raw file paths here.
  Future<Map<String, dynamic>> createQualitySiteObs({
    required int projectId,
    int? epsNodeId,
    required String description,
    required String severity,
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
    return response.data as List<dynamic>;
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
    return response.data as List<dynamic>;
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
      print('[ErrorInterceptor] Connection Error Details:');
      print('[ErrorInterceptor] - Error type: ${err.type}');
      print('[ErrorInterceptor] - Error object: ${err.error}');
      print('[ErrorInterceptor] - Error runtimeType: ${err.error?.runtimeType}');
      print('[ErrorInterceptor] - Error message: ${err.message}');
      print('[ErrorInterceptor] - Request URL: ${err.requestOptions.uri}');

      // Dig into the underlying OS-level error for extra context (e.g., the
      // exact errno that caused the connection refusal).
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
