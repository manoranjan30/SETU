/// Regex-based field extraction for concrete batching-plant slips.
///
/// Deliberately regex-only, no LLM in the loop: batch slips are printed
/// from a small number of batching-plant software templates, so a label →
/// value pattern match covers the common case cheaply and works fully
/// offline. A field that doesn't match is simply left blank for manual
/// entry — there is no confidence-scored LLM fallback in this first cut;
/// [BatchSlipExtraction.matchedFieldCount] is exposed so accuracy can be
/// judged from real slips before deciding whether one is worth adding.
library;

/// Fields pulled out of a batch slip's OCR text, matched 1:1 to
/// [PourCardEntry] fields the pour card entry form already has controllers
/// for. Every field is best-effort and nullable — the caller only prefills
/// controllers that are currently empty, never overwrites user input.
class BatchSlipExtraction {
  final String? truckNo;
  final String? deliveryChallanNo;
  final String? mixIdOrGrade;
  final double? quantityM3;
  final double? slumpMm;
  final String? batchStartTime;
  final String? supplierName;

  const BatchSlipExtraction({
    this.truckNo,
    this.deliveryChallanNo,
    this.mixIdOrGrade,
    this.quantityM3,
    this.slumpMm,
    this.batchStartTime,
    this.supplierName,
  });

  int get matchedFieldCount => [
        truckNo,
        deliveryChallanNo,
        mixIdOrGrade,
        quantityM3,
        slumpMm,
        batchStartTime,
        supplierName,
      ].where((v) => v != null).length;

  bool get isEmpty => matchedFieldCount == 0;
}

/// Parses raw OCR text (as returned by [BatchSlipOcrService.recognizeText])
/// into whatever [BatchSlipExtraction] fields it can confidently find.
///
/// Matching is intentionally permissive on label wording (plants print
/// "Truck No" / "Vehicle No" / "Veh. No." interchangeably, "Qty" / "Volume"
/// / "Quantity", etc.) but strict on the value shape, so a near-miss label
/// next to garbage OCR output doesn't produce a wrong value silently.
BatchSlipExtraction parseBatchSlipText(String text) {
  if (text.trim().isEmpty) return const BatchSlipExtraction();

  String? firstMatch(RegExp pattern) {
    final m = pattern.firstMatch(text);
    final value = m?.group(1)?.trim();
    return (value == null || value.isEmpty) ? null : value;
  }

  double? firstMatchDouble(RegExp pattern) {
    final raw = firstMatch(pattern);
    return raw == null ? null : double.tryParse(raw);
  }

  final truckNo = firstMatch(RegExp(
    r'(?:truck|vehicle|veh)\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z]{2}\s?-?\s?\d{1,2}\s?-?\s?[A-Z]{0,2}\s?-?\s?\d{3,4}|[A-Z0-9]{4,10})',
    caseSensitive: false,
  ));

  final challan = firstMatch(RegExp(
    r'(?:delivery\s*)?(?:challan|d\.?\s?c\.?|ticket|slip|docket)\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9\-/]{2,15})',
    caseSensitive: false,
  ));

  final grade = firstMatch(RegExp(
    r'(?:grade|mix(?:\s*id)?|concrete\s*grade)\s*[:\-]?\s*([A-Z]{1,4}\s?-?\s?\d{2,3})',
    caseSensitive: false,
  ));

  final qty = firstMatchDouble(RegExp(
    r'(?:qty|quantity|volume|vol)\.?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:m3|m³|cum|cu\.?\s?m)?',
    caseSensitive: false,
  ));

  final slump = firstMatchDouble(RegExp(
    r'slump\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:mm)?',
    caseSensitive: false,
  ));

  final time = firstMatch(RegExp(
    r'(?:batch|loading|dispatch)?\s*time\s*[:\-]?\s*(\d{1,2}[:.]\d{2})',
    caseSensitive: false,
  ));

  final plant = firstMatch(RegExp(
    r'(?:plant|supplier|rmc\s*plant)\s*(?:name)?\s*[:\-]\s*([A-Za-z0-9 &.\-]{3,40})',
    caseSensitive: false,
  ));

  return BatchSlipExtraction(
    truckNo: truckNo?.toUpperCase().replaceAll(RegExp(r'\s+'), ''),
    deliveryChallanNo: challan,
    mixIdOrGrade: grade?.toUpperCase().replaceAll(RegExp(r'\s+'), ''),
    quantityM3: qty,
    slumpMm: slump,
    batchStartTime: _normalizeTime(time),
    supplierName: plant,
  );
}

/// Normalizes a matched time like `2.35` or `2:5` to `HH:mm`. Returns the
/// input unchanged if it doesn't look like a sane 24-hour time — better to
/// leave the field for manual entry than write a wrong-but-plausible time.
String? _normalizeTime(String? raw) {
  if (raw == null) return null;
  final parts = raw.split(RegExp(r'[:.]'));
  if (parts.length != 2) return null;
  final h = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
}
