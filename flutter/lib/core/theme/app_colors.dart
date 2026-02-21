import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Primary colors (construction + property tone)
  static const Color primary = Color(0xFF1F5D8B);
  static const Color primaryLight = Color(0xFF3C7BAA);
  static const Color primaryDark = Color(0xFF134264);
  static const Color accent = Color(0xFFE2A93B);
  static const Color accentSoft = Color(0xFFF9F1E0);

  // Secondary colors
  static const Color secondary = Color(0xFF2E7D6F);
  static const Color secondaryLight = Color(0xFF4E9E90);
  static const Color secondaryDark = Color(0xFF1D5B50);

  // Status colors
  static const Color success = Color(0xFF2E9B62);
  static const Color warning = Color(0xFFC5851F);
  static const Color error = Color(0xFFD14C3F);
  static const Color info = Color(0xFF2F76B7);

  // Background colors
  static const Color background = Color(0xFFF4F6F8);
  static const Color backgroundDark = Color(0xFF121212);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceDark = Color(0xFF1E1E1E);

  // Text colors
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color textHint = Color(0xFF9E9E9E);
  static const Color textPrimaryDark = Color(0xFFFFFFFF);
  static const Color textSecondaryDark = Color(0xFFB0B0B0);

  // Border and divider
  static const Color outline = Color(0xFFE0E0E0);
  static const Color outlineDark = Color(0xFF424242);
  static const Color divider = Color(0xFFE0E0E0);
  static const Color dividerDark = Color(0xFF424242);

  // Hint color
  static const Color hint = Color(0xFF9E9E9E);

  // Sync status colors
  static const Color syncPending = Color(0xFFFF9800);
  static const Color syncSynced = Color(0xFF4CAF50);
  static const Color syncFailed = Color(0xFFE53935);

  // Progress status colors
  static const Color progressNotStarted = Color(0xFF9E9E9E);
  static const Color progressInProgress = Color(0xFF2196F3);
  static const Color progressCompleted = Color(0xFF4CAF50);
  static const Color progressDelayed = Color(0xFFE53935);
}
