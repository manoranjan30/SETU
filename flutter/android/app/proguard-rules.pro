# google_mlkit_text_recognition's native wrapper references every ML Kit
# script recognizer (Chinese/Devanagari/Japanese/Korean/Latin) from one
# shared code path, but only the Latin script artifact is a declared
# dependency — this app only ever creates a TextRecognizer with
# TextRecognitionScript.latin (see BatchSlipOcrService). R8 in full mode
# still fails the build on the unresolvable references to the other
# scripts' classes unless told they're expected to be missing.
-dontwarn com.google.mlkit.vision.text.chinese.**
-dontwarn com.google.mlkit.vision.text.devanagari.**
-dontwarn com.google.mlkit.vision.text.japanese.**
-dontwarn com.google.mlkit.vision.text.korean.**
