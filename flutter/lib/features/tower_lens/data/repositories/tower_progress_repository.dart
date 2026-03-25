import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/tower_lens/data/models/floor_progress.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_render_model.dart';
import 'package:setu_mobile/features/tower_lens/data/models/tower_view_mode.dart';

/// Builds [TowerRenderModel] objects by aggregating EPS hierarchy,
/// activity completion, and observation data from the API.
///
/// Uses parallel [Future.wait] to minimize total load time.
/// Failures in per-floor detail fetches are swallowed gracefully —
/// the floor falls back to the EPS node's own [progress] field.
class TowerProgressRepository {
  final SetuApiClient _api;

  TowerProgressRepository(this._api);

  /// Fetches and builds render models for all towers in [projectId].
  /// The EPS tree is fetched once, then per-tower and per-floor data
  /// is fetched in parallel to minimize round-trips.
  Future<List<TowerRenderModel>> buildForProject(int projectId) async {
    // 1. Fetch EPS tree — the backend returns a NESTED tree (children array),
    // so we flatten it into a list with parentId references for easy lookup.
    final rawNodes = await _api.getEpsTree(projectId);
    final nodes = <Map<String, dynamic>>[];
    void flattenNode(dynamic node, int? parentId) {
      if (node is! Map<String, dynamic>) return;
      // Normalise: backend uses 'label' in tree response, 'name' in flat response
      final name = (node['name'] ?? node['label'] ?? '').toString();
      // 'data' holds the original EPS entity which carries 'progress'
      final data = node['data'];
      final progress = (data is Map ? data['progress'] : null) ??
          node['progress'];
      nodes.add({
        'id': node['id'],
        'name': name,
        'type': node['type'],
        'parentId': parentId ?? node['parentId'],
        'progress': progress,
      });
      final children = node['children'] as List<dynamic>? ?? [];
      for (final child in children) {
        flattenNode(child, node['id'] as int?);
      }
    }
    for (final raw in rawNodes.whereType<Map<String, dynamic>>()) {
      flattenNode(raw, null);
    }

    // 2. Find TOWER-type nodes first; fall back to BLOCK if no towers
    var towerNodes = nodes
        .where((n) => n['type']?.toString().toUpperCase() == 'TOWER')
        .toList();

    if (towerNodes.isEmpty) {
      towerNodes = nodes
          .where((n) => n['type']?.toString().toUpperCase() == 'BLOCK')
          .toList();
    }

    if (towerNodes.isEmpty) return [];

    // 3. Build render model for each tower in parallel
    final models = await Future.wait(
      towerNodes.map((t) => _buildTowerModel(t, nodes, projectId)),
    );

    return models.whereType<TowerRenderModel>().toList();
  }

  Future<TowerRenderModel?> _buildTowerModel(
    Map<String, dynamic> towerNode,
    List<Map<String, dynamic>> allNodes,
    int projectId,
  ) async {
    final towerId = towerNode['id'] as int? ?? 0;
    final towerName = towerNode['name']?.toString() ?? 'Tower';

    // Find floor children (FLOOR or LEVEL type nodes, or all direct children)
    var floorNodes = allNodes
        .where((n) =>
            n['parentId'] == towerId &&
            (n['type']?.toString().toUpperCase() == 'FLOOR' ||
                n['type']?.toString().toUpperCase() == 'LEVEL'))
        .toList();

    if (floorNodes.isEmpty) {
      // No explicit FLOOR nodes — treat all direct children as floors
      floorNodes = allNodes
          .where((n) => n['parentId'] == towerId)
          .toList();
    }

    if (floorNodes.isEmpty) return null;

    // Sort floors: GF → Floor 1 → Floor 2 … → Terrace
    floorNodes.sort((a, b) =>
        _floorSortKey(a['name']?.toString() ?? '')
            .compareTo(_floorSortKey(b['name']?.toString() ?? '')));

    // Build FloorProgress for each floor in parallel
    final floorProgressList = await Future.wait(
      floorNodes.asMap().entries.map((entry) => _buildFloorProgress(
            epsNodeId: entry.value['id'] as int? ?? 0,
            floorName: entry.value['name']?.toString() ?? 'Floor ${entry.key}',
            floorIndex: entry.key,
            projectId: projectId,
            nodeProgress:
                (entry.value['progress'] as num?)?.toDouble() ?? 0.0,
          )),
    );

    final overall = floorProgressList.isEmpty
        ? 0.0
        : floorProgressList
                .map((f) => f.progressPct)
                .reduce((a, b) => a + b) /
            floorProgressList.length;

    return TowerRenderModel(
      epsNodeId: towerId,
      towerName: towerName,
      floors: floorProgressList,
      overallProgress: overall,
      activeMode: TowerViewMode.progress,
    );
  }

