/// Regex-based field extraction for concrete batching-plant slips.
///
/// Deliberately regex-only, no LLM in the loop: batch slips are printed
/// from a small number of batching-plant software templates, so a label →
/// value pattern match covers the common case cheaply and works fully
/// offline. A field that doesn't match is simply left blank for manual
/// entry.
///
/// Label wording is partly configurable — see
/// `docs/backend-handoff-batch-slip-scan-config.md` and
/// `docs/mobile-handoff-batch-slip-scan-config.md`. Quality admins add
/// plain literal label text (never regex) through a backend config screen;
/// [parseBatchSlipText]'s [configuredLabels] parameter merges those in
/// alongside the built-in stems below. The *value* shape per field (a
/// quantity is still always digits/decimal, a time is still always
/// `HH:MM`) is never configurable — only which label text identifies a
/// field is.
///
/// Tuning notes for whoever extends the built-in stems after seeing real
/// slips:
/// - Each field tries its labeled pattern(s) first, then (for the two
///   fields most worth getting right without a label — truck no. and
///   quantity) falls back to a shape-only match anywhere in the text.
/// - Numeric captures accept the OCR digit-lookalikes O/o/l/I in digit
///   positions and normalize them afterward — pure letters never leak into
///   a numeric field, but "6.5O" still reads as `6.5`.
/// - Add new built-in label synonyms as a `|`-alternative in the relevant
///   `_labelGroup(...)` call rather than a whole new field.
library;

enum BatchSlipFieldConfidence {
  /// Matched via an explicit label next to the value (e.g. "Truck No: MH12AB1234").
  high,

  /// Matched by value shape alone, with no label found nearby — still
  /// probably right, but worth a glance before trusting it.
  low,

  /// Nothing matched at all.
  none,
}

/// One field's extracted value plus how much to trust it.
class BatchSlipFieldResult<T> {
  final T? value;
  final BatchSlipFieldConfidence confidence;

  const BatchSlipFieldResult({this.value, this.confidence = BatchSlipFieldConfidence.none});

  bool get isMatched => value != null;
}

/// Canonical field identifiers — the `apiKey` values match the backend's
/// `fieldKey` enum exactly (`docs/backend-handoff-batch-slip-scan-config.md`),
/// so a [BatchSlipConfigService] response can be used to key into
/// [parseBatchSlipText]'s `configuredLabels` map with no translation step.
enum BatchSlipFieldKey {
  truckNo, deliveryChallanNo, mixGrade, quantityM3, slumpMm, batchStartTime, supplierName;

  String get apiKey => switch (this) {
    BatchSlipFieldKey.truckNo => 'TRUCK_NO',
    BatchSlipFieldKey.deliveryChallanNo => 'DELIVERY_CHALLAN_NO',
    BatchSlipFieldKey.mixGrade => 'MIX_GRADE',
    BatchSlipFieldKey.quantityM3 => 'QUANTITY_M3',
    BatchSlipFieldKey.slumpMm => 'SLUMP_MM',
    BatchSlipFieldKey.batchStartTime => 'BATCH_START_TIME',
    BatchSlipFieldKey.supplierName => 'SUPPLIER_NAME',
  };

  String get displayLabel => switch (this) {
    BatchSlipFieldKey.truckNo => 'Truck No.',
    BatchSlipFieldKey.deliveryChallanNo => 'Delivery Challan No.',
    BatchSlipFieldKey.mixGrade => 'Mix / Grade',
    BatchSlipFieldKey.quantityM3 => 'Quantity (m³)',
    BatchSlipFieldKey.slumpMm => 'Slump (mm)',
    BatchSlipFieldKey.batchStartTime => 'Batch Start Time',
    BatchSlipFieldKey.supplierName => 'Supplier Name',
  };
}

/// Fields pulled out of a batch slip's OCR text, matched 1:1 to
/// [PourCardEntry] fields the pour card entry form already has controllers
/// for. Every field is best-effort — the caller decides what to do with a
/// low-confidence or unmatched result (the review screen surfaces those
/// separately rather than silently trusting them).
class BatchSlipExtraction {
  final BatchSlipFieldResult<String> truckNo;
  final BatchSlipFieldResult<String> deliveryChallanNo;
  final BatchSlipFieldResult<String> mixIdOrGrade;
  final BatchSlipFieldResult<double> quantityM3;
  final BatchSlipFieldResult<double> slumpMm;
  final BatchSlipFieldResult<String> batchStartTime;
  final BatchSlipFieldResult<String> supplierName;

  const BatchSlipExtraction({
    this.truckNo = const BatchSlipFieldResult(),
    this.deliveryChallanNo = const BatchSlipFieldResult(),
    this.mixIdOrGrade = const BatchSlipFieldResult(),
    this.quantityM3 = const BatchSlipFieldResult(),
    this.slumpMm = const BatchSlipFieldResult(),
    this.batchStartTime = const BatchSlipFieldResult(),
    this.supplierName = const BatchSlipFieldResult(),
  });

