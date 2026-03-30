import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/sync/background_download_service.dart';
import 'package:setu_mobile/features/tower_lens/data/models/floor_progress.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_view_mode.dart';

/// Builds [TowerRenderModel] objects from the two optimized backend endpoints:
///   1. GET /planning/:id/tower-progress   — aggregated progress per floor
///   2. GET /planning/:id/building-line-coordinates — real polygon per EPS node
///
/// **Offline strategy (stale-while-revalidate):**
///
/// Both API calls are fired in parallel. If either (or both) fail due to
/// network issues, the repository falls back to the data previously downloaded
/// by [BackgroundDownloadService] and stored in SharedPreferences.
///
/// This means the Tower Lens view works fully offline provided a background
/// download has run at least once (on WiFi or via manual "Download now").
/// [isFromCache] on the returned models indicates the data source.
class TowerProgressRepository {
  final SetuApiClient _api;

  TowerProgressRepository(this._api);

  /// Fetches and builds render models for all towers in [projectId].
  ///
  /// Returns a tuple-like result object so callers know whether live or cached
  /// data was used (to show the offline indicator chip).
  Future<TowerProgressResult> buildForProject(int projectId) async {
    // Fire both endpoints in parallel; swallow errors so we can fall back.
    final progressFuture =
        _api.getTowerProgress(projectId).catchError((_) => null);
    final coordFuture =
        _api.getBuildingLineCoordinates(projectId).catchError((_) => null);

    final progressData = await progressFuture;
    final coordData = await coordFuture;

    bool fromCache = false;

    // Determine effective data — prefer live, fall back to SharedPrefs cache.
    final effectiveProgress =
        progressData ?? await _loadCachedTowerProgress(projectId);
    final effectiveCoords =
        coordData ?? await _loadCachedBuildingCoords(projectId);

    if (effectiveProgress == null) {
      return const TowerProgressResult(models: [], isFromCache: false);
    }

    // If any data came from cache, flag the result.
    if (progressData == null || coordData == null) {
      fromCache = true;
    }

    // When online and live data arrived, persist it so the offline cache stays
    // fresh — this is the "always update cache when online" requirement.
    if (progressData != null) {
      _persistTowerProgress(projectId, progressData);
    }
    if (coordData != null) {
      _persistBuildingCoords(projectId, coordData);
    }

    final coordMap = <int, Map<String, dynamic>>{};
    if (effectiveCoords != null) {
      _flattenCoordTree(effectiveCoords, coordMap);
    }

    final towersJson =
        (effectiveProgress['towers'] as List?)
            ?.whereType<Map<String, dynamic>>() ??
            [];

    final models = towersJson
        .map((t) => _parseTower(t, coordMap))
        .whereType<TowerRenderModel>()
        .toList();

    return TowerProgressResult(models: models, isFromCache: fromCache);
  }

  // ─── SharedPreferences cache access ────────────────────────────────────────

  /// Read tower progress from SharedPreferences (written by BackgroundDownloadService).
  Future<Map<String, dynamic>?> _loadCachedTowerProgress(int projectId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final json =
          prefs.getString(BackgroundDownloadService.towerProgressKey(projectId));
      if (json == null) return null;
      return jsonDecode(json) as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  /// Read building coordinates from SharedPreferences.
  Future<Map<String, dynamic>?> _loadCachedBuildingCoords(int projectId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final json = prefs
          .getString(BackgroundDownloadService.buildingCoordsKey(projectId));
      if (json == null) return null;
      return jsonDecode(json) as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  /// Persist fresh live data to SharedPreferences so the offline cache stays
  /// up-to-date whenever the user is online.
  void _persistTowerProgress(
      int projectId, Map<String, dynamic> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          BackgroundDownloadService.towerProgressKey(projectId),
          jsonEncode(data));
    } catch (_) {}
  }

  void _persistBuildingCoords(
      int projectId, Map<String, dynamic> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          BackgroundDownloadService.buildingCoordsKey(projectId),
          jsonEncode(data));
    } catch (_) {}
  }

  // ─── Tower parsing ─────────────────────────────────────────────────────────

  TowerRenderModel? _parseTower(
    Map<String, dynamic> towerJson,
    Map<int, Map<String, dynamic>> coordMap,
  ) {
    final towerId =
        towerJson['epsNodeId'] as int? ?? towerJson['eps_node_id'] as int? ?? 0;
    final towerName = towerJson['towerName']?.toString() ??
        towerJson['tower_name']?.toString() ??
        'Tower';

    final floorsJson =
        (towerJson['floors'] as List?)?.whereType<Map<String, dynamic>>() ?? [];
    if (floorsJson.isEmpty) return null;

    final floors = floorsJson.toList().asMap().entries.map((entry) {
      final floorJson = entry.value;
      final fp = FloorProgress.fromJson(floorJson);
      final coords = coordMap[fp.epsNodeId];
      if (coords == null) return fp;
      return fp.copyWith(
        coordinatesText: coords['coordinatesText']?.toString(),
        coordinateUom: coords['coordinateUom']?.toString() ?? 'mm',
        heightMeters: (coords['heightMeters'] as num?)?.toDouble(),
      );
    }).toList();

    final overall = floors.isEmpty
        ? 0.0
        : floors.map((f) => f.progressPct).reduce((a, b) => a + b) /
            floors.length;

    return TowerRenderModel(
      epsNodeId: towerId,
      towerName: towerName,
      floors: floors,
      overallProgress: overall,
      activeMode: TowerViewMode.progress,
    );
  }

  // ─── Coordinate tree flattening ────────────────────────────────────────────

  void _flattenCoordTree(
    dynamic node,
    Map<int, Map<String, dynamic>> out,
  ) {
    if (node is! Map<String, dynamic>) return;

    final id = node['id'] as int? ?? node['epsNodeId'] as int?;
    if (id != null) {
      final coordsText = node['coordinatesText']?.toString() ??
          node['coordinates_text']?.toString();
      if (coordsText != null && coordsText.isNotEmpty) {
        out[id] = {
          'coordinatesText': coordsText,
          'coordinateUom': node['coordinateUom']?.toString() ??
              node['coordinate_uom']?.toString() ??
              'mm',
          'heightMeters': node['heightMeters'] ?? node['height_meters'],
        };
      }
    }

    final children = node['children'] as List<dynamic>? ?? [];
    for (final child in children) {
      _flattenCoordTree(child, out);
    }
  }
}

/// Result returned by [TowerProgressRepository.buildForProject].
///
/// [isFromCache] is `true` when either the tower progress or building
/// coordinate data came from the SharedPreferences offline cache rather than
/// a live API response.  The Tower Lens BLoC uses this flag to show the
/// offline indicator chip in the UI.
class TowerProgressResult {
  final List<TowerRenderModel> models;
  final bool isFromCache;

  const TowerProgressResult({
    required this.models,
    required this.isFromCache,
  });
}
