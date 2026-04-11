import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/progress/data/models/progress_model.dart';

void main() {
  // ── 1. ProgressEntry instantiation ──────────────────────────────────────────

  test('ProgressEntry can be instantiated with required fields', () {
    final entry = ProgressEntry(
      projectId: 10,
      activityId: 5,
      epsNodeId: 2,
      boqItemId: 3,
      quantity: 12.5,
      date: DateTime(2026, 4, 8),
      createdAt: DateTime(2026, 4, 8),
    );

    expect(entry, isNotNull);
  });

  // ── 2. Key fields are accessible ────────────────────────────────────────────

  test('ProgressEntry key fields are accessible', () {
    final date = DateTime(2026, 4, 8);
    final createdAt = DateTime(2026, 4, 8, 10, 0);

    final entry = ProgressEntry(
      projectId: 10,
      activityId: 5,
      epsNodeId: 2,
      boqItemId: 3,
      quantity: 12.5,
      date: date,
      createdAt: createdAt,
    );

    expect(entry.projectId, 10);
    expect(entry.activityId, 5);
    expect(entry.quantity, 12.5);
    expect(entry.date, date);
    expect(entry.syncStatus, SyncStatus.pending);
    expect(entry.id, isNull);
    expect(entry.serverId, isNull);
  });

  // ── 3. ProgressEntry.fromJson parses correctly ───────────────────────────────

  test('ProgressEntry.fromJson parses required fields', () {
    final json = {
      'projectId': 10,
      'activityId': 5,
      'epsNodeId': 2,
      'boqItemId': 3,
      'quantity': 12.5,
      'date': '2026-04-08T00:00:00.000',
      'createdAt': '2026-04-08T10:00:00.000',
    };

    final entry = ProgressEntry.fromJson(json);

    expect(entry.projectId, 10);
    expect(entry.activityId, 5);
    expect(entry.quantity, 12.5);
  });
}
