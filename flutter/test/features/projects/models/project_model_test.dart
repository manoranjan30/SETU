import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

void main() {
  group('Project.fromJson', () {
    final json = {
      'id': 10,
      'name': 'Purva Bliss',
      'code': 'PB-001',
      'status': 'ACTIVE',
      'progress': 45.5,
      'startDate': '2025-01-01T00:00:00.000Z',
      'children': <dynamic>[],
    };

    test('parses id and name', () {
      final p = Project.fromJson(json);
      expect(p.id, 10);
      expect(p.name, 'Purva Bliss');
    });

    test('parses progress as double', () {
      final p = Project.fromJson(json);
      expect(p.progress, 45.5);
    });

    test('handles null startDate without throwing', () {
      final j = Map<String, dynamic>.from(json)..['startDate'] = null;
      expect(() => Project.fromJson(j), returnsNormally);
    });

    test('toJson round-trip preserves id and name', () {
      final p = Project.fromJson(json);
      final reparsed = Project.fromJson(p.toJson());
      expect(reparsed.id, p.id);
      expect(reparsed.name, p.name);
    });
  });
}
