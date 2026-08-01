import 'package:flutter/material.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';

/// Consistent success/error snackbars. `Theme.appTheme`'s `snackBarTheme`
/// already sets the shape/behavior/default color, but most pages override
/// `backgroundColor` inline per call site (`Colors.red.shade700`,
/// `Colors.green.shade700`, ...), which drifts from the theme and from each
/// other. These two helpers are the one place that mapping lives.
class AppSnackbar {
  AppSnackbar._();

  static void success(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: AppColors.success,
    ));
  }

  static void error(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: AppColors.error,
    ));
  }

  /// For "saved offline, will sync later" style messages — distinct from
  /// [error] (nothing went wrong) and [success] (it's not confirmed synced
  /// yet either).
  static void info(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: AppColors.warning,
    ));
  }
}
