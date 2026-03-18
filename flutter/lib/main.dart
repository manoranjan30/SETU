
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/auth_service.dart';
import 'package:setu_mobile/core/auth/token_manager.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/network/network_info.dart';
import 'package:setu_mobile/core/notifications/notification_service.dart';
import 'package:setu_mobile/core/media/media_cleanup_service.dart';
import 'package:setu_mobile/core/sync/background_download_service.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/core/sync/connectivity_sync_service.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_incident_bloc.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import 'package:setu_mobile/features/labor/presentation/bloc/labor_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_dashboard_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';
import 'package:setu_mobile/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/app.dart';

/// Application entry point.
///
/// Initialisation is split into two phases to minimise time-to-first-frame:
///
/// **Phase 1 — blocking (before [runApp]):**
/// Firebase, secure storage, Drift database, all service objects, WorkManager,
/// and GetIt registrations.  These must complete before the widget tree is
/// built because [AuthBloc] reads from secure storage on its first event.
///
/// **Phase 2 — non-blocking (after [runApp]):**
/// Notification channel setup, media cache trim, DB row eviction, and the
/// WiFi background download listener.  These are fire-and-forget tasks that
/// use `catchError` to swallow failures silently — they are maintenance
/// operations that should not interrupt the user experience if they fail.
void main() async {
  // Ensure Flutter engine bindings are ready before calling platform channels.
  // Required whenever async work is done before runApp.
  WidgetsFlutterBinding.ensureInitialized();

  // Set preferred orientations
  // SETU's layouts are optimised for portrait — locking here prevents accidental
  // landscape rotations that would break the EPS and checklist grid layouts.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize Firebase (reads google-services.json locally — fast)
  // Must complete before any FCM or Firestore call is made.
  await Firebase.initializeApp();

  // Initialize secure storage
  // A single shared instance is passed down so that TokenManager and any
  // future services share the same underlying platform channel connection.
  const secureStorage = FlutterSecureStorage();

  // Initialize database
  // AppDatabase is the Drift (SQLite) database.  It is created once here and
  // passed to services that need local persistence — avoids multiple open
  // connections to the same file.
  final database = AppDatabase();

  // Initialize services
  // Construction order matters: TokenManager must exist before ApiClient
  // (which reads the token), and ApiClient before AuthService.
  final tokenManager = TokenManager(secureStorage);
  final networkInfo = NetworkInfo();
  final apiClient = SetuApiClient(tokenManager);
  final authService = AuthService(apiClient, tokenManager);
  final syncService = SyncService(database, apiClient, networkInfo);
  // ConnectivitySyncService listens for network changes and triggers sync
  // automatically when the device regains connectivity.
  final connectivitySyncService = ConnectivitySyncService(
    networkInfo: networkInfo,
    syncService: syncService,
  );

  // BackgroundDownloadService fetches large data sets (e.g. project EPS tree)
  // in the background using WorkManager when the device is on Wi-Fi.
  final backgroundDownloadService = BackgroundDownloadService(
    apiClient: apiClient,
    database: database,
  );

  // Initialize WorkManager for background WiFi downloads
  // Must be called before any WorkManager tasks are enqueued.
  await BackgroundDownloadService.initWorkManager();

  // Initialize dependency injection
  // All services and BLoC factories are registered into GetIt here so the
  // rest of the app can resolve them via sl<T>() without knowing construction details.
  initDependencies(
    database: database,
    apiClient: apiClient,
    authService: authService,
    tokenManager: tokenManager,
    networkInfo: networkInfo,
    syncService: syncService,
    connectivitySyncService: connectivitySyncService,
    backgroundDownloadService: backgroundDownloadService,
  );

  // Hand control to Flutter — the widget tree starts rendering here.
  runApp(const SETUMobileApp());

  // Post-startup non-blocking tasks
  // These run after the first frame is committed, so they never delay startup.
  // Each is wrapped in catchError so a failure in one task cannot crash others.

  // Set up FCM permissions, channels, and listeners.
  NotificationService().init().catchError(
    (e) => debugPrint('Notification init error: $e'),
  );
  // Clean up old temp photos and trim photo cache to 150 MB cap
  // Temp photos accumulate from the camera picker; the cap prevents the
  // device storage from filling up over long field sessions.
  MediaCleanupService().runCleanup().catchError(
    (e) => debugPrint('MediaCleanup error: $e'),
  );
  // Evict cached DB rows older than 30 days to prevent unbounded local growth
  // Drift rows for completed projects would otherwise remain indefinitely.
  database.evictStaleCaches().catchError(
    (e) => debugPrint('DB evict error: $e'),
  );
  // Start WiFi listener for auto background download
  // Registers a connectivity callback that enqueues a WorkManager task
  // whenever the device connects to Wi-Fi.
  backgroundDownloadService.startWifiListener();
  // Also check immediately in case the app launched on Wi-Fi with a pending
  // download that was deferred from a previous session.
  backgroundDownloadService.checkAndRunPendingDownload().catchError(
    (e) => debugPrint('BgDownload check error: $e'),
  );
}

