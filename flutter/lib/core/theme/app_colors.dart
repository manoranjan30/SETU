import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ── Primary — deep navy (CRED-style premium dark)
  static const Color primary = Color(0xFF0F3460);
  static const Color primaryLight = Color(0xFF1A5276);
  static const Color primaryDark = Color(0xFF091F3C);

  // ── Accent — warm gold (construction premium)
  static const Color accent = Color(0xFFC9912A);
  static const Color accentSoft = Color(0xFFF8F2E6);

  // ── Secondary — teal
  static const Color secondary = Color(0xFF0E7490);
  static const Color secondaryLight = Color(0xFF1A91AE);
  static const Color secondaryDark = Color(0xFF0A5567);

  // ── Status
  static const Color success = Color(0xFF0D8050);
  static const Color successSoft = Color(0xFFE6F4EE);
  static const Color warning = Color(0xFFD97706);
  static const Color warningSoft = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFDC2626);
  static const Color errorSoft = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF1D4ED8);
  static const Color infoSoft = Color(0xFFEFF6FF);

  // ── Backgrounds
  static const Color background = Color(0xFFF5F4F0);   // warm cream
  static const Color backgroundDark = Color(0xFF111111);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF0EEE9); // section headers
  static const Color surfaceDark = Color(0xFF1C1C1E);

  // ── Text
  static const Color textPrimary = Color(0xFF111111);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textHint = Color(0xFFADB5BD);
  static const Color textPrimaryDark = Color(0xFFF9FAFB);
  static const Color textSecondaryDark = Color(0xFF9CA3AF);

  // ── Borders / dividers
  static const Color outline = Color(0xFFD1D5DB);
  static const Color outlineDark = Color(0xFF374151);
  static const Color divider = Color(0xFFEBEBEB);
  static const Color dividerDark = Color(0xFF2D2D2D);

  // ── Hint
  static const Color hint = Color(0xFFADB5BD);

  // ── Sync status
  static const Color syncPending = Color(0xFFF59E0B);
  static const Color syncSynced = Color(0xFF10B981);
  static const Color syncFailed = Color(0xFFEF4444);

  // ── Progress status
  static const Color progressNotStarted = Color(0xFF9CA3AF);
  static const Color progressInProgress = Color(0xFF3B82F6);
  static const Color progressCompleted = Color(0xFF10B981);
  static const Color progressDelayed = Color(0xFFEF4444);

  // ── Shadow helper (use with BoxShadow)
  static const Color shadowColor = Color(0x12000000); // 7% black
  static const Color shadowColorMd = Color(0x1A000000); // 10% black
}
