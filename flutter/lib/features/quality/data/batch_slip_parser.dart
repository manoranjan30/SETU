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
/// - Each field tries its labeled pattern(s) first, then (for the fields
///   most worth getting right without a label — truck no., grade, and
///   quantity) falls back to a shape-only match anywhere in the text.
/// - Numeric captures accept the OCR digit-lookalikes O/o/l/I in digit
///   positions and normalize them afterward — pure letters never leak into
///   a numeric field, but "6.5O" still reads as `6.5`.
/// - Add new built-in label synonyms as a `|`-alternative in the relevant
///   `_labelGroup(...)` call rather than a whole new field.
/// - The gap between a matched label and its value is a bounded,
///   digit-excluding "skip anything" span (see `_gap` below) rather than
///   requiring the value to sit immediately after the label. Real slips
///   print rows like "9. Grade of Concrete    M30" or "10. Quantity of this
///   sheet   06.00 M3", where descriptive words — and, on wide two-column
///   ruled slips, even ML Kit splitting the label and value onto separate
///   recognized lines — sit between the label and the actual value. `\n`
///   counts as whitespace to Dart regex by default, so the gap bridges a
///   line split the same way it bridges "of Concrete".
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

// A numeric value: must *start* with a real 0-9 digit (never bare O/o/l/I),
// then tolerates the OCR-confusable [_digit] class for the rest, then an
// optional decimal part. Requiring a genuine leading digit matters once a
// label's value can be reached across a permissive gap that includes plain
// words — "Quantity of this sheet" contains a lowercase "o" (in "of"), which
// $_digit alone would happily match as a one-character "quantity" if the gap
// were allowed to stop there instead of continuing on to the real "06.00".
const _numShape = '[0-9]$_digit*(?:\\.$_digit+)?';

