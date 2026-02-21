
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/auth_service.dart';
import 'package:setu_mobile/core/auth/token_manager.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/network/network_info.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/core/sync/connectivity_sync_service.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

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

  // Initialize dependency injection
  initDependencies(
    database: database,
    apiClient: apiClient,
    authService: authService,
    tokenManager: tokenManager,
    networkInfo: networkInfo,
    syncService: syncService,
    connectivitySyncService: connectivitySyncService,
  );

  runApp(const SETUMobileApp());
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
}) {
  // Core services
  sl.registerSingleton<AppDatabase>(database);
  sl.registerSingleton<SetuApiClient>(apiClient);
  sl.registerSingleton<AuthService>(authService);
  sl.registerSingleton<TokenManager>(tokenManager);
  sl.registerSingleton<NetworkInfo>(networkInfo);
  sl.registerSingleton<SyncService>(syncService);
  sl.registerSingleton<ConnectivitySyncService>(connectivitySyncService);

  // BLoCs
  sl.registerFactory(() => AuthBloc(authService: sl()));
  sl.registerFactory(() => ProjectBloc(apiClient: sl(), database: sl()));
  sl.registerFactory(() => ProgressBloc(
        apiClient: sl(),
        database: sl(),
        syncService: sl(),
      ));
}
