import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/tower_lens/data/models/floor_progress.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_view_mode.dart';

/// Builds [TowerRenderModel] objects from the two optimized backend endpoints:
///   1. GET /planning/:id/tower-progress   — aggregated progress per floor
///   2. GET /planning/:id/building-line-coordinates — real polygon per EPS node
///
/// Both calls are fired in parallel. Coordinate data is merged into each
/// [FloorProgress] so [IsometricBuildingPainter] can render the actual
/// building footprint instead of the generic diamond fallback.
class TowerProgressRepository {
  final SetuApiClient _api;

  TowerProgressRepository(this._api);

  /// Fetches and builds render models for all towers in [projectId].
  Future<List<TowerRenderModel>> buildForProject(int projectId) async {
    // Fire both endpoints in parallel
    final progressFuture = _api.getTowerProgress(projectId).catchError((_) => null);
    final coordFuture =
        _api.getBuildingLineCoordinates(projectId).catchError((_) => null);

    final progressData = await progressFuture;
    final coordData = await coordFuture;

    // Build a flat lookup: epsNodeId → coordinate fields
    final coordMap = <int, Map<String, dynamic>>{};
    if (coordData != null) {
      _flattenCoordTree(coordData, coordMap);
    }

    if (progressData == null) return [];

    final towersJson =
        (progressData['towers'] as List?)?.whereType<Map<String, dynamic>>() ??
            [];

    return towersJson
        .map((t) => _parseTower(t, coordMap))
        .whereType<TowerRenderModel>()
        .toList();
  }

  // ─── Tower parsing ─────────────────────────────────────────────────────────

  TowerRenderModel? _parseTower(
    Map<String, dynamic> towerJson,
    Map<int, Map<String, dynamic>> coordMap,
  ) {
    final towerId =
        towerJson['epsNodeId'] as int? ?? towerJson['eps_node_id'] as int? ?? 0;
    final towerName =
        towerJson['towerName']?.toString() ?? towerJson['tower_name']?.toString() ?? 'Tower';

    final floorsJson =
        (towerJson['floors'] as List?)?.whereType<Map<String, dynamic>>() ?? [];

    if (floorsJson.isEmpty) return null;

    final floors = floorsJson.toList().asMap().entries.map((entry) {
      final floorJson = entry.value;
      final fp = FloorProgress.fromJson(floorJson);
      final coords = coordMap[fp.epsNodeId];
      if (coords == null) return fp;
      // Merge coordinate data into FloorProgress
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

  /// Recursively flattens the building-line-coordinates tree into a map
  /// keyed by epsNodeId for O(1) lookup when building FloorProgress objects.
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
          'coordinateUom':
              node['coordinateUom']?.toString() ?? node['coordinate_uom']?.toString() ?? 'mm',
          'heightMeters':
              node['heightMeters'] ?? node['height_meters'],
        };
      }
    }

    // Recurse into children
    final children = node['children'] as List<dynamic>? ?? [];
    for (final child in children) {
      _flattenCoordTree(child, out);
    }
  }
}
