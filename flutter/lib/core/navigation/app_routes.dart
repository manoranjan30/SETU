import 'package:flutter/material.dart';

/// Slides up from bottom + fades in. Used for detail/modal pages.
class SlideUpRoute<T> extends PageRouteBuilder<T> {
  SlideUpRoute({required Widget child})
      : super(
          pageBuilder: (_, __, ___) => child,
          transitionDuration: const Duration(milliseconds: 320),
          reverseTransitionDuration: const Duration(milliseconds: 260),
          transitionsBuilder: (_, animation, __, child) {
            final slide = Tween<Offset>(
              begin: const Offset(0, 0.10),
              end: Offset.zero,
            ).chain(CurveTween(curve: Curves.easeOutCubic));
            return FadeTransition(
              opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
              child: SlideTransition(
                position: animation.drive(slide),
                child: child,
              ),
            );
          },
        );
}

/// Slides in from right + fades in. Used for lateral navigation.
class FadeSlideRoute<T> extends PageRouteBuilder<T> {
  FadeSlideRoute({required Widget child})
      : super(
          pageBuilder: (_, __, ___) => child,
          transitionDuration: const Duration(milliseconds: 280),
          reverseTransitionDuration: const Duration(milliseconds: 220),
          transitionsBuilder: (_, animation, __, child) {
            final slide = Tween<Offset>(
              begin: const Offset(0.05, 0),
              end: Offset.zero,
            ).chain(CurveTween(curve: Curves.easeOut));
            return FadeTransition(
              opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
              child: SlideTransition(
                position: animation.drive(slide),
                child: child,
              ),
            );
          },
        );
}
