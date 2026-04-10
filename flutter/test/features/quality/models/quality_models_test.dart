import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

void main() {
  group('QualitySiteObservation.fromJson', () {
    final json = {
      'id': 'obs-001',
      'projectId': 10,
      'description': 'Crack in column C5',
      'severity': 'HIGH',
      // status is parsed into SiteObsStatus enum via SiteObsStatus.fromString
      'status': 'OPEN',
      'createdAt': '2026-04-01T10:00:00.000Z',
      'updatedAt': '2026-04-01T10:00:00.000Z',
      'photoUrls': <String>[],
    };

    test('parses all required fields', () {
      final obs = QualitySiteObservation.fromJson(json);
      expect(obs.id, 'obs-001');
      expect(obs.projectId, 10);
      expect(obs.description, 'Crack in column C5');
      expect(obs.severity, 'HIGH');
      // status field is SiteObsStatus enum — 'OPEN' maps to SiteObsStatus.open
      expect(obs.status, SiteObsStatus.open);
    });

    test('handles missing optional fields without throwing', () {
      final minimal = {
        'id': 'x',
        'projectId': 1,
        'description': 'd',
        'severity': 'LOW',
        'status': 'OPEN',
        'createdAt': '2026-01-01T00:00:00.000Z',
      };
      expect(() => QualitySiteObservation.fromJson(minimal), returnsNormally);
    });
  });

  group('ActivityDisplayStatus extension', () {
    test('locked has correct label', () {
      expect(ActivityDisplayStatus.locked.label, 'Locked');
    });

    test('approved has correct label', () {
      expect(ActivityDisplayStatus.approved.label, 'Approved');
    });

    test('pendingObservation has correct label', () {
      expect(ActivityDisplayStatus.pendingObservation.label, 'Fix Observation');
    });

    test('every status has a non-null color', () {
      for (final status in ActivityDisplayStatus.values) {
        expect(status.color, isNotNull);
      }
    });
  });
}
