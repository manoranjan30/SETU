import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/tower_lens/data/models/floor_progress.dart';

void main() {
  // ── 1. FloorProgress.fromJson parses floorNumber and progressPercentage ──────

  test('FloorProgress.fromJson parses epsNodeId and progressPct', () {
    final json = {
      'epsNodeId': 42,
      'floorName': 'Floor 5',
      'floorIndex': 5,
      'progressPct': 65.0,
      'totalActivities': 10,
      'completedActivities': 6,
      'pendingActivities': 2,
      'inProgressActivities': 2,
      'openQualityObs': 1,
      'openEhsObs': 0,
      'pendingRfis': 1,
      'rejectedRfis': 0,
      'hasActiveWork': true,
    };

    final fp = FloorProgress.fromJson(json);

    expect(fp.epsNodeId, 42);
    expect(fp.progressPct, 65.0);
    expect(fp.floorName, 'Floor 5');
    expect(fp.floorIndex, 5);
    expect(fp.hasActiveWork, isTrue);
  });

  // ── 2. FloorProgress.fromJson handles missing optional fields ────────────────

  test('FloorProgress.fromJson handles missing optional fields without throwing',
      () {
    // Only required-ish fields — all others have defaults in fromJson
    final json = {
      'epsNodeId': 1,
      'floorName': 'GF',
      'floorIndex': 0,
      'progressPct': 0.0,
    };

    FloorProgress? fp;
    expect(() => fp = FloorProgress.fromJson(json), returnsNormally);

    expect(fp!.coordinatesText, isNull);
    expect(fp!.coordinateUom, isNull);
    expect(fp!.heightMeters, isNull);
    expect(fp!.totalActivities, 0);
    expect(fp!.openQualityObs, 0);
    expect(fp!.openEhsObs, 0);
  });

  // ── 3. FloorProgress.empty factory creates a zero-progress floor ─────────────

  test('FloorProgress.empty creates a floor with no activities', () {
    final fp = FloorProgress.empty(10, 'Terrace', 15);

    expect(fp.epsNodeId, 10);
    expect(fp.floorName, 'Terrace');
    expect(fp.progressPct, 0.0);
    expect(fp.isEmpty, isTrue);
    expect(fp.phase, FloorPhase.notStarted);
  });
}
