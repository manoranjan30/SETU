import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/shared/widgets/severity_badge.dart';

void main() {
  Widget buildBadge(String severity) => MaterialApp(
        home: Scaffold(body: SeverityBadge(severity: severity)),
      );

  // ── 1. Renders HIGH ──────────────────────────────────────────────────────────

  testWidgets('renders HIGH text for HIGH severity', (tester) async {
    await tester.pumpWidget(buildBadge('HIGH'));

    expect(find.text('HIGH'), findsOneWidget);
  });

  // ── 2. Renders MEDIUM ────────────────────────────────────────────────────────

  testWidgets('renders MEDIUM text for MEDIUM severity', (tester) async {
    await tester.pumpWidget(buildBadge('MEDIUM'));

    expect(find.text('MEDIUM'), findsOneWidget);
  });

  // ── 3. Renders LOW ───────────────────────────────────────────────────────────

  testWidgets('renders LOW text for LOW severity', (tester) async {
    await tester.pumpWidget(buildBadge('LOW'));

    expect(find.text('LOW'), findsOneWidget);
  });

  // ── 4. Does not throw for unknown severity value ─────────────────────────────

  testWidgets('does not throw for unknown severity value', (tester) async {
    await tester.pumpWidget(buildBadge('UNKNOWN_SEVERITY'));

    // Widget renders without throwing; text is uppercased by the widget
    expect(find.text('UNKNOWN_SEVERITY'), findsOneWidget);
  });
}
