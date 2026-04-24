import 'package:mockito/annotations.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/auth_service.dart';
import 'package:setu_mobile/core/auth/token_manager.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/sync/sync_service.dart';
import 'package:setu_mobile/features/tower_lens/data/repositories/tower_progress_repository.dart';

@GenerateMocks([
  SetuApiClient,
  AppDatabase,
  SyncService,
  AuthService,
  TokenManager,
  TowerProgressRepository,
])
void main() {}
