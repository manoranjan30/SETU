/// Which distribution channel this build was compiled for — set at build
/// time via `--dart-define=FLAVOR=internal` / `--dart-define=FLAVOR=playstore`,
/// matching the Android product flavors of the same names
/// (`android/app/build.gradle.kts`).
///
/// Defaults to `internal` when no `--dart-define` is passed (e.g. a plain
/// `flutter run` during development) so existing dev workflows keep today's
/// behavior — including the in-app updater — without needing to remember an
/// extra flag.
///
/// The Play Store build must never reach the self-update-and-install flow
/// (`AppUpdateService`/`AndroidApkDownloader`/`UpdateDialogHelper`) — Google
/// Play policy prohibits apps installing executable code by any means other
/// than Play's own update mechanism. [isInternal] is the gate used for that;
/// the `REQUEST_INSTALL_PACKAGES` permission itself is also stripped from the
/// playstore flavor's manifest (`android/app/src/playstore/AndroidManifest.xml`)
/// as a second, independent layer.
class AppFlavor {
  AppFlavor._();

  static const String _flavor = String.fromEnvironment('FLAVOR', defaultValue: 'internal');

  static bool get isInternal => _flavor == 'internal';
  static bool get isPlayStore => _flavor == 'playstore';
}