  BatchSlipFieldResult<Object> byKey(BatchSlipFieldKey key) => switch (key) {
    BatchSlipFieldKey.truckNo => truckNo,
    BatchSlipFieldKey.deliveryChallanNo => deliveryChallanNo,
    BatchSlipFieldKey.mixGrade => mixIdOrGrade,
    BatchSlipFieldKey.quantityM3 => quantityM3,
    BatchSlipFieldKey.slumpMm => slumpMm,
    BatchSlipFieldKey.batchStartTime => batchStartTime,
    BatchSlipFieldKey.supplierName => supplierName,
  };

  int get matchedFieldCount => BatchSlipFieldKey.values.where((k) => byKey(k).isMatched).length;
  bool get isEmpty => matchedFieldCount == 0;
}

// A single digit position that ML Kit commonly misreads on tight,
// low-DPI thermal/dot-matrix slip printouts: O/o for 0, l/I for 1.
// Used inside numeric-value patterns so e.g. "6.5O" or "1O0" still match;
// [_fixOcrDigitConfusions] then normalizes the captured substring.
const _digit = r'[0-9OolI]';

/// Regex-escapes admin-configured literal label text before it goes into a
/// pattern — those labels are always plain text, never a regex the admin
/// authored themselves (see the design note in the class doc above).
String _escapeRegex(String s) =>
    s.replaceAllMapped(RegExp(r'[.*+?^${}()|[\]\\]'), (m) => '\\${m[0]}');

/// Combines built-in regex-safe label stems with admin-configured literal
/// labels (escaped) into one `a|b|c` alternation.
String _labelGroup(String builtinStems, List<String>? configured) {
  final extra = (configured ?? const []).where((s) => s.trim().isNotEmpty).map(_escapeRegex);
  return [builtinStems, ...extra].join('|');
}

