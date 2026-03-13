import 'package:flutter/foundation.dart';

/// API endpoint constants for SETU backend
class ApiEndpoints {
  ApiEndpoints._();

  static const String _environment =
      String.fromEnvironment('SETU_ENV', defaultValue: 'dev');
  static const String _baseUrlOverride =
      String.fromEnvironment('SETU_BASE_URL', defaultValue: '');

  /// Base URL resolved from compile-time environment variables.
  /// Prefer:
  /// `--dart-define=SETU_ENV=dev|staging|prod`
  /// `--dart-define=SETU_BASE_URL=http://host:3000/api` (explicit override)
  static String get baseUrl {
    if (_baseUrlOverride.isNotEmpty) return _baseUrlOverride;

    switch (_environment) {
      case 'prod':
        return productionUrl;
      case 'staging':
        return stagingUrl;
      case 'dev':
      default:
        return devUrl;
    }
  }

  // Production URL (update when deploying)
  static const String productionUrl = 'https://api.setu.example.com/api';
  static const String stagingUrl = 'https://staging-api.setu.example.com/api';

  // Development URL: platform-aware defaults to avoid hardcoded LAN IPs.
  // - Android emulator -> host machine via 10.0.2.2
  // - iOS simulator / desktop / web -> localhost
  // - Physical devices should use SETU_BASE_URL with your machine IP/hostname.
  static String get devUrl {
    if (kIsWeb) return 'http://localhost:3000/api';

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'http://10.0.2.2:3000/api';
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
      case TargetPlatform.fuchsia:
        return 'http://localhost:3000/api';
    }
  }

  // ==================== AUTH ENDPOINTS ====================
  static const String login = '/auth/login';
  static const String profile = '/auth/profile';
  static const String refreshToken = '/auth/refresh';

  // ==================== EPS/PROJECT ENDPOINTS ====================
  // Get all EPS nodes for user (same as web uses)
  static const String myProjects = '/eps';
  static const String epsNode = '/eps'; // /eps/:id
  static const String epsChildren = '/eps'; // /eps/:id/children

  // ==================== EXECUTION/PROGRESS ENDPOINTS ====================
  /// POST /execution/:projectId/measurements
  static String measurements(int projectId) =>
      '/execution/$projectId/measurements';

  /// GET /execution/:projectId/logs
  static String progressLogs(int projectId) => '/execution/$projectId/logs';

  /// PATCH /execution/logs/:logId
  static String updateLog(int logId) => '/execution/logs/$logId';

  /// DELETE /execution/logs/:logId
  static String deleteLog(int logId) => '/execution/logs/$logId';

  /// GET /execution/breakdown/:activityId/:epsNodeId
  static String executionBreakdown(int activityId, int epsNodeId) =>
      '/execution/breakdown/$activityId/$epsNodeId';

  /// GET /execution/has-micro/:activityId
  static String hasMicroSchedule(int activityId) =>
      '/execution/has-micro/$activityId';

  /// POST /execution/progress/micro
  static const String saveMicroProgress = '/execution/progress/micro';

  /// GET /execution/:projectId/approvals/pending
  static String pendingApprovals(int projectId) =>
      '/execution/$projectId/approvals/pending';

  /// POST /execution/approve
  static const String approveMeasurements = '/execution/approve';

  /// POST /execution/reject
  static const String rejectMeasurements = '/execution/reject';

  // ==================== MICRO SCHEDULE ENDPOINTS ====================
  /// GET /micro-schedules/delay-reasons
  static const String delayReasons = '/micro-schedules/delay-reasons';

  /// POST /micro-schedules
  static const String createMicroSchedule = '/micro-schedules';

  /// GET /micro-schedules/:id
  static String microSchedule(int id) => '/micro-schedules/$id';

  /// GET /micro-schedules/project/:projectId
  static String microSchedulesByProject(int projectId) =>
      '/micro-schedules/project/$projectId';

  /// GET /micro-schedules/activity/:activityId
  static String microSchedulesByActivity(int activityId) =>
      '/micro-schedules/activity/$activityId';

  /// POST /micro-schedules/activities
  static const String createMicroActivity = '/micro-schedules/activities';

  /// GET /micro-schedules/activities/:id
  static String microActivity(int id) => '/micro-schedules/activities/$id';

  /// GET /micro-schedules/:id/activities
  static String microScheduleActivities(int microScheduleId) =>
      '/micro-schedules/$microScheduleId/activities';

  // ==================== DAILY LOG ENDPOINTS ====================
  /// POST /micro-schedules/logs
  static const String createDailyLog = '/micro-schedules/logs';

  /// GET /micro-schedules/logs/:id
  static String dailyLog(int id) => '/micro-schedules/logs/$id';

  /// GET /micro-schedules/activities/:id/logs
  static String activityLogs(int activityId) =>
      '/micro-schedules/activities/$activityId/logs';

  /// GET /micro-schedules/activities/:id/logs/range
  static String activityLogsByRange(int activityId) =>
      '/micro-schedules/activities/$activityId/logs/range';

  /// GET /micro-schedules/:id/logs/today
  static String todayLogs(int microScheduleId) =>
      '/micro-schedules/$microScheduleId/logs/today';

  /// PATCH /micro-schedules/logs/:id
  static String updateDailyLog(int id) => '/micro-schedules/logs/$id';

  /// DELETE /micro-schedules/logs/:id
  static String deleteDailyLog(int id) => '/micro-schedules/logs/$id';

  // ==================== PLANNING ENDPOINTS ====================
  /// GET /planning/:epsNodeId/execution-ready
  /// Returns activities ready for on-site execution at the given EPS node.
  /// The backend recursively includes all descendant EPS nodes, so passing
  /// a floor ID returns that floor's activities.
  static String executionReady(int epsNodeId) =>
      '/planning/$epsNodeId/execution-ready';

  /// GET /planning/projects/:projectId/activities (NOT USED - endpoint does not exist)
  /// Kept for reference only. Use executionReady() instead.
  static String projectActivities(int projectId) =>
      '/planning/projects/$projectId/activities';

  /// GET /planning/activities/:id
  static String activity(int id) => '/planning/activities/$id';

  // ==================== BOQ ENDPOINTS ====================
  /// GET /boq/project/:projectId
  static String projectBoq(int projectId) => '/boq/project/$projectId';

  /// GET /boq/:id/items
  static String boqItems(int boqId) => '/boq/$boqId/items';

  // ==================== URL RESOLVER ====================

  /// Converts a server-relative path (e.g. "/uploads/abc.jpg") to a full URL
  /// using the current base URL origin.  Absolute URLs pass through unchanged.
  static String resolveUrl(String url) {
    if (url.isEmpty || url.startsWith('http')) return url;
    final base = Uri.parse(baseUrl);
    final origin = '${base.scheme}://${base.host}:${base.port}';
    return url.startsWith('/') ? '$origin$url' : '$origin/$url';
  }

  // ==================== FILE UPLOAD ENDPOINTS ====================
  /// POST /files/upload
  static const String uploadFile = '/files/upload';

  /// GET /files/:id
  static String downloadFile(int id) => '/files/$id';

  // ==================== QUALITY ENDPOINTS ====================

  /// GET /eps/:projectId/tree
  static String epsTree(int projectId) => '/eps/$projectId/tree';

  /// GET /quality/activity-lists?projectId=X&epsNodeId=Y
  static const String qualityActivityLists = '/quality/activity-lists';

  /// GET /quality/activity-lists/:listId/activities
  static String qualityListActivities(int listId) =>
      '/quality/activity-lists/$listId/activities';

  /// GET /quality/inspections  (query: projectId, epsNodeId?, listId?)
  static const String qualityInspections = '/quality/inspections';

  /// GET /quality/inspections/:id
  static String qualityInspection(int id) => '/quality/inspections/$id';

  /// POST /quality/inspections  → Raise RFI
  static const String raiseRfi = '/quality/inspections';

  /// PATCH /quality/inspections/:id/status  → Approve / Reject
  static String inspectionStatus(int id) => '/quality/inspections/$id/status';

  /// PATCH /quality/inspections/stage/:stageId  → Save checklist stage
  static String inspectionStage(int stageId) =>
      '/quality/inspections/stage/$stageId';

  /// GET /quality/inspections/:id/workflow  → Fetch workflow run + steps
  static String inspectionWorkflow(int id) =>
      '/quality/inspections/$id/workflow';

  /// POST /quality/inspections/:id/workflow/advance  → Approve current step
  static String advanceWorkflow(int id) =>
      '/quality/inspections/$id/workflow/advance';

  /// POST /quality/inspections/:id/workflow/reject  → Reject via workflow
  static String rejectWorkflow(int id) =>
      '/quality/inspections/$id/workflow/reject';

  /// POST /quality/inspections/:id/workflow/delegate  → Delegate current step
  static String delegateWorkflow(int id) =>
      '/quality/inspections/$id/workflow/delegate';

  /// POST /quality/inspections/:id/stages/:stageId/approve  → Sign off a stage
  static String approveStage(int id, int stageId) =>
      '/quality/inspections/$id/stages/$stageId/approve';

  /// POST /quality/inspections/:id/final-approve  → Grant final approval
  static String finalApprove(int id) =>
      '/quality/inspections/$id/final-approve';

  /// GET /quality/inspections/unit-progress?projectId=X&epsNodeId=Y
  static const String inspectionUnitProgress =
      '/quality/inspections/unit-progress';

  /// GET /quality/activities/:id/observations
  static String activityObservations(int activityId) =>
      '/quality/activities/$activityId/observations';

  /// POST /quality/activities/:id/observation  → Raise observation
  static String raiseObservation(int activityId) =>
      '/quality/activities/$activityId/observation';

  /// PATCH /quality/activities/:actId/observation/:obsId/resolve
  static String resolveObservation(int activityId, String obsId) =>
      '/quality/activities/$activityId/observation/$obsId/resolve';

  /// PATCH /quality/activities/:actId/observation/:obsId/close
  static String closeObservation(int activityId, String obsId) =>
      '/quality/activities/$activityId/observation/$obsId/close';

  // ==================== QUALITY SITE OBSERVATION ENDPOINTS ====================

  /// GET /quality/site-observations?projectId=X&status=Y&severity=Z
  static const String qualitySiteObservations = '/quality/site-observations';

  /// GET /quality/site-observations/:id
  static String qualitySiteObservation(String id) =>
      '/quality/site-observations/$id';

  /// PATCH /quality/site-observations/:id/rectify
  static String rectifyQualitySiteObs(String id) =>
      '/quality/site-observations/$id/rectify';

  /// PATCH /quality/site-observations/:id/close
  static String closeQualitySiteObs(String id) =>
      '/quality/site-observations/$id/close';

  /// DELETE /quality/site-observations/:id
  static String deleteQualitySiteObs(String id) =>
      '/quality/site-observations/$id';

  // ==================== EHS SITE OBSERVATION ENDPOINTS ====================

  /// GET /ehs/site-observations?projectId=X&status=Y&severity=Z
  static const String ehsSiteObservations = '/ehs/site-observations';

  /// GET /ehs/site-observations/:id
  static String ehsSiteObservation(String id) =>
      '/ehs/site-observations/$id';

  /// PATCH /ehs/site-observations/:id/rectify
  static String rectifyEhsSiteObs(String id) =>
      '/ehs/site-observations/$id/rectify';

  /// PATCH /ehs/site-observations/:id/close
  static String closeEhsSiteObs(String id) =>
      '/ehs/site-observations/$id/close';

  /// DELETE /ehs/site-observations/:id
  static String deleteEhsSiteObs(String id) =>
      '/ehs/site-observations/$id';

  /// GET /quality/inspections/active-vendors?projectId=X
  static const String activeVendors = '/quality/inspections/active-vendors';

  // ==================== USER PROFILE ENDPOINTS ====================

  /// GET/PUT /users/me
  static const String userMe = '/users/me';

  /// GET/PUT /users/me/signature
  static const String userSignature = '/users/me/signature';

  // ==================== FCM / PUSH NOTIFICATION ENDPOINTS ====================

  /// POST /users/fcm-token  → Register/update device FCM token
  static const String fcmToken = '/users/fcm-token';
}
