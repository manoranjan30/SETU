import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/labor/data/models/labor_models.dart';

void main() {
  group('LaborCategory.fromJson', () {
    test('parses id and name', () {
      // projectId is not a field on LaborCategory — it is ignored during parsing
      final cat = LaborCategory.fromJson({'id': 1, 'name': 'Masons'});
      expect(cat.id, 1);
      expect(cat.name, 'Masons');
    });
  });

  group('DailyLaborEntry', () {
    test('fromJson parses count and categoryName from nested category object', () {
      // categoryName is read from json['category']['name'], not json['categoryName']
      final entry = DailyLaborEntry.fromJson({
        'categoryId': 1,
        'category': {'name': 'Masons'},
        'count': 5,
        'contractorName': 'ABC',
      });
      expect(entry.count, 5);
      expect(entry.categoryName, 'Masons');
      expect(entry.contractorName, 'ABC');
    });

    test('copyWith updates count and keeps other fields', () {
      final original = DailyLaborEntry(
        categoryId: 1,
        categoryName: 'Masons',
        count: 3,
      );
      final updated = original.copyWith(count: 10);
      expect(updated.count, 10);
      expect(updated.categoryName, 'Masons');
    });

    test('toJson includes the date string passed in', () {
      final entry = DailyLaborEntry(
        categoryId: 1,
        categoryName: 'Masons',
        count: 5,
      );
      final json = entry.toJson('2026-04-08');
      expect(json['date'], '2026-04-08');
      expect(json['count'], 5);
    });
  });
}
