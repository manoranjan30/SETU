import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';

void main() {
  group('EhsObsStatus', () {
    test('fromString parses RECTIFIED', () {
      expect(EhsObsStatus.fromString('RECTIFIED'), EhsObsStatus.rectified);
    });

    test('fromString parses CLOSED', () {
      expect(EhsObsStatus.fromString('CLOSED'), EhsObsStatus.closed);
    });

    test('fromString defaults to open for unknown values', () {
      expect(EhsObsStatus.fromString('UNKNOWN'), EhsObsStatus.open);
    });

    test('fromString is case-insensitive', () {
      // fromString uses toUpperCase() internally
      expect(EhsObsStatus.fromString('closed'), EhsObsStatus.closed);
    });

    test('every status has a label and color', () {
      for (final s in EhsObsStatus.values) {
        expect(s.label, isNotEmpty);
        expect(s.color, isNotNull);
      }
    });
  });
}
