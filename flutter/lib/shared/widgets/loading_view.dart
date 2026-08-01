import 'package:flutter/material.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';

/// Shared full-screen loading state — a branded spinner with an optional
/// message, centered. Replaces the bare `Center(child:
/// CircularProgressIndicator())` that got repeated across the app (41
/// occurrences at last count) with Material's default (unbranded, grey)
/// spinner and no way to explain what's loading.
///
/// This intentionally does *not* replace the shimmer-skeleton pattern
/// already used on a handful of list pages (`ShimmerList`) — that's a
/// better loading experience for "a list is about to appear here" and
/// should stay. This widget is for the simpler "whole screen isn't ready
/// yet" case those pages don't cover.
class LoadingView extends StatelessWidget {
  final String? message;

  const LoadingView({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(strokeWidth: 3, color: AppColors.primary),
          ),
          if (message != null) ...[
            const SizedBox(height: 12),
            Text(message!, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}