  Future<FloorProgress> _buildFloorProgress({
    required int epsNodeId,
    required String floorName,
    required int floorIndex,
    required int projectId,
    required double nodeProgress,
  }) async {
    try {
      // Fetch activities, quality obs, and EHS obs in parallel
      // Each call is wrapped in catchError so one failure doesn't block others
      final results = await Future.wait([
        _api
            .getExecutionReadyActivities(projectId, epsNodeId)
            .catchError((_) => <dynamic>[]),
        _api
            .getQualitySiteObs(projectId: projectId, limit: 200)
            .catchError((_) => <dynamic>[]),
        _api
            .getEhsSiteObs(projectId: projectId, limit: 200)
            .catchError((_) => <dynamic>[]),
      ]);

      final activities =
          results[0].whereType<Map<String, dynamic>>().toList();
      final allQualityObs =
          results[1].whereType<Map<String, dynamic>>().toList();
      final allEhsObs =
          results[2].whereType<Map<String, dynamic>>().toList();

      // Filter obs to this floor only
      final qualityObs = allQualityObs
          .where((o) =>
              o['epsNodeId'] == epsNodeId ||
              o['locationEpsNodeId'] == epsNodeId)
          .where((o) =>
              (o['status']?.toString().toLowerCase() ?? '') == 'open')
          .toList();

      final ehsObs = allEhsObs
          .where((o) =>
              o['epsNodeId'] == epsNodeId ||
              o['locationEpsNodeId'] == epsNodeId)
          .where((o) =>
              (o['status']?.toString().toLowerCase() ?? '') == 'open')
          .toList();

      // Aggregate activity metrics
      int total = activities.length;
      int completed = 0;
      int inProgress = 0;
      int pending = 0;
      int pendingRfis = 0;
      int rejectedRfis = 0;
      double totalPct = 0;

      for (final act in activities) {
        final status = act['status']?.toString().toLowerCase() ?? '';
        final pct =
            (act['actualProgress'] as num? ?? act['actual_progress'] as num? ?? 0)
                .toDouble();
        totalPct += pct;
        if (status == 'approved' || pct >= 100) completed++;
        else if (status == 'pending' || status == 'in_progress') inProgress++;
        else pending++;
        if (status == 'rejected') rejectedRfis++;
        if (status == 'pending') pendingRfis++;
      }

      final progressPct = total > 0
          ? (totalPct / total).clamp(0.0, 100.0)
          : nodeProgress.clamp(0.0, 100.0);

      // Check for active work today
      final todayStr = _todayIso();
      final hasActiveWork = activities.any((a) =>
          a['lastProgressDate']?.toString().startsWith(todayStr) == true ||
          a['last_progress_date']?.toString().startsWith(todayStr) == true);

      return FloorProgress(
        epsNodeId: epsNodeId,
        floorName: floorName,
        floorIndex: floorIndex,
        progressPct: progressPct,
        totalActivities: total,
        completedActivities: completed,
        pendingActivities: pending,
        inProgressActivities: inProgress,
        openQualityObs: qualityObs.length,
        openEhsObs: ehsObs.length,
        pendingRfis: pendingRfis,
        rejectedRfis: rejectedRfis,
        hasActiveWork: hasActiveWork,
      );
    } catch (_) {
      // Fallback: return a minimal floor using only the EPS node progress
      return FloorProgress.empty(epsNodeId, floorName, floorIndex,
          progressPct: nodeProgress.clamp(0.0, 100.0));
    }
  }

  /// Assigns sort order: GF = 0, numbered floors = their number, Terrace = 9999.
  int _floorSortKey(String name) {
    final lower = name.toLowerCase();
    if (lower == 'gf' || lower.startsWith('ground')) return 0;
    if (lower.contains('terrace') || lower.contains('roof')) return 9999;
    final match = RegExp(r'(\d+)').firstMatch(name);
    return match != null ? int.parse(match.group(1)!) : 5000;
  }

  String _todayIso() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}
