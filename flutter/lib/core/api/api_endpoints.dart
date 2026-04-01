import 'package:flutter/foundation.dart';

/// Central registry of every REST endpoint path used by the SETU app.
///
/// All paths are relative to [baseUrl] unless otherwise noted.
/// Parameterised routes are exposed as static methods that interpolate IDs
/// directly into the path string — Dio appends these to [baseUrl] at call time.
///
/// Never instantiate this class; it is a pure static namespace.
class ApiEndpoints {
  // Private constructor prevents accidental instantiation.
  ApiEndpoints._();

  // ---------------------------------------------------------------------------
  // Environment / base-URL resolution
  // ---------------------------------------------------------------------------

  // Read at compile time via --dart-define=SETU_ENV=dev|staging|prod.
  // Defaults to 'dev' so the app works out-of-the-box in a dev environment.
  static const String _environment =
      String.fromEnvironment('SETU_ENV', defaultValue: 'dev');

  // Allows the full base URL to be overridden at build time, e.g. when
  // pointing at a specific test server: --dart-define=SETU_BASE_URL=http://192.168.1.50:3000/api
  static const String _baseUrlOverride =
      String.fromEnvironment('SETU_BASE_URL', defaultValue: '');

  // ---------------------------------------------------------------------------
  // Runtime URL override (set by ServerConfigService from SharedPreferences).
  // Takes highest priority — allows testers to change the server without
  // rebuilding the APK. Survives hot-reload; cleared on cold restart unless
  // ServerConfigService re-loads it from SharedPreferences in main().
  // ---------------------------------------------------------------------------
  static String? _runtimeUrl;

  /// Sets the runtime base URL (called by [ServerConfigService] after the user
  /// selects a server in [ServerSetupPage] or on app startup from saved prefs).
  static void setRuntimeUrl(String url) => _runtimeUrl = url.trim();

  /// Clears the runtime override — falls back to compile-time resolution.
  static void clearRuntimeUrl() => _runtimeUrl = null;

  /// The compile-time resolved URL (dart-define chain, no runtime override).
  /// Exposed so [ServerSetupPage] can show it as the "Dev Default" preset.
  static String get compileTimeUrl {
    if (_baseUrlOverride.isNotEmpty) return _baseUrlOverride;
    switch (_environment) {
      case 'prod':    return productionUrl;
      case 'staging': return stagingUrl;
      default:        return devUrl;
    }
  }

  /// The effective base URL used by [SetuApiClient].
  ///
  /// Resolution order (highest priority first):
  /// 1. Runtime override set by [ServerConfigService] (user-selected in UI)
  /// 2. `SETU_BASE_URL` dart-define (build-time explicit override)
  /// 3. Environment-specific constant (`SETU_ENV` dart-define)
  /// 4. Falls back to [devUrl] for any unrecognised environment string.
  static String get baseUrl {
    if (_runtimeUrl != null && _runtimeUrl!.isNotEmpty) return _runtimeUrl!;
    return compileTimeUrl;
  }

  // Production URL (update when deploying)
  static const String productionUrl = 'https://api.setu.example.com/api';
  static const String stagingUrl = 'https://staging-api.setu.example.com/api';

