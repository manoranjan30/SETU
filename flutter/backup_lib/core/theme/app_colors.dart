import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Primary colors
  static const Color primary = Color(0xFF1976D2);
  static const Color primaryLight = Color(0xFF42A5F5);
  static const Color primaryDark = Color(0xFF0D47A1);

  // Secondary colors
  static const Color secondary = Color(0xFF26A69A);
  static const Color secondaryLight = Color(0xFF4DB6AC);
  static const Color secondaryDark = Color(0xFF00796B);

  // Status colors
  static const Color success = Color(0xFF4CAF50);
  static const Color warning = Color(0xFFFF9800);
  static const Color error = Color(0xFFE53935);
  static const Color info = Color(0xFF2196F3);

  // Background colors
  static const Color background = Color(0xFFF5F5F5);
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