// Bridges a matched label to its value without requiring strict adjacency.
// Real slips routinely put descriptive words between the two — "Grade **of
// Concrete**    M30", "Quantity **of this sheet**   06.00" — and a wide
// two-column ruled slip can even end up with ML Kit recognizing the label
// and its value as separate lines. `\n` is whitespace to Dart regex by
// default, so this bridges a line split exactly the same way it bridges
// "of Concrete": lazily, stopping at the first digit, capped at 50 chars
// (roughly a label phrase plus one extra line) so an unrelated field
// several rows down never gets attached to the wrong label.
const _gap = r'[^\d]{0,50}?';

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

  final truckLabels = _labelGroup(
    'truck|vehicle|veh|lorry|transit\\s*mixer|mixer',
    extrasFor(BatchSlipFieldKey.truckNo),
  );
  final truckNoLabeled = firstMatch(RegExp(
    // The "no./number/#/reg." qualifier is consumed explicitly, right after
    // the label and before the bridging gap — otherwise a bare "No" could
    // itself satisfy the loose `[A-Z0-9]{4,10}` value alternative once the
    // gap is allowed to reach across filler words.
    '(?:$truckLabels)(?:\\.?\\s*(?:reg\\.?)?\\s*(?:no\\.?|number|#)?)?$_gap'
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
    r'(?:delivery\s*)?(?:challan|d\.?\s?c\.?|ticket|slip|docket|invoice|voucher|bill|sl\.?\s*no|serial\s*(?:no)?)',
    extrasFor(BatchSlipFieldKey.deliveryChallanNo),
  );
  final challan = firstMatch(RegExp(
    // Same "no./number/#" pre-consumption as truckNo, and for the same
    // reason — the bare word "No" fits the alphanumeric value shape below.
    '(?:$challanLabels)(?:\\.?\\s*(?:no\\.?|number|#)?)?$_gap'
    '([A-Z0-9\\-/]{2,15})',
    caseSensitive: false,
  ));

  // Deliberately no bare "mix" alternative — "Mix" alone collides with
  // "Transit **Mix**er No.", "Ad**mix**ture", and plant names/branding
  // like "Ready **Mix** Concrete", all of which are common on real slips
  // and would otherwise get misread as the grade label. Only the
  // unambiguous "Mix ID" compound counts.
  final gradeLabels = _labelGroup(
    r'grade|mix\s*id|concrete\s*(?:grade|type|class)|class\s*of\s*concrete',
    extrasFor(BatchSlipFieldKey.mixGrade),
  );
  const gradeShape = r'([A-Z]{1,4}\s?-?\s?\d{2,3})';
  final gradeLabeled = firstMatch(RegExp(
    '(?:$gradeLabels)$_gap$gradeShape',
    caseSensitive: false,
  ));
  // Fallback: a bare concrete-grade-shaped token (M20, M30, M35 (50%), ...)
  // anywhere in the text — covers slips where the grade is printed in a
  // table cell far enough from its label that even the bridged gap above
  // can't reach it. Case-sensitive and requires the "M" prefix specifically
  // (India's standard IS-456 grade notation) to avoid matching unrelated
  // two-letter-plus-digits tokens elsewhere on the slip.
  final gradeUnlabeled = gradeLabeled == null
      ? firstMatch(RegExp(r'\b(M\s?-?\s?\d{2,3})\b', caseSensitive: true))
      : null;
  final grade = gradeLabeled ?? gradeUnlabeled;
  final gradeConfidence = gradeLabeled != null
      ? BatchSlipFieldConfidence.high
      : (gradeUnlabeled != null ? BatchSlipFieldConfidence.low : BatchSlipFieldConfidence.none);

  final qtyLabels = _labelGroup('qty|quantity|volume|vol', extrasFor(BatchSlipFieldKey.quantityM3));
  final qtyLabeled = firstMatchDouble(RegExp(
    '(?:$qtyLabels)(?:\\.?\\s*(?:delivered|net|batch)?)?$_gap'
    '($_numShape)\\s*(?:m3|m³|cum|cu\\.?\\s?m)?',
    caseSensitive: false,
  ));
  // Fallback: a decimal number immediately followed by a volume unit,
  // anywhere in the text — covers slips that print quantity as a plain
  // table cell (e.g. "6.50 M3") with no "Qty" label on the same line.
  final qtyUnlabeled = qtyLabeled == null
      ? firstMatchDouble(RegExp(
          '([0-9]$_digit*\\.$_digit+)\\s*(?:m3|m³|cum|cu\\.?\\s?m)\\b',
          caseSensitive: false,
        ))
      : null;
  final qty = qtyLabeled ?? qtyUnlabeled;
  final qtyConfidence = qtyLabeled != null
      ? BatchSlipFieldConfidence.high
      : (qtyUnlabeled != null ? BatchSlipFieldConfidence.low : BatchSlipFieldConfidence.none);

  final slumpLabels = _labelGroup('slump', extrasFor(BatchSlipFieldKey.slumpMm));
  final slump = firstMatchDouble(RegExp(
    '(?:$slumpLabels)$_gap($_numShape)\\s*(?:mm)?',
    caseSensitive: false,
  ));

  final timeLabels = _labelGroup(
    r'(?:batch|loading|dispatch|load|departure)?\s*time|time\s*of\s*(?:batch|loading|dispatch|load|departure)',
    extrasFor(BatchSlipFieldKey.batchStartTime),
  );
  // Separator accepts common OCR misreads of a handwritten colon (an
  // apostrophe or hyphen) alongside the usual ':' and '.'.
  final time = firstMatch(RegExp(
    "(?:$timeLabels)$_gap(\\d{1,2}[:.'\\-]\\d{2})",
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
      confidence: gradeConfidence,
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
  // Matches the separator class the time-value pattern itself accepts —
  // colon/dot plus the common OCR misreads of a handwritten colon
  // (apostrophe, hyphen).
  final parts = raw.split(RegExp(r"[:.'\-]"));
  if (parts.length != 2) return null;
  final h = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
}