  // Development URL: platform-aware defaults to avoid hardcoded LAN IPs.
  // - Android emulator -> host machine via 10.0.2.2
  // - iOS simulator / desktop / web -> localhost
  // - Physical devices should use SETU_BASE_URL with your machine IP/hostname.
  static String get devUrl {
    // kIsWeb is a compile-time constant — the switch below is skipped on web.
    if (kIsWeb) return 'http://localhost:3000/api';

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        // Android emulator routes "10.0.2.2" to the host machine's loopback,
        // which is where the NestJS server listens on port 3000.
        return 'http://10.0.2.2:3000/api';
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
      case TargetPlatform.fuchsia:
        // All non-Android platforms that run simulators or as desktop apps
        // can reach the local server via the standard loopback address.
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
  /// Submits one or more quantity measurement entries for a project.
  static String measurements(int projectId) =>
      '/execution/$projectId/measurements';

  /// GET /execution/:projectId/logs
  /// Fetches the history of submitted progress logs for a project.
  static String progressLogs(int projectId) => '/execution/$projectId/logs';

  /// PATCH /execution/logs/:logId
  /// Updates the quantity of an existing progress log entry.
  static String updateLog(int logId) => '/execution/logs/$logId';

  /// DELETE /execution/logs/:logId
  /// Permanently removes a progress log entry (typically requires approval role).
  static String deleteLog(int logId) => '/execution/logs/$logId';

  /// GET /execution/breakdown/:activityId/:epsNodeId
  /// Returns how total progress is split across vendors for a specific
  /// activity at a specific EPS node (tower/floor).
  static String executionBreakdown(int activityId, int epsNodeId) =>
      '/execution/breakdown/$activityId/$epsNodeId';

  /// GET /execution/has-micro/:activityId
  /// Quick check — returns {hasMicro: bool} without fetching the full schedule.
  /// Used to decide whether to show the micro-schedule progress entry UI.
  static String hasMicroSchedule(int activityId) =>
      '/execution/has-micro/$activityId';

  /// POST /execution/progress/micro
  /// Saves progress entries that belong to a micro-schedule (sub-activity level).
  static const String saveMicroProgress = '/execution/progress/micro';

  /// GET /execution/:projectId/approvals/pending
  /// Returns logs awaiting approval from the current user's role.
  static String pendingApprovals(int projectId) =>
      '/execution/$projectId/approvals/pending';

  /// POST /execution/approve
  /// Bulk-approve a list of progress log IDs.
  static const String approveMeasurements = '/execution/approve';

  /// POST /execution/reject
  /// Bulk-reject a list of progress log IDs with a mandatory reason.
  static const String rejectMeasurements = '/execution/reject';

  // ==================== MICRO SCHEDULE ENDPOINTS ====================

  /// GET /micro-schedules/delay-reasons
  /// Returns the master list of standard delay reason codes.
  static const String delayReasons = '/micro-schedules/delay-reasons';

  /// POST /micro-schedules
  /// Creates a new micro-schedule (weekly look-ahead plan) for an activity.
  static const String createMicroSchedule = '/micro-schedules';

  /// GET /micro-schedules/:id
  static String microSchedule(int id) => '/micro-schedules/$id';

  /// GET /micro-schedules/project/:projectId
  /// Lists all micro-schedules for a given project.
  static String microSchedulesByProject(int projectId) =>
      '/micro-schedules/project/$projectId';

  /// GET /micro-schedules/activity/:activityId
  /// Lists micro-schedules filtered to a single planning activity.
  static String microSchedulesByActivity(int activityId) =>
      '/micro-schedules/activity/$activityId';

  /// POST /micro-schedules/activities
  /// Creates a new micro-schedule activity (a sub-task under a micro-schedule).
  static const String createMicroActivity = '/micro-schedules/activities';

  /// GET /micro-schedules/activities/:id
  static String microActivity(int id) => '/micro-schedules/activities/$id';

  /// GET /micro-schedules/:id/activities
  /// Returns all micro-schedule activities belonging to a specific schedule.
  static String microScheduleActivities(int microScheduleId) =>
      '/micro-schedules/$microScheduleId/activities';

  // ==================== DAILY LOG ENDPOINTS ====================

  /// POST /micro-schedules/logs
  /// Records a daily progress log entry against a micro-schedule activity.
  static const String createDailyLog = '/micro-schedules/logs';

  /// GET /micro-schedules/logs/:id
  static String dailyLog(int id) => '/micro-schedules/logs/$id';

  /// GET /micro-schedules/activities/:id/logs
  /// Returns all daily logs for a given micro-schedule activity.
  static String activityLogs(int activityId) =>
      '/micro-schedules/activities/$activityId/logs';

  /// GET /micro-schedules/activities/:id/logs/range
  /// Returns daily logs filtered by a date range (query params: from, to).
  static String activityLogsByRange(int activityId) =>
      '/micro-schedules/activities/$activityId/logs/range';

  /// GET /micro-schedules/:id/logs/today
  /// Convenience endpoint — returns only today's logs for a micro-schedule.
  static String todayLogs(int microScheduleId) =>
      '/micro-schedules/$microScheduleId/logs/today';

  /// PATCH /micro-schedules/logs/:id
  static String updateDailyLog(int id) => '/micro-schedules/logs/$id';

  /// DELETE /micro-schedules/logs/:id
  static String deleteDailyLog(int id) => '/micro-schedules/logs/$id';

  // ==================== PLANNING ENDPOINTS ====================

  /// GET /planning/:projectId/execution-ready?wbsNodeId=:epsNodeId
  ///
  /// Returns activities that have been released for on-site execution at the
  /// given EPS node.  The backend recursively includes all descendant EPS
  /// nodes, so passing a floor ID returns that floor's activities AND any
  /// activities from units or sub-zones beneath it.
  /// NOTE: projectId must be the real project ID (not the EPS node ID).
  static String executionReady(int projectId) =>
      '/planning/$projectId/execution-ready';

  /// POST /planning/activities/:id/complete
  /// Marks an activity as fully COMPLETED and sets today as the actual finish date.
  /// Mirrors the web app's "Mark Complete" button on each activity card.
  static String activityComplete(int activityId) =>
      '/planning/activities/$activityId/complete';

  /// GET /planning/projects/:projectId/activities (NOT USED - endpoint does not exist)
  ///
  /// Kept for reference only. Use [executionReady] instead.
  /// Calling this will result in a 404 from the backend.
  static String projectActivities(int projectId) =>
      '/planning/projects/$projectId/activities';

  /// GET /planning/activities/:id
  /// Returns the full detail of a single planning activity by its database ID.
  static String activity(int id) => '/planning/activities/$id';

  // ==================== BOQ ENDPOINTS ====================

  /// GET /boq/project/:projectId
  /// Returns all Bill-of-Quantities entries for a project.
  static String projectBoq(int projectId) => '/boq/project/$projectId';

  /// GET /boq/:id/items
  /// Returns the line items under a specific BOQ document.
  static String boqItems(int boqId) => '/boq/$boqId/items';

  // ==================== URL RESOLVER ====================

  /// Converts a server-relative path (e.g. `/uploads/abc.jpg`) to a fully
  /// qualified URL using the current [baseUrl] origin.
  ///
  /// This is necessary because the backend stores only the path portion of
  /// uploaded file URLs in the database (e.g. `/uploads/uuid.jpg`), but
  /// widgets like `CachedNetworkImage` require absolute `http://...` URLs.
  ///
  /// Absolute URLs (those starting with `http`) are returned unchanged so
  /// that production URLs pointing to CDN hosts are not corrupted.
  static String resolveUrl(String url) {
    if (url.isEmpty) return url;

    // Extract only scheme + host + port from baseUrl, discarding the `/api`
    // path prefix — uploaded files are served from the server root, not /api.
    final base = Uri.parse(baseUrl);

    // Don't include the port when it's the default for the scheme (80 for
    // HTTP, 443 for HTTPS). Tunnel/CDN proxies like ngrok reject explicit
    // default ports (e.g. https://abc.ngrok.io:443 fails, without port works).
    final isDefaultPort = (base.scheme == 'http' && base.port == 80) ||
        (base.scheme == 'https' && base.port == 443) ||
        base.port == 0;
    final origin = isDefaultPort
        ? '${base.scheme}://${base.host}'
        : '${base.scheme}://${base.host}:${base.port}';

    // If the URL is already absolute (http/https), extract just the path so
    // we can rebuild it with the CURRENT server origin. This fixes old records
    // stored in the DB with a stale host (e.g. 10.0.2.2, a dev tunnel URL, or
    // a previous ngrok address) that would fail on real devices / prod.
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        final parsed = Uri.parse(url);
        final path = parsed.path; // e.g. /uploads/uuid.jpg
        return path.startsWith('/') ? '$origin$path' : '$origin/$path';
      } catch (_) {
        return url; // malformed URL: return as-is
      }
    }

