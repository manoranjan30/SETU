import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/quality/data/batch_slip_parser.dart';

void main() {
  group('parseBatchSlipText — SRT Tech style numbered delivery challan', () {
    // Reconstructed from a real slip: "SRT TECH BUILDING SOLUTIONS" /
    // Kalpataru Projects site. Rows are "N. Label" then, on ML Kit's own
    // recognized line, the value — this is the layout produced when a wide
    // two-column ruled table gets split into separate lines per cell,
    // which is the failure mode that prompted this fix (labels and values
    // used to have to be on the very same match span with no words or line
    // breaks between them).
    const labelThenValueOnNextLine = '''
SRT TECH BUILDING SOLUTIONS
Project Site : KALPATARU PROJECTS INTERNATIONAL LIMITED.
PROVIDENT EQUINOX, BANGALURU.
GSTIN No.: 29AEAFS9284A1ZU
1. Sl. No
9903
2. Sent to
(PEN-2)
3. Transit Mixer No.
KA51B9270
4. Date of Despatch
30/07/26
5. Time of Despatch
13:28
6. Time of Receipt at Site
7. Time of Release From Site
8. Time of Reached at Plant
9. Grade of Concrete
M30 (50%)
10. Quantity of this sheet
06.00 M3
11. Cum. Concrete Qty. Upto this sheet
78.00 M3 84.90
Receiver's Signature
Plant Incharge
''';

    // Same content, but with label and value sharing one recognized line
    // (e.g. narrower table, or ML Kit grouping the row as one block) —
    // must keep working exactly as before.
    const labelAndValueSameLine = '''
SRT TECH BUILDING SOLUTIONS
1. Sl. No 9903
2. Sent to (PEN-2)
3. Transit Mixer No. KA51B9270
4. Date of Despatch 30/07/26
5. Time of Despatch 13:28
9. Grade of Concrete M30 (50%)
10. Quantity of this sheet 06.00 M3
11. Cum. Concrete Qty. Upto this sheet 78.00 M3 84.90
''';

    for (final entry in {
      'label and value on separate OCR lines': labelThenValueOnNextLine,
      'label and value on the same OCR line': labelAndValueSameLine,
    }.entries) {
      group(entry.key, () {
        final result = parseBatchSlipText(entry.value);

        test('reads the transit mixer number as the truck no.', () {
          expect(result.truckNo.value, 'KA51B9270');
          expect(result.truckNo.confidence, BatchSlipFieldConfidence.high);
        });

        test('reads "Sl. No" as the delivery challan number', () {
          expect(result.deliveryChallanNo.value, '9903');
        });

        test('reads "Grade of Concrete" despite the filler words', () {
          expect(result.mixIdOrGrade.value, 'M30');
          expect(result.mixIdOrGrade.confidence, BatchSlipFieldConfidence.high);
        });

        test('reads "Quantity of this sheet" (06.00), not the cumulative figure (78.00)', () {
          expect(result.quantityM3.value, 6.0);
          expect(result.quantityM3.confidence, BatchSlipFieldConfidence.high);
        });

        test('reads the dispatch time', () {
          expect(result.batchStartTime.value, '13:28');
        });
      });
    }

    test('accepts an apostrophe as a misread colon in a handwritten time', () {
      final result = parseBatchSlipText('5. Time of Despatch\n13\'28\n');
      expect(result.batchStartTime.value, '13:28');
    });
  });

  group('parseBatchSlipText — dot-matrix batching-plant recipe printout', () {
    // Reconstructed from a real slip: a raw per-batch "Recipe" report
    // (Aggregate/Cement/Filler/Water/Admixture columns), which is a
    // different document from the delivery challan above — it has no
    // truck/grade fields at all, only a total quantity line.
    const dotMatrixRecipeReport = '''
SBC
Date       Time      Recipe    Cement Filler  Water Mo Corr  Admixture
30.07.26  13:23      0030
Aggregate
Totalqty    6.00   M3
01  02  03  04  01  02  01     01   %  Lit    01    02
''';

    test('finds the total quantity via the "qty" substring inside "Totalqty"', () {
      final result = parseBatchSlipText(dotMatrixRecipeReport);
      expect(result.quantityM3.value, 6.0);
      expect(result.quantityM3.confidence, BatchSlipFieldConfidence.high);
    });

    test('does not fabricate a grade or truck number that was never printed', () {
      final result = parseBatchSlipText(dotMatrixRecipeReport);
      expect(result.mixIdOrGrade.isMatched, isFalse);
      expect(result.truckNo.isMatched, isFalse);
    });
  });

  group('parseBatchSlipText — grade fallback', () {
    test('falls back to a bare grade token when no label is nearby', () {
      final result = parseBatchSlipText('Some unrelated header text\nM30\nmore text');
      expect(result.mixIdOrGrade.value, 'M30');
      expect(result.mixIdOrGrade.confidence, BatchSlipFieldConfidence.low);
    });
  });

  group('parseBatchSlipText — regression: original tightly-labeled slip format', () {
    const classicSlip = '''
ABC READY MIX CONCRETE
Plant: Bangalore North RMC
Truck No: KA05MX4321
Delivery Challan No: DC-88214
Grade: M25
Slump: 100mm
Batch Time: 09:45
Qty Delivered: 6.5 m3
''';

    test('still extracts every field from a classic tightly-labeled slip', () {
      final result = parseBatchSlipText(classicSlip);
      expect(result.truckNo.value, 'KA05MX4321');
      expect(result.deliveryChallanNo.value, 'DC-88214');
      expect(result.mixIdOrGrade.value, 'M25');
      expect(result.slumpMm.value, 100.0);
      expect(result.batchStartTime.value, '09:45');
      expect(result.quantityM3.value, 6.5);
      expect(result.supplierName.value, 'Bangalore North RMC');
    });
  });
}