/// Registers all application-wide singletons and BLoC factories into GetIt.
///
/// **Singletons (9):** services with shared mutable state or long-lived
/// platform connections that must not be recreated per use.
///
/// **Factories (8 BLoCs):** each BLoC is registered as a factory so that a
/// fresh instance is created every time a feature screen opens, preventing
/// stale state from a previous navigation session leaking into a new one.
/// BLoCs that hold no long-lived state (e.g. [LaborBloc]) also benefit from
/// garbage collection when the screen is disposed.
void initDependencies({
  required AppDatabase database,
  required SetuApiClient apiClient,
  required AuthService authService,
  required TokenManager tokenManager,
  required NetworkInfo networkInfo,
  required SyncService syncService,
  required ConnectivitySyncService connectivitySyncService,
  required BackgroundDownloadService backgroundDownloadService,
}) {
  // Core services
  // Registered as singletons because they wrap platform resources (DB file,
  // HTTP client, notification channels) that should not be duplicated.
  sl.registerSingleton<AppDatabase>(database);
  sl.registerSingleton<SetuApiClient>(apiClient);
  sl.registerSingleton<NotificationService>(NotificationService());
  sl.registerSingleton<AuthService>(authService);
  sl.registerSingleton<TokenManager>(tokenManager);
  sl.registerSingleton<NetworkInfo>(networkInfo);
  sl.registerSingleton<SyncService>(syncService);
  sl.registerSingleton<ConnectivitySyncService>(connectivitySyncService);
  sl.registerSingleton<BackgroundDownloadService>(backgroundDownloadService);

  // BLoCs
  // Factories ensure each feature screen starts with a clean BLoC state.
  // Dependencies are resolved lazily from the singletons above via sl<T>().
  sl.registerFactory(() => AuthBloc(authService: sl()));
  sl.registerFactory(() => ProjectBloc(apiClient: sl(), database: sl()));
  sl.registerFactory(() => ProgressBloc(
        database: sl(),
        syncService: sl(),
        apiClient: sl(),
      ));
  sl.registerFactory(() => QualityRequestBloc(
        apiClient: sl(),
        database: sl(),
        syncService: sl(),
      ));
  sl.registerFactory(() => QualityApprovalBloc(
        apiClient: sl(),
        syncService: sl(),
      ));
  sl.registerFactory(() => QualityDashboardBloc(apiClient: sl(), database: sl()));
  sl.registerFactory(() => ProfileBloc(apiClient: sl()));
  sl.registerFactory(() => QualitySiteObsBloc(
        apiClient: sl(),
        database: sl(),
        syncService: sl(),
      ));
  sl.registerFactory(() => EhsSiteObsBloc(
        apiClient: sl(),
        database: sl(),
        syncService: sl(),
      ));
  // LaborBloc is API-only (no offline/sync requirement) — no database needed.
  sl.registerFactory(() => LaborBloc(apiClient: sl()));
  // EhsIncidentBloc is API-only — incidents are always submitted online.
  sl.registerFactory(() => EhsIncidentBloc(apiClient: sl()));
}
