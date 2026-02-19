/// API endpoint constants for SETU backend
class ApiEndpoints {
  ApiEndpoints._();

  /// Base URL - should be configured based on environment
  /// For mobile testing, use your PC's WiFi IP address
  /// Options:
  /// - http://localhost:3000/api (for web/desktop)
  /// - http://192.168.0.101:3000/api (for mobile on same WiFi)
  static const String baseUrl = 'http://192.168.0.101:3000/api';
  
  // Production URL (update when deploying)
  static const String productionUrl = 'https://api.setu.example.com/api';
  
  // Development URL (localhost for web/desktop testing)
  static const String devUrl = 'http://localhost:3000/api';

  // ==================== AUTH ENDPOINTS ====================
  static const String login = '/auth/login';
  static const String profile = '/auth/profile';
  static const String refreshToken = '/auth/refresh';

  // ==================== EPS/PROJECT ENDPOINTS ====================
  // Get all EPS nodes for user (same as web uses)
  static const String myProjects = '/eps';
  static const String epsNode = '/eps';  // /eps/:id
  static const String epsChildren = '/eps';  // /eps/:id/children

  // ==================== EXECUTION/PROGRESS ENDPOINTS ====================
  /// POST /execution/:projectId/measurements
  static String measurements(int projectId) => '/execution/$projectId/measurements';
  
  /// GET /execution/:projectId/logs
  static String progressLogs(int projectId) => '/execution/$projectId/logs';
  
  /// PATCH /execution/logs/:logId
  static String updateLog(int logId) => '/execution/logs/$logId';
  
  /// DELETE /execution/logs/:logId
  static String deleteLog(int logId) => '/execution/logs/$logId';
  
  /// GET /execution/breakdown
  static const String executionBreakdown = '/execution/breakdown';
  
  /// GET /execution/has-micro/:activityId
  static String hasMicroSchedule(int activityId) => '/execution/has-micro/$activityId';
  
  /// POST /execution/progress/micro
  static const String saveMicroProgress = '/execution/progress/micro';
  
  /// GET /execution/:projectId/approvals/pending
  static String pendingApprovals(int projectId) => '/execution/$projectId/approvals/pending';
  
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
  static String microSchedulesByProject(int projectId) => '/micro-schedules/project/$projectId';
  
  /// GET /micro-schedules/activity/:activityId
  static String microSchedulesByActivity(int activityId) => '/micro-schedules/activity/$activityId';
  
  /// POST /micro-schedules/activities
  static const String createMicroActivity = '/micro-schedules/activities';
  
  /// GET /micro-schedules/activities/:id
  static String microActivity(int id) => '/micro-schedules/activities/$id';
  
  /// GET /micro-schedules/:id/activities
  static String microScheduleActivities(int microScheduleId) => '/micro-schedules/$microScheduleId/activities';

  // ==================== DAILY LOG ENDPOINTS ====================
  /// POST /micro-schedules/logs
  static const String createDailyLog = '/micro-schedules/logs';
  
  /// GET /micro-schedules/logs/:id
  static String dailyLog(int id) => '/micro-schedules/logs/$id';
  
  /// GET /micro-schedules/activities/:id/logs
  static String activityLogs(int activityId) => '/micro-schedules/activities/$activityId/logs';
  
  /// GET /micro-schedules/activities/:id/logs/range
  static String activityLogsByRange(int activityId) => '/micro-schedules/activities/$activityId/logs/range';
  
  /// GET /micro-schedules/:id/logs/today
  static String todayLogs(int microScheduleId) => '/micro-schedules/$microScheduleId/logs/today';
  
  /// PATCH /micro-schedules/logs/:id
  static String updateDailyLog(int id) => '/micro-schedules/logs/$id';
  
  /// DELETE /micro-schedules/logs/:id
  static String deleteDailyLog(int id) => '/micro-schedules/logs/$id';

  // ==================== PLANNING ENDPOINTS ====================
  /// GET /planning/projects/:projectId/activities
  static String projectActivities(int projectId) => '/planning/projects/$projectId/activities';
  
  /// GET /planning/activities/:id
  static String activity(int id) => '/planning/activities/$id';

  // ==================== BOQ ENDPOINTS ====================
  /// GET /boq/project/:projectId
  static String projectBoq(int projectId) => '/boq/project/$projectId';
  
  /// GET /boq/:id/items
  static String boqItems(int boqId) => '/boq/$boqId/items';

  // ==================== FILE UPLOAD ENDPOINTS ====================
  /// POST /files/upload
  static const String uploadFile = '/files/upload';
  
  /// GET /files/:id
  static String downloadFile(int id) => '/files/$id';
}
