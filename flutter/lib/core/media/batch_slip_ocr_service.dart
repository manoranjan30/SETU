import 'dart:io';

import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// Thin wrapper around ML Kit's on-device text recognizer.
///
/// Runs entirely on-device — no network call, no per-scan cost, works
/// offline. This matters for a construction-site app: a batching-plant slip
/// scan has to work the same with zero bars of signal as it does on WiFi.
///
/// The recognizer holds native resources and should be [close]d once the
/// screen that uses it is done — callers typically create one instance per
/// page and dispose it in `State.dispose()`.
class BatchSlipOcrService {
  final TextRecognizer _recognizer =
      TextRecognizer(script: TextRecognitionScript.latin);

  /// Runs OCR on the image at [imagePath] and returns the raw recognized
  /// text (all blocks/lines joined with newlines, in ML Kit's own reading
  /// order). Returns an empty string if nothing was recognized.
  Future<String> recognizeText(String imagePath) async {
    final input = InputImage.fromFilePath(imagePath);
    final result = await _recognizer.processImage(input);
    return result.text;
  }

  Future<void> close() => _recognizer.close();
}

/// True if [path] looks like it points at an existing, readable file —
/// callers should check this before handing a path to [BatchSlipOcrService]
/// since ML Kit throws a native platform exception (not a catchable Dart
/// error with a clean message) for a missing file.
bool batchSlipImageExists(String path) => File(path).existsSync();
