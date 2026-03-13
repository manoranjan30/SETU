
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';
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
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_request_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';
import 'package:setu_mobile/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize Firebase (reads google-services.json locally — fast)
  await Firebase.initializeApp();

  // Initialize Hive for local storage
  await Hive.initFlutter();

  // Initialize secure storage
  const secureStorage = FlutterSecureStorage();

  // Initialize database
  final database = AppDatabase();

  // Initialize services
  final tokenManager = TokenManager(secureStorage);
  final networkInfo = NetworkInfo();
  final apiClient = SetuApiClient(tokenManager);
  final authService = AuthService(apiClient, tokenManager);
  final syncService = SyncService(database, apiClient, networkInfo);
  final connectivitySyncService = ConnectivitySyncService(
    networkInfo: networkInfo,
    syncService: syncService,
  );

  final backgroundDownloadService = BackgroundDownloadService(
    apiClient: apiClient,
    database: database,
  );

  // Initialize WorkManager for background WiFi downloads
  await BackgroundDownloadService.initWorkManager();

  // Initialize dependency injection
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

  runApp(const SETUMobileApp());

  // Post-startup non-blocking tasks
  NotificationService().init().catchError(
    (e) => debugPrint('Notification init error: $e'),
  );
  // Clean up old temp photos and trim photo cache to 150 MB cap
  MediaCleanupService().runCleanup().catchError(
    (e) => debugPrint('MediaCleanup error: $e'),
  );
  // Start WiFi listener for auto background download
  backgroundDownloadService.startWifiListener();
  backgroundDownloadService.checkAndRunPendingDownload().catchError(
    (e) => debugPrint('BgDownload check error: $e'),
  );
}

/// Initialize all dependencies using GetIt
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
  sl.registerFactory(() => ProfileBloc(apiClient: sl()));
  sl.registerFactory(() => QualitySiteObsBloc(apiClient: sl()));
  sl.registerFactory(() => EhsSiteObsBloc(apiClient: sl()));
}