    // Relative path — just prepend the current origin.
    return url.startsWith('/') ? '$origin$url' : '$origin/$url';
  }

  // ==================== FILE UPLOAD ENDPOINTS ====================

  /// POST /files/upload
  /// Accepts multipart/form-data with a `file` field and optional metadata.
  static const String uploadFile = '/files/upload';

  /// GET /files/:id
  /// Downloads a previously-uploaded file by its database ID.
  static String downloadFile(int id) => '/files/$id';

  // ==================== QUALITY ENDPOINTS ====================

  /// GET /eps/:projectId/tree
  /// Returns the full nested EPS hierarchy for a project, used to populate
  /// the location picker in the quality inspection form.
  static String epsTree(int projectId) => '/eps/$projectId/tree';

  /// GET /quality/activity-lists?projectId=X&epsNodeId=Y
  /// Returns QC activity lists (checklists) scoped to a project and optionally
  /// a specific EPS node (e.g., filter to a particular floor).
  static const String qualityActivityLists = '/quality/activity-lists';

  /// GET /quality/activity-lists/:listId/activities
  /// Returns the individual checkable activities within a QC activity list.
  static String qualityListActivities(int listId) =>
      '/quality/activity-lists/$listId/activities';

  /// GET /quality/inspections  (query: projectId, epsNodeId?, listId?)
  /// Returns the list of inspection requests (RFIs) with optional filters.
  static const String qualityInspections = '/quality/inspections';

  /// GET /quality/inspections/:id
  /// Returns a single inspection with its full checklist stages and items.
  static String qualityInspection(int id) => '/quality/inspections/$id';

  /// POST /quality/inspections — Raise RFI
  /// Creates a new inspection request against a specific activity and location.
  static const String raiseRfi = '/quality/inspections';

  /// PATCH /quality/inspections/:id/status — Approve / Reject
  /// Used for the legacy single-step approval (non-workflow path).
  static String inspectionStatus(int id) => '/quality/inspections/$id/status';

  /// PATCH /quality/inspections/stage/:stageId — Save checklist stage
  /// Saves the status and item responses for one checklist stage.
  static String inspectionStage(int stageId) =>
      '/quality/inspections/stage/$stageId';

  /// GET /quality/inspections/:id/workflow — Fetch workflow run + steps
  /// Returns the multi-step approval workflow state for an inspection.
  static String inspectionWorkflow(int id) =>
      '/quality/inspections/$id/workflow';

  /// POST /quality/inspections/:id/workflow/advance — Approve current step
  /// Moves the workflow to the next step; optionally attaches a digital signature.
  static String advanceWorkflow(int id) =>
      '/quality/inspections/$id/workflow/advance';

  /// POST /quality/inspections/:id/workflow/reject — Reject via workflow
  /// Rejects the inspection at the current workflow step; comments are mandatory.
  static String rejectWorkflow(int id) =>
      '/quality/inspections/$id/workflow/reject';

  /// POST /quality/inspections/:id/workflow/delegate — Delegate current step
  /// Reassigns the current pending step to another user (e.g., deputy).
  static String delegateWorkflow(int id) =>
      '/quality/inspections/$id/workflow/delegate';

  /// POST /quality/inspections/:id/workflow/reverse — Reverse (undo) approval
  /// Allows a previously-approved step to be undone (admin/senior QC action).
  static String reverseWorkflow(int id) =>
      '/quality/inspections/$id/workflow/reverse';

  /// GET /quality/inspections/my-pending?projectId=X
  /// Returns only inspections where the current user is the next approver.
  static const String myPendingInspections = '/quality/inspections/my-pending';

  /// POST /quality/inspections/:id/stages/:stageId/approve — Sign off a stage
  static String approveStage(int id, int stageId) =>
      '/quality/inspections/$id/stages/$stageId/approve';

  /// POST /quality/inspections/:id/final-approve — Grant final approval
  /// Marks the inspection as fully approved after all workflow steps pass.
  static String finalApprove(int id) =>
      '/quality/inspections/$id/final-approve';

  /// GET /quality/inspections/unit-progress?projectId=X&epsNodeId=Y
  /// Returns per-unit inspection completion percentages for dashboard tiles.
  static const String inspectionUnitProgress =
      '/quality/inspections/unit-progress';

  /// GET /quality/inspections/:id/report — Download PDF report as bytes
  static String inspectionReport(int id) => '/quality/inspections/$id/report';

  /// GET /quality/:projectId/structure/floor/:floorId
  /// Returns the unit/room structure under a specific floor EPS node.
  /// Used to populate the unit selector when raising Unit Wise RFIs.
  static String floorStructure(int projectId, int floorId) =>
      '/quality/$projectId/structure/floor/$floorId';

  /// GET /quality/activities/:id/observations
  /// Returns the list of QC observations raised against a specific activity.
  static String activityObservations(int activityId) =>
      '/quality/activities/$activityId/observations';

  /// POST /quality/activities/:id/observation — Raise observation
  /// Creates a new non-conformance observation linked to an activity (QC Inspector).
  static String raiseObservation(int activityId) =>
      '/quality/activities/$activityId/observation';

  /// PATCH /quality/activities/:actId/observation/:obsId/resolve
  /// Site engineer submits rectification evidence to close an observation.
  static String resolveObservation(int activityId, String obsId) =>
      '/quality/activities/$activityId/observation/$obsId/resolve';

  /// PATCH /quality/activities/:actId/observation/:obsId/close
  /// QC Inspector closes the observation after verifying rectification.
  static String closeObservation(int activityId, String obsId) =>
      '/quality/activities/$activityId/observation/$obsId/close';

  /// DELETE /quality/activities/:actId/observation/:obsId
  static String deleteActivityObservation(int activityId, String obsId) =>
      '/quality/activities/$activityId/observation/$obsId';

  // ==================== QUALITY SITE OBSERVATION ENDPOINTS ====================

  /// GET /quality/site-observations?projectId=X&status=Y&severity=Z
  /// Lists free-form quality site observations with optional filter params.
  static const String qualitySiteObservations = '/quality/site-observations';

  /// GET /quality/site-observations/:id
  /// Returns the detail of a single quality site observation.
  static String qualitySiteObservation(String id) =>
      '/quality/site-observations/$id';

  /// PATCH /quality/site-observations/:id/rectify
  /// Site team submits rectification notes + photos for a quality observation.
  static String rectifyQualitySiteObs(String id) =>
      '/quality/site-observations/$id/rectify';

  /// PATCH /quality/site-observations/:id/close
  /// QC Inspector closes a quality observation after rectification is verified.
  static String closeQualitySiteObs(String id) =>
      '/quality/site-observations/$id/close';

  /// DELETE /quality/site-observations/:id
  static String deleteQualitySiteObs(String id) =>
      '/quality/site-observations/$id';

  // ==================== EHS SITE OBSERVATION ENDPOINTS ====================

  /// GET /ehs/site-observations?projectId=X&status=Y&severity=Z
  /// Lists EHS (Environment, Health & Safety) site observations with filters.
  static const String ehsSiteObservations = '/ehs/site-observations';

  /// GET /ehs/site-observations/:id
  static String ehsSiteObservation(String id) =>
      '/ehs/site-observations/$id';

  /// PATCH /ehs/site-observations/:id/rectify
  /// Site team submits corrective action details for an EHS observation.
  static String rectifyEhsSiteObs(String id) =>
      '/ehs/site-observations/$id/rectify';

  /// PATCH /ehs/site-observations/:id/close
  /// EHS officer closes an observation after corrective action is verified.
  static String closeEhsSiteObs(String id) =>
      '/ehs/site-observations/$id/close';

  /// DELETE /ehs/site-observations/:id
  static String deleteEhsSiteObs(String id) =>
      '/ehs/site-observations/$id';

  /// GET /quality/inspections/active-vendors?projectId=X
  /// Returns vendors who have active (ongoing) inspections in the project.
  /// Used to populate the vendor filter in the approvals dashboard.
  static const String activeVendors = '/quality/inspections/active-vendors';

  // ==================== USER PROFILE ENDPOINTS ====================

  /// GET/PUT /users/me
  /// GET returns the authenticated user's full profile.
  /// PUT accepts updated fields (displayName, email, phone, designation).
  static const String userMe = '/users/me';

  /// GET/PUT /users/me/signature
  /// GET returns {signatureData, signatureUpdatedAt}.
  /// PUT accepts {signatureData} as a base64-encoded PNG data URI.
  static const String userSignature = '/users/me/signature';

  // ==================== FCM / PUSH NOTIFICATION ENDPOINTS ====================

  /// POST /users/fcm-token — Register/update device FCM token
  /// Called after login to ensure the backend can send push notifications to
  /// this specific device.
  static const String fcmToken = '/users/fcm-token';

  // ==================== LABOR ENDPOINTS ====================

  /// GET /labor/categories?projectId=X
  /// Returns the master list of labour trade categories (e.g. Mason, Carpenter).
  static const String laborCategories = '/labor/categories';

  /// GET /labor/presence/:projectId?date=YYYY-MM-DD
  /// Returns labor attendance/presence records for a project on a given date.
  static String laborPresence(int projectId) => '/labor/presence/$projectId';

  // ==================== EHS INCIDENT ENDPOINTS ====================

  /// GET /ehs/:projectId/incidents
  /// Returns all EHS incidents reported for the given project.
  static String ehsIncidents(int projectId) => '/ehs/$projectId/incidents';

  /// POST /ehs/:projectId/incidents
  /// Creates a new EHS incident report (near-miss, first aid, LTI, etc.).
  static String createEhsIncident(int projectId) =>
      '/ehs/$projectId/incidents';

  // ==================== TOWER LENS / 3D PROGRESS ENDPOINTS ====================

  /// GET /planning/:projectId/tower-progress
  /// Returns per-floor aggregated progress for all towers in a project.
  /// Single optimized endpoint replacing N×3 parallel client-side calls.
  static String towerProgress(int projectId) =>
      '/planning/$projectId/tower-progress';

  /// GET /planning/:projectId/building-line-coordinates
  /// Returns the EPS node tree with coordinate polygon, UOM, and height data
  /// for each node (BLOCK / TOWER / FLOOR / UNIT / ROOM).
  /// Used by [IsometricBuildingPainter] to render real building footprints.
  static String buildingLineCoordinates(int projectId) =>
      '/planning/$projectId/building-line-coordinates';
}