/// Parses raw OCR text (as returned by [BatchSlipOcrService.recognizeText])
/// into whatever [BatchSlipExtraction] fields it can confidently find.
///
/// [configuredLabels] — from [BatchSlipConfigService], keyed by
/// [BatchSlipFieldKey.apiKey] — adds project-specific label wording on top
/// of the built-in stems below; pass `{}` (the default) to use only the
/// built-ins.
BatchSlipExtraction parseBatchSlipText(
  String text, {
  Map<String, List<String>> configuredLabels = const {},
}) {
  if (text.trim().isEmpty) return const BatchSlipExtraction();

  List<String>? extrasFor(BatchSlipFieldKey key) => configuredLabels[key.apiKey];

  String? firstMatch(RegExp pattern) {
    final m = pattern.firstMatch(text);
    final value = m?.group(1)?.trim();
    return (value == null || value.isEmpty) ? null : value;
  }

  double? firstMatchDouble(RegExp pattern) {
    final raw = firstMatch(pattern);
    return raw == null ? null : double.tryParse(_fixOcrDigitConfusions(raw));
  }

  // Strict Indian vehicle-plate shape (e.g. "MH12AB1234", "KA 05 MX 4321")
  // — distinctive enough to search for anywhere in the text, not just next
  // to a label, since many slips print the truck number in a table cell
  // with no "Truck No:" label at all.
  const platePattern =
      r'([A-Z]{2}\s?-?\s?\d{1,2}\s?-?\s?[A-Z]{1,3}\s?-?\s?\d{3,4})';

  final truckLabels = _labelGroup('truck|vehicle|veh|lorry', extrasFor(BatchSlipFieldKey.truckNo));
  final truckNoLabeled = firstMatch(RegExp(
    '(?:$truckLabels)\\.?\\s*(?:reg\\.?)?\\s*(?:no\\.?|number|#)?\\s*[:\\-]?\\s*'
    '($platePattern|[A-Z0-9]{4,10})',
    caseSensitive: false,
  ));
  // No label matched — fall back to scanning the whole slip for anything
  // plate-shaped. Kept strict (full plate pattern only, not the loose
  // alphanumeric fallback above) to avoid mistaking an unrelated
  // batch/invoice number for the truck number.
  final truckNoUnlabeled = truckNoLabeled == null ? firstMatch(RegExp(platePattern, caseSensitive: true)) : null;
  final truckNoRaw = truckNoLabeled ?? truckNoUnlabeled;
  final truckNoConfidence = truckNoLabeled != null
      ? BatchSlipFieldConfidence.high
      : (truckNoUnlabeled != null ? BatchSlipFieldConfidence.low : BatchSlipFieldConfidence.none);

  final challanLabels = _labelGroup(
    r'(?:delivery\s*)?(?:challan|d\.?\s?c\.?|ticket|slip|docket|invoice|voucher|bill)',
    extrasFor(BatchSlipFieldKey.deliveryChallanNo),
  );
  final challan = firstMatch(RegExp(
    '(?:$challanLabels)\\.?\\s*(?:no\\.?|number|#)?\\s*[:\\-]?\\s*([A-Z0-9\\-/]{2,15})',
    caseSensitive: false,
  ));

  final gradeLabels = _labelGroup(
    r'grade|mix(?:\s*id)?|concrete\s*(?:grade|type|class)|class\s*of\s*concrete',
    extrasFor(BatchSlipFieldKey.mixGrade),
  );
  final grade = firstMatch(RegExp(
    '(?:$gradeLabels)\\s*[:\\-]?\\s*([A-Z]{1,4}\\s?-?\\s?\\d{2,3})',
    caseSensitive: false,
  ));

  final qtyLabels = _labelGroup('qty|quantity|volume|vol', extrasFor(BatchSlipFieldKey.quantityM3));
  final qtyLabeled = firstMatchDouble(RegExp(
    '(?:$qtyLabels)\\.?\\s*(?:delivered|net|batch)?\\s*[:\\-]?\\s*'
    '($_digit+(?:\\.$_digit+)?)\\s*(?:m3|m³|cum|cu\\.?\\s?m)?',
    caseSensitive: false,
  ));
  // Fallback: a decimal number immediately followed by a volume unit,
  // anywhere in the text — covers slips that print quantity as a plain
  // table cell (e.g. "6.50 M3") with no "Qty" label on the same line.
  final qtyUnlabeled = qtyLabeled == null
      ? firstMatchDouble(RegExp(
          '($_digit+\\.$_digit+)\\s*(?:m3|m³|cum|cu\\.?\\s?m)\\b',
          caseSensitive: false,
        ))
      : null;
  final qty = qtyLabeled ?? qtyUnlabeled;
  final qtyConfidence = qtyLabeled != null
      ? BatchSlipFieldConfidence.high
      : (qtyUnlabeled != null ? BatchSlipFieldConfidence.low : BatchSlipFieldConfidence.none);

  final slumpLabels = _labelGroup('slump', extrasFor(BatchSlipFieldKey.slumpMm));
  final slump = firstMatchDouble(RegExp(
    '(?:$slumpLabels)\\s*[:\\-]?\\s*($_digit+(?:\\.$_digit+)?)\\s*(?:mm)?',
    caseSensitive: false,
  ));

  final timeLabels = _labelGroup(
    r'(?:batch|loading|dispatch|load|departure)?\s*time',
    extrasFor(BatchSlipFieldKey.batchStartTime),
  );
  final time = firstMatch(RegExp(
    '(?:$timeLabels)\\s*[:\\-]?\\s*(\\d{1,2}[:.]\\d{2})',
    caseSensitive: false,
  ));

  final plantLabels = _labelGroup(
    r'(?:batching\s*)?(?:plant|supplier|rmc\s*(?:plant|unit)|unit|company)\s*(?:name)?',
    extrasFor(BatchSlipFieldKey.supplierName),
  );
  final plant = firstMatch(RegExp(
    '(?:$plantLabels)\\s*[:\\-]\\s*([A-Za-z0-9 &.\\-]{3,40})',
    caseSensitive: false,
  ));

  return BatchSlipExtraction(
    truckNo: BatchSlipFieldResult(
      value: truckNoRaw == null
          ? null
          : _fixOcrDigitConfusions(truckNoRaw).toUpperCase().replaceAll(RegExp(r'\s+'), ''),
      confidence: truckNoConfidence,
    ),
    deliveryChallanNo: BatchSlipFieldResult(
      value: challan,
      confidence: challan != null ? BatchSlipFieldConfidence.high : BatchSlipFieldConfidence.none,
    ),
    mixIdOrGrade: BatchSlipFieldResult(
      value: grade?.toUpperCase().replaceAll(RegExp(r'\s+'), ''),
      confidence: grade != null ? BatchSlipFieldConfidence.high : BatchSlipFieldConfidence.none,
    ),
    quantityM3: BatchSlipFieldResult(value: qty, confidence: qtyConfidence),
    slumpMm: BatchSlipFieldResult(
      value: slump,
      confidence: slump != null ? BatchSlipFieldConfidence.high : BatchSlipFieldConfidence.none,
    ),
    batchStartTime: BatchSlipFieldResult(
      value: _normalizeTime(time),
      confidence: time != null ? BatchSlipFieldConfidence.high : BatchSlipFieldConfidence.none,
    ),
    supplierName: BatchSlipFieldResult(
      value: plant,
      confidence: plant != null ? BatchSlipFieldConfidence.high : BatchSlipFieldConfidence.none,
    ),
  );
}

/// Maps ML Kit's most common digit-lookalike misreads back to real digits:
/// `O`/`o` → `0`, `l`/`I` → `1`. Only ever applied to a substring already
/// captured by a numeric- or plate-shaped pattern — never to free text
/// (grade prefixes, supplier names) where those letters are legitimate.
String _fixOcrDigitConfusions(String s) =>
    s.replaceAll(RegExp('[Oo]'), '0').replaceAll(RegExp('[lI]'), '1');

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
